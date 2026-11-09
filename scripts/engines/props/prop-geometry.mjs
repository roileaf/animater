// A tile's rectangle as the prop rules read it: top-left x/y, size, and a rotation about its centre.
// v14 stores x/y at the texture anchor (the centre by default) and turns the tile about that point, so the
// centre is the anchor plus the turned offset to the middle; the top-left follows from the centre.
export function tileRect(tile) {
  const d = tile?.document ?? tile ?? {};
  const width = Number(d.width) || 0, height = Number(d.height) || 0, rotation = Number(d.rotation) || 0;
  const ax = Number.isFinite(d.texture?.anchorX) ? d.texture.anchorX : 0.5, ay = Number.isFinite(d.texture?.anchorY) ? d.texture.anchorY : 0.5;
  const a = (rotation * Math.PI) / 180, dx = (0.5 - ax) * width, dy = (0.5 - ay) * height;
  const cx = (Number(d.x) || 0) + Math.cos(a) * dx - Math.sin(a) * dy, cy = (Number(d.y) || 0) + Math.sin(a) * dx + Math.cos(a) * dy;
  return { x: cx - width / 2, y: cy - height / 2, width, height, rotation };
}
