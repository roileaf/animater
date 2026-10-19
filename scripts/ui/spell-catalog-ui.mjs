import { qualityBadgeHTML, qualityLabel, QUALITY, plugModeHTML, leftOutOnly, showingLeftOut, catalogStatusHTML, previewRowHTML, entryDetailsHTML, stageListHTML } from "../catalogs/shared/catalog-terms.mjs";
import { pf2eCatalogsLive } from "../catalogs/shared/catalog-system.mjs";
import { catalogNameHTML, cardToggleHTML, cardSlotClass } from "../catalogs/shared/catalog-details.mjs";
import { finisherLinkHTML } from "./finisher-ui.mjs";
import {
  catalogSpell,
  filterSpells,
  PF2E_SOURCE,
  SPELL_THEMES,
  spellRecipe,
  normalizeCatalogState,
  catalogSpellEnabled,
  catalogSpellReady,
} from "../catalogs/pf2e/spells/spell-catalog.mjs";
import { EVENTS } from "../core/model.mjs";
import { catalogSoundOptions, spellSoundInfo } from "../engines/sound/spell-sounds.mjs";
import { sampleRecipe } from "../engines/playback/composition.mjs";
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const qualities = Object.fromEntries(Object.entries(QUALITY).map(([key, q]) => [key, q.label]));
export function motionSyncNoticeHTML(env) {
  if (env.demo || env.motionReady !== false) return "";
  const loaded = env.motionServerVersion
    ? `Server loaded Animater ${esc(env.motionServerVersion)} without its token-motion channel.`
    : "Foundry has not registered Animater's token-motion channel.";
  return `<p class="an-hint an-sync-notice" role="status"><b>Token motion channel unavailable</b><br>${loaded} Stop and start the Foundry server instance serving this world, then reload connected clients. Reloading a browser cannot register this channel. Local preview works now; choose Effects only for automatic playback until the channel is available.</p>`;
}
const select = (field, label, values, current) =>
  `<label>${label}<select data-catalog-filter="${field}">${Object.entries(
    values,
  )
    .sort(([a], [b]) => (a === "all" ? -1 : b === "all" ? 1 : 0))
    .map(
      ([value, text]) =>
        `<option value="${esc(value)}" ${value === String(current) ? "selected" : ""}>${esc(text)}</option>`,
    )
    .join("")}</select></label>`;
