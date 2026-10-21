import { uuid } from "../core/uuid.mjs";
// The Flash screens page: a library of combat title cards and an editor with a
// live 16:9 stage (drag layers to place them), a scrub bar, a layer timeline and
// an inspector for the selected layer.
import { soundEnd, FLASH_BACKGROUNDS, MOMENT_EVENTS, flashOn, toggleFlashOn, validateFlashes, PORTRAIT_SIDES, PORTRAIT_SHAPES, FLASH_EVENTS, FLASH_MOTIONS, FLASH_KINDS, FLASH_LOOPS, LAYER_LIMIT, FLASH_LIMIT, KEY_LIMIT, validateFlash, validateLayer, keyValueAt, MOMENT_KINDS, FLASH_BLENDS, PARTICLE_TYPES, PARTICLE_DIRECTIONS, SCENE_LOOKS, STARTER_FLASHES } from "../engines/flash/flash-model.mjs";
import { createFlash } from "../engines/flash/flash-render.mjs";
import { runFlashTour, FLASH_TOURS } from "./flash-tour.mjs";

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const options = (choices, value) => Object.entries(choices).map(([k, v]) => `<option value="${esc(k)}" ${k === value ? "selected" : ""}>${esc(v)}</option>`).join("");
const clone = (v) => JSON.parse(JSON.stringify(v));
const newId = () => uuid().slice(0, 12);
const seconds = (ms) => `${(ms / 1000).toFixed(1)}s`;
// A small sign for each kind of layer (timeline rows and the add menu).
export const KIND_ICONS = { text: "T", image: "▣", portraits: "☺", band: "▬", lines: "✺", burst: "☀", slash: "⟋", particles: "❄", sound: "♪", flash: "⚡", shake: "≋", punch: "⊕" };
// Words in a text layer that fill themselves in when the screen plays.
export const FLASH_VARS = [
  ["{scene}", "The scene's name", "Every screen"],
  ["{round}", "The combat round number", "Combat screens"],
  ["{boss}", "The strongest enemy in the encounter (highest level)", "Combat screens"],
  ["{name}", "Who it is about: who crit, who fell, or who is using the action", "During combat and before an animation"],
  ["{action}", "The attack, spell or ability being used", "Before an animation"],
  ["{party}", "The party's name (PF2e's Party, D&D 5e's primary party)", "Every screen"],
  ["{manual}", "A name the GM types as the screen plays", "Every screen"],
  ["{manual:Enemy side}", "The same, asking with your own label; use several for several names", "Every screen"],
];
const EFFECTS = { lines: "Manga speed lines rushing to a point", burst: "Rays of light bursting from behind", slash: "A bright streak that cuts across", particles: "Embers, sparks, snow, ash, petals or blood", punch: "The whole card zooms in hard, then back" };

