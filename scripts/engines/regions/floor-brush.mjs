// The Floors tab of Map painting (pure): a brush that paints floor regions onto the map. A dab with Smart edges fills only
// the pixels inside its ring that match the colour where the stroke began, reached from its centre, so water stops at the
// bank; without them, the whole ring. A finished stroke grows the region of its floor it touches (joining any it bridges),
// or makes a new one; rubbing out takes from every floor region it crosses. Pixels are the map image's (loadMapRgba).

import { traceProposals, floorName } from './floor-detect.mjs';
import { startSize, cleanSelection, consensus, keepToColours } from './smart-select.mjs';

/**
 * The model's outline for a point (pure), taken as Floor regions' Smart selection takes a click (tuned on real maps there):
 * `sets` the three nested masks the model gave for the point and each of the clicks round it (smart-select nearbyClicks),
 * and the one they most agree on wins (consensus), so a point on a bush still finds the floor round it; or a single click's
 * `masks` and `scores` (its middle size). Kept to the piece under the point with small holes filled (cleanSelection), then,
 * given the map's `rgba`, to the clicked floor's colours (keepToColours): a bush, a rock or a rug in the outline stays out.
 */
export function modelMaskFor({ sets = null, masks = null, scores = [], rgba = null, width, height, at }) {
  const point = { x: Math.round(at.x), y: Math.round(at.y) };
  const mask = sets?.length > 1 ? consensus(sets, width, height).mask : (sets?.[0] ?? masks)?.[startSize(sets?.[0] ?? masks, scores)];
  if (!mask) return null;
  const clean = cleanSelection(mask, width, height, [{ ...point, label: 1 }]);
  return rgba ? keepToColours(clean, rgba, width, height, [point]).mask : clean;
}

/** The colour round a point (pure): the mean of the 5×5 patch about it, as [r, g, b]. */
export function colourAt(rgba, width, height, x, y) {
  let r = 0, g = 0, b = 0, n = 0;
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    const xx = Math.round(x) + dx, yy = Math.round(y) + dy;
    if (xx < 0 || yy < 0 || xx >= width || yy >= height) continue;
    const i = (yy * width + xx) * 4; r += rgba[i]; g += rgba[i + 1]; b += rgba[i + 2]; n++;
  }
  return n ? [r / n, g / n, b / n] : [0, 0, 0];
}
// Whether pixel `i` looks like `c`: a weighted colour distance (green counts most, as the eye sees it) under `tolerance`.
const alike = (rgba, i, c, tolerance) => { const dr = rgba[i * 4] - c[0], dg = rgba[i * 4 + 1] - c[1], db = rgba[i * 4 + 2] - c[2]; return dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11 < tolerance * tolerance; };

/**
 * The pixels one dab covers (pure), as indices: inside the ring of `radius` about (x, y), and allowed (`allowed(i)`, e.g.
 * not another floor's region). With `smart`, only those like `seed` (within `tolerance`) reached from the ring's centre
 * through like pixels, starting from the nearest like pixel to the centre so a fleck under it doesn't stop it.
 */
export function dabCells({ rgba, width, height, x, y, radius, seed, tolerance = 32, smart = true, allowed = () => true, within = null }) {
  const out = [], cx = Math.round(x), cy = Math.round(y), R = Math.ceil(radius), r2 = radius * radius;
  const inRing = (xx, yy) => xx >= 0 && yy >= 0 && xx < width && yy < height && (xx - cx) ** 2 + (yy - cy) ** 2 <= r2;
  // With the model's outline (Edges: Model), the ring where it overlaps the outline: the model decides, not the colours.
  if (within) {
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) { const xx = cx + dx, yy = cy + dy; if (!inRing(xx, yy)) continue; const i = yy * width + xx; if (within[i] && allowed(i)) out.push(i); }
    return out;
  }
  if (!smart) {
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) { const xx = cx + dx, yy = cy + dy; if (!inRing(xx, yy)) continue; const i = yy * width + xx; if (allowed(i)) out.push(i); }
    return out;
  }
  const ok = (i) => alike(rgba, i, seed, tolerance) && allowed(i);
  let start = -1;
  for (let s = 0; s <= R && start < 0; s++) {
    const steps = s === 0 ? 1 : Math.max(8, Math.ceil(s * 6.283));
    for (let k = 0; k < steps && start < 0; k++) { const a = (k / steps) * 6.283, xx = Math.round(cx + Math.cos(a) * s), yy = Math.round(cy + Math.sin(a) * s); if (inRing(xx, yy) && ok(yy * width + xx)) start = yy * width + xx; }
  }
  if (start < 0) return out;
  const seen = new Uint8Array(width * height), stack = [start]; seen[start] = 1;
  while (stack.length) {
    const i = stack.pop(); out.push(i); const xx = i % width, yy = (i / width) | 0;
    for (const [nx, ny] of [[xx + 1, yy], [xx - 1, yy], [xx, yy + 1], [xx, yy - 1]]) {
      if (!inRing(nx, ny)) continue; const j = ny * width + nx; if (seen[j]) continue; seen[j] = 1; if (ok(j)) stack.push(j);
    }
  }
  return out;
}

