// Where a smashed door's wreckage lies: a ragged dark gap over the painted door, splintered stubs left on the hinge and
// latch ends, planks thrown flat through to the far side, and splinters (most past the wall, a few back toward the
// hitter). A shattered window: the empty pane with glass teeth left in the frame, shards fanned out on the far side, a
// few on the near side, a handful of glints. Pure, and seeded from the note alone, so every client and every reload lays
// the same wreck. The drawing is wall-wreck.mjs.
import { seededRandom } from "../fragments/fragments.mjs";
import { readWallNote } from "./wall-break.mjs";

const lerp = (a, b, u) => a + (b - a) * u;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const mix = (a, b, u) => (Math.round(lerp((a >> 16) & 255, (b >> 16) & 255, u)) << 16) | (Math.round(lerp((a >> 8) & 255, (b >> 8) & 255, u)) << 8) | Math.round(lerp(a & 255, b & 255, u));
const shade = (c, k) => (Math.min(255, Math.round(((c >> 16) & 255) * k)) << 16) | (Math.min(255, Math.round(((c >> 8) & 255) * k)) << 8) | Math.min(255, Math.round((c & 255) * k));

export const DOOR_COLOUR = 0x7b5534;
const PLANK_WOOD = 0x8a6440; // planks run from the door's own brown a little toward this
// Splinters: the door's dark and mid wood and two pale fresh-wood tones.
export const SPLINTER_TONES = [shade(DOOR_COLOUR, 0.75), DOOR_COLOUR, 0xc9a571, 0xb08a58];
// Window glass: pale blue-greys; the frame's wood for the splinters it sheds.
export const GLASS_TONES = [0xcfe3ea, 0xb8d6de, 0xe8f3f6];
const FRAME_TONES = [0x5a3e26, 0x7a5a3a];
// A metal door's iron (dark, mid, worn) and a stone door's stone (shadowed, mid, pale): its slabs, flakes and chips.
export const IRON_TONES = [0x2e2b29, 0x46413d, 0x5c5650];
export const STONE_TONES = [0x6f6a62, 0x8a847a, 0xa49e93];
const FAR_SHARDS = 60, NEAR_SHARDS = 9, FAR_GLINTS = 7, NEAR_GLINTS = 2; // mock scene 3

// The planks a door breaks into, at grid 100: length, width, turn off the throw, distance (squares), spin as it lands.
const PLANKS = [[86, 30, -0.35, 1.25, 0.6], [64, 28, 0.25, 1.65, -0.9], [50, 26, -0.05, 0.85, 1.4]];
const GAP_HALF = 11, DOOR_HALF = 9; // half the gap's and the painted door's thickness at grid 100

// The wall's own frame: along it (t, from its first end) and across it toward the far side (n), away from the hitter.
function wallFrame(note, wall) {
  const [x1, y1, x2, y2] = wall.c, len = Math.hypot(x2 - x1, y2 - y1) || 1, t = { x: (x2 - x1) / len, y: (y2 - y1) / len };
  const left = { x: -t.y, y: t.x }, hit = { x: Math.cos(note.cutAngle), y: Math.sin(note.cutAngle) };
  const side = (note.from.x - x1) * left.x + (note.from.y - y1) * left.y;
  const sign = side > 0 ? -1 : side < 0 ? 1 : hit.x * left.x + hit.y * left.y >= 0 ? 1 : -1;
  const n = { x: left.x * sign, y: left.y * sign };
  const at = (u, v) => ({ x: x1 + t.x * u + n.x * v, y: y1 + t.y * u + n.y * v });
  // Which way, as a turn off straight through (positive toward t), points `a` along t and `b` through the wall.
  const dir = (da) => ({ x: t.x * Math.sin(da) + n.x * Math.cos(da), y: t.y * Math.sin(da) + n.y * Math.cos(da) });
  // How far the hit leaned along the wall, held within the far half so the throw always goes through.
  const lean = clamp(Math.atan2(hit.x * t.x + hit.y * t.y, hit.x * n.x + hit.y * n.y), -0.6, 0.6) * 0.7;
  return { len, t, n, at, dir, lean };
}

// A ragged line from u0 to u1 at depth v, its inner points jittered across by up to amp.
function ragged(at, u0, u1, v, steps, amp, rand) {
  const out = [];
  for (let i = 0; i <= steps; i++) {
    const j = i === 0 || i === steps ? 0 : (rand() - 0.5) * 2 * amp, p = at(lerp(u0, u1, i / steps), v + j);
    out.push(p.x, p.y);
  }
  return out;
}

