// Experimental water proposals. The form, the create plan and the image read are pure and exported.
// The window takes what it needs as options. Nothing here runs until a GM clicks the Regions tool.

import { detectWater, selectWaterAt, fitSize, toRegionData, regionsToReplace, WATER_TUNING } from "../engines/regions/water-detect.mjs";
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
  <label class="an-water-pick"><input type="checkbox" data-pick="${id}"${checked ? " checked" : ""}> <span class="an-water-share">${percent(proposal.share)}</span> <span class="an-water-vertices">${proposal.vertices} vertices</span>${warning}</label>
  <label>Kind ${optionsHTML(WATER_KINDS, `data-kind="${id}"`, kind)}</label>
  <label data-flow-field${flows ? "" : " hidden"}>Flows toward ${optionsHTML(FLOW_OPTIONS, `data-flow="${id}"`, flow || "s")}</label>
  <label data-current-field${kind === "river" ? "" : " hidden"}>Current ${optionsHTML(CURRENT_OPTIONS, `data-current="${id}"`, cur)}</label>
  <label data-sea-field${kind === "sea" ? "" : " hidden"}>Waves toward ${optionsHTML(WAVE_OPTIONS, `data-wave="${id}"`, waveTo)}</label>
  <label data-sea-field class="an-water-pick"${kind === "sea" ? "" : " hidden"}><input type="checkbox" data-beach="${id}"${seaBeach === "off" ? "" : " checked"}> Beach along the shore</label>
  <button type="button" class="an-water-remove" data-remove="${id}" >Remove</button>
</div>`;
}

export function waterWindowHTML({ proposals, width, height, reason = "", picked = [], shared = {} }) {
  const rows = [...proposals].sort((a, b) => b.share - a.share || String(a.id).localeCompare(String(b.id)));
  const choices = new Map(picked.map((choice) => [choice.id, choice]));
  return `<div class="an-water">
  ${reason ? `<p class="an-water-reason">${esc(noneMessage(reason))}</p>` : ""}
  <p class="an-water-intro">Experimental. Click water on the map to add it. Untick or remove anything that is not water, set the kind and flow, then create the regions.</p>
  <label>Click colour range ${optionsHTML([["narrow", "Narrow"], ["wide", "Wide, includes more similar colours"]], "data-click-range", shared.range ?? "narrow")}</label>
  <p class="an-water-range-note">Wide can join touching grass, banks or other similar colours. Review the preview before creating regions.</p>
  <div class="an-water-frame"><canvas class="an-water-preview" width="${width}" height="${height}"></canvas></div>
  <div class="an-water-all">
    <label>Kind, for every ticked piece ${optionsHTML(WATER_KINDS, 'data-all-kind=""', shared.waterKind ?? "still")}</label>
    <label>Flows toward, for every ticked piece ${optionsHTML(FLOW_OPTIONS, 'data-all-flow=""', shared.flowTo || "s")}</label>
    <label>Current, for every ticked piece ${optionsHTML(CURRENT_OPTIONS, 'data-all-current=""', shared.current ?? "")}</label>
  </div>
  <div class="an-water-list">${rows.map((proposal) => waterRowHTML(proposal, choices.get(proposal.id))).join("")}</div>
  <footer class="an-water-foot"><button type="button" data-create>Create water regions</button></footer>
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
      position: { width: 560, height: 720 },
    };

    async _renderHTML() {
      const { proposals, width, height, reason } = this.detect;
      return waterWindowHTML({ proposals, width, height, reason: proposals.length ? "" : reason });
    }

    _replaceHTML(html, content) {
      const before = choicesFromElement(content);
      content.innerHTML = before.length ? waterWindowHTML({ ...this.detect, reason: this.detect.proposals.length ? "" : this.detect.reason, picked: before, shared: sharedChoices(content) }) : html;
      this.paint();
    }

    paint() {
      const canvas = this.element?.querySelector("canvas.an-water-preview");
      const { detect } = this;
      if (!canvas || !detect) return;
      paintWaterPreview(canvas.getContext("2d", { willReadFrequently: true }), detect.rgba, detect.width, detect.height, detect.proposals, this.highlight ?? "");
    }

    setHighlight(id) {
      if (id === (this.highlight ?? "")) return;
      this.highlight = id;
      for (const item of this.element.querySelectorAll(".an-water-row")) item.classList.toggle("on", item.dataset.id === id);
      this.paint();
    }

    // Listeners live on the frame, which a re-render keeps. A closed window comes back with a new frame.
    _onRender() {
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
      });
      this.element.addEventListener("click", (event) => {
        const remove = event.target.closest?.("[data-remove]");
        if (remove) return this.removeRow(remove.dataset.remove);
        if (event.target.closest?.("[data-create]")) return void this.create();
        if (event.target.closest?.("canvas.an-water-preview")) return this.clickPreview(event);
      });
    }

    async close(options) {
      const out = await super.close(options);
      if (openWindow === this) openWindow = null;
      this.detect = null;
      return out;
    }

    clickPreview(event) {
      const { detect } = this;
      const at = previewPixel(event, event.target.getBoundingClientRect(), detect.width, detect.height);
      const shared = sharedChoices(this.element);
      const picked = hooks.select(detect.rgba, detect.width, detect.height, at, { claimed: detect.proposals, broad: shared.range === "wide" });
      if (picked.status !== "found") {
        hooks.notify?.(clickMessage(picked.reason));
        return;
      }
      detect.proposals.push(picked.proposal);
      this.element.querySelector(".an-water-reason")?.remove();
      this.element.querySelector(".an-water-list").insertAdjacentHTML("afterbegin", waterRowHTML(picked.proposal, shared));
      this.element.querySelector(".an-water-list").scrollTop = 0;
      this.paint();
    }

    removeRow(id) {
      const { detect } = this;
      detect.proposals = detect.proposals.filter((proposal) => proposal.id !== id);
      for (const row of this.element.querySelectorAll(".an-water-row")) if (row.dataset.id === id) row.remove();
      if (this.highlight === id) this.highlight = "";
      this.paint();
    }

    async create() {
      if (this.saving) return;
      this.saving = true;
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
        if (!outcome.cancelled && outcome.created + outcome.deleted > 0) await this.close();
      } catch (error) {
        hooks.warn?.("Experimental. The water regions could not be saved.");
        console.warn("Animater water regions:", error);
      } finally {
        this.saving = false;
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
