// Native NPC abilities, previewed with their system's action/feature playback settings.
import * as npcAbilities from "../catalogs/pf2e/npc-abilities.mjs";
import * as sfNpcAbilities from '../catalogs/sf2e/sf2e-npc-actions.mjs';
import * as dndNpcAbilities from '../catalogs/dnd5e/dnd5e-npc-actions.mjs';
// A running client may have loaded the shared-only module before an on-disk
// update, then fetch this lazily opened workspace afterward. Namespace access
// keeps the editor usable until that client reloads its ES module graph.
const {NPC_ABILITIES, NPC_ACTIONS = [], npcAbilityPreview, npcActionPreview = () => null} = npcAbilities;
const expandedCatalogReady = Array.isArray(npcAbilities.NPC_ACTIONS) && typeof npcAbilities.npcActionPreview === 'function';
import { catalogStatusHTML, previewRowHTML, entryDetailsHTML, stageListHTML } from "../catalogs/shared/catalog-terms.mjs";
import { sampleRecipe } from "../engines/playback/composition.mjs";

import {createNpcCatalogProfile} from "./npc-catalog-profile.mjs";
export const NPC_PAGE = "npc-abilities";
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const AIM = { target: "One creature", area: "When its area is placed", self: "The creature itself" };
const PAGE_SIZE=40;
const PROFILES={pf2e:createNpcCatalogProfile({systemId:'pf2e',label:'PF2e',actions:NPC_ACTIONS,shared:NPC_ABILITIES,preview:npcActionPreview,previewShared:npcAbilityPreview,ready:expandedCatalogReady})};
PROFILES.sf2e=createNpcCatalogProfile({systemId:'sf2e',label:'SF2e',actions:sfNpcAbilities.SF_NPC_ACTIONS,shared:NPC_ABILITIES,preview:sfNpcAbilities.sfNpcActionPreview,previewShared:npcAbilityPreview});
PROFILES.dnd5e=createNpcCatalogProfile({systemId:'dnd5e',label:'D&D 5e',actions:dndNpcAbilities.DND_NPC_ACTIONS,preview:dndNpcAbilities.dndNpcActionPreview});
const profileFor=w=>PROFILES[w.host.environment?.().systemId]??PROFILES.pf2e;
const coverageLabel=a=>a.native?'Native catalog design':a.coverage==='reviewed'?(a.form?.delivery==='strike'?'Strike preparation':a.form?.delivery==='spell'?'Spell preparation':'Action design'):({designed:'Shared design',shared:'Shared design',inferred:'Matched from action data',unmapped:'Needs a design'})[a.coverage];
const excludedId=(a,s)=>s.excluded.includes(a.id)?a.id:s.excluded.includes(a.form?.id)?a.form.id:null;
const SWITCHES = [
  ["abilities", "Animate NPC abilities", "Named monster abilities below play when an NPC uses them."],
  ["guess", "Animate other NPC abilities from what they do", "Abilities with no design of their own play by the area they place, the damage they deal, or their traits."],
  ["strikes", "Guess NPC Strikes", "An NPC Strike no weapon or creature attack name places still animates by its damage."],
];
const state = (w) => ({ abilities: true, guess: true, strikes: true, excluded: [], ...(w.host.npcAbilityState?.() ?? {}) });
const matches = (w) => {
  const search = String(w.npcFilters?.search ?? "").trim().toLowerCase();
  const p=profileFor(w);return p.library.filter((a) => !search || p.search.get(a.id).includes(search));
};

// The selected ability's look, with the action catalog's motion and sound.
export function npcAbilityPageRecipe(w) {
  const p=profileFor(w),actions=p.catalogState(w);
  const sounds=actions.sound===false?null:w.host.soundCatalog?.();
  const options={ motion: actions.motion !== false, soundCatalog: sounds, sounds, soundVolume: actions.soundVolume };
  return p.byId.get(w.selectedNpcAbility)?.coverage==='designed'?p.previewShared(w.selectedNpcAbility,options):p.preview(w.selectedNpcAbility,options);
}