// One splinter lying at rest: a thin four-sided sliver, a little pointed at one end.
function splinter(origin, dir, rand, k, { dist, len, tones = SPLINTER_TONES }) {
  const d = 100 * k * lerp(dist[0], dist[1], rand() ** 1.4), l = lerp(len[0], len[1], rand()) * k, w = lerp(1.5, 3.2, rand()) * k;
  const ro = rand() * Math.PI + (rand() - 0.5) * 8, tone = tones[Math.floor(rand() * tones.length)];
  const px = origin.x + (rand() - 0.5) * 10 * k + dir.x * d, py = origin.y + (rand() - 0.5) * 10 * k + dir.y * d;
  const dx = (Math.cos(ro) * l) / 2, dy = (Math.sin(ro) * l) / 2, nx = (-Math.sin(ro) * w) / 2, ny = (Math.cos(ro) * w) / 2;
  return { tone, pts: [px - dx - nx * 0.4, py - dy - ny * 0.4, px + dx * 0.2 - nx, py + dy * 0.2 - ny, px + dx, py + dy, px + dx * 0.1 + nx, py + dy * 0.1 + ny] };
}

// grid: the scene's grid size in px; the wreck is drawn at grid 100 and scaled with it.
export function doorWreckLayout(note, wall, grid = 100) {
  const rand = seededRandom((note.seed >>> 0) * 769 + 41), k = (grid || 100) / 100, F = wallFrame(note, wall), L = F.len;
  const angle = (v) => Math.atan2(v.y, v.x);

  const top = ragged(F.at, 4 * k, L - 4 * k, GAP_HALF * k, 8, 2.5 * k, rand), bottom = ragged(F.at, L - 4 * k, 4 * k, -GAP_HALF * k, 8, 2.5 * k, rand);
  const inner = [[8, 6], [-8, 6], [-10, 3], [10, 3]].flatMap(([u, v]) => { const p = F.at(u < 0 ? L + u * k : u * k, v * k); return [p.x, p.y]; });
  const gap = { poly: [...top, ...bottom], inner };

  const stubs = [[3 * k, F.t], [L - 3 * k, { x: -F.t.x, y: -F.t.y }]].map(([u, inward]) => ({ ...F.at(u, 0), rot: angle(inward), len: (12 + rand() * 5) * k }));

  // Planks stand in the doorway, then are thrown flat through it. The longest carries the door's iron band.
  const reach = clamp(L / (110 * k), 0.6, 1.5), count = rand() < 0.5 ? 2 : 3, drop = count === 2 ? 1 + Math.floor(rand() * 2) : -1;
  const across = angle({ x: -F.n.x, y: -F.n.y });
  const planks = [];
  PLANKS.forEach(([len, wid, da, d, spin], i) => {
    const tone = mix(DOOR_COLOUR, PLANK_WOOD, rand() * 0.4), turn = spin + (rand() - 0.5) * 0.4;
    if (i === drop) return;
    const home = F.at(L * (0.18 + i * 0.29), 0), dir = F.dir(da + F.lean);
    // Lying turned by `turn` from across the doorway, in the wall's frame (so a hit from either side mirrors the throw).
    const axis = { x: -F.t.x * Math.sin(turn) - F.n.x * Math.cos(turn), y: -F.t.y * Math.sin(turn) - F.n.y * Math.cos(turn) };
    planks.push({ x: home.x + dir.x * d * 100 * k, y: home.y + dir.y * d * 100 * k, rot: angle(axis), len: len * k * reach, wid: wid * k, tone, band: i !== 2,
      home: { x: home.x, y: home.y, rot: across }, spin: turn });
  });

  const far = F.at(L / 2, 4 * k), near = F.at(L / 2, -8 * k), farCount = 30 + Math.floor(rand() * 9), nearCount = 3 + Math.floor(rand() * 6);
  const splinters = {
    far: Array.from({ length: farCount }, () => splinter(far, F.dir(F.lean + (rand() - 0.5) * 1.9), rand, k, { dist: [0.15, 1.6], len: [6, 18] })),
    near: Array.from({ length: nearCount }, () => splinter(near, F.dir(Math.PI + (rand() - 0.5) * 2.2), rand, k, { dist: [0.05, 0.4], len: [4, 10] })),
  };

  const m = F.at(L / 2, 40 * k), mark = { kind: note.mark === "scorch" ? "scorch" : "dust", x: m.x, y: m.y, r: 55 * k };
  const wood = { look: "wood", gap, stubs, planks: planks.map((p) => ({ ...p, look: "wood" })), splinters, hinges: [], sparks: [], mark, doorHalf: DOOR_HALF * k };
  // Metal and stone doors keep the gap and the mark's place, and lay the rest out from their own stream, so a wooden
  // door lays out exactly as it always has.
  if (note.material === "metal") return { ...wood, ...ironDoor(note, F, k) };
  if (note.material === "stone") return { ...wood, ...stoneDoor(note, F, k), mark: { ...mark, kind: note.mark === "scorch" ? "scorch" : "stone" } };
  return wood;
}

