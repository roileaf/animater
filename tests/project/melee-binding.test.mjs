import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRecipe, matchRecipe } from '../../scripts/core/model.mjs';
import { pf2eEvent } from '../../scripts/systems/adapters.mjs';
import { resolveAutomaticWeaponRecipe, PF2E_WEAPONS } from '../../scripts/catalogs/pf2e/weapons/weapon-catalog.mjs';
import { resolveDndAutomaticRecipe, DND5E_ENTRIES } from '../../scripts/catalogs/dnd5e/dnd5e-catalog.mjs';
import { resolveSfAutomaticRecipe, SF2E_ENTRIES } from '../../scripts/catalogs/sf2e/sf2e-catalog.mjs';
import { unlinked, recipeConflicts } from '../../scripts/core/recipe-conflicts.mjs';

const recipe = extra => validateRecipe({ id: 'all-melee', name: 'Same melee animation', trigger: 'attack', match: '', matchScope: 'melee', stages: [{ kind: 'motion', motion: 'lunge' }], ...extra });

test('all melee binding needs no names, excludes ranged, thrown and spell attacks', () => {
  const r = recipe();
  assert.equal(r.matchScope, 'melee');
  assert.equal(unlinked(r), false);
  for (const type of ['weapon', 'melee']) {
    assert.equal(matchRecipe([r], { type: 'attack', weaponMode: 'melee', item: { type, name: 'Unknown custom strike' } }), r);
  }
  for (const weaponMode of ['ranged', 'thrown', undefined]) {
    assert.equal(matchRecipe([r], { type: 'attack', weaponMode, item: { type: 'weapon' } }), null);
  }
  assert.equal(matchRecipe([r], { type: 'attack', weaponMode: 'melee', item: { type: 'spell' } }), null);
  assert.equal(matchRecipe([r], { type: 'damage', weaponMode: 'melee', item: { type: 'weapon' } }), null);
  assert.equal(matchRecipe([recipe({ trigger: 'damage' })], { type: 'damage', weaponMode: 'melee', item: { type: 'weapon' } }).id, r.id);
  assert.equal(recipe({ trigger: 'effect' }).matchScope, undefined);
  const imported = recipe({ itemUuid: 'Item.sword', activityId: 'activity', catalogEntry: 'sword' });
  assert.equal(imported.itemUuid, '');
  assert.equal(imported.activityId, undefined);
  assert.equal(imported.catalogEntry, undefined);
});

test('specific saved bindings beat all melee; duplicate melee bindings report conflicts', () => {
  const all = recipe(), specific = recipe({ id: 'z-specific', matchScope: undefined, match: 'Sword' });
  const event = { type: 'attack', weaponMode: 'melee', item: { type: 'weapon', name: 'Sword' } };
  assert.equal(matchRecipe([all, specific], event), specific);
  const other = recipe({ id: 'z-other' });
  assert.equal(recipeConflicts([all, other]).get(other.id).winner.id, all.id);
});

test('melee binding overrides preferred built-in weapons across supported systems', () => {
  const r = recipe();
  const pf = PF2E_WEAPONS.find(w => w.slug === 'longsword');
  const state = { enabled: true, preferCatalog: true, selected: [pf.id], customized: [] };
  const event = { type: 'attack', weaponMode: 'melee', systemId: 'pf2e', item: { type: 'weapon', name: pf.name } };
  assert.equal(resolveAutomaticWeaponRecipe(event, state, [r]), r);
  const specific = recipe({ id: 'specific', matchScope: undefined, match: pf.name });
  assert.equal(resolveAutomaticWeaponRecipe(event, state, [r, specific]), specific);
  assert.notEqual(resolveAutomaticWeaponRecipe(event, state, [r], { customEnabled: false })?.id, r.id);
  for (const [systemId, entries, resolve] of [['dnd5e', DND5E_ENTRIES, resolveDndAutomaticRecipe], ['sf2e', SF2E_ENTRIES, resolveSfAutomaticRecipe]]) {
    const entry = entries.find(e => e.kind === 'weapon' && e.variants.some(v => v.weaponMode === 'melee' && v.recipe.trigger === 'attack'));
    assert.ok(entry, systemId);
    const e = { ...event, systemId, item: { type: 'weapon', name: entry.name, uuid: entry.uuid } };
    assert.equal(resolve(e, () => ({ enabled: true, preferCatalog: true, selected: [entry.id] }), [r]), r, systemId);
    const own = recipe({ id: 'specific', matchScope: undefined, itemUuid: entry.uuid });
    assert.equal(resolve(e, () => ({ enabled: true, preferCatalog: true, selected: [entry.id] }), [r, own]), own, systemId);
  }
});

