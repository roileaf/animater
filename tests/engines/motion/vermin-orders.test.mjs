import test from 'node:test';
import assert from 'node:assert/strict';
import { ratStep, batStep, createVermin } from '../../../scripts/engines/motion/vermin.mjs';
import { ORDERABLE, orderPrep, orderAim } from '../../../scripts/engines/motion/animal-orders.mjs';
import { ANIMAL_NAMES } from '../../../scripts/ui/animal-hud.mjs';
import { PLACEABLE, DARK_PLACEABLE } from '../../../scripts/ui/animals-panel.mjs';

// Roi: "make rats and bats steerable by right click the same way the other animals are."

// Whatever is asked of a canvas's context, it does nothing and answers with more of the same.
const blank = () => new Proxy(function () {}, { get: (_, key) => (key === Symbol.toPrimitive ? () => 0 : blank()), apply: () => blank(), set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => blank() }) };
globalThis.Path2D ??= class { moveTo() {} lineTo() {} bezierCurveTo() {} quadraticCurveTo() {} closePath() {} };
class Sprite {
  constructor(texture) { this.texture = texture; this.visible = true; this.tint = 0xffffff; this.anchor = { set() {} }; this.scale = { set() {} }; this.position = { x: 0, y: 0, set(x, y) { this.x = x; this.y = y; } }; }
  destroy() { this.destroyed = true; }
}
class Graphics {
  constructor() { this.visible = true; this.position = { set() {} }; }
  clear() {} lineStyle() {} moveTo() {} lineTo() {} destroy() { this.destroyed = true; }
}
const PIXI = { Sprite, Graphics, Texture: { from: (c) => ({ canvas: c }) } };
const newLayer = () => { const root = { children: [], addChild(c) { root.children.push(c); return c; } }; return createVermin({ PIXI, root: () => root, batsRoot: () => root }); };
const runs = (layer, seconds, how = {}) => { for (let i = 0; i < Math.round(seconds * 60); i++) layer.tick(1 / 60, { lit: () => 0, blocked: () => false, light: () => null, ...how }); };
const far = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

test('a rat and a bat take orders, and are put down by hand where the dark places are', () => {
  assert.ok(ORDERABLE.includes('rat') && ORDERABLE.includes('bat'));
  for (const kind of ORDERABLE) assert.ok(PLACEABLE.some(([k]) => k === kind), `${kind} can be put down by hand`);
  assert.deepEqual([ANIMAL_NAMES.rat, ANIMAL_NAMES.bat], ['Rat', 'Bat']);
  assert.deepEqual([...DARK_PLACEABLE], ['rat', 'bat']);
});

test('told where to go, both are given the mark and nothing else; arrived, they are left to themselves', () => {
  const aim = orderAim({ type: 'go', x: 1000, y: 0 }, { grid: 100 });
  for (const kind of ['rat', 'bat']) {
    const told = orderPrep(kind, { x: 0, y: 0 }, aim, { grid: 100 });
    assert.deepEqual([told.chasing, told.tx, told.ty], [true, 1000, 0], kind);
    assert.equal(orderPrep(kind, { x: 990, y: 0 }, aim, { grid: 100 }).chasing, false, `${kind}: arrived`);
  }
});

test('an ordered rat scurries to the mark, through the light and past the people it would otherwise run from', () => {
  let r = { x: 0, y: 0, angle: Math.PI, speed: 0, wait: 2, chasing: true, tx: 600, ty: 0 };
  for (let i = 0; i < 180; i++) r = ratStep(r, { dt: 1 / 60, grid: 100, lit: () => 1, near: [{ x: 300, y: 0 }], blocked: () => false, random: () => 0.5 });
  assert.ok(far(r, { x: 600, y: 0 }) < 5, `got there (${Math.round(r.x)}, ${Math.round(r.y)})`);
  assert.equal(r.fleeing, false, 'it is not fleeing, it is going somewhere');
});

