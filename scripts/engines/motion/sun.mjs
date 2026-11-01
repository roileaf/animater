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

// A setting's direction (a compass point, or screen degrees toward it) and height (a named height, or degrees up).
export const directionOf = (v, fallback) => COMPASS[v] ?? (v !== '' && v !== null && Number.isFinite(Number(v)) ? Number(v) : fallback);
export const heightOf = (v, fallback) => SUN_HEIGHTS[v] ?? (v !== '' && v !== null && Number.isFinite(Number(v)) ? Math.min(89, Math.max(3, Number(v))) : fallback);

// The world's default sun (Animater settings → Sun), for scenes that keep "World default": the old top-left sun.
export const DEFAULT_SUN_SETTING = Object.freeze({ mode: 'fixed', from: DEFAULT_SUN.angle, height: DEFAULT_SUN.height, east: COMPASS.e, strength: 1 });

// The scene's sun from its settings (flags.animater.sun: { mode: '' | 'time' | 'fixed' | 'none', from, height,
// strength 0–1, east }; `from` and `east` a compass point or screen degrees, `height` a named height or degrees),
// `defaults` the world's default sun (the same shape, used whole when the scene's mode is '') and `clock` the time now
// ({ day, sunrise, sunset }, or null when there is none). null: no sunlight shadows in this scene.
export function sceneSun(sceneFlags = {}, { defaults = DEFAULT_SUN_SETTING, clock = null } = {}) {
  const flags = sceneFlags?.mode ? sceneFlags : { ...DEFAULT_SUN_SETTING, ...(defaults ?? {}) };
  const mode = flags.mode || 'fixed';
  if (mode === 'none') return null;
  const strength = clamp01(Number.isFinite(Number(flags?.strength)) && flags?.strength !== '' && flags?.strength !== undefined ? Number(flags.strength) : 1);
  if (!(strength > 0)) return null;
  if (mode === 'time' && clock) {
    const sun = sunFromClock({ ...clock, east: directionOf(flags?.east, COMPASS.e) });
    return sun ? { ...sun, strength: sun.strength * strength } : null;
  }
  return { angle: directionOf(flags?.from, DEFAULT_SUN.angle), height: heightOf(flags?.height, DEFAULT_SUN.height), strength };
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
