// Nook <-> EchoWorld backend: accounts, friends, parties and who's online (Supabase), plus the AI companion (/api/companion).
// Same database functions and rules as the React app (src/store/socialStore.ts, supabase/migrations/005_friends_parties.sql).
//
// It must be served by the app's dev server (`npm run dev`, then http://localhost:5173/nook/): that is what reads the public
// Supabase config from .env and serves /api/companion. Opened any other way, it loads but reports "not configured".
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL, anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const sb = url && anonKey ? createClient(url, anonKey) : null;
export const supabaseClient = sb; // callnet.js uses it for real-time call matching (null = not configured)
const POLL_MS = 30000;
export const USERNAME = /^[a-zA-Z0-9_]{3,24}$/;
export const ACTIVITIES = { hangout: { label: 'Hang out', icon: '💬' }, study: { label: 'Study session', icon: '📚' }, music: { label: 'Music jam', icon: '🎵' }, exercise: { label: 'Exercise challenge', icon: '🏋️' } };
const NOT_SET_UP = 'Accounts are not set up on this computer: add the Supabase keys to .env and open the page with npm run dev.';

/** onChange(state) runs whenever anything here changes. */
export function createBackend(onChange) {
  const state = { configured: !!sb, user: null, profile: null, friends: [], party: null, invites: [], online: new Set(), loaded: false, error: null };
  const emit = () => onChange && onChange(state);
  let channel = null, poll = null;
  // Texts between friends. Every player has an inbox: the Realtime broadcast channel 'nook-dm-<their user id>'.
  // To text a friend, you join their inbox channel and broadcast a 'dm' event on it.
  // These inbox channels are NOT private or authenticated: anyone who knows a user id can send to that inbox (or listen to it),
  // and the sender's id inside a text is only what the sender says it is. Texts that don't come from an accepted friend are
  // dropped on arrival. Nothing is stored on the server, so a text only arrives while the friend has Nook open.
  // A real version needs a `messages` table with row-level security.
  let dmInbox = null, dmHandler = null;
  const dmOut = new Map();   // friend's user id -> { ch, ready }: their inbox channel, joined once and reused
  const DM_FAILED = 'Could not reach the server. Try again.';

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
    // my inbox for texts (see the note at dmInbox): only texts from accepted friends are passed on
    dmInbox = sb.channel('nook-dm-' + me, { config: { broadcast: { self: false } } });
    dmInbox.on('broadcast', { event: 'dm' }, ({ payload }) => {
      const f = payload && state.friends.find(x => x.status === 'accepted' && x.userId === payload.from);
      if (f && typeof payload.text === 'string' && dmHandler) dmHandler({ from: f.userId, name: f.displayName, text: payload.text.slice(0, 500), at: Date.now() });
    }).subscribe();
    poll = setInterval(refresh, POLL_MS);
    refresh();
  }
  function stopSocial() {
    if (poll) clearInterval(poll); poll = null;
    if (channel && sb) sb.removeChannel(channel); channel = null;
    if (sb) { if (dmInbox) sb.removeChannel(dmInbox); dmOut.forEach(o => sb.removeChannel(o.ch)); }
    dmInbox = null; dmOut.clear();
    Object.assign(state, { friends: [], party: null, invites: [], online: new Set(), loaded: false, error: null });
  }
  async function loadProfile() {
    const { data } = await sb.from('profiles').select('id, username, display_name').eq('id', state.user.id).maybeSingle();
    state.profile = data ? { username: data.username, displayName: data.display_name } : null;
  }
  // First sign-in: create the profile with a personal tag (the username) made from your name, e.g. "damon_4821".
  // Friends add you by this tag. Retries with new digits if the tag is taken.
  async function createTagProfile(u) {
    const meta = u.user_metadata || {};
    const display = String(meta.full_name || meta.name || (u.email || '').split('@')[0] || 'Nook friend').trim().slice(0, 40) || 'Nook friend';
    let base = display.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 14);
    if (base.length < 3) base = (base + 'nook').slice(0, 14);
    for (let i = 0; i < 6; i++) {
      const tag = base + '_' + (1000 + Math.floor(Math.random() * 9000));
      const { error } = await sb.from('profiles').insert({ id: u.id, username: tag, display_name: display });
      if (!error) return true;
      if (error.code !== '23505') { state.error = 'Could not create your profile: ' + error.message; return false; }
      // a duplicate: either the tag is taken (try again) or the profile already exists (done)
      const { data } = await sb.from('profiles').select('id').eq('id', u.id).maybeSingle();
      if (data) return true;
    }
    return false;
  }
  async function onSession(session) {
    const u = session && session.user;
    if ((u ? u.id : null) === (state.user ? state.user.id : null)) return;
    stopSocial(); state.profile = null;
    const meta = u ? u.user_metadata || {} : {};
    state.user = u ? { id: u.id, email: u.email, name: meta.full_name || meta.name || '', provider: (u.app_metadata && u.app_metadata.provider) || 'email' } : null;
    if (u) {
      await loadProfile();
      if (!state.profile && await createTagProfile(u)) { await loadProfile(); state.newTag = true; }
      if (state.profile) startSocial();
    }
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
    client: sb,   // for profile.js (Settings) and the World's realtime channel
    async reloadProfile() { if (state.user) { await loadProfile(); if (state.profile) startSocial(); emit(); } },   // after Settings saves a new name
    // Sign in with Google (Supabase OAuth). Leaves the page for Google and comes back here signed in.
    async signInWithGoogle() {
      if (!sb) return fail(NOT_SET_UP);
      try { // ask Supabase first, so a switched-off provider gives a clear message instead of an error page
        const r = await fetch(url + '/auth/v1/settings', { headers: { apikey: anonKey } });
        const cfg = r.ok ? await r.json() : null;
        if (cfg && cfg.external && cfg.external.google === false) return fail('Google sign-in is not switched on in Supabase yet: Authentication → Sign In / Providers → Google.');
      } catch (e) { /* offline or blocked: let Supabase report it */ }
      const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname, queryParams: { prompt: 'select_account' } } });
      return error ? fail(error.message) : { ok: true, message: 'Opening Google…' };
    },
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
    // Texts between friends (see the note at dmInbox). onDm(fn): fn({ from, name, text, at }) runs when a friend's text arrives.
    onDm(fn) { dmHandler = fn; },
    // Sends one text to a friend's inbox. Returns { ok: true } or { ok: false, message }. It is not stored: only send to a friend who is online.
    async sendDm(friend, text) {
      if (!sb || !state.user || !state.profile) return fail(sb ? 'Sign in to send texts.' : NOT_SET_UP);
      let out = dmOut.get(friend.userId);
      if (!out) {   // join their inbox channel: wait until the server confirms, give up after 5 seconds
        const ch = sb.channel('nook-dm-' + friend.userId, { config: { broadcast: { self: false } } });
        out = { ch, ready: new Promise(done => { const t = setTimeout(() => done(false), 5000); ch.subscribe(status => { if (status === 'SUBSCRIBED') { clearTimeout(t); done(true); } }); }) };
        dmOut.set(friend.userId, out);
      }
      if (!await out.ready) {
        if (dmOut.get(friend.userId) === out) { dmOut.delete(friend.userId); sb.removeChannel(out.ch); }
        return fail(DM_FAILED);
      }
      const sent = await out.ch.send({ type: 'broadcast', event: 'dm', payload: { from: state.user.id, text: String(text).slice(0, 500) } });
      return sent === 'ok' ? { ok: true } : fail(DM_FAILED);
    },
    // Speak text with ElevenLabs (via the app's /api/tts; the key stays on the server). Resolves when playback ends.
    async speak(text) {
      const headers = { 'content-type': 'application/json' };
      const s = sb ? (await sb.auth.getSession()).data.session : null;
      if (s) headers.authorization = 'Bearer ' + s.access_token;
      const res = await fetch('/api/tts', { method: 'POST', headers, body: JSON.stringify({ text: String(text).slice(0, 600) }) });
      if (!res.ok) { let m = 'Voice error (' + res.status + ').'; try { m = (await res.json()).message || m; } catch (e) { /* not JSON */ } throw new Error(m); }
      const url = URL.createObjectURL(await res.blob());
      if (this._audio) this._audio.pause();
      const a = this._audio = new Audio(url);
      return new Promise(r => { a.onended = a.onerror = () => { URL.revokeObjectURL(url); r(); }; a.play().catch(r); });
    },
    stopSpeaking() { if (this._audio) this._audio.pause(); },
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
