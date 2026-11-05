// The sea's edge. A dark, glossy band of wet sand on the land side of the shore, as wide as the tide leaves it; foam that washes in
// and draws back in irregular sets, breaking up into lace, a stretch of shore at a time and never a ring all round; and a few small crabs
// in the wet that scuttle sideways, stop, and dive when anyone comes near. One mesh for all of it, reading a small picture of how far
// each place is from the shore, worked out once on the CPU. Every screen has its own: nothing here is saved or shared.

import { nearestOfArea } from './river-sound.mjs';
import { wayOut, shadowKeeper } from './wildlife.mjs';

const TAU = Math.PI * 2;
const between = (random, a, b) => a + random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Recordings of the surf, once they have been auditioned. Empty: silent.
export const COAST_SOUNDS = Object.freeze(['modules/animater/assets/sounds/places/surf-325197-0.ogg']);
export const COAST_REACH = 18;
export const TIDE_HOURS = 12.4;
export const MAX_WAVES = 4;
// How far (squares) the picture of the shore keeps count, and how far past the water it runs on the land.
const FIELD_RANGE = 5, FIELD_MARGIN = 3.5;

// ---- The tide ---------------------------------------------------------------------------------------------------------
// Where the tide is at a world time in seconds (pure): -1 dead low, 1 full high, round again every 12.4 game hours. `seed` sets when in
// the round this scene is, so two beaches need not agree. It comes in a little quicker than it goes out.
export function tideLevel(worldTimeSeconds, { seed = '' } = {}) {
  let h = 0; for (const c of String(seed)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const u = ((Number(worldTimeSeconds) || 0) / (TIDE_HOURS * 3600)) * TAU + (h % 6283) / 1000;
  return clamp((Math.sin(u) + 0.12 * Math.sin(2 * u + 0.7)) / 1.12, -1, 1);
}
// What a tide leaves on the shore (pure), px: `line` how far the waterline is up the land from the region's edge (less than none: out
// into the region, baring its sand); `width` of the wet band above it, wide when the water has gone out and narrow when it is in; `outer` the top of that band.
export function tideBand(tide = 0, grid = 100) {
  const t = clamp(Number(tide) || 0, -1, 1), line = t * 0.7 * grid, width = (0.8 - 0.35 * t) * grid;
  return { line, width, outer: line + width };
}

// How much of the sea is heard (pure): `seas` flat points, `ears` the listening points. `from` the listener nearest it and `at` the place in the water nearest them.
export function coastHeard(seas = [], ears = [], { grid = 100 } = {}) {
  const out = { level: 0, from: null, at: null }, reach = COAST_REACH * grid;
  for (const ear of ears) for (const area of seas) {
    const near = nearestOfArea(ear, area), k = Math.max(0, 1 - near.d / reach) ** 2;
    if (k > out.level) { out.level = k; out.from = ear; out.at = near; }
  }
  return out;
}

// ---- The waves --------------------------------------------------------------------------------------------------------
// How far up its run a wave is (pure), 0-1 over `u` 0-1 of its life: in quickly, then a long slow draw back.
export function swashFront(u) {
  if (u <= 0 || u >= 1) return 0;
  if (u < 0.4) { const k = u / 0.4; return k * (2 - k); }
  const k = (u - 0.4) / 0.6; return 1 - k * k * (3 - 2 * k);
}
// How much foam it still has (pure): all of it on the way in, thinning to nothing on the way back.
export function swashFoam(u) {
  if (u <= 0 || u >= 1) return 0;
  return Math.min(1, u / 0.08) * (u < 0.4 ? 1 : Math.pow(1 - (u - 0.4) / 0.6, 1.4));
}
// One step of the swell (pure): waves come in sets of two to five, the middle ones biggest, with a long quiet between sets; more wind, bigger and sooner.
// Each wave { age, life, reach (squares), power 0-1, seed }. Start it from `null`.
export function swellStep(swell, { dt = 1 / 60, wind = 0.3, random = Math.random } = {}) {
  const s = { next: swell?.next ?? 0, left: swell?.left ?? 0, size: swell?.size ?? 0, waves: (swell?.waves ?? []).map((w) => ({ ...w, age: w.age + dt })).filter((w) => w.age < w.life) };
  s.next -= dt;
  if (s.next > 0 || s.waves.length >= MAX_WAVES) return s;
  if (s.left <= 0) { s.left = s.size = 2 + Math.floor(random() * 4); }
  const peak = 1 - Math.abs(((s.left - 0.5) / s.size) * 2 - 1);
  s.waves.push({ age: 0, life: between(random, 7, 11), reach: between(random, 0.55, 0.95) * (0.7 + 0.9 * wind) * (0.7 + 0.3 * peak), power: 0.55 + 0.45 * peak, seed: random() * 97 });
  s.left--;
  s.next = s.left > 0 ? between(random, 3.5, 7.5) : between(random, 11, 24) / (0.7 + 0.8 * wind);
  return s;
}

// ---- The shore --------------------------------------------------------------------------------------------------------
const pairs = (points, visit) => { for (let i = 0, j = points.length - 2; i < points.length; j = i, i += 2) visit(points[j], points[j + 1], points[i], points[i + 1]); };
const inside = (points, x, y) => { let on = false; pairs(points, (ax, ay, bx, by) => { if ((by > y) !== (ay > y) && x < ((ax - bx) * (y - by)) / (ay - by) + bx) on = !on; }); return on; };
const inSea = (seas, x, y) => seas.some((a) => inside(a, x, y) && !(a.holes ?? []).some((h) => inside(h, x, y)));
const rectOf = (b) => (b ? { x: b.x ?? 0, y: b.y ?? 0, w: b.width ?? b.w ?? 0, h: b.height ?? b.h ?? 0 } : null);

// The stretches of a sea's edge that really are shore (pure), flat ax, ay, bx, by: not where it is drawn along or past the edge of the map, nor where two seas meet.
export function shoreEdges(seas = [], { bounds = null, grid = 100 } = {}) {
  const out = [], b = rectOf(bounds), slack = grid * 0.25, step = Math.max(1, grid * 0.04);
  const offMap = (ax, ay, bx, by) => !!b && ((ax <= b.x + slack && bx <= b.x + slack) || (ay <= b.y + slack && by <= b.y + slack) || (ax >= b.x + b.w - slack && bx >= b.x + b.w - slack) || (ay >= b.y + b.h - slack && by >= b.y + b.h - slack));
  const take = (ax, ay, bx, by) => {
    if (offMap(ax, ay, bx, by)) return;
    const d = Math.hypot(bx - ax, by - ay); if (d < 0.001) return;
    const mx = (ax + bx) / 2, my = (ay + by) / 2, nx = -(by - ay) / d, ny = (bx - ax) / d;
    if (inSea(seas, mx + nx * step, my + ny * step) && inSea(seas, mx - nx * step, my - ny * step)) return;
    out.push(ax, ay, bx, by);
  };
  for (const area of seas) { pairs(area, take); for (const hole of area.holes ?? []) pairs(hole, take); }
  return out;
}

// How far each place is from the shore (pure), in a grid of `cols` x `rows` over `rect`: `dist` px, more than none in the water and less on the land, held to `range` either way.
// Only the squares near each stretch of shore are worked, so a big map with a small sea is little work. null: no shore at all.
export function shoreField(seas = [], { bounds = null, grid = 100, size = 512 } = {}) {
  const edges = shoreEdges(seas, { bounds, grid });
  if (!edges.length) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < edges.length; i += 2) { x0 = Math.min(x0, edges[i]); x1 = Math.max(x1, edges[i]); y0 = Math.min(y0, edges[i + 1]); y1 = Math.max(y1, edges[i + 1]); }
  const range = FIELD_RANGE * grid, margin = FIELD_MARGIN * grid, b = rectOf(bounds);
  x0 -= margin; y0 -= margin; x1 += margin; y1 += margin;
  if (b) { x0 = Math.max(x0, b.x); y0 = Math.max(y0, b.y); x1 = Math.min(x1, b.x + b.w); y1 = Math.min(y1, b.y + b.h); }
  const w = Math.max(1, x1 - x0), h = Math.max(1, y1 - y0), cell = Math.max(Math.max(w, h) / size, grid / 12);
  const cols = Math.max(2, Math.ceil(w / cell)), rows = Math.max(2, Math.ceil(h / cell)), cw = w / cols, ch = h / rows;
  const near = new Float32Array(cols * rows).fill(range * range);
  for (let i = 0; i < edges.length; i += 4) {
    const ax = edges[i], ay = edges[i + 1], dx = edges[i + 2] - ax, dy = edges[i + 3] - ay, len = dx * dx + dy * dy || 1;
    const c0 = clamp(Math.floor((Math.min(ax, ax + dx) - range - x0) / cw), 0, cols - 1), c1 = clamp(Math.ceil((Math.max(ax, ax + dx) + range - x0) / cw), 0, cols - 1);
    const r0 = clamp(Math.floor((Math.min(ay, ay + dy) - range - y0) / ch), 0, rows - 1), r1 = clamp(Math.ceil((Math.max(ay, ay + dy) + range - y0) / ch), 0, rows - 1);
    for (let r = r0; r <= r1; r++) {
      const py = y0 + (r + 0.5) * ch - ay;
      for (let c = c0; c <= c1; c++) {
        const px = x0 + (c + 0.5) * cw - ax, u = clamp((px * dx + py * dy) / len, 0, 1), ex = px - dx * u, ey = py - dy * u, d2 = ex * ex + ey * ey, at = r * cols + c;
        if (d2 < near[at]) near[at] = d2;
      }
    }
  }
  // Which of them are in the water, a row at a time, each sea with its holes counted in with it.
  const dist = new Float32Array(cols * rows), wet = new Uint8Array(cols);
  for (let r = 0; r < rows; r++) {
    const y = y0 + (r + 0.5) * ch; wet.fill(0);
    for (const area of seas) {
      const cross = [], see = (ax, ay, bx, by) => { if ((by > y) !== (ay > y)) cross.push(((ax - bx) * (y - by)) / (ay - by) + bx); };
      pairs(area, see); for (const hole of area.holes ?? []) pairs(hole, see);
      cross.sort((a, b2) => a - b2);
      for (let k = 0; k + 1 < cross.length; k += 2) {
        const c0 = Math.max(0, Math.ceil((cross[k] - x0) / cw - 0.5)), c1 = Math.min(cols - 1, Math.floor((cross[k + 1] - x0) / cw - 0.5));
        for (let c = c0; c <= c1; c++) wet[c] = 1;
      }
    }
    for (let c = 0; c < cols; c++) { const d = Math.sqrt(near[r * cols + c]); dist[r * cols + c] = wet[c] ? d : -d; }
  }
  return { cols, rows, rect: { x: x0, y: y0, w, h }, range, dist, grid };
}
// How far a place is from the shore (pure), from that grid: the range out on the land past its edge.
export function shoreAt(field, x, y) {
  const c = Math.floor((x - field.rect.x) / (field.rect.w / field.cols)), r = Math.floor((y - field.rect.y) / (field.rect.h / field.rows));
  if (c < 0 || r < 0 || c >= field.cols || r >= field.rows) return -field.range;
  return field.dist[r * field.cols + c];
}
// A distance as one byte's worth of 0-1 and back (pure), closer counted finer: the waterline wants the steps small and the open water does not care.
export const shoreCode = (d, range) => { const k = clamp(d / range, -1, 1); return 0.5 + 0.5 * Math.sign(k) * Math.sqrt(Math.abs(k)); };
export const shoreDecode = (v, range) => { const m = (v - 0.5) * 2; return Math.sign(m) * m * m * range; };
// The grid as a picture for the shader (pure), RGBA.
export function shorePixels(field) {
  const out = new Uint8Array(field.cols * field.rows * 4);
  for (let i = 0; i < field.dist.length; i++) { const v = Math.round(shoreCode(field.dist[i], field.range) * 255); out[i * 4] = v; out[i * 4 + 1] = v; out[i * 4 + 2] = v; out[i * 4 + 3] = 255; }
  return out;
}

