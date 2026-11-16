import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// The fire's weather reading is built in main.mjs and handed to the pure spread (engines/props/fire-spread.mjs).
// What falls has to reach it, or rain fights nothing.
const main = readFileSync(new URL('../../scripts/main.mjs', import.meta.url), 'utf8');
const reading = (() => {
  const at = main.indexOf('function fireWindOf(');
  assert.ok(at > 0, 'the fire still reads the weather somewhere');
  return main.slice(at, main.indexOf('\r\n}', at));
})();

test('the fire reads what is falling, not only the wind', () => {
  assert.match(reading, /skyFalling\?\.rain/, 'rain is what fights it');
  assert.match(reading, /skyFalling\?\.snow/, 'and wet snow counts for some of itself');
  assert.match(reading, /wet\b/);
  assert.match(reading, /return \{ outdoor, angle: [^}]*wet \}/, 'the wet goes out with the wind, on one reading');
});

test('a dead calm in the rain is still a reading', () => {
  // The old gate returned nothing without wind, which would have left a downpour unable to touch a fire.
  assert.doesNotMatch(reading, /if \(!\(strength > 0\) \|\| !at/, 'the wind alone no longer decides');
  assert.match(reading, /!\(strength > 0\) && !\(wet > 0\)/);
});

test('the wet only reaches fire that is out in it', () => {
  assert.match(reading, /underCeiling\(at\)/, 'a roof keeps the rain off as it keeps the wind off');
});
