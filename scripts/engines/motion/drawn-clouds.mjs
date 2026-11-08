// Clouds drawn over the map, each a thing of its own with clear sky round it and its own shadow on the ground (the Weather panel's
// Drawn clouds). Each is baked once from hundreds of nested puffs into a height, lit from the sun and shading itself; on the map it is
// only two sprites drifting with the wind. Above the rain and the roofs. However many overlap, the sky as a whole holds one strength,
// so the map always shows through. Each is baked with which way its surface faces, so the sun moves across it, one shader lighting the lot, and it never turns and is never baked again.
import { cloudSpeed } from './sky-light.mjs';
import { openingFade } from './wall-shadows.mjs';

const rng = (seed) => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
// How far the facing baked in a cloud reaches, either way (its red and green are x and y on the map, its blue up).
const FACING = 1.2;
const toFacing = (v) => (v / FACING) * 127.5 + 127.5;
const SHAPES = [11, 23, 37, 41, 59, 73, 89, 97], SHEETS = [101, 113, 127, 131];
const SHADOW_SHRINK = 4;

// One cloud's picture (pure): `body` RGBA of an N-square picture, `shadow` its soft outline, N/4 square, one channel of alpha. A `sheet` is one huge rolling form for a closed sky.
export function cloudPixels(seed, { N = 512, sheet = false } = {}) {
  const random = rng(seed), h = new Float32Array(N * N);
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
  const soft = box(mask, 11), wide = box(mask, 26), around = box(h, 10), far = box(h, 40), body = new Uint8ClampedArray(N * N * 4);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x, k = i * 4, here = h[i];
    // Its faint haze faces straight up.
    let r = 127.5, g = 127.5, b = (0.8 / FACING) * 255, a = wide[i] * wide[i] * 0.3 * Math.min(1, fbm(x * 0.022, y * 0.022) * 1.7);
    if (here > 0) {
      const nx = -(at(x + 3, y) - at(x - 3, y)) / 6, ny = -(at(x, y + 3) - at(x, y - 3)) / 6, nn = Math.hypot(nx, ny, 0.85);
      // The whole cloud as one rounded form, whatever its puffs do, so the side toward the sun is bright and the far side falls away into shade.
      const ox = x + (fbm(x * 0.018 + 5, y * 0.018) - 0.5) * 70, oy = y + (fbm(x * 0.018, y * 0.018 + 5) - 0.5) * 70, bx = (-(bigAt(ox + 22, oy) - bigAt(ox - 22, oy)) / 44) * 3.0, by = (-(bigAt(ox, oy + 22) - bigAt(ox, oy - 22)) / 44) * 3.0, nb = Math.hypot(bx, by, 1), thick = Math.min(1, form[i] / (N * 0.13));
      // Which way it faces, for any sun: its big form and its billows, less in its hollows and its deepest parts.
      const hollow = Math.min(1, Math.max(0, 1 + (here - around[i]) / (N * 0.02))), massive = Math.min(1, far[i] / (N * 0.2)), crown = Math.min(1, form[i] / (N * 0.17)), reach = (0.68 + 0.32 * hollow) * (0.82 + 0.18 * crown) * (1 - 0.1 * massive);
      r = toFacing(reach * ((0.66 * bx) / nb + (0.45 * nx) / nn)); g = toFacing(reach * ((0.66 * by) / nb + (0.45 * ny) / nn)); b = (reach * (0.66 / nb + (0.45 * 0.85) / nn) / FACING) * 255;
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
// Where a layer of clouds may show (pure), for its mask: all of `box` but its `holes`, then `open` back again; `only`, nothing but `open`. { rect, holes, open }.
export const cloudArea = (box, { holes = [], open = [], only = false, soft = [], openSoft = [] } = {}) => ({ rect: only ? null : box, holes: only ? [] : holes, open, soft: only ? [] : soft, openSoft });
// The rooms and openings a look gives (pure): the bodies stay out of a room with no roof drawn over it, under whatever opening it has; their shadows stay out of every room but fall through its openings. On an underground map, only those.
// `bodySoft` and `roomSoft` how far each room's edge fades, in squares, as their lists.
export const cloudAreas = (box, { body = [], rooms = [], open = [], below = false, bodySoft = [], roomSoft = [], openSoft = [] } = {}) => ({ body: cloudArea(box, { holes: body, soft: bodySoft }), shadow: cloudArea(box, { holes: rooms, open, only: below, soft: roomSoft, openSoft }) });
// How much sky a map has to fill, in square squares (pure): the map and a little round it, so a small map is not given a sky mostly off its edges.
export const SKY_MARGIN = 8;
export const skySquares = (box, grid) => ((box.width / grid + SKY_MARGIN * 2) * (box.height / grid + SKY_MARGIN * 2));
// Where a cloud is along one way (pure): it drifts on and comes round again, `pad` beyond each edge, out of sight before it turns back up.
export const skyAlong = (start, length, pad, home, run) => { const span = length + pad * 2; return start - pad + (((home * span + run) % span) + span) % span; };
// How much of the clouds themselves shows (pure): the sky keeps its clouds and their shadows when no clouds are to be drawn, so that drawing them lays them over the very shadows already there; only this eases.
export const bodiesShown = (was, drawn, seconds) => Math.max(0, Math.min(1, was + ((drawn ? 1 : -1) * (Number(seconds) || 0)) / 2.5));
// Spread evenly and never reshuffled (pure): adding more leaves the ones already there alone. 0–1 each way.
export const skyHome = (i) => [(i * 0.6180339887 + 0.13) % 1, (i * 0.7548776662 + 0.37) % 1];
// The way to the sun as a cloud sees it (pure): x and y on the map, and up. `angle` where it stands, `height` degrees up.
export const towardSun = (angle = 0, height = 45) => { const up = (Math.max(2, Math.min(90, Number(height) || 0)) * Math.PI) / 180; return [Math.cos(angle) * Math.cos(up), Math.sin(angle) * Math.cos(up), Math.sin(up)]; };
// The sun on the clouds, over one pass for the whole sky: reads which way each point faces and lights it from where the sun is now, coloured from shade through its mid-tones to the sunlit colour and its brightest tops toward white. Thin bright parts glow, the sun coming through. However many overlap, `uSolid` is how much covers the map.
export const CLOUD_LIGHT = `precision mediump float; varying vec2 vTextureCoord; uniform sampler2D uSampler; uniform vec3 uLit, uShade, uRim, uSun; uniform float uSolid, uContrast, uGlow;
void main(){ vec4 c = texture2D(uSampler, vTextureCoord); if (c.a < 0.003) { gl_FragColor = vec4(0.0); return; }
  vec3 base = c.rgb / c.a, facing = vec3((base.rg - 0.5) * 2.4, base.b * 1.2);
  float t = clamp((0.03 + dot(facing, uSun) - 0.1) / 0.74, 0.0, 1.0), l = t * t * (3.0 - 2.0 * t), k = clamp((l - 0.5) * uContrast + 0.5, 0.0, 1.0);
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
// How high a scene's clouds stand (pure), 1 as ever to 5: a cloud that many times bigger on the map (a town at 5 ft squares
// wants them well up, not puffs over its roofs), and its shadow out by the root of it, so it still falls by the cloud.
export const CLOUD_HEIGHT_MOST = 5;
export const cloudHeight = (height) => { const size = Math.min(CLOUD_HEIGHT_MOST, Math.max(1, Number(height) || 1)); return { size, cast: Math.sqrt(size) }; };
// How dark a cloud's shadow is at most under a bright sun, before the sky's own flatness and the cloud's thinness lighten it: a real one dims sunlit ground by a third or more.
export const CLOUD_SHADE = 0.8;

/** The layer. `root()` above the rain and roofs, `floor()` on the ground under the creatures, `grid()` a square in pixels, `bounds()` the scene's rectangle, `screen()` the screen's. look({ on, drawn (false: only their shadows), cover, transparency, wind, angle, sunAngle, sunHeight in degrees, cast: {x, y}, sun 0–1, color [r, g, b], rain 0–1, dark 0–1, areas: { body, rooms, open, below } as cloudAreas has them }); tick(seconds); clear(). */
export function createDrawnClouds({ PIXI, root, floor, grid = () => 100, bounds, screen = () => null, seed = 1, render = null }) {
  const textures = { clouds: [], sheets: [] };
  let state = { on: false }, entries = [], run = 0, bodies = null, shadows = null, bodyEdge = null, shadowEdge = null, drawnAreas = null, clips = [], turning = null, baking = false, filter = null, shade = null, bodyShare = 1;
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
  // Kept to the map: nothing over the padding round it.
  // (With a way to draw into a picture, the edge is a picture, so a room's line can fade; without, a plain shape.)
  const clipped = (parent, child) => { const box = bounds(), clip = new PIXI.Container(), edge = render ? new PIXI.Sprite(PIXI.Texture.EMPTY) : new PIXI.Graphics(); clip.eventMode = 'none'; edge.eventMode = 'none'; if (!render) edge.beginFill(0xffffff, 1).drawRect(box.x, box.y, box.width, box.height).endFill(); clip.addChild(child); clip.mask = edge; parent.addChild(clip, edge); clips.push(clip, edge); drawnAreas = null; return edge; };
  const softEdge = (edge, { rect, holes, open, soft = [], openSoft = [] }, box) => {
    // A quarter of the map's size at most (its fading is what matters, not its detail), and never past a big picture.
    const k = Math.min(0.25, 2048 / Math.max(1, box.width, box.height)), stage = new PIXI.Container(), g = grid();
    stage.scale.set(k); stage.position.set(-box.x * k, -box.y * k);
    const shape = (points) => { const s = new PIXI.Graphics(); s.beginFill(0xffffff, 1); s.drawPolygon(points); s.endFill(); return s; };
    if (rect) {
      const all = new PIXI.Graphics(); all.beginFill(0xffffff, 1).drawRect(rect.x, rect.y, rect.width, rect.height).endFill(); stage.addChild(all);
      holes.forEach((points, i) => {
        const room = shape(points), r = (Number(soft[i]) || 0) * g * k * 0.5;
        if (r > 0.5) { const blur = new PIXI.BlurFilter(r, 4); blur.blendMode = PIXI.BLEND_MODES.ERASE; room.filters = [blur]; } else room.blendMode = PIXI.BLEND_MODES.ERASE;
        stage.addChild(room);
      });
    }
    // An opening fades in at its edge as a room does.
    // (Never so soft that its middle loses the shadow: a quarter of its narrower side at most.)
    open.forEach((points, i) => { const hole = shape(points), r = openingFade(points, (Number(openSoft[i]) || 0) * g * 0.5) * k; if (r > 0.5) hole.filters = [new PIXI.BlurFilter(r, 4)]; stage.addChild(hole); });
    const picture = PIXI.RenderTexture.create({ width: Math.max(1, Math.ceil(box.width * k)), height: Math.max(1, Math.ceil(box.height * k)) });
    try { render(stage, picture); } finally { try { stage.destroy({ children: true }); } catch { /* drawn */ } }
    const was = edge.texture; edge.texture = picture; edge.position.set(box.x, box.y); edge.scale.set(1 / k);
    if (was && was !== PIXI.Texture.EMPTY) { try { was.destroy(true); } catch { /* gone */ } }
  };
  const shapeEdge = (edge, areas, box) => {
    if (render) { softEdge(edge, areas, box); return; }
    const { rect, holes, open } = areas;
    edge.clear();
    if (rect) { edge.beginFill(0xffffff, 1); edge.drawRect(rect.x, rect.y, rect.width, rect.height); for (const p of holes) { edge.beginHole(); edge.drawPolygon(p); edge.endHole(); } edge.endFill(); }
    for (const p of open) { edge.beginFill(0xffffff, 1); edge.drawPolygon(p); edge.endFill(); }
    // (A mask with nothing in it hides nothing: a speck off to the side then.)
    if (!rect && !open.length) { edge.beginFill(0xffffff, 1); edge.drawRect(-9, -9, 1, 1); edge.endFill(); }
  };
  // The rooms and openings, only as they change.
  const keepToOpenAir = (box) => {
    const areas = cloudAreas(box, state.areas ?? {}), key = JSON.stringify(areas);
    if (key === drawnAreas) return;
    drawnAreas = key;
    shapeEdge(bodyEdge, areas.body, box); shapeEdge(shadowEdge, areas.shadow, box);
  };
  const layers = () => {
    if (!bodies || bodies.destroyed || bodies.parent?.parent !== root()) {
      bodies = new PIXI.Container(); bodies.eventMode = 'none'; bodyEdge = clipped(root(), bodies);
      filter = new PIXI.Filter(undefined, CLOUD_LIGHT, { uLit: [1, 1, 1], uShade: [0.56, 0.61, 0.73], uRim: [1, 1, 1], uSun: towardSun(), uSolid: 0.6, uContrast: 1, uGlow: 0.2 }); bodies.filters = [filter];
      entries = [];
    }
    if (!shadows || shadows.destroyed || shadows.parent?.parent !== floor()) {
      shadows = new PIXI.Container(); shadows.eventMode = 'none'; shadowEdge = clipped(floor(), shadows);
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
      keepToOpenAir(box);
      const drawn = state.drawn !== false;
      bodyShare = entries.length ? bodiesShown(bodyShare, drawn, seconds) : drawn ? 1 : 0;
      bodies.renderable = bodyShare > 0;
      const makeup = skyMakeup(state.on ? state.cover : 0), up = cloudHeight(state.height), big = g * up.size;
      // (Higher, each covers more squares: fewer of them over the same map.)
      const { clouds, sheets, grow } = skyCount(makeup, skySquares(box, big));
      // Those wanted fade in, those no longer wanted fade out.
      for (let i = 0; i < clouds; i++) if (!entries.some((e) => !e.sheet && e.i === i)) { const e = entryOf(i, false, textures.clouds); if (e) entries.push(e); }
      for (let i = 0; i < sheets; i++) if (!entries.some((e) => e.sheet && e.i === i)) { const e = entryOf(i, true, textures.sheets); if (e) entries.push(e); }
      const speed = cloudSpeed(state.wind) * 13 * (1 + 0.9 * (Number(state.wind) || 0)) * g, angle = Number(state.angle) || 0, dx = Math.cos(angle), dy = Math.sin(angle);
      run += seconds * speed;
      // (The sun eases round to where it is now: it only jumps when someone moves it.)
      const want = Number(state.sunAngle) || 0; turning ??= want; turning += turnBy(turning, want) * Math.min(1, seconds / 2);
      const cast = { x: (state.cast?.x ?? 0) * up.cast, y: (state.cast?.y ?? 0) * up.cast }, view = screen?.(), shines = Math.min(1, (Number(state.sun) || 0) * 2.5);
      entries = entries.filter((e) => {
        const wanted = state.on && (e.sheet ? e.i < sheets : e.i < clouds);
        e.a = Math.max(0, Math.min(1, e.a + (wanted ? seconds : -seconds) / 2.5));
        if (!wanted && e.a <= 0) { try { e.body.destroy(); e.shadow.destroy(); } catch { /* gone */ } return false; }
        const size = e.size * big * (e.sheet ? 1 : makeup.big) * grow, pad = (e.size * big * 1.05 * grow) / 2 + Math.hypot(cast.x ?? 0, cast.y ?? 0) + g, x = skyAlong(box.x, box.width, pad, e.home[0], dx * run), y = skyAlong(box.y, box.height, pad, e.home[1], dy * run);
        // Past the scene on all sides: nothing to draw.
        const seen = x + size > box.x && x - size < box.x + box.width && y + size > box.y && y - size < box.y + box.height;
        e.body.renderable = seen && !state.areas?.below; e.shadow.renderable = seen && shines > 0.02;
        e.body.position.set(x, y); e.shadow.position.set(x + (cast.x ?? 0), y + (cast.y ?? 0));
        e.body.width = e.body.height = e.shadow.width = e.shadow.height = size;
        e.shadow.alpha = e.a;
        // A small cloud is a thin one.
        e.body.alpha = bodyShare * e.a * (e.sheet ? 1 : 0.68 + 0.32 * Math.min(1, e.size / 11));
        return true;
      });
      const solid = 1 - Math.min(0.95, Math.max(0, Number(state.transparency ?? DEFAULT_TRANSPARENCY)));
      if (filter) { const light = skyLight({ height: state.sunHeight, sun: state.sun, flat: makeup.flat, rain: state.rain, dark: state.dark, color: state.color }), u = filter.uniforms; u.uLit = light.lit; u.uShade = light.shade; u.uRim = light.rim; u.uContrast = light.contrast; u.uGlow = light.glow; u.uSolid = solid; u.uSun = towardSun(turning, state.sunHeight); }
      if (shade) shade.alpha = CLOUD_SHADE * (1 - makeup.flat * 0.5) * shines * (0.35 + 0.65 * solid);
      if (view) { bodies.filterArea = view; shadows.filterArea = view; }
    },
    clear() {
      state = { on: false }; entries = []; run = 0; turning = null;
      for (const c of clips) { try { const picture = c.texture; if (!c.destroyed) c.destroy({ children: true }); if (picture && picture !== PIXI.Texture.EMPTY && render) picture.destroy(true); } catch { /* gone with the canvas */ } }
      clips = []; bodies = null; shadows = null; bodyEdge = null; shadowEdge = null; drawnAreas = null; filter = null; shade = null;
    },
    get busy() { return state.on || entries.length > 0; },
    get count() { return entries.length; },
    get baked() { return textures.clouds.length + textures.sheets.length; },
  };
}
