import test from 'node:test';
import assert from 'node:assert/strict';
import { GAITS, creatureGait, creatureBulk } from '../../../scripts/engines/motion/creature-gait.mjs';

const pf2 = (traits, name = '', type = 'npc') => ({ system: 'pf2e', actor: { type, name, system: { traits: { value: traits } } }, name });
const dnd = (value, name = '', { subtype = '', swarm = '', items = [], type = 'npc' } = {}) =>
  ({ system: 'dnd5e', actor: { type, name, items: items.map((n) => ({ name: n })), system: { details: { type: { value, subtype, swarm } } } }, name });

test('creatureGait: PF2e / SF2e traits pick the gait when the name says nothing', () => {
  assert.equal(creatureGait(pf2(['animal'], 'Fluffy')), 'paws');
  assert.equal(creatureGait(pf2(['beast'], 'Bramble')), 'paws');
  assert.equal(creatureGait(pf2(['dragon', 'fire'], 'Ashmaw')), 'dragon');
  assert.equal(creatureGait(pf2(['ooze', 'mindless'], 'Something')), 'ooze');
  assert.equal(creatureGait(pf2(['swarm', 'animal'], 'The Tide')), 'legs');
  for (const t of ['humanoid', 'giant', 'fey', 'fiend', 'celestial', 'undead', 'construct']) assert.equal(creatureGait(pf2([t], 'Morg')), 'boots', t);
  assert.equal(creatureGait({ system: 'sf2e', actor: { type: 'npc', system: { traits: { value: ['humanoid'] } } }, name: 'Xa' }), 'boots');
  // Incorporeal beats everything, even a creature-ish name.
  assert.equal(creatureGait(pf2(['undead', 'incorporeal', 'spirit'], 'Spectral Wolf')), 'none');
});

test('creatureGait: unsure is unknown (dust, no tracks), never none', () => {
  assert.equal(creatureGait(pf2(['aberration'], 'Gibbering Thing')), 'unknown');
  assert.equal(creatureGait(dnd('monstrosity', 'Bulette Thing')), 'unknown');
  assert.equal(creatureGait({ system: 'daggerheart', actor: { type: 'adversary', name: 'Jagged Knife Lieutenant' }, name: 'Jagged Knife Lieutenant' }), 'unknown');
  assert.equal(creatureGait({}), 'unknown');
  assert.equal(creatureGait({ system: 'pf2e', actor: null, name: '' }), 'unknown');
  // Wheels: dust and rumble, no prints.
  for (const n of ['Clockwork Wheel', 'Supply Wagon', 'War Chariot']) assert.equal(creatureGait(pf2(['construct'], n)), 'unknown', n);
});

test('creatureGait: player characters wear boots unless their ancestry has other feet', () => {
  assert.equal(creatureGait(pf2(['human', 'humanoid'], 'Wolf', 'character')), 'boots');
  assert.equal(creatureGait(pf2(['centaur'], 'Seelah', 'character')), 'hooves');
  assert.equal(creatureGait(pf2(['tengu', 'humanoid'], 'Kaw', 'character')), 'talons');
  assert.equal(creatureGait(dnd('', 'Hoofwise', { type: 'character', items: ['Centaur', 'Fighter'] })), 'hooves');
  assert.equal(creatureGait({ system: 'daggerheart', actor: { type: 'character', name: 'Snake Eyes' }, name: 'Snake Eyes' }), 'boots');
  assert.equal(creatureGait(pf2(['incorporeal'], 'Ghostly PC', 'character')), 'none');
});

test('creatureGait: D&D 5e types, subtypes, swarms and Incorporeal Movement', () => {
  assert.equal(creatureGait(dnd('beast', 'Mossback')), 'paws');
  assert.equal(creatureGait(dnd('humanoid', 'Scout')), 'boots');
  assert.equal(creatureGait(dnd('dragon', 'Old One')), 'dragon');
  assert.equal(creatureGait(dnd('ooze', 'Grey')), 'ooze');
  assert.equal(creatureGait(dnd('beast', 'Swarm of Ravens', { swarm: 'tiny' })), 'legs');
  assert.equal(creatureGait(dnd('beast', 'Teeming Mass', { swarm: 'tiny' })), 'legs');
  assert.equal(creatureGait(dnd('humanoid', 'Lizard King', { subtype: 'lizardfolk' })), 'claws');
  assert.equal(creatureGait(dnd('undead', 'Lost Soul', { items: ['Incorporeal Movement'] })), 'none');
});

