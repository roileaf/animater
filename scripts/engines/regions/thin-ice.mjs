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
 *  four squares it stands on equally (a Large creature cornered on 1,1 is at 200,200) — and then the square nearer its
 *  own corner is read. Both that square and the one a bare middle would land in (Math.floor resolving the tie past the
 *  line) are squares the creature really stands on, so this only settles which of them breaks: the near one, which keeps
 *  a Large creature's hole behind it as it walks on rather than ahead of it. It is NOT a half-square correction — the
 *  weight point itself moves by half a square, and the hole drawn from it with it — and the hole's own extent is what
 *  decides where the water is (ice-break-look.mjs iceHoleAt), not this square alone. Anything that is not a footprint
 *  reads as one square. Pure. */
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

// ---- one move, as the floor under it reads it ----
// (The footprints' own listener walks a move the same way, so the walk lives here once and both read it: a creature
// flying over the floor, burrowing under it, swimming in it or blinking across leaves it alone either way.)

/** The actions that leave the floor as it was: nothing is cracked and nothing is printed. Not movement-feel's
 *  OUT_OF_WATER, which answers another question — whether a creature is in the water at all, where swimming plainly is. */
export const OFF_THE_FLOOR = Object.freeze(["fly", "burrow", "swim", "displace"]);

/** The legs of one move that were really walked, in the order they were walked: `{ from, to, last }`, the two points `mid`
 *  reads off the waypoints at either end, and `last` true for the leg that ends on the move's final waypoint (so a caller
 *  can tell where the move came to rest). `ways` are the waypoints the move passed and `from` the point it began at
 *  (Foundry's `movement.origin`). A leg from nowhere, one flown, burrowed, swum or blinked, a teleport and one above or
 *  below the level's own floor are each left out, and the walk carries on from that waypoint all the same. Pure. */
export function walkedLegs(ways, { from, base = 0, mid = (w) => w } = {}) {
  const all = Array.isArray(ways) ? ways : [];
  const out = [];
  let prev = from;
  for (let i = 0; i < all.length; i++) {
    const way = all[i];
    const walked = prev && !OFF_THE_FLOOR.includes(way?.action) && !way?.teleport && Number(way?.elevation ?? base) === base;
    if (walked) out.push({ from: mid(prev), to: mid(way), last: i === all.length - 1 });
    prev = way;
  }
  return out;
}

/** The squares one move really entered, in the order it entered them: its legs walked square by square (squaresCrossed),
 *  with the square it began in left out. That square was not entered by this move — the creature was already standing on
 *  it — so a creature already on thin ice no longer breaks the square under its own feet and strides off, and "the first
 *  square entered" means what it says for a creature two sizes over. The same square entered again later is listed again.
 *  Pure. */
export function squaresEntered(legs, grid) {
  const out = [];
  for (const { from, to } of legs ?? []) for (const key of squaresCrossed([from, to], grid)) if (out[out.length - 1] !== key) out.push(key);
  return out.slice(1);
}

// One waypoint as the walk names it: where it is, how high, how it was reached. Enough to tell one move's path from the
// next move's, and nothing about the token, so a remembered path is only ever about the move it was remembered for.
const wayName = (w) => `${Math.round(Number(w?.x))},${Math.round(Number(w?.y))},${w?.elevation ?? ""},${w?.action ?? ""},${w?.teleport ? 1 : 0}`;
/** The first `count` waypoints of a path, named: what a caller keeps to recognise the same move being reported again. */
export const movePathName = (ways, count) => (ways ?? []).slice(0, Math.max(0, Number(count) || 0)).map(wayName).join(";");

/** What of one move's passed waypoints the hook has not walked yet: `{ from, ways, done, sig }` — the point the new part
 *  starts from (the last waypoint already walked, else the move's own origin), the waypoints after it, and the `{ done,
 *  sig }` to keep for the next firing. Foundry may fire a move's hook again for the same move with a longer `passed`
 *  list; a second firing must not escalate the squares the first already cracked, because a crack crossed again breaks.
 *  `seen` is what was kept last time for this token (`{ id, done, sig }`): the prefix is skipped only when the move names
 *  itself the same move (Foundry's own `movement.id`, where a version gives one) and the list really does begin with the
 *  very waypoints already walked — so another move, even one starting from the same square, is walked whole. Pure. */
