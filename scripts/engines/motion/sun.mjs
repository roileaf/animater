// The sun over a scene, for the shadows creatures cast (movement-feel.mjs shadowFall): where it shines from, how high
// it stands and how strong it is. It follows the time of day (Foundry's clock, or a calendar module's own day with its
// sunrise and sunset), or stays where the scene fixes it, or the scene has none. Angles are screen degrees (0 right,
// 90 down) toward the sun, as surrounding-light.mjs gives a light's; `height` is degrees above the horizon.

// Where the light shines from, by compass (north up), as screen degrees toward it.
export const COMPASS = Object.freeze({ n: -90, ne: -45, e: 0, se: 45, s: 90, sw: 135, w: 180, nw: -135 });
// How high the sun stands for the scene's fixed choice.
export const SUN_HEIGHTS = Object.freeze({ low: 15, mid: 40, high: 65 });
// The fixed sun when a scene sets nothing: the top left, fairly high (the light Animater's shadows always had).
export const DEFAULT_SUN = Object.freeze({ angle: COMPASS.nw, height: 55, strength: 1 });
// How high the sun climbs at noon on the clock.
const NOON = 60;

const clamp01 = (v) => Math.min(1, Math.max(0, v));

// The sun at `day` (0–1 through the day, midnight to midnight) between `sunrise` and `sunset` (the same fractions),
// rising from `east` (screen degrees toward the map's east): it crosses the south at noon (north up) and sets in the
// west, climbing to its noon height and back; it fades in and out over its first and last few degrees. null at night.
export function sunFromClock({ day, sunrise = 0.25, sunset = 0.75, east = COMPASS.e } = {}) {
  const f = ((Number(day) % 1) + 1) % 1;
  if (!(sunset > sunrise) || f <= sunrise || f >= sunset) return null;
  const t = (f - sunrise) / (sunset - sunrise), height = NOON * Math.sin(Math.PI * t);
  return { angle: east + 180 * t, height, strength: clamp01(height / 8) };
}

// The colour of dawn and dusk over the whole map: golden as the sun sinks under GOLDEN degrees, deep orange at the
// horizon, then a rose afterglow fading over TWILIGHT of the day after sunset (and before sunrise). `clock` as for
// sunFromClock. { color: [r, g, b] 0–1, amount 0–1 }, or null in full day and at night.
const GOLDEN = 18, TWILIGHT = 0.03;
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
// Under clouds (`clock.sky`) the colour fades with what shows of the sky: a grey dusk under an overcast one.
export function sunGlow(clock) {
  const glow = clearGlow(clock), sky = clamp01(clock?.sky ?? 1);
  return glow && glow.amount * sky > 0.01 ? { ...glow, amount: glow.amount * sky } : null;
}
function clearGlow(clock) {
  if (!clock) return null;
  const f = ((Number(clock.day) % 1) + 1) % 1, { sunrise = 0.25, sunset = 0.75 } = clock;
  if (!(sunset > sunrise) || !Number.isFinite(f)) return null;
  const sun = sunFromClock({ day: f, sunrise, sunset });
  if (sun) {
    const low = clamp01(1 - sun.height / GOLDEN);
    return low > 0 ? { color: mix([1, 0.82, 0.56], [1, 0.58, 0.36], low * low), amount: low } : null;
  }
  const since = (((f - sunset) % 1) + 1) % 1, until = (((sunrise - f) % 1) + 1) % 1;
  const dim = clamp01(1 - Math.min(since, until) / TWILIGHT);
  // Night: silver-blue by how much of the moon is lit (`clock.moon` 0–1), the afterglow giving way to it.
  const moon = clamp01(Number(clock.moon) || 0) * MOON_TINT;
  if (!(dim > 0) && !(moon > 0.02)) return null;
  return { color: mix([0.72, 0.8, 1], [0.86, 0.62, 0.78], dim), amount: Math.max(0.7 * dim, moon * (1 - dim)) };
}
const MOON_TINT = 0.6;

