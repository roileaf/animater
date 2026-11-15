// The Region the smoke lives in, and how tokens inside it become concealed.
// (SMOKE_MARK comes from smoke-round.mjs, where it lives beside the stamp itself and beside the scene write's own
// reader: there is ONE marker for every write the round makes, and no copy of it anywhere. smoke-round does not
// import this module, so this is not a circle — and if it ever needs to, the marker moves to smoke-edges.mjs, which
// both already import, rather than being copied.)
import { SMOKE_MARK } from "./smoke-round.mjs";
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

// Which route gives concealment: visioner's own region behaviour, or nothing at all.
// `visionerActive` is "the module is active and registered the behaviour". There was a second route here, through
// visioner's public API, which nothing ever asked for: the region carries the behaviour or it carries nothing, and a
// module-to-module API call would be a different mechanism with a different lifetime. Gone rather than left bare.
export function concealmentPlan(options) {
  return { how: options?.visionerActive === true ? "behaviour" : "none" };
}

// The region's `restriction` is OFF. Core's restriction clips a region's shape to sight-blocking edges from the shape's
// origin, and Animater's own thick-smoke fence (smoke-edges.mjs) is made of such edges, so asking for the clip would clip the
// smoke to its own thick core and lose the thin halo. It is also redundant: smokeStep never diffuses across a wall (its
// `blocked` pairs), so the stored grid, and the region grown from it, already stops at walls. The grid is the authority.
// With no clip there is no one-level rule, no darkness-priority caveat and no need for an explicit origin.

const DOCUMENT_ID = /^[a-zA-Z0-9]{16}$/;

// The fields the round itself writes on its own region: the footprint, and the level it is on. Nothing else.
const OWN_FIELDS = new Set(["shapes", "levels"]);
/**
 * A region write that is only this round putting its own concealment region back (pure): written with the round's
 * own SMOKE_NOTE, changing nothing but the region's shapes and levels — or creating or deleting a region that carries
 * our own flag. The region rebuilds (floors, canopy, sky, air, life, wall shadows, trunks, heights,
 * movement views...) and the round's own room cache skip it, as they skip a clock save and a decoration break.
 *
 * This matters as much as the scene case does, and was missed when that one was fixed: the footprint changes on almost
 * every round of a fire — the whole fill-up and the whole clear-down — so without this, fifteen to thirty rounds of a
 * fire each looked to every client like a GM redrawing a region by hand. The flood fill ran again every tick and
 * seventeen unrelated rebuilds fired on every screen, so the foliage, the sky, the shadows and the floors rebuilt
 * every few seconds for as long as anything burned. A GM REALLY redrawing a region must still rebuild all of it.
 *
 * Two shapes, because Foundry hands them over differently: an update gives (document, changed, options), while a
 * create or a delete gives (document, options, userId) — so for those the options arrive in `changes`. The create and
 * delete cases are told by our own flag ON THE DOCUMENT, which nothing else writes; neither can change a room, since
 * our region keeps no weather out and is not open to the sky.
 */
export function smokeRegionSave(region, changes, options) {
  if (options?.animater?.[SMOKE_MARK] === true) {
    const keys = Object.keys(changes ?? {}).filter((k) => k !== "_id" && k !== "_stats");
    return keys.length > 0 && keys.every((k) => OWN_FIELDS.has(k));
  }
  // A create or a delete: the options sit where an update's changes would, and the document itself says it is ours.
  return changes?.animater?.[SMOKE_MARK] === true && region?.flags?.animater?.smokeRegion === true;
}


// ---- Picking regions out of a scene the canvas has NOT drawn. ----
// The round runs on every scene that has a fire on it, so most of the time it is looking at a scene nobody is standing
// in. core/viewed-regions.mjs cannot help there: a region's `viewed` needs the scene's own `_view`, which only the
// canvas scene has, so off-canvas it answers false for every region and the filter returns nothing at all. It is a
// canvas-drawing helper and belongs where something is drawn. Here we say what we actually mean: the flag that marks a
// region, and the level it is on.
//
// Whether a region counts for the level the smoke is on. A region that names no levels is on every floor, as Foundry
// reads an empty SetField; with no level to compare against (a scene with none) nothing can be told apart, so all of
// them count. This is both more correct than `viewed` — it is the region's own say, not whether a client is looking at
// it — and it works on any scene.
export function regionsOnLevel(regions, level = null) {
  const list = Array.from(regions ?? []);
  if (!level) return list;
  return list.filter((region) => {
    const own = Array.from(region?.levels ?? []);
    return own.length === 0 || own.includes(level);
  });
}

