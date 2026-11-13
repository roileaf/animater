import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const main = readFileSync(new URL('../../scripts/main.mjs', import.meta.url), 'utf8');

// Roi, with Ezren's torch lit at the river's edge: "now?" — no glints. The lamps were the embers' list, made again only when an
// ambient light, a wall or a setting changed: a torch carried to the water, or lit there, never reached the mirror.
test('the water\'s glints take the lights as they are now, a carried torch the moment it moves or is lit', () => {
  const look = main.slice(main.indexOf('waterMirror.look({'), main.indexOf('waterMirror.look({') + 400);
  assert.match(look, /lamps: mirrorLamps\(\)/, 'the lights as they stand, not the embers\' list');
  const at = main.indexOf('const mirrorLamps = ');
  assert.ok(at > 0, 'read from the scene\'s light sources');
  const body = main.slice(at, at + 700);
  assert.match(body, /canvas\.effects\?\.lightSources/);
  assert.match(body, /GlobalLightSource/, 'not the scene\'s own light');
  assert.match(body, /shape/, 'with where each reaches');
  assert.doesNotMatch(body, /embersOn|motesOn/, 'whether embers or motes are on has nothing to do with it');
});
