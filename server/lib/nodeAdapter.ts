import type { IncomingMessage, ServerResponse } from 'node:http';

export type WebHandler = (req: Request) => Promise<Response>;

const MAX_BODY_BYTES = 64_000; // the handlers allow far less; this only stops a huge upload filling memory

/** Runs a Web-standard handler (the files in api/) behind Node's http server: used by the Vite dev server and server/render.ts. */
export async function runWebHandler(handler: WebHandler, route: string, req: IncomingMessage, res: ServerResponse) {
  try {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of req) {
      size += (chunk as Buffer).length;
      if (size > MAX_BODY_BYTES) {
        res.writeHead(413, { 'content-type': 'application/json' }).end(JSON.stringify({ error: 'too_large', message: 'Request is too large.' }));
        return;
      }
      chunks.push(chunk as Buffer);
    }
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) {
      if (typeof v === 'string') headers.set(k, v);
    }
    const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
    const response = await handler(
      new Request(`http://localhost/api/${route}`, { method: req.method, headers, body: hasBody ? Buffer.concat(chunks).toString('utf8') : undefined }),
    );
    res.statusCode = response.status;
    response.headers.forEach((value, key) => res.setHeader(key, value));
    res.end(Buffer.from(await response.arrayBuffer())); // binary-safe for audio
  } catch (err) {
    console.error(err);
    if (res.headersSent) return void res.end();
    res.writeHead(500, { 'content-type': 'application/json' }).end(JSON.stringify({ error: 'server_error', message: 'Something went wrong.' }));
  }
}
