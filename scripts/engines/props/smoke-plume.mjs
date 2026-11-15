// The smoke seen leaving a room: a plume at each opening, pouring out of the doorway and thinning away on the air.
//
// This is a DRAWING, not a simulation. The field inside the room is real — it is stepped, stored and it blocks
// sight — but the air outside is not modelled at all: smoke that vents is gone from the model the moment it leaves
// (smoke-round.mjs drops every cell that is not indoors). What was wrong with that was not the physics, which is a
// fair approximation of a room emptying, but that a GM watching a burning cellar saw smoke stop dead at the open
// door, as though the doorway were glass. So the plume is painted from what the round already knows: which cells
// are openings, which way out they face, and how thick the smoke is at them.
//
// Pure: given the same vents, clock and seed it lays out the same puffs on every screen, so two players looking at
// one doorway see one plume. No Foundry, no dice, no state of its own.

// How long one puff lives, and how often a vent lets one go at full thickness. A thinner vent breathes more slowly,
// never faster, so a room with a crack in it trails smoke while one with its door off pours.
const PUFF_MS = 4200;
const GAP_MS = 520;
// A puff starts about a third of a square across and swells to a bit over one, which is wide enough to read as
// smoke and narrow enough that a doorway's plume does not cover the wall either side of it.
const BORN = 0.34, GROWN = 1.15;
// How far a puff travels from its doorway in its life, in squares, before the wind is added.
const REACH = 2.6;
// A puff fades in over the first tenth of its life and out over the last two-fifths, so nothing pops.
const FADE_IN = 0.1, FADE_OUT = 0.4;
// The most of its vent's density a puff is ever painted at. Smoke on the open air is thinner than the same smoke
// in a closed room, and a plume that matched the room's own darkness looked like a wall falling out of the door.
const DEEPEST = 0.42;
// How far the wind carries a puff over its life, in squares at wind 1, added to its own way out.
const WIND_REACH = 3.2;
// A vent with no way out of its own (a hole in the roof) rises instead of running: its puffs grow faster and go
// nowhere, which on a map drawn from above is what rising smoke looks like.
const RISEN = 1.5;

// The seeded wobble, so one doorway's puffs do not file out in a straight line like beads on a string.
// mulberry32 on the vent's cell and the puff's number: the same two always give the same wobble.
const wobbleOf = (seed, i, n) => {
  let a = (((seed >>> 0) + Math.imul(i, 0x9e3779b9) + Math.imul(n, 0x85ebca6b)) >>> 0) + 0x6d2b79f5;
  a = Math.imul(a ^ (a >>> 15), 1 | a);
  a ^= a + Math.imul(a ^ (a >>> 7), 61 | a);
  return (((a ^ (a >>> 14)) >>> 0) / 4294967296) * 2 - 1;
};

/**
 * The puffs of every plume as they stand at one moment: `[{ x, y, r, alpha }]` in map pixels, furthest-along last.
 *
 *   vents  [{ i, dx, dy, v }] as the round stored them (smoke-round.mjs smokeVentList).
 *   cols, cell, origin   the grid the vents are indexed against — the one the CELLS were written with.
 *   now    the shared clock in ms, so every screen is at the same point in every plume.
 *   seed   the scene's own seed, so one map's plumes differ from the next's.
 *   wind   { x, y } in squares a second-ish, 0..1 each way; omitted, the air is still.
 *   max    the most puffs to lay out at once, so a map with a dozen doorways cannot flood the screen.
 *
 * A vent whose density is at or under `floor` lays out nothing: an opening with a wisp at it is not a plume.
 */
export function plumePuffs(vents = [], { cols, cell = 100, origin = { x: 0, y: 0 }, now = 0, seed = 1,
  wind = null, max = 240, floor = 0.08 } = {}) {
  const out = [];
  const size = Number(cell) > 0 ? Number(cell) : 100;
  const wide = Number.isInteger(Number(cols)) && Number(cols) > 0 ? Number(cols) : 1;
  const ox = Number(origin?.x) || 0, oy = Number(origin?.y) || 0;
  const time = Number(now) || 0;
  const root = (Number(seed) >>> 0) || 1;
  const wx = Number(wind?.x) || 0, wy = Number(wind?.y) || 0;
  for (const vent of vents ?? []) {
    const i = Number(vent?.i), v = Number(vent?.v);
    if (!Number.isInteger(i) || i < 0 || !(v > floor)) continue;
    const dx = Number(vent?.dx) || 0, dy = Number(vent?.dy) || 0;
    const rises = !(Math.abs(dx) > 0 || Math.abs(dy) > 0);
    // The middle of the vent's own square, which is where the doorway is.
    const fromX = ox + ((i % wide) + 0.5) * size, fromY = oy + (Math.floor(i / wide) + 0.5) * size;
    // A thicker vent breathes faster, down to a trickle at the floor. Capped so a capped room cannot outrun PUFF_MS
    // and leave the plume a solid bar.
    const gap = GAP_MS / Math.max(0.25, Math.min(1, v / 2));
    const alive = Math.max(1, Math.ceil(PUFF_MS / gap));
    // Which puffs are in the air now: the newest is the one just let go, and we walk back through its elders.
    const newest = Math.floor(time / gap);
    for (let k = 0; k < alive && out.length < max; k++) {
      const n = newest - k;
      const age = (time - n * gap) / PUFF_MS;
      if (!(age >= 0 && age < 1)) continue;
      // Across the way out, so the puffs leave the doorway in a spread rather than a line.
      const sway = wobbleOf(root, i, n) * 0.45;
      const far = REACH * age * (rises ? 0.25 : 1);
      const drift = { x: wx * WIND_REACH * age, y: wy * WIND_REACH * age };
      const x = fromX + (dx * far - dy * sway + drift.x) * size;
      const y = fromY + (dy * far + dx * sway + drift.y) * size;
      const grow = BORN + (GROWN - BORN) * age * (rises ? RISEN : 1);
      const fade = age < FADE_IN ? age / FADE_IN : (age > 1 - FADE_OUT ? (1 - age) / FADE_OUT : 1);
      // Scaled by how thick the vent is, and capped at DEEPEST however thick it gets: a capped room pouring out of
      // its door is still smoke on the open air, not the wall of the room following it out.
      const alpha = DEEPEST * Math.min(1, v / 2) * fade;
      if (!(alpha > 0.01)) continue;
      out.push({ x, y, r: (grow * size) / 2, alpha });
    }
  }
  // Youngest first so the oldest, widest puffs are painted over by the ones still leaving the door, which is the
  // way a plume really stacks: what is nearest the opening is what is densest.
  out.sort((a, b) => b.r - a.r);
  return out;
}
