import { describe, it, expect } from 'vitest';
import { createUpCounter } from './sixseven.js';

// a body facing the camera: shoulders 0.2 of the picture apart, wrists at the given heights (picture y, down is bigger)
function body(leftY, rightY, o = {}) {
  const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.99 }));
  const s = o.scale || 1, cx = 0.5, cy = 0.4;
  lm[11] = { x: cx - 0.1 * s, y: cy, visibility: 0.99 }; lm[12] = { x: cx + 0.1 * s, y: cy, visibility: 0.99 };
  lm[15] = { x: cx - 0.12 * s, y: leftY, visibility: o.vis ?? 0.99 }; lm[16] = { x: cx + 0.12 * s, y: rightY, visibility: o.vis ?? 0.99 };
  return lm;
}
// play a movement: f(t) -> [leftY, rightY], sampled 30 times a second
function run(f, seconds, o = {}) {
  const c = createUpCounter();
  for (let i = 0; i <= seconds * 30; i++) { const t = i / 30, [l, r] = f(t); c.update(body(l, r, o), t); }
  return c.count;
}
const wave = (t, hz, amp, phase = 0) => 0.6 + amp * Math.sin(2 * Math.PI * hz * t + phase);

describe('6-7 hand counter', () => {
  it('counts both hands in the classic alternating 6-7', () => {
    // 2 up-and-downs a second for 5 seconds, hands opposite: 10 ups each
    const n = run(t => [wave(t, 2, 0.08), wave(t, 2, 0.08, Math.PI)], 5);
    expect(n).toBeGreaterThanOrEqual(19);
    expect(n).toBeLessThanOrEqual(21);
  });

  it('counts two when both hands go up together', () => {
    const n = run(t => [wave(t, 1.5, 0.08), wave(t, 1.5, 0.08)], 4);
    expect(n).toBeGreaterThanOrEqual(11);
    expect(n).toBeLessThanOrEqual(13);
  });

  it('ignores small shaking', () => {
    expect(run(t => [wave(t, 6, 0.012), wave(t, 7, 0.012, 1)], 4)).toBe(0);
  });

  it('ignores hands that do not move', () => {
    expect(run(() => [0.6, 0.6], 3)).toBe(0);
  });

  it('works close to the camera and far from it', () => {
    const far = run(t => [wave(t, 2, 0.04), wave(t, 2, 0.04, Math.PI)], 3, { scale: 0.5 });
    expect(far).toBeGreaterThanOrEqual(11);
    const near = run(t => [wave(t, 2, 0.16), wave(t, 2, 0.16, Math.PI)], 3, { scale: 2 });
    expect(near).toBeGreaterThanOrEqual(11);
  });

  it('does not count wrists the camera cannot see', () => {
    expect(run(t => [wave(t, 2, 0.08), wave(t, 2, 0.08, Math.PI)], 3, { vis: 0.1 })).toBe(0);
  });

  it('one hand going up counts once, not on the way down', () => {
    const c = createUpCounter();
    const ys = [0.7, 0.68, 0.6, 0.55, 0.52, 0.52, 0.55, 0.62, 0.7, 0.72];   // up, then back down
    ys.forEach((y, i) => c.update(body(y, 0.7), i / 30));
    expect(c.count).toBe(1);
  });

  it('copes with missing landmarks', () => {
    const c = createUpCounter();
    expect(c.update(null, 0)).toBe(0);
    expect(c.update([], 0)).toBe(0);
    expect(c.count).toBe(0);
  });
});
