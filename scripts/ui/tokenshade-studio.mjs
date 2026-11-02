// The Tokenshade page (Tools > Tokenshade): every Tokenshade preset in one place, played live on a token, with the
// full layer editor beside it (ui/token-fx-editor.mjs). An edit works on a copy; Save as my preset keeps it in My
// presets, and Add to animation puts it into any recipe as a token filter stage. Built-in presets never change.
import { tokenFxEditorHTML, applyTokenFxEdit, tokenFxAction } from "./token-fx-editor.mjs";
import { layersOf } from "../engines/tokenshade/layers.mjs";
import { libraryId } from "../engines/tokenshade/presets.mjs";
import { DRIVE_SOURCES } from "../engines/tokenshade/animation.mjs";
import { shuffleLayers, shareCode, readShareCode } from "../engines/tokenshade/share.mjs";
import { validateRecipe } from "../core/model.mjs";
import { filterLabel } from "../engines/tokenshade/controls.mjs";
import { CONDITION_LOOK_PRESETS } from "../catalogs/shared/condition-looks.mjs";
import { DAMAGE_LOOK_PRESETS } from "../engines/playback/damage-moments.mjs";
import { TETHER_LABELS } from "../engines/playback/tethers.mjs";

// The preset list's sections, in order. A preset's section comes from what it is: a name prefix, how it animates
// (once: a transition; driven: follows the game), whether a condition or damage uses it, or Token Magic's basics.
export const PRESET_GROUPS = ["Body forms", "Transitions", "Follows the game", "Knocked out", "Conditions", "Places", "Damage", "Attitudes", "Markers", "Looks", "Basics"];
const CONDITION_SET = new Set(CONDITION_LOOK_PRESETS), DAMAGE_SET = new Set(DAMAGE_LOOK_PRESETS);
// Looks meant for a region (Region configuration → Animater look) and the heat and cold around creatures.
const PLACE_SET = new Set(["Haunted ground", "Firelit", "Moonlit", "Fey glade", "Heat shimmer", "Cold mist", "Submerged"]);
export function presetGroup(name, params = []) {
  const anims = (params ?? []).flatMap((p) => Object.values(p?.animated ?? {})).map((a) => a?.animType);
  if (/^Knocked out:/.test(name)) return "Knocked out";
  if (/^Attitude:/.test(name)) return "Attitudes";
  if (/^Marker:/.test(name)) return "Markers";
  // Wings and growths take on the creature's body (they grow in, so they would otherwise read as transitions).
  if ((params ?? []).some((p) => ["wings", "growth"].includes(p?.filterType))) return "Body forms";
  if (anims.includes("once")) return "Transitions";
  if (anims.includes("driven")) return "Follows the game";
  if (DAMAGE_SET.has(name)) return "Damage";
  // A valued condition's stronger steps ("Dying 3") sit with the condition.
  if (CONDITION_SET.has(name.replace(/ \d$/, ""))) return "Conditions";
  if (PLACE_SET.has(name)) return "Places";
  return /^[a-z]/.test(name) ? "Basics" : "Looks";
}

export const TOKENSHADE_PAGE = "tokenshade";
export const STUDIO_INDEX = "studio";
const LIBRARIES = { tokenshade: "Token", "tokenshade-region": "Region", "tokenshade-custom": "Mine", travel: "Travel" };
// The Travel tab: what a travel or projectile stage can draw itself (playback/tethers.mjs) instead of a clip.
const TRAVEL = "travel";
// What the preview stands on: a map-grey grid by default, so dark looks (shadow, smoke) show against it.
const BACKGROUNDS = { map: "Map", light: "Light", dark: "Dark" };
const LOOP_MS = 60000;
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// The stage an edit works on: the chosen preset, as a token filter stage.
export const studioStage = (library, name) => ({ kind: "tokenfx", assets: [], fxLibrary: library, fxPreset: name ?? "", subject: "source", duration: 3000 });
// The stage Add to animation puts into a recipe: the preset by name, or its edited copy.
export function stageForRecipe(draft, preset) {
  const stage = { ...studioStage(draft.fxLibrary, draft.fxPreset), ...(draft.fxSpeed && draft.fxSpeed !== 1 ? { fxSpeed: draft.fxSpeed } : {}) };
  if (draft.fxLayers?.length) stage.fxLayers = structuredClone(layersOf(draft, preset));
  return stage;
}

