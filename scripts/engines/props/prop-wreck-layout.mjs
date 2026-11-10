// Where a broken prop's wreckage lies: the ground mark, the spilled contents and the splinters. Pure, and seeded from
// the note alone, so every client and every reload lays the same wreck. The drawing is prop-wreck.mjs.
import { seededRandom } from "../fragments/fragments.mjs";
import { readNote } from "./prop-break.mjs";
import { BURST_DEFAULT } from "./prop-traits.mjs";
import { BURN_MS } from "./prop-lights.mjs";
import { splatMarks } from "../motion/floor-blood.mjs";

const TAU = Math.PI * 2, lerp = (a, b, u) => a + (b - a) * u;
export const LIQUIDS = { water: { color: 0x33505c, alpha: 0.7 }, wine: { color: 0x4a0c1a, alpha: 0.92 }, oil: { color: 0x4a3410, alpha: 0.85 } };
LIQUIDS.lampoil = LIQUIDS.oil; // lamp oil spills like oil (and may catch: burningPatch)
export const GRAIN_TONES = [0xc8a462, 0xb48f50, 0xd9bc7e, 0x9c7a40];
export const POWDER_TONES = [0x1e1c1a, 0x2a2724, 0x3a3631, 0x141312]; // spilled black powder
export const PAGE_COLOURS = [0xeee3c8, 0xe2d4b0, 0xd8c69e];
export const POTION_COLOURS = [0x3a8a3a, 0x9a1a1a, 0x2a4ab0, 0xb08a3a];
export const SPINE_COLOURS = [0x2c4f7a, 0x7a2a2a, 0x2e5a3a, 0x6a4a8a, 0x8a6a2a, 0x3a3a4a]; // a shelf's books

// A painted blotch: overlapping ragged lobes in stepped tones, darkest inward; only the outer step has the faint ink edge.
// squash flattens it across, then it turns by angle (both about its centre).
function blotch(cx, cy, r, steps, rand, ink = 0x1a1410, lobes = 7, squash = 1, angle = 0) {
  const ca = Math.cos(angle), sa = Math.sin(angle), at = (x, y) => [cx + x * ca - y * squash * sa, cy + x * sa + y * squash * ca];
  const centres = Array.from({ length: lobes }, (_, k) => {
    const a = (k / lobes) * TAU + rand() * 0.6, d = k ? r * (0.25 + rand() * 0.3) : 0;
    return { x: Math.cos(a) * d, y: Math.sin(a) * d, s: k ? 0.45 + rand() * 0.25 : 0.7 };
  });
  return {
    ink,
    steps: steps.map(([color, alpha], i) => {
      const shrink = 1 - i * 0.3;
      const polys = centres.map((c) => {
        const rr = r * c.s * shrink, pts = [];
        for (let k = 0; k < 12; k++) { const a = (k / 12) * TAU, j = rr * (0.78 + rand() * 0.4); pts.push(...at(c.x + Math.cos(a) * j, c.y + Math.sin(a) * j)); }
        return pts;
      });
      return { color, alpha: (alpha / Math.sqrt(lobes)) * 1.6, edge: i === 0, polys };
    }),
  };
}