export class FlashEditor {
  constructor(w) {
    this.w = w; this.host = w.host; this.selectedId = null; this.draft = null; this.dirty = false; this.layerIndex = 0; this.time = 0; this.preview = null;
    // Shortcuts work while you are working in the editor (your last click was inside it), and are
    // caught before Foundry so arrows and Delete never pan the map or delete tokens.
    const signal = w.abort?.signal;
    if (typeof window === "undefined") return;
    window.addEventListener("pointerdown", (e) => { this.engaged = w.page === "flash" && !!w.root?.contains(e.target); }, { capture: true, signal });
    window.addEventListener("keydown", (e) => { if (this.engaged && w.page === "flash" && w.root?.isConnected && this.key(e)) e.stopPropagation(); }, { capture: true, signal });
  }
  screens() { return this.host.flashScreens(); }
  current() {
    if (!this.draft || this.draft.id !== this.selectedId) {
      const saved = this.screens().find((s) => s.id === this.selectedId) ?? this.screens()[0];
      this.selectedId = saved?.id ?? null;
      this.draft = saved ? clone(saved) : null;
      this.dirty = false; this.layerIndex = 0; this.time = saved ? Math.round(saved.duration * 0.55) : 0; this.undoStack = []; this.redoStack = [];
    }
    return this.draft;
  }
  // A moment when this layer is fully on screen, so editing it shows it.
  restTime(screen, i) {
    const l = screen.layers[i];
    if (!l) return Math.round(screen.duration * 0.4);
    const end = l.duration > 0 ? l.start + l.duration : screen.duration;
    return Math.round(Math.min(end - l.exitMs - 1, l.start + l.enterMs + 150));
  }
  // Every change first records the screen as it was (quick successive edits, like typing, share one step).
  // A sound layer's bar is as long as its file: read each new file's length once, then redraw.
  measureSounds() {
    const s = this.draft;
    if (!s?.layers || typeof globalThis.Audio !== "function") return;
    this.measuring ??= new Set();
    for (const l of s.layers) {
      if (l.kind !== "sound" || !l.file || (l.soundSrc === l.file && l.soundMs > 0) || this.measuring.has(l.file)) continue;
      const file = l.file, audio = new globalThis.Audio();
      this.measuring.add(file);
      audio.preload = "metadata";
      audio.addEventListener("loadedmetadata", () => {
        this.measuring.delete(file);
        const ms = Math.round(audio.duration * 1000);
        if (!Number.isFinite(ms) || ms <= 0) return;
        for (const x of this.draft?.layers ?? []) if (x.kind === "sound" && x.file === file) { x.soundMs = ms; x.soundSrc = file; }
        this.w.render();
      }, { once: true });
      audio.addEventListener("error", () => this.measuring.delete(file), { once: true });
      audio.src = this.host.resolveFlashMedia?.(file) ?? file;
    }
  }
  edit() {
    const snap = JSON.stringify(this.draft), now = Date.now();
    this.undoStack ??= []; this.redoStack ??= [];
    if (snap !== this.undoStack.at(-1) && now - (this.lastEditAt ?? 0) > 600) { this.undoStack.push(snap); if (this.undoStack.length > 60) this.undoStack.shift(); this.redoStack = []; }
    this.lastEditAt = now;
    this.dirty = true;
    return this.draft;
  }
  history(dir) {
    const from = dir === "undo" ? this.undoStack : this.redoStack, to = dir === "undo" ? this.redoStack : this.undoStack;
    if (!from?.length) return false;
    to.push(JSON.stringify(this.draft));
    this.draft = JSON.parse(from.pop());
    this.dirty = true; this.lastEditAt = 0;
    this.layerIndex = Math.min(this.layerIndex, Math.max(0, this.draft.layers.length - 1));
    return true;
  }
  // Editor shortcuts (outside text fields): undo/redo, nudge, rotate, resize, keyframe, play,
  // step, next layer, duplicate, delete, and ? for the list.
  key(e) {
    if (!this.editing || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName ?? "") || e.target?.isContentEditable) return false;
    const s = this.current();
    if (!s) return false;
    const k = e.key, mod = e.ctrlKey || e.metaKey, layer = s.layers[this.layerIndex], visual = layer && !MOMENT_KINDS.includes(layer.kind);
    const done = (render = true) => { e.preventDefault(); if (render) this.w.render(); return true; };
    if (mod) {
      const low = k.toLowerCase(), dir = low === "z" ? (e.shiftKey ? "redo" : "undo") : low === "y" ? "redo" : null;
      if (dir) { this.history(dir); return done(); }
      if (low === "d" && layer && s.layers.length < LAYER_LIMIT) { void this.action("flash-layer-copy", { dataset: { index: String(this.layerIndex) } }); e.preventDefault(); return true; }
      return false;
    }
    const step = e.shiftKey ? 5 : 0.5, round = (v) => Math.round(v * 10) / 10;
    switch (k) {
      case "ArrowLeft": case "ArrowRight": case "ArrowUp": case "ArrowDown": {
        if (!visual) return false;
        const t = this.target(this.edit().layers[this.layerIndex]);
        if (k === "ArrowLeft") t.x = round(Math.max(-20, t.x - step)); if (k === "ArrowRight") t.x = round(Math.min(120, t.x + step));
        if (k === "ArrowUp") t.y = round(Math.max(-20, t.y - step)); if (k === "ArrowDown") t.y = round(Math.min(120, t.y + step));
        this.mount(); this.later(); return done(false);
      }
      case "[": case "]": {
        if (!visual) return false;
        const t = this.target(this.edit().layers[this.layerIndex]), d = (k === "]" ? 1 : -1) * (e.shiftKey ? 15 : 5);
        t.rotate = Math.max(t === layer ? -180 : -720, Math.min(t === layer ? 180 : 720, t.rotate + d));
        this.mount(); this.later(); return done(false);
      }
      case "-": case "_": case "=": case "+":
        if (!visual) return false;
        this.grow(this.edit().layers[this.layerIndex], k === "-" || k === "_" ? 1 / 1.08 : 1.08); this.mount(); this.later(); return done(false);
      case "k": case "K":
        if (!visual) return false;
        this.keyForEdit(this.edit().layers[this.layerIndex]); return done();
      case " ": void this.togglePlay(); return done(false);
      case ",": case "<": case ".": case ">": this.setTime(this.time + (k === "," || k === "<" ? -1 : 1) * (e.shiftKey ? 1000 : 100)); return done(false);
      case "Home": this.setTime(0); return done(false);
      case "End": this.setTime(s.duration); return done(false);
      case "Tab":
        if (!s.layers.length) return false;
        this.layerIndex = (this.layerIndex + (e.shiftKey ? s.layers.length - 1 : 1)) % s.layers.length; return done();
      case "Delete": case "Backspace":
        if (!layer) return false;
        this.edit().layers.splice(this.layerIndex, 1); this.layerIndex = Math.max(0, Math.min(this.layerIndex, s.layers.length - 1)); return done();
      case "?": this.showHelp = !this.showHelp; return done();
      default: return false;
    }
  }
  // What a gesture changes: the layer itself, or (once it has keyframes) its keyframe at the playhead.
  target(layer) { return layer.keys?.length ? this.keyForEdit(layer) ?? layer : layer; }
  // Grow or shrink: keyframed layers scale; others change their own size (text size, image width, band both ways).
  grow(layer, f) {
    const r = (v, lo, hi) => Math.round(Math.min(hi, Math.max(lo, v)) * 10) / 10;
    if (layer.keys?.length) { const k = this.keyForEdit(layer); if (k) k.scale = Math.round(Math.min(10, Math.max(0.05, k.scale * f)) * 100) / 100; return; }
    if (layer.kind === "text") layer.size = r(layer.size * f, 1, 40);
    else if (layer.kind === "portraits") layer.size = r(layer.size * f, 3, 60);
    else if (layer.kind === "image") layer.width = r(layer.width * f, 1, 150);
    else if (["lines", "burst", "slash"].includes(layer.kind)) layer.width = r(layer.width * f, layer.kind === "slash" ? 10 : 20, 300);
    else if (layer.kind === "particles") layer.size = r(layer.size * f, 0.3, 3);
    else if (layer.kind === "band") { layer.width = r(layer.width * f, 1, 150); layer.height = r(layer.height * f, 1, 100); }
  }
  // A timeline bar: its entrance and exit shaded at the ends, with grips to drag the start, end,
  // entrance and exit; the body moves the whole layer in time.
  barHTML(l, total) {
    const pct = (ms) => ((ms / total) * 100).toFixed(2);
    const end = l.kind === "sound" ? soundEnd(l, total) : l.duration > 0 ? Math.min(total, l.start + l.duration) : total, len = Math.max(1, end - l.start);
    const share = (ms) => ((Math.min(ms, len) / len) * 100).toFixed(1);
    const visual = !MOMENT_KINDS.includes(l.kind);
    const segs = visual ? `<span class="an-flash-seg is-enter" style="width:${share(l.enterMs)}%"></span><span class="an-flash-seg is-exit" style="width:${share(l.exitMs)}%"></span><span class="an-flash-grip is-mid" data-flash-part="enter" style="left:${share(l.enterMs)}%" title="Drag: entrance length"></span><span class="an-flash-grip is-mid" data-flash-part="exit" style="left:${(100 - share(l.exitMs)).toFixed(1)}%" title="Drag: exit length"></span>` : "";
    const edges = `${["flash", "shake", "punch", "sound"].includes(l.kind) ? "" : `<span class="an-flash-grip is-start is-visible" data-flash-part="start" title="Drag: when it starts"></span>`}<span class="an-flash-grip is-end is-visible" data-flash-part="end" title="Drag: when it ends"></span>`;
    // Named and timed like a recipe bar, so a glance at the timeline says what plays when.
    const at = (ms) => `${(ms / 1000).toFixed(2)}s`;
    const label = `<span class="an-flash-bar-label">${esc(l.name || FLASH_KINDS[l.kind])}</span><span class="an-flash-bar-when">${at(l.start)} – ${at(end)}</span>`;
    return `<span class="an-flash-row-bar kind-${l.kind}" data-flash-part="move" style="left:${pct(l.start)}%;width:${pct(len)}%" title="Drag to move in time">${segs}${label}${edges}</span>`;
  }
  trackHTML(l, i, total) {
    const pct = (ms) => ((ms / total) * 100).toFixed(2);
    // A faint gridline every half second, as across the recipe timeline's rows.
    return `<div class="an-flash-lane" style="width:${(this.tlZoom ?? 1) * 100}%;--an-grid:${pct(500)}%">${this.barHTML(l, total)}${(l.keys ?? []).map((k) => `<button class="an-flash-key${i === this.layerIndex && Math.abs(k.at - this.time) <= 40 ? " is-on" : ""}" style="left:${pct(k.at)}%" data-action="flash-key-go" data-index="${i}" data-at="${k.at}" aria-label="Keyframe at ${seconds(k.at)}" title="Click to go there; drag to retime"></button>`).join("")}<span class="an-flash-row-head" style="left:${pct(this.time)}%"></span></div>`;
  }
  // The seconds ruler above the rows (click or drag it to move the playhead), finer as you zoom in.
  rulerHTML(total) {
    // Labelled every half second with fine ticks between, like the recipe timeline's ruler.
    const z = this.tlZoom ?? 1, step = z < 4 ? 100 : 50, label = z < 2 ? 500 : z < 4 ? 250 : 100;
    const ticks = [];
    for (let t = 0; t <= total; t += step) ticks.push(`<span class="an-flash-tick${t % label === 0 ? " is-major" : ""}" style="left:${((t / total) * 100).toFixed(3)}%">${t % label === 0 ? `<b>${(t / 1000).toFixed(label < 1000 ? 2 : 0).replace(/\.?0+$/, "") || "0"}s</b>` : ""}</span>`);
    return `<div class="an-flash-lane" style="width:${z * 100}%">${ticks.join("")}<span class="an-flash-row-head" style="left:${((this.time / total) * 100).toFixed(2)}%"></span><span class="an-flash-length-grip" data-flash-length data-tooltip="The screen ends here (${seconds(total)}): drag to make it longer or shorter"></span></div>`;
  }
  // Every row's track, the ruler and the scrollbar share one horizontal scroll.
  syncScroll(px = this.tlScroll ?? 0) {
    const root = this.w.root, bar = root.querySelector("[data-flash-tl-scroll]");
    const max = bar ? bar.scrollWidth - bar.clientWidth : 0;
    this.tlScroll = Math.max(0, Math.min(max, px));
    for (const el of root.querySelectorAll(".an-flash-row-track, [data-flash-tl-scroll]")) el.scrollLeft = this.tlScroll;
  }
  // Zoom the timeline, keeping the moment under the pointer (or the view's centre) in place.
  zoomTimeline(next, anchorX) {
    const track = this.w.root.querySelector(".an-flash-row-track:not(.an-flash-ruler)") ?? this.w.root.querySelector(".an-flash-ruler");
    const z0 = this.tlZoom ?? 1, z = Math.max(1, Math.min(16, next));
    if (!track || z === z0) { this.tlZoom = z; return this.w.render(); }
    const rect = track.getBoundingClientRect(), x = (anchorX ?? rect.left + rect.width / 2) - rect.left;
    const frac = ((this.tlScroll ?? 0) + x) / (rect.width * z0);
    this.tlZoom = z;
    this.w.render();
    this.syncScroll(frac * rect.width * z - x);
  }
  // The clock, slider and every row's playhead line, without moving the editing time.
  showTime(ms) {
    const s = this.current(), root = this.w.root;
    const clock = root.querySelector("[data-flash-clock]"), range = root.querySelector("[data-flash-time]");
    if (clock) clock.textContent = `${seconds(ms)} / ${seconds(s.duration)}`;
    if (range) range.value = Math.round(ms);
    for (const head of root.querySelectorAll(".an-flash-row-head")) head.style.left = `${((ms / s.duration) * 100).toFixed(2)}%`;
  }
  // The inspector catches up after wheel and key tweaks, without redrawing on every notch.
  later() { clearTimeout(this.laterTimer); this.laterTimer = setTimeout(() => this.w.render(), 250); }
  // Space: play the preview from the start, or stop it.
  async togglePlay() {
    const s = this.current(), frame = this.w.root.querySelector("[data-flash-stage]");
    if (!s || !frame) return;
    if (this.playing) { this.playing = false; this.mount(); return; }
    this.preview?.stop();
    frame.replaceChildren();
    const run = createFlash(frame, validateFlash(s), { resolveMedia: (src) => this.host.resolveFlashMedia(src), vars: this.host.flashVars(), editing: true, skip: this.skipped(), playSound: (src, volume, ms) => this.host.flashPlaySound(src, volume, ms) });
    this.preview = run; this.playing = true;
    this.host.flashSound(s);
    const finished = run.play();
    // The slider, clock and playhead lines follow the preview, then return to where you were editing.
    const follow = () => { if (!this.playing || this.preview !== run) return; this.showTime(run.time()); requestAnimationFrame(follow); };
    requestAnimationFrame(follow);
    await finished;
    if (this.preview === run) { this.playing = false; this.mount(); }
    this.showTime(this.time);
  }
  // The selected layer's keyframe at the playhead (within a frame or two), if any.
  keyAtPlayhead(layer = this.draft?.layers[this.layerIndex]) { return layer?.keys?.find((k) => Math.abs(k.at - this.time) <= 40) ?? null; }
  // Dragging a keyframed layer edits (or adds) the keyframe at the playhead.
  keyForEdit(layer) {
    let key = this.keyAtPlayhead(layer);
    if (!key && layer.keys?.length < KEY_LIMIT) { key = { ...keyValueAt(layer, this.time), at: this.time }; layer.keys.push(key); layer.keys.sort((a, b) => a.at - b.at); }
    return key;
  }

  // The library: every screen as a card with a small preview, grouped by when it plays (like the recipes page).
  libraryHTML() {
    const list = this.screens(), defaults = this.host.flashDefaults();
    if (this.showGallery) return `<section class="an-flash-page is-library">${this.galleryHTML()}</section>`;
    const group = (f) => (f.event === "initiated" ? "initiated" : f.event === "start" || f.event === "any" ? "start" : f.event === "end" ? "end" : f.event === "action" ? "action" : "moment");
    const card = (f, sectionKey) => {
      const detail = f.event === "any" ? "Start or end" : FLASH_EVENTS[f.event];
      // Every combat card has an On/Off switch. Start and end: On is the world default (one at a time; the
      // tracker can pick another per combat). Combat initiated: several may be on, the GM picks. Moments: one each.
      const ev = sectionKey === "start" || sectionKey === "end" ? sectionKey : f.event, evName = FLASH_EVENTS[ev]?.toLowerCase() ?? "";
      const switchable = ["moment", "initiated", "start", "end"].includes(sectionKey), on = switchable && flashOn(defaults, ev, f.id), unsaved = f.id === this.selectedId && this.dirty;
      const open = `<button class="an-flash-tile-open" data-action="flash-select" data-id="${esc(f.id)}" aria-label="Edit ${esc(f.name)}"><span class="an-flash-tpl-thumb" data-flash-thumb="mine:${esc(f.id)}"></span><span class="an-flash-tile-text"><span class="an-flash-card-name">${esc(f.name)}${unsaved ? ` <span class="an-flash-unsaved" title="Unsaved changes">•</span>` : ""}</span><small>${esc(detail)}</small></span></button>`;
      const tip = on ? (sectionKey === "start" || sectionKey === "end" ? `Plays on every ${esc(evName)} unless the Combat Tracker picks another: click to turn off` : `Plays on every ${esc(evName)}: click to turn off`) : `Off: click to play it on every ${esc(evName)}`;
      const toggle = switchable ? `<button class="an-flash-switch${on ? " is-on" : ""}" data-action="flash-moment-toggle" data-id="${esc(f.id)}" data-event="${esc(ev)}" role="switch" aria-checked="${on}" data-tooltip="${tip}"><span></span>${on ? "On" : "Off"}</button>` : "";
      return `<div class="an-flash-tile is-${group(f)}">${open}${toggle}</div>`;
    };
    const section = (key, title, hint) => { const items = list.filter((x) => group(x) === key); return items.length ? `<div class="an-flash-libgroup"><div class="an-flash-libgroup-head"><span class="an-flash-sub">${title}</span><small>${hint}</small></div><div class="an-flash-tiles">${items.map((x) => card(x, key)).join("")}</div></div>` : ""; };
    return `<section class="an-flash-page is-library">${list.length
      ? section("initiated", "Combat initiated", "Plays once when combatants are added, before Begin Combat. With more than one on, you pick which plays.") + section("start", "Combat start", "Switch on the default. With more than one on, you pick which plays at Begin Combat; the Combat Tracker can still pick one per combat.") + section("moment", "During combat", "Switch on the ones that should play.") + section("end", "Combat end", "Switch on the default; the Combat Tracker can pick another per combat.") + section("action", "Before an animation", "Attach one to a recipe in its settings.")
      : `<div class="an-preview-empty">No flash screens yet. Make one with <b>+ New flash screen</b>.</div>`}</section>`;
  }

  html() {
    if (!this.editing) return this.libraryHTML();
    const s = this.current(), defaults = this.host.flashDefaults();
    if (!s) { this.editing = false; return this.libraryHTML(); }
    const pageClass = "an-flash-page is-editor";
    const layer = s.layers[this.layerIndex];
    const isDefault = (ev) => flashOn(defaults, ev, s.id);
    // One row: back, name, when it plays, and the actions.
    const head = `<div class="an-flash-head"><div class="an-flash-head-row"><button class="an-icon an-flash-back" data-action="flash-back" data-tooltip="Back to all flash screens" aria-label="Back to all flash screens">←</button><input class="an-st-name" aria-label="Flash screen name" data-flash-field="name" value="${esc(s.name)}"><label class="an-flash-inline">Plays at<select data-flash-field="event">${options(FLASH_EVENTS, s.event)}</select></label><div class="an-flash-actions"><button class="an-icon" data-action="flash-undo" ${this.undoStack?.length ? "" : "disabled"} data-tooltip="Undo (Ctrl+Z)" aria-label="Undo">↶</button><button class="an-icon" data-action="flash-redo" ${this.redoStack?.length ? "" : "disabled"} data-tooltip="Redo (Ctrl+Shift+Z)" aria-label="Redo">↷</button><button class="an-icon" data-action="flash-duplicate" data-tooltip="Duplicate" aria-label="Duplicate">⧉</button><button class="an-icon is-danger" data-action="flash-delete" data-tooltip="Delete" aria-label="Delete"><i class="fas fa-trash" aria-hidden="true"></i></button><button class="an-icon" data-action="flash-revert" ${this.dirty ? "" : "disabled"} data-tooltip="Revert to the saved version" aria-label="Revert">↺</button><button class="an-primary" data-action="flash-save" ${this.dirty ? "" : "disabled"}>${this.dirty ? "Save" : "Saved ✓"}</button></div></div></div>`;
    const help = this.showHelp ? `<div class="an-flash-help"><b>Shortcuts</b><span><kbd>Drag</kbd> move · corner handle: size · round handle: rotate · band edges: stretch</span><span><kbd>Wheel</kbd> opacity · <kbd>Shift</kbd>+wheel: size</span><span><kbd>←↑→↓</kbd> nudge (<kbd>Shift</kbd> ×10) · <kbd>[</kbd> <kbd>]</kbd> rotate · <kbd>-</kbd> <kbd>=</kbd> smaller / bigger</span><span><kbd>K</kbd> keyframe · <kbd>Space</kbd> play · <kbd>,</kbd> <kbd>.</kbd> step (<kbd>Shift</kbd> 1s) · <kbd>Home</kbd> <kbd>End</kbd></span><span><kbd>Tab</kbd> next layer · <kbd>Ctrl+D</kbd> duplicate · <kbd>Delete</kbd> remove · <kbd>Ctrl+Z</kbd> undo</span><span>Drag any field's label to change its value (<kbd>Shift</kbd> faster, <kbd>Alt</kbd> finer). On the timeline, drag bars, their ends and the shaded entrance/exit; drag ◆ to retime. <kbd>Alt</kbd> turns snapping off.</span><b class="an-flash-help-vars">Words that fill themselves in</b><span>Type these into any text layer; they are replaced when the screen plays (in the editor, sample values show).</span><table class="an-flash-vars">${FLASH_VARS.map(([v, what, when]) => `<tr><td><code>${v}</code></td><td>${esc(what)}</td><td>${esc(when)}</td></tr>`).join("")}</table><span>Example: <code>{name} unleashes {action}!</code></span></div>` : "";
    const stage = `<div class="an-flash-tools">${this.quickHTML(layer)}<span class="an-flash-guides"><button class="an-flash-guide" data-action="flash-tours" aria-expanded="${!!this.showTours}" data-tooltip="Guided walkthroughs: watch how to build a flash screen, step by step">🎓 Show me ▾</button>${this.showTours ? `<span class="an-flash-tour-menu" role="menu">${Object.entries(FLASH_TOURS).map(([id, t]) => `<button role="menuitem" data-action="flash-tour" data-tour="${id}"><b>${esc(t.label)}</b><small>${esc(t.detail)}</small></button>`).join("")}</span>` : ""}</span><button class="an-icon${this.showHelp ? " is-on" : ""}" data-action="flash-help" data-tooltip="Shortcuts (?)" aria-label="Shortcuts">?</button></div>${help}<div class="an-flash-stage-wrap"><div class="an-flash-frame" data-flash-stage aria-label="Flash screen preview: drag a layer to move it"></div></div>
      <div class="an-flash-transport"><button class="an-primary" data-action="flash-preview">${this.playing ? "■ Stop" : "▶ Preview"}</button><button data-action="flash-play-all" data-tooltip="Play it now on every player's screen">Play for everyone</button><input type="range" min="0" max="${s.duration}" step="10" value="${this.time}" data-flash-time aria-label="Scrub"><span data-flash-clock>${seconds(this.time)} / ${seconds(s.duration)}</span></div>`;
    const pct = (ms) => ((ms / s.duration) * 100).toFixed(2);
    const rows = s.layers.map((l, i) => {
      const end = l.duration > 0 ? Math.min(s.duration, l.start + l.duration) : s.duration;
      return `<div class="an-flash-row ${i === this.layerIndex ? "is-selected" : ""}"><button class="an-flash-row-name" data-action="flash-layer" data-index="${i}" title="${esc(FLASH_KINDS[l.kind])}"><span class="an-flash-row-icon kind-${l.kind}" aria-hidden="true">${KIND_ICONS[l.kind]}</span>${esc(l.name || FLASH_KINDS[l.kind])}</button><span class="an-flash-row-ms">${MOMENT_KINDS.includes(l.kind) ? `<button class="is-eye" disabled aria-hidden="true" tabindex="-1"></button>` : `<button class="is-eye ${this.hidden?.has(l.id) ? "is-on" : ""}" data-action="flash-eye" data-index="${i}" aria-pressed="${!!this.hidden?.has(l.id)}" data-tooltip="${this.hidden?.has(l.id) ? "Hidden while you edit: click to show" : "Hide while you edit (it still plays in Preview)"}">${this.hidden?.has(l.id) ? "◌" : "👁"}</button>`}<button class="${this.muted?.has(l.id) ? "is-on" : ""}" data-action="flash-mute" data-index="${i}" aria-pressed="${!!this.muted?.has(l.id)}" data-tooltip="Mute: leave this layer out of the editor preview">M</button><button class="is-solo ${this.soloed?.has(l.id) ? "is-on" : ""}" data-action="flash-solo" data-index="${i}" aria-pressed="${!!this.soloed?.has(l.id)}" data-tooltip="Solo: preview only soloed layers">S</button></span><div class="an-flash-row-track" data-action="flash-layer" data-index="${i}">${this.trackHTML(l, i, s.duration)}</div><span class="an-flash-row-tools"><button data-action="flash-layer-up" data-index="${i}" aria-label="Bring forward" ${i === s.layers.length - 1 ? "disabled" : ""}>▲</button><button data-action="flash-layer-down" data-index="${i}" aria-label="Send back" ${i === 0 ? "disabled" : ""}>▼</button><button data-action="flash-layer-copy" data-index="${i}" aria-label="Duplicate layer" ${s.layers.length >= LAYER_LIMIT ? "disabled" : ""}>⧉</button><button data-action="flash-layer-remove" data-index="${i}" aria-label="Remove layer">×</button></span></div>`;
    }).reverse().join("");
    // Spacers sized like a row's name, M/S and tools keep the ruler and scrollbar in the track column.
    const spacers = (track) => `<span></span><span class="an-flash-row-ms is-spacer" aria-hidden="true"><button class="is-eye" tabindex="-1">👁</button><button tabindex="-1">M</button><button tabindex="-1">S</button></span>${track}<span class="an-flash-row-tools is-spacer" aria-hidden="true"><button tabindex="-1">▲</button><button tabindex="-1">▼</button><button tabindex="-1">⧉</button><button tabindex="-1">×</button></span>`;
    const ruler = s.layers.length ? `<div class="an-flash-row is-ruler">${spacers(`<div class="an-flash-row-track an-flash-ruler" data-flash-ruler title="Click or drag to move the playhead">${this.rulerHTML(s.duration)}</div>`)}</div>` : "";
    const scroller = s.layers.length && (this.tlZoom ?? 1) > 1 ? `<div class="an-flash-row is-scroll">${spacers(`<div class="an-flash-tl-scroll" data-flash-tl-scroll><div style="width:${(this.tlZoom ?? 1) * 100}%;height:1px"></div></div>`)}</div>` : "";
    const zoom = `<span class="an-flash-zoom"><button data-action="flash-zoom" data-zoom="out" ${(this.tlZoom ?? 1) <= 1 ? "disabled" : ""} data-tooltip="Zoom out (Ctrl+wheel)" aria-label="Zoom out">−</button><button data-action="flash-zoom" data-zoom="in" ${(this.tlZoom ?? 1) >= 16 ? "disabled" : ""} data-tooltip="Zoom in (Ctrl+wheel)" aria-label="Zoom in">+</button><button data-action="flash-zoom" data-zoom="fit" ${(this.tlZoom ?? 1) <= 1 ? "disabled" : ""} data-tooltip="Fit the whole screen" aria-label="Fit">Fit</button></span>`;
    const full = s.layers.length >= LAYER_LIMIT ? "disabled" : "";
    const layersHTML = `<div class="an-flash-layers"><div class="an-flash-layers-head"><b>Layers</b>${zoom}<span class="an-flash-adds"><button data-action="flash-add" data-kind="text" ${full}>+ Text</button><button data-action="flash-add" data-kind="image" ${full}>+ Image</button><button data-action="flash-add" data-kind="portraits" ${full} data-tooltip="The party's or enemies' pictures, from the encounter">+ Portraits</button><button data-action="flash-add" data-kind="band" ${full}>+ Band</button><button data-action="flash-add" data-kind="sound" ${full}>+ Sound</button><button data-action="flash-add" data-kind="flash" ${full} data-tooltip="A full-screen flash at one moment">+ Flash</button><button data-action="flash-add" data-kind="shake" ${full} data-tooltip="Shake the whole screen at one moment">+ Shake</button><span class="an-flash-effects"><button data-action="flash-effects" ${full} aria-expanded="${!!this.showEffects}" data-tooltip="Speed lines, light burst, slash, particles, camera punch">✦ Effects ▾</button>${this.showEffects ? `<span class="an-flash-effects-menu" role="menu">${Object.entries(EFFECTS).map(([k, tip]) => `<button role="menuitem" data-action="flash-add" data-kind="${k}"><span class="an-flash-row-icon kind-${k}">${KIND_ICONS[k]}</span><b>${esc(FLASH_KINDS[k])}</b><small>${esc(tip)}</small></button>`).join("")}</span>` : ""}</span></span></div>${ruler}${rows || `<p class="an-hint">Add a text, image or band layer.</p>`}${scroller}<p class="an-hint">M mutes and S solos a layer in this editor only; saved screens always play every layer. Top of the list draws on top. Drag a bar to move it in time, its ends to trim it, the shaded ends to set its entrance and exit, and ◆ to retime a keyframe. Drag the yellow end of the ruler to make the whole screen longer or shorter. Press ? for all shortcuts.</p></div>`;
    const scene = `<div class="an-editor-section an-flash-card-box"><span class="an-eyebrow">SCREEN</span><div class="an-field-row"><label>Backdrop<input type="color" data-flash-field="backdrop.color" value="${s.backdrop.color}"></label><label>Darkness<input type="number" min="0" max="1" step="0.05" data-flash-field="backdrop.opacity" value="${s.backdrop.opacity}"></label></div><label class="an-check"><input type="checkbox" data-flash-field="backdrop.vignette" ${s.backdrop.vignette ? "checked" : ""}> Dark edges</label><div class="an-field-row"><label class="an-check"><input type="checkbox" data-flash-field="backdrop.bars" ${s.backdrop.bars ? "checked" : ""}> Cinematic bars</label>${s.backdrop.bars ? `<label>Bar size<input type="number" min="2" max="25" step="1" data-flash-field="backdrop.barSize" value="${s.backdrop.barSize}"></label>` : ""}</div><label>Animated background<select data-flash-field="backdrop.media">${options(Object.hasOwn(FLASH_BACKGROUNDS, s.backdrop.media) ? FLASH_BACKGROUNDS : { ...FLASH_BACKGROUNDS, [s.backdrop.media]: "Custom file" }, s.backdrop.media)}</select></label><div class="an-field-row"><label>Or a file<span class="an-flash-sound"><input data-flash-field="backdrop.media" placeholder="JB2A key or video" value="${esc(s.backdrop.media)}"><button data-action="flash-browse" data-target="background" aria-label="Browse backgrounds">…</button></span></label>${s.backdrop.media ? `<label>Strength<input type="number" min="0" max="1" step="0.05" data-flash-field="backdrop.mediaOpacity" value="${s.backdrop.mediaOpacity}"></label>` : ""}</div><label>Game scene behind it<select data-flash-field="backdrop.freeze">${options(SCENE_LOOKS, s.backdrop.freeze)}</select></label>${s.backdrop.freeze !== "normal" ? `<p class="an-hint">The map stops moving and takes this look until the screen ends. Lower the Darkness to see it.</p>` : ""}<label class="an-check"><input type="checkbox" data-flash-field="duck" ${s.duck ? "checked" : ""}> Lower the music while it plays</label><label>Sound<span class="an-flash-sound"><input data-flash-field="sound.file" placeholder="sounds/drums.ogg" value="${esc(s.sound.file)}"><button data-action="flash-browse" data-target="sound" aria-label="Browse sounds">…</button></span></label><label>Volume<input type="number" min="0" max="1" step="0.05" data-flash-field="sound.volume" value="${s.sound.volume}"></label><div class="an-flash-defaults">${(s.event === "any" ? ["start", "end"] : [s.event]).map((ev) => `<button class="${isDefault(ev) ? "an-primary" : ""}" data-action="flash-default" data-event="${ev}">${isDefault(ev) ? "✓ " : ""}Use for: ${esc(FLASH_EVENTS[ev])}</button>`).join("")}</div><p class="an-hint">${s.event === "initiated" ? "Plays once when an encounter gets its combatants, before Begin Combat (time to roll initiative). Turn it on with the button above." : MOMENT_EVENTS.includes(s.event) ? "Plays during combat whenever this happens. Turn it on with the button above." : "The default plays for every combat unless the Combat Tracker picks another."} Text can use {scene}, {round}, {boss} (strongest enemy), {name} (who crit, fell or acted), {action}, {party} and {manual} (the GM types it as the screen plays).</p></div>`;
    // Inspector tabs: the selected layer, or the screen as a whole.
    const tab = this.tab === "screen" || !layer ? "screen" : "layer";
    const tabs = `<div class="an-flash-tabs" role="tablist"><button role="tab" data-action="flash-tab" data-tab="layer" aria-selected="${tab === "layer"}" class="${tab === "layer" ? "is-on" : ""}" ${layer ? "" : "disabled"}>${layer ? `<span class="an-flash-row-icon kind-${layer.kind}" aria-hidden="true">${KIND_ICONS[layer.kind]}</span>` : ""}Layer</button><button role="tab" data-action="flash-tab" data-tab="screen" aria-selected="${tab === "screen"}" class="${tab === "screen" ? "is-on" : ""}">Screen</button></div>`;
    // Drag the bar under the play controls to trade stage size for taller tracks, as in the recipe studio.
    const split = `<div class="an-st-hsplit an-flash-hsplit" data-flash-hsplit role="separator" aria-orientation="horizontal" aria-label="Resize the stage and the layers" tabindex="0" data-tooltip="Drag to make the stage smaller and the layers taller · double-click to reset"></div>`;
    const height = this.stageHeight(), main = height ? `<div class="an-flash-main has-stage-height" style="--an-flash-stage-height:${height}px">` : `<div class="an-flash-main">`;
    return `<section class="${pageClass}">${main}${head}${stage}${split}${layersHTML}</div><aside class="an-flash-inspector">${tabs}${tab === "layer" ? this.layerHTML(layer) : scene}</aside></section>`;
  }
  // The toolbar over the stage: the most used actions for the selected kind of layer.
  quickTools(l) {
    if (!l) return [];
    const grow = [["grow:0.9", "−", "Smaller (-)"], ["grow:1.1", "+", "Bigger (=)"]];
    const place = [["align:x:50", "↔", "Centre across"], ["align:y:50", "↕", "Centre up and down"], ["key", "◆", "Keyframe at the playhead (K)", !!this.keyAtPlayhead(l)]];
    const cycle = (key, choices, tip, short = choices) => [`cycle:${key}`, `${short[l[key]] ?? choices[l[key]]} ▸`, tip];
    const moment = (step, unit) => [[["here", "⇥ Here", "Move it to the playhead"]], [[`add:strength:${-step}`, "−", `Weaker${unit}`], [`add:strength:${step}`, "+", `Stronger${unit}`]]];
    switch (l.kind) {
      case "text": return [[["toggle:bold", "B", "Bold", l.bold], ["toggle:italic", "I", "Italic", l.italic], ["toggle:gradient", "▤", "Gradient fill", l.gradient]], [["grow:0.9", "A−", "Smaller text (-)"], ["grow:1.1", "A+", "Bigger text (=)"]], [cycle("enter", FLASH_MOTIONS, "Entrance: click for the next")], place];
      case "image": return [[["browse", "…", "Choose an image or video"]], grow, [cycle("blend", FLASH_BLENDS, "Blend: Screen or Add hides black backgrounds")], place];
      case "portraits": return [[cycle("side", PORTRAIT_SIDES, "Who to show: click for the next", { actor: "Actor", party: "Party", enemies: "Enemies", boss: "Boss", all: "Everyone" }), cycle("shape", PORTRAIT_SHAPES, "Frame: click for the next"), ["toggle:names", "Aa", "Show names", l.names]], grow, place];
      case "band": return [grow, [["add:skew:-5", "⟍", "Less slant"], ["add:skew:5", "⟋", "More slant"]], place];
      case "lines": return [grow, [["add:density:-6", "− lines", "Fewer lines"], ["add:density:6", "+ lines", "More lines"]], place];
      case "burst": return [grow, [["add:density:-3", "− rays", "Fewer rays"], ["add:density:3", "+ rays", "More rays"]], place];
      case "slash": return [grow, [["add:rotate:-15", "⟲", "Turn left 15°"], ["add:rotate:15", "⟳", "Turn right 15°"]], place];
      case "particles": return [[cycle("ptype", PARTICLE_TYPES, "Particles: click for the next"), cycle("direction", PARTICLE_DIRECTIONS, "Direction: click for the next")], [["add:count:-15", "Fewer", "Fewer particles"], ["add:count:15", "More", "More particles"]], [["add:speed:-0.2", "Slower", "Slower"], ["add:speed:0.2", "Faster", "Faster"]]];
      case "sound": return [[["here", "⇥ Here", "Play it at the playhead"], ["hear", "▶ Hear", "Listen to it"], ["browse", "…", "Choose a sound"]]];
      case "flash": return moment(0.1, " (brightness)");
      case "shake": return moment(0.3, "");
      case "punch": return moment(0.03, " (zoom)");
      default: return [place];
    }
  }
  quickHTML(l) {
    const groups = this.quickTools(l);
    if (!groups.length) return `<span class="an-flash-quick is-empty">Select a layer for its quick tools</span>`;
    return `<span class="an-flash-quick"><span class="an-flash-row-icon kind-${l.kind}" aria-hidden="true">${KIND_ICONS[l.kind]}</span>${groups.map((g) => g.map(([op, label, tip, on]) => `<button data-action="flash-quick" data-op="${op}" class="${on ? "is-on" : ""}" ${on === undefined ? "" : `aria-pressed="${!!on}"`} data-tooltip="${esc(tip)}">${esc(label)}</button>`).join("")).join("<i></i>")}</span>`;
  }
  // + New: start from a blank screen or a copy of a ready-made one (thumbnails drawn by mount).
  galleryHTML() {
    const card = (id, name, detail) => `<button class="an-flash-tpl" data-action="flash-new-from" data-id="${esc(id)}"><span class="an-flash-tpl-thumb" data-flash-thumb="tpl:${esc(id)}">${id === "blank" ? "<b>+</b>" : ""}</span><b>${esc(name)}</b><small>${esc(detail)}</small></button>`;
    return `<div class="an-flash-gallery"><div class="an-flash-gallery-head"><div><span class="an-eyebrow">NEW FLASH SCREEN</span><h2>Start from…</h2></div><button data-action="flash-gallery-close">Cancel</button></div><div class="an-flash-gallery-grid">${card("blank", "Blank", "One title, nothing else")}${STARTER_FLASHES.map((t) => card(t.id, t.name, FLASH_EVENTS[t.event])).join("")}</div><p class="an-hint">You get your own copy to change; the ready-made screens stay as they are.</p></div>`;
  }
  layerHTML(l) {
    const f = (key, label, value, attrs = "") => `<label>${label}<input data-flash-layer-field="${key}" value="${esc(value)}" ${attrs}></label>`;
    const n = (key, label, value, min, max, step) => f(key, label, value, `type="number" min="${min}" max="${max}" step="${step}"`);
    const c = (key, label, value) => `<label>${label}<input type="color" data-flash-layer-field="${key}" value="${value}"></label>`;
    const sel = (key, label, choices, value) => `<label>${label}<select data-flash-layer-field="${key}">${options(choices, value)}</select></label>`;
    const fonts = Object.fromEntries(this.host.flashFonts().map((name) => [name, name]));
    const kind = l.kind === "text"
      ? `<label>Text<textarea rows="2" data-flash-layer-field="text">${esc(l.text)}</textarea></label><div class="an-flash-varchips"><span>Insert:</span>${FLASH_VARS.map(([v, what]) => `<button data-action="flash-insert-var" data-var="${v}" data-tooltip="${esc(what)}">${v}</button>`).join("")}</div>${sel("font", "Font", fonts, l.font)}<div class="an-field-row">${n("size", "Size", l.size, 1, 40, 0.5)}${n("spacing", "Spacing", l.spacing, -0.1, 1, 0.01)}</div><div class="an-field-row">${c("color", "Color", l.color)}${c("outline", "Outline", l.outline)}${c("glow", "Glow", l.glow)}</div>${n("glowSize", "Glow size", l.glowSize, 0, 10, 0.5)}<div class="an-field-row"><label class="an-check"><input type="checkbox" data-flash-layer-field="bold" ${l.bold ? "checked" : ""}> Bold</label><label class="an-check"><input type="checkbox" data-flash-layer-field="italic" ${l.italic ? "checked" : ""}> Italic</label></div><div class="an-field-row"><label class="an-check"><input type="checkbox" data-flash-layer-field="gradient" ${l.gradient ? "checked" : ""}> Gradient to</label>${l.gradient ? c("gradientTo", "Bottom color", l.gradientTo) : ""}</div><div class="an-field-row">${n("letters", "Letters one by one (ms apart)", l.letters, 0, 400, 10)}${n("words", "Words one by one (ms apart)", l.words, 0, 1500, 10)}</div><p class="an-hint">0 = all at once. Letters win if both are set. Enters "Outline, then fill" draws the outline before the colour pours in.</p>`
      : l.kind === "lines"
      ? `<div class="an-field-row">${c("color", "Color", l.color)}${n("density", "Lines", l.density, 6, 90, 1)}</div><div class="an-field-row">${n("clear", "Clear middle %", l.clear, 0, 80, 1)}${n("width", "Size % of screen", l.width, 20, 300, 5)}</div><p class="an-hint">Put the middle where the eye should go (drag it on the stage). They flicker while shown.</p>`
      : l.kind === "burst"
      ? `<div class="an-field-row">${c("color", "Color", l.color)}${n("density", "Rays", l.density, 6, 60, 1)}${n("width", "Size %", l.width, 20, 300, 5)}</div><p class="an-hint">Turns slowly while shown. Put it behind a title or a portrait (lower in the layer list).</p>`
      : l.kind === "slash"
      ? `<div class="an-field-row">${c("color", "Color", l.color)}${n("width", "Length %", l.width, 10, 300, 5)}${n("height", "Thickness", l.height, 0.3, 30, 0.1)}</div><p class="an-hint">Cuts across at its start, then thins away. Turn it with Rotate or the round handle.</p>`
      : l.kind === "particles"
      ? `<div class="an-field-row">${sel("ptype", "Particles", PARTICLE_TYPES, l.ptype)}${sel("direction", "Moving", PARTICLE_DIRECTIONS, l.direction)}</div><div class="an-field-row">${n("count", "Amount", l.count, 5, 150, 1)}${n("speed", "Speed", l.speed, 0.3, 3, 0.1)}${n("size", "Size", l.size, 0.3, 3, 0.1)}</div>${c("color", "Color", l.color)}<p class="an-hint">They fill the whole screen while the layer is shown.</p>`
      : MOMENT_KINDS.includes(l.kind)
      ? l.kind !== "sound" ? "" : `<label>Sound file<span class="an-flash-sound"><input data-flash-layer-field="file" placeholder="sounds/drums.ogg" value="${esc(l.file)}"><button data-action="flash-browse" data-target="layer-sound" aria-label="Browse sounds">…</button></span></label>${n("volume", "Volume", l.volume, 0, 1, 0.05)}${n("start", "Plays at (ms)", l.start, 0, 12000, 50)}<p class="an-hint">Plays once from that moment; its bar is as long as the file. Drag the bar's end to cut it shorter. Add more sound layers for more cues.</p>`
      : l.kind === "portraits"
      ? `${sel("side", "Show", PORTRAIT_SIDES, l.side)}<div class="an-field-row">${sel("art", "Picture", { token: "Token image", portrait: "Actor portrait" }, l.art)}${sel("shape", "Frame", PORTRAIT_SHAPES, l.shape)}</div><div class="an-field-row">${n("size", "Size", l.size, 3, 60, 0.5)}${n("gap", "Spacing", l.gap, 0, 20, 0.5)}${n("max", "Up to", l.max, 1, 12, 1)}</div><div class="an-field-row">${n("perRow", "Per row (0 = one line)", l.perRow, 0, 12, 1)}</div><div class="an-field-row">${c("ring", "Frame color", l.ring)}${n("stagger", "One after another (ms)", l.stagger, 0, 1000, 10)}</div><label class="an-check"><input type="checkbox" data-flash-layer-field="names" ${l.names ? "checked" : ""}> Show names</label><p class="an-hint">${l.side === "actor" ? "The one using the action, when the screen plays before an animation (a stand-in shows here). Try the Slash frame for a cut-in. " : ""}Filled in from the encounter when the screen plays: the party is player-owned or friendly tokens, the enemies hostile ones. Hidden combatants never appear. With no encounter, stand-ins show here.</p>`
      : l.kind === "image"
      ? `<label>Image or video<span class="an-flash-sound"><input data-flash-layer-field="src" placeholder="Choose a file or a JB2A key" value="${esc(l.src)}"><button data-action="flash-browse" data-target="image" aria-label="Browse images">…</button></span></label>${n("width", "Width (% of screen)", l.width, 1, 150, 1)}`
      : `<div class="an-field-row">${c("color", "Color", l.color)}${n("skew", "Slant", l.skew, -45, 45, 1)}</div><div class="an-field-row">${n("width", "Width %", l.width, 1, 150, 1)}${n("height", "Height %", l.height, 1, 100, 1)}</div>`;
    if (l.kind === "sound") return `<div class="an-editor-section"><span class="an-eyebrow">SOUND LAYER</span>${f("name", "Layer name", l.name, `placeholder="Sound"`)}${kind}</div>`;
    if (l.kind === "flash" || l.kind === "shake" || l.kind === "punch") return `<div class="an-editor-section"><span class="an-eyebrow">${esc(FLASH_KINDS[l.kind]).toUpperCase()}</span>${f("name", "Layer name", l.name, `placeholder="${esc(FLASH_KINDS[l.kind])}"`)}
      ${l.kind === "flash" ? `<div class="an-field-row">${c("color", "Color", l.color)}${n("strength", "Brightness", l.strength, 0.05, 1, 0.05)}</div>` : l.kind === "punch" ? n("strength", "Zoom (1.15 = 15% closer)", l.strength, 1.02, 1.6, 0.01) : n("strength", "Strength", l.strength, 0.2, 5, 0.1)}
      <div class="an-field-row">${n("start", "At (ms)", l.start, 0, 12000, 50)}${n("duration", "Lasts (ms)", l.duration, 50, 4000, 50)}</div><p class="an-hint">${l.kind === "flash" ? "Lights up the whole screen for a moment: put it where a title lands." : l.kind === "punch" ? "Zooms the whole card in fast, then eases back: a camera hit. Pair it with a flash and a shake." : "Jolts every layer together, fading out. Pair it with a flash for an impact."}</p></div>`;
    const key = this.keyAtPlayhead(l), kn = (p, label, min, max, step) => `<label>${label}<input type="number" min="${min}" max="${max}" step="${step}" data-flash-key-field="${p}" value="${Math.round(key[p] * 100) / 100}"></label>`;
    const motion = `<div class="an-editor-section an-flash-card-box an-flash-motion-box"><span class="an-eyebrow">MOTION & EFFECTS</span>
      ${key ? `<div class="an-flash-keybox"><span>◆ Keyframe at ${seconds(key.at)}</span><div class="an-field-row">${kn("x", "X %", -20, 120, 0.5)}${kn("y", "Y %", -20, 120, 0.5)}</div><div class="an-field-row">${kn("scale", "Scale", 0.05, 10, 0.05)}${kn("rotate", "Rotate", -720, 720, 1)}${kn("opacity", "Opacity", 0, 1, 0.05)}</div>${l.kind === "text" ? `<div class="an-field-row">${["color", "glow"].map((p) => `<label class="an-check"><input type="checkbox" data-flash-key-toggle="${p}" ${key[p] ? "checked" : ""}> ${p === "color" ? "Color" : "Glow"} here</label>${key[p] ? `<input type="color" aria-label="${p === "color" ? "Color" : "Glow"} at this keyframe" data-flash-key-field="${p}" value="${key[p]}">` : ""}`).join("")}</div>` : ""}<button class="an-quiet is-danger" data-action="flash-key-remove">Remove this keyframe</button></div>`
        : `<button class="an-flash-keyadd" data-action="flash-key-add" ${(l.keys?.length ?? 0) >= KEY_LIMIT ? "disabled" : ""}>◆ Add keyframe at ${seconds(this.time)}</button>`}
      ${l.keys?.length ? `${sel("keyEase", "Between keyframes", { smooth: "Smooth", linear: "Steady" }, l.keyEase)}<p class="an-hint">${l.keys.length} keyframe${l.keys.length === 1 ? "" : "s"}. Move the playhead and drag or resize the layer on the stage: it edits the keyframe there, or adds one.</p>` : `<p class="an-hint">Keyframes move, scale, turn or fade the layer over time. Add one, move the playhead, then drag the layer to where it should go.</p>`}
      <div class="an-flash-keycopy">${l.keys?.length ? `<button class="an-quiet" data-action="flash-keys-copy">Copy keyframes</button>` : ""}${this.keyClipboard ? `<button class="an-quiet" data-action="flash-keys-paste">Paste keyframes</button>` : ""}</div>
      <div class="an-field-row">${sel("loop", "Loop effect", FLASH_LOOPS, l.loop)}${l.loop !== "none" ? n("loopMs", "Every (ms)", l.loopMs, 150, 5000, 50) : ""}</div></div>`;
    const group = (title, body) => `<div class="an-flash-group"><span class="an-flash-sub">${title}</span>${body}</div>`;
    return `<div class="an-editor-section an-flash-card-box"><span class="an-eyebrow">${esc(FLASH_KINDS[l.kind]).toUpperCase()} LAYER</span>${f("name", "Layer name", l.name, `placeholder="${esc(FLASH_KINDS[l.kind])}"`)}
      ${group("Look", kind)}
      ${group("Position & blend", `<div class="an-field-row is-3">${n("x", "X %", Math.round(l.x * 10) / 10, -20, 120, 0.5)}${n("y", "Y %", Math.round(l.y * 10) / 10, -20, 120, 0.5)}${n("rotate", "Rotate°", l.rotate, -180, 180, 1)}</div><div class="an-field-row">${n("opacity", "Opacity", l.opacity, 0, 1, 0.05)}<label class="an-check"><input type="checkbox" data-flash-layer-field="shake" ${l.shake ? "checked" : ""}> Shake on arrival</label></div>${sel("blend", "Blend", FLASH_BLENDS, l.blend)}${l.kind === "image" && l.blend === "normal" ? `<p class="an-hint">JB2A videos have black backgrounds: Screen or Add hides the black and makes them glow.</p>` : ""}`)}
      ${group("Timing", `<div class="an-field-row">${n("start", "Starts (ms)", l.start, 0, 12000, 50)}${n("duration", "Lasts (ms, 0 = to end)", l.duration, 0, 12000, 50)}</div>`)}
      ${group("Entrance & exit", `<div class="an-field-row is-wide">${sel("enter", "Enters", FLASH_MOTIONS, l.enter)}${n("enterMs", "ms", l.enterMs, 0, 4000, 50)}</div><div class="an-field-row is-wide">${sel("exit", "Leaves", FLASH_MOTIONS, l.exit)}${n("exitMs", "ms", l.exitMs, 0, 4000, 50)}</div>`)}
    </div>${motion}`;
  }

  // Editor-only mute/solo (by layer id, never saved): the layers the stage leaves out.
  skipped() {
    const mute = (this.muted ??= new Set()), solo = (this.soloed ??= new Set()), layers = this.draft?.layers ?? [];
    const soloing = layers.some((l) => solo.has(l.id));
    return new Set(layers.flatMap((l, i) => ((soloing ? !solo.has(l.id) : mute.has(l.id)) ? [i] : [])));
  }
  // Redraw the stage at the current time (after every render or edit).
  mount() {
    this.measureSounds();
    const frame = this.w.root.querySelector("[data-flash-stage]");
    this.thumbs();
    this.syncScroll();
    const layersBox = this.w.root.querySelector(".an-flash-layers"), bar = this.w.root.querySelector("[data-flash-tl-scroll]");
    if (bar && !bar.dataset.bound) { bar.dataset.bound = "1"; bar.addEventListener("scroll", () => this.syncScroll(bar.scrollLeft)); }
    if (layersBox && !layersBox.dataset.wheel) {
      layersBox.dataset.wheel = "1";
      // Over the timeline: Ctrl+wheel zooms around the pointer; Shift+wheel (or a sideways swipe) scrolls.
      layersBox.addEventListener("wheel", (e) => {
        if (!e.target.closest?.(".an-flash-row-track, [data-flash-tl-scroll]")) return;
        if (e.ctrlKey || e.metaKey) { e.preventDefault(); this.zoomTimeline((this.tlZoom ?? 1) * (e.deltaY < 0 ? 1.25 : 0.8), e.clientX); return; }
        const dx = e.shiftKey ? e.deltaY : e.deltaX;
        if (!dx || (this.tlZoom ?? 1) <= 1) return;
        e.preventDefault(); this.syncScroll((this.tlScroll ?? 0) + dx);
      }, { passive: false });
    }
    // A redraw while the preview plays keeps it playing (put back if the redraw emptied the stage).
    if (this.playing && this.preview?.el) { if (frame && !frame.contains(this.preview.el)) frame.append(this.preview.el); return; }
    this.preview?.stop();
    this.preview = null;
    const s = this.current();
    if (!frame || !s) return;
    frame.replaceChildren();
    this.preview = createFlash(frame, validateFlash(s), { resolveMedia: (src) => this.host.resolveFlashMedia(src), vars: this.host.flashVars(), editing: true, skip: this.skipped() });
    // 👁 hides a layer on the stage while you edit (Preview still plays it).
    for (const [i, l] of s.layers.entries()) if (this.hidden?.has(l.id)) this.preview.el.querySelector(`[data-flash-layer="${i}"]`)?.classList.add("is-muted");
    const picked = this.preview.el.querySelector(`[data-flash-layer="${this.layerIndex}"]`);
    // The outline and resize handle ride on the moving part, so keyframed layers show them where they are.
    const kind = s.layers[this.layerIndex]?.kind, keyed = (s.layers[this.layerIndex]?.keys?.length ?? 0) > 0;
    if (picked) { picked.classList.add("is-selected"); picked.querySelector(".an-flash-motion")?.insertAdjacentHTML("beforeend", `<span class="an-flash-handle" data-flash-resize title="Drag to resize"></span><span class="an-flash-rotate" data-flash-rotate title="Drag to rotate (Shift snaps to 15°)"></span>${kind === "band" && !keyed ? `<span class="an-flash-edge is-x" data-flash-edge="x" title="Drag: width"></span><span class="an-flash-edge is-y" data-flash-edge="y" title="Drag: height"></span>` : ""}`); }
    // Wheel over the selected layer: opacity; Shift+wheel: size.
    if (!frame.dataset.wheel) {
      frame.dataset.wheel = "1";
      frame.addEventListener("wheel", (e) => {
        if (!e.target.closest?.(`[data-flash-layer="${this.layerIndex}"]`)) return;
        e.preventDefault();
        const layer = this.edit().layers[this.layerIndex], up = e.deltaY < 0;
        if (e.shiftKey) this.grow(layer, up ? 1.05 : 1 / 1.05);
        else { const t = this.target(layer); t.opacity = Math.round(Math.min(1, Math.max(0, t.opacity + (up ? 0.05 : -0.05))) * 100) / 100; }
        this.mount(); this.later();
      }, { passive: false });
    }
    this.preview.seek(this.time);
  }
  // The gallery's small previews, each frozen at its best moment.
  thumbs() {
    for (const run of this.thumbRuns ?? []) run.stop();
    this.thumbRuns = [];
    for (const box of this.w.root?.querySelectorAll?.("[data-flash-thumb]") ?? []) {
      const [from, id] = box.dataset.flashThumb.split(/:(.*)/s);
      const tpl = (from === "tpl" ? STARTER_FLASHES : this.screens()).find((t) => t.id === id);
      if (!tpl) continue;
      const run = createFlash(box, tpl, { resolveMedia: (src) => this.host.resolveFlashMedia(src), vars: this.host.flashVars(), editing: false });
      run.seek(Math.round(tpl.duration * 0.55));
      this.thumbRuns.push(run);
    }
  }
  setTime(ms) {
    const s = this.current();
    this.time = Math.max(0, Math.min(s.duration, Math.round(ms)));
    this.preview?.seek(this.time);
    this.showTime(this.time);
  }

  // Inputs update the draft and the stage live; structural changes re-render on change.
  input(t) {
    if (t.hasAttribute?.("data-flash-time")) { this.setTime(Number(t.value)); return true; }
    const field = t.dataset?.flashField, layerField = t.dataset?.flashLayerField, keyField = t.dataset?.flashKeyField, keyToggle = t.dataset?.flashKeyToggle;
    if (!field && !layerField && !keyField && !keyToggle) return false;
    if (keyField || keyToggle) {
      const layer = this.edit().layers[this.layerIndex], key = this.keyAtPlayhead(layer);
      if (key && keyToggle) { if (t.checked) key[keyToggle] = layer[keyToggle]; else delete key[keyToggle]; }
      else if (key) key[keyField] = t.type === "color" ? t.value : Number(t.value);
    }
    const value = t.type === "checkbox" ? t.checked : t.type === "number" ? Number(t.value) : t.value;
    const s = this.edit();
    if (field === "duration") s.duration = Math.round(Number(t.value) * 1000);
    else if (field) { const [a, b] = field.split("."); if (b) s[a][b] = value; else s[a] = value; }
    else if (layerField && s.layers[this.layerIndex]) s.layers[this.layerIndex][layerField] = value;
    Object.assign(this.draft, validateFlash(s));
    this.mount();
    const save = this.w.root.querySelector('[data-action="flash-save"]');
    if (save) { save.disabled = false; save.textContent = "Save"; }
    const revert = this.w.root.querySelector('[data-action="flash-revert"]');
    if (revert) revert.disabled = false;
    return true;
  }
  change(t) {
    if (!t.dataset?.flashField && !t.dataset?.flashLayerField && !t.dataset?.flashKeyField && !t.dataset?.flashKeyToggle) return false;
    this.w.render();
    return true;
  }

  // Where a dragged layer lands: snapped to the centre lines and other layers' positions
  // (within a small reach), with guide lines showing the snap. Alt places freely.
  snap(frame, index, ev, box) {
    let x = Math.round(((ev.clientX - box.left) / box.width) * 1000) / 10, y = Math.round(((ev.clientY - box.top) / box.height) * 1000) / 10;
    frame.querySelectorAll(".an-flash-guide").forEach((g) => g.remove());
    if (ev.altKey) return { x, y };
    const others = this.draft.layers.filter((l, j) => j !== index && !MOMENT_KINDS.includes(l.kind));
    const xs = [50, ...others.map((l) => l.x)], ys = [50, ...others.map((l) => l.y)], reach = 1.2;
    const sx = xs.find((c) => Math.abs(c - x) <= reach), sy = ys.find((c) => Math.abs(c - y) <= reach);
    if (sx !== undefined) { x = sx; frame.insertAdjacentHTML("beforeend", `<span class="an-flash-guide is-v" style="left:${x}%"></span>`); }
    if (sy !== undefined) { y = sy; frame.insertAdjacentHTML("beforeend", `<span class="an-flash-guide is-h" style="top:${y}%"></span>`); }
    return { x, y };
  }
  // The stage's height when the bar under it was dragged (remembered on this device), else null: full width.
  stageHeight() {
    if (this._stageHeight === undefined) {
      let stored = NaN;
      try { stored = Number(globalThis.localStorage?.getItem("animater.flashStageHeight")); } catch {}
      this._stageHeight = Number.isFinite(stored) && stored >= 120 ? stored : null;
    }
    return this._stageHeight;
  }
  setStageHeight(px, main = null) {
    const widest = main ? (main.getBoundingClientRect().width * 9) / 16 : Infinity;
    this._stageHeight = Math.round(Math.max(120, Math.min(widest, px)));
    if (main) { main.classList.add("has-stage-height"); main.style.setProperty("--an-flash-stage-height", `${this._stageHeight}px`); }
    try { globalThis.localStorage?.setItem("animater.flashStageHeight", String(this._stageHeight)); } catch {}
  }
  resetStageHeight() {
    this._stageHeight = null;
    try { globalThis.localStorage?.removeItem("animater.flashStageHeight"); } catch {}
    this.w.render();
  }
  stageSplitDrag(e) {
    const split = e.target.closest?.("[data-flash-hsplit]");
    if (!split) return false;
    e.preventDefault();
    const main = split.closest(".an-flash-main"), frame = main?.querySelector(".an-flash-frame");
    if (!main || !frame) return true;
    const top = frame.getBoundingClientRect().top, below = split.getBoundingClientRect().top - frame.getBoundingClientRect().bottom;
    split.setPointerCapture?.(e.pointerId);
    split.classList.add("is-active");
    const move = (ev) => this.setStageHeight(ev.clientY - top - below, main);
    const up = () => { split.classList.remove("is-active"); split.removeEventListener("pointermove", move); split.removeEventListener("pointerup", up); split.removeEventListener("pointercancel", up); };
    split.addEventListener("pointermove", move); split.addEventListener("pointerup", up); split.addEventListener("pointercancel", up);
    return true;
  }
  pointer(e) {
    if (e.button !== 0) return false;
    const handled = this.stageSplitDrag(e) || this.scrubLabel(e) || this.lengthDrag(e) || this.rulerDrag(e) || this.timelineDrag(e) || this.stageDrag(e);
    // Working on the stage or timeline leaves any text field, so shortcuts apply.
    if (handled && e.target.closest?.("[data-flash-stage], .an-flash-row-track")) document.activeElement?.blur?.();
    return handled;
  }
  // Drag a number field's label sideways to change it (Shift ×10, Alt finer); release commits.
  scrubLabel(e) {
    const label = e.target.closest?.(".an-flash-page label");
    if (!label || e.target.closest("input, select, textarea, button")) return false;
    const input = label.querySelector('input[type="number"]');
    if (!input || input.disabled) return false;
    e.preventDefault();
    const step = Number(input.step) || 1, min = input.min === "" ? -Infinity : Number(input.min), max = input.max === "" ? Infinity : Number(input.max);
    const places = (String(input.step).split(".")[1] ?? "").length, from = Number(input.value) || 0, x0 = e.clientX;
    let moved = false;
    const move = (ev) => {
      const dx = ev.clientX - x0;
      if (!moved && Math.abs(dx) < 2) return;
      if (!moved) { moved = true; document.body.classList.add("an-scrubbing"); }
      const mult = ev.shiftKey ? 10 : ev.altKey ? 0.1 : 1, digits = places + (ev.altKey ? 1 : 0);
      const v = Math.min(max, Math.max(min, from + (dx / 4) * step * mult));
      input.value = v.toFixed(digits);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    };
    const up = () => {
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up);
      document.body.classList.remove("an-scrubbing");
      if (moved) input.dispatchEvent(new Event("change", { bubbles: true })); else input.focus();
    };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
    return true;
  }
  // The ruler's end grip: drag to set the screen's length (1 to 12 seconds, in tenths).
  lengthDrag(e) {
    const grip = e.target.closest?.("[data-flash-length]");
    if (!grip) return false;
    e.preventDefault(); e.stopPropagation();
    const lane = grip.closest(".an-flash-lane"), r = lane.getBoundingClientRect(), d0 = this.draft.duration;
    let moved = false, frame = 0;
    const move = (ev) => {
      const d = Math.round(Math.min(12000, Math.max(1000, (d0 * (ev.clientX - r.left)) / Math.max(1, r.width))) / 100) * 100;
      if (d === this.draft.duration) return;
      if (!moved) { moved = true; this.edit(); }
      this.draft.duration = d; this.time = Math.min(this.time, d);
      cancelAnimationFrame(frame); frame = requestAnimationFrame(() => this.w.render());
    };
    const up = () => {
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); cancelAnimationFrame(frame);
      if (moved) { Object.assign(this.draft, validateFlash(this.draft)); this.suppressClick = true; setTimeout(() => { this.suppressClick = false; }, 60); this.w.render(); }
    };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
    return true;
  }
  // The ruler: click or drag to move the playhead.
  rulerDrag(e) {
    const ruler = e.target.closest?.("[data-flash-ruler]");
    if (!ruler) return false;
    e.preventDefault();
    const lane = ruler.querySelector(".an-flash-lane") ?? ruler, total = this.current().duration;
    const to = (x) => { const r = lane.getBoundingClientRect(); this.setTime(((x - r.left) / r.width) * total); };
    to(e.clientX);
    const move = (ev) => to(ev.clientX);
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); this.w.render(); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
    return true;
  }
  // Timeline: drag a bar to move it in time, its ends to trim, its shaded ends to set the entrance
  // and exit, and ◆ to retime. Snaps to the playhead and other layers' starts and ends (Alt: free).
  timelineDrag(e) {
    const track = e.target.closest?.(".an-flash-row-track"), keyEl = e.target.closest?.(".an-flash-key"), bar = e.target.closest?.(".an-flash-row-bar");
    if (!track || (!keyEl && !bar)) return false;
    e.preventDefault();
    const s = this.draft, i = Number(track.dataset.index), layer = s.layers[i], total = s.duration;
    const rect = (track.querySelector(".an-flash-lane") ?? track).getBoundingClientRect(), msPer = total / Math.max(1, rect.width), x0 = e.clientX;
    const part = e.target.closest("[data-flash-part]")?.dataset.flashPart ?? "move";
    const sound = layer.kind === "sound", fileMs = sound && layer.soundMs > 0 && layer.soundSrc === layer.file ? layer.soundMs : Infinity;
    const from = { start: layer.start, end: sound ? soundEnd(layer, total) : layer.duration > 0 ? Math.min(total, layer.start + layer.duration) : total, enter: layer.enterMs, exit: layer.exitMs, toEnd: !(layer.duration > 0) && !Number.isFinite(fileMs) };
    const key = keyEl ? layer.keys.find((k) => k.at === Number(keyEl.dataset.at)) : null, at0 = key?.at;
    const marks = [this.time, 0, total, ...s.layers.flatMap((l, j) => (j === i ? [] : [l.start, l.duration > 0 ? l.start + l.duration : total]))];
    const snapT = (t, ev) => (ev.altKey ? t : marks.find((c) => Math.abs(c - t) <= 6 * msPer) ?? t);
    const clamp = (v, lo, hi) => Math.round(Math.min(hi, Math.max(lo, v)));
    let moved = false;
    const move = (ev) => {
      const dt = (ev.clientX - x0) * msPer;
      if (!moved && Math.abs(ev.clientX - x0) < 3) return;
      if (!moved) { moved = true; this.edit(); this.layerIndex = i; }
      if (key) { key.at = clamp(snapT(at0 + dt, ev), 0, total); layer.keys.sort((a, b) => a.at - b.at); }
      else if (part === "move") {
        const len = from.end - from.start, start = clamp(snapT(from.start + dt, ev), 0, total - (from.toEnd ? 50 : len));
        layer.start = start;
      } else if (part === "start") {
        const start = clamp(snapT(from.start + dt, ev), 0, from.end - 50);
        layer.start = start; if (!from.toEnd) layer.duration = from.end - start;
      } else if (part === "end" && sound) {
        // A sound is trimmed, never stretched past its file: back at the file's end it plays whole again.
        const whole = Math.min(total, from.start + fileMs), end = clamp(snapT(from.end + dt, ev), from.start + 50, whole);
        layer.duration = end >= whole - 5 ? 0 : end - from.start;
      } else if (part === "end") {
        const end = clamp(snapT(from.end + dt, ev), from.start + 50, total);
        layer.duration = end >= total - 5 && !["flash", "shake", "punch"].includes(layer.kind) ? 0 : end - from.start;
      } else if (part === "enter") layer.enterMs = clamp(from.enter + dt, 0, Math.min(4000, from.end - from.start - layer.exitMs));
      else if (part === "exit") layer.exitMs = clamp(from.exit - dt, 0, Math.min(4000, from.end - from.start - layer.enterMs));
      track.innerHTML = this.trackHTML(layer, i, total);
      this.mount();
    };
    const up = () => {
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up);
      if (moved) { this.suppressClick = true; setTimeout(() => { this.suppressClick = false; }, 60); this.w.render(); }
    };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
    return true;
  }
  // Stage: drag a layer to move it, the corner to resize, the round handle to rotate, band edges to stretch.
  stageDrag(e) {
    const el = e.target.closest?.("[data-flash-stage] [data-flash-layer]"), frame = el?.closest("[data-flash-stage]");
    if (!el) return false;
    e.preventDefault();
    const i = Number(el.dataset.flashLayer), resize = !!e.target.closest("[data-flash-resize]"), rotate = !!e.target.closest("[data-flash-rotate]"), edge = e.target.closest("[data-flash-edge]")?.dataset.flashEdge;
    if (i !== this.layerIndex) { this.layerIndex = i; this.w.render(); }
    const box = frame.getBoundingClientRect(), layer = this.draft.layers[i];
    const cx = box.left + (layer.x / 100) * box.width, cy = box.top + (layer.y / 100) * box.height;
    const now = keyValueAt(layer, this.time), keyed = (layer.keys?.length ?? 0) > 0;
    const px = keyed ? box.left + (now.x / 100) * box.width : cx, py = keyed ? box.top + (now.y / 100) * box.height : cy;
    const start = { x: e.clientX, y: e.clientY, dx: Math.max(4, Math.abs(e.clientX - px)), dy: Math.max(4, Math.abs(e.clientY - py)), size: layer.size, width: layer.width, height: layer.height, scale: now.scale };
    let moved = false, key = null;
    const angle = (x, y) => (Math.atan2(y - py, x - px) * 180) / Math.PI, a0 = angle(e.clientX, e.clientY), rot0 = keyed ? now.rotate : layer.rotate;
    const move = (ev) => {
      if (!moved && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < 3) return;
      if (!moved) { moved = true; this.edit(); if (keyed) key = this.keyForEdit(layer); }
      if (rotate) {
        // Round handle: turn around the layer's centre; Shift snaps to 15°.
        let r = rot0 + angle(ev.clientX, ev.clientY) - a0;
        if (ev.shiftKey) r = Math.round(r / 15) * 15;
        const t = key ?? layer, lim = key ? 720 : 180;
        t.rotate = Math.round(((((r + lim) % (2 * lim)) + 2 * lim) % (2 * lim)) - lim);
        this.mount();
        return;
      }
      if (edge && !key) {
        // Band edges stretch one way.
        const round = (v) => Math.round(v * 10) / 10;
        if (edge === "x") layer.width = round(Math.min(150, Math.max(1, start.width * (Math.abs(ev.clientX - cx) / start.dx))));
        else layer.height = round(Math.min(100, Math.max(1, start.height * (Math.abs(ev.clientY - cy) / start.dy))));
        this.mount();
        return;
      }
      if (key) {
        // A keyframed layer: drag sets this keyframe's position, the handle its scale.
        if (resize) key.scale = Math.round(Math.min(10, Math.max(0.05, start.scale * Math.max(Math.abs(ev.clientX - px) / start.dx, Math.abs(ev.clientY - py) / start.dy))) * 100) / 100;
        else Object.assign(key, this.snap(frame, i, ev, box));
        this.mount();
        return;
      }
      if (resize) {
        // Corner handle: text grows in size, images in width, bands in width and height.
        const fx = Math.abs(ev.clientX - cx) / start.dx, fy = Math.abs(ev.clientY - cy) / start.dy, f = Math.max(fx, fy);
        const round = (v) => Math.round(v * 10) / 10;
        if (layer.kind === "text") layer.size = round(Math.min(40, Math.max(1, start.size * f)));
        else if (layer.kind === "portraits") layer.size = round(Math.min(60, Math.max(3, start.size * f)));
        else if (layer.kind === "image") layer.width = round(Math.min(150, Math.max(1, start.width * f)));
        else if (["lines", "burst", "slash"].includes(layer.kind)) layer.width = round(Math.min(300, Math.max(10, start.width * f)));
        else if (layer.kind === "particles") layer.size = round(Math.min(3, Math.max(0.3, start.size * f)));
        else { layer.width = round(Math.min(150, Math.max(1, start.width * fx))); layer.height = round(Math.min(100, Math.max(1, start.height * fy))); }
        this.mount();
        return;
      }
      Object.assign(layer, this.snap(frame, i, ev, box));
      const live = frame.querySelector(`[data-flash-layer="${i}"]`);
      if (live) { live.style.left = `${layer.x}%`; live.style.top = `${layer.y}%`; }
    };
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); frame.querySelectorAll(".an-flash-guide").forEach((g) => g.remove()); if (moved) this.w.render(); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return true;
  }

  async action(action, b) {
    if (!action.startsWith("flash-")) return false;
    // A timeline drag ends with a click on the same row; that click should not also jump the playhead.
    if (this.suppressClick && ["flash-layer", "flash-key-go"].includes(action)) return true;
    const list = this.screens();
    const s = this.current();
    const commit = async (next, message) => { await this.host.saveFlashScreens(next); this.dirty = false; this.w.message = message; };
    switch (action) {
      case "flash-select":
        this.editing = true;
        if (b.dataset.id === this.selectedId) break;
        if (this.dirty && !(await this.host.confirm(`Discard your unsaved changes to “${s.name}”?`))) return true;
        this.selectedId = b.dataset.id; this.draft = null; this.dirty = false; break;
      case "flash-back": this.editing = false; this.playing = false; break;
      case "flash-new": this.showGallery = true; this.editing = false; break;
      case "flash-gallery-close": this.showGallery = false; break;
      case "flash-new-from": case "flash-duplicate": {
        if (this.dirty && !(await this.host.confirm(`Discard your unsaved changes to “${s.name}”?`))) return true;
        this.dirty = false; this.showGallery = false;
        const tpl = STARTER_FLASHES.find((t) => t.id === b.dataset.id);
        const base = action === "flash-new-from"
          ? tpl ? { ...clone(tpl), name: tpl.name } : validateFlash({ name: "New flash screen", event: "start", layers: [{ kind: "text", name: "Title", text: "TO BATTLE!", enter: "slam", shake: true }] })
          : { ...clone(s), id: newId(), name: `${s.name} copy` };
        base.id = newId();
        await commit([...list, validateFlash(base)], `${base.name} created.`);
        this.selectedId = base.id; this.draft = null; this.editing = true; break;
      }
      case "flash-delete": {
        if (!(await this.host.confirm(`Delete the flash screen “${s.name}”?`))) return true;
        await commit(list.filter((f) => f.id !== s.id), `${s.name} deleted.`);
        this.selectedId = null; this.draft = null; this.editing = false; break;
      }
      case "flash-save":
        await commit(list.map((f) => (f.id === s.id ? validateFlash(s) : f)), `${s.name} saved.`); break;
      case "flash-revert":
        if (this.dirty && !(await this.host.confirm(`Discard your unsaved changes to “${s.name}”?`))) return true;
        this.draft = null; this.dirty = false; break;
      case "flash-default": await this.host.setFlashDefault(b.dataset.event, toggleFlashOn(this.host.flashDefaults(), b.dataset.event, s.id)); break;
      case "flash-preview": {
        // No redraw while it plays: the label changes in place, and the page catches up after.
        b.textContent = this.playing ? "▶ Preview" : "■ Stop";
        await this.togglePlay();
        this.w.render();
        return true;
      }
      case "flash-play-all": {
        // It shows on every player's screen at once, unsaved changes included: ask first.
        const players = this.host.activePlayers?.() ?? null;
        if (!(await this.host.confirm(`Play “${s.name}” on everyone's screen now${players ? ` (${players} player${players === 1 ? "" : "s"} online)` : ""}?${this.dirty ? " It plays your unsaved changes." : ""}`))) return true;
        this.host.playFlash(validateFlash(s), { everyone: true }); this.w.message = `Playing “${s.name}” for everyone.`; break;
      }
      case "flash-layer": this.layerIndex = Number(b.dataset.index); this.time = this.restTime(s, this.layerIndex); this.tab = "layer"; break;
      case "flash-mute": case "flash-solo": {
        const set = action === "flash-mute" ? (this.muted ??= new Set()) : (this.soloed ??= new Set()), id = s.layers[Number(b.dataset.index)]?.id;
        if (id) { if (set.has(id)) set.delete(id); else set.add(id); }
        break;
      }
      case "flash-align": {
        const layer = this.edit().layers[this.layerIndex];
        if (!layer || !!MOMENT_KINDS.includes(layer.kind)) return true;
        const t = this.target(layer);
        if (b.dataset.x) t.x = Number(b.dataset.x);
        if (b.dataset.y) t.y = Number(b.dataset.y);
        break;
      }
      case "flash-help": this.showHelp = !this.showHelp; break;
      case "flash-quick": {
        const current = s.layers[this.layerIndex];
        if (!current) return true;
        const [op, key, value] = b.dataset.op.split(":");
        if (op === "hear") { if (current.file) this.host.flashPlaySound(current.file, current.volume); return true; }
        if (op === "browse") return this.action("flash-browse", { dataset: { target: current.kind === "sound" ? "layer-sound" : "image" } });
        const layer = this.edit().layers[this.layerIndex];
        if (op === "toggle") layer[key] = !layer[key];
        else if (op === "grow") this.grow(layer, Number(key));
        else if (op === "add") { const t = key === "rotate" ? this.target(layer) : layer; t[key] = Math.round((Number(t[key]) + Number(value)) * 100) / 100; }
        else if (op === "align") this.target(layer)[key] = Number(value);
        else if (op === "key") { layer.keys ??= []; this.keyForEdit(layer); }
        else if (op === "here") layer.start = this.time;
        else if (op === "cycle") {
          const choices = Object.keys({ enter: FLASH_MOTIONS, blend: FLASH_BLENDS, side: PORTRAIT_SIDES, shape: PORTRAIT_SHAPES, ptype: PARTICLE_TYPES, direction: PARTICLE_DIRECTIONS }[key]);
          layer[key] = choices[(choices.indexOf(layer[key]) + 1) % choices.length];
          // A new kind of particle starts with its own colour and direction.
          if (key === "ptype") { delete layer.color; delete layer.direction; }
        }
        Object.assign(this.draft, validateFlash(this.draft));
        break;
      }
      case "flash-insert-var": {
        const layer = this.edit().layers[this.layerIndex];
        if (layer?.kind === "text") layer.text = `${layer.text}${layer.text && !/\s$/.test(layer.text) ? " " : ""}${b.dataset.var}`;
        break;
      }
      case "flash-tab": this.tab = b.dataset.tab; break;
      case "flash-effects": this.showEffects = !this.showEffects; break;
      case "flash-eye": {
        const id = s.layers[Number(b.dataset.index)]?.id, set = (this.hidden ??= new Set());
        if (id) { if (set.has(id)) set.delete(id); else set.add(id); }
        break;
      }
      case "flash-card-default": {
        // A sibling of the card's open button, so it never opens the editor.
        const on = this.host.flashDefaults()[b.dataset.event] === b.dataset.id;
        await this.host.setFlashDefault(b.dataset.event, on ? "none" : b.dataset.id);
        break;
      }
      case "flash-moment-toggle": {
        const defaults = this.host.flashDefaults(), on = flashOn(defaults, b.dataset.event, b.dataset.id), next = toggleFlashOn(defaults, b.dataset.event, b.dataset.id);
        await this.host.setFlashDefault(b.dataset.event, next);
        this.w.message = on ? "Turned off." : Array.isArray(next) && next.length > 1 ? `${next.length} are on: you pick which plays ${b.dataset.event === "start" ? "at Begin Combat" : "when combatants are added"}.` : `It now plays on every ${FLASH_EVENTS[b.dataset.event].toLowerCase()}.`;
        break;
      }
      case "flash-zoom": {
        const z = this.tlZoom ?? 1;
        if (b.dataset.zoom === "fit") { this.tlZoom = 1; this.tlScroll = 0; break; }
        this.zoomTimeline(b.dataset.zoom === "in" ? z * 1.5 : z / 1.5);
        return true;
      }
      case "flash-tours": this.showTours = !this.showTours; break;
      case "flash-tour": this.showTours = false; void runFlashTour(this, b.dataset.tour); return true;
      case "flash-undo": case "flash-redo": this.history(action === "flash-undo" ? "undo" : "redo"); break;
      case "flash-layer-copy": {
        const i = Number(b.dataset.index), layers = this.edit().layers, copy = { ...clone(layers[i]), id: newId(), name: `${layers[i].name || FLASH_KINDS[layers[i].kind]} copy`, x: layers[i].x + 3, y: layers[i].y + 3, keys: (layers[i].keys ?? []).map((k) => ({ ...k, x: k.x + 3, y: k.y + 3 })) };
        layers.splice(i + 1, 0, copy); this.layerIndex = i + 1; break;
      }
      // Keyframes copy relative to their layer, so pasting onto another layer moves it the same way from its own place.
      case "flash-keys-copy": { const l = s.layers[this.layerIndex]; this.keyClipboard = l.keys.map((k) => ({ ...k, x: k.x - l.x, y: k.y - l.y })); this.w.message = `Copied ${l.keys.length} keyframe${l.keys.length === 1 ? "" : "s"}.`; break; }
      case "flash-keys-paste": { const l = this.edit().layers[this.layerIndex]; l.keys = this.keyClipboard.map((k) => ({ ...k, x: k.x + l.x, y: k.y + l.y })); break; }
      case "flash-export": {
        this.host.downloadJSON({ schema: 1, type: "animater-flash-screens", screens: list }, "animater-flash-screens.json");
        this.w.message = `Exported ${list.length} flash screen${list.length === 1 ? "" : "s"}.`; break;
      }
      case "flash-import": {
        if (this.dirty && !(await this.host.confirm(`Discard your unsaved changes to “${s?.name}”?`))) return true;
        const text = await this.host.pickTextFile(".json,application/json");
        if (!text) return true;
        let data; try { data = JSON.parse(text); } catch { throw Error("That file is not an Animater flash screens export."); }
        const incoming = validateFlashes(Array.isArray(data) ? data : data?.screens);
        if (!incoming.length) throw Error("No flash screens found in that file.");
        const ids = new Set(list.map((x) => x.id)), room = FLASH_LIMIT - list.length;
        if (room <= 0) throw Error(`You already have the most flash screens (${FLASH_LIMIT}).`);
        const added = incoming.slice(0, room).map((x) => (ids.has(x.id) ? { ...x, id: newId() } : x));
        await commit([...list, ...added], `Imported ${added.length} flash screen${added.length === 1 ? "" : "s"}${added.length < incoming.length ? ` (${incoming.length - added.length} over the limit were skipped)` : ""}.`);
        this.selectedId = added[0].id; this.draft = null; this.editing = false; break;
      }
      case "flash-key-go": this.layerIndex = Number(b.dataset.index); this.time = Number(b.dataset.at); break;
      case "flash-key-add": { const layer = this.edit().layers[this.layerIndex]; layer.keys ??= []; this.keyForEdit(layer); break; }
      case "flash-key-remove": { const layer = this.edit().layers[this.layerIndex], key = this.keyAtPlayhead(layer); layer.keys = layer.keys.filter((k) => k !== key); break; }
      case "flash-add": {
        // Drawn effects start sensibly: lines and bursts behind everything, a slash at a slant.
        const kind = b.dataset.kind, extra = { text: { text: "New text" }, slash: { rotate: -18, enter: "none", exit: "fade", duration: 900 }, lines: { enter: "fade", enterMs: 150 }, burst: { enter: "zoom", enterMs: 300 }, particles: { enter: "fade", enterMs: 400 } }[kind] ?? {};
        const layer = validateLayer({ kind, name: FLASH_KINDS[kind], ...extra, ...(MOMENT_KINDS.includes(kind) ? { start: this.time, enter: "none", exit: "none" } : {}) }, s.duration);
        this.showEffects = false; this.tab = "layer";
        if (["lines", "burst", "particles"].includes(kind)) { this.edit().layers.unshift(layer); this.layerIndex = 0; }
        else { this.edit().layers.push(layer); this.layerIndex = s.layers.length - 1; }
        // Moments (flash, shake, sound) land at the playhead, which stays put; other layers show themselves.
        if (!MOMENT_KINDS.includes(layer.kind)) this.time = this.restTime(s, this.layerIndex);
        break;
      }
      case "flash-layer-up": case "flash-layer-down": {
        const i = Number(b.dataset.index), j = action === "flash-layer-up" ? i + 1 : i - 1, layers = this.edit().layers;
        [layers[i], layers[j]] = [layers[j], layers[i]]; this.layerIndex = j; break;
      }
      case "flash-layer-remove": this.edit().layers.splice(Number(b.dataset.index), 1); this.layerIndex = Math.max(0, Math.min(this.layerIndex, s.layers.length - 1)); break;
      case "flash-browse": {
        const sound = b.dataset.target === "sound", layerSound = b.dataset.target === "layer-sound", background = b.dataset.target === "background", layer = s.layers[this.layerIndex];
        this.host.pickMedia(sound || layerSound ? "audio" : "imagevideo", sound ? s.sound.file : layerSound ? layer?.file : background ? s.backdrop.media : layer?.src, (path) => {
          if (sound) this.edit().sound.file = path; else if (background) this.edit().backdrop.media = path; else if (layerSound && layer) this.edit().layers[this.layerIndex].file = path; else if (layer) this.edit().layers[this.layerIndex].src = path;
          this.w.render();
        });
        return true;
      }
      default: return false;
    }
    this.w.render();
    return true;
  }
}
