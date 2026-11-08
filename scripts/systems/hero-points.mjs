// A character's heroic resources glow on its tokens: a PF2e or SF2e Hero Point awarded, a PF2e Mythic Point gained or
// spent, D&D 5e Heroic Inspiration received or spent. An update carries only the new value, so each screen keeps the
// last value it saw per actor and reacts only to a change it witnessed (a first sighting just remembers the value).

const glow = (params, animated) => ({ filterType: 'glow', innerStrength: 0, distance: 14, ...params, animated });
const pulse = (loopDuration, loops, val2, animType = 'cosOscillation') => ({ animType, loopDuration, loops, val1: 0, val2 });
// A spend: one bright flare that brightens the art and fades.
const flare = (name, color, ms) => ({ name, library: 'animater', params: [
  glow({ outerStrength: 0, innerStrength: 1, color, distance: 16 }, { outerStrength: pulse(ms, 1, 8, 'halfSinOscillation') }),
  { filterType: 'adjustment', brightness: 1, animated: { brightness: { animType: 'halfSinOscillation', loopDuration: ms, loops: 1, val1: 1, val2: 1.35 } } },
] });

// Two warm golden pulses that swell from nothing and fade back to nothing.
export const HERO_GLOW_MS = 2200;
export const HERO_GLOW = Object.freeze({ name: 'animater-hero-point', library: 'animater', params: [
  glow({ outerStrength: 0, innerStrength: 0.6, color: 0xffc83a }, { outerStrength: pulse(HERO_GLOW_MS / 2, 2, 6) }),
] });
export const INSPIRATION_SPENT_MS = 900;
export const INSPIRATION_SPENT = Object.freeze(flare('animater-inspiration-spent', 0xfff1b8, INSPIRATION_SPENT_MS));
// Mythic power: three pulses whose colour turns from deep violet to gold and back.
export const MYTHIC_GLOW_MS = 3000;
export const MYTHIC_GLOW = Object.freeze({ name: 'animater-mythic-point', library: 'animater', params: [
  glow({ outerStrength: 0, innerStrength: 0.8, color: 0x8a3cff, distance: 18 }, {
    outerStrength: pulse(MYTHIC_GLOW_MS / 3, 3, 7),
    color: { animType: 'colorOscillation', loopDuration: MYTHIC_GLOW_MS / 3, loops: 3, val1: 0x8a3cff, val2: 0xffc83a },
  }),
] });
export const MYTHIC_SPENT_MS = 1000;
export const MYTHIC_SPENT = Object.freeze(flare('animater-mythic-spent', 0xb070ff, MYTHIC_SPENT_MS));

