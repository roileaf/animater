import test from 'node:test';
import assert from 'node:assert/strict';
import { creatureBlood } from '../../scripts/integrations/splatter.mjs';
import { DEFAULT_BLOOD, colorNumber } from '../../scripts/engines/motion/blood-colors.mjs';

const get = (obj, path) => path.split('.').reduce((o, k) => o?.[k], obj);
const SPLATTER = { useBloodsheet: true, BloodSheetData: { plant: '#195d09d8' }, bloodColor: '#a51414d8', creatureType: 'traits.value', creatureTypeCustom: '' };
const plant = (flags = {}) => ({ name: 'Vine', flags, actor: { type: 'npc', system: { traits: { value: ['plant'] } } } });

test("without Splatter: Animater's table by type, a token's flags first (lens blood and ground drops)", () => {
  const off = { active: false, setting: () => undefined, getProperty: get, system: 'pf2e' };
  assert.deepEqual(creatureBlood(plant(), off), { bleeds: true, color: colorNumber(DEFAULT_BLOOD.plant.color), alpha: 1 });
  assert.equal(creatureBlood(plant(), { ...off, table: { plant: { color: '#00ff00' } } }).color, 0x00ff00);
  assert.equal(creatureBlood(plant({ animater: { bloodColor: 'none' } }), off).bleeds, false);
  assert.equal(creatureBlood(plant({ animater: { bloodColor: '#0000ff' }, splatter: { bloodColor: '#ff0000' } }), off).color, 0x0000ff);
  // A placeable (token.document, token.actor) reads the same.
  const doc = plant({ splatter: { bloodColor: '#ff0000' } });
  assert.equal(creatureBlood({ actor: doc.actor, document: doc }, off).color, 0xff0000);
  assert.equal(creatureBlood({ actor: { type: 'npc', system: { traits: { value: ['construct'] } } }, document: { flags: {} } }, off).bleeds, false);
});

test("with Splatter active its rules win over Animater's table and the Animater flag", () => {
  const on = { active: true, setting: (k) => SPLATTER[k], getProperty: get, system: 'pf2e', table: { plant: { color: '#00ff00' } } };
  assert.equal(creatureBlood(plant({ animater: { bloodColor: '#0000ff' } }), on).color, 0x195d09);
  // Splatter's settings unreadable: Animater's own rules.
  assert.equal(creatureBlood(plant(), { ...on, setting: () => { throw Error('x'); } }).color, 0x00ff00);
});
