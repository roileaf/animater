import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { WATER_KINDS, waterKindOf, waterFlows } from "../../scripts/engines/motion/region-steps.mjs";
import { regionKindOf } from "../../scripts/ui/region-panel-model.mjs";
import {
  FLOW_OPTIONS, CURRENT_OPTIONS, noneMessage, failureMessage, clickMessage, loadMapRgba, waterWindowHTML, waterRowHTML,
  paintWaterPreview, floorTint, waterDetectWindow, savedWaterProposals, readWaterChoices, planWaterCreate, commitWaterPlan, openWaterDetect, previewPixel, levelMapIsPlain,
} from "../../scripts/ui/water-detect-ui.mjs";

const sceneRect = { x: 1000, y: 2000, width: 5000, height: 2500 };
const square = {
  id: "water-1",
  share: 0.2,
  preselected: true,
  vertices: 3,
  loops: [{ points: [0, 0, 10, 0, 10, 5], hole: false }],
};
const speck = {
  id: "water-2",
  share: 0.001,
  preselected: false,
  vertices: 8,
  loops: [{ points: [1, 1, 2, 1, 2, 2], hole: false }],
};

function row(html, id) {
  const found = html.match(new RegExp(`<div class="an-water-row" data-id="${id}">[\\s\\S]*?</div>`));
  assert.ok(found, id);
  return found[0];
}

test("a map with no water explains why, and names the experiment", () => {
  assert.match(noneMessage("no-candidates"), /Experimental\. No blue water/);
  assert.match(noneMessage("no-saturated-colour"), /too grey/);
  assert.match(noneMessage("nothing-left"), /thin river/);
  assert.notEqual(noneMessage("no-candidates"), noneMessage("no-saturated-colour"));
  assert.match(failureMessage("video"), /video/);
  assert.match(failureMessage("tainted"), /could not be read/);
  assert.match(failureMessage("fetch"), /could not be loaded/);
  assert.match(failureMessage("unsupported-format"), /format cannot be read/);
  assert.notEqual(failureMessage("unsupported-format"), failureMessage("fetch"));
  assert.match(clickMessage("no-colour"), /no clear colour/);
  assert.match(clickMessage("too-small"), /too small/);
  assert.match(clickMessage("already-water"), /already in the list/);
  for (const message of [noneMessage("no-candidates"), failureMessage("video"), failureMessage("tainted"), failureMessage("fetch"), failureMessage("unsupported-format"), clickMessage("no-colour")]) {
    assert.match(message, /^Experimental\./);
  }
});

test("the flow choices come from region configuration", () => {
  assert.deepEqual(FLOW_OPTIONS.map(([value]) => value), ["wind", "n", "ne", "e", "se", "s", "sw", "w", "nw"]);
  assert.deepEqual(CURRENT_OPTIONS.map(([value]) => value), ["", "swift"]);
  assert.equal(FLOW_OPTIONS[0][1], "Follows the wind");
  assert.equal(CURRENT_OPTIONS[0][1], "Gentle");
});

test("rows follow share, large pieces start ticked, and one control sets every ticked row", () => {
  const html = waterWindowHTML({ proposals: [speck, square], width: 10, height: 5 });
  assert.match(html, /Experimental\./);
  assert.ok(html.indexOf('data-id="water-1"') < html.indexOf('data-id="water-2"'));
  assert.match(row(html, "water-1"), /checked/);
  assert.doesNotMatch(row(html, "water-2"), /data-pick="water-2" checked/);
  assert.match(row(html, "water-1"), /20\.0%/);
  assert.match(row(html, "water-1"), /3 vertices/);
  assert.match(row(html, "water-2"), /0\.10%/);
  assert.match(html, /data-all-flow/);
  assert.match(html, /data-all-current/);
  assert.match(html, /North-east/);
  assert.match(html, /Swift/);
  assert.match(html, />Create 1 region</);
  assert.match(html, /Click the map to add/);
  assert.match(html, /data-floor="water-1"/);
  assert.match(waterWindowHTML({ proposals: [{ ...square, regionId: "saved" }], width: 10, height: 5 }), />Save 1 region</);
});

test("the same proposals always draw the same form", () => {
  const once = waterWindowHTML({ proposals: [square, speck], width: 10, height: 5 });
  const twice = waterWindowHTML({ proposals: [speck, square], width: 10, height: 5 });
  assert.equal(once, twice);
});

test("create keeps the ticked pieces, maps them onto the scene, and leaves hand-drawn water alone", () => {
  const picked = readWaterChoices([
    { id: "water-2", checked: true, waterKind: "river", flowTo: "n", current: "" },
    { id: "water-1", checked: true, waterKind: "river", flowTo: "se", current: "swift" },
    { id: "water-9", checked: true, waterKind: "still", flowTo: "", current: "" },
  ]);
  const plan = planWaterCreate({
    proposals: [speck, square],
    picked,
    sceneRect,
    imageWidth: 10,
    imageHeight: 5,
    levelId: "level-1",
    regions: {
      contents: [
        { id: "hand", flags: { animater: { floor: "water" } } },
        { id: "old", levels: ["level-1"], flags: { animater: { generated: "water-detect" } } },
      ],
    },
  });
  assert.deepEqual(plan.updates, []);
  assert.deepEqual(plan.creates.map((region) => region.name), ["Water 1", "Water 2"]);
  const river = plan.creates[0];
  assert.equal(river.color, "#2c7da0");
  assert.deepEqual(river.levels, ["level-1"]);
  assert.equal(river.flags.animater.floor, "water");
  assert.equal(river.flags.animater.generated, "floor-detect");
  assert.equal(river.flags.animater.waterKind, "river");
  assert.equal(river.flags.animater.flowTo, "se");
  assert.equal(river.flags.animater.current, "swift");
  assert.deepEqual(river.shapes[0].points, [1000, 2000, 6000, 2000, 6000, 4500]);
  assert.equal(river.shapes[0].hole, false);
  assert.equal(plan.creates[1].flags.animater.waterKind, "river");
  assert.equal(plan.creates[1].flags.animater.flowTo, "n");
  assert.equal(plan.creates[1].flags.animater.current, undefined);
  const quiet = planWaterCreate({
    proposals: [square],
    picked: [{ id: "water-1", checked: true, waterKind: "still", flowTo: "", current: "" }],
    sceneRect,
    imageWidth: 10,
    imageHeight: 5,
    regions: [{ id: "hand", flags: { animater: { floor: "water" } } }],
  });
  assert.deepEqual(quiet.updates, []);
  assert.equal(quiet.creates[0].name, "Water");
  assert.deepEqual(quiet.creates[0].levels, []);
  assert.equal(quiet.creates[0].flags.animater.flowTo, "");
  assert.equal(quiet.creates[0].flags.animater.current, "");
});

function fakeScene(regions = []) {
  const calls = [];
  return {
    calls,
    regions: { contents: regions },
    createEmbeddedDocuments: async (type, data) => { calls.push(["create", type, data.length]); },
    updateEmbeddedDocuments: async (type, data) => { calls.push(["update", type, data]); },
    deleteEmbeddedDocuments: async (type, ids) => { calls.push(["delete", type, ids]); },
  };
}

test("saving creates new regions without deleting previously generated regions", async () => {
  const scene = fakeScene([{ id: "old", levels: ["level-1"], flags: { animater: { generated: "water-detect" } } }]);
  const done = await commitWaterPlan({ creates: [{ name: "Water" }], updates: [] }, { scene });
  assert.deepEqual(scene.calls, [["create", "Region", 1]]);
  assert.deepEqual(done, { created: 1, updated: 0 });
});

test("created water kinds follow the upstream engine contract", () => {
  for (const [kind] of WATER_KINDS) {
    const plan = planWaterCreate({ proposals: [square], picked: [{ id: square.id, checked: true, waterKind: kind, flowTo: "wind", current: "swift", waveTo: "ne", seaBeach: "off" }], sceneRect, imageWidth: 10, imageHeight: 5, levelId: "level-1", regions: [] });
    const own = plan.creates[0].flags.animater;
    assert.equal(waterKindOf(own), kind);
    assert.equal(own.flowTo, waterFlows(kind) ? "wind" : "");
    assert.equal(own.current, waterFlows(kind) ? "swift" : "");
    assert.equal(own.waveTo, kind === "sea" ? "ne" : undefined);
    assert.equal(own.seaBeach, kind === "sea" ? "off" : undefined);
    const gentle = planWaterCreate({ proposals: [square], picked: [{ id: square.id, checked: true, waterKind: kind }], sceneRect, imageWidth: 10, imageHeight: 5, levelId: "level-1", regions: [] }).creates[0].flags.animater;
    if (kind === "rapids" || kind === "falls") assert.equal(gentle.current, "swift", "fast kinds keep their canonical current");
  }
});

test("with nothing ticked, create says so and the regions the tool made stay", async () => {
  const scene = fakeScene([{ id: "old", flags: { animater: { generated: "water-detect" } } }]);
  const plan = planWaterCreate({
    proposals: [square],
    picked: [{ id: "water-1", checked: false, flowTo: "", current: "" }],
    sceneRect,
    imageWidth: 10,
    imageHeight: 5,
    regions: scene.regions,
  });
  const notes = [];
  const outcome = await commitWaterPlan(plan, { scene, confirm: async () => true, notify: (message) => notes.push(message) });
  assert.deepEqual(outcome, { created: 0, updated: 0 });
  assert.deepEqual(scene.calls, []);
  assert.match(notes[0], /Tick an edited or new area first/);
});

