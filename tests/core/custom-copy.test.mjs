import test from "node:test";
import assert from "node:assert/strict";
import { customCopy } from "../../scripts/core/custom-copy.mjs";
import { matchRecipe } from "../../scripts/core/model.mjs";
import { npcAbilityPreview, npcAbilityRecipe } from "../../scripts/catalogs/pf2e/npc-abilities.mjs";

const builtIn = () => npcAbilityPreview("fear", { motion: true });
const npcEvent = (built, uuid) => ({ type: built.trigger, systemId: "pf2e", item: { type: "action", name: built.name, uuid, actor: { type: "npc" }, system: { traits: { value: [] }, description: { value: "" } } }, actor: { type: "npc" } });

test("a copy keeps the built-in's stages under a new id, as a custom recipe", () => {
  const built = builtIn(), copy = customCopy(built, { id: "mine", names: [built.name], systemId: "pf2e" });
  assert.equal(copy.id, "mine");
  assert.equal(copy.category, "Custom");
  assert.equal(copy.trigger, built.trigger);
  assert.deepEqual(copy.stages.map((s) => s.kind), built.stages.map((s) => s.kind));
});

test("a copy for one creature plays for that creature's item and its unlinked tokens only", () => {
  const built = builtIn(), copy = customCopy(built, { id: "mine", names: [built.name], itemUuid: "Actor.serpent.Item.rattle", systemId: "pf2e" });
  assert.equal(matchRecipe([copy], npcEvent(built, "Actor.serpent.Item.rattle")), copy);
  assert.equal(matchRecipe([copy], npcEvent(built, "Scene.s.Token.t.Actor.serpent.Item.rattle")), copy);
  assert.equal(matchRecipe([copy], npcEvent(built, "Actor.other.Item.rattle")), null);
});

test("a copy for every creature plays by name, and wins over the built-in", () => {
  const built = builtIn(), copy = customCopy(built, { id: "mine", names: [`${built.name} (1/day)`], systemId: "pf2e" });
  assert.match(copy.match, new RegExp(built.name));
  assert.equal(npcAbilityRecipe(npcEvent(built, "Actor.any.Item.x"), [copy]), copy);
});

test("a blank copy keeps the binding and starts from one empty stage", () => {
  const built = builtIn(), copy = customCopy(built, { id: "mine", names: [built.name], itemUuid: "Actor.a.Item.b", blank: true });
  assert.equal(copy.itemUuid, "Actor.a.Item.b");
  assert.equal(copy.stages.length, 1);
  assert.deepEqual(copy.stages[0].assets, []);
});
