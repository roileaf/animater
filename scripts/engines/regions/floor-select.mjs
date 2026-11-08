// Click selection for floor/water regions.
// Saturated coloured clicks use hue/saturation (water, lava). Grey and pale clicks use Lab distance with a small blur.

import {
  WATER_TUNING, none, readColour, hueDistance, grow, cleanMask, traceProposals, label,
} from "./floor-trace.mjs";

export const FLOOR_SELECT_TUNING = Object.freeze({
  // Below this seed saturation (or no hue), Lab matching is used instead of hue.
  hueSatMin: WATER_TUNING.clickSatMin,
  labStrong: 10,
  labWeak: 18,
  labBroadWeak: 26,
  labBlur: 1,
  labValueMin: WATER_TUNING.clickValueMin,
});

export function selectWaterAt(rgba, width, height, at, options = {}) {
  return selectFloorAt(rgba, width, height, at, options);
}

export function selectFloorAt(rgba, width, height, { x, y }, { claimed = [], broad = false } = {}) {
  const count = width * height;
  if (!rgba || rgba.length < count * 4) throw new Error("selectFloorAt: rgba is shorter than width * height * 4");
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
  const hueSeed = seedColour(hue, sat, rgba, taken, cx, cy, width, height);
  const useHue = hueSeed && hueSeed.saturation >= FLOOR_SELECT_TUNING.hueSatMin;

  let flooded;
  let start;
  let seed;
  if (useHue) {
    seed = { ...hueSeed, matcher: "hue" };
    const { clickHue, clickWeakHue, clickSatFactor, clickValueMin, alphaMin } = WATER_TUNING;
    const satFloor = hueSeed.saturation * clickSatFactor;
    const strong = new Uint8Array(count);
    const weak = new Uint8Array(count);
    for (let p = 0, i = 3; p < count; p++, i += 4) {
      if (hue[p] < 0 || taken[p] || val[p] < clickValueMin || rgba[i] < alphaMin) continue;
      const d = hueDistance(hue[p], hueSeed.hue);
      const s = sat[p];
      if (d <= clickHue && s >= satFloor) strong[p] = 1;
      if (d <= (broad ? clickWeakHue : clickHue) && s >= satFloor) weak[p] = 1;
    }
    start = nearestAccepted(strong, cx, cy, width, height);
    if (start < 0) return none("no-colour");
    const seeds = new Uint8Array(count);
    seeds[start] = 1;
    flooded = new Uint8Array(count);
    grow(seeds, weak, flooded, width, height);
  } else {
    const lab = readLab(rgba, count);
    blurLab(lab, width, height, FLOOR_SELECT_TUNING.labBlur);
    const labSeed = seedLab(lab, rgba, taken, cx, cy, width, height);
    if (!labSeed) return none("no-colour");
    seed = { ...labSeed, matcher: "lab" };
    const { labStrong, labWeak, labBroadWeak, labValueMin, alphaMin } = { ...FLOOR_SELECT_TUNING, alphaMin: WATER_TUNING.alphaMin };
    const weakLimit = broad ? labBroadWeak : labWeak;
    const strong = new Uint8Array(count);
    const weak = new Uint8Array(count);
    for (let p = 0, i = 3; p < count; p++, i += 4) {
      if (taken[p] || rgba[i] < alphaMin || val[p] < labValueMin) continue;
      const d = deltaE(lab, p, labSeed);
      if (d <= labStrong) strong[p] = 1;
      if (d <= weakLimit) weak[p] = 1;
    }
    start = nearestAccepted(strong, cx, cy, width, height);
    if (start < 0) return none("no-colour");
    const seeds = new Uint8Array(count);
    seeds[start] = 1;
    flooded = new Uint8Array(count);
    grow(seeds, weak, flooded, width, height);
  }

  const mask = cleanMask(flooded, width, height, taken, useHue ? { hue, sat } : null);
  if (!keepComponentAt(mask, start, width, height)) return none("too-small");
  const [traced] = traceProposals(mask, width, height);
  let next = 1;
  for (const proposal of claimed) next = Math.max(next, Number(String(proposal.id).replace("water-", "")) + 1);
  return { status: "found", proposal: { ...traced, id: `water-${next}`, floor: "water", preselected: true, clicked: true }, seed };
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

function readLab(rgba, count) {
  const lab = new Float32Array(count * 3);
  for (let p = 0, i = 0; p < count; p++, i += 4) {
    const [L, a, b] = rgbToLab(rgba[i] / 255, rgba[i + 1] / 255, rgba[i + 2] / 255);
    const o = p * 3;
    lab[o] = L; lab[o + 1] = a; lab[o + 2] = b;
  }
  return lab;
}

function rgbToLab(r, g, b) {
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const R = lin(r), G = lin(g), B = lin(b);
  const x = (R * 0.4124564 + G * 0.3575761 + B * 0.1804375) / 0.95047;
  const y = (R * 0.2126729 + G * 0.7151522 + B * 0.072175);
  const z = (R * 0.0193339 + G * 0.119192 + B * 0.9503041) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : (7.787037 * t + 16 / 116));
  const fx = f(x), fy = f(y), fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function blurLab(lab, width, height, radius) {
  if (!(radius > 0)) return;
  const count = width * height;
  const src = lab.slice();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let L = 0, a = 0, b = 0, n = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= height) continue;
        for (let dx = -radius; dx <= radius; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= width) continue;
          const o = (yy * width + xx) * 3;
          L += src[o]; a += src[o + 1]; b += src[o + 2]; n++;
        }
      }
      const o = (y * width + x) * 3;
      lab[o] = L / n; lab[o + 1] = a / n; lab[o + 2] = b / n;
    }
  }
}

function seedLab(lab, rgba, taken, cx, cy, width, height) {
  const { clickPatch, alphaMin } = WATER_TUNING;
  const voters = [];
  for (let y = Math.max(0, cy - clickPatch); y <= Math.min(height - 1, cy + clickPatch); y++) {
    for (let x = Math.max(0, cx - clickPatch); x <= Math.min(width - 1, cx + clickPatch); x++) {
      const p = y * width + x;
      if (!taken[p] && rgba[p * 4 + 3] >= alphaMin) voters.push(p);
    }
  }
  if (!voters.length) return null;
  let L = 0, a = 0, b = 0;
  for (const p of voters) {
    const o = p * 3;
    L += lab[o]; a += lab[o + 1]; b += lab[o + 2];
  }
  const n = voters.length;
  return { L: L / n, a: a / n, b: b / n };
}

function deltaE(lab, p, seed) {
  const o = p * 3;
  const dL = lab[o] - seed.L, da = lab[o + 1] - seed.a, db = lab[o + 2] - seed.b;
  return Math.hypot(dL, da, db);
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