const number = (v) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : null);
// Each resource: the systems that have it, how to read it, the world setting that switches it, and its looks
// (`spent` absent: spending one plays nothing here; a Hero Point's reroll already plays its new result).
export const GLOW_RESOURCES = Object.freeze([
  { id: 'hero', systems: ['pf2e', 'sf2e'], setting: 'heroPointGlow', changed: (c) => c?.system?.resources?.heroPoints !== undefined || c?.['system.resources.heroPoints.value'] !== undefined,
    read: (a) => number(a?.system?.resources?.heroPoints?.value), gained: [HERO_GLOW, HERO_GLOW_MS] },
  { id: 'mythic', systems: ['pf2e'], setting: 'mythicPointGlow', changed: (c) => c?.system?.resources?.mythicPoints !== undefined || c?.['system.resources.mythicPoints.value'] !== undefined,
    read: (a) => number(a?.system?.resources?.mythicPoints?.value), gained: [MYTHIC_GLOW, MYTHIC_GLOW_MS], spent: [MYTHIC_SPENT, MYTHIC_SPENT_MS] },
  { id: 'inspiration', systems: ['dnd5e'], setting: 'inspirationGlow', changed: (c) => c?.system?.attributes?.inspiration !== undefined || c?.['system.attributes.inspiration'] !== undefined,
    read: (a) => (typeof a?.system?.attributes?.inspiration === 'boolean' ? Number(a.system.attributes.inspiration) : null),
    gained: [HERO_GLOW, HERO_GLOW_MS], spent: [INSPIRATION_SPENT, INSPIRATION_SPENT_MS] },
  { id: 'hope', systems: ['daggerheart'], setting: 'hopeGlow', changed: (c) => c?.system?.resources?.hope !== undefined || c?.['system.resources.hope.value'] !== undefined,
    read: (a) => number(a?.system?.resources?.hope?.value), gained: [HERO_GLOW, HERO_GLOW_MS], spent: [INSPIRATION_SPENT, INSPIRATION_SPENT_MS] },
  { id: 'victory', systems: ['draw-steel'], setting: 'victoryGlow', changed: (c) => c?.system?.hero?.victories !== undefined || c?.['system.hero.victories'] !== undefined,
    read: (a) => number(a?.system?.hero?.victories), gained: [HERO_GLOW, HERO_GLOW_MS] },
]);
// What a recipe's Heroic resource trigger can answer to in this system (pure): { 'hero:gained': 'Hero Point gained' }.
const HEROIC_NAMES = { hero: 'Hero Point', mythic: 'Mythic Point', inspiration: 'Heroic Inspiration', hope: 'Hope', victory: 'Victory' };
export function heroicChoices(systemId) {
  const out = {};
  for (const r of GLOW_RESOURCES.filter((g) => g.systems.includes(systemId))) for (const look of ['gained', 'spent']) if (r[look]) out[`${r.id}:${look}`] = `${HEROIC_NAMES[r.id]} ${look}`;
  return out;
}
// The choice a recipe has made here (pure): its own if this system has it, else the system's first, as the list shows it. Null with none here.
const ALL_HEROIC = new Set(GLOW_RESOURCES.flatMap((r) => ['gained', 'spent'].filter((look) => r[look]).map((look) => `${r.id}:${look}`)));
export function heroicChoiceOf(recipe, systemId) {
  const choices = Object.keys(heroicChoices(systemId));
  return choices.includes(recipe?.heroic) ? recipe.heroic : choices[0] ?? null;
}
// Each of this system's heroic looks as a ready recipe (pure; recipe objects for validateRecipe), so the GM sees the
// glow is theirs to change: left as it came it is the glow itself, changed it plays in its place.
export const HEROIC_STARTER_IDS = Object.freeze([...ALL_HEROIC].map((key) => `heroic-${key.replace(':', '-')}`));
const STARTER_TINTS = { gained: '#ffc83a', spent: '#fff1b8' };
export function heroicStarters(systemId) {
  return glowResources(systemId).flatMap((r) => ['gained', 'spent'].filter((look) => r[look]).map((look) => {
    const [preset, ms] = r[look];
    return { id: `heroic-${r.id}-${look}`, name: `${HEROIC_NAMES[r.id]} ${look}`, category: 'Heroic', color: STARTER_TINTS[look], trigger: 'heroic', heroic: `${r.id}:${look}`, match: '', enabled: true,
      description: `Plays on a character's tokens when they ${look === 'gained' ? 'gain' : 'spend'} ${/^[AEIOU]/.test(HEROIC_NAMES[r.id]) ? 'an' : 'a'} ${HEROIC_NAMES[r.id]}. As it comes it is Animater's own glow; change it and your version plays instead.`,
      stages: [{ kind: 'tokenfx', subject: 'source', delay: 0, duration: ms + 100, assets: [], fxLayers: preset.params.map((p) => structuredClone(p)) }] };
  }));
}
// The recipe for this moment, if the GM has made one (pure): it plays in place of the glow.
export const heroicRecipe = (recipes, systemId, key) => (recipes ?? []).find((r) => r?.trigger === 'heroic' && r.enabled !== false && !r.finisher && heroicChoiceOf(r, systemId) === key) ?? null;
export const glowResources = (systemId) => GLOW_RESOURCES.filter((r) => r.systems.includes(systemId));
export const GLOW_SYSTEMS = new Set(GLOW_RESOURCES.flatMap((r) => r.systems));

// A PF2e or SF2e character's Hero Points (null without any).
export const heroPointsOf = (actor) => GLOW_RESOURCES[0].read(actor);

// Watches a system's resources. `seen(actor)` remembers an actor's values without reacting; `changed(actor, changes)`
// returns what happened to each resource the update touched: [{ resource, look: 'gained' | 'spent', by }].
export function resourceWatch(systemId) {
  const resources = glowResources(systemId), last = new Map();
  const key = (actor, r) => { const id = actor?.uuid ?? actor?.id; return id ? `${id}:${r.id}` : null; };
  return {
    seen(actor) {
      for (const r of resources) { const k = key(actor, r), v = r.read(actor); if (k && v !== null) last.set(k, v); }
    },
    changed(actor, changes) {
      const out = [];
      for (const r of resources) {
        const k = key(actor, r), v = r.read(actor);
        if (!k || v === null) continue;
        const before = last.get(k);
        last.set(k, v);
        if (!r.changed(changes) || before === undefined || v === before) continue;
        const look = v > before ? 'gained' : 'spent';
        if (r[look]) out.push({ resource: r, look, by: Math.abs(v - before) });
      }
      return out;
    },
    clear() { last.clear(); },
  };
}
