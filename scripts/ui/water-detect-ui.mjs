// Experimental water proposals. The form, the create plan and the image read are pure and exported.
// The window takes what it needs as options. Nothing here runs until a GM clicks the Regions tool.

import { detectWater, selectWaterAt, mergeWaterProposals, fitSize, toRegionData, regionsToReplace, WATER_TUNING } from "../engines/regions/water-detect.mjs";
import { WATER_KINDS, WATER_TOWARD, flowChoices, waterFlows } from "../engines/motion/region-steps.mjs";

export const FLOW_OPTIONS = Object.freeze(flowChoices());
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
  "no-colour": "Experimental. That spot has no clear colour to follow. Click on the water itself.",
  "too-small": "Experimental. That patch is too small to be a region. Click somewhere wider.",
  "already-water": "Experimental. That spot is already in the list.",
});

// A stalled server would otherwise hold the tool for as long as the browser keeps the request open.
const LOAD_TIMEOUT_MS = 60000;

const FAILURES = Object.freeze({
  timeout: "Experimental. The map image took too long to load. Click the tool to try again.",
  video: "Experimental. This background is a video, so its water cannot be read.",
  "unsupported-format": "Experimental. This background's image format cannot be read. Use a PNG, WebP or JPEG map.",
  tainted: "Experimental. The map image could not be read. It may come from another site.",
  fetch: "Experimental. The map image could not be loaded.",
});

const TINTS = ["rgba(44, 160, 190, 0.45)", "rgba(40, 120, 210, 0.45)", "rgba(70, 170, 140, 0.45)", "rgba(90, 110, 200, 0.45)"];

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

export function waterRowHTML(proposal, { checked = proposal.preselected, waterKind = "still", flowTo = "", current = "", waveTo = "", seaBeach = "" } = {}) {
  const id = esc(proposal.id);
  const kind = WATER_KINDS.some(([key]) => key === waterKind) ? waterKind : "still";
  const flows = waterFlows(kind);
  const flow = flowDefault(kind, flowTo);
  const cur = currentDefault(kind, current);
  const warning = proposal.clicked && proposal.share > WATER_TUNING.clickWarnShare
    ? ` <span class="an-water-warn">${percent(proposal.share)} of the map. Is this water?</span>` : "";
  return `<div class="an-water-row" data-id="${id}">
  <label class="an-water-pick"><input type="checkbox" data-pick="${id}"${checked ? " checked" : ""}> <strong>Area ${esc(String(proposal.id).replace("water-", ""))}</strong> <span class="an-water-share">${percent(proposal.share)} of map</span> <span class="an-water-vertices">${proposal.vertices} vertices</span>${warning}</label>
  <label>Kind ${optionsHTML(WATER_KINDS, `data-kind="${id}"`, kind)}</label>
  <label data-flow-field${flows ? "" : " hidden"}>Flows toward ${optionsHTML(FLOW_OPTIONS, `data-flow="${id}"`, flow || "s")}</label>
  <label data-current-field${kind === "river" ? "" : " hidden"}>Current ${optionsHTML(CURRENT_OPTIONS, `data-current="${id}"`, cur)}</label>
  <label data-sea-field${kind === "sea" ? "" : " hidden"}>Waves toward ${optionsHTML(WAVE_OPTIONS, `data-wave="${id}"`, waveTo)}</label>
  <label data-sea-field class="an-water-pick"${kind === "sea" ? "" : " hidden"}><input type="checkbox" data-beach="${id}"${seaBeach === "off" ? "" : " checked"}> Beach along the shore</label>
  <button type="button" class="an-water-add" data-add-to="${id}" aria-pressed="false">Add water</button>
  <button type="button" class="an-water-remove" data-remove="${id}" >Remove</button>
</div>`;
}