test("create surfaces the reopen-generator error instead of a generic warning", async () => {
  const ui = waterApp();
  const warned = [];
  const scene = fakeScene([savedRegion("ocean")]);
  const { app } = await openWaterDetect(opening({
    Application: ui.App, scene, sceneRect: editRect, warn: (message) => warned.push(message),
    load: async () => ({ ok: true, rgba: null, width: 20, height: 20 }),
    detect: () => ({ proposals: [] }),
  }));
  scene.regions.contents.length = 0;
  ui.rows()[0].querySelector("[data-pick]").checked = true;
  ui.rows()[0].querySelector("[data-wave]").value = "s";
  await app.create();
  assert.match(warned[0], /Reopen the generator/);
  assert.doesNotMatch(warned[0], /could not be saved/);
});

test("the map is read once, resized on the long edge, and a bad image becomes a reason", async () => {
  const opened = [];
  const bitmap = (width, height) => {
    const item = { width, height, closed: false, close() { this.closed = true; } };
    opened.push(item);
    return item;
  };
  let contextOptions = null;
  class OffscreenCanvas {
    constructor(width, height) { this.width = width; this.height = height; }
    getContext(_type, options) {
      contextOptions = options;
      return { drawImage() {}, getImageData: (_x, _y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) };
    }
  }
  const calls = [];
  const loaded = await loadMapRgba("https://example.test/map.png", { width: 1024, height: 512 }, {
    fetch: async () => ({ ok: true, blob: async () => ({ type: "image/png" }) }),
    createImageBitmap: async (source, options) => {
      calls.push(options);
      return bitmap(options.resizeWidth, options.resizeHeight);
    },
    OffscreenCanvas,
  });
  assert.equal(loaded.ok, true);
  assert.equal(loaded.width, 1024);
  assert.equal(loaded.height, 512);
  assert.equal(loaded.rgba.length, 1024 * 512 * 4);
  assert.equal(calls.length, 1, "the map decodes once");
  assert.equal(calls[0].resizeQuality, "medium");
  assert.deepEqual(contextOptions, { willReadFrequently: true });
  assert.ok(opened.every((item) => item.closed));

  const video = await loadMapRgba("level.webm", { width: 8, height: 8 }, { fetch: async () => { throw new Error("should not fetch"); } });
  assert.deepEqual(video, { ok: false, reason: "video" });
  const typed = await loadMapRgba("level.png", { width: 8, height: 8 }, {
    fetch: async () => ({ ok: true, blob: async () => ({ type: "video/mp4" }) }),
    createImageBitmap: async () => { throw new Error("should not decode"); },
  });
  assert.equal(typed.reason, "video");
  const missing = await loadMapRgba("level.png", { width: 8, height: 8 }, { fetch: async () => ({ ok: false }) });
  assert.equal(missing.reason, "fetch");
  const thrown = await loadMapRgba("level.png", { width: 8, height: 8 }, { fetch: async () => { throw new Error("offline"); } });
  assert.equal(thrown.reason, "fetch");
  const tainted = await loadMapRgba("level.png", { width: 8, height: 8 }, {
    fetch: async () => ({ ok: true, blob: async () => ({ type: "image/png" }) }),
    createImageBitmap: async () => bitmap(8, 8),
    OffscreenCanvas: class {
      constructor(width, height) { this.width = width; this.height = height; }
      getContext() { return { drawImage() {}, getImageData() { const error = new Error("tainted"); error.name = "SecurityError"; throw error; } }; }
    },
  });
  assert.equal(tainted.reason, "tainted");
  assert.ok(opened.every((item) => item.closed));
});

test("an SVG background reports its own reason, by name or by its type", async () => {
  const noDecode = async () => { throw new Error("should not decode"); };
  assert.deepEqual(await loadMapRgba("maps/level.svg?v=2", { width: 8, height: 8 }, { fetch: async () => { throw new Error("should not fetch"); } }), { ok: false, reason: "unsupported-format" });
  const typed = await loadMapRgba("maps/level", { width: 8, height: 8 }, {
    fetch: async () => ({ ok: true, blob: async () => ({ type: "image/svg+xml" }) }),
    createImageBitmap: noDecode,
  });
  assert.deepEqual(typed, { ok: false, reason: "unsupported-format" });
});

test("a click on the scaled preview maps to the image pixel under it", () => {
  const rect = { left: 100, top: 50, width: 512, height: 256 };
  assert.deepEqual(previewPixel({ clientX: 100, clientY: 50 }, rect, 1024, 512), { x: 0, y: 0 });
  assert.deepEqual(previewPixel({ clientX: 356, clientY: 178 }, rect, 1024, 512), { x: 512, y: 256 });
  assert.deepEqual(previewPixel({ clientX: 612, clientY: 306 }, rect, 1024, 512), { x: 1023, y: 511 }, "the far edge stays on the image");
  assert.deepEqual(previewPixel({ clientX: 90, clientY: 400 }, rect, 1024, 512), { x: 0, y: 511 });
});

test("only a level map at Foundry's default placement is read", () => {
  const plain = { fit: "fill", offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1, rotation: 0, anchorX: 0.5, anchorY: 0.5 };
  assert.equal(levelMapIsPlain(plain), true);
  assert.equal(levelMapIsPlain(undefined), true);
  for (const change of [{ fit: "cover" }, { offsetX: 100 }, { offsetY: -1 }, { scaleX: -1 }, { scaleY: 2 }, { rotation: 90 }, { anchorX: 0 }, { anchorY: 1 }]) {
    assert.equal(levelMapIsPlain({ ...plain, ...change }), false, JSON.stringify(change));
  }
});

function waterApp(map = null) {
  const listeners = {};
  const makeRow = (id, checked, kind = "still", flowTo = "", currentTo = "", floor = "water") => {
    const box = { checked, dataset: { pick: id } }, kindSel = { value: kind }, flow = { value: flowTo }, current = { value: currentTo };
    const floorSel = { value: floor }, wave = { value: "" }, beach = { checked: true };
    const wet = floor === "water";
    const flowField = { hidden: !wet || kind === "still" || kind === "sea" }, currentField = { hidden: !wet || kind !== "river" };
    const seaFields = [{ hidden: !wet || kind !== "sea" }, { hidden: !wet || kind !== "sea" }];
    const waterFields = [{ hidden: !wet }, { hidden: !wet }, flowField, currentField, ...seaFields];
    const row = {
      dataset: { id, kind, floor },
      classList: { toggle() {}, remove() {} },
      querySelector: (selector) => ({
        "[data-pick]": box,
        "select[data-floor]": floorSel,
        "[data-floor]": floorSel,
        "[data-kind]": kindSel,
        "[data-flow]": flow,
        "[data-current]": current,
        "[data-wave]": wave,
        "[data-beach]": beach,
        "[data-flow-field]": flowField,
        "[data-current-field]": currentField,
      })[selector],
      querySelectorAll: (selector) => {
        if (selector === "[data-sea-field]") return seaFields;
        if (selector === "[data-water-fields]") return waterFields;
        return [];
      },
      remove: () => { rows.splice(rows.indexOf(row), 1); },
      closest: (selector) => (selector === "[data-id]" ? row : null),
    };
    for (const [name, select] of [["kind", kindSel], ["flow", flow], ["current", current], ["floor", floorSel]]) {
      select.getAttribute = () => id;
      select.closest = (selector) => selector === `select[data-${name}]` ? select : selector === "[data-id]" ? row : null;
    }
    return row;
  };
  const parseRows = (html) => html.split('<div class="an-water-row"').slice(1).map((part) => {
    const [, id, checked] = part.match(/data-id="([^"]+)"[^>]*>\s*<label class="an-water-pick"><input type="checkbox" data-pick="[^"]+"( checked)?/);
    const chosen = (attribute) => {
      const options = part.match(new RegExp(`<select ${attribute}="[^"]*">([\\s\\S]*?)</select>`))?.[1] ?? "";
      return options.match(/<option value="([^"]*)" selected>/)?.[1] ?? options.match(/<option value="([^"]*)"/)?.[1] ?? "";
    };
    const parsed = makeRow(id, Boolean(checked), chosen("data-kind") || "still", chosen("data-flow"), chosen("data-current"), chosen("data-floor") || "water");
    parsed.querySelector("[data-wave]").value = chosen("data-wave");
    parsed.querySelector("[data-beach]").checked = /data-beach="[^"]*" checked/.test(part);
    return parsed;
  });
  let rows = [];
  let hasReason = false;
  const shared = { kind: { value: "still" }, flow: { value: "s" }, current: { value: "" }, range: { value: "narrow" }, floorToAdd: { value: "water" } };
  const list = { set innerHTML(html) { rows = parseRows(html); }, scrollTop: 0, insertAdjacentHTML: (_where, html) => { rows.unshift(...parseRows(html)); } };
  const status = Object.fromEntries(["data-area-count", "data-selection-count", "data-create", "data-area-empty", "data-add-status", "data-add-message", "data-undo-add"].map((key) => [key, {}]));
  const query = (selector) => {
    if (map && selector === ".an-water-frame") return map.frame;
    if (map && selector === "canvas.an-water-preview") return map.canvas;
    if (status[selector.slice(1, -1)]) return status[selector.slice(1, -1)];
    if (selector === ".an-water-list") return list;
    if (selector === ".an-water-reason") return hasReason ? { remove: () => { hasReason = false; } } : null;
    if (selector === "[data-all-kind]") return shared.kind;
    if (selector === "[data-all-flow]") return shared.flow;
    if (selector === "[data-all-current]") return shared.current;
    if (selector === "[data-click-range]") return shared.range;
    if (selector === "[data-floor-to-add]") return shared.floorToAdd;
    return null;
  };
  const queryAll = (selector) => {
    if (selector === "[data-id]" || selector === ".an-water-row") return [...rows];
    if (selector === "[data-pick]:checked") return rows.filter((row) => row.querySelector("[data-pick]").checked).map((row) => row.querySelector("[data-pick]"));
    if (["[data-kind]", "[data-flow]", "[data-current]"].includes(selector)) return rows.map((row) => row.querySelector(selector));
    return [];
  };
  const content = {
    set innerHTML(html) { rows = parseRows(html); hasReason = html.includes("an-water-reason"); },
    querySelector: query,
    querySelectorAll: queryAll,
  };
  const element = { querySelector: query, querySelectorAll: queryAll, addEventListener: (type, fn) => { (listeners[type] ??= []).push(fn); } };
  class App {
    static closed = 0;
    element = element;
    async render() {
      this._replaceHTML(await this._renderHTML(), content);
      this._onRender();
      return this;
    }
    async close() { App.closed++; }
  }
  const fire = (type, target) => { for (const fn of listeners[type] ?? []) fn({ target, clientX: 30, clientY: 20 }); };
  const button = (attr, value) => { const dataset = { [attr.replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase())]: value }; return { dataset, closest: (selector) => selector === `[data-${attr}]` ? { dataset } : null }; };
  const preview = {
    closest: (selector) => (selector === "canvas.an-water-preview" ? preview : null),
    getBoundingClientRect: () => ({ left: 10, top: 10, width: 40, height: 20 }),
  };
  const setShared = (flow, current, kind = "river", range = "narrow") => { shared.kind.value = kind; shared.flow.value = flow; shared.current.value = current; shared.range.value = range; };
  return { App, fire, button, preview, status, rows: () => rows, hasReason: () => hasReason, listeners, setShared };
}

