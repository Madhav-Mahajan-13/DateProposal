import assert from 'node:assert/strict';
import test from 'node:test';
import { createBlobVisitLog, parseUserAgent } from './visit-log.mjs';

// In-memory stand-in for @vercel/blob, listing in pathname order like the
// real service and refusing overwrites by default.
function fakeBlob() {
  const blobs = new Map();
  return {
    blobs,
    async put(pathname, body, options) {
      if (blobs.has(pathname) && !options.allowOverwrite)
        throw new Error('This blob already exists');
      blobs.set(pathname, body);
    },
    async get(pathname) {
      if (!blobs.has(pathname)) return null;
      return {
        statusCode: 200,
        stream: new Response(blobs.get(pathname)).body,
      };
    },
    async list({ prefix, limit }) {
      const names = [...blobs.keys()]
        .filter((n) => n.startsWith(prefix))
        .sort();
      return {
        blobs: names.slice(0, limit).map((pathname) => ({
          pathname,
          url: `https://blob.test/${pathname}`,
        })),
        hasMore: false,
      };
    },
    async del(urls) {
      for (const url of urls)
        blobs.delete(url.replace('https://blob.test/', ''));
    },
  };
}

const visit = (id, visitedAt) => ({ id, visitedAt, ip: '1.2.3.4', page: '/' });

test('blob visit log keeps every visit without overwriting', async () => {
  const client = fakeBlob();
  const log = createBlobVisitLog('t/visits/', client);
  const times = [
    '2026-11-21T10:00:00.000Z',
    '2026-11-21T12:00:00.000Z',
    '2026-11-21T11:00:00.000Z',
  ];
  // Concurrent page loads must all be kept.
  await Promise.all(times.map((t, i) => log.add(visit(`v${i}`, t))));
  assert.equal(client.blobs.size, 3);
  assert.deepEqual(
    (await log.list()).map((v) => v.visitedAt),
    [...times].sort(),
  );
  // Newest visits sort first by name, so a limited listing gets the latest.
  const names = [...client.blobs.keys()].sort();
  assert.match(names[0], /-v1\.json$/);

  await log.clear();
  assert.deepEqual(await log.list(), []);
});

test('parseUserAgent recognises common devices', () => {
  assert.deepEqual(
    parseUserAgent(
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36',
    ),
    { deviceType: 'mobile', os: 'Android 14', browser: 'Chrome 131' },
  );
  assert.deepEqual(
    parseUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36 Edg/131.0',
      { platformVersion: '15.0.0' },
    ),
    { deviceType: 'desktop', os: 'Windows 11', browser: 'Edge 131' },
  );
  assert.equal(
    parseUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
      { touchPoints: 5 },
    ).deviceType,
    'tablet',
  );
});
