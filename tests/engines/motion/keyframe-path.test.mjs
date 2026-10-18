import test from "node:test";
import assert from "node:assert/strict";
import { MAX_KEYFRAMES, DEFAULT_KEYFRAMES, normalizeKeyframes, samplePath, pathEnd, pathSquares, rotateBy, unrotateBy, snapSquares, insertKeyframe, moveKeyframeTime, moveKeyframePoint, deleteKeyframe, flipKeyframes, resetKeyframes, cutPath, stretchScale, landsTilted, smoothKeyframes } from "../../../scripts/engines/motion/keyframe-path.mjs";
import { easeValue } from "../../../scripts/core/stage-options.mjs";
import { presetFinisher } from "../../../scripts/engines/finishers/finisher-presets.mjs";
import { finisherTravelPath } from "../../../scripts/engines/finishers/finisher-model.mjs";

const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-6, `${msg}: ${a} vs ${b}`);
const kfs = normalizeKeyframes([{ at: 0 }, { at: 0.5, x: 1, y: 1, rotation: 90, ease: "linear" }, { at: 1, x: 2, y: 0, scale: 0.5, alpha: 0.2, ease: "linear" }]);

test("keyframes are clamped, sorted, pinned at the start and repaired when unusable", () => {
  const n = normalizeKeyframes([{ at: 1, x: 40, rotation: 9999, scale: 0, alpha: 3, ease: "bogus" }, { at: 0.3, x: 5, y: 2 }, { at: 0.1, x: 9, y: 9, rotation: 45 }]);
  assert.deepEqual(n.map((k) => k.at), [0, 0.3, 1]);
  assert.deepEqual([n[0].x, n[0].y, n[0].rotation, n[0].scale, n[0].alpha], [0, 0, 0, 1, 1], "first keyframe is where the token stands");
  assert.deepEqual([n[2].x, n[2].rotation, n[2].scale, n[2].alpha, n[2].ease], [12, 1440, 0.05, 1, "linear"]);
  assert.deepEqual(normalizeKeyframes(null), DEFAULT_KEYFRAMES.map((k) => ({ ...k })));
  assert.deepEqual(normalizeKeyframes([{ at: 0.5, x: 3 }]).map((k) => [k.at, k.x]), [[0, 0], [1, 1]], "one keyframe is not a path");
  assert.equal(normalizeKeyframes(Array.from({ length: 20 }, (_, i) => ({ at: i / 19, x: i / 4 }))).length, 12);
  assert.equal(normalizeKeyframes([{ at: 0 }, { at: 0.4, x: 1 }]).at(-1).at, 1, "the last keyframe always ends the motion");
});

test("the path passes exactly through every keyframe, with every channel", () => {
  for (const [q, k] of [[0, kfs[0]], [0.5, kfs[1]], [1, kfs[2]]]) {
    const s = samplePath(kfs, q);
    for (const key of ["x", "y", "rotation", "scale", "alpha"]) near(s[key], k[key], `${key} at ${q}`);
  }
});

test("between keyframes the curve is smooth, and a sharp corner makes it straight", () => {
  const smooth = samplePath(kfs, 0.25);
  assert.ok(Math.abs(smooth.y - 0.5) > 1e-3, "a smooth curve bows away from the straight line");
  const sharp = normalizeKeyframes(kfs.map((k, i) => (i === 1 ? { ...k, sharp: true } : k)));
  const s = samplePath(sharp, 0.25);
  near(s.x, 0.5, "straight x"); near(s.y, 0.5, "straight y");
});

test("duplicate times: the path still ends on its true last point", () => {
  const dup = normalizeKeyframes([{ at: 0 }, { at: 1, x: 3 }, { at: 1, x: 5 }]);
  assert.equal(samplePath(dup, 1).x, 5);
  assert.equal(samplePath(dup, 1).x, pathEnd(dup).x);
});

