// What the smoke a fire fills a room with looks like on the map, for everyone, read from the stored cells alone so
// that every screen paints the same cloud.
//
// THE CELLS ARE THE INPUT, NOT THE SHAPE. Two earlier looks were built out of the squares themselves — first a few
// circles per square (grey pebbles with clean floor between them), then the squares merged into one polygon body
// (at a real map's cell size that read as a flat grey tarpaulin: long straight runs along the grid, notched corners,
// no falloff). Both failed the same way: geometry made of cells looks like cells. So nothing here is cell-shaped.
// The stored densities are treated as a SAMPLED FIELD (smokeFieldOf, smokeDensityAt: bilinear between cell centres,
// zero outside), and the cloud is drawn from that field:
//   - many overlapping soft forms at three sizes, placed on lattices that are deliberately out of step with the grid
//     (an irrational offset and a jitter wider than the lattice gap), so no form sits on a cell edge and no two
//     forms share a straight boundary — there is no straight run anywhere in the silhouette;
//   - each form's weight is the LOCAL field value under it, so the cloud is heavy where the smoke is thick and
//     feathers away to nothing where the field falls off, instead of stopping at a line;
//   - the forms are baked pictures (smoke-bake below: canvas 2D, stepped tonal bands, a ragged rim), not polygons,
//     because stepped brush tone and a soft rim have no PIXI.Graphics equivalent — the same reason fire-bake.mjs
//     exists. Bake once, then only place and fade sprites; nothing rebuilds geometry per frame.
//
// THREE LOOKS, chosen by `look`, all from the same field and all baked:
//   "billow"  overlapping painted billows at three sizes: a deep mass under the thick field, a mid body, a fine
//             brush over both. The silhouette is the union of hundreds of ragged rims.
//   "drift"   the same lattices, but every form is stretched along a slow seeded flow and the forms are nudged along
//             it, so the cloud reads as streams of smoke crossing the room rather than a mass of lumps.
//   "wash"    a painted brush-wash texture laid over the room and cut out by a soft density mask built from the
//             field (warped and blurred, so its boundary knows nothing about the grid), one wash for the thin tier
//             and a darker one for the thick, with a few billows as accents.
//
// THE TWO TIERS MUST READ APART AT A GLANCE, and that is a mechanical promise, not a taste: thick smoke blocks
// sight, so a creature standing in it must be at most a dim shadow (smokeCover over thick field >= THICK_COVER),
// while thin smoke veils without hiding (<= THIN_COVER). smokeCover is the same falloff curve the bake paints with,
// so what the tests measure is what the screen shows.
//
// Pure and seeded: the same cells, seed and look give the same forms and the same mask, every time. No Math.random,
// no Date.now, no performance.now anywhere in here — the clock is handed in, as createFireLooks takes its `now`.
// The drawing writes no documents: it reads what the GM wrote and paints it.
// The cloud drifts between rounds; the sight-blocking fence does NOT. The fence stands on the round boundary
// (smoke-fence.mjs, untouched) because a blocker that moved mid-frame would pop the fog and rebuild every client's
// vision every frame.
// The geometry is the one the cells were WRITTEN with (storedSmokeGrid at the call site), never the scene's current
// grid, so a resize can never slide the cloud out from under the cells.
import { seededRandom } from "../fragments/fragments.mjs";
import { THICK, THIN, DENSITY_CAP } from "./smoke-field.mjs";
import { smokeRunsOn } from "./smoke-round.mjs";

const TAU = Math.PI * 2;
const lerp = (a, b, k) => a + (b - a) * k;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
// A ramp from 0 at `from` to 1 at `to`, flat outside: how a form's weight fades in over a stretch of field.
const ramp = (v, from, to) => clamp01((v - from) / Math.max(1e-6, to - from));

// Numbers stirred into one, so a form's name is the scene's seed and its own place and nothing else.
const mix = (...parts) => {
  let h = 0x811c9dc5;
  for (const p of parts) { h = Math.imul(h ^ ((p | 0) >>> 0), 0x01000193) >>> 0; h ^= h >>> 15; }
  return (h >>> 0) || 1;
};
const rng = (...parts) => seededRandom(mix(...parts));
// One hashed number, 0-1, for a lattice point of the noise below.
const hash01 = (seed, x, y) => mix(seed, x, y, 0x9e37) / 4294967296;

// Smooth seeded noise over the map, in units of `wave` world pixels. This is what keeps the cloud's boundary and its
// internal tone from knowing where the grid is: everything that could have followed a cell edge is warped by this
// first. Pure; the same point is the same value on every screen.
export function smokeNoise(seed, x, y, wave = 1) {
  const u = x / Math.max(1e-6, wave), v = y / Math.max(1e-6, wave);
  const x0 = Math.floor(u), y0 = Math.floor(v), fx = u - x0, fy = v - y0;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash01(seed, x0, y0), b = hash01(seed, x0 + 1, y0);
  const c = hash01(seed, x0, y0 + 1), d = hash01(seed, x0 + 1, y0 + 1);
  return lerp(lerp(a, b, sx), lerp(c, d, sx), sy);
}
// Which way the smoke is streaming at a point, for the "drift" look: one slow turn of noise, so neighbouring forms
// lean the same way and a room's worth of them reads as a current and not as confetti.
export const smokeFlowAt = (seed, x, y, size) => smokeNoise(seed ^ 0x51ed, x, y, size * 9) * TAU;

// ---- The stored cells as a sampled field. ----

// Whether a cell of this density is smoke at all. Below the thin floor a cell conceals nothing and is painted at all.
const lit = (v) => Number(v) >= THIN;

/**
 * The stored cells as a field that can be asked for a value ANYWHERE, which is the whole turn this rebuild makes:
 * the drawing never asks "which cells are smoking", only "how thick is the smoke here".
 * `cells` are [{i, v}] (smoke-edges.mjs smokeCellList over the saved map); `cols`, `origin` and `cell` are the
 * geometry those indices were WRITTEN with. Nonsense in is null out.
 */
export function smokeFieldOf(cells, { cols, origin = { x: 0, y: 0 }, cell } = {}) {
  const wide = Number(cols), size = Number(cell);
  if (!(Number.isInteger(wide) && wide > 0) || !(size > 0)) return null;
  const ox = Number(origin?.x) || 0, oy = Number(origin?.y) || 0;
  if (!Number.isFinite(ox) || !Number.isFinite(oy)) return null;
  const dens = new Map();
  let loCol = Infinity, hiCol = -Infinity, loRow = Infinity, hiRow = -Infinity;
  for (const c of cells ?? []) {
    const i = Number(c?.i), v = Number(c?.v);
    if (!Number.isInteger(i) || i < 0 || !Number.isFinite(v) || !lit(v)) continue;
    dens.set(i, Math.max(dens.get(i) ?? 0, Math.min(v, DENSITY_CAP)));
    const col = i % wide, row = (i - col) / wide;
    loCol = Math.min(loCol, col); hiCol = Math.max(hiCol, col);
    loRow = Math.min(loRow, row); hiRow = Math.max(hiRow, row);
  }
  if (!dens.size) return null;
  return { cols: wide, ox, oy, size, dens, loCol, hiCol, loRow, hiRow };
}

