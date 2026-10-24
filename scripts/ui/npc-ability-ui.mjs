// The Studio's PF2e NPC abilities page: the named monster abilities (catalogs/pf2e/npc-abilities.mjs),
// previewed like any catalog entry, with the three NPC switches and a per-ability leave-out list.
// Playback settings (motion, sound) follow the action catalog, as the abilities do at the table.
import { NPC_ABILITIES, npcAbilityPreview } from "../catalogs/pf2e/npc-abilities.mjs";
import { catalogStatusHTML, previewRowHTML, entryDetailsHTML, stageListHTML } from "../catalogs/shared/catalog-terms.mjs";
import { sampleRecipe } from "../engines/playback/composition.mjs";

export const NPC_PAGE = "npc-abilities";
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const AIM = { target: "One creature", area: "When its area is placed", self: "The creature itself" };
const SWITCHES = [
  ["abilities", "Animate NPC abilities", "Named monster abilities below play when an NPC uses them."],
  ["guess", "Animate other NPC abilities from what they do", "Abilities with no design of their own play by the area they place, the damage they deal, or their traits."],
  ["strikes", "Guess NPC Strikes", "An NPC Strike no weapon or creature attack name places still animates by its damage."],
];
const state = (w) => ({ abilities: true, guess: true, strikes: true, excluded: [], ...(w.host.npcAbilityState?.() ?? {}) });
const matches = (w) => {
  const search = String(w.npcFilters?.search ?? "").trim().toLowerCase();
  return NPC_ABILITIES.filter((a) => !search || a.names.some((n) => n.toLowerCase().includes(search)));
};

// The selected ability's look, with the action catalog's motion and sound.
export function npcAbilityPageRecipe(w) {
  const actions = w.host.actionCatalogState?.() ?? {};
  return npcAbilityPreview(w.selectedNpcAbility, { motion: actions.motion !== false, soundCatalog: actions.sound === false ? null : w.host.soundCatalog?.(), soundVolume: actions.soundVolume });
}

export function npcAbilityCatalogHTML(w) {
  w.npcFilters ??= { search: "" };
  const list = matches(w), s = state(w), env = w.host.environment();
  if (!NPC_ABILITIES.some((a) => a.id === w.selectedNpcAbility) || (list.length && !list.some((a) => a.id === w.selectedNpcAbility))) w.selectedNpcAbility = list[0]?.id ?? NPC_ABILITIES[0]?.id;
  const chosen = NPC_ABILITIES.find((a) => a.id === w.selectedNpcAbility);
  const canConfigure = !env.demo && env.systemId === "pf2e" && !w.busy;
  const toggle = ([field, name, hint]) => `<div class="an-catalog-automation"><div><b>${esc(name)}</b><small>${esc(hint)}</small></div><button role="switch" aria-checked="${s[field]}" aria-label="${esc(name)}" class="${s[field] ? "an-primary" : "an-quiet"}" data-action="npc-setting" data-setting="${field}" ${canConfigure ? "" : "disabled"}>${s[field] ? "On" : "Off"}</button></div>`;
  return `<div class="an-work an-spell-work an-feat-work"><section class="an-library an-spell-library an-feat-library">
    <div class="an-catalog-intro"><div><span class="an-eyebrow">PF2E NPC ABILITIES</span><h2>${NPC_ABILITIES.length} monster abilities. Shared by hundreds of creatures.</h2><p>Grab, Constrict, Swallow Whole, Breath Weapon and more, matched by name on an NPC's action. Your own recipes for an ability still come first; motion and sound follow the action catalog.</p></div></div>
    <div class="an-search"><span>⌕</span><input data-search="${NPC_PAGE}" aria-label="Search NPC abilities" placeholder="Ability name…" value="${esc(w.npcFilters.search)}"><kbd>/</kbd></div>
    <div class="an-catalog-controls">${SWITCHES.map(toggle).join("")}</div>
    <div class="an-section-title"><span>${list.length} result${list.length === 1 ? "" : "s"}</span>${s.excluded.length ? `<span>${s.excluded.length} left out</span>` : ""}</div>
    <div class="an-spell-grid">${list.map((a) => { const out = s.excluded.includes(a.id); return `<div class="an-card-slot${out ? " is-excluded" : ""}"><button class="an-spell-card ${a.id === chosen?.id ? "is-selected" : ""}" data-action="select-npc-ability" data-id="${esc(a.id)}" aria-pressed="${a.id === chosen?.id}"><div><b>${esc(a.name)}</b><small>${esc(AIM[a.aim])}${a.names.length > 1 ? ` · ${a.names.length - 1} other name${a.names.length === 2 ? "" : "s"}` : ""}${out ? " · Left out" : ""}</small></div></button></div>`; }).join("") || `<div class="an-empty">No NPC abilities match.<small>Try another name.</small></div>`}</div>
    <p class="an-hint an-catalog-source">Names match with or without a frequency or distance ("Breath Weapon (Fire)", "Push 10 feet"). A basic action the action catalog knows keeps its own entry.</p>
  </section><aside class="an-inspector an-spell-detail">${chosen ? detailHTML(w, chosen, s, env) : `<div class="an-empty">Choose an NPC ability.</div>`}</aside></div>`;
}