// ---- The crabs --------------------------------------------------------------------------------------------------------
// One step of a crab (pure): stands (`still`), then scuttles sideways (`scuttle`) along its `side`, facing `a` (0 up the map, clockwise); `ok(x, y)` the wet sand it keeps to.
// Anyone within 2 squares and it digs in (`dive`, `hide` 0-1 how far under), stays down (`under`) until they have gone 3 squares off, and comes back up (`up`).
export function crabStep(crab, { dt = 1 / 60, grid = 100, near = [], ok = () => true, random = Math.random, along = null } = {}) {
  const c = { ...crab }, within = (r) => near.some((t) => Math.hypot(t.x - c.x, t.y - c.y) < grid * r);
  if (c.mode === 'under') {
    c.hide = 1; c.left -= dt;
    if (c.left <= 0 && !within(3)) c.mode = 'up';
    return c;
  }
  if (c.mode === 'dive') {
    c.hide = Math.min(1, c.hide + dt / 0.3);
    if (c.hide >= 1) { c.mode = 'under'; c.left = between(random, 6, 14); }
    return c;
  }
  if (within(2)) { c.mode = 'dive'; return c; }
  if (c.mode === 'up') {
    c.hide = Math.max(0, c.hide - dt / 0.6);
    if (c.hide <= 0) { c.mode = 'still'; c.left = between(random, 0.6, 2.5); }
    return c;
  }
  c.left -= dt;
  if (c.mode === 'still') {
    if (c.left <= 0) { c.mode = 'scuttle'; c.side = random() < 0.5 ? -1 : 1; c.left = between(random, 0.5, 1.6); c.a = along ? along(c.x, c.y) + between(random, -0.35, 0.35) : c.a + between(random, -0.5, 0.5); }
    return c;
  }
  // Left where the sand is by the tide going out: over to where it is now.
  if (!ok(c.x, c.y)) { const out = wayOut(c, grid * 0.5, ok); if (out !== null) { c.a = out - Math.PI / 2; c.side = 1; } }
  const speed = grid * 0.9, wayX = Math.cos(c.a) * c.side, wayY = Math.sin(c.a) * c.side, nx = c.x + wayX * speed * dt, ny = c.y + wayY * speed * dt;
  if (ok(nx + wayX * grid * 0.1, ny + wayY * grid * 0.1) || !ok(c.x, c.y)) { c.x = nx; c.y = ny; } else { c.side = -c.side; if (along) c.a = along(c.x, c.y); } // met the edge of its sand: off along the shore the other way
  if (c.left <= 0) { c.mode = 'still'; c.left = between(random, 0.6, 3); }
  return c;
}
// Where the crabs keep on a beach drawn inside the water's own region (water-engine.mjs): its sand, by distance from the edge (pure), in the terms of tideBand.
export const beachBand = (grid = 100) => ({ line: -0.4 * grid, width: 0.34 * grid });
// How far from the edge of such a region the water really starts, for what lives in it: past the sand and the shallows, however far the waterline wanders.
export const beachKeepOff = (grid = 100) => 0.75 * grid;
// Where the crabs start (pure): on the shore's stretches by length, up on the land side into the wet.
export function crabSpots(field, edges, { count = 3, line = 0, width = 60, grid = 100, random = Math.random } = {}) {
  const out = []; let total = 0;
  for (let i = 0; i < edges.length; i += 4) total += Math.hypot(edges[i + 2] - edges[i], edges[i + 3] - edges[i + 1]);
  if (!total) return out;
  for (let tries = 0; out.length < count && tries < count * 12; tries++) {
    let at = random() * total, i = 0;
    for (; i < edges.length - 4; i += 4) { const d = Math.hypot(edges[i + 2] - edges[i], edges[i + 3] - edges[i + 1]); if (at < d) break; at -= d; }
    const dx = edges[i + 2] - edges[i], dy = edges[i + 3] - edges[i + 1], d = Math.hypot(dx, dy) || 1, off = line + width * between(random, 0.25, 0.75);
    for (const s of [1, -1]) {
      const x = edges[i] + (dx / d) * at - (dy / d) * off * s, y = edges[i + 1] + (dy / d) * at + (dx / d) * off * s, k = shoreAt(field, x, y) + line;
      if (k < 0 && k > -width) { out.push({ x, y, a: Math.atan2(dy, dx) + between(random, -0.4, 0.4), side: 1, mode: 'still', left: between(random, 0.5, 4), hide: 0 }); break; }
    }
  }
  return out;
}

