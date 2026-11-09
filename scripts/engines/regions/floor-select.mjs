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
  // When almost every usable pixel matches the Lab seed, there is no distinct floor to follow.
  labCoverMax: 0.95,
  // Painted stones carry a near-black outline and dark cracks that no Lab match to the stone accepts. Pixels this dark
  // that touch the fill are taken in, a few steps deep, when the clicked floor is clearly brighter than they are.
  labOutlineL: 24,
  labOutlineReach: 3,
  labOutlineSeedGap: 8,
  // A pixel beside the outline that is this much darker than the floor but not dark itself is the outline's soft edge.
  labSoftGap: 15,
  // The fill only carries on across a dark band this thin (a crack, a shared outline). A wider one is another floor.
  labBridgeReach: 3,
  labOutlineRounds: 8,
  // Outline absorption also runs for a faintly tinted stone that reads by hue, up to this saturation.
  hueOutlineSatMax: 0.3,
  // The seed reads a patch this far round the click, small enough for a small stone, and a piece may be this small.
  labSeedPatch: 2,
  labComponentMinShare: 0.00015,
  // An enclosed gap this far from the floor, or transparent, is a different thing lying on it and stays a hole.
  labHoleKeep: 35,
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
  const useHue = hueSeed && hueSeed.saturation >= FLOOR_SELECT_TUNING.hueSatMin && !clickedOnDull(hue, sat, rgba, taken, cx, cy, width, height);
  const dullHue = useHue && hueSeed.saturation < FLOOR_SELECT_TUNING.hueOutlineSatMax;

  let flooded;
  let start;
  let seed;
  let contrast = null;
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
    if (dullHue) outlineAround(flooded, weak, rgba, taken, width, height, patchLightness(rgba, taken, cx, cy, width, height));
  } else {
    const lab = readLab(rgba, count);
    blurLab(lab, rgba, width, height, FLOOR_SELECT_TUNING.labBlur);
    const labSeed = seedLab(lab, rgba, taken, cx, cy, width, height);
    if (!labSeed) return none("no-colour");
    seed = { ...labSeed, matcher: "lab" };
    const { labStrong, labWeak, labBroadWeak, labValueMin, labCoverMax, labHoleKeep, labOutlineL, alphaMin } = { ...FLOOR_SELECT_TUNING, alphaMin: WATER_TUNING.alphaMin };
    const weakLimit = broad ? labBroadWeak : labWeak;
    const strong = new Uint8Array(count);
    const weak = new Uint8Array(count);
    contrast = new Uint8Array(count);
    let usable = 0, strongCount = 0;
    for (let p = 0, i = 3; p < count; p++, i += 4) {
      if (rgba[i] < alphaMin) { contrast[p] = 1; continue; }
      if (val[p] < labValueMin) continue;
      usable++;
      if (taken[p]) continue;
      const d = deltaE(lab, p, labSeed);
      if (d <= labStrong) { strong[p] = 1; strongCount++; }
      if (d <= weakLimit || (d <= weakLimit + 30 && sharpDeltaE(rgba, p, labSeed) <= weakLimit)) weak[p] = 1;
      else if (d > labHoleKeep && lab[p * 3] > labOutlineL) contrast[p] = 1;
    }
    if (!usable || strongCount / usable >= labCoverMax) return none("no-colour");
    start = nearestAccepted(strong, cx, cy, width, height);
    if (start < 0) return none("no-colour");
    const seeds = new Uint8Array(count);
    seeds[start] = 1;
    flooded = new Uint8Array(count);
    grow(seeds, weak, flooded, width, height);
    outlineAround(flooded, weak, rgba, taken, width, height, labSeed.L);
  }

  const minShare = useHue && !dullHue ? WATER_TUNING.componentMinShare : FLOOR_SELECT_TUNING.labComponentMinShare;
  const mask = cleanMask(flooded, width, height, taken, useHue ? { hue, sat } : null, contrast, minShare);
  if (!keepComponentAt(mask, start, width, height, minShare)) return none("too-small");
  const [traced] = traceProposals(mask, width, height);
  let next = 1;
  for (const proposal of claimed) next = Math.max(next, Number(String(proposal.id).replace("water-", "")) + 1);
  // Floor comes from Floor to add in the window — the matcher only returns geometry.
  return { status: "found", proposal: { ...traced, id: `water-${next}`, preselected: true, clicked: true }, seed };
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
      if (hue[p] >= 0 && !taken[p] && rgba[p * 4 + 3] >= alphaMin && !isInk(rgba, p)) usable.push(p);
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

