// Nook world: walk around the island with other people.
// Borrows the island scene, the avatar builder and the renderer from nook3d.js (nook.kit). This file adds no art.
const PI = Math.PI, TAU = PI * 2, sin = Math.sin, cos = Math.cos;
const S = .62;                 // avatar size on the island (the house door is 1.44 units tall)
const WALK = 1.5, RUN = 2.8;   // island units per second
const STRIDE = 5.2;            // leg swing per unit walked, so feet do not slide
const SHORE = .955;            // how far out you can walk, as a share of the island radius
const REACH = 2.4;             // how close you must be to someone to open their menu
const MOVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight']);
const turn = (a, b, k) => a + (((b - a) % TAU + TAU + PI) % TAU - PI) * k;

export function createWorld(T, kit, canvas, tagLayer, cb = {}) {
  const { isl, hAt, rAt, R, buildAvatar, pose, disposeObj, renderer } = kit;
  const cam = new T.PerspectiveCamera(42, 1, .1, 400);
  const ray = new T.Raycaster(), DOWN = new T.Vector3(0, -1, 0), v3 = new T.Vector3(), ndc = new T.Vector2(), tgt = new T.Vector3();
  const land = isl.children.find(o => o.isMesh && o.material && o.material.vertexColors);

  /* ---------- where you can stand ---------- */
  // Things with a trunk or pole (trees, pines, palms, the umbrella) are groups whose first part is a 6-sided cylinder.
  const circles = [{ x: 6, z: -4.3, r: 1.4 }];   // the pond
  isl.children.forEach(g => {
    const a = g.isGroup && g.children[0], b = g.isGroup && g.children[1];
    if (!a || !a.isMesh || a.geometry.type !== 'CylinderGeometry' || !b || !b.isMesh) return;
    const kind = b.geometry.type, s = g.scale.x, tree = kind === 'IcosahedronGeometry', pine = kind === 'ConeGeometry' && b.geometry.parameters.radialSegments === 6;
    // r: how close you can walk. vis/top: how wide and tall the leaves are, for trees that can hide you from the camera.
    circles.push({ x: g.position.x, z: g.position.z, r: (tree ? .6 : pine ? .62 : .2) * s + .12, vis: tree ? 1.05 * s : pine ? .8 * s : 0, top: g.position.y + (tree ? 2.3 : 2.6) * s });
  });
  const box = (x, z, a, hx, z0, z1) => ({ x, z, c: cos(a), s: sin(a), hx, z0, z1 });
  const HOUSE = box(2.2, -.8, .3, 2.35, -1.85, 1.7), GARDEN = box(-2.2, 1.4, 0, 1.3, -.95, .95), boxes = [HOUSE, GARDEN];
  const DOCK = box(cos(1) * R * rAt(1) * .92, sin(1) * R * rAt(1) * .92, -1, 0, 0, 0);
  const toLocal = (b, x, z) => { const dx = x - b.x, dz = z - b.z; return [dx * b.c - dz * b.s, dx * b.s + dz * b.c]; };
  const toWorld = (b, lx, lz) => [b.x + lx * b.c + lz * b.s, b.z - lx * b.s + lz * b.c];
  const onLand = (x, z) => Math.hypot(x, z) <= R * rAt(Math.atan2(z, x)) * SHORE;
  const onDock = (x, z) => { const [lx, lz] = toLocal(DOCK, x, z); return lx > -.4 && lx < 5.6 && Math.abs(lz) < (lx > 4.7 ? 1.25 : .62); };
  const onPorch = (x, z) => { const [lx, lz] = toLocal(HOUSE, x, z); return lx > -1.5 && lx < 1.1 && lz > 1.5 && lz < 2.75; };
  const blocked = (x, z) => circles.some(c => (x - c.x) ** 2 + (z - c.z) ** 2 < c.r * c.r) || boxes.some(b => { const [lx, lz] = toLocal(b, x, z); return Math.abs(lx) < b.hx && lz > b.z0 && lz < b.z1; });
  const canStand = (x, z) => (onLand(x, z) || onDock(x, z)) && !blocked(x, z);
  const groundY = (x, z) => {
    let y = hAt(x, z);
    if (land) { ray.set(v3.set(x, 30, z), DOWN); const hit = ray.intersectObject(land, false)[0]; if (hit) y = hit.point.y; }
    if (onDock(x, z)) y = Math.max(y, .55);
    if (onPorch(x, z)) y = Math.max(y, 1.19);
    return y;
  };
  // Move someone to (nx, nz), sliding along whatever is in the way. Returns how far they really moved.
  function place(p, nx, nz) {
    if (onDock(p.x, p.z) && !onLand(nx, nz)) {   // out over the water: stay on the planks
      let [lx, lz] = toLocal(DOCK, nx, nz); lx = Math.min(lx, 5.58);
      if (Math.abs(lz) > .6 && lx > 4.2) lx = Math.max(lx, 4.72);
      const w = lx >= 4.72 ? 1.23 : .6; [nx, nz] = toWorld(DOCK, lx, Math.max(-w, Math.min(w, lz)));
    } else {
      circles.forEach(c => { const dx = nx - c.x, dz = nz - c.z, d = Math.hypot(dx, dz); if (d < c.r) { const k = c.r / (d || 1e-6); nx = c.x + dx * k; nz = c.z + dz * k; } });
      boxes.forEach(b => {
        let [lx, lz] = toLocal(b, nx, nz); if (!(Math.abs(lx) < b.hx && lz > b.z0 && lz < b.z1)) return;
        if (b.hx - Math.abs(lx) < Math.min(lz - b.z0, b.z1 - lz)) lx = (lx < 0 ? -1 : 1) * b.hx; else lz = lz - b.z0 < b.z1 - lz ? b.z0 : b.z1;
        [nx, nz] = toWorld(b, lx, lz);
      });
      if (!onLand(nx, nz) && !onDock(nx, nz)) { const lim = R * rAt(Math.atan2(nz, nx)) * SHORE, d = Math.hypot(nx, nz); nx *= lim / d; nz *= lim / d; }
      if (blocked(nx, nz)) return 0;
    }
    const moved = Math.hypot(nx - p.x, nz - p.z); p.x = nx; p.z = nz; return moved;
  }
  function randomSpot(near, reach) {
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * TAU; let x, z;
      if (near) { const d = 1.5 + Math.random() * reach; x = near.x + cos(a) * d; z = near.z + sin(a) * d; }
      else { const d = Math.sqrt(Math.random()) * R * rAt(a) * .88; x = cos(a) * d; z = sin(a) * d; }
      if (onLand(x, z) && !blocked(x, z)) return [x, z];
    }
    return null;
  }

  /* ---------- people ---------- */
  const people = new Map(), keys = new Set(), joy = { x: 0, y: 0 };
  const view = { yaw: 0, el: .42, dist: 5.2, d: 5.2, e: .42 };   // el/dist are where the camera is heading, e/d where it is
  let me = null, active = false, W = 0, H = 0, drag = null, movedYet = false;
  let game = null;   // set by worldgame.js while a match runs: it moves and poses the two players and aims the camera
  const mark = new T.Mesh(new T.RingGeometry(.15, .21, 24).rotateX(-PI / 2), new T.MeshBasicMaterial({ color: '#FBF8F1', transparent: true, opacity: .9, depthWrite: false }));
  mark.visible = false; isl.add(mark);

  function add(def, o = {}) {
    if (people.has(def.id)) return people.get(def.id);
    const av = buildAvatar(def.cfg); av.scale.setScalar(S); isl.add(av);
    const tag = document.createElement('div'); tag.className = 'nw-tag' + (def.kind === 'friend' ? ' nw-tag--friend' : '');
    tag.textContent = (def.flag ? def.flag + ' ' : '') + def.name; tag.style.display = 'none';
    if (def.kind !== 'me') { tagLayer.appendChild(tag); tag.onclick = () => approach(people.get(def.id)); }
    let at = o.at || randomSpot() || [0, 4], follow = false;
    if (o.arrive) { at = toWorld(DOCK, 4.3, 0); follow = true; }   // friends you invited step off the dock and walk over to you
    const p = { id: def.id, kind: def.kind || 'npc', av, tag, x: at[0], z: at[1], y: 0, ry: o.ry != null ? o.ry : Math.random() * TAU, walkK: 0, phase: Math.random() * 6, waveK: 0, waveUntil: 0, goal: null, idleUntil: Math.random() * 4, stuck: 0, net: null, greeted: false, follow, detour: 0, holdUntil: 0, near: false, fixY: null, chase: null };
    p.y = groundY(p.x, p.z); av.position.set(p.x, p.y, p.z); av.rotation.y = p.ry;
    people.set(p.id, p); return p;
  }
  function remove(id) { const p = people.get(id); if (!p) return; isl.remove(p.av); disposeObj(p.av); p.tag.remove(); people.delete(id); }

  // Click someone: if they are close their menu opens, otherwise you walk over first.
  function approach(p) {
    if (!active || !me || !p || p === me || game) return;
    if (Math.hypot(p.x - me.x, p.z - me.z) <= REACH) { me.goal = me.chase = null; cb.onPerson && cb.onPerson(p.id); } else me.chase = p.id;
  }
  // Who is drawn under this point of the screen (nearest to the camera wins)
  function personAt(cx, cy) {
    let best = null, bestZ = 2;
    people.forEach(p => {
      if (p === me || !p.av.visible) return;
      v3.set(p.x, p.y, p.z).project(cam); const fx = (v3.x * .5 + .5) * W, fy = (-v3.y * .5 + .5) * H, z = v3.z;
      if (z > 1 || z < -1) return;
      v3.set(p.x, p.y + 1.85 * S, p.z).project(cam); const hy = (-v3.y * .5 + .5) * H;
      if (Math.abs(cx - fx) < Math.max(22, (fy - hy) * .45) && cy > hy - 14 && cy < fy + 10 && z < bestZ) { best = p; bestZ = z; }
    });
    return best;
  }
  function walk(p, dx, dz, speed, dt) {
    let moved = 0;
    if (speed > .01) { moved = place(p, p.x + dx * speed * dt, p.z + dz * speed * dt); p.ry = turn(p.ry, Math.atan2(dx, dz), Math.min(1, dt * 10)); }
    const going = moved > speed * dt * .25;
    p.walkK += ((going ? Math.min(1, speed / WALK) : 0) - p.walkK) * Math.min(1, dt * 10);
    p.phase += moved * STRIDE;
    p.stuck = speed > .01 && !going ? p.stuck + dt : 0;
  }
  function driveMe(dt) {
    let f = joy.y, r = joy.x;
    if (keys.has('KeyW') || keys.has('ArrowUp')) f += 1; if (keys.has('KeyS') || keys.has('ArrowDown')) f -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) r += 1; if (keys.has('KeyA') || keys.has('ArrowLeft')) r -= 1;
    let dx = 0, dz = 0, amt = Math.min(1, Math.hypot(f, r));
    if (amt > .05) {   // forward is away from the camera
      me.goal = me.chase = null; dx = -sin(view.yaw) * f + cos(view.yaw) * r; dz = -cos(view.yaw) * f - sin(view.yaw) * r;
      const l = Math.hypot(dx, dz); dx /= l; dz /= l;
      if (!drag) view.yaw -= r * dt * .9;   // steering sideways slowly brings the camera round behind you
    } else if (me.chase) {   // walking over to someone you clicked
      const q = people.get(me.chase), gx = q ? q.x - me.x : 0, gz = q ? q.z - me.z : 0, d = Math.hypot(gx, gz);
      if (!q || me.stuck > .5) me.chase = null;
      else if (d <= REACH * .7) { me.chase = null; cb.onPerson && cb.onPerson(q.id); }
      else { dx = gx / d; dz = gz / d; amt = 1; }
      if (!me.chase) amt = 0;
    } else if (me.goal) {
      const gx = me.goal.x - me.x, gz = me.goal.z - me.z, d = Math.hypot(gx, gz);
      if (d < .12 || me.stuck > .4) me.goal = null; else { dx = gx / d; dz = gz / d; amt = 1; }
    } else amt = 0;
    walk(me, dx, dz, (keys.has('ShiftLeft') || keys.has('ShiftRight') ? RUN : WALK) * amt, dt);
    if (amt > 0 && !movedYet) { movedYet = true; cb.onMoved && cb.onMoved(); }
  }
  function think(p, t, dt) {
    const dm = Math.hypot(me.x - p.x, me.z - p.z);
    if (t < p.holdUntil) { p.goal = null; walk(p, 0, 0, 0, dt); p.ry = turn(p.ry, Math.atan2(me.x - p.x, me.z - p.z), Math.min(1, dt * 6)); return; }   // their menu is open: stay and face you
    if (p.follow) {
      if (dm < 1.5) { p.follow = false; p.goal = null; p.waveUntil = t + 2; p.idleUntil = t + 4; p.greeted = true; }
      else if (t > p.detour) p.goal = { x: me.x, z: me.z };
    }
    if (p.goal) {
      const gx = p.goal.x - p.x, gz = p.goal.z - p.z, d = Math.hypot(gx, gz);
      if (d < .25) { p.goal = null; p.idleUntil = t + 2 + Math.random() * 6; }
      else if (p.stuck > .6) {   // walked into something: step aside, then carry on
        const s = p.follow && randomSpot(p, 2); p.stuck = 0; p.goal = s ? { x: s[0], z: s[1] } : null; p.detour = t + 1.4; p.idleUntil = t + 1 + Math.random() * 3;
      } else { walk(p, gx / d, gz / d, WALK * (p.follow ? 1.3 : .75), dt); return; }
    }
    walk(p, 0, 0, 0, dt);
    if (dm < 1.8) {   // turn to you and say hi
      p.ry = turn(p.ry, Math.atan2(me.x - p.x, me.z - p.z), Math.min(1, dt * 5)); p.idleUntil = Math.max(p.idleUntil, t + 1.5);
      if (!p.greeted) { p.greeted = true; p.waveUntil = t + 1.8; }
    } else {
      if (dm > 4) p.greeted = false;
      if (!p.goal && t > p.idleUntil) { const s = randomSpot(p, 5); if (s) p.goal = { x: s[0], z: s[1] }; else p.idleUntil = t + 2; }
    }
  }
  function driveRemote(p, t, dt) {   // someone in another window: glide towards the last place they told us
    const n = p.net, ox = p.x, oz = p.z; if (!n) return;
    const k = Math.min(1, dt * 10); p.x += (n.x - p.x) * k; p.z += (n.z - p.z) * k; p.ry = turn(p.ry, n.ry, k);
    const moved = Math.hypot(p.x - ox, p.z - oz), speed = moved / Math.max(dt, .001);
    p.walkK += ((speed > .2 ? Math.min(1, speed / WALK) : 0) - p.walkK) * k; p.phase += moved * STRIDE;
    if (n.wv) p.waveUntil = t + .3;
  }
  function settle(p, t, dt) {
    p.y += ((p.fixY != null ? p.fixY : groundY(p.x, p.z)) - p.y) * Math.min(1, dt * 14);
    p.waveK += ((t < p.waveUntil ? 1 : 0) - p.waveK) * Math.min(1, dt * 8);
    p.av.position.set(p.x, p.y, p.z); p.av.rotation.y = p.ry;
    pose(p.av, t, { walk: p.walkK, phase: p.phase, wave: p.waveK });
  }

  /* ---------- camera, name tags ---------- */
  // Is a tree or the house standing between you and the camera (at the height you set)?
  function hidden() {
    const ce = cos(view.el), hx = sin(view.yaw) * ce, hz = cos(view.yaw) * ce, hy = sin(view.el), hh = hx * hx + hz * hz;
    if (hh < .01) return false;
    for (const c of circles) {
      if (!c.vis) continue;
      const ox = tgt.x - c.x, oz = tgt.z - c.z, k = -(ox * hx + oz * hz) / hh;   // where the line of sight passes closest to the trunk
      if (k < .3 || k > view.d) continue;
      const px = ox + hx * k, pz = oz + hz * k;
      if (px * px + pz * pz < c.vis * c.vis && tgt.y + hy * k < c.top) return true;
    }
    for (let k = .6; k < view.d; k += .6) { const [lx, lz] = toLocal(HOUSE, tgt.x + hx * k, tgt.z + hz * k); if (Math.abs(lx) < 2.4 && lz > -1.9 && lz < 2.9 && tgt.y + hy * k < 4.5) return true; }
    return false;
  }
  function aim(dt) {
    const k = Math.min(1, dt * 6), s = Math.min(1, dt * 2.4);
    const f = game && game.focus;   // in a match the camera looks at a point the game picks
    view.d += (view.dist - view.d) * s; view.e += ((!game && hidden() ? Math.max(view.el, 1.05) : view.el) - view.e) * s;   // lift to look over whatever hides you
    if (f && game.yaw != null && !drag) view.yaw = turn(view.yaw, game.yaw, Math.min(1, dt * 2.2));
    tgt.x += ((f ? f.x : me.x) - tgt.x) * k; tgt.z += ((f ? f.z : me.z) - tgt.z) * k; tgt.y += ((f ? f.y : me.y + 1.5 * S) - tgt.y) * k;
    const ce = cos(view.e);
    cam.position.set(tgt.x + sin(view.yaw) * ce * view.d, tgt.y + sin(view.e) * view.d, tgt.z + cos(view.yaw) * ce * view.d);
    cam.position.y = game ? Math.max(cam.position.y, game.floorY + .2) : Math.max(cam.position.y, .25, hAt(cam.position.x, cam.position.z) + .3);
    cam.lookAt(tgt);
  }
  function tags() {
    people.forEach(p => {
      if (p === me || !p.av.visible) { p.tag.style.display = 'none'; return; }
      const near = !game && Math.hypot(p.x - me.x, p.z - me.z) <= REACH;
      if (near !== p.near) { p.near = near; p.tag.classList.toggle('nw-tag--near', near); }
      v3.set(p.x, p.y + 1.95 * S, p.z); const far = v3.distanceTo(cam.position); v3.project(cam);
      const show = v3.z < 1 && far < 24 && Math.abs(v3.x) < 1.15 && Math.abs(v3.y) < 1.15;
      p.tag.style.display = show ? 'block' : 'none';
      if (show) { p.tag.style.transform = 'translate(-50%,-100%) translate(' + ((v3.x * .5 + .5) * W).toFixed(1) + 'px,' + ((-v3.y * .5 + .5) * H).toFixed(1) + 'px)'; p.tag.style.opacity = far > 16 ? String(1 - (far - 16) / 8) : '1'; }
    });
  }

  /* ---------- input ---------- */
  const onDown = e => { if (!active) return; try { canvas.setPointerCapture(e.pointerId); } catch (er) {} drag = { id: e.pointerId, x: e.clientX, y: e.clientY, yaw: view.yaw, el: view.el, moved: false, t: performance.now() }; canvas.style.cursor = 'grabbing'; };
  const onMove = e => {
    if (!drag && active && !game && e.pointerType === 'mouse') { const r = canvas.getBoundingClientRect(); canvas.style.cursor = personAt(e.clientX - r.left, e.clientY - r.top) ? 'pointer' : 'grab'; }
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 6) drag.moved = true;
    if (drag.moved) { view.yaw = drag.yaw - dx * .006; view.el = view.e = Math.max(.12, Math.min(1.25, drag.el + dy * .005)); }
  };
  const onUp = e => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag; drag = null; canvas.style.cursor = 'grab';
    if (!active || !me || game || d.moved || performance.now() - d.t > 500) return;
    const r = canvas.getBoundingClientRect(), who = personAt(e.clientX - r.left, e.clientY - r.top);
    if (who) return approach(who);
    // a plain click or tap on the ground: walk there
    me.chase = null; ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, cam);
    let spot = null; const k = (.55 - ray.ray.origin.y) / ray.ray.direction.y;
    if (k > 0) { ray.ray.at(k, v3); if (onDock(v3.x, v3.z) && !onLand(v3.x, v3.z)) spot = [v3.x, v3.z]; }
    if (!spot) { const hit = land && ray.intersectObject(land, false)[0]; if (hit && onLand(hit.point.x, hit.point.z)) spot = [hit.point.x, hit.point.z]; }
    if (!spot) return;
    me.goal = { x: spot[0], z: spot[1] }; me.stuck = 0; mark.position.set(spot[0], groundY(spot[0], spot[1]) + .05, spot[1]);
  };
  const onWheel = e => { if (!active) return; e.preventDefault(); view.dist = Math.max(2.6, Math.min(13, view.dist * Math.exp(e.deltaY * .0012))); };
  const typing = e => { const n = e.target; return n && (n.tagName === 'INPUT' || n.tagName === 'TEXTAREA' || n.isContentEditable); };
  const onKeyDown = e => { if (!active || typing(e) || e.metaKey || e.ctrlKey) return; if (MOVE_KEYS.has(e.code)) { keys.add(e.code); if (e.code.startsWith('Arrow')) e.preventDefault(); } if (e.code === 'KeyE' && !e.repeat && !game) api.wave(); };
  const onKeyUp = e => keys.delete(e.code);
  const onBlur = () => keys.clear();
  canvas.addEventListener('pointerdown', onDown); canvas.addEventListener('pointermove', onMove); canvas.addEventListener('pointerup', onUp); canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('keydown', onKeyDown); window.addEventListener('keyup', onKeyUp); window.addEventListener('blur', onBlur);

  const api = {
    // me: { id, name, cfg }. others: [{ id, name, flag, cfg, kind }]
    enter(meDef, others) {
      api.leave(); active = true; movedYet = false;
      // on the beach by the dock, facing the house; a little to one side so two people who join together do not stand in each other
      const a = 1.02, d = R * rAt(a) * .84, side = (Math.random() - .5) * 2.4, at = [cos(a) * d - sin(a) * side, sin(a) * d + cos(a) * side];
      me = add(Object.assign({}, meDef, { kind: 'me' }), { at: canStand(at[0], at[1]) ? at : [cos(a) * d, sin(a) * d], ry: Math.atan2(-cos(a), -sin(a)) });
      others.forEach(o => add(o));
      Object.assign(view, { yaw: Math.atan2(cos(a), sin(a)), el: .42, dist: 5.2, d: 30, e: .68 });   // starts high like the home view, then swoops down
      tgt.set(me.x, me.y + 1.5 * S, me.z);
    },
    leave() { [...people.keys()].forEach(remove); me = null; active = false; game = null; drag = null; keys.clear(); joy.x = joy.y = 0; mark.visible = false; },
    active: () => active,
    add, remove, has: id => people.has(id), count: () => people.size,
    // for worldgame.js: the people, the camera settings, and handing over control while a match runs
    S, WALK, view, groundY, me: () => me, person: id => people.get(id), each: fn => people.forEach(fn),
    // where a point of the island is on the screen, in pixels (null when it is behind the camera)
    project(x, y, z) { v3.set(x, y, z).project(cam); return v3.z < 1 && v3.z > -1 ? [(v3.x * .5 + .5) * W, (-v3.y * .5 + .5) * H] : null; },
    setGame(g) { game = g; if (me) me.goal = me.chase = null; keys.clear(); joy.x = joy.y = 0; },
    hold(id, sec) { const p = people.get(id); if (p) p.holdUntil = performance.now() / 1000 + sec; },
    // where someone in another window says they are
    remote(id, s) {
      const p = people.get(id); if (!p || !s || ![s.x, s.z, s.ry].every(Number.isFinite) || Math.hypot(s.x, s.z) > 40) return;
      if (!p.net) { p.x = s.x; p.z = s.z; p.ry = s.ry; p.y = groundY(p.x, p.z); }
      p.net = { x: s.x, z: s.z, ry: s.ry, wv: !!s.wv };
    },
    state: () => me && { x: +me.x.toFixed(2), z: +me.z.toFixed(2), ry: +me.ry.toFixed(2), wv: performance.now() / 1000 < me.waveUntil },
    wave() { if (me) me.waveUntil = performance.now() / 1000 + 1.8; },
    setJoy(x, y) { joy.x = x; joy.y = y; },
    // called once a frame by nook3d.js while the world is on screen
    tick(t, dt) {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (w && h && (w !== W || h !== H)) { W = w; H = h; cam.aspect = w / h; cam.updateProjectionMatrix(); }
      if (!active || !me) { cam.position.set(18, 22, 30); cam.lookAt(0, 1, 0); renderer.render(isl, cam); return; }
      if (game) game.step(t, dt);
      else { driveMe(dt); people.forEach(p => { if (p === me) return; if (p.kind === 'remote') driveRemote(p, t, dt); else think(p, t, dt); }); }
      people.forEach(p => settle(p, t, dt));
      if (game) game.pose(t, dt);
      mark.visible = !!me.goal && !game; if (mark.visible) mark.scale.setScalar(1 + .12 * sin(t * 6));
      aim(dt); tags();
      renderer.render(isl, cam);
    },
    dispose() {
      api.leave(); isl.remove(mark); mark.geometry.dispose(); mark.material.dispose();
      canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointermove', onMove); canvas.removeEventListener('pointerup', onUp); canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); window.removeEventListener('blur', onBlur);
    }
  };
  return api;
}
