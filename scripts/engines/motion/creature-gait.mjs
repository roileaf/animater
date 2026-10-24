// Which tracks a creature leaves on soft floors (movement-feel.mjs prints): its `gait`. Pure: main.mjs hands in the
// game system id, a plain read of the actor and the token's name. When Animater cannot place a creature it is
// 'unknown': it still raises the floor's dust and makes footsteps, but leaves no prints. Boots need a positive sign (a
// humanoid-ish trait or type, a humanoid name, or a player character).
//
//   boots    shoe or boot soles, left and right in turn (humanoids, giants, fey, fiends, celestials, undead, constructs...)
//   paws     a pad and four toe dots, a quadruped's staggered pairs (wolves, cats, bears, rats, beasts in general)
//   talons   three forward toes and a back spur with long claw tips, left and right (birds, griffons, raptors)
//   dragon   a broad heavy pad, four thick toes ending in hooked claw gouges, four-legged, tail drag (dragons, wyverns, drakes)
//   hooves   crescents, a quadruped's staggered pairs (horses, deer, cattle, goats, centaurs, minotaurs)
//   claws    splayed five-toed clawed prints in staggered pairs and a tail drag between them (lizards, crocodiles)
//   slither  one continuous wavy groove, no prints (snakes, nagas, worms)
//   ooze     one smooth, wide smear (oozes, slimes, jellies, puddings)
//   legs     clusters of tiny dots (spiders, insects, centipedes, crabs, swarms)
//   unknown  dust and footsteps but no prints: anything Animater cannot place, and wheeled things
//   none     nothing at all, not even dust or footsteps: incorporeal creatures (ghosts, wraiths, wisps)
export const GAITS = Object.freeze(['boots', 'paws', 'talons', 'dragon', 'hooves', 'claws', 'slither', 'ooze', 'legs', 'unknown', 'none']);

// Short stems only match a whole word (plural allowed): "cat" never matches "catapult", "ant" never "giant".
const words = (list) => new RegExp(`\\b(?:${list.split(/\s+/).filter(Boolean).join('|')})(?:s|es)?\\b`, 'i');
// Long stems also match the end of a compound ("werewolf", "hellhound", "warhorse", "owlbear") but never its start, so
// "horseman", "dragonborn" and "lizardfolk" stay with whatever else they are.
const tails = (list) => new RegExp(`(?:${list.split(/\s+/).filter(Boolean).join('|')})(?:s|es|lings?)?\\b`, 'i');

// Name (and D&D 5e subtype) keywords, checked in this order; the first gait with a match wins. Specific creatures come
// before the humanoid words, so "Giant Spider" is legs and "Goblin Dog" paws, not boots.
const NAME_GAITS = [
  // Incorporeal by name (the PF2e incorporeal trait and D&D's Incorporeal Movement are read first, below).
  ['none', words('ghost spectre specter wraith phantom banshee poltergeist wisp will-o')],
  // Wheels raise dust and rumble but leave no footprints.
  ['unknown', words('wheel wheeled cart wagon chariot')],
  // Dragons (true dragons, wyverns, drakes, wyrms): heavy four-legged clawed prints with a tail drag, never a bird's.
  ['dragon', words('dragon wyvern drake wyrm wyrmling dracolisk')],
  ['dragon', tails('dragon drake wyrm')],
  ['ooze', words('ooze slime jelly jellies pudding gelatinous blob')],
  ['slither', words('snake serpent viper cobra python adder asp naga worm eel slug leech grick larva maggot salamander')],
  ['slither', tails('snake serpent worm')],
  ['legs', words('spider scorpion centipede millipede beetle ant insect crab tick mite roach cockroach mantis locust swarm vermin ankheg crawler chuul drider isopod')],
  ['legs', tails('spider scorpion centipede beetle')],
  ['talons', words('bird eagle hawk falcon owl roc griffon griffin gryphon hippogriff raptor vulture crow raven chicken cockatrice ostrich emu harpy velociraptor deinonychus tyrannosaurus allosaurus')],
  ['talons', tails('bird hawk')],
  ['hooves', words('horse pony steed mare stallion mule donkey nightmare unicorn pegasus elk deer stag moose reindeer caribou antelope gazelle goat ram sheep bull cow cattle ox oxen bison buffalo aurochs boar pig hog swine camel rhinoceros rhino centaur minotaur satyr faun elephant mammoth mastodon')],
  ['hooves', tails('horse')],
  ['claws', words('lizard crocodile alligator gator croc iguana komodo basilisk turtle tortoise frog toad triceratops ankylosaurus')],
  ['paws', words('wolf wolves dog hound jackal coyote fox cat kitten panther tiger lion lioness leopard jaguar cheetah lynx bobcat cougar puma sabertooth smilodon bear rat mouse mice rodent weasel badger wolverine otter ferret raccoon hyena worg warg displacer barghest ape gorilla monkey baboon rabbit hare squirrel mastiff manticore sphinx chimera')],
  ['paws', tails('wolf hound dog cat bear')],
  // Clear humanoid names: boots.
  ['boots', words('human elf dwarf halfling gnome orc goblin hobgoblin bugbear kobold gnoll lizardfolk giant ogre troll ettin cyclops knight guard soldier bandit cultist priest acolyte mage wizard warrior fighter thief assassin noble commoner villager merchant zombie skeleton ghoul vampire mummy lich golem automaton devil demon angel deva imp hag dryad nymph')],
];

