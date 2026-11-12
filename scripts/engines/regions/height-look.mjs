// How raised ground looks on the map (Map painting's Heights), drawn along a raised part's cliff runs (heights.mjs cliffRuns:
// only where the ground drops, not where it meets ground as high, a ramp or the map's edge). A top-down battlemap is drawn
// as seen a little from the south, so a cliff shows as a wall hanging straight down the map from its rim: deep where the edge
// faces south, only a thin inked lip where it faces north. The wall is rock in columns, streaked down its length, light at the
// top and darkest at its foot, a ledge across it here and there, scree at its foot, the top's grass over its lip; its rim
// inked, heavier on the south, a pale lip where the sun strikes it. (Roi's friend, of rock boulders round the rim: "doesn't
// look elevated at all"; Roi chose look D of the mock: this wall, a cast shadow, the top lit from its middle, the ground
// below darker.) The shading round it is the caller's: footShade gives the darker ground below, topGlow how bright the top,
// castOffset its shadow. Drawn with PIXI.Graphics calls only, so it is tested with a stand-in. Pure but for drawing into `g`.

const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const noise = (t, seed) => { const i = Math.floor(t), f = t - i, a = hash(i + seed * 97), b = hash(i + 1 + seed * 97), u = f * f * (3 - 2 * f); return a + (b - a) * u; };
const rgb = (hex) => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
const hexOf = (c) => (Math.round(Math.max(0, Math.min(255, c[0]))) << 16) | (Math.round(Math.max(0, Math.min(255, c[1]))) << 8) | Math.round(Math.max(0, Math.min(255, c[2])));
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

/** The cliff's colours (pure) from the ground just outside it and the top's (0xrrggbb each, or null: a grey-brown stone and
 *  an olive grass): { light, dark, stone (the rock's own), tuft (the grass over the lip), ink }. The rock is the ground's
 *  colour pushed most of the way toward stone, so a sandy bank stays sandy and a grassy rise turns earthen. */
import { openAt, inAreas } from './heights.mjs';

// Lying snow's white, a little blue, and the grey-blue line under it.
export const SNOW = 0xf3f6fb, SNOW_EDGE = 0x5a6e8c;
/** The rock's colours in the weather (pure): wet, darker and cooler; under snow, paler and cooler; the top's grass whitened.
 *  `wet`, `snow` 0-1, as the ground's (Roi: "lets make heights support weather"; he chose the mock's look). */
export function weatherColours(colours, { wet = 0, snow = 0 } = {}) {
  const w = Math.max(0, Math.min(1, Number(wet) || 0)), sn = Math.max(0, Math.min(1, Number(snow) || 0)); if (!w && !sn) return colours;
  const tone = (c, dark) => { let v = rgb(c); if (w) v = mix(v, dark ? [14, 16, 22] : [70, 72, 78], (dark ? 0.5 : 0.45) * w); if (sn) v = mix(v, dark ? [80, 88, 104] : [190, 198, 210], (dark ? 0.3 : 0.35) * sn); return hexOf(v); };
  return { ...colours, stone: tone(colours.stone), light: tone(colours.light), dark: tone(colours.dark, true), tuft: hexOf(mix(rgb(colours.tuft), [236, 240, 246], 0.85 * sn)) };
}
export function cliffColours(ground = null, top = null) {
  // (A colour that is no number, a map not read right, is none: live, it painted the cliffs black.)
  const known = (c) => Number.isInteger(c) && c >= 0 && c <= 0xffffff;
  const g = known(ground) ? rgb(ground) : [96, 86, 66], stone = mix(g, [112, 98, 78], 0.65);
  const t = known(top) ? rgb(top) : [96, 118, 52];
  return { stone: hexOf(stone), light: hexOf(mix(stone, [236, 222, 190], 0.1)), dark: hexOf(mix(stone, [12, 8, 5], 0.78)), tuft: hexOf(mix(t, [255, 255, 200], 0.08)), ink: 0x0e0905 };
}

