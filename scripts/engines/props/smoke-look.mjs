// What the smoke a fire fills a room with looks like on the map, for everyone: painted stepped grey puffs standing in
// the very cells the active GM wrote, drifting from the round just gone to the round just written instead of jumping
// from one to the next. Read from the stored cells alone, so every screen paints the same cloud; painted (ink outline,
// stepped tones), never a pale disc and never a blur filter.
// The picking, the tones, the drift and the sway are all pure and seeded; only createSmokeLooks touches PIXI, and its
// clock is handed in, as createFireLooks takes it, so nothing in here reads one.
// The smoke's EDGES are deliberately not here. The sight-blocking fence (smoke-fence.mjs) stands on the round
// boundary and does not move with the drawing: a blocker that moved mid-round would pop the fog and rebuild every
// client's vision every frame. The cloud drifts; what it blocks does not.
import { seededRandom } from "../fragments/fragments.mjs";
import { smokeTier, THICK, THIN, DENSITY_CAP } from "./smoke-field.mjs";

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

// How many puffs a cell is painted with: a wisp or two of thin smoke, a cluster of thick.
const puffCount = (tone) => 1 + Math.round(tone * TONE_STEPS);

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
 * The painted cloud of a stored smoke field: one puff list, pure and seeded.
 * `cells` are [{i, v}] (smoke-edges.mjs smokeCellList over the saved map); `cols`, `origin` and `cell` are the
 * geometry those indices were WRITTEN with (storedSmokeGrid), never the scene's current grid; `seed` is the scene's
 * own (smokeSeedOf), so two scenes do not wear the same brush.
 * Each puff is {x, y, r, tone, seed}: where it stands, how wide, which grey step, and its own name — the name is what
 * the drift follows a puff by from one round to the next, so a puff that stayed put walks instead of jumping.
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
      out.push({
        x: cx + (rand() - 0.5) * size * 0.6,
        y: cy + (rand() - 0.5) * size * 0.6,
        r: size * (0.2 + 0.1 * rand()) * (0.8 + 0.5 * tone),
        tone,
        seed: mix(base, k + 1),
      });
    }
  }
  return out;
}

// How long the cloud takes to walk from the round just gone to the round just written. A round is six seconds, so
// this is well inside one: the smoke has settled where it was written long before the next round moves it again.
export const SMOKE_DRIFT_MS = 2200;
// A puff never stands quite still: it turns slowly on its own little circle, so a room whose smoke is not changing
// still breathes. Seeded from the puff and read off the shared clock, so it turns in step on every screen.
export const SMOKE_SWAY_MS = 7000;
// How far it turns, as a share of its own radius: inside its own cell, so the sway never carries smoke through a wall.
export const SMOKE_SWAY = 0.18;

const lerp = (a, b, k) => a + (b - a) * k;

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
 * One smoke per scene, not two layered: where the GM has ticked the scene's own "Fires fill rooms with smoke", the
 * simulated smoke is the scene's smoke and the haze stands down entirely. A scene that wants only the atmosphere
 * leaves that switch off and loses nothing — this is exactly today's answer with `fills` false.
 * `on` is the settings pair, `underground` whether the scene is one, `fills` the scene's own new switch. Pure.
 */
export const airHazeShows = ({ on = false, underground = false, fills = false } = {}) =>
  on === true && underground === true && fills !== true;

// ---- The painted look. Only this part touches PIXI. ----

const SMOKE_INK = 0x14151a;
// The four painted steps of grey, light to dark: one per tone step.
const GREYS = [0x9aa0a6, 0x7b8086, 0x5c6066, 0x41444a];
// At most this often, however fast the screen runs. The cloud drifts slowly, so twelve frames a second is smoke and
// not a cost; a room full of thick smoke is hundreds of puffs.
export const SMOKE_FRAME_MS = 80;
// How many points a puff's ragged outline is drawn with. A painted patch, never a circle.
const RAGS = 11;

/**
 * The painted smoke on the map. `layer()` gives the container it is drawn in, `grid()` the square size (the ink line
 * keeps its weight whatever the map's scale) and `now()` the shared clock the drift and the sway are read from, so
 * every screen is at the same point in both.
 * sync({puffs}) is given the whole cloud as it stands now (smokePuffs over the stored cells). A cloud that is not the
 * one already shown starts a drift from whatever is on screen to this one; the same cloud again leaves it alone.
 * clear() takes the layer away, for canvasTearDown.
 */
