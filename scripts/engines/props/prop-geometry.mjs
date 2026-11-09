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

// The scale Foundry draws a tile's art at (PrimarySpriteMesh#resize): fitted to the tile's size by texture.fit,
// then multiplied by texture.scaleX/scaleY (a negative one mirrors). texW/texH: the art's own size.
export function tileArtScale(tile, texW, texH) {
  const d = tile?.document ?? tile ?? {}, w = Number(d.width) || 0, h = Number(d.height) || 0;
  const tw = texW > 0 ? texW : 1, th = texH > 0 ? texH : 1, fx = w / tw, fy = h / th;
  const fit = d.texture?.fit ?? "fill";
  const [sx, sy] = fit === "cover" ? [Math.max(fx, fy), Math.max(fx, fy)] : fit === "contain" ? [Math.min(fx, fy), Math.min(fx, fy)]
    : fit === "width" ? [fx, fx] : fit === "height" ? [fy, fy] : [fx, fy];
  const k = (v) => (Number.isFinite(v) && v !== 0 ? v : 1);
  return { sx: sx * k(d.texture?.scaleX), sy: sy * k(d.texture?.scaleY) };
}
