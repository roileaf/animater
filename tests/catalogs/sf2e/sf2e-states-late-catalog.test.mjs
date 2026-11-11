import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SF2E_ENTRIES } from '../../../scripts/catalogs/sf2e/sf2e-catalog.mjs';

// The same trap as D&D's conditions (Roi: "we need to make sure it doesnt happen on anything else and on anyother system"):
// SF2e's state profile listed the catalog's effects once, when the module loaded, before the catalog arrived.
test('the SF2e state profile reads the catalog\'s effects as they are now, not as they were when it loaded', async () => {
  const src = readFileSync(new URL('../../../scripts/catalogs/sf2e/sf2e-states.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /effects:sfEntries\('effect'\)\.map\(stateView\)/, 'no list made at load');
  const { sfProfileEffects } = await import('../../../scripts/catalogs/sf2e/sf2e-states.mjs');
  const late = { id: 'test-late-sf-effect', kind: 'effect', uuid: 'Compendium.sf2e.effects.Item.late', name: 'Late', state: { kind: 'effect' }, variants: [] };
  const before = sfProfileEffects().length;
  SF2E_ENTRIES.push(late);
  try { assert.equal(sfProfileEffects().length, before + 1); assert.equal(sfProfileEffects().at(-1).id, 'test-late-sf-effect'); }
  finally { SF2E_ENTRIES.splice(SF2E_ENTRIES.indexOf(late), 1); }
});
