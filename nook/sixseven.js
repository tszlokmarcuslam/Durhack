// 6-7 (World game): count every time a hand goes up.
// Works on the webcam's body points (MediaPipe pose landmarks, picture coordinates: y grows downwards).
// Each wrist is followed on its own. Once it has risen far enough above the lowest point it reached since its last
// "up", that is one up; it then has to drop back down far enough before it can count again. So the classic 6-7
// (one hand up while the other goes down) counts both hands, and both hands together count two.
// Distances are in shoulder widths, so it works whether you stand close to the camera or far from it.

export const UP = {
  RISE: 0.22,     // how far a hand must rise (and fall again), in shoulder widths
  MIN_GAP: 0.11,  // seconds: one hand can't count twice faster than this (camera jitter)
  VIS: 0.5        // ignore a wrist the camera isn't sure about
};
const WRIST = { L: 15, R: 16 }, SHOULDER_L = 11, SHOULDER_R = 12;

export function createUpCounter(o = {}) {
  const rise = o.rise ?? UP.RISE, gap = o.minGap ?? UP.MIN_GAP;
  const fresh = () => ({ st: 'down', lo: null, hi: null, y: null, last: -1e9 });
  let hands = { L: fresh(), R: fresh() }, count = 0;
  return {
    get count() { return count; },
    // lm: the 33 pose landmarks, t: seconds, aspect: picture width / height. Returns how many ups this frame (0, 1 or 2).
    update(lm, t, aspect = 4 / 3) {
      const a = lm && lm[SHOULDER_L], b = lm && lm[SHOULDER_R];
      if (!a || !b) return 0;
      const sw = Math.hypot((a.x - b.x) * aspect, a.y - b.y);   // shoulder width, in picture heights
      if (!(sw > 0.03)) return 0;
      let ups = 0;
      for (const k of ['L', 'R']) {
        const w = lm[WRIST[k]], H = hands[k];
        if (!w || !Number.isFinite(w.y) || (w.visibility != null && w.visibility < UP.VIS)) { hands[k] = Object.assign(fresh(), { last: H.last }); continue; }   // lost: start this hand again
        const h = -w.y / sw;                                   // the hand's height, in shoulder widths (bigger is higher)
        H.y = H.y == null ? h : H.y + (h - H.y) * 0.6;         // a little smoothing against jitter
        if (H.st === 'down') {
          H.lo = H.lo == null ? H.y : Math.min(H.lo, H.y);
          if (H.y - H.lo >= rise && t - H.last >= gap) { H.st = 'up'; H.hi = H.y; H.last = t; count++; ups++; }
        } else {
          H.hi = Math.max(H.hi, H.y);
          if (H.hi - H.y >= rise) { H.st = 'down'; H.lo = H.y; }
        }
      }
      return ups;
    },
    reset() { count = 0; hands = { L: fresh(), R: fresh() }; }
  };
}