export function moveSince(movement, seen) {
  const ways = movement?.passed?.waypoints;
  const all = Array.isArray(ways) ? ways : [];
  const id = movement?.id ?? null;
  const done = Number.isInteger(seen?.done) ? seen.done : 0;
  const same = (seen?.id ?? null) === id && done > 0 && done <= all.length && typeof seen?.sig === "string" && movePathName(all, done) === seen.sig;
  const skip = same ? done : 0;
  return { from: skip > 0 ? all[skip - 1] : movement?.origin, ways: all.slice(skip), done: all.length, sig: movePathName(all, all.length), id };
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

// Whether a region is still the water its thin ice was turned on for: its own floor says water, or it has none of its own
// and nothing else marks it as another kind (a cave's growth, a deck over water, a room indoors — each of which the panel
// writes when the GM takes the region out of water). The switch lives among the water controls alone, so a region given
// another floor would otherwise keep walking as ice, and keep drawing cracks and holes of dark water on grass, with the
// switch that undoes it nowhere on screen.
const stillWater = (own) => (own?.floor ? own.floor === "water" : !own?.cavern && own?.overWater !== true && own?.indoors !== true);
// Whether a region's own flags (`flags.animater`) have thin ice on: off unless the flag is exactly true, so a region the
// GM never marked is never thin ice, and off for a region that is no longer water. The panel and the steps read it from
// the flags; iceSettingsOf from the document.
export const thinIceOn = (own) => own?.iceThin === true && stillWater(own);
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

// (Whether a point is in a hole — so the floor there is open water — is asked of the hole's own drawn shape, and so lives
// with that shape: ice-break-look.mjs iceHoleAt. A square key cannot answer it: a hole is drawn wider than the one square
// it is keyed by, and for a footprint an even number of squares across the square the creature's weight broke is not the
// square its own centre is in.)

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

/** What one move did to one region's thin ice: `{ updates, note, broke }` — the region updates to write (`[]` when nothing changed,
 *  which is what a creature the ice holds leaves behind) and the GM's whisper, or null when there is nothing to write and so
 *  nothing to say. `squares` are the squares of the move that this region holds, in the order they were entered, and `ended`
 *  the square the move finished on where that is one of them. The region's own limit is read from its settings; a region the
 *  GM never marked as thin ice is left alone. `broke` says the ice gave way here, so a caller watching several regions at
 *  once can tell one break from a crack and whisper once. Pure: the caller writes. */
export function iceMoveFor({ region, size, squares = [], ended, name } = {}) {
  const none = { updates: [], note: null, broke: false };
  const { thin, holds } = iceSettingsOf(region);
  if (!thin || !squares.length) return none;
  const step = iceStep({ limit: holds, size, squares, cracked: iceStateOf(region).cracks, ended, name });
  const updates = iceUpdatesFor(step, { region, size: squaresAcross(size) });
  return updates.length ? { updates, note: step.note, broke: step.breaks.length > 0 } : none;
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

// Two boxes ({ x, y, w, h }) where they overlap, or null: a box of no width or height is no overlap.
function boxesOver(a, b) {
  if (!b) return a ?? null;
  if (!a) return null;
  const x0 = Math.max(a.x, b.x), y0 = Math.max(a.y, b.y), x1 = Math.min(a.x + a.w, b.x + b.w), y1 = Math.min(a.y + a.h, b.y + b.h);
  return x1 > x0 && y1 > y0 ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null;
}

/** The squares of one region a fire area covers, as the ice keys them ("<col>,<row>" on the canvas grid, the same keys a
 *  move writes). `bounds` is the region's own box in pixels ({ x, y, w, h }) and `within` the fire's own, where the caller
 *  knows it: only where the two overlap is walked, because a fireball is a handful of squares however big the lake under
 *  it is. `inside(point)` says whether the point is in the region and `inArea(point)` whether the fire covers it, both
 *  asked at the middle of each square. A box larger than `cap` squares melts nothing rather than walking the whole map —
 *  which, without a fire's box to narrow it to, is what a wide region would cost. Row by row, so every screen reads the
 *  same list in the same order. Pure. */
export function iceMeltSquares({ bounds, within = null, grid, inside = () => true, inArea = () => false, cap = 4000 } = {}) {
  const size = Number(grid);
  if (!bounds || !(size > 0) || !Number.isFinite(size)) return [];
  if (![bounds.x, bounds.y, bounds.w, bounds.h].every(Number.isFinite) || !(bounds.w > 0) || !(bounds.h > 0)) return [];
  const fire = within && [within.x, within.y, within.w, within.h].every(Number.isFinite) && within.w > 0 && within.h > 0 ? within : null;
  const box = boxesOver(bounds, fire);
  if (!box) return [];
  const { x, y, w, h } = box;
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
