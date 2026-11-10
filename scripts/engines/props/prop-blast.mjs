// Powder kegs: what sets one off, what its burst reaches and when, and the GM's whisper. Pure: no Foundry globals.
// A keg holds black powder (propTraits().contents === "powder"). Fire, electricity or another blast explodes it; any
// other break spills the powder, which a later fire area can still set off (ignitableInArea). The note of a broken keg
// keeps `powder` ("spilled" | "exploded") and `burst` (squares, 1-4).
import { propMaterial } from "./prop-material.mjs";
import { wallTraits, canBreakWall, wallMid } from "./wall-break.mjs";
import { projectOnWall } from "./wall-breach.mjs";
import { onLevel } from "./prop-pick.mjs";
import { BURST_DEFAULT } from "./prop-traits.mjs";

export { BURST_DEFAULT };
const SETS_OFF = new Set(["fire", "electricity"]);
const EDGE = 1e-6; // a target exactly on the burst's edge is inside it
const centreOf = (t) => ({ x: t.x + t.width / 2, y: t.y + t.height / 2 });
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export function explodes({ contents, damageType, blast } = {}) {
  return contents === "powder" && (blast === true || SETS_OFF.has(damageType));
}

// ms after the keg goes off that a target d away breaks: 120 at the keg, 250 at the edge of a radius-wide burst.
export function blastDelay(d, radius) {
  return Math.round(120 + 130 * Math.min(1, radius > 0 ? d / radius : 1));
}

// A blast's own reach, read from its source tile (the keg): its centre and burst, or null unless the tile is broken
// with its powder exploded. Only the GM writes that note, so a requester cannot claim one.
export function blastFrom(source) {
  const note = source?.flags?.animater?.prop?.broken, burst = note?.burst;
  if (note?.powder !== "exploded" || !Number.isInteger(burst) || burst < 1 || burst > 4) return null;
  if (![source.x, source.y, source.width, source.height].every(Number.isFinite)) return null;
  return { centre: centreOf(source), burst };
}

// Whether a point is within the burst of squares around the centre.
export const inBurst = (p, centre, burst, grid = 100) => dist(p, centre) <= burst * grid + EDGE;

// What a blast breaks, nearest first: the live prop tiles (not hidden, not broken, a prop at all, not the keg itself)
// whose centre is in the burst, and the intact breakable doors and windows whose middle is, on the blast's levels.
// Each comes with its delay (blastDelay).
export function blastTargets({ centre, burst = BURST_DEFAULT, grid = 100, tiles = [], walls = [], scene, levels, sourceId } = {}) {
  const radius = burst * grid, out = [];
  for (const t of tiles ?? []) {
    if (!t || t.id === sourceId || t.hidden || t.flags?.animater?.prop?.broken || !onLevel(t.levels, levels)) continue;
    if (propMaterial(t, grid) === "none") continue;
    const d = dist(centreOf(t), centre);
    if (d <= radius + EDGE) out.push({ type: "tile", id: t.id, delay: blastDelay(d, radius) });
  }
  for (const w of walls ?? []) {
    if (!w?.c || w.flags?.animater?.breakWall?.broken || !onLevel(w.levels, levels)) continue;
    if (!canBreakWall(wallTraits(w, scene), { blast: true })) continue;
    // a plain wall is reached by its nearest point (where the breach opens), a door or window by its middle
    const d = dist(wallTraits(w, scene).kind === "wall" ? projectOnWall(w.c, centre) : wallMid(w), centre);
    if (d <= radius + EDGE) out.push({ type: "wall", id: w.id, delay: blastDelay(d, radius) });
  }
  return out.sort((a, b) => a.delay - b.delay);
}

// The names of the tokens {name, x, y, w, h, level} whose centre is in the burst, on its levels.
export function tokensInBurst(tokens, centre, burst, grid = 100, levels) {
  return (tokens ?? []).filter((t) => onLevel(t.level, levels) && inBurst({ x: t.x + t.w / 2, y: t.y + t.h / 2 }, centre, burst, grid)).map((t) => t.name);
}

export function blastWhisper(burst, names = []) {
  const inside = names.length ? `<p>Inside: ${names.map(esc).join(", ")}.</p>` : "";
  return `<p><b>Powder keg exploded — ${burst}-square burst.</b></p>${inside}`;
}

// The broken kegs whose powder spilled and whose centre lies in an area (testPoint): a fire area sets them off.
export function ignitableInArea(tiles, testPoint) {
  return (tiles ?? []).filter((t) => t?.flags?.animater?.prop?.broken?.powder === "spilled" && testPoint(centreOf(t)) === true);
}
