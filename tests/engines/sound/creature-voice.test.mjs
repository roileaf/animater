import test from 'node:test';
import assert from 'node:assert/strict';
import { voiceKinds, voiceKind, voiceEvent, voiceFile, voiceOf, voiceShape, voiceDeferred, ownsVoice, voiceBorrows, tokenVoice, attackSpeaker, creatureOf, scoreVoice, MIN_VOICE_SCORE, VOICE_FAMILIES, HURT_CHANCE, ATTACK_CHANCE, voiceGroups, VOICE_CATEGORIES, familyGroups } from '../../../scripts/engines/sound/creature-voice.mjs';

const dnd = (type, name = 'Creature', extra = {}) => ({ name, type: 'npc', system: { details: { type: { value: type }, ...extra.details }, traits: { size: extra.size ?? 'med' } } });
const pf = (traits, name = 'Creature', size = 'med') => ({ name, type: 'npc', system: { traits: { value: traits, size: { value: size } } } });

test('every D&D 5e creature type has its own bank, after the creature its name gives away', () => {
  assert.deepEqual(voiceKinds(dnd('beast', 'Wolf')), ['canine', 'beast']);
  assert.deepEqual(voiceKinds(dnd('beast', 'Brown Bear')), ['bear', 'beast']);
  assert.deepEqual(voiceKinds(dnd('monstrosity', 'Owlbear')), ['bear', 'monstrosity', 'monster', 'beast']);
  assert.deepEqual(voiceKinds(dnd('monstrosity', 'Bulette')), ['monstrosity', 'monster']);
  assert.deepEqual(voiceKinds(dnd('beast', 'Elk')), ['hoofed', 'beast']);
  assert.deepEqual(voiceKinds(dnd('dragon', 'Young Red Dragon')), ['dragon']);
  assert.deepEqual(voiceKinds(dnd('undead', 'Zombie')), ['zombie', 'undead']);
  assert.deepEqual(voiceKinds(dnd('undead', 'Vampire')), ['undead']);
  assert.deepEqual(voiceKinds(dnd('fiend', 'Barbed Devil')), ['fiend', 'monster']);
  assert.deepEqual(voiceKinds(dnd('aberration', 'Gibbering Mouther')), ['aberration', 'monster']);
  assert.deepEqual(voiceKinds(dnd('beast', 'Giant Spider')), ['spider', 'beast', 'insect']);
  assert.deepEqual(voiceKinds(dnd('beast', 'Blood Hawk')), ['raptor', 'bird', 'beast']);
  // An animal by name never falls back to a person's voice.
  assert.deepEqual(voiceKinds(dnd('celestial', 'Unicorn')), ['equine', 'celestial', 'beast']);
  assert.deepEqual(voiceKinds(dnd('elemental', 'Fire Elemental')), ['elemental']);
  assert.deepEqual(voiceKinds(dnd('plant', 'Twig Blight')), ['plant']);
  assert.deepEqual(voiceKinds(dnd('dragon', 'Kobold', { size: 'sm' })), ['goblin', 'small-folk', 'dragon']);
});

test('PF2e traits voice as their type', () => {
  assert.deepEqual(voiceKinds(pf(['animal'], 'Wolf')), ['canine', 'beast']);
  assert.deepEqual(voiceKinds(pf(['dragon', 'fire'], 'Young Red Dragon')), ['dragon']);
  assert.deepEqual(voiceKinds(pf(['undead', 'zombie', 'mindless'], 'Zombie Shambler')), ['zombie', 'undead']);
  assert.deepEqual(voiceKinds(pf(['fiend', 'demon'], 'Vrock')), ['fiend', 'monster']);
  assert.deepEqual(voiceKinds(pf(['humanoid', 'goblin'], 'Goblin Warrior', 'sm')), ['goblin', 'small-folk']);
  assert.deepEqual(voiceKinds(pf(['humanoid', 'orc'], 'Orc Brute')), ['brute', 'man']);
  assert.deepEqual(voiceKinds(pf(['aberration'], 'Chuul')), ['insect', 'aberration', 'monster']);
});

