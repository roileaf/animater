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
  // No sun on this map (turned off): it burns off with the morning anyway, gone about three hours after sunrise.
  if (!sun) return clamp01(1 - (day - sunrise) / 0.12);
  const up = !sun.moon ? Number(sun.height) || 0 : 0;
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
// (With the GM's time for water, `pace`, snow on the ground comes and goes in minutes.)
const SNOW_LIES_HOURS = 10 / 60, SNOW_GOES_HOURS = 20 / 60;
const WETS_HOURS = 0.5, DRIES_HOURS = 4, SNOWS_HOURS = 2, MELTS_HOURS = 4, FREEZES_HOURS = 8, THAWS_HOURS = 5;
/**
 * The ground's weather over time: { wet, snow } (0–1), carried on from one moment to the next by the game clock. Rain
 * wets it within half an hour; it dries over about four hours, faster in sun and heat. Snow whitens it over two hours
 * (only while it is cold enough to stay, 2 °C or less, or unknown); it melts over about four hours above freezing.
 * Still water freezes (`ice`, 0–1) in a hard frost: from −3 °C over about eight hours, faster the colder (a day at
 * −15 °C locks it), and thaws above 1 °C over a few hours, faster in sun and warmth; `air` is the air's own
 * temperature (null unknown: then snow lying deep for long freezes it slowly, and it thaws once the snow is gone and the
 * sun is out). `load()` gives what was kept ({ wet, snow, ice, at } or null), `save(state)` keeps it.
 */
// `wetMinutes()`: game minutes for the hardest rain to soak the ground, the GM's (lighter rain takes longer); none given: a quarter of an hour.
export function createGroundWeather({ load = () => null, save = () => {}, pace = () => null, wetMinutes = () => null } = {}) {
  let state = null;
  return {
    update({ now = 0, rain = 0, snow = 0, temperature = null, air = temperature, sun = 0 } = {}) {
      state ??= (() => { const kept = load(); return kept && Number.isFinite(kept.at) ? { wet: clamp01(kept.wet), snow: clamp01(kept.snow), ice: clamp01(kept.ice ?? 0), at: kept.at } : { wet: 0, snow: 0, ice: 0, at: now }; })();
      // A jump of more than a month is the clock set anew (a world time read before it is ready, a calendar changed),
      // not weather: what lies stays. Shorter skips carry their weather, at most two days of it.
      const gap = (Number(now) - state.at) / 3600, hours = Math.abs(gap) > 24 * 30 ? 0 : Math.min(48, Math.max(0, gap));
      const warm = temperature !== null && Number.isFinite(Number(temperature)) ? Number(temperature) : null;
      const heat = 1 + clamp01(sun) + (warm !== null ? clamp01((warm - 10) / 20) : 0);
      if (rain > 0.05) { const minutes = Number(wetMinutes()); state.wet = clamp01(state.wet + hours * clamp01(rain) * (minutes > 0 ? 60 / minutes : 2 / WETS_HOURS)); }
      else state.wet = clamp01(state.wet - hours * heat / DRIES_HOURS / 2);
      const stays = warm === null || warm <= 2, timed = Number(pace()) > 0, way = timed ? hours / Number(pace()) : null;
      if (snow > 0.05 && stays) state.snow = clamp01(state.snow + (timed ? hours / SNOW_LIES_HOURS : hours * clamp01(snow) / SNOWS_HOURS * 2));
      else if (warm === null ? snow <= 0.05 && sun > 0.3 : warm > 2) state.snow = clamp01(state.snow - (timed ? hours / SNOW_GOES_HOURS : hours * (warm !== null ? 1 + clamp01((warm - 2) / 8) : 0.5) * (1 + clamp01(sun)) / MELTS_HOURS / 2));
      const cold = air !== null && Number.isFinite(Number(air)) ? Number(air) : null;
      if (cold !== null ? cold <= -3 : state.snow >= 0.6) state.ice = clamp01(state.ice + (way ?? hours * (cold !== null ? 0.25 + clamp01((-3 - cold) / 12) : 0.15) / FREEZES_HOURS * 4));
      else if (cold !== null ? cold > 1 : state.snow <= 0.05 && sun > 0.3) state.ice = clamp01(state.ice - (way ?? hours * (cold !== null ? 1 + clamp01((cold - 1) / 8) : 0.5) * (1 + clamp01(sun)) / THAWS_HOURS / 2));
      state.at = now;
      save({ ...state });
      return { wet: state.wet, snow: state.snow, ice: state.ice };
    },
    get now() { return state ? { wet: state.wet, snow: state.snow, ice: state.ice } : { wet: 0, snow: 0, ice: 0 }; },
  };
}

