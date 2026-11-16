import test from "node:test";
import assert from "node:assert/strict";
import { PANEL_OPENS, DOUBLE_MS, panelOpens, panelOpensMode, panelPressMemory } from "../../../scripts/engines/regions/panel-gesture.mjs";

const press = (over = {}) => ({ quick: true, shift: false, x: 100, y: 100, at: 1000, ...over });

test("a plain right-click opens the panel, as it always did", () => {
  assert.equal(panelOpens("right", press()), true);
  assert.equal(panelOpens(undefined, press()), true, "an unset choice is the old behaviour");
  assert.equal(panelOpensMode("nonsense"), "right");
  assert.deepEqual(Object.keys(PANEL_OPENS), ["right", "shift", "double", "sheet"]);
});

test("panning never opens it, whatever the choice", () => {
  for (const how of Object.keys(PANEL_OPENS)) assert.equal(panelOpens(how, press({ quick: false })), false, how);
});

test("Shift waits for the Shift", () => {
  assert.equal(panelOpens("shift", press()), false);
  assert.equal(panelOpens("shift", press({ shift: true })), true);
  assert.equal(panelOpens("right", press({ shift: true })), true, "Shift does not stop the plain one");
});

test("a double needs a second click, soon and near", () => {
  const first = press();
  assert.equal(panelOpens("double", first), false, "the first of a pair opens nothing");
  const last = panelPressMemory(first, false);
  assert.deepEqual(last, { x: 100, y: 100, at: 1000 });
  assert.equal(panelOpens("double", press({ at: 1000 + DOUBLE_MS }), last), true);
  assert.equal(panelOpens("double", press({ at: 1001 + DOUBLE_MS }), last), false, "too slow");
  assert.equal(panelOpens("double", press({ at: 1100, x: 140 }), last), false, "too far");
  assert.equal(panelOpens("double", press({ at: 1100 }), null), false, "nothing to pair with");
});

test("a double that opened starts afresh, so a third click does not open it again", () => {
  assert.equal(panelPressMemory(press(), true), null);
  assert.equal(panelPressMemory(press({ quick: false }), false), null, "a pan is not half of a double");
});

test("the sheet-only choice opens nothing on the map", () => {
  assert.equal(panelOpens("sheet", press()), false);
  assert.equal(panelOpens("sheet", press({ shift: true })), false);
  assert.equal(panelOpens("sheet", null), false);
});

test("a press we know nothing about is taken as a right-click, but never as a double", () => {
  assert.equal(panelOpens("right", null), true);
  assert.equal(panelOpens("shift", null), true);
  assert.equal(panelOpens("double", null), false);
});
