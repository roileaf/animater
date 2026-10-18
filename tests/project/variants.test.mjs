import test from "node:test";
import assert from "node:assert/strict";
import { pickVariants, previewVariants, variantMembers } from "../../scripts/engines/playback/composition.mjs";
import { validateRecipe } from "../../scripts/core/model.mjs";

const recipe = validateRecipe({ id: "r", name: "R", trigger: "manual", stages: [
  { stageId: "a", kind: "cast", assets: ["jb2a.impact.001.orange"], scale: 0.6, variantGroup: "g1" },
  { stageId: "b", kind: "cast", assets: ["jb2a.impact.002.blue"], scale: 1.4, duration: 2000, variantGroup: "g1" },
  { stageId: "c", kind: "impact", assets: ["jb2a.impact.003.green"], afterStage: "a", timingAnchor: "end" },
] });

test("variants keep their own settings and one of them plays each time", () => {
  assert.equal(variantMembers(recipe.stages, "g1").length, 2);
  assert.deepEqual([recipe.stages[0].scale, recipe.stages[1].scale], [0.6, 1.4]);
  const first = pickVariants(recipe, () => 0.1), second = pickVariants(recipe, () => 0.9);
  assert.deepEqual(first.stages.map((s) => s.stageId), ["a", "c"]);
  assert.deepEqual(second.stages.map((s) => s.stageId), ["b", "c"]);
  assert.equal(second.stages[1].afterStage, "b", "a stage linked to a variant follows the one that played");
});

test("a lone group member is a normal stage; no groups leaves the recipe untouched", () => {
  const lone = validateRecipe({ ...recipe, stages: [recipe.stages[0], recipe.stages[2]] });
  assert.equal(pickVariants(lone).stages.length, 2);
  const plain = validateRecipe({ id: "p", name: "P", trigger: "manual", stages: [{ kind: "cast", assets: ["jb2a.impact.001.orange"] }] });
  assert.equal(pickVariants(plain), plain);
});

test("the Studio preview shows the selected variant and hides its siblings without moving stages", () => {
  const shown = previewVariants(recipe, 1);
  assert.equal(shown.stages.length, 3);
  assert.equal(shown.stages[0].opacity, 0);
  assert.equal(shown.stages[1].opacity, recipe.stages[1].opacity);
  assert.equal(previewVariants(recipe, 2).stages[1].opacity, 0, "not editing a variant: the first one shows");
});
