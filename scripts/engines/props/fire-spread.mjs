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