// PF2e / SF2e traits (actor.system.traits.value) and D&D 5e creature types, when no name says otherwise.
const TRAIT_GAITS = [
  ['ooze', ['ooze']],
  ['legs', ['swarm']],
  ['dragon', ['dragon']],
  ['paws', ['animal', 'beast']],
  ['boots', ['humanoid', 'giant', 'fey', 'fiend', 'celestial', 'undead', 'construct', 'elemental', 'plant', 'monitor',
    'aeon', 'azata', 'demon', 'devil', 'daemon', 'angel', 'archon', 'genie', 'goblin', 'orc', 'elf', 'dwarf', 'gnome',
    'halfling', 'human', 'kobold', 'leshy', 'ratfolk', 'catfolk', 'lizardfolk', 'android', 'ysoki', 'vesk', 'lashunta']],
];
// A player character's ancestry that changes its feet; any other character wears boots.
const ANCESTRY_GAITS = { centaur: 'hooves', minotaur: 'hooves', tengu: 'talons' };

const list = (value) => {
  if (!value) return [];
  if (typeof value === 'string') return [value];
  try { return Array.from(value, (v) => String(v ?? '')); } catch { return []; }
};

// The gait for one creature. `system` is game.system.id, `actor` the actor (or a plain copy of its type, system data
// and items), `name` the token's name. Daggerheart has no creature types, so only names count there.
export function creatureGait({ system = '', actor = null, name = '' } = {}) {
  const sys = actor?.system ?? {};
  const traits = system === 'daggerheart' ? [] : list(sys.traits?.value).map((t) => t.toLowerCase());
  const items = system === 'daggerheart' ? [] : list(actor?.items ? Array.from(actor.items, (i) => i?.name ?? '') : []);
  // Incorporeal: the PF2e trait, or D&D 5e's Incorporeal Movement feature.
  if (traits.includes('incorporeal') || items.some((n) => /incorporeal movement/i.test(n))) return 'none';
  const type = system === 'daggerheart' ? {} : (sys.details?.type ?? {});
  const typeValue = String((typeof type === 'string' ? type : type.value) ?? '').toLowerCase();
  if (actor?.type === 'character') {
    for (const trait of traits) if (ANCESTRY_GAITS[trait]) return ANCESTRY_GAITS[trait];
    const race = items.find((n) => /\b(centaur|minotaur|tengu)\b/i.test(n));
    if (race) return ANCESTRY_GAITS[race.toLowerCase().match(/\b(centaur|minotaur|tengu)\b/)[1]];
    return 'boots';
  }
  const text = `${name ?? ''} ${actor?.name ?? ''} ${typeof type === 'object' ? `${type.subtype ?? ''} ${type.custom ?? ''}` : ''}`;
  for (const [gait, pattern] of NAME_GAITS) if (pattern.test(text)) return gait;
  // D&D 5e: a swarm of anything is a swarm.
  if (typeof type === 'object' && type.swarm) return 'legs';
  for (const [gait, keys] of TRAIT_GAITS) if (keys.includes(typeValue) || keys.some((k) => traits.includes(k))) return gait;
  return 'unknown';
}

// How a creature's steps weigh (see movement-feel's stepWeight): its size category where the system has one (PF2e/SF2e
// system.traits.size.value, D&D system.traits.size), and whether its body is heavy for its size: constructs, giants,
// dragons and earth elementals, or a stone, iron or metal body by name (golems, statues, colossi).
const HEAVY_TRAITS = ['construct', 'giant', 'dragon', 'earth'];
const HEAVY_NAMES = /\b(golem|statue|colossus|juggernaut|stone|iron|steel|bronze|adamantine|earth|rock|boulder|titan|behemoth|mammoth|elephant|rhino|dinosaur|tyrannosaurus|triceratops)\b/i;
export function creatureBulk({ system = '', actor = null, name = '' } = {}) {
  const sys = actor?.system ?? {};
  const rawSize = sys.traits?.size;
  const size = typeof rawSize === 'string' ? rawSize : (typeof rawSize?.value === 'string' ? rawSize.value : undefined);
  const traits = system === 'daggerheart' ? [] : list(sys.traits?.value).map((t) => t.toLowerCase());
  const type = system === 'daggerheart' ? {} : (sys.details?.type ?? {});
  const typeValue = String((typeof type === 'string' ? type : type.value) ?? '').toLowerCase();
  const heavy = HEAVY_TRAITS.some((t) => traits.includes(t) || typeValue === t)
    || HEAVY_NAMES.test(`${name ?? ''} ${actor?.name ?? ''}`);
  return { size: size || undefined, heavy };
}

