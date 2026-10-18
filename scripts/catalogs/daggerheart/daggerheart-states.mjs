// Daggerheart conditions as lasting layers (PersistentStates host). Vulnerable, Hidden and Restrained
// are status effects on the actor; the defeated set (Defeated, Unconscious, Dead, Death move) follows the Defeated
// look setting through the built-in states; Death move is a moment dispatched on createActiveEffect.
// Other applied effects are listed so your own lasting recipes can attach to them.
import { dhEntries, dhRecipe, dhEntryEnabled, normalizeDhCatalogState } from "./daggerheart-catalog.mjs";
import { matchRecipe } from "../../core/model.mjs";
import { defeatedStates } from "../../engines/playback/defeated-look.mjs";

const byStatus = new Map(dhEntries("condition").filter((e) => e.state?.lasting).map((e) => [e.statusId, e]));
// The system's own defeated set (toggleDefeated, DH 2.10.12): the per-type default and a finisher's Dead.
export const DH_DEFEATED_STATUSES = Object.freeze(["defeated", "unconscious", "dead", "deathMove"]);
const statusesOf = (doc) => Array.from(doc?.statuses ?? []);
export const findDhState = (state) => (state?.type === "condition" ? byStatus.get(state.statusId) ?? null : null);

export function dhActorStates(actor) {
  const states = [], seen = new Set();
  const applied = actor?.appliedEffects ?? (typeof actor?.allApplicableEffects === "function" ? Array.from(actor.allApplicableEffects()).filter((e) => e?.active) : []);
  for (const effect of applied ?? []) {
    if (effect?.active === false || effect?.disabled || effect?.isSuppressed || effect?.target?.documentName === "Item") continue;
    const statuses = statusesOf(effect);
    for (const statusId of statuses.filter((id) => byStatus.has(id) && !seen.has(id))) {
      seen.add(statusId);
      states.push({ type: "condition", statusId, name: byStatus.get(statusId).name, uuid: effect?.uuid, document: effect, actor });
    }
    if (!statuses.length) states.push({ type: "effect", name: effect?.name, uuid: effect?.uuid, document: effect, actor });
  }
  for (const statusId of statusesOf(actor)) if (byStatus.has(statusId) && !seen.has(statusId)) {
    seen.add(statusId);
    states.push({ type: "condition", statusId, name: byStatus.get(statusId).name, uuid: actor?.uuid, actor });
  }
  return states;
}
export const dhActiveState = (state) => !state?.document || (state.document.active !== false && !state.document.disabled && !state.document.isSuppressed);

// Hidden shows only to the GM and the creature's owners (as Visioner hides the creature itself).
export function dhStateVisible(state, token, { isGM = false } = {}) {
  if (!token || token.destroyed || token.visible === false || (!isGM && token.document?.hidden)) return false;
  if (isGM) return true;
  if (state?.statusId === "hidden" && !token.isOwner && !token.actor?.isOwner) return false;
  return true;
}

export function resolveDhStateRecipe(state, options, saved = [], _catalog, { customEnabled = true } = {}) {
  const entry = findDhState(state), config = normalizeDhCatalogState(options);
  const own = saved.filter((r) => r.lifecycle === "document" && r.systemId === "daggerheart");
  const custom = (entry ? own.find((r) => r.stateEntry === entry.id) : null) ?? matchRecipe(own, { type: "effect", systemId: "daggerheart", item: state?.document ?? state });
  // Your own recipe plays whenever it is enabled and custom recipes play, unless you picked the catalog's version.
  const handmade = Boolean(custom?.enabled && customEnabled && !(entry && config.enabled && config.selected.includes(entry.id) && !config.customized.includes(entry.id)));
  if (!handmade && ((entry && !dhEntryEnabled(entry.id, config)) || (!entry && !config.enabled))) return null;
  if (!handmade && entry && config.selected.includes(entry.id) && !config.customized.includes(entry.id)) return dhRecipe(entry);
  if (custom && !custom.enabled) return null;
  return custom ?? (entry ? dhRecipe(entry) : null);
}

// The defeated set as the Defeated look's built-in lasting state (effect mode only): one layer per actor,
// however many defeated statuses it has. It is keyed to the actor, not to an effect, so it carries on
// while any defeated status remains and ends with the last one.
export function dhDefeatedStates(actor, mode) {
  const state = DH_DEFEATED_STATUSES.flatMap((statusId) => defeatedStates(actor, { mode, statusId }))[0];
  if (!state) return [];
  return [{ ...state, id: `defeated-${actor?.id ?? actor?.uuid}`, uuid: `${actor?.uuid}#defeated`, document: undefined }];
}

export const dhStateHost = {
  actorStates: dhActorStates, activeState: dhActiveState, stateVisible: dhStateVisible,
  normalizeState: normalizeDhCatalogState, resolveStateRecipe: resolveDhStateRecipe,
  // Every Daggerheart state reads the condition catalog's settings (there is no effect catalog).
  stateKind: () => "condition",
  documentKey: (s) => (s.type === "condition" ? `condition:${s.statusId}` : `effect:${s.uuid}`),
  storedDocument: (s) => s.document?.uuid ?? s.actor?.uuid ?? null,
};