export function spellCatalogHTML(w) {
  const filter = w.spellFilters;
  const matches = leftOutOnly(w, normalizeCatalogState(w.host.catalogState?.()), filterSpells(filter));
  const pages = Math.max(1, Math.ceil(matches.length / 36));
  w.spellPage = Math.min(w.spellPage, pages - 1);
  if (!matches.some((s) => s.id === w.selectedSpell))
    w.selectedSpell = matches[0]?.id;
  const chosen = catalogSpell(w.selectedSpell);
  const current = matches.slice(w.spellPage * 36, (w.spellPage + 1) * 36);
  const state = normalizeCatalogState(w.host.catalogState?.());
  const running = state.enabled && (state.independent || w.host.enabled());
  const allRunning = running && state.scope === "all";
  const selectedCount = [
    ...new Set([...state.selected, ...state.customized]),
  ].filter((id) => !state.excluded.includes(id)).length;
  const env = w.host.environment();
  return `<div class="an-work an-spell-work"><section class="an-library an-spell-library">
    <div class="an-catalog-intro"><div><span class="an-eyebrow">THE PF2E SPELL COLLECTION</span><h2>${PF2E_SOURCE.total.toLocaleString()} spells indexed.</h2><p>${PF2E_SOURCE.designs.ready.toLocaleString()} animations ready · ${PF2E_SOURCE.designs.unconfigured.toLocaleString()} need configuration. Plug &amp; play skips unconfigured entries. Customize a ready animation or configure a missing one.</p></div></div>
    <div class="an-search"><span>⌕</span><input data-search="spells" aria-label="Search PF2e spells" placeholder="Spell name, trait, or sourcebook…" value="${esc(filter.search)}"><kbd>/</kbd></div>
    <div class="an-spell-filters">${select("rank", "Rank", { all: "All ranks", ...Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i + 1, `Rank ${i + 1}`])) }, filter.rank)}${select("kind", "Spell type", { all: "All spell types", cantrip: "Cantrips", spell: "Ranked spells", focus: "Focus spells", ritual: "Rituals" }, filter.kind)}${select("tradition", "Tradition", { all: "All traditions", arcane: "Arcane", divine: "Divine", occult: "Occult", primal: "Primal" }, filter.tradition)}${select("edition", "Edition", { all: "Remaster + legacy", remaster: "Remaster", legacy: "Legacy" }, filter.edition)}${select(
      "theme",
      "Animation family",
      {
        all: "All families",
        ...Object.fromEntries(
          Object.entries(SPELL_THEMES)
            .sort((a, b) => a[1].label.localeCompare(b[1].label))
            .map(([k, v]) => [k, v.label]),
        ),
      },
      filter.theme,
    )}${select("quality", "Treatment", { all: "All treatments", ...qualities }, filter.quality)}</div>
    <div class="an-catalog-controls"><div class="an-catalog-automation"><div><b>Plug &amp; play</b><small>${env.demo ? "Enable inside a PF2e world." : env.systemId !== "pf2e" ? "Automatic catalog is available for PF2e." : allRunning ? `${state.excluded.length} excluded · catalog defaults with your chosen customizations` : running ? `${selectedCount} selected spell${selectedCount === 1 ? "" : "s"} enabled` : "Ready-made animations · cast normally · no recipe setup"}</small></div><button class="${allRunning ? "an-quiet" : "an-primary"}" data-action="catalog-auto" ${!env.ready || env.demo || env.systemId !== "pf2e" || w.busy ? "disabled" : ""}>${allRunning ? "Pause catalog" : "Use entire catalog"}</button>${running && !allRunning ? `<button class="an-quiet" data-action="catalog-pause" ${w.busy ? "disabled" : ""}>Pause</button>` : ""}</div>
    <div class="an-catalog-automation"><div><b>Token motion</b><small>Cosmetic lift, recoil and reactions. Original positions return.</small></div><button role="switch" aria-checked="${state.motion !== false}" aria-label="Catalog token motion" class="${state.motion !== false ? "an-primary" : "an-quiet"}" data-action="catalog-motion" ${w.busy ? "disabled" : ""}>${state.motion !== false ? "On" : "Effects only"}</button></div>
    ${soundSettingsHTML(w, state)}
    </div>${state.motion !== false ? motionSyncNoticeHTML(env) : ""}
    ${state.enabled && !state.independent && !w.host.enabled() ? `<p class="an-hint an-sync-notice">Also turn on Automatic playback in Setup to receive roll events.</p>` : ""}
    <div class="an-section-title"><span>${matches.length.toLocaleString()} results</span>${plugModeHTML(state, 0, showingLeftOut(w, state))}<button class="an-text-button" data-action="catalog-reset">Reset filters</button></div>
    <div class="an-spell-grid">${current.map((spell) => `<div class="an-card-slot${cardSlotClass(state, spell.id)}"><button class="an-spell-card ${spell.id === chosen?.id ? "is-selected" : ""}" style="--effect:${SPELL_THEMES[spell.theme].color}" data-action="select-spell" data-id="${spell.id}" aria-pressed="${spell.id === chosen?.id}"><img loading="lazy" src="${esc(w.host.imageURL?.(spell.img) ?? spell.img)}" alt=""><div><b>${esc(spell.name)}</b><small>${spell.kind === "cantrip" ? "Cantrip" : `Rank ${spell.rank}`} · ${esc(spell.kind === "spell" ? spell.edition : spell.kind)} · ${esc(SPELL_THEMES[spell.theme].label)}</small>${qualityBadgeHTML(spell.quality)}</div></button>${cardToggleHTML(state, "catalog-exclude", "card-include", spell)}</div>`).join("") || `<div class="an-empty">No spells match.<small>Try fewer filters.</small></div>`}</div>
    <div class="an-catalog-pagination"><button data-action="catalog-page" data-index="${w.spellPage - 1}" ${w.spellPage === 0 ? "disabled" : ""}>← Previous</button><span>Page ${w.spellPage + 1} of ${pages}</span><button data-action="catalog-page" data-index="${w.spellPage + 1}" ${w.spellPage === pages - 1 ? "disabled" : ""}>Next →</button></div>
    <p class="an-hint an-catalog-source">PF2e ${PF2E_SOURCE.version} · ${PF2E_SOURCE.kinds.cantrip} cantrips · ${PF2E_SOURCE.kinds.focus} focus · ${PF2E_SOURCE.kinds.ritual} rituals. Curated entries use explicit spell mappings; themed entries use description cues and native spell fields; symbolic entries provide casting cues for complex or utility effects. No rules automation added.</p>
  </section><aside class="an-inspector an-spell-detail">${chosen ? spellDetailHTML(w, chosen, state, env) : `<div class="an-empty">Choose a spell.</div>`}</aside></div>`;
}
function spellDetailHTML(w, spell, state, env) {
  const recipe = spellRecipe(spell, undefined, catalogSoundOptions(w.host));
  const saved = w.host
    .recipes()
    .find((r) => r.id === recipe.id || r.itemUuid === recipe.itemUuid);
  if(!catalogSpellReady(spell))return `<div class="an-eyebrow">${qualities.unconfigured}</div><div class="an-spell-detail-title"><img src="${esc(w.host.imageURL?.(spell.img)??spell.img)}" alt=""><div><h2>${catalogNameHTML(spell,'spell',env)}</h2><small>${spell.kind==='cantrip'?'Cantrip':`Rank ${spell.rank}`} · ${esc(spell.edition)}</small></div></div><div class="an-catalog-design"><b>No built-in animation yet</b><p>This spell needs a matching composition. Generic casting rings and impacts are skipped.</p></div><div class="an-catalog-use-status" role="status"><b>Skipped by plug &amp; play</b><small>Your saved custom animation can still play normally.</small></div><button class="an-primary" data-action="copy-spell" ${w.busy?'disabled':''}>${saved?'Edit customization':'Configure animation'}</button><p class="an-hint">Opens a blank recipe bound to this spell. Choose its assets and choreography, then enable it.</p>`;
  const duration = w.previewDuration(recipe);
  const automatic = spell.trigger !== "manual";
  const usingCatalog =
    automatic &&
    (state.independent || w.host.enabled()) &&
    catalogSpellEnabled(spell.id, state) &&
    (!saved ||
      state.selected.includes(spell.id) ||
      (state.preferCatalog && !state.customized.includes(spell.id)));
  const canUse = !env.demo && pf2eCatalogsLive(env) && env.ready;
  const status = !automatic
    ? "Manual animation"
    : usingCatalog
      ? "Using catalog animation"
      : saved &&
          (w.host.enabled() ||
            (state.enabled && state.customized.includes(spell.id)))
        ? saved.enabled === false
          ? "Customization paused"
          : "Customized recipe takes priority"
        : "Ready to use";
  return `<div class="an-eyebrow">BUILT-IN ANIMATION · ${qualityLabel(spell.quality).toUpperCase()}</div><div class="an-spell-detail-title"><img src="${esc(w.host.imageURL?.(spell.img) ?? spell.img)}" alt=""><div><h2>${catalogNameHTML(spell, "spell", env)}</h2><small>${spell.kind === "cantrip" ? "Cantrip" : `Rank ${spell.rank}`} · ${esc(spell.edition)} · ${esc(spell.rarity)}</small></div></div><div class="an-spell-badges">${[...spell.traditions, spell.kind].map((value) => `<span>${esc(value)}</span>`).join("")}</div>
    <div class="an-preview an-full-preview" style="--effect:${recipe.color}">${w.recipePreviewHTML(recipe)}</div>${previewRowHTML({ duration, busy: w.busy, canvasDisabled: env.demo || !env.ready || w.busy, progressLabel: "Recipe playback progress" })}
    ${spellStatusHTML(w, { spell, recipe, saved, automatic, usingCatalog, state, canUse, env })}
    ${finisherLinkHTML(w, spell.name, spell.uuid)}
    ${entryDetailsHTML([
      spellSoundsHTML(w, spell, recipe, state),
      stageListHTML(sampleRecipe(recipe).stages),
      spell.notes.length ? `<div class="an-catalog-notes"><b>Placement & treatment</b>${spell.notes.map((note) => `<p>${esc(note)}</p>`).join("")}</div>` : "",
      `<div class="an-entry-source"><b>Media & source</b>${recipe.stages.map((s) => `<p class="an-hint"><b>${esc(s.label)}</b><br>${esc(s.assets.join(" → ") || s.soundFile || s.fxPreset || s.fxType || "Native token artwork")}</p>`).join("")}<p class="an-hint">${esc(spell.publication)}. Free/Patreon keys verified; installed edition selects the fallback.</p><a href="https://github.com/foundryvtt/pf2e/blob/${PF2E_SOURCE.sha}/${esc(spell.path)}" target="_blank" rel="noopener noreferrer">PF2e source entry ↗</a></div>`,
    ])}`;
}
// Whether this spell plays, and the buttons that change that.
function spellStatusHTML(w, { spell, recipe, saved, automatic, usingCatalog, state, canUse, env }) {
  const busy = w.busy, all = state.enabled && state.scope === "all", excluded = state.excluded.includes(spell.id);
  const when = `On: ${EVENTS[recipe.trigger] ?? recipe.trigger}${spell.trigger === "template" ? (spell.area?.type === "line" ? " · a native line area" : spell.area?.type === "cone" ? " · a native cone area" : ["square", "cube"].includes(spell.area?.type) ? " · a square area" : spell.area?.type === "emanation" ? " · its emanation" : " · a circular area") : ""}`;
  const customize = { label: saved ? "Edit customization" : "Customize", action: "copy-spell", disabled: busy };
  const leave = { label: excluded ? "Put back in Plug & play" : "Leave out of Plug & play", action: "catalog-exclude", disabled: env.demo || env.systemId !== "pf2e" || busy };
  if (!automatic) return catalogStatusHTML({ tone: "manual", title: spell.kind === "ritual" ? "Rituals play on demand" : "Plays on demand", text: "Play it with your selected caster and targets.", buttons: [{ label: "Play animation", action: "play", primary: true, disabled: busy || env.demo || !env.ready }, customize] });
  if (saved && !usingCatalog && (w.host.enabled() || (state.enabled && state.customized.includes(spell.id))))
    return catalogStatusHTML({ tone: "custom", title: saved.enabled === false ? "Your version is paused" : "Your version plays", text: "It plays instead of the catalog animation.", buttons: [{ ...customize, primary: true }] });
  if (usingCatalog) return catalogStatusHTML({ tone: "on", title: "Plays automatically", text: when, buttons: [customize, all ? leave : null] });
  if (all && excluded) return catalogStatusHTML({ tone: "off", title: "Left out of Plug & play", text: when, buttons: [{ ...leave, primary: true }, customize] });
  return catalogStatusHTML({ tone: "off", title: "Not playing automatically", text: "Use just this spell, or turn on the whole catalog above.", buttons: [{ label: "Use animation", action: "use-spell", primary: true, disabled: busy || !canUse }, customize] });
}
function soundSettingsHTML(w, state) {
  const catalog = w.host.soundCatalog?.();
  const names = catalog?.packs?.map((p) => p.title) ?? [];
  return `<div class="an-catalog-automation an-sound-settings"><div><b>Spell sounds</b><small>${names.length ? esc(names.join(" · ")) : "Activate GGG, PSFX, SoundFx Library or PF2e Creature Sounds for matching cues."}</small></div><button role="switch" aria-checked="${state.sound}" aria-label="Catalog spell sounds" class="${state.sound ? "an-primary" : "an-quiet"}" data-action="catalog-sound" ${w.busy ? "disabled" : ""}>${state.sound ? "On" : "Off"}</button><label>Volume <span>${Math.round(state.soundVolume * 100)}%</span><input type="range" min="0" max="100" step="5" value="${Math.round(state.soundVolume * 100)}" data-catalog-volume aria-label="Catalog sound volume" ${w.busy || !state.sound ? "disabled" : ""}></label></div>`;
}
function spellSoundsHTML(w, spell, recipe, state) {
  const info = spellSoundInfo(spell, w.host.soundCatalog?.(), state.sound);
  const stages = recipe.stages.filter((s) => s.kind === "sound");
  const message = !state.sound
    ? "Catalog sounds turned off."
    : !info.profile
      ? "Quiet by design."
      : !stages.length
        ? "No matching cue in active packs. Animation stays available."
        : `${stages.length} synchronized cue${stages.length === 1 ? "" : "s"}`;
  return `<details class="an-advanced an-spell-sounds" data-options-group="spell-sounds" open><summary>Sound design · ${esc(message)}</summary><p class="an-hint">${esc(info.reason)}</p>${stages.map((s) => `<div class="an-sound-cue"><b>${esc(s.label)}</b><small>${esc(w.host.soundCatalog?.()?.packs?.find((p) => p.module === s.optionalSound.candidates[0].module)?.title ?? "")}</small><button class="an-quiet an-listen" data-action="audition-sound" aria-label="Listen ${esc(s.label)}">▶ Listen</button><audio controls preload="none" src="${esc(w.host.mediaURL?.(s.soundFile) ?? s.soundFile)}" aria-label="${esc(s.label)} audio preview" data-cue-volume="${s.volume}"></audio></div>`).join("")}<p class="an-hint">${stages.length ? "Audio previews use catalog volume. Full recipe preview includes these cues. Customize to replace files or adjust timing." : "Customize to choose your own audio file."}</p></details>`;
}
