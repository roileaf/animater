import test from 'node:test';
import assert from 'node:assert/strict';
import { torchPose, flicker, createHeldTorches, torchSide , flameTint, mixHex } from '../../../scripts/engines/motion/held-torch.mjs';

test('the torch is held inside the token’s square, leaning out and up, its flame above the hand', () => {
  const p = torchPose({ x: 500, y: 500, width: 100 }, 100);
  assert.ok(p.hand.x > 525 && p.hand.x < 540, 'near the rim on its side');
  assert.ok(p.top.x < 550 && p.tip.x < 550, 'the flame stays inside the token’s square');
  assert.ok(p.tip.y < p.hand.y && p.tip.x > p.hand.x, 'leaning out and up');
  assert.ok(p.heat.y < p.tip.y && p.top.y < p.heat.y && p.heat.x === p.tip.x, 'the fire burns straight up from the head: its heat, then its tips');
  const left = torchPose({ x: 500, y: 500, width: 100, side: -1 }, 100);
  assert.ok(left.hand.x < 480 && left.tip.x < left.hand.x, 'mirrored on the left');
  const huge = torchPose({ x: 0, y: 0, width: 600 }, 100), tiny = torchPose({ x: 0, y: 0, width: 30 }, 100);
  assert.ok(huge.length <= 100 * 2.2 * 0.38 + 1e-9, 'a Huge creature\'s torch stays torch-sized');
  assert.ok(tiny.length >= 28, 'a Tiny one\'s still shows');
});

test('the flame flickers around its size, differently for each torch', () => {
  const samples = Array.from({ length: 200 }, (_, i) => flicker('a', i / 30));
  const heights = samples.map((f) => f.height);
  assert.ok(Math.min(...heights) > 0.6 && Math.max(...heights) < 1.4);
  assert.ok(Math.max(...heights) - Math.min(...heights) > 0.2, 'it visibly flickers');
  assert.notEqual(flicker('a', 1).height, flicker('b', 1).height);
  assert.deepEqual(flicker('a', 1), flicker('a', 1));
});

test('one drawn torch per visible held light, dropped when the light goes', () => {
  const made = [];
  class Container { constructor() { this.children = []; this.position = { set: (x, y) => Object.assign(this, { x, y }) }; this.destroyed = false; made.push(this); } addChild(...c) { this.children.push(...c); } destroy() { this.destroyed = true; } }
  class Graphics { constructor() { this.position = { set() {} }; } clear() { return this; } lineStyle() { return this; } beginFill() { return this; } endFill() { return this; } drawRoundedRect() { return this; } drawRect() { return this; } drawEllipse() { return this; } drawPolygon() { return this; } drawCircle() { return this; } moveTo() {} lineTo() {} bezierCurveTo() {} }
  const root = new Container();
  const torches = createHeldTorches({ PIXI: { Container, Graphics, BLEND_MODES: { ADD: 1 } }, root: () => root });
  torches.sync([{ key: 'a', x: 0, y: 0, width: 100, visible: true }, { key: 'b', x: 200, y: 0, width: 100, visible: false }]);
  assert.equal(torches.size, 1);
  torches.tick(0.5);
  const box = root.children[0];
  assert.ok(box.x > 20, 'placed at the hand');
  torches.sync([]);
  assert.equal(torches.size, 0);
  assert.ok(box.destroyed);
});

test('sparks rise from the flame now and then, cooling as they go', async () => {
  const { embers } = await import('../../../scripts/engines/motion/held-torch.mjs');
  const seen = Array.from({ length: 120 }, (_, i) => embers('torch', i / 20)).flat();
  assert.ok(seen.length > 0, 'some sparks');
  assert.ok(seen.every((e) => e.y <= 0 && e.life > 0 && e.life <= 1), 'rising, alive');
  assert.ok(embers('torch', 3).length <= 5);
  assert.ok(seen.every((e) => Math.abs(e.x) < 0.15), 'from the heart of the flame, close to its axis');
});

test('each token picks the side that holds its torch: right by default, left, or none', () => {
  assert.equal(torchSide(undefined), 1);
  assert.equal(torchSide(''), 1);
  assert.equal(torchSide('left'), -1);
  assert.equal(torchSide('none'), 0);
});

test('a coloured light burns in its colour; a warm, grey or missing one keeps the natural fire', () => {
  assert.equal(flameTint(null), null);
  assert.equal(flameTint(''), null);
  assert.equal(flameTint('#ff9329'), null, 'torch orange');
  assert.equal(flameTint('#ffd27a'), null, 'candle yellow');
  assert.equal(flameTint('#dddddd'), null, 'near white');
  assert.deepEqual(flameTint('#2a6bff').hex, 0x2a6bff, 'everburning blue');
  assert.equal(flameTint(0x40ff60).hex, 0x40ff60, 'a number (Foundry Color) works too');
  assert.equal(flameTint({ valueOf: () => 0x9a40ff }).hex, 0x9a40ff, 'a Color object');
  assert.equal(mixHex(0x000000, 0xffffff, 0.5), 0x808080);
});
