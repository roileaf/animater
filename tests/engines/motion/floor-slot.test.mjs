import { test } from "node:test";
import assert from "node:assert/strict";
import { floorSlot, shadowFloor } from "../../../scripts/engines/motion/floor-slot.mjs";

const map = { id: { kind: "map", levelId: "river" }, role: "floor", elevation: null };
const deck = { id: { kind: "tile", tileId: "deck" }, role: "floor", elevation: 0, sort: 0 };
const awning = { id: { kind: "tile", tileId: "awning" }, role: "overhead", elevation: 20, sort: 0 };

test("a map plane keeps 400, 405, and 410", () => {
  assert.equal(floorSlot(map, "floorTextures").sortLayer, 400);
  assert.equal(floorSlot(map, "floorShadows").sortLayer, 405);
  assert.equal(floorSlot(map, "floorLooks").sortLayer, 410);
  assert.equal(floorSlot(map, "floorTextures").sort, 0);
  assert.equal(floorSlot(map, "floorShadows").sort, 0);
  assert.equal(floorSlot(map, "floorLooks").sort, 0);
});

test("a floor tile draws just above that tile", () => {
  const onDeck = { elevation: 0, sortLayer: 500, sort: 1 };
  assert.deepEqual(floorSlot(deck, "floorTextures"), onDeck);
  assert.deepEqual(floorSlot(deck, "floorShadows"), onDeck);
  assert.deepEqual(floorSlot(deck, "floorLooks"), onDeck);
  assert.equal(floorSlot({ ...deck, sort: 4 }, "floorTextures").sort, 5);
  assert.equal(floorSlot({ ...deck, sort: 4 }, "floorShadows").sort, 5);
  assert.equal(floorSlot({ ...deck, sort: 4 }, "floorLooks").sort, 5);
});

test("an overhead plane is not a floor layer", () => {
  assert.equal(floorSlot(awning, "floorLooks"), null);
  assert.equal(floorSlot(awning, "floorTextures"), null);
  assert.equal(floorSlot(awning, "floorShadows"), null);
});

test("a shadow from an awning is seen on the deck below it", () => {
  const hull = { ...deck, meets: true };
  assert.equal(shadowFloor(awning.elevation, awning.id.tileId, [hull]), hull);
  assert.equal(shadowFloor(deck.elevation, deck.id.tileId, [hull]), null);
  assert.equal(shadowFloor(null, null, [hull]), null);
});
