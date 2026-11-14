// Who thin ice holds and when it gives way. Pure: no Foundry, no PIXI; sizes and squares arrive as plain arguments.

// Creature sizes, smallest to largest, in the order Foundry names them.
export const SIZES = ["tiny", "sm", "med", "lg", "huge", "grg"];

// How many squares across each size is (a Tiny creature takes up half a square): how wide the hole it falls through is.
const SQUARES = { tiny: 0.5, sm: 1, med: 1, lg: 2, huge: 3, grg: 4 };
export const squaresAcross = (size) => SQUARES[size];

// Every spelling a system may use for a size, read back as the one in SIZES.
const NAMED = { tiny: "tiny", sm: "sm", small: "sm", med: "med", medium: "med", lg: "lg", large: "lg", huge: "huge", grg: "grg", gargantuan: "grg" };

/** How big a creature is, by the name its system gives it: Small and Medium both stand in one square, and the ice holds one
 *  and not the other, so a square count can never answer this. The system's size wherever it keeps it, else the token's own
 *  footprint for a system that names none; null when nothing says (holdsUp then treats it as safe). Pure. */
export function sizeNameOf(actor, token) {
  const named = actor?.size ?? actor?.system?.traits?.size?.value ?? actor?.system?.traits?.size ?? actor?.system?.size;
  if (typeof named === "string" && named.toLowerCase() in NAMED) return NAMED[named.toLowerCase()];
  const wide = Number(token?.document?.width ?? token?.width);
  if (!(wide > 0)) return null;
  return wide < 0.75 ? "tiny" : wide < 1 ? "sm" : wide < 2 ? "med" : wide < 3 ? "lg" : wide < 4 ? "huge" : "grg";
}

/** Where a creature's weight is read inside its footprint, in squares from its own corner: its middle, except that a
 *  footprint an even number of squares across has no middle square — its middle falls exactly on the grid line between
 *  two squares it stands on equally (a Large creature cornered on 1,1 is at 200,200) — and then the square nearer its own
 *  corner is read. Left to a bare middle, Math.floor would resolve that tie to the square past the line, so a Large
 *  creature walking north would crack the column it is only half in and leave its hole half a square off from where it
 *  stood. Anything that is not a footprint reads as one square. Pure. */
export function weightOffset(squares) {
  const wide = Number(squares) > 0 && Number.isFinite(Number(squares)) ? Number(squares) : 1;
  const middle = wide / 2;
  return Number.isInteger(middle) ? middle - 0.5 : middle;
}

