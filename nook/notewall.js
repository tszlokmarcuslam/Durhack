// Music walls: walls fly at you, each with a hole in the shape of a pose. Strike that pose with your arms to pass
// through, and the wall plays its note. One wall after another, you play a whole song.
//  - Each wall's pose comes from its note: the higher the note, the higher your arms
//    (low C: both arms low, E: arms out in a T, G: arms up in a V, high C: both arms straight up).
//  - The songs are old public-domain tunes in C major, so every note has a pose.
//  - Both players get the same walls (the same seed), each in their own lane. Most walls passed wins.
// The pure parts (songs, poses, judging, timing) need no 3D and are tested in notewall.test.mjs.
// createNoteWalls() builds the walls, the lanes and your see-through outline; worldgame.js runs it.

const PI = Math.PI;

// [left arm, right arm] in degrees: 0 hanging down, 90 straight out to the side, 180 straight up.
// "left" is the player's own left arm. Index = the note's step in C major (C D E F G A B C).
export const POSES = [[40, 40], [90, 40], [90, 90], [135, 90], [135, 135], [175, 135], [90, 175], [175, 175]];
export const NAMES = ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C'];
const STEP = { 60: 0, 62: 1, 64: 2, 65: 3, 67: 4, 69: 5, 71: 6, 72: 7 };
export const stepOf = midi => STEP[midi] != null ? STEP[midi] : 0;
export const poseOf = midi => POSES[stepOf(midi)];
// the arm positions you can reach with the keys (no camera): W / S move your left arm, up / down your right
export const KEY_ANGLES = [40, 90, 135, 175];
export const TOL = 32;   // how close (degrees) each arm must be to fit through

// Public-domain melodies (MIDI notes, C4 = 60), all inside one octave of C major.
export const SONGS = [
  { name: 'Twinkle Twinkle', notes: [60, 60, 67, 67, 69, 69, 67, 65, 65, 64, 64, 62, 62, 60, 67, 67, 65, 65, 64, 64, 62, 67, 67, 65, 65, 64, 64, 62, 60, 60, 67, 67, 69, 69, 67, 65, 65, 64, 64, 62, 62, 60] },
  { name: 'Ode to Joy', notes: [64, 64, 65, 67, 67, 65, 64, 62, 60, 60, 62, 64, 64, 62, 62, 64, 64, 65, 67, 67, 65, 64, 62, 60, 60, 62, 64, 62, 60, 60] },
  { name: 'Jingle Bells', notes: [64, 64, 64, 64, 64, 64, 64, 67, 60, 62, 64, 65, 65, 65, 65, 65, 64, 64, 64, 64, 62, 62, 64, 62, 67] },
  { name: 'Mary Had a Little Lamb', notes: [64, 62, 60, 62, 64, 64, 64, 62, 62, 62, 64, 67, 67, 64, 62, 60, 62, 64, 64, 64, 64, 62, 62, 64, 62, 60] },
  { name: 'Row Row Row Your Boat', notes: [60, 60, 60, 62, 64, 64, 62, 64, 65, 67, 72, 72, 72, 67, 67, 67, 64, 64, 64, 60, 60, 60, 67, 65, 64, 62, 60] }
];
export const pickSong = seed => SONGS[(seed >>> 0) % SONGS.length];

// The angle of one arm (0 down .. 180 up) from its two directions in avatar space (shoulder to elbow, elbow to
// wrist). s: 1 for the avatar's +x arm (its left), -1 for the other. Whole arm = shoulder to wrist.
export function armAngle(up, fore, s) {
  const x = (up.x + fore.x) * s, y = up.y + fore.y;
  return Math.atan2(x, -y) * 180 / PI;
}
export const fits = (ang, pose, tol = TOL) => !!ang && Math.abs(ang[0] - pose[0]) <= tol && Math.abs(ang[1] - pose[1]) <= tol;

// When each wall reaches you, for a game of `secs` seconds: slow at first, quicker towards the end. The song
// starts again if the game outlasts it.
export function schedule(song, secs) {
  const out = []; let t = 3.2, i = 0;
  while (t < secs - .4) { out.push({ at: t, midi: song.notes[i % song.notes.length] }); i++; t += 2.3 - 1.0 * Math.min(1, t / secs); }
  return out;
}