const pieces = (over = {}) => ({ id: "water-1", share: 0.3, preselected: true, vertices: 3, loops: [{ points: [0, 0, 10, 0, 10, 5], hole: false }], pixels: new Int32Array(), ...over });
const opening = (over) => ({
  src: "map.png",
  sceneRect,
  levelId: "level-1",
  load: async () => ({ ok: true, rgba: new Uint8Array(40), width: 10, height: 1 }),
  notify: () => {},
  warn: () => {},
  confirm: async () => true,
  ...over,
});

test("a map with no automatic water still opens, with the reason and a way to click", async () => {
  const { App } = waterApp();
  const notes = [];
  const opened = await openWaterDetect(opening({
    scene: fakeScene(),
    detect: () => ({ status: "none", reason: "no-saturated-colour" }),
    Application: App,
    notify: (message) => notes.push(message),
  }));
  assert.equal(opened.opened, true);
  assert.equal(opened.reason, "no-saturated-colour");
  assert.deepEqual(notes, []);
  const html = await opened.app._renderHTML();
  assert.match(html, /too grey to be water/);
  assert.match(html, /Pick a floor above, then click it on the map/);
  assert.deepEqual(opened.app.detect.proposals, []);
});

test("video, an unreadable image, and a moved level map warn and open nothing", async () => {
  let built = 0;
  class Counted { constructor() { built++; } async render() {} }
  const warned = [];
  const base = { Application: Counted, warn: (message) => warned.push(message), detect: () => { throw new Error("should not detect"); } };
  assert.equal((await openWaterDetect(opening({ ...base, load: async () => ({ ok: false, reason: "video" }) }))).opened, false);
  assert.match(warned.at(-1), /video/);
  assert.equal((await openWaterDetect(opening({ ...base, load: async () => ({ ok: false, reason: "tainted" }) }))).opened, false);
  assert.match(warned.at(-1), /could not be read/);
  const moved = await openWaterDetect(opening({ ...base, textures: { offsetX: 200 }, load: async () => { throw new Error("should not load"); } }));
  assert.equal(moved.opened, false);
  assert.equal(moved.reason, "transformed");
  assert.match(warned.at(-1), /moved, scaled or rotated/);
  assert.equal(built, 0);
});

test("a click adds a ticked row without a re-render, a bad click only notifies, and remove undoes it", async () => {
  const { App, fire, button, preview, rows, hasReason } = waterApp();
  const notes = [];
  const clicks = [];
  let answer = { status: "found", proposal: pieces({ id: "water-2", clicked: true }), seed: { hue: 200, saturation: 0.4 } };
  const { app } = await openWaterDetect(opening({
    scene: fakeScene(),
    detect: () => ({ status: "none", reason: "no-candidates" }),
    select: (_rgba, _w, _h, at, options) => { clicks.push({ at, claimed: options.claimed.length }); return answer; },
    Application: App,
    notify: (message) => notes.push(message),
  }));
  assert.equal(hasReason(), true);
  let renders = 0;
  const replace = app._replaceHTML;
  app._replaceHTML = function (...args) { renders++; return replace.apply(this, args); };
  fire("click", preview);
  assert.deepEqual(clicks[0], { at: { x: 5, y: 0 }, claimed: 0 });
  assert.equal(renders, 0, "no re-render");
  assert.deepEqual(rows().map((row) => row.dataset.id), ["water-2"]);
  assert.equal(rows()[0].querySelector("[data-pick]").checked, true);
  assert.equal(hasReason(), false, "the reason no longer applies");
  answer = { status: "none", reason: "already-water" };
  fire("click", preview);
  assert.equal(clicks[1].claimed, 1);
  assert.match(notes.at(-1), /already in the list/);
  assert.equal(rows().length, 1);
  fire("click", button("remove", "water-2"));
  assert.deepEqual(rows(), []);
  assert.deepEqual(app.detect.proposals, []);
});

test("a clicked row takes the flow and current the shared selects show", async () => {
  const { App, fire, preview, rows, setShared } = waterApp();
  const { app } = await openWaterDetect(opening({
    scene: fakeScene(),
    detect: () => ({ status: "none", reason: "no-candidates" }),
    select: () => ({ status: "found", proposal: pieces({ id: "water-2", clicked: true }), seed: { hue: 200, saturation: 0.4 } }),
    Application: App,
  }));
  setShared("s", "swift");
  fire("click", preview);
  assert.equal(rows()[0].querySelector("[data-flow]").value, "s");
  assert.equal(rows()[0].querySelector("[data-current]").value, "swift");
  const plan = planWaterCreate({ proposals: app.detect.proposals, picked: [{ id: "water-2", checked: true, waterKind: "river", flowTo: rows()[0].querySelector("[data-flow]").value, current: rows()[0].querySelector("[data-current]").value }], sceneRect, imageWidth: 10, imageHeight: 1, levelId: "level-1", regions: [] });
  assert.equal(plan.creates[0].flags.animater.waterKind, "river");
  assert.equal(plan.creates[0].flags.animater.flowTo, "s");
  assert.equal(plan.creates[0].flags.animater.current, "swift");
});

test("wide click selection is explicit and defaults to narrow", async () => {
  const { App, fire, preview, setShared } = waterApp();
  const broad = [];
  const { app } = await openWaterDetect(opening({ Application: App, select: (_rgba, _w, _h, _at, options) => { broad.push(options.broad); return { status: "none", reason: "too-small" }; } }));
  fire("click", preview);
  setShared("s", "", "still", "wide");
  fire("click", preview);
  assert.deepEqual(broad, [false, true]);
  assert.match(await app._renderHTML(), /Wide can join touching colours/);
});

test("shared kinds change checked rows and preserve an unchecked row", async () => {
  const { App, fire, rows, setShared } = waterApp();
  const { app } = await openWaterDetect(opening({ Application: App, detect: () => ({ status: "found", proposals: [square, speck] }) }));
  setShared("wind", "swift", "rapids");
  fire("change", { value: "rapids", closest: (selector) => selector === "[data-all-kind]" ? {} : null });
  assert.equal(rows()[0].querySelector("[data-kind]").value, "rapids");
  assert.equal(rows()[0].querySelector("[data-current]").value, "swift");
  assert.equal(rows()[0].querySelector("[data-flow-field]").hidden, false);
  assert.equal(rows()[1].querySelector("[data-kind]").value, "still");
  const kind = rows()[0].querySelector("[data-kind]");
  kind.value = "sea";
  fire("change", kind);
  rows()[0].querySelector("[data-pick]").checked = false;
  rows()[0].querySelector("[data-wave]").value = "nw";
  rows()[0].querySelector("[data-beach]").checked = false;
  await app.render();
  assert.equal(rows()[0].querySelector("[data-kind]").value, "sea");
  assert.equal(rows()[0].querySelector("[data-pick]").checked, false);
  assert.equal(rows()[0].querySelector("[data-wave]").value, "nw");
  assert.equal(rows()[0].querySelector("[data-beach]").checked, false);
});

test("a row drawn with shared values selects them, and a row drawn without selects the first option", () => {
  const shared = waterRowHTML(pieces({ id: "water-3" }), { waterKind: "river", flowTo: "ne", current: "swift" });
  assert.match(shared, /<option value="ne" selected>/);
  assert.match(shared, /<option value="swift" selected>/);
  assert.match(waterRowHTML(pieces({ id: "water-3" })), /<option value="still" selected>/);
});

test("a clicked piece above a quarter of the map carries a warning, and only a clicked one", () => {
  assert.match(waterRowHTML(pieces({ clicked: true, share: 0.39 })), /39\.0% of the map/);
  assert.doesNotMatch(waterRowHTML(pieces({ clicked: true, share: 0.2 })), /of the map/);
  assert.doesNotMatch(waterRowHTML(pieces({ share: 0.73 })), /of the map/);
  assert.match(waterRowHTML(pieces()), /data-remove="water-1"/);
  assert.match(waterRowHTML(pieces()), /Add to area/);
  assert.match(waterRowHTML({ ...pieces(), clicked: true, share: 0.3 }), /Check this area/);
  assert.match(waterRowHTML(pieces()), /Edit outline/);
  assert.doesNotMatch(waterRowHTML(pieces()), /Remove water/);
});

