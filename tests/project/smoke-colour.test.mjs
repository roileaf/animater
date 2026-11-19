// The smoke colour a GM picks on a light has to reach the puffs: the light config has to offer it, the frame has to
// read it off the light, and the chimney's plume has to keep it. Source-text checks, the wiring being in main.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SMOKE_COLOURS } from '../../scripts/engines/motion/fire-smoke.mjs';

const main = readFileSync(fileURLToPath(new URL('../../scripts/main.mjs', import.meta.url)), 'utf8');

test('a light config offers Smoke colour, and the fires this frame carry what it was set to', () => {
  assert.match(main, /buttons\("smokeColor", "Smoke colour"/, 'the light config has a row of its own');
  assert.match(main, /SMOKE_COLOURS/, 'built from the engine\'s colours, so a new one shows up without a second list here');
  assert.match(main, /flags\?\.\[ID\]\?\.smokeColor/, 'read off the light itself');
  assert.match(main, /return \{ key, size, visible:[^\n]*smokeColor/, 'and put on the fire this frame draws');
});

test('setting Flames on many lights at once can set their colour too', () => {
  assert.match(main, /select\("smokeColor", "Smoke colour"/, 'the Flames dialog offers it');
  assert.match(main, /"sparks", "chimney", "smokeColor"\]/, 'and applies it with the rest');
});

test('the colours the two places offer are the engine\'s, named for what they are', () => {
  for (const [key, ramp] of Object.entries(SMOKE_COLOURS)) {
    assert.ok(/^[a-z]*$/.test(key), `${key || '(none)'} is a plain key, saved on the light`);
    assert.ok(ramp.name.length <= 8, `${ramp.name} fits a button`);
  }
  assert.equal(SMOKE_COLOURS[''].name, 'Grey', 'the one a light has until a GM picks another');
});