// What a web, vine or bush leaves when it burns away (mock scene 7): grey ash, readable on the floor, never a black pit.
export const ASH = [[0x6d6660, 0.32], [0x8a837b, 0.3], [0x4a4440, 0.28]];
function groundMark(kind, c, r, rand) {
  const one = (k, steps, ink) => ({ kind, blobs: [blotch(c.x, c.y, r * k, steps, rand, ink)], ticks: [] });
  if (kind === "scorch") return one(1.25, [[0x2a1d16, 0.5], [0x1a110c, 0.55], [0x0c0806, 0.5]]);
  if (kind === "ash") return one(0.85, ASH);
  if (kind === "burn") return one(1.15, [[0x23222a, 0.5], [0x121218, 0.5], [0x08080b, 0.45]]);
  if (kind === "stain") return one(1.2, [[0x4a5a2a, 0.3], [0x3a4a20, 0.3], [0x2a3818, 0.28]], 0x1a2010);
  if (kind === "frost") {
    const m = one(1.25, [[0xa9c7d8, 0.28], [0xc4dcea, 0.3], [0xe2eff6, 0.28]], 0x5f8296);
    for (let k = 0; k < 14; k++) { const a = rand() * TAU, d = r * (0.5 + rand() * 0.7), s = 4 + rand() * 5; m.ticks.push({ x: c.x + Math.cos(a) * d, y: c.y + Math.sin(a) * d, s }); }
    return m;
  }
  return one(1.15, [[0x8d7c62, 0.3], [0x9d8b6e, 0.28]], 0x4a3f30); // dust
}

// A flattened dust or scorch mark, in world px: squash flattens it across, then it turns by angle. A broken door's
// mark (wall-wreck.mjs) and a collapse's dust; drawn like any ground mark.
// A toppled statue's stone dust (mock scene 6) is paler and greyer; lobes: how many blots make it up.
const FLAT_MARKS = { dust: [[[0x8d7c62, 0.3], [0x9d8b6e, 0.28]], 0x4a3f30], scorch: [[[0x2a1d16, 0.5], [0x1a110c, 0.55], [0x0c0806, 0.5]], 0x1a1410],
  stone: [[[0x9a948a, 0.3], [0xb3ada3, 0.28]], 0x1a1410], ash: [ASH, 0x1a1410] };
export function flatMark(kind, { x, y, r, squash = 1, angle = 0, lobes = 7 }, rand) {
  const [steps, ink] = FLAT_MARKS[kind] ?? FLAT_MARKS.dust;
  return { kind: Object.hasOwn(FLAT_MARKS, kind) ? kind : "dust", blobs: [blotch(x, y, r, steps, rand, ink, lobes, squash, angle)], ticks: [] };
}

// The dust a collapse settles in, in world px: {x, y, r, squash, angle} from collapseLayout, turned with the tile.
export function collapseDust({ x, y, r, squash = 1, angle = 0 }, seed) {
  return flatMark("dust", { x, y, r, squash, angle }, seededRandom((seed >>> 0) * 31 + 5));
}

// How far either side of the hit a liquid runs (radians): the far side of the ground mark stays bare.
export const SPILL_FAN = 0.9;
// A mark's place around `at` folded into the fan about the cut, same distance, turned with it.
function intoFan(m, at, cutAngle) {
  if (m.art === "pool") return m;
  const dx = m.x - at.x, dy = m.y - at.y, d = Math.hypot(dx, dy);
  if (!d) return m;
  const off = Math.atan2(dy, dx) - cutAngle, turn = Math.atan2(Math.sin(off), Math.cos(off)), a = cutAngle + (turn * SPILL_FAN) / Math.PI;
  return { ...m, x: at.x + Math.cos(a) * d, y: at.y + Math.sin(a) * d, rot: (m.rot ?? 0) + a - (cutAngle + turn) };
}

// Liquids reuse the floor-blood marks, recoloured: a spill that matches the blood already on the table.
// A lamp's oil is a small pool run out ahead of it (mock scene 4: three quarters of a square, half a square on).
const SPILL_SIZE = { lampoil: { push: 0.9, width: 1.5 } }, BARREL = { push: 0.25, width: 3.2 };
function liquidSpill(kind, c, r, grid, cutAngle, seed, rand) {
  const { push, width } = SPILL_SIZE[kind] ?? BARREL;
  const at = { x: c.x + Math.cos(cutAngle) * r * push, y: c.y + Math.sin(cutAngle) * r * push };
  const marks = splatMarks({ at, width: r * width, grid, seed: `spill-${kind}-${seed}` })
    .map((m) => (m.art === "slash" || m.art === "blunt" ? { ...m, art: "patch" } : m)) // a spill, not a thrown spray
    .map((m) => intoFan(m, at, cutAngle)) // it runs out the way the hit pushed it
    .filter((m) => m.art !== "drop" || rand() < 0.5)
    // Pools spread last and longest; patches and drops come with the burst.
    .map((m) => ({ ...m, delay: m.art === "pool" ? 0.15 : m.art === "drop" ? 0 : 0.05 }));
  return { kind, ...LIQUIDS[kind], marks };
}

