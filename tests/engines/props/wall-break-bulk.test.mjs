import test from "node:test";
import assert from "node:assert/strict";
import { isWindowWall, bulkBreakableUpdates } from "../../../scripts/engines/props/wall-break-bulk.mjs";

const wall = (id, extra = {}) => ({ id, door: 0, light: 20, sight: 20, flags: {}, ...extra });
const own = (animater) => ({ flags: { animater } });

test("a window wall is Foundry's window, an Animater window kind, or already ticked", () => {
  assert.equal(isWindowWall(wall("a", { light: 30 })), true);
  assert.equal(isWindowWall(wall("b", { light: 40 })), true);
  assert.equal(isWindowWall(wall("c", { sight: 30 })), true);
  assert.equal(isWindowWall(wall("d", { sight: 40 })), true);
  assert.equal(isWindowWall(wall("e", own({ window: "glass" }))), true);
  assert.equal(isWindowWall(wall("f", own({ window: "woodWindow" }))), true);
  assert.equal(isWindowWall(wall("g", own({ breakWall: { window: "yes" } }))), true);
  assert.equal(isWindowWall(wall("h", own({ breakWall: { window: true } }))), true);
});
test("plain walls, doors, and a window kind of nothing are not window walls", () => {
  assert.equal(isWindowWall(wall("a")), false);
  assert.equal(isWindowWall(wall("b", { light: 10, sight: 10 })), false);
  assert.equal(isWindowWall(wall("c", own({ window: "" }))), false);
  assert.equal(isWindowWall(wall("d", own({ breakWall: { window: "no" } }))), false);
  assert.equal(isWindowWall(wall("e", { door: 1, light: 30 })), false);
});

const scene = () => [
  wall("neverDoor", { door: 1, ...own({ breakWall: { door: "never", material: "metal" } }) }),
  wall("autoDoor", { door: 2 }),
  wall("foundryWin", { light: 30 }),
  wall("animWin", own({ window: "leadedWindow" })),
  wall("noWin", own({ window: "glass", breakWall: { window: "no" } })),
  wall("plain"),
  wall("brokenDoor", { door: 0, light: 30, ...own({ breakWall: { broken: { kind: "door" } } }) }),
];
const byId = (updates) => Object.fromEntries(updates.map((u) => [u._id, u]));

test("making everything breakable clears Never on doors and ticks Yes on windows", () => {
  const { updates, doors, windows } = bulkBreakableUpdates(scene(), true), by = byId(updates);
  assert.deepEqual(by.neverDoor, { _id: "neverDoor", "flags.animater.breakWall.-=door": null });
  assert.equal(by.autoDoor, undefined, "an Automatic door is already breakable");
  assert.deepEqual(by.foundryWin, { _id: "foundryWin", "flags.animater.breakWall.window": "yes" });
  assert.deepEqual(by.animWin, { _id: "animWin", "flags.animater.breakWall.window": "yes" });
  assert.deepEqual(by.noWin, { _id: "noWin", "flags.animater.breakWall.window": "yes" });
  assert.equal(by.plain, undefined);
  assert.equal(by.brokenDoor, undefined);
  assert.deepEqual({ doors, windows }, { doors: 1, windows: 3 });
});
test("making none breakable sets Never on every door and No on every window", () => {
  const { updates, doors, windows } = bulkBreakableUpdates(scene(), false), by = byId(updates);
  assert.deepEqual(by.autoDoor, { _id: "autoDoor", "flags.animater.breakWall.door": "never" });
  assert.equal(by.neverDoor, undefined, "already Never");
  assert.deepEqual(by.foundryWin, { _id: "foundryWin", "flags.animater.breakWall.window": "no" });
  assert.deepEqual(by.animWin, { _id: "animWin", "flags.animater.breakWall.window": "no" });
  assert.equal(by.noWin, undefined, "already No");
  assert.equal(by.plain, undefined);
  assert.equal(by.brokenDoor, undefined);
  assert.deepEqual({ doors, windows }, { doors: 1, windows: 2 });
});
test("nothing to change gives no updates", () => {
  assert.deepEqual(bulkBreakableUpdates([wall("p")], true), { updates: [], doors: 0, windows: 0 });
  assert.deepEqual(bulkBreakableUpdates(undefined, false), { updates: [], doors: 0, windows: 0 });
});
