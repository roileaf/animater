import { PF2E_FEATS, PF2E_FEAT_SOURCE } from "../../../../data/pf2e-feats.mjs";
import { normalize, matchRecipe, ownRecipe } from "../../../core/model.mjs";
import { featRecipe, FEAT_THEMES, FEAT_MOTIFS } from "./feat-choreography.mjs";
export { PF2E_FEATS, PF2E_FEAT_SOURCE, featRecipe, FEAT_THEMES, FEAT_MOTIFS };

const byId = new Map(PF2E_FEATS.map(feat => [feat.id, feat])), byName = new Map();
for (const feat of [...PF2E_FEATS].sort((a,b) => Number(a.edition === "legacy") - Number(b.edition === "legacy")))
  for (const name of [feat.name, feat.slug]) if (!byName.has(normalize(name))) byName.set(normalize(name), feat);
export const catalogFeat = id => byId.get(String(id).replace(/^pf2e-feat-/, "")) ?? null;
export function normalizeFeatCatalogState(state = {}) {
  state ??= {};
  const ids = values => [...new Set((Array.isArray(values) ? values : []).map(id => catalogFeat(id)?.id).filter(Boolean))];
  return { enabled: state.enabled === true, independent: state.independent === true,
    scope: state.scope === "selected" ? "selected" : "all", selected: ids(state.selected), excluded: ids(state.excluded), customized: ids(state.customized),
    preferCatalog: state.preferCatalog === true, motion: state.motion !== false, sound: state.sound !== false,
    soundVolume: Number.isFinite(Number(state.soundVolume)) ? Math.max(0,Math.min(1,Number(state.soundVolume))) : 0.35 };
}
export const catalogFeatEnabled = (id, state) => state?.enabled === true && !state.excluded?.includes(id) && (state.scope !== "selected" || state.selected?.includes(id) === true);
export const featCatalogFeatEnabled = catalogFeatEnabled;
export function useCatalogFeat(state, id) {
  state = normalizeFeatCatalogState(state); id = catalogFeat(id)?.id;
  if (!id) throw Error("Choose a catalog feat first.");
  return normalizeFeatCatalogState({ ...state, enabled: true, independent: true, scope: state.enabled ? state.scope : "selected",
    selected: state.enabled ? [...state.selected,id] : [id], excluded: state.excluded.filter(value => value !== id), customized: state.customized.filter(value => value !== id) });
}
export function findCatalogFeat(event) {
  const item = event?.item;
  if (item?.type !== "feat" || item.system?.actionType?.value === "passive") return null;
  for (const uuid of [item.uuid, item.original?.uuid, item._stats?.compendiumSource, item.flags?.core?.sourceId, event.itemUuid]) {
    if (!uuid?.startsWith("Compendium.pf2e.feats-srd.")) continue;
    const feat = byId.get(uuid.split(".").at(-1)); if (feat) return feat;
  }
  return byName.get(normalize(item.system?.slug ?? item.slug)) ?? byName.get(normalize(item.name)) ?? null;
}
export function automaticFeatCatalogRecipe(event, state, customRecipes = [], soundCatalog) {
  const feat = findCatalogFeat(event);
  if (!feat || !catalogFeatEnabled(feat.id,state) || feat.trigger !== event.type) return null;
  if (customRecipes.some(recipe => !recipe.enabled && matchRecipe([{...recipe, enabled:true}],event))) return null;
  return featRecipe(feat,{motion:state.motion !== false, soundCatalog:state.sound === false ? null : soundCatalog, soundVolume:state.soundVolume});
}
export function resolveAutomaticFeatRecipe(event, state, customRecipes = [], {customEnabled = true,soundCatalog} = {}) {
  const feat = findCatalogFeat(event);
  if (feat && catalogFeatEnabled(feat.id,state) && (state.selected?.includes(feat.id) || (state.preferCatalog && !state.customized?.includes(feat.id) && !ownRecipe(customEnabled ? customRecipes : [], event))))
    return automaticFeatCatalogRecipe(event,state,[],soundCatalog);
  const configured = customEnabled || (feat && state?.enabled && !state.excluded?.includes(feat.id) && state.customized?.includes(feat.id)) ? customRecipes : [];
  return matchRecipe(configured,event) ?? automaticFeatCatalogRecipe(event,state,configured,soundCatalog);
}
export function filterFeats({search="",level="all",activity="all",actionType=activity,activation=actionType,category="all",classTrait="all",theme="all",quality="all",edition="all"} = {}) {
  const query=normalize(search);
  return PF2E_FEATS.filter(feat => (level === "all" || feat.level === Number(level)) && (activation === "all" || feat.actionType === activation) &&
    (category === "all" || feat.category === category) && (classTrait === "all" || feat.classTraits.includes(classTrait)) && (theme === "all" || feat.theme === theme) &&
    (quality === "all" || feat.quality === quality) && (edition === "all" || feat.edition === edition) &&
    (!query || normalize(`${feat.name} ${feat.slug} ${feat.traits.join(" ")} ${feat.publication} ${feat.rationale}`).includes(query)));
}
