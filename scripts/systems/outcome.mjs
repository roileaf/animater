import { rollPrivacy, modePrivacy, stricter, hidden } from "../core/privacy.mjs";
import { timedStages } from "../engines/playback/composition.mjs";
// Roll outcomes shape the animation: a miss flies wide and never lands on the target,
// a critical hit lands harder and knocks the target back further. Outcomes use PF2e's
// degrees of success; D&D 5e attack rolls are mapped onto them (see dnd5eAttackOutcome).
export const MISS = new Set(["failure", "criticalFailure"]);
export const CRIT_IMPACT_SCALE = 1.35;

const onTargets = (s) => s.subject === "targets" || ["impact"].includes(s.kind);
// JB2A melee weapon clips (a sword swing, an unarmed strike) are the weapon itself, not a hit
// landing: a miss still swings them through the air, and they turn to come from the attacker.
export const meleeClip = (key) => /(^|\.)(melee(_attack)?|unarmed_strike)(\.|$)/.test(String(key ?? ""));
const swing = (s) => s.kind === "impact" && s.subject !== "targets" && s.assets?.some(meleeClip);
const isDodge = (s) => s.kind === "motion" && s.subject === "targets" && s.motion === "dodge";
// The same side on every client: it follows the message, not a random draw.
export const sideOf = (seed) => [...String(seed ?? "")].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % 2 ? -1 : 1;
const DODGE = { duration: 700, lead: 230 };
// How far into each JB2A melee clip the blow lands (its reach first gets 80% of the way from
// rest to its furthest point), measured from the clips; other melee clips land about halfway.
const MELEE_HIT = {"club":0.55,"dagger":0.56,"falchion":0.47,"genericslash":0.19,"genericwhirlwind":0.3,"glaive":0.39,"greataxe":0.63,"greatclub":0.59,"greatsword":0.63,"halberd":0.39,"hammer":0.55,"handaxe":0.71,"lasersword":0.47,"mace":0.55,"maul":0.6,"melee_attack.01":0.35,"melee_attack.02":0.35,"melee_attack.03":0.39,"melee_attack.04":0.36,"melee_attack.05":0.29,"melee_attack.06":0.38,"quarterstaff":0.39,"rapier":0.47,"scimitar":0.45,"shortsword":0.47,"spear":0.39,"sword":0.47,"unarmed_strike":0.43,"warhammer":0.55,"wrench":0.55};
export function meleeHit(key) {
  const [, family = "", n = ""] = String(key ?? "").match(/^jb2a\.([a-z_]+)(?:\.(\d\d))?/) ?? [];
  return MELEE_HIT[family === "melee_attack" ? `melee_attack.${n}` : family.replace(/_/g, "")] ?? MELEE_HIT[family] ?? 0.5;
}
// The moment the attack reaches the target: a flight's arrival, else a swing's or impact's start.
function strikeTime(recipe) {
  const timed = timedStages(recipe);
  const flight = timed.find((s) => ["travel", "projectile"].includes(s.kind));
  // Where the flight's own hit is timed (an arrow's impact on the target), that is when it arrives.
  const arrival = flight && timed.find((s) => s.kind === "impact" && onTargets(s) && s.delay >= flight.delay);
  if (arrival) return arrival.delay;
  if (flight) return flight.delay + Math.min(flight.duration, Number(flight.contact) > 0 ? Number(flight.contact) : flight.duration * 0.55);
  const blow = timed.find(swing);
  if (blow) return blow.delay + blow.duration * meleeHit(blow.assets.find(meleeClip));
  const hit = timed.find(onTargets);
  if (hit) return hit.delay;
  const gesture = timed.find((s) => s.kind === "motion" && s.subject === "source");
  return gesture ? gesture.delay + gesture.duration * 0.45 : null;
}

