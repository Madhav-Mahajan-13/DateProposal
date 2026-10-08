import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createBlobResponseStore } from './blob-store.mjs';

const SESSION_COOKIE = 'biscuit_visitor';
const sessionPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const foodNames = ['Dosa', 'Street food', 'Coffee'];

class RequestError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function validatePlan(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new RequestError(400, 'Please send a valid date plan.');
  const { foods, day, time, place, itinerary } = value;
  if (
    !Array.isArray(foods) ||
    foods.length > 3 ||
    foods.some((food) => !foodNames.includes(food)) ||
    new Set(foods).size !== foods.length
  )
    throw new RequestError(400, 'Please choose valid food options.');
  if (
    typeof day !== 'string' ||
    (day &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(day) ||
        !Number.isFinite(Date.parse(`${day}T12:00:00Z`)) ||
        new Date(`${day}T12:00:00Z`).toISOString().slice(0, 10) !== day))
  )
    throw new RequestError(400, 'Please choose a valid date.');
  if (!['', 'Morning', 'Afternoon', 'Evening'].includes(time))
    throw new RequestError(400, 'Please choose a valid time.');
  if (
    typeof place !== 'string' ||
    place.length > 160 ||
    typeof itinerary !== 'string' ||
    itinerary.length > 1500
  )
    throw new RequestError(
      400,
      'Please keep the place and itinerary within the form limits.',
    );
  return {
    foods: foodNames.filter((food) => foods.includes(food)),
    day,
    time,
    place,
    itinerary,
  };
}