// Grain, goods and black powder pour out in a fan along the hit: heaped near the break in a few clumps, thinning as
// they trail off.
function pouredSpill(kind, c, r, grid, cutAngle, rand) {
  const goods = kind === "goods", count = goods ? 60 : Math.round(700 * Math.sqrt(r / grid));
  const clumps = Array.from({ length: 4 }, () => ({ a: cutAngle + (rand() - 0.5) * 1.6, d: r * (0.3 + rand() * 0.6), s: r * (0.25 + rand() * 0.25) }));
  const marks = [];
  for (let k = 0; k < count; k++) {
    let x, y;
    if (rand() < 0.65) {
      const cl = clumps[Math.floor(rand() * clumps.length)], a = rand() * TAU, d = cl.s * Math.sqrt(rand());
      x = c.x + Math.cos(cl.a) * cl.d + Math.cos(a) * d; y = c.y + Math.sin(cl.a) * cl.d + Math.sin(a) * d;
    } else {
      const a = cutAngle + (rand() - 0.5) * 2.2, d = r * (0.15 + rand() ** 1.8 * 1.5);
      x = c.x + Math.cos(a) * d; y = c.y + Math.sin(a) * d;
    }
    const rot = rand() * Math.PI;
    // Goods are bigger bits (4-9 px) in the tile's own tones (dark, mid, light); grain kernels are small, a few pale husks among them.
    if (goods) { const l = (4 + rand() * 5) / 2; marks.push({ x, y, rot, l, w: l * (0.5 + rand() * 0.5), tone: Math.floor(rand() * 3), husk: false }); }
    // Powder is finer and dark, a few grey glints among it (its husks).
    else if (kind === "powder") marks.push({ x, y, rot, l: 1.1 + rand() * 1.2, w: 0.7 + rand() * 0.6, tone: Math.floor(rand() * POWDER_TONES.length), husk: rand() < 0.06 });
    else marks.push({ x, y, rot, l: 1.6 + rand() * 1.6, w: 0.9 + rand() * 0.7, tone: Math.floor(rand() * GRAIN_TONES.length), husk: rand() < 0.08 });
  }
  return { kind, marks };
}

// Splinters of the prop's own colour: tone 0 dark, 1 mid; the drawing colours them from the tile.
function specks(c, r, rand) {
  return Array.from({ length: 18 }, () => {
    const a = rand() * TAU, d = r * (0.35 + rand() * 0.95), len = 5 + rand() * 13, w = 1.6 + rand() * 1.6, rot = rand() * Math.PI;
    const x = c.x + Math.cos(a) * d, y = c.y + Math.sin(a) * d, dx = (Math.cos(rot) * len) / 2, dy = (Math.sin(rot) * len) / 2, nx = (-Math.sin(rot) * w) / 2, ny = (Math.cos(rot) * w) / 2;
    return { x, y, tone: rand() < 0.5 ? 0 : 1, pts: [x - dx - nx, y - dy - ny, x + dx - nx, y + dy - ny, x + dx + nx, y + dy + ny, x - dx + nx, y - dy + ny] };
  });
}

// Where an item spilled off a prop starts: on the prop's line across the hit, through its centre, so books skid off a
// shelf and shards fly from where the bottles stood. A point a share `spread` of the prop's extent along that line.
// The extent is the turned tile's width across the hit (rotation in degrees).
export const spillExtent = (width, height, cutAngle, rotation = 0) => {
  const a = cutAngle - ((Number(rotation) || 0) * Math.PI) / 180;
  return Math.abs(width * Math.sin(a)) + Math.abs(height * Math.cos(a));
};
const across = (c, cutAngle, extent, spread) => ({ x: c.x - Math.sin(cutAngle) * extent * spread, y: c.y + Math.cos(cutAngle) * extent * spread });

