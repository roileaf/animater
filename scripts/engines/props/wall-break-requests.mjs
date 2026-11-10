// The GM's checks on a door break request, the note the requester sends, and what counts as the GM's own hand edit
// of a broken door. Pure: no Foundry globals. The prop-requests.mjs pattern, for walls.
import { wallTraits, canBreakWall, wallMid, crossesWall, wallNote, wallBreakUpdate } from "./wall-break.mjs";
import { cleanCause, sizeOf, PATH_SQUARES } from "./prop-requests.mjs";
import { onLevel } from "./prop-pick.mjs";
import { forceOpenOf, windowBesideMiss, windowInSwing } from "./wall-triggers.mjs";
import { missPathOk, windowOnMissPath } from "./window-miss.mjs";
import { strikeOutcome, throughOk } from "./window-through.mjs";
import { closestForcedDoor, forceOpenResult } from "./force-open.mjs";
import { missBreaks } from "./prop-break.mjs";
import { blastFrom, inBurst } from "./prop-blast.mjs";
import { areaCauseRefusal } from "./prop-areas.mjs";

export const WALL_BREAK_MESSAGE = "prop-wall-break";
const KINDS = ["area", "path", "smash", "force-open", "miss", "through", "blast"];
const ATTACKS = new Set(["miss", "through"]); // a strike's: windows only, read from the attacker and target tokens
const MISS_CHANCE = 25; // percent: a plain ranged miss breaks a window (the scene's propMissChance overrides)
const OWN_RULE = new Set(["smash", "force-open"]); // R1: no damage type or slam; their own rule (Force Open: the door's DC)
// Not c: Repair restores no position, so a moved broken door keeps its note (and its originals) as it was.
const EDIT_KEYS = ["door", "move", "sight", "light", "sound"];
const SHOVE_REACH = 2; // squares from the slam's start to a token of the sender's
const finite = (p) => Number.isFinite(p?.x) && Number.isFinite(p?.y);
const centreOf = (r) => (r ? { x: r.x + r.w / 2, y: r.y + r.h / 2 } : null);