// The door's face knocked flat past the wall, seen from above: as long as the doorway (a little less), half as deep,
// lying beside the frame along the wall (turned by turn), its near edge a few px past it. Same in the wall's frame
// whichever side it was hit from.
function fallenFace(F, k, rand) {
  const L = F.len, len = L * 0.9, wid = clamp(L * 0.5, 30 * k, 60 * k), turn = (rand() - 0.5) * 0.5, slide = (rand() - 0.5) * L * 0.15;
  const rot = Math.atan2(F.t.y, F.t.x) + turn, out = (wid / 2) * Math.abs(Math.cos(turn)) + (len / 2) * Math.abs(Math.sin(turn)) + (6 + rand() * 12) * k;
  const at = F.at(L / 2 + slide, out), home = F.at(L / 2, 0);
  // It stands in the doorway, upright (seen edge-on: along the wall), then falls flat away from the frame.
  return { x: at.x, y: at.y, rot, len, wid, home: { x: home.x, y: home.y, rot: Math.atan2(F.t.y, F.t.x) }, spin: turn };
}

// A metal door: one dented iron slab (rivets round its edge and along a middle band, the dent where it was hit), two
// bent hinge stubs left on the hinge end, a few iron flakes and a short spray of sparks back toward the hitter.
function ironDoor(note, F, k) {
  const rand = seededRandom((note.seed >>> 0) * 389 + 113), L = F.len, face = fallenFace(F, k, rand);
  const rivets = [];
  for (const v of [-0.4, 0.4]) for (let i = 0; i < 5; i++) rivets.push({ u: -0.42 + i * 0.21, v });
  for (const u of [-0.12, 0.12]) rivets.push({ u, v: 0 });
  const dent = { u: (rand() - 0.5) * 0.4, v: (rand() - 0.5) * 0.3, r: (0.16 + rand() * 0.08) * Math.min(face.len, face.wid) };
  const slab = { ...face, look: "iron", tone: IRON_TONES[1], rivets, dent };
  // The hinges stay on one end of the doorway, one each side of the wall's line, bent through toward the far side.
  const end = rand() < 0.5 ? 3 * k : L - 3 * k, inward = end < L / 2 ? F.t : { x: -F.t.x, y: -F.t.y };
  const hinges = [-1, 1].map((side) => {
    const p = F.at(end, side * 4 * k);
    return { x: p.x, y: p.y, rot: Math.atan2(inward.y, inward.x), len: (9 + rand() * 4) * k, bend: (0.5 + rand() * 0.4) * (end < L / 2 ? 1 : -1) };
  });
  const hit = F.at(L / 2 + (rand() - 0.5) * L * 0.3, -3 * k);
  const sparks = Array.from({ length: 10 + Math.floor(rand() * 7) }, () => {
    const dir = F.dir(Math.PI + (rand() - 0.5) * 1.8), d = 100 * k * lerp(0.15, 0.6, rand() ** 1.3);
    return { x0: hit.x, y0: hit.y, x: hit.x + dir.x * d, y: hit.y + dir.y * d, at: Math.round(rand() * 80), life: Math.round(250 + rand() * 250), w: (0.8 + rand() * 0.8) * k };
  });
  const far = F.at(L / 2, 4 * k), near = F.at(L / 2, -6 * k);
  const splinters = {
    far: Array.from({ length: 5 + Math.floor(rand() * 4) }, () => splinter(far, F.dir(F.lean + (rand() - 0.5) * 1.6), rand, k, { dist: [0.1, 0.9], len: [3, 7], tones: IRON_TONES })),
    near: Array.from({ length: Math.floor(rand() * 3) }, () => splinter(near, F.dir(Math.PI + (rand() - 0.5) * 2), rand, k, { dist: [0.05, 0.3], len: [3, 5], tones: IRON_TONES })),
  };
  return { look: "iron", planks: [slab], stubs: [], hinges, sparks, splinters };
}