// The density stored for one whole square, 0 off the map and 0 where nothing is smoking.
const cellDens = (field, col, row) => (col < 0 || col >= field.cols || row < 0 ? 0 : field.dens.get(row * field.cols + col) ?? 0);

/**
 * How thick the smoke is at a point, bilinear between the four nearest cell CENTRES. Pure.
 * This is what gives the cloud a soft, uneven boundary for free: the value falls from a boundary cell's centre to
 * zero at its empty neighbour's centre, so there is no step anywhere and nothing to align to.
 */
export function smokeDensityAt(field, x, y) {
  if (!field) return 0;
  const u = (Number(x) - field.ox) / field.size - 0.5, v = (Number(y) - field.oy) / field.size - 0.5;
  if (!Number.isFinite(u) || !Number.isFinite(v)) return 0;
  const c0 = Math.floor(u), r0 = Math.floor(v), fx = u - c0, fy = v - r0;
  const top = lerp(cellDens(field, c0, r0), cellDens(field, c0 + 1, r0), fx);
  const low = lerp(cellDens(field, c0, r0 + 1), cellDens(field, c0 + 1, r0 + 1), fx);
  return lerp(top, low, fy);
}

/**
 * How heavily a density is painted, 0 (nothing) to 1 (as heavy as smoke gets). Below the thin floor, nothing.
 * The thin band and the thick band are two stretches of this one curve with a deliberate lift between them: what
 * BLOCKS sight is always heavier on the map than what merely conceals, and because the field is sampled the line
 * between them is a smooth curve across the room, never a cell edge.
 */
export function smokeWeight(v) {
  const d = Number(v);
  if (!Number.isFinite(d) || d < THIN) return 0;
  // The thin band starts well off the floor: the faintest smoke a GM is told conceals has to be a visible veil on
  // the map, not a hint of one. The band is narrow, so it still tops out below the thick tier's own floor.
  if (d < THICK) return 0.3 + 0.2 * ramp(d, THIN, THICK);
  return 0.62 + 0.38 * ramp(d, THICK, DENSITY_CAP);
}
// The heaviest the thin tier ever reaches, and the lightest the thick tier starts at: the two sides of the line a GM
// must be able to read off the map.
export const THIN_WEIGHT_TOP = smokeWeight(THICK - 1e-9), THICK_WEIGHT_FLOOR = smokeWeight(THICK);

// How many steps of grey a form is painted in. Stepped, because this project's maps are painted — brush steps under
// an ink line — so the smoke is painted too, never a smooth photographic gradient.
export const TONE_STEPS = 4;
// Which grey step a density is painted in, 1 (lightest) to TONE_STEPS.
export const smokeBand = (v) => {
  const w = smokeWeight(v);
  return w > 0 ? Math.max(1, Math.min(TONE_STEPS, Math.ceil(w * TONE_STEPS))) : 0;
};
// Kept for the old name's sake: a density as a share of the darkest step.
export const smokeTone = (v) => smokeBand(v) / TONE_STEPS;
export const THIN_TOP = Math.ceil(THIN_WEIGHT_TOP * TONE_STEPS) / TONE_STEPS;

/**
 * The falloff of one painted form, `t` of the way from its middle to its rim. THE BAKE PAINTS THIS CURVE and
 * smokeCover adds it up, so a test measuring cover is measuring what the screen really shows.
 * Stepped on the inside (painted tone, not a Gaussian) and feathered over the last of the rim, so a form never ends
 * at a line of its own.
 */
export function formProfile(t) {
  const d = Number(t);
  if (!(d >= 0) || d >= 1) return 0;
  const core = Math.cos((d * Math.PI) / 2) ** 1.5;
  const stepped = Math.ceil(core * TONE_STEPS - 1e-9) / TONE_STEPS;
  return stepped * Math.min(1, (1 - d) / 0.22);
}

// The seed the rim of a form's picture wanders by: its shape, its variant and its tone step, and nothing else.
const formSeed = (shape, variant, band) => mix(0x5e01, variant | 0, band | 0, shape === "streak" ? 2 : 1);

/**
 * How far out a form's rim reaches at one angle round it, as a share of its radius: always less than one, so the
 * patch is a wandering brush shape pulled INWARD from a circle. The bake paints by this and smokeCover adds up by
 * it, so the picture on the screen and the number the tiers are judged by are the same thing.
 */
export function formRim({ shape = "billow", variant = 0, band = TONE_STEPS } = {}, ang = 0) {
  const seed = formSeed(shape, variant, band);
  return 0.72 + 0.19 * smokeNoise(seed, Math.cos(ang) * 3, Math.sin(ang) * 3, 1)
    + 0.09 * smokeNoise(seed ^ 0x77, Math.cos(ang) * 9, Math.sin(ang) * 9, 1);
}

// ---- Where the forms stand. ----

// How many baked pictures each shape has, so neighbouring forms are not the same picture turned round.
export const FORM_VARIANTS = 4;
// How far past the smoking squares' own footprint any paint may reach, in squares. A cloud must feather out instead
// of stopping at a line, so it has to spill a little; this bounds the spill, which is what keeps the smoke from
// washing through the wall its cells stop at. A form's radius is clipped to this plus its room inside the footprint.
export const OVERHANG = 0.45;

// A size class. `span` is the lattice gap in squares and `jit` the jitter as a share of that gap: the jitter is
// most of the gap, so the lattice itself is invisible — what shows is a drift of overlapping forms. `ox`/`oy` are
// irrational-ish offsets so no class lines up with the squares or with another class. `fade`/`full` are the field
// weights the class fades in over, which is how a deep mass stays inside the thick smoke and feathers at the
// frontier instead of being cut out along it. `a` is how strongly one form of the class is painted.
const cls = (key, span, jit, ox, oy, r, a, fade = 0, full = 0.5) => ({ key, span, jit, ox, oy, r, a, fade, full });

/**
 * The three looks. Each is a different IDEA of the same brief, not a tuning of one: billows, streams, or a washed
 * texture under a soft mask — so each carries its own size classes. `shape` is which baked picture family the forms
 * use, `squash` how round they are, `flow` whether they lean and stretch along the seeded current, `wash` whether a
 * density mask is painted under them.
 * The alphas are not taste: they are set so that a creature in thick smoke is hidden to THICK_COVER and one in thin
 * smoke is veiled to no more than THIN_COVER, which the tests measure through smokeCover.
 */
