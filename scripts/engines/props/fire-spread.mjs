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

// One round of fire: every burning thing heats the things touching it (strongly) or within a square (gently),
// scaled by how flammable the target is, and half again more downwind out of doors. A wall in the way (blocked) or
// another level stops it. Returns each heated thing's new total heat, who catches (hottest first, up to the cap),
// who just started to warm, and which burning things have run out of rounds.
export function spreadStep({ things = [], wind = null, grid = 100, cap = 12 } = {}) {
  const sources = things.filter((t) => t.fire?.burning);
  const gain = new Map();
  for (const target of things) {
    if (target.fire?.burning) continue;
    const rate = fireRate(target.traits);
    if (rate <= 0) continue;
    for (const src of sources) {
      if (target.blocked?.includes(src.id)) continue;
      if (!sharesLevel(src.levels, target.levels)) continue;
      const gap = edgeGap(src.rect, target.rect);
      if (gap > grid) continue;
      let add = (gap === 0 ? 55 : 30) * rate;
      if (wind?.outdoor && wind.strength > 0) {
        const dx = target.rect.x + target.rect.w / 2 - (src.rect.x + src.rect.w / 2);
        const dy = target.rect.y + target.rect.h / 2 - (src.rect.y + src.rect.h / 2);
        if (dx * Math.cos(wind.angle) + dy * Math.sin(wind.angle) > 0) add *= 1 + 0.5 * wind.strength;
      }
      gain.set(target.id, (gain.get(target.id) ?? 0) + add);
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
