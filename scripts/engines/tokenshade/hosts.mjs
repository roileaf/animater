// What Tokenshade draws on (pure): a token's art, a tile's image, or a drawing's shape with its text. The engine
// asks here which display object carries a placeable's filters and how big the look's rings and discs should be.

export const HOSTS = ['token', 'tile', 'drawing'];
// The kind of placeable: by its document's name; anything else (a bare object in a preview or a test) is a token.
export function hostKind(placeable) {
  const name = placeable?.document?.documentName;
  return name === 'Tile' ? 'tile' : name === 'Drawing' ? 'drawing' : 'token';
}
// The display object the filters sit on: a token's or tile's mesh, a drawing's shape (its text is a child of it).
export function hostMesh(placeable) {
  return (hostKind(placeable) === 'drawing' ? placeable?.shape : placeable?.mesh) ?? null;
}
// A tile's or drawing's own size on the map, in pixels (null for a token: engine.mjs sizes those by their art's
// scale, and null when it has none yet).
export function hostSize(placeable) {
  const kind = hostKind(placeable), doc = placeable?.document;
  if (kind === 'token') return null;
  const width = Math.abs(Number(kind === 'tile' ? doc.width : doc.shape?.width)), height = Math.abs(Number(kind === 'tile' ? doc.height : doc.shape?.height));
  return width > 0 && height > 0 ? { width, height } : null;
}
