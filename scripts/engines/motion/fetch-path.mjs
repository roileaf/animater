// Friendfetch: each target is dragged straight toward the caster and stops in the closest unoccupied space
// to the caster on that path (forced movement). A wall that blocks movement ends the path. A target with no
// free space closer than where it stands stays put.
// Tokens are { id, x, y, w, h } in px (top-left and size). `snap(topLeft, target)` turns a top-left into the grid's (none:
// gridless, as it is); `blocked(from, to)` says a wall stops a move between two centres.
// Nearest target first: one behind another on the same line lands behind it, never on the same square.
// Returns [{ id, x, y }] (the new top-left) for each target that moves, in the order given.
const centre = (t) => ({ x: t.x + t.w / 2, y: t.y + t.h / 2 });
const far = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
// Overlap of two boxes; touching edges do not count.
const EDGE = 0.5;
const overlaps = (a, b) => a.x < b.x + b.w - EDGE && b.x < a.x + a.w - EDGE && a.y < b.y + b.h - EDGE && b.y < a.y + a.h - EDGE;

export function fetchLandings({ caster, targets = [], tokens = [], snap = (p) => p, blocked = () => false, gridSize = 100 }) {
  if (!caster) return [];
  const goal = centre(caster);
  const order = targets.filter((t) => t && t.id !== caster.id).sort((a, b) => far(centre(a), goal) - far(centre(b), goal));
  const moving = new Set(order.map((t) => t.id)), landed = new Map();
  for (const t of order) {
    // In the way: the caster, every other token, a target still standing where it is, the spaces taken so far.
    const others = [caster, ...tokens.filter((o) => o.id !== caster.id && !moving.has(o.id)),
      ...order.filter((o) => o !== t && !landed.has(o.id)), ...landed.values()];
    const from = centre(t), length = far(from, goal), step = Math.max(1, Math.min(t.w, t.h, gridSize) / 4);
    let best = null, bestFar = far(from, goal) - EDGE, seen = new Set();
    for (let d = 0; d <= length; d += step) {
      const k = d / (length || 1), p = { x: from.x + (goal.x - from.x) * k, y: from.y + (goal.y - from.y) * k };
      const top = snap({ x: p.x - t.w / 2, y: p.y - t.h / 2 }, t), key = `${top.x},${top.y}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const box = { x: top.x, y: top.y, w: t.w, h: t.h }, at = centre(box);
      // Past a wall the drag goes no further.
      if (blocked(from, at)) break;
      if (others.some((o) => overlaps(box, o))) continue;
      if (far(at, goal) < bestFar) { best = top; bestFar = far(at, goal); }
    }
    if (best && (best.x !== t.x || best.y !== t.y)) landed.set(t.id, { x: best.x, y: best.y, w: t.w, h: t.h });
  }
  return targets.filter((t) => t && landed.has(t.id)).map((t) => ({ id: t.id, x: landed.get(t.id).x, y: landed.get(t.id).y }));
}