/** How deep a south-facing cliff's wall hangs (px) for a drop of `drop` (the scene's units), `step` its units a square,
 *  `grid` px a square: growing with the drop, compressed (about half a square for 5 ft, one for 20, a square and a half for 50,
 *  over two for 110), never past three squares. (Roi, of a 110 ft cliff drawn a square deep: "the scale seems weird"; he chose
 *  B of the scale mock, where 20, 50 and 110 ft read plainly apart.) */
export const faceDepth = (drop, grid, step = 5) => Math.min(3 * grid, (0.15 + 0.4 * Math.pow(Math.max(0, drop) / (step || 5), 0.55)) * grid);

/** The run's points laid out for drawing (pure): each with its rim (rx, ry: a little ragged), its foot (fx, fy) straight down
 *  the map below it, `w` the wall's depth there (deep facing south, a thin lip facing north, tapering away where an open run
 *  ends), `away` (0–1: how much it faces away from the sun), `lit` (how much toward it) and `south` (how much it faces the
 *  viewer). `sun`: the way the light comes from, as a unit { x, y } on the map (null: overhead). */
export function layOut(run, { grid = 100, step = 5, sun = null, seed = 0 } = {}) {
  const pts = run.points, n = pts.length, deep = faceDepth(pts.reduce((m, p) => Math.max(m, p.drop || 0), 0), grid, step), jitter = grid * 0.015;
  // (Distance along the run itself: a run crossing where its outline starts has its `s` start over part way, and measured
  // by that its taper came out below nothing: live, a hill's whole south wall was missing.)
  const along = [0]; for (let i = 1; i < n; i++) along.push(along[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  const len = along[n - 1];
  return pts.map((p, idx) => {
    const toward = sun ? p.nx * sun.x + p.ny * sun.y : 0, away = Math.max(0, -toward), lit = Math.max(0, toward), south = Math.max(0, p.ny);
    const r = ((noise(p.s / (grid * 0.12), seed) - 0.5) * 2 + (noise(p.s / (grid * 0.03), seed + 2) - 0.5) * 0.8) * jitter;
    // (Where an open run ends, its wall tapers to nothing over half a square: a cliff dying into level ground.)
    const from = along[idx], ends = run.closed ? 1 : Math.max(0, Math.min(1, from / (grid * 0.5), (len - from) / (grid * 0.5))), taper = ends * ends * (3 - 2 * ends);
    // (Its depth wanders only a little: wandering a lot, its foot became a spiky hem.)
    // (Not by the sun: deeper facing away from it, the wall grew and shrank as the day went on. Roi: "why changing time of day
    // changes cliff height?")
    const w = deep * (0.12 + 0.88 * south) * (0.88 + 0.24 * noise(p.s / (grid * 0.9), seed + 3)) * taper;
    const rx = p.x + p.nx * r, ry = p.y + p.ny * r;
    return { ...p, rx, ry, fx: rx + p.nx * w * 0.25, fy: ry + w, w, away, lit, south };
  });
}

/** Walls along the painted rock face's foot (pure), so nothing walks onto the face from below: the rim's walls alone left the
 *  face, a square or more of painted rock on the low side, open ground. (Roi, of a token walking up a cliff's face: "make sure
 *  the cliff is not passable on the cliff side".) Laid out as drawn, without the sun and a little inside the drawn foot (its
 *  depth wanders by the sun and a noise); where the face is deep it closes back to the rim at both ends, where only a thin lip
 *  shows, none (the rim's wall is enough). Returns [{ of, c: [x1, y1, x2, y2] }], pieces about `piece` px. */
export function faceFeet(runs, { grid = 100, step = 5, piece = 25, seed = 0, inset = 0.7, least = 0.12 } = {}) {
  const out = [];
  (runs ?? []).forEach((run, i) => {
    const L = layOut(run, { grid, step, sun: null, seed: seed + i }), n = L.length; if (n < 2) return;
    const foot = (p) => [p.rx + (p.fx - p.rx) * inset, p.ry + (p.fy - p.ry) * inset], deep = (p) => p.w * inset >= grid * least;
    const push = (a, b) => { if (Math.hypot(b[0] - a[0], b[1] - a[1]) > 0.5) out.push({ of: run.of, c: [a[0], a[1], b[0], b[1]].map((v) => Math.round(v)) }); };
    // (Stretches of deep face, each walked in pieces about `piece` long and shut to the rim at its ends.)
    const total = run.closed ? n + 1 : n; let open = null, last = null;
    for (let k = 0; k < total; k++) {
      const p = L[k % n];
      if (!deep(p)) { if (open) { push(last, foot(L[(k - 1 + n) % n])); push(foot(L[(k - 1 + n) % n]), [L[(k - 1 + n) % n].rx, L[(k - 1 + n) % n].ry]); open = null; } continue; }
      const here = foot(p);
      if (!open) { open = here; last = here; if (!(run.closed && k === 0 && L.every(deep))) push([p.rx, p.ry], here); continue; }
      if (Math.hypot(here[0] - last[0], here[1] - last[1]) >= piece) { push(last, here); last = here; }
    }
    if (open) { const p = L[(total - 1) % n], end = foot(p); push(last, end); if (!(run.closed && L.every(deep))) push(end, [p.rx, p.ry]); }
  });
  return out;
}

/** Whether a creature on foot is stopped stepping from `a` to `b` by the heights (pure): up or down a drop of `gap` or more
 *  (not where the edge is open, a slope; a ramp is walked, a ladder, rope or bridge is not), or onto a rock face, the ground
 *  just below a cliff where its painted wall hangs (from off the face it may step off it). With or without the scene's cliff
 *  walls. (Roi: "all non flying animals should know about cliffs and not walk on them like they are ground".) */
export function cliffStops({ field, a, b, grid = 100, step = 5, gap = 2.5 }) {
  if (!field?.parts?.length) return false;
  // (Along the whole way, a fifth of a square at a time: creatures look ahead up to three squares to steer, and judged by its
  // two ends a look clean over a raised part came back clear, so they kept walking into the cliff and stuck. Roi: "they are getting stuck".)
  // (Nowhere near a raised part, or the face below it, nothing to work out: most of the map, most of the time.)
  const boxes = partBoxes(field, grid), x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x), y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y);
  if (!boxes.some((q) => x1 >= q.x0 && x0 <= q.x1 && y1 >= q.y0 && y0 <= q.y1)) return false;
  const len = Math.hypot(b.x - a.x, b.y - a.y), n = Math.min(24, Math.max(1, Math.ceil(len / (grid * 0.2))));
  if (n > 1) { let p = a; for (let i = 1; i <= n; i++) { const q = { x: a.x + ((b.x - a.x) * i) / n, y: a.y + ((b.y - a.y) * i) / n }; if (stepStops(field, p, q, grid, step, gap)) return true; p = q; } return false; }
  return stepStops(field, a, b, grid, step, gap);
}
// Each raised part's box, grown by a cliff's reach (its face hangs up to three squares below it), kept with the field.
const BOXES = new WeakMap();
function partBoxes(field, grid) {
  let got = BOXES.get(field); if (got && got.grid === grid) return got.boxes;
  const pad = grid * 0.5, boxes = field.parts.map((part) => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const ar of part.areas ?? []) for (let i = 0; i < ar.length; i += 2) { x0 = Math.min(x0, ar[i]); x1 = Math.max(x1, ar[i]); y0 = Math.min(y0, ar[i + 1]); y1 = Math.max(y1, ar[i + 1]); } return { x0: x0 - pad, y0: y0 - pad, x1: x1 + pad, y1: y1 + grid * 3 + pad }; });
  BOXES.set(field, { grid, boxes }); return boxes;
}
/** Whether `p` (the ground there at `h`) lies on a cliff's rock face (pure): a little way straight up the map from it the ground
 *  stands a cliff higher, its painted wall hanging down over it. Not on a ramp. (Creatures on foot are never put there: one
 *  put there was walled in between a cliff's rim and its foot. Roi: "it's stuck i think".) */
