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

  const m = F.at(L / 2, 40 * k);
  return { gap, stubs, planks, splinters, mark: { kind: note.mark === "scorch" ? "scorch" : "dust", x: m.x, y: m.y, r: 55 * k }, doorHalf: DOOR_HALF * k };
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
// for 3-5 glass teeth standing on its edges; most shards fan out past the wall, 2-6 fall back toward the hitter; a few
// of them glint once as they land (`at`, ms).
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
  const far = Array.from({ length: 52 + Math.floor(rand() * 12) }, () =>
    glassShard(rand, k, { origin: origin(3.5 * k), lateral: L * 0.8, dir: F.dir(F.lean + (rand() - 0.5) * 1.4), dist: [0.05, 1.8], size: [5, 15], tones: GLASS_TONES }));
  const near = Array.from({ length: 2 + Math.floor(rand() * 5) }, () =>
    glassShard(rand, k, { origin: origin(-3.5 * k), lateral: L * 0.7, dir: F.dir(Math.PI + (rand() - 0.5) * 1.8), dist: [0.03, 0.35], size: [3, 8], tones: GLASS_TONES.slice(0, 2) }));

  // Restrained: 3-4 far shards and one near catch the light, each once, staggered after it lands.
  const glint = (s) => ({ x: s.x, y: s.y, size: (2 + rand() * 2) * k, at: Math.round(s.dur + 60 + rand() * 400) });
  const glints = [...far.slice(0, 3 + Math.floor(rand() * 2)).map(glint), glint(near[0])];

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
