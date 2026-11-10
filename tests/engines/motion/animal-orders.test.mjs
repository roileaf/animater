import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeOrder, orderAim, orderChasing, orderPrep, orderHandles, perchOrderPrep, orderPerch, ORDER_PERCH_KEY, orbitStep, ORBIT, ORDERABLE } from '../../../scripts/engines/motion/animal-orders.mjs';
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

// Roi: "all animals should support that right? now when i right click an animal in a region it just shows me the region popup".
test('the pond, town and farm go their own ways too', () => {
  const near = { x: 200, y: 0, settle: 50, far: 130 }, far = { x: 1000, y: 0, settle: 50, far: 130 };
  assert.equal(orderPrep('duck', { x: 0, y: 0, mode: 'swim', a: 0 }, near, { grid: 100 }).mode, 'swim', 'a duck paddles to a mark close by');
  const duck = orderPrep('duck', { x: 0, y: 0, mode: 'swim' }, far, { grid: 100 });
  assert.equal(duck.mode, 'fly'); assert.deepEqual(duck.to, { x: 1000, y: 0 });
  assert.deepEqual(['mode', 'hx', 'hy'].map((k) => orderPrep('heron', { x: 0, y: 0, mode: 'stand' }, far)[k]), ['fly', 1000, 0]);
  assert.equal(orderPrep('frog', { x: 0, y: 0, mode: 'sit' }, far).hurry, true);
  assert.equal(orderPrep('pigeon', { x: 0, y: 0, mode: 'ground' }, far, { grid: 100 }).stage, 'glide');
  assert.equal(orderPrep('pigeon', { x: 0, y: 0, mode: 'ground' }, near, { grid: 100 }).walk, 1);
  assert.equal(orderPrep('hen', { x: 0, y: 0, mode: 'peck' }, far, { grid: 100 }).mode, 'sprint');
  assert.equal(orderPrep('dog', { x: 0, y: 0, mode: 'nose' }, far).mode, 'trot');
  assert.equal(orderPrep('cow', { x: 0, y: 0, mode: 'graze' }, far, { grid: 100 }).mode, 'flee', 'far off, the farm\'s run');
  assert.equal(orderPrep('horse', { x: 0, y: 0, mode: 'graze' }, near, { grid: 100 }).mode, 'walk');
});

// Roi: "why can't i pick a crow on a rooftop etc?"
test('a bird on a roof or in a tree hops down to its mark, sits there, and hops after it as it moves', () => {
  const aim = { x: 1000, y: 0, settle: 50, far: 130 };
  const sitting = perchOrderPrep({ x: 0, y: 0, mode: 'sit', wait: 9 }, aim, { grid: 100 });
  assert.equal(sitting.wait, 0, 'it goes now'); assert.equal(sitting.chasing, true);
  const flying = perchOrderPrep({ x: 500, y: 0, mode: 'fly', a: 0, lift: 2, to: { x: 0, y: 900 } }, aim, { grid: 100 });
  assert.deepEqual([flying.to.x, flying.to.y, flying.to.key, flying.t], [1000, 0, ORDER_PERCH_KEY, 0], 'turned for where the mark is now');
  assert.equal(flying.from.h, 2, 'from where it is in the air');
  const there = perchOrderPrep({ x: 990, y: 0, mode: 'sit', wait: 9 }, aim, { grid: 100 });
  assert.equal(there.wait, 9, 'arrived: it sits');
  assert.deepEqual(orderPerch({ x: 3, y: 4 }), { x: 3, y: 4, h: 0, kind: 'ground', on: 'ground', face: 0, key: ORDER_PERCH_KEY });
});

// Roi: "birds should circle close to tokens".
test('a bird told to circle goes round close over the token and keeps up as it moves', () => {
  let g = { x: 900, y: 500, angle: 0 };
  for (let i = 0; i < 300; i++) g = orbitStep(g, { x: 500, y: 500 }, { dt: 0.05, grid: 100 });
  assert.ok(Math.abs(Math.hypot(g.x - 500, g.y - 500) - 105) < 2, 'about a square from the token');
  const around = [];
  for (let i = 0; i < 60; i++) { g = orbitStep(g, { x: 500, y: 500 }, { dt: 0.05, grid: 100 }); around.push(Math.atan2(g.y - 500, g.x - 500)); }
  assert.ok(Math.abs(around.at(-1) - around[0]) > 0.5, 'it goes round');
  for (let i = 0; i < 100; i++) g = orbitStep(g, { x: 500 + i * 3, y: 500 }, { dt: 0.05, grid: 100 });
  assert.ok(Math.hypot(g.x - 800, g.y - 500) < 140, 'still close round the token after it has walked off');
  assert.ok(ORBIT.token <= 1.1, 'close to the token, not a wide sweep');
});