// A cause as sent over the socket: the prop cause's fields, plus the chat message and the source tile it names.
export function cleanWallCause(c) {
  const out = cleanCause(c);
  if (!c || typeof c !== "object") return out;
  for (const k of ["messageId", "sourceId", "attackerUuid"]) if (typeof c[k] === "string") out[k] = c[k].slice(0, 200);
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

// What canBreakWall is asked: a slam uses the mover's own size when the GM knows it; a blast breaks any door or window.
const breakCause = (cause, mover) => (cause.kind === "path" ? { slam: { size: sizeOf(mover?.size ?? cause.slam?.size) } } : cause.kind === "blast" ? { blast: true } : { damageType: cause.damageType });

// The cause has to fit where things stand on the GM's screen. A smash is the GM's own and fits anywhere.
// A blast reaches the wall's middle from its source keg (blastFrom: one that exploded), on the blast's levels.
function plausible(cause, wall, grid, mover, { scene, walls, attacker, target, source, levels } = {}) {
  if (OWN_RULE.has(cause.kind)) return true; // a smash fits anywhere; Force Open was placed by forceOpenCheck
  const mid = wallMid(wall);
  if (cause.kind === "blast") {
    const b = blastFrom(source);
    return !!b && inBurst(mid, b.centre, b.burst, grid) && onLevel(wall.levels, levels ?? source.levels);
  }
  if (cause.kind === "through") {
    // a hit through glass: the GM's own attacker-target centre line meets this window first (window-through.mjs)
    return onLevel(wall.levels, target?.level) && throughOk(wall, attacker, target, walls, scene, target?.level);
  }
  if (cause.kind === "miss") {
    const box = (r) => [r?.x, r?.y, r?.w, r?.h].every(Number.isFinite);
    if (!box(attacker) || !box(target) || !onLevel(wall.levels, target.level)) return false;
    // ranged (a miss line, cause.path): the line fits the shot (window-miss missPathOk) and meets this window first
    if (cause.path) {
      const all = (walls ?? []).some((w) => w?.id === wall.id) ? walls : [...(walls ?? []), wall];
      return missPathOk(cause.path, attacker, target, grid) && windowOnMissPath(cause.path, all, scene, target.level)?.id === wall.id;
    }
    // melee: the window stands beside the target, past its near side (never on the attacker's side)
    return windowBesideMiss(wall, { x: attacker.x + attacker.w / 2, y: attacker.y + attacker.h / 2 }, target, grid);
  }
  if (cause.kind === "area") return true; // the area it names holds the wall's middle (areaCauseRefusal)
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
// A miss: attacker {x, y, w, h} (the attacker's footprint: a token the sender owns), target {x, y, w, h, level?} (the
// missed token's footprint), roll in [0, 1) for a plain miss's chance, and walls (the scene's). A ranged miss names its
// miss line (cause.path {from, to}: the animation's seeded miss line, to its free end): it must start at the attacker,
// pass near the target and be no longer than the distance plus 3 squares, and the window must be the first on it. A
// melee miss names none: the window stands beside the target, never on the attacker's side. Else "far".
// A ranged miss through glass, or a melee miss whose swing line crosses the window, breaks it always (no chance roll);
// the scene's chance is only for a melee miss's window beside the target.
// A strike through glass {kind: "through", outcome: "success"|"criticalSuccess"|"miss"|"criticalFailure"}: attacker and
// target as for a miss, the line read here from their centres (never the sender's): this window is the first on it, on
// the target's level. Else "far"; no strike outcome "lucky". It breaks always, hit or miss, no chance roll.
// Force Open: message, the GM's own copy of the chat message the cause names; token, the roller's footprint
// {x, y, w, h, level, authorOwns} on this scene (authorOwns: the message's author owns that token, and it is the speaker's
// actor's); walls, the scene's walls; system, game.system.id; used, this GM already broke a door with that message.
// A blast {kind: "blast", sourceId}: the GM's only (runBlast); source, the GM's view of the keg tile it names.
// An area {kind: "area", areaUuid}: area, the GM's own record of the placed area it names, and now, the GM's clock
// (prop-areas.mjs areaRefusal): refused as "area" unless it holds the wall's middle, on the wall's level.
export function validWallBreakRequest(req, { wall, scene, grid = 100, sender, mover, senderTokens, levels, message, token, walls, attacker, target, roll = 1, source, system, used = false, area, now } = {}) {
  const no = (why) => ({ ok: false, why });
  if (scene?.flags?.animater?.breakableProps !== true || scene.flags.animater.breakWalls === false) return no("off");
  if (!sender) return no("sender");
  const gmBlast = req?.cause?.kind === "blast" && sender.isGM === true;
  if (req?.cause?.kind === "blast" && !gmBlast) return no("sender");
  // the GM's blast may run on a scene the GM is not viewing (a player's break set it off)
  if (!gmBlast && sender.viewedScene !== scene.id) return no("scene");
  if (!wall) return no("missing");
  if (wall.flags?.animater?.breakWall?.broken) return no("broken");
  const traits = wallTraits(wall, scene, system), cause = req?.cause ?? {};
  if (!traits.kind || !KINDS.includes(cause.kind)) return no("kind");
  if (ATTACKS.has(cause.kind) && traits.kind !== "window") return no("kind");
  if (traits.kind === "window" && OWN_RULE.has(cause.kind)) return no("kind"); // smash and Force Open are for doors
  if (cause.kind === "smash" && sender.isGM !== true) return no("sender");
  if (cause.kind === "path" && !slamSenderOk({ sender, mover, from: cause.path?.from, senderTokens, grid })) return no("sender");
  // R1: a smash has no damage type or slam; Force Open has the door's DC
  if (!OWN_RULE.has(cause.kind) && !canBreakWall(traits, breakCause(cause, mover))) return no("material");
  if (cause.kind === "force-open") {
    const why = forceOpenCheck({ wall, scene, grid, sender, message, token, walls, system, used, traits });
    if (why) return no(why);
  }
  const raw = req?.note;
  if (!raw || !Number.isFinite(raw.seed) || !Number.isFinite(raw.cutAngle) || !finite(raw.from)) return no("note");
  if (cause.kind === "area") {
    const why = areaCauseRefusal(cause, wallMid(wall), wall.levels, { area, sceneId: scene.id, sender, now, grid });
    if (why) return no(why);
  }
  if (levels !== undefined && !onLevel(wall.levels, levels)) return no("far");
  if (!plausible(cause, wall, grid, mover, { scene, walls, attacker, target, source, levels })) return no("far");
  if (cause.kind === "through" && !strikeOutcome(cause.outcome)) return no("lucky");
  if (cause.kind === "miss") {
    // Through the glass (a ranged miss's flight, or a swing's line that crosses it) breaks always; the scene's chance is
    // only for a window beside the target.
    const crossed = !!cause.path || windowInSwing(wall, centreOf(attacker), target);
    const chance = crossed ? 100 : Number(scene.flags.animater.propMissChance ?? MISS_CHANCE); // a form may save it as text
    if (!missBreaks(cause.outcome, Number.isFinite(chance) ? chance : MISS_CHANCE, roll)) return no("lucky");
  }
  // Only the seed, the cut and where the blow came from are the requester's; the rest is read here.
  // A blast scorches.
  const note = wallNote({ seed: raw.seed, cutAngle: raw.cutAngle, from: raw.from, kind: traits.kind, material: traits.material, damageType: cause.kind === "blast" ? "fire" : cause.damageType });
  if (cause.kind === "force-open") note.messageId = message.id; // one break per message, kept on the wall
  return { ok: true, note, update: wallBreakUpdate(wall, note) };
}

// Whether a request breaks for sure once the GM finds it plausible (no chance roll to wait for), so the requester shows it
// at once: anything but a plain melee miss at a window beside the target (not crossed by the swing's line). attacker and
// target: footprints {x, y, w, h}.
export function breaksSure(cause, wall, attacker, target) {
  if (cause?.kind !== "miss" || cause.outcome === "criticalFailure" || cause.path) return true;
  return !!attacker && windowInSwing(wall, centreOf(attacker), target);
}

// The GM's own reading of a Force Open roll, or why it is refused. The author sent it and owns the rolling token; that
// token stands within a square of this door (a roll from the door names it; a sheet roll means the closest forced door);
// the message holds a roll, has not broken a door yet, and meets the DC the GM reads from this wall.
function forceOpenCheck({ wall, scene, grid, sender, message, token, walls, system, used, traits }) {
  const fo = forceOpenOf(message);
  if (!fo) return "roll";
  if (fo.authorId !== sender.id) return "sender";
  if (![token?.x, token?.y, token?.w, token?.h].every(Number.isFinite)) return "far";
  if (token.authorOwns !== true) return "sender";
  const door = fo.wallId ? (fo.wallId === wall.id ? closestForcedDoor(token, [wall], scene, grid) : null) : closestForcedDoor(token, walls, scene, grid);
  if (door?.id !== wall.id) return "far";
  if (!Array.from(message.rolls ?? []).length) return "roll";
  const spent = used === true || message.flags?.animater?.forceOpenUsed === true
    || (walls ?? []).some((w) => w?.flags?.animater?.breakWall?.broken?.messageId === message.id);
  if (spent) return "used";
  const result = forceOpenResult({ system, message, dc: traits.forceDC, material: traits.material });
  return result.ok ? null : result.why;
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
