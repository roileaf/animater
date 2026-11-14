// One round of room smoke, as a decision: a plain scene view in, the scene update and the region's shapes out.
// Pure — no Foundry globals, no document writes, no clock, no randomness. The caller (main.mjs, the active GM) looks
// the scene up, says what is indoors and where the walls are, then applies what comes back.
//
// The pieces this leans on are already built: smokeStep is the simulation, smokeUpdatesFor turns a step into the
// scene's keyed flag writes (its own `-=` deletes included), and smokeGridOf is the one grid the cells are indexed
// with, which the sight-blocking fence reads them back against.
import { smokeStep, smokeUpdatesFor, smokeCellsOf, smokeKeysOf, THIN } from "./smoke-field.mjs";
import { smokeGridOf, smokeCellList, storedSmokeGrid, SMOKE_GRID_FLAG } from "./smoke-edges.mjs";

const FLAG = "flags.animater";
const LEVEL_ID = /^[a-zA-Z0-9]{16}$/;

// The four cells touching this one, inside the grid.
export function smokeNeighbours(i, cols, rows) {
  const col = i % cols, row = (i - col) / cols, out = [];
  if (col > 0) out.push(i - 1);
  if (col + 1 < cols) out.push(i + 1);
  if (row > 0) out.push(i - cols);
  if (row + 1 < rows) out.push(i + cols);
  return out;
}

// The most cells one room's walk will ever visit. A walk over a whole cave every few seconds is far too much, so
// past this the fill gives up and says so.
export const ROOM_CAP = 1200;

// The room a cell sits in, as {id, size}: everything reachable from it without crossing a wall and without stepping
// outside, named by the room's own lowest cell so every cell of one room answers to the same name, and counted so
// the venting can be a share of it. `cache`, when given, is a Map the caller keeps between rounds: every cell of the
// fill is written into it, so the rest of the room costs nothing.
//
// A fill that reaches `cap` gives up there and answers with ONE shared name for every truncated fill of that grid,
// so the pieces of a space too big to walk are still a single room. This matters: cross-room pairs are blocked, so
// a fill that split a great cave into named pieces would stop the smoke dead at a seam that is not there. The price
// is that the vent then divides by the cap instead of the true size — an enormous cave vents a little too hard,
// which is a number being wrong rather than a wall that does not exist.
export function smokeRoomAt({ from, cols, rows, indoors = () => true, walled = () => false, cap = ROOM_CAP, cache = null } = {}) {
  const kept = cache?.get(from);
  if (kept) return kept;
  const seen = new Set([from]), queue = [from];
  while (queue.length && seen.size < cap) {
    const i = queue.pop();
    for (const n of smokeNeighbours(i, cols, rows)) {
      if (seen.size >= cap) break;
      if (seen.has(n) || !indoors(n) || walled(i, n)) continue;
      seen.add(n);
      queue.push(n);
    }
  }
  const own = seen.size >= cap ? { id: `${cols}:big`, size: cap } : { id: `${cols}:${Math.min(...seen)}`, size: seen.size };
  if (cache) for (const i of seen) cache.set(i, own);
  return own;
}

// The smoke as the fewest rectangles: each row's run of touching cells is one. Thin smoke counts, since thin smoke is
// what the concealment region is for; thick smoke is thin smoke and more.
export function smokeShapes(cells, { cols, cell, origin }) {
  const byRow = new Map();
  for (const c of cells ?? []) {
    if (!(c.v >= THIN)) continue;
    const col = c.i % cols, row = (c.i - col) / cols;
    if (!byRow.has(row)) byRow.set(row, []);
    byRow.get(row).push(col);
  }
  const out = [];
  for (const [row, list] of [...byRow].sort((a, b) => a[0] - b[0])) {
    list.sort((a, b) => a - b);
    let from = list[0], prev = list[0];
    for (let k = 1; k <= list.length; k++) {
      const col = list[k];
      if (col === prev + 1) { prev = col; continue; }
      out.push({ type: "rectangle", x: origin.x + from * cell, y: origin.y + row * cell, width: (prev - from + 1) * cell, height: cell });
      from = col; prev = col;
    }
  }
  return out;
}

