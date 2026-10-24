// Momentum: consecutive hits by the same attacker on the same target within one combat turn (or within
// 12 s outside combat) land harder, the 2nd at x1.1, the 3rd at x1.2, the 4th and later at x1.3. A miss
// resets that streak. PF2e/SF2e: the 3rd or later Strike of a turn (the multiple attack penalty at its
// maximum) that misses looks strained, the attacker's gesture slower with a small stumble after it.
// Pure: the clock and the combat turn are injected (runtime.mjs applies it right after withOutcome).
export const MOMENTUM_WINDOW_MS = 12000;
export const STRAINED_RATE = 0.85;
const LEVELS = [1, 1, 1.1, 1.2, 1.3];
const HITS = new Set(["success", "criticalSuccess"]);
const MISSES = new Set(["failure", "criticalFailure"]);
const NEUTRAL = Object.freeze({ factor: 1, strained: false });
const CACHE = 200;

export const multiplier = (level) => LEVELS[Math.min(LEVELS.length - 1, Math.max(0, Math.floor(Number(level) || 0)))];

const idOf = (t) => {
  if (!t) return null;
  if (typeof t === "string") return t.split(".").at(-1) || null;
  return t.document?.id ?? t.id ?? (typeof t.uuid === "string" ? t.uuid.split(".").at(-1) : null) ?? null;
};
// Who strikes whom, and each target's outcome (its own, else the roll's).
export function strikeOf(context = {}) {
  const attacker = idOf(context.source) ?? context.tokenId ?? context.actor?.uuid ?? context.actor?.id ?? null;
  const listed = Array.isArray(context.targets) && context.targets.length ? context.targets
    : Array.isArray(context.targetUuids) && context.targetUuids.length ? context.targetUuids
      : context.targetUuid ? [context.targetUuid] : [];
  const ids = [...new Set(listed.map(idOf).filter(Boolean))];
  const own = context.targetOutcomes instanceof Map ? Object.fromEntries(context.targetOutcomes) : context.targetOutcomes ?? {};
  return { attacker, targets: ids.map((id) => ({ id, outcome: own[id] ?? context.outcome })) };
}
const strike = (context) => ["weapon", "melee"].includes(context.item?.type) || !!context.weaponMode && context.item?.type !== "spell";

export function createMomentum({ now = () => Date.now(), turnKey = () => null } = {}) {
  // `${attacker}>${target}` -> { count, turn, at }; attacker -> { turn, at, count } (Strikes this turn).
  const streaks = new Map(), strikes = new Map();
  // An attack already counted (riders and replays of one message), and each attacker's last attack, which a reroll replaces.
  const seen = new Map(), last = new Map();
  const fresh = (entry, turn, at) => !!entry && (turn != null ? entry.turn === turn : entry.turn == null && at - entry.at <= MOMENTUM_WINDOW_MS);
  const remember = (key, result) => {
    if (!key) return result;
    seen.set(key, result);
    if (seen.size > CACHE) seen.delete(seen.keys().next().value);
    return result;
  };
  function observe(context = {}) {
    if (!["attack", "damage"].includes(context.type)) return NEUTRAL;
    const { attacker, targets } = strikeOf(context);
    if (!attacker) return NEUTRAL;
    let turn = null;
    try { turn = turnKey() ?? null; } catch { turn = null; }
    const at = Number(now()) || 0;
    const pair = (id) => `${attacker}>${id}`;
    // A damage roll plays its strike at the level the attack reached, and counts nothing.
    if (context.type === "damage") {
      const factor = Math.max(1, ...targets.filter((t) => !MISSES.has(t.outcome)).map((t) => {
        const entry = streaks.get(pair(t.id));
        return fresh(entry, turn, at) ? multiplier(entry.count) : 1;
      }));
      return { factor, strained: false };
    }
    const key = context.id ?? context.messageId ?? null;
    if (key && seen.has(key)) return seen.get(key);
    const reroll = !!context.reroll && last.has(attacker);
    // A reroll takes the place of the attack it rerolls: that attack's changes are undone first.
    if (reroll) for (const [k, before] of last.get(attacker).undo) before ? streaks.set(k, before) : streaks.delete(k);
    const undo = new Map();
    let factor = 1;
    for (const t of targets) {
      const k = pair(t.id), entry = streaks.get(k);
      if (HITS.has(t.outcome)) {
        undo.set(k, entry);
        const count = fresh(entry, turn, at) ? entry.count + 1 : 1;
        streaks.set(k, { count, turn, at });
        factor = Math.max(factor, multiplier(count));
      } else if (MISSES.has(t.outcome)) {
        undo.set(k, entry);
        streaks.delete(k);
      }
    }
    last.set(attacker, { undo });
    // Strikes this turn, whatever their target (a reroll is the same Strike).
    const prior = strikes.get(attacker);
    const count = (fresh(prior, turn, at) ? prior.count : 0) + (reroll ? 0 : 1);
    strikes.set(attacker, { count: Math.max(1, count), turn, at });
    const twoe = ["pf2e", "sf2e"].includes(context.systemId);
    const missed = MISSES.has(context.outcome) || !context.outcome && targets.length > 0 && targets.every((t) => MISSES.has(t.outcome));
    const map = Number.isFinite(Number(context.mapIncreases)) && context.mapIncreases !== null && context.mapIncreases !== "" ? Number(context.mapIncreases) : null;
    const strained = twoe && strike(context) && missed && (map !== null ? map >= 2 : count >= 3);
    return remember(key, { factor, strained });
  }
  return { observe, clear: () => { streaks.clear(); strikes.clear(); seen.clear(); last.clear(); } };
}

// Impacts land bigger (their lights, marks and shock radius follow their scale), sounds louder (at most full volume).
// The distortion strength follows in the runtime, from the same factor.
export function applyMomentum(recipe, factor) {
  if (!(factor > 1) || !recipe?.stages?.length) return recipe;
  return { ...recipe, stages: recipe.stages.map((s) => {
    if (s.kind === "impact") return { ...s, scale: (s.scale ?? 1) * factor };
    if (s.kind === "sound" && Number.isFinite(Number(s.volume))) return { ...s, volume: Math.min(1, Number(s.volume) * factor) };
    return s;
  }) };
}

// A strained Strike: the attacker's own motions play slower, then the attacker stumbles a little
// (unless the attack already staggers it, as a fumble does).
export function applyStrain(recipe) {
  if (!recipe?.stages?.length) return recipe;
  const gesture = (s) => s.kind === "motion" && s.subject === "source";
  const stages = recipe.stages.map((s) => (gesture(s) ? { ...s, duration: Math.round((Number(s.duration) || 600) / STRAINED_RATE) } : s));
  if (!stages.some((s) => gesture(s) && s.motion === "stagger")) {
    const after = stages.filter(gesture).at(-1);
    stages.push({ stageId: "strained-stumble", kind: "motion", motion: "stagger", subject: "source", assets: [], label: "Strained",
      duration: 600, distance: 0.08, intensity: 0.35,
      ...(after ? { afterStage: after.stageId, timingAnchor: "end", startOffset: 0 } : { delay: 450 }) });
  }
  return { ...recipe, stages };
}
