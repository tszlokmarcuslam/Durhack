import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Local dev only: serves /api/<name> by loading the same Web-standard handlers that
// Vercel runs in production, so the Gemini, ElevenLabs and Supabase service keys stay server-side.
const API_ROUTES = new Set(['companion', 'tts']);

function apiDevPlugin(env: Record<string, string>): Plugin {
  return {
    name: 'echoworld-api-dev',
    configureServer(server) {
      Object.assign(process.env, env); // make .env values visible to server modules
      server.middlewares.use('/api', async (req, res, next) => {
        const route = (req.url ?? '').split('?')[0].replace(/^\//, '');
        if (!API_ROUTES.has(route)) return next();
        try {
          const mod = await server.ssrLoadModule(`/api/${route}.ts`);
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(chunk as Buffer);
          const headers = new Headers();
          for (const [k, v] of Object.entries(req.headers)) {
            if (typeof v === 'string') headers.set(k, v);
          }
          const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
          const request = new Request(`http://localhost/api/${route}`, {
            method: req.method,
            headers,
            body: hasBody ? Buffer.concat(chunks).toString('utf8') : undefined,
          });
          const response: Response = await mod.default(request);
          res.statusCode = response.status;
          response.headers.forEach((value, key) => res.setHeader(key, value));
          res.end(Buffer.from(await response.arrayBuffer())); // binary-safe for audio
        } catch (err) {
          console.error(err);
          res.statusCode = 500;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({ error: 'server_error', message: 'Something went wrong.' }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), tailwindcss(), apiDevPlugin(env)],
    server: { port: 5173 },
  };
});