export function onCliffFace(field, p, { grid = 100, step = 5, gap = 2.5, reach = 0.75 } = {}) {
  if (!field?.parts?.length) return false;
  if (!partBoxes(field, grid).some((q) => p.x >= q.x0 && p.x <= q.x1 && p.y >= q.y0 && p.y <= q.y1)) return false;
  const hit = field.rampAt(p), h = hit?.ramp?.kind === 'ramp' ? (() => { const [lo, hi] = field.rampEnds(hit.ramp); return lo + (hi - lo) * hit.t; })() : field.groundAt(p);
  return faceAt(field, p, h, grid, step, gap, reach);
}
// (A face hangs straight down the map under the rim, deeper the higher the drop: a point is on one when, a little way
// straight up the map from it, the ground stands a cliff higher.)
function faceAt(field, p, h, grid, step, gap, reach = 0.75) {
  if (field.rampAt(p)?.ramp?.kind === 'ramp') return false;
  for (const part of field.parts) {
    if (part.look === 'none' || part.height < h + gap) continue;
    const deep = faceDepth(part.height - h, grid, step) * reach;
    for (const k of [0.3, 0.6, 1]) { const q = { x: p.x, y: p.y - deep * k }; if (inAreas(q, part.areas) && field.groundAt(q) === part.height && !openAt(part, q)) return true; }
  }
  return false;
}
function stepStops(field, a, b, grid, step, gap) {
  const footing = (p) => { const hit = field.rampAt(p); if (hit?.ramp?.kind === 'ramp') { const [lo, hi] = field.rampEnds(hit.ramp); return lo + (hi - lo) * hit.t; } return field.groundAt(p); };
  const ha = footing(a), hb = footing(b);
  if (Math.abs(ha - hb) >= gap) { const high = field.partAt(ha > hb ? a : b); if (!(high && (openAt(high, a) || openAt(high, b)))) return true; }
  return faceAt(field, b, hb, grid, step, gap) && !faceAt(field, a, ha, grid, step, gap);
}

