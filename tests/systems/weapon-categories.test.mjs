import { test } from 'node:test';
import assert from 'node:assert/strict';
import { weaponCategories } from '../../scripts/systems/weapon-categories.mjs';
import { matchRecipe, matchStrikeOverride, validateRecipe, weaponClassOf, isWideScope, wideScopeName } from '../../scripts/core/model.mjs';

const recipe = (extra) => validateRecipe({ id: 'r', name: 'R', trigger: 'attack', match: '', stages: [{ kind: 'motion', motion: 'lunge' }], ...extra });
const event = (system, extra = {}) => ({ type: 'attack', systemId: 'pf2e', weaponMode: 'melee', item: { name: 'Longsword', type: 'weapon', system }, ...extra });

test('each system lists its own categories, from its own configuration', () => {
  const config = { PF2E: { weaponCategories: { martial: 'M', simple: 'S' }, weaponGroups: { sword: 'Sword', axe: 'Axe' } }, DND5E: { weaponTypes: { simpleM: 'Simple Melee', natural: 'Natural' } } };
  const pf = weaponCategories('pf2e', config);
  assert.deepEqual(pf.map((g) => g.label), ['Weapon categories', 'Weapon groups']);
  assert.deepEqual(pf[1].entries, { 'group:axe': 'Axe', 'group:sword': 'Sword' }, 'by name');
  assert.deepEqual(weaponCategories('sf2e', config)[0].entries, pf[0].entries, 'SF2e shares it');
  assert.deepEqual(weaponCategories('dnd5e', config)[0].entries, { 'type:natural': 'Natural', 'type:simpleM': 'Simple Melee' });
  assert.deepEqual(weaponCategories('draw-steel', config), [], 'its config is not there');
  assert.deepEqual(weaponCategories('crucible', config), [], 'a system Animater does not support');
  assert.deepEqual(weaponCategories('pf2e', {}), []);
});

test('Daggerheart lists slot, burden, range and trait; never "self" as a range', () => {
  const DH = { GENERAL: { burden: { oneHanded: { label: 'One' }, twoHanded: { label: 'Two' } }, range: { self: { label: 'Self' }, melee: { label: 'Melee' }, far: { label: 'Far' } } }, ACTOR: { abilities: { agility: { label: 'Agility' } } } };
  const groups = weaponCategories('daggerheart', { DH });
  assert.deepEqual(groups.map((g) => g.label), ['Weapon slot', 'Burden', 'Range', 'Trait']);
  assert.deepEqual(Object.keys(groups[2].entries), ['range:far', 'range:melee']);
  assert.deepEqual(weaponCategories('daggerheart', {}), []);
});

test('Draw Steel lists its ability keywords', () => {
  const [g] = weaponCategories('draw-steel', { DS: { abilities: { keywords: { weapon: { label: 'Weapon' }, magic: { label: 'Magic' } } } } });
  assert.deepEqual(g.entries, { 'keyword:magic': 'Magic', 'keyword:weapon': 'Weapon' });
});

test('Daggerheart weapons match by each of their own fields', () => {
  const system = { secondary: false, burden: 'twoHanded', attack: { range: 'far', roll: { trait: 'agility' } } }, e = { ...event(system), systemId: 'daggerheart' };
  for (const yes of ['slot:primary', 'burden:twoHanded', 'range:far', 'trait:agility']) assert.ok(matchRecipe([recipe({ matchScope: yes })], e), yes);
  for (const no of ['slot:secondary', 'burden:oneHanded', 'range:melee', 'trait:finesse']) assert.equal(matchRecipe([recipe({ matchScope: no })], e), null, no);
  assert.ok(matchRecipe([recipe({ matchScope: 'slot:secondary' })], { ...e, item: { type: 'weapon', system: { secondary: true } } }));
  assert.equal(matchRecipe([recipe({ matchScope: 'slot:primary' })], { ...e, item: { type: 'weapon' } }), null, 'nothing to read');
});

test('Draw Steel abilities match by keyword, and by all melee or ranged', () => {
  const ability = (keywords, weaponMode = 'melee') => ({ type: 'attack', systemId: 'draw-steel', weaponMode, item: { name: 'Strike', type: 'ability', system: { keywords } } });
  assert.ok(matchRecipe([recipe({ matchScope: 'keyword:weapon' })], ability(new Set(['weapon', 'melee']))), 'its Set');
  assert.ok(matchRecipe([recipe({ matchScope: 'keyword:weapon' })], ability(['weapon'])), 'a plain list');
  assert.equal(matchRecipe([recipe({ matchScope: 'keyword:magic' })], ability(new Set(['weapon']))), null);
  assert.equal(matchRecipe([recipe({ matchScope: 'keyword:weapon' })], event({ keywords: ['weapon'] })), null, 'only an ability has keywords');
  assert.ok(matchRecipe([recipe({ matchScope: 'melee' })], ability(new Set(['weapon']))));
  assert.equal(matchRecipe([recipe({ matchScope: 'melee' })], ability(new Set(['weapon']), 'ranged')), null);
  assert.equal(matchRecipe([recipe({ matchScope: 'melee' })], { ...ability([]), systemId: 'pf2e' }), null, 'an ability is no strike elsewhere');
});