test("a second render keeps the controls and the GM's choices", async () => {
  const { App, fire, button, rows, listeners } = waterApp();
  const scene = fakeScene();
  const { app } = await openWaterDetect(opening({
    scene,
    detect: () => ({ status: "found", proposals: [pieces()], waterColor: { hue: 200, saturation: 0.9 }, width: 10, height: 1 }),
    Application: App,
  }));
  rows()[0].querySelector("[data-flow]").value = "s";
  rows()[0].querySelector("[data-kind]").value = "river";
  rows()[0].querySelector("[data-pick]").checked = true;
  await app.render();
  assert.equal(rows()[0].querySelector("[data-flow]").value, "s");
  assert.equal(listeners.click.length, 1, "wired once");
  fire("click", button("create", ""));
  await new Promise((resolve) => setTimeout(resolve));
  assert.deepEqual(scene.calls, [["create", "Region", 1]]);
  assert.equal(App.closed, 1);
});

test("the window writes to the scene it opened on and reads its regions at commit", async () => {
  const { App, fire, button } = waterApp();
  const opened = fakeScene([]);
  const other = fakeScene([{ id: "elsewhere", flags: { animater: { generated: "water-detect" } } }]);
  await openWaterDetect(opening({
    scene: opened,
    detect: () => ({ status: "found", proposals: [pieces()], waterColor: { hue: 200, saturation: 0.9 }, width: 10, height: 1 }),
    Application: App,
  }));
  opened.regions.contents.push({ id: "made-since", levels: ["level-1"], flags: { animater: { generated: "water-detect" } } });
  fire("click", button("create", ""));
  await new Promise((resolve) => setTimeout(resolve));
  assert.deepEqual(opened.calls, [["create", "Region", 1]]);
  assert.deepEqual(other.calls, []);
});

test("a click made while another open is in flight joins it, and a later click still replaces the window", async () => {
  const { App } = waterApp();
  let loads = 0;
  const args = opening({
    scene: fakeScene(),
    load: async () => { loads++; await new Promise((resolve) => setTimeout(resolve, 5)); return { ok: true, rgba: new Uint8Array(40), width: 10, height: 1 }; },
    detect: () => ({ status: "none", reason: "no-candidates" }),
    Application: App,
  });
  const [first, second] = await Promise.all([openWaterDetect(args), openWaterDetect(args)]);
  assert.equal(loads, 1, "one read");
  assert.equal(first.app, second.app, "one window");
  const before = App.closed;
  const third = await openWaterDetect(args);
  assert.equal(App.closed, before + 1);
  assert.notEqual(third.app, first.app);
});

test("a second click on the tool replaces the open window", async () => {
  const { App } = waterApp();
  const args = opening({ scene: fakeScene(), detect: () => ({ status: "none", reason: "no-candidates" }), Application: App });
  await openWaterDetect(args);
  const before = App.closed;
  await openWaterDetect(args);
  assert.equal(App.closed, before + 1);
});

test("the setting is registered off and Detect water is wired into the Animater controls", () => {
  const main = readFileSync(new URL("../../scripts/main.mjs", import.meta.url), "utf8");
  assert.match(main, /registerSetting\("experimentalWaterRegions", \{[\s\S]*?name: "Experimental: detect floor regions"[\s\S]*?default: false/);
  assert.match(main, /hint: "Adds a button in the Animater controls/);
  assert.match(main, /\['toolDetectWater','Show the Detect floors button'/);
  assert.match(main, /name: "animaterDetectWater"/);
  assert.match(main, /toolShown\("toolDetectWater"\) && game\.settings\.get\(ID, "experimentalWaterRegions"\) === true/);
  assert.doesNotMatch(main, /c\.name === "regions"/);
  assert.match(main, /import\("\.\/ui\/water-detect-ui\.mjs"\)/);
});

const openOptions = (id, load, extra = {}) => ({
  src: `${id}.png`,
  scene: { id, regions: { contents: [] } },
  levelId: `level-${id}`,
  sceneRect: { x: 0, y: 0, width: 100, height: 100 },
  textures: {},
  load,
  detect: () => ({ status: "none", reason: "no-candidates" }),
  notify() {},
  warn() {},
  Application: class { async render() {} async close() {} },
  ...extra,
});
const heldLoad = () => {
  const held = {};
  held.load = (src, _size, { signal }) => new Promise((resolve) => {
    held.release = () => resolve({ ok: true, src, rgba: new Uint8ClampedArray(4), width: 1, height: 1 });
    held.signal = signal;
  });
  return held;
};

test("a click on another scene during a load opens that scene, and the first load is dropped", async () => {
  const first = heldLoad(), second = heldLoad();
  const opening = openWaterDetect(openOptions("a", first.load));
  const moved = openWaterDetect(openOptions("b", second.load));
  assert.equal(first.signal.aborted, true);
  first.release();
  assert.equal((await opening).reason, "superseded");
  second.release();
  const opened = await moved;
  assert.equal(opened.opened, true);
  assert.equal(opened.app.detect.scene.id, "b");
});

test("a click on the same map during a load joins it and says so", async () => {
  const held = heldLoad(), notes = [];
  const opening = openWaterDetect(openOptions("a", held.load));
  const joined = openWaterDetect(openOptions("a", () => assert.fail("a second load started"), { notify: (m) => notes.push(m) }));
  assert.match(notes[0], /Still reading/);
  held.release();
  assert.equal((await joined).app, (await opening).app);
});

test("a map load that never finishes gives up, and the next click loads again", async () => {
  // AbortSignal.timeout is not retained as an active handle under this runner, so keep the loop alive until the abort fires.
  const keep = setInterval(() => {}, 1);
  try {
    const stalled = await loadMapRgba("stalled.png", { width: 8, height: 8 }, {
      timeoutMs: 5,
      fetch: (_src, { signal }) => new Promise((_resolve, reject) => { signal.addEventListener("abort", () => reject(signal.reason)); }),
    });
    assert.deepEqual(stalled, { ok: false, reason: "timeout" });
    assert.match(failureMessage("timeout"), /too long/);
  } finally {
    clearInterval(keep);
  }
});

test("a scene superseded while the previous window closes never renders", async () => {
  let release, entered;
  const closing = new Promise((resolve) => { release = resolve; });
  const didEnter = new Promise((resolve) => { entered = resolve; });
  const rendered = [];
  class SlowApp {
    async render() { rendered.push(this.detect.scene.id); }
    async close() { if (this.detect?.scene.id === "held") { entered(); await closing; } }
  }
  const load = async () => ({ ok: true, rgba: new Uint8ClampedArray(4), width: 1, height: 1 });
  const prior = await openWaterDetect(openOptions("held", load, { Application: SlowApp }));
  const first = openWaterDetect(openOptions("superseded", load, { Application: SlowApp }));
  await didEnter;
  const last = openWaterDetect(openOptions("latest", load, { Application: SlowApp }));
  release();
  assert.equal((await first).reason, "superseded");
  const final = await last;
  assert.deepEqual(rendered, ["held", "latest"]);
  assert.equal(prior.app.detect, null, "closed windows release their pixels and proposal lists");
  await final.app.close();
  assert.equal(final.app.detect, null);
});


test("counts and create action follow checked, added, and removed areas", async () => {
  const ui = waterApp();
  const notes = [];
  const { app } = await openWaterDetect(opening({ scene: fakeScene(), Application: ui.App,
    detect: () => ({ status: "found", proposals: [pieces(), pieces({ id: "water-2", preselected: false })], width: 10, height: 1 }),
    select: () => ({ status: "found", proposal: pieces({ id: "water-3", clicked: true }) }),
    notify: (message) => notes.push(message),
  }));
  assert.equal(ui.status["data-selection-count"].textContent, "1 of 2 areas selected");
  assert.equal(ui.status["data-create"].textContent, "Create 1 region");
  const box = ui.rows()[0].querySelector("[data-pick]");
  box.checked = false;
  ui.fire("change", { closest: () => null });
  assert.equal(ui.status["data-create"].disabled, true);
  ui.fire("click", ui.preview);
  assert.equal(ui.status["data-selection-count"].textContent, "1 of 3 areas selected");
  app.removeRow("water-2");
  assert.equal(ui.status["data-area-count"].textContent, "2 found · 1 selected");
  await app.create();
  assert.equal(notes.at(-1), "Created 1 region.");
});

test("zoom enlarges the preview, keeps click coordinates accurate, and fits again", () => {
  const frame = { clientWidth: 500, clientHeight: 400, scrollLeft: 0, scrollTop: 0,
    getBoundingClientRect: () => ({ left: 0, top: 0 }) };
  const style = { width: "400px", height: "400px" };
  const canvas = { style, getBoundingClientRect: () => ({ left: Math.max(0, (500 - parseFloat(style.width)) / 2) - frame.scrollLeft,
    top: -frame.scrollTop, width: parseFloat(style.width), height: parseFloat(style.height) }) };
  const label = {};
  const Window = waterDetectWindow(class {});
  const app = new Window();
  app.detect = { width: 1000, height: 1000 };
  app.element = { querySelector: (selector) => ({ ".an-water-frame": frame, "canvas.an-water-preview": canvas, "[data-zoom-label]": label })[selector] };
  app.zoomMap(2, { x: 250, y: 200 });
  assert.equal(style.width, "800px");
  assert.equal(label.textContent, "200%");
  assert.deepEqual(previewPixel({ clientX: 250, clientY: 200 }, canvas.getBoundingClientRect(), 1000, 1000), { x: 500, y: 500 });
  app.zoomMap(100);
  assert.equal(app.zoom, 8);
  app.zoomMap(1);
  assert.equal(style.width, "400px");
  assert.equal(frame.scrollLeft, 0);
  assert.equal(frame.scrollTop, 0);
});

test("dragging the map pans without adding an area, and a later click still selects", (t) => {
  const original = globalThis.ResizeObserver;
  globalThis.ResizeObserver = class { observe() {} disconnect() {} };
  t.after(() => { if (original) globalThis.ResizeObserver = original; else delete globalThis.ResizeObserver; });
  const frameEvents = {}, rootEvents = {};
  const frame = { scrollLeft: 150, scrollTop: 100, setPointerCapture() {}, addEventListener: (name, fn) => { frameEvents[name] = fn; } };
  let clicks = 0;
  const Window = waterDetectWindow(class {}, { select: () => { clicks++; return { status: "none", reason: "no-colour" }; } });
  const app = new Window();
  app.detect = { rgba: new Uint8Array(400), width: 10, height: 10, proposals: [] };
  app.element = { querySelector: (selector) => selector === ".an-water-frame" ? frame : null,
    addEventListener: (name, fn) => { rootEvents[name] = fn; } };
  app._onRender();
  frameEvents.pointerdown({ button: 0, clientX: 50, clientY: 50 });
  frameEvents.pointermove({ clientX: 80, clientY: 70, pointerId: 1, preventDefault() {} });
  frameEvents.pointerup();
  assert.equal(frame.scrollLeft, 120);
  assert.equal(frame.scrollTop, 80);
  const preview = { closest: (selector) => selector === "canvas.an-water-preview" ? preview : null,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }) };
  rootEvents.click({ target: preview, clientX: 50, clientY: 50 });
  assert.equal(clicks, 0);
  frameEvents.pointerdown({ button: 0, clientX: 50, clientY: 50 });
  frameEvents.pointerup();
  rootEvents.click({ target: preview, clientX: 50, clientY: 50 });
  assert.equal(clicks, 1);
});


test("an ocean draft absorbs only the clicked area, preserves Sea settings, and can undo", async () => {
  const ui = waterApp();
  const proposals = [pieces({ id: "water-1", pixels: new Int32Array([0, 1, 10, 11]) }), pieces({ id: "water-2", pixels: new Int32Array([8, 9, 18, 19]) }), pieces({ id: "water-3", preselected: false, pixels: new Int32Array([50, 51, 60, 61]) })];
  const scene = fakeScene();
  let created;
  scene.createEmbeddedDocuments = async (_type, data) => { created = data; };
  const { app } = await openWaterDetect(opening({ scene, Application: ui.App,
    load: async () => ({ ok: true, rgba: new Uint8Array(400), width: 10, height: 10 }),
    detect: () => ({ status: "found", proposals }),
  }));
  const ocean = ui.rows()[0];
  ocean.querySelector("[data-kind]").value = "sea";
  ocean.querySelector("[data-wave]").value = "ne";
  ocean.querySelector("[data-beach]").checked = false;
  ui.fire("click", ui.button("add-to", "water-1"));
  app.clickPreview({ target: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }) }, clientX: 85, clientY: 5 });
  assert.deepEqual(app.detect.proposals.map((p) => p.id), ["water-1", "water-3"]);
  const merged = ui.rows().find((row) => row.dataset.id === "water-1");
  assert.equal(merged.querySelector("[data-kind]").value, "sea");
  assert.equal(merged.querySelector("[data-wave]").value, "ne");
  assert.equal(merged.querySelector("[data-beach]").checked, false);
  assert.equal(merged.querySelector("[data-pick]").checked, true);
  assert.deepEqual([...app.detect.proposals[0].pixels].sort((a,b)=>a-b), [0, 1, 8, 9, 10, 11, 18, 19]);
  assert.equal(ui.status["data-selection-count"].textContent, "1 of 2 areas selected");
  app.undoAdd();
  assert.deepEqual(app.detect.proposals.map((p) => p.id), ["water-1", "water-2", "water-3"]);
  assert.equal(ui.status["data-selection-count"].textContent, "2 of 3 areas selected");
  app.clickPreview({ target: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }) }, clientX: 85, clientY: 5 });
  await app.create();
  assert.equal(created.length, 1);
  assert.equal(created[0].flags.animater.waterKind, "sea");
  assert.equal(created[0].flags.animater.waveTo, "ne");
  assert.equal(created[0].flags.animater.seaBeach, "off");
  assert.equal(created[0].shapes.filter((shape) => !shape.hole).length, 2);
});

