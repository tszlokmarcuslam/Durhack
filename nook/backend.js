// Nook <-> EchoWorld backend: accounts, friends, parties and who's online (Supabase), plus the AI companion (/api/companion).
// Same database functions and rules as the React app (src/store/socialStore.ts, supabase/migrations/005_friends_parties.sql).
//
// It must be served by the app's dev server (`npm run dev`, then http://localhost:5173/nook/): that is what reads the public
// Supabase config from .env and serves /api/companion. Opened any other way, it loads but reports "not configured".
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL, anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const sb = url && anonKey ? createClient(url, anonKey) : null;
const POLL_MS = 30000;
export const USERNAME = /^[a-zA-Z0-9_]{3,24}$/;
export const ACTIVITIES = { hangout: { label: 'Hang out', icon: '💬' }, study: { label: 'Study session', icon: '📚' }, music: { label: 'Music jam', icon: '🎵' }, exercise: { label: 'Exercise challenge', icon: '🏋️' } };
const NOT_SET_UP = 'Accounts are not set up on this computer: add the Supabase keys to .env and open the page with npm run dev.';

/** onChange(state) runs whenever anything here changes. */
export function createBackend(onChange) {
  const state = { configured: !!sb, user: null, profile: null, friends: [], party: null, invites: [], online: new Set(), loaded: false, error: null };
  const emit = () => onChange && onChange(state);
  let channel = null, poll = null;

  /** Calls a database function. Messages raised by the SQL functions are written for players, so they are shown as-is. */
  async function rpc(fn, args) {
    if (!sb) return { data: null, error: NOT_SET_UP };
    const { data, error } = await sb.rpc(fn, args);
    if (!error) return { data, error: null };
    if (error.code === 'P0001') return { data: null, error: error.message };
    if (error.code === 'PGRST202') return { data: null, error: 'Friends are not set up on the server yet (run migration 005).' };
    return { data: null, error: 'Something went wrong. Check your connection and try again.' };
  }
  // tell another player's page to refresh its lists (carries no data)
  const nudge = userId => { if (channel) channel.send({ type: 'broadcast', event: 'nudge', payload: { to: userId } }); };
  const nudgeParty = party => party && party.members.forEach(m => m.userId !== (state.user && state.user.id) && nudge(m.userId));

  async function refresh() {
    if (!sb || !state.profile) return;
    const [friends, party, invites] = await Promise.all([rpc('my_friends'), rpc('my_party'), rpc('my_party_invites')]);
    const error = friends.error || party.error || invites.error;
    state.loaded = true; state.error = error || null;
    if (!error) {
      state.friends = (friends.data || []).map(f => ({ friendshipId: f.friendship_id, userId: f.user_id, username: f.username, displayName: f.display_name, status: f.status, incoming: f.incoming }));
      const rows = party.data || [];
      state.party = rows.length ? { id: rows[0].party_id, activity: rows[0].activity, leader: rows[0].leader, members: rows.map(r => ({ userId: r.user_id, username: r.username, displayName: r.display_name })) } : null;
      state.invites = (invites.data || []).map(i => ({ inviteId: i.invite_id, partyId: i.party_id, activity: i.activity, inviterUsername: i.inviter_username, inviterDisplayName: i.inviter_display_name, memberCount: Number(i.member_count) }));
    }
    emit();
  }

  function startSocial() {
    if (!sb || channel || !state.user) return;
    const me = state.user.id;
    // everyone signed in joins one presence channel keyed by user id (same channel as the React app)
    channel = sb.channel('echoworld-online', { config: { presence: { key: me } } });
    channel
      .on('presence', { event: 'sync' }, () => { state.online = new Set(Object.keys(channel ? channel.presenceState() : {})); emit(); })
      .on('broadcast', { event: 'nudge' }, ({ payload }) => { if (payload && payload.to === me) refresh(); })
      .subscribe(status => { if (status === 'SUBSCRIBED' && channel) channel.track({ since: Date.now() }); });
    poll = setInterval(refresh, POLL_MS);
    refresh();
  }
  function stopSocial() {
    if (poll) clearInterval(poll); poll = null;
    if (channel && sb) sb.removeChannel(channel); channel = null;
    Object.assign(state, { friends: [], party: null, invites: [], online: new Set(), loaded: false, error: null });
  }
  async function loadProfile() {
    const { data } = await sb.from('profiles').select('id, username, display_name').eq('id', state.user.id).maybeSingle();
    state.profile = data ? { username: data.username, displayName: data.display_name } : null;
  }
  async function onSession(session) {
    const u = session && session.user;
    if ((u ? u.id : null) === (state.user ? state.user.id : null)) return;
    stopSocial(); state.profile = null;
    state.user = u ? { id: u.id, email: u.email } : null;
    if (u) { await loadProfile(); if (state.profile) startSocial(); }
    emit();
  }
  if (sb) { sb.auth.getSession().then(({ data }) => onSession(data.session)); sb.auth.onAuthStateChange((_e, s) => onSession(s)); }

  async function act(fn, args, success, notify) {
    const { error } = await rpc(fn, args);
    if (error) return { ok: false, message: error };
    if (notify) nudge(notify);
    await refresh();
    return { ok: true, message: success };
  }
  const fail = message => ({ ok: false, message });

  return {
    state,
    async signIn(email, password) {
      if (!sb) return fail(NOT_SET_UP);
      const { error } = await sb.auth.signInWithPassword({ email, password });
      return error ? fail(error.message) : { ok: true, message: 'Signed in.' };
    },
    async signUp(email, password) {
      if (!sb) return fail(NOT_SET_UP);
      const { data, error } = await sb.auth.signUp({ email, password });
      if (error) return fail(error.message);
      return { ok: true, message: data.session ? 'Account created.' : 'Check your email to confirm your account, then sign in.' };
    },
    signOut() { if (sb) sb.auth.signOut(); },
    // a profile (username + name) is needed before friends and parties work
    async saveProfile(username, displayName) {
      if (!sb || !state.user) return fail(NOT_SET_UP);
      if (!USERNAME.test(username)) return fail('Usernames are 3 to 24 letters, numbers or underscores.');
      if (!displayName.trim()) return fail('Add the name people will see.');
      const { error } = await sb.from('profiles').upsert({ id: state.user.id, username, display_name: displayName.trim().slice(0, 40) });
      if (error) return fail(error.code === '23505' ? 'That username is taken.' : 'Could not save your profile. Try again.');
      await loadProfile(); startSocial(); emit();
      return { ok: true, message: 'Profile saved.' };
    },
    refresh,
    async addFriend(username) {
      const { data, error } = await rpc('send_friend_request', { target_username: username });
      if (error) return fail(error);
      await refresh();
      const f = state.friends.find(x => x.username.toLowerCase() === username.toLowerCase());
      if (f) nudge(f.userId);
      const name = f ? f.displayName : '@' + username;
      return { ok: true, message: ({ requested: 'Friend request sent to ' + name + '.', accepted: "You're now friends with " + name + '!', already_friends: "You're already friends with " + name + '.', already_requested: "You've already sent " + name + ' a request.' })[data] || 'Done.' };
    },
    respond: (f, accept) => act('respond_friend_request', { request_id: f.friendshipId, accept }, accept ? "You're now friends with " + f.displayName + '!' : 'Request declined.', accept ? f.userId : undefined),
    remove: f => act('remove_friend', { other: f.userId }, f.status === 'accepted' ? 'Removed ' + f.displayName + '.' : 'Request cancelled.'),
    createParty: activity => act('create_party', { new_activity: activity }, 'Party started. Invite some friends!'),
    async invite(f) {
      if (!state.party) { const r = await rpc('create_party', { new_activity: 'hangout' }); if (r.error) return fail(r.error); }
      return act('invite_to_party', { friend: f.userId }, 'Invited ' + f.displayName + ' to your party.', f.userId);
    },
    async respondInvite(inv, accept) {
      const r = await act('respond_party_invite', { invite_id: inv.inviteId, accept }, accept ? 'You joined ' + inv.inviterDisplayName + "'s party." : 'Invite declined.');
      if (r.ok && accept) nudgeParty(state.party);
      return r;
    },
    async leaveParty() {
      const left = state.party, r = await act('leave_party', undefined, 'You left the party.');
      if (r.ok) nudgeParty(left);
      return r;
    },
    // the AI companion (Gemini on the server). Returns { reply, players, mode } or throws an Error with a message for the player.
    async askCompanion(message, history) {
      const headers = { 'content-type': 'application/json' };
      const token = sb ? (await sb.auth.getSession()).data.session : null;
      if (token) headers.authorization = 'Bearer ' + token.access_token;
      let res;
      try { res = await fetch('/api/companion', { method: 'POST', headers, body: JSON.stringify({ message, history }) }); }
      catch (e) { throw new Error("Can't reach the companion. Is npm run dev running?"); }
      let body = null; try { body = await res.json(); } catch (e) { /* not JSON */ }
      if (!res.ok || !body || body.error) {
        if (res.status === 404) throw new Error('The companion needs the app server: open this page through npm run dev (localhost:5173/nook/).');
        throw new Error(body && body.message ? body.message : 'Server error (' + res.status + ').');
      }
      return body;
    }
  };
}
