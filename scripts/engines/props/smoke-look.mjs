// What the smoke a fire fills a room with looks like on the map, for everyone, read from the stored cells alone so
// that every screen paints the same cloud. Painted (ink outline, stepped brush tones), never a pale disc and never a
// blur filter.
// A filled room is ONE BODY with a ragged edge, not a scatter of blobs, and that is the shape of this file:
//   smokeSheets  the body itself — a light wash over every smoking square and a dark, all but opaque mass over the
//                thick ones. Squares that touch are joined dead flush, so no clean floor ever shows between two
//                smoking squares; the raggedness lives only on the cloud's real boundary, against clear air, and is
//                pulled inward, so the cloud never crosses the wall its cells stop at.
//   smokePuffs   the stepped brush patches over that body, each inside its own square, which keep a filled room from
//                reading as a flat grey rectangle. Painted patches, as the fire's scorch and flames are.
// The two tiers are told apart by the body a square belongs to, not by a shade of alpha: thin smoke is a wash a
// creature is plainly seen through, thick smoke is a dark mass a creature is at most a dim silhouette in. Blocking
// sight is the whole mechanical promise of the thick tier, and a GM must be able to read it off the map at a glance.
// The picking, the tones, the drift and the sway are all pure and seeded; only createSmokeLooks touches PIXI, and its
// clock is handed in, as createFireLooks takes it, so nothing in here reads one.
// The smoke's EDGES are deliberately not here. The sight-blocking fence (smoke-fence.mjs) stands on the round
// boundary and does not move with the drawing: a blocker that moved mid-round would pop the fog and rebuild every
// client's vision every frame. The cloud drifts; what it blocks does not.
import { seededRandom } from "../fragments/fragments.mjs";
import { smokeTier, THICK, THIN, DENSITY_CAP } from "./smoke-field.mjs";
import { smokeRunsOn } from "./smoke-round.mjs";

// How many steps of grey the smoke is painted in. Stepped, because this project's map visuals match the battlemap's
// painted look — brush steps under an ink outline — never a smooth photographic gradient.
export const TONE_STEPS = 4;

// How dark a cell of this density is painted, 0 (nothing) to 1 (the darkest step). Thin smoke takes the two lighter
// steps and thick smoke the two darker ones, so what BLOCKS sight always reads heavier on the map than what merely
// conceals: a player can see from the paint which side of the line a square is on. Past the cap nothing goes darker.
export function smokeTone(v) {
  const d = Number(v);
  if (!Number.isFinite(d)) return 0;
  const tier = smokeTier(d);
  if (!tier) return 0;
  if (tier === "thin") return ((d - THIN) / (THICK - THIN) >= 0.5 ? 2 : 1) / TONE_STEPS;
  return (Math.min(1, (d - THICK) / (DENSITY_CAP - THICK)) >= 0.5 ? 4 : 3) / TONE_STEPS;
}

// The darkest tone thin smoke ever reaches. Everything above it blocks sight, so the two sides of this number are
// the two bodies the cloud is painted as.
export const THIN_TOP = 2 / TONE_STEPS;

// How many puffs a cell is painted with: a wisp or two of thin smoke, a cluster of thick.
const puffCount = (tone) => 1 + Math.round(tone * TONE_STEPS);

const lerp = (a, b, k) => a + (b - a) * k;

