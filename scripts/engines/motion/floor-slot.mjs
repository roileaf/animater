// Foundry draws canvas.primary by elevation, then sortLayer, then sort.
// Tiles use sortLayer 500 and the tile document's sort. Map drawings stay under that,
// so a bush still stands over blood on the ground. A floor tile's drawings use the
// tile's elevation and sortLayer, and the document sort plus one, so they sit on that
// tile and under an awning at a higher elevation. An overhead plane is not a floor.

export const TILE_SORT_LAYER = 500;

export const MAP_SORT = Object.freeze({
  floorTextures: 400,
  floorShadows: 405,
  floorLooks: 410,
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
      sort: (Number.isFinite(sort) ? sort : 0) + 1,
    };
  }
  if (plane.id?.kind !== "map") return null;
  const sortLayer = MAP_SORT[kind];
  if (sortLayer == null) return null;
  return { elevation: null, sortLayer, sort: 0 };
}

// The floor tile a shadow is seen on. The caster's own tile is not one of those:
// its shadow falls on what is below it. Nothing below it stays on the map.
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
