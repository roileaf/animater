import test from 'node:test';
import assert from 'node:assert/strict';
import { bakeArea, bakeBlood, bakeSize, bakeFile, bakeTile, BAKE_LARGEST } from '../../../scripts/engines/motion/blood-bake.mjs';

const rect = { x: 500, y: 300, width: 8000, height: 4000 };

test('the picture is the scene at full size, or as large as a card takes for sure', () => {
  assert.deepEqual(bakeSize({ width: 2000, height: 1000 }), { width: 2000, height: 1000, scale: 1 });
  const big = bakeSize(rect);
  assert.equal(big.width, BAKE_LARGEST);
  assert.equal(big.height, BAKE_LARGEST / 2);
  assert.equal(big.scale, BAKE_LARGEST / 8000);
});

test('each bake gets its own file, safe in a path', () => {
  assert.equal(bakeFile('abc123', 99), 'blood-abc123-99.webp');
  assert.equal(bakeFile('a/../b', 1), 'blood-ab-1.webp');
  assert.notEqual(bakeFile('s', 1), bakeFile('s', 2));
});

test('the tile covers the scene, on the level shown, under the other tiles', () => {
  const tile = bakeTile({ src: 'p.webp', rect, elevation: 5, levels: ['L'], lowestSort: -3 });
  // A tile's x and y are where its anchor sits, and its anchor is its middle unless told otherwise: the corner, so it lies on the scene.
  assert.deepEqual(tile, { texture: { src: 'p.webp', anchorX: 0, anchorY: 0 }, x: 500, y: 300, width: 8000, height: 4000, elevation: 5, sort: -4, levels: ['L'] });
  assert.equal('levels' in bakeTile({ src: 'p', rect }), false);
});

test('a bake draws, stores and lays in that order; a failure lays nothing', async () => {
  const calls = [], root = {};
  const steps = { draw: async (r, size) => { calls.push(['draw', r === root, size.width]); return 'canvas'; }, store: async (picture, name) => { calls.push(['store', picture, name]); return `worlds/w/${name}`; }, lay: async (tile) => { calls.push(['lay', tile.texture.src]); } };
  const src = await bakeBlood({ root, rect, sceneId: 's', now: 7, ...steps });
  assert.equal(src, 'worlds/w/blood-s-7.webp');
  assert.deepEqual(calls.map((c) => c[0]), ['draw', 'store', 'lay']);
  calls.length = 0;
  await assert.rejects(bakeBlood({ root, rect, sceneId: 's', ...steps, store: async () => { throw new Error('no permission'); } }), /no permission/);
  assert.equal(calls.some((c) => c[0] === 'lay'), false);
  await assert.rejects(bakeBlood({ root, rect, sceneId: 's', ...steps, store: async () => null }), /could not be saved/);
  await assert.rejects(bakeBlood({ root: null, rect, ...steps }), /no scene/);
});

test('a bake covers only where the blood is, inside the scene, in whole pixels', async () => {
  const scene = { x: 100, y: 100, width: 10000, height: 8000 };
  assert.deepEqual(bakeArea([{ x: 500.5, y: 600, width: 60, height: 80 }], scene, 0), { x: 450, y: 550, width: 101, height: 100 });
  const far = bakeArea([{ x: 500, y: 600, width: 60, height: 80 }, { x: 900, y: 1000, width: 60, height: 80 }], scene, 0);
  assert.deepEqual(far, { x: 450, y: 550, width: 500, height: 500 });
  assert.equal(bakeSize(far).scale, 1, 'at the map\'s own resolution, on a map far too big to bake whole');
  assert.ok(bakeSize(scene).scale < 0.5);
  const edge = bakeArea([{ x: 110, y: 110, width: 100, height: 100 }], scene);
  assert.equal(edge.x, 100, 'never past the scene');
  assert.equal(edge.y, 100);
  assert.equal(bakeArea([], scene), null);
  assert.equal(bakeArea([{ x: -500, y: -500, width: 10, height: 10 }], scene), null);
  const laid = [], drew = [];
  await bakeBlood({ root: {}, rect: scene, marks: [{ x: 500, y: 600, width: 60, height: 80 }], sceneId: 's', draw: async (r, size, area) => { drew.push(area); return {}; }, store: async () => 'p.webp', lay: async (tile) => laid.push(tile) });
  assert.equal(laid[0].width, drew[0].width);
  assert.ok(laid[0].width < 200, 'the tile only as big as the blood');
  assert.equal(laid[0].x, drew[0].x);
  await assert.rejects(bakeBlood({ root: {}, rect: scene, marks: [], sceneId: 's', draw: async () => ({}), store: async () => 'p', lay: async () => {} }), /no blood/);
});
