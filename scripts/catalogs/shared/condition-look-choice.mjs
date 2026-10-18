// A conditions catalog's Look switch: conditions show on the creature with Tokenshade, or with
// JB2A animations only. One world setting (`conditionLooks`) for every system's catalog.
// Pure: no Foundry globals.
export const CONDITION_LOOK_CHOICES = Object.freeze({ tokenshade: "Tokenshade", jb2a: "JB2A" });
export const CONDITION_LOOK_HINT = "Tokenshade shows each condition quietly on the creature itself (pale, bound, glowing…). JB2A plays the condition's JB2A animation around it instead, with no Tokenshade filters.";
export const conditionLookMode = (value) => (value === "jb2a" ? "jb2a" : "tokenshade");
export const nextConditionLookMode = (value) => (conditionLookMode(value) === "jb2a" ? "tokenshade" : "jb2a");
export function conditionLookSwitchHTML(mode, { label = "Condition", disabled = false } = {}) {
  const current = conditionLookMode(mode);
  return `<div class="an-catalog-automation"><div><b>Condition look</b><small>${CONDITION_LOOK_HINT}</small></div><button role="switch" aria-checked="${current === "tokenshade"}" aria-label="${label} catalog condition look" class="${current === "tokenshade" ? "an-primary" : "an-quiet"}" data-action="condition-looks" ${disabled ? "disabled" : ""}>${CONDITION_LOOK_CHOICES[current]}</button></div>`;
}
