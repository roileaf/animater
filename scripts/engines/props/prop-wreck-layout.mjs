// Where a broken prop's wreckage lies: the ground mark, the spilled contents and the splinters. Pure, and seeded from
// the note alone, so every client and every reload lays the same wreck. The drawing is prop-wreck.mjs.
import { seededRandom } from "../fragments/fragments.mjs";
import { readNote } from "./prop-break.mjs";
import { splatMarks } from "../motion/floor-blood.mjs";

const TAU = Math.PI * 2;
export const LIQUIDS = { water: { color: 0x33505c, alpha: 0.7 }, wine: { color: 0x4a0c1a, alpha: 0.92 }, oil: { color: 0x4a3410, alpha: 0.85 } };
export const GRAIN_TONES = [0xc8a462, 0xb48f50, 0xd9bc7e, 0x9c7a40];

// A painted blotch: overlapping ragged lobes in stepped tones, darkest inward; only the outer step has the faint ink edge.
function blotch(cx, cy, r, steps, rand, ink = 0x1a1410, lobes = 7) {
  const centres = Array.from({ length: lobes }, (_, k) => {
    const a = (k / lobes) * TAU + rand() * 0.6, d = k ? r * (0.25 + rand() * 0.3) : 0;
    return { x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d, s: k ? 0.45 + rand() * 0.25 : 0.7 };
  });
  return {
    ink,
    steps: steps.map(([color, alpha], i) => {
      const shrink = 1 - i * 0.3;
      const polys = centres.map((c) => {
        const rr = r * c.s * shrink, pts = [];
        for (let k = 0; k < 12; k++) { const a = (k / 12) * TAU, j = rr * (0.78 + rand() * 0.4); pts.push(c.x + Math.cos(a) * j, c.y + Math.sin(a) * j); }
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

// Liquids reuse the floor-blood marks, recoloured: a spill that matches the blood already on the table.
function liquidSpill(kind, c, r, grid, cutAngle, seed, rand) {
  const at = { x: c.x + Math.cos(cutAngle) * r * 0.25, y: c.y + Math.sin(cutAngle) * r * 0.25 };
  const marks = splatMarks({ at, width: r * 3.2, grid, seed: `spill-${kind}-${seed}` })
    .map((m) => (m.art === "slash" || m.art === "blunt" ? { ...m, art: "patch" } : m)) // a spill, not a thrown spray
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

export function wreckLayout(note, { centre, width, height, grid = 100, contents = "none" }) {
  const rand = seededRandom(note.seed * 977 + 13), r = Math.max(width, height) / 2;
  const mark = groundMark(note.mark, centre, r, rand);
  const spill = Object.hasOwn(LIQUIDS, contents) ? liquidSpill(contents, centre, r, grid, note.cutAngle, note.seed, rand)
    : contents === "grain" || contents === "goods" ? pouredSpill(contents, centre, r, grid, note.cutAngle, rand) : null;
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