test("a shoreline click expands the active area instead of adding a new row", async () => {
  const ui = waterApp();
  let claimed;
  const { app } = await openWaterDetect(opening({ scene: fakeScene(), Application: ui.App,
    load: async () => ({ ok: true, rgba: new Uint8Array(400), width: 10, height: 10 }),
    detect: () => ({ status: "found", proposals: [pieces({ pixels: new Int32Array([0, 1, 10, 11]) }), pieces({ id: "water-2", pixels: new Int32Array([88, 89, 98, 99]) })] }),
    select: (_rgba, _w, _h, _point, options) => { claimed = options.claimed; return { status: "found", proposal: pieces({ pixels: new Int32Array([2, 3, 12, 13]) }) }; },
  }));
  app.setAddTarget("water-1");
  ui.fire("click", ui.preview);
  assert.deepEqual(claimed.map((p) => p.id), ["water-2"]);
  assert.equal(ui.rows().length, 2);
  assert.equal(app.detect.proposals[0].pixels.length, 8);
  ui.fire("click", ui.button("add-done", ""));
  assert.deepEqual(app.mode, { kind: "inspect" });
  assert.equal(app.history.length, 1);
  await app.close();
});


test("Add water ignores checkbox state and leaves save selection unchanged", async () => {
  const ui = waterApp();
  let selectedCalls = 0;
  const { app } = await openWaterDetect(opening({ scene: fakeScene(), Application: ui.App,
    load: async () => ({ ok: true, rgba: new Uint8Array(400), width: 10, height: 10 }),
    detect: () => ({ status: "found", proposals: [
      pieces({ id: "water-1", preselected: false, pixels: new Int32Array([0, 1, 10, 11]) }),
      pieces({ id: "water-2", preselected: false, pixels: new Int32Array([8, 9, 18, 19]) }),
      pieces({ id: "water-3", pixels: new Int32Array([88, 89, 98, 99]) }),
    ] }),
    select: () => { selectedCalls++; return { status: "found", proposal: pieces({ pixels: new Int32Array([2, 3, 12, 13]) }) }; },
  }));
  app.setAddTarget("water-1");
  assert.equal(ui.rows()[0].querySelector("[data-pick]").checked, false, "choosing a target does not select it for saving");
  app.clickPreview({ target: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }) }, clientX: 85, clientY: 5 });
  assert.equal(selectedCalls, 0, "clicking an existing area adds its exact shape");
  assert.deepEqual(app.detect.proposals.map((p) => p.id), ["water-1", "water-3"]);
  assert.equal(app.detect.proposals[0].pixels.length, 8);
  assert.equal(ui.rows()[0].querySelector("[data-pick]").checked, false);
  assert.equal(ui.rows()[1].querySelector("[data-pick]").checked, true, "a different checked area is not merged");
  const box = ui.rows()[0].querySelector("[data-pick]");
  box.checked = true;
  box.checked = false;
  ui.fire("change", { ...box, closest: (selector) => selector === "[data-pick]" ? box : null });
  assert.equal(app.mode.areaId, "water-1", "unticking the target does not stop Add water");
  ui.fire("click", ui.preview);
  assert.equal(selectedCalls, 1);
  assert.equal(app.detect.proposals[0].pixels.length, 12, "an unchecked target can still gain missed water");
  assert.equal(ui.rows()[0].querySelector("[data-pick]").checked, false);
  assert.equal(ui.status["data-selection-count"].textContent, "1 of 2 areas selected");
  await app.close();
});


function savedRegion(id, x = 100) {
  return { id, name: `Saved ${id}`, color: "#abcdef", levels: ["level-1"],
    shapes: [{ type: "polygon", points: [x, 200, x + 80, 200, x + 80, 280, x, 280], hole: false }],
    behaviors: [{ type: "executeScript", name: "GM behavior" }],
    flags: { animater: { generated: "water-detect", floor: "water", waterKind: "sea", waveTo: "ne", seaBeach: "off", steps: [{ name: "Frozen" }], step: 0 }, custom: { keep: true } },
  };
}
const editRect = { x: 100, y: 200, width: 200, height: 200 };

test("saved water reloads its ID, settings, exact outlines and hole coverage", () => {
  const region = savedRegion("ocean");
  region.shapes.push({ type: "polygon", points: [120, 220, 140, 220, 140, 240, 120, 240], hole: true });
  const [proposal] = savedWaterProposals([region], { levelId: "level-1", sceneRect: editRect, width: 20, height: 20 });
  assert.equal(proposal.regionId, "ocean");
  assert.equal(proposal.preselected, false);
  assert.equal(proposal.savedChoices.waterKind, "sea");
  assert.equal(proposal.savedChoices.waveTo, "ne");
  assert.equal(proposal.savedChoices.seaBeach, "off");
  assert.equal(proposal.pixels.length, 60);
  assert.equal(new Set(proposal.pixels).has(2 * 20 + 2), false);
  assert.deepEqual(proposal.loops[0].points, [0, 0, 8, 0, 8, 8, 0, 8]);
});

test("editing one saved region updates only changed fields and never replaces other documents", async () => {
  const ocean = savedRegion("ocean"), river = savedRegion("river", 220);
  const regions = [ocean, river];
  const before = JSON.stringify(regions);
  const proposals = savedWaterProposals(regions, { levelId: "level-1", sceneRect: editRect, width: 20, height: 20 });
  const picked = proposals.map((p, i) => ({ id: p.id, checked: true, ...p.savedChoices, ...(i === 0 ? { waveTo: "s" } : {}) }));
  const plan = planWaterCreate({ proposals, picked, regions, levelId: "level-1", sceneRect: editRect, imageWidth: 20, imageHeight: 20 });
  assert.deepEqual(plan.creates, []);
  assert.deepEqual(plan.updates, [{ _id: "ocean", "flags.animater.waveTo": "s" }]);
  const scene = fakeScene(regions);
  const result = await commitWaterPlan(plan, { scene });
  assert.deepEqual(scene.calls, [["update", "Region", [{ _id: "ocean", "flags.animater.waveTo": "s" }]]]);
  assert.deepEqual(result, { created: 0, updated: 1 });
  assert.equal(JSON.stringify(regions), before, "no source geometry, behavior, steps or other flags are mutated by planning");
});