test("keyframes default to linear speed; a stored ease is kept", () => {
  assert.ok(DEFAULT_KEYFRAMES.every((k) => k.ease === "linear"), "the default shove");
  const n = normalizeKeyframes([{ at: 0 }, { at: 0.5, x: 1 }, { at: 1, x: 2, ease: "easeOutCubic" }]);
  assert.deepEqual(n.map((k) => k.ease), ["linear", "linear", "easeOutCubic"]);
  near(samplePath(normalizeKeyframes([{ at: 0 }, { at: 1, x: 1 }]), 0.25).x, 0.25, "linear by default");
  assert.equal(insertKeyframe(kfs, 0.25)[1].ease, "linear", "an inserted keyframe is linear");
});

test("smoothKeyframes makes every keyframe linear and leaves an already smooth path alone", () => {
  const eased = normalizeKeyframes([{ at: 0 }, { at: 0.4, x: 1, ease: "easeInQuad", sharp: true }, { at: 1, x: 3, ease: "easeOutBack", rotation: 90 }]);
  const before = structuredClone(eased), smooth = smoothKeyframes(eased);
  assert.deepEqual(smooth.map((k) => k.ease), ["linear", "linear", "linear"]);
  assert.deepEqual(smooth.map((k) => [k.at, k.x, k.rotation, k.sharp]), eased.map((k) => [k.at, k.x, k.rotation, k.sharp]), "only the eases change");
  assert.deepEqual(eased, before, "not mutated");
  assert.equal(smoothKeyframes(smooth), smooth, "nothing to change: the same array");
});

test("each segment's easing shapes the speed into its keyframe", () => {
  const eased = normalizeKeyframes([{ at: 0 }, { at: 1, x: 1, ease: "easeInQuad" }]);
  near(samplePath(eased, 0.5).x, 0.25, "ease-in covers a quarter by half time");
});

test("end, squares and frame rotation", () => {
  assert.deepEqual(pathEnd(kfs), { x: 2, y: 0 });
  assert.equal(pathSquares(normalizeKeyframes([{ at: 0 }, { at: 1, x: 2.6, y: -1 }])), 3);
  assert.equal(pathSquares(normalizeKeyframes([{ at: 0 }, { at: 1, x: 0.3 }])), 0, "a small wobble stays in place");
  const down = { x: 0, y: 1 };
  assert.deepEqual(rotateBy({ x: 2, y: 0 }, down), { x: 0, y: 2 });
  const back = unrotateBy(rotateBy({ x: 1.5, y: -0.5 }, { x: 0.6, y: 0.8 }), { x: 0.6, y: 0.8 });
  near(back.x, 1.5, "x"); near(back.y, -0.5, "y");
});

test("editor helpers: insert from the curve, move time within neighbours, snap points, keep the ends", () => {
  const added = insertKeyframe(kfs, 0.25);
  assert.equal(added.length, 4);
  const s = samplePath(kfs, 0.25);
  near(added[1].x, s.x, "inserted on the curve");
  assert.equal(insertKeyframe(kfs, 0.5), kfs, "no duplicate keyframe at the same time");
  assert.equal(moveKeyframeTime(kfs, 1, 0.9)[1].at, 0.9);
  assert.equal(moveKeyframeTime(kfs, 1, 1.5)[1].at, 0.99, "clamped below the next keyframe");
  assert.equal(moveKeyframeTime(kfs, 1, -1)[1].at, 0.01);
  assert.equal(moveKeyframeTime(kfs, 0, 0.5), kfs, "the start is fixed");
  assert.equal(moveKeyframeTime(kfs, 2, 0.5), kfs, "the end is fixed");
  assert.deepEqual([snapSquares(1.13), snapSquares(1.13, true), snapSquares(-0.4)], [1.25, 1, -0.5]);
  const moved = moveKeyframePoint(kfs, 2, 2.9, 0.1);
  assert.deepEqual([moved[2].x, moved[2].y], [3, 0]);
  assert.equal(moveKeyframePoint(kfs, 0, 5, 5), kfs, "the start point is where the token stands");
  assert.equal(deleteKeyframe(kfs, 1).length, 2);
  assert.equal(deleteKeyframe(kfs, 0), kfs);
  assert.equal(deleteKeyframe(kfs, 2), kfs);
  assert.deepEqual(flipKeyframes(kfs).map((k) => k.y), [0, -1, 0]);
  assert.deepEqual(resetKeyframes(), DEFAULT_KEYFRAMES.map((k) => ({ ...k })));
});