function detailHTML(w, a, s, env) {
  const recipe = npcAbilityPageRecipe(w), out = s.excluded.includes(a.id);
  const playing = s.abilities && !out;
  const status = catalogStatusHTML({ tone: playing ? "on" : "off", title: !s.abilities ? "NPC abilities are off" : out ? "Left out" : "Plays automatically",
    text: out ? "Plays only your own recipe for it." : a.trigger === "template" ? "When an NPC places this ability's area." : "When an NPC uses this ability.",
    buttons: [{ label: out ? "Put back" : "Leave out", action: "npc-exclude", primary: out, disabled: w.busy || env.demo || env.systemId !== "pf2e" }] });
  return `<div class="an-eyebrow">BUILT-IN NPC ABILITY</div>
    <div class="an-spell-detail-title"><div><h2>${esc(a.name)}</h2><small>${esc(AIM[a.aim])}</small></div></div>
    <div class="an-spell-badges">${a.names.map((n) => `<span>${esc(n)}</span>`).join("")}</div>
    ${recipe ? `<div class="an-preview an-full-preview" style="--effect:${esc(recipe.color)}">${w.recipePreviewHTML(recipe)}</div>
    ${previewRowHTML({ duration: w.previewDuration(recipe), busy: w.busy, canvasDisabled: env.demo || !env.ready || w.busy, progressLabel: "Recipe playback progress" })}` : ""}
    ${status}
    ${recipe ? entryDetailsHTML([stageListHTML(sampleRecipe(recipe).stages.map((st) => ({ ...st, label: st.label || st.kind })))], "Details: stages") : ""}`;
}

export function npcAbilitySearch(w, value) { (w.npcFilters ??= { search: "" }).search = value; }

// data-action "select-npc-ability", "npc-setting", "npc-exclude"; false for any other.
export async function npcAbilityAction(w, action, b) {
  if (action === "select-npc-ability") {
    if (w.selectedNpcAbility !== b.dataset.id) { w.selectedNpcAbility = b.dataset.id; w.stageIndex = 0; w.render(); }
    return true;
  }
  if (action !== "npc-setting" && action !== "npc-exclude") return false;
  const env = w.host.environment();
  if (env.demo || env.systemId !== "pf2e") throw Error("Configure NPC abilities inside a PF2e world.");
  const s = state(w);
  if (action === "npc-setting") {
    const field = b.dataset.setting;
    if (!SWITCHES.some(([f]) => f === field)) return true;
    await w.host.setNpcAbilityState({ [field]: !s[field] });
  } else {
    const id = w.selectedNpcAbility;
    await w.host.setNpcAbilityState({ excluded: s.excluded.includes(id) ? s.excluded.filter((x) => x !== id) : [...s.excluded, id] });
  }
  w.render();
  return true;
}
