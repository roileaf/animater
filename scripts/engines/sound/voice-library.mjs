// Creature voices from the GM's own sound folder (world setting "Creature voices from my own folder"): each sub-folder
// is one voice, filed as a voice family by its name, its attack/, hurt/ and death/ folders holding the takes
// (<folder>/<creature>/<attack|hurt|death>/*.ogg). The files stay in the GM's Data folder and are never bundled; a
// commercial library someone owns can be used in their own games this way. Pure: main.mjs browses and plays.
import { voiceLineage } from './creature-voice.mjs';

// A folder's name as a voice family, the first that fits. Layer-only folders ("ADD") are parts of a sound, not one.
const FAMILIES = [
  [/\bADD\b/, null],
  // A humanoid creature library's own voices (their style words, Growl or Howling, name no animal): a woman's monstrous
  // voice, any other a monster's.
  [/CREATURE FEMALE/i, 'fiend-woman'], [/CREATURE MALE/i, 'monster'],
  [/swarm/i, 'swarm'], [/\bfrogs?\b|\btoads?\b/i, 'amphibian'], [/shark|kraken|octopus|whale|\bcrabs?\b|dolphin|\borcas?\b/i, 'aquatic'],
  [/wyvern|dragon|drake/i, 'dragon'], [/spider/i, 'spider'], [/\bants?\b|\bbugs?\b|insect|beetle|wasp|mantis/i, 'insect'],
  [/\bhags?\b|harpy|medusa/i, 'fiend-woman'], [/golem/i, 'golem'], [/construct/i, 'construct'], [/\booze|slime|jelly/i, 'ooze'],
  [/mummy|wight|ghast/i, 'zombie'], [/vampire/i, 'undead'],
  [/skelet/i, 'skeleton'], [/banshee|ghost|wraith|spirit|phantom|spectre|specter/i, 'wraith'], [/zombie|ghoul|undead/i, 'zombie'], [/goblin|kobold|gremlin/i, 'goblin'],
  [/eagle|hawk|falcon|vulture|griff[oi]n|hippogriff|gryphon|\brocs?\b/i, 'raptor'], [/elephant|mammoth|mastodon/i, 'elephant'],
  [/\bapes?\b|gorilla|baboon|monkey|yeti|sasquatch|bigfoot/i, 'ape'],
  [/\bbulls?\b|\bcows?\b|cattle|\box(en)?\b|bison|buffalo|\bgoats?\b|\brams?\b|sheep|\bdeer\b|\belks?\b|moose|\bstags?\b|antelope|rhino|hippo(?!gri)|camel|minotaur/i, 'hoofed'],
  [/\borcs?\b|ogre|troll/i, 'brute'], [/cyclops|giant\b(?! worm)|titan/i, 'giant'], [/hell ?hound|wolf|\bdogs?\b|hound|jackal|hyena/i, 'canine'],
  [/bear/i, 'bear'], [/sabre|\bcats?\b|\blions?\b|tiger|panther/i, 'feline'], [/boar|\bpigs?\b|warthog|\bhogs?\b/i, 'swine'],
  [/horse|donkey|alpaca|mule|pony/i, 'equine'], [/\brats?\b|mouse|mice|rodent/i, 'rodent'],
  [/crow|phoenix|\bbirds?\b|pterodactyl|raven|\bowls?\b/i, 'bird'],
  [/serpent|snake|basilisk|lizard|t ?rex|velociraptor|brontosaurus|dinosaur|crocodile/i, 'reptile'],
  [/seal|\bbeast\b|alpaca|behemoth/i, 'beast'], [/aberration|alien|\bworm\b|tentacle/i, 'aberration'],
  [/demon|devil|fiend/i, 'fiend'], [/\bmonsters?\b/i, 'monster'],
];
export function folderFamily(name) {
  for (const [re, family] of FAMILIES) if (re.test(String(name ?? ''))) return family;
  return null;
}

// The same recording at another sample rate ("… 100K", "… 100kHz" beside "… ST" or the plain name) is one voice.
const RATE = /\s+(100K|100kHz|ST)$/i;
const USES = new Set(['attack', 'hurt', 'death']);

