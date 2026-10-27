import test from 'node:test';
import assert from 'node:assert/strict';
import { folderFamily, libraryBank, libraryVoices, mergeBanks } from '../../../scripts/engines/sound/voice-library.mjs';
import { voiceOf } from '../../../scripts/engines/sound/creature-voice.mjs';

test('a sound folder is filed by its name as a voice family; an unknown or layer-only folder is skipped', () => {
  const cases = {
    'Huge Dragon': 'dragon', 'Large Wyvern': 'dragon', 'Large Spider Queen': 'spider', 'ant warrior': 'insect', bug: 'insect', banshee: 'wraith',
    zombie: 'zombie', 'raging goblin': 'goblin', orc: 'brute', 'Huge Cyclops': 'giant', 'water giant': 'giant', 'hell hound': 'canine',
    'MBCK ANIMAL Dog Doberman Growl Shaking': 'canine', 'Medium Great Bear': 'bear', 'Medium Sabre Toothed Cat': 'feline', 'Small Wild Boar': 'swine',
    warthog: 'swine', 'MBCK ANIMAL Hampshire Pig Squeal Angry': 'swine', 'MBCK ANIMAL Horse Stallion Nicker': 'equine', 'MBCK ANIMAL Donkey Bray Breath': 'equine',
    'MBCK ANIMAL Crow Indoors Caw Distressed': 'bird', 'MBCK ANIMAL Raptorial Bird Vulture Close': 'raptor', 'Small Phoenix': 'bird', 'ancient bird': 'bird',
    'Medium Serpent': 'reptile', 'Medium Basilisk': 'reptile', 'lizard man': 'reptile', 'Huge T Rex': 'reptile', 'Small Velociraptor': 'reptile',
    'Large Mammoth': 'elephant', 'Large Great Rhino': 'hoofed', beast: 'beast', alien: 'aberration', 'giant worm': 'aberration',
    'CREAHmn CREATURE MALE Growl B00M CRHCK ST': 'monster', 'CREAHmn CREATURE FEMALE Roaring B00M CRHCK ST': 'fiend-woman',
  };
  Object.assign(cases, { 'Medium Hag FEMALE': 'fiend-woman', 'Medium Mummy FEMALE': 'zombie', 'Medium Wight MALE': 'zombie', 'Medium Ghast MALE': 'zombie',
    'Medium Vampire MALE': 'undead', 'Large Golem': 'golem', 'Large Ooze': 'ooze', 'Huge Construct': 'construct' });
  Object.assign(cases, { 'Khron Behemoth': 'beast', 'Khron Spectre': 'wraith', 'Khron Skeleton': 'skeleton', 'Khron Monster Vol 1': 'monster', 'Khron Troll': 'brute', 'Khron Aberration': 'aberration' });
  Object.assign(cases, { 'MBCK ANIMAL Frog Croak': 'amphibian', 'Large Toad': 'amphibian', 'Huge Shark': 'aquatic', 'Gargantuan Kraken': 'aquatic',
    'Large Octopus': 'aquatic', 'Huge Whale': 'aquatic', 'Medium Crab': 'aquatic', 'Insect Swarm': 'swarm', 'Rat Swarm': 'swarm' });
  Object.assign(cases, { 'Huge Eagle Scream': 'raptor', 'Large Griffon': 'raptor', 'Hawk Screech': 'raptor', 'Elephant Trumpet': 'elephant', 'Large Gorilla': 'ape',
    'Medium Yeti': 'ape', 'Bull Bellow': 'hoofed', 'Goat Bleat': 'hoofed', 'Red Deer Stag': 'hoofed', 'Large Minotaur MALE': 'hoofed', 'Hippopotamus': 'hoofed', 'Hippogriff': 'raptor' });
  for (const [name, family] of Object.entries(cases)) assert.equal(folderFamily(name), family, name);
  assert.equal(folderFamily('CREAHmn CREATURE FEMALE ADD Gargle B00M CRHCK ST'), null);
  assert.equal(folderFamily('Kitchen Utensils'), null);
});

