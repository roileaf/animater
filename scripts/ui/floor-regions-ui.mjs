// Experimental water proposals. The form, the create plan and the image read are pure and exported.
// The window takes what it needs as options. Nothing here runs until a GM clicks the Regions tool.

import { detectWater, selectColourAt, areaPixels, mergeAreaProposals, fitSize, toRegionData, editableFloorRegionIds, areaProposalFromLoops, WATER_TUNING, AREA_FLOORS, floorName, floorColour, isAreaFloor } from "../engines/regions/floor-detect.mjs";
import { WATER_KINDS, WATER_TOWARD, flowChoices, waterFlows, waterKindOf, caveKindFlags, TEXTURE_STYLES, STEP_EDGE, stepEdge, stepListOf, stepIndexOf, changeStep } from "../engines/motion/region-steps.mjs";
import { outlinePoint, hitOutline, changeVertex, validateOutline, smoothOutline, unionOutlines, subtractOutlines } from "../engines/regions/area-outline.mjs";
import { sizeOrder, startSize, boxPoints, nearbyClicks, consensus, cutStart, cutFrom, solidCut, spotAt, sliverAt, smallSpots, maskPieces, cleanSelection, nextAreaId, smartProposal, keepToColours, colourCut } from "../engines/regions/smart-select.mjs";
import { SMART_MODEL, loadSmartModel, isSmartModelCached } from "./smart-model.mjs";
import { areaSignature, rememberAreas, recallFloor, memoryOf, markAreas, knowsFloors, NONE_FLOOR } from "../engines/regions/floor-memory.mjs";

// Asked once per page, before the first smart mark downloads anything.
export const SMART_CONSENT = `Experimental. Smart selection uses ${SMART_MODEL.name}, a segmentation model that runs in this browser. The first time, it downloads about ${SMART_MODEL.size} from huggingface.co (and its library from cdn.jsdelivr.net); after that it loads from this browser's cache. The map is read on this computer and is not sent anywhere. Download it now?`;
const SMART_HELP = "Click a floor · Shift+drag a box · Right-click to cut out · 1–3 resize · Ctrl+Z undo";
const SIZE_NAMES = ["Small", "Middle", "Large"];
// Which of the model's three sizes (0 small, 1 middle, 2 large) `mask` is: the same mask, else the size nearest in area.
export function sizeOf(masks, mask) {
  if (!masks?.length || !mask) return null;
  const order = sizeOrder(masks), exact = order.findIndex((i) => masks[i] === mask);
  if (exact >= 0) return exact;
  const area = (m) => { let n = 0; for (let i = 0; i < m.length; i++) n += m[i] ? 1 : 0; return n; };
  const want = area(mask), sizes = order.map((i) => Math.abs(area(masks[i]) - want));
  return sizes.indexOf(Math.min(...sizes));
}
const COLOUR_HELP = "Click to follow a colour · Right-click a stray spot to remove it · Ctrl+Z undo";
// The status line is kept short; its tooltip says it in full.
const HELP_TIPS = {
  [SMART_HELP]: "Click a floor to add it. Shift+drag a box around a room. Right-click to cut out a bush, stray spot or thin finger. 1–3 (or the Size buttons at the bottom right) switch the last one between the model's small, middle and large versions. Click a part you cut out to put it back. Ctrl+Z undoes.",
  [COLOUR_HELP]: "Click to follow a colour, best on water and strong colours. Right-click a stray spot or thin finger to remove it. Click a part you cut out to put it back. Ctrl+Z undoes.",
};
const helpTip = (text) => HELP_TIPS[text] ?? text;
const COLOUR_ON_DULL = "Colour can't follow grey or brown floors like stone, wood, dirt or snow. Switch to Smart for those.";
const DULL_FLOORS = new Set(["stone", "pebbles", "wood", "dirt", "sand", "snow", "ice", "mud", "glass", "metal"]);
export const toolStatus = (selection, floor) => (selection === "smart" ? SMART_HELP : DULL_FLOORS.has(floor) ? COLOUR_ON_DULL : COLOUR_HELP);

// The GM's last floor and selection, kept per browser as a convenience. Storage can be missing or blocked.
const PREFS_KEY = "animater.floorRegions";
function readPrefs() { try { return JSON.parse(globalThis.localStorage?.getItem(PREFS_KEY) ?? "{}") ?? {}; } catch { return {}; } }
function writePrefs(change) { try { globalThis.localStorage?.setItem(PREFS_KEY, JSON.stringify({ ...readPrefs(), ...change })); } catch { /* storage unavailable */ } }

export const FLOW_OPTIONS = Object.freeze(flowChoices());
export const FLOOR_OPTIONS = Object.freeze(AREA_FLOORS.map((floor) => [floor, floorName(floor)]));
// Auto: a new area takes the floor of the saved regions it looks like (floor-memory.mjs), else water.
export const AUTO_FLOOR = "auto";
const KEEP_COLOURS_TIP = "Smart selection keeps to the colours around your click: a chair, rug or bush of another colour standing on the floor is left out as a hole. Turn off for a floor of many colours.";
const AUTO_TIP = "Auto: the floor of the regions you saved that look most like it, on any scene. Water when nothing looks alike yet. Gets better with every region you save.";
const AUTO_SWATCH = "conic-gradient(#2c7da0 0 25%, #8a6a45 0 50%, #5f8f3e 0 75%, #8d8d8d 0)";
const pickable = (floor) => floor === AUTO_FLOOR || isAreaFloor(floor);
const pickName = (floor) => floor === AUTO_FLOOR ? "Auto" : floorName(floor);
const pickColour = (floor) => floor === AUTO_FLOOR ? AUTO_SWATCH : floorColour(floor);
const LEARNED_NOTE = "learned";
const WATER_KEYS = ["waterKind", "flowTo", "current", "waveTo", "seaBeach"];
// What can be built out over water (a deck, a jetty, a bridge): anything to stand on, never water or lava itself.
export const canStandOverWater = (floor) => !!floor && !["water", "lava", "cavern"].includes(floor);
const OVER_WATER_TIP = "Built out over water: a deck, a jetty, a bridge. The water goes on under it; what walks here walks on its boards.";
// Whether a region paints its floor's texture over the map: as the scene's setting says, always, or never.
export const TEXTURE_OPTIONS = Object.freeze([["", "As the scene says"], ["on", "Paint it"], ["off", "Don't paint it"]]);
const textureOf = (value) => (value === "on" || value === "off" ? value : "");
const sceneTextureNote = (scene) => (scene === "on" ? " (paint)" : " (don't paint)");
const textureOptions = (scene) => TEXTURE_OPTIONS.map(([key, label]) => [key, key ? label : label + sceneTextureNote(scene)]);
// How a painted floor looks: its pattern (one of the floor's texture styles) and how soft its edge is, in squares.
// "" keeps the floor's usual pattern and the usual edge; an edge of 0 is a hard edge on the region's line.
export const patternOptions = (floor) => TEXTURE_STYLES[floor] ?? [];
// A region's steps, as the region panel offers them: the saved region's own list while it keeps its floor, else the floor's
// presets. Each option is the step's place in that list. `own`: the saved region's step flags, or none for a new area.
const stepOwn = (own, floor) => ({ ...(own ?? {}), floor });
export const stepOptions = (floor, own = null) => stepListOf(stepOwn(own, floor), floor).map((s, i) => [String(i), s.name]);
export const stepStart = (floor, own = null) => String(stepIndexOf(stepOwn(own, floor), floor));
// The flags to save for step `index`, or null where it is the step the area stands at anyway (nothing to write).
export function stepPatch(floor, index, own = null) {
  if (index === "" || index === undefined || index === null || !stepOptions(floor, own).length) return null;
  const i = Number(index);
  if (!Number.isInteger(i) || String(i) === stepStart(floor, own)) return null;
  return changeStep(stepOwn(own, floor), floor, i);
}
const STEP_TIP = "The state this floor starts in: fresh, bloodied, burnt and so on. The same steps as the region's right-click menu, changed in play there.";
const patternOf = (floor, pattern) => { const styles = patternOptions(floor); return styles.some(([key]) => key === pattern) ? pattern : styles[0]?.[0] ?? ""; };
const edgeOf = (edge) => { const n = edge === "" || edge === undefined || edge === null ? NaN : Number(edge); return Number.isFinite(n) ? Math.min(STEP_EDGE.max, Math.max(0, n)) : STEP_EDGE.usual; };
// Whether an area will paint its floor's texture: its own choice, else the scene's. Lava never does.
export const paintsTexture = (floor, texture, sceneTexture) => floor !== "lava" && (texture === "on" || (texture !== "off" && sceneTexture === "on"));
export const CURRENT_OPTIONS = Object.freeze([
  ["", "Gentle"],
  ["swift", "Swift"],
]);
export const WAVE_OPTIONS = Object.freeze([["", "With the wind"], ...WATER_TOWARD]);

const NONE = Object.freeze({
  "no-candidates": "Experimental. No blue water was found on this map.",
  "no-saturated-colour": "Experimental. The blue on this map is too grey to be water. Roofs and stone look like that.",
  "nothing-left": "Experimental. Only a little strong blue was found, too little to tell water from anything else. A thin river can read this way, so click it if you see one.",
});

const CLICK_NONE = Object.freeze({
  "no-colour": "Experimental. That spot has no clear colour to follow. Click on the floor itself, or switch to Smart.",
  "too-small": "Experimental. That patch is too small to be a region. Click somewhere wider.",
  "already-water": "Experimental. That spot is already in the list.",
});

// A stalled server would otherwise hold the tool for as long as the browser keeps the request open.
const LOAD_TIMEOUT_MS = 60000;

const FAILURES = Object.freeze({
  timeout: "Experimental. The map image took too long to load. Click the tool to try again.",
  video: "Experimental. This background is a video, so its floors cannot be read.",
  "unsupported-format": "Experimental. This background's image format cannot be read. Use a PNG, WebP or JPEG map.",
  tainted: "Experimental. The map image could not be read. It may come from another site.",
  fetch: "Experimental. The map image could not be loaded.",
});


const esc = (text) => String(text).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

export function noneMessage(reason) {
  return NONE[reason] ?? "Experimental. No water region was proposed.";
}

export function failureMessage(reason) {
  return FAILURES[reason] ?? FAILURES.fetch;
}

export function clickMessage(reason) {
  return CLICK_NONE[reason];
}

// Foundry can move, scale and rotate a level's background. The shapes come from the image, so they would land in the wrong place.
export function levelMapIsPlain(textures) {
  const { fit = "fill", offsetX = 0, offsetY = 0, scaleX = 1, scaleY = 1, rotation = 0, anchorX = 0.5, anchorY = 0.5 } = textures ?? {};
  return fit === "fill" && offsetX === 0 && offsetY === 0 && scaleX === 1 && scaleY === 1 && rotation === 0 && anchorX === 0.5 && anchorY === 0.5;
}

// The canvas is scaled by CSS, so a click is mapped through its drawn box.
export function previewPixel({ clientX, clientY }, rect, width, height) {
  return {
    x: Math.min(width - 1, Math.max(0, Math.floor(((clientX - rect.left) / rect.width) * width))),
    y: Math.min(height - 1, Math.max(0, Math.floor(((clientY - rect.top) / rect.height) * height))),
  };
}

