// Nook world: walk around the anime island with other people, and rest: the house (bed, sofa, armchair by the
// fire), the bench under the big tree, the hammock, the campfire, the end of the dock and the beach towels.
// Borrows the island, the avatars and the renderer from nook3d.js (nook.kit; the island's data is kit.island.json,
// made in Blender by character-test/tools/nook_island.py). This file adds no art.
const PI = Math.PI, TAU = PI * 2, sin = Math.sin, cos = Math.cos;
const S = .62;                 // avatar size on the island (the house door is 1.6 tall)
const WALK = 1.5, RUN = 2.8;   // island units per second
const STRIDE = 5.2;            // leg swing per unit walked, so feet do not slide
const REACH = 2.4;             // how close you must be to someone to open their menu
const NEAR_SPOT = 3.2;         // how close you must be to a resting place for its button to show
const MOVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight']);
const turn = (a, b, k) => a + (((b - a) % TAU + TAU + PI) % TAU - PI) * k;
const ICON = { Sit: '🪑', Sleep: '🛏️', 'Lie down': '🌴' };

export function createWorld(T, kit, canvas, tagLayer, cb = {}) {
  const { isl, hAt, buildAvatar, pose, disposeObj, renderer } = kit;
  const I = kit.island, J = I.json;
  const cam = new T.PerspectiveCamera(42, 1, .1, 400);
  const ray = new T.Raycaster(), v3 = new T.Vector3(), ndc = new T.Vector2(), tgt = new T.Vector3(), q1 = new T.Quaternion(), q2 = new T.Quaternion(), Y = new T.Vector3(0, 1, 0);

  /* ---------- where you can stand ---------- */
  const circles = J.circles.map(c => ({ x: c[0], z: c[1], r: c[2] + .06 }));
  // boxes: centre, half sizes along their own x and z, turned a about up (same maths as three.js rotation.y)
  const boxes = J.boxes.map(b => ({ x: b[0], z: b[1], c: cos(b[4]), s: sin(b[4]), hx: b[2], z0: -b[3], z1: b[3] }));
  const toLocal = (b, x, z) => { const dx = x - b.x, dz = z - b.z; return [dx * b.c - dz * b.s, dx * b.s + dz * b.c]; };
  const toWorld = (b, lx, lz) => [b.x + lx * b.c + lz * b.s, b.z - lx * b.s + lz * b.c];
  const D = J.dock, H = J.house, IN = H.inside;
  const onLand = (x, z) => hAt(x, z) > J.walk_min;
  const dockUV = (x, z) => { const dx = x - D.root[0], dz = z - D.root[1]; return [dx * D.dir[0] + dz * D.dir[1], dx * D.side[0] + dz * D.side[1]]; };
  const onDock = (x, z) => { const [u, v] = dockUV(x, z); return u > -.4 && u < D.len - .12 && Math.abs(v) < (u > D.len - D.end_len ? D.end_hw - .12 : D.hw - .1); };
  const inHouse = (x, z) => x > IN[0] && x < IN[2] && z > IN[1] && z < IN[3];
  const blocked = (x, z) => circles.some(c => (x - c.x) ** 2 + (z - c.z) ** 2 < c.r * c.r) || boxes.some(b => { const [lx, lz] = toLocal(b, x, z); return Math.abs(lx) < b.hx && lz > b.z0 && lz < b.z1; });
  const canStand = (x, z) => (onLand(x, z) || onDock(x, z)) && !blocked(x, z);
  const groundY = (x, z) => {
    if (inHouse(x, z)) return H.floor;
    let y = hAt(x, z);
    if (onDock(x, z)) y = Math.max(y, D.deck);
    return Math.max(y, J.sea - .2);
  };
  // the door: walk through it on the way in or out
  const DOOR = H.door, DOOR_OUT = [DOOR[0], DOOR[1] + .85], DOOR_IN = [DOOR[0], DOOR[1] - .75];
  function route(p, gx, gz) {   // a list of points to walk through to reach (gx, gz)
    const a = inHouse(p.x, p.z), b = inHouse(gx, gz);
    if (a === b) return [[gx, gz]];
    return a ? [DOOR_IN, DOOR_OUT, [gx, gz]] : [DOOR_OUT, DOOR_IN, [gx, gz]];
  }
  // Move someone to (nx, nz), sliding along whatever is in the way. Returns how far they really moved.
  function place(p, nx, nz) {
    if (onDock(p.x, p.z) && !onLand(nx, nz)) {   // out over the water: stay on the planks
      let [u, v] = dockUV(nx, nz); u = Math.max(-.3, Math.min(u, D.len - .14));
      const w = u > D.len - D.end_len ? D.end_hw - .14 : D.hw - .12; v = Math.max(-w, Math.min(w, v));
      nx = D.root[0] + D.dir[0] * u + D.side[0] * v; nz = D.root[1] + D.dir[1] * u + D.side[1] * v;
    } else {
      circles.forEach(c => { const dx = nx - c.x, dz = nz - c.z, d = Math.hypot(dx, dz); if (d < c.r) { const k = c.r / (d || 1e-6); nx = c.x + dx * k; nz = c.z + dz * k; } });
      boxes.forEach(b => {
        let [lx, lz] = toLocal(b, nx, nz); if (!(Math.abs(lx) < b.hx && lz > b.z0 && lz < b.z1)) return;
        if (b.hx - Math.abs(lx) < Math.min(lz - b.z0, b.z1 - lz)) lx = (lx < 0 ? -1 : 1) * b.hx; else lz = lz - b.z0 < b.z1 - lz ? b.z0 : b.z1;
        [nx, nz] = toWorld(b, lx, lz);
      });
      if (!onLand(nx, nz) && !onDock(nx, nz)) return 0;   // the sea
      if (blocked(nx, nz)) return 0;
    }
    const moved = Math.hypot(nx - p.x, nz - p.z); p.x = nx; p.z = nz; return moved;
  }
  function randomSpot(near, reach) {
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * TAU; let x, z;
      if (near) { const d = 1.5 + Math.random() * reach; x = near.x + cos(a) * d; z = near.z + sin(a) * d; }
      else { const d = Math.sqrt(Math.random()) * 13; x = cos(a) * d; z = sin(a) * d; }
      if (onLand(x, z) && !blocked(x, z) && !inHouse(x, z)) return [x, z];
    }
    return null;
  }

  /* ---------- places to rest ---------- */
  // spot: { key, label, verb, kind (sit | lie | fire), inside, seats: [{ at, yaw | head, rock }], approach, objects }
  const SPOTS = Object.entries(J.spots).map(([key, s]) => Object.assign({ key }, s, { taken: s.seats.map(() => null) }));
  const spotOf = new Map();   // mesh -> spot, for clicks
  SPOTS.forEach(s => (s.key === 'dock' ? [] : s.objects).forEach(n => { const o = I.parts[n]; if (o) o.traverse(m => { if (m.isMesh) spotOf.set(m, s); }); }));
  const clickable = [...spotOf.keys()];
  const houseShell = ['House_Roof', 'House_Wall_S', 'House_Wall_N', 'House_Wall_E', 'House_Wall_W', 'House_Door'].map(n => I.parts[n]).filter(Boolean);
  const seatYaw = (s, seat) => seat.yaw != null ? seat.yaw : Math.atan2(-seat.head[0], -seat.head[1]);   // lying: the head points along -z
  const freeSeat = (s, p) => { let best = -1, bd = 1e9; s.seats.forEach((st, i) => { if (s.taken[i] && s.taken[i] !== p.id) return; const d = Math.hypot(st.at[0] - p.x, st.at[2] - p.z); if (d < bd) { bd = d; best = i; } }); return best; };
  function release(p) { if (p.rest) { const s = p.rest.spot; if (s.taken[p.rest.i] === p.id) s.taken[p.rest.i] = null; } }
  // walk over to a resting place and sit / lie down there
  function goRest(p, s) {
    if (!p || !s) return false;
    const i = freeSeat(s, p); if (i < 0) return false;
    standUp(p, true);
    s.taken[i] = p.id; p.want = { spot: s, i }; p.chase = null;
    const ap = s.approach, seat = s.seats[i].at;
    p.path = route(p, ap[0], ap[1]).concat([[seat[0], seat[2], 'seat']]);
    p.goal = null; p.stuck = 0;
    return true;
  }
  function sitDown(p) {
    const w = p.want; p.want = null; p.path = null; if (!w) return;
    p.rest = { spot: w.spot, i: w.i, from: [p.x, p.z], k: 0 };
    p.walkK = 0;
    if (p === me) {   // swing the camera round to a nice view of you resting
      const s = w.spot, ry = seatYaw(s, s.seats[w.i]);
      if (!saved) saved = { el: view.el, dist: view.dist };
      const side = Math.abs(turn(0, ry + PI / 2 - view.yaw, 1)) < Math.abs(turn(0, ry - PI / 2 - view.yaw, 1)) ? ry + PI / 2 : ry - PI / 2;
      auto = s.inside ? { yaw: s.kind === 'lie' ? .5 : ry + .45, el: .85, dist: 5.4 }
        : s.kind === 'lie' ? { yaw: side, el: s.key === 'hammock' ? .18 : .5, dist: 4.4 }
        : { yaw: ry + .45, el: .3, dist: 4.4 };
    }
  }
  function standUp(p, quiet) {
    if (p.want) { const s = p.want.spot; if (s.taken[p.want.i] === p.id) s.taken[p.want.i] = null; p.want = null; }
    if (!p.rest) return;
    const s = p.rest.spot, seat = s.seats[p.rest.i].at;
    release(p); p.rest = null; p.fixY = null;
    if (p === me) { auto = null; if (saved) { view.el = saved.el; view.dist = saved.dist; saved = null; } }
    // step back to where you came from, so you are not standing in the furniture
    const ap = s.approach; p.leave = { from: [seat[0], seat[2]], to: [ap[0], ap[1]], k: 0 };
    p.x = seat[0]; p.z = seat[2];
    if (!quiet && p === me) p.path = null;
  }

  /* ---------- people ---------- */
  const people = new Map(), keys = new Set(), joy = { x: 0, y: 0 };
  const view = { yaw: 0, el: .42, dist: 5.2, d: 5.2, e: .42 };   // el/dist are where the camera is heading, e/d where it is
  let me = null, active = false, W = 0, H_ = 0, drag = null, movedYet = false, insideK = 0;
  let auto = null, saved = null;   // auto: where the camera swings to while you rest; saved: the view from before
  let game = null;   // set by worldgame.js while a match runs: it moves and poses the two players and aims the camera
  const mark = new T.Mesh(new T.RingGeometry(.15, .21, 24).rotateX(-PI / 2), new T.MeshBasicMaterial({ color: '#FBF8F1', transparent: true, opacity: .9, depthWrite: false }));
  mark.visible = false; isl.add(mark);

  function add(def, o = {}) {
    if (people.has(def.id)) return people.get(def.id);
    const av = buildAvatar(def.cfg); av.scale.setScalar(S); isl.add(av);
    const tag = document.createElement('div'); tag.className = 'nw-tag' + (def.kind === 'friend' ? ' nw-tag--friend' : '');
    tag.textContent = (def.flag ? def.flag + ' ' : '') + def.name; tag.style.display = 'none';
    if (def.kind !== 'me') { tagLayer.appendChild(tag); tag.onclick = () => approach(people.get(def.id)); }
    let at = o.at || randomSpot() || [0, 2], follow = false;
    if (o.arrive) { at = [D.root[0] - D.dir[0] * .4, D.root[1] - D.dir[1] * .4]; follow = true; }   // friends you invited walk up from the dock
    const p = { id: def.id, kind: def.kind || 'npc', av, tag, x: at[0], z: at[1], y: 0, ry: o.ry != null ? o.ry : Math.random() * TAU, walkK: 0, phase: Math.random() * 6, waveK: 0, waveUntil: 0,
      goal: null, path: null, idleUntil: Math.random() * 4, stuck: 0, net: null, greeted: false, follow, detour: 0, holdUntil: 0, near: false, fixY: null, chase: null,
      rest: null, want: null, leave: null, restUntil: 0, nextRest: performance.now() / 1000 + 8 + Math.random() * 30, zz: null };
    p.y = groundY(p.x, p.z); av.position.set(p.x, p.y, p.z); av.rotation.y = p.ry;
    people.set(p.id, p); return p;
  }
  function remove(id) { const p = people.get(id); if (!p) return; release(p); standUp(p, true); isl.remove(p.av); disposeObj(p.av); p.tag.remove(); if (p.zz) p.zz.remove(); people.delete(id); }

  // Click someone: if they are close their menu opens, otherwise you walk over first.
  function approach(p) {
    if (!active || !me || !p || p === me || game) return;
    standUp(me);
    if (Math.hypot(p.x - me.x, p.z - me.z) <= REACH) { me.goal = me.chase = null; me.path = null; cb.onPerson && cb.onPerson(p.id); } else { me.chase = p.id; me.path = null; }
  }
  // Who is drawn under this point of the screen (nearest to the camera wins)
  function personAt(cx, cy) {
    let best = null, bestZ = 2;
    people.forEach(p => {
      if (p === me || !p.av.visible) return;
      v3.set(p.x, p.y, p.z).project(cam); const fx = (v3.x * .5 + .5) * W, fy = (-v3.y * .5 + .5) * H_, z = v3.z;
      if (z > 1 || z < -1) return;
      v3.set(p.x, p.y + 1.85 * S, p.z).project(cam); const hy = (-v3.y * .5 + .5) * H_;
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
  // follow p.path (a list of points); returns the direction to walk, or null when there
  function followPath(p) {
    while (p.path && p.path.length) {
      const [gx, gz, kind] = p.path[0], dx = gx - p.x, dz = gz - p.z, d = Math.hypot(dx, dz);
      if (kind === 'seat') { if (d < .9 || p.stuck > .3) { sitDown(p); return null; } return [dx / d, dz / d]; }
      if (d < .2 || (p.stuck > .5 && p.path.length > 1)) { p.path.shift(); p.stuck = 0; continue; }
      if (p.stuck > 1.2) { p.path = null; if (p.want) standUp(p, true); return null; }
      return [dx / d, dz / d];
    }
    p.path = null; return null;
  }
  function driveMe(dt) {
    let f = joy.y, r = joy.x;
    if (keys.has('KeyW') || keys.has('ArrowUp')) f += 1; if (keys.has('KeyS') || keys.has('ArrowDown')) f -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) r += 1; if (keys.has('KeyA') || keys.has('ArrowLeft')) r -= 1;
    let dx = 0, dz = 0, amt = Math.min(1, Math.hypot(f, r));
    if (amt > .05) {   // forward is away from the camera
      if (me.rest || me.want) standUp(me);
      me.goal = me.chase = null; me.path = null; dx = -sin(view.yaw) * f + cos(view.yaw) * r; dz = -cos(view.yaw) * f - sin(view.yaw) * r;
      const l = Math.hypot(dx, dz); dx /= l; dz /= l;
      if (!drag) view.yaw -= r * dt * .9;   // steering sideways slowly brings the camera round behind you
    } else if (me.rest) { amt = 0; }
    else if (me.chase) {   // walking over to someone you clicked
      const q = people.get(me.chase), gx = q ? q.x - me.x : 0, gz = q ? q.z - me.z : 0, d = Math.hypot(gx, gz);
      if (!q || me.stuck > .5) me.chase = null;
      else if (d <= REACH * .7) { me.chase = null; cb.onPerson && cb.onPerson(q.id); }
      else { dx = gx / d; dz = gz / d; amt = 1; }
      if (!me.chase) amt = 0;
    } else if (me.path) {
      const d = followPath(me); if (d) { dx = d[0]; dz = d[1]; amt = 1; } else amt = 0;
    } else amt = 0;
    walk(me, dx, dz, (keys.has('ShiftLeft') || keys.has('ShiftRight') ? RUN : WALK) * amt, dt);
    if (amt > 0 && !movedYet) { movedYet = true; cb.onMoved && cb.onMoved(); }
  }
  function think(p, t, dt) {
    const dm = Math.hypot(me.x - p.x, me.z - p.z);
    if (t < p.holdUntil) { if (!p.rest) { p.path = null; walk(p, 0, 0, 0, dt); p.ry = turn(p.ry, Math.atan2(me.x - p.x, me.z - p.z), Math.min(1, dt * 6)); } return; }   // their menu is open
    if (p.rest) { if (t > p.restUntil) { standUp(p); p.nextRest = t + 25 + Math.random() * 40; p.idleUntil = t + 1; } return; }
    if (p.follow) {
      if (dm < 1.5) { p.follow = false; p.path = null; p.waveUntil = t + 2; p.idleUntil = t + 4; p.greeted = true; }
      else if (t > p.detour) p.path = route(p, me.x, me.z);
    }
    if (p.path) {
      const d = followPath(p);
      if (d) { walk(p, d[0], d[1], WALK * (p.follow ? 1.3 : .75), dt); return; }
      if (p.rest) { p.restUntil = t + 15 + Math.random() * 30; return; }
      p.idleUntil = t + 2 + Math.random() * 6;
    }
    walk(p, 0, 0, 0, dt);
    if (dm < 1.8 && !inHouse(p.x, p.z)) {   // turn to you and say hi
      p.ry = turn(p.ry, Math.atan2(me.x - p.x, me.z - p.z), Math.min(1, dt * 5)); p.idleUntil = Math.max(p.idleUntil, t + 1.5);
      if (!p.greeted) { p.greeted = true; p.waveUntil = t + 1.8; }
    } else {
      if (dm > 4) p.greeted = false;
      if (t > p.idleUntil) {
        if (!p.follow && t > p.nextRest && Math.random() < .5) {   // now and then: go and rest somewhere outside
          const out = SPOTS.filter(s => !s.inside && s.taken.some(x => !x));
          if (out.length && goRest(p, out[Math.floor(Math.random() * out.length)])) return;
          p.nextRest = t + 20;
        }
        const s = randomSpot(p, 5); if (s) p.path = route(p, s[0], s[1]); else p.idleUntil = t + 2;
      }
    }
  }
  function driveRemote(p, t, dt) {   // someone in another window: glide towards the last place they told us
    const n = p.net; if (!n) return;
    if (n.rest) {
      const s = SPOTS.find(x => x.key === n.rest[0]), i = n.rest[1];
      if (s && s.seats[i] && !(p.rest && p.rest.spot === s && p.rest.i === i)) { release(p); p.rest = { spot: s, i, from: [p.x, p.z], k: 0 }; s.taken[i] = p.id; }
      return;
    }
    if (p.rest) standUp(p, true);
    const ox = p.x, oz = p.z, k = Math.min(1, dt * 10); p.x += (n.x - p.x) * k; p.z += (n.z - p.z) * k; p.ry = turn(p.ry, n.ry, k);
    const moved = Math.hypot(p.x - ox, p.z - oz), speed = moved / Math.max(dt, .001);
    p.walkK += ((speed > .2 ? Math.min(1, speed / WALK) : 0) - p.walkK) * k; p.phase += moved * STRIDE;
    if (n.wv) p.waveUntil = t + .3;
  }
  const hamPivot = I.parts.Hammock ? I.parts.Hammock.position : null;
  function settle(p, t, dt) {
    let rest = p.gameRest || null;   // a game can seat someone where there is no real seat (chess: worldgame.js)
    if (p.rest) {
      const s = p.rest.spot, seat = s.seats[p.rest.i];
      p.rest.k = Math.min(1, p.rest.k + dt * 3);
      const e = p.rest.k * p.rest.k * (3 - 2 * p.rest.k);
      p.x = p.rest.from[0] + (seat.at[0] - p.rest.from[0]) * e; p.z = p.rest.from[1] + (seat.at[2] - p.rest.from[1]) * e;
      p.ry = turn(p.ry, seatYaw(s, seat), Math.min(1, dt * 8)); p.fixY = seat.at[1]; p.walkK = 0;
      rest = s.kind;
    } else if (p.leave) {
      p.leave.k = Math.min(1, p.leave.k + dt * 3);
      const e = p.leave.k; p.x = p.leave.from[0] + (p.leave.to[0] - p.leave.from[0]) * e; p.z = p.leave.from[1] + (p.leave.to[1] - p.leave.from[1]) * e;
      if (e >= 1) p.leave = null;
    }
    p.y += ((p.fixY != null ? p.fixY : groundY(p.x, p.z)) - p.y) * Math.min(1, dt * 14);
    p.waveK += ((t < p.waveUntil ? 1 : 0) - p.waveK) * Math.min(1, dt * 8);
    p.av.position.set(p.x, p.y, p.z);
    const sk = rest && p.rest ? p.rest.spot.key : null;
    if (sk === 'hammock' && hamPivot) {   // rock with the hammock
      const ang = I.hammockRock(t);
      v3.set(p.x - hamPivot.x, p.y - hamPivot.y, p.z - hamPivot.z).applyAxisAngle(I.hammockAxis, ang);
      p.av.position.set(hamPivot.x + v3.x, hamPivot.y + v3.y, hamPivot.z + v3.z);
      p.av.quaternion.copy(q1.setFromAxisAngle(I.hammockAxis, ang)).multiply(q2.setFromAxisAngle(Y, p.ry));
    } else p.av.rotation.set(0, p.ry, 0);
    pose(p.av, t, { walk: p.walkK, phase: p.phase, wave: p.waveK, rest, sleep: sk === 'bed', expr: sk === 'fire' ? 'Happy' : undefined });
    // little z's over sleepers
    const asleep = sk === 'bed' && p.rest.k >= 1;
    if (asleep && !p.zz) { p.zz = document.createElement('div'); p.zz.textContent = 'z z z'; p.zz.style.cssText = 'position:absolute;left:0;top:0;font:700 13px Figtree,sans-serif;color:#5C5E78;letter-spacing:2px;pointer-events:none;text-shadow:0 1px 2px #fff;display:none'; tagLayer.appendChild(p.zz); }
    if (p.zz && !asleep) { p.zz.remove(); p.zz = null; }
  }

  /* ---------- the house: door, and seeing inside ---------- */
  function house(dt) {
    let near = false; people.forEach(p => { if (Math.hypot(p.x - DOOR[0], p.z - DOOR[1]) < 1.7) near = true; });
    I.openDoor(near);
    const inside = !!me && !game && (inHouse(me.x, me.z) || (me.rest && me.rest.spot.inside));
    insideK += ((inside ? 1 : 0) - insideK) * Math.min(1, dt * 6);
    const cx = H.centre[0], cz = H.centre[1], dx = cam.position.x - cx, dz = cam.position.z - cz, dl = Math.hypot(dx, dz) || 1;
    if (I.parts.House_Roof) I.parts.House_Roof.visible = insideK < .5;
    Object.entries(H.walls).forEach(([name, n]) => { const w = I.parts[name]; if (w) w.visible = !(insideK > .5 && (n[0] * dx + n[1] * dz) / dl > .2); });
  }

  /* ---------- camera, name tags, rest buttons ---------- */
  // Is the house standing between you and the camera (at the height you set)?
  const TREES = (J.trees || []).map(t => ({ x: t[0], z: t[1], vis: t[2], top: t[3] }));
  function hidden() {
    if (insideK > .5 || (me && me.rest)) return false;
    const ce = cos(view.el), hx = sin(view.yaw) * ce, hz = cos(view.yaw) * ce, hy = sin(view.el), hh = hx * hx + hz * hz;
    if (hh > .01) for (const c of TREES) {
      const ox = tgt.x - c.x, oz = tgt.z - c.z, k = -(ox * hx + oz * hz) / hh;   // where the line of sight passes closest to the trunk
      if (k < .3 || k > view.d) continue;
      const px = ox + hx * k, pz = oz + hz * k;
      if (px * px + pz * pz < c.vis * c.vis && tgt.y + hy * k < c.top) return true;
    }
    for (let k = .6; k < view.d; k += .6) {
      const x = tgt.x + hx * k, z = tgt.z + hz * k;
      if (Math.abs(x - H.centre[0]) < H.half[0] + .5 && Math.abs(z - H.centre[1]) < H.half[1] + .5 && tgt.y + hy * k < H.floor + 3.8) return true;
    }
    return false;
  }
  function aim(dt) {
    const k = Math.min(1, dt * 6), s = Math.min(1, dt * 2.4);
    const f = game && game.focus;   // in a match the camera looks at a point the game picks
    if (auto && !drag && !game) { const a = Math.min(1, dt * 2); view.yaw = turn(view.yaw, auto.yaw, a); view.el += (auto.el - view.el) * a; view.dist += (auto.dist - view.dist) * a; }
    const dist = insideK > .5 ? Math.min(view.dist, 6) : view.dist, el = insideK > .5 ? Math.max(view.el, .8) : (!game && hidden() ? Math.max(view.el, 1.05) : view.el);
    view.d += (dist - view.d) * s; view.e += (el - view.e) * s;   // lift to look over whatever hides you, or down into the house
    if (f && game.yaw != null && !drag) view.yaw = turn(view.yaw, game.yaw, Math.min(1, dt * 2.2));
    tgt.x += ((f ? f.x : me.x) - tgt.x) * k; tgt.z += ((f ? f.z : me.z) - tgt.z) * k; tgt.y += ((f ? f.y : me.y + (me.rest ? .9 : 1.5) * S) - tgt.y) * k;
    const ce = cos(view.e);
    cam.position.set(tgt.x + sin(view.yaw) * ce * view.d, tgt.y + sin(view.e) * view.d, tgt.z + cos(view.yaw) * ce * view.d);
    cam.position.y = game ? Math.max(cam.position.y, game.floorY + .2) : Math.max(cam.position.y, .25, hAt(cam.position.x, cam.position.z) + .3);
    cam.lookAt(tgt);
  }
  const screen = (x, y, z) => { v3.set(x, y, z); const far = v3.distanceTo(cam.position); v3.project(cam); return v3.z < 1 && Math.abs(v3.x) < 1.15 && Math.abs(v3.y) < 1.15 ? [(v3.x * .5 + .5) * W, (-v3.y * .5 + .5) * H_, far] : null; };
  const pin = (el, at) => { el.style.display = at ? 'block' : 'none'; if (at) el.style.transform = 'translate(-50%,-100%) translate(' + at[0].toFixed(1) + 'px,' + at[1].toFixed(1) + 'px)'; };
  function tags(t) {
    people.forEach(p => {
      if (p.zz) pin(p.zz, screen(p.x, p.y + 1.1 * S + .15 * sin(t * 2), p.z));
      if (p === me || !p.av.visible) { p.tag.style.display = 'none'; return; }
      const near = !game && Math.hypot(p.x - me.x, p.z - me.z) <= REACH;
      if (near !== p.near) { p.near = near; p.tag.classList.toggle('nw-tag--near', near); }
      const at = screen(p.x, p.y + (p.rest ? 1.3 : 1.95) * S, p.z), show = !!at && at[2] < 24 && (insideK < .5 || inHouse(p.x, p.z));
      pin(p.tag, show ? at : null);
      if (show) p.tag.style.opacity = at[2] > 16 ? String(1 - (at[2] - 16) / 8) : '1';
    });
    // "Sit" / "Sleep" / "Lie down" over resting places near you, and "Stand up" while you rest
    SPOTS.forEach(s => {
      if (!s.btn) {
        s.btn = document.createElement('button'); s.btn.type = 'button'; s.btn.className = 'nw-tag nw-rest';
        s.btn.textContent = (ICON[s.verb] || '') + ' ' + s.verb + ' · ' + s.label;
        s.btn.style.cssText = 'position:absolute;left:0;top:0;display:none;cursor:pointer;border:0;font:600 13px Figtree,sans-serif;padding:7px 12px;border-radius:999px;background:rgba(251,248,241,.94);color:#2B2A27;box-shadow:0 4px 14px rgba(43,42,39,.18);pointer-events:auto;white-space:nowrap';
        s.btn.onclick = e => { e.stopPropagation(); if (me && !game) goRest(me, s); };
        tagLayer.appendChild(s.btn);
      }
      const seat = s.seats[0].at, d = me ? Math.hypot(seat[0] - me.x, seat[2] - me.z) : 99;
      const show = !!me && !game && !me.rest && !me.want && d < NEAR_SPOT && s.taken.some(x => !x) && (insideK > .5) === !!s.inside;
      pin(s.btn, show ? screen(seat[0], seat[1] + 1.0, seat[2]) : null);
    });
    if (!standBtn) {
      standBtn = document.createElement('button'); standBtn.type = 'button'; standBtn.className = 'nw-tag nw-rest'; standBtn.textContent = 'Stand up';
      standBtn.style.cssText = 'position:absolute;left:0;top:0;display:none;cursor:pointer;border:0;font:600 13px Figtree,sans-serif;padding:7px 14px;border-radius:999px;background:#5E683C;color:#F8F4EC;box-shadow:0 4px 14px rgba(43,42,39,.2);pointer-events:auto';
      standBtn.onclick = e => { e.stopPropagation(); if (me) standUp(me); };
      tagLayer.appendChild(standBtn);
    }
    pin(standBtn, me && me.rest && !game && me.rest.k >= 1 ? screen(me.x, me.y + 1.5 * S, me.z) : null);
  }
  let standBtn = null;

  /* ---------- input ---------- */
  const onDown = e => { if (!active) return; try { canvas.setPointerCapture(e.pointerId); } catch (er) {} drag = { id: e.pointerId, x: e.clientX, y: e.clientY, yaw: view.yaw, el: view.el, moved: false, t: performance.now() }; canvas.style.cursor = 'grabbing'; };
  const onMove = e => {
    if (!drag && active && !game && e.pointerType === 'mouse') {
      const r = canvas.getBoundingClientRect(); let over = personAt(e.clientX - r.left, e.clientY - r.top);
      if (!over) { ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, cam); const h = ray.intersectObjects(clickable, false)[0]; over = h && h.object.visible && h.distance < 30; }
      canvas.style.cursor = over ? 'pointer' : 'grab';
    }
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 6) drag.moved = true;
    if (drag.moved) { auto = null; view.yaw = drag.yaw - dx * .006; view.el = view.e = Math.max(.12, Math.min(1.25, drag.el + dy * .005)); }
  };
  const visibleHit = list => list.find(h => { let o = h.object; while (o) { if (!o.visible) return false; o = o.parent; } return true; });
  const onUp = e => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag; drag = null; canvas.style.cursor = 'grab';
    if (!active || !me || game || d.moved || performance.now() - d.t > 500) return;
    const r = canvas.getBoundingClientRect(), who = personAt(e.clientX - r.left, e.clientY - r.top);
    if (who) return approach(who);
    ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, cam);
    // a resting place: go and rest there
    const hs = visibleHit(ray.intersectObjects(clickable, false)), shell = visibleHit(ray.intersectObjects(houseShell, true));
    const groundHit = visibleHit(ray.intersectObjects([I.ground, I.parts.House_Floor].filter(Boolean), true));
    if (shell && (!hs || shell.distance < hs.distance) && (!groundHit || shell.distance < groundHit.distance)) {   // the house from outside: go to the door
      standUp(me); me.chase = null; me.path = route(me, DOOR_OUT[0], DOOR_OUT[1]); me.stuck = 0; mark.position.set(DOOR_OUT[0], groundY(DOOR_OUT[0], DOOR_OUT[1]) + .05, DOOR_OUT[1]); return;
    }
    if (hs && hs.distance < 30 && (!groundHit || hs.distance <= groundHit.distance + .05)) { goRest(me, spotOf.get(hs.object)); mark.visible = false; return; }
    // a plain click or tap on the ground (or the dock): walk there
    let spot = null; const k = (D.deck - ray.ray.origin.y) / ray.ray.direction.y;
    if (k > 0) { ray.ray.at(k, v3); if (onDock(v3.x, v3.z) && !onLand(v3.x, v3.z)) spot = [v3.x, v3.z]; }
    if (!spot && groundHit && (onLand(groundHit.point.x, groundHit.point.z) || inHouse(groundHit.point.x, groundHit.point.z))) spot = [groundHit.point.x, groundHit.point.z];
    if (!spot) return;
    standUp(me); me.chase = null;
    me.path = route(me, spot[0], spot[1]); me.stuck = 0; mark.position.set(spot[0], groundY(spot[0], spot[1]) + .05, spot[1]);
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
      // on the beach by the dock, facing the island; a little to one side so two people who join together do not stand in each other
      const sp = J.spawn, side = (Math.random() - .5) * 1.6, at = [sp.at[0] + D.side[0] * side, sp.at[1] + D.side[1] * side];
      me = add(Object.assign({}, meDef, { kind: 'me' }), { at: canStand(at[0], at[1]) ? at : sp.at, ry: sp.yaw });
      others.forEach(o => add(o));
      Object.assign(view, { yaw: sp.yaw + PI, el: .42, dist: 5.2, d: 30, e: .68 });   // starts high like the home view, then swoops down
      tgt.set(me.x, me.y + 1.5 * S, me.z);
    },
    leave() { [...people.keys()].forEach(remove); me = null; auto = saved = null; active = false; game = null; drag = null; keys.clear(); joy.x = joy.y = 0; mark.visible = false; SPOTS.forEach(s => { s.taken = s.taken.map(() => null); if (s.btn) s.btn.style.display = 'none'; }); if (standBtn) standBtn.style.display = 'none'; I.freeze(false); insideK = 0; house(1); },
    active: () => active,
    add, remove, has: id => people.has(id), count: () => people.size,
    // for worldgame.js: the people, the camera settings, and handing over control while a match runs
    S, WALK, view, groundY, me: () => me, person: id => people.get(id), each: fn => people.forEach(fn),
    // where a point of the island is on the screen, in pixels (null when it is behind the camera)
    project(x, y, z) { v3.set(x, y, z).project(cam); return v3.z < 1 && v3.z > -1 ? [(v3.x * .5 + .5) * W, (-v3.y * .5 + .5) * H_] : null; },
    setGame(g) { game = g; if (me) { me.goal = me.chase = null; me.path = null; } if (g) people.forEach(p => { if (p.rest || p.want) standUp(p, true); p.leave = null; }); keys.clear(); joy.x = joy.y = 0; },
    hold(id, sec) { const p = people.get(id); if (p) p.holdUntil = performance.now() / 1000 + sec; },
    // where someone in another window says they are
    remote(id, s) {
      const p = people.get(id); if (!p || !s || ![s.x, s.z, s.ry].every(Number.isFinite) || Math.hypot(s.x, s.z) > 40) return;
      if (!p.net) { p.x = s.x; p.z = s.z; p.ry = s.ry; p.y = groundY(p.x, p.z); }
      const rest = Array.isArray(s.rest) && typeof s.rest[0] === 'string' && Number.isInteger(s.rest[1]) ? [s.rest[0], s.rest[1]] : null;
      p.net = { x: s.x, z: s.z, ry: s.ry, wv: !!s.wv, rest };
    },
    state: () => me && { x: +me.x.toFixed(2), z: +me.z.toFixed(2), ry: +me.ry.toFixed(2), wv: performance.now() / 1000 < me.waveUntil, rest: me.rest ? [me.rest.spot.key, me.rest.i] : null },
    wave() { if (me) me.waveUntil = performance.now() / 1000 + 1.8; },
    setJoy(x, y) { joy.x = x; joy.y = y; },
    // resting from code (buttons elsewhere; in the console nookWorld.world.rest('bed')): 'bed', 'sofa', 'armchair', 'bench', 'hammock', 'fire', 'dock', 'towels'
    rest(key) { const s = SPOTS.find(x => x.key === key); return !!(me && s && !game && goRest(me, s)); },
    standUp() { if (me) standUp(me); },
    spots: () => SPOTS.map(s => ({ key: s.key, label: s.label, verb: s.verb, free: s.taken.filter(x => !x).length })),
    // called once a frame by nook3d.js while the world is on screen
    tick(t, dt) {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (w && h && (w !== W || h !== H_)) { W = w; H_ = h; cam.aspect = w / h; cam.updateProjectionMatrix(); }
      I.freeze(!!game);
      if (!active || !me) { cam.position.set(24, 26, 34); cam.lookAt(0, 1, 0); renderer.render(isl, cam); return; }
      if (game) game.step(t, dt);
      else { driveMe(dt); people.forEach(p => { if (p === me) return; if (p.kind === 'remote') driveRemote(p, t, dt); else think(p, t, dt); }); }
      people.forEach(p => settle(p, t, dt));
      if (game) game.pose(t, dt);
      const goal = me.path && me.path.length ? me.path[me.path.length - 1] : null;
      mark.visible = !!goal && goal[2] !== 'seat' && !game; if (mark.visible) mark.scale.setScalar(1 + .12 * sin(t * 6));
      aim(dt); if (game && game.camera) game.camera(cam, dt);   // a game can take the camera over (first person, fpv.js)
      house(dt);
      tags(t);
      renderer.render(isl, cam);
    },
    dispose() {
      api.leave(); isl.remove(mark); mark.geometry.dispose(); mark.material.dispose();
      SPOTS.forEach(s => { if (s.btn) s.btn.remove(); }); if (standBtn) standBtn.remove();
      canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointermove', onMove); canvas.removeEventListener('pointerup', onUp); canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); window.removeEventListener('blur', onBlur);
    }
  };
  return api;
}
