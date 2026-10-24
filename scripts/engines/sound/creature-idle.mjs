// Creature idle sounds: with PF2e Creature Sounds active, a Large or bigger NPC sometimes voices a growl or a breath as
// its own combat turn starts. Every client decides alone from the same combat update, so the chance is seeded by the
// combat, round and turn and every screen agrees without a broadcast. Pure: main.mjs reads Foundry and plays it.
//
// PF2e Creature Sounds keeps no public API: its sound sets are object literals in its bundle
// (modules/pf2e-creature-sounds/dist/pf2e-creature-sounds.js), each with display_name, attack_sounds, hurt_sounds,
// death_sounds, creatures (exact names), keywords (words in a name), traits and size (0 tiny .. 5 gargantuan); an actor
// may pick one by id in flags['pf2e-creature-sounds'].soundset ('none': silent), and the GM's own sets live in its
// world setting 'custom_sound_sets'. This reads that data only; nothing of it is changed.

export const IDLE_CHANCE = 0.35;
// Large (weight 3) and up.
export const IDLE_FROM_WEIGHT = 3;

// FNV-1a over the text, as a number in [0, 1).
export function seeded(text) {
  let h = 0x811c9dc5;
  for (const c of String(text ?? '')) { h ^= c.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return h / 4294967296;
}

/** Whether this turn's creature voices an idle sound: the same answer on every client for the same combat turn. */
export function voicesThisTurn({ combatId, round, turn, chance = IDLE_CHANCE } = {}) {
  if (!combatId || !Number.isFinite(Number(round)) || !Number.isFinite(Number(turn))) return false;
  return seeded(`${combatId}:${round}:${turn}:idle`) < chance;
}

const isStrings = (v) => Array.isArray(v) && v.every((s) => typeof s === 'string');
const isSet = (v) => v && typeof v === 'object' && isStrings(v.attack_sounds ?? []) && isStrings(v.hurt_sounds ?? []);

/**
 * The sound sets in PF2e Creature Sounds' bundle text, by id: `const Dragon = { display_name: ..., size: 4 }` (id
 * Dragon) and inline `"Female Creature": { ... }` entries. Blocks that do not read as plain data are skipped.
 */
export function parseCreatureSoundDb(text) {
  const db = {};
  if (typeof text !== 'string') return db;
  const block = /(?:const\s+([A-Za-z_$][\w$]*)\s*=\s*|(?:^|[\n,{])\s*(?:"([^"\n]+)"|([A-Za-z_$][\w$]*))\s*:\s*)(\{\s*display_name\s*:[^{}]*\})/g;
  for (const m of text.matchAll(block)) {
    const id = m[1] ?? m[2] ?? m[3];
    // Its keys quoted, so it reads as JSON (the bundle's strings are double-quoted).
    const json = m[4].replace(/([{,]\s*)([A-Za-z_$][\w$]*)\s*:/g, '$1"$2":').replace(/,\s*([}\]])/g, '$1');
    try {
      const set = JSON.parse(json);
      if (id && isSet(set) && !(id in db)) db[id] = { ...set, id };
    } catch { /* not plain data: skipped */ }
  }
  return db;
}

const words = (s) => String(s ?? '').toLowerCase();
const wholeWord = (name, word) => {
  const w = words(word).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return w && new RegExp(`\\b${w}\\b`, 'i').test(name);
};

/**
 * The sound set for a creature: its own choice (`chosen`, 'none' for silence), else a set naming it exactly, else the
 * set whose keywords are in its name and whose traits and size fit it best (a tie broken by `seed`, the same on every
 * screen). `traits` its trait slugs, `size` 0 tiny .. 5 gargantuan. Null for none.
 */
export function pickSoundSet({ name = '', chosen = null, traits = [], size = -1, seed = '' } = {}, db = {}, custom = {}) {
  if (chosen === 'none') return null;
  if (chosen && db?.[chosen]) return db[chosen];
  if (chosen && isSet(custom?.[chosen])) return custom[chosen];
  const lower = words(name), sets = Object.values(db ?? {});
  const exact = sets.find((s) => (s.creatures ?? []).some((c) => words(c) === lower));
  if (exact) return exact;
  const own = new Set((traits ?? []).map(words));
  let best = [], top = 1;
  for (const set of sets) {
    let score = 0;
    for (const k of set.keywords ?? []) if (wholeWord(lower, k)) score += 5;
    let fit = 0;
    for (const t of set.traits ?? []) {
      if (Array.isArray(t)) { if (t.length && t.every((x) => own.has(words(x)))) fit += 1 + (t.length - 1) * 0.1; }
      else if (own.has(words(t))) fit += t === 'male' || t === 'female' ? 0.5 : 1;
    }
    if (fit > 0) score += Math.min(2, 0.9 + 0.3 * fit);
    if (score > 0 && Number(set.size) >= 0 && Number(size) >= 0) score += (2 - Math.abs(Number(size) - Number(set.size))) / 10;
    if (score > top + 1e-9) { top = score; best = [set]; } else if (Math.abs(score - top) <= 1e-9 && score > 1) best.push(set);
  }
  if (!best.length) return null;
  return best[Math.floor(seeded(`${seed}:set`) * best.length)];
}

/** The growl a set gives for an idle turn (its attack voice), chosen by `seed`; null when it has none. */
export function idleSoundFile(set, seed = '') {
  const files = (set?.attack_sounds ?? []).filter((f) => typeof f === 'string' && f);
  if (!files.length) return null;
  return files[Math.floor(seeded(`${seed}:file`) * files.length)];
}

/**
 * An idle voice's pitch and level for a creature of `weight` (stepWeight): lower and a little louder the heavier, as
 * its footsteps are (Large about 0.95x, Gargantuan about 0.8x), a few percent of seeded wander, modest in level.
 */
export function idleShape(weight, seed = '') {
  const w = Math.min(5.75, Math.max(IDLE_FROM_WEIGHT, Number(weight) || IDLE_FROM_WEIGHT));
  const wander = (seeded(`${seed}:rate`) - 0.5) * 0.06;
  const rate = +Math.max(0.7, (0.95 - 0.06 * (w - 3)) * (1 + wander)).toFixed(3);
  const volume = +Math.min(0.75, 0.5 + 0.08 * (w - 3)).toFixed(3);
  return { rate, volume };
}
