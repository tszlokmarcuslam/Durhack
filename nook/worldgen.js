// Generated worlds for Nook's island.
// A world is a seed. Everyone who has the seed builds exactly the same look, so friends in one world share one map.
//  - generateWorld(seed): what the world is (name, theme, time of day, colours, how many decorations)
//  - dressIsland(T, kit, spec): puts that look on the island: recolours it, sets the time of day, scatters
//    decorations on free ground and adds falling petals / leaves / snow or fireflies. dispose() puts the island
//    back exactly as it was (the home screen and the open island use the plain look).

// small seeded random numbers (mulberry32)
export function rand(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const newSeed = () => ((Math.random() * 2147483647) >>> 0) || 1;

// colours are island material names (anime/island.glb) -> new colour
export const THEMES = [
  { key: 'summer', label: 'Summer', emoji: '🌴', colour: '#8cc66b', adj: ['Sunny', 'Breezy', 'Honey'], flowers: ['#f78cb8', '#ffd84d', '#ffffff', '#7fa8f5'], mats: {} },
  { key: 'autumn', label: 'Autumn', emoji: '🍂', colour: '#e39a3b', adj: ['Maple', 'Amber', 'Cider'], fx: 'leaves', ground: '#f3dcae', flowers: ['#e0703a', '#f2b33d', '#b9473a', '#f5e3c0'], extra: 'pumpkin',
    mats: { Leaves: '#c75f2e', LeavesLight: '#e9a13e', PalmLeaf: '#b9a24a', Pine: '#56743a', Veg: '#a08b37', LilyPad: '#8ba145', Stem: '#7d7a32' } },
  { key: 'blossom', label: 'Blossom', emoji: '🌸', colour: '#f2a6c2', adj: ['Sakura', 'Petal', 'Rosy'], fx: 'petals', ground: '#fdf3f2', flowers: ['#f7a8c8', '#ffffff', '#f5d0e0', '#e57aa6'],
    mats: { Leaves: '#ee97b8', LeavesLight: '#f7c2d6', FlowerYellow: '#ffd3e4', PalmLeaf: '#79c08a' } },
  { key: 'frost', label: 'Frost', emoji: '❄️', colour: '#a9cfe6', adj: ['Frosty', 'Snowy', 'Glacier'], fx: 'snow', ground: '#e6eef8', flowers: ['#ffffff', '#cfe4f5', '#a9c8f0', '#e9e2f7'], extra: 'crystal',
    mats: { Leaves: '#d3e4ee', LeavesLight: '#f1f6f9', Pine: '#3d6d66', PalmLeaf: '#a6c9bb', Veg: '#cde2df', LilyPad: '#b3d2ce', Water: '#a6d8ee', Stem: '#8fb3a9' } },
  { key: 'tropic', label: 'Tropic', emoji: '🦜', colour: '#3ec77d', adj: ['Mango', 'Parrot', 'Coconut'], flowers: ['#ff5aa0', '#ffc21a', '#ff7a3d', '#ffffff'], extra: 'shell',
    mats: { Leaves: '#1e9a61', LeavesLight: '#3ec77d', PalmLeaf: '#2bb067', FlowerPink: '#ff5aa0', FlowerYellow: '#ffc21a' } },
  { key: 'dreamy', label: 'Dreamy', emoji: '💜', colour: '#b49ce6', adj: ['Moonlit', 'Velvet', 'Starry'], fx: 'fireflies', ground: '#f1ecfb', flowers: ['#c78af0', '#f2b6ff', '#ffffff', '#8fb1ff'], extra: 'crystal',
    mats: { Leaves: '#8a6bc8', LeavesLight: '#b49ce6', PalmLeaf: '#6fae86', FlowerPink: '#c78af0', Pine: '#4b5f8c' } }
];
const TIMES = [['Sunrise', 7], ['Morning', 10], ['Midday', 13], ['Afternoon', 15.5], ['Golden hour', 17.3], ['Sunset', 18.6], ['Night', 22.5]];
const ROOFS = [['#cf5e45', '#a8473b'], ['#3f7fd0', '#2d62a6'], ['#4f9a64', '#3a7a4c'], ['#8a5cc9', '#6b44a3'], ['#e0a530', '#b98420'], ['#e2708f', '#b9506d']];
const WALLS = ['#f5ebd2', '#f8dde2', '#dff0e6', '#e7e3f8', '#fdf3c8'];
const DOORS = ['#4f8f6b', '#3d6fb5', '#b9694c', '#7a55b0', '#c48a2e'];
const BOATS = ['#d9534f', '#3f7fd0', '#e0a530', '#4f9a64'];
const ADJ = ['Sleepy', 'Coral', 'Misty', 'Pebble', 'Lantern', 'Clover', 'Peach', 'Willow', 'Cosy', 'Bubble', 'Lucky', 'Minty', 'Cocoa', 'Hidden', 'Tiny'];
const NOUN = ['Cove', 'Lagoon', 'Bay', 'Isle', 'Hollow', 'Harbour', 'Grove', 'Shore', 'Reef', 'Nook', 'Point', 'Haven', 'Sands', 'Island'];

export function generateWorld(seed) {
  seed = (seed >>> 0) || 1;
  const r = rand(seed), pick = a => a[Math.floor(r() * a.length)];
  const th = pick(THEMES), time = pick(TIMES), roof = pick(ROOFS), wall = pick(WALLS), door = pick(DOORS), boat = pick(BOATS);
  const name = (r() < 0.55 ? pick(th.adj) : pick(ADJ)) + ' ' + pick(NOUN);
  const night = time[1] >= 20 || time[1] < 5;
  return {
    seed, name, theme: th.key, themeLabel: th.label, emoji: th.emoji, colour: th.colour, time: time[0], hour: time[1],
    roof, wall, door, boat, deco: 40 + Math.floor(r() * 30), fx: night && !th.fx ? 'fireflies' : th.fx || null,
    swatches: [th.colour, roof[0], wall, door, th.flowers[0]]
  };
}

// a soft round dot for the particles
function dotTexture(T) {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d'), rg = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(0.55, 'rgba(255,255,255,.85)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = rg; g.fillRect(0, 0, 32, 32);
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
}

export function dressIsland(T, kit, spec) {
  const I = kit.island, J = I.json, w = generateWorld(spec.seed), th = THEMES.find(t => t.key === w.theme) || THEMES[0];
  const r = rand((w.seed ^ 0x9e3779b9) >>> 0), hAt = kit.hAt;

  /* 1. colours (remember the originals for dispose) */
  const saved = new Map();
  const want = Object.assign({}, th.mats, { Roof: w.roof[0], RoofDark: w.roof[1], Wall: w.wall, Door: w.door, BoatRed: w.boat });
  if (th.ground) want.GroundTint = th.ground;
  I.root.traverse(n => {
    const m = n.isMesh ? n.material : null;
    if (!m || !m.color || !(m.name in want) || saved.has(m)) return;
    saved.set(m, m.color.clone()); m.color.set(want[m.name]);
  });

  /* 2. time of day (the sky, sea and lights follow it) */
  I.setHour(w.hour);

  /* 3. decorations on free ground */
  const g = new T.Group(); g.name = 'WorldDeco';
  let tone = null; I.root.traverse(n => { if (!tone && n.material && n.material.gradientMap) tone = n.material.gradientMap; });
  const owned = [];   // geometries and materials to free in dispose()
  const M = (color, extra) => { const m = new T.MeshToonMaterial(Object.assign({ color, gradientMap: tone }, extra)); owned.push(m); return m; };
  const Gm = geo => { owned.push(geo); return geo; };
  const IN = J.house.inside, P = J.pond, S = J.spawn.at;
  const free = (x, z) => {
    if (!(hAt(x, z) > J.walk_min + 0.06)) return false;
    if (J.circles.some(c => (x - c[0]) ** 2 + (z - c[1]) ** 2 < (c[2] + 0.35) ** 2)) return false;
    if (J.boxes.some(b => (x - b[0]) ** 2 + (z - b[1]) ** 2 < (Math.hypot(b[2], b[3]) + 0.35) ** 2)) return false;
    if (x > IN[0] - 0.6 && x < IN[2] + 0.6 && z > IN[1] - 0.6 && z < IN[3] + 0.6) return false;
    if (((x - P.centre[0]) / (P.r[0] + 0.5)) ** 2 + ((z - P.centre[1]) / (P.r[1] + 0.5)) ** 2 < 1) return false;
    return (x - S[0]) ** 2 + (z - S[1]) ** 2 > 2.6;
  };
  const spots = [];
  for (let tries = 0; spots.length < w.deco && tries < w.deco * 50; tries++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * J.grid.r * 0.95, x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (free(x, z) && spots.every(s => (s.x - x) ** 2 + (s.z - z) ** 2 > 0.5)) spots.push({ x, z, y: hAt(x, z), ry: r() * Math.PI * 2, k: 0.8 + r() * 0.5, u: r() });
  }
  const kinds = { flower: [], rock: [], mushroom: [], lantern: [], extra: [] };
  spots.forEach(s => { const u = s.u; kinds[u < 0.42 ? 'flower' : u < 0.57 ? 'rock' : u < 0.72 ? 'mushroom' : u < 0.82 ? 'lantern' : th.extra ? 'extra' : 'flower'].push(s); });
  const o = new T.Object3D(), col = new T.Color();
  function inst(geo, mat, list, place, colour) {
    if (!list.length) return null;
    const im = new T.InstancedMesh(geo, mat, list.length);
    list.forEach((s, i) => { o.position.set(0, 0, 0); o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1); place(o, s, i); o.updateMatrix(); im.setMatrixAt(i, o.matrix); if (colour) im.setColorAt(i, col.set(colour(s, i))); });
    im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.receiveShadow = true; im.castShadow = false; g.add(im); return im;
  }
  // flowers: three heads on stems
  const fl = []; kinds.flower.forEach(s => { for (let k = 0; k < 3; k++) { const a = s.ry + k * 2.1, d = 0.08 + 0.06 * k; fl.push({ x: s.x + Math.cos(a) * d, z: s.z + Math.sin(a) * d, y: s.y, h: (0.16 + 0.07 * k) * s.k, c: th.flowers[Math.floor((s.u * 97 + k * 31) % th.flowers.length)] }); } });
  inst(Gm(new T.CylinderGeometry(0.011, 0.013, 1, 5).translate(0, 0.5, 0)), M('#5f9a4a'), fl, (q, f) => { q.position.set(f.x, f.y, f.z); q.scale.set(1, f.h, 1); });
  inst(Gm(new T.SphereGeometry(0.055, 10, 7)), M('#ffffff'), fl, (q, f) => { q.position.set(f.x, f.y + f.h, f.z); q.scale.set(1, 0.8, 1); }, f => f.c);
  // rocks
  inst(Gm(new T.DodecahedronGeometry(0.17, 0)), M('#b3aa9c'), kinds.rock, (q, s) => { q.position.set(s.x, s.y + 0.05, s.z); q.rotation.set(s.u * 3, s.ry, s.u * 2); q.scale.set(s.k * 1.2, s.k * 0.7, s.k); });
  // mushrooms
  const capC = th.key === 'frost' ? '#9cc4e8' : th.key === 'dreamy' ? '#b07be0' : '#d9483b';
  inst(Gm(new T.CylinderGeometry(0.035, 0.045, 0.14, 7).translate(0, 0.07, 0)), M('#f3ead7'), kinds.mushroom, (q, s) => { q.position.set(s.x, s.y, s.z); q.scale.setScalar(s.k); });
  inst(Gm(new T.SphereGeometry(0.12, 12, 7, 0, Math.PI * 2, 0, Math.PI / 2)), M(capC), kinds.mushroom, (q, s) => { q.position.set(s.x, s.y + 0.13 * s.k, s.z); q.scale.set(s.k, s.k * 0.8, s.k); });
  // lanterns: they glow at night
  const lampMat = M('#ffe3a3', { emissive: new T.Color('#ffc861'), emissiveIntensity: 0.2 });
  inst(Gm(new T.CylinderGeometry(0.022, 0.028, 0.7, 6).translate(0, 0.35, 0)), M('#5a3d2b'), kinds.lantern, (q, s) => { q.position.set(s.x, s.y, s.z); });
  inst(Gm(new T.BoxGeometry(0.13, 0.15, 0.13)), lampMat, kinds.lantern, (q, s) => { q.position.set(s.x, s.y + 0.74, s.z); q.rotation.y = s.ry; });
  // the theme's own thing
  if (th.extra === 'pumpkin') inst(Gm(new T.SphereGeometry(0.16, 12, 9)), M('#ea8a2c'), kinds.extra, (q, s) => { q.position.set(s.x, s.y + 0.1 * s.k, s.z); q.scale.set(s.k, s.k * 0.72, s.k); q.rotation.y = s.ry; });
  if (th.extra === 'crystal') inst(Gm(new T.OctahedronGeometry(0.17, 0)), M(th.key === 'frost' ? '#cfeaff' : '#d6b8ff', { emissive: new T.Color(th.key === 'frost' ? '#6fb6e8' : '#9a6be0'), emissiveIntensity: 0.35 }), kinds.extra, (q, s) => { q.position.set(s.x, s.y + 0.16 * s.k, s.z); q.scale.set(s.k * 0.7, s.k * 1.3, s.k * 0.7); q.rotation.y = s.ry; });
  if (th.extra === 'shell') inst(Gm(new T.ConeGeometry(0.1, 0.14, 7)), M('#f7d9c4'), kinds.extra, (q, s) => { q.position.set(s.x, s.y + 0.05, s.z); q.rotation.set(Math.PI / 2.4, s.ry, 0); q.scale.setScalar(s.k); });

  /* 4. weather: falling leaves / petals / snow, or fireflies */
  let fx = null;
  if (w.fx) {
    const N = w.fx === 'fireflies' ? 80 : 260, pos = new Float32Array(N * 3), ph = new Float32Array(N), base = new Float32Array(N * 2);
    for (let i = 0; i < N; i++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 18; base[i * 2] = Math.cos(a) * d; base[i * 2 + 1] = Math.sin(a) * d; ph[i] = r() * 100;
      pos[i * 3] = base[i * 2]; pos[i * 3 + 1] = r() * 9; pos[i * 3 + 2] = base[i * 2 + 1];
    }
    const geo = Gm(new T.BufferGeometry()); geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    const tex = dotTexture(T); owned.push(tex);
    const mat = new T.PointsMaterial({ color: { leaves: '#e0843a', petals: '#f7b2cc', snow: '#ffffff', fireflies: '#fff2a0' }[w.fx], map: tex, size: { leaves: 0.2, petals: 0.17, snow: 0.13, fireflies: 0.17 }[w.fx], transparent: true, depthWrite: false, blending: w.fx === 'fireflies' ? T.AdditiveBlending : T.NormalBlending });
    owned.push(mat);
    const pts = new T.Points(geo, mat); pts.frustumCulled = false; pts.name = 'WorldWeather'; g.add(pts);
    fx = { N, pos, ph, base, geo, mat, kind: w.fx };
  }
  I.root.parent.add(g);

  return {
    spec: w,
    update(t, dt) {
      const night = I.night ? I.night() : 0;
      lampMat.emissiveIntensity = 0.15 + 1.7 * night;
      if (!fx) return;
      const p = fx.pos, step = Math.min(dt, 0.05);
      for (let i = 0; i < fx.N; i++) {
        const k = i * 3, q = fx.ph[i];
        if (fx.kind === 'fireflies') {
          const bx = fx.base[i * 2], bz = fx.base[i * 2 + 1], x = bx + Math.sin(t * 0.31 + q) * 0.9, z = bz + Math.cos(t * 0.27 + q * 1.3) * 0.9;
          const gnd = Math.max(hAt(x, z), 0);
          p[k] = x; p[k + 2] = z; p[k + 1] = gnd + 0.5 + 0.9 * (0.5 + 0.5 * Math.sin(t * 0.6 + q * 2.1));
        } else {
          const fall = fx.kind === 'snow' ? 0.55 : fx.kind === 'leaves' ? 0.75 : 0.6, sway = fx.kind === 'snow' ? 0.18 : 0.55;
          p[k + 1] -= fall * step; p[k] += Math.sin(t * 1.3 + q) * sway * step; p[k + 2] += Math.cos(t * 1.1 + q) * sway * 0.6 * step;
          if (p[k + 1] < Math.max(hAt(p[k], p[k + 2]), 0)) { p[k] = fx.base[i * 2]; p[k + 2] = fx.base[i * 2 + 1]; p[k + 1] = 7 + (q % 3); }
        }
      }
      fx.geo.attributes.position.needsUpdate = true;
      if (fx.kind === 'fireflies') fx.mat.opacity = 0.25 + 0.75 * night;
    },
    dispose() {
      saved.forEach((c, m) => m.color.copy(c)); saved.clear();
      I.setHour(null);
      g.removeFromParent(); g.traverse(n => { if (n.isInstancedMesh) n.dispose(); });
      owned.forEach(x => x.dispose && x.dispose());
    }
  };
}
