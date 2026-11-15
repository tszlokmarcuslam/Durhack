// Nook's anime look: the customizable anime character and the big resting island, both made in Blender
// (character-test/tools/simple.py with LITE = True, and tools/nook_island.py).
// Self-contained: a small reader for our .glb files is built in, so no three.js add-ons or import maps are needed.
// Everything is drawn with the three.js namespace the page passes in (createAnime(T)).
const BASE = import.meta.url.replace(/[^/?#]*([?#].*)?$/, '');   // this file's folder (written so dev servers do not rewrite it)
const PI = Math.PI, TAU = PI * 2, sin = Math.sin, cos = Math.cos;

/* ================= reading .glb files (only what our Blender exports use) ================= */
const COMP = { 5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array, 5122: Int16Array, 5121: Uint8Array, 5120: Int8Array };
const SIZE = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
function parseGLB(buf) {
  const dv = new DataView(buf);
  if (dv.getUint32(0, true) !== 0x46546C67) throw new Error('not a .glb file');
  let off = 12, json = null, bin = null;
  while (off < buf.byteLength) {
    const len = dv.getUint32(off, true), type = dv.getUint32(off + 4, true);
    if (type === 0x4E4F534A) json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, off + 8, len)));
    else if (type === 0x004E4942) bin = buf.slice(off + 8, off + 8 + len);
    off += 8 + len;
  }
  const acc = i => {
    const a = json.accessors[i], n = SIZE[a.type], C = COMP[a.componentType];
    let arr;
    if (a.bufferView == null) arr = new C(a.count * n);
    else {
      const v = json.bufferViews[a.bufferView], o = (v.byteOffset || 0) + (a.byteOffset || 0), st = v.byteStride || 0, bpe = C.BYTES_PER_ELEMENT;
      if (!st || st === n * bpe) arr = new C(bin, o, a.count * n);
      else { arr = new C(a.count * n); const src = new C(bin); for (let k = 0; k < a.count; k++) for (let c = 0; c < n; c++) arr[k * n + c] = src[(o + k * st) / bpe + c]; }
    }
    if (a.sparse) {
      arr = arr.slice();
      const s = a.sparse, iv = json.bufferViews[s.indices.bufferView], vv = json.bufferViews[s.values.bufferView];
      const I = new COMP[s.indices.componentType](bin, (iv.byteOffset || 0) + (s.indices.byteOffset || 0), s.count);
      const V = new C(bin, (vv.byteOffset || 0) + (s.values.byteOffset || 0), s.count * n);
      for (let k = 0; k < s.count; k++) for (let c = 0; c < n; c++) arr[I[k] * n + c] = V[k * n + c];
    }
    return { array: arr, size: n, normalized: !!a.normalized };
  };
  const meshes = json.meshes.map(m => ({
    name: m.name, targets: (m.extras && m.extras.targetNames) || [],
    prims: m.primitives.map(p => ({
      attrs: Object.fromEntries(Object.entries(p.attributes).map(([k, i]) => [k, acc(i)])),
      index: p.indices != null ? acc(p.indices) : null, material: p.material != null ? p.material : -1,
      targets: (p.targets || []).map(t => Object.fromEntries(Object.entries(t).map(([k, i]) => [k, acc(i)])))
    }))
  }));
  const materials = (json.materials || []).map(m => {
    const pb = m.pbrMetallicRoughness || {}, e = m.emissiveFactor || [0, 0, 0], es = (m.extensions && m.extensions.KHR_materials_emissive_strength) || {};
    return { name: m.name, color: (pb.baseColorFactor || [1, 1, 1, 1]).slice(0, 3), emissive: e.map(x => x * (es.emissiveStrength || 1)) };
  });
  const scene = json.scenes[json.scene || 0];
  const node = i => { const n = json.nodes[i]; return { name: n.name || '', t: n.translation || [0, 0, 0], r: n.rotation || [0, 0, 0, 1], s: n.scale || [1, 1, 1], mesh: n.mesh != null ? n.mesh : -1, children: (n.children || []).map(node) }; };
  return { meshes, materials, roots: scene.nodes.map(node) };
}
async function load(name, kind) {
  const r = await fetch(new URL(name, BASE));
  if (!r.ok) throw new Error('Nook anime: could not load ' + name + ' (' + r.status + ')');
  return kind === 'json' ? r.json() : parseGLB(await r.arrayBuffer());
}
const [CH, CHI, IS, ISJ] = await Promise.all([load('character.glb'), load('character.json', 'json'), load('island.glb'), load('island.json', 'json')]);

/* ================= the character's choices (Nook's avatar creator reads OPTIONS and PRESETS) ================= */
const EYES = [
  ['Round', { w: 1.00, h: 1.00, tilt: 0.00, top: 1.00, bot: 0.95, lash: 0, hood: 0 }],
  ['Almond', { w: 1.08, h: 0.80, tilt: 0.05, top: 0.95, bot: 0.65, lash: 0, hood: 0 }],
  ['Upturned', { w: 1.06, h: 0.82, tilt: 0.22, top: 0.95, bot: 0.55, lash: 1, hood: 0 }],
  ['Downturned', { w: 1.02, h: 0.86, tilt: -0.18, top: 0.95, bot: 0.75, lash: 0, hood: 0 }],
  ['Hooded', { w: 1.04, h: 0.70, tilt: 0.00, top: 0.70, bot: 0.70, lash: 0, hood: 1 }],
  ['Narrow', { w: 1.10, h: 0.55, tilt: 0.06, top: 0.85, bot: 0.55, lash: 0, hood: 0 }],
  ['Doe', { w: 1.06, h: 1.08, tilt: 0.02, top: 1.05, bot: 0.95, lash: 1, hood: 0 }],
];
const BROWS = [
  ['Straight', { thick: 1.00, arch: 0.10, tilt: 0.02, taper: 0.55, len: 1.00 }],
  ['Soft arch', { thick: 0.80, arch: 0.35, tilt: 0.00, taper: 0.45, len: 1.00 }],
  ['High arch', { thick: 0.60, arch: 0.65, tilt: -0.04, taper: 0.30, len: 1.00 }],
  ['Bushy', { thick: 1.35, arch: 0.15, tilt: 0.04, taper: 0.75, len: 1.05 }],
  ['Thin', { thick: 0.42, arch: 0.30, tilt: 0.00, taper: 0.45, len: 0.95 }],
  ['Angled', { thick: 0.95, arch: 0.10, tilt: 0.22, taper: 0.50, len: 1.00 }],
];
const MOUTHS = ['Soft smile', 'Small', 'Full', 'Wide', 'Firm'];
const EXPRS = {
  Neutral: { open: 1.00, smileEye: 0, browUp: 0, browIn: 0, mouth: null },
  Happy: { open: 0.82, smileEye: 1, browUp: 0.15, browIn: 0, mouth: 'grin' },
  Laugh: { open: 0.0, smileEye: 1, browUp: 0.25, browIn: 0, mouth: 'laugh' },
  Surprised: { open: 1.18, smileEye: 0, browUp: 0.9, browIn: 0, mouth: 'o' },
  Angry: { open: 0.85, smileEye: 0, browUp: -0.25, browIn: 1, mouth: 'frown' },
  Sad: { open: 0.85, smileEye: 0, browUp: 0.1, browIn: -1, mouth: 'sad' },
  Wink: { open: 1.0, smileEye: 0, browUp: 0.1, browIn: 0, mouth: 'grin', wink: 1 },
  Sleep: { open: 0.0, smileEye: 0, browUp: 0.05, browIn: 0, mouth: 'soft' },
  Calm: { open: 0.0, smileEye: 1, browUp: 0.05, browIn: 0, mouth: 'soft' },
};
const BODIES = [
  ['Slim', { tw: 0.86, td: 0.86, pw: 0.88, arm: 0.85, leg: 0.85, sh: 0.93, hip: 0.92 }],
  ['Average', { tw: 1.0, td: 1.0, pw: 1.0, arm: 1.0, leg: 1.0, sh: 1.0, hip: 1.0 }],
  ['Athletic', { tw: 1.1, td: 1.02, pw: 0.98, arm: 1.14, leg: 1.1, sh: 1.08, hip: 1.0 }],
  ['Muscular', { tw: 1.24, td: 1.12, pw: 1.02, arm: 1.38, leg: 1.22, sh: 1.18, hip: 1.04 }],
  ['Curvy', { tw: 0.98, td: 1.04, pw: 1.24, arm: 1.02, leg: 1.2, sh: 0.98, hip: 1.18 }],
  ['Heavy', { tw: 1.3, td: 1.42, pw: 1.3, arm: 1.3, leg: 1.3, sh: 1.12, hip: 1.18 }],
];
// male: narrower, sharper eyes without lash flicks; thicker, flatter brows; broader shoulders, narrower hips
const MALE_EYES = e => ({ ...e, h: e.h * 0.84, top: e.top * 0.96, tilt: e.tilt + 0.05, lash: 0 });
const MALE_BROWS = b => ({ ...b, thick: b.thick * 1.45, arch: b.arch * 0.45, tilt: b.tilt + 0.05 });
const MALE_BODY = b => ({ ...b, tw: b.tw * 1.1, td: b.td * 0.97, pw: b.pw * 0.97, arm: b.arm * 1.08, leg: b.leg * 1.0, sh: b.sh * 1.08, hip: b.hip * 0.96 });
const HEIGHTS = [['Short', 0.82], ['Medium', 1.0], ['Tall', 1.15], ['Very tall', 1.28]];
// hair index 6 is "None", so Nook's "random look but not bald" rule (hairStyle 6 -> 1) still means the same thing
const HAIRS = [['Neat', 'neat'], ['Spiky', 'spiky'], ['Bob', 'bob'], ['Long', 'long'], ['Ponytail', 'ponytail'], ['Twin tails', 'twintails'],
  ['None', null], ['Messy', 'messy'], ['Buns', 'buns'], ['Curly', 'curly']];
