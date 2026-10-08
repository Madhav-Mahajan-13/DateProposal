import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { BlobError, BlobPreconditionFailedError } from '@vercel/blob';
import { createBlobResponseStore } from './blob-store.mjs';
import { createResponseApi, validatePlan } from './response-api.mjs';

const plan = {
  foods: ['Dosa', 'Coffee'],
  day: '',
  time: 'Evening',
  place: 'Our spot',
  itinerary: 'Coffee after dosa',
};

function fakeBlob() {
  let value;
  let version = 0;
  return {
    async get(path, options) {
      assert.equal(options.access, 'private');
      assert.equal(options.useCache, false);
      return value === undefined
        ? null
        : {
            statusCode: 200,
            blob: { etag: String(version) },
            stream: new Response(value).body,
          };
    },
    async put(path, body, options) {
      assert.equal(options.access, 'private');
      assert.equal(options.addRandomSuffix, false);
      if (value !== undefined && !options.allowOverwrite)
        throw new BlobError('Blob already exists');
      if (options.ifMatch && options.ifMatch !== String(version))
        throw new BlobPreconditionFailedError();
      value = body;
      version++;
    },
  };
}

test('independent cloud instances preserve concurrent saves and share clear/prefill', async () => {
  const client = fakeBlob();
  const stores = Array.from({ length: 4 }, () =>
    createBlobResponseStore({ validatePlan, client }),
  );
  const ids = stores.map(() => randomUUID());
  assert.equal(await stores[0].get(ids[0]), null);
  await Promise.all(
    stores.map((store, i) =>
      store.save(ids[i], { ...plan, place: `Spot ${i}` }),
    ),
  );
  const fresh = createBlobResponseStore({ validatePlan, client });
  assert.equal((await fresh.list()).length, 4);
  assert.equal((await fresh.get(ids[2])).plan.place, 'Spot 2');
  await fresh.save(ids[2], plan);
  assert.equal((await fresh.list()).length, 4);
  await fresh.clear();
  assert.deepEqual(await stores[0].list(), []);
  assert.equal(await stores[1].get(ids[2]), null);
  await stores[2].save(ids[2], plan);
  assert.deepEqual((await fresh.get(ids[2])).plan, plan);
});

test('cloud storage errors and damaged JSON never turn into successful saves', async () => {
  let writes = 0;
  const store = createBlobResponseStore({
    validatePlan,
    client: {
      async get() {
        return {
          statusCode: 200,
          blob: { etag: '1' },
          stream: new Response('{broken').body,
        };
      },
      async put() {
        writes++;
      },
    },
  });
  await assert.rejects(store.save(randomUUID(), plan));
  await assert.rejects(store.clear());
  assert.equal(writes, 0);
  const unavailable = createBlobResponseStore({
    validatePlan,
    client: {
      async get() {
        throw new Error('Storage unavailable');
      },
    },
  });
  await assert.rejects(unavailable.get(randomUUID()), /unavailable/);
});

test('Vercel parsed request bodies work and handlers await cloud persistence', async () => {
  const store = createBlobResponseStore({ validatePlan, client: fakeBlob() });
  const api = createResponseApi({ store });
  const headers = {};
  let body;
  const res = {
    setHeader(key, value) {
      headers[key] = value;
    },
    writeHead(status, values) {
      this.status = status;
      Object.assign(headers, values);
    },
    end(value) {
      body = JSON.parse(value);
    },
  };
  const id = randomUUID();
  await api(
    {
      method: 'PUT',
      url: '/api/response',
      body: plan,
      socket: {},
      headers: {
        host: 'date.example',
        origin: 'https://date.example',
        'content-type': 'application/json',
        cookie: `biscuit_visitor=${id}`,
      },
    },
    res,
    () => assert.fail('Unexpected route'),
  );
  assert.equal(res.status, 200);
  assert.deepEqual(body.response.plan, plan);
  assert.deepEqual((await store.get(id)).plan, plan);
});
