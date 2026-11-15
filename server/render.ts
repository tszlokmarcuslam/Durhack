// Production server for Render (or any Node host): serves the built site from dist/ and runs /api/companion and
// /api/tts with the same handlers the dev server uses. Built by `npm run build:server`, started by `npm start`.
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import companion from '../api/companion';
import tts from '../api/tts';
import { runWebHandler, type WebHandler } from './lib/nodeAdapter';
import { findFile as findFileIn } from './lib/staticFiles';

const API: Record<string, WebHandler> = { companion, tts };
const DIST = resolve('dist');
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webp': 'image/webp',
  '.wasm': 'application/wasm', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8',
};

if (process.env.ECHO_DEV_MODE === 'true') console.warn('WARNING: ECHO_DEV_MODE is on. Never use it on a public site.');

const findFile = (urlPath: string) => findFileIn(DIST, urlPath);

const server = createServer(async (req, res) => {
  const urlPath = (req.url ?? '/').split('?')[0];
  if (urlPath.startsWith('/api/')) {
    const handler = API[urlPath.slice(5)];
    if (handler) return runWebHandler(handler, urlPath.slice(5), req, res);
    return void res.writeHead(404, { 'content-type': 'application/json' }).end('{"error":"not_found"}');
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') return void res.writeHead(405).end();
  // "/nook" without the slash would break the page's relative file loading
  if (!urlPath.endsWith('/') && !extname(urlPath) && (await findFile(urlPath + '/'))) {
    return void res.writeHead(301, { location: urlPath + '/' }).end();
  }
  const file = await findFile(urlPath);
  if (!file) return void res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
  res.writeHead(200, {
    'content-type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
    // hashed build files never change; everything else is checked on each visit so new deploys show up
    'cache-control': file.startsWith(join(DIST, 'assets') + sep) ? 'public, max-age=31536000, immutable' : 'no-cache',
    'x-content-type-options': 'nosniff',
  });
  if (req.method === 'HEAD') return void res.end();
  createReadStream(file).pipe(res);
});

const port = Number(process.env.PORT) || 3000;
server.listen(port, () => console.log(`Nook Meet is running on port ${port}`));
