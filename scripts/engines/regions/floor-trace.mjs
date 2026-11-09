// Shared region tracing, merge, and colour primitives for floor/water detect.
// Click selection and the automatic water pass build masks; this module turns masks into polygons.

export const WATER_TUNING = Object.freeze({
  hueMin: 170,
  hueMax: 250,
  hueSpan: 80,
  hueBins: 90,
  satBins: 20,
  candidateSatMin: 0.25,
  candidateValueMin: 40,
  alphaMin: 128,
  peakSatMin: 0.65,
  // Reject a winning band that is only the saturated tail of a duller cluster.
  tailMargin: 0.1,
  tailShare: 0.3,
  peakTries: 8,
  strongHue: 8,
  strongSatFactor: 0.6,
  weakHue: 16,
  weakSatFactor: 0.65,
  pixelValueMin: 30,
  componentMinShare: 0.0006,
  holeFillMaxShare: 0.002,
  preselectShare: 0.002,
  // Shore simplification stays within two read pixels. Adjacent simplified pieces can overlap.
  simplifyPx: [2, 1.5, 1],
  simplifyFloorPx: 0.25,
  // A target, not a cap: preserving a valid loop takes priority over vertex count.
  vertexBudget: 400,
  simplifySpan: 256,
  clickPatch: 3,
  clickSatMin: 0.08,
  clickHueShareMin: 0.25,
  clickHue: 14,
  clickWeakHue: 40,
  clickSatFactor: 0.55,
  clickValueMin: 14,
  // Fill pale reflections or holes of similar hue; contrasting floating objects remain holes.
  holeFillHue: 24,
  holeFillSatMin: 0.2,
  clickWarnShare: 0.25,
  maxDimension: 1024,
});

export function fitSize(width, height, maxDimension = WATER_TUNING.maxDimension) {
  const w = Math.max(1, Math.round(Number(width) || 0));
  const h = Math.max(1, Math.round(Number(height) || 0));
  const longest = Math.max(w, h);
  if (!(maxDimension > 0) || longest <= maxDimension) return { width: w, height: h };
  const scale = maxDimension / longest;
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}

export function mergeWaterProposals(proposals, width, height, { claimed = [], preserveTarget = false, dropSmallComponents = false } = {}) {
  const mask = new Uint8Array(width * height);
  const blocked = new Uint8Array(mask.length);
  for (const proposal of proposals) for (const pixel of proposal.pixels) mask[pixel] = 1;
  for (const proposal of claimed) for (const pixel of proposal.pixels) blocked[pixel] = 1;
  if (preserveTarget) for (const pixel of proposals[0].pixels) blocked[pixel] = 0;
  for (let p = 0; p < mask.length; p++) if (blocked[p]) mask[p] = 0;
  // A union can introduce diagonal contacts. Use the detector's existing one-pixel corner repair.
  removeSaddles(mask, width, height, blocked);
  // Reopen only: shore-simplification slivers outside a saved polygon. Combine must keep
  // intentional small parts of a saved region (a pond under the size floor).
  if (dropSmallComponents) dropSmall(mask, width, height);
  const pieces = traceProposals(mask, width, height);
  const pixels = new Int32Array(pieces.reduce((sum, piece) => sum + piece.pixels.length, 0));
  let offset = 0;
  for (const piece of pieces) { pixels.set(piece.pixels, offset); offset += piece.pixels.length; }
  const loops = pieces.flatMap((piece) => piece.loops);
  return { ...proposals[0], clicked: proposals.some((proposal) => proposal.clicked === true), pixels, loops, vertices: vertexCount(loops), share: pixels.length / mask.length };
}