test('PF2e narrower creature traits pick their own bank, whatever the name', () => {
  assert.deepEqual(voiceKinds(pf(['undead', 'ghoul'], 'Ghast Lord')), ['zombie', 'undead']);
  assert.deepEqual(voiceKinds(pf(['undead', 'mummy'], 'Pharaoh')), ['zombie', 'undead']);
  assert.deepEqual(voiceKinds(pf(['undead', 'wight'], 'Barrow Lord')), ['zombie', 'undead']);
  assert.deepEqual(voiceKinds(pf(['undead', 'ghost', 'incorporeal', 'spirit'], 'Weeping Wisp')), ['wraith', 'undead']);
  assert.deepEqual(voiceKinds({ ...pf(['undead', 'vampire', 'humanoid'], 'Count Strahd'), id: 'v' }), ['man', 'undead']);
  assert.deepEqual(voiceKinds(pf(['construct', 'golem', 'mindless'], 'Flesh Thing')), ['golem', 'construct']);
  assert.deepEqual(voiceKinds(pf(['elemental', 'genie', 'fire'], 'Efreeti', 'lg')).slice(-1), ['elemental']);
  assert.ok(['man', 'woman'].includes(voiceKinds(pf(['elemental', 'genie', 'fire'], 'Efreeti', 'lg'))[0]));
  assert.deepEqual(voiceKinds(pf(['hag', 'humanoid'], 'Green Hag')), ['fiend-woman', 'woman']);
  assert.deepEqual(voiceKinds(pf(['fey', 'nymph'], 'Naiad')), ['fey', 'woman']);
  assert.deepEqual(voiceKinds(pf(['giant', 'titan'], 'Hecatoncheires', 'grg')), ['giant', 'man']);
  assert.deepEqual(voiceKinds(pf(['giant', 'troll'], 'Forest Troll', 'lg')), ['brute', 'man']);
  assert.deepEqual(voiceKinds(pf(['animal', 'dinosaur'], 'Tyrannosaurus', 'grg')), ['reptile', 'beast']);
  assert.deepEqual(voiceKinds(pf(['kaiju'], 'Mogaru', 'grg')), ['kaiju', 'monster']);
  assert.deepEqual(voiceKinds(pf(['monitor', 'psychopomp'], 'Morrigna')), ['monitor']);
  assert.deepEqual(voiceKinds(pf(['monitor', 'protean'], 'Naunet')), ['monitor']);
  // A PF2e beast is a magical beast; a D&D 5e beast is an animal.
  assert.deepEqual(voiceKinds(pf(['beast'], 'Chimera', 'lg')), ['monstrosity', 'monster', 'beast']);
  assert.deepEqual(voiceKinds(dnd('beast', 'Elk')), ['hoofed', 'beast']);
  assert.deepEqual(voiceKinds(pf(['beast', 'humanoid', 'werecreature'], 'Werewolf')), ['canine', 'monstrosity', 'monster', 'beast']);
  assert.deepEqual(voiceKinds(pf(['illusion'], 'Phantasmal Wolf')), []);
  assert.deepEqual(voiceKinds(pf(['formian', 'lawful'], 'Formian Worker')), ['insect']);
  assert.deepEqual(voiceKinds(pf(['kami'], 'Kodama')), ['fey']);
  assert.deepEqual(voiceKinds(pf(['dream', 'mythic'], 'Dream Eater')), ['monster']);
  assert.deepEqual(voiceKinds(dnd('custom', 'Conjured Fire Elemental')), ['elemental']);
});

test('female monsters cry in a female monster\'s voice, then their own kind', () => {
  assert.deepEqual(voiceKinds(pf(['hag', 'humanoid'], 'Green Hag')), ['fiend-woman', 'woman']);
  assert.deepEqual(voiceKinds(dnd('fey', 'Green Hag')), ['fiend-woman', 'woman', 'fey']);
  assert.deepEqual(voiceKinds(dnd('monstrosity', 'Harpy')), ['fiend-woman', 'bird', 'monstrosity', 'monster', 'beast'].filter((k) => voiceKinds(dnd('monstrosity', 'Harpy')).includes(k)));
  assert.equal(voiceKind(dnd('monstrosity', 'Harpy')), 'fiend-woman');
  assert.ok(voiceKinds(dnd('monstrosity', 'Harpy')).includes('bird'));
  assert.deepEqual(voiceKinds(dnd('monstrosity', 'Medusa')), ['fiend-woman', 'monstrosity', 'monster']);
  assert.deepEqual(voiceKinds(dnd('undead', 'Banshee')), ['fiend-woman', 'wraith', 'undead']);
  assert.deepEqual(voiceKinds(pf(['undead', 'ghost', 'incorporeal', 'spirit'], 'Weeping Lady')), ['fiend-woman', 'wraith', 'undead']);
  assert.deepEqual(voiceKinds({ ...pf(['undead', 'zombie'], 'Plague Zombie'), system: { details: { gender: { value: 'female' } }, traits: { value: ['undead', 'zombie'], size: { value: 'med' } } } }), ['fiend-woman', 'zombie', 'undead']);
  assert.deepEqual(voiceKinds({ ...pf(['undead', 'vampire', 'humanoid'], 'Vampire Countess'), id: 'v' }), ['fiend-woman', 'woman', 'undead']);
  assert.deepEqual(voiceKinds(dnd('fiend', 'Succubus')), ['fiend-woman', 'fiend', 'monster']);
  // A gorgon is a bronze bull; a queen of wasps keeps an insect's voice.
  assert.notEqual(voiceKind(dnd('monstrosity', 'Gorgon')), 'fiend-woman');
  assert.equal(voiceKind(dnd('monstrosity', 'Giant Wasp Queen')), 'insect');
  assert.notEqual(voiceKind(pf(['animal', 'undead'], 'Empress Necral Worm')), 'fiend-woman');
  assert.deepEqual(voiceKinds(pf(['mindless', 'skeleton', 'undead'], 'Harpy Skeleton')), ['skeleton', 'undead']);
  // A male monster, a woman and the people stay as they were.
  assert.deepEqual(voiceKinds(dnd('undead', 'Zombie')), ['zombie', 'undead']);
  assert.equal(voiceKind(dnd('humanoid', 'Cult Priestess')), 'woman');
  assert.deepEqual(voiceKinds(dnd('giant', 'Frost Giantess', { size: 'huge' })), ['giant', 'woman']);
  assert.deepEqual(voiceKinds(dnd('fey', 'Dryad', { details: { gender: 'female' } })), ['fey', 'woman']);
});

