// Smoke that fills a room: the pure simulation. One call is one round of the GM's tick (dt = 1).
// No Foundry globals, no clock, no randomness; it runs under plain node and gives the same answer every time.
import { closesWindow } from "../motion/window-state.mjs";
import { blockingWalls } from "./prop-walls.mjs";

// Density tiers. Thick blocks sight, thin only conceals; anything at or under the floor is gone.
export const THICK = 1.1;
export const THIN = 0.3;
export const DROP_FLOOR = 0.02;

// How much of the difference between two touching cells moves across their shared edge each round.
const SPREAD = 0.1;
// A draught pulls smoke into an opening: flow into an opening cell runs this much faster.
const PULL = 2;
// Nothing may leave across one edge faster than this, so four edges together never move more than a cell holds.
const EDGE_MAX = 0.2;
// The share lost every round from every cell, so a room with no source empties.
const FADE = 0.1;
// The share lost every round from a cell that is an opening (an open door, a broken window).
const LEAK = 0.35;
// The openings also let the whole room breathe out. How much is a share of how far the room stands open
// (openings / cells in the room), not a count: a doorway on a closet is a gale, the same doorway on a great hall is
// a draught. It saturates, because two doors never clear a room twice as fast — the air can only move so quickly —
// and it is taken ONCE a round, never once per opening, or a hall with a door and a window would hold no smoke.
// VENT_MAX is the most a round's venting can ever take; VENT_HALF is the open share that takes half of it.
const VENT_MAX = 0.9;
const VENT_HALF = 0.45;
// Density a source with rate 1 adds to its own cell each round.
const SOURCE = 2;
// How much a unit wind speeds flow along it and slows flow against it.
const WIND_LEAN = 0.5;

// No cell holds more than this, so a room that burned a long time does not take proportionally for ever to clear.
export const DENSITY_CAP = 4;

const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function smokeTier(v) {
  if (v >= THICK) return "thick";
  if (v >= THIN) return "thin";
  return null;
}

// The least and the most a single burning thing counts for, however small or large the map draws it: a candle-sized
// wreck still smokes, and a burning barn is not a hundred fires at once.
const SOURCE_MIN = 0.25;
const SOURCE_MAX = 4;

// What is making smoke this round, as cells of the smoke grid. `fires` are the burning things ({rect: {x, y, w, h}},
// a prop, a spilled oil fire, a square of burning grass), each counted at its middle and worth as much as it covers
// of the scene's own square (`grid`), held between SOURCE_MIN and SOURCE_MAX; one may name its own `rate` instead.
// `lights` are the scene's lights ({x, y, smokes}): only a light the GM marked (`smokes === true`) is a source, so a
// lit hearth does not fog the inn. `cell`, `origin` and `cols` are the smoke grid the indices are read against (the
// same smokeGridOf the cells are stored with). Rates add up where two sources share a cell; anything off the grid is
// left out. Each source's own `levels` come through on the cell it lands in (sorted, no repeats), because the round
// records the smoke on one level and has to know which levels its sources really stand on.
// Returns [{i, rate, levels}] sorted by i. Pure: no Foundry, no clock.
export function smokeSourcesOf({ fires = [], lights = [], grid = 100, cell = 100, origin = { x: 0, y: 0 }, cols = 1 } = {}) {
  const size = Number(cell) > 0 ? Number(cell) : 100;
  const square = Number(grid) > 0 ? Number(grid) : size;
  const ox = Number(origin?.x) || 0, oy = Number(origin?.y) || 0;
  const wide = Number.isInteger(Number(cols)) && Number(cols) > 0 ? Number(cols) : 1;
  const totals = new Map();
  const put = (x, y, rate, levels) => {
    if (!Number.isFinite(x) || !Number.isFinite(y) || !(rate > 0)) return;
    const col = Math.floor((x - ox) / size), row = Math.floor((y - oy) / size);
    if (col < 0 || col >= wide || row < 0) return;
    const i = row * wide + col;
    const own = totals.get(i) ?? { rate: 0, levels: new Set() };
    own.rate += rate;
    for (const id of levels ?? []) if (typeof id === "string" && id) own.levels.add(id);
    totals.set(i, own);
  };
  for (const f of fires ?? []) {
    const r = f?.rect ?? f, w = Number(r?.w), h = Number(r?.h), own = Number(f?.rate);
    if (!Number.isFinite(Number(r?.x)) || !Number.isFinite(Number(r?.y)) || !(w > 0) || !(h > 0)) continue;
    const rate = own > 0 ? own : Math.min(SOURCE_MAX, Math.max(SOURCE_MIN, (w * h) / (square * square)));
    put(Number(r.x) + w / 2, Number(r.y) + h / 2, rate, f?.levels);
  }
  for (const l of lights ?? []) {
    if (l?.smokes !== true) continue;
    // A light may name its own `rate`, as a fire may. Nothing does yet — main.mjs sends every smoking light at 1 —
    // but it is the seam a per-light "how much it smokes" would arrive through, so a hearth and a burning barn
    // need not be the same. One is the right answer for a light until a GM is given that choice.
    put(Number(l.x), Number(l.y), Number(l.rate) > 0 ? Number(l.rate) : 1, l?.levels);
  }
  return [...totals].map(([i, own]) => ({ i, rate: own.rate, levels: [...own.levels].sort() })).sort((a, b) => a.i - b.i);
}

