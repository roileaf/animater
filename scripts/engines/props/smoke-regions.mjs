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
export function concealmentPlan(options) {
  const { visionerActive, visionerApi } = options ?? {};
  if (visionerActive === true) return { how: "behaviour" };
  if (visionerApi === true) return { how: "api" };
  return { how: "none" };
}

// `restriction: sight` makes Foundry itself clip the region's shape to sight-blocking walls from the shape's ORIGIN
// (RegionDocument#_computeShapeConstraints). That origin is the shape's explicit `origin` field, else the polygon CENTROID,
// never the first point, so every shape gets the fire's origin written explicitly. Shapes sharing an origin are also swept
// once together. Core only computes the clip when the region has EXACTLY ONE level; with any other count the restriction is
// silently inert. A caller passing a different count has a bug, so this THROWS rather than guess which level, or split the
// shapes across regions, the caller meant. It is set whether or not visioner is present.
//
// PRIORITY: a darkness source whose priority is >= the region's suppresses the clip (radius 0), so a fire in a magically
// dark room would show no smoke. We set a deliberately high priority so ordinary and magical darkness do not win. Value
// chosen, not read from Foundry's source (not found locally): confirm in-world.
export const SMOKE_RESTRICTION_PRIORITY = 1000;

export function smokeRegionData(shapes, options) {
  const { levels, visioner, origin } = options ?? {};
  if (!Array.isArray(levels) || levels.length !== 1) {
    throw new Error("smokeRegionData: exactly one level is required (core skips the sight clip otherwise)");
  }
  if (!origin || !Number.isFinite(origin.x) || !Number.isFinite(origin.y)) {
    throw new Error("smokeRegionData: a finite origin {x, y} is required (core would use the polygon centroid)");
  }
  const behaviors = concealmentPlan({ visionerActive: visioner === true }).how === "behaviour"
    ? [{ type: CONCEALMENT_BEHAVIOUR, name: "Smoke", system: { enabled: true, sourceTags: SMOKE_TAG } }]
    : [];
  return {
    name: "Smoke",
    shapes: (shapes ?? []).map((s) => ({ ...s, ...(s.points ? { points: [...s.points] } : {}), origin: { x: origin.x, y: origin.y } })),
    levels: [...levels],
    restriction: { enabled: true, type: "sight", priority: SMOKE_RESTRICTION_PRIORITY },
    behaviors,
    flags: { animater: { smokeRegion: true } },
  };
}
