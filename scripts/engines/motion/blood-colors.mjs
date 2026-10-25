// Blood colours: what each kind of creature bleeds when Splatter is not deciding (lens blood, blood drops on the
// ground, the damage showcase). A default table by creature type, the GM's overrides (world setting "bloodColors",
// edited in the Blood colours menu) over it, and a token's own override (Token configuration: flags.animater.bloodColor)
// over both. With Splatter active, its own rules win (integrations/splatter.mjs splatterBlood). Pure logic.

const MODULE = 'animater';
// Colours as '#rrggbb'. Living flesh is dark red; dragons a little brighter; aberrations a yellow-green ichor;
// insects and other vermin a paler green-yellow haemolymph; plants a green sap, fungi a dull olive; undead a thick,
// near-black ooze (only the ones with flesh: a skeleton has bones and no blood); fiends a deep, almost black red;
// celestials a faint gold; fey a dark violet. Constructs, elementals, oozes, spirits, incorporeal things and objects
// do not bleed (their colour is used only if the GM turns their blood on).
export const DEFAULT_BLOOD = Object.freeze({
  default: Object.freeze({ color: '#7a0d0d', bleeds: true }),
  humanoid: Object.freeze({ color: '#7a0d0d', bleeds: true }),
  giant: Object.freeze({ color: '#7a0d0d', bleeds: true }),
  animal: Object.freeze({ color: '#7a0d0d', bleeds: true }),
  beast: Object.freeze({ color: '#7a0d0d', bleeds: true }),
  monstrosity: Object.freeze({ color: '#7a0d0d', bleeds: true }),
  dragon: Object.freeze({ color: '#8a1010', bleeds: true }),
  aberration: Object.freeze({ color: '#9ab83a', bleeds: true }),
  insect: Object.freeze({ color: '#a5b52c', bleeds: true }),
  plant: Object.freeze({ color: '#4f7a2a', bleeds: true }),
  fungus: Object.freeze({ color: '#7a7a3a', bleeds: true }),
  undead: Object.freeze({ color: '#1c1410', bleeds: true }),
  fiend: Object.freeze({ color: '#3d0a0a', bleeds: true }),
  celestial: Object.freeze({ color: '#c9a64a', bleeds: true }),
  fey: Object.freeze({ color: '#6a2a7a', bleeds: true }),
  construct: Object.freeze({ color: '#3a3530', bleeds: false }),
  elemental: Object.freeze({ color: '#5a5a5a', bleeds: false }),
  ooze: Object.freeze({ color: '#6b8f2a', bleeds: false }),
  spirit: Object.freeze({ color: '#9aa8b8', bleeds: false }),
  incorporeal: Object.freeze({ color: '#9aa8b8', bleeds: false }),
  skeleton: Object.freeze({ color: '#d8d0bc', bleeds: false }),
  object: Object.freeze({ color: '#5a4a3a', bleeds: false }),
});
// The types in the order the Blood colours menu lists them, with their labels.
export const BLOOD_TYPES = Object.freeze([
  ['humanoid', 'Humanoid'], ['giant', 'Giant'], ['animal', 'Animal'], ['beast', 'Beast'], ['monstrosity', 'Monstrosity'],
  ['dragon', 'Dragon'], ['aberration', 'Aberration'], ['insect', 'Insect and vermin'], ['plant', 'Plant'], ['fungus', 'Fungus'],
  ['undead', 'Undead (with flesh)'], ['skeleton', 'Skeleton'], ['fiend', 'Fiend'], ['celestial', 'Celestial'], ['fey', 'Fey'],
  ['construct', 'Construct'], ['elemental', 'Elemental'], ['ooze', 'Ooze'], ['spirit', 'Spirit'], ['incorporeal', 'Incorporeal'],
  ['object', 'Object, hazard or vehicle'], ['default', 'Default (any other creature)'],
].map(([key, label]) => Object.freeze({ key, label })));

