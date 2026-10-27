// Creature voices: a creature that is hurt now and then cries out, and one that falls always does. Its voice is the
// most specific family the bank has for it (a wolf a canine, else a beast; a zombie a zombie, else the undead), and
// within a family each creature keeps one voice of its own, its hurt and its death alike. A kind the bank has nothing
// for stays silent, as do bodies with no voice at all (animated objects, most constructs, elementals), leaving the
// blow's surface sound alone. Any system: PF2e traits, D&D 5e creature types, both read through describeTarget. On
// PF2e, PF2e Creature Sounds voices creatures itself when it is active, and this steps aside.
// Pure: main.mjs reads Foundry and plays it.
import { describeTarget, sizeOf } from './surface-sounds.mjs';
import { seeded } from './creature-idle.mjs';
import { CREATURE_VOICES } from '../../../data/creature-voices.mjs';

export const HURT_CHANCE = 0.6;
// An attacker voices its effort (a grunt, a snarl, a roar) about half the time.
export const ATTACK_CHANCE = 0.5;
// A creature that cried out stays quiet this long, so a flurry of blows is not a flurry of screams.
export const VOICE_COOLDOWN_MS = 1800;

// Specific families by name, each with the broader one it falls back to.
const NAMED = [
  [/\b(spiders?|ettercaps?|driders?)\b/i, ['spider', 'insect']],
  [/\b(beetles?|ants?|wasps?|bees?|scorpions?|centipedes?|insects?|mantis|ticks?|locusts?|ankhegs?|vermin|chuul|cockroach|flies|fly)\b/i, ['insect']],
  // A bird of prey's scream, big enough for a griffon; small birds caw and squawk.
  [/\b(hawks?|eagles?|vultures?|rocs?|falcons?|griff[oi]ns?|gryphons?|hippogriffs?|axe ?beaks?|terror ?birds?)\b/i, ['raptor', 'bird']],
  [/\b(owls?|ravens?|crows?|birds?|parrots?|cockatrices?|harp(y|ies))\b/i, ['bird']],
  [/\b(owlbears?|bears?|werebears?)\b/i, ['bear', 'beast']],
  [/\b(wolf|wolves|werewol(f|ves)|dogs?|hounds?|jackals?|coyotes?|worgs?|wargs?|hyenas?|mastiffs?)\b/i, ['canine', 'beast']],
  // Gnolls are people with a hyena's throat.
  [/\b(gnolls?)\b/i, ['canine', 'man']],
  [/\b(cats?|lions?|tigers?|weretigers?|panthers?|leopards?|jaguars?|lynx|sabre|smilodon|displacer)\b/i, ['feline', 'beast']],
  [/\b(boars?|wereboars?|pigs?|hogs?|swine)\b/i, ['swine', 'beast']],
  [/\b(horses?|pon(y|ies)|mules?|donkeys?|pegas(us|i)|unicorns?|nightmares?|warhorses?|kelpies?)\b/i, ['equine', 'beast']],
  [/\b(rats?|wererats?|mice|mouse|squirrels?|badgers?|weasels?|ratfolk)\b/i, ['rodent', 'beast']],
  [/\b(bats?)\b/i, ['bat', 'beast']],
  [/\b(bulls?|cows?|cattle|ox|oxen|bisons?|buffal(o|oes)|aurochs|yaks?|goats?|rams?|sheep|(rein)?deer|elks?|moose|stags?|antelopes?|gazelles?|rhinoceros(es)?|rhinos?|hippopotam(us|uses|i)|hippos?|camels?|minotaurs?)\b/i, ['hoofed', 'beast']],
  [/\b(elephants?|mammoths?|mastodons?|oliphaunts?)\b/i, ['elephant', 'beast']],
  [/\b(apes?|gorillas?|baboons?|monkeys?|chimp(anzee)?s?|orangutans?|girallons?|yetis?|sasquatch(es)?)\b/i, ['ape', 'beast']],
  [/\b(lizardfolk|iruxi|troglodytes?|yuan-?ti|nagaji)\b/i, ['reptile', 'man']],
  [/\b(snakes?|serpents?|vipers?|cobras?|pythons?|crocodiles?|alligators?|lizards?|basilisks?|nagas?)\b/i, ['reptile', 'beast']],
  [/\b(sharks?|octop(us|uses|i)|squids?|krakens?|crabs?|lobsters?|whales?|orcas?|dolphins?|reefclaws?)\b/i, ['aquatic', 'beast']],
  [/\b(frogs?|toads?|newts?)\b/i, ['amphibian', 'beast']],
  [/\b(bullywugs?|boggards?)\b/i, ['amphibian', 'man']],
  [/\b(zombies?|ghouls?|ghasts?|mummy|mummies|draugr|wights?)\b/i, ['zombie', 'undead']],
  [/\b(ghosts?|specters?|spectres?|wraiths?|banshees?|poltergeists?|allips?|shadows?)\b/i, ['wraith', 'undead']],
  [/\b(golems?|colossus|stone guardians?)\b/i, ['golem']],
  [/\b(treants?|awakened tree|tree|shambling mound)\b/i, ['treant']],
  [/\b(oozes?|puddings?|jell(y|ies)|gelatinous|slimes?|black pudding)\b/i, ['ooze']],
  [/\b(orcs?|half-orcs?|ogres?|trolls?|bugbears?)\b/i, ['brute', 'man']],
  [/\b(goblins?|kobolds?|hobgoblins?)\b/i, ['goblin', 'small-folk']],
];
const FEMALE = /\b(woman|women|giantess|queen|priestess|witch|hag|lady|matron|mother|sister|maiden|wife|girl|duchess|princess|sorceress|empress|baroness|countess|mistress|abbess|huntress|enchantress|seductress|nun|succubus)\b/i;
const MALE = /\b(man|men|king|priest|lord|father|brother|boy|prince|duke|baron|count|emperor|monk|wizard|sorcerer|abbot|master|incubus)\b/i;
const SMALL_FOLK = ['goblin', 'kobold', 'halfling', 'gnome', 'grippli', 'leshy', 'sprite', 'pixie'];
const PEOPLE = ['humanoid', 'human', 'elf', 'dwarf', 'orc', 'celestial', 'fey', 'angel', 'azata', 'archon', 'hobgoblin'];
const FIEND = ['fiend', 'demon', 'devil', 'daemon'];
const MONSTER = ['aberration', 'monstrosity'];

