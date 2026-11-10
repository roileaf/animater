// The GM's own check of the placed area an "area" or "ignite" cause names (props, doors, windows and spilled powder
// alike). Pure: no Foundry globals. The requester only names the area (cause.areaUuid); everything else is read by the
// GM from its own copy of that Region or template and from what its own screen remembered when the area was placed
// (prop-triggers createAreaWaits): who placed it, when, and its shape.
import { onLevel } from "./prop-pick.mjs";

// How long a placed area waits for its spell's damage roll (10 minutes). An area older than this breaks nothing.
export const AREA_TTL_MS = 600000;
const finite = (p) => Number.isFinite(p?.x) && Number.isFinite(p?.y);

// Why the area does not let this cause through ("area"), or null when it does.
// area: the GM's record of the area the cause names, or undefined when the GM has none (never placed, deleted, placed
// before this GM loaded, or forgotten):
//   uuid; sceneId: the scene its document is on now (null when the document is gone); authorId: the user who placed
//   it; authorIsGM: that user is a GM; ownsOrigin: the sender owns the actor whose spell placed it (a PF2e area's
//   origin); rememberedAt: when this GM's screen saw it placed (the now() clock); testPoint(p): whether the area's shape
//   holds p, as Foundry computes it on the GM's screen; levels: the area's levels.
// cause: the cause (its areaUuid must be the area's); sceneId: the target's scene; sender: {id, isGM}; point: the
// target's tested point (a tile's centre, a wall's middle, a spill's centre); levels: the target's levels.
export function areaRefusal(area, { cause, sceneId, sender, point, levels, now, ttl = AREA_TTL_MS } = {}) {
  if (!area || typeof area !== "object" || typeof cause?.areaUuid !== "string" || area.uuid !== cause.areaUuid) return "area";
  if (!area.sceneId || area.sceneId !== sceneId) return "area";
  const placedBy = sender?.isGM === true || (!!area.authorId && area.authorId === sender?.id) || area.authorIsGM === true || area.ownsOrigin === true;
  if (!placedBy) return "area";
  const age = Number(now) - Number(area.rememberedAt);
  if (!Number.isFinite(age) || age < 0 || age > ttl) return "area";
  if (!finite(point) || typeof area.testPoint !== "function") return "area";
  let inside = false;
  try { inside = area.testPoint({ x: point.x, y: point.y }) === true; } catch { inside = false; }
  if (!inside) return "area";
  return onLevel(levels, area.levels) ? null : "area";
}

const GM_REACH = 30; // squares: the GM's own area call that names no area reaches this far from its centre
// The area check for a cause at the target's point and levels: the area it names (areaRefusal). The GM's own call that
// names none (debug.breakProp / breakWall, live checks) is the GM's word, as any of its own writes: it only has to lie
// within GM_REACH squares of its centre (else "far").
export function areaCauseRefusal(cause, point, levels, { area, sceneId, sender, now, grid = 100 } = {}) {
  if (sender?.isGM === true && !cause?.areaUuid) {
    return finite(cause?.at) && finite(point) && Math.hypot(point.x - cause.at.x, point.y - cause.at.y) <= GM_REACH * grid ? null : "far";
  }
  return areaRefusal(area, { cause, sceneId, sender, point, levels, now });
}
