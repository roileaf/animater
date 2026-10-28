// A creature struck by electricity convulses (motion.mjs "electrocute") instead of the plain hit shake or recoil its
// recipe was written with: every catalog's lightning spells and electric breath, whatever stage wrote the reaction.
// Only the struck targets' reactions change; the caster's own gestures stay as designed.
import { normalizeElement } from "../../catalogs/shared/element-choice.mjs";

const REACTIONS = new Set(["shake", "recoil"]);
// Long and strong enough for its three bursts to read: a 0.5 shake would twitch by a pixel or two.
const MIN_MS = 1100, MIN_INTENSITY = 0.8;

export function withElectrocution(recipe, element) {
  if (normalizeElement(element) !== "electricity" || !recipe?.stages?.some(isReaction)) return recipe;
  return {
    ...recipe,
    stages: recipe.stages.map((s) => isReaction(s)
      ? { ...s, motion: "electrocute", duration: Math.max(MIN_MS, Number(s.duration) || 0), intensity: Math.max(MIN_INTENSITY, Number(s.intensity) || 0) }
      : s),
  };
}
const isReaction = (s) => s?.kind === "motion" && s.subject === "targets" && REACTIONS.has(s.motion);
