import test from "node:test";
import assert from "node:assert/strict";
import { Workspace } from "../../scripts/ui/workspace.mjs";
import { validateRecipe } from "../../scripts/core/model.mjs";

const area = { kind: "template", stageId: "a", label: "Drift", assets: ["jb2a.ice_spikes.radial.burst.blue"], duration: 2000 };

test("an area stage can be told to stay while its template is placed", () => {
  const w = Object.create(Workspace.prototype);
  const recipe = { stages: [area] };
  const off = w.stageTypeHTML(recipe, area, 0, false, null);
  assert.match(off, /data-field="persist" data-index="0"/, "the tick is offered on an area stage");
  assert.doesNotMatch(off, /data-field="persist" data-index="0" checked/);
  assert.match(off, /Stay while placed/);
  assert.match(off, /for as long as its template stands/);
  const on = w.stageTypeHTML(recipe, { ...area, persist: true }, 0, false, null);
  assert.match(on, /data-field="persist" data-index="0" checked/);
  assert.match(on, /for as long as its measured template does/);
});

test("a stage that follows a catalog entry is not the GM's to keep on the map", () => {
  const w = Object.create(Workspace.prototype);
  assert.doesNotMatch(w.stageTypeHTML({ stages: [area] }, area, 0, true, null), /data-field="persist"/);
});

test("the tick survives saving the recipe", () => {
  const saved = validateRecipe({ id: "drift", name: "Snow drift", trigger: "template", stages: [{ ...area, persist: true }] });
  assert.equal(saved.stages[0].persist, true);
  const plain = validateRecipe({ id: "drift", name: "Snow drift", trigger: "template", stages: [area] });
  assert.equal(plain.stages[0].persist, false);
});
