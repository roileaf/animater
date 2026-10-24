import test from 'node:test';
import assert from 'node:assert/strict';
import { walkedHighlight, wrapRulerHighlight } from '../../scripts/integrations/walked-path.mjs';

test('walkedHighlight: squares already walked fade or hide; the way ahead stays as Foundry draws it', () => {
  const style = { color: 0x9b4fd0, alpha: 0.5 };
  assert.deepEqual(walkedHighlight(style, { stage: 'passed' }, 'fade'), { color: 0x9b4fd0, alpha: 0.125 });
  assert.deepEqual(walkedHighlight(style, { stage: 'passed' }, 'hide'), { color: 0x9b4fd0, alpha: 0 });
  assert.deepEqual(walkedHighlight(style, { stage: 'passed' }, 'off'), style, 'as Foundry draws it');
  for (const stage of ['pending', 'planned']) assert.deepEqual(walkedHighlight(style, { stage }, 'hide'), style, `${stage} is the way ahead`);
  assert.deepEqual(walkedHighlight({ alpha: 0 }, { stage: 'passed' }, 'fade'), { alpha: 0 }, 'already hidden stays hidden');
  assert.deepEqual(walkedHighlight(undefined, { stage: 'passed' }, 'fade'), undefined, 'nothing to change');
});

test('wrapRulerHighlight: wraps the ruler class once, reads the mode each time, and can be undone', () => {
  class Ruler { _getGridHighlightStyle(waypoint) { return { color: 1, alpha: 0.5, stage: waypoint.stage }; } }
  let mode = 'fade';
  const undo = wrapRulerHighlight(Ruler, () => mode);
  wrapRulerHighlight(Ruler, () => 'hide'); // a second wrap is a no-op
  const r = new Ruler();
  assert.equal(r._getGridHighlightStyle({ stage: 'passed' }).alpha, 0.125);
  mode = 'hide';
  assert.equal(r._getGridHighlightStyle({ stage: 'passed' }).alpha, 0);
  assert.equal(r._getGridHighlightStyle({ stage: 'pending' }).alpha, 0.5);
  undo();
  assert.equal(r._getGridHighlightStyle({ stage: 'passed' }).alpha, 0.5, 'restored');
  // A ruler class without the method is left alone.
  assert.doesNotThrow(() => wrapRulerHighlight(class {}, () => 'fade'));
});
