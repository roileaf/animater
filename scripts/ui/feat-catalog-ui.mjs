import { pf2eCatalogsLive } from "../catalogs/shared/catalog-system.mjs";
import { finisherLinkHTML } from "./finisher-ui.mjs";
import {
  PF2E_FEATS,
  PF2E_FEAT_SOURCE,
  catalogFeat,
  catalogFeatEnabled,
  featRecipe,
  filterFeats,
  normalizeFeatCatalogState,
  useCatalogFeat,
} from "../catalogs/pf2e/feats/feat-catalog.mjs";
import { PF2E_ACTION_CATALOG, PF2E_FEATURE_CATALOG } from "../catalogs/pf2e/ability-catalog.mjs";
import { SPELL_THEMES } from "../catalogs/pf2e/spells/spell-choreography.mjs";
import { EVENTS } from "../core/model.mjs";
import { sampleRecipe } from "../engines/playback/composition.mjs";
import { motionSyncNoticeHTML } from "./spell-catalog-ui.mjs";
import { abilitySoundSettingsHTML, abilitySoundDetailHTML } from "./ability-sounds-ui.mjs";
import { catalogNameHTML, cardToggleHTML, cardSlotClass } from "../catalogs/shared/catalog-details.mjs";

const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const title = (value) => String(value ?? "").replaceAll("-", " ")
  .replace(/\b\w/g, (c) => c.toUpperCase());
const qualities = { signature: "Curated", themed: "Themed", symbolic: "Symbolic" };
const theme = (feat) => SPELL_THEMES[feat.theme] ?? { label: "Ability", color: "#bf9dff" };
const activity = (feat) => feat.actionType === "reaction" ? "Reaction"
  : feat.actionType === "free" ? "Free action"
  : feat.actionType === "action" ? `${feat.actions ?? "?"} action${feat.actions === 1 ? "" : "s"}`
  : "Manual activity";
const select = (field, label, values, current, key = "feat") => `<label>${label}<select data-${key}-filter="${field}">${Object.entries(values)
  .sort(([a], [b]) => a === "all" ? -1 : b === "all" ? 1 : 0)
  .map(([value, text]) => `<option value="${esc(value)}" ${value === String(current) ? "selected" : ""}>${esc(text)}</option>`)
  .join("")}</select></label>`;

// One page layout for every PF2e ability catalog. A profile names its data, its
// workspace fields, its host state accessors and its labels. `key` prefixes every
// data-action (feat-auto, select-feat…), so the Feats page keeps its original names.
const abilityProfile = ({ key, page, catalog, ...rest }) => ({ key, page, catalog,
  filtersKey: `${key}Filters`, selectedKey: `selected${title(key)}`, pageKey: `${key}Page`,
  stateKey: `${key}CatalogState`, setStateKey: `set${title(key)}CatalogState`, ...rest });
export const ABILITY_PAGE_PROFILES = {
  feats: abilityProfile({ key: "feat", page: "feats", noun: "feat", plural: "feats", label: "Feat", eyebrow: "PF2E ACTIVE FEATS", detailEyebrow: "BUILT-IN FEAT",
    heading: (n) => `${n} abilities. Ready for action.`, intro: "Actions, reactions and free actions. Passive bonuses and granted spell parents excluded. Use catalog animations directly; Customize opens every stage.",
    placeholder: "Feat name, class, trait or sourcebook…", categoryLabel: "Feat category", defaultSlug: "sudden-charge",
    sourceNote: "Feat chat cards identify activation; generic Strike rolls cannot identify which feat you used.", sourceLink: "PF2e source feat ↗",
    catalog: { entries: PF2E_FEATS, source: PF2E_FEAT_SOURCE, entry: catalogFeat, enabled: catalogFeatEnabled, filter: filterFeats, normalizeState: normalizeFeatCatalogState, use: useCatalogFeat,
      recipe: (feat, state, soundCatalog) => featRecipe(feat, { motion: state.motion !== false, soundCatalog: state.sound ? soundCatalog : null, soundVolume: state.soundVolume }) } }),
  actions: abilityProfile({ key: "action", page: "actions", noun: "action", plural: "actions", label: "Action", eyebrow: "PF2E ACTIONS", detailEyebrow: "BUILT-IN ACTION",
    heading: (n) => `${n} actions. Basic, skill and class.`, intro: "Basic, skill and class actions such as Demoralize, Grapple, Raise a Shield, Rage, Glimpse of Redemption. Strike, Cast a Spell and other meta actions animate through their own catalogs.",
    placeholder: "Action name, class, trait or sourcebook…", categoryLabel: "Action category", defaultSlug: "demoralize",
    sourceNote: "Action chat cards identify activation.", sourceLink: "PF2e source action ↗", catalog: PF2E_ACTION_CATALOG }),
  features: abilityProfile({ key: "feature", page: "features", noun: "feature", plural: "features", label: "Feature", eyebrow: "PF2E FEATURES", detailEyebrow: "BUILT-IN FEATURE",
    heading: (n) => `${n} class and ancestry features.`, intro: "Class and ancestry features such as Flurry of Blows and Sneak Attack. Damage riders play alongside the Strike's own animation when the damage roll includes them.",
    placeholder: "Feature name, class, trait or sourcebook…", categoryLabel: "Feature category", defaultSlug: "sneak-attack",
    sourceNote: "Feature chat cards identify activation; riders are read from the damage roll's dice and modifiers.", sourceLink: "PF2e source feature ↗", catalog: PF2E_FEATURE_CATALOG }),
};
export const abilityProfileForPage = (page) => ABILITY_PAGE_PROFILES[page] ?? null;
export const abilityProfileForKey = (key) => Object.values(ABILITY_PAGE_PROFILES).find((p) => p.key === key) ?? null;
export const defaultAbilityFilters = () => ({ search: "", level: "all", activity: "all", category: "all", classTrait: "all", theme: "all", quality: "all" });