const SKINS = ['#f6d5bf', '#ecbc95', '#d79c6e', '#b57a50', '#86553a', '#58372a'];
const HAIRCOLS = ['#3d2416', '#141017', '#8a5530', '#e9c873', '#c2452b', '#cfd3dc', '#3f6fd6', '#f07fb0', '#7b55c9', '#3fae7a'];
const EYECOLS = ['#7a4520', '#3f7de0', '#3fae6b', '#c0392b', '#8b5cd6', '#e0a630', '#6f7680'];
const SHIRTS = ['#3b8fe0', '#e5484d', '#3fae6b', '#f2b33d', '#8a5cd6', '#f4f4f4', '#2b2b30'];
const PANTS = ['#3d4250', '#1e2a44', '#6b4a32', '#8c8f99', '#2f5d3a', '#b33a3a'];
const SHOES = ['#f7f7f7', '#2a2a2e', '#e5484d', '#3b8fe0', '#f2b33d'];
export const OPTIONS = {
  body: ['Female', 'Male'], skin: SKINS, face: ['Anime', 'Simple', 'Detailed'], eyes: EYES.map(e => e[0]), eyeColor: EYECOLS, brows: BROWS.map(b => b[0]), mouth: MOUTHS,
  hairStyle: HAIRS.map(h => h[0]), hairColor: HAIRCOLS,
  build: BODIES.map(b => b[0]), height: HEIGHTS.map(h => h[0]), topColor: SHIRTS, bottomColor: PANTS, shoes: SHOES
};
const look = (name, skin, eyes, eyeColor, brows, mouth, hairStyle, hairColor, build, height, topColor, bottomColor, shoes, body = 0) =>
  ({ name, body, skin, face: 0, eyes, eyeColor, brows, mouth, hairStyle, hairColor, build, height, topColor, bottomColor, shoes });
export const PRESETS = [
  look('Jun', 1, 1, 0, 1, 0, 1, 1, 2, 2, 0, 0, 0, 1),
  look('Amara', 5, 6, 0, 2, 2, 9, 1, 4, 1, 3, 1, 2),
  look('Mateo', 3, 3, 0, 3, 4, 7, 0, 3, 2, 1, 3, 1, 1),
  look('Elena', 0, 2, 2, 4, 1, 3, 4, 1, 1, 4, 1, 3),
  look('Idris', 4, 4, 0, 0, 3, 0, 1, 5, 3, 2, 4, 1, 1),
  look('Mei', 1, 0, 4, 1, 0, 5, 7, 0, 0, 5, 5, 4),
];
// any saved or remote look (old Nook keys too): every option falls back to 0 when missing or out of range
export function cleanLook(c) { const out = {}; for (const k in OPTIONS) { const v = c && c[k]; out[k] = Number.isInteger(v) && v >= 0 && v < OPTIONS[k].length ? v : 0; } return out; }

/* ================= sizes the rest of Nook relies on ================= */
// K: the model is scaled so the hand sits 0.31 below the elbow (the boxing gloves and punches use that) and the
// character is about 1.75 tall, like Nook's old mannequin.
export const K = 0.31 / (0.775 - 0.505);
const PELVIS_BOTTOM = 0.594;                     // model units, standing
export const island = ISJ;