// A person's gender: D&D 5e's details.gender text, PF2e's details.gender.value, else what their name says.
function genderOf(actor) {
  const g = actor?.system?.details?.gender, text = String(typeof g === 'object' ? g?.value ?? '' : g ?? '').toLowerCase();
  if (/\b(f|female|woman|she|her)\b/.test(text)) return 'woman';
  if (/\b(m|male|man|he|him)\b/.test(text)) return 'man';
  const name = String(actor?.name ?? '');
  return FEMALE.test(name) ? 'woman' : MALE.test(name) ? 'man' : null;
}
const personOf = (actor, name) => genderOf(actor) ?? (seeded(`${actor.id ?? name}:voice`) < 0.5 ? 'man' : 'woman');

// Female monsters by name, whatever their type.
// (A gorgon is a bronze bull; a medusa is the snake-haired one.)
const FEMALE_MONSTER = /\b(hags?|annis|harp(y|ies)|medusas?|lamias?|sirens?|banshees?|succub(us|i)|erinyes|mariliths?|rusalkas?|lillends?|furies|fury|naga queen|spider queen|vampiress|lich queen)\b/i;
const MONSTER_TYPES = ['undead', 'fiend', 'demon', 'devil', 'daemon', 'aberration', 'monstrosity', 'hag'];
const PEOPLE_VOICES = ['man', 'woman', 'small-folk'];
const ANIMAL_VOICES = ['insect', 'spider', 'canine', 'feline', 'bear', 'swine', 'equine', 'rodent', 'bat', 'hoofed', 'elephant', 'ape', 'reptile', 'aquatic', 'amphibian', 'swarm', 'raptor', 'bird', 'beast', 'dragon', 'plant', 'treant'];
// Fish have no voice to cry with, alone or in a swarm.
const FISH = /\b(fish|piranhas?|quippers?|barracudas?|pikes?|carps?|eels?|sturgeons?|gars?)\b/i;
// A swarm cries as many of the small animals it is made of, never as one big beast.
const SWARM_OF = ['insect', 'spider', 'rodent', 'bat', 'bird', 'reptile', 'amphibian'];

