import { iceStateOf, iceSettingsOf, breakerSquares, MELTED } from "./thin-ice.mjs";
// The ice's own state, sizes and the mark fire leaves live with the judgement (thin-ice.mjs); the screen asks for them here.
export { iceSettingsOf, breakerSquares, MELTED };

// The shapes of thin ice breaking: the cracks painted in a square that has cracked, the jagged hole of dark water where it gave
// way, and the loose shards of ice floating in that hole. Geometry only, pure: no Foundry, no PIXI, no drawing; a later layer
// draws what these return. Everything is in absolute canvas pixels (a square "col,row" has its corner at col*grid, row*grid)
// and seeded from the square key and `seed`, so every client draws the same break from what the GM stored. Junk input (a
// malformed key, no grid, no size) gives an empty result rather than an error.

const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

// "3,4" or "-1,2" -> { col, row }, else null.
function parseKey(key) {
  const m = typeof key === "string" ? /^(-?\d+),(-?\d+)$/.exec(key) : null;
  return m ? { col: Number(m[1]), row: Number(m[2]) } : null;
}

// A stream of 0-1 numbers for one square, one seed and one purpose (`salt`: cracks, hole and shards each draw their own).
// The same three give the same stream; any of them changing gives another.
function stream({ col, row }, seed, salt) {
  const base = col * 12.9898 + row * 78.233 + (Number(seed) || 0) * 37.719 + salt * 5.31;
  let i = 0;
  return () => hash(base + 1.618 * i++);
}

const validGrid = (grid) => Number.isFinite(grid) && grid > 0;

/** The cracks in a cracked square: 4 to 6 jagged polylines radiating from near its centre, each point inside the square.
 *  [[{x, y}, ...], ...] */
export function crackLines(key, { grid, seed = 0 } = {}) {
  const sq = parseKey(key);
  if (!sq || !validGrid(grid)) return [];
  const next = stream(sq, seed, 1);
  const x0 = sq.col * grid, y0 = sq.row * grid, margin = grid * 0.04;
  const clamp = (v, lo) => Math.min(lo + grid - margin, Math.max(lo + margin, v));
  const cx = x0 + grid / 2, cy = y0 + grid / 2;
  // A few long runs rather than a bush of short ones. Ice fractures in straight lines that change direction at a break,
  // not in twigs: three or four main cracks out of the point the weight fell on, each nearly straight, with the odd
  // branch off one of them. The old shape read as sticks lying on the ice.
  const count = 3 + Math.floor(next() * 2);
  const lines = [];
  const run = (fromX, fromY, angle, steps, step) => {
    let x = fromX, y = fromY, a = angle;
    const line = [{ x, y }];
    for (let s = 0; s < steps; s++) {
      a += (next() - 0.5) * CRACK_VEER; // a crack holds its line, then turns at a break
      // Kept short enough that the clamp below does not decide where a crack goes: at their longest these reach about
      // 0.44 of a grid from the middle, inside the 0.46 the clamp allows. A crack that reached the edge was pinned flat
      // against it, which read as a straight run down the grid line and lined up with the next cracked square’s.
      const len = grid * step * (0.75 + next() * 0.5);
      x = clamp(x + Math.cos(a) * len, x0); y = clamp(y + Math.sin(a) * len, y0);
      line.push({ x, y });
    }
    return { line, end: { x, y }, angle: a };
  };
  for (let k = 0; k < count; k++) {
    const angle = ((k + next() * 0.5) / count) * Math.PI * 2;
    const from = { x: cx + (next() - 0.5) * grid * 0.1, y: cy + (next() - 0.5) * grid * 0.1 };
    const main = run(from.x, from.y, angle, CRACK_STEPS, CRACK_STEP);
    lines.push(main.line);
    // One crack in two throws a shorter one off where it turned: a fracture branches, it does not only radiate.
    if (next() < 0.5 && main.line.length > 2) {
      const at = main.line[1 + Math.floor(next() * (main.line.length - 2))];
      lines.push(run(at.x, at.y, main.angle + (next() < 0.5 ? -1 : 1) * (0.6 + next() * 0.5), 2, CRACK_STEP * 0.7).line);
    }
  }
  return lines;
}