export function waterProposalFromLoops(loops, width, height) {
  const pixels = [];
  for (let y = 0; y < height; y++) {
    const intersections = [];
    for (const { points } of loops) {
      const n = points.length / 2;
      for (let a = 0, b = n - 1; a < n; b = a++) {
        const ax = points[a * 2], ay = points[a * 2 + 1], bx = points[b * 2], by = points[b * 2 + 1];
        if ((ay > y + 0.5) !== (by > y + 0.5)) intersections.push(ax + (y + 0.5 - ay) * (bx - ax) / (by - ay));
      }
    }
    intersections.sort((a, b) => a - b);
    for (let i = 0; i + 1 < intersections.length; i += 2) {
      const end = Math.min(width, Math.ceil(intersections[i + 1] - 0.5));
      for (let x = Math.max(0, Math.ceil(intersections[i] - 0.5)); x < end; x++) pixels.push(y * width + x);
    }
  }
  return { loops, pixels: new Int32Array(pixels), share: pixels.length / (width * height), vertices: vertexCount(loops) };
}

function none(reason) {
  return { status: "none", reason };
}
export { none };

export function waterSelectionPixels(loops, width, height) {
  const mask = new Uint8Array(width * height);
  for (const pixel of waterProposalFromLoops(loops, width, height).pixels) mask[pixel] = 1;
  for (const { points } of loops) for (let i = 0; i < points.length; i += 2) {
    const j = (i + 2) % points.length;
    const snap = v => Math.abs(v - Math.round(v)) < 1e-8 ? Math.round(v) : v;
    const ax = snap(points[i]), ay = snap(points[i + 1]), bx = snap(points[j]), by = snap(points[j + 1]);
    if (ay === by) {
      if (Number.isInteger(ay) || ay < 0 || ay >= height) continue;
      for (let x = Math.max(0, Math.floor(Math.min(ax, bx))); x < Math.min(width, Math.ceil(Math.max(ax, bx))); x++) mask[Math.floor(ay) * width + x] = 1;
      continue;
    }
    if (ax === bx && Number.isInteger(ax)) continue;
    for (let y = Math.max(0, Math.floor(Math.min(ay, by))); y < Math.min(height, Math.ceil(Math.max(ay, by))); y++) {
      const lo = Math.max(y, Math.min(ay, by)), hi = Math.min(y + 1, Math.max(ay, by));
      const x0 = ax + (lo - ay) * (bx - ax) / (by - ay), x1 = ax + (hi - ay) * (bx - ax) / (by - ay);
      for (let x = Math.max(0, Math.floor(Math.min(x0, x1))); x < Math.min(width, Math.ceil(Math.max(x0, x1))); x++) mask[y * width + x] = 1;
    }
  }
  const pixels = [];
  for (let p = 0; p < mask.length; p++) if (mask[p]) pixels.push(p);
  return Int32Array.from(pixels);
}

export function readColour(rgba, hue, sat, val, count) {
  for (let p = 0, i = 0; p < count; p++, i += 4) {
    const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
    const max = r > g ? (r > b ? r : b) : (g > b ? g : b);
    const min = r < g ? (r < b ? r : b) : (g < b ? g : b);
    const d = max - min;
    val[p] = max;
    sat[p] = max ? d / max : 0;
    if (!d) hue[p] = -1;
    else if (max === b) hue[p] = 60 * (4 + (r - g) / d);
    else if (max === g) hue[p] = 60 * (2 + (b - r) / d);
    else hue[p] = (60 * ((g - b) / d) + 360) % 360;
  }
}

// 3x3. Out of range reads the nearest pixel, so a shore on the map edge is not shaved off.
export function erodeInto(src, dst, width, height) {
  for (let y = 0; y < height; y++) {
    const y0 = y > 0 ? y - 1 : 0;
    const y2 = y + 1 < height ? y + 1 : y;
    const row0 = y0 * width, row = y * width, row2 = y2 * width;
    for (let x = 0; x < width; x++) {
      const x0 = x > 0 ? x - 1 : 0;
      const x2 = x + 1 < width ? x + 1 : x;
      dst[row + x] = src[row0 + x0] & src[row0 + x] & src[row0 + x2]
        & src[row + x0] & src[row + x] & src[row + x2]
        & src[row2 + x0] & src[row2 + x] & src[row2 + x2];
    }
  }
}

