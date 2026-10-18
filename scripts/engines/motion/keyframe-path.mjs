// Keyframed path: the real token's own movement, authored as points over time. Positions are
// squares in the stage's frame (+x away from the other token, +y to its right).
import { easeValue, EASES } from "../../core/stage-options.mjs";

export const MAX_KEYFRAMES = 12;
const base = { rotation: 0, scale: 1, alpha: 1, stretch: 0, ease: "linear", sharp: false };
export const DEFAULT_KEYFRAMES = Object.freeze([Object.freeze({ at: 0, x: 0, y: 0, ...base }), Object.freeze({ at: 1, x: 1, y: 0, ...base })]);
const clamp = (v, min, max, fallback) => (v !== null && v !== "" && Number.isFinite(Number(v)) ? Math.min(max, Math.max(min, Number(v))) : fallback);
const keyframe = (k, limit = 12) => ({ at: clamp(k.at, 0, 1, 0), x: clamp(k.x, -limit, limit, 0), y: clamp(k.y, -limit, limit, 0), rotation: clamp(k.rotation, -1440, 1440, 0),
  scale: clamp(k.scale, 0.05, 5, 1), alpha: clamp(k.alpha, 0, 1, 1), stretch: clamp(k.stretch, -0.6, 0.6, 0), ease: Object.hasOwn(EASES, k.ease) ? k.ease : "linear", sharp: k.sharp === true });

// `limit` is the x/y clamp in squares: authored paths use 12; a finisher's rotated, fitted end needs more room.
export function normalizeKeyframes(input, { limit = 12 } = {}) {
  const list = (Array.isArray(input) ? input : []).filter((k) => k && typeof k === "object").map((k) => keyframe(k, limit)).sort((a, b) => a.at - b.at).slice(0, MAX_KEYFRAMES);
  if (list.length < 2) return DEFAULT_KEYFRAMES.map((k) => ({ ...k }));
  list[0] = { ...list[0], at: 0, x: 0, y: 0, rotation: 0, scale: 1, alpha: 1, stretch: 0 };
  list[list.length - 1] = { ...list[list.length - 1], at: 1 };
  return list;
}

// Centripetal Catmull-Rom (Barry–Goldman): no loops or cusps, and it passes through p1 and p2.
function centripetal(p0, p1, p2, p3, u) {
  const knot = (a, b) => Math.max(1e-6, Math.hypot(b.x - a.x, b.y - a.y) ** 0.5);
  const t1 = knot(p0, p1), t2 = t1 + knot(p1, p2), t3 = t2 + knot(p2, p3), t = t1 + (t2 - t1) * u;
  const lerp = (a, b, ta, tb) => { const w = tb === ta ? 0 : (t - ta) / (tb - ta); return { x: a.x + (b.x - a.x) * w, y: a.y + (b.y - a.y) * w }; };
  const a1 = lerp(p0, p1, 0, t1), a2 = lerp(p1, p2, t1, t2), a3 = lerp(p2, p3, t2, t3);
  return lerp(lerp(a1, a2, 0, t2), lerp(a2, a3, t1, t3), t1, t2);
}

export function samplePath(keyframes, q) {
  const k = keyframes, t = Math.min(1, Math.max(0, q));
  let i = k.length - 2;
  for (let j = k.length - 2; j >= 0; j--) if (t >= k[j].at) { i = j; break; }
  const a = k[i], b = k[i + 1], span = b.at - a.at;
  const u = easeValue(span > 0 ? (t - a.at) / span : 1, b.ease);
  // Past either end, a mirrored phantom point keeps the end segments straight-ish; duplicating
  // the end point instead would turn even a straight two-point path into an S-curve.
  const mirror = (p, about) => ({ x: 2 * about.x - p.x, y: 2 * about.y - p.y });
  const point = a.sharp || b.sharp ? { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u } : centripetal(k[i - 1] ?? mirror(b, a), a, b, k[i + 2] ?? mirror(a, b), u);
  const mix = (key) => a[key] + (b[key] - a[key]) * u;
  return { x: point.x, y: point.y, rotation: mix("rotation"), scale: mix("scale"), alpha: mix("alpha"), stretch: (a.stretch ?? 0) + ((b.stretch ?? 0) - (a.stretch ?? 0)) * u };
}

