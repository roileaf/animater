import test from 'node:test';
import assert from 'node:assert/strict';
import { shuffleLayers, shareCode, readShareCode } from '../../../scripts/engines/tokenshade/share.mjs';
import { controlsFor } from '../../../scripts/engines/tokenshade/controls.mjs';

const glow = [{ filterType: 'glow', outerStrength: 4, distance: 10, color: 0xff0000, animated: { innerStrength: { animType: 'cosOscillation', val1: 0, val2: 1, loopDuration: 1000 } } }];
test('Shuffle nudges settings within their ranges and turns colours, keeping styles and animations', () => {
  let i = 0; const seq = [0.9, 0.1, 0.8, 0.3, 0.7];
  const [next] = shuffleLayers(glow, { random: () => seq[i++ % seq.length] });
  assert.notEqual(next.outerStrength, 4);
  const range = controlsFor('glow').find((c) => c.key === 'outerStrength');
  assert.ok(next.outerStrength >= range.min && next.outerStrength <= range.max);
  assert.notEqual(next.color, 0xff0000, 'the colour turned');
  assert.deepEqual(next.animated, glow[0].animated);
  assert.equal(glow[0].outerStrength, 4, 'the original is untouched');
});
test('a share code carries an effect as text and back; anything Tokenshade cannot draw is refused', () => {
  const code = shareCode('Red glow', glow);
  assert.match(code, /^animater-fx:/);
  const back = readShareCode(code);
  assert.equal(back.name, 'Red glow');
  assert.equal(back.params[0].filterType, 'glow');
  assert.throws(() => readShareCode('hello'), /not a Tokenshade share code/);
  assert.throws(() => readShareCode('animater-fx:{"name":"x","params":[{"filterType":"nope"}]}'), /no effect/);
});
