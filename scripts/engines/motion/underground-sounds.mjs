// The underground's sounds (assets/sounds/underground, each folder's License.txt): a cave-in's roar, a drop falling into
// a pool, a pool's slow lapping, the wind through a door just opened, a pebble kicked across the stone.

const DIR = 'modules/animater/assets/sounds/underground';
export const UNDERGROUND_SOUNDS = Object.freeze({
  caveIn: ['336023-0', '567249-0', '567250-0', '567251-0', '655368-0'].map((n) => `${DIR}/cave-in/cave-in-${n}.ogg`),
  drip: [0, 1, 2, 3].map((n) => `${DIR}/drips/drip-580931-${n}.ogg`),
  pool: ['234554-0', '343742-0', '392668-0'].map((n) => `${DIR}/pool-ambience/pool-${n}.ogg`),
  wind: ['575272-0', '576970-0', '864395-0'].map((n) => `${DIR}/door-wind/door-wind-${n}.ogg`),
  pebble: ['364711-0', '475287-1', '569510-0', '576103-0', '576105-0'].map((n) => `${DIR}/pebbles/pebble-${n}.ogg`),
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
