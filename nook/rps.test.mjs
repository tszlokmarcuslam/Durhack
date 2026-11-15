// Tests for rps.js: run from the repo root with  npx vitest run nook/rps.test.mjs
// The sample hands are built from a simple hand model (21 MediaPipe points), then turned every which way,
// moved, and given about 2 mm of jitter like the real tracker has. They are not recordings of a real camera.
import { describe, expect, test } from 'vitest';
import { readHand, judge, createMatch, ORDER, TIMES } from './rps.js';

// a small seeded random, so every run tests the same hands
function rng(seed) { return () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// Hand model in metres: wrist at 0, fingers up (+y), palm towards the camera (+z). Curling bends a finger towards +z.
const KNUCKLE = [[-.03, .085, 0], [-.008, .09, 0], [.013, .085, 0], [.032, .075, 0]];
const BONES = [[.04, .025, .02], [.045, .028, .022], [.042, .026, .021], [.032, .02, .018]];
const SPLAY = [-.15, 0, .12, .25];
const OPEN = [.05, .05, .05], LOOSE = [.25, .3, .2], CURLED = [1.4, 1.7, 1.0];
function finger(base, bones, bends, splay) {
  const pts = [base]; let p = base, a = 0;
  bones.forEach((l, i) => {
    a += bends[i]; const d = [splay * (1 - a / 3), Math.cos(a), Math.sin(a)], n = Math.hypot(...d);
    p = [p[0] + d[0] / n * l, p[1] + d[1] / n * l, p[2] + d[2] / n * l]; pts.push(p);
  });
  return pts;
}
// fingers: bends for index, middle, ring, pinky. thumbOut: thumb sticking out (true) or folded over the fingers.
function makeHand(fingers, thumbOut) {
  const thumbDir = thumbOut ? [-.7, .7, .1] : [.55, .55, .6], tn = Math.hypot(...thumbDir);
  let p = [-.02, .02, .01]; const thumb = [p];
  [.035, .03, .025].forEach(l => { p = [p[0] + thumbDir[0] / tn * l, p[1] + thumbDir[1] / tn * l, p[2] + thumbDir[2] / tn * l]; thumb.push(p); });
  const pts = [[0, 0, 0], ...thumb];
  fingers.forEach((b, i) => pts.push(...finger(KNUCKLE[i], BONES[i], b, SPLAY[i])));
  return pts;   // 21 points in MediaPipe order
}
const SHAPES = {
  rock: () => makeHand([CURLED, CURLED, CURLED, CURLED], false),
  paper: () => makeHand([OPEN, OPEN, OPEN, OPEN], true),
  scissors: () => makeHand([OPEN, OPEN, CURLED, CURLED], false)
};
// turn the hand to a random direction, move it, and add jitter
function place(pts, r, jitter = .002) {
  const q = [r() * 2 - 1, r() * 2 - 1, r() * 2 - 1, r() * 2 - 1], qn = Math.hypot(...q), [w, x, y, z] = q.map(v => v / qn);
  const M = [[1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y)], [2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x)], [2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)]];
  const off = [r() * .2 - .1, r() * .2 - .1, r() * .2 - .1], j = () => (r() + r() + r() - 1.5) * jitter * 2;
  return pts.map(p => M.map((row, i) => row[0] * p[0] + row[1] * p[1] + row[2] * p[2] + off[i] + j()));
}
const asWorld = pts => ({ wl: pts.map(([x, y, z]) => ({ x, y, z })) });
// as picture points from a 4:3 camera: x and z are shares of the width, y of the height, y points down
const asPicture = (pts, aspect = 4 / 3, k = 2) => ({ aspect, lm: pts.map(([x, y, z]) => ({ x: .5 + x * k / aspect, y: .5 - y * k, z: z * k / aspect })) });

