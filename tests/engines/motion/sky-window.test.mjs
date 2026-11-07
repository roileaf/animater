import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GLAZED, SKY_WINDOWS, printOf, skyWindowOf } from '../../../scripts/engines/motion/wall-shadows.mjs';

test('an opening in a roof can hold a window; glass keeps the weather out, a grate does not', () => {
  assert.deepEqual(SKY_WINDOWS.map(([k]) => k), ['', 'glass', 'mosaic', 'leaded', 'rose', 'frosted', 'lattice', 'bars']);
  assert.equal(skyWindowOf({ skyWindow: 'rose' }), 'rose'); assert.equal(skyWindowOf({ skyWindow: 'nonsense' }), ''); assert.equal(skyWindowOf({}), '');
  for (const k of ['glass', 'mosaic', 'leaded', 'rose', 'frosted']) assert.ok(GLAZED.has(k), k);
  for (const k of ['', 'lattice', 'bars']) assert.ok(!GLAZED.has(k), k);
  assert.equal(printOf('glass'), 'cross'); assert.deepEqual(printOf('frosted'), 'frosted');
});

test('a roof opening\'s light keeps to its room: the pool cut to the floor it can reach, the sunlit floor stopped at the wall', () => {
  const main = readFileSync(new URL('../../../scripts/main.mjs', import.meta.url), 'utf8'), cave = readFileSync(new URL('../../../scripts/engines/motion/cavern.mjs', import.meta.url), 'utf8');
  assert.match(main, /room: openingRoom\(areas\) \}\); \}/);
  assert.match(main, /const s = shiftToWall\(\{ x: x \/ n, y: y \/ n \}, shift, lightBlockedOutside\)/);
  assert.match(cave, /uniform sampler2D uRoom;/);
  assert.match(cave, /\* texture2D\(uRoom, vUv\)\.a;/);
  // The shortening itself, with a wall three squares off.
  const shiftToWall = new Function('return ' + main.match(/const shiftToWall = (\(from, shift, blocked\) => \{[\s\S]*?\n\};)/)[1].replace(/;$/, ''))();
  const wall = (a, b) => b.x > 300;
  const s = shiftToWall({ x: 0, y: 0 }, [600, 0], wall);
  assert.ok(s[0] <= 300 && s[0] > 290, 'up to the wall, not through it');
  assert.deepEqual(shiftToWall({ x: 0, y: 0 }, [200, 0], wall), [200, 0], 'short of it, as it was');
});

test('main keeps glazed openings out of the weather and hands the light pool its window', () => {
  const main = readFileSync(new URL('../../../scripts/main.mjs', import.meta.url), 'utf8'), cave = readFileSync(new URL('../../../scripts/engines/motion/cavern.mjs', import.meta.url), 'utf8');
  assert.match(main, /const weatherOpen = open\.filter\(\(area\) => !GLAZED\.has\(area\.window\)\)/);
  assert.match(main, /open: weatherOpen, bounds, grid,/);
  assert.match(main, /field\("Window in it", select\("skyWindow"/);
  assert.match(cave, /item\.window \? windowMask\(/);
  assert.match(cave, /tint \* pool \* 0\.5/);
  assert.match(cave, /f\.blendMode = PIXI\.BLEND_MODES\.ERASE; cut\.filters = \[f\];/, 'a roof window\'s frame comes down soft-edged');
  assert.match(cave, /const ROOF_WINDOW_SOFT = 0\.035;/);
});
