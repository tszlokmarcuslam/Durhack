// Reading your body for the World games, and the boxing rules (worldgame.js uses these).
// Nothing here touches the page, so tests can import it in Node (moves.test.mjs).

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const seen = (p, conf = .5) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y) && (p.visibility ?? 1) >= conf;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0));

/* ---------- boxing rules ----------
   Three moves: the jab (straight at the face), the hook (a side punch from the left or the right), and the dodge
   (lean left or right). A jab beats standing still, a dodge beats a jab, and a hook catches a dodge to its side.
   Sides: a hook's side h is seen from the puncher (-1 their left, 1 their right). A dodge d is the dodger's own
   (-1 their left, 1 their right). Face to face your left is their right, so the puncher sees the head on side -d. */
// windup: seconds from starting a punch to it landing. Slow enough to see it coming and lean away (a camera dodge
// takes about a third of a second), and the hook, which hits harder, is easier to see.
export const PUNCH = {
  jab: { windup: .32, dmg: 7, rest: .5 },
  hook: { windup: .45, dmg: 12, rest: .8 }
};
// 'hit' or 'miss'
export function resolve(type, h, d) {
  if (type === 'jab') return d ? 'miss' : 'hit';
  if (type === 'hook') return d && h === -d ? 'hit' : 'miss';
  return 'miss';
}

/* ---------- dodging from the camera ----------
   Your nose against where it normally is (a slow average), in shoulder widths. The camera picture is not mirrored,
   so leaning to your left moves your nose to the picture's right. Returns d (-1 your left, 0, 1 your right) and
   amount (-1..1, for leaning the avatar smoothly). */
export function createDodgeReader({ at = .4, back = .22, settle = 2.5 } = {}) {
  let base = null, d = 0;
  return {
    update(lm, dt) {
      const n = lm && lm[0], l = lm && lm[11], r = lm && lm[12];
      if (!seen(n) || !seen(l) || !seen(r)) { d = 0; return { d, amount: 0, seen: false }; }
      const w = Math.max(.05, Math.abs(l.x - r.x));
      if (base == null) base = n.x;
      const lean = -(n.x - base) / w;   // + = your right
      // the middle follows you slowly, and much more slowly while you lean, so holding a dodge does not become the new middle
      base += (n.x - base) * Math.min(1, (dt || 0) / (Math.abs(lean) < back ? settle : settle * 4));
      if (Math.abs(lean) >= at) d = Math.sign(lean); else if (Math.abs(lean) < back) d = 0;
      return { d, amount: clamp(lean / (at * 1.5), -1, 1), seen: true };
    },
    reset() { base = null; d = 0; }
  };
}

/* ---------- punches from the camera ----------
   MediaPipe world points (metres, from the middle of your hips, x to the picture's right, y down, z away from the
   camera). Per arm, the wrist is followed relative to its shoulder:
   - jab: the fist shoots at the camera fast and the arm ends nearly straight
   - hook: the elbow is out to the side at about shoulder height and the fist swings fast towards your middle
   Returns the punches thrown this frame: [{ type: 'jab' | 'hook', side }], side -1 your left arm, 1 your right. */
const ARMS = [[-1, 11, 13, 15], [1, 12, 14, 16]];   // your left arm is MediaPipe's 11 13 15
export function createPunchReader({ speed = 1.3, cool = .35 } = {}) {
  const st = { [-1]: { prev: null, rest: 0 }, 1: { prev: null, rest: 0 } };
  return {
    update(wl, dt) {
      const out = [];
      if (!Array.isArray(wl) || wl.length < 17 || !(dt > 0)) return out;
      ARMS.forEach(([side, s, e, w]) => {
        const A = st[side], S = wl[s], E = wl[e], W = wl[w]; A.rest -= dt;
        if (!S || !E || !W) { A.prev = null; return; }
        const rel = { x: W.x - S.x, y: W.y - S.y, z: W.z - S.z }, prev = A.prev; A.prev = rel;
        if (!prev || A.rest > 0) return;
        const vx = (rel.x - prev.x) / dt, vz = (rel.z - prev.z) / dt;
        const outward = Math.sign(S.x) || -side;                     // which way is away from your middle, in picture x
        const toCam = -vz, inward = -outward * vx;
        const reach = Math.hypot(rel.x, rel.y, rel.z) / ((dist(S, E) + dist(E, W)) || 1);
        const elbowOut = Math.abs(E.y - S.y) < .1 && (E.x - S.x) * outward > .1;
        let type = null;
        if (elbowOut && inward > speed && inward > toCam) type = 'hook';
        else if (toCam > speed && reach > .78) type = 'jab';
        if (type) { out.push({ type, side }); A.rest = cool; }
      });
      return out;
    }
  };
}

/* ---------- is your whole body in the picture? (the plank waits for this) ---------- */
const PARTS = [['head', [0, 7, 8]], ['shoulders', [11, 12]], ['arms', [13, 14, 15, 16]], ['hips', [23, 24]], ['knees', [25, 26]], ['feet', [27, 28]]];
export function wholeBody(lm, conf = .5) {
  if (!Array.isArray(lm) || lm.length < 29) return { ok: false, missing: ['body'] };
  const inPic = i => seen(lm[i], conf) && lm[i].x >= 0 && lm[i].x <= 1 && lm[i].y >= 0 && lm[i].y <= 1;
  const missing = PARTS.filter(([, ids]) => !ids.some(inPic)).map(([name]) => name);
  return { ok: !missing.length, missing };
}
// "Step back: the camera can't see your knees and feet"
export function missingText(missing) {
  if (!missing || !missing.length) return '';
  if (missing.includes('body')) return 'Step into the picture so the camera sees your whole body';
  const list = missing.length === 1 ? missing[0] : missing.slice(0, -1).join(', ') + ' and ' + missing[missing.length - 1];
  return 'Step back: the camera can’t see your ' + list;
}
