import test from 'node:test';
import assert from 'node:assert/strict';
import { cropsToArt, cutOutArt } from '../../../scripts/engines/playback/art-crop.mjs';

// On a top-down or pop-out token (cut-out art), an effect sitting on the creature shows only on its body, not across
// its whole square as on a ring token. A burst, a hit, a dome or an emanation reaching past it still spills out.
test('an effect on a cut-out creature is cropped to its art; anything meant to spill past it is not', () => {
  const on = { kind: 'aura', scale: 1 };
  assert.equal(cropsToArt(on, true), true, 'a glow or condition on the creature');
  assert.equal(cropsToArt(on, false), false, 'a ring token or an opaque portrait keeps its square');
  assert.equal(cropsToArt({ kind: 'impact', scale: 1, persist: true }, true), true, 'a lasting effect on it');
  assert.equal(cropsToArt({ kind: 'impact', scale: 1 }, true), false, 'a hit or burst spills');
  assert.equal(cropsToArt({ kind: 'aura', scale: 1.6 }, true), false, 'a dome or ward bigger than the creature');
  assert.equal(cropsToArt({ kind: 'aura', scale: 1, auraRadius: 10 }, true), false, 'an emanation');
  assert.equal(cropsToArt({ kind: 'aura', scale: 1, below: true }, true), false, 'a mark on the ground under it');
  assert.equal(cropsToArt({ kind: 'cast', scale: 1 }, true), false);
  // Blaze: flames lasting on the creature, drawn half again its size, still burn only on its body.
  assert.equal(cropsToArt({ kind: 'aura', scale: 1.5, persist: true, assets: ['jb2a.flames.01.orange'] }, true), true);
  // A ward, shield, bubble or field surrounds the creature whatever its size.
  for (const asset of ['jb2a.shield.01.complete.01.blue', 'jb2a.ward.star.yellow.01', 'jb2a.energy_field.01.multicolored', 'jb2a.bubble.001.001.complete.blue', 'jb2a.wall_of_force.sphere.blue'])
    assert.equal(cropsToArt({ kind: 'aura', scale: 1, persist: true, assets: [asset] }, true), false, asset);
  // A condition badge, a marker or a hunter's mark keeps its own shape.
  for (const asset of ['jb2a.condition.curse.01.014.blue', 'jb2a.condition.boon.01.003.green', 'jb2a.markers.poison.dark_green.03', 'jb2a.hunters_mark.loop.01.green', 'jb2a.token_border.circle.static.green.001'])
    assert.equal(cropsToArt({ kind: 'aura', scale: 1, persist: true, assets: [asset] }, true), false, asset);
});

test('cut-out art: transparent around the creature, not a ring token, not a square portrait', () => {
  const alphas = (fill) => { const d = new Uint8ClampedArray(16 * 16 * 4); for (let i = 0; i < 256; i++) d[i * 4 + 3] = i < 256 * fill ? 255 : 0; return d; };
  assert.equal(cutOutArt({ ring: false, pixels: alphas(0.4) }), true, 'a top-down dragon on a clear background');
  assert.equal(cutOutArt({ ring: false, pixels: alphas(1) }), false, 'an opaque portrait');
  assert.equal(cutOutArt({ ring: true, pixels: alphas(0.4) }), false, 'a dynamic ring token keeps its disc');
  assert.equal(cutOutArt({ ring: false, pixels: null }), false, 'unreadable art: as before');
});
