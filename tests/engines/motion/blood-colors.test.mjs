import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_BLOOD, BLOOD_TYPES, creatureBloodType, bloodFor, normalizeBloodTable, colorNumber, colorHex, creatureHasHeart, HEARTLESS } from '../../../scripts/engines/motion/blood-colors.mjs';
import { bleedsBlood } from '../../../scripts/engines/motion/ground-trails.mjs';

const pf2e = (traits, extra = {}) => ({ system: 'pf2e', actor: { type: 'npc', system: { traits: { value: traits } } }, ...extra });
const dnd = (type, extra = {}) => ({ system: 'dnd5e', actor: { type: 'npc', system: { details: { type } } }, ...extra });

test('the default table: every type has a #rrggbb colour and a bleeds switch; bloodless types do not bleed', () => {
  for (const [key, v] of Object.entries(DEFAULT_BLOOD)) {
    assert.match(v.color, /^#[0-9a-f]{6}$/, key);
    assert.equal(typeof v.bleeds, 'boolean', key);
  }
  for (const key of ['construct', 'elemental', 'ooze', 'spirit', 'incorporeal', 'object', 'skeleton']) assert.equal(DEFAULT_BLOOD[key].bleeds, false, key);
  for (const key of ['default', 'humanoid', 'undead', 'plant', 'aberration', 'insect', 'dragon', 'fiend', 'celestial', 'fey']) assert.equal(DEFAULT_BLOOD[key].bleeds, true, key);
  assert.equal(DEFAULT_BLOOD.default.color, '#7a0d0d');
  assert.deepEqual(BLOOD_TYPES.map((t) => t.key).sort(), Object.keys(DEFAULT_BLOOD).sort(), 'every type has a label');
  assert.ok(BLOOD_TYPES.every((t) => t.label));
});

test('creatureBloodType: PF2e/SF2e traits in a fixed priority', () => {
  assert.equal(creatureBloodType(pf2e(['humanoid', 'human'])), 'humanoid');
  assert.equal(creatureBloodType(pf2e(['undead', 'skeleton', 'mindless'])), 'skeleton', 'bones over undead');
  assert.equal(creatureBloodType(pf2e(['undead', 'zombie', 'mindless'])), 'undead');
  assert.equal(creatureBloodType(pf2e(['undead', 'vampire', 'humanoid'])), 'undead', 'undead over humanoid');
  assert.equal(creatureBloodType(pf2e(['undead', 'incorporeal', 'spirit'])), 'incorporeal');
  assert.equal(creatureBloodType(pf2e(['construct', 'golem'])), 'construct');
  assert.equal(creatureBloodType(pf2e(['fiend', 'demon'])), 'fiend');
  assert.equal(creatureBloodType(pf2e(['celestial', 'angel'])), 'celestial');
  assert.equal(creatureBloodType(pf2e(['fungus', 'plant'])), 'fungus');
  assert.equal(creatureBloodType(pf2e(['plant'])), 'plant');
  assert.equal(creatureBloodType(pf2e(['dragon', 'fire'])), 'dragon');
  assert.equal(creatureBloodType(pf2e(['aberration'])), 'aberration');
  assert.equal(creatureBloodType({ system: 'sf2e', actor: { type: 'npc', system: { traits: { value: new Set(['ooze']) } } } }), 'ooze');
  assert.equal(creatureBloodType(pf2e(['animal'])), 'animal');
});

test('creatureBloodType: D&D type value, custom and subtype; names refine broad types', () => {
  assert.equal(creatureBloodType(dnd({ value: 'humanoid' })), 'humanoid');
  assert.equal(creatureBloodType(dnd({ value: 'Undead' })), 'undead');
  assert.equal(creatureBloodType(dnd({ value: 'construct' })), 'construct');
  assert.equal(creatureBloodType(dnd('plant')), 'plant', 'an old string type');
  assert.equal(creatureBloodType(dnd({ value: 'custom', custom: 'Insect' })), 'insect');
  assert.equal(creatureBloodType(dnd({ value: 'fiend', subtype: 'demon' })), 'fiend');
  assert.equal(creatureBloodType(dnd({ value: 'undead' }, { name: 'Skeleton Archer' })), 'skeleton', 'bones over D&D undead');
  assert.equal(creatureBloodType(dnd({ value: 'beast' }, { name: 'Giant Spider' })), 'insect');
  assert.equal(creatureBloodType(dnd({ value: 'humanoid' }, { name: 'Spider Cultist' })), 'humanoid', 'a humanoid stays humanoid');
  assert.equal(creatureBloodType({ system: 'dnd5e', actor: { type: 'vehicle', system: {} } }), 'object');
  assert.equal(creatureBloodType({ system: 'pf2e', actor: { type: 'hazard', system: {} } }), 'object');
});

test('creatureBloodType: names only (Daggerheart, or no type)', () => {
  const dh = (name) => creatureBloodType({ system: 'daggerheart', actor: { type: 'adversary', name, system: { traits: { value: ['construct'] } } } });
  assert.equal(dh('Giant Beetle'), 'insect');
  assert.equal(dh('Treant Sentinel'), 'plant');
  assert.equal(dh('Zombie Pack'), 'undead');
  assert.equal(dh('Vampire'), 'undead');
  assert.equal(dh('Skeleton Knight'), 'skeleton');
  assert.equal(dh('Iron Golem'), 'construct');
  assert.equal(dh('Green Slime'), 'ooze');
  assert.equal(dh('Young Red Dragon'), 'dragon');
  assert.equal(dh('Bandit'), 'default', 'Daggerheart traits are not creature types');
  assert.equal(creatureBloodType({ name: 'Ghoul' }), 'undead');
  assert.equal(creatureBloodType({}), 'default');
  assert.equal(creatureBloodType({ name: 'Antonio' }), 'default', 'whole words only');
});

test('bloodFor: by type, with the table over the defaults', () => {
  assert.deepEqual(bloodFor(pf2e(['humanoid'])), { bleeds: true, color: 0x7a0d0d, type: 'humanoid' });
  assert.deepEqual(bloodFor(pf2e(['construct'])), { bleeds: false, color: colorNumber(DEFAULT_BLOOD.construct.color), type: 'construct' });
  assert.equal(bloodFor(pf2e(['undead', 'zombie'])).color, colorNumber(DEFAULT_BLOOD.undead.color));
  assert.equal(bloodFor({ ...pf2e(['plant']), table: { plant: { color: '#00ff00' } } }).color, 0x00ff00);
  assert.equal(bloodFor({ ...pf2e(['plant']), table: { plant: { bleeds: false } } }).bleeds, false);
  assert.equal(bloodFor({ ...pf2e(['construct']), table: { construct: { bleeds: true, color: '#333333' } } }).bleeds, true, 'a GM can make oil-bleeding constructs');
  assert.equal(bloodFor({ name: 'Bob', table: { default: { color: '#123456' } } }).color, 0x123456);
  assert.equal(bloodFor({ name: 'Bob', table: 'garbage' }).color, 0x7a0d0d);
});

test('bloodFor: token flags win: Animater flag, then Splatter flag, then the table', () => {
  const table = { humanoid: { color: '#00ff00' } };
  const base = { ...pf2e(['humanoid']), table };
  assert.equal(bloodFor({ ...base, tokenFlags: { animater: { bloodColor: '#0000ff' }, splatter: { bloodColor: '#ff0000' } } }).color, 0x0000ff);
  assert.equal(bloodFor({ ...base, tokenFlags: { splatter: { bloodColor: '#ff0000aa' } } }).color, 0xff0000);
  assert.equal(bloodFor({ ...base, tokenFlags: { splatter: { bloodColor: '#ff000000' } } }).bleeds, false, "Splatter's alpha 0 is no blood");
  assert.equal(bloodFor({ ...base, tokenFlags: { animater: { bloodColor: '' }, splatter: { bloodColor: '#ff0000' } } }).color, 0xff0000, "'' is by type: Splatter's flag next");
  assert.equal(bloodFor({ ...base, tokenFlags: { animater: { bloodColor: '' } } }).color, 0x00ff00);
  const none = bloodFor({ ...base, tokenFlags: { animater: { bloodColor: 'none' }, splatter: { bloodColor: '#ff0000' } } });
  assert.equal(none.bleeds, false);
  assert.equal(bloodFor({ ...pf2e(['construct']), tokenFlags: { animater: { bloodColor: '#444444' } } }).bleeds, true, 'a coloured construct bleeds');
  assert.equal(bloodFor({ ...base, tokenFlags: { animater: { bloodColor: 'nonsense' } } }).color, 0x00ff00, 'a bad flag is ignored');
});

test('normalizeBloodTable: known types, valid colours and booleans only', () => {
  assert.deepEqual(normalizeBloodTable(null), {});
  assert.deepEqual(normalizeBloodTable('x'), {});
  assert.deepEqual(normalizeBloodTable({
    humanoid: { color: '#AABBCC', bleeds: false }, plant: { color: 'green' }, undead: { color: '112233', bleeds: 'yes' },
    unicorn: { color: '#ffffff' }, default: { color: '#010203' }, fey: null, __proto__: { color: '#ffffff' },
  }), { humanoid: { color: '#aabbcc', bleeds: false }, undead: { color: '#112233' }, default: { color: '#010203' } });
});

test('colour helpers', () => {
  assert.equal(colorNumber('#a51414'), 0xa51414);
  assert.equal(colorNumber('#a51414d8'), 0xa51414);
  assert.equal(colorNumber('nope'), null);
  assert.equal(colorHex(0xa51414), '#a51414');
  assert.equal(colorHex(0x14), '#000014');
});

test('bleedsBlood agrees with the default table', () => {
  for (const trait of ['construct', 'elemental', 'ooze', 'incorporeal', 'skeleton', 'spirit', 'object']) assert.equal(bleedsBlood({ type: 'npc', system: { traits: { value: [trait] } } }), false, trait);
  assert.equal(bleedsBlood({ type: 'npc', system: { traits: { value: ['undead', 'zombie'] } } }), true);
  assert.equal(bleedsBlood({ type: 'loot', system: {} }), false);
  assert.equal(bleedsBlood(null), false);
});

test('heartless types: the dead, the made, elementals, oozes, spirits, plants and fungi have no heartbeat', () => {
  for (const t of ['undead', 'skeleton', 'construct', 'elemental', 'ooze', 'spirit', 'incorporeal', 'object', 'plant', 'fungus']) assert.equal(creatureHasHeart(t), false, t);
  for (const t of ['humanoid', 'dragon', 'beast', 'aberration', 'insect', 'fiend', 'celestial', 'fey', 'default']) assert.equal(creatureHasHeart(t), true, t);
  assert.ok(HEARTLESS.has('plant'));
  // A PF2e leshy (plant trait) has none; an untyped vampire (by name) neither.
  assert.equal(creatureHasHeart(creatureBloodType({ system: 'pf2e', actor: { type: 'character', system: { traits: { value: ['leshy', 'plant'] } } } })), false);
  assert.equal(creatureHasHeart(creatureBloodType({ system: 'pf2e', actor: { type: 'npc', name: 'Vampire Count', system: { traits: { value: [] } } } })), false);
});