// ---- How it looks -----------------------------------------------------------------------------------------------------
const VERT = `
precision highp float;
attribute vec2 aVertexPosition;
uniform mat3 translationMatrix; uniform mat3 projectionMatrix;
varying vec2 vPos;
void main(){ vPos = aVertexPosition; gl_Position = vec4((projectionMatrix * translationMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0); }`;

const FRAG = `
precision highp float;
varying vec2 vPos;
uniform sampler2D uField;                    // how far from the shore, coded as shoreCode
uniform vec4 uRect;                          // where that picture lies: x, y, w, h
uniform vec4 uWaves[${MAX_WAVES}];                 // how far up its run 0-1, how far it runs (px), its foam 0-1, a number of its own
uniform vec2 uDrift;                         // how far the wind has carried the big shapes along (squares)
uniform float uGrid, uTime, uLine, uWidth, uRange, uLight, uFrozen;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
void over(inout vec3 c, inout float a, vec3 col, float k){ c = col * k + c * (1.0 - k); a = k + a * (1.0 - k); }
void main(){
  float m = (texture2D(uField, (vPos - uRect.xy) / uRect.zw).r - 0.5) * 2.0, s = sign(m) * m * m * uRange;
  vec2 g = vPos / uGrid;
  // Measured from the waterline: more than none out in the water, less up the sand. It wanders, so no edge follows the region's.
  float x = s + uLine + ((noise(g * 0.9) - 0.5) * 0.4 + (noise(g * 3.1) - 0.5) * 0.12) * uGrid;
  if (x < -uWidth - uGrid * 2.2 || x > uGrid * 3.0) { gl_FragColor = vec4(0.0); return; }
  float shade = mix(0.3, 1.0, uLight);
  vec3 c = vec3(0.0); float a = 0.0;

  // The wet sand: darker toward the water, and bare where the tide has gone out of the region itself.
  float wet = smoothstep(-uWidth - uGrid * 0.22, -uWidth + uGrid * 0.12, x) * (1.0 - smoothstep(-uGrid * 0.03, uGrid * 0.05, x));
  float depth = smoothstep(-uWidth, 0.0, x), bare = smoothstep(-uGrid * 0.1, uGrid * 0.1, s);
  vec3 sand = mix(mix(vec3(0.46, 0.38, 0.27), vec3(0.33, 0.27, 0.2), depth), vec3(0.62, 0.68, 0.74), uFrozen * 0.7) * shade;
  if (wet > 0.001) {
    over(c, a, sand, wet * mix(mix(0.3, 0.58, depth), 0.9, bare));
    // Its gloss: a low sky caught in tiny ripples of the sand.
    float n = noise(g * 5.0), sx = noise(g * 5.0 + vec2(0.7, 0.0)) - n, sy = noise(g * 5.0 + vec2(0.0, 0.7)) - n;
    float spec = pow(max(0.0, dot(normalize(vec3(-sx * 1.4, -sy * 1.4, 1.0)), normalize(vec3(-0.25, -0.2, 1.0)))), 70.0);
    c += vec3(1.0, 0.96, 0.86) * spec * wet * (0.05 + 0.16 * depth) * uLight;
  }
  // The tide in over what the region calls land.
  float creep = (1.0 - smoothstep(-uGrid * 0.08, uGrid * 0.08, s)) * smoothstep(0.0, uGrid * 0.12, x);
  vec3 water = mix(vec3(0.12, 0.24, 0.27), vec3(0.72, 0.8, 0.86), uFrozen) * shade;
  if (creep > 0.001) over(c, a, water, creep * 0.62);

  // The waves. Each runs its own way along the shore: well up here, hardly at all there, gaps where it has no foam left.
  float foam = 0.0, sheet = 0.0;
  for (int i = 0; i < ${MAX_WAVES}; i++) {
    vec4 w = uWaves[i];
    if (w.z < 0.002) continue;
    float lobe = smoothstep(0.22, 0.78, noise(g * 0.42 + uDrift + vec2(w.w * 7.3, w.w * 3.1)));
    float front = mix(uGrid * 1.3, -w.y * (0.25 + 0.95 * lobe), w.x) + (noise(g * 2.2 + w.w) - 0.5) * uGrid * 0.35;
    float off = x - front;
    if (off < -uGrid * 0.06) continue;
    float gaps = smoothstep(0.3, 0.62, noise(g * 1.1 + uDrift + w.w * 2.7) + 0.25 * w.z);
    float edge = smoothstep(-uGrid * 0.05, 0.0, off) * (1.0 - smoothstep(0.0, uGrid * 0.1, off));
    float behind = smoothstep(0.0, uGrid * 0.05, off) * (1.0 - smoothstep(uGrid * 0.1, uGrid * (0.5 + 0.6 * lobe), off));
    // Lace: where two wandering fields cross the middle of their range, a web of thin lines with holes in it.
    float web = min(abs(noise(g * 9.0 + w.w * 11.0 + vec2(0.0, uTime * 0.12)) - 0.5), abs(noise(g * 21.0 - w.w * 5.0) - 0.5) * 1.3) * 2.0;
    float lace = 1.0 - smoothstep(0.03, 0.16, web);
    foam += w.z * gaps * (edge * (0.55 + 0.45 * lace) + behind * lace * 0.75);
    if (x < 0.0) sheet = max(sheet, w.z * smoothstep(0.0, uGrid * 0.06, off));
  }
  if (sheet > 0.001) over(c, a, water, sheet * 0.34);
  if (foam > 0.001) over(c, a, mix(vec3(0.95, 0.97, 0.96), vec3(0.82, 0.9, 0.98), uFrozen) * shade, clamp(foam, 0.0, 0.95));
  gl_FragColor = vec4(c, a);
}`;
export const COAST_SHADER = Object.freeze({ vert: VERT, frag: FRAG });