export function waterWindowHTML({ proposals, width, height, reason = "", picked = [], shared = {} }) {
  const rows = [...proposals].sort((a, b) => b.share - a.share || String(a.id).localeCompare(String(b.id)));
  const choices = new Map(picked.map((choice) => [choice.id, choice]));
  const selected = rows.filter((proposal) => choices.get(proposal.id)?.checked ?? proposal.preselected).length;
  return `<div class="an-water">
  <header class="an-water-heading"><h2>Review water areas</h2><p>Experimental. Click water to add an area. Review your selection before creating regions.</p></header>
  ${reason ? `<p class="an-water-reason">${esc(noneMessage(reason))}</p>` : ""}
  <div class="an-water-workspace">
    <section class="an-water-map" aria-label="Map preview">
      <div class="an-water-toolbar"><h3>Map preview</h3><div class="an-water-zoom">
        <button type="button" data-zoom="out" aria-label="Zoom out">−</button><output data-zoom-label aria-live="polite">Fit</output><button type="button" data-zoom="in" aria-label="Zoom in">+</button><button type="button" data-zoom="fit">Fit map</button>
      </div></div>
      <div class="an-water-add-status" data-add-status hidden><p data-add-message></p><div>
        <button type="button" data-undo-add disabled>Undo last addition</button>
        <button type="button" data-add-done>Finish adding</button>
      </div></div>
      <div class="an-water-frame" tabindex="0" aria-label="Water preview. Scroll to zoom. Drag to pan. Click to add water."><div class="an-water-stage"><canvas class="an-water-preview" width="${width}" height="${height}"></canvas></div></div>
      <p class="an-water-help">Scroll to zoom · Drag to pan · Click to add water</p>
      <div class="an-water-range"><label>Click colour range ${optionsHTML([["narrow", "Narrow"], ["wide", "Wide"]], "data-click-range", shared.range ?? "narrow")}</label>
      <p class="an-water-range-note">Wide can join touching grass, banks or other similar colours. Review the preview before creating regions.</p></div>
    </section>
    <section class="an-water-review" aria-label="Water areas">
      <div class="an-water-toolbar"><h3>Water areas</h3><span data-area-count>${rows.length} found · ${selected} selected</span></div>
      <details class="an-water-all" open><summary>Settings for selected areas</summary><p>Changes below apply to every ticked area.</p><div class="an-water-shared-fields">
        <label>Kind ${optionsHTML(WATER_KINDS, 'data-all-kind=""', shared.waterKind ?? "still")}</label>
        <label data-shared-flow>Flows toward ${optionsHTML(FLOW_OPTIONS, 'data-all-flow=""', shared.flowTo || "s")}</label>
        <label data-shared-current>Current ${optionsHTML(CURRENT_OPTIONS, 'data-all-current=""', shared.current ?? "")}</label>
      </div></details>
      <div class="an-water-list">${rows.map((proposal) => waterRowHTML(proposal, choices.get(proposal.id))).join("")}</div>
      <p class="an-water-empty" data-area-empty${rows.length ? " hidden" : ""}>No areas yet. Click water on the map to add one.</p>
    </section>
  </div>
  <footer class="an-water-foot"><span data-selection-count aria-live="polite">${selected} of ${rows.length} areas selected</span><button type="button" data-create${selected ? "" : " disabled"}>Create ${selected} water region${selected === 1 ? "" : "s"}</button></footer>
</div>`;
}

export function readWaterChoices(rows) {
  return (rows ?? []).map((row) => ({
    id: row.id,
    checked: row.checked === true,
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
      waterKind: row.querySelector("[data-kind]")?.value ?? row.dataset.kind ?? "still",
      flowTo: row.querySelector("[data-flow]")?.value ?? "",
      current: row.querySelector("[data-current]")?.value ?? "",
      waveTo: row.querySelector("[data-wave]")?.value ?? "",
      seaBeach: row.querySelector("[data-beach]")?.checked === false ? "off" : "",
    });
  }
  return readWaterChoices(rows);
}

