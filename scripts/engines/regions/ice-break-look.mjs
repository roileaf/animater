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
  const x0 = sq.col * grid, y0 = sq.row * grid, margin = grid * 0.03;
  const clamp = (v, lo) => Math.min(lo + grid - margin, Math.max(lo + margin, v));
  const cx = x0 + grid / 2, cy = y0 + grid / 2;
  const count = 4 + Math.floor(next() * 3);
  const lines = [];
  for (let k = 0; k < count; k++) {
    let angle = ((k + next() * 0.6) / count) * Math.PI * 2;
    let x = cx + (next() - 0.5) * grid * 0.12, y = cy + (next() - 0.5) * grid * 0.12;
    const line = [{ x, y }];
    const steps = 3 + Math.floor(next() * 2);
    for (let s = 0; s < steps; s++) {
      angle += (next() - 0.5) * 1.1; // each step veers, so the crack zigzags
      // Short enough that the clamp below stops deciding where a crack goes: four steps of the usual length reach about
      // 0.42 of a grid from the middle, inside the 0.47 the clamp allows (only four at their very longest, all pointing
      // the same way, would reach past it, and each step veers). At the length this was, a crack reached 0.74 and was
      // pinned flat against the square's edge — which read as a straight run down the grid line, and lined up with the
      // next cracked square's along their shared border.
      const len = grid * 0.09 * (0.7 + next() * 0.6);
      x = clamp(x + Math.cos(angle) * len, x0); y = clamp(y + Math.sin(angle) * len, y0);
      line.push({ x, y });
    }
    lines.push(line);
  }
  return lines;
}

// Points round the hole, and how wide it is: about the creature's size plus one square across, its radius never under
// LOW of that, so shards placed inside LOW * half are always in the hole.
const RING_POINTS = 16, LOW = 0.78;

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

/** Loose pieces of ice floating in the hole: [{x, y, r, turn}], the centre in pixels, a radius r in pixels and a turn in
 *  radians. About three more for each square of size; every shard sits well inside the hole. */
export function shards(key, { grid, seed = 0, size } = {}) {
  const sq = parseKey(key);
  if (!sq || !validGrid(grid) || !(Number(size) > 0) || !Number.isFinite(size)) return [];
  const next = stream(sq, seed, 3);
  const cx = (sq.col + 0.5) * grid, cy = (sq.row + 0.5) * grid, reach = ((size + 1) / 2) * grid * LOW * 0.45;
  const count = 3 + Math.round(size * 3);
  const out = [];
  for (let k = 0; k < count; k++) {
    const angle = next() * Math.PI * 2, dist = Math.sqrt(next()) * reach;
    out.push({ x: cx + Math.cos(angle) * dist, y: cy + Math.sin(angle) * dist, r: grid * (0.06 + next() * 0.1), turn: (next() - 0.5) * Math.PI * 2 });
  }
  return out;
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
export function shardAt(shard, seconds) {
  const phase = shard.turn * 2.3 + shard.r, t = Number(seconds) || 0, sway = shard.r * 0.45;
  return { x: shard.x + Math.sin(t * 0.9 + phase) * sway, y: shard.y + Math.cos(t * 0.7 + phase * 1.7) * sway, turn: shard.turn + Math.sin(t * 0.5 + phase) * 0.4 };
}

// A region's id as a number, so each region breaks in its own way but every client breaks it the same way.
const seedOfId = (id) => { let n = 7; for (const ch of String(id)) n = (Math.imul(n, 31) + ch.charCodeAt(0)) | 0; return (n >>> 0) % 100000; };

// The water engine reads an area as flat x, y pairs: [{x, y}, ...] -> [x, y, x, y, ...].
const flatten = (ring) => ring.flatMap((p) => [p.x, p.y]);

// Still, deep, dark water that never freezes with the rest of the region: the same look the decorations' cave pools have. The
// caller adds what only the screen has (the bed's colour texture, the map's rectangle, whether a roof is over it).
const holeLook = { watery: true, over: [], kind: "still", followsWind: false, edge: 1, depth: { hold: 1.6, dark: 0.72 }, beach: false, sand: null, waves: null, angle: null, current: 0, keeps: true };
// What fire melts is the same water, shallower and softer at its edge: meltwater standing in the ice, not a hole torn
// through to the deep, and it fades into the ice it ate away rather than ending at a break line.
const meltLook = { ...holeLook, edge: 2.2, depth: { hold: 1.1, dark: 0.45 } };

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
  const none = { holes: [], cracks: [], shards: [] };
  if (!region?.id || !validGrid(grid)) return none;
  const { thin, holds } = iceSettingsOf(region);
  if (!thin) return none;
  const { cracks, holes } = iceStateOf(region);
  const seed = seedOfId(region.id);
  const out = { holes: [], cracks: [], shards: [] };
  for (const { key, melted, size, ring } of iceHoleRings(region, { grid })) {
    const id = `${region.id}:ice:${key}`;
    out.holes.push({ id, areas: [flatten(ring)], ...(melted ? meltLook : holeLook) });
    out.shards.push({ id, list: melted ? slushRing(key, { grid, seed, size }) : shards(key, { grid, seed, size }) });
  }
  for (const key of cracks) {
    if (holes.includes(key)) continue; // a square that gave way is a hole, not a crack
    const lines = crackLines(key, { grid, seed });
    if (lines.length) out.cracks.push({ id: `${region.id}:ice:${key}`, lines });
  }
  return out;
}
