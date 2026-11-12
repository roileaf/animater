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