test('ghosts, skeletons, oozes, golems and treants cry in their own bank, else their type', () => {
  assert.deepEqual(voiceKinds(dnd('undead', 'Ghost')), ['wraith', 'undead']);
  assert.deepEqual(voiceKinds(pf(['undead', 'incorporeal', 'spirit'], 'Ghost Commoner')), ['wraith', 'undead']);
  assert.deepEqual(voiceKinds(dnd('undead', 'Skeleton')), ['skeleton', 'undead']);
  assert.deepEqual(voiceKinds(dnd('ooze', 'Black Pudding')), ['ooze']);
  assert.deepEqual(voiceKinds(dnd('construct', 'Stone Golem')), ['golem', 'construct']);
  assert.deepEqual(voiceKinds(dnd('construct', 'Shield Guardian')), ['construct']);
  assert.deepEqual(voiceKinds(dnd('plant', 'Treant')), ['treant', 'plant']);
  // A plant or construct named like an animal does not take that animal's voice.
  assert.deepEqual(voiceKinds(dnd('construct', 'Clockwork Bear')), ['construct']);
});

test('animated objects, fish and loot have no voice', () => {
  for (const actor of [dnd('construct', 'Animated Armor'), pf(['construct', 'mindless'], 'Animated Broom'), { name: 'Chest', type: 'loot', system: {} },
    pf(['animal', 'aquatic', 'swarm'], 'Quipper Swarm'), dnd('beast', 'Swarm of Quippers', { details: { type: { value: 'beast', swarm: 'tiny' } } }), dnd('beast', 'Giant Pike'), pf(['animal', 'aquatic'], 'Electric Eel')])
    assert.deepEqual(voiceKinds(actor), [], actor.name);
  assert.equal(voiceKind(dnd('construct', 'Animated Armor')), null);
});

test('a swarm cries as a swarm, else as the small animal it is made of, never as one big beast', () => {
  assert.deepEqual(voiceKinds(pf(['swarm', 'animal'], 'Rat Swarm')), ['swarm', 'rodent']);
  assert.deepEqual(voiceKinds(dnd('beast', 'Swarm of Rats', { details: { type: { value: 'beast', swarm: 'tiny' } } })), ['swarm', 'rodent']);
  assert.deepEqual(voiceKinds(dnd('beast', 'Swarm of Bats', { details: { type: { value: 'beast', swarm: 'tiny' } } })), ['swarm', 'bat']);
  assert.deepEqual(voiceKinds(pf(['swarm', 'animal'], 'Army Ant Swarm')), ['swarm', 'insect']);
  assert.deepEqual(voiceKinds(pf(['swarm', 'animal'], 'Wasp Swarm')), ['swarm', 'insect']);
  assert.deepEqual(voiceKinds(pf(['swarm', 'undead'], 'Bone Swarm')), ['swarm']);
});

test('sea creatures and frogs have their own banks, falling back to a beast', () => {
  assert.deepEqual(voiceKinds(dnd('beast', 'Hunter Shark')), ['aquatic', 'beast']);
  assert.deepEqual(voiceKinds(dnd('beast', 'Giant Octopus')), ['aquatic', 'beast']);
  assert.deepEqual(voiceKinds(dnd('beast', 'Giant Crab')), ['aquatic', 'beast']);
  assert.deepEqual(voiceKinds(dnd('beast', 'Killer Whale')), ['aquatic', 'beast']);
  assert.deepEqual(voiceKinds(dnd('monstrosity', 'Kraken')), ['aquatic', 'monstrosity', 'monster', 'beast']);
  // PF2e's aquatic trait on an animal, whatever its name.
  assert.deepEqual(voiceKinds(pf(['animal', 'aquatic'], 'Reefclaw')), ['aquatic', 'beast']);
  // Merfolk stay people.
  assert.ok(['man', 'woman'].includes(voiceKind(pf(['humanoid', 'aquatic'], 'Merfolk Wavecaller'))));
  assert.deepEqual(voiceKinds(dnd('beast', 'Giant Frog')), ['amphibian', 'beast']);
  assert.deepEqual(voiceKinds(dnd('beast', 'Giant Toad', { size: 'lg' })), ['amphibian', 'beast']);
  assert.deepEqual(voiceKinds(pf(['animal', 'amphibious'], 'Giant Frog')), ['amphibian', 'beast']);
  assert.deepEqual(voiceKinds({ ...dnd('humanoid', 'Bullywug'), id: 'b' }).slice(0, 1), ['amphibian']);
  assert.deepEqual(voiceKinds({ ...pf(['humanoid', 'boggard'], 'Boggard Warrior'), id: 'b' }).slice(0, 1), ['amphibian']);
});