// Books slide off along the hit: closed books skid furthest, small ones seen from the side scatter, loose pages
// flutter over them. A book's tone indexes SPINE_COLOURS (the small ones run through it in turn); pages take PAGE_COLOURS.
function booksSpill(c, width, height, extent, grid, cutAngle, rand) {
  const k = grid / 100, push = (p, a, d) => ({ x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d });
  const closed = [-0.3, 0.4, -0.05, 0.9].map((da, i) => {
    const from = across(c, cutAngle, extent, -0.35 + i * 0.225), a = cutAngle + da * 0.6, d = grid * (0.5 + rand() * 0.6);
    const w = grid * (0.28 + rand() * 0.08), h = w * (1.2 + rand() * 0.15);
    return { ...push(from, a, d), rot: (rand() - 0.5) * 3, w, h, tone: Math.floor(rand() * SPINE_COLOURS.length) };
  });
  const small = Array.from({ length: 9 }, (_, i) => {
    const from = across(c, cutAngle, extent, (rand() - 0.5) * 0.85), a = cutAngle + (rand() - 0.5) * 1.6, d = grid * (0.25 + rand() * 0.7);
    return { ...push(from, a, d), rot: (rand() - 0.5) * 4, w: (18 + rand() * 8) * k, h: (13 + rand() * 5) * k, tone: i % SPINE_COLOURS.length };
  });
  const base = push(c, cutAngle, Math.max(width, height) * 0.15);
  const pages = Array.from({ length: 22 }, () => {
    const a = cutAngle + (rand() - 0.5) * 1.9, d = grid * lerp(0.2, 1.3, rand() ** 1.3), w = (9 + rand() * 7) * k, h = (11 + rand() * 6) * k;
    const rot = rand() * TAU, c2 = PAGE_COLOURS[Math.floor(rand() * 3)], curl = rand() < 0.5;
    const from = across(base, cutAngle, extent, (rand() - 0.5) * 0.25), o = (rand() - 0.5) * 30 * k;
    return { ...push(push(from, a, d), cutAngle, o), rot, w, h, curl, c: c2 };
  });
  return { kind: "books", closed, small, pages };
}

// Bottles smash where they stood: shards of coloured glass and a stain each, run out along the hit; 3-4 colours.
function potionsSpill(c, extent, grid, cutAngle, rand) {
  const k = grid / 100, pool = POTION_COLOURS.slice();
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const colours = pool.slice(0, rand() < 0.5 ? 3 : 4), shards = [], stains = [];
  for (let b = 0; b < 5; b++) {
    const colour = colours[b % colours.length], at = across(c, cutAngle, extent, -0.36 + b * 0.18 + (rand() - 0.5) * 0.06);
    const a = cutAngle + (rand() - 0.5) * 1.2, d = grid * (0.25 + rand() * 0.5), r = grid * (0.23 + rand() * 0.11);
    const lx = at.x + Math.cos(a) * d, ly = at.y + Math.sin(a) * d;
    stains.push({ x: lx, y: ly, r, colour });
    stains.push({ x: lx + Math.cos(a) * r * 0.9, y: ly + Math.sin(a) * r * 0.9, r: r * 0.55, colour });
    for (let s = 0; s < 9; s++) {
      const sa = a + (rand() - 0.5) * 1.6, sd = grid * lerp(0.1, 0.65, rand() ** 1.15);
      shards.push({ x: at.x + Math.cos(sa) * sd, y: at.y + Math.sin(sa) * sd, rot: rand() * TAU, size: lerp(3, 7, rand() ** 1.5) * k, colour });
    }
  }
  return { kind: "potions", shards, stains };
}