function sourceKind(src, type = "") {
  const mime = String(type).toLowerCase();
  const path = String(src ?? "").split(/[?#]/)[0].toLowerCase();
  if (mime.startsWith("video/") || /\.(?:webm|mp4|m4v)$/.test(path)) return "video";
  if (mime.startsWith("image/svg") || path.endsWith(".svg")) return "unsupported-format";
  return null;
}

// The scene's size sets the read size, so one decode is enough and no natural-size read is needed. The map fills
// the scene rectangle, so the pixels keep their mapping to scene coordinates even when the art's own ratio differs.
export async function loadMapRgba(src, size, deps = {}) {
  const signal = AbortSignal.any([deps.signal, AbortSignal.timeout(deps.timeoutMs ?? LOAD_TIMEOUT_MS)].filter(Boolean));
  const fetchImpl = deps.fetch ?? globalThis.fetch?.bind(globalThis);
  const createBitmap = deps.createImageBitmap ?? globalThis.createImageBitmap?.bind(globalThis);
  const Canvas = deps.OffscreenCanvas ?? globalThis.OffscreenCanvas;
  try {
    const named = sourceKind(src);
    if (named) return { ok: false, reason: named };
    const response = await fetchImpl(src, { signal });
    if (!response || response.ok === false) return { ok: false, reason: "fetch" };
    const blob = await response.blob();
    const typed = sourceKind(src, blob?.type);
    if (typed) return { ok: false, reason: typed };
    const bitmap = await createBitmap(blob, { resizeWidth: size.width, resizeHeight: size.height, resizeQuality: "medium" });
    try {
      const width = bitmap.width;
      const height = bitmap.height;
      const canvas = new Canvas(width, height);
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(bitmap, 0, 0);
      let image;
      try { image = ctx.getImageData(0, 0, width, height); }
      catch (error) { return { ok: false, reason: error?.name === "SecurityError" ? "tainted" : "fetch" }; }
      return { ok: true, rgba: image.data, width, height };
    } finally {
      bitmap?.close?.();
    }
  } catch (error) {
    if (error?.name === "TimeoutError") return { ok: false, reason: "timeout" };
    return { ok: false, reason: error?.name === "SecurityError" ? "tainted" : "fetch" };
  }
}

// The map as the window shows it: sharper than the read (which is small, for speed), up to VIEW_MAX on its long side
// and never above the art's own size, stretched to the read's shape like the read. Loaded after the window opens,
// from the browser's cache; null when it cannot be made, and the window keeps showing the read.
export const VIEW_MAX = 4096;
export async function loadMapView(src, size, deps = {}) {
  const fetchImpl = deps.fetch ?? globalThis.fetch?.bind(globalThis);
  const createBitmap = deps.createImageBitmap ?? globalThis.createImageBitmap?.bind(globalThis);
  if (!fetchImpl || !createBitmap || sourceKind(src)) return null;
  let full;
  try {
    const response = await fetchImpl(src, { signal: deps.signal });
    if (!response || response.ok === false) return null;
    full = await createBitmap(await response.blob());
    const scale = Math.max(1, Math.min(VIEW_MAX, Math.max(full.width, full.height)) / Math.max(size.width, size.height));
    return await createBitmap(full, { resizeWidth: Math.round(size.width * scale), resizeHeight: Math.round(size.height * scale), resizeQuality: "high" });
  } catch {
    return null;
  } finally {
    full?.close?.();
  }
}

function percent(share) {
  const value = share * 100;
  return `${value.toFixed(value >= 10 ? 1 : 2)}%`;
}

function optionsHTML(options, attr, selected = "") {
  return `<select ${attr}>${options.map(([value, label]) => `<option value="${esc(value)}"${value === selected ? " selected" : ""}>${esc(label)}</option>`).join("")}</select>`;
}

function flowDefault(kind, flowTo) {
  if (!waterFlows(kind)) return "";
  return flowTo || "s";
}

function currentDefault(kind, current) {
  if (kind === "rapids" || kind === "falls") return "swift";
  if (!waterFlows(kind)) return "";
  return current ?? "";
}

// One line for a water area's settings while they are folded away: "River · gentle · toward south".
const labelOf = (options, value) => options.find(([key]) => key === value)?.[1] ?? "";
export function waterSummary(kind, flowTo, current, waveTo) {
  const parts = [labelOf(WATER_KINDS, kind) || "Water"];
  if (kind === "river") parts.push(labelOf(CURRENT_OPTIONS, current).toLowerCase() || "gentle");
  if (waterFlows(kind)) { const way = labelOf(FLOW_OPTIONS, flowTo).toLowerCase() || "south"; parts.push(/^follows/.test(way) ? way : `toward ${way}`); }
  if (kind === "sea" && waveTo) parts.push(`waves ${labelOf(WAVE_OPTIONS, waveTo).toLowerCase()}`);
  return parts.join(" · ");
}

// What the save button says: how many new regions it creates and how many saved ones it rewrites.
export function saveLabel(proposals, checkedIds, saving = false) {
  const ticked = proposals.filter((p) => checkedIds.has(p.id));
  const fresh = ticked.filter((p) => !p.regionId).length, changed = ticked.length - fresh;
  if (saving) return "Saving regions…";
  if (!proposals.some((p) => p.regionId)) return `Create ${fresh} region${fresh === 1 ? "" : "s"}`;
  if (!ticked.length) return "Save 0 regions";
  return ["Save", [fresh ? `${fresh} new` : "", changed ? `${changed} updated` : ""].filter(Boolean).join(" · ")].join(" ");
}

// The status line under an area's name: saved or new, whether it will be written, and what it is.
export function rowMeta({ saved, checked, floor, kind, overWater = false, learned = false }) {
  const state = saved ? (checked ? "Saved · will update" : "Saved") : (checked ? "New" : "New · not saved");
  return [state, floorName(floor), floor === "water" ? labelOf(WATER_KINDS, kind) : "", overWater && canStandOverWater(floor) ? "over water" : "", learned && !saved ? LEARNED_NOTE : ""].filter(Boolean).join(" · ");
}

export function areaRowHTML(proposal, options = {}) {
  const { checked = proposal.preselected, waterKind = "still", flowTo = "", current = "", waveTo = "", seaBeach = "", texture = "", sceneTexture = "", pattern = "", edge = "", overWater = false, step = "", stepsOwn = null, floor: chosen } = { ...proposal.savedChoices, ...options };
  const floor = isAreaFloor(chosen) ? chosen : isAreaFloor(proposal.floor) ? proposal.floor : "water", water = floor === "water";
  const id = esc(proposal.id), saved = !!proposal.regionId;
  const num = esc(String(proposal.id).replace("area-", ""));
  const soft = edgeOf(edge);
  const name = saved ? esc(proposal.name) : `Area ${num}`;
  const kind = WATER_KINDS.some(([key]) => key === waterKind) ? waterKind : "still";
  const flows = waterFlows(kind);
  const flow = flowDefault(kind, flowTo);
  const cur = currentDefault(kind, current);
  const shade = options.shade ?? floorColour(floor);
  const warning = proposal.clicked && proposal.share > WATER_TUNING.clickWarnShare
    ? `<p class="an-floors-warn">${percent(proposal.share)} of the map. Is this all ${esc(floorName(floor).toLowerCase())}?</p>` : "";
  const over = overWater === true && canStandOverWater(floor);
  const steps = stepOptions(floor, stepsOwn), stepNow = steps.some(([key]) => key === String(step)) ? String(step) : stepStart(floor, stepsOwn);
  const badge = `<b class="an-area-num an-floor-swatch" style="--swatch:${shade}">${num}</b>`;
  // The line: tick (save it or not), the number from the map, the name with its status, the size. Everything else is in
  // the inspector, which shows only for the selected area. The water fields show only on a water area.
  const learned = !saved && proposal.learned === true;
  return `<div class="an-floors-row" data-id="${id}" data-scene-texture="${esc(sceneTexture)}"${learned ? ` data-learned title="Floor and look learned from the regions you saved that look like this one"` : ""}>
  <label class="an-floors-pick" title="${saved ? `Tick to save changes to ${name}` : `Tick to create ${name} as a region`}"><input type="checkbox" data-pick="${id}"${checked ? " checked" : ""} aria-label="Include ${name} in save"></label>
  ${badge}
  <span class="an-row-name"><strong>${saved ? name : floorName(floor)}</strong><span data-row-meta><i class="an-dot${saved ? " is-saved" : ""}"></i>${esc(rowMeta({ saved, checked, floor, kind, overWater: over, learned }))}</span></span>
  <span class="an-floors-share" title="${proposal.vertices} vertices">${percent(proposal.share)}</span>
  <div class="an-inspector" data-inspector>
    <div class="an-insp-head">${badge}<div><strong>${saved ? name : `${floorName(floor)} · area ${num}`}</strong><span>${saved ? "Saved region" : "New area"} · ${percent(proposal.share)} of the map</span></div></div>
    ${warning}<div class="an-insp-fields">
      <label>Floor ${optionsHTML(FLOOR_OPTIONS, `data-floor="${id}"`, floor)}</label>
      <label data-step-field title="${STEP_TIP}"${steps.length ? "" : " hidden"}>Step <select data-step="${id}" data-floor-of="${esc(floor)}"${stepsOwn ? ` data-steps-own="${esc(JSON.stringify(stepsOwn))}"` : ""}>${steps.map(([key, label]) => `<option value="${key}"${key === stepNow ? " selected" : ""}>${esc(label)}</option>`).join("")}</select></label>
      <label class="an-insp-check" data-over-water-field title="${OVER_WATER_TIP}"${canStandOverWater(floor) ? "" : " hidden"}><input type="checkbox" data-over-water="${id}"${over ? " checked" : ""}> Over water</label>
      <div class="an-water-fields" data-water-fields${water ? "" : " hidden"}>
        <label data-water-field>Kind ${optionsHTML(WATER_KINDS, `data-kind="${id}"`, kind)}</label>
        <label data-flow-field${flows ? "" : " hidden"}>Flows ${optionsHTML(FLOW_OPTIONS, `data-flow="${id}"`, flow || "s")}</label>
        <label data-current-field${kind === "river" ? "" : " hidden"}>Current ${optionsHTML(CURRENT_OPTIONS, `data-current="${id}"`, cur)}</label>
        <label data-sea-field${kind === "sea" ? "" : " hidden"}>Waves toward ${optionsHTML(WAVE_OPTIONS, `data-wave="${id}"`, waveTo)}</label>
        <label data-sea-field class="an-water-beach"${kind === "sea" ? "" : " hidden"}><input type="checkbox" data-beach="${id}"${seaBeach === "off" ? "" : " checked"}> Beach along the shore</label>
      </div>
      <label class="an-insp-wide" title="Whether this region paints its floor's texture over the map. Don't paint suits a map that is already painted.">Floor texture ${optionsHTML(textureOptions(sceneTexture), `data-texture="${id}"`, textureOf(texture))}</label>
      <div class="an-texture-fields" data-texture-fields${paintsTexture(floor, textureOf(texture), sceneTexture) ? "" : " hidden"}>
        <label title="The floor's pattern, as the map preview shows it">Pattern ${optionsHTML(patternOptions(floor), `data-pattern="${id}"`, patternOf(floor, pattern))}</label>
        <label title="How far the texture fades out past the region's line, in squares. 0 is a hard edge.">Soft edge <span class="an-range"><input type="range" min="0" max="${STEP_EDGE.max}" step="0.1" value="${soft}" data-edge="${id}"><output data-edge-value>${soft ? soft.toFixed(1) : "Hard"}</output></span></label>
      </div>
    </div>
    <div class="an-insp-tools">
      <button type="button" class="an-floors-add" data-add-to="${id}" aria-pressed="false" title="Click more of this floor on the map to add it to this area"><i class="fa-solid fa-plus" inert></i> Add to</button>
      <button type="button" class="an-floors-edit" data-edit-outline="${id}" aria-pressed="false" title="Drag the outline's handles"><i class="fa-solid fa-pen-nib" inert></i> Outline</button>
      <button type="button" class="an-floors-split" data-split="${id}" aria-pressed="false" title="Draw around part of this area on the map to make it its own area, for example a waterfall in a river"><i class="fa-solid fa-scissors" inert></i> Split</button>
      <button type="button" class="an-floors-tidy" data-tidy="${id}" title="Remove small spots: drops the small separate pieces of this area. Or right-click one on the map."><i class="fa-solid fa-broom" inert></i> Tidy</button>
      <button type="button" class="an-floors-remove" data-remove="${id}" title="${saved ? "Leave unchanged" : "Remove"}" aria-label="${saved ? "Leave unchanged" : "Remove"}"><i class="fa-solid ${saved ? "fa-rotate-left" : "fa-trash"}" inert></i></button>
    </div>
  </div>
</div>`;
}

// The list: saved regions first, then new areas, each under its heading. `optionsFor(proposal)` gives a row its choices.
// Each row gets its own shade of its floor's colour, the same one the map paints it in.
export function areaListHTML(proposals, optionsFor, floorOf) {
  const perFloor = new Map(), shades = new Map();
  for (const p of proposals) { const f = floorOf(p), k = perFloor.get(f) ?? 0; perFloor.set(f, k + 1); shades.set(p.id, areaShade(floorColour(f), k)); }
  const group = (title, list) => list.length ? `<div class="an-list-group">${title}</div>${list.map((p) => areaRowHTML(p, { ...optionsFor(p), shade: shades.get(p.id) })).join("")}` : "";
  return group("On this scene", proposals.filter((p) => p.regionId)) + group("New", proposals.filter((p) => !p.regionId));
}

// The Mark areas button's tip: what it does, or why there is nothing to mark from yet. `learned`: floor examples kept.
export const markTip = (learned) => learned > 0
  ? `Mark the areas on this map that look like the ${learned} region${learned === 1 ? "" : "s"} you saved, of any floor. Untick or remove a wrong one before saving and it won't be marked again.`
  : "Nothing learned yet: save some floor regions (here or on another scene) and this marks the areas that look like them. It also runs by itself when the window opens.";
export function floorWindowHTML({ proposals, width, height, reason = "", picked = [], shared = {}, sceneTexture = "", learned = 0 }) {
  const rows = [...proposals].sort((a, b) => b.share - a.share || String(a.id).localeCompare(String(b.id)));
  const choices = new Map(picked.map((choice) => [choice.id, choice]));
  const selected = rows.filter((proposal) => choices.get(proposal.id)?.checked ?? proposal.preselected).length;
  const prefs = readPrefs();
  const addFloor = pickable(shared.addFloor) ? shared.addFloor : pickable(prefs.addFloor) ? prefs.addFloor : AUTO_FLOOR;
  const selection = shared.selection ?? (prefs.selection === "smart" ? "smart" : "colour");
  const floorOf = (p) => { const f = choices.get(p.id)?.floor ?? p.savedChoices?.floor ?? p.floor; return isAreaFloor(f) ? f : "water"; };
  const anyWater = rows.some((p) => floorOf(p) === "water" && (choices.get(p.id)?.checked ?? p.preselected));
  const radio = (name, value, attr, on, body, title = "") => `<label class="an-chip"${title ? ` title="${esc(title)}"` : ""}><input type="radio" name="${name}" value="${value}" ${attr}${on ? " checked" : ""}>${body}</label>`;
  const optionsFor = (proposal) => ({ sceneTexture, ...(proposal.regionId ? {} : { texture: textureOf(shared.texture) }), ...choices.get(proposal.id) });
  const ticked = new Set(rows.filter((p) => choices.get(p.id)?.checked ?? p.preselected).map((p) => p.id));
  return `<div class="an-floors">
  <div class="an-floors-workspace">
    <section class="an-floors-map" aria-label="Map preview">
      <div class="an-floors-toolbar an-floors-tools">
        <div class="an-tool-switch" role="radiogroup" aria-label="Selection">
          ${radio("an-select-mode", "smart", "data-select-mode-option", selection === "smart", `<i class="fa-solid fa-wand-magic-sparkles"></i><span>Smart</span>`, `${SMART_MODEL.name}: traces any floor from its shape and texture. ${SMART_MODEL.size}, downloaded once after you agree.`)}
          ${radio("an-select-mode", "colour", "data-select-mode-option", selection !== "smart", `<i class="fa-solid fa-eye-dropper"></i><span>Colour</span>`, "Follows the clicked colour. Fast, no download. Best on water.")}
        </div>
        <span class="an-tool-divider"></span>
        <div class="an-floor-picker" data-floor-picker>
          <span class="an-tool-label">Floor</span>
          <button type="button" class="an-floor-current" data-floor-toggle aria-haspopup="true" aria-expanded="false" title="The floor your next click adds"><i class="an-floor-swatch" data-floor-current-swatch style="--swatch:${pickColour(addFloor)}"></i><span data-floor-current-name>${esc(pickName(addFloor))}</span><i class="fa-solid fa-chevron-down an-chev"></i></button>
          <div class="an-floor-pop an-floor-bar" role="radiogroup" aria-label="Floor to add" data-floor-pop hidden>${radio("an-add-floor", AUTO_FLOOR, "data-add-floor-option", addFloor === AUTO_FLOOR, `<i class="an-floor-swatch" style="--swatch:${AUTO_SWATCH}"></i><span>Auto</span>`, AUTO_TIP)}${FLOOR_OPTIONS.map(([floor, name]) => radio("an-add-floor", floor, "data-add-floor-option", floor === addFloor, `<i class="an-floor-swatch" style="--swatch:${floorColour(floor)}"></i><span>${name}</span>`, `Add ${name.toLowerCase()}`)).join("")}</div>
        </div>
        <label class="an-keep-colours" data-smart-only${selection === "smart" ? "" : " hidden"} title="${esc(KEEP_COLOURS_TIP)}"><input type="checkbox" data-keep-colours${prefs.keepColours === false ? "" : " checked"}> Same colours</label>
        <label class="an-colour-range" data-colour-only${selection === "smart" ? " hidden" : ""} title="Wide can join touching grass, banks or other similar colours"><span class="an-tool-label">Range</span> ${optionsHTML([["narrow", "Narrow"], ["wide", "Wide"]], "data-click-range", shared.range ?? "narrow")}</label>
        <span class="an-tool-divider"></span>
        <button type="button" class="an-mark-button" data-auto-mark title="${esc(markTip(learned))}" aria-disabled="${learned > 0 ? "false" : "true"}"><i class="fa-solid fa-layer-group" inert></i><span>Mark areas</span></button>
        <button type="button" class="an-icon-button" data-undo-toolbar title="Undo the last change (Ctrl+Z)" aria-label="Undo" disabled><i class="fa-solid fa-rotate-left" inert></i></button>
        <span class="an-tool-grow"></span>
        <div class="an-floors-zoom" title="Or scroll over the map to zoom. Drag or middle-drag to pan.">
          <button type="button" data-zoom="out" aria-label="Zoom out">−</button><output data-zoom-label aria-live="polite">Fit</output><button type="button" data-zoom="in" aria-label="Zoom in">+</button><button type="button" class="an-zoom-fit" data-zoom="fit">Fit</button>
        </div>
      </div>
      <div class="an-floors-canvas">
        <div class="an-floors-frame" tabindex="0" aria-label="Map preview. Scroll to zoom. Drag or middle-drag to pan. Click to add an area."><div class="an-floors-stage"><canvas class="an-floors-preview" width="${width}" height="${height}"></canvas></div></div>
        <div class="an-floors-add-status" data-add-status hidden><p data-add-message></p><div>
          <button type="button" data-undo-add disabled>Undo</button>
          <button type="button" data-smooth-outline title="Smooth outer shores within 2 read pixels per action. Holes stay unchanged." hidden>Smooth shore</button>
          <button type="button" data-delete-vertex hidden>Delete vertex</button>
          <button type="button" class="an-primary" data-add-done>Done</button>
        </div></div>
        <div class="an-size-pick" data-size-pick role="group" aria-label="Size of the last smart area" hidden><span class="an-tool-label">Size</span>${SIZE_NAMES.map((name, i) => `<button type="button" data-size="${i}" aria-pressed="false" title="${name}: the model's ${name.toLowerCase()} version of the last area or cut (key ${i + 1})"><b>${i + 1}</b> ${name}</button>`).join("")}</div>
        <p class="an-floors-status" data-smart-status aria-live="polite" title="${esc(helpTip(toolStatus(selection, addFloor)))}">${esc(toolStatus(selection, addFloor))}</p>
      </div>
    </section>
    <section class="an-floors-review" aria-label="Areas">
      <div class="an-floors-toolbar an-panel-head"><h3>Areas</h3><span class="an-count" data-area-total>${rows.length}</span><span class="an-tool-grow"></span><span data-area-count>${rows.length} found · ${selected} selected</span></div>
      <details class="an-water-all" data-shared-water${anyWater ? "" : " hidden"}><summary>Water settings for ticked water areas</summary><div class="an-water-shared-fields">
        <label>Kind ${optionsHTML(WATER_KINDS, 'data-all-kind=""', shared.waterKind ?? "still")}</label>
        <label data-shared-flow>Flows ${optionsHTML(FLOW_OPTIONS, 'data-all-flow=""', shared.flowTo || "s")}</label>
        <label data-shared-current>Current ${optionsHTML(CURRENT_OPTIONS, 'data-all-current=""', shared.current ?? "")}</label>
      </div></details>
      <div class="an-floors-empty" data-area-empty${rows.length ? " hidden" : ""}>
        ${reason ? `<p class="an-floors-reason">${esc(noneMessage(reason))} Other floors are not found automatically.</p>` : ""}
        <p>No areas yet. Pick a floor in the toolbar, then click the map to add one. Scroll to zoom, drag or middle-drag to pan.</p>
        <p>Experimental. Nothing is saved until you create the regions.</p>
      </div>
      <div class="an-floors-list">${areaListHTML(rows, optionsFor, floorOf)}</div>
      <div class="an-insp-space" data-insp-space></div>
      <p class="an-insp-empty" data-insp-empty${rows.length ? "" : " hidden"}>Select an area to change its floor, settings and outline.</p>
    </section>
  </div>
  <footer class="an-floors-foot">
    <button type="button" class="an-ghost" data-tidy-all title="Drop the small separate pieces of every area at once. Ctrl+Z brings them back."${rows.length ? "" : " disabled"}><i class="fa-solid fa-broom" inert></i> Remove all small spots</button>
    <label class="an-foot-texture" title="Whether the ticked regions paint their floor's texture over the map, and what new areas start with. Don't paint suits a map that is already painted; each area can differ in its settings."><span class="an-tool-label">Floor texture</span> ${optionsHTML(textureOptions(sceneTexture), 'data-all-texture=""', textureOf(shared.texture))}</label>
    <span class="an-tool-grow"></span>
    <button type="button" class="an-secondary" data-combine-ticked title="Merge the ticked areas into one region, keeping the largest area's floor and settings"${selected < 2 ? " disabled" : ""}>Combine ticked</button>
    <button type="button" class="an-primary" data-create${selected ? "" : " disabled"}>${saveLabel(proposals, ticked)}</button>
  </footer>
</div>`;
}

export function readAreaChoices(rows) {
  return (rows ?? []).map((row) => ({
    id: row.id,
    checked: row.checked === true,
    floor: isAreaFloor(row.floor) ? row.floor : "water",
    waterKind: row.waterKind ?? "still",
    flowTo: row.flowTo ?? "",
    current: row.current ?? "",
    waveTo: row.waveTo ?? "",
    seaBeach: row.seaBeach ?? "",
    texture: textureOf(row.texture),
    pattern: String(row.pattern ?? ""),
    edge: row.edge === undefined || row.edge === null ? "" : String(row.edge),
    overWater: row.overWater === true && canStandOverWater(row.floor),
    step: row.step === undefined || row.step === null ? "" : String(row.step),
  }));
}

export function choicesFromElement(root) {
  const rows = [];
  for (const row of root?.querySelectorAll?.("[data-id]") ?? []) {
    rows.push({
      id: row.dataset.id,
      checked: row.querySelector("[data-pick]")?.checked === true,
      floor: row.querySelector("[data-floor]")?.value ?? row.dataset.floor ?? "water",
      waterKind: row.querySelector("[data-kind]")?.value ?? row.dataset.kind ?? "still",
      flowTo: row.querySelector("[data-flow]")?.value ?? "",
      current: row.querySelector("[data-current]")?.value ?? "",
      waveTo: row.querySelector("[data-wave]")?.value ?? "",
      seaBeach: row.querySelector("[data-beach]")?.checked === false ? "off" : "",
      texture: row.querySelector("[data-texture]")?.value ?? "",
      pattern: row.querySelector("[data-pattern]")?.value ?? "",
      edge: row.querySelector("[data-edge]")?.value ?? "",
      overWater: row.querySelector("[data-over-water]")?.checked === true,
      step: row.querySelector("[data-step]")?.value ?? "",
    });
  }
  return readAreaChoices(rows);
}

export function savedAreaProposals(regions, { levelId, sceneRect, width, height }) {
  const editable = new Set(editableFloorRegionIds(regions, levelId));
  const list = Array.isArray(regions) ? regions : regions?.contents ?? [];
  return list.filter((region) => editable.has(region.id)).map((region, index) => {
    const loops = [];
    const add = (points, hole) => loops.push({ hole, points: Array.from(points, (value, i) => {
      const limit = i % 2 ? height : width;
      const at = (value - (i % 2 ? sceneRect.y : sceneRect.x)) * limit / (i % 2 ? sceneRect.height : sceneRect.width);
      return Math.abs(at) < 1e-8 ? 0 : Math.abs(at - limit) < 1e-8 ? limit : at;
    }) });
    if (region.polygonTree?.children) {
      const visit = (node) => { for (const child of node.children ?? []) { add(child.points, child.isHole); visit(child); } };
      visit(region.polygonTree);
    } else {
      for (const shape of region.shapes ?? []) {
        if (shape.type !== "polygon") throw new Error("This saved region needs Foundry's region geometry to open.");
        add(shape.points, shape.hole === true);
      }
    }
    const own = region.flags?.animater ?? {};
    const kind = waterKindOf(own);
    const floor = isAreaFloor(own.floor) ? own.floor : "water";
    const savedChoices = { floor, generated: own.generated, waterKind: kind, flowTo: flowDefault(kind, own.flowTo), current: currentDefault(kind, own.current), waveTo: own.waveTo ?? "", seaBeach: own.seaBeach === "off" ? "off" : "", texture: textureOf(own.texture), pattern: patternOf(floor, own.textureStyles?.[floor]), edge: String(own.stepEdgeOff === true ? 0 : stepEdge(own)), overWater: own.overWater === true, stepsOwn: own.steps ? { steps: own.steps, stepsFloor: own.stepsFloor, step: own.step, stepsEdited: own.stepsEdited } : null };
    savedChoices.step = stepStart(floor, savedChoices.stepsOwn);
    return { ...areaProposalFromLoops(loops, width, height), id: `area-${index + 1}`, regionId: region.id, name: region.name ?? floorName(floor), floor, savedChoices, preselected: false };
  }).filter((proposal) => proposal.loops.length).map((proposal, i) => ({ ...proposal, id: `area-${i + 1}` }));
}

export function planFloorCreate({ proposals, picked, sceneRect, imageWidth, imageHeight, levelId, regions }) {
  const byId = new Map((proposals ?? []).map((proposal) => [proposal.id, proposal]));
  const editable = new Set(editableFloorRegionIds(regions, levelId));
  const creates = [], updates = [], sources = []; // sources: the area each create comes from
  for (const pickedRow of [...(picked ?? [])].sort((a, b) => (byId.get(b.id)?.share ?? 0) - (byId.get(a.id)?.share ?? 0))) {
    const row = { ...pickedRow, flowTo: flowDefault(pickedRow.waterKind, pickedRow.flowTo), current: currentDefault(pickedRow.waterKind, pickedRow.current) };
    if (!row.checked) continue;
    const proposal = byId.get(row.id);
    if (!proposal) continue;
    const data = toRegionData(proposal, { sceneRect, imageWidth, imageHeight, levelId, floor: row.floor,
      waterKind: row.waterKind, flowTo: row.flowTo, current: row.current, waveTo: row.waveTo, seaBeach: row.seaBeach, texture: row.texture,
      pattern: row.pattern ? patternOf(row.floor, row.pattern) : "", edge: row.edge, overWater: row.overWater === true, steps: proposal.regionId ? null : stepPatch(row.floor, row.step) });
    if (!proposal.regionId) { creates.push(data); sources.push(proposal.id); continue; }
    if (!editable.has(proposal.regionId)) throw new Error("The saved region is no longer editable on this level. Reopen the generator.");
    const patch = { _id: proposal.regionId };
    if (proposal.geometryChanged) patch.shapes = data.shapes;
    const before = proposal.savedChoices;
    const own = data.flags.animater;
    const wasFloor = before.floor ?? "water";
    if (own.floor !== wasFloor) {
      patch["flags.animater.floor"] = own.floor;
      // Off water: its kind, flow, waves and beach no longer apply. To lava: lava's own steps come with it.
      if (wasFloor === "water") for (const key of WATER_KEYS) patch[`flags.animater.${key}`] = "";
      if (own.floor === "lava") for (const [key, value] of Object.entries(caveKindFlags({}, "lava"))) if (key !== "floor") patch[`flags.animater.${key}`] = value;
    }
    if (own.floor === "water") {
      const kindChanged = row.waterKind !== before.waterKind || wasFloor !== "water";
      for (const key of WATER_KEYS) {
        if (row[key] !== before[key] || (kindChanged && ["waterKind", "flowTo", "current"].includes(key))) patch[`flags.animater.${key}`] = own[key] ?? "";
      }
    }
    if (textureOf(row.texture) !== textureOf(before.texture)) patch["flags.animater.texture"] = textureOf(row.texture);
    if ((own.overWater === true) !== (before.overWater === true)) patch["flags.animater.overWater"] = own.overWater === true;
    // The step: written only when the GM picked another, the same flags the right-click menu saves.
    const keptSteps = own.floor === wasFloor ? before.stepsOwn : null;
    if (row.step !== "" && row.step !== undefined && row.step !== stepStart(own.floor, keptSteps)) {
      const stepped = stepPatch(own.floor, row.step, keptSteps);
      if (stepped) for (const [key, value] of Object.entries(stepped)) patch[`flags.animater.${key}`] = value;
    }
    // Pattern and edge: written only when the GM changed them, so a region tuned elsewhere keeps its own.
    if (row.pattern && patternOf(own.floor, row.pattern) !== patternOf(own.floor, own.floor === wasFloor ? before.pattern : "")) patch[`flags.animater.textureStyles.${own.floor}`] = patternOf(own.floor, row.pattern);
    if (row.edge !== "" && row.edge !== undefined && edgeOf(row.edge) !== edgeOf(before.edge)) Object.assign(patch, edgeOf(row.edge) === 0 ? { "flags.animater.stepEdgeOff": true } : { "flags.animater.stepEdgeOff": false, "flags.animater.stepEdge": edgeOf(row.edge) });
    // A region saved with the old "water-detect" marker keeps it: the generator reads both, and an update writes only what changed.
    if (Object.keys(patch).length > 1) updates.push(patch);
  }
  // Named by floor: "Water", or "Grass 1", "Grass 2" when one save makes several of the same floor.
  // Numbers carry on after the regions already on the scene, so a second save never makes another "Grass 1".
  const perFloor = new Map(), taken = new Map();
  for (const data of creates) perFloor.set(data.flags.animater.floor, (perFloor.get(data.flags.animater.floor) ?? 0) + 1);
  for (const region of Array.isArray(regions) ? regions : regions?.contents ?? []) {
    for (const floor of perFloor.keys()) {
      const base = floorName(floor), m = String(region.name ?? "").match(new RegExp(`^${base} ?(\\d*)$`));
      if (m) taken.set(floor, Math.max(taken.get(floor) ?? 0, Number(m[1]) || 1));
    }
  }
  const seen = new Map();
  for (const data of creates) {
    const floor = data.flags.animater.floor, n = (seen.get(floor) ?? taken.get(floor) ?? 0) + 1;
    seen.set(floor, n);
    data.name = perFloor.get(floor) === 1 && !taken.has(floor) ? floorName(floor) : `${floorName(floor)} ${n}`;
  }
  return { creates, updates, sources };
}

// `created(docs)`: told the regions made, in the order of plan.creates.
export async function commitFloorPlan(plan, { scene, notify, created } = {}) {
  if (!plan.creates.length && !plan.updates.length) {
    notify?.("No changes to save. Tick an edited or new area first.");
    return { created: 0, updated: 0 };
  }
  if (plan.updates.length) await scene.updateEmbeddedDocuments("Region", plan.updates);
  if (plan.creates.length) { const docs = await scene.createEmbeddedDocuments("Region", plan.creates); created?.(docs ?? []); }
  return { created: plan.creates.length, updated: plan.updates.length };
}

// The k-th area of one floor gets its own shade of that floor's colour, so neighbours of one floor tell apart.
const SHADE_STEPS = [0, 0.3, -0.28, 0.5, -0.45, 0.15, -0.14, 0.4, -0.36];
export function areaShade(hex, k) {
  const t = SHADE_STEPS[k % SHADE_STEPS.length], n = parseInt(String(hex).slice(1), 16);
  const mix = (c) => Math.round(t >= 0 ? c + (255 - c) * t : c * (1 + t));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => mix(c).toString(16).padStart(2, "0")).join("")}`;
}
const ACCENT = "#b29aff";
const rgbaOf = (hex, alpha) => { const n = parseInt(String(hex).slice(1), 16); return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`; };
// Where an area's number goes: the area's own pixel nearest its middle, so it sits inside even a crescent. Cached per area.
const labelSpots = new WeakMap();
function labelSpot(proposal, width) {
  if (labelSpots.has(proposal)) return labelSpots.get(proposal);
  let spot = null;
  const pixels = proposal.pixels;
  if (pixels?.length) {
    let sx = 0, sy = 0;
    const step = Math.max(1, Math.floor(pixels.length / 4000));
    let n = 0; for (let i = 0; i < pixels.length; i += step) { sx += pixels[i] % width; sy += Math.floor(pixels[i] / width); n++; }
    const mx = sx / n, my = sy / n;
    let best = Infinity;
    for (let i = 0; i < pixels.length; i += step) { const x = pixels[i] % width, y = Math.floor(pixels[i] / width), d = (x - mx) ** 2 + (y - my) ** 2; if (d < best) { best = d; spot = { x, y }; } }
  } else if (proposal.loops?.[0]?.points?.length >= 2) spot = { x: proposal.loops[0].points[0], y: proposal.loops[0].points[1] };
  labelSpots.set(proposal, spot);
  return spot;
}

