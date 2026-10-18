import { tokenFxEditorHTML, applyTokenFxEdit, tokenFxAction } from "./token-fx-editor.mjs";
import { layersOf } from "../engines/tokenshade/layers.mjs";
import { uuid } from "../core/uuid.mjs";
import { strikeFromDrag } from "../engines/finishers/strike-finishers.mjs";
import { OPTIONAL_FX_KINDS, fxAvailability } from '../engines/playback/optional-fx.mjs';
import {
  EVENTS,
  STRIKE_SCOPES,
  KINDS,
  clone,
  validateRecipe,
  parseImport,
  resolveAsset,
  catalogIndex,
  MOTIONS,
  MAX_STAGES,
  normalizeFinisher,
} from "../core/model.mjs";
import { finishersPageHTML, finisherSettingsHTML } from "./finisher-ui.mjs";
import { presetFinisher } from "../engines/finishers/finisher-presets.mjs";
import { linkFinisher, addFinisherName, removeFinisherName, linkFinisherItem, unlinkFinisherItem } from "../engines/finishers/finisher-model.mjs";
import { runFinisherTour, TOUR_PRACTICE_ID } from "./finisher-tour.mjs";
import { motionPose, motionDirection, poseTransform } from "../engines/motion/motion.mjs";
import { isPathMotion } from "../engines/motion/motion-path.mjs";
import { fragmentsControlsHTML, fragmentsPreviewSVG, resetPiecesOnPattern } from "./fragments-ui.mjs";
import { keyframesOf, keyframeDiamondsHTML, pathCanvasHTML, keyframeInspectorHTML } from "./keyframe-ui.mjs";
import { normalizeKeyframes, insertKeyframe, moveKeyframeTime, deleteKeyframe, flipKeyframes, resetKeyframes, smoothKeyframes } from "../engines/motion/keyframe-path.mjs";
import { catalogSoundOptions, previewRecipeSounds } from "../engines/sound/spell-sounds.mjs";
import { starterRecipes } from "../core/presets.mjs";
import { reorderStages, recipeDuration, RecipeClock, linkStartModes, moveRow, snapStart, timelineLayout, packLanes } from "../engines/playback/choreography.mjs";
import { RecipePreview } from "../engines/preview/recipe-preview.mjs";
import { trackOf, studioHTML, studioAfterRender, studioAction, studioFrame, studioInput, studioKey, studioPointer, studioWheel, studioContextMenu } from "./studio.mjs";
import { previewMediaFailed, markPreviewMediaFailure, clearPreviewMediaFailure } from "../engines/media/preview-media-status.mjs";
import { chainPreview, hasChain } from "../engines/preview/chain-preview.mjs";
import { patchDOM } from "./dom-patch.mjs";
import { withRenderMemo, renderMemo } from "../core/render-memo.mjs";
import { MediaLibrary } from './media-library.mjs';
import { mediaForReference, mediaType } from '../engines/media/media-library-model.mjs';
import {
  catalogSpell,
  spellRecipe,
  PF2E_SPELLS,
  normalizeCatalogState,
  useCatalogSpell,
} from "../catalogs/pf2e/spells/spell-catalog.mjs";
import { spellCatalogHTML, motionSyncNoticeHTML } from "./spell-catalog-ui.mjs";
import {
  PF2E_FEATS,
} from "../catalogs/pf2e/feats/feat-catalog.mjs";
import { featCatalogHTML, ABILITY_PAGE_PROFILES, abilityProfileForPage, abilityProfileForKey, defaultAbilityFilters } from "./feat-catalog-ui.mjs";
import { cleanOrigin, originKey, elapsedLabel, setOriginExcluded, assetLabel } from "./activity-actions.mjs";
import { PF2E_WEAPONS, catalogWeapon, weaponRecipe, normalizeWeaponCatalogState, useCatalogWeapon, weaponCustomizationKey } from "../catalogs/pf2e/weapons/weapon-catalog.mjs";
import { weaponCatalogHTML } from "./weapon-catalog-ui.mjs";
import { openCatalogDetails } from "../catalogs/shared/catalog-details.mjs";
import { PF2E_CONDITIONS, PF2E_EFFECTS, catalogStateEntry, stateRecipe, normalizeStateCatalogState, useStateEntry } from "../catalogs/pf2e/state-catalog.mjs";
import { stateCatalogHTML } from "./state-catalog-ui.mjs";
import { FlashEditor } from "./flash-editor.mjs";
import { recipeConflicts, unlinked } from "../core/recipe-conflicts.mjs";
import { handleStateCatalogAction } from "../catalogs/pf2e/state-catalog-actions.mjs";
import {catalogNavigation,catalogPageAllowed,catalogPageTitle,worldCatalogSystem,BORROWED_PAGES,borrowedNavigation,borrowedSystem,pf2eCatalogPage,pf2eCatalogsLive} from '../catalogs/shared/catalog-system.mjs';
import {DndCatalogWorkspace} from './dnd5e-catalog-ui.mjs';
import {sfCatalogProfile} from '../catalogs/sf2e/sf2e-catalog.mjs';
import {dhCatalogProfile} from '../catalogs/daggerheart/daggerheart-catalog.mjs';
import { ORB_ELEMENTS, orbRecipe } from "../catalogs/shared/orb-builder.mjs";
import { sampleRecipe, timedStages, variantMembers, previewVariants } from "../engines/playback/composition.mjs";
import {
  OPTION_GROUPS,
  normalizeOptions,
  EASES,
  TRACK_PROPERTIES,
} from "../core/stage-options.mjs";
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const icons = {
  Fire: "✦",
  Ice: "❄",
  Lightning: "ϟ",
  Arcane: "◇",
  Healing: "✧",
  Weapons: "⚔",
  Custom: "◎",
  Motion: "↝",
};
const options = (items, value) =>
  Object.entries(items)
    .map(
      ([k, v]) =>
        `<option value="${esc(k)}" ${k === value ? "selected" : ""}>${esc(v)}</option>`,
    )
    .join("");