// What a creature's body sounds like as it moves, beyond its feet (movement-feel.mjs bodyStep plays it):
//   bone   a skeleton's dry clatter (skeletons, skeletal undead: the PF2e skeleton trait, "skeleton", "bone ...").
//   metal  a metal body's clank (iron, steel or bronze golems, animated armor, clockwork, robots).
//   stone  stone grinding on stone (stone golems, gargoyles, statues, earth elementals).
//   plant  leaves rustling and wood creaking (treants, leshies, shambling mounds, any plant).
//   water  a slosh per stride (water elementals, water weirds), instead of steps.
//   fire   a flame's whoosh per stride (fire elementals, salamanders), instead of steps.
//   air    a gust per stride (air elementals, whirlwinds), instead of steps.
// null when nothing fits. Checked in this order, the first match wins, so an earth elemental is stone, a bone golem
// bone and an iron golem metal.
export const BODIES = Object.freeze(['bone', 'metal', 'stone', 'plant', 'water', 'fire', 'air']);
const ELEMENT_NAMES = {
  water: /\b(?:water|tide|tidal|wave) (?:elemental|weird|spirit|mephit)s?\b|\b(?:water weird|undine elemental|living waterfall|tidal surge)s?\b/i,
  fire: /\b(?:fire|flame|magma|lava|ember) (?:elemental|spirit|mephit|sprite)s?\b|\b(?:salamander|living bonfire|firewisp|living wildfire)s?\b/i,
  air: /\b(?:air|wind|storm|cloud|lightning) (?:elemental|spirit|mephit)s?\b|\b(?:living whirlwind|whirlwind|invisible stalker|zephyr hawk)s?\b/i,
};
const BONE_NAMES = /\b(?:skeleton|skeletal|skeletons|dracolich|bone (?:golem|naga|dragon|knight|warrior|archer|soldier|guard|horse|steed|hound|colossus|creature|swarm)|bones|boneyard|bonecrusher|ossuary)\b/i;
// A metal body by name: unmistakable words alone; a bare metal word ("Iron", "Brass") only on a construct, so a brass
// dragon or an iron-willed knight stays as it is.
const METAL_SURE = /\b(?:clockwork|robot|robots|automaton|automatons|animated (?:armou?r|suit)|helmed horror|(?:iron|steel|bronze|brass|copper|adamantine|mithral|metal) (?:golem|sentinel|colossus|guardian|juggernaut|defender|soldier|cobra|construct))s?\b/i;
const METAL_WORDS = /\b(?:iron|steel|bronze|brass|copper|adamantine|mithral|metal|metallic|armou?r|armored|mechanical|gear|cog)\b/i;
const STONE_SURE = /\b(?:gargoyle|statue|caryatid|galeb duhr|xorn|living boulder|living statue|(?:stone|rock|granite|marble|obsidian|basalt|earth|crystal) (?:golem|elemental|guardian|sentinel|colossus|juggernaut|defender|construct|statue))s?\b/i;
const STONE_WORDS = /\b(?:stone|rock|granite|marble|obsidian|basalt|boulder|crystal|earthen)\b/i;
const PLANT_NAMES = /\b(?:treant|treants|leshy|leshies|shambling mound|awakened (?:tree|shrub)|(?:twig|vine|needle) blight|dryad tree|wood golem|tree|shrub|vine horror)s?\b/i;
const FUNGUS = /\b(?:fungus|fungi|fungal|mushroom|myconid|mold|mould|shrieker|spore)s?\b/i;
export function creatureBody({ system = '', actor = null, name = '' } = {}) {
  const sys = actor?.system ?? {};
  const dh = system === 'daggerheart';
  const traits = dh ? [] : list(sys.traits?.value).map((t) => t.toLowerCase());
  const type = dh ? {} : (sys.details?.type ?? {});
  const typeValue = String((typeof type === 'string' ? type : type.value) ?? '').toLowerCase();
  const sub = typeof type === 'object' ? `${type.subtype ?? ''} ${type.custom ?? ''}` : '';
  const text = `${name ?? ''} ${actor?.name ?? ''} ${sub}`;
  const has = (t) => traits.includes(t) || typeValue === t;
  const elemental = has('elemental');
  // Elementals and their kin first: a body of water, fire or air does not step at all.
  for (const element of ['water', 'fire', 'air']) {
    if (ELEMENT_NAMES[element].test(text)) return element;
    if (elemental && (traits.includes(element) || new RegExp(`\\b${element}\\b`, 'i').test(text))) return element;
  }
  if (elemental && (traits.includes('earth') || /\b(?:earth|stone|rock)\b/i.test(text))) return 'stone';
  if (traits.includes('skeleton') || BONE_NAMES.test(text)) return 'bone';
  const construct = has('construct');
  if (traits.includes('clockwork') || traits.includes('robot') || METAL_SURE.test(text) || (construct && METAL_WORDS.test(text))) return 'metal';
  if (STONE_SURE.test(text) || (construct && STONE_WORDS.test(text))) return 'stone';
  if (FUNGUS.test(text) || traits.includes('fungus')) return null;
  if (has('plant') || traits.includes('leshy') || PLANT_NAMES.test(text)) return 'plant';
  return null;
}
