// Displacement: where a token ends up when an animation moves it for real (finishers now,
// forced movement later), and whether the GM may write a player's requested move. Pure:
// Foundry supplies walls, scene bounds and grid snapping; main.mjs does the write.

// Straight out from the attacker, through the target.
export function awayFrom(attacker, target) {
  if (!attacker || !target) return null;
  const x = target.x - attacker.x, y = target.y - attacker.y, length = Math.hypot(x, y);
  return length ? { x: x / length, y: y / length } : null;
}

const gridSnap = (grid) => (p) => ({ x: Math.round(p.x / grid) * grid, y: Math.round(p.y / grid) * grid });

// Top-left positions one square apart along the direction. Squares count like grid
// movement: the longer axis advances one whole square per step, so diagonals do not stall.
export function landingSteps(from, direction, squares, grid, snap = gridSnap(grid)) {
  const lead = Math.max(Math.abs(direction?.x ?? 0), Math.abs(direction?.y ?? 0));
  if (!lead || !(squares > 0)) return [];
  const sx = direction.x / lead, sy = direction.y / lead, steps = [];
  for (let i = 1; i <= Math.round(squares); i++) {
    const step = snap({ x: from.x + sx * grid * i, y: from.y + sy * grid * i });
    const last = steps.at(-1) ?? from;
    if (step.x !== last.x || step.y !== last.y) steps.push(step);
  }
  return steps;
}

const centerOf = (p, size) => ({ x: p.x + size.w / 2, y: p.y + size.h / 2 });
const inside = (p, size, b) => !b || (p.x >= b.x && p.y >= b.y && p.x + size.w <= b.x + b.width && p.y + size.h <= b.y + b.height);

// The farthest step reached without crossing a wall or leaving the scene.
export function landingSpot({ from, direction, squares, grid, size, collides = () => false, bounds = null, snap }) {
  let spot = { x: from.x, y: from.y };
  for (const step of landingSteps(from, direction, squares, grid, snap)) {
    if (!inside(step, size, bounds) || collides(centerOf(spot, size), centerOf(step, size))) break;
    spot = step;
  }
  return spot;
}

// How far (squares) the first wall is along the direction, walking the same steps and collision test
// as landingSpot: the middle of the first blocked step. null when no wall is crossed within `squares`;
// the scene edge stops the walk but is not a wall.
export function wallDistance({ from, direction, squares, grid, size, collides = () => false, bounds = null, snap }) {
  let spot = { x: from.x, y: from.y };
  for (const step of landingSteps(from, direction, squares, grid, snap)) {
    if (!inside(step, size, bounds)) return null;
    if (collides(centerOf(spot, size), centerOf(step, size)))
      return Math.hypot((spot.x + step.x) / 2 - from.x, (spot.y + step.y) / 2 - from.y) / grid;
    spot = step;
  }
  return null;
}

// Whether the active GM writes what a player asked for: only for a token that player
// controls (or whose attacker they control), still visible; hiding or Defeated only once down.
export function displaceAllowed({ isOwner, alreadyHidden, hp, hidden, defeated, x, y }) {
  if (!isOwner || alreadyHidden) return false;
  if ((x !== undefined || y !== undefined) && !(Number.isFinite(x) && Number.isFinite(y))) return false;
  return !(hidden || defeated) || hp <= 0;
}

// A requested move the GM writes stays within the longest landing plus the token's own size:
// a keyframed path's 12 authored squares reach ~17 once rotated off-axis. It also keeps the
// token's footprint on the scene (`footprint` in px, defaults to size squares).
export function withinKnockback({ from, to, grid, size = 1, bounds = null, footprint = null }) {
  if (![from?.x, from?.y, to?.x, to?.y, grid].every(Number.isFinite)) return false;
  const reach = (17 + Math.max(1, Number(size) || 1)) * grid;
  // Squares count like landingSteps: a diagonal step is one square, so measure the longer axis.
  if (Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y)) > reach) return false;
  const box = footprint ?? { w: (Number(size) || 1) * grid, h: (Number(size) || 1) * grid };
  return inside(to, box, bounds);
}