export function dilateInto(src, dst, width, height) {
  for (let y = 0; y < height; y++) {
    const y0 = y > 0 ? y - 1 : 0;
    const y2 = y + 1 < height ? y + 1 : y;
    const row0 = y0 * width, row = y * width, row2 = y2 * width;
    for (let x = 0; x < width; x++) {
      const x0 = x > 0 ? x - 1 : 0;
      const x2 = x + 1 < width ? x + 1 : x;
      dst[row + x] = src[row0 + x0] | src[row0 + x] | src[row0 + x2]
        | src[row + x0] | src[row + x] | src[row + x2]
        | src[row2 + x0] | src[row2 + x] | src[row2 + x2];
    }
  }
}

export function openInto(src, dst, spare, width, height) {
  erodeInto(src, spare, width, height);
  dilateInto(spare, dst, width, height);
}

export function closeInto(src, dst, spare, width, height) {
  dilateInto(src, spare, width, height);
  erodeInto(spare, dst, width, height);
}

export function hueDistance(h, peak) {
  const d = Math.abs(h - peak);
  return d > 180 ? 360 - d : d;
}

export function grow(seeds, weak, out, width, height) {
  const count = width * height;
  const stack = new Int32Array(count);
  let top = 0;
  for (let p = 0; p < count; p++) if (seeds[p]) { out[p] = 1; stack[top++] = p; }
  while (top) {
    const p = stack[--top];
    const x = p % width;
    if (x > 0 && weak[p - 1] && !out[p - 1]) { out[p - 1] = 1; stack[top++] = p - 1; }
    if (x + 1 < width && weak[p + 1] && !out[p + 1]) { out[p + 1] = 1; stack[top++] = p + 1; }
    if (p >= width && weak[p - width] && !out[p - width]) { out[p - width] = 1; stack[top++] = p - width; }
    if (p < count - width && weak[p + width] && !out[p + width]) { out[p + width] = 1; stack[top++] = p + width; }
  }
}

export function label(mask, labels, width, height) {
  const count = width * height;
  const stack = new Int32Array(count);
  const comps = [{ id: 0, size: 0 }];
  let next = 0;
  for (let start = 0; start < count; start++) {
    if (!mask[start] || labels[start]) continue;
    next++;
    let size = 0, top = 0;
    labels[start] = next;
    stack[top++] = start;
    while (top) {
      const p = stack[--top];
      size++;
      const x = p % width;
      if (x > 0 && mask[p - 1] && !labels[p - 1]) { labels[p - 1] = next; stack[top++] = p - 1; }
      if (x + 1 < width && mask[p + 1] && !labels[p + 1]) { labels[p + 1] = next; stack[top++] = p + 1; }
      if (p >= width && mask[p - width] && !labels[p - width]) { labels[p - width] = next; stack[top++] = p - width; }
      if (p < count - width && mask[p + width] && !labels[p + width]) { labels[p + width] = next; stack[top++] = p + width; }
    }
    comps.push({ id: next, size });
  }
  return comps;
}

export function dropSmall(mask, width, height) {
  const count = width * height;
  const labels = new Int32Array(count);
  const comps = label(mask, labels, width, height);
  const min = count * WATER_TUNING.componentMinShare;
  const keep = new Uint8Array(comps.length);
  for (let i = 1; i < comps.length; i++) if (comps[i].size >= min) keep[i] = 1;
  for (let p = 0; p < count; p++) if (mask[p] && !keep[labels[p]]) mask[p] = 0;
}

