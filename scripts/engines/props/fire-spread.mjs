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
  const fires = burningCells(cells).map((c) => cellRect(c.i, { cols, origin, cell }));
  const gain = new Map();
  for (const target of things) {
    if (target.fire?.burning) continue;
    const rate = fireRate(target.traits);
    if (rate <= 0) continue;
    const reach = (rect) => {
      const gap = edgeGap(rect, target.rect);
      return gap > grid ? 0 : (gap === 0 ? 55 : 30) * rate * windBoost(wind, rect, target.rect);
    };
    for (const src of sources) {
      if (target.blocked?.includes(src.id)) continue;
      if (!sharesLevel(src.levels, target.levels)) continue;
      const add = reach(src.rect);
      if (add > 0) gain.set(target.id, (gain.get(target.id) ?? 0) + add);
    }
    for (const rect of fires) {
      const add = reach(rect);
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
  return { heat, caught, out, warn };
}

// One round of fire through grass: each burning square heats the four squares beside it (not the diagonals) at
// GRASS_RATE, half again more downwind out of doors, and a burning prop heats the squares under and beside it.
// `cells` are { i, heat?, burning?, roundsLeft?, charred? }; a charred square takes no heat and never relights. Returns each
// heated square's new total heat, which catch (hottest first, up to the cap; each then burns CELL_ROUNDS), and which burning
// squares have run out of rounds (to be charred).
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
      add(i, 30 * GRASS_RATE * windBoost(wind, from, cellRect(i, geo)));
    }
  }
  const fires = things.filter((t) => t.fire?.burning);
  if (fires.length) {
    for (const target of cells) {
      if (target.burning || target.charred) continue;
      const rect = cellRect(target.i, geo);
      for (const src of fires) {
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
  return { heat, caught, out };
}
