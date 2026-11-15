// Tests for moves.js: run from the repo root with  npx vitest run nook/moves.test.mjs
// The body points are made up to match MediaPipe's layout; they are not recordings of a real camera.
import { describe, expect, test } from 'vitest';
import { resolve, PUNCH, createDodgeReader, createPunchReader, wholeBody, missingText } from './moves.js';

describe('boxing rules', () => {
  test('a jab lands on someone standing still and misses a dodge', () => {
    expect(resolve('jab', 0, 0)).toBe('hit');
    expect(resolve('jab', 0, -1)).toBe('miss');
    expect(resolve('jab', 0, 1)).toBe('miss');
  });
  test('a hook catches a dodge to its side only', () => {
    // they dodge to their right (d = 1), which is the puncher's left (-1): the left hook lands
    expect(resolve('hook', -1, 1)).toBe('hit');
    expect(resolve('hook', 1, -1)).toBe('hit');
    expect(resolve('hook', 1, 1)).toBe('miss');    // wrong side
    expect(resolve('hook', -1, 0)).toBe('miss');   // they did not dodge
  });
  test('a hook hits harder but takes longer to land', () => {
    expect(PUNCH.hook.dmg).toBeGreaterThan(PUNCH.jab.dmg);
    expect(PUNCH.hook.windup).toBeGreaterThan(PUNCH.jab.windup);
  });
});

// 33 pose points, all visible, standing in the middle of the picture
function body(noseX = .5) {
  const p = Array.from({ length: 33 }, (_, i) => ({ x: .5, y: .2 + i * .02, z: 0, visibility: .95 }));
  p[0].x = noseX; p[11].x = .6; p[12].x = .4;   // your left shoulder shows on the picture's right
  return p;
}
const run = (r, frames, lm) => { let out; for (let i = 0; i < frames; i++) out = r.update(lm, 1 / 30); return out; };

describe('dodging from the camera', () => {
  test('standing still is not a dodge', () => {
    expect(run(createDodgeReader(), 30, body(.5)).d).toBe(0);
  });
  test('leaning left and right', () => {
    const r = createDodgeReader(); run(r, 30, body(.5));
    expect(run(r, 3, body(.6)).d).toBe(-1);     // nose to the picture's right = your left
    expect(run(r, 30, body(.6)).d).toBe(-1);    // still dodging after holding it for a second
    expect(run(r, 3, body(.5)).d).toBe(0);
    expect(run(r, 3, body(.4)).d).toBe(1);
  });
  test('a small sway is not a dodge', () => {
    const r = createDodgeReader(); run(r, 30, body(.5));
    expect(run(r, 5, body(.53)).d).toBe(0);
  });
  test('no shoulders in view: no dodge', () => {
    const r = createDodgeReader(); run(r, 30, body(.5)); run(r, 3, body(.6));
    const lm = body(.6); lm[11].visibility = .1;
    expect(r.update(lm, 1 / 30)).toEqual({ d: 0, amount: 0, seen: false });
  });
});

// World points for both arms. arm(side, elbow, wrist): offsets from that shoulder, given for the left arm and mirrored for the right.
const SH = { [-1]: { x: .18, y: -.45, z: 0 }, 1: { x: -.18, y: -.45, z: 0 } };
function pose(arms) {
  const wl = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0 }));
  [[-1, 11, 13, 15], [1, 12, 14, 16]].forEach(([side, s, e, w]) => {
    const S = SH[side], a = arms[side] || GUARD, m = side < 0 ? 1 : -1;
    wl[s] = { ...S }; wl[e] = { x: S.x + a[0][0] * m, y: S.y + a[0][1], z: S.z + a[0][2] }; wl[w] = { x: S.x + a[1][0] * m, y: S.y + a[1][1], z: S.z + a[1][2] };
  });
  return wl;
}
const GUARD = [[0, .2, -.15], [-.05, -.02, -.23]];
const lerp = (a, b, k) => a.map((p, i) => p.map((v, j) => v + (b[i][j] - v) * k));
// move one arm from a to b over `frames` frames, returning every punch read
function move(side, a, b, frames, r = createPunchReader()) {
  const got = []; r.update(pose({ [side]: a }), 1 / 30);
  for (let i = 0; i <= frames; i++) got.push(...r.update(pose({ [side]: lerp(a, b, i / frames) }), 1 / 30));
  return got;
}
const JAB_END = [[0, 0, -.27], [-.02, 0, -.53]];
const HOOK_START = [[.2, 0, -.1], [.25, 0, -.3]], HOOK_END = [[.2, 0, -.1], [-.05, 0, -.22]];

describe('punches from the camera', () => {
  test('a fast straight punch is a jab, with the right arm', () => {
    expect(move(-1, GUARD, JAB_END, 4)).toEqual([{ type: 'jab', side: -1 }]);
    expect(move(1, GUARD, JAB_END, 4)).toEqual([{ type: 'jab', side: 1 }]);
  });
  test('a fast sideways swing with the elbow up is a hook', () => {
    expect(move(-1, HOOK_START, HOOK_END, 4)).toEqual([{ type: 'hook', side: -1 }]);
    expect(move(1, HOOK_START, HOOK_END, 4)).toEqual([{ type: 'hook', side: 1 }]);
  });
  test('holding a guard or reaching out slowly is not a punch', () => {
    expect(move(-1, GUARD, GUARD, 30)).toEqual([]);
    expect(move(-1, GUARD, JAB_END, 40)).toEqual([]);
  });
  test('one punch is read once', () => {
    const r = createPunchReader();
    const first = move(-1, GUARD, JAB_END, 4, r), again = move(-1, JAB_END, JAB_END, 10, r);
    expect(first.length).toBe(1); expect(again).toEqual([]);
  });
});

describe('whole body in the picture', () => {
  test('everything seen', () => {
    expect(wholeBody(body())).toEqual({ ok: true, missing: [] });
  });
  test('says what is missing', () => {
    const lm = body(); lm[27].visibility = lm[28].visibility = .1; lm[25].y = 1.2; lm[26].y = 1.3;   // feet hidden, knees below the picture
    expect(wholeBody(lm)).toEqual({ ok: false, missing: ['knees', 'feet'] });
    expect(missingText(['knees', 'feet'])).toBe('Step back: the camera can’t see your knees and feet');
  });
  test('no body at all', () => {
    expect(wholeBody(null)).toEqual({ ok: false, missing: ['body'] });
    expect(missingText(['body'])).toMatch(/whole body/);
  });
});
