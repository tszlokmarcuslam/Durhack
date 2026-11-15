import { describe, it, expect } from 'vitest';
import { POSES, SONGS, TOL, armAngle, fits, schedule, poseOf, stepOf, pickSong, KEY_ANGLES } from './notewall.js';

const v = (x, y, z = 0) => ({ x, y, z });

describe('music walls', () => {
  it('reads an arm angle: down 0, out 90, up 180, for both arms', () => {
    expect(armAngle(v(0, -1), v(0, -1), 1)).toBeCloseTo(0);
    expect(armAngle(v(1, 0), v(1, 0), 1)).toBeCloseTo(90);      // the left arm (+x) straight out
    expect(armAngle(v(-1, 0), v(-1, 0), -1)).toBeCloseTo(90);   // the right arm (-x) straight out
    expect(armAngle(v(0, 1), v(0, 1), 1)).toBeCloseTo(180);
    expect(armAngle(v(.707, .707), v(.707, .707), 1)).toBeCloseTo(135);
  });
  it('an arm across the body does not count as out to the side', () => {
    expect(armAngle(v(-1, 0), v(-1, 0), 1)).toBeCloseTo(-90);
  });
  it('fits only when both arms are close enough', () => {
    expect(fits([90, 90], [90, 90])).toBe(true);
    expect(fits([90 + TOL - 1, 90], [90, 90])).toBe(true);
    expect(fits([90 + TOL + 1, 90], [90, 90])).toBe(false);
    expect(fits(null, [90, 90])).toBe(false);
  });
  it('every pose can be told apart from every other', () => {
    for (let a = 0; a < POSES.length; a++) for (let b = a + 1; b < POSES.length; b++) {
      expect(Math.max(Math.abs(POSES[a][0] - POSES[b][0]), Math.abs(POSES[a][1] - POSES[b][1]))).toBeGreaterThan(TOL);
    }
  });
  it('every note of every song has its own pose, and higher notes lift the arms', () => {
    SONGS.forEach(s => s.notes.forEach(n => expect([60, 62, 64, 65, 67, 69, 71, 72]).toContain(n)));
    expect(poseOf(60)).toEqual([40, 40]); expect(poseOf(72)).toEqual([175, 175]); expect(stepOf(67)).toBe(4);
  });
  it('every pose can be made with the keys', () => {
    POSES.forEach(p => p.forEach(a => expect(KEY_ANGLES.some(k => Math.abs(k - a) <= TOL)).toBe(true)));
  });
  it('walls come in order, inside the game, quicker towards the end', () => {
    [30, 60, 90].forEach(secs => {
      const plan = schedule(SONGS[1], secs);
      expect(plan.length).toBeGreaterThan(secs / 3);
      plan.forEach((w, i) => { expect(w.at).toBeLessThan(secs); if (i) expect(w.at).toBeGreaterThan(plan[i - 1].at); });
      const gaps = plan.slice(1).map((w, i) => w.at - plan[i].at);
      expect(gaps[0]).toBeGreaterThan(gaps[gaps.length - 1]);
      expect(Math.min(...gaps)).toBeGreaterThan(1.25);
    });
  });
  it('both players get the same song from the same seed', () => {
    expect(pickSong(12345)).toBe(pickSong(12345));
    expect(new Set(Array.from({ length: 20 }, (_, i) => pickSong(i).name)).size).toBe(SONGS.length);
  });
});
