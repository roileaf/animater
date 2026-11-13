import test from "node:test";
import assert from "node:assert/strict";
import { seededRandom } from "../../../scripts/engines/fragments/fragments.mjs";
import { charLayout, EMBER_MS } from "../../../scripts/engines/props/char-layout.mjs";

test("the same seed lays out the same wreck, and a different seed a different one", () => {
  const a = charLayout({ seed: 7 }, { width: 200, height: 100, grid: 100 });
  assert.deepEqual(a, charLayout({ seed: 7 }, { width: 200, height: 100, grid: 100 }));
  assert.notDeepEqual(a.pieces, charLayout({ seed: 8 }, { width: 200, height: 100, grid: 100 }).pieces);
});

const bbox = (pts) => { const xs = pts.map((q) => q.x), ys = pts.map((q) => q.y); return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) }; };

test("every piece stays inside the prop's own outline, and together they fill it", () => {
  for (const [width, height] of [[200, 100], [100, 100], [300, 80], [60, 160]]) {
    for (let seed = 1; seed <= 25; seed++) {
      const { pieces } = charLayout({ seed }, { width, height, grid: 100 });
      assert.ok(pieces.length >= 4);
      for (const p of pieces) {
        for (const q of p.pts) { assert.ok(Math.abs(q.x) <= width / 2, `x ${q.x}`); assert.ok(Math.abs(q.y) <= height / 2, `y ${q.y}`); }
        const b = bbox(p.pts);
        assert.ok(b.x1 - b.x0 >= 0.04 * width && b.y1 - b.y0 >= 0.04 * height, `piece too small ${width}x${height} seed ${seed}`);
      }
      const all = bbox(pieces.flatMap((p) => p.pts));
      assert.ok(all.x1 - all.x0 >= 0.85 * width && all.y1 - all.y0 >= 0.85 * height, `wreck too small ${width}x${height} seed ${seed}`);
    }
  }
});

// Distance from a point to the nearest edge of a piece (its outline segments).
const edgeDist = (q, pts) => Math.min(...pts.map((a, i) => {
  const b = pts[(i + 1) % pts.length], dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy || 1;
  const t = Math.min(1, Math.max(0, ((q.x - a.x) * dx + (q.y - a.y) * dy) / l2));
  return Math.hypot(q.x - (a.x + t * dx), q.y - (a.y + t * dy));
}));
// A point is on a crack when it is within a few px of the outlines of two different pieces (the shrink-plus-nudge gap).
const onCrack = (q, pieces, tol) => pieces.filter((p) => edgeDist(q, p.pts) <= tol).length >= 2;

test("each seam runs along a crack where two pieces meet, and the check rejects stray points", () => {
  for (const [width, height] of [[200, 100], [100, 100]]) {
    for (let seed = 1; seed <= 25; seed++) {
      const { pieces, seams } = charLayout({ seed }, { width, height, grid: 100 });
      assert.ok(seams.length >= 1);
      // The gap is the shrink (a tenth of a piece's reach) plus the nudge, so the tolerance goes with the biggest piece.
      const tol = 0.1 * Math.max(...pieces.map((p) => { const b = bbox(p.pts); return Math.hypot(b.x1 - b.x0, b.y1 - b.y0); }));
      for (const s of seams) {
        assert.ok(s.heat > 0 && s.heat <= 1);
        const b = bbox(s.pts);
        assert.ok(b.x1 - b.x0 > 1 || b.y1 - b.y0 > 1, "seam points are all the same");
        for (const q of s.pts) assert.ok(onCrack(q, pieces, tol), `seam point (${q.x}, ${q.y}) is off the cracks, seed ${seed}`);
      }
      // Negative: seams at random places inside the rectangle (fixed seed) must NOT all pass.
      const rand = seededRandom(seed * 17 + 3);
      const stray = Array.from({ length: 60 }, () => ({ x: (rand() - 0.5) * width, y: (rand() - 0.5) * height }));
      const bad = stray.filter((q) => !onCrack(q, pieces, tol)).length;
      assert.ok(bad >= 30, `only ${bad} of 60 stray points rejected, seed ${seed} ${width}x${height}`);
    }
  }
});

test("a missing or zero size does not throw or give NaN", () => {
  for (const size of [{}, { width: 0, height: 0 }, { width: 0, height: 100 }, { width: 100 }, undefined]) {
    const r = charLayout({ seed: 2 }, size);
    const pts = [...r.pieces.flatMap((p) => p.pts), ...r.seams.flatMap((s) => s.pts), ...r.wisps, { x: r.scorch.rx, y: r.scorch.ry }];
    for (const q of pts) assert.ok(Number.isFinite(q.x) && Number.isFinite(q.y), "NaN coordinate");
  }
  assert.doesNotThrow(() => charLayout(undefined, { width: 100, height: 100 }));
});

test("the scorch covers more than the prop, and seams have a heat", () => {
  const r = charLayout({ seed: 5 }, { width: 100, height: 100, grid: 100 });
  assert.ok(r.scorch.rx > 50 && r.scorch.ry > 50);
  assert.ok(r.seams.length >= 1);
  for (const s of r.seams) assert.ok(s.heat > 0 && s.heat <= 1);
});

test("the wreck has 4 to 9 pieces, 1 to 3 wisps, and a dark share on each piece", () => {
  for (let seed = 1; seed <= 40; seed++) {
    const r = charLayout({ seed }, { width: 100 + seed * 7, height: 60 + (seed % 5) * 40, grid: 100 });
    assert.ok(r.pieces.length >= 4 && r.pieces.length <= 9, `pieces ${r.pieces.length}`);
    assert.ok(r.wisps.length >= 1 && r.wisps.length <= 3);
    for (const p of r.pieces) assert.ok(p.dark >= 0 && p.dark <= 1);
  }
  assert.equal(EMBER_MS, 60000);
});