const picture = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.translate(w / 2, h / 2); draw(x); return c; };
// A crab from above, facing up, its legs in one of two steps.
function crabPicture(step) {
  return picture(64, 48, (x) => {
    x.lineCap = 'round'; x.strokeStyle = '#5a2f1c'; x.lineWidth = 1.5;
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
      const kick = ((i + step) % 2 ? 2 : -2), y0 = -1 + i * 2.6;
      x.beginPath(); x.moveTo(s * 9, y0); x.lineTo(s * 17, y0 + kick - 2 + i); x.lineTo(s * 23, y0 + kick * 1.5 + 2 + i * 1.5); x.stroke();
    }
    for (const s of [-1, 1]) {
      x.lineWidth = 2.2; x.beginPath(); x.moveTo(s * 7, -5); x.lineTo(s * 13, -11); x.stroke();
      x.fillStyle = '#a34e2c'; x.beginPath(); x.ellipse(s * 14, -13, 4, 2.8, s * -0.7, 0, TAU); x.fill();
    }
    const shell = x.createRadialGradient(-2, -3, 1, 0, 0, 12); shell.addColorStop(0, '#c0623a'); shell.addColorStop(1, '#6e3320');
    x.fillStyle = shell; x.beginPath(); x.ellipse(0, 0, 11, 8, 0, 0, TAU); x.fill();
    x.fillStyle = '#14100c'; for (const s of [-1, 1]) { x.beginPath(); x.arc(s * 3, -8, 1.2, 0, TAU); x.fill(); }
  });
}