describe('readHand', () => {
  for (const shape of Object.keys(SHAPES)) {
    test(`reads ${shape} from world points, turned 60 random ways`, () => {
      const r = rng(shape.length * 7919);
      for (let i = 0; i < 60; i++) expect(readHand(asWorld(place(SHAPES[shape](), r))).pick).toBe(shape);
    });
    test(`reads ${shape} from picture points`, () => {
      const r = rng(shape.length * 104729);
      for (let i = 0; i < 30; i++) expect(readHand(asPicture(place(SHAPES[shape](), r))).pick).toBe(shape);
    });
  }
  test('a relaxed open hand is still paper', () => {
    const r = rng(5);
    for (let i = 0; i < 30; i++) expect(readHand(asWorld(place(makeHand([LOOSE, LOOSE, LOOSE, LOOSE], true), r))).pick).toBe('paper');
  });
  test('the thumb does not matter', () => {
    expect(readHand(asWorld(makeHand([CURLED, CURLED, CURLED, CURLED], true))).pick).toBe('rock');      // thumbs up
    expect(readHand(asWorld(makeHand([OPEN, OPEN, CURLED, CURLED], true))).pick).toBe('scissors');     // thumb out
    expect(readHand(asWorld(makeHand([OPEN, OPEN, OPEN, OPEN], false))).pick).toBe('paper');          // thumb folded in
  });
  test('three straight fingers count as paper', () => {
    expect(readHand(asWorld(makeHand([OPEN, OPEN, OPEN, CURLED], false))).pick).toBe('paper');
  });
  test('other shapes are not a hand in the game', () => {
    expect(readHand(asWorld(makeHand([OPEN, CURLED, CURLED, CURLED], false))).pick).toBe(null);   // pointing
    expect(readHand(asWorld(makeHand([OPEN, CURLED, CURLED, OPEN], false))).pick).toBe(null);     // index and pinky
    expect(readHand(asWorld(makeHand([CURLED, OPEN, OPEN, CURLED], false))).pick).toBe(null);     // middle and ring
  });
  test('says which fingers are straight', () => {
    expect(readHand(asWorld(SHAPES.scissors())).open).toEqual([true, true, false, false]);
  });
  test('bad input gives null instead of throwing', () => {
    expect(readHand(null)).toBe(null);
    expect(readHand({})).toBe(null);
    expect(readHand({ wl: [] })).toBe(null);
    expect(readHand({ lm: [{ x: 0, y: 0, z: 0 }] })).toBe(null);
  });
});

describe('judge', () => {
  test('rock beats scissors, scissors beats paper, paper beats rock', () => {
    const want = { rock: { rock: 0, paper: -1, scissors: 1 }, paper: { rock: 1, paper: 0, scissors: -1 }, scissors: { rock: -1, paper: 1, scissors: 0 } };
    ORDER.forEach(a => ORDER.forEach(b => expect(judge(a, b)).toBe(want[a][b])));
  });
  test('no hand means no result', () => {
    expect(judge('rock', null)).toBe(null);
    expect(judge(undefined, 'paper')).toBe(null);
    expect(judge('lizard', 'rock')).toBe(null);
  });
});

// run a match frame by frame. pickFor(view) returns { key } to press a key this frame, or { seen } for what the camera sees.
function run(match, frames, pickFor, dt = 1 / 30) {
  let v = match.view();
  for (let i = 0; i < frames && !v.done; i++) { const p = pickFor(v) || {}; if (p.key) match.key(p.key); v = match.step(dt, p.seen || null); }
  return v;
}
const ROUND_SECS = TIMES.beat * 3 + TIMES.read + TIMES.show;

