import test from "node:test";
import assert from "node:assert/strict";
import { fetchLandings } from "../../../scripts/engines/motion/fetch-path.mjs";

// A 100 px grid; tokens one square, placed by square.
const at = (id, col, row) => ({ id, x: col * 100, y: row * 100, w: 100, h: 100 });
const snap = (p) => ({ x: Math.round(p.x / 100) * 100, y: Math.round(p.y / 100) * 100 });
const caster = at("caster", 0, 0);
const land = (opts) => fetchLandings({ caster, snap, gridSize: 100, ...opts });

test("one target is dragged to the square next to the caster", () => {
  assert.deepEqual(land({ targets: [at("a", 5, 0)] }), [{ id: "a", x: 100, y: 0 }]);
  // Diagonal: straight along the line, to the diagonal neighbour.
  assert.deepEqual(land({ targets: [at("a", 4, 4)] }), [{ id: "a", x: 100, y: 100 }]);
});

test("two targets each come to their own square", () => {
  const out = land({ targets: [at("a", 5, 0), at("b", 0, 5)] });
  assert.deepEqual(out, [{ id: "a", x: 100, y: 0 }, { id: "b", x: 0, y: 100 }]);
});

test("a wall ends the drag: the target stops on its side of it", () => {
  // A wall between columns 2 and 3 (x = 300).
  const blocked = (from, to) => (from.x - 300) * (to.x - 300) < 0;
  assert.deepEqual(land({ targets: [at("a", 5, 0)], blocked }), [{ id: "a", x: 300, y: 0 }]);
  // Right behind the wall already: it stays.
  assert.deepEqual(land({ targets: [at("a", 3, 0)], blocked }), []);
});

test("occupied squares are passed over; the closest free one is taken", () => {
  const tokens = [at("x", 1, 0), at("y", 2, 0)];
  assert.deepEqual(land({ targets: [at("a", 5, 0)], tokens }), [{ id: "a", x: 300, y: 0 }]);
  // Every square on the way taken: it stays.
  assert.deepEqual(land({ targets: [at("a", 3, 0)], tokens }), []);
  // The caster's own token in the list counts once, as the caster.
  assert.deepEqual(land({ targets: [at("a", 5, 0)], tokens: [caster] }), [{ id: "a", x: 100, y: 0 }]);
});

test("two targets on the same line: the nearer lands next to the caster, the other behind it", () => {
  const a = at("a", 2, 0), b = at("b", 4, 0);
  assert.deepEqual(land({ targets: [b, a], tokens: [a, b] }), [{ id: "b", x: 200, y: 0 }, { id: "a", x: 100, y: 0 }]);
  // The nearer one already next to the caster stays: the other stops behind it.
  assert.deepEqual(land({ targets: [at("a", 1, 0), b], tokens: [] }), [{ id: "b", x: 200, y: 0 }]);
  // A wall cuts only the farther one's path.
  const blocked = (from, to) => from.x > 300 && to.x < 300;
  assert.deepEqual(land({ targets: [a, b], blocked }), [{ id: "a", x: 100, y: 0 }, { id: "b", x: 300, y: 0 }]);
});

test("no caster or no targets: nobody moves", () => {
  assert.deepEqual(fetchLandings({ caster: null, targets: [at("a", 5, 0)] }), []);
  assert.deepEqual(land({ targets: [] }), []);
  assert.deepEqual(land({ targets: [caster] }), [], "the caster never fetches itself");
});