// The level the smoke is recorded on. The field is one grid on one floor, so one level it is. The level it was
// written with wins while that level is still on the scene, so a field already indexed there never jumps floor.
// Otherwise it is the level most of THIS round's sources stand on — never the scene's default, which on a
// multi-level scene would record a light's smoke on the wrong floor. Ties go to the scene's own level order, and
// then to the id, so the same scene always picks the same floor. Null when nothing names a real document id.
export function smokeLevelFor(scene, sources = []) {
  const order = [...(scene?.levels ?? [])].map((l) => l?.id).filter((id) => typeof id === "string");
  const real = (id) => typeof id === "string" && LEVEL_ID.test(id) && (!order.length || order.includes(id));
  const stored = scene?.flags?.animater?.[SMOKE_GRID_FLAG]?.level;
  if (real(stored)) return stored;
  const counts = new Map();
  for (const s of sources ?? []) for (const id of s?.levels ?? []) if (real(id)) counts.set(id, (counts.get(id) ?? 0) + 1);
  if (counts.size) {
    const rank = (id) => { const at = order.indexOf(id); return at < 0 ? order.length : at; };
    return [...counts].sort((a, b) => b[1] - a[1] || rank(a[0]) - rank(b[0]) || (a[0] < b[0] ? -1 : 1))[0][0];
  }
  const first = scene?.initialLevel?.id ?? scene?.firstLevel?.id ?? null;
  return real(first) ? first : null;
}

// The flags the round itself writes on the scene, as the keys reach the update hook: the cells, the geometry beside
// them, and either one removed. (withDeletes takes the `-=` off the key and puts the deletion marker in the value, so
// both spellings turn up.) The scene's own "Fires fill rooms with smoke" switch is deliberately NOT one of them.
const SMOKE_OWN = new Set(["smoke", "smokeGrid", "-=smoke", "-=smokeGrid"]);
/**
 * A scene update that is only this round putting its own smoke back (pure): written with options.animater.roomSmoke,
 * changing nothing but flags.animater.smoke and flags.animater.smokeGrid. The scene rebuilds — and the round's own
 * room-size cache, which a tick-by-tick flood fill would otherwise cost dearly — skip it, as they skip a clock save.
 * Any other change in the same update is a real edit: a moved wall or a redrawn region must still throw the cache out.
 */
export function smokeOnlySave(changes, options) {
  if (options?.animater?.roomSmoke !== true) return false;
  const keys = Object.keys(changes ?? {}).filter((k) => k !== "_id" && k !== "_stats");
  if (!keys.length) return false;
  const nested = keys.length === 1 && keys[0] === "flags" ? changes.flags : null;
  if (nested) {
    const scopes = Object.keys(nested ?? {});
    if (scopes.length !== 1 || scopes[0] !== "animater") return false;
    const own = Object.keys(nested.animater ?? {});
    return own.length > 0 && own.every((k) => SMOKE_OWN.has(k));
  }
  return keys.every((k) => k.startsWith("flags.animater.") && SMOKE_OWN.has(k.slice("flags.animater.".length).split(".")[0]));
}

// Everything the smoke left behind, taken off the scene. Read from the scene's OWN keys (smokeKeysOf), not from the
// densities: a stored zero or a hand-edited entry is a key that is really there and must go too, or the flag is never
// empty and the smoke is never truly gone. The `-=` key form is the caller's to translate (withDeletes).
const clearPlan = (scene) => {
  const fields = {};
  for (const key of smokeKeysOf(scene)) fields[`${FLAG}.smoke.-=${key}`] = null;
  if (scene?.flags?.animater?.[SMOKE_GRID_FLAG] !== undefined) fields[`${FLAG}.-=${SMOKE_GRID_FLAG}`] = null;
  return { fields, cells: [], shapes: [], level: null, grid: null, openings: [], rooms: [] };
};

// ---- Which scenes the smoke round must visit, and whether it may run on them. ----
// The round rides the FIRE round's tick, and the fire round visits only scenes with Breakable props AND Fire spreads
// on (fire-rounds.mjs fireScenesOf). So those two switches are the smoke's as surely as its own is: untick either one
// with a room full and nothing would ever visit that scene again.
// Whether the room smoke may run on a scene at all: all three.
export const smokeRunsOn = (scene) => {
  const own = scene?.flags?.animater;
  return own?.roomSmoke === true && own?.breakableProps === true && own?.fireSpreads === true;
};

// Whether a scene still carries smoke state of ours: any cell key at all (a zero or a junk entry counts: it is a key
// that is really there), or the geometry stored beside them.
export const smokeHeldBy = (scene) => smokeKeysOf(scene).length > 0 || scene?.flags?.animater?.[SMOKE_GRID_FLAG] !== undefined;

