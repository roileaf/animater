import test from 'node:test';
import assert from 'node:assert/strict';
import { pickable, pickAt, pickBox, centreOf, movedBy, turnedBy, sizedBy, copiesOf, listAfter, growFor, reachOf, SELECT_TURN, SELECT_SIZE } from '../../../scripts/engines/mapbuild/decor-select.mjs';
import { DECOR_KINDS } from '../../../scripts/engines/motion/decor-paint.mjs';
import { turnOf } from '../../../scripts/engines/motion/decorations.mjs';

// Dungeondraft's Select tool against Animater's nothing: "a decoration cannot be selected, moved, rotated, resized,
// deleted on its own, or copied". These are the answers the Select tab writes; the pointer is the shell's.
const at = (kind, x, y, more = {}) => ({ kind, x, y, size: DECOR_KINDS[kind].size, turn: 0, seed: 7, flip: false, ...more });
const near = (a, b) => Math.abs(a - b) < 1e-9;

test('what was placed by hand in every region can be picked, each knowing its region and its place there', () => {
  const items = pickable([{ id: 'r1', brushed: [at('crate', 100, 100), { kind: 'dragon', x: 5, y: 5, size: 1 }] }, { id: 'r2', brushed: [at('bed', 400, 400)] }, { id: 'r3' }]);
  assert.deepEqual(items.map((it) => [it.id, it.i, it.d.kind]), [['r1', 0, 'crate'], ['r2', 0, 'bed']]);
});

test('the one under the pointer: what stands before what lies flat, the smaller of two, the last laid of two alike', () => {
  const rug = { id: 'r', i: 0, d: at('rug', 500, 500) }, barrel = { id: 'r', i: 1, d: at('barrel', 520, 510) }, bed = { id: 'r', i: 2, d: at('bed', 540, 500) };
  assert.equal(pickAt([rug, barrel, bed], 525, 512, 100), barrel, 'the barrel on the rug, not the rug, not the bed beside it');
  assert.equal(pickAt([rug, barrel, bed], 420, 500, 100), rug, 'the rug where only the rug is');
  assert.equal(pickAt([rug, barrel, bed], 900, 900, 100), null);
  const one = { id: 'r', i: 0, d: at('crate', 100, 100) }, two = { id: 'r', i: 1, d: at('crate', 100, 100) };
  assert.equal(pickAt([one, two], 100, 100, 100), two);
  assert.equal(reachOf(at('pebbles', 0, 0), 100), 25, 'a small thing can still be caught');
});

test('a box picks those whose middles are in it, whichever way it was dragged', () => {
  const items = [at('crate', 100, 100), at('crate', 300, 300), at('crate', 500, 100)].map((d, i) => ({ id: 'r', i, d }));
  assert.deepEqual(pickBox(items, { x: 350, y: 350 }, { x: 50, y: 50 }).map((it) => it.i), [0, 1]);
  assert.deepEqual(centreOf([at('crate', 0, 0), at('crate', 100, 200)]), { x: 50, y: 100 });
});

test('moved, it is the same thing somewhere else', () => {
  const bed = at('bed', 100, 100, { turn: 1, prop: { material: 'wood' } });
  assert.deepEqual(movedBy(bed, 40.4, -10.6), { ...bed, x: 140, y: 89 });
});

test('one turns about itself and stays where it is; it turns from where it is seen to stand', () => {
  const crate = at('crate', 100, 100, { turn: 1 });
  const [turned] = turnedBy([crate], SELECT_TURN);
  assert.equal(turned.x, 100); assert.equal(turned.y, 100); assert.equal(turned.fixed, true);
  assert.ok(turnOf(crate) < 1, 'a crate laid by the brush is drawn at less than its own turn');
  assert.ok(near(turnOf(turned), turnOf(crate) + SELECT_TURN), 'so a step of the wheel is a step, not a jump');
  const [again] = turnedBy([turned], SELECT_TURN);
  assert.ok(near(turnOf(again), turnOf(crate) + 2 * SELECT_TURN));
});

test('several turn together, as one thing', () => {
  const [a, b] = turnedBy([at('crate', 0, 0), at('crate', 200, 0)], Math.PI / 2);
  assert.deepEqual([a.x, a.y, b.x, b.y], [100, -100, 100, 100]);
  assert.ok(near(a.turn, Math.PI / 2) && near(b.turn, Math.PI / 2));
});

test('bigger and smaller, within what the kind allows', () => {
  const usual = DECOR_KINDS.crate.size;
  assert.equal(sizedBy([at('crate', 0, 0)], 2)[0].size, usual * 2);
  assert.equal(sizedBy([at('crate', 0, 0)], 100)[0].size, usual * SELECT_SIZE.max);
  assert.equal(sizedBy([at('crate', 0, 0)], 0.001)[0].size, usual * SELECT_SIZE.min);
});

test('a copy is its own thing: set off, with a seed of its own', () => {
  const src = [at('crate', 100, 100, { seed: 11 }), at('crate', 200, 100, { seed: 11 })], copies = copiesOf(src, 50, 50, 99);
  assert.deepEqual(copies.map((d) => [d.x, d.y]), [[150, 150], [250, 150]]);
  assert.ok(copies[0].seed !== 11 && copies[1].seed !== 11 && copies[0].seed !== copies[1].seed);
  assert.equal(src[0].x, 100, 'what was copied is left alone');
});

test('a region\'s list after an edit: changed in place, taken away, added to, never past its most', () => {
  const list = [at('crate', 1, 1), at('barrel', 2, 2), at('bed', 3, 3)];
  const after = listAfter(list, new Map([[0, at('crate', 9, 9)], [1, null]]), [at('rug', 4, 4)]);
  assert.deepEqual(after.map((d) => [d.kind, d.x]), [['crate', 9], ['bed', 3], ['rug', 4]]);
  assert.equal(listAfter(Array.from({ length: 600 }, () => at('crate', 1, 1)), new Map(), [at('rug', 4, 4)]).length, 600);
  assert.equal(listAfter(Array.from({ length: 600 }, () => at('crate', 1, 1)), new Map(), [at('rug', 4, 4)]).at(-1).kind, 'rug');
});

test('a region grows to hold what was carried out of it, and only then', () => {
  const box = { x: 0, y: 0, w: 500, h: 500 };
  assert.deepEqual(growFor([at('crate', 100, 100)], box, 100), []);
  const [round] = growFor([at('bed', 900, 100)], box, 100);
  assert.deepEqual([round.type, round.x, round.y, round.radiusX], ['ellipse', 900, 100, 120]);
  assert.deepEqual(growFor([at('bed', 900, 100)], null, 100), []);
});