export function npcAbilityCatalogHTML(w) {
  w.npcFilters ??= { search: "" };
  const p=profileFor(w),list = matches(w), s = state(w), env = w.host.environment();
  if (!p.byId.has(w.selectedNpcAbility) || (list.length && !list.some((a) => a.id === w.selectedNpcAbility))) w.selectedNpcAbility = list[0]?.id ?? p.shared[0]?.id;
  const chosen = p.byId.get(w.selectedNpcAbility);
  const offset=Math.max(0,Math.min(Math.floor((list.length-1)/PAGE_SIZE)*PAGE_SIZE,Number(w.npcFilters.offset)||0)),page=list.slice(offset,offset+PAGE_SIZE);
  const canConfigure = !env.demo && env.systemId === p.systemId && !w.busy;
  const title=p.ready?`${p.actions.length.toLocaleString()} NPC actions${p.shared.length?`, plus ${p.shared.length} shared designs`:''}.`:`${p.shared.length} shared NPC ability designs.`;
  const reloadNotice=p.ready?'':`<p class="an-hint" role="status"><b>NPC catalog updated.</b> Reload Foundry (Ctrl+F5) to load the expanded action library.</p>`;
  const toggle = ([field, name, hint]) => `<div class="an-catalog-automation"><div><b>${esc(name)}</b><small>${esc(hint)}</small></div><button role="switch" aria-checked="${s[field]}" aria-label="${esc(name)}" class="${s[field] ? "an-primary" : "an-quiet"}" data-action="npc-setting" data-setting="${field}" ${canConfigure ? "" : "disabled"}>${s[field] ? "On" : "Off"}</button></div>`;
  return `<div class="an-work an-spell-work an-feat-work"><section class="an-library an-spell-library an-feat-library">
    <div class="an-catalog-intro"><div><span class="an-eyebrow">${esc(p.label.toUpperCase())} NPC ABILITIES</span><h2>${title}</h2><p>Search actual bestiary action names, creatures or traits. Action designs, shared designs and data-matched actions animate automatically. Strike and spell sequences show preparation here; their actual attacks and spells keep their own animations. Your own recipes still come first; motion and sound follow the ${p.systemId==='dnd5e'?'feature':'action'} catalog.</p>${reloadNotice}</div></div>
    <div class="an-search"><span>⌕</span><input data-search="${NPC_PAGE}" aria-label="Search NPC abilities" placeholder="Action, creature or trait…" value="${esc(w.npcFilters.search)}"><kbd>/</kbd></div>
    <div class="an-catalog-controls">${(p.systemId==='dnd5e'?SWITCHES.slice(0,1):SWITCHES).map(toggle).join("")}</div>
    <div class="an-section-title"><span>${list.length} result${list.length === 1 ? "" : "s"}</span>${s.excluded.length ? `<span>${s.excluded.length} left out</span>` : ""}</div>
    <div class="an-spell-grid">${page.map((a) => { const out = !!excludedId(a,s); return `<div class="an-card-slot${out ? " is-excluded" : ""}"><button class="an-spell-card ${a.id === chosen?.id ? "is-selected" : ""}" data-action="select-npc-ability" data-id="${esc(a.id)}" aria-pressed="${a.id === chosen?.id}"><div><b>${esc(a.name)}</b><small>${esc(coverageLabel(a))}${a.creatures.length?` · ${esc(a.creatures.slice(0,2).join(', '))}${a.creatures.length>2?` +${a.creatures.length-2}`:''}`:''}${a.names.length > 1 ? ` · ${a.names.length - 1} other name${a.names.length === 2 ? "" : "s"}` : ""}${out ? " · Left out" : ""}</small></div></button></div>`; }).join("") || `<div class="an-empty">No NPC abilities match.<small>Try another name.</small></div>`}</div>
    ${list.length>PAGE_SIZE?`<div class="an-catalog-controls"><button data-action="npc-page" data-offset="${Math.max(0,offset-PAGE_SIZE)}" ${offset===0?'disabled':''}>Previous</button><span>${offset+1}–${Math.min(offset+PAGE_SIZE,list.length)} of ${list.length}</span><button data-action="npc-page" data-offset="${offset+PAGE_SIZE}" ${offset+PAGE_SIZE>=list.length?'disabled':''}>Next</button></div>`:''}
    <p class="an-hint an-catalog-source">Names match with or without a frequency or distance ("Breath Weapon (Fire)", "Push 10 feet"). A basic action the action catalog knows keeps its own entry.</p>
  </section><aside class="an-inspector an-spell-detail">${chosen ? detailHTML(w, chosen, s, env) : `<div class="an-empty">Choose an NPC ability.</div>`}</aside></div>`;
}

