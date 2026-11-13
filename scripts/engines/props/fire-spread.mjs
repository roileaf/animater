// How fast a prop catches fire, read from its material and what it holds. Pure: no Foundry, no PIXI.

// A material's burn rate: how fast fire takes the prop itself (plants go quick, wood slower, stone and metal not at all).
export const MATERIAL_RATE = { plant: 2, wood: 1, glass: 0, clay: 0, stone: 0, metal: 0, none: 0 };

// A prop's contents burn rate: what it holds can catch even when the prop itself will not (lamp oil, books, potions).
// "papers" is not in the contents list yet; a later task may add it, so the rate is kept ready.
export const CONTENTS_RATE = { lampoil: 2, oil: 2, books: 1.6, papers: 1.6, potions: 1.2, grain: 1, goods: 1, water: 0, wine: 0, powder: 0, none: 0 };

// The fire rate of a prop: the larger of its material's rate and its contents' rate, 0 for anything unknown.
export function fireRate(traits) {
  const material = Object.hasOwn(MATERIAL_RATE, traits?.material) ? MATERIAL_RATE[traits.material] : 0;
  const contents = Object.hasOwn(CONTENTS_RATE, traits?.contents) ? CONTENTS_RATE[traits.contents] : 0;
  return Math.max(material, contents);
}

// How hot a prop must get before it is warned (starts to smoulder), and before it catches fire.
export const HEAT_WARN = 50;
export const HEAT_CATCH = 100;
// How many rounds a prop burns before it goes out.
export const BURN_ROUNDS = 3;

// The gap between two rectangles, edge to edge: 0 when they touch or overlap.
function edgeGap(a, b) {
  const dx = Math.max(0, a.x - (b.x + b.w), b.x - (a.x + a.w));
  const dy = Math.max(0, a.y - (b.y + b.h), b.y - (a.y + a.h));
  return Math.hypot(dx, dy);
}

// Two things share a level when either is on every level (no list) or they have one in common.
function sharesLevel(a, b) {
  if (!a?.length || !b?.length) return true;
  return a.some((l) => b.includes(l));
}

// How fast fire runs through grass, and how many rounds a grass square burns before it is charred for good.
export const GRASS_RATE = 1.4;
export const CELL_ROUNDS = 2;
// Floors where fire runs through the ground by default.
const BURNING_FLOORS = ["grass", "field"];

// Whether fire runs through a region's grass: its own say (flags.animater.burns), else on for grass and field floors only.
export function regionBurns(flags, floor) {
  if (typeof flags?.burns === "boolean") return flags.burns;
  return BURNING_FLOORS.includes(floor);
}

// Half again more heat out of doors when the target lies within 90 degrees of the wind's angle (1 + 0.5 * strength).
function windBoost(wind, from, to) {
  if (!wind?.outdoor || !(wind.strength > 0)) return 1;
  const dx = to.x + to.w / 2 - (from.x + from.w / 2);
  const dy = to.y + to.h / 2 - (from.y + from.h / 2);
  return dx * Math.cos(wind.angle) + dy * Math.sin(wind.angle) > 0 ? 1 + 0.5 * wind.strength : 1;
}

// A grass square's id as a fire source, for a `blocked` list (a prop's or another square's) to name.
// The index depends on the current grid and origin, so a `blocked` list built against one grass grid must be rebuilt if
// that grid changes. A square carrying its own `id` is named by that, and is no longer addressable as `cell:<i>`.
export const cellId = (i) => `cell:${i}`;

// A grass square's rectangle, from its index in a grid of `cols` squares whose top-left corner is `origin`.
function cellRect(i, { cols, origin, cell }) {
  return { x: origin.x + (i % cols) * cell, y: origin.y + Math.floor(i / cols) * cell, w: cell, h: cell };
}

// The burning grass squares: a charred one is out for good and never burns or heats again.
function burningCells(cells) {
  return cells.filter((c) => c.burning && !c.charred);
}