// The read as a canvas, made once per read, so it can be drawn scaled like the sharp map.
const readCanvases = new WeakMap();
function readCanvas(rgba, width, height) {
  if (readCanvases.has(rgba)) return readCanvases.get(rgba);
  const Canvas = globalThis.OffscreenCanvas;
  if (!Canvas) return null;
  const canvas = new Canvas(width, height);
  canvas.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(rgba), width, height), 0, 0);
  readCanvases.set(rgba, canvas);
  return canvas;
}

// The map with every area painted in its floor's colour and numbered as in the list. `floors`: id → the row's floor.
// Drawing is in read pixels. `view.scale`: canvas pixels per read pixel (the canvas is drawn at screen resolution);
// `view.image`: the sharp map, else the read is shown; `view.unit`: read pixels per screen pixel, so outlines and
// numbers keep one size on screen at any zoom.
export function paintAreaPreview(ctx, rgba, width, height, proposals, highlightId = "", floors = null, view = {}) {
  if (!ctx || !width || !height) return;
  const scale = view.scale ?? 1;
  ctx.setTransform?.(scale, 0, 0, scale, 0, 0);
  const drawn = typeof ctx.drawImage === "function" && (view.image ?? (scale !== 1 && rgba ? readCanvas(rgba, width, height) : null));
  if (drawn) { ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high"; ctx.drawImage(drawn, 0, 0, width, height); }
  else if (rgba) ctx.putImageData(new ImageData(new Uint8ClampedArray(rgba), width, height), 0, 0);
  else ctx.clearRect(0, 0, width, height);
  if (view.painted?.image && typeof ctx.drawImage === "function") ctx.drawImage(view.painted.image, 0, 0, width, height);
  const line = view.unit ? view.unit * 1.25 : Math.max(1, width / 600);
  const perFloor = new Map(), shadeOf = new Map();
  for (const proposal of proposals) {
    ctx.beginPath();
    for (const loop of proposal.loops ?? []) {
      const points = loop.points ?? [];
      if (points.length < 6) continue;
      ctx.moveTo(points[0], points[1]);
      for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1]);
      ctx.closePath();
    }
    const hot = proposal.id === highlightId;
    const floor = floors?.get(proposal.id) ?? proposal.floor, kind = isAreaFloor(floor) ? floor : "water";
    const k = perFloor.get(kind) ?? 0; perFloor.set(kind, k + 1);
    const colour = areaShade(floorColour(kind), k);
    // Light fills so the painting shows through; the outline carries the shape. The highlighted area gets the accent.
    const look = view.looks?.get(proposal.id);
    shadeOf.set(proposal.id, colour);
    // A painted area shows as it will look, soft edge and all: no outline over it unless it is the highlighted one.
    const painted = view.painted?.ids?.has(proposal.id) || (look && drawPainted(ctx, proposal, look, scale));
    if (painted && !hot) continue;
    if (painted) { ctx.fillStyle = rgbaOf(ACCENT, 0.1); ctx.fill("evenodd"); }
    else { ctx.fillStyle = rgbaOf(colour, hot ? 0.34 : 0.2); ctx.fill("evenodd"); }
    ctx.lineJoin = "round";
    if (hot) { ctx.lineWidth = line * 3.2; ctx.strokeStyle = "rgba(0, 0, 0, 0.5)"; ctx.stroke(); }
    ctx.lineWidth = hot ? line * 1.8 : line * 1.5;
    ctx.strokeStyle = hot ? ACCENT : rgbaOf(colour, 0.95);
    ctx.stroke();
    shadeOf.set(proposal.id, colour);
  }
  // Numbers last, so no area paints over another's.
  if (typeof ctx.fillText !== "function" || typeof ctx.strokeText !== "function") return;
  // Each number sits on a small badge in its area's shade, as in the list; the highlighted one is in the accent.
  const size = view.unit ? 12 * view.unit : Math.max(10, Math.round(width / 70));
  ctx.font = `700 ${size}px sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.lineJoin = "round";
  for (const proposal of proposals) {
    const spot = labelSpot(proposal, width);
    if (!spot) continue;
    const text = String(proposal.id).replace("area-", ""), hot = proposal.id === highlightId;
    const h = size * 1.75, w = Math.max(h * 1.15, size * 0.68 * text.length + size), x = spot.x - w / 2, y = spot.y - h / 2;
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") ctx.roundRect(x, y, w, h, h * 0.25); else ctx.rect?.(x, y, w, h);
    ctx.fillStyle = hot ? ACCENT : (shadeOf.get(proposal.id) ?? "#2c7da0"); ctx.fill?.();
    ctx.lineWidth = Math.max(1, size / 10); ctx.strokeStyle = "rgba(0, 0, 0, 0.55)"; ctx.stroke();
    ctx.lineWidth = Math.max(2, size / 5); ctx.strokeStyle = hot ? "rgba(0, 0, 0, 0)" : "rgba(0, 0, 0, 0.6)"; ctx.strokeText(text, spot.x, spot.y + size * 0.05);
    ctx.fillStyle = hot ? "#15111f" : "#ffffff"; ctx.fillText(text, spot.x, spot.y + size * 0.05);
  }
}

// An area's loops in scene coordinates, as the floor renderer takes a region's: each outer ring with its holes.
export function worldAreas(loops, rect, width, height) {
  const kx = rect.width / width, ky = rect.height / height;
  const world = (points) => Array.from(points, (v, i) => (i % 2 ? rect.y + v * ky : rect.x + v * kx));
  const inside = (x, y, p) => { let c = false; for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) if ((p[i + 1] > y) !== (p[j + 1] > y) && x < ((p[j] - p[i]) * (y - p[i + 1])) / (p[j + 1] - p[i + 1]) + p[i]) c = !c; return c; };
  const outers = loops.filter((l) => !l.hole && l.points?.length >= 6).map((l) => Object.assign(world(l.points), { holes: [], raw: l.points }));
  for (const hole of loops.filter((l) => l.hole && l.points?.length >= 6)) {
    const owner = outers.find((o) => inside(hole.points[0], hole.points[1], o.raw));
    if (owner) owner.holes.push(world(hole.points));
  }
  for (const o of outers) delete o.raw;
  return outers;
}
// A number per area object, so a changed shape asks for a new snapshot.
const serials = new WeakMap();
let nextSerial = 1;
const serialOf = (area) => { if (!serials.has(area)) serials.set(area, nextSerial++); return serials.get(area); };

// A painted area as it will look: its floor's tile repeated at the scene's size, inside the area, fading out over its soft
// edge. Drawn once into its own canvas (at up to 4x the read for a sharp zoom) and kept until the area or its look changes.
const paintedCache = new WeakMap();
function drawPainted(ctx, proposal, look, scale = 1) {
  const make = globalThis.OffscreenCanvas ? (w, h) => new OffscreenCanvas(w, h) : globalThis.document ? (w, h) => Object.assign(document.createElement("canvas"), { width: w, height: h }) : null;
  if (!make || typeof ctx.drawImage !== "function") return false;
  const s = Math.max(1, Math.min(4, Math.round(scale))), key = `${look.key}|${look.tileSize.toFixed(2)}|${look.edge.toFixed(2)}|${s}`;
  let made = paintedCache.get(proposal);
  if (made?.key !== key) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const loop of proposal.loops ?? []) { const p = loop.points ?? []; for (let i = 0; i < p.length; i += 2) { x0 = Math.min(x0, p[i]); x1 = Math.max(x1, p[i]); y0 = Math.min(y0, p[i + 1]); y1 = Math.max(y1, p[i + 1]); } }
    if (!(x1 > x0) || !(y1 > y0)) return false;
    const blur = look.edge * 0.5, pad = Math.ceil(blur * 2) + 2;
    x0 = Math.floor(x0 - pad); y0 = Math.floor(y0 - pad); x1 = Math.ceil(x1 + pad); y1 = Math.ceil(y1 + pad);
    const canvas = make(Math.max(1, (x1 - x0) * s), Math.max(1, (y1 - y0) * s)), g = canvas.getContext("2d");
    if (!g) return false;
    g.setTransform(s, 0, 0, s, -x0 * s, -y0 * s);
    if (blur > 0) g.filter = `blur(${blur * s}px)`;
    g.beginPath();
    for (const loop of proposal.loops ?? []) { const p = loop.points ?? []; if (p.length < 6) continue; g.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]); g.closePath(); }
    g.fillStyle = "#fff"; g.fill("evenodd");
    g.filter = "none";
    g.globalCompositeOperation = "source-in";
    const pattern = g.createPattern(look.tile, "repeat"), k = look.tileSize / (look.tile.width || 1);
    pattern?.setTransform?.(new DOMMatrix([k, 0, 0, k, 0, 0]));
    g.fillStyle = pattern ?? "#888"; g.fillRect(x0, y0, x1 - x0, y1 - y0);
    made = { key, canvas, x0, y0, w: x1 - x0, h: y1 - y0 };
    paintedCache.set(proposal, made);
  }
  ctx.drawImage(made.canvas, made.x0, made.y0, made.w, made.h);
  return true;
}

function applyShared(root, attribute, value) {
  const checked = new Set([...root.querySelectorAll("[data-pick]:checked")].map((box) => box.dataset.pick));
  for (const select of root.querySelectorAll(`[${attribute}]`)) {
    const id = select.getAttribute(attribute);
    if (id && checked.has(id)) select.value = value;
  }
}

function sharedChoices(root) {
  return {
    waterKind: root.querySelector("[data-all-kind]")?.value ?? "still",
    flowTo: root.querySelector("[data-all-flow]")?.value ?? "s",
    current: root.querySelector("[data-all-current]")?.value ?? "",
    range: root.querySelector("[data-click-range]")?.value ?? "narrow",
    selection: root.querySelector("[data-select-mode-option]:checked")?.value ?? root.querySelector("[data-select-mode]")?.value ?? "colour",
    addFloor: root.querySelector("[data-add-floor-option]:checked")?.value ?? root.querySelector("[data-add-floor]")?.value ?? "water",
    texture: root.querySelector("[data-all-texture]")?.value ?? "",
    keepColours: root.querySelector("[data-keep-colours]")?.checked ?? readPrefs().keepColours !== false,
  };
}

function untickedGeometryEdits(proposals, picked) {
  const checked = new Map((picked ?? []).map((row) => [row.id, row.checked === true]));
  return (proposals ?? []).filter((proposal) => proposal.geometryChanged && !checked.get(proposal.id));
}

function untickedGeometryMessage(count) {
  return `Experimental. ${count === 1 ? "An unticked area has outline edits" : `${count} unticked areas have outline edits`} that will be discarded. Tick ${count === 1 ? "it" : "them"} to save the outline, or continue to discard.`;
}

function updateKindFields(row) {
  const floor = row.querySelector("[data-floor]")?.value ?? "water", water = floor === "water";
  row.querySelector(".an-floor-swatch")?.style?.setProperty("--swatch", floorColour(floor));
  const fields = row.querySelector("[data-water-fields]");
  if (fields) fields.hidden = !water;
  const kind = row.querySelector("[data-kind]").value;
  const flow = row.querySelector("[data-flow]");
  const current = row.querySelector("[data-current]");
  flow.value = flowDefault(kind, flow.value) || "s";
  current.value = currentDefault(kind, current.value);
  const kindField = row.querySelector("[data-water-field]");
  if (kindField) kindField.hidden = !water;
  row.querySelector("[data-flow-field]").hidden = !water || !waterFlows(kind);
  row.querySelector("[data-current-field]").hidden = !water || kind !== "river";
  for (const field of row.querySelectorAll("[data-sea-field]")) field.hidden = !water || kind !== "sea";
  const over = row.querySelector("[data-over-water-field]");
  if (over) over.hidden = !canStandOverWater(floor);
  updateStepField(row, floor);
  updateRowMeta(row);
  updateTextureFields(row);
}

// The step list is the floor's: a new floor starts at its usual step; back on the saved floor, the saved region's list.
function updateStepField(row, floor) {
  const select = row?.querySelector?.("[data-step]"), field = row?.querySelector?.("[data-step-field]");
  if (!select || select.dataset.floorOf === floor) return;
  let own = null;
  try { own = select.dataset.stepsOwn ? JSON.parse(select.dataset.stepsOwn) : null; } catch { own = null; }
  const options = stepOptions(floor, own), start = stepStart(floor, own);
  select.innerHTML = options.map(([key, label]) => `<option value="${key}">${esc(label)}</option>`).join("");
  select.value = start;
  select.dataset.floorOf = floor;
  if (field) field.hidden = !options.length;
}

// The pattern list is the floor's own; pattern and edge show only while the area will paint its texture.
function updateTextureFields(row) {
  const fields = row?.querySelector?.("[data-texture-fields]");
  if (!fields) return;
  const floor = row.querySelector("[data-floor]")?.value ?? "water", select = row.querySelector("[data-pattern]");
  if (select && select.dataset.floor !== floor) {
    const keep = select.value, options = patternOptions(floor);
    select.innerHTML = options.map(([key, label]) => `<option value="${esc(key)}">${esc(label)}</option>`).join("");
    select.value = options.some(([key]) => key === keep) ? keep : options[0]?.[0] ?? "";
    select.dataset.floor = floor;
  }
  fields.hidden = !paintsTexture(floor, row.querySelector("[data-texture]")?.value ?? "", row.dataset.sceneTexture ?? "");
  const edge = row.querySelector("[data-edge]"), out = row.querySelector("[data-edge-value]");
  if (edge && out) out.textContent = Number(edge.value) ? Number(edge.value).toFixed(1) : "Hard";
}

function updateRowMeta(row) {
  const meta = row?.querySelector?.("[data-row-meta]");
  if (!meta) return;
  const saved = !!meta.querySelector(".an-dot.is-saved"), floor = row.querySelector("[data-floor]")?.value ?? "water";
  meta.lastChild.textContent = rowMeta({ saved, checked: row.querySelector("[data-pick]")?.checked === true, floor, kind: row.querySelector("[data-kind]")?.value, overWater: row.querySelector("[data-over-water]")?.checked === true, learned: row.hasAttribute?.("data-learned") === true });
  for (const badge of row.querySelectorAll(".an-area-num")) badge.style.setProperty("--swatch", floorColour(floor));
  const name = row.querySelector(".an-row-name strong");
  if (name && !saved) name.textContent = floorName(floor);
}

// `detect` is what the window works on: the pixels, the rows so far, and the scene and level as they were at open.
export function floorRegionsWindow(ApplicationV2, hooks = {}) {
  return class FloorRegions extends ApplicationV2 {
    mode = { kind: "inspect" };
    static DEFAULT_OPTIONS = {
      id: "animater-floors-detect",
      classes: ["animater", "animater-floors"],
      window: { title: "Experimental: floor regions", icon: "fa-solid fa-water", resizable: true },
      // Most of the screen: the map is the work surface.
      position: { width: Math.round(Math.min(1800, Math.max(900, (globalThis.innerWidth || 1100) * 0.94))), height: Math.round(Math.max(640, (globalThis.innerHeight || 820) * 0.92)) },
    };

    async _renderHTML() {
      const { proposals, width, height, reason } = this.detect;
      return floorWindowHTML({ proposals, width, height, reason: proposals.length ? "" : reason, sceneTexture: this.sceneTexture(), learned: this.learnedCount() });
    }

    sceneTexture() { return this.detect?.scene?.flags?.animater?.floorTextures ?? ""; }

    _replaceHTML(html, content) {
      const before = choicesFromElement(content);
      content.innerHTML = before.length ? floorWindowHTML({ ...this.detect, reason: this.detect.proposals.length ? "" : this.detect.reason, picked: before, learned: this.learnedCount(), shared: sharedChoices(content), sceneTexture: this.sceneTexture() }) : html;
      this.paint();
      this.updateSummary();
      this.zoomMap(this.zoom ?? 1);
    }

    paint() {
      const canvas = this.element?.querySelector("canvas.an-floors-preview");
      const { detect } = this;
      if (!canvas?.getContext || !detect) return;
      const floors = new Map(choicesFromElement(this.element).map((row) => [row.id, row.floor]));
      const shown = canvas.getBoundingClientRect?.().width || detect.width;
      paintAreaPreview(canvas.getContext("2d"), detect.rgba, detect.width, detect.height, detect.proposals, this.mode?.areaId || this.highlight || this.selectedId || "", floors,
        { image: detect.image, scale: (canvas.width || detect.width) / detect.width, unit: detect.width / shown, painted: this.paintedSnapshot(), looks: this.looks() });
      if (this.gesture?.kind === "lasso") { // a split loop being drawn
        const ctx = canvas.getContext("2d"), p = this.gesture.points, sx = detect.width / (canvas.getBoundingClientRect().width || detect.width);
        ctx.save(); ctx.setLineDash([6 * sx, 4 * sx]); ctx.lineWidth = 2 * sx; ctx.strokeStyle = "#ffd250"; ctx.fillStyle = "rgba(255, 210, 80, 0.18)";
        ctx.beginPath(); ctx.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
      }
      if (this.gesture?.kind === "box") { // a smart box being dragged
        const ctx = canvas.getContext("2d"), { x0, y0, x1, y1 } = this.gesture, sx = detect.width / (canvas.getBoundingClientRect().width || detect.width);
        ctx.save(); ctx.setLineDash([6 * sx, 4 * sx]); ctx.lineWidth = 2 * sx; ctx.strokeStyle = "#ffd250";
        ctx.strokeRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0)); ctx.restore();
      }
      if (this.mode?.kind !== "vertices") return;
      const proposal = detect.proposals.find((p) => p.id === this.mode.areaId);
      const loops = this.gesture?.kind === "vertex" ? this.gesture.loops : proposal?.loops;
      if (!loops) return;
      const ctx = canvas.getContext("2d");
      const rect = canvas.getBoundingClientRect();
      const sx = detect.width / rect.width, sy = detect.height / rect.height;
      ctx.strokeStyle = "#ffd250";
      ctx.lineWidth = 2 * sx;
      for (const [ring, loop] of loops.entries()) {
        ctx.beginPath();
        for (let i = 0; i < loop.points.length; i += 2) {
          if (i === 0) ctx.moveTo(loop.points[i], loop.points[i + 1]);
          else ctx.lineTo(loop.points[i], loop.points[i + 1]);
        }
        ctx.closePath(); ctx.stroke();
        for (let i = 0; i < loop.points.length; i += 2) {
          ctx.fillStyle = this.selectedVertex?.ring === ring && this.selectedVertex.vertex === i / 2 ? "#ffd250" : "#ffffff";
          ctx.fillRect(loop.points[i] - 3 * sx, loop.points[i + 1] - 3 * sy, 6 * sx, 6 * sy);
        }
      }
    }

    updateSummary() {
      this.drawSizes();
      const kind = sharedChoices(this.element).waterKind;
      const flowField = this.element.querySelector("[data-shared-flow]");
      const currentField = this.element.querySelector("[data-shared-current]");
      if (flowField) flowField.hidden = !waterFlows(kind);
      if (currentField) currentField.hidden = kind !== "river";
      const total = this.detect.proposals.length;
      const selected = choicesFromElement(this.element).filter((row) => row.checked).length;
      const setText = (selector, text) => { const node = this.element.querySelector(selector); if (node) node.textContent = text; };
      setText("[data-area-count]", `${total} found · ${selected} selected`);
      // The water settings show only while a ticked area is water.
      const sharedWater = this.element.querySelector("[data-shared-water]");
      if (sharedWater) sharedWater.hidden = !choicesFromElement(this.element).some((row) => row.checked && row.floor === "water");
      const combine = this.element.querySelector("[data-combine-ticked]");
      if (combine) combine.disabled = selected < 2;
      const tidyAll = this.element.querySelector("[data-tidy-all]");
      if (tidyAll) tidyAll.disabled = !total;
      const undo = this.element.querySelector("[data-undo-toolbar]");
      if (undo) undo.disabled = !this.history?.length;
      this.lastChoices = choicesFromElement(this.element); // what a settings change goes back to
      setText("[data-area-total]", String(total));
      if (this.selectedId && !this.detect.proposals.some((p) => p.id === this.selectedId)) this.selectedId = "";
      for (const item of this.element.querySelectorAll(".an-floors-row")) item.classList?.toggle("sel", item.dataset.id === this.selectedId);
      this.fitInspector();
      const ticked = new Set(choicesFromElement(this.element).filter((row) => row.checked).map((row) => row.id));
      const button = this.element.querySelector("[data-create]");
      if (button) { button.textContent = saveLabel(this.detect.proposals, ticked, this.saving === true); button.disabled = !selected || this.saving === true; }
      const empty = this.element.querySelector("[data-area-empty]");
      if (empty) empty.hidden = total > 0;
      const help = this.mode?.kind === "vertices" ? "Drag handles to edit the outline" : "Click to add an area";
      this.element.querySelector(".an-floors-frame")?.setAttribute("aria-label", `Water preview. Scroll to zoom. Drag or middle-drag to pan. ${help}.`);
      const status = this.element.querySelector("[data-add-status]");
      if (status) {
        status.hidden = !this.mode?.areaId;
        this.element.querySelector("[data-add-message]").textContent = this.mode?.kind === "split" ? `Splitting Area ${this.mode.areaId.replace("area-", "")}. Drag around the part that should be its own area, for example a waterfall. It keeps this area's floor and settings until you change them. Done or Escape stops.` : this.mode?.kind === "vertices" ? "Drag a handle. Double-click an edge to insert. Select a handle to delete. Escape cancels a drag, then exits. Checkboxes only choose what to save." : `Adding to Area ${this.mode?.areaId?.replace("area-", "")}. Click more of that floor, or another area, on the map to add it. Checkboxes only choose which areas to save.`;
        this.element.querySelector("[data-undo-add]").disabled = !this.history?.length;
        for (const button of this.element.querySelectorAll("[data-add-to]")) {
          const active = this.mode?.kind === "add" && button.dataset.addTo === this.mode.areaId;
          button.setAttribute("aria-pressed", String(active));
          button.title = active ? "Adding here: click more of this floor on the map. Choose Done to stop." : "Add to area: click more of this floor on the map";
        }
        for (const button of this.element.querySelectorAll("[data-split]")) button.setAttribute("aria-pressed", String(this.mode?.kind === "split" && button.dataset.split === this.mode.areaId));
        for (const button of this.element.querySelectorAll("[data-edit-outline]")) button.setAttribute("aria-pressed", String(this.mode?.kind === "vertices" && button.dataset.editOutline === this.mode.areaId));
        const smooth = this.element.querySelector("[data-smooth-outline]");
        const remove = this.element.querySelector("[data-delete-vertex]");
        if (smooth) smooth.hidden = this.mode?.kind !== "vertices";
        if (remove) { remove.hidden = this.mode?.kind !== "vertices"; remove.disabled = !this.selectedVertex; }
      }
    }

    setAddTarget(id) { this.setMode(id ? { kind: "add", areaId: id } : { kind: "inspect" }); }

    setMode(mode) {
      this.gesture = null;
      if (mode?.areaId) this.selectedId = mode.areaId;
      this.selectedVertex = null;
      this.mode = mode;
      this.updateSummary();
      this.setHighlight(mode.areaId ?? "");
      this.paint();
    }

    remember() {
      if (this.batching) return; // a batch of changes is one undo step
      this.history ??= [];
      this.history.push({ proposals: [...this.detect.proposals], choices: choicesFromElement(this.element), excluded: { ...(this.excluded ?? {}) } });
      if (this.history.length > 20) this.history.shift();
    }

    commitOutline(loops) {
      const { detect } = this;
      const target = detect.proposals.find((p) => p.id === this.mode?.areaId);
      if (!target) return false;
      const error = validateOutline(target.loops, loops, detect.width, detect.height);
      if (error) { hooks.notify?.(error); this.paint(); return false; }
      if (JSON.stringify(target.loops) === JSON.stringify(loops)) return false;
      const geometry = areaProposalFromLoops(loops, detect.width, detect.height);
      if (!geometry.pixels.length) { hooks.notify?.("Keep some of the area inside the outline."); this.paint(); return false; }
      let exclusions;
      try {
        exclusions = (target.exclusions ?? []).map(cut => subtractOutlines(cut, loops)).filter(cut => cut.length);
        const removed = subtractOutlines(target.loops, loops);
        if (removed.length) exclusions.push(removed);
      } catch (error) { hooks.notify?.(error.message); this.paint(); return false; }
      this.remember();
      const edited = { ...target, ...geometry, geometryChanged: true, outlineEdited: true, exclusions };
      detect.proposals = detect.proposals.map((p) => p === target ? edited : p);
      this.drawRows(choicesFromElement(this.element));
      return true;
    }

    deleteVertex() {
      this.gesture = null;
      if (!this.selectedVertex || this.mode?.kind !== "vertices") return;
      const target = this.detect.proposals.find((p) => p.id === this.mode.areaId);
      if (this.commitOutline(changeVertex(target.loops, { ...this.selectedVertex, action: "delete" }))) this.selectedVertex = null;
      this.updateSummary(); this.paint();
    }

    // Ticked areas into one: into the saved region if one is ticked, else into the largest. Two saved regions stay apart.
    combineTicked() {
      const ticked = choicesFromElement(this.element).filter((row) => row.checked).map((row) => this.detect.proposals.find((p) => p.id === row.id)).filter(Boolean);
      if (ticked.length < 2) { hooks.notify?.("Tick two or more areas to combine them."); return; }
      const saved = ticked.filter((p) => p.regionId);
      if (saved.length > 1) { hooks.notify?.("Two saved regions cannot be combined. Untick all but one saved region."); return; }
      const target = saved[0] ?? [...ticked].sort((a, b) => b.share - a.share)[0];
      if (this.mode?.kind === "vertices") this.setMode({ kind: "inspect" });
      this.combineAreas(ticked.filter((p) => p !== target), target);
    }

    combineAreas(additions, target = this.detect.proposals.find((proposal) => proposal.id === (this.mode?.kind === "add" ? this.mode.areaId : null)), { quiet = false } = {}) {
      const { detect } = this;
      const choices = choicesFromElement(this.element);
      const mergedIds = new Set([target.id, ...additions.map((proposal) => proposal.id)]);
      const claimed = detect.proposals.filter((proposal) => !mergedIds.has(proposal.id));
      const exclusions = [target, ...additions].flatMap(proposal => proposal.exclusions ?? []);
      let merged;
      if ([target, ...additions].some((proposal) => proposal.outlineEdited)) {
        const addedLoops = additions.flatMap((proposal) => proposal.outlineEdited ? proposal.loops
          : mergeAreaProposals([proposal], detect.width, detect.height, { claimed }).loops);
        try {
          merged = { ...target, ...areaProposalFromLoops(exclusions.reduce((loops, cut) => subtractOutlines(loops, cut), unionOutlines(target.loops, addedLoops)), detect.width, detect.height), geometryChanged: true, outlineEdited: true, exclusions };
        } catch (error) { hooks.notify?.(error.message); return; }
      } else merged = { ...mergeAreaProposals([target, ...additions], detect.width, detect.height, { claimed, preserveTarget: !!target.regionId }), geometryChanged: true };
      const owned = new Set(target.pixels);
      if (!additions.some(p => detect.proposals.includes(p)) && merged.pixels.length === owned.size && merged.pixels.every(pixel => owned.has(pixel))) {
        hooks.notify?.("That is already part of this area."); return;
      }
      this.remember();
      detect.proposals = detect.proposals.filter((proposal) => proposal.id === target.id || !mergedIds.has(proposal.id))
        .map((proposal) => proposal.id === target.id ? merged : proposal);
      this.drawRows(choices);
      if (!quiet) hooks.notify?.(`Added to Area ${target.id.replace("area-", "")}. Its floor and settings are unchanged.`);
    }

    drawRows(choices) {
      const byId = new Map(choices.map((choice) => [choice.id, choice]));
      const texture = sharedChoices(this.element).texture, sceneTexture = this.sceneTexture();
      const before = new Set(choices.map((c) => c.id)), added = this.detect.proposals.filter((p) => !before.has(p.id));
      const floorOf = (p) => { const f = byId.get(p.id)?.floor ?? p.savedChoices?.floor ?? p.floor; return isAreaFloor(f) ? f : "water"; };
      this.element.querySelector(".an-floors-list").innerHTML = areaListHTML(this.detect.proposals, (proposal) => ({ sceneTexture, ...(proposal.regionId ? {} : { texture }), ...byId.get(proposal.id) }), floorOf);
      if (added.length === 1) this.selectedId = added[0].id;
      this.updateSummary();
      this.paint();
    }

    undoAdd() {
      this.gesture = null;
      if (!this.history?.length) return;
      const { proposals, choices, excluded, settings } = this.history.pop();
      this.detect.proposals = proposals;
      this.excluded = excluded ?? {};
      this.selectedVertex = null;
      const current = new Map(choicesFromElement(this.element).map((choice) => [choice.id, choice]));

      this.drawRows(settings ? choices : choices.map((choice) => current.get(choice.id) ?? choice));
    }

    zoomMap(value, pointer) {
      const frame = this.element.querySelector(".an-floors-frame");
      const canvas = this.element.querySelector("canvas.an-floors-preview");
      if (!frame || !canvas || !frame.clientWidth || !frame.clientHeight) return;
      const fit = Math.min(frame.clientWidth / this.detect.width, frame.clientHeight / this.detect.height);
      const oldWidth = canvas.getBoundingClientRect().width;
      const oldHeight = canvas.getBoundingClientRect().height;
      const rect = canvas.getBoundingClientRect();
      const bounds = frame.getBoundingClientRect();
      const anchor = pointer ?? { x: bounds.left + frame.clientWidth / 2, y: bounds.top + frame.clientHeight / 2 };
      const x = oldWidth ? (anchor.x - rect.left) / oldWidth : 0.5;
      const y = oldHeight ? (anchor.y - rect.top) / oldHeight : 0.5;
      this.zoom = Math.max(1, Math.min(8, value));
      const width = this.detect.width * fit * this.zoom;
      const height = this.detect.height * fit * this.zoom;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      frame.scrollLeft = Math.max(0, x * width - (anchor.x - bounds.left) + Math.max(0, (frame.clientWidth - width) / 2));
      frame.scrollTop = Math.max(0, y * height - (anchor.y - bounds.top) + Math.max(0, (frame.clientHeight - height) / 2));
      const label = this.element.querySelector("[data-zoom-label]");
      if (label) label.textContent = `${Math.round(this.zoom * 100)}%`;
      // The canvas is drawn at screen resolution (up to VIEW_MAX on its long side), so it stays sharp when zoomed.
      const long = Math.max(this.detect.width, this.detect.height);
      const scale = Math.max(1, Math.min(VIEW_MAX / long, width * (globalThis.devicePixelRatio || 1) / this.detect.width));
      const backing = { width: Math.round(this.detect.width * scale), height: Math.round(this.detect.height * scale) };
      if (Math.abs(canvas.width - backing.width) > 1) { canvas.width = backing.width; canvas.height = backing.height; }
      this.paint();
    }

    // The painted areas exactly as the scene will paint them: the scene's own floor renderer draws the drafts, lit as the
    // scene is now, into one picture of the map. Asked for once the areas settle; until it comes (or where there is no
    // renderer) the tile preview below stands in.
    paintedSnapshot() {
      if (!hooks.snapshot || !this.detect?.sceneRect) return null;
      const { detect } = this, rect = detect.sceneRect, sceneTexture = this.sceneTexture(), list = [], ids = new Set();
      let key = "";
      for (const row of choicesFromElement(this.element)) {
        if (!paintsTexture(row.floor, row.texture, sceneTexture)) continue;
        const area = detect.proposals.find((p) => p.id === row.id);
        if (!area?.loops?.length) continue;
        const style = patternOf(row.floor, row.pattern), edge = edgeOf(row.edge);
        ids.add(row.id); key += `${row.id}:${serialOf(area)}:${row.floor}/${style}/${edge};`;
        list.push({ id: row.id, areas: worldAreas(area.loops, rect, detect.width, detect.height), floor: row.floor, style, edge, scale: 1 });
      }
      if (!list.length) return null;
      if (this.snap?.key === key) return { image: this.snap.image, ids };
      if (this.snapWanted !== key) {
        this.snapWanted = key; this.snapTries = 0;
        clearTimeout(this.snapTimer);
        const take = () => {
          if (!this.detect || this.snapWanted !== key) return;
          const width = Math.min(4096, Math.round(detect.width * 2)), height = Math.round(width * detect.height / detect.width);
          let image = null;
          try { image = hooks.snapshot(list, rect, width, height); } catch (error) { console.warn("Animater | floor preview", error); this.snapWanted = null; return; }
          if (image) { this.snap = { key, image }; this.paint(); return; }
          if (++this.snapTries < 40) this.snapTimer = setTimeout(take, 250); // a tile still being made
        };
        this.snapTimer = setTimeout(take, 120);
      }
      return null;
    }

    // How each area will look once saved: the painted ones with their floor's tile, at the size and edge the scene
    // paints them. A tile the scene has not painted yet comes a moment later, and the map is drawn again then.
    looks() {
      if (!hooks.tile || !this.detect) return null;
      const { detect } = this, sceneTexture = this.sceneTexture(), looks = new Map();
      const k = detect.width / (detect.sceneRect?.width || detect.width), grid = (detect.grid || 100) * k;
      this.tiles ??= new Map();
      let waiting = false;
      for (const row of choicesFromElement(this.element)) {
        if (!paintsTexture(row.floor, row.texture, sceneTexture)) continue;
        const style = patternOf(row.floor, row.pattern), key = `${row.floor}/${style}`;
        if (!this.tiles.get(key)) { try { this.tiles.set(key, hooks.tile(row.floor, style) ?? null); } catch { this.tiles.set(key, null); } }
        const tile = this.tiles.get(key);
        if (!tile) { waiting = true; continue; }
        looks.set(row.id, { tile, key, tileSize: grid * 4, edge: edgeOf(row.edge) * grid });
      }
      if (waiting && (this.tileTries = (this.tileTries ?? 0) + 1) < 40) { clearTimeout(this.tileTimer); this.tileTimer = setTimeout(() => { if (this.detect) { for (const [key, value] of this.tiles) if (!value) this.tiles.delete(key); this.paint(); } }, 250); }
      return looks;
    }

    // The selected area: its row is marked and its inspector shows under the list. "" selects none.
    select(id) {
      if (id && !this.detect?.proposals.some((p) => p.id === id)) id = "";
      this.selectedId = id;
      for (const item of this.element?.querySelectorAll?.(".an-floors-row") ?? []) item.classList?.toggle("sel", item.dataset.id === id);
      this.fitInspector();
      this.paint();
    }

    // The inspector sits over the bottom of the list; the list keeps room for it so no row hides behind it.
    fitInspector() {
      const row = this.selectedId ? this.element?.querySelector?.(`.an-floors-row[data-id="${this.selectedId}"]`) : null;
      const space = this.element?.querySelector?.("[data-insp-space]"), empty = this.element?.querySelector?.("[data-insp-empty]");
      if (space?.style) space.style.height = row ? `${row.querySelector(".an-inspector")?.offsetHeight ?? 0}px` : "0px";
      if (empty) empty.hidden = !!row || !this.detect?.proposals.length;
    }

    // The floor picker: the toolbar button shows the chosen floor; its list opens below it and closes on a choice.
    floorPicked(floor) {
      const swatch = this.element?.querySelector?.("[data-floor-current-swatch]"), name = this.element?.querySelector?.("[data-floor-current-name]");
      swatch?.style?.setProperty("--swatch", pickColour(floor));
      if (name) name.textContent = pickName(floor);
      this.floorMenu(false);
    }

    floorMenu(open) {
      const pop = this.element?.querySelector?.("[data-floor-pop]"), toggle = this.element?.querySelector?.("[data-floor-toggle]");
      if (!pop) return;
      pop.hidden = !open;
      toggle?.setAttribute?.("aria-expanded", String(!!open));
    }

    setHighlight(id) {
      if (id === (this.highlight ?? "")) return;
      this.highlight = id;
      for (const item of this.element.querySelectorAll(".an-floors-row")) item.classList.toggle("on", item.dataset.id === id);
      this.paint();
    }

    // Listeners live on the frame, which a re-render keeps. A closed window comes back with a new frame.
    _onRender() {
      this.resizeObserver?.disconnect();
      const frame = this.element.querySelector(".an-floors-frame");
      if (frame) {
        frame.addEventListener("wheel", (event) => {
          event.preventDefault();
          this.zoomMap((this.zoom ?? 1) * (event.deltaY < 0 ? 1.2 : 1 / 1.2), { x: event.clientX, y: event.clientY });
        }, { passive: false });
        frame.addEventListener("pointerdown", (event) => {
          if (event.button !== 0 && event.button !== 1) return;
          const canvas = this.element.querySelector("canvas.an-floors-preview");
          const target = this.mode?.kind === "vertices" && this.detect.proposals.find((p) => p.id === this.mode.areaId);
          const hit = target && event.button === 0 && hitOutline(target.loops, event, canvas.getBoundingClientRect(), this.detect.width, this.detect.height);
          this.suppressClick = false;
          if (event.button === 1) { // Middle drag: always pans, in any mode, without the browser's autoscroll
            this.gesture = { kind: "pan", x: event.clientX, y: event.clientY, left: frame.scrollLeft, top: frame.scrollTop, moved: true };
            frame.setPointerCapture(event.pointerId); event.preventDefault();
            return;
          }
          if (event.button === 0 && this.mode?.kind === "split") { // Split: drag a loop around the part
            const at = previewPixel(event, canvas.getBoundingClientRect(), this.detect.width, this.detect.height);
            this.gesture = { kind: "lasso", points: [at.x, at.y] };
            frame.setPointerCapture(event.pointerId); event.preventDefault();
            return;
          }
          if (event.button === 0 && event.shiftKey && this.mode?.kind !== "vertices" && this.smartOn()) { // Shift+drag: a smart box
            const at = previewPixel(event, canvas.getBoundingClientRect(), this.detect.width, this.detect.height);
            this.gesture = { kind: "box", x0: at.x, y0: at.y, x1: at.x, y1: at.y };
            frame.setPointerCapture(event.pointerId); event.preventDefault();
            return;
          }
          if (hit?.vertex !== undefined) {
            this.selectedVertex = hit;
            this.gesture = { kind: "vertex", ...hit, loops: target.loops };
            frame.focus();
            frame.setPointerCapture(event.pointerId);
            this.updateSummary(); this.paint(); event.preventDefault();
          } else this.gesture = { kind: "pan", x: event.clientX, y: event.clientY, left: frame.scrollLeft, top: frame.scrollTop, moved: false };
        });
        frame.addEventListener("pointermove", (event) => {
          const gesture = this.gesture;
          if (!gesture) return;
          if (gesture.kind === "lasso") {
            const at = previewPixel(event, this.element.querySelector("canvas.an-floors-preview").getBoundingClientRect(), this.detect.width, this.detect.height);
            const n = gesture.points.length;
            if (Math.hypot(at.x - gesture.points[n - 2], at.y - gesture.points[n - 1]) >= 1.5) { gesture.points.push(at.x, at.y); this.paint(); }
            event.preventDefault(); return;
          }
          if (gesture.kind === "box") {
            const at = previewPixel(event, this.element.querySelector("canvas.an-floors-preview").getBoundingClientRect(), this.detect.width, this.detect.height);
            gesture.x1 = at.x; gesture.y1 = at.y; this.paint(); event.preventDefault(); return;
          }
          if (gesture.kind === "vertex") {
            const canvas = this.element.querySelector("canvas.an-floors-preview");
            gesture.loops = changeVertex(gesture.loops, { ...gesture, ...outlinePoint(event, canvas.getBoundingClientRect(), this.detect.width, this.detect.height) });
            this.paint(); event.preventDefault(); return;
          }
          const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
          if (!gesture.moved && Math.hypot(dx, dy) < 5) return;
          gesture.moved = true;
          frame.setPointerCapture(event.pointerId);
          frame.scrollLeft = gesture.left - dx;
          frame.scrollTop = gesture.top - dy;
          event.preventDefault();
        });
        const finish = (cancel) => {
          const gesture = this.gesture;
          if (!gesture) return;
          this.gesture = null;
          this.suppressClick = gesture?.kind === "vertex" || gesture?.kind === "box" || gesture?.kind === "lasso" || gesture?.moved === true;
          if (gesture?.kind === "lasso" && !cancel && gesture.points.length >= 6) this.splitArea(this.mode?.areaId, gesture.points);
          if (gesture?.kind === "vertex" && !cancel) this.commitOutline(gesture.loops);
          if (gesture?.kind === "box" && !cancel && Math.abs(gesture.x1 - gesture.x0) >= 4 && Math.abs(gesture.y1 - gesture.y0) >= 4) {
            void this.smartMark({ box: [gesture.x0, gesture.y0, gesture.x1, gesture.y1] });
          }
          this.paint();
        };
        frame.addEventListener("pointerup", () => finish(false));
        frame.addEventListener("pointercancel", () => finish(true));
        frame.addEventListener("lostpointercapture", () => finish(true));
        frame.addEventListener("auxclick", (event) => { if (event.button === 1) event.preventDefault(); });
        frame.addEventListener("pointerleave", () => { if (this.gesture?.kind === "pan" && !this.gesture.moved) this.gesture = null; });
        // A right-click on a stray spot of an area removes it; in Smart, a right-click inside an area cuts out the clicked thing.
        frame.addEventListener("contextmenu", (event) => {
          if (!event.target.closest?.("canvas.an-floors-preview") || this.mode?.kind === "vertices") return;
          event.preventDefault();
          const at = previewPixel(event, event.target.getBoundingClientRect(), this.detect.width, this.detect.height);
          if (this.removeSpot(at)) return;
          if (this.smartOn()) return void this.smartMark({ remove: at });
          if (this.areaAt(at)) hooks.notify?.("Right-click removes a stray spot or a thin finger of an area. To cut something else out, switch to Smart.");
        });
        frame.addEventListener("dblclick", (event) => {
          if (this.mode?.kind !== "vertices") return;
          const canvas = this.element.querySelector("canvas.an-floors-preview");
          const target = this.detect.proposals.find((p) => p.id === this.mode.areaId);
          const hit = hitOutline(target.loops, event, canvas.getBoundingClientRect(), this.detect.width, this.detect.height);
          if (hit?.edge !== undefined) {
            this.selectedVertex = null;
            this.commitOutline(changeVertex(target.loops, { ...hit, vertex: hit.edge, action: "insert" }));
          }
          event.preventDefault();
        });
        this.resizeObserver = new ResizeObserver(() => this.zoomMap(this.zoom ?? 1));
        this.resizeObserver.observe(frame);
        this.zoomMap(this.zoom ?? 1);
      }
      if (this.wiredTo === this.element) return;
      this.wiredTo = this.element;
      this.element.addEventListener("keydown", (event) => {
        if (this.mode?.kind === "split" && event.key === "Escape") { event.preventDefault(); event.stopPropagation(); if (this.gesture) { this.gesture = null; this.paint(); } else this.setMode({ kind: "inspect" }); return; }
        if (this.mode?.kind !== "vertices") return;
        if (event.key !== "Escape" && event.target.closest?.("input, select, textarea")) return;
        if (event.key === "Escape") {
          event.preventDefault(); event.stopPropagation();
          if (this.gesture) { this.gesture = null; this.suppressClick = true; this.paint(); }
          else this.setMode({ kind: "inspect" });
        }
        if (event.key === "Delete" || event.key === "Backspace") { event.preventDefault(); event.stopPropagation(); this.deleteVertex(); }
      }, { capture: true });
      // Ctrl+Z (Cmd+Z) undoes the last change to the areas, in any tool. A drop-down or slider with focus does not stop it
      // (they have nothing of their own to undo); a text field does. It is heard on the page before Foundry's own undo (which
      // would undo a token move instead), and inside the window it never falls through to that, even with nothing left to
      // undo. With the focus on the page or the board while the window is open, the window still takes it if it has a change.
      const undoKey = (event, fromWindow = false) => {
        if (!(event.ctrlKey || event.metaKey) || event.shiftKey || event.key?.toLowerCase() !== "z" || event.animaterUndo) return;
        const target = event.target, inside = fromWindow || this.element?.contains?.(target) || target === this.element;
        const page = openWindow === this && (!target?.closest || target === globalThis.document?.body || target === globalThis.document?.documentElement || !!target.closest("#board"));
        if (!inside && !page) return;
        if (target?.closest?.("textarea, input[type=text], input[type=number], input:not([type])")) return;
        if (!this.history?.length && !inside) return;
        event.animaterUndo = true;
        event.preventDefault(); event.stopImmediatePropagation?.(); event.stopPropagation();
        if (this.history?.length) this.undoAdd();
      };
      this.element.addEventListener("keydown", (event) => undoKey(event, true));
      if (globalThis.addEventListener && !this.pageUndo) { this.pageUndo = undoKey; globalThis.addEventListener("keydown", undoKey, { capture: true }); }
      // Smart: 1, 2 and 3 switch the last smart area between the model's small, middle and large sizes.
      this.element.addEventListener("keydown", (event) => {
        if (!["1", "2", "3"].includes(event.key) || !this.smartLast || this.mode?.kind === "vertices" || !this.smartOn()) return;
        if (event.target.closest?.("input, select, textarea")) return;
        event.preventDefault();
        void this.smartResize(Number(event.key) - 1);
      });
      this.element.addEventListener("mouseover", (event) => this.setHighlight(event.target.closest?.("[data-id]")?.dataset.id ?? ""));
      this.element.addEventListener("mouseleave", () => this.setHighlight(""));
      this.element.addEventListener("change", (event) => {
        if (["[data-id]", "[data-all-kind]", "[data-all-flow]", "[data-all-current]", "[data-all-texture]"].some((sel) => event.target.closest?.(sel)) && this.lastChoices) {
          this.history ??= [];
          this.history.push({ proposals: [...this.detect.proposals], choices: this.lastChoices, excluded: { ...(this.excluded ?? {}) }, settings: true });
          if (this.history.length > 20) this.history.shift();
        }
        if (event.target.closest?.("[data-all-kind]")) {
          applyShared(this.element, "data-kind", event.target.value);
          for (const row of this.element.querySelectorAll("[data-id]")) if (row.querySelector("[data-pick]").checked) updateKindFields(row);
        }
        if (event.target.closest?.("[data-all-flow]")) applyShared(this.element, "data-flow", event.target.value);
        if (event.target.closest?.("[data-all-current]")) applyShared(this.element, "data-current", event.target.value);
        if (event.target.closest?.("[data-all-texture]")) applyShared(this.element, "data-texture", event.target.value);
        if (event.target.closest?.("select[data-floor]")) event.target.closest("[data-id]")?.removeAttribute?.("data-learned"); // the GM's own pick now
        if (event.target.closest?.("select[data-kind]") || event.target.closest?.("select[data-floor]")) updateKindFields(event.target.closest("[data-id]"));
        if (event.target.closest?.("select[data-floor]")) this.paint();
        if (event.target.closest?.("[data-pick]") || event.target.closest?.("[data-over-water]")) updateRowMeta(event.target.closest("[data-id]"));
        if (event.target.closest?.("[data-texture], [data-pattern], [data-edge]")) { updateTextureFields(event.target.closest("[data-id]")); this.paint(); this.fitInspector(); }
        if (event.target.closest?.("[data-all-texture]")) { for (const row of this.element.querySelectorAll("[data-id]")) updateTextureFields(row); this.paint(); }
        if (event.target.closest?.("[data-add-floor-option]")) this.floorPicked(event.target.value);
        if (event.target.closest?.("[data-keep-colours]")) writePrefs({ keepColours: event.target.checked === true });
        if (event.target.closest?.("[data-select-mode]") || event.target.closest?.("[data-select-mode-option]")) void this.selectionChanged(event.target);
        if (event.target.closest?.("[data-add-floor-option]")) { writePrefs({ addFloor: event.target.value }); this.smartStatus(toolStatus(sharedChoices(this.element).selection, event.target.value)); }
        this.updateSummary();
      });
      this.element.addEventListener("click", (event) => {
        const zoom = event.target.closest?.("[data-zoom]");
        if (zoom) return this.zoomMap(zoom.dataset.zoom === "fit" ? 1 : (this.zoom ?? 1) * (zoom.dataset.zoom === "in" ? 1.5 : 1 / 1.5));
        if (event.target.closest?.("[data-floor-toggle]")) return this.floorMenu(this.element.querySelector("[data-floor-pop]")?.hidden);
        if (!event.target.closest?.("[data-floor-picker]")) this.floorMenu(false);
        if (event.target.closest?.("[data-undo-toolbar]")) return this.undoAdd();
        if (event.target.closest?.("[data-auto-mark]")) return void this.markClicked();
        const size = event.target.closest?.("[data-size]");
        if (size) return void this.smartResize(Number(size.dataset.size));
        const edit = event.target.closest?.("[data-edit-outline]");
        if (edit) return this.setMode({ kind: "vertices", areaId: edit.dataset.editOutline });
        if (event.target.closest?.("[data-delete-vertex]")) return this.deleteVertex();
        if (event.target.closest?.("[data-smooth-outline]") && this.mode?.kind === "vertices") {
          const target = this.detect.proposals.find((p) => p.id === this.mode.areaId);
          this.selectedVertex = null;
          return this.commitOutline(smoothOutline(target.loops));
        }
        const add = event.target.closest?.("[data-add-to]");
        if (add) return this.setAddTarget(add.dataset.addTo);
        if (event.target.closest?.("[data-add-done]")) return this.setAddTarget(null);
        if (event.target.closest?.("[data-undo-add]")) return this.undoAdd();
        const remove = event.target.closest?.("[data-remove]");
        if (remove) return this.removeRow(remove.dataset.remove);
        const split = event.target.closest?.("[data-split]");
        if (split) return this.setMode(this.mode?.kind === "split" && this.mode.areaId === split.dataset.split ? { kind: "inspect" } : { kind: "split", areaId: split.dataset.split });
        const tidy = event.target.closest?.("[data-tidy]");
        if (tidy) return this.tidyArea(tidy.dataset.tidy);
        if (event.target.closest?.("[data-tidy-all]")) return void this.tidyAll();
        if (event.target.closest?.("[data-create]")) return void this.create();
        if (event.target.closest?.("[data-combine-ticked]")) return this.combineTicked();
        if (event.target.closest?.("canvas.an-floors-preview")) return this.clickPreview(event);
        const row = event.target.closest?.(".an-floors-row");
        if (row && !event.target.closest("input, select, label, button, .an-inspector")) this.select(row.dataset.id === this.selectedId ? "" : row.dataset.id);
      });
    }

    async close(options = {}) {
      if (!options.force && this.detect && this.element) {
        const lost = untickedGeometryEdits(this.detect.proposals, choicesFromElement(this.element));
        if (lost.length && !(await hooks.confirm?.(untickedGeometryMessage(lost.length)))) return this;
      }
      const out = await super.close(options);
      this.resizeObserver?.disconnect();
      if (this.pageUndo) { globalThis.removeEventListener?.("keydown", this.pageUndo, { capture: true }); this.pageUndo = null; }
      clearTimeout(this.tileTimer); clearTimeout(this.snapTimer); this.snap = null;
      if (openWindow === this) openWindow = null;
      this.detect?.image?.close?.();
      this.detect = null;
      this.history = [];
      return out;
    }

    clickPreview(event) {
      if (this.suppressClick) { this.suppressClick = false; return; }
      if (this.mode?.kind === "vertices") return;
      const { detect } = this;
      const at = previewPixel(event, event.target.getBoundingClientRect(), detect.width, detect.height);
      const shared = sharedChoices(this.element);
      const target = detect.proposals.find((proposal) => proposal.id === (this.mode?.kind === "add" ? this.mode.areaId : null));
      if (target) {
        const pixel = Math.floor(at.y) * detect.width + Math.floor(at.x);
        const source = detect.proposals.find((proposal) => proposal !== target && proposal.pixels.includes(pixel));
        if (source?.regionId) {
          hooks.notify?.("This area is already a saved region. Use its Add to area button to edit it separately.");
          return;
        }
        if (source) return this.combineAreas([source]);
      }
      const floor = target ? this.areaFloor(target) : shared.addFloor;
      const piece = this.excludedPieceAt(floor, at);
      if (piece) return void this.putBack(floor === AUTO_FLOOR ? Object.keys(this.excluded).find((key) => this.excluded[key].includes(piece)) : floor, piece, target);
      if (shared.selection === "smart") return void this.smartMark({ at, target });
      const claimed = this.claimedFor(target);
      const picked = hooks.select(detect.rgba, detect.width, detect.height, at, { claimed, broad: shared.range === "wide" });
      if (picked.status !== "found") {
        hooks.notify?.(clickMessage(picked.reason));
        return;
      }
      this.placePicked(picked.proposal, target, shared);
    }

    // What a new piece may not overlap: every other area, the cuts made in the area being added to, and every part
    // taken out of an area of the same floor (`floor`: the target's, else the floor being added).
    claimedFor(target, floor = target ? this.areaFloor(target) : sharedChoices(this.element).addFloor) {
      const { detect } = this;
      const claimed = target ? detect.proposals.filter((proposal) => proposal !== target) : [...detect.proposals];
      for (const loops of target?.exclusions ?? []) claimed.push({ id: "area-0", pixels: areaPixels(loops, detect.width, detect.height) });
      for (const piece of this.excludedOf(floor)) claimed.push({ id: "area-0", pixels: piece });
      return claimed;
    }

    // The parts taken out of areas of a floor; with Auto (the floor not known yet), of every floor.
    excludedOf(floor) {
      return floor === AUTO_FLOOR ? Object.values(this.excluded ?? {}).flat() : this.excluded?.[floor] ?? [];
    }

    // An area's floor as its row shows it.
    areaFloor(area) {
      const row = choicesFromElement(this.element).find((c) => c.id === area.id);
      const floor = row?.floor ?? area.floor;
      return isAreaFloor(floor) ? floor : "water";
    }

    // Parts taken out of an area of a floor stay out of every later selection of that floor, until the GM clicks one
    // to put it back. Each floor keeps a list of pieces (one per separate part taken out), each a sorted pixel list;
    // the lists are replaced, never changed in place, so undo can keep the earlier ones.
    withExcluded(base, floor, removed) {
      const { width, height } = this.detect;
      return { ...(base ?? {}), [floor]: [...(base?.[floor] ?? []), ...maskPieces(removed, width, height)] };
    }

    excludedPieceAt(floor, at) {
      const pixel = this.pixelOf(at);
      for (const piece of this.excludedOf(floor)) {
        let lo = 0, hi = piece.length - 1;
        while (lo <= hi) { const mid = (lo + hi) >> 1; if (piece[mid] === pixel) return piece; if (piece[mid] < pixel) lo = mid + 1; else hi = mid - 1; }
      }
      return null;
    }

    isExcluded(floor, at) { return !!this.excludedPieceAt(floor, at); }

    // A click on a piece taken out of this floor puts that piece back: into the area being added to, else into an area
    // of the same floor it touches, else as a new area. The other pieces stay out.
    putBack(floor, piece, target) {
      const { detect } = this, { width, height } = detect;
      const near = new Uint8Array(width * height);
      for (const p of piece) {
        const x = p % width; near[p] = 1;
        if (x > 0) near[p - 1] = 1; if (x < width - 1) near[p + 1] = 1; if (p >= width) near[p - width] = 1; if (p < near.length - width) near[p + width] = 1;
      }
      const into = target ?? detect.proposals.find((p) => this.areaFloor(p) === floor && p.pixels.some((px) => near[px]));
      const excluded = { ...this.excluded, [floor]: this.excluded[floor].filter((other) => other !== piece) };
      const before = detect.proposals;
      if (into) {
        // The area's own record of the part as cut goes too, or an edited outline would cut it again.
        const inPiece = new Uint8Array(width * height); for (const p of piece) inPiece[p] = 1;
        const exclusions = (into.exclusions ?? []).filter((loops) => { const px = areaPixels(loops, width, height); let hit = 0; for (const p of px) hit += inPiece[p]; return hit < px.length / 2; });
        this.combineAreas([{ id: "addition", pixels: piece, loops: [] }], { ...into, exclusions }, { quiet: true });
      } else {
        const mask = new Uint8Array(width * height); for (const p of piece) mask[p] = 1;
        const area = smartProposal(mask, width, height, { id: nextAreaId(detect.proposals), claimed: detect.proposals });
        if (area) this.placePicked(area, null);
      }
      if (detect.proposals === before) return false;
      this.excluded = excluded;
      hooks.notify?.("Put back the part you took out. Right-click it to take it out again.");
      return true;
    }

    // A picked piece becomes a new row, or joins the area being added to.
    placePicked(proposal, target, shared = sharedChoices(this.element)) {
      const { detect } = this;
      if (target) {
        const owned = new Uint8Array(detect.width * detect.height);
        for (const pixel of target.pixels) owned[pixel] = 1;
        if (proposal.pixels.every((pixel) => owned[pixel])) {
          hooks.notify?.("That is already part of this area.");
          return false;
        }
        this.combineAreas([{ ...proposal, id: "addition" }]);
        return true;
      }
      this.remember();
      const look = proposal.floor ? null : this.learnedLook(proposal, shared.addFloor);
      if (!proposal.floor) proposal.floor = look?.floor ?? (isAreaFloor(shared.addFloor) ? shared.addFloor : "water"); // a new area takes the floor chosen to add
      if (look) proposal.learned = true;
      detect.proposals.push(proposal);
      this.element.querySelector(".an-floors-reason")?.remove();
      this.element.querySelector(".an-floors-list").insertAdjacentHTML("afterbegin", areaRowHTML(proposal, { ...shared, ...look?.look, ...(textureOf(shared.texture) ? { texture: shared.texture } : {}) }));
      this.element.querySelector(".an-floors-list").scrollTop = 0;
      this.paint();
      this.updateSummary();
      return true;
    }

    // What the saved regions say about a new area: { floor, look } from the most alike one, or null. With Auto the
    // floor is learned too; with a floor picked, only that floor's look. The footer's floor texture, when set, wins.
    learnedLook(proposal, addFloor) {
      const memory = this.memory ?? [];
      if (!memory.length) return null;
      const { rgba, width, height } = this.detect;
      const got = recallFloor(memory, areaSignature(rgba, width, height, proposal.pixels), { floor: addFloor === AUTO_FLOOR ? null : addFloor });
      return got && isAreaFloor(got.floor) ? got : null;
    }

    // Every ticked area teaches the memory its floor and look, keyed by its region so a later save replaces it.
    async learnFrom(picked, plan, createdDocs) {
      if (!hooks.memory?.save) return;
      const { detect } = this, sceneId = detect.scene?.id ?? "";
      const byId = new Map(detect.proposals.map((p) => [p.id, p]));
      const regionOf = new Map((plan.sources ?? []).map((id, i) => [id, createdDocs?.[i]?.id]));
      const entries = [];
      for (const row of picked) {
        const proposal = byId.get(row.id), regionId = proposal?.regionId ?? regionOf.get(row.id);
        if (!row.checked || !proposal || !regionId) continue;
        entries.push({ key: `${sceneId}:${regionId}`, sig: areaSignature(detect.rgba, detect.width, detect.height, proposal.pixels), floor: row.floor, look: row });
      }
      // Areas marked by themselves that the GM removed or left unticked: what not to mark.
      const ticked = new Set(picked.filter((row) => row.checked).map((row) => row.id));
      const kept = new Set(detect.proposals.map((p) => p.id));
      for (const area of [...(this.rejected ?? []).filter((p) => !kept.has(p.id)), ...detect.proposals.filter((p) => p.auto && !p.regionId && !ticked.has(p.id))]) {
        const sig = area.sig ?? areaSignature(detect.rgba, detect.width, detect.height, area.pixels);
        if (sig) entries.push({ key: `${sceneId}:${NONE_FLOOR}:${sig.join(",")}`, sig, floor: NONE_FLOOR, look: {} });
      }
      if (entries.length) await hooks.memory.save(rememberAreas(this.memory, entries));
    }

    // Marks areas by themselves when the window opens, from what the saved regions taught: the model cuts the map into
    // pieces where it is already downloaded and agreed to (no asking here), colour selection elsewhere, and each piece
    // the memory knows the floor of becomes a ticked row. One Ctrl+Z takes them all back.
    learnedCount() { return memoryOf(this.memory).filter((e) => e.floor !== NONE_FLOOR).length; }

    // The Mark areas button: marks now, or says why it can't. Busy while marking.
    async markClicked() {
      if (!knowsFloors(this.memory)) { this.smartStatus(markTip(0)); hooks.notify?.(markTip(0)); return; }
      if (this.marking) return;
      const button = this.element?.querySelector?.("[data-auto-mark]");
      button?.setAttribute?.("aria-busy", "true");
      this.marking = this.autoMark().catch((error) => { console.warn("Animater floor marking:", error); return 0; });
      try { await this.marking; } finally { this.marking = null; button?.removeAttribute?.("aria-busy"); }
    }

    async autoMark() {
      if (!knowsFloors(this.memory) || !this.detect?.rgba) return 0;
      const { detect } = this, { width, height, rgba } = detect;
      let segment = null;
      const agreed = smartAgreed || readPrefs().smartAgreed === SMART_MODEL.repo || !!(await hooks.smartCached?.());
      if (hooks.smart && agreed && !this.smartBusy) {
        this.smartBusy = true;
        try {
          const ready = await this.smartReady();
          if (ready) segment = async (at, claimed) => {
            const r = await ready.model.masks(ready.view, [{ ...at, label: 1 }]);
            const mask = r.masks[startSize(r.masks, r.scores)];
            return mask ? smartProposal(this.keepColours(cleanSelection(mask, width, height, [{ ...at, label: 1 }]), [at]), width, height, { id: "auto", claimed }) : null;
          };
        } catch (error) { console.warn("Animater floor marking:", error); }
        if (!segment) this.smartBusy = false;
      }
      const smart = !!segment;
      segment ??= (at, claimed) => { const r = hooks.select?.(rgba, width, height, at, { claimed }); return r?.status === "found" ? r.proposal : null; };
      try {
        this.smartStatus("Marking areas like the regions you saved…");
        const found = await markAreas({
          width, height, segment, memory: this.memory, claimed: detect.proposals,
          signatureOf: (pixels) => areaSignature(rgba, width, height, pixels),
          progress: (done, total) => this.smartStatus(`Marking areas like the regions you saved… ${Math.round(done / total * 100)}%`),
          stop: () => this.detect !== detect,
        });
        if (this.detect !== detect || !this.element) return 0;
        const shared = sharedChoices(this.element);
        if (found.length) this.remember();
        for (const area of found) {
          const proposal = { ...area, id: nextAreaId(detect.proposals), preselected: true };
          delete proposal.look;
          detect.proposals.push(proposal);
          this.element.querySelector(".an-floors-reason")?.remove();
          this.element.querySelector(".an-floors-list")?.insertAdjacentHTML("beforeend", areaRowHTML(proposal, { ...shared, ...area.look, ...(textureOf(shared.texture) ? { texture: shared.texture } : {}) }));
        }
        if (found.length) { this.paint(); this.updateSummary(); }
        const msg = found.length ? `Marked ${found.length} area${found.length === 1 ? "" : "s"} like the regions you saved. Untick or remove the wrong ones: they won't be marked next time.` : "Nothing here looks like the regions you saved yet.";
        this.smartStatus(msg);
        return found.length;
      } finally {
        if (smart) this.smartBusy = false;
      }
    }

    smartOn() { return sharedChoices(this.element).selection === "smart"; }

    // The last smart area or cut, which 1-3 resize. The Size control on the map shows while there is one.
    get smartLast() { return this._smartLast ?? null; }
    set smartLast(value) { this._smartLast = value ?? null; this.drawSizes(); }

    drawSizes() {
      const pick = this.element?.querySelector?.("[data-size-pick]");
      if (!pick) return;
      const last = this._smartLast, live = !!last && !!this.detect?.proposals?.includes(last.area) && this.smartOn();
      pick.hidden = !live;
      for (const button of pick.querySelectorAll?.("[data-size]") ?? []) button.setAttribute("aria-pressed", String(live && Number(button.dataset.size) === last.size));
    }

    // A smart mask kept to the colours around `seeds`, when Same colours is on.
    keepColours(mask, seeds = []) {
      if (!seeds?.length || !sharedChoices(this.element).keepColours) return mask;
      const { rgba, width, height } = this.detect;
      return keepToColours(mask, rgba, width, height, seeds).mask;
    }

    smartStatus(text) { const node = this.element?.querySelector("[data-smart-status]"); if (node) { node.textContent = text; node.title = helpTip(text); } }

    // Smart or Colour. Smart asks before its first download; declining goes back to Colour.
    setSelection(value) {
      const radio = this.element.querySelector(`[data-select-mode-option][value="${value}"]`);
      if (radio) radio.checked = true;
      const select = this.element.querySelector("[data-select-mode]");
      if (select) select.value = value;
      const keep = this.element.querySelector("[data-smart-only]");
      if (keep) keep.hidden = value !== "smart";
      const range = this.element.querySelector("[data-colour-only]");
      if (range) range.hidden = value === "smart";
      this.smartStatus(toolStatus(value, sharedChoices(this.element).addFloor));
    }

    async selectionChanged(select) {
      const value = select.value === "smart" ? "smart" : "colour";
      this.setSelection(value);
      writePrefs({ selection: value });
      if (value !== "smart") { this.smartLast = null; return; }
      if (!(await this.smartReady())) { this.setSelection("colour"); writePrefs({ selection: "colour" }); }
    }

    // The model, ready on this map: asks before the first download, then loads it and reads the map once.
    async smartReady() {
      const { detect } = this;
      if (this.smart?.detect === detect) return this.smart;
      if (!hooks.smart) { hooks.warn?.("Experimental. Smart selection is not available here."); return null; }
      // Asked once per browser: an earlier yes is remembered, and a model already in the cache needs no download.
      if (!smartAgreed && readPrefs().smartAgreed !== SMART_MODEL.repo && !(await hooks.smartCached?.())) {
        if (!(await hooks.confirm?.(SMART_CONSENT))) return null;
      }
      smartAgreed = true;
      writePrefs({ smartAgreed: SMART_MODEL.repo });
      try {
        this.smartStatus(`Loading ${SMART_MODEL.name}…`);
        const model = await hooks.smart({ onProgress: (loaded, total) => this.smartStatus(`Downloading ${SMART_MODEL.name}: ${(loaded / 1e6).toFixed(0)} of ${(total / 1e6).toFixed(0)} MB. It stays in this browser afterwards.`) });
        this.smartStatus("Reading the map with the model…");
        const view = await model.read(detect.rgba, detect.width, detect.height);
        if (this.detect !== detect) return null;
        this.smart = { detect, model, view };
        this.smartStatus(SMART_HELP);
        if (model.device !== "webgpu") hooks.notify?.("Smart selection is running on the CPU: no WebGPU in this browser, so it is slower.");
        return this.smart;
      } catch (error) {
        console.warn("Animater smart selection:", error);
        this.smartStatus("Smart selection could not load. Colour selection still works.");
        hooks.warn?.(`Experimental. Smart selection could not load: ${error.message}`);
        return null;
      }
    }

    // One smart mark. `at`: a click (checked against nearby clicks); `box`: a dragged box; `remove`: a right-click
    // taking part away from the last smart area. A click or box in add mode joins the area being added to.
    async smartMark({ at, box, remove, target = null }) {
      if (this.smartBusy) return;
      this.smartBusy = true;
      try {
        const ready = await this.smartReady();
        if (!ready) return;
        const { detect } = this, { width, height } = detect, { model, view } = ready;
        let points, masks, mask, seeds = [];
        if (remove) {
          const base = this.areaAt(remove);
          if (!base) { hooks.notify?.("Right-click inside an area to take that part out of it."); return; }
          const areaMask = this.areaMask(base);
          masks = (await model.masks(view, [{ ...remove, label: 1 }])).masks.map((m) => solidCut(m, width, height, remove));
          // In order, the first that leaves some of the area: the model's part when it is a small part of the area; else
          // the part in the clicked colours (exact, no 1-3 sizes: the model sees the bridge and the pool as one); else
          // the model's bigger part that plainly looks different. A big mixed piece of the model's comes last.
          const pixel = this.pixelOf(remove), cut = { base, areaMask, masks };
          const small = cutStart(masks, areaMask, { pixel });
          const tries = [];
          if (small !== null) tries.push(() => this.smartCut(cut, masks[small], base, { quiet: true }));
          tries.push(() => { const byColour = colourCut(areaMask, detect.rgba, width, height, remove); return byColour ? this.smartCut({ base, areaMask }, byColour, base, { quiet: true }) : false; });
          tries.push(() => { const big = small === null ? cutStart(masks, areaMask, { pixel, rgba: detect.rgba, width }) : null; return big !== null ? this.smartCut(cut, masks[big], base, { quiet: true }) : false; });
          for (const attempt of tries) if (attempt()) return;
          hooks.notify?.("Nothing there to take out: the model sees only the whole area at that spot, in one colour. Zoom in and right-click right on the thing, or use Edit outline.");
          return;
        }
        if (box) {
          points = boxPoints(box);
          const r = await model.masks(view, points);
          masks = r.masks; mask = masks[startSize(masks, r.scores, { box: true })];
          seeds = [{ x: (box[0] + box[2]) / 2, y: (box[1] + box[3]) / 2 }];
        } else {
          const sets = [];
          for (const spot of nearbyClicks(at, width, height)) sets.push((await model.masks(view, [spot])).masks);
          points = [{ ...at, label: 1 }]; masks = sets[0]; mask = consensus(sets, width, height).mask;
          seeds = [at];
        }
        const area = smartProposal(this.keepColours(cleanSelection(mask, width, height, points), seeds), width, height, { id: target ? "addition" : nextAreaId(detect.proposals), claimed: this.claimedFor(target) });
        if (!area) { hooks.notify?.("Nothing new there: that part is already in an area, or too small to be a region. To grow an area, press its + button first."); return; }
        const placed = this.placePicked(area, target);
        // Only a new area can change size or lose a part afterwards; one added into another area is merged.
        this.smartLast = placed && !target ? { area, points, masks, seeds, size: sizeOf(masks, mask) } : null;
      } catch (error) {
        console.warn("Animater smart selection:", error);
        hooks.warn?.(`Experimental. Smart selection failed: ${error.message}`);
      } finally {
        this.smartBusy = false;
      }
    }

    // Switch the last smart area to the model's small (0), middle (1) or large (2) size.
    async smartResize(which) {
      const last = this.smartLast;
      if (!last || this.smartBusy) return;
      const mask = last.masks[sizeOrder(last.masks)[which]];
      if (last.cut) return this.smartCut(last.cut, mask, last.area);
      this.smartReplace(last, mask);
    }

    // Cut `mask` out of the area `cut.base`, keeping its row, settings and saved region. `replacing` is the area a
    // previous size of this same cut made, swapped back to the area before the cut. Undo brings the old one back.
    // A cut without `masks` (a spot) cannot be resized, and is cut as it is, with no rim.
    smartCut(cut, mask, replacing = cut.base, { quiet = false } = {}) {
      const { detect } = this, { width, height } = detect;
      if (!detect.proposals.includes(replacing)) { this.smartLast = null; hooks.notify?.("That area has changed since. Right-click it again."); return; }
      const { mask: kept, removed } = cutFrom(cut.areaMask, mask, width, height, cut.masks ? 1 : 0);
      const others = detect.proposals.filter((p) => p !== replacing);
      const traced = smartProposal(kept, width, height, { id: cut.base.id, claimed: others });
      if (!traced) { if (!quiet) hooks.notify?.("That would take out the whole area. Use its Remove button instead, or try another size (1–3)."); return false; }
      const removedPixels = []; for (let p = 0; p < removed.length; p++) if (removed[p]) removedPixels.push(p);
      const removedLoops = removedPixels.length ? mergeAreaProposals([{ id: "cut", pixels: Int32Array.from(removedPixels) }], width, height).loops : [];
      const area = {
        ...cut.base, pixels: traced.pixels, loops: traced.loops, vertices: traced.vertices, share: traced.share,
        geometryChanged: true, exclusions: [...(cut.base.exclusions ?? []), ...(removedLoops.length ? [removedLoops] : [])],
      };
      const choices = choicesFromElement(this.element);
      this.remember();
      // A resize of the same cut starts again from the list before the cut, so a smaller size frees what a larger one took.
      cut.excludedBefore ??= this.excluded ?? {};
      this.excluded = this.withExcluded(cut.excludedBefore, this.areaFloor(cut.base), removed);
      detect.proposals = detect.proposals.map((p) => (p === replacing ? area : p));
      this.smartLast = cut.masks ? { cut, area, masks: cut.masks, size: sizeOf(cut.masks, mask) } : null;
      this.drawRows(choices);
      return true;
    }

    // The read pixel under a point on the map, the area there, and an area as a pixel mask.
    pixelOf({ x, y }) {
      const { width, height } = this.detect;
      return Math.min(height - 1, Math.max(0, Math.floor(y))) * width + Math.min(width - 1, Math.max(0, Math.floor(x)));
    }

    areaAt(at) {
      const pixel = this.pixelOf(at);
      return this.detect.proposals.find((p) => p.pixels?.includes(pixel)) ?? null;
    }

    areaMask(area) {
      const mask = new Uint8Array(this.detect.width * this.detect.height);
      for (const p of area.pixels) mask[p] = 1;
      return mask;
    }

    // A right-click on a stray spot of an area, or on a thin finger of it: that part goes. False when there is none.
    removeSpot(at) {
      const base = this.areaAt(at);
      if (!base) return false;
      const { width, height } = this.detect, areaMask = this.areaMask(base);
      const pixel = this.pixelOf(at);
      const spot = spotAt(areaMask, width, height, pixel) ?? sliverAt(areaMask, width, height, pixel);
      if (!spot) return false;
      return this.smartCut({ base, areaMask, masks: null }, spot) === true;
    }

    // Split: the part of an area inside a drawn loop becomes a new area with the same floor and settings, listed
    // right after it, so it can be given its own kind (a waterfall in a river). The original keeps the rest, keeps
    // its saved region, and remembers the part as cut so adding to it later leaves the new area alone.
    splitArea(id, points) {
      const { detect } = this, { width, height } = detect;
      const base = detect.proposals.find((p) => p.id === id);
      if (!base) return false;
      const name = `Area ${id.replace("area-", "")}`;
      const areaMask = this.areaMask(base), inside = new Uint8Array(areaMask.length), rest = new Uint8Array(areaMask.length);
      const loop = new Uint8Array(areaMask.length);
      for (const p of areaPixels([{ points, hole: false }], width, height)) loop[p] = 1;
      let insideCount = 0, restCount = 0;
      for (let p = 0; p < areaMask.length; p++) if (areaMask[p]) { if (loop[p]) { inside[p] = 1; insideCount++; } else { rest[p] = 1; restCount++; } }
      if (!insideCount) { hooks.notify?.(`Drag around part of ${name}.`); return false; }
      if (!restCount) { hooks.notify?.(`That is all of ${name}. Drag around just the part to split off.`); return false; }
      const others = detect.proposals.filter((p) => p !== base);
      const part = smartProposal(inside, width, height, { id: nextAreaId(detect.proposals), claimed: others });
      const kept = smartProposal(rest, width, height, { id: base.id, claimed: others });
      if (!part || !kept) { hooks.notify?.(`That would leave a piece too small to be a region. Drag around more, or less, of ${name}.`); return false; }
      const choices = choicesFromElement(this.element);
      const baseChoice = choices.find((c) => c.id === base.id);
      const added = { ...part, floor: baseChoice?.floor ?? base.floor, preselected: true };
      const shrunk = { ...base, pixels: kept.pixels, loops: kept.loops, vertices: kept.vertices, share: kept.share, geometryChanged: true, exclusions: [...(base.exclusions ?? []), part.loops] };
      this.remember();
      detect.proposals = detect.proposals.flatMap((p) => (p === base ? [shrunk, added] : [p]));
      const at = choices.indexOf(baseChoice);
      if (baseChoice) choices.splice(at + 1, 0, { ...baseChoice, id: added.id, checked: true });
      this.setMode({ kind: "inspect" });
      this.selectedId = added.id;
      this.drawRows(choices);
      this.setHighlight(added.id);
      hooks.notify?.(`Split off as Area ${added.id.replace("area-", "")}, with ${name}'s floor and settings. Change its kind in its row.`);
      return true;
    }

    // The broom: every small separate piece of an area goes, its main body and larger pieces stay.
    tidyArea(id) {
      const base = this.detect.proposals.find((p) => p.id === id);
      if (!base) return;
      const { width, height } = this.detect, areaMask = this.areaMask(base);
      const spots = smallSpots(areaMask, width, height);
      if (!spots) { hooks.notify?.("This area has no small stray spots."); return; }
      if (this.smartCut({ base, areaMask, masks: null }, spots)) this.setHighlight(id);
    }

    // The broom for every area at once, as one undo step. Areas that are only small spots themselves stay.
    tidyAll() {
      const { width, height } = this.detect;
      const work = this.detect.proposals.map((base) => {
        const areaMask = this.areaMask(base);
        return { base, areaMask, spots: smallSpots(areaMask, width, height) };
      }).filter((w) => w.spots);
      if (!work.length) { hooks.notify?.("No area has small stray spots."); return 0; }
      this.remember();
      this.batching = true;
      let done = 0;
      try {
        for (const { base, areaMask, spots } of work) {
          const current = this.detect.proposals.find((p) => p.id === base.id);
          if (current === base && this.smartCut({ base, areaMask, masks: null }, spots)) done++;
        }
      } finally {
        this.batching = false;
      }
      if (!done) { this.history.pop(); hooks.notify?.("No area has small stray spots."); return 0; }
      hooks.notify?.(`Removed small spots from ${done} area${done === 1 ? "" : "s"}. Undo brings them back; click one to put it back.`);
      return done;
    }

    // Replace the last smart area with a new mask, keeping its row and settings. Undo brings the old one back.
    smartReplace(last, mask) {
      const { detect } = this, { width, height } = detect;
      const index = detect.proposals.indexOf(last.area);
      if (index < 0) { this.smartLast = null; hooks.notify?.("That area has changed since. Click to mark a new one."); return; }
      const area = smartProposal(this.keepColours(cleanSelection(mask, width, height, last.points), last.seeds), width, height, { id: last.area.id, claimed: [...detect.proposals.filter((p) => p !== last.area), ...(this.excluded?.[this.areaFloor(last.area)] ?? []).map((pixels) => ({ id: "area-0", pixels }))] });
      if (!area) { hooks.notify?.("That size leaves nothing new. Try another size (1–3)."); return; }
      area.floor = last.area.floor; // the row keeps its floor through a resize
      const choices = choicesFromElement(this.element);
      this.remember();
      detect.proposals = detect.proposals.map((p) => (p === last.area ? area : p));
      this.smartLast = { ...last, area, size: sizeOf(last.masks, mask) };
      this.drawRows(choices);
    }

    removeRow(id) {
      const { detect } = this;
      const proposal = detect.proposals.find((proposal) => proposal.id === id);
      if (proposal?.regionId) {
        const row = [...this.element.querySelectorAll("[data-id]")].find((row) => row.dataset.id === id);
        this.remember();
        row.querySelector("[data-pick]").checked = false;
        this.updateSummary();
        return;
      }
      this.remember();
      if (proposal?.auto) (this.rejected ??= []).push(proposal); // marked by itself and removed: not a region, next time
      if (this.mode?.areaId === id) this.setMode({ kind: "inspect" });
      detect.proposals = detect.proposals.filter((proposal) => proposal.id !== id);
      for (const row of this.element.querySelectorAll(".an-floors-row")) if (row.dataset.id === id) row.remove();
      if (this.highlight === id) this.highlight = "";
      this.paint();
      this.updateSummary();
    }

    async create() {
      if (this.saving) return;
      this.saving = true;
      this.updateSummary();
      try {
        const { detect } = this;
        const picked = choicesFromElement(this.element);
        const lost = untickedGeometryEdits(detect.proposals, picked);
        if (lost.length && !(await hooks.confirm?.(untickedGeometryMessage(lost.length)))) return;
        const plan = planFloorCreate({
          proposals: detect.proposals,
          picked,
          sceneRect: detect.sceneRect,
          imageWidth: detect.width,
          imageHeight: detect.height,
          levelId: detect.levelId,
          regions: detect.scene.regions,
        });
        let createdDocs = [];
        const outcome = await commitFloorPlan(plan, { scene: detect.scene, notify: hooks.notify, created: (docs) => { createdDocs = docs; } });
        if (!outcome.cancelled && outcome.created + outcome.updated > 0) await this.learnFrom(picked, plan, createdDocs).catch((error) => console.warn("Animater floor memory:", error));
        if (!outcome.cancelled && outcome.created + outcome.updated > 0) {
          hooks.notify?.(`${outcome.created ? `Created ${outcome.created} region${outcome.created === 1 ? "" : "s"}.` : ""}${outcome.updated ? ` Updated ${outcome.updated} saved region${outcome.updated === 1 ? "" : "s"}.` : ""}`.trim());
          await this.close({ force: true });
        }
      } catch (error) {
        const detail = typeof error?.message === "string" && /Reopen the generator/.test(error.message)
          ? `Experimental. ${error.message}`
          : "Experimental. The regions could not be saved.";
        hooks.warn?.(detail);
        console.warn("Animater floor regions:", error);
      } finally {
        this.saving = false;
        if (this.detect) this.updateSummary();
      }
    }
  };
}

