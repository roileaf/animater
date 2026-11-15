// When a fire's round comes round, which scenes it burns on, what a fire area sets alight, which walls stand between
// its sources and what they heat, and the grass squares a region holds. Pure: no Foundry, no globals, no clocks.
import { fireRate, readFire, decorFireOf, fireCellsOf, HEAT_CATCH, BURN_ROUNDS, CELL_ROUNDS } from "./fire-spread.mjs";

// What a fire area does to one thing it covers, with Fire spreads on: it sets alight whatever will take fire
// instead of breaking it outright (it then burns its rounds and chars, which is the whole feature), and leaves
// everything else to break exactly as it always has. The fire to write, or null for "break it as before":
//   - Fire spreads off, or the cause is not a fire area: null, so nothing anywhere changes while the switch is off.
//   - Black powder: null. A keg set off by fire goes off; it does not sit and smoulder.
//   - Nothing that takes fire (fireRate 0: stone, metal, water in it): null, it breaks as before.
//   - Already alight: null, and the break rules refuse it as they always did.
// A thing that takes fire only by what it holds (a stone chest of books) catches too, though its own material would
// never break: that is the point of the feature, and the round ticker rules what is left of it when the fire is out.
export function areaCatch({ fireSpreads = false, kind = "", damageType = "", traits = null, fire = null } = {}) {
  if (fireSpreads !== true || kind !== "area" || damageType !== "fire") return null;
  if (traits?.contents === "powder" || !(fireRate(traits) > 0) || fire?.burning === true) return null;
  return { heat: HEAT_CATCH, burning: true, roundsLeft: BURN_ROUNDS };
}

// What a fire area does to one square of grass it covers, the counterpart of areaCatch: in a region whose ground
// burns, the fire area lights the square itself, so a fireball over an open meadow starts a grass fire even where
// there is not a prop in sight. The fire to write, or null for "nothing here":
//   - Fire spreads off, or the cause is not a fire area: null (with the switch off nothing anywhere changes).
//   - A region whose ground does not burn (its Burns switch, else its floor): null.
//   - A square already alight, or charred for good: null.
export function areaCellCatch({ fireSpreads = false, kind = "", damageType = "", burns = false, cell = null } = {}) {
  if (fireSpreads !== true || kind !== "area" || damageType !== "fire" || burns !== true) return null;
  if (cell?.charred === true || readFire(cell)?.burning === true) return null;
  return { heat: HEAT_CATCH, burning: true, roundsLeft: CELL_ROUNDS };
}

// Which grass squares a fire area sets alight, as region updates ready for updateEmbeddedDocuments. `regions` are
// {id, burns, cells: [{i, point, saved}]} — each region's own squares, with the fire each already has saved and the
// middle of each square for the area to be asked about. `inArea(point)` is the area's own shape test, on the GM's
// screen. Foundry merges object flags, so each square is written at its own path (`<flag>.<index>`), never as a
// whole object. Returns {regions, lit}: the updates, and the squares lit, so the caller knows whether to write.
export function areaCellsLit({ regions = [], inArea = null, fireSpreads = false, kind = "area", damageType = "" } = {}) {
  const updates = [], lit = [];
  if (typeof inArea !== "function") return { regions: updates, lit };
  for (const r of regions ?? []) {
    if (typeof r?.id !== "string") continue;
    const fields = {};
    for (const c of r.cells ?? []) {
      if (!Number.isInteger(c?.i)) continue;
      const next = areaCellCatch({ fireSpreads, kind, damageType, burns: r.burns === true, cell: c.saved });
      if (!next) continue;
      let inside = false;
      try { inside = inArea(c.point) === true; } catch { inside = false; }
      if (!inside) continue;
      fields[`flags.animater.fireCells.${c.i}`] = next;
      lit.push({ regionId: r.id, i: c.i });
    }
    if (Object.keys(fields).length) updates.push({ _id: r.id, ...fields });
  }
  return { regions: updates, lit };
}

// Whether a scene has any fire alive on it at all, read from nothing but what is stored: a tile's own fire, a
// region's burning decorations, and its grass squares still alight (a charred one is out for good). `spills` is how
// many broken props are burning (a lamp-oil fire counts as a burning prop), which the caller counts from its fire
// lights. This is the cheap look before a round: with every fire cold there is nothing to lay out and nothing to
// write, and a scene nobody is even looking at costs the GM a walk over its tiles and regions, no more.
export function fireAwake({ tiles = [], regions = [], spills = 0 } = {}) {
  if (Number(spills) > 0) return true;
  for (const doc of tiles ?? []) if (readFire(doc)?.burning === true) return true;
  for (const doc of regions ?? []) {
    for (const entry of Object.values(decorFireOf(doc))) if (readFire(entry)?.burning === true) return true;
    for (const entry of Object.values(fireCellsOf(doc))) if (entry?.charred !== true && readFire(entry)?.burning === true) return true;
  }
  return false;
}

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

// The remembered counts after a combat begins or ends anywhere: every scene re-seeded from its OWN combat
// (`combatOf(sceneId)`), keeping the time it last ran on. A combat on one scene never drops another scene's round,
// which would hand that scene a free round in the middle of its own combat.
export function fireReseed(lasts, { combatOf = () => null, now = 0 } = {}) {
  const out = new Map();
  for (const [id, last] of lasts ?? []) out.set(id, { ...fireNextLast({ combat: combatOf(id), now }), at: Number(last?.at) || Number(now) || 0 });
  return out;
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