test('hoofed beasts, elephants, apes and birds of prey have their own banks, falling back to a beast or a bird', () => {
  for (const name of ['Giant Goat', 'Elk', 'Rhinoceros', 'Hippopotamus', 'Aurochs', 'Camel', 'Giant Elk']) assert.deepEqual(voiceKinds(dnd('beast', name)), ['hoofed', 'beast'], name);
  assert.deepEqual(voiceKinds(dnd('monstrosity', 'Minotaur')), ['hoofed', 'monstrosity', 'monster', 'beast']);
  assert.deepEqual(voiceKinds(dnd('beast', 'Mammoth')), ['elephant', 'beast']);
  assert.deepEqual(voiceKinds(pf(['animal'], 'Elephant', 'huge')), ['elephant', 'beast']);
  assert.deepEqual(voiceKinds(dnd('beast', 'Giant Ape')), ['ape', 'beast']);
  assert.deepEqual(voiceKinds(dnd('monstrosity', 'Yeti')), ['ape', 'monstrosity', 'monster', 'beast']);
  assert.deepEqual(voiceKinds(dnd('beast', 'Giant Eagle')), ['raptor', 'bird', 'beast']);
  assert.deepEqual(voiceKinds(dnd('monstrosity', 'Griffon')), ['raptor', 'bird', 'monstrosity', 'monster']);
  assert.deepEqual(voiceKinds(pf(['beast'], 'Hippogriff', 'large')), ['raptor', 'bird', 'monstrosity', 'monster', 'beast']);
  assert.deepEqual(voiceKinds(pf(['animal'], 'Axe Beak')), ['raptor', 'bird', 'beast']);
  // Small birds stay birds.
  assert.deepEqual(voiceKinds(dnd('beast', 'Owl')), ['bird', 'beast']);
  assert.deepEqual(voiceKinds(dnd('beast', 'Raven')), ['bird', 'beast']);
  // A name that only starts like one is not one.
  assert.notEqual(voiceKind(pf(['humanoid', 'human'], 'Ramon')), 'hoofed');
});

test("lizardfolk and gnolls are people with an animal's throat: theirs first, then a man or a woman", () => {
  assert.deepEqual(voiceKinds(dnd('humanoid', 'Lizardfolk')), ['reptile', 'man']);
  assert.deepEqual(voiceKinds(dnd('humanoid', 'Lizardfolk Queen')), ['reptile', 'woman']);
  assert.deepEqual(voiceKinds(pf(['humanoid', 'lizardfolk'], 'Iruxi Ossature')), ['reptile', 'man']);
  assert.deepEqual(voiceKinds(dnd('humanoid', 'Gnoll')), ['canine', 'man']);
  assert.deepEqual(voiceKinds(dnd('monstrosity', 'Gnoll Pack Lord')), ['canine', 'man', 'monstrosity', 'monster']);
  // Hyenas stay animals; an orc woman still cries as a woman, not a brute.
  assert.deepEqual(voiceKinds(dnd('beast', 'Hyena')), ['canine', 'beast']);
  assert.deepEqual(voiceKinds(dnd('humanoid', 'Orc Matron')), ['woman']);
});


test('people voice as a man or a woman, by their gender, their name, else the same seeded pick everywhere', () => {
  assert.equal(voiceKind(dnd('humanoid', 'Bandit Captain', { details: { gender: 'Female' } })), 'woman');
  assert.equal(voiceKind({ name: 'Valeros', type: 'character', system: { details: { gender: { value: 'he/him' } }, traits: { value: ['human', 'humanoid'] } } }), 'man');
  assert.equal(voiceKind(dnd('humanoid', 'Cult Priestess')), 'woman');
  assert.equal(voiceKind(dnd('humanoid', 'Thug King')), 'man');
  assert.equal(voiceKind(dnd('humanoid', 'Orc War Chief', { details: { gender: 'female' } })), 'woman');
  const guard = { ...dnd('humanoid', 'Guard'), id: 'abc' };
  assert.ok(['man', 'woman'].includes(voiceKind(guard)));
  assert.equal(voiceKind(guard), voiceKind({ ...guard }));
});

test('small folk, fey, giants, celestials', () => {
  assert.deepEqual(voiceKinds(dnd('humanoid', 'Kobold', { size: 'sm' })), ['goblin', 'small-folk']);
  assert.deepEqual(voiceKinds(dnd('fey', 'Pixie', { size: 'tiny' })), ['fey', 'small-folk']);
  assert.deepEqual(voiceKinds(dnd('fey', 'Dryad', { details: { gender: 'female' } })), ['fey', 'woman']);
  assert.deepEqual(voiceKinds(dnd('giant', 'Hill Giant', { size: 'huge' })), ['giant', 'man']);
  assert.deepEqual(voiceKinds(dnd('giant', 'Frost Giantess', { size: 'huge' })), ['giant', 'woman']);
  assert.deepEqual(voiceKinds(dnd('celestial', 'Deva', { details: { gender: 'female' } })), ['celestial', 'woman']);
});

test('a fall always cries out; a hurt now and then, the same on every screen', () => {
  assert.equal(voiceEvent({ dropped: true, seed: 'x' }), 'death');
  let hurt = 0;
  for (let i = 0; i < 400; i++) if (voiceEvent({ dropped: false, seed: `a:${i}` }) === 'hurt') hurt++;
  assert.ok(Math.abs(hurt / 400 - HURT_CHANCE) < 0.08, String(hurt));
  assert.equal(voiceEvent({ dropped: false, seed: 'same' }), voiceEvent({ dropped: false, seed: 'same' }));
});

