// The weather drawn on the map (sky-light.mjs's pass over the roofs): what falls, drifts and glows for each of
// Calendaria's weathers, from its own presets ({ id, precipitation: { type, intensity }, wind: { speed 0–5 }, color }).
// Every effect is drawn on the GPU in one pass, whatever the weather, so a blizzard costs what a drizzle does.

// What can fall or blow across the map, and how each looks by default (its colour, rgb 0–1).
export const FALL_KINDS = Object.freeze({ rain: 1, snow: 2, hail: 3, ash: 4, petal: 5, leaf: 6, spore: 7, sand: 8, ember: 9, gust: 10, debris: 11 });
export const FALL_COLORS = Object.freeze({
  rain: [0.74, 0.82, 0.92], snow: [1, 1, 1], hail: [0.9, 0.95, 1], ash: [0.46, 0.44, 0.42], petal: [1, 0.74, 0.82],
  leaf: [0.82, 0.46, 0.17], spore: [0.66, 0.86, 0.36], sand: [0.84, 0.68, 0.42], ember: [1, 0.56, 0.2], gust: [1, 1, 1], debris: [0.36, 0.31, 0.25],
});

// Each weather: what falls ([kind, amount 0–1, size, colour?]), the fog ([r, g, b, amount]), how the clouds look from
// above ([r, g, b, how thick]), and the rest (light, aurora, sparks, wisps, static, meteors, a swirl), and: a closed grey
// cloud deck (`deck`), mist lying low (`mist`), sheets of rain sweeping across (`curtains`), a hurricane's spiral cloud
// bands (`bands`), freezing rain's glaze (`glaze`), frost creeping over all (`frost`), heat shimmering (`heat`), smoke
// billowing (`smoke`), 0–1 each; `storm` how fierce its lightning (0 none), `windMin` the least wind it blows with when neither the scene nor the calendar says how windy it is.
const RECIPES = Object.freeze({
  clear: {},
  'partly-cloudy': {},
  cloudy: {},
  overcast: {},
  drizzle: { fall: [['rain', 0.22, 0.5]] },
  rain: { fall: [['rain', 0.7, 1]] },
  fog: { fog: [0.86, 0.88, 0.9, 0.7] },
  mist: { mist: 1 },
  windy: { fall: [['gust', 0.7, 1]] },
  sunshower: { fall: [['rain', 0.3, 0.8, [1, 0.95, 0.8]]], glow: [1, 0.92, 0.7, 0.1] },
  snow: { fall: [['snow', 0.75, 1.1]] },
  sleet: { fall: [['rain', 0.45, 0.8], ['snow', 0.4, 0.7]] },
  'heat-wave': { heat: 1 },
  thunderstorm: { fall: [['rain', 1, 1.2]], curtains: 0.5, storm: 0.75 },
  blizzard: { fall: [['snow', 0.85, 0.9], ['snow', 0.5, 0.55]], fog: [0.92, 0.95, 1, 0.35], windMin: 0.85 },
  hail: { fall: [['hail', 0.7, 1], ['rain', 0.3, 0.8]] },
  tornado: { fall: [['rain', 0.6, 1.1], ['debris', 0.35, 1]], swirl: [1, 1], storm: 0.5, windMin: 0.7 },
  hurricane: { fall: [['rain', 1, 1.3]], bands: 1, curtains: 0.8, storm: 0.55, windMin: 1 },
  'ice-storm': { fall: [['rain', 0.55, 0.9, [0.82, 0.9, 1]], ['hail', 0.35, 0.55]], glaze: 1, windMin: 0.4 },
  monsoon: { fall: [['rain', 1, 1.4]], curtains: 1, fog: [0.62, 0.68, 0.74, 0.25], storm: 0.3 },
  ashfall: { fall: [['ash', 0.75, 1]], fog: [0.45, 0.4, 0.36, 0.25], clouds: [0.42, 0.38, 0.35, 1] },
  sandstorm: { fall: [['sand', 1, 1]], fog: [0.78, 0.6, 0.35, 0.35], windMin: 0.9 },
  'luminous-sky': { aurora: [0.3, 1, 0.62, 0.6] },
  'sakura-bloom': { fall: [['petal', 0.55, 1]] },
  'autumn-leaves': { fall: [['leaf', 0.5, 1]] },
  'rolling-fog': { fog: [0.82, 0.84, 0.86, 0.85] },
  'wildfire-smoke': { fall: [['ember', 0.35, 0.9], ['ash', 0.4, 0.8]], smoke: 1, fog: [0.5, 0.38, 0.28, 0.25], clouds: [0.45, 0.36, 0.28, 1] },
  'dust-devil': { fall: [['sand', 0.25, 0.8]], swirl: [2, 1] },
  'black-sun': { fog: [0.1, 0.05, 0.14, 0.45], glow: [0.06, 0.02, 0.1, 0.35], wisps: [0.08, 0.02, 0.12, 0.7] },
  'ley-surge': { sparks: [0.3, 0.66, 1, 0.8], aurora: [0.25, 0.6, 1, 0.35] },
  'aether-haze': { fog: [0.5, 0.27, 0.6, 0.5], sparks: [0.82, 0.55, 1, 0.3] },
  nullfront: { noise: 0.6, fog: [0.15, 0.12, 0.2, 0.4] },
  'permafrost-surge': { fall: [['snow', 0.35, 0.8]], frost: 1, fog: [0.7, 0.85, 1, 0.25] },
  gravewind: { wisps: [0.62, 0.86, 0.72, 0.7], fog: [0.3, 0.4, 0.35, 0.3] },
  veilfall: { fall: [['rain', 0.4, 0.8, [0.68, 0.58, 0.9]]], sparks: [0.72, 0.62, 1, 0.3] },
  'arcane-winds': { fall: [['gust', 0.6, 1, [0.78, 0.5, 1]]], sparks: [0.76, 0.38, 1, 0.7] },
  'acid-rain': { fall: [['rain', 0.6, 1, [0.55, 0.85, 0.3]]] },
  'blood-rain': { fall: [['rain', 0.85, 1.1, [0.8, 0.1, 0.14]]] },
  'meteor-shower': { meteors: 0.7 },
  'spore-cloud': { fall: [['spore', 0.7, 1]], fog: [0.53, 0.67, 0.27, 0.3] },
  'divine-light': { glow: [1, 0.86, 0.42, 0.22], rays: 0.7, sparks: [1, 0.86, 0.4, 0.3] },
  'plague-miasma': { fog: [0.33, 0.42, 0.18, 0.6], fall: [['spore', 0.3, 0.7, [0.5, 0.62, 0.25]]] },
});