test('each folder is one voice with its attack, hurt and death takes; a sample-rate twin is skipped', () => {
  const base = 'assets/Sounds';
  const bank = libraryBank(base, [
    { folder: 'Huge Dragon', use: 'attack', files: ['a1.ogg', 'a2.ogg'] },
    { folder: 'Huge Dragon', use: 'death', files: ['d1.ogg'] },
    { folder: 'Large Wyvern', use: 'hurt', files: ['h1.ogg'] },
    { folder: 'CREAHmn CREATURE MALE Growl B00M CRHCK ST', use: 'attack', files: ['g.ogg'] },
    { folder: 'CREAHmn CREATURE MALE Growl B00M CRHCK 100K', use: 'attack', files: ['g.ogg'] },
    { folder: 'MBCK ANIMAL Crow Indoors Caw Distressed', use: 'hurt', files: ['c.ogg'] },
    { folder: 'MBCK ANIMAL Crow Indoors Caw Distressed 100kHz', use: 'hurt', files: ['c.ogg'] },
    { folder: 'Kitchen Utensils', use: 'hurt', files: ['k.ogg'] },
    { folder: 'Huge Dragon', use: 'idle', files: ['i.ogg'] },
  ]);
  assert.deepEqual(Object.keys(bank).sort(), ['bird', 'dragon', 'monster']);
  assert.equal(bank.dragon.length, 2);
  const huge = bank.dragon.find((v) => v.attack);
  assert.deepEqual(huge, { attack: ['assets/Sounds/Huge Dragon/attack/a1.ogg', 'assets/Sounds/Huge Dragon/attack/a2.ogg'], death: ['assets/Sounds/Huge Dragon/death/d1.ogg'], folder: 'Huge Dragon' });
  assert.equal(bank.monster.length, 1);
  assert.equal(bank.bird.length, 1);
  assert.deepEqual(libraryBank('', []), {});
});

test('the GM\'s verdicts on their library: rejected voices are dropped, re-filed ones move, and once any is kept only kept ones play', () => {
  const entries = [
    { folder: 'Huge Dragon', use: 'attack', files: ['a.ogg'] },
    { folder: 'Large Wyvern', use: 'hurt', files: ['h.ogg'] },
    { folder: 'orc', use: 'attack', files: ['o.ogg'] },
    { folder: 'Kitchen Utensils', use: 'hurt', files: ['k.ogg'] },
  ];
  const rejected = libraryBank('b', entries, { reject: ['Large Wyvern'] });
  assert.deepEqual(Object.keys(rejected).sort(), ['brute', 'dragon']);
  assert.equal(rejected.dragon.length, 1);
  const refiled = libraryBank('b', entries, { family: { orc: 'giant', 'Kitchen Utensils': 'monster' } });
  assert.equal(refiled.giant?.length, 1);
  assert.equal(refiled.brute, undefined);
  assert.equal(refiled.monster?.length, 1, 'a folder the names did not file can be filed by hand');
  const kept = libraryBank('b', entries, { keep: ['Huge Dragon'] });
  assert.deepEqual(Object.keys(kept), ['dragon']);
  assert.equal(kept.dragon.length, 1);
  assert.deepEqual(libraryBank('b', entries, { keep: [] }), libraryBank('b', entries));
});

