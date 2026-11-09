// Smart selection: turns a segmentation model's masks into a water area. Pure: the model itself is in
// scripts/ui/smart-model.mjs, and everything here works on plain Uint8Array masks at the map's read size.
//
// The choices below were measured on 41 hand-drawn floor regions from real adventure maps
// (tools/fx-gallery/floor-sam-test.html, docs/floor-regions-plan-2026-11-08.md):
// - a click starts on the middle of the model's three nested sizes (one slab / the room / most of the map);
// - a box starts on the model's top-scored mask;
// - a single click is checked against four nearby clicks, and the mask agreeing most with all of them wins,
//   so a click on a bush or a rock still finds the floor around it;
// - only pieces an add-click touches are kept, and enclosed holes under 5% of the map are filled, as a GM's
//   outline takes in the furniture and bushes standing on a floor;
// - a right-click cuts the clicked thing out of the area under it, and that hole is kept (cutStart, cutFrom).

import { mergeAreaProposals, WATER_TUNING } from "./floor-detect.mjs";

export const SMART_TUNING = Object.freeze({
  consensusRadius: 0.02, // nearby clicks, as a share of the map's long side
  agreeStep: 4,          // every 4th pixel when comparing masks
  holeShare: 0.05,       // enclosed holes below this share of the map are filled
});

const count = (mask) => { let n = 0; for (let i = 0; i < mask.length; i++) n += mask[i] ? 1 : 0; return n; };

// The three sizes, smallest first.
export function sizeOrder(masks) {
  const sizes = masks.map(count);
  return masks.map((_, i) => i).sort((a, b) => sizes[a] - sizes[b]);
}

// The size a mark starts on: the middle for a click, the model's top score for a box.
export function startSize(masks, scores, { box = false } = {}) {
  if (box) return scores.indexOf(Math.max(...scores));
  return sizeOrder(masks)[1];
}

// A box goes to the model as its two corners with SAM's corner labels 2 and 3. SAM 2.1's own box input put most of
// the mask outside the box in testing; corner points keep it inside.
export function boxPoints([x0, y0, x1, y1]) {
  return [{ x: Math.min(x0, x1), y: Math.min(y0, y1), label: 2 }, { x: Math.max(x0, x1), y: Math.max(y0, y1), label: 3 }];
}

// The click and four clicks around it, kept on the map.
export function nearbyClicks(at, width, height, radius = SMART_TUNING.consensusRadius) {
  const r = Math.max(width, height) * radius;
  return [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]].map(([dx, dy]) => ({
    x: Math.min(width - 1, Math.max(0, at.x + dx)), y: Math.min(height - 1, Math.max(0, at.y + dy)), label: 1,
  }));
}

function overlap(a, b) { let i = 0, u = 0; for (let p = 0; p < a.length; p++) { const x = a[p], y = b[p]; if (x && y) i++; if (x || y) u++; } return u ? i / u : 0; }

// The mask most like all the others (each click's three sizes, flattened). Returns its position in `sets`.
export function consensus(sets, width, height, step = SMART_TUNING.agreeStep) {
  const all = sets.flat(), small = all.map((m) => { const o = []; for (let y = 0; y < height; y += step) for (let x = 0; x < width; x += step) o.push(m[y * width + x]); return Uint8Array.from(o); });
  let best = 0, bestScore = -1;
  for (let i = 0; i < small.length; i++) {
    let s = 0; for (let j = 0; j < small.length; j++) if (j !== i) s += overlap(small[i], small[j]);
    if (s > bestScore) { bestScore = s; best = i; }
  }
  return { set: Math.floor(best / 3), index: best % 3, mask: all[best] };
}

function label(mask, width, height) {
  const lab = new Int32Array(mask.length), sizes = [0], stack = [];
  for (let s = 0; s < mask.length; s++) {
    if (!mask[s] || lab[s]) continue;
    const id = sizes.length; let n = 0; lab[s] = id; stack.push(s);
    while (stack.length) {
      const p = stack.pop(); n++; const x = p % width;
      if (x > 0 && mask[p - 1] && !lab[p - 1]) { lab[p - 1] = id; stack.push(p - 1); }
      if (x < width - 1 && mask[p + 1] && !lab[p + 1]) { lab[p + 1] = id; stack.push(p + 1); }
      if (p >= width && mask[p - width] && !lab[p - width]) { lab[p - width] = id; stack.push(p - width); }
      if (p < mask.length - width && mask[p + width] && !lab[p + width]) { lab[p + width] = id; stack.push(p + width); }
    }
    sizes.push(n);
  }
  return { lab, sizes };
}

