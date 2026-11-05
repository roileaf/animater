// Outside combat: tables that explore between fights can calm Animater down until initiative is rolled. Auras
// (a 30 to 90 foot ring on the map) can go subtle or hide; footsteps can go quieter (half as loud, heard only up
// close) or silent; the wounded can stop dripping blood. "In combat" is a started encounter on the viewed scene (Foundry's game.combat).

export const AURAS_OUTSIDE_COMBAT = Object.freeze({ show: "Show them", subtle: "Subtle (smaller, fainter, calmer)", hidden: "Hide them until combat" });
export const STEPS_OUTSIDE_COMBAT = Object.freeze({ normal: "Normal", quieter: "Quieter (half volume, heard within 3 squares)", off: "Off" });

export const BLOOD_DROPS = Object.freeze({ always: "Always", combat: "Only in combat", never: "Never" });

export const inCombat = (combat) => combat?.started === true;

// How an aura shows right now: 'show', 'subtle' or 'hidden'. In combat it always shows.
export function auraCalm(choice, combat) {
  if (inCombat(combat)) return "show";
  return Object.hasOwn(AURAS_OUTSIDE_COMBAT, choice) ? choice : "show";
}

// Footsteps right now: { gain, range } (range null keeps "Footstep hearing range"). In combat they are unchanged.
export function stepCalm(choice, combat) {
  if (inCombat(combat)) return { gain: 1, range: null };
  if (choice === "off") return { gain: 0, range: null };
  if (choice === "quieter") return { gain: 0.5, range: "close" };
  return { gain: 1, range: null };
}

// Whether the wounded drip blood right now. An unknown choice drips, as it always has.
export function bloodDropsNow(choice, combat) {
  if (choice === "never") return false;
  return choice !== "combat" || inCombat(combat);
}

// An aura's own look: PF2e's prepared aura on its emitter, or a catalog look drawn at an aura's radius. An ally
// inside someone else's aura gets a token-sized copy, which is not the ring and stays.
export function isAuraLook(item, recipe, { granted = false } = {}) {
  if (item?.animaterAura) return true;
  return !granted && Boolean(recipe?.stages?.some((s) => s?.persist && Number(s.auraRadius) > 0));
}
