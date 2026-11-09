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

// sRGB (0-255, may be fractional) to CIELAB, D65.
const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const fLab = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
function srgbLab(r, g, b) {
  const R = lin(r), G = lin(g), B = lin(b);
  const x = fLab((0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047), y = fLab(0.2126 * R + 0.7152 * G + 0.0722 * B), z = fLab((0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
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

// Keeping to the clicked colours. The model traces by shape, so a chair, a rug or a bush standing on a floor often comes
// in with it (and cleanSelection fills it in as a hole). This drops the parts of `mask` whose colour is unlike the
// floor around the click(s), and keeps them out as holes; specks of the floor's own texture are filled back.
// `seeds`: the click(s) ({x, y}). The floor's colours are sampled within `radius` (a share of the long side) of
// them, smoothed over 3 × 3 pixels so a painted texture reads as its colour. Lightness may vary more than hue: stone
// is light and dark, a green chair on it is another hue. When the cut would leave less than `minKeep` of the mask
// (a floor of many colours), the mask is returned as it was. Returns { mask, dropped } (dropped: pixels taken out).
export const PALETTE_TUNING = Object.freeze({ radius: 0.03, light: 24, hue: 9, minKeep: 0.4, speck: 0.0004, samples: 600, joinedOnly: false });
export function keepToColours(mask, rgba, width, height, seeds = [], tuning = {}) {
  const { radius, light, hue, minKeep, speck, samples, joinedOnly } = { ...PALETTE_TUNING, ...tuning };
  const n = width * height, total = count(mask);
  const points = seeds.filter((p) => p && p.x >= 0 && p.y >= 0 && p.x < width && p.y < height);
  if (!total || !points.length || !rgba) return { mask, dropped: 0 };
  // Smoothed Lab of a pixel, from its 3 × 3 neighbours' average colour.
  const labAt = (p) => {
    const x = p % width, y = (p - x) / width; let r = 0, g = 0, b = 0, c = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= width || yy >= height) continue;
      const o = (yy * width + xx) * 4; r += rgba[o]; g += rgba[o + 1]; b += rgba[o + 2]; c++;
    }
    return srgbLab(r / c, g / c, b / c);
  };
  // Colour bins: lightness by 8, a and b by 3. A bin near a sampled one (within light / hue) counts as the floor's.
  const LB = 8, AB = 3, NL = 14, NA = 86;
  const bin = ([l, a, b]) => Math.min(NL - 1, Math.max(0, Math.floor(l / LB))) * NA * NA + Math.min(NA - 1, Math.max(0, Math.floor((a + 128) / AB))) * NA + Math.min(NA - 1, Math.max(0, Math.floor((b + 128) / AB)));
  const near = new Uint8Array(NL * NA * NA), dl = Math.ceil(light / LB), dab = Math.ceil(hue / AB);
  const r = Math.max(3, Math.round(radius * Math.max(width, height))), pool = [];
  for (const { x, y } of points) {
    for (let yy = Math.max(0, Math.round(y) - r); yy <= Math.min(height - 1, Math.round(y) + r); yy++) for (let xx = Math.max(0, Math.round(x) - r); xx <= Math.min(width - 1, Math.round(x) + r); xx++) {
      const p = yy * width + xx; if (mask[p] && (xx - x) ** 2 + (yy - y) ** 2 <= r * r) pool.push(p);
    }
  }
  if (!pool.length) return { mask, dropped: 0 };
  const step = Math.max(1, Math.floor(pool.length / samples)), seen = new Set();
  for (let i = 0; i < pool.length; i += step) {
    const c = bin(labAt(pool[i])); if (seen.has(c)) continue; seen.add(c);
    const l0 = Math.floor(c / (NA * NA)), a0 = Math.floor(c / NA) % NA, b0 = c % NA;
    for (let l = Math.max(0, l0 - dl); l <= Math.min(NL - 1, l0 + dl); l++) for (let a = Math.max(0, a0 - dab); a <= Math.min(NA - 1, a0 + dab); a++) for (let b = Math.max(0, b0 - dab); b <= Math.min(NA - 1, b0 + dab); b++) near[l * NA * NA + a * NA + b] = 1;
  }
  const keep = new Uint8Array(n);
  for (let p = 0; p < n; p++) if (mask[p] && near[bin(labAt(p))]) keep[p] = 1;
  // The floor: the part joined to a click, and every other sizeable part (a rug across a corridor leaves the floor in
  // two); loose crumbs go. The specks of texture its colours missed are filled back.
  const parts = label(keep, width, height), joined = new Set(), crumbs = Math.max(24, total * 0.01);
  for (const { x, y } of points) { const id = parts.lab[Math.round(y) * width + Math.round(x)]; if (id) joined.add(id); }
  if (!joined.size) return { mask, dropped: 0 };
  if (!joinedOnly) for (let id = 1; id < parts.sizes.length; id++) if (parts.sizes[id] >= crumbs) joined.add(id);
  const out = new Uint8Array(n); for (let p = 0; p < n; p++) out[p] = joined.has(parts.lab[p]) ? 1 : 0;
  const inv = new Uint8Array(n); for (let p = 0; p < n; p++) inv[p] = out[p] ? 0 : 1;
  const holes = label(inv, width, height), edge = new Uint8Array(holes.sizes.length);
  for (let x = 0; x < width; x++) { edge[holes.lab[x]] = 1; edge[holes.lab[(height - 1) * width + x]] = 1; }
  for (let y = 0; y < height; y++) { edge[holes.lab[y * width]] = 1; edge[holes.lab[y * width + width - 1]] = 1; }
  const small = Math.max(24, n * speck);
  for (let p = 0; p < n; p++) { const id = holes.lab[p]; if (id && !edge[id] && holes.sizes[id] < small && mask[p]) out[p] = 1; }
  const kept = count(out);
  if (kept < total * minKeep) return { mask, dropped: 0 };
  return { mask: out, dropped: total - kept };
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
// A thing that big can still be a part when it plainly looks different: a stone bridge over a small pool, a rug filling
// most of a room. With the map's `rgba` (`width` wide), when no size is small enough, the smallest one up to
// `bigShare` of the area whose colour is at least `contrast` (CIELAB, lightness counting half) from the rest of the
// area is the cut. Plain grass under a click is the colour of the rest of the field, so it never passes.
export function cutStart(masks, areaMask, { cutMaxShare = 0.25, pixel = -1, rgba = null, width = 0, bigShare = 0.9, contrast = 15 } = {}) {
  let areaSize = 0; for (let i = 0; i < areaMask.length; i++) areaSize += areaMask[i] ? 1 : 0;
  if (!areaSize) return null;
  let best = null;
  for (const index of sizeOrder(masks)) {
    const mask = masks[index]; let inside = 0;
    if (pixel >= 0 && !mask[pixel]) continue;
    for (let i = 0; i < mask.length; i++) if (mask[i] && areaMask[i]) inside++;
    if (inside && inside <= areaSize * cutMaxShare) best = index;
  }
  if (best !== null || !rgba || !width) return best;
  for (const index of sizeOrder(masks)) {
    const mask = masks[index];
    if (pixel >= 0 && !mask[pixel]) continue;
    const part = [0, 0, 0], rest = [0, 0, 0]; let inside = 0, outside = 0;
    for (let i = 0; i < mask.length; i++) {
      if (!areaMask[i] || (i & 1)) continue; // every other pixel is plenty for an average
      const o = i * 4, lab = srgbLab(rgba[o], rgba[o + 1], rgba[o + 2]), into = mask[i] ? part : rest;
      into[0] += lab[0]; into[1] += lab[1]; into[2] += lab[2];
      if (mask[i]) inside++; else outside++;
    }
    if (!inside || !outside || inside * 2 > areaSize * bigShare) continue;
    const d = Math.hypot((part[0] / inside - rest[0] / outside) / 2, part[1] / inside - rest[1] / outside, part[2] / inside - rest[2] / outside);
    if (d >= contrast) return index;
  }
  return null;
}

// A right-click cut by colour, for when none of the model's sizes is a part of the area (it sees the bridge and the pool
// as one): the part of the area joined to the click in the clicked colours (sampled close around it), with the specks
// of its own texture filled. Null when that is nothing, or `maxShare` or more of the area (the click was on the floor
// itself). The mask of the part, on the area only.
export function colourCut(areaMask, rgba, width, height, at, { maxShare = 0.9, radius = 0.012 } = {}) {
  if (!rgba || !at) return null;
  const pixel = Math.round(at.y) * width + Math.round(at.x);
  if (!areaMask[pixel]) return null;
  const { mask, dropped } = keepToColours(areaMask, rgba, width, height, [at], { joinedOnly: true, minKeep: 0, radius });
  if (mask === areaMask && !dropped) return null; // nothing differs: the whole area is the clicked colour
  let part = 0, area = 0;
  for (let i = 0; i < areaMask.length; i++) { if (areaMask[i]) area++; if (mask[i] && areaMask[i]) part++; }
  if (!part || part >= area * maxShare) return null;
  // One pixel more, on the area: the edge where smoothing blends the part with the floor goes with the part.
  const out = Uint8Array.from(mask);
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue; const x = i % width;
    for (const j of [x > 0 ? i - 1 : -1, x < width - 1 ? i + 1 : -1, i - width, i + width]) if (j >= 0 && j < mask.length && areaMask[j]) out[j] = 1;
  }
  return out;
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