/** One loose rock (into `g`) at (x, y), about `r` px: an angular, chipped outline flat at its foot (5 to 7 corners), a dark
 *  shadow tucked under it, a lit facet on its top toward the sun and a crease across it. (Roi, of round pebbles at a cliff's
 *  foot: "can the circles look more realistic like rocks?") Pure but for `g`'s calls. */
export function drawStone(g, x, y, r, { seed = 0, body = [120, 110, 95], ink = 0x1a120b, k = 1, sun = null, wet = 0, snow = 0 } = {}) {
  const n = 5 + Math.floor(hash(seed) * 3), turn = hash(seed + 1) * Math.PI * 2, ring = [];
  for (let q = 0; q < n; q++) {
    const ang = turn + (q / n) * Math.PI * 2 + (hash(seed + q * 3) - 0.5) * 0.7, rr = r * (0.72 + hash(seed + q * 5) * 0.4);
    ring.push([x + Math.cos(ang) * rr * 1.25, y + Math.min(Math.sin(ang) * rr * 0.8, r * 0.45)]);
  }
  const flat = ring.flat();
  g.lineStyle(0); g.beginFill(0x0a0603, 0.45); g.drawEllipse(x + r * 0.15, y + r * 0.5, r * 1.3, r * 0.4); g.endFill();
  g.lineStyle(Math.max(0.8, k), ink, 0.85); g.beginFill(hexOf(body), 1); g.drawPolygon(flat); g.endFill();
  // Its lit top: the corners on the sun's side and the top, pulled toward its middle.
  const sx = sun ? sun.x : -0.6, sy = sun ? sun.y : -0.8, top = ring.filter(([px, py]) => (px - x) * sx + (py - y) * sy + (y - py) * 0.6 > 0);
  if (top.length >= 2) { const facet = [...top, [x + sx * r * 0.15, y - r * 0.05]].flatMap(([px, py]) => [x + (px - x) * 0.82, y + (py - y) * 0.82]); g.lineStyle(0); g.beginFill(hexOf(mix(body, [255, 244, 214], 0.35)), 0.8); g.drawPolygon(facet); g.endFill(); }
  // Its shade side, low and away from the sun.
  const low = ring.filter(([px, py]) => (px - x) * sx + (py - y) * sy < 0 && py >= y - r * 0.1);
  if (low.length >= 2) { const sh = [...low, [x, y + r * 0.1]].flatMap(([px, py]) => [x + (px - x) * 0.9, y + (py - y) * 0.9]); g.lineStyle(0); g.beginFill(hexOf(mix(body, [8, 5, 3], 0.45)), 0.75); g.drawPolygon(sh); g.endFill(); }
  if (r > 3 * k && hash(seed + 7) > 0.4) { g.lineStyle(Math.max(0.6, 0.7 * k), ink, 0.55); g.moveTo(x - r * 0.5, y - r * 0.15 + hash(seed + 8) * r * 0.3); g.lineTo(x + r * 0.1, y + r * 0.05); g.lineTo(x + r * 0.4, y - r * 0.25); }
  // (In the weather: its foot darkened wet; snow lying on its top, more the more lies.)
  if (wet > 0.05) { g.lineStyle(Math.max(0.8, 1.1 * k), 0x0a0c12, 0.55 * wet); g.moveTo(x - r * 1.1, y + r * 0.42); g.lineTo(x + r * 1.1, y + r * 0.38); }
  if (snow > 0.05) { g.lineStyle(0); g.beginFill(SNOW, Math.min(1, snow * 1.2)); g.drawEllipse(x - r * 0.05, y - r * 0.42, r * 0.95 * (0.6 + 0.4 * snow), r * 0.32 * (0.6 + 0.4 * snow)); g.endFill(); }
  return n;
}