export const SMOKE_LOOKS = {
  // Overlapping painted billows at three sizes: a deep mass under the thick field, a mid body, a fine brush over both.
  billow: { shape: "billow", squash: 0.86, flow: false, wash: false, classes: [
    cls("deep", 0.58, 0.8, 0.317, 0.611, [1.0, 1.5], 0.96, 0.5, 0.84),
    cls("body", 0.56, 0.85, 0.733, 0.219, [0.5, 0.82], 0.23, 0, 0.4),
    cls("brush", 0.36, 0.9, 0.141, 0.887, [0.2, 0.38], 0.13, 0, 0.32)] },
  // The same field, but every form is stretched along a slow seeded current and nudged along it, so the cloud reads
  // as streams crossing the room. A stretched form covers less ground, so the lattices are tighter.
  drift: { shape: "streak", squash: 0.46, flow: true, wash: false, classes: [
    cls("deep", 0.32, 0.75, 0.317, 0.611, [0.8, 1.15], 0.95, 0.5, 0.84),
    cls("body", 0.34, 0.85, 0.733, 0.219, [0.45, 0.75], 0.2, 0, 0.4),
    cls("brush", 0.3, 0.9, 0.141, 0.887, [0.22, 0.42], 0.12, 0, 0.32)] },
  // A brush-wash texture laid over the room and cut out by the soft density mask, with billows as accents on top.
  wash: { shape: "billow", squash: 0.86, flow: false, wash: true, classes: [
    cls("accent", 0.85, 0.95, 0.523, 0.367, [0.3, 0.62], 0.26, 0, 0.4)] },
};
export const SMOKE_LOOK_NAMES = Object.keys(SMOKE_LOOKS);
// The look the module ships with when the caller names none (main.mjs names none). "billow" reads as smoke
// standing in a room at a glance, keeps the widest gap between the two tiers, and costs half the sprites of
// "drift", whose strokes also imply a wind the simulation does not model.
export const DEFAULT_SMOKE_LOOK = "billow";
const lookSpec = (look) => SMOKE_LOOKS[look] ?? SMOKE_LOOKS[DEFAULT_SMOKE_LOOK];

// How much room a point has inside the smoking footprint: the distance from it to the nearest square that is NOT
// smoking. A form's radius is clipped to this plus OVERHANG, so paint never reaches further than that past the
// cells the GM wrote — and because every form is clipped by its own distance, the silhouette this makes is wavy,
// never the straight line the cells would have given.
export function smokeHeadroom(field, x, y) {
  if (!field) return 0;
  const size = field.size;
  const col = Math.floor((x - field.ox) / size), row = Math.floor((y - field.oy) / size);
  let best = Infinity;
  for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
    const c = col + dc, r = row + dr;
    if (lit(cellDens(field, c, r))) continue;
    const rx = field.ox + c * size, ry = field.oy + r * size;
    const dx = Math.max(rx - x, 0, x - (rx + size)), dy = Math.max(ry - y, 0, y - (ry + size));
    best = Math.min(best, Math.hypot(dx, dy));
  }
  return best;
}

/**
 * How far OUTSIDE the smoking footprint a point lies, in pixels: 0 anywhere inside a smoking square, and otherwise
 * the distance to the nearest one. The mirror of smokeHeadroom, and the one bound on where paint may go: nothing is
 * painted further than OVERHANG past the cells the GM wrote, so no wash and no form can wash through a wall.
 */
export function smokeOutsideBy(field, x, y) {
  if (!field) return Infinity;
  const size = field.size;
  const col = Math.floor((x - field.ox) / size), row = Math.floor((y - field.oy) / size);
  if (lit(cellDens(field, col, row))) return 0;
  let best = Infinity;
  for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
    const c = col + dc, r = row + dr;
    if (!lit(cellDens(field, c, r))) continue;
    const rx = field.ox + c * size, ry = field.oy + r * size;
    const dx = Math.max(rx - x, 0, x - (rx + size)), dy = Math.max(ry - y, 0, y - (ry + size));
    best = Math.min(best, Math.hypot(dx, dy));
  }
  return best;
}

/**
 * THE CLOUD: every painted form of a stored field, pure and seeded.
 * `cells`, `cols`, `origin`, `cell` and `seed` are as smokeFieldOf takes them; `look` names one of SMOKE_LOOKS.
 * A form is {x, y, r, a, band, squash, angle, shape, variant, kind, seed}: where it stands, how wide, how strongly
 * it is painted, which grey step, how it is stretched and turned, which baked picture, and its own name. The name is
 * a form's LATTICE PLACE, not its round, which is what lets the cloud drift: a form that is still there next round
 * keeps its name and only fades, and one the round has newly filled grows in at its own place.
 * Every form stands inside a square that is really smoking, and its radius is clipped by smokeHeadroom, so the
 * cloud never washes more than OVERHANG past the cells the GM wrote.
 */
export function smokeForms(cells, { cols, origin = { x: 0, y: 0 }, cell, seed = 1, look = DEFAULT_SMOKE_LOOK } = {}) {
  const field = smokeFieldOf(cells, { cols, origin, cell });
  if (!field) return [];
  const spec = lookSpec(look), root = (Number(seed) >>> 0) || 1, size = field.size;
  const out = [];
  for (let ci = 0; ci < spec.classes.length; ci++) {
    const klass = spec.classes[ci], step = klass.span * size;
    // The lattice is walked over the footprint grown by a square, so a form may stand at the very edge of the smoke.
    const x0 = field.ox + (field.loCol - 1) * size, x1 = field.ox + (field.hiCol + 2) * size;
    const y0 = field.oy + (field.loRow - 1) * size, y1 = field.oy + (field.hiRow + 2) * size;
    const gx0 = Math.floor((x0 - field.ox) / step - klass.ox), gx1 = Math.ceil((x1 - field.ox) / step - klass.ox);
    const gy0 = Math.floor((y0 - field.oy) / step - klass.oy), gy1 = Math.ceil((y1 - field.oy) / step - klass.oy);
    for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) {
      const name = mix(root, ci + 1, gx, gy), rand = seededRandom(name);
      let x = field.ox + (gx + klass.ox + (rand() - 0.5) * klass.jit) * step;
      let y = field.oy + (gy + klass.oy + (rand() - 0.5) * klass.jit) * step;
      let angle = (rand() - 0.5) * Math.PI;
      if (spec.flow) {
        // Nudged along the current and turned with it, so the forms of a class string out into streams. The current
        // is asked at the place RELATIVE to the grid's own origin: a map that is moved or regrown carries its cloud
        // with it, and does not get a different one.
        const a = smokeFlowAt(root, x - field.ox, y - field.oy, size), push = (rand() - 0.5) * step * 0.7;
        x += Math.cos(a) * push; y += Math.sin(a) * push;
        angle = smokeFlowAt(root, x - field.ox, y - field.oy, size) + (rand() - 0.5) * 0.5;
      }
      // Only ever inside a square that is really smoking: the fringe past the cells is paint, never a form's home.
      const here = cellDens(field, Math.floor((x - field.ox) / size), Math.floor((y - field.oy) / size));
      if (!lit(here)) continue;
      const d = smokeDensityAt(field, x, y), w = smokeWeight(d);
      const strength = ramp(w, klass.fade, klass.full);
      if (!(strength > 0.02)) continue;
      const want = size * lerp(klass.r[0], klass.r[1], rand());
      const r = Math.min(want, smokeHeadroom(field, x, y) + OVERHANG * size);
      if (!(r > size * 0.07)) continue;
      out.push({ x, y, r, a: klass.a * strength, band: smokeBand(d), kind: klass.key, shape: spec.shape,
        squash: spec.squash, angle, variant: Math.floor(rand() * FORM_VARIANTS) % FORM_VARIANTS, seed: name });
    }
  }
  return out;
}

