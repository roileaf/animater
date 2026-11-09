// Experimental water proposals. The form, the create plan and the image read are pure and exported.
// The window takes what it needs as options. Nothing here runs until a GM clicks the Regions tool.

import { detectWater } from "../engines/regions/water-detect.mjs";
import { selectWaterAt } from "../engines/regions/floor-select.mjs";
import { waterSelectionPixels, mergeWaterProposals, fitSize, waterProposalFromLoops, WATER_TUNING } from "../engines/regions/floor-trace.mjs";
import { toRegionData, editableWaterRegionIds, WATER_FLAG_KEYS, floorMeta, isDetectFloor, DETECT_FLOORS, FLOOR_META } from "../engines/regions/floor-region-data.mjs";
import { AI_FLOOR_SPIKE } from "../engines/regions/floor-suggest-ai.mjs";
import { WATER_KINDS, WATER_TOWARD, flowChoices, waterFlows, waterKindOf } from "../engines/motion/region-steps.mjs";
import { outlinePoint, hitOutline, changeVertex, validateOutline, smoothOutline, unionOutlines, subtractOutlines } from "../engines/regions/water-outline.mjs";

// Spike module ships with the release graph. Not wired into Floor select yet — see README.
export { AI_FLOOR_SPIKE };

export const FLOW_OPTIONS = Object.freeze(flowChoices());
export const CURRENT_OPTIONS = Object.freeze([
  ["", "Gentle"],
  ["swift", "Swift"],
]);
export const WAVE_OPTIONS = Object.freeze([["", "With the wind"], ...WATER_TOWARD]);
export const FLOOR_OPTIONS = Object.freeze(DETECT_FLOORS.map((floor) => [floor, FLOOR_META[floor].name]));

const NONE = Object.freeze({
  "no-candidates": "Experimental. No blue water was found on this map. Pick a floor above and click it on the map to add it.",
  "no-saturated-colour": "Experimental. The blue on this map is too grey to be water. Roofs and stone look like that.",
  "nothing-left": "Experimental. Only a little strong blue was found, too little to tell water from anything else. A thin river can read this way, so click it if you see one.",
});