// Points round the hole, and how wide it is: about the creature's size plus one square across, its radius never under
// LOW of that, so shards placed inside LOW * half are always in the hole.
// A break is not a circle. Eleven points rather than sixteen, and each one free to sit anywhere from the rim to well inside
// it, so the opening is angular and uneven — the shape ice leaves when it gives way, not a hole punched with a cutter.
const RING_POINTS = 11, LOW = 0.6;
// How a crack runs: nearly straight, turning a little at each break along it, in a few long steps rather than many short.
const CRACK_STEPS = 3, CRACK_STEP = 0.13, CRACK_VEER = 0.55;
// How a broken sheet comes apart: a square's worth into about five slabs, a Huge creature's hole into a dozen at most;
// each shrunk a little about its middle so the water shows between them, slid a touch outward and swung a touch round.
const PLATES_ONE = 4, PLATES_PER_SQUARE = 2.2, PLATES_MOST = 12;
const PLATE_SHRINK_LOW = 0.88, PLATE_SHRINK_SPAN = 0.07, PLATE_DRIFT_LOW = 0.012, PLATE_DRIFT_SPAN = 0.035, PLATE_TURN = 0.26;
// Where the creature went through, the ice is gone: the plates nearest the middle sit furthest apart and most water shows
// between them, while the ones out at the rim are still almost touching. A photograph of a hole in a river reads the same
// way, and it is what tells a player at a glance where the hole is rather than where the ice merely cracked.
const PLATE_CENTRE_OPEN = 0.13;
// The creature went through here, so there is no ice where it is: an opening about its own size, with the slabs shoved
// out around it and their inner edges cut straight where they were pushed back. Without it the pieces closed over the
// hole and a creature in the water looked like a creature on a heap of broken slabs.
const PLATE_OPENING = 0.92;
// Ice does not break along drawn lines. Every edge of a slab is chipped: a point or two set into it, shifted square to
// the edge by a little, so no edge is ever a perfect straight run. Without this the pieces read as cut paper however
// they are coloured, which is the single thing that gave the first design away.
const PLATE_CHIP = 0.035, PLATE_CHIP_AT = 0.055;
// A break leaves chips as well as slabs: a few small pieces floating loose in the opening the creature made.
const PLATE_CHIPS_KEPT = 2, PLATE_CHIP_SIZE = 0.3;
// How a slab rides: its lift is a fraction of a square, so it is the same small movement on a map of 70-pixel squares as on
// one of 200, and its swing is radians. Both are small — a plate the size of a creature barely moves on the water.
const PLATE_SWAY = 0.012, PLATE_SWING = 0.016;

/** The hole a creature falls through: a jagged ring about `size` + 1 squares across (`size` in squares: 1 Medium, 2 Large...),
 *  centred on the square it broke, as [{x, y}, ...]. It is star-shaped: one radius per angle, the angles strictly rising round
 *  the centre and every radius above zero, so it can never cross itself. Wound by rising angle, which in canvas coordinates
 *  (y down) is clockwise on screen, a positive shoelace sum. The first point is NOT repeated at the end. */
export function holeOutline(key, { grid, seed = 0, size } = {}) {
  const sq = parseKey(key);
  if (!sq || !validGrid(grid) || !(Number(size) > 0) || !Number.isFinite(size)) return [];
  const next = stream(sq, seed, 2);
  const cx = (sq.col + 0.5) * grid, cy = (sq.row + 0.5) * grid, half = ((size + 1) / 2) * grid;
  const turn = next() * Math.PI * 2, step = (Math.PI * 2) / RING_POINTS;
  const ring = [];
  for (let k = 0; k < RING_POINTS; k++) {
    const angle = turn + (k + (next() - 0.5) * 0.6) * step; // up to 0.3 of a step either way: never reaches a neighbour
    // Odd points range over the whole depth, even ones only the outer half: a ragged edge of broken ice, not a wobbly circle.
    const radius = half * (LOW + (1 - LOW) * (k % 2 ? next() : 0.5 + next() * 0.5));
    ring.push({ x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius });
  }
  return ring;
}

// ---- the ice that broke, as plates ----

