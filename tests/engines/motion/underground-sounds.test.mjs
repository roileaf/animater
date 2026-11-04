import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { UNDERGROUND_SOUNDS, undergroundSound, heardFrom, critterVoices, CRITTER_GAPS } from '../../../scripts/engines/motion/underground-sounds.mjs';

test('every underground sound is a file Animater ships', () => {
  for (const [kind, files] of Object.entries(UNDERGROUND_SOUNDS)) {
    assert.ok(files.length, `${kind} has recordings`);
    for (const f of files) assert.ok(existsSync(f.replace('modules/animater/', '')), f);
  }
});

test('the same recording never plays twice running', () => {
  const zero = () => 0;
  assert.notEqual(undergroundSound('drip', zero), undergroundSound('drip', zero));
  assert.equal(undergroundSound('nothing'), null);
});

test('a sound fades out with distance, a box heard from its nearest edge', () => {
  assert.equal(heardFrom({ x: 0, y: 0 }, [{ x: 0, y: 0 }], 100), 1);
  assert.equal(heardFrom({ x: 0, y: 0 }, [{ x: 200, y: 0 }], 100), 0);
  assert.equal(heardFrom({ x: 0, y: 0 }, [], 100), 0);
  assert.equal(heardFrom({ x: 0, y: 0, w: 100, h: 100 }, [{ x: 50, y: 50 }], 100), 1, 'inside the box');
  assert.ok(Math.abs(heardFrom({ x: 0, y: 0, w: 100, h: 100 }, [{ x: 150, y: 50 }], 100) - 0.25) < 1e-9, 'half way out');
});

test('rats and bats are heard a few at a time, a bolting rat sooner, however many there are', () => {
  let t = 100; const voices = critterVoices({ now: () => t, random: () => 0 });
  assert.equal(voices.wanted('ratSqueak'), true, 'the first');
  assert.equal(voices.wanted('ratSqueak'), false, 'the next rat waits');
  assert.equal(voices.wanted('batChirp'), true, 'each kind on its own');
  t += 0.5; assert.equal(voices.wanted('ratSqueak', true), false, 'even bolting needs a moment');
  t += 0.6; assert.equal(voices.wanted('ratSqueak'), false); assert.equal(voices.wanted('ratSqueak', true), true, 'bolting comes sooner');
  t += CRITTER_GAPS.ratSqueak[0] + 0.1; assert.equal(voices.wanted('ratSqueak'), true);
  assert.equal(voices.wanted('nothing'), false);
  // Twelve rats asking every frame for a minute: only the kind's own pace.
  let heard = 0; const many = critterVoices({ now: () => t, random: () => 0.5 }); for (let f = 0; f < 3600; f++) { t += 1 / 60; for (let r = 0; r < 12; r++) if (many.wanted('ratSkitter')) heard++; }
  assert.ok(heard <= 60 / 2.1 + 1, `${heard} skitters a minute`);
});
