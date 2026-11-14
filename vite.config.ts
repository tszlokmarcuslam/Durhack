import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Local dev only: serves /api/companion by loading the same Web-standard handler that
// Vercel runs in production, so the Gemini key and Supabase service key stay server-side.
function apiDevPlugin(env: Record<string, string>): Plugin {
  return {
    name: 'echoworld-api-dev',
    configureServer(server) {
      Object.assign(process.env, env); // make .env values visible to server modules
      server.middlewares.use('/api/companion', async (req, res) => {
        try {
          const mod = await server.ssrLoadModule('/api/companion.ts');
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(chunk as Buffer);
          const headers = new Headers();
          for (const [k, v] of Object.entries(req.headers)) {
            if (typeof v === 'string') headers.set(k, v);
          }
          const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
          const request = new Request('http://localhost/api/companion', {
            method: req.method,
            headers,
            body: hasBody ? Buffer.concat(chunks).toString('utf8') : undefined,
          });
          const response: Response = await mod.default(request);
          res.statusCode = response.status;
          response.headers.forEach((value, key) => res.setHeader(key, value));
          res.end(await response.text());
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
