// Liquid Glass for Nook (Apple style): any element with class "lg" bends what's behind it.
//
// In Chromium each glass element gets its own SVG displacement filter, sized to it, used as a backdrop-filter:
// near the rounded rim the backdrop is pulled in like a lens, with a slight colour split (red, green and blue bend
// by different amounts). Other browsers get frosted glass (blur + saturation) with the same highlights from CSS.
// The highlights, glare and press squish are plain CSS (.lg rules in index.html); this file only does the optics
// and moves the glare to follow the pointer (--mx / --my).
const NS = 'http://www.w3.org/2000/svg';
const MATRIX = {
  R: '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0',
  G: '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0',
  B: '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0'
};
// Chromium is the browser that supports SVG filters in backdrop-filter
const refracts = typeof window !== 'undefined' && !!window.chrome && CSS.supports('backdrop-filter', 'blur(1px)');

export function startLiquidGlass(root) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
  const defs = document.createElementNS(NS, 'defs');
  svg.appendChild(defs); document.body.appendChild(svg);

  const state = new Map(); // element -> { id, filter, w, h, r }
  const maps = new Map();  // "w x h r" -> displacement map data URL
  let count = 0;

  // Displacement map: red/green = how far to look sideways, 128 = straight through.
  // Inside a band along the rounded rim the look-up turns inward, strongest at the very edge.
  function mapUrl(w, h, r) {
    const key = w + 'x' + h + 'r' + r;
    if (maps.has(key)) return maps.get(key);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'), img = g.createImageData(w, h), d = img.data;
    const band = Math.max(6, Math.min(h * .42, 26)), hx = w / 2, hy = h / 2;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const px = x + .5 - hx, py = y + .5 - hy;
      const qx = Math.abs(px) - (hx - r), qy = Math.abs(py) - (hy - r);
      const ox = Math.max(qx, 0), oy = Math.max(qy, 0), ol = Math.hypot(ox, oy);
      const inside = -(ol + Math.min(Math.max(qx, qy), 0) - r); // distance in from the rim
      let nx = 0, ny = 0;
      if (ol > 0) { nx = ox / ol * Math.sign(px); ny = oy / ol * Math.sign(py); } else if (qx > qy) nx = Math.sign(px); else ny = Math.sign(py);
      const t = inside < band ? 1 - Math.max(0, inside) / band : 0, k = t * t * (3 - 2 * t);
      const i = (y * w + x) * 4;
      d[i] = 128 - nx * k * 127; d[i + 1] = 128 - ny * k * 127; d[i + 2] = 128; d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const url = c.toDataURL(); maps.set(key, url);
    return url;
  }

  function update(el) {
    if (!refracts) return;
    const w = Math.round(el.offsetWidth), h = Math.round(el.offsetHeight);
    if (w < 8 || h < 8) return;
    const r = Math.min(h / 2, w / 2, parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0);
    let s = state.get(el);
    if (s && s.w === w && s.h === h && s.r === r) return;
    if (!s) {
      s = { id: 'nook-glass-' + (++count), filter: document.createElementNS(NS, 'filter') };
      s.filter.id = s.id;
      ['x', 'y'].forEach(a => s.filter.setAttribute(a, '0'));
      ['width', 'height'].forEach(a => s.filter.setAttribute(a, '100%'));
      s.filter.setAttribute('color-interpolation-filters', 'sRGB');
      defs.appendChild(s.filter); state.set(el, s);
    }
    Object.assign(s, { w, h, r });
    const strength = parseFloat(el.dataset.glass || '26');
    s.filter.innerHTML = `<feImage href="${mapUrl(w, h, Math.round(r))}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none" result="map"/>`
      + ['R', 'G', 'B'].map((ch, i) => `<feDisplacementMap in="SourceGraphic" in2="map" scale="${(strength * [1, .9, .8][i]).toFixed(1)}" xChannelSelector="R" yChannelSelector="G" result="d${ch}"/><feColorMatrix in="d${ch}" type="matrix" values="${MATRIX[ch]}" result="c${ch}"/>`).join('')
      + '<feBlend in="cR" in2="cG" mode="screen" result="rg"/><feBlend in="rg" in2="cB" mode="screen"/>';
    el.style.setProperty('--lg-filter', `url(#${s.id})`);
    el.classList.add('lg-live');
  }

  const ro = new ResizeObserver(entries => entries.forEach(e => update(e.target)));
  const watch = el => { if (!state.has(el) && !el.dataset.glassWatched) { el.dataset.glassWatched = '1'; ro.observe(el); update(el); } };
  const scan = () => {
    root.querySelectorAll('.lg').forEach(watch);
    // forget elements that left the page
    state.forEach((s, el) => { if (!el.isConnected) { ro.unobserve(el); s.filter.remove(); state.delete(el); } });
  };
  const mo = new MutationObserver(scan);
  mo.observe(root, { childList: true, subtree: true });
  scan();

  // glare follows the pointer across each piece of glass
  let raf = 0, pt = null;
  const onMove = e => {
    pt = e; if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      root.querySelectorAll('.lg').forEach(el => {
        const b = el.getBoundingClientRect();
        el.style.setProperty('--mx', (pt.clientX - b.left).toFixed(0) + 'px');
        el.style.setProperty('--my', (pt.clientY - b.top).toFixed(0) + 'px');
      });
    });
  };
  window.addEventListener('pointermove', onMove);

  return {
    refracts,
    dispose() { mo.disconnect(); ro.disconnect(); window.removeEventListener('pointermove', onMove); cancelAnimationFrame(raf); svg.remove(); }
  };
}
