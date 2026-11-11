// Breakable doors: what a wall is, what can break it, and the note a broken one carries. Pure: no Foundry globals.
// Foundry v14 numbers, hard-coded to keep this module pure: door type NONE 0 / DOOR 1 / SECRET 2; the sense and movement
// types are NONE 0 when the passage is open.
import { canBreak } from "./prop-material.mjs";
import { closesWindow } from "../motion/window-state.mjs";
import { forceDCOf } from "./force-open.mjs"; // a cycle of function declarations only (force-open reads wallTraits)
import { windowLike } from "./wall-break-bulk.mjs";

const KINDS = ["door", "window", "wall"];
const MATERIALS = ["wood", "reinforced", "metal", "stone"]; // reinforced: a reinforced wooden door
export const WALL_MATERIALS = Object.freeze(["wood", "brick", "stone", "metal"]); // a breakable plain wall's structure
const NOTE_MATERIALS = [...MATERIALS, "brick", "glass", "none"]; // a window's note carries glass (or none)
const MARKS = ["dust", "scorch"];
const RESTORE_KEYS = ["door", "ds", "move", "sight", "light", "sound"];
const WINDOW_RESTORE_KEYS = ["sight", "light", "sound"]; // a broken window still blocks movement
const WOOD_DAMAGE = new Set(["bludgeoning", "slashing", "force", "fire"]);
// A plain wall (Table 11-4 structures): the area damage types that breach it and the smallest slammed size that does
// (squares; Infinity: no slam). A powder-keg blast breaches any of them.
const WALL_RULES = {
  wood: { damage: new Set(["fire", "force"]), slam: 3 },
  brick: { damage: new Set(["force"]), slam: 4 },
  stone: { damage: new Set(), slam: 4 },
  metal: { damage: new Set(), slam: Infinity },
};
const isSegment = (c) => Array.isArray(c) && c.length === 4 && c.every(isNum);
const isNum = (n) => typeof n === "number" && Number.isFinite(n);

// What this wall is for breaking: kind null when it cannot break (not a door and not a wall the GM marked Window, the
// scene's switches off, or the GM said never). A window is opt-in (breakWall.window, never the light kind), glass unless
// the GM chose Won't break ("none"), and Force Open never reaches it. forceDC: the door's Force open DC in this game
// system (system: game.system.id), its own breakWall.forceDC else by material; null for a window or a system without DCs.
export function wallTraits(wall, scene, system) {
  const sf = scene?.flags?.animater ?? {}, own = wall?.flags?.animater?.breakWall ?? {};
  const on = sf.breakableProps === true && sf.breakWalls !== false;
  const door = on && (wall?.door === 1 || wall?.door === 2) && own.door !== "never";
  if (!door && on && wall?.door === 0 && windowOn(wall)) {
    const pane = PANES.includes(own.windowMaterial) ? own.windowMaterial : own.material;
    return { kind: "window", material: wallMaterialOf(pane, "window"), forceOpen: false, forceDC: null };
  }
  // A plain wall the GM marked breakable (never by default, never in bulk): its structure is its own field. Never a
  // window of any kind (windowLike: the walls Wall Configuration hides the wall group on), and never a piece of a breach
  // (breachOf: part B) until Repair: one breach per wall.
  if (!door && on && wall?.door === 0 && wallOn(wall) && !windowLike(wall) && !own.breachOf) return { kind: "wall", material: wallMaterialOf(own.wallMaterial, "wall"), forceOpen: false, forceDC: null };
  const material = wallMaterialOf(own.material, "door");
  return { kind: door ? "door" : null, material, forceOpen: own.forceOpen !== false, forceDC: forceDCOf(own, material, system) };
}

// Whether a wall is a breakable window (its door type aside): the GM's Window choice, Yes or No (true/false from before
// Automatic existed), else Automatic: on when Animater's own window on the wall is a glass one (the light it lets
// through: glass, leaded, mosaic, rose or frosted panes), off otherwise.
export const GLASS_PANES = Object.freeze(["glass", "leaded", "mosaic", "rose", "frosted"]);
// Whether the GM marked this plain wall breakable (Breakable wall: Yes). A window's own choice comes first (wallTraits).
export function wallOn(wall) {
  const choice = wall?.flags?.animater?.breakWall?.wall;
  return choice === true || choice === "yes";
}
export function windowOn(wall) {
  const choice = wall?.flags?.animater?.breakWall?.window;
  if (choice === true || choice === "yes") return true;
  if (choice === false || choice === "no") return false;
  return GLASS_PANES.includes(wall?.flags?.animater?.window);
}

