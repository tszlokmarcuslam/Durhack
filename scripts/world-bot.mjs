// A throwaway second player that walks in a circle near the spawn point, for testing multiplayer alone.
//   npm run bot            (runs 60 s)
//   npm run bot -- 120     (runs 120 s)
//   npm run bot -- 60 still   (stands still, handy for testing right-click)
// It reports who it can see in the world, then deletes its account.
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const seconds = Number(process.argv[2]) || 60;
const still = process.argv.includes('still');
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VITE_SUPABASE_ANON_KEY } = process.env;
const opts = { auth: { persistSession: false } };
const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, opts);

const tag = Date.now() % 1e6;
const email = `bot_${tag}@echoworld.test`;
const password = randomUUID();
const { data: created, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
if (error) throw error;
const id = created.user.id;
const client = createClient(SUPABASE_URL, VITE_SUPABASE_ANON_KEY, opts);
await client.auth.signInWithPassword({ email, password });
await client.realtime.setAuth((await client.auth.getSession()).data.session.access_token);
const username = `bot_${tag}`;
await client.from('profiles').upsert({ id, username, display_name: 'Test Walker' });

const seen = new Map();
const ch = client.channel('echoworld-world', { config: { presence: { key: id }, broadcast: { self: false } } });
ch.on('presence', { event: 'sync' }, () => {
  const names = Object.entries(ch.presenceState())
    .filter(([key]) => key !== id)
    .map(([, metas]) => metas[0]?.displayName);
  console.log(`[bot] players in world: ${names.length ? names.join(', ') : 'none'}`);
});
ch.on('broadcast', { event: 'pos' }, ({ payload }) => {
  if (!seen.has(payload.id)) console.log(`[bot] receiving positions from ${payload.id.slice(0, 8)}…`);
  seen.set(payload.id, payload);
});

await new Promise((resolve) => ch.subscribe((s) => s === 'SUBSCRIBED' && resolve()));
await ch.track({ username, displayName: 'Test Walker' });
console.log(`[bot] "Test Walker" (@${username}) joined for ${seconds}s, walking near the spawn point`);

const start = Date.now();
const walk = setInterval(() => {
  const t = still ? 0 : (Date.now() - start) / 1000;
  const x = Math.sin(t * 0.6) * 3;
  const z = 3 + Math.cos(t * 0.6) * 3;
  const h = Math.atan2(Math.cos(t * 0.6), -Math.sin(t * 0.6)); // face along the circle
  void ch.send({ type: 'broadcast', event: 'pos', payload: { id, x, z, h } });
}, 100);

await new Promise((r) => setTimeout(r, seconds * 1000));
clearInterval(walk);
for (const [who, p] of seen) console.log(`[bot] last position from ${who.slice(0, 8)}…: x=${p.x.toFixed(2)} z=${p.z.toFixed(2)}`);
await client.removeChannel(ch);
await admin.auth.admin.deleteUser(id);
console.log('[bot] left and deleted its account');
process.exit(0);
