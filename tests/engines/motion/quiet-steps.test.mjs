import test from 'node:test';
import assert from 'node:assert/strict';
import { isSneaking, sneakStep, darker, SNEAK_STEP } from '../../../scripts/engines/motion/quiet-steps.mjs';

test('PF2e: Avoid Notice as the exploration activity is sneaking, until initiative', () => {
  assert.equal(isSneaking({ system: 'pf2e', exploration: ['avoid-notice'] }), true);
  assert.equal(isSneaking({ system: 'pf2e', exploration: ['avoid-notice'], inCombat: true }), false, 'in an encounter the activity is over');
  assert.equal(isSneaking({ system: 'pf2e', exploration: ['search', 'scout'] }), false);
  assert.equal(isSneaking({ system: 'sf2e', exploration: ['avoid-notice'] }), true, 'SF2e as PF2e');
});
test('PF2e: a Sneak or Avoid Notice effect is sneaking, in combat too', () => {
  assert.equal(isSneaking({ system: 'pf2e', slugs: ['effect-sneak'], inCombat: true }), true);
  assert.equal(isSneaking({ system: 'pf2e', slugs: new Set(['effect-avoid-notice']) }), true);
  assert.equal(isSneaking({ system: 'pf2e', slugs: ['effect-rage'] }), false);
});
test('PF2e Visioner marking the token as sneaking counts in any system', () => {
  assert.equal(isSneaking({ system: 'pf2e', visionerSneak: true, inCombat: true }), true);
  assert.equal(isSneaking({ system: 'dnd5e', visionerSneak: true }), true);
});
test("PF2e's Hidden condition is how others perceive it, not sneaking; D&D 5e's Hiding is", () => {
  assert.equal(isSneaking({ system: 'pf2e', statuses: new Set(['hidden']) }), false);
  assert.equal(isSneaking({ system: 'dnd5e', statuses: new Set(['hiding']) }), true);
  assert.equal(isSneaking({ system: 'dnd5e', statuses: ['hidden'] }), true);
  assert.equal(isSneaking({ system: 'dnd5e', statuses: new Set(['prone']) }), false);
  assert.equal(isSneaking(), false);
});
test('a sneaking step is softer, slower and duller; only Huge and up still thud', () => {
  const s = sneakStep(2);
  assert.ok(s.gain < 0.5 && s.gain > 0.3);
  assert.ok(s.gap > 1.2 && s.gap < 1.4);
  assert.equal(s.lowpass, SNEAK_STEP.lowpass);
  assert.equal(sneakStep(3).thud, false, 'Large: no thud');
  assert.equal(sneakStep(3.75).thud, false, 'heavy Large: none either');
  assert.equal(sneakStep(4).thud, true, 'Huge still lands heavily');
  assert.equal(darker(2500, 900), 900);
  assert.equal(darker(null, 2500), 2500);
  assert.equal(darker(undefined, undefined), null);
});
