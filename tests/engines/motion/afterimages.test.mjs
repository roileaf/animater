import test from "node:test";
import assert from "node:assert/strict";
import { trails, createTrailGate, ghostAlpha, streakLayout } from "../../../scripts/engines/motion/afterimages.mjs";

const G = 100;
const run = (gate, poses, rest = { x: 0, y: 0 }) => poses.reduce((n, p) => n + (gate.step(p, rest, 16, G) ? 1 : 0), 0);

test("only ground-covering motions trail; auto needs a square", () => {
  assert.equal(trails({ motion: "rush", distance: 3 }, G), true);
  assert.equal(trails({ motion: "rush", distance: 0.5 }, G), false);
  assert.equal(trails({ motion: "rush", distance: 0.5, afterimages: "always" }, G), true);
  assert.equal(trails({ motion: "lunge", afterimages: "always" }, G), false);
  assert.equal(trails({ motion: "leap", distance: 4, afterimages: "never" }, G), false);
});

test("travel comes from the kind: offset, path end, dodge distance", () => {
  assert.equal(trails({ kind: "motion", motion: "rush", distance: 8, motionEnd: "hold", motionOffset: { x: 0.5, y: 0 } }, G), false);
  assert.equal(trails({ kind: "motion", motion: "rush", distance: 0.2, motionOffset: { x: 2, y: 1 } }, G), true);
  const kf = (x, y) => [{ at: 0, x: 0, y: 0 }, { at: 1, x, y }];
  assert.equal(trails({ motion: "path", keyframes: kf(2, 0) }, G), true);
  assert.equal(trails({ motion: "path", keyframes: kf(0.5, 0.5) }, G), false);
  assert.equal(trails({ motion: "path", keyframes: kf(0.5, 0.5), afterimages: "always" }, G), true);
  assert.equal(trails({ motion: "path" }, G), false);
  assert.equal(trails({ motion: "dodge", distance: 1 }, G), true);
  assert.equal(trails({ motion: "dodge", distance: 0.6 }, G), false);
  assert.equal(trails({ motion: "fade", afterimages: "always" }, G), false);
});

test("gate drops a ghost every 0.4 squares while fast and outbound", () => {
  const g = createTrailGate();
  const poses = Array.from({ length: 20 }, (_, i) => ({ x: (i + 1) * 10, y: 0 }));
  assert.equal(run(g, poses), 5);
});

test("return leg drops nothing", () => {
  const g = createTrailGate();
  g.step({ x: 200, y: 0 }, { x: 0, y: 0 }, 16, G);
  const back = Array.from({ length: 20 }, (_, i) => ({ x: 190 - i * 10, y: 0 }));
  assert.equal(run(g, back), 0);
});

test("slow drift drops nothing", () => {
  const g = createTrailGate();
  const poses = Array.from({ length: 200 }, (_, i) => ({ x: i + 1, y: 0 }));
  assert.equal(run(g, poses), 0);
});

test("ghost alpha and streak layout", () => {
  assert.equal(ghostAlpha(0), 0.4);
  assert.equal(ghostAlpha(175), 0.2);
  assert.equal(ghostAlpha(400), 0);
  assert.deepEqual(streakLayout({ x: 0, y: 0 }, { x: 400, y: 0 }).map((p) => [p.x, p.delayMs]), [[0, 0], [100, 37.5], [200, 75], [300, 112.5], [400, 150]]);
});

test("minimum speed is in squares per second", () => {
  const at = (pxPerStep) => Array.from({ length: 40 }, (_, i) => ({ x: (i + 1) * pxPerStep, y: 0 }));
  assert.equal(run(createTrailGate(), at(4.8)), 0); // 3 squares/s
  assert.ok(run(createTrailGate(), at(9.6)) > 0); // 6 squares/s
});

test("remainder carries so fast motion keeps a 0.4 square pitch", () => {
  const poses = Array.from({ length: 10 }, (_, i) => ({ x: (i + 1) * 15, y: 0 })); // 1.5 squares total
  assert.equal(run(createTrailGate(), poses), 3);
});

test("a zero motionOffset is zero travel", () => {
  assert.equal(trails({ motion: "rush", distance: 8, motionOffset: { x: 0, y: 0 } }, G), false);
});
