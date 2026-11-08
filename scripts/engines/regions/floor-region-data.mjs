// Turn detected floor proposals into Foundry region document data.
// Floor is a data table: name, colour, and which flags each floor writes.

import { FLOORS, NO_FLOOR } from "../motion/movement-feel.mjs";
import { WATER_KINDS, WATER_TOWARD, flowChoices, waterFlows, waterKindFlags, caveKindFlags } from "../motion/region-steps.mjs";

const FLOW = new Set(flowChoices().map(([value]) => value));
const WAVES = new Set(WATER_TOWARD.map(([value]) => value));

export const DETECT_GENERATED = "floor-detect";
export const LEGACY_WATER_GENERATED = "water-detect";
const GENERATED = new Set([DETECT_GENERATED, LEGACY_WATER_GENERATED]);

// Every Animater floor the detector can write, plus none (no step sounds or marks).
export const DETECT_FLOORS = Object.freeze([...FLOORS, NO_FLOOR]);

export const FLOOR_META = Object.freeze({
  stone: { name: "Stone", color: "#6b6e73" },
  wood: { name: "Wood", color: "#8b5a2b" },
  dirt: { name: "Dirt", color: "#6b4f2a" },
  grass: { name: "Grass", color: "#4a7c3a" },
  sand: { name: "Sand", color: "#c2a66a" },
  snow: { name: "Snow", color: "#dfe8ef" },
  water: { name: "Water", color: "#2c7da0" },
  ice: { name: "Ice", color: "#9ec9d9" },
  mud: { name: "Mud", color: "#4a3728" },
  pebbles: { name: "Pebbles", color: "#8a8478" },
  glass: { name: "Glass", color: "#7ec8c4" },
  metal: { name: "Metal", color: "#8b9198" },
  lava: { name: "Lava", color: "#c2410c" },
  none: { name: "None", color: "#888888" },
});

export const isDetectFloor = (value) => DETECT_FLOORS.includes(value);

export function floorMeta(floor) {
  return FLOOR_META[isDetectFloor(floor) ? floor : "water"] ?? FLOOR_META.water;
}

// Water-only flags that must leave when a saved region stops being water.
export const WATER_FLAG_KEYS = Object.freeze(["waterKind", "flowTo", "current", "waveTo", "seaBeach"]);

export function floorFlags(floor, { waterKind = "still", flowTo = "", current = "", waveTo = "", seaBeach = "" } = {}) {
  const kind = isDetectFloor(floor) ? floor : "water";
  if (kind === "lava") return { ...caveKindFlags({}, "lava"), generated: DETECT_GENERATED };
  if (kind === "water") {
    const water = WATER_KINDS.some(([value]) => value === waterKind) ? waterKind : "still";
    const kindFlags = waterKindFlags({ flowTo: FLOW.has(flowTo) ? flowTo : "", current }, water);
    const animater = { floor: "water", generated: DETECT_GENERATED, ...kindFlags };
    if (water === "sea") {
      if (seaBeach === "off") animater.seaBeach = "off";
      if (WAVES.has(waveTo)) animater.waveTo = waveTo;
    }
    if (waterFlows(water) && current === "swift") animater.current = "swift";
    return animater;
  }
  return { floor: kind, generated: DETECT_GENERATED };
}

export function toRegionData(proposal, {
  sceneRect, imageWidth, imageHeight, levelId, name,
  floor = proposal?.floor ?? "water",
  waterKind = "still", flowTo = "", current = "", waveTo = "", seaBeach = "",
} = {}) {
  if (!(sceneRect?.width > 0) || !(sceneRect?.height > 0)) throw new Error("toRegionData: sceneRect needs a width and a height");
  if (!(imageWidth > 0) || !(imageHeight > 0)) throw new Error("toRegionData: image size is missing");
  const scaleX = sceneRect.width / imageWidth;
  const scaleY = sceneRect.height / imageHeight;
  const shapes = [];
  for (const loop of proposal?.loops ?? []) {
    const points = [];
    const src = loop.points ?? [];
    for (let i = 0; i < src.length; i += 2) points.push(sceneRect.x + src[i] * scaleX, sceneRect.y + src[i + 1] * scaleY);
    if (points.length < 6 || points.length % 2 !== 0) continue;
    shapes.push({ type: "polygon", points, hole: loop.hole === true });
  }
  const kind = isDetectFloor(floor) ? floor : "water";
  const meta = floorMeta(kind);
  const animater = floorFlags(kind, { waterKind, flowTo, current, waveTo, seaBeach });
  return {
    name: name || meta.name,
    color: meta.color,
    shapes,
    levels: levelId ? [levelId] : [],
    flags: { animater },
  };
}

// Single-level generator regions, including legacy water-detect ones.
export function editableWaterRegionIds(regions, levelId) {
  const ids = [];
  const list = Array.isArray(regions) ? regions : regions?.contents;
  if (!list || !levelId) return ids;
  for (const region of list) {
    if (!GENERATED.has(region?.flags?.animater?.generated) || region.id == null) continue;
    const levels = Array.from(region.levels ?? []);
    if (levels.length === 1 && levels[0] === levelId) ids.push(region.id);
  }
  return ids;
}

export const editableFloorRegionIds = editableWaterRegionIds;