// The window writes to `scene`, the scene open at the click, even if the GM has moved on. A second click replaces the
// window. A click for the same map during an open joins it: two opens racing to close and render one window id break
// Foundry's render. A click for another scene or level wins, because the GM has moved on from the first one.
let openWindow = null;
let pending = null;
let smartAgreed = false; // the GM agreed to the smart model's download on this page

export function openFloorRegions(options = {}) {
  const key = `${options.scene?.id}|${options.levelId}|${options.src}`;
  if (pending?.key === key) {
    options.notify?.("Experimental. Still reading this map.");
    return pending.promise;
  }
  pending?.controller.abort();
  const entry = { key, controller: new AbortController() };
  entry.promise = openOnce(options, entry.controller.signal).finally(() => { if (pending === entry) pending = null; });
  pending = entry;
  return entry.promise;
}

async function openOnce({
  src,
  scene,
  sceneRect,
  levelId,
  textures,
  notify = (message) => globalThis.ui?.notifications?.info?.(message),
  warn = (message) => globalThis.ui?.notifications?.warn?.(message),
  confirm = (content) => globalThis.foundry?.applications?.api?.DialogV2.confirm?.({
    window: { title: "Experimental floor regions" },
    content: `<p>${content}</p>`,
  }),
  load = loadMapRgba,
  detect = detectWater,
  select = selectColourAt,
  smart = loadSmartModel,
  smartCached = globalThis.caches ? isSmartModelCached : null,
  view = globalThis.createImageBitmap ? loadMapView : null,
  grid = 100,
  tile = null,
  snapshot = null,
  memory = floorMemoryStore(),
  autoMark = true,
  Application = globalThis.foundry?.applications?.api?.ApplicationV2,
} = {}, signal) {
  if (!src) {
    warn(failureMessage("fetch"));
    return { opened: false, reason: "fetch" };
  }
  if (!(sceneRect?.width > 0) || !(sceneRect?.height > 0)) {
    warn("Experimental. This scene has no map size yet.");
    return { opened: false, reason: "scene" };
  }
  if (!levelMapIsPlain(textures)) {
    warn("Experimental. This level's background is moved, scaled or rotated in its configuration, so shapes read from the image would land in the wrong place. Reset its position to use this tool.");
    return { opened: false, reason: "transformed" };
  }
  const loaded = await load(src, fitSize(sceneRect.width, sceneRect.height), { signal });
  if (signal?.aborted) return { opened: false, reason: "superseded" };
  if (!loaded.ok) {
    warn(failureMessage(loaded.reason));
    return { opened: false, reason: loaded.reason };
  }
  const result = detect(loaded.rgba, loaded.width, loaded.height);
  const saved = savedAreaProposals(scene?.regions, { levelId, sceneRect, width: loaded.width, height: loaded.height });
  const fresh = saved.length ? (result.proposals ?? []).map((proposal) => mergeAreaProposals([proposal], loaded.width, loaded.height, { claimed: saved, dropSmallComponents: true }))
    .filter((proposal) => proposal.share >= WATER_TUNING.componentMinShare)
    .map((proposal, i) => ({ ...proposal, id: `area-${saved.length + i + 1}`, preselected: false })) : result.proposals ?? [];
  const proposals = [...saved, ...fresh];
  const Window = floorRegionsWindow(Application, { notify, warn, select, confirm, smart, smartCached, tile, snapshot, memory });
  const app = new Window();
  app.memory = await learnSaved(memory, saved, { scene, rgba: loaded.rgba, width: loaded.width, height: loaded.height });
  app.detect = {
    proposals,
    reason: result.reason ?? "",
    rgba: loaded.rgba,
    width: loaded.width,
    height: loaded.height,
    scene,
    sceneRect,
    levelId,
    grid,
  };
  await openWindow?.close?.();
  if (signal?.aborted) return { opened: false, reason: "superseded" };
  openWindow = app;
  await app.render?.({ force: true });
  if (autoMark) { const marking = Promise.resolve(app.autoMark?.()).catch((error) => { console.warn("Animater floor marking:", error); return 0; }); app.marking = app.firstMark = marking; void marking.then(() => { if (app.marking === marking) app.marking = null; }); }
  // The sharp map follows a moment later; until then the window shows the read.
  if (view) void Promise.resolve(view(src, { width: loaded.width, height: loaded.height })).then((image) => {
    if (!image) return;
    if (app.detect && !app.detect.image) { app.detect.image = image; app.zoomMap?.(app.zoom ?? 1); } else image.close?.();
  }, () => {});
  return { opened: true, app, reason: result.reason };
}

