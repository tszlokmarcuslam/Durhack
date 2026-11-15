// Real random calls for Nook: like Omegle, but you see each other's 3D avatar moving with your body tracking.
//
//  "nook-online"       presence: everyone with the page open (the "online now" count and flags)
//  "nook-lobby"        presence + broadcast: people who pressed Call. The earliest compatible pair is matched.
//  "nook-call-<room>"  broadcast: the call itself. Hello/heartbeat, live pose, chat, game events, voice signalling.
//  Voice is peer-to-peer WebRTC audio; the call room only carries its set-up messages.
//
// Transport: Supabase Realtime when the app is configured (anyone running the app with the same project, anywhere),
// otherwise BroadcastChannel, which links tabs of this browser only (for testing without keys).
const STUN = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:global.stun.twilio.com:3478'] }];
const POSE_HZ = 12, HEARTBEAT_MS = 2000, LOST_MS = 9000, PROPOSE_TIMEOUT_MS = 3000;
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const r2 = v => Math.round(v * 100) / 100;

/* ---------- transports ---------- */
function supabaseTransport(sb) {
  return {
    mode: 'internet',
    // presence channel: onSync([{ key, ...meta }]); onMsg(msg) for broadcasts on the same channel
    presence(name, key, meta, onSync, onMsg) {
      const ch = sb.channel(name, { config: { presence: { key }, broadcast: { self: false } } });
      const list = () => Object.entries(ch.presenceState()).map(([k, v]) => Object.assign({ key: k }, v[0] || {}));
      ch.on('presence', { event: 'sync' }, () => onSync(list()));
      if (onMsg) ch.on('broadcast', { event: 'm' }, ({ payload }) => onMsg(payload));
      ch.subscribe(st => { if (st === 'SUBSCRIBED') ch.track(meta); });
      return { send: msg => ch.send({ type: 'broadcast', event: 'm', payload: msg }), update: m => ch.track(m), close: () => { ch.untrack(); sb.removeChannel(ch); } };
    },
    room(name, onMsg) {
      const ch = sb.channel(name, { config: { broadcast: { self: false } } });
      ch.on('broadcast', { event: 'm' }, ({ payload }) => onMsg(payload));
      let ready = false; const queue = [];
      ch.subscribe(st => { if (st === 'SUBSCRIBED') { ready = true; queue.splice(0).forEach(m => ch.send({ type: 'broadcast', event: 'm', payload: m })); } });
      return { send: m => ready ? ch.send({ type: 'broadcast', event: 'm', payload: m }) : queue.push(m), close: () => sb.removeChannel(ch) };
    }
  };
}
function localTransport() {
  return {
    mode: 'local',
    presence(name, key, meta, onSync, onMsg) {
      const bc = new BroadcastChannel(name), peers = new Map();
      let mine = meta, alive = true;
      const sync = () => onSync([Object.assign({ key }, mine)].concat([...peers.entries()].map(([k, v]) => Object.assign({ key: k }, v.meta))));
      const here = () => bc.postMessage({ kind: 'here', key, meta: mine });
      bc.onmessage = ({ data }) => {
        if (!alive || !data || data.key === key) return;
        if (data.kind === 'here') { const isNew = !peers.has(data.key); peers.set(data.key, { meta: data.meta, seen: Date.now() }); if (isNew) { here(); sync(); } }
        else if (data.kind === 'bye') { if (peers.delete(data.key)) sync(); }
        else if (data.kind === 'm' && onMsg) onMsg(data.msg);
      };
      const iv = setInterval(() => { here(); let gone = false; peers.forEach((v, k) => { if (Date.now() - v.seen > 3500) { peers.delete(k); gone = true; } }); if (gone) sync(); }, 1000);
      here(); setTimeout(sync, 0);
      return { send: msg => bc.postMessage({ kind: 'm', key, msg }), update: m => { mine = m; here(); sync(); }, close: () => { alive = false; clearInterval(iv); bc.postMessage({ kind: 'bye', key }); bc.close(); } };
    },
    room(name, onMsg) {
      const bc = new BroadcastChannel(name);
      bc.onmessage = ({ data }) => onMsg(data);
      return { send: m => bc.postMessage(m), close: () => bc.close() };
    }
  };
}

/* ---------- matching ---------- */
// Both sides must accept each other's region: "Anywhere" accepts everyone.
const compatible = (a, b) => (a.pref === 'Anywhere' || a.pref === b.region) && (b.pref === 'Anywhere' || b.pref === a.region);
const earlier = (a, b) => a.t < b.t || (a.t === b.t && a.id < b.id);
// Greedy pairing over everyone waiting, oldest first. Every client computes the same pairs from the same list.
function partnerOf(list, me) {
  const sorted = list.slice().sort((a, b) => (earlier(a, b) ? -1 : 1)), paired = new Set();
  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i]; if (paired.has(a.id)) continue;
    for (let j = i + 1; j < sorted.length; j++) {
      const b = sorted[j]; if (paired.has(b.id) || !compatible(a, b)) continue;
      paired.add(a.id); paired.add(b.id);
      if (a.id === me) return b; if (b.id === me) return a;
      break;
    }
  }
  return null;
}

