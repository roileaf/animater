import test from "node:test";
import assert from "node:assert/strict";
import { recipeHash, approvalState, validatePlayerRecipes, approvedPlayerRecipe, playerSubmissions, decide, PLAYER_RECIPE_LIMIT } from "../../scripts/core/player-recipes.mjs";

const recipe = (extra = {}) => ({ id: "fireball-mine", name: "My Fireball", enabled: true, trigger: "template", match: "Fireball", stages: [{ kind: "impact", assets: ["jb2a.impact.001.orange"] }], ...extra });

test("a GM decision covers one exact version: any edit is pending again", () => {
  const r = recipe();
  assert.equal(approvalState(r, {}), "pending");
  let decisions = decide({}, "p1", r, "approved");
  assert.equal(approvalState(r, decisions.p1), "approved");
  // Toggling enabled is not a content change.
  assert.equal(approvalState({ ...r, enabled: false }, decisions.p1), "approved");
  const edited = recipe({ stages: [{ kind: "impact", assets: ["jb2a.impact.002.orange"] }] });
  assert.notEqual(recipeHash(edited), recipeHash(r));
  assert.equal(approvalState(edited, decisions.p1), "pending");
  decisions = decide(decisions, "p1", r, "declined");
  assert.equal(approvalState(r, decisions.p1), "declined");
  decisions = decide(decisions, "p1", r, null);
  assert.equal(approvalState(r, decisions.p1), "pending");
});

test("only approved recipes for the player's own characters play", () => {
  const r = recipe(), decisions = decide({}, "p1", r, "approved").p1;
  const mine = { id: "a1" }, theirs = { id: "a2" };
  const owns = (actor) => actor === mine;
  const event = (actor) => ({ type: "template", item: { name: "Fireball", type: "spell", actor }, actor });
  assert.equal(approvedPlayerRecipe(event(mine), [r], decisions, { owns })?.id, r.id);
  assert.equal(approvedPlayerRecipe(event(theirs), [r], decisions, { owns }), null, "never another player's character");
  assert.equal(approvedPlayerRecipe(event(mine), [r], {}, { owns }), null, "pending recipes do not play");
});

test("player recipes are validated, unique and limited; document layers stay GM-made", () => {
  const valid = validatePlayerRecipes([recipe({ lifecycle: "document" })]);
  assert.notEqual(valid[0].lifecycle, "document");
  assert.throws(() => validatePlayerRecipes([recipe(), recipe()]), /unique/);
  assert.throws(() => validatePlayerRecipes(Array.from({ length: PLAYER_RECIPE_LIMIT + 1 }, (_, i) => recipe({ id: `r${i}` }))), /Maximum/);
});

test("the GM review list shows every player's recipes, pending first", () => {
  const a = recipe({ id: "a", name: "Alpha" }), b = recipe({ id: "b", name: "Beta" });
  const user = (id, name, recipes, isGM = false) => ({ id, name, isGM, getFlag: () => ({ recipes }) });
  const rows = playerSubmissions([user("gm", "GM", [a], true), user("p1", "Pat", [a, b])], decide({}, "p1", a, "approved"));
  assert.deepEqual(rows.map((r) => [r.userName, r.recipe.id, r.state]), [["Pat", "b", "pending"], ["Pat", "a", "approved"]]);
});