export function createResponseStore(filePath) {
  const file = resolve(filePath);
  let queue = Promise.resolve();

  function serial(operation) {
    const result = queue.then(operation);
    queue = result.catch(() => {});
    return result;
  }

  async function readStore() {
    await mkdir(dirname(file), { recursive: true });
    try {
      await writeFile(
        file,
        JSON.stringify({ version: 1, responses: {} }, null, 2) + '\n',
        { flag: 'wx', mode: 0o600 },
      );
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
    const store = JSON.parse(await readFile(file, 'utf8'));
    if (
      store.version !== 1 ||
      !store.responses ||
      typeof store.responses !== 'object' ||
      Array.isArray(store.responses)
    )
      throw new Error('Invalid response store');
    for (const [id, response] of Object.entries(store.responses)) {
      if (
        !sessionPattern.test(id) ||
        !response ||
        typeof response.updatedAt !== 'string'
      )
        throw new Error('Invalid saved response');
      try {
        validatePlan(response.plan);
      } catch {
        throw new Error('Invalid saved plan');
      }
    }
    return store;
  }

  async function writeStore(store) {
    const temporary = `${file}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, JSON.stringify(store, null, 2) + '\n', {
        mode: 0o600,
      });
      await rename(temporary, file);
    } finally {
      await rm(temporary, { force: true });
    }
  }

  return {
    clear() {
      return serial(async () => {
        await readStore();
        await writeStore({ version: 1, responses: {} });
      });
    },
    list() {
      return serial(async () =>
        Object.values((await readStore()).responses).sort((a, b) =>
          b.updatedAt.localeCompare(a.updatedAt),
        ),
      );
    },
    get(id) {
      return serial(async () => (await readStore()).responses[id] ?? null);
    },
    save(id, plan) {
      return serial(async () => {
        if (!sessionPattern.test(id)) throw new Error('Invalid visitor id');
        const cleanPlan = validatePlan(plan);
        const store = await readStore();
        const response = {
          plan: cleanPlan,
          updatedAt: new Date().toISOString(),
        };
        store.responses[id] = response;
        await writeStore(store);
        return response;
      });
    },
  };
}

function json(res, status, value) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(JSON.stringify(value));
}

async function readBody(req) {
  if (
    !req.headers['content-type']?.toLowerCase().startsWith('application/json')
  )
    throw new RequestError(415, 'Please send JSON.');
  const chunks = [];
  // Vercel may parse JSON before invoking the Node handler.
  if (req.body !== undefined) {
    const body =
      typeof req.body === 'string' || Buffer.isBuffer(req.body)
        ? req.body.toString()
        : JSON.stringify(req.body);
    if (Buffer.byteLength(body) > 16_384)
      throw new RequestError(413, 'This date plan is too large.');
    try {
      return JSON.parse(body);
    } catch {
      throw new RequestError(400, 'Please send valid JSON.');
    }
  }
  let length = 0;
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    length += chunk.length;
    if (length > 16_384) {
      req.resume();
      throw new RequestError(413, 'This date plan is too large.');
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new RequestError(400, 'Please send valid JSON.');
  }
}

export function createResponseApi({
  filePath = process.env.RESPONSES_FILE || resolve('data/responses.json'),
  store = process.env.VERCEL === '1' ||
  process.env.BLOB_READ_WRITE_TOKEN ||
  process.env.BLOB_STORE_ID
    ? createBlobResponseStore({ validatePlan })
    : createResponseStore(filePath),
} = {}) {
  return (req, res, next) => {
    const pathname = new URL(req.url || '/', 'http://localhost').pathname;
    // Also keep these project directories private during Vite development.
    if (/^\/(?:data|server)(?:\/|$)/.test(pathname)) {
      json(res, 404, { error: 'Not found.' });
      return;
    }
    if (!pathname.startsWith('/api/')) {
      next();
      return;
    }
    return (async () => {
      const isAdmin = pathname === '/api/admin-44444/entries';
      if (!isAdmin && pathname !== '/api/response')
        throw new RequestError(404, 'Not found.');
      const methods = isAdmin ? ['GET', 'DELETE'] : ['GET', 'PUT'];
      if (!methods.includes(req.method)) {
        res.setHeader('Allow', methods.join(', '));
        throw new RequestError(405, 'Method not allowed.');
      }
      if (req.headers.origin) {
        let originHost;
        try {
          originHost = new URL(req.headers.origin).host;
        } catch {
          throw new RequestError(403, 'Invalid origin.');
        }
        if (originHost !== req.headers.host)
          throw new RequestError(
            403,
            'Please use this site to save your plan.',
          );
      }
      if (req.headers['sec-fetch-site'] === 'cross-site')
        throw new RequestError(403, 'Please use this site to save your plan.');
      if (isAdmin) {
        res.setHeader('X-Robots-Tag', 'noindex, nofollow');
        if (req.method === 'DELETE') {
          if (req.headers['x-confirm-clear'] !== 'all-entries')
            throw new RequestError(400, 'Please confirm clearing all entries.');
          await store.clear();
          json(res, 200, { entries: [] });
        } else {
          json(res, 200, { entries: await store.list() });
        }
        return;
      }
      const cookie = req.headers.cookie
        ?.split(';')
        .map((part) => part.trim())
        .find((part) => part.startsWith(`${SESSION_COOKIE}=`))
        ?.slice(SESSION_COOKIE.length + 1);
      const id = cookie && sessionPattern.test(cookie) ? cookie : randomUUID();
      if (id !== cookie) {
        const secure =
          req.socket.encrypted ||
          process.env.COOKIE_SECURE === 'true' ||
          process.env.VERCEL === '1';
        res.setHeader(
          'Set-Cookie',
          `${SESSION_COOKIE}=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${secure ? '; Secure' : ''}`,
        );
      }
      const response =
        req.method === 'GET'
          ? await store.get(id)
          : await store.save(id, await readBody(req));
      json(res, 200, { response });
    })().catch((error) => {
      if (res.destroyed || res.writableEnded) return;
      json(res, error instanceof RequestError ? error.status : 500, {
        error:
          error instanceof RequestError
            ? error.message
            : 'Biscuit couldn’t open his notebook. Please try again.',
      });
    });
  };
}
