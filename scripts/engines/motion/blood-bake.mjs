// Blood baked into the map: what lies on the floor now, drawn once into a picture, saved in the world's files and laid down as
// one tile the scene keeps. A tile costs nothing to keep, however much blood went into it. Every Foundry call is injected.

// The picture's size for a scene's rectangle (pure): its full size, or smaller for the largest texture a card takes for sure.
export const BAKE_LARGEST = 4096;
export function bakeSize({ width, height } = {}, largest = BAKE_LARGEST) {
  const scale = Math.min(1, largest / Math.max(1, width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)), scale };
}
// A file for this bake (pure): never the same twice, so a second bake lays a second tile and leaves the first as it is.
export const bakeFile = (sceneId, now) => `blood-${String(sceneId ?? 'scene').replace(/[^a-zA-Z0-9_-]/g, '')}-${Math.trunc(Number(now) || 0)}.webp`;
// The tile (pure): over the whole scene's rectangle on the level shown, under every other tile on it. Its x and y are where its
// anchor sits and a tile's anchor is its middle by default, so the anchor is put on the corner the rectangle counts from.
export function bakeTile({ src, rect, elevation = 0, levels = null, lowestSort = 0 }) {
  return { texture: { src, anchorX: 0, anchorY: 0 }, x: rect.x, y: rect.y, width: rect.width, height: rect.height, elevation, sort: lowestSort - 1, ...(levels ? { levels } : {}) };
}

// Bakes `root` (world coordinates) over `rect`. `draw(root, size)`: a canvas of it; `store(canvas, name)`: its path in the files;
// `lay(tile)`: makes the tile. Resolves to the tile's src, or throws what stopped it, having laid nothing.
export async function bakeBlood({ root, rect, sceneId, now = Date.now(), draw, store, lay, elevation = 0, levels = null, lowestSort = 0 }) {
  if (!root || !(rect?.width > 0) || !(rect?.height > 0)) throw new Error('no scene to bake into');
  const picture = await draw(root, bakeSize(rect));
  const src = await store(picture, bakeFile(sceneId, now));
  if (!src) throw new Error('the picture could not be saved');
  await lay(bakeTile({ src, rect, elevation, levels, lowestSort }));
  return src;
}