// ---- The "wash" look's density mask. ----

// How many mask pixels one square is worth. Four is plenty: the mask carries the cloud's SHAPE, while its structure
// comes from the brush texture laid through it, so a 48-square room's mask is 40x32 bytes per tier.
export const WASH_PX = 4;
// How far the mask's edge is warped, in squares, before it is blurred. This is what makes the boundary unaware of
// the grid: a straight run of smoking squares comes out as a wandering edge.
const WASH_WARP = 0.55;
// How many box-blur passes soften the mask. Two of a 3x3 box over a quarter-square grid is about a third of a square
// of feather: soft enough that the cloud ends in air, tight enough that it still ends inside OVERHANG.
const WASH_BLUR = 2;
// How far past the smoking squares the mask is painted before it is blurred. The blur then carries it out to about
// OVERHANG, which is where it is cut.
const WASH_EDGE = 0.12;

// A 3x3 box blur over a byte plane, in place of a Gaussian: cheap, and its slight squareness is invisible under a
// brush texture. Separable, two passes of a 1x3.
function blurPlane(src, w, h, times) {
  let a = src, b = new Uint8ClampedArray(src.length);
  for (let n = 0; n < times; n++) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      b[i] = (a[i - (x > 0 ? 1 : 0)] + a[i] + a[i + (x < w - 1 ? 1 : 0)]) / 3;
    }
    [a, b] = [b, a];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      b[i] = (a[i - (y > 0 ? w : 0)] + a[i] + a[i + (y < h - 1 ? w : 0)]) / 3;
    }
    [a, b] = [b, a];
  }
  return a;
}

/**
 * The "wash" look's cloud: two soft masks over the stored field, pure and seeded — one for all the smoke and a
 * second for the thick tier alone — as byte planes WASH_PX pixels to the square, with where they sit on the map.
 * Built by asking the field at every mask pixel through a seeded warp and then blurring, so the mask's boundary is
 * a wandering soft edge that knows nothing about the grid; it is then clipped to OVERHANG past the smoking squares,
 * so a wash can no more cross a wall than a form can.
 * Null when there is nothing to paint.
 */
export function smokeWash(cells, { cols, origin = { x: 0, y: 0 }, cell, seed = 1 } = {}) {
  const field = smokeFieldOf(cells, { cols, origin, cell });
  if (!field) return null;
  const root = (Number(seed) >>> 0) || 1, size = field.size, px = size / WASH_PX;
  const x = field.ox + (field.loCol - 1) * size, y = field.oy + (field.loRow - 1) * size;
  const w = (field.hiCol - field.loCol + 3) * WASH_PX, h = (field.hiRow - field.loRow + 3) * WASH_PX;
  const thin = new Uint8ClampedArray(w * h), thick = new Uint8ClampedArray(w * h);
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
    const wx = x + (c + 0.5) * px, wy = y + (r + 0.5) * px;
    // Painted a little short of the bound, because the blur below carries it the rest of the way out: the soft edge
    // ends up inside OVERHANG rather than being smeared past it.
    if (smokeOutsideBy(field, wx, wy) > WASH_EDGE * size) continue;
    const warp = WASH_WARP * size;
    // The warp is asked at the place RELATIVE to the grid's origin, so a map that moves carries its cloud with it.
    const nx = wx - field.ox, ny = wy - field.oy;
    const ux = wx + (smokeNoise(root, nx, ny, size * 2.1) - 0.5) * warp;
    const uy = wy + (smokeNoise(root ^ 0x2f1d, nx, ny, size * 2.1) - 0.5) * warp;
    const d = smokeDensityAt(field, ux, uy), weight = smokeWeight(d);
    if (!(weight > 0)) continue;
    thin[r * w + c] = 255 * ramp(weight, 0, 0.42);
    thick[r * w + c] = 255 * ramp(weight, THIN_WEIGHT_TOP, 0.78);
  }
  const soft = [blurPlane(thin, w, h, WASH_BLUR), blurPlane(thick, w, h, WASH_BLUR)];
  // And whatever the blur carried past the bound is cut off. By then it is a handful of values near nothing, so the
  // cut shows as no edge at all — it is only there so that a wash can never be seen through a wall.
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
    if (smokeOutsideBy(field, x + (c + 0.5) * px, y + (r + 0.5) * px) <= OVERHANG * size) continue;
    soft[0][r * w + c] = 0; soft[1][r * w + c] = 0;
  }
  return { x, y, w, h, px, size, seed: root, thin: soft[0], thick: soft[1] };
}

// How solid each wash is painted where its mask is full. The thin wash is a veil a creature is plainly seen
// through; the thick one is all but opaque, because blocking sight is the whole mechanical promise of the tier.
export const WASH_THIN_ALPHA = 0.5, WASH_THICK_ALPHA = 0.95;
// The share of a brush-texture pixel that is actually ink: a dry brush leaves gaps, and the cover a creature is
// seen through has to account for them or the test would promise more than the screen gives.
export const WASH_TEXTURE_FILL = 0.94;

