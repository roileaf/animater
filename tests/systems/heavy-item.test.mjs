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
    assert.equal(heavyItem(pf2e({ slug: 'warhammer', usage: { value: 'held-in-one-hand' }, traits: { value: ['shove'] } }), id), false, 'a warhammer is one-handed');
  }
});

test('ranged weapons are never heavy, however two-handed', () => {
  const crossbow = pf2e({ slug: 'heavy-crossbow', usage: { value: 'held-in-two-hands' }, range: 120, traits: { value: ['reload-2'] } }, 'Heavy Crossbow');
  assert.equal(heavyItem(crossbow, 'pf2e'), false, 'PF2e heavy crossbow: two-handed with a range');
  assert.equal(heavyItem({ ...crossbow, isMelee: false }, 'pf2e'), false, 'by the document own isMelee');
  assert.equal(heavyItem({ ...pf2e({ usage: { value: 'held-in-two-hands' } }), isMelee: true }, 'pf2e'), true);
  assert.equal(heavyItem({ name: 'Longbow', system: { type: { value: 'martialR', baseItem: 'longbow' }, properties: new Set(['amm', 'hvy', 'two']) } }, 'dnd5e'), false, 'D&D longbow: heavy and two-handed, but ranged');
  assert.equal(heavyItem({ name: 'Greatsword', system: { type: { value: 'martialM', baseItem: 'greatsword' }, properties: new Set(['hvy', 'two']) } }, 'dnd5e'), true);
  assert.equal(heavyItem({ name: 'Warhammer', system: { type: { value: 'martialM', baseItem: 'warhammer' }, properties: new Set(['ver']) } }, 'dnd5e'), false, 'versatile, not heavy');
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