// Whether the clicked pixel and most of the patch round it have no real colour. A grey click beside a coloured floor
// then reads as grey, though the colour next to it is the only hue in the patch.
function clickedOnDull(hue, sat, rgba, taken, cx, cy, width, height) {
  const { clickPatch, clickSatMin, alphaMin } = WATER_TUNING;
  const dull = (p) => hue[p] < 0 || sat[p] < clickSatMin;
  if (!dull(cy * width + cx)) return false;
  let seen = 0, grey = 0;
  for (let y = Math.max(0, cy - clickPatch); y <= Math.min(height - 1, cy + clickPatch); y++) {
    for (let x = Math.max(0, cx - clickPatch); x <= Math.min(width - 1, cx + clickPatch); x++) {
      const p = y * width + x;
      if (taken[p] || rgba[p * 4 + 3] < alphaMin) continue;
      seen++;
      if (dull(p)) grey++;
    }
  }
  return seen > 0 && grey >= seen * 0.5;
}

function readLab(rgba, count) {
  const lab = new Float32Array(count * 3);
  for (let p = 0, i = 0; p < count; p++, i += 4) {
    const [L, a, b] = rgbToLab(rgba[i], rgba[i + 1], rgba[i + 2]);
    const o = p * 3;
    lab[o] = L; lab[o + 1] = a; lab[o + 2] = b;
  }
  return lab;
}

export function rgbToLab(r, g, b) {
  const R = LINEAR[r], G = LINEAR[g], B = LINEAR[b];
  const x = (R * 0.4124564 + G * 0.3575761 + B * 0.1804375) / 0.95047;
  const y = (R * 0.2126729 + G * 0.7151522 + B * 0.072175);
  const z = (R * 0.0193339 + G * 0.119192 + B * 0.9503041) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : (7.787037 * t + 16 / 116));
  const fx = f(x), fy = f(y), fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

const LINEAR = Float32Array.from({ length: 256 }, (_, v) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });

// L of the Lab colour straight from the pixel, with no blur, so a dark outline is judged by its own colour.
function lightnessAt(rgba, p) {
  const i = p * 4;
  if (rgba[i + 1] > 72) return 100;
  const y = 0.2126729 * LINEAR[rgba[i]] + 0.7151522 * LINEAR[rgba[i + 1]] + 0.072175 * LINEAR[rgba[i + 2]];
  return y > 0.008856 ? 116 * Math.cbrt(y) - 16 : 903.3 * y;
}

// Near-black and neutral: its hue is noise, so it must not vote for the colour of the click.
export function isInk(rgba, p) {
  const i = p * 4, r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
  const max = Math.max(r, g, b);
  return max < 60 && max - Math.min(r, g, b) < 14;
}

function sharpDeltaE(rgba, p, seed) {
  const i = p * 4;
  const [L, a, b] = rgbToLab(rgba[i], rgba[i + 1], rgba[i + 2]);
  return Math.hypot(L - seed.L, a - seed.a, b - seed.b);
}

function patchLightness(rgba, taken, cx, cy, width, height) {
  const { alphaMin } = WATER_TUNING, radius = FLOOR_SELECT_TUNING.labSeedPatch, values = [];
  for (let y = Math.max(0, cy - radius); y <= Math.min(height - 1, cy + radius); y++) {
    for (let x = Math.max(0, cx - radius); x <= Math.min(width - 1, cx + radius); x++) {
      const p = y * width + x;
      if (!taken[p] && rgba[p * 4 + 3] >= alphaMin && !isInk(rgba, p)) values.push(lightnessAt(rgba, p));
    }
  }
  return values.length ? median(values) : 0;
}

// Takes a stone's outline into the fill. The outline is the pixels dark enough to be ink, plus their soft edge: a pixel
// beside them that is clearly darker than the floor but matches neither the floor nor the ink, such as anti-aliasing.
function outlineAround(flooded, weak, rgba, taken, width, height, floorL) {
  const { labOutlineL, labOutlineSeedGap, labSoftGap, labOutlineReach, labBridgeReach } = FLOOR_SELECT_TUNING;
  if (floorL - labOutlineL < labOutlineSeedGap) return;
  const { alphaMin } = WATER_TUNING, count = width * height;
  const dark = new Uint8Array(count);
  const inks = [];
  for (let p = 0; p < count; p++) {
    if (taken[p] || rgba[p * 4 + 3] < alphaMin || lightnessAt(rgba, p) > labOutlineL) continue;
    dark[p] = 1;
    inks.push(p);
  }
  if (!inks.length) return;
  const soft = [];
  for (const p of inks) {
    const x = p % width, y = (p - x) / width;
    for (let yy = Math.max(0, y - 1); yy <= Math.min(height - 1, y + 1); yy++) {
      for (let xx = Math.max(0, x - 1); xx <= Math.min(width - 1, x + 1); xx++) {
        const q = yy * width + xx;
        if (!dark[q] && !weak[q] && !taken[q] && rgba[q * 4 + 3] >= alphaMin && lightnessAt(rgba, q) <= floorL - labSoftGap) soft.push(q);
      }
    }
  }
  for (const q of soft) dark[q] = 1;
  absorbOutline(flooded, dark, weak, width, height, labOutlineReach, labBridgeReach);
}