/**
 * The layer: build({ seas (flat points, each with its `holes`), grid, bounds (the scene's rect; a sea drawn up to it has no shore there), crabs (how many; a few by the shore's length if left out), creaturesOnly (only the crabs, on a beach another layer draws) });
 * look({ tide -1..1, wind 0-1, windAngle radians, light 0-1, frozen }); tick(seconds, { near [{ x, y }], view { x, y, w, h }, seen(x, y), sound(kind, { x, y }, urgent), cast(x, y, opts) }); clear().
 * `floor()` the container it goes in. `render` is taken for the same shape as the other water layers; the shore's picture is worked on the CPU, so it is not called.
 */
export function createCoast({ PIXI, floor, render = () => {} }) {
  void render;
  let mesh = null, uniforms = null, texture = null, field = null, grid = 100, asked = null, swell = null, crabs = [], time = 0, look = 0, art = null, creaturesOnly = false;
  let state = { tide: 0, wind: 0.3, windAngle: 0, light: 1, frozen: false }, drift = [0, 0];
  const textures = () => {
    if (art && !art[0].baseTexture?.destroyed) return art;
    return (art = [0, 1].map((s) => PIXI.Texture.from(crabPicture(s))));
  };
  const sprite = (tex, dark = false) => { const s = new PIXI.Sprite(tex); s.anchor.set(0.5); s.eventMode = 'none'; s.visible = false; if (dark) s.tint = 0x000000; floor().addChild(s); return s; };
  const dress = () => {
    if (!uniforms) return;
    const band = tideBand(state.tide, grid);
    uniforms.uLine = band.line; uniforms.uWidth = band.width; uniforms.uLight = state.light; uniforms.uFrozen = state.frozen ? 1 : 0;
  };
  const dressWaves = () => {
    const out = uniforms.uWaves; out.fill(0);
    swell.waves.slice(0, MAX_WAVES).forEach((w, i) => { const u = w.age / w.life; out.set([swashFront(u), w.reach * grid, swashFoam(u) * w.power, w.seed], i * 4); });
  };
  const clear = () => {
    for (const c of crabs) { try { c.body.destroy(); c.shadow.destroy(); } catch { /* gone */ } }
    try { mesh?.parent?.removeChild(mesh); mesh?.destroy(); texture?.destroy(true); } catch { /* gone */ }
    mesh = uniforms = texture = field = swell = null; crabs = []; drift = [0, 0];
  };
  // The crabs' strip: the tide's wet sand, or a beach another layer draws.
  const bandNow = () => (creaturesOnly ? beachBand(grid) : tideBand(state.tide, grid));
  const hideCrabs = () => { for (const c of crabs) c.body.visible = c.shadow.visible = false; };
  const build = ({ seas = [], grid: g = 100, bounds = null, crabs: wanted, random = Math.random, creaturesOnly: only = false } = {}) => {
    clear(); grid = g; creaturesOnly = only; asked = { seas, grid: g, bounds, crabs: wanted, random, creaturesOnly: only };
    if (!seas.length) return;
    field = shoreField(seas, { bounds, grid });
    if (!field) return;
    const { x, y, w, h } = field.rect;
    texture = PIXI.Texture.fromBuffer(shorePixels(field), field.cols, field.rows, { scaleMode: PIXI.SCALE_MODES?.LINEAR, mipmap: PIXI.MIPMAP_MODES?.OFF });
    uniforms = { uField: texture, uRect: [x, y, w, h], uWaves: new Float32Array(MAX_WAVES * 4), uDrift: [0, 0], uGrid: grid, uTime: time, uLine: 0, uWidth: grid, uRange: field.range, uLight: 1, uFrozen: 0 };
    const geometry = new PIXI.Geometry().addAttribute('aVertexPosition', new PIXI.Buffer(new Float32Array([x, y, x + w, y, x + w, y + h, x, y + h]), true), 2).addIndex([0, 1, 2, 0, 2, 3]);
    mesh = new PIXI.Mesh(geometry, PIXI.Shader.from(VERT, FRAG, uniforms));
    mesh.eventMode = 'none'; floor().addChild(mesh);
    // The sea was going before anyone looked.
    for (let i = 0; i < 40; i++) swell = swellStep(swell, { dt: 0.75, wind: state.wind, random });
    dress(); dressWaves();
    const edges = shoreEdges(seas, { bounds, grid }); let shore = 0;
    for (let i = 0; i < edges.length; i += 4) shore += Math.hypot(edges[i + 2] - edges[i], edges[i + 3] - edges[i + 1]);
    const count = wanted ?? Math.min(6, Math.max(2, Math.round(shore / (grid * 18)))), band = bandNow();
    if (count > 0) { const t = textures(); crabs = crabSpots(field, edges, { count, line: band.line, width: band.width, grid, random }).map((c) => ({ ...c, body: null, shadow: sprite(t[0], true), phase: random() * 6 })); for (const c of crabs) c.body = sprite(t[0]); }
  };
  return {
    build,
    look({ tide = state.tide, wind = state.wind, windAngle = state.windAngle, light = state.light, frozen = state.frozen } = {}) { state = { tide, wind, windAngle, light, frozen }; dress(); },
    tick(seconds, { near = [], view = null, seen = () => true, sound = () => {}, cast = null } = {}) {
      if (mesh?.destroyed && asked) build(asked);
      if (!mesh) return;
      const { x, y, w, h } = field.rect, shows = !view || (x < view.x + view.w && x + w > view.x && y < view.y + view.h && y + h > view.y);
      mesh.visible = shows && !creaturesOnly;
      if (!shows) { hideCrabs(); return; }
      if (state.frozen) { hideCrabs(); return; }
      const dt = Math.min(0.1, seconds); time += dt; uniforms.uTime = time;
      swell = swellStep(swell, { dt, wind: state.wind }); dressWaves();
      drift[0] += (Math.cos(state.windAngle) * (0.02 + state.wind * 0.08) * dt); drift[1] += (Math.sin(state.windAngle) * (0.02 + state.wind * 0.08) * dt); uniforms.uDrift = drift;
      if (!crabs.length) return;
      const band = bandNow(), t = textures(), k = grid / 100;
      const ok = (cx, cy) => { const on = shoreAt(field, cx, cy) + band.line; return on < -grid * 0.05 && on > -band.width + grid * 0.05; };
      // The way the shore runs here: across how its distance changes. A crab goes along it, not up and down the beach.
      const shoreWay = (cx, cy) => { const e = grid * 0.25; return Math.atan2(shoreAt(field, cx + e, cy) - shoreAt(field, cx - e, cy), -(shoreAt(field, cx, cy + e) - shoreAt(field, cx, cy - e))); };
      const fall = shadowKeeper(cast ?? (() => ({ dx: grid * 0.015, dy: grid * 0.025, alpha: 0.5 })), time);
      look -= dt; const looking = look <= 0; if (looking) look = 0.2;
      crabs = crabs.map((c0) => {
        const c = crabStep(c0, { dt, grid, near, ok, along: shoreWay });
        if (c.mode === 'dive' && c0.mode !== 'dive') sound('crabDive', { x: c.x, y: c.y }, false);
        if (looking) { try { c.seen = seen(c.x, c.y) !== false; } catch { c.seen = true; } }
        const inView = !view || (c.x > view.x && c.y > view.y && c.x < view.x + view.w && c.y < view.y + view.h);
        if (c.mode === 'under' || c.seen === false || !inView) { c.body.visible = c.shadow.visible = false; return c; }
        const tex = t[c.mode === 'scuttle' ? Math.floor(time * 14 + c.phase) % 2 : 0], size = 0.45 * k * (1 - c.hide * 0.45), alpha = 1 - c.hide, f = fall(c, c.x, c.y, { width: grid * 0.2, body: 0.05, grounded: true });
        c.body.visible = c.shadow.visible = true;
        c.body.texture = c.shadow.texture = tex;
        c.body.position.set(c.x, c.y); c.body.rotation = c.a; c.body.scale.set(size); c.body.alpha = alpha;
        c.shadow.position.set(c.x + f.dx, c.y + f.dy); c.shadow.rotation = c.a; c.shadow.scale.set(size); c.shadow.alpha = Math.min(0.4, f.alpha * 0.5) * alpha;
        return c;
      });
    },
    clear() { clear(); asked = null; },
    get busy() { return !!mesh; },
    get count() { return crabs.length; },
  };
}

// What it draws with, for warming ahead of the first frame (scene-shaders.mjs).
export const COAST_SHADER_SOURCES = Object.freeze([[VERT, FRAG]]);
