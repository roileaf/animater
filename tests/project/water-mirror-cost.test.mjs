import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mirrorsOf } from '../../scripts/engines/motion/water-mirror.mjs';

// A performance reading of a farm scene: "the water mirror's look pass in skyTick calls movementFeelFloor() for every visible
// token, even when nothing has moved... about 13,300 rectangle checks a pass, 14.6 ms, 13.5 times a second", about a fifth of
// the main thread. The reading is only wanted where it can change what is drawn, and then it is kept.
const main = readFileSync(new URL('../../scripts/main.mjs', import.meta.url), 'utf8');
const square = (x, y, s) => [x, y, x + s, y, x + s, y + s, x, y + s];
const pond = square(1000, 1000, 600);
const token = (over = {}) => ({ id: 'a', texture: { valid: true }, x: 1300, y: 900, w: 100, h: 100, rotation: 0, alpha: 1, ...over });

// Why the floor may go unasked: dry is read only to tell whether a token is wading, and a token is only wading where its own
// middle is in the water. Out on the land the answer changes nothing, so it is not worth a reading of the floor.
test('whether a token is dry only shows in its reflection where it stands in the water', () => {
  const ashore = (dry) => mirrorsOf(token({ dry }), [pond], { grid: 100 });
  assert.ok(ashore(true).length > 0, 'a token by the pond reflects into it');
  assert.deepEqual(ashore(false), ashore(true), 'and from the bank, dry or not, it reflects the same');
  const wading = (dry) => mirrorsOf(token({ x: 1300, y: 1300, dry }), [pond], { grid: 100 });
  assert.notDeepEqual(wading(false), wading(true), 'standing in it, wading shows: only the one copy down the map');
  assert.equal(wading(false).length, 1);
});

test('the mirror asks the floor only about tokens standing on its own water', () => {
  assert.match(main, /dry: mirrorDryOf\(t\),/, 'the look pass no longer reads the floor itself');
  const of = main.slice(main.indexOf('const mirrorDryOf ='), main.indexOf('const tickWater ='));
  assert.match(of, /if \(!mirrorOverWater\(centre\)\) return true;/, 'off the water it is dry for nothing');
  assert.match(of, /movementFeelFloor\(centre, token\.document\)/, 'on it, the floor is read as before');
  // The outline is the mirror's own water, and a box about it keeps most tokens from being traced at all.
  const over = main.slice(main.indexOf('const mirrorOverWater ='), main.indexOf('const mirrorDry = new Map()'));
  assert.match(over, /point\.x < box\.x0 \|\| point\.x > box\.x1 \|\| point\.y < box\.y0 \|\| point\.y > box\.y1/);
  assert.match(over, /pointInPolygon\(point, box\.area\)/);
  assert.match(main, /for \(const area of \[\.\.\.calmWater, \.\.\.glintWater\]\)/, 'the boxes are the water the mirror was given');
});

test('a reading of the floor is kept while the token, the ground and the regions stand still', () => {
  const of = main.slice(main.indexOf('const mirrorDryOf ='), main.indexOf('const tickWater ='));
  assert.match(of, /const key = `\$\{Math\.round\(centre\.x\)\},\$\{Math\.round\(centre\.y\)\},\$\{elevation\},\$\{floorGen\}`;/, 'by place, height and the floor it was read from');
  assert.match(of, /was\.key === key && now - was\.at < 1000/, 'and not for longer than a second');
  assert.match(of, /mirrorDry\.set\(token\.id, \{ key, at: now, dry \}\)/);
  // A region, tile or scene change drops the floor's reading, and counting that up drops what was kept of it.
  assert.match(main, /const forgetPlanes = \(\) => \{ floorCache = null; floorGen\+\+; \};/);
  assert.match(main, /forgetMirrorDry\(\);/, 'and leaving the scene lets the rest go');
});