// ---- Where the smoke gets out. ----
// Smoke leaves a room wherever its wall does not hold: an open door, a window standing open, and any hole of ours — a
// smashed window, a battered door, a breached wall all leave the room open to the air. A shut door, a shut window,
// a locked one and a plain whole wall hold it in.
// (A room open to the sky is not here: the round already knows which cells are indoors, and an indoor cell touching an
// outdoor one with no wall between them is an opening by that alone. This list is the walls' own.)
// Foundry's door state for OPEN (hard-coded to keep this module pure, as wall-break.mjs does): 0 shut, 1 open, 2 locked.
const OPEN_DOOR = 1;

// The window kinds that NEVER close, which the wall configuration says of each in so many words: an empty frame
// ("Empty frame: always open"), a wooden lattice ("always open, light in small squares") and iron bars ("always open,
// light in stripes"). Nothing fills them — at most open-work a draught passes between — so they are holes in the wall
// and always were, with no state to read. An empty frame is one case of this, not the whole of it; it was the whole of
// it, which is why a lattice and a grate held smoke like glass.
//
// This is deliberately NOT the complement of CLOSING_WINDOWS. "A kind that does not shut" sounds like the general rule
// and is wrong: the same vocabulary holds "" (Auto — not a window at all, or Foundry's glass), the legacy fixed
// `glass` and `shuttered`, and `curtained`. Those are a pane, boards and hanging cloth; each FILLS its frame and none
// of them opens, so the complement would blow every glazed window on the map wide open. The question is not "does it
// open?" but "is anything in it?", and nothing on the kind itself answers that — hence a named set.
//
// `slit` (an arrow slit) is left out on purpose, unglazed though it is. The field has no notion of how BIG an opening
// is: an opening cell loses LEAK every round and vents its room exactly as a full doorway does, so counting a
// hand's-breadth of stone as a doorway would empty a room through it. Left out it errs toward keeping the smoke in,
// which is the way this module leans elsewhere (see `rows` in smokeOpeningsOf).
const OPEN_FRAMES = Object.freeze(new Set(["open", "lattice", "bars"]));
// Whether a window kind is a frame with nothing in it (pure). Smoke's own reading of the kinds, and only smoke's:
// light, sight, sound and fire each have their own and none of them asks this.
export const frameStandsOpen = (kind) => OPEN_FRAMES.has(kind ?? "");

export function wallStandsOpen(wall) {
  const own = wall?.flags?.animater;
  // Broken through: the note the break wrote is on the wall whatever its door type now says.
  const hole = own?.breakWall?.broken;
  if (hole && typeof hole === "object") return true;
  if (Number(wall?.door) > 0) return Number(wall?.ds) === OPEN_DOOR;
  const kind = own?.window;
  // A frame nothing fills (an empty frame, a lattice, a grate), or a window the GM has swung open.
  if (frameStandsOpen(kind)) return true;
  return closesWindow(kind) && own?.windowOpen === true;
}

