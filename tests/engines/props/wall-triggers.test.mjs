import test from "node:test";
import assert from "node:assert/strict";
import { doorsInArea, windowOnLine, wallsCrossed, wallsUnderTravel, forceOpenOf, smashFrom } from "../../../scripts/engines/props/wall-triggers.mjs";
import { closestForcedDoor } from "../../../scripts/engines/props/force-open.mjs";

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

test("a Force Open roll is read from PF2e's (or SF2e's) roll options, whatever its outcome", () => {
  const m = (options, outcome, ns = "pf2e") => ({ author: { id: "p" }, speaker: { token: "t1", scene: "s" }, flags: { [ns]: { context: { options, outcome } } } });
  assert.deepEqual(forceOpenOf(m(["action:force-open", "self:x"], "success")), { wallId: null, tokenId: "t1", sceneId: "s", authorId: "p", outcome: "success" });
  // a failure or no outcome is still a Force Open: the GM compares it with the door's DC
  assert.deepEqual(forceOpenOf(m(["action:force-open"], "failure")), { wallId: null, tokenId: "t1", sceneId: "s", authorId: "p", outcome: "failure" });
  assert.equal(forceOpenOf(m(["action:force-open"], undefined)).outcome, null);
  assert.equal(forceOpenOf(m(["action:force-open"], null, "sf2e")).tokenId, "t1");
  assert.equal(forceOpenOf(m(["action:grapple"], "criticalSuccess")), null);
});

test("a roll from the door is read from its flag, in any system", () => {
  const flagged = (forceOpen, speaker = { token: "t1", scene: "s" }) => ({ author: { id: "p" }, speaker, flags: { animater: { forceOpen } } });
  assert.deepEqual(forceOpenOf(flagged({ wallId: "d1", dc: 15, tokenId: "t2" })), { wallId: "d1", tokenId: "t2", sceneId: "s", authorId: "p", outcome: null });
  assert.equal(forceOpenOf(flagged({ wallId: "d1", dc: 15 })).tokenId, "t1"); // no token named: the speaker's
  assert.equal(forceOpenOf(flagged({ wallId: "d1" }, {})), null); // no token at all
  assert.equal(forceOpenOf(flagged({ wallId: 7 })), null);
  assert.equal(forceOpenOf(flagged({ wallId: "" })), null);
  assert.equal(forceOpenOf(flagged("d1")), null);
});

test("a Force Open message missing its parts is not one", () => {
  assert.equal(forceOpenOf(null), null);
  assert.equal(forceOpenOf({ author: { id: "p" }, speaker: { token: "t1" }, flags: {} }), null);
  assert.equal(forceOpenOf({ author: { id: "p" }, speaker: {}, flags: { pf2e: { context: { options: ["action:force-open"], outcome: "success" } } } }), null);
  assert.equal(forceOpenOf({ author: { id: "p" }, speaker: { token: "t1" }, flags: { pf2e: { context: { options: "action:force-open", outcome: "success" } } } }), null);
  assert.deepEqual(forceOpenOf({ user: { id: "q" }, speaker: { token: "t1" }, flags: { pf2e: { context: { options: ["action:force-open"], outcome: "criticalSuccess" } } } }),
    { wallId: null, tokenId: "t1", sceneId: null, authorId: "q", outcome: "criticalSuccess" });
});

test("a smash comes from the GM's one token, else half a square off the door's left-hand side", () => {
  assert.deepEqual(smashFrom(wall(), { x: 300, y: 0, w: 100, h: 100 }, 100), { x: 350, y: 50 });
  // the wall runs left to right: its left-hand side is up the screen
  assert.ok(near(smashFrom(wall(), null, 100), { x: 350, y: 150 }));
  assert.ok(near(smashFrom(wall({ c: [400, 200, 300, 200] }), null, 100), { x: 350, y: 250 }));
  assert.ok(near(smashFrom(wall({ c: [300, 200, 300, 400] }), null, 200), { x: 400, y: 300 }));
});

const win = (extra = {}) => wall({ id: "w1", door: 0, flags: { animater: { breakWall: { window: true } } }, ...extra });
test("the first window on a shot's line", () => {
  const a = win({ id: "a", c: [300, 200, 400, 200] }), b = win({ id: "b", c: [300, 300, 400, 300] });
  assert.equal(windowOnLine({ x: 350, y: 100 }, { x: 350, y: 400 }, [b, a], scene())?.id, "a");
  assert.equal(windowOnLine({ x: 350, y: 400 }, { x: 350, y: 100 }, [a, b], scene())?.id, "b");
  assert.equal(windowOnLine({ x: 50, y: 100 }, { x: 50, y: 400 }, [a, b], scene()), null);
});
test("a window on the line skips broken, other-level, plain and switched-off walls", () => {
  const from = { x: 350, y: 100 }, to = { x: 350, y: 400 };
  assert.equal(windowOnLine(from, to, [win({ flags: { animater: { breakWall: { window: true, broken: { seed: 1 } } } } })], scene()), null);
  assert.equal(windowOnLine(from, to, [win({ levels: ["ground"] })], scene(), ["upstairs"]), null);
  assert.equal(windowOnLine(from, to, [win({ levels: ["ground"] })], scene(), ["ground"])?.id, "w1");
  assert.equal(windowOnLine(from, to, [wall({ door: 0 })], scene()), null); // a plain wall
  assert.equal(windowOnLine(from, to, [wall()], scene()), null); // a door is not a window
  assert.equal(windowOnLine(from, to, [win()], scene({ breakWalls: false })), null);
});
test("areas and forced paths pick up windows, glass by damage and any slam", () => {
  const all = () => true;
  assert.deepEqual(doorsInArea([win()], all, scene(), "cold").map((w) => w.id), ["w1"]);
  assert.deepEqual(doorsInArea([win()], all, scene(), "poison"), []);
  assert.deepEqual(wallsCrossed({ from: { x: 350, y: 100 }, to: { x: 350, y: 300 } }, 1, [win()], scene()).map((w) => w.id), ["w1"]);
  const none = win({ flags: { animater: { breakWall: { window: true, material: "none" } } } });
  assert.deepEqual(wallsCrossed({ from: { x: 350, y: 100 }, to: { x: 350, y: 300 } }, 3, [none], scene()), []);
  const pts = [{ x: 350, y: 100, p: 0 }, { x: 350, y: 300, p: 1 }];
  assert.deepEqual(wallsUnderTravel(pts, 1, [win()], scene()).map((h) => h.wall.id), ["w1"]);
});
test("Force Open never picks a window", () => {
  assert.equal(closestForcedDoor({ x: 300, y: 210, w: 100, h: 100 }, [win()], scene(), 100), null);
});
