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

// The squares fire melted, where the ice stored them: a hole whose value is MELTED, open water the fire ate through,
// which is drawn as a melt with a slushy edge and not as a break. Sorted, as the other lists are.
function meltsIn(map) {
  if (!map || typeof map !== "object" || Array.isArray(map)) return [];
  return Object.keys(map).filter((key) => SQUARE_KEY.test(key) && map[key] === MELTED).sort();
}

// What a region has stored: `flags.animater.thinIce` holds two maps keyed by square (`{ cracks: { "3,4": 1 }, holes: {} }`),
// because Foundry merges object flags and a key can only be removed by name. Returns the keys as sorted arrays, and how wide
// each hole is where that was stored (`holeSizes`, by key).
// A missing flag, a non-object, junk keys or empty markers read as nothing: a client never breaks on a malformed region.
export function iceStateOf(doc) {
  const stored = doc?.flags?.animater?.thinIce;
  const flag = stored && typeof stored === "object" ? stored : {};
  return { cracks: squaresIn(flag.cracks), holes: squaresIn(flag.holes), holeSizes: sizesIn(flag.holes), melts: meltsIn(flag.holes) };
}

// Whether a region's own flags (`flags.animater`) have thin ice on: off unless the flag is exactly true, so a region the
// GM never marked is never thin ice. The panel and the steps read it from the flags; iceSettingsOf from the document.
export const thinIceOn = (own) => own?.iceThin === true;
// What the ice holds, by its flags: Medium unless they name one of the sizes in SIZES. The panel offers three of the six;
// a flag naming another size is kept as it is, never collapsed to Medium.
export const iceHoldsOf = (own) => (SIZES.includes(own?.iceHolds) ? own.iceHolds : "med");
// The region's own thin-ice settings: off unless the flag is exactly true; Medium unless it names one of the sizes in SIZES.
export function iceSettingsOf(doc) {
  const own = doc?.flags?.animater;
  return { thin: thinIceOn(own), holds: iceHoldsOf(own) };
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

// ---- putting the ice back, and fire melting it ----

// A hole fire melted, as the ice stores it: not a number of squares across (what a creature that fell through leaves)
// but open water melted through one square, drawn as a melt with a slushy edge and never as a break.
export const MELTED = "melt";

// The keys one stored map really holds, whatever is under them: clearing the ice takes a falsy or malformed key too, or
// it would sit in the flag for ever.
const keysIn = (map) => (map && typeof map === "object" && !Array.isArray(map) ? Object.keys(map) : []);

/** Every crack and hole one region has stored, cleared by name: `flags.animater.thinIce.cracks.-=<key>` and
 *  `...holes.-=<key>`, in the `-=`/null form the caller converts (withDeletes). The `thinIce` flag itself and the two
 *  maps inside it are never written, so no delete under them is undone by a parent written beside it and nothing stale
 *  is ever left behind. {} when the region has nothing stored. Pure. */
function iceClearFields(region) {
  const stored = region?.flags?.animater?.thinIce;
  const flag = stored && typeof stored === "object" ? stored : {};
  const fields = {};
  for (const key of keysIn(flag.cracks)) fields[`${ICE_FLAG}.cracks.-=${key}`] = null;
  for (const key of keysIn(flag.holes)) fields[`${ICE_FLAG}.holes.-=${key}`] = null;
  return fields;
}

// Refreeze (the region panel's button): one region's ice whole again, as updates for updateEmbeddedDocuments("Region").
// [] when it has nothing stored or has no id. Thin ice being off does not stop it: what is stored is cleared either way.
export function iceRefreezeUpdates(region) {
  const id = region?.id ?? region?._id;
  const fields = id ? iceClearFields(region) : {};
  return Object.keys(fields).length ? [{ _id: id, ...fields }] : [];
}

// Repair: the thin ice of every region whole again, one update each (none for a region with nothing stored). No region
// is ever deleted — unlike a prop's rubble, thin ice is the region itself, and only its own keys go.
export const iceRepairUpdates = (regions) => (regions ?? []).flatMap((region) => iceRefreezeUpdates(region));

/** What a fire melts. `regions` are [{ id, flags, squares }]: the squares of that region the fire covers, as square keys.
 *  Each becomes a hole stored as MELTED — open water with a slushy edge — and a crack under it goes by name. A square
 *  already open stays the hole it is (a break keeps its own shape), and a region the GM never marked melts nothing.
 *  Updates for updateEmbeddedDocuments("Region"); [] when nothing melts. Pure: the caller finds the squares and writes. */
export function iceMeltUpdates(regions = []) {
  const out = [];
  for (const region of regions ?? []) {
    const id = region?.id ?? region?._id;
    if (!id || !iceSettingsOf(region).thin) continue;
    const { cracks, holes } = iceStateOf(region);
    const fields = {};
    for (const key of region?.squares ?? []) {
      if (!SQUARE_KEY.test(key) || holes.includes(key)) continue;
      if (cracks.includes(key)) fields[`${ICE_FLAG}.cracks.-=${key}`] = null;
      fields[`${ICE_FLAG}.holes.${key}`] = MELTED;
    }
    if (Object.keys(fields).length) out.push({ _id: id, ...fields });
  }
  return out;
}

/** The squares of one region a fire area covers, as the ice keys them ("<col>,<row>" on the canvas grid, the same keys a
 *  move writes). `bounds` is the region's own box in pixels ({ x, y, w, h }); `inside(point)` says whether the point is
 *  in the region and `inArea(point)` whether the fire covers it, both asked at the middle of each square. A region
 *  larger than `cap` squares melts nothing rather than walking the whole map. Sorted, so every list reads the same. Pure. */
export function iceMeltSquares({ bounds, grid, inside = () => true, inArea = () => false, cap = 4000 } = {}) {
  const size = Number(grid);
  if (!bounds || !(size > 0) || !Number.isFinite(size)) return [];
  const { x, y, w, h } = bounds;
  if (![x, y, w, h].every(Number.isFinite) || !(w > 0) || !(h > 0)) return [];
  const col0 = Math.floor(x / size), row0 = Math.floor(y / size);
  // The squares the box really reaches into: an edge landing exactly on a grid line is not a square of its own.
  const cols = Math.max(1, Math.ceil((x + w) / size) - col0), rows = Math.max(1, Math.ceil((y + h) / size) - row0);
  if (cols <= 0 || rows <= 0 || cols * rows > cap) return [];
  const out = [];
  for (let row = row0; row < row0 + rows; row++) {
    for (let col = col0; col < col0 + cols; col++) {
      const at = { x: (col + 0.5) * size, y: (row + 0.5) * size };
      let covered = false;
      try { covered = inside(at) === true && inArea(at) === true; } catch { covered = false; }
      if (covered) out.push(`${col},${row}`);
    }
  }
  return out;
}
