import test from "node:test";
import assert from "node:assert/strict";
import { charLayout, EMBER_MS } from "../../../scripts/engines/props/char-layout.mjs";

test("the same seed lays out the same wreck, and a different seed a different one", () => {
  const a = charLayout({ seed: 7 }, { width: 200, height: 100, grid: 100 });
  assert.deepEqual(a, charLayout({ seed: 7 }, { width: 200, height: 100, grid: 100 }));
  assert.notDeepEqual(a.pieces, charLayout({ seed: 8 }, { width: 200, height: 100, grid: 100 }).pieces);
});

test("every piece stays inside the prop's own outline", () => {
  const { pieces } = charLayout({ seed: 3 }, { width: 200, height: 100, grid: 100 });
  assert.ok(pieces.length >= 4);
  for (const p of pieces) for (const q of p.pts) { assert.ok(Math.abs(q.x) <= 100, `x ${q.x}`); assert.ok(Math.abs(q.y) <= 50, `y ${q.y}`); }
});

test("the scorch covers more than the prop, and the seams sit on the pieces", () => {
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
  assert.ok(EMBER_MS > 0);
});