export function featCatalogHTML(w, profile = ABILITY_PAGE_PROFILES.feats) {
  const p = profile, catalog = p.catalog, key = p.key;
  const filter = w[p.filtersKey] ??= defaultAbilityFilters();
  w[p.pageKey] ??= 0;
  const matches = catalog.filter(filter);
  const pages = Math.max(1, Math.ceil(matches.length / 36));
  w[p.pageKey] = Math.max(0, Math.min(w[p.pageKey], pages - 1));
  if (!matches.some((f) => f.id === w[p.selectedKey])) w[p.selectedKey] = matches[0]?.id;
  const chosen = catalog.entry(w[p.selectedKey]);
  const current = matches.slice(w[p.pageKey] * 36, (w[p.pageKey] + 1) * 36);
  const state = catalog.normalizeState(w.host[p.stateKey]?.());
  const env = w.host.environment();
  const running = state.enabled && (state.independent || w.host.enabled());
  const allRunning = running && state.scope === "all";
  const selectedCount = [...new Set([...state.selected, ...state.customized])]
    .filter((id) => !state.excluded.includes(id)).length;
  const canConfigure = !env.demo && pf2eCatalogsLive(env) && env.ready && !w.busy;
  const categories = [...new Set(catalog.entries.map((f) => f.category).filter(Boolean))].sort();
  const classes = [...new Set(catalog.entries.flatMap((f) => f.classTraits ?? []))].sort();
  return `<div class="an-work an-spell-work an-feat-work"><section class="an-library an-spell-library an-feat-library">
    <div class="an-catalog-intro"><div><span class="an-eyebrow">${p.eyebrow}</span><h2>${p.heading(catalog.entries.length.toLocaleString())}</h2><p>${esc(p.intro)}</p></div></div>
    <div class="an-search"><span>⌕</span><input data-search="${p.page}" aria-label="Search PF2e ${p.plural}" placeholder="${esc(p.placeholder)}" value="${esc(filter.search)}"><kbd>/</kbd></div>
    <div class="an-spell-filters">${select("level", "Level", { all: "All levels", ...Object.fromEntries(Array.from({ length: 21 }, (_, i) => [i, `Level ${i}`])) }, filter.level, key)}${select("activity", "Activity", { all: "All activities", action: "Actions", reaction: "Reactions", free: "Free actions", manual: "Manual activities" }, filter.activity, key)}${select("category", p.categoryLabel, { all: "All categories", ...Object.fromEntries(categories.map((c) => [c, title(c)])) }, filter.category, key)}${select("classTrait", "Class", { all: "All classes", ...Object.fromEntries(classes.map((c) => [c, title(c)])) }, filter.classTrait, key)}${select("theme", "Animation family", { all: "All families", ...Object.fromEntries(Object.entries(SPELL_THEMES).map(([k, v]) => [k, v.label]).sort((a, b) => a[1].localeCompare(b[1]))) }, filter.theme, key)}${select("quality", "Treatment", { all: "All treatments", ...qualities }, filter.quality, key)}</div>
    <div class="an-catalog-controls"><div class="an-catalog-automation"><div><b>Plug &amp; play</b><small>${env.demo ? "Enable inside a PF2e world." : env.systemId !== "pf2e" ? `Automatic ${p.plural} require PF2e.` : allRunning ? `${state.excluded.length} excluded · manual entries stay manual` : running ? `${selectedCount} selected ${p.plural} enabled` : `Send an active ${p.noun} to chat · no recipe setup`}</small></div><button class="${allRunning ? "an-quiet" : "an-primary"}" data-action="${key}-auto" ${!canConfigure ? "disabled" : ""}>${allRunning ? `Pause ${p.noun} catalog` : `Use ${p.noun} catalog`}</button>${running && !allRunning ? `<button class="an-quiet" data-action="${key}-pause" ${!canConfigure ? "disabled" : ""}>Pause</button>` : ""}</div>
    <div class="an-catalog-automation"><div><b>Token motion</b><small>Readable gestures and reactions. Game positions stay intact.</small></div><button role="switch" aria-checked="${state.motion !== false}" aria-label="${p.label} catalog token motion" class="${state.motion !== false ? "an-primary" : "an-quiet"}" data-action="${key}-motion" ${!canConfigure ? "disabled" : ""}>${state.motion !== false ? "On" : "Effects only"}</button></div>
    ${abilitySoundSettingsHTML(w, state, key)}
    </div>${state.motion !== false ? motionSyncNoticeHTML(env) : ""}<div class="an-section-title"><span>${matches.length.toLocaleString()} result${matches.length === 1 ? "" : "s"}</span><button class="an-text-button" data-action="${key}-reset">Reset filters</button></div>
    <div class="an-spell-grid">${current.map((feat) => `<div class="an-card-slot${cardSlotClass(state, feat.id)}"><button class="an-spell-card ${feat.id === chosen?.id ? "is-selected" : ""}" style="--effect:${theme(feat).color}" data-action="select-${key}" data-id="${esc(feat.id)}" aria-pressed="${feat.id === chosen?.id}"><img loading="lazy" src="${esc(w.host.imageURL?.(feat.img) ?? feat.img)}" alt=""><div><b>${esc(feat.name)}</b><small>Level ${feat.level} · ${esc(feat.rider ? "Damage rider" : activity(feat))} · ${esc(theme(feat).label)}</small><span class="an-treatment is-${feat.quality}">${qualities[feat.quality] ?? "Symbolic"}</span></div></button>${cardToggleHTML(state, `${key}-exclude`, "card-include", feat)}</div>`).join("") || `<div class="an-empty">No active ${p.plural} match.<small>Try fewer filters.</small></div>`}</div>
    <div class="an-catalog-pagination"><button data-action="${key}-page" data-index="${w[p.pageKey] - 1}" ${w[p.pageKey] === 0 ? "disabled" : ""}>← Previous</button><span>Page ${w[p.pageKey] + 1} of ${pages}</span><button data-action="${key}-page" data-index="${w[p.pageKey] + 1}" ${w[p.pageKey] === pages - 1 ? "disabled" : ""}>Next →</button></div>
    <p class="an-hint an-catalog-source">PF2e ${esc(catalog.source.version)}. Description-based visual cues; gameplay, prerequisites and action costs stay with PF2e. ${esc(p.sourceNote)}</p>
  </section><aside class="an-inspector an-spell-detail">${chosen ? featDetailHTML(w, chosen, state, env, p) : `<div class="an-empty">Choose an active ${p.noun}.</div>`}</aside></div>`;
}