// Ice does not shatter into chips. It fractures along a few long straight lines into a handful of big angular slabs that
// still read as one sheet come apart: the pieces nearly fit together, the water shows in the widening seams between them,
// and each slab is pale on top with its thickness showing along one edge. That is what every photograph of a broken river
// or lake looks like, and it is what these return.

// Where a straight cut through a polygon leaves the half on one side of it. The cut goes through `at` along `angle`;
// `keep` is +1 for one side and -1 for the other. Sutherland-Hodgman against a single half-plane, so a convex piece stays
// convex and a ring that does not cross itself stays one piece.
function halfOf(poly, at, angle, keep) {
  const nx = -Math.sin(angle) * keep, ny = Math.cos(angle) * keep;
  const side = (pt) => (pt.x - at.x) * nx + (pt.y - at.y) * ny;
  const out = [];
  for (let k = 0; k < poly.length; k++) {
    const a = poly[k], b = poly[(k + 1) % poly.length], sa = side(a), sb = side(b);
    if (sa >= 0) out.push(a);
    if ((sa >= 0) !== (sb >= 0)) {
      const t = sa / (sa - sb);
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return out.length >= 3 ? out : [];
}

// A polygon's area (twice it, signed) and its middle of mass. A sliver of no area has no middle, and is dropped.
function areaMid(poly) {
  let twice = 0, cx = 0, cy = 0;
  for (let k = 0; k < poly.length; k++) {
    const a = poly[k], b = poly[(k + 1) % poly.length], f = a.x * b.y - b.x * a.y;
    twice += f; cx += (a.x + b.x) * f; cy += (a.y + b.y) * f;
  }
  const area = Math.abs(twice) / 2;
  if (!(area > 0)) return null;
  return { area, mid: { x: cx / (3 * twice), y: cy / (3 * twice) } };
}

// An edge with a chip or two taken out of it: each run between two corners gets an extra point partway along, pushed
// square to the run. Long edges get two, short ones one, so a big slab is as rough along its length as a small one.
function chipped(poly, grid, next) {
  const out = [];
  for (let k = 0; k < poly.length; k++) {
    const a = poly[k], b = poly[(k + 1) % poly.length];
    out.push(a);
    const dx = b.x - a.x, dy = b.y - a.y, run = Math.hypot(dx, dy);
    if (!(run > grid * 0.08)) continue;
    const nx = -dy / run, ny = dx / run;
    const bites = run > grid * 0.5 ? 2 : 1;
    for (let i = 1; i <= bites; i++) {
      const along = (i / (bites + 1)) + (next() - 0.5) * PLATE_CHIP_AT;
      const out_ = (next() - 0.5) * 2 * grid * PLATE_CHIP;
      out.push({ x: a.x + dx * along + nx * out_, y: a.y + dy * along + ny * out_ });
    }
  }
  return out;
}

/** The ice of a broken square as floating plates: the hole's own outline fractured along straight lines into a few slabs,
 *  each shrunk a little about its own middle and nudged outward, so the dark water shows in the seams between them and the
 *  pieces still read as one sheet come apart. [{ points: [{x, y}, ...], mid: {x, y}, turn, drift }], biggest first.
 *  `turn` is how far that slab has swung, `drift` how far it has slid out and `sway` how far it lifts on the water, all
 *  small and all in the caller's own pixels. `chip` marks the small pieces floating loose in the opening rather than the
 *  slabs ringing it. Junk input gives []. Pure. */
export function icePlates(key, { grid, seed = 0, size } = {}) {
  const sq = parseKey(key);
  if (!sq || !validGrid(grid) || !(Number(size) > 0) || !Number.isFinite(size)) return [];
  const ring = holeOutline(key, { grid, seed, size });
  if (ring.length < 3) return [];
  const next = stream(sq, seed, 3);
  const cx = (sq.col + 0.5) * grid, cy = (sq.row + 0.5) * grid;
  // A bigger hole breaks into more pieces, but never into confetti: a sheet comes apart into slabs you can count.
  const want = Math.max(3, Math.min(PLATES_MOST, Math.round(PLATES_ONE + size * PLATES_PER_SQUARE)));
  let pieces = [{ poly: ring, ...(areaMid(ring) ?? { area: 0, mid: { x: cx, y: cy } }) }];
  // Always split the biggest piece left, which is how a sheet really goes: the long cut crosses the whole thing first.
  for (let n = 1; n < want; n++) {
    pieces.sort((a, b) => b.area - a.area);
    const big = pieces.shift();
    if (!big || !(big.area > 0)) break;
    // Through a point near its middle, so no cut shaves off a sliver.
    const at = { x: big.mid.x + (next() - 0.5) * grid * 0.22, y: big.mid.y + (next() - 0.5) * grid * 0.22 };
    const angle = next() * Math.PI;
    const halves = [halfOf(big.poly, at, angle, 1), halfOf(big.poly, at, angle, -1)].map((poly) => {
      const am = areaMid(poly);
      return am && poly.length >= 3 ? { poly, ...am } : null;
    }).filter(Boolean);
    if (halves.length < 2) { pieces.push(big); break; } // the cut missed: leave this piece whole
    pieces.push(...halves);
  }
  // Cut the creature's own opening out of the sheet: each piece loses whatever of it lay over the hole, which leaves the
  // inner edges straight, as ice shoved aside is. A piece that lay wholly inside it is gone — that is the ice the
  // creature took down with it.
  const open = (size / 2) * grid * PLATE_OPENING;
  const chips = [];
  if (open > 0) {
    const kept = [];
    for (const piece of pieces) {
      const away = Math.hypot(piece.mid.x - cx, piece.mid.y - cy);
      if (away < 1e-6) continue; // sat right over the opening
      const dirX = (piece.mid.x - cx) / away, dirY = (piece.mid.y - cy) / away;
      // The straight cut across the opening, square to the way this piece was pushed.
      const at = { x: cx + dirX * open, y: cy + dirY * open };
      const poly = halfOf(piece.poly, at, Math.atan2(dirY, dirX) + Math.PI / 2, -1);
      const am = poly.length >= 3 ? areaMid(poly) : null;
      if (am && am.area > grid * grid * 0.004) { kept.push({ poly, ...am }); continue; }
      // Nothing of it survived the opening: it went in with the creature. A couple of them come back up as loose chips,
      // shrunk about their own middles and floating in the water, because a break leaves chips as well as slabs.
      if (chips.length < PLATE_CHIPS_KEPT && piece.area > grid * grid * 0.01) {
        const bit = piece.poly.map((pt) => ({ x: piece.mid.x + (pt.x - piece.mid.x) * PLATE_CHIP_SIZE, y: piece.mid.y + (pt.y - piece.mid.y) * PLATE_CHIP_SIZE }));
        const bm = areaMid(bit);
        if (bm) chips.push({ poly: bit, ...bm, chip: true });
      }
    }
    if (kept.length) pieces = [...kept, ...chips];
  }
  pieces.sort((a, b) => b.area - a.area);
  return pieces.map((piece) => {
    const away = Math.atan2(piece.mid.y - cy, piece.mid.x - cx) || 0;
    // How far out this plate sits, 0 in the middle of the hole and 1 at its rim.
    const out = Math.min(1, Math.hypot(piece.mid.x - cx, piece.mid.y - cy) / Math.max(1, ((size + 1) / 2) * grid));
    // Shoved out from the middle, and the further out a piece already is the less it moved: the rim of the sheet is
    // still joined to the ice around it, and a slab there that drifted could end up outside the hole it came from.
    const drift = grid * (PLATE_DRIFT_LOW + next() * PLATE_DRIFT_SPAN) * (1 - out * 0.8);
    const turn = (next() - 0.5) * PLATE_TURN;
    const shrink = (PLATE_SHRINK_LOW + next() * PLATE_SHRINK_SPAN) * (1 - PLATE_CENTRE_OPEN * (1 - out));
    const mid = { x: piece.mid.x + Math.cos(away) * drift, y: piece.mid.y + Math.sin(away) * drift };
    // Shrunk about its own middle and swung a little where it now sits: the seam between two slabs is water, not a line.
    const points = chipped(piece.poly, grid, next).map((pt) => {
      const dx = (pt.x - piece.mid.x) * shrink, dy = (pt.y - piece.mid.y) * shrink;
      return { x: mid.x + dx * Math.cos(turn) - dy * Math.sin(turn), y: mid.y + dx * Math.sin(turn) + dy * Math.cos(turn) };
    });
    // How this one sits in the light: some slabs are tilted wet and dark, some are dry and pale. Without it a break is
    // one flat colour cut into shapes, which is a mosaic rather than ice.
    const tone = next();
    return { points, mid, turn, drift, tone, chip: piece.chip === true, sway: grid * PLATE_SWAY };
  });
}

// How a melt is drawn: more points round it than a break has and only a little wander in them, with a few slow lobes.
// A melt is its own shape, not the hole's with another seed: a break is shattered ice, long spikes alternating with
// short ones, and feeding that same shape another seed would still read as shattered. Fire eats the ice away instead,
// so the opening is round, lobed and soft-edged, and the ice left floating at its rim is slush.
const MELT_POINTS = 22, MELT_LOW = 0.97, MELT_LOBE = 0.1, MELT_LOBES = 2;

/** A square fire melted through: a rounded opening of open water about `size` squares across (1 for one square of
 *  water), centred on its square, as [{x, y}, ...]. Star-shaped and wound by rising angle, as holeOutline is, so the
 *  water engine reads it the same way. The first point is NOT repeated at the end. */
export function meltOutline(key, { grid, seed = 0, size } = {}) {
  const sq = parseKey(key);
  if (!sq || !validGrid(grid) || !(Number(size) > 0) || !Number.isFinite(size)) return [];
  const next = stream(sq, seed, 4);
  const cx = (sq.col + 0.5) * grid, cy = (sq.row + 0.5) * grid, half = (size / 2) * grid;
  const turn = next() * Math.PI * 2, step = (Math.PI * 2) / MELT_POINTS;
  const ring = [];
  for (let k = 0; k < MELT_POINTS; k++) {
    const angle = turn + (k + (next() - 0.5) * 0.4) * step; // up to 0.2 of a step either way: the angles still rise
    // A few slow lobes round it — fire eats further in at some places than others — and a little wander on top.
    const lobe = 1 + MELT_LOBE * Math.sin(angle * MELT_LOBES + turn);
    const radius = half * lobe * (MELT_LOW + (1 - MELT_LOW) * next());
    ring.push({ x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius });
  }
  return ring;
}

/** The slush round a melt: small chips of ice crowded at its edge, [{x, y, r, turn}] as shards are, so they float and
 *  turn on the meltwater through the very same painter. Well inside the outline, and never out in the middle. */
export function slushRing(key, { grid, seed = 0, size } = {}) {
  const sq = parseKey(key);
  if (!sq || !validGrid(grid) || !(Number(size) > 0) || !Number.isFinite(size)) return [];
  const next = stream(sq, seed, 5);
  const cx = (sq.col + 0.5) * grid, cy = (sq.row + 0.5) * grid, half = (size / 2) * grid;
  const count = 7 + Math.round(size * 6);
  const out = [];
  for (let k = 0; k < count; k++) {
    const angle = ((k + next() * 0.8) / count) * Math.PI * 2, dist = half * (0.52 + next() * 0.22);
    out.push({ x: cx + Math.cos(angle) * dist, y: cy + Math.sin(angle) * dist, r: grid * (0.025 + next() * 0.035), turn: (next() - 0.5) * Math.PI * 2 });
  }
  return out;
}

// ---- what a region draws ----
// A region's thin ice as the screen draws it. Pure: the region arrives as { id, flags } and the answer is plain data, so what a
// client draws is tested without Foundry; main.mjs only hands regions in and puts the answers on the map.

/** Where a floating shard is `seconds` in: it bobs about its place and turns slowly, each shard out of step with the others by
 *  its own seeded turn, so every client sees the same drift at the same time. Pure; {x, y, turn}. */
/** How a plate rides the water: a slow lift and a slow swing, far smaller than a loose chip's, because a slab of ice the
 *  size of a creature does not bob about. { dx, dy, turn } to add to where it sits. Pure, on the shared clock. */
export function plateAt(plate, seconds) {
  const t = Number(seconds) || 0, phase = (Number(plate?.turn) || 0) * 3.1 + (Number(plate?.drift) || 0) * 0.37;
  const sway = Number(plate?.sway) > 0 ? Number(plate.sway) : 0;
  return { dx: Math.sin(t * 0.37 + phase) * sway, dy: Math.cos(t * 0.29 + phase * 1.3) * sway, turn: Math.sin(t * 0.21 + phase) * PLATE_SWING };
}
export function shardAt(shard, seconds) {
  const phase = shard.turn * 2.3 + shard.r, t = Number(seconds) || 0, sway = shard.r * 0.45;
  return { x: shard.x + Math.sin(t * 0.9 + phase) * sway, y: shard.y + Math.cos(t * 0.7 + phase * 1.7) * sway, turn: shard.turn + Math.sin(t * 0.5 + phase) * 0.4 };
}

// A region's id as a number, so each region breaks in its own way but every client breaks it the same way.
const seedOfId = (id) => { let n = 7; for (const ch of String(id)) n = (Math.imul(n, 31) + ch.charCodeAt(0)) | 0; return (n >>> 0) % 100000; };

// The water engine reads an area as flat x, y pairs: [{x, y}, ...] -> [x, y, x, y, ...].
const flatten = (ring) => ring.flatMap((p) => [p.x, p.y]);

// What is a hole's own, and nothing else: it goes through to the deep, it ends at a break line, and it does not freeze
// over again with the rest of the region. How the water LOOKS is not here — a hole is a hole in a particular body of
// water, and it shows that water: the caller lays the region's own look under this (its kind, its current, the tile its
// bed is painted from), along with what only the screen has (the map's rectangle, whether a roof is over it). Given a
// look of its own it came out a flat colour that a bright map turned the shade of the ground, while the river a step
// away was plainly water (Roi: "this ice shows the map, while without it it only shows the water engine").
const holeLook = { watery: true, over: [], edge: 1, depth: { hold: 1.6, dark: 0.72 }, beach: false, sand: null, waves: null, keeps: true };
// What fire melts is the same water, shallower and softer at its edge: meltwater standing in the ice, not a hole torn
// through to the deep, and it fades into the ice it ate away rather than ending at a break line. It lies still in the
// ice it ate rather than running with the river, so this one does say how it moves.
const meltLook = { ...holeLook, edge: 2.2, kind: "still", followsWind: false, angle: null, current: 0, depth: { hold: 1.1, dark: 0.45 } };

/** A region's areas with its holes cut out of them, so whatever paints the region's floor leaves the openings alone
 *  (flat x, y pairs, each area's cuts on its own `holes`, as Foundry's region tree gives them). `inside(point, area)`
 *  says which area a ring belongs to; where none holds it, the first area takes it. The areas are returned changed, the
 *  rings are not copied. Every ring's home is read before any is cut, because a point inside a hole counts as outside
 *  the area that holds it: cutting as we went would send the second ring of a pair to the wrong part of the region. */
export function cutIceHoles(areas, holes, inside) {
  if (!Array.isArray(areas) || !areas.length || !Array.isArray(holes) || !holes.length) return areas;
  const at = typeof inside === "function" ? inside : () => false;
  const cuts = [];
  for (const hole of holes) {
    const ring = hole?.areas?.[0];
    if (!Array.isArray(ring) || ring.length < 6) continue;
    let x = 0, y = 0;
    for (let i = 0; i + 1 < ring.length; i += 2) { x += ring[i]; y += ring[i + 1]; }
    const mid = { x: x / (ring.length / 2), y: y / (ring.length / 2) };
    const home = areas.find((area) => at(mid, area)) ?? areas[0];
    if (home) cuts.push([home, ring]);
  }
  for (const [home, ring] of cuts) home.holes = [...(home.holes ?? []), ring];
  return areas;
}

/** What a region's thin ice draws: { holes: water specs (one per hole, id "<region>:ice:<square>", areas one flat polygon),
 *  cracks: [{ id, lines }] one per cracked square, shards: [{ id, list }] one per hole }. All empty unless the region has thin
 *  ice on; ids are stable and the numbers depend only on what is stored, so every client draws the same break and the water
 *  engine's cache (keyed on the areas) keeps its meshes between rounds. */
/** Every hole one region has, as the one shape both the screen and the floor go by: [{ key, melted, size, ring }]. The
 *  water engine draws this ring, and `iceHoleAt` asks this very ring whether a creature is standing in open water, so the
 *  dark water a player sees and the water underfoot can never be two different shapes. [] unless the region has thin ice
 *  on and something stored. Kept while the region's stored ice and the grid stay as they are: the drawing asks every sync
 *  and the floor asks for every creature on every frame, and the same stored state must give byte-identical rings each
 *  time or the water engine throws its mesh away and builds it again. */
export function iceHoleRings(region, { grid } = {}) {
  if (!region?.id || typeof region !== "object" || !validGrid(grid)) return [];
  const { thin, holds } = iceSettingsOf(region);
  if (!thin) return [];
  const { holes, holeSizes, melts } = iceStateOf(region);
  if (!holes.length) return [];
  const sig = `${grid}|${holds}|${holes.join(" ")}|${holes.map((k) => holeSizes?.[k] ?? "").join(" ")}|${melts.join(" ")}`;
  const had = ringCache.get(region);
  if (had && had.sig === sig) return had.list;
  const seed = seedOfId(region.id), usual = breakerSquares(holds), list = [];
  for (const key of holes) {
    // Fire melted this square: one square of open water, lobed and soft-edged, with its ice floating at the rim as slush.
    const melted = melts.includes(key);
    const stored = Number(holeSizes?.[key]), size = melted ? 1 : stored > 0 && Number.isFinite(stored) ? stored : usual; // (the creature that fell, once the ice stores it)
    const ring = melted ? meltOutline(key, { grid, seed, size }) : holeOutline(key, { grid, seed, size });
    if (ring.length) list.push({ key, melted, size, ring });
  }
  ringCache.set(region, { sig, list });
  return list;
}
const ringCache = new WeakMap();

// Whether a point is inside a ring of points, by ray casting. The rings here are star-shaped and never cross themselves.
function inRing(x, y, ring) {
  let yes = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) yes = !yes;
  }
  return yes;
}

