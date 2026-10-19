import { uuid } from "../core/uuid.mjs";
// Recipe Studio: the full-window recipe editor. A monitor with transport on the
// left, the stage inspector on the right and a multi-track timeline across the
// bottom. Stages are grouped into role tracks; inside a track, stages that do
// not overlap share a lane. Saved recipe data is unchanged: tracks, lanes,
// playhead and zoom are presentation only.
import { finisherChipText } from "../engines/finishers/finisher-model.mjs";
import { KINDS, EVENTS, STRIKE_SCOPES, MAX_STAGES, validateRecipe, clone } from "../core/model.mjs";
import { timelineLayout, packLanes, linkStartModes } from "../engines/playback/choreography.mjs";
import { sampleRecipe, timedStages, previewVariants, variantMembers } from "../engines/playback/composition.mjs";
import { canvasToSquares, keyframesOf, scrubPoint, keyframeDeleteApplies } from "./keyframe-ui.mjs";
import { moveKeyframePoint, deleteKeyframe, normalizeKeyframes } from "../engines/motion/keyframe-path.mjs";
import { previewRecipeSounds } from "../engines/sound/spell-sounds.mjs";
import { RecipePreview } from "../engines/preview/recipe-preview.mjs";

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
export const STUDIO_TRACKS = Object.freeze([
  { id: "caster", icon: "✦", name: "Source", kind: "cast" },
  { id: "flight", icon: "➶", name: "Flight", kind: "projectile" },
  { id: "target", icon: "◎", name: "Target", kind: "impact" },
  { id: "motion", icon: "⇄", name: "Token motion", kind: "motion" },
  { id: "sound", icon: "♪", name: "Sound", kind: "sound" },
  { id: "fx", icon: "✧", name: "Filters & scene", kind: "tokenfx" },
]);
const LINKED_TRACKS = new Set(["caster", "fx"]);
// The ? panel: what you can do on the timeline, and the keys for it.
const STUDIO_HELP = Object.freeze([
  ["Play", "Space plays or pauses · Home / End · , and . (or the arrows) step · L loops the recipe · Shift+L loops the selected clip"],
  ["Add", "+ on a track adds a stage; at the start, a flight follows the cast and a hit follows the flight"],
  ["Move", "Drag a clip; it snaps to other clips and the playhead. A linked clip stays linked and shifts its offset; hold Alt to unlink it"],
  ["Length", "Drag a clip's right edge, or Alt + arrow keys"],
  ["Mute / solo", "M hides a track in the monitor, S shows only that track"],
  ["Edit", "Ctrl+Z undo · Ctrl+Shift+Z or Ctrl+Y redo · Ctrl+D duplicate · Ctrl+C / Ctrl+V copy and paste a stage · Delete removes it"],
  ["More", "Right-click a clip for start at playhead, duplicate, copy, paste and delete · Ctrl+S saves · Ctrl+wheel zooms"],
]);
const HEAD_WIDTH = 200, MIN_ZOOM = 1, MAX_ZOOM = 16;

// Tracks hidden in the monitor: everything but the soloed tracks, else the muted ones.
export function silencedTracks(muted = new Set(), solo = new Set()) {
  return solo.size ? new Set(STUDIO_TRACKS.map((t) => t.id).filter((id) => !solo.has(id))) : new Set(muted);
}
const silenced = (w) => silencedTracks(w.studioMuted, w.studioSolo);
function mutedStages(w) {
  const off = silenced(w);
  return w.recipe().stages.flatMap((s, i) => (off.has(trackOf(s)) ? [i] : []));
}
export function trackOf(stage) {
  const k = stage.kind;
  if (k === "cast") return "caster";
  if (k === "aura") return stage.subject === "targets" ? "target" : "caster";
  if (k === "travel" || k === "projectile") return "flight";
  if (k === "motion" || k === "sprite") return "motion";
  if (k === "sound") return "sound";
  if (k === "tokenfx" || k === "scenefx" || k === "overlay") return "fx";
  return "target";
}
// Tracks with their lanes; empty tracks still show so stages can be added there.
// A random-variant group shows as one stacked clip: the variant being edited (else the first).
export function shownVariant(recipe, stage, selectedIndex = -1) {
  const members = variantMembers(recipe.stages, stage?.variantGroup);
  if (members.length < 2) return stage;
  const selected = recipe.stages[selectedIndex];
  return members.includes(selected) ? selected : members[0];
}
// A finisher leads with the tracks its moves live on; Source and Flight sit behind "+ More tracks"
// unless they already hold stages.
const FINISHER_ORDER = Object.freeze(["motion", "target", "sound", "fx", "caster", "flight"]);
const FINISHER_HIDDEN = new Set(["caster", "flight"]);
export function studioTracks(recipe, selectedIndex = -1, { more = false } = {}) {
  const layout = timelineLayout(recipe);
  const linked = recipe.lifecycle === "document";
  const visible = layout.rows.filter((row) => shownVariant(recipe, recipe.stages[row.index], selectedIndex) === recipe.stages[row.index]);
  const order = recipe.finisher ? FINISHER_ORDER.map((id) => STUDIO_TRACKS.find((t) => t.id === id)) : STUDIO_TRACKS;
  let tracks = order.map((t) => {
    const rows = visible.filter((row) => trackOf(recipe.stages[row.index]) === t.id);
    return { ...t, lanes: rows.length ? packLanes(rows) : [[]] };
  }).filter((t) => !linked || LINKED_TRACKS.has(t.id) || t.lanes[0].length);
  let hiddenCount = 0;
  if (recipe.finisher) {
    const tucked = (t) => FINISHER_HIDDEN.has(t.id) && !t.lanes[0].length;
    hiddenCount = tracks.filter(tucked).length;
    if (!more) tracks = tracks.filter((t) => !tucked(t));
  }
  // Leave room past the last stage so clips can be dragged later.
  const end = Math.max(0, ...layout.rows.map((r) => r.end));
  return { tracks, hiddenCount, rows: layout.rows, end, total: Math.max(2000, Math.ceil((end * 1.25 + 500) / 500) * 500) };
}
// Label spacing that stays readable at any zoom (~viewport px across the full scale).
export function rulerStep(total, zoom, viewport = 900) {
  const pxPerMs = (viewport * zoom) / total;
  return [100, 250, 500, 1000, 2000, 5000, 10000].find((s) => s * pxPerMs >= 64) ?? 10000;
}
const seconds = (ms) => `${(ms / 1000).toFixed(2)}s`;
export function rulerHTML(total, zoom, viewport) {
  const step = rulerStep(total, zoom, viewport), minor = step / 5, marks = [];
  for (let t = 0; t <= total + 1e-6; t += minor) {
    const major = Math.abs(t / step - Math.round(t / step)) < 1e-6, left = ((t / total) * 100).toFixed(3);
    marks.push(major ? `<span class="is-major" style="left:${left}%"><i></i>${t % 1000 ? (t / 1000).toFixed(step < 1000 ? 2 : 1) : t / 1000}s</span>` : `<span style="left:${left}%"><i></i></span>`);
  }
  return marks.join("");
}

