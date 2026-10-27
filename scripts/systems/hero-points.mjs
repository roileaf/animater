// A PF2e or SF2e character awarded a Hero Point glows gold for a moment. Hero Points live in
// system.resources.heroPoints.value; an update carries only the new value, so each screen keeps the last value it
// saw per actor and glows only on a rise it witnessed (a first sighting just remembers the value).

export const HERO_POINT_SYSTEMS = new Set(['pf2e', 'sf2e']);
export const HERO_POINT_PATH = 'system.resources.heroPoints.value';
// Two warm pulses that swell from nothing and fade back to nothing.
export const HERO_GLOW_MS = 2200;
export const HERO_GLOW = Object.freeze({ name: 'animater-hero-point', library: 'animater', params: [
  { filterType: 'glow', outerStrength: 0, innerStrength: 0.6, color: 0xffc83a, distance: 14,
    animated: { outerStrength: { animType: 'cosOscillation', loopDuration: HERO_GLOW_MS / 2, loops: 2, val1: 0, val2: 6 } } },
] });

export const heroPointsOf = (actor) => {
  const value = Number(actor?.system?.resources?.heroPoints?.value);
  return Number.isFinite(value) ? value : null;
};

// Watches Hero Points. `seen(actor)` remembers an actor's value without glowing; `changed(actor, changes)` returns
// how many points were gained (0 when none, or when the change is not about Hero Points).
export function heroPointWatch() {
  const last = new Map();
  const key = (actor) => actor?.uuid ?? actor?.id ?? null;
  return {
    seen(actor) {
      const k = key(actor), value = heroPointsOf(actor);
      if (k && value !== null) last.set(k, value);
    },
    changed(actor, changes) {
      const k = key(actor), value = heroPointsOf(actor);
      if (!k || value === null) return 0;
      const touched = changes?.system?.resources?.heroPoints !== undefined || changes?.[HERO_POINT_PATH] !== undefined;
      const before = last.get(k);
      last.set(k, value);
      return touched && before !== undefined && value > before ? value - before : 0;
    },
    clear() { last.clear(); },
  };
}
