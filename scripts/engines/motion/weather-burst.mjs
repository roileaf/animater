// A burst of weather: something falling (or a fog) over the map for a short while, on this screen only, over whatever
// weather the scene already has, then gone again. Nothing is stored on the scene, the ground does not get wet, no snow
// lies and the scene grows no darker: it is a flourish — a holiday dice set's natural 20 bringing half a minute of
// snow — not weather. (The ground goes by the game clock, on which half a minute is nothing; the dark of a storm is
// the scene's own darkness, which only a GM may write.) It is heard, though, rings the open water where it is rain, and
// a storm's flashes with its thunder — all on this screen, and all gone with it (burstFeel).
// Asked for through the module's API (weatherBurst), which any module may call on any client: it changes nothing but
// that viewer's own screen.
import { weatherScene, WEATHERS, FALL_KINDS } from './sky-weather.mjs';

// The longest one lasts, and the shortest; how long it takes to come and go, in seconds.
export const BURST_LONGEST_MS = 60000, BURST_SHORTEST_MS = 2000, BURST_FADE_S = 3;

const clamp = (v, lo, hi, or) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : or; };

// Whether a weather has anything a burst can show: something falling, or a fog.
const shows = (scene) => scene.falls.some((f) => f.kind && f.amount > 0) || scene.fog[3] > 0;
// The weathers a burst can be of.
export const BURST_WEATHERS = Object.freeze(WEATHERS.filter((id) => shows(weatherScene({ id }))));

// What was asked for, made safe (pure): { weather, strength 0–1, ms }, or null for a weather that is not one of ours
// or has nothing to show, or a strength of nothing.
export function burstCall({ weather = null, strength = 0.5, ms = 30000 } = {}) {
  const id = String(weather ?? '').toLowerCase();
  if (!BURST_WEATHERS.includes(id)) return null;
  const much = clamp(strength, 0, 1, 0.5);
  if (!(much > 0)) return null;
  return { weather: id, strength: much, ms: clamp(ms, BURST_SHORTEST_MS, BURST_LONGEST_MS, 30000) };
}

// The burst running after a call (pure). `running` { weather, strength, until } or null; `now` in ms. The same weather
// asked for again while it runs carries on to whichever end is later, at whichever strength is greater: two natural 20s
// in a row snow for longer, not twice as hard. Another weather takes its place.
export function burstAfter(running, call, now) {
  if (!call) return running ?? null;
  const until = now + call.ms;
  if (running && running.weather === call.weather && running.until > now) return { weather: call.weather, strength: Math.max(running.strength, call.strength), until: Math.max(running.until, until) };
  return { weather: call.weather, strength: call.strength, until };
}

// The weather to draw with a burst over it (pure; the weather given is left as it was). `scene`: what the map draws now
// (sky-weather.mjs weatherScene's shape), or null for none. The burst's own main fall is laid over the scene's: beside
// its first where there is room (two things can fall at once), more of the same where it is already falling. Its fog
// thickens the scene's, never thins it.
export function burstOver(scene, burst) {
  if (!burst) return scene;
  const own = weatherScene({ id: burst.weather }), much = clamp(burst.strength, 0, 1, 0);
  const base = scene ?? weatherScene({ id: 'clear' });
  const out = { ...base, falls: base.falls.map((f) => ({ ...f })) };
  const fall = own.falls.find((f) => f.kind && f.amount > 0);
  if (fall && much > 0) {
    const laid = { ...fall, amount: fall.amount * much };
    const same = out.falls.find((f) => f.kind === laid.kind);
    if (same) same.amount = Math.max(same.amount, laid.amount);
    else out.falls = [...out.falls.filter((f) => f.kind && f.amount > 0).slice(0, 1), laid];
  }
  if (own.fog[3] > 0 && much > 0 && own.fog[3] * much > base.fog[3]) out.fog = [...own.fog.slice(0, 3), own.fog[3] * much];
  return out;
}

// What a burst is felt as besides what is drawn (pure): how much rain it is (0–1: for its sound and the rings on open
// water; snow and ash are silent and ring nothing), how fierce a storm (0–1: for its flashes and thunder), and its name
// (the sound knows hail and a blizzard by theirs). All nothing with no burst.
export function burstFeel(burst) {
  if (!burst) return { rain: 0, storm: 0, words: '' };
  const own = weatherScene({ id: burst.weather }), much = clamp(burst.strength, 0, 1, 0);
  const rain = own.falls.filter((f) => f.kind === FALL_KINDS.rain).reduce((sum, f) => sum + f.amount, 0);
  return { rain: Math.min(1, rain * much), storm: Math.min(1, (Number(own.storm) || 0) * much), words: burst.weather };
}
