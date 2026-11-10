// Propose water polygons from a bounded map image on an explicit GM action.
// Automatic selection calibrates saturated blue/teal water from the image. Click selection
// uses circular median hue and lower-quartile saturation near the click, with an optional wider band.
// Both grow four-connected components, preserve contrasting enclosed objects, and simplify every loop.
// These colour heuristics need GM review: similar roofs or vegetation can also match.

import { WATER_KINDS, WATER_TOWARD, flowChoices, waterFlows, waterKindFlags, caveKindFlags, caveHasMenu, stepFlags } from "../motion/region-steps.mjs";

// Every threshold the detector uses. Tuned against map corpora that are no longer in this
// repository, so the values cannot be re-measured here.
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

const FLOW = new Set(flowChoices().map(([value]) => value));
const WAVES = new Set(WATER_TOWARD.map(([value]) => value));
const WATER_COLOR = "#2c7da0";

export function fitSize(width, height, maxDimension = WATER_TUNING.maxDimension) {
  const w = Math.max(1, Math.round(Number(width) || 0));
  const h = Math.max(1, Math.round(Number(height) || 0));
  const longest = Math.max(w, h);
  if (!(maxDimension > 0) || longest <= maxDimension) return { width: w, height: h };
  const scale = maxDimension / longest;
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}

export function detectWater(rgba, width, height) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) return none("no-candidates");
  width = Math.round(width);
  height = Math.round(height);
  const count = width * height;
  if (!rgba || rgba.length < count * 4) throw new Error("detectWater: rgba is shorter than width * height * 4");

  const hue = new Float32Array(count);
  // Double, because a pixel at exactly peakSatMin rounds below it in single precision.
  const sat = new Float64Array(count);
  const val = new Uint8Array(count);
  readColour(rgba, hue, sat, val, count);

  const candidate = new Uint8Array(count);
  const core = new Uint8Array(count);
  markCandidates(hue, sat, val, rgba, candidate, width, height);
  erodeInto(candidate, core, width, height);
  const peak = colourPeak(hue, sat, core, count);
  if (!peak.ok) return none(peak.reason);

  const strong = new Uint8Array(count);
  const weak = new Uint8Array(count);
  markBand(hue, sat, val, rgba, strong, weak, peak, count);
  const spare = new Uint8Array(count);
  const seeds = new Uint8Array(count);
  openInto(strong, seeds, spare, width, height);
  const grown = new Uint8Array(count);
  grow(seeds, weak, grown, width, height);

  const mask = cleanMask(grown, width, height, null, { hue, sat });

  const proposals = traceProposals(mask, width, height);
  if (!proposals.length) return none("nothing-left");
  return {
    status: "found",
    waterColor: { hue: peak.hue, saturation: peak.saturation },
    proposals,
    mask,
    width,
    height,
  };
}

