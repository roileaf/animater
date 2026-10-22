import test from 'node:test';
import assert from 'node:assert/strict';
import { usedItemDamages, usedItemElement } from '../../scripts/systems/item-damages.mjs';

const cases = [
  // PF2e / SF2e spells: system.damage is a record of entries with a formula and kinds.
  ['pf2e fireball', 'pf2e', { type: 'spell', system: { damage: { abc: { formula: '6d6', type: 'fire', kinds: ['damage'] } } } }, true],
  ['pf2e spell, kinds as a Set', 'pf2e', { type: 'spell', system: { damage: { a: { formula: '2d4', kinds: new Set(['damage', 'healing']) } } } }, true],
  ['pf2e spell, kinds left out', 'pf2e', { type: 'spell', system: { damage: { a: { formula: '1d4' } } } }, true],
  ['pf2e heal spell', 'pf2e', { type: 'spell', system: { damage: { a: { formula: '1d8', kinds: ['healing'] } } } }, false],
  ['pf2e buff spell (no damage)', 'pf2e', { type: 'spell', system: { damage: {} } }, false],
  ['sf2e damaging spell', 'sf2e', { type: 'spell', system: { damage: { a: { formula: '3d6', kinds: ['damage'] } } } }, true],
  ['pf2e alchemist fire', 'pf2e', { type: 'consumable', system: { damage: { formula: '1d8', kind: 'damage' } } }, true],
  ['pf2e healing potion', 'pf2e', { type: 'consumable', system: { damage: { formula: '1d8', kind: 'healing' } } }, false],
  ['pf2e weapon', 'pf2e', { type: 'weapon', system: { damage: { dice: 1, die: 'd8', damageType: 'slashing' } } }, true],
  ['pf2e feat', 'pf2e', { type: 'feat', system: { damage: { a: { formula: '2d6' } } } }, false],
  // D&D 5e: activities (a Map-like collection) with damage parts.
  ['dnd5e fire bolt', 'dnd5e', { type: 'spell', system: { activities: new Map([['x', { type: 'attack', damage: { parts: [{ number: 1, denomination: 10 }] } }]]) } }, true],
  ['dnd5e activities as a record', 'dnd5e', { type: 'spell', system: { activities: { x: { type: 'save', damage: { parts: [{}] } } } } }, true],
  ['dnd5e cure wounds', 'dnd5e', { type: 'spell', system: { activities: new Map([['x', { type: 'heal', healing: { number: 2 } }]]) } }, false],
  ['dnd5e utility spell', 'dnd5e', { type: 'spell', system: { activities: new Map([['x', { type: 'utility', damage: { parts: [] } }]]) } }, false],
  // Daggerheart: actions, or a weapon's attack, with hit-point damage.
  ['daggerheart damaging action', 'daggerheart', { type: 'domainCard', system: { actions: { a: { type: 'attack', damage: { main: { value: '2d6' } } } } } }, true],
  ['daggerheart weapon attack', 'daggerheart', { type: 'weapon', system: { actions: [], attack: { type: 'attack', damage: { main: { value: 'd8' } } } } }, true],
  ['daggerheart healing action', 'daggerheart', { type: 'domainCard', system: { actions: { a: { type: 'healing', damage: { main: { value: '1d4' } } } } } }, false],
  ['daggerheart action without damage', 'daggerheart', { type: 'domainCard', system: { actions: { a: { type: 'effect' } } } }, false],
  // Anything else.
  ['no item', 'pf2e', null, false],
  ['no system data', 'dnd5e', { type: 'spell' }, false],
  ['an unknown system', 'other', { type: 'spell', system: { damage: { a: { formula: '1d6' } } } }, false],
];

for (const [name, systemId, item, expected] of cases) {
  test(`usedItemDamages: ${name}`, () => {
    assert.equal(usedItemDamages(item, systemId), expected);
  });
}

const elements = [
  ['pf2e fireball', 'pf2e', { type: 'spell', system: { damage: { k: { formula: '6d6', type: 'fire', kinds: ['damage'] } }, traits: { value: ['concentrate', 'fire', 'manipulate'] } } }, undefined, 'fire'],
  ['pf2e spell, physical and fire', 'pf2e', { type: 'spell', system: { damage: { a: { formula: '2d6', type: 'bludgeoning' }, b: { formula: '2d6', type: 'fire' } } } }, undefined, 'fire'],
  ['pf2e spell, no damage type: its element trait', 'pf2e', { type: 'spell', system: { damage: { a: { formula: '2d6' } }, traits: { value: ['cold'] } } }, undefined, 'cold'],
  ['pf2e spell, physical damage: not its trait', 'pf2e', { type: 'spell', system: { damage: { a: { formula: '2d6', type: 'piercing' } }, traits: { value: ['fire'] } } }, undefined, null],
  ['pf2e buff with a fire trait', 'pf2e', { type: 'spell', system: { damage: {}, traits: { value: ['fire'] } } }, undefined, null],
  ['pf2e healing spell', 'pf2e', { type: 'spell', system: { damage: { a: { formula: '1d8', type: 'vitality', kinds: ['healing'] } } } }, undefined, null],
  ['sf2e acid spell', 'sf2e', { type: 'spell', system: { damage: { a: { formula: '3d6', type: 'acid', kinds: ['damage'] } } } }, undefined, 'acid'],
  ['pf2e acid flask', 'pf2e', { type: 'consumable', system: { damage: { formula: '1d6', type: 'acid', kind: 'damage' } } }, undefined, 'acid'],
  ['dnd5e fireball, its activity', 'dnd5e', { type: 'spell', system: { activities: new Map() } }, { damage: { parts: [{ types: new Set(['fire']) }] } }, 'fire'],
  ['dnd5e ice storm, across activities', 'dnd5e', { type: 'spell', system: { activities: { a: { damage: { parts: [{ types: ['cold'] }, { types: ['bludgeoning'] }] } } } } }, undefined, 'cold'],
  ['dnd5e chromatic orb, a choice', 'dnd5e', { type: 'spell', system: { activities: { a: { damage: { parts: [{ types: ['fire', 'cold', 'acid'] }] } } } } }, undefined, null],
  ['no item', 'pf2e', null, undefined, null],
];
for (const [name, systemId, item, activity, expected] of elements) {
  test(`usedItemElement: ${name}`, () => {
    assert.equal(usedItemElement(item, systemId, activity), expected);
  });
}

test('usedItemDamages: a throwing getter reads as no damage', () => {
  const item = { type: 'spell', get system() { throw new Error('boom'); } };
  assert.equal(usedItemDamages(item, 'pf2e'), false);
});