export class TokenshadeStudio {
  constructor(workspace) {
    this.w = workspace;
    this.library = "tokenshade";
    this.search = "";
    this.draft = null;
    this.epoch = 0;
    this.status = "";
    // Test values for effects that follow the game (animation.mjs DRIVE_SOURCES): none until a slider moves, so the
    // preview makes up values that keep changing (token-fx-preview.mjs simulatedDrive).
    this.live = null;
    this.background = "map";
    // The preview's zoom (the token's size on the stage) and which list sections are open.
    this.zoom = 1;
    this.openGroups = new Set();
    // The travel look shown in the Travel tab.
    this.tether = "rope";
  }
  // Does the effect being edited follow the game anywhere (a 'driven' animation)?
  followsGame() { return layersOf(this.draft ?? {}, this.preset()).some((l) => Object.values(l.animated ?? {}).some((a) => a.animType === "driven")); }
  presets() { return (this.w.host.fxCatalog?.()?.presets ?? []).filter((p) => libraryId(p.library) === this.library); }
  preset() { return this.draft ? this.w.host.tokenFxPreset?.(this.draft.fxLibrary, this.draft.fxPreset) ?? null : null; }
  select(name) { this.draft = studioStage(this.library, name); }

  html() {
    if (this.library === TRAVEL) return this.travelHTML();
    const ready = this.w.host.fxCatalog?.()?.tokenReady === true;
    if (!ready) return `<div class="an-work"><section class="an-library"><div class="an-empty">Tokenshade is turned off.<small>Turn on Tokenshade filters in Animater settings, or raise this screen's animation quality.</small></div></section></div>`;
    const catalog = this.w.host.fxCatalog?.()?.presets ?? [];
    const all = this.presets(), q = this.search.trim().toLowerCase();
    const list = q ? all.filter((p) => p.name.toLowerCase().includes(q)) : all;
    if (!this.draft || this.draft.fxLibrary !== this.library || !all.some((p) => p.name === this.draft.fxPreset)) { if (!this.draft?.fxLayers?.length || !all.length) this.select(list[0]?.name ?? ""); }
    const d = this.draft, recipes = this.w.listedRecipes?.() ?? [], has = Boolean(d?.fxPreset || d?.fxLayers?.length);
    const count = (id) => id === TRAVEL ? Object.keys(TETHER_LABELS).length : catalog.filter((p) => libraryId(p.library) === id).length;
    const kinds = (p) => [...new Set((p.filterTypes ?? []).map(filterLabel))];
    const tabs = Object.entries(LIBRARIES).map(([id, label]) => `<button type="button" class="${id === this.library ? "is-active" : ""}" data-action="studio-library" data-library="${id}" aria-pressed="${id === this.library}">${esc(label)} <small>${count(id)}</small></button>`).join("");
    const row = (p) => `<li><button type="button" class="an-studio-row${p.name === d?.fxPreset ? " is-active" : ""}" data-action="studio-pick" data-name="${esc(p.name)}" aria-pressed="${p.name === d?.fxPreset}"><span>${esc(p.name)}</span><small>${esc(kinds(p).join(" · "))}</small></button></li>`;
    const groupOf = (p) => presetGroup(p.name, this.w.host.tokenFxPreset?.(p.library, p.name)?.params ?? []);
    const sections = PRESET_GROUPS.map((g) => [g, list.filter((p) => groupOf(p) === g)]).filter(([, ps]) => ps.length);
    // The chosen preset's section starts open.
    const mine = d?.fxPreset ? groupOf({ name: d.fxPreset, library: this.library }) : null;
    if (mine && !this.groupsTouched) this.openGroups.add(mine);
    const items = sections.map(([g, ps]) => `<li class="an-studio-group"><details data-studio-group="${esc(g)}" ${q || this.openGroups.has(g) ? "open" : ""}><summary><span>${esc(g)}</span><small>${ps.length}</small></summary><ul>${ps.map(row).join("")}</ul></details></li>`).join("");
    const chosen = catalog.find((p) => libraryId(p.library) === this.library && p.name === d?.fxPreset);
    const img = this.w.host.mediaURL?.("icons/svg/mystery-man.svg") ?? "icons/svg/mystery-man.svg";
    const px = Math.round(180 * this.zoom), params = this.preset()?.params ?? d?.fxLayers ?? [];
    const group = d?.fxPreset ? presetGroup(d.fxPreset, params) : null;
    // What the preview is doing, unless something more pressing (an error, a copy) is being said.
    this.described = !has ? "" : group === "Transitions" || group === "Knocked out" ? "Plays once, then holds · replays after a short pause" : this.followsGame() ? "Follows the game · the values below change on their own" : "Playing · loops";
    const said = this.status || this.described;
    const token = this.w.host.previewTokens?.()?.source;
    const art = token?.img ? (this.w.host.mediaURL?.(token.img) ?? token.img) : img;
    const backgrounds = Object.entries(BACKGROUNDS).map(([id, label]) => `<button type="button" class="${id === this.background ? "is-active" : ""}" data-action="studio-background" data-background="${id}" aria-pressed="${id === this.background}">${esc(label)}</button>`).join("");
    const live = this.followsGame() ? `<div class="an-studio-card an-studio-live"><div class="an-studio-card-title"><b>Try it as the game changes</b><small>${this.live ? "Your values" : "Changing on their own until you move one"}</small></div>${Object.entries(DRIVE_SOURCES).map(([k, label]) => `<label>${esc(label)}<input type="range" data-studio-live="${k}" min="0" max="1" step="0.05" value="${this.live?.[k] ?? 0}"></label>`).join("")}</div>` : "";
    const use = has ? `<div class="an-studio-card an-studio-use"><div class="an-studio-card-title"><b>Use it</b><small>As a token filter stage in any animation</small></div>
      <div class="an-studio-use-row"><select data-studio="recipe" aria-label="Recipe to add it to"><option value="">Choose a recipe…</option>${recipes.map((r) => `<option value="${esc(r.id)}">${esc(r.name)}</option>`).join("")}</select><button type="button" class="an-studio-primary" data-action="studio-add" ${recipes.length ? "" : "disabled"}>Add to animation</button></div>
      <button type="button" class="an-studio-ghost" data-action="studio-canvas" ${this.w.host.previewTokenFx ? "" : "disabled"}>Preview on the canvas</button></div>` : "";
    return `<div class="an-work an-studio-work"><section class="an-library an-studio-list">
  <header class="an-studio-head"><span class="an-eyebrow">TOOLS</span><h2>Tokenshade</h2><p>Animater's own shader effects: try any, change any layer, save your own, add it to an animation.</p></header>
  <div class="an-segmented an-studio-libraries" role="group" aria-label="Preset library">${tabs}</div>
  <input type="search" class="an-studio-search" data-studio="search" placeholder="Search ${esc(all.length)} presets" value="${esc(this.search)}" aria-label="Search presets">
  ${items ? `<ul class="an-studio-presets">${items}</ul>` : `<div class="an-empty">${this.library === "tokenshade-custom" ? "No presets of your own yet.<small>Edit any preset and use Save as my preset.</small>" : "Nothing matches."}</div>`}
</section>
<section class="an-studio-stage">
  <div class="an-studio-card an-studio-preview">
    <div class="an-studio-card-title"><b>${esc(d?.fxPreset || (d?.fxLayers?.length ? "Your effect" : "Nothing chosen"))}</b>${chosen ? `<span class="an-studio-kinds">${kinds(chosen).map((k) => `<span>${esc(k)}</span>`).join("")}</span>` : ""}</div>
    <div class="an-media-preview an-tokenfx-scene an-studio-scene" data-studio-scene data-fit-token-fx data-studio-bg="${esc(this.background)}" aria-label="Tokenshade preview"><div class="an-tokenfx-sample" data-preview-token="source" style="width:${px}px;height:${px}px"><div class="an-preview-token-art"><img src="${esc(art)}" alt="${esc(token?.name ?? "Sample token")}" style="width:${px}px;height:${px}px"></div></div>
      <div class="an-segmented an-studio-backgrounds" role="group" aria-label="Preview background">${backgrounds}</div>
      ${has ? `<button type="button" class="an-studio-replay" data-action="studio-replay" data-tooltip="Play it again from the start (transitions play once, then hold)" aria-label="Replay">↻ Replay</button>` : ""}
    </div>
    <div class="an-studio-preview-foot"><span class="an-studio-status" data-studio-status>${esc(said)}</span><label class="an-studio-zoom">Zoom<input type="range" data-studio="zoom" min="0.6" max="2" step="0.1" value="${this.zoom}" aria-label="Preview zoom"></label></div>
  </div>
  ${live}${use}
</section>
<section class="an-studio-editor">
  <div class="an-studio-tools">${has ? `<button type="button" data-action="studio-shuffle" data-tooltip="A variation: every setting nudged, colours turned a little">⚄ Shuffle</button><button type="button" data-action="studio-share" data-tooltip="Copy this effect as a code to paste in Discord or an issue">⧉ Copy to share</button>` : ""}<button type="button" data-action="studio-import-open" aria-expanded="${this.importing === true}">⇩ Import</button></div>
  ${this.importing ? `<div class="an-studio-card an-studio-import"><textarea data-studio="import-text" rows="3" placeholder="Paste a Tokenshade share code (animater-fx:…)" aria-label="Share code"></textarea><button type="button" class="an-studio-primary" data-action="studio-import">Add to My presets</button></div>` : ""}
  ${d ? tokenFxEditorHTML(d, STUDIO_INDEX, this.preset(), { canSave: true }).replace("<details class=\"an-fx-editor\"", "<details class=\"an-fx-editor\" open").replace("edited for this stage", "edited") : ""}</section></div>`;
  }

