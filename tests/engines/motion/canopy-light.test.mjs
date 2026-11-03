import test from 'node:test';
import assert from 'node:assert/strict';
import { tileSunlight, tileHeight, tileLeaves, LEAVES, solidShare, canopyFall } from '../../../scripts/engines/motion/canopy-light.mjs';

test('Auto counts an overhead tile named as a tree as a tree, one named as a building as a roof', () => {
  for (const src of ['assets/FA_Trees/Tree_Oak_A_01.webp', 'maps/forest-canopy.png', 'Pine%20Tree%2003.webp', 'tiles/Bush_Large_02.png', 'tc/Willow_Tree.webp', 'tree%20tile%20bokken.webp'])
    assert.equal(tileSunlight({ src, overhead: true }), 'tree', src);
  for (const src of ['roofs/Roof_Thatch_01.webp', 'tiles/tavern_roof.png', 'bokken%20roof.webp', 'bokken%20outhouse.webp', 'Tower_Stone.webp', 'camp/Tent_02.png'])
    assert.equal(tileSunlight({ src, overhead: true }), 'roof', src);
  for (const src of ['props/barrel.png', 'fx/Fog_Overlay.webm', 'birds_flock.webp', 'maps/firepit.png'])
    assert.equal(tileSunlight({ src, overhead: true }), null, src);
  // On the floor (not overhead): nothing of its own.
  assert.equal(tileSunlight({ src: 'Tree_Oak_A_01.webp', overhead: false }), null);
});

test('a tile named a tree but drawn as a solid block is a roof; a solid unnamed one too; a ragged shape alone is no tree', () => {
  assert.equal(tileSunlight({ src: 'Tree_Oak.webp', overhead: true, solid: 0.98 }), 'roof');
  assert.equal(tileSunlight({ src: 'Tree_Oak.webp', overhead: true, solid: 0.6 }), 'tree');
  assert.equal(tileSunlight({ src: 'overhead_02.webp', overhead: true, solid: 0.9 }), 'roof');
  assert.equal(tileSunlight({ src: 'overhead_02.webp', overhead: true, solid: 0.5 }), null);
});

test('a tile’s own choice decides, whatever its name or height', () => {
  assert.equal(tileSunlight({ src: 'roof.png', choice: 'tree' }), 'tree');
  assert.equal(tileSunlight({ src: 'Tree_Oak.webp', overhead: true, choice: 'none' }), null);
  assert.equal(tileSunlight({ src: 'barrel.png', choice: 'roof' }), 'roof');
  assert.equal(tileSunlight({ src: 'Tree_Oak.webp', overhead: true, choice: '' }), 'tree', 'Auto');
});

test('solidShare: how much of a picture is solid inside its outline', () => {
  const size = 4, img = (alphas) => Uint8ClampedArray.from(alphas.flatMap((a) => [0, 0, 0, a]));
  assert.equal(solidShare(img([0, 0, 0, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 0, 0, 0]), size), 1);
  assert.equal(solidShare(img([255, 0, 255, 0, 0, 255, 0, 255, 255, 0, 255, 0, 0, 255, 0, 255]), size), 0.5);
  assert.equal(solidShare(img(Array(16).fill(0)), size), 0);
  assert.equal(solidShare(null), null);
});

test('canopyFall: the shade falls away from the light, long when it is low, none in the dark', () => {
  const noon = canopyFall({ angle: -90, height: 70, strength: 1 }, { height: 3, grid: 100 });
  assert.ok(Math.abs(noon.dir[0]) < 1e-9 && noon.dir[1] > 0.99);
  assert.ok(noon.shift[1] > 0 && noon.shift[1] < 150);
  assert.ok(noon.stretch < 1.1);
  const dusk = canopyFall({ angle: 180, height: 12, strength: 1 }, { height: 3, grid: 100 });
  assert.ok(dusk.shift[0] > 500 && dusk.stretch > 2, 'long and drawn out at dusk');
  assert.ok(dusk.shift[0] <= 600, 'never further than six squares');
  assert.equal(canopyFall(null), null);
  assert.equal(canopyFall({ angle: 0, height: 40, strength: 1 }, { darkness: 1 }), null, 'night, no moon');
  assert.ok(canopyFall({ angle: 0, height: 40, strength: 0.3, moon: true }, { darkness: 1 }).light > 0.29);
});

