import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decorHeight, shadowReach } from '../../../scripts/engines/motion/decorations.mjs';
import { DECOR_KINDS } from '../../../scripts/engines/motion/decor-paint.mjs';

// Roi: "shouldnt bigger decorations cast bigger shadows?" A crate painted three times its size threw a normal crate's shadow.
test('a decoration stands as tall as it is painted big, so its shadow grows with it', () => {
  const k = DECOR_KINDS.crate;
  assert.equal(decorHeight({ kind: 'crate', size: k.size }), k.height);
  assert.ok(Math.abs(decorHeight({ kind: 'crate', size: k.size * 3 }) - k.height * 3) < 1e-9);
  assert.ok(Math.abs(decorHeight({ kind: 'crate', size: k.size * 0.5 }) - k.height * 0.5) < 1e-9);
  assert.ok(shadowReach(decorHeight({ kind: 'crate', size: k.size * 3 }), 1, 100) > shadowReach(decorHeight({ kind: 'crate', size: k.size }), 1, 100) * 2.9);
  assert.equal(decorHeight({ kind: 'nonsense', size: 1 }), 0);
});

// Roi: "maybe we can add decoration height slider", "height slider in the region popup too".
test('a decoration\'s own Height, and its region\'s, make it taller or shorter than its size alone', async () => {
  const { decorSettings, decorPlacements } = await import('../../../scripts/engines/motion/decor-regions.mjs');
  const k = DECOR_KINDS.crate;
  assert.ok(Math.abs(decorHeight({ kind: 'crate', size: k.size, tall: 2 }) - k.height * 2) < 1e-9);
  assert.ok(Math.abs(decorHeight({ kind: 'crate', size: k.size, tall: 99 }) - k.height * 3) < 1e-9, 'never past 3');
  assert.ok(Math.abs(decorHeight({ kind: 'crate', size: k.size, tall: 0 }) - k.height * 0.3) < 1e-9, 'never under 0.3');
  assert.equal(decorSettings({ on: true }).height, 1);
  assert.equal(decorSettings({ on: true, height: 9 }).height, 3);
  const area = [[0, 0, 1000, 0, 1000, 1000, 0, 1000]], crate = { kind: 'crate', x: 500, y: 500, size: k.size, seed: 4 };
  const at = (raw) => decorPlacements({ settings: decorSettings({ on: true, density: 0, ...raw }), areas: area, grid: 100, id: 'r' })[0];
  assert.equal(at({ brushed: [crate] }).tall, undefined, 'at 1 nothing is added');
  assert.equal(at({ brushed: [crate], height: 2 }).tall, 2);
  assert.equal(at({ brushed: [{ ...crate, tall: 1.5 }], height: 2 }).tall, 3, 'the region\'s Height times the decoration\'s own');
  assert.equal(at({ brushed: [{ ...crate, tall: 1.5 }], height: 2 }).seed, 4, 'the same decoration: its breaks keep');
});

test('the brush bar and the region panel each have a Height slider', async () => {
  const { BRUSH_TALL, brushChoices } = await import('../../../scripts/ui/decor-brush-bar.mjs');
  assert.deepEqual({ ...BRUSH_TALL }, { min: 0.3, max: 3, usual: 1 });
  assert.equal(brushChoices().tall, 1);
  const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
  assert.match(read('scripts/ui/decor-brush-bar.mjs'), /slider\('Decoration height', BRUSH_TALL, 'tall', 0\.1\)/);
  assert.match(read('scripts/main.mjs'), /const withProp = \(d\) => \{ const c = brushChoices\(\), look = d && c\.tall !== 1 \? \{ \.\.\.d, tall: c\.tall \} : d;/);
  assert.match(read('scripts/ui/region-panel-sections.mjs'), /range\('Height', DECOR_TALL, Number\(decor\.height \?\? 1\), percent, \(v\) => act\(\{ decor: \{ height: v \} \}\)/);
});

test('sun shadows, lamp shadows and the canopy all take the painted height', () => {
  const src = readFileSync(new URL('../../../scripts/engines/motion/decorations.mjs', import.meta.url), 'utf8');
  assert.match(src, /const reach = shadowReach\(decorHeight\(d\), sun\.length, grid\(\)\)/);
  assert.match(src, /r\.casters\.push\(\{ d, pic, scale, height: decorHeight\(d\), shadows: \[\] \}\)/);
  assert.match(src, /up: decorHeight\(d\)/);
  assert.doesNotMatch(src, /shadowReach\(k\.height/);
});
