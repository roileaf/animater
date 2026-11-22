// How painted floors lie on one another, and where water shows through them (pure).
import { areaOf } from './floor-motion.mjs';

const boxOf = (areas) => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const area of areas ?? []) for (let i = 0; i + 1 < area.length; i += 2) { x0 = Math.min(x0, area[i]); x1 = Math.max(x1, area[i]); y0 = Math.min(y0, area[i + 1]); y1 = Math.max(y1, area[i + 1]); }
  return x1 >= x0 ? [x0, y0, x1, y1] : null;
};
const meet = (a, b) => !!a && !!b && a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];

/**
 * The floors to paint, bottom first. `floors` [{ id, areas, over (built over water: a dock, a deck), ... }], `waters` the
 * moving water [{ id, areas }]. The biggest floor lies at the bottom and a smaller one on it: a road on its meadow, a
 * room's boards on the yard round it. Ones of a size go by their ids, so the order is the same on every screen and
 * after every reload.
 *
 * Moving water is drawn under every painted floor. Each floor is given, as `under`, the areas of the water that is
 * smaller than it and reaches it: the painter opens the floor there, so a pond shows in the meadow it lies in. A floor
 * smaller than the water (an islet, stepping stones) stays on it, and so does whatever is built over water.
 */
export function floorStack(floors = [], waters = []) {
  const lakes = (waters ?? []).map((w) => ({ areas: w.areas ?? [], size: areaOf(w.areas ?? []), box: boxOf(w.areas) })).filter((w) => w.size > 0);
  return (floors ?? [])
    .map((floor) => ({ floor, size: areaOf(floor.areas ?? []), box: boxOf(floor.areas) }))
    .sort((a, b) => b.size - a.size || (String(a.floor.id) < String(b.floor.id) ? -1 : String(a.floor.id) > String(b.floor.id) ? 1 : 0))
    .map(({ floor, size, box }) => ({ ...floor, under: floor.over ? [] : lakes.filter((w) => w.size < size && meet(w.box, box)).flatMap((w) => w.areas) }));
}