test("the x/y clamp can be widened for a rotated finisher end, and defaults to 12", () => {
  assert.equal(normalizeKeyframes([{ at: 0 }, { at: 1, x: 16 }], { limit: 17 }).at(-1).x, 16);
  assert.equal(normalizeKeyframes([{ at: 0 }, { at: 1, x: 16 }]).at(-1).x, 12);
});

const line = (extra = {}) => normalizeKeyframes([{ at: 0, x: 0, y: 0 }, { at: 1, x: 6, y: 0, ease: "linear", ...extra }]);
test("cutPath ends a path where it first reaches the wall, at full speed", () => {
  const { keyframes, t } = cutPath(line(), 3);
  assert.ok(Math.abs(t - 0.5) < 1e-3, `t=${t}`);
  assert.ok(Math.abs(keyframes.at(-1).x - 3) < 1e-3);
  assert.equal(keyframes.at(-1).at, 1);
  assert.equal(keyframes.at(-1).ease, "linear", "no ease that would slow it to a stop at the wall");
  assert.equal(keyframes.at(-1).sharp, false);
});

test("cutPath lands the cut end upright: rotation to the nearest whole turn, full size and visible", () => {
  const { keyframes, t } = cutPath(line({ rotation: 720, scale: 1.5, alpha: 0.5 }), 1.8);
  assert.ok(Math.abs(samplePath(line({ rotation: 720 }), t).rotation - 216) < 1, "cut where it has turned about 216");
  assert.equal(keyframes.at(-1).rotation, 360);
  assert.deepEqual([keyframes.at(-1).scale, keyframes.at(-1).alpha], [1, 1]);
});

test("cutPath resamples the motion up to the wall evenly in time, every channel, with linear keyframes", () => {
  const k = normalizeKeyframes([{ at: 0, x: 0, y: 0 }, { at: 0.2, x: 1, y: 0, scale: 1.2 }, { at: 1, x: 6, y: 0, ease: "easeOutCubic" }]);
  const { keyframes, t } = cutPath(k, 3);
  assert.ok(keyframes.length >= 8 && keyframes.length <= MAX_KEYFRAMES, `${keyframes.length}`);
  assert.ok(keyframes.every((kf) => kf.ease === "linear" && kf.sharp === false));
  for (const kf of keyframes.slice(1, -1)) {
    const o = samplePath(k, kf.at * t);
    for (const key of ["x", "y", "rotation", "scale", "alpha", "stretch"]) near(kf[key], o[key], `${key} at ${kf.at}`);
  }
  const gaps = keyframes.slice(1).map((kf, i) => kf.at - keyframes[i].at);
  assert.ok(gaps.every((g) => Math.abs(g - gaps[0]) < 1e-9), "evenly spaced in time");
  assert.ok(Math.abs(Math.hypot(keyframes.at(-1).x, keyframes.at(-1).y) - 3) < 1e-3);
});

test("cutPath with a whole-path ease: searches the stage's own time and resamples the eased motion", () => {
  const k = normalizeKeyframes([{ at: 0 }, { at: 1, x: 6 }]);
  const { keyframes, t } = cutPath(k, 3, "easeOutCubic");
  near(t, 1 - Math.cbrt(0.5), "easeOutCubic reaches half way at 1 - cbrt(0.5)");
  for (const kf of keyframes.slice(1, -1)) near(kf.x, 6 * easeValue(kf.at * t, "easeOutCubic"), `x at ${kf.at}`);
  near(cutPath(k, 3).t, 0.5, "linear by default");
  assert.equal(cutPath(k, 7, "easeOutCubic").t, 1, "never reaches the wall: untouched");
});

