import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isEarthSpell, quakeSpots, QUAKE, QUAKE_DUST } from '../../../scripts/engines/motion/earth-spell.mjs';
import { isWaterSpell, spellDamageTypes } from '../../../scripts/engines/props/area-damage.mjs';
import { quenchedBy } from '../../../scripts/engines/props/fire-spread.mjs';
import { SETTINGS_TABS } from '../../../scripts/ui/settings-window.mjs';

const main = readFileSync(new URL('../../../scripts/main.mjs', import.meta.url), 'utf8');
const registration = (key) => main.match(new RegExp(`registerSetting\\("${key}", \\{[\\s\\S]*?\\n  \\}\\);`))?.[0] ?? '';

// Roi, 2026-11-25, of the elements meeting the world: "earth spells shaking the ceiling".
test('an earth spell is known by its earth trait, or by its name in any system', () => {
  assert.equal(isEarthSpell({ name: 'Spike Stones', traits: ['earth'] }), true, 'PF2e: the earth trait');
  for (const name of ['Earthquake', 'Earth Tremor', 'Tremor', 'Seismic Wave', 'Rockslide', 'Avalanche', 'Shockwave', 'Move Earth']) assert.equal(isEarthSpell({ name }), true, name);
  for (const name of ['Fireball', 'Earthbind', 'Hearth Blessing', 'Gust of Wind', 'Stoneskin', '']) assert.equal(isEarthSpell({ name }), false, name);
  assert.equal(isEarthSpell(), false);
});

test('its dust comes down all across its area, a few places at most, and only inside it', () => {
  const box = { x: 0, y: 0, w: 800, h: 800 };
  const all = quakeSpots({ box, inArea: () => true, most: 6 });
  assert.equal(all.length, 6);
  assert.ok(Math.max(...all.map((p) => p.x)) - Math.min(...all.map((p) => p.x)) > 300 && Math.max(...all.map((p) => p.y)) - Math.min(...all.map((p) => p.y)) > 300, 'spread out, not in one corner');
  const disc = quakeSpots({ box, inArea: (p) => Math.hypot(p.x - 400, p.y - 400) <= 250, most: 6 });
  assert.ok(disc.length >= 1 && disc.every((p) => Math.hypot(p.x - 400, p.y - 400) <= 250), 'only inside its shape');
  assert.deepEqual(quakeSpots({ box, inArea: () => false }), []);
  assert.deepEqual(quakeSpots({ box: null }), []);
  assert.deepEqual(quakeSpots({ box: { x: 0, y: 0, w: 0, h: 5 } }), []);
  assert.deepEqual(quakeSpots({ box, inArea: () => { throw new Error('no'); } }), [], 'an area that cannot be asked gets none');
  assert.ok(QUAKE.length >= 2 && QUAKE[0].delay === 0 && QUAKE[1].delay > 0 && QUAKE[0].weight >= QUAKE[1].weight, 'two jolts, the second no harder');
  assert.ok(QUAKE_DUST >= 4);
});