/**
 * The voice families a creature can cry out in, most specific first (['canine', 'beast'], ['zombie', 'undead']).
 * Empty for a body with no voice: an object, an animated thing, an elemental. A female monster (a hag, a harpy, a
 * medusa, a banshee, a female ghost, undead or fiend) cries in a female monster's voice first, then its own kind's.
 */
export function voiceKinds(actor) {
  const kinds = kindsOf(actor);
  if (!kinds.length) return kinds;
  const t = describeTarget(actor), name = t?.name ?? '', traits = t?.traits ?? new Set();
  // A queen of wasps or spiders is female by name only: an animal's body keeps its animal's voice.
  // A skeleton (a harpy's bones) only rattles.
  const animalBody = ANIMAL_VOICES.includes(kinds[0]) || traits.has('animal');
  if (kinds[0] === 'skeleton') return kinds;
  const monster = FEMALE_MONSTER.test(name) || !animalBody && genderOf(actor) === 'woman' && MONSTER_TYPES.some((x) => traits.has(x));
  if (!monster) return kinds;
  // A person-shaped one (a hag, a vampire) falls back to a woman's voice before its kind's; an animal-shaped one (a
  // harpy) to its animal; none to a man's.
  const rest = kinds.filter((k) => k !== 'fiend-woman' && !PEOPLE_VOICES.includes(k));
  return [...new Set(['fiend-woman', ...(kinds.includes('woman') ? ['woman'] : []), ...rest])];
}

