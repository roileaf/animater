import test from "node:test";
import assert from "node:assert/strict";
import { orbRecipe, ORB_ELEMENTS } from "../../scripts/catalogs/shared/orb-builder.mjs";
import { planRecipe, validateRecipe, parseImport } from "../../scripts/core/model.mjs";
import { sampleRecipe, timedStages } from "../../scripts/engines/playback/composition.mjs";
import {
  recipeFrame,
  recipeDuration,
  reorderStages,
} from "../../scripts/engines/playback/choreography.mjs";
import { applyEffectOptions } from "../../scripts/core/stage-options.mjs";
import { RecipePreview } from "../../scripts/engines/preview/recipe-preview.mjs";

const catalog = [{ key: "jb2a.impact.001.orange" }];
const source = { center: { x: 0, y: 0 } };
const targets = [{ center: { x: 300, y: 0 } }, { center: { x: 0, y: 1000 } }];

test("all six orb elements generate editable, importable native layers and edition fallbacks", () => {
  for (const element of Object.keys(ORB_ELEMENTS)) {
    const r = orbRecipe({ element }, `orb-${element}`, catalog);
    assert.equal(r.stages.length, 6);
    assert.equal(r.trigger, "manual");
    assert.equal(
      r.stages[0].clipStart,
      0,
      "shorter fallback does not inherit long aura opening skip",
    );
    assert.deepEqual(
      parseImport(JSON.stringify({ schema: 1, recipes: [r] }))[0],
      r,
    );
    assert.equal(
      planRecipe(r, catalog, { source, targets, gridSize: 100 }).length,
      9,
    );
  }
  const freeBlue = [
    { key: "jb2a.impact.001.blue" },
    { key: "jb2a.markers.light_orb.loop.blue" },
  ];
  const fire = orbRecipe({ element: "fire" }, "fire", freeBlue);
  assert.equal(fire.stages[2].hue, 140);
  assert.equal(fire.stages[3].hue, 140);
  assert.equal(fire.stages[5].hue, 140);
  assert.equal(
    orbRecipe({ element: "thunder" }, "thunder", freeBlue).stages[3].saturation,
    -1,
  );
});
test("distance resolves once per target; shell/core share jitter and impact follows their own arrival", () => {
  const r = orbRecipe(),
    original = structuredClone(r);
  let randomCalls = 0;
  const plan = planRecipe(r, catalog, {
    source,
    targets,
    gridSize: 100,
    random: () => {
      randomCalls++;
      return 0.75;
    },
  });
  for (const [i, duration] of [1100, 1800].entries()) {
    const shell = plan.find(
      (p) => p.stageId === "orb-shell" && p.targetIndex === i,
    );
    const core = plan.find(
      (p) => p.stageId === "orb-core" && p.targetIndex === i,
    );
    const impact = plan.find(
      (p) => p.stageId === "impact" && p.targetIndex === i,
    );
    assert.equal(shell.duration, duration);
    assert.equal(core.duration, duration);
    assert.equal(impact.delay, 1500 + duration - 100);
    assert.equal(shell.landing, core.landing);
    assert.equal(shell.landing, impact.landing);
    assert.deepEqual(shell.landing, {
      x: targets[i].center.x + 12.5,
      y: targets[i].center.y + 12.5,
    });
  }
  assert.equal(randomCalls, 4);
  assert.deepEqual(r, original);
  const frame = recipeFrame({ ...r, playbackPlan: plan }, 3100);
  assert.equal(frame.stages[3].state, "playing");
  assert.equal(frame.stages[3].targetIndex, 1);
  assert.equal(frame.stages[5].state, "playing");
  assert.equal(recipeDuration({ ...r, playbackPlan: plan }), 4100);
});
test("timing links survive reorder and reject cycles, missing references, duplicate IDs and invalid pause", () => {
  const r = orbRecipe();
  const reordered = { ...r, stages: reorderStages(r.stages, 5, 2) };
  const stages = timedStages(reordered, 5);
  const core = stages.find((s) => s.stageId === "orb-core");
  assert.equal(
    stages.find((s) => s.stageId === "impact").delay,
    core.delay + core.duration - 100,
  );
  const cycle = structuredClone(r);
  cycle.stages[4].afterStage = "impact";
  assert.throws(() => validateRecipe(cycle), /cycle/);
  const missing = structuredClone(r);
  missing.stages.pop();
  missing.stages[0].afterStage = "impact";
  assert.throws(() => validateRecipe(missing), /removed/);
  const duplicate = structuredClone(r);
  duplicate.stages[1].stageId = duplicate.stages[0].stageId;
  assert.throws(() => validateRecipe(duplicate), /unique/);
  const pause = structuredClone(r);
  pause.stages[3].moveDelay = 2000;
  assert.throws(() => validateRecipe(pause), /Launch pause/);
});
test("linked impacts inherit target flight stagger; a caster follow-up waits for latest target", () => {
  const r = orbRecipe();
  r.stages[4].targetStagger = 250;
  r.stages.push({
    ...r.stages[2],
    stageId: "finish",
    afterStage: "orb-core",
    startOffset: 0,
  });
  const plan = planRecipe(r, catalog, { source, targets, gridSize: 100 });
  assert.equal(
    plan.find((p) => p.stageId === "impact" && p.targetIndex === 1).delay,
    3450,
  );
  assert.equal(plan.find((p) => p.stageId === "finish").delay, 3550);
});
test("sample timeline is idempotent; new width/height tracks compile on sprite with grid units", () => {
  const r = orbRecipe({ flight: 2000, perSquare: 200 });
  const sample = sampleRecipe(r, 5);
  assert.equal(sample.stages[3].duration, 3000);
  assert.equal(recipeDuration(sample), 5300);
  assert.equal(recipeDuration(sampleRecipe(sample)), 5300);
  const calls = [];
  const effect = new Proxy(
    {},
    {
      get:
        (_, key) =>
        (...args) => {
          calls.push([key, ...args]);
          return effect;
        },
    },
  );
  applyEffectOptions(effect, r.stages[0]);
  const tracks = calls.filter((c) => c[0] === "animateProperty");
  assert.deepEqual(
    tracks.map((t) => [t[1], t[2], t[3].gridUnits, t[3].ease]),
    [
      ["sprite", "width", true, "easeOutCubic"],
      ["sprite", "height", true, "easeOutCubic"],
    ],
  );
});
test("full preview moves both orb layers together and highlights early impact overlap", () => {
  const r = orbRecipe();
  const artworks = [0, 1].map(() => ({ style: {} }));
  const layers = artworks.map((art, i) => ({
    dataset: { layerStage: String(i + 3) },
    hidden: true,
    style: { setProperty() {} },
    querySelector: () => art,
  }));
  const scene = {
    querySelectorAll: (q) => (q === "[data-layer-stage]" ? layers : []),
    dataset: {},
  };
  const player = new RecipePreview(scene, r, () => {});
  player.draw(recipeFrame(r, 2000));
  assert.equal(layers[0].style.left, "24%");
  player.draw(recipeFrame(r, 2599));
  assert.ok(parseFloat(layers[0].style.left) > 75);
  assert.equal(layers[0].style.left, layers[1].style.left);
  const frame = recipeFrame(r, 2550);
  assert.equal(frame.stages[3].state, "playing");
  assert.equal(frame.stages[5].state, "playing");
});
