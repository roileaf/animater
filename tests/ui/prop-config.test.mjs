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
  const labels = [...html.matchAll(/<option value="(none|water|wine|oil|grain|goods)"[^>]*>([^<]*)</g)].map((m) => m[2]);
  assert.deepEqual(labels, ["Nothing", "Water", "Wine", "Oil", "Grain", "Loose goods"]);
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
