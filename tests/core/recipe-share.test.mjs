import test from "node:test";
import assert from "node:assert/strict";
import { SHARE_PREFIX, encodeShareCode, decodeShareCodes, hasShareCode, shareMacro, mergeImported, copyPlainText } from "../../scripts/core/recipe-share.mjs";
import { parseImport, validateRecipe } from "../../scripts/core/model.mjs";
import { starterRecipes, planRecipeImport } from "../../scripts/core/presets.mjs";
import { Workspace } from "../../scripts/ui/workspace.mjs";

const mine = (id = "mine", name = "My fireball") => validateRecipe({ ...starterRecipes()[0], id, name });

test("a share code is the prefix and base64url of the recipe JSON, and decodes back", () => {
  const code = encodeShareCode([mine()]);
  assert.ok(code.startsWith("animater-recipe:1:"));
  assert.equal(SHARE_PREFIX, "animater-recipe:1:");
  assert.match(code.slice(SHARE_PREFIX.length), /^[A-Za-z0-9_-]+$/);
  assert.deepEqual(decodeShareCodes(code), [{ schema: 1, recipes: [mine()] }]);
});

test("non-ASCII recipe names survive the round trip", () => {
  const r = mine("uni", "Boule de feu ✨ 火球 — ünïcødé");
  const [data] = decodeShareCodes(encodeShareCode([r]));
  assert.equal(data.recipes[0].name, "Boule de feu ✨ 火球 — ünïcødé");
});

test("decode tolerates whitespace, line breaks and several codes in one paste", () => {
  const a = encodeShareCode([mine("a", "A")]), b = encodeShareCode([mine("b", "B")]);
  const wrapped = (c) => c.slice(0, 30) + "\n  " + c.slice(30, 60) + "\r\n" + c.slice(60);
  const text = `Here you go:\n${wrapped(a)}\n\nand also ${b}  `;
  assert.ok(hasShareCode(text));
  assert.deepEqual(decodeShareCodes(text).map((d) => d.recipes[0].id), ["a", "b"]);
  assert.equal(hasShareCode('{"schema":1,"recipes":[]}'), false);
});

test("a broken share code says so plainly", () => {
  assert.throws(() => decodeShareCodes("animater-recipe:1:%%%"), /share code/i);
  assert.throws(() => decodeShareCodes("animater-recipe:1:" + Buffer.from('{"schema":2,"recipes":[]}').toString("base64url")), /share code/i);
});

test("parseImport takes share codes as well as JSON; several codes combine, the later one winning an id", () => {
  assert.deepEqual(parseImport(encodeShareCode([mine()])).map((r) => r.id), ["mine"]);
  const text = [encodeShareCode([mine("a", "First")]), encodeShareCode([mine("a", "Second"), mine("b")])].join("\n");
  const parsed = parseImport(text);
  assert.deepEqual(parsed.map((r) => [r.id, r.name]), [["a", "Second"], ["b", "My fireball"]]);
  assert.deepEqual(parseImport(JSON.stringify({ schema: 1, recipes: [mine()] })).map((r) => r.id), ["mine"]);
});

