// Rock paper scissors for Nook World, played with your real hand.
//  - readHand(): reads rock, paper or scissors from MediaPipe's 21 hand points (tracking.js, while wantHands is on)
//  - createMatch(): the rounds. "Rock… paper… scissors… shoot!", your hand is read just after "shoot",
//    first to 3 round wins takes the match. Same hands, or a hand nobody saw: that round is played again.
// No camera: keys 1 / 2 / 3 (or the buttons on screen) pick your hand.
// Nothing here touches the page when it loads, so tests can import it in Node (rps.test.mjs).

export const HANDS = {
  rock: { emoji: '✊', name: 'Rock' },
  paper: { emoji: '✋', name: 'Paper' },
  scissors: { emoji: '✌️', name: 'Scissors' }
};
export const ORDER = ['rock', 'paper', 'scissors'];   // keys 1, 2, 3
const BEATS = { rock: 'scissors', paper: 'rock', scissors: 'paper' };
export const isHand = p => Object.prototype.hasOwnProperty.call(BEATS, p);

// 1 = a wins, -1 = b wins, 0 = same hand, null = someone showed no hand
export function judge(a, b) {
  if (!isHand(a) || !isHand(b)) return null;
  return a === b ? 0 : BEATS[a] === b ? 1 : -1;
}

// The hand tracker in tracking.js only runs (and only downloads its model, about 8 MB) while a game asks for it.
export function wantHands(on) { globalThis.nookWantHands = !!on; }

/* ---------- reading a hand ----------
   MediaPipe hand points: 0 wrist, 1-4 thumb, 5-8 index (knuckle, middle joint, top joint, tip), 9-12 middle,
   13-16 ring, 17-20 pinky. The thumb is ignored: people hold it every which way in all three hands.
   A finger counts as straight when its tip reaches well past its middle joint, seen from the wrist, and its last
   bone points the same way as its first. Both are distances and angles, so how the hand is turned does not matter. */
const FINGERS = [[5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16], [17, 18, 19, 20]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = v => Math.hypot(v[0], v[1], v[2]);
const cosOf = (u, v) => (u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) / ((len(u) * len(v)) || 1);

// hand: { wl } MediaPipe world points (metres, best), or { lm, aspect } picture points (x and y from 0 to 1).
// Returns { pick: 'rock' | 'paper' | 'scissors' | null, open: [index, middle, ring, pinky] }, or null for no usable hand.
export function readHand(hand) {
  if (!hand) return null;
  const world = Array.isArray(hand.wl) && hand.wl.length >= 21, pts = world ? hand.wl : hand.lm;
  if (!Array.isArray(pts) || pts.length < 21) return null;
  const ax = world ? 1 : +hand.aspect || 1.33;   // picture points: x (and MediaPipe's z) are shares of the width, y of the height
  const P = pts.map(p => [(+p.x || 0) * ax, +p.y || 0, (+p.z || 0) * ax]);
  const W = P[0];
  const open = FINGERS.map(([k, j, , tip]) => {
    const reach = len(sub(P[tip], W)) / (len(sub(P[j], W)) || 1);   // straight about 1.5, curled into the palm under 1.1
    const bend = cosOf(sub(P[j], P[k]), sub(P[tip], P[tip - 1]));    // straight about 1, curled 0 or less
    return reach > 1.2 && bend > .35;
  });
  const n = open.filter(Boolean).length;
  const pick = n === 0 ? 'rock' : n === 2 && open[0] && open[1] ? 'scissors' : n >= 3 ? 'paper' : null;
  return { pick, open };
}

/* ---------- a match ----------
   step(dt, seen) runs every frame; seen is what the camera reads right now (a hand name or null).
   Against the computer it picks at random. Against a person in another window each side sends its own pick for
   throw n (send({ n, pick })) and the throw is settled once both picks are in, so the two windows stay in step. */
export const TIMES = { beat: .6, read: .6, grace: .15, show: 2.2, again: 1.4 };   // seconds
export const WORDS = ['ROCK…', 'PAPER…', 'SCISSORS…'];

export function createMatch({ need = 3, remote = false, send = () => {}, rand = Math.random } = {}) {
  let stage = 'count', t = 0, n = 0, mine = null, theirs, key = null, votes = {}, live = null, last = null, done = null;
  const score = [0, 0], got = new Map();
  const word = () => stage === 'count' ? WORDS[Math.min(2, Math.floor(t / TIMES.beat))] : stage === 'shoot' ? 'SHOOT!' : '';
  const best = () => { let b = null; Object.keys(votes).forEach(k => { if (!b || votes[k] > votes[b]) b = k; }); return b; };
  function settle() {
    const r = judge(mine, theirs);
    last = { mine, theirs, r };
    if (r === 1) score[0]++; else if (r === -1) score[1]++;
    got.delete(n); n++; stage = 'show'; t = 0;
  }
  function next() {
    if (score[0] >= need) done = 'win'; else if (score[1] >= need) done = 'lose';
    else { stage = 'count'; t = 0; mine = null; theirs = undefined; key = null; votes = {}; }
  }
  const view = () => ({
    stage, word: word(), n, need, score: score.slice(), live, done,
    beat: stage === 'count' ? (t % TIMES.beat) / TIMES.beat : 0,   // 0..1 through the current word, for the fist pump
    last: stage === 'show' || done ? last : null                   // the other player's hand stays hidden until both are in
  });
  return {
    view,
    step(dt, seen) {
      live = isHand(seen) ? seen : null;
      if (done) return view();
      t += Math.max(0, +dt || 0);
      if (stage === 'count' && t >= TIMES.beat * 3) { stage = 'shoot'; t -= TIMES.beat * 3; votes = {}; }
      if (stage === 'shoot') {
        // just after "shoot" the hand is still a fist from pumping: skip the first moment, and later looks count more
        if (live && t > TIMES.grace) votes[live] = (votes[live] || 0) + t;
        if (t >= TIMES.read) {
          mine = key || best(); stage = 'wait'; t = 0;
          if (remote) send({ n, pick: mine }); else theirs = ORDER[Math.min(2, Math.floor(rand() * 3))];
        }
      }
      if (stage === 'wait') {
        if (remote && got.has(n)) theirs = got.get(n);
        if (theirs !== undefined) settle();
      }
      if (stage === 'show' && t >= (last && last.r ? TIMES.show : TIMES.again)) next();
      return view();
    },
    // a key or button: your pick for this throw (changing your mind is fine until the hand is read)
    key(pick) { if (!done && isHand(pick) && (stage === 'count' || stage === 'shoot')) key = pick; },
    // the other window's pick for throw n
    theirs(tn, pick) { if (Number.isInteger(tn) && tn >= n && tn < n + 3) got.set(tn, isHand(pick) ? pick : null); }
  };
}
