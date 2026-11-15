import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { cpSync } from 'node:fs';
import { resolve } from 'node:path';
import { runWebHandler } from './server/lib/nodeAdapter';

// Local dev only: serves /api/<name> by loading the same Web-standard handlers that
// production runs (server/render.ts on Render), so the Gemini, ElevenLabs and Supabase service keys stay server-side.
const API_ROUTES = new Set(['companion', 'tts']);

function apiDevPlugin(env: Record<string, string>): Plugin {
  return {
    name: 'echoworld-api-dev',
    configureServer(server) {
      Object.assign(process.env, env); // make .env values visible to server modules
      server.middlewares.use('/api', async (req, res, next) => {
        const route = (req.url ?? '').split('?')[0].replace(/^\//, '');
        if (!API_ROUTES.has(route)) return next();
        // loaded per request so edits to api/ and server/ apply without a restart
        await runWebHandler((r) => server.ssrLoadModule(`/api/${route}.ts`).then((m) => m.default(r)), route, req, res);
      });
    },
  };
}

// The Nook page (nook/) loads its modules at runtime by file name, so they are copied into the build as they are.
// Only backend.js needs building: it imports @supabase/supabase-js and reads the VITE_ keys, which the dev server
// fills in on every request.
function nookBuildPlugin(): Plugin {
  let outDir = 'dist';
  return {
    name: 'nook-build',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
      if (config.build.ssr) outDir = ''; // the server build (npm run build:server) has no pages
    },
    buildStart() {
      if (!outDir) return;
      this.emitFile({ type: 'chunk', id: resolve('nook/backend.js'), fileName: 'nook/backend.js', preserveSignature: 'strict' });
    },
    closeBundle() {
      if (outDir) cpSync('nook', resolve(outDir, 'nook'), { recursive: true, filter: (src) => !/backend\.js$|\.test\.mjs$/.test(src) });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), tailwindcss(), apiDevPlugin(env), nookBuildPlugin()],
    server: { port: 5173 },
    // index.html sends visitors on to the Nook page; the React app is at /app/
    build: { rollupOptions: { input: { main: resolve('index.html'), app: resolve('app/index.html') } } },
  };
});
