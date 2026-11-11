import test from 'node:test';
import assert from 'node:assert/strict';
import { DND5E_ENTRIES } from '../../../scripts/catalogs/dnd5e/dnd5e-catalog.mjs';
import { findDndState, dndActorStates } from '../../../scripts/catalogs/dnd5e/dnd5e-states.mjs';

// Roi: "looks like d&d conditions animations arent working". Since the catalogs load a moment after the scene draws (3.8.12),
// the condition and effect lookups were made from an empty catalog when this module first loaded, and stayed empty.
test('a condition or effect that joins the catalog after this module loaded is still found', () => {
  const cond = { id: 'test-late-condition', kind: 'condition', statusId: 'testLate', name: 'Test Late', variants: [] };
  const eff = { id: 'test-late-effect', kind: 'effect', uuid: 'Compendium.test.effects.Item.late', name: 'Late Effect', variants: [] };
  DND5E_ENTRIES.push(cond, eff);
  try {
    assert.equal(findDndState({ type: 'condition', statusId: 'testLate' }), cond);
    assert.equal(findDndState({ type: 'effect', document: { uuid: 'Compendium.test.effects.Item.late', name: 'Late Effect' } }), eff);
    const actor = { appliedEffects: [{ statuses: new Set(['testLate']), uuid: 'Actor.a.ActiveEffect.e' }], statuses: new Set() };
    assert.deepEqual(dndActorStates(actor).map((s) => [s.type, s.statusId, s.name]), [['condition', 'testLate', 'Test Late']]);
  } finally {
    DND5E_ENTRIES.splice(DND5E_ENTRIES.indexOf(cond), 1); DND5E_ENTRIES.splice(DND5E_ENTRIES.indexOf(eff), 1);
  }
});
