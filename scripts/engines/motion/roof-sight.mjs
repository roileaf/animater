// Which parts of a roof lift off. The whole roof fading was a lid off the whole house: walk in the front door and
// every room in the building is laid open at once. What a creature should get is the room it is standing in, and
// whatever it can see from there — which is the sight polygon Foundry already works out for walls and doors.
//
// Pure: it is handed a room, a few polygons and a number, and gives back the polygons to cut out of the roof. The
// cutting itself is painted-roofs.mjs, and where the sight comes from is the shell's business.

/**
 * Clip a polygon to an axis-aligned box (Sutherland–Hodgman, four passes, one an edge). Points are flat [x, y, ...]
 * and so is the answer; a polygon wholly outside comes back empty. The box is convex, which is the one thing this
 * method asks of it — the sight polygon itself may be any shape at all, and usually is.
 */
export function clipToBox(points, box) {
  if (!Array.isArray(points) || points.length < 6 || !box || !(box.w > 0) || !(box.h > 0)) return [];
  const x0 = box.x, y0 = box.y, x1 = box.x + box.w, y1 = box.y + box.h;
  // Each edge as: is a point inside it, and where does a crossing segment meet it.
  const edges = [
    { in: (p) => p[0] >= x0, at: (a, b) => [x0, a[1] + (b[1] - a[1]) * ((x0 - a[0]) / (b[0] - a[0] || 1e-9))] },
    { in: (p) => p[0] <= x1, at: (a, b) => [x1, a[1] + (b[1] - a[1]) * ((x1 - a[0]) / (b[0] - a[0] || 1e-9))] },
    { in: (p) => p[1] >= y0, at: (a, b) => [a[0] + (b[0] - a[0]) * ((y0 - a[1]) / (b[1] - a[1] || 1e-9)), y0] },
    { in: (p) => p[1] <= y1, at: (a, b) => [a[0] + (b[0] - a[0]) * ((y1 - a[1]) / (b[1] - a[1] || 1e-9)), y1] },
  ];
  let ring = [];
  for (let i = 0; i + 1 < points.length; i += 2) ring.push([points[i], points[i + 1]]);
  for (const edge of edges) {
    const next = [];
    for (let i = 0; i < ring.length; i++) {
      const a = ring[(i + ring.length - 1) % ring.length], b = ring[i];
      const aIn = edge.in(a), bIn = edge.in(b);
      if (bIn) { if (!aIn) next.push(edge.at(a, b)); next.push(b); }
      else if (aIn) next.push(edge.at(a, b));
    }
    ring = next;
    if (!ring.length) return [];
  }
  const out = [];
  for (const p of ring) out.push(p[0], p[1]);
  return out;
}

/** How much of the map a flat ring covers, in square pixels. Tiny slivers are not worth cutting. */
export function ringArea(points) {
  if (!Array.isArray(points) || points.length < 6) return 0;
  let a = 0;
  for (let i = 0; i + 1 < points.length; i += 2) {
    const j = (i + 2) % points.length;
    a += points[i] * points[j + 1] - points[j] * points[i + 1];
  }
  return Math.abs(a) / 2;
}

/**
 * How far a cut may reach around a roofed room: its box, moved in or out by `inset`. A negative inset pushes it out
 * past the walls, which is what a room opening up wants — a creature inside should see the stone its room is made
 * of, not a floor floating in a lid. Kept well short of the eaves, which hang further out still, so a roof opened
 * from indoors keeps its own edge rather than being nibbled away from the garden.
 */
export const insideOf = (room, inset = 0) => ({
  x: room.x + inset, y: room.y + inset,
  w: Math.max(0, room.w - inset * 2), h: Math.max(0, room.h - inset * 2),
});

/**
 * The holes to cut in one roof: each creature's sight, clipped to the inside of the room. `sights` are flat [x, y]
 * rings as Foundry's sweep gives them. Slivers smaller than `least` square pixels are dropped — they would be a
 * flicker of roof at a doorway, not a room opening up.
 */
export function roofOpenings(room, sights = [], { inset = 0, least = 64 } = {}) {
  if (!room || !(room.w > 0) || !(room.h > 0)) return [];
  const box = insideOf(room, inset);
  if (!(box.w > 0) || !(box.h > 0)) return [];
  const out = [];
  for (const sight of sights ?? []) {
    // Can this creature see into the room at all? Asked of the room itself, before the cut is allowed to reach out
    // past the walls. The reach is there so somebody inside sees the stone their own room is made of; it must not
    // be the thing that lets somebody in. A creature in the street, whose sight runs along the outside of a shut
    // wall, had a slice of that reach to itself and carved its way in from there, so a house with every door shut
    // went see-through the moment a token outside was selected (Roi: "when the door is closed and theres no sight
    // into the building, that it looks like i have nothing selected and the roof is not seethrough").
    const seen = clipToBox(sight, room);
    if (seen.length < 6 || ringArea(seen) < least) continue;
    const cut = clipToBox(sight, box);
    if (cut.length >= 6 && ringArea(cut) >= least) out.push(cut);
  }
  return out;
}

/**
 * A short word for a set of openings, so a mask is only rebuilt when what it shows has actually changed. Rounded to
 * whole pixels: a creature's sight wobbles by fractions as it is nudged about, and repainting for that is waste.
 */
export function openingKey(polys = []) {
  if (!polys.length) return '';
  return polys.map((p) => p.map((n) => Math.round(n)).join(',')).join('|');
}
