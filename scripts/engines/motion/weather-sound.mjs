// The weather heard (assets/sounds/weather, each folder's License.txt): rain, wind and hail as loops crossfading with how much of each there
// is now, and thunder after each lightning flash. Muffled to a third from under a roof.

const DIR = 'modules/animater/assets/sounds/weather';
export const WEATHER_LOOPS = Object.freeze({
  rainLight: [`${DIR}/rain/weather-rainLight-96729-0.ogg`],
  rainHeavy: [`${DIR}/rain/weather-rainHeavy-200272-0.ogg`],
  windLight: ['181250-0', '181254-0', '181254-1'].map((n) => `${DIR}/wind/weather-windLight-${n}.ogg`),
  windStrong: [`${DIR}/wind/weather-windStrong-708746-0.ogg`],
  hail: ['240295-0', '240295-1', '413729-0'].map((n) => `${DIR}/hail/weather-hail-${n}.ogg`),
});
export const THUNDER = Object.freeze({
  close: ['194364-0', '361772-0', '361772-1', '501745-0', '501745-1'].map((n) => `${DIR}/thunder/thunderClose-${n}.ogg`),
  far: ['616987-1'].map((n) => `${DIR}/thunder/thunderFar-${n}.ogg`),
});
const clamp = (v) => Math.max(0, Math.min(1, Number(v) || 0));
const ramp = (v, from, to) => clamp((v - from) / (to - from));
export const WEATHER_VOLUME = Object.freeze({ rainLight: 0.3, rainHeavy: 0.45, windLight: 0.2, windStrong: 0.36, hail: 0.4 });

// How loud each loop is now (pure): `rain`, `wind` 0-1, `storm` how fierce (a storm's rain is heavy), `words` the weather's names (for hail), `inside`
// under a roof (a third). Volumes to fade to: light rain gives way to heavy, a breeze to a gale.
export function weatherLevels({ rain = 0, wind = 0, storm = 0, words = '', inside = false } = {}) {
  const wet = clamp(rain), hard = Math.max(ramp(wet, 0.45, 0.85), storm > 0 ? 0.7 : 0), hailing = /hail|sleet/i.test(words) ? 1 : 0;
  const gale = ramp(wind, 0.55, 0.85), breeze = ramp(wind, 0.1, 0.3) * (1 - gale), roof = inside ? 0.33 : 1;
  const raining = hailing ? wet * 0.5 : wet;
  return {
    rainLight: WEATHER_VOLUME.rainLight * raining * (1 - hard) * roof,
    rainHeavy: WEATHER_VOLUME.rainHeavy * raining * hard * roof,
    windLight: WEATHER_VOLUME.windLight * breeze * roof,
    windStrong: WEATHER_VOLUME.windStrong * gale * roof,
    hail: WEATHER_VOLUME.hail * hailing * roof,
  };
}

// Which of Calendaria's weathers Animater sounds itself (pure): the rest (Gravewind, Black Sun and such) keep Calendaria's own.
const OURS = new Set(['rain', 'drizzle', 'sunshower', 'acid-rain', 'blood-rain', 'windy', 'wind', 'snow', 'sleet', 'hail', 'thunderstorm', 'blizzard', 'ice-storm', 'sandstorm', 'dust-devil', 'hurricane', 'monsoon', 'tornado']);
export const weatherIsOurs = (id) => OURS.has(String(id ?? '').toLowerCase());

// Thunder after a flash (pure): near now and then, a clap almost at once, loud; else far, a rumble some seconds later, quiet. `random` 0-1 twice.
// Far strikes use the far recording, or a close one slowed and softened. { file, wait ms, volume, rate }.
export function thunderFor({ storm = 0.5, random = Math.random } = {}) {
  const near = random() < 0.25 + clamp(storm) * 0.25, pick = (list) => list[Math.floor(random() * list.length) % list.length];
  if (near) return { file: pick(THUNDER.close), wait: 150 + random() * 700, volume: 0.62 + random() * 0.2, rate: 0.92 + random() * 0.16, near: true };
  const own = random() < 0.5;
  return { file: own ? pick(THUNDER.far) : pick(THUNDER.close), wait: 1800 + random() * 4500, volume: own ? 0.42 + random() * 0.2 : 0.2 + random() * 0.12, rate: own ? 0.9 + random() * 0.2 : 0.68 + random() * 0.12, near: false };
}

// One recording for a scene (pure), the same on every visit: `seed` its id.
export function weatherFile(kind, seed = '') {
  const files = WEATHER_LOOPS[kind]; if (!files?.length) return null;
  let h = 0; for (const c of String(seed)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return files[h % files.length];
}
