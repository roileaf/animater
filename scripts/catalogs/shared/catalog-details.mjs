import { catalogSpell } from "../pf2e/spells/spell-catalog.mjs";
import { catalogFeat } from "../pf2e/feats/feat-catalog.mjs";
import { catalogWeapon } from "../pf2e/weapons/weapon-catalog.mjs";
import { catalogStateEntry } from "../pf2e/state-catalog.mjs";
import { PF2E_ACTION_CATALOG, PF2E_FEATURE_CATALOG } from "../pf2e/ability-catalog.mjs";

const catalogs = {
  spell: { get: catalogSpell, pack: "spells-srd" },
  feat: { get: catalogFeat, pack: "feats-srd" },
  weapon: { get: catalogWeapon, pack: "equipment-srd" },
  action: { get: PF2E_ACTION_CATALOG.entry, pack: "actionspf2e" },
  feature: { get: PF2E_FEATURE_CATALOG.entry, pack: "classfeatures" },
  condition: { get: catalogStateEntry },
  effect: { get: catalogStateEntry },
};
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// Per-card exclude toggle; sits beside the card button (buttons cannot nest).
export function cardExcludeHTML(action, item, excluded) {
  const label = `${excluded ? "Put" : "Leave"} ${item.name} ${excluded ? "back in" : "out of"} Plug & play`;
  return `<button type="button" class="an-card-exclude${excluded ? " is-on" : ""}" data-action="${esc(action)}" data-id="${esc(item.id)}" aria-pressed="${excluded}" aria-label="${esc(label)}" data-tooltip="${excluded ? "Left out of Plug &amp; play. Click to put it back." : "Exclude from Plug &amp; play"}">⊘</button>`;
}
// Picked-only catalogs: add or remove this entry from the Plug & play list.
export function cardIncludeHTML(action, item, included) {
  const label = `${included ? "Remove" : "Add"} ${item.name} ${included ? "from" : "to"} Plug & play`;
  return `<button type="button" class="an-card-include${included ? " is-on" : ""}" data-action="${esc(action)}" data-id="${esc(item.id)}" aria-pressed="${included}" aria-label="${esc(label)}" data-tooltip="${included ? "Plays automatically. Click to remove it from Plug &amp; play." : "Add to Plug &amp; play (just this one)"}">✓</button>`;
}
// Whole catalog running: cards exclude. Otherwise: cards include specific entries.
export function cardToggleHTML(state, excludeAction, includeAction, item) {
  const all = state.enabled && state.scope === "all";
  return all ? cardExcludeHTML(excludeAction, item, state.excluded.includes(item.id)) : cardIncludeHTML(includeAction, item, !!state.enabled && state.selected.includes(item.id));
}
export function cardSlotClass(state, id) {
  const all = state.enabled && state.scope === "all";
  return all ? (state.excluded.includes(id) ? " is-excluded" : "") : (state.enabled && state.selected.includes(id) ? " is-included" : "");
}
export function catalogNameHTML(item, kind, environment = {}) {
  const demo = environment.demo === true;
  return `<button type="button" class="an-catalog-name" data-action="item-details" data-kind="${esc(kind)}" data-id="${esc(item.id)}" aria-label="Open ${esc(item.name)} details" data-tooltip="${demo ? "Item details open inside Foundry" : "Open native Foundry item sheet"}" ${demo ? "disabled" : ""}>${esc(item.name)}</button>`;
}

export async function openCatalogDetails(w, kind, id) {
  const catalog = catalogs[kind];
  const entry = catalog?.get(id);
  if (!entry) throw Error("Choose an item from the catalog to open its details.");
  if (w.host.environment?.().demo)
    throw Error("Item details open inside Foundry.");
  const item = await w.host.resolveItem?.(entry.uuid ?? `Compendium.pf2e.${catalog.pack}.Item.${entry.id}`);
  if (!item?.sheet)
    throw Error(`The PF2e compendium entry for ${entry.name} is unavailable. Check that Pathfinder 2e is installed.`);
  await item.sheet.render({ force: true });
}