function kindsOf(actor) {
  if (!actor || ['loot', 'hazard', 'vehicle', 'party', 'group'].includes(actor.type)) return [];
  const t = describeTarget(actor);
  if (!t) return [];
  const traits = t.traits, name = t.name, has = (list) => list.some((x) => traits.has(x));
  // Animated objects (armour, a broom, a rug) have no voice; their blows sound on what they are made of.
  if (traits.has('object') || /\banimated\b/i.test(name) && !traits.has('undead')) return [];
  if (traits.has('illusion')) return [];
  if (FISH.test(name) && !has(PEOPLE)) return [];
  // PF2e's swarm trait; D&D 5e's swarm size.
  if (traits.has('swarm') || actor.system?.details?.type?.swarm) {
    const of = NAMED.find(([re]) => re.test(name))?.[1]?.[0];
    return ['swarm', ...(SWARM_OF.includes(of) ? [of] : [])];
  }
  const person = () => (has(SMALL_FOLK) || sizeOf(actor) < 0 ? ['small-folk'] : [personOf(actor, name)]);
  // PF2e's beast trait is a magical beast (D&D's monstrosity); its animals are animals.
  const pf2e = Array.isArray(actor.system?.traits?.value);
  // Its creature type's own bank (a PF2e creature's narrower traits first), then the broader voice it falls back to.
  const type = traits.has('skeleton') ? ['skeleton', 'undead']
    : has(['zombie', 'ghoul', 'ghul', 'mummy', 'wight', 'graveknight']) ? ['zombie', 'undead']
    : has(['ghost', 'wraith', 'phantom', 'spectra', 'shade']) ? ['wraith', 'undead']
    : traits.has('vampire') ? [...person(), 'undead']
    : traits.has('golem') ? ['golem', 'construct']
    : traits.has('genie') ? [...person(), 'elemental']
    : traits.has('hag') ? ['woman']
    : traits.has('nymph') ? ['fey', 'woman']
    : has(['titan', 'gigas']) ? ['giant', 'man']
    : has(['troll', 'bugbear']) ? ['brute', 'man']
    : traits.has('dinosaur') ? ['reptile', 'beast']
    : has(['serpentfolk', 'lizardfolk', 'iruxi']) ? ['reptile', ...person()]
    : traits.has('boggard') ? ['amphibian', ...person()]
    : traits.has('aquatic') && traits.has('animal') ? ['aquatic', 'beast']
    : traits.has('kaiju') ? ['kaiju', 'monster']
    : has(['monitor', 'aeon', 'psychopomp', 'inevitable', 'protean']) ? ['monitor']
    : traits.has('formian') ? ['insect']
    : traits.has('kami') ? ['fey']
    : has(['dream', 'astral', 'shadow', 'time', 'siktempora']) && !has(PEOPLE) ? ['monster']
    // A summoned elemental with a custom type (Conjure Elemental).
    : /\belementals?\b/i.test(name) && !has(PEOPLE) ? ['elemental']
    : traits.has('undead') ? traits.has('incorporeal') || traits.has('spirit') ? ['wraith', 'undead'] : ['undead']
    : traits.has('incorporeal') || traits.has('spirit') ? ['wraith']
    : traits.has('construct') ? ['construct']
    : traits.has('elemental') ? ['elemental']
    : traits.has('ooze') ? ['ooze']
    : traits.has('plant') || traits.has('fungus') ? ['plant']
    : traits.has('dragon') || /\b(dragons?|wyrms?|drakes?|wyverns?|dragonets?)\b/i.test(name) && !has(PEOPLE) ? ['dragon']
    : has(FIEND) ? genderOf(actor) === 'woman' ? ['fiend-woman', 'fiend', 'monster'] : ['fiend', 'monster']
    // A giant's roar is a man's voice slowed down; a giantess says so in her name.
    : traits.has('giant') ? genderOf(actor) === 'woman' ? ['giant', 'woman'] : ['giant', 'man']
    : traits.has('celestial') || has(['angel', 'azata', 'archon']) ? ['celestial', ...person()]
    : traits.has('fey') ? ['fey', ...person()]
    : traits.has('aberration') ? ['aberration', 'monster']
    : traits.has('monstrosity') ? ['monstrosity', 'monster']
    : traits.has('animal') || traits.has('beast') && !pf2e ? ['beast']
    : traits.has('beast') ? ['monstrosity', 'monster', 'beast']
    : has(SMALL_FOLK) || traits.has('humanoid') && sizeOf(actor) < 0 ? ['small-folk']
    : has(PEOPLE) || actor.type === 'character' ? person()
    : [];
  const named = NAMED.find(([re]) => re.test(name))?.[1];
  if (!named) return type;
  // A creature its name gives away (a wolf, an owlbear, a zombie) cries as that first. People's own families (a
  // brute, a goblin) keep their people's voice next, a person's gender first; others fall back to their type.
  if (['man', 'small-folk'].includes(named.at(-1))) {
    const own = type.filter((k) => !['man', 'woman', 'small-folk'].includes(k));
    // A woman of an animal-throated people (a lizardfolk, a gnoll) keeps its throat; a brute's grunts are a man's.
    if (named.at(-1) === 'man' && genderOf(actor) === 'woman') return [...new Set([...(ANIMAL_VOICES.includes(named[0]) ? [named[0]] : []), 'woman', ...own])];
    return [...new Set([...named, ...own])];
  }
  // Constructs, plants and the undead only take a family that fits their body (a golem, a treant, a zombie).
  if ((traits.has('construct') || traits.has('plant') || traits.has('fungus') || traits.has('undead')) && !['golem', 'treant', 'zombie', 'wraith'].includes(named[0])) return type;
  // An animal by name (a unicorn, a giant owl) never falls back to a person's voice.
  const animal = named.at(-1) === 'beast' || ['bird', 'insect'].includes(named.at(-1));
  // A bird of prey falls back to any bird before its type.
  return [...new Set([...(named[0] === 'raptor' ? named : [named[0]]), ...type.filter((k) => !animal || !['man', 'woman', 'small-folk'].includes(k)), ...named.slice(1)])];
}
/** The most specific voice family, or null for none. */
export const voiceKind = (actor) => voiceKinds(actor)[0] ?? null;