// Burning lamp oil: a bed of the torch's flame tongues over the spill (light-flames.mjs draws a brazier's the same way),
// each catching a little after the break; embers rise from it for the minute it burns (BURN_MS, its last 10 s dying
// down). Its own seeded stream, so the rest of the wreck lays out as it would without fire. Times in ms from the break.
export const BURN_DIE_MS = 10000;
// The patch's tongues (pure): r the patch's radius (px), stretched along the spill (cutAngle). One tallest in the middle,
// the rest spread over the patch (a sunflower spiral, jittered from the seed), lower toward its edge and catching later;
// more of them for a bigger patch (5-9). scale: times the flame's height unit. Listed back to front (up the screen first).
const GOLDEN = Math.PI * (3 - Math.sqrt(5));
export function patchTongues({ at, r, cutAngle = 0, seed = 0, grid = 100 }) {
  const rand = seededRandom((seed >>> 0) * 977 + 31), n = Math.max(5, Math.min(9, Math.round(4 + (4 * r) / grid)));
  const ca = Math.cos(cutAngle), sa = Math.sin(cutAngle), out = [];
  for (let i = 0; i < n; i++) {
    const d = i ? Math.min(1, Math.sqrt((i - 0.5 + rand() * 0.5) / n)) : 0, a = i * GOLDEN + rand() * 0.5;
    const u = Math.cos(a) * d * 0.72 * r, v = Math.sin(a) * d * 0.42 * r;
    const scale = i ? (1.75 + (0.85 - 1.75) * d) * (0.92 + rand() * 0.16) : 1.8;
    out.push({ x: at.x + u * ca - v * sa, y: at.y + u * sa + v * ca, scale, start: Math.round(120 + d * 320 + rand() * 80) });
  }
  return out.sort((p, q) => p.y - q.y);
}
function burningPatch(spill, r, grid, cutAngle, seed) {
  const rand = seededRandom((seed >>> 0) * 131 + 71), body = spill.marks.filter((m) => m.art !== "drop");
  const list = body.length ? body : spill.marks;
  if (!list.length) return null;
  const at = { x: list.reduce((a, m) => a + m.x, 0) / list.length, y: list.reduce((a, m) => a + m.y, 0) / list.length };
  const k = r / 50, size = grid / 100, ca = Math.cos(cutAngle), sa = Math.sin(cutAngle);
  const along = (u, v) => ({ x: at.x + u * ca - v * sa, y: at.y + u * sa + v * ca });
  const flames = patchTongues({ at, r: r * 0.9, cutAngle, seed, grid });
  // Embers drift up the screen (as the mock's do), about eight a second until the fire dies down.
  const embers = Array.from({ length: 400 }, () => {
    const p = along((rand() - 0.5) * 80 * k, (rand() - 0.5) * 40 * k), life = 700 + rand() * 600;
    return { x: p.x, y: p.y, vx: (rand() - 0.5) * 30 * size, vy: (-40 - rand() * 60) * size, s: (1 + rand() * 1.2) * size, ph: rand() * 9, at: 300 + rand() * (BURN_MS - BURN_DIE_MS - 300 - life), life };
  });
  return { at, flames, embers, r: r * 0.9 };
}

