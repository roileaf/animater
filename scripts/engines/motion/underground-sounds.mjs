// The underground's sounds (assets/sounds/underground, each folder's License.txt): a cave-in's roar, a drop falling into
// a pool, a pool's slow lapping, the wind through a door just opened, a pebble kicked across the stone, rats and bats.

const DIR = 'modules/animater/assets/sounds/underground';
export const UNDERGROUND_SOUNDS = Object.freeze({
  caveIn: ['336023-0', '567249-0', '567250-0', '567251-0', '655368-0'].map((n) => `${DIR}/cave-in/cave-in-${n}.ogg`),
  drip: [0, 1, 2, 3].map((n) => `${DIR}/drips/drip-580931-${n}.ogg`),
  pool: ['234554-0', '343742-0', '392668-0'].map((n) => `${DIR}/pool-ambience/pool-${n}.ogg`),
  wind: ['575272-0', '576970-0', '864395-0'].map((n) => `${DIR}/door-wind/door-wind-${n}.ogg`),
  pebble: ['364711-0', '475287-1', '569510-0', '576103-0', '576105-0'].map((n) => `${DIR}/pebbles/pebble-${n}.ogg`),
  ratSqueak: ['217767-3', '463789-0', '463789-1', '463789-2', '463789-3'].map((n) => `${DIR}/rats/rat-squeak-${n}.ogg`),
  ratSkitter: [1, 2, 3, 4].map((n) => `${DIR}/rats/rat-skitter-415203-${n}.ogg`),
  batWing: [0, 1].map((n) => `${DIR}/bats/bat-wing-546823-${n}.ogg`),
  batChirp: ['404152-1', '455593-0', '455593-1', '455593-2'].map((n) => `${DIR}/bats/bat-chirp-${n}.ogg`),
});

// One of a kind's recordings (pure), never the one just played when there are others.
const last = {};
export function undergroundSound(kind, random = Math.random) {
  const files = UNDERGROUND_SOUNDS[kind]; if (!files?.length) return null;
  let i = Math.floor(random() * files.length) % files.length;
  if (files.length > 1 && i === last[kind]) i = (i + 1) % files.length;
  last[kind] = i;
  return files[i];
}

// How often the rats and bats may be heard at all, whatever their number: each kind waits between `gap` seconds [least,
// most] after it sounds, so a dozen rats are a scurry now and then and never a chatter. A rat bolting (`urgent`) needs only
// a second's quiet. wanted(kind, urgent) says whether this one sounds now, and starts the wait if so.
export const CRITTER_GAPS = Object.freeze({ ratSqueak: [4, 11], ratSkitter: [1.2, 3], batWing: [1.5, 3.5], batChirp: [4, 10] });
export function critterVoices({ gaps = CRITTER_GAPS, now = () => performance.now() / 1000, random = Math.random } = {}) {
  const next = {};
  return { wanted(kind, urgent = false) {
    const t = now(), gap = gaps[kind]; if (!gap) return false;
    if (t < (next[kind] ?? 0) - (urgent ? gap[0] - 1 : 0)) return false;
    next[kind] = t + gap[0] + random() * (gap[1] - gap[0]);
    return true;
  } };
}

// How loud a sound from a place is for whoever is nearest (pure): `from` { x, y } or a box { x, y, w, h } (heard from its
// nearest edge), `ears` the listeners' points, `reach` px; full at the source, fading out to nothing at `reach`.
export function heardFrom(from, ears = [], reach = 500) {
  let best = 0;
  for (const e of ears) {
    const dx = from.w ? Math.max(from.x - e.x, 0, e.x - from.x - from.w) : e.x - from.x, dy = from.h ? Math.max(from.y - e.y, 0, e.y - from.y - from.h) : e.y - from.y;
    const k = 1 - Math.hypot(dx, dy) / reach;
    if (k > best) best = k;
  }
  return best * best;
}
