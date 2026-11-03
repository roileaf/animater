// The living world around the map: the season, morning mist, fireflies at dusk, ground that gets wet in the rain and
// white in the snow (and dries and melts after), leaves falling from the trees, and birds whose shadows cross a clear
// day. Pure: the sky's shaders (sky-light.mjs, canopy-light.mjs) draw what these say.

const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
const clamp01 = (v) => Math.min(1, Math.max(0, Number(v) || 0));

// The season: Calendaria's (its seasonalType, else its name) or Simple Calendar Reborn's (its icon, else its name),
// else null (unknown).
export function seasonOf(season = null) {
  const said = `${season?.seasonalType ?? ''} ${season?.icon ?? ''} ${season?.name ?? ''}`.toLowerCase();
  if (/autumn|fall/.test(said)) return 'autumn';
  return SEASONS.find((s) => said.includes(s)) ?? null;
}

/**
 * How thick the mist lies (0–1): in fog all day; else at dawn, gathering in the last hour before sunrise and burning
 * off as the sun climbs to 25°. `day`, `sunrise`, `sunset`: shares of the day (sun.mjs clock); `sun`: the scene's
 * (its height in degrees).
 */
export function mistOf({ day = 0.5, sunrise = 0.25, sunset = 0.75, sun = null, fog = false } = {}) {
  if (fog) return 0.85;
  const noon = (sunrise + sunset) / 2;
  if (!(day < noon) || day < sunrise - 0.08) return 0;
  if (day < sunrise) return clamp01((day - (sunrise - 0.08)) / 0.04);
  const up = sun && !sun.moon ? Number(sun.height) || 0 : 0;
  return clamp01(1 - up / 25);
}

/**
 * How many fireflies are out (0–1): from sunset into the first hours of the night, in summer (and late spring), when it
 * is warm enough (from 15 °C; unknown counts as warm). None in winter or a cold night.
 */
export function firefliesOf({ day = 0.5, sunset = 0.75, season = null, temperature = null } = {}) {
  if (season === 'winter' || season === 'autumn') return 0;
  if (temperature !== null && Number.isFinite(Number(temperature)) && Number(temperature) < 15) return 0;
  const after = day - sunset;
  if (!(after > -0.01) || after > 0.16) return 0;
  const shape = after < 0.02 ? (after + 0.01) / 0.03 : after > 0.1 ? 1 - (after - 0.1) / 0.06 : 1;
  return clamp01(shape) * (season === 'spring' ? 0.5 : 1);
}

// Leaves falling from the trees: how many (0–1, more in the wind, most in autumn, none in winter) and their colours
// (0xrrggbb).
export function leavesOf({ season = null, wind = 0.3 } = {}) {
  const gust = 0.3 + 0.7 * clamp01(wind);
  if (season === 'winter') return { rate: 0, colors: [] };
  if (season === 'autumn') return { rate: Math.min(1, 0.55 + 0.45 * gust), colors: [0xd9822b, 0xb5451b, 0xe8b33a, 0x8a4b20] };
  if (season === 'spring') return { rate: 0.25 * gust, colors: [0x9ccf5a, 0xf2c6d4] };
  return { rate: 0.4 * gust, colors: [0x6f9a3a, 0x8fb24a] };
}

// How fast the ground wets and dries, whitens and melts, in game hours for the whole way.
const WETS_HOURS = 0.5, DRIES_HOURS = 4, SNOWS_HOURS = 2, MELTS_HOURS = 4;
/**
 * The ground's weather over time: { wet, snow } (0–1), carried on from one moment to the next by the game clock. Rain
 * wets it within half an hour; it dries over about four hours, faster in sun and heat. Snow whitens it over two hours
 * (only while it is cold enough to stay, 2 °C or less, or unknown); it melts over about four hours above freezing.
 * `load()` gives what was kept ({ wet, snow, at } or null), `save(state)` keeps it.
 */