/** Draws one cliff run into `g` (a PIXI.Graphics): its wall in columns of rock, streaks and a ledge or two down it, scree at
 *  its foot, the top's grass over its lip and its rim's ink. `colours` from cliffColours. Returns how many columns it drew. */
export function drawCliffRun(g, run, { grid = 100, step = 5, sun = null, seed = 0, colours = cliffColours(), wet = 0, snow = 0 } = {}) {
  const L = layOut(run, { grid, step, sun, seed }), n = L.length; if (n < 2) return 0;
  const light = rgb(colours.light), dark = rgb(colours.dark), k = grid / 100, last = run.closed ? n : n - 1, P = (i) => L[((i % n) + n) % n];
  const at = (p, t) => [p.rx + (p.fx - p.rx) * t, p.ry + (p.fy - p.ry) * t];
  // The wall, column by column, the rock in uneven masses (each its own tone), light at its top, darkest at its foot, in fine
  // steps so no band shows. (Roi, of three hard tone bands and even streaks: it looked like a curtain.)
  let columns = 0;
  const mass = (p) => noise(p.s / (grid * 0.26), seed + 7);
  for (let i = 0; i < last; i++) {
    const a = P(i), b = P(i + 1); if (a.w < 0.5 && b.w < 0.5) continue;
    const base = mix(light, dark, Math.min(1, Math.max(0, 0.3 + 0.45 * a.away + (mass(a) - 0.5) * 0.45)));
    const bands = [[0, 0.15, mix(base, [240, 228, 200], 0.15)], [0.15, 0.32, mix(base, [240, 228, 200], 0.07)], [0.32, 0.5, base], [0.5, 0.68, mix(base, [8, 5, 3], 0.2)], [0.68, 0.85, mix(base, [8, 5, 3], 0.45)], [0.85, 1, mix(base, [8, 5, 3], 0.68)]];
    g.lineStyle(0);
    for (const [t0, t1, c] of bands) { const [ax0, ay0] = at(a, t0), [bx0, by0] = at(b, t0), [bx1, by1] = at(b, t1), [ax1, ay1] = at(a, t1); g.beginFill(hexOf(c), 1); g.drawPolygon([ax0, ay0, bx0 + 0.5, by0, bx1 + 0.5, by1, ax1, ay1]); g.endFill(); }
    columns++;
  }
  // Deep cracks where one mass of rock meets the next, fine streaks between.
  for (let i = 0; i < last; i++) {
    const p = P(i), q = P(i + 1); if (p.w < grid * 0.06) continue;
    if (Math.abs(mass(q) - mass(p)) > 0.035) { g.lineStyle(Math.max(1, 1.8 * k), 0x0a0603, 0.75); const [x1, y1] = at(p, 0.02), [x2, y2] = at(p, 0.6 + hash(p.s * 2) * 0.4); g.moveTo(x1, y1); g.lineTo(x2 + (hash(p.s) - 0.5) * 4 * k, y2); }
    else if (i % 4 === 0) { g.lineStyle(Math.max(0.6, 0.8 * k), 0x0a0603, 0.28); const [x1, y1] = at(p, 0.02), [x2, y2] = at(p, 0.3 + hash(p.s * 3) * 0.5); g.moveTo(x1, y1); g.lineTo(x2, y2); }
    // (Wet: glossy dark runs down from the rim, a pale glint beside each.)
    if (wet > 0.05 && i % 2 === 1 && hash(p.s * 1.9 + seed) < 0.55) { const [x1, y1] = at(p, 0.03), [x2, y2] = at(p, 0.45 + hash(p.s * 4.7) * 0.5), [x3, y3] = at(p, 0.4 * hash(p.s * 2.9) + 0.15); g.lineStyle(Math.max(1, 1.8 * k), 0x0a0c12, 0.5 * wet); g.moveTo(x1, y1); g.lineTo(x2 + (hash(p.s * 6) - 0.5) * 2 * k, y2); g.lineStyle(Math.max(0.6, 0.7 * k), 0xdce6ff, 0.28 * wet); g.moveTo(x1 + k, y1 + 2 * k); g.lineTo(x3 + k, y3); }
  }
  // Ledges across a tall face: one for each seven tenths of a square of it, three at most, broken here and there.
  const tallest = L.reduce((m, p) => Math.max(m, p.w), 0), ledges = Math.min(3, Math.floor(tallest / (grid * 0.7)));
  for (let l = 1; l <= ledges; l++) {
    const tt = l / (ledges + 1); g.lineStyle(Math.max(0.8, 1.2 * k), 0x0a0603, 0.45); let on = false;
    for (let i = 0; i <= last; i++) { const p = P(i); if (p.w < grid * 0.3 || noise(p.s / (grid * 0.6), seed + l * 5) < 0.35) { on = false; continue; } const pt = at(p, tt); if (on) g.lineTo(...pt); else { g.moveTo(...pt); on = true; } }
    // (Snow lying along it.)
    if (snow > 0.1) { g.lineStyle(Math.max(1, 2.6 * k * (0.5 + 0.5 * snow)), SNOW, Math.min(1, snow * 1.3)); on = false; for (let i = 0; i <= last; i++) { const p = P(i); if (p.w < grid * 0.3 || noise(p.s / (grid * 0.6), seed + l * 5) < 0.35) { on = false; continue; } const [x, y] = at(p, tt); if (on) g.lineTo(x, y - 1.5 * k); else { g.moveTo(x, y - 1.5 * k); on = true; } } }
  }
  // Its foot buried in rubble: stones, bigger under a taller wall.
  for (const p of L) {
    if (p.w < grid * 0.08 || hash(p.s * 0.37 + seed) > 0.22) continue;
    const r = (2.5 + hash(p.s) * 5 * (0.6 + (tallest / grid) * 0.25)) * k, x = p.fx + (hash(p.s * 5) - 0.5) * 10 * k, y = p.fy - 2 * k + hash(p.s * 7) * 8 * k;
    drawStone(g, x, y, r, { seed: p.s * 13 + seed, body: mix(light, dark, 0.35 + hash(p.s * 9) * 0.3), ink: colours.ink, k, sun, wet, snow });
  }
  // The top's grass hanging over the lip, in clumps.
  for (const p of L) {
    if (noise(p.s / (grid * 0.2), seed + 9) < 0.5 || hash(p.s * 0.61 + seed * 3) > 0.6) continue;
    const l = (3 + hash(p.s * 2.3) * 5) * k, sway = (hash(p.s * 4.1) - 0.5) * 3 * k;
    g.lineStyle(Math.max(1, 1.6 * k), colours.tuft, 0.95); g.moveTo(p.rx - p.nx * 2 * k, p.ry - p.ny * 2 * k); g.lineTo(p.rx + sway, p.ry + l * (0.4 + p.south));
  }
  // The rim: inked heavier where the wall is deep, a pale lip where the sun strikes it; fading out at an open run's ends.
  for (let i = 0; i < last; i++) {
    const a = P(i), b = P(i + 1), fade = run.closed ? 1 : Math.min(1, i / 3, (n - 2 - i) / 3); if (fade <= 0) continue;
    g.lineStyle({ width: (1.4 + 2 * a.south) * k * (0.5 + 0.5 * fade), color: colours.ink, alpha: 0.95 * fade, cap: 'round' }); g.moveTo(a.rx, a.ry); g.lineTo(b.rx, b.ry);
    if (a.lit > 0.3) { g.lineStyle(Math.max(0.8, 1.2 * k), 0xfaecc8, 0.35 * a.lit * fade); g.moveTo(a.rx - a.nx * 2 * k, a.ry - a.ny * 2 * k); g.lineTo(b.rx - b.nx * 2 * k, b.ry - b.ny * 2 * k); }
    // (Wet: a sheen along the rim, just down its face.)
    if (wet > 0.05) { g.lineStyle(Math.max(0.6, 0.9 * k), 0xe1ebff, 0.45 * wet * fade); const [x1, y1] = at(a, Math.min(0.12, (2 * k) / Math.max(a.w, 1))), [x2, y2] = at(b, Math.min(0.12, (2 * k) / Math.max(b.w, 1))); g.moveTo(x1, y1); g.lineTo(x2, y2); }
  }
  // Snow: a ragged white cap along the rim, over its lip and a way down a south face, thicker the more lies.
  if (snow > 0.05) {
    const cap = (p) => Math.min(p.w * 0.35, (2 + 5 * Math.abs(Math.sin(p.s / (grid * 0.09) + seed))) * k * snow * (0.4 + 0.6 * p.south));
    for (let i = 0; i < last; i++) {
      const a = P(i), b = P(i + 1), fade = run.closed ? 1 : Math.min(1, i / 3, (n - 2 - i) / 3); if (fade <= 0) continue;
      const [ax, ay] = at(a, cap(a) / Math.max(a.w, 1)), [bx, by] = at(b, cap(b) / Math.max(b.w, 1));
      g.lineStyle(0); g.beginFill(SNOW, Math.min(1, 0.4 + snow) * fade); g.drawPolygon([a.rx - a.nx * 1.6 * k, a.ry - a.ny * 1.6 * k, b.rx - b.nx * 1.6 * k, b.ry - b.ny * 1.6 * k, bx, by + 1.2 * k, ax, ay + 1.2 * k]); g.endFill();
      g.lineStyle(Math.max(0.6, 0.8 * k), SNOW_EDGE, 0.5 * fade); g.moveTo(ax, ay + 1.2 * k); g.lineTo(bx, by + 1.2 * k);
    }
  }
  return columns;
}

