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
]);
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