// The smallest stroke worth a region, in pixels of the map image.
const LEAST = 6;
const maskOf = (pixels, size) => { const m = new Uint8Array(size); for (const p of pixels) m[p] = 1; return m; };
const loopsOf = (mask, width, height) => traceProposals(mask, width, height).flatMap((p) => p.loops);
// Whether a region's pixels touch the stroke: on it, or beside it.
function touches(pixels, stroke, width, height) {
  for (const p of pixels) {
    if (stroke[p]) return true;
    const x = p % width;
    if ((x > 0 && stroke[p - 1]) || (x < width - 1 && stroke[p + 1]) || (p >= width && stroke[p - width]) || (p + width < width * height && stroke[p + width])) return true;
  }
  return false;
}

/**
 * What a finished stroke does to the floor regions (pure). `saved`: the level's brushable floor regions as
 * { regionId, floor, pixels } (floor-regions-ui savedAreaProposals); `stroke`: a 0/1 mask of what it covered.
 * Painting grows the first region of its floor it touches (the others it bridges are folded in and removed), else makes one.
 * Rubbing out takes the stroke from the regions of its floor it overlaps (other floors' are left alone) and removes those it
 * empties. Loops are in image pixels.
 */
export function planFloorStroke({ saved = [], floor, stroke, erase = false, width, height }) {
  const plan = { updates: [], creates: [], removes: [] };
  let painted = 0; for (let p = 0; p < stroke.length; p++) painted += stroke[p];
  if (painted < LEAST) return plan;
  if (erase) {
    for (const s of saved) {
      if (s.floor !== floor) continue;
      if (!Array.prototype.some.call(s.pixels, (p) => stroke[p])) continue;
      const left = maskOf(s.pixels, width * height); let n = 0;
      for (let p = 0; p < left.length; p++) { if (stroke[p]) left[p] = 0; n += left[p]; }
      if (n < LEAST) { plan.removes.push(s.regionId); continue; }
      const loops = loopsOf(left, width, height);
      if (loops.length) plan.updates.push({ regionId: s.regionId, loops }); else plan.removes.push(s.regionId);
    }
    return plan;
  }
  const joined = saved.filter((s) => s.floor === floor && touches(s.pixels, stroke, width, height));
  const mask = Uint8Array.from(stroke);
  for (const s of joined) for (const p of s.pixels) mask[p] = 1;
  const loops = loopsOf(mask, width, height);
  if (!loops.length) return plan;
  if (joined.length) { plan.updates.push({ regionId: joined[0].regionId, loops }); plan.removes.push(...joined.slice(1).map((s) => s.regionId)); }
  else plan.creates.push({ loops });
  return plan;
}

/** A new floor region's name (pure): its floor's, numbered on from the highest of that name already there ("Grass 3"). */
// The status line while hovering the map (pure): the floor region under the pointer (`under`, a floor key or null) and what a
// dab of `brush` would do there. Another floor's region is kept off, painting and rubbing out alike: Shift-drag rubs out only the
// brush's floor. `name` names a key (cave growth has its own names).
export function hoverLine(under, brush, name = floorName) {
  if (!under) return `Over: no floor yet · a dab adds ${name(brush)}`;
  if (under === brush) return `Over: ${name(under)} · a dab grows it, Shift-drag rubs it out`;
  return `Over: ${name(under)} · ${name(brush)} keeps off it (pick ${name(under)} to rub it out)`;
}

export function floorRegionName(floor, names = [], name = floorName) {
  const base = name(floor), re = new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} (\\d+)$`);
  const most = names.reduce((m, n) => { const hit = re.exec(String(n ?? '')); return hit ? Math.max(m, Number(hit[1])) : m; }, 0);
  return `${base} ${most + 1}`;
}
