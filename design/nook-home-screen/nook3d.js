// Nook 3D scenes. Everything here is procedural placeholder art (no authored model files).
const PI = Math.PI, TAU = PI * 2, sin = Math.sin, cos = Math.cos;

export const OPTIONS = {
  skin: ['#F4D3BC', '#E8B894', '#D49A6E', '#B87B52', '#8C5A3A', '#5E3B28'],
  face: ['Oval', 'Square', 'Round', 'Heart'],
  eyes: ['Almond', 'Round', 'Hooded', 'Upturned'],
  nose: ['Narrow', 'Broad', 'Long', 'Button'],
  lips: ['Thin', 'Medium', 'Full', 'Wide'],
  facialHair: ['None', 'Stubble', 'Moustache', 'Beard'],
  hairStyle: ['Buzz', 'Crop', 'Swept', 'Bob', 'Long', 'Bun', 'Bald'],
  hairTexture: ['Straight', 'Wavy', 'Curly', 'Coily'],
  hairColor: ['#2A2426', '#4A342A', '#6E4A32', '#5E2A2E', '#B08A5A', '#8E8C88'],
  build: ['Slim', 'Average', 'Broad', 'Curvy'],
  top: ['Overshirt', 'Jacket', 'Crewneck', 'Cardigan'],
  topColor: ['#B4A898', '#C08A3A', '#3A3234', '#5C5E78', '#5E683C', '#E9E2D4'],
  bottom: ['Trousers', 'Jeans', 'Cargos', 'Wide leg'],
  bottomColor: ['#2E2A2C', '#2F3B5C', '#5E603C', '#E0D2B8', '#6E5A48'],
  shoes: ['Sneakers', 'Boots', 'Loafers']
};
export const PRESETS = [
  { name: 'Jun', skin: 1, face: 0, eyes: 0, nose: 0, lips: 1, facialHair: 0, hairStyle: 2, hairTexture: 0, hairColor: 0, build: 1, top: 0, topColor: 0, bottom: 0, bottomColor: 0, shoes: 0 },
  { name: 'Amara', skin: 5, face: 0, eyes: 1, nose: 1, lips: 2, facialHair: 0, hairStyle: 3, hairTexture: 3, hairColor: 0, build: 3, top: 1, topColor: 1, bottom: 1, bottomColor: 1, shoes: 0 },
  { name: 'Mateo', skin: 3, face: 1, eyes: 2, nose: 2, lips: 1, facialHair: 1, hairStyle: 1, hairTexture: 2, hairColor: 1, build: 2, top: 2, topColor: 2, bottom: 2, bottomColor: 2, shoes: 1 },
  { name: 'Elena', skin: 0, face: 3, eyes: 3, nose: 3, lips: 2, facialHair: 0, hairStyle: 4, hairTexture: 1, hairColor: 3, build: 1, top: 3, topColor: 3, bottom: 3, bottomColor: 3, shoes: 2 },
  { name: 'Idris', skin: 4, face: 1, eyes: 0, nose: 1, lips: 2, facialHair: 3, hairStyle: 0, hairTexture: 3, hairColor: 0, build: 2, top: 2, topColor: 4, bottom: 0, bottomColor: 4, shoes: 1 },
  { name: 'Mei', skin: 1, face: 2, eyes: 2, nose: 3, lips: 0, facialHair: 0, hairStyle: 5, hairTexture: 0, hairColor: 0, build: 0, top: 1, topColor: 5, bottom: 3, bottomColor: 0, shoes: 2 }
];

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
  const disposeObj = o => o.traverse(m => { if (m.geometry && !m.geometry.userData.shared) m.geometry.dispose(); });

  /* ================= avatar (procedural placeholder mannequin) ================= */
  const BUILDS = [{ sh: .19, ch: .15, wa: .122, hip: .148, l: .92 }, { sh: .205, ch: .165, wa: .138, hip: .158, l: 1 }, { sh: .235, ch: .19, wa: .158, hip: .168, l: 1.14 }, { sh: .196, ch: .166, wa: .13, hip: .186, l: 1.02 }];
  const FACES = [{ jaw: .36, chin: 1.06, w: 1 }, { jaw: .2, chin: 1, w: 1.05 }, { jaw: .27, chin: .93, w: 1.08 }, { jaw: .48, chin: 1.08, w: 1.03 }];
  const HA = .086, HB = .118, HC = .098;
  const sculpt = (f, x, y, z) => { const jt = y < 0 ? 1 - f.jaw * Math.pow(-y, 1.3) : 1 - .05 * y * y, zt = y < 0 ? 1 + .2 * y : 1; return [x * HA * f.w * jt, y * HB * (y < 0 ? f.chin : 1), z * HC * zt * (z > 0 ? .93 : 1)]; };
  const faceZ = (f, x, y) => { const yn = Math.max(-.98, Math.min(.98, y / (HB * (y < 0 ? f.chin : 1)))), jt = yn < 0 ? 1 - f.jaw * Math.pow(-yn, 1.3) : 1 - .05 * yn * yn, zt = yn < 0 ? 1 + .2 * yn : 1, xr = x / (HA * f.w * jt); return Math.sqrt(Math.max(.03, 1 - xr * xr - yn * yn)) * HC * zt * .93 * .97; };
  const headGeo = (f, s, keep) => { const g = new T.IcosahedronGeometry(1, 2), p = g.attributes.position, out = []; for (let i = 0; i < p.count; i += 3) { const tri = [0, 1, 2].map(k => sculpt(f, p.getX(i + k), p.getY(i + k), p.getZ(i + k))), c = [0, 1, 2].map(k => (tri[0][k] + tri[1][k] + tri[2][k]) / 3); if (!keep || keep(c[0], c[1], c[2])) tri.forEach(v => out.push(v[0] * s, v[1] * s, v[2] * s)); } g.dispose(); const b = new T.BufferGeometry(); b.setAttribute('position', new T.Float32BufferAttribute(out, 3)); b.computeVertexNormals(); return b; };

  function buildAvatar(c) {
    const save = seed; seed = 21;
    const av = new T.Group(), body = G3(av, 0, 0, 0), B = BUILDS[c.build], f = FACES[c.face], lw = (B.l + 1) / 2;
    const skinC = OPTIONS.skin[c.skin], skin = M(skinC), hairC = OPTIONS.hairColor[c.hairColor], hair = M(hairC, { side: 2 });
    const topC = OPTIONS.topColor[c.topColor], top = M(topC, { side: 2 }), topD = M(mix(topC, '#000000', .14), { side: 2 }), botC = OPTIONS.bottomColor[c.bottomColor], bot = M(botC);
    const inner = M(['#3F4A38', '#F1ECE2', '#2E2A2C', '#2E2A2C'][c.top]);
    // legs + shoes
    const LEG = [[.1, .085], [.097, .08], [.108, .1], [.104, .15]][c.bottom], SH = [{ c: '#E9E2D4', sole: '#D2C8B4', h: .075, w: .1 }, { c: '#2F2B2C', sole: '#8A7F70', h: .1, w: .105 }, { c: '#3A2A22', sole: '#2A1E18', h: .055, w: .095 }][c.shoes];
    const legs = {}, arms = {}, elbows = {}, eyes = [];
    [1, -1].forEach(s => {
      const lg = G3(body, s * B.hip * .52, .9, 0);
      P(lg, frus(-.83, 0, [LEG[1] * lw, LEG[1] * lw * 1.08], [LEG[0] * lw, LEG[0] * lw * 1.08], 6), bot, [0, 0, 0]);
      if (c.bottom === 1) P(lg, frus(-.83, -.785, [LEG[1] * lw + .007, LEG[1] * lw * 1.08 + .007], [LEG[1] * lw + .007, LEG[1] * lw * 1.08 + .007], 6), M(mix(botC, '#ffffff', .16)), [0, 0, 0]);
      if (c.bottom === 2) { P(lg, BOX, M(mix(botC, '#000000', .08)), [s * LEG[0] * lw * .95, -.42, 0], [.035, .15, .12]); P(lg, BOX, M(mix(botC, '#000000', .16)), [s * LEG[0] * lw * .97, -.36, 0], [.04, .035, .125]); }
      P(lg, BOX, M(SH.sole), [0, -.887, .045], [SH.w + .012, .026, .275]);
      P(lg, BOX, M(SH.c), [0, -.875 + SH.h / 2, .035], [SH.w, SH.h, .25]);
      P(lg, BOX, M(SH.c), [0, -.875 + SH.h * .32, .15], [SH.w * .92, SH.h * .64, .06]);
      legs[s] = lg;
    });
    // pelvis, belt, torso
    const dz = .66;
    P(body, frus(.84, 1.05, [B.hip + .024, B.hip * .7], [B.wa + .004, B.wa * .72], 8), bot, [0, 0, 0]);
    P(body, frus(1.012, 1.05, [B.wa + .01, B.wa * .72 + .006], [B.wa + .01, B.wa * .72 + .006], 8), M('#4A3528'), [0, 0, 0]);
    P(body, frus(1.04, 1.3, [B.wa, B.wa * .72], [B.ch, B.ch * dz], 8), inner, [0, 0, 0]);
    P(body, frus(1.3, 1.44, [B.ch, B.ch * dz], [B.sh * .9, .088], 8), inner, [0, 0, 0]);
    P(body, frus(1.44, 1.5, [B.sh * .9, .088], [.06, .058], 8), inner, [0, 0, 0]);
    // top garment shell
    const TP = [{ e: .016, hem: .87, gap: .85, band: 0, collar: 1 }, { e: .03, hem: .97, gap: .7, band: 1, collar: 1 }, { e: .028, hem: .93, gap: 0, band: 1, collar: 0 }, { e: .02, hem: .5, gap: 1, band: 0, collar: 0 }][c.top], e = TP.e;
    const shell = (y0, y1, a0, a1, mat) => P(body, frus(y0, y1, a0, a1, 10, !!TP.gap, TP.gap / 2, TAU - TP.gap), mat || top, [0, 0, 0]);
    const hemR = c.top === 3 ? [B.hip + .06, B.hip * .7 + .05] : [Math.max(B.hip + .024, B.wa) + e, B.hip * .7 + e];
    shell(TP.hem, 1.3, hemR, [B.ch + e, B.ch * dz + e]);
    shell(1.3, 1.44, [B.ch + e, B.ch * dz + e], [B.sh * .9 + e, .088 + e]);
    shell(1.44, 1.505, [B.sh * .9 + e, .088 + e], [.066 + (TP.gap ? .018 : 0), .064 + (TP.gap ? .012 : 0)]);
    if (TP.band) shell(TP.hem - .045, TP.hem, [hemR[0] * .95, hemR[1] * .95], [hemR[0] * .98, hemR[1] * .98], topD);
    if (TP.collar) [1, -1].forEach(s => P(body, BOX, top, [s * .058, 1.492, .052], [.066, .012, .05], [.6, s * .5, s * .28]));
    if (c.top === 2) P(body, new T.TorusGeometry(.068, .014, 4, 8), topD, [0, 1.5, 0], null, [PI / 2, 0, 0]);
    if (c.top === 0) [1, -1].forEach(s => P(body, BOX, topD, [s * B.ch * .56, 1.3, (B.ch * dz + e) * .8 + .004], [.064, .06, .01], [0, s * .42, 0]));
    // arms
    const sr = [.052, .06, .062, .055][c.top] * lw;
    [1, -1].forEach(s => {
      const a = G3(body, s * (B.sh - .012), 1.42, 0); a.rotation.z = s * .07;
      P(a, ICO0, top, [0, -.005, 0], [sr * 1.05, sr * .95, sr * 1.05]);
      P(a, frus(-.3, .02, [sr * .85, sr * .85], [sr, sr], 6), top, [0, 0, 0]);
      const el = G3(a, 0, -.3, 0); el.rotation.x = -.18;
      P(el, frus(-.26, .012, [sr * .72, sr * .72], [sr * .87, sr * .87], 6), top, [0, 0, 0]);
      if (TP.band) P(el, frus(-.27, -.235, [sr * .66, sr * .66], [sr * .7, sr * .7], 6), topD, [0, 0, 0]);
      P(el, ICO0, skin, [0, -.31, 0], [.034, .052, .028]);
      arms[s] = a; elbows[s] = el;
    });
    P(body, frus(1.47, 1.57, [.058, .058], [.05, .054], 6), skin, [0, 0, 0]);
    // head + face
    const head = G3(body, 0, 1.645, 0);
    P(head, headGeo(f, 1), skin, [0, 0, 0]);
    const E = [{ w: .0165, h: .0088, t: .07, lid: .0026 }, { w: .0145, h: .0108, t: 0, lid: .0024 }, { w: .0165, h: .0068, t: .03, lid: .0042 }, { w: .0165, h: .0084, t: .22, lid: .0026 }][c.eyes];
    const ex = .034 * f.w, ey = .012, browM = M(mix(hairC, '#1E1614', .4));
    [1, -1].forEach(s => {
      const ee = G3(head, s * ex, ey, faceZ(f, ex, ey) + .0015); ee.rotation.set(0, s * .3, s * E.t);
      P(ee, OCT, M('#F4EDE0'), [0, 0, 0], [E.w, E.h, .003]); P(ee, OCT, M('#2E221C'), [0, -E.h * .05, .0012], [E.h * .82, E.h * .9, .0035]); P(ee, BOX, M('#2A1F1A'), [0, E.h * .72, .002], [E.w * 1.9, E.lid, .004]);
      eyes.push(ee);
      P(head, BOX, browM, [s * ex * 1.05, ey + .027, faceZ(f, ex * 1.05, ey + .027) + .003], [.03, .0058, .006], [0, s * .32, s * .04]);
      P(head, ICO0, skin, [s * HA * f.w * .99, 0, -.006], [.012, .026, .018]);
    });
    const N = [[.011, .05, .017], [.017, .046, .018], [.012, .06, .02], [.011, .038, .014]][c.nose];
    P(head, CONE4, M(mix(skinC, '#7A3E2E', .09)), [0, ey - .012 - N[1] / 2, faceZ(f, 0, ey - .03) + N[2] * .2], N, [-.3, 0, 0]);
    const L = [[.03, .0042, .005], [.032, .006, .007], [.034, .008, .0095], [.042, .0055, .007]][c.lips], lipC = mix(skinC, '#9C4848', .42), ly = -.054, lz = faceZ(f, 0, ly);
    P(head, OCT, M(lipC), [0, ly + L[1] * .5, lz + .001], [L[0] / 2, L[1], .006]); P(head, OCT, M(mix(lipC, '#ffffff', .1)), [0, ly - L[2] * .5, lz + .0015], [L[0] / 2 * .85, L[2], .007]);
    if (c.facialHair === 1) P(head, headGeo(f, 1.012, (x, y, z) => y < -.028 && z > -.02 && !(Math.abs(x) < .02 && y > -.075 && y < -.04)), M(hairC, { transparent: true, opacity: .3 }), [0, 0, 0]).castShadow = false;
    if (c.facialHair >= 2) P(head, BOX, hair, [0, -.042, faceZ(f, 0, -.042) + .004], [.04, .008, .008]);
    if (c.facialHair === 3) P(head, headGeo(f, 1.06, (x, y, z) => y < -.035 && z > -.035 && !(Math.abs(x) < .021 && y > -.072)), hair, [0, 0, 0]);
    // hair: cap + volumes rendered per texture
    const st = c.hairStyle, tx = c.hairTexture;
    if (st !== 6) {
      const cs = [1.03, 1.07, 1.08, 1.08, 1.08, 1.06][st] + (tx === 3 && st > 0 ? .05 : tx === 2 && st > 0 ? .02 : 0);
      P(head, headGeo(f, cs, (x, y, z) => { const cz = z / HC; return y > (cz > .5 ? .068 : cz > .15 ? .05 : cz > -.25 ? .012 : -.06); }), hair, [0, 0, 0]);
      const V = [], add = (a, b, r) => V.push([new T.Vector3(a[0], a[1], a[2]), new T.Vector3(b[0], b[1], b[2]), r]);
      if (st === 1) add([0, .088, -.03], [0, .092, .04], .058);
      if (st === 2) { add([-.03, .088, -.05], [.015, .1, .045], .064); add([.02, .105, .07], [.068, .07, .068], .03); add([-.025, .105, .068], [-.066, .072, .06], .028); add([0, .07, -.085], [0, -.01, -.085], .05); }
      if (st === 3 || st === 4) { const d = st === 3 ? -.1 : -.25, wd = st === 3 ? 0 : .02; add([0, .09, -.03], [0, .093, .035], .068); [1, -1].forEach(s => { add([s * .082, .07, 0], [s * (.092 + wd), d + .02, .01], .036); add([s * .06, .05, -.065], [s * (.075 + wd), d, -.045], .046); add([s * .045, .1, .066], [s * .082, .035, .05], .027); }); add([0, .06, -.088], [0, d - .01, -.08], .06); }
      if (st === 5) { add([0, .1, -.03], [0, .102, .03], .05); add([0, .135, -.06], [0, .15, -.065], .046); }
      const up = new T.Vector3(0, 1, 0);
      V.forEach(v => {
        const a = v[0], b = v[1], r = v[2], d = b.clone().sub(a), Ls = d.length(), dir = Ls > 1e-4 ? d.clone().normalize() : up.clone(), q = new T.Quaternion().setFromUnitVectors(up, dir);
        const blob = (p, sc, al) => { const m = P(head, ICO0, hair, [p.x, p.y, p.z], sc); al ? m.quaternion.copy(q) : m.rotation.set(rng() * 3, rng() * 3, rng() * 3); };
        const jit = k => new T.Vector3((rng() - .5) * k, (rng() - .5) * k, (rng() - .5) * k);
        if (tx === 0) { const md = a.clone().add(b).multiplyScalar(.5); P(head, ICO1, hair, [md.x, md.y, md.z], [r * .78 + Math.abs(d.x) / 2, r * .7 + Math.abs(d.y) / 2, r * .9 + Math.abs(d.z) / 2], [.12, rng() * .6, (rng() - .5) * .3]); }
        else if (tx === 1) { const n = Math.max(2, Math.ceil(Ls / (r * 1.1)) + 1); for (let i = 0; i < n; i++) { const p = a.clone().lerp(b, i / (n - 1)), o = new T.Vector3(p.x, 0, p.z).normalize().multiplyScalar(i % 2 ? r * .35 : -r * .1); blob(p.add(o), r); } }
        else if (tx === 2 || st < 3 || st === 5) { const n = Math.max(4, Math.ceil(Ls / (r * .7)) * (tx === 3 ? 3 : 2)); for (let i = 0; i < n; i++) blob(a.clone().lerp(b, rng()).add(jit(r * 1.3)), r * ((tx === 3 ? .42 : .5) + rng() * .22)); }
        else { const u = dir.clone().cross(new T.Vector3(0, 0, 1)).normalize(), w = dir.clone().cross(u); for (let j = 0; j < 3; j++) { const an = j * 2.1 + rng(), mid = a.clone().add(b).multiplyScalar(.5).addScaledVector(u, cos(an) * r * .55).addScaledVector(w, sin(an) * r * .55); blob(mid, [r * .3, Ls / 2 + r * .2 + rng() * .02, r * .3], true); } }
      });
    }
    av.userData = { body, legs, arms, elbows, head, eyes, blink: rng() * 4 };
    seed = save; return av;
  }
  const pose = (av, t, o) => {
    const u = av.userData, w = o.walk || 0, ph = o.phase || 0, k = o.wave || 0;
    u.legs[1].rotation.x = sin(ph) * .6 * w; u.legs[-1].rotation.x = -sin(ph) * .6 * w;
    u.arms[1].rotation.set(-sin(ph) * .5 * w, 0, .07 + sin(t * 1.6) * .012);
    u.arms[-1].rotation.set(sin(ph) * .5 * w, 0, -.07 - k * 2.45 - sin(t * 1.6) * .012);
    u.elbows[1].rotation.set(-.18 - w * .25, 0, 0); u.elbows[-1].rotation.set(-.18 - w * .25, 0, k * (-.45 + sin(t * 9) * .3));
    u.body.position.y = Math.abs(sin(ph)) * .025 * w + sin(t * 1.6) * .004;
    u.head.rotation.set((o.lookY || 0) * .15, o.lookX || 0, sin(t * .7 + u.blink) * .02);
    const bl = ((t + u.blink) % 4.3) < .12 ? .15 : 1; u.eyes.forEach(ee => ee.scale.y += (bl - ee.scale.y) * .5);
  };

  /* ================= avatar stage ================= */
  const sA = new T.Scene(); sA.add(new T.HemisphereLight('#FFF8EE', '#D9CDBB', 1.9));
  const keyA = new T.DirectionalLight('#FFF1DC', 2.5); keyA.position.set(2.5, 5, 4); keyA.castShadow = true; keyA.shadow.mapSize.set(1024, 1024); Object.assign(keyA.shadow.camera, { left: -1.6, right: 1.6, top: 2.4, bottom: -.6, near: .5, far: 14 }); keyA.shadow.normalBias = .01; sA.add(keyA);
  const rimA = new T.DirectionalLight('#FFE2C0', .9); rimA.position.set(-3, 3, -3); sA.add(rimA);
  const floorA = new T.Mesh(new T.CircleGeometry(1.3, 40).rotateX(-PI / 2), new T.ShadowMaterial({ opacity: .2 })); floorA.receiveShadow = true; sA.add(floorA);
  const camA = new T.PerspectiveCamera(24, 1, .1, 50), camH = new T.PerspectiveCamera(26, 1, .1, 20); camH.position.set(0, 1.69, 1.14); camH.lookAt(0, 1.675, 0);
  const rA = new T.WebGLRenderer({ canvas: els.avatar, antialias: true, alpha: true, preserveDrawingBuffer: true }); rA.shadowMap.enabled = true;
  let stageAv = null, cfg = null, rotA = -.35, zoom = 0, zoomT = 0, wave = false, waveK = 0, mx = 0, my = 0, hx = 0, hy = 0, dragA = null;
  const pr = () => Math.min(window.devicePixelRatio || 1, 2);
  const sizeA = () => { const w = els.avatar.clientWidth, h = els.avatar.clientHeight; if (!w || !h) return; rA.setPixelRatio(pr()); rA.setSize(w, h, false); camA.aspect = w / h; camA.updateProjectionMatrix(); };
  const thumb = c => { const tmp = buildAvatar(c); tmp.rotation.y = -.3; if (stageAv) stageAv.visible = false; floorA.visible = false; sA.add(tmp); rA.setPixelRatio(1); rA.setSize(128, 128, false); rA.render(sA, camH); let url = ''; try { const bin = atob(els.avatar.toDataURL().split(',')[1]), arr = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i); url = URL.createObjectURL(new Blob([arr], { type: 'image/png' })); } catch (er) {} sA.remove(tmp); disposeObj(tmp); if (stageAv) stageAv.visible = true; floorA.visible = true; sizeA(); return url; };

  /* ================= island (home backdrop) ================= */
  const HAZE = '#EDE7DB', R = 11;
  const rAt = a => 1 + .11 * sin(2 * a + 1) + .07 * sin(3 * a + 2.4) + .04 * sin(5 * a + .3);
  const hill = (x, z) => { const a = (x + 4.2) / 4.4, b = (z + 3.2) / 4, q = 1 - a * a - b * b; return q > 0 ? 2.4 * q : 0; };
  const hAt = (x, z) => { const dn = Math.hypot(x, z) / (R * rAt(Math.atan2(z, x))); if (dn > 1) return Math.max(-1.2, -.25 - (dn - 1) * 5); if (dn > .8) return .1 + (1 - dn) / .2 * .32; if (dn > .72) return .42 + (.8 - dn) / .08 * .58; return 1 + hill(x, z); };
  const grassEdge = a => R * .7 * rAt(a), sandR = a => R * rAt(a) * .9;
  const isl = new T.Scene(); isl.background = new T.Color(HAZE); isl.fog = new T.Fog(HAZE, 50, 140);
  let orbit = .55, orbitOn = true, distI = 50, boat, sail, sb, foam, clouds = [], smoke = [], chim;
  (function buildIsland() {
    seed = 11;
    const dns = [0, .1, .2, .3, .4, .5, .6, .68, .72, .76, .8, .9, 1, 1.05, 1.16], NS = 48, pos = [], col = [], cc = new T.Color();
    const V = dns.map((dn, i) => Array.from({ length: NS + 1 }, (_, j) => { const a = ((j % NS) + (i % 2) * .5) / NS * TAU + (i && i < 12 ? sin(j * 12.9 + i * 7.1) * .02 : 0), r = dn * R * rAt(a) + (i && i < 12 ? sin(j * 5.3 + i * 3.7) * .18 : 0), x = r * cos(a), z = r * sin(a); return [x, hAt(x, z) + (dn > 0 && dn < .7 ? sin(j * 3.1 + i * 9.2) * .05 : 0), z]; }));
    const tone = (y, dn) => y < .04 ? '#D5C6A2' : dn > .8 ? (rng() < .5 ? '#E7D6B1' : '#E1CFA8') : dn > .715 ? '#BDBE8C' : y > 1.9 ? (rng() < .5 ? '#8FA26D' : '#869968') : ['#A9B97D', '#A0B176', '#B1BE85'][Math.floor(rng() * 3)];
    const tri = (a, b, c) => { const cx = (a[0] + b[0] + c[0]) / 3, cy = (a[1] + b[1] + c[1]) / 3, cz = (a[2] + b[2] + c[2]) / 3; cc.set(tone(cy, Math.hypot(cx, cz) / (R * rAt(Math.atan2(cz, cx))))); [a, b, c].forEach(v => { pos.push(v[0], v[1], v[2]); col.push(cc.r, cc.g, cc.b); }); };
    for (let i = 0; i < dns.length - 1; i++) for (let j = 0; j < NS; j++) { const a = V[i][j], b = V[i][j + 1], c = V[i + 1][j], d = V[i + 1][j + 1]; tri(a, d, c); if (i) tri(a, b, d); }
    const tg = new T.BufferGeometry(); tg.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); tg.setAttribute('color', new T.Float32BufferAttribute(col, 3)); tg.computeVertexNormals();
    const land = new T.Mesh(tg, new T.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 })); land.castShadow = land.receiveShadow = true; isl.add(land);
    const wg = new T.PlaneGeometry(280, 280, 44, 44).toNonIndexed(); wg.rotateX(-PI / 2); const wp = wg.attributes.position; for (let i = 0; i < wp.count; i++) wp.setY(i, sin(wp.getX(i) * 1.3 + wp.getZ(i) * .7) * .07 + cos(wp.getZ(i) * 1.1 - wp.getX(i) * .5) * .07); wg.computeVertexNormals();
    const water = new T.Mesh(wg, M('#A4C9C4', { roughness: .75 })); water.position.y = -.12; water.receiveShadow = true; isl.add(water);
    const blob = s => { const shp = new T.Shape(); for (let i = 0; i <= 64; i++) { const a = i / 64 * TAU, r = R * s * rAt(a), x = r * cos(a), y = -r * sin(a); i ? shp.lineTo(x, y) : shp.moveTo(x, y); } return shp; };
    const ring = (s, c, op, y) => { const me = new T.Mesh(new T.ShapeGeometry(blob(s)).rotateX(-PI / 2), new T.MeshStandardMaterial({ color: c, transparent: true, opacity: op, roughness: 1, depthWrite: false })); me.position.y = y; isl.add(me); return me; };
    ring(1.4, '#D3EDE2', .28, .0); ring(1.2, '#E0F4EA', .4, .01); foam = ring(1.05, '#FFFFFF', .7, .02);
    // house
    const wall = M('#EFE5D3'), roof = M('#B9694C'), wood = M('#8A6245'), stone = M('#CFC6B8'), white = M('#F8F3E8'), glass = M('#B5CFCB', { roughness: .4 });
    const house = G3(isl, 2.2, .98, -.8); house.rotation.y = .3;
    P(house, BOX, stone, [0, .1, 0], [4.4, .2, 3.4]); P(house, BOX, wall, [0, 1.2, 0], [4, 2, 3]);
    const tr = new T.Shape(); tr.moveTo(-1.5, 0); tr.lineTo(1.5, 0); tr.lineTo(0, 1.3); tr.closePath();
    const gab = new T.ExtrudeGeometry(tr, { depth: 4, bevelEnabled: false }); gab.translate(0, 0, -2); P(house, gab, wall, [0, 2.2, 0], null, [0, PI / 2, 0]);
    const ang = Math.atan2(1.3, 1.5), L = 2.5;
    [1, -1].forEach(s => P(house, BOX, roof, [0, 3.59 - sin(ang) * (L / 2 - .12), s * cos(ang) * (L / 2 - .12)], [4.8, .2, L], [s * ang, 0, 0]));
    P(house, BOX, M('#A85C42'), [0, 3.62, 0], [4.85, .16, .3]);
    P(house, BOX, M('#D8C4AE'), [1.2, 3.3, -.7], [.5, 1.3, .5]); P(house, BOX, stone, [1.2, 3.98, -.7], [.66, .12, .66]);
    P(house, BOX, M('#6B7445'), [-.7, .92, 1.52], [.78, 1.44, .08]);
    P(house, BOX, wood, [-.2, .14, 2.15], [3.2, .12, 1.3]); [-1.65, 1.25].forEach(x => P(house, BOX, wood, [x, 1.05, 2.7], [.12, 1.9, .12])); P(house, BOX, roof, [-.2, 2.08, 2.2], [3.5, .1, 1.5], [.16, 0, 0]);
    const win = (x, y, z, ry) => { const g = G3(house, x, y, z); g.rotation.y = ry; P(g, BOX, white, [0, 0, 0], [.9, .9, .06]); P(g, BOX, glass, [0, 0, .02], [.7, .7, .06]); P(g, BOX, white, [0, 0, .04], [.06, .7, .05]); };
    win(.9, 1.3, 1.5, 0); win(-.9, 1.3, -1.5, PI); win(.9, 1.3, -1.5, PI); win(2, 1.3, 0, PI / 2); win(-2, 1.3, 0, -PI / 2);
    isl.updateMatrixWorld(true);
    const door = house.localToWorld(new T.Vector3(-.7, 0, 3.2)); chim = house.localToWorld(new T.Vector3(1.2, 3.1, -.7));
    // dock + boat
    const fd = 1, dr = R * rAt(fd) * .92, dock = G3(isl, cos(fd) * dr, 0, sin(fd) * dr); dock.rotation.y = -fd;
    for (let i = 0; i < 11; i++) P(dock, BOX, i % 2 ? M('#B08C66') : M('#A6835E'), [i * .55, .5, 0], [.49, .1, i > 8 ? 2.8 : 1.5]);
    [[1.4, .72], [1.4, -.72], [3.6, .72], [3.6, -.72], [5.6, 1.35], [5.6, -1.35]].forEach(p => P(dock, CYL6, wood, [p[0], .2, p[1]], [.09, 1.1, .09]));
    boat = G3(dock, 3.2, .05, 1.9); P(boat, OCT, M('#C9745A'), [0, 0, 0], [1.3, .4, .55]); P(boat, BOX, wall, [0, .2, 0], [1.3, .06, .5]); P(boat, BOX, wood, [0, .26, 0], [.16, .05, .6]);
    // path
    const taken = [{ x: 2.2, z: -.8, r: 3.6 }, { x: 6, z: -4.3, r: 1.5 }, { x: -2.2, z: 1.4, r: 1.5 }], pe = [cos(fd) * dr * .97, sin(fd) * dr * .97], pc = [door.x + .2, door.z + 3];
    for (let i = 0; i <= 13; i++) { const t = i / 13, u = 1 - t, x = u * u * door.x + 2 * u * t * pc[0] + t * t * pe[0], z = u * u * door.z + 2 * u * t * pc[1] + t * t * pe[1]; P(isl, CYL6, stone, [x, hAt(x, z) + .03, z], [.36, .1, .3], [0, rng() * 3, 0]).castShadow = false; taken.push({ x, z, r: .7 }); }
    // pond + garden
    P(isl, CYL8, M('#A9D3CF', { roughness: .4 }), [6, 1.05, -4.3], [1.2, .06, .95]).castShadow = false;
    const rock = M('#B4B1A8');
    for (let i = 0; i < 9; i++) { const a = i / 9 * TAU + .2; P(isl, ICO0, rock, [6 + cos(a) * 1.3, 1.08, -4.3 + sin(a) * 1.05], .16 + rng() * .14, [rng(), rng(), 0]); }
    P(isl, BOX, M('#8E6B50'), [-2.2, 1.06, 1.4], [2.2, .14, 1.5]);
    for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) P(isl, ICO0, M(j === 1 && i % 2 ? '#C98A4E' : '#7E9A62'), [-3 + i * .4, 1.2, .95 + j * .45], [.14, .12, .14]);
    // trees
    const trunk = M('#8A6245'), greens = [M('#7E9A62'), M('#8BA56B'), M('#6F8C5A')], pineM = [M('#5F7F5C'), M('#6A8A64')];
    const tree = (x, z, s) => { const g = G3(isl, x, hAt(x, z) - .04, z, s), c1 = greens[Math.floor(rng() * 3)], c2 = greens[Math.floor(rng() * 3)]; P(g, CYL6, trunk, [0, .45, 0], [.12, .9, .12]); P(g, ICO0, c1, [0, 1.4, 0], .85, [rng(), rng(), 0]); P(g, ICO0, c2, [.5, 1.05, .2], .52, [rng(), rng(), 0]); P(g, ICO0, c2, [-.42, 1.15, -.25], .56, [rng(), rng(), 0]); };
    const pine = (x, z, s) => { const g = G3(isl, x, hAt(x, z) - .08, z, s); P(g, CYL6, trunk, [0, .3, 0], [.11, .6, .11]); [[.78, .9], [.6, 1.5], [.42, 2.05]].forEach((c, i) => P(g, CONE6, pineM[i % 2], [0, c[1], 0], [c[0], .95, c[0]], [0, i, 0])); taken.push({ x, z, r: .9 }); };
    [[-4.9, -3.7, 1.15], [-3.2, -4.4, .95], [-5.8, -2.1, .9], [-3.6, -2.2, 1.05], [-2.4, -5.9, .85]].forEach(p => pine(p[0], p[1], p[2]));
    const spot = (minR, frac) => { for (let i = 0; i < 80; i++) { const a = rng() * TAU, d = Math.sqrt(rng()) * grassEdge(a) * frac, x = d * cos(a), z = d * sin(a); if (taken.every(o => Math.hypot(o.x - x, o.z - z) > o.r + minR)) { taken.push({ x, z, r: minR }); return [x, z]; } } return null; };
    for (let i = 0; i < 10; i++) { const p = spot(1, .9); if (p) tree(p[0], p[1], .85 + rng() * .4); }
    for (let i = 0; i < 12; i++) { const p = spot(.45, .96); if (p) P(isl, ICO0, greens[i % 3], [p[0], hAt(p[0], p[1]) + .15, p[1]], [.4, .3, .4], [rng(), rng(), 0]); }
    // palms, umbrella, campfire
    const leaf = [M('#7E9A62'), M('#8BA56B')], pT = M('#A98A68');
    const palm = (par, x, y, z, dir, s) => { const g = G3(par, x, y, z, s); g.rotation.y = dir; for (let i = 0; i < 6; i++) { const t = i / 5; P(g, CYL6, pT, [.9 * t * t, .22 + i * .42, 0], [.14 - .012 * i, .5, .14 - .012 * i], [0, 0, -t * .55]); } const tp = G3(g, .95, 2.52, 0); for (let k = 0; k < 7; k++) { const lg = G3(tp, 0, 0, 0); lg.rotation.y = k / 7 * TAU; P(lg, CONE4, leaf[k % 2], [.72, -.14, 0], [.05, 1.5, .26], [0, 0, -PI / 2 - .38]); } };
    [[.62, 1.1], [1.5, .95], [2.25, 1.15], [3.45, 1], [4.1, .9], [5.45, 1.1], [5.9, .95]].forEach(p => { const r = sandR(p[0]), x = cos(p[0]) * r, z = sin(p[0]) * r; palm(isl, x, hAt(x, z) - .08, z, -p[0] + (rng() - .5), p[1]); });
    const ua = 1.9, ur = sandR(ua), um = G3(isl, cos(ua) * ur, .25, sin(ua) * ur); um.rotation.y = -ua;
    P(um, CYL6, white, [0, .8, 0], [.04, 1.6, .04]); P(um, CONE8, M('#C98A6E'), [0, 1.6, 0], [1.15, .45, 1.15]); P(um, BOX, M('#DCCFB6'), [.3, .03, .9], [1.3, .04, .6]); P(um, BOX, M('#A9B48A'), [.3, .03, -.9], [1.3, .04, .6]);
    // sea dressing
    [[15.5, 2.2], [17, 3.9], [14.5, 5.2], [19, .3]].forEach(p => { const x = cos(p[1]) * p[0], z = sin(p[1]) * p[0]; P(isl, ICO0, rock, [x, .1, z], [.9, .55, .7], [0, rng() * 3, 0]); P(isl, ICO0, rock, [x + .9, 0, z + .4], .35, [rng(), rng(), 0]); });
    sail = G3(isl, 0, 0, 0); sb = G3(sail, 22, .05, 0); P(sb, OCT, white, [0, 0, 0], [.5, .35, 1.2]); P(sb, CYL6, wood, [0, .9, 0], [.035, 1.8, .035]); P(sb, new T.ConeGeometry(1, 1, 3), wall, [0, 1.05, .28], [.06, 1.4, .65]);
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + .6, d = 24 + rng() * 9, g = G3(isl, cos(a) * d, 6 + rng() * 3, sin(a) * d, .8 + rng() * .4); [[0, 0, 0, 1.6, .9, 1.2], [1.5, -.15, .2, 1.2, .7, 1], [-1.4, -.2, -.1, 1.1, .65, .9]].forEach(c => { const m = P(g, ICO1, white, [c[0], c[1], c[2]], [c[3], c[4], c[5]], [rng(), rng(), 0]); m.receiveShadow = false; }); clouds.push(g); }
    smoke = [0, 1, 2, 3].map(i => { const me = new T.Mesh(ICO0, new T.MeshStandardMaterial({ color: '#FFFFFF', transparent: true, opacity: .6, depthWrite: false, flatShading: true })); isl.add(me); me.userData.ph = i / 4; return me; });
    isl.add(new T.HemisphereLight('#FFF6E8', '#C9C2A8', 1.9));
    const sun = new T.DirectionalLight('#FFE9C8', 2.8); sun.position.set(26, 44, 18); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 110 }); sun.shadow.bias = -.0004; sun.shadow.normalBias = .05; isl.add(sun);
  })();
  const camI = new T.PerspectiveCamera(30, 1, 1, 400);

  /* ================= renderer, layout, input ================= */
  const rW = new T.WebGLRenderer({ canvas: els.world, antialias: true, preserveDrawingBuffer: true }); rW.shadowMap.enabled = true;
  let view = 'home';
  const LAY = {
    home: ['position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none', 'position:absolute;right:3vw;bottom:84px;height:min(76vh,54vw);aspect-ratio:.72;display:block;pointer-events:none'],
    creator: ['display:none', 'position:absolute;left:0;top:0;width:calc(100% - min(440px,46vw) - 16px);height:100%;display:block;cursor:grab;touch-action:none'],
  };
  const sizeAll = () => { const w = els.root.clientWidth, h = els.root.clientHeight; if (!w || !h) return; rW.setPixelRatio(pr()); rW.setSize(w, h, false); camI.aspect = w / h; camI.setViewOffset(w, h, w * .08, h * .1, w, h); camI.updateProjectionMatrix(); distI = 50 * Math.max(1, 1.5 / (w / h)) * (h < 700 ? 1.15 : 1.05); sizeA(); };
  const ro = new ResizeObserver(sizeAll); ro.observe(els.root);
  const onMove = e => { mx = e.clientX / window.innerWidth * 2 - 1; my = e.clientY / window.innerHeight * 2 - 1; if (dragA) rotA = dragA.r + (e.clientX - dragA.x) * .01; };
  const onUp = () => { dragA = null; if (view === 'creator') els.avatar.style.cursor = 'grab'; };
  const onDownA = e => { if (view !== 'creator') return; dragA = { x: e.clientX, r: rotA }; els.avatar.style.cursor = 'grabbing'; };
  window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp); els.avatar.addEventListener('pointerdown', onDownA);

  /* ================= loop ================= */
  let last = performance.now() / 1000;
  const tick = now => {
    if (!alive) return; raf = requestAnimationFrame(tick);
    const t = now / 1000, dt = Math.min(.05, t - last); last = t;
    if (view === 'home') {
      if (orbitOn) orbit += dt * .025;
      const e = .68; camI.position.set(distI * cos(e) * sin(orbit), distI * sin(e), distI * cos(e) * cos(orbit)); camI.lookAt(0, 1, 0);
      const f = 1.03 + .025 * sin(t * .8); foam.scale.set(f, 1, f); foam.material.opacity = .45 + .25 * sin(t * .8 + 1.2);
      clouds.forEach(c => { c.position.x += dt * .25; if (c.position.x > 38) c.position.x = -38; });
      boat.position.y = .05 + sin(t * 1.3) * .04; boat.rotation.z = sin(t * 1.1) * .05; sail.rotation.y = orbit + 2.2 + sin(t * .05) * .5;
      smoke.forEach(s => { const p = (s.userData.ph + t * .1) % 1; s.position.set(chim.x + p * .5, chim.y + 1 + p * 2.4, chim.z); s.scale.setScalar(.14 + p * .34); s.material.opacity = (1 - p) * .55; });
      rW.render(isl, camI);
    }
    if (stageAv) {
      waveK += ((wave && view === 'home' ? 1 : 0) - waveK) * Math.min(1, dt * 8); zoom += (zoomT - zoom) * Math.min(1, dt * 5);
      hx += (mx - hx) * Math.min(1, dt * 4); hy += (my - hy) * Math.min(1, dt * 4);
      if (view === 'home') rotA += (-.35 - rotA) * Math.min(1, dt * 3);
      stageAv.rotation.y = rotA + (view === 'home' ? hx * .1 : 0);
      pose(stageAv, t, { wave: waveK, lookX: view === 'home' ? hx * .25 : 0, lookY: view === 'home' ? hy : 0 });
      const z = view === 'creator' ? zoom : 0; camA.position.set(0, 1.02 + z * .61, 4.95 - z * 3.15); camA.lookAt(0, .94 + z * .66, 0);
      rA.render(sA, camA);
    }
  };

  const api = {
    setAvatar(c) {
      cfg = c; if (stageAv) { sA.remove(stageAv); disposeObj(stageAv); } stageAv = buildAvatar(c); sA.add(stageAv);
      cb.onAvatar && cb.onAvatar(thumb(c));
    },
    setView(v) { view = v; els.world.style.cssText = LAY[v][0]; els.avatar.style.cssText = LAY[v][1]; sizeAll(); },
    setZoom(z) { zoomT = z; },
    setOrbit(on) { orbitOn = on; },
    wave(on) { wave = on; },
    dispose() { alive = false; cancelAnimationFrame(raf); ro.disconnect(); window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); els.avatar.removeEventListener('pointerdown', onDownA); rW.dispose(); rA.dispose(); }
  };
  cb.onPresets && cb.onPresets(PRESETS.map(thumb));
  raf = requestAnimationFrame(tick);
  return api;
}