export function planWaterCreate({ proposals, picked, sceneRect, imageWidth, imageHeight, levelId, regions }) {
  const byId = new Map((proposals ?? []).map((proposal) => [proposal.id, proposal]));
  const chosen = [];
  for (const row of picked ?? []) {
    if (!row.checked) continue;
    const proposal = byId.get(row.id);
    if (proposal) chosen.push({ proposal, row });
  }
  chosen.sort((a, b) => b.proposal.share - a.proposal.share || String(a.proposal.id).localeCompare(String(b.proposal.id)));
  const deleteIds = regionsToReplace(regions, levelId);
  const creates = chosen.map(({ proposal, row }, index) => toRegionData(proposal, {
    sceneRect,
    imageWidth,
    imageHeight,
    levelId,
    name: chosen.length === 1 ? "Water" : `Water ${index + 1}`,
    waterKind: row.waterKind,
    flowTo: row.flowTo,
    current: row.current,
    waveTo: row.waveTo,
    seaBeach: row.seaBeach,
  }));
  return { creates, deleteIds, needsConfirm: deleteIds.length > 0 };
}

export async function commitWaterPlan(plan, { scene, confirm, notify } = {}) {
  if (!plan.creates.length) {
    notify?.("Experimental. Tick a piece of water first.");
    return { created: 0, deleted: 0 };
  }
  if (plan.needsConfirm) {
    const ok = await confirm?.({
      window: { title: "Experimental: detect water regions" },
      content: `<p>Experimental. Replace the ${plan.deleteIds.length} water region${plan.deleteIds.length === 1 ? "" : "s"} this tool already made on this level? Every change you made to ${plan.deleteIds.length === 1 ? "that region" : "those regions"} since ${plan.deleteIds.length === 1 ? "it was" : "they were"} generated is lost: water kind, flow, steps, beach, behaviors, and edited shapes. Water you drew by hand stays.</p>`,
    });
    if (!ok) return { created: 0, deleted: 0, cancelled: true };
  }
  // New water first. A failed write then leaves the old regions in place, and the next run replaces both.
  await scene.createEmbeddedDocuments("Region", plan.creates);
  if (plan.deleteIds.length) await scene.deleteEmbeddedDocuments("Region", plan.deleteIds);
  return { created: plan.creates.length, deleted: plan.deleteIds.length };
}

export function paintWaterPreview(ctx, rgba, width, height, proposals, highlightId = "") {
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
    ctx.fillStyle = hot ? "rgba(255, 196, 64, 0.55)" : TINTS[index % TINTS.length];
    ctx.fill("evenodd");
    ctx.lineWidth = hot ? 2 : 1;
    ctx.strokeStyle = hot ? "rgba(255, 210, 80, 0.95)" : "rgba(220, 245, 255, 0.35)";
    ctx.stroke();
  });
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
  };
}

function updateKindFields(row) {
  const kind = row.querySelector("[data-kind]").value;
  const flow = row.querySelector("[data-flow]");
  const current = row.querySelector("[data-current]");
  flow.value = flowDefault(kind, flow.value) || "s";
  current.value = currentDefault(kind, current.value);
  row.querySelector("[data-flow-field]").hidden = !waterFlows(kind);
  row.querySelector("[data-current-field]").hidden = kind !== "river";
  for (const field of row.querySelectorAll("[data-sea-field]")) field.hidden = kind !== "sea";
}

