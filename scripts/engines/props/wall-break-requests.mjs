// The GM's checks on a door break request, the note the requester sends, and what counts as the GM's own hand edit
// of a broken door. Pure: no Foundry globals. The prop-requests.mjs pattern, for walls.
import { wallTraits, canBreakWall, wallMid, crossesWall, wallNote, wallBreakUpdate } from "./wall-break.mjs";
import { cleanCause, sizeOf, PATH_SQUARES } from "./prop-requests.mjs";
import { onLevel } from "./prop-pick.mjs";

export const WALL_BREAK_MESSAGE = "prop-wall-break";
const KINDS = ["area", "path", "smash"];
const AREA_REACH = 30; // squares from the area's centre to the wall's middle
// Not c: Repair restores no position, so a moved broken door keeps its note (and its originals) as it was.
const EDIT_KEYS = ["door", "move", "sight", "light", "sound"];
const SHOVE_REACH = 2; // squares from the slam's start to a token of the sender's
const finite = (p) => Number.isFinite(p?.x) && Number.isFinite(p?.y);

// A cause as sent over the socket: the prop cause's fields, plus the chat message and the source tile it names.
export function cleanWallCause(c) {
  const out = cleanCause(c);
  if (!c || typeof c !== "object") return out;
  for (const k of ["messageId", "sourceId"]) if (typeof c[k] === "string") out[k] = c[k].slice(0, 200);
  return out;
}

// The requester's note: cut along the line from the blow (from, else the cause's centre) to the wall's middle.
// Its kind and material are read from the wall here; the GM reads them again from its own wall.
export function wallNoteFor({ wall, scene, cause = {}, seed, from }) {
  const mid = wallMid(wall), at = finite(from) ? from : finite(cause.at) ? cause.at : mid;
  const { kind, material } = wallTraits(wall, scene);
  return wallNote({ seed, cutAngle: Math.atan2(mid.y - at.y, mid.x - at.x), from: at, kind, material, damageType: cause.damageType });
}

// Whether this sender may claim a slam: the GM; the mover's owner; or a player whose own token stands within
// SHOVE_REACH squares of where the mover set off (a shove moves a creature its shover does not own).
// mover.isOwner: whether the sender owns the mover; senderTokens: [{x, y, w, h}] footprints of the sender's tokens.
export function slamSenderOk({ sender, mover, from, senderTokens = [], grid = 100 } = {}) {
  if (sender?.isGM === true) return true;
  if (mover?.isOwner === true) return true;
  if (!finite(from)) return false;
  return (senderTokens ?? []).some((t) => {
    if (![t?.x, t?.y, t?.w, t?.h].every(Number.isFinite)) return false;
    const dx = Math.max(t.x - from.x, 0, from.x - (t.x + t.w)), dy = Math.max(t.y - from.y, 0, from.y - (t.y + t.h));
    return Math.hypot(dx, dy) <= SHOVE_REACH * grid;
  });
}

// What canBreakWall is asked: a slam uses the mover's own size when the GM knows it.
const breakCause = (cause, mover) => (cause.kind === "path" ? { slam: { size: sizeOf(mover?.size ?? cause.slam?.size) } } : { damageType: cause.damageType });

// The cause has to fit where things stand on the GM's screen. A smash is the GM's own and fits anywhere.
function plausible(cause, wall, grid, mover) {
  if (cause.kind === "smash") return true;
  const mid = wallMid(wall);
  if (cause.kind === "area") return finite(cause.at) && Math.hypot(mid.x - cause.at.x, mid.y - cause.at.y) <= AREA_REACH * grid;
  // path: the mover stands within its size of either end, the path is not too long, it goes through the door, and the
  // door is on the mover's level
  const path = cause.path;
  if (!finite(path?.from) || !finite(path?.to) || !finite(mover)) return false;
  const size = sizeOf(mover.size), near = (p) => Math.hypot(mover.x - p.x, mover.y - p.y) <= size * grid;
  if (!near(path.from) && !near(path.to)) return false;
  if (Math.hypot(path.to.x - path.from.x, path.to.y - path.from.y) > PATH_SQUARES * grid) return false;
  return crossesWall(path.from, path.to, wall) && onLevel(wall.levels, mover.level);
}

// wall: the GM's wall {id, c, door, ds, move, sight, light, sound, levels, flags}; mover: {x, y} centre, size in squares,
// level and isOwner (the sender owns it); senderTokens: footprints of the sender's own tokens on the scene; levels: the cause's own levels when the GM knows them (a wall on none of them is too far).
export function validWallBreakRequest(req, { wall, scene, grid = 100, sender, mover, senderTokens, levels } = {}) {
  const no = (why) => ({ ok: false, why });
  if (scene?.flags?.animater?.breakableProps !== true) return no("off");
  if (!sender) return no("sender");
  if (sender.viewedScene !== scene.id) return no("scene");
  if (!wall) return no("missing");
  if (wall.flags?.animater?.breakWall?.broken) return no("broken");
  const traits = wallTraits(wall, scene), cause = req?.cause ?? {};
  if (!traits.kind || !KINDS.includes(cause.kind)) return no("kind");
  if (cause.kind === "smash" && sender.isGM !== true) return no("sender");
  if (cause.kind === "path" && !slamSenderOk({ sender, mover, from: cause.path?.from, senderTokens, grid })) return no("sender");
  // R1: a smash has no damage type or slam; its material rule is the GM's own (forceOpenDoor's, for Force Open)
  if (cause.kind !== "smash" && !canBreakWall(traits, breakCause(cause, mover))) return no("material");
  const raw = req?.note;
  if (!raw || !Number.isFinite(raw.seed) || !Number.isFinite(raw.cutAngle) || !finite(raw.from)) return no("note");
  if (levels !== undefined && !onLevel(wall.levels, levels)) return no("far");
  if (!plausible(cause, wall, grid, mover)) return no("far");
  // Only the seed, the cut and where the blow came from are the requester's; the rest is read here.
  const note = wallNote({ seed: raw.seed, cutAngle: raw.cutAngle, from: raw.from, kind: traits.kind, material: traits.material, damageType: cause.damageType });
  return { ok: true, note, update: wallBreakUpdate(wall, note) };
}

// Whether a wall update is someone's own edit of its door or restrictions (not a break or Repair of ours, not flags only).
export function handEdited(changes, options) {
  if (!changes || typeof changes !== "object") return false;
  const ours = options?.animater ?? {};
  if (ours.wallBreak || ours.wallRepair) return false;
  return EDIT_KEYS.some((k) => k in changes);
}

// The write that forgets a hand-edited broken wall's note (its wreck goes, Repair leaves the edit alone).
export function handEditUpdate(wall) {
  return wall?.flags?.animater?.breakWall?.broken ? { _id: wall.id, "flags.animater.breakWall.-=broken": null } : null;
}
