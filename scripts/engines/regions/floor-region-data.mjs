// Turn detected floor/water proposals into Foundry region document data.

import { WATER_KINDS, WATER_TOWARD, flowChoices, waterFlows, waterKindFlags } from "../motion/region-steps.mjs";

const FLOW = new Set(flowChoices().map(([value]) => value));
const WAVES = new Set(WATER_TOWARD.map(([value]) => value));
const WATER_COLOR = "#2c7da0";

export function toRegionData(proposal, { sceneRect, imageWidth, imageHeight, levelId, name, waterKind = "still", flowTo = "", current = "", waveTo = "", seaBeach = "" } = {}) {
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
  const kind = WATER_KINDS.some(([value]) => value === waterKind) ? waterKind : "still";
  const kindFlags = waterKindFlags({ flowTo: FLOW.has(flowTo) ? flowTo : "", current }, kind);
  const animater = { floor: "water", generated: "water-detect", ...kindFlags };
  if (kind === "sea") {
    if (seaBeach === "off") animater.seaBeach = "off";
    if (WAVES.has(waveTo)) animater.waveTo = waveTo;
  }
  if (waterFlows(kind) && current === "swift") animater.current = "swift";
  return {
    name: name || "Water",
    color: WATER_COLOR,
    shapes,
    levels: levelId ? [levelId] : [],
    flags: { animater },
  };
}

// Only single-level generator regions are editable here. Other regions remain outside the save plan.
// A region drawn by hand has no generated flag. A region on several levels, on all levels, or on another level stays.
export function editableWaterRegionIds(regions, levelId) {
  const ids = [];
  const list = Array.isArray(regions) ? regions : regions?.contents;
  if (!list || !levelId) return ids;
  for (const region of list) {
    if (region?.flags?.animater?.generated !== "water-detect" || region.id == null) continue;
    const levels = Array.from(region.levels ?? []);
    if (levels.length === 1 && levels[0] === levelId) ids.push(region.id);
  }
  return ids;
}
