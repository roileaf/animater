// A room's smoke as the indoor air simulation takes it. The GM's round writes a density per grid cell into the scene;
// this turns those cells into the simulation's sources (what keeps making smoke) and its priming (what already hangs
// there), and says how long a clock step may be. Pure: no Foundry, no clock of its own.
import { THICK, DROP_FLOOR } from "./smoke-field.mjs";

// The density that counts as a full cell of air: a cell this thick makes smoke at the preset's full rate and primes the
// air to full. Thicker is no more than full.
export const AIR_FULL = THICK;

// How a room's smoke moves, between the fire (SMOKE_AIR: spreads and streams hard, made fast) and the mist (MIST_AIR:
// slow, thin). A cellar's smoke is heavier than mist, so it runs faster along the draft, yet a room of many source
// cells makes far more than one fire did, so each makes less. `wide` is 0: a stored cell is its own source and
// nothing else (overlapping squares would sum their weights and pile up). The door's swing pushes it as it does mist.
export const ROOM_AIR = { spread: 1.0, run: 1.6, fade: 0.012, made: 0.22, gain: 1.3, wide: 0, ease: 4, shove: 2 };

// The middle of a stored cell, in scene pixels, worked out as smoke-plume.mjs does: origin + (i % cols + 0.5) * cell.
// Null for an index that is not a cell of the grid.
function centreOf(index, { cols, cell, origin } = {}) {
  const i = Number(index), wide = Number(cols), size = Number(cell);
  if (!Number.isInteger(i) || i < 0 || !(wide >= 1) || !(size > 0)) return null;
  const ox = Number(origin?.x) || 0, oy = Number(origin?.y) || 0;
  return { x: ox + ((i % wide) + 0.5) * size, y: oy + (Math.floor(i / wide) + 0.5) * size };
}

// Each stored cell as a source: [{ x, y, w }], w the share of a full cell's make rate (0–1). Wisps at or under the drop
// floor make nothing, and a cell whose middle falls off the air's field is dropped. `field` { x, y, cols, rows, cell }.
export function airSourcesOf(cells, geo, field) {
  const out = [];
  for (const [key, density] of Object.entries(cells ?? {})) {
    const d = Number(density);
    if (!(d > DROP_FLOOR)) continue;
    const at = centreOf(key, geo);
    if (!at) continue;
    const i = Math.floor((at.x - field.x) / field.cell), j = Math.floor((at.y - field.y) / field.cell);
    if (!(i >= 0 && j >= 0 && i < field.cols && j < field.rows)) continue;
    out.push({ x: at.x, y: at.y, w: Math.min(1, d / AIR_FULL) });
  }
  return out;
}

// The same cells as smoke already hanging in the air: [{ x, y, v }], v 0–1, for the simulation's prime().
export function airPrimeOf(cells, geo) {
  const out = [];
  for (const [key, density] of Object.entries(cells ?? {})) {
    const d = Number(density);
    if (!(d > DROP_FLOOR)) continue;
    const at = centreOf(key, geo);
    if (at) out.push({ x: at.x, y: at.y, v: Math.min(1, d / AIR_FULL) });
  }
  return out;
}

// Seconds to step the air between two clock readings (ms), never more than `cap`: a clock that stood still or went back
// steps nothing, and a tab asleep for minutes catches up by the cap rather than replaying them.
export function airStepSeconds(lastMs, nowMs, { cap = 6 } = {}) {
  const gap = (Number(nowMs) - Number(lastMs)) / 1000;
  return gap > 0 ? Math.min(cap, gap) : 0;
}

// Whether the indoor air is worked out on this map at all. The draft on its own is wanted underground, or wherever a
// region opens onto the outside — air only moves where it has somewhere to go. A room's smoke wants it too, so it is
// worked out as a sim rather than repainted once a round. What the reader gets differs by scene. With a draft (underground,
// or a region that opens outside) the smoke is carried to the way out and drains through it. On a surface map with no
// opening seeded (sceneOpenings seeds only an open door at the scene's edge or an opensOutside region) the draft field has
// no seeds, so nothing pulls the smoke out of the room: it spreads, obeys walls and shut doors, and a door opening shoves
// it through, but the billows roll in place. With the Drafts switch off nothing is worked out.
export function airWantedFor({ drafts = false, underground = false, opensOutside = false, roomSmoke = false } = {}) {
  return drafts === true && (underground === true || opensOutside === true || roomSmoke === true);
}