export function mergeAreaProposals(proposals, width, height, { claimed = [], preserveTarget = false, dropSmallComponents = false } = {}) {
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

export function areaProposalFromLoops(loops, width, height) {
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

// The GM's click, for water the automatic pass will not call water. The click supplies what calibration cannot: which
// colour on this map is water. `claimed` is the proposals already on the list. A new piece shares no pixel with them.
export function selectColourAt(rgba, width, height, { x, y }, { claimed = [], broad = false } = {}) {
  const count = width * height;
  if (!rgba || rgba.length < count * 4) throw new Error("selectColourAt: rgba is shorter than width * height * 4");
  const cx = Math.min(width - 1, Math.max(0, Math.floor(x)));
  const cy = Math.min(height - 1, Math.max(0, Math.floor(y)));
  const clicked = cy * width + cx;
  const taken = new Uint8Array(count);
  for (const proposal of claimed) for (const p of proposal.pixels) taken[p] = 1;
  if (taken[clicked]) return none("already-water");

  const hue = new Float32Array(count);
  const sat = new Float64Array(count);
  const val = new Uint8Array(count);
  readColour(rgba, hue, sat, val, count);
  const seed = seedColour(hue, sat, rgba, taken, cx, cy, width, height);
  if (!seed) return none("no-colour");

  const { clickHue, clickWeakHue, clickSatFactor, clickValueMin, alphaMin } = WATER_TUNING;
  const satFloor = seed.saturation * clickSatFactor;
  const strong = new Uint8Array(count);
  const weak = new Uint8Array(count);
  for (let p = 0, i = 3; p < count; p++, i += 4) {
    if (hue[p] < 0 || taken[p] || val[p] < clickValueMin || rgba[i] < alphaMin) continue;
    const d = hueDistance(hue[p], seed.hue);
    const s = sat[p];
    if (d <= clickHue && s >= satFloor) strong[p] = 1;
    if (d <= (broad ? clickWeakHue : clickHue) && s >= satFloor) weak[p] = 1;
  }
  const start = nearestAccepted(strong, cx, cy, width, height);
  if (start < 0) return none("no-colour");
  const seeds = new Uint8Array(count);
  seeds[start] = 1;
  const flooded = new Uint8Array(count);
  grow(seeds, weak, flooded, width, height);

  const mask = cleanMask(flooded, width, height, taken, { hue, sat });
  if (!keepComponentAt(mask, start, width, height)) return none("too-small");
  const [traced] = traceProposals(mask, width, height);
  let next = 1;
  for (const proposal of claimed) next = Math.max(next, Number(String(proposal.id).replace("area-", "")) + 1);
  return { status: "found", proposal: { ...traced, id: `area-${next}`, preselected: true, clicked: true }, seed };
}

export function areaPixels(loops, width, height) {
  const mask = new Uint8Array(width * height);
  for (const pixel of areaProposalFromLoops(loops, width, height).pixels) mask[pixel] = 1;
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

// A small patch read around the click, so a click on foam, a wave crest or a lamp's reflection still reads the water
// around it. When enough of the patch shares the clicked pixel's hue, only those pixels vote, or the banks outvote a 3
// pixel stream. Saturation is the patch's lower quartile: a median over the matching pixels sets the floor above the
// paler half of the same water and the fill stops short. Claimed pixels do not vote, because the fill cannot enter them.
// Hue is taken around the circular mean, so a red pool does not split across 0 and 360.
function seedColour(hue, sat, rgba, taken, cx, cy, width, height) {
  const { clickPatch, clickSatMin, clickHue, clickHueShareMin, alphaMin } = WATER_TUNING;
  const clicked = cy * width + cx;
  const usable = [];
  for (let y = Math.max(0, cy - clickPatch); y <= Math.min(height - 1, cy + clickPatch); y++) {
    for (let x = Math.max(0, cx - clickPatch); x <= Math.min(width - 1, cx + clickPatch); x++) {
      const p = y * width + x;
      if (hue[p] >= 0 && !taken[p] && rgba[p * 4 + 3] >= alphaMin) usable.push(p);
    }
  }
  if (!usable.length) return null;
  const sameHue = hue[clicked] < 0 || sat[clicked] < clickSatMin ? [] : usable.filter((p) => hueDistance(hue[p], hue[clicked]) <= clickHue);
  const voters = sameHue.length >= usable.length * clickHueShareMin ? sameHue : usable;
  const sats = voters.map((p) => sat[p]).sort((a, b) => a - b);
  const saturation = sats[sats.length >> 2];
  if (saturation < clickSatMin) return null;
  let sin = 0, cos = 0;
  for (const p of voters) { sin += Math.sin(hue[p] * Math.PI / 180); cos += Math.cos(hue[p] * Math.PI / 180); }
  const centre = Math.atan2(sin, cos) * 180 / Math.PI;
  const offset = median(voters.map((p) => ((hue[p] - centre + 540) % 360) - 180));
  return { hue: (centre + offset + 360) % 360, saturation };
}

function median(values) {
  return values.sort((a, b) => a - b)[values.length >> 1];
}

function nearestAccepted(accepted, cx, cy, width, height) {
  const { clickPatch } = WATER_TUNING;
  let best = -1, bestDist = Infinity;
  for (let y = Math.max(0, cy - clickPatch); y <= Math.min(height - 1, cy + clickPatch); y++) {
    for (let x = Math.max(0, cx - clickPatch); x <= Math.min(width - 1, cx + clickPatch); x++) {
      const dist = (x - cx) ** 2 + (y - cy) ** 2;
      if (accepted[y * width + x] && dist < bestDist) { bestDist = dist; best = y * width + x; }
    }
  }
  return best;
}

// Cleaning can thin the click away, so the piece is then its largest part. False when too little is left. Settling
// corners runs after the cleaning's own size check and can split a piece, so the size is checked once more here.
function keepComponentAt(mask, at, width, height) {
  const labels = new Int32Array(width * height);
  const comps = label(mask, labels, width, height);
  let keep = labels[at];
  if (!keep) for (let i = 1; i < comps.length; i++) if (!keep || comps[i].size > comps[keep].size) keep = i;
  if (!keep || comps[keep].size < mask.length * WATER_TUNING.componentMinShare) return false;
  for (let p = 0; p < mask.length; p++) if (labels[p] !== keep) mask[p] = 0;
  return true;
}

function readColour(rgba, hue, sat, val, count) {
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

function markCandidates(hue, sat, val, rgba, out, width, height) {
  const { hueMin, hueMax, candidateSatMin, candidateValueMin, alphaMin } = WATER_TUNING;
  const count = width * height;
  for (let p = 0, i = 3; p < count; p++, i += 4) {
    const h = hue[p];
    if (rgba[i] >= alphaMin && h >= hueMin && h <= hueMax && sat[p] > candidateSatMin && val[p] > candidateValueMin) out[p] = 1;
  }
}

// 3x3. Out of range reads the nearest pixel, so a shore on the map edge is not shaved off.
function erodeInto(src, dst, width, height) {
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

function dilateInto(src, dst, width, height) {
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

function openInto(src, dst, spare, width, height) {
  erodeInto(src, spare, width, height);
  dilateInto(spare, dst, width, height);
}

function closeInto(src, dst, spare, width, height) {
  dilateInto(src, spare, width, height);
  erodeInto(spare, dst, width, height);
}

// Only saturated pixels vote, so a large slate roof cannot outvote a small river. The answer is the mean of the
// voters in the winning 3x3 window, not a bin index, so a flat cluster reports its own colour. A winner that is only
// the top of a cluster centred below the floor gives its votes up, and the next colour gets a turn.
function colourPeak(hue, sat, core, count) {
  const { hueMin, hueSpan, hueBins, satBins, peakSatMin, peakTries, componentMinShare } = WATER_TUNING;
  const size = hueBins * satBins;
  const votes = new Float64Array(size), under = new Float64Array(size), hueSum = new Float64Array(size), satSum = new Float64Array(size);
  const hueStep = hueSpan / hueBins;
  let cores = 0, voters = 0;
  for (let p = 0; p < count; p++) {
    if (!core[p]) continue;
    cores++;
    let hb = Math.floor((hue[p] - hueMin) / hueStep);
    if (hb < 0) hb = 0;
    else if (hb >= hueBins) hb = hueBins - 1;
    let sb = Math.floor(sat[p] * satBins);
    if (sb >= satBins) sb = satBins - 1;
    const bin = hb * satBins + sb;
    if (sat[p] < peakSatMin) {
      under[bin]++;
      continue;
    }
    voters++;
    votes[bin]++;
    hueSum[bin] += hue[p];
    satSum[bin] += sat[p];
  }
  if (!cores) return { ok: false, reason: "no-candidates" };
  if (!voters) return { ok: false, reason: "no-saturated-colour" };
  for (let tries = 0; tries < peakTries; tries++) {
    let best = 0, at = 0;
    for (let i = 1; i < hueBins - 1; i++) {
      for (let j = 1; j < satBins - 1; j++) {
        let sum = 0;
        for (let a = -1; a <= 1; a++) {
          const row = (i + a) * satBins + j;
          sum += votes[row - 1] + votes[row] + votes[row + 1];
        }
        if (sum > best) { best = sum; at = i * satBins + j; }
      }
    }
    // Fewer votes than the smallest piece cannot make one: specks, or strays at the edge of a rejected cluster.
    if (best < count * componentMinShare) return { ok: false, reason: tries ? "no-saturated-colour" : "nothing-left" };
    const tailTop = tailEnd(votes, under, at);
    if (tailTop < 0) {
      let meanHue = 0, meanSat = 0;
      for (let a = -1; a <= 1; a++) {
        for (let b = -1; b <= 1; b++) {
          meanHue += hueSum[at + a * satBins + b];
          meanSat += satSum[at + a * satBins + b];
        }
      }
      return { ok: true, hue: meanHue / best, saturation: meanSat / best };
    }
    for (let a = -1; a <= 1; a++) {
      const row = (Math.floor(at / satBins) + a) * satBins;
      for (let k = Math.floor(peakSatMin * satBins); k <= tailTop; k++) votes[row + k] = hueSum[row + k] = satSum[row + k] = 0;
    }
  }
  return { ok: false, reason: "no-saturated-colour" };
}

// The top saturation bin of the winner's cluster when the winner is only that cluster's tail, otherwise -1. The cluster
// is the saturation bins at the winner's hue that touch. One empty bin does not split it: 0.05 is finer than the spread
// of one painted surface, and two tones 0.1 apart fall either side of an empty bin.
function tailEnd(votes, under, at) {
  const { satBins, peakSatMin, tailMargin, tailShare } = WATER_TUNING;
  const hueBin = Math.floor(at / satBins), floorBin = Math.floor(peakSatMin * satBins);
  const reachBin = Math.floor((peakSatMin + tailMargin) * satBins);
  const slice = new Float64Array(satBins);
  for (let a = -1; a <= 1; a++) {
    const row = (hueBin + a) * satBins;
    for (let k = 0; k < satBins; k++) slice[k] += votes[row + k] + under[row + k];
  }
  let low = Math.max(at % satBins - 1, floorBin);
  while (!slice[low]) low++;
  let high = low;
  while (slice[low - 1] || slice[low - 2]) low--;
  while (slice[high + 1] || slice[high + 2]) high++;
  let below = 0, above = 0, reach = 0;
  for (let k = low; k <= high; k++) {
    if (k < floorBin) below += slice[k];
    else above += slice[k];
    if (k >= reachBin) reach += slice[k];
  }
  return below > above && reach < above * tailShare ? high : -1;
}

function hueDistance(h, peak) {
  const d = Math.abs(h - peak);
  return d > 180 ? 360 - d : d;
}

function markBand(hue, sat, val, rgba, strong, weak, peak, count) {
  const { strongHue, strongSatFactor, weakHue, weakSatFactor, pixelValueMin, alphaMin } = WATER_TUNING;
  const satFloor = peak.saturation * strongSatFactor;
  const weakFloor = peak.saturation * weakSatFactor;
  for (let p = 0, i = 3; p < count; p++, i += 4) {
    const h = hue[p];
    if (h < 0 || val[p] < pixelValueMin || rgba[i] < alphaMin) continue;
    const d = hueDistance(h, peak.hue);
    const s = sat[p];
    if (d <= weakHue && s >= weakFloor) weak[p] = 1;
    if (d <= strongHue && s >= satFloor) strong[p] = 1;
  }
}

function grow(seeds, weak, out, width, height) {
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

function label(mask, labels, width, height) {
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

function dropSmall(mask, width, height) {
  const count = width * height;
  const labels = new Int32Array(count);
  const comps = label(mask, labels, width, height);
  const min = count * WATER_TUNING.componentMinShare;
  const keep = new Uint8Array(comps.length);
  for (let i = 1; i < comps.length; i++) if (comps[i].size >= min) keep[i] = 1;
  for (let p = 0; p < count; p++) if (mask[p] && !keep[labels[p]]) mask[p] = 0;
}

// Background that touches the image border is the outside of the map, so it stays empty. A smaller enclosed blob is foam or a lamp.
function fillHoles(mask, inv, width, height, colour) {
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
    for (let id = 1; id < comps.length; id++) if (!touch[id] && comps[id].size < max) fill[id] = 1;
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
function removeSaddles(mask, width, height, blocked) {
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
function cleanMask(raw, width, height, blocked, colour) {
  const count = width * height;
  const spare = new Uint8Array(count);
  const closed = new Uint8Array(count);
  const mask = new Uint8Array(count);
  const unblock = (pixels) => { if (blocked) for (let p = 0; p < count; p++) if (blocked[p]) pixels[p] = 0; };
  closeInto(raw, closed, spare, width, height);
  unblock(closed);
  openInto(closed, mask, spare, width, height);
  dropSmall(mask, width, height);
  fillHoles(mask, spare, width, height, colour);
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

function traceProposals(mask, width, height) {
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
  return made.map(({ label: _label, ...proposal }, index) => ({ id: `area-${index + 1}`, ...proposal }));
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

function vertexCount(loops) {
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

// Regions the generator made carry this marker; ones made before it worked for every floor carry the old one.
export const GENERATED_MARK = "floor-detect";
const GENERATED_MARKS = new Set([GENERATED_MARK, "water-detect"]);
// The floors an area can be, and the outline colour and name a new region of each gets.
export const AREA_FLOORS = Object.freeze(["water", "stone", "pebbles", "wood", "dirt", "grass", "sand", "snow", "ice", "mud", "glass", "metal", "cavern", "lava"]);
const FLOOR_LOOK = Object.freeze({
  water: ["Water", WATER_COLOR], stone: ["Stone", "#8f979e"], pebbles: ["Pebbles", "#a89f8f"], wood: ["Wood", "#a8743f"],
  dirt: ["Dirt", "#80613f"], grass: ["Grass", "#5f9f45"], sand: ["Sand", "#d9bd73"], snow: ["Snow", "#e6eef5"],
  ice: ["Ice", "#8fd4e6"], mud: ["Mud", "#5f4a32"], glass: ["Glass", "#9fd0e0"], metal: ["Metal", "#76828e"],
  cavern: ["Cave", "#6b5a73"], lava: ["Lava", "#e85a1f"],
});
export const floorName = (floor) => FLOOR_LOOK[floor]?.[0] ?? FLOOR_LOOK.water[0];
export const floorColour = (floor) => FLOOR_LOOK[floor]?.[1] ?? FLOOR_LOOK.water[1];
export const isAreaFloor = (floor) => AREA_FLOORS.includes(floor);
// The creator picks "cavern"; a cave region saves no floor of its own. These two are the only crossings between the two.
export const savedFloor = (floor) => (floor === "cavern" ? "" : floor);
export function pickerFloor(own = {}) {
  if (isAreaFloor(own?.floor)) return own.floor;
  if (!own?.floor && (caveHasMenu(stepFlags(own ?? {})) || (own?.cavern && own.cavern !== "lava"))) return "cavern";
  return "water";
}
// A Foundry flag patch applied to a plain object: `-=key` deletes that key.
export function patchFlags(flags, patch) {
  for (const [key, value] of Object.entries(patch ?? {})) {
    if (key.startsWith("-=")) delete flags[key.slice(2)];
    else flags[key] = value;
  }
  return flags;
}

// The flags a floor brings with it beyond `floor`: water its kind and flow, lava its own steps, a cave the growth that
// makes the rest of Animater read it as a cave (the region panel's Cave starts with the same).
export function floorFlags(floor, { waterKind = "still", flowTo = "", current = "", waveTo = "", seaBeach = "" } = {}) {
  if (floor === "lava") return caveKindFlags({}, "lava");
  if (floor === "cavern") return caveKindFlags({}, "fungus");
  if (floor !== "water") return {};
  const kind = WATER_KINDS.some(([value]) => value === waterKind) ? waterKind : "still";
  const flags = waterKindFlags({ flowTo: FLOW.has(flowTo) ? flowTo : "", current }, kind);
  if (kind === "sea") {
    if (seaBeach === "off") flags.seaBeach = "off";
    if (WAVES.has(waveTo)) flags.waveTo = waveTo;
  }
  if (waterFlows(kind) && current === "swift") flags.current = "swift";
  return flags;
}

export function toRegionData(proposal, { sceneRect, imageWidth, imageHeight, levelId, name, floor = "water", waterKind = "still", flowTo = "", current = "", waveTo = "", seaBeach = "", texture = "", pattern = "", edge = "", overWater = false, steps = null, panelFlags = null, roof = null } = {}) {
  if (!(sceneRect?.width > 0) || !(sceneRect?.height > 0)) throw new Error("toRegionData: sceneRect needs a width and a height");
  if (!(imageWidth > 0) || !(imageHeight > 0)) throw new Error("toRegionData: image size is missing");
  const scaleX = sceneRect.width / imageWidth;
  const scaleY = sceneRect.height / imageHeight;
  const shapes = [];
  for (const loop of proposal?.loops ?? []) {
    const points = [];
    const src = loop.points ?? [];
    for (let i = 0; i < src.length; i += 2) points.push(sceneRect.x + src[i] * scaleX, sceneRect.y + src[i + 1] * scaleY);
    if (points.length < 6 || points.length % 2 !== 0) continue;
    shapes.push({ type: "polygon", points, hole: loop.hole === true });
  }
  const area = isAreaFloor(floor) ? floor : "water";
  const animater = { floor: savedFloor(area), generated: GENERATED_MARK, ...floorFlags(area, { waterKind, flowTo, current, waveTo, seaBeach }) };
  if (texture === "on" || texture === "off") animater.texture = texture; // else the scene's floor texture setting decides
  if (pattern) animater.textureStyles = { [area]: pattern };
  // Built out over water (a deck, a jetty): what the region panel calls Dock. Never water or lava itself.
  if (overWater === true && !["water", "lava", "cavern"].includes(area)) animater.overWater = true;
  // A step picked in the generator: the flags the region's step menu saves (its list, the floor it is for, which one).
  if (steps && typeof steps === "object") Object.assign(animater, steps);
  const soft = edge === "" || edge === undefined || edge === null ? NaN : Number(edge);
  if (Number.isFinite(soft)) { if (soft <= 0) animater.stepEdgeOff = true; else animater.stepEdge = Math.min(3, soft); }
  patchFlags(animater, panelFlags);
  if (roof === true) animater.roof = true;
  return {
    name: name || floorName(area),
    color: FLOOR_LOOK[area][1],
    shapes,
    levels: levelId ? [levelId] : [],
    flags: { animater },
    ...(roof === true ? { behaviors: [{ name: "Roof", type: "suppressWeather" }] } : {}),
  };
}

// Only single-level generator regions are editable here. Other regions remain outside the save plan.
// A region drawn by hand has no generated flag. A region on several levels, on all levels, or on another level stays.
export function editableFloorRegionIds(regions, levelId) {
  const ids = [];
  const list = Array.isArray(regions) ? regions : regions?.contents;
  if (!list || !levelId) return ids;
  for (const region of list) {
    if (!GENERATED_MARKS.has(region?.flags?.animater?.generated) || region.id == null) continue;
    const levels = Array.from(region.levels ?? []);
    if (levels.length === 1 && levels[0] === levelId) ids.push(region.id);
  }
  return ids;
}