export const pathEnd = (keyframes) => ({ x: keyframes.at(-1).x, y: keyframes.at(-1).y });
// Whole squares the path travels, counted like grid movement (the longer axis).
export const pathSquares = (keyframes) => { const e = pathEnd(keyframes); return Math.round(Math.max(Math.abs(e.x), Math.abs(e.y))); };
// A travelling held path lands the real token, which snaps back upright, full size and visible.
const upright = (k) => (k.rotation ?? 0) % 360 === 0 && (k.scale ?? 1) === 1 && (k.alpha ?? 1) === 1 && (k.stretch ?? 0) === 0;
export const landsTilted = (keyframes) => pathSquares(keyframes) >= 1 && !upright(keyframes.at(-1));
// Squash & stretch: `stretch` along the travel `angle` (radians, in the mesh's own frame),
// squeezed across it by 1/sqrt so the area stays about the same. Negative flattens.
export function stretchScale(stretch, angle) {
  if (!stretch) return { scaleX: 1, scaleY: 1 };
  const a = Math.max(0.2, 1 + stretch), b = 1 / Math.sqrt(a), c = Math.cos(angle) ** 2, s = Math.sin(angle) ** 2;
  return { scaleX: a * c + b * s, scaleY: a * s + b * c };
}
export const rotateBy = (v, dir) => ({ x: v.x * dir.x - v.y * dir.y, y: v.x * dir.y + v.y * dir.x });
export const unrotateBy = (v, dir) => ({ x: v.x * dir.x + v.y * dir.y, y: -v.x * dir.y + v.y * dir.x });

// A path stopped by a wall `reach` squares out: cut where it first gets there, keeping its speed.
// `ease` is the stage's whole-path ease, so `t` is in the stage's own time. The cut plays exactly
// the original motion up to the wall: it is resampled evenly in time into linear keyframes, to be
// played with a linear whole-path ease over `t` of the duration. Reusing the original eases over
// the shorter span would replay the whole curve and slow it to a stop at the wall. The cut end
// lands upright (whole turns, full size, visible). A path that never gets there is kept.
const CUT_SAMPLES = Math.min(8, MAX_KEYFRAMES - 1);
export function cutPath(keyframes, reach, ease = "linear") {
  const at = (p) => samplePath(keyframes, Math.min(1, Math.max(0, easeValue(p, ease))));
  const out = (p) => { const s = at(p); return Math.hypot(s.x, s.y) >= reach - 1e-9; };
  const STEPS = 200;
  let hi = null;
  for (let i = 1; i <= STEPS; i++) if (out(i / STEPS)) { hi = i / STEPS; break; }
  if (hi === null) return { keyframes, t: 1 };
  let lo = hi - 1 / STEPS;
  while (hi - lo > 1e-9) { const mid = (lo + hi) / 2; if (out(mid)) hi = mid; else lo = mid; }
  const t = hi;
  if (t >= 1) return { keyframes, t: 1 };
  const resampled = Array.from({ length: CUT_SAMPLES }, (_, i) => ({ ...at((t * i) / CUT_SAMPLES), at: i / CUT_SAMPLES, ease: "linear", sharp: false }));
  const p = at(t);
  const end = { at: 1, x: p.x, y: p.y, rotation: Math.round(p.rotation / 360) * 360 + 0, scale: 1, alpha: 1, stretch: 0, ease: "linear", sharp: false };
  return { keyframes: normalizeKeyframes([...resampled, end]), t };
}

// Editor helpers. The first keyframe is where the token stands and the last ends the motion.
export const snapSquares = (v, whole = false) => (whole ? Math.round(v) : Math.round(v * 4) / 4) + 0;
export function insertKeyframe(keyframes, at) {
  const t = clamp(at, 0.01, 0.99, 0.5);
  if (keyframes.length >= MAX_KEYFRAMES || keyframes.some((k) => Math.abs(k.at - t) < 0.005)) return keyframes;
  return normalizeKeyframes([...keyframes, { ...samplePath(keyframes, t), at: t, ease: "linear" }]);
}
export function moveKeyframeTime(keyframes, index, at) {
  if (index <= 0 || index >= keyframes.length - 1) return keyframes;
  const lo = keyframes[index - 1].at + 0.01, hi = keyframes[index + 1].at - 0.01;
  return keyframes.map((k, i) => (i === index ? { ...k, at: Math.round(Math.min(hi, Math.max(lo, at)) * 1000) / 1000 } : k));
}
export function moveKeyframePoint(keyframes, index, x, y, whole = false) {
  if (index <= 0) return keyframes;
  return normalizeKeyframes(keyframes.map((k, i) => (i === index ? { ...k, x: snapSquares(x, whole), y: snapSquares(y, whole) } : k)));
}
export const deleteKeyframe = (keyframes, index) => (index <= 0 || index >= keyframes.length - 1 ? keyframes : keyframes.filter((_, i) => i !== index));
export const flipKeyframes = (keyframes) => keyframes.map((k) => ({ ...k, y: k.y ? -k.y : 0 }));
export const resetKeyframes = () => DEFAULT_KEYFRAMES.map((k) => ({ ...k }));
// "Make smooth": every keyframe linear, so the whole-path ease alone shapes the speed. An already
// smooth path is returned as is, so the editor can tell nothing changed.
export const smoothKeyframes = (keyframes) => (keyframes.every((k) => k.ease === "linear") ? keyframes : keyframes.map((k) => ({ ...k, ease: "linear" })));
