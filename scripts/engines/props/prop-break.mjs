// How a prop breaks: the look of its wreckage, the note saved on the tile, and the miss roll. Pure.
import { STYLES } from "./prop-traits.mjs";
import { FRAGMENT_PATTERNS, FRAGMENT_COUNTS, FRAGMENT_TINTS } from "../fragments/fragments.mjs";

const MARKS = ["scorch", "frost", "stain", "burn", "dust", "ash"];
const POWDER = ["spilled", "exploded"]; // a powder keg's note only (prop-blast.mjs)
// pieces, spread per square, spin; the pattern is per material (wood also has a boxy cut).
const BREAK = {
  wood: { pattern: "shards", pieces: 10, spread: 0.32, spin: 120 },
  clay: { pattern: "crush", pieces: 3, spread: 0.28, spin: 90 },
  glass: { pattern: "shards", pieces: 10, spread: 0.3, spin: 150 },
  metal: { pattern: "crush", pieces: 2, spread: 0.2, spin: 40 },
  stone: { pattern: "crush", pieces: 2, spread: 0.2, spin: 40 },
};
const BOXY_WOOD = { pattern: "diced", pieces: 3, spread: 0.45, spin: 70 };
// What the damage leaves: the wreckage tint (null keeps the art), its fragments tint name, the floor mark.
const CAUSE = {
  fire: { wreckTint: 0x8a6f60, tint: "scorched", mark: "scorch" },
  cold: { wreckTint: 0xcfe4f2, tint: "frosted", mark: "frost" },
  acid: { wreckTint: null, tint: "none", mark: "stain" },
  electricity: { wreckTint: null, tint: "none", mark: "burn" },
};
const DUST = { wreckTint: null, tint: "none", mark: "dust" };
const ASH = { wreckTint: null, tint: "none", mark: "ash" }; // a prop that burns away leaves ash, whatever set it alight

// style: the break's style (breakStyle); "burn" leaves an ash mark with no wreck tint.
export function breakLook({ material, shape, damageType, style } = {}) {
  const base = material === "wood" && shape === "boxy" ? BOXY_WOOD : BREAK[material] ?? BREAK.wood;
  const { wreckTint, tint, mark } = style === "burn" ? ASH : CAUSE[damageType] ?? DUST;
  return { stage: { ...base, fall: 0, duration: 1400, keep: true, tint }, wreckTint, mark };
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
// fire: the lamp oil it held caught (the GM decides, validBreakRequest); stored only when true.
export function brokenNote({ seed, cutAngle, look, from, walls, size, style = "shatter", fire = false, extra = {} }) {
  const { pattern, pieces, spread, spin, tint } = look.stage;
  return { seed, cutAngle, pattern, pieces, spread: clamp(spread * (size > 0 ? size : 1), 0, 3), spin, tint: tint ?? "none", mark: look.mark, from: { x: from.x, y: from.y }, walls: [...walls], style, lights: [], ...(fire === true ? { fire: true } : {}), ...extra };
}

// Validates and clamps a note read from a tile flag or the socket; null when it is not one. A powder keg's note keeps
// its powder and its burst (an integer 1-4); the GM decides both (validBreakRequest). A toppled statue's note keeps
// the id of its rubble region (a string of at most 32 characters), which only the GM writes.
export function readNote(raw) {
  if (!raw || typeof raw !== "object") return null;
  const { seed, cutAngle, pattern, pieces, spread, spin, tint, mark, from, walls } = raw, style = raw.style ?? "shatter";
  if (!STYLES.includes(style)) return null;
  if (!Number.isInteger(seed) || seed < 0 || !Number.isFinite(cutAngle)) return null;
  if (!Object.hasOwn(FRAGMENT_PATTERNS, pattern) || !Object.hasOwn(FRAGMENT_TINTS, tint) || !MARKS.includes(mark)) return null;
  if (![pieces, spread, spin, from?.x, from?.y].every((v) => Number.isFinite(v))) return null;
  const [lo, hi] = FRAGMENT_COUNTS[pattern];
  const ids = Array.isArray(walls) ? walls.filter((w) => typeof w === "string" && w.length <= 32).slice(0, 64) : [];
  const lights = Array.isArray(raw.lights) ? raw.lights.filter((w) => typeof w === "string" && w.length <= 32).slice(0, 16) : [];
  return { seed, cutAngle, pattern, pieces: Math.round(clamp(pieces, lo, hi)), spread: clamp(spread, 0, 3), spin: clamp(spin, 0, 720), tint, mark, from: { x: from.x, y: from.y }, walls: ids, style, lights, ...(raw.fire === true ? { fire: true } : {}),
    ...(POWDER.includes(raw.powder) ? { powder: raw.powder } : {}), ...(Number.isInteger(raw.burst) && raw.burst >= 1 && raw.burst <= 4 ? { burst: raw.burst } : {}),
    ...(typeof raw.region === "string" && raw.region && raw.region.length <= 32 ? { region: raw.region } : {}) };
}

// A missed swing breaks the prop beside it: always on a critical failure, else by the chance (percent).
export function missBreaks(outcome, chance, roll) {
  if (outcome === "criticalFailure") return true;
  return outcome === "miss" && roll * 100 < chance;
}