test("cutPath of the Wall slam preset with its path ease: the same motion up to the wall, fast at impact, landing exactly", () => {
  const travel = finisherTravelPath(presetFinisher("wall-slam", "ws")), ease = travel.pathEase;
  assert.equal(ease, "easeOutCubic");
  const original = travel.keyframes, d = travel.duration, { keyframes, t } = cutPath(original, 3, ease), cutDuration = d * t;
  // The cut stage plays its keyframes with a linear whole-path ease over d * t.
  const cutAt = (ms) => samplePath(keyframes, ms / cutDuration), originalAt = (ms) => samplePath(original, easeValue(ms / d, ease));
  const times = [0.1, 0.25, 0.4, 0.55, 0.7, 0.85, 0.95].map((f) => f * cutDuration);
  for (const ms of times) {
    const a = cutAt(ms), b = originalAt(ms);
    assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < 0.1, `at ${Math.round(ms)} ms: cut ${a.x.toFixed(3)} vs original ${b.x.toFixed(3)}`);
  }
  const step = (at, from, to) => { const a = at(from), b = at(to); return Math.hypot(b.x - a.x, b.y - a.y); };
  const cutSpeed = step(cutAt, 0.95 * cutDuration, cutDuration), originalSpeed = step(originalAt, 0.95 * cutDuration, cutDuration);
  assert.ok(cutSpeed >= 0.5 * originalSpeed, `impact speed ${cutSpeed} vs ${originalSpeed}`);
  const end = keyframes.at(-1), hit = samplePath(original, easeValue(t, ease));
  assert.ok(Math.abs(Math.hypot(end.x, end.y) - 3) < 1e-3, "ends on the wall");
  near(end.x, hit.x, "x at impact"); near(end.y, hit.y, "y at impact");
  assert.deepEqual([end.at, end.rotation % 360, end.scale, end.alpha, end.stretch, end.ease], [1, 0, 1, 1, 0, "linear"], "upright landing");
  assert.ok(keyframes.length <= MAX_KEYFRAMES);
});

test("cutPath leaves a path that never reaches the wall untouched", () => {
  for (const reach of [6, 7]) {
    const k = line(), cut = cutPath(k, reach);
    assert.equal(cut.t, 1, `reach ${reach}`);
    assert.deepEqual(cut.keyframes, k);
  }
});

test("cutPath keeps the original motion up to the wall: same positions in time, still fast at impact", () => {
  // The Wall slam preset's path: it is still moving fast when a wall 3 squares out stops it.
  const original = normalizeKeyframes([{ at: 0, x: 0, y: 0 }, { at: 0.12, x: 0.5, y: 0, scale: 1.08 }, { at: 1, x: 6, y: 0, ease: "easeOutCubic" }]);
  const d = 1000, { keyframes, t } = cutPath(original, 3), cutDuration = d * t;
  const at = (k, q) => { const p = samplePath(k, q); return { x: p.x, y: p.y }; };
  for (const f of [0.2, 0.4, 0.6, 0.8, 0.95]) {
    const ms = f * cutDuration, a = at(keyframes, ms / cutDuration), b = at(original, ms / d);
    assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < 0.15, `at ${Math.round(ms)} ms: cut ${a.x.toFixed(3)} vs original ${b.x.toFixed(3)}`);
  }
  const step = (k, from, to) => { const a = at(k, from), b = at(k, to); return Math.hypot(b.x - a.x, b.y - a.y); };
  const cutSpeed = step(keyframes, 0.95, 1), originalSpeed = step(original, 0.95 * t, t);
  assert.ok(cutSpeed > 0.5 * originalSpeed, `impact speed ${cutSpeed} vs ${originalSpeed}`);
  assert.ok(keyframes.length <= MAX_KEYFRAMES);
});