// Every family, for a token's own choice, each with the broader one it falls back to.
export const VOICE_FAMILIES = {
  man: { label: 'Man', parent: null }, woman: { label: 'Woman', parent: null }, 'small-folk': { label: 'Small folk', parent: null },
  goblin: { label: 'Goblin or kobold', parent: 'small-folk' }, brute: { label: 'Brute (orc, ogre, troll)', parent: 'man' }, giant: { label: 'Giant', parent: 'man' },
  beast: { label: 'Beast', parent: null }, canine: { label: 'Wolf or dog', parent: 'beast' }, feline: { label: 'Big cat', parent: 'beast' },
  bear: { label: 'Bear', parent: 'beast' }, swine: { label: 'Boar or pig', parent: 'beast' }, equine: { label: 'Horse', parent: 'beast' },
  rodent: { label: 'Rat or rodent', parent: 'beast' }, bat: { label: 'Bat', parent: 'beast' },
  hoofed: { label: 'Hoofed beast (bull, goat, deer, rhino)', parent: 'beast' }, elephant: { label: 'Elephant or mammoth', parent: 'beast' },
  ape: { label: 'Ape or gorilla', parent: 'beast' }, reptile: { label: 'Snake or reptile', parent: 'beast' },
  aquatic: { label: 'Sea creature (shark, octopus, crab, whale)', parent: 'beast' }, amphibian: { label: 'Frog or toad', parent: 'beast' },
  swarm: { label: 'Swarm', parent: null }, bird: { label: 'Bird', parent: null }, raptor: { label: 'Bird of prey (eagle, roc, griffon)', parent: 'bird' }, insect: { label: 'Insect', parent: null }, spider: { label: 'Spider', parent: 'insect' },
  dragon: { label: 'Dragon', parent: null }, undead: { label: 'Undead', parent: null }, zombie: { label: 'Zombie or ghoul', parent: 'undead' },
  wraith: { label: 'Ghost or wraith', parent: 'undead' }, skeleton: { label: 'Skeleton', parent: 'undead' },
  monster: { label: 'Monster', parent: null }, fiend: { label: 'Fiend', parent: 'monster' }, 'fiend-woman': { label: 'Female monster (hag, harpy, medusa, ghost)', parent: 'woman' },
  aberration: { label: 'Aberration', parent: 'monster' }, monstrosity: { label: 'Monstrosity', parent: 'monster' },
  kaiju: { label: 'Kaiju', parent: 'monster' }, monitor: { label: 'Monitor (aeon, psychopomp, protean)', parent: null },
  celestial: { label: 'Celestial', parent: null }, fey: { label: 'Fey', parent: null }, elemental: { label: 'Elemental', parent: null },
  ooze: { label: 'Ooze', parent: null }, construct: { label: 'Construct', parent: null }, golem: { label: 'Golem', parent: 'construct' },
  plant: { label: 'Plant', parent: null }, treant: { label: 'Treant', parent: 'plant' },
};
// The families as a GM looks for them: by the kind of creature, each family in one category.
export const VOICE_CATEGORIES = [
  ['People', ['man', 'woman', 'small-folk']],
  ['Monstrous folk (goblins, orcs, giants)', ['goblin', 'brute', 'giant']],
  ['Animals and beasts', ['beast', 'canine', 'feline', 'bear', 'swine', 'equine', 'hoofed', 'elephant', 'ape', 'rodent', 'bat']],
  ['Birds, amphibians and sea creatures', ['bird', 'raptor', 'amphibian', 'aquatic']],
  ['Dragons and reptiles', ['dragon', 'reptile']],
  ['Insects, spiders and swarms', ['insect', 'spider', 'swarm']],
  ['Monsters and aberrations', ['monster', 'monstrosity', 'aberration', 'kaiju', 'fiend-woman']],
  ['Fiends and outsiders', ['fiend', 'celestial', 'monitor']],
  ['Fey', ['fey']],
  ['Elementals', ['elemental']],
  ['Constructs, oozes and plants', ['construct', 'golem', 'ooze', 'plant', 'treant']],
  ['Undead and spirits', ['undead', 'zombie', 'wraith', 'skeleton']],
];
/**
 * The families for a picker: [{ label, families: [[family, its label]] }], by category, in VOICE_CATEGORIES order.
 * Given a `bank`, only the families with a voice to play (their own, or a broader family's) and the one `chosen`.
 */