test("the macro calls api.importRecipes with the recipe JSON and evaluates to the same data", async () => {
  const body = shareMacro([mine()]);
  assert.match(body, /game\.modules\.get\("animater"\)\.api\.importRecipes\(/);
  let got;
  const game = { modules: { get: (id) => (id === "animater" ? { api: { importRecipes: (d) => { got = d; } } } : null) } };
  // Foundry runs a script macro's body inside an async function.
  await new (Object.getPrototypeOf(async () => {}).constructor)("game", body)(game);
  assert.deepEqual(got, { schema: 1, recipes: [mine()] });
});

test("merge replaces by id, appends new ones, and keeps the 200 cap", () => {
  const old = [mine("a", "Old A"), mine("c")];
  const { recipes, added, replaced } = mergeImported(old, [mine("a", "New A"), mine("b")]);
  assert.deepEqual(recipes.map((r) => [r.id, r.name]), [["a", "New A"], ["c", "My fireball"], ["b", "My fireball"]]);
  assert.equal(added, 1); assert.equal(replaced, 1);
  const many = Array.from({ length: 200 }, (_, i) => mine(`m${i}`));
  assert.throws(() => mergeImported(many, [mine("extra")]), /Maximum 200 recipes/);
});

test("planRecipeImport accepts share codes, JSON text, an export object, a recipe array or a list of codes", () => {
  const old = [mine("a", "Old A")];
  const code = encodeShareCode([mine("a", "New A"), mine("b")]);
  const expect = (plan) => {
    assert.deepEqual(plan.recipes.map((r) => [r.id, r.name]), [["a", "New A"], ["b", "My fireball"]]);
    assert.deepEqual([plan.added, plan.replaced, plan.skipped], [1, 1, 0]);
  };
  expect(planRecipeImport(code, old));
  expect(planRecipeImport(JSON.stringify({ schema: 1, recipes: [mine("a", "New A"), mine("b")] }), old));
  expect(planRecipeImport({ schema: 1, recipes: [mine("a", "New A"), mine("b")] }, old));
  expect(planRecipeImport([mine("a", "New A"), mine("b")], old));
  expect(planRecipeImport([encodeShareCode([mine("a", "New A")]), encodeShareCode([mine("b")])], old));
});

test("planRecipeImport skips untouched starters and rejects anything that is not a recipe export", () => {
  const plan = planRecipeImport({ schema: 1, recipes: [starterRecipes()[0], mine()] }, []);
  assert.deepEqual(plan.recipes.map((r) => r.id), ["mine"]);
  assert.equal(plan.skipped, 1);
  assert.throws(() => planRecipeImport({ schema: 2, recipes: [] }, []), /schema 1/);
  assert.throws(() => planRecipeImport(42, []), /Expected/);
});

test("copyPlainText uses Foundry's clipboard, falling back to the browser's", async () => {
  const seen = [];
  await copyPlainText("x", { game: { clipboard: { copyPlainText: async (t) => seen.push(["foundry", t]) } }, navigator: { clipboard: { writeText: async (t) => seen.push(["nav", t]) } } });
  await copyPlainText("y", { game: {}, navigator: { clipboard: { writeText: async (t) => seen.push(["nav", t]) } } });
  assert.deepEqual(seen, [["foundry", "x"], ["nav", "y"]]);
  await assert.rejects(copyPlainText("z", { game: {}, navigator: {} }), /clipboard/i);
});

// The Recipes page's right-click menu: Copy share code and Copy as macro.
function workspace(saved) {
  const w = Object.create(Workspace.prototype);
  const copied = [];
  Object.assign(w, {
    page: "recipes", studio: false, selected: undefined, stageIndex: 0, studioTime: 0, busy: false, message: "",
    drafts: new Map(), dirty: new Set(), root: { querySelectorAll: () => [], querySelector: () => null },
  });
  w.host = { recipes: () => saved, copyText: async (t) => { copied.push(t); } };
  w.render = () => {};
  return { w, copied };
}
const click = (w, dataset) => w.onClick({ target: { closest: () => ({ dataset, disabled: false, closest: () => null }) }, preventDefault() {} });

test("right-click Copy share code copies that recipe's code", async () => {
  const { w, copied } = workspace([mine("a", "Alpha"), mine("b", "Beta")]);
  await click(w, { action: "recipe-menu-share", id: "b" });
  assert.equal(copied.length, 1);
  assert.deepEqual(parseImport(copied[0]).map((r) => r.name), ["Beta"]);
  assert.match(w.message, /copied/i);
});

test("right-click Copy as macro copies a macro that imports that recipe", async () => {
  const { w, copied } = workspace([mine("a", "Alpha")]);
  await click(w, { action: "recipe-menu-macro", id: "a" });
  assert.equal(copied.length, 1);
  assert.match(copied[0], /api\.importRecipes\(/);
  assert.match(copied[0], /"Alpha"/);
  assert.match(w.message, /copied/i);
});

test("the recipe card's right-click menu offers Copy share code and Copy as macro", async () => {
  const { studioContextMenu } = await import("../../scripts/ui/studio.mjs");
  const menus = [], saved = globalThis.document;
  globalThis.document = { createElement: () => ({ style: {}, setAttribute() {}, offsetParent: null, querySelector: () => null }) };
  Object.defineProperty(globalThis.document, "body", { value: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }) } });
  try {
    const card = { dataset: { id: "a" } };
    const w = { busy: false, listedRecipes: () => [mine("a")], host: { recipes: () => [] }, root: { querySelector: () => null, append: (m) => menus.push(m) } };
    studioContextMenu(w, { clientX: 1, clientY: 1, preventDefault() {}, target: { closest: (sel) => (sel.includes(".an-card") ? card : null) } });
    assert.match(menus[0].innerHTML, /data-action="recipe-menu-share" data-id="a">Copy share code</);
    assert.match(menus[0].innerHTML, /data-action="recipe-menu-macro" data-id="a">Copy as macro</);
  } finally { globalThis.document = saved; }
});