describe('createMatch', () => {
  test('first to 3 wins: rock every time against a computer that always picks scissors', () => {
    const m = createMatch({ rand: () => .9 }), words = new Set();
    const v = run(m, 30 * ROUND_SECS * 4, v => { words.add(v.word); return { key: 'rock' }; });
    expect(v.done).toBe('win'); expect(v.score).toEqual([3, 0]); expect(v.n).toBe(3);
    expect([...words]).toEqual(expect.arrayContaining(['ROCK…', 'PAPER…', 'SCISSORS…', 'SHOOT!']));
  });
  test('same hands do not count and the throw is played again', () => {
    const m = createMatch({ rand: () => .1 });   // computer: rock
    let v = run(m, 30 * ROUND_SECS, v => ({ key: 'rock' }));
    expect(v.score).toEqual([0, 0]); expect(v.n).toBeGreaterThan(0);
    v = run(m, 30 * ROUND_SECS * 4, () => ({ key: 'paper' }));
    expect(v.done).toBe('win');
  });
  test('the camera reading just after "shoot" is your hand; a fist while pumping does not count', () => {
    const m = createMatch({ rand: () => .5 });   // computer: paper
    // a fist during the countdown, still a fist for the first moment after "shoot", then scissors
    let shot = 0;
    run(m, 30 * 4, v => v.stage === 'count' ? { seen: 'rock' } : v.stage === 'shoot' ? { seen: ++shot <= 5 ? 'rock' : 'scissors' } : {});
    const v = m.view();
    expect(v.last && v.last.mine).toBe('scissors'); expect(v.score).toEqual([1, 0]);
  });
  test('nobody seen at "shoot": the throw is played again', () => {
    const m = createMatch({ rand: () => .5 });
    const v = run(m, Math.ceil(30 * (TIMES.beat * 3 + TIMES.read + .1)), v => v.stage === 'count' ? { seen: 'rock' } : {});
    expect(v.last).toEqual({ mine: null, theirs: 'paper', r: null }); expect(v.score).toEqual([0, 0]);
  });
  test('the other player\'s hand stays hidden until yours is in', () => {
    const m = createMatch({ remote: true, send: () => {} });
    m.theirs(0, 'rock');
    const v = run(m, 30, () => ({ key: 'paper' }));
    expect(v.stage).toBe('count'); expect(v.last).toBe(null);
  });
  test('two windows stay in step and agree on every throw', () => {
    const A = createMatch({ remote: true, send: msg => B.theirs(msg.n, msg.pick) });
    const B = createMatch({ remote: true, send: msg => A.theirs(msg.n, msg.pick) });
    const a = ['rock', 'rock', 'paper', 'scissors', 'rock'], b = ['scissors', 'rock', 'scissors', 'paper', 'paper'];
    let va = A.view(), vb = B.view();
    for (let i = 0; i < 12; i++) vb = B.step(1 / 30, null);   // B's window started a moment earlier
    for (let i = 0; i < 3000 && !(va.done && vb.done); i++) {
      A.key(a[va.n % a.length]); B.key(b[vb.n % b.length]);
      va = A.step(1 / 30, null); vb = B.step(1 / 24, null);   // and runs at a different frame rate
    }
    // throws: rock>scissors, tie, paper<scissors, scissors>paper, rock<paper, rock>scissors... A wins 3 to 2
    expect(va.done).toBe('win'); expect(vb.done).toBe('lose');
    expect(va.score).toEqual([3, 2]); expect(vb.score).toEqual([2, 3]); expect(va.n).toBe(vb.n);
  });
  test('a bad message from the other window counts as no hand', () => {
    const m = createMatch({ remote: true, send: () => {} });
    m.theirs(0, 'lizard'); m.theirs(50, 'rock');   // not a hand; too far ahead
    const v = run(m, Math.ceil(30 * (TIMES.beat * 3 + TIMES.read + .1)), () => ({ key: 'rock' }));
    expect(v.last).toEqual({ mine: 'rock', theirs: null, r: null });
  });
  test('keys after your hand is read change nothing', () => {
    const m = createMatch({ remote: true, send: () => {} });
    let v = run(m, Math.ceil(30 * (TIMES.beat * 3 + TIMES.read + .1)), () => ({ key: 'rock' }));
    expect(v.stage).toBe('wait'); m.key('paper'); m.theirs(0, 'scissors'); v = m.step(1 / 30, null);
    expect(v.last.mine).toBe('rock'); expect(v.score).toEqual([1, 0]);
  });
});
