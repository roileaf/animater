// Breakable doors: what a wall is, what can break it, and the note a broken one carries. Pure: no Foundry globals.
// Foundry v14 numbers, hard-coded to keep this module pure: door type NONE 0 / DOOR 1 / SECRET 2; the sense and movement
// types are NONE 0 when the passage is open.
import { canBreak } from "./prop-material.mjs";
import { forceDCOf } from "./force-open.mjs"; // a cycle of function declarations only (force-open reads wallTraits)

const KINDS = ["door", "window"];
const MATERIALS = ["wood", "metal", "stone"];
const NOTE_MATERIALS = [...MATERIALS, "glass", "none"]; // a window's note carries glass (or none)
const MARKS = ["dust", "scorch"];
const RESTORE_KEYS = ["door", "ds", "move", "sight", "light", "sound"];
const WINDOW_RESTORE_KEYS = ["sight", "light", "sound"]; // a broken window still blocks movement
const WOOD_DAMAGE = new Set(["bludgeoning", "slashing", "force", "fire"]);
const isNum = (n) => typeof n === "number" && Number.isFinite(n);

// What this wall is for breaking: kind null when it cannot break (not a door and not a wall the GM marked Window, the
// scene's switches off, or the GM said never). A window is opt-in (breakWall.window, never the light kind), glass unless
// the GM chose Won't break ("none"), and Force Open never reaches it. forceDC: the door's Force open DC in this game
// system (system: game.system.id), its own breakWall.forceDC else by material; null for a window or a system without DCs.
export function wallTraits(wall, scene, system) {
  const sf = scene?.flags?.animater ?? {}, own = wall?.flags?.animater?.breakWall ?? {};
  const on = sf.breakableProps === true && sf.breakWalls !== false;
  const door = on && (wall?.door === 1 || wall?.door === 2) && own.door !== "never";
  if (!door && on && wall?.door === 0 && own.window === true) {
    const pane = PANES.includes(own.windowMaterial) ? own.windowMaterial : own.material;
    return { kind: "window", material: wallMaterialOf(pane, "window"), forceOpen: false, forceDC: null };
  }
  const material = wallMaterialOf(own.material, "door");
  return { kind: door ? "door" : null, material, forceOpen: own.forceOpen !== false, forceDC: forceDCOf(own, material, system) };
}

// A wall's stored material for a door (wood, metal or stone; wood when unknown) or a window (glass or none). A list
// (a Wall Configuration that submitted both groups' selects, door group first) gives the door group's value to a door
// and the window group's (the last) to a window, so walls saved that way read as the GM chose.
const PANES = ["glass", "none"];
export function wallMaterialOf(raw, kind) {
  const list = Array.isArray(raw) ? raw : [raw];
  if (kind === "window") return [...list].reverse().find((m) => PANES.includes(m)) === "none" ? "none" : "glass";
  return list.find((m) => MATERIALS.includes(m)) ?? "wood";
}

// What a Wall Configuration save writes under breakWall (pure; main.mjs's preCreateWall/preUpdateWall): the door group's
// Material and the window group's (windowMaterial) become one material by the Door Type being saved (1, 2 door; else a
// window). A material list that reached the save anyway is resolved the same way. Anything else comes back unchanged.
export function wallBreakFormMerge(breakWall, door) {
  if (!breakWall || typeof breakWall !== "object") return breakWall;
  const has = Object.hasOwn(breakWall, "windowMaterial");
  if (!has && !Array.isArray(breakWall.material)) return breakWall;
  const isDoor = door === 1 || door === 2, { windowMaterial, ...out } = breakWall;
  if (isDoor) { if (out.material !== undefined) out.material = wallMaterialOf(out.material, "door"); }
  else if (has || out.material !== undefined) out.material = wallMaterialOf(has && PANES.includes(windowMaterial) ? windowMaterial : out.material, "window");
  return out;
}