// A mask's value at a point on the map, bilinear between its pixels, 0-1.
export function washAt(plan, plane, x, y) {
  if (!plan || !plane) return 0;
  const u = (Number(x) - plan.x) / plan.px - 0.5, v = (Number(y) - plan.y) / plan.px - 0.5;
  if (!Number.isFinite(u) || !Number.isFinite(v)) return 0;
  const c0 = Math.floor(u), r0 = Math.floor(v), fx = u - c0, fy = v - r0;
  const at = (c, r) => (c < 0 || c >= plan.w || r < 0 || r >= plan.h ? 0 : plane[r * plan.w + c] / 255);
  return lerp(lerp(at(c0, r0), at(c0 + 1, r0), fx), lerp(at(c0, r0 + 1), at(c0 + 1, r0 + 1), fx), fy);
}

// ---- What a creature standing there is seen through. ----

// How much of a form's paint lands at a point: its own falloff, through its stretch and its turn.
export function formCoverAt(form, x, y) {
  if (!form || !(form.r > 0)) return 0;
  const dx = Number(x) - form.x, dy = Number(y) - form.y;
  const a = Number(form.angle) || 0, squash = Number(form.squash) || 1;
  const u = dx * Math.cos(a) + dy * Math.sin(a), v = (-dx * Math.sin(a) + dy * Math.cos(a)) / Math.max(0.05, squash);
  // The rim's own wander is asked at this very angle, so the cover a creature is seen through is the alpha the
  // baked picture really has at that pixel, and not a rounder guess at it.
  return (Number(form.a) || 0) * formProfile(Math.hypot(u, v) / form.r / formRim(form, Math.atan2(v, u)));
}

/**
 * HOW HIDDEN A CREATURE STANDING AT A POINT IS, 0 (plainly seen) to 1 (gone): every form's paint and every wash,
 * composited exactly as the sprites are. Pure, and the number the tiers are judged by.
 * This is not a convenience for tests — it is the promise itself. Thick smoke blocks sight, so a creature in it has
 * to be at most a dim shadow; thin smoke conceals, so a creature in it has to still be plainly there.
 */
export function smokeCover({ forms = [], wash = null } = {}, x, y) {
  let clear = 1;
  for (const f of forms ?? []) clear *= 1 - clamp01(formCoverAt(f, x, y));
  if (wash) {
    clear *= 1 - clamp01(washAt(wash, wash.thin, x, y) * WASH_THIN_ALPHA * WASH_TEXTURE_FILL);
    clear *= 1 - clamp01(washAt(wash, wash.thick, x, y) * WASH_THICK_ALPHA * WASH_TEXTURE_FILL);
  }
  return 1 - clear;
}

// What the two tiers have to deliver, and what the tests hold the looks to. A thick square hides what stands in it;
// a thin one never does.
export const THICK_COVER = 0.9, THIN_COVER = 0.62;

// ---- Kept names: the old entry points main.mjs calls, now meaning the new things. ----
// main.mjs asks for `puffs` and `sheets` and hands both to sync; it is Foundry's entry point and not ours to edit,
// so the two names stay and point at the cloud's forms and the wash's masks.
export const smokePuffs = smokeForms;
export const smokeSheets = smokeWash;

// A scene's own brush seed, from its id: the same cloud on every screen looking at the same map, a different one on
// the map next door, and no clock or die anywhere near it.
export function smokeSeedOf(id) {
  const text = String(id ?? "");
  let h = 0x811c9dc5;
  for (let k = 0; k < text.length; k++) h = Math.imul(h ^ text.charCodeAt(k), 0x01000193) >>> 0;
  return (h >>> 0) || 1;
}

// ---- The drift from one round to the next. ----

// How long the cloud takes to walk from the round just gone to the round just written. A round is six seconds, so
// this is well inside one: the smoke has settled where it was written long before the next round moves it again.
export const SMOKE_DRIFT_MS = 2200;
// A form never stands quite still: it turns slowly on its own little circle, so a room whose smoke is not changing
// still breathes. Seeded from the form and read off the shared clock, so it turns in step on every screen.
export const SMOKE_SWAY_MS = 7000;
// How far it turns, as a share of its own radius: well inside OVERHANG, so the sway cannot carry paint through a wall.
export const SMOKE_SWAY = 0.12;

/**
 * One form `k` of the way (0-1, clamped) from the round just gone to the round just written. Pure.
 * Either side may be missing, and that is what keeps the cloud from popping: a form only now in the smoke grows out
 * of nothing at its own place, and one the round has cleared pales away at its old one, instead of either appearing
 * or vanishing whole between two frames.
 */
export function smokeBetween(was, now, k) {
  const t = clamp01(Number(k) || 0);
  if (!was && !now) return null;
  if (!was) return { ...now, r: now.r * lerp(0.6, 1, t), a: now.a * t };
  if (!now) return { ...was, r: was.r * lerp(1, 0.6, t), a: was.a * (1 - t) };
  return { ...now, x: lerp(was.x, now.x, t), y: lerp(was.y, now.y, t), r: lerp(was.r, now.r, t), a: lerp(was.a, now.a, t) };
}

// Where a form stands at `ms` once its own slow turn is added. Pure: the phase is the form's own name and the angle
// the shared clock's, so no two forms turn in step and every screen sees the same drift.
export function smokeSway(form, ms, amount = SMOKE_SWAY) {
  if (!form) return null;
  const seed = (form.seed >>> 0) || 1;
  const phase = ((seed % 1024) / 1024) * TAU;
  const a = (TAU * (Number(ms) || 0)) / SMOKE_SWAY_MS + phase;
  const reach = (Number(form.r) || 0) * amount;
  return { ...form, x: form.x + Math.cos(a) * reach, y: form.y + Math.sin(a) * reach * 0.6 };
}

/**
 * Whether the OLD rolling haze ("Smoke in the air", a world/client settings pair, visual only) shows on a scene.
 * One smoke per scene, not two layered: the haze stands down exactly where the simulation takes over, and NOWHERE
 * ELSE. `runs` is smoke-round.mjs's own smokeRunsOn — all three switches, the very question the drawing asks — and
 * not the scene's switch alone. Gating on the switch alone left the hole this was written to close: a scene with
 * "Fires fill rooms with smoke" ticked but Breakable props or Fire spreads off got no simulated smoke (the drawing
 * never runs) AND no haze (it had stood down), so the GM lost the atmosphere and got nothing in its place.
 * The other half state is not a fault: with the feature not actually running, the haze SHOULD still roll.
 * `on` is the settings pair, `underground` whether the scene is one, `runs` whether the simulation runs here. Pure.
 */
export const airHazeShows = ({ on = false, underground = false, runs = false } = {}) =>
  on === true && underground === true && runs !== true;