const CLICK_NONE = Object.freeze({
  "no-colour": "Experimental. That spot has no clear colour to follow. Click on the floor itself.",
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

const TINTS = ["rgba(44, 160, 190, 0.45)", "rgba(40, 120, 210, 0.45)", "rgba(70, 170, 140, 0.45)", "rgba(90, 110, 200, 0.45)"];

const addLabel = (floor) => (floor === "none" ? "an area with no floor" : floorMeta(floor).name.toLowerCase());

export function floorTint(floor, index = 0) {
  if (!isDetectFloor(floor) || floor === "water") return TINTS[index % TINTS.length];
  const hex = FLOOR_META[floor].color.slice(1);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, 0.6)`;
}

const esc = (text) => String(text).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

export function noneMessage(reason) {
  return NONE[reason] ?? "Experimental. No area was proposed.";
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

export function waterRowHTML(proposal, options = {}) {
  const merged = { ...proposal.savedChoices, ...options };
  const floor = isDetectFloor(merged.floor) ? merged.floor : (isDetectFloor(proposal.floor) ? proposal.floor : "water");
  const { checked = proposal.preselected, waterKind = "still", flowTo = "", current = "", waveTo = "", seaBeach = "" } = merged;
  const id = esc(proposal.id);
  const kind = WATER_KINDS.some(([key]) => key === waterKind) ? waterKind : "still";
  const flows = waterFlows(kind);
  const flow = flowDefault(kind, flowTo);
  const cur = currentDefault(kind, current);
  const wet = floor === "water";
  const warning = proposal.clicked && proposal.share > WATER_TUNING.clickWarnShare
    ? ` <span class="an-water-warn">${percent(proposal.share)} of the map. Check this area.</span>` : "";
  return `<div class="an-water-row" data-id="${id}">
  <label class="an-water-pick"><input type="checkbox" data-pick="${id}"${checked ? " checked" : ""}> <strong>${proposal.regionId ? `Saved: ${esc(proposal.name)}` : `Area ${esc(String(proposal.id).replace("water-", ""))}`}</strong> <span class="an-water-share">${percent(proposal.share)} of map</span> <span class="an-water-vertices">${proposal.vertices} vertices</span>${warning}</label>
  <label>Floor ${optionsHTML(FLOOR_OPTIONS, `data-floor="${id}"`, floor)}</label>
  <label data-water-fields${wet ? "" : " hidden"}>Kind ${optionsHTML(WATER_KINDS, `data-kind="${id}"`, kind)}</label>
  <label data-water-fields data-flow-field${wet && flows ? "" : " hidden"}>Flows toward ${optionsHTML(FLOW_OPTIONS, `data-flow="${id}"`, flow || "s")}</label>
  <label data-water-fields data-current-field${wet && kind === "river" ? "" : " hidden"}>Current ${optionsHTML(CURRENT_OPTIONS, `data-current="${id}"`, cur)}</label>
  <label data-water-fields data-sea-field${wet && kind === "sea" ? "" : " hidden"}>Waves toward ${optionsHTML(WAVE_OPTIONS, `data-wave="${id}"`, waveTo)}</label>
  <label data-water-fields data-sea-field class="an-water-pick"${wet && kind === "sea" ? "" : " hidden"}><input type="checkbox" data-beach="${id}"${seaBeach === "off" ? "" : " checked"}> Beach along the shore</label>
  <button type="button" class="an-water-add" data-add-to="${id}" aria-pressed="false">Add to area</button>
  <button type="button" data-edit-outline="${id}" aria-pressed="false">Edit outline</button>
  <button type="button" class="an-water-remove" data-remove="${id}" >${proposal.regionId ? "Leave unchanged" : "Remove"}</button>
</div>`;
}

export function waterWindowHTML({ proposals, width, height, reason = "", picked = [], shared = {} }) {
  const rows = [...proposals].sort((a, b) => b.share - a.share || String(a.id).localeCompare(String(b.id)));
  const choices = new Map(picked.map((choice) => [choice.id, choice]));
  const verb = proposals.some((proposal) => proposal.regionId) ? "Save" : "Create";
  const selected = rows.filter((proposal) => choices.get(proposal.id)?.checked ?? proposal.preselected).length;
  return `<div class="an-water">
  <header class="an-water-heading"><h2>Review floor areas</h2><p>Experimental. Pick a floor, click it on the map, then review before saving. Water is also found automatically.</p></header>
  ${reason ? `<p class="an-water-reason">${esc(noneMessage(reason))}</p>` : ""}
  <div class="an-water-workspace">
    <section class="an-water-map" aria-label="Map preview">
      <div class="an-water-pickfloor"><label>Click the map to add ${optionsHTML(FLOOR_OPTIONS, "data-floor-to-add", shared.floorToAdd ?? "water")}</label><span class="an-water-swatch" data-floor-swatch style="background:${floorMeta(isDetectFloor(shared.floorToAdd) ? shared.floorToAdd : "water").color}" aria-hidden="true"></span></div>
      <div class="an-water-toolbar"><h3>Map preview</h3><div class="an-water-zoom">
        <button type="button" data-zoom="out" aria-label="Zoom out">−</button><output data-zoom-label aria-live="polite">Fit</output><button type="button" data-zoom="in" aria-label="Zoom in">+</button><button type="button" data-zoom="fit">Fit map</button>
      </div></div>
      <div class="an-water-add-status" data-add-status hidden><p data-add-message></p><div>
        <button type="button" data-undo-add disabled>Undo last change</button>
        <button type="button" data-add-done>Done</button>
        <button type="button" data-smooth-outline title="Smooth outer edges within 2 read pixels per action. Holes stay unchanged." hidden>Smooth outline</button>
        <button type="button" data-delete-vertex hidden>Delete vertex</button>
      </div></div>
      <div class="an-water-frame" tabindex="0" aria-label="Floor preview. Scroll to zoom. Drag to pan. Click to add an area."><div class="an-water-stage"><canvas class="an-water-preview" width="${width}" height="${height}"></canvas></div></div>
      <p class="an-water-help">Scroll to zoom · Drag to pan · Click to add an area</p>
      <div class="an-water-range">
      <label>Click colour range ${optionsHTML([["narrow", "Narrow"], ["wide", "Wide"]], "data-click-range", shared.range ?? "narrow")}</label>
      <p class="an-water-range-note">Wide can join touching colours. Automatic detection still finds water only. Review the preview before creating regions.</p></div>
    </section>
    <section class="an-water-review" aria-label="Floor areas">
      <div class="an-water-toolbar"><h3>Floor areas</h3><span data-area-count>${rows.length} found · ${selected} selected</span></div>
      <details class="an-water-all" open><summary>Water settings for selected areas</summary><p>Changes below apply to every ticked water area.</p><div class="an-water-shared-fields">
        <label>Kind ${optionsHTML(WATER_KINDS, 'data-all-kind=""', shared.waterKind ?? "still")}</label>
        <label data-shared-flow>Flows toward ${optionsHTML(FLOW_OPTIONS, 'data-all-flow=""', shared.flowTo || "s")}</label>
        <label data-shared-current>Current ${optionsHTML(CURRENT_OPTIONS, 'data-all-current=""', shared.current ?? "")}</label>
      </div></details>
      <div class="an-water-list">${rows.map((proposal) => waterRowHTML(proposal, choices.get(proposal.id))).join("")}</div>
      <p class="an-water-empty" data-area-empty${rows.length ? " hidden" : ""}>No areas yet. Pick a floor above, then click it on the map.</p>
    </section>
  </div>
  <footer class="an-water-foot"><span data-selection-count aria-live="polite">${selected} of ${rows.length} areas selected</span><button type="button" data-create${selected ? "" : " disabled"}>${verb} ${selected} region${selected === 1 ? "" : "s"}</button></footer>
</div>`;
}

export function readWaterChoices(rows) {
  return (rows ?? []).map((row) => ({
    id: row.id,
    checked: row.checked === true,
    floor: isDetectFloor(row.floor) ? row.floor : (row.floor || "water"),
    waterKind: row.waterKind ?? "still",
    flowTo: row.flowTo ?? "",
    current: row.current ?? "",
    waveTo: row.waveTo ?? "",
    seaBeach: row.seaBeach ?? "",
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
    });
  }
  return readWaterChoices(rows);
}

export function savedWaterProposals(regions, { levelId, sceneRect, width, height }) {
  const editable = new Set(editableWaterRegionIds(regions, levelId));
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
    const floor = isDetectFloor(own.floor) ? own.floor : "water";
    const kind = waterKindOf(own);
    const savedChoices = { floor, waterKind: kind, flowTo: flowDefault(kind, own.flowTo), current: currentDefault(kind, own.current), waveTo: own.waveTo ?? "", seaBeach: own.seaBeach === "off" ? "off" : "" };
    return { ...waterProposalFromLoops(loops, width, height), id: `water-${index + 1}`, regionId: region.id, name: region.name ?? floorMeta(floor).name, floor, savedChoices, preselected: false };
  }).filter((proposal) => proposal.loops.length).map((proposal, i) => ({ ...proposal, id: `water-${i + 1}` }));
}

export function planWaterCreate({ proposals, picked, sceneRect, imageWidth, imageHeight, levelId, regions }) {
  const byId = new Map((proposals ?? []).map((proposal) => [proposal.id, proposal]));
  const editable = new Set(editableWaterRegionIds(regions, levelId));
  const creates = [], updates = [];
  for (const pickedRow of [...(picked ?? [])].sort((a, b) => (byId.get(b.id)?.share ?? 0) - (byId.get(a.id)?.share ?? 0))) {
    const floor = isDetectFloor(pickedRow.floor) ? pickedRow.floor : (pickedRow.floor || byId.get(pickedRow.id)?.floor || "water");
    const row = {
      ...pickedRow,
      floor,
      flowTo: floor === "water" ? flowDefault(pickedRow.waterKind, pickedRow.flowTo) : "",
      current: floor === "water" ? currentDefault(pickedRow.waterKind, pickedRow.current) : "",
      waterKind: floor === "water" ? (pickedRow.waterKind ?? "still") : "",
      waveTo: floor === "water" ? (pickedRow.waveTo ?? "") : "",
      seaBeach: floor === "water" ? (pickedRow.seaBeach ?? "") : "",
    };
    if (!row.checked) continue;
    const proposal = byId.get(row.id);
    if (!proposal) continue;
    const data = toRegionData(proposal, { sceneRect, imageWidth, imageHeight, levelId, floor: row.floor,
      waterKind: row.waterKind, flowTo: row.flowTo, current: row.current, waveTo: row.waveTo, seaBeach: row.seaBeach });
    if (!proposal.regionId) { creates.push(data); continue; }
    if (!editable.has(proposal.regionId)) throw new Error("The saved region is no longer editable on this level. Reopen the generator.");
    const patch = { _id: proposal.regionId };
    if (proposal.geometryChanged) patch.shapes = data.shapes;
    const before = proposal.savedChoices ?? {};
    const own = data.flags.animater;
    const beforeFloor = before.floor ?? "water";
    if (row.floor !== beforeFloor) {
      patch["flags.animater.floor"] = own.floor ?? "";
      if (row.floor === "water") patch["flags.animater.overWater"] = false;
      patch.color = floorMeta(row.floor).color;
    }
    if (row.floor === "lava" && beforeFloor !== "lava") {
      for (const [key, value] of Object.entries(own)) {
        if (key === "generated") continue;
        patch[`flags.animater.${key}`] = value ?? "";
      }
    }
    const leftWater = beforeFloor === "water" && row.floor !== "water";
    if (leftWater) {
      for (const key of WATER_FLAG_KEYS) patch[`flags.animater.${key}`] = "";
    } else if (row.floor === "water") {
      const kindChanged = row.waterKind !== before.waterKind;
      for (const key of WATER_FLAG_KEYS) {
        if (row[key] !== before[key] || (kindChanged && ["flowTo", "current"].includes(key))) patch[`flags.animater.${key}`] = own[key] ?? "";
      }
    }
    if (Object.keys(patch).length > 1) updates.push(patch);
  }
  creates.forEach((data, i) => {
    const label = floorMeta(data.flags.animater.floor).name;
    data.name = creates.length === 1 ? label : `${label} ${i + 1}`;
  });
  return { creates, updates };
}

export async function commitWaterPlan(plan, { scene, notify } = {}) {
  if (!plan.creates.length && !plan.updates.length) {
    notify?.("No changes to save. Tick an edited or new area first.");
    return { created: 0, updated: 0 };
  }
  if (plan.updates.length) await scene.updateEmbeddedDocuments("Region", plan.updates);
  if (plan.creates.length) await scene.createEmbeddedDocuments("Region", plan.creates);
  return { created: plan.creates.length, updated: plan.updates.length };
}

export function paintWaterPreview(ctx, rgba, width, height, proposals, highlightId = "", floors = new Map()) {
  if (!ctx || !width || !height) return;
  if (rgba) ctx.putImageData(new ImageData(new Uint8ClampedArray(rgba), width, height), 0, 0);
  else ctx.clearRect(0, 0, width, height);
  proposals.forEach((proposal, index) => {
    ctx.beginPath();
    for (const loop of proposal.loops ?? []) {
      const points = loop.points ?? [];
      if (points.length < 6) continue;
      ctx.moveTo(points[0], points[1]);
      for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1]);
      ctx.closePath();
    }
    const hot = proposal.id === highlightId;
    ctx.fillStyle = floorTint(floors.get(proposal.id) ?? proposal.floor, index);
    ctx.fill("evenodd");
    ctx.lineWidth = hot ? 3 : 1;
    ctx.strokeStyle = hot ? "rgba(255, 210, 80, 0.95)" : "rgba(220, 245, 255, 0.35)";
    ctx.stroke();
  });
}

function applyShared(root, attribute, value) {
  const checked = new Set([...root.querySelectorAll("[data-pick]:checked")].map((box) => box.dataset.pick));
  for (const select of root.querySelectorAll(`[${attribute}]`)) {
    const id = select.getAttribute(attribute);
    if (!id || !checked.has(id)) continue;
    const floor = root.querySelector(`select[data-floor="${id}"]`)?.value;
    if (floor && floor !== "water") continue;
    select.value = value;
  }
}

function sharedChoices(root) {
  return {
    floorToAdd: root.querySelector("[data-floor-to-add]")?.value ?? "water",
    waterKind: root.querySelector("[data-all-kind]")?.value ?? "still",
    flowTo: root.querySelector("[data-all-flow]")?.value ?? "s",
    current: root.querySelector("[data-all-current]")?.value ?? "",
    range: root.querySelector("[data-click-range]")?.value ?? "narrow",
  };
}

function untickedGeometryEdits(proposals, picked) {
  const checked = new Map((picked ?? []).map((row) => [row.id, row.checked === true]));
  return (proposals ?? []).filter((proposal) => proposal.geometryChanged && !checked.get(proposal.id));
}

function untickedGeometryMessage(count) {
  return `Experimental. ${count === 1 ? "An unticked area has outline edits" : `${count} unticked areas have outline edits`} that will be discarded. Tick ${count === 1 ? "it" : "them"} to save the outline, or continue to discard.`;
}

function updateFloorFields(row) {
  const floor = row.querySelector("select[data-floor]")?.value ?? "water";
  row.dataset.floor = floor;
  const wet = floor === "water";
  for (const field of row.querySelectorAll("[data-water-fields]")) field.hidden = !wet;
  if (!wet) return;
  const kind = row.querySelector("[data-kind]")?.value ?? "still";
  const flow = row.querySelector("[data-flow]");
  const current = row.querySelector("[data-current]");
  if (flow) flow.value = flowDefault(kind, flow.value) || "s";
  if (current) current.value = currentDefault(kind, current.value);
  const flowField = row.querySelector("[data-flow-field]");
  const currentField = row.querySelector("[data-current-field]");
  if (flowField) flowField.hidden = !waterFlows(kind);
  if (currentField) currentField.hidden = kind !== "river";
  for (const field of row.querySelectorAll("[data-sea-field]")) field.hidden = kind !== "sea";
}

function updateKindFields(row) {
  updateFloorFields(row);
}

// `detect` is what the window works on: the pixels, the rows so far, and the scene and level as they were at open.
export function waterDetectWindow(ApplicationV2, hooks = {}) {
  return class WaterDetect extends ApplicationV2 {
    mode = { kind: "inspect" };
    static DEFAULT_OPTIONS = {
      id: "animater-water-detect",
      classes: ["animater", "animater-water"],
      window: { title: "Experimental: detect floor regions", icon: "fa-solid fa-border-all", resizable: true },
      position: { width: 1000, height: 760 },
    };

    async _renderHTML() {
      const { proposals, width, height, reason } = this.detect;
      return waterWindowHTML({ proposals, width, height, reason: proposals.length ? "" : reason });
    }

    _replaceHTML(html, content) {
      const before = choicesFromElement(content);
      content.innerHTML = before.length || content.querySelector("[data-floor-to-add]") ? waterWindowHTML({ ...this.detect, reason: this.detect.proposals.length ? "" : this.detect.reason, picked: before, shared: sharedChoices(content) }) : html;
      this.paint();
      this.updateSummary();
      this.zoomMap(this.zoom ?? 1);
    }

    paint() {
      const canvas = this.element?.querySelector("canvas.an-water-preview");
      const { detect } = this;
      if (!canvas || !detect) return;
      paintWaterPreview(canvas.getContext("2d", { willReadFrequently: true }), detect.rgba, detect.width, detect.height, detect.proposals, this.mode?.areaId || this.highlight || "", new Map(choicesFromElement(this.element).map((row) => [row.id, row.floor])));
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
      const kind = sharedChoices(this.element).waterKind;
      const flowField = this.element.querySelector("[data-shared-flow]");
      const currentField = this.element.querySelector("[data-shared-current]");
      if (flowField) flowField.hidden = !waterFlows(kind);
      if (currentField) currentField.hidden = kind !== "river";
      const total = this.detect.proposals.length;
      const selected = choicesFromElement(this.element).filter((row) => row.checked).length;
      const setText = (selector, text) => { const node = this.element.querySelector(selector); if (node) node.textContent = text; };
      setText("[data-area-count]", `${total} found · ${selected} selected`);
      setText("[data-selection-count]", `${selected} of ${total} areas selected`);
      const verb = this.detect.proposals.some((proposal) => proposal.regionId) ? "Save" : "Create";
      const button = this.element.querySelector("[data-create]");
      if (button) { button.textContent = this.saving ? "Creating regions…" : `${verb} ${selected} region${selected === 1 ? "" : "s"}`; button.disabled = !selected || this.saving === true; }
      const empty = this.element.querySelector("[data-area-empty]");
      if (empty) empty.hidden = total > 0;
      const help = this.mode?.kind === "vertices" ? "Drag handles to edit the outline" : this.mode?.kind === "add" ? "Click the missed part to extend this area" : `Click to add ${addLabel(sharedChoices(this.element).floorToAdd)}`;
      setText(".an-water-help", `Scroll to zoom · Drag to pan · ${help}`);
      this.element.querySelector(".an-water-frame")?.setAttribute("aria-label", `Floor preview. Scroll to zoom. Drag to pan. ${help}.`);
      const status = this.element.querySelector("[data-add-status]");
      if (status) {
        status.hidden = !this.mode?.areaId;
        this.element.querySelector("[data-add-message]").textContent = this.mode?.kind === "vertices" ? "Drag a handle. Double-click an edge to insert. Select a handle to delete. Escape cancels a drag, then exits. Checkboxes only choose what to save." : `Adding to Area ${this.mode?.areaId?.replace("water-", "")}. Click the missed part of this floor or another area on the map to add it. Checkboxes only choose which areas to save.`;
        this.element.querySelector("[data-undo-add]").disabled = !this.history?.length;
        for (const button of this.element.querySelectorAll("[data-add-to]")) {
          const active = this.mode?.kind === "add" && button.dataset.addTo === this.mode.areaId;
          button.setAttribute("aria-pressed", String(active));
          button.textContent = active ? "Adding here" : "Add to area";
        }
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
      this.selectedVertex = null;
      this.mode = mode;
      this.updateSummary();
      this.setHighlight(mode.areaId ?? "");
      this.paint();
    }

    remember() {
      this.history ??= [];
      this.history.push({ proposals: [...this.detect.proposals], choices: choicesFromElement(this.element) });
      if (this.history.length > 20) this.history.shift();
    }

    commitOutline(loops) {
      const { detect } = this;
      const target = detect.proposals.find((p) => p.id === this.mode?.areaId);
      if (!target) return false;
      const error = validateOutline(target.loops, loops, detect.width, detect.height);
      if (error) { hooks.notify?.(error); this.paint(); return false; }
      if (JSON.stringify(target.loops) === JSON.stringify(loops)) return false;
      const geometry = waterProposalFromLoops(loops, detect.width, detect.height);
      if (!geometry.pixels.length) { hooks.notify?.("Keep some of the floor inside the outline."); this.paint(); return false; }
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

    combineAreas(additions) {
      const { detect } = this;
      const target = detect.proposals.find((proposal) => proposal.id === (this.mode?.kind === "add" ? this.mode.areaId : null));
      const choices = choicesFromElement(this.element);
      const mergedIds = new Set([target.id, ...additions.map((proposal) => proposal.id)]);
      const claimed = detect.proposals.filter((proposal) => !mergedIds.has(proposal.id));
      const exclusions = [target, ...additions].flatMap(proposal => proposal.exclusions ?? []);
      let merged;
      if ([target, ...additions].some((proposal) => proposal.outlineEdited)) {
        const addedLoops = additions.flatMap((proposal) => proposal.outlineEdited ? proposal.loops
          : mergeWaterProposals([proposal], detect.width, detect.height, { claimed }).loops);
        try {
          merged = { ...target, ...waterProposalFromLoops(exclusions.reduce((loops, cut) => subtractOutlines(loops, cut), unionOutlines(target.loops, addedLoops)), detect.width, detect.height), geometryChanged: true, outlineEdited: true, exclusions };
        } catch (error) { hooks.notify?.(error.message); return; }
      } else merged = { ...mergeWaterProposals([target, ...additions], detect.width, detect.height, { claimed, preserveTarget: !!target.regionId }), geometryChanged: true };
      const owned = new Set(target.pixels);
      if (!additions.some(p => detect.proposals.includes(p)) && merged.pixels.length === owned.size && merged.pixels.every(pixel => owned.has(pixel))) {
        hooks.notify?.("That spot is already part of this area."); return;
      }
      this.remember();
      detect.proposals = detect.proposals.filter((proposal) => proposal.id === target.id || !mergedIds.has(proposal.id))
        .map((proposal) => proposal.id === target.id ? merged : proposal);
      this.drawRows(choices);
      hooks.notify?.(`Added to Area ${target.id.replace("water-", "")}. Its floor and settings are unchanged.`);
    }

    drawRows(choices) {
      const byId = new Map(choices.map((choice) => [choice.id, choice]));
      this.element.querySelector(".an-water-list").innerHTML = this.detect.proposals.map((proposal) => waterRowHTML(proposal, byId.get(proposal.id))).join("");
      this.updateSummary();
      this.paint();
    }

    undoAdd() {
      this.gesture = null;
      if (!this.history?.length) return;
      const { proposals, choices } = this.history.pop();
      this.detect.proposals = proposals;
      this.selectedVertex = null;
      const current = new Map(choicesFromElement(this.element).map((choice) => [choice.id, choice]));

      this.drawRows(choices.map((choice) => current.get(choice.id) ?? choice));
    }

    zoomMap(value, pointer) {
      const frame = this.element.querySelector(".an-water-frame");
      const canvas = this.element.querySelector("canvas.an-water-preview");
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
      if (this.mode?.kind === "vertices") this.paint();
    }

    setHighlight(id) {
      if (id === (this.highlight ?? "")) return;
      this.highlight = id;
      for (const item of this.element.querySelectorAll(".an-water-row")) item.classList.toggle("on", item.dataset.id === id);
      this.paint();
    }

    // Listeners live on the frame, which a re-render keeps. A closed window comes back with a new frame.
    _onRender() {
      this.resizeObserver?.disconnect();
      const frame = this.element.querySelector(".an-water-frame");
      if (frame) {
        frame.addEventListener("wheel", (event) => {
          event.preventDefault();
          this.zoomMap((this.zoom ?? 1) * (event.deltaY < 0 ? 1.2 : 1 / 1.2), { x: event.clientX, y: event.clientY });
        }, { passive: false });
        frame.addEventListener("pointerdown", (event) => {
          if (event.button !== 0 && event.button !== 1) return;
          const canvas = this.element.querySelector("canvas.an-water-preview");
          const target = this.mode?.kind === "vertices" && this.detect.proposals.find((p) => p.id === this.mode.areaId);
          const hit = target && event.button === 0 && hitOutline(target.loops, event, canvas.getBoundingClientRect(), this.detect.width, this.detect.height);
          this.suppressClick = false;
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
          if (gesture.kind === "vertex") {
            const canvas = this.element.querySelector("canvas.an-water-preview");
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
          this.suppressClick = gesture?.kind === "vertex" || gesture?.moved === true;
          if (gesture?.kind === "vertex" && !cancel) this.commitOutline(gesture.loops);
          this.paint();
        };
        frame.addEventListener("pointerup", () => finish(false));
        frame.addEventListener("pointercancel", () => finish(true));
        frame.addEventListener("lostpointercapture", () => finish(true));
        frame.addEventListener("pointerleave", () => { if (this.gesture?.kind === "pan" && !this.gesture.moved) this.gesture = null; });
        frame.addEventListener("dblclick", (event) => {
          if (this.mode?.kind !== "vertices") return;
          const canvas = this.element.querySelector("canvas.an-water-preview");
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
        if (this.mode?.kind !== "vertices") return;
        if (event.key !== "Escape" && event.target.closest?.("input, select, textarea")) return;
        if (event.key === "Escape") {
          event.preventDefault(); event.stopPropagation();
          if (this.gesture) { this.gesture = null; this.suppressClick = true; this.paint(); }
          else this.setMode({ kind: "inspect" });
        }
        if (event.key === "Delete" || event.key === "Backspace") { event.preventDefault(); event.stopPropagation(); this.deleteVertex(); }
      }, { capture: true });
      this.element.addEventListener("mouseover", (event) => this.setHighlight(event.target.closest?.("[data-id]")?.dataset.id ?? ""));
      this.element.addEventListener("mouseleave", () => this.setHighlight(""));
      this.element.addEventListener("change", (event) => {
        if (event.target.closest?.("[data-all-kind]")) {
          applyShared(this.element, "data-kind", event.target.value);
          for (const row of this.element.querySelectorAll("[data-id]")) if (row.querySelector("[data-pick]").checked) updateKindFields(row);
        }
        if (event.target.closest?.("[data-all-flow]")) applyShared(this.element, "data-flow", event.target.value);
        if (event.target.closest?.("[data-all-current]")) applyShared(this.element, "data-current", event.target.value);
        if (event.target.closest?.("select[data-kind], select[data-floor]")) updateFloorFields(event.target.closest("[data-id]"));
        if (event.target.closest?.("select[data-floor-to-add]")) {
          const swatch = this.element.querySelector("[data-floor-swatch]");
          if (swatch) swatch.style.background = floorMeta(sharedChoices(this.element).floorToAdd).color;
        }
        this.updateSummary();
        if (event.target.closest?.("select[data-floor]")) this.paint();
      });
      this.element.addEventListener("click", (event) => {
        const zoom = event.target.closest?.("[data-zoom]");
        if (zoom) return this.zoomMap(zoom.dataset.zoom === "fit" ? 1 : (this.zoom ?? 1) * (zoom.dataset.zoom === "in" ? 1.5 : 1 / 1.5));
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
        if (event.target.closest?.("[data-create]")) return void this.create();
        if (event.target.closest?.("canvas.an-water-preview")) return this.clickPreview(event);
      });
    }

    async close(options = {}) {
      if (!options.force && this.detect && this.element) {
        const lost = untickedGeometryEdits(this.detect.proposals, choicesFromElement(this.element));
        if (lost.length && !(await hooks.confirm?.(untickedGeometryMessage(lost.length)))) return this;
      }
      const out = await super.close(options);
      this.resizeObserver?.disconnect();
      if (openWindow === this) openWindow = null;
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
      const claimed = target ? detect.proposals.filter((proposal) => proposal !== target) : detect.proposals;
      for (const loops of target?.exclusions ?? []) claimed.push({ id: "water-0", pixels: waterSelectionPixels(loops, detect.width, detect.height) });
      const picked = hooks.select(detect.rgba, detect.width, detect.height, at, { claimed, broad: shared.range === "wide" });
      if (picked.status !== "found") {
        hooks.notify?.(clickMessage(picked.reason));
        return;
      }
      if (target) {
        const owned = new Uint8Array(detect.width * detect.height);
        for (const pixel of target.pixels) owned[pixel] = 1;
        if (picked.proposal.pixels.every((pixel) => owned[pixel])) {
          hooks.notify?.("That spot is already part of this area.");
          return;
        }
        return this.combineAreas([{ ...picked.proposal, id: "addition" }]);
      }
      this.history = [];
      const floor = isDetectFloor(shared.floorToAdd) ? shared.floorToAdd : "water";
      picked.proposal.floor = floor;
      detect.proposals.push(picked.proposal);
      this.element.querySelector(".an-water-reason")?.remove();
      this.element.querySelector(".an-water-list").insertAdjacentHTML("afterbegin", waterRowHTML(picked.proposal, { ...shared, floor }));
      this.element.querySelector(".an-water-list").scrollTop = 0;
      this.paint();
      this.updateSummary();
    }

    removeRow(id) {
      const { detect } = this;
      const proposal = detect.proposals.find((proposal) => proposal.id === id);
      if (proposal?.regionId) {
        const row = [...this.element.querySelectorAll("[data-id]")].find((row) => row.dataset.id === id);
        row.querySelector("[data-pick]").checked = false;
        this.updateSummary();
        return;
      }
      this.history = [];
      if (this.mode?.areaId === id) this.setMode({ kind: "inspect" });
      detect.proposals = detect.proposals.filter((proposal) => proposal.id !== id);
      for (const row of this.element.querySelectorAll(".an-water-row")) if (row.dataset.id === id) row.remove();
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
        const plan = planWaterCreate({
          proposals: detect.proposals,
          picked,
          sceneRect: detect.sceneRect,
          imageWidth: detect.width,
          imageHeight: detect.height,
          levelId: detect.levelId,
          regions: detect.scene.regions,
        });
        const outcome = await commitWaterPlan(plan, { scene: detect.scene, notify: hooks.notify });
        if (!outcome.cancelled && outcome.created + outcome.updated > 0) {
          hooks.notify?.(`${outcome.created ? `Created ${outcome.created} region${outcome.created === 1 ? "" : "s"}.` : ""}${outcome.updated ? ` Updated ${outcome.updated} saved region${outcome.updated === 1 ? "" : "s"}.` : ""}`.trim());
          await this.close({ force: true });
        }
      } catch (error) {
        const detail = typeof error?.message === "string" && /Reopen the generator/.test(error.message)
          ? `Experimental. ${error.message}`
          : "Experimental. The floor regions could not be saved.";
        hooks.warn?.(detail);
        console.warn("Animater water regions:", error);
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

export function openWaterDetect(options = {}) {
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
  select = selectWaterAt,
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
  const saved = savedWaterProposals(scene?.regions, { levelId, sceneRect, width: loaded.width, height: loaded.height });
  const fresh = saved.length ? (result.proposals ?? []).map((proposal) => mergeWaterProposals([proposal], loaded.width, loaded.height, { claimed: saved, dropSmallComponents: true }))
    .filter((proposal) => proposal.share >= WATER_TUNING.componentMinShare)
    .map((proposal, i) => ({ ...proposal, id: `water-${saved.length + i + 1}`, preselected: false })) : result.proposals ?? [];
  const proposals = [...saved, ...fresh];
  const Window = waterDetectWindow(Application, { notify, warn, select, confirm });
  const app = new Window();
  app.detect = {
    proposals,
    reason: result.reason ?? "",
    rgba: loaded.rgba,
    width: loaded.width,
    height: loaded.height,
    scene,
    sceneRect,
    levelId,
  };
  await openWindow?.close?.();
  if (signal?.aborted) return { opened: false, reason: "superseded" };
  openWindow = app;
  await app.render?.({ force: true });
  return { opened: true, app, reason: result.reason };
}
