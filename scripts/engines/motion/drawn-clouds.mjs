// Clouds drawn over the map, each a thing of its own with clear sky round it and its own shadow on the ground (the Weather panel's
// Drawn clouds). Each is baked once from hundreds of nested puffs into a height, lit from the sun and shading itself; on the map it is
// only two sprites drifting with the wind. Above the rain and the roofs. However many overlap, the sky as a whole holds one strength,
// so the map always shows through. The sun moving turns them, the light baked in them turning too, so nothing is baked again.
import { cloudSpeed } from './sky-light.mjs';

const rng = (seed) => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
// The way the light is baked in, as seen from the cloud (x, y on the map, up).
const BAKED_SUN = [-0.62, -0.5, 0.6];
const BAKED_ANGLE = Math.atan2(BAKED_SUN[1], BAKED_SUN[0]);
const SHAPES = [11, 23, 37, 41, 59, 73, 89, 97], SHEETS = [101, 113, 127, 131];
const SHADOW_SHRINK = 4;

// One cloud's picture (pure): `body` RGBA of an N-square picture, `shadow` its soft outline, N/4 square, one channel of alpha. A `sheet` is one huge rolling form for a closed sky.
export function cloudPixels(seed, { N = 512, sheet = false } = {}) {
  const sun = BAKED_SUN, random = rng(seed), h = new Float32Array(N * N);
  const mark = (cx, cy, z, r) => { const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(N - 1, Math.ceil(cx + r)), y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(N - 1, Math.ceil(cy + r)); for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const q = r * r - (x - cx) * (x - cx) - (y - cy) * (y - cy); if (q > 0) { const top = z + Math.sqrt(q); if (top > h[y * N + x]) h[y * N + x] = top; } } };
  const lattice = new Float32Array(64 * 64).map(() => random()), noise = (x, y) => { const i = Math.floor(x), j = Math.floor(y), f = x - i, g = y - j, u = f * f * (3 - 2 * f), v = g * g * (3 - 2 * g), l = (a, b) => lattice[((b & 63) * 64 + (a & 63))]; return (l(i, j) * (1 - u) + l(i + 1, j) * u) * (1 - v) + (l(i, j + 1) * (1 - u) + l(i + 1, j + 1) * u) * v; };
  const fbm = (x, y) => 0.5 * noise(x, y) + 0.27 * noise(x * 2.1 + 9, y * 2.1 + 4) + 0.15 * noise(x * 4.3 + 3, y * 4.3 + 8) + 0.08 * noise(x * 8.9 + 5, y * 8.9 + 1);
  // Where its billows gather (1) and where it runs smooth (0): real clouds are not lumpy all over.
  const busyAt = (x, y) => { const v = (noise((x * 5) / N + 31, (y * 5) / N + 17) - 0.3) / 0.22; const t = Math.min(1, Math.max(0, v)); return t * t * (3 - 2 * t); };
  const long = 0.5 + random() * 0.5, turn = random() * 6.28, c = Math.cos(turn), s = Math.sin(turn), heads = [];
  // Its body: a lumpy blob, thick in the middle. Then puffs on its heads, and smaller puffs on those, each sitting on the surface below it.
  const count = sheet ? 30 : 7 + Math.floor(random() * 7), spread = sheet ? 0.43 : 0.3;
  for (let i = 0; i < count; i++) { const a = random() * 6.28, d = Math.sqrt(random()), u = Math.cos(a) * d * spread, v = Math.sin(a) * d * spread * (sheet ? 0.9 : long), x = N / 2 + (u * c - v * s) * N, y = N / 2 + (u * s + v * c) * N, r = N * (sheet ? 0.05 + 0.055 * random() : 0.075 + 0.075 * random()) * (1.1 - 0.5 * d), z = N * 0.1 * (1 - d * 0.75); heads.push([x, y, z, r]); mark(x, y, z, r); }
  const on = (parents, each, size, fussy = false) => { const out = []; for (const [x, y, z, r] of parents) for (let i = 0; i < each; i++) { if (fussy && random() > 0.25 + 0.75 * busyAt(x, y)) continue; const a = random() * 6.28, b = Math.acos(random()), rx = Math.cos(a) * Math.sin(b) * r, ry = Math.sin(a) * Math.sin(b) * r, rz = Math.cos(b) * r, q = r * size * (0.6 + 0.7 * random()), kid = [x + rx, y + ry, z + rz - q * 0.4, q]; out.push(kid); mark(kid[0], kid[1], kid[2], q); } return out; };
  on(on(heads, sheet ? 9 : 11, 0.5), sheet ? 3 : 5, 0.4, true);
  // No puff is a ball: the height is pushed about by noise, so round heads become billows.
  { const src = h.slice(), s0 = 14 / N; for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const sx = Math.round(x + (fbm(x * s0, y * s0) - 0.5) * N * 0.075), sy = Math.round(y + (fbm(x * s0 + 20, y * s0 + 7) - 0.5) * N * 0.075); h[y * N + x] = sx >= 0 && sy >= 0 && sx < N && sy < N ? src[sy * N + sx] : 0; } }
  const box = (from, r) => { const t = new Float32Array(N * N), o = new Float32Array(N * N); for (let y = 0; y < N; y++) { let sum = 0; for (let x = -r; x < N; x++) { if (x + r < N) sum += from[y * N + x + r]; if (x - r - 1 >= 0) sum -= from[y * N + x - r - 1]; if (x >= 0) t[y * N + x] = sum / (2 * r + 1); } } for (let x = 0; x < N; x++) { let sum = 0; for (let y = -r; y < N; y++) { if (y + r < N) sum += t[(y + r) * N + x]; if (y - r - 1 >= 0) sum -= t[(y - r - 1) * N + x]; if (y >= 0) o[y * N + x] = sum / (2 * r + 1); } } return o; };
  // The light reads a smoothed surface: the outline stays the puffs', the shading is soft.
  { const smooth = box(box(h, 3), 3), calm = box(box(h, 6), 6); for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const i = y * N + x, b = busyAt(x, y); h[i] = h[i] > 0 ? Math.max(smooth[i] * b + calm[i] * (1 - b), 1e-3) : 0; } }
  const at = (x, y) => (x < 0 || y < 0 || x >= N || y >= N ? 0 : h[(y | 0) * N + (x | 0)]);
  const mask = new Float32Array(N * N); for (let i = 0; i < N * N; i++) mask[i] = h[i] > 0 ? 1 : 0;
  const form = box(box(box(h, 30), 30), 14), bigAt = (x, y) => (x < 0 || y < 0 || x >= N || y >= N ? 0 : form[(y | 0) * N + (x | 0)]);
  const soft = box(mask, 11), wide = box(mask, 26), around = box(h, 10), far = box(h, 40), L = Math.hypot(...sun), body = new Uint8ClampedArray(N * N * 4);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x, k = i * 4, here = h[i];
    let r = 225, g = 232, b = 240, a = wide[i] * wide[i] * 0.3 * Math.min(1, fbm(x * 0.022, y * 0.022) * 1.7);
    if (here > 0) {
      const nx = -(at(x + 3, y) - at(x - 3, y)) / 6, ny = -(at(x, y + 3) - at(x, y - 3)) / 6, nn = Math.hypot(nx, ny, 0.85), fine = Math.max(0, (nx * sun[0] + ny * sun[1] + 0.85 * sun[2]) / (nn * L));
      // The whole cloud as one rounded form: the side toward the sun bright, the far side falling away into shade, whatever its puffs do.
      const ox = x + (fbm(x * 0.018 + 5, y * 0.018) - 0.5) * 70, oy = y + (fbm(x * 0.018, y * 0.018 + 5) - 0.5) * 70, bx = (-(bigAt(ox + 22, oy) - bigAt(ox - 22, oy)) / 44) * 3.0, by = (-(bigAt(ox, oy + 22) - bigAt(ox, oy - 22)) / 44) * 3.0, big = Math.max(0, (bx * sun[0] + by * sun[1] + sun[2]) / (Math.hypot(bx, by, 1) * L)), thick = Math.min(1, form[i] / (N * 0.13));
      // How far the sun clears it: what stands in its way shades it.
      let lit = 1; for (let m = 1; m <= 9; m++) { const d = m * m * 1.1, top = at(x + sun[0] * d, y + sun[1] * d), rise = here + d * sun[2] * 0.55; if (top > rise) lit = Math.min(lit, Math.max(0, 1 - (top - rise) / (N * 0.05))); }
      const hollow = Math.min(1, Math.max(0, 1 + (here - around[i]) / (N * 0.02))), massive = Math.min(1, far[i] / (N * 0.2)), crown = Math.min(1, form[i] / (N * 0.17)), light = Math.min(1, (0.04 + 0.66 * big + 0.56 * fine * (0.3 + 0.7 * lit)) * (0.68 + 0.32 * hollow) * (0.82 + 0.18 * crown));
      const t = Math.min(1, Math.max(0, (light - 0.1) / 0.74)), e = t * t * (3 - 2 * t);
      // Blue-grey in shade, warm white in the sun, the deepest of it greyer.
      r = (0.36 + 0.64 * e) * 255 * (1 - 0.12 * massive * (1 - e)); g = (0.41 + 0.58 * e) * 255 * (1 - 0.1 * massive * (1 - e)); b = (0.56 + 0.41 * e) * 255;
      // How solid it is goes by how thick: wisps at a frayed rim, denser at its heart.
      a = Math.max(a, Math.min(1, Math.max(0, (soft[i] - 0.38 + (fbm(x * 0.05, y * 0.05) - 0.5) * 1.05) / 0.46)) * (0.3 + 0.7 * thick));
    }
    body[k] = r; body[k + 1] = g; body[k + 2] = b; body[k + 3] = a * 255;
  }
  const blurred = box(mask, 9), n = Math.floor(N / SHADOW_SHRINK), shadow = new Uint8ClampedArray(n * n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) shadow[y * n + x] = blurred[y * SHADOW_SHRINK * N + x * SHADOW_SHRINK] * 255;
  return { N, body, n, shadow };
}