/**
 * The same question asked of a SCENE, which is how main.mjs asks it: `runs` is worked out here, from the scene
 * itself, through smoke-round.mjs's own smokeRunsOn.
 * This exists because handing `runs` in by hand is exactly where the bug was: the caller passed the scene's own
 * switch while the drawing gated on all three, and a scene with the switch ticked and Fire spreads off got no smoke
 * and no haze. Nobody can get that wrong now — the one question has one answer, and it is derived, not supplied.
 * `settings` is {on, underground}: the world/client pair, and whether the scene is underground. Pure.
 */
export const airHazeFor = ({ on = false, underground = false } = {}, scene = null) =>
  airHazeShows({ on, underground, runs: smokeRunsOn(scene) });

// ---- The baked pictures. Canvas 2D, because stepped tone and a soft rim have no PIXI.Graphics equivalent. ----

// The painted greys, lightest to darkest: one per tone step.
export const GREYS = ["#9aa0a6", "#7b8086", "#5c6066", "#41444a"];
// How wide a baked form picture is, in pixels. A form is drawn at any size on the map, so this is resolution and not
// size: 96 is enough for a form a square and a half wide on a 100px grid.
export const FORM_PX = 96;
// How much wider a baked picture is than the form it draws, so the rim runs out inside the picture.
export const FORM_RIM = 1.18;
// How round each shape is drawn. The looks use these same numbers, so a form's picture and its cover agree.
export const FORM_SQUASH = { billow: 0.86, streak: 0.46 };
// How wide the brush-wash tile is. It tiles, so this is the whole texture a room's wash is made of.
export const WASH_TILE_PX = 256;

// The canvas maker the browser has and node has not: the bake simply does not happen without one, exactly as
// fire-bake.mjs arranges, so nothing in here needs a canvas to be imported or tested.
export const defaultCanvas = () => (typeof document === "undefined" ? null
  : (w, h) => { const cv = document.createElement("canvas"); cv.width = w; cv.height = h; return cv; });

/**
 * One painted form, into any canvas 2D context: a soft ragged patch of stepped grey.
 * `shape` is "billow" (a rounded brush patch, its rim eaten into by seeded noise) or "streak" (the same, drawn long
 * and thin, with its tone banded along its length, for a cloud that streams). Pure in the seed: the same spec paints
 * the same pixels on every screen.
 * The alpha of a pixel is formProfile of its distance to the rim, times the rim's own wander — which is exactly what
 * smokeCover adds up, so the picture and the promise cannot drift apart.
 */
export function paintForm(ctx, { shape = "billow", variant = 0, band = TONE_STEPS } = {}, px = FORM_PX) {
  const size = Math.max(8, Math.floor(px)), half = size / 2;
  const img = ctx.createImageData(size, size), data = img.data;
  const seed = mix(0x5e01, variant, band, shape === "streak" ? 2 : 1);
  const tone = GREYS[Math.max(0, Math.min(GREYS.length - 1, (band || 1) - 1))];
  const [cr, cg, cb] = [1, 3, 5].map((k) => parseInt(tone.slice(k, k + 2), 16));
  // A streak is long along x and thin across it; a billow is nearly round. Both are drawn to the full picture, so a
  // sprite is placed by its radius alone.
  const squashY = FORM_SQUASH[shape] ?? FORM_SQUASH.billow;
  // The picture is wider than the form it draws: FORM_RIM is the ratio, so the form's own rim (where the falloff
  // reaches nothing) lands well inside the picture's edge and a sprite never ends at a straight cut. The drawing
  // scales a sprite by the same ratio, which is what keeps the painted falloff and smokeCover's sum the same curve.
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = ((x + 0.5 - half) / half) * FORM_RIM, dy = ((y + 0.5 - half) / (half * squashY)) * FORM_RIM;
    const t = Math.hypot(dx, dy);
    if (t >= 1.25) continue;
    // The rim wanders: a form is a brush patch, never a circle. Two turns of noise round the edge, one slow and one
    // quick, so the outline is ragged at two scales and no two variants are the same patch.
    const ang = Math.atan2(dy, dx);
    const wob = formRim({ shape, variant, band }, ang);
    let a = formProfile(t / wob);
    if (!(a > 0)) continue;
    // Stepped brush shading INSIDE the patch, so a filled room has tonal structure instead of one flat value: a few
    // broad steps of light and shade, quantised, plus a long grain for the streaks.
    const grain = smokeNoise(seed ^ 0x1a3, dx * 2.2 + (shape === "streak" ? 0 : 0), dy * 2.2, 1);
    const long = shape === "streak" ? smokeNoise(seed ^ 0x9d, dx * 5.5, dy * 1.3, 1) : smokeNoise(seed ^ 0x9d, dx * 4.4, dy * 4.4, 1);
    const shade = Math.round((grain * 0.6 + long * 0.4) * (TONE_STEPS - 1)) / (TONE_STEPS - 1);
    const value = 0.78 + 0.34 * shade;
    const i = (y * size + x) * 4;
    data[i] = Math.min(255, cr * value); data[i + 1] = Math.min(255, cg * value); data[i + 2] = Math.min(255, cb * value);
    data[i + 3] = Math.round(255 * Math.min(1, a));
  }
  ctx.putImageData(img, 0, 0);
  return ctx;
}

/**
 * The brush-wash tile the "wash" look lays through its mask: a seamless field of stepped brush tone, with dry-brush
 * streaks across it. It tiles, so the noise it is built from is taken round a circle rather than along a line.
 * Pure in the seed.
 */
export function paintWashTile(ctx, { variant = 0 } = {}, px = WASH_TILE_PX) {
  const size = Math.max(16, Math.floor(px));
  const img = ctx.createImageData(size, size), data = img.data;
  const rand = rng(0x7a5b, variant);
  // A handful of slow waves with whole-number frequencies: whole numbers are what make the tile meet itself exactly
  // on all four sides, and slow ones are what make it a wash of broad patches instead of a grain. Noise taken round
  // a torus was tried first and came out as stripes across the room, which is the fault this shape avoids.
  const waves = [];
  for (let k = 0; k < 5; k++) {
    const fx = 1 + Math.floor(rand() * 3), fy = 1 + Math.floor(rand() * 3);
    waves.push({ fx, fy, phase: rand() * TAU, amp: 1 / (fx + fy) });
  }
  const total = waves.reduce((a, w) => a + w.amp, 0);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let v = 0;
    for (const w of waves) v += w.amp * Math.sin(TAU * (w.fx * x / size + w.fy * y / size) + w.phase);
    const mixed = clamp01(0.5 + (v / total) * 0.62);
    // Stepped brush shading, and only within the middle greys: the wash is one body of smoke and these are the
    // tones inside it, not a second cloud painted over the first.
    const step = Math.round(mixed);
    const tone = GREYS[1 + step];
    const [cr, cg, cb] = [1, 3, 5].map((k) => parseInt(tone.slice(k, k + 2), 16));
    const i = (y * size + x) * 4;
    data[i] = cr; data[i + 1] = cg; data[i + 2] = cb;
    // A dry brush leaves a little of the floor showing through, which keeps a wash from reading as a tarpaulin.
    data[i + 3] = Math.round(255 * (WASH_TEXTURE_FILL - 0.05 + 0.05 * step));
  }
  ctx.putImageData(img, 0, 0);
  return ctx;
}

