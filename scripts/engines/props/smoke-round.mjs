// One round of room smoke, as a decision: a plain scene view in, the scene update and the region's shapes out.
// Pure — no Foundry globals, no document writes, no clock, no randomness. The caller (main.mjs, the active GM) looks
// the scene up, says what is indoors and where the walls are, then applies what comes back.
//
// The pieces this leans on are already built: smokeStep is the simulation, smokeUpdatesFor turns a step into the
// scene's keyed flag writes (its own `-=` deletes included), and smokeGridOf is the one grid the cells are indexed
// with, which the sight-blocking fence reads them back against.
import { smokeStep, smokeUpdatesFor, smokeCellsOf, THIN } from "./smoke-field.mjs";
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

// Everything the smoke left behind, taken off the scene. The `-=` key form is the caller's to translate (withDeletes).
const clearPlan = (saved, hadGrid) => {
  const fields = {};
  for (const key of Object.keys(saved ?? {})) fields[`${FLAG}.smoke.-=${key}`] = null;
  if (hadGrid) fields[`${FLAG}.-=${SMOKE_GRID_FLAG}`] = null;
  return { fields, cells: [], shapes: [], level: null, grid: null, openings: [], room: 0 };
};

// The round's whole decision.
//   activeGM  this client may write (only the active GM ever does).
//   on        the scene's "Fires fill rooms with smoke" switch.
//   scene     the scene view: {id, dimensions, flags, levels, initialLevel/firstLevel}.
//   sources   [{i, rate, levels}] from smokeSourcesOf, already placed on this scene's smoke grid.
//   indoors(i)      whether that cell is in a room (a region that keeps the weather out, or an underground scene).
//   walled(i, n)    whether a sight- or move-blocking wall stands between two touching cells.
//   roomOf(i)       how many cells the room holding cell i has, for the venting. The whole grid when not given.
// Returns null when this client must not write or the scene has no usable geometry; otherwise
// {fields, cells, shapes, level, grid, openings, room}. `fields` may be empty: an unchanged round writes nothing.
//
// Indoors is where smoke lives: a fire out of doors fills nothing. Indoor-to-outdoor pairs are always blocked, so
// smoke never crosses out of its room; where no wall stands between them the indoor cell is an opening instead, and
// the room breathes out there — an open door, a smashed window, the mouth of a cave.
export function smokeRoundPlan({ activeGM, on, scene, sources = [], indoors = () => true, walled = () => false, roomOf = null } = {}) {
  if (activeGM !== true || !scene) return null;
  const saved = smokeCellsOf(scene);
  const hadGrid = !!scene.flags?.animater?.[SMOKE_GRID_FLAG];
  if (on !== true) return clearPlan(saved, hadGrid);
  const geo = smokeGridOf(scene.dimensions);
  if (!geo) return null;
  const { cols, rows, cell, origin } = geo, total = cols * rows;
  // The stored cells only mean something against the geometry they were written with: a resized scene or a changed
  // grid starts the room clear rather than sliding the old smoke under the new squares.
  const was = storedSmokeGrid(scene, saved);
  const stale = !!was && (was.cols !== cols || was.cell !== cell);
  const inGrid = (i) => Number.isInteger(i) && i >= 0 && i < total;
  const held = stale ? [] : smokeCellList(saved).filter((c) => inGrid(c.i) && indoors(c.i));
  const lit = (sources ?? []).filter((s) => inGrid(s?.i) && s.rate > 0 && indoors(s.i));
  if (!held.length && !lit.length) return clearPlan(saved, hadGrid);
  // Only the cells that hold smoke or make it, and the one ring they can reach this round, are ever asked about: the
  // room test is a polygon walk, and a whole canvas of them every few seconds would be the round's entire cost.
  const seed = new Set([...held.map((c) => c.i), ...lit.map((s) => s.i)]);
  const look = new Set(seed);
  for (const i of seed) for (const n of smokeNeighbours(i, cols, rows)) look.add(n);
  const openings = [], blocked = [];
  for (const i of look) {
    if (!indoors(i)) continue;
    let breathes = false;
    for (const n of smokeNeighbours(i, cols, rows)) {
      const wall = walled(i, n);
      if (!indoors(n)) { blocked.push({ from: i, to: n }); if (!wall) breathes = true; continue; }
      if (n > i && wall) blocked.push({ from: i, to: n });
    }
    if (breathes) openings.push(i);
  }
  openings.sort((a, b) => a - b);
  const room = roomOf ? roomOf(Math.min(...seed)) : total;
  const step = smokeStep({ cells: held, sources: lit, cols, rows, openings, blocked, room });
  const cells = step.cells.filter((c) => indoors(c.i));
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
  return { fields, cells, shapes: smokeShapes(cells, geo), level: cells.length ? level : null, grid: geo, openings, room };
}
