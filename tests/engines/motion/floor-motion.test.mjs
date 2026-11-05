import test from 'node:test';
import assert from 'node:assert/strict';
import { STEP_LOOKS } from '../../../scripts/engines/motion/region-steps.mjs';
import { MOTIONS, MOST_ANYWHERE, MOST_PER_REGION, areaOf, flameShade, hotSpotsFor, howMany, insideAreas, particleAt, pickSpot } from '../../../scripts/engines/motion/floor-motion.mjs';

const square = [0, 0, 400, 0, 400, 400, 0, 400];

test('every motion belongs to a real look and is complete', () => {
  for (const [look, parts] of Object.entries(MOTIONS)) {
    assert.ok(look in STEP_LOOKS, `${look} is a look`);
    assert.ok(parts.length > 0, `${look} has parts`);
    for (const part of parts) {
      assert.ok(part.rate > 0, `${look}: a rate`);
      assert.ok(part.life[0] > 0 && part.life[1] >= part.life[0], `${look}: a life`);
      assert.ok(part.size[0] > 0 && part.size[1] >= part.size[0], `${look}: a size`);
      assert.ok(part.alpha > 0 && part.alpha <= 1, `${look}: an alpha`);
      assert.ok(['bubble', 'ring', 'rise', 'flame', 'flash', 'drift', 'fling'].includes(part.kind), `${look}: ${part.kind} is a way to move`);
    }
  }
});

test('the looks asked for move', () => {
  for (const look of ['boiling', 'burning', 'steam', 'electric', 'acid', 'lavacracks', 'misty']) assert.ok(MOTIONS[look], `${look} moves`);
  assert.equal(MOTIONS.boiling.some((p) => p.kind === 'bubble' && p.bursts), true, 'boiling bubbles burst');
});

test('a bubble swells, then bursts and is gone', () => {
  const part = MOTIONS.boiling.find((p) => p.kind === 'bubble');
  const at = (u) => particleAt(part, u, { x: 100, y: 100, size: 10, phase: 0 });
  assert.ok(at(0.1).scale < at(0.6).scale, 'it swells');
  assert.ok(at(0.6).alpha > 0);
  assert.equal(at(1).alpha, 0, 'and is gone at the end');
});

test('steam rises and fades both ways; a ring only spreads', () => {
  const steam = MOTIONS.steam[0];
  const at = (u) => particleAt(steam, u, { x: 100, y: 100, size: 40, phase: 1, grid: 100 });
  assert.ok(at(0.8).y < at(0.2).y, 'up the map');
  assert.ok(at(0.5).alpha > at(0).alpha && at(0.5).alpha > at(1).alpha, 'fades in and out');
  const ring = { kind: 'ring', alpha: 0.5 };
  const r = (u) => particleAt(ring, u, { x: 0, y: 0, size: 10, phase: 0 });
  assert.ok(r(0.9).scale > r(0.1).scale && r(0.9).alpha < r(0.1).alpha);
});

test('how many start depends on the region and the time, and carries the remainder', () => {
  assert.deepEqual(howMany({ rate: 1, carry: 0, squares: 4, seconds: 1 }), { count: 4, carry: 0 });
  const small = howMany({ rate: 1, carry: 0, squares: 1, seconds: 0.25 });
  assert.equal(small.count, 0); assert.equal(small.carry, 0.25);
  assert.equal(howMany({ rate: 1, carry: 0.9, squares: 1, seconds: 0.25 }).count, 1);
  assert.ok(howMany({ rate: 100, carry: 0, squares: 100, seconds: 10 }).count <= MOST_PER_REGION, 'never a flood after a stall');
});

test('caps stay low enough to be cheap', () => {
  assert.ok(MOST_PER_REGION <= 100);
  assert.ok(MOST_ANYWHERE <= 400);
});

test('areas are measured and spots stay inside, out of the holes', () => {
  assert.equal(areaOf([square]), 160000);
  const holed = Object.assign(Array.from(square), { holes: [[100, 100, 300, 100, 300, 300, 100, 300]] });
  assert.equal(areaOf([holed]), 120000);
  assert.equal(insideAreas(50, 50, [holed]), true);
  assert.equal(insideAreas(200, 200, [holed]), false, 'in the hole');
  assert.equal(insideAreas(500, 50, [holed]), false);
  let n = 0;
  const random = () => { n = (n + 0.137) % 1; return n; };
  for (let i = 0; i < 50; i++) {
    const spot = pickSpot([holed], random, 10);
    if (spot) assert.equal(insideAreas(spot.x, spot.y, [holed]), true);
  }
  assert.equal(pickSpot([], random, 10), null);
});

test('fire is small tongues in hot spots, not eggs spread evenly', () => {
  const flames = MOTIONS.burning.filter((p) => p.kind === 'flame');
  assert.ok(flames.length > 0);
  for (const flame of flames) { assert.ok(flame.size[1] <= 0.2, 'small'); assert.equal(flame.cluster, true, 'gathered'); }
  assert.equal(hotSpotsFor(1), 2); assert.ok(hotSpotsFor(20) > hotSpotsFor(2)); assert.ok(hotSpotsFor(100000) <= 16, 'a cap');
});

test('a flame narrows to a tip and is hottest low in its middle', () => {
  assert.ok(flameShade(0, 0.15) > flameShade(0, 0.8), 'hotter low than high');
  assert.ok(flameShade(0, 0.3) > flameShade(0.6, 0.3), 'hotter in the middle');
  assert.equal(flameShade(0, 1), 0, 'nothing past the tip');
  assert.equal(flameShade(1, 0.2), 0, 'nothing at its sides');
  assert.equal(flameShade(-1, 0.5), 0);
});
