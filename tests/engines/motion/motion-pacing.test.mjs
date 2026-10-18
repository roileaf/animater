import test from "node:test";
import assert from "node:assert/strict";
import { motionPose } from "../../../scripts/engines/motion/motion.mjs";
import { starterRecipes } from "../../../scripts/core/presets.mjs";
import {
  paceGeneratedMotion,
  GENERATED_MOTION_DURATION,
  shakeCycles,
} from "../../../scripts/engines/motion/motion-pacing.mjs";

test("native starter recipes use readable motion durations without pacing effects", () => {
  const recipes = starterRecipes();
  const stages = recipes
    .flatMap((r) => r.stages)
    .filter((s) => s.kind === "motion");
  for (const stage of stages)
    assert.ok(stage.duration >= GENERATED_MOTION_DURATION[stage.motion]);
  assert.equal(recipes.find((r) => r.id === "ember").stages[0].duration, 650);
});

test("short shakes stay below four cycles per second", () => {
  const duration = 380;
  let crossings = 0;
  let previous = 0;
  for (let i = 1; i < 1000; i++) {
    const x = motionPose({ motion: "shake", duration }, i / 1000).x;
    if (previous && Math.sign(x) !== Math.sign(previous)) crossings++;
    previous = x;
  }
  assert.ok(crossings <= 3, `${crossings} crossings in ${duration} ms`);
});

test("single gestures ease into and out of their restored pose", () => {
  for (const motion of ["lunge", "recoil", "levitate", "pulse"]) {
    const pose = motionPose({ motion }, 0.001);
    const velocity =
      Math.max(Math.abs(pose.x), Math.abs(pose.y), Math.abs(pose.scale - 1)) /
      0.001;
    assert.ok(velocity < 1, `${motion} starts at velocity ${velocity}`);
    const end = motionPose({ motion }, 0.999);
    assert.ok(
      Math.abs(end.x) < 0.001 &&
        Math.abs(end.y) < 0.001 &&
        Math.abs(end.scale - 1) < 0.001,
    );
  }
});

test("spin settles on complete turns rather than snapping from a fractional angle", () => {
  for (const intensity of [0.3, 0.6, 1, 1.5, 3]) {
    const pose = motionPose({ motion: "spin", intensity }, 0.999);
    const wrapped = Math.atan2(
      Math.sin(pose.rotation),
      Math.cos(pose.rotation),
    );
    assert.ok(
      Math.abs(wrapped) < 0.001,
      `intensity ${intensity}: ${wrapped} rad reset`,
    );
    const opening = motionPose({ motion: "spin", intensity }, 0.001);
    assert.ok(opening.rotation < 0.001);
  }
});

test("native defaults become readable while retaining reaction onset and lunge contact", () => {
  for (const [motion, minimum] of Object.entries(GENERATED_MOTION_DURATION)) {
    const stage = {
      kind: "motion",
      motion,
      duration: 400,
      delay: 900,
      intensity: 0.6,
      distance: 0.1,
    };
    const paced = paceGeneratedMotion(stage);
    assert.equal(paced.duration, minimum);
    assert.equal(stage.duration, 400, "input not mutated");
    assert.equal(paced.intensity, stage.intensity);
    assert.equal(paced.distance, stage.distance);
    if (motion === "lunge")
      assert.equal(
        paced.delay + paced.duration / 2,
        stage.delay + stage.duration / 2,
      );
    else assert.equal(paced.delay, stage.delay);
  }
  assert.equal(
    paceGeneratedMotion({
      kind: "motion",
      motion: "lunge",
      duration: 400,
      delay: 0,
    }).delay,
    0,
  );
});

test("long native motion and non-motion stages retain exact configured values", () => {
  for (const stage of [
    { kind: "motion", motion: "pulse", duration: 2100, delay: 100 },
    { kind: "impact", duration: 100, delay: 100 },
  ]) {
    assert.equal(paceGeneratedMotion(stage), stage);
  }
});

test("all shake durations cap cycle rate and preserve short user durations", () => {
  for (const duration of [100, 380, 550, 750, 1000, 1500, 30000]) {
    const stage = { motion: "shake", duration };
    assert.ok(shakeCycles(stage) / (duration / 1000) <= 4);
    motionPose(stage, 0.5);
    assert.equal(stage.duration, duration);
  }
});
