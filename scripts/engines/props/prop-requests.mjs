// The GM's checks on a break request, and the updates for breaking, undoing and repairing. Pure.
import { propMaterial, propShape, canBreak } from "./prop-material.mjs";
import { breakLook, brokenNote, readNote, missBreaks } from "./prop-break.mjs";
import { ownWalls, openUpdates, restoreUpdates } from "./prop-walls.mjs";

export const PROP_BREAK_MESSAGE = "prop-break";
const KINDS = ["area", "miss", "path"];
const AREA_REACH = 30; // squares from the area's centre
const MISS_CHANCE = 25;

const propOf = (t) => t?.flags?.animater?.prop ?? {};
const centre = (t) => ({ x: t.x + t.width / 2, y: t.y + t.height / 2 });
const finite = (p) => Number.isFinite(p?.x) && Number.isFinite(p?.y);
const sizeOf = (s) => (Number.isFinite(s) && s > 0 ? Math.min(s, 10) : 1);
// what canBreak is asked: the slam uses the mover's own size when the GM knows it
const breakCause = (cause, mover) => (cause.kind === "path" ? { slam: { size: sizeOf(mover?.size ?? cause.slam?.size) } } : { damageType: cause.damageType });

// A cause as sent over the socket: only its known fields, each well-formed.
export function cleanCause(c) {
  const out = { kind: String(c?.kind ?? "").slice(0, 16) };
  if (!c || typeof c !== "object") return out;
  if (typeof c.damageType === "string") out.damageType = c.damageType.slice(0, 40);
  if (Number.isFinite(c.slam?.size)) out.slam = { size: c.slam.size };
  if (typeof c.outcome === "string") out.outcome = c.outcome.slice(0, 40);
  if (finite(c.at)) out.at = { x: c.at.x, y: c.at.y };
  for (const k of ["targetUuid", "moverUuid"]) if (typeof c[k] === "string") out[k] = c[k].slice(0, 200);
  return out;
}

// The cause has to fit where things stand on the GM's screen.
function plausible(cause, tile, grid, { target, mover }) {
  if (cause.kind === "area") {
    const c = centre(tile);
    return finite(cause.at) && Math.hypot(c.x - cause.at.x, c.y - cause.at.y) <= AREA_REACH * grid;
  }
  if (cause.kind === "miss") {
    if (!finite(target) || !Number.isFinite(target.w) || !Number.isFinite(target.h)) return false;
    // overlaps the target's footprint grown by a square, centre not on the target
    const c = centre(tile);
    if (c.x >= target.x && c.x <= target.x + target.w && c.y >= target.y && c.y <= target.y + target.h) return false;
    return tile.x < target.x + target.w + grid && tile.x + tile.width > target.x - grid && tile.y < target.y + target.h + grid && tile.y + tile.height > target.y - grid;
  }
  if (!finite(mover)) return false;
  const nx = Math.max(tile.x, Math.min(tile.x + tile.width, mover.x)), ny = Math.max(tile.y, Math.min(tile.y + tile.height, mover.y));
  return Math.hypot(mover.x - nx, mover.y - ny) <= sizeOf(mover.size) * grid;
}

// target: {x, y, w, h} of the missed token; mover: {x, y} centre and size in squares; roll in [0, 1).
export function validBreakRequest(req, { tile, walls = [], scene, grid = 100, sender, target, mover, roll = 1 } = {}) {
  const no = (why) => ({ ok: false, why });
  const own = scene?.flags?.animater ?? {};
  if (own.breakableProps !== true) return no("off");
  if (!sender) return no("sender");
  if (!tile) return no("missing");
  if (propOf(tile).broken) return no("broken");
  if (tile.hidden) return no("hidden");
  const cause = req?.cause ?? {};
  if (!KINDS.includes(cause.kind)) return no("cause");
  if (!canBreak(propMaterial(tile, grid), breakCause(cause, mover))) return no("material");
  const note = readNote(req.note);
  if (!note) return no("note");
  const mine = ownWalls(tile, walls, grid), ids = new Set(mine.map((w) => w.id));
  if (note.walls.some((id) => !ids.has(id))) return no("wall");
  if (!plausible(cause, tile, grid, { target, mover })) return no("far");
  const chance = Number(own.propMissChance ?? MISS_CHANCE); // a form may save it as text
  if (cause.kind === "miss" && !missBreaks(cause.outcome, Number.isFinite(chance) ? chance : MISS_CHANCE, roll)) return no("lucky");
  const named = new Set(note.walls);
  return { ok: true, note, wallUpdates: openUpdates(mine.filter((w) => named.has(w.id))) };
}

// The requester's note: the tile's own walls, its larger side in squares, cut along the line from the cause.
export function breakNoteFor({ tile, walls = [], grid = 100, cause = {}, seed, from }) {
  const c = centre(tile), at = finite(from) ? from : c;
  const look = breakLook({ material: propMaterial(tile, grid), shape: propShape(tile.texture?.src), damageType: cause.damageType, slam: cause.slam });
  return brokenNote({ seed, cutAngle: Math.atan2(c.y - at.y, c.x - at.x), look, from: at,
    walls: ownWalls(tile, walls, grid).map((w) => w.id), size: Math.max(tile.width, tile.height) / grid });
}

// Restores only the walls the tile's note names (never recomputed), and clears only its note.
const namedWalls = (tile, walls) => {
  const ids = new Set(readNote(propOf(tile).broken)?.walls ?? []);
  return walls.filter((w) => ids.has(w.id));
};
export function undoUpdates(tile, walls) {
  return { tile: { _id: tile.id, "flags.animater.prop.-=broken": null }, walls: restoreUpdates(namedWalls(tile, walls)) };
}

// Every broken tile unhidden and cleared in one batch; each named wall restored once.
export function repairUpdates(tiles, walls) {
  const broken = (tiles ?? []).filter((t) => propOf(t).broken);
  const seen = new Set(), named = [];
  for (const t of broken) for (const w of namedWalls(t, walls)) if (!seen.has(w.id)) { seen.add(w.id); named.push(w); }
  return { tiles: broken.map((t) => ({ ...undoUpdates(t, []).tile, hidden: false })), walls: restoreUpdates(named) };
}

// "a.-=b": null keys as the database's own deletion marker (v14 deprecates the key form); unchanged without one.
export function withDeletes(update, del) {
  if (del === undefined) return update;
  return Object.fromEntries(Object.entries(update).map(([k, v]) => (/(^|\.)-=/.test(k) && v === null ? [k.replace(/(^|\.)-=/, "$1"), del] : [k, v])));
}

// The top of the level a tile stands on: its first named level in scene order, else the initial (or first) level.
// Infinity for an open-topped level; undefined when the scene has no levels.
export function levelTopOf(tileLevels, levels, initialId) {
  const named = new Set(tileLevels ?? []), list = [...(levels ?? [])];
  const level = list.find((l) => named.has(l.id)) ?? list.find((l) => l.id === initialId) ?? list[0];
  if (!level) return undefined;
  const top = level.elevation?.top;
  return Number.isFinite(top) ? top : Infinity;
}
