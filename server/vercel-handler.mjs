import { createResponseApi } from './response-api.mjs';

const api = createResponseApi();

export default function handler(req, res) {
  return api(req, res, () => {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found.' }));
  });
}
