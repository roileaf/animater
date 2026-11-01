// "Reset catalog…" on a catalog page (GM): that one catalog back to the stock catalog. Its choices go back to its
// registered default (its normalize with no state) and the recipes Customize made for its entries are deleted, with
// one backup downloaded first that the Recipes page's Import takes back.
// Pure: no Foundry globals.
import { catalogSpell } from "../pf2e/spells/spell-catalog.mjs";
import { catalogFeat } from "../pf2e/feats/feat-catalog.mjs";
import { PF2E_ACTION_CATALOG, PF2E_FEATURE_CATALOG } from "../pf2e/ability-catalog.mjs";
import { catalogWeapon } from "../pf2e/weapons/weapon-catalog.mjs";
import { catalogStateEntry } from "../pf2e/state-catalog.mjs";
import { sfEntry } from "../sf2e/sf2e-catalog.mjs";
import { dndEntry } from "../dnd5e/dnd5e-catalog.mjs";
import { dhEntry } from "../daggerheart/daggerheart-catalog.mjs";

// Kept unless the GM asks for the fresh-install state: the catalog's on switch and whether it plays every entry.
export const CATALOG_SWITCH_FIELDS = Object.freeze(["enabled", "scope"]);

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
const SYSTEM_ENTRY = { sf2e: sfEntry, dnd5e: dndEntry, daggerheart: dhEntry };
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

// The backup a reset downloads first: a recipe export (schema 1) of the recipes it deletes, so the Recipes page's
// Import brings them back, with the catalog's whole state beside it.
export function catalogBackup(state, deleted = [], { id = "animater", catalog = "", date = new Date() } = {}) {
  return { schema: 1, recipes: deleted, module: id, catalog, saved: date.toISOString(), catalogState: state };
}
export const catalogBackupFileName = (catalog, { id = "animater", date = new Date() } = {}) => `${id}-${catalog}-catalogue-backup-${date.toISOString().replace(/[:.]/g, "-")}.json`;

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const NAMED = 10;
// The reset's question. `deleted`: the customised recipes it deletes, named. `pickedOnly`: the catalog is on for
// picked entries only, which a reset clears.
export function catalogResetDialogHTML(name, { deleted = [], pickedOnly = false } = {}) {
  const n = deleted.length, names = deleted.slice(0, NAMED).map((r) => esc(r.name || r.id)).join(", ") + (n > NAMED ? ` and ${n - NAMED} more` : "");
  const recipes = n ? `Deletes ${n} customised recipe${n === 1 ? "" : "s"}: ${names}.` : "No customised recipes to delete.";
  return `<p>Put the ${esc(name)} back to the stock catalog?</p><ul>`
    + `<li>Entries you picked (✓), left out (⊘) or customised are cleared, and its look and sound choices (motion, sound, volume, visibility, lasting look) go back to their defaults.</li>`
    + `<li>${recipes} Your other recipes (your own, the starters, other catalogs' and players') are kept.</li>`
    + `<li>It stays on or paused as it is now, playing every entry or only picked ones.${pickedOnly ? " It plays only picked entries, so none play until you pick them again." : ""}</li></ul>`
    + `<p>A backup downloads first. To undo, import it with Import on the Recipes page, then Customize an entry to use its recipe again.</p>`
    + `<label class="checkbox"><input type="checkbox" name="full"> Also switch this catalogue back to its fresh-install state (off)</label>`;
}
