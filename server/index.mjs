import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createResponseApi } from './response-api.mjs';

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
};

export function createApplication({
  filePath,
  distDir = resolve('dist'),
} = {}) {
  const api = createResponseApi({ filePath });
  const root = resolve(distDir);
  return createServer((req, res) => {
    api(req, res, () => {
      void (async () => {
        if (!['GET', 'HEAD'].includes(req.method)) {
          res.writeHead(405).end();
          return;
        }
        const pathname = decodeURIComponent(
          new URL(req.url || '/', 'http://localhost').pathname,
        );
        if (
          pathname.includes('\0') ||
          pathname.split(/[\\/]/).some((part) => part.startsWith('.'))
        ) {
          res.writeHead(404).end();
          return;
        }
        const file = resolve(
          root,
          ['/', '/admin-44444', '/admin-44444/'].includes(pathname)
            ? 'index.html'
            : pathname.slice(1),
        );
        if (!file.startsWith(root + sep)) {
          res.writeHead(404).end();
          return;
        }
        const info = await stat(file);
        if (!info.isFile()) {
          res.writeHead(404).end();
          return;
        }
        res.writeHead(200, {
          'Content-Type': types[extname(file)] || 'application/octet-stream',
          'Content-Length': info.size,
          'Cache-Control': 'no-cache',
          'X-Content-Type-Options': 'nosniff',
        });
        if (req.method === 'HEAD') {
          res.end();
          return;
        }
        createReadStream(file)
          .on('error', () => res.destroy())
          .pipe(res);
      })().catch(() => {
        if (!res.headersSent) res.writeHead(404);
        res.end('Not found');
      });
    });
  });
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const port = Number(process.env.PORT || 3000);
  const host = process.env.HOST || '127.0.0.1';
  createApplication().listen(port, host, () =>
    console.log(`Biscuit is ready at http://${host}:${port}`),
  );
}