// How much of the moon is lit at `position` through its cycle (0 new, 0.5 full, 1 new again).
export const moonLit = (position) => (Number.isFinite(Number(position)) ? (1 - Math.cos(2 * Math.PI * Number(position))) / 2 : 0);
// A calendar's phase name or icon ("waxing-gibbous", "Full Moon") as how much of the moon is lit, or null.
const PHASES = [[/new/, 0], [/crescent/, 0.25], [/quarter|half/, 0.5], [/gibbous/, 0.75], [/full/, 1]];
export const phaseLit = (phase) => { const s = String(phase ?? '').toLowerCase(); return PHASES.find(([re]) => re.test(s))?.[1] ?? null; };
// The moon by night, for shadows: it crosses the sky from sunset to sunrise as the sun does by day, lower, and its
// shadows are faint, by how much of it is lit (`clock.moon`). null by day, under a thin moon, or with no moon known.
const MOON_NOON = 45, MOON_SHADOW = 0.35;
export function moonFromClock({ day, sunrise = 0.25, sunset = 0.75, east = COMPASS.e, moon = 0 } = {}) {
  const f = ((Number(day) % 1) + 1) % 1, lit = clamp01(Number(moon) || 0);
  if (!(sunset > sunrise) || !(lit >= 0.1) || (f > sunrise && f < sunset)) return null;
  const t = ((((f - sunset) % 1) + 1) % 1) / (1 - (sunset - sunrise)), height = MOON_NOON * Math.sin(Math.PI * clamp01(t));
  const strength = lit * clamp01(height / 8) * MOON_SHADOW;
  return strength > 0.01 ? { angle: east + 180 * t, height, strength, moon: true } : null;
}

// How much of the sky is clear (0 covered, 1 clear) under a weather: a calendar's (Calendaria's ids) or a scene's own
// (Foundry's weather effects). Clouds and storms hide the sun and the moon: fainter shadows, shafts and colour, none
// under a storm. A weather not listed goes by how hard it falls and how much it darkens (`precipitation`, `darkness`).
const SKY = {
  clear: 1, 'partly-cloudy': 0.7, cloudy: 0.35, overcast: 0.1, drizzle: 0.2, rain: 0.1, fog: 0.15, mist: 0.5, windy: 0.9,
  sunshower: 0.7, snow: 0.25, sleet: 0.15, 'heat-wave': 1, thunderstorm: 0, blizzard: 0, hail: 0.1, tornado: 0, hurricane: 0,
  'ice-storm': 0.05, monsoon: 0, ashfall: 0.2, sandstorm: 0.1, 'luminous-sky': 1, 'rolling-fog': 0.2, 'wildfire-smoke': 0.35,
  'dust-devil': 0.5, 'black-sun': 0, 'aether-haze': 0.5, nullfront: 0.3, 'permafrost-surge': 0.3, gravewind: 0.5, veilfall: 0.3,
  'acid-rain': 0.2, 'blood-rain': 0.2, 'spore-cloud': 0.4, 'plague-miasma': 0.3,
  // Foundry's own scene weather.
  rainStorm: 0, fogLight: 0.5, fogHeavy: 0.1, snowStorm: 0, blizzardStorm: 0, leaves: 1, autumnLeaves: 1,
};
export function skyClear(weather) {
  if (!weather) return 1;
  const id = typeof weather === 'string' ? weather : weather.id;
  if (Object.hasOwn(SKY, id)) return SKY[id];
  const falls = Number(weather.precipitation?.intensity) || 0, dims = Math.max(0, Number(weather.darknessPenalty) || 0);
  return clamp01(1 - falls * 0.9 - dims * 3);
}

// A setting's direction (a compass point, or screen degrees toward it) and height (a named height, or degrees up).
export const directionOf = (v, fallback) => COMPASS[v] ?? (v !== '' && v !== null && Number.isFinite(Number(v)) ? Number(v) : fallback);
export const heightOf = (v, fallback) => SUN_HEIGHTS[v] ?? (v !== '' && v !== null && Number.isFinite(Number(v)) ? Math.min(89, Math.max(3, Number(v))) : fallback);