export function createAnime(T) {
  const F = CHI.face;
  const tone = (a, b) => { const t = new T.DataTexture(new Uint8Array([a, a, a, 255, b, b, b, 255, 255, 255, 255, 255]), 3, 1); t.minFilter = t.magFilter = T.NearestFilter; t.needsUpdate = true; return t; };
  const toneChar = tone(178, 228), toneIsl = tone(168, 222);
  const lin = c => new T.Color().setRGB(c[0], c[1], c[2], T.LinearSRGBColorSpace);

  // geometry from the file, made once and shared by every avatar / the island
  const geoCache = new Map();
  function geometry(mesh, k) {
    const key = mesh.name + '#' + k;
    if (geoCache.has(key)) return geoCache.get(key);
    const p = mesh.prims[k], g = new T.BufferGeometry(), A = p.attrs;
    const attr = a => new T.BufferAttribute(a.array, a.size, a.normalized);
    g.setAttribute('position', attr(A.POSITION));
    if (A.NORMAL) g.setAttribute('normal', attr(A.NORMAL)); else g.computeVertexNormals();
    if (A.COLOR_0) g.setAttribute('color', attr(A.COLOR_0));
    if (A.TEXCOORD_0) g.setAttribute('uv', attr(A.TEXCOORD_0));
    if (p.index) g.setIndex(attr(p.index));
    if (p.targets.length) {
      g.morphAttributes.position = p.targets.map(t => attr(t.POSITION));
      if (p.targets[0].NORMAL) g.morphAttributes.normal = p.targets.map(t => attr(t.NORMAL));
      g.morphTargetsRelative = true;
    }
    g.computeBoundingSphere();
    g.userData.shared = true;     // shared by every avatar: Nook's disposeObj leaves these alone
    geoCache.set(key, g);
    return g;
  }
  // Build three.js objects from the file's nodes. make(mesh, prim, material) returns the Mesh to use.
  function build(file, n, make, skip) {
    if (skip && skip(n)) return null;
    let o;
    if (n.mesh >= 0) {
      const m = file.meshes[n.mesh];
      if (m.prims.length === 1) o = make(m, 0, file.materials[m.prims[0].material]);
      else { o = new T.Group(); m.prims.forEach((_, k) => { const me = make(m, k, file.materials[m.prims[k].material]); me.name = n.name + '_' + k; o.add(me); }); }
    } else o = new T.Group();
    o.name = n.name;
    o.position.fromArray(n.t); o.quaternion.fromArray(n.r); o.scale.fromArray(n.s);
    n.children.forEach(c => { const ch = build(file, c, make, skip); if (ch) o.add(ch); });
    return o;
  }
  function outlineMat(w, color) {
    const m = new T.MeshBasicMaterial({ color: color || 0x2a1c22, side: T.BackSide });
    m.onBeforeCompile = sh => {
      sh.uniforms.uOutline = { value: w };
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uOutline;')
        .replace('#include <morphtarget_vertex>', '#include <morphtarget_vertex>\ntransformed += normalize(normal) * uOutline;');
    };
    m.customProgramCacheKey = () => 'nook-outline';
    return m;
  }
  function addOutline(mesh, mat) {
    const o = new T.Mesh(mesh.geometry, mat);
    o.name = mesh.name + '_outline'; o.userData.outline = true; o.castShadow = o.receiveShadow = false;
    if (mesh.morphTargetInfluences) { o.morphTargetInfluences = mesh.morphTargetInfluences; o.morphTargetDictionary = mesh.morphTargetDictionary; }
    o.raycast = () => {};   // clicks and the ground ray see the real shape, not the outline
    mesh.add(o);
    return o;
  }

  /* ---------------- the character ---------------- */
  const charOutline = outlineMat(0.0042);
  const CH_BY_NAME = {};
  (function index(list) { list.forEach(n => { CH_BY_NAME[n.name] = n; index(n.children); }); })(CH.roots);

  function patchHead(mat, tex) {
    mat.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, { uFace: { value: tex }, uFaceC: { value: new T.Vector2(F.cx, F.cy) }, uFaceS: { value: F.size }, uFaceZ: { value: F.front_z } });
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vObjPos;\nvarying vec3 vObjN;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObjPos = position;\nvObjN = normal;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform sampler2D uFace;\nuniform vec2 uFaceC;\nuniform float uFaceS;\nuniform float uFaceZ;\nvarying vec3 vObjPos;\nvarying vec3 vObjN;')
        .replace('#include <color_fragment>', `#include <color_fragment>
          {
            vec2 fuv = vec2((vObjPos.x - uFaceC.x) / uFaceS + 0.5, (vObjPos.y - uFaceC.y) / uFaceS + 0.5);
            if (fuv.x > 0.0 && fuv.x < 1.0 && fuv.y > 0.0 && fuv.y < 1.0 && vObjPos.z > uFaceZ) {
              vec4 f = texture2D(uFace, fuv);
              float facing = smoothstep(0.1, 0.5, normalize(vObjN).z);
              diffuseColor.rgb = mix(diffuseColor.rgb, f.rgb, f.a * facing);
            }
          }`);
    };
    mat.customProgramCacheKey = () => 'nook-head';
  }
  function patchHairShine(mat) {
    mat.onBeforeCompile = sh => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', `
        float band = smoothstep(0.38, 0.5, vNormal.y) * (1.0 - smoothstep(0.62, 0.74, vNormal.y)) * smoothstep(0.1, 0.4, vNormal.z);
        outgoingLight += diffuseColor.rgb * band * 0.55 + vec3(band * 0.06);
        #include <opaque_fragment>`);
    };
    mat.customProgramCacheKey = () => 'nook-hair';
  }

  // The drawn face: one canvas per avatar (eyes, brows and mouth are painted, so they can blink and change mood).
  function makeFace(state, FS) {
    const cv = document.createElement('canvas'); cv.width = cv.height = FS;
    const tex = new T.CanvasTexture(cv); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4;
    const g = cv.getContext('2d'), PX = FS / F.size;
    const toPx = (x, y) => [FS / 2 + (x - F.cx) * PX, FS / 2 - (y - F.cy) * PX];
    const st = { blink: 0, look: { x: 0, y: 0, tx: 0, ty: 0 }, expr: 'Neutral', dirty: true }, male = state.body === 1;
    const C = h => new T.Color(h), hx = c => '#' + c.getHexString();
    const browColour = () => hx(C(HAIRCOLS[state.hairColor]).multiplyScalar(0.72).lerp(C('#4a2a1a'), 0.25));
    const lipColour = () => hx(C(SKINS[state.skin]).multiply(new T.Color(0.86, 0.62, 0.6)).lerp(C('#b0504e'), 0.12));
    const LASH = '#24161a', INK = '#2a1a14';
    function openOf(ex, side) { let o = ex.open; if (ex.wink && side < 0) o = 0; return o * (1 - st.blink); }
    // --- detailed style ---
    function eyePath(cx, cy, w, h, e, side, open) {
      const tilt = e.tilt * h, ix = cx - side * w / 2, ox = cx + side * w / 2, iy = cy + tilt * 0.5, oy = cy - tilt * 0.5;
      const top = h * e.top * open, bot = h * e.bot * Math.max(open, 0.08);
      return { ix, iy, ox, oy, top, bot,
        upper(c) { c.bezierCurveTo(ix + side * w * 0.22, cy - top * 1.12, ox - side * w * 0.2, cy - top * 1.12, ox, oy); },
        lower(c) { c.bezierCurveTo(ox - side * w * 0.2, cy + bot * 1.0, ix + side * w * 0.22, cy + bot * 1.0, ix, iy); } };
    }
    function drawEye(side, shape, ex, eyeHex) {
      const [cx, cy] = toPx(side * F.eye_dx, F.eye_y), W = F.eye_w * PX * shape.w, H = F.eye_h * PX * shape.h * 0.5, open = openOf(ex, side);
      const p = eyePath(cx, cy, W, H, shape, side, open), L = st.look;
      if (open > 0.06) {
        g.save(); g.beginPath(); g.moveTo(p.ix, p.iy); p.upper(g); p.lower(g); g.closePath(); g.fillStyle = '#fbf8f4'; g.fill(); g.clip();
        const R = H * 0.95, irx = cx + L.x * W * 0.16, iry = cy + L.y * H * 0.22 + H * 0.05, col = C(eyeHex);
        const ir = g.createRadialGradient(irx, iry + R * 0.35, R * 0.1, irx, iry, R);
        ir.addColorStop(0, hx(col.clone().lerp(C('#fff'), 0.3))); ir.addColorStop(0.6, eyeHex); ir.addColorStop(0.92, hx(col.clone().multiplyScalar(0.3))); ir.addColorStop(1, '#140c09');
        g.fillStyle = ir; g.beginPath(); g.arc(irx, iry, R, 0, TAU); g.fill();
        g.fillStyle = '#0b0807'; g.beginPath(); g.arc(irx, iry, R * 0.5, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,255,255,.95)'; g.beginPath(); g.arc(irx - R * 0.38, iry - R * 0.4, R * 0.2, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.arc(irx + R * 0.34, iry + R * 0.36, R * 0.09, 0, TAU); g.fill();
        const sh = g.createLinearGradient(0, cy - p.top * 1.1, 0, cy - p.top * 0.2); sh.addColorStop(0, 'rgba(60,30,20,.45)'); sh.addColorStop(1, 'rgba(60,30,20,0)');
        g.fillStyle = sh; g.fillRect(cx - W, cy - H * 2, W * 2, H * 2); g.restore();
      }
      g.lineCap = 'round'; g.lineJoin = 'round';
      if (open > 0.06) {
        g.strokeStyle = '#1b120e'; g.lineWidth = H * 0.24; g.beginPath(); g.moveTo(p.ix, p.iy); p.upper(g); g.stroke();
        g.strokeStyle = 'rgba(80,45,32,.55)'; g.lineWidth = H * 0.08; g.beginPath(); g.moveTo(p.ox, p.oy); p.lower(g); g.stroke();
        if (shape.lash) { g.strokeStyle = '#1b120e'; g.lineWidth = H * 0.13; for (let k = 0; k < 3; k++) { const t = 0.62 + k * 0.17, bx = p.ix + (p.ox - p.ix) * t, by = cy - p.top * (1.05 - 0.55 * (t - 0.5) ** 2 * 4) + (p.oy - cy) * t; g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + side * H * (0.35 + k * 0.15), by - H * (0.42 + k * 0.08)); g.stroke(); } }
      } else {
        g.strokeStyle = '#1b120e'; g.lineWidth = H * 0.22; g.beginPath(); g.moveTo(p.ix, cy);
        g.quadraticCurveTo(cx, cy + (ex.smileEye ? -H * 0.75 : H * 0.35), p.ox, cy - shape.tilt * H * 0.5); g.stroke();
      }
    }
    function drawBrow(side, b, ex, style) {
      const [cx, cy0] = toPx(side * F.eye_dx, F.brow_y), T0 = F.brow_thick * PX;
      if (style === 2) {
        const L = F.brow_len * PX * b.len, Tk = T0 * b.thick, cy = cy0 - ex.browUp * Tk * 1.2, tilt = (b.tilt + 0.28 * ex.browIn) * L, top = [], bot = [];
        for (let i = 0; i <= 24; i++) { const u = i / 24, x = cx + side * (u - 0.45) * L; const arch = -b.arch * Tk * 1.6 * sin(Math.min(u / 0.62, 1) * PI / 2) + b.arch * Tk * 1.4 * Math.max(0, u - 0.62) / 0.38; const sad = ex.browIn < 0 ? (1 - u) * Tk * 1.2 * -ex.browIn : 0; const y = cy + arch + tilt * (0.5 - u) - sad, th = Tk * (1 - b.taper * u ** 1.5) * (0.7 + 0.3 * Math.min(1, u / 0.12)); top.push([x, y - th / 2]); bot.push([x, y + th / 2]); }
        g.beginPath(); g.moveTo(...top[0]); top.slice(1).forEach(q => g.lineTo(...q)); bot.reverse().forEach(q => g.lineTo(...q)); g.closePath(); g.fillStyle = browColour(); g.fill();
        return;
      }
      const simple = style === 1, L = F.brow_len * PX * b.len * (simple ? 0.85 : 1), cy = cy0 - ex.browUp * T0 * (simple ? 1.3 : 2.0), tilt = (b.tilt + (simple ? 0.3 : 0.35) * ex.browIn) * L;
      g.strokeStyle = browColour(); g.lineWidth = T0 * (simple ? 0.42 + 0.3 * b.thick : 0.35 + 0.35 * b.thick); g.lineCap = 'round'; g.beginPath();
      for (let i = 0; i <= 16; i++) {
        const u = i / 16, x = cx + side * (u - (simple ? 0.45 : 0.4)) * L;
        const arch = simple ? -(0.25 + b.arch) * T0 * 1.2 * sin(u * PI) : -(0.3 + b.arch) * T0 * 1.4 * sin(Math.min(u / 0.7, 1) * PI / 2) + (0.3 + b.arch) * T0 * 0.8 * Math.max(0, u - 0.7) / 0.3;
        const sad = ex.browIn < 0 ? (1 - u) * T0 * (simple ? 1.3 : 1.6) * -ex.browIn : 0, y = cy + arch + tilt * (0.5 - u) - sad;
        if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.stroke();
    }
    // --- anime style (the default) ---
    function drawEyeAnime(side, shape, ex, eyeHex) {
      const [cx, cy] = toPx(side * F.eye_dx, F.eye_y), W = F.eye_w * PX * shape.w, Hf = F.eye_h * PX * shape.h, open = openOf(ex, side), L = st.look;
      g.lineCap = 'round'; g.lineJoin = 'round';
      const tilt = shape.tilt * Hf * 0.5, ix = cx - side * W * 0.5, ox = cx + side * W * 0.5;
      if (open < 0.08) {
        g.strokeStyle = LASH; g.lineWidth = Hf * 0.075; g.beginPath(); g.moveTo(ix, cy + Hf * 0.05);
        if (ex.smileEye) g.quadraticCurveTo(cx, cy - Hf * 0.42, ox, cy + Hf * 0.05 - tilt); else g.quadraticCurveTo(cx, cy + Hf * 0.2, ox, cy - tilt);
        g.stroke(); return;
      }
      const H = Hf * open, iy = cy + Hf * 0.06, oy = cy - Hf * 0.02 - tilt;
      const topY = cy - H * 0.52 * shape.top, botY = cy + Math.min(H * 0.46 * shape.bot, Hf * 0.46);
      const upper = c => c.bezierCurveTo(ix + side * W * 0.12, topY - H * 0.08, ox - side * W * 0.18, topY - H * 0.06, ox, oy);
      const lower = c => c.bezierCurveTo(ox - side * W * 0.1, botY + H * 0.02, ix + side * W * 0.25, botY, ix, iy);
      g.save(); g.beginPath(); g.moveTo(ix, iy); upper(g); lower(g); g.closePath(); g.fillStyle = '#ffffff'; g.fill(); g.clip();
      const o = ex.mouth === 'o' ? 0.82 : 1, rx = W * 0.36 * o, ry = Hf * 0.43 * o, icx = cx + side * W * 0.02 + L.x * W * 0.12, icy = cy + Hf * 0.07 + L.y * Hf * 0.07, col = C(eyeHex);
      const ig = g.createLinearGradient(0, icy - ry, 0, icy + ry);
      ig.addColorStop(0, hx(col.clone().multiplyScalar(0.22))); ig.addColorStop(0.45, hx(col.clone().multiplyScalar(0.75))); ig.addColorStop(0.85, hx(col.clone().lerp(C('#ffffff'), 0.35))); ig.addColorStop(1, hx(col.clone().lerp(C('#ffffff'), 0.5)));
      g.fillStyle = ig; g.beginPath(); g.ellipse(icx, icy, rx, ry, 0, 0, TAU); g.fill();
      g.strokeStyle = hx(col.clone().multiplyScalar(0.25)); g.lineWidth = rx * 0.1; g.stroke();
      g.fillStyle = hx(col.clone().multiplyScalar(0.12)); g.beginPath(); g.ellipse(icx, icy - ry * 0.05, rx * 0.42, ry * 0.46, 0, 0, TAU); g.fill();
      g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(icx - rx * 0.38, icy - ry * 0.42, rx * 0.34, ry * 0.24, -0.4, 0, TAU); g.fill();
      g.beginPath(); g.arc(icx + rx * 0.4, icy + ry * 0.35, rx * 0.13, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.ellipse(icx, icy + ry * 0.62, rx * 0.55, ry * 0.18, 0, 0, TAU); g.fill();
      const sh = g.createLinearGradient(0, topY - H * 0.1, 0, topY + H * 0.35); sh.addColorStop(0, 'rgba(40,20,30,.55)'); sh.addColorStop(1, 'rgba(40,20,30,0)');
      g.fillStyle = sh; g.fillRect(cx - W, topY - H, W * 2, H * 1.4);
      if (ex.smileEye) { g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.ellipse(cx, botY + H * 0.32, W * 0.75, H * 0.36, 0, 0, TAU); g.fill(); g.globalCompositeOperation = 'source-over'; }
      g.restore();
      g.strokeStyle = LASH; g.lineWidth = Hf * (male ? 0.1 : 0.085); g.beginPath(); g.moveTo(ix, iy); upper(g); g.stroke();
      if (!male) { g.fillStyle = LASH; g.beginPath(); g.moveTo(ox - side * W * 0.18, topY + H * 0.02); g.lineTo(ox + side * W * 0.16, oy - Hf * 0.12); g.lineTo(ox + side * W * 0.02, oy + Hf * 0.06); g.closePath(); g.fill(); }
      g.lineWidth = Hf * 0.03; g.beginPath(); g.moveTo(ox - side * W * 0.05, oy + Hf * 0.05); g.quadraticCurveTo(cx + side * W * 0.2, botY + H * 0.02, cx - side * W * 0.05, botY - H * 0.01); g.stroke();
      if (shape.lash) { g.lineWidth = Hf * 0.04; for (let k = 0; k < 3; k++) { const bx = ox - side * W * (0.06 + 0.12 * k), by = oy - Hf * (0.02 + 0.05 * k); g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + side * W * 0.12, by - Hf * (0.12 + 0.02 * k)); g.stroke(); } }
      if (shape.hood) { g.strokeStyle = 'rgba(60,30,30,.5)'; g.lineWidth = Hf * 0.03; g.beginPath(); g.moveTo(ix + side * W * 0.08, topY - H * 0.02); g.quadraticCurveTo(cx, topY - H * 0.3, ox, oy - Hf * 0.12); g.stroke(); }
    }
    function drawEyeSimple(side, shape, ex, eyeHex) {
      const [cx0, cy0] = toPx(side * F.eye_dx, F.eye_y), W = F.eye_w * PX * shape.w * 0.42, H = F.eye_h * PX * shape.h * 0.52, open = openOf(ex, side), L = st.look;
      const cx = cx0 + L.x * W * 0.22, cy = cy0 + L.y * H * 0.18;
      g.lineCap = 'round'; g.lineJoin = 'round';
      if (open < 0.08) { g.strokeStyle = INK; g.lineWidth = H * 0.28; g.beginPath(); g.moveTo(cx0 - W * 1.1, cy0); g.quadraticCurveTo(cx0, cy0 + (ex.smileEye ? -H * 0.9 : H * 0.35), cx0 + W * 1.1, cy0); g.stroke(); return; }
      const col = C(eyeHex).lerp(C(INK), 0.6), h = H * open;
      g.save(); g.translate(cx, cy); g.rotate(-side * shape.tilt * 0.6); g.beginPath(); g.ellipse(0, 0, W, h, 0, 0, TAU);
      if (shape.hood) { g.save(); g.clip(); g.fillStyle = hx(col); g.fillRect(-W * 2, -h * 0.55, W * 4, h * 3); g.restore(); } else { g.fillStyle = hx(col); g.fill(); }
      g.fillStyle = 'rgba(255,255,255,.95)'; g.beginPath(); g.arc(-W * 0.32, -h * 0.38, Math.min(W, h) * 0.32, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.arc(W * 0.3, h * 0.36, Math.min(W, h) * 0.13, 0, TAU); g.fill();
      if (ex.smileEye) { g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.ellipse(0, h * 1.45, W * 1.6, h * 0.9, 0, 0, TAU); g.fill(); g.globalCompositeOperation = 'source-over'; }
      g.restore();
    }
    function drawMouth(ex, style) {
      const [cx, cy] = toPx(0, F.mouth_y), W = F.mouth_w * PX, kind = ex.mouth || ['soft', 'small', 'full', 'wide', 'firm'][state.mouth];
      g.lineCap = 'round'; g.lineJoin = 'round';
      const dark = style === 0 ? '#7a2f35' : '#5a2621', tongue = style === 0 ? '#f08a92' : '#e06d72';
      if (kind === 'o') { g.fillStyle = dark; g.beginPath(); g.ellipse(cx, cy + W * 0.05, W * 0.2, W * 0.27, 0, 0, TAU); g.fill(); return; }
      if (kind === 'grin' || kind === 'laugh') {
        const w = W * (kind === 'laugh' ? 1.05 : 0.8), h = W * (kind === 'laugh' ? 0.75 : 0.45);
        g.beginPath(); g.moveTo(cx - w / 2, cy - W * 0.08); g.quadraticCurveTo(cx, cy - W * 0.02, cx + w / 2, cy - W * 0.08);
        g.bezierCurveTo(cx + w * 0.4, cy + h, cx - w * 0.4, cy + h, cx - w / 2, cy - W * 0.08); g.closePath(); g.fillStyle = dark; g.fill();
        g.save(); g.clip(); g.fillStyle = tongue; g.beginPath(); g.ellipse(cx, cy + h * 0.8, w * 0.3, h * 0.35, 0, 0, TAU); g.fill(); g.restore();
        if (style === 0) { g.strokeStyle = LASH; g.lineWidth = W * 0.05; g.stroke(); }
        return;
      }
      if (style === 2) {   // detailed: lips
        const lip = lipColour(), w = W * ({ soft: 1, small: 0.75, full: 1.05, wide: 1.35, firm: 1.0 }[kind] || 1);
        const curve = { soft: 0.13, small: 0.1, full: 0.1, wide: 0.12, firm: -0.02, frown: -0.2, sad: -0.14 }[kind] ?? 0.1, full = { full: 1.6, soft: 1, small: 0.9, wide: 1, firm: 0.7, frown: 0.8, sad: 0.9 }[kind] ?? 1;
        g.fillStyle = lip; g.beginPath(); g.moveTo(cx - w * 0.42, cy - curve * W * 0.5); g.quadraticCurveTo(cx, cy + W * 0.2 * full, cx + w * 0.42, cy - curve * W * 0.5); g.quadraticCurveTo(cx, cy + W * 0.05, cx - w * 0.42, cy - curve * W * 0.5); g.fill();
        g.beginPath(); g.moveTo(cx - w * 0.45, cy - curve * W * 0.5); g.quadraticCurveTo(cx - w * 0.2, cy - W * 0.13 * full, cx, cy - W * 0.07 * full); g.quadraticCurveTo(cx + w * 0.2, cy - W * 0.13 * full, cx + w * 0.45, cy - curve * W * 0.5); g.quadraticCurveTo(cx, cy + W * 0.02, cx - w * 0.45, cy - curve * W * 0.5);
        g.fillStyle = hx(C(lip).multiplyScalar(0.9)); g.fill();
        g.strokeStyle = 'rgba(80,30,25,.8)'; g.lineWidth = W * 0.045; g.beginPath(); g.moveTo(cx - w * 0.5, cy - curve * W * 0.9); g.quadraticCurveTo(cx, cy + curve * W * 0.6, cx + w * 0.5, cy - curve * W * 0.9); g.stroke();
        return;
      }
      const spec = { soft: [0.5, 0.14], small: [0.32, 0.1], full: [0.48, 0.08], wide: [0.75, 0.16], firm: [0.42, 0.0], frown: [0.4, -0.18], sad: [0.38, -0.12] }[kind] || [0.5, 0.14];
      g.strokeStyle = style === 0 ? '#5a2a26' : '#6b2f28'; g.lineWidth = W * 0.07;
      g.beginPath(); g.moveTo(cx - W * spec[0] / 2, cy - spec[1] * W * 0.3); g.quadraticCurveTo(cx, cy + spec[1] * W * 0.6, cx + W * spec[0] / 2, cy - spec[1] * W * 0.3); g.stroke();
      if (style === 0 && kind === 'full') { g.strokeStyle = 'rgba(200,110,110,.5)'; g.lineWidth = W * 0.05; g.beginPath(); g.moveTo(cx - W * 0.12, cy + W * 0.14); g.quadraticCurveTo(cx, cy + W * 0.2, cx + W * 0.12, cy + W * 0.14); g.stroke(); }
    }
    function drawBlush(strong) {
      for (const side of [1, -1]) {
        const [cx, cy] = toPx(side * F.eye_dx * 1.08, F.eye_y - F.eye_h * 0.72), rg = g.createRadialGradient(cx, cy, 0, cx, cy, F.eye_w * PX * 0.55);
        rg.addColorStop(0, `rgba(240,110,120,${strong ? 0.45 : 0.18})`); rg.addColorStop(1, 'rgba(240,110,120,0)');
        g.fillStyle = rg; g.fillRect(cx - FS * 0.2, cy - FS * 0.2, FS * 0.4, FS * 0.4);
        if (strong) { g.strokeStyle = 'rgba(220,80,95,.7)'; g.lineWidth = F.eye_w * PX * 0.035; g.lineCap = 'round'; for (let k = -1; k <= 1; k++) { const x = cx + k * F.eye_w * PX * 0.16; g.beginPath(); g.moveTo(x + F.eye_w * PX * 0.06, cy - F.eye_w * PX * 0.08); g.lineTo(x - F.eye_w * PX * 0.06, cy + F.eye_w * PX * 0.08); g.stroke(); } }
      }
    }
    function draw() {
      g.clearRect(0, 0, FS, FS);
      const ex = EXPRS[st.expr] || EXPRS.Neutral, style = state.face, eyeHex = EYECOLS[state.eyeColor];
      const shape = male ? MALE_EYES(EYES[state.eyes][1]) : EYES[state.eyes][1], b = male ? MALE_BROWS(BROWS[state.brows][1]) : BROWS[state.brows][1];
      if (style !== 0 && !male) for (const side of [1, -1]) {
        const [cx, cy] = toPx(side * F.eye_dx * 1.25, F.eye_y - F.eye_h * 1.05), rg = g.createRadialGradient(cx, cy, 0, cx, cy, F.eye_w * PX * 0.75);
        rg.addColorStop(0, 'rgba(235,110,100,.22)'); rg.addColorStop(1, 'rgba(235,110,100,0)'); g.fillStyle = rg; g.fillRect(cx - FS * 0.2, cy - FS * 0.2, FS * 0.4, FS * 0.4);
      }
      if (style === 0) { if (!male || ex.smileEye || ex.wink) drawBlush(ex.smileEye || ex.wink); for (const s of [1, -1]) { drawEyeAnime(s, shape, ex, eyeHex); drawBrow(s, b, ex, 0); } }
      else if (style === 1) { for (const s of [1, -1]) { drawEyeSimple(s, shape, ex, eyeHex); drawBrow(s, b, ex, 1); } }
      else { for (const s of [1, -1]) { drawEye(s, shape, ex, eyeHex); drawBrow(s, b, ex, 2); } }
      drawMouth(ex, style);
      tex.needsUpdate = true; st.dirty = false;
    }
    return { tex, st, draw, canvas: cv };
  }

  const JOINTS = ['hips', 'spine', 'neck', 'head', 'shoulder_L', 'shoulder_R', 'elbow_L', 'elbow_R', 'hand_L', 'hand_R', 'hip_L', 'hip_R', 'knee_L', 'knee_R', 'ankle_L', 'ankle_R'];
  // cfg: any Nook look. o.face: size of the face canvas (bigger for close-ups).
  function buildAvatar(cfg, o = {}) {
    const state = cleanLook(cfg);
    const hairName = HAIRS[state.hairStyle][1] ? 'Hair_' + HAIRS[state.hairStyle][1] : null;
    const face = makeFace(state, o.face || 512);
    const mats = {}, P = {}, J = {}, REST = {};
    const matFor = m => {
      const name = m ? m.name : 'Default';
      if (!mats[name]) {
        const t = new T.MeshToonMaterial({ color: m ? lin(m.color) : new T.Color('#ffffff'), gradientMap: toneChar, name });
        if (name === 'Head') patchHead(t, face.tex);
        if (name === 'Hair') patchHairShine(t);
        mats[name] = t;
      }
      return mats[name];
    };
    const root = build(CH, CH_BY_NAME.root || CH.roots[0], (mesh, k, m) => {
      const me = new T.Mesh(geometry(mesh, k), matFor(m));
      if (mesh.targets.length) { me.morphTargetDictionary = {}; mesh.targets.forEach((nm, i) => { me.morphTargetDictionary[nm] = i; }); me.morphTargetInfluences = mesh.targets.map(() => 0); }
      me.castShadow = true; me.receiveShadow = false;
      return me;
    }, n => n.name.startsWith('Hair_') && n.name !== hairName);
    root.traverse(n => { if (n.isMesh) { P[n.name] = n; REST[n.name] = { scale: n.scale.clone() }; } else if (n.name) { J[n.name] = n; REST[n.name] = { pos: n.position.clone() }; } });
    for (const name in P) if (name !== 'Nose') addOutline(P[name], charOutline);
    // colours
    const skin = new T.Color(SKINS[state.skin]);
    const setC = (name, c) => { if (mats[name]) mats[name].color.copy(c); };
    setC('Skin', skin); setC('Head', skin); setC('Hair', new T.Color(HAIRCOLS[state.hairColor]));
    setC('Shirt', new T.Color(SHIRTS[state.topColor])); setC('Pants', new T.Color(PANTS[state.bottomColor])); setC('Shoes', new T.Color(SHOES[state.shoes]));
    // body type and height: scale parts around their joints (same as the customizer)
    const male = state.body === 1, b = male ? MALE_BODY(BODIES[state.build][1]) : BODIES[state.build][1], hf = HEIGHTS[state.height][1], legF = hf, torsoF = 0.5 + 0.5 * hf, armF = 0.5 + 0.5 * hf;
    const sc = (name, x, y, z) => { const p = P[name]; if (p) p.scale.set(REST[name].scale.x * x, REST[name].scale.y * y, REST[name].scale.z * z); };
    const mv = (name, fx, fy) => { const j = J[name]; if (j) j.position.set(REST[name].pos.x * fx, REST[name].pos.y * fy, REST[name].pos.z); };
    const morph = (name, k, f) => { const p = P[name]; if (!p || !p.morphTargetDictionary) return; p.morphTargetInfluences[p.morphTargetDictionary.thick] = (k - 1) / 0.5; p.morphTargetInfluences[p.morphTargetDictionary.long] = (f - 1) / 0.3; };
    sc('Torso', b.tw, torsoF, b.td); sc('Pelvis', b.pw, 1, (b.td + 1) / 2); mv('neck', 1, torsoF); if (male) sc('Neck', 1.14, 1, 1.12);
    for (const s of ['L', 'R']) {
      mv('shoulder_' + s, b.sh, torsoF); mv('elbow_' + s, 1, armF); mv('hand_' + s, 1, armF);
      morph('UpperArm_' + s, b.arm, armF); morph('LowerArm_' + s, b.arm, armF);
      sc('Sleeve_' + s, b.arm * (male ? 0.84 : 1), male ? 1.12 : 1, b.arm * (male ? 0.84 : 1));   // male: a plain T-shirt sleeve, not a puff sc('Hand_' + s, 0.9 + 0.1 * b.arm, 1, 0.9 + 0.1 * b.arm);
      mv('hip_' + s, b.hip, 1); mv('knee_' + s, 1, legF); mv('ankle_' + s, 1, legF);
      morph('UpperLeg_' + s, b.leg, legF); morph('LowerLeg_' + s, b.leg, legF); sc('Shorts_' + s, b.leg, legF, b.leg);
    }
    const groundOffset = -(REST.knee_L.pos.y + REST.ankle_L.pos.y) * (legF - 1);
    root.position.y = groundOffset;
    // the head turns around its middle (Nook's code and the first-person view treat the head's position as its centre)
    const head = J.head, hc = new T.Vector3(0, F.cy + 0.02, 0), hp = new T.Group(); hp.name = 'headCentre';
    hp.position.copy(hc); [...head.children].forEach(c => { head.remove(c); c.position.sub(hc); hp.add(c); }); head.add(hp);
    // the soles: where the feet touch the floor
    const feet = {};
    [['L', 1], ['R', -1]].forEach(([s, k]) => { const f = new T.Object3D(); f.position.set(0, -0.085, 0); J['ankle_' + s].add(f); feet[k] = f; });
    const av = new T.Group(), body = new T.Group(), fit = new T.Group();
    fit.scale.setScalar(K); fit.add(root); body.add(fit); av.add(body); av.name = 'AnimeAvatar';
    av.userData = {
      body, head: hp, eyes: [], blink: Math.random() * 4,
      arms: { 1: J.shoulder_L, [-1]: J.shoulder_R }, elbows: { 1: J.elbow_L, [-1]: J.elbow_R },
      legs: { 1: J.hip_L, [-1]: J.hip_R }, knees: { 1: J.knee_L, [-1]: J.knee_R }, feet,
      pelvisY: (PELVIS_BOTTOM + groundOffset) * K,       // height of the seat of the pants above the feet (avatar units)
      anime: { J, root, fit, face, state, mats, groundOffset, last: null, rest: null, restK: 0, cur: {}, nextBlink: 1 + Math.random() * 3, blinkT: -1, glanceAt: 0, look: [0, 0] }
    };
    face.draw();
    return av;
  }
  function dispose(av) {
    const A = av.userData && av.userData.anime; if (!A) return;
    A.face.tex.dispose(); for (const k in A.mats) A.mats[k].dispose();
  }

  // Moves. Nook calls pose(av, t, o) every frame with o = { walk, phase, wave, lookX, lookY, pitch, roll }.
  // Extra here: o.rest = 'sit' | 'lie' | 'fire' (resting poses), o.expr = an expression name, o.sway = gentle rock.
  const restPose = (kind, t, set) => {
    if (kind === 'sit') {
      const sw = sin(t * 1.4);
      set('hip_L', -1.45, 0, 0.04); set('hip_R', -1.45, 0, -0.04); set('knee_L', 1.4 + 0.12 * sw); set('knee_R', 1.4 - 0.12 * sw);
      set('spine', -0.06, 0, 0); set('shoulder_L', -0.32, 0, 0.2); set('shoulder_R', -0.32, 0, -0.2); set('elbow_L', -0.6); set('elbow_R', -0.6);
      return { drop: true };
    }
    if (kind === 'fire') {
      const w = sin(t * 1.7);
      set('hip_L', -1.25, 0, 0.12); set('hip_R', -1.25, 0, -0.12); set('knee_L', 1.95); set('knee_R', 1.95); set('ankle_L', 0.2); set('ankle_R', 0.2);
      set('spine', 0.22, 0, 0); set('shoulder_L', -1.0 - 0.05 * w, 0, 0.25); set('shoulder_R', -1.0 + 0.05 * w, 0, -0.25);
      set('elbow_L', -0.45, 0, 0.1); set('elbow_R', -0.45, 0, -0.1); set('hand_L', 0.5, 0, 0.3); set('hand_R', 0.5, 0, -0.3);
      return { drop: true, headX: 0.12 + 0.03 * w };
    }
    if (kind === 'lie') {
      const b = sin(t * 0.9);
      set('spine', 0.02 * b); set('shoulder_L', -0.55, 0, 0.3); set('shoulder_R', -0.55, 0, -0.3); set('elbow_L', -1.45); set('elbow_R', -1.45);
      set('hip_R', -0.75); set('knee_R', 1.35); set('hip_L', -0.08); set('knee_L', 0.12);
      return { lie: true, headX: 0.25 };
    }
    return {};
  };
  const tmpE = new Map();
  function pose(av, t, o = {}) {
    const u = av.userData, A = u.anime; if (!A) return;
    const dt = A.last == null ? 0.016 : Math.max(0, Math.min(0.1, t - A.last)); A.last = t;
    const J = A.J, w = o.walk || 0, ph = o.phase || 0, k = o.wave || 0;
    // --- face: blink, glance, mood ---
    const F_ = A.face, st = F_.st;
    if (A.blinkT < 0 && t > A.nextBlink) A.blinkT = 0;
    if (A.blinkT >= 0) {
      A.blinkT += dt;
      const bl = A.blinkT < 0.07 ? A.blinkT / 0.07 : A.blinkT < 0.16 ? 1 - (A.blinkT - 0.07) / 0.09 : 0;
      if (bl !== st.blink) { st.blink = Math.max(0, bl); st.dirty = true; }
      if (A.blinkT > 0.16) { A.blinkT = -1; A.nextBlink = t + 2.2 + Math.random() * 3; }
    }
    if (t > A.glanceAt) { A.glanceAt = t + 1.5 + Math.random() * 3; A.look = Math.random() < 0.4 ? [0, 0] : [(Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 0.6]; }
    const kl = 1 - Math.exp(-dt * 6), L = st.look, nx = L.x + (A.look[0] - L.x) * kl, ny = L.y + (A.look[1] - L.y) * kl;
    if (Math.abs(nx - L.x) + Math.abs(ny - L.y) > 0.004) { L.x = nx; L.y = ny; st.dirty = true; }
    const expr = o.expr || (o.rest === 'lie' && o.sleep ? 'Sleep' : o.rest === 'lie' ? 'Calm' : k > 0.5 ? 'Happy' : 'Neutral');
    if (expr !== st.expr) { st.expr = expr; st.dirty = true; }
    if (st.dirty) F_.draw();
    // --- body ---
    const r = tmpE; r.clear();
    const set = (j, x = 0, y = 0, z = 0) => r.set(j, [x, y, z]);
    const s = sin(ph), c = cos(ph), br = sin(t * 1.6);
    set('hip_L', -0.5 * s * w); set('hip_R', 0.5 * s * w);
    set('knee_L', (0.6 * Math.max(0, -c) + 0.05) * w); set('knee_R', (0.6 * Math.max(0, c) + 0.05) * w);
    set('ankle_L', -0.15 * s * w); set('ankle_R', 0.15 * s * w);
    set('spine', 0.015 * br * (1 - w) + 0.04 * w, 0.1 * s * w, 0.012 * sin(t * 0.8) * (1 - w));
    set('shoulder_L', 0.45 * s * w, 0, 0.13 + 0.02 * br * (1 - w)); set('shoulder_R', -0.45 * s * w, 0, -0.13 - 0.02 * br * (1 - w) - k * 2.22);
    set('elbow_L', -0.12 - 0.2 * w); set('elbow_R', -0.12 - 0.2 * w, 0, k * (-0.45 + 0.42 * sin(t * 9)));
    set('hand_R', 0, 0, 0.15 * k * sin(t * 9));
    let rest = {}, want = o.rest || null;
    if (want) A.rest = want;
    A.restK += ((want ? 1 : 0) - A.restK) * (1 - Math.exp(-dt * 7));
    if (A.restK < 0.002 && !want) { A.restK = 0; A.rest = null; }
    if (A.rest) {
      const rr = new Map(); rest = restPose(A.rest, t, (j, x = 0, y = 0, z = 0) => rr.set(j, [x, y, z]));
      const f = A.restK;
      for (const j of JOINTS) { const a = r.get(j) || [0, 0, 0], b = rr.get(j) || [0, 0, 0]; r.set(j, [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]); }
    }
    for (const j of JOINTS) { if (j === 'head') continue; const v = r.get(j); const n = J[j]; if (n) { if (v) n.rotation.set(v[0], v[1], v[2]); else n.rotation.set(0, 0, 0); } }
    // Nook's body and head controls (tracking and the games turn these after pose)
    u.body.position.set(0, Math.abs(s) * 0.025 * w + br * 0.004 * (1 - A.restK), 0);
    u.body.rotation.set(0, 0, 0);
    const pitch = o.pitch != null ? o.pitch : (o.lookY || 0) * 0.15;
    u.head.rotation.set(pitch + (rest.headX || 0) * A.restK, (o.lookX || 0) + (A.rest === 'sit' ? 0.3 * sin(t * 0.22) * A.restK : 0), (o.roll || 0) + sin(t * 0.7 + u.blink) * 0.02);
    // sitting drops the seat of the pants onto the seat; lying turns the body onto its back along -z
    const f = A.restK, lie = rest.lie ? f : 0, drop = rest.drop ? f : 0;
    A.root.rotation.x = -PI / 2 * lie;
    A.root.position.set(0, A.groundOffset * (1 - drop - lie) - PELVIS_BOTTOM * drop + 0.13 * lie, 0.66 * lie);
  }
  // the mood an avatar shows (Nook's pose() callers do not know about faces)
  function setExpression(av, name) { const A = av.userData.anime; if (A && A.face.st.expr !== name) { A.face.st.expr = name; A.face.draw(); } }

  /* ---------------- the island ---------------- */
  function buildIsland(scene, o = {}) {
    const J_ = ISJ;
    const OUT = { big: outlineMat(0.011), small: outlineMat(0.0055) };
    const NO_OUTLINE = /^(Ground|Grass_Tufts|Flowers|Flame_|House_Flame_|Pond_Water|Path_Stones|Towels|House_Floor)/;
    const SMALL = /^(Hammock|Palm|Palms|Flowers|Lamps|Garden|Umbrella|House_Interior|Sofa|Armchair|Bed|Bench|Logs|Fire_Ring|Pond|Boat)/;
    const DOUBLE = /Leaf|Cloth|Stripe|Towel/;
    const mats = {}, glow = [], flames = [];
    const matFor = (m, top) => {
      m = m || { name: 'Default', color: [0.8, 0.8, 0.8] };
      const key = m.name + (top === 'Ground' ? '#v' : '');
      if (mats[key]) return mats[key];
      let mt;
      if (/^Flame/.test(m.name)) mt = new T.MeshBasicMaterial({ color: lin(m.color), transparent: true, opacity: 0.92, depthWrite: false });
      else {
        mt = new T.MeshToonMaterial({ color: lin(m.color), gradientMap: toneIsl, vertexColors: top === 'Ground' });
        if (DOUBLE.test(m.name) || top === 'Hammock' || top === 'Umbrella') mt.side = T.DoubleSide;
        if (m.name === 'WindowGlass' || m.name === 'Lantern') { mt.emissive = new T.Color(m.name === 'Lantern' ? '#ffcf6a' : '#ffc46b'); mt.emissiveIntensity = 0; glow.push(mt); }
        if (m.name === 'Water') { mt.transparent = true; mt.opacity = 0.85; }
      }
      mt.name = m.name;
      return (mats[key] = mt);
    };
    const root = new T.Group(); root.name = 'AnimeIsland';
    const parts = {};
    IS.roots.forEach(n => {
      const top = n.name;
      const obj = build(IS, n, (mesh, k, m) => {
        const me = new T.Mesh(geometry(mesh, k), matFor(m, top));
        const flat = /^(Ground|Grass_Tufts|Flowers|Pond_Water|House_Floor|Path_Stones|Towels)/.test(top);
        me.castShadow = !flat && !/^(Flame|House_Flame)/.test(top); me.receiveShadow = !/^(Flame|House_Flame)/.test(top);
        if (!NO_OUTLINE.test(top)) addOutline(me, SMALL.test(top) ? OUT.small : OUT.big);
        if (/^(Flame|House_Flame)/.test(top)) flames.push(me);
        return me;
      });
      parts[top] = obj; root.add(obj);
    });
    scene.add(root);
    const ground = parts.Ground;

    // sky dome, stars, sea, clouds, a sailboat. The shaders include three's standard pieces so Nook's game
    // effect (the world dissolving into code) can hook into them like any other material.
    const skyMat = new T.ShaderMaterial({
      side: T.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new T.Color() }, horizon: { value: new T.Color() }, sunDir: { value: new T.Vector3() }, sunCol: { value: new T.Color() }, sunVis: { value: 1 }, moonDir: { value: new T.Vector3() }, moonVis: { value: 0 } },
      vertexShader: `#include <common>
        varying vec3 vDir;
        void main(){ vDir = normalize(position); vec3 transformed = vec3(position);
          #include <project_vertex>
        }`,
      fragmentShader: `#include <common>
        uniform vec3 top; uniform vec3 horizon; uniform vec3 sunDir; uniform vec3 sunCol; uniform float sunVis; uniform vec3 moonDir; uniform float moonVis;
        varying vec3 vDir;
        void main(){
          vec3 d = normalize(vDir);
          vec3 c = mix(horizon, top, smoothstep(-0.02, 0.55, d.y));
          float s = max(dot(d, sunDir), 0.0);
          c += sunCol * (smoothstep(0.9975, 0.999, s) * 1.2 + pow(s, 12.0) * 0.35) * sunVis;
          float m = max(dot(d, moonDir), 0.0);
          c = mix(c, vec3(0.95, 0.95, 0.88), smoothstep(0.9988, 0.9993, m) * moonVis);
          c += vec3(0.5, 0.55, 0.8) * pow(m, 40.0) * 0.25 * moonVis;
          gl_FragColor = vec4(c, 1.0);
          #include <premultiplied_alpha_fragment>
        }`
    });
    const sky = new T.Mesh(new T.SphereGeometry(130, 40, 20), skyMat); sky.name = 'Sky'; sky.renderOrder = -2; sky.frustumCulled = false; scene.add(sky);
    const starGeo = new T.BufferGeometry(), sp = [];
    for (let i = 0; i < 900; i++) { const u = Math.random(), a = Math.random() * TAU, y = u * 0.95 + 0.05, rr = Math.sqrt(1 - y * y); sp.push(cos(a) * rr * 120, y * 120, sin(a) * rr * 120); }
    starGeo.setAttribute('position', new T.Float32BufferAttribute(sp, 3));
    const starMat = new T.PointsMaterial({ color: 0xffffff, size: 1.8, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false });
    const stars = new T.Points(starGeo, starMat); stars.name = 'Stars'; scene.add(stars);
    const seaMat = new T.ShaderMaterial({
      transparent: true, depthWrite: false, fog: false,
      uniforms: { col: { value: new T.Color() }, deep: { value: new T.Color() }, t: { value: 0 }, glint: { value: new T.Color() }, gk: { value: 0.35 } },
      vertexShader: `#include <common>
        varying vec3 vW;
        void main(){ vec3 transformed = vec3(position); vW = (modelMatrix * vec4(position, 1.0)).xyz;
          #include <project_vertex>
        }`,
      fragmentShader: `#include <common>
        uniform vec3 col; uniform vec3 deep; uniform float t; uniform vec3 glint; uniform float gk; varying vec3 vW;
        void main(){
          float r = length(vW.xz);
          vec3 c = mix(col, deep, smoothstep(14.0, 60.0, r));
          float w = sin(vW.x * 1.1 + t * 0.9) * sin(vW.z * 0.9 - t * 0.7) + sin((vW.x + vW.z) * 0.5 + t * 0.5) * 0.6;
          c = mix(c, glint, step(1.05, w) * gk * (1.0 - smoothstep(30.0, 90.0, r)));
          float a = mix(0.55, 0.96, smoothstep(12.0, 19.0, r));
          gl_FragColor = vec4(c, a);
          #include <premultiplied_alpha_fragment>
        }`
    });
    const sea = new T.Mesh(new T.CircleGeometry(125, 64).rotateX(-PI / 2), seaMat); sea.name = 'Sea'; sea.position.y = J_.sea || 0; sea.renderOrder = -1; scene.add(sea);
    const cloudMat = new T.MeshToonMaterial({ color: 0xffffff, gradientMap: toneIsl });
    const clouds = new T.Group(); clouds.name = 'Clouds';
    const puff = new T.SphereGeometry(1, 16, 10);
    for (let i = 0; i < 9; i++) {
      const cg = new T.Group();
      for (let q = 0; q < 4; q++) { const m = new T.Mesh(puff, cloudMat); m.scale.setScalar(1.6 + Math.random() * 1.3); m.position.set((q - 1.5) * 1.8, Math.random() * 0.7, Math.random() * 0.9); cg.add(m); }
      const a = i / 9 * TAU, R = 34 + Math.random() * 18; cg.position.set(cos(a) * R, 15 + Math.random() * 7, sin(a) * R); cg.userData.a = a; cg.userData.R = R; clouds.add(cg);
    }
    scene.add(clouds);
    // a little sailboat going round far out
    const sail = new T.Group(); sail.name = 'Sailboat';
    { const hull = new T.Mesh(new T.SphereGeometry(1, 16, 8, 0, TAU, PI / 2, PI / 2), new T.MeshToonMaterial({ color: '#fbf7ee', gradientMap: toneIsl })); hull.scale.set(1.6, 0.5, 0.6); hull.rotation.x = PI; hull.position.y = 0.25;
      const mast = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, 3, 6), new T.MeshToonMaterial({ color: '#6b432a', gradientMap: toneIsl })); mast.position.y = 1.7;
      const s = new T.Shape(); s.moveTo(0, 0); s.lineTo(1.5, 0); s.lineTo(0, 2.4); s.closePath();
      const sl = new T.Mesh(new T.ShapeGeometry(s), new T.MeshToonMaterial({ color: '#ef5a4f', gradientMap: toneIsl, side: T.DoubleSide })); sl.position.set(0.08, 0.5, 0); sl.rotation.y = -PI / 2;
      sail.add(hull, mast, sl); [hull, mast, sl].forEach(m => { addOutline(m, OUT.small); m.castShadow = true; }); }
    scene.add(sail);
    // chimney smoke
    const smokeMat = new T.MeshToonMaterial({ color: '#ffffff', gradientMap: toneIsl, transparent: true, opacity: 0.6, depthWrite: false });
    const smoke = [0, 1, 2, 3].map(i => { const m = new T.Mesh(puff, smokeMat.clone()); m.userData.ph = i / 4; m.name = 'Smoke'; scene.add(m); return m; });

    // lights: all straight in the scene, so Nook's games can dim them for the dark arena
    const hemi = new T.HemisphereLight(0xffffff, 0x88a070, 1.2); hemi.name = 'Hemi'; scene.add(hemi);
    const sun = new T.DirectionalLight(0xffffff, 1.8); sun.name = 'Sun';
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -21, right: 21, top: 21, bottom: -21, near: 1, far: 90 });
    sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03;
    scene.add(sun, sun.target);
    const at = a => new T.Vector3(a[0], a[1], a[2]);
    const fireLight = new T.PointLight(0xff8a3a, 0, 7, 1.6); fireLight.position.copy(at(J_.spots.fire.fire)); fireLight.name = 'FireLight'; scene.add(fireLight);
    const hearth = new T.PointLight(0xff9a4a, 0, 6, 1.6); hearth.position.copy(at(J_.house.fire)); hearth.name = 'HearthLight'; scene.add(hearth);
    const lamp = new T.PointLight(0xffd59a, 0, 7, 1.4); lamp.position.copy(at(J_.house.pendant)); lamp.name = 'LampLight'; scene.add(lamp);

    // time of day from the clock (or a set hour)
    const KEYS = [
      [0, { top: '#0b1026', hor: '#1b2450', sea: '#173263', deep: '#0b1a3a', sunI: 0.45, hemiI: 0.55, sunC: '#9fb4ff', stars: 1, fire: 1, cloud: '#4a5680' }],
      [5, null],
      [6.4, { top: '#4a6bb5', hor: '#f2a17a', sea: '#3f74b0', deep: '#24467e', sunI: 0.9, hemiI: 0.95, sunC: '#ffb37a', stars: 0.15, fire: 0.6, cloud: '#f6c3b0' }],
      [8.2, { top: '#3d8fe8', hor: '#bfe3ff', sea: '#33a3e0', deep: '#1d6fb8', sunI: 1.9, hemiI: 1.45, sunC: '#fff3e2', stars: 0, fire: 0.2, cloud: '#ffffff' }],
      [16.6, null],
      [18.3, { top: '#5a6fc2', hor: '#ff9a5c', sea: '#4174b4', deep: '#26487f', sunI: 1.1, hemiI: 1.05, sunC: '#ffa35c', stars: 0.05, fire: 0.6, cloud: '#ffc0a0' }],
      [19.8, { top: '#23295e', hor: '#8a5a8f', sea: '#22427a', deep: '#122650', sunI: 0.5, hemiI: 0.7, sunC: '#c08bbf', stars: 0.6, fire: 0.9, cloud: '#8a7aa5' }],
      [21.3, null], [24, null]
    ];
    KEYS[1][1] = KEYS[0][1]; KEYS[4][1] = KEYS[3][1]; KEYS[7][1] = KEYS[0][1]; KEYS[8][1] = KEYS[0][1];
    const lookAt = h => {
      let i = 0; while (i < KEYS.length - 2 && h >= KEYS[i + 1][0]) i++;
      const [h0, a] = KEYS[i], [h1, b] = KEYS[i + 1], f = Math.max(0, Math.min(1, (h - h0) / (h1 - h0)));
      const out = {}; for (const k in a) out[k] = typeof a[k] === 'number' ? a[k] + (b[k] - a[k]) * f : new T.Color(a[k]).lerp(new T.Color(b[k]), f);
      return out;
    };
    const clockHour = () => { const d = new Date(); return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600; };
    let hourSet = null, lastHour = -1, fireBoost = 0.5, night = 0;
    const sunDir = new T.Vector3(), moonDir = new T.Vector3(-0.35, 0.75, -0.55).normalize(), white = new T.Color('#ffffff');
    function applyTime(h) {
      const L = lookAt(h);
      skyMat.uniforms.top.value.copy(L.top); skyMat.uniforms.horizon.value.copy(L.hor);
      seaMat.uniforms.col.value.copy(L.sea); seaMat.uniforms.deep.value.copy(L.deep); seaMat.uniforms.glint.value.copy(L.hor).lerp(white, 0.5);
      const a = (h - 6) / 12 * PI, el = sin(a);
      sunDir.set(cos(a) * 0.9, Math.max(el, -0.3), -0.45).normalize();
      const day = Math.max(0, Math.min(1, (el + 0.08) / 0.2));
      skyMat.uniforms.sunDir.value.copy(sunDir); skyMat.uniforms.sunCol.value.copy(L.sunC); skyMat.uniforms.sunVis.value = day;
      skyMat.uniforms.moonDir.value.copy(moonDir); skyMat.uniforms.moonVis.value = L.stars;
      const lightDir = day > 0.5 ? sunDir : moonDir;
      sun.position.copy(lightDir).multiplyScalar(40); sun.target.position.set(0, 0, 0);
      sun.color.copy(L.sunC); sun.intensity = L.sunI;
      hemi.intensity = L.hemiI; hemi.color.copy(L.top).lerp(white, 0.55);
      starMat.opacity = L.stars; cloudMat.color.copy(L.cloud);
      fireBoost = L.fire; night = Math.max(0, Math.min(1, L.stars * 1.3)); seaMat.uniforms.gk.value = 0.35 * (1 - 0.8 * night);   // soft sparkles at night
      glow.forEach(m => { m.emissiveIntensity = (m.name === 'Lantern' ? 1.4 : 0.9) * Math.max(0, Math.min(1, (L.fire - 0.2) / 0.6)); });
      if (scene.background && scene.background.isColor) scene.background.copy(L.hor);
      if (scene.fog) scene.fog.color.copy(L.hor);
    }
    const tv = new T.Vector3(), q = new T.Quaternion();
    const hamAxis = new T.Vector3(J_.spots.hammock.seats[0].rock[0], 0, J_.spots.hammock.seats[0].rock[1]).normalize();
    const boatBase = parts.Boat ? parts.Boat.position.clone() : null, boatQ = parts.Boat ? parts.Boat.quaternion.clone() : null;
    const chim = at(J_.chimney), door = parts.House_Door, doorQ = door ? door.quaternion.clone() : null;
    let doorK = 0, doorWant = 0, frozen = false;
    const api = {
      root, parts, ground, sky, sea, sun, hemi, json: J_,
      // keep the sky still (Nook's games take over the background, fog and lights while a match runs)
      freeze(on) { frozen = !!on; },
      setHour(h) { hourSet = h == null ? null : +h; lastHour = -1; },
      hour: () => (hourSet != null ? hourSet : clockHour()),
      night: () => night,
      hammockRock: t => 0.07 * sin(t * 0.9),
      hammockAxis: hamAxis,
      openDoor(v) { doorWant = v ? 1 : 0; },
      update(t, dt) {
        const h = api.hour();
        if (!frozen && (Math.abs(h - lastHour) > 1 / 240)) { applyTime(h); lastHour = h; }
        seaMat.uniforms.t.value = t;
        clouds.children.forEach(c => { c.userData.a += dt * 0.006; c.position.x = cos(c.userData.a) * c.userData.R; c.position.z = sin(c.userData.a) * c.userData.R; });
        const fl = 1 + 0.12 * sin(t * 9.3) + 0.07 * sin(t * 14.1);
        flames.forEach((f, i) => { f.scale.set(1 + 0.05 * sin(t * 7 + i), fl + 0.04 * sin(t * 5 + i * 2), 1 + 0.05 * cos(t * 8 + i)); });
        if (!frozen) {
          fireLight.intensity = (1.0 + 3.0 * fireBoost) * (0.85 + 0.15 * sin(t * 11.7));
          hearth.intensity = (0.8 + 2.6 * fireBoost) * (0.85 + 0.15 * sin(t * 10.3 + 1));
          lamp.intensity = 0.4 + 2.4 * night;
        }
        if (parts.Hammock) parts.Hammock.quaternion.setFromAxisAngle(hamAxis, api.hammockRock(t));
        if (boatBase) { parts.Boat.position.y = boatBase.y + 0.04 * sin(t * 1.3); parts.Boat.quaternion.copy(boatQ).multiply(q.setFromAxisAngle(tv.set(1, 0, 0), 0.04 * sin(t * 1.1))); }
        const sa = t * 0.012; sail.position.set(cos(sa) * 48, 0, sin(sa) * 48); sail.rotation.y = -sa;
        smoke.forEach(s => { const p = (s.userData.ph + t * 0.1) % 1; s.position.set(chim.x + p * 0.5, chim.y + p * 2.2, chim.z); s.scale.setScalar(0.12 + p * 0.3); s.material.opacity = (1 - p) * 0.55; });
        if (door) { doorK += (doorWant - doorK) * Math.min(1, dt * 5); door.quaternion.copy(doorQ).multiply(q.setFromAxisAngle(tv.set(0, 1, 0), -1.75 * doorK)); }
      }
    };
    return api;
  }

  // ground height in page axes from the island's height grid
  const G = ISJ.grid, GH = (() => { const b = atob(G.data), a = new Int16Array(b.length / 2); for (let i = 0; i < a.length; i++) a[i] = (b.charCodeAt(2 * i) | (b.charCodeAt(2 * i + 1) << 8)) << 16 >> 16; return a; })();
  function hAt(x, z) {
    const n = G.n, u = (x + G.r) / (2 * G.r) * (n - 1), v = (z + G.r) / (2 * G.r) * (n - 1);
    if (u < 0 || v < 0 || u > n - 1 || v > n - 1) return -1;
    const i = Math.min(n - 2, Math.floor(u)), j = Math.min(n - 2, Math.floor(v)), fu = u - i, fv = v - j;
    const h00 = GH[j * n + i], h10 = GH[j * n + i + 1], h01 = GH[(j + 1) * n + i], h11 = GH[(j + 1) * n + i + 1];
    return ((h00 * (1 - fu) + h10 * fu) * (1 - fv) + (h01 * (1 - fu) + h11 * fu) * fv) / 1000;
  }
  return { OPTIONS, PRESETS, cleanLook, buildAvatar, pose, setExpression, dispose, buildIsland, hAt, island: ISJ, K, EXPRS: Object.keys(EXPRS) };
}