export function createSmokeLooks({ PIXI, layer, grid = () => 100, now = () => 0 }) {
  let box = null, art = null, raf = 0, drawnAt = -Infinity;
  let was = new Map(), next = new Map(), startedAt = 0, shown = "";
  const ensure = () => {
    const root = layer?.();
    if (!root) return null;
    if (!box || box.destroyed) { box = new PIXI.Container(); art = new PIXI.Graphics(); box.addChild(art); }
    if (box.parent !== root) root.addChild(box);
    return box;
  };
  // How far along the drift the clock now stands, 0-1.
  const along = (ms) => (SMOKE_DRIFT_MS > 0 ? Math.min(1, Math.max(0, (ms - startedAt) / SMOKE_DRIFT_MS)) : 1);
  // The cloud as it stands at `ms`: every puff of the new round walked from where it was (or grown from nothing),
  // and every puff the round dropped faded away at its old place until there is nothing of it left.
  const blend = (ms) => {
    const k = along(ms), out = [];
    for (const [seed, p] of next) out.push(smokeBetween(was.get(seed) ?? null, p, k));
    for (const [seed, p] of was) if (!next.has(seed)) out.push(smokeBetween(p, null, k));
    return out.filter((p) => p && p.tone > 0.002 && p.r > 0.5);
  };
  // One puff: a ragged painted patch in two steps — a wide pale one with a darker one inside it — under a thin ink
  // outline, as the fire's scorch and flames are painted. Its raggedness is seeded from its own name, so the same
  // puff is the same shape on every screen and keeps that shape as it drifts.
  const paint = (ms) => {
    if (!art) return;
    art.clear();
    const k = (grid() || 100) / 100;
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
      const outer = ring(1, 0.34), inner = ring(0.6, 0.4);
      art.beginFill(GREYS[Math.max(0, step - 1)], 0.1 + 0.34 * q.tone).drawPolygon(outer).endFill();
      art.beginFill(GREYS[step], 0.14 + 0.44 * q.tone).drawPolygon(inner).endFill();
      art.lineStyle(1.2 * k, SMOKE_INK, 0.14 + 0.2 * q.tone).drawPolygon(outer);
      art.lineStyle(0);
    }
  };
  // The sway never settles, so unlike the fire's pulse this loop runs for as long as there is smoke; it is held down
  // to SMOKE_FRAME_MS, and it stops the moment the last of the cloud has faded out.
  const tick = () => {
    const ms = Number(now()) || 0;
    if (ms - drawnAt >= SMOKE_FRAME_MS || ms < drawnAt) { drawnAt = ms; paint(ms); }
    const living = next.size > 0 || along(ms) < 1;
    raf = living ? requestAnimationFrame(tick) : 0;
    if (!living) { was = new Map(); art?.clear(); }
  };
  return {
    sync({ puffs = [] } = {}) {
      if (!ensure()) return;
      const list = (puffs ?? []).filter((p) => p && [p.x, p.y, p.r, p.tone].every(Number.isFinite) && p.tone > 0 && p.r > 0);
      const key = list.map((p) => `${p.seed}:${Math.round(p.x)},${Math.round(p.y)},${Math.round(p.r)},${p.tone}`).join("|");
      const ms = Number(now()) || 0;
      if (key !== shown) {
        // Whatever is on screen right now becomes the place this drift starts from, so a round landing while the last
        // one is still walking carries on from where the cloud has got to and never snaps back.
        was = new Map(blend(ms).map((p) => [p.seed, p]));
        next = new Map(list.map((p) => [p.seed, p]));
        startedAt = ms;
        shown = key;
      }
      if ((next.size || was.size) && !raf) raf = requestAnimationFrame(tick);
    },
    clear() {
      cancelAnimationFrame(raf); raf = 0; drawnAt = -Infinity;
      was = new Map(); next = new Map(); startedAt = 0; shown = "";
      try { art?.clear(); box?.destroy({ children: true }); } catch { /* gone */ }
      box = null; art = null;
    },
  };
}