/* ---------- the 3D part ---------- */
// o: { seed, secs, me: x of your lane, them: x of theirs, s: avatar size } (x across the arena, you face +z)
export function createNoteWalls(T, o) {
  const s = o.s || 1, song = pickSong(o.seed), plan = schedule(song, o.secs);
  const W = 2.3 * s, H = 2.7 * s, SPAWN = 21, JUDGE = 3.2 * s, LEAD = 3.8, SPEED = (SPAWN - JUDGE) / LEAD;
  const COLORS = ['#C27352', '#C08A3A', '#C9A33A', '#7E9A62', '#4E8DAE', '#5C5E78', '#8E6CD8', '#C2452D'];
  const group = new T.Group();

  // one texture per note: the wall's colour, a little stone grain, the note's name, and the hole cut out
  const shoulder = 1.42, armLen = .66;
  function figure(g, P, w, h, pose, e) {   // the pose, in metres from the floor, as the player sees it (their left on the left)
    const X = x => w / 2 + x * P, Y = y => h - y * P;
    g.beginPath(); g.arc(X(0), Y(1.63), (.16 + e) * P, 0, PI * 2); g.fill();                                           // head
    const r = (.08 + e) * P; g.beginPath(); g.roundRect(X(-.25 - e), Y(1.52 + e), (.5 + 2 * e) * P, (.7 + 2 * e) * P, r); g.fill();   // body
    g.lineCap = 'round'; g.lineWidth = (.2 + 2 * e) * P;
    [-1, 1].forEach(sx => { g.beginPath(); g.moveTo(X(.1 * sx), Y(.9)); g.lineTo(X(.16 * sx), Y(-.2)); g.stroke(); });   // legs, through the bottom
    [1, -1].forEach((side, k) => {   // side 1 = their left arm, drawn on the left
      const a = pose[k] * PI / 180, sx = -side, x0 = sx * .2, y0 = shoulder;
      g.beginPath(); g.moveTo(X(x0), Y(y0)); g.lineTo(X(x0 + sx * Math.sin(a) * armLen), Y(y0 - Math.cos(a) * armLen)); g.stroke();
    });
  }
  const texs = POSES.map((pose, k) => {
    const c = document.createElement('canvas'); c.width = 512; c.height = Math.round(512 * H / W);
    const g = c.getContext('2d'), w = c.width, h = c.height, P = w / (W / s);
    g.fillStyle = COLORS[k]; g.fillRect(0, 0, w, h);
    let sd = 7 + k * 131; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 1400; i++) { g.fillStyle = rnd() < .5 ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.08)'; const z = 2 + rnd() * 5; g.fillRect(rnd() * w, rnd() * h, z, z); }
    g.strokeStyle = 'rgba(0,0,0,.2)'; g.lineWidth = 16; g.strokeRect(8, 8, w - 16, h - 16);
    g.fillStyle = 'rgba(255,255,255,.9)'; g.font = '800 64px Figtree, system-ui, sans-serif'; g.textAlign = 'right'; g.fillText('♪ ' + NAMES[k], w - 34, 86);
    g.fillStyle = 'rgba(255,255,255,.5)'; figure(g, P, w, h, pose, .045);                                       // a light rim round the hole
    g.globalCompositeOperation = 'destination-out'; g.fillStyle = g.strokeStyle = '#000'; figure(g, P, w, h, pose, 0);   // the hole
    g.globalCompositeOperation = 'source-over';
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return t;
  });
  const mats = texs.map(t => new T.MeshStandardMaterial({ map: t, roughness: .95, alphaTest: .5, side: T.DoubleSide }));
  const geo = new T.PlaneGeometry(W, H);

  // the two lanes: a soft glowing strip each, and a few walls that get reused
  const laneMat = new T.MeshBasicMaterial({ color: '#8FD1C8', transparent: true, opacity: .16, depthWrite: false });
  const lanes = [o.me, o.them].map(x => {
    const strip = new T.Mesh(new T.PlaneGeometry(1.3 * s, SPAWN + 4).rotateX(-PI / 2), laneMat); strip.position.set(x, .015, SPAWN / 2 - 1); group.add(strip);
    const pool = Array.from({ length: 6 }, () => { const w = new T.Mesh(geo, mats[0]); w.rotation.y = PI; w.visible = false; group.add(w); return w; });   // turned to face the player
    return { x, pool, done: new Set() };
  });

  // your see-through outline, standing where the walls are judged
  const ghostMat = new T.MeshBasicMaterial({ color: '#DFF6FF', transparent: true, opacity: .26, depthWrite: false });
  const ghost = new T.Group(); ghost.position.set(o.me, 0, JUDGE); group.add(ghost);
  const gp = (geo2, p, sc) => { const me = new T.Mesh(geo2, ghostMat); me.position.set(p[0], p[1], p[2]); if (sc) me.scale.set(sc[0], sc[1], sc[2]); ghost.add(me); return me; };
  const BOXG = new T.BoxGeometry(1, 1, 1), BALLG = new T.SphereGeometry(1, 16, 12), CYLG = new T.CylinderGeometry(1, 1, 1, 10);
  gp(BALLG, [0, 1.63 * s, 0], [.13 * s, .15 * s, .13 * s]); gp(BOXG, [0, 1.17 * s, 0], [.4 * s, .62 * s, .2 * s]);
  [-1, 1].forEach(sx => gp(BOXG, [.1 * sx * s, .44 * s, 0], [.14 * s, .88 * s, .16 * s]));
  const arms = { 1: [gp(CYLG, [0, 0, 0]), gp(CYLG, [0, 0, 0])], [-1]: [gp(CYLG, [0, 0, 0]), gp(CYLG, [0, 0, 0])] };
  const Yv = new T.Vector3(0, 1, 0), d = new T.Vector3(), p0 = new T.Vector3(), q = new T.Quaternion();
  let flash = 0, flashGood = true;
  const GOOD = new T.Color('#9BF0A8'), BAD = new T.Color('#FF8A7A'), PLAIN = new T.Color('#DFF6FF'), READY = new T.Color('#C9F7D9');

  return {
    group, song, plan,
    // the next wall still coming for a lane (0 yours, 1 theirs), or null
    next(lane, time) { const L = lanes[lane]; for (let i = 0; i < plan.length; i++) if (!L.done.has(i) && plan[i].at >= time - .05) return { i, at: plan[i].at, pose: poseOf(plan[i].midi) }; return null; },
    over: time => time > plan[plan.length - 1].at + .6,
    // move the walls and judge the ones reaching each lane. ang: [left, right] for that lane, or null to skip judging it.
    update(time, dt, myAng, oppAng) {
      const ev = { mine: [], opp: [] };
      lanes.forEach((L, li) => {
        let used = 0;
        for (let i = 0; i < plan.length; i++) {
          const w = plan[i], z = JUDGE + (w.at - time) * SPEED;
          if (z > SPAWN || z < JUDGE - .5) continue;   // gone just after it passes your outline
          if (time >= w.at && !L.done.has(i)) {
            L.done.add(i); const ang = li === 0 ? myAng : oppAng;
            if (ang) (li === 0 ? ev.mine : ev.opp).push({ i, fit: fits(ang, poseOf(w.midi)), midi: w.midi });
          }
          const me = L.pool[used++]; if (!me) break;
          me.visible = true; me.material = mats[stepOf(w.midi)]; me.position.set(L.x, H / 2, z);
        }
        for (let k = used; k < L.pool.length; k++) L.pool[k].visible = false;
      });
      if (ev.mine.length) { flash = 1; flashGood = ev.mine[ev.mine.length - 1].fit; }
      return ev;
    },
    // your outline copies your arms; green as you pass a wall, red if you hit it, mint while you already fit the next one
    setGhost(cur, fitting, dt) {
      [1, -1].forEach(side => {
        p0.set(side * .19 * s, shoulder * s, 0);
        [cur[side].up, cur[side].fore].forEach((dir, k) => {
          const seg = arms[side][k], len = .31 * s; d.copy(dir).normalize();
          seg.position.copy(p0).addScaledVector(d, len / 2); seg.quaternion.copy(q.setFromUnitVectors(Yv, d)); seg.scale.set(.05 * s, len, .05 * s);
          p0.addScaledVector(d, len);
        });
      });
      flash = Math.max(0, flash - dt * 2.2);
      ghostMat.color.copy(fitting ? READY : PLAIN); if (flash > 0) ghostMat.color.lerp(flashGood ? GOOD : BAD, flash);
      ghostMat.opacity = .22 + flash * .3;
    },
    dispose() {
      texs.forEach(t => t.dispose()); mats.forEach(m => m.dispose()); geo.dispose(); laneMat.dispose(); ghostMat.dispose(); BOXG.dispose(); BALLG.dispose(); CYLG.dispose();
      group.traverse(n => { if (n.geometry && n.geometry !== geo && n.geometry !== BOXG && n.geometry !== BALLG && n.geometry !== CYLG) n.geometry.dispose(); });
    }
  };
}
