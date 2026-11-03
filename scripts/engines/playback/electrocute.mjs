// A creature struck by electricity convulses (motion.mjs "electrocute") instead of the plain hit shake or recoil its
// recipe was written with: every catalog's lightning spells and electric breath, whatever stage wrote the reaction.
// A recipe written with no reaction on its targets gets a convulsion as its lightning lands. Only the struck
// targets' reactions change; the caster's own gestures stay as designed.
import { normalizeElement } from "../../catalogs/shared/element-choice.mjs";

const REACTIONS = new Set(["shake", "recoil"]);
// Long and strong enough for its three bursts to read: a 0.5 shake would twitch by a pixel or two.
const MIN_MS = 1100, MIN_INTENSITY = 0.8;
const FLIGHTS = new Set(["travel", "projectile"]);

export function withElectrocution(recipe, element) {
  if (normalizeElement(element) !== "electricity" || !recipe?.stages?.length) return recipe;
  if (recipe.stages.some(isReaction)) {
    return {
      ...recipe,
      stages: recipe.stages.map((s) => isReaction(s)
        ? { ...s, motion: "electrocute", duration: Math.max(MIN_MS, Number(s.duration) || 0), intensity: Math.max(MIN_INTENSITY, Number(s.intensity) || 0) }
        : s),
    };
  }
  // Already convulsing (a recipe written with it), or with nothing on its targets: as it is.
  if (recipe.stages.some((s) => s?.kind === "motion" && s.subject === "targets")) return recipe;
  const at = landing(recipe.stages);
  if (!at) return recipe;
  return { ...recipe, stages: [...recipe.stages, { stageId: "animater-electrocute", kind: "motion", motion: "electrocute", subject: "targets", duration: MIN_MS, intensity: MIN_INTENSITY, assets: [], ...at }] };
}
const isReaction = (s) => s?.kind === "motion" && s.subject === "targets" && REACTIONS.has(s.motion);

// When the lightning lands on its targets, as a stage's timing: with its first impact (each target as its own
// impact plays), else as its first area strikes, else as its first flight arrives (its contact, or 55% in).
function landing(stages) {
  const timing = (s) => ({
    delay: s.delay ?? 0,
    ...(s.afterStage ? { afterStage: s.afterStage, timingAnchor: s.timingAnchor, startOffset: s.startOffset } : {}),
    ...(s.targetStagger ? { targetStagger: s.targetStagger } : {}),
  });
  const impact = stages.find((s) => s?.kind === "impact");
  if (impact) return timing(impact);
  const area = stages.find((s) => s?.kind === "template");
  if (area) return timing(area);
  const flight = stages.find((s) => FLIGHTS.has(s?.kind) && s.stageId);
  if (!flight) return null;
  const arrival = Number(flight.contact) > 0 ? Number(flight.contact) : Math.round(0.55 * (Number(flight.duration) || 0));
  return { delay: 0, afterStage: flight.stageId, timingAnchor: "start", startOffset: arrival, ...(flight.targetStagger ? { targetStagger: flight.targetStagger } : {}) };
}