const clamp01 = (v) => Math.min(1, Math.max(0, Number(v) || 0));

// A weather Calendaria knows by its precipitation only (a custom preset): rain, snow, sleet or hail by its kind.
const byPrecipitation = (type) => {
  const t = String(type ?? '').toLowerCase();
  if (/sleet/.test(t)) return { fall: [['rain', 0.45, 0.8], ['snow', 0.4, 0.7]] };
  if (/hail/.test(t)) return { fall: [['hail', 0.7, 1]] };
  if (/snow|blizzard/.test(t)) return { fall: [['snow', 0.6, 1]] };
  if (/drizzle/.test(t)) return { fall: [['rain', 0.35, 0.6]] };
  if (/rain|storm|shower/.test(t)) return { fall: [['rain', 0.7, 1]] };
  return {};
};

/**
 * What to draw for a weather (Calendaria's preset, or { id } alone): up to two things falling or blowing ({ kind (a
 * FALL_KINDS number), amount, size, color }), fog ([r, g, b, amount]), the clouds' colour and thickness from above
 * ([r, g, b, thickness 0–1], drawn as thick as the cover), a light over all ([r, g, b, amount]: gold, a dark pall), aurora
 * and sparks and wisps ([r, g, b, amount]), static (`noise` 0–1), meteors (0–1) and a swirl ([1 tornado | 2 dust devil,
 * amount]). A preset's own precipitation intensity sets how much falls; its colour tints coloured rain.
 */
