import test from "node:test";
import assert from "node:assert/strict";
import { propTileFieldsHTML, propSceneFieldsHTML } from "../../scripts/ui/prop-config.mjs";

test("tile fields show the guess and keep the GM's choice", () => {
  const html = propTileFieldsHTML({ src: "Barrel_Wood_A.webp", material: "", contents: "wine" });
  assert.match(html, /Automatic \(wood\)/);
  assert.match(html, /name="flags\.animater\.prop\.material"/);
  assert.match(html, /<option value="wine" selected>/);
});
test("contents use the spec's words: Nothing ... Loose goods", () => {
  const html = propTileFieldsHTML({ src: "x.webp" }).split("prop.contents")[1];
  const labels = [...html.matchAll(/<option value="(none|water|wine|oil|grain|goods|books|potions)"[^>]*>([^<]*)</g)].map((m) => m[2]);
  assert.deepEqual(labels, ["Nothing", "Water", "Wine", "Oil", "Grain", "Loose goods", "Books", "Potions"]);
});
test("tile fields keep a chosen material and escape the file name", () => {
  const html = propTileFieldsHTML({ src: 'a"<b>.webp', material: "glass" });
  assert.match(html, /<option value="glass" selected>/);
  assert.match(html, /Won't break/);
  assert.doesNotMatch(html, /<b>/);
});
test("scene fields default to off and 25%", () => {
  const html = propSceneFieldsHTML({});
  assert.doesNotMatch(html, /breakableProps"[^>]*checked/);
  assert.match(html, /name="flags\.animater\.propMissChance"[^>]*value="25"/);
  assert.match(html, /data-action="animater-repair-props"/);
  assert.match(html, /type="button"/);
});
test("scene fields keep on and a chosen chance, including 0", () => {
  assert.match(propSceneFieldsHTML({ on: true, chance: 10 }), /breakableProps"[^>]*checked[\s\S]*value="10"/);
  assert.match(propSceneFieldsHTML({ chance: 0 }), /propMissChance"[^>]*value="0"/);
});
test("Breaks as shows the guess; contents guess and new kinds", () => {
  const html = propTileFieldsHTML({ src: "Bookshelf_A.webp" });
  assert.match(html, /name="flags\.animater\.prop\.style"/);
  assert.match(html, /<option value="" selected>Automatic \(collapse\)</);
  assert.match(html, /Automatic \(Books\)/);
  assert.match(html, /<option value="potions"[^>]*>Potions</);
});
test("Breaks as keeps the GM's pick and offers Shatter and Collapse", () => {
  const html = propTileFieldsHTML({ src: "Table.webp", style: "shatter" });
  assert.match(html, /<option value="shatter" selected>Shatter</);
  assert.match(html, /<option value="collapse">Collapse</);
  assert.match(html, /<label>Breaks as</);
});

import { wallBreakFieldsHTML } from "../../scripts/ui/prop-config.mjs";
test("door fieldset defaults: automatic, wood, Force Open on", () => {
  const html = wallBreakFieldsHTML({ door: 1 });
  assert.match(html, /<legend>Breakable<\/legend>/);
  assert.match(html, /data-animater-break-wall/);
  assert.match(html, /data-group="door"/);
  assert.match(html, /name="flags\.animater\.breakWall\.door"[\s\S]*<option value="" selected>Automatic/);
  assert.match(html, /<option value="wood" selected>Wood</);
  assert.match(html, /name="flags\.animater\.breakWall\.forceOpen"[^>]*checked/);
  assert.doesNotMatch(wallBreakFieldsHTML({ door: 1, own: { forceOpen: false } }), /forceOpen"[^>]*checked/);
  assert.match(wallBreakFieldsHTML({ door: 1, own: { door: "never", material: "stone" } }), /<option value="never" selected>Never[\s\S]*<option value="stone" selected>Stone/);
});
test("scene: Doors and windows break is on unless turned off", () => {
  assert.match(propSceneFieldsHTML({}), /name="flags\.animater\.breakWalls"[^>]*checked/);
  assert.match(propSceneFieldsHTML({}), /Doors and windows break/);
  assert.doesNotMatch(propSceneFieldsHTML({ breakWalls: false }), /breakWalls"[^>]*checked/);
});
test("window fieldset: off by default, glass by default", () => {
  const html = wallBreakFieldsHTML({ door: 0 });
  assert.doesNotMatch(html, /breakWall\.window"[^>]*checked/);
  assert.match(html, /data-group="window"[\s\S]*<option value="glass" selected>Glass</);
  assert.match(html, /<option value="none">Won't break</);
  // door 0 shows the window group and hides the door group; a door does the reverse
  assert.match(html, /data-group="door" hidden/);
  assert.doesNotMatch(html, /data-group="window" hidden/);
  assert.match(wallBreakFieldsHTML({ door: 1 }), /data-group="window" hidden/);
  assert.doesNotMatch(wallBreakFieldsHTML({ door: 1 }), /data-group="door" hidden/);
  assert.match(wallBreakFieldsHTML({ door: 0, own: { window: true, material: "none" } }), /breakWall\.window"[^>]*checked[\s\S]*<option value="none" selected>Won't break</);
});
test("window fieldset: the hidden group's material select is disabled so one name submits", () => {
  assert.match(wallBreakFieldsHTML({ door: 0 }), /data-group="door" hidden[\s\S]*?<select name="flags\.animater\.breakWall\.material" disabled>/);
  const doorShown = wallBreakFieldsHTML({ door: 1 });
  assert.match(doorShown, /data-group="window" hidden[\s\S]*?<select name="flags\.animater\.breakWall\.material" disabled>/);
  assert.equal((doorShown.match(/breakWall\.material" disabled/g) ?? []).length, 1);
  assert.equal((wallBreakFieldsHTML({ door: 0 }).match(/breakWall\.material" disabled/g) ?? []).length, 1);
});
