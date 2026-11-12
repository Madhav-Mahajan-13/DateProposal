import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApplication } from './index.mjs';

const plan = {
  foods: ['Dosa', 'Coffee'],
  day: '2030-01-12',
  time: 'Evening',
  place: 'Our favorite café',
  itinerary: 'Dosa → street food → coffee ♡',
};

async function setup(t) {
  const directory = await mkdtemp(join(tmpdir(), 'biscuit-response-'));
  const filePath = join(directory, 'responses.json');
  const servers = [];
  async function start() {
    const server = createApplication({ filePath });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    servers.push(server);
    return `http://127.0.0.1:${server.address().port}`;
  }
  t.after(async () => {
    for (const server of servers) {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
    await rm(directory, { recursive: true, force: true });
  });
  return { filePath, start, base: await start() };
}

async function visit(base) {
  const response = await fetch(`${base}/api/response`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('set-cookie'), /HttpOnly; SameSite=Lax/);
  return {
    cookie: response.headers.get('set-cookie').split(';')[0],
    body: await response.json(),
  };
}

async function save(base, cookie, value) {
  return fetch(`${base}/api/response`, {
    method: 'PUT',
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify(value),
  });
}

test('admin lists saved plans without visitor cookies', async (t) => {
  const { base } = await setup(t);
  const endpoint = `${base}/api/admin-44444/entries`;
  assert.deepEqual(await (await fetch(endpoint)).json(), {
    entries: [],
    notes: [],
  });
  const { cookie } = await visit(base);
  await save(base, cookie, plan);
  await save(base, cookie, { ...plan, place: 'Updated spot' });
  const other = await visit(base);
  await save(base, other.cookie, { ...plan, place: 'Latest spot' });
  const response = await fetch(endpoint);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const data = await response.json();
  assert.equal(data.entries.length, 2);
  assert.equal(data.entries[0].plan.place, 'Latest spot');
  assert.equal(data.entries[1].plan.place, 'Updated spot');
  assert.deepEqual(Object.keys(data.entries[0]).sort(), ['plan', 'updatedAt']);
  assert.equal((await fetch(endpoint, { method: 'POST' })).status, 405);
  for (const path of ['/admin-44444', '/admin-44444/']) {
    const page = await fetch(`${base}${path}`);
    assert.equal(page.status, 200);
    assert.match(page.headers.get('content-type'), /text\/html/);
  }
});

test('clearing requires confirmation, persists on disk, and resets prefill', async (t) => {
  const { base, filePath, start } = await setup(t);
  const { cookie } = await visit(base);
  await save(base, cookie, plan);
  const endpoint = `${base}/api/admin-44444/entries`;
  assert.equal((await fetch(endpoint, { method: 'DELETE' })).status, 400);
  assert.equal(
    (
      await fetch(endpoint, {
        method: 'DELETE',
        headers: {
          'X-Confirm-Clear': 'all-entries',
          Origin: 'https://unrelated.example',
        },
      })
    ).status,
    403,
  );
  assert.equal((await (await fetch(endpoint)).json()).entries.length, 1);
  assert.equal(
    (
      await fetch(endpoint, {
        method: 'DELETE',
        headers: {
          'X-Confirm-Clear': 'all-entries',
        },
      })
    ).status,
    200,
  );
  assert.deepEqual(JSON.parse(await readFile(filePath, 'utf8')), {
    version: 1,
    responses: {},
  });
  const restarted = await start();
  assert.equal(
    (
      await (
        await fetch(`${restarted}/api/response`, {
          headers: { Cookie: cookie },
        })
      ).json()
    ).response,
    null,
  );
  assert.equal((await save(restarted, cookie, plan)).status, 200);
});

test('final no persists in admin, replaces an old plan, and can later become a yes', async (t) => {
  const { base, start } = await setup(t);
  const { cookie } = await visit(base);
  await save(base, cookie, plan);
  const declined = await save(base, cookie, { outcome: 'declined' });
  assert.equal(declined.status, 200);
  assert.equal((await declined.json()).response.outcome, 'declined');
  const restarted = await start();
  const entries = (
    await (await fetch(`${restarted}/api/admin-44444/entries`)).json()
  ).entries;
  assert.equal(entries.length, 1);
  assert.equal(entries[0].outcome, 'declined');
  assert.equal(entries[0].plan, null);
  const restored = await fetch(`${restarted}/api/response`, {
    headers: { Cookie: cookie },
  });
  assert.equal((await restored.json()).response.outcome, 'declined');
  assert.equal((await save(restarted, cookie, plan)).status, 200);
  const changed = (
    await (await fetch(`${restarted}/api/admin-44444/entries`)).json()
  ).entries;
  assert.equal(changed.length, 1);
  assert.deepEqual(changed[0].plan, plan);
});

test('saves to disk, restores after server restart, and updates the same visitor', async (t) => {
  const { base, filePath, start } = await setup(t);
  const { cookie, body } = await visit(base);
  assert.equal(body.response, null);
  const saved = await save(base, cookie, plan);
  assert.equal(saved.status, 200);
  const disk = JSON.parse(await readFile(filePath, 'utf8'));
  assert.deepEqual(Object.values(disk.responses)[0].plan, plan);
  const restarted = await start();
  const restored = await fetch(`${restarted}/api/response`, {
    headers: { Cookie: cookie },
  });
  assert.deepEqual((await restored.json()).response.plan, plan);
  assert.equal(
    (await save(restarted, cookie, { ...plan, place: 'A new café' })).status,
    200,
  );
  const updated = JSON.parse(await readFile(filePath, 'utf8'));
  assert.equal(Object.keys(updated.responses).length, 1);
  assert.equal(Object.values(updated.responses)[0].plan.place, 'A new café');
});

test('isolates visitors and serializes concurrent saves without dropping responses', async (t) => {
  const { base, filePath } = await setup(t);
  const visitors = await Promise.all(
    Array.from({ length: 6 }, () => visit(base)),
  );
  await Promise.all(
    visitors.map(async ({ cookie }, index) =>
      assert.equal(
        (await save(base, cookie, { ...plan, place: `Place ${index}` })).status,
        200,
      ),
    ),
  );
  assert.equal(
    Object.keys(JSON.parse(await readFile(filePath, 'utf8')).responses).length,
    6,
  );
  for (let index = 0; index < visitors.length; index++) {
    const response = await fetch(`${base}/api/response`, {
      headers: { Cookie: visitors[index].cookie },
    });
    assert.equal((await response.json()).response.plan.place, `Place ${index}`);
  }
  assert.equal((await visit(base)).body.response, null);
});

test('rejects malformed fields and cross-site writes; keeps the saved plan intact', async (t) => {
  const { base } = await setup(t);
  const { cookie } = await visit(base);
  await save(base, cookie, plan);
  for (const value of [
    { ...plan, foods: ['unknown'] },
    { ...plan, foods: ['Dosa', 'Dosa'] },
    { ...plan, day: '2030-02-30' },
    { ...plan, time: 'Midnight' },
    { ...plan, itinerary: 'x'.repeat(1501) },
    null,
  ]) {
    assert.equal((await save(base, cookie, value)).status, 400);
  }
  const crossSite = await fetch(`${base}/api/response`, {
    method: 'PUT',
    headers: {
      Origin: 'https://unrelated.example',
      Cookie: cookie,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(plan),
  });
  assert.equal(crossSite.status, 403);
  const malformed = await fetch(`${base}/api/response`, {
    method: 'PUT',
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: '{invalid',
  });
  assert.equal(malformed.status, 400);
  assert.equal(
    (await save(base, cookie, { ...plan, itinerary: 'x'.repeat(20_000) }))
      .status,
    413,
  );
  assert.equal(
    (await fetch(`${base}/api/response`, { method: 'POST' })).status,
    405,
  );
  assert.equal((await fetch(`${base}/data/responses.json`)).status, 404);
  assert.equal((await fetch(`${base}/server/response-api.mjs`)).status, 404);
  const restored = await fetch(`${base}/api/response`, {
    headers: { Cookie: cookie },
  });
  assert.deepEqual((await restored.json()).response.plan, plan);
});

test('fails safely without overwriting a damaged JSON file', async (t) => {
  const { base, filePath } = await setup(t);
  const { cookie } = await visit(base);
  await writeFile(filePath, '{damaged file');
  assert.equal((await save(base, cookie, plan)).status, 500);
  assert.equal(await readFile(filePath, 'utf8'), '{damaged file');
});

test('khushi check-in notes save per visitor and show in admin', async (t) => {
  const { base } = await setup(t);
  const { cookie } = await visit(base);
  const put = (body) =>
    fetch(`${base}/api/note`, {
      method: 'PUT',
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  assert.equal((await put({ message: '   ' })).status, 400);
  assert.equal((await put({ message: 'x'.repeat(2001) })).status, 400);
  const saved = await put({ message: '  Honestly, a bit tired.  ' });
  assert.equal(saved.status, 200);
  assert.equal((await saved.json()).note.message, 'Honestly, a bit tired.');
  await save(base, cookie, plan);
  const admin = await (await fetch(`${base}/api/admin-44444/entries`)).json();
  assert.equal(admin.notes.length, 1);
  assert.equal(admin.notes[0].message, 'Honestly, a bit tired.');
  assert.equal(admin.entries.length, 1);
  const cleared = await fetch(`${base}/api/admin-44444/entries`, {
    method: 'DELETE',
    headers: { 'X-Confirm-Clear': 'all-entries' },
  });
  assert.deepEqual(await cleared.json(), { entries: [], notes: [] });
});

test('an emptied responses file is treated as a fresh notebook', async (t) => {
  const { base, filePath } = await setup(t);
  await writeFile(filePath, '');
  const { cookie, body } = await visit(base);
  assert.deepEqual(body, { response: null });
  const saved = await fetch(`${base}/api/note`, {
    method: 'PUT',
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'hello' }),
  });
  assert.equal(saved.status, 200);
  const stored = JSON.parse(await readFile(filePath, 'utf8'));
  assert.equal(Object.values(stored.notes)[0].message, 'hello');
});
