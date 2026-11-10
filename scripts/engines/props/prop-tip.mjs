// A prop that tips over (a brazier) instead of breaking: where it lies and where its hot coals land, seeded by its note.
// Pure. Drawn by prop-wreck.mjs (approved mock "Breaking more", scene 4: the brazier).
import { seededRandom } from "../fragments/fragments.mjs";

export const COAL_MS = 10000; // the coals glow and dim over this long after the tip
const COALS = [10, 16];
const REACH = 1.2; // squares from the tile's centre a coal may land

// note: the tile's broken note (seed, cutAngle: the hit's direction on the map). width/height: the tile's, grid: px per
// square, rotation: the tile's turn in degrees (the layout is in tile-local px, so the hit is turned back by it).
// lying: the whole picture's offset (tile-local px), slight turn, and squash: it lies on its side, so from above it
// reads narrower along the fall (sx for a fall across its art, sy for one up or down it).
// coals: [{x, y, r, hot}] tile-local px, radius px, hot: the share of COAL_MS it keeps glowing.
export function tipLayout(note, { width, height, grid = 100, rotation = 0 } = {}) {
  const rand = seededRandom(((note?.seed ?? 0) >>> 0) * 31 + 11);
  const a = (Number(note?.cutAngle) || 0) - ((Number(rotation) || 0) * Math.PI) / 180;
  const ux = Math.cos(a), uy = Math.sin(a), size = Math.max(width, height);
  const across = Math.abs(ux) >= Math.abs(uy), squash = 0.55 + rand() * 0.2, d = size * (0.3 + rand() * 0.3);
  // turned so its narrow side follows the fall, but never far off upright
  const axis = across ? (ux >= 0 ? 0 : Math.PI) : uy >= 0 ? Math.PI / 2 : -Math.PI / 2;
  const off = Math.atan2(Math.sin(a - axis), Math.cos(a - axis)), rot = Math.max(-0.3, Math.min(0.3, off + (rand() - 0.5) * 0.1));
  const lying = { dx: ux * d, dy: uy * d, rot, sx: across ? squash : 1, sy: across ? 1 : squash };

  // A Medium (one-square) brazier spills 10-16 coals within 1.2 squares. A bigger one throws them as far for its size and
  // spills more, by its size to the power 1.5 (the mock's 1.5-square brazier: about two dozen, out to about 1.5 squares).
  // They spill from its edge where it lies, onward along the hit, more of them close in.
  const scale = Math.max(1, size / grid), reach = REACH * grid * scale, front = Math.min(reach * 0.75, d + (size / 2) * squash);
  const cx = width / 2, cy = height / 2, n = Math.round((COALS[0] + Math.floor(rand() * (COALS[1] - COALS[0] + 1))) * scale ** 1.5), coals = [];
  for (let i = 0; i < n; i++) {
    const ca = a + (rand() - 0.5) * 1.5, dist = front + rand() ** 1.15 * (reach - front);
    coals.push({ x: cx + Math.cos(ca) * dist, y: cy + Math.sin(ca) * dist, r: grid * (0.03 + rand() * 0.04), hot: 0.6 + rand() * 0.4 });
  }
  return { lying, coals };
}