/** The darker ground just below a run's wall (pure): pieces of a band from its foot down the map, a little past it, each a flat
 *  [x, y, …] outline, to be filled dark and blurred under the wall. (In pieces, so a run all the way round never fills the top
 *  it encloses.) Empty for a run too short. */
export function footShade(run, { grid = 100, step = 5, sun = null, seed = 0, piece = 8, far = 1 } = {}) {
  const L = layOut(run, { grid, step, sun, seed }), n = L.length, out = []; if (n < 2) return out;
  const reach = (p) => (grid * 0.12 + p.w * 0.6) * far, last = run.closed ? n : n - 1;
  for (let i = 0; i < last; i += piece) {
    const idx = []; for (let j = i; j <= Math.min(i + piece, last); j++) idx.push(j % n);
    const poly = []; for (const j of idx) poly.push(L[j].fx, L[j].fy - L[j].w * 0.3); for (let q = idx.length - 1; q >= 0; q--) { const p = L[idx[q]]; poly.push(p.fx, p.fy + reach(p)); }
    out.push(poly);
  }
  return out;
}

/** How much brighter a raised top is lit toward its middle (pure, 0–1 of white over it): more the higher it stands, gently
 *  (about a tenth at 5 ft, a sixth at 50), never past a fifth. */
export const topGlow = (height, step = 5) => Math.min(0.26, 0.07 + 0.045 * Math.pow(Math.max(0, height) / (step || 5), 0.55));

