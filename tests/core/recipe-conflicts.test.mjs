import test from "node:test";
import assert from "node:assert/strict";
import { recipeConflicts, unlinked } from "../../scripts/core/recipe-conflicts.mjs";

const recipe = (id, extra) => ({ id, name: id, enabled: true, trigger: "effect", match: "", ...extra });

test("two recipes linked to the same thing: one plays, the other says it is overridden", () => {
  const all = [recipe("b", { match: "Frightened" }), recipe("a", { match: "frightened, sickened" }), recipe("c", { match: "slowed" })];
  const notes = recipeConflicts(all);
  assert.equal(notes.get("a").plays, true);
  assert.equal(notes.get("b").plays, false);
  assert.equal(notes.get("b").winner.id, "a");
  assert.ok(!notes.has("c"));
  assert.ok(!recipeConflicts([all[0], { ...all[1], enabled: false }]).size, "disabled recipes do not compete");
  assert.ok(!recipeConflicts([all[0], { ...all[1], trigger: "use" }]).size, "different triggers do not compete");
});

test("a catalog copy beats a handmade lasting recipe for its condition, and a bound item beats a name", () => {
  const copy = recipe("z", { lifecycle: "document", stateEntry: "shield-id" });
  const handmade = recipe("a", { lifecycle: "document", match: "Spell Effect: Shield" });
  const notes = recipeConflicts([handmade, copy], { entryName: (id) => (id === "shield-id" ? "Spell Effect: Shield" : null) });
  assert.equal(notes.get("a").winner.id, "z");
  const bound = recipe("y", { trigger: "use", itemUuid: "Item.x" }), sameItem = recipe("b", { trigger: "use", itemUuid: "Item.x" });
  assert.equal(recipeConflicts([bound, sameItem]).get("y").winner.id, "b");
});

test("a triggered recipe with no names or item is not linked to anything", () => {
  assert.ok(unlinked(recipe("x")));
  assert.ok(!unlinked(recipe("x", { trigger: "manual" })));
  assert.ok(!unlinked(recipe("x", { match: "frightened" })));
  assert.ok(!unlinked(recipe("x", { stateEntry: "e" })));
});