export function studioHTML(w, r) {
  const env = w.host.environment(), canvasUnavailable = Boolean(env.demo), linked = r.lifecycle === "document";
  const motionBlocked = w.motionBlocked(r), unconfigured = w.status(r) === "Choose an asset";
  const index = Math.min(w.stageIndex, r.stages.length - 1), dirty = w.dirty.has(r.id), status = w.status(r), link = w.linkNote?.(r);
  const duration = w.previewDuration(r), studio = studioTracks(r, w.stageIndex, { more: !!w.studioMoreTracks }), zoom = w.studioZoom ?? 1;
  w.previewMode = "recipe";
  const bar = `<header class="an-st-bar"><button class="an-st-back" data-action="studio-close" data-tooltip="Back to all ${r.finisher ? "finishers" : "recipes"}">← ${r.finisher ? "Finishers" : "Recipes"}</button><input class="an-st-name" aria-label="Recipe name" data-field="name" value="${esc(r.name)}">${triggerChipHTML(w, r)}${link?.warn ? `<button class="an-st-state is-missing" data-action="studio-settings" data-tooltip="${esc(link.text)} Click to open Recipe settings.">⚠ ${esc(link.short)}${dirty ? " · unsaved" : ""}</button>` : `<span class="an-st-state ${status !== "Ready to play" ? "is-missing" : ""}" ${link ? `data-tooltip="${esc(link.text)}"` : ""}>● ${esc(dirty ? "Unsaved changes" : status)}</span>`}<div class="an-st-bar-actions"><button class="an-icon" data-action="duplicate" data-tooltip="Duplicate recipe" aria-label="Duplicate recipe">⧉</button><button class="an-icon is-danger" data-action="delete" data-tooltip="Delete recipe" aria-label="Delete recipe"><i class="fas fa-trash" aria-hidden="true"></i></button><button class="an-icon" data-action="studio-undo" data-tooltip="Undo (Ctrl+Z)" aria-label="Undo" ${w.canUndo?.("undo", r) ? "" : "disabled"}>↶</button><button class="an-icon" data-action="studio-redo" data-tooltip="Redo (Ctrl+Shift+Z)" aria-label="Redo" ${w.canUndo?.("redo", r) ? "" : "disabled"}>↷</button><button data-action="revert" ${dirty ? "" : "disabled"}>Revert</button><button class="an-primary" data-action="save" data-tooltip="Save (Ctrl+S)" ${!dirty || w.busy ? "disabled" : ""}>${dirty ? (r.finisher ? "Save finisher" : "Save recipe") : "Saved ✓"}</button></div></header>`;
  const transport = `<div class="an-st-transport" role="group" aria-label="Playback">
      <button class="an-st-tbtn" data-action="studio-home" data-tooltip="Go to start (Home)" aria-label="Go to start">⏮</button><button class="an-st-tbtn an-st-play" data-action="studio-play" data-tooltip="Play / pause (Space)" aria-label="Play" ${unconfigured ? "disabled" : ""}>▶</button><button class="an-st-tbtn" data-action="studio-stop" data-tooltip="Stop and rewind" aria-label="Stop">■</button><button class="an-st-tbtn" data-action="studio-end" data-tooltip="Go to end (End)" aria-label="Go to end">⏭</button><button class="an-st-tbtn ${w.studioLoop ? "is-active" : ""}" data-action="studio-loop" aria-pressed="${!!w.studioLoop}" data-tooltip="Loop playback (L)" aria-label="Loop">⟲</button><button class="an-st-tbtn an-st-loopclip ${w.studioLoopClip ? "is-active" : ""}" data-action="studio-loop-clip" aria-pressed="${!!w.studioLoopClip}" data-tooltip="Loop the selected clip (Shift+L)" aria-label="Loop the selected clip">⟲<small>clip</small></button>
      <span class="an-st-time"><b data-st-time>${seconds(w.studioTime ?? 0)}</b> / ${seconds(duration)}</span>
      <small class="an-preview-status" data-preview-status role="status" aria-live="polite">${unconfigured ? "Choose an asset to preview your first stage" : "Sample spacing · drag the ruler to scrub"}</small>
      <span class="an-st-spacer"></span>
      <button class="an-primary" data-action="preview" data-tooltip="${canvasUnavailable ? "Canvas playback requires Foundry" : "Play privately on your canvas with the selected tokens"}" ${w.busy || canvasUnavailable || unconfigured ? "disabled" : ""}>▷ Local preview</button><button data-action="play" data-tooltip="${canvasUnavailable ? "Canvas playback requires Foundry" : motionBlocked ? "Foundry has not registered the token-motion channel" : "Broadcast this recipe to the table"}" ${w.busy || canvasUnavailable || motionBlocked || unconfigured || linked ? "disabled" : ""}>Play at table</button>
    </div>${motionBlocked ? w.motionSyncNoticeHTML() : ""}`;
  const monitor = `<section class="an-st-monitor" aria-label="Preview">${w.monitorHTML(r)}${transport}
      </section>`;
  const tracks = studio.tracks.map((t) => {
    const canAdd = !w.busy && r.stages.length < MAX_STAGES && (!linked || LINKED_TRACKS.has(t.id));
    return `<div class="an-st-track${silenced(w).has(t.id) ? " is-muted" : ""}" data-st-track="${t.id}"><div class="an-st-head"><span class="an-st-head-icon">${t.icon}</span><b>${esc(t.name)}</b><button class="an-st-ms${w.studioMuted?.has(t.id) ? " is-on" : ""}" data-action="studio-mute" data-st-track="${t.id}" aria-pressed="${!!w.studioMuted?.has(t.id)}" data-tooltip="Mute: hide this track in the monitor">M</button><button class="an-st-ms is-solo${w.studioSolo?.has(t.id) ? " is-on" : ""}" data-action="studio-solo" data-st-track="${t.id}" aria-pressed="${!!w.studioSolo?.has(t.id)}" data-tooltip="Solo: show only soloed tracks in the monitor">S</button><button class="an-st-add" data-action="studio-add" data-st-track="${t.id}" data-tooltip="Add a ${esc(KINDS[t.kind])} stage at the playhead" aria-label="Add ${esc(t.name)} stage at playhead" ${canAdd ? "" : "disabled"}>+</button></div><div class="an-st-lanes">${t.lanes.map((lane) => `<div class="an-tl-lane"><div class="an-tl-track">${lane.map((row) => w.timelineBarHTML(r, row, index, studio.total)).join("")}</div></div>`).join("")}</div></div>`;
  }).join("");
  const moreRow = studio.hiddenCount ? `<div class="an-st-more-row"><button class="an-st-more" data-action="studio-more" aria-expanded="${!!w.studioMoreTracks}" data-tooltip="${w.studioMoreTracks ? "Hide the empty Source and Flight tracks" : "Show the Source and Flight tracks"}">${w.studioMoreTracks ? "− Fewer tracks" : "+ More tracks"}</button></div>` : "";
  const timeline = `<section class="an-st-timeline" aria-label="Timeline">
    <div class="an-st-scroll" data-st-scroll style="--st-zoom:${zoom}"><div class="an-tl an-st-tl" data-tl-total="${studio.total}" data-studio-tl style="--tl-label:${HEAD_WIDTH}px">
      <div class="an-st-ruler-row"><div class="an-st-corner"><b data-st-time-corner>${seconds(w.studioTime ?? 0)}</b><span class="an-st-corner-tools"><button class="an-st-mini" data-action="studio-zoom-out" data-tooltip="Zoom out (Ctrl+wheel)" aria-label="Zoom out">−</button><button class="an-st-mini" data-action="studio-zoom-in" data-tooltip="Zoom in (Ctrl+wheel)" aria-label="Zoom in">+</button><button class="an-st-mini" data-action="studio-fit" data-tooltip="Fit the whole recipe" aria-label="Fit the whole recipe">⤢</button><button class="an-st-mini${w.studioHelp ? " is-active" : ""}" data-action="studio-help" aria-label="Timeline help and shortcuts" aria-expanded="${!!w.studioHelp}" data-tooltip="Timeline help and shortcuts">?</button></span></div><div class="an-tl-track an-st-ruler" data-st-ruler data-tooltip="Click or drag to move the playhead">${rulerHTML(studio.total, zoom)}</div></div>
      ${tracks}${moreRow}
      <div class="an-st-end" style="left:${w.timelineX(studio.total, studio.end)}" data-tooltip="Recipe ends"></div>
      <svg class="an-st-links" data-st-links aria-hidden="true"></svg>
      <div class="an-tl-playhead an-st-playhead" data-tl-playhead style="left:${w.timelineX(studio.total, w.studioTime ?? 0)}"><span></span></div>
      <div class="an-tl-guide" data-tl-guide hidden><span></span></div>
    </div></div></section>`;
  const help = w.studioHelp ? `<div class="an-st-help" role="dialog" aria-label="Timeline help"><div class="an-st-settings-head"><b>Timeline help</b><button class="an-icon" data-action="studio-help" aria-label="Close help" data-tooltip="Close (Esc)">✕</button></div><ul>${STUDIO_HELP.map(([what, how]) => `<li><b>${esc(what)}</b><span>${esc(how)}</span></li>`).join("")}</ul></div>` : "";
  const settings = w.studioSettings ? `<div class="an-st-settings" role="dialog" aria-label="Recipe settings"><div class="an-st-settings-head"><b>Recipe settings</b><small>Applies to the whole recipe</small><button class="an-icon" data-action="studio-settings" aria-label="Close recipe settings" data-tooltip="Close (Esc)">✕</button></div>${w.recipeSettingsHTML(r)}</div>` : "";
  return `<div class="an-studio" tabindex="-1" style="--an-inspector-width:${w.inspectorWidth()}px;--an-timeline-height:${timelineHeight(w)}px">${bar}${monitor}<div class="an-splitter" data-splitter role="separator" aria-orientation="vertical" aria-label="Resize stage inspector" tabindex="0" data-tooltip="Drag to resize · double-click to reset"></div><aside class="an-inspector">${w.inspectorHTML(r)}</aside><div class="an-st-hsplit" data-st-hsplit role="separator" aria-orientation="horizontal" aria-label="Resize timeline" tabindex="0" data-tooltip="Drag to resize the timeline · double-click to reset"></div>${timeline}${settings}${help}</div>`;
}
function triggerChipHTML(w, r) {
  const bound = r.itemUuid ? w.host.itemSummary?.(r.itemUuid)?.name : "";
  const what = STRIKE_SCOPES[r.matchScope] || bound || r.match?.split(",")[0]?.trim() || "";
  const lasting = w.lastingLabel?.(r);
  const when = r.enabled === false ? "Disabled" : r.finisher ? finisherChipText(r) : lasting ? `${lasting} · while on token` : EVENTS[r.trigger] ?? r.trigger;
  return `<button class="an-st-trigger${r.enabled === false ? " is-off" : ""}${w.studioSettings ? " is-open" : ""}" data-action="studio-settings" aria-expanded="${!!w.studioSettings}" data-tooltip="${r.finisher ? "Finisher settings: what it applies to, when it plays, how it ends" : "Recipe settings: trigger, item binding, description, category"}">⚙ <span>${esc(when)}</span>${what ? `<small>${esc(what)}</small>` : ""}</button>`;
}

