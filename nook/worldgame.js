// Nook world games. When two players agree on a game, the island around them dissolves into green "code" and
// the game's arena appears in its place. The avatars never leave the spot: the world changes around them.
//  - Boxing: your webcam (tracking.js) moves your avatar's arms, head and lean. No camera: J and K punch.
//  - Dance floor: the same body tracking, no score.
//  - Push-ups, squats, plank: a 1v1 in a small gym. Your webcam counts your reps or times your hold (exercise.js). No camera: Space.
// Everything here works on the island scene from nook3d.js (kit.isl) and the people from world.js.
import * as EX from './exercise.js';

const PI = Math.PI, TAU = PI * 2, sin = Math.sin, cos = Math.cos;
const clamp01 = v => Math.max(0, Math.min(1, v)), smooth = v => { v = clamp01(v); return v * v * (3 - 2 * v); };
const turn = (a, b, k) => a + (((b - a) % TAU + TAU + PI) % TAU - PI) * k;
const T_IN = 3.4, T_OUT = 2.6;                                  // seconds for the world to dissolve / to come back
const FRONT = k => 1.15 * (Math.exp(4.85 * clamp01(k)) - 1);    // how far the wave has travelled: slow near you, fast far away
const HP = 100, ROUND = 75, DMG = { head: 10, blocked: 2, body: 6 };
export const GAMES = {
  boxing: { name: 'Boxing', gap: .62, bars: true },       // gap: how far apart the two players stand
  dance: { name: 'Dance floor', gap: 1.25, bars: false },
  // gym games. kind 'reps': most reps before the clock runs out. kind 'hold': most seconds held in good form.
  pushups: { name: 'Push-ups', gap: 1.5, gym: true, kind: 'reps', mode: 'pushup', secs: 40, setup: 'Camera side-on, near the floor' },
  squats: { name: 'Squats', gap: 1.5, gym: true, kind: 'reps', mode: 'squat', secs: 40, setup: 'Stand side-on, whole body in view' },
  plank: { name: 'Plank', gap: 1.5, gym: true, kind: 'hold', secs: 60, setup: 'Camera side-on, near the floor' }
};

/* The effect is added to the island's own materials. Names start with "nw" so they cannot clash with other shader add-ons. */
const GLSL = `
uniform float uNwFront; uniform vec3 uNwCenter; uniform float uNwTime; varying vec3 vNwPos;
float nwHash(vec3 p) { p = fract(p * .3183099 + .1); p *= 17.; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
vec3 nwCode(vec3 w, float edge) {   // little blocks that flicker and fall in columns, like raining code
  vec3 c = floor(w / .09);
  float col = nwHash(vec3(c.x, 1., c.z));
  float fall = fract(w.y * .9 + uNwTime * (.6 + col * 1.4) + col * 7.);
  float on = step(.42, nwHash(c + floor(uNwTime * 9. + col * 5.)));
  return mix(vec3(.01, .07, .03), vec3(.25, 1., .45), on * (.25 + .75 * fall * fall)) + vec3(.55, 1., .7) * edge;
}
float nwBand(out vec3 cell) { cell = floor(vNwPos / .22); return uNwFront - distance(vNwPos.xz, uNwCenter.xz) - (nwHash(cell) - .5) * 1.1; }`;
// the old world: turns to code where the wave reaches it, then breaks up block by block
const DISSOLVE = `if (uNwFront > -.5) { vec3 nwC; float nwB = nwBand(nwC), nwW = .9 + uNwFront * .05;
  if (nwB > nwW) discard;
  if (nwB > 0.) { float k = nwB / nwW; if (nwHash(nwC + 3.) < k * k) discard; gl_FragColor = vec4(nwCode(vNwPos, smoothstep(.14, 0., nwB)), 1.); } }`;
// the arena: the opposite. Nothing outside the wave, code at the wave, the real thing behind it
const REVEAL = `{ vec3 nwC; float nwB = nwBand(nwC);
  if (nwB < 0.) discard;
  if (nwB < .9) { float k = 1. - nwB / .9; if (nwHash(nwC + 3.) < k * k * .85) discard; gl_FragColor.rgb = mix(gl_FragColor.rgb, nwCode(vNwPos, smoothstep(.14, 0., nwB)), k); } }`;