test('creatureGait: names refine and override the type', () => {
  const name = (n, traits = ['animal']) => creatureGait(pf2(traits, n));
  for (const n of ['Dire Wolf', 'Werewolf', 'Hellhound', 'Black Cat', 'Owlbear', 'Cave Bear', 'Giant Rat', 'Tiger']) assert.equal(name(n), 'paws', n);
  for (const n of ['Riding Horse', 'Warhorse', 'Elk', 'Mountain Goat', 'Wild Boar', 'Centaur Scout', 'Minotaur']) assert.equal(name(n), 'hooves', n);
  for (const n of ['Giant Eagle', 'Griffon', 'Roc', 'Velociraptor', 'Cockatrice']) assert.equal(name(n), 'talons', n);
  for (const n of ['Young Red Dragon', 'Wyvern', 'Fire Drake', 'Ancient Wyrm', 'Black Dragon Wyrmling', 'Sea Serpent Dragon']) assert.equal(name(n), 'dragon', n);
  assert.notEqual(name('Dragonborn Paladin'), 'dragon', 'a dragonborn is not a dragon');
  for (const n of ['Giant Lizard', 'Crocodile', 'Alligator', 'Basilisk']) assert.equal(name(n), 'claws', n);
  for (const n of ['Giant Viper', 'Sea Serpent', 'Purple Worm', 'Guardian Naga', 'Constrictor Snake']) assert.equal(name(n), 'slither', n);
  for (const n of ['Gelatinous Cube', 'Black Pudding', 'Ochre Jelly', 'Green Slime']) assert.equal(name(n, []), 'ooze', n);
  for (const n of ['Giant Spider', 'Phase Spider', 'Giant Scorpion', 'Giant Centipede', 'Fire Beetle', 'Giant Ant', 'Giant Crab']) assert.equal(name(n), 'legs', n);
  for (const n of ['Ghost', 'Wraith', 'Will-o-Wisp']) assert.equal(name(n, []), 'none', n);
  for (const n of ['Goblin Warrior', 'Hill Giant', 'Orc Bandit', 'Zombie', 'Kobold', 'Lizardfolk Scout', 'Dragonborn Knight']) assert.equal(name(n, []), 'boots', n);
  // Whole words only: no cat in a catapult, no ant in a giant, no horse in a horseman.
  assert.equal(name('Catapult Crew', ['humanoid']), 'boots');
  assert.equal(name('Headless Horseman', ['undead']), 'boots');
  // Daggerheart reads names only.
  assert.equal(creatureGait({ system: 'daggerheart', actor: { type: 'adversary', name: 'Dire Wolf' }, name: 'Dire Wolf' }), 'paws');
  assert.equal(creatureGait({ system: 'daggerheart', actor: { type: 'adversary', name: 'Bandit' }, name: 'Bandit' }), 'boots');
  // The token's own name or the actor's: either can say what it is.
  assert.equal(creatureGait({ system: 'pf2e', actor: { type: 'npc', name: 'Wolf', system: { traits: { value: [] } } }, name: 'Fang' }), 'paws');
  for (const n of ['Dire Wolf', 'Elk', 'Ghost']) assert.ok(GAITS.includes(name(n)));
});

test('creatureBulk: size category and heavy bodies for footstep weight', () => {
  assert.deepEqual(creatureBulk(pf2(['humanoid'], 'Guard')), { size: undefined, heavy: false }, 'no size data: token width decides');
  const sized = (size, traits = [], name = '') => ({ system: 'pf2e', actor: { type: 'npc', name, system: { traits: { value: traits, size: { value: size } } } }, name });
  assert.equal(creatureBulk(sized('huge', ['giant'], 'Hill Giant')).size, 'huge');
  assert.equal(creatureBulk(sized('huge', ['giant'], 'Hill Giant')).heavy, true, 'giants are heavy');
  assert.equal(creatureBulk(sized('lg', ['construct'], 'Stone Golem')).heavy, true, 'constructs are heavy');
  assert.equal(creatureBulk(sized('lg', ['dragon'], 'Young Red Dragon')).heavy, true, 'dragons are heavy');
  assert.equal(creatureBulk(sized('med', ['elemental', 'earth'], 'Earth Elemental')).heavy, true, 'earth elementals are heavy');
  assert.equal(creatureBulk(sized('med', ['elemental', 'air'], 'Air Elemental')).heavy, false, 'air is not');
  assert.equal(creatureBulk(sized('sm', ['fey'], 'Pixie')).heavy, false);
  assert.equal(creatureBulk(sized('med', ['humanoid'], 'Iron Statue')).heavy, true, 'statue/iron/stone names');
  const dndActor = { system: 'dnd5e', actor: { type: 'npc', name: 'Ogre', system: { traits: { size: 'lg' }, details: { type: { value: 'giant' } } } }, name: 'Ogre' };
  assert.deepEqual(creatureBulk(dndActor), { size: 'lg', heavy: true });
  assert.equal(creatureBulk({ system: 'daggerheart', actor: { type: 'adversary', name: 'Stone Golem', system: {} }, name: 'Stone Golem' }).heavy, true);
});