// Two numbers stirred into one, so a cell's brush and a puff's own name are the scene's seed and their own place and
// nothing else. (mulberry32 wants a seed; this is what gives each one a different one.)
const mix = (a, b) => {
  let h = ((a >>> 0) ^ Math.imul(((b >>> 0) ^ 0x9e3779b9) >>> 0, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) || 1;
};

// A scene's own brush seed, from its id: the same cloud on every screen looking at the same map, and a different one
// on the map next door, with no clock and no dice anywhere near it.
export function smokeSeedOf(id) {
  const text = String(id ?? "");
  let h = 0x811c9dc5;
  for (let k = 0; k < text.length; k++) h = Math.imul(h ^ text.charCodeAt(k), 0x01000193) >>> 0;
  return (h >>> 0) || 1;
}

/**
 * The BRUSH SHADING of a stored smoke field: one puff list, pure and seeded.
 * These are not the cloud. The cloud is a continuous body (smokeSheets below); these are the painted patches of
 * stepped tone brushed over it, which is what keeps a filled room from reading as a flat grey rectangle. Each one
 * stays inside its own cell, so a patch never spills onto clean floor or through a wall.
 * `cells` are [{i, v}] (smoke-edges.mjs smokeCellList over the saved map); `cols`, `origin` and `cell` are the
 * geometry those indices were WRITTEN with (storedSmokeGrid), never the scene's current grid; `seed` is the scene's
 * own (smokeSeedOf), so two scenes do not wear the same brush.
 * Each puff is {x, y, r, tone, seed}: where it stands, how wide, which grey step, and its own name — the name is what
 * the drift follows a puff by from one round to the next, so a puff that stayed put walks instead of jumping. How
 * MANY a cell gets is the tier's own difference in coverage: a wisp or two of thin haze against a mottled mass of
 * thick smoke.
 * A cell under the thin floor is painted at all: it conceals nothing and shows nothing. Nonsense in is [] out.
 */
export function smokePuffs(cells, { cols, origin = { x: 0, y: 0 }, cell, seed = 1 } = {}) {
  const wide = Number(cols), size = Number(cell);
  if (!(Number.isInteger(wide) && wide > 0) || !(size > 0)) return [];
  const ox = Number(origin?.x) || 0, oy = Number(origin?.y) || 0;
  if (!Number.isFinite(ox) || !Number.isFinite(oy)) return [];
  const root = (Number(seed) >>> 0) || 1;
  const out = [];
  // Painted in the cells' own order, so the cloud is the same however the saved map was walked.
  for (const c of [...(cells ?? [])].filter((c) => Number.isInteger(Number(c?.i)) && Number(c.i) >= 0).sort((a, b) => Number(a.i) - Number(b.i))) {
    const i = Number(c.i), tone = smokeTone(c.v);
    if (!(tone > 0)) continue;
    const cx = ox + ((i % wide) + 0.5) * size, cy = oy + (Math.floor(i / wide) + 0.5) * size;
    const base = mix(root, i), rand = seededRandom(base), count = puffCount(tone);
    for (let k = 0; k < count; k++) {
      // Held well inside the cell: the jitter reaches 0.2 of a square and the radius 0.23, so with the sway on top a
      // patch still stops short of its own cell's edge and never paints floor the smoke has not reached.
      out.push({
        x: cx + (rand() - 0.5) * size * 0.4,
        y: cy + (rand() - 0.5) * size * 0.4,
        r: size * (0.12 + 0.06 * rand()) * (0.85 + 0.4 * tone),
        tone,
        seed: mix(base, k + 1),
      });
    }
  }
  return out;
}

// ---- The cloud itself: one continuous body per tier, ragged only where it meets clear air. ----

// How many steps a ragged side is broken into. Four reads as a painted edge and keeps the point count down: a room
// full of smoke is hundreds of cells.
const SIDE_STEPS = 4;
// The four corners of a cell, in order, and the four sides between them with the direction that points INTO the cell.
// A ragged side is only ever pulled inward, so the body can never bleed across the wall the cell stops at.
const SIDES = [[0, 1, [0, 1]], [1, 2, [-1, 0]], [2, 3, [0, -1]], [3, 0, [1, 0]]];
// The neighbour across each side, as (column, row) steps: north, east, south, west.
const STEPS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
// How far a ragged side wanders into its cell, as a share of a square, and how far a corner is pulled in when both
// of its sides are ragged.
const RAG = 0.17, RAG_MIN = 0.03, NIP = 0.1, NIP_MIN = 0.05;

// One cell of a body: its outline, and which runs of that outline are its ragged rim (the ink is drawn along those
// and nowhere else, so a seam between two full squares is invisible). `has(i)` says whether a cell belongs to this
// body; a side whose neighbour belongs is drawn dead straight from corner to corner, so the two cells meet exactly
// and there is no clean floor between them.
function cellSheet(i, { cols, ox, oy, size, has, rand }) {
  const col = i % cols, row = Math.floor(i / cols);
  const x = ox + col * size, y = oy + row * size;
  const corners = [[x, y], [x + size, y], [x + size, y + size], [x, y + size]];
  const open = STEPS.map(([dc, dr], s) => {
    const c = col + dc, r = row + dr;
    if (c < 0 || c >= cols || r < 0) return true;
    return !has(r * cols + c);
  });
  const pts = [], starts = [];
  for (let s = 0; s < 4; s++) {
    const [a, b, n] = SIDES[s], A = corners[a], B = corners[b];
    const before = open[(s + 3) % 4];
    starts.push(pts.length);
    // The corner stays exactly on the cell's corner unless BOTH of its sides are ragged: a corner shared with a
    // flush side has to stay put, or the join it makes with the next cell opens up.
    if (open[s] && before) {
      const p = SIDES[(s + 3) % 4][2], d = (NIP_MIN + NIP * rand()) * size;
      pts.push([A[0] + (n[0] + p[0]) * d, A[1] + (n[1] + p[1]) * d]);
    } else pts.push([A[0], A[1]]);
    if (!open[s]) continue;
    for (let k = 1; k < SIDE_STEPS; k++) {
      const t = k / SIDE_STEPS, d = (RAG_MIN + RAG * rand()) * size;
      pts.push([A[0] + (B[0] - A[0]) * t + n[0] * d, A[1] + (B[1] - A[1]) * t + n[1] * d]);
    }
  }
  // Each ragged side's rim runs from its own start point to the next side's start point, so the ink follows the
  // cloud's real boundary and stops dead where the body carries on into the next square.
  const rims = [];
  for (let s = 0; s < 4; s++) {
    if (!open[s]) continue;
    const from = starts[s], to = starts[(s + 1) % 4];
    const run = to > from ? pts.slice(from, to + 1) : [...pts.slice(from), pts[0]];
    rims.push(run.flat());
  }
  return { pts: pts.flat(), rims };
}

/**
 * The cloud as painted bodies, pure and seeded: one entry per cell per body, each carrying the outline that cell
 * contributes and the runs of it that are a real boundary.
 * TWO bodies, which is the whole of how the tiers are told apart at a glance:
 *   "haze" covers EVERY smoking cell, thin and thick alike, as one light wash — so no two smoking squares ever show
 *          clean floor between them, whatever their tiers.
 *   "core" covers the thick cells only, as one dark, near-solid mass inside that wash — so the squares that block
 *          sight are a different thing on the map, not a slightly stronger version of the haze.
 * A cell deep inside a body has four flush sides and no rim at all; only cells at a boundary are ragged, and that
 * raggedness is pulled INWARD, so the cloud never crosses the wall its cells stop at.
 * Same arguments as smokePuffs, and the same geometry rule: the grid the cells were WRITTEN with.
 */
export function smokeSheets(cells, { cols, origin = { x: 0, y: 0 }, cell, seed = 1 } = {}) {
  const wide = Number(cols), size = Number(cell);
  if (!(Number.isInteger(wide) && wide > 0) || !(size > 0)) return [];
  const ox = Number(origin?.x) || 0, oy = Number(origin?.y) || 0;
  if (!Number.isFinite(ox) || !Number.isFinite(oy)) return [];
  const root = (Number(seed) >>> 0) || 1;
  const tones = new Map();
  for (const c of cells ?? []) {
    const i = Number(c?.i), tone = smokeTone(c?.v);
    if (!Number.isInteger(i) || i < 0 || !(tone > 0)) continue;
    tones.set(i, Math.max(tones.get(i) ?? 0, tone));
  }
  const thick = new Set([...tones].filter(([, tone]) => tone > THIN_TOP).map(([i]) => i));
  const out = [];
  for (const [kind, member, salt] of [["haze", new Set(tones.keys()), 1], ["core", thick, 2]]) {
    const has = (i) => member.has(i);
    for (const i of [...member].sort((a, b) => a - b)) {
      // Seeded from the scene, the cell and which body it is, so the same square is the same shape on every screen
      // and keeps it from round to round for as long as its own boundary does.
      const sheet = cellSheet(i, { cols: wide, ox, oy, size, has, rand: seededRandom(mix(mix(root, salt), i)) });
      out.push({ i, kind, tone: kind === "core" ? tones.get(i) : THIN_TOP, ...sheet });
    }
  }
  return out;
}

/**
 * One sheet `k` of the way (0-1, clamped) from the round just gone to the round just written.
 * Its OUTLINE does not move: a body's shape changes only on the round boundary, in step with the sight-blocking
 * fence it stands for, because a blocker and its paint drifting apart is worse than either drifting. What walks is
 * its weight — `grow`, 0 to 1 — so a square that has just filled darkens in and one the round has cleared pales
 * away, instead of either appearing or vanishing whole between two frames.
 */
export function smokeSheetAt(was, now, k) {
  const t = Math.min(1, Math.max(0, Number(k) || 0));
  if (!was && !now) return null;
  if (!was) return { ...now, grow: t };
  if (!now) return { ...was, grow: 1 - t };
  return { ...now, tone: lerp(was.tone, now.tone, t), grow: 1 };
}

// How long the cloud takes to walk from the round just gone to the round just written. A round is six seconds, so
// this is well inside one: the smoke has settled where it was written long before the next round moves it again.
export const SMOKE_DRIFT_MS = 2200;
// A puff never stands quite still: it turns slowly on its own little circle, so a room whose smoke is not changing
// still breathes. Seeded from the puff and read off the shared clock, so it turns in step on every screen.
export const SMOKE_SWAY_MS = 7000;
// How far it turns, as a share of its own radius: inside its own cell, so the sway never carries smoke through a wall.
export const SMOKE_SWAY = 0.18;

/**
 * One puff `k` of the way (0-1, clamped) from the round just gone to the round just written. Pure.
 * Either side may be missing, and that is what keeps the cloud from popping: a puff only now in the smoke grows out
 * of nothing at its own place, and a puff the round has cleared shrinks and pales away at its old one, instead of
 * either appearing or vanishing whole between two frames.
 */
export function smokeBetween(was, now, k) {
  const t = Math.min(1, Math.max(0, Number(k) || 0));
  if (!was && !now) return null;
  if (!was) return { x: now.x, y: now.y, r: now.r * lerp(0.45, 1, t), tone: now.tone * t, seed: now.seed };
  if (!now) return { x: was.x, y: was.y, r: was.r * lerp(1, 0.45, t), tone: was.tone * (1 - t), seed: was.seed };
  return { x: lerp(was.x, now.x, t), y: lerp(was.y, now.y, t), r: lerp(was.r, now.r, t), tone: lerp(was.tone, now.tone, t), seed: now.seed };
}

// Where a puff stands at `ms` once its own slow turn is added. Pure: the phase is the puff's own name and the angle
// the shared clock's, so no two puffs turn in step and every screen sees the same drift.
export function smokeSway(puff, ms, amount = SMOKE_SWAY) {
  if (!puff) return null;
  const seed = (puff.seed >>> 0) || 1;
  const phase = ((seed % 1024) / 1024) * Math.PI * 2;
  const a = (2 * Math.PI * (Number(ms) || 0)) / SMOKE_SWAY_MS + phase;
  const reach = (Number(puff.r) || 0) * amount;
  return { ...puff, x: puff.x + Math.cos(a) * reach, y: puff.y + Math.sin(a) * reach * 0.6 };
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

// ---- The painted look. Only this part touches PIXI. ----

const SMOKE_INK = 0x14151a;
// The four painted steps of grey, light to dark: one per tone step.
const GREYS = [0x9aa0a6, 0x7b8086, 0x5c6066, 0x41444a];
// How solid each body is painted. The thin haze is a wash a creature is plainly seen through; thick smoke is all but
// opaque, because blocking sight is the whole mechanical promise of the tier and a map that shows a crisp creature
// standing in it is lying to the GM. The two together leave a thick square at about 0.95 — a dim silhouette, no more.
export const HAZE_ALPHA = 0.42;
export const CORE_ALPHA = 0.82, CORE_ALPHA_TOP = 0.92;
// At most this often, however fast the screen runs. The cloud drifts slowly, so twelve frames a second is smoke and
// not a cost; a room full of smoke is hundreds of cells and hundreds of brush patches.
export const SMOKE_FRAME_MS = 80;
// Where the cloud sits among the map's layers. Over Foundry's creatures (it draws tokens at 700) and over the
// treetops (decorCrowns, 740), because thick smoke hides what stands in it and must be painted over them; under the
// birds and their shadows (1100), which fly above it. Not the fire's own 657, which lies UNDER the creatures, and
// not the old rolling haze's 760. main.mjs reads this rather than keeping a number of its own.
export const SMOKE_SORT_LAYER = 752;
// The depths this one is chosen against, so the reasons above are checkable and not just a comment.
export const TOKEN_SORT_LAYER = 700, BIRD_SORT_LAYER = 1100;
// How many points a brush patch's ragged outline is drawn with. A painted patch, never a circle.
const RAGS = 11;

/**
 * The painted smoke on the map. `layer()` gives the container it is drawn in, `grid()` the square size (the ink line
 * keeps its weight whatever the map's scale) and `now()` the shared clock the drift and the sway are read from, so
 * every screen is at the same point in both.
 * sync({sheets, puffs}) is given the cloud as it stands now: `sheets` the continuous bodies (smokeSheets) and `puffs`
 * the brush shading over them (smokePuffs). A cloud that is not the one already shown starts a drift from whatever is
 * on screen to this one; the same cloud again leaves it alone.
 * clear() takes the layer away, for canvasTearDown.
 */
export function createSmokeLooks({ PIXI, layer, grid = () => 100, now = () => 0 }) {
  let box = null, art = null, raf = 0, drawnAt = -Infinity;
  let was = new Map(), next = new Map(), wasSheets = new Map(), nextSheets = new Map(), startedAt = 0, shown = "";
  const ensure = () => {
    const root = layer?.();
    if (!root) return null;
    if (!box || box.destroyed) { box = new PIXI.Container(); art = new PIXI.Graphics(); box.addChild(art); }
    if (box.parent !== root) root.addChild(box);
    return box;
  };
  // How far along the drift the clock now stands, 0-1.
  const along = (ms) => (SMOKE_DRIFT_MS > 0 ? Math.min(1, Math.max(0, (ms - startedAt) / SMOKE_DRIFT_MS)) : 1);
  // The brush shading as it stands at `ms`: every patch of the new round walked from where it was (or grown from
  // nothing), and every patch the round dropped faded away at its old place until there is nothing of it left.
  const blend = (ms) => {
    const k = along(ms), out = [];
    for (const [seed, p] of next) out.push(smokeBetween(was.get(seed) ?? null, p, k));
    for (const [seed, p] of was) if (!next.has(seed)) out.push(smokeBetween(p, null, k));
    return out.filter((p) => p && p.tone > 0.002 && p.r > 0.5);
  };
  // The bodies as they stand at `ms`: every square's weight walked up from nothing or down to it, its outline held
  // still, as the fence it stands for is held still.
  const bodies = (ms) => {
    const k = along(ms), out = [];
    for (const [id, s] of nextSheets) out.push(smokeSheetAt(wasSheets.get(id) ?? null, s, k));
    for (const [id, s] of wasSheets) if (!nextSheets.has(id)) out.push(smokeSheetAt(s, null, k));
    return out.filter((s) => s && s.grow > 0.004);
  };
  // In order, because the order IS the look: the whole smoking floor as one light wash, then the thick squares as one
  // dark mass inside it, then the stepped brush patches that keep a filled room from reading as a flat rectangle,
  // then the ink along each body's real boundary and nowhere else — a seam between two full squares is invisible,
  // which is what makes a filled room one body instead of a scatter of lumps.
  const paint = (ms) => {
    if (!art) return;
    art.clear();
    const k = (grid() || 100) / 100, sheets = bodies(ms);
    for (const kind of ["haze", "core"]) {
      for (const s of sheets) {
        if (s.kind !== kind) continue;
        const deep = (s.tone - THIN_TOP) / Math.max(1e-6, 1 - THIN_TOP);
        const alpha = kind === "haze" ? HAZE_ALPHA : CORE_ALPHA + (CORE_ALPHA_TOP - CORE_ALPHA) * Math.min(1, Math.max(0, deep));
        const colour = kind === "haze" ? GREYS[0] : GREYS[Math.max(0, Math.min(GREYS.length - 1, Math.round(s.tone * TONE_STEPS) - 1))];
        art.beginFill(colour, alpha * s.grow).drawPolygon(s.pts).endFill();
      }
    }
    for (const p of blend(ms)) {
      const q = smokeSway(p, ms), rand = seededRandom((q.seed >>> 0) || 1);
      const ring = (scale, wobble) => {
        const pts = [];
        for (let i = 0; i < RAGS; i++) {
          const a = (i / RAGS) * Math.PI * 2, rr = q.r * scale * (1 - wobble / 2 + rand() * wobble);
          pts.push(q.x + Math.cos(a) * rr, q.y + Math.sin(a) * rr * 0.82);
        }
        return pts;
      };
      const step = Math.max(0, Math.min(GREYS.length - 1, Math.round(q.tone * TONE_STEPS) - 1));
      art.beginFill(GREYS[Math.max(0, step - 1)], 0.07 + 0.13 * q.tone).drawPolygon(ring(1, 0.34)).endFill();
      art.beginFill(GREYS[step], 0.1 + 0.26 * q.tone).drawPolygon(ring(0.6, 0.4)).endFill();
    }
    for (const s of sheets) {
      const ink = s.kind === "core" ? 0.5 : 0.3, width = (s.kind === "core" ? 2.2 : 1.6) * k;
      art.lineStyle(width, SMOKE_INK, ink * s.grow);
      for (const rim of s.rims) {
        art.moveTo(rim[0], rim[1]);
        for (let i = 2; i < rim.length; i += 2) art.lineTo(rim[i], rim[i + 1]);
      }
      art.lineStyle(0);
    }
  };
  // The sway never settles, so unlike the fire's pulse this loop runs for as long as there is smoke; it is held down
  // to SMOKE_FRAME_MS, and it stops the moment the last of the cloud has faded out.
  const tick = () => {
    const ms = Number(now()) || 0;
    if (ms - drawnAt >= SMOKE_FRAME_MS || ms < drawnAt) { drawnAt = ms; paint(ms); }
    const living = next.size > 0 || nextSheets.size > 0 || along(ms) < 1;
    raf = living ? requestAnimationFrame(tick) : 0;
    if (!living) { was = new Map(); wasSheets = new Map(); art?.clear(); }
  };
  return {
    sync({ sheets = [], puffs = [] } = {}) {
      if (!ensure()) return;
      const list = (puffs ?? []).filter((p) => p && [p.x, p.y, p.r, p.tone].every(Number.isFinite) && p.tone > 0 && p.r > 0);
      const body = (sheets ?? []).filter((s) => s && Array.isArray(s.pts) && s.pts.length >= 6 && s.pts.every(Number.isFinite) && Number.isFinite(s.tone));
      const key = [body.map((s) => `${s.kind}:${s.i}:${s.tone}:${s.pts.length}`).join("|"),
        list.map((p) => `${p.seed}:${Math.round(p.x)},${Math.round(p.y)},${Math.round(p.r)},${p.tone}`).join("|")].join("#");
      const ms = Number(now()) || 0;
      if (key !== shown) {
        // Whatever is on screen right now becomes the place this drift starts from, so a round landing while the last
        // one is still walking carries on from where the cloud has got to and never snaps back.
        was = new Map(blend(ms).map((p) => [p.seed, p]));
        wasSheets = new Map(bodies(ms).map((s) => [`${s.kind}:${s.i}`, s]));
        next = new Map(list.map((p) => [p.seed, p]));
        nextSheets = new Map(body.map((s) => [`${s.kind}:${s.i}`, { ...s, rims: s.rims ?? [] }]));
        startedAt = ms;
        shown = key;
      }
      if ((next.size || was.size || nextSheets.size || wasSheets.size) && !raf) raf = requestAnimationFrame(tick);
    },
    clear() {
      cancelAnimationFrame(raf); raf = 0; drawnAt = -Infinity;
      was = new Map(); next = new Map(); wasSheets = new Map(); nextSheets = new Map(); startedAt = 0; shown = "";
      try { art?.clear(); box?.destroy({ children: true }); } catch { /* gone */ }
      box = null; art = null;
    },
  };
}