// The rain and snow falling now (0–1 each), from Calendaria's weather or the scene's own.
export function fallingOf({ calendaria = null, scene = '' } = {}) {
  const type = String(calendaria?.precipitation?.type ?? '').toLowerCase(), amount = Number(calendaria?.precipitation?.intensity);
  // Sleet is both; hail and snow wet nothing as they fall.
  if (Number.isFinite(amount) && amount > 0) return { rain: /snow|hail|blizzard/.test(type) ? 0 : clamp01(amount), snow: /snow|sleet|blizzard/.test(type) ? clamp01(amount) : 0 };
  const named = `${calendaria?.id ?? ''} ${scene ?? ''}`.toLowerCase();
  // (A storm of sand, dust, snow or fire brings no rain.)
  const wetNamed = named.replace(/(sand|dust|snow|fire|blizzard)[- ]?storm/g, '');
  return { rain: /rain|storm|shower/.test(wetNamed) ? 0.7 : /drizzle/.test(wetNamed) ? 0.25 : 0, snow: /snow|blizzard/.test(named) ? 0.7 : 0 };
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

// The open ground through the year: a soft colour laid over it ({ tint: [r, g, b, strength] }) — spring's fresh green,
// summer's sun-bleached straw, autumn's brown, winter's dull grey-green — and how thick fallen leaves lie under the trees
// (`litter` 0–1: deep in autumn, a few left in winter and spring, less in a wind that blows them off). None for an unknown
// season.
const SEASON_TINTS = Object.freeze({ spring: [0.45, 0.78, 0.28, 0.16], summer: [0.86, 0.76, 0.38, 0.15], autumn: [0.7, 0.42, 0.16, 0.3], winter: [0.6, 0.63, 0.64, 0.3] });
const SEASON_LITTER = Object.freeze({ spring: 0.08, summer: 0, autumn: 0.8, winter: 0.25 });
export function seasonGround(season, { wind = 0 } = {}) {
  if (!SEASON_TINTS[season]) return { tint: [0, 0, 0, 0], litter: 0 };
  return { tint: [...SEASON_TINTS[season]], litter: SEASON_LITTER[season] * (1 - 0.4 * Math.min(1, Math.max(0, Number(wind) || 0))) };
}

// What the weather does to the ground now ({ rain, snow, temperature, air, sun } for createGroundWeather's update), from
// Calendaria's weather and the scene's own: snow falling from the scene's weather settles and freezes whatever the
// calendar's temperature (`temperature` the weather's, °C or null; `sun` 0–1 on the ground).
export function groundInputs({ calendaria = null, scene = '', temperature = null, sun = 0 } = {}) {
  const falling = fallingOf({ calendaria, scene });
  const settles = settlingTemperature({ calendaria, scene, temperature });
  return { rain: falling.rain, snow: falling.snow, temperature: settles, air: settles === null && falling.snow > 0.05 ? -5 : temperature, sun };
}

// The ground of a scene nobody is looking at, carried on to `now` (game seconds) under the weather now (groundInputs'):
// the river freezes on while the party is elsewhere. `kept` the scene's last ({ wet, snow, ice, at } or null: it starts
// bare, from now).
export function groundStep(kept, { now = 0, pace = null, wetMinutes = null, ...input } = {}) {
  let out = null;
  createGroundWeather({ load: () => kept, save: (state) => { out = state; }, pace: () => pace, wetMinutes: () => wetMinutes }).update({ now, ...input });
  return out;
}

// How many game hours snow and ice take a scene, the whole way in or out (pure): somewhere from `least` to `most`, always the same for that scene, so one map's river goes before the next.
export function iceHours(sceneId = '', least = 24, most = 48) {
  const low = Math.max(1, Number(least) || 24), high = Math.max(low, Number(most) || 48);
  let h = 7; for (const c of String(sceneId)) h = (h * 31 + c.charCodeAt(0)) % 1000003;
  return low + (high - low) * (h % 1000) / 999;
}
// Whether a scene's kept ground has changed enough to write again: by a hundredth of anything, or a quarter hour on.
export const groundMoved = (was, now) => !was || !now || ['wet', 'snow', 'ice'].some((k) => Math.abs((Number(was[k]) || 0) - (Number(now[k]) || 0)) >= 0.01) || Math.abs((Number(now.at) || 0) - (Number(was.at) || 0)) >= 900;