// How the sky is made up for a cover, 0–1 (pure): `clouds` and `sheets` per this many square squares of sky, `big` their size, how `flat` the light (a closed sky lights from everywhere).
export const SKY_SQUARES = 3600;
const COVERS = [[0.05, 0, 0, 0.8, 0], [0.15, 9, 0, 0.8, 0], [0.35, 18, 0, 0.8, 0], [0.6, 44, 0, 0.95, 0.22], [0.8, 56, 3, 1.05, 0.38], [0.95, 26, 16, 0.9, 0.42]];
export function skyMakeup(cover) {
  const c = Math.min(1, Math.max(0, Number(cover) || 0));
  if (c < 0.05) return { clouds: 0, sheets: 0, big: 0.8, flat: 0 };
  const at = COVERS.findIndex((row) => row[0] >= c);
  if (at < 0) { const [, clouds, sheets, big, flat] = COVERS.at(-1); return { clouds, sheets, big, flat }; }
  if (at === 0) { const [, clouds, sheets, big, flat] = COVERS[0]; return { clouds, sheets, big, flat }; }
  const a = COVERS[at - 1], b = COVERS[at], t = (c - a[0]) / (b[0] - a[0]), mix = (i) => a[i] + (b[i] - a[i]) * t;
  return { clouds: mix(1), sheets: mix(2), big: mix(3), flat: mix(4) };
}
// How many to draw over a sky of so many square squares, and how much bigger each so a huge map keeps its cover within `most` (pure).
export function skyCount(makeup, squares, most = 140) {
  const scale = squares / SKY_SQUARES, sheets = Math.round(makeup.sheets * scale), clouds = Math.round(makeup.clouds * scale), want = sheets + clouds;
  if (want <= most) return { sheets, clouds, grow: 1 };
  const k = most / want;
  return { sheets: Math.floor(sheets * k), clouds: Math.floor(clouds * k), grow: Math.sqrt(1 / k) };
}
// Spread evenly and never reshuffled (pure): adding more leaves the ones already there alone. 0–1 each way.
export const skyHome = (i) => [(i * 0.6180339887 + 0.13) % 1, (i * 0.7548776662 + 0.37) % 1];
// The sun on the clouds, over one pass for the whole sky: reads how lit each point was baked (the red channel) and colours it by the sun now, from shade through its mid-tones to the sunlit colour and its brightest tops toward white. Thin bright parts glow, the sun coming through. However many overlap, `uSolid` is how much covers the map.
export const CLOUD_LIGHT = `precision mediump float; varying vec2 vTextureCoord; uniform sampler2D uSampler; uniform vec3 uLit, uShade, uRim; uniform float uSolid, uContrast, uGlow;
void main(){ vec4 c = texture2D(uSampler, vTextureCoord); if (c.a < 0.003) { gl_FragColor = vec4(0.0); return; }
  vec3 base = c.rgb / c.a; float l = clamp((base.r - 0.36) / 0.64, 0.0, 1.0), k = clamp((l - 0.5) * uContrast + 0.5, 0.0, 1.0);
  vec3 mid = mix(uShade, uLit, 0.62) * 1.02, hot = mix(uLit, vec3(1.0), 0.62);
  vec3 col = k < 0.45 ? mix(uShade, mid, k / 0.45) : k < 0.8 ? mix(mid, uLit, (k - 0.45) / 0.35) : mix(uLit, hot, (k - 0.8) / 0.2);
  float thin = 1.0 - smoothstep(0.25, 0.8, c.a), rim = thin * smoothstep(0.35, 0.8, l);
  col += uRim * rim * uGlow;
  float a = c.a * uSolid;
  gl_FragColor = vec4(min(col, vec3(1.0)) * a, a); }`;