// A powder keg going off (mock scene 5), from its own seeded stream. staves: the keg's lid cut into wedges, each split
// in two along its length, thrown outward (tile-local px, as collapse boards: {poly, home, to: {x, y, rot}, dur ms,
// hop}). hoops: bent iron arcs thrown out from the keg (world px; s and l the arc's start angle and length, radians).
// slivers: charred splinters (tone 0-1 charred, 2 the tile's dark); grains: spent powder chips (tone 0-1); both fly
// from {x0, y0} to {x, y}. puffs: the fireball (kind "fire", first) darkening into smoke that rolls away (kind
// "smoke"); embers; all in prop-fx's form, times in ms from the blast. flash and glow: radii in px.
// It grows with the burst: 1.0 at the default 2 squares, 0.8 at 1, 1.4 at 4.
// The scorch: a ragged blotch scaled about the keg so its outer step reaches BLAST_SCORCH of the burst both across and
// down (just over the 0.6 asked; any bigger and a row of kegs reads as one black stain, unlike the mock).
export const BLAST_SCORCH = 0.62;
const SCORCH_STEPS = [[0x2a1d16, 0.5], [0x1a110c, 0.55], [0x0c0806, 0.5]];
function blastScorch(c, burst, grid, seed) {
  const b = blotch(c.x, c.y, burst * grid, SCORCH_STEPS, seededRandom((seed >>> 0) * 53 + 31), 0x1a1410, 9);
  let rx = 0, ry = 0;
  for (const pts of b.steps[0].polys) for (let i = 0; i < pts.length; i += 2) { rx = Math.max(rx, Math.abs(pts[i] - c.x)); ry = Math.max(ry, Math.abs(pts[i + 1] - c.y)); }
  const k = (BLAST_SCORCH * burst * grid) / Math.max(1e-6, Math.min(rx, ry));
  for (const s of b.steps) s.polys = s.polys.map((pts) => pts.map((v, i) => (i % 2 ? c.y + (v - c.y) * k : c.x + (v - c.x) * k)));
  return { kind: "scorch", blobs: [b], ticks: [] };
}
function blastLayout(note, c, width, height, grid, burst) {
  const rand = seededRandom((note.seed >>> 0) * 389 + 17), k = grid / 100, big = 0.6 + 0.2 * burst, f = k * big, side = Math.min(width, height);
  const seed0 = (note.seed >>> 0) % 100000, local = { x: width / 2, y: height / 2 }, R = side * 0.46, wedges = 5 + Math.floor(rand() * 3);
  const staves = [];
  for (let s = 0; s < wedges; s++) {
    const a0 = (s / wedges) * TAU + rand() * 0.2, a1 = ((s + 1) / wedges) * TAU + rand() * 0.2, split = 0.45 + rand() * 0.2, am = (a0 + a1) / 2;
    const at = (a, rr) => [local.x + Math.cos(a) * R * rr, local.y + Math.sin(a) * R * rr];
    for (const [r0, r1] of [[0, split], [split, 1]]) {
      const poly = r0 === 0 ? [...at(a0, 0), ...at(a0, r1), ...at(am, r1 * 1.02), ...at(a1, r1)] : [...at(a0, r0), ...at(a0, r1), ...at(am, r1 * 1.02), ...at(a1, r1), ...at(a1, r0)];
      let hx = 0, hy = 0;
      for (let i = 0; i < poly.length; i += 2) { hx += poly[i]; hy += poly[i + 1]; }
      hx /= poly.length / 2; hy /= poly.length / 2;
      const a = Math.atan2(hy - local.y, hx - local.x) + (rand() - 0.5) * 0.5, d = grid * (0.6 + rand() ** 1.2 * 1.2) * (r0 ? 1.15 : 0.8) * big;
      staves.push({ poly, home: { x: hx, y: hy }, to: { x: hx + Math.cos(a) * d, y: hy + Math.sin(a) * d, rot: (rand() - 0.5) * 7 }, dur: 650 + rand() * 250, hop: 0.6 });
    }
  }
  const hoops = Array.from({ length: 2 + Math.floor(rand() * 3) }, () => {
    const a = rand() * TAU, d = grid * (0.5 + rand() * 0.9) * big;
    return { x0: c.x, y0: c.y, x: c.x + Math.cos(a) * d, y: c.y + Math.sin(a) * d, r: side * (0.2 + rand() * 0.15), s: rand() * TAU, l: 1 + rand() * 1.4 };
  });
  const fling = (n, dist, len, wid, tones) => Array.from({ length: n }, () => {
    const a = rand() * TAU, d = grid * lerp(dist[0], dist[1], rand() ** 1.4) * big, ox = (rand() - 0.5) * 10 * k, oy = (rand() - 0.5) * 10 * k;
    const rot0 = rand() * Math.PI, spin = (rand() - 0.5) * 8;
    return { x0: c.x + ox, y0: c.y + oy, x: c.x + ox + Math.cos(a) * d, y: c.y + oy + Math.sin(a) * d, rot0, rot: rot0 + spin,
      l: lerp(len[0], len[1], rand()) * k, w: lerp(wid[0], wid[1], rand()) * k, tone: Math.floor(rand() * tones), sh: 0.7 + rand() * 0.6 };
  });
  const slivers = fling(20, [0.3, 1.7], [5, 14], [1.4, 3], 3), grains = fling(22, [0.1, 1.1], [1.5, 3], [1.2, 2], 2);
  const fire = Array.from({ length: 7 }, (_, j) => {
    const a = (j / 7) * TAU + rand();
    return { kind: "fire", x: c.x, y: c.y, vx: Math.cos(a) * 55 * f, vy: Math.sin(a) * 55 * f, r0: 18 * f, r1: (52 + rand() * 18) * f, a: 0.95, at: 0, life: 650 + rand() * 200, seed: seed0 * 20 + j };
  });
  const smoke = Array.from({ length: 9 }, (_, j) => {
    const a = rand() * TAU;
    return { kind: "smoke", x: c.x + Math.cos(a) * 20 * f, y: c.y + Math.sin(a) * 20 * f, vx: (Math.cos(a) * 80 + 25) * f, vy: (Math.sin(a) * 60 - 70) * f,
      r0: 28 * f, r1: (75 + rand() * 25) * f, a: 0.5, at: 250 + rand() * 200, life: 1700 + rand() * 600, seed: seed0 * 20 + 10 + j };
  });
  const embers = Array.from({ length: 26 }, () => {
    const a = rand() * TAU, v = (60 + rand() * 110) * f;
    return { x: c.x, y: c.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30 * f, s: (1 + rand() * 1.4) * k, ph: rand() * 9, at: rand() * 120, life: 500 + rand() * 700 };
  });
  return { staves, hoops, slivers, grains, puffs: [...fire, ...smoke], embers, flash: 1.1 * burst * grid, glow: 1.2 * burst * grid };
}