// Our own concealment region on a scene: the one carrying the flag smokeRegionData writes, on this level. Null for none.
// The first in the scene's own order, so the same scene always answers with the same one.
export const ownSmokeRegion = (regions, { level = null } = {}) =>
  regionsOnLevel(regions, level).find((region) => region?.flags?.animater?.smokeRegion === true) ?? null;

// The regions the GM marked "Open to the sky" (a hole in the roof, a shaft) that count for this level.
export const skyRegionsOf = (regions, { level = null } = {}) =>
  regionsOnLevel(regions, level).filter((region) => region?.flags?.animater?.openSky === true);

// The regions the GM marked "Open sides" — roofed, but with no wall where the roof ends: a porch, a cart lodge, a
// pavilion, a lean-to. Only inside one of these does the roof's own outline let smoke out. Everywhere else that
// outline is sealed, because it is drawn by hand around a building whose WALLS are the enclosure and it steps across
// squares wherever it runs diagonally; read as holes, those steps vent a shut room at a rate no door can match.
export const openSideRegionsOf = (regions, { level = null } = {}) =>
  regionsOnLevel(regions, level).filter((region) => region?.flags?.animater?.openSides === true);


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

// One region shape as a single string, for telling two footprints apart. Every field a Foundry region shape can
// carry, `points` included: a polygon whose outline alone had moved was keeping a stale footprint, because comparing
// only type/x/y/width/height could not see it. One join per shape rather than a JSON round trip, because this runs
// every round on every scene with a fire, and comparing strings rather than JSON means key order cannot fool it.
const shapeKey = (sh) => [sh?.type, sh?.x, sh?.y, sh?.width, sh?.height, sh?.radiusX, sh?.radiusY, sh?.rotation,
  sh?.hole === true ? 1 : 0, sh?.points ? Array.from(sh.points).join(",") : ""].join("|");
const sameShapes = (a, b) => a.length === b.length && a.every((sh, k) => shapeKey(sh) === shapeKey(b[k]));

// What a round's shapes mean for the scene's own smoke region (pure; the caller writes).
// Exactly ONE region of ours per scene and level: it is found, grown or shrunk, and taken away with the last of the
// smoke. Found through ownSmokeRegion, never through `viewed`, or off-canvas it would be missed every round — and a
// region that is missed is a region remade, so a fire burning on a scene nobody is looking at left one more
// concealment region behind every round it burned.
// Whether the concealment is there at all can only change by remaking the region, so that case removes and creates;
// the shape and the level are a plain update. An unchanged round asks for nothing at all.
//
// Returns { steps, remove, create, update }. `steps` is the ORDER, and is what a caller applies: the removal of a
// region being remade must land before the region replacing it, or for the moment between the two writes the scene
// carries two concealment regions, and a caller whose create then fails leaves them both. The order is part of this
// answer rather than of the caller's code so that it can be read, and tested, without a Foundry. The three lists are
// the same steps by kind, for reading.
export function smokeRegionPlan(regions, shapes, { level = null, visioner = false } = {}) {
  const own = ownSmokeRegion(regions, { level });
  const list = shapes ?? [];
  // The steps IN ORDER: a removal always before a creation. Everything below says what happens, never when.
  const plan = (remove = [], create = [], update = []) => ({
    steps: [
      ...(remove.length ? [{ kind: "remove", ids: remove }] : []),
      ...(create.length ? [{ kind: "create", data: create }] : []),
      ...(update.length ? [{ kind: "update", data: update }] : []),
    ],
    remove, create, update,
  });
  if (!list.length) return plan(own ? [own.id] : []);
  const data = smokeRegionData(list, { levels: level ? [level] : [], visioner });
  if (!own) return plan([], [data]);
  const had = Array.from(own.behaviors ?? []).some((b) => b?.type === CONCEALMENT_BEHAVIOUR);
  if (had !== (data.behaviors.length > 0)) return plan([own.id], [data]);
  const sameLevels = JSON.stringify(Array.from(own.levels ?? []).sort()) === JSON.stringify([...data.levels].sort());
  if (sameLevels && sameShapes(Array.from(own.shapes ?? []), data.shapes)) return plan();
  return plan([], [], [{ _id: own.id, shapes: data.shapes, levels: data.levels }]);
}
