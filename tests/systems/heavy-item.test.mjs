import test from 'node:test';
import assert from 'node:assert/strict';
import { heavyItem } from '../../scripts/systems/heavy-item.mjs';

const pf2e = (system, name = 'Weapon') => ({ type: 'weapon', name, system: { traits: { value: [] }, ...system } });

test('PF2e and SF2e: held in two hands, a two-hand trait, or a heavy family', () => {
  for (const id of ['pf2e', 'sf2e']) {
    assert.equal(heavyItem(pf2e({ usage: { value: 'held-in-two-hands' } }), id), true, 'a greataxe is held in two hands');
    assert.equal(heavyItem(pf2e({ usage: { value: 'held-in-one-hand' }, traits: { value: ['two-hand-d12'] } }), id), true, 'a bastard sword may be');
    assert.equal(heavyItem(pf2e({ slug: 'earthbreaker', usage: { value: 'held-in-one-hand' } }), id), true);
    assert.equal(heavyItem(pf2e({ slug: 'dagger', usage: { value: 'held-in-one-hand' }, traits: { value: ['agile', 'finesse'] } }), id), false);
  }
});

test('D&D 5e: heavy and two-handed, or a heavy family', () => {
  assert.equal(heavyItem({ name: 'Greatsword', system: { properties: new Set(['hvy', 'two']) } }, 'dnd5e'), true);
  assert.equal(heavyItem({ name: 'Rapier', system: { properties: new Set(['fin']) } }, 'dnd5e'), false);
  assert.equal(heavyItem({ name: 'Quarterstaff', system: { properties: ['ver'] } }, 'dnd5e'), false);
  assert.equal(heavyItem({ name: 'Big Chopper', system: { properties: new Set(), type: { baseItem: 'greataxe' } } }, 'dnd5e'), true, 'by its base item');
  assert.equal(heavyItem({ name: 'Two-hander', system: { properties: new Set(['two']) } }, 'dnd5e'), false, 'two-handed alone is not heavy');
});

test('other systems, spells and missing items go by the name only', () => {
  assert.equal(heavyItem({ name: 'Maul', system: {} }, 'daggerheart'), true);
  assert.equal(heavyItem({ name: 'Fireball', type: 'spell', system: { traits: { value: ['fire'] } } }, 'pf2e'), false);
  assert.equal(heavyItem(null, 'pf2e'), false);
  assert.equal(heavyItem({ name: 'Greatsword' }, 'pf2e'), false, 'no system data');
});
