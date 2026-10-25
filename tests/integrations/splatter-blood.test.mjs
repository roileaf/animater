import test from 'node:test';
import assert from 'node:assert/strict';
import { splatterColorOf, splatterBloodFrom, splatterCreatureType, splatterBlood } from '../../scripts/integrations/splatter.mjs';

// Splatter 7.0.0's default Blood Sheet (BloodSheetData) and world blood colour, as it registers them.
const SHEET = {
  aberration: '#b527d5d5', beast: '#a51414d8', construct: '#5f4d39d5', elemental: '#737373b1',
  humanoid: '#a51414d8', ooze: '#f3900fd8', plant: '#195d09d8', undead: '#440707d8',
};
const DEFAULT = '#a51414d8';

test("colour strings as Splatter reads them: '#rrggbb' opaque, '#rrggbbaa' with alpha", () => {
  assert.deepEqual(splatterColorOf('#a51414'), { color: 0xa51414, alpha: 1 });
  const c = splatterColorOf('#440707d8');
  assert.equal(c.color, 0x440707);
  assert.ok(Math.abs(c.alpha - 0xd8 / 255) < 1e-9);
  assert.equal(splatterColorOf(''), null);
  assert.equal(splatterColorOf(undefined), null);
});

test("the token's own blood colour flag wins over the Blood Sheet", () => {
  const blood = splatterBloodFrom({ flag: '#00ff00', useBloodsheet: true, sheet: SHEET, creatureType: 'undead', defaultColor: DEFAULT });
  assert.deepEqual(blood, { bleeds: true, color: 0x00ff00, alpha: 1 });
});

test('the Blood Sheet by creature type: exact, then a key the type contains; arrays take the last match (PF2e traits)', () => {
  assert.equal(splatterBloodFrom({ useBloodsheet: true, sheet: SHEET, creatureType: 'ooze', defaultColor: DEFAULT }).color, 0xf3900f);
  assert.equal(splatterBloodFrom({ useBloodsheet: true, sheet: SHEET, creatureType: 'undead (skeleton)', defaultColor: DEFAULT }).color, 0x440707);
  assert.equal(splatterBloodFrom({ useBloodsheet: true, sheet: SHEET, creatureType: ['humanoid', 'undead', 'mindless'], defaultColor: DEFAULT }).color, 0x440707);
  // Not on the sheet, or the sheet is off: the world blood colour.
  assert.equal(splatterBloodFrom({ useBloodsheet: true, sheet: SHEET, creatureType: 'dragon', defaultColor: DEFAULT }).color, 0xa51414);
  assert.equal(splatterBloodFrom({ useBloodsheet: false, sheet: SHEET, creatureType: 'ooze', defaultColor: DEFAULT }).color, 0xa51414);
});

test('a colour with zero alpha is how Splatter gives a creature no blood', () => {
  assert.equal(splatterBloodFrom({ flag: '#00000000', defaultColor: DEFAULT }).bleeds, false);
  assert.equal(splatterBloodFrom({ useBloodsheet: true, sheet: { ...SHEET, construct: '#5f4d3900' }, creatureType: 'construct', defaultColor: DEFAULT }).bleeds, false);
  assert.equal(splatterBloodFrom({ defaultColor: '#a5141400' }).bleeds, false);
});

test('nothing readable: unknown, so Animater falls back to its own rules', () => {
  assert.equal(splatterBloodFrom({ defaultColor: '' }), null);
});

test("creature type from Splatter's data paths: the custom path first, else the type path, else the actor type", () => {
  const get = (obj, path) => path.split('.').reduce((o, k) => o?.[k], obj);
  const actor = { type: 'npc', system: { details: { type: { value: 'undead', custom: '' } }, traits: { value: ['undead', 'skeleton'] } } };
  assert.equal(splatterCreatureType(actor, { typePath: 'details.type.value', customPath: 'details.type.custom' }, get), 'undead');
  assert.deepEqual(splatterCreatureType(actor, { typePath: 'traits.value', customPath: '' }, get), ['undead', 'skeleton']);
  assert.equal(splatterCreatureType({ ...actor, system: { details: { type: { value: 'x', custom: 'Bone golem' } } } }, { typePath: 'details.type.value', customPath: 'details.type.custom' }, get), 'Bone golem');
  assert.equal(splatterCreatureType({ type: 'character', system: {} }, { typePath: '', customPath: '' }, get), 'character');
});

test('splatterBlood(token): null while Splatter is off; otherwise its answer from its own settings and flags', () => {
  const get = (obj, path) => path.split('.').reduce((o, k) => o?.[k], obj);
  const settings = { useBloodsheet: true, BloodSheetData: SHEET, bloodColor: DEFAULT, creatureType: 'traits.value', creatureTypeCustom: '' };
  const token = { document: { flags: {} }, actor: { type: 'npc', system: { traits: { value: ['ooze', 'mindless'] } } } };
  const setting = (key) => settings[key];
  assert.equal(splatterBlood(token, { active: false, setting, getProperty: get }), null);
  assert.equal(splatterBlood(token, { active: true, setting, getProperty: get }).color, 0xf3900f);
  const flagged = { ...token, document: { flags: { splatter: { bloodColor: '#11223300' } } } };
  assert.equal(splatterBlood(flagged, { active: true, setting, getProperty: get }).bleeds, false);
  // A setting that throws (not registered yet) is read as missing.
  assert.equal(splatterBlood(token, { active: true, setting: () => { throw new Error('no'); }, getProperty: get }), null);
});