function timelineHeight(w) {
  if (w.studioTimelineHeight === undefined) {
    let stored = NaN;
    try { stored = Number(globalThis.localStorage?.getItem("animater.timelineHeight")); } catch {}
    w.studioTimelineHeight = Number.isFinite(stored) && stored >= 160 ? stored : 280;
  }
  return w.studioTimelineHeight;
}
function setTimelineHeight(w, px) {
  const studio = w.root.querySelector(".an-studio");
  const max = Math.max(200, (studio?.getBoundingClientRect().height ?? 800) - 260);
  w.studioTimelineHeight = Math.round(Math.min(max, Math.max(160, px)));
  studio?.style.setProperty("--an-timeline-height", `${w.studioTimelineHeight}px`);
  try { globalThis.localStorage?.setItem("animater.timelineHeight", String(w.studioTimelineHeight)); } catch {}
  drawLinks(w);
}

// ——— Playback ———
const el = (w, sel) => w.root.querySelector(sel ? `.an-studio ${sel}` : ".an-studio");
const totalOf = (w) => Number(el(w, "[data-studio-tl]")?.dataset.tlTotal) || 1000;
function durationOf(w) { return w.previewDuration(w.recipe()); }
export function studioFrame(w, frame) {
  w.studioTime = frame.time;
  const t = el(w, "[data-st-time]"), c = el(w, "[data-st-time-corner]");
  if (t) t.textContent = seconds(frame.time);
  if (c) c.textContent = seconds(frame.time);
  // The path canvas's scrub token rides the curve with the playhead.
  const scrub = el(w, "[data-kf-scrub]"), r = scrub && w.recipe(), s = r?.stages[w.stageIndex];
  if (scrub && s?.motion === "path") {
    const p = scrubPoint(s, sampleRecipe(r).stages[w.stageIndex]?.delay ?? 0, frame.time);
    scrub.setAttribute("cx", p.x); scrub.setAttribute("cy", p.y);
  }
}
function placePlayhead(w) {
  const head = el(w, "[data-tl-playhead]");
  if (head) { head.hidden = false; head.style.left = w.timelineX(totalOf(w), w.studioTime ?? 0); }
  studioFrame(w, { time: w.studioTime ?? 0 });
}
function syncTransport(w) {
  const play = el(w, '[data-action="studio-play"]');
  if (play) { play.textContent = w.studioPlaying ? "❚❚" : "▶"; play.setAttribute("aria-label", w.studioPlaying ? "Pause" : "Play"); play.classList.toggle("is-active", !!w.studioPlaying); }
  const loop = el(w, '[data-action="studio-loop"]');
  if (loop) { loop.classList.toggle("is-active", !!w.studioLoop); loop.setAttribute("aria-pressed", String(!!w.studioLoop)); }
  const clip = el(w, '[data-action="studio-loop-clip"]');
  if (clip) { clip.classList.toggle("is-active", !!w.studioLoopClip); clip.setAttribute("aria-pressed", String(!!w.studioLoopClip)); }
}
function ensureRun(w) {
  const scene = el(w, "[data-recipe-scene]");
  if (!scene || w.busy) return null;
  const run = w.previewRun;
  // Selecting another random variant rebuilds the preview so that variant shows.
  const edited = w.recipe()?.stages[w.stageIndex], variantKey = edited?.variantGroup ? edited.stageId : "";
  if (run?.scene === scene && run.variantKey === variantKey && run.seek && !run.abort.signal.aborted) return run;
  run?.stop?.();
  try {
    let recipe;
    try { recipe = validateRecipe(w.recipe()); } catch { recipe = clone(w.recipe()); }
    // One variant per group plays in the monitor: the one being edited.
    recipe = previewRecipeSounds(previewVariants({ ...recipe, previewDistance: 3 }, w.stageIndex), w.host.soundCatalog?.());
    const next = new RecipePreview(scene, recipe, (frame) => w.updatePlayback(frame), { tokenFx: w.host.createTokenFxPreview, sceneFx: w.host.createSceneFxPreview });
    next.variantKey = variantKey;
    next.setMuted(mutedStages(w));
    w.previewRun = next;
    return next;
  } catch { return null; }
}
function queueSeek(w) {
  if (w.studioSeekQueued) return;
  w.studioSeekQueued = true;
  requestAnimationFrame(async () => {
    w.studioSeekQueued = false;
    const run = ensureRun(w);
    if (!run || w.studioPlaying) return;
    const idle = el(w, "[data-preview-idle]");
    if (idle) idle.hidden = true;
    await run.seek(w.studioTime ?? 0).catch(() => {});
  });
}
function pause(w) {
  w.previewRun?.pause?.();
  w.studioPlaying = false;
  syncTransport(w);
}
async function togglePlay(w) {
  if (w.studioPlaying) return pause(w);
  if (w.previewMode !== "recipe") { w.previewMode = "recipe"; w.render(); }
  const run = ensureRun(w);
  if (!run) return;
  const duration = run.duration();
  const from = (w.studioTime ?? 0) >= duration - 20 ? 0 : w.studioTime ?? 0;
  w.studioPlaying = true;
  syncTransport(w);
  const idle = el(w, "[data-preview-idle]");
  if (idle) idle.hidden = true;
  const complete = await run.play({ from, loop: () => !!w.studioLoop || !!w.studioLoopClip, range: () => (w.studioLoopClip ? clipRange(w) : null) });
  if (w.previewRun !== run) return;
  w.studioPlaying = false;
  if (complete) { w.studioTime = duration; placePlayhead(w); }
  syncTransport(w);
}
// The selected clip's span on the timeline, for "Loop clip".
function clipRange(w) {
  const r = w.recipe(), row = r && timelineLayout(r).rows[Math.min(w.stageIndex, r.stages.length - 1)];
  return row && row.end > row.start ? { start: row.start, end: row.end } : null;
}
function moveTo(w, ms) {
  w.studioTime = Math.max(0, Math.min(totalOf(w), Math.round(ms)));
  if (w.studioPlaying) pause(w);
  placePlayhead(w);
  queueSeek(w);
}