/** Whether a point is in a hole in the thin ice, so the floor there is open water: inside the very shape one of these
 *  regions' holes is drawn as, and the region's own say over the point (`inside(doc, point)`, Foundry's testPoint, handed
 *  in to keep this free of Foundry). The hole's shape answers it and not the square it is keyed by: a hole is drawn a
 *  square wider than the creature that fell through, so the dark water beside its key square is water underfoot as well,
 *  and a footprint an even number of squares across stands with its centre in a different square from the one its weight
 *  broke. A region that throws is only itself. */
export function iceHoleAt(point, { regions = [], grid, inside = () => true } = {}) {
  const x = Number(point?.x), y = Number(point?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  for (const doc of regions ?? []) {
    try {
      for (const { ring } of iceHoleRings(doc, { grid })) {
        if (!inRing(x, y, ring)) continue;
        if (inside(doc, point)) return true;
      }
    } catch { /* a region mid-change is only itself */ }
  }
  return false;
}

export function iceBreakOf(region, { grid } = {}) {
  const none = { holes: [], cracks: [], shards: [], plates: [] };
  if (!region?.id || !validGrid(grid)) return none;
  const { thin, holds } = iceSettingsOf(region);
  if (!thin) return none;
  const { cracks, holes } = iceStateOf(region);
  const seed = seedOfId(region.id);
  const out = { holes: [], cracks: [], shards: [], plates: [] };
  for (const { key, melted, size, ring } of iceHoleRings(region, { grid })) {
    const id = `${region.id}:ice:${key}`;
    out.holes.push({ id, areas: [flatten(ring)], ...(melted ? meltLook : holeLook) });
    // A melt leaves slush round its rim; a break leaves the sheet itself in plates, floating where it came apart.
    if (melted) out.shards.push({ id, list: slushRing(key, { grid, seed, size }) });
    else out.plates.push({ id, list: icePlates(key, { grid, seed, size }) });
  }
  for (const key of cracks) {
    if (holes.includes(key)) continue; // a square that gave way is a hole, not a crack
    const lines = crackLines(key, { grid, seed });
    if (lines.length) out.cracks.push({ id: `${region.id}:ice:${key}`, lines });
  }
  return out;
}