// Everything thrown or spilled stops short of the walls (stop: prop-walls wallStop from the prop's centre, the same walls
// on every client, so every screen lays it out the same); a speck moves whole.
function stopped(spill, stop) {
  if (!spill) return spill;
  const each = (list) => list.map((m) => stop(m));
  if (spill.kind === "books") return { ...spill, closed: each(spill.closed), small: each(spill.small), pages: each(spill.pages) };
  if (spill.kind === "potions") return { ...spill, shards: each(spill.shards), stains: each(spill.stains) };
  return { ...spill, marks: each(spill.marks) };
}
const stoppedSpeck = (s, stop) => {
  const p = stop(s);
  if (p === s || (p.x === s.x && p.y === s.y)) return s;
  const dx = p.x - s.x, dy = p.y - s.y;
  return { ...s, x: p.x, y: p.y, pts: s.pts.map((v, i) => v + (i % 2 ? dy : dx)) };
};

// rotation: the tile's turn in degrees (where spilled books and bottles start across the hit). stop: where a thrown
// point comes to rest (walls), the identity when there are none.
export function wreckLayout(note, { centre, width, height, grid = 100, contents = "none", rotation = 0, stop = null }) {
  const rand = seededRandom(note.seed * 977 + 13), r = Math.max(width, height) / 2, extent = spillExtent(width, height, note.cutAngle, rotation);
  const mark = groundMark(note.mark, centre, r, rand); // drawn first even for a fire, so the rest lays out the same
  const spill = Object.hasOwn(LIQUIDS, contents) ? liquidSpill(contents, centre, r, grid, note.cutAngle, note.seed, rand)
    : contents === "grain" || contents === "goods" || contents === "powder" ? pouredSpill(contents, centre, r, grid, note.cutAngle, rand)
    : contents === "books" ? booksSpill(centre, width, height, extent, grid, note.cutAngle, rand)
    : contents === "potions" ? potionsSpill(centre, extent, grid, note.cutAngle, rand) : null;
  const spilled = stop ? stopped(spill, stop) : spill, flecks = specks(centre, r, rand);
  const out = { mark, specks: stop ? flecks.map((k) => stoppedSpeck(k, stop)) : flecks, spill: spilled, fire: null, blast: null };
  // An exploded keg spills nothing (its powder went up): a big scorch, and the blast's debris for its splinters. Laid
  // out after the rest from their own streams, so everything above runs the same.
  if (contents === "powder" && note.powder === "exploded") {
    const burst = note.burst ?? BURST_DEFAULT;
    out.spill = null; out.specks = [];
    out.mark = blastScorch(centre, burst, grid, note.seed);
    out.blast = blastLayout(note, centre, width, height, grid, burst);
    if (stop) for (const k of ["hoops", "slivers", "grains"]) out.blast[k] = out.blast[k].map((b) => stop(b));
    return out;
  }
  // A fire note scorches: under the burning patch when the oil spilled (mock: a flattened scorch about a prop's size), else at the prop.
  if (note.fire) {
    out.fire = spilled?.color !== undefined ? burningPatch(spilled, r, grid, note.cutAngle, note.seed) : null;
    if (out.fire && stop) out.fire.flames = out.fire.flames.map((f) => stop(f)); // the patch's edge tongues too
    const burnRand = seededRandom((note.seed >>> 0) * 53 + 29);
    out.mark = out.fire ? flatMark("scorch", { x: out.fire.at.x, y: out.fire.at.y, r, squash: 0.8, angle: note.cutAngle }, burnRand) : groundMark("scorch", centre, r, burnRand);
  }
  return out;
}