export const familyGroups = ({ bank, chosen = '' } = {}) => VOICE_CATEGORIES.map(([label, keys]) => ({ label, families: keys
  .filter((k) => !bank || k === chosen || voiceLineage(k).some((f) => bank.some((v) => v.suits?.[0] === f && fullness(v))))
  .map((k) => [k, VOICE_FAMILIES[k].label]) })).filter((g) => g.families.length);

/** A family with the broader ones it falls back to (a wolf: canine, beast). */
export const voiceLineage = (family) => {
  const out = [];
  for (let f = family; f && VOICE_FAMILIES[f] && !out.includes(f); f = VOICE_FAMILIES[f].parent) out.push(f);
  return out;
};

/** What a creature is, for matching a voice to it: its kinds (voiceKinds, most specific first), its name and size. */
export function creatureOf(actor) {
  return { kinds: voiceKinds(actor), name: String(actor?.name ?? ''), size: actor ? sizeOf(actor) : null };
}
const asCreature = (c) => (Array.isArray(c) ? { kinds: c, name: '', size: null } : { kinds: c?.kinds ?? [], name: c?.name ?? '', size: c?.size ?? null });

/**
 * A token's own voice (flags.animater.voice): '' or 'auto' as its creature, 'none' silent, else a family (with its
 * broader ones to fall back on). `speaker` (flags.animater.voiceSpeaker) names one voice of the bank by its id.
 * { creature: what to match (null: silent), voiceId }.
 */
export function tokenVoice(actor, { voice = '', speaker = '' } = {}) {
  const choice = String(voice ?? '').trim(), own = creatureOf(actor);
  const creature = choice === 'none' ? null : VOICE_FAMILIES[choice] ? { ...own, kinds: voiceLineage(choice) } : own;
  const id = String(speaker ?? '').trim();
  // A number is the old "Voice 1..6" choice of a family, which no longer names one voice.
  return { creature, voiceId: id && !/^\d+$/.test(id) ? id : null };
}

