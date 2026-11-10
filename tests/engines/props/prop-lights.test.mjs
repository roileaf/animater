import test from "node:test";
import assert from "node:assert/strict";
import { LIGHT_WORDS, guessLight, lightsOfProp, hideLights, unhideLights, BURN_MS, oilCatches, burnLightData, staleFires, firesOf } from "../../../scripts/engines/props/prop-lights.mjs";
import { repairUpdates, undoUpdates } from "../../../scripts/engines/props/prop-requests.mjs";
import { propGuesses, propTraits } from "../../../scripts/engines/props/prop-traits.mjs";
import { guessMaterial } from "../../../scripts/engines/props/prop-material.mjs";

const rect = { x: 200, y: 200, width: 100, height: 100 };
const L = (id, x, y, extra = {}) => ({ id, x, y, hidden: false, levels: [], ...extra });

test("lights inside the prop grown by a quarter square, visible, same level", () => {
  const lights = [L("in", 290, 250), L("edge", 320, 250), L("out", 330, 250), L("hid", 250, 250, { hidden: true }), L("up", 250, 250, { levels: ["l2"] })];
  assert.deepEqual(lightsOfProp(rect, lights, 100, ["l1"]).map((l) => l.id), ["in", "edge"]);
  // a neighbour's burning oil is never this prop's light
  assert.deepEqual(lightsOfProp(rect, [L("fire", 250, 250, { flags: { animater: { propFire: { tileId: "t9", until: 1 } } } })], 100, []), []);
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

// Burning lamp oil (Task 10)
test("lamp oil catches from fire, or when the lamp was lit", () => {
  assert.equal(oilCatches({ contents: "lampoil", damageType: "bludgeoning", lights: ["l1"] }), true);
  assert.equal(oilCatches({ contents: "lampoil", damageType: "fire", lights: [] }), true);
  assert.equal(oilCatches({ contents: "lampoil", damageType: "bludgeoning", lights: [] }), false);
  assert.equal(oilCatches({ contents: "oil", damageType: "fire", lights: [] }), false);
  assert.equal(oilCatches({ contents: "lampoil" }), false);
});
test("the burning patch's light: a minute, the fire-pot loop, no second flame", () => {
  assert.equal(BURN_MS, 60000);
  const d = burnLightData({ centre: { x: 250, y: 250 }, distance: 5, levels: ["l1"], elevation: 0, tileId: "t1", now: 1000 });
  assert.deepEqual(d.flags.animater, { propFire: { tileId: "t1", until: 61000 }, flame: false, fireKind: "pot", fireSound: true, smoke: true });
  assert.equal(d.config.animation.type, "fire");
  assert.deepEqual([d.x, d.y, d.levels], [250, 250, ["l1"]]);
  assert.deepEqual(d.config, { bright: 2.5, dim: 7.5, color: "#ff9a40", alpha: 0.5, animation: { type: "fire", speed: 5, intensity: 5 } });
  assert.equal(d.elevation, 0);
});
test("fire lights left past their time are swept; Repair deletes every one", () => {
  // Review Focus 3
  const f = (id, until, tileId = "t1") => ({ id, flags: { animater: { propFire: { tileId, until } } } });
  assert.deepEqual(staleFires([f("a", 500), f("b", 5000), { id: "c", flags: {} }], 1000), ["a"]);
  assert.deepEqual(staleFires([f("a", 1000)], 1000), ["a"], "exactly at its time it goes");
  assert.deepEqual(staleFires([{ id: "x" }, null], 1000), []);
  assert.deepEqual(firesOf("t1", [f("a", 1), f("b", 1, "t2")]), ["a"]);
  assert.deepEqual(repairUpdates([], [], { lights: [f("a", 1), f("b", 1, "t2"), { id: "lamp", flags: {} }] }).deleteLights, ["a", "b"]);
  assert.deepEqual(repairUpdates([], []).deleteLights, []);
  // undo deletes only its own tile's fire
  const tile = { id: "t1", x: 0, y: 0, width: 100, height: 100, hidden: true, flags: { animater: { prop: { broken: { seed: 1, cutAngle: 0, pattern: "shards", pieces: 10, spread: 0.3, spin: 100, tint: "none", mark: "scorch", from: { x: 0, y: 0 }, walls: [], fire: true } } } } };
  assert.deepEqual(undoUpdates(tile, [], { lights: [f("a", 1), f("b", 1, "t2")] }).deleteLights, ["a"]);
});