// A small profiled bank: each voice says which creatures it suits.
const V = (id, profile, takes = { attack: [`${id}-a.ogg`], hurt: [`${id}-h.ogg`], death: [`${id}-d.ogg`] }) => ({ id, ...profile, ...takes });
const BANK = [
  V('wolf', { suits: ['canine'] }),
  V('bear', { suits: ['bear'] }),
  V('behemoth', { suits: ['kaiju', 'monstrosity', 'dragon', 'beast'], keywords: ['tarrasque', 'behemoth'], size: [2, 3] }),
  V('monster', { suits: ['monster', 'monstrosity'] }),
  V('dragon', { suits: ['dragon'], keywords: ['wyvern'] }),
  V('man', { suits: ['man'], gender: 'man' }),
  V('woman', { suits: ['woman'], gender: 'woman' }),
  V('zombie', { suits: ['zombie', 'undead'] }),
];
const pick = (actor, bank = BANK) => voiceOf(creatureOf(actor), { voiceSeed: actor.name, bank })?.id ?? null;

test('a creature gets the voice whose profile fits it best: its own kind first, then broader ones', () => {
  assert.equal(pick(dnd('beast', 'Wolf')), 'wolf');
  assert.equal(pick(dnd('beast', 'Brown Bear', { size: 'lg' })), 'bear');
  // An owlbear is a bear before it is a monstrosity.
  assert.equal(pick(dnd('monstrosity', 'Owlbear', { size: 'lg' })), 'bear');
  assert.equal(pick(dnd('monstrosity', 'Bulette', { size: 'lg' })), 'monster');
  assert.equal(pick(dnd('dragon', 'Young Red Dragon', { size: 'lg' })), 'dragon');
  // A vampire, a lich: undead the zombie voice suits only broadly, but well enough.
  assert.equal(pick(dnd('undead', 'Lich')), 'zombie');
});

test('size and keywords: the behemoth is only for the truly huge, and a name can claim a voice', () => {
  // An elk is a beast, but no behemoth: with no animal voice it stays silent rather than roar like a kaiju.
  assert.equal(pick(dnd('beast', 'Elk', { size: 'lg' })), null);
  assert.equal(pick(dnd('beast', 'Giant Elk', { size: 'huge' })), 'behemoth');
  assert.equal(pick(dnd('monstrosity', 'Tarrasque', { size: 'grg' })), 'behemoth');
  assert.equal(pick(dnd('dragon', 'Wyvern', { size: 'lg' })), 'dragon');
  assert.ok(scoreVoice(BANK[2], creatureOf(dnd('beast', 'Elk', { size: 'lg' }))) < MIN_VOICE_SCORE);
});

test('a voice of the other gender never fits; a preferred voice wins its creatures', () => {
  assert.equal(pick(dnd('humanoid', 'Bandit Captain', { details: { gender: 'female' } })), 'woman');
  assert.equal(pick(dnd('humanoid', 'Thug King')), 'man');
  assert.equal(pick(dnd('humanoid', 'Cult Priestess'), BANK.filter((v) => v.id !== 'woman')), null);
  const preferred = [...BANK, V('khron-wolf', { suits: ['canine'], prefer: true })];
  for (let n = 0; n < 10; n++) assert.equal(voiceOf(creatureOf(dnd('beast', 'Wolf')), { voiceSeed: `w${n}`, bank: preferred }).id, 'khron-wolf');
});

test('a creature keeps one voice for every cry; equally good voices are shared out among creatures', () => {
  const bank = [V('A', { suits: ['dragon'] }), V('B', { suits: ['dragon'] })];
  const seen = new Set();
  for (let n = 0; n < 40; n++) {
    const cries = ['attack', 'hurt', 'death'].map((e) => voiceFile(['dragon'], e, { seed: `s${n}`, voiceSeed: `dragon-${n}`, bank }));
    assert.equal(new Set(cries.map((f) => f[0])).size, 1, cries.join(' '));
    seen.add(cries[0][0]);
  }
  assert.equal(seen.size, 2);
});

test('a missing cry falls back within the voice, never to another throat; a fuller voice is preferred', () => {
  const bank = [V('A', { suits: ['dragon'] }), V('B', { suits: ['dragon'] }, { attack: ['B-a.ogg'], hurt: ['B-h.ogg'] }), V('C', { suits: ['dragon'] }, { hurt: ['C-h.ogg'] })];
  for (let n = 0; n < 20; n++) assert.equal(voiceOf(['dragon'], { voiceSeed: `d${n}`, bank }).id, 'A');
  const partial = bank.slice(1);
  for (let n = 0; n < 20; n++) {
    const cries = ['attack', 'hurt', 'death'].map((e) => voiceFile(['dragon'], e, { seed: `s${n}`, voiceSeed: `d${n}`, bank: partial }));
    assert.deepEqual(cries, ['B-a.ogg', 'B-h.ogg', 'B-h.ogg']);
  }
  assert.equal(voiceFile(['dragon'], 'attack', { seed: 'x', bank: [bank[2]] }), null);
  assert.equal(voiceFile(['zombie'], 'hurt', { seed: 'x', bank: [V('z', { suits: ['zombie'] }, { death: ['z.ogg'] })] }), 'z.ogg');
  assert.equal(voiceFile([], 'hurt', { seed: 's', bank }), null);
});