// ---- The walls that hold smoke in. ----
// Smoke's own wall list, and the ONE place it differs from everything else's.
//
// prop-walls' blockingWalls answers "what stops a thing": a wall that stops movement or sight, less an open door. That
// is the right answer for fire, for thrown wreckage, for light, sight and sound — and it is the SAME answer whether a
// window is shut or standing wide open, because Animater never writes a window's state onto the wall document. The
// kind and `windowOpen` live in its flags; opening it reshapes the live EDGE (window-state.mjs applyWindowEdge, which
// sets light, sight and sound, and never `move`); and smashing it writes sight, light and sound but deliberately
// leaves `move` alone, because a broken window still stops a body climbing through (wall-break.mjs wallBreakUpdate).
// So `move` stays above zero through every one of those states and blockingWalls keeps the wall in all of them.
//
// A body cannot get through an open window. Smoke can. That is the whole of the difference, so this is smoke's list
// and nobody else's: blockingWalls, less the walls that stand open (wallStandsOpen — an open door, a window swung
// open, an empty frame, a hole battered through). blockingWalls itself is untouched and still answers exactly as it
// did, so fire, wreckage, light, sight and sound are unmoved.
//
// This changes no agreed figure: a sealed room has no opening to drop, and an open inside door was already dropped by
// blockingWalls, so dropping it again is the same list.
// `walls` are wall views ({c, door, ds, move, sight, flags}); `excludeIds` is blockingWalls' own (ids, array or Set).
// Pure: no Foundry, no clock.
export function smokeWalls(walls, excludeIds = []) {
  return blockingWalls(walls, excludeIds).filter((w) => !wallStandsOpen(w));
}

// The cells of the smoke grid an opening stands on: every cell each open wall runs through, and the cells half a cell
// either side of it, because a wall is drawn along the line BETWEEN two squares and a doorway vents the rooms on both
// of its sides.
//
// An open wall is an opening only where it leads OUT: at least one of the two cells it stands between must be outdoors
// (`indoors(i) !== true`), or off the map altogether, which is as far out as a cell can be. An open door between two
// indoor rooms is NOT an opening, and this is the whole point of the predicate. Those two rooms are already ONE room
// to the round's own walk — blockingWalls drops an open door, so no wall stands between them and the smoke diffuses
// across the doorway by itself. Giving the doorway a vent as well would send that smoke out of the model instead of
// next door, and an inn with its inside doors open would never fill at all.
// (A cell under a region open to the sky is an opening in its own right, with no wall needed. That is not here: this
// function is handed walls, and a shaft in a roof need have no wall anywhere near it. smokeRoundPlan takes its own
// `sky` predicate for it.)
//
// `walls` are the scene's walls ({c: [x1, y1, x2, y2], door, ds, flags}); `cell`, `origin`, `cols` and `rows` are the
// smoke grid the indices are read against (the same smokeGridOf the cells are stored with).
// `rows` is what tells the map's BOTTOM edge from a row inside it. Without it the row is bounded only above, so a cell
// below the map reads as an ordinary cell and `indoors` is asked about it: underground, where every cell is indoors,
// that made a door in the bottom edge the one edge of four that did not vent. Left out, the bottom edge simply never
// vents, which errs toward keeping the smoke in rather than toward losing it.
// `indoors(i)` says whether a cell is in a room. There is NO default: with no predicate the function cannot tell an
// outside door from an inside one, so it answers [] and the smoke stays in. The permissive reading (every cell
// outdoors, every open wall a way out) is a caller's to ask for in so many words, `indoors: () => false`, and is only
// right where nothing at all is known of the rooms. It is deliberately not the silent default: as that, it quietly
// vented every room an inn had and the smoke never built.
// Returns [i], sorted, each cell once, nothing off the grid. Pure: no Foundry, no clock.
export function smokeOpeningsOf({ walls = [], cell = 100, origin = { x: 0, y: 0 }, cols = 1, rows = null, indoors = null } = {}) {
  const size = Number(cell) > 0 ? Number(cell) : 100;
  const ox = Number(origin?.x) || 0, oy = Number(origin?.y) || 0;
  const wide = Number.isInteger(Number(cols)) && Number(cols) > 0 ? Number(cols) : 1;
  const tall = Number.isInteger(Number(rows)) && Number(rows) > 0 ? Number(rows) : Infinity;
  const out = new Set();
  if (typeof indoors !== "function") return [];
  // The cell a point lands in, or null when that is off the map.
  const cellAt = (x, y) => {
    const col = Math.floor((x - ox) / size), row = Math.floor((y - oy) / size);
    return col < 0 || col >= wide || row < 0 || row >= tall ? null : row * wide + col;
  };
  // Off the map is outside; on it, whatever the caller's rooms say.
  const outside = (i) => i === null || indoors(i) !== true;
  const put = (i) => { if (i !== null) out.add(i); };
  for (const w of walls ?? []) {
    const c = w?.c;
    if (!Array.isArray(c) || c.length !== 4 || !c.every((n) => Number.isFinite(Number(n)))) continue;
    if (!wallStandsOpen(w)) continue;
    const [x1, y1, x2, y2] = c.map(Number);
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
    // Walked at half a cell at a time, so a long window names every cell along it and never steps over one, and each
    // step is taken at the MIDDLE of its stretch: a wall that ends exactly on a cell line belongs to the cells it runs
    // along, not to the one it stops at, and an endpoint sample would claim a row the wall only touches the corner of.
    const steps = Math.max(1, Math.ceil((len * 2) / size));
    // Half a cell across the wall, either way: the squares it stands between.
    const nx = len > 0 ? (-dy / len) * (size / 2) : 0, ny = len > 0 ? (dx / len) * (size / 2) : 0;
    for (let k = 0; k < steps; k++) {
      const t = (k + 0.5) / steps, x = x1 + dx * t, y = y1 + dy * t;
      const here = cellAt(x, y), near = cellAt(x + nx, y + ny), far = cellAt(x - nx, y - ny);
      // Both sides indoors: an inside door or an inside window, which carries smoke next door without venting it.
      if (!outside(near) && !outside(far)) continue;
      put(here); put(near); put(far);
    }
  }
  return [...out].sort((a, b) => a - b);
}