  // The Travel tab: the drawn travel looks, one playing over and over across the preview.
  travelHTML() {
    const catalog = this.w.host.fxCatalog?.()?.presets ?? [];
    const count = (id) => id === TRAVEL ? Object.keys(TETHER_LABELS).length : catalog.filter((p) => libraryId(p.library) === id).length;
    const tabs = Object.entries(LIBRARIES).map(([id, label]) => `<button type="button" class="${id === this.library ? "is-active" : ""}" data-action="studio-library" data-library="${id}" aria-pressed="${id === this.library}">${esc(label)} <small>${count(id)}</small></button>`).join("");
    const [name, blurb] = TETHER_LABELS[this.tether] ?? TETHER_LABELS.rope;
    const rows = Object.entries(TETHER_LABELS).map(([id, [label, about]]) => `<li><button type="button" class="an-studio-row${id === this.tether ? " is-active" : ""}" data-action="studio-tether" data-style="${esc(id)}" aria-pressed="${id === this.tether}"><span>${esc(label)}</span><small>${esc(about)}</small></button></li>`).join("");
    const token = this.w.host.previewTokens?.()?.source, img = this.w.host.mediaURL?.("icons/svg/mystery-man.svg") ?? "icons/svg/mystery-man.svg";
    const art = token?.img ? (this.w.host.mediaURL?.(token.img) ?? token.img) : img, px = Math.round(120 * this.zoom);
    this.described = "Playing · loops";
    return `<div class="an-work an-studio-work"><section class="an-library an-studio-list">
  <header class="an-studio-head"><span class="an-eyebrow">TOOLS</span><h2>Tokenshade</h2><p>Travel looks: what a travel or projectile stage can draw itself, from its caster to its target, where no clip fits.</p></header>
  <div class="an-segmented an-studio-libraries" role="group" aria-label="Preset library">${tabs}</div>
  <ul class="an-studio-presets"><li class="an-studio-group"><details open><summary><span>Travel looks</span><small>${Object.keys(TETHER_LABELS).length}</small></summary><ul>${rows}</ul></details></li></ul>
</section>
<section class="an-studio-stage">
  <div class="an-studio-card an-studio-preview">
    <div class="an-studio-card-title"><b>${esc(name)}</b><span class="an-studio-kinds"><span>Travel look</span></span></div>
    <div class="an-media-preview an-tokenfx-scene an-studio-scene an-studio-travel" data-studio-scene data-studio-bg="${esc(this.background)}" aria-label="Travel look preview" style="justify-content:flex-start;padding-left:12%"><div class="an-tokenfx-sample" data-preview-token="source" style="width:${px}px;height:${px}px"><div class="an-preview-token-art"><img src="${esc(art)}" alt="${esc(token?.name ?? "Sample token")}" style="width:${px}px;height:${px}px"></div></div></div>
    <div class="an-studio-preview-foot"><span class="an-studio-status" data-studio-status>${esc(this.status || this.described)}</span></div>
  </div>
  <div class="an-studio-card an-studio-use"><div class="an-studio-card-title"><b>Use it</b><small>${esc(blurb)}</small></div>
    <p class="an-hint">In any animation, open a travel or projectile stage, set <b>Travel look</b> to Tokenshade and <b>Tokenshade travel</b> to ${esc(name)}. Its clip still sets the timing; a tint colours it.</p>
    <button type="button" class="an-studio-ghost" data-action="studio-tether-canvas" ${this.w.host.previewTether ? "" : "disabled"}>Preview on the canvas</button></div>
</section></div>`;
  }

