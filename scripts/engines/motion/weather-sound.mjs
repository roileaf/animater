// The weather heard (assets/sounds/weather, each folder's License.txt): rain, wind and hail as loops crossfading with how much of each there
// is now, and thunder after each lightning flash. Muffled to a third from under a roof.

const DIR = 'modules/animater/assets/sounds/weather';
export const WEATHER_LOOPS = Object.freeze({
  rainLight: [`${DIR}/rain/weather-rainLight-96729-0.ogg`],
  rainHeavy: [`${DIR}/rain/weather-rainHeavy-200272-0.ogg`],
  windLight: ['181250-0', '181254-0', '181254-1'].map((n) => `${DIR}/wind/weather-windLight-${n}.ogg`),
  windStrong: [`${DIR}/wind/weather-windStrong-708746-0.ogg`],
  hail: ['240295-0', '240295-1', '413729-0'].map((n) => `${DIR}/hail/weather-hail-${n}.ogg`),
  blizzard: ['521820-0', '243348-0', '493680-0'].map((n) => `${DIR}/blizzard/weather-blizzard-${n}.ogg`),
});
export const THUNDER = Object.freeze({
  close: ['194364-0', '361772-0', '361772-1', '501745-0', '501745-1'].map((n) => `${DIR}/thunder/thunderClose-${n}.ogg`),
  far: ['616987-1', '574386-0', '367702-0', '568969-1', '568969-0'].map((n) => `${DIR}/thunder/thunderFar-${n}.ogg`),
});
const clamp = (v) => Math.max(0, Math.min(1, Number(v) || 0));
const ramp = (v, from, to) => clamp((v - from) / (to - from));
export const WEATHER_VOLUME = Object.freeze({ rainLight: 0.3, rainHeavy: 0.45, windLight: 0.2, windStrong: 0.36, hail: 0.4, blizzard: 0.42 });

// How loud each loop is now (pure): `rain`, `wind` 0-1, `storm` how fierce (a storm's rain is heavy), `words` the weather's names (for hail), `inside`
// under a roof (a third). Volumes to fade to: light rain gives way to heavy, a breeze to a gale. Wind is only heard from moderate (Calendaria's 0.4) up.
export function weatherLevels({ rain = 0, wind = 0, storm = 0, words = '', inside = false } = {}) {
  const wet = clamp(rain), hard = Math.max(ramp(wet, 0.45, 0.85), storm > 0 ? 0.7 : 0), hailing = /hail|sleet/i.test(words) ? 1 : 0;
  // A blizzard has its own howl, in place of the plain wind.
  const howling = /blizzard|snow[- ]?storm/i.test(words) ? 1 : 0;
  const gale = ramp(wind, 0.55, 0.85) * (1 - howling), breeze = ramp(wind, 0.3, 0.4) * (1 - ramp(wind, 0.55, 0.85)) * (1 - howling), roof = inside ? 0.33 : 1;
  const raining = hailing ? wet * 0.5 : wet;
  return {
    rainLight: WEATHER_VOLUME.rainLight * raining * (1 - hard) * roof,
    rainHeavy: WEATHER_VOLUME.rainHeavy * raining * hard * roof,
    windLight: WEATHER_VOLUME.windLight * breeze * roof,
    windStrong: WEATHER_VOLUME.windStrong * gale * roof,
    hail: WEATHER_VOLUME.hail * hailing * roof,
    blizzard: WEATHER_VOLUME.blizzard * howling * roof,
  };
}

// How loud the weather is on this screen (pure): its player's Weather volume, a percent, to a factor 0-1. Unset or broken plays as recorded.
export const weatherLoudness = (percent) => { const n = Number(percent); return percent === null || percent === undefined || percent === '' || !Number.isFinite(n) ? 1 : clamp(n / 100); };
// Every loop's level by that factor (pure).
export const louder = (levels, by = 1) => Object.fromEntries(Object.entries(levels ?? {}).map(([kind, v]) => [kind, v * by]));

