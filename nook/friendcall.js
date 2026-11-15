// Calling a friend directly, instead of a random match. One page "rings" another; when they answer, both pages join
// the same call room and the call itself runs through callnet.js as usual. Only the ringing goes through this file.
//
// Transport: Supabase Realtime when the app has its keys (reaches friends on their own computers), otherwise
// BroadcastChannel, which only reaches other windows of this browser (for trying it without accounts).
const HELLO_MS = 3000, GONE_MS = 9500, RING_MS = 25000;
const rid = () => Math.random().toString(36).slice(2, 10);
const text = (v, n) => String(v == null ? '' : v).slice(0, n);

// o: { client(): Supabase client or null, me(): { id, name, meta }, onRing(call), onRingCancel(room) }
//   call: { from: { id, name, meta }, room, answer(ok) }      meta: what callnet's matches carry (name, look, country...)
export function createFriendCalls(o) {
  const people = new Map();   // other pages seen lately: id -> { id, name, meta, last }
  const waiting = new Map();  // rings we sent, by room: { to, onAnswer, timer }
  let ch = null, sb = null, bc = null, alive = true;

  function onMsg(m) {
    const me = o.me(); if (!m || typeof m !== 'object' || typeof m.from !== 'string' || !m.from || m.from === me.id) return;
    if (m.t === 'hello') people.set(m.from, { id: m.from, name: text(m.name, 40) || 'Guest', meta: m.meta && typeof m.meta === 'object' ? m.meta : {}, last: Date.now() });
    else if (m.t === 'bye') people.delete(m.from);
    else if (m.to !== me.id || typeof m.room !== 'string') return;
    else if (m.t === 'ring') {
      const from = { id: m.from, name: text(m.name, 40) || 'Guest', meta: m.meta && typeof m.meta === 'object' ? m.meta : {} };
      o.onRing && o.onRing({ from, room: m.room, answer: ok => post({ t: 'answer', to: m.from, room: m.room, ok: !!ok, name: o.me().name, meta: o.me().meta }) });
    } else if (m.t === 'cancel') o.onRingCancel && o.onRingCancel(m.room);
    else if (m.t === 'answer') { const w = waiting.get(m.room); if (!w || w.to !== m.from) return; clearTimeout(w.timer); waiting.delete(m.room); w.onAnswer(!!m.ok, m.meta && typeof m.meta === 'object' ? m.meta : {}, m.room); }
  }
  // pick the transport: the internet one as soon as the app's Supabase client exists
  function link() {
    const c = o.client ? o.client() : null;
    if (c && c !== sb) {
      if (bc) { bc.close(); bc = null; }
      if (ch && sb) try { sb.removeChannel(ch); } catch (e) {}
      sb = c; ch = sb.channel('nook-ring', { config: { broadcast: { self: false } } });
      ch.on('broadcast', { event: 'r' }, ({ payload }) => onMsg(payload)).subscribe(status => { if (status === 'SUBSCRIBED') hello(); });
    } else if (!c && !bc && !ch && typeof BroadcastChannel === 'function') { bc = new BroadcastChannel('nook-ring'); bc.onmessage = e => onMsg(e.data); }
  }
  function post(m) {
    const msg = Object.assign({ from: o.me().id }, m);
    try { if (ch) { const r = ch.send({ type: 'broadcast', event: 'r', payload: msg }); if (r && r.catch) r.catch(() => {}); } else if (bc) bc.postMessage(msg); } catch (e) {}
  }
  const hello = () => { const me = o.me(); post({ t: 'hello', name: me.name, meta: me.meta }); };
  const beat = setInterval(() => { if (!alive) return; link(); hello(); const now = Date.now(); people.forEach((p, id) => { if (now - p.last > GONE_MS) people.delete(id); }); }, HELLO_MS);
  const onHide = () => post({ t: 'bye' });
  window.addEventListener('pagehide', onHide);
  link(); setTimeout(hello, 300);

  return {
    // everyone with Nook open that this page can ring right now
    people: () => [...people.values()],
    isHere: id => people.has(id),
    // Ring someone. onAnswer(ok, theirMeta, room) when they answer; onTimeout() if they do not. Returns { cancel() }.
    ring(to, { onAnswer, onTimeout }) {
      const room = 'f' + rid() + rid(), me = o.me();
      const timer = setTimeout(() => { if (!waiting.has(room)) return; waiting.delete(room); post({ t: 'cancel', to, room }); onTimeout && onTimeout(); }, RING_MS);
      waiting.set(room, { to, onAnswer, timer }); post({ t: 'ring', to, room, name: me.name, meta: me.meta });
      return { cancel() { const w = waiting.get(room); if (!w) return; clearTimeout(w.timer); waiting.delete(room); post({ t: 'cancel', to, room }); } };
    },
    dispose() {
      alive = false; clearInterval(beat); window.removeEventListener('pagehide', onHide); post({ t: 'bye' });
      waiting.forEach(w => clearTimeout(w.timer)); waiting.clear();
      if (bc) bc.close(); if (ch && sb) try { sb.removeChannel(ch); } catch (e) {}
    }
  };
}