test('the same take never plays twice in a row', () => {
  const bank = [V('m', { suits: ['man'] }, { hurt: ['a.ogg', 'b.ogg', 'c.ogg'] })];
  let last = null;
  for (let i = 0; i < 60; i++) {
    const f = voiceFile(['man'], 'hurt', { seed: `h${i}`, avoid: last, bank });
    assert.notEqual(f, last);
    last = f;
  }
  assert.equal(voiceFile(['man'], 'hurt', { seed: 'x', avoid: 'a.ogg', bank: [V('m', { suits: ['man'] }, { hurt: ['a.ogg'] })] }), 'a.ogg');
});

test('each token can choose its own voice: silent, a family with its fallbacks, or one voice by name', () => {
  const wolf = dnd('beast', 'Wolf');
  assert.deepEqual(tokenVoice(wolf, {}).creature.kinds, ['canine', 'beast']);
  assert.deepEqual(tokenVoice(wolf, { voice: 'auto' }).creature.kinds, ['canine', 'beast']);
  assert.equal(tokenVoice(wolf, { voice: 'none' }).creature, null);
  assert.deepEqual(tokenVoice(dnd('construct', 'Animated Armor'), { voice: 'man' }).creature.kinds, ['man']);
  assert.deepEqual(tokenVoice(wolf, { voice: 'fiend-woman' }).creature.kinds, ['fiend-woman', 'woman']);
  assert.deepEqual(tokenVoice(wolf, { voice: 'treant' }).creature.kinds, ['treant', 'plant']);
  assert.deepEqual(tokenVoice(wolf, { voice: 'nonsense' }).creature.kinds, ['canine', 'beast']);
  assert.equal(tokenVoice(wolf, { speaker: 'khron/dragon' }).voiceId, 'khron/dragon');
  // The old "Voice 2" choice no longer names a voice.
  assert.equal(tokenVoice(wolf, { speaker: '2' }).voiceId, null);
  assert.equal(voiceOf(creatureOf(wolf), { voiceId: 'dragon', bank: BANK }).id, 'dragon');
  for (const [key, { parent }] of Object.entries(VOICE_FAMILIES)) assert.ok(!parent || VOICE_FAMILIES[parent], key);
});

test('bigger creatures sound lower; each creature keeps its own pitch', () => {
  const tiny = voiceShape(-2, 'id'), med = voiceShape(0, 'id'), garg = voiceShape(3, 'id');
  assert.ok(tiny.rate > med.rate && med.rate > garg.rate);
  assert.ok(garg.rate >= 0.65 && tiny.rate <= 1.35);
  assert.deepEqual(voiceShape(0, 'id'), med);
  assert.ok(garg.volume >= med.volume);
});

test('every cry varies a little in pitch, level and timing, the same on every screen', () => {
  const cries = Array.from({ length: 40 }, (_, i) => voiceShape(0, 'wolf', { hitSeed: `hit${i}` }));
  const rates = new Set(cries.map((c) => c.rate)), vols = new Set(cries.map((c) => c.volume)), delays = new Set(cries.map((c) => c.delay));
  assert.ok(rates.size > 20 && vols.size > 20 && delays.size > 20);
  const base = voiceShape(0, 'wolf').rate;
  for (const c of cries) {
    assert.ok(Math.abs(c.rate / base - 1) <= 0.061, String(c.rate));
    assert.ok(c.volume > 0.6 * 0.79 && c.volume <= 0.6 * 1.26, String(c.volume));
    assert.ok(c.delay >= 80 && c.delay <= 200);
  }
  assert.deepEqual(voiceShape(0, 'wolf', { hitSeed: 'h1' }), voiceShape(0, 'wolf', { hitSeed: 'h1' }));
  const fall = voiceShape(0, 'wolf', { hitSeed: 'h1', event: 'death' });
  assert.ok(fall.delay >= 200 && fall.delay <= 380);
});

test('an attacker voices its effort about half the time, the same on every screen; never a hurt cry in its place', () => {
  let n = 0;
  for (let i = 0; i < 400; i++) if (voiceEvent({ attack: true, seed: `m${i}` }) === 'attack') n++;
  assert.ok(Math.abs(n / 400 - ATTACK_CHANCE) < 0.08, String(n));
  assert.equal(voiceEvent({ attack: true, seed: 'q' }), voiceEvent({ attack: true, seed: 'q' }));
  const bank = [{ id: 'm', suits: ['man'], hurt: ['h.ogg'], attack: ['a.ogg'] }, { id: 'b', suits: ['beast'], hurt: ['g.ogg'] }];
  assert.equal(voiceFile(['man'], 'attack', { seed: 's', bank }), 'a.ogg');
  assert.equal(voiceFile(['beast'], 'attack', { seed: 's', bank }), null);
  assert.equal(voiceFile(['canine', 'man'], 'attack', { seed: 's', bank }), 'a.ogg');
  const swing = voiceShape(0, 'x', { hitSeed: 'y', event: 'attack' });
  assert.ok(swing.delay >= 0 && swing.delay <= 90);
});

