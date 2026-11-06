import { test } from 'node:test';
import assert from 'node:assert/strict';
globalThis.game ??= { system: { id: 'dnd5e' }, modules: new Map() };
const { breathes, dndEntries, dndRecipe, rollComesLater, withoutTargets } = await import('../../../scripts/catalogs/dnd5e/dnd5e-catalog.mjs');

test('a cast waits for targets only if a roll is still to come', () => {
  assert.equal(rollComesLater({ type: 'utility', damage: { parts: [] } }), false, "Dragon's Breath");
  assert.equal(rollComesLater({ type: 'save', damage: { parts: [{}] } }), true, 'Sacred Flame');
  assert.equal(rollComesLater({ type: 'save', damage: { parts: [] } }), false, 'a save with no damage');
  assert.equal(rollComesLater({ type: 'attack' }), true);
  assert.equal(rollComesLater(null, { activityType: 'utility' }), false, 'no activity known: by the entry');
  assert.equal(rollComesLater(null, { activityType: 'save' }), true);
});

test("Dragon's Breath cast at nobody plays on the caster", () => {
  const entry = dndEntries().find((e) => e.slug === 'dragons-breath'), cast = entry.variants.find((v) => v.activityType === 'utility');
  const alone = withoutTargets(dndRecipe(entry, cast.id, {}));
  const kinds = alone.stages.map((s) => s.kind);
  assert.ok(kinds.includes('cast') && kinds.includes('aura'));
  assert.equal(alone.stages.some((s) => s.subject === 'targets' && !s.optionalTargets), false, 'nothing still needs a target');
});

test('what flies at a target goes, and nothing is left waiting on it', () => {
  const r = withoutTargets({ stages: [{ kind: 'cast', stageId: 'a' }, { kind: 'projectile', stageId: 'b' }, { kind: 'impact', stageId: 'c', afterStage: 'b' }, { kind: 'sound', stageId: 'd', afterStage: 'b', subject: 'targets' }, { kind: 'motion', stageId: 'e', subject: 'source' }] });
  assert.deepEqual(r.stages.map((s) => s.stageId), ['a', 'd', 'e']);
  assert.equal(r.stages[1].afterStage, '');
  assert.equal(r.stages[1].subject, 'source');
  assert.equal(r.stages[2].optionalTargets, true);
  const only = { stages: [{ kind: 'impact', stageId: 'x' }] };
  assert.equal(withoutTargets(only), only, 'nothing left: as it was');
});

test('breath weapons draw breath, with a pack that has an inhale; other things do not', () => {
  const all = dndEntries(), sounds = { packs: [], entries: [], resolve: (c) => ({ ...c }) };
  const isBreath = (e, v) => breathes(e, v);
  const dragon = all.find((e) => e.slug === 'dragons-breath');
  assert.equal(isBreath(dragon, dragon.variants.find((v) => v.activityType === 'utility')), false, 'casting it on someone');
  assert.equal(isBreath(dragon, dragon.variants.find((v) => v.activityType === 'save')), true, 'the breath itself');
  assert.equal(isBreath({ name: 'Water Breathing', kind: 'spell' }, { activityType: 'utility' }), false);
  assert.equal(isBreath({ name: 'Fire Breath', kind: 'feat' }, { activityType: 'save' }), true);
  const save = dragon.variants.find((v) => v.activityType === 'save'), inhale = (r) => r.stages.filter((s) => s.kind === 'sound' && s.label === 'Deep inhale');
  assert.equal(inhale(dndRecipe(dragon, save.id, { sounds })).length, 1);
  assert.equal(inhale(dndRecipe(dragon, save.id, { sounds: { packs: [], entries: [], resolve: () => null } })).length, 0, 'no pack, no sound');
  assert.equal(inhale(dndRecipe(dragon, dragon.variants.find((v) => v.activityType === 'utility').id, { sounds })).length, 0);
});
