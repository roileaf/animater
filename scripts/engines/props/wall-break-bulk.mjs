// The scene configuration's two buttons, "Make all doors and windows breakable" and "Make none breakable" (pure): which
// walls are windows, and what each button writes. Doors are breakable unless the GM said Never (breakWall.door), windows
// only when ticked (breakWall.window); a wall already broken is left as it is.
const isDoor = (wall) => wall?.door === 1 || wall?.door === 2;
const own = (wall) => wall?.flags?.animater?.breakWall ?? {};
const broken = (wall) => Boolean(own(wall).broken);

// A wall that is a window here (a door never is): Foundry's Window (light or sight proximity 30 or distance 40), a
// window Animater's Window put on it (any kind), or one already ticked Yes.
export function isWindowWall(wall) {
  if (!wall || Number(wall.door) > 0) return false;
  const foundry = [wall.light, wall.sight].some((v) => Number(v) === 30 || Number(v) === 40);
  const kind = wall.flags?.animater?.window;
  const ticked = own(wall).window === true || own(wall).window === "yes";
  return foundry || (typeof kind === "string" && kind !== "") || ticked;
}

// The Wall updates for one button (on: make breakable, else make none) and how many doors and windows they change.
export function bulkBreakableUpdates(walls, on) {
  const updates = [];
  let doors = 0, windows = 0;
  for (const wall of walls ?? []) {
    if (!wall || broken(wall)) continue;
    const o = own(wall);
    if (isDoor(wall)) {
      if (on ? o.door !== "never" : o.door === "never") continue;
      updates.push({ _id: wall.id, ...(on ? { "flags.animater.breakWall.-=door": null } : { "flags.animater.breakWall.door": "never" }) });
      doors++;
    } else if (isWindowWall(wall)) {
      const want = on ? "yes" : "no", has = o.window === true ? "yes" : o.window === false ? "no" : o.window;
      if (has === want) continue;
      updates.push({ _id: wall.id, "flags.animater.breakWall.window": want });
      windows++;
    }
  }
  return { updates, doors, windows };
}