// The Door Type a Wall Configuration stands for (which group it shows, how its save merges): the form's own Door Type
// when it differs from the wall's (the GM changed it), else the wall's. A broken door (door 0 now) stands for the door it
// was, its note's restore.door, so its form shows and saves the door group and Repair finds the material it had.
// selected: the form's Door Type (a number or its select's string), undefined when the save leaves it out.
export function wallFormDoor(wall, selected) {
  const now = Number(wall?.door), picked = selected === undefined || selected === null || selected === "" ? NaN : Number(selected);
  if (Number.isFinite(picked) && picked !== now) return picked;
  const note = readWallNote(wall?.flags?.animater?.breakWall?.broken);
  return note?.kind === "door" && Number.isInteger(note.restore?.door) ? note.restore.door : now;
}

// Whether this cause breaks a wall of these traits. A pure damage and slam rule: Force Open and smash have their own rule.
// A blast breaks any door or window the GM has not set to Won't break.
export function canBreakWall(traits, cause = {}) {
  if (cause.blast === true) return (traits?.kind === "door" || traits?.kind === "window") && traits.material !== "none";
  const size = Number(cause.slam?.size), slam = Number.isFinite(size) ? size : 0;
  if (traits?.kind === "window") return traits.material === "glass" && (canBreak("glass", { damageType: cause.damageType }) || slam > 0);
  if (traits?.kind !== "door") return false;
  if (traits.material === "wood") return WOOD_DAMAGE.has(cause.damageType) || slam >= 2;
  return cause.damageType === "force" || slam >= 3;
}

export function wallMid(wall) {
  const [x1, y1, x2, y2] = wall.c;
  return { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
}

// Whether the segment a-b crosses the wall's segment (a proper crossing; touching an end does not count).
export function crossesWall(a, b, wall) {
  const [x1, y1, x2, y2] = wall.c;
  const side = (px, py, qx, qy, rx, ry) => Math.sign((qx - px) * (ry - py) - (qy - py) * (rx - px));
  const d1 = side(a.x, a.y, b.x, b.y, x1, y1), d2 = side(a.x, a.y, b.x, b.y, x2, y2);
  const d3 = side(x1, y1, x2, y2, a.x, a.y), d4 = side(x1, y1, x2, y2, b.x, b.y);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

export function wallNote({ seed, cutAngle, from, kind, material, damageType }) {
  return { seed, cutAngle, from: { x: from.x, y: from.y }, kind, material, mark: damageType === "fire" ? "scorch" : "dust" };
}

// A stored note back, or null when any part is not what this module wrote.
export function readWallNote(raw) {
  if (!raw || typeof raw !== "object") return null;
  const { seed, cutAngle, from, kind, material, mark, restore } = raw;
  if (!isNum(seed) || !isNum(cutAngle) || !from || !isNum(from.x) || !isNum(from.y)) return null;
  if (!KINDS.includes(kind) || !NOTE_MATERIALS.includes(material) || !MARKS.includes(mark)) return null;
  const note = { seed, cutAngle, from: { x: from.x, y: from.y }, kind, material, mark };
  if (restore !== undefined) {
    if (!restore || typeof restore !== "object") return null;
    const kept = {};
    for (const k of RESTORE_KEYS) if (restore[k] !== undefined) {
      if (!Number.isInteger(restore[k])) return null;
      kept[k] = restore[k];
    }
    note.restore = kept;
  }
  return note;
}

// Open the passage, keeping what the wall was so Repair can put it back.
export function wallBreakUpdate(wall, note) {
  if (note?.kind === "window") {
    const restore = {};
    for (const k of WINDOW_RESTORE_KEYS) restore[k] = wall[k];
    return { _id: wall.id, sight: 0, light: 0, sound: 0, "flags.animater.breakWall.broken": { ...note, restore } };
  }
  const restore = {};
  for (const k of RESTORE_KEYS) restore[k] = wall[k];
  return { _id: wall.id, door: 0, ds: 0, move: 0, sight: 0, light: 0, sound: 0, "flags.animater.breakWall.broken": { ...note, restore } };
}

export function wallRestoreUpdate(wall) {
  const note = readWallNote(wall?.flags?.animater?.breakWall?.broken);
  if (!note?.restore) return null;
  return { _id: wall.id, ...note.restore, "flags.animater.breakWall.-=broken": null };
}

export function wallRepairUpdates(walls) {
  return walls.map(wallRestoreUpdate).filter(Boolean);
}