test('labels go through the localizer, whether a string or { label }', () => {
  const [g] = weaponCategories('pf2e', { PF2E: { weaponGroups: { sword: 'KEY.Sword', axe: { label: 'KEY.Axe' } } } }, (k) => k.replace('KEY.', 'x'));
  assert.deepEqual(g.entries, { 'group:axe': 'xAxe', 'group:sword': 'xSword' });
});

test('a scope reads as a category only in the known forms', () => {
  assert.deepEqual(weaponClassOf('group:sword'), { field: 'group', id: 'sword' });
  assert.equal(weaponClassOf('melee'), null);
  assert.equal(weaponClassOf('nonsense:sword'), null);
  assert.equal(isWideScope('melee'), true); assert.equal(isWideScope('type:simpleM'), true); assert.equal(isWideScope(''), false);
  assert.equal(wideScopeName('group:sword'), 'All sword strikes');
});

test('a saved category survives, clears item links, and only belongs on attacks and damage', () => {
  const r = recipe({ matchScope: 'group:sword', itemUuid: 'Item.a', catalogEntry: 'x' });
  assert.equal(r.matchScope, 'group:sword'); assert.equal(r.itemUuid, ''); assert.equal(r.catalogEntry, undefined);
  assert.equal(r.weaponMode, undefined, 'any use of the weapon');
  assert.equal(recipe({ matchScope: 'group:sword', weaponMode: 'thrown' }).weaponMode, 'thrown');
  assert.equal(recipe({ matchScope: 'group:sword', trigger: 'use' }).matchScope, undefined);
  assert.equal(recipe({ matchScope: 'bad:sword' }).matchScope, undefined);
});

test('a category plays for its own weapons, in each system\'s field', () => {
  const sword = recipe({ matchScope: 'group:sword' });
  assert.equal(matchRecipe([sword], event({ group: 'sword' }))?.id, 'r');
  assert.equal(matchRecipe([sword], event({ group: 'axe' })), null);
  assert.equal(matchRecipe([sword], event({ group: null })), null, 'an NPC natural attack has none');
  assert.equal(matchRecipe([sword], { ...event({ group: 'sword' }), item: { type: 'spell', system: { group: 'sword' } } }), null, 'weapons only');
  assert.equal(matchRecipe([recipe({ matchScope: 'category:martial' })], event({ category: 'martial' }))?.id, 'r');
  assert.equal(matchRecipe([recipe({ matchScope: 'type:simpleM' })], event({ type: { value: 'simpleM' } }))?.id, 'r');
  assert.equal(matchRecipe([recipe({ matchScope: 'type:simpleM' })], event({ type: { value: 'martialM' } })), null);
});

test('a chosen weapon use narrows a category', () => {
  const thrown = recipe({ matchScope: 'group:dart', weaponMode: 'thrown' });
  assert.equal(matchRecipe([thrown], event({ group: 'dart' }, { weaponMode: 'thrown' }))?.id, 'r');
  assert.equal(matchRecipe([thrown], event({ group: 'dart' })), null);
});

test('the narrower wins: a named item, then a category, then all melee', () => {
  const all = recipe({ id: 'a-all', matchScope: 'melee' }), group = recipe({ id: 'm-group', matchScope: 'group:sword' }), named = recipe({ id: 'z-named', match: 'Longsword' });
  const e = event({ group: 'sword' });
  assert.equal(matchRecipe([all, group, named], e).id, 'z-named');
  assert.equal(matchRecipe([all, group], e).id, 'm-group');
  assert.equal(matchRecipe([all, group], event({ group: 'axe' })).id, 'a-all');
});

test('a category overrides built-in weapon animations as all melee does', () => {
  assert.equal(matchStrikeOverride([recipe({ matchScope: 'group:sword' })], event({ group: 'sword' }))?.id, 'r');
  assert.equal(matchStrikeOverride([recipe({ match: 'Longsword' })], event({ group: 'sword' })), null, 'a named item alone is not wide');
});