// Background that touches the image border is the outside of the map, so it stays empty. A smaller enclosed blob is foam or a lamp.
export function fillHoles(mask, inv, width, height, colour, contrast = null) {
  const count = width * height;
  for (let p = 0; p < count; p++) inv[p] = mask[p] ? 0 : 1;
  const labels = new Int32Array(count);
  const comps = label(inv, labels, width, height);
  const touch = new Uint8Array(comps.length);
  for (let x = 0; x < width; x++) { touch[labels[x]] = 1; touch[labels[(height - 1) * width + x]] = 1; }
  for (let y = 0; y < height; y++) { touch[labels[y * width]] = 1; touch[labels[y * width + width - 1]] = 1; }
  const max = count * WATER_TUNING.holeFillMaxShare;
  const fill = new Uint8Array(comps.length);
  let maskLabels = null;
  let waterComps = null;
  let waterHue = null;
  if (colour) {
    maskLabels = new Int32Array(count);
    waterComps = label(mask, maskLabels, width, height);
    waterHue = meanHueByLabel(mask, maskLabels, colour.hue, count, waterComps.length);
    const heads = new Int32Array(comps.length).fill(-1);
    const next = new Int32Array(count);
    for (let p = 0; p < count; p++) {
      const id = labels[p];
      if (!inv[p] || touch[id] || comps[id].size >= max) continue;
      next[p] = heads[id];
      heads[id] = p;
    }
    for (let id = 1; id < comps.length; id++) {
      if (heads[id] >= 0 && holeMatchesWater(heads[id], next, mask, maskLabels, waterHue, colour.hue, colour.sat, width, height, comps[id].size, WATER_TUNING.holeFillHue, WATER_TUNING.holeFillSatMin)) fill[id] = 1;
    }
  } else {
    // `contrast` marks pixels that are something else lying on the floor, or not there at all: a gap mostly made of them stays a hole.
    const apart = contrast ? new Uint32Array(comps.length) : null;
    if (apart) for (let p = 0; p < count; p++) if (inv[p] && contrast[p]) apart[labels[p]]++;
    for (let id = 1; id < comps.length; id++) if (!touch[id] && comps[id].size < max && (!apart || apart[id] < comps[id].size * 0.5)) fill[id] = 1;
  }
  for (let p = 0; p < count; p++) {
    const id = labels[p];
    if (inv[p] && fill[id]) mask[p] = 1;
  }
}

function meanHueByLabel(mask, labels, hue, count, size) {
  const sin = new Float64Array(size), cos = new Float64Array(size), n = new Uint32Array(size);
  for (let p = 0; p < count; p++) {
    if (!mask[p] || hue[p] < 0) continue;
    const id = labels[p];
    sin[id] += Math.sin(hue[p] * Math.PI / 180);
    cos[id] += Math.cos(hue[p] * Math.PI / 180);
    n[id]++;
  }
  const out = new Float64Array(size);
  for (let id = 1; id < size; id++) out[id] = n[id] ? (Math.atan2(sin[id], cos[id]) * 180 / Math.PI + 360) % 360 : -1;
  return out;
}

function holeMatchesWater(start, next, mask, maskLabels, waterHue, hue, sat, width, height, holeSize, maxHue, minSat) {
  const count = width * height;
  let hSin = 0, hCos = 0, hN = 0, satSum = 0;
  const borderWater = new Set();
  for (let p = start; p >= 0; p = next[p]) {
    if (hue[p] >= 0) {
      hSin += Math.sin(hue[p] * Math.PI / 180);
      hCos += Math.cos(hue[p] * Math.PI / 180);
      hN++;
    }
    satSum += sat[p];
    const x = p % width;
    if (x > 0 && mask[p - 1]) borderWater.add(maskLabels[p - 1]);
    if (x + 1 < width && mask[p + 1]) borderWater.add(maskLabels[p + 1]);
    if (p >= width && mask[p - width]) borderWater.add(maskLabels[p - width]);
    if (p < count - width && mask[p + width]) borderWater.add(maskLabels[p + width]);
  }
  if (!hN || !borderWater.size) return true;
  if (satSum / holeSize < minSat) return true;
  const holeH = (Math.atan2(hSin, hCos) * 180 / Math.PI + 360) % 360;
  for (const wid of borderWater) {
    if (waterHue[wid] < 0) continue;
    if (hueDistance(holeH, waterHue[wid]) <= maxHue) return true;
  }
  return false;
}

