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

test("a tile's own walls never include a window", () => {
  const w = { id: "w", c: [110, 110, 190, 110], door: 0, move: 20, sight: 20, light: 20, sound: 20, flags: { animater: { breakWall: { window: true } } } };
  assert.deepEqual(ownWalls(tile, [w], 100), []);
  assert.deepEqual(ownWalls(tile, [w, wall("plain", [110, 150, 190, 150])], 100).map((x) => x.id), ["plain"]);
});

// Task 21 (D2): wreckage stops short of the first wall between the prop and where it lands.
import { blockingWalls, stopShort, wallStop } from "../../../scripts/engines/props/prop-walls.mjs";
const seg = (id, c, extra = {}) => ({ id, c, door: 0, ds: 0, move: 20, sight: 20, ...extra });

test("blockingWalls: move- or sight-blocking walls only, open doors and the prop's own walls left out", () => {
  const walls = [
    seg("solid", [0, 0, 100, 0]),
    seg("moveOnly", [0, 10, 100, 10], { sight: 0 }),
    seg("sightOnly", [0, 20, 100, 20], { move: 0 }),
    seg("open", [0, 30, 100, 30], { move: 0, sight: 0 }),
    seg("openDoor", [0, 40, 100, 40], { door: 1, ds: 1 }),
    seg("closedDoor", [0, 50, 100, 50], { door: 1, ds: 0 }),
    seg("lockedDoor", [0, 60, 100, 60], { door: 2, ds: 2 }),
    seg("own", [0, 70, 100, 70]),
  ];
  assert.deepEqual(blockingWalls(walls, ["own"]).map((w) => w.id), ["solid", "moveOnly", "sightOnly", "closedDoor", "lockedDoor"]);
  assert.deepEqual(blockingWalls(walls, new Set(["own", "solid"])).map((w) => w.id), ["moveOnly", "sightOnly", "closedDoor", "lockedDoor"]);
  assert.deepEqual(blockingWalls(undefined), []);
  assert.deepEqual(blockingWalls([{ id: "bad" }, seg("ok", [0, 0, 1, 1])]).map((w) => w.id), ["ok"]);
});

test("stopShort: a landing point past a wall comes back short of it along the throw", () => {
  const walls = [seg("north", [0, 300, 1000, 300])];
  const p = stopShort({ x: 500, y: 400 }, { x: 500, y: 200 }, walls, 6);
  assert.equal(p.x, 500);
  assert.ok(Math.abs(p.y - 306) < 1e-9, `y ${p.y}`);
  // a diagonal throw keeps its direction
  const q = stopShort({ x: 500, y: 400 }, { x: 700, y: 200 }, walls, 0);
  assert.ok(Math.abs(q.x - 600) < 1e-9 && Math.abs(q.y - 300) < 1e-9);
  // not blocked: unchanged (same object values)
  assert.deepEqual(stopShort({ x: 500, y: 400 }, { x: 520, y: 350 }, walls, 6), { x: 520, y: 350 });
  // the nearest of two walls wins
  const two = [seg("far", [0, 100, 1000, 100]), seg("near", [0, 250, 1000, 250])];
  assert.ok(Math.abs(stopShort({ x: 500, y: 400 }, { x: 500, y: 0 }, two, 5).y - 255) < 1e-9);
  // a wall the throw starts almost on stops it at the start, never behind it
  const r = stopShort({ x: 500, y: 302 }, { x: 500, y: 200 }, walls, 6);
  assert.deepEqual(r, { x: 500, y: 302 });
  // the wall's end is not passed: a throw just past its end flies on
  assert.deepEqual(stopShort({ x: 1010, y: 400 }, { x: 1010, y: 200 }, walls, 6), { x: 1010, y: 200 });
  // extra fields of the landing point are kept
  assert.deepEqual(stopShort({ x: 0, y: 0 }, { x: 5, y: 5, rot: 2 }, [], 6), { x: 5, y: 5, rot: 2 });
  assert.equal(stopShort({ x: 500, y: 400 }, { x: 500, y: 200, rot: 2 }, walls, 6).rot, 2);
});

test("wallStop: a clamp from one origin; null walls give the identity", () => {
  const stop = wallStop({ x: 500, y: 400 }, [seg("north", [0, 300, 1000, 300])], 6);
  assert.ok(Math.abs(stop({ x: 500, y: 100 }).y - 306) < 1e-9);
  assert.deepEqual(stop({ x: 450, y: 420 }), { x: 450, y: 420 });
  const none = wallStop({ x: 0, y: 0 }, [], 6);
  const p = { x: 9, y: 9 };
  assert.equal(none(p), p);
  // the share kept of the throw (for pieces whose flight is scaled)
  assert.ok(Math.abs(stop.share({ x: 500, y: 100 }) - (94 / 300)) < 1e-9);
  assert.equal(stop.share({ x: 450, y: 420 }), 1);
});