export function withOutcome(recipe, { outcome, type, messageId, id } = {}) {
  if (!outcome || !recipe?.stages?.length) return recipe;
  if (MISS.has(outcome) && type === "attack") {
    // The flight still plays (bent wide by the runtime) and a melee swing still cuts the air;
    // nothing reaches the target, which dodges aside as the attack arrives.
    const strike = strikeTime(recipe);
    const dropped = new Set(recipe.stages.filter((s) => s.kind !== "sound" && onTargets(s) && !swing(s) && !isDodge(s)).map((s) => s.stageId));
    // A surface cue still sounds on a miss (a raised shield's block, a magical shield's ring): it keeps the blow's time.
    const at = (s) => dropped.has(s.afterStage) ? { ...s, afterStage: "", startMode: undefined, startRef: undefined, delay: Math.max(0, Math.round(strike ?? s.delay ?? 0)) } : s;
    let stages = recipe.stages.filter((s) => !dropped.has(s.stageId) && !(s.kind === "sound" && !s.surfaces && dropped.has(s.afterStage))).map((s) => (s.kind === "sound" && s.surfaces ? at(s) : s));
    if (strike !== null && !stages.some(isDodge))
      stages.push({ stageId: "miss-dodge", kind: "motion", motion: "dodge", subject: "targets", delay: Math.max(0, Math.round(strike - DODGE.lead)), duration: DODGE.duration, distance: 0.38, intensity: 0.85, motionArrival: 35, motionHold: 15, motionSide: sideOf(messageId ?? id), assets: [], label: "Target dodges", optionalTargets: true });
    // A critical failure is a fumble: the attacker stumbles as the attack goes astray.
    if (outcome === "criticalFailure" && !stages.some((s) => s.kind === "motion" && s.motion === "stagger" && s.subject === "source"))
      stages = [...stages.filter((s) => !(s.kind === "motion" && s.subject === "source")), { stageId: "fumble", kind: "motion", motion: "stagger", subject: "source", delay: 450, duration: 900, distance: 0.16, intensity: 0.6, assets: [], label: "Fumble" }];
    return stages.some((s) => s.kind !== "sound") ? { ...recipe, stages } : recipe;
  }
  if (outcome === "criticalSuccess") {
    const stages = recipe.stages.map((s) => {
      if (s.kind === "impact") return { ...s, scale: (s.scale ?? 1) * CRIT_IMPACT_SCALE };
      if (s.kind === "motion" && s.subject === "targets") return { ...s, intensity: Math.min(1, (s.intensity ?? 0.6) * 1.4), distance: Math.min(0.5, (s.distance ?? 0.16) * 1.4) };
      return s;
    });
    // A critical hit always rocks the target, even when the design had no reaction.
    const impact = stages.find((s) => s.kind === "impact");
    if (impact && !stages.some((s) => s.kind === "motion" && s.subject === "targets"))
      stages.push({ stageId: `${impact.stageId}-crit`, kind: "motion", motion: "stagger", subject: "targets", afterStage: impact.stageId, timingAnchor: "start", startOffset: 80, duration: 900, distance: 0.2, intensity: 0.8, assets: [], optionalTargets: true });
    return { ...recipe, stages };
  }
  return recipe;
}

// A creature's reaction to its own saving throw against a spell or effect, one per
// degree of success (D&D 5e saves only pass or fail).
const SAVE_REACTIONS = {
  criticalSuccess: { motion: "brace", duration: 900, distance: 0.1, intensity: 0.45, label: "Shrugs it off" },
  success: { motion: "shake", duration: 700, distance: 0.08, intensity: 0.35, label: "Resists" },
  failure: { motion: "stagger", duration: 900, distance: 0.16, intensity: 0.6, label: "Takes the brunt" },
  criticalFailure: { motion: "stagger", duration: 1100, distance: 0.26, intensity: 0.9, label: "Overwhelmed" },
  // A GM's private save: the creature braces, whatever the hidden roll was.
  hidden: { motion: "shake", duration: 700, distance: 0.06, intensity: 0.3, label: "Braces" },
};
export function saveReaction(outcome) {
  const r = SAVE_REACTIONS[outcome];
  if (!r) return null;
  return { id: `animater-save-${outcome}`, name: `Saving throw: ${r.label}`, trigger: "manual", stages: [{ stageId: "save", kind: "motion", subject: "source", assets: [], ...r }] };
}
// PF2e/SF2e: a saving-throw message against a spell or effect (not a plain roll).
export function twoeSaveOutcome(message, systemId = "pf2e") {
  const context = message?.flags?.[systemId]?.context;
  if (context?.type !== "saving-throw" || !SAVE_REACTIONS[context.outcome] || !context.origin) return null;
  const privacy = rollPrivacy(message);
  return hidden(privacy) ? null : privacy === "gm" ? "hidden" : context.outcome;
}
// D&D 5e: pass or fail against the save DC, when the roll knows it.
export function dnd5eSaveOutcome(rolls = [], { isGM = globalThis.game?.user?.isGM } = {}) {
  const roll = rolls[0], dc = Number(roll?.options?.target);
  if (!roll || !Number.isFinite(dc) || !Number.isFinite(Number(roll.total))) return null;
  const privacy = stricter(modePrivacy(roll.options?.rollMode, isGM), rollPrivacy(roll.parent, { isGM }));
  if (hidden(privacy)) return null;
  return privacy === "gm" ? "hidden" : Number(roll.total) >= dc ? "success" : "failure";
}

// D&D 5e, per target (several targets each against their own AC), by token id. Unknown ACs are left out.
export function dnd5eTargetOutcomes(rolls = [], targets = []) {
  const roll = rolls[0], total = Number(roll?.total);
  if (!roll) return {};
  return Object.fromEntries(targets.map((t) => {
    const id = String((typeof t === "string" ? t : t?.token ?? t?.uuid) ?? "").split(".").at(-1), ac = Number(t?.ac);
    const outcome = roll.isCritical ? "criticalSuccess" : roll.isFumble ? "criticalFailure" : Number.isFinite(ac) && Number.isFinite(total) ? (total >= ac ? "success" : "failure") : null;
    return [id, outcome];
  }).filter(([id, outcome]) => id && outcome));
}
// D&D 5e: a natural 20 is a critical hit, a natural 1 a miss; otherwise the total
// against the single target's AC decides (unknown with several targets or no AC).
export function dnd5eAttackOutcome(rolls = [], targets = []) {
  const roll = rolls[0];
  if (!roll) return null;
  if (roll.isCritical) return "criticalSuccess";
  if (roll.isFumble) return "criticalFailure";
  const ac = targets.length === 1 ? Number(targets[0]?.ac) : NaN;
  if (!Number.isFinite(ac) || !Number.isFinite(Number(roll.total))) return null;
  return Number(roll.total) >= ac ? "success" : "failure";
}
