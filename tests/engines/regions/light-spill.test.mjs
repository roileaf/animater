import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spillPieces, lightPasses, reachableParts } from '../../../scripts/engines/regions/light-spill.mjs';

// Roi: "ezren holding a torch next to the wall which is 0-10 and the slope is 40 ft yet the wall shadow is on its top?", then "Build it".
const sq = (x0, y0, x1, y1) => [x0, y0, x1, y0, x1, y1, x0, y1];
test('a wall lets light past only onto ground at least as high as it', () => {
  assert.ok(lightPasses(10, 20)); assert.ok(lightPasses(20, 20)); assert.ok(!lightPasses(30, 20)); assert.ok(!lightPasses(null, 20), 'a wall to the ceiling stops it');
});
test('the light reaching raised ground is kept on that ground and only where it did not already fall', async () => {
  let ClipperLib; try { ClipperLib = createRequire(import.meta.url)('clipper-lib'); } catch { ClipperLib = null; }
  if (!ClipperLib) { assert.equal(spillPieces({ ClipperLib: null, reach: sq(0, 0, 10, 10), raised: [sq(0, 0, 5, 5)] }).length, 0); return; }
  const pieces = spillPieces({ ClipperLib, reach: sq(0, 0, 400, 400), raised: [sq(200, 0, 400, 400)], lit: sq(0, 0, 300, 400), least: 1 });
  assert.equal(pieces.length, 1); const xs = pieces[0].filter((_, i) => i % 2 === 0); assert.ok(Math.min(...xs) >= 299 && Math.max(...xs) <= 401);
});
test('only the raised parts a light can reach, by height', () => {
  const groups = reachableParts([{ height: 20, areas: [sq(100, 100, 200, 200)] }, { height: 5, areas: [sq(5000, 5000, 5100, 5100)] }], { x: 0, y: 0, radius: 150 });
  assert.equal(groups.length, 1); assert.equal(groups[0].height, 20);
});