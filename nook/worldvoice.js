// Talking on the island. One voice link per person who is in the same world as you, using the same peer-to-peer
// audio as calls (callnet.js join()). The call code does the work; this file only decides who to connect to.
//
// o: { net(): callnet or null, me(): my world id, people(): ids of the other real people in my world, onState(state, n) }
// state: 'off' (nobody else here) | 'connecting' | 'on' (talking both ways) | 'listen' / 'nomic' (your mic is blocked) | 'failed' | 'muted'
const MAX = 6;   // a link per person: keep it small

export function createWorldVoice(o) {
  const links = new Map();   // their id -> { link, voice }
  let muted = false, last = '', on = false;

  function summary() {
    if (muted) return 'muted';
    const v = [...links.values()].map(l => l.voice);
    if (!v.length) return 'off';
    if (v.includes('on')) return 'on';
    if (v.includes('listen') || v.includes('nomic')) return v.includes('listen') ? 'listen' : 'nomic';
    if (v.every(x => x === 'failed')) return 'failed';
    return 'connecting';
  }
  function report() { const s = summary(); if (s !== last) { last = s; o.onState && o.onState(s, links.size); } }
  function closeAll() { links.forEach(l => l.link.leave()); links.clear(); }

  return {
    // call about once a second while you are on the island
    tick(active) {
      on = !!active; const net = o.net && o.net();
      if (!on || !net) { if (links.size) closeAll(); report(); return; }
      const me = o.me(), want = new Set(o.people().slice(0, MAX));
      links.forEach((l, id) => { if (!want.has(id)) { l.link.leave(); links.delete(id); } });
      want.forEach(id => {
        if (links.has(id)) return;
        const rec = { voice: '' };
        // both sides use the same room name; the one with the smaller id makes the offer
        rec.link = net.join('w-' + [me, id].sort().join('-'), me < id, {
          onVoice: v => { rec.voice = v; report(); },
          onLeft: () => { if (links.get(id) === rec) links.delete(id); report(); },   // tried again next tick if they are still here
          onLevel: v => { if (o.onLevel) o.onLevel(id, v); }
        });
        rec.link.setMuted(muted); links.set(id, rec);
      });
      report();
    },
    setMuted(m) { muted = !!m; links.forEach(l => l.link.setMuted(muted)); report(); },
    toggleMuted() { this.setMuted(!muted); return muted; },
    get muted() { return muted; },
    get size() { return links.size; },
    stop() { closeAll(); report(); },
    dispose() { closeAll(); }
  };
}