// Keep the pieces an add-click (label 1) touches, and fill enclosed holes below `holeShare` of the map.
// With no add-click (a box), every piece is kept.
export function cleanSelection(mask, width, height, points = [], holeShare = SMART_TUNING.holeShare) {
  const n = mask.length, out = new Uint8Array(n), { lab } = label(mask, width, height);
  const seeds = points.filter((p) => p.label === 1).map((p) => lab[Math.round(p.y) * width + Math.round(p.x)]).filter(Boolean);
  const keep = new Set(seeds);
  for (let i = 0; i < n; i++) out[i] = mask[i] && (!keep.size || keep.has(lab[i])) ? 1 : 0;
  const inv = new Uint8Array(n); for (let i = 0; i < n; i++) inv[i] = out[i] ? 0 : 1;
  const holes = label(inv, width, height), edge = new Uint8Array(holes.sizes.length);
  for (let x = 0; x < width; x++) { edge[holes.lab[x]] = 1; edge[holes.lab[(height - 1) * width + x]] = 1; }
  for (let y = 0; y < height; y++) { edge[holes.lab[y * width]] = 1; edge[holes.lab[y * width + width - 1]] = 1; }
  for (let i = 0; i < n; i++) { const id = holes.lab[i]; if (id && !edge[id] && holes.sizes[id] < n * holeShare) out[i] = 1; }
  return out;
}

// Taking a part out (right-click). The model is asked what the clicked thing is on its own (a bush, a rock, a
// patch of mud), and that is cut out of the area under the click. Unlike an add, the hole stays: cleanSelection's
// hole filling is exactly what must not run here.
//
// Of the model's three sizes, the cut starts on the largest one whose part on the area is still a part of the area
// rather than the area itself: no more than `cutMaxShare` of it, and taking in the clicked `pixel`. Only the part on
// the area is cut, so a bush the area's edge runs into loses just its overlap. Null when every size is the area.
// On the Hateful Hermit grass, a click on plain grass gave "parts" of 30-55% of the field; things a GM cuts out
// (bushes, rocks, mud) stayed far below a quarter.
export function cutStart(masks, areaMask, { cutMaxShare = 0.25, pixel = -1 } = {}) {
  let areaSize = 0; for (let i = 0; i < areaMask.length; i++) areaSize += areaMask[i] ? 1 : 0;
  if (!areaSize) return null;
  let best = null;
  for (const index of sizeOrder(masks)) {
    const mask = masks[index]; let inside = 0;
    if (pixel >= 0 && !mask[pixel]) continue;
    for (let i = 0; i < mask.length; i++) if (mask[i] && areaMask[i]) inside++;
    if (inside && inside <= areaSize * cutMaxShare) best = index;
  }
  return best;
}

// Square grow by r pixels (sideways, then up and down, per step). The map's border is not an edge.
function grown(mask, width, height, r) {
  let wide = mask; const n = mask.length;
  for (let g = 0; g < r; g++) {
    const side = new Uint8Array(n), next = new Uint8Array(n);
    for (let p = 0; p < n; p++) if (wide[p]) { const x = p % width; side[p] = 1; if (x > 0) side[p - 1] = 1; if (x < width - 1) side[p + 1] = 1; }
    for (let p = 0; p < n; p++) if (side[p]) { next[p] = 1; if (p >= width) next[p - width] = 1; if (p < n - width) next[p + width] = 1; }
    wide = next;
  }
  return wide;
}
const inverted = (mask) => { const out = new Uint8Array(mask.length); for (let i = 0; i < mask.length; i++) out[i] = mask[i] ? 0 : 1; return out; };

