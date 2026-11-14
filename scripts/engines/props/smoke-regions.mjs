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

// The region's `restriction` is OFF. Core's restriction clips a region's shape to sight-blocking edges from the shape's
// origin, and Animater's own thick-smoke fence (smoke-edges.mjs) is made of such edges, so asking for the clip would clip the
// smoke to its own thick core and lose the thin halo. It is also redundant: smokeStep never diffuses across a wall (its
// `blocked` pairs), so the stored grid, and the region grown from it, already stops at walls. The grid is the authority.
// With no clip there is no one-level rule, no darkness-priority caveat and no need for an explicit origin.

const DOCUMENT_ID = /^[a-zA-Z0-9]{16}$/;

// `levels`: the region's levels, each a real document id (a region's `levels` is a SetField of DocumentIdField over the
// scene's Level collection, foundry.mjs:13489, :23108); any number, empty for none. `origin`: optional, copied onto every
// shape when given.
export function smokeRegionData(shapes, options) {
  const { levels = [], visioner, origin } = options ?? {};
  if (!Array.isArray(levels)) throw new Error("smokeRegionData: levels must be an array of level document ids");
  for (const id of levels) {
    if (typeof id !== "string" || !DOCUMENT_ID.test(id)) throw new Error("smokeRegionData: a level must be a 16-character Foundry document id");
  }
  if (origin !== undefined && (!origin || !Number.isFinite(origin.x) || !Number.isFinite(origin.y))) {
    throw new Error("smokeRegionData: an origin, when given, must be a finite {x, y}");
  }
  const behaviors = concealmentPlan({ visionerActive: visioner === true }).how === "behaviour"
    ? [{ type: CONCEALMENT_BEHAVIOUR, name: "Smoke", system: { enabled: true, sourceTags: SMOKE_TAG } }]
    : [];
  return {
    name: "Smoke",
    shapes: (shapes ?? []).map((sh) => ({ ...sh, ...(sh.points ? { points: [...sh.points] } : {}), ...(origin ? { origin: { x: origin.x, y: origin.y } } : {}) })),
    levels: [...levels],
    restriction: { enabled: false },
    behaviors,
    flags: { animater: { smokeRegion: true } },
  };
}