// ——— Rendering hooks ———
export function studioAfterRender(w) {
  if (!el(w, "")) return;
  w.studioTime = Math.min(w.studioTime ?? 0, totalOf(w));
  placePlayhead(w);
  syncTransport(w);
  requestAnimationFrame(() => drawLinks(w));
  if (w.previewMode === "recipe" && !w.busy) queueSeek(w);
  // An edit stops the running preview; playback picks up again where it was, with the edit in.
  if (w.studioPlaying && !w.previewRun && !w.busy) { w.studioPlaying = false; void togglePlay(w); }
}
// Link lines for the selected clip: what it starts with/after, and what follows it.
export function drawLinks(w) {
  const svg = el(w, "[data-st-links]"), tl = el(w, "[data-studio-tl]");
  if (!svg || !tl) return;
  const r = w.recipe(), i = Math.min(w.stageIndex, r.stages.length - 1), s = r.stages[i];
  const box = tl.getBoundingClientRect();
  svg.setAttribute("width", box.width); svg.setAttribute("height", box.height);
  const rect = (index) => { const b = tl.querySelector(`[data-tl-bar="${index}"]`)?.getBoundingClientRect(); return b && { l: b.left - box.left, r: b.right - box.left, y: b.top - box.top + b.height / 2 }; };
  const links = [];
  const add = (from, to, stage) => {
    const a = rect(from), b = rect(to);
    if (!a || !b) return;
    const withStart = stage.timingAnchor === "start";
    const edge = withStart ? a.l : a.r, x2 = b.l;
    const x1 = stage.timingAnchor === "end" || withStart ? Math.min(edge, Math.max(a.l, x2)) : Math.min(a.r, Math.max(a.l, x2));
    const dx = Math.max(10, Math.abs(x2 - x1) / 2);
    links.push(`<path class="${withStart ? "is-with" : "is-after"}" d="M${x1} ${a.y} C${x1 + dx} ${a.y} ${x2 - dx} ${b.y} ${x2} ${b.y}"/><circle cx="${x1}" cy="${a.y}" r="3"/><circle cx="${x2}" cy="${b.y}" r="3"/>`);
  };
  if (s?.afterStage) { const from = r.stages.findIndex((o) => o.stageId === s.afterStage); if (from >= 0) add(from, i, s); }
  r.stages.forEach((o, j) => { if (j !== i && o.afterStage && o.afterStage === s?.stageId) add(i, j, o); });
  svg.innerHTML = links.join("");
}
function applyZoom(w, zoom, anchorClientX) {
  const scroll = el(w, "[data-st-scroll]"), tl = el(w, "[data-studio-tl]");
  if (!scroll || !tl) return;
  zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round(zoom * 4) / 4));
  const view = scroll.getBoundingClientRect(), x = (anchorClientX ?? view.left + HEAD_WIDTH + (view.width - HEAD_WIDTH) / 2) - view.left;
  const trackWidth = () => tl.getBoundingClientRect().width - HEAD_WIDTH;
  const at = (scroll.scrollLeft + x - HEAD_WIDTH) / Math.max(1, trackWidth());
  w.studioZoom = zoom;
  scroll.style.setProperty("--st-zoom", zoom);
  const ruler = el(w, "[data-st-ruler]");
  if (ruler) ruler.innerHTML = rulerHTML(totalOf(w), zoom, view.width - HEAD_WIDTH);
  scroll.scrollLeft = Math.max(0, at * trackWidth() + HEAD_WIDTH - x);
  drawLinks(w);
}

