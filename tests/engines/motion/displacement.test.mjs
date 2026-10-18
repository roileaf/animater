import test from "node:test";
import assert from "node:assert/strict";
import { awayFrom, landingSteps, landingSpot, displaceAllowed, withinKnockback } from "../../../scripts/engines/motion/displacement.mjs";

const G = 100, size = { w: 100, h: 100 }, from = { x: 500, y: 500 };

test("knockback points from the attacker through the target", () => {
  assert.deepEqual(awayFrom({ x: 0, y: 550 }, { x: 550, y: 550 }), { x: 1, y: 0 });
  assert.equal(awayFrom({ x: 5, y: 5 }, { x: 5, y: 5 }), null);
  assert.equal(awayFrom(null, { x: 5, y: 5 }), null);
});

test("steps are whole squares along the direction, diagonals included", () => {
  assert.deepEqual(landingSteps(from, { x: 1, y: 0 }, 3, G), [{ x: 600, y: 500 }, { x: 700, y: 500 }, { x: 800, y: 500 }]);
  assert.deepEqual(landingSteps(from, { x: Math.SQRT1_2, y: Math.SQRT1_2 }, 2, G), [{ x: 600, y: 600 }, { x: 700, y: 700 }]);
  assert.deepEqual(landingSteps(from, null, 3, G), []);
  assert.deepEqual(landingSteps(from, { x: 1, y: 0 }, 0, G), []);
});

test("a nearly straight push never repeats a square", () => {
  const steps = landingSteps(from, { x: 0.97, y: 0.24 }, 3, G);
  assert.equal(new Set(steps.map((s) => `${s.x},${s.y}`)).size, steps.length);
});

test("the landing stops before a wall", () => {
  // A wall between x=650 and x=750 (centers) blocks the second step.
  const collides = (a, b) => Math.min(a.x, b.x) < 700 && Math.max(a.x, b.x) > 700;
  assert.deepEqual(landingSpot({ from, direction: { x: 1, y: 0 }, squares: 3, grid: G, size, collides }), { x: 600, y: 500 });
});

test("the landing stays on the scene", () => {
  const bounds = { x: 0, y: 0, width: 800, height: 800 };
  assert.deepEqual(landingSpot({ from, direction: { x: 1, y: 0 }, squares: 5, grid: G, size, bounds }), { x: 700, y: 500 });
});

test("no direction or no distance lands where it stood", () => {
  assert.deepEqual(landingSpot({ from, direction: null, squares: 3, grid: G, size }), from);
  assert.deepEqual(landingSpot({ from, direction: { x: 1, y: 0 }, squares: 0, grid: G, size }), from);
});

test("a custom snap (hex or gridless) is honored", () => {
  const snap = (p) => ({ x: p.x + 1, y: p.y });
  assert.deepEqual(landingSteps(from, { x: 1, y: 0 }, 1, G, snap), [{ x: 601, y: 500 }]);
});

test("the active GM only finishes a creature its sender owns, still visible, at 0 HP", () => {
  const ok = { isOwner: true, alreadyHidden: false, hp: 0, hidden: true, x: 1, y: 2 };
  assert.equal(displaceAllowed(ok), true);
  assert.equal(displaceAllowed({ ...ok, isOwner: false }), false);
  assert.equal(displaceAllowed({ ...ok, alreadyHidden: true }), false);
  assert.equal(displaceAllowed({ ...ok, hp: 5 }), false);
  assert.equal(displaceAllowed({ ...ok, hp: NaN }), false);
  assert.equal(displaceAllowed({ ...ok, x: NaN }), false);
  assert.equal(displaceAllowed({ ...ok, hidden: false, hp: 5 }), true, "a plain move (forced movement) needs no 0 HP");
});

test("the GM writes Defeated or hidden only for a creature at 0 HP, and a request without a move is allowed", () => {
  const ok = { isOwner: true, alreadyHidden: false, hp: 0 };
  assert.equal(displaceAllowed({ ...ok, defeated: true }), true);
  assert.equal(displaceAllowed({ ...ok, defeated: true, hp: 3 }), false);
  assert.equal(displaceAllowed({ ...ok, hp: 3, x: 100, y: 200 }), true, "a use finisher moves a survivor");
  assert.equal(displaceAllowed({ ...ok, x: 100 }), false, "a move needs both coordinates");
});

test("the GM writes only a move within knockback reach that stays on the scene", () => {
  const bounds = { x: 0, y: 0, width: 2000, height: 2000 };
  assert.equal(withinKnockback({ from: { x: 500, y: 500 }, to: { x: 800, y: 500 }, grid: 100, size: 1, bounds }), true);
  assert.equal(withinKnockback({ from: { x: 500, y: 500 }, to: { x: 1300, y: 500 }, grid: 100, size: 1, bounds }), true, "8 squares: within a keyframed path's reach");
  assert.equal(withinKnockback({ from: { x: 0, y: 0 }, to: { x: 1800, y: 0 }, grid: 100, size: 1, bounds: null }), true, "17 squares plus the token's size");
  assert.equal(withinKnockback({ from: { x: 0, y: 0 }, to: { x: 1900, y: 0 }, grid: 100, size: 1, bounds: null }), false, "19 squares away");
  assert.equal(withinKnockback({ from: { x: 500, y: 500 }, to: { x: 1000, y: 1000 }, grid: 100, size: 1, bounds }), true, "diagonal 5 squares");
  assert.equal(withinKnockback({ from: { x: 500, y: 500 }, to: { x: 1100, y: 1100 }, grid: 100, size: 1, bounds }), true, "a full 6-square diagonal knockback");
  assert.equal(withinKnockback({ from: { x: 500, y: 500 }, to: { x: 1700, y: 1700 }, grid: 100, size: 1, bounds }), true, "a 12-square diagonal keyframed path");
  assert.equal(withinKnockback({ from: { x: 0, y: 0 }, to: { x: 1900, y: 1900 }, grid: 100, size: 1, bounds: null }), false, "19 squares diagonally");
  assert.equal(withinKnockback({ from: { x: 100, y: 100 }, to: { x: -100, y: 100 }, grid: 100, size: 1, bounds }), false, "off the scene");
  assert.equal(withinKnockback({ from: { x: 0, y: 0 }, to: { x: 2000, y: 0 }, grid: 100, size: 3, bounds: null }), true, "a large creature reaches further");
  assert.equal(withinKnockback({ from: { x: 500, y: 500 }, to: { x: NaN, y: 500 }, grid: 100, size: 1, bounds }), false);
  assert.equal(withinKnockback({ from: { x: 500, y: 500 }, to: { x: 600, y: 500 }, grid: 100, size: 1, bounds: null }), true, "no bounds known");
});
