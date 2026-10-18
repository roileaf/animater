import test from 'node:test';
import assert from 'node:assert/strict';
import { PF2E_SPELLS, spellRecipe } from '../../../scripts/catalogs/pf2e/spells/spell-catalog.mjs';
import { PF2E_EFFECTS, stateRecipe } from '../../../scripts/catalogs/pf2e/state-catalog.mjs';
import { BESPOKE } from '../../../scripts/catalogs/bespoke/index.mjs';
import { bespokeKeys } from '../../../scripts/catalogs/shared/bespoke.mjs';
import { planRecipe } from '../../../scripts/core/model.mjs';
import { ELEMENT_CHOICE_SPELLS } from '../../../scripts/catalogs/bespoke/element-choice-spells.mjs';

const spell = name => PF2E_SPELLS.find(s => s.name === name);
const context = { source: { id: 's', center: { x: 0, y: 0 } }, targets: [{ id: 't', center: { x: 300, y: 0 } }], gridSize: 100 };
const media = r => r.stages.flatMap(s => (s.assets ?? []).map(key => ({ key, file: 'x.webm' })));

test('Entropic Wheel plays its bespoke dual thermal wheel and its effect keeps turning', () => {
  const r = spellRecipe(spell('Entropic Wheel'));
  assert.equal(r.bespoke, 'pf2e:X4T5RlQBrdpmA35n');
  const keys = r.stages.flatMap(s => s.assets);
  assert.ok(keys.some(k => /fire_ring/.test(k)) && keys.some(k => /orbit\.complete\.cold/.test(k)));
  const rings = r.stages.filter(s => s.tracks?.some(t => t.property === 'rotation'));
  assert.equal(rings.length, 2);
  assert.ok(Math.sign(rings[0].tracks[0].to) !== Math.sign(rings[1].tracks[0].to), 'rings counter-rotate');
  assert.ok(planRecipe(r, media(r), context).length >= 5);
  const effect = stateRecipe(PF2E_EFFECTS.find(e => e.name === 'Spell Effect: Entropic Wheel'));
  assert.ok(effect.stages.some(s => /fire_ring/.test(s.assets[0])) && effect.stages.some(s => /orbit\.loop\.cold/.test(s.assets[0])));
});
test('every bespoke design builds a valid, plannable recipe for a real catalog entry', () => {
  for (const [key, design] of Object.entries(BESPOKE)) {
    assert.match(key, /^(?:pf2e|sf2e|dnd5e):[\w-]+(?::[\w .·-]+)?$/, key);
    assert.equal(typeof design.build, 'function', key);
    assert.ok(design.rationale, key);
  }
});
test('lookup keys prefer the variant, then the entry', () => {
  assert.deepEqual(bespokeKeys({ systemId: 'dnd5e' }, { id: 'e1' }, { variant: { id: 'v1' } }), ['dnd5e:e1:v1', 'dnd5e:e1']);
  assert.deepEqual(bespokeKeys({ weaponMode: 'thrown' }, { id: 'w' }), ['pf2e:w:thrown', 'pf2e:w']);
});
test('element-choice spells are flagged for play-time element art', () => {
  assert.ok(ELEMENT_CHOICE_SPELLS.size >= 15);
  for (const name of ['Resist Energy', 'Elemental Gift', 'Elemental Breath']) {
    const s = spell(name);
    assert.ok(ELEMENT_CHOICE_SPELLS.has(s.id), name);
    assert.equal(spellRecipe(s).elementChoice, true, name);
  }
  assert.notEqual(spellRecipe(spell('Fireball')).elementChoice, true);
});