// cells: [{i, v}] with i = row * cols + col. sources: [{i, rate}]. openings: [i]. blocked: [{from, to}] cell pairs a wall
// separates (smoke does not cross either way).
// `wind` is {x, y} with length up to 1, and NOTHING PASSES IT, deliberately: this is the smoke standing in a closed
// room, and the scene's outdoor wind has no business in it. What moves the smoke toward a way out is the draught the
// openings already make (PULL, LEAK and the room-wide venting), which is the right model for a doorway and does not
// need the weather. The term stays because a future draught field of its own would use it unchanged.
// `dt` (rounds, default 1) and `cap` (the most any cell holds, default DENSITY_CAP, applied last) are likewise seams
// the round does not use: one round is one step, and the cap is the agreed one. Both are exercised by their own tests,
// because a caller that needs to run the field faster or hold it lower should find them working.
// room: how many cells the room holds, which the openings are measured against (default the whole grid).
// Returns {cells} sorted by i, with every cell at or below DROP_FLOOR left out.
export function smokeStep({ cells = [], sources = [], cols, rows, openings = [], blocked = [], wind = null, dt = 1, cap = DENSITY_CAP, room = null } = {}) {
  const total = cols * rows;
  const inGrid = (i) => Number.isInteger(i) && i >= 0 && i < total;
  const step = Number.isFinite(dt) ? Math.max(0, Math.min(dt, 10)) : 1;
  const v = new Map();
  for (const c of cells) if (inGrid(c.i) && c.v > 0) v.set(c.i, (v.get(c.i) ?? 0) + c.v);
  for (const s of sources) if (inGrid(s.i) && s.rate > 0) v.set(s.i, (v.get(s.i) ?? 0) + SOURCE * s.rate * step);

  const open = new Set(openings.filter(inGrid));
  const walls = new Set();
  for (const b of blocked) walls.add(Math.min(b.from, b.to) * total + Math.max(b.from, b.to));
  let wx = 0, wy = 0;
  if (wind && (wind.x || wind.y)) { const len = Math.hypot(wind.x, wind.y), k = Math.min(1, len) / len; wx = wind.x * k; wy = wind.y * k; }

  // Each edge is visited once: from the lower index when both ends hold smoke, from the loaded end otherwise.
  const delta = new Map();
  const add = (i, d) => delta.set(i, (delta.get(i) ?? 0) + d);
  for (const [k, vk] of v) {
    const col = k % cols, row = (k - col) / cols;
    for (const [dx, dy] of STEPS) {
      const nc = col + dx, nr = row + dy;
      if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;
      const n = nr * cols + nc;
      if (v.has(n) && n < k) continue;
      if (walls.has(Math.min(k, n) * total + Math.max(k, n))) continue;
      const vn = v.get(n) ?? 0, gap = vk - vn;
      if (gap === 0) continue;
      // The way the smoke goes across this edge: out of k toward n when k is the fuller, otherwise into k.
      const sx = gap > 0 ? dx : -dx, sy = gap > 0 ? dy : -dy, to = gap > 0 ? n : k;
      const rate = Math.min(EDGE_MAX, SPREAD * step * (open.has(to) ? PULL : 1) * (1 + WIND_LEAN * (sx * wx + sy * wy)));
      const moved = Math.abs(gap) * rate;
      add(k, gap > 0 ? -moved : moved);
      add(n, gap > 0 ? moved : -moved);
    }
  }

  // What is left of a cell's smoke after the round's fade, the room-wide venting, and, at an opening, the local leak.
  const held = Number.isFinite(room) && room > 0 ? room : total;
  const share = Math.min(1, open.size / Math.max(1, held));
  const vent = share > 0 ? (VENT_MAX * share) / (share + VENT_HALF) : 0;
  const stays = Math.pow((1 - FADE) * (1 - vent), step), staysAtOpening = stays * Math.pow(1 - LEAK, step);
  const out = [];
  for (const [i, vi] of v) {
    const next = (vi + (delta.get(i) ?? 0)) * (open.has(i) ? staysAtOpening : stays);
    if (next > DROP_FLOOR) out.push({ i, v: Math.min(cap, next) });
  }
  for (const [i, d] of delta) {
    if (v.has(i)) continue;
    const next = d * (open.has(i) ? staysAtOpening : stays);
    if (next > DROP_FLOOR) out.push({ i, v: Math.min(cap, next) });
  }
  out.sort((a, b) => a.i - b.i);
  return { cells: out };
}

