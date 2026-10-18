// Lasting conditions shown on the creature itself with Tokenshade, quietly, instead of a
// looping JB2A animation around it. Every condition the catalogs list has one, so a world
// can show conditions with Tokenshade or with JB2A only. Names cover PF2e, SF2e, D&D 5e
// and Daggerheart.
const LOOKS = {
  petrified: 'Petrified',
  drained: 'Drained Colour', enfeebled: 'Drained Colour', fatigued: 'Drained Colour', exhaustion: 'Drained Colour', exhausted: 'Drained Colour',
  dying: 'Fading', unconscious: 'Fading',
  doomed: 'Doom', cursebound: 'Doom',
  sickened: 'Sickly', poisoned: 'Sickly',
  frightened: 'Wintry Pallor', fleeing: 'Wintry Pallor',
  confused: 'Muddled', stupefied: 'Muddled',
  controlled: 'Dominated', charmed: 'Dominated',
  dazzled: 'Dazzled',
  paralyzed: 'Paralyzed',
  restrained: 'Bound',
  concealed: 'Haze', hidden: 'Haze',
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
  'off-guard': 'Exposed', 'flat-footed': 'Exposed', vulnerable: 'Exposed', marked: 'Exposed', surprised: 'Exposed',
  prone: 'Prone',
  stunned: 'Dazed', incapacitated: 'Dazed',
  slowed: 'Sluggish',
  helpful: 'Attitude: Helpful', friendly: 'Attitude: Friendly', indifferent: 'Attitude: Indifferent', unfriendly: 'Attitude: Unfriendly', hostile: 'Attitude: Hostile',
  observed: 'Observed',
  undetected: 'Unnoticed', unnoticed: 'Unnoticed',
  wounded: 'Bleeding', bleeding: 'Bleeding', bloodied: 'Bleeding',
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
  diseased: 'Sickly',
  dehydration: 'Drained Colour', malnutrition: 'Drained Colour',
  suffocation: 'Suffocating',
  falling: 'Long Shadow',
  transformed: 'Shifting',
};
// Persistent damage: that damage type's own look, at reduced strength.
const DAMAGE = {
  fire: 'Burning', cold: 'Frostbitten', electricity: 'Electrocuted', lightning: 'Electrocuted', acid: 'Corroding',
  poison: 'Envenomed', void: 'Withering', necrotic: 'Withering', vitality: 'Radiant Burn', radiant: 'Radiant Burn',
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
export const CONDITION_LOOK_PRESETS = [...new Set([...Object.values(LOOKS), ...Object.values(DAMAGE)])];
