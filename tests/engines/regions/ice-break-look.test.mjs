import test from "node:test";
import assert from "node:assert/strict";
import { crackLines, holeOutline, shards } from "../../../scripts/engines/regions/ice-break-look.mjs";

const GRID = 100;
const KEYS = ["3,4", "0,0", "-1,2", "-7,-5", "12,-3"];
const centre = (key, grid) => { const [c, r] = key.split(",").map(Number); return { x: (c + 0.5) * grid, y: (r + 0.5) * grid }; };
const area2 = (ring) => ring.reduce((s, p, i) => { const q = ring[(i + 1) % ring.length]; return s + p.x * q.y - q.x * p.y; }, 0);
const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
const properCross = (a, b, c, d) => {
  const d1 = cross(a, b, c), d2 = cross(a, b, d), d3 = cross(c, d, a), d4 = cross(c, d, b);
  return d1 * d2 < 0 && d3 * d4 < 0;
};
const isSimple = (ring) => {
  const n = ring.length;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    if (j === i + 1 || (i === 0 && j === n - 1)) continue; // edges that share a vertex
    if (properCross(ring[i], ring[(i + 1) % n], ring[j], ring[(j + 1) % n])) return false;
  }
  return true;
};
const inside = (ring, p) => {
  let in_ = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) in_ = !in_;
  }
  return in_;
};

test("the same key and seed draw the same break, a different seed another", () => {
  const o = { grid: GRID, seed: 5, size: 2 };
  assert.deepEqual(crackLines("3,4", o), crackLines("3,4", o));
  assert.deepEqual(holeOutline("3,4", o), holeOutline("3,4", o));
  assert.deepEqual(shards("3,4", o), shards("3,4", o));
  const p = { ...o, seed: 6 };
  assert.notDeepEqual(crackLines("3,4", o), crackLines("3,4", p));
  assert.notDeepEqual(holeOutline("3,4", o), holeOutline("3,4", p));
  assert.notDeepEqual(shards("3,4", o), shards("3,4", p));
  assert.notDeepEqual(holeOutline("3,4", o), holeOutline("4,4", o));
});

test("the hole is a closed ring that does not repeat its first point", () => {
  for (const key of KEYS) for (const size of [1, 2, 3, 4]) {
    const ring = holeOutline(key, { grid: GRID, seed: 9, size });
    assert.ok(ring.length >= 8, "enough points to look jagged");
    assert.notDeepEqual(ring[0], ring[ring.length - 1], "first point is not repeated");
    for (const p of ring) assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
  }
});

test("the hole ring never crosses itself, whatever the key, size or seed", () => {
  for (const key of KEYS) for (const size of [1, 2, 3, 4]) for (let seed = 0; seed < 25; seed++) {
    assert.ok(isSimple(holeOutline(key, { grid: GRID, seed, size })), `${key} size ${size} seed ${seed}`);
  }
});

test("the hole ring always winds the same way: positive area in canvas coordinates (clockwise on screen)", () => {
  for (const key of KEYS) for (const size of [1, 2, 3, 4]) for (let seed = 0; seed < 25; seed++) {
    assert.ok(area2(holeOutline(key, { grid: GRID, seed, size })) > 0, `${key} size ${size} seed ${seed}`);
  }
});

test("the hole is about the creature's size plus one square, centred on its square, within size + 1 squares", () => {
  for (const key of KEYS) for (const size of [1, 2, 3, 4]) {
    const c = centre(key, GRID);
    const ring = holeOutline(key, { grid: GRID, seed: 3, size });
    for (const p of ring) assert.ok(Math.hypot(p.x - c.x, p.y - c.y) <= (size + 1) * GRID, "within size + 1 squares");
    const width = Math.max(...ring.map((p) => p.x)) - Math.min(...ring.map((p) => p.x));
    assert.ok(width > size * GRID * 0.8 && width <= (size + 1) * GRID, `width ${width} for size ${size}`);
    assert.ok(inside(ring, c), "the square it broke is in the hole");
  }
});

test("the hole scales with the grid", () => {
  const a = holeOutline("2,2", { grid: 50, seed: 1, size: 1 });
  const b = holeOutline("2,2", { grid: 100, seed: 1, size: 1 });
  const span = (r) => Math.max(...r.map((p) => p.x)) - Math.min(...r.map((p) => p.x));
  assert.ok(Math.abs(span(b) / span(a) - 2) < 0.2);
});

test("cracks are several jagged lines that stay inside their own square", () => {
  for (const key of KEYS) for (let seed = 0; seed < 20; seed++) {
    const [c, r] = key.split(",").map(Number);
    const lines = crackLines(key, { grid: GRID, seed });
    assert.ok(lines.length >= 3);
    for (const line of lines) {
      assert.ok(line.length >= 3, "a crack bends");
      for (const p of line) {
        assert.ok(p.x >= c * GRID && p.x <= (c + 1) * GRID, `${key} x ${p.x}`);
        assert.ok(p.y >= r * GRID && p.y <= (r + 1) * GRID, `${key} y ${p.y}`);
      }
    }
  }
});

test("cracks start near the middle of their square", () => {
  const c = centre("-1,2", GRID);
  for (const line of crackLines("-1,2", { grid: GRID, seed: 2 })) {
    assert.ok(Math.hypot(line[0].x - c.x, line[0].y - c.y) < GRID * 0.2);
  }
});

test("shards are in the hole, in pixels, with a turn in radians, and more of them for a bigger hole", () => {
  const count = (size) => shards("3,4", { grid: GRID, seed: 4, size }).length;
  assert.ok(count(1) >= 3);
  assert.ok(count(2) > count(1) && count(3) > count(2) && count(4) > count(3));
  for (const size of [1, 2, 4]) {
    const ring = holeOutline("3,4", { grid: GRID, seed: 4, size });
    for (const s of shards("3,4", { grid: GRID, seed: 4, size })) {
      assert.ok(s.r > 0 && s.r < GRID * 0.5);
      assert.ok(Math.abs(s.turn) <= Math.PI * 2, "an angle in radians");
      assert.ok(inside(ring, s), "shard centre is in the hole");
    }
  }
});

test("junk input gives nothing and never throws", () => {
  const good = { grid: GRID, seed: 1, size: 1 };
  for (const key of ["", "x", "3", "3,", "a,b", "1.5,2", null, undefined, 7, "3,4,5"]) {
    assert.deepEqual(crackLines(key, good), []);
    assert.deepEqual(holeOutline(key, good), []);
    assert.deepEqual(shards(key, good), []);
  }
  for (const bad of [{}, { grid: 0, size: 1 }, { grid: -5, size: 1 }, { grid: "x", size: 1 }, { grid: GRID }, { grid: GRID, size: 0 }, { grid: GRID, size: NaN }, undefined]) {
    assert.deepEqual(holeOutline("3,4", bad), []);
    assert.deepEqual(shards("3,4", bad), []);
  }
  assert.deepEqual(crackLines("3,4", { grid: 0 }), []);
  assert.deepEqual(crackLines("3,4", undefined), []);
  assert.ok(crackLines("3,4", { grid: GRID }).length >= 3, "a missing seed is just seed 0");
});