const FULL = ['attack', 'hurt', 'death'];
const fullness = (v) => FULL.filter((u) => v?.[u]?.length).length;
const wholeName = (name, word) => new RegExp(`\\b${String(word).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(name);
// Below this a creature stays silent: a voice that fits it only loosely sounds worse than none.
export const MIN_VOICE_SCORE = 1;

/**
 * How well a voice fits a creature. A voice is a profile: { suits: kinds it fits, strongest first; keywords in names;
 * size: [min, max] steps from medium; gender; prefer }. Its kinds against the creature's, each the more specific the
 * better (up to 3); a keyword in the name above any kind; a size out of its range, or the other gender, counts hard
 * against it; a preferred voice (the GM's choice) and a fuller one (all three cries) a little for it. 0: no fit at all.
 */
export function scoreVoice(voice, creature) {
  const c = asCreature(creature), suits = voice?.suits ?? [];
  let fit = 0;
  c.kinds.forEach((k, i) => { const j = suits.indexOf(k); if (j >= 0) fit = Math.max(fit, 3 - 0.75 * Math.min(i, 3) - 0.5 * Math.min(j, 3)); });
  if (c.name && (voice?.keywords ?? []).some((w) => wholeName(c.name, w))) fit = Math.max(fit, 3) + 2;
  if (!fit) return 0;
  let score = fit;
  if (Array.isArray(voice.size) && Number.isFinite(c.size)) {
    const [lo, hi] = voice.size;
    score -= 2 * (c.size < lo ? lo - c.size : c.size > hi ? c.size - hi : 0);
  }
  const gender = c.kinds.includes('woman') || c.kinds.includes('fiend-woman') ? 'woman' : c.kinds.includes('man') ? 'man' : null;
  if (voice.gender && gender && voice.gender !== gender) score -= 3;
  if (voice.prefer) score += 2;
  return score + 0.3 * fullness(voice);
}

/** What it voices: a fall always ('death'), a hurt by a seeded chance (the same on every screen), else null. */
export function voiceEvent({ dropped = false, attack = false, seed = '', chance = attack ? ATTACK_CHANCE : HURT_CHANCE } = {}) {
  if (attack) return seeded(`${seed}:attack`) < chance ? 'attack' : null;
  if (dropped) return 'death';
  return seeded(`${seed}:hurt`) < chance ? 'hurt' : null;
}

/**
 * The attacker of an attack roll's chat message, which every screen receives: { tokenId, sceneId, actorId }, or null
 * for any other message. PF2e and SF2e mark Strikes and spell attacks in flags.<system>.context.type; D&D 5e in
 * flags.dnd5e.roll.type.
 */
export function attackSpeaker(message, systemId) {
  const flags = message?.flags ?? {};
  const attack = ['pf2e', 'sf2e'].includes(systemId) ? /attack-roll/.test(String(flags[systemId]?.context?.type ?? flags.pf2e?.context?.type ?? ''))
    : systemId === 'dnd5e' ? flags.dnd5e?.roll?.type === 'attack' : false;
  const s = message?.speaker ?? {};
  return attack && s.token ? { tokenId: s.token, sceneId: s.scene ?? null, actorId: s.actor ?? null } : null;
}

/**
 * The voice a creature cries in: the bank is a list of voices, each one throat (one recording, pack or performer) with
 * its { attack, hurt, death } takes and a profile of the creatures it suits (scoreVoice). The creature (`voiceSeed`)
 * keeps one of the best-fitting voices, whatever it is crying, so its attack, hurt and death sound like the same
 * throat. `creature` is creatureOf(actor), or a list of kinds. `voiceId` (a token's own choice) names the voice
 * instead. Null when no voice fits well enough.
 */
export function voiceOf(creature, { voiceSeed = '', voiceId = null, bank = CREATURE_VOICES } = {}) {
  const voices = (Array.isArray(bank) ? bank : []).filter((v) => fullness(v));
  // A token's own pick, else (a voice no longer in the bank) the best fit, as if none were picked.
  const named = voiceId ? voices.find((v) => v.id === voiceId) : null;
  if (named) return named;
  // A voice marked auto: false is only ever a token's own pick.
  const scored = voices.filter((v) => v.auto !== false).map((v) => [v, scoreVoice(v, creature)]), best = Math.max(0, ...scored.map(([, s]) => s));
  if (best < MIN_VOICE_SCORE) return null;
  // The best and those within a hair of it, so a creature of a common kind is not always the same voice.
  const top = scored.filter(([, s]) => s >= best - 0.25).map(([v]) => v);
  return top[Math.floor(seeded(`${voiceSeed}:voice`) * top.length)];
}
/**
 * The bank as a picker shows it: female voices, male voices, then every other creature's, each by name. Voices with
 * no cry at all are left out. [{ label, voices: [[id, label]] }], empty groups dropped. `kinds` (a family with its
 * fallbacks, voiceLineage, or a creature's voiceKinds) keeps only the voices of the most specific kind that has any,
 * as playback would pick from; `chosen` (a voice id) stays listed whatever the kind.
 */
export function voiceGroups(bank = CREATURE_VOICES, { kinds, chosen = '' } = {}) {
  const groups = [['woman', 'Female'], ['man', 'Male'], [null, 'Creature']].map(([gender, label]) => ({ gender, label, voices: [] }));
  let voices = (Array.isArray(bank) ? bank : []).filter((x) => fullness(x));
  if (Array.isArray(kinds)) {
    // A group's own voices (those it is first in): an orc that can stand in for a man is not listed as one. The
    // nearest broader group with voices of its own when this one has none.
    const kind = kinds.find((k) => voices.some((v) => v.suits?.[0] === k));
    voices = voices.filter((v) => (kind && v.suits?.[0] === kind) || (chosen && v.id === chosen));
  }
  for (const v of voices) {
    (groups.find((g) => g.gender === (v.gender ?? null)) ?? groups[2]).voices.push([v.id, v.label ?? v.id]);
  }
  return groups.filter((g) => g.voices.length).map(({ label, voices }) => ({ label, voices: voices.sort((a, b) => a[1].localeCompare(b[1])) }));
}

// What a voice cries for an event, from its own takes only: a fall with no death cry uses its hurt cry, a hurt with
// none its death groan; an attack with no effort of its own stays silent rather than borrow another throat.
const takesFor = (voice, event) => (voice?.[event]?.length ? voice[event] : event === 'death' ? voice?.hurt : event === 'hurt' ? voice?.death : null) ?? [];
/** Whether the voice cries `event` with another event's takes (a death with its hurt cries, a hurt with its death's). */
export const voiceBorrows = (voice, event) => !voice?.[event]?.length && takesFor(voice, event).length > 0;

/**
 * A take for `event` in the creature's own voice (voiceOf), chosen by `seed`, never the take it cried last (`avoid`)
 * when it has another. Null when its voice has nothing for the event, or the bank has no voice for it.
 */
export function voiceFile(creature, event, { seed = '', voiceSeed = '', voiceId = null, avoid = null, bank = CREATURE_VOICES } = {}) {
  const files = takesFor(voiceOf(creature, { voiceSeed, voiceId, bank }), event);
  if (!files.length) return null;
  let i = Math.floor(seeded(`${seed}:file`) * files.length);
  if (files[i] === avoid && files.length > 1) i = (i + 1 + Math.floor(seeded(`${seed}:again`) * (files.length - 1))) % files.length;
  return files[i];
}

/**
 * How a cry plays. By size (steps from medium, Tiny -2 .. Gargantuan +3): smaller is higher, bigger lower and a little
 * louder. The creature (`seed`) keeps a voice of its own, a few percent off its size's pitch; each cry (`hitSeed`)
 * wanders a little more around it, in pitch, level and how long after the blow it comes, so no two cries are the same.
 */
export function voiceShape(size, seed = '', { hitSeed = '', event = 'hurt', borrowed = false } = {}) {
  const s = Math.min(3, Math.max(-2, Number(size) || 0));
  const own = (seeded(`${seed}:pitch`) - 0.5) * 0.08, cry = hitSeed ? (seeded(`${hitSeed}:pitch`) - 0.5) * 0.12 : 0;
  // A cry standing in for a missing one (voiceBorrows) is told apart: a hurt played for a death sinks, a death played
  // for a hurt is pinched up.
  const lent = borrowed ? (event === 'death' ? 0.86 : 1.12) : 1;
  const rate = +Math.min(1.35, Math.max(0.6, (1 - 0.07 * s) * (1 + own) * (1 + cry) * lent)).toFixed(3);
  // About 2 dB either way.
  const level = hitSeed ? 10 ** (((seeded(`${hitSeed}:level`) - 0.5) * 4) / 20) : 1;
  const volume = +Math.min(1, (0.6 + 0.06 * Math.max(0, s)) * level).toFixed(3);
  // An attack's effort comes as it swings; a cry just after the blow lands; a fall a moment later.
  const [from, span] = event === 'death' ? [200, 180] : event === 'attack' ? [0, 90] : [80, 120];
  const delay = Math.round(from + (hitSeed ? seeded(`${hitSeed}:delay`) : 0.5) * span);
  return { rate, volume, delay };
}

/** A token given its own Animater voice (a family, 'auto', silence, or one voice by id) rather than the default. */
export const ownsVoice = ({ voice = '', speaker = '' } = {}) => String(voice ?? '').trim() !== '' || /\D/.test(String(speaker ?? '').trim());
/**
 * On PF2e, PF2e Creature Sounds (active and switched on) voices hurt and dying creatures itself, all but a token given
 * its own Animater voice (`voice`, `speaker`: its flags).
 */
export const voiceDeferred = ({ systemId, moduleActive, moduleEnabled, voice = '', speaker = '' }) =>
  systemId === 'pf2e' && moduleActive === true && moduleEnabled !== false && !ownsVoice({ voice, speaker });
