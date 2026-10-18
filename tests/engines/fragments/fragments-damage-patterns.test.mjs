import test from "node:test";
import assert from "node:assert/strict";
import { normalizeFragments, polygonArea, pointInPolygon, fragmentPieces, fragmentCount, fragmentFlight, fragmentPose, FRAGMENT_COUNTS, FRAGMENT_PATTERNS } from "../../../scripts/engines/fragments/fragments.mjs";

const stage = (extra = {}) => ({ kind: "motion", motion: "fragments", duration: 1400, ...normalizeFragments({ seed: 7, ...extra }) });
const DAMAGE = ["perforate", "slashes", "crush", "lightning"];
const area = (pieces) => pieces.reduce((a, p) => a + polygonArea(p.polygon), 0);
const convex = (pts) => {
  let sign = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length], c = pts[(i + 2) % pts.length];
    const z = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(z) < 1e-12) continue;
    if (sign && Math.sign(z) !== sign) return false;
    sign = Math.sign(z);
  }
  return true;
};
// Samples offset so none lies on a diagonal or an axis, where two pieces share an edge.
const coversOnce = (pieces) => {
  for (let i = 0; i < 20; i++) for (let j = 0; j < 20; j++) {
    const pt = { x: -0.5 + (i + 0.513) / 20, y: -0.5 + (j + 0.529) / 20 };
    if (pieces.filter((p) => pointInPolygon(pt, p.polygon)).length !== 1) return false;
  }
  return true;
};
const mean = (ps) => ({ x: ps.reduce((a, p) => a + p.centroid.x, 0) / ps.length, y: ps.reduce((a, p) => a + p.centroid.y, 0) / ps.length });
const spread = (ps, key) => Math.max(...ps.map((p) => p.centroid[key])) - Math.min(...ps.map((p) => p.centroid[key]));
// Distance from a point to a convex polygon (0 inside).
const distTo = (pt, poly) => {
  if (pointInPolygon(pt, poly)) return 0;
  return Math.min(...poly.map((a, i) => {
    const b = poly[(i + 1) % poly.length], dx = b.x - a.x, dy = b.y - a.y, l = dx * dx + dy * dy || 1e-18;
    const t = Math.max(0, Math.min(1, ((pt.x - a.x) * dx + (pt.y - a.y) * dy) / l));
    return Math.hypot(pt.x - (a.x + dx * t), pt.y - (a.y + dy * t));
  }));
};

test("the damage patterns are registered with their labels and piece ranges", () => {
  assert.deepEqual(Object.fromEntries(DAMAGE.map((k) => [k, FRAGMENT_PATTERNS[k]])), { perforate: "Perforate", slashes: "Slashes", crush: "Crush", lightning: "Lightning" });
  assert.deepEqual(Object.fromEntries(DAMAGE.map((k) => [k, FRAGMENT_COUNTS[k]])), { perforate: [3, 6, 4], slashes: [2, 4, 3], crush: [2, 4, 3], lightning: [2, 2, 2] });
  for (const pattern of DAMAGE) {
    const [lo, hi, def] = FRAGMENT_COUNTS[pattern];
    assert.equal(normalizeFragments({ pattern }).pieces, def, pattern);
    assert.equal(normalizeFragments({ pattern, pieces: 999 }).pieces, hi, pattern);
    assert.equal(normalizeFragments({ pattern, pieces: 0 }).pieces, lo, pattern);
  }
});

test("each damage pattern tiles the token with convex pieces, for any seed, cut and turn", () => {
  for (const pattern of DAMAGE) {
    const [lo, hi] = FRAGMENT_COUNTS[pattern];
    for (const n of [lo, hi]) for (const seed of [1, 99, 12345]) for (const angle of [0, 0.3, Math.PI / 4, 2.2, -1.9]) for (const turn of [0, 0.9]) {
      const s = stage({ pattern, pieces: n, seed }), pieces = fragmentPieces(s, angle, turn), label = `${pattern} n${n} seed${seed} a${angle} t${turn}`;
      assert.equal(fragmentCount(s), pieces.length, label);
      assert.ok(Math.abs(area(pieces) - 1) < 1e-6, `${label}: area ${area(pieces)}`);
      assert.ok(pieces.every((p) => convex(p.polygon)), `${label}: convex`);
      assert.ok(pieces.every((p) => polygonArea(p.polygon) > 1e-9), `${label}: no empty piece`);
      assert.ok(pieces.every((p) => p.polygon.every((q) => Number.isFinite(q.x) && Number.isFinite(q.y)) && Number.isFinite(p.centroid.x) && Number.isFinite(p.centroid.y)), `${label}: no NaN`);
      assert.ok(coversOnce(pieces), `${label}: overlap or gap`);
    }
  }
});

test("piece counts: slashes cut pieces + 1 strips, crush 7 wedges a ring, lightning 2 x 5, perforate 8-18", () => {
  for (const n of [2, 3, 4]) assert.equal(fragmentPieces(stage({ pattern: "slashes", pieces: n }), 0.4).length, n + 1);
  for (const n of [2, 3, 4]) assert.equal(fragmentPieces(stage({ pattern: "crush", pieces: n }), 0.4).length, n * 7);
  assert.equal(fragmentPieces(stage({ pattern: "lightning" }), 0.4).length, 10);
  for (const n of [3, 4, 5, 6]) for (const seed of [1, 2, 3, 4, 5]) {
    const count = fragmentPieces(stage({ pattern: "perforate", pieces: n, seed }), 0.4).length;
    assert.ok(count >= 8 && count <= 18 && count >= 2 * n && count <= 3 * n, `perforate ${n} seed ${seed}: ${count}`);
  }
});