// The scenes that need a round although the fire round will not visit them: every scene still carrying smoke state
// whose switches no longer let the smoke run. Their round's whole job is to take that state off.
// This is the difference between one more tick of smoke and for ever. Without it, unticking Breakable props or Fire
// spreads on a room full of smoke left the cells, the geometry, the concealment region AND every client's
// sight-blocking fence standing — and the fence is rebuilt from the stored flag alone, inside Foundry's own
// initializeEdges, referring to no switch at all, so it survived a reload on every client and blinded the players in
// a room with no smoke drawn in it, with nothing short of editing flags by hand to undo it.
// Only the active GM writes, so nobody else is given a list.
export function smokeLeftovers(scenes, { activeGM = false } = {}) {
  if (activeGM !== true) return [];
  return (scenes ?? []).filter((s) => !smokeRunsOn(s) && smokeHeldBy(s));
}

// Everything the smoke left on a scene, taken off it: the cells deleted by name, the stored geometry removed by name,
// and no shapes at all, so the caller takes the concealment region away with them. Repair asks for this, and so does a
// scene whose grid has stopped making sense. The `-=` key form is the caller's to translate (withDeletes).
export function smokeClearPlan(scene) {
  return clearPlan(scene);
}

// The round's whole decision.
//   activeGM  this client may write (only the active GM ever does).
//   on        whether the smoke may run here at all: smokeRunsOn, which is all three switches, not just its own.
//             Off, the round's whole job is to clear what is stored (clearPlan).
//   scene     the scene view: {id, dimensions, flags, levels, initialLevel/firstLevel}.
//   sources   [{i, rate, levels}] from smokeSourcesOf, already placed on this scene's smoke grid.
//   indoors(i)      whether that cell is in a room (a region that keeps the weather out, or an underground scene).
//   walled(i, n)    whether a sight- or move-blocking wall stands between two touching cells.
//   roomOf(i)       the room cell i sits in, as {id, size}: a name that is the same for every cell of that room, and
//                   how many cells it holds, for the venting. The whole grid as one room when not given.
//   openings  [i], the cells the scene's own walls stand open on (smoke-field.mjs smokeOpeningsOf): an open door, a
//             window standing open, a smashed one, a hole battered through, each of them leading OUT of its room.
//             Each room breathes out at the ones of its own.
//   sky(i)    whether that cell lies under a region open to the sky — a hole in the roof, a shaft. An opening in its
//             own right, wall or no wall, and the one case where a space with no outdoor cell anywhere near it does
//             genuinely vent: upward. Nothing is open to the sky when not given.
// Returns null only when this client must not write; otherwise
// {fields, cells, shapes, level, grid, openings, rooms}. `fields` may be empty: an unchanged round writes nothing.
//
// Indoors is where smoke lives: a fire out of doors fills nothing. Indoor-to-outdoor pairs are always blocked, so
// smoke never crosses out of its room; where no wall stands between them the indoor cell is an opening instead, and
// the room breathes out there — an open door, a smashed window, the mouth of a cave.
//
// Each room is stepped ON ITS OWN, with its own cells, sources, openings and cell count. Rooms are cut off from one
// another by the very walls the blocked pairs already encode, so this is not an approximation: it is the same answer,
// worked out right. One room's openings must never vent another's, and a great hall must never be divided by the
// cell count of the burning closet off it.
export function smokeRoundPlan({ activeGM, on, scene, sources = [], indoors = () => true, walled = () => false, roomOf = null, openings: standsOpen = [], sky = () => false } = {}) {
  if (activeGM !== true || !scene) return null;
  const saved = smokeCellsOf(scene);
  if (on !== true) return clearPlan(scene);
  const geo = smokeGridOf(scene.dimensions);
  // No readable geometry (a scene whose size or grid has gone): the stored cells mean nothing against it and nothing
  // can ever be worked out again, so everything the smoke left goes now — the cells, the geometry beside them and,
  // with no shapes, the concealment region. Abandoning here left a scene fogged and fenced for ever.
  if (!geo) return clearPlan(scene);
  const { cols, rows, cell, origin } = geo, total = cols * rows;
  // The stored cells only mean something against the geometry they were written with: a resized scene or a changed
  // grid starts the room clear rather than sliding the old smoke under the new squares.
  const was = storedSmokeGrid(scene, saved);
  const stale = !!was && (was.cols !== cols || was.cell !== cell);
  const inGrid = (i) => Number.isInteger(i) && i >= 0 && i < total;
  const held = stale ? [] : smokeCellList(saved).filter((c) => inGrid(c.i) && indoors(c.i));
  const lit = (sources ?? []).filter((s) => inGrid(s?.i) && s.rate > 0 && indoors(s.i));
  if (!held.length && !lit.length) return clearPlan(scene);
  // Only the cells that hold smoke or make it, and the one ring they can reach this round, are ever asked about: the
  // room test is a polygon walk, and a whole canvas of them every few seconds would be the round's entire cost.
  const seed = new Set([...held.map((c) => c.i), ...lit.map((s) => s.i)]);
  const look = new Set(seed);
  for (const i of seed) for (const n of smokeNeighbours(i, cols, rows)) look.add(n);
  // Which room each cell belongs to. Walked in index order, so the same scene gives the same groups in the same
  // order every tick. Every cell that is indoors lands in exactly one group (its own room's), and a cell that is not
  // indoors lands in none — with no roomOf given, or underground where every cell is indoors, that is one group
  // holding the lot, which is what a single cave or a scene with no rooms drawn on it should be.
  const whole = { id: "", size: total };
  const roomAt = (i) => (roomOf ? (roomOf(i) ?? whole) : whole);
  const looked = [...look].sort((a, b) => a - b);
  const rooms = new Map(), owner = new Map();
  for (const i of looked) {
    if (!indoors(i)) continue;
    const own = roomAt(i), id = own.id ?? "";
    if (!rooms.has(id)) rooms.set(id, { id, size: Number(own.size) > 0 ? Number(own.size) : total, cells: [], sources: [], openings: [], blocked: [] });
    owner.set(i, id);
  }
  const roomIdOf = (i) => (owner.has(i) ? owner.get(i) : (roomAt(i).id ?? ""));
  const walls = new Set((standsOpen ?? []).filter(inGrid));
  const open = (i) => { try { return sky(i) === true; } catch { return false; } };
  for (const [i, id] of owner) {
    const group = rooms.get(id);
    let breathes = false;
    for (const n of smokeNeighbours(i, cols, rows)) {
      const wall = walled(i, n);
      // Out of the room: the smoke never goes that way, and with no wall in between the room breathes out here.
      if (!indoors(n)) { group.blocked.push({ from: i, to: n }); if (!wall) breathes = true; continue; }
      // Another room: whatever stands between them, this room's smoke is not that room's.
      if (roomIdOf(n) !== id) { group.blocked.push({ from: i, to: n }); continue; }
      if (n > i && wall) group.blocked.push({ from: i, to: n });
    }
    // A wall of this room's own that leads out vents it too, wherever it stands: a window smashed deep inside a
    // warren is an opening even though no cell of it touches the sky. So does a hole in the roof over this cell.
    if (breathes || walls.has(i) || open(i)) group.openings.push(i);
  }
  for (const c of held) rooms.get(owner.get(c.i))?.cells.push(c);
  for (const s of lit) rooms.get(owner.get(s.i))?.sources.push(s);
  // One step per room, then the rooms' answers put back together as one field.
  const byCell = new Map();
  for (const group of rooms.values()) {
    const step = smokeStep({ cells: group.cells, sources: group.sources, cols, rows, openings: group.openings, blocked: group.blocked, room: group.size });
    for (const c of step.cells) if (indoors(c.i) && !byCell.has(c.i)) byCell.set(c.i, c);
  }
  const cells = [...byCell.values()].sort((a, b) => a.i - b.i);
  const openings = [...rooms.values()].flatMap((g) => g.openings).sort((a, b) => a - b);
  const level = smokeLevelFor(scene, lit);
  const fields = smokeUpdatesFor({ cells }, { scene })[0] ?? {};
  // The geometry goes BESIDE the cells, key by key so Foundry merges it and nothing old is stranded: without it the
  // fence would read the scene's grid size and its first level instead of the ones the cells were written with.
  const grid = scene.flags?.animater?.[SMOKE_GRID_FLAG] ?? {};
  if (cells.length) {
    const want = { cols, cell, ...(level ? { level } : {}) };
    for (const [key, value] of Object.entries(want)) if (grid[key] !== value) fields[`${FLAG}.${SMOKE_GRID_FLAG}.${key}`] = value;
  } else if (Object.keys(grid).length) fields[`${FLAG}.-=${SMOKE_GRID_FLAG}`] = null;
  // A grid the stored cells no longer fit was dropped above: their keys go too, whatever this round wrote.
  if (stale) for (const key of Object.keys(saved)) if (!(`${FLAG}.smoke.${key}` in fields)) fields[`${FLAG}.smoke.-=${key}`] = null;
  return { fields, cells, shapes: smokeShapes(cells, geo), level: cells.length ? level : null, grid: geo, openings,
    rooms: [...rooms.values()].map((g) => ({ id: g.id, size: g.size, openings: [...g.openings].sort((a, b) => a - b) })) };
}
