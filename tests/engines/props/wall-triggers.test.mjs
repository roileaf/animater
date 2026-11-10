import test from "node:test";
import assert from "node:assert/strict";
import { doorsInArea, wallsCrossed, wallsUnderTravel, forceOpenOf, forceOpenDoor, smashFrom } from "../../../scripts/engines/props/wall-triggers.mjs";

const scene = (f = {}) => ({ id: "s", flags: { animater: { breakableProps: true, ...f } } });
const wall = (extra = {}) => ({ id: "d1", c: [300, 200, 400, 200], door: 1, ds: 0, move: 20, sight: 20, light: 20, sound: 20, levels: [], flags: {}, ...extra });
const near = (p, q) => Math.abs(p.x - q.x) < 1e-9 && Math.abs(p.y - q.y) < 1e-9;

test("an area breaks the doors whose midpoint it covers, by damage", () => {
  const inside = ({ y }) => y < 250;
  assert.deepEqual(doorsInArea([wall(), wall({ id: "far", c: [300, 600, 400, 600] })], inside, scene(), "fire").map((w) => w.id), ["d1"]);
  assert.deepEqual(doorsInArea([wall()], inside, scene(), "piercing"), []);
});

test("an area leaves broken doors, other levels and switched-off scenes alone", () => {
  const all = () => true;
  assert.deepEqual(doorsInArea([wall({ flags: { animater: { breakWall: { broken: { seed: 1 } } } } })], all, scene(), "fire"), []);
  assert.deepEqual(doorsInArea([wall({ levels: ["ground"] })], all, scene(), "fire", ["upstairs"]), []);
  assert.deepEqual(doorsInArea([wall({ levels: ["ground"] })], all, scene(), "fire", ["ground"]).map((w) => w.id), ["d1"]);
  assert.deepEqual(doorsInArea([wall()], all, scene({ breakWalls: false }), "fire"), []);
  assert.deepEqual(doorsInArea([wall({ door: 0 })], all, scene(), "fire"), []);
  // metal needs force
  const metal = wall({ flags: { animater: { breakWall: { material: "metal" } } } });
  assert.deepEqual(doorsInArea([metal], all, scene(), "fire"), []);
  assert.deepEqual(doorsInArea([metal], all, scene(), "force").map((w) => w.id), ["d1"]);
});

test("a forced path crosses doors in order; size decides", () => {
  const ws = [wall({ id: "a", c: [300, 200, 400, 200] }), wall({ id: "b", c: [300, 400, 400, 400] })];
  assert.deepEqual(wallsCrossed({ from: { x: 350, y: 100 }, to: { x: 350, y: 500 } }, 2, ws, scene()).map((w) => w.id), ["a", "b"]);
  assert.deepEqual(wallsCrossed({ from: { x: 350, y: 100 }, to: { x: 350, y: 500 } }, 1, ws, scene()), []);
});

test("a forced path: order follows the path, not the list; level, breakage and material count", () => {
  const ws = [wall({ id: "b", c: [300, 400, 400, 400] }), wall({ id: "a", c: [300, 200, 400, 200] })];
  assert.deepEqual(wallsCrossed({ from: { x: 350, y: 100 }, to: { x: 350, y: 500 } }, 2, ws, scene()).map((w) => w.id), ["a", "b"]);
  assert.deepEqual(wallsCrossed({ from: { x: 350, y: 500 }, to: { x: 350, y: 100 } }, 2, ws, scene()).map((w) => w.id), ["b", "a"]);
  // a path that stops short of the second door
  assert.deepEqual(wallsCrossed({ from: { x: 350, y: 100 }, to: { x: 350, y: 300 } }, 2, ws, scene()).map((w) => w.id), ["a"]);
  assert.deepEqual(wallsCrossed({ from: { x: 350, y: 100 }, to: { x: 350, y: 300 } }, 2, [wall({ levels: ["ground"] })], scene(), "upstairs"), []);
  assert.deepEqual(wallsCrossed({ from: { x: 350, y: 100 }, to: { x: 350, y: 300 } }, 2, [wall({ levels: ["ground"] })], scene(), "ground").map((w) => w.id), ["d1"]);
  assert.deepEqual(wallsCrossed({ from: { x: 350, y: 100 }, to: { x: 350, y: 300 } }, 2, [wall({ flags: { animater: { breakWall: { broken: { seed: 1 } } } } })], scene()), []);
  const metal = wall({ flags: { animater: { breakWall: { material: "metal" } } } });
  assert.deepEqual(wallsCrossed({ from: { x: 350, y: 100 }, to: { x: 350, y: 300 } }, 2, [metal], scene()), []);
  assert.deepEqual(wallsCrossed({ from: { x: 350, y: 100 }, to: { x: 350, y: 300 } }, 3, [metal], scene()).map((w) => w.id), ["d1"]);
  assert.deepEqual(wallsCrossed({ from: { x: 350, y: 100 }, to: { x: 350, y: 100 } }, 3, [wall()], scene()), []);
});

test("a cosmetic run through a door: its share of the stage and a path from rest that crosses it", () => {
  const pts = [{ x: 350, y: 100, p: 0 }, { x: 350, y: 300, p: 0.6 }];
  const hits = wallsUnderTravel(pts, 2, [wall()], scene());
  assert.equal(hits.length, 1);
  assert.equal(hits[0].wall.id, "d1");
  assert.ok(Math.abs(hits[0].p - 0.3) < 1e-9);
  assert.ok(near(hits[0].path.from, { x: 350, y: 100 }) && near(hits[0].path.to, { x: 350, y: 300 }));
  assert.deepEqual(wallsUnderTravel(pts, 1, [wall()], scene()), []);
  assert.deepEqual(wallsUnderTravel([pts[0]], 2, [wall()], scene()), []);
  // a curving path that goes through the door and back: the path runs from rest to a point past the door
  const curve = [{ x: 350, y: 100, p: 0 }, { x: 350, y: 300, p: 0.5 }, { x: 100, y: 100, p: 1 }];
  const back = wallsUnderTravel(curve, 2, [wall()], scene());
  assert.equal(back.length, 1);
  assert.ok(near(back[0].path.to, { x: 350, y: 300 }));
});

