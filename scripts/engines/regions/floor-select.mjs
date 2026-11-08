// Click selection for floor/water regions. Matches by hue and saturation near the click.

import {
  WATER_TUNING, none, readColour, hueDistance, grow, cleanMask, traceProposals, label,
} from "./floor-trace.mjs";

export function selectWaterAt(rgba, width, height, { x, y }, { claimed = [], broad = false } = {}) {
  const count = width * height;
  if (!rgba || rgba.length < count * 4) throw new Error("selectWaterAt: rgba is shorter than width * height * 4");
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
  for (const proposal of claimed) next = Math.max(next, Number(String(proposal.id).replace("water-", "")) + 1);
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