// `detect` is what the window works on: the pixels, the rows so far, and the scene and level as they were at open.
export function waterDetectWindow(ApplicationV2, hooks = {}) {
  return class WaterDetect extends ApplicationV2 {
    static DEFAULT_OPTIONS = {
      id: "animater-water-detect",
      classes: ["animater", "animater-water"],
      window: { title: "Experimental: detect water regions", icon: "fa-solid fa-water", resizable: true },
      position: { width: 1000, height: 760 },
    };

    async _renderHTML() {
      const { proposals, width, height, reason } = this.detect;
      return waterWindowHTML({ proposals, width, height, reason: proposals.length ? "" : reason });
    }

    _replaceHTML(html, content) {
      const before = choicesFromElement(content);
      content.innerHTML = before.length ? waterWindowHTML({ ...this.detect, reason: this.detect.proposals.length ? "" : this.detect.reason, picked: before, shared: sharedChoices(content) }) : html;
      this.paint();
      this.updateSummary();
      this.zoomMap(this.zoom ?? 1);
    }

    paint() {
      const canvas = this.element?.querySelector("canvas.an-water-preview");
      const { detect } = this;
      if (!canvas || !detect) return;
      paintWaterPreview(canvas.getContext("2d", { willReadFrequently: true }), detect.rgba, detect.width, detect.height, detect.proposals, this.highlight || this.addTarget || "");
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
      const button = this.element.querySelector("[data-create]");
      if (button) { button.textContent = this.saving ? "Creating regions…" : `Create ${selected} water region${selected === 1 ? "" : "s"}`; button.disabled = !selected || this.saving === true; }
      const empty = this.element.querySelector("[data-area-empty]");
      if (empty) empty.hidden = total > 0;
      const status = this.element.querySelector("[data-add-status]");
      if (status) {
        status.hidden = !this.addTarget;
        this.element.querySelector("[data-add-message]").textContent = `Adding to Area ${this.addTarget?.replace("water-", "")}. Click missed water or another area on the map to add it. Checkboxes only choose which regions to create.`;
        this.element.querySelector("[data-undo-add]").disabled = !this.undoAddition;
        for (const button of this.element.querySelectorAll("[data-add-to]")) {
          const active = button.dataset.addTo === this.addTarget;
          button.setAttribute("aria-pressed", String(active));
          button.textContent = active ? "Adding water here" : "Add water";
        }
      }
    }

    setAddTarget(id) {
      this.addTarget = id;
      this.undoAddition = null;
      this.updateSummary();
      this.setHighlight(id);
    }

    combineAreas(additions) {
      const { detect } = this;
      const target = detect.proposals.find((proposal) => proposal.id === this.addTarget);
      const choices = choicesFromElement(this.element);
      this.undoAddition = { proposals: [...detect.proposals], choices };
      const mergedIds = new Set([target.id, ...additions.map((proposal) => proposal.id)]);
      const claimed = detect.proposals.filter((proposal) => !mergedIds.has(proposal.id));
      const merged = mergeWaterProposals([target, ...additions], detect.width, detect.height, { claimed });
      detect.proposals = detect.proposals.filter((proposal) => proposal.id === target.id || !mergedIds.has(proposal.id))
        .map((proposal) => proposal.id === target.id ? merged : proposal);
      this.drawRows(choices);
      hooks.notify?.(`Added water to Area ${target.id.replace("water-", "")}. Its kind and settings are unchanged.`);
    }

    drawRows(choices) {
      const byId = new Map(choices.map((choice) => [choice.id, choice]));
      this.element.querySelector(".an-water-list").innerHTML = this.detect.proposals.map((proposal) => waterRowHTML(proposal, byId.get(proposal.id))).join("");
      this.updateSummary();
      this.paint();
    }

    undoAdd() {
      if (!this.undoAddition) return;
      const { proposals, choices } = this.undoAddition;
      this.detect.proposals = proposals;
      this.undoAddition = null;
      this.drawRows(choices);
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
          this.pan = { x: event.clientX, y: event.clientY, left: frame.scrollLeft, top: frame.scrollTop, moved: false };
          this.suppressClick = false;
        });
        frame.addEventListener("pointermove", (event) => {
          if (!this.pan) return;
          const dx = event.clientX - this.pan.x, dy = event.clientY - this.pan.y;
          if (!this.pan.moved && Math.hypot(dx, dy) < 5) return;
          this.pan.moved = true;
          frame.setPointerCapture(event.pointerId);
          frame.scrollLeft = this.pan.left - dx;
          frame.scrollTop = this.pan.top - dy;
          event.preventDefault();
        });
        const finishPan = () => { this.suppressClick = this.pan?.moved === true; this.pan = null; };
        frame.addEventListener("pointerup", finishPan);
        frame.addEventListener("pointercancel", finishPan);
        frame.addEventListener("pointerleave", () => { if (!this.pan?.moved) this.pan = null; });
        this.resizeObserver = new ResizeObserver(() => this.zoomMap(this.zoom ?? 1));
        this.resizeObserver.observe(frame);
        this.zoomMap(this.zoom ?? 1);
      }
      if (this.wiredTo === this.element) return;
      this.wiredTo = this.element;
      this.element.addEventListener("mouseover", (event) => this.setHighlight(event.target.closest?.("[data-id]")?.dataset.id ?? ""));
      this.element.addEventListener("mouseleave", () => this.setHighlight(""));
      this.element.addEventListener("change", (event) => {
        if (event.target.closest?.("[data-all-kind]")) {
          applyShared(this.element, "data-kind", event.target.value);
          for (const row of this.element.querySelectorAll("[data-id]")) if (row.querySelector("[data-pick]").checked) updateKindFields(row);
        }
        if (event.target.closest?.("[data-all-flow]")) applyShared(this.element, "data-flow", event.target.value);
        if (event.target.closest?.("[data-all-current]")) applyShared(this.element, "data-current", event.target.value);
        if (event.target.closest?.("select[data-kind]")) updateKindFields(event.target.closest("[data-id]"));
        this.updateSummary();
      });
      this.element.addEventListener("click", (event) => {
        const zoom = event.target.closest?.("[data-zoom]");
        if (zoom) return this.zoomMap(zoom.dataset.zoom === "fit" ? 1 : (this.zoom ?? 1) * (zoom.dataset.zoom === "in" ? 1.5 : 1 / 1.5));
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

    async close(options) {
      const out = await super.close(options);
      this.resizeObserver?.disconnect();
      if (openWindow === this) openWindow = null;
      this.detect = null;
      this.undoAddition = null;
      return out;
    }

    clickPreview(event) {
      if (this.suppressClick) { this.suppressClick = false; return; }
      const { detect } = this;
      const at = previewPixel(event, event.target.getBoundingClientRect(), detect.width, detect.height);
      const shared = sharedChoices(this.element);
      const target = detect.proposals.find((proposal) => proposal.id === this.addTarget);
      if (target) {
        const pixel = Math.floor(at.y) * detect.width + Math.floor(at.x);
        const source = detect.proposals.find((proposal) => proposal !== target && proposal.pixels.includes(pixel));
        if (source) return this.combineAreas([source]);
      }
      const claimed = target ? detect.proposals.filter((proposal) => proposal !== target) : detect.proposals;
      const picked = hooks.select(detect.rgba, detect.width, detect.height, at, { claimed, broad: shared.range === "wide" });
      if (picked.status !== "found") {
        hooks.notify?.(clickMessage(picked.reason));
        return;
      }
      if (target) {
        const owned = new Uint8Array(detect.width * detect.height);
        for (const pixel of target.pixels) owned[pixel] = 1;
        if (picked.proposal.pixels.every((pixel) => owned[pixel])) {
          hooks.notify?.("That water is already part of this area.");
          return;
        }
        return this.combineAreas([{ ...picked.proposal, id: "addition" }]);
      }
      this.undoAddition = null;
      detect.proposals.push(picked.proposal);
      this.element.querySelector(".an-water-reason")?.remove();
      this.element.querySelector(".an-water-list").insertAdjacentHTML("afterbegin", waterRowHTML(picked.proposal, shared));
      this.element.querySelector(".an-water-list").scrollTop = 0;
      this.paint();
      this.updateSummary();
    }

    removeRow(id) {
      const { detect } = this;
      this.undoAddition = null;
      if (this.addTarget === id) this.addTarget = null;
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
        const plan = planWaterCreate({
          proposals: detect.proposals,
          picked: choicesFromElement(this.element),
          sceneRect: detect.sceneRect,
          imageWidth: detect.width,
          imageHeight: detect.height,
          levelId: detect.levelId,
          regions: detect.scene.regions,
        });
        const outcome = await commitWaterPlan(plan, { scene: detect.scene, confirm: hooks.confirm, notify: hooks.notify });
        if (!outcome.cancelled && outcome.created + outcome.deleted > 0) {
          hooks.notify?.(`Created ${outcome.created} water region${outcome.created === 1 ? "" : "s"}.${outcome.deleted ? ` Replaced ${outcome.deleted} previously generated region${outcome.deleted === 1 ? "" : "s"}.` : ""}`);
          await this.close();
        }
      } catch (error) {
        hooks.warn?.("Experimental. The water regions could not be saved.");
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
  confirm = (options) => globalThis.foundry?.applications?.api?.DialogV2?.confirm?.(options),
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
  const Window = waterDetectWindow(Application, { notify, warn, confirm, select });
  const app = new Window();
  app.detect = {
    proposals: result.status === "found" ? [...result.proposals] : [],
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