  // Live preview: the draft plays on the sample token, looped, restarted after each edit.
  mount() {
    // Sections the GM opens or closes stay that way across redraws.
    for (const el of this.w.root.querySelectorAll?.("[data-studio-group]") ?? []) {
      if (el.dataset.watched) continue;
      el.dataset.watched = "1";
      el.addEventListener("toggle", () => { if (this.search.trim()) return; this.groupsTouched = true; if (el.open) this.openGroups.add(el.dataset.studioGroup); else this.openGroups.delete(el.dataset.studioGroup); });
    }
    clearTimeout(this.restartTimer);
    this.restartTimer = setTimeout(() => void this.play(), 60);
  }
  async play() {
    const epoch = ++this.epoch;
    await this.stopRun();
    const scene = this.w.root.querySelector("[data-studio-scene]");
    if (this.library === TRAVEL) {
      if (!scene || !this.w.host.createTetherPreview) return;
      const preview = this.w.host.createTetherPreview(scene, this.tether);
      if (epoch !== this.epoch) { preview?.stop(); return; }
      this.run = preview;
      return;
    }
    if (!scene || !this.draft || (!this.draft.fxPreset && !this.draft.fxLayers?.length) || !this.w.host.createTokenFxPreview) return;
    try {
      delete scene.dataset.fxError;
      // One effect on one token: its own frame loop drives the preview (local time from 0, so a transition plays
      // from its start), with no recipe clock in between.
      const recipe = validateRecipe({ id: "tokenshade-studio", name: this.draft.fxPreset || "Tokenshade", trigger: "manual", stages: [{ ...this.draft, persist: false, duration: LOOP_MS }] });
      const preview = await this.w.host.createTokenFxPreview(scene, recipe);
      if (!preview) throw Error("Tokenshade is turned off.");
      // Effects that follow the game read the test values set under the preview.
      preview.drive = () => this.live;
      await preview.ready();
      if (epoch !== this.epoch) { preview.stop(); return; }
      const start = performance.now();
      const frame = () => {
        if (epoch !== this.epoch) return;
        const t = (performance.now() - start) % LOOP_MS;
        preview.draw({ time: t, stages: [{ state: "playing", localTime: t, progress: t / LOOP_MS, iteration: 0 }] });
        this.frame = requestAnimationFrame(frame);
      };
      this.run = { stop: () => { cancelAnimationFrame(this.frame); preview.stop(); } };
      frame();
      this.setStatus(scene.dataset.fxError ? `${scene.dataset.fxError}. Use Preview on canvas for this preset.` : "");
    } catch (error) { if (epoch === this.epoch) this.setStatus(error.message); }
  }
  async stopRun() { const run = this.run; this.run = null; try { run?.stop(); } catch { /* already stopped */ } }
  stop() { this.epoch++; clearTimeout(this.restartTimer); void this.stopRun(); }
  setStatus(text) { this.status = text; const el = this.w.root.querySelector("[data-studio-status]"); if (el) el.textContent = text || this.described || ""; }