export function createCallNet(sb) {
  const T = sb ? supabaseTransport(sb) : localTransport();
  const me = uid();
  let online = null;

  return {
    mode: T.mode, id: me,

    /** Join the "online now" presence. onCount({ count, codes }) whenever it changes. */
    goOnline(meta, onCount) {
      if (online) online.close();
      online = T.presence('nook-online', me, meta, list => onCount({ count: list.length, codes: list.map(p => p.code).filter(Boolean) }));
      return { update: m => online && online.update(m) };
    },

    /** Look for someone. meta: { name, code, region, pref, tz, cfg, username }. onMatch({ room, peer, host }). */
    search(meta, { onMatch, onWaiting }) {
      const mine = Object.assign({}, meta, { id: me, t: Date.now() });
      let done = false, proposing = null, lobby = null;
      const tried = new Map(); // partner id -> until (skip someone who didn't answer)
      const finish = (room, peer, host) => { if (done) return; done = true; clearTimeout(proposing && proposing.timer); lobby.close(); onMatch({ room, peer, host }); };
      const evaluate = list => {
        if (done) return;
        const now = Date.now(), waiting = list.filter(p => p.id && !(tried.get(p.id) > now));
        if (onWaiting) onWaiting(Math.max(0, list.length - 1));
        const partner = partnerOf(waiting.some(p => p.id === me) ? waiting : waiting.concat(mine), me);
        if (!partner || proposing || !earlier(mine, partner)) return; // the earlier of the two proposes
        const room = uid();
        proposing = { to: partner.id, room, peer: partner, timer: setTimeout(() => { tried.set(partner.id, Date.now() + 6000); proposing = null; evaluate(last); }, PROPOSE_TIMEOUT_MS) };
        lobby.send({ kind: 'propose', to: partner.id, from: me, room, meta: mine });
      };
      let last = [];
      lobby = T.presence('nook-lobby', me, mine, list => { last = list; evaluate(list); }, msg => {
        if (done || !msg || msg.to !== me) return;
        if (msg.kind === 'propose') {
          // accept the first proposal, or one from someone who queued earlier than the person I'm proposing to
          if (proposing && !earlier(msg.meta, mine)) return;
          if (proposing) { clearTimeout(proposing.timer); proposing = null; }
          lobby.send({ kind: 'accept', to: msg.from, from: me, room: msg.room, meta: mine });
          finish(msg.room, msg.meta, false);
        } else if (msg.kind === 'accept' && proposing && msg.room === proposing.room) finish(msg.room, msg.meta, true);
      });
      return { cancel() { if (!done) { done = true; clearTimeout(proposing && proposing.timer); lobby.close(); } } };
    },

    /** Join a matched call room. h: { onConnected, onMsg(type, data), onPose(p), onLeft(reason), onVoice(state), onLevel(v) } */
    join(roomId, host, h) {
      let connected = false, closed = false, lastHeard = Date.now(), lastPose = 0, pc = null, mic = null, muted = false;
      let voiceReady = null, pendingIce = [], audio = null, actx = null, meter = 0, micOk = true;
      const room = T.room('nook-call-' + roomId, m => {
        if (closed || !m || m.from === me) return;
        lastHeard = Date.now();
        if (m.type === 'hi' || m.type === 'hi-ack') { if (m.type === 'hi') send('hi-ack'); if (!connected) { connected = true; h.onConnected && h.onConnected(); startVoice(); } return; }
        if (m.type === 'hb') return;
        if (m.type === 'bye') { leave('left', true); return; }
        if (m.type === 'p') { h.onPose && h.onPose(unpack(m.data)); return; }
        if (m.type === 'sdp') { onSdp(m.data); return; }
        if (m.type === 'ice') { onIce(m.data); return; }
        h.onMsg && h.onMsg(m.type, m.data);
      });
      const send = (type, data) => { if (!closed) room.send({ type, data, from: me }); };
      // say hello until the other side answers (messages sent before they subscribe are lost)
      const hello = setInterval(() => { if (!connected) send('hi'); }, 500); send('hi');
      const hb = setInterval(() => { if (connected) send('hb'); if (Date.now() - lastHeard > LOST_MS) leave('lost', true); }, HEARTBEAT_MS);

      /* voice: peer-to-peer audio (STUN only, so a few strict networks may not connect; the call still works without it) */
      function startVoice() {
        if (voiceReady) return voiceReady;
        voiceReady = (async () => {
          if (typeof RTCPeerConnection === 'undefined') { h.onVoice && h.onVoice('unsupported'); return; }
          pc = new RTCPeerConnection({ iceServers: STUN });
          pc.onicecandidate = e => { if (e.candidate) send('ice', e.candidate.toJSON()); };
          // 'on' = talking both ways; 'listen' = connected but your mic is blocked; 'nomic' = not connected yet and no mic
          pc.onconnectionstatechange = () => h.onVoice && h.onVoice(pc.connectionState === 'connected' ? (micOk ? 'on' : 'listen') : pc.connectionState === 'failed' ? 'failed' : micOk ? 'connecting' : 'nomic');
          pc.ontrack = e => {
            if (!audio) { audio = new Audio(); audio.autoplay = true; }
            audio.srcObject = e.streams[0] || new MediaStream([e.track]); audio.play().catch(() => {});
            try { // how loud they are, so their avatar can look like it's talking
              actx = actx || new AudioContext(); const an = actx.createAnalyser(); an.fftSize = 256;
              actx.createMediaStreamSource(audio.srcObject).connect(an); const buf = new Uint8Array(an.fftSize);
              meter = setInterval(() => { an.getByteTimeDomainData(buf); let s = 0; for (const x of buf) s += (x - 128) * (x - 128); h.onLevel && h.onLevel(Math.sqrt(s / buf.length) / 128); }, 120);
            } catch (er) { /* level meter is optional */ }
          };
          try {
            mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
            mic.getTracks().forEach(t => { t.enabled = !muted; pc.addTrack(t, mic); });
            h.onVoice && h.onVoice('connecting');
          } catch (e) { micOk = false; pc.addTransceiver('audio', { direction: 'recvonly' }); h.onVoice && h.onVoice('nomic'); }
          if (host) { await pc.setLocalDescription(await pc.createOffer()); send('sdp', pc.localDescription.toJSON()); }
        })().catch(e => { console.warn('[nook] voice failed', e); h.onVoice && h.onVoice('failed'); });
        return voiceReady;
      }
      async function onSdp(desc) {
        try {
          await startVoice(); if (!pc) return;
          await pc.setRemoteDescription(desc);
          pendingIce.splice(0).forEach(c => pc.addIceCandidate(c).catch(() => {}));
          if (desc.type === 'offer') { await pc.setLocalDescription(await pc.createAnswer()); send('sdp', pc.localDescription.toJSON()); }
        } catch (e) { console.warn('[nook] voice negotiation failed', e); }
      }
      function onIce(c) { if (pc && pc.remoteDescription) pc.addIceCandidate(c).catch(() => {}); else pendingIce.push(c); }

      function leave(reason, fromPeer) {
        if (closed) return;
        if (!fromPeer) send('bye');
        closed = true; clearInterval(hello); clearInterval(hb); clearInterval(meter);
        setTimeout(() => room.close(), 200);
        if (pc) pc.close(); if (mic) mic.getTracks().forEach(t => t.stop()); if (audio) audio.srcObject = null; if (actx) actx.close().catch(() => {});
        if (fromPeer) h.onLeft && h.onLeft(reason);
      }
      return {
        send,
        // your live tracking, at most POSE_HZ times a second
        sendPose(p) { const t = Date.now(); if (!connected || t - lastPose < 1000 / POSE_HZ) return; lastPose = t; send('p', pack(p)); },
        setMuted(on) { muted = !!on; if (mic) mic.getTracks().forEach(t => { t.enabled = !muted; }); },
        leave: () => leave('me', false),
        get connected() { return connected; }
      };
    },
    close() { if (online) online.close(); online = null; }
  };
}

/* ---------- pose packing (about 150 bytes) ---------- */
const packLimb = l => l ? l.up.concat(l.fore).map(r2).concat(r2(l.w)) : 0;
const unpackLimb = a => a ? { up: a.slice(0, 3), fore: a.slice(3, 6), w: a[6] } : null;
function pack(p) {
  if (!p) return 0;
  const b = p.body;
  return {
    h: p.head ? [r2(p.head.yaw), r2(p.head.pitch), r2(p.head.roll)] : 0,
    b: b ? { y: r2(b.yaw), r: r2(b.roll), a: [packLimb(b.arms[1]), packLimb(b.arms[-1])], l: b.legs ? [packLimb(b.legs[1]), packLimb(b.legs[-1])] : 0 } : 0
  };
}
function unpack(d) {
  if (!d) return null;
  const b = d.b;
  return {
    head: d.h ? { yaw: d.h[0], pitch: d.h[1], roll: d.h[2] } : null,
    body: b ? { yaw: b.y, roll: b.r, arms: { 1: unpackLimb(b.a[0]), [-1]: unpackLimb(b.a[1]) }, legs: b.l ? { 1: unpackLimb(b.l[0]), [-1]: unpackLimb(b.l[1]) } : null } : null
  };
}