// A wall's stored material for a door (wood, reinforced, metal or stone; wood when unknown) or a window (glass or none). A list
// (a Wall Configuration that submitted both groups' selects, door group first) gives the door group's value to a door
// and the window group's (the last) to a window, so walls saved that way read as the GM chose.
const PANES = ["glass", "none"];
export function wallMaterialOf(raw, kind) {
  const list = Array.isArray(raw) ? raw : [raw];
  if (kind === "window") return [...list].reverse().find((m) => PANES.includes(m)) === "none" ? "none" : "glass";
  if (kind === "wall") return list.find((m) => WALL_MATERIALS.includes(m)) ?? "wood";
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
  if (cause.blast === true) return (traits?.kind === "door" || traits?.kind === "window" || traits?.kind === "wall") && traits.material !== "none";
  const size = Number(cause.slam?.size), slam = Number.isFinite(size) ? size : 0;
  if (traits?.kind === "wall") {
    const rule = WALL_RULES[traits.material] ?? WALL_RULES.wood;
    return rule.damage.has(cause.damageType) || slam >= rule.slam;
  }
  if (traits?.kind === "window") return traits.material === "glass" && (canBreak("glass", { damageType: cause.damageType }) || slam > 0);
  if (traits?.kind !== "door") return false;
  if (traits.material === "wood") return WOOD_DAMAGE.has(cause.damageType) || slam >= 2;
  // reinforced wood: the blows and fire that break wood, but only a Huge or bigger slam
  if (traits.material === "reinforced") return WOOD_DAMAGE.has(cause.damageType) || slam >= 3;
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
  // A breached wall: the gap's segment, and the part B the breach made (null: none).
  if (kind === "wall") {
    if (!isSegment(raw.gap)) return null;
    note.gap = [...raw.gap];
    if (raw.partId !== undefined) {
      if (raw.partId !== null && (typeof raw.partId !== "string" || !raw.partId || raw.partId.length > 64)) return null;
      note.partId = raw.partId;
    }
  }
  if (restore !== undefined) {
    if (!restore || typeof restore !== "object") return null;
    const kept = {};
    // A breached wall's whole segment as it was.
    if (restore.c !== undefined) {
      if (!isSegment(restore.c)) return null;
      kept.c = [...restore.c];
    }
    for (const k of RESTORE_KEYS) if (restore[k] !== undefined) {
      if (!Number.isInteger(restore[k])) return null;
      kept[k] = restore[k];
    }
    // A broken window's Animater window as it was: its kind (null: it had none) or whether it stood open.
    if (restore.windowKind !== undefined) {
      if (restore.windowKind !== null && (typeof restore.windowKind !== "string" || restore.windowKind.length > 32)) return null;
      kept.windowKind = restore.windowKind;
    }
    if (restore.windowOpen !== undefined) {
      if (typeof restore.windowOpen !== "boolean") return null;
      kept.windowOpen = restore.windowOpen;
    }
    note.restore = kept;
  }
  return note;
}

// Open the passage, keeping what the wall was so Repair can put it back. (Its light restriction stays Normal: Foundry's lights,
// which keep their full brightness to their radius, would pour out of the hole as a flat block; Animater's lamplight spill,
// fading as real light does, goes out of it instead, and the sun comes in through it as through any opening.)
export const HOLE_LIGHT = 20;
export function wallBreakUpdate(wall, note) {
  if (note?.kind === "window") {
    const restore = {}, up = { _id: wall.id, sight: 0, light: HOLE_LIGHT, sound: 0 };
    for (const k of WINDOW_RESTORE_KEYS) restore[k] = wall[k];
    // It opens: a window that opens and closes is left its kind and stood open; anything else becomes an open window
    // (the light comes through it unfiltered). Repair puts back what it was.
    const kind = wall?.flags?.animater?.window;
    if (closesWindow(kind)) { restore.windowOpen = wall.flags.animater.windowOpen === true; up["flags.animater.windowOpen"] = true; }
    else { restore.windowKind = typeof kind === "string" && kind ? kind : null; up["flags.animater.window"] = "open"; }
    return { ...up, "flags.animater.breakWall.broken": { ...note, restore } };
  }
  const restore = {};
  for (const k of RESTORE_KEYS) restore[k] = wall[k];
  return { _id: wall.id, door: 0, ds: 0, move: 0, sight: 0, light: HOLE_LIGHT, sound: 0, "flags.animater.breakWall.broken": { ...note, restore } };
}

// Repair: a broken wall back as it was (a breached one's whole segment too: wall-breach.mjs deletes its part B), and a hit door back to full HP (its hp flag goes; the hits it remembers stay,
// so a roll already applied never applies again).
export function wallRestoreUpdate(wall) {
  const own = wall?.flags?.animater?.breakWall, note = readWallNote(own?.broken), hp = own?.hp !== undefined && own?.hp !== null;
  const healed = hp ? { "flags.animater.breakWall.-=hp": null } : {};
  if (!note?.restore) return hp ? { _id: wall.id, ...healed } : null;
  const { windowKind, windowOpen, c, ...fields } = note.restore, up = { _id: wall.id, ...(c ? { c: [...c] } : {}), ...fields };
  if (windowKind !== undefined) { if (windowKind === null) up["flags.animater.-=window"] = null; else up["flags.animater.window"] = windowKind; }
  if (windowOpen !== undefined) up["flags.animater.windowOpen"] = windowOpen;
  return { ...up, "flags.animater.breakWall.-=broken": null, ...healed };
}

export function wallRepairUpdates(walls) {
  return walls.map(wallRestoreUpdate).filter(Boolean);
}
