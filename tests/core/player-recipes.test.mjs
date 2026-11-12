import test from "node:test";
import assert from "node:assert/strict";
import { recipeHash, approvalState, validatePlayerRecipes, approvedPlayerRecipe, playerSubmissions, decide, PLAYER_RECIPE_LIMIT, PLAYER_ACCESS_LEVELS, normalizePlayerAccess, playerLibraryOpen, isPlayable } from "../../scripts/core/player-recipes.mjs";

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

test("player access levels: off, approval (default), free; anything else is approval", () => {
  assert.deepEqual(PLAYER_ACCESS_LEVELS, ["off", "approval", "free"]);
  assert.equal(normalizePlayerAccess(undefined), "approval");
  assert.equal(normalizePlayerAccess("bogus"), "approval");
  assert.equal(normalizePlayerAccess("free"), "free");
  assert.equal(playerLibraryOpen("off"), false);
  assert.equal(playerLibraryOpen("approval"), true);
  assert.equal(playerLibraryOpen("free"), true);
});

test("with no approval needed every recipe plays until the GM turns it off, and an edit does not undo that", () => {
  const r = recipe();
  assert.equal(approvalState(r, {}, "free"), "playing");
  let decisions = decide({}, "p1", r, "blocked");
  assert.equal(approvalState(r, decisions.p1, "free"), "blocked");
  const edited = recipe({ stages: [{ kind: "impact", assets: ["jb2a.impact.002.orange"] }] });
  assert.equal(approvalState(edited, decisions.p1, "free"), "blocked", "a small edit cannot get around Turn off");
  assert.equal(approvalState(edited, decisions.p1, "approval"), "declined", "turned off stays off when approval comes back");
  decisions = decide(decisions, "p1", r, null);
  assert.equal(approvalState(edited, decisions.p1, "free"), "playing");
  // A version the GM declined under approval stays off; a later edit plays.
  const declined = decide({}, "p1", r, "declined").p1;
  assert.equal(approvalState(r, declined, "free"), "blocked");
  assert.equal(approvalState(edited, declined, "free"), "playing");
});

test("access decides what plays: off plays nothing, free plays all but turned-off ones", () => {
  const r = recipe(), mine = { id: "a1" }, owns = (actor) => actor === mine;
  const event = { type: "template", item: { name: "Fireball", type: "spell", actor: mine }, actor: mine };
  const approved = decide({}, "p1", r, "approved").p1;
  assert.equal(approvedPlayerRecipe(event, [r], approved, { owns, access: "off" }), null);
  assert.equal(approvedPlayerRecipe(event, [r], {}, { owns, access: "free" })?.id, r.id);
  assert.equal(approvedPlayerRecipe(event, [r], decide({}, "p1", r, "blocked").p1, { owns, access: "free" }), null);
  assert.ok(isPlayable("approved") && isPlayable("playing") && !isPlayable("pending") && !isPlayable("blocked"));
});

test("the GM list at free shows turned-off recipes first, then playing ones", () => {
  const a = recipe({ id: "a", name: "A" }), b = recipe({ id: "b", name: "B" });
  const user = { id: "p1", name: "Mira", isGM: false, getFlag: () => ({ recipes: [a, b] }) };
  const rows = playerSubmissions([user], decide({}, "p1", b, "blocked"), "free");
  assert.deepEqual(rows.map((r) => [r.recipe.id, r.state]), [["b", "blocked"], ["a", "playing"]]);
});