test('a library\'s size and length variants of one style are one voice, so its cries come from one performer', () => {
  const bank = libraryBank('b', [
    { folder: 'CREAHmn CREATURE FEMALE Animalistic B00M CRHCK 100K', use: 'attack', files: ['a.ogg'] },
    { folder: 'CREAHmn CREATURE FEMALE Animalistic B00M CRHCK 100K', use: 'death', files: ['d.ogg'] },
    { folder: 'CREAHmn CREATURE FEMALE Animalistic Medium B00M CRHCK 100K', use: 'hurt', files: ['h1.ogg'] },
    { folder: 'CREAHmn CREATURE FEMALE Animalistic Small B00M CRHCK 100K', use: 'hurt', files: ['h2.ogg'] },
    { folder: 'CREAHmn CREATURE FEMALE Croaky Large B00M CRHCK 100K', use: 'hurt', files: ['c.ogg'] },
  ]);
  assert.equal(bank['fiend-woman'].length, 2);
  const animal = bank['fiend-woman'].find((v) => v.attack);
  assert.deepEqual(animal.hurt.map((f) => f.split('/').pop()).sort(), ['h1.ogg', 'h2.ogg']);
  assert.equal(animal.death.length, 1);
  // A creature's own size in its name is the creature, not a variant: these stay apart.
  const own = libraryBank('b', [{ folder: 'Huge Dragon', use: 'hurt', files: ['x.ogg'] }, { folder: 'dragon', use: 'hurt', files: ['y.ogg'] }]);
  assert.equal(own.dragon.length, 2);
});

test('library folders become profiled voices: their group and its fallbacks, the size and gender their names give', () => {
  const voices = libraryVoices(libraryBank('b', [
    { folder: 'Huge Dragon', use: 'attack', files: ['h.ogg'] },
    { folder: 'Small Wild Boar', use: 'hurt', files: ['w.ogg'] },
    { folder: 'raging goblin', use: 'hurt', files: ['g.ogg'] },
    { folder: 'CREAHmn CREATURE FEMALE Roaring B00M CRHCK 100K', use: 'hurt', files: ['f.ogg'] },
  ], { prefer: ['raging goblin'] }));
  const by = Object.fromEntries(voices.map((v) => [v.label, v]));
  assert.deepEqual(by['Huge Dragon'].size, [1, 3]);
  assert.deepEqual(by['Huge Dragon'].suits, ['dragon']);
  assert.deepEqual(by['Small Wild Boar'].size, [-2, 0]);
  assert.deepEqual(by['raging goblin'].suits, ['goblin', 'small-folk']);
  assert.equal(by['raging goblin'].prefer, true);
  assert.equal(by['CREAHmn CREATURE FEMALE Roaring B00M CRHCK 100K'].gender, 'woman');
  assert.deepEqual(by['Huge Dragon'].attack, ['b/Huge Dragon/attack/h.ogg']);
});

test('library voices join the bundled ones; a library copy of a bundled voice comes once; a preferred one wins', () => {
  const bundled = [{ id: 'khron/dragon', label: 'Khron Dragon', suits: ['dragon'], hurt: ['bundled.ogg'] }];
  const cries = (folder, file) => ['attack', 'hurt', 'death'].map((use) => ({ folder, use, files: [file] }));
  const library = libraryBank('b', [
    ...cries('Khron Dragon', 'k.ogg'),
    ...cries('dragon', 'd.ogg'),
    ...cries('Medium Great Bear', 'b.ogg'),
    { folder: 'Huge Dragon', use: 'hurt', files: ['h.ogg'] },
  ], { prefer: ['dragon'] });
  const merged = mergeBanks(bundled, library);
  // Huge Dragon has only a hurt cry: an incomplete voice stays out.
  assert.deepEqual(merged.map((v) => v.label).sort(), ['Khron Dragon', 'Medium Great Bear', 'dragon']);
  assert.equal(merged.find((v) => v.label === 'Khron Dragon').id, 'khron/dragon');
  assert.equal(bundled.length, 1);
  assert.equal(mergeBanks(bundled, null), bundled);
  for (let n = 0; n < 10; n++) assert.equal(voiceOf(['dragon'], { voiceSeed: `d${n}`, bank: merged }).label, 'dragon');
  // A folder Animater ships (at either sample rate) is already a bundled voice: the scan adds nothing for it.
  assert.deepEqual(mergeBanks(bundled, library, ['Medium Great Bear 100K', 'dragon']).map((v) => v.label).sort(), ['Khron Dragon']);
});
