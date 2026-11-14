// Live check of friends and parties against Supabase (needs migration 005).
//   npm run e2e:social
// Creates three throwaway players, exercises the rules, then deletes them.
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VITE_SUPABASE_ANON_KEY } = process.env;
const opts = { auth: { persistSession: false } };
const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, opts);

let failures = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  [${detail}]` : ''}`);
};

const tag = Date.now() % 1e8;
const players = [];
async function makePlayer(name) {
  const email = `e2e_${name}_${tag}@echoworld.test`;
  const password = randomUUID();
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const client = createClient(SUPABASE_URL, VITE_SUPABASE_ANON_KEY, opts);
  await client.auth.signInWithPassword({ email, password });
  const username = `${name}_${tag}`;
  const p = { id: data.user.id, username, client };
  players.push(p);
  const { error: profileError } = await client.from('profiles').upsert({ id: p.id, username, display_name: name });
  if (profileError) throw profileError;
  return p;
}
const rpc = async (p, fn, args) => {
  const { data, error } = await p.client.rpc(fn, args);
  return { data, error: error?.message ?? null };
};

try {
  const anon = createClient(SUPABASE_URL, VITE_SUPABASE_ANON_KEY, opts);
  const anonCall = await anon.rpc('my_friends');
  check('signed-out visitors cannot call friend functions', !!anonCall.error, anonCall.error?.code);

  const a = await makePlayer('alice');
  const b = await makePlayer('bob');
  const c = await makePlayer('cara');

  // friends
  check('add friend by username', (await rpc(a, 'send_friend_request', { target_username: b.username.toUpperCase() })).data === 'requested');
  check('unknown username is reported', /No player/.test((await rpc(a, 'send_friend_request', { target_username: 'nobody_here_123' })).error ?? ''));
  check('cannot friend yourself', /you/i.test((await rpc(a, 'send_friend_request', { target_username: a.username })).error ?? ''));
  const bobSees = (await rpc(b, 'my_friends')).data ?? [];
  check('request shows as incoming for the other player', bobSees.length === 1 && bobSees[0].incoming && bobSees[0].status === 'pending', JSON.stringify(bobSees));
  const aliceSees = (await rpc(a, 'my_friends')).data ?? [];
  check('sender cannot accept their own request', !!(await rpc(a, 'respond_friend_request', { request_id: aliceSees[0].friendship_id, accept: true })).error);
  check('lists expose only names', Object.keys(bobSees[0]).sort().join() === 'display_name,friendship_id,incoming,status,user_id,username', Object.keys(bobSees[0]).join());
  await rpc(b, 'respond_friend_request', { request_id: bobSees[0].friendship_id, accept: true });
  check('accepting makes both friends', (await rpc(a, 'my_friends')).data?.[0]?.status === 'accepted');
  check('re-adding an existing friend is harmless', (await rpc(b, 'send_friend_request', { target_username: a.username })).data === 'already_friends');

  const direct = await a.client.from('friendships').select('*');
  check('friendships table cannot be read directly', !direct.error && direct.data.length === 0, direct.error?.message ?? `${direct.data.length} rows`);
  const forged = await a.client.from('friendships').insert({ requester: c.id, addressee: a.id, status: 'accepted' });
  check('friendships cannot be forged directly', !!forged.error);

  // parties
  check('invite needs a party first', /party first/.test((await rpc(a, 'invite_to_party', { friend: b.id })).error ?? ''));
  await rpc(a, 'create_party', { new_activity: 'study' });
  check('only friends can be invited', /only invite friends/.test((await rpc(a, 'invite_to_party', { friend: c.id })).error ?? ''));
  check('bad activity is rejected', !!(await rpc(a, 'set_party_activity', { new_activity: 'heist' })).error);
  await rpc(a, 'invite_to_party', { friend: b.id });
  const invites = (await rpc(b, 'my_party_invites')).data ?? [];
  check('friend receives the party invite', invites.length === 1 && invites[0].activity === 'study' && invites[0].inviter_username === a.username, JSON.stringify(invites));
  await rpc(b, 'respond_party_invite', { invite_id: invites[0].invite_id, accept: true });
  const party = (await rpc(a, 'my_party')).data ?? [];
  check('joined party has both members, alice leads', party.length === 2 && party[0].leader === a.id, JSON.stringify(party.map((r) => r.username)));
  check('non-leader cannot change activity', /leader/.test((await rpc(b, 'set_party_activity', { new_activity: 'music' })).error ?? ''));
  check('outsiders cannot see the party', ((await rpc(c, 'my_party')).data ?? []).length === 0);

  await rpc(a, 'leave_party');
  const afterLeave = (await rpc(b, 'my_party')).data ?? [];
  check('leader leaving hands the party on', afterLeave.length === 1 && afterLeave[0].leader === b.id);
  await rpc(b, 'leave_party');
  check('last member leaving closes the party', ((await rpc(b, 'my_party')).data ?? []).length === 0);

  await rpc(a, 'remove_friend', { other: b.id });
  check('unfriend removes for both', ((await rpc(b, 'my_friends')).data ?? []).length === 0);
} finally {
  for (const p of players) await admin.auth.admin.deleteUser(p.id);
}
process.exit(failures ? 1 : 0);