// The world's default sun (Animater settings → Sun), for scenes that keep "World default": the old top-left sun.
export const DEFAULT_SUN_SETTING = Object.freeze({ mode: 'fixed', from: DEFAULT_SUN.angle, height: DEFAULT_SUN.height, east: COMPASS.e, strength: 1 });

// The scene's sun from its settings (flags.animater.sun: { mode: '' | 'time' | 'fixed' | 'none', from, height,
// strength 0–1, east }; `from` and `east` a compass point or screen degrees, `height` a named height or degrees),
// `defaults` the world's default sun (the same shape, used whole when the scene's mode is '') and `clock` the time now
// ({ day, sunrise, sunset }, or null when there is none). null: no sunlight shadows in this scene.
export function sceneSun(sceneFlags = {}, options = {}) {
  // Clouds (`clock.sky`, 0 covered to 1 clear) dim whatever shines; under a covered sky nothing does.
  const sun = litSun(sceneFlags, options), sky = clamp01(options.clock?.sky ?? 1);
  if (!sun || sky >= 1) return sun;
  const strength = sun.strength * sky;
  return strength > 0.01 ? { ...sun, strength } : null;
}
function litSun(sceneFlags = {}, { defaults = DEFAULT_SUN_SETTING, clock = null } = {}) {
  const flags = sceneFlags?.mode ? sceneFlags : { ...DEFAULT_SUN_SETTING, ...(defaults ?? {}) };
  const mode = flags.mode || 'fixed';
  if (mode === 'none') return null;
  const strength = clamp01(Number.isFinite(Number(flags?.strength)) && flags?.strength !== '' && flags?.strength !== undefined ? Number(flags.strength) : 1);
  if (!(strength > 0)) return null;
  if (mode === 'time' && clock) {
    // By night the moon, when the calendar knows it.
    const east = directionOf(flags?.east, COMPASS.e), sun = sunFromClock({ ...clock, east }) ?? moonFromClock({ ...clock, east });
    return sun ? { ...sun, strength: sun.strength * strength } : null;
  }
  const fixed = { angle: directionOf(flags?.from, DEFAULT_SUN.angle), height: heightOf(flags?.height, DEFAULT_SUN.height), strength };
  // Fixed, it stays where it is set, but follows the clock: by night it is the moon there (faint, as lit), else none.
  return fixedAt(fixed, clock);
}
export function fixedAt(fixed, clock) {
  if (!clock || sunFromClock(clock)) return fixed;
  const lit = clamp01(Number(clock.moon) || 0);
  return lit >= 0.1 ? { ...fixed, strength: fixed.strength * lit * MOON_SHADOW, moon: true } : null;
}

// Where the time of day comes from (Animater settings → Sun → Calendar): 'auto' Calendaria, else Simple Calendar
// Reborn, else Foundry's clock; or one chosen (falling back to Foundry's clock when it is not active). `active(id)`
// says whether a module is on.
export const CLOCKS = Object.freeze({ auto: 'Automatic', calendaria: 'Calendaria', 'foundryvtt-simple-calendar-reborn': 'Simple Calendar Reborn', foundry: "Foundry's own clock" });
export function clockSource(choice = 'auto', active = () => false) {
  if (choice === 'foundry') return 'foundry';
  if (choice && choice !== 'auto') return active(choice) ? choice : 'foundry';
  return ['calendaria', 'foundryvtt-simple-calendar-reborn'].find((id) => active(id)) ?? 'foundry';
}

// How far a shadow reaches from something `up` pixels above the floor, the sun `height` degrees up.
export const sunReach = (up, height) => Math.max(0, up) / Math.tan((Math.max(3, Math.min(89, Number(height) || 0)) * Math.PI) / 180);