// A stone door: its face lies past the wall broken into 2-3 slabs along jagged cracks across it, drifted a little
// apart, each with a hairline crack or two; stone chips everywhere, stone stubs left in the frame.
function stoneDoor(note, F, k) {
  const rand = seededRandom((note.seed >>> 0) * 433 + 59), L = F.len, face = fallenFace(F, k, rand), n = rand() < 0.5 ? 2 : 3;
  const { len, wid } = face, c = Math.cos(face.rot), sn = Math.sin(face.rot);
  // The cracks across the face, at shares along it, each a jagged line from one long edge to the other.
  const cuts = Array.from({ length: n - 1 }, (_, i) => -0.5 + ((i + 1) / n) * (1 + (rand() - 0.5) * 0.25));
  const crack = (u) => Array.from({ length: 5 }, (_, j) => ({ x: u * len + (j === 0 || j === 4 ? (rand() - 0.5) * 6 * k : (rand() - 0.5) * 10 * k), y: -wid / 2 + (j / 4) * wid }));
  const lines = [{ pts: [{ x: -len / 2, y: -wid / 2 }, { x: -len / 2, y: wid / 2 }] }, ...cuts.map((u) => ({ pts: crack(u) })), { pts: [{ x: len / 2, y: -wid / 2 }, { x: len / 2, y: wid / 2 }] }];
  const planks = [];
  for (let i = 0; i < n; i++) {
    const a = lines[i].pts, b = lines[i + 1].pts, chip = (p) => ({ x: p.x + (rand() - 0.5) * 3 * k, y: p.y });
    const pts = [...a.map(chip), ...[...b].reverse().map(chip)];
    let cx = 0, cy = 0;
    for (const p of pts) { cx += p.x / pts.length; cy += p.y / pts.length; }
    const drift = { x: (i - (n - 1) / 2) * (4 + rand() * 6) * k, y: (rand() - 0.5) * 6 * k }, turn = (rand() - 0.5) * 0.18;
    const lx = cx + drift.x, ly = cy + drift.y, wx = face.x + lx * c - ly * sn, wy = face.y + lx * sn + ly * c;
    const poly = pts.flatMap((p) => [p.x - cx, p.y - cy]);
    // Hairline cracks: short bent lines inside the slab, as shares of its size about its centre.
    const cracks = Array.from({ length: 1 + Math.floor(rand() * 2) }, () => {
      const x0 = (rand() - 0.5) * 0.5, y0 = (rand() - 0.5) * 0.6, a2 = rand() * Math.PI, l2 = 0.25 + rand() * 0.3;
      return [x0, y0, x0 + Math.cos(a2) * l2 * 0.5, y0 + Math.sin(a2) * l2 * 0.5, x0 + Math.cos(a2 + 0.5) * l2, y0 + Math.sin(a2 + 0.5) * l2];
    });
    const home = F.at(L / 2 + (lx / len) * L * 0.9, 0);
    planks.push({ look: "stone", x: wx, y: wy, rot: face.rot + turn, poly, w: len, h: wid, cracks, tone: STONE_TONES[Math.floor(rand() * STONE_TONES.length)],
      home: { x: home.x, y: home.y, rot: face.home.rot }, spin: face.spin + turn });
  }
  const far = F.at(L / 2, 4 * k), near = F.at(L / 2, -8 * k);
  const chips = (origin, spread, count, dist, lenR) => Array.from({ length: count }, () => {
    const s = splinter(origin, F.dir(spread()), rand, k, { dist, len: lenR, tones: STONE_TONES });
    let cx = 0, cy = 0;
    for (let j = 0; j < 8; j += 2) { cx += s.pts[j] / 4; cy += s.pts[j + 1] / 4; }
    return { ...s, pts: s.pts.map((v, j) => (j % 2 ? cy + (v - cy) * 1.8 : cx + (v - cx) * 0.8)) }; // chunkier than a splinter
  });
  const splinters = {
    far: chips(far, () => F.lean + (rand() - 0.5) * 1.9, 18 + Math.floor(rand() * 8), [0.1, 1.3], [4, 9]),
    near: chips(near, () => Math.PI + (rand() - 0.5) * 2.2, 2 + Math.floor(rand() * 4), [0.05, 0.35], [3, 6]),
  };
  return { look: "stone", planks, hinges: [], sparks: [], splinters };
}

// One glass shard at rest: a thin triangle about its centre (pts, unturned), turned by rot, flown from `from` (a point
// in the pane) over `dur` ms while spinning `spin` into rot.
function glassShard(rand, k, { origin, lateral, dir, dist, size, tones }) {
  const a = rand() * Math.PI * 2, along = (rand() - 0.5) * lateral, across = (rand() - 0.5) * 4 * k;
  const from = { x: origin.x + origin.t.x * along + origin.n.x * across, y: origin.y + origin.t.y * along + origin.n.y * across };
  const d = 100 * k * lerp(dist[0], dist[1], rand() ** 1.15), z = lerp(size[0], size[1], rand() ** 1.5) * k;
  const pts = [0, -z * (0.6 + rand() * 0.6), z * (0.25 + rand() * 0.35), z * (0.2 + rand() * 0.5), -z * (0.2 + rand() * 0.4), z * (0.1 + rand() * 0.5)];
  const spin = (rand() - 0.5) * 10, tone = tones[Math.floor(rand() * tones.length)], dur = 500 * (0.6 + rand() * 0.7);
  return { x: from.x + dir.x * d, y: from.y + dir.y * d, rot: a + spin, size: z, pts, tone, from, spin, dur };
}