// Two pixels touching only at a corner make the traced ring visit that corner twice, and such a ring is not a
// polygon. A 2x2 block fixes itself by changing its last pixel, which no earlier block read, so one pass settles it.
// When that pixel is `blocked`, clearing the block's lower-left settles it instead, because the block left of it
// then holds no second diagonal.
export function removeSaddles(mask, width, height, blocked) {
  for (let y = 0; y + 1 < height; y++) {
    for (let x = 0; x + 1 < width; x++) {
      const p = y * width + x;
      const a = mask[p], b = mask[p + 1], c = mask[p + width], d = mask[p + width + 1];
      if (a !== d || b !== c || a === b) continue;
      if (b && blocked?.[p + width + 1]) mask[p + width] = 0;
      else mask[p + width + 1] = b;
    }
  }
}

// `blocked` pixels leave before the opening and the size check, so a speck cannot survive by leaning on them. Filling
// can reach them again.
export function cleanMask(raw, width, height, blocked, colour, contrast = null) {
  const count = width * height;
  const spare = new Uint8Array(count);
  const closed = new Uint8Array(count);
  const mask = new Uint8Array(count);
  const unblock = (pixels) => { if (blocked) for (let p = 0; p < count; p++) if (blocked[p]) pixels[p] = 0; };
  closeInto(raw, closed, spare, width, height);
  unblock(closed);
  openInto(closed, mask, spare, width, height);
  dropSmall(mask, width, height);
  fillHoles(mask, spare, width, height, colour, contrast);
  unblock(mask);
  removeSaddles(mask, width, height, blocked);
  return mask;
}

// Pixel-edge loops of a finished mask, with collinear steps already merged. `hole` is true when the loop bounds
// enclosed background.
export function contourLoops(mask, width, height) {
  const labels = new Int32Array(width * height);
  for (let p = 0; p < labels.length; p++) if (mask[p]) labels[p] = 1;
  return walkContours(mask, labels, width, height).map((loop) => ({ points: loop.points, hole: loop.hole }));
}

// Indexed by heading: east, south, west, north. Corner d is the pixel ahead on the right; corner d - 1 is ahead on the left.
const STEP_X = [1, 0, -1, 0], STEP_Y = [0, 1, 0, -1];
const CORNER_X = [0, -1, -1, 0], CORNER_Y = [0, 0, -1, -1];

// Water stays on the right of travel, so an outer shore has a positive shoelace area and a hole a negative one.
// Every top edge starts or continues exactly one loop. A loop starts at a corner, because the scan meets the leftmost
// edge of a run first, so only turns are written.
function walkContours(mask, labels, width, height) {
  const walked = new Uint8Array(width * height);
  const loops = [];
  const at = (x, y) => (x >= 0 && y >= 0 && x < width && y < height ? mask[y * width + x] : 0);
  for (let sy = 0; sy < height; sy++) {
    for (let sx = 0; sx < width; sx++) {
      const start = sy * width + sx;
      if (!mask[start] || walked[start] || at(sx, sy - 1)) continue;
      const points = [sx, sy];
      let x = sx, y = sy, heading = 0;
      do {
        if (heading === 0) walked[y * width + x] = 1;
        x += STEP_X[heading];
        y += STEP_Y[heading];
        const left = (heading + 3) & 3;
        let next = heading;
        if (!at(x + CORNER_X[heading], y + CORNER_Y[heading])) next = (heading + 1) & 3;
        else if (at(x + CORNER_X[left], y + CORNER_Y[left])) next = left;
        if (next !== heading && (x !== sx || y !== sy)) points.push(x, y);
        heading = next;
      } while (x !== sx || y !== sy || heading !== 0);
      loops.push({ points, hole: signedArea(points) < 0, label: labels[start] });
    }
  }
  return loops;
}

