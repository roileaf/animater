import test from "node:test";
import assert from "node:assert/strict";
import {
  reorderStages,
  recipeFrame,
  recipeDuration,
  RecipeClock,
} from "../../../scripts/engines/playback/choreography.mjs";

const recipe = {
  stages: [
    { kind: "cast", delay: 0, duration: 650, assets: ["cast"] },
    { kind: "travel", delay: 180, duration: 900, assets: ["travel"] },
    { kind: "impact", delay: 950, duration: 800, assets: ["impact"] },
  ],
};

test("reordering changes chronological playback while preserving slots, stage settings and saved input", () => {
  const original = structuredClone(recipe.stages);
  const stages = reorderStages(recipe.stages, 2, 0);
  assert.deepEqual(
    stages.map((s) => s.kind),
    ["impact", "cast", "travel"],
  );
  assert.deepEqual(
    stages.map((s) => s.delay),
    [0, 180, 950],
  );
  assert.deepEqual(
    stages.map((s) => s.duration),
    [800, 650, 900],
  );
  assert.deepEqual(stages[0].assets, ["impact"]);
  assert.deepEqual(recipe.stages, original);
  assert.throws(() => reorderStages(original, -1, 2), /valid stage/);
  assert.throws(() => reorderStages(original, 0, 3), /valid stage/);
});

test("simultaneous slots and gaps survive reordering, including manually unordered starts", () => {
  const stages = [
    { delay: 1000, duration: 200 },
    { delay: 0, duration: 300 },
    { delay: 0, duration: 400 },
  ];
  assert.deepEqual(
    reorderStages(stages, 0, 2).map((s) => s.delay),
    [0, 0, 1000],
  );
});

test("full recipe frames highlight overlapping stages, gaps and exact completion boundaries", () => {
  assert.equal(recipeDuration(recipe), 1750);
  assert.deepEqual(
    recipeFrame(recipe, 180).stages.map((s) => s.state),
    ["playing", "playing", "pending"],
  );
  assert.deepEqual(
    recipeFrame(recipe, 650).stages.map((s) => s.state),
    ["done", "playing", "pending"],
  );
  assert.deepEqual(
    recipeFrame(recipe, 1000).stages.map((s) => s.state),
    ["done", "playing", "playing"],
  );
  assert.deepEqual(
    recipeFrame(recipe, 1800).stages.map((s) => s.state),
    ["done", "done", "done"],
  );
  assert.equal(recipeFrame(recipe, 1800).time, 1750);
  assert.equal(recipeFrame(recipe, 1800).complete, true);
  assert.deepEqual(
    recipeFrame({ stages: [{ delay: 500, duration: 100 }] }, 250).stages.map(
      (s) => s.state,
    ),
    ["pending"],
  );
});

test("recipe clock stops without late highlights and replay starts at zero", async () => {
  let next,
    handle = 0;
  const cancelled = [];
  const clock = new RecipeClock({
    now: () => 100,
    frame: (cb) => {
      next = cb;
      return ++handle;
    },
    cancel: (id) => cancelled.push(id),
  });
  const frames = [];
  const first = clock.play(recipe, (f) => frames.push(f));
  next(1100);
  assert.deepEqual(
    frames.at(-1).stages.map((s) => s.state),
    ["done", "playing", "playing"],
  );
  const stale = next;
  clock.stop();
  assert.equal(await first, false);
  const count = frames.length;
  stale(1850);
  assert.equal(frames.length, count);
  const replay = clock.play(recipe, (f) => frames.push(f));
  assert.equal(frames.at(-1).time, 0);
  next(1850);
  assert.equal(await replay, true);
  assert.equal(frames.at(-1).complete, true);
  assert.equal(cancelled.length, 1);
});
