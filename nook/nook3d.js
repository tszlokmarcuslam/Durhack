// Nook 3D scenes. The avatars and the island are the anime character and the resting island made in Blender
// (anime/anime.js, built by character-test/tools in the 3D-models branch); the call room and globe are procedural.
import * as AN from './anime/anime.js';
const PI = Math.PI, TAU = PI * 2, sin = Math.sin, cos = Math.cos;

export const OPTIONS = AN.OPTIONS;   // { key: [choices] } for the avatar creator
export const PRESETS = AN.PRESETS;   // example looks, each with a .name

export function createNook(T, els, cb) {
  let seed = 7, alive = true, raf = 0;
  const rng = () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const mats = new Map();
  const M = (c, o) => { const k = c + (o ? JSON.stringify(o) : ''); if (!mats.has(k)) mats.set(k, new T.MeshStandardMaterial(Object.assign({ color: c, roughness: 1, flatShading: true }, o))); return mats.get(k); };
  const mix = (a, b, t) => '#' + new T.Color(a).lerp(new T.Color(b), t).getHexString();
  const sh = g => { g.userData.shared = true; return g; };
  const BOX = sh(new T.BoxGeometry(1, 1, 1)), ICO0 = sh(new T.IcosahedronGeometry(1, 0)), ICO1 = sh(new T.IcosahedronGeometry(1, 1)), OCT = sh(new T.OctahedronGeometry(1, 0));
  const CYL6 = sh(new T.CylinderGeometry(1, 1, 1, 6)), CYL8 = sh(new T.CylinderGeometry(1, 1, 1, 8)), CONE4 = sh(new T.ConeGeometry(1, 1, 4)), CONE6 = sh(new T.ConeGeometry(1, 1, 6)), CONE8 = sh(new T.ConeGeometry(1, 1, 8));
  const P = (par, g, mat, p, s, r) => { const me = new T.Mesh(g, mat); me.position.set(p[0], p[1], p[2]); if (s != null) Array.isArray(s) ? me.scale.set(s[0], s[1], s[2]) : me.scale.setScalar(s); if (r) me.rotation.set(r[0], r[1], r[2]); me.castShadow = me.receiveShadow = true; par.add(me); return me; };
  const G3 = (par, x, y, z, s) => { const g = new T.Group(); g.position.set(x, y, z); if (s) g.scale.setScalar(s); par.add(g); return g; };
  const frus = (y0, y1, a0, a1, sides, open, ts, tl) => { const g = new T.CylinderGeometry(1, 1, 1, sides || 8, 1, !!open, ts || 0, tl || TAU), p = g.attributes.position; for (let i = 0; i < p.count; i++) { const top = p.getY(i) > 0, a = top ? a1 : a0; p.setXYZ(i, p.getX(i) * a[0], top ? y1 : y0, p.getZ(i) * a[1]); } g.computeVertexNormals(); return g; };
  const disposeObj = o => o.traverse(m => { if (m.geometry && !m.geometry.userData.shared) m.geometry.dispose(); if (m.userData && m.userData.anime) A.dispose(m); });

  /* ================= avatar: the anime character (anime/anime.js) ================= */
  // Same parts as before for everything that poses avatars (tracking, calls, games): userData has body, head (its
  // centre), arms/elbows/legs/knees/feet by side (1 = the avatar's left, -1 = its right). The hand is 0.31 below the elbow.
  const A = AN.createAnime(T);
  const buildAvatar = (c, o) => A.buildAvatar(c || {}, o);
  const pose = A.pose;

  /* ================= avatar stage ================= */
  const sA = new T.Scene(); sA.add(new T.HemisphereLight('#FFF8EE', '#D9CDBB', 1.9));
  const keyA = new T.DirectionalLight('#FFF1DC', 2.5); keyA.position.set(2.5, 5, 4); keyA.castShadow = true; keyA.shadow.mapSize.set(1024, 1024); Object.assign(keyA.shadow.camera, { left: -1.6, right: 1.6, top: 2.4, bottom: -.6, near: .5, far: 14 }); keyA.shadow.normalBias = .01; sA.add(keyA);
  const rimA = new T.DirectionalLight('#FFE2C0', .9); rimA.position.set(-3, 3, -3); sA.add(rimA);
  const floorA = new T.Mesh(new T.CircleGeometry(1.3, 40).rotateX(-PI / 2), new T.ShadowMaterial({ opacity: .2 })); floorA.receiveShadow = true; sA.add(floorA);
  const camA = new T.PerspectiveCamera(24, 1, .1, 50), camH = new T.PerspectiveCamera(26, 1, .1, 20), camP = new T.PerspectiveCamera(26, 1, .1, 20);
  const headY = av => { av.updateMatrixWorld(true); return av.userData.head.getWorldPosition(new T.Vector3()).y; };
  const rA = new T.WebGLRenderer({ canvas: els.avatar, antialias: true, alpha: true, preserveDrawingBuffer: true }); rA.shadowMap.enabled = true;
  let stageAv = null, cfg = null, rotA = -.35, zoom = 0, zoomT = 0, wave = false, waveK = 0, mx = 0, my = 0, hx = 0, hy = 0, dragA = null;
  const pr = () => Math.min(window.devicePixelRatio || 1, 2);
  const sizeA = () => { const w = els.avatar.clientWidth, h = els.avatar.clientHeight; if (!w || !h) return; rA.setPixelRatio(pr()); rA.setSize(w, h, false); camA.aspect = camP.aspect = w / h; camA.updateProjectionMatrix(); camP.updateProjectionMatrix(); };
  const thumb = c => { const tmp = buildAvatar(c, { face: 256 }); A.pose(tmp, 0, {}); tmp.rotation.y = -.3; const hy = headY(tmp); camH.position.set(0, hy + .03, 1.34); camH.lookAt(0, hy - .01, 0); if (stageAv) stageAv.visible = false; floorA.visible = false; sA.add(tmp); rA.setPixelRatio(1); rA.setSize(128, 128, false); rA.render(sA, camH); let url = ''; try { const bin = atob(els.avatar.toDataURL().split(',')[1]), arr = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i); url = URL.createObjectURL(new Blob([arr], { type: 'image/png' })); } catch (er) {} sA.remove(tmp); disposeObj(tmp); if (stageAv) stageAv.visible = true; floorA.visible = true; sizeA(); return url; };

  /* ================= island: the big resting island (anime/anime.js) ================= */
  // House you can go into (bed, sofa, armchair by the fire), bench under a tree, hammock, campfire, dock, beach towels.
  // The sky follows the clock. world.js walks on it with kit.island (heights, things in the way, places to rest).
  const isl = new T.Scene(); isl.background = new T.Color('#bfe3ff'); isl.fog = new T.Fog('#bfe3ff', 90, 260);
  const ISL = A.buildIsland(isl);
  if (typeof window !== 'undefined') window.nookIsland = ISL;   // for checks in the console: nookIsland.setHour(13), nookIsland.setHour(null) = the clock
  const hAt = A.hAt, R = 15.5;
  const SHORE = Array.from({ length: 360 }, (_, i) => { const a = i / 360 * TAU; let r = 8; while (r < 21 && hAt(cos(a) * r, sin(a) * r) > .04) r += .05; return r; });
  const rAt = a => SHORE[((Math.round(a / TAU * 360) % 360) + 360) % 360] / R;   // where the sand meets the sea, as a share of R
  let orbit = .55, orbitOn = true, distI = 66;
  const camI = new T.PerspectiveCamera(30, 1, 1, 400);

  /* ================= call room (the other person's side of a call) ================= */
  const sC = new T.Scene(); sC.background = new T.Color('#EDE7DB'); sC.fog = new T.Fog('#EDE7DB', 7, 18);
  sC.add(new T.HemisphereLight('#FFF8EE', '#D9CDBB', 1.6));
  const keyC = new T.DirectionalLight('#FFF1DC', 2.3); keyC.position.set(1.8, 4.2, 4.5); keyC.castShadow = true; keyC.shadow.mapSize.set(1024, 1024); Object.assign(keyC.shadow.camera, { left: -3, right: 3, top: 3.5, bottom: -1, near: .5, far: 16 }); keyC.shadow.normalBias = .02; sC.add(keyC);
  const rimC = new T.DirectionalLight('#FFE2C0', .8); rimC.position.set(-3, 3, -2); sC.add(rimC);
  const roomG = new T.Group(); sC.add(roomG); // everything that makes up the room, so it can dissolve as one
  const wallC = new T.MeshStandardMaterial({ color: '#E7DCC8', roughness: 1, flatShading: true });
  const camC = new T.PerspectiveCamera(28, 1, .1, 40);
  const backOut = k => { const c = 1.70158; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
  let peer = null, peerOut = null, peerT0 = 0, peerHead = 1.68, camY = 1.48, talkUntil = 0, talkK = 0, globeK = 0, searching = false, shift = 0, shiftT = 0, cw = 0, ch = 0, track = null, myHead = 1.68;
  const trk = { yaw: 0, pitch: 0, roll: 0 };
  let arenaTick = null; // arena.js (1v1 boxing) runs inside the call scene through this hook
  // smoothed body tracking: arm directions in avatar space, body lean, and how much tracking is blended in (w)
  const DOWN = new T.Vector3(0, -1, 0), tv = new T.Vector3(), q1 = new T.Quaternion(), q2 = new T.Quaternion(), qB = new T.Quaternion();
  const limbS = () => ({ up: DOWN.clone(), fore: DOWN.clone(), w: 0 });
  const BT = { w: 0, yaw: 0, roll: 0, 1: limbS(), [-1]: limbS(), L: { 1: limbS(), [-1]: limbS() } };
  // Point a two-joint limb (shoulder/elbow or hip/knee) along tracked directions given in avatar space, blended by S.w.
  const aim = (S, a, root, joint, kb, kw) => {
    S.w += ((a ? a.w : 0) - S.w) * kw;
    if (a) { S.up.lerp(tv.fromArray(a.up), kb).normalize(); S.fore.lerp(tv.fromArray(a.fore), kb).normalize(); }
    if (S.w < .001) return;
    tv.copy(S.up).applyQuaternion(qB); q1.setFromUnitVectors(DOWN, tv); root.quaternion.slerp(q1, S.w);
    tv.copy(S.fore).applyQuaternion(qB).applyQuaternion(q2.copy(root.quaternion).invert()); q1.setFromUnitVectors(DOWN, tv); joint.quaternion.slerp(q1, S.w);
  };
  // the other person's live body tracking in a real call (already un-mirrored), smoothed the same way as yours
  let peerTrack = null, peerTrackAt = 0;
  const PT = { w: 0, yaw: 0, roll: 0, hy: 0, hp: 0, hr: 0, 1: limbS(), [-1]: limbS(), L: { 1: limbS(), [-1]: limbS() } };
  const flipLimb = l => l ? { up: [-l.up[0], l.up[1], l.up[2]], fore: [-l.fore[0], l.fore[1], l.fore[2]], w: l.w } : null;
  const livePeerTrack = () => peerTrack && performance.now() / 1000 - peerTrackAt < 1.5 ? peerTrack : null;
  let globe, globeM, ring; const pins = [];
  (function buildRoom() {
    seed = 31;
    const white = M('#F8F3E8'), glass = M('#BFD9D3', { roughness: .4 }), woodD = M('#8A6245'), greens = [M('#7E9A62'), M('#8BA56B'), M('#6F8C5A')];
    P(roomG, BOX, wallC, [0, 2.5, -1.7], [14, 6, .2]).castShadow = false;
    P(roomG, BOX, M('#DCCDB3'), [0, -.05, 0], [14, .1, 8]).castShadow = false;
    P(roomG, BOX, M('#D2C1A5'), [0, .08, -1.57], [14, .16, .06]);
    P(roomG, new T.CylinderGeometry(1, 1, 1, 40), M('#CDB993'), [0, .005, .1], [1.25, .02, .9]).castShadow = false;
    // arched window
    const half = r => new T.CylinderGeometry(r, r, .06, 24, 1, false, -PI / 2, PI).rotateX(-PI / 2);
    const w = G3(roomG, 1.5, 1.5, -1.57);
    P(w, BOX, white, [0, 0, 0], [1.1, 1.2, .06]); P(w, half(.55), white, [0, .6, 0]);
    P(w, BOX, glass, [0, -.02, .02], [.92, 1.08, .06]); P(w, half(.46), glass, [0, .52, .02]);
    P(w, BOX, white, [0, .12, .05], [.05, 1.5, .04]); P(w, BOX, white, [0, .08, .05], [.92, .05, .04]);
    P(w, BOX, white, [0, -.63, .1], [1.3, .07, .22]);
    P(w, CYL8, M('#C98A6E'), [.38, -.53, .1], [.08, .14, .08]); P(w, ICO0, greens[1], [.38, -.4, .1], .1, [.4, .2, 0]);
    // shelf with books
    const sh = G3(roomG, -1.55, 1.85, -1.5);
    P(sh, BOX, M('#B08C66'), [0, 0, 0], [1.2, .05, .26]);
    let bx = -.5; ['#5E683C', '#C08A3A', '#B9694C', '#5C5E78', '#E9E2D4', '#8A6245', '#A9B48A'].forEach((c, i) => { const bw = .05 + rng() * .04, bh = .2 + rng() * .1; P(sh, BOX, M(c), [bx + bw / 2, .025 + bh / 2, 0], [bw, bh, .18], [0, 0, i === 6 ? -.25 : 0]); bx += bw + .008; });
    P(sh, ICO1, M('#D8C4AE'), [.4, .11, 0], [.08, .1, .08]);
    // potted plant
    const pl = G3(roomG, -1.45, 0, -.85);
    P(pl, CYL8, M('#C98A6E'), [0, .2, 0], [.22, .4, .22]); P(pl, CYL8, M('#B97A5E'), [0, .41, 0], [.24, .04, .24]);
    [[0, .75, 0, .3], [.18, 1.02, .05, .24], [-.16, 1.08, -.04, .22], [.02, 1.3, 0, .2], [-.05, .58, .15, .2]].forEach((p, i) => P(pl, ICO0, greens[i % 3], [p[0], p[1], p[2]], p[3], [rng(), rng(), 0]));
    // floor lamp
    const lp = G3(roomG, 2.4, 0, -.7);
    P(lp, CYL8, woodD, [0, .02, 0], [.18, .04, .18]); P(lp, CYL6, woodD, [0, .8, 0], [.025, 1.6, .025]);
    P(lp, CYL8, M('#F3E3C2', { emissive: '#F6D9A0', emissiveIntensity: .55 }), [0, 1.66, 0], [.22, .28, .22]);
    const bulb = new T.PointLight('#FFD9A0', 2.2, 4.5, 1.6); bulb.position.set(2.4, 1.6, -.6); roomG.add(bulb);
    // globe shown while searching for someone
    globe = G3(sC, 0, 1.32, 0);
    const gg = new T.IcosahedronGeometry(.27, 3), gp = gg.attributes.position, gc = [], cc = new T.Color();
    for (let i = 0; i < gp.count; i += 3) {
      let x = 0, y = 0, z = 0; for (let k = 0; k < 3; k++) { x += gp.getX(i + k); y += gp.getY(i + k); z += gp.getZ(i + k); }
      const l = Math.hypot(x, y, z); x /= l; y /= l; z /= l;
      const n = sin(x * 3.1 + 1.3) * cos(y * 2.7 + .4) + sin(z * 4.3 + 2.1) * .6 + sin(x * 5.2 + z * 3.3) * .3;
      cc.set(Math.abs(y) > .88 ? '#F4F1EA' : n > .18 ? (n > .62 ? '#8FA26D' : '#A9B97D') : n < -.55 ? '#97BFBA' : '#A4C9C4');
      for (let k = 0; k < 3; k++) gc.push(cc.r, cc.g, cc.b);
    }
    gg.setAttribute('color', new T.Float32BufferAttribute(gc, 3)); gg.computeVertexNormals();
    globeM = new T.Mesh(gg, new T.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 })); globeM.castShadow = true; globe.add(globeM); globeM.rotation.z = .35;
    ring = new T.Mesh(new T.TorusGeometry(.4, .006, 6, 72), M('#5E683C')); ring.rotation.set(PI / 2 + .3, 0, 0); globe.add(ring);
    [[.3, .9], [1.4, -.2], [2.6, .4], [3.9, -.5], [5.1, .15]].forEach((a, i) => {
      const pin = G3(globeM, 0, 0, 0), d = new T.Vector3(cos(a[1]) * cos(a[0]), sin(a[1]), cos(a[1]) * sin(a[0]));
      pin.position.copy(d.clone().multiplyScalar(.27)); pin.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d);
      P(pin, CONE8, M(i % 2 ? '#5E683C' : '#B9694C'), [0, .035, 0], [.018, .07, .018], [PI, 0, 0]); P(pin, ICO1, M(i % 2 ? '#5E683C' : '#B9694C'), [0, .075, 0], .022);
      pins.push(pin);
    });
  })();

  /* ================= renderer, layout, input ================= */
  const rW = new T.WebGLRenderer({ canvas: els.world, antialias: true, preserveDrawingBuffer: true }); rW.shadowMap.enabled = true;
  let view = 'home', worldTick = null, frameHook = null;
  const LAY = {
    world: ['position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;cursor:grab', 'display:none'],
    home: ['position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none', 'position:absolute;right:3vw;bottom:84px;height:min(76vh,54vw);aspect-ratio:.72;display:block;pointer-events:none'],
    creator: ['display:none', 'position:absolute;left:0;top:0;width:calc(100% - min(440px,46vw) - 16px);height:100%;display:block;cursor:grab;touch-action:none'],
    scan: ['display:none', 'position:absolute;right:4vw;top:100px;height:calc(100% - 190px);aspect-ratio:.72;display:block;pointer-events:none'],
    call: ['position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none', 'position:absolute;right:24px;top:84px;width:clamp(116px,14vw,196px);aspect-ratio:.78;display:block;pointer-events:none;box-sizing:border-box;border-radius:24px;border:3px solid #FBF8F1;background:linear-gradient(180deg,#E9EBD8,#D6DBBF);box-shadow:0 12px 30px rgba(43,42,39,.18);transition:right .35s ease']
  };
  const sizeAll = () => { const w = els.root.clientWidth, h = els.root.clientHeight; if (!w || !h) return; rW.setPixelRatio(pr()); rW.setSize(w, h, false); cw = w; ch = h; camC.aspect = w / h; camC.updateProjectionMatrix(); camI.aspect = w / h; camI.setViewOffset(w, h, w * .08, h * .1, w, h); camI.updateProjectionMatrix(); distI = 66 * Math.max(1, 1.5 / (w / h)) * (h < 700 ? 1.15 : 1.05); sizeA(); };
  const ro = new ResizeObserver(sizeAll); ro.observe(els.root);
  const onMove = e => { mx = e.clientX / window.innerWidth * 2 - 1; my = e.clientY / window.innerHeight * 2 - 1; if (dragA) rotA = dragA.r + (e.clientX - dragA.x) * .01; };
  const onUp = () => { dragA = null; if (view === 'creator') els.avatar.style.cursor = 'grab'; };
  const onDownA = e => { if (view !== 'creator') return; dragA = { x: e.clientX, r: rotA }; els.avatar.style.cursor = 'grabbing'; };
  window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp); els.avatar.addEventListener('pointerdown', onDownA);

  /* ================= loop ================= */
  let last = performance.now() / 1000;
  const tick = now => {
    if (!alive) return; raf = requestAnimationFrame(tick);
    const t = now / 1000, dt = Math.min(window.nookMaxStep || .05, t - last); last = t;   // nookMaxStep: tests in a slow browser can take bigger steps
    if (frameHook) frameHook(t, dt, view);   // the companion robot (bot.js) moves before anything is drawn
    if (view === 'home' || view === 'world') {   // the world is the same island, seen from the ground (world.js draws it)
      if (orbitOn && view === 'home') orbit += dt * .025;
      const e = .62; camI.position.set(distI * cos(e) * sin(orbit), distI * sin(e), distI * cos(e) * cos(orbit)); camI.lookAt(0, .5, 0);
      ISL.update(t, dt);
      if (view === 'world' && worldTick) worldTick(t, dt); else rW.render(isl, camI);
    }
    if (view === 'call') {
      const e = Math.min(1, dt * 6);
      shift += (shiftT - shift) * e; camY += (peerHead - .15 - camY) * e;
      camC.position.set(0, camY, 3.4); camC.lookAt(0, camY - .2, 0);
      if (cw) { camC.setViewOffset(cw, ch, shift, 0, cw, ch); camC.updateProjectionMatrix(); }
      globeK += ((searching ? 1 : 0) - globeK) * e;
      globe.visible = globeK > .01; globe.scale.setScalar(Math.max(.001, globeK)); globe.position.y = camY - .17 + sin(t * 1.3) * .02;
      globeM.rotation.y += dt * .6; ring.rotation.z += dt * .25;
      pins.forEach((p, i) => p.scale.setScalar(.75 + .45 * Math.max(0, sin(t * 2.4 + i * 1.3))));
      if (peerOut) { peerOut.k += dt / .3; peerOut.g.scale.setScalar(Math.max(.001, 1 - peerOut.k * peerOut.k)); if (peerOut.k >= 1) { sC.remove(peerOut.g); disposeObj(peerOut.g); peerOut = null; } }
      if (peer) {
        const age = t - peerT0, u = peer.userData;
        peer.scale.setScalar(Math.max(.001, backOut(Math.min(1, age / .6))));
        talkK += ((t < talkUntil ? 1 : 0) - talkK) * Math.min(1, dt * 5);
        u.wv = (u.wv || 0) + ((age > .35 && age < 2.4 ? 1 : 0) - (u.wv || 0)) * Math.min(1, dt * 8);
        // a real person: their head, arms, legs and lean come from their camera; otherwise a friendly idle
        const rp = livePeerTrack(), hd = rp && rp.head, bd = rp && rp.body;
        const kt = Math.min(1, dt * 10), kb = Math.min(1, dt * 12), kw = Math.min(1, dt * 5);
        PT.hy += ((hd ? hd.yaw : 0) - PT.hy) * kt; PT.hp += ((hd ? hd.pitch : 0) - PT.hp) * kt; PT.hr += ((hd ? hd.roll : 0) - PT.hr) * kt;
        PT.w += ((bd ? 1 : 0) - PT.w) * kw; PT.yaw += ((bd ? bd.yaw : 0) - PT.yaw) * kb; PT.roll += ((bd ? bd.roll : 0) - PT.roll) * kb;
        const by = PT.yaw * .8 * PT.w, br = PT.roll * .7 * PT.w, nod = talkK * (sin(t * 6.5) * .06 + .02);
        peer.rotation.y = rp ? 0 : sin(t * .23) * .1;
        pose(peer, t, hd
          ? { wave: bd ? 0 : u.wv, lookX: PT.hy - by, pitch: PT.hp + nod * .5, roll: PT.hr - br }
          : { wave: bd ? 0 : u.wv, lookX: sin(t * .37) * .14 + talkK * sin(t * 2.9) * .07, pitch: sin(t * .53) * .04 + nod, roll: sin(t * .29) * .05 });
        u.body.rotation.set(0, by, br);
        if (bd || PT[1].w > .001 || PT[-1].w > .001 || PT.L[1].w > .001 || PT.L[-1].w > .001) {
          qB.copy(u.body.quaternion).invert();
          [1, -1].forEach(s => { aim(PT[s], bd && bd.arms[s], u.arms[s], u.elbows[s], kb, kw); aim(PT.L[s], bd && bd.legs && bd.legs[s], u.legs[s], u.knees[s], kb, kw); });
          const legW = Math.max(PT.L[1].w, PT.L[-1].w);
          if (legW > .001) { peer.updateMatrixWorld(true); const low = Math.min(u.feet[1].getWorldPosition(tv).y, u.feet[-1].getWorldPosition(tv).y) - peer.position.y; u.body.position.y -= low * legW; }
        }
      }
      if (arenaTick) arenaTick(t, dt); // may re-pose the avatars, move the camera and swap the room for the ring
      rW.render(sC, camC);
    }
    if (stageAv) {
      const live = view === 'home' || view === 'call' || view === 'scan', inCall = view === 'call', u = stageAv.userData;
      const hd = live && track ? track.head : null, bd = live && track ? track.body : null, tracking = !!(hd || bd);
      waveK += ((wave && live && !bd ? 1 : 0) - waveK) * Math.min(1, dt * 8); zoom += (zoomT - zoom) * Math.min(1, dt * 5);
      hx += (mx - hx) * Math.min(1, dt * 4); hy += (my - hy) * Math.min(1, dt * 4);
      const kt = Math.min(1, dt * 12), kb = Math.min(1, dt * 14), kw = Math.min(1, dt * 6);
      trk.yaw += ((hd ? hd.yaw : 0) - trk.yaw) * kt; trk.pitch += ((hd ? hd.pitch : 0) - trk.pitch) * kt; trk.roll += ((hd ? hd.roll : 0) - trk.roll) * kt;
      BT.w += ((bd ? 1 : 0) - BT.w) * kw; BT.yaw += ((bd ? bd.yaw : 0) - BT.yaw) * kb; BT.roll += ((bd ? bd.roll : 0) - BT.roll) * kb;
      // face the camera like a mirror while tracking; otherwise the home avatar stands three-quarter on
      if (live) rotA += ((inCall || tracking || view === 'scan' ? 0 : -.35) - rotA) * Math.min(1, dt * 3);
      const turn = live ? (tracking ? (hd ? trk.yaw * .3 * (1 - BT.w) : 0) : hx * .1) : 0, by = BT.yaw * .8 * BT.w, br = BT.roll * .7 * BT.w;
      stageAv.rotation.y = rotA + turn;
      pose(stageAv, t, { wave: waveK, lookX: hd ? trk.yaw - turn - by : live ? hx * (inCall ? .35 : .25) : 0, lookY: live ? hy : 0, pitch: hd ? trk.pitch : null, roll: hd ? trk.roll - br : 0 });
      u.body.rotation.set(0, by, br);
      if (bd || BT[1].w > .001 || BT[-1].w > .001 || BT.L[1].w > .001 || BT.L[-1].w > .001) {
        qB.copy(u.body.quaternion).invert();
        [1, -1].forEach(s => {
          aim(BT[s], bd && bd.arms[s], u.arms[s], u.elbows[s], kb, kw);
          aim(BT.L[s], bd && bd.legs && bd.legs[s], u.legs[s], u.knees[s], kb, kw);
        });
        // bent knees would lift the feet off the floor: lower the body so the lowest sole touches the ground
        const legW = Math.max(BT.L[1].w, BT.L[-1].w);
        if (legW > .001) {
          stageAv.updateMatrixWorld(true);
          const low = Math.min(u.feet[1].getWorldPosition(tv).y, u.feet[-1].getWorldPosition(tv).y) - stageAv.position.y;
          u.body.position.y -= low * legW;
        }
      }
      // in a call, your tile widens from head-and-shoulders to waist-up once your arms are tracked
      if (inCall) { const bw = BT.w; camP.position.set(0, myHead - .08 - bw * .3, 1.8 + bw * 1.4); camP.lookAt(0, myHead - .14 - bw * .26, 0); rA.render(sA, camP); }
      else { const z = view === 'creator' ? zoom : 0; camA.position.set(0, 1.02 + z * (myHead + .06 - 1.02), 4.95 - z * 2.45); camA.lookAt(0, .94 + z * (myHead + .03 - .94), 0); rA.render(sA, camA); }
    }
  };

  const api = {
    setAvatar(c) {
      cfg = c; if (stageAv) { sA.remove(stageAv); disposeObj(stageAv); } stageAv = buildAvatar(c, { face: 1024 }); myHead = headY(stageAv); sA.add(stageAv);
      cb.onAvatar && cb.onAvatar(thumb(c));
    },
    // Call: show the matched person's avatar (null = they left). tint recolours the room wall.
    setPeer(c, tint) {
      if (peer) { if (peerOut) { sC.remove(peerOut.g); disposeObj(peerOut.g); } peerOut = { g: peer, k: 0 }; peer = null; }
      peerTrack = null; PT.w = PT[1].w = PT[-1].w = PT.L[1].w = PT.L[-1].w = 0;
      if (c) { peer = buildAvatar(c); peerHead = headY(peer); peer.scale.setScalar(.001); sC.add(peer); peerT0 = performance.now() / 1000; talkUntil = 0; if (tint) wallC.color.set(tint); }
    },
    setSearching(on) { searching = !!on; },
    // For arena.js: the call scene and the helpers it needs to build the ring and drive the fighters.
    callKit() {
      return {
        T, sC, camC, roomG, keyC, renderer: rW, root: els.root, avatarCanvas: els.avatar,
        P, G3, M, BOX, CYL6, CYL8, ICO0, ICO1, CONE8, buildAvatar, pose, disposeObj,
        view: () => view, getPeer: () => peer, getMe: () => stageAv, getCfg: () => cfg, getTrack: () => track, getPeerTrack: livePeerTrack
      };
    },
    setArenaTick(fn) { arenaTick = fn; },
    // Real calls: the other person's tracking as they sent it (their mirror view). Flipped here so you see them
    // as if facing them: their right hand is their avatar's right hand. null = no tracking from them.
    setPeerTrack(p) {
      if (!p) { peerTrack = null; return; }
      const b = p.body;
      peerTrack = {
        head: p.head ? { yaw: -p.head.yaw, pitch: p.head.pitch, roll: -p.head.roll } : null,
        body: b ? { yaw: -b.yaw, roll: -b.roll, arms: { 1: flipLimb(b.arms[-1]), [-1]: flipLimb(b.arms[1]) }, legs: b.legs ? { 1: flipLimb(b.legs[-1]), [-1]: flipLimb(b.legs[1]) } : null } : null
      };
      peerTrackAt = performance.now() / 1000;
    },
    peerTalk(sec) { talkUntil = performance.now() / 1000 + sec; },
    setCallShift(px) { shiftT = px; },
    setPip(right) { if (view === 'call') els.avatar.style.right = right + 'px'; },
    // Webcam tracking: { head: { yaw, pitch, roll } | null, body: { arms, yaw, roll } | null }, or null to hand control back to the mouse.
    setTrack(p) { track = p; },
    thumb(c) { return thumb(c); },
    // avatarCss optionally overrides where your avatar canvas sits (the body-scan screen sizes it to the window)
    setView(v, avatarCss) { view = v; els.world.style.cssText = LAY[v][0]; els.avatar.style.cssText = avatarCss || LAY[v][1]; sizeAll(); },
    setZoom(z) { zoomT = z; },
    setOrbit(on) { orbitOn = on; },
    // The walkable world (world.js) borrows the island, the avatars and the renderer, and draws each frame while view is 'world'.
    kit: { isl, hAt, rAt, R, buildAvatar, pose, disposeObj, renderer: rW, track: () => track, stage: { canvas: els.avatar }, anime: A, island: ISL },   // track: the latest webcam pose, for the island games
    setWorldTick(fn) { worldTick = fn; },
    setFrameHook(fn) { frameHook = fn; },   // called once a frame with (t, dt, view)
    wave(on) { wave = on; },
    dispose() { alive = false; cancelAnimationFrame(raf); ro.disconnect(); window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); els.avatar.removeEventListener('pointerdown', onDownA); rW.dispose(); rA.dispose(); }
  };
  cb.onPresets && cb.onPresets(PRESETS.map(thumb));
  raf = requestAnimationFrame(tick);
  return api;
}
