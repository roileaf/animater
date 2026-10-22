import test from 'node:test';
import assert from 'node:assert/strict';
import { QUALITY_CHOICES, allowsTier, allowsTokenFx, allowsMotion, allowsEffectFilters, lightenEffect, stateBudget } from '../../scripts/core/quality.mjs';

test('Light plays every layer and token motion, as Full does, without token filters', () => {
  assert.ok(QUALITY_CHOICES.light);
  assert.deepEqual(Object.keys(QUALITY_CHOICES), ['full', 'light', 'balanced', 'low', 'off'], 'listed between Full and Balanced');
  for (const tier of [0, 1, 2]) assert.equal(allowsTier('light', tier), allowsTier('full', tier));
  assert.equal(allowsMotion('light'), true);
  assert.equal(allowsTokenFx('light'), false);
  assert.equal(allowsTokenFx('full'), true);
  assert.deepEqual(stateBudget('light'), stateBudget('full'), 'every lasting layer too');
});

test("blur and glow come off Animater's effects below Full; colour filters and other modules' effects stay", () => {
  const effect = () => ({ moduleName: 'animater', filters: [{ className: 'ColorMatrix', data: {} }, { className: 'Blur', data: {} }, { className: 'Glow', data: {} }] });
  const names = (d) => d.filters.map((f) => f.className);
  assert.deepEqual(names(lightenEffect(effect(), 'full')), ['ColorMatrix', 'Blur', 'Glow']);
  for (const level of ['light', 'balanced', 'low']) assert.deepEqual(names(lightenEffect(effect(), level)), ['ColorMatrix'], level);
  assert.deepEqual(names(lightenEffect({ ...effect(), moduleName: 'jb2a-macros' }, 'light')), ['ColorMatrix', 'Blur', 'Glow'], "another module's effect is left alone");
  assert.equal(allowsEffectFilters('light'), false);
  assert.equal(lightenEffect(null, 'light'), null);
});