// A thin finger or neck of the area under `pixel`: the part a shrink and regrow by r loses, for the smallest r
// (in SLIVER_RADII) that loses the pixel. Traced areas often run a narrow tongue along a gap between bushes; the model
// sees the bush or the whole field there, never the tongue. Null when the area is thick at the pixel, or when the
// thin part is a few pixels of ragged edge (under `minSize`) or over `maxShare` of the area.
export const SLIVER_RADII = Object.freeze([2, 3, 4, 6, 8]);
export function sliverAt(areaMask, width, height, pixel, { minSize = 40, maxShare = 0.25 } = {}) {
  if (!areaMask[pixel]) return null;
  let areaSize = 0; for (let i = 0; i < areaMask.length; i++) areaSize += areaMask[i] ? 1 : 0;
  for (const r of SLIVER_RADII) {
    const opened = grown(inverted(grown(inverted(areaMask), width, height, r)), width, height, r);
    if (opened[pixel]) continue;
    const thin = new Uint8Array(areaMask.length);
    for (let p = 0; p < thin.length; p++) if (areaMask[p] && !opened[p]) thin[p] = 1;
    const { lab, sizes } = label(thin, width, height), id = lab[pixel];
    if (sizes[id] < minSize) continue;
    if (sizes[id] > areaSize * maxShare) return null;
    const out = new Uint8Array(thin.length);
    for (let p = 0; p < out.length; p++) if (lab[p] === id) out[p] = 1;
    return out;
  }
  return null;
}

// The model's masks of a textured thing are speckled; cut out as they are, they leave dozens of pinholes. A cut is
// the one piece under the click, filled solid. With the click off every piece, all pieces are kept.
export function solidCut(mask, width, height, at) {
  return cleanSelection(mask, width, height, [{ ...at, label: 1 }], 1);
}

// The area without the cut, the cut grown by `grow` pixels so no thin rim of the cut part stays behind.
// Also returns the part actually removed, for the area's record of what was taken out.
export function cutFrom(areaMask, cut, width, height, grow = 1) {
  const n = areaMask.length, out = new Uint8Array(n), removed = new Uint8Array(n);
  const wide = grow ? grown(cut, width, height, grow) : cut;
  for (let p = 0; p < n; p++) { if (!areaMask[p]) continue; if (wide[p]) removed[p] = 1; else out[p] = 1; }
  return { mask: out, removed };
}

// Stray spots: an area traced from the map often comes with small separate pieces along its edge (a shore of sand
// beads, flecks of grass in rocks). No model is needed to remove them, only the pieces themselves.
//
// The separate piece of the area under `pixel`, or null when the pixel is off the area or the piece is the area's
// main body: the largest piece, or any piece more than `maxShare` of the whole area.
export function spotAt(areaMask, width, height, pixel, { maxShare = 0.25 } = {}) {
  if (!areaMask[pixel]) return null;
  const { lab, sizes } = label(areaMask, width, height);
  const id = lab[pixel], total = sizes.reduce((s, n) => s + n, 0);
  if (sizes[id] === Math.max(...sizes) || sizes[id] > total * maxShare) return null;
  const out = new Uint8Array(areaMask.length);
  for (let p = 0; p < out.length; p++) if (lab[p] === id) out[p] = 1;
  return out;
}

// Every small separate piece of the area: those under `keepShare` of its largest piece. Null when there are none.
export function smallSpots(areaMask, width, height, { keepShare = 0.05 } = {}) {
  const { lab, sizes } = label(areaMask, width, height);
  const largest = Math.max(...sizes);
  const small = sizes.map((n, id) => id > 0 && n < largest * keepShare);
  if (!small.some(Boolean)) return null;
  const out = new Uint8Array(areaMask.length);
  for (let p = 0; p < out.length; p++) if (small[lab[p]]) out[p] = 1;
  return out;
}

// The separate pieces of a mask, each as a sorted pixel list.
export function maskPieces(mask, width, height) {
  const { lab, sizes } = label(mask, width, height), lists = sizes.map(() => []);
  for (let p = 0; p < lab.length; p++) if (lab[p]) lists[lab[p]].push(p);
  return lists.slice(1).filter((list) => list.length).map((list) => Int32Array.from(list));
}

// The next free area id after the ones on the list.
export function nextAreaId(proposals) {
  let next = 1;
  for (const proposal of proposals ?? []) next = Math.max(next, Number(String(proposal.id).replace("area-", "")) + 1 || 1);
  return `area-${next}`;
}

// A cleaned mask as a new area: traced and simplified like any other, sharing no pixel with `claimed`.
// Null when too little is left.
export function smartProposal(mask, width, height, { id, claimed = [] } = {}) {
  const pixels = []; for (let p = 0; p < mask.length; p++) if (mask[p]) pixels.push(p);
  if (!pixels.length) return null;
  const traced = mergeAreaProposals([{ id, pixels: Int32Array.from(pixels) }], width, height, { claimed });
  if (!traced.pixels.length || traced.share < WATER_TUNING.componentMinShare) return null;
  return { ...traced, id, preselected: true, clicked: true, smart: true };
}