export function createGames(T, kit, world, cb = {}) {
  const { isl } = kit;
  const U = { uNwFront: { value: -1 }, uNwCenter: { value: new T.Vector3() }, uNwTime: { value: 0 } };
  const DOWN = new T.Vector3(0, -1, 0), tv = new T.Vector3(), tv2 = new T.Vector3(), q1 = new T.Quaternion(), q2 = new T.Quaternion(), qB = new T.Quaternion();
  const DARK = new T.Color('#10150F');

  /* ---------- the dissolve / appear effect ---------- */
  const hooks = new WeakMap();
  function fx(mat, kind) {
    if (!mat || hooks.get(mat) === mat.onBeforeCompile) return;   // already ours, and nobody replaced it since
    const prev = mat.onBeforeCompile, prevKey = mat.customProgramCacheKey;   // keep whatever another file hooked in before us
    const hook = function (sh, r) {
      if (prev) prev.call(this, sh, r);
      if (sh.fragmentShader.includes('uNwFront')) return;
      Object.assign(sh.uniforms, U);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vNwPos;').replace('#include <project_vertex>', '#include <project_vertex>\nvNwPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + GLSL).replace('#include <premultiplied_alpha_fragment>', '#include <premultiplied_alpha_fragment>\n' + (kind === 'reveal' ? REVEAL : DISSOLVE));
    };
    mat.onBeforeCompile = hook; hooks.set(mat, hook);
    mat.customProgramCacheKey = function () { return (prevKey ? prevKey.call(this) : '') + '|nw-' + kind; };
    mat.needsUpdate = true;
  }
  // The two players must never dissolve. If one of their parts shares a material with the scenery, give it a plain copy.
  const plain = new Map();
  const protect = av => av.traverse(n => { const mt = n.material; if (!mt || !hooks.has(mt)) return; if (!plain.has(mt)) { const c = mt.clone(); c.userData = {}; plain.set(mt, c); } n.material = plain.get(mt); });
  function scenery(skip) {
    return isl.children.filter(o => !o.isLight && !skip.has(o)).map(o => {
      o.traverse(n => { if (n.material) fx(n.material, 'dissolve'); });
      const b = new T.Box3().setFromObject(o), c = b.getCenter(tv), r = b.getSize(tv2).length() / 2;
      return { obj: o, was: o.visible, cx: c.x, cz: c.z, r };
    });
  }

  /* ---------- arenas (built once, low-poly like the island) ---------- */
  const mats = new Map();
  const M = c => { if (!mats.has(c)) { const m = new T.MeshStandardMaterial({ color: c, roughness: 1, flatShading: true }); fx(m, 'reveal'); mats.set(c, m); } return mats.get(c); };
  const BOX = new T.BoxGeometry(1, 1, 1), CYL = new T.CylinderGeometry(1, 1, 1, 12), BALL = new T.IcosahedronGeometry(1, 1), STAR = new T.OctahedronGeometry(1, 0);
  const part = (g, geo, mat, p, s, r) => { const me = new T.Mesh(geo, mat); me.position.set(p[0], p[1], p[2]); me.scale.set(s[0], s[1], s[2]); if (r) me.rotation.set(r[0], r[1], r[2]); me.castShadow = me.receiveShadow = true; g.add(me); return me; };
  const ground = (g, drop) => {   // the dark floor and grid that take the sea's place
    const f = new T.Mesh(new T.CircleGeometry(70, 48).rotateX(-PI / 2), M('#161C14')); f.position.y = -drop; f.receiveShadow = true; g.add(f);
    const grid = new T.GridHelper(120, 120, '#3C9A58', '#235C36'); grid.position.y = -drop + .012; fx(grid.material, 'reveal'); g.add(grid);
  };
  // +x points from the player who asked to the player who accepted; y = 0 is where their feet are
  function ring() {
    const g = new T.Group(), H = 2.1; ground(g, .6);
    part(g, BOX, M('#B9694C'), [0, -.32, 0], [H * 2 + .34, .56, H * 2 + .34]);   // apron
    part(g, BOX, M('#EFE8DA'), [0, -.03, 0], [H * 2 + .14, .06, H * 2 + .14]);   // canvas
    const logo = new T.Mesh(new T.RingGeometry(.5, .58, 40).rotateX(-PI / 2), M('#5E683C')); logo.position.y = .004; logo.receiveShadow = true; g.add(logo);
    [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(c => {
      part(g, CYL, M('#F3EEE6'), [c[0] * H, .5, c[1] * H], [.065, 1.06, .065]);
      part(g, BOX, M(c[0] > 0 ? '#C2452D' : '#4C5FA8'), [c[0] * (H - .09), .56, c[1] * (H - .09)], [.2, .62, .2], [0, PI / 4, 0]);   // corner pads: blue for who asked, red for who accepted
    });
    [.3, .55, .8].forEach((y, i) => { const m = M(i === 2 ? '#C2452D' : '#F8F3E8'); [1, -1].forEach(s => { part(g, BOX, m, [0, y, s * H], [H * 2, .035, .035]); part(g, BOX, m, [s * H, y, 0], [.035, .035, H * 2]); }); });
    return g;
  }
  function dance() {
    const g = new T.Group(), cols = ['#B9694C', '#C08A3A', '#7E9A62', '#5C5E78']; g.userData.tiles = []; ground(g, .34);
    part(g, CYL, M('#2B2A27'), [0, -.17, 0], [2.75, .3, 2.75]);
    for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) {
      if (Math.hypot(i, j) > 3.4) continue;
      const c = cols[(i + j + 12) % 4], m = new T.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: .3, roughness: 1 }); fx(m, 'reveal');
      part(g, BOX, m, [i * .7, -.008, j * .7], [.64, .03, .64]).castShadow = false; g.userData.tiles.push({ m, ph: i * 3 + j * 5 });
    }
    return g;
  }
  // the gym for push-ups, squats and the plank: both players face the same way (+z), each on their own mat
  function gym() {
    const g = new T.Group(); ground(g, .24);
    part(g, BOX, M('#D9CDB6'), [0, -.13, .5], [4.6, .2, 3.9]);   // wooden floor
    [[-1, '#4C5FA8'], [1, '#C2452D']].forEach(c => part(g, BOX, M(c[1]), [c[0] * .75, -.012, .55], [1, .03, 2.4]).castShadow = false);   // mats: blue for who asked, red for who accepted
    part(g, BOX, M('#2B2A27'), [0, .28, -1.1], [1.9, .06, .32]); [-.8, .8].forEach(x => part(g, BOX, M('#2B2A27'), [x, .1, -1.1], [.06, .36, .3]));   // a rack of weights behind them
    [-.6, 0, .6].forEach((x, i) => { part(g, CYL, M(['#5E683C', '#C08A3A', '#5C5E78'][i]), [x, .43, -1.1], [.13, .09, .13], [PI / 2, 0, 0]); part(g, CYL, M('#F3EEE6'), [x, .43, -1.1], [.035, .26, .035], [PI / 2, 0, 0]); });
    return g;
  }
  const arenas = {}, arena = game => { const k = GAMES[game].gym ? 'gym' : game; return arenas[k] || (arenas[k] = k === 'boxing' ? ring() : k === 'dance' ? dance() : gym()); };
  const spot = new T.SpotLight('#FFF1DC', 0, 0, .75, .6, 0); spot.position.set(0, 5.5, 0);
  const sparks = [0, 1, 2].map(() => { const s = new T.Mesh(STAR, new T.MeshBasicMaterial({ color: '#FFF6D8', transparent: true, depthWrite: false })); s.visible = false; s.userData.t = 1; return s; });
  let warm = false;

  /* ---------- a player in a match ---------- */
  const limb = () => ({ up: DOWN.clone(), fore: DOWN.clone() });
  // arm poses as two directions in avatar space: shoulder to elbow, elbow to wrist. x is given for the +x arm and flipped for the other.
  const STANCE = { rest: [[.08, -1, .02], [.05, -1, .12]], guard: [[.3, -.78, .55], [-.42, .8, .42]], low: [[.22, -.92, .3], [-.25, .2, .95]], win: [[.45, .88, 0], [-.1, 1, .05]] };
  const setLimb = (l, s, d) => { l.up.set(d[0][0] * s, d[0][1], d[0][2]).normalize(); l.fore.set(d[1][0] * s, d[1][1], d[1][2]).normalize(); };
  const fighter = (p, role, mine) => ({
    p, u: p.av.userData, role, mine, hp: HP, stance: 'rest', k: 0, there: false, spot: null, face: 0, bounce: 0,
    goal: { 1: limb(), [-1]: limb() }, cur: { 1: limb(), [-1]: limb() }, tracked: { 1: false, [-1]: false },
    lean: { x: 0, yaw: 0, roll: 0 }, leanT: { x: 0, yaw: 0, roll: 0 }, head: { yaw: 0, pitch: 0, roll: 0 }, headT: { yaw: 0, pitch: 0, roll: 0 },
    punch: null, rest: 0, cool: { 1: 0, [-1]: 0 }, gloves: [], gPos: { 1: new T.Vector3(), [-1]: new T.Vector3() }, gVel: { 1: new T.Vector3(), [-1]: new T.Vector3() },
    headPos: new T.Vector3(), chestPos: new T.Vector3(), guard: false, flinch: 0, fall: 0, fallT: 0, ai: { mode: 'guard', t: 1.2 },
    score: 0, depth: 0, depthT: 0, pitch: 0, holding: false, counter: null, keyDown: false, keyAt: 0, lastRep: 0, npc: { p: 0, dur: 1.5, rest: .4, done: false }   // gym games
  });
  // direction (into tv) of a straight arm from the shoulder to a point in the world
  const aimDir = (F, s, target) => { tv.copy(target); F.p.av.worldToLocal(tv); tv.x -= s * .19; tv.y -= 1.42; tv.z -= 1.42 * F.lean.x; return tv.normalize(); };
  function base(F) { [1, -1].forEach(s => setLimb(F.goal[s], s, STANCE[F.stance])); F.leanT.x = F.leanT.yaw = F.leanT.roll = 0; F.headT.yaw = F.headT.pitch = F.headT.roll = 0; }
  // Your webcam. The tracker gives a mirror image (made for an avatar that faces you); here you see your avatar from
  // behind, so sides are swapped back: your right arm moves the avatar's right arm.
  function fromTrack(F, O, boxing) {
    const tr = kit.track ? kit.track() : null, bd = tr && tr.body, hd = tr && tr.head; let ext = 0;
    [1, -1].forEach(s => {
      const a = bd && bd.arms && bd.arms[-s]; F.tracked[s] = !!(a && a.w > .5 && a.up && a.fore); if (!F.tracked[s]) return;
      const g = F.goal[s]; g.up.set(-a.up[0], a.up[1], a.up[2]).normalize(); g.fore.set(-a.fore[0], a.fore[1], a.fore[2]).normalize();
      const out = (g.up.z + g.fore.z) / 2;   // how far forward the arm points
      if (!boxing || out < .5) return;
      // a punch: lean in and steer the fist at the other player, so real punches land
      const k = smooth((out - .5) / .3) * .65; aimDir(F, s, g.fore.y > -.2 ? O.headPos : O.chestPos); g.up.lerp(tv, k).normalize(); g.fore.lerp(tv, k).normalize(); ext = Math.max(ext, smooth((out - .5) / .35));
    });
    if (bd) { F.leanT.yaw = -(+bd.yaw || 0) * .6; F.leanT.roll = -(+bd.roll || 0) * .7; }
    if (hd) { F.headT.yaw = -(+hd.yaw || 0); F.headT.pitch = +hd.pitch || 0; F.headT.roll = -(+hd.roll || 0); }
    F.leanT.x = ext * .22;
    return F.tracked[1] || F.tracked[-1];
  }
  // a punch from a key press or from the computer player: arm straight at the target, a lean and a twist, then back
  function drivePunch(F, O, dt) {
    const P = F.punch; if (!P) return; P.t += dt;
    if (P.t < .2) { aimDir(F, P.s, P.zone === 'head' ? O.headPos : O.chestPos); F.goal[P.s].up.copy(tv); F.goal[P.s].fore.copy(tv); F.leanT.x = .22; F.leanT.yaw = -P.s * .22; }
    if (P.t > .38) F.punch = null;
  }
  function think(F) {   // the computer player: guards, punches, and sometimes drops its hands so you can get in
    const A = F.ai; if (F.punch || A.t > 0) return;
    if (A.mode !== 'guard') { A.mode = 'guard'; A.t = .5 + Math.random() * 1.1; }
    else if (Math.random() < .68) { F.punch = { s: Math.random() < .5 ? 1 : -1, zone: Math.random() < .6 ? 'head' : 'body', t: 0 }; A.mode = Math.random() < .5 ? 'low' : 'guard'; A.t = .55 + Math.random() * .5; }
    else { A.mode = 'low'; A.t = .5 + Math.random() * .7; }
    F.stance = A.mode;
  }
  function groove(F, t) {
    [1, -1].forEach(s => { const ph = t * 6.6 + (s > 0 ? 0 : PI); setLimb(F.goal[s], s, [[.5, -.3 + .55 * sin(ph), .3], [-.25, .8 + .2 * sin(ph), .35]]); });
    F.leanT.roll = sin(t * 3.3 + F.role) * .1; F.leanT.yaw = sin(t * 1.65 + F.role * 2) * .25; F.bounce = Math.abs(sin(t * 6.6)) * .03;
  }
  // put the pose on the avatar (after world.js has done its normal standing / walking pose)
  function applyPose(F, dt) {
    const u = F.u, kb = Math.min(1, dt * 16), kl = Math.min(1, dt * 10);
    F.rest -= dt; F.k += ((F.there ? 1 : 0) - F.k) * Math.min(1, dt * 5); F.fall += (F.fallT - F.fall) * Math.min(1, dt * 4); F.flinch = Math.max(0, F.flinch - dt * 3.2);
    ['x', 'yaw', 'roll'].forEach(a => { F.lean[a] += (F.leanT[a] - F.lean[a]) * kl; });
    ['yaw', 'pitch', 'roll'].forEach(a => { F.head[a] += (F.headT[a] - F.head[a]) * kl; });
    [1, -1].forEach(s => { F.cur[s].up.lerp(F.goal[s].up, kb).normalize(); F.cur[s].fore.lerp(F.goal[s].fore, kb).normalize(); });
    u.body.rotation.set((F.lean.x - F.flinch * .22) * F.k, F.lean.yaw * F.k, F.lean.roll * F.k);
    qB.copy(u.body.quaternion).invert();
    [1, -1].forEach(s => {
      tv.copy(F.cur[s].up).applyQuaternion(qB); q1.setFromUnitVectors(DOWN, tv); u.arms[s].quaternion.slerp(q1, F.k);
      tv.copy(F.cur[s].fore).applyQuaternion(qB).applyQuaternion(q2.copy(u.arms[s].quaternion).invert()); q1.setFromUnitVectors(DOWN, tv); u.elbows[s].quaternion.slerp(q1, F.k);
    });
    u.head.rotation.x += (F.head.pitch - F.flinch * .45) * F.k; u.head.rotation.y += F.head.yaw * F.k; u.head.rotation.z += F.head.roll * F.k;
    F.p.av.rotation.x = -F.fall * 1.45; F.p.av.position.y += F.bounce * F.k;
    // where the fists, head and chest ended up, for hits and blocks
    F.p.av.updateMatrixWorld(true);
    [1, -1].forEach(s => { tv2.copy(F.gPos[s]); u.elbows[s].localToWorld(F.gPos[s].set(0, -.31, 0)); F.gVel[s].copy(F.gPos[s]).sub(tv2).divideScalar(Math.max(dt, .001)); F.cool[s] -= dt; });
    u.head.getWorldPosition(F.headPos); u.body.localToWorld(F.chestPos.set(0, 1.28, .05));
    F.guard = F.gPos[1].distanceTo(F.headPos) < .3 && F.gPos[-1].distanceTo(F.headPos) < .3;   // both fists up by your face
    F.gloves.forEach(gl => { gl.scale.lerp(gl.userData.size, Math.min(1, dt * 8)); });
  }

  /* ---------- push-ups, squats and the plank (counting comes from exercise.js) ---------- */
  // One frame of the contest: your camera counts you, the computer player (or the other window) keeps their own score.
  function exercise(A, B, t, dt, G) {
    const tr = kit.track ? kit.track() : null, raw = tr && tr.raw, hold = G.kind === 'hold';
    m.tracking = !!(raw && raw.lm && raw.lm.length); m.cue = '';
    if (!hold) {
      if (m.tracking) {
        const s = EX.measure(raw.lm, G.mode, 0, raw.aspect || 1.33, A.counter.trackedSide, raw.wl || []);
        A.counter.update(s, performance.now()); A.score = A.counter.count;
        const dep = A.counter.depth(s); A.depthT = dep != null ? clamp01(dep / .3) : s.valid && s.contracted ? 1 : 0;
        m.cue = !s.valid ? s.hint : A.counter.phase === 'ready' ? 'Start with straight ' + (G.mode === 'squat' ? 'legs' : 'arms') : '';
      } else A.depthT = A.keyDown ? 1 : 0;   // no camera: Space goes down, letting go comes back up and counts
      if (!m.remote) {
        const N = B.npc; N.p += dt / N.dur;
        if (N.p >= 1 && !N.done) { B.score++; N.done = true; }
        if (N.p >= 1 + N.rest) { N.p = 0; N.done = false; N.dur = (1.15 + Math.random() * .7) * (1 + B.score * .02); N.rest = .1 + Math.random() * .35; }   // gets tired
        B.depthT = N.p < 1 ? sin(N.p * PI) : 0;
      }
    } else {
      if (m.tracking) { const f = EX.measurePlank(raw.lm, 0, raw.aspect || 1.33); A.holding = f.kind === 'holding'; if (!A.holding) m.cue = f.cue; } else A.holding = A.keyDown;
      if (A.holding) A.score += dt;
      if (!m.remote) { const N = B.npc; N.p -= dt; if (N.p <= 0) { B.holding = !B.holding; N.p = B.holding ? 6 + Math.random() * 9 : .8 + Math.random() * 1.4; } if (B.holding) B.score += dt; }
    }
    const edge = hold ? .25 : 0;
    if (m.clock <= 0) finish(A.score > B.score + edge ? 'win' : B.score > A.score + edge ? 'lose' : 'draw');
  }
  // The avatar does the exercise: `depth` 0..1 is how far down a rep is. Standing again once the round is over.
  function exercisePose(F, t, dt, G) {
    const u = F.u, live = m.phase === 'in' || m.phase === 'play', mode = !live ? 'stand' : G.mode || 'plank', floor = mode === 'pushup' || mode === 'plank', kb = Math.min(1, dt * 14);
    F.k += ((F.there ? 1 : 0) - F.k) * Math.min(1, dt * 5); F.depth += ((live ? F.depthT : 0) - F.depth) * Math.min(1, dt * 12);
    const d = F.depth;
    // how far the body tips forward from standing: push-up top 1.12, push-up bottom 1.34, forearm plank 1.36 (it shakes when the form breaks)
    const tip = !floor ? 0 : mode === 'plank' ? 1.36 + (m.phase === 'play' && !F.holding ? sin(t * 13) * .03 : 0) : 1.12 + d * .22;
    F.pitch += (tip * F.k - F.pitch) * Math.min(1, dt * 5);
    const th = F.pitch, dy = -cos(th), dz = sin(th);   // "towards the floor", as the avatar sees it
    [1, -1].forEach(s => {
      const g = F.goal[s];
      if (mode === 'pushup') { g.fore.set(0, dy, dz); g.up.set(s * .5 * d, dy * (1 - d) - .7 * d, dz * (1 - d) + .3 * d).normalize(); }   // hands stay planted, elbows fold out and back
      else if (mode === 'plank') { g.up.set(0, dy, dz); g.fore.set(0, sin(th), cos(th)); }   // on the forearms
      else if (mode === 'squat') { g.up.set(s * .08, -1 + .9 * d, .02 + d).normalize(); g.fore.set(s * .05 - s * .1 * d, -1 + .95 * d, .12 + d).normalize(); }   // arms come forward for balance
      else setLimb(g, s, STANCE[F.stance]);
      F.cur[s].up.lerp(g.up, kb).normalize(); F.cur[s].fore.lerp(g.fore, kb).normalize();
    });
    const sq = mode === 'squat' ? d : 0, lean = sq * .35;
    u.body.rotation.set(lean, 0, 0);
    [1, -1].forEach(s => { if (sq) u.legs[s].rotation.x = -sq * 1.15 - lean; if (u.knees) u.knees[s].rotation.x = sq * 1.45; });
    qB.copy(u.body.quaternion).invert();
    [1, -1].forEach(s => {
      tv.copy(F.cur[s].up).applyQuaternion(qB); q1.setFromUnitVectors(DOWN, tv); u.arms[s].quaternion.slerp(q1, F.k);
      tv.copy(F.cur[s].fore).applyQuaternion(qB).applyQuaternion(q2.copy(u.arms[s].quaternion).invert()); q1.setFromUnitVectors(DOWN, tv); u.elbows[s].quaternion.slerp(q1, F.k);
    });
    if (floor) u.head.rotation.x -= .6 * F.k;   // look ahead, not at the floor
    F.p.av.rotation.x = th;
    if (sq && u.feet) {   // bent knees would lift the feet: lower the body until the soles touch the floor again
      F.p.av.updateMatrixWorld(true);
      u.body.position.y -= (Math.min(u.feet[1].getWorldPosition(tv).y, u.feet[-1].getWorldPosition(tv2).y) - F.p.av.position.y) / world.S;
    }
  }

  /* ---------- the match ---------- */
  let m = null;
  const game = { focus: new T.Vector3(), yaw: 0, floorY: 0, step, pose };
  function hurt(O, zone, blocked, at) {
    O.hp = Math.max(0, O.hp - (blocked ? DMG.blocked : DMG[zone] || 0)); O.flinch = blocked ? .35 : 1;
    const sp = sparks.find(s => !s.visible) || sparks[0]; sp.position.copy(at); sp.visible = true; sp.userData.t = 0; sp.userData.big = blocked ? .06 : .13;
    cb.onHit && cb.onHit({ onMe: O.mine, zone, blocked });
    if (O.hp <= 0) finish(O.mine ? 'lose' : 'win');
  }
  function hits(F, O) {   // F's fists against O's head and chest
    tv2.copy(O.headPos).sub(F.headPos).setY(0).normalize();
    [1, -1].forEach(s => {
      if (F.cool[s] > 0 || F.gVel[s].dot(tv2) < .8) return;   // it has to be a real punch, moving at them
      const zone = F.gPos[s].distanceTo(O.headPos) < .15 ? 'head' : F.gPos[s].distanceTo(O.chestPos) < .17 ? 'body' : null; if (!zone) return;
      const blocked = zone === 'head' && O.guard; F.cool[s] = .5;
      if (m.remote) cb.send && cb.send({ k: 'hit', zone, blocked });
      hurt(O, zone, blocked, F.gPos[s]);
    });
  }
  function finish(result, quick) {   // 'win' | 'lose' | 'draw' | 'left' (you left) | 'gone' (they left)
    if (!m || m.phase === 'over' || m.phase === 'out') return;
    const A = m.mine, B = m.opp, was = m.phase;
    m.phase = 'over'; m.T = 0; m.result = result; m.wait = quick || was === 'in' ? .4 : 3; A.punch = B.punch = null; A.bounce = B.bounce = 0;
    A.stance = result === 'win' ? 'win' : 'rest'; B.stance = result === 'lose' ? 'win' : 'rest'; A.fallT = result === 'lose' ? 1 : 0; B.fallT = result === 'win' ? 1 : 0;
    [A, B].forEach(base); look();
    cb.onPhase && cb.onPhase('over', result);
  }
  function look() {   // where the camera sits in each part of the match
    const A = m.mine, V = world.view, play = m.phase === 'play' || m.phase === 'over', box = m.game === 'boxing', gymG = GAMES[m.game].gym;
    // boxing and dancing: behind you and off to one side, so you see the other player past your shoulder. The gym: in front of you both.
    game.yaw = gymG ? A.face + (play ? .7 : 1.1) : A.face + PI + (play ? .62 : .95);
    V.dist = m.phase === 'out' ? m.view.dist : m.phase === 'over' ? (gymG ? 4.6 : 3.6) : play ? (box ? 2.8 : gymG ? 4.1 : 4.2) : 6.4;
    V.el = m.phase === 'out' ? m.view.el : play ? (gymG ? .3 : .36) : .5;
  }
  function env(e) {   // 0 = the island's daylight, 1 = the arena's dark hall
    isl.background.lerpColors(m.env.bg, DARK, e); isl.fog.color.lerpColors(m.env.fog, DARK, e);
    isl.fog.near = m.env.near + (12 - m.env.near) * e; isl.fog.far = m.env.far + (58 - m.env.far) * e;
    m.env.lights.forEach(l => { l.light.intensity = l.was * (1 - e * (l.light.isDirectionalLight ? .45 : .6)); }); spot.intensity = 2.6 * e;
  }
  function step(t, dt) {
    if (!m) return;
    const A = m.mine, B = m.opp, G = GAMES[m.game]; U.uNwTime.value = t; m.T += dt;
    if (m.phase === 'in') { m.k = Math.min(1, m.k + dt / T_IN); if (m.k >= 1 && A.there && B.there) begin(); }
    else if (m.phase === 'over' && m.T > m.wait) { m.phase = 'out'; m.T = 0; [A, B].forEach(F => { F.stance = 'rest'; F.fallT = 0; base(F); }); look(); cb.onPhase && cb.onPhase('out', m.result); }   // back on your feet while the island returns
    else if (m.phase === 'out') { m.k = Math.max(0, m.k - dt / T_OUT); if (m.k <= 0) return end(); }
    // the wave: the island goes where it has passed, and comes back when it pulls in again
    const f = FRONT(m.k), gone = f - (.9 + f * .05) - .7; U.uNwFront.value = f;
    m.scenery.forEach(o => { o.obj.visible = o.was && m.k < 1 && Math.hypot(o.cx - m.C.x, o.cz - m.C.z) + o.r > gone; });
    world.each(p => { if (p !== A.p && p !== B.p) p.av.visible = Math.hypot(p.x - m.C.x, p.z - m.C.z) > f; });
    env(smooth((m.k - .08) / .5));
    // the two players: turn to each other, and once the floor is under them walk the last steps to their marks
    [A, B].forEach(F => {
      const p = F.p, dx = F.spot.x - p.x, dz = F.spot.z - p.z, d = Math.hypot(dx, dz), go = m.k > .4 && d > .02 && !F.there;
      if (go) { const s = Math.min(d, world.WALK * dt); p.x += dx / d * s; p.z += dz / d * s; p.phase += s * 5.2; }
      else if (m.k > .4) F.there = true;
      p.walkK += ((go ? 1 : 0) - p.walkK) * Math.min(1, dt * 10); p.waveK = 0;
      p.ry = turn(p.ry, go && d > .3 ? Math.atan2(dx, dz) : F.face, Math.min(1, dt * 7));
    });
    if (m.phase === 'in' && A.there) { A.stance = B.stance = m.game === 'boxing' ? 'guard' : 'rest'; [A, B].forEach(base); }
    if (m.phase === 'play') {
      m.clock = Math.max(0, (G.secs || ROUND) - m.T);
      if (G.kind) exercise(A, B, t, dt, G);
      else if (m.game === 'boxing') {
        base(A); m.tracking = fromTrack(A, B, true); drivePunch(A, B, dt);
        if (!m.remote) { B.ai.t -= dt; think(B); base(B); drivePunch(B, A, dt); }
        A.bounce = B.bounce = Math.abs(sin(t * 5)) * .008;
        if (m.clock <= 0) finish(A.hp > B.hp ? 'win' : A.hp < B.hp ? 'lose' : 'draw');
      } else {
        base(A); m.tracking = fromTrack(A, B, false); if (!m.tracking) groove(A, t);
        if (!m.remote) groove(B, t);
        m.arena.userData.tiles.forEach(tl => { tl.m.emissiveIntensity = .2 + .55 * Math.max(0, sin(t * 6.6 + tl.ph)); });
      }
    }
    // camera: the middle of the two while the world changes, then just past your shoulder
    const fk = m.phase === 'play' || m.phase === 'over' ? .4 : m.phase === 'out' ? 0 : .5;
    if (G.gym && m.phase !== 'out') game.focus.set(m.C.x + sin(A.face) * .6, m.y + .5, m.C.z + cos(A.face) * .6);
    else game.focus.set(A.p.x + (B.p.x - A.p.x) * fk, m.y + (m.phase === 'out' ? 1.5 * world.S : .9), A.p.z + (B.p.z - A.p.z) * fk);
    sparks.forEach(s => { if (!s.visible) return; s.userData.t += dt * 4; const k = s.userData.t; s.scale.setScalar(s.userData.big * (.4 + k)); s.material.opacity = 1 - k; s.rotation.y += dt * 9; if (k >= 1) s.visible = false; });
  }
  function pose(t, dt) {
    if (!m) return;
    const A = m.mine, B = m.opp, G = GAMES[m.game];
    if (G.kind) { exercisePose(A, t, dt, G); exercisePose(B, t, dt, G); return; }
    applyPose(A, dt); applyPose(B, dt);
    if (m.phase === 'play' && m.game === 'boxing') { hits(A, B); if (m && !m.remote) hits(B, A); }
  }
  function begin() {
    const A = m.mine, B = m.opp; m.phase = 'play'; m.T = 0;
    if (GAMES[m.game].kind === 'reps') A.counter = new EX.RepCounter();
    if (GAMES[m.game].kind === 'hold') { B.holding = true; B.npc.p = 6 + Math.random() * 8; }
    if (m.game === 'boxing') [A, B].forEach(F => {   // gloves: blue for who asked, red for who accepted
      const mat = new T.MeshStandardMaterial({ color: F.role === 0 ? '#4C5FA8' : '#C2452D', roughness: .8, flatShading: true });
      [1, -1].forEach(s => { const gl = new T.Mesh(BALL, mat); gl.position.set(0, -.315, 0); gl.scale.setScalar(.001); gl.userData.size = new T.Vector3(.058, .072, .062); gl.castShadow = true; F.u.elbows[s].add(gl); F.gloves.push(gl); });
    });
    look(); cb.onPhase && cb.onPhase('play');
  }
  function end(silent) {
    const A = m.mine, B = m.opp, result = m.result;
    U.uNwFront.value = -1; env(0); m.scenery.forEach(o => { o.obj.visible = o.was; }); world.each(p => { p.av.visible = true; });
    isl.remove(m.arena); sparks.forEach(s => { s.visible = false; isl.remove(s); });
    [A, B].forEach(F => {
      F.gloves.forEach(gl => { gl.parent && gl.parent.remove(gl); }); if (F.gloves[0]) F.gloves[0].material.dispose();
      F.u.body.rotation.set(0, 0, 0); F.p.av.rotation.x = 0; F.p.av.rotation.order = 'XYZ'; F.p.fixY = null; F.p.walkK = 0;
      if (F.u.knees) [1, -1].forEach(s => { F.u.knees[s].rotation.x = 0; });
    });
    Object.assign(world.view, m.view); world.setGame(null); m = null;
    if (!silent) cb.onPhase && cb.onPhase('end', result);
  }

  const api = {
    active: () => !!m,
    // Compile the effect while the island loads, so nothing stutters when the first match starts.
    prewarm() {
      if (warm) return; warm = true; const skip = new Set(); world.each(p => skip.add(p.av)); scenery(skip);
      spot.intensity = 0; isl.add(spot, spot.target);   // always in the scene (switched off), so lighting is not rebuilt mid-match
      const gs = [arena('boxing'), arena('dance'), arena('pushups')]; gs.forEach(g => isl.add(g)); let n = 0;
      const off = () => { if (++n < 3) return requestAnimationFrame(off); gs.forEach(g => { if (!m || m.arena !== g) isl.remove(g); }); }; requestAnimationFrame(off);
    },
    // o: { game, oppId, role (0 = you asked, 1 = you accepted), remote, spec }. Returns the spec so both sides can build the same arena.
    start(o) {
      const a = world.me(), b = world.person(o.oppId); if (m || !a || !b || !GAMES[o.game]) return null;
      api.prewarm();
      const role = o.role ? 1 : 0, first = role ? b : a, second = role ? a : b, gap = GAMES[o.game].gap; let sp = o.spec;
      if (!sp || ![sp.cx, sp.cz, sp.y, sp.dx, sp.dz].every(Number.isFinite) || Math.hypot(sp.cx, sp.cz) > 40) {
        const dx = second.x - first.x, dz = second.z - first.z, d = Math.hypot(dx, dz);
        sp = { cx: (a.x + b.x) / 2, cz: (a.z + b.z) / 2, y: (a.y + b.y) / 2, dx: d > .01 ? dx / d : 1, dz: d > .01 ? dz / d : 0 };
      }
      const dl = Math.hypot(sp.dx, sp.dz) || 1, dx = sp.dx / dl, dz = sp.dz / dl, skip = new Set([...Object.values(arenas), spot, spot.target, ...sparks]); world.each(p => skip.add(p.av));
      const g = arena(o.game); g.position.set(sp.cx, sp.y, sp.cz); g.rotation.y = Math.atan2(-dz, dx);
      m = { game: o.game, remote: !!o.remote, phase: 'in', k: 0, T: 0, clock: GAMES[o.game].secs || ROUND, cue: '', tracking: false, result: null, wait: 3, arena: g, y: sp.y, C: new T.Vector3(sp.cx, sp.y, sp.cz),
        scenery: scenery(skip), view: { dist: world.view.dist, el: world.view.el },
        env: { bg: isl.background.clone(), fog: isl.fog.color.clone(), near: isl.fog.near, far: isl.fog.far, lights: isl.children.filter(l => l.isLight && l !== spot).map(l => ({ light: l, was: l.intensity })) } };
      m.mine = fighter(a, role, true); m.opp = fighter(b, 1 - role, false);
      [m.mine, m.opp].forEach(F => {
        const sgn = F.role ? 1 : -1; F.spot = { x: sp.cx + dx * gap / 2 * sgn, z: sp.cz + dz * gap / 2 * sgn }; F.face = GAMES[o.game].gym ? g.rotation.y : Math.atan2(-dx * sgn, -dz * sgn);   // the gym: both face the same way. Otherwise: each other
        F.p.fixY = sp.y; F.p.goal = null; F.p.av.rotation.order = 'YXZ'; protect(F.p.av);
      });
      U.uNwCenter.value.copy(m.C); game.floorY = sp.y; game.focus.set(sp.cx, sp.y + .9, sp.cz);
      spot.position.set(sp.cx, sp.y + 5.5, sp.cz); spot.target.position.set(sp.cx, sp.y, sp.cz);
      isl.add(g); sparks.forEach(s => isl.add(s)); world.setGame(game); look();
      cb.onPhase && cb.onPhase('in');
      return { cx: sp.cx, cz: sp.cz, y: sp.y, dx, dz };
    },
    quit() { if (m) finish('left', true); },          // you leave the match
    gone() { if (m) finish('gone', true); },          // the other player left
    abort() { if (m) end(true); },                    // drop everything now (you left the island)
    punch(s, zone) { const F = m && m.mine; if (F && m.phase === 'play' && m.game === 'boxing' && !F.punch && F.rest <= 0) { F.punch = { s: s > 0 ? 1 : -1, zone: zone === 'body' ? 'body' : 'head', t: 0 }; F.rest = .55; } },
    info: () => m && { game: m.game, phase: m.phase, clock: m.clock, hp: [m.mine.hp, m.opp.hp], score: [m.mine.score, m.opp.score], cue: m.cue || '', tracking: m.tracking, result: m.result },
    // gym games without a camera: Space (or the button). Reps: hold to go down, let go to count one. Plank: hold to hold.
    press(down) {
      const F = m && m.mine, G = m && GAMES[m.game]; if (!F || !G.kind || m.phase !== 'play' || m.tracking) return; const now = performance.now();
      if (down && !F.keyDown) F.keyAt = now;
      else if (!down && F.keyDown && G.kind === 'reps' && now - F.keyAt > 120 && now - F.lastRep > 450) { F.score++; F.lastRep = now; }
      F.keyDown = !!down;
    },
    // two windows: each side sends its own pose and the hits it lands
    poseOut() {
      if (!m) return null; const F = m.mine, o = [];
      if (GAMES[m.game].kind) return [+F.depthT.toFixed(2), +F.score.toFixed(1), F.holding ? 1 : 0];
      [1, -1].forEach(s => { o.push(F.cur[s].up.x, F.cur[s].up.y, F.cur[s].up.z, F.cur[s].fore.x, F.cur[s].fore.y, F.cur[s].fore.z); });
      o.push(F.leanT.x, F.leanT.yaw, F.leanT.roll, F.headT.yaw, F.headT.pitch, F.headT.roll, F.bounce);
      return o.map(v => +v.toFixed(3));
    },
    poseIn(a) {
      if (!m || !m.remote || !Array.isArray(a) || !a.every(Number.isFinite)) return; const F = m.opp;
      if (GAMES[m.game].kind) { if (a.length >= 3) { F.depthT = clamp01(a[0]); F.score = Math.max(F.score, Math.min(999, a[1])); F.holding = !!a[2]; } return; }
      if (a.length < 19) return;
      [1, -1].forEach((s, i) => { F.goal[s].up.set(a[i * 6], a[i * 6 + 1], a[i * 6 + 2]).normalize(); F.goal[s].fore.set(a[i * 6 + 3], a[i * 6 + 4], a[i * 6 + 5]).normalize(); });
      const c = (v, lim) => Math.max(-lim, Math.min(lim, v));
      F.leanT.x = c(a[12], .4); F.leanT.yaw = c(a[13], .8); F.leanT.roll = c(a[14], .5); F.headT.yaw = c(a[15], 1); F.headT.pitch = c(a[16], .7); F.headT.roll = c(a[17], .7); F.bounce = c(a[18], .05);
    },
    hitIn(h) { if (m && m.remote && m.phase === 'play' && h && (h.zone === 'head' || h.zone === 'body')) hurt(m.mine, h.zone, !!h.blocked && h.zone === 'head', m.mine.headPos); }
  };
  return api;
}
