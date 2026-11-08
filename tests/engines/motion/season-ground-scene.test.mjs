import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const main = readFileSync(new URL('../../../scripts/main.mjs', import.meta.url), 'utf8');

// Sherp: a scene with its floor on Grass took the spring green over the whole map, its painted dirt paths and trees too.
// Each scene can turn the season's colour off (Scene configuration → Animater → Season colours on the ground).
test('a scene can keep its own colours', () => {
  assert.match(main, /seasonGroundOn = \(\) => outdoorOn\("seasonGround"\) && canvas\?\.scene\?\.flags\?\.\[ID\]\?\.seasonGround !== "off"/);
  assert.match(main, /name="flags\.\$\{ID\}\.seasonGround"/, 'the scene configuration offers it');
  assert.match(main, /\["off", "Off \(the map keeps its own colours\)"\]/);
});