/**
 * A density mask as a picture: the byte plane as alpha, white underneath, for PIXI to use as a sprite mask.
 * Pure given the plane.
 */
export function paintMask(ctx, plane, w, h) {
  const img = ctx.createImageData(w, h), data = img.data;
  for (let i = 0; i < w * h; i++) {
    data[i * 4] = 255; data[i * 4 + 1] = 255; data[i * 4 + 2] = 255;
    data[i * 4 + 3] = plane[i] ?? 0;
  }
  ctx.putImageData(img, 0, 0);
  return ctx;
}

/**
 * The baked textures, made once on first use and kept while anything draws with them: FORM_VARIANTS pictures per
 * shape per tone step, one wash tile, and a mask texture per round. Nothing here is baked per frame.
 * Null without a canvas or without PIXI, so a node test and a server-side import are both safe.
 */
export function createSmokeBank({ PIXI, makeCanvas = defaultCanvas(), formPx = FORM_PX, tilePx = WASH_TILE_PX } = {}) {
  if (!makeCanvas || typeof PIXI?.Texture?.from !== "function") return null;
  const forms = new Map(), masks = new Map();
  let tile = null;
  const bake = (w, h, paint) => {
    const cv = makeCanvas(w, h), ctx = cv.getContext("2d");
    paint(ctx);
    const tex = PIXI.Texture.from(cv);
    return { cv, tex };
  };
  const drop = (made) => {
    try { made.tex.destroy(true); } catch { /* gone */ }
    try { made.cv.width = 0; made.cv.height = 0; } catch { /* a canvas that cannot shrink */ }
  };
  return {
    // One form picture: the same shape, variant and tone step is baked once and handed out for ever after.
    form(shape, variant, band) {
      const key = `${shape}:${variant}:${band}`;
      let made = forms.get(key);
      if (!made) { made = bake(formPx, formPx, (ctx) => paintForm(ctx, { shape, variant, band }, formPx)); forms.set(key, made); }
      return made.tex;
    },
    // The brush-wash tile, baked once.
    tile() {
      if (!tile) tile = bake(tilePx, tilePx, (ctx) => paintWashTile(ctx, {}, tilePx));
      return tile.tex;
    },
    // A mask texture for one round's plane. Keyed by the caller, and the old one of that key is thrown away, so a
    // smoking room keeps two mask textures and not one per round.
    mask(key, plane, w, h) {
      const had = masks.get(key);
      if (had?.w === w && had?.h === h && had.plane === plane) return had.made.tex;
      if (had) drop(had.made);
      const made = bake(w, h, (ctx) => paintMask(ctx, plane, w, h));
      masks.set(key, { made, w, h, plane });
      return made.tex;
    },
    baked: () => forms.size + masks.size + (tile ? 1 : 0),
    destroy() {
      for (const made of forms.values()) drop(made);
      for (const { made } of masks.values()) drop(made);
      if (tile) drop(tile);
      forms.clear(); masks.clear(); tile = null;
    },
  };
}

// ---- The painted smoke on the map. Only this part touches PIXI. ----

// Which class is painted under which: the deep mass first, the brush last.
const PAINT_ORDER = { deep: 0, body: 1, brush: 2, accent: 3 };
// At most this often, however fast the screen runs. The cloud drifts slowly, so twelve frames a second is smoke and
// not a cost, and a frame is only transforms and alphas on sprites that already exist.
export const SMOKE_FRAME_MS = 80;
// Where the cloud sits among the map's layers. Over Foundry's creatures (it draws tokens at 700) and over the
// treetops (decorCrowns, 740), because thick smoke hides what stands in it and must be painted over them; under the
// birds and their shadows (1100), which fly above it. Not the fire's own 657, which lies UNDER the creatures, and
// not the old rolling haze's 760. main.mjs reads this rather than keeping a number of its own.
export const SMOKE_SORT_LAYER = 752;
// The depths this one is chosen against, so the reasons above are checkable and not just a comment.
export const TOKEN_SORT_LAYER = 700, BIRD_SORT_LAYER = 1100;

/**
 * The painted smoke on the map. `layer()` gives the container it is drawn in, `grid()` the square size, `now()` the
 * shared clock the drift and the sway are read from (so every screen is at the same point in both), and `look` names
 * which of SMOKE_LOOKS to paint. `makeCanvas` and `bank` are there to be handed in by a test or a preview.
 * sync({forms, wash}) is given the cloud as it stands now — the old names {puffs, sheets} mean the same two things,
 * because main.mjs calls them that. A cloud that is not the one already shown starts a drift from whatever is on
 * screen to this one; the same cloud again leaves it alone.
 * clear() takes the layer and every baked texture away, for canvasTearDown.
 */
