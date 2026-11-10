import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createDecorLights } from '../../../scripts/engines/motion/decor-lights.mjs';

const fakes = () => {
  const made = [], refreshes = { n: 0 };
  const makeSource = (id) => { const s = { id, data: null, added: false, destroyed: false, initialize(d) { s.data = d; }, add() { s.added = true; }, destroy() { s.destroyed = true; } }; made.push(s); return s; };
  return { made, refreshes, makeSource, refresh: () => { refreshes.n++; } };
};

test('each lit decoration gets one light source, in pixels, added to the map', () => {
  const f = fakes(), lights = createDecorLights({ makeSource: f.makeSource, refresh: f.refresh, grid: () => 100 });
  assert.equal(lights.sync([{ id: 'a', x: 10, y: 20, dim: 5, bright: 2, color: '#ffc878', animation: { type: 'torch' } }]), 1);
  assert.equal(f.made.length, 1);
  assert.deepEqual([f.made[0].data.x, f.made[0].data.y, f.made[0].data.dim, f.made[0].data.bright, f.made[0].data.walls, f.made[0].data.vision], [10, 20, 500, 200, true, false]);
  assert.ok(f.made[0].added);
  assert.equal(f.refreshes.n, 1);
});

test('syncing the same lights again changes nothing; a moved one is rebuilt; a gone one is destroyed', () => {
  const f = fakes(), lights = createDecorLights({ makeSource: f.makeSource, refresh: f.refresh });
  const a = { id: 'a', x: 0, y: 0, dim: 2, bright: 1 }, b = { id: 'b', x: 50, y: 0, dim: 2, bright: 1 };
  lights.sync([a, b]); lights.sync([a, b]);
  assert.equal(f.made.length, 2); assert.equal(f.refreshes.n, 1);
  lights.sync([{ ...a, x: 30 }]);
  assert.equal(f.made.length, 3);
  assert.ok(f.made[0].destroyed && f.made[1].destroyed && !f.made[2].destroyed);
  lights.clear(); assert.ok(f.made[2].destroyed); assert.equal(lights.count, 0);
});

test('past the most it keeps, the lights nearest the view win', () => {
  const f = fakes(), lights = createDecorLights({ makeSource: f.makeSource, max: 2, centre: () => ({ x: 0, y: 0 }) });
  lights.sync([{ id: 'far', x: 900, y: 0, dim: 2, bright: 1 }, { id: 'near', x: 10, y: 0, dim: 2, bright: 1 }, { id: 'mid', x: 100, y: 0, dim: 2, bright: 1 }]);
  assert.deepEqual(f.made.map((s) => s.id).sort(), ['mid', 'near']);
});

test('main.mjs builds them as local light sources from the decorations, and clears them with the canvas', () => {
  const main = readFileSync(new URL('../../../scripts/main.mjs', import.meta.url), 'utf8');
  assert.match(main, /makeSource: \(id\) => new CONFIG\.Canvas\.lightSourceClass\(\{ sourceId: `\$\{ID\}\.decor\.\$\{id\}`, object: null \}\)/);
  assert.match(main, /decorLights\.sync\(decorations\.lights\(\)\)/);
  assert.match(main, /decorations\.clear\(\); decorLights\.clear\(\);/);
});

test('a broken brazier or street lamp has no light while broken; repaired, it is lit again (from the stored keys, no documents)', async () => {
  const { createDecorations } = await import('../../../scripts/engines/motion/decorations.mjs');
  const { decorKeyed } = await import('../../../scripts/engines/props/decor-break.mjs');
  const { decorSettings } = await import('../../../scripts/engines/motion/decor-regions.mjs');
  // A stand-in for PIXI and a 2D canvas: enough to paint and place the braziers without a browser.
  const pt = () => ({ x: 0, y: 0, set(x, y = x) { this.x = x; this.y = y; } });
  class Container { constructor() { this.children = []; this.position = pt(); this.scale = pt(); } addChild(c) { this.children.push(c); return c; } removeChild() {} destroy() {} }
  class Sprite extends Container { constructor(texture) { super(); this.texture = texture; this.anchor = pt(); } }
  const PIXI = { Container, Sprite, Texture: { from: () => ({ width: 80, height: 80 }) } };
  const ctx = () => { const p = new Proxy(function () {}, { get: (t, k) => (k === 'data' ? new Uint8ClampedArray(64) : p), set: () => true, apply: () => p }); return p; };
  const make = (w, h) => ({ width: w, height: h, getContext: () => ctx() });
  const layer = () => new Container(), deco = createDecorations({ PIXI, shadows: layer, ground: layer, above: layer, make });
  const brushed = [{ kind: 'brazier', x: 200, y: 200, size: 0.8, turn: 0, seed: 1 }, { kind: 'brazier', x: 600, y: 600, size: 0.8, turn: 0, seed: 2 }, { kind: 'lampPost', x: 800, y: 300, size: 1, turn: 0, seed: 4 }];
  const region = { id: 'R1', settings: decorSettings({ on: true, where: 'town', seed: 3, density: 0, kinds: {}, brushed }), areas: [[0, 0, 1000, 0, 1000, 1000, 0, 1000]], look: {} };
  const keys = decorKeyed(region, 100).map((k) => k.key);
  deco.sync([region]);
  const lit = () => deco.lights().map((l) => [Math.round(l.x), Math.round(l.y)]);
  assert.deepEqual(lit(), [[200, 200], [600, 600], [800, 300]]);
  const ids = deco.lights().map((l) => l.id);
  deco.sync([{ ...region, broken: [keys[0]] }]);
  assert.deepEqual(lit(), [[600, 600], [800, 300]]);
  assert.deepEqual(deco.lights().map((l) => l.id), [ids[1], ids[2]], 'the others keep their ids');
  // A broken street lamp's light goes out the same way (Roi, 2026-11-10).
  deco.sync([{ ...region, broken: [keys[2]] }]);
  assert.deepEqual(lit(), [[200, 200], [600, 600]]);
  deco.sync([region]);
  assert.deepEqual(lit(), [[200, 200], [600, 600], [800, 300]]);
});
