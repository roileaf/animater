import test from 'node:test';
import assert from 'node:assert/strict';
import { strikePlace, strikeAngle, boltDue, boltPath, boltLevel, BOLT_SECONDS } from '../../../scripts/engines/motion/lightning-bolt.mjs';

const seq = (...v) => { let i = 0; return () => v[i++ % v.length]; };
const RECT = { x: 100, y: 200, width: 1000, height: 800 };
const within = (p) => p.x >= RECT.x && p.x <= RECT.x + RECT.width && p.y >= RECT.y && p.y <= RECT.y + RECT.height;

test('a strike lands on the scene or off past one of its edges', () => {
  const on = strikePlace(seq(0.1, 0.5, 0.5), RECT, 100);
  assert.equal(on.inside, true);
  assert.ok(within(on));
  for (const side of [0.1, 0.3, 0.6, 0.9]) {
    const off = strikePlace(seq(0.9, side, 0.5, 0.5), RECT, 100);
    assert.equal(off.inside, false);
    assert.ok(!within(off), String(side));
  }
});

test('its light comes from where it struck', () => {
  assert.equal(strikeAngle({ x: 2000, y: 600 }, RECT), 0);
  assert.equal(strikeAngle({ x: 600, y: 2000 }, RECT), 90);
});

test('a bolt runs from its start to its end, jagged', () => {
  const from = { x: 0, y: 0 }, to = { x: 0, y: 1000 }, path = boltPath(Math.random, from, to);
  assert.equal(path[0], from);
  assert.equal(path.at(-1), to);
  assert.equal(path.length, 33);
  assert.ok(path.some((p) => Math.abs(p.x) > 1), 'not a ruled line');
  for (const p of path) assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
});

test('it strikes, all but goes, strikes again and fades, and is gone; steady for less motion', () => {
  assert.equal(boltLevel(0), 1);
  assert.ok(boltLevel(0.08) < 0.3);
  assert.ok(boltLevel(0.15) > 0.8);
  assert.ok(boltLevel(0.3) < boltLevel(0.2));
  assert.equal(boltLevel(BOLT_SECONDS), 0);
  assert.ok(boltLevel(0.08, true) > 0.7, 'no dip');
});

test('a bolt on the scene is rare: most flashes are far off', () => {
  assert.equal(boltDue(5000, 1, () => 0), false, 'never right after the last, however fierce');
  assert.equal(boltDue(19000, 1, () => 0), false);
  assert.equal(boltDue(20000, 1, () => 0), true);
  assert.equal(boltDue(40000, 0.5, () => 0), true);
  assert.equal(boltDue(39000, 0.5, () => 0), false, 'a milder storm waits longer');
  assert.equal(boltDue(90000, 0.5, () => 0.9), false, 'and then only one flash in a few');
  assert.equal(strikePlace(() => 0.5, RECT, 100, 0).inside, false, 'an off-scene flash when none is due');
});

test('a strike can come down through an opening, more often the bigger it is', async () => {
  const { openingStrike, polygonArea } = await import('../../../scripts/engines/motion/lightning-bolt.mjs');
  const rect = { x: 0, y: 0, width: 1000, height: 1000 }, hole = [100, 100, 300, 100, 300, 300, 100, 300];
  assert.equal(polygonArea(hole), 40000);
  const roll = (...values) => { let i = 0; return () => values[i++ % values.length]; };
  assert.equal(openingStrike({ random: roll(0.9), areas: [hole], rect }), null, 'most strikes land elsewhere');
  const hit = openingStrike({ random: roll(0.1, 0.5, 0.5, 0.5), areas: [hole], rect });
  assert.deepEqual(hit, { x: 200, y: 200, inside: true, opening: true });
  assert.equal(openingStrike({ random: roll(0.3), areas: [[0, 0, 10, 0, 10, 10, 0, 10]], rect }), null, 'a tiny hole only now and then');
  assert.ok(openingStrike({ random: roll(0.3), areas: [[0, 0, 400, 0, 400, 400, 0, 400]], rect }), 'a wide one more often');
  assert.ok(openingStrike({ random: roll(0.99, 0.5), areas: [hole], rect, always: true }), 'underground it has nowhere else to go');
  assert.equal(openingStrike({ random: roll(0.1, 0.5), areas: [hole], rect, inside: () => false }), null, 'never outside the opening');
  assert.equal(openingStrike({ areas: [], rect }), null);
});