// One round of fire: every burning thing heats the things touching it (strongly) or within a square (gently),
// scaled by how flammable the target is, and half again more downwind out of doors. A wall in the way (blocked) or
// another level stops it. Returns each heated thing's new total heat, who catches (hottest first, up to the cap),
// who just started to warm, and which burning things have run out of rounds.
// Burning grass squares (`cells` with `cols`, `origin`, `cell`) heat props the same way, in this one pass.
export function spreadStep({ things = [], wind = null, grid = 100, cap = 12, cells = [], cols = 1, origin = { x: 0, y: 0 }, cell = grid } = {}) {
  const sources = things.filter((t) => t.fire?.burning);
  const fires = burningCells(cells).map((c) => ({ id: c.id ?? cellId(c.i), levels: c.levels, rect: cellRect(c.i, { cols, origin, cell }) }));
  const gain = new Map();
  for (const target of things) {
    if (target.fire?.burning) continue;
    const rate = fireRate(target.traits);
    if (rate <= 0) continue;
    const reach = (rect, most) => {
      const gap = edgeGap(rect, target.rect);
      return gap > most ? 0 : (gap === 0 ? 55 : 30) * rate * windBoost(wind, rect, target.rect);
    };
    for (const src of sources) {
      if (target.blocked?.includes(src.id)) continue;
      if (!sharesLevel(src.levels, target.levels)) continue;
      const add = reach(src.rect, grid);
      if (add > 0) gain.set(target.id, (gain.get(target.id) ?? 0) + add);
    }
    // Burning grass reaches one grass square (`cell`), and a wall or another level stops it just as it stops a prop.
    for (const src of fires) {
      if (target.blocked?.includes(src.id)) continue;
      if (!sharesLevel(src.levels, target.levels)) continue;
      const add = reach(src.rect, cell);
      if (add > 0) gain.set(target.id, (gain.get(target.id) ?? 0) + add);
    }
  }
  const heat = [];
  const warn = [];
  const catching = [];
  for (const target of things) {
    if (!gain.has(target.id)) continue;
    const before = target.fire?.heat ?? 0;
    const total = before + gain.get(target.id);
    heat.push({ id: target.id, heat: total });
    if (total >= HEAT_CATCH) catching.push({ id: target.id, heat: total });
    else if (total >= HEAT_WARN && before < HEAT_WARN) warn.push(target.id);
  }
  catching.sort((a, b) => b.heat - a.heat);
  const caught = catching.slice(0, cap).map((c) => c.id);
  const out = sources.filter((t) => (t.fire.roundsLeft ?? 0) <= 1).map((t) => t.id);
  // Still burning and not out: each keeps its heat and has one round fewer left, for the caller to save.
  const burning = sources.filter((t) => (t.fire.roundsLeft ?? 0) > 1).map((t) => ({ id: t.id, heat: t.fire.heat ?? 0, roundsLeft: t.fire.roundsLeft - 1 }));
  return { heat, caught, out, warn, burning };
}

