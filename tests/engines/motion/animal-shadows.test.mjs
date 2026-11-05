import test from 'node:test';
import assert from 'node:assert/strict';
import { createFieldLife } from '../../../scripts/engines/motion/field-life.mjs';
import { createPondLife } from '../../../scripts/engines/motion/pond-life.mjs';
import { createTownLife } from '../../../scripts/engines/motion/town-life.mjs';
import { shadowFall, standingCopyFall } from '../../../scripts/engines/motion/movement-feel.mjs';

// Whatever is asked of a canvas's context, it does nothing and answers with more of the same.
const blank = () => new Proxy(function () {}, { get: (_, key) => (key === Symbol.toPrimitive ? () => 0 : blank()), apply: () => blank(), set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => blank() }) };
class Sprite {
  constructor(texture) { this.texture = texture; this.tint = 0xffffff; this.anchor = { set() {} }; this.position = { set() {} }; this.scale = { set() {} }; }
  destroy() {}
}
const PIXI = { Sprite, Texture: { from: (c) => ({ canvas: c, baseTexture: {} }) } };
const layer = () => { const root = { children: [], addChild(c) { root.children.push(c); return c; } }; return root; };
const land = Array.from({ length: 400 }, (_, i) => ({ x: (i % 20) * 100, y: Math.floor(i / 20) * 100 }));
const isShadow = (s) => s.tint === 0x000000;

test('a deer stands on its shadow', () => {
  const floor = layer(), field = createFieldLife({ PIXI, floor: () => floor, sky: layer, glow: layer, high: layer, highShadow: layer });
  field.populate({ spots: land, deer: 1, grid: 100, area: { x: 0, y: 0, width: 2000, height: 2000 }, random: () => 0.5 });
  assert.deepEqual(floor.children.map(isShadow), [true, false]);
});

test('a fox stands on its shadow', () => {
  const floor = layer(), field = createFieldLife({ PIXI, floor: () => floor, sky: layer, glow: layer, high: layer, highShadow: layer });
  field.populate({ spots: land, foxes: 1, grid: 100, area: { x: 0, y: 0, width: 2000, height: 2000 }, random: () => 0.5 });
  assert.deepEqual(floor.children.map(isShadow), [true, false]);
});

test('a duck and a heron stand on their shadows', () => {
  for (const many of [{ ducks: 1 }, { herons: 1 }]) {
    const floor = layer(), pond = createPondLife({ PIXI, floor: () => floor, sky: layer, high: layer, highShadow: layer });
    pond.populate({ waters: land, grid: 100, random: () => 0.5, ...many });
    assert.deepEqual(floor.children.slice(0, 2).map(isShadow), [true, false], Object.keys(many)[0]);
  }
});

test('town animals stand on their shadows', () => {
  const floor = layer(), town = createTownLife({ PIXI, floor: () => floor, sky: layer, high: layer, highShadow: layer });
  town.populate({ spots: land, grid: 100, busy: 'busy', random: () => 0.5 });
  assert.ok(floor.children.length > 1, 'something lives here');
  for (let i = 0; i < floor.children.length; i += 2) assert.deepEqual([isShadow(floor.children[i]), isShadow(floor.children[i + 1])], [true, false], `pair ${i / 2}`);
});

test('a standing animal\'s shadow stays joined to its feet, longer as the sun gets lower', () => {
  const fall = (height) => standingCopyFall(shadowFall({ width: 70, body: 0.9, grounded: true, darkness: 0, grid: 100, sun: { angle: 270, strength: 1, height } }));
  const whole = shadowFall({ width: 70, body: 0.9, grounded: true, darkness: 0, grid: 100, sun: { angle: 270, strength: 1, height: 60 } }), high = fall(60), low = fall(15);
  assert.equal(high.dy, whole.dy / 2);
  assert.equal(high.alpha, whole.alpha);
  assert.ok(Math.abs(low.dy) > Math.abs(high.dy));
  assert.equal(standingCopyFall(null), null);
});