function featDetailHTML(w, feat, state, env, p) {
  const key = p.key, catalog = p.catalog;
  const recipe = catalog.recipe(feat, state, w.host.soundCatalog?.());
  const saved = w.host.recipes().find((r) => r.id === recipe.id || r.itemUuid === recipe.itemUuid);
  const roleNotice=recipe.playbackRoles?.reason;
  const automatic = recipe.trigger !== "manual" && !roleNotice;
  const usingCatalog = automatic && (state.independent || w.host.enabled()) && catalog.enabled(feat.id, state) &&
    (!saved || state.selected.includes(feat.id) || (state.preferCatalog && !state.customized.includes(feat.id)));
  const canUse = !env.demo && pf2eCatalogsLive(env) && env.ready;
  const duration = w.previewDuration(recipe);
  const status = roleNotice ? "Manual token selection needed" : !automatic ? "Manual animation" : usingCatalog ? "Using catalog animation"
    : saved && (w.host.enabled() || state.enabled && state.customized.includes(feat.id))
      ? saved.enabled === false ? "Customization paused" : "Customized recipe takes priority" : "Ready to use";
  const notes = feat.notes ?? [];
  const trigger = feat.rider ? "Rolling Strike damage that includes this rider plays it alongside the weapon's own animation." : `Send this ${p.noun} to chat · no saved recipe slot`;
  return `<div class="an-eyebrow">${p.detailEyebrow} · ${(qualities[feat.quality] ?? "Symbolic").toUpperCase()}</div>
    <div class="an-spell-detail-title"><img src="${esc(w.host.imageURL?.(feat.img) ?? feat.img)}" alt=""><div><h2>${catalogNameHTML(feat, key, env)}</h2><small>Level ${feat.level} · ${esc(feat.rider ? "Damage rider" : activity(feat))} · ${esc(feat.rarity)}</small></div></div>
    <div class="an-spell-badges">${[feat.category, ...(feat.classTraits ?? []), ...(feat.traits ?? []).slice(0, 6)].filter(Boolean).filter((v, i, values) => values.indexOf(v) === i).map((v) => `<span>${esc(title(v))}</span>`).join("")}</div>
    ${roleNotice?`<div class="an-catalog-notes" role="note"><b>Native performer required</b><p>${esc(roleNotice)}</p><small>Automatic playback skips this entry until native roles can be identified. Preview shows a manual illustration.</small></div>`:''}
    <div class="an-preview an-full-preview" style="--effect:${recipe.color}">${w.recipePreviewHTML(recipe)}</div>
    <div class="an-preview-transport"><button class="an-primary" data-action="recipe-preview" ${w.busy ? "disabled" : ""}>▶ Preview recipe</button><span data-preview-time>0.0 / ${(duration / 1000).toFixed(1)}s</span></div><progress data-recipe-progress aria-label="Recipe playback progress" max="${duration}" value="0"></progress><small class="an-preview-status" data-preview-status role="status">Ready · full choreography, original timing</small>
    <div class="an-catalog-use-status ${usingCatalog ? "is-using" : ""}" role="status"><b>${status}</b><small>${!automatic ? "Play manually when this ability activates." : usingCatalog ? trigger : `Use animation enables this ${p.noun} directly from catalog data.`}</small></div>
    <div class="an-play-actions an-catalog-choice"><button data-action="${automatic ? `use-${key}` : "play"}" class="an-primary" ${w.busy || (automatic ? !canUse || usingCatalog : env.demo || !env.ready) ? "disabled" : ""}>${automatic ? usingCatalog ? "Using catalog ✓" : "Use animation" : "Play animation"}</button><button data-action="copy-${key}" class="an-quiet" ${w.busy ? "disabled" : ""}>${saved ? "Edit customization" : "Customize"}</button></div><button class="an-catalog-canvas-preview" data-action="preview" ${env.demo || !env.ready || w.busy ? "disabled" : ""}>▷ Local canvas preview</button>
    ${finisherLinkHTML(w, feat.name, feat.uuid)}${abilitySoundDetailHTML(w, feat, recipe, state)}<div class="an-catalog-steps">${sampleRecipe(recipe).stages.map((s, i) => `<div class="an-stage" data-stage-drag="${i}"><span>${i + 1}</span><div><b>${esc(s.label || s.kind)}</b><small>${s.delay}ms · ${s.duration}ms · ${esc(s.kind)}</small></div></div>`).join("")}</div>
    <div class="an-editor-section"><b>When it plays</b><p class="an-hint">${esc(EVENTS[recipe.trigger])}. ${feat.rider ? "Detected from the damage roll's enabled dice and modifiers; the weapon's own animation still plays." : automatic ? `Only this ${p.noun}'s own card activates its catalog animation. Weapon attacks are not inferred as ${p.noun} use.` : "Native activation cannot be attributed reliably; use manual playback."}</p><button class="an-quiet" data-action="${key}-exclude" ${env.demo || env.systemId !== "pf2e" || w.busy ? "disabled" : ""}>${state.excluded.includes(feat.id) ? `Include in automatic ${p.noun} catalog` : `Exclude from automatic ${p.noun} catalog`}</button></div>
    ${notes.length ? `<div class="an-catalog-notes"><b>Placement &amp; treatment</b>${notes.map((n) => `<p>${esc(n)}</p>`).join("")}</div>` : ""}
    <details class="an-advanced" data-options-group="${key}-source"><summary>Media &amp; source</summary>${recipe.stages.map((s) => `<p class="an-hint"><b>${esc(s.label || s.kind)}</b><br>${esc(s.assets.join(" → ") || s.soundFile || s.fxPreset || s.fxType || "Native token artwork")}</p>`).join("")}<p class="an-hint">${esc(feat.publication)}. Free and Patreon fallbacks select installed assets.</p><a href="https://github.com/foundryvtt/pf2e/blob/${catalog.source.sha}/${esc(feat.path)}" target="_blank" rel="noopener noreferrer">${p.sourceLink}</a></details>`;
}
