import test from "node:test";
import assert from "node:assert/strict";
import { tipLayout, COAL_MS } from "../../../scripts/engines/props/prop-tip.mjs";

// This file's own note (R8): a tipped brazier hit from the left.
const note = { seed: 7, cutAngle: Math.PI, pattern: "crush", pieces: 2, spread: 0.2, spin: 40, tint: "none", mark: "dust", from: { x: -50, y: 50 }, walls: [], style: "tip", lights: [] };
const box = { width: 100, height: 100, grid: 100 };

test("coals dim over ten seconds", () => {
  assert.equal(COAL_MS, 10000);
});

test("it lies along the hit, narrower; coals scatter near it", () => {
  const n = { ...note, style: "tip", cutAngle: 0 };
  const L = tipLayout(n, { width: 100, height: 100, grid: 100 });
  assert.ok(L.lying.dx >= 30 && L.lying.dx <= 60 && Math.min(L.lying.sx, L.lying.sy) <= 0.75);
  assert.ok(L.coals.length >= 10 && L.coals.length <= 16 && L.coals.every((c) => Math.hypot(c.x - 50, c.y - 50) <= 120));
  assert.deepEqual(tipLayout(n, { width: 100, height: 100, grid: 100 }), L);
});

test("narrower along the fall only: sx for a sideways fall, sy for a fall down the screen", () => {
  const side = tipLayout({ ...note, cutAngle: 0 }, box).lying, down = tipLayout({ ...note, cutAngle: Math.PI / 2 }, box).lying;
  assert.ok(side.sx >= 0.55 && side.sx <= 0.75 && side.sy === 1, JSON.stringify(side));
  assert.ok(down.sy >= 0.55 && down.sy <= 0.75 && down.sx === 1, JSON.stringify(down));
  assert.ok(down.dy >= 30 && down.dy <= 60 && Math.abs(down.dx) < 1e-9, JSON.stringify(down));
  // pushed toward the top-left, it moves that way, by 0.3-0.6 of its larger side
  const up = tipLayout({ ...note, cutAngle: -Math.PI * 0.75 }, { width: 150, height: 120, grid: 100 }).lying, d = Math.hypot(up.dx, up.dy);
  assert.ok(up.dx < 0 && up.dy < 0 && d >= 45 - 1e-9 && d <= 90 + 1e-9, JSON.stringify(up));
  assert.ok(Math.abs(up.rot) <= 0.3, "it stays about upright on the map, only a slight turn");
});

test("coals are biased along the hit and carry their heat", () => {
  for (const cutAngle of [0, Math.PI / 2, Math.PI, -Math.PI / 4]) {
    const L = tipLayout({ ...note, cutAngle }, box), ux = Math.cos(cutAngle), uy = Math.sin(cutAngle);
    const ahead = L.coals.filter((c) => (c.x - 50) * ux + (c.y - 50) * uy > 0).length;
    assert.ok(ahead >= L.coals.length * 0.8, `${ahead}/${L.coals.length} ahead at ${cutAngle}`);
    for (const c of L.coals) assert.ok(c.r > 0 && c.r <= 10 && c.hot > 0 && c.hot <= 1, JSON.stringify(c));
  }
});

test("seeded: another seed lies differently; a turned tile falls the same way on the map", () => {
  const a = tipLayout({ ...note, cutAngle: 0, seed: 1 }, box), b = tipLayout({ ...note, cutAngle: 0, seed: 2 }, box);
  assert.notDeepEqual(a.coals, b.coals);
  // a tile turned 90° (clockwise): a fall to screen-right is down its own art, so it squashes in y, in tile-local px
  const turned = tipLayout({ ...note, cutAngle: 0 }, { ...box, rotation: 90 });
  assert.ok(turned.lying.sy < 1 && turned.lying.sx === 1 && turned.lying.dx < 1e-9 && turned.lying.dy < -29, JSON.stringify(turned.lying));
  assert.ok(turned.coals.filter((c) => c.y < 50).length >= turned.coals.length * 0.8, "its coals go up its own art");
});

test("coals scale with the grid; a bigger brazier spills more, as far for its size", () => {
  const same = tipLayout({ ...note, cutAngle: 0.4 }, { width: 200, height: 200, grid: 200 });
  assert.ok(same.coals.length >= 10 && same.coals.length <= 16);
  assert.ok(same.coals.every((c) => Math.hypot(c.x - 100, c.y - 100) <= 240 + 1e-9 && c.r <= 20));
  // the mock's brazier: 1.5 squares, so 18-29 coals (1.5^1.5 = 1.84 times as many) within 1.8 squares
  const big = tipLayout({ ...note, cutAngle: 0.1 }, { width: 150, height: 150, grid: 100 });
  assert.ok(big.coals.length >= 18 && big.coals.length <= 29, String(big.coals.length));
  assert.ok(big.coals.every((c) => Math.hypot(c.x - 75, c.y - 75) <= 180 + 1e-9));
});

test("coals spill from its edge where it lies, onward, on the floor", () => {
  for (const seed of [1, 2, 3, 404]) {
    const L = tipLayout({ ...note, seed, cutAngle: 0 }, { width: 150, height: 150, grid: 100 });
    const rim = 75 + L.lying.dx + 75 * L.lying.sx; // its edge where it lies, tile-local x
    const beyond = L.coals.filter((c) => c.x >= rim * 0.9).length;
    assert.ok(beyond >= L.coals.length * 0.75, `${beyond}/${L.coals.length} past ${rim}`);
  }
});
