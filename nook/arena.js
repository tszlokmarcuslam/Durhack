// Nook call arena: challenge the person you're calling to a 1v1.
// The room dissolves top-down into green code (Matrix-style), a boxing ring builds up around you both,
// and your body tracking throws the punches. Both characters stay where they are while the world changes.
// Runs inside nook3d's call scene: nook.callKit() gives the scene and helpers, nook.setArenaTick() runs it each frame.
//
// createArena(nook, cb) -> api
//   cb.onPeerClick(x, y)  the other person's avatar was clicked (screen px), outside a match
//   cb.onReady()          the ring is built and both fighters face each other
//   cb.onGone()           back in the room after leaving the ring
//   cb.onPunch(side)      a punch thrown with your real arms (tracked); side 1 / -1 = avatar's left / right arm
export function createArena(nook, cb) {
  const K = nook.callKit(), { T, sC, camC, roomG, P, CYL6, CYL8, BOX, ICO0, M } = K;
  const PI = Math.PI, sin = Math.sin;
  const clamp01 = v => Math.max(0, Math.min(1, v)), smooth = k => k * k * (3 - 2 * k);
  const easeOut = k => 1 - (1 - k) * (1 - k);
  const RING_X = -.45, ME_X = -.9, END = 4.1;

  /* ---------- green-wireframe dissolve ---------- */
  const lineMat = new T.LineBasicMaterial({ color: '#5CF08E', transparent: true, opacity: .9, fog: false });
  const HIDE = new T.MeshBasicMaterial({ visible: false });
  const edgeCache = new Map();
  const edgesOf = g => { if (!edgeCache.has(g.uuid)) edgeCache.set(g.uuid, new T.EdgesGeometry(g, 25)); return edgeCache.get(g.uuid); };
  function prepDissolve(group) {
    const list = [];
    group.updateMatrixWorld(true);
    const box = new T.Box3();
    group.traverse(o => {
      if (!o.isMesh || o.userData.noDissolve) return;
      box.setFromObject(o);
      const e = new T.LineSegments(edgesOf(o.geometry), lineMat); e.visible = false; e.userData.noDissolve = true; o.add(e);
      list.push({ m: o, mat: o.material, e, y: (box.min.y + box.max.y) / 2, state: 'solid' });
    });
    return list;
  }
  const setItem = (it, st) => {
    if (st === 'wire') it.e.visible = Math.random() > .18; // flicker
    if (it.state === st) return; it.state = st;
    it.m.material = st === 'solid' ? it.mat : HIDE; it.e.visible = st === 'wire';
  };
  // 'out': the scan line moves down and everything above it turns to wire, then vanishes.
  // 'in' : the scan line moves up and everything below it appears as wire, then turns solid.
  const dissolve = (list, scanY, mode) => list.forEach(it => {
    const d = mode === 'out' ? it.y - scanY : scanY - it.y;
    setItem(it, mode === 'out' ? (d > .7 ? 'gone' : d > 0 ? 'wire' : 'solid') : (d > .6 ? 'solid' : d > 0 ? 'wire' : 'gone'));
  });
  const allTo = (list, st) => list.forEach(it => setItem(it, st));

  /* ---------- code rain ---------- */
  const GLYPHS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホ0123456789';
  const glyphTex = () => {
    const c = document.createElement('canvas'); c.width = 64; c.height = 1024;
    const g = c.getContext('2d'); g.font = 'bold 38px monospace'; g.textAlign = 'center';
    for (let i = 0; i < 24; i++) { const a = i / 23; g.fillStyle = i === 23 ? '#EAFFF0' : `rgba(92,240,142,${(a * a * .95 + .05).toFixed(3)})`; g.fillText(GLYPHS[Math.floor(Math.random() * GLYPHS.length)], 32, 38 + i * 42); }
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
  };
  const rainMats = [0, 1, 2].map(() => new T.MeshBasicMaterial({ map: glyphTex(), transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, fog: false, side: T.DoubleSide }));
  const rainGeo = new T.PlaneGeometry(.1, 1.8);
  const rain = new T.Group(); rain.visible = false; sC.add(rain);
  for (let i = 0; i < 80; i++) {
    const front = i < 10, m = new T.Mesh(rainGeo, rainMats[i % 3]);
    m.position.set(RING_X + (Math.random() - .5) * 7, Math.random() * 5 - 1, front ? .9 + Math.random() * .9 : -1.6 + Math.random() * 1.3);
    m.userData.v = 1.6 + Math.random() * 2.4; m.userData.noDissolve = true; rain.add(m);
  }

  /* ---------- the boxing ring ---------- */
  const ringG = new T.Group(); ringG.position.x = RING_X; ringG.visible = false; sC.add(ringG);
  (function buildRing() {
    const canvas = M('#EFE8DA'), apron = M('#5E683C'), lip = M('#4E5733'), rope = M('#F4EEE2'), steel = M('#8C8780'), floor = M('#26231F');
    P(ringG, BOX, floor, [0, -.55, 0], [18, .1, 14]);
    P(ringG, BOX, apron, [0, -.26, 0], [3.9, .5, 3.0]);
    P(ringG, BOX, lip, [0, -.03, 0], [3.95, .06, 3.05]);
    P(ringG, BOX, canvas, [0, -.012, 0], [3.7, .025, 2.8]);
    P(ringG, new T.CylinderGeometry(1, 1, 1, 32), apron, [0, .002, 0], [.42, .006, .42]);
    P(ringG, new T.CylinderGeometry(1, 1, 1, 32), canvas, [0, .004, 0], [.3, .006, .3]);
    [[1.75, 1.3, '#B9694C'], [-1.75, -1.3, '#5C5E78'], [1.75, -1.3, '#E9E2D4'], [-1.75, 1.3, '#E9E2D4']].forEach(([x, z, c]) => {
      P(ringG, CYL8, steel, [x, .62, z], [.05, 1.24, .05]); P(ringG, BOX, M(c), [x, .7, z], [.12, .8, .12]);
    });
    [.38, .7, 1.02].forEach(y => {
      [1.3, -1.3].forEach(z => P(ringG, CYL6, rope, [0, y, z], [.016, 3.5, .016], [0, 0, PI / 2]));
      [1.75, -1.75].forEach(x => P(ringG, CYL6, rope, [x, y, 0], [.016, 2.6, .016], [PI / 2, 0, 0]));
    });
    // crowd in the dark
    const crowd = ['#3A3530', '#443D36', '#2F2B27', '#4A4038'].map(c => M(c));
    for (let row = 0; row < 3; row++) for (let i = 0; i < 16; i++) {
      const x = -5.6 + i * .75 + (row % 2) * .35 + (Math.random() - .5) * .2, z = -3.1 - row * .75, y = -.15 + row * .3;
      P(ringG, ICO0, crowd[(i + row) % 4], [x, y, z], [.24, .32, .22]); P(ringG, ICO0, crowd[(i + row + 1) % 4], [x, y + .42, z], .13);
      if (Math.random() < .12) P(ringG, BOX, M('#FFF3C4', { emissive: '#FFF3C4', emissiveIntensity: 1 }), [x + .1, y + .3, z + .2], [.04, .07, .01]);
    }
    const spot = new T.SpotLight('#FFF4DE', 45, 14, .55, .6, 1.4); spot.position.set(0, 5.5, 1.4); spot.target.position.set(0, 0, 0); ringG.add(spot, spot.target);
    const cone = new T.Mesh(new T.ConeGeometry(1.7, 4.4, 28, 1, true), new T.MeshBasicMaterial({ color: '#FFF4DE', transparent: true, opacity: .05, depthWrite: false, fog: false, side: T.DoubleSide }));
    cone.position.set(0, 2.2, .2); cone.userData.noDissolve = true; ringG.add(cone);
  })();
  let roomList = null; const ringList = prepDissolve(ringG);

  /* ---------- beam that brings your avatar in ---------- */
  const beam = new T.Mesh(new T.CylinderGeometry(.38, .38, 2.3, 28, 1, true), new T.MeshBasicMaterial({ color: '#5CF08E', transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, fog: false, side: T.DoubleSide }));
  beam.position.set(ME_X, 1.15, 0); beam.visible = false; sC.add(beam);

  /* ---------- hover ring + hit sparks ---------- */
  const hover = new T.Mesh(new T.RingGeometry(.34, .42, 48).rotateX(-PI / 2), new T.MeshBasicMaterial({ color: '#5E683C', transparent: true, opacity: 0, depthWrite: false }));
  hover.position.y = .012; sC.add(hover);
  const sparks = Array.from({ length: 10 }, () => { const s = new T.Mesh(new T.IcosahedronGeometry(1, 0), new T.MeshBasicMaterial({ color: '#FFF6C8', transparent: true, opacity: 0, depthWrite: false, fog: false })); s.visible = false; sC.add(s); return s; });
  let sparkT = -9; const sparkAt = new T.Vector3();

  /* ---------- fighter posing ---------- */
  const DOWN = new T.Vector3(0, -1, 0), v = new T.Vector3(), qa = new T.Quaternion(), qi = new T.Quaternion(), qb = new T.Quaternion();
  function armTo(av, s, up, fore, w) {
    if (w < .001) return;
    const u = av.userData; qb.copy(u.body.quaternion).invert();
    v.set(up[0], up[1], up[2]).normalize().applyQuaternion(qb); qa.setFromUnitVectors(DOWN, v); u.arms[s].quaternion.slerp(qa, w);
    v.set(fore[0], fore[1], fore[2]).normalize().applyQuaternion(qb).applyQuaternion(qi.copy(u.arms[s].quaternion).invert()); qa.setFromUnitVectors(DOWN, v); u.elbows[s].quaternion.slerp(qa, w);
  }
  const GUARD = s => [[s * .12, -.55, .82], [-s * .32, .9, .22]];
  const PUNCH = s => [[-s * .1, .06, 1], [-s * .06, .04, 1]];
  const WIND = s => [[s * .25, -.7, .25], [-s * .15, .85, .5]];
  const WIN = s => [[s * .35, .94, 0], [s * .08, 1, 0]];
  // punch envelope: out fast, short hold, back
  const punchK = dt => dt < 0 ? 0 : dt < .09 ? dt / .09 : dt < .15 ? 1 : dt < .3 ? 1 - (dt - .15) / .15 : 0;
  const hitK = dt => dt < 0 || dt > .4 ? 0 : Math.pow(1 - dt / .4, 2);

  // copy your live (tracked) pose from the avatar in your call tile onto your fighter
  const JOINTS = ['body', 'head'];
  function copyPose(src, dst) {
    const a = src.userData, b = dst.userData;
    JOINTS.forEach(k => { b[k].quaternion.copy(a[k].quaternion); b[k].position.copy(a[k].position); });
    [1, -1].forEach(s => { b.arms[s].quaternion.copy(a.arms[s].quaternion); b.elbows[s].quaternion.copy(a.elbows[s].quaternion); b.legs[s].quaternion.copy(a.legs[s].quaternion); b.knees[s].quaternion.copy(a.knees[s].quaternion); });
  }

  /* ---------- state ---------- */
  let me = null, T_ = 0, dir = 0, readySent = true, fight = false, ko = null, winner = null, koT = 0;
  let peerFace0 = 0, keyGuard = false, peerGuard = false, tGuard = false, guardMe = 0, guardPeer = 0, trackedW = 0, shake = 0;
  const myAct = { 1: -9, [-1]: -9 }, peerAct = { s: 1, t0: -9 }, hitAt = { me: -9, peer: -9 }, P_ = { 1: { armed: -9, last: -9 }, [-1]: { armed: -9, last: -9 } };
  const now = () => performance.now() / 1000;
  const roomBg = new T.Color('#EDE7DB'), MATRIX = new T.Color('#04110A'), ARENA = new T.Color('#1B1814'), tmpC = new T.Color();
  const hemi = sC.children.find(o => o.isHemisphereLight), hemiI = hemi ? hemi.intensity : 1.6;
  const camA = new T.Vector3(), camB = new T.Vector3(), lookA = new T.Vector3(), lookB = new T.Vector3(RING_X, .95, 0);
  const wv = new T.Vector3(), sv = new T.Vector3(), WR = new T.Vector3(0, -.31, 0);

  // where your real hand is relative to your shoulder, from the tracked avatar (forward = towards the camera)
  function reach(stage, s) {
    const u = stage.userData; stage.updateMatrixWorld(true);
    wv.copy(WR); u.elbows[s].localToWorld(wv); stage.worldToLocal(wv);
    u.arms[s].getWorldPosition(sv); stage.worldToLocal(sv);
    return { z: (wv.z - sv.z) / .6, y: wv.y - sv.y };
  }

  /* ---------- picking the other person ---------- */
  const ray = new T.Raycaster(), ndc = new T.Vector2();
  let hovering = false;
  const pickPeer = e => {
    const peer = K.getPeer(); if (!peer || K.view() !== 'call' || T_ > 0 || dir) return false;
    const r = K.root.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camC); return ray.intersectObject(peer, true).length > 0;
  };
  const onMove = e => { if (e.target !== K.root) { if (hovering) { hovering = false; K.root.style.cursor = ''; } return; } const h = pickPeer(e); if (h !== hovering) { hovering = h; K.root.style.cursor = h ? 'pointer' : ''; } };
  const onClick = e => { if (e.target === K.root && pickPeer(e)) cb.onPeerClick && cb.onPeerClick(e.clientX, e.clientY); };
  K.root.addEventListener('pointermove', onMove); K.root.addEventListener('click', onClick);

  /* ---------- per-frame ---------- */
  let lastT = 0;
  function tick(t, frameDt) {
    // use real elapsed time (the scene's dt is capped per frame), so the transformation takes ~4 s even on a slow machine
    const dt = Math.min(.25, lastT ? t - lastT : frameDt); lastT = t;
    const peer = K.getPeer(), stage = K.getMe();
    hover.visible = !!peer && !T_ && !dir;
    if (hover.visible) { hover.position.x = peer.position.x; hover.material.opacity += ((hovering ? .85 : 0) - hover.material.opacity) * Math.min(1, dt * 10); hover.scale.setScalar(1 + sin(t * 4) * .03); }
    if (!dir && !T_) return;

    T_ = Math.max(0, Math.min(END, T_ + dt * dir * (dir < 0 ? 1.5 : 1)));
    const ph = (a, b) => clamp01((T_ - a) / (b - a));
    const beamK = ph(0, .7), camK = smooth(ph(0, 1.1)), outK = ph(.6, 2.2), inK = ph(2.2, 3.6), faceK = smooth(ph(3.6, 4.1));
    const rainK = ph(.6, 1.2) - ph(3.0, 3.8), matrixK = smooth(ph(.6, 1.6)), arenaK = smooth(ph(2.4, 3.6));

    // the room dissolves, the ring builds
    if (!roomList) roomList = prepDissolve(roomG);
    roomG.visible = outK < 1;
    if (outK <= 0) allTo(roomList, 'solid'); else if (outK < 1) dissolve(roomList, 3.4 - outK * 3.8, 'out');
    ringG.visible = inK > 0;
    if (inK >= 1) allTo(ringList, 'solid'); else if (inK > 0) dissolve(ringList, -.7 + inK * 3.4, 'in');
    rain.visible = rainK > .01; rainMats.forEach(m => { m.opacity = rainK * .95; });
    if (rain.visible) rain.children.forEach(m => { m.position.y -= m.userData.v * dt; if (m.position.y < -1.4) m.position.y = 4.6; });
    tmpC.copy(roomBg).lerp(MATRIX, matrixK).lerp(ARENA, arenaK); sC.background.copy(tmpC); sC.fog.color.copy(tmpC);
    sC.fog.near = 7 + arenaK * 3; sC.fog.far = 18 + arenaK * 10;
    if (hemi) hemi.intensity = hemiI * (1 - matrixK * .55 + arenaK * .2);
    K.avatarCanvas.style.opacity = String(1 - camK);

    // camera: from the call close-up to a side-on two-shot of the ring
    camA.copy(camC.position); camC.getWorldDirection(lookA).multiplyScalar(3.4).add(camA);
    camB.set(RING_X, 1.05, 4.6);
    camC.position.lerpVectors(camA, camB, camK);
    shake *= Math.exp(-dt * 9);
    camC.position.x += (Math.random() - .5) * shake; camC.position.y += (Math.random() - .5) * shake;
    camC.lookAt(lookA.lerp(lookB, camK));
    camC.clearViewOffset(); camC.updateProjectionMatrix();

    // you beam in next to them
    beam.visible = beamK > 0 && beamK < 1; beam.material.opacity = sin(beamK * PI) * .5;
    if (me) {
      me.visible = beamK > 0;
      me.scale.set(1, Math.max(.001, easeOut(beamK)), 1);
      if (stage) copyPose(stage, me);
      const track = K.getTrack(), armsTracked = !!(track && track.body && (track.body.arms[1].w > .5 || track.body.arms[-1].w > .5));
      trackedW += ((armsTracked ? 1 : 0) - trackedW) * Math.min(1, dt * 6);
      const fk = faceK;
      // tracked punches + guard
      tGuard = false;
      if (armsTracked && stage && fight) {
        const r = { 1: reach(stage, 1), [-1]: reach(stage, -1) };
        [1, -1].forEach(s => {
          const p = P_[s], z = r[s].z;
          if (z < .35) p.armed = t;
          else if (z > .72 && t - p.armed < .6 && t - p.last > .3) { p.last = t; p.armed = -9; cb.onPunch && cb.onPunch(s); }
        });
        tGuard = [1, -1].every(s => r[s].y > -.12 && r[s].z > .05 && r[s].z < .45);
      }
      guardMe += (((keyGuard || tGuard) && !armsTracked ? 1 : 0) - guardMe) * Math.min(1, dt * 14);
      const stance = fk * (1 - trackedW);
      [1, -1].forEach(s => {
        const g = GUARD(s); armTo(me, s, g[0], g[1], Math.max(stance * .75, guardMe));
        const pk = punchK(t - myAct[s]); if (pk > 0) { const p = PUNCH(s); armTo(me, s, p[0], p[1], pk); }
        if (winner === 'me') { const w = WIN(s); armTo(me, s, w[0], w[1], 1); }
      });
      if (stance > 0) me.userData.body.position.y += Math.abs(sin(t * 5.5)) * .018 * stance;
      me.position.x = ME_X - hitK(t - hitAt.me) * .09;
      me.rotation.order = 'YXZ'; me.rotation.y = fk * PI / 2;
      me.rotation.x = ko === 'me' ? -1.25 * easeOut(clamp01((t - koT) / .5)) : -hitK(t - hitAt.me) * .18;
    }
    if (peer) {
      peer.rotation.order = 'YXZ';
      peer.rotation.y = peerFace0 + (-PI / 2 - peerFace0) * faceK;
      if (faceK > 0) {
        // a real opponent moves with their own camera (posed by the call scene); only fill in what isn't tracked
        const remote = K.getPeerTrack ? K.getPeerTrack() : null, rb = remote && remote.body;
        const rArms = !!(rb && rb.arms && ((rb.arms[1] && rb.arms[1].w > .5) || (rb.arms[-1] && rb.arms[-1].w > .5)));
        if (!remote) K.pose(peer, t, { wave: 0, lookX: 0, pitch: sin(t * .9) * .03, roll: 0 });
        guardPeer += ((peerGuard ? 1 : 0) - guardPeer) * Math.min(1, dt * 14);
        const pd = t - peerAct.t0;
        [1, -1].forEach(s => {
          const g = GUARD(s); if (!rArms) armTo(peer, s, g[0], g[1], Math.max(faceK * .75, guardPeer));
          if (!rArms && s === peerAct.s && pd >= 0 && pd < .55) {
            if (pd < .25) { const w = WIND(s); armTo(peer, s, w[0], w[1], pd / .25); }
            else { const p = PUNCH(s); armTo(peer, s, p[0], p[1], punchK(pd - .25)); }
          }
          if (winner === 'peer') { const w = WIN(s); armTo(peer, s, w[0], w[1], 1); }
        });
        peer.userData.body.position.y += Math.abs(sin(t * 5.2 + 1)) * .018 * faceK;
      }
      peer.position.x = hitK(t - hitAt.peer) * .09;
      peer.rotation.x = ko === 'peer' ? -1.25 * easeOut(clamp01((t - koT) / .5)) : -hitK(t - hitAt.peer) * .18;
    }

    // sparks where a punch lands
    const sk = t - sparkT;
    sparks.forEach((s, i) => {
      s.visible = sk < .3; if (!s.visible) return;
      const a = i / sparks.length * PI * 2, r = .05 + sk * .9;
      s.position.set(sparkAt.x + Math.cos(a) * r * .4, sparkAt.y + Math.sin(a) * r, sparkAt.z + Math.cos(a * 1.7) * r * .3);
      s.scale.setScalar(.035 * (1 - sk / .3) + .005); s.material.opacity = 1 - sk / .3;
    });

    if (dir > 0 && T_ >= END && !readySent) { readySent = true; cb.onReady && cb.onReady(); }
    if (dir < 0 && T_ <= 0) finishLeave();
  }
  nook.setArenaTick(tick);

  function finishLeave() {
    dir = 0; T_ = 0; fight = false; ko = null; winner = null;
    if (roomList) allTo(roomList, 'solid'); roomG.visible = true; ringG.visible = false; rain.visible = false; beam.visible = false;
    sC.background.copy(roomBg); sC.fog.color.copy(roomBg); sC.fog.near = 7; sC.fog.far = 18; if (hemi) hemi.intensity = hemiI;
    K.avatarCanvas.style.opacity = '1';
    if (me) { sC.remove(me); K.disposeObj(me); me = null; }
    const peer = K.getPeer(); if (peer) { peer.rotation.set(0, 0, 0); peer.rotation.order = 'XYZ'; peer.position.x = 0; }
    cb.onGone && cb.onGone();
  }

  return {
    active: () => T_ > 0 || dir !== 0,
    // the room dissolves into the ring; you beam in beside them
    start() {
      if (dir > 0 || T_ > 0) return;
      const cfg = K.getCfg(); if (!cfg) return;
      if (me) { sC.remove(me); K.disposeObj(me); }
      me = K.buildAvatar(cfg); me.position.set(ME_X, 0, 0); me.visible = false; sC.add(me);
      const peer = K.getPeer(); peerFace0 = peer ? peer.rotation.y : 0;
      ko = winner = null; fight = false; readySent = false; dir = 1;
    },
    // back to the room (the ring dissolves, the room rebuilds)
    leave() { fight = false; winner = null; ko = null; if (T_ > 0) dir = -1; },
    // drop everything at once (skip / end call)
    reset() { if (T_ > 0 || dir) finishLeave(); },
    setFight(on) { fight = !!on; },
    resetFighters() { ko = null; winner = null; hitAt.me = hitAt.peer = -9; },
    myPunch(s) { myAct[s] = now(); },
    myGuard(on) { keyGuard = !!on; },
    isGuarding: () => keyGuard || tGuard,
    peerPunch(s) { peerAct.s = s; peerAct.t0 = now(); },
    peerGuard(on) { peerGuard = !!on; },
    peerGuarding: () => peerGuard,
    // a punch landed on 'me' or 'peer'
    hit(who) {
      const t = now(); hitAt[who] = t; sparkT = t; shake = .05;
      const target = who === 'me' ? me : K.getPeer();
      if (target) { target.userData.head.getWorldPosition(sparkAt); sparkAt.x += who === 'me' ? .1 : -.1; }
    },
    knockout(loser) { ko = loser; koT = now(); winner = loser === 'me' ? 'peer' : 'me'; fight = false; },
    celebrate(who) { winner = who; },
    dispose() {
      nook.setArenaTick(null); K.root.removeEventListener('pointermove', onMove); K.root.removeEventListener('click', onClick); K.root.style.cursor = '';
      finishLeave(); [rain, ringG, beam, hover, ...sparks].forEach(o => sC.remove(o));
    }
  };
}
