// A scene's weather, built by the GM (the Weather panel in the Animater controls). It starts from whatever weather is
// drawn (sky-weather.mjs weatherScene) and each control overrides one thing; left alone (null) it follows the weather.
// So anything can be built on any weather: what falls, and every effect any weather has.
// Kept in the scene's flags as `weatherTune`, always with every key, so a save replaces what was there.
import { FALL_COLORS, FALL_KINDS } from './sky-weather.mjs';

// What can be chosen to fall, as the list shows it.
export const FALL_CHOICES = Object.freeze({ rain: 'Rain', snow: 'Snow', hail: 'Hail', ash: 'Ash', petal: 'Petals', leaf: 'Leaves', spore: 'Spores', sand: 'Sand', ember: 'Embers', gust: 'Wind gusts', debris: 'Debris' });
const FALL_KEYS = ['fall', 'fall2'];
// How much falls when chosen, before the Amount slider.
const CHOSEN_AMOUNT = 0.7;

// The effects any weather can have, named as the panel shows them. `color` the key of its colour, `tint` its colour by default.
export const TUNE_EFFECTS = Object.freeze({
  mist: { label: 'Low mist', hint: 'Thin veils lying low over the ground.' },
  curtains: { label: 'Rain sheets', hint: 'Broad grey sheets of rain sweeping across.' },
  bands: { label: 'Spiral clouds', hint: "A hurricane's bands of cloud." },
  tornado: { label: 'Tornado', hint: 'A funnel turning over the map.' },
  dustDevil: { label: 'Dust devil', hint: 'A small whirl of dust.' },
  smoke: { label: 'Smoke', hint: 'Smoke billowing across.' },
  heat: { label: 'Heat haze', hint: 'The air shimmering over the map.' },
  frost: { label: 'Frost', hint: 'Frost creeping over everything.' },
  glaze: { label: 'Ice glaze', hint: "Freezing rain's shine on the ground." },
  rays: { label: 'Sun rays', hint: 'Shafts of light with motes in them.' },
  glow: { label: 'Glow', color: 'glowColor', tint: [1, 0.86, 0.42], hint: 'A light or a pall over everything.' },
  aurora: { label: 'Aurora', color: 'auroraColor', tint: [0.3, 1, 0.62], hint: 'Curtains of light in the sky.' },
  sparks: { label: 'Sparks', color: 'sparksColor', tint: [0.3, 0.66, 1], hint: 'Sparks along drifting currents.' },
  wisps: { label: 'Wisps', color: 'wispsColor', tint: [0.62, 0.86, 0.72], hint: 'Pale drifting spirits.' },
  meteors: { label: 'Meteors', hint: 'Streaks across the sky.' },
  noise: { label: 'Static', hint: 'A faint crackling static.' },
});

const strength = (label, hint) => ({ label, min: 0, max: 1, step: 0.05, hint });
// Sliders. `times`: a multiple of the weather's own (shown as %). The others set the value outright.
export const TUNE_SLIDERS = Object.freeze({
  amount: { label: 'Amount', min: 0, max: 2, step: 0.05, times: true, hint: 'How much falls. Also how wet the ground gets, how fast snow lies, how loud the rain is and how fast it washes blood away.' },
  size: { label: 'Size', min: 0.4, max: 2, step: 0.05, times: true, hint: 'How big the drops and flakes are.' },
  speed: { label: 'Speed', min: 0.25, max: 3, step: 0.05, times: true, hint: 'How fast it falls.' },
  amount2: { label: 'Amount', min: 0, max: 1.5, step: 0.05, default: 0.5, hint: 'How much of the second thing falls.' },
  temperature: { label: 'Temperature', min: -30, max: 45, step: 1, default: 15, unit: '°C', hint: 'How cold or hot it is here. Snow lies or melts by it and water freezes or thaws, by the game clock; breath shows in the cold, and the air shimmers in great heat. Works in any weather: a cold, sunny day.' },
  fog: strength('Fog', 'How thick the fog is, in any weather.'),
  lightning: strength('Lightning', 'How fierce the storm is: how often lightning strikes and lands on the map, with its thunder. At full, a bolt every few seconds.'),
  wind: strength('Strength', 'How hard the wind blows, for the clouds, the grass, the leaves and the water too.'),
  cover: strength('Cloud cover', 'How much of the sky is cloud. Less sun reaches the ground under more.'),
  ...Object.fromEntries(Object.entries(TUNE_EFFECTS).map(([key, e]) => [key, strength(e.label, e.hint)])),
});
export const TUNE_COLORS = Object.freeze({
  color: { label: 'Colour', hint: 'What falls: red for blood rain, grey for ash. Only the look; it wets the ground as before.' },
  color2: { label: 'Colour', hint: 'The second thing falling.' },
  fogColor: { label: 'Fog colour', hint: 'The fog, where there is some.' },
  ...Object.fromEntries(Object.values(TUNE_EFFECTS).filter((e) => e.color).map((e) => [e.color, { label: `${e.label} colour`, hint: `The colour of the ${e.label.toLowerCase()}.` }])),
});
const KEYS = [...FALL_KEYS, ...Object.keys(TUNE_SLIDERS), ...Object.keys(TUNE_COLORS)];
const HEX = /^#[0-9a-f]{6}$/i;