test("a seed always gives the same pieces, and another seed other pieces", () => {
  for (const pattern of DAMAGE) {
    assert.deepEqual(fragmentPieces(stage({ pattern, seed: 5 }), 0.7, 0.2), fragmentPieces(stage({ pattern, seed: 5 }), 0.7, 0.2), pattern);
    assert.notDeepEqual(fragmentPieces(stage({ pattern, seed: 5 }), 0.7), fragmentPieces(stage({ pattern, seed: 6 }), 0.7), pattern);
  }
});

test("perforate: punctures lie along the attack line, and each puncture's cell holds it", () => {
  for (const a of [0, 0.8, 2.5]) {
    const pieces = fragmentPieces(stage({ pattern: "perforate", pieces: 5 }), a), d = { x: Math.cos(a), y: Math.sin(a) };
    const holes = [...new Map(pieces.map((p) => [p.cell, p.puncture])).values()];
    assert.equal(holes.length, 5);
    for (const h of holes) {
      assert.ok(Math.abs(-d.y * h.x + d.x * h.y) <= 0.08 + 1e-9, `a ${a}: off the line by ${-d.y * h.x + d.x * h.y}`);
      assert.ok(Math.abs(d.x * h.x + d.y * h.y) <= 0.38 + 1e-9, `a ${a}: along ${d.x * h.x + d.y * h.y}`);
    }
    const along = holes.map((h) => d.x * h.x + d.y * h.y);
    assert.ok(Math.max(...along) - Math.min(...along) > 0.4, "spread along the line");
    for (const p of pieces) assert.ok(distTo(p.puncture, p.polygon) < 1e-9, `a ${a}: a wedge of cell ${p.cell} touches its puncture`);
  }
});

test("slashes: the cut angle turns the strips", () => {
  const level = fragmentPieces(stage({ pattern: "slashes", pieces: 4 }), 0), upright = fragmentPieces(stage({ pattern: "slashes", pieces: 4 }), Math.PI / 2);
  assert.ok(spread(level, "y") > 3 * spread(level, "x"), "a level swing stacks the strips down the token");
  assert.ok(spread(upright, "x") > 3 * spread(upright, "y"), "an upright swing lines them across");
  assert.deepEqual(level.map((p) => p.strip), [0, 1, 2, 3, 4]);
});

test("crush: the impact sits on the attacker's side, and the inner ring is round it", () => {
  for (const a of [0, 1.3, 2.2, -2]) {
    const pieces = fragmentPieces(stage({ pattern: "crush", pieces: 3 }), a), inner = mean(pieces.filter((p) => p.ring === 0));
    assert.ok(inner.x * Math.cos(a) + inner.y * Math.sin(a) < -0.15, `a ${a}: inner ring toward the attacker`);
    assert.deepEqual([0, 1, 2].map((k) => pieces.filter((p) => p.ring === k).length), [7, 7, 7]);
  }
});

test("lightning: two groups of five, split along the attack", () => {
  for (const a of [0, Math.PI / 2, 0.7, Math.PI / 4]) {
    const pieces = fragmentPieces(stage({ pattern: "lightning" }), a);
    assert.ok(pieces.every((p) => p.group === 0 || p.group === 1));
    assert.deepEqual([0, 1].map((g) => pieces.filter((p) => p.group === g).length), [5, 5]);
    const g0 = mean(pieces.filter((p) => p.group === 0)), g1 = mean(pieces.filter((p) => p.group === 1)), dx = g1.x - g0.x, dy = g1.y - g0.y;
    assert.ok(-Math.sin(a) * dx + Math.cos(a) * dy > 0.2, `a ${a}: group 1 lies across the bolt`);
    assert.ok(Math.abs(Math.cos(a) * dx + Math.sin(a) * dy) < 0.1, `a ${a}: not along it`);
  }
});

// Review focus: a stage switched to a damage pattern keeps no impossible count.
test("a count left over from another pattern is clamped to the damage pattern's range", () => {
  assert.equal(stage({ pattern: "lightning", pieces: 48 }).pieces, 2);
  assert.equal(fragmentPieces(stage({ pattern: "lightning", pieces: 48 }), 0).length, 10);
  assert.equal(fragmentPieces(stage({ pattern: "slashes", pieces: 48 }), 0).length, 5);
  assert.equal(fragmentPieces(stage({ pattern: "crush", pieces: 48 }), 0).length, 28);
  assert.equal(stage({ pattern: "perforate", pieces: 1 }).pieces, 3);
});

// Review focus: no attack angle known (a fixed glyph, an old message) still cuts and flies finite.
test("a missing cut angle cuts and flies every damage pattern without NaN", () => {
  for (const pattern of DAMAGE) for (const cut of [undefined, NaN]) {
    const s = stage({ pattern }), pieces = fragmentPieces(s, cut);
    assert.ok(pieces.length > 1, pattern);
    pieces.forEach((p, i) => {
      assert.ok(p.polygon.every((q) => Number.isFinite(q.x) && Number.isFinite(q.y)), `${pattern}: polygon`);
      for (const t of [0, 0.4, 1]) {
        const pose = fragmentPose(s, p, fragmentFlight(s, p, i, cut), t);
        for (const key of ["x", "y", "rotation", "alpha", "scale"]) assert.ok(Number.isFinite(pose[key]), `${pattern} #${i} t${t} ${key}`);
      }
    });
  }
});