test("saved regions reopen without duplicate automatic proposals and extend by updating their original ID", async () => {
  const ui = waterApp();
  const ocean = savedRegion("ocean"), other = savedRegion("other", 220);
  const scene = fakeScene([ocean, other]);
  const initial = savedWaterProposals([ocean], { levelId: "level-1", sceneRect: editRect, width: 20, height: 20 })[0];
  const { app } = await openWaterDetect(opening({ scene, sceneRect: editRect, Application: ui.App,
    load: async () => ({ ok: true, rgba: new Uint8Array(1600), width: 20, height: 20 }),
    detect: () => ({ status: "found", proposals: [{ ...initial, regionId: undefined }] }),
    select: () => ({ status: "found", proposal: pieces({ pixels: new Int32Array([8,9,28,29,48,49,68,69]) }) }),
  }));
  assert.equal(app.detect.proposals.length, 2, "only the two saved regions, no duplicate detection");
  app.setAddTarget("water-1");
  ui.fire("click", ui.preview);
  assert.equal(ui.rows().find((r) => r.dataset.id === "water-1").querySelector("[data-pick]").checked, false);
  const row = ui.rows().find((r) => r.dataset.id === "water-1");
  row.querySelector("[data-pick]").checked = true;
  await app.create();
  assert.equal(scene.calls.length, 1);
  assert.equal(scene.calls[0][0], "update");
  assert.equal(scene.calls[0][2].length, 1);
  assert.equal(scene.calls[0][2][0]._id, "ocean");
  assert.ok(scene.calls[0][2][0].shapes.length > 0);
  assert.deepEqual(Object.keys(scene.calls[0][2][0]).sort(), ["_id", "shapes"]);
});

test("ticking unchanged saved water does not rewrite shapes or unrelated settings", () => {
  const region = savedRegion("still");
  region.flags.animater.waterKind = "still";
  const proposals = savedWaterProposals([region], { levelId: "level-1", sceneRect: editRect, width: 20, height: 20 });
  const picked = [{ id: proposals[0].id, checked: true, waterKind: "still", flowTo: "s", current: "", waveTo: "ne", seaBeach: "off" }];
  const plan = planWaterCreate({ proposals, picked, regions: [region], levelId: "level-1", sceneRect: editRect, imageWidth: 20, imageHeight: 20 });
  assert.deepEqual(plan, { creates: [], updates: [] });
});


test("saved geometry uses Foundry's resolved polygon tree for edited shape types", () => {
  const region = savedRegion("shaped");
  region.shapes = [{ type: "rectangle", x: 100, y: 200, width: 80, height: 80 }];
  region.polygonTree = { children: [{ points: [100, 200, 180, 200, 180, 280, 100, 280], isHole: false, children: [
    { points: [120, 220, 140, 220, 140, 240, 120, 240], isHole: true, children: [] },
  ] }] };
  const [proposal] = savedWaterProposals([region], { levelId: "level-1", sceneRect: editRect, width: 20, height: 20 });
  assert.equal(proposal.pixels.length, 60);
  assert.equal(proposal.loops[1].hole, true);
});

test("reopening saved water leaves fresh suggestions unticked and Leave unchanged writes nothing", async () => {
  const ui = waterApp();
  const scene = fakeScene([savedRegion("ocean")]);
  const { app } = await openWaterDetect(opening({ scene, sceneRect: editRect, Application: ui.App,
    load: async () => ({ ok: true, rgba: new Uint8Array(1600), width: 20, height: 20 }),
    detect: () => ({ status: "found", proposals: [pieces({ pixels: new Int32Array([210,211,230,231]) })] }),
  }));
  assert.equal(app.detect.proposals.length, 2);
  assert.equal(ui.rows().every((row) => !row.querySelector("[data-pick]").checked), true);
  ui.rows()[0].querySelector("[data-pick]").checked = true;
  app.removeRow("water-1");
  assert.equal(app.detect.proposals[0].regionId, "ocean", "saved row stays available");
  await app.create();
  assert.deepEqual(scene.calls, []);
  await app.close();
});

test("reopening a saved shore does not offer a junk row of combined sliver fragments", async () => {
  const { WATER_TUNING, waterProposalFromLoops } = await import("../../scripts/engines/regions/floor-trace.mjs");
  const width = 200, height = 200, count = width * height;
  const min = count * WATER_TUNING.componentMinShare;
  const savedLoops = [{ points: [10, 10, 50, 10, 50, 50, 10, 50], hole: false }];
  const saved = { ...waterProposalFromLoops(savedLoops, width, height), id: "water-1", regionId: "river", name: "River",
    savedChoices: { waterKind: "still", flowTo: "", current: "", waveTo: "", seaBeach: "" }, preselected: false };
  const slivers = [];
  for (let i = 0; i < Math.ceil(min) + 10; i++) slivers.push(60 * width + 2 * i);
  assert.ok(slivers.length / count >= WATER_TUNING.componentMinShare);
  const detected = { id: "water-1", pixels: Int32Array.from([...saved.pixels, ...slivers]), loops: savedLoops, share: (saved.pixels.length + slivers.length) / count, vertices: 4 };
  const region = {
    id: "river", name: "River", levels: ["level-1"],
    shapes: [{ type: "polygon", points: savedLoops[0].points.flatMap((v, i) => i % 2 ? 200 + v : 100 + v), hole: false }],
    flags: { animater: { generated: "water-detect", floor: "water", waterKind: "still" } },
  };
  const ui = waterApp();
  const { app } = await openWaterDetect(opening({
    scene: fakeScene([region]), sceneRect: editRect, Application: ui.App,
    load: async () => ({ ok: true, rgba: new Uint8Array(count * 4), width, height }),
    detect: () => ({ status: "found", proposals: [detected] }),
  }));
  assert.equal(app.detect.proposals.length, 1);
  assert.equal(app.detect.proposals[0].regionId, "river");
  assert.equal(ui.rows().length, 1);
  await app.close();
});

test("unticked outline edits warn on save and close instead of vanishing silently", async (t) => {
  const map = outlineMap(t), ui = waterApp(map), asks = [];
  let allow = false;
  const scene = fakeScene([savedRegion("edited"), savedRegion("other", 200)]);
  const { app } = await openWaterDetect(opening({
    Application: ui.App, scene, sceneRect: editRect,
    load: async () => ({ ok: true, rgba: null, width: 20, height: 20 }),
    detect: () => ({ proposals: [] }),
    confirm: async (message) => { asks.push(message); return allow; },
  }));
  ui.fire("click", ui.button("edit-outline", "water-1"));
  map.fire("pointerdown", 8, 0); map.fire("pointermove", 6.25, 0); map.fire("pointerup", 6.25, 0);
  assert.equal(app.detect.proposals[0].geometryChanged, true);
  assert.equal(ui.rows()[0].querySelector("[data-pick]").checked, false);
  const other = ui.rows()[1];
  other.querySelector("[data-pick]").checked = true;
  other.querySelector("[data-wave]").value = "s";
  await app.create();
  assert.equal(asks.length, 1);
  assert.match(asks[0], /unticked|discard/i);
  assert.deepEqual(scene.calls, []);
  assert.equal(app.detect?.proposals[0].geometryChanged, true);
  allow = true;
  await app.create();
  assert.equal(asks.length, 2);
  assert.equal(scene.calls.length, 1);
  assert.equal(scene.calls[0][0], "update");
  assert.equal(scene.calls[0][2][0]._id, "other");
  assert.equal(app.detect, null);

  const map2 = outlineMap(t), ui2 = waterApp(map2), closeAsks = [];
  const again = await openWaterDetect(opening({
    Application: ui2.App, scene: fakeScene([savedRegion("edited")]), sceneRect: editRect,
    load: async () => ({ ok: true, rgba: null, width: 20, height: 20 }),
    detect: () => ({ proposals: [] }),
    confirm: async (message) => { closeAsks.push(message); return false; },
  }));
  ui2.fire("click", ui2.button("edit-outline", "water-1"));
  map2.fire("pointerdown", 8, 0); map2.fire("pointermove", 6.25, 0); map2.fire("pointerup", 6.25, 0);
  const closed = await again.app.close();
  assert.equal(closeAsks.length, 1);
  assert.match(closeAsks[0], /unticked|discard/i);
  assert.equal(again.app.detect?.proposals[0].geometryChanged, true, "cancel keeps the window open");
  assert.equal(closed, again.app);
});

function outlineMap(t) {
  const original = globalThis.ResizeObserver;
  globalThis.ResizeObserver = class { observe() {} disconnect() {} };
  t.after(() => { if (original) globalThis.ResizeObserver = original; else delete globalThis.ResizeObserver; });
  const events = {};
  const rect = { left: 10, top: 20, width: 200, height: 200 };
  const ctx = { clearRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, fill() {}, stroke() {}, fillRect() {} };
  const canvas = { style: {}, getContext: () => ctx, getBoundingClientRect: () => rect };
  const frame = { setAttribute() {}, scrollLeft: 0, scrollTop: 0, focus() {}, setPointerCapture() {}, addEventListener: (name, fn) => { events[name] = fn; } };
  const fire = (type, x, y, extra = {}) => events[type]({ clientX: rect.left + x * rect.width / 20, clientY: rect.top + y * rect.height / 20, button: 0, pointerId: 1, preventDefault() {}, ...extra });
  return { frame, canvas, rect, fire };
}

