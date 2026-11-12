// Light over short walls onto raised ground (Map painting's Heights): Foundry's walls stop a light wholly, however low, so a
// 10 ft house wall left a 20 ft clifftop beyond it dark in a torch's light. The light that would reach such ground is the
// light's own sweep with the walls no taller than that ground left out, kept only on that ground and only where the light did
// not already reach; main.mjs shows each such piece as a local copy of the light shaped to it. (Roi: "ezren holding a torch next
// to the wall which is 0-10 and the slope is 40 ft yet the wall shadow is on its top?", then "Build it".) Pure, given ClipperLib.

const toPath = (flat, scale) => { const out = []; for (let i = 0; i + 1 < flat.length; i += 2) out.push({ X: Math.round(flat[i] * scale), Y: Math.round(flat[i + 1] * scale) }); return out; };
const toFlat = (path, scale) => path.flatMap((p) => [p.X / scale, p.Y / scale]);

/** The pieces (flat [x, y, …] outlines) of `reach` (the light's sweep past the short walls) that lie on `raised` (outlines of the
 *  ground it reaches) and outside `lit` (where the light already falls). Each piece at least `least` px² (slivers dropped);
 *  holes are dropped (a light's shape has none). `scale`: the precision clipping works at. */
// (`overlap` px: how far each piece reaches back under where the light already falls, so the two soft edges blend instead of
// leaving a dark seam between them. Lights take the brighter where they overlap, so it never lights twice as bright. Roi, of
// the first: "thoughts?")
export function spillPieces({ ClipperLib, reach, raised = [], lit = null, scale = 10, least = 400, overlap = 0 }) {
  if (!ClipperLib || !reach?.length || !raised.length) return [];
  const { Clipper, PolyType, ClipType, PolyFillType } = ClipperLib, run = (subject, clip, type) => {
    const c = new Clipper(), out = []; c.AddPaths(subject, PolyType.ptSubject, true); c.AddPaths(clip, PolyType.ptClip, true);
    c.Execute(type, out, PolyFillType.pftNonZero, PolyFillType.pftNonZero); return out;
  };
  let pieces = run([toPath(reach, scale)], raised.map((r) => toPath(r, scale)), ClipType.ctIntersection);
  if (lit?.length && pieces.length) {
    let under = [toPath(lit, scale)];
    if (overlap > 0 && ClipperLib.ClipperOffset) { const o = new ClipperLib.ClipperOffset(), out = []; o.AddPaths(under, ClipperLib.JoinType.jtRound, ClipperLib.EndType.etClosedPolygon); o.Execute(out, -overlap * scale); under = out; }
    pieces = under.length ? run(pieces, under, ClipType.ctDifference) : pieces;
  }
  return pieces.filter((p) => Clipper.Area(p) > least * scale * scale).map((p) => toFlat(p, scale));
}

/** Whether a wall (its top in the scene's units over the level's floor; null for one standing to the ceiling) lets light past
 *  onto ground `height` (same units) high: only a wall no taller than that ground does. */
export const lightPasses = (wallTop, height) => Number.isFinite(wallTop) && Number.isFinite(height) && wallTop <= height;

/** The raised parts a light of `radius` px at (x, y) can reach, grouped by height: [{ height, areas }] (outer outlines only). */
export function reachableParts(parts = [], { x, y, radius }) {
  const near = (area) => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (let i = 0; i + 1 < area.length; i += 2) { x0 = Math.min(x0, area[i]); x1 = Math.max(x1, area[i]); y0 = Math.min(y0, area[i + 1]); y1 = Math.max(y1, area[i + 1]); } return x1 >= x - radius && x0 <= x + radius && y1 >= y - radius && y0 <= y + radius; };
  const by = new Map();
  for (const p of parts) for (const a of p.areas ?? []) if (a?.length >= 6 && near(a)) { if (!by.has(p.height)) by.set(p.height, []); by.get(p.height).push(Array.from(a)); }
  return [...by].map(([height, areas]) => ({ height, areas }));
}
