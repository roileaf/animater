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
