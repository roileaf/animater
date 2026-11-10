// Where a broken prop's wreckage lies: the ground mark, the spilled contents and the splinters. Pure, and seeded from
// the note alone, so every client and every reload lays the same wreck. The drawing is prop-wreck.mjs.
import { seededRandom } from "../fragments/fragments.mjs";
import { readNote } from "./prop-break.mjs";
import { splatMarks } from "../motion/floor-blood.mjs";

const TAU = Math.PI * 2, lerp = (a, b, u) => a + (b - a) * u;
export const LIQUIDS = { water: { color: 0x33505c, alpha: 0.7 }, wine: { color: 0x4a0c1a, alpha: 0.92 }, oil: { color: 0x4a3410, alpha: 0.85 } };
export const GRAIN_TONES = [0xc8a462, 0xb48f50, 0xd9bc7e, 0x9c7a40];
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

function groundMark(kind, c, r, rand) {
  const one = (k, steps, ink) => ({ kind, blobs: [blotch(c.x, c.y, r * k, steps, rand, ink)], ticks: [] });
  if (kind === "scorch") return one(1.25, [[0x2a1d16, 0.5], [0x1a110c, 0.55], [0x0c0806, 0.5]]);
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
const FLAT_MARKS = { dust: [[[0x8d7c62, 0.3], [0x9d8b6e, 0.28]], 0x4a3f30], scorch: [[[0x2a1d16, 0.5], [0x1a110c, 0.55], [0x0c0806, 0.5]], 0x1a1410] };
export function flatMark(kind, { x, y, r, squash = 1, angle = 0 }, rand) {
  const [steps, ink] = FLAT_MARKS[kind] ?? FLAT_MARKS.dust;
  return { kind: Object.hasOwn(FLAT_MARKS, kind) ? kind : "dust", blobs: [blotch(x, y, r, steps, rand, ink, 7, squash, angle)], ticks: [] };
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
function liquidSpill(kind, c, r, grid, cutAngle, seed, rand) {
  const at = { x: c.x + Math.cos(cutAngle) * r * 0.25, y: c.y + Math.sin(cutAngle) * r * 0.25 };
  const marks = splatMarks({ at, width: r * 3.2, grid, seed: `spill-${kind}-${seed}` })
    .map((m) => (m.art === "slash" || m.art === "blunt" ? { ...m, art: "patch" } : m)) // a spill, not a thrown spray
    .map((m) => intoFan(m, at, cutAngle)) // it runs out the way the hit pushed it
    .filter((m) => m.art !== "drop" || rand() < 0.5)
    // Pools spread last and longest; patches and drops come with the burst.
    .map((m) => ({ ...m, delay: m.art === "pool" ? 0.15 : m.art === "drop" ? 0 : 0.05 }));
  return { kind, ...LIQUIDS[kind], marks };
}

// Grain and goods pour out in a fan along the hit: heaped near the break in a few clumps, thinning as they trail off.
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

// rotation: the tile's turn in degrees (where spilled books and bottles start across the hit).
export function wreckLayout(note, { centre, width, height, grid = 100, contents = "none", rotation = 0 }) {
  const rand = seededRandom(note.seed * 977 + 13), r = Math.max(width, height) / 2, extent = spillExtent(width, height, note.cutAngle, rotation);
  const mark = groundMark(note.mark, centre, r, rand);
  const spill = Object.hasOwn(LIQUIDS, contents) ? liquidSpill(contents, centre, r, grid, note.cutAngle, note.seed, rand)
    : contents === "grain" || contents === "goods" ? pouredSpill(contents, centre, r, grid, note.cutAngle, rand)
    : contents === "books" ? booksSpill(centre, width, height, extent, grid, note.cutAngle, rand)
    : contents === "potions" ? potionsSpill(centre, extent, grid, note.cutAngle, rand) : null;
  return { mark, specks: specks(centre, r, rand), spill };
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