const lower = (v) => String(v ?? '').trim().toLowerCase();
const list = (v) => (Array.isArray(v) || v instanceof Set ? [...v] : []);
// Actor types that are not creatures at all.
const NOT_CREATURES = new Set(['hazard', 'loot', 'party', 'army', 'group', 'encounter', 'environment', 'vehicle']);
// Traits and type words that name a table type.
const ALIASES = { demon: 'fiend', devil: 'fiend', daemon: 'fiend', angel: 'celestial', archon: 'celestial', azata: 'celestial',
  vermin: 'insect', insects: 'insect', golem: 'construct', ghost: 'incorporeal', beasts: 'beast' };
const keyOf = (word) => { const w = lower(word); const k = ALIASES[w] ?? w; return Object.hasOwn(DEFAULT_BLOOD, k) && k !== 'default' ? k : null; };
// When a creature has several traits, the first of these it has decides: what makes a body bloodless first (a
// skeleton is undead but has no blood; a ghost is undead and incorporeal), then what changes the blood, then the
// broad bodies.
const PRIORITY = ['object', 'skeleton', 'incorporeal', 'spirit', 'construct', 'ooze', 'elemental', 'fungus', 'plant', 'undead',
  'fiend', 'celestial', 'aberration', 'dragon', 'insect', 'fey', 'giant', 'monstrosity', 'beast', 'animal', 'humanoid'];
// Name words: [pattern, type, the types the name may refine besides 'default'] (a D&D "Giant Spider" is a beast with
// insect blood, a D&D "Skeleton" undead with none; a humanoid named "Spider Cultist" stays humanoid).
const BROAD = ['beast', 'animal', 'monstrosity'];
const NAME_RULES = [
  [/\bskelet/i, 'skeleton', ['undead']],
  [/\b(?:ghosts?|wraiths?|specters?|spectres?|shades?|phantoms?|poltergeists?|banshees?)\b/i, 'incorporeal', ['undead']],
  [/\b(?:zombies?|ghouls?|ghasts?|vampires?|vampiric|mummy|mummies|wights?|revenants?|liche?s?|draugr)\b/i, 'undead', []],
  [/\b(?:golems?|automatons?|clockwork|animated (?:armou?r|statue|object|broom))\b/i, 'construct', []],
  [/\b(?:oozes?|slimes?|puddings?|jelly|jellies|gelatinous)\b/i, 'ooze', []],
  [/\belementals?\b/i, 'elemental', []],
  [/\b(?:spiders?|insects?|beetles?|ants?|wasps?|bees?|hornets?|scorpions?|centipedes?|mantis|mantises|ticks?|locusts?|flies|mosquito(?:e?s)?|roach(?:es)?|cockroach(?:es)?|ankhegs?|vermin|maggots?|larva[e]?|grubs?)\b/i, 'insect', BROAD],
  [/\b(?:fung(?:us|i)|mushrooms?|myconids?|molds?|moulds?|shriekers?)\b/i, 'fungus', BROAD],
  [/\b(?:treants?|trees?|shambling mound|vines?|blights?|dryads?|leshys?)\b/i, 'plant', BROAD],
  [/\b(?:dragons?|drakes?|wyrms?|wyrmlings?|wyverns?)\b/i, 'dragon', BROAD],
  [/\b(?:demons?|devils?|fiends?|imps?|daemons?)\b/i, 'fiend', []],
  [/\b(?:angels?|celestials?|archons?|devas?|planetars?|solars?)\b/i, 'celestial', []],
  [/\b(?:pixies?|sprites?|satyrs?|fey|faerie|fairy|fairies)\b/i, 'fey', []],
  [/\b(?:giants?|ogres?|trolls?)\b/i, 'giant', []],
];
const byName = (name, current) => {
  const text = String(name ?? '');
  if (!text) return null;
  for (const [pattern, type, from] of NAME_RULES) if (pattern.test(text) && (current === 'default' || from.includes(current))) return type;
  return null;
};
// D&D 5e (and alike): system.details.type as { value, subtype, custom } or a plain string.
function dndType(details) {
  const t = details?.type;
  if (!t) return null;
  if (typeof t === 'string') return keyOf(t);
  return keyOf(t.value) ?? keyOf(t.custom) ?? byName(t.custom, 'default') ?? keyOf(t.subtype) ?? byName(t.subtype, 'default');
}