test('attack rolls are told apart from other messages in every system', () => {
  const speaker = { token: 't1', scene: 's1', actor: 'a1' };
  assert.deepEqual(attackSpeaker({ speaker, flags: { pf2e: { context: { type: 'attack-roll' } } } }, 'pf2e'), { tokenId: 't1', sceneId: 's1', actorId: 'a1' });
  assert.ok(attackSpeaker({ speaker, flags: { pf2e: { context: { type: 'spell-attack-roll' } } } }, 'pf2e'));
  assert.ok(attackSpeaker({ speaker, flags: { sf2e: { context: { type: 'attack-roll' } } } }, 'sf2e'));
  assert.equal(attackSpeaker({ speaker, flags: { pf2e: { context: { type: 'damage-roll' } } } }, 'pf2e'), null);
  assert.equal(attackSpeaker({ speaker, flags: { pf2e: { context: { type: 'saving-throw' } } } }, 'pf2e'), null);
  assert.ok(attackSpeaker({ speaker, flags: { dnd5e: { roll: { type: 'attack' } } } }, 'dnd5e'));
  assert.equal(attackSpeaker({ speaker, flags: { dnd5e: { roll: { type: 'damage' } } } }, 'dnd5e'), null);
  assert.equal(attackSpeaker({ speaker: {}, flags: { dnd5e: { roll: { type: 'attack' } } } }, 'dnd5e'), null);
  assert.equal(attackSpeaker(null, 'dnd5e'), null);
});

test('on PF2e, PF2e Creature Sounds voices creatures when it is active and on', () => {
  assert.equal(voiceDeferred({ systemId: 'pf2e', moduleActive: true, moduleEnabled: true }), true);
  assert.equal(voiceDeferred({ systemId: 'pf2e', moduleActive: true, moduleEnabled: false }), false);
  assert.equal(voiceDeferred({ systemId: 'pf2e', moduleActive: false, moduleEnabled: true }), false);
  assert.equal(voiceDeferred({ systemId: 'dnd5e', moduleActive: true, moduleEnabled: true }), false);
});

test('a token given its own Animater voice is voiced by Animater, even where PF2e Creature Sounds voices the rest', () => {
  const on = { systemId: 'pf2e', moduleActive: true, moduleEnabled: true };
  assert.equal(voiceDeferred({ ...on, voice: '', speaker: '' }), true);
  for (const own of [{ voice: 'auto' }, { voice: 'dragon' }, { voice: 'none' }, { speaker: 'khron/dragon' }]) {
    assert.equal(ownsVoice(own), true, JSON.stringify(own));
    assert.equal(voiceDeferred({ ...on, ...own }), false, JSON.stringify(own));
  }
  // The old numbered speaker choice names no voice.
  assert.equal(ownsVoice({ voice: '', speaker: '3' }), false);
  assert.equal(ownsVoice({}), false);
  // 'auto' is Animater's own pick for its creature.
  const dragon = { name: 'Young Red Dragon', type: 'npc', system: { traits: { value: ['dragon'], size: { value: 'lg' } } } };
  assert.deepEqual(tokenVoice(dragon, { voice: 'auto' }).creature.kinds, ['dragon']);
});

test("the voice picker splits voices into female, male and other creatures, each by name", () => {
  const groups = voiceGroups([
    { id: "b", label: "Boom CREATURE MALE Deep", gender: "man", hurt: ["x"] },
    { id: "a", label: "Boom CREATURE FEMALE Eerie", gender: "woman", hurt: ["x"] },
    { id: "k", label: "Khron Troll", attack: ["x"] },
    { id: "c", label: "Boom CREATURE MALE Aggressive", gender: "man", death: ["x"] },
    { id: "e", label: "Empty", gender: "woman" },
  ]);
  assert.deepEqual(groups, [
    { label: "Female", voices: [["a", "Boom CREATURE FEMALE Eerie"]] },
    { label: "Male", voices: [["c", "Boom CREATURE MALE Aggressive"], ["b", "Boom CREATURE MALE Deep"]] },
    { label: "Creature", voices: [["k", "Khron Troll"]] },
  ]);
  assert.deepEqual(voiceGroups([{ id: "k", label: "K", hurt: ["x"] }]).map((g) => g.label), ["Creature"]);
});

test("a cry standing in for a missing one is played apart: a hurt for a death lower, a death for a hurt higher", () => {
  assert.equal(voiceBorrows({ hurt: ["h"] }, "death"), true);
  assert.equal(voiceBorrows({ death: ["d"] }, "hurt"), true);
  assert.equal(voiceBorrows({ hurt: ["h"], death: ["d"] }, "death"), false);
  assert.equal(voiceBorrows({ attack: ["a"] }, "attack"), false);
  const own = voiceShape(0, "x", { hitSeed: "h", event: "death" }), lent = voiceShape(0, "x", { hitSeed: "h", event: "death", borrowed: true });
  assert.ok(lent.rate < own.rate * 0.95);
  const hurt = voiceShape(0, "x", { hitSeed: "h", event: "hurt" }), lentHurt = voiceShape(0, "x", { hitSeed: "h", event: "hurt", borrowed: true });
  assert.ok(lentHurt.rate > hurt.rate * 1.05);
});

