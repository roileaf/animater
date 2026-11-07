// "Reset catalog…" on a catalog page (GM): that one catalog back to the stock catalog. Its choices go back to its
// registered default (its normalize with no state) and the recipes Customize made for its entries are deleted. A
// backup (the catalog's state and those recipes) is kept inside the world, one slot per catalog, which "Restore
// last reset…" puts back, and the same backup downloads as a file that the Recipes page's Import takes back.
// Pure: no Foundry globals.
import { planRecipeImport } from "../../core/presets.mjs";
import { catalogSpell } from "../pf2e/spells/spell-catalog.mjs";
import { catalogFeat } from "../pf2e/feats/feat-catalog.mjs";
import { PF2E_ACTION_CATALOG, PF2E_FEATURE_CATALOG } from "../pf2e/ability-catalog.mjs";
import { catalogWeapon } from "../pf2e/weapons/weapon-catalog.mjs";
import { catalogStateEntry } from "../pf2e/state-catalog.mjs";
import { sfEntry } from "../sf2e/sf2e-catalog.mjs";
import { dndEntry } from "../dnd5e/dnd5e-catalog.mjs";
import { dhEntry } from "../daggerheart/daggerheart-catalog.mjs";
import { dsEntry } from "../draw-steel/draw-steel-catalog.mjs";

// Kept unless the GM asks for the fresh-install state: the catalog's on switch, whether it plays every entry, and
// `independent`, which lets it play while "Play my own recipes automatically" is off, so a catalog kept on plays on.
export const CATALOG_SWITCH_FIELDS = Object.freeze(["enabled", "scope", "independent"]);

const same = (a, b) => a === b || JSON.stringify(a) === JSON.stringify(b);
// The catalog's state after a reset, or null when nothing would change. `keepEnabled: false` also puts the switch
// back (off). Fields the default lacks are dropped, as the catalog's normalize drops them; a field `current` lacks
// already reads as its default.
export function resetCatalogState(current, defaults, { keepEnabled = true } = {}) {
  current ??= {};
  const keep = new Set(keepEnabled ? CATALOG_SWITCH_FIELDS : []);
  const next = structuredClone(defaults ?? {});
  for (const key of Object.keys(next)) if (keep.has(key) && key in current) next[key] = structuredClone(current[key]);
  return Object.keys(next).some((key) => key in current && !same(current[key], next[key])) ? next : null;
}

// Whether a saved recipe is a Customize copy of one of this catalog's entries ({ system, kind }). Customize saves the
// entry's catalog recipe under the catalog's own id, so the id names the entry; Duplicate gives a new id and Unbind
// clears the binding, so copies made from a copy are the GM's own. Lasting looks bind by `stateEntry`, as the state
// resolvers play them.
const LASTING = new Set(["condition", "effect"]);
const SYSTEM_ENTRY = { sf2e: sfEntry, dnd5e: dndEntry, daggerheart: dhEntry, "draw-steel": dsEntry };
export function isCatalogCustomisation(recipe, { system, kind } = {}) {
  const id = String(recipe?.id ?? "");
  if (!id) return false;
  if (system === "pf2e") {
    if (LASTING.has(kind)) { const entry = catalogStateEntry(recipe.stateEntry); return recipe.lifecycle === "document" && entry?.kind === kind && entry.id === recipe.stateEntry; }
    if (kind === "spell") { const spell = catalogSpell(id); return Boolean(spell) && id === `pf2e-${spell.id}`; }
    if (kind === "weapon") { const weapon = catalogWeapon(id); return Boolean(weapon) && weapon.modes.some((m) => id === `pf2e-weapon-${weapon.id}-${m.mode}`); }
    const entry = { feat: catalogFeat, action: PF2E_ACTION_CATALOG.entry, feature: PF2E_FEATURE_CATALOG.entry }[kind]?.(id);
    return Boolean(entry) && id === `pf2e-${entry.recipeKind ?? "feat"}-${entry.id}`;
  }
  const find = SYSTEM_ENTRY[system];
  if (!find) return false;
  const entry = recipe.catalogEntry ? find(recipe.catalogEntry) : null;
  if (entry?.kind === kind && entry.id === recipe.catalogEntry && entry.variants?.some((v) => v.recipe?.id === id)) return true;
  const state = LASTING.has(kind) && recipe.lifecycle === "document" && recipe.stateEntry ? find(recipe.stateEntry) : null;
  return state?.kind === kind && state.id === recipe.stateEntry;
}
export const catalogCustomisations = (recipes, catalog) => (recipes ?? []).filter((r) => isCatalogCustomisation(r, catalog));

// What a reset does: the catalog's next state (null when it stays as it is) and the recipes it deletes. Nothing to
// do when both are empty.
export function catalogResetPlan({ state, defaults, recipes = [], catalog, keepEnabled = true }) {
  const deleted = catalogCustomisations(recipes, catalog), gone = new Set(deleted.map((r) => r.id));
  const next = resetCatalogState(state, defaults, { keepEnabled });
  return { state: next, deleted, recipes: recipes.filter((r) => !gone.has(r.id)), changed: Boolean(next || deleted.length) };
}