// ——— Input ———
// The studio has no input of its own to handle (zoom is buttons and Ctrl+wheel).
export function studioInput() { return false; }
export function studioWheel(w, e) {
  const scroll = e.target.closest?.(".an-studio [data-st-scroll]");
  if (!scroll) return;
  if (e.ctrlKey || e.metaKey) { e.preventDefault(); applyZoom(w, (w.studioZoom ?? 1) * (e.deltaY < 0 ? 1.25 : 0.8), e.clientX); }
  else if (e.shiftKey) { e.preventDefault(); scroll.scrollLeft += e.deltaY; }
}
function closeMenu(w) { w.root.querySelector(".an-st-menu")?.remove(); }
// Right-click a recipe card in the list: open, duplicate or delete it in place.
function recipeCardMenu(w, e, card) {
  e.preventDefault();
  const id = card.dataset.id, r = w.listedRecipes?.().find((x) => x.id === id) ?? w.host.recipes().find((x) => x.id === id);
  if (!r) return;
  const menu = document.createElement("div");
  menu.className = "an-st-menu";
  menu.setAttribute("role", "menu");
  menu.innerHTML = `<b>${esc(r.name)}</b><button role="menuitem" data-action="recipe-menu-open" data-id="${esc(id)}">Open in Studio</button><button role="menuitem" data-action="recipe-menu-duplicate" data-id="${esc(id)}">Duplicate</button><button role="menuitem" class="is-danger" data-action="recipe-menu-delete" data-id="${esc(id)}">Delete…</button>`;
  w.root.append(menu);
  // Place it at the pointer, relative to whatever box it is positioned in.
  const box = (menu.offsetParent ?? document.body).getBoundingClientRect();
  menu.style.left = `${Math.max(0, Math.min(e.clientX - box.left, box.width - 220))}px`;
  menu.style.top = `${Math.max(0, Math.min(e.clientY - box.top, box.height - 150))}px`;
  menu.querySelector("button")?.focus();
}
export function studioContextMenu(w, e) {
  const bar = e.target.closest?.(".an-studio [data-tl-bar]");
  closeMenu(w);
  const card = !bar && e.target.closest?.('.an-card[data-action="select"][data-id]');
  if (card && !w.busy) return recipeCardMenu(w, e, card);
  if (!bar || w.busy) return;
  e.preventDefault();
  const i = Number(bar.dataset.tlBar), studio = el(w, ""), box = studio.getBoundingClientRect(), r = w.recipe();
  if (w.stageIndex !== i) { w.stageIndex = i; w.render(); }
  const menu = document.createElement("div");
  menu.className = "an-st-menu";
  menu.setAttribute("role", "menu");
  menu.style.left = `${Math.min(e.clientX - box.left, box.width - 210)}px`;
  menu.style.top = `${Math.min(e.clientY - box.top, box.height - 170)}px`;
  menu.innerHTML = `<b>${esc(w.stageLabel(r.stages[i]))}</b><button role="menuitem" data-action="studio-at-playhead" data-index="${i}">Start at playhead <kbd>${seconds(w.studioTime ?? 0)}</kbd></button><button role="menuitem" data-action="studio-dup-stage" data-index="${i}">Duplicate after it <kbd>Ctrl+D</kbd></button><button role="menuitem" data-action="studio-copy-stage" data-index="${i}">Copy <kbd>Ctrl+C</kbd></button><button role="menuitem" data-action="studio-paste-stage" data-index="${i}" ${w.stageClipboard ? "" : "disabled"}>Paste after it <kbd>Ctrl+V</kbd></button><button role="menuitem" data-action="studio-del-stage" data-index="${i}" ${r.stages.length < 2 ? "disabled" : ""}>Delete <kbd>Del</kbd></button>`;
  el(w, "").append(menu);
  menu.querySelector("button")?.focus();
}
// Pointer on the ruler or empty track space scrubs; the bottom splitter resizes.
export function studioPointer(w, e) {
  if (!e.target.closest?.(".an-st-menu")) closeMenu(w);
  if (e.button !== 0 || !e.target.closest?.(".an-studio")) return false;
  const dot = e.target.closest?.("[data-kf-dot]");
  if (dot && !w.busy) {
    // Dragging a keyframe dot moves that point; Shift snaps to whole squares.
    e.preventDefault();
    const canvas = dot.closest("[data-kf-canvas]"), svg = canvas.querySelector("svg"), [vx, vy, vw, vh] = canvas.dataset.kfView.split(" ").map(Number);
    const index = Number(dot.dataset.kfDot), stageIndex = w.stageIndex, recipeId = w.recipe()?.id;
    w.keyframeIndex = index; w.keyframeFocus = true;
    let last = null;
    const move = (ev) => { last = canvasToSquares(ev, svg.getBoundingClientRect(), { x: vx, y: vy, w: vw, h: vh }); last.whole = ev.shiftKey; dot.setAttribute("cx", last.x); dot.setAttribute("cy", last.y); };
    const up = (ev) => {
      dot.removeEventListener("pointermove", move); dot.removeEventListener("pointerup", up); dot.removeEventListener("pointercancel", up);
      // A cancelled drag commits nothing, and neither does one whose recipe or stage was swapped
      // out from under it (a guided tour putting the studio back mid-drag, finisher-tour.mjs).
      if (ev?.type === "pointercancel" || w.recipe()?.id !== recipeId || w.stageIndex !== stageIndex) last = null;
      // A click or a drag that snaps back to the same point is not an edit: no draft, no unsaved mark.
      const kfs = last ? normalizeKeyframes(w.recipe()?.stages[stageIndex]?.keyframes) : null;
      const next = kfs && moveKeyframePoint(kfs, index, last.x, last.y, last.whole);
      const s = next && (next[index]?.x !== kfs[index]?.x || next[index]?.y !== kfs[index]?.y) ? w.edit()?.stages[stageIndex] : null;
      if (s) { s.keyframes = next; w.message = "Keyframe moved. Save to apply."; }
      w.render();
    };
    dot.setPointerCapture?.(e.pointerId);
    dot.addEventListener("pointermove", move); dot.addEventListener("pointerup", up); dot.addEventListener("pointercancel", up);
    return true;
  }
  if (!e.target.closest?.("[data-kf-dot], [data-kf-diamond]")) w.keyframeFocus = false;
  const split = e.target.closest("[data-st-hsplit]");
  if (split) {
    e.preventDefault();
    const bottom = el(w, "").getBoundingClientRect().bottom;
    split.setPointerCapture?.(e.pointerId);
    split.classList.add("is-active");
    const move = (ev) => setTimelineHeight(w, bottom - ev.clientY);
    const up = () => { split.classList.remove("is-active"); split.removeEventListener("pointermove", move); split.removeEventListener("pointerup", up); split.removeEventListener("pointercancel", up); };
    split.addEventListener("pointermove", move); split.addEventListener("pointerup", up); split.addEventListener("pointercancel", up);
    return true;
  }
  const track = e.target.closest(".an-st-ruler, .an-st-tl .an-tl-track");
  // Clip drags and the random-variant tabs are not scrubs.
  if (!track || e.target.closest("[data-tl-bar], .an-tl-variant-tabs")) return false;
  e.preventDefault();
  if (w.previewMode !== "recipe") { w.previewMode = "recipe"; w.render(); }
  const scrub = (ev) => {
    const tl = el(w, "[data-studio-tl]"), lane = tl.querySelector(".an-st-ruler").getBoundingClientRect();
    moveTo(w, ((ev.clientX - lane.left) / Math.max(1, lane.width)) * totalOf(w));
  };
  const target = el(w, "[data-studio-tl]");
  target.setPointerCapture?.(e.pointerId);
  scrub(e);
  const up = () => { target.removeEventListener("pointermove", scrub); target.removeEventListener("pointerup", up); target.removeEventListener("pointercancel", up); };
  target.addEventListener("pointermove", scrub); target.addEventListener("pointerup", up); target.addEventListener("pointercancel", up);
  return true;
}
export function studioKey(w, e) {
  if (!e.target.closest?.(".an-studio")) return false;
  if (e.key === "Escape" && w.studioSettings && !el(w, ".an-st-menu")) { e.preventDefault(); e.stopPropagation(); w.studioSettings = false; w.render(); el(w, ".an-st-trigger")?.focus(); return true; }
  if (e.key === "Escape" && w.studioHelp) { e.preventDefault(); e.stopPropagation(); w.studioHelp = false; w.render(); return true; }
  if (e.key === "Escape" && el(w, ".an-st-menu")) { e.preventDefault(); e.stopPropagation(); closeMenu(w); el(w, `[data-tl-bar="${w.stageIndex}"]`)?.focus(); return true; }
  const ctrl = e.ctrlKey || e.metaKey;
  if (ctrl && e.key.toLowerCase() === "s") { e.preventDefault(); e.stopPropagation(); el(w, '[data-action="save"]:not(:disabled)')?.click(); return true; }
  if (e.target.matches("input, textarea, select, [contenteditable]") || e.target.closest(".an-st-menu, .an-st-settings")) return false;
  // Undo / redo anywhere in the studio outside a text field (the field keeps its own undo).
  const low = e.key.toLowerCase();
  if (ctrl && (low === "z" || low === "y")) { e.preventDefault(); e.stopPropagation(); w.history(low === "y" || e.shiftKey ? "redo" : "undo"); w.render(); return true; }
  if (e.target.closest(".an-inspector")) return false;
  const onBar = !!e.target.closest("[data-tl-bar]"), key = e.key;
  const stop = () => { e.preventDefault(); e.stopPropagation(); return true; };
  if (key === " " && !e.target.matches("button")) { stop(); void togglePlay(w); return true; }
  if (key === "Home") { moveTo(w, 0); return stop(); }
  if (key === "End") { moveTo(w, durationOf(w)); return stop(); }
  if (key.toLowerCase() === "l" && !ctrl && e.shiftKey) { w.studioLoopClip = !w.studioLoopClip; syncTransport(w); return stop(); }
  if (key.toLowerCase() === "l" && !ctrl) { w.studioLoop = !w.studioLoop; syncTransport(w); return stop(); }
  if ((key === "," || key === ".") && !ctrl) { moveTo(w, (w.studioTime ?? 0) + (key === "," ? -1 : 1) * (e.shiftKey ? 500 : 50)); return stop(); }
  if (!onBar && (key === "ArrowLeft" || key === "ArrowRight")) { moveTo(w, (w.studioTime ?? 0) + (key === "ArrowLeft" ? -1 : 1) * (e.shiftKey ? 500 : 50)); return stop(); }
  if (w.busy) return false;
  const i = onBar ? Number(e.target.closest("[data-tl-bar]").dataset.tlBar) : w.stageIndex;
  const selectedStage = w.recipe()?.stages[w.stageIndex];
  if ((key === "Delete" || key === "Backspace") && keyframeDeleteApplies({ keyframeFocus: w.keyframeFocus, isPath: selectedStage?.motion === "path", onBar, barIndex: i, stageIndex: w.stageIndex })) {
    // With a keyframe in focus, Delete removes that keyframe (never the first or last), not the stage.
    const kfs = normalizeKeyframes(selectedStage.keyframes);
    const ki = Math.max(0, Math.min(kfs.length - 1, w.keyframeIndex ?? 0));
    if (ki > 0 && ki < kfs.length - 1) { w.edit().stages[w.stageIndex].keyframes = deleteKeyframe(kfs, ki); w.keyframeIndex = ki - 1; w.message = "Keyframe deleted. Save to apply."; w.render(); }
    return stop();
  }
  if ((key === "Delete" || key === "Backspace") && (onBar || e.target.matches(".an-studio"))) { stop(); removeStage(w, i); return true; }
  if (ctrl && key.toLowerCase() === "d") { stop(); duplicateStage(w, i); return true; }
  if (ctrl && key.toLowerCase() === "c" && !window.getSelection?.()?.toString()) { stop(); copyStage(w, i); return true; }
  if (ctrl && key.toLowerCase() === "v") { stop(); pasteStage(w, i); return true; }
  return false;
}
// The stage clipboard: kept on the workspace, so a stage copied in one recipe pastes into another.
function copyStage(w, i) {
  const s = w.recipe()?.stages[i];
  if (!s) return;
  w.stageClipboard = clone(s);
  w.message = `Copied “${w.stageLabel(s)}”. Open any recipe and press Ctrl+V to paste it.`;
  w.render();
}
// Pastes after stage i, starting after it: a fresh stage with no links into the old recipe.
function pasteStage(w, i) {
  if (!w.stageClipboard) { w.message = "Nothing copied yet: select a stage and press Ctrl+C."; w.render(); return; }
  w.stopEditorPreview();
  const r = w.edit();
  if (!r || r.stages.length >= MAX_STAGES) return;
  const snapshot = clone(r.stages), source = r.stages[i];
  const copy = { ...clone(w.stageClipboard), stageId: uuid(), afterStage: "" };
  delete copy.startMode; delete copy.startRef; delete copy.variantGroup;
  if (r.lifecycle === "document") { if (!["aura", "tokenfx"].includes(copy.kind)) { w.message = "Lasting animations take only looping layers and token filters."; w.render(); return; } copy.persist = true; }
  else if (source) Object.assign(copy, { startMode: "after", startRef: source.stageId, startOffset: 0 });
  r.stages.splice(i + 1, 0, copy);
  w.stageIndex = i + 1;
  commit(w, r, snapshot, `Pasted “${w.stageLabel(copy)}”. Save recipe to apply.`);
}

