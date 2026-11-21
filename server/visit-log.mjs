import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { get, put, BlobPreconditionFailedError } from '@vercel/blob';

// Oldest visits are dropped once the log grows past this.
const MAX_VISITS = 5000;

const text = (value, max) =>
  typeof value === 'string' ? value.slice(0, max) : '';
const int = (value) =>
  Number.isInteger(value) && value >= 0 && value < 100_000 ? value : null;

export function parseUserAgent(ua, { touchPoints = 0, platformVersion } = {}) {
  let os = 'Unknown';
  let m;
  if ((m = ua.match(/Windows NT ([\d.]+)/))) {
    const nt = { '10.0': '10', 6.3: '8.1', 6.2: '8', 6.1: '7' }[m[1]];
    // Chromium's high-entropy hints are the only way to tell 11 from 10.
    const major = parseInt(platformVersion ?? '', 10);
    os = `Windows ${nt === '10' && major >= 13 ? '11' : (nt ?? m[1])}`;
  } else if ((m = ua.match(/Android ([\d.]+)/))) os = `Android ${m[1]}`;
  else if ((m = ua.match(/(?:iPhone|CPU) OS ([\d_]+)/)))
    os = `${/iPad/.test(ua) ? 'iPadOS' : 'iOS'} ${m[1].replace(/_/g, '.')}`;
  else if ((m = ua.match(/Mac OS X ([\d_.]+)/)))
    // iPads on iPadOS 13+ pretend to be Macs; touch support gives them away.
    os = touchPoints > 1 ? 'iPadOS' : `macOS ${m[1].replace(/_/g, '.')}`;
  else if (/CrOS/.test(ua)) os = 'ChromeOS';
  else if (/Linux/.test(ua)) os = 'Linux';

  const deviceType = /bot|crawl|spider|slurp|preview|headless/i.test(ua)
    ? 'bot'
    : /iPad|Tablet/i.test(ua) ||
        os.startsWith('iPadOS') ||
        (/Android/.test(ua) && !/Mobile/.test(ua))
      ? 'tablet'
      : /Mobi|iPhone|Android/i.test(ua)
        ? 'mobile'
        : 'desktop';

  // Order matters: Edge/Opera/Samsung also claim to be Chrome and Safari.
  const browsers = [
    ['Edge', /Edg(?:A|iOS)?\/(\d+)/],
    ['Opera', /OPR\/(\d+)/],
    ['Samsung Internet', /SamsungBrowser\/(\d+)/],
    ['Firefox', /(?:Firefox|FxiOS)\/(\d+)/],
    ['Chrome', /(?:Chrome|CriOS)\/(\d+)/],
    ['Safari', /Version\/([\d.]+).*Safari/],
  ];
  let browser = 'Unknown';
  for (const [name, pattern] of browsers) {
    const match = ua.match(pattern);
    if (match) {
      browser = `${name} ${match[1]}`;
      break;
    }
  }

  return { deviceType, os, browser };
}

export function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)
    ?.split(',')[0]
    ?.trim();
  const ip =
    first || req.headers['x-real-ip'] || req.socket?.remoteAddress || '';
  return String(ip).replace(/^::ffff:/, '');
}

// Builds a stored visit from the request plus what the browser reported.
export function buildVisit(req, body) {
  const ua = text(req.headers['user-agent'], 400);
  const decode = (value) => {
    try {
      return value ? decodeURIComponent(String(value)) : '';
    } catch {
      return String(value);
    }
  };
  const screen = body?.screen ?? {};
  const viewport = body?.viewport ?? {};
  const page = text(body?.page, 300);
  return {
    id: randomUUID(),
    visitedAt: new Date().toISOString(),
    ip: clientIp(req),
    page: page.startsWith('/') ? page : '/',
    ...parseUserAgent(ua, {
      touchPoints: int(body?.touchPoints) ?? 0,
      platformVersion: text(body?.platformVersion, 20),
    }),
    screen: {
      width: int(screen.width),
      height: int(screen.height),
      pixelRatio:
        typeof screen.pixelRatio === 'number' &&
        screen.pixelRatio > 0 &&
        screen.pixelRatio < 10
          ? Math.round(screen.pixelRatio * 100) / 100
          : null,
    },
    viewport: { width: int(viewport.width), height: int(viewport.height) },
    language: text(body?.language, 35),
    timezone: text(body?.timezone, 60),
    referrer: text(body?.referrer, 300),
    // Vercel adds approximate location headers in production.
    country: decode(req.headers['x-vercel-ip-country']),
    city: decode(req.headers['x-vercel-ip-city']),
    userAgent: ua,
  };
}

function checkDocument(document) {
  if (document?.version !== 1 || !Array.isArray(document.visits))
    throw new Error('Invalid visit log');
  return document;
}

function createFileVisitLog(filePath) {
  const file = resolve(filePath);
  let queue = Promise.resolve();
  const serial = (operation) => {
    const result = queue.then(operation);
    queue = result.catch(() => {});
    return result;
  };
  async function read() {
    try {
      const raw = await readFile(file, 'utf8');
      return raw.trim()
        ? checkDocument(JSON.parse(raw))
        : { version: 1, visits: [] };
    } catch (error) {
      if (error.code === 'ENOENT') return { version: 1, visits: [] };
      throw error;
    }
  }
  async function write(document) {
    await mkdir(dirname(file), { recursive: true });
    const temporary = `${file}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, JSON.stringify(document, null, 2) + '\n', {
        mode: 0o600,
      });
      await rename(temporary, file);
    } finally {
      await rm(temporary, { force: true });
    }
  }
  return {
    add: (visit) =>
      serial(async () => {
        const document = await read();
        document.visits = [...document.visits, visit].slice(-MAX_VISITS);
        await write(document);
      }),
    list: () => serial(async () => (await read()).visits),
    clear: () => serial(() => write({ version: 1, visits: [] })),
  };
}

function createBlobVisitLog(
  pathname = process.env.BLOB_VISITS_PATH ||
    `biscuit/${process.env.VERCEL_ENV || 'development'}/visits.json`,
) {
  async function read() {
    const result = await get(pathname, { access: 'private', useCache: false });
    if (!result) return { document: { version: 1, visits: [] } };
    if (result.statusCode !== 200 || !result.stream)
      throw new Error('Cannot read visit log');
    const document = checkDocument(await new Response(result.stream).json());
    return { document, etag: result.blob.etag };
  }
  async function update(change) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const { document, etag } = await read();
      change(document);
      try {
        await put(pathname, JSON.stringify(document, null, 2) + '\n', {
          access: 'private',
          addRandomSuffix: false,
          contentType: 'application/json',
          allowOverwrite: Boolean(etag),
          ...(etag ? { ifMatch: etag } : {}),
        });
        return;
      } catch (error) {
        if (attempt === 4) throw error;
        if (error instanceof BlobPreconditionFailedError) continue;
        if (!etag && (await read()).etag) continue;
        throw error;
      }
    }
  }
  return {
    add: (visit) =>
      update((document) => {
        document.visits = [...document.visits, visit].slice(-MAX_VISITS);
      }),
    list: async () => (await read()).document.visits,
    clear: () =>
      update((document) => {
        document.visits = [];
      }),
  };
}

export function createVisitLog({
  filePath = process.env.VISITS_FILE || resolve('data/visits.json'),
} = {}) {
  return process.env.VERCEL === '1' ||
    process.env.BLOB_READ_WRITE_TOKEN ||
    process.env.BLOB_STORE_ID
    ? createBlobVisitLog()
    : createFileVisitLog(filePath);
}