function detailHTML(w, a, s, env) {
  const p=profileFor(w),recipe = npcAbilityPageRecipe(w), out = !!excludedId(a,s);
  const settings=p.catalogState(w),nativeId=a.native?.entryId;
  const nativeAllowed=!nativeId||(settings.enabled===true&&!settings.excluded?.includes(nativeId)&&(settings.scope!=='selected'||settings.selected?.includes(nativeId)||settings.customized?.includes(nativeId)));
  const mapped=a.coverage!=='unmapped',playing = s.abilities && settings.enabled!==false && nativeAllowed && !out && mapped && (a.coverage!=='inferred'||s.guess);
  const delivery=a.delegated?'Its native spell activation plays the actual spell. This preview shows preparation.':a.native?'Its native catalog controls playback, customization and exclusions.':a.form?.delivery==='strike'?'Shows its preparation when used. Each actual Strike keeps its own attack animation.':a.form?.delivery==='spell'?'Shows its preparation when used. Each actual spell keeps its own spell animation.':null;
  const status = catalogStatusHTML({ tone: playing ? "on" : "off", title: !s.abilities ? "NPC abilities are off" : out ? "Left out" : !mapped?'Needs a design':settings.enabled===false?'Native catalog is off':!nativeAllowed?'Catalog entry is off':!playing?'Data matching is off':"Plays automatically",
    text: !mapped?"Listed from the native bestiary, but no automatic design matches yet. Your own recipe can cover it.":a.coverage==='inferred'&&!s.guess?'Data-matched NPC abilities are turned off.':out ? (excludedId(a,s)!==a.id?'Its shared design is left out. Putting it back restores that shared design.':'Plays only your own recipe for it.') : delivery ?? (a.trigger === "template" ? "When an NPC places this ability's area." : "When an NPC uses this ability."),
    buttons: [{ label: a.native?'Open native catalog':out ? "Put back" : "Leave out", action: a.native?'npc-native':"npc-exclude", primary: out, disabled: w.busy || env.demo || env.systemId !== p.systemId }] });
  return `<div class="an-eyebrow">BUILT-IN NPC ABILITY</div>
    <div class="an-spell-detail-title"><div><h2>${esc(a.name)}</h2><small>${esc(a.form?.targetSelection==='all'?'Selected creatures':AIM[a.aim]??'No matching design')} · ${esc(coverageLabel(a))}</small></div></div>
    ${a.creatures.length?`<p>${esc(a.creatures.join(', '))}</p>`:''}
    ${a.rationale?`<p class="an-hint">${esc(a.rationale)}</p>`:''}
    <div class="an-spell-badges">${a.names.map((n) => `<span>${esc(n)}</span>`).join("")}</div>
    ${recipe ? `<div class="an-preview an-full-preview" style="--effect:${esc(recipe.color)}">${w.recipePreviewHTML(recipe)}</div>
    ${previewRowHTML({ duration: w.previewDuration(recipe), busy: w.busy, canvasDisabled: env.demo || !env.ready || w.busy, progressLabel: "Recipe playback progress" })}` : ""}
    ${status}
    ${recipe ? entryDetailsHTML([stageListHTML(sampleRecipe(recipe).stages.map((st) => ({ ...st, label: st.label || st.kind })))], "Details: stages") : ""}`;
}

export function npcAbilitySearch(w, value) { const filters=(w.npcFilters ??= { search: "" });filters.search = value;filters.offset=0; }

// data-action "select-npc-ability", "npc-setting", "npc-exclude"; false for any other.
export async function npcAbilityAction(w, action, b) {
  if(!['npc-native','npc-page','select-npc-ability','npc-setting','npc-exclude'].includes(action))return false;
  const p=profileFor(w);
  if(action==='npc-native'){const a=p.byId.get(w.selectedNpcAbility);if(!a?.native)return true;w.reveal({page:p.systemId==='dnd5e'?'feats':'actions',name:a.name,id:a.native.entryId});w.render();return true;}
  if(action==='npc-page'){const filters=(w.npcFilters??={search:''});filters.offset=Math.max(0,Number(b.dataset.offset)||0);w.selectedNpcAbility=matches(w)[filters.offset]?.id??matches(w)[0]?.id;w.stageIndex=0;w.render();return true;}
  if (action === "select-npc-ability") {
    if (w.selectedNpcAbility !== b.dataset.id) { w.selectedNpcAbility = b.dataset.id; w.stageIndex = 0; w.render(); }
    return true;
  }
  if (action !== "npc-setting" && action !== "npc-exclude") return false;
  const env = w.host.environment();
  if (env.demo || env.systemId !== p.systemId) throw Error("Configure NPC abilities inside this game system.");
  const s = state(w);
  if (action === "npc-setting") {
    const field = b.dataset.setting;
    if (!SWITCHES.some(([f]) => f === field)) return true;
    await w.host.setNpcAbilityState({ [field]: !s[field] });
  } else {
    const id = w.selectedNpcAbility;
    const excluded=excludedId(p.byId.get(id)??{id},s);
    await w.host.setNpcAbilityState({ excluded: excluded ? s.excluded.filter((x) => x !== excluded) : [...s.excluded, id] });
  }
  w.render();
  return true;
}
