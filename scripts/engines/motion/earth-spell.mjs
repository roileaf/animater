// Earth spells shake the ground. A spell of earth, cast, is felt: the view trembles, dust comes down from any ceiling
// over its area, the ponds near it ring and the animals bolt. For a moment, on each screen, changing nothing: no
// rubble is left, nothing falls on anyone (the cave-in is the GM's own tool, and saved). Pure: what is an earth spell,
// where its dust falls, and how it shakes.

// Named for the earth moving, in whatever system. Whole words: Earthbind is not an earthquake.
const EARTHY = /\b(?:earthquakes?|quakes?|tremors?|seismic|rockslides?|landslides?|avalanches?|shockwaves?|earth)\b/i;

/** Whether a spell is one of earth (pure): it has the earth trait (PF2e, SF2e), or its name says so. */
export function isEarthSpell({ name = '', traits = [] } = {}) {
  return (traits ?? []).includes('earth') || EARTHY.test(String(name ?? ''));
}

// How the view shakes: two jolts, the second a little less, as the cave-in's small fall does (camera-shake.mjs tremor).
export const QUAKE = Object.freeze([{ delay: 0, weight: 9, scale: 1.6 }, { delay: 420, weight: 8, scale: 1.2 }]);
// How heavy a jolt the ceiling dust falls from (ceiling-dust.mjs ceilingFall: more and wider the heavier).
export const QUAKE_DUST = 6;

/**
 * Where dust is shaken down inside an area (pure): up to `most` places spread across it, [{ x, y }]. `box` { x, y, w, h }
 * round the area in px; `inArea({ x, y })` whether a place is inside it. Looked for on a lattice across the box, and
 * thinned evenly when there are more than wanted, so a wide area is dusted all over and not in one corner.
 */
export function quakeSpots({ box, inArea = () => true, most = 6 } = {}) {
  if (!box || ![box.x, box.y, box.w, box.h].every(Number.isFinite) || !(box.w > 0) || !(box.h > 0)) return [];
  const found = [], N = 4;
  for (let row = 0; row < N; row++) for (let col = 0; col < N; col++) {
    const at = { x: box.x + ((col + 0.5) / N) * box.w, y: box.y + ((row + 0.5) / N) * box.h };
    let inside = false; try { inside = inArea(at) === true; } catch { inside = false; }
    if (inside) found.push(at);
  }
  if (found.length <= most) return found;
  const step = found.length / most;
  return Array.from({ length: most }, (_, i) => found[Math.floor(i * step)]);
}