import { teleportPlan, teleportVisuals, teleportStyle, TELEPORT_STYLES, TELEPORT_WHO } from "../engines/motion/teleport.mjs";
export const JB2A_MISSING = "Neither JB2A module is active, so built-in animations have no artwork to play. Activate JB2A Free (JB2A_DnD5e) or JB2A Patreon (jb2a_patreon), then reload Foundry.";
export class Workspace {
  // Open the animation for something: a saved recipe in the Studio, or a catalog page
  // searched to a name (its first match is shown). Returns false for an unknown page.
  reveal({ recipeId, page, name = "", id } = {}) {
    const fresh = (filters) => ({ ...Object.fromEntries(Object.keys(filters ?? {}).map((k) => [k, "all"])), search: name });
    if (recipeId) { this.page = this.host?.recipes?.().find((r) => r.id === recipeId)?.finisher ? "finishers" : "recipes"; this.selected = recipeId; this.studio = true; this.studioTime = 0; this.stageIndex = 0; this.search = ""; this.category = "All"; return true; }
    const pages = ["spells", "feats", "actions", "features", "weapons", "items", "conditions", "effects"];
    if (!pages.includes(page)) return false;
    this.page = page; this.studio = false; this.message = "";
    if (this.dndCatalog?.isCatalogPage()) {
      const kind = this.dndCatalog.kind;
      this.dndCatalog.filters[kind] = { search: name, edition: "all", level: "all", theme: "all" };
      this.dndCatalog.selected[kind] = id; this.dndCatalog.pages[kind] = 0;
      return true;
    }
    const profile = abilityProfileForPage(page);
    if (page === "spells") { this.spellFilters = fresh(this.spellFilters); this.selectedSpell = id; this.spellPage = 0; }
    else if (profile) { this[profile.filtersKey] = fresh(this[profile.filtersKey]); this[profile.selectedKey] = id; this[profile.pageKey] = 0; }
    else if (page === "weapons") { this.weaponFilters = fresh(this.weaponFilters); this.selectedWeapon = id; this.weaponPage = 0; }
    else if (page === "conditions" || page === "effects") { const kind = page === "conditions" ? "condition" : "effect"; this.stateFilters[kind] = fresh(this.stateFilters[kind]); this.selectedState[kind] = id; this.statePages[kind] = 0; }
    else return false;
    return true;
  }
  constructor(root, host) {
    this.root = root;
    this.host = host;
    const catalogSystem = worldCatalogSystem(host.environment?.() ?? {});
    // A PF2e world shows the SF2e catalogs it borrows (crossover) on their own sf2e-* pages.
    this.dndCatalog = ['dnd5e','sf2e','daggerheart'].includes(catalogSystem) ? new DndCatalogWorkspace(this, catalogSystem === 'sf2e' ? sfCatalogProfile : catalogSystem === 'daggerheart' ? dhCatalogProfile : {})
      : catalogSystem === 'pf2e' ? new DndCatalogWorkspace(this, { ...sfCatalogProfile, kinds: BORROWED_PAGES, borrowed: true, intro: "Borrowed from Starfinder 2e for items this world's own catalogs do not cover; passive feats excluded." }) : null;
    this.page = "recipes";
    this.search = "";
    this.category = "All";
    this.spellFilters = {
      search: "",
      rank: "all",
      kind: "all",
      tradition: "all",
      edition: "all",
      theme: "all",
      quality: "all",
    };
    this.selectedSpell = PF2E_SPELLS.find(
      (s) => s.name === "Fireball" && s.edition === "remaster",
    )?.id;
    this.spellPage = 0;
    this.featFilters = {
      search: "",
      level: "all",
      activity: "all",
      category: "all",
      classTrait: "all",
      theme: "all",
      quality: "all",
    };
    this.selectedFeat = PF2E_FEATS.find((f) => f.slug === "sudden-charge")?.id;
    this.featPage = 0;
    // Actions and Features pages share the feat page UI (see ABILITY_PAGE_PROFILES).
    for (const profile of [ABILITY_PAGE_PROFILES.actions, ABILITY_PAGE_PROFILES.features]) {
      this[profile.filtersKey] = defaultAbilityFilters();
      this[profile.selectedKey] = profile.catalog.entries.find((f) => f.slug === profile.defaultSlug)?.id;
      this[profile.pageKey] = 0;
    }
    this.weaponFilters = { search: "", group: "all", mode: "all", category: "all", edition: "all" };
    this.weaponPage = 0;
    this.selectedWeapon = PF2E_WEAPONS.find(w => w.slug === "dagger")?.id;
    this.weaponMode = "melee";
    this.stateFilters = Object.fromEntries(["condition", "effect"].map(k => [k, {search:"",group:"all",theme:"all",quality:"all"}]));
    this.statePages = {condition:0,effect:0};
    this.stateDamageType = "bleed";
    this.stateAuraVariant = "default";
    this.selectedState = {condition:PF2E_CONDITIONS.find(e => e.slug === "frightened")?.id, effect:PF2E_EFFECTS.find(e => e.name === "Spell Effect: Bless")?.id};
    this.selected = host.recipes()[0]?.id;
    this.drafts = new Map();
    this.dirty = new Set();
    // Activity page exclusions this session, by origin, so a row can offer Undo.
    this.activityExcluded = new Map();
    this.stageIndex = 0;
    this.assetSearch = "";
    this.selectedAssetKey = null;
    this.message = "";
    this.busy = false;
    this.previewMode = "recipe";
    this.previewRun = null;
    this.previewSerial = 0;
    this.stageDrag = null;
    this.pendingImport = null;
    this.abort = new AbortController();
    root.addEventListener("click", (e) => this.onClick(e), {
      signal: this.abort.signal,
    });
    root.addEventListener("input", (e) => this.onInput(e), {
      signal: this.abort.signal,
    });
    root.addEventListener("change", (e) => this.onChange(e), {
      signal: this.abort.signal,
    });
    root.addEventListener(
      "play",
      (e) => {
        if (e.target.tagName !== "AUDIO" || !e.target.hasAttribute("controls"))
          return;
        // Audition one cue at a time, separate from full recipe playback.
        this.previewRun?.stop();
        const button = e.target
          .closest(".an-sound-cue")
          ?.querySelector('[data-action="audition-sound"]');
        if (button) button.textContent = "■ Stop sound";
        this.root.querySelectorAll("audio").forEach((a) => {
          if (a !== e.target) a.pause();
        });
      },
      { capture: true, signal: this.abort.signal },
    );
    root.addEventListener(
      "pause",
      (e) => {
        if (e.target.tagName !== "AUDIO") return;
        const button = e.target
          .closest(".an-sound-cue")
          ?.querySelector('[data-action="audition-sound"]');
        if (button) button.textContent = "▶ Listen";
      },
      { capture: true, signal: this.abort.signal },
    );
    root.addEventListener(
      "error",
      (event) => {
        const video = event.target;
        const mediaPreview = video.closest?.('.an-media-preview');
        if (mediaPreview) { mediaPreview.querySelector('.an-media-preview-error').hidden = false; return; }
        if (video.tagName !== "VIDEO" || !previewMediaFailed(video)) return;
        const layer = video.closest(".an-recipe-layer");
        if (layer) {
          markPreviewMediaFailure(video);
          return;
        }
        const thumb = video.closest(".an-asset-thumb");
        if (thumb) {
          thumb.querySelector("span").textContent = "No preview";
          return;
        }
        const preview = video.closest(".an-preview");
        if (preview && !preview.querySelector(".an-media-error")) {
          const message = document.createElement("div");
          message.className = "an-media-error";
          message.textContent =
            "Video unavailable. Check JB2A files, then refresh library.";
          preview.append(message);
        }
      },
      { capture: true, signal: this.abort.signal },
    );
    root.addEventListener("loadeddata", (event) => {
      const video = event.target;
      if (video.tagName !== "VIDEO") return;
      clearPreviewMediaFailure(video);
      video.closest(".an-preview")?.querySelector(".an-media-error")?.remove();
    }, { capture: true, signal: this.abort.signal });
    root.addEventListener('loadedmetadata', event => {
      const box=event.target.closest?.('.an-media-preview');
      if(box)box.querySelector('.an-media-preview-error').hidden=true;
      const video=event.target;
      if(video.tagName==='VIDEO'&&video.closest('.an-asset-thumb, .an-now-thumb')&&Number.isFinite(video.duration)&&video.duration>0)video.currentTime=Math.min(2,video.duration*.35);
    }, {capture:true,signal:this.abort.signal});
    root.addEventListener('load',event=>{
      if(event.target.tagName==='IMG')event.target.closest?.('.an-media-preview')?.querySelector('.an-media-preview-error')?.setAttribute('hidden','');
    }, {capture:true,signal:this.abort.signal});
    // Now playing thumbnails play while their row is hovered or focused, and pause after.
    const nowClip = (event, on) => {
      const row = event.target.closest?.('.an-now-row');
      if (!row || (!on && row.contains(event.relatedTarget))) return;
      const video = row.querySelector('.an-now-thumb video');
      if (on) void video?.play?.()?.catch?.(() => {}); else video?.pause?.();
    };
    for (const [type, on] of [['pointerover', true], ['pointerout', false], ['focusin', true], ['focusout', false]])
      root.addEventListener(type, (event) => nowClip(event, on), { signal: this.abort.signal });
    root.addEventListener('pointerover', event => {
      const video=event.target.closest?.('.an-asset-thumb')?.querySelector('video');
      if(video)void video.play().catch(()=>{});
    }, {signal:this.abort.signal});
    root.addEventListener('pointerout', event => {
      const thumb=event.target.closest?.('.an-asset-thumb');
      if(thumb&&!thumb.contains(event.relatedTarget))thumb.querySelector('video')?.pause();
    }, {signal:this.abort.signal});
    root.addEventListener(
      "keydown",
      (e) => {
        const dialog = this.root.querySelector('[role="dialog"]');
        if (dialog) {
          if (e.key === "Escape") {
            e.preventDefault();
            this.pendingImport = null;
            this.newChooser = false;
            this.render();
            return;
          }
          if (e.key === "Tab") {
            const controls = [
              ...dialog.querySelectorAll("button:not(:disabled),textarea"),
            ];
            const first = controls[0],
              last = controls.at(-1);
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first.focus();
            }
          }
        } else if (
          e.key === "/" &&
          !e.target.matches("input,textarea,select")
        ) {
          e.preventDefault();
          this.root.querySelector("[data-search]")?.focus();
        }
      },
      { signal: this.abort.signal },
    );
    root.addEventListener("drop", (e) => this.onDrop(e), {
      signal: this.abort.signal,
    });
    root.addEventListener("pointerdown", (e) => { if (this.page === "flash" && this.flashEditor?.pointer(e)) return; if (studioPointer(this, e)) return; this.onSplitterPointer(e); this.onTimelinePointer(e); }, { signal: this.abort.signal });
    root.addEventListener("wheel", (e) => { if (this.mediaLibrary?.wheel?.(e)) return; studioWheel(this, e); }, { passive: false, signal: this.abort.signal });
    root.addEventListener("contextmenu", (e) => studioContextMenu(this, e), { signal: this.abort.signal });
    root.addEventListener("dblclick", (e) => {
      const pathBar = e.target.closest?.("[data-tl-bar]");
      const pathStage = pathBar && this.isStudio() ? this.recipe()?.stages[Number(pathBar.dataset.tlBar)] : null;
      if (pathStage?.motion === "path" && !e.target.closest("[data-kf-diamond]")) {
        const rect = pathBar.getBoundingClientRect(), barIndex = Number(pathBar.dataset.tlBar);
        const kfs = normalizeKeyframes(pathStage.keyframes), at = (e.clientX - rect.left) / Math.max(1, rect.width), next = insertKeyframe(kfs, at);
        if (next !== kfs) { this.edit().stages[barIndex].keyframes = next; this.stageIndex = Number(pathBar.dataset.tlBar); this.keyframeIndex = next.findIndex((k) => Math.abs(k.at - Math.min(0.99, Math.max(0.01, at))) < 0.006); this.keyframeFocus = true; this.message = "Keyframe added. Save to apply."; this.render(); }
        return;
      }
      const h = e.target.closest?.("[data-splitter]"); if (h) this.setInspectorWidth(380, h.closest(".an-work, .an-studio"));
      if (e.target.closest?.("[data-st-hsplit]")) { this.studioTimelineHeight = 280; try { globalThis.localStorage?.removeItem("animater.timelineHeight"); } catch {} this.render(); }
      if (e.target.closest?.("[data-flash-hsplit]")) this.flashEditor?.resetStageHeight();
    }, { signal: this.abort.signal });
    root.addEventListener("keydown", (e) => {
      if (this.isStudio() && studioKey(this, e)) return;
      if (e.key === "Enter" && e.target.hasAttribute?.("data-finisher-add")) { e.preventDefault(); this.onChange(e); return; }
      const bar = e.target.closest?.("[data-tl-bar]"); if (bar) { this.nudgeTimeline(bar, e); return; }
      const split = e.target.closest?.("[data-splitter]");
      if (split && ["ArrowLeft", "ArrowRight"].includes(e.key)) { e.preventDefault(); this.setInspectorWidth(this.inspectorWidth() + (e.key === "ArrowLeft" ? 20 : -20), split.closest(".an-work, .an-studio")); }
    }, { signal: this.abort.signal });
    root.addEventListener(
      "dragstart",
      (e) => {
        const stage = e.target.closest("[data-stage-drag]");
        if (!stage || this.busy || ["builder", "spells", "feats", "actions", "features", "weapons", "items", "conditions", "effects"].includes(this.page))
          return;
        this.stopEditorPreview();
        this.stageDrag = Number(stage.dataset.stageDrag);
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData(
          "application/x-animater-stage",
          String(this.stageDrag),
        );
        stage.classList.add("is-dragging");
      },
      { signal: this.abort.signal },
    );
    root.addEventListener("dragend", () => this.clearStageDrag(), {
      signal: this.abort.signal,
    });
    root.addEventListener(
      "dragover",
      (e) => {
        const stage = e.target.closest("[data-stage-drag]");
        if (stage && this.stageDrag !== null && !this.busy) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          this.root
            .querySelectorAll(".is-drop-target")
            .forEach((el) => el.classList.remove("is-drop-target"));
          stage.classList.add("is-drop-target");
        }
        if (e.target.closest(".an-binding")) e.preventDefault();
      },
      { signal: this.abort.signal },
    );
    this.render();
  }
  destroy() {
    clearInterval(this.activityTimer);
    void this.mediaLibrary?.stopTokenPreview();
    this.stopEditorPreview();
    this.abort.abort();
    cancelAnimationFrame(this.motionFrame);
    this.thumbnails?.disconnect();
    this.releaseMedia();
  }
  releaseMedia() {
    this.root.querySelectorAll("video,audio").forEach((v) => {
      v.pause();
      v.removeAttribute("src");
      v.load();
    });
  }
  recipe() {
    if(this.dndCatalog?.isCatalogPage())return this.dndCatalog.recipe();
    if (["conditions", "effects"].includes(this.page)) {
      const entry = catalogStateEntry(this.selectedState[this.page === "conditions" ? "condition" : "effect"]);
      return entry && stateRecipe(entry, {damageType:this.stateDamageType,auraVariant:this.stateAuraVariant,catalog:this.host.catalog?.()});
    }
    if (this.pf2ePage() === "weapons") {
      const weapon = catalogWeapon(this.selectedWeapon), state = normalizeWeaponCatalogState(this.host.weaponCatalogState?.());
      const mode = weapon?.modes.some(m => m.mode === this.weaponMode) ? this.weaponMode : weapon?.modes[0]?.mode;
      return weapon && weaponRecipe(weapon, mode, { motion: state.motion, soundCatalog: state.sound ? this.host.soundCatalog?.() : null, soundVolume: state.soundVolume });
    }
    if (abilityProfileForPage(this.pf2ePage())) {
      const profile = abilityProfileForPage(this.pf2ePage()), feat = profile.catalog.entry(this[profile.selectedKey]);
      const state = profile.catalog.normalizeState(this.host[profile.stateKey]?.());
      return feat && profile.catalog.recipe(feat, state, this.host.soundCatalog?.());
    }
    if (this.pf2ePage() === "spells") {
      const spell = catalogSpell(this.selectedSpell);
      return (
        spell && spellRecipe(spell, undefined, catalogSoundOptions(this.host))
      );
    }
    if (this.page === "builder" && this.builder)
      return {
        ...orbRecipe(this.builder, "orb-preview", this.host.catalog()),
        previewDistance: this.builder.previewDistance ?? 3,
      };
    return this.drafts.get(this.selected) ?? this.savedRecipe();
  }
  savedRecipe() {
    const saved = this.host.recipes().find((r) => r.id === this.selected);
    return saved && validateRecipe(saved);
  }
  listedRecipes() {
    const saved = this.host.recipes();
    return [
      ...saved.map((r) => this.drafts.get(r.id) ?? r),
      ...[...this.drafts.values()].filter(
        (r) => !saved.some((old) => old.id === r.id),
      ),
    ];
  }
  edit() {
    const r = this.recipe();
    if (!r) return null;
    if (!this.drafts.has(r.id)) this.drafts.set(r.id, clone(r));
    this.dirty.add(r.id);
    return this.drafts.get(r.id);
  }
  motionBlocked(recipe) {
    const env = this.host.environment();
    return (
      !env.demo &&
      env.motionReady === false &&
      recipe.stages.some((s) => s.kind === "motion" || s.kind === "tokenfx" && !s.catalogFx && this.host.fxCatalog?.().tokenReady)
    );
  }
  status(recipe) {
    if (this.motionBlocked(recipe)) return "Token motion channel unavailable";
    if (
      recipe.stages.some(
        (s) =>
          !["motion", "sprite", "sound"].includes(s.kind) && !OPTIONAL_FX_KINDS.has(s.kind) && !s.assets.length,
      )
    )
      return "Choose an asset";
    for(const stage of recipe.stages.filter(s=>OPTIONAL_FX_KINDS.has(s.kind))) {
      const issue=fxAvailability(stage,this.host.fxCatalog?.());
      if(issue&&!stage.catalogFx)return issue;
    }
    if (recipe.stages.some((s) => s.kind === "sound" && !s.soundFile?.trim()))
      return "Choose an audio file";
    // Every recipe card checks its stages: index the catalog once per render.
    const catalog = renderMemo(this.host, "catalogIndex", () => catalogIndex(this.host.catalog()), () => this.host.catalog());
    const missing = recipe.stages.filter(
      (s) =>
        !["motion", "sprite", "sound"].includes(s.kind) && !OPTIONAL_FX_KINDS.has(s.kind) &&
        !resolveAsset(s, catalog),
    );
    return missing.length
      ? `${missing.length} missing asset${missing.length > 1 ? "s" : ""}`
      : "Ready to play";
  }
  // Picked-only catalogs: a card's ✓ adds or removes just that entry.
  catalogStore() {
    const host = this.host, profile = abilityProfileForPage(this.pf2ePage());
    if (this.pf2ePage() === "spells") return { get: () => normalizeCatalogState(host.catalogState()), set: (c) => host.setCatalogState(c), use: useCatalogSpell };
    if (profile) return { get: () => profile.catalog.normalizeState(host[profile.stateKey]()), set: (c) => host[profile.setStateKey](c), use: profile.catalog.use };
    if (this.pf2ePage() === "weapons") return { get: () => normalizeWeaponCatalogState(host.weaponCatalogState?.()), set: (c) => host.setWeaponCatalogState(c), use: useCatalogWeapon };
    if (["conditions", "effects"].includes(this.page)) {
      const kind = this.page === "conditions" ? "condition" : "effect";
      return { get: () => normalizeStateCatalogState(host.stateCatalogState?.(kind)), set: (c) => host.setStateCatalogState(kind, c), use: useStateEntry };
    }
    return null;
  }
  async toggleCardInclude(id) {
    const env = this.host.environment(), store = this.catalogStore();
    if (!store || !id) return;
    if (env.demo || !pf2eCatalogsLive(env) || !env.ready) throw Error("Choose plug & play animations inside a PF2e world with Sequencer and JB2A active.");
    const state = store.get(), included = state.enabled && state.selected.includes(id);
    await store.set(included ? { selected: state.selected.filter((v) => v !== id) } : store.use(state, id));
    this.message = included ? "Removed from plug & play." : "Added to plug & play. It plays automatically; other entries stay manual.";
    this.render();
  }
  // Setup problems shown on every page: Sequencer first, then missing JB2A artwork.
  envBannerHTML(env) {
    const message = !env.ready ? env.problem : env.jb2a === false ? JB2A_MISSING : "";
    return message ? `<div class="an-warning" role="alert">${esc(message)} <button data-action="page" data-page="setup">Open setup →</button></div>` : "";
  }
  isStudio() { return ["recipes", "finishers"].includes(this.page) && !!this.studio && !!this.recipe(); }
  navItemsHTML(env) {
    const count = (n) => (n > 0 ? `<small>${n}</small>` : "");
    const flash = this.host.flashScreens;
    const listed = this.listedRecipes();
    const counts = {
      recipes: listed.filter((r) => !r.finisher).length,
      finishers: listed.filter((r) => r.finisher).length,
      flash: typeof flash === "function" && Array.isArray(flash.call(this.host)) ? flash.call(this.host).length : 0,
    };
    const item = ([page, icon, name]) =>
      `<button class="an-nav-item ${this.page === page ? "is-active" : ""}" data-action="page" data-page="${page}"><span>${icon}</span><b>${name}</b>${count(counts[page] || 0)}</button>`;
    if (this.host.playerMode) {
      return [["recipes", "✦", this.host.reviewing?.() ? `${esc(this.host.reviewing().userName)}'s animations` : "My animations"], ["assets", "▦", "Assets"]].map(item).join("");
    }
    const group = (caption, items) => `<div class="an-nav-caption">${caption}</div>${items.map(item).join("")}`;
    return [
      group("CREATE", [["recipes", "✦", "Recipes"], ["finishers", "✸", "Finishers"], ...(flash ? [["flash", "⚡", "Flash screens"]] : [])]),
      group("LIBRARY", [...catalogNavigation(env), ["assets", "▦", "Assets"]]),
      ...(borrowedNavigation(env).length ? [group(`BORROWED FROM ${borrowedSystem(env).toUpperCase()}`, borrowedNavigation(env))] : []),
      group("TOOLS", [["activity", "◷", "Activity"], ["setup", "⚙", "Setup"]]),
    ].join("");
  }
  // The PF2e catalog page on screen: the page itself in a PF2e world, a borrowed pf2e-* page in an SF2e one.
  pf2ePage() { return pf2eCatalogPage(this.page, this.host.environment?.() ?? {}); }
  render() { return withRenderMemo(this, () => this.renderPage()); }
  renderPage() {
    if(this.page!=='assets'||this.mediaLibrary?.fxScene)void this.mediaLibrary?.stopTokenPreview();
    if(!catalogPageAllowed(this.page,this.host.environment()))this.page='recipes';
    if (abilityProfileForPage(this.pf2ePage())&&!this.dndCatalog?.isCatalogPage()) {
      const profile = abilityProfileForPage(this.pf2ePage()), matches = profile.catalog.filter(this[profile.filtersKey] ?? defaultAbilityFilters());
      if (!matches.some((feat) => feat.id === this[profile.selectedKey]))
        this[profile.selectedKey] = matches[0]?.id;
    }
    const openGroups = [
      ...this.root.querySelectorAll("details[data-options-group][open]"),
    ].map((e) => e.dataset.optionsGroup);
    this.stopEditorPreview();
    this.stageDrag = null;
    cancelAnimationFrame(this.motionFrame);
    this.thumbnails?.disconnect();
    const scrollKeys = {
      ".an-inspector": `${this.page}:${this.dndCatalog?.isCatalogPage()?this.dndCatalog.entry()?.id:this.pf2ePage() === "spells" ? this.selectedSpell : abilityProfileForPage(this.pf2ePage()) ? this[abilityProfileForPage(this.pf2ePage()).selectedKey] : this.selected}`,
      ".an-library": `${this.page}:${this.search}:${this.category}`,
      ".an-asset-list": `${this.page}:${JSON.stringify(this.mediaLibrary?.filters)}:${this.mediaLibrary?.page}`,
      ".an-media-detail-body": `${this.page}:${this.mediaLibrary?.selectedId}`,
      ".an-builder": this.page,
      ".an-spell-library": this.dndCatalog?.isCatalogPage()?`${this.page}:${JSON.stringify(this.dndCatalog.filters)}:${this.dndCatalog.pages[this.dndCatalog.kind]}`:`${this.page}:${JSON.stringify(this.spellFilters)}:${this.spellPage}`,
      ".an-feat-library": `${this.page}:${JSON.stringify(this[abilityProfileForPage(this.pf2ePage())?.filtersKey])}:${this[abilityProfileForPage(this.pf2ePage())?.pageKey]}`,
    };
    const scroll = Object.fromEntries(
      Object.entries(scrollKeys).map(([selector, key]) => [
        selector,
        this.renderedScrollKeys?.[selector] === key
          ? (this.root.querySelector(selector)?.scrollTop ?? 0)
          : 0,
      ]),
    );
    const active = document.activeElement;
    const focus =
      active &&
      this.root.contains(active) &&
      (active.dataset.field || active.dataset.search || active.dataset.builder)
        ? {
            field: active.dataset.field,
            builder: active.dataset.builder,
            search: active.dataset.search,
            index: active.dataset.index,
            track: active.dataset.track,
            start: active.selectionStart,
            end: active.selectionEnd,
          }
        : null;
    const recipe = this.recipe();
    const env = this.host.environment();
    patchDOM(
      this.root,
      `<div class="an-shell${this.isStudio() || (this.page === "flash" && this.flashEditor?.editing) ? " is-studio" : ""}">
      <aside class="an-nav"><div class="an-brand"><span class="an-logo">A</span><div>Animater<small>MAKE EVERY MOMENT FELT</small></div></div>
        ${this.navItemsHTML(env)}
        <div class="an-nav-bottom"><div class="an-pack"><span class="an-dot ${env.ready && env.jb2aRegistered !== false ? "is-ready" : ""}" ${env.jb2aRegistered === false ? `data-tooltip="${esc(env.pack)} is active, but Sequencer has no JB2A animations. See Setup."` : ""}></span><div>${esc(env.pack)}<small>${this.host.catalog().length.toLocaleString()} asset variants</small></div></div><button data-action="stop" class="an-stop">■ Stop my effects</button><small class="an-version">${env.version ? `v${esc(env.version)} · ` : ""}${esc(env.system)}${env.demo ? " · PREVIEW" : ""}</small></div>
      </aside>
      <main class="an-main">${this.isStudio() || (this.page === "flash" && (this.flashEditor?.editing || !this.host.flashScreens)) ? "" : `<header class="an-header"><div><div class="an-eyebrow">${this.page === "recipes" ? "YOUR EFFECTS, YOUR STYLE" : this.page === "finishers" ? "FINISHING BLOWS, YOUR WAY" : this.page === "flash" ? "TITLE CARDS FOR EVERY FIGHT" : "ANIMATER WORKSPACE"}</div><h1>${esc(catalogPageTitle(this.page,env))}</h1></div><div class="an-header-actions">${this.page === "recipes" ? `<button data-action="export" class="an-quiet">↗ Export</button><button data-action="import" class="an-quiet">↙ Import</button><button data-action="new" class="an-primary">+ New recipe</button>` : this.page === "finishers" ? `<button data-action="new-finisher" class="an-primary">+ New finisher</button>` : this.page === "builder" ? `<button data-action="cancel-builder">Back to recipes</button>` : this.page === "flash" ? this.flashEditor?.showGallery ? "" : `<button data-action="flash-export" class="an-quiet" ${this.host.flashScreens().length ? "" : "disabled"}>↗ Export</button><button data-action="flash-import" class="an-quiet">↙ Import</button><button data-action="flash-new" class="an-primary">+ New flash screen</button>` : ""}</div></header>`}
        <div role="status" aria-live="polite" class="an-toast ${this.message ? "is-visible" : ""}">${esc(this.message)}</div>
        ${this.reviewBannerHTML()}
        ${env.demo ? `<div class="an-demo">DESIGN PREVIEW <span>Real installed JB2A videos. Canvas playback and game triggers require Foundry.</span></div>` : ""}
        ${this.envBannerHTML(env)}
        ${this.page === "flash" && this.host.flashScreens ? (this.flashEditor ??= new FlashEditor(this)).html() : this.dndCatalog?.isCatalogPage()?this.dndCatalog.html():this.page === "builder" ? this.builderHTML() : this.pf2ePage() === "spells" ? spellCatalogHTML(this) : abilityProfileForPage(this.pf2ePage()) ? featCatalogHTML(this, abilityProfileForPage(this.pf2ePage())) : this.pf2ePage() === "weapons" ? weaponCatalogHTML(this) : ["conditions", "effects"].includes(this.page) ? stateCatalogHTML(this) : this.page === "finishers" ? finishersPageHTML(this, recipe) : this.page === "recipes" ? this.recipesHTML(recipe) : this.page === "assets" ? this.assetsHTML(recipe) : this.page === "activity" ? this.activityHTML() : this.setupHTML(env)}
      </main>${this.pendingImport !== null ? this.importHTML() : ""}${this.newChooser ? this.newChooserHTML() : ""}</div>`,
    );
    this.root.querySelectorAll("details[data-options-group]").forEach((e) => {
      e.open = openGroups.includes(e.dataset.optionsGroup);
    });
    // The flash stage is drawn after the page, at the editor's current time.
    this.watchActivity();
    if (this.page === "flash") this.flashEditor?.mount(); else if (this.flashEditor?.preview) { this.flashEditor.preview.stop(); this.flashEditor.preview = null; }
    this.root.querySelectorAll("audio[data-cue-volume]").forEach((audio) => {
      audio.volume = Number(audio.dataset.cueVolume);
    });
    if (focus) {
      const el = [...this.root.querySelectorAll("input,select,textarea")].find(
        (e) =>
          focus.builder
            ? e.dataset.builder === focus.builder
            : focus.search
              ? e.dataset.search === focus.search
              : e.dataset.field === focus.field &&
                e.dataset.index === focus.index &&
                e.dataset.track === focus.track,
      );
      if (el) {
        el.focus({ preventScroll: true });
        if (
          typeof focus.start === "number" &&
          el.setSelectionRange &&
          !["number", "color", "checkbox"].includes(el.type)
        )
          el.setSelectionRange(focus.start, focus.end);
      }
    }
    if (this.previewMode === "stage") this.startMotionPreview(recipe);
    for (const [selector, top] of Object.entries(scroll)) {
      const element = this.root.querySelector(selector);
      if (element) element.scrollTop = top;
    }
    this.renderedScrollKeys = scrollKeys;
    if (this.busy)
      this.root
        .querySelectorAll(
          ".an-inspector input,.an-inspector textarea,.an-inspector select,.an-builder input,.an-builder-controls button",
        )
        .forEach((el) => {
          el.disabled = true;
        });
    this.observeThumbnails();
    if (this.isStudio()) studioAfterRender(this);
    if(this.page==='assets') { this.mediaLibrary?.syncPreview(); void this.mediaLibrary?.load(); }
  }
  observeThumbnails() {
    this.thumbnails?.disconnect();
    const videos = this.root.querySelectorAll(".an-asset-thumb video");
    if (videos.length) {
      this.thumbnails = new IntersectionObserver(
        (entries) => {
          for (const entry of entries)
            if (entry.isIntersecting) {
              const video = entry.target;
              video.preload = "metadata";
              this.loadedThumbnails ??= new WeakSet();
              if(!this.loadedThumbnails.has(video)){video.load();this.loadedThumbnails.add(video);}
              this.thumbnails.unobserve(video);
            }
        },
        { root: this.root.querySelector(".an-asset-list") },
      );
      videos.forEach((v) => this.thumbnails.observe(v));
    }
  }
  stageLabel(stage) {
    if (stage.label) return stage.label;
    return stage.kind === "motion"
      ? `${stage.subject === "targets" ? "Target" : "Source"} · ${{ lunge: "Lunge", recoil: "Recoil", shake: "Shake", spin: "Spin", levitate: "Rise", pulse: "Pulse", rush: "Rush", leap: "Leap", roll: "Roll", dodge: "Dodge" }[stage.motion] ?? "Motion"}`
      : KINDS[stage.kind];
  }
  updateInspector() { return withRenderMemo(this, () => this.patchInspector()); }
  patchInspector() {
    if (this.isStudio()) return this.render();
    const inspector = this.root.querySelector(".an-inspector");
    if (!inspector) return this.render();
    this.stopEditorPreview();
    cancelAnimationFrame(this.motionFrame);
    const top = inspector.scrollTop;
    const groups = [...inspector.querySelectorAll("details[open]")].map(
      (e) => e.dataset.optionsGroup,
    );
    patchDOM(inspector, this.inspectorHTML(this.recipe()));
    for (const details of inspector.querySelectorAll("details"))
      details.open = groups.includes(details.dataset.optionsGroup);
    inspector.scrollTop = top;
    if (this.previewMode === "stage") this.startMotionPreview(this.recipe());
  }
  inspectorWidth() {
    if (this.panelWidth === undefined) {
      let stored = NaN;
      try { stored = Number(globalThis.localStorage?.getItem("animater.inspectorWidth")); } catch {}
      this.panelWidth = Number.isFinite(stored) && stored >= 300 ? stored : 380;
    }
    // A width saved in a bigger window is shown no wider than this one leaves room for
    // (62px nav, 8px splitter, 320px for the stage and timeline); the saved width is kept.
    const width = this.root?.getBoundingClientRect?.().width;
    return width ? Math.min(this.panelWidth, Math.max(300, Math.round(width - 390))) : this.panelWidth;
  }
  setInspectorWidth(px, work) {
    const max = Math.max(320, (work?.getBoundingClientRect().width ?? 1200) - 260);
    this.panelWidth = Math.round(Math.min(max, Math.max(300, px)));
    work?.style.setProperty("--an-inspector-width", `${this.panelWidth}px`);
    try { globalThis.localStorage?.setItem("animater.inspectorWidth", String(this.panelWidth)); } catch {}
  }
  onSplitterPointer(e) {
    const handle = e.target.closest?.("[data-splitter]");
    if (!handle || e.button !== 0) return;
    e.preventDefault();
    const work = handle.closest(".an-work, .an-studio"), right = work.getBoundingClientRect().right;
    handle.setPointerCapture?.(e.pointerId);
    handle.classList.add("is-active");
    const move = ev => this.setInspectorWidth(right - ev.clientX, work);
    const up = () => { handle.classList.remove("is-active"); handle.removeEventListener("pointermove", move); handle.removeEventListener("pointerup", up); handle.removeEventListener("pointercancel", up); };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
    handle.addEventListener("pointercancel", up);
  }
  timelineWhen(s, r) {
    if (s.startMode) {
      const ref = r.stages.find(o => o.stageId === s.afterStage);
      const name = ref ? this.stageLabel(ref) : "previous stage";
      return s.startMode === "with" ? `with ${name}` : `after ${name}${s.startOffset > 0 ? ` +${(s.startOffset / 1000).toFixed(2)}s` : ""}`;
    }
    return s.afterStage ? "linked" : `at ${(s.delay / 1000).toFixed(2)}s`;
  }
  timelineBarHTML(r, row, index, total) {
    const pct = ms => ((ms / total) * 100).toFixed(3);
    const i = row.index, s = r.stages[i], name = this.stageLabel(s), when = this.timelineWhen(s, r), length = ((row.end - row.start) / 1000).toFixed(2);
    // A random-variant group is one stacked clip with numbered tabs on top: click one to edit it, + adds another.
    const members = variantMembers(r.stages, s.variantGroup), deck = members.length > 1;
    const tabs = deck ? `<div class="an-tl-variant-tabs" style="left:${pct(row.start)}%;width:${pct(row.end - row.start)}%" role="tablist" aria-label="Random variants">${members.map((m, n) => { const at = r.stages.indexOf(m); return `<button role="tab" data-action="variant-pick" data-variant-pick="${at}" class="${m === s ? "is-on" : ""}" aria-selected="${m === s}" data-tooltip="Variant ${n + 1}: ${esc(this.stageLabel(m))}">${n + 1}</button>`; }).join("")}<button data-action="variant-add" data-variant-pick="${i}" data-tooltip="Add a random variant" aria-label="Add a random variant">+</button></div>` : "";
    return `${tabs}<div class="an-tl-bar kind-${esc(s.kind)}${deck ? " is-deck" : ""}${deck && members.includes(r.stages[index]) || i === index ? " is-selected" : ""}" data-tl-bar="${i}" data-stage-drag="${i}" tabindex="0" role="slider" aria-label="${esc(name)}: start time" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${row.start}" aria-valuetext="${esc(when)}, ${length} seconds" data-tooltip="${esc(name)} · ${esc(when)} · ${length}s" style="left:${pct(row.start)}%;width:${pct(row.end - row.start)}%"><span class="an-tl-bar-label">${deck ? `🎲 ${esc(name.replace(/ · variant \d+$/, ""))}` : esc(name)}</span><small class="an-tl-bar-when">${esc(when)}</small>${s.kind === "motion" && s.motion === "path" ? keyframeDiamondsHTML(s, i, i === index ? this.selectedKeyframe(s) : -1) : ""}<span class="an-tl-resize" data-tl-resize="${i}" data-tooltip="Drag to change length"></span></div>`;
  }
  // The selected keyframe of a path stage, kept inside its keyframe list.
  selectedKeyframe(s) { return Math.max(0, Math.min(keyframesOf(s).length - 1, this.keyframeIndex ?? 0)); }
  // Diamonds: click selects a keyframe, dragging an inner one retimes it inside its neighbours.
  dragKeyframeTime(diamond, e) {
    e.preventDefault(); e.stopPropagation();
    const stageIndex = Number(diamond.dataset.kfStage), index = Number(diamond.dataset.kfDiamond), bar = diamond.closest("[data-tl-bar]");
    this.stageIndex = stageIndex; this.keyframeIndex = index; this.keyframeFocus = true;
    const kfs = keyframesOf(this.recipe()?.stages[stageIndex]);
    if (index === 0 || index === kfs.length - 1 || !bar) { this.render(); return; }
    const rect = bar.getBoundingClientRect();
    let at = kfs[index].at, moved = false;
    const move = (ev) => { moved = true; at = Math.min(1, Math.max(0, (ev.clientX - rect.left) / Math.max(1, rect.width))); diamond.style.left = `${(at * 100).toFixed(2)}%`; };
    const up = () => {
      diamond.removeEventListener("pointermove", move); diamond.removeEventListener("pointerup", up); diamond.removeEventListener("pointercancel", up);
      const s = moved ? this.edit()?.stages[stageIndex] : null;
      if (s) { s.keyframes = moveKeyframeTime(normalizeKeyframes(s.keyframes), index, at); this.message = "Keyframe retimed. Save to apply."; }
      this.render();
    };
    diamond.setPointerCapture?.(e.pointerId);
    diamond.addEventListener("pointermove", move); diamond.addEventListener("pointerup", up); diamond.addEventListener("pointercancel", up);
  }
  timelineX(total, ms) { return `calc(var(--tl-label) + (100% - var(--tl-label)) * ${Math.max(0, Math.min(1, ms / total))})`; }
  onTimelinePointer(e) {
    if (e.target.closest?.(".an-tl-variant-tabs")) return;
    const diamond = e.target.closest?.("[data-kf-diamond]");
    if (diamond && !this.busy && e.button === 0) { this.dragKeyframeTime(diamond, e); return; }
    const bar = e.target.closest?.("[data-tl-bar]");
    if (!bar || this.busy || e.button !== 0) return;
    e.preventDefault();
    const i = Number(bar.dataset.tlBar), resize = !!e.target.closest("[data-tl-resize]");
    const r = this.recipe(), tl = bar.closest(".an-tl"), total = Number(tl.dataset.tlTotal);
    const msPerPx = total / Math.max(1, bar.parentElement.getBoundingClientRect().width);
    const layout = timelineLayout(r), row = layout.rows[i];
    const others = layout.rows.filter(o => o.index !== i).map(o => ({ stageId: o.stageId, start: o.start, end: o.end, name: this.stageLabel(r.stages[o.index]) }));
    if (this.isStudio()) others.push({ stageId: "__playhead", start: this.studioTime ?? 0, end: this.studioTime ?? 0, name: "playhead" });
    const playheadSnap = (ms) => this.isStudio() && Math.abs(ms - (this.studioTime ?? 0)) <= 10 * msPerPx ? this.studioTime ?? 0 : null;
    const guide = tl.querySelector("[data-tl-guide]"), x0 = e.clientX;
    let result = null;
    bar.setPointerCapture?.(e.pointerId);
    bar.classList.add("is-moving");
    const show = (ms, text) => { guide.hidden = false; guide.style.left = this.timelineX(total, ms); guide.querySelector("span").textContent = text; };
    const move = ev => {
      const dms = (ev.clientX - x0) * msPerPx;
      if (Math.abs(ev.clientX - x0) < 3 && !result) return;
      if (resize) {
        const end = ev.altKey ? null : playheadSnap(row.end + dms);
        const duration = Math.max(100, end !== null && end > row.start ? end - row.start : Math.round((row.end - row.start + dms) / 50) * 50);
        bar.style.width = `${(duration / total) * 100}%`;
        result = { duration };
        show(row.start + duration, `${(duration / 1000).toFixed(2)}s long`);
        return;
      }
      let ms = Math.max(0, row.start + dms);
      let snap = ev.altKey ? null : snapStart(ms, others, 10 * msPerPx);
      ms = snap ? snap.at : Math.round(ms / 50) * 50;
      const onPlayhead = snap?.ref === "__playhead";
      if (onPlayhead) snap = null;
      bar.style.left = `${(ms / total) * 100}%`;
      result = { ms, snap };
      const ref = snap && others.find(o => o.stageId === snap.ref);
      show(ms, snap ? `${snap.mode === "with" ? "Starts with" : "Starts after"} ${ref.name}` : onPlayhead ? `Starts at playhead ${(ms / 1000).toFixed(2)}s` : `Starts at ${(ms / 1000).toFixed(2)}s`);
    };
    const up = ev => {
      bar.releasePointerCapture?.(ev.pointerId);
      bar.removeEventListener("pointermove", move);
      bar.removeEventListener("pointerup", up);
      bar.removeEventListener("pointercancel", up);
      guide.hidden = true;
      if (this.stageIndex !== i) { this.keyframeIndex = 0; this.keyframeFocus = false; }
      this.stageIndex = i;
      if (result && ev.type === "pointerup") this.applyTimelineEdit(i, result);
      else this.render();
    };
    bar.addEventListener("pointermove", move);
    bar.addEventListener("pointerup", up);
    bar.addEventListener("pointercancel", up);
  }
  applyTimelineEdit(i, result) {
    this.stopEditorPreview();
    const r = this.edit();
    if (!r) return;
    const s = r.stages[i], snapshot = clone(r.stages);
    if (result.duration) s.duration = result.duration;
    else if (result.snap) { s.startMode = result.snap.mode; s.startRef = result.snap.ref; s.startOffset = 0; }
    else { delete s.startMode; delete s.startRef; s.afterStage = ""; s.delay = Math.round(result.ms); }
    linkStartModes(r.stages);
    try { timedStages(r, 0); this.message = "Timeline updated. Save recipe to apply."; }
    catch { r.stages = snapshot; this.message = "Those stages would wait on each other. Choose a stage that starts earlier."; }
    this.render();
  }
  nudgeTimeline(bar, e) {
    if ((e.key === "Enter" || e.key === " ") && !this.busy) { e.preventDefault(); this.stageIndex = Number(bar.dataset.tlBar); this.keyframeIndex = 0; this.keyframeFocus = false; this.render(); this.root.querySelector(`[data-tl-bar="${this.stageIndex}"]`)?.focus(); return true; }
    if (!["ArrowLeft", "ArrowRight"].includes(e.key) || this.busy) return false;
    e.preventDefault();
    const i = Number(bar.dataset.tlBar), row = timelineLayout(this.recipe()).rows[i];
    const step = (e.shiftKey ? 500 : 50) * (e.key === "ArrowLeft" ? -1 : 1);
    if (e.altKey) this.applyTimelineEdit(i, { duration: Math.max(100, row.end - row.start + step) });
    else this.applyTimelineEdit(i, { ms: Math.max(0, row.start + step) });
    this.root.querySelector(`[data-tl-bar="${i}"]`)?.focus();
    return true;
  }
  stageStartLabel(stage, recipe) {
    if (stage.startMode) {
      const ref = stage.startRef ? recipe.stages.findIndex(o => o.stageId === stage.startRef) + 1 : 0;
      const target = ref ? String(ref) : "↑";
      const gap = stage.startMode === "after" && stage.startOffset > 0 ? ` +${stage.startOffset}ms` : "";
      return `${stage.startMode} ${target}${gap}`;
    }
    if (!stage.afterStage) return `${stage.delay}ms`;
    const resolved = sampleRecipe(recipe).stages.find(
      (s) => s.stageId === stage.stageId,
    );
    return `↳ ${resolved.delay}ms`;
  }
  syncPreviewTokens({ clear = false } = {}) {
    if (this.busy || !["recipes", "finishers", "builder", "spells", "feats", "actions", "features", "weapons", "items", "conditions", "effects"].includes(this.page))
      return;
    const scene = this.root.querySelector("[data-recipe-scene]");
    if (!scene) return;
    const tokens = clear ? {} : (this.host.previewTokens?.() ?? {});
    if (scene.dataset.previewTokens === JSON.stringify(tokens)) return;
    const recipe = this.recipe();
    if (!recipe) return;
    this.stopEditorPreview();
    patchDOM(scene.parentElement, this.recipePreviewHTML(recipe, tokens));
    const progress = this.root.querySelector("[data-recipe-progress]");
    if (progress) progress.value = 0;
    const time = this.root.querySelector("[data-preview-time]");
    if (time)
      time.textContent = `0.0 / ${(this.previewDuration(recipe) / 1000).toFixed(1)}s`;
    const status = this.root.querySelector("[data-preview-status]");
    if (status) status.textContent = "Ready · canvas tokens updated";
  }
  recipePreviewHTML(recipe, tokens = this.host.previewTokens?.() ?? {}) {
    recipe = previewRecipeSounds(previewVariants(recipe, this.stageIndex), this.host.soundCatalog?.());
    if (
      recipe.stages.every(
        (s) =>
          !["motion", "sprite", "sound"].includes(s.kind) && !OPTIONAL_FX_KINDS.has(s.kind) && !s.assets.length,
      )
    )
      return `<div class="an-preview-empty" data-recipe-scene data-preview-tokens="${esc(JSON.stringify(tokens))}" data-preview-grid-distance="${Number(tokens.gridDistance) || 5}" aria-label="Unconfigured recipe preview">◇<small>Choose an asset or token motion to begin</small></div>`;
    const chain = chainPreview(recipe, tokens);
    if (chain) return this.chainPreviewHTML(chain, tokens);
    const filterPrefix = `an-tint-${uuid()}`;
    const tokenHTML = (subject, fallback, icon) => {
      const token = tokens[subject];
      return this.previewActorHTML({ subject, token, name: fallback, icon });
    };
    const catalog = this.host.catalog();
    return `<div class="an-recipe-scene ${recipe.lifecycle === "document" ? "is-state-preview" : ""}" data-recipe-scene data-preview-tokens="${esc(JSON.stringify(tokens))}" data-preview-grid-distance="${Number(tokens.gridDistance) || 5}" aria-label="Full recipe composition preview">${recipe.stages
      .map((s, index) => {
        s = { ...s, ...normalizeOptions(s) };
        const filterId = `${filterPrefix}-${index}`;
        const rgb = [1, 3, 5].map(
          (offset) => parseInt(s.tint.slice(offset, offset + 2), 16) / 255,
        );
        const tintFilter = s.tintEnabled
          ? `<svg class="an-tint-filter" aria-hidden="true"><defs><filter id="${filterId}" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="${rgb[0]} 0 0 0 0 0 ${rgb[1]} 0 0 0 0 0 ${rgb[2]} 0 0 0 0 0 1 0"/></filter></defs></svg>`
          : "";
        if (s.kind === "motion") return "";
        if(OPTIONAL_FX_KINDS.has(s.kind))return this.optionalFxPreviewHTML(s, s.index ?? index);
        if (s.kind === "sound")
          return s.skipSound
            ? ""
            : `<audio preload="auto" src="${esc(this.host.mediaURL?.(s.soundFile) ?? s.soundFile)}" data-preview-stage="${index}"></audio>`;
        const key = resolveAsset(s, catalog);
        const media = mediaForReference(catalog, key);
        const file = media?.file;
        const placement =
          s.kind === "travel"
            ? "travel"
            : s.kind === "impact" ||
                s.kind === "template" ||
                s.subject === "targets"
              ? "targets"
              : s.kind === "overlay"
                ? "overlay"
                : "source";
        if (s.kind === "sprite") {
          const token = tokens[s.subject ?? "source"];
          return Array.from(
            { length: s.copies ?? 1 },
            (_, copy) =>
              `<div hidden class="an-recipe-layer an-copy-layer is-${placement}" data-layer-stage="${index}" data-copy="${copy}" data-tint-filter="${filterId}">${copy === 0 ? tintFilter : ""}<div class="an-copy-art">${token?.img ? `<img src="${esc(token.img)}" alt="Token copy">` : "✦"}</div></div>`,
          ).join("");
        }
        return `<div hidden class="an-recipe-layer is-${placement} ${file ? "" : "is-unavailable"}" data-layer-stage="${index}" data-tint-filter="${filterId}" data-preview-template="${esc(JSON.stringify(media?.template ?? null))}" data-media-width="${media?.width ?? 0}" data-media-height="${media?.height ?? 0}" style="--stage-scale:${s.kind === "travel" ? 1 : s.scale};opacity:${s.opacity};z-index:${s.below ? 1 : 3}" ${file ? "" : 'aria-label="Missing asset"'}>${tintFilter}${file ? this.visualMediaHTML(file,`data-preview-stage="${index}" aria-label="Stage ${index + 1}: ${esc(this.stageLabel(s))}"`) : "Missing asset"}</div>`;
      })
      .join(
        "",
      )}${tokenHTML("source", recipe.lifecycle === "document" ? "Affected token" : "Source", "✦")}${recipe.lifecycle === "document" ? "" : tokenHTML("targets", "Target", "◇")}<span class="an-preview-label">${recipe.lifecycle === "document" ? "SUSTAINED LOOP · SAMPLE" : "FULL RECIPE · COMPOSITION"}</span><span class="an-preview-idle" data-preview-idle>${recipe.lifecycle === "document" ? "Preview on affected token" : "Play every stage together"}</span></div>`;
  }
  previewDuration(recipe) {
    recipe = previewRecipeSounds(recipe, this.host.soundCatalog?.());
    return recipeDuration(
      chainPreview(recipe, this.host.previewTokens?.() ?? {})?.recipe ?? recipe,
    );
  }
  // Small looping thumbnail of the chosen visual asset (paused off-screen by the browser).
  assetThumbHTML(file) {
    if (!file) return '<span class="an-asset-thumb-mini is-empty" aria-hidden="true">◇</span>';
    return `<span class="an-asset-thumb-mini" aria-hidden="true">${this.visualMediaHTML(file, 'autoplay preload="metadata" data-asset-thumb')}</span>`;
  }
  visualMediaHTML(file, attributes='') {
    const url=esc(this.host.mediaURL?.(file)??file);
    return mediaType(file)==='image'?`<img src="${url}" alt="Effect artwork" ${attributes}>`:`<video muted playsinline loop preload="auto" src="${url}" ${attributes}></video>`;
  }
  previewActorHTML({ subject, token, name, icon, x, y, id, targetIndex }) {
    const dimension = (value, fallback = 1) =>
      Number.isFinite(Number(value)) && Number(value) > 0
        ? Number(value)
        : fallback;
    const width = dimension(token?.width) * 55;
    const height = dimension(token?.height) * 55;
    const spriteWidth = dimension(token?.spriteWidth, width / 55) * 55;
    const spriteHeight = dimension(token?.spriteHeight, height / 55) * 55;
    const sx = token?.textureScaleX < 0 ? -1 : 1;
    const sy = token?.textureScaleY < 0 ? -1 : 1;
    const rotation = Number(token?.rotation) || 0;
    const top =
      y === undefined
        ? `calc(45% + 27px - ${height / 2}px)`
        : `calc(${y}% - ${height / 2}px)`;
    const style = `width:${width}px;margin-left:${-width / 2}px;top:${top}${x === undefined ? "" : `;left:${x}%`}`;
    const art = token?.img
      ? `<img src="${esc(token.img)}" alt="${esc(token.name ?? name)}" style="position:absolute;left:50%;top:50%;width:${spriteWidth}px;height:${spriteHeight}px;max-width:none;max-height:none;transform:translate(-50%,-50%) rotate(${rotation}deg) scale(${sx},${sy})">`
      : icon;
    return `<div class="an-recipe-actor is-${subject}" style="${style}"><div class="an-recipe-token" style="position:relative;width:${width}px;height:${height}px" data-preview-token="${subject}" ${id ? `data-preview-actor="${esc(id)}"` : ""} ${targetIndex === undefined ? "" : `data-target-index="${targetIndex}"`}><span class="an-preview-token-art">${art}</span></div><small>${esc(token?.name ?? name)}</small></div>`;
  }
  chainPreviewHTML(chain, tokens) {
    const catalog = this.host.catalog();
    const filterPrefix = `an-chain-${Math.random().toString(36).slice(2, 9)}`;
    const actors = chain.actors
      .map((a) =>
        this.previewActorHTML({
          ...a,
          icon: a.subject === "source" ? "✦" : "◇",
        }),
      )
      .join("");
    const layers = chain.recipe.playbackPlan
      .map((s, planIndex) => {
        s = { ...s, ...normalizeOptions(s) };
        if (s.kind === "motion") return "";
        if(OPTIONAL_FX_KINDS.has(s.kind))return this.optionalFxPreviewHTML(s, s.index);
        if (s.kind === "sound")
          return s.skipSound
            ? ""
            : `<audio preload="auto" src="${esc(this.host.mediaURL?.(s.soundFile) ?? s.soundFile)}" data-preview-stage="${s.index}" data-preview-plan="${planIndex}"></audio>`;
        const key = resolveAsset(s, catalog),
          media = mediaForReference(catalog,key),
          file = media?.file;
        const destination =
          chain.actors.find((a) => a.id === s.destination?.id) ??
          chain.actors[s.kind === "template" ? 1 : 0];
        const from = ["travel", "projectile"].includes(s.kind)
            ? s.origin.id
            : "source",
          to = ["travel", "projectile"].includes(s.kind)
            ? s.endpoint.id
            : destination.id;
        const filterId = `${filterPrefix}-${planIndex}`;
        const rgb = [1, 3, 5].map(
          (offset) => parseInt(s.tint.slice(offset, offset + 2), 16) / 255,
        );
        const tintFilter = s.tintEnabled
          ? `<svg class="an-tint-filter" aria-hidden="true"><defs><filter id="${filterId}" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="${rgb[0]} 0 0 0 0 0 ${rgb[1]} 0 0 0 0 0 ${rgb[2]} 0 0 0 0 0 1 0"/></filter></defs></svg>`
          : "";
        return `<div hidden class="an-recipe-layer ${s.kind === "travel" ? "is-travel" : ""} ${s.kind === "sprite" ? "an-copy-layer" : ""} ${file || s.kind === "sprite" ? "" : "is-unavailable"}" data-layer-stage="${s.index}" data-preview-plan="${planIndex}" data-target-index="${s.targetIndex}" data-preview-from="${from}" data-preview-to="${to}" data-copy="0" data-tint-filter="${filterId}" data-preview-template="${esc(JSON.stringify(media?.template ?? null))}" data-media-width="${media?.width ?? 0}" data-media-height="${media?.height ?? 0}" style="left:${destination.x}%;top:${destination.y}%">${tintFilter}${s.kind === "sprite" ? `<div class="an-copy-art">${destination.token?.img ? `<img src="${esc(destination.token.img)}" alt="Token copy">` : "✦"}</div>` : file ? this.visualMediaHTML(file,`data-preview-stage="${s.index}" data-preview-plan="${planIndex}" aria-label="Stage ${s.index + 1}: ${esc(s.label || this.stageLabel(s))}, target ${s.targetIndex + 1}"`) : "Missing asset"}</div>`;
      })
      .join("");
    return `<div class="an-recipe-scene an-chain-scene" data-recipe-scene data-chain-preview data-preview-width="${chain.width}" data-preview-height="${chain.height}" data-preview-tokens="${esc(JSON.stringify(tokens))}" data-preview-grid-distance="${Number(tokens.gridDistance) || 5}" aria-label="Full recipe composition preview">${layers}${actors}<span class="an-preview-label">FULL RECIPE · ${hasChain(chain.recipe) ? "CHAIN" : chain.recipe.previewArea?.type === "line" ? "LINE" : chain.recipe.previewArea?.type === "cone" ? "CONE" : chain.recipe.stages.some(isPathMotion) ? "MOTION" : "VOLLEY"}</span><span class="an-preview-idle" data-preview-idle>${esc(chain.note)}</span></div>`;
  }
  updatePlayback(frame) {
    if (this.isStudio()) studioFrame(this, frame);
    const stages = this.root.querySelector("[data-stage-drag]") ? this.recipe()?.stages ?? [] : [];
    this.root.querySelectorAll("[data-stage-drag]").forEach((el) => {
      const state = frame.stages[Number(el.dataset.stageDrag)].state;
      el.classList.toggle("is-playing", state === "playing");
      el.classList.toggle("is-done", state === "done");
      el.dataset.playback = state;
      const button = el.querySelector('[data-action="stage"]');
      button?.setAttribute(
        "aria-label",
        `Stage ${Number(el.dataset.stageDrag) + 1}: ${this.stageLabel(stages[Number(el.dataset.stageDrag)])}, ${state}`,
      );
    });
    const progress = this.root.querySelector("[data-recipe-progress]");
    if (progress) {
      progress.max = frame.duration || 1;
      progress.value = frame.time;
    }
    const head = this.root.querySelector("[data-tl-playhead]"), tl = this.root.querySelector(".an-tl");
    if (head && tl) { head.hidden = false; head.style.left = this.timelineX(Number(tl.dataset.tlTotal), frame.time); }
    const time = this.root.querySelector("[data-preview-time]");
    if (time)
      time.textContent = `${(frame.time / 1000).toFixed(1)} / ${(frame.duration / 1000).toFixed(1)}s`;
    const active = frame.stages
      .filter((s) => s.state === "playing")
      .map((s) => s.index + 1);
    const signature = active.join(",");
    if (signature !== this.playingStages) {
      this.playingStages = signature;
      const timeline = this.root.querySelector(".an-timeline");
      const step = this.root.querySelector(
        `[data-stage-drag="${active.at(-1) - 1}"]`,
      );
      if (timeline && step) {
        const bounds = timeline.getBoundingClientRect();
        const rect = step.getBoundingClientRect();
        if (rect.right > bounds.right)
          timeline.scrollLeft += rect.right - bounds.right;
        else if (rect.left < bounds.left)
          timeline.scrollLeft -= bounds.left - rect.left;
      }
    }
    let label = this.isStudio() && !this.studioPlaying
      ? active.length
        ? `At playhead: stage${active.length > 1 ? "s" : ""} ${active.join(" + ")}`
        : "Nothing plays at the playhead"
      : frame.complete
      ? "Recipe complete"
      : active.length
        ? `Playing stage${active.length > 1 ? "s" : ""} ${active.join(" + ")}`
        : "Waiting for next stage";
    if (this.root.querySelector("[data-recipe-scene]")?.dataset.mediaError)
      label += " · media unavailable";
    if(this.root.querySelector('[data-recipe-scene]')?.dataset.fxError)label+=' · token filter preview unavailable; use Local preview';
    const status = this.root.querySelector("[data-preview-status]");
    if (status && status.textContent !== label) status.textContent = label;
    this.root.querySelectorAll("[data-layer-stage]").forEach((el) => {
      // Per-target layers belong to RecipePreview's native instance clock.
      if (el.dataset.previewPlan !== undefined) return;
      el.hidden =
        frame.stages[Number(el.dataset.layerStage)].state !== "playing";
    });
  }
  stopEditorPreview() {
    this.root.querySelectorAll("audio").forEach((audio) => audio.pause());
    this.previewSerial++;
    this.playingStages = "";
    this.previewRun?.stop();
    this.previewRun = null;
    const button = this.root.querySelector('[data-action="recipe-preview"]');
    if (button) button.textContent = "▶ Preview recipe";
    const idle = this.root.querySelector("[data-preview-idle]");
    if (idle) idle.hidden = false;
    this.root.querySelectorAll("[data-stage-drag]").forEach((el) => {
      el.classList.remove("is-playing", "is-done");
      delete el.dataset.playback;
      el.querySelector('[data-action="stage"]')?.removeAttribute("aria-label");
    });
    this.studioPlaying = false;
    const play = this.root.querySelector('[data-action="studio-play"]');
    if (play) { play.textContent = "▶"; play.classList.remove("is-active"); play.setAttribute("aria-label", "Play"); }
    const head = this.root.querySelector("[data-tl-playhead]");
    if (head && !this.isStudio()) head.hidden = true;
  }
  async playEditorPreview() {
    if (this.previewRun) {
      this.stopEditorPreview();
      const status = this.root.querySelector("[data-preview-status]");
      if (status) status.textContent = "Preview stopped";
      return;
    }
    const recipe = previewRecipeSounds(
      {
        ...validateRecipe(this.recipe()),
        previewDistance:
          this.page === "builder" ? (this.builder.previewDistance ?? 3) : 3,
      },
      this.host.soundCatalog?.(),
    );
    this.previewMode = "recipe";
    this.render();
    const serial = this.previewSerial;
    const button = this.root.querySelector('[data-action="recipe-preview"]');
    button.textContent = "■ Stop preview";
    this.root.querySelector("[data-preview-idle]").hidden = true;
    this.root.querySelector("[data-preview-status]").textContent =
      "Loading recipe assets…";
    const run = new RecipePreview(
      this.root.querySelector("[data-recipe-scene]"),
      previewVariants(recipe, this.stageIndex),
      (frame) => this.updatePlayback(frame),
      {tokenFx:this.host.createTokenFxPreview,sceneFx:this.host.createSceneFxPreview},
    );
    this.previewRun = run;
    const complete = await run.play();
    if (serial !== this.previewSerial) return;
    this.previewRun = null;
    run.stop();
    button.textContent = "↻ Replay recipe";
    if (!complete)
      this.root.querySelector("[data-preview-status]").textContent =
        "Preview stopped";
  }
  clearStageDrag() {
    this.stageDrag = null;
    this.root
      .querySelectorAll(".is-dragging,.is-drop-target")
      .forEach((el) => el.classList.remove("is-dragging", "is-drop-target"));
  }
  moveStage(from, to) {
    const current = this.recipe();
    if (from === to || from < 0 || to < 0 || to >= current.stages.length)
      return;
    const r = this.edit();
    r.stages = moveRow(r.stages, from, to);
    this.stageIndex = to;
    this.message =
      "Stage moved in the list. Timing is unchanged. Save recipe to apply.";
    this.clearStageDrag();
    this.render();
    this.root
      .querySelector(`[data-action="stage"][data-index="${to}"]`)
      ?.focus();
  }
  startMotionPreview(recipe) {
    const demo = this.root.querySelector("[data-motion-demo]");
    if (
      !demo ||
      !recipe ||
      matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const stage =
      recipe.stages[Math.min(this.stageIndex, recipe.stages.length - 1)];
    const target = this.root.querySelector(".an-demo-target");
    demo.style.transform = "";
    const a = demo.getBoundingClientRect(), b = target.getBoundingClientRect();
    const source = { center: { x: a.x + a.width / 2, y: a.y + a.height / 2 }, w: a.width, h: a.height };
    const foe = { center: { x: b.x + b.width / 2, y: b.y + b.height / 2 }, w: b.width, h: b.height };
    const direction = motionDirection(source, source, foe, stage.motion, 55);
    const previewStage = isPathMotion(stage) && stage.motionRange === "distance" ? { ...stage, distance: Math.min(stage.distance, 1.2) } : stage;
    const start = performance.now();
    const tick = (time) => {
      if (!demo.isConnected) return;
      const pose = motionPose(
        previewStage,
        ((time - start) % (stage.duration + 650)) / stage.duration,
        direction,
        isPathMotion(stage) ? 55 : 85,
      );
      demo.style.transform = poseTransform(pose);
      demo.style.opacity = pose.alpha ?? "";
      this.motionFrame = requestAnimationFrame(tick);
    };
    this.motionFrame = requestAnimationFrame(tick);
  }
  recipesHTML(recipe) {
    const all = this.listedRecipes().filter((r) => !r.finisher);
    const categories = ["All", ...new Set(all.map((r) => r.category))];
    const filtered = all.filter(
      (r) =>
        (this.category === "All" || r.category === this.category) &&
        `${r.name} ${r.match} ${r.category}`
          .toLowerCase()
          .includes(this.search.toLowerCase()),
    );
    if (this.studio && recipe) return studioHTML(this, recipe);
    return `<div class="an-work is-library"><section class="an-library"><div class="an-search"><span>⌕</span><input aria-label="Search recipes" data-search="recipes" placeholder="Search spells, weapons, or recipes…" value="${esc(this.search)}"><kbd>/</kbd></div>
      <div class="an-chips" role="group" aria-label="Recipe categories">${categories.map((c) => `<button data-action="category" data-category="${esc(c)}" class="${c === this.category ? "is-active" : ""}">${esc(c)}</button>`).join("")}</div>
      <div class="an-section-title"><span>${filtered.length} recipe${filtered.length === 1 ? "" : "s"}</span><small>Open a recipe to edit it in the studio</small></div>
      <div class="an-grid">${
        filtered
          .map(
            (
              r,
            ) => `<button data-action="select" data-id="${esc(r.id)}" class="an-card ${r.id === this.selected ? "is-selected" : ""}" style="--effect:${esc(r.color)}" aria-pressed="${r.id === this.selected}">
        <div class="an-art"><div class="an-orbit"></div><span>${icons[r.category] ?? "◎"}</span><small>${esc(r.category)}</small></div><div class="an-card-body"><h2>${esc(r.name)}${this.dirty.has(r.id) ? " <sup>•</sup>" : ""}</h2><p>${esc(r.description)}</p><div class="an-card-meta"><span>${r.stages.length} stage${r.stages.length === 1 ? "" : "s"}</span><span>${r.enabled ? esc(EVENTS[r.trigger]) : "Disabled"}</span></div>${this.lastingLabel(r) ? `<div class="an-lasting-badge" data-tooltip="Plays for as long as the ${esc(this.lastingLabel(r).toLowerCase())} is on a token">◷ ${esc(this.lastingLabel(r))} · stays while on token</div>` : ""}<div class="an-readiness ${this.status(r) !== "Ready to play" ? "is-missing" : ""}"><span>●</span> ${this.status(r)}</div>${this.linkNoteHTML(r)}${this.approvalBadgeHTML(r)}</div></button>`,
          )
          .join("") ||
        `<div class="an-empty">No recipes found.<small>Try another search or create your own.</small></div>`
      }</div>
      ${this.playerReviewHTML()}
      <div class="an-tip"><span>✧</span><div><b>A little choreography goes a long way.</b><p>Start with a source cue. Add travel. Finish with impact.</p></div></div></section>
      </div>`;
  }
  // Condition and effect recipes last while their condition is on a token; they are named as such everywhere.
  lastingLabel(r) {
    if (r?.lifecycle !== "document") return "";
    const kind = catalogStateEntry(r.stateEntry)?.kind;
    return kind === "condition" ? "Condition" : kind === "effect" ? "Effect" : "Condition / effect";
  }
  // Teleport: who moves to the spot the one who cast clicks, how far, or next to the caster.
  teleportAssetHTML(r, field, label) {
    const catalog = this.host.catalog?.() ?? [];
    const fallback = field === 'teleportOut' ? TELEPORT_STYLES.blue.out : TELEPORT_STYLES.blue.in;
    const reference = r[field] || fallback;
    const key = reference === 'none' ? null : resolveAsset({ kind: 'cast', assets: [reference] }, catalog);
    const file = key ? mediaForReference(catalog, key)?.file : null;
    return `<div class="an-teleport-asset"><label>${label}<button class="an-asset-picker" data-action="browse-teleport" data-field="${field}" aria-label="Choose ${label.toLowerCase()}">${this.assetThumbHTML(file)}<span class="an-asset-picker-text">${esc(reference === 'none' ? 'No effect' : key ?? reference)}<span>${reference !== 'none' && !file ? 'Preview unavailable · ' : ''}Browse ↗</span></span></button></label><div class="an-teleport-asset-actions"><button class="an-quiet" data-action="teleport-asset-default" data-field="${field}" ${r[field] ? '' : 'disabled'}>Default blue mist</button><button class="an-quiet" data-action="teleport-asset-none" data-field="${field}" ${reference === 'none' ? 'disabled' : ''}>No effect</button></div></div>`;
  }
  teleportHTML(r) {
    const plan = teleportPlan(r), mode = r.teleport ?? plan?.who ?? "none";
    const known = r.teleport === undefined && plan ? " (on for this spell)" : "";
    const catalog = this.host.catalog?.() ?? [], style = teleportStyle(r);
    const styleOptions = Object.entries(TELEPORT_STYLES).map(([key, value]) => {
      const visual = teleportVisuals({ teleportOut: value.out, teleportIn: value.in }, catalog);
      const available = key === 'blue' || key === 'none' || visual.out && visual.in;
      return `<option value="${key}" ${style === key ? 'selected' : ''} ${available ? '' : 'disabled'}>${value.label}${available ? '' : ' (not installed)'}</option>`;
    }).join('');
    const look = `<label>Teleport look<select data-field="teleportStyle">${styleOptions}${style === 'custom' ? '<option value="custom" selected disabled>Custom effects (choose below)</option>' : ''}</select></label>${this.teleportAssetHTML(r, 'teleportOut', 'Departure effect')}${this.teleportAssetHTML(r, 'teleportIn', 'Arrival effect')}<p class="an-hint">Browse to preview and choose each effect from Assets, or use your own media file. These cues play at the departure and arrival spots, in addition to the recipe's stages.</p><div class="an-field-row"><label>Effect size (× token width)<input type="number" min="0.1" max="5" step="0.1" data-field="teleportScale" value="${r.teleportScale ?? 1.8}"></label><label>Effect tint (optional)<input data-field="teleportTint" placeholder="#aa88ff" value="${esc(r.teleportTint ?? '')}" pattern="#[0-9a-fA-F]{6}"></label></div>`;
    return `<label>Teleport${known}<select data-field="teleport">${Object.entries(TELEPORT_WHO).map(([k, v]) => `<option value="${k}" ${k === mode ? "selected" : ""}>${k === "none" ? v : `${v}, to a spot you click`}</option>`).join("")}</select></label>${mode === "none" ? "" : `<div class="an-field-row"><label>Range in feet (0 = the spell's range)<input type="number" min="0" max="5280" step="5" data-field="teleportRange" value="${r.teleportRange ?? 0}"></label><label class="an-check"><input type="checkbox" data-field="teleportAdjacent" ${plan?.adjacent ? "checked" : ""}> Next to the caster</label></div>${look}`}<p class="an-hint">When it plays, the one who cast clicks where to go (a ring shows the range, Esc cancels). The token vanishes and reappears there: with finishers, the only Animater settings that really move a token.</p>`;
  }
  // The catalog Finisher dropdown edits the finisher's applies-to list (one finisher per entry);
  // `uuid`, the entry's item when known, shows as that name's Applies-to card.
  async linkFinisherTo(entryName, finisherId, uuid) {
    try {
      await this.host.save(linkFinisher(this.host.recipes(), entryName, finisherId, uuid));
      this.message = finisherId ? `${entryName} now plays this finisher.` : `${entryName} no longer plays a finisher.`;
    } catch (error) { this.message = error.message; }
    this.render();
  }
  // A flash screen that plays for everyone right before this animation.
  flashLinkHTML(r) {
    const screens = this.host.flashScreens(), fits = screens.filter((s) => s.event === "action"), others = screens.filter((s) => s.event !== "action");
    const opt = (s) => `<option value="${esc(s.id)}" ${r.flash === s.id ? "selected" : ""}>${esc(s.name)}</option>`;
    return `<label>Flash screen first<select data-field="flash"><option value="">None</option>${fits.length ? `<optgroup label="Before an animation">${fits.map(opt).join("")}</optgroup>` : ""}${others.length ? `<optgroup label="Other screens">${others.map(opt).join("")}</optgroup>` : ""}</select></label><p class="an-hint">Shows to everyone right before this animation, which starts as the screen fades. Text can use {action} (this attack, spell or ability) and {name} (who used it). Make screens on the Flash screens page.</p>`;
  }
  // Random variants: copies of a stage, each with its own asset, size and timing; one plays each time.
  randomVariantHTML(r, s) {
    const members = variantMembers(r.stages, s.variantGroup), full = r.stages.length >= MAX_STAGES || this.busy;
    if (members.length < 2)
      return `<div class="an-variant is-empty"><button class="an-quiet" data-action="variant-add" ${full ? "disabled" : ""}>🎲 Add a random variant</button><small>A copy of this stage you can give different art, size or timing. Each play picks one of them.</small></div>`;
    return `<div class="an-variant"><b>🎲 Random variant ${members.indexOf(s) + 1} of ${members.length}</b><small>Each play picks one of these ${members.length} stages. Give each its own asset, size and timing; the others are hidden in the preview while you edit this one.</small><div class="an-variant-actions"><button class="an-quiet" data-action="variant-add" ${full ? "disabled" : ""}>+ Add variant</button><button class="an-quiet" data-action="variant-leave">Make it a normal stage</button><button class="an-quiet is-danger" data-action="remove-stage" ${this.busy ? "disabled" : ""}>Remove this variant</button></div></div>`;
  }
  // Whether a recipe can play: linked to nothing yet, or sharing its link with another recipe.
  linkNote(r) {
    const thing = r.lifecycle === "document" ? "condition or effect" : "item";
    if (unlinked(r)) return { warn: true, short: "Not linked yet", text: `Not linked to anything yet: name the ${thing} in Recipe settings.` };
    const entryName = (id) => catalogStateEntry(id)?.name;
    // One conflicts pass per render, not one per recipe card.
    const note = (this.host.recipes ? renderMemo(this.host, "recipeConflicts", () => recipeConflicts(this.listedRecipes(), { entryName })) : recipeConflicts([r], { entryName })).get(r.id);
    if (!note) return null;
    const what = [...note.what].map((w) => w.startsWith("item:") ? `“${this.host.itemSummary?.(w.slice(5))?.name ?? "the same item"}”` : `“${w}”`).join(", ");
    if (!note.plays) return { warn: true, short: `Not playing: “${note.winner.name}” plays instead`, text: `Not playing: “${note.winner.name}” is also linked to ${what} and plays instead. Disable one, or link this one to something else.` };
    const others = [...note.others].map((o) => `“${o.name}”`).join(", ");
    return { warn: false, short: "", text: `Plays instead of ${others}, which ${note.others.size > 1 ? "are" : "is"} also linked to ${what}.` };
  }
  linkNoteHTML(r) {
    const note = this.linkNote(r);
    return note ? `<div class="an-link-note ${note.warn ? "is-warn" : ""}">${note.warn ? "⚠" : "ⓘ"} ${esc(note.text)}</div>` : "";
  }
  // Player recipes show where they stand with the GM.
  approvalBadgeHTML(r) {
    const state = this.host.approvalState?.(r);
    if (!state) return "";
    const label = { pending: "Waiting for GM approval", approved: "Approved by the GM", declined: "Declined by the GM" }[state];
    return `<div class="an-approval is-${state}">${esc(label)}</div>`;
  }
  // The GM has a player's animations open: edits save to that player, and the saved version is approved here.
  reviewBannerHTML() {
    const review = this.host.reviewing?.();
    if (!review) return "";
    const saved = this.savedRecipe(), state = saved && this.host.approvalState?.(saved), unsaved = saved && this.dirty.has(saved.id);
    const status = state === "approved" ? "Approved" : state === "declined" ? "Declined" : "Waiting";
    return `<div class="an-review-banner"><div><b>Reviewing ${esc(review.userName)}'s animations</b><small>${saved ? `“${esc(saved.name)}” · ${status}${unsaved ? " · save your edits before approving" : ""}. ` : ""}Saved edits go back to ${esc(review.userName)} and need approving again.</small></div><div class="an-review-actions">${saved && state !== "approved" ? `<button class="an-primary" data-action="review-approve" ${unsaved ? "disabled" : ""}>Approve</button>` : ""}${saved && state !== "declined" ? `<button class="an-quiet" data-action="review-decline" ${unsaved ? "disabled" : ""}>${state === "approved" ? "Revoke" : "Decline"}</button>` : ""}<button data-action="review-done">Done reviewing</button></div></div>`;
  }
  // The GM's review of player-made recipes: each version is approved or declined once.
  playerReviewHTML() {
    if (this.host.reviewing?.()) return "";
    const rows = this.host.playerSubmissions?.() ?? [];
    if (!rows.length) return "";
    const pending = rows.filter((r) => r.state === "pending").length;
    return `<div class="an-section-title"><span>Player animations${pending ? ` · ${pending} waiting` : ""}</span><small>Approved animations play for that player's own characters</small></div>
      <div class="an-player-review">${rows.map(({ userId, userName, recipe, state }) => `<div class="an-review-row is-${state}"><div><b>${esc(recipe.name)}</b><small>${esc(userName)} · ${esc(EVENTS[recipe.trigger] ?? recipe.trigger)} · ${recipe.stages.length} stage${recipe.stages.length === 1 ? "" : "s"}</small></div><span class="an-approval is-${state}">${state === "pending" ? "Waiting" : state === "approved" ? "Approved" : "Declined"}</span><div class="an-review-actions"><button class="an-quiet" data-action="player-open" data-user="${esc(userId)}" data-id="${esc(recipe.id)}">✎ Open in Studio</button><button class="an-quiet" data-action="player-preview" data-user="${esc(userId)}" data-id="${esc(recipe.id)}">▷ Preview</button>${state !== "approved" ? `<button class="an-primary" data-action="player-approve" data-user="${esc(userId)}" data-id="${esc(recipe.id)}">Approve</button>` : ""}${state !== "declined" ? `<button class="an-quiet" data-action="player-decline" data-user="${esc(userId)}" data-id="${esc(recipe.id)}">${state === "approved" ? "Revoke" : "Decline"}</button>` : ""}</div></div>`).join("")}</div>`;
  }
  optionalFxPreviewHTML(stage,index) {
    if(stage.kind==='tokenfx')return '';
    return `<div hidden class="an-provider-cue" data-layer-stage="${index}"><b>${esc(KINDS[stage.kind])}</b><small>${esc(stage.fxPreset || stage.fxType || 'Choose effect')}</small><small>${stage.kind==='scenefx'?'Play at table · shared scene':'Local canvas preview · token filter'}</small></div>`;
  }
  // The library preset a token FX stage starts from (null for a stage built from scratch).
  tokenFxPreset(stage) { return this.host.tokenFxPreset?.(stage.fxLibrary ?? 'tokenshade', stage.fxPreset) ?? null; }
  optionalFxControlsHTML(stage,index) {
    const catalog=this.host.fxCatalog?.() ?? {presets:[],effects:[]};
    const attrs=field=>`data-field="${field}" data-index="${index}"`;
    if(stage.kind==='tokenfx') {
      const presets=catalog.presets.filter(p=>p.library===(stage.fxLibrary ?? 'tokenshade'));
      return `<label>Preset library<select ${attrs('fxLibrary')}>${options({'tokenshade':'Token presets','tokenshade-region':'Region presets','tokenshade-custom':'My presets'},stage.fxLibrary ?? 'tokenshade')}</select></label><label>Tokenshade preset<select ${attrs('fxPreset')} ${catalog.tokenReady?'':'disabled'}>${options({'':'Choose preset',...Object.fromEntries(presets.map(p=>[p.name,p.name]))},stage.fxPreset ?? '')}</select></label><button data-action="browse-tokenfx">Browse token filters</button><label class="an-check"><input type="checkbox" ${attrs('fxTint')} ${stage.fxTint?'checked':''}>Override preset color</label><label>Filter color<input type="color" ${attrs('fxTint')} value="${esc(stage.fxTint||'#ffffff')}" ${stage.fxTint?'':'disabled'}></label><label>Strength<input type="number" ${attrs('fxStrength')} min="0.1" max="1" step="0.05" value="${esc(stage.fxStrength??1)}"></label><p class="an-hint">Fades glows, auras, bevels, fog and image overlays. Some filters have nothing to fade and stay at full strength: outlines, smoke and fumes overlays, and distortions (blur, ripples, twist).</p><p class="an-hint">${catalog.tokenReady?stage.persist?'Filter stays while the condition or effect is on the token.':'Temporary token filter. Removed when this stage ends.':'Token filters are turned off in Animater settings.'}</p>${catalog.tokenReady?tokenFxEditorHTML(stage,index,this.tokenFxPreset(stage),{canSave:this.host.isGM?.()===true}):''}`;
    }
    const category=stage.fxCategory ?? 'particle';
    const effects=catalog.effects.filter(e=>e.category===category);
    const effect=effects.find(e=>e.type===stage.fxType);
    const fields=(effect?.fields ?? []).map(field=>{
      const value=stage.fxOptions?.[field.key] ?? field.value;
      const attr=`${attrs('fxOptions')} data-fx-option="${esc(field.key)}"`;
      if(field.type==='checkbox')return `<label class="an-check"><input type="checkbox" ${attr} ${value?'checked':''}>${esc(field.label)}</label>`;
      if(field.type==='color')return `<div><label>${esc(field.label)}<input type="color" ${attr} data-fx-color-part="value" value="${esc(value.value)}"></label><label class="an-check"><input type="checkbox" ${attr} data-fx-color-part="apply" ${value.apply?'checked':''}>Apply color</label></div>`;
      if(field.type==='select')return `<label>${esc(field.label)}<select ${attr}>${options(field.choices,value)}</select></label>`;
      return `<label>${esc(field.label)}<input type="number" ${attr} min="${field.min}" max="${field.max}" step="${field.step}" value="${esc(value)}"></label>`;
    }).join('');
    return `<label>FXMaster category<select ${attrs('fxCategory')}>${options({particle:'Scene particles',filter:'Scene filter'},category)}</select></label><label>FXMaster effect<select ${attrs('fxType')} ${catalog.sceneReady?'':'disabled'}>${options({'':'Choose effect',...Object.fromEntries(effects.map(e=>[e.type,e.label]))},stage.fxType ?? '')}</select></label><p class="an-hint">${catalog.sceneReady?'Whole scene · GM playback. Skipped in private preview.':'Enable FXMaster with Effects API support.'}</p>${fields?`<div class="an-options-grid">${fields}</div>`:''}`;
  }
  boundItemHTML(uuid) {
    const info = this.host.itemSummary?.(uuid);
    const name = info?.name ?? "Unavailable item";
    const meta = info ? [info.type && info.type[0].toUpperCase() + info.type.slice(1), info.source].filter(Boolean).join(" · ") : "Item not found";
    return `<div class="an-bound"><button type="button" class="an-bound-item" data-action="open-bound" data-tooltip="Open ${esc(name)}<br><small>${esc(uuid)}</small>" ${info ? "" : "disabled"}><img src="${esc(info?.img || "icons/svg/item-bag.svg")}" alt=""><span><b>${esc(name)}</b><small>Bound · ${esc(meta)}</small></span></button><button type="button" class="an-bound-unbind" data-action="unbind" data-tooltip="Unbind this item">Unbind</button></div>`;
  }
  monitorHTML(r) {
    const canvasUnavailable = Boolean(this.host.environment().demo);
    const linked = r.lifecycle === "document";
    const motionBlocked = this.motionBlocked(r);
    const unconfigured = this.status(r) === "Choose an asset";
    const index = Math.min(this.stageIndex, r.stages.length - 1);
    const s = r.stages[index];
    if (this.isStudio() && s?.kind === "motion" && s.motion === "path") {
      // The full preview keeps playing beside the path, so the transport and scrub still work.
      return `<div class="an-kf-split"><div class="an-preview an-full-preview" style="--effect:${esc(r.color)}">${this.recipePreviewHTML(r)}</div>${pathCanvasHTML(s, { selected: this.selectedKeyframe(s), finisher: r.finisher ?? null })}</div>`;
    }
    const audioPreview = previewRecipeSounds(r, this.host.soundCatalog?.())
      .stages[index];
    const key = resolveAsset(s, this.host.catalog());
    const file = mediaForReference(this.host.catalog(),key)?.file;
    const assetFree = ["motion", "sprite", "sound"].includes(s.kind) || OPTIONAL_FX_KINDS.has(s.kind);
    return `<div class="an-preview ${this.previewMode === "recipe" ? "an-full-preview" : ""}" style="--effect:${esc(r.color)}">${this.previewMode === "recipe" ? this.recipePreviewHTML(r) : `${OPTIONAL_FX_KINDS.has(s.kind) ? `<div class="an-preview-empty"><b>${esc(KINDS[s.kind])}</b><small>${s.kind==='scenefx'?'Play at table · shared scene':'Local canvas preview · token filter'}</small></div>` : s.kind === "motion" ? `<div class="an-motion-scene" aria-label="Token motion schematic preview"><div class="an-demo-token" data-motion-demo>✦</div><div class="an-demo-target">◇</div><small>Token motion · schematic</small></div>` : s.kind === "sound" ? (audioPreview.skipSound ? `<div class="an-preview-empty"><small>Optional sound pack unavailable. Visual stages still play.</small></div>` : `<audio controls src="${esc(this.host.mediaURL?.(audioPreview.soundFile) ?? audioPreview.soundFile)}" aria-label="Selected sound preview" data-cue-volume="${audioPreview.volume}"></audio>`) : s.kind === "sprite" ? `<div class="an-preview-empty">✦<small>Token copies appear in Full recipe preview</small></div>` : file ? this.visualMediaHTML(file,'controls autoplay aria-label="Selected stage asset preview"') : `<div class="an-preview-empty">◇<small>Choose an installed asset</small></div>`}<span class="an-preview-label">STAGE ${index + 1} · ${s.kind === "motion" ? "TOKEN MOTION" : "ASSET PREVIEW"}</span>`}</div>`;
  }
  motionSyncNoticeHTML() { return motionSyncNoticeHTML(this.host.environment()); }
  recipeSettingsHTML(r) {
    if (r.finisher) return finisherSettingsHTML(r, { itemSummary: (uuid) => this.host.itemSummary?.(uuid), players: this.host.players?.() ?? [], playerPicks: this.host.playerPicks?.() === true });
    const linked = r.lifecycle === "document";
    const scope = Object.hasOwn(STRIKE_SCOPES, r.matchScope ?? '') ? r.matchScope : null;
    const binding = !linked && ['attack', 'damage'].includes(r.trigger) ? `<label>Applies to<select data-field="matchScope">${options({ '': 'Item names / slugs', ...STRIKE_SCOPES }, r.matchScope ?? '')}</select></label>` : '';
    const scopeHint = scope === 'melee' ? 'every melee weapon, unarmed or NPC strike' : 'every ranged weapon or NPC ranged strike';
    const otherUses = scope === 'melee' ? 'Ranged, thrown and spell attacks' : 'Melee, thrown and spell attacks';
    return `<div class="an-editor-section an-binding"><div class="an-section-title"><b>When it plays</b><label class="an-check"><input type="checkbox" data-field="enabled" ${r.enabled ? "checked" : ""}>Enabled</label></div><label>Description<textarea aria-label="Description" data-field="description" rows="2" class="an-description">${esc(r.description)}</textarea></label>${linked ? "" : `<label>Trigger<select data-field="trigger">${options(EVENTS, r.trigger)}</select></label>`}${binding}${scope ? `<p class="an-hint">Uses this recipe for ${scopeHint}, overriding built-in weapon animations. No weapon names needed. ${otherUses} keep their own animations. Specific saved bindings take priority.</p>` : `<label>${linked ? "Condition or effect names" : "Item names / slugs"}<input data-field="match" placeholder="${linked ? "frightened, spell effect: shield" : "fire bolt, ignition"}" value="${esc(r.match)}"></label><p class="an-hint">${linked ? "Plays while any of these is on a token. Exact names; commas separate alternatives. Drop a condition or effect here to bind only that one." : "Exact matches. Commas separate alternatives. Drop an item here to bind only that item."}</p>${r.itemUuid ? this.boundItemHTML(r.itemUuid) : ""}`}${this.host.flashScreens ? this.flashLinkHTML(r) : ""}${this.teleportHTML(r)}
      ${!scope && (r.weaponMode || r.category === "Weapons") ? `<label>Weapon use<select data-field="weaponMode">${options({ "": "Any usage", melee: "Melee Strike", ranged: "Ranged Strike", thrown: "Thrown Strike" }, r.weaponMode ?? "")}</select></label><p class="an-hint">The rolled usage selects this customization. Other uses keep their own animation.</p>` : ""}<div class="an-field-row"><label>Category<input data-field="category" value="${esc(r.category)}"></label><label>Accent<input type="color" aria-label="Recipe accent color" data-field="color" value="${esc(r.color)}"></label></div></div>`;
  }
  inspectorHTML(r) {
    const canvasUnavailable = Boolean(this.host.environment().demo);
    const linked = r.lifecycle === "document";
    const motionBlocked = this.motionBlocked(r);
    const unconfigured = this.status(r) === "Choose an asset";
    const index = Math.min(this.stageIndex, r.stages.length - 1);
    const s = r.stages[index];
    const audioPreview = previewRecipeSounds(r, this.host.soundCatalog?.())
      .stages[index];
    const key = resolveAsset(s, this.host.catalog());
    const file = mediaForReference(this.host.catalog(),key)?.file;
    const assetFree = ["motion", "sprite", "sound"].includes(s.kind) || OPTIONAL_FX_KINDS.has(s.kind);
    return `<div class="an-inspector-head"><span class="an-eyebrow">STAGE ${index + 1} OF ${r.stages.length}</span><span class="an-inspector-tools"><span class="an-st-kind kind-${esc(s.kind)}">${esc(KINDS[s.kind])}</span><button class="an-icon is-danger an-stage-remove" data-action="remove-stage" aria-label="Remove this stage" data-tooltip="${r.stages.length === 1 ? "A recipe needs at least one stage" : "Remove this stage"}" ${r.stages.length === 1 || this.busy ? "disabled" : ""}><i class="fas fa-trash" aria-hidden="true"></i></button></span></div>
      <div class="an-editor-section an-stage-fields">
        <label>Stage name<input data-field="label" data-index="${index}" value="${esc(s.label ?? "")}" placeholder="${esc(KINDS[s.kind])}"></label>${this.stageVariantHTML(s, index, linked)}${linked ? "" : this.randomVariantHTML(r, s)}
        ${OPTIONAL_FX_KINDS.has(s.kind) ? this.optionalFxControlsHTML(s,index) : s.kind === "motion" ? this.motionControlsHTML(s, index, r) : s.kind === "sound" ? `<label>Audio file<input data-field="soundFile" data-index="${index}" placeholder="sounds/spell.ogg" value="${esc(s.soundFile)}"></label>${this.host.soundCatalog || this.host.pickMedia ? `<button data-action="browse-sound">Browse sounds</button>` : ""}${this.soundVolumeHTML(s, index, audioPreview)}<p class="an-hint">Relative Foundry audio path. Sound plays with recipe; Stop ends it too.</p>` : s.kind === "sprite" ? `<p class="an-hint">Copies token artwork into Sequencer. Configure copies, shadows and tracks below.</p>` : `<label>Visual asset<button class="an-asset-picker" data-action="browse">${this.assetThumbHTML(file)}<span class="an-asset-picker-text">${esc(key ?? s.assets[0] ?? "Choose an asset")}<span>Browse ↗</span></span></button></label>${key && key !== s.assets[0] ? `<p class="an-hint">Using installed fallback variant. Choose another in Assets anytime.</p>` : ""}`}
        ${["sprite", "aura", "tokenfx"].includes(s.kind) && !linked ? `<label>Subject<select data-field="subject" data-index="${index}">${options({ source: "Source token", targets: "Target tokens" }, s.subject ?? "source")}</select></label>` : ""}
        ${r.stages.length > 1 && !linked ? `<div class="an-field-row an-start-row"><label>Start<select data-field="startMode" data-index="${index}">${options({ with: "With", after: "After", time: "At a set time", ...(s.afterStage && !s.startMode ? { link: "Linked (custom)" } : {}) }, s.startMode ?? (s.afterStage ? "link" : "time"))}</select></label>${s.startMode ? `<label>Stage<select data-field="startRef" data-index="${index}">${options(Object.fromEntries(r.stages.filter((o, j) => j !== index).map(o => [o.stageId, this.stageLabel(o)])), s.startRef ?? s.afterStage)}</select></label>` : ""}${s.startMode === "after" ? `<label>Gap (ms)<input type="number" min="0" max="30000" step="50" data-field="startOffset" data-index="${index}" value="${s.startOffset ?? 0}"></label>` : ""}</div>` : ""}
        <div class="an-field-row"><label>${s.afterStage ? "Linked start (sample ms)" : "Start (ms)"}<input type="number" min="0" max="30000" step="50" data-field="delay" data-index="${index}" value="${s.afterStage ? sampleRecipe(r).stages[index].delay : s.delay}" ${s.afterStage ? "disabled" : ""}></label><label>${linked ? "Preview sample (ms)" : s.kind === "projectile" || isPathMotion(s) && s.motionRange === "target" ? "Base duration (ms)" : "Duration (ms)"}<input type="number" min="100" max="30000" step="100" data-field="duration" data-index="${index}" value="${s.duration}"></label>${["motion", "sound"].includes(s.kind) || OPTIONAL_FX_KINDS.has(s.kind) ? "" : `<label>Scale<input type="number" min="0.1" max="5" step="0.1" data-field="scale" data-index="${index}" value="${s.scale}"></label>`}</div>
        ${linked && ["aura", "tokenfx"].includes(s.kind) ? `<p class="an-hint">Stays on the affected token for as long as the condition or effect is on it. Duration only sets the preview length.</p>` : ""}${s.kind === "aura" && !linked ? `<label class="an-check an-stay"><input type="checkbox" data-field="persist" data-index="${index}" ${s.persist ? "checked" : ""}> Stay until the effect ends</label><p class="an-hint">${s.persist ? "Loops on the token until the spell's effect (for example “Effect: Shield”) is removed, the spell ends or you press Stop. If no effect is applied within a minute, it stops on its own. Duration only sets the preview length." : "Tick to keep a looping asset on the token for as long as the spell's effect lasts."}</p>` : ""}
        ${this.compositionHTML(r, s, index)}
        ${this.stageOptionsHTML(s, index, linked)}
        ${assetFree && (["motion", "sound"].includes(s.kind) || OPTIONAL_FX_KINDS.has(s.kind)) ? "" : `<details class="an-advanced" data-options-group="basic"><summary>Asset & visibility</summary>${assetFree ? "" : `<label>Fallback keys (comma separated)<textarea rows="2" data-field="assets" data-index="${index}">${esc(s.assets.join(","))}</textarea></label>`}${["motion", "sound"].includes(s.kind) || OPTIONAL_FX_KINDS.has(s.kind) ? "" : `<label>Opacity<input type="number" min="0.1" max="1" step="0.1" data-field="opacity" data-index="${index}" value="${s.opacity}"></label><label class="an-check"><input type="checkbox" data-field="below" data-index="${index}" ${s.below ? "checked" : ""}> Below tokens</label>`}</details>`}</div>
`;
  }
  builderHTML() {
    const r = {
        ...orbRecipe(this.builder, "orb-preview", this.host.catalog()),
        previewDistance: this.builder.previewDistance ?? 3,
      },
      timed = sampleRecipe(r);
    const config = this.builder;
    const field = (key, title, value, min, max, step = 50) =>
      `<label>${title}<input type="number" data-builder="${key}" value="${config[key] ?? value}" min="${min}" max="${max}" step="${step}"></label>`;
    return `<section class="an-builder"><div class="an-builder-showcase"><span class="an-eyebrow">CINEMATIC STARTER</span><h2>Chromatic orb</h2><p>Charge → release → layered flight → elemental impact.</p><div class="an-preview an-full-preview" style="--effect:${r.color}">${this.recipePreviewHTML(r)}</div><div class="an-preview-transport"><button class="an-primary" data-action="recipe-preview">▶ Preview recipe</button><span data-preview-time>0.0 / ${(recipeDuration(r) / 1000).toFixed(1)}s</span></div><progress data-recipe-progress aria-label="Recipe playback progress" max="${recipeDuration(r)}" value="0"></progress><small data-preview-status role="status" class="an-preview-status">Ready · sample distance: ${config.previewDistance ?? 3} squares</small><div class="an-builder-layers">${r.stages.map((s, i) => `<div class="an-stage" data-stage-drag="${i}"><span class="an-layer-number">${i + 1}</span><div><b>${esc(s.label)}</b><small>${s.kind === "projectile" ? "Moves with orb" : s.afterStage ? "100ms before orb finishes" : `${timed.stages[i].delay}ms · ${s.kind === "cast" ? "Source" : "Target"}`}</small></div></div>`).join("")}</div><p class="an-hint">Six editable layers. Free and Patreon assets resolve automatically. Final burst uses JB2A artwork; sample preview centers the landing point.</p></div><div class="an-builder-controls"><span class="an-eyebrow">MAKE IT YOURS</span><h3>Choose its element</h3><div class="an-element-grid" role="group" aria-label="Orb element">${Object.entries(
      ORB_ELEMENTS,
    )
      .map(
        ([key, name]) =>
          `<button data-action="orb-element" data-element="${key}" aria-pressed="${(config.element ?? "fire") === key}" class="${(config.element ?? "fire") === key ? "is-active" : ""}">${name}</button>`,
      )
      .join(
        "",
      )}</div><p class="an-hint">Updates shell color, hue, release flash and impact together.</p><label>Recipe name<input data-builder="name" value="${esc(config.name ?? r.name)}"></label><div class="an-options-grid">${field("charge", "Charge up (ms)", 1500, 500, 5000)}${field("pause", "Pause before flight (ms)", 500, 0, 4000)}${field("flight", "Base flight duration (ms)", 800, 600, 5000)}${field("perSquare", "Extra flight time / square (ms)", 100, 0, 1000)}${field("scatter", "Landing scatter (squares)", 0.25, 0, 1, 0.05)}${field("previewDistance", "Sample distance for timing (squares)", 3, 1, 20, 1)}</div><p class="an-hint">Flight = base + distance × extra time. Both orb layers share one landing point per target; impact follows that target’s arrival. Launch pause is capped below base duration.</p><div class="an-builder-summary"><b>${this.status(r)}</b><span>Manual trigger · safe to customize before automation</span></div><button data-action="preview" ${this.host.environment().demo || this.busy ? "disabled" : ""}>▷ Local canvas preview</button><button data-action="create-orb" class="an-primary" ${this.status(r) !== "Ready to play" ? "disabled" : ""}>Create editable recipe</button><button data-action="new-basic" class="an-quiet">Start a blank recipe instead</button></div></section>`;
  }
  // `recipe`: the recipe being edited; only a finisher offers Hold (its travel really lands).
  motionControlsHTML(s, index, recipe = null) {
    const finisher = Boolean(recipe?.finisher);
    const path = isPathMotion(s), target = path && s.motionRange !== "distance" && s.motion !== "dodge";
    const toward = (s.motionHeading ?? "toward") === "toward";
    const field = (key, label, value, min, max, step = 1) => `<label>${label}<input type="number" min="${min}" max="${max}" step="${step}" data-field="${key}" data-index="${index}" value="${s[key] ?? value}"></label>`;
    const select = (key, label, values, value) => `<label>${label}<select data-field="${key}" data-index="${index}">${options(values, s[key] ?? value)}</select></label>`;
    return `${select("motion", "Motion", MOTIONS, "lunge")}${select("subject", "Animate", { source: "Source token", targets: "Target tokens" }, "source")}
      ${path && s.motion !== "dodge" ? select("motionRange", "Path", { target: toward ? s.subject === "targets" ? "Approach source" : "Approach selected target" : "Use token separation for distance", distance: "Fixed-distance gesture" }, "target") : ""}
      ${path ? select("motionHeading", "Path heading", { toward: "Toward selected token", away: "Away from selected token", up: "Upward on map", down: "Downward on map", left: "Leftward on map", right: "Rightward on map" }, "toward") : ""}
      ${finisher && ((path && s.motion !== "dodge") || ["path", "fade", "fragments"].includes(s.motion)) ? select("motionEnd", "End", { return: "Return to start", hold: "Hold at the end (finishers move the token there)" }, "return") : ""}
      ${target && s.subject !== "targets" ? select("targetSelection", "Approach which target", { first: "First selected target", second: "Second selected target", last: "Last selected target" }, "first") : ""}
      ${s.subject === "targets" ? select("targetSelection", "Animate which targets", { all: "All selected targets", first: "First selected target", second: "Second selected target", last: "Last selected target" }, "all") : ""}
      ${target && toward ? select("motionEndpoint", "Finish beside", { near: "Near side of target", past: "Far side — pass through" }, "near") : ""}
      ${s.motion === "fragments" ? "" : `<div class="an-field-row">${field("distance", target ? "Maximum path (squares)" : "Distance (grid squares)", path ? 8 : .35, .05, path ? 20 : 2, .05)}${field("intensity", "Flourish intensity", 1, .1, 3, .1)}</div>`}
      ${path ? `<details class="an-advanced an-options" data-options-group="motion-path"><summary>Path &amp; pacing</summary><div class="an-options-grid">${field("motionArrival", "Reach destination (% of duration)", 45, 15, 70)}${field("motionHold", "Hold at destination (%)", 25, 5, 90 - (s.motionArrival ?? 45))}${target ? field("perSquare", "Extra duration / square (ms)", 0, 0, 2000, 50) + field("stopGap", "Gap beside target (squares)", .1, 0, 2, .05) : ""}${s.motion === "leap" ? field("jumpHeight", "Arc height (squares)", .8, 0, 3, .05) + field("arrivalLift", "Height at Strike (squares)", 0, 0, 2, .05) : ""}</div>${["roll", "dodge"].includes(s.motion) ? select("motionSide", s.motion === "dodge" ? "Dodge direction" : "Roll direction", { 1: "Right / clockwise", "-1": "Left / counterclockwise" }, 1) : ""}<p class="an-hint">Approach → hold → return. Link a Strike or cue to “Destination reached” to keep contact synchronized. Total includes distance pacing; remaining time restores the pose.</p></details>` : ""}
      <p class="an-hint">${finisher ? "Moves token artwork, then restores its pose; a held travel lands, and the finisher moves the token there." : "Moves token artwork, then restores its pose. Game position and rotation stay unchanged."}</p>
      ${s.motion === "path" ? keyframeInspectorHTML(s, index, this.selectedKeyframe(s)) : ""}${s.motion === "fragments" ? fragmentsControlsHTML(s, index, this.fragmentsPreviewAt ?? 0.6, { finisher }) : ""}`;
  }
  compositionHTML(recipe, stage, index) {
    const refs = Object.fromEntries(
      recipe.stages
        .filter((s) => s.stageId !== stage.stageId)
        .map((s, i) => [s.stageId, s.label || KINDS[s.kind]]),
    );
    return `<details class="an-advanced an-options" data-options-group="composition"><summary>Linked timing & flight ${stage.afterStage || stage.kind === "projectile" ? "· configured" : ""}</summary><label>Start relative to<select data-field="afterStage" data-index="${index}">${options({ "": "Absolute start time", ...refs }, stage.afterStage ?? "")}</select></label>${stage.afterStage ? `<label>Anchor<select data-field="timingAnchor" data-index="${index}">${options({ start: "Stage starts", ...(isPathMotion(recipe.stages.find(s => s.stageId === stage.afterStage)) ? { arrival: "Destination reached" } : {}), end: "Stage finishes" }, stage.timingAnchor ?? "end")}</select></label><label>Offset from stage ${stage.timingAnchor === "start" ? "start" : stage.timingAnchor === "arrival" ? "arrival" : "end"} (ms)<input type="number" data-field="startOffset" data-index="${index}" min="-30000" max="30000" step="50" value="${stage.startOffset}"></label><p class="an-hint">Offset adjusts chosen anchor. Link survives reordering; absolute Start is ignored.</p>` : ""}${stage.kind === "projectile" ? `<div class="an-options-grid"><label>Extra duration / square (ms)<input type="number" min="0" max="2000" data-field="perSquare" data-index="${index}" value="${stage.perSquare ?? 0}"></label><label>Launch pause (ms)<input type="number" min="0" max="10000" data-field="moveDelay" data-index="${index}" value="${stage.moveDelay ?? 0}"></label><label>Flight easing<select data-field="moveEase" data-index="${index}">${options(EASES, stage.moveEase ?? "linear")}</select></label></div><p class="an-hint">Moves the artwork along its travel path. Duration adds actual grid distance.</p>` : ""}${["projectile", "impact"].includes(stage.kind) ? `<label>Shared landing group<input data-field="landingGroup" data-index="${index}" value="${esc(stage.landingGroup ?? "")}" placeholder="e.g. orb-hit"></label><label>Landing scatter (squares)<input type="number" min="0" max="2" step="0.05" data-field="scatter" data-index="${index}" value="${stage.scatter ?? 0}"></label><p class="an-hint">Matching groups share one point. First layer’s scatter controls the group.</p>` : ""}</details>`;
  }
  // The track decides what a stage is; only same-track variants are offered.
  stageVariantHTML(s, index, linked) {
    const pool = linked ? { aura: "Sustained attached layer", tokenfx: "Tokenshade" } : KINDS;
    const track = trackOf(s);
    const variants = Object.fromEntries(Object.entries(pool).filter(([kind]) => trackOf({ ...s, kind }) === track));
    if (Object.keys(variants).length < 2) return "";
    return `<label>Type<select data-field="kind" data-index="${index}">${options(variants, s.kind)}</select></label>`;
  }
  soundVolumeHTML(s, index, audioPreview) {
    const volume = Math.min(1, Math.max(0, Number(s.volume ?? 0.5)));
    const listen = s.soundFile && !audioPreview?.skipSound ? `<audio class="an-sound-listen" controls preload="none" src="${esc(this.host.mediaURL?.(audioPreview.soundFile) ?? audioPreview.soundFile)}" aria-label="Listen to this sound" data-cue-volume="${volume}"></audio>` : "";
    return `<label class="an-volume-field">Volume <span data-volume-readout>${Math.round(volume * 100)}%</span><input type="range" min="0" max="1" step="0.05" data-field="volume" data-index="${index}" value="${volume}" aria-label="Sound volume"></label>${listen}`;
  }
  stageOptionsHTML(stage, index, linked = false) {
    if(OPTIONAL_FX_KINDS.has(stage.kind))return '';
    // Sound path can remain blank while drafting; validation occurs on save/play.
    const s = {
      ...stage,
      ...normalizeOptions({
        ...stage,
        kind: stage.kind === "sound" ? "cast" : stage.kind,
      }),
    };
    const input = ([key, label, fallback, min, max, step], track) => {
      const value = track === undefined ? s[key] : s.tracks[track][key];
      const attrs = `data-field="${key}" data-index="${index}" ${track === undefined ? "" : `data-track="${track}"`}`;
      if (typeof fallback === "boolean")
        return `<label class="an-check"><input type="checkbox" ${attrs} ${value ? "checked" : ""}>${esc(label)}</label>`;
      return `<label>${esc(label)}${min && typeof min === "object" ? `<select ${attrs}>${options(min, value)}</select>` : `<input ${attrs} type="${typeof fallback === "number" ? "number" : "color"}" ${typeof fallback === "number" ? `min="${min}" max="${max}" step="${step ?? 1}"` : ""} value="${esc(value)}">`}</label>`;
    };
    let html = ["travel", "projectile"].includes(stage.kind)
      ? `<label>Travel path<select data-field="travelOrigin" data-index="${index}">${options(stage.kind === "projectile" ? { source: "Source → each target", target: "Target → source (return)" } : { source: "Source → each target", previousTarget: "Chain through targets", firstTarget: "First target → selected endpoints", target: "Target → source (return)" }, stage.travelOrigin ?? "source")}</select></label><p class="an-hint">Chains follow targeting order. Return paths end at source; projectile returns ignore landing scatter.</p>`
      : "";
    if (["travel", "projectile"].includes(stage.kind))
      html += `<label>Flight destination<select data-field="travelDestination" data-index="${index}">${options({ targets: "Selected creatures", area: "Selected area center" }, stage.travelDestination ?? "targets")}</select></label>`;
    if (["travel", "projectile"].includes(stage.kind) && stage.travelDestination === "area")
      html += `<label>Area flight layout<select data-field="areaLayout" data-index="${index}">${options({ fit: "One flight to area center", fan: "Spread through cone" }, s.areaLayout)}</select></label>${s.areaLayout === "fan" ? `<label>Flights in fan<input type="number" min="3" max="9" step="1" data-field="fanCount" data-index="${index}" value="${s.fanCount}"></label><p class="an-hint">Starts at the placed cone vertex. Flights spread inside its direction and reach; creature hits remain rules.</p>` : ""}`;
    // Target options only matter on stages that play on or toward targets.
    const targeted = ["travel", "projectile", "impact"].includes(s.kind) || s.subject === "targets";
    for (const [group, fields] of Object.entries(OPTION_GROUPS)) {
      if (
        (group === "Token copies" && s.kind !== "sprite") ||
        group === "Sound"
      )
        continue;
      if (group === "Media playback" && s.kind === "sprite") continue;
      if (
        ["motion", "sound"].includes(s.kind) &&
        ![
          "Timing & repetition",
          "Sound",
          ...(s.kind === "sound" ? ["Entrance & exit", "Media playback"] : []),
        ].includes(group)
      )
        continue;
      const visible = fields.filter(
        ([key]) =>
          !(!targeted && ["optionalTargets", "targetSelection", "targetLimit", "targetStagger", "repeatScope"].includes(key)) &&
          !(!s.customAnchor && ["anchorX", "anchorY"].includes(key)) &&
          !(!s.tintEnabled && ["tint", "colorize"].includes(key)) &&
          !(linked &&["repeats", "repeatGap", "repeatMode", "stagger", "oneShot", "targetPick", "attach", "bindAlpha"].includes(key)) &&
          !(key === "areaLayout" && s.kind !== "template") &&
          !(
            key === "playbackRate" &&
            ["motion", "sound", "sprite"].includes(s.kind)
          ) &&
          !(
            s.kind === "sound" &&
            ![
              "repeats",
              "repeatGap",
              "ease",
              "fadeIn",
              "fadeOut",
              "volume",
              "clipStart",
              "clipEnd",
            ].includes(key)
          ) &&
          !(key === "overlayFit" && s.kind !== "overlay") &&
          !(
            ["travel", "projectile", "template", "overlay"].includes(s.kind) &&
            ["attach", "bindRotation", "bindAlpha", "maskToken"].includes(key)
          ),
      );
      if (!visible.length) continue;
      // The anchor toggle reads first; its X/Y fields appear under it once ticked.
      const toggle = visible.findIndex(([key]) => key === "customAnchor"), anchor = visible.findIndex(([key]) => key === "anchorX");
      if (toggle > anchor && anchor >= 0) visible.splice(anchor, 0, ...visible.splice(toggle, 1));
      html += `<details class="an-advanced an-options" data-options-group="${esc(group)}"><summary>${esc(group)}</summary><div class="an-options-grid">${visible.map((f) => input(f)).join("")}</div></details>`;
    }
    if (!["motion", "sound"].includes(s.kind))
      html += `<details class="an-advanced an-options" data-options-group="tracks"><summary>Property tracks <small>${s.tracks.length}/6</small></summary><p class="an-hint">Animate artwork position, rotation, size or opacity. Tracks stay inside this stage. Positions use grid squares.</p>${s.tracks
        .map(
          (t, i) =>
            `<div class="an-track"><div class="an-section-title"><b>Track ${i + 1}</b><button data-action="remove-track" data-track="${i}" aria-label="Remove track ${i + 1}">Remove</button></div><div class="an-options-grid">${[
              ["property", "Property", "position.x", TRACK_PROPERTIES],
              [
                "from",
                "From",
                0,
                t.property === "alpha"
                  ? 0
                  : t.property.startsWith("scale")
                    ? 0.01
                    : t.property.startsWith("position") ||
                        ["width", "height"].includes(t.property)
                      ? -10
                      : -720,
                t.property === "alpha"
                  ? 1
                  : t.property.startsWith("scale")
                    ? 5
                    : t.property.startsWith("position") ||
                        ["width", "height"].includes(t.property)
                      ? 10
                      : 720,
                0.1,
              ],
              [
                "to",
                "To",
                1,
                t.property === "alpha"
                  ? 0
                  : t.property.startsWith("scale")
                    ? 0.01
                    : t.property.startsWith("position") ||
                        ["width", "height"].includes(t.property)
                      ? -10
                      : -720,
                t.property === "alpha"
                  ? 1
                  : t.property.startsWith("scale")
                    ? 5
                    : t.property.startsWith("position") ||
                        ["width", "height"].includes(t.property)
                      ? 10
                      : 720,
                0.1,
              ],
              ["duration", "Track duration (ms)", 1000, 100, s.duration, 50],
              [
                "delay",
                t.fromEnd
                  ? "End offset (ms; negative = earlier)"
                  : "Track delay (ms)",
                0,
                t.fromEnd ? -s.duration : 0,
                t.fromEnd ? 0 : s.duration,
                50,
              ],
              ["ease", "Track easing", "linear", EASES],
              ["loop", "Loop track", false],
              ["pingPong", "Ping-pong loop", false],
              ...(t.loop ? [] : [["fromEnd", "Time from stage end", false]]),
            ]
              .map((f) => input(f, i))
              .join("")}</div></div>`,
        )
        .join(
          "",
        )}<button data-action="add-track" ${s.tracks.length >= 6 ? "disabled" : ""}>+ Property track</button></details>`;
    return html;
  }
  assetsHTML(recipe) {
    this.mediaLibrary ??= new MediaLibrary(this);
    return this.mediaLibrary.html(recipe);
  }
  // The Activity page follows new entries while it is open: a cheap check each second redraws
  // only when the log changed (each entry also asks for a redraw as it is logged).
  watchActivity() {
    if (this.page !== "activity") { clearInterval(this.activityTimer); this.activityTimer = null; return; }
    // Now playing changes (a start, an end, a removed template) redraw too; otherwise only the running times tick.
    const mark = () => { const l = this.host.logs?.() ?? []; return `${l.length}:${l[0]?.time}:${l[0]?.detail}|${this.nowPlaying().map((r) => r.id).join(",")}`; };
    this.activitySeen = mark();
    if (this.activityTimer) return;
    this.activityTimer = setInterval(() => {
      if (this.page !== "activity" || !this.root?.isConnected) { clearInterval(this.activityTimer); this.activityTimer = null; return; }
      const now = mark();
      if (now !== this.activitySeen) { this.activitySeen = now; this.render(); return; }
      for (const t of this.root.querySelectorAll?.("[data-started]") ?? []) t.textContent = elapsedLabel(Date.now() - Number(t.dataset.started));
    }, 1000);
  }
  nowPlaying() {
    try { return this.host.nowPlaying?.() ?? []; } catch { return []; }
  }
  // The row's picture: its main footage (a paused clip that plays on hover or focus), else the
  // item/condition icon, else a generic mark.
  nowThumbHTML(r) {
    const file = r.asset ? mediaForReference(this.host.catalog?.() ?? [], r.asset)?.file : null;
    if (file) {
      const url = esc(this.host.mediaURL?.(file) ?? file);
      return `<span class="an-now-thumb">${mediaType(file) === "image" ? `<img src="${url}" alt="" loading="lazy">` : `<video muted playsinline preload="metadata" src="${url}" aria-hidden="true"></video>`}</span>`;
    }
    if (r.icon) return `<span class="an-now-thumb is-icon"><img src="${esc(r.icon)}" alt="" loading="lazy"></span>`;
    return `<span class="an-now-thumb is-generic" aria-hidden="true">✦</span>`;
  }
  activityGM() {
    return this.host.isGM ? this.host.isGM() === true : !this.host.playerMode;
  }
  // Exclude ⊘ / Excluded · Undo for one row (GM only); attr is data-index="…" or data-entry="…".
  activityExcludeHTML(origin, name, attr) {
    if (!this.activityGM() || !cleanOrigin(origin)) return "";
    if ((this.activityExcluded ??= new Map()).has(originKey(origin)))
      return `<span class="an-activity-excluded">Excluded · <button type="button" class="an-activity-undo" data-action="activity-undo" ${attr} aria-label="Undo excluding ${esc(name)}" data-tooltip="Play it automatically again">Undo</button></span>`;
    const what = cleanOrigin(origin).type === "recipe" ? "Exclude: disable this recipe (saved now)" : "Exclude: leave this entry out of its catalog";
    return `<button type="button" class="an-activity-btn" data-action="activity-exclude" ${attr} aria-label="Exclude ${esc(name)} from automatic playback" data-tooltip="${what}">⊘</button>`;
  }
  activityHTML() {
    const logs = this.host.logs?.() ?? [], playing = this.nowPlaying(), now = Date.now();
    const nowRows = playing.map((r) => {
      const attr = `data-entry="${esc(r.id)}"`, started = Number(r.startedAt) || now;
      const tip = r.kind === "state" ? "Stop: the condition or effect stays, and animates again when reapplied" : "Stop this animation";
      const token = r.portrait ? `<img class="an-now-token" src="${esc(r.portrait)}" alt="" loading="lazy"> ` : "";
      const effect = r.asset ? `<small class="an-now-asset" data-tooltip="${esc(r.asset)}">${esc(assetLabel(r.asset))}</small>` : "";
      return `<div class="an-log an-now-row">${this.nowThumbHTML(r)}<time data-started="${started}">${esc(elapsedLabel(now - started))}</time><div><b>${esc(r.name)}</b><p>${r.on ? `${token}on ${esc(r.on)}` : ""}</p>${effect}</div><div class="an-activity-actions"><button type="button" class="an-activity-btn" data-action="activity-stop" ${attr} aria-label="Stop ${esc(r.name)}" data-tooltip="${tip}">■</button>${this.activityExcludeHTML(r.origin, r.name, attr)}</div></div>`;
    }).join("") || `<div class="an-empty">Nothing playing right now.</div>`;
    // Only automatic plays that played can be excluded; previews, skips and blocks get no buttons.
    const actionable = (l) => l?.automatic === true && !l.preview && ["Played", "Persistent"].includes(l.status);
    const history = logs.map((l, i) => {
      const actions = actionable(l) ? this.activityExcludeHTML(l.origin, l.recipe, `data-index="${i}"`) : "";
      return `<div class="an-log"><time>${esc(l.time)}</time><span class="an-badge ${l.status === "Blocked" ? "is-missing" : ""}">${esc(l.status)}</span><div><b>${esc(l.recipe)}</b><p>${esc(l.detail)}</p></div>${actions ? `<div class="an-activity-actions">${actions}</div>` : ""}</div>`;
    }).join("") || `<div class="an-empty">No activity yet.<small>Preview a recipe or enable automatic playback.</small></div>`;
    return `<div class="an-activity"><div class="an-info">Playback explained<p>Automatic events appear here with matching recipe, played effect count, or reason playback was blocked. The list updates live while this page is open. It shows what this browser played: each player's own casts are listed on their own Activity page.</p></div><section class="an-activity-section" data-activity="now"><h3>Now playing</h3>${nowRows}</section><section class="an-activity-section" data-activity="history"><h3>History</h3>${history}</section></div>`;
  }
  // The Activity row a button acts on: a Now playing entry (data-entry) or a History entry (data-index).
  activityRow(b) {
    if (b.dataset.entry) return this.nowPlaying().find((r) => r.id === b.dataset.entry) ?? null;
    const l = (this.host.logs?.() ?? [])[Number(b.dataset.index)];
    return l ? { ...l, name: l.recipe } : null;
  }
  async activityAction(action, b) {
    if (!["activity-stop", "activity-exclude", "activity-undo"].includes(action)) return false;
    const row = this.activityRow(b);
    if (!row) { this.render(); return true; }
    if (action === "activity-stop") {
      await this.host.stopAnimation?.(row);
      this.message = `${row.name || "Animation"} stopped.`;
      this.render();
      return true;
    }
    if (!this.activityGM()) return true;
    const key = originKey(row.origin), excluded = (this.activityExcluded ??= new Map());
    if (!key) return true;
    const options = { abilityProfile: abilityProfileForKey, drafts: this.drafts };
    if (action === "activity-exclude") {
      const changed = await setOriginExcluded(this.host, row.origin, true, options);
      excluded.set(key, { changed });
      this.message = cleanOrigin(row.origin).type === "recipe" ? `${row.name || "Recipe"} disabled and saved.` : `${row.name || "Entry"} excluded from its catalog.`;
    } else {
      // Undo reverts only what Exclude changed: an entry that was already excluded stays so.
      if (excluded.get(key)?.changed !== false) await setOriginExcluded(this.host, row.origin, false, options);
      excluded.delete(key);
      this.message = `${row.name || "Entry"} plays automatically again.`;
    }
    this.render();
    return true;
  }
  // One click for every built-in catalog of this system.
  everyCatalogHTML(env) {
    const state = this.host.catalogsOn?.();
    if (!state?.total) return "";
    const all = state.on === state.total;
    return `<section class="an-settings-card"><div><h3>Every catalog</h3><p>${all ? `All ${state.total} catalogs are on: spells, feats, actions, weapons, conditions and effects animate when used.` : `${state.on} of ${state.total} catalogs are on. Turn them all on in one click: everything animates when used. Exclusions and your own versions stay.`}</p></div><button data-action="use-every-catalog" class="${all ? "an-quiet" : "an-primary"}" ${env.demo || !env.ready || all ? "disabled" : ""}>${all ? "All on ✓" : "Turn every catalog on"}</button></section>`;
  }
  setupHTML(env) {
    return `<div class="an-setup"><section class="an-setup-hero"><span>✧</span><h2>From dice roll to spectacle.</h2><p>Install your assets. Pick a recipe. Let your table do the rest.</p></section><div class="an-setup-grid">${env.dependencies.map((d) => `<div class="an-dependency"><span class="${d.ok ? "an-ok" : "an-missing"}">${d.ok ? "✓" : "!"}</span><div><h3>${esc(d.name)}</h3><p>${esc(d.detail)}</p></div></div>`).join("")}</div><section class="an-settings-card"><div><h3>Automatic playback</h3><p>${env.conflicts.length ? `Other animation engines active: ${esc(env.conflicts.join(", "))}. Overlapping triggers may play twice.` : "Your saved recipes respond to supported game events."}</p></div><button data-action="automation" class="an-toggle ${this.host.enabled() ? "is-on" : ""}" role="switch" aria-checked="${this.host.enabled()}" ${env.demo || !env.ready ? "disabled" : ""}>${this.host.enabled() ? "On" : "Off"}</button></section>${this.everyCatalogHTML(env)}${this.catalogFxControlsHTML(env)}<div class="an-guide"><h3>First animation in three steps</h3><ol><li><b>Choose a recipe.</b> Open Recipes, pick an effect, check its asset preview.</li><li><b>Try it locally.</b> Select a source token, target a token, then Local preview.</li><li><b>Make it yours.</b> Set trigger and item names, save, then enable automatic playback.</li></ol><p>Area previews create a temporary template automatically and remove it afterward. Select a native area to override placement and size. Rerolls and private PF2e messages are skipped. D&D 5e hit/miss resolution is not inferred from target AC.</p><button data-action="restore-starters">Add missing starter recipes</button></div></div>`;
  }
  catalogFxControlsHTML(env) {
    const state=this.host.catalogFxSettings?.()??{token:true,scene:true},fx=this.host.fxCatalog?.()??{};
    return [['token','catalogTokenFx','Tokenshade','Shader effects on the token',fx.tokenReady],['scene','catalogSceneFx','FXMaster','Scene effects · GM playback',fx.sceneReady]].map(([kind,key,name,detail,ready])=>`<section class="an-settings-card"><div><h3>Catalog: ${name}</h3><p>${detail} · ${ready?'Available':'Provider unavailable'}</p></div><button data-action="catalog-fx-toggle" data-setting="${key}" data-fx-kind="${kind}" class="an-toggle ${state[kind]?'is-on':''}" role="switch" aria-label="Catalog: ${name}" aria-checked="${state[kind]}" ${env.demo||!this.host.setCatalogFxSetting?'disabled':''}>${state[kind]?'On':'Off'}</button></section>`).join('');
  }
  // New recipe: the two kinds behave differently, so the author picks one up front.
  lastingRecipesAvailable() {
    return !this.host.playerMode && ["pf2e", "sf2e", "dnd5e", "daggerheart"].includes(this.host.environment?.()?.systemId);
  }
  newChooserHTML() {
    const choice = (action, icon, title, text, example) => `<button class="an-new-choice" data-action="${action}"><span class="an-new-icon">${icon}</span><b>${title}</b><small>${text}</small><small class="an-new-example">${example}</small></button>`;
    return `<div class="an-modal-scrim"><section class="an-modal an-new-chooser" role="dialog" aria-modal="true" aria-label="New recipe"><h2>What kind of animation?</h2><div class="an-new-choices">${choice("new-action", "✦", "Action animation", "Plays once when something happens: a spell is cast, an attack or damage is rolled, an area is placed.", "e.g. Fireball, a sword Strike")}${choice("new-lasting", "◷", "Lasting animation", "Stays on a token while a condition or effect is on it, and stops when it is removed.", "e.g. Frightened, Spell Effect: Shield")}</div><footer><button data-action="new-cancel">Cancel</button></footer></section></div>`;
  }
  importHTML() {
    return `<div class="an-modal-scrim"><section class="an-modal" role="dialog" aria-modal="true" aria-label="Import Animater recipes"><h2>Import recipes</h2><p>Paste an Animater export. Existing IDs are replaced only after review.</p><textarea aria-label="Recipe import JSON" data-import rows="10" placeholder='{"schema":1,"recipes":[…]}'></textarea><div data-import-review role="status"></div><footer><button data-action="cancel-import">Cancel</button><button data-action="review-import">Review import</button><button data-action="confirm-import" class="an-primary" disabled>Import reviewed recipes</button></footer></section></div>`;
  }
  onInput(e) {
    const t = e.target;
    if (studioInput(this, t)) return;
    if(this.mediaLibrary?.input(t))return;
    if(this.dndCatalog?.input(t))return;
    if(this.flashEditor?.input(t))return;
    if (t.hasAttribute?.("data-fragments-scrub")) {
      this.fragmentsPreviewAt = Number(t.value);
      const s = this.recipe()?.stages[Number(t.dataset.index)], svg = t.closest(".an-fragments")?.querySelector(".an-fragments-preview");
      if (s && svg) svg.outerHTML = fragmentsPreviewSVG(s, this.fragmentsPreviewAt);
      return;
    }
    if (t.dataset.builder) {
      this.stopEditorPreview();
      this.builder[t.dataset.builder] =
        t.type === "number" ? Number(t.value) : t.value;
      return;
    }
    if (t.dataset.search) {
      if (t.dataset.search === "recipes") this.search = t.value;
      else if (t.dataset.search === "spells") {
        this.spellFilters.search = t.value;
        this.spellPage = 0;
      } else if (abilityProfileForPage(t.dataset.search)) {
        const profile = abilityProfileForPage(t.dataset.search);
        this[profile.filtersKey].search = t.value;
        this[profile.pageKey] = 0;
      } else if (t.dataset.search === "weapons") {
        this.weaponFilters.search = t.value;
        this.weaponPage = 0;
      } else if (["conditions", "effects"].includes(t.dataset.search)) {
        const kind = t.dataset.search === "conditions" ? "condition" : "effect";
        this.stateFilters[kind].search = t.value; this.statePages[kind] = 0;
      } else this.assetSearch = t.value;
      this.render();
      return;
    }
    if (t.matches("[data-import]")) {
      this.pendingImport = [];
      this.root.querySelector('[data-action="confirm-import"]').disabled = true;
      this.root.querySelector("[data-import-review]").textContent = "";
      return;
    }
    if (t.dataset.field === "fxLayer" && !["range", "color", "number", "text"].includes(t.type)) return;
    if (t.dataset.field) this.updateField(t);
  }
  onChange(e) {
    if(this.mediaLibrary?.change(e.target))return;
    if(this.flashEditor?.change(e.target))return;
    // The guided tour's practice finisher (listed while a tour runs) is never stored as the default
    // or linked to an entry: keyboard users can reach these pickers mid-tour.
    if ((e.target.hasAttribute("data-finisher-link") || e.target.hasAttribute("data-finisher-default")) && e.target.value === TOUR_PRACTICE_ID) { this.render(); return; }
    if (e.target.hasAttribute("data-finisher-link")) { void this.linkFinisherTo(e.target.dataset.finisherLink, e.target.value, e.target.dataset.finisherUuid); return; }
    if (e.target.hasAttribute("data-finisher-add")) { const name = e.target.value; e.target.value = ""; if (name.trim()) this.addFinisherName(name); return; }
    if (e.target.hasAttribute("data-finisher-player")) { this.togglePlayer(e.target.dataset.finisherPlayer, e.target.checked); return; }
    if (e.target.hasAttribute("data-finisher-default")) { void this.host.setDefaultFinisher(e.target.value).then(() => this.render(), (error) => { this.message = error.message; this.render(); }); return; }
    if(e.target.hasAttribute('data-dnd-variant')||e.target.dataset.dndFilter||e.target.dataset.dndOption){void this.dndCatalog?.change(e.target).catch(error=>{this.message=error.message;this.render();});return;}
    if (e.target.hasAttribute("data-state-damage")) { this.stateDamageType = e.target.value; this.render(); return; }
    if (e.target.hasAttribute("data-state-aura-variant")) { this.stateAuraVariant = e.target.value; this.render(); return; }
    if (e.target.dataset.stateFilter) {
      const kind = this.page === "conditions" ? "condition" : "effect";
      this.stateFilters[kind][e.target.dataset.stateFilter] = e.target.value; this.statePages[kind] = 0; this.render(); return;
    }
    if (e.target.dataset.weaponFilter) {
      this.weaponFilters[e.target.dataset.weaponFilter] = e.target.value;
      this.weaponPage = 0;
      if (e.target.dataset.weaponFilter === "mode" && e.target.value !== "all") this.weaponMode = e.target.value;
      this.render(); return;
    }
    if (e.target.dataset.abilityVolume) {
      this.stopEditorPreview();
      const profile = abilityProfileForKey(e.target.dataset.abilityVolume), set = profile ? this.host[profile.setStateKey] : this.host.setWeaponCatalogState;
      void set({ soundVolume: Math.max(0, Math.min(1, Number(e.target.value) / 100)) }).then(() => this.render()).catch(error => { this.message = error.message; this.render(); });
      return;
    }
    const abilityFilter = ["feat", "action", "feature"].map((key) => [abilityProfileForKey(key), e.target.dataset[key + "Filter"]]).find(([, field]) => field);
    if (abilityFilter) {
      const [profile, field] = abilityFilter;
      this[profile.filtersKey][field] = e.target.value;
      this[profile.pageKey] = 0;
      this.render();
      return;
    }
    if (e.target.hasAttribute("data-catalog-volume")) {
      this.stopEditorPreview();
      void this.host
        .setCatalogState({
          soundVolume: Math.max(0, Math.min(1, Number(e.target.value) / 100)),
        })
        .then(() => this.render())
        .catch((error) => {
          this.message = error.message;
          this.render();
        });
      return;
    }
    if (e.target.dataset.catalogFilter) {
      this.spellFilters[e.target.dataset.catalogFilter] = e.target.value;
      this.spellPage = 0;
      this.render();
      return;
    }
    if (e.target.dataset.builder) {
      this.builder[e.target.dataset.builder] =
        e.target.type === "number" ? Number(e.target.value) : e.target.value;
      this.render();
      return;
    }
    if (e.target.dataset.field) {
      this.updateField(e.target);
      this.render();
    }
  }
  updateField(t) {
    if (this.busy) return;
    this.stopEditorPreview();
    const r = this.edit();
    if (!r) return;
    let s =
      t.dataset.index !== undefined ? r.stages[Number(t.dataset.index)] : r;
    if (t.dataset.track !== undefined) s = s.tracks[Number(t.dataset.track)];
    const key = t.dataset.field,
      previous = s[key];
    const before = { ...s };
    if (key === "fxLayer") {
      applyTokenFxEdit(s, this.tokenFxPreset(s), t.dataset, t);
      const out = t.type === "range" ? t.nextElementSibling : null;
      if (out?.tagName === "OUTPUT") out.textContent = t.value;
      return;
    }
    if (key === "fxSpeed" && t.type === "range") {
      const out = t.nextElementSibling;
      if (out?.tagName === "OUTPUT") out.textContent = `${t.value}×`;
    }
    if (key === "keyframe") {
      const stage = r.stages[Number(t.dataset.index)], i = Number(t.dataset.kfIndex), field = t.dataset.kfField, kfs = normalizeKeyframes(stage.keyframes);
      const value = field === "sharp" ? t.checked : field === "ease" ? t.value : Number(t.value);
      stage.keyframes = field === "at" ? moveKeyframeTime(kfs, i, value / stage.duration) : normalizeKeyframes(kfs.map((k, j) => (j === i ? { ...k, [field]: value } : k)));
      return;
    }
    if (key.startsWith("finisher.")) {
      r.finisher = normalizeFinisher({ ...r.finisher, [key.slice(9)]: t.type === "number" ? Number(t.value) : t.value });
      return;
    }
    if (key === 'teleportStyle') {
      const style = TELEPORT_STYLES[t.value];
      if (style) { s.teleportOut = style.out; s.teleportIn = style.in; }
      return;
    }
    if ((key === "startMode" || key === "startRef") && t.dataset.index !== undefined) {
      const i = Number(t.dataset.index);
      const snapshot = clone(r.stages);
      if (key === "startRef") {
        s.startRef = t.value;
      } else if (t.value === "after" || t.value === "with") {
        s.startMode = t.value;
        // Always name the stage it follows, so moving rows never changes timing.
        if (!s.startRef) s.startRef = (i > 0 ? r.stages[i - 1] : r.stages[1])?.stageId;
      } else if (t.value === "time") {
        // Freeze the current resolved start as a plain time.
        const at = sampleRecipe(r).stages[i]?.delay ?? s.delay ?? 0;
        delete s.startMode; delete s.startRef; s.afterStage = ""; s.delay = Math.round(at);
      }
      linkStartModes(r.stages);
      try { timedStages(r, 0); this.message = "Start updated. Save recipe to apply."; }
      catch {
        r.stages = snapshot;
        this.message = "Those stages would wait on each other. Choose a stage that starts earlier.";
      }
      return;
    }
    resetPiecesOnPattern(s, key);
    s[key] =
      t.type === "checkbox"
        ? t.checked
        : t.type === "number" || t.type === "range" ||
            [
              "delay",
              "duration",
              "scale",
              "opacity",
              "distance",
              "intensity",
              "fxStrength",
              "fxSpeed",
            ].includes(key)
          ? Number(t.value)
          : key === "assets"
            ? t.value
                .split(",")
                .map((v) => v.trim())
                .filter(Boolean)
            : t.value;
    if (key === 'matchScope') {
      if (Object.hasOwn(STRIKE_SCOPES, s.matchScope)) {
        s.itemUuid = '';
        s.weaponMode = s.matchScope;
        delete s.activityId;
        delete s.catalogEntry;
      } else {
        delete s.matchScope;
        if (Object.hasOwn(STRIKE_SCOPES, previous ?? '')) delete s.weaponMode;
      }
    }
    if (key === 'trigger' && Object.hasOwn(STRIKE_SCOPES, s.matchScope ?? '') && !['attack', 'damage'].includes(s.trigger)) {
      delete s.matchScope;
      delete s.weaponMode;
    }
    if (key === "volume" && t.type === "range") {
      const field = t.closest(".an-volume-field");
      const readout = field?.querySelector("[data-volume-readout]");
      if (readout) readout.textContent = `${Math.round(Number(t.value) * 100)}%`;
      const audio = field?.parentElement?.querySelector(".an-sound-listen");
      if (audio) { audio.volume = Number(t.value); audio.dataset.cueVolume = t.value; }
    }
    if (t.dataset.fxOption) {
      const option=t.dataset.fxOption;
      s.fxOptions={...(before.fxOptions ?? {})};
      if(t.dataset.fxColorPart) {
        const current=s.fxOptions[option] ?? this.host.fxCatalog?.().effects.find(e=>e.category===s.fxCategory && e.type===s.fxType)?.fields.find(f=>f.key===option)?.value ?? {value:'#ffffff',apply:false};
        s.fxOptions[option]={...current,[t.dataset.fxColorPart]:t.type==='checkbox'?t.checked:t.value};
      } else s.fxOptions[option]=t.type==='checkbox'?t.checked:t.type==='number'?Number(t.value):t.value;
    }
    if(key==='fxTint'&&t.type==='checkbox') {
      s.fxTint=t.checked?before.fxTint||'#ffffff':'';
      const color=this.root.querySelector(`input[type="color"][data-field="fxTint"][data-index="${t.dataset.index}"]`);
      if(color){color.disabled=!t.checked;color.value=s.fxTint||'#ffffff';}
    }
    if(key==='fxCategory'){s.fxType='';s.fxOptions={};}
    if(key==='fxType')s.fxOptions={};
    if(key==='fxLibrary')s.fxPreset='';
    // A new preset starts the stage over from that preset's own layers.
    if(key==='fxLibrary'||key==='fxPreset')delete s.fxLayers;
    if(key==='kind' && OPTIONAL_FX_KINDS.has(s.kind)) {
      s.assets=[];
      if(s.kind==='tokenfx'){s.subject='source';s.fxLibrary??='tokenshade';s.fxPreset??='';}
      else {s.fxCategory??='particle';s.fxType??='';s.fxOptions??={};}
    }
    if (key === "kind" && s.kind === "motion") {
      s.motion ??= "lunge";
      s.subject ??= "source";
      s.distance ??= 0.35;
      s.intensity ??= 1;
    }
    if (key === "motion" && isPathMotion(s)) {
      if (!isPathMotion({ ...s, motion: previous })) {
        s.distance = s.motion === "dodge" ? .55 : 8;
        s.duration = Math.max(s.duration, s.motion === "dodge" ? 1600 : 2200);
        s.intensity = .6;
        s.motionArrival = 45;
        s.motionHold = 25;
        s.motionEndpoint = "near";
        s.motionHeading = "toward";
        s.jumpHeight = .8;
        s.arrivalLift = 0;
        s.stopGap = .1;
      }
      s.motionRange = s.motion === "dodge" ? "distance" : s.motionRange ?? "target";
    }
    // A keyframed path always carries its keyframes, so a held finisher path can show its length at once.
    if (key === "motion" && s.motion === "path" && !Array.isArray(s.keyframes)) s.keyframes = normalizeKeyframes(s.keyframes);
    if (key === "motionArrival") s.motionHold = Math.min(s.motionHold ?? 25, 90 - s.motionArrival);
    if (key === "motionRange" && previous !== s.motionRange) {
      s.distance = s.motionRange === "distance" ? Math.min(s.distance ?? 1.4, 1.4) : s.distance <= 2 ? 8 : s.distance ?? 8;
    }
    if (
      [
        "afterStage",
        "timingAnchor",
        "startOffset",
        "moveDelay",
        "duration",
        "motion",
        "kind",
      ].includes(key)
    ) {
      try {
        timedStages(r, 0);
      } catch (error) {
        Object.assign(s, before);
        this.message = error.message;
        return;
      }
    }
    if (key === "soundFile") delete s.optionalSound;
    if (
      key === "kind" &&
      !["motion", "sprite", "aura", "sound", "tokenfx"].includes(s.kind)
    )
      delete s.subject;
    if (["anchorX", "anchorY"].includes(key)) s.customAnchor = true;
    if (t.dataset.track !== undefined) {
      if (key === "loop" && s.loop) s.fromEnd = false;
      if (key === "fromEnd") s.delay = 0;
      if (key === "property") {
        s.from = ["alpha", "scale.x", "scale.y"].includes(s.property) ? 1 : 0;
        s.to =
          s.property === "alpha"
            ? 0
            : s.property.startsWith("scale")
              ? 1.2
              : s.property === "rotation"
                ? 90
                : -0.5;
      }
    }
    if (["delay", "duration"].includes(key)) {
      const label = this.root.querySelector(
        `[data-action="stage"][data-index="${t.dataset.index}"] small`,
      );
      if (label) label.textContent = this.stageStartLabel(s, r);
      const duration = recipeDuration(r);
      const time = this.root.querySelector("[data-preview-time]");
      if (time) time.textContent = `0.0 / ${(duration / 1000).toFixed(1)}s`;
      const progress = this.root.querySelector("[data-recipe-progress]");
      if (progress) {
        progress.max = duration || 1;
        progress.value = 0;
      }
    }
    const status = this.root.querySelector("[data-preview-status]");
    if (status) status.textContent = "Ready · preview current draft";
    const save = this.root.querySelector('[data-action="save"]');
    if (save) {
      save.disabled = false;
      save.textContent = "Save recipe";
    }
  }
  async onDrop(e) {
    const stage = e.target.closest("[data-stage-drag]");
    if (this.stageDrag !== null && stage) {
      e.preventDefault();
      if (!this.busy)
        this.moveStage(this.stageDrag, Number(stage.dataset.stageDrag));
      return;
    }
    if (this.busy) return;
    if (!e.target.closest(".an-binding")) return;
    e.preventDefault();
    try {
      const data = JSON.parse(e.dataTransfer.getData("text/plain"));
      // A PF2e sheet's Attacks entry (a basic unarmed or other synthetic strike has no Item to link):
      // a finisher adds the strike's name, unlinked.
      const strike = this.recipe()?.finisher ? strikeFromDrag(data, (uuid) => this.host.resolveActor?.(uuid) ?? globalThis.fromUuidSync?.(uuid, { strict: false }) ?? null) : null;
      if (strike) { this.addFinisherName(strike.name); return; }
      if (data.type !== "Item" || !data.uuid)
        throw Error("Drop a Foundry item here.");
      const item = await this.host.resolveItem(data.uuid);
      if (!item) throw Error("Item could not be resolved.");
      // A finisher applies to many names: the drop adds one card (linked to the item), never a single bound item.
      if (this.recipe()?.finisher) { this.addFinisherName(item.name, item.uuid); return; }
      const r = this.edit();
      r.itemUuid = item.uuid;
      delete r.matchScope;
      if (r.lifecycle === "document") r.stateEntry = "";
      r.match = item.name;
      this.message = `Bound to ${item.name}. Save recipe to apply.`;
      this.render();
    } catch (error) {
      this.message = error.message;
      this.render();
    }
  }
  // A finisher's Applies-to card list, edited in the draft (unsaved until Save). `uuid`: the dropped
  // item, remembered for that name's card; a typed name has none.
  togglePlayer(id, on) {
    const r = this.edit();
    if (!r?.finisher) return;
    const had = r.finisher.players ?? [];
    const next = id === "*" ? (on ? ["*"] : []) : on ? [...had.filter((x) => x !== "*"), id] : had.filter((x) => x !== id);
    r.finisher = normalizeFinisher({ ...r.finisher, players: [...new Set(next)] });
    this.render();
  }
  addFinisherName(name, uuid) {
    const current = this.recipe(), was = String(current?.match ?? ""), next = addFinisherName(was, name), added = String(name ?? "").trim();
    const finisher = current?.finisher, linked = uuid ? linkFinisherItem(finisher, added, uuid) : finisher;
    // A name already there (and already linked to this item) leaves the recipe untouched (not marked unsaved).
    if (next === addFinisherName(was, "") && linked === finisher) this.message = added ? `${added} is already in Applies to.` : this.message;
    // Finishers match by name; an older drop's hidden itemUuid goes with any edit.
    else { const r = this.edit(); r.match = next; r.itemUuid = ""; r.finisher = linkFinisherItem(r.finisher, added, uuid); this.message = next === was ? `Linked ${added} to its item. Save to apply.` : `Added ${added}. Save to apply.`; }
    this.render();
  }
  // Feats, Actions and Features pages: data-action "<key>-auto", "select-<key>"…
  async abilityAction(action, b) {
    const match = /^(?:(select|use|copy)-(feat|action|feature)|(feat|action|feature)-(sound|page|reset|auto|exclude|motion|pause))$/.exec(action);
    if (!match) return false;
    const profile = abilityProfileForKey(match[2] ?? match[3]), verb = match[1] ?? match[4], catalog = profile.catalog, noun = profile.noun;
    const getState = () => catalog.normalizeState(this.host[profile.stateKey]?.()), setState = (change) => this.host[profile.setStateKey](change);
    const selected = this[profile.selectedKey];
    if (verb === "sound") { await setState({ sound: !getState().sound }); this.render(); return true; }
    if (verb === "select") {
      if (selected === b.dataset.id) return true;
      this[profile.selectedKey] = b.dataset.id; this.stageIndex = 0; this.render(); return true;
    }
    if (verb === "page") { this[profile.pageKey] = Math.max(0, Number(b.dataset.index)); this.render(); return true; }
    if (verb === "reset") {
      for (const field of Object.keys(this[profile.filtersKey])) this[profile.filtersKey][field] = field === "search" ? "" : "all";
      this[profile.pageKey] = 0; this.render(); return true;
    }
    if (["auto", "exclude", "motion"].includes(verb)) {
      const env = this.host.environment();
      if (env.demo || !pf2eCatalogsLive(env) || !env.ready)
        throw Error(`Configure ${noun} animations inside a PF2e world with Sequencer and JB2A active.`);
      const state = catalog.normalizeState(this.host[profile.stateKey]());
      if (verb === "auto") {
        const enabled = !(state.enabled && state.scope === "all" && (state.independent || this.host.enabled()));
        await setState({ enabled, scope: "all", independent: true, preferCatalog: true });
        this.message = enabled
          ? `Active ${noun} catalog enabled. Send an active ${noun} to chat to play; manual entries stay manual.`
          : `${profile.label} catalog paused. Spell settings preserved.`;
      } else await setState(verb === "motion"
        ? { motion: state.motion === false }
        : { excluded: state.excluded.includes(b.dataset.id ?? selected) ? state.excluded.filter((id) => id !== (b.dataset.id ?? selected)) : [...state.excluded, b.dataset.id ?? selected] });
      this.render(); return true;
    }
    if (verb === "use") {
      const env = this.host.environment();
      if (env.demo || !pf2eCatalogsLive(env) || !env.ready)
        throw Error(`Use ${noun} animations inside a PF2e world with Sequencer and JB2A active.`);
      const feat = catalog.entry(selected);
      if (!feat || feat.trigger === "manual") throw Error(`This ${noun} uses manual playback.`);
      await setState(catalog.use(this.host[profile.stateKey](), feat.id));
      this.message = feat.rider ? `${feat.name} uses its catalog animation. Roll Strike damage that includes it to play.` : `${feat.name} uses its catalog animation. Send the ${noun} to chat to play.`;
      this.render(); return true;
    }
    if (verb === "pause") {
      await setState({ enabled: false });
      this.message = `${profile.label} catalog paused. Spell settings preserved.`;
      this.render(); return true;
    }
    if (verb === "copy") {
      const recipe = this.recipe();
      const saved = this.host.recipes().find((r) => r.id === recipe.id || r.itemUuid === recipe.itemUuid);
      if (!saved) await this.host.save([...this.host.recipes(), recipe]);
      const state = this.host[profile.stateKey]?.();
      if (state) await setState({
        selected: (state.selected ?? []).filter((id) => id !== selected),
        customized: [...new Set([...(state.customized ?? []), selected])],
      });
      this.selected = saved?.id ?? recipe.id; this.page = "recipes"; this.studio = true; this.studioTime = 0; this.stageIndex = 0; this.search = ""; this.category = "All";
      this.render(); return true;
    }
    return false;
  }
  // Tucks the window away for a canvas preview or table playback. The answer restores it once;
  // Stop (this.untuck) and a time limit also restore it, so a playback that never settles
  // cannot leave the window minimized for good.
  async tuckForPlayback(limitMs = 30000) {
    const restore = await this.host.tuckWindow?.().catch(() => null);
    if (!restore) return null;
    let timer = null;
    const once = async () => {
      if (this.untuck !== once) return;
      this.untuck = null;
      clearTimeout(timer);
      await restore().catch(() => {});
    };
    this.untuck = once;
    timer = setTimeout(() => void once(), limitMs);
    return once;
  }
  async onClick(e) {
    const b = e.target.closest("[data-action]");
    if (!b || b.disabled) return;
    e.preventDefault();
    let action = b.dataset.action;
    if (this.busy && action !== "stop") return;
    // A recipe card's right-click menu acts on that recipe as if it were open.
    if (action.startsWith("recipe-menu-")) {
      this.root.querySelector(".an-st-menu")?.remove();
      if (this.selected !== b.dataset.id) { this.stageIndex = 0; this.studioTime = 0; }
      this.selected = b.dataset.id;
      if (action === "recipe-menu-open") { this.studio = true; this.render(); return; }
      action = action === "recipe-menu-duplicate" ? "duplicate" : "delete";
    }
    try {
      // The guided tour's practice finisher is never saved, copied or deleted (Ctrl+S clicks Save too).
      if (["save", "duplicate", "delete"].includes(action) && this.recipe()?.id === TOUR_PRACTICE_ID) return;
      if (action === "finisher-tours") { this.showFinisherTours = !this.showFinisherTours; this.render(); return; }
      if (action === "finisher-tour") {
        this.showFinisherTours = false;
        runFinisherTour(this, b.dataset.finisherTour).catch((error) => { this.message = error.message; this.render(); });
        return;
      }
      if(await this.mediaLibrary?.action(action,b))return;
      if(await this.dndCatalog?.action(action,b))return;
      if(await this.flashEditor?.action(action,b))return;
      if (await this.activityAction(action, b)) return;
      if (await handleStateCatalogAction(this, action, b)) return;
      if (action === "item-details") {
        await openCatalogDetails(this, b.dataset.kind, b.dataset.id);
        return;
      }
      if (action === "select-weapon") {
        if (this.selectedWeapon === b.dataset.id) return;
        this.selectedWeapon = b.dataset.id;
        const weapon = catalogWeapon(this.selectedWeapon);
        this.weaponMode = weapon.modes.find(m => m.mode === this.weaponFilters.mode)?.mode ?? weapon.modes[0].mode;
        this.stageIndex = 0; this.render(); return;
      }
      if (action === "weapon-mode") { if (this.weaponMode === b.dataset.mode) return; this.weaponMode = b.dataset.mode; this.stageIndex = 0; this.render(); return; }
      if (action === "weapon-page") { this.weaponPage = Math.max(0, Number(b.dataset.index)); this.render(); return; }
      if (action === "weapon-reset") { for (const key of Object.keys(this.weaponFilters)) this.weaponFilters[key] = key === "search" ? "" : "all"; this.weaponPage = 0; this.render(); return; }
      if (["weapon-auto", "weapon-pause", "weapon-exclude", "weapon-motion", "weapon-sound", "use-weapon"].includes(action)) {
        const env = this.host.environment(), state = normalizeWeaponCatalogState(this.host.weaponCatalogState?.());
        if (!["weapon-sound", "weapon-motion"].includes(action) && (env.demo || !pf2eCatalogsLive(env) || !env.ready)) throw Error("Configure automatic weapon animations inside a PF2e world.");
        const change = action === "weapon-auto" ? { enabled: !(state.enabled && state.scope === "all" && (state.independent || this.host.enabled())), independent: true, scope: "all", preferCatalog: true }
          : action === "weapon-pause" ? { enabled: false }
          : action === "weapon-motion" ? { motion: !state.motion }
          : action === "weapon-sound" ? { sound: !state.sound }
          : action === "use-weapon" ? useCatalogWeapon(state, this.selectedWeapon)
          : { excluded: state.excluded.includes(b.dataset.id ?? this.selectedWeapon) ? state.excluded.filter(id => id !== (b.dataset.id ?? this.selectedWeapon)) : [...state.excluded, b.dataset.id ?? this.selectedWeapon] };
        await this.host.setWeaponCatalogState(change);
        this.message = action === "use-weapon" ? "Weapon enabled. The rolled usage selects melee, ranged or thrown automatically." : "Weapon catalog settings updated.";
        this.render(); return;
      }
      if (action === "copy-weapon") {
        const recipe = this.recipe(), saved = this.host.recipes().find(r => r.id === recipe.id || r.itemUuid === recipe.itemUuid && r.weaponMode === recipe.weaponMode);
        if (!saved) await this.host.save([...this.host.recipes(), recipe]);
        const state = normalizeWeaponCatalogState(this.host.weaponCatalogState?.()), key = weaponCustomizationKey(this.selectedWeapon, recipe.weaponMode);
        await this.host.setWeaponCatalogState({ customized: [...new Set([...state.customized, key])] });
        this.selected = saved?.id ?? recipe.id; this.page = "recipes"; this.studio = true; this.studioTime = 0; this.search = ""; this.category = "All"; this.stageIndex = 0;
        this.render(); return;
      }
      if (await this.abilityAction(action, b)) return;
      if (action === "select-spell") {
        if (this.selectedSpell === b.dataset.id) return;
        this.selectedSpell = b.dataset.id;
        this.stageIndex = 0;
        this.render();
        return;
      }
      if (action === "catalog-page") {
        this.spellPage = Math.max(0, Number(b.dataset.index));
        this.render();
        return;
      }
      if (action === "catalog-reset") {
        for (const field of Object.keys(this.spellFilters))
          this.spellFilters[field] = field === "search" ? "" : "all";
        this.spellPage = 0;
        this.render();
        return;
      }
      if (action === "audition-sound") {
        const audio = b.closest(".an-sound-cue")?.querySelector("audio");
        if (!audio) return;
        if (!audio.paused) {
          audio.pause();
          return;
        }
        this.stopEditorPreview();
        audio.volume = Number(audio.dataset.cueVolume);
        audio.currentTime = 0;
        await audio.play();
        return;
      }
      if (
        [
          "catalog-auto",
          "catalog-exclude",
          "catalog-motion",
          "catalog-sound",
        ].includes(action)
      ) {
        const state = normalizeCatalogState(this.host.catalogState());
        if (action === "catalog-auto") {
          const enabled = !(
            state.enabled &&
            state.scope === "all" &&
            (state.independent || this.host.enabled())
          );
          await this.host.setCatalogState({
            enabled,
            scope: "all",
            independent: true,
            preferCatalog: true,
          });
          this.message = enabled
            ? "Entire catalog enabled. Cast normally; use Customize for your own versions."
            : "Catalog paused. Custom recipe automation stays available.";
          this.render();
          return;
        }
        await this.host.setCatalogState(
          action === "catalog-motion"
            ? { motion: state.motion === false }
            : action === "catalog-sound"
              ? { sound: state.sound === false }
              : {
                  excluded: state.excluded.includes(b.dataset.id ?? this.selectedSpell)
                    ? state.excluded.filter((id) => id !== (b.dataset.id ?? this.selectedSpell))
                    : [...state.excluded, b.dataset.id ?? this.selectedSpell],
                },
        );
        this.render();
        return;
      }
      if (action === "use-spell") {
        const env = this.host.environment();
        if (env.demo || !pf2eCatalogsLive(env) || !env.ready)
          throw Error(
            "Use catalog animations inside a PF2e world with Sequencer and JB2A active.",
          );
        const spell = catalogSpell(this.selectedSpell);
        if (!spell || spell.trigger === "manual")
          throw Error("This animation uses manual playback.");
        await this.host.setCatalogState(
          useCatalogSpell(this.host.catalogState(), spell.id),
        );
        this.message = `${spell.name} uses the catalog animation. Cast normally; no recipe configuration needed.`;
        this.render();
        return;
      }
      if (action === "catalog-pause") {
        await this.host.setCatalogState({ enabled: false });
        this.message = "Catalog paused. Saved recipes keep their settings.";
        this.render();
        return;
      }
      if (action === "copy-spell") {
        const recipe = this.recipe();
        const saved = this.host
          .recipes()
          .find((r) => r.id === recipe.id || r.itemUuid === recipe.itemUuid);
        if(!saved && !recipe.stages[0].assets.length){
          this.drafts.set(recipe.id,recipe);
          this.dirty.add(recipe.id);
        }else if (!saved) await this.host.save([...this.host.recipes(), recipe]);
        const state = this.host.catalogState?.();
        if (state)
          await this.host.setCatalogState({
            selected: (state.selected ?? []).filter(
              (id) => id !== this.selectedSpell,
            ),
            customized: [
              ...new Set([...(state.customized ?? []), this.selectedSpell]),
            ],
          });
        this.selected = saved?.id ?? recipe.id;
        this.page = "recipes";
        this.studio = true;
        this.studioTime = 0;
        this.stageIndex = 0;
        this.search = "";
        this.category = "All";
        this.render();
        return;
      }
      if (action === "recipe-preview") {
        await this.playEditorPreview();
        return;
      }
      if (["fx-layers-reset", "fx-layer-remove", "fx-layer-move", "fx-preset-save", "fx-preset-delete"].includes(action)) {
        const r = this.edit(), s = r?.stages[Number(b.dataset.index)];
        if (!s || s.kind !== "tokenfx") return;
        this.stopEditorPreview();
        if (action === "fx-preset-save") {
          const name = this.root.querySelector(`[data-fx-preset-name="${b.dataset.index}"]`)?.value ?? "";
          await this.host.saveTokenFxPreset(name, layersOf(s, this.tokenFxPreset(s)));
          s.fxLibrary = "tokenshade-custom"; s.fxPreset = name.trim().slice(0, 80); delete s.fxLayers;
          this.message = `Saved “${s.fxPreset}” to My presets.`;
        } else if (action === "fx-preset-delete") {
          if (!(await this.host.confirm?.(`Delete the preset “${s.fxPreset}” for every recipe in this world? This stage keeps its effect.`))) return;
          // The stage keeps the effect as its own copy, so nothing that used it goes blank.
          const layers = layersOf(s, this.tokenFxPreset(s)), name = s.fxPreset;
          await this.host.deleteTokenFxPreset(name);
          Object.assign(s, { fxLibrary: "tokenshade", fxPreset: "", fxLayers: layers });
          this.message = `Deleted “${name}” from My presets.`;
        } else tokenFxAction(action, s, this.tokenFxPreset(s), b.dataset);
        this.render();
        return;
      }
      if (action === "browse-sound" || action === "browse-tokenfx") {
        this.mediaLibrary ??= new MediaLibrary(this);
        this.mediaLibrary.open(action==='browse-sound'?'audio':'tokenfx');
        return;
      }
      if (action === "add-track" || action === "remove-track") {
        const s = this.edit().stages[this.stageIndex];
        s.tracks ??= [];
        if (action === "remove-track")
          s.tracks.splice(Number(b.dataset.track), 1);
        else if (s.tracks.length < 6)
          s.tracks.push({
            property: "position.y",
            from: 0,
            to: -0.5,
            duration: Math.min(1000, s.duration),
            delay: 0,
            ease: "easeInOutQuad",
            loop: false,
            pingPong: false,
            fromEnd: false,
          });
        this.render();
        this.root.querySelector('[data-options-group="tracks"]').open = true;
        return;
      }
      if (action === "preview-mode") {
        if (this.previewMode === b.dataset.mode) return;
        this.previewMode = b.dataset.mode;
        this.render();
        return;
      }
      if (action === "page") {
        if(!catalogPageAllowed(b.dataset.page,this.host.environment()))return;
        if (this.page === b.dataset.page) {
          if (this.page === 'assets' && this.mediaLibrary?.target) { this.mediaLibrary.target = null; this.render(); }
          if (["recipes", "finishers"].includes(this.page) && this.studio) { this.studio = false; this.render(); }
          // The Flash screens menu item returns from the editor to the library.
          if (this.page === "flash" && this.flashEditor?.editing) { this.flashEditor.editing = false; this.flashEditor.playing = false; this.render(); }
          return;
        }
        this.page = b.dataset.page;
        if (this.mediaLibrary) this.mediaLibrary.target = null;
        this.message = "";
        this.render();
        return;
      }
      if (action === "category") {
        if (this.category === b.dataset.category) return;
        this.category = b.dataset.category;
        this.render();
        return;
      }
      if (await studioAction(this, action, b)) return;
      // Open a player's animation in the Studio; the GM's own drafts wait until they are done reviewing.
      if (action === "player-open" || action === "review-done") {
        if ([...this.dirty].some((id) => this.drafts.has(id))) { this.message = "Save or revert your changes first."; this.render(); return; }
        if (action === "player-open") {
          this.reviewStash ??= { selected: this.selected, drafts: this.drafts, dirty: this.dirty };
          this.host.review(b.dataset.user);
          this.selected = b.dataset.id;
          this.studio = true;
        } else {
          this.host.review(null);
          this.selected = this.reviewStash?.selected ?? this.host.recipes()[0]?.id;
          this.studio = false;
        }
        this.drafts = action === "review-done" ? this.reviewStash?.drafts ?? new Map() : new Map();
        this.dirty = action === "review-done" ? this.reviewStash?.dirty ?? new Set() : new Set();
        if (action === "review-done") this.reviewStash = null;
        this.page = "recipes"; this.stageIndex = 0; this.studioTime = 0;
        this.render();
        return;
      }
      if (action === "review-approve" || action === "review-decline") {
        const review = this.host.reviewing?.(), saved = this.savedRecipe();
        if (!review || !saved || this.dirty.has(saved.id)) return;
        const was = this.host.approvalState?.(saved), status = action === "review-approve" ? "approved" : "declined";
        await this.host.decidePlayerRecipe(review.userId, saved, status);
        this.message = `${review.userName}'s “${saved.name}” ${status === "approved" ? "approved: it now plays for their characters" : was === "approved" ? "revoked" : "declined"}.`;
        this.render();
        return;
      }
      // The GM's review of a player's recipe: preview it locally, then approve or decline that version.
      if (["player-preview", "player-approve", "player-decline"].includes(action)) {
        const row = (this.host.playerSubmissions?.() ?? []).find((r) => r.userId === b.dataset.user && r.recipe.id === b.dataset.id);
        if (!row) return;
        if (action === "player-preview") {
          await this.host.play(validateRecipe(row.recipe), true);
          this.message = `Previewed ${row.userName}'s “${row.recipe.name}”.`;
        } else {
          const status = action === "player-approve" ? "approved" : "declined";
          await this.host.decidePlayerRecipe(row.userId, row.recipe, status);
          this.message = `${row.userName}'s “${row.recipe.name}” ${status === "approved" ? "approved: it now plays for their characters" : row.state === "approved" ? "revoked" : "declined"}.`;
        }
        this.render();
        return;
      }
      if (action === "card-include") { await this.toggleCardInclude(b.dataset.id); return; }
      if (action === "select") {
        if (this.selected === b.dataset.id && this.studio) return;
        if (this.selected !== b.dataset.id) { this.stageIndex = 0; this.studioTime = 0; }
        this.selected = b.dataset.id;
        this.studio = true;
        this.render();
        this.root.querySelector(".an-studio")?.focus({ preventScroll: true });
        return;
      }
      if (action === "stage") {
        if (this.stageIndex === Number(b.dataset.index)) return;
        this.stageIndex = Number(b.dataset.index); this.keyframeIndex = 0; this.keyframeFocus = false;
        this.updateInspector();
        return;
      }
      if (action === "variant-pick") {
        this.stageIndex = Number(b.dataset.variantPick); this.keyframeIndex = 0; this.keyframeFocus = false;
        this.render();
        return;
      }
      if (action === "variant-add" || action === "variant-leave") {
        if (b.dataset.variantPick) this.stageIndex = Number(b.dataset.variantPick);
        const r = this.edit(), i = Math.min(this.stageIndex, r.stages.length - 1), s = r.stages[i];
        if (action === "variant-add") {
          if (r.stages.length >= MAX_STAGES) throw Error(`Recipes support up to ${MAX_STAGES} stages.`);
          s.variantGroup ??= uuid().slice(0, 8);
          const n = variantMembers(r.stages, s.variantGroup).length + 1;
          const copy = { ...clone(s), stageId: uuid(), label: `${(s.label || KINDS[s.kind]).replace(/ · variant \d+$/, "")} · variant ${n}` };
          const last = r.stages.lastIndexOf(variantMembers(r.stages, s.variantGroup).at(-1));
          r.stages.splice(last + 1, 0, copy);
          this.stageIndex = last + 1;
          this.message = "Variant added at the same time. Change its asset, size or timing; each play picks one of them.";
        } else {
          const group = s.variantGroup;
          delete s.variantGroup;
          const rest = variantMembers(r.stages, group);
          if (rest.length === 1) delete rest[0].variantGroup;
          this.message = "It now plays every time.";
        }
        this.render();
        return;
      }
      if (action === 'teleport-asset-default' || action === 'teleport-asset-none') {
        if (!['teleportOut', 'teleportIn'].includes(b.dataset.field)) return;
        this.stopEditorPreview();
        const r = this.edit();
        if (action === 'teleport-asset-none') r[b.dataset.field] = 'none';
        else delete r[b.dataset.field];
        this.render();
        return;
      }
      if (action === "browse" || action === 'browse-teleport') {
        if (action === 'browse-teleport' && !['teleportOut', 'teleportIn'].includes(b.dataset.field)) return;
        this.mediaLibrary ??= new MediaLibrary(this);
        this.mediaLibrary.open('animation', action === 'browse-teleport' ? b.dataset.field : null);
        return;
      }
      if (action === "inspect-asset") {
        this.selectedAssetKey = b.dataset.key;
        this.render();
        return;
      }
      if (action === "choose-asset") {
        const r = this.edit();
        r.stages[Math.min(this.stageIndex, r.stages.length - 1)].assets = [
          b.dataset.key,
        ];
        this.page = "recipes";
        this.render();
        return;
      }
      if (action === "orb-builder") {
        this.builder = { element: "fire" };
        this.page = "builder";
        this.message = "";
        this.render();
        return;
      }
      if (action === "cancel-builder") {
        this.builder = null;
        this.page = "recipes";
        this.render();
        return;
      }
      if (action === "orb-element") {
        this.builder.element = b.dataset.element;
        this.render();
        return;
      }
      if (action === "create-orb") {
        const base = orbRecipe(
          this.builder,
          uuid(),
          this.host.catalog(),
        );
        base.name = this.builder.name?.trim() || base.name;
        await this.host.save([...this.host.recipes(), validateRecipe(base)]);
        this.selected = base.id;
        this.page = "recipes";
        this.studio = true;
        this.studioTime = 0;
        this.builder = null;
        this.stageIndex = 0;
        this.category = "All";
        this.search = "";
        this.message =
          "Chromatic orb created. Every layer is editable; choose a trigger when ready.";
        this.render();
        return;
      }
      if (action === "new" && this.lastingRecipesAvailable()) { this.newChooser = true; this.render(); return; }
      if (action === "new-cancel") { this.newChooser = false; this.render(); return; }
      if (action === "new" || action === "new-basic" || action === "new-action" || action === "new-lasting") {
        const lasting = action === "new-lasting";
        this.newChooser = false;
        // Normalize neutral stage defaults, then leave asset selection to author.
        // Incomplete drafts stay local; Save uses strict recipe validation.
        const base = validateRecipe({
          id: uuid(),
          name: lasting ? "Untitled lasting animation" : "Untitled recipe",
          description: "",
          trigger: lasting ? "effect" : "manual",
          ...(lasting ? { lifecycle: "document", systemId: this.host.environment().systemId } : {}),
          category: "Custom",
          color: "#9e8aff",
          stages: [
            {
              kind: lasting ? "aura" : "cast",
              assets: ["jb2a.cast_generic"],
              delay: 0,
              duration: lasting ? 3000 : 1000,
              scale: 1,
              ...(lasting ? { subject: "source", persist: true } : {}),
            },
          ],
        });
        base.stages[0].assets = [];
        this.drafts.set(base.id, base);
        this.dirty.add(base.id);
        this.selected = base.id;
        this.page = "recipes";
        this.studio = true;
        this.studioTime = 0;
        this.builder = null;
        this.previewMode = "recipe";
        this.category = "All";
        this.search = "";
        this.stageIndex = 0;
        this.studioSettings = lasting;
        this.message = lasting
          ? "Type the condition or effect it is for, then choose an asset. Save when ready."
          : "Choose an asset or token motion, then add stages. Save when ready.";
        this.render();
        return;
      }
      if (["kf-select", "kf-add", "kf-delete", "kf-flip", "kf-reset", "kf-smooth"].includes(action)) {
        if (action === "kf-select") {
          // Selecting is view state: it never creates a draft.
          if (this.recipe()?.stages[this.stageIndex]?.motion !== "path") return;
          this.keyframeIndex = Number(b.dataset.kf); this.keyframeFocus = true; this.render();
          return;
        }
        const cur = this.recipe()?.stages[this.stageIndex];
        if (!cur || cur.motion !== "path") return;
        const kfs0 = normalizeKeyframes(cur.keyframes), i = this.selectedKeyframe(cur);
        let changed = true, s = null, kfs = kfs0;
        if (action === "kf-add") {
          const next = insertKeyframe(kfs0, (kfs0[i].at + kfs0[Math.min(kfs0.length - 1, i + 1)].at) / 2);
          if (next === kfs0) changed = false;
          else { s = this.edit().stages[this.stageIndex]; s.keyframes = next; this.keyframeIndex = i + 1; }
        } else if (action === "kf-smooth") {
          // Only edits (and so only makes a draft) when some keyframe was not linear yet.
          const next = smoothKeyframes(kfs0);
          if (next === kfs0) changed = false;
          else { s = this.edit().stages[this.stageIndex]; s.keyframes = next; }
        } else s = this.edit().stages[this.stageIndex];
        if (!s) return;
        if (action === "kf-delete") { s.keyframes = deleteKeyframe(kfs, i); this.keyframeIndex = Math.max(0, i - 1); }
        if (action === "kf-flip") s.keyframes = flipKeyframes(kfs);
        if (action === "kf-reset") { s.keyframes = resetKeyframes(); this.keyframeIndex = 1; }
        if (changed) this.message = action === "kf-smooth" ? "Path smoothed: one continuous motion. Save to apply." : "Path updated. Save to apply.";
        this.render();
        return;
      }
      if (action === "new-finisher") {
        const id = uuid(), preset = b.dataset.preset;
        const base = preset ? presetFinisher(preset, id) : validateRecipe({ id, name: "Untitled finisher", trigger: "manual", color: "#c0392b", finisher: {},
          stages: [{ stageId: "fly", kind: "motion", motion: "leap", subject: "targets", motionRange: "distance", motionHeading: "away", motionEnd: "hold", distance: 2, duration: 1100, assets: [] }] });
        this.drafts.set(base.id, base);
        this.dirty.add(base.id);
        Object.assign(this, { selected: base.id, page: "finishers", studio: true, studioTime: 0, stageIndex: 0, previewMode: "recipe" });
        this.message = "Set what it applies to, then Save. Copied presets are yours to change.";
        this.render();
        return;
      }
      if (action === "duplicate") {
        const base = clone(this.recipe());
        base.id = uuid();
        base.name = `${base.name} copy`;
        // A lasting copy stays lasting, just no longer tied to a catalog entry.
        if (base.lifecycle === "document") base.stateEntry = "";
        else base.trigger = "manual";
        base.itemUuid = "";
        base.match = "";
        base.category = "Custom";
        await this.host.save([...this.host.recipes(), validateRecipe(base)]);
        this.selected = base.id;
        this.page = base.finisher ? "finishers" : "recipes";
        this.studio = true;
        this.studioTime = 0;
        this.category = "All";
        this.search = "";
        this.stageIndex = 0;
        this.render();
        return;
      }
      if (action === "revert") {
        const unsaved = !this.host
          .recipes()
          .some((r) => r.id === this.selected);
        this.drafts.delete(this.selected);
        this.dirty.delete(this.selected);
        if (unsaved) { this.selected = this.listedRecipes()[0]?.id; this.studio = false; }
        this.message = "";
        this.render();
        return;
      }
      if (action === "save") {
        const r = validateRecipe(this.recipe());
        const saved = this.host.recipes();
        await this.host.save(
          saved.some((old) => old.id === r.id)
            ? saved.map((old) => (old.id === r.id ? r : old))
            : [...saved, r],
        );
        this.drafts.delete(r.id);
        this.dirty.delete(r.id);
        this.message = "Recipe saved.";
      }
      if (action === "add-motion" && this.recipe()?.lifecycle !== "document") {
        const r = this.edit();
        if (r.stages.length < MAX_STAGES) {
          r.stages.push({
            stageId: uuid(),
            kind: "motion",
            startMode: "with",
            startRef: r.stages.at(-1)?.stageId,
            motion: "lunge",
            subject: "source",
            assets: [],
            delay: 0,
            duration: 800,
            distance: 0.35,
            intensity: 1,
            scale: 1,
            opacity: 1,
            below: false,
            persist: false,
          });
          linkStartModes(r.stages);
          this.stageIndex = r.stages.length - 1;
        }
      }
      if (action === "add-stage") {
        const r = this.edit();
        if (r.stages.length < MAX_STAGES) {
          r.stages.push({
            ...clone(r.stages.at(-1)),
            stageId: uuid(),
            label: "",
            afterStage: "",
            ...(r.lifecycle === "document" ? {} : { startMode: "after", startRef: r.stages.at(-1).stageId, startOffset: 0 }),
            kind: r.lifecycle === "document" ? "aura" : "impact",
            assets: r.lifecycle === "document" ? [...r.stages.at(-1).assets] : ["jb2a.impact"],
            subject: r.lifecycle === "document" ? "source" : r.stages.at(-1).subject,
            persist: r.lifecycle === "document",
            delay: r.lifecycle === "document" ? 0 : Math.min(30000, r.stages.at(-1).delay + 800),
          });
          linkStartModes(r.stages);
          this.stageIndex = r.stages.length - 1;
        }
      }
      if (action === "remove-stage") {
        const r = this.edit();
        if (r.stages.length > 1) {
          const resolved = sampleRecipe(r).stages;
          const removedId = r.stages[this.stageIndex].stageId;
          r.stages.forEach((stage, i) => {
            if (stage.afterStage === removedId && !stage.startMode) {
              stage.delay = resolved[i].delay;
              stage.afterStage = "";
            }
          });
          r.stages.splice(this.stageIndex, 1);
          linkStartModes(r.stages);
          this.stageIndex = Math.max(0, this.stageIndex - 1);
        }
      }
      if (action === "move-stage") {
        this.moveStage(
          this.stageIndex,
          this.stageIndex + Number(b.dataset.dir),
        );
        return;
      }
      if (action === "open-bound") {
        // A finisher's Applies-to card names its own item; a recipe opens its bound item.
        const item = await this.host.resolveItem?.(b.dataset.uuid || this.recipe().itemUuid);
        if (!item?.sheet) throw Error("The bound item is unavailable.");
        await item.sheet.render({ force: true });
        return;
      }
      if (action === "finisher-unlink") {
        // Finishers match by name: removing a card also drops its link and a hidden itemUuid from an older drop.
        const current = this.recipe(), match = String(current?.match ?? ""), next = removeFinisherName(match, b.dataset.name);
        if (next !== addFinisherName(match, "") || current?.itemUuid || unlinkFinisherItem(current?.finisher, b.dataset.name) !== current?.finisher) {
          const r = this.edit();
          r.match = next;
          r.itemUuid = "";
          r.finisher = unlinkFinisherItem(r.finisher, b.dataset.name);
          this.message = `Removed ${b.dataset.name}. Save to apply.`;
        }
      }
      if (action === "unbind") {
        this.edit().itemUuid = "";
        if (this.edit().lifecycle === "document") this.edit().stateEntry = "";
      }
      if (action === "preview" || action === "play") {
        // Check selection before the window tucks away, so the reason stays visible.
        const tokens = this.host.previewTokens?.() ?? {};
        const needsCaster = this.recipe()?.stages.some((s) => !["template", "sound", "overlay", "scenefx"].includes(s.kind));
        if ("source" in tokens && !tokens.source && needsCaster) {
          this.message = "Select your source token on the canvas first (and target any creatures), then try again.";
          globalThis.ui?.notifications?.warn(`Animater: ${this.message}`);
          this.render();
          return;
        }
        this.busy = true;
        this.message = "Preparing animation…";
        this.render();
        let restore = null;
        try {
          restore = await this.tuckForPlayback();
          const result = await this.host.play(
            validateRecipe(this.recipe()),
            action === "preview",
            {
              onStart: (compiled) => {
                const clock = new RecipeClock();
                const scene = this.root.querySelector("[data-recipe-scene]");
                const recipe = compiled ?? {
                  ...validateRecipe(this.recipe()),
                  targetCount: this.host.previewTokens?.().targetCount ?? 1,
                };
                // While the window is tucked away nobody sees its mirror of the
                // animation; building one (an extra WebGL renderer and its shaders)
                // only stalls the canvas just as the animation starts.
                const visual = scene && !restore
                  ? new RecipePreview(scene, previewVariants(recipe, this.stageIndex), (frame) =>
                    this.updatePlayback(frame),
                  {tokenFx:this.host.createTokenFxPreview,sceneFx:this.host.createSceneFxPreview})
                  : null;
                void visual?.prepareTokenFx();
                this.previewRun = {
                  stop: () => {
                    clock.stop();
                    visual?.stop();
                  },
                };
                const idle = this.root.querySelector("[data-preview-idle]");
                if (idle) idle.hidden = true;
                void clock.play(recipe, (frame) =>
                  visual ? visual.draw(frame) : this.updatePlayback(frame),
                );
              },
            },
          );
          this.message =
            result === null
              ? "Animation stopped."
              : action === "preview"
                ? "Local preview complete."
                : "Animation played at table.";
        } finally {
          this.stopEditorPreview();
          this.busy = false;
          await restore?.().catch(() => {});
        }
      }
      if (action === "stop") {
        this.stopEditorPreview();
        await this.host.stop();
        await this.untuck?.();
        this.busy = false;
        this.message = "Your Animater effects stopped.";
      }
      if (action === "refresh") {
        this.host.refreshCatalog();
        this.message = "Asset library refreshed.";
      }
      if (action === "use-every-catalog") {
        const { on, total } = await this.host.useEveryCatalog();
        this.message = `${on} of ${total} catalogs are on. Everything animates when used.`;
      }
      if (action === "automation") {
        await this.host.setEnabled(!this.host.enabled());
        this.message = `Automatic playback ${this.host.enabled() ? "enabled" : "disabled"}.`;
      }
      if(action==='catalog-fx-toggle') {
        if(!['catalogTokenFx','catalogSceneFx'].includes(b.dataset.setting))return;
        const state=this.host.catalogFxSettings?.()??{token:true,scene:true};
        await this.host.setCatalogFxSetting?.(b.dataset.setting,!state[b.dataset.fxKind]);
        this.render();return;
      }
      if (action === "export") {
        await this.host.export(
          JSON.stringify({ schema: 1, recipes: this.host.recipes() }, null, 2),
        );
        this.message = "Saved recipes exported. Unsaved edits excluded.";
      }
      if (action === "import") {
        this.pendingImport = [];
        this.render();
        this.root.querySelector("[data-import]").focus();
        return;
      }
      if (action === "cancel-import") {
        this.pendingImport = null;
        this.message = "";
      }
      if (action === "review-import") {
        this.pendingImport = parseImport(
          this.root.querySelector("[data-import]").value,
        );
        const replaced = this.pendingImport.filter((r) =>
          this.host.recipes().some((old) => old.id === r.id),
        ).length;
        this.root.querySelector("[data-import-review]").textContent =
          `${this.pendingImport.length} recipes: ${this.pendingImport.length - replaced} new, ${replaced} existing replaced.`;
        this.root.querySelector('[data-action="confirm-import"]').disabled =
          false;
        return;
      }
      if (action === "confirm-import") {
        const replacements = new Map(this.pendingImport.map((r) => [r.id, r]));
        const merged = this.host
          .recipes()
          .map((r) => replacements.get(r.id) ?? r)
          .concat(
            this.pendingImport.filter(
              (r) => !this.host.recipes().some((old) => old.id === r.id),
            ),
          );
        if (merged.length > 200) throw Error("Maximum 200 recipes.");
        await this.host.save(merged);
        this.pendingImport = null;
        this.drafts.clear();
        this.dirty.clear();
        this.selected = merged[0]?.id;
        this.message =
          "Recipes imported. Automatic playback setting unchanged.";
      }
      if (action === "delete") {
        const r = this.recipe();
        if (!this.host.recipes().some((old) => old.id === r.id)) {
          this.drafts.delete(r.id);
          this.dirty.delete(r.id);
          this.selected = this.listedRecipes()[0]?.id;
          this.studio = false;
          this.stageIndex = 0;
          this.message = "Draft discarded.";
          this.render();
          return;
        }
        if (
          !(await this.host.confirm(
            `Delete “${r.name}”? Export recipes first if you want a backup.`,
          ))
        )
          return;
        await this.host.save(
          this.host.recipes().filter((old) => old.id !== r.id),
        );
        this.drafts.delete(r.id);
        this.dirty.delete(r.id);
        this.selected = this.host.recipes()[0]?.id;
        this.studio = false;
        this.stageIndex = 0;
      }
      if (action === "restore-starters") {
        const old = this.host.recipes();
        const added = starterRecipes().filter(
          (r) => !old.some((o) => o.id === r.id),
        );
        await this.host.save([...old, ...added]);
        this.message = `Added ${added.length} starter recipes. Existing edits preserved.`;
      }
      this.render();
    } catch (error) {
      this.busy = false;
      this.message = error.message;
      // The window may have been tucked away for playback: say why nothing played.
      if (action === "play" || action === "preview") globalThis.ui?.notifications?.warn(`Animater: ${error.message}`);
      if (action === "review-import") {
        this.root.querySelector("[data-import-review]").textContent =
          error.message;
        this.root.querySelector('[data-action="confirm-import"]').disabled =
          true;
      } else this.render();
    }
  }
}