// Whether a Customize copy was edited since: its name or its stages differ from the catalog's own recipe for that
// entry, leaving sound stages out (the catalog's sound choices add and remove those). Unknown without a stock recipe.
const silent = (recipe) => (recipe?.stages ?? []).filter((s) => s?.kind !== "sound");
export function recipeEdited(saved, stock) {
  if (!saved || !stock) return false;
  return String(saved.name ?? "") !== String(stock.name ?? "") || !same(silent(saved), silent(stock));
}

// The backup a reset keeps (in the world's slot for this catalog, and as a download): a recipe export (schema 1) of
// the recipes it deletes, so Import brings them back, with the catalog's whole state beside it.
export function catalogBackup(state, deleted = [], { id = "animater", catalog = "", date = new Date() } = {}) {
  return { schema: 1, recipes: deleted, module: id, catalog, saved: date.toISOString(), catalogState: state };
}
export const catalogBackupFileName = (catalog, { id = "animater", date = new Date() } = {}) => `${id}-${catalog}-catalog-backup-${date.toISOString().replace(/[:.]/g, "-")}.json`;
// A kept backup, checked: its recipes and state as a reset saved them, else null.
export function catalogBackupOf(value) {
  return value && typeof value === "object" && Array.isArray(value.recipes) && value.catalogState && typeof value.catalogState === "object" ? value : null;
}
// Restore last reset…: the recipes back among the world's (the same merge as Import: an id already there is
// replaced, so a recipe Customize made again since gives way to the kept one) and the catalog's state as it was.
export function catalogRestorePlan(backup, recipes = []) {
  const kept = catalogBackupOf(backup);
  if (!kept) throw Error("No catalog reset to restore.");
  const merged = kept.recipes.length ? planRecipeImport({ schema: 1, recipes: kept.recipes }, recipes) : { recipes, incoming: [], replaced: 0 };
  return { recipes: merged.recipes, restored: merged.incoming, replaced: merged.replaced, state: structuredClone(kept.catalogState) };
}

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const NAMED = 10;
const when = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? "" : d.toLocaleString(); };
const named = (recipes, edited) => recipes.slice(0, NAMED).map((r) => esc(r.name || r.id) + (edited?.has(r.id) ? " (edited)" : "")).join(", ") + (recipes.length > NAMED ? ` and ${recipes.length - NAMED} more` : "");
// The reset's question. `deleted`: the customised recipes it deletes, named, those in `edited` marked as edited since
// Customize made them. `pickedOnly`: the catalog is on for picked entries only, which a reset clears. `replaces`: the
// moment of the kept reset this one replaces, if any.
export function catalogResetDialogHTML(name, { deleted = [], edited = new Set(), pickedOnly = false, replaces = "" } = {}) {
  const n = deleted.length, e = deleted.filter((r) => edited.has(r.id)).length;
  const recipes = n ? `Deletes ${n} customised recipe${n === 1 ? "" : "s"}${e ? ` (${e} edited since)` : ""}: ${named(deleted, edited)}.` : "No customised recipes to delete.";
  return `<p>Put the ${esc(name)} back to the stock catalog?</p><ul>`
    + `<li>Entries you picked (✓), left out (⊘) or customised are cleared, and its look and sound choices (motion, sound, volume, visibility, lasting look) go back to their defaults.</li>`
    + `<li>${recipes} Your other recipes (your own, the starters, other catalogs' and players') are kept.</li>`
    + `<li>It stays on or paused as it is now, playing every entry or only picked ones.${pickedOnly ? " It plays only picked entries, so none play until you pick them again." : ""}</li></ul>`
    + `<p>A copy of what it deletes stays in this world until this catalog's next reset: <b>Restore last reset…</b> in the page header puts it back.${replaces ? ` The copy kept from the reset on ${esc(when(replaces))} is replaced.` : ""} The same backup downloads as a file for your records, which Import on the Recipes page takes back. For a backup of every recipe first, use Export on the Recipes page.</p>`
    + `<label class="checkbox"><input type="checkbox" name="full"> Also switch this catalog back to its fresh-install state (off)</label>`;
}
// Restore last reset…'s question: what comes back, from when.
export function catalogRestoreDialogHTML(name, backup, { replaced = 0 } = {}) {
  const kept = catalogBackupOf(backup), n = kept?.recipes.length ?? 0;
  const recipes = n ? `Brings back ${n} customised recipe${n === 1 ? "" : "s"}: ${named(kept.recipes)}.${replaced ? ` ${replaced} of them ${replaced === 1 ? "has" : "have"} been made again since and ${replaced === 1 ? "is" : "are"} replaced by the kept copy.` : ""}` : "No recipes were deleted.";
  return `<p>Put the ${esc(name)} back as it was before its reset on ${esc(when(kept?.saved))}?</p><ul>`
    + `<li>${recipes}</li>`
    + `<li>Its picked, left-out and customised entries and its look and sound choices go back to what they were then, including whether it was on.</li></ul>`
    + `<p>The kept copy is then cleared.</p>`;
}
