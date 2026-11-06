// Blood baked into the map: what lies on the floor now, drawn once into a picture, saved in the world's files and laid down as
// one tile the scene keeps. A tile costs nothing to keep, however much blood went into it. Every Foundry call is injected.

// What a bake covers (pure): only as far as the blood goes, in whole pixels of the map and inside the scene, so the picture is as sharp as the map. `marks` { x, y, width, height } each by its middle (turned any way); null when none lies in the scene.
export function bakeArea(marks = [], rect, pad = 4) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const m of marks) { const reach = Math.hypot(m.width, m.height) / 2; if (!(reach > 0)) continue; x0 = Math.min(x0, m.x - reach); y0 = Math.min(y0, m.y - reach); x1 = Math.max(x1, m.x + reach); y1 = Math.max(y1, m.y + reach); }
  if (!Number.isFinite(x0)) return null;
  const left = Math.max(rect.x, Math.floor(x0 - pad)), top = Math.max(rect.y, Math.floor(y0 - pad)), right = Math.min(rect.x + rect.width, Math.ceil(x1 + pad)), bottom = Math.min(rect.y + rect.height, Math.ceil(y1 + pad));
  return right > left && bottom > top ? { x: left, y: top, width: right - left, height: bottom - top } : null;
}
// The picture's size for what it covers (pure): its full size, or smaller for the largest texture a card takes for sure.
export const BAKE_LARGEST = 4096;
export function bakeSize({ width, height } = {}, largest = BAKE_LARGEST) {
  const scale = Math.min(1, largest / Math.max(1, width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)), scale };
}
// A file for this bake (pure): never the same twice, so a second bake lays a second tile and leaves the first as it is.
export const bakeFile = (sceneId, now) => `blood-${String(sceneId ?? 'scene').replace(/[^a-zA-Z0-9_-]/g, '')}-${Math.trunc(Number(now) || 0)}.webp`;
// The tile (pure): over the rectangle baked on the level shown, under every other tile on it. Its x and y are where its
// anchor sits and a tile's anchor is its middle by default, so the anchor is put on the corner the rectangle counts from.
export function bakeTile({ src, rect, elevation = 0, levels = null, lowestSort = 0 }) {
  return { texture: { src, anchorX: 0, anchorY: 0 }, x: rect.x, y: rect.y, width: rect.width, height: rect.height, elevation, sort: lowestSort - 1, ...(levels ? { levels } : {}) };
}

// Bakes `root` (world coordinates) over the scene's `rect`, or the part of it `marks` cover. `draw(root, size, area)`: a canvas of that area; `store(canvas, name)`: its path in the files;
// `lay(tile)`: makes the tile. Resolves to the tile's src, or throws what stopped it, having laid nothing.
export async function bakeBlood({ root, rect, marks = null, sceneId, now = Date.now(), draw, store, lay, elevation = 0, levels = null, lowestSort = 0 }) {
  if (!root || !(rect?.width > 0) || !(rect?.height > 0)) throw new Error('no scene to bake into');
  // Only where the blood is; given none to go by, the whole scene.
  const area = marks ? bakeArea(marks, rect) : rect;
  if (!area) throw new Error('no blood in the scene to bake');
  const picture = await draw(root, bakeSize(area), area);
  const src = await store(picture, bakeFile(sceneId, now));
  if (!src) throw new Error('the picture could not be saved');
  await lay(bakeTile({ src, rect: area, elevation, levels, lowestSort }));
  return src;
}
