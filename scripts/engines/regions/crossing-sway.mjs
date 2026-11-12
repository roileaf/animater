// How what hangs over a drop moves in the wind (Map painting's Heights crossings): a bridge sways side to side, most at
// mid-span and not where it rests on raised ground; a climbing rope swings from its stake, most toward its foot. Ladders lean
// on rock and stay put. Gentle in a light wind; as it strengthens the sway grows and a ripple runs along the planks, each a
// little behind the last. (Roi chose between a gentle and a livelier mock, then: "make it move based on the wind strength no?")
// Pure: main.mjs draws each piece once into a picture on a bending sheet and moves the sheet's points by these numbers.

/** How far (px) a crossing swings at its most in a wind of `wind` (0-1), `grid` px a square: a few pixels in a breeze, about a
 *  quarter square in a gale. */
export const swayReach = (wind, grid = 100) => grid * (0.03 + 0.22 * Math.pow(Math.max(0, Math.min(1, Number(wind) || 0)), 1.6));

/** How much ripple runs along it (0-1): none in a light wind, coming in as it strengthens. */
export const swayRipple = (wind) => Math.max(0, Math.min(1, ((Number(wind) || 0) - 0.35) / 0.5));

/** The gusts: a slow swell and fall of the wind's push over time (0.3-1.15). */
export const gustAt = (time) => 0.65 + 0.35 * Math.sin(time * 0.7) + 0.15 * Math.sin(time * 2.3);

/** The sideways shift (px) at `v` (0 one end, 1 the other) of a piece whose swing is `weight(v)` (0-1) at time `time` (s): its
 *  sway, behind a little further along where the ripple runs, and with the ripple a quicker knock between neighbours. */
export function swayAt({ v, time, wind, grid = 100, weight = 1, seed = 0 }) {
  const w = Math.max(0, Math.min(1, Number(weight) || 0)); if (!w || !(wind > 0.01)) return 0;
  const reach = swayReach(wind, grid), ripple = swayRipple(wind), push = gustAt(time + seed * 0.37);
  return w * push * (reach * Math.sin(time * 1.6 - ripple * v * 6 + seed) + ripple * reach * 0.06 * Math.sin(time * 4 + v * 14 + seed));
}

/** A bridge's swing along it: none at its ends, most at mid-span, none where it rests on raised ground (`rise(v)`, px over the
 *  ground under it; `grid` px a square). */
export const bridgeWeight = (v, rise = null, grid = 100) => Math.sin(Math.PI * Math.max(0, Math.min(1, v))) * (rise ? Math.min(1, Math.max(0, rise(v)) / (grid * 0.3)) : 1);

/** A climbing rope's swing from its stake (v 0) to its foot (v 1): growing toward the foot. */
export const ropeWeight = (v) => Math.pow(Math.max(0, Math.min(1, v)), 1.3) * 0.6;

/** The frame a piece is drawn in, straight down its own picture, and how that picture lies on the map (pure): its `rotation`
 *  (radians, for the sheet), `across` and `along` (unit vectors on the map) and the sun as the picture sees it. */
export function pieceFrame(a, b, sun = null) {
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1, ux = (b.x - a.x) / len, uy = (b.y - a.y) / len, across = { x: uy, y: -ux }, along = { x: ux, y: uy };
  const local = sun ? { x: sun.x * across.x + sun.y * across.y, y: sun.x * along.x + sun.y * along.y } : null;
  return { len, across, along, rotation: Math.atan2(across.y, across.x), sun: local };
}
