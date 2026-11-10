import test from "node:test";
import assert from "node:assert/strict";
import { LIGHT_WORDS, guessLight, lightsOfProp, hideLights, unhideLights } from "../../../scripts/engines/props/prop-lights.mjs";
import { propGuesses, propTraits } from "../../../scripts/engines/props/prop-traits.mjs";
import { guessMaterial } from "../../../scripts/engines/props/prop-material.mjs";

const rect = { x: 200, y: 200, width: 100, height: 100 };
const L = (id, x, y, extra = {}) => ({ id, x, y, hidden: false, levels: [], ...extra });

test("lights inside the prop grown by a quarter square, visible, same level", () => {
  const lights = [L("in", 290, 250), L("edge", 320, 250), L("out", 330, 250), L("hid", 250, 250, { hidden: true }), L("up", 250, 250, { levels: ["l2"] })];
  assert.deepEqual(lightsOfProp(rect, lights, 100, ["l1"]).map((l) => l.id), ["in", "edge"]);
});
test("light props by name; the GM can say yes or no", () => {
  for (const s of ["Brazier_Iron.webp", "Lantern_Hanging.webp", "Lamp_Oil.webp", "Candelabra.webp", "Torch_Wall.webp"]) assert.equal(propGuesses(s).light, true, s);
  assert.equal(propGuesses("Barrel_Wood.webp").light, false);
  assert.equal(guessMaterial("Lantern_A.webp"), "glass");
  assert.equal(guessMaterial("Lamp_A.webp"), "glass");
  assert.equal(guessMaterial("Candle_Stand.webp"), "metal");
  assert.equal(guessMaterial("Chandelier.webp"), "metal");
  assert.equal(guessMaterial("Torch_Wall.webp"), "wood");
  assert.equal(LIGHT_WORDS.length, 7);
  assert.equal(guessLight("props/Candelabra_Gold.webp"), true);
  const tile = (light) => ({ texture: { src: "Lantern.webp" }, width: 100, height: 100, flags: { animater: { prop: { light } } } });
  assert.equal(propTraits(tile(""), 100).light, true);
  assert.equal(propTraits(tile("no"), 100).light, false);
  const barrel = (light) => ({ texture: { src: "Barrel.webp" }, width: 100, height: 100, flags: { animater: { prop: { light } } } });
  assert.equal(propTraits(barrel("yes"), 100).light, true);
  assert.equal(propTraits(barrel("junk"), 100).light, false);
});
test("hide and unhide updates; unhide covers only existing hidden ids", () => {
  assert.deepEqual(hideLights([L("a", 0, 0), L("b", 0, 0)]), [{ _id: "a", hidden: true }, { _id: "b", hidden: true }]);
  const lights = [L("a", 0, 0, { hidden: true }), L("b", 0, 0), L("c", 0, 0, { hidden: true })];
  assert.deepEqual(unhideLights(["a", "b", "gone"], lights), [{ _id: "a", hidden: false }]);
});