/** The square a point is in, as the key the ice is stored by ("<col>,<row>", either negative): null without a grid or a point. */
export function squareKeyAt(x, y, grid) {
  const size = Number(grid);
  if (!(size > 0) || !Number.isFinite(size) || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  return `${Math.floor(x / size)},${Math.floor(y / size)}`;
}

/** The squares a move passes through, in the order it entered them: not the squares its waypoints landed on. `path` is the
 *  points the move went by (a leg that was not walked is left out by the caller, and each leg starts afresh from its own
 *  point, so no gap is ever walked). Each leg is followed boundary by boundary — a move that only clips the corner of a
 *  square passes through it, and one that goes clean through the corner of four touches neither square beside it. A square
 *  entered again later is listed again; the same square is never listed twice in a row. Pure. */
export function squaresCrossed(path, grid) {
  const size = Number(grid);
  if (!Array.isArray(path) || !(size > 0) || !Number.isFinite(size)) return [];
  const points = path.filter((p) => Number.isFinite(p?.x) && Number.isFinite(p?.y));
  if (!points.length) return [];
  const out = [];
  const put = (col, row) => { const key = `${col},${row}`; if (out[out.length - 1] !== key) out.push(key); };
  const colOf = (p) => Math.floor(p.x / size), rowOf = (p) => Math.floor(p.y / size);
  put(colOf(points[0]), rowOf(points[0]));
  for (let i = 1; i < points.length; i++) {
    const from = points[i - 1], to = points[i];
    const dx = to.x - from.x, dy = to.y - from.y;
    let col = colOf(from), row = rowOf(from);
    put(col, row);
    const stepX = dx > 0 ? 1 : dx < 0 ? -1 : 0, stepY = dy > 0 ? 1 : dy < 0 ? -1 : 0;
    // How far along the leg (0 to 1) the next boundary each way is, and how far apart the ones after it are.
    let nextX = stepX === 0 ? Infinity : ((col + (stepX > 0 ? 1 : 0)) * size - from.x) / dx;
    let nextY = stepY === 0 ? Infinity : ((row + (stepY > 0 ? 1 : 0)) * size - from.y) / dy;
    const apartX = stepX === 0 ? Infinity : size / Math.abs(dx), apartY = stepY === 0 ? Infinity : size / Math.abs(dy);
    // At most one square for each boundary the leg crosses either way, and one more for the square it starts in.
    for (let left = Math.abs(colOf(to) - col) + Math.abs(rowOf(to) - row) + 1; left > 0; left--) {
      if (!(nextX <= 1) && !(nextY <= 1)) break;
      // Straight through a corner: both boundaries at once, which is the square on the diagonal and neither beside it.
      if (Math.abs(nextX - nextY) < 1e-9) { col += stepX; row += stepY; nextX += apartX; nextY += apartY; }
      else if (nextX < nextY) { col += stepX; nextX += apartX; }
      else { row += stepY; nextY += apartY; }
      put(col, row);
    }
  }
  return out;
}

// How far a creature is over what the ice holds: 0 safe (the limit's own size or smaller), 1 one size over, 2 two or more.
// A size we do not know is treated as safe, so odd data never drowns anyone.
export function holdsUp(limit, size) {
  const held = SIZES.indexOf(limit);
  const weight = SIZES.indexOf(size);
  if (held < 0 || weight < 0) return 0;
  return Math.min(2, Math.max(0, weight - held));
}

// What one move does to the ice. Walks the squares entered in order: a creature two sizes over breaks the first and goes
// no further; one size over cracks each square, and breaks one that was already cracked or that the move ended on.
// A square entered twice in one move counts as crossing its own crack. A square is only ever in one list, once. The note is the GM whisper, or null when nothing happened.
export function iceStep({ limit, size, squares = [], cracked = [], ended, name } = {}) {
  const over = holdsUp(limit, size);
  const cracks = [];
  const breaks = [];
  if (over === 2) {
    if (squares.length) breaks.push(squares[0]);
  } else if (over === 1) {
    for (const square of squares) {
      if (breaks.includes(square)) continue;
      // Already cracked, cracked earlier in this same walk, or where the move ended: the ice gives way.
      if (cracked.includes(square) || cracks.includes(square) || square === ended) {
        const i = cracks.indexOf(square);
        if (i >= 0) cracks.splice(i, 1);
        breaks.push(square);
      } else cracks.push(square);
    }
  }
  const who = name || "A creature";
  let note = null;
  if (breaks.length) note = `${who} breaks through the ice into the water (swim).`;
  else if (cracks.length) note = `The ice cracks under ${who}.`;
  return { cracks, breaks, note };
}

const ICE_FLAG = "flags.animater.thinIce";
const SQUARE_KEY = /^-?\d+,-?\d+$/;

// The keys of one stored map that are really squares and really present (a truthy marker), sorted so every client agrees.
function squaresIn(map) {
  if (!map || typeof map !== "object" || Array.isArray(map)) return [];
  return Object.keys(map).filter((key) => SQUARE_KEY.test(key) && map[key]).sort();
}

// How wide each hole is, where the ice stored it: a hole's value is the squares across of the creature that fell through.
// Anything else truthy (an older world, a hand-edited flag) is a hole with no width of its own, and the drawing falls back
// to what the region's limit says.
function sizesIn(map) {
  if (!map || typeof map !== "object" || Array.isArray(map)) return {};
  const out = {};
  for (const key of Object.keys(map)) if (SQUARE_KEY.test(key) && typeof map[key] === "number" && map[key] > 0 && Number.isFinite(map[key])) out[key] = map[key];
  return out;
}

// What a region has stored: `flags.animater.thinIce` holds two maps keyed by square (`{ cracks: { "3,4": 1 }, holes: {} }`),
// because Foundry merges object flags and a key can only be removed by name. Returns the keys as sorted arrays, and how wide
// each hole is where that was stored (`holeSizes`, by key).
// A missing flag, a non-object, junk keys or empty markers read as nothing: a client never breaks on a malformed region.
export function iceStateOf(doc) {
  const stored = doc?.flags?.animater?.thinIce;
  const flag = stored && typeof stored === "object" ? stored : {};
  return { cracks: squaresIn(flag.cracks), holes: squaresIn(flag.holes), holeSizes: sizesIn(flag.holes) };
}

// The region's own thin-ice settings: off unless the flag is exactly true; Medium unless it names one of the sizes in SIZES.
export function iceSettingsOf(doc) {
  const own = doc?.flags?.animater;
  return { thin: own?.iceThin === true, holds: SIZES.includes(own?.iceHolds) ? own.iceHolds : "med" };
}

// How many squares across a creature that breaks ice holding up to `limit` is: the first size over it, the next in SIZES (the
// one list holdsUp judges by); ice that holds the largest size is only ever broken by that size. The hole is that plus one square.
export function breakerSquares(limit) {
  const at = SIZES.indexOf(limit);
  return squaresAcross(SIZES[Math.min(SIZES.length - 1, at + 1)]);
}

/** Whether a point is in a hole in the thin ice, so the floor there is open water: a square one of these regions stored as a
 *  hole, and that region's own say over the point (`inside(doc, point)`, Foundry's testPoint, handed in to keep this pure).
 *  A region that throws is only itself. */
export function iceHoleAt(point, { regions = [], grid, inside = () => true } = {}) {
  const key = squareKeyAt(point?.x, point?.y, grid);
  if (!key) return false;
  for (const doc of regions ?? []) {
    try {
      if (!iceSettingsOf(doc).thin || !iceStateOf(doc).holes.includes(key)) continue;
      if (inside(doc, point)) return true;
    } catch { /* a region mid-change is only itself */ }
  }
  return false;
}

// One judged move (an iceStep result) as updates for scene.updateEmbeddedDocuments("Region", ...): [] when nothing changes.
// A new crack is written at its own key; a break is added to holes as the breaking creature's squares across (`size`, so the
// hole is drawn as wide as what fell through it; 1 when the caller does not say), and deleted from cracks by name (`-=` with
// null, which the caller converts) only if it was stored there. A crack on a square already cracked or already a hole changes
// nothing, and a square in both lists breaks. The whole thinIce flag is never written, so no field depends on key order.
export function iceUpdatesFor(step, { region, size } = {}) {
  const id = region?.id ?? region?._id;
  if (!id) return [];
  const { cracks: stored, holes } = iceStateOf(region);
  const broke = new Set((step?.breaks ?? []).filter((key) => !holes.includes(key)));
  const wide = Number(size) > 0 && Number.isFinite(Number(size)) ? Number(size) : 1;
  const fields = {};
  for (const key of broke) {
    if (stored.includes(key)) fields[`${ICE_FLAG}.cracks.-=${key}`] = null;
    fields[`${ICE_FLAG}.holes.${key}`] = wide;
  }
  for (const key of step?.cracks ?? []) {
    if (broke.has(key) || stored.includes(key) || holes.includes(key)) continue;
    fields[`${ICE_FLAG}.cracks.${key}`] = 1;
  }
  return Object.keys(fields).length ? [{ _id: id, ...fields }] : [];
}

/** What one move did to one region's thin ice: `{ updates, note }` — the region updates to write (`[]` when nothing changed,
 *  which is what a creature the ice holds leaves behind) and the GM's whisper, or null when there is nothing to write and so
 *  nothing to say. `squares` are the squares of the move that this region holds, in the order they were entered, and `ended`
 *  the square the move finished on where that is one of them. The region's own limit is read from its settings; a region the
 *  GM never marked as thin ice is left alone. Pure: the caller writes. */
export function iceMoveFor({ region, size, squares = [], ended, name } = {}) {
  const none = { updates: [], note: null };
  const { thin, holds } = iceSettingsOf(region);
  if (!thin || !squares.length) return none;
  const step = iceStep({ limit: holds, size, squares, cracked: iceStateOf(region).cracks, ended, name });
  const updates = iceUpdatesFor(step, { region, size: squaresAcross(size) });
  return updates.length ? { updates, note: step.note } : none;
}