// Grows the fill into dark pixels, up to `reach` steps from it, so an outline ring is part of the piece. A crack can cut
// a stone in two, so the pixels taken in within `bridge` steps then seed a fresh fill through the matching pixels beyond
// them, and the two repeat until nothing is added. Only matched pixels start a round, so a dark floor is never followed deeper than `reach`.
function absorbOutline(flooded, dark, weak, width, height, reach, bridge) {
  const count = width * height;
  const absorbed = new Uint8Array(count);
  for (let round = 0; round < FLOOR_SELECT_TUNING.labOutlineRounds; round++) {
    const added = new Uint8Array(count);
    let front = [];
    for (let p = 0; p < count; p++) if (flooded[p] && !absorbed[p] && touchesDark(flooded, dark, p, width, height)) front.push(p);
    let any = false;
    for (let step = 0; step < reach && front.length; step++) {
      const next = [];
      for (const p of front) {
        const x = p % width, y = (p - x) / width;
        for (let dy = -1; dy <= 1; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= height) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            if (xx < 0 || xx >= width) continue;
            const q = yy * width + xx;
            if (dark[q] && !flooded[q]) { flooded[q] = 1; absorbed[q] = 1; if (step < bridge) added[q] = 1; next.push(q); any = true; }
          }
        }
      }
      front = next;
    }
    if (!any) return;
    grow(added, weak, flooded, width, height);
  }
}

function touchesDark(flooded, dark, p, width, height) {
  const x = p % width, y = (p - x) / width;
  for (let yy = Math.max(0, y - 1); yy <= Math.min(height - 1, y + 1); yy++) {
    for (let xx = Math.max(0, x - 1); xx <= Math.min(width - 1, x + 1); xx++) {
      const q = yy * width + xx;
      if (dark[q] && !flooded[q]) return true;
    }
  }
  return false;
}

function blurLab(lab, rgba, width, height, radius) {
  if (!(radius > 0)) return;
  const { alphaMin } = WATER_TUNING;
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
          const p = yy * width + xx;
          if (rgba[p * 4 + 3] < alphaMin) continue;
          const o = p * 3;
          L += src[o]; a += src[o + 1]; b += src[o + 2]; n++;
        }
      }
      const o = (y * width + x) * 3;
      if (!n) continue;
      lab[o] = L / n; lab[o + 1] = a / n; lab[o + 2] = b / n;
    }
  }
}

function seedLab(lab, rgba, taken, cx, cy, width, height) {
  const { alphaMin } = WATER_TUNING, clickPatch = FLOOR_SELECT_TUNING.labSeedPatch;
  const voters = [];
  for (let y = Math.max(0, cy - clickPatch); y <= Math.min(height - 1, cy + clickPatch); y++) {
    for (let x = Math.max(0, cx - clickPatch); x <= Math.min(width - 1, cx + clickPatch); x++) {
      const p = y * width + x;
      if (!taken[p] && rgba[p * 4 + 3] >= alphaMin) voters.push(p);
    }
  }
  if (!voters.length) return null;
  // Median of each channel so a shore pixel cannot pull the seed off the clicked floor.
  const Ls = [], as = [], bs = [];
  for (const p of voters) {
    const o = p * 3;
    Ls.push(lab[o]); as.push(lab[o + 1]); bs.push(lab[o + 2]);
  }
  return { L: median(Ls), a: median(as), b: median(bs) };
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
function keepComponentAt(mask, at, width, height, minShare = WATER_TUNING.componentMinShare) {
  const labels = new Int32Array(width * height);
  const comps = label(mask, labels, width, height);
  let keep = labels[at];
  if (!keep) for (let i = 1; i < comps.length; i++) if (!keep || comps[i].size > comps[keep].size) keep = i;
  if (!keep || comps[keep].size < mask.length * minShare) return false;
  for (let p = 0; p < mask.length; p++) if (labels[p] !== keep) mask[p] = 0;
  return true;
}