// The tiles to draw a wreck for: hidden and carrying a valid note.
export function wreckTargets(tiles) {
  const out = [];
  for (const t of tiles ?? []) {
    const d = t?.document ?? t, note = d?.hidden ? readNote(d.flags?.animater?.prop?.broken) : null;
    if (note) out.push({ id: d.id, note });
  }
  return out;
}

// Where burning lamp oil burns (the patch's middle, after the walls stopped its spill): the GM's fire light goes there,
// so its glow sits on the flames. The tile's centre when the note lays out no patch. opts: as wreckLayout's.
export function firePatchAt(note, opts) {
  return wreckLayout({ ...note, fire: true }, opts).fire?.at ?? { x: opts.centre.x, y: opts.centre.y };
}

/**
 * A picture's own colours from its pixels (pure): the mean of its opaque ones (every 4th pixel), darker and lighter, and the
 * painted part's bounds past the soft drop shadow, as shares of the picture (where a collapse's boards lie). Null when none is opaque.
 */
export function tonesOfPixels(data, width, height) {
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < data.length; i += 16) if (data[i + 3] > 200) { r += data[i]; g += data[i + 1]; b += data[i + 2]; n++; }
  if (!n) return null;
  let x0 = width, y0 = height, x1 = 0, y1 = 0;
  for (let i = 3, p = 0; i < data.length; i += 4, p++) if (data[i] > 150) { const x = p % width, y = (p / width) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x + 1); y0 = Math.min(y0, y); y1 = Math.max(y1, y + 1); }
  const m = [r / n, g / n, b / n], hex = (k) => (Math.min(255, m[0] * k) << 16) | (Math.min(255, m[1] * k) << 8) | Math.min(255, m[2] * k);
  return { mid: hex(1), dark: hex(0.55), light: hex(1.25), box: [x0 / width, y0 / height, x1 / width, y1 / height] };
}
