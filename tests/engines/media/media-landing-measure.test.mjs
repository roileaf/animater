import test from 'node:test';
import assert from 'node:assert/strict';
import { reachedContact } from '../../../tools/media-timing.mjs';

// Raw 100x40 RGBA frames (as ffmpeg pipes them at 20 fps); each frame lights the given [x, y] pixels.
const frames = (...lit) => {
  const out = new Uint8Array(lit.length * 16000);
  lit.forEach((pixels, frame) => { for (const [x, y] of pixels) out[(frame * 4000 + y * 100 + x) * 4 + 3] = 255; });
  return out;
};
const dot = (x, y = 20) => [[x, y]];

test('a thrown object lands when its leading edge reaches the endpoint, whatever its height', () => {
  // Wound back (moving left), then arcing high and down to the endpoint column 88.
  assert.equal(reachedContact(frames(dot(20), dot(15), dot(50, 5), dot(84, 30), dot(86, 34), []), 88), 200);
});

test('a frame lit all over is a flash, not the object', () => {
  const flash = Array.from({ length: 1200 }, (_, i) => [i % 100, Math.floor(i / 100)]);
  assert.equal(reachedContact(frames(dot(40), flash, dot(60), dot(70)), 67), 150);
});

test('an object that never reaches the endpoint is not measured', () => {
  assert.equal(reachedContact(frames(dot(10), dot(40), dot(70), []), 95), null);
});
