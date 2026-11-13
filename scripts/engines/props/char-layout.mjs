// A wooden prop burnt out: what is left of it, the blackened pieces of its own shape, settled a little apart with
// ember seams glowing in the cracks between them. Pure and seeded from the note alone, so every client and every reload
// lays the same wreck. All points are tile-local px with {0, 0} at the tile's centre. Drawn later; here it is only laid out.
import { seededRandom } from "../fragments/fragments.mjs";

export const EMBER_MS = 60000; // how long the seams keep glowing before they die down
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const lerp = (a, b, u) => a + (b - a) * u;
const tidy = (v) => Math.round(v * 100) / 100 + 0; // no float dust, no -0

// How many pieces across and down: 4 to 9 in all, more along the longer side so each stays a plank, not a sliver.
function gridOf(rand, width, height) {
  const n = 4 + Math.floor(rand() * 6);
  let cols = clamp(Math.round(Math.sqrt((n * width) / height)), 1, 9), rows = clamp(Math.round(n / cols), 1, 9);
  while (cols * rows < 4) { if (width / cols >= height / rows) cols++; else rows++; }
  while (cols * rows > 9) { if (width / cols < height / rows) cols--; else rows--; }
  return { cols, rows };
}

// note: {seed}; width/height: the tile's. Returns {pieces: [{pts, dark}], seams: [{pts, heat}], scorch: {rx, ry},
// wisps: [{x, y, seed}]}. The rectangle is cut along ragged cracks into pieces that share their edges; each piece is then
// drawn in a touch toward its own middle and nudged, so a thin gap opens along every crack and the silhouette still reads.
// dark: 0-1 how black the piece is. heat: 0-1 how hot a seam glows. scorch: the radii of the soot mark round the wreck.
// (It takes no rotation: the tile's own turn is the drawing step's job.)
export function charLayout(note, { width, height, grid = 100 } = {}) {
  const rand = seededRandom(((note?.seed ?? 0) >>> 0) * 523 + 41);
  const w = Math.max(1, Number(width) || 0), h = Math.max(1, Number(height) || 0), gs = Number(grid) || 100;
  const { cols, rows } = gridOf(rand, w, h), cw = w / cols, ch = h / rows;

  // The corners of the cracks: inner ones wander freely, ones on the rim only slide along it, the four corners stay.
  const V = [];
  for (let r = 0; r <= rows; r++) {
    V.push([]);
    for (let c = 0; c <= cols; c++) {
      const edgeX = c === 0 || c === cols, edgeY = r === 0 || r === rows;
      const jx = edgeX ? 0 : (rand() - 0.5) * 0.6 * cw, jy = edgeY ? 0 : (rand() - 0.5) * 0.6 * ch;
      V[r].push({ x: -w / 2 + c * cw + jx, y: -h / 2 + r * ch + jy });
    }
  }
  // A crack from one corner to the next with a kink in the middle; rim edges stay straight so the outline holds.
  const crack = (a, b, onRim, size) => {
    const nx = -(b.y - a.y), ny = b.x - a.x, l = Math.hypot(nx, ny) || 1, k = onRim ? 0 : (rand() - 0.5) * 0.3 * size, t = 0.4 + rand() * 0.2;
    return [a, { x: lerp(a.x, b.x, t) + (nx / l) * k, y: lerp(a.y, b.y, t) + (ny / l) * k }, b];
  };
  const H = [], Vt = []; // H[r][c]: the crack along the top of cell (r, c); Vt[r][c]: the one down its left side
  for (let r = 0; r <= rows; r++) { H.push([]); for (let c = 0; c < cols; c++) H[r].push(crack(V[r][c], V[r][c + 1], r === 0 || r === rows, ch)); }
  for (let r = 0; r < rows; r++) { Vt.push([]); for (let c = 0; c <= cols; c++) Vt[r].push(crack(V[r][c], V[r + 1][c], c === 0 || c === cols, cw)); }

  const inside = (p) => ({ x: tidy(clamp(p.x, -w / 2, w / 2)), y: tidy(clamp(p.y, -h / 2, h / 2)) });
  const pieces = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ring = [...H[r][c], ...Vt[r][c + 1].slice(1), ...[...H[r + 1][c]].reverse().slice(1), ...[...Vt[r][c]].reverse().slice(1, -1)];
      let mx = 0, my = 0;
      for (const p of ring) { mx += p.x; my += p.y; }
      mx /= ring.length; my /= ring.length;
      const shrink = 0.9 + rand() * 0.04, nudge = 0.05 * Math.min(cw, ch), ox = (rand() - 0.5) * 2 * nudge, oy = (rand() - 0.5) * 2 * nudge;
      pieces.push({ pts: ring.map((p) => inside({ x: mx + (p.x - mx) * shrink + ox, y: my + (p.y - my) * shrink + oy })), dark: tidy(0.55 + rand() * 0.4) });
    }
  }

  // The seams: every crack inside the prop (not on its rim), glowing hotter or cooler.
  const seams = [];
  for (let r = 1; r < rows; r++) for (let c = 0; c < cols; c++) seams.push({ pts: H[r][c].map(inside), heat: tidy(0.35 + rand() * 0.65) });
  for (let r = 0; r < rows; r++) for (let c = 1; c < cols; c++) seams.push({ pts: Vt[r][c].map(inside), heat: tidy(0.35 + rand() * 0.65) });

  // The soot mark spreads past the prop by a fifth of a square all round.
  const scorch = { rx: tidy(w / 2 + 0.2 * gs), ry: tidy(h / 2 + 0.2 * gs) };

  // Smoke wisps rise from the middle of the hottest seams.
  const hottest = [...seams].sort((a, b) => b.heat - a.heat).slice(0, 1 + Math.floor(rand() * 3));
  const wisps = hottest.map((s) => { const m = s.pts[1]; return { x: m.x, y: m.y, seed: Math.floor(rand() * 100000) }; });
  return { pieces, seams, scorch, wisps };
}