// A shattered window, at grid 100 scaled with it. The pane (the middle of the segment, 6 px across) is left empty but
// for 3-5 glass teeth standing on its edges; 60 shards fan out past the wall, 9 fall back toward the hitter (mock scene
// 3's counts); 7 far and 2 near glint once as they land (`at`, ms).
export function windowWreckLayout(note, wall, grid = 100) {
  const rand = seededRandom((note.seed >>> 0) * 811 + 67), k = (grid || 100) / 100, F = wallFrame(note, wall), L = F.len;
  const u0 = Math.min(6 * k, L * 0.2), u1 = L - u0, half = 3 * k, flat = (...ps) => ps.flatMap((p) => [p.x, p.y]);
  const gap = { poly: flat(F.at(u0, -half), F.at(u1, -half), F.at(u1, half), F.at(u0, half)) };
  const mid = F.at(L / 2, 0), mullion = { x: mid.x, y: mid.y, rot: Math.atan2(F.t.y, F.t.x), along: 5 * k, across: 14 * k };

  const teeth = Array.from({ length: 3 + Math.floor(rand() * 3) }, () => {
    const w = Math.min(lerp(5, 12, rand()) * k, u1 - u0), u = lerp(u0, u1 - w, rand()), edge = rand() < 0.7 ? -1 : 1;
    return { pts: flat(F.at(u, edge * half), F.at(u + w, edge * half), F.at(u + w * lerp(0.25, 0.65, rand()), -edge * half * 0.85)) };
  });

  const origin = (v) => ({ ...F.at(L / 2, v), t: F.t, n: F.n });
  const far = Array.from({ length: FAR_SHARDS }, () =>
    glassShard(rand, k, { origin: origin(3.5 * k), lateral: L * 0.8, dir: F.dir(F.lean + (rand() - 0.5) * 1.4), dist: [0.05, 1.8], size: [5, 15], tones: GLASS_TONES }));
  const near = Array.from({ length: NEAR_SHARDS }, () =>
    glassShard(rand, k, { origin: origin(-3.5 * k), lateral: L * 0.7, dir: F.dir(Math.PI + (rand() - 0.5) * 1.8), dist: [0.03, 0.35], size: [3, 8], tones: GLASS_TONES.slice(0, 2) }));

  // As the mock: 7 far shards and 2 near catch the light, each once, staggered after it lands.
  const glint = (s) => ({ x: s.x, y: s.y, size: (2 + rand() * 2) * k, at: Math.round(s.dur + 60 + rand() * 400) });
  const glints = [...far.slice(0, FAR_GLINTS).map(glint), ...near.slice(0, NEAR_GLINTS).map(glint)];

  const slivers = Array.from({ length: 4 + Math.floor(rand() * 3) }, () =>
    splinter(F.at(L / 2, 0), F.dir(F.lean + (rand() - 0.5) * 1.2), rand, k, { dist: [0.1, 0.6], len: [5, 10], tones: FRAME_TONES }));

  const m = F.at(L / 2, 30 * k);
  return { gap, teeth, mullion, shards: { far, near }, glints, slivers, mark: note.mark === "scorch" ? { kind: "scorch", x: m.x, y: m.y, r: 40 * k } : null };
}

// The walls to draw a wreck for: those carrying a valid broken note.
export function wallWreckTargets(walls) {
  const out = [];
  for (const w of walls ?? []) {
    const d = w?.document ?? w, note = readWallNote(d?.flags?.animater?.breakWall?.broken);
    if (note) out.push({ id: d.id, note });
  }
  return out;
}

// The floor a wall's wreck lies on: the base of its first named level in scene order, else the initial (or first)
// level's; 0 when the scene has no levels.
export function wallLevelBase(wallLevels, levels, initialId) {
  const named = new Set(wallLevels ?? []), list = [...(levels ?? [])];
  const level = list.find((l) => named.has(l.id)) ?? list.find((l) => l.id === initialId) ?? list[0];
  const base = Number(level?.elevation?.base);
  return Number.isFinite(base) ? base : 0;
}