export function createGroundWeather({ load = () => null, save = () => {} } = {}) {
  let state = null;
  return {
    update({ now = 0, rain = 0, snow = 0, temperature = null, sun = 0 } = {}) {
      state ??= (() => { const kept = load(); return kept && Number.isFinite(kept.at) ? { wet: clamp01(kept.wet), snow: clamp01(kept.snow), at: kept.at } : { wet: 0, snow: 0, at: now }; })();
      // A jump of more than a month is the clock set anew (a world time read before it is ready, a calendar changed),
      // not weather: what lies stays. Shorter skips carry their weather, at most two days of it.
      const gap = (Number(now) - state.at) / 3600, hours = Math.abs(gap) > 24 * 30 ? 0 : Math.min(48, Math.max(0, gap));
      const warm = temperature !== null && Number.isFinite(Number(temperature)) ? Number(temperature) : null;
      const heat = 1 + clamp01(sun) + (warm !== null ? clamp01((warm - 10) / 20) : 0);
      if (rain > 0.05) state.wet = clamp01(state.wet + hours * clamp01(rain) / WETS_HOURS * 2);
      else state.wet = clamp01(state.wet - hours * heat / DRIES_HOURS / 2);
      const stays = warm === null || warm <= 2;
      if (snow > 0.05 && stays) state.snow = clamp01(state.snow + hours * clamp01(snow) / SNOWS_HOURS * 2);
      else if (warm === null ? snow <= 0.05 && sun > 0.3 : warm > 2) state.snow = clamp01(state.snow - hours * (warm !== null ? 1 + clamp01((warm - 2) / 8) : 0.5) * (1 + clamp01(sun)) / MELTS_HOURS / 2);
      state.at = now;
      save({ ...state });
      return { wet: state.wet, snow: state.snow };
    },
    get now() { return state ? { wet: state.wet, snow: state.snow } : { wet: 0, snow: 0 }; },
  };
}

// The rain and snow falling now (0–1 each), from Calendaria's weather or the scene's own.
export function fallingOf({ calendaria = null, scene = '' } = {}) {
  const type = String(calendaria?.precipitation?.type ?? '').toLowerCase(), amount = Number(calendaria?.precipitation?.intensity);
  // Sleet is both; hail and snow wet nothing as they fall.
  if (Number.isFinite(amount) && amount > 0) return { rain: /snow|hail|blizzard/.test(type) ? 0 : clamp01(amount), snow: /snow|sleet|blizzard/.test(type) ? clamp01(amount) : 0 };
  const named = `${calendaria?.id ?? ''} ${scene ?? ''}`.toLowerCase();
  return { rain: /rain|storm|drizzle|shower/.test(named) ? 0.7 : 0, snow: /snow|blizzard/.test(named) ? 0.7 : 0 };
}

// The temperature the falling snow meets: none known (null, so it settles) while snow falls, from Calendaria or the
// scene's weather, whatever temperature the calendar gives (a GM's blizzard means it is freezing; Calendaria can give
// a blizzard at 21 °C); the temperature only melts it once it stops. Sleet, half rain, keeps its temperature: it
// settles only in the cold.
export function settlingTemperature({ calendaria = null, scene = '', temperature = null } = {}) {
  const type = String(calendaria?.precipitation?.type ?? '').toLowerCase(), amount = Number(calendaria?.precipitation?.intensity);
  const calendar = Number.isFinite(amount) && amount > 0 ? type : '';
  if (/sleet/.test(calendar)) return temperature;
  return /snow|blizzard/.test(calendar) || /snow|blizzard/i.test(String(scene ?? '')) ? null : temperature;
}

// Birds over a clear day: the wait for the next flock (40 to 120 s), and its path across the map (from one edge past
// the other, roughly with the wind) from a random number source.
export const nextFlockMs = (random) => 40000 + 80000 * clamp01(random);
export function flockPath(bounds, random = Math.random, windAngle = null) {
  const a = Number.isFinite(windAngle) ? windAngle + (random() - 0.5) * 1.2 : random() * Math.PI * 2;
  const cx = bounds.x + bounds.width / 2, cy = bounds.y + bounds.height / 2, reach = Math.hypot(bounds.width, bounds.height) / 2 + 300;
  const side = (random() - 0.5) * Math.min(bounds.width, bounds.height) * 0.7, nx = -Math.sin(a), ny = Math.cos(a);
  return {
    from: { x: cx - Math.cos(a) * reach + nx * side, y: cy - Math.sin(a) * reach + ny * side },
    to: { x: cx + Math.cos(a) * reach + nx * side, y: cy + Math.sin(a) * reach + ny * side },
    angle: a, ms: 2 * reach / 0.35,
  };
}