// Which of Calendaria's weathers Animater sounds itself (pure): the rest (Gravewind, Black Sun and such) keep Calendaria's own.
const OURS = new Set(['rain', 'drizzle', 'sunshower', 'acid-rain', 'blood-rain', 'windy', 'wind', 'snow', 'sleet', 'hail', 'thunderstorm', 'blizzard', 'ice-storm', 'sandstorm', 'dust-devil', 'hurricane', 'monsoon', 'tornado']);
export const weatherIsOurs = (id) => OURS.has(String(id ?? '').toLowerCase());

// How to play each recording for them to be equally loud (measured, to -24 LUFS; the peaks stay under full scale): only how far off it struck should say how loud thunder is.
const THUNDER_GAIN = Object.freeze({ '194364-0': 0.66, '361772-0': 1.1, '361772-1': 1, '501745-0': 1.66, '501745-1': 1.05, '616987-1': 4.4, '574386-0': 0.52, '367702-0': 0.72, '568969-1': 1.23, '568969-0': 1.07 });
export const thunderGain = (file) => THUNDER_GAIN[String(file).match(/(\d+-\d+)\.ogg$/)?.[1]] ?? 1;
const between = (v, from, to) => { const k = clamp((v - from) / (to - from)); return k * k * (3 - 2 * k); };
// Thunder by how far off it struck (pure): one curve from a crack overhead, with a boom under it, to a low rumble at the far side of the map, nothing about it stepping. `squares` how far; `span` how far is far here, the map's own corner to corner, so distance tells on a small map too.
// { file, wait ms, volume, rate, cutoff Hz (null: unfiltered), under { volume, rate } (the boom; null: none), level (its loudness before the recording's own correction) }.
export function thunderShape({ squares = 10, span = 32, random = Math.random } = {}) {
  const t = clamp(squares / Math.max(14, span)), distant = random() < between(t, 0.45, 0.9) * 0.6;
  const list = distant ? THUNDER.far : THUNDER.close, file = list[Math.floor(random() * list.length) % list.length], gain = thunderGain(file);
  const level = Math.pow(10, (-17 * Math.pow(t, 0.8)) / 20) * 0.95, boom = 0.9 * (1 - between(t, 0, 0.55)), drift = random();
  return {
    file, level, wait: Math.min(6500, 20 + Math.max(0, squares - 1) * 110) + (squares > 2 ? random() * 120 * t : 0), volume: level * gain,
    rate: (distant ? 0.95 : 1 - 0.26 * between(t, 0, 0.7)) + (drift - 0.5) * 0.08,
    cutoff: t < 0.12 ? null : 18000 * Math.pow(650 / 18000, t),
    under: boom > 0.02 ? { volume: boom * gain, rate: 0.58 + drift * 0.08 } : null,
  };
}
// A strike right beside whoever hears it is on them at once (pure): it waits for nothing.
export const thunderOnTopOf = (squares) => squares <= 3;
// Whether it is heard at all (pure): always when it is anywhere near; further off now and then it is lost in the storm.
export const thunderReaches = ({ squares = 10, span = 32, storm = 0.5, random = Math.random } = {}) => { const t = clamp(squares / Math.max(14, span)); return t < 0.6 || random() < 0.6 + 0.4 * clamp(storm); };
// Which side a strike is heard from (pure, -1 left to 1 right): by its direction from whoever hears it, however far, moving to both ears only when it is almost on top of them. Never wholly in one ear.
export function thunderPan(from, at, grid = 100) {
  const dx = at.x - from.x, dy = at.y - from.y, far = Math.hypot(dx, dy);
  return far > 0 ? (dx / far) * 0.8 * Math.min(1, far / (grid * 2)) : 0;
}

// One recording for a scene (pure), the same on every visit: `seed` its id.
export function weatherFile(kind, seed = '') {
  const files = WEATHER_LOOPS[kind]; if (!files?.length) return null;
  let h = 0; for (const c of String(seed)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return files[h % files.length];
}
