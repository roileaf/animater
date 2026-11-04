// The sound of a place heard as you come near it (assets/sounds/places, its License.txt): the sea, a waterfall, flies at a body, the murmur of a tavern.
// One loop for each kind, as loud as the nearest listener is near the nearest of them. Pure: main.mjs plays what this says, as it does the rivers.
import { nearestOfArea } from './river-sound.mjs';
import { COAST_SOUNDS, COAST_REACH } from './coast.mjs';

const DIR = 'modules/animater/assets/sounds/places';
export const PLACE_SOUNDS = Object.freeze({
  surf: COAST_SOUNDS,
  waterfall: ['344380-0', '476162-0'].map((n) => `${DIR}/waterfall-${n}.ogg`),
  flies: ['198278-0', '484363-0'].map((n) => `${DIR}/flies-${n}.ogg`),
  tavern: ['455732-0', '267496-0', '394290-0', '376456-0'].map((n) => `${DIR}/tavern-${n}.ogg`),
});
// How far each carries (squares) and how loud close by.
export const PLACE_REACH = Object.freeze({ surf: COAST_REACH, waterfall: 14, flies: 4, tavern: 7 });
export const PLACE_VOLUME = Object.freeze({ surf: 0.4, waterfall: 0.42, flies: 0.3, tavern: 0.38 });
// How much of a place comes through a wall: a shut tavern is a far-off murmur, its open door lets the noise out.
export const THROUGH_WALL = 0.22;

// How much of a place is heard (pure): `areas` flat polygons, `ears` the listening points, `grid` px a square. { level 0-1, from, at }: `from` the listener nearest it, `at` the place nearest them.
export function placeHeard(kind, areas = [], ears = [], { grid = 100 } = {}) {
  const reach = (PLACE_REACH[kind] ?? 0) * grid, out = { level: 0, from: null, at: null };
  if (!(reach > 0)) return out;
  for (const ear of ears) for (const area of areas) {
    const near = nearestOfArea(ear, area), level = Math.max(0, 1 - near.d / reach) ** 2;
    if (level > out.level) { out.level = level; out.from = ear; out.at = near; }
  }
  return out;
}

// The same for things at points, each as strong as it is now (pure): `spots` [{ x, y, strength 0-1 }].
export function spotsHeard(kind, spots = [], ears = [], { grid = 100 } = {}) {
  const reach = (PLACE_REACH[kind] ?? 0) * grid, out = { level: 0, from: null, at: null };
  if (!(reach > 0)) return out;
  for (const ear of ears) for (const spot of spots) {
    const d = Math.hypot(ear.x - spot.x, ear.y - spot.y), level = Math.max(0, 1 - d / reach) ** 2 * Math.max(0, Math.min(1, Number(spot.strength) || 0));
    if (level > out.level) { out.level = level; out.from = ear; out.at = { d, x: spot.x, y: spot.y }; }
  }
  return out;
}

// One recording for a scene (pure), the same on every visit: `seed` its id.
export function placeFile(kind, seed = '') {
  const files = PLACE_SOUNDS[kind]; if (!files?.length) return null;
  let h = 0; for (const c of String(seed)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return files[h % files.length];
}