test("a Force Open roll is read from PF2e's roll options and outcome", () => {
  const m = (options, outcome) => ({ author: { id: "p" }, speaker: { token: "t1", scene: "s" }, flags: { pf2e: { context: { options, outcome } } } });
  assert.deepEqual(forceOpenOf(m(["action:force-open", "self:x"], "success")), { outcome: "success", tokenId: "t1", sceneId: "s", authorId: "p" });
  assert.equal(forceOpenOf(m(["action:force-open"], "failure")), null);
  assert.equal(forceOpenOf(m(["action:grapple"], "criticalSuccess")), null);
});

test("a Force Open message missing its parts is not one", () => {
  assert.equal(forceOpenOf(null), null);
  assert.equal(forceOpenOf({ author: { id: "p" }, speaker: { token: "t1" }, flags: {} }), null);
  assert.equal(forceOpenOf({ author: { id: "p" }, speaker: {}, flags: { pf2e: { context: { options: ["action:force-open"], outcome: "success" } } } }), null);
  assert.equal(forceOpenOf({ author: { id: "p" }, speaker: { token: "t1" }, flags: { pf2e: { context: { options: "action:force-open", outcome: "success" } } } }), null);
  assert.deepEqual(forceOpenOf({ user: { id: "q" }, speaker: { token: "t1" }, flags: { pf2e: { context: { options: ["action:force-open"], outcome: "criticalSuccess" } } } }),
    { outcome: "criticalSuccess", tokenId: "t1", sceneId: null, authorId: "q" });
});

test("Force Open breaks the closest closed door within a square: success wood only, crit any", () => {
  const token = { x: 300, y: 200, w: 100, h: 100 };
  const near = wall({ id: "near", c: [300, 200, 400, 200] }), metal = wall({ id: "metal", c: [300, 200, 400, 200], flags: { animater: { breakWall: { material: "metal" } } } });
  const open = wall({ id: "open", ds: 1 }), away = wall({ id: "away", c: [300, 500, 400, 500] }), locked = wall({ id: "locked", ds: 2 });
  assert.equal(forceOpenDoor(token, [away, near], scene(), 100, "success")?.id, "near");
  assert.equal(forceOpenDoor(token, [metal], scene(), 100, "success"), null);
  assert.equal(forceOpenDoor(token, [metal], scene(), 100, "criticalSuccess")?.id, "metal");
  assert.equal(forceOpenDoor(token, [open], scene(), 100, "criticalSuccess"), null);
  assert.equal(forceOpenDoor(token, [locked], scene(), 100, "success")?.id, "locked");
  assert.equal(forceOpenDoor(token, [away], scene(), 100, "criticalSuccess"), null);
  assert.equal(forceOpenDoor(token, [wall({ flags: { animater: { breakWall: { forceOpen: false } } } })], scene(), 100, "criticalSuccess"), null);
});

test("Force Open: exactly one square counts, the nearer of two wins, and the level must match", () => {
  const token = { x: 300, y: 200, w: 100, h: 100 };
  const edge = wall({ id: "edge", c: [300, 400, 400, 400] }), beyond = wall({ id: "beyond", c: [300, 401, 400, 401] });
  assert.equal(forceOpenDoor(token, [edge], scene(), 100, "success")?.id, "edge");
  assert.equal(forceOpenDoor(token, [beyond], scene(), 100, "success"), null);
  const close = wall({ id: "close", c: [300, 350, 400, 350] });
  assert.equal(forceOpenDoor(token, [edge, close], scene(), 100, "success")?.id, "close");
  // a door crossing the footprint is at distance 0
  const through = wall({ id: "through", c: [350, 150, 350, 350] });
  assert.equal(forceOpenDoor(token, [close, through], scene(), 100, "success")?.id, "through");
  const up = wall({ id: "up", levels: ["upstairs"] });
  assert.equal(forceOpenDoor({ ...token, level: "ground" }, [up], scene(), 100, "criticalSuccess"), null);
  assert.equal(forceOpenDoor({ ...token, level: "upstairs" }, [up], scene(), 100, "criticalSuccess")?.id, "up");
  assert.equal(forceOpenDoor(token, [wall()], scene(), 100, "failure"), null);
  assert.equal(forceOpenDoor(null, [wall()], scene(), 100, "success"), null);
  assert.equal(forceOpenDoor(token, [wall({ flags: { animater: { breakWall: { broken: { seed: 1 } } } } })], scene(), 100, "success"), null);
  assert.equal(forceOpenDoor(token, [wall()], scene({ breakWalls: false }), 100, "success"), null);
});

test("a smash comes from the GM's one token, else half a square off the door's left-hand side", () => {
  assert.deepEqual(smashFrom(wall(), { x: 300, y: 0, w: 100, h: 100 }, 100), { x: 350, y: 50 });
  // the wall runs left to right: its left-hand side is up the screen
  assert.ok(near(smashFrom(wall(), null, 100), { x: 350, y: 150 }));
  assert.ok(near(smashFrom(wall({ c: [400, 200, 300, 200] }), null, 100), { x: 350, y: 250 }));
  assert.ok(near(smashFrom(wall({ c: [300, 200, 300, 400] }), null, 200), { x: 400, y: 300 }));
});
