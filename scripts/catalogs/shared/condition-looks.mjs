// Lasting conditions shown on the creature itself with Tokenshade, quietly, instead of a
// looping JB2A animation around it. Conditions whose meaning is best said by a symbol
// (stunned stars, a muted ear, chains, a cracked shield, attitude rings) keep their JB2A
// marker and are not listed here. Names cover PF2e, SF2e and D&D 5e.
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
};
// Persistent damage: that damage type's own look, at reduced strength.
const DAMAGE = {
  fire: 'Burning', cold: 'Frostbitten', electricity: 'Electrocuted', lightning: 'Electrocuted', acid: 'Corroding',
  poison: 'Envenomed', void: 'Withering', necrotic: 'Withering', vitality: 'Radiant Burn', radiant: 'Radiant Burn',
  force: 'Force Jolt', mental: 'Psychic Warp', psychic: 'Psychic Warp', sonic: 'Resonance', thunder: 'Resonance', spirit: 'Spirit Rend',
};

const key = entry => String(entry?.slug ?? entry?.name ?? '').toLowerCase()
  .replace(/^(?:condition|effect)\s*:\s*/, '').replace(/\s+\d+$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// The Tokenshade look for a lasting condition, or null to keep its JB2A layers.
export function conditionLook(entry, { damageType } = {}) {
  const k = key(entry);
  if (k === 'persistent-damage') {
    const preset = DAMAGE[String(damageType ?? '').toLowerCase()];
    return preset ? { preset, strength: 0.6 } : null;
  }
  const preset = LOOKS[k] ?? LOOKS[k.replace(/-/g, ' ')];
  return preset ? { preset, strength: 1 } : null;
}
// How strong a valued condition (Frightened 1–4…) shows: quieter at 1, full at 4.
export const conditionLookStrength = level => (level ? [0.55, 0.7, 0.85, 1][Math.min(4, level) - 1] : 1);
export const CONDITION_LOOK_PRESETS = [...new Set([...Object.values(LOOKS), ...Object.values(DAMAGE)])];