/** Which way and how far a raised part's cast shadow reaches over the lower ground (pure, px): away from the sun, longer the
 *  higher it stands and the lower the sun (`sunHeight`, degrees), painted short as a battlemap's are: a fifth of a square plus
 *  a little for each step of height, never past a square. (Live, two squares of it pooled in a ledge's hollow and read as a
 *  shadow left behind.) Null with no sun. */
export function castOffset({ height, grid = 100, step = 5, sun = null, sunHeight = 45 }) {
  if (!sun || !(height > 0)) return null;
  const low = 1 / Math.tan((Math.max(15, Math.min(85, Number(sunHeight) || 45)) * Math.PI) / 180);
  // (Growing with height as the wall does, never past three and a half squares.)
  const len = Math.min(3.5 * grid, (0.2 + 0.42 * Math.pow(height / (step || 5), 0.55)) * grid * Math.min(2, Math.max(0.5, low)));
  return { x: -sun.x * len, y: -sun.y * len };
}

/** Draws a slope (a raised part's open stretch, heights.mjs cliffRuns want 'slope') into `g`, shaded as ground falling away is
 *  under the sun: a slope facing the sun lit warmer, one facing away darker, a side-on one a little darker as it descends; the
 *  shading rising from nothing a square or two inside the top (how far wandering along it) to its fullest at the edge, and
 *  gone just past it, so the top rolls over into the slope instead of ending in a ring. (Roi, of the first slopes: the sun
 *  light and the unnatural blend into the slope's upper part.) Fading in where the slope meets a cliff. Bands, to be softened
 *  by the caller. Returns how many bands it drew. */
