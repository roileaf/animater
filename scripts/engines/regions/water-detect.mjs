// Propose water polygons from a bounded map image on an explicit GM action.
// Automatic selection calibrates saturated blue/teal water from the image.
// These colour heuristics need GM review: similar roofs or vegetation can also match.

import {
  WATER_TUNING, none, readColour, erodeInto, openInto, grow, cleanMask, traceProposals, hueDistance,
} from "./floor-trace.mjs";

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

function markCandidates(hue, sat, val, rgba, out, width, height) {
  const { hueMin, hueMax, candidateSatMin, candidateValueMin, alphaMin } = WATER_TUNING;
  const count = width * height;
  for (let p = 0, i = 3; p < count; p++, i += 4) {
    const h = hue[p];
    if (rgba[i] >= alphaMin && h >= hueMin && h <= hueMax && sat[p] > candidateSatMin && val[p] > candidateValueMin) out[p] = 1;
  }
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
