// The rooms the Structures tab lays in one drag: a rectangle and a ring.
//
// Both answer the same question — given the corner or the middle the drag started at, and where the pointer is now,
// what corners does the room have? Drawing one by hand was a leg at a time, and the last leg had to land exactly on
// the first corner or the room was left with a gap in it.
//
// Pure: numbers in, corners out. Nothing here knows about Foundry or the grid's origin; the caller snaps the points
// it hands in, and the corners come back in the same map units.

/** The fewest and most sides a ring is drawn with: enough to read as a circle, each still long enough to be a wall. */
export const RING_SIDES_LEAST = 8, RING_SIDES_MOST = 24;

/**
 * A rectangular room from the corner the drag started at to where the pointer is now, closed (the last corner is the
 * first again). The starting corner stays put and the room grows out of it, so it never flips under the pointer, and
 * it is never less than one square either way — a click that barely moves still lays a room rather than a line.
 */
export function rectRoom(corner, to, grid = 100) {
  const g = grid > 0 ? grid : 100;
  const w = Math.max(g, Math.abs(to.x - corner.x)), h = Math.max(g, Math.abs(to.y - corner.y));
  const x = to.x < corner.x ? corner.x - w : corner.x;
  const y = to.y < corner.y ? corner.y - h : corner.y;
  return [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }, { x, y }];
}

/**
 * A round room: the drag's start is the middle and its length the radius, closed the same way. The radius is taken in
 * half squares so the room it closes in is a tidy size, and the ring is laid off the grid — which is what makes it
 * round, since a wall drawn by hand snaps to the grid's corners and could only ever be stepped out of right angles.
 */
export function roundRoom(middle, to, grid = 100) {
  const g = grid > 0 ? grid : 100;
  const far = Math.hypot(to.x - middle.x, to.y - middle.y);
  const r = Math.max(g * 0.5, Math.round(far / (g * 0.5)) * g * 0.5);
  const sides = Math.max(RING_SIDES_LEAST, Math.min(RING_SIDES_MOST, Math.round((2 * Math.PI * r) / (g * 0.75))));
  const points = [];
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2 - Math.PI / 2;
    points.push({ x: Math.round(middle.x + Math.cos(a) * r), y: Math.round(middle.y + Math.sin(a) * r) });
  }
  points.push({ ...points[0] });
  return points;
}