test("a voice marked auto: false is never picked on its own, only when a token names it", () => {
  const bank = [
    { id: "kept", label: "Kept", suits: ["dragon"], hurt: ["k"] },
    { id: "extra", label: "Extra", suits: ["dragon"], keywords: ["red"], hurt: ["x"], auto: false },
  ];
  const dragon = { kinds: ["dragon"], name: "Young Red Dragon", size: 1 };
  for (const seed of ["a", "b", "c", "d"]) assert.equal(voiceOf(dragon, { voiceSeed: seed, bank }).id, "kept");
  assert.equal(voiceOf(dragon, { voiceId: "extra", bank }).id, "extra");
  // A pick no longer in the bank (renamed, removed) falls back to the best fit, not to silence.
  assert.equal(voiceOf(dragon, { voiceId: "library/gone", bank }).id, "kept");
  assert.equal(voiceOf(dragon, { bank: [bank[1]] }), null);
  // The picker still offers it.
  assert.deepEqual(voiceGroups(bank, { kinds: ["dragon"] })[0].voices.map(([id]) => id), ["extra", "kept"]);
});

test("the voice picker offers only the voices of the chosen kind, else of the nearest broader kind that has any", () => {
  const bank = [
    { id: "imp", label: "Imp", suits: ["fiend", "monster"], hurt: ["x"] },
    { id: "ogre", label: "Ogre", suits: ["monster"], hurt: ["x"] },
    { id: "wolf", label: "Wolf", suits: ["canine", "beast"], hurt: ["x"] },
    { id: "elk", label: "Elk", suits: ["beast"], hurt: ["x"] },
  ];
  const ids = (kinds, chosen) => voiceGroups(bank, { kinds, chosen }).flatMap((g) => g.voices.map(([id]) => id));
  assert.deepEqual(ids(["fiend", "monster"]), ["imp"]);
  // A group's own voices only: an imp can stand in for a monster, but it is a fiend.
  assert.deepEqual(ids(["monster"]), ["ogre"]);
  // A horse has no voice of its own: the beasts it falls back to.
  assert.deepEqual(ids(["equine", "beast"]), ["elk"]);
  // An orc (female or not) can stand in for a man, but Man lists men.
  const people = [
    { id: "man", label: "Man", suits: ["man"], gender: "man", hurt: ["x"] },
    { id: "orc-f", label: "Orc", suits: ["brute", "man"], gender: "woman", hurt: ["x"] },
  ];
  assert.deepEqual(voiceGroups(people, { kinds: ["man"] }).map((g) => g.label), ["Male"]);
  // Nothing fits (a silent token, a kind with no voices at all): no voices to pick.
  assert.deepEqual(ids([]), []);
  assert.deepEqual(ids(["elemental"]), []);
  // The voice already chosen stays listed, whatever the kind.
  assert.deepEqual(ids(["fiend", "monster"], "wolf"), ["imp", "wolf"]);
  // No kind given: every voice.
  assert.equal(ids(undefined).length, 4);
});

test("every voice family sits in exactly one picker category", () => {
  const placed = VOICE_CATEGORIES.flatMap(([, keys]) => keys);
  assert.deepEqual([...placed].sort(), Object.keys(VOICE_FAMILIES).sort());
  assert.equal(new Set(placed).size, placed.length);
  const groups = familyGroups();
  assert.equal(groups[0].label, "People");
  assert.deepEqual(groups.find((g) => /oozes/.test(g.label)).families.map(([k]) => k), ["construct", "golem", "ooze", "plant", "treant"]);
  assert.equal(groups.find((g) => /Undead/.test(g.label)).families.find(([k]) => k === "zombie")[1], "Zombie or ghoul");
  // Given a bank, a family with nothing to play is left out (unless it is the token's choice), and so is an empty category.
  const full = { attack: ["a"], hurt: ["h"], death: ["d"] };
  const bank = [{ id: "golem", suits: ["golem", "construct"], ...full }, { id: "elk", suits: ["beast"], ...full }];
  const offered = (chosen) => familyGroups({ bank, chosen }).flatMap((g) => g.families.map(([k]) => k));
  assert.ok(offered().includes("golem") && offered().includes("bat"), "its own voice, or a broader family's (a bat: beasts)");
  assert.ok(!offered().includes("elemental") && !offered().includes("construct"), "an elemental has none; a golem's voice is not a construct's own");
  assert.ok(!familyGroups({ bank }).some((g) => /Elementals/.test(g.label)));
  assert.ok(offered("elemental").includes("elemental"));
});

test("every bundled voice has its own attack, hurt and death cries", async () => {
  const { CREATURE_VOICES } = await import("../../../data/creature-voices.mjs");
  const { LIBRARY_VOICES } = await import("../../../data/library-voices.mjs");
  for (const v of [...CREATURE_VOICES, ...LIBRARY_VOICES]) for (const use of ["attack", "hurt", "death"]) assert.ok(v[use]?.length, `${v.label}: no ${use} cry`);
});