test('wired: every screen feels it for itself as the spell\'s area appears; nothing is saved or sent', () => {
  assert.match(main, /for \(const hook of \["createMeasuredTemplate", "createRegion"\]\) Hooks\.on\(hook, \(doc\) => propSafe\("earth spell", \(\) => quakeEarthSpell\(doc\)\)\);/);
  const quake = main.slice(main.indexOf('function quakeEarthSpell(doc) {'), main.indexOf('for (const hook of ["createMeasuredTemplate", "createRegion"]) Hooks.on(hook, (doc) => propSafe("earth spell"'));
  assert.match(quake, /if \(!canvas\?\.ready \|\| doc\?\.parent\?\.id !== canvas\.scene\?\.id \|\| !earthSpellsOn\(\)\) return;/);
  assert.match(quake, /isEarthSpell\(\{ name: item\?\.name, traits: Array\.from\(item\?\.system\?\.traits\?\.value \?\? \[\]\) \}\)/);
  assert.match(quake, /cameraShake\.tremor\(/);
  assert.match(quake, /quakeSpots\(\{ box, inArea \}\)\.filter\(\(p\) => underCeiling\(p\)\)/, 'dust only where there is a ceiling to shake it from');
  assert.match(quake, /ceilingDust\.fall\(/);
  assert.match(quake, /shakeWaters\(at, 5, /, 'and the ponds near it ring');
  assert.ok(!/propsOn\(|updateEmbeddedDocuments|game\.socket\.emit|setFlag|rubble/.test(quake), 'nothing written, nothing sent, no rubble: the cave-in stays the GM\'s tool');
  assert.match(registration('earthSpells'), /name: "Earth spells shake the ground"[\s\S]*scope: "world", config: true, type: Boolean, default: true/);
  assert.ok(SETTINGS_TABS.flatMap((t) => t.rows).some((r) => r.extras?.includes('earthSpells')));
});

// Roi, the same day: "water spells quenching". Quenching was already built for the damage types water and cold, but no
// spell deals a damage type called water: a water spell's water is its trait. So nothing ever quenched by water.
test('a water spell is known by its water trait or its name, and never when it is a spell of fire', () => {
  assert.equal(isWaterSpell({ name: 'Hydraulic Push', traits: ['water', 'attack'] }), true);
  for (const name of ['Tidal Wave', 'Tsunami', 'Create Water', 'Wall of Water', 'Deluge', 'Geyser', 'Hydraulic Torrent', 'Flood', 'Watery Sphere', 'Control Water']) assert.equal(isWaterSpell({ name }), true, name);
  for (const name of ['Fireball', 'Waterfall of Flame', 'Rain of Fire', 'Wave of Despair', 'Underwater Breathing', '']) assert.equal(isWaterSpell({ name, traits: name.includes('Flame') ? ['fire'] : [] }), false, name);
  assert.equal(isWaterSpell({ name: 'Tidal Wave', traits: ['fire'] }), false, 'a spell of fire puts nothing out');
  assert.equal(isWaterSpell(), false);
});

test('a water spell\'s damage types gain water, which is what quenches; other spells are left as they are', () => {
  const push = { name: 'Hydraulic Push', system: { traits: { value: ['water'] } } };
  assert.deepEqual(spellDamageTypes(['bludgeoning'], push), ['bludgeoning', 'water'], 'it still breaks what it broke');
  assert.deepEqual(spellDamageTypes([], { name: 'Create Water', system: {} }), ['water'], 'one that deals no damage at all still puts fires out');
  assert.deepEqual(spellDamageTypes(['water'], push), ['water'], 'never twice');
  assert.deepEqual(spellDamageTypes(['fire'], { name: 'Fireball', system: { traits: { value: ['fire'] } } }), ['fire']);
  assert.deepEqual(spellDamageTypes(['cold'], null), ['cold']);
  assert.ok(spellDamageTypes([], push).some(quenchedBy), 'and water is one of the two things that quench');
  assert.match(main, /return spellDamageTypes\(damageTypesOfItem\(item, game\.system\.id, \{ activity \}\), item\);/);
});

test('the dust comes down in rounds: a few whatever happens, then for as long as the spell is still seen', async () => {
  const { quakeDustGoesOn, QUAKE_ROUNDS, QUAKE_ROUNDS_MOST, QUAKE_DUST, QUAKE_DUST_AFTER } = await import('../../../scripts/engines/motion/earth-spell.mjs');
  for (let r = 0; r < QUAKE_ROUNDS; r++) assert.equal(quakeDustGoesOn(r, 0), true, `round ${r} with no animation`);
  assert.equal(quakeDustGoesOn(QUAKE_ROUNDS, 0), false, 'then it stops');
  assert.equal(quakeDustGoesOn(QUAKE_ROUNDS, 2000), true, 'unless the spell is still playing');
  assert.equal(quakeDustGoesOn(QUAKE_ROUNDS_MOST, 9000), false, 'never for ever');
  assert.ok(QUAKE_DUST > QUAKE_DUST_AFTER, 'the first shake brings down the most');
});