// One round of fire through grass: each burning square heats the four squares beside it (not the diagonals) at
// GRASS_RATE, half again more downwind out of doors, and a burning prop heats the squares under and beside it.
// `cells` are { i, heat?, burning?, roundsLeft?, charred?, id?, levels?, blocked? }; a charred square takes no heat and never
// relights. Walls and levels work as they do for props, on every path (square to square, prop to square):
//   `blocked` on a square lists the source ids a wall cuts it off from: a neighbouring square's id (its own `id`, else
//   cellId(i)) or a burning prop's id. Fire from a listed source never reaches it.
//   `levels` lists the levels a square or prop is on; fire passes only between things sharing one, and an empty or
//   missing list means every level.
// Returns each heated square's new total heat, which catch (hottest first, up to the cap; each then burns CELL_ROUNDS), and
// which burning squares have run out of rounds (to be charred).
export function cellStep({ cells = [], things = [], cols = 1, rows = 1, origin = { x: 0, y: 0 }, cell = 100, wind = null, cap = 12 } = {}) {
  const geo = { cols, origin, cell };
  const byIndex = new Map(cells.map((c) => [c.i, c]));
  const sources = burningCells(cells);
  const gain = new Map();
  const add = (i, amount) => gain.set(i, (gain.get(i) ?? 0) + amount);
  for (const src of sources) {
    const col = src.i % cols;
    const row = Math.floor(src.i / cols);
    const from = cellRect(src.i, geo);
    for (const [c, r] of [[col - 1, row], [col + 1, row], [col, row - 1], [col, row + 1]]) {
      if (c < 0 || c >= cols || r < 0 || r >= rows) continue;
      const i = r * cols + c;
      const target = byIndex.get(i);
      if (!target || target.burning || target.charred) continue;
      if (target.blocked?.includes(src.id ?? cellId(src.i))) continue;
      if (!sharesLevel(src.levels, target.levels)) continue;
      add(i, 30 * GRASS_RATE * windBoost(wind, from, cellRect(i, geo)));
    }
  }
  const fires = things.filter((t) => t.fire?.burning);
  if (fires.length) {
    for (const target of cells) {
      if (target.burning || target.charred) continue;
      const rect = cellRect(target.i, geo);
      for (const src of fires) {
        if (!sharesLevel(src.levels, target.levels)) continue;
        if (target.blocked?.includes(src.id)) continue;
        const gap = edgeGap(src.rect, rect);
        if (gap > cell) continue;
        add(target.i, (gap === 0 ? 55 : 30) * GRASS_RATE * windBoost(wind, src.rect, rect));
      }
    }
  }
  const heat = [];
  const catching = [];
  for (const target of cells) {
    if (!gain.has(target.i)) continue;
    const total = (target.heat ?? 0) + gain.get(target.i);
    heat.push({ i: target.i, heat: total });
    if (total >= HEAT_CATCH) catching.push({ i: target.i, heat: total });
  }
  catching.sort((a, b) => b.heat - a.heat);
  const caught = catching.slice(0, cap).map((c) => c.i);
  const out = sources.filter((c) => (c.roundsLeft ?? 0) <= 1).map((c) => c.i);
  // Still burning and not out: each has one round fewer left, for the caller to save.
  const burning = sources.filter((c) => (c.roundsLeft ?? 0) > 1).map((c) => ({ i: c.i, roundsLeft: c.roundsLeft - 1 }));
  return { heat, caught, out, burning };
}

// The flag path a tile's fire is written to; an empty string for an empty id. A decoration's fire lives in its region's
// decorFire flag, and a grass square's in its region's fireCells flag, instead.
export const writeFirePath = (id) => (id ? "flags.animater.prop.fire" : "");

// A fire as saved: { heat, burning, roundsLeft }, or null when there is none. Read from a tile's flag, from a `fire` field,
// or from a saved entry itself. A burning fire with no heat yet is still a fire (heat 0); a cold one needs a heat to count.
export function readFire(doc) {
  const f = doc?.flags?.animater?.prop?.fire ?? doc?.fire ?? doc ?? null;
  if (!f || typeof f !== "object") return null;
  const hasHeat = Number.isFinite(f.heat);
  if (!hasHeat && f.burning !== true) return null;
  return { heat: hasHeat ? f.heat : 0, burning: f.burning === true, roundsLeft: Number.isFinite(f.roundsLeft) ? f.roundsLeft : 0 };
}

// The burning decorations a region has saved, keyed as decorBroken is. Returns {} for an empty or missing flag (a region
// keeps an empty object once every key is deleted), so read through this, never by testing the raw flag for truthiness.
export function decorFireOf(region) {
  const raw = region?.flags?.animater?.decorFire;
  return raw && typeof raw === "object" && !Array.isArray(raw) ? { ...raw } : {};
}

// The saved decoration fires whose key still names a painted decoration; a repainted region drops the rest, never reassigns them.
export function dropLostDecorFire(stored, liveKeys) {
  const live = new Set(liveKeys ?? []);
  return Object.fromEntries(Object.entries(stored ?? {}).filter(([key]) => live.has(key)));
}

// The saved fire of a region's grass squares, keyed by square index: { heat, burning, roundsLeft, charred? }.
// Returns {} for an empty or missing flag (it is left empty once every key is deleted), so read through this, never by
// testing the raw flag for truthiness.
export function fireCellsOf(region) {
  const raw = region?.flags?.animater?.fireCells;
  return raw && typeof raw === "object" && !Array.isArray(raw) ? { ...raw } : {};
}