// What the sun does to them at each height, in degrees: lit colour, shade, rim, contrast, glow.
const SUN_HEIGHTS = [[2, [1, 0.68, 0.48], [0.34, 0.29, 0.46], [1, 0.58, 0.32], 1.15, 0.5], [10, [1, 0.82, 0.6], [0.46, 0.45, 0.63], [1, 0.74, 0.44], 1.1, 0.45], [25, [1, 0.9, 0.74], [0.5, 0.54, 0.7], [1, 0.82, 0.58], 1.05, 0.4], [50, [1, 0.995, 0.97], [0.56, 0.61, 0.73], [1, 1, 1], 1, 0.2]];
const NIGHT = { lit: [0.56, 0.62, 0.76], shade: [0.2, 0.23, 0.34], rim: [0.6, 0.68, 0.85], contrast: 1, glow: 0.1 };
const mixes = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
// The light on the clouds now (pure). `height` the sun's in degrees, `sun` 0 night to 1 full day, `flat` how closed the sky (the light from everywhere: its shade lifts and greys), `rain` 0–1, `dark` the scene's darkness 0–1 (the clouds sit over the map and would stay bright while it dims), `color` the scene's sunlight, a little of it.
export function skyLight({ height = 50, sun = 1, flat = 0, rain = 0, dark = 0, color = null } = {}) {
  const h = Math.max(SUN_HEIGHTS[0][0], Math.min(SUN_HEIGHTS.at(-1)[0], Number(height) || 0)), at = Math.max(1, SUN_HEIGHTS.findIndex((row) => row[0] >= h)), a = SUN_HEIGHTS[at - 1], b = SUN_HEIGHTS[at], t = (h - a[0]) / (b[0] - a[0]), day = Math.min(1, Math.max(0, Number(sun) || 0) * 2.5);
  let lit = mixes(NIGHT.lit, mixes(a[1], b[1], t), day), shade = mixes(NIGHT.shade, mixes(a[2], b[2], t), day);
  const rim = mixes(NIGHT.rim, mixes(a[3], b[3], t), day), f = Math.min(1, Math.max(0, Number(flat) || 0));
  if (color) lit = lit.map((v, i) => v * (0.7 + 0.3 * Math.min(1, Number(color[i]) || 0)));
  // A closed sky: what is in shade comes up, and all of it greys.
  const grey = (c) => { const g = (c[0] + c[1] + c[2]) / 3; return c.map((v) => v + (g - v) * f * 0.75); };
  shade = grey(mixes(shade, lit, f * 0.45)); lit = grey(lit);
  const dim = (1 - 0.32 * Math.min(1, Math.max(0, Number(rain) || 0))) * (1 - 0.72 * Math.min(1, Math.max(0, Number(dark) || 0)));
  return { lit: lit.map((v) => v * dim), shade: shade.map((v) => v * dim), rim: rim.map((v) => v * dim), contrast: (NIGHT.contrast + (mixes([a[4]], [b[4]], t)[0] - NIGHT.contrast) * day) * (1 - 0.55 * f), glow: (NIGHT.glow + (mixes([a[5]], [b[5]], t)[0] - NIGHT.glow) * day) * (1 - 0.6 * f) };
}
// The shortest way round from one angle to another (pure).
const turnBy = (from, to) => { const d = ((to - from + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return d; };
export const DEFAULT_TRANSPARENCY = 0.4;

/** The layer. `root()` above the rain and roofs, `floor()` on the ground under the creatures, `grid()` a square in pixels, `bounds()` the scene's rectangle, `screen()` the screen's. look({ on, cover, transparency, wind, angle, sunAngle, sunHeight in degrees, cast: {x, y}, sun 0–1, color [r, g, b], rain 0–1, dark 0–1 }); tick(seconds); clear(). */
export function createDrawnClouds({ PIXI, root, floor, grid = () => 100, bounds, screen = () => null, seed = 1 }) {
  const textures = { clouds: [], sheets: [] };
  let state = { on: false }, entries = [], run = 0, bodies = null, shadows = null, turning = null, baking = false, filter = null, shade = null;
  const texture = ({ N, body, n, shadow }) => {
    const paint = (size, fill) => { const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'), im = g.createImageData(size, size); fill(im.data); g.putImageData(im, 0, 0); return PIXI.Texture.from(c); };
    return { body: paint(N, (d) => d.set(body)), shadow: paint(n, (d) => { for (let i = 0; i < n * n; i++) { d[i * 4] = 8; d[i * 4 + 1] = 12; d[i * 4 + 2] = 28; d[i * 4 + 3] = shadow[i]; } }) };
  };
  // Baked one at a time, the frame free between them, only when first wanted.
  const bakeNext = () => {
    const sheet = textures.clouds.length >= SHAPES.length, list = sheet ? SHEETS : SHAPES, have = sheet ? textures.sheets : textures.clouds;
    if (have.length >= list.length && sheet) { baking = false; return; }
    if (!state.on) { baking = false; return; }
    try { have.push(texture(cloudPixels(list[have.length], { sheet }))); } catch (error) { console.warn('Animater | baking a cloud', error); baking = false; return; }
    setTimeout(bakeNext, 30);
  };
  const layers = () => {
    if (!bodies || bodies.destroyed || bodies.parent !== root()) {
      bodies = new PIXI.Container(); bodies.eventMode = 'none'; root().addChild(bodies);
      filter = new PIXI.Filter(undefined, CLOUD_LIGHT, { uLit: [1, 1, 1], uShade: [0.56, 0.61, 0.73], uRim: [1, 1, 1], uSolid: 0.6, uContrast: 1, uGlow: 0.2 }); bodies.filters = [filter];
      entries = [];
    }
    if (!shadows || shadows.destroyed || shadows.parent !== floor()) {
      shadows = new PIXI.Container(); shadows.eventMode = 'none'; floor().addChild(shadows);
      shade = new (PIXI.AlphaFilter ?? PIXI.filters?.AlphaFilter)(0.4); shadows.filters = [shade];
      for (const e of entries) { try { e.body.destroy(); } catch { /* gone */ } } try { bodies.removeChildren(); } catch { /* gone */ } entries = [];
    }
  };
  const entryOf = (i, sheet, list) => {
    const random = rng(seed * 7919 + i * 131 + (sheet ? 500 : 0)), pick = list[Math.floor(random() * (sheet ? SHEETS : SHAPES).length)];
    if (!pick) return null;
    const body = new PIXI.Sprite(pick.body), shadow = new PIXI.Sprite(pick.shadow), size = sheet ? 26 + random() * 13 : 4 + Math.pow(random(), 1.5) * 15; // in squares
    for (const s of [body, shadow]) { s.anchor.set(0.5); s.eventMode = 'none'; s.alpha = 0; }
    bodies.addChild(body); shadows.addChild(shadow);
    return { i, sheet, body, shadow, size, home: skyHome(i * 2 + (sheet ? 1 : 0)), a: 0 };
  };
  return {
    look(next = {}) {
      state = { ...state, ...next };
      if (!state.on) return;
      if (!baking && (textures.sheets.length < SHEETS.length)) { baking = true; setTimeout(bakeNext, 0); }
    },
    tick(seconds) {
      if (!state.on && !entries.length) return;
      const box = bounds(), g = grid(); if (!box || !g) return;
      layers();
      const pad = g * 18, field = { x: box.x - pad, y: box.y - pad, w: box.width + pad * 2, h: box.height + pad * 2 }, makeup = skyMakeup(state.on ? state.cover : 0);
      const { clouds, sheets, grow } = skyCount(makeup, (field.w * field.h) / (g * g));
      // Those wanted fade in, those no longer wanted fade out.
      for (let i = 0; i < clouds; i++) if (!entries.some((e) => !e.sheet && e.i === i)) { const e = entryOf(i, false, textures.clouds); if (e) entries.push(e); }
      for (let i = 0; i < sheets; i++) if (!entries.some((e) => e.sheet && e.i === i)) { const e = entryOf(i, true, textures.sheets); if (e) entries.push(e); }
      const speed = cloudSpeed(state.wind) * 13 * (1 + 0.9 * (Number(state.wind) || 0)) * g, angle = Number(state.angle) || 0, dx = Math.cos(angle), dy = Math.sin(angle);
      run += seconds * speed;
      const want = (Number(state.sunAngle) || 0) - BAKED_ANGLE; turning ??= want; turning += turnBy(turning, want) * Math.min(1, seconds / 2);
      const cast = state.cast ?? { x: 0, y: 0 }, view = screen?.(), shines = Math.min(1, (Number(state.sun) || 0) * 2.5);
      entries = entries.filter((e) => {
        const wanted = state.on && (e.sheet ? e.i < sheets : e.i < clouds);
        e.a = Math.max(0, Math.min(1, e.a + (wanted ? seconds : -seconds) / 2.5));
        if (!wanted && e.a <= 0) { try { e.body.destroy(); e.shadow.destroy(); } catch { /* gone */ } return false; }
        const x = field.x + ((e.home[0] * field.w + dx * run) % field.w + field.w) % field.w, y = field.y + ((e.home[1] * field.h + dy * run) % field.h + field.h) % field.h, size = e.size * g * (e.sheet ? 1 : makeup.big) * grow;
        // Past the scene on all sides: nothing to draw.
        const seen = x + size > box.x && x - size < box.x + box.width && y + size > box.y && y - size < box.y + box.height;
        e.body.renderable = seen; e.shadow.renderable = seen && shines > 0.02;
        e.body.position.set(x, y); e.shadow.position.set(x + (cast.x ?? 0), y + (cast.y ?? 0));
        e.body.width = e.body.height = e.shadow.width = e.shadow.height = size;
        e.body.rotation = e.shadow.rotation = turning; e.shadow.alpha = e.a;
        // A small cloud is a thin one.
        e.body.alpha = e.a * (e.sheet ? 1 : 0.68 + 0.32 * Math.min(1, e.size / 11));
        return true;
      });
      const solid = 1 - Math.min(0.95, Math.max(0, Number(state.transparency ?? DEFAULT_TRANSPARENCY)));
      if (filter) { const light = skyLight({ height: state.sunHeight, sun: state.sun, flat: makeup.flat, rain: state.rain, dark: state.dark, color: state.color }), u = filter.uniforms; u.uLit = light.lit; u.uShade = light.shade; u.uRim = light.rim; u.uContrast = light.contrast; u.uGlow = light.glow; u.uSolid = solid; }
      if (shade) shade.alpha = 0.4 * (1 - makeup.flat * 0.5) * shines * (0.35 + 0.65 * solid);
      if (view) { bodies.filterArea = view; shadows.filterArea = view; }
    },
    clear() {
      state = { on: false }; entries = []; run = 0; turning = null;
      for (const c of [bodies, shadows]) { try { c?.destroy({ children: true }); } catch { /* gone with the canvas */ } }
      bodies = null; shadows = null; filter = null; shade = null;
    },
    get busy() { return state.on || entries.length > 0; },
    get count() { return entries.length; },
    get baked() { return textures.clouds.length + textures.sheets.length; },
  };
}