// The floor memory, kept in a world setting (registered here on first use, so it needs nothing at startup).
// { load(): examples, save(examples): promise }, or null outside Foundry.
export const FLOOR_MEMORY_SETTING = "floorMemory";
export function floorMemoryStore(game = globalThis.game, id = "animater") {
  const settings = game?.settings;
  if (!settings?.register) return null;
  const ready = () => {
    if (!settings.settings?.has?.(`${id}.${FLOOR_MEMORY_SETTING}`)) settings.register(id, FLOOR_MEMORY_SETTING, { scope: "world", config: false, type: Array, default: [] });
  };
  return {
    load() { try { ready(); return memoryOf(settings.get(id, FLOOR_MEMORY_SETTING)); } catch { return []; } },
    async save(examples) { ready(); if (game.user?.isGM === false) return; await settings.set(id, FLOOR_MEMORY_SETTING, examples); },
  };
}

// The regions already on the scene teach the memory too (one drawn by hand, or changed in its panel since). Saved only
// when something is new or changed, so opening the window does not write every time. Returns the examples.
export async function learnSaved(store, saved, { scene, rgba, width, height }) {
  const before = store?.load?.() ?? [];
  if (!saved?.length || !store?.save) return before;
  const entries = saved.map((p) => ({ key: `${scene?.id ?? ""}:${p.regionId}`, sig: areaSignature(rgba, width, height, p.pixels), floor: p.savedChoices?.floor ?? p.floor, look: p.savedChoices ?? {} }));
  const old = new Map(before.map((e) => [e.key, e]));
  const same = (e) => { const o = old.get(e.key); return !!o && o.floor === e.floor && JSON.stringify(o.sig) === JSON.stringify(e.sig) && JSON.stringify(o.look) === JSON.stringify(rememberAreas([], [e])[0].look); };
  const changed = entries.filter((e) => !same(e));
  if (!changed.length) return before;
  const after = rememberAreas(before, changed);
  try { await store.save(after); } catch (error) { console.warn("Animater floor memory:", error); }
  return after;
}
