// Rocket race for the World games (worldgame.js). You and the other player fly the same asteroid field in space;
// the first through the finish gate wins. Steer with your body (lean or step left and right, crouch to dive, stand
// tall to climb) or the keys. Hitting an asteroid is a crash: the ship spins, slows right down and has to build its
// speed up again.
// The course comes from a seed, so both windows build exactly the same asteroids. Everything sits in one group far
// above the arena; worldgame.js puts the camera in your cockpit once the drone has flown into your face.
// Course axes: the ships fly along -z, x is left and right, y is up and down.

export const RACE = { W: 5.5, H: 3, SPEED: 17, SHIP_R: 0.4 };

function rand(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// o: { seed, length, origin (Vector3), mineColor, oppColor, ai (true: the computer flies the other ship) }
export function createRace(T, o) {
  const { W, H, SPEED, SHIP_R } = RACE, L = o.length, r = rand(o.seed);
  const g = new T.Group(); g.name = 'RocketRace'; g.position.copy(o.origin);
  const owned = [];
  const keep = x => { owned.push(x); return x; };

  /* ---------- the asteroid field ---------- */
  const ast = [];
  const n = Math.round(L / 2.4);
  for (let i = 0; i < n; i++) {
    const z = 34 + r() * (L - 54), big = r() < 0.12;
    ast.push({ x: (r() * 2 - 1) * (W + 1.2), y: (r() * 2 - 1) * (H + 0.8), z, rad: big ? 1.4 + r() * 0.9 : 0.45 + r() * r() * 1.1, a: r() * 6.3, b: r() * 6.3, sx: 0.85 + r() * 0.35, sy: 0.8 + r() * 0.35 });
  }
  ast.sort((p, q) => p.z - q.z);
  const rock = keep(new T.MeshStandardMaterial({ color: '#8C7D6E', roughness: 1, flatShading: true }));
  const rockGeo = keep(new T.DodecahedronGeometry(1, 0));
  const field = new T.InstancedMesh(rockGeo, rock, ast.length), d = new T.Object3D(), col = new T.Color();
  ast.forEach((s, i) => {
    d.position.set(s.x, s.y, -s.z); d.rotation.set(s.a, s.b, 0); d.scale.set(s.rad * s.sx, s.rad * s.sy, s.rad); d.updateMatrix();
    field.setMatrixAt(i, d.matrix); field.setColorAt(i, col.set(['#8C7D6E', '#7A6F66', '#9A8574', '#6E6A70'][i % 4]));
  });
  field.instanceMatrix.needsUpdate = true; g.add(field);

  /* ---------- distance rings every 100 m, and the finish gate ---------- */
  const ringMat = keep(new T.MeshBasicMaterial({ color: '#3C9A58', transparent: true, opacity: 0.45 }));
  const ringGeo = keep(new T.TorusGeometry(W + 2.4, 0.07, 6, 48));
  for (let z = 100; z < L - 20; z += 100) { const ring = new T.Mesh(ringGeo, ringMat); ring.position.z = -z; ring.scale.y = (H + 1.8) / (W + 2.4); g.add(ring); }
  const gateMat = keep(new T.MeshBasicMaterial({ color: '#F2C14E' }));
  const gate = new T.Mesh(keep(new T.TorusGeometry(W + 2.6, 0.32, 10, 64)), gateMat); gate.position.z = -L; gate.scale.y = (H + 2) / (W + 2.6); g.add(gate);
  const flagMat = keep(new T.MeshBasicMaterial({ color: '#F8F4EC', transparent: true, opacity: 0.18, side: T.DoubleSide }));
  const flag = new T.Mesh(keep(new T.PlaneGeometry((W + 2.6) * 2, (H + 2) * 2)), flagMat); flag.position.z = -L; g.add(flag);

  /* ---------- stars (they travel with you, so they look infinitely far) and speed streaks ---------- */
  const sky = new T.Group(); g.add(sky);
  const sp = [];
  for (let i = 0; i < 1400; i++) { const u = r() * 2 - 1, a = r() * 6.283, q = Math.sqrt(1 - u * u); sp.push(Math.cos(a) * q * 160, u * 160, Math.sin(a) * q * 160); }
  const starGeo = keep(new T.BufferGeometry()); starGeo.setAttribute('position', new T.Float32BufferAttribute(sp, 3));
  sky.add(new T.Points(starGeo, keep(new T.PointsMaterial({ color: '#FFFFFF', size: 1.6, sizeAttenuation: false, fog: false }))));
  const NS = 70, streak = new Float32Array(NS * 6), sz = new Float32Array(NS);
  const spawnStreak = (i, z0) => { const a = r() * 6.283, rr = 2 + r() * 7; streak[i * 6] = streak[i * 6 + 3] = Math.cos(a) * rr; streak[i * 6 + 1] = streak[i * 6 + 4] = Math.sin(a) * rr * 0.7; sz[i] = z0; };
  for (let i = 0; i < NS; i++) spawnStreak(i, -r() * 60);
  const streakGeo = keep(new T.BufferGeometry()); streakGeo.setAttribute('position', new T.BufferAttribute(streak, 3));
  const streaks = new T.LineSegments(streakGeo, keep(new T.LineBasicMaterial({ color: '#BFD8FF', transparent: true, opacity: 0.55, fog: false })));
  streaks.frustumCulled = false; g.add(streaks);

  /* ---------- the two ships ---------- */
  const shipGeo = { body: keep(new T.CylinderGeometry(0.16, 0.22, 0.9, 12).rotateX(Math.PI / 2)), nose: keep(new T.ConeGeometry(0.16, 0.42, 12).rotateX(-Math.PI / 2)),
    wing: keep(new T.BoxGeometry(0.9, 0.04, 0.32)), fin: keep(new T.BoxGeometry(0.04, 0.26, 0.26)), glow: keep(new T.SphereGeometry(0.15, 12, 8)) };
  const white = keep(new T.MeshStandardMaterial({ color: '#F3EEE6', roughness: 0.6, flatShading: true }));
  const flame = keep(new T.MeshBasicMaterial({ color: '#FFB347' }));
  function ship(colour) {
    const s = new T.Group(), c = keep(new T.MeshStandardMaterial({ color: colour, roughness: 0.7, flatShading: true }));
    const add = (geo, mat, x, y, z) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); s.add(m); return m; };
    add(shipGeo.body, white, 0, 0, 0); add(shipGeo.nose, c, 0, 0, -0.66);
    add(shipGeo.wing, c, 0, -0.02, 0.18); add(shipGeo.fin, c, 0, 0.14, 0.32);
    const f = add(shipGeo.glow, flame, 0, 0, 0.5); f.scale.set(0.9, 0.9, 1.6); s.userData.flame = f;
    return s;
  }
  const me = { z: 0, x: 0, y: 0, v: 0, crashes: 0, crashT: 0, done: false, bank: 0, ship: ship(o.mineColor || '#4C5FA8') };
  const them = { z: 0, x: 0, y: 0, v: 0, crashes: 0, crashT: 0, done: false, bank: 0, ship: ship(o.oppColor || '#C2452D'), tx: 0, ty: 0, wander: 0, crashIn: 4 + r() * 8 };
  [me, them].forEach(s => g.add(s.ship));

  // asteroids near a z (the field is sorted by z)
  function near(z, span) {
    let lo = 0, hi = ast.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (ast[mid].z < z - span) lo = mid + 1; else hi = mid; }
    const out = []; for (let i = lo; i < ast.length && ast[i].z < z + span; i++) out.push(ast[i]); return out;
  }
  function crash(s, events, who) {
    s.crashT = 1.3; s.v = 2.5; s.crashes++; events.push({ who, kind: 'crash', crashes: s.crashes });
  }
  function fly(s, dt) {
    s.crashT = Math.max(0, s.crashT - dt);
    const want = s.crashT > 0 ? 2.5 : SPEED;
    s.v += (want - s.v) * Math.min(1, dt * (s.crashT > 0 ? 6 : 0.9));
    s.z = Math.min(L, s.z + s.v * dt);
  }

  const api = {
    group: g, length: L, me, them,
    // input: where you are steering, x and y from -1 to 1. Returns what happened this frame: [{ who: 'me' | 'them', kind: 'crash' | 'finish' }]
    update(dt, input, t) {
      const events = [];
      if (!me.done) {
        const tx = clamp(input.x, -1, 1) * W, ty = clamp(input.y, -1, 1) * H, k = Math.min(1, dt * 5.5);
        const ox = me.x; me.x += (tx - me.x) * k; me.y += (ty - me.y) * k;
        me.bank += ((me.x - ox) / Math.max(dt, 1e-3) * -0.09 - me.bank) * Math.min(1, dt * 6);
        fly(me, dt);
        if (me.crashT <= 0) for (const a of near(me.z, 3)) {
          if ((a.x - me.x) ** 2 + (a.y - me.y) ** 2 + (a.z - me.z) ** 2 < (a.rad * 0.92 + SHIP_R) ** 2) { crash(me, events, 'me'); me.x += Math.sign(me.x - a.x || 1) * 0.4; break; }
        }
        if (me.z >= L) { me.done = true; events.push({ who: 'me', kind: 'finish' }); }
      }
      if (o.ai && !them.done) {   // the computer: wanders across the field and crashes now and then
        them.wander -= dt; if (them.wander <= 0) { them.wander = 0.8 + r() * 1.6; them.tx = (r() * 2 - 1) * W * 0.8; them.ty = (r() * 2 - 1) * H * 0.7; }
        const k = Math.min(1, dt * 2.2); them.x += (them.tx - them.x) * k; them.y += (them.ty - them.y) * k;
        fly(them, dt); them.z = Math.min(L, them.z - them.v * dt * 0.04);   // a touch slower than a clean run of yours
        if (them.crashT <= 0) { them.crashIn -= dt; if (them.crashIn <= 0) { crash(them, events, 'them'); them.crashIn = 5 + r() * 9; } }
        if (them.z >= L) { them.done = true; events.push({ who: 'them', kind: 'finish' }); }
      }
      // draw
      [me, them].forEach(s => {
        const spin = s.crashT > 0 ? (1.3 - s.crashT) * 9 : 0;
        s.ship.position.set(s.x, s.y, -s.z); s.ship.rotation.set(0, 0, s.bank + spin);
        const fl = s.ship.userData.flame; fl.scale.z = 1.2 + (s.v / SPEED) * 1.3 + 0.2 * Math.sin(t * 40); fl.visible = s.crashT <= 0 || Math.sin(t * 30) > 0;
      });
      sky.position.set(me.x, me.y, -me.z);
      for (let i = 0; i < NS; i++) {   // streaks rush past at your speed
        sz[i] += me.v * dt * 1.6; if (sz[i] > 4) spawnStreak(i, -50 - r() * 30);
        const zz = -me.z + sz[i], len = 0.4 + me.v * 0.06;
        streak[i * 6 + 2] = zz; streak[i * 6 + 5] = zz - len;
      }
      streakGeo.attributes.position.needsUpdate = true; streaks.position.set(me.x * 0.3, me.y * 0.3, 0);
      gate.rotation.z = t * 0.3;
      return events;
    },
    // the other player in another window: [z, x, y, crashes, done]. Returns their new crashes, if any, as events.
    setThem(a) {
      const ev = [];
      if (!Array.isArray(a) || a.length < 5 || !a.every(Number.isFinite)) return ev;
      them.z = clamp(a[0], 0, L); them.x = clamp(a[1], -W - 1, W + 1); them.y = clamp(a[2], -H - 1, H + 1);
      const c = Math.max(0, Math.min(999, Math.round(a[3])));
      if (c > them.crashes) { them.crashT = 1.3; ev.push({ who: 'them', kind: 'crash', crashes: c }); }
      them.crashes = c;
      if (a[4] && !them.done) { them.done = true; ev.push({ who: 'them', kind: 'finish' }); }
      return ev;
    },
    out: () => [+me.z.toFixed(2), +me.x.toFixed(2), +me.y.toFixed(2), me.crashes, me.done ? 1 : 0],
    progress: () => [me.z / L, them.z / L],
    // your cockpit: just behind the nose, looking down the course; the view banks as you turn and shakes in a crash
    camera(cam, t) {
      const shake = me.crashT > 0 ? me.crashT * 0.08 : 0;
      cam.position.set(g.position.x + me.x + Math.sin(t * 61) * shake, g.position.y + me.y + 0.3 + Math.cos(t * 53) * shake, g.position.z - me.z + 0.7);
      cam.up.set(0, 1, 0);
      cam.lookAt(g.position.x + me.x * 0.92, g.position.y + me.y + 0.12, g.position.z - me.z - 12);
      cam.rotateZ(me.bank * 0.6);
    },
    dispose() { g.removeFromParent(); field.dispose(); owned.forEach(x => x.dispose && x.dispose()); }
  };
  return api;
}
