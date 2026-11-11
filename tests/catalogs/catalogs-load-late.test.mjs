import test from 'node:test';
import assert from 'node:assert/strict';

// Roi: "looks like d&d conditions animations arent working" and then "we need to make sure it doesnt happen on anything else
// and on anyother system". In the browser a catalog's data arrives a moment after the scene draws, after every module that
// reads it has loaded, while tests load it with the module. This file loads the modules first and the data after, as the
// browser does, and checks every system's lookups still find their entries: none may keep a list made before the data came.
globalThis.document = { querySelectorAll: () => [] }; // a page: catalog data waits to be asked for

test('every catalog finds its entries when its data arrives after the modules loaded (browser order)', async () => {
  const { loadCatalogData, catalogDataLoaded } = await import('../../scripts/catalogs/shared/catalog-data.mjs');
  const dnd = await import('../../scripts/catalogs/dnd5e/dnd5e-catalog.mjs');
  const dndStates = await import('../../scripts/catalogs/dnd5e/dnd5e-states.mjs');
  const sf = await import('../../scripts/catalogs/sf2e/sf2e-catalog.mjs');
  const sfStates = await import('../../scripts/catalogs/sf2e/sf2e-states.mjs');
  const spells = await import('../../scripts/catalogs/pf2e/spells/spell-catalog.mjs');
  const feats = await import('../../scripts/catalogs/pf2e/feats/feat-catalog.mjs');
  const weapons = await import('../../scripts/catalogs/pf2e/weapons/weapon-catalog.mjs');
  const states = await import('../../scripts/catalogs/pf2e/state-catalog.mjs');
  const abilities = await import('../../scripts/catalogs/pf2e/ability-catalog.mjs');
  // Nothing yet: the page has not asked.
  assert.equal(catalogDataLoaded('dnd5e'), false);
  assert.equal(dnd.dndEntries('condition').length, 0);

  await loadCatalogData({ systems: ['dnd5e', 'sf2e', 'pf2e'] });

  // D&D 5e: conditions and catalog effects as a creature's states, entries by their own uuid.
  const prone = dndStates.findDndState({ type: 'condition', statusId: 'prone' });
  assert.equal(prone?.statusId, 'prone', 'D&D condition');
  const actor = { appliedEffects: [{ statuses: new Set(['poisoned']), uuid: 'Actor.a.ActiveEffect.p' }], statuses: new Set() };
  assert.deepEqual(dndStates.dndActorStates(actor).map((s) => s.statusId), ['poisoned'], 'D&D actor states');
  const dndEffect = dnd.dndEntries('effect')[0];
  assert.equal(dndStates.findDndState({ type: 'effect', document: { uuid: dndEffect.uuid, name: dndEffect.name } }), dndEffect, 'D&D effect');
  const dndSpell = dnd.dndEntries('spell').find((e) => e.uuid);
  assert.equal(dnd.findDndEntry({ item: { type: 'spell', name: dndSpell.name, uuid: dndSpell.uuid } }), dndSpell, 'D&D spell');

  // SF2e: entries, and the effects its state profile knows.
  const sfEntry = sf.sfEntries().find((e) => e.uuid);
  assert.ok(sf.sfEntry(sfEntry.id), 'SF2e entry');
  assert.ok(sfStates.sfProfileEffects().length > 0, 'SF2e state effects');

  // PF2e: spells, feats, weapons, conditions and effects, actions and class features.
  assert.ok(spells.catalogSpell(spells.PF2E_SPELLS[0].id), 'PF2e spell');
  assert.ok(feats.catalogFeat(feats.PF2E_FEATS[0].id), 'PF2e feat');
  const weapon = weapons.PF2E_WEAPONS.find((w) => !w.natural) ?? weapons.PF2E_WEAPONS.at(-1);
  assert.ok(weapons.catalogWeapon(weapon.id), 'PF2e weapon');
  assert.ok(states.catalogStateEntry(states.PF2E_CONDITIONS[0].id), 'PF2e condition');
  assert.ok(states.catalogStateEntry(states.PF2E_EFFECTS[0].id), 'PF2e effect');
  assert.ok(abilities.PF2E_ACTION_CATALOG.entry(abilities.PF2E_ACTIONS[0].id), 'PF2e action');
  assert.ok(abilities.PF2E_FEATURE_CATALOG.entry(abilities.PF2E_CLASS_FEATURES[0].id), 'PF2e class feature');
});