// One saved entry's new value for a round, or null for no change. The first list that names the key wins: out (`outEntry`),
// then caught (starts at `rounds`), then still burning (one round fewer left), then heated. `saved` is the entry already
// stored, for the heat a burning step does not carry.
function entryChange(key, { heat, caught, out, burning }, rounds, saved, outEntry) {
  if (out.has(key)) return outEntry;
  if (caught.has(key)) return { heat: heat.get(key) ?? HEAT_CATCH, burning: true, roundsLeft: rounds };
  if (burning.has(key)) return { heat: burning.get(key).heat ?? saved?.heat ?? HEAT_CATCH, burning: true, roundsLeft: burning.get(key).roundsLeft };
  if (heat.has(key)) return { heat: heat.get(key), burning: false, roundsLeft: 0 };
  return null;
}

// Foundry merges an object-valued flag, so a removed key must be deleted by name: `<flag>.-=<key>` with a null value.
// Returns the update fields for one keyed flag: each changed entry at its own path (`<flag>.<key>`) and a per-key delete for
// each removed key. The whole flag is never written next to a delete under it, so no field depends on key order.
// (A key is never dotted: decoration keys are kind:x:y:tag and grass keys are indices.)
function keyedFlagFields(flag, changed, removed) {
  const fields = {};
  for (const [key, value] of Object.entries(changed)) fields[`${flag}.${key}`] = value;
  for (const key of removed) fields[`${flag}.-=${key}`] = null;
  return fields;
}

// A round's result as document updates for updateEmbeddedDocuments (plain objects, nothing applied).
// `step` is a spreadStep result (heat, caught, out, burning), for tiles and decorations by id. `tiles` lists the tiles in play
// ({ id }). `regions` lists the regions holding fire, each shaped { id, keys, cells, flags }: `keys` are the region's live
// decoration keys, `cells` the indices of its live grass squares, `flags` its saved flags. `cellSteps` maps a region's id
// to that region's own cellStep result (heat, caught, out, burning, keyed by index): grass indices are per region, so a
// region only ever reads the step filed under its own id, and one with no entry gets no grass changes.
// Order everywhere: out beats caught beats still-burning (one round fewer left) beats heated. A thing that catches starts at
// BURN_ROUNDS (CELL_ROUNDS for grass) and is not counted down that same round. A tile that goes out has its fire flag removed
// (`-=` with null, as repair does). A decoration that goes out, or whose key is no longer painted, is deleted from decorFire
// by key; a grass square that goes out is kept as charred (never relights) and one that is no longer there is deleted by key.
// A region gets one update holding both flags' changes.
export function fireUpdatesFor(step, { tiles = [], regions = [], cellSteps = {} } = {}) {
  const lists = (s, idOf) => ({
    heat: new Map((s?.heat ?? []).map((h) => [idOf(h), h.heat])),
    caught: new Set((s?.caught ?? []).map((c) => idOf(c))),
    out: new Set((s?.out ?? []).map((c) => idOf(c))),
    burning: new Map((s?.burning ?? []).map((b) => [idOf(b), b])),
  });
  const things = lists(step, (x) => (typeof x === "object" ? x.id : x));
  const squaresOf = (regionId) => lists(cellSteps instanceof Map ? cellSteps.get(regionId) : cellSteps?.[regionId], (x) => String(typeof x === "object" ? x.i : x));
  const tileUpdates = [];
  for (const t of tiles ?? []) {
    const path = writeFirePath(t?.id);
    if (!path) continue;
    if (things.out.has(t.id)) { tileUpdates.push({ _id: t.id, "flags.animater.prop.-=fire": null }); continue; }
    const next = entryChange(t.id, things, BURN_ROUNDS, null, null);
    if (next) tileUpdates.push({ _id: t.id, [path]: next });
  }
  const regionUpdates = [];
  for (const r of regions ?? []) {
    const stored = decorFireOf(r);
    const live = new Set(r.keys ?? []);
    const changed = {};
    const removed = new Set(Object.keys(stored).filter((k) => !live.has(k)));
    for (const key of live) {
      if (things.out.has(key)) { if (key in stored) removed.add(key); continue; }
      const next = entryChange(key, things, BURN_ROUNDS, stored[key], null);
      if (next) changed[key] = next;
    }
    const squares = squaresOf(r.id);
    const savedCells = fireCellsOf(r);
    const liveCells = new Set((r.cells ?? []).map(String));
    const cellChanged = {};
    const cellRemoved = new Set(Object.keys(savedCells).filter((k) => !liveCells.has(k)));
    for (const key of liveCells) {
      if (savedCells[key]?.charred) continue;
      const next = entryChange(key, squares, CELL_ROUNDS, savedCells[key], { heat: 0, burning: false, roundsLeft: 0, charred: true });
      if (next) cellChanged[key] = next;
    }
    const fields = { ...keyedFlagFields("flags.animater.decorFire", changed, removed), ...keyedFlagFields("flags.animater.fireCells", cellChanged, cellRemoved) };
    if (Object.keys(fields).length) regionUpdates.push({ _id: r.id, ...fields });
  }
  return { tiles: tileUpdates, regions: regionUpdates };
}

