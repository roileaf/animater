// Weather made from the date (pure), for a calendar with none of its own (Simple Calendar Reborn): the same date and
// world give the same weather on every screen, so nothing is saved or sent. The day is cut into blocks of BLOCK_HOURS;
// each block's weather comes from a slow wave over time read against the climate and season's weathers, laid from the
// mildest to the wildest, so it drifts from clear to cloudy to rain and back rather than jumping about.

export const BLOCK_HOURS = 6;

// Each climate's weathers by season, mildest first, with how often each comes. `null` season: the year's average.
const T = (...pairs) => pairs;
export const CLIMATES = Object.freeze({
  temperate: { label: 'Temperate', seasons: {
    spring: T(['clear', 3], ['partly-cloudy', 4], ['cloudy', 3], ['drizzle', 2], ['rain', 2], ['fog', 1], ['thunderstorm', 1]),
    summer: T(['clear', 6], ['partly-cloudy', 4], ['cloudy', 2], ['sunshower', 1], ['rain', 1], ['thunderstorm', 1], ['heat-wave', 0.5]),
    autumn: T(['clear', 2], ['partly-cloudy', 3], ['cloudy', 3], ['overcast', 2], ['mist', 1], ['fog', 1], ['drizzle', 2], ['rain', 2], ['windy', 1]),
    winter: T(['clear', 2], ['cloudy', 3], ['overcast', 3], ['fog', 1], ['sleet', 1], ['snow', 2], ['blizzard', 0.5]),
    year: T(['clear', 4], ['partly-cloudy', 3], ['cloudy', 3], ['overcast', 1], ['drizzle', 1], ['rain', 2], ['thunderstorm', 0.5]),
  } },
  cold: { label: 'Cold', seasons: {
    spring: T(['clear', 2], ['cloudy', 3], ['overcast', 2], ['fog', 1], ['sleet', 2], ['snow', 2]),
    summer: T(['clear', 4], ['partly-cloudy', 3], ['cloudy', 3], ['drizzle', 1], ['rain', 1], ['fog', 1]),
    autumn: T(['clear', 1], ['cloudy', 3], ['overcast', 3], ['windy', 1], ['sleet', 2], ['snow', 2]),
    winter: T(['clear', 1], ['overcast', 2], ['snow', 4], ['ice-storm', 0.5], ['blizzard', 1.5]),
    year: T(['clear', 2], ['cloudy', 3], ['overcast', 2], ['sleet', 1], ['snow', 3], ['blizzard', 0.5]),
  } },
  dry: { label: 'Dry (desert)', seasons: {
    spring: T(['clear', 7], ['partly-cloudy', 2], ['windy', 1], ['dust-devil', 0.5], ['sandstorm', 0.5]),
    summer: T(['clear', 6], ['heat-wave', 3], ['windy', 1], ['dust-devil', 1], ['sandstorm', 1]),
    autumn: T(['clear', 7], ['partly-cloudy', 2], ['windy', 1], ['sandstorm', 0.5], ['rain', 0.3]),
    winter: T(['clear', 6], ['partly-cloudy', 3], ['cloudy', 1], ['windy', 1], ['rain', 0.5]),
    year: T(['clear', 7], ['partly-cloudy', 2], ['heat-wave', 1], ['windy', 1], ['sandstorm', 0.5]),
  } },
  tropical: { label: 'Tropical', seasons: {
    spring: T(['clear', 3], ['partly-cloudy', 3], ['sunshower', 2], ['rain', 2], ['thunderstorm', 1]),
    summer: T(['partly-cloudy', 2], ['cloudy', 2], ['rain', 3], ['thunderstorm', 2], ['monsoon', 1.5], ['hurricane', 0.2]),
    autumn: T(['clear', 2], ['partly-cloudy', 3], ['sunshower', 2], ['rain', 2], ['thunderstorm', 1], ['hurricane', 0.2]),
    winter: T(['clear', 5], ['partly-cloudy', 3], ['sunshower', 1], ['rain', 1]),
    year: T(['clear', 3], ['partly-cloudy', 3], ['sunshower', 1], ['rain', 2], ['thunderstorm', 1]),
  } },
});

// A number 0–1 for each whole step, the same every time for a seed.
const hash = (n, seed) => { let x = Math.imul((n | 0) ^ Math.imul(seed | 0, 0x9e3779b1), 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16; return (x >>> 0) / 4294967296; };
// A slow wave: the steps' numbers eased into one another, `span` blocks apart, two of them laid together.
const wave = (block, seed) => {
  const at = (t, span, s) => { const i = Math.floor(t / span), f = t / span - i, e = f * f * (3 - 2 * f); return hash(i, s) * (1 - e) + hash(i + 1, s) * e; };
  const v = 0.7 * at(block, 5, seed) + 0.3 * at(block, 2, seed + 101);
  // Spread back out toward an even 0–1 (two waves laid together bunch toward the middle).
  return Math.min(0.999, Math.max(0, 0.5 + (v - 0.5) * 1.6));
};

// The weather for a block (pure): `day` a whole-day count (any epoch, the calendar's), `hour` 0–23, `climate` a CLIMATES
// key, `season` spring/summer/autumn/winter or null, `seed` the world's own number.
export function forecastAt({ day = 0, hour = 0, climate = 'temperate', season = null, seed = 0 } = {}) {
  const table = (CLIMATES[climate] ?? CLIMATES.temperate).seasons[season ?? 'year'] ?? CLIMATES.temperate.seasons.year;
  const block = Math.floor(day) * (24 / BLOCK_HOURS) + Math.floor((((Number(hour) || 0) % 24) + 24) % 24 / BLOCK_HOURS);
  const total = table.reduce((s, [, w]) => s + w, 0);
  let pick = wave(block, seed) * total;
  for (const [id, w] of table) { if (pick < w) return id; pick -= w; }
  return table.at(-1)[0];
}
// How warm a climate's season is by day, °C, nudged by the weather itself.
const WARMTH = { temperate: { spring: 12, summer: 24, autumn: 11, winter: 1, year: 13 }, cold: { spring: 1, summer: 12, autumn: 0, winter: -14, year: 0 },
  dry: { spring: 27, summer: 38, autumn: 26, winter: 15, year: 27 }, tropical: { spring: 28, summer: 30, autumn: 28, winter: 26, year: 28 } };
const NUDGE = { 'heat-wave': 8, overcast: -2, rain: -3, drizzle: -2, thunderstorm: -3, fog: -2, sleet: -4 };
// The weather as the sky reads a calendar's (pure): { id, temperature }. Snow and the like always cold enough to lie.
export function forecastWeather(at = {}) {
  const id = forecastAt(at), climate = WARMTH[at.climate] ? at.climate : 'temperate', base = WARMTH[climate][at.season ?? 'year'] ?? WARMTH[climate].year;
  let temperature = base + (NUDGE[id] ?? 0);
  if (['snow', 'blizzard', 'ice-storm'].includes(id)) temperature = Math.min(temperature, -4);
  if (id === 'sleet') temperature = Math.min(temperature, 0);
  return { id, temperature };
}
// A run of days, each its blocks' weathers (pure), for a forecast to show.
export const forecastDays = ({ from = 0, days = 7, ...rest } = {}) => Array.from({ length: days }, (_, d) => Array.from({ length: 24 / BLOCK_HOURS }, (_, b) => forecastAt({ ...rest, day: from + d, hour: b * BLOCK_HOURS })));