// Whatever was saved, made safe (pure): every key, each in range or null. A multiple of exactly 1 is the weather's own.
export function cleanTune(raw = null) {
  const out = {};
  for (const key of KEYS) {
    const value = raw?.[key], slider = TUNE_SLIDERS[key];
    if (FALL_KEYS.includes(key)) { out[key] = value === 'none' || Object.hasOwn(FALL_CHOICES, value ?? '') ? value : null; continue; }
    if (!slider) { out[key] = typeof value === 'string' && HEX.test(value) ? value : null; continue; }
    const n = value === null || value === undefined || value === '' ? NaN : Number(value);
    out[key] = !Number.isFinite(n) || (slider.times && n === 1) ? null : Math.min(slider.max, Math.max(slider.min, n));
  }
  return out;
}
export const tuneTouched = (tune) => KEYS.some((key) => tune?.[key] !== null && tune?.[key] !== undefined);
const chosen = (kind) => !!kind && kind !== 'none';
// Whether it asks for something to be drawn even where the weather draws nothing.
export const tuneAdds = (tune) => chosen(tune?.fall) || chosen(tune?.fall2) || (Number(tune?.fog) || 0) > 0 || Object.keys(TUNE_EFFECTS).some((key) => (Number(tune?.[key]) || 0) > 0);
export const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);

// The most that can fall (the shader's streaks and flakes fill up past this anyway).
const MOST_FALLING = 1.5;
const fallOf = (kind, amount) => ({ kind: FALL_KINDS[kind], amount, size: 1, color: FALL_COLORS[kind] ?? [1, 1, 1] });

// How strong an effect is in a weather as it stands (pure): where a slider left alone sits.
export function effectIn(scene, key) {
  if (!scene) return 0;
  if (key === 'tornado') return scene.swirl[0] === 1 ? scene.swirl[1] : 0;
  if (key === 'dustDevil') return scene.swirl[0] === 2 ? scene.swirl[1] : 0;
  if (key === 'fog' || TUNE_EFFECTS[key]?.color) return scene[key]?.[3] ?? 0;
  if (key === 'lightning') return scene.storm ?? 0;
  return Number(scene[key]) || 0;
}

// The weather to draw, built (pure; the weather given is left as it was).
export function tuneWeather(scene, tune) {
  if (!scene || !tuneTouched(tune)) return scene;
  const amount = tune.amount ?? 1, size = tune.size ?? 1, color = tune.color ? hexToRgb(tune.color) : null;
  const fogColor = tune.fogColor ? hexToRgb(tune.fogColor) : scene.fog[3] > 0 ? scene.fog.slice(0, 3) : [0.86, 0.88, 0.9];
  const first = tune.fall === 'none' ? [] : tune.fall ? [fallOf(tune.fall, CHOSEN_AMOUNT)] : scene.falls.slice(0, tune.fall2 ? 1 : 2);
  const main = first.map((f) => ({ ...f, amount: Math.min(MOST_FALLING, f.amount * amount), size: f.size * size, color: color ?? f.color }));
  const second = chosen(tune.fall2) ? [{ ...fallOf(tune.fall2, tune.amount2 ?? TUNE_SLIDERS.amount2.default), size, ...(tune.color2 ? { color: hexToRgb(tune.color2) } : {}) }] : [];
  const out = { ...scene, falls: [...main, ...second].slice(0, 2), curtains: Math.min(1, scene.curtains * amount), fog: [...fogColor, tune.fog ?? scene.fog[3]], storm: tune.lightning ?? scene.storm, speed: tune.speed ?? 1 };
  for (const [key, effect] of Object.entries(TUNE_EFFECTS)) {
    if (key === 'tornado' || key === 'dustDevil') continue;
    if (effect.color) {
      const own = scene[key], rgb = tune[effect.color] ? hexToRgb(tune[effect.color]) : own[3] > 0 ? own.slice(0, 3) : effect.tint;
      out[key] = [...rgb, tune[key] ?? own[3]];
    } else if (tune[key] !== null) out[key] = tune[key];
  }
  if (tune.tornado) out.swirl = [1, tune.tornado];
  else if (tune.dustDevil) out.swirl = [2, tune.dustDevil];
  else if (tune.tornado === 0 || tune.dustDevil === 0) out.swirl = [0, 0];
  return out;
}

// How much rain and snow really falls, for what follows it: the ground, the rings on water, the sound, the wash (pure). Any other keys carry on.
// Snow chosen means it is cold enough for it to lie, whatever the calendar's temperature.
export function tuneFalling(falling, tune) {
  const amount = tune?.amount ?? 1, built = !!tune?.fall || !!tune?.fall2, degrees = tune?.temperature ?? null;
  if (amount === 1 && !built && degrees === null) return falling;
  let rain = falling.rain * amount, snow = falling.snow * amount;
  if (built) {
    const of = (kind, much) => { if (kind === 'rain') rain += much; if (kind === 'snow') snow += much; };
    if (tune.fall) { rain = 0; snow = 0; of(tune.fall, CHOSEN_AMOUNT * amount); }
    of(tune.fall2, tune.amount2 ?? TUNE_SLIDERS.amount2.default);
  }
  const out = { ...falling, rain: Math.min(1, rain), snow: Math.min(1, snow) };
  if ('temperature' in out) {
    if (degrees !== null) { out.temperature = degrees; out.air = degrees; }
    else if (built && snow > 0.05) { out.temperature = null; out.air = -5; }
  }
  return out;
}

// The names the sounds go by, for what the GM built (pure): hail has its own, and snow in a hard wind howls as a blizzard.
export function tuneWords(tune, wind = 0) {
  if (!tune) return '';
  const falls = [tune.fall, tune.fall2];
  return `${falls.includes('hail') ? ' hail' : ''}${falls.includes('snow') && wind >= 0.6 ? ' blizzard' : ''}`;
}
