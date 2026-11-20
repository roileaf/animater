export const TILE_SORT_LAYER = 500;

export const MAP_SORT = Object.freeze({
  floorTextures: 400,
  floorShadows: 405,
  floorLooks: 410,
  // The other map layers, by what they hold (main.mjs floorLayer), named here so their order reads in one place.
  floorEdges: 406,
  heightShadows: 649,
  decorFlat: 641,
  decorShadows: 651,
  decorations: 655,
  heightFaces: 656,
  // The painted carriers (main.mjs): on the map under the creatures, where the lighting reaches them. Drawn on the
  // token itself they sat in Foundry's interface group, over the lighting, and a sled in a pitch-dark cave came out
  // as bright as at noon (Roi: "why carriers arent affected by light\darkness\sun\moon?"). Tokens sort at 700, so a
  // rider still stands over the wagon they are riding in.
  carriers: 690,
  // The painted walls (main.mjs; engines/motion/painted-walls.mjs): over the ground and whatever is scattered on it,
  // under the wagons and the creatures, so a wall never covers someone standing beside it.
  paintedWalls: 658,
  // The leaves hanging in them: over the stone, since a door swings out across the floor beside its opening.
  paintedDoors: 659,
  // The painted roofs (main.mjs; engines/motion/painted-roofs.mjs): over the creatures, since a roof is above them —
  // it fades away while somebody is under it rather than being drawn below them.
  // The shadow of what hangs off a roof (main.mjs; engines/motion/painted-dressing.mjs): under the roof, not over
  // it. A garland hangs below the eave, so the roof stands above it and hides whatever its shadow falls on up
  // there; only the part that reaches the ground outside should show.
  paintedDressingShade: 744,
  paintedRoofs: 745,
  // What a building hangs out for a feast day (main.mjs; engines/motion/painted-dressing.mjs): over the roof it
  // hangs from, since it hangs off the eave and out past it.
  paintedDressing: 746,
  decorCrowns: 740,
  decorBrush: 1102,
});

export function floorSlot(plane, kind) {
  if (!plane || plane.role === "overhead") return null;
  if (plane.id?.kind === "tile") {
    if (plane.role !== "floor") return null;
    const elevation = Number(plane.elevation);
    const sort = Number(plane.sort);
    return {
      elevation: Number.isFinite(elevation) ? elevation : 0,
      sortLayer: TILE_SORT_LAYER,
      // (Half a step over its tile: a whole one tied with the next tile's own sort, which could then draw under it.)
      sort: (Number.isFinite(sort) ? sort : 0) + 0.5,
    };
  }
  if (plane.id?.kind !== "map") return null;
  const sortLayer = MAP_SORT[kind];
  if (sortLayer == null) return null;
  return { elevation: null, sortLayer, sort: 0 };
}

export function shadowFloor(casterElevation, casterTileId, floors) {
  const above = Number(casterElevation);
  if (!Number.isFinite(above)) return null;
  let best = null;
  for (const floor of floors ?? []) {
    if (floor?.role !== "floor" || floor.id?.kind !== "tile") continue;
    if (casterTileId != null && String(floor.id.tileId) === String(casterTileId)) continue;
    if (!(Number(floor.elevation) < above)) continue;
    if (floor.meets !== true) continue;
    if (!best || Number(floor.elevation) > Number(best.elevation)) best = floor;
  }
  return best;
}