test("outline gestures commit once, cancel atomically, undo with current choices, and save only shapes by ID", async (t) => {
  const map = outlineMap(t), ui = waterApp(map), scene = fakeScene([savedRegion("edited"), savedRegion("other",200)]);
  let selects = 0;
  const { app } = await openWaterDetect(opening({ Application: ui.App, scene, sceneRect: editRect,
    load: async () => ({ ok: true, rgba: null, width: 20, height: 20 }),
    detect: () => ({ proposals: [] }), select: () => { selects++; return { status: "none", reason: "too-small" }; },
  }));
  const before = app.detect.proposals[0], other = app.detect.proposals[1];
  ui.fire("click", ui.button("edit-outline","water-1"));
  assert.equal(ui.rows()[0].querySelector("[data-pick]").checked,false);
  map.fire("pointerdown",8,0);
  map.fire("pointermove",6.25,0);
  assert.strictEqual(app.detect.proposals[0],before,"drag only paints a candidate");
  map.fire("pointercancel",6.25,0);
  assert.strictEqual(app.detect.proposals[0],before);
  map.fire("pointerdown",8,0);
  map.fire("pointermove",6.25,0);
  map.fire("pointerup",6.25,0);
  const moved = app.detect.proposals[0];
  assert.equal(moved.loops[0].points[2],6.25);
  assert.ok(moved.pixels.length < before.pixels.length);
  assert.strictEqual(app.detect.proposals[1],other);
  assert.equal(app.history.length,1);
  ui.fire("click",ui.preview);
  assert.equal(selects,0,"editing never samples colour");
  ui.rows()[0].querySelector("[data-pick]").checked=true;
  app.undoAdd();
  assert.strictEqual(app.detect.proposals[0],before);
  assert.equal(ui.rows()[0].querySelector("[data-pick]").checked,true);
  map.rect.width=400; map.rect.height=400;
  map.fire("pointerdown",8,0); map.fire("pointermove",6.25,0); map.fire("pointerup",6.25,0);
  assert.deepEqual(app.detect.proposals[0].loops,moved.loops,"same read coordinate at another zoom");
  map.fire("dblclick",3,0);
  assert.equal(app.detect.proposals[0].vertices,5);
  map.fire("pointerdown",3,0); map.fire("pointerup",3,0);
  ui.fire("click",ui.button("delete-vertex",""));
  assert.equal(app.detect.proposals[0].vertices,4);
  assert.equal(app.history.length,3);
  const key = (key) => { let stopped=false; for (const fn of ui.listeners.keydown) fn({ key, target: {}, preventDefault() {}, stopPropagation() { stopped=true; } }); assert.ok(stopped); };
  map.fire("pointerdown",6.25,0); map.fire("pointermove",5,1);
  key("Escape");
  assert.deepEqual(app.detect.proposals[0].loops,moved.loops);
  assert.equal(app.mode.kind,"vertices"); key("Escape"); assert.equal(app.mode.kind,"inspect");
  await app.create();
  assert.deepEqual(scene.calls.map((c)=>c[0]),["update"]);
  const [patch] = scene.calls[0][2];
  assert.deepEqual(Object.keys(patch).sort(),["_id","shapes"]);
  assert.equal(patch._id,"edited");
  assert.ok(patch.shapes[0].points.includes(162.5));
});

test("trimmed pixel ownership feeds Add water and later additions preserve exact fractional shores", async (t) => {
  const map=outlineMap(t),ui=waterApp(map);
  const { waterProposalFromLoops } = await import("../../scripts/engines/regions/floor-trace.mjs");
  const original = { ...waterProposalFromLoops([{ points: [0,0,8,0,8,8,0,8],hole:false }],20,20),id:"water-1",preselected:false };
  let claimed;
  const { app } = await openWaterDetect(opening({ Application:ui.App,scene:fakeScene(),
    load:async()=>({ok:true,rgba:null,width:20,height:20}),detect:()=>({proposals:[original]}),
    select:(_rgba,_w,_h,_at,options)=>{ claimed=options.claimed; return { status:"none",reason:"too-small" }; },
  }));
  ui.fire("click",ui.button("edit-outline","water-1"));
  map.fire("pointerdown",8,0);map.fire("pointermove",5.25,0);map.fire("pointerup",5.25,0);
  const trimmed=app.detect.proposals[0];
  app.setAddTarget(null);app.suppressClick=false;ui.fire("click",ui.preview);
  assert.strictEqual(claimed[0],trimmed);
  assert.ok(!claimed[0].pixels.includes(7));
  app.setAddTarget("water-1");
  const addition=waterProposalFromLoops([{ points:[12,0,16,0,16,4,12,4],hole:false }],20,20);
  app.combineAreas([{...addition,id:"addition"}]);
  assert.ok(app.detect.proposals[0].loops[0].points.includes(5.25));
  assert.equal(app.detect.proposals[0].pixels.length,trimmed.pixels.length+16);
  assert.equal(ui.rows()[0].querySelector("[data-pick]").checked,false);
  app.undoAdd(); app.undoAdd();
  assert.strictEqual(app.detect.proposals[0],original);
  const editedSource={...waterProposalFromLoops([{points:[12.25,0,16,0,16,4,12.25,4],hole:false}],20,20),id:"addition",geometryChanged:true,outlineEdited:true};
  app.combineAreas([editedSource]);
  assert.ok(app.detect.proposals[0].loops.some((loop)=>loop.points.includes(12.25)),"absorbing an edited source also preserves its exact outline");
  await app.close();
});

test("invalid drags and triangle deletion keep the proposal and history untouched with feedback", async (t) => {
  const map=outlineMap(t),ui=waterApp(map),notes=[];
  const { waterProposalFromLoops }=await import("../../scripts/engines/regions/floor-trace.mjs");
  const initial={...waterProposalFromLoops([{points:[0,0,12,0,12,12,0,12],hole:false},{points:[3,3,5,3,4,5],hole:true}],20,20),id:"water-1"};
  const {app}=await openWaterDetect(opening({Application:ui.App,scene:fakeScene(),notify:(message)=>notes.push(message),
    load:async()=>({ok:true,rgba:null,width:20,height:20}),detect:()=>({proposals:[initial]})}));
  ui.fire("click",ui.button("edit-outline","water-1"));
  map.fire("pointerdown",12,0);map.fire("pointermove",0,14);map.fire("pointerup",0,14);
  assert.strictEqual(app.detect.proposals[0],initial);
  assert.ok(notes.length);
  map.fire("pointerdown",4,5);map.fire("pointermove",4,15);map.fire("pointerup",4,15);
  assert.strictEqual(app.detect.proposals[0],initial);
  assert.match(notes.at(-1),/cross|touch|inside/);
  map.fire("pointerdown",3,3);map.fire("pointerup",3,3);
  ui.fire("click",ui.button("delete-vertex",""));
  assert.strictEqual(app.detect.proposals[0],initial);
  assert.match(notes.at(-1),/three/);
  assert.equal(app.history?.length??0,0);
  await app.close();
});

test("Smooth shore is explicit, preserves hole coordinates, and undo restores the original outline", async (t) => {
  const map=outlineMap(t),ui=waterApp(map);
  const {waterProposalFromLoops}=await import("../../scripts/engines/regions/floor-trace.mjs");
  const points=[0,0,20,0,20,20];
  for(let i=19;i>0;i--) points.push(i+1,i,i,i);
  const hole={points:[14,3,16,3,16,5,14,5],hole:true};
  const initial={...waterProposalFromLoops([{points,hole:false},hole],20,20),id:"water-1",preselected:false};
  const {app}=await openWaterDetect(opening({Application:ui.App,scene:fakeScene(),
    load:async()=>({ok:true,rgba:null,width:20,height:20}),detect:()=>({proposals:[initial]})}));
  ui.fire("click",ui.button("edit-outline","water-1"));
  assert.strictEqual(app.detect.proposals[0],initial);
  ui.fire("click",ui.button("smooth-outline",""));
  assert.ok(app.detect.proposals[0].vertices<initial.vertices);
  assert.strictEqual(app.detect.proposals[0].loops[1],hole);
  assert.equal(ui.rows()[0].querySelector("[data-pick]").checked,false);
  ui.fire("click",ui.button("undo-add",""));
  assert.strictEqual(app.detect.proposals[0],initial);
  await app.close();
});

