import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lastingScale } from '../../../scripts/engines/playback/persistent-states.mjs';

// Roi, of Hasted's spinning ring: "still bigger than the token". The catalogs draw JB2A token borders on lasting states at
// 1.3 to 1.5 (D&D, SF2e and PF2e alike); a border hugs the token, so it is never drawn bigger than it.
test('a lasting token border is never bigger than the token; other looks and reach auras keep their scale', () => {
  const border = (scale, extra = {}) => ({ asset: 'jb2a.token_border.circle.spinning.blue.001', scale, ...extra });
  assert.equal(lastingScale(border(1.5)), 1);
  assert.equal(lastingScale(border(1.35)), 1);
  assert.equal(lastingScale(border(0.8)), 0.8, 'a smaller one stays smaller');
  assert.equal(lastingScale({ asset: 'jb2a.particles.swirl.orange.01.01', scale: 1.3 }), 1.3, 'not a border');
  assert.equal(lastingScale(border(1.5, { auraRadius: 10 })), 1.5, 'a reach aura keeps its size');
  assert.equal(lastingScale({ asset: 'jb2a.markers.light', scale: 1.4, auraRadius: 10 }, true), 1, 'a granted aura still no bigger than 1');
  const src = readFileSync(new URL('../../../scripts/engines/playback/persistent-states.mjs', import.meta.url), 'utf8');
  assert.match(src, /\*lastingScale\(s,granted\)\*level\.scale\*softScale/);
});
