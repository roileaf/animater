import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const main = readFileSync(new URL('../../scripts/main.mjs', import.meta.url), 'utf8');

test('a creature hidden from the players throws no ground shadow on the GM\'s screen', () => {
  assert.match(main, /\.\.\.\(d\.hidden === true \? \{ shadow: false \} : \{\}\),/);
  // What a movement view is kept by already holds it, so hiding or showing a token makes its view afresh.
  assert.match(main, /signature = \[[^\]]*d\.hidden[^\]]*\]/);
});

test('the water\'s reflections are looked at again only when something by the water has changed', () => {
  assert.match(main, /const mirrorSeen = \(\) => \{/);
  const look = main.slice(main.indexOf('const tickWater = (seconds) => {'), main.indexOf('if (coast.busy) coast.tick('));
  assert.match(look, /const seen = mirrorSeen\(\), still = !rings && !carrierTokens\.length && seen === mirrorSeenKey && now - mirrorSeenAt < 1000;/);
  assert.ok(look.indexOf('if (!still) {') < look.indexOf('waterMirror.look('), 'the look is inside it');
  // What it is made from: where each creature is drawn, the lights, the sun, the floors.
  const made = main.slice(main.indexOf('const mirrorSeen = () => {'), main.indexOf('const tickWater = (seconds) => {'));
  for (const part of ['lightingAge', 'floorGen', 'sunNow', 'm.position.x', 'm.position.y', 'm.alpha', 'baseTexture?.uid', 'document.rotation', 'document.elevation'])
    assert.ok(made.includes(part), part);
});