export function createSmokeLooks({ PIXI, layer, grid = () => 100, now = () => 0, look = DEFAULT_SMOKE_LOOK,
  makeCanvas = undefined, bank = undefined } = {}) {
  const spec = lookSpec(look);
  let box = null, pool = [], washArt = null, raf = 0, drawnAt = -Infinity, shop = bank ?? null;
  let was = new Map(), next = new Map(), wasWash = null, nextWash = null, startedAt = 0, shown = "";
  const store = () => {
    if (shop === null) shop = createSmokeBank({ PIXI, ...(makeCanvas ? { makeCanvas } : {}) }) ?? undefined;
    return shop;
  };
  const ensure = () => {
    const root = layer?.();
    if (!root) return null;
    if (!box || box.destroyed) { box = new PIXI.Container(); box.sortableChildren = false; pool = []; washArt = null; }
    if (box.parent !== root) root.addChild(box);
    return box;
  };
  // How far along the drift the clock now stands, 0-1.
  const along = (ms) => (SMOKE_DRIFT_MS > 0 ? clamp01((ms - startedAt) / SMOKE_DRIFT_MS) : 1);
  // The cloud's forms as they stand at `ms`: every form of the new round walked from where it was (or grown from
  // nothing), and every form the round dropped faded away at its old place until there is nothing of it left.
  const blend = (ms) => {
    const k = along(ms), out = [];
    for (const [seed, f] of next) out.push(smokeBetween(was.get(seed) ?? null, f, k));
    for (const [seed, f] of was) if (!next.has(seed)) out.push(smokeBetween(f, null, k));
    // Painted deep mass first, then body, then brush — and WITHIN a class in texture order, so a frame of a thousand
    // sprites hands the GPU a handful of batches instead of a switch per sprite. The order is a paint order, so it
    // must not depend on anything but the form itself.
    return out.filter((f) => f && f.a > 0.004 && f.r > 0.5)
      .sort((a, b) => (PAINT_ORDER[a.kind] ?? 9) - (PAINT_ORDER[b.kind] ?? 9)
        || (a.band ?? 0) - (b.band ?? 0) || (a.variant ?? 0) - (b.variant ?? 0) || a.seed - b.seed);
  };
  // A sprite from the pool, made only the first time it is needed: the pool is the whole of why a frame is cheap.
  const sprite = (i) => {
    if (pool[i]) return pool[i];
    const s = new PIXI.Sprite(PIXI.Texture.EMPTY);
    s.anchor?.set?.(0.5);
    box.addChild(s);
    pool[i] = s;
    return s;
  };
  // The two washes, each a texture laid through its own mask. Built once and then only re-pointed at a new mask.
  const washLayer = () => {
    if (washArt) return washArt;
    const shopNow = store();
    if (!shopNow) return null;
    const make = () => {
      const tex = shopNow.tile();
      const art = typeof PIXI.TilingSprite === "function" ? new PIXI.TilingSprite(tex, 64, 64) : new PIXI.Sprite(tex);
      const mask = new PIXI.Sprite(PIXI.Texture.EMPTY);
      art.mask = mask;
      box.addChild(mask); box.addChild(art);
      return { art, mask };
    };
    washArt = { thin: make(), thick: make() };
    return washArt;
  };
  const paintWash = (plan, side, alpha, planeName, drift_ = 0) => {
    const art = washLayer();
    const shopNow = store();
    if (!art || !shopNow || !plan) { if (art) { art.thin.art.visible = false; art.thick.art.visible = false; } return; }
    const { art: sprite_, mask } = art[side];
    mask.texture = shopNow.mask(`${side}:${planeName}`, plan[planeName], plan.w, plan.h);
    mask.position.set(plan.x, plan.y);
    mask.width = plan.w * plan.px; mask.height = plan.h * plan.px;
    sprite_.position.set(plan.x, plan.y);
    sprite_.width = plan.w * plan.px; sprite_.height = plan.h * plan.px;
    sprite_.alpha = alpha;
    // The texture creeps slowly across the mask, so a settled room's wash breathes as the forms do. One number a
    // frame, and the mask it is seen through does not move, so the cloud's shape is still the round's.
    if (sprite_.tilePosition) sprite_.tilePosition.set(drift_ * 7, drift_ * 4);
    sprite_.visible = alpha > 0.004;
  };
  const paint = (ms) => {
    if (!box) return;
    const shopNow = store();
    const k = along(ms);
    let used = 0;
    if (shopNow) {
      for (const f of blend(ms)) {
        const q = smokeSway(f, ms);
        const s = sprite(used++);
        s.texture = shopNow.form(f.shape ?? spec.shape, f.variant ?? 0, f.band ?? TONE_STEPS);
        s.position.set(q.x, q.y);
        // The picture is drawn to its full width, so a radius is a scale: squash and turn are the form's own.
        s.width = f.r * 2 * FORM_RIM; s.height = f.r * 2 * FORM_RIM;
        s.rotation = Number(f.angle) || 0;
        s.alpha = clamp01(f.a);
        s.visible = true;
      }
    }
    for (let i = used; i < pool.length; i++) pool[i].visible = false;
    if (spec.wash) {
      // The washes cross-fade: the round just gone pales out as the round just written comes up, so a mask never
      // snaps from one shape to another.
      const showing = nextWash ?? wasWash;
      if (showing) {
        const creep = ((Number(ms) || 0) / SMOKE_SWAY_MS) % 1;
        paintWash(showing, "thin", WASH_THIN_ALPHA * (nextWash ? k || 1 : 1 - k), "thin", creep);
        paintWash(showing, "thick", WASH_THICK_ALPHA * (nextWash ? k || 1 : 1 - k), "thick", -creep);
      } else if (washArt) { washArt.thin.art.visible = false; washArt.thick.art.visible = false; }
    }
  };
  // The sway never settles, so unlike the fire's pulse this loop runs for as long as there is smoke; it is held down
  // to SMOKE_FRAME_MS, and it stops the moment the last of the cloud has faded out.
  const tick = () => {
    const ms = Number(now()) || 0;
    if (ms - drawnAt >= SMOKE_FRAME_MS || ms < drawnAt) { drawnAt = ms; paint(ms); }
    const living = next.size > 0 || nextWash || along(ms) < 1;
    raf = living ? requestAnimationFrame(tick) : 0;
    if (!living) { was = new Map(); wasWash = null; for (const s of pool) s.visible = false; }
  };
  return {
    look,
    sync(cloud = {}) {
      if (!ensure()) return;
      const given = cloud ?? {};
      const list = (given.forms ?? given.puffs ?? []).filter?.((f) => f
        && [f.x, f.y, f.r, f.a].every((n) => Number.isFinite(n)) && f.r > 0 && f.a > 0) ?? [];
      const plan = given.wash ?? given.sheets ?? null;
      const wash = plan && Number.isInteger(plan.w) && plan.w > 0 && plan.thin && plan.thick ? plan : null;
      const key = [list.map((f) => `${f.seed}:${Math.round(f.x)},${Math.round(f.y)},${Math.round(f.r)},${f.a.toFixed(3)}`).join("|"),
        wash ? `${wash.x},${wash.y},${wash.w}x${wash.h}` : "", wash ? wash.thin.length : 0].join("#");
      const ms = Number(now()) || 0;
      if (key !== shown) {
        // Whatever is on screen right now becomes the place this drift starts from, so a round landing while the last
        // one is still walking carries on from where the cloud has got to and never snaps back.
        was = new Map(blend(ms).map((f) => [f.seed, f]));
        next = new Map(list.map((f) => [f.seed, f]));
        wasWash = nextWash;
        nextWash = wash;
        startedAt = ms;
        shown = key;
      }
      if ((next.size || was.size || nextWash || wasWash) && !raf) raf = requestAnimationFrame(tick);
    },
    clear() {
      cancelAnimationFrame(raf); raf = 0; drawnAt = -Infinity;
      was = new Map(); next = new Map(); wasWash = null; nextWash = null; startedAt = 0; shown = "";
      try { box?.destroy({ children: true }); } catch { /* gone */ }
      if (!bank) { try { shop?.destroy?.(); } catch { /* gone */ } shop = null; }
      box = null; pool = []; washArt = null;
    },
  };
}