// Damage types that put a fire out.
const QUENCHING = ["water", "cold"];
export const quenchedBy = (damageType) => QUENCHING.includes(damageType);

// What an area that quenches puts out. `things` lists what could be burning, each { kind, point, fire, ... }:
//   { kind: "tile", id }                          a prop tile (its fire is flags.animater.prop.fire),
//   { kind: "decor", regionId, key }              a painted decoration (a key of its region's decorFire),
//   { kind: "cell", regionId, key }               a grass square (a key of its region's fireCells).
// `point` is where the area is asked about; `inArea(point)` says whether the area covers it. Only something holding a fire
// (burning or warm: cold water cools it too) and inside the area is touched. A charred square stays charred. Foundry merges
// object flags, so a region's entries go by name (`-=<key>` with null), all in one update per region.
// Returns { tiles, regions } as updates, plus `put`: the things it put out, so the caller can take their lights.
export function quenchUpdates(things, inArea) {
  const tiles = [], regions = new Map(), put = [];
  for (const t of things ?? []) {
    if (!t || typeof inArea !== "function" || !readFire(t.fire) || t.fire?.charred === true) continue;
    let inside = false;
    try { inside = inArea(t.point) === true; } catch { inside = false; }
    if (!inside) continue;
    if (t.kind === "tile" && typeof t.id === "string") { tiles.push({ _id: t.id, "flags.animater.prop.-=fire": null }); put.push(t); continue; }
    const flag = t.kind === "decor" ? "decorFire" : t.kind === "cell" ? "fireCells" : null;
    if (!flag || typeof t.regionId !== "string" || typeof t.key !== "string") continue;
    const update = regions.get(t.regionId) ?? { _id: t.regionId };
    update[`flags.animater.${flag}.-=${t.key}`] = null;
    regions.set(t.regionId, update);
    put.push(t);
  }
  return { tiles, regions: [...regions.values()], put };
}

// Repair's part for regions: one update per region that keeps any decoration fire or grass fire (burning, warm, charred,
// or an empty object left behind), removing each whole flag (`-=<flag>` with null; Foundry merges object flags, so
// nothing else removes a whole one). `regions` is [{ id, flags }]. A flag is tested for being there, not for being truthy.
export function repairFireUpdates(regions) {
  const updates = [];
  for (const r of regions ?? []) {
    const a = r?.flags?.animater, fields = {};
    if (typeof r?.id !== "string") continue;
    if (a?.decorFire !== undefined) fields["flags.animater.-=decorFire"] = null;
    if (a?.fireCells !== undefined) fields["flags.animater.-=fireCells"] = null;
    if (Object.keys(fields).length) updates.push({ _id: r.id, ...fields });
  }
  return updates;
}

// Runs one job per key at a time: an ask for a key already running gets that run's own result (it joins it), and an ask for
// another key runs at once on its own. The key is freed when its job ends, however it ends. Pure: no Foundry.
export function createQuenchGate() {
  const running = new Map();
  return {
    run(key, job) {
      if (running.has(key)) return running.get(key);
      const task = (async () => { try { return await job(); } finally { running.delete(key); } })();
      running.set(key, task);
      return task;
    },
  };
}