/**
 * The voice bank of a scanned folder: `entries` are { folder, use, files } (file names in <base>/<folder>/<use>/).
 * Each folder is one voice ({ attack, hurt, death, folder }), filed by its name; a sample-rate twin is skipped.
 * `verdicts` (the GM's audition, animater-voices.json in the folder): `reject` folders are dropped, `family` re-files a
 * folder ({ folder: family }), once `keep` names any folder, only those play, and a `prefer` folder replaces every other
 * voice of its group (mergeBanks), bundled ones too.
 */
export function libraryBank(base, entries = [], { keep: kept = [], reject = [], family: refile = {}, prefer = [] } = {}) {
  const voices = new Map(), keep = new Map(), only = new Set(kept ?? []), drop = new Set(reject ?? []), preferred = new Set(prefer ?? []);
  for (const { folder, use, files } of entries ?? []) {
    if (!USES.has(use) || !files?.length || drop.has(folder) || only.size && !only.has(folder)) continue;
    const family = refile?.[folder] || folderFamily(folder);
    if (!family) continue;
    // One sample rate per recording: the first folder seen for it.
    const key = String(folder).replace(RATE, '');
    if (keep.has(key) && keep.get(key) !== folder) continue;
    keep.set(key, folder);
    // A humanoid creature library cuts one performer's style into size and length folders ("Animalistic", "Animalistic
    // Medium", "Animalistic Small"), each with only some cries: together they are one voice.
    const performer = /\bCREATURE\b/.test(key) ? key.replace(/\s+B00M\b.*$/i, '').replace(/\s+(Large|Medium|Small|Long)\b/gi, '') : key;
    const voice = voices.get(performer) ?? { family, voice: { folder, ...(preferred.has(folder) ? { prefer: true } : {}) } };
    voice.voice[use] = [...(voice.voice[use] ?? []), ...files.map((f) => [base, folder, use, f].filter(Boolean).join('/'))];
    voices.set(performer, voice);
  }
  const bank = {};
  for (const { family, voice } of voices.values()) (bank[family] ??= []).push(voice);
  return bank;
}

// A folder named for its creature's size ("Huge Dragon", "Small Wild Boar") suits creatures of about that size.
const SIZE_WORD = { tiny: -2, small: -1, medium: 0, large: 1, huge: 2, gargantuan: 3 };
function sizeOfFolder(folder) {
  const s = SIZE_WORD[/^(tiny|small|medium|large|huge|gargantuan)\b/i.exec(String(folder))?.[1]?.toLowerCase()];
  return s === undefined ? null : [Math.max(-2, s - 1), Math.min(3, s + 1)];
}

/**
 * A scanned library (libraryBank) as profiled voices, each suiting its group and the broader ones it falls back to,
 * the size its folder names and the gender of a FEMALE or MALE creature library voice.
 */
export function libraryVoices(library) {
  const out = [];
  for (const [family, voices] of Object.entries(library ?? {})) for (const v of voices) {
    const size = sizeOfFolder(v.folder), gender = /\bFEMALE\b/.test(v.folder) ? 'woman' : /\bMALE\b/.test(v.folder) ? 'man' : null;
    out.push({ id: `library/${v.folder}`, label: v.folder, suits: voiceLineage(family), ...(size ? { size } : {}), ...(gender ? { gender } : {}),
      ...(v.prefer ? { prefer: true } : {}), ...Object.fromEntries(['attack', 'hurt', 'death'].filter((u) => v[u]?.length).map((u) => [u, v[u]])) });
  }
  return out;
}

const sameName = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '');
/** The bundled voices with the library's added (a library voice that is a bundled one, by name, once). Neither changes.
 *  Only complete voices come in: one missing an attack, hurt or death cry would repeat another for it. A folder Animater
 *  already ships (`shipped`, its name without the sample rate) adds nothing: its voice is there under a plain name. */
export function mergeBanks(bundled, library, shipped = []) {
  const ships = new Set((shipped ?? []).map((f) => sameName(String(f).replace(RATE, ''))));
  const extra = libraryVoices(library).filter((v) => ['attack', 'hurt', 'death'].every((u) => v[u]?.length) && !ships.has(sameName(String(v.label).replace(RATE, ''))));
  if (!extra.length) return bundled;
  const have = new Set((bundled ?? []).map((v) => sameName(v.label)));
  return [...(bundled ?? []), ...extra.filter((v) => !have.has(sameName(v.label)))];
}