test('PF2e NPC melee/ranged attacks and thrown weapons preserve actual rolled usage', () => {
  const message = (item, options = []) => ({ id: 'm', author: { id: 'u' }, item, flags: { pf2e: { context: { type: 'attack-roll', options } } } });
  assert.equal(pf2eEvent(message({ type: 'melee', isMelee: true, isRanged: false }), 'u').weaponMode, 'melee');
  assert.equal(pf2eEvent(message({ type: 'melee', isRanged: true }), 'u').weaponMode, 'ranged');
  assert.equal(pf2eEvent(message({ type: 'weapon', isThrown: true }, ['item:melee']), 'u').weaponMode, 'melee');
  assert.equal(pf2eEvent(message({ type: 'weapon', isThrown: true }, ['item:thrown']), 'u').weaponMode, 'thrown');
  assert.equal(pf2eEvent(message({ type: 'weapon', isThrown: true }, ['item:melee', 'item:thrown-melee']), 'u').weaponMode, 'thrown');
});

test('all ranged binding selects ranged weapons and NPC strikes, excluding melee, thrown and spells', () => {
  const r = recipe({ id: 'all-ranged', matchScope: 'ranged' }), melee = recipe();
  assert.equal(r.matchScope, 'ranged');
  assert.equal(r.weaponMode, 'ranged');
  assert.equal(unlinked(r), false);
  for (const type of ['weapon', 'melee']) {
    assert.equal(matchRecipe([melee, r], { type: 'attack', weaponMode: 'ranged', item: { type, name: 'Unknown ranged strike' } }), r);
  }
  for (const weaponMode of ['melee', 'thrown', undefined]) {
    assert.equal(matchRecipe([r], { type: 'attack', weaponMode, item: { type: 'weapon' } }), null);
  }
  assert.equal(matchRecipe([r], { type: 'attack', weaponMode: 'ranged', item: { type: 'spell' } }), null);
  assert.equal(matchRecipe([r], { type: 'damage', weaponMode: 'ranged', item: { type: 'weapon' } }), null);
  const damage = recipe({ matchScope: 'ranged', trigger: 'damage' });
  assert.equal(matchRecipe([damage], { type: 'damage', weaponMode: 'ranged', item: { type: 'weapon' } }), damage);
  const other = recipe({ id: 'z-ranged', matchScope: 'ranged' });
  const conflicts = recipeConflicts([melee, r, other]);
  assert.equal(conflicts.get(other.id).winner.id, r.id);
  assert.equal(conflicts.has(melee.id), false);
});

test('ranged binding overrides preferred catalogs and preserves specific saved exceptions across systems', () => {
  const r = recipe({ id: 'all-ranged', matchScope: 'ranged' });
  const pf = PF2E_WEAPONS.find(w => w.slug === 'shortbow');
  const state = { enabled: true, preferCatalog: true, selected: [pf.id], customized: [] };
  const event = { type: 'attack', weaponMode: 'ranged', systemId: 'pf2e', item: { type: 'weapon', name: pf.name } };
  assert.equal(resolveAutomaticWeaponRecipe(event, state, [r]), r);
  const specific = recipe({ id: 'specific', matchScope: undefined, match: pf.name });
  assert.equal(resolveAutomaticWeaponRecipe(event, state, [r, specific]), specific);
  assert.notEqual(resolveAutomaticWeaponRecipe(event, state, [r], { customEnabled: false })?.id, r.id);
  for (const [systemId, entries, resolve] of [['dnd5e', DND5E_ENTRIES, resolveDndAutomaticRecipe], ['sf2e', SF2E_ENTRIES, resolveSfAutomaticRecipe]]) {
    const entry = entries.find(e => e.kind === 'weapon' && e.variants.some(v => v.weaponMode === 'ranged' && v.recipe.trigger === 'attack'));
    assert.ok(entry, systemId);
    const e = { ...event, systemId, item: { type: 'weapon', name: entry.name, uuid: entry.uuid } };
    const stateFor = () => ({ enabled: true, preferCatalog: true, selected: [entry.id] });
    assert.equal(resolve(e, stateFor, [r]), r, systemId);
    const own = recipe({ id: 'specific', matchScope: undefined, itemUuid: entry.uuid });
    assert.equal(resolve(e, stateFor, [r, own]), own, systemId);
    assert.notEqual(resolve(e, stateFor, [r], { customEnabled: false })?.id, r.id, systemId);
  }
});
