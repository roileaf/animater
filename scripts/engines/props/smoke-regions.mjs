// The Region the smoke lives in, and how tokens inside it become concealed.
// Pure: plain objects in, plain objects out. No Foundry globals, no document writes; the caller (the active GM) writes.
//
// Animater NEVER writes the PF2e `concealed` condition. pf2e-visioner owns concealment, models it per observer-and-target
// pair as PF2e does, and overrides DetectionMode#testVisibility; a blanket condition would fight it and be wrong, since
// smoke conceals depending on who looks from where. So the region carries visioner's own behaviour, tagged "smoke".
// Without visioner there is no condition and no substitute: other systems simply get no concealment.

// Defined by pf2e-visioner: scripts/regions/register.js registers `${MODULE_ID}.Pf2eVisionerConcealment`
// (MODULE_ID = "pf2e-visioner", scripts/constants.js:5). Its `sourceTags` field takes comma-separated tags such as smoke.
export const CONCEALMENT_BEHAVIOUR = "pf2e-visioner.Pf2eVisionerConcealment";
export const SMOKE_TAG = "smoke";

// Which route gives concealment. Order of preference: visioner's region behaviour, its public API, nothing.
// `visionerActive` is "the module is active and registered the behaviour"; `visionerApi` is "its API object is reachable".
export function concealmentPlan({ visionerActive = false, visionerApi = false } = {}) {
  if (visionerActive) return { how: "behaviour" };
  if (visionerApi) return { how: "api" };
  return { how: "none" };
}

// `restriction: sight` makes Foundry itself clip the region's shape to sight-blocking walls from the shape's origin
// (RegionDocument#_computeShapeConstraints), so the smoke is held in by walls and leaks out of open doors for free.
// It is set whether or not visioner is present: it costs nothing and keeps the shape honest.
export function smokeRegionData(shapes, { levels = [], visioner = false } = {}) {
  const behaviors = concealmentPlan({ visionerActive: !!visioner }).how === "behaviour"
    ? [{ type: CONCEALMENT_BEHAVIOUR, name: "Smoke", system: { enabled: true, sourceTags: SMOKE_TAG } }]
    : [];
  return {
    name: "Smoke",
    shapes: (shapes ?? []).map((s) => ({ ...s, ...(s.points ? { points: [...s.points] } : {}) })),
    levels: [...(levels ?? [])],
    restriction: { enabled: true, type: "sight" },
    behaviors,
    flags: { animater: { smokeRegion: true } },
  };
}
