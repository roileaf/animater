import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeOrder, orderAim, orderChasing, orderPrep, ORDERABLE } from '../../../scripts/engines/motion/animal-orders.mjs';
import { placedList, withOrder, withoutId, withPlaced, PLACEABLE } from '../../../scripts/ui/animals-panel.mjs';
import { animalHudHTML } from '../../../scripts/ui/animal-hud.mjs';

// Roi: "add option to click on an animal to move it somewhere specific? like if i set animal target it will
// rotate\follow around that target token" · "yes, like a small token hud on animal GM only".

test('orders as kept: go to a spot, follow or circle a token; anything else is none', () => {
  assert.deepEqual(normalizeOrder({ type: 'go', x: 10.4, y: '20' }), { type: 'go', x: 10, y: 20 });
  assert.deepEqual(normalizeOrder({ type: 'circle', token: 'abc' }), { type: 'circle', token: 'abc' });
  assert.equal(normalizeOrder({ type: 'follow' }), null);
  assert.equal(normalizeOrder({ type: 'dance', token: 'a' }), null);
  for (const kind of ORDERABLE) assert.ok(PLACEABLE.some(([k]) => k === kind), `${kind} can be put down by hand`);
});

test('where it makes for: the spot; a square short of the token on its side; round and round the token', () => {
  const tokenAt = (id) => (id === 't' ? { x: 500, y: 500 } : null);
  const go = orderAim({ type: 'go', x: 100, y: 200 }, { grid: 100 });
  assert.deepEqual([go.x, go.y], [100, 200]);
  const follow = orderAim({ type: 'follow', token: 't' }, { tokenAt, grid: 100, from: { x: 900, y: 500 } });
  assert.deepEqual([Math.round(follow.x), Math.round(follow.y)], [600, 500]);
  const a = orderAim({ type: 'circle', token: 't' }, { tokenAt, grid: 100, time: 0 }), b = orderAim({ type: 'circle', token: 't' }, { tokenAt, grid: 100, time: 2 });
  assert.ok(Math.abs(Math.hypot(a.x - 500, a.y - 500) - 170) < 1e-6 && Math.hypot(a.x - b.x, a.y - b.y) > 50, 'the mark runs round the token');
  assert.equal(orderAim({ type: 'follow', token: 'gone' }, { tokenAt }), null, 'its token not here: no mark');
});

test('it sets off past far and keeps on till settled (no dithering at the edge)', () => {
  const aim = { x: 0, y: 0, settle: 50, far: 130 };
  assert.equal(orderChasing({ x: 100, y: 0 }, aim), false);
  assert.equal(orderChasing({ x: 140, y: 0 }, aim), true);
  assert.equal(orderChasing({ x: 100, y: 0, chasing: true }, aim), true);
  assert.equal(orderChasing({ x: 40, y: 0, chasing: true }, aim), false);
});

test('each kind goes its own way: deer and wolves walk there, a fox trots, a rabbit hops, a bird flies, a squirrel dashes, a snake slides', () => {
  const aim = { x: 1000, y: 0, settle: 50, far: 130 };
  assert.deepEqual(['mode', 'tx', 'ty'].map((k) => orderPrep('deer', { x: 0, y: 0, mode: 'graze' }, aim)[k]), ['arrive', 1000, 0]);
  assert.equal(orderPrep('wolf', { x: 0, y: 0, mode: 'rest' }, aim).mode, 'arrive');
  const fox = orderPrep('fox', { x: 0, y: 0, mode: 'look', a: 0 }, aim);
  assert.equal(fox.mode, 'trot'); assert.ok(Math.abs(fox.want - Math.PI / 2) < 1e-9, 'faces east (0 is up the map)');
  const rabbit = orderPrep('rabbit', { x: 0, y: 0, mode: 'sit' }, aim);
  assert.equal(rabbit.mode, 'hop'); assert.ok(rabbit.hops >= 2);
  const bird = orderPrep('songbird', { x: 0, y: 0, mode: 'ground' }, aim, { grid: 100 });
  assert.equal(bird.mode, 'up'); assert.ok(bird.vx > 0 && Math.abs(bird.vy) < 1e-9);
  assert.equal(orderPrep('squirrel', { x: 0, y: 0, mode: 'forage' }, aim).mode, 'dash');
  assert.equal(orderPrep('snake', { x: 0, y: 0, mode: 'lie' }, aim).mode, 'slide');
  assert.equal(orderPrep('deer', { x: 990, y: 0, mode: 'graze' }, aim).mode, 'graze', 'arrived: left to itself');
});

test('the order stays on the placed animal: set, changed, cleared, the animal removed', () => {
  let list = withPlaced([], { id: 'a1', kind: 'wolf', x: 1, y: 2, order: { type: 'follow', token: 't1' } });
  assert.deepEqual(list[0].order, { type: 'follow', token: 't1' });
  list = withOrder(list, 'a1', { type: 'go', x: 5, y: 6 });
  assert.deepEqual(placedList(list)[0].order, { type: 'go', x: 5, y: 6 });
  list = withOrder(list, 'a1', null);
  assert.equal('order' in list[0], false);
  assert.deepEqual(withoutId(list, 'a1'), []);
});

test('the HUD: its name and what it is doing, the order lit, Let it go only with an order, Remove only for a placed one', () => {
  const wild = animalHudHTML({ kind: 'deer' });
  assert.match(wild, /<b>Deer<\/b><small>Wandering</);
  assert.doesNotMatch(wild, /data-ahud="release"|data-ahud="remove"/);
  const held = animalHudHTML({ kind: 'hawk', placed: true, order: { type: 'circle', token: 't' }, tokenName: 'Silva' });
  assert.match(held, /Circling Silva/);
  assert.match(held, /an-ahud-btn active" data-ahud="circle"/);
  assert.match(held, /data-ahud="release"/); assert.match(held, /data-ahud="remove"/);
  assert.match(animalHudHTML({ kind: 'fox', picking: 'follow' }), /Click a token to follow/);
});

test('main: GM-only right-click on an animal opens its HUD; orders saved on the placed animal and handed to the layers', () => {
  const main = readFileSync(new URL('../../../scripts/main.mjs', import.meta.url), 'utf8');
  assert.match(main, /globalThis\.window\?\.addEventListener\?\.\("pointerdown", \(e\) => \{\s*if \(!game\.user\?\.isGM \|\| !canvas\?\.ready \|\| e\.target !== canvas\.app\?\.view \|\| animalAim \|\| animalPick\) return;/);
  assert.match(main, /wildlife\.orders\(orders\); fieldLife\.orders\(orders\);/);
  // Roi: "STOP the animal movement when right clicking it!"
  assert.match(main, /hit\.engine\.hold\(hit\.ref\);/);
  assert.match(main, /onClose: \(\) => \{ endAnimalPick\(\); animalHud = null; hit\.engine\.hold\(null\); \}/);
  for (const file of ['wildlife', 'field-life']) {
    const src = readFileSync(new URL(`../../../scripts/engines/motion/${file}.mjs`, import.meta.url), 'utf8');
    assert.match(src, /hold\(ref\) \{ held(View|Body) = ref\?\.(view|body) \?\? null; \}/);
  }
  assert.match(main, /tokenAt: animalTokenAt \}\);/);
  assert.match(main, /savePlaced\(withPlaced\(list, \{ id: foundry\.utils\.randomID\(\), kind: hit\.kind, x: Math\.round\(at\.x\), y: Math\.round\(at\.y\), order \}\)\)/);
});