// The table type a creature's blood follows: its PF2e/SF2e traits in PRIORITY order, else its D&D type, else
// 'default'; then its name may refine it (NAME_RULES). Daggerheart has no creature types: names only. Things that are
// not creatures (hazards, loot, vehicles) are 'object'. system: game.system.id; name: the token's name (else the
// actor's).
export function creatureBloodType({ system, actor, name } = {}) {
  if (actor && NOT_CREATURES.has(lower(actor.type))) return 'object';
  const sys = actor?.system ?? {}, dh = system === 'daggerheart';
  let type = null;
  if (!dh) {
    const keys = new Set(list(sys.traits?.value).map(keyOf).filter(Boolean));
    type = PRIORITY.find((k) => keys.has(k)) ?? dndType(sys.details);
  }
  type ??= 'default';
  return byName(name ?? actor?.name, type) ?? byName(actor?.name, type) ?? type;
}

// Types with no beating heart: the dead (undead, skeletons), the made (constructs, objects), bodies of element, slime or
// spirit, and plants and fungi. A player's own creature of these is never given a heartbeat (lens blood and tunnel
// vision still follow its blood and HP).
export const HEARTLESS = Object.freeze(new Set(['undead', 'skeleton', 'construct', 'elemental', 'ooze', 'spirit', 'incorporeal', 'object', 'plant', 'fungus']));
export const creatureHasHeart = (type) => !HEARTLESS.has(type);

// '#rrggbb' (or '#rrggbbaa', 'rrggbb') as a number, else null; a number back as '#rrggbb'.
export function colorNumber(text) {
  const m = /^#?([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(String(text ?? '').trim());
  return m ? parseInt(m[1], 16) : null;
}
export const colorHex = (n) => `#${((Number(n) >>> 0) & 0xffffff).toString(16).padStart(6, '0')}`;
const hexOf = (text) => { const n = colorNumber(text); return n === null || /^#?[0-9a-f]{8}$/i.test(String(text).trim()) ? null : colorHex(n); };

// The saved overrides with only what can be used: known types, '#rrggbb' colours (lower case) and booleans.
export function normalizeBloodTable(saved) {
  const out = {};
  if (!saved || typeof saved !== 'object') return out;
  for (const key of Object.keys(DEFAULT_BLOOD)) {
    if (!Object.hasOwn(saved, key)) continue;
    const v = saved[key];
    if (!v || typeof v !== 'object') continue;
    const entry = {}, color = hexOf(v.color);
    if (color) entry.color = color;
    if (typeof v.bleeds === 'boolean') entry.bleeds = v.bleeds;
    if (Object.keys(entry).length) out[key] = entry;
  }
  return out;
}
// One type's blood with the GM's overrides over the defaults.
export function tableBlood(type, table = {}) {
  const t = normalizeBloodTable(table), key = Object.hasOwn(DEFAULT_BLOOD, type) ? type : 'default';
  return { ...DEFAULT_BLOOD[key], ...(t[key] ?? {}) };
}

// A creature's blood { bleeds, color (number), type }: the token's Animater override ('none' for no blood, a
// '#rrggbb' colour; '' or anything else is by type), then its Splatter colour flag (alpha 0 is no blood), then the
// GM's table for its type over the defaults.
export function bloodFor({ system, actor, name, tokenFlags, table } = {}) {
  const type = creatureBloodType({ system, actor, name });
  const own = lower(tokenFlags?.[MODULE]?.bloodColor);
  if (own === 'none') return { bleeds: false, color: colorNumber(tableBlood(type, table).color), type };
  const ownColor = colorNumber(own);
  if (ownColor !== null && /^#?[0-9a-f]{6}$/.test(own)) return { bleeds: true, color: ownColor, type };
  const splat = /^#?([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(String(tokenFlags?.splatter?.bloodColor ?? '').trim());
  if (splat) return { bleeds: !(splat[2] && parseInt(splat[2], 16) === 0), color: parseInt(splat[1], 16), type };
  const entry = tableBlood(type, table);
  return { bleeds: entry.bleeds, color: colorNumber(entry.color), type };
}