export function weatherScene(preset = null) {
  const id = String(preset?.id ?? preset ?? '').toLowerCase();
  const recipe = RECIPES[id] ?? byPrecipitation(preset?.precipitation?.type);
  const intensity = Number(preset?.precipitation?.intensity);
  const falls = (recipe.fall ?? []).slice(0, 2).map(([kind, amount, size, color], i) => ({
    kind: FALL_KINDS[kind] ?? 0,
    // The first thing falling follows the preset's own intensity when it gives one: from half the recipe's amount to all of it.
    amount: clamp01(i === 0 && Number.isFinite(intensity) && intensity > 0 && /rain|snow|hail/.test(kind) ? amount * (0.5 + 0.5 * clamp01(intensity)) : amount),
    size: Number(size) || 1,
    color: color ?? FALL_COLORS[kind] ?? [1, 1, 1],
  }));
  return {
    falls,
    fog: recipe.fog ?? [1, 1, 1, 0],
    clouds: recipe.clouds ?? [1, 1, 1, 0],
    glow: recipe.glow ?? [1, 1, 1, 0],
    aurora: recipe.aurora ?? [0, 0, 0, 0],
    sparks: recipe.sparks ?? [0, 0, 0, 0],
    wisps: recipe.wisps ?? [0, 0, 0, 0],
    rays: recipe.rays ?? 0,
    noise: recipe.noise ?? 0,
    meteors: recipe.meteors ?? 0,
    swirl: recipe.swirl ?? [0, 0],
    deck: recipe.deck ?? 0, mist: recipe.mist ?? 0, curtains: recipe.curtains ?? 0, bands: recipe.bands ?? 0,
    glaze: recipe.glaze ?? 0, frost: recipe.frost ?? 0, heat: recipe.heat ?? 0, smoke: recipe.smoke ?? 0,
    storm: recipe.storm ?? 0, windMin: recipe.windMin ?? 0,
  };
}

// Whether anything is drawn for a weather (besides the clouds, which follow the cover).
export const weatherDrawn = (scene) => !!scene && (scene.falls.some((f) => f.kind && f.amount > 0.01) || scene.fog[3] > 0.01 || scene.glow[3] > 0.01
  || scene.aurora[3] > 0.01 || scene.sparks[3] > 0.01 || scene.wisps[3] > 0.01 || scene.rays > 0.01 || scene.noise > 0.01 || scene.meteors > 0.01 || scene.swirl[1] > 0.01
  || scene.deck > 0.01 || scene.mist > 0.01 || scene.curtains > 0.01 || scene.bands > 0.01 || scene.glaze > 0.01 || scene.frost > 0.01 || scene.heat > 0.01 || scene.smoke > 0.01);

// The weathers this draws (all of Calendaria's own).
export const WEATHERS = Object.freeze(Object.keys(RECIPES));

// The scene's own weather (Scene configuration → Weather Effect) when it is one of Animater's: its weather's id
// ('animater.blizzard' → 'blizzard'), else null.
export const SCENE_WEATHER_PREFIX = 'animater.';
export const sceneWeatherId = (weather) => (typeof weather === 'string' && weather.startsWith(SCENE_WEATHER_PREFIX) && Object.hasOwn(RECIPES, weather.slice(SCENE_WEATHER_PREFIX.length)) ? weather.slice(SCENE_WEATHER_PREFIX.length) : null);
// A weather's name for the list ('ice-storm' → 'Ice Storm').
export const weatherLabel = (id) => String(id).split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
