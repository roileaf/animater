// A hole cut in a region by hand (pure): the ring on the region panel, drawn freehand on the map (main.mjs
// startRegionHole). Roi: "instead of attaching parts of lines can you make it freedraw? and also we can use the smart
// model when possible?"
//
// The drawn stroke is closed into a ring. Where the smart model (ui/smart-model.mjs) is already on this machine, the
// ring is fitted to the thing it goes round — an island, a rock, a pier — and a plain click on such a thing cuts round
// it with no drawing at all. Where the model cannot tell, or is not there, the hole is the ring as it was drawn.

import { simplifyLoop } from "./heights.mjs";
import { traceProposals } from "./floor-detect.mjs";
import { solidCut } from "./smart-select.mjs";
import { liftMask } from "../mapbuild/map-lift.mjs";

export const HOLE_TUNING = Object.freeze({
  inside: 0.75, // a model's answer is the circled thing only when this much of it lies within the ring
  agree: 0.3,   // and it fills at least this much of what the ring and it cover together
  least: 12,    // pixels: fewer is no thing at all
});

const flatArea = (flat) => { let twice = 0; for (let i = 0; i < flat.length; i += 2) { const j = (i + 2) % flat.length; twice += flat[i] * flat[j + 1] - flat[j] * flat[i + 1]; } return twice / 2; };

/**
 * The stroke as a ring: flat [x, y, …], its wiggles within `eps` taken out. `points` [{ x, y }] as the pointer went.
 * Null when it is no shape (under three corners, or no area).
 */
export function strokeRing(points, eps = 0) {
  const flat = [];
  for (const p of points ?? []) {
    if (!Number.isFinite(p?.x) || !Number.isFinite(p?.y)) continue;
    const n = flat.length; if (n && flat[n - 2] === p.x && flat[n - 1] === p.y) continue;
    flat.push(p.x, p.y);
  }
  if (flat.length < 6) return null;
  const ring = Array.from(simplifyLoop(flat, eps));
  return ring.length >= 6 && Math.abs(flatArea(ring)) >= 1 ? ring : null;
}

/** How far the pointer went along a stroke [{ x, y }]: a stroke that hardly moved was a click. */
export const strokeLength = (points) => { let sum = 0; for (let i = 1; i < (points?.length ?? 0); i++) sum += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y); return sum; };

/** A ring (flat, in the mask's own pixels) filled in: a Uint8Array of 0s and 1s, `width` × `height`. */
export function ringMask(ring, width, height) {
  const out = new Uint8Array(width * height), n = ring.length / 2;
  for (let y = 0; y < height; y++) {
    const at = y + 0.5, cuts = [];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, y0 = ring[i * 2 + 1], y1 = ring[j * 2 + 1];
      if ((y0 <= at) === (y1 <= at)) continue;
      cuts.push(ring[i * 2] + ((at - y0) / (y1 - y0)) * (ring[j * 2] - ring[i * 2]));
    }
    cuts.sort((a, b) => a - b);
    for (let k = 0; k + 1 < cuts.length; k += 2) {
      const from = Math.max(0, Math.ceil(cuts[k] - 0.5)), to = Math.min(width - 1, Math.floor(cuts[k + 1] - 0.5));
      for (let x = from; x <= to; x++) out[y * width + x] = 1;
    }
  }
  return out;
}

/**
 * What to ask the model about a drawn ring: a point well inside it (to add) and the corners of its box, as
 * smart-select's boxPoints gives them. `mask` the ring filled in. Null when the ring holds no pixel.
 */
export function ringAsk(mask, width, height) {
  let x0 = width, y0 = height, x1 = -1, y1 = -1, sx = 0, sy = 0, count = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (mask[y * width + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; sx += x; sy += y; count++; }
  if (!count) return null;
  // (The middle of its pixels, or the pixel of it nearest that when the ring bends round its own middle.)
  let at = { x: Math.round(sx / count), y: Math.round(sy / count) };
  if (!mask[at.y * width + at.x]) {
    let best = Infinity, found = at;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (mask[y * width + x]) { const d = (x - at.x) ** 2 + (y - at.y) ** 2; if (d < best) { best = d; found = { x, y }; } }
    at = found;
  }
  return { at, points: [{ ...at, label: 1 }, { x: x0, y: y0, label: 2 }, { x: x1, y: y1, label: 3 }] };
}

/**
 * The model's answer fitted to the ring: of its nested `masks`, the one that is most the thing the ring goes round —
 * nearly all of it inside the ring, and filling a fair part of it. Only what lies inside the ring is cut, as one solid
 * piece under `at`. A Uint8Array, or null when no answer is the circled thing (the ring is then cut as drawn).
 */
export function fittedHole({ masks = [], ring, width, height, at, tuning = {} } = {}) {
  const { inside, agree, least } = { ...HOLE_TUNING, ...tuning }, n = width * height;
  if (!ring || !(n > 0)) return null;
  let best = null;
  for (const m of masks) {
    if (!m || m.length < n) continue;
    let both = 0, own = 0, drawn = 0;
    for (let p = 0; p < n; p++) { const a = m[p] ? 1 : 0, b = ring[p]; own += a; drawn += b; both += a & b; }
    if (both < least || both < own * inside) continue;
    const share = both / (own + drawn - both);
    if (share >= agree && (!best || share > best.share)) best = { m, share };
  }
  if (!best) return null;
  const cut = new Uint8Array(n); for (let p = 0; p < n; p++) cut[p] = best.m[p] && ring[p] ? 1 : 0;
  return solidCut(cut, width, height, at);
}

/**
 * The thing under a plain click, from the model's nested answers: neither a speck nor a great part of the map (map-lift's
 * liftMask), as one solid piece. A Uint8Array, or null.
 */
export function clickedHole({ masks = [], scores = [], width, height, at } = {}) {
  const mask = liftMask({ masks, scores, width, height });
  if (!mask) return null;
  const solid = solidCut(mask, width, height, at);
  let count = 0; for (let p = 0; p < solid.length; p++) count += solid[p];
  return count >= HOLE_TUNING.least ? solid : null;
}

/** A mask's biggest piece as a ring (flat, in the mask's pixels), traced and simplified as floor regions are. Null when empty. */
export function maskRing(mask, width, height) {
  const piece = traceProposals(mask, width, height)[0], loop = piece?.loops?.find((l) => !l.hole);
  return loop?.points?.length >= 6 ? Array.from(loop.points) : null;
}

/** A ring between the map's read picture and the scene. `map` { width, height, rect { x, y, width, height } }. */
export const ringToImage = (ring, map) => ring.map((v, i) => (i % 2 ? ((v - map.rect.y) * map.height) / map.rect.height : ((v - map.rect.x) * map.width) / map.rect.width));
export const ringToScene = (ring, map) => ring.map((v, i) => (i % 2 ? map.rect.y + (v * map.rect.height) / map.height : map.rect.x + (v * map.rect.width) / map.width));

/** A region's shapes with the ring (flat, scene units) cut out as a hole; null when the ring is no shape. */
export function holedShapes(shapes, ring) {
  const flat = Array.from(ring ?? [], (v) => Math.round(v));
  if (flat.length < 6 || flat.length % 2 || flat.some((v) => !Number.isFinite(v)) || Math.abs(flatArea(flat)) < 1) return null;
  return [...(shapes ?? []).map((shape) => (typeof shape?.toObject === "function" ? shape.toObject() : { ...shape })), { type: "polygon", points: flat, hole: true }];
}