test('an ordered rat takes the nearest open way round a wall, and waits where it is hemmed in', () => {
  // A wall across its way: x = 200, from y = -100 to y = 100.
  const wall = (a, b) => (a.x < 200) !== (b.x < 200) && a.y > -100 && a.y < 100;
  let r = { x: 0, y: 0, angle: 0, speed: 0, wait: 2, chasing: true, tx: 600, ty: 0 }, seed = 5;
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 600; i++) { const was = r; r = ratStep(r, { dt: 1 / 60, grid: 100, blocked: wall, random }); assert.ok(!wall(was, r), `through the wall at step ${i}`); }
  assert.ok(r.x > 200, `it got round the end of it (x ${Math.round(r.x)}, y ${Math.round(r.y)})`);
  const stuck = ratStep({ x: 10, y: 20, angle: 0, speed: 100, wait: 1, chasing: true, tx: 600, ty: 0 }, { blocked: () => true, random: () => 0.5 });
  assert.deepEqual([stuck.x, stuck.y, stuck.speed], [10, 20, 0]);
});

test('an ordered bat flits over to the mark, and still turns away from a wall', () => {
  let b = { x: 0, y: 0, angle: Math.PI, turn: 0, speed: 100, wait: 0, chasing: true, tx: 500, ty: 0 }, seed = 3;
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 300; i++) b = batStep(b, { dt: 1 / 60, grid: 100, random });
  assert.ok(far(b, { x: 500, y: 0 }) < 120, `it came to the mark (${Math.round(b.x)}, ${Math.round(b.y)})`);
  const wall = (a, c) => (a.x < 200) !== (c.x < 200);
  let w = { x: 100, y: 0, angle: 0, turn: 0, speed: 100, wait: 0, chasing: true, tx: 900, ty: 0 };
  for (let i = 0; i < 1200; i++) { const was = w; w = batStep(w, { dt: 1 / 60, grid: 100, blocked: wall, random }); assert.ok(!wall(was, w), `through the wall at step ${i}`); }
});

test('the layer: a rat and a bat put down by hand, picked out, held still, ordered, and taken away', () => {
  const layer = newLayer();
  layer.sized(100);
  assert.equal(layer.add('crow', { x: 0, y: 0, id: 'x' }), false, 'only its own kinds');
  assert.ok(layer.add('rat', { x: 0, y: 0, id: 'r1' }) && layer.add('bat', { x: 0, y: 400, id: 'b1' }));
  assert.equal(layer.count, 2);
  runs(layer, 0.1);
  const rat = layer.pick(0, 0, 60);
  assert.equal(rat?.kind, 'rat'); assert.equal(rat.id, 'r1');
  assert.equal(layer.pick(0, 400, 60)?.kind, 'bat');
  // Its HUD open: it stays put.
  layer.hold(rat.ref);
  const was = layer.where(rat.ref);
  runs(layer, 1);
  assert.deepEqual(layer.where(rat.ref), was, 'held still while its HUD is open');
  layer.hold(null);
  layer.orders(new Map([['r1', { type: 'go', x: 600, y: 0 }], ['b1', { type: 'go', x: 600, y: 400 }]]));
  runs(layer, 4);
  assert.ok(far(layer.where(rat.ref), { x: 600, y: 0 }) < 150, 'the rat is at its mark, and stays about it');
  assert.ok(far(layer.pick(600, 400, 300) ?? { x: 0, y: 400 }, { x: 600, y: 400 }) < 180, 'the bat is about its mark');
  assert.equal(layer.takeAway(rat.ref), true);
  assert.equal(layer.count, 1);
  layer.removeAdded('b1');
  assert.equal(layer.count, 0);
});

test('the layer: a rat told to follow a token keeps up with it, and wanders again once the order is let go', () => {
  const layer = newLayer();
  layer.sized(100);
  layer.add('rat', { x: 0, y: 0, id: 'r1' });
  runs(layer, 0.1);
  const rat = layer.pick(0, 0, 60), tokenAt = () => ({ x: 700, y: 0 });
  layer.orders(new Map([['r1', { type: 'follow', token: 't' }]]));
  runs(layer, 5, { tokenAt });
  assert.ok(far(layer.where(rat.ref), { x: 700, y: 0 }) < 260, 'it came up beside the token');
  layer.orders(new Map());
  assert.equal(layer.where(rat.ref).order, null, 'let go');
});