async function savedOpen(t, {sw,sh,ring,notes}) {
  const map=outlineMap(t), ui=waterApp(map);
  const { fitSize } = await import("../../scripts/engines/regions/floor-trace.mjs");
  const f=fitSize(sw,sh), rect={x:100,y:200,width:sw,height:sh};
  const region={id:"edited",name:"Ocean",levels:["level-1"],flags:{animater:{generated:"water-detect",waterKind:"sea",floor:"water"}},behaviors:[{name:"keep"}],shapes:[{type:"polygon",hole:false,points:ring(rect)}]};
  const scene=fakeScene([region]);
  const {app}=await openWaterDetect(opening({Application:ui.App,scene,sceneRect:rect,notify:(m)=>notes.push(m),load:async()=>({ok:true,rgba:null,width:f.width,height:f.height}),detect:()=>({proposals:[]})}));
  map.rect.width=f.width; map.rect.height=f.height;
  return {map,ui,app,scene,f};
}
test("saved ocean reaching the bottom edge can be dragged", async (t)=>{
  const notes=[];
  const {map,ui,app,scene,f}=await savedOpen(t,{sw:1300,sh:2000,notes,ring:(r)=>[r.x,r.y,r.x+r.width,r.y,r.x+r.width,r.y+r.height,r.x,r.y+r.height]});
  const before=app.detect.proposals[0];
  ui.fire("click",ui.button("edit-outline","water-1"));
  assert.equal(Math.max(...before.loops[0].points.filter((_,i)=>i%2===0)),f.width);
  map.fire("pointerdown",0,0);map.fire("pointermove",1,1);map.fire("pointerup",1,1);
  assert.notStrictEqual(app.detect.proposals[0],before,"dragging the in-map top-left handle should change the proposal");
});
test("Delete pressed during a drag is not undone by pointerup", async (t)=>{
  const notes=[],map=outlineMap(t),ui=waterApp(map);
  const {waterProposalFromLoops}=await import("../../scripts/engines/regions/floor-trace.mjs");
  const initial={...waterProposalFromLoops([{points:[0,0,12,0,12,12,0,12,0,6],hole:false}],20,20),id:"water-1",preselected:false};
  const {app}=await openWaterDetect(opening({Application:ui.App,scene:fakeScene(),notify:(m)=>notes.push(m),load:async()=>({ok:true,rgba:null,width:20,height:20}),detect:()=>({proposals:[initial]})}));
  ui.fire("click",ui.button("edit-outline","water-1"));
  map.fire("pointerdown",12,0);map.fire("pointermove",10,1);
  for(const fn of ui.listeners.keydown) fn({key:"Delete",target:{},preventDefault(){},stopPropagation(){}});
  const afterDelete=app.detect.proposals[0].vertices;
  map.fire("pointerup",10,1);
  assert.equal(app.detect.proposals[0].vertices,afterDelete,"deletion should survive the end of the gesture");
});
test("zero-pixel edit is refused and not written to the saved region", async (t)=>{
  const notes=[],map=outlineMap(t),ui=waterApp(map);
  const scene=fakeScene([savedRegion("edited")]);
  const {app}=await openWaterDetect(opening({Application:ui.App,scene,sceneRect:editRect,notify:(m)=>notes.push(m),load:async()=>({ok:true,rgba:null,width:20,height:20}),detect:()=>({proposals:[]})}));
  const before=app.detect.proposals[0];
  ui.fire("click",ui.button("edit-outline","water-1"));
  assert.equal(app.commitOutline([{points:[0.1,0.1,0.4,0.1,0.4,0.4,0.1,0.4],hole:false}]),false);
  assert.strictEqual(app.detect.proposals[0],before);
  assert.equal(app.history?.length??0,0);
  assert.match(notes.at(-1),/some of the floor/);
  ui.rows()[0].querySelector("[data-pick]").checked=true;
  await app.create();
  assert.deepEqual(scene.calls,[]);
  await app.close();
});

test("keyboard Undo mid-drag does not get overwritten", async (t)=>{
  const map=outlineMap(t),ui=waterApp(map);
  const {waterProposalFromLoops:WP}=await import("../../scripts/engines/regions/floor-trace.mjs");
  const a={...WP([{points:[0,0,6,0,6,6,0,6],hole:false}],20,20),id:"water-1",preselected:false};
  const {app}=await openWaterDetect(opening({Application:ui.App,scene:fakeScene(),load:async()=>({ok:true,rgba:null,width:20,height:20}),detect:()=>({proposals:[a]})}));
  ui.fire("click",ui.button("edit-outline","water-1"));
  map.fire("pointerdown",6,0);map.fire("pointermove",5,0);map.fire("pointerup",5,0);
  map.fire("pointerdown",5,0);map.fire("pointermove",4,0);
  ui.fire("click",ui.button("undo-add",""));
  assert.equal(app.detect.proposals[0],a);
  map.fire("pointerup",4,0);
  assert.equal(app.detect.proposals[0],a);
});

test("second Add water with a diagonal touch", async () => {
  const ui=waterApp(), notes=[];
  const {mergeWaterProposals:M}=await import("../../scripts/engines/regions/floor-trace.mjs");
  const W=20,H=20,mk=(id,x,y,w,h)=>{const a=[];for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)a.push(j*W+i);return {id,pixels:new Int32Array(a),preselected:true};};
  const target={...M([mk("water-1",0,0,4,4)],W,H),id:"water-1",preselected:false};
  const adds=[{...M([mk("a",10,0,4,4)],W,H),id:"water-8"},{...M([mk("b",4,4,4,4)],W,H),id:"water-9"}];
  let n=0;
  const {app}=await openWaterDetect(opening({Application:ui.App,scene:fakeScene(),notify:(m)=>notes.push(m),
    load:async()=>({ok:true,rgba:new Uint8Array(W*H*4),width:W,height:H}),detect:()=>({proposals:[target]}),
    select:()=>({status:"found",proposal:adds[n++]})}));
  ui.fire("click",ui.button("add-to","water-1"));
  ui.fire("click",ui.preview);
  ui.fire("click",ui.preview);
  const p=app.detect.proposals[0];
  assert.ok(p.pixels.length>=47,"both additions are kept");
  await app.close();
});

test("a manual shore edit supersedes the outline cut it replaces during later Add", async () => {
  const { waterProposalFromLoops } = await import("../../scripts/engines/regions/floor-trace.mjs");
  const ui = waterApp();
  const initial = { ...waterProposalFromLoops([{ points: [0, 0, 10, 0, 10, 10, 0, 10], hole: false }], 20, 20), id: "water-1" };
  const { app } = await openWaterDetect(opening({ Application: ui.App, scene: fakeScene(), load: async () => ({ ok: true, rgba: null, width: 20, height: 20 }), detect: () => ({ proposals: [initial] }) }));
  app.setMode({ kind: "vertices", areaId: "water-1" });
  const notched = [{ points: [0, 0, 10, 0, 10, 4, 8, 4, 8, 6, 10, 6, 10, 10, 0, 10], hole: false }];
  assert.equal(app.commitOutline(notched), true);
  assert.equal(app.detect.proposals[0].pixels.includes(4 * 20 + 8), false);
  const pulled = app.detect.proposals[0].loops.map((loop) => ({ ...loop, points: loop.points.map((value, index) => index % 2 === 0 && value === 8 ? 9 : value) }));
  assert.equal(app.commitOutline(pulled), true);
  assert.equal(app.detect.proposals[0].pixels.includes(4 * 20 + 8), true);
  app.setAddTarget("water-1");
  app.combineAreas([{ ...waterProposalFromLoops([{ points: [12, 0, 15, 0, 15, 3, 12, 3], hole: false }], 20, 20), id: "addition" }]);
  assert.equal(app.detect.proposals[0].pixels.includes(4 * 20 + 8), true);
  await app.close();
});


test("floor row hides water fields when set to stone", () => {
  const stone = waterRowHTML(pieces({ floor: "stone" }), { floor: "stone" });
  assert.match(stone, /data-floor="water-1"/);
  assert.match(stone, /option value="stone" selected/);
  assert.match(stone, /data-water-fields hidden/);
  const water = waterRowHTML(pieces({ floor: "water" }), { floor: "water" });
  assert.match(water, /<label data-water-fields>Kind/);
  assert.doesNotMatch(water, /data-water-fields hidden>Kind/);
});

test("Floor to add appears in the window and defaults to water", () => {
  const html = waterWindowHTML({ proposals: [], width: 10, height: 5, reason: "no-candidates" });
  assert.match(html, /Click the map to add/);
  assert.match(html, /data-floor-to-add[^>]*>[\s\S]*value="water" selected/);
});

test("the window leads with a floor chooser above the map, with a swatch in the chosen floor's colour", () => {
  const html = waterWindowHTML({ proposals: [], width: 10, height: 5, reason: "no-candidates", shared: { floorToAdd: "stone" } });
  assert.ok(html.indexOf("data-floor-to-add") < html.indexOf("<h3>Map preview"), "chooser comes before the map");
  assert.match(html, /data-floor-swatch style="background:#6b6e73"/);
  assert.match(html, /Water is also found automatically/);
  assert.match(noneMessage("no-candidates"), /Pick a floor above and click it on the map/);
});

test("the preview paints each area in its own floor's colour, and water keeps its blue tints", () => {
  const fills = [];
  const ctx = {
    putImageData() {}, clearRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, stroke() {},
    fill() { fills.push(this.fillStyle); },
  };
  const stone = { id: "water-1", loops: [{ points: [0, 0, 10, 0, 10, 5], hole: false }] };
  const pond = { id: "water-2", loops: [{ points: [0, 0, 10, 0, 10, 5], hole: false }] };
  paintWaterPreview(ctx, null, 10, 5, [stone, pond], "", new Map([["water-1", "stone"], ["water-2", "water"]]));
  assert.equal(fills[0], "rgba(107, 110, 115, 0.6)");
  assert.equal(fills[1], floorTint("water", 1));
  assert.match(floorTint("water"), /^rgba\(44, 160, 190/);
});

test("the control and its switches say floors, not only water", () => {
  const main = readFileSync(new URL("../../scripts/main.mjs", import.meta.url), "utf8");
  assert.match(main, /title: "Detect floors \(Experimental\)[^"]*click any floor to add it"/);
  assert.match(main, /Show the Detect floors button/);
});

test("switching a saved dock to water leaves it a water region the panel opens with water controls", () => {
  const dock = savedRegion("dock");
  dock.flags.animater = { generated: "floor-detect", floor: "wood", overWater: true };
  const regions = [dock];
  const proposals = savedWaterProposals(regions, { levelId: "level-1", sceneRect: editRect, width: 20, height: 20 });
  const picked = proposals.map((p) => ({ id: p.id, checked: true, ...p.savedChoices, floor: "water" }));
  const plan = planWaterCreate({ proposals, picked, regions, levelId: "level-1", sceneRect: editRect, imageWidth: 20, imageHeight: 20 });
  const flags = { ...dock.flags.animater };
  for (const [path, value] of Object.entries(plan.updates[0])) if (path.startsWith("flags.animater.")) flags[path.slice("flags.animater.".length)] = value;
  assert.equal(regionKindOf(flags, flags.floor), "water");
});
