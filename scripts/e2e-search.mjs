// Live end-to-end check of /api/companion against the seeded players (run `npm run seed` first).
//   node --env-file=.env scripts/e2e-search.mjs http://localhost:5173
// Creates a throwaway signed-in user, asks the companion to search, checks the privacy rules, deletes the user.
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const base = process.argv[2] ?? 'http://localhost:5173';
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VITE_SUPABASE_ANON_KEY } = process.env;
const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anon = createClient(SUPABASE_URL, VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } });

const email = `e2e_${Date.now()}@echoworld.test`;
const password = randomUUID();
const { data: created, error: createError } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
if (createError) throw createError;

let failures = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  [${detail}]` : ''}`);
};
const ask = async (message, token) => {
  const res = await fetch(`${base}/api/companion`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ message, history: [] }),
  });
  return { status: res.status, body: await res.json() };
};
const names = (r) => (r.body.players ?? []).map((p) => p.username).sort().join(',');

try {
  const { data: signedIn, error: signInError } = await anon.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  const token = signedIn.session.access_token;

  check('no token is rejected', (await ask('hi')).status === 401);
  check('bad token is rejected', (await ask('hi', 'not-a-token')).status === 401);

  const maths = await ask('Find someone from Manchester who studies maths.', token);
  console.log('   reply:', maths.body.reply ?? maths.body.message);
  check('Manchester + maths returns ada_l and ben_k only', names(maths) === 'ada_l,ben_k', names(maths));
  check('reply is live Gemini', maths.body.mode === 'live');

  const chess = await ask('Who is into chess?', token);
  console.log('   reply:', chess.body.reply ?? chess.body.message);
  check('chess excludes the opted-out player', names(chess) === 'ada_l,chen_w,hidden_city', names(chess));
  const eli = (chess.body.players ?? []).find((p) => p.username === 'hidden_city');
  check('hidden city is not returned', eli !== undefined && eli.city === undefined);

  const none = await ask('Find someone from Reykjavik who studies archaeology.', token);
  console.log('   reply:', none.body.reply ?? none.body.message);
  check('no match returns no players', none.status === 200 && (none.body.players ?? []).length === 0);

  // RLS: the browser key must not be able to read other players' rows directly.
  const authed = createClient(SUPABASE_URL, VITE_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { authorization: `Bearer ${token}` } },
  });
  const { data: rows, error: rlsError } = await authed.from('profiles').select('username');
  check('RLS hides other profiles from the browser', !rlsError && rows.length === 0, rlsError?.message ?? `${rows.length} rows`);
} finally {
  await admin.auth.admin.deleteUser(created.user.id);
}
process.exit(failures ? 1 : 0);