test('every layer shares the HUD\'s handles: orders by id, the nearest drawn, held, taken away', () => {
  const body = (x, y) => ({ visible: true, position: { x, y } });
  let list = [{ placed: 'p1', body: body(10, 10) }, { body: body(100, 100) }];
  const gone = [];
  const h = orderHandles(() => [['hen', list]], { remove: (o) => gone.push(o) });
  h.api.orders(new Map([['p1', { type: 'go', x: 5, y: 5 }]]));
  assert.deepEqual(list[0].order, { type: 'go', x: 5, y: 5 }); assert.equal(list[1].order, undefined);
  const hit = h.api.pick(98, 102, 50);
  assert.equal(hit.kind, 'hen'); assert.equal(hit.id, null);
  list = list.map((o) => ({ ...o }));
  h.api.hold(hit.ref); assert.equal(h.held(list[1]), true, 'known by its picture after a step');
  assert.ok(h.api.takeAway(hit.ref)); assert.equal(list.length, 1); assert.equal(gone.length, 1);
  h.api.hold(null); assert.equal(h.held(list[0]), false);
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
  assert.match(main, /const placedLayers = \(\) => \[wildlife, fieldLife, pondLife, townLife, sceneFarm\];/);
  // Found on a GM's server: a region's gull told to circle vanished, the scene's Outdoor life being off. Animals put down by
  // hand show with Animals in the wild on, as a region's do, with ground of their own when the scene has none worked out.
  assert.match(main, /const raw = bothSettingsOn\("wildlife"\) \? animalFlagsNow\(\)\.placedAnimals \?\? \[\] : \[\];/);
  assert.match(main, /placedGround = !wildHere\(\) && placedList\(raw\)\.length \? wildGround\(/);
  assert.match(main, /const wildOk = \(kind, x, y\) => okOn\(wildOpen \?\? placedGround, kind, x, y\);/);
  // Found on a player's screen: the placed gull twice, one on top of the other, after the pond was put back.
  assert.match(main, /for \(const l of placedLayers\(\)\) l\.removeAdded\(p\.id\); placedShown\.delete\(p\.id\);/);
  assert.match(main, /for \(const layer of layers\) layer\.orders\(orders\);/);
  assert.match(main, /for \(const life of regionLife\.values\(\)\) engines\.push\(life\.wild, life\.field, life\.pond, life\.town, life\.farm\);/);
  // Roi: "STOP the animal movement when right clicking it!"
  assert.match(main, /hit\.engine\.hold\(hit\.ref\);/);
  // Roi: "make sure we can still pan": a right-drag that starts on an animal pans; only a click opens its HUD.
  assert.match(main, /canvas\.pan\(\{ x: pivot\.x - dx \/ scale, y: pivot\.y - dy \/ scale \}\);/);
  assert.match(main, /if \(!dragging\) openAnimalHudFor\(hit\);/);
  assert.match(main, /onClose: \(\) => \{ endAnimalPick\(\); animalHud = null; hit\.engine\.hold\(null\); \}/);
  for (const file of ['wildlife', 'field-life']) {
    const src = readFileSync(new URL(`../../../scripts/engines/motion/${file}.mjs`, import.meta.url), 'utf8');
    assert.match(src, /hold\(ref\) \{ held(View|Body) = ref\?\.(view|body) \?\? null; \}/);
  }
  assert.match(main, /tokenAt: animalTokenAt \}\);/);
  assert.match(main, /savePlaced\(withPlaced\(list, \{ id: foundry\.utils\.randomID\(\), kind: hit\.kind, x: Math\.round\(at\.x\), y: Math\.round\(at\.y\), order \}\)\)/);
});