// ——— Edits ———
function commit(w, r, snapshot, message) {
  linkStartModes(r.stages);
  try { timedStages(r, 0); w.message = message; }
  catch { r.stages = snapshot; w.message = "Those stages would wait on each other. Choose a stage that starts earlier."; }
  w.render();
  el(w, `[data-tl-bar="${w.stageIndex}"]`)?.focus();
}
function duplicateStage(w, i) {
  w.stopEditorPreview();
  const r = w.edit();
  if (!r || r.stages.length >= MAX_STAGES) return;
  const snapshot = clone(r.stages), source = r.stages[i];
  const copy = { ...clone(source), stageId: uuid(), label: source.label ? `${source.label} copy` : "" };
  if (r.lifecycle === "document") copy.afterStage = "";
  else Object.assign(copy, { startMode: "after", startRef: source.stageId, startOffset: 0 });
  r.stages.splice(i + 1, 0, copy);
  w.stageIndex = i + 1;
  commit(w, r, snapshot, "Stage duplicated. Save recipe to apply.");
}
function removeStage(w, i) {
  w.stopEditorPreview();
  const r = w.edit();
  if (!r || r.stages.length < 2) return;
  const snapshot = clone(r.stages), resolved = sampleRecipe(r).stages, removedId = r.stages[i].stageId;
  r.stages.forEach((stage, j) => {
    // Keep dependants where they played: freeze their start as a set time.
    if (stage.afterStage === removedId) { delete stage.startMode; delete stage.startRef; stage.afterStage = ""; stage.delay = Math.round(resolved[j].delay); }
  });
  r.stages.splice(i, 1);
  w.stageIndex = Math.max(0, Math.min(i, r.stages.length - 1));
  commit(w, r, snapshot, "Stage deleted. Save recipe to apply.");
}
// The stage a new one on this track should follow: flight after the last source cue, a target
// hit after the last flight (else the last source cue). Other tracks start at the playhead.
export function chainAnchor(stages, trackId) {
  const lastOn = (track) => [...stages].reverse().find((s) => trackOf(s) === track);
  if (trackId === "flight") return lastOn("caster") ?? null;
  if (trackId === "target") return lastOn("flight") ?? lastOn("caster") ?? null;
  return null;
}
function addStage(w, trackId) {
  const track = STUDIO_TRACKS.find((t) => t.id === trackId);
  w.stopEditorPreview();
  const r = w.edit();
  if (!r || !track || r.stages.length >= MAX_STAGES) return;
  const snapshot = clone(r.stages), linked = r.lifecycle === "document", last = r.stages.at(-1);
  const at = linked ? 0 : Math.round(w.studioTime ?? 0);
  const base = { ...clone(last), stageId: uuid(), label: "", afterStage: "", delay: at, tracks: [] };
  delete base.startMode; delete base.startRef;
  let stage;
  if (track.kind === "motion") stage = { ...base, kind: "motion", motion: "lunge", subject: "source", assets: [], duration: 800, distance: 0.35, intensity: 1, scale: 1, opacity: 1, below: false, persist: false };
  else if (track.kind === "sound") stage = { ...base, kind: "sound", assets: [], soundFile: "", volume: 0.8, duration: Math.max(500, last.duration ?? 1000) };
  else if (track.kind === "tokenfx") stage = { ...base, kind: "tokenfx", assets: [], subject: "source", fxLibrary: "tokenshade", fxPreset: "", persist: linked };
  else if (linked) stage = { ...base, kind: "aura", subject: "source", persist: true, assets: [...last.assets] };
  else stage = { ...base, kind: track.kind, subject: track.id === "target" ? "targets" : "source", assets: track.kind === "cast" ? ["jb2a.cast_generic"] : track.kind === "impact" ? ["jb2a.impact"] : [], duration: track.kind === "projectile" ? 800 : 1000 };
  // Choreography by default: with the playhead left at the start, a flight follows the cast and
  // a target hit follows the flight (or the cast), so the pieces play in order, not all at once.
  const follows = !linked && at === 0 ? chainAnchor(r.stages, trackId) : null;
  if (follows) Object.assign(stage, { startMode: "after", startRef: follows.stageId, startOffset: 0 });
  r.stages.push(stage);
  w.stageIndex = r.stages.length - 1;
  if (follows) { commit(w, r, snapshot, `${KINDS[stage.kind]} stage added after ${w.stageLabel(follows)}.${stage.assets.length || ["motion", "sound", "tokenfx"].includes(stage.kind) ? "" : " Choose its asset in the inspector."}`); return; }
  commit(w, r, snapshot, `${KINDS[stage.kind]} stage added at ${seconds(at)}.${stage.assets.length || ["motion", "sound", "tokenfx"].includes(stage.kind) ? "" : " Choose its asset in the inspector."}`);
}
export async function studioAction(w, action, b) {
  switch (action) {
    case "studio-close": w.studio = false; w.render(); return true;
    case "studio-play": await togglePlay(w); return true;
    case "studio-stop": pause(w); moveTo(w, 0); return true;
    case "studio-home": moveTo(w, 0); return true;
    case "studio-end": moveTo(w, durationOf(w)); return true;
    case "studio-loop": w.studioLoop = !w.studioLoop; syncTransport(w); return true;
    case "studio-mute":
    case "studio-solo": {
      const key = action === "studio-mute" ? "studioMuted" : "studioSolo", id = b.dataset.stTrack;
      w[key] ??= new Set();
      if (w[key].has(id)) w[key].delete(id); else w[key].add(id);
      const off = silenced(w);
      for (const track of w.root.querySelectorAll(".an-studio .an-st-track")) track.classList.toggle("is-muted", off.has(track.dataset.stTrack));
      b.classList.toggle("is-on", w[key].has(id));
      b.setAttribute("aria-pressed", String(w[key].has(id)));
      const run = ensureRun(w);
      run?.setMuted(mutedStages(w));
      if (!w.studioPlaying) queueSeek(w);
      return true;
    }
    case "studio-more": w.studioMoreTracks = !w.studioMoreTracks; w.render(); return true;
    case "studio-zoom-in": applyZoom(w, (w.studioZoom ?? 1) * 1.5); return true;
    case "studio-zoom-out": applyZoom(w, (w.studioZoom ?? 1) / 1.5); return true;
    case "studio-undo": case "studio-redo": w.history(action === "studio-undo" ? "undo" : "redo"); w.render(); return true;
    case "studio-loop-clip": w.studioLoopClip = !w.studioLoopClip; syncTransport(w); if (w.studioLoopClip && !w.studioPlaying) void togglePlay(w); return true;
    case "studio-help": w.studioHelp = !w.studioHelp; w.render(); return true;
    case "studio-settings": w.studioSettings = !w.studioSettings; w.render(); if (w.studioSettings) el(w, ".an-st-settings input, .an-st-settings select, .an-st-settings textarea")?.focus({ preventScroll: true }); else el(w, ".an-st-trigger")?.focus(); return true;
    case "studio-fit": applyZoom(w, 1); el(w, "[data-st-scroll]").scrollLeft = 0; return true;
    case "studio-add": addStage(w, b.dataset.stTrack); return true;
    case "studio-dup-stage": closeMenu(w); duplicateStage(w, Number(b.dataset.index)); return true;
    case "studio-copy-stage": closeMenu(w); copyStage(w, Number(b.dataset.index)); return true;
    case "studio-paste-stage": closeMenu(w); pasteStage(w, Number(b.dataset.index)); return true;
    case "studio-del-stage": closeMenu(w); removeStage(w, Number(b.dataset.index)); return true;
    case "studio-at-playhead": closeMenu(w); w.stageIndex = Number(b.dataset.index); w.applyTimelineEdit(w.stageIndex, { ms: w.studioTime ?? 0 }); return true;
    default: return false;
  }
}