  // Inputs on this page: the search box, and the layer editor's fields (data-index="studio"). Returns true when handled.
  input(t) {
    if (this.w.page !== TOKENSHADE_PAGE) return false;
    if (t.dataset?.studio === "search") { this.search = t.value; this.w.render(); return true; }
    if (t.dataset?.studio === "recipe") return true;
    if (t.dataset?.studio === "zoom") {
      this.zoom = Math.min(2, Math.max(0.6, Number(t.value) || 1));
      const px = `${Math.round(180 * this.zoom)}px`, box = this.w.root.querySelector("[data-studio-scene] .an-tokenfx-sample");
      if (box) { box.style.width = box.style.height = px; const im = box.querySelector("img"); if (im) im.style.width = im.style.height = px; }
      this.mount();
      return true;
    }
    if (t.dataset?.studioLive) { (this.live ??= {})[t.dataset.studioLive] = Number(t.value) || 0; return true; }
    if (t.dataset?.index !== STUDIO_INDEX || !this.draft) return false;
    if (t.dataset.field === "fxLayer") {
      if (!["range", "color", "number", "text"].includes(t.type)) return true;
      if (applyTokenFxEdit(this.draft, this.preset(), t.dataset, t)) { const out = t.type === "range" ? t.nextElementSibling : null; if (out?.tagName === "OUTPUT") out.textContent = t.value; this.mount(); }
      return true;
    }
    if (t.dataset.field === "fxSpeed") { this.draft.fxSpeed = Number(t.value) || 1; const out = t.nextElementSibling; if (out?.tagName === "OUTPUT") out.textContent = `${t.value}×`; this.mount(); return true; }
    return false;
  }
  change(t) {
    if (this.w.page !== TOKENSHADE_PAGE) return false;
    if (t.dataset?.studio) return true;
    if (t.dataset?.index !== STUDIO_INDEX || !this.draft) return false;
    if (t.dataset.field === "fxLayer") { if (applyTokenFxEdit(this.draft, this.preset(), t.dataset, t)) this.w.render(); return true; }
    if (t.dataset.field === "fxSpeed") return true;
    return false;
  }
  async action(action, b) {
    if (this.w.page !== TOKENSHADE_PAGE) return false;
    if (action === "studio-library") { this.library = b.dataset.library; this.search = ""; this.draft = null; this.w.render(); return true; }
    if (action === "studio-pick") { this.select(b.dataset.name); this.w.render(); return true; }
    if (action === "studio-tether") { this.tether = Object.hasOwn(TETHER_LABELS, b.dataset.style) ? b.dataset.style : "rope"; this.status = ""; this.w.render(); return true; }
    if (action === "studio-tether-canvas") {
      try { await this.w.host.previewTether(this.tether); this.setStatus("Playing on canvas, from your token to your target"); }
      catch (error) { this.setStatus(error.message); }
      return true;
    }
    if (action === "studio-replay") { this.mount(); return true; }
    if (action === "studio-background") {
      this.background = Object.hasOwn(BACKGROUNDS, b.dataset.background) ? b.dataset.background : "map";
      const scene = this.w.root.querySelector("[data-studio-scene]");
      if (scene) scene.dataset.studioBg = this.background;
      this.w.root.querySelectorAll("[data-action=\"studio-background\"]").forEach((x) => { const on = x.dataset.background === this.background; x.classList.toggle("is-active", on); x.setAttribute("aria-pressed", String(on)); });
      return true;
    }
    if (action === "studio-shuffle" && this.draft) { this.draft.fxLayers = shuffleLayers(layersOf(this.draft, this.preset())); this.w.render(); return true; }
    if (action === "studio-share" && this.draft) {
      const text = shareCode(this.draft.fxPreset || "Tokenshade effect", layersOf(this.draft, this.preset()));
      try { await (globalThis.game?.clipboard?.copyPlainText?.(text) ?? globalThis.navigator?.clipboard?.writeText?.(text)); this.setStatus("Share code copied: paste it in Discord or an issue. Anyone with Animater can import it."); }
      catch { this.setStatus("Could not copy: your browser blocked the clipboard."); }
      return true;
    }
    if (action === "studio-import-open") { this.importing = !this.importing; this.w.render(); return true; }
    if (action === "studio-import") {
      try {
        const shared = readShareCode(this.w.root.querySelector('[data-studio="import-text"]')?.value);
        await this.w.host.saveTokenFxPreset(shared.name, shared.params);
        this.importing = false; this.library = "tokenshade-custom"; this.draft = studioStage(this.library, shared.name);
        this.w.message = `Imported “${shared.name}” into My presets.`;
        this.w.render();
      } catch (error) { this.setStatus(error.message); }
      return true;
    }
    if (action === "studio-canvas") {
      try { const handle = await this.w.host.previewTokenFx({ ...this.draft, subject: "source" }); this.setStatus("Playing on canvas · only you can see this"); setTimeout(() => void handle?.stop?.(), 8000); }
      catch (error) { this.setStatus(error.message); }
      return true;
    }
    if (action === "studio-add") {
      const id = this.w.root.querySelector('[data-studio="recipe"]')?.value;
      if (!id || !this.draft) { this.setStatus("Choose a recipe to add it to."); return true; }
      const stage = stageForRecipe(this.draft, this.preset());
      this.stop();
      this.w.page = "recipes"; this.w.selected = id;
      const r = this.w.edit();
      if (!r) return true;
      // A full stage as the recipe editor makes one (timing and the rest), with this preset.
      const full = validateRecipe({ id: "tokenshade-stage", name: "Tokenshade", trigger: "manual", stages: [stage] }).stages[0];
      const ids = new Set(r.stages.map((x) => x.stageId));
      let n = r.stages.length + 1; while (ids.has(`stage-${n}`)) n++;
      r.stages.push({ ...full, stageId: `stage-${n}` });
      // Opens the recipe in its editor on the new stage.
      this.w.studio = true; this.w.stageIndex = r.stages.length - 1; this.w.studioTime = 0;
      this.w.message = `Added “${this.draft.fxPreset || "Tokenshade effect"}” to ${r.name} as a token filter stage. Save the recipe to keep it.`;
      this.w.render();
      return true;
    }
    if (b.dataset?.index !== STUDIO_INDEX || !this.draft) return false;
    if (action === "fx-preset-save") {
      const name = (this.w.root.querySelector(`[data-fx-preset-name="${STUDIO_INDEX}"]`)?.value ?? "").trim().slice(0, 80);
      if (!name) { this.setStatus("Give the preset a name first."); return true; }
      await this.w.host.saveTokenFxPreset(name, layersOf(this.draft, this.preset()));
      this.library = "tokenshade-custom"; this.draft = studioStage(this.library, name);
      this.w.message = `Saved “${name}” to My presets. Pick it in any token filter stage, or use Add to animation.`;
      this.w.render(); return true;
    }
    if (action === "fx-preset-delete") {
      const name = this.draft.fxPreset;
      if (!(await this.w.host.confirm?.(`Delete the preset “${name}” for every recipe in this world? Recipes that used it keep its effect only if they were edited.`))) return true;
      await this.w.host.deleteTokenFxPreset(name);
      this.draft = null; this.w.message = `Deleted “${name}” from My presets.`;
      this.w.render(); return true;
    }
    if (["fx-layers-reset", "fx-layer-remove", "fx-layer-move"].includes(action)) { tokenFxAction(action, this.draft, this.preset(), b.dataset); this.w.render(); return true; }
    return false;
  }
}