export function drawSlope(g, run, { grid = 100, step = 5, sun = null, seed = 0 } = {}) {
  const pts = run.points, n = pts.length; if (n < 2) return 0;
  const drop = pts.reduce((m, p) => Math.max(m, p.drop || 0), 0), deep = (0.9 + 0.3 * Math.log2(1 + drop / (step || 5)) / Math.log2(11)) * grid;
  const along = [0]; for (let i = 1; i < n; i++) along.push(along[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  // (From the shading's start inside the top, t = -1, out to just past the edge, t = 0.12: rising smoothly, then gone.)
  const T = [-1, -0.75, -0.5, -0.3, -0.15, -0.05, 0, 0.06, 0.12], weight = (t) => (t <= 0 ? ((t + 1) ** 2) * (3 - 2 * (t + 1)) : Math.max(0, 1 - t / 0.12));
  let bands = 0;
  const last = run.closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const a = pts[i], b = pts[(i + 1) % n], facing = sun ? a.nx * sun.x + a.ny * sun.y : 0;
    const ends = run.closed ? 1 : Math.max(0, Math.min(1, along[i] / (grid * 0.5), (along[n - 1] - along[i]) / (grid * 0.5))), fade = ends * ends * (3 - 2 * ends);
    if (fade < 0.01) continue;
    const reach = deep * (0.8 + 0.6 * noise(a.s / (grid * 0.9), seed + 61)), reachB = deep * (0.8 + 0.6 * noise(b.s / (grid * 0.9), seed + 61));
    const lit = Math.max(0, facing), dim = Math.max(0, -facing);
    for (let k = 0; k < T.length - 1; k++) {
      const t0 = T[k], t1 = T[k + 1], w = (weight(t0) + weight(t1)) / 2 * fade; if (w < 0.01) continue;
      const quad = [a.x + a.nx * reach * t0, a.y + a.ny * reach * t0, b.x + b.nx * reachB * t0, b.y + b.ny * reachB * t0, b.x + b.nx * reachB * t1, b.y + b.ny * reachB * t1, a.x + a.nx * reach * t1, a.y + a.ny * reach * t1];
      g.lineStyle(0);
      const shade = (0.06 + 0.3 * dim) * w, light = 0.12 * lit * w;
      if (shade > 0.004) { g.beginFill(0x0e0905, shade); g.drawPolygon(quad); g.endFill(); bands++; }
      if (light > 0.004) { g.beginFill(0xfff1cf, light); g.drawPolygon(quad); g.endFill(); bands++; }
    }
  }
  return bands;
}

/** How hazy the ground far below a cliff is (pure, 0–1): none for a low one, rising from 10 ft to full at 110. */
export const depthHaze = (drop) => Math.max(0, Math.min(1, (Number(drop) - 10) / 100));
