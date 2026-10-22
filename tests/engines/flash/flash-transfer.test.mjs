import test from "node:test";
import assert from "node:assert/strict";
import { validateFlash, validateFlashes, STARTER_FLASHES, untouchedStarter, flashesToExport, mergeFlashImport, dedupeFlashes, remapFlashDefaults } from "../../../scripts/engines/flash/flash-model.mjs";

// A world as it starts: every starter screen, saved once (their layers got ids then).
const world = () => validateFlashes(STARTER_FLASHES);
const customize = (s, name) => ({ ...structuredClone(s), name });

test("a starter nobody changed is untouched, whatever ids its layers got", () => {
  const [first] = world();
  assert.equal(untouchedStarter(first), true);
  assert.equal(untouchedStarter(validateFlash(STARTER_FLASHES[0])), true);
  assert.equal(untouchedStarter(customize(first, "Roll it!")), false);
  assert.equal(untouchedStarter(validateFlash({ id: "mine", name: "Mine" })), false);
  // A copy of a starter under another id is the GM's own.
  assert.equal(untouchedStarter({ ...first, id: "copy1" }), false);
});

test("export holds only the GM's own and customized screens", () => {
  const list = world();
  list[1] = customize(list[1], "BOSS!!");
  const mine = validateFlash({ id: "mine", name: "Mine" });
  const out = flashesToExport([...list, mine]);
  assert.deepEqual(out.map((s) => s.id), [list[1].id, "mine"]);
});

test("import overwrites the screen with the same id instead of adding a copy", () => {
  const list = world();
  const custom = customize(list[0], "Initiative, my way");
  const { screens, added, replaced } = mergeFlashImport(list, [custom]);
  assert.equal(screens.length, list.length);
  assert.equal(screens[0].name, "Initiative, my way");
  assert.equal(screens[0].id, list[0].id);
  assert.deepEqual([added, replaced], [0, 1]);
});

test("importing the same file twice adds nothing the second time", () => {
  const list = world();
  const file = [customize(list[2], "Face me"), validateFlash({ id: "mine", name: "Mine" })];
  const once = mergeFlashImport(list, file);
  const twice = mergeFlashImport(once.screens, file);
  assert.equal(once.added, 1);
  assert.equal(twice.screens.length, once.screens.length);
  assert.deepEqual(twice.screens, once.screens);
});

test("an old full export (every starter) brings no copies of starters", () => {
  const here = world(), there = world();
  there[3] = customize(there[3], "Swords out");
  const { screens, added, replaced } = mergeFlashImport(here, there);
  assert.equal(screens.length, here.length);
  assert.equal(screens[3].name, "Swords out");
  assert.equal(added, 0);
  assert.equal(replaced, 1, "unchanged starters are not counted as replaced");
});

test("a screen identical to one here but under another id is already here", () => {
  const list = [validateFlash({ id: "a", name: "Mine", layers: [{ kind: "text", text: "HI" }] })];
  const { screens, added } = mergeFlashImport(list, [{ ...list[0], id: "b" }]);
  assert.equal(screens.length, 1);
  assert.equal(added, 0);
});

test("import stops at the limit and says how many were skipped", () => {
  const list = [validateFlash({ id: "a", name: "A" })];
  const incoming = [validateFlash({ id: "b", name: "B" }), validateFlash({ id: "c", name: "C" })];
  const { screens, added, skipped } = mergeFlashImport(list, incoming, 2);
  assert.deepEqual(screens.map((s) => s.id), ["a", "b"]);
  assert.deepEqual([added, skipped], [1, 1]);
});

test("cleanup drops copies a 1.6.3 import made, keeping the first and pointing defaults at it", () => {
  const list = world();
  list[0] = customize(list[0], "Initiative, my way");
  // 1.6.3 gave every clashing id a fresh one: each screen came back a second time.
  const copies = list.map((s, i) => ({ ...structuredClone(s), id: `copy${i}`, layers: s.layers.map((l, j) => ({ ...l, id: `L${i}x${j}` })) }));
  const mine = validateFlash({ id: "mine", name: "Mine" });
  const { screens, removed } = dedupeFlashes([...list, ...copies, mine]);
  assert.deepEqual(screens.map((s) => s.id), [...list.map((s) => s.id), "mine"]);
  assert.equal(removed.size, list.length);
  assert.equal(removed.get("copy0"), list[0].id);
  const defaults = remapFlashDefaults({ start: "copy0", end: "none", initiated: ["copy1", list[1].id, "mine"], crit: "random" }, removed);
  assert.deepEqual(defaults, { start: list[0].id, end: "none", initiated: [list[1].id, "mine"], crit: "random" });
});

test("cleanup leaves different screens alone, even with the same name", () => {
  const a = validateFlash({ id: "a", name: "Boss" }), b = validateFlash({ id: "b", name: "Boss", duration: 5000 });
  const { screens, removed } = dedupeFlashes([a, b]);
  assert.equal(screens.length, 2);
  assert.equal(removed.size, 0);
});

test("the editor exports only own and customized screens and imports without copies", async () => {
  const { FlashEditor } = await import("../../../scripts/ui/flash-editor.mjs");
  let screens = world();
  screens[0] = customize(screens[0], "Initiative, my way");
  const downloads = [];
  let file = "";
  const host = { flashScreens: () => screens, saveFlashScreens: async (list) => { screens = validateFlashes(list); }, flashDefaults: () => ({}), flashFonts: () => [], flashVars: () => ({}),
    confirm: async () => true, downloadJSON: (data) => downloads.push(data), pickTextFile: async () => file };
  const w = { host, page: "flash", root: null, message: "", render() {} };
  const ed = new FlashEditor(w);
  await ed.action("flash-export", { dataset: {} });
  assert.deepEqual(downloads[0].screens.map((s) => s.name), ["Initiative, my way"]);
  assert.match(w.message, /Exported 1 flash screen\b/);
  // Back in a fresh world, twice.
  screens = world();
  file = JSON.stringify(downloads[0]);
  await ed.action("flash-import", { dataset: {} });
  await ed.action("flash-import", { dataset: {} });
  assert.equal(screens.length, STARTER_FLASHES.length);
  assert.equal(screens[0].name, "Initiative, my way");
});

test("a screen's tile can be deleted without opening it", async () => {
  const { FlashEditor } = await import("../../../scripts/ui/flash-editor.mjs");
  let screens = [validateFlash({ id: "a", name: "A" }), validateFlash({ id: "b", name: "B" })];
  const asked = [];
  const host = { flashScreens: () => screens, saveFlashScreens: async (list) => { screens = validateFlashes(list); }, flashDefaults: () => ({}), flashFonts: () => [], flashVars: () => ({}), confirm: async (t) => { asked.push(t); return true; } };
  const ed = new FlashEditor({ host, page: "flash", root: null, message: "", render() {} });
  ed.selectedId = "a";
  await ed.action("flash-delete", { dataset: { id: "b" } });
  assert.deepEqual(screens.map((s) => s.id), ["a"]);
  assert.match(asked[0], /“B”/);
  assert.equal(ed.selectedId, "a", "the open screen stays open");
  assert.match(ed.libraryHTML(), /data-action="flash-delete" data-id="a"/);
});