test('a tile that keeps out the light or the weather is a roof, unless it is named a tree', () => {
  assert.equal(tileSunlight({ src: 'overhead_02.webp', overhead: true, restricts: true }), 'roof');
  assert.equal(tileSunlight({ src: 'tree%20tile%20bokken.webp', overhead: true, restricts: true }), 'tree', 'a canopy keeping the rain off');
  assert.equal(tileSunlight({ src: 'overhead_02.webp', overhead: false, restricts: true }), null, 'on the floor');
});

test('tileHeight: its own height, else a roof’s storey, else a tree’s by its name', () => {
  const foot = 0.2, per = 5;
  assert.equal(tileHeight({ kind: 'tree', src: 'Oak_A.webp', own: 40, per, foot }), 8, '40 ft of 5 ft squares');
  assert.equal(tileHeight({ kind: 'roof', src: 'roof.webp', level: { bottom: 0, top: 20 }, per, foot }), 4, 'a 20 ft storey');
  assert.equal(tileHeight({ kind: 'roof', src: 'roof.webp', level: { bottom: 20, top: 30 }, per, foot }), 2, 'an upper storey, from its own floor');
  assert.equal(tileHeight({ kind: 'roof', src: 'roof.webp', per, foot }), 4, 'no level: 20 ft');
  assert.equal(tileHeight({ kind: 'tree', src: 'Pine_Tall_03.webp', per, foot }), 6, 'an oak or pine, 30 ft');
  assert.ok(Math.abs(tileHeight({ kind: 'tree', src: 'Hedge_Long.webp', per, foot }) - 1.2) < 1e-9, 'a hedge, 6 ft');
  assert.equal(tileHeight({ kind: 'tree', src: 'tree%20tile%20bokken.webp', per, foot }), 5, 'a tree, 25 ft');
  assert.equal(tileHeight({ kind: 'tree', src: 'Oak_A.webp', own: '', per, foot }), 6, 'an empty field is Auto');
  // Metres: 1.5 m squares, a foot is 0.3048 / 1.5 of a square.
  assert.ok(Math.abs(tileHeight({ kind: 'tree', src: 'Oak_A.webp', per: 1.5, foot: 0.3048 / 1.5 }) - 30 * 0.3048 / 1.5) < 1e-9);
});

test('tileLeaves: its own choice, else its name, else the gaps in its picture', () => {
  assert.equal(tileLeaves({ src: 'Oak_A.webp', own: 'sparse' }), LEAVES.sparse, 'its own choice first');
  assert.equal(tileLeaves({ src: 'Birch_Tree_02.webp' }), LEAVES.sparse);
  assert.equal(tileLeaves({ src: 'Weeping_Willow.webp' }), LEAVES.sparse);
  assert.equal(tileLeaves({ src: 'Pine_Tall_03.webp' }), LEAVES.dense);
  assert.equal(tileLeaves({ src: 'tree%20tile%20bokken.webp', solid: 0.4 }), LEAVES.sparse, 'a picture with many gaps');
  assert.equal(tileLeaves({ src: 'tree%20tile%20bokken.webp', solid: 0.9 }), LEAVES.dense, 'a full crown');
  assert.equal(tileLeaves({ src: 'tree%20tile%20bokken.webp', solid: 0.7 }), LEAVES.medium);
  assert.equal(tileLeaves({ src: 'tree%20tile%20bokken.webp' }), LEAVES.medium, 'unreadable');
  assert.ok(LEAVES.sparse < LEAVES.medium && LEAVES.medium < LEAVES.dense && LEAVES.dense === 1);
});
