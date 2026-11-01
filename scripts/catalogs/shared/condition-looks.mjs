// Lasting conditions shown on the creature itself with Tokenshade, quietly, instead of a
// looping JB2A animation around it. Every condition the catalogs list has one, so a world
// can show conditions with Tokenshade or with JB2A only. Names cover PF2e, SF2e, D&D 5e
// and Daggerheart.
const LOOKS = {
  petrified: 'Petrified',
  drained: 'Drained Colour', enfeebled: 'Weakened', fatigued: 'Weary', exhaustion: 'Weary', exhausted: 'Weary',
  dying: 'Dying', unconscious: 'Sleeping',
  doomed: 'Doom', cursebound: 'Doom',
  sickened: 'Nauseated', poisoned: 'Sickly',
  frightened: 'Trembling', fleeing: 'Trembling',
  confused: 'Bewildered', stupefied: 'Muddled',
  controlled: 'Dominated', charmed: 'Smitten',
  dazzled: 'Dazzled',
  paralyzed: 'Paralyzed',
  restrained: 'Chained',
  concealed: 'Misted', hidden: 'Haze',
  invisible: 'Unseen',
  quickened: 'Quickened',
  glitching: 'Glitching',
  blinded: 'Blinded',
  deafened: 'Muffled', silenced: 'Muffled',
  broken: 'Cracked',
  clumsy: 'Unsteady',
  encumbered: 'Burdened', 'heavily-encumbered': 'Burdened', 'exceeding-carrying-capacity': 'Burdened', suppressed: 'Burdened',
  fascinated: 'Fascinated',
  grabbed: 'Held', grappled: 'Held',
  immobilized: 'Rooted',
  // Off-guard (and flat-footed) shows nothing: the PF2e catalog leaves it out (state-catalog.mjs).
  vulnerable: 'Exposed', marked: 'Exposed', surprised: 'Exposed',
  prone: 'Prone',
  stunned: 'Dazed', incapacitated: 'Dazed',
  slowed: 'Sluggish',
  helpful: 'Attitude: Helpful', friendly: 'Attitude: Friendly', indifferent: 'Attitude: Indifferent', unfriendly: 'Attitude: Unfriendly', hostile: 'Attitude: Hostile',
  observed: 'Observed',
  undetected: 'Unnoticed', unnoticed: 'Unnoticed',
  wounded: 'Wounded', bleeding: 'Bleeding', bloodied: 'Bleeding',
  untethered: 'Levitate', flying: 'Levitate', hovering: 'Levitate',
  dead: 'Lifeless', defeated: 'Lifeless', 'death-move': 'Fading',
  stable: 'Stable',
  sleeping: 'Sleeping',
  ethereal: 'Ethereal',
  concentrating: 'Focused',
  dodging: 'Evasive',
  hiding: 'Haze', 'half-cover': 'Haze', 'three-quarters-cover': 'Haze', 'total-cover': 'Unseen',
  burrowing: 'Mud-Caked',
  burning: 'Burning',
  cursed: 'Doom',
  diseased: 'Feverish',
  dehydration: 'Weary', malnutrition: 'Weakened',
  suffocation: 'Suffocating',
  falling: 'Long Shadow',
  transformed: 'Shifting',
};
// Persistent damage: that damage type's own look, at reduced strength.
const DAMAGE = {
  fire: 'Burning', cold: 'Frostbitten', electricity: 'Electrocuted', lightning: 'Electrocuted', acid: 'Corroding',
  poison: 'Poison in the veins', void: 'Withering', necrotic: 'Withering', vitality: 'Radiant Burn', radiant: 'Radiant Burn',
  force: 'Force Jolt', mental: 'Psychic Warp', psychic: 'Psychic Warp', sonic: 'Resonance', thunder: 'Resonance', spirit: 'Spirit Rend',
  bleed: 'Bleeding', piercing: 'Bleeding', slashing: 'Bleeding', bludgeoning: 'Bleeding', physical: 'Bleeding',
};

const key = entry => String(entry?.slug ?? entry?.name ?? '').toLowerCase()
  .replace(/^(?:condition|effect)\s*:\s*/, '').replace(/\s+\d+$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// The Tokenshade look for a lasting condition, or null to keep its JB2A layers.
export function conditionLook(entry, { damageType } = {}) {
  const k = key(entry);
  if (k === 'persistent-damage') {
    const preset = DAMAGE[String(damageType ?? '').toLowerCase()];
    return { preset: preset ?? 'Bleeding', strength: 0.6 };
  }
  const preset = LOOKS[k] ?? LOOKS[k.replace(/-/g, ' ')];
  return preset ? { preset, strength: 1 } : null;
}
// How strong a valued condition (Frightened 1–4…) shows: quieter at 1, full at 4.
export const conditionLookStrength = level => (level ? [0.55, 0.7, 0.85, 1][Math.min(4, level) - 1] : 1);
// Each look's conditions, by look ("Trembling": ['frightened', 'fleeing']; persistent damage as "persistent fire").
export const CONDITIONS_BY_LOOK = Object.entries(LOOKS).concat(Object.entries(DAMAGE).map(([type, look]) => [`persistent ${type}`, look]))
  .reduce((by, [condition, look]) => ({ ...by, [look]: [...(by[look] ?? []), condition] }), {});
export const CONDITION_LOOK_PRESETS = [...new Set([...Object.values(LOOKS), ...Object.values(DAMAGE)])];

// The transition a condition plays as it lands, before its lasting look (Tokenshade presets): stone creeping up a
// petrified creature, sickness spreading, doom taking hold, life draining, poison spreading through the veins.
// Each ends exactly as its condition's lasting look starts, so the handover never changes the creature's colour.
const TRANSITIONS = { petrified: 'Turn to stone', sickened: 'Nausea takes hold', doomed: 'Doom takes hold', drained: 'Drain takes hold' };
const PERSISTENT_TRANSITIONS = { poison: 'Poison spreads' };
export function conditionTransition(item) {
  const slug = String(item?.slug ?? item?.system?.slug ?? '').toLowerCase();
  if (slug === 'persistent-damage') return PERSISTENT_TRANSITIONS[String(item?.system?.persistent?.damageType ?? '').toLowerCase()] ?? null;
  return TRANSITIONS[slug] ?? null;
}