test("cutPath resamples within the keyframe budget", () => {
  const many = normalizeKeyframes(Array.from({ length: 12 }, (_, i) => ({ at: i / 11, x: (i / 11) * 6, y: 0, ease: "linear" })));
  const { keyframes } = cutPath(many, 5.8);
  assert.ok(keyframes.length <= MAX_KEYFRAMES, `${keyframes.length}`);
  assert.ok(Math.abs(keyframes.at(-1).x - 5.8) < 1e-3);
});

test("stretch is clamped to -0.6..0.6, defaults to 0 and is 0 on the first keyframe", () => {
  const n = normalizeKeyframes([{ at: 0, stretch: 0.4 }, { at: 0.5, x: 1, stretch: 2 }, { at: 0.7, x: 2, stretch: -5 }, { at: 1, x: 3 }]);
  assert.deepEqual(n.map((k) => k.stretch), [0, 0.6, -0.6, 0]);
  assert.equal(normalizeKeyframes([{ at: 0 }, { at: 1, x: 1, stretch: "bogus" }]).at(-1).stretch, 0);
  assert.equal(DEFAULT_KEYFRAMES[1].stretch, 0);
});

test("samplePath interpolates stretch linearly, like scale", () => {
  const k = normalizeKeyframes([{ at: 0 }, { at: 0.5, x: 1, stretch: 0.4, ease: "linear" }, { at: 1, x: 2, stretch: 0, ease: "linear" }]);
  near(samplePath(k, 0.25).stretch, 0.2, "half way to the stretched keyframe");
  near(samplePath(k, 0.5).stretch, 0.4, "on it");
  near(samplePath(k, 0.75).stretch, 0.2, "half way back");
});

test("cutPath ends unstretched; resampled keyframes keep the sampled stretch", () => {
  const k = normalizeKeyframes([{ at: 0 }, { at: 0.2, x: 1, stretch: 0.1 }, { at: 1, x: 6, stretch: 0.3, ease: "linear" }]);
  const { keyframes, t } = cutPath(k, 3);
  assert.equal(keyframes.at(-1).stretch, 0);
  const inner = keyframes.at(-2);
  near(inner.stretch, samplePath(k, inner.at * t).stretch, "resampled from the original");
  assert.ok(inner.stretch > 0.1);
});

test("stretchScale stretches along the travel angle and squeezes across it", () => {
  const close = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg}: ${a} vs ${b}`);
  const flat = stretchScale(-0.3, 0);
  close(flat.scaleX, 0.7, "along x"); close(flat.scaleY, 1 / Math.sqrt(0.7), "across");
  const down = stretchScale(-0.3, Math.PI / 2);
  close(down.scaleX, flat.scaleY, "swapped x"); close(down.scaleY, flat.scaleX, "swapped y");
  const diag = stretchScale(0.4, Math.PI / 4);
  close(diag.scaleX, diag.scaleY, "diagonal");
  assert.deepEqual(stretchScale(0, 1.234), { scaleX: 1, scaleY: 1 });
  close(stretchScale(-5, 0).scaleX, 0.2, "never squashed below 0.2");
});

test("a travelling path ending stretched lands tilted", () => {
  assert.equal(landsTilted(normalizeKeyframes([{ at: 0 }, { at: 1, x: 3, stretch: 0.2 }])), true);
  assert.equal(landsTilted(normalizeKeyframes([{ at: 0 }, { at: 0.5, x: 1, stretch: 0.2 }, { at: 1, x: 3 }])), false, "only the end counts");
  assert.equal(landsTilted(normalizeKeyframes([{ at: 0 }, { at: 1, x: 0.3, stretch: 0.2 }])), false, "in place never lands");
});