function signedArea(points) {
  let sum = 0;
  const n = points.length >> 1;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    sum += points[i * 2] * points[j * 2 + 1] - points[j * 2] * points[i * 2 + 1];
  }
  return sum / 2;
}

export function traceProposals(mask, width, height) {
  const count = width * height;
  const labels = new Int32Array(count);
  const comps = label(mask, labels, width, height);
  const byLabel = comps.map(() => []);
  for (const loop of walkContours(mask, labels, width, height)) byLabel[loop.label].push(loop);
  const made = [];
  for (const comp of comps) {
    if (!comp.id) continue;
    const loops = simplifyLoops(byLabel[comp.id]);
    const share = comp.size / count;
    made.push({ share, preselected: share >= WATER_TUNING.preselectShare, loops, vertices: vertexCount(loops), label: comp.id, pixels: new Int32Array(comp.size) });
  }
  const filled = new Int32Array(comps.length);
  const byId = [];
  for (const proposal of made) byId[proposal.label] = proposal;
  for (let p = 0; p < count; p++) if (labels[p]) byId[labels[p]].pixels[filled[labels[p]]++] = p;
  made.sort((a, b) => b.share - a.share || a.label - b.label);
  return made.map(({ label: _label, ...proposal }, index) => ({ id: `water-${index + 1}`, ...proposal }));
}

// Every loop that comes in goes out, outer shore first. One tolerance applies to a whole piece, so its shores
// and islands keep one accuracy. A shape already over the budget at the cap takes a single pass.
function simplifyLoops(loops) {
  let fitted = null;
  for (const px of WATER_TUNING.simplifyPx) {
    const next = loops.map((loop) => ({ points: simplifyLoop(loop.points, px), hole: loop.hole }));
    if (fitted && vertexCount(next) > WATER_TUNING.vertexBudget) break;
    fitted = next;
    if (vertexCount(fitted) > WATER_TUNING.vertexBudget) break;
  }
  return [...fitted.filter((loop) => !loop.hole), ...fitted.filter((loop) => loop.hole)];
}

export function vertexCount(loops) {
  let vertices = 0;
  for (const loop of loops) vertices += loop.points.length >> 1;
  return vertices;
}

function simplifyLoop(points, px) {
  for (let tolerance = px; tolerance >= WATER_TUNING.simplifyFloorPx; tolerance /= 2) {
    const candidate = douglasPeucker(points, tolerance);
    if (candidate.length === points.length) break;
    if (signedArea(candidate) * signedArea(points) > 0 && isSimple(candidate)) return candidate;
  }
  return points;
}

function douglasPeucker(points, tolerance) {
  const n = points.length >> 1;
  const keep = new Uint8Array(n);
  let far = 0, best = -1;
  for (let i = 1; i < n; i++) {
    const dist = (points[i * 2] - points[0]) ** 2 + (points[i * 2 + 1] - points[1]) ** 2;
    if (dist > best) { best = dist; far = i; }
  }
  // Fixed anchors bound the worst case. On a sawtooth, each split can peel off a single tooth.
  for (let i = 0; i < n; i += WATER_TUNING.simplifySpan) keep[i] = 1;
  keep[far] = 1;
  const anchors = [];
  for (let i = 0; i < n; i++) if (keep[i]) anchors.push(i);
  anchors.push(n);
  for (let a = 0; a + 1 < anchors.length; a++) markArc(points, anchors[a], anchors[a + 1], n, tolerance, keep);
  const out = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(points[i * 2], points[i * 2 + 1]);
  return out;
}