// What the GM stores. The smoke lives on the scene at flags.animater.smoke as an object keyed by cell index ({[i]: density}),
// a keyed flag like feature 1's fireCells. Densities are stored to 4 decimals. The rounding gate (an unchanged rounded value writes nothing)
// must never stall decay: a cell loses at least FADE (10%) a round, so it stalls only when 10% of it is under half a store
// unit, i.e. below 0.0005, far under DROP_FLOOR (0.02), where smokeStep has already dropped it. At 2 decimals a cell near
// 0.03 rounded back to itself for ever and its smoke was never cleared.
const STORE_PLACES = 10000;
const SMOKE_FLAG = "flags.animater.smoke";
const stored = (v) => Math.round(v * STORE_PLACES) / STORE_PLACES;

const rawSmokeOf = (doc) => {
  const raw = doc?.flags?.animater?.smoke;
  return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
};

// The saved smoke of a scene (or any document holding the flag), keyed by cell index. A missing, empty or malformed flag is
// an empty room; entries that are not a positive number are dropped. Always a fresh object. (smokeEdges wants [{i, v}]:
// convert at the one place the two meet, never here.)
export function smokeCellsOf(doc) {
  const raw = rawSmokeOf(doc);
  const out = {};
  for (const [k, v] of Object.entries(raw)) if (Number.isFinite(v) && v > 0) out[k] = v;
  return out;
}

// Every key a scene really holds under the smoke flag, a zero or a hand-edited junk entry included. smokeCellsOf drops
// what is not a density, but a key it dropped is still stored: anything that means to leave NOTHING behind has to delete
// these, not those.
export const smokeKeysOf = (doc) => Object.keys(rawSmokeOf(doc));

// A round's result as scene updates (plain objects, nothing applied): [] when nothing changed, else one update.
// Foundry MERGES an object-valued flag, so a cell that has cleared must be deleted by name: `flags.animater.smoke.-=<i>` with
// null. Never write the whole flag, and never beside a keyed delete. A cell is written at its own path
// (`flags.animater.smoke.<i>`) only when its rounded density differs from the stored one; a cell whose rounded density is
// zero counts as gone. A stored cell the step no longer holds is deleted.
export function smokeUpdatesFor(step, { scene } = {}) {
  const saved = smokeCellsOf(scene);
  const next = new Map();
  for (const c of step?.cells ?? []) {
    if (!Number.isInteger(c?.i) || !Number.isFinite(c.v)) continue;
    const v = stored(c.v);
    if (v > 0) next.set(String(c.i), v);
  }
  const fields = {};
  for (const [key, v] of next) if (stored(saved[key] ?? 0) !== v) fields[`${SMOKE_FLAG}.${key}`] = v;
  // Delete from the RAW keys: a zero or junk entry (old or hand-edited data) is not in `saved` but must still go.
  for (const key of Object.keys(rawSmokeOf(scene))) if (!next.has(key)) fields[`${SMOKE_FLAG}.-=${key}`] = null;
  return Object.keys(fields).length ? [fields] : [];
}
