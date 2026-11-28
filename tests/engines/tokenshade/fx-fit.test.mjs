import test from 'node:test';
import assert from 'node:assert/strict';
import {fxFilterClass} from '../../../scripts/engines/tokenshade/filter-factory.mjs';

// A fallen creature near the screen's edge was cut off from the top, or smeared, as the view moved off it: PIXI cropped
// the tip's input to the screen, and the tip reads the upright art from well above where it lies.
test('the tip filter is never cropped to the screen; other filters still are', () => {
  class Filter { constructor(_v, _f, uniforms) { this.uniforms = uniforms; } }
  const PIXI = {Filter, Texture: {EMPTY: {}, from: () => null}};
  const FxFilter = fxFilterClass(PIXI);
  assert.equal(new FxFilter({filterType: 'tip', amount: 0}).autoFit, false);
  assert.equal(new FxFilter({filterType: 'stain'}).autoFit, true);
});
