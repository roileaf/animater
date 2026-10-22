import test from "node:test";
import assert from "node:assert/strict";
import { starterRecipes, untouchedStarterRecipe, recipesToExport, importableRecipes } from "../../scripts/core/presets.mjs";
import { validateRecipe } from "../../scripts/core/model.mjs";

const mine = () => validateRecipe({ ...starterRecipes()[0], id: "mine", name: "My fireball" });

test("a starter recipe nobody changed is untouched; a changed one or a copy is not", () => {
  const [ember] = starterRecipes();
  assert.equal(untouchedStarterRecipe(ember), true);
  assert.equal(untouchedStarterRecipe({ ...ember, name: "Hotter ember" }), false);
  assert.equal(untouchedStarterRecipe({ ...ember, id: "ember-copy" }), false);
  assert.equal(untouchedStarterRecipe(mine()), false);
});

test("export holds only the GM's own and customized recipes", () => {
  const list = starterRecipes();
  list[1] = validateRecipe({ ...list[1], name: "Deep frost" });
  assert.deepEqual(recipesToExport([...list, mine()]).map((r) => r.id), ["frost", "mine"]);
});

test("import skips untouched starters, so an old full export cannot undo a customized one", () => {
  const file = [...starterRecipes(), mine()];
  assert.deepEqual(importableRecipes(file).map((r) => r.id), ["mine"]);
});

test("each page exports its own kind: recipes without finishers, finishers alone", () => {
  const finisher = validateRecipe({ ...starterRecipes()[7], id: "fin", name: "Head off", finisher: { ending: "collapse" } });
  assert.ok(finisher.finisher, "fixture is a finisher");
  const list = [...starterRecipes(), mine(), finisher];
  assert.deepEqual(recipesToExport(list).map((r) => r.id), ["mine"]);
  assert.deepEqual(recipesToExport(list, { finishers: true }).map((r) => r.id), ["fin"]);
});
