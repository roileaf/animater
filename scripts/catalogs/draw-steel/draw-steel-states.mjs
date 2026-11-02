// Draw Steel conditions as lasting layers (PersistentStates host). Its ten conditions are status
// effects on the actor (ds.CONFIG.conditions); Dead follows the Defeated look setting through the
// built-in states like every other system. Other applied effects are listed so your own lasting
// recipes can attach to them.
import { dsEntries, dsRecipe, dsEntryEnabled, normalizeDsCatalogState } from "./draw-steel-catalog.mjs";
import { matchRecipe } from "../../core/model.mjs";

const byStatus = new Map(dsEntries("condition").filter((e) => e.state?.lasting).map((e) => [e.statusId, e]));
const statusesOf = (doc) => Array.from(doc?.statuses ?? []);
export const findDsState = (state) => (state?.type === "condition" ? byStatus.get(state.statusId) ?? null : null);

export function dsActorStates(actor) {
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
export const dsActiveState = (state) => !state?.document || (state.document.active !== false && !state.document.disabled && !state.document.isSuppressed);
export function dsStateVisible(state, token, { isGM = false } = {}) {
  if (!token || token.destroyed || token.visible === false || (!isGM && token.document?.hidden)) return false;
  return true;
}

export function resolveDsStateRecipe(state, options, saved = [], _catalog, { customEnabled = true } = {}) {
  const entry = findDsState(state), config = normalizeDsCatalogState(options);
  const own = saved.filter((r) => r.lifecycle === "document" && r.systemId === "draw-steel");
  const custom = (entry ? own.find((r) => r.stateEntry === entry.id) : null) ?? matchRecipe(own, { type: "effect", systemId: "draw-steel", item: state?.document ?? state });
  // Your own recipe plays whenever it is enabled and custom recipes play, unless you picked the catalog's version.
  const handmade = Boolean(custom?.enabled && customEnabled && !(entry && config.enabled && config.selected.includes(entry.id) && !config.customized.includes(entry.id)));
  if (!handmade && ((entry && !dsEntryEnabled(entry.id, config)) || (!entry && !config.enabled))) return null;
  if (!handmade && entry && config.selected.includes(entry.id) && !config.customized.includes(entry.id)) return dsRecipe(entry);
  if (custom && !custom.enabled) return null;
  return custom ?? (entry ? dsRecipe(entry) : null);
}

export const dsStateHost = {
  actorStates: dsActorStates, activeState: dsActiveState, stateVisible: dsStateVisible,
  normalizeState: normalizeDsCatalogState, resolveStateRecipe: resolveDsStateRecipe,
  // Every Draw Steel state reads the condition catalog's settings (there is no effect catalog).
  stateKind: () => "condition",
  documentKey: (s) => (s.type === "condition" ? `condition:${s.statusId}` : `effect:${s.uuid}`),
  storedDocument: (s) => s.document?.uuid ?? s.actor?.uuid ?? null,
};
