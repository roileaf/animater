// A notable kill plays in slow motion: the last enemy, a critical kill, or a boss-level foe.
// Each system ranks its creatures its own way; a boss is measured against the party in the combat.

const TWOE = ['pf2e', 'sf2e'];
const BOSS_TYPES = ['solo', 'leader'];
const number = (v) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : undefined);

// How strong the killed creature is: a level (PF2e/SF2e), a CR (D&D 5e) or an adversary type (Daggerheart).
export function creatureRank(actor, systemId) {
  if (!actor) return {};
  if (TWOE.includes(systemId)) {
    const level = number(actor.level ?? actor.system?.details?.level?.value);
    return level === undefined ? {} : { level };
  }
  if (systemId === 'dnd5e') {
    const cr = number(actor.system?.details?.cr);
    return cr === undefined ? {} : { cr };
  }
  if (systemId === 'daggerheart') {
    const adversaryType = actor.system?.type;
    return typeof adversaryType === 'string' && adversaryType ? { adversaryType } : {};
  }
  return {};
}

// A player character's level in each system.
function characterLevel(actor, systemId) {
  if (TWOE.includes(systemId)) return number(actor.level ?? actor.system?.details?.level?.value);
  if (systemId === 'dnd5e') return number(actor.system?.details?.level);
  if (systemId === 'daggerheart') return number(actor.system?.levelData?.level?.current ?? actor.system?.level);
  return undefined;
}

// Levels of the player-owned characters fighting in this combat.
export function partyLevels(combat, systemId) {
  return Array.from(combat?.combatants ?? []).flatMap((c) => {
    const actor = c?.actor;
    if (!actor?.hasPlayerOwner || actor.type !== 'character') return [];
    const level = characterLevel(actor, systemId);
    return level === undefined ? [] : [level];
  });
}

// Boss-level: clearly above the party (none in the combat: never a boss).
function isBoss(rank = {}, levels = [], systemId) {
  if (!levels.length) return false;
  const avg = levels.reduce((sum, l) => sum + l, 0) / levels.length;
  if (TWOE.includes(systemId)) return rank.level !== undefined && rank.level >= avg + 2;
  if (systemId === 'dnd5e') return rank.cr !== undefined && rank.cr >= avg;
  if (systemId === 'daggerheart') return BOSS_TYPES.includes(rank.adversaryType);
  return false;
}

export function isNotableKill({ finalEnemy = false, crit = false, rank = {}, partyLevels: levels = [], systemId } = {}) {
  return Boolean(finalEnemy || crit || isBoss(rank, levels, systemId));
}
