// When a fire's round comes round, which scenes it burns on, which walls stand between its sources and what they heat,
// and the grass squares a region holds. Pure: no Foundry, no globals, no clocks of its own.

// How long a round lasts out of combat (a round of play), in ms. In combat the tracker's round is what counts.
export const FIRE_PERIOD = 6000;

// Whether a new round is due. In combat (combat.started) a round comes from the tracker: the combat's round is past the
// one the last tick ran on. Out of combat it comes from the clock: `period` ms have passed since the last tick (`last.at`).
// A fire that has never ticked (no `last`) is due at once.
export function fireRoundDue({ combat = null, now = 0, last = null, period = FIRE_PERIOD } = {}) {
  if (combat?.started === true) {
    const round = Number(combat.round);
    if (!Number.isFinite(round)) return false;
    return !Number.isFinite(last?.round) || round > Number(last.round);
  }
  const at = Number(last?.at);
  if (!Number.isFinite(at)) return true;
  const gap = Number(period) > 0 ? Number(period) : FIRE_PERIOD;
  return Number(now) - at >= gap;
}

// What a scene remembers after a tick, and what it is seeded with when this screen first takes the fires over (a
// reload, a handover, a scene just switched on): the round the tracker stands on now, or only the time when no
// combat is running. The old combat's round is never carried past its end, so the next combat's round 1 is a new
// round and not one already run; and a seeded scene is not due again until its next round really comes, so a reload
// or a handover never costs a fire a round of its life.
export function fireNextLast({ combat = null, now = 0 } = {}) {
  const at = Number(now) || 0;
  return combat?.started === true && Number.isFinite(Number(combat.round)) ? { round: Number(combat.round), at } : { at };
}

// The scenes a fire round runs on: only for the active GM (nobody else writes), and only scenes with both switches on
// (Breakable props and Fire spreads).
export function fireScenesOf(scenes, { activeGM = false } = {}) {
  if (activeGM !== true) return [];
  return (scenes ?? []).filter((s) => s?.flags?.animater?.breakableProps === true && s?.flags?.animater?.fireSpreads === true);
}

const centreOf = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
// The gap between two rectangles, edge to edge: 0 when they touch or overlap (fire-spread.mjs's own measure).
const edgeGap = (a, b) => Math.hypot(Math.max(0, a.x - (b.x + b.w), b.x - (a.x + a.w)), Math.max(0, a.y - (b.y + b.h), b.y - (a.y + a.h)));

// Whether the segment from `from` to `to` crosses a wall. `walls` are {c: [x1, y1, x2, y2]} (already filtered to the
// ones that stop fire: blockingWalls). A line that only touches a wall's end counts as crossing it, so fire never
// slips through the join between two walls.
export function wallBetween(from, to, walls) {
  const dx = to.x - from.x, dy = to.y - from.y;
  if (!dx && !dy) return false;
  for (const w of walls ?? []) {
    const c = w?.c;
    if (!Array.isArray(c) || c.length !== 4 || !c.every(Number.isFinite)) continue;
    const ex = c[2] - c[0], ey = c[3] - c[1], den = dx * ey - dy * ex;
    if (!den) continue; // parallel: a wall along the line never cuts it
    const t = ((c[0] - from.x) * ey - (c[1] - from.y) * ex) / den;
    const u = ((c[0] - from.x) * dy - (c[1] - from.y) * dx) / den;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return true;
  }
  return false;
}

// Which fire sources a wall cuts each target off from: the `blocked` list fire-spread.mjs reads.
// `targets` and `sources` are {key, rect} and {id, rect} (a source may be a prop or a grass square: whatever id the
// step functions will name it by). Only pairs within `reach` px of each other are tested, since fire reaches no further,
// and a target is never blocked from itself. Returns a Map of target key -> source ids, with no entry for a clear one.
export function blockedLists({ targets = [], sources = [], walls = [], reach = Infinity } = {}) {
  const out = new Map();
  if (!walls?.length || !sources.length) return out;
  for (const target of targets) {
    if (!target?.rect) continue;
    const to = centreOf(target.rect), list = [];
    for (const src of sources) {
      if (!src?.rect || src.id === target.key) continue;
      if (edgeGap(src.rect, target.rect) > reach) continue;
      if (wallBetween(centreOf(src.rect), to, walls)) list.push(src.id);
    }
    if (list.length) out.set(target.key, list);
  }
  return out;
}

// The grass squares of a shape: a grid of `cell` px squares over `bounds` ({x, y, w, h}), keeping those whose middle
// `inside` accepts. The origin is snapped to a multiple of the cell size, so the same shape and the same grid always
// give a square the same index (the indices are saved as flag keys, and a rebuilt grid must line up with them).
// `cap` is the most squares to lay out; a shape bigger than that gets none, rather than a grid nobody can afford.
// Returns {cols, rows, origin, indices}.
export function grassCells({ bounds, cell = 100, inside = () => true, cap = 4000 } = {}) {
  const size = Number(cell) > 0 ? Number(cell) : 100;
  const none = { cols: 0, rows: 0, origin: { x: 0, y: 0 }, indices: [] };
  if (!bounds || ![bounds.x, bounds.y, bounds.w, bounds.h].every(Number.isFinite) || bounds.w <= 0 || bounds.h <= 0) return none;
  const origin = { x: Math.floor(bounds.x / size) * size, y: Math.floor(bounds.y / size) * size };
  const cols = Math.ceil((bounds.x + bounds.w - origin.x) / size), rows = Math.ceil((bounds.y + bounds.h - origin.y) / size);
  if (cols <= 0 || rows <= 0 || cols * rows > cap) return none;
  const indices = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const at = { x: origin.x + (c + 0.5) * size, y: origin.y + (r + 0.5) * size };
      if (inside(at)) indices.push(r * cols + c);
    }
  }
  return { cols, rows, origin, indices };
}

const named = (name) => String(name || "prop").trim().toLowerCase();
// What the GM is whispered when something starts to smoulder. The name is the prop's own, as the GM reads it.
export const fireWarning = (name) => `The fire is spreading toward the ${named(name)}.`;
// What the GM is whispered when a fire runs out on something its flames cannot break (a stone chest whose books
// burned): the ground is scorched, the thing itself still stands.
export const fireBurnedOut = (name) => `The fire burns out: the ${named(name)} is scorched but still stands.`;
