import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Roi: "the animation doesnt scale with the token", then "Follow it fully". A Tokenshade look's rings and halos are sized
// from the token as its art is drawn (media-preview tokenArtScale), not from its bare square.
test('Tokenshade sizes a look by the token\'s square times its art scale', async () => {
  const { tokenFxSize } = await import('../../../scripts/engines/tokenshade/engine.mjs');
  assert.deepEqual(tokenFxSize({ w: 100, h: 100, document: { texture: { scaleX: 1, scaleY: 1 } } }), { width: 100, height: 100 });
  assert.deepEqual(tokenFxSize({ w: 100, h: 100, document: { texture: { scaleX: 2, scaleY: 2 } } }), { width: 200, height: 200 });
  assert.deepEqual(tokenFxSize({ w: 200, h: 100, document: { texture: { scaleX: 0.5, scaleY: 0.5 } } }), { width: 100, height: 50 });
  assert.deepEqual(tokenFxSize({ w: 100, h: 100, document: { texture: { scaleX: 2, scaleY: 2 }, ring: { enabled: true, subject: { scale: 1.25 } } } }), { width: 160, height: 160 });
  assert.equal(tokenFxSize({}), null);
  assert.match(readFileSync(new URL('../../../scripts/engines/tokenshade/engine.mjs', import.meta.url), 'utf8'), /tokenSize: tokenFxSize\(token\)/);
});
