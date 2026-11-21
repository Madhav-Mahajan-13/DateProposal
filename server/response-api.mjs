import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createBlobResponseStore } from './blob-store.mjs';
import { buildVisit, createVisitLog } from './visit-log.mjs';

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

export function validateNote(value) {
  const message =
    typeof value?.message === 'string' ? value.message.trim() : '';
  if (!message || message.length > 2000)
    throw new RequestError(
      400,
      'Please write a little something (up to 2000 characters).',
    );
  return message;
}

// Notes live beside responses in the same document: { [visitorId]: note }.
export function validateNotes(notes) {
  if (notes === undefined) return;
  if (!notes || typeof notes !== 'object' || Array.isArray(notes))
    throw new Error('Invalid saved notes');
  for (const [id, note] of Object.entries(notes))
    if (
      !sessionPattern.test(id) ||
      typeof note?.message !== 'string' ||
      typeof note.updatedAt !== 'string'
    )
      throw new Error('Invalid saved note');
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
    const text = await readFile(file, 'utf8');
    // An emptied file (e.g. cleared in an editor) counts as a fresh notebook.
    if (!text.trim()) return { version: 1, responses: {} };
    const store = JSON.parse(text);
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
        if (response.outcome === 'declined' && response.plan === null) continue;
        validatePlan(response.plan);
      } catch {
        throw new Error('Invalid saved plan');
      }
    }
    validateNotes(store.notes);
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
    decline(id) {
      return serial(async () => {
        if (!sessionPattern.test(id)) throw new Error('Invalid visitor id');
        const store = await readStore();
        const response = {
          outcome: 'declined',
          plan: null,
          updatedAt: new Date().toISOString(),
        };
        store.responses[id] = response;
        await writeStore(store);
        return response;
      });
    },
    clear() {
      return serial(async () => {
        await readStore();
        await writeStore({ version: 1, responses: {} });
      });
    },
    saveNote(id, message) {
      return serial(async () => {
        if (!sessionPattern.test(id)) throw new Error('Invalid visitor id');
        const store = await readStore();
        const note = { message, updatedAt: new Date().toISOString() };
        store.notes = { ...store.notes, [id]: note };
        await writeStore(store);
        return note;
      });
    },
    listNotes() {
      return serial(async () =>
        Object.values((await readStore()).notes ?? {}).sort((a, b) =>
          b.updatedAt.localeCompare(a.updatedAt),
        ),
      );
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
    ? createBlobResponseStore({ validatePlan, validateNotes })
    : createResponseStore(filePath),
  visits = createVisitLog(),
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
      const isNote = pathname === '/api/note';
      const isVisit = pathname === '/api/visit';
      const isVisitAdmin = pathname === '/api/admin-44444/visits';
      if (
        !isAdmin &&
        !isNote &&
        !isVisit &&
        !isVisitAdmin &&
        pathname !== '/api/response'
      )
        throw new RequestError(404, 'Not found.');
      const methods =
        isAdmin || isVisitAdmin
          ? ['GET', 'DELETE']
          : isNote
            ? ['PUT']
            : isVisit
              ? ['POST']
              : ['GET', 'PUT'];
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
      if (isVisit) {
        await visits.add(buildVisit(req, await readBody(req)));
        json(res, 200, { ok: true });
        return;
      }
      if (isVisitAdmin) {
        res.setHeader('X-Robots-Tag', 'noindex, nofollow');
        if (req.method === 'DELETE') {
          if (req.headers['x-confirm-clear'] !== 'all-visits')
            throw new RequestError(400, 'Please confirm clearing all visits.');
          await visits.clear();
          json(res, 200, { visits: [] });
        } else {
          json(res, 200, { visits: (await visits.list()).toReversed() });
        }
        return;
      }
      if (isAdmin) {
        res.setHeader('X-Robots-Tag', 'noindex, nofollow');
        if (req.method === 'DELETE') {
          if (req.headers['x-confirm-clear'] !== 'all-entries')
            throw new RequestError(400, 'Please confirm clearing all entries.');
          await store.clear();
          json(res, 200, { entries: [], notes: [] });
        } else {
          json(res, 200, {
            entries: await store.list(),
            notes: await store.listNotes(),
          });
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
      if (isNote) {
        const note = await store.saveNote(
          id,
          validateNote(await readBody(req)),
        );
        json(res, 200, { note });
        return;
      }
      const response =
        req.method === 'GET'
          ? await store.get(id)
          : await (async () => {
              const body = await readBody(req);
              if (body?.outcome === 'declined') return store.decline(id);
              return store.save(id, body);
            })();
      json(res, 200, { response });
    })().catch((error) => {
      // Unexpected failures show up in Vercel → Logs with the real cause.
      if (!(error instanceof RequestError))
        console.error(`${req.method} ${pathname} failed:`, error);
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
