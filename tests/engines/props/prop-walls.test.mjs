import test from "node:test";
import assert from "node:assert/strict";
import { ownWalls, openUpdates, restoreUpdates } from "../../../scripts/engines/props/prop-walls.mjs";

const tile = { x: 100, y: 100, width: 100, height: 100, rotation: 0 };
const wall = (id, c, extra = {}) => ({ id, c, door: 0, move: 20, sight: 20, light: 20, sound: 20, flags: {}, ...extra });

test("only non-door walls fully inside (with a quarter-square tolerance) belong", () => {
  const walls = [wall("in", [110, 110, 190, 110]), wall("edge", [80, 100, 220, 100]), wall("door", [110, 150, 190, 150], { door: 1 }), wall("out", [110, 110, 400, 110])];
  assert.deepEqual(ownWalls(tile, walls, 100).map((w) => w.id), ["in", "edge"]);
});

test("a rotated tile bounds its walls by the rotated rectangle (clockwise, y down)", () => {
  const t = { x: 100, y: 100, width: 200, height: 20, rotation: 30 };
  // centre (200,110); long axis runs along (cos30, sin30)
  const walls = [wall("along", [130.7, 70, 269.3, 150]), wall("mirrored", [130.7, 150, 269.3, 70])];
  assert.deepEqual(ownWalls(t, walls, 40).map((w) => w.id), ["along"]);
});

test("open stores the originals; restore puts them back and clears the flag", () => {
  const [u] = openUpdates([wall("a", [0, 0, 1, 1], { sight: 10 })]);
  assert.deepEqual(u, { _id: "a", move: 0, sight: 0, light: 0, sound: 0, "flags.animater.prop.restore": { move: 20, sight: 10, light: 20, sound: 20 } });
  const opened = wall("a", [0, 0, 1, 1], { move: 0, sight: 0, light: 0, sound: 0, flags: { animater: { prop: { restore: { move: 20, sight: 10, light: 20, sound: 20 } } } } });
  assert.deepEqual(restoreUpdates([opened, wall("b", [0, 0, 1, 1])]), [{ _id: "a", move: 20, sight: 10, light: 20, sound: 20, "flags.animater.prop.-=restore": null }]);
});

test("a wall that is already open produces no update, so its saved originals survive", () => {
  const opened = wall("a", [0, 0, 1, 1], { move: 0, sight: 0, light: 0, sound: 0, flags: { animater: { prop: { restore: { move: 20, sight: 10, light: 20, sound: 20 } } } } });
  assert.deepEqual(openUpdates([opened]), []);
  assert.equal(openUpdates([opened, wall("b", [0, 0, 1, 1])]).length, 1);
});