// `to` may be n, which stands for the wrap back to vertex 0. A saddle-free ring never repeats a vertex, so a chord has length.
function markArc(points, from, to, n, tolerance, keep) {
  const stack = [from, to];
  while (stack.length) {
    const end = stack.pop();
    const start = stack.pop();
    const ax = points[start * 2], ay = points[start * 2 + 1];
    const dx = points[(end % n) * 2] - ax, dy = points[(end % n) * 2 + 1] - ay;
    let max = tolerance * Math.sqrt(dx * dx + dy * dy), at = -1;
    for (let i = start + 1; i < end; i++) {
      const dist = Math.abs(dy * (points[i * 2] - ax) - dx * (points[i * 2 + 1] - ay));
      if (dist > max) { max = dist; at = i; }
    }
    if (at >= 0) {
      keep[at] = 1;
      stack.push(start, at, at, end);
    }
  }
}

function orient(ax, ay, bx, by, cx, cy) {
  return Math.sign((bx - ax) * (cy - ay) - (by - ay) * (cx - ax));
}

function onSegment(ax, ay, bx, by, px, py) {
  return px >= Math.min(ax, bx) && px <= Math.max(ax, bx) && py >= Math.min(ay, by) && py <= Math.max(ay, by);
}

// Closed segments, so a touch counts: a repeated vertex or a vertex on another edge is a pinch.
function segmentsMeet(ax, ay, bx, by, cx, cy, dx, dy) {
  const o1 = orient(ax, ay, bx, by, cx, cy), o2 = orient(ax, ay, bx, by, dx, dy);
  const o3 = orient(cx, cy, dx, dy, ax, ay), o4 = orient(cx, cy, dx, dy, bx, by);
  if (o1 !== o2 && o3 !== o4) return true;
  return (o1 === 0 && onSegment(ax, ay, bx, by, cx, cy)) || (o2 === 0 && onSegment(ax, ay, bx, by, dx, dy))
    || (o3 === 0 && onSegment(cx, cy, dx, dy, ax, ay)) || (o4 === 0 && onSegment(cx, cy, dx, dy, bx, by));
}

// A sweep along x, so only edges that overlap in x are compared. On a raster that keeps the active list near the image height.
export function isSimple(points) {
  const n = points.length >> 1;
  if (n < 3) return false;
  const minX = new Float64Array(n), maxX = new Float64Array(n), minY = new Float64Array(n), maxY = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    minX[i] = Math.min(points[i * 2], points[j * 2]);
    maxX[i] = Math.max(points[i * 2], points[j * 2]);
    minY[i] = Math.min(points[i * 2 + 1], points[j * 2 + 1]);
    maxY[i] = Math.max(points[i * 2 + 1], points[j * 2 + 1]);
  }
  const order = Int32Array.from({ length: n }, (_, i) => i).sort((a, b) => minX[a] - minX[b]);
  const active = new Int32Array(n);
  let size = 0;
  for (const i of order) {
    const i2 = (i + 1) % n;
    let kept = 0;
    for (let k = 0; k < size; k++) {
      const j = active[k];
      if (maxX[j] < minX[i]) continue;
      active[kept++] = j;
      if (maxY[j] < minY[i] || minY[j] > maxY[i]) continue;
      const j2 = (j + 1) % n;
      if (i2 === j || j2 === i) {
        if (foldsBack(points, n, i2 === j ? i : j)) return false;
      } else if (segmentsMeet(points[i * 2], points[i * 2 + 1], points[i2 * 2], points[i2 * 2 + 1], points[j * 2], points[j * 2 + 1], points[j2 * 2], points[j2 * 2 + 1])) return false;
    }
    active[kept++] = i;
    size = kept;
  }
  return true;
}

// Neighbouring edges share one vertex. They break the ring only when the second runs back along the first.
function foldsBack(points, n, first) {
  const a = first * 2, b = ((first + 1) % n) * 2, c = ((first + 2) % n) * 2;
  const ux = points[a] - points[b], uy = points[a + 1] - points[b + 1];
  const vx = points[c] - points[b], vy = points[c + 1] - points[b + 1];
  return ux * vy - uy * vx === 0 && ux * vx + uy * vy > 0;
}
