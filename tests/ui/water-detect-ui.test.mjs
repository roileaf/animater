import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { WATER_KINDS, waterKindOf, waterFlows } from "../../scripts/engines/motion/region-steps.mjs";
import {
  FLOW_OPTIONS, CURRENT_OPTIONS, noneMessage, failureMessage, clickMessage, loadMapRgba, waterWindowHTML, waterRowHTML,
  readWaterChoices, planWaterCreate, commitWaterPlan, openWaterDetect, previewPixel, levelMapIsPlain,
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
  assert.deepEqual(plan.deleteIds, ["old"]);
  assert.equal(plan.needsConfirm, true);
  assert.deepEqual(plan.creates.map((region) => region.name), ["Water 1", "Water 2"]);
  const river = plan.creates[0];
  assert.equal(river.color, "#2c7da0");
  assert.deepEqual(river.levels, ["level-1"]);
  assert.equal(river.flags.animater.floor, "water");
  assert.equal(river.flags.animater.generated, "water-detect");
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
  assert.equal(quiet.needsConfirm, false);
  assert.deepEqual(quiet.deleteIds, []);
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
    deleteEmbeddedDocuments: async (type, ids) => { calls.push(["delete", type, ids]); },
  };
}

test("creating replaces generated regions only after the GM agrees, and a cancel changes nothing", async () => {
  const plan = { creates: [{ name: "Water" }], deleteIds: ["old"], needsConfirm: true };
  const scene = fakeScene();
  const cancelled = await commitWaterPlan(plan, { scene, confirm: async () => false });
  assert.equal(cancelled.cancelled, true);
  assert.deepEqual(scene.calls, []);
  const titles = [];
  const done = await commitWaterPlan(plan, { scene, confirm: async (options) => { titles.push(options.window.title); return true; } });
  assert.deepEqual(titles, ["Experimental: detect water regions"]);
  assert.deepEqual(scene.calls, [["create", "Region", 1], ["delete", "Region", ["old"]]]);
  assert.equal(done.deleted, 1);
  assert.equal(done.created, 1);
  let asked = false;
  const quiet = fakeScene();
  const fresh = await commitWaterPlan({ creates: [{ name: "Water" }], deleteIds: [], needsConfirm: false }, { scene: quiet, confirm: async () => { asked = true; return false; } });
  assert.equal(asked, false);
  assert.equal(fresh.created, 1);
  assert.deepEqual(quiet.calls, [["create", "Region", 1]]);
});

test("the confirm dialog says the flow and current on the replaced regions are reset", async () => {
  const seen = [];
  const confirm = async (options) => { seen.push(options.content); return false; };
  await commitWaterPlan({ creates: [{}], deleteIds: ["a"], needsConfirm: true }, { scene: fakeScene(), confirm });
  await commitWaterPlan({ creates: [{}], deleteIds: ["a", "b"], needsConfirm: true }, { scene: fakeScene(), confirm });
  assert.match(seen[0], /Every change you made to that region since it was generated is lost/);
  assert.match(seen[1], /Every change you made to those regions since they were generated is lost/);
  assert.match(seen[0], /water kind, flow, steps, beach, behaviors, and edited shapes/);
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
  assert.deepEqual(outcome, { created: 0, deleted: 0 });
  assert.deepEqual(scene.calls, []);
  assert.match(notes[0], /Tick a piece of water first/);
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

function waterApp() {
  const listeners = {};
  const makeRow = (id, checked, kind = "still", flowTo = "", currentTo = "") => {
    const box = { checked, dataset: { pick: id } }, kindSel = { value: kind }, flow = { value: flowTo }, current = { value: currentTo };
    const wave = { value: "" }, beach = { checked: true };
    const flowField = { hidden: kind === "still" || kind === "sea" }, currentField = { hidden: kind !== "river" };
    const seaFields = [{ hidden: kind !== "sea" }, { hidden: kind !== "sea" }];
    const row = {
      dataset: { id, kind },
      classList: { toggle() {}, remove() {} },
      querySelector: (selector) => ({ "[data-pick]": box, "[data-kind]": kindSel, "[data-flow]": flow, "[data-current]": current, "[data-wave]": wave, "[data-beach]": beach, "[data-flow-field]": flowField, "[data-current-field]": currentField })[selector],
      querySelectorAll: (selector) => selector === "[data-sea-field]" ? seaFields : [],
      remove: () => { rows.splice(rows.indexOf(row), 1); },
      closest: (selector) => (selector === "[data-id]" ? row : null),
    };
    for (const [name, select] of [["kind", kindSel], ["flow", flow], ["current", current]]) {
      select.getAttribute = () => id;
      select.closest = (selector) => selector === `select[data-${name}]` ? select : selector === "[data-id]" ? row : null;
    }
    return row;
  };
  const parseRows = (html) => html.split('<div class="an-water-row"').slice(1).map((part) => {
    const [, id, checked] = part.match(/data-id="([^"]+)">\s*<label class="an-water-pick"><input type="checkbox" data-pick="[^"]+"( checked)?/);
    const chosen = (attribute) => {
      const options = part.match(new RegExp(`<select ${attribute}="[^"]*">([\\s\\S]*?)</select>`))?.[1] ?? "";
      return options.match(/<option value="([^"]*)" selected>/)?.[1] ?? options.match(/<option value="([^"]*)"/)?.[1] ?? "";
    };
    const parsed = makeRow(id, Boolean(checked), chosen("data-kind") || "still", chosen("data-flow"), chosen("data-current"));
    parsed.querySelector("[data-wave]").value = chosen("data-wave");
    parsed.querySelector("[data-beach]").checked = /data-beach="[^"]*" checked/.test(part);
    return parsed;
  });
  let rows = [];
  let hasReason = false;
  const shared = { kind: { value: "still" }, flow: { value: "s" }, current: { value: "" }, range: { value: "narrow" } };
  const list = { scrollTop: 0, insertAdjacentHTML: (_where, html) => { rows.unshift(...parseRows(html)); } };
  const query = (selector) => {
    if (selector === ".an-water-list") return list;
    if (selector === ".an-water-reason") return hasReason ? { remove: () => { hasReason = false; } } : null;
    if (selector === "[data-all-kind]") return shared.kind;
    if (selector === "[data-all-flow]") return shared.flow;
    if (selector === "[data-all-current]") return shared.current;
    if (selector === "[data-click-range]") return shared.range;
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
  const button = (attr, value) => ({ dataset: { [attr]: value }, closest: (selector) => (selector === `[data-${attr}]` ? { dataset: { [attr]: value } } : null) });
  const preview = {
    closest: (selector) => (selector === "canvas.an-water-preview" ? preview : null),
    getBoundingClientRect: () => ({ left: 10, top: 10, width: 40, height: 20 }),
  };
  const setShared = (flow, current, kind = "river", range = "narrow") => { shared.kind.value = kind; shared.flow.value = flow; shared.current.value = current; shared.range.value = range; };
  return { App, fire, button, preview, rows: () => rows, hasReason: () => hasReason, listeners, setShared };
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
  assert.match(html, /Click water on the map/);
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
  assert.match(await app._renderHTML(), /Wide can join touching grass/);
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
  assert.deepEqual(opened.calls, [["create", "Region", 1], ["delete", "Region", ["made-since"]]]);
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

test("the setting is registered off and the tool appears only while it is on", () => {
  const main = readFileSync(new URL("../../scripts/main.mjs", import.meta.url), "utf8");
  assert.match(main, /registerSetting\("experimentalWaterRegions", \{[\s\S]*?name: "Experimental: detect water regions"[\s\S]*?default: false/);
  assert.match(main, /experimentalWaterRegions"\) !== true/);
  assert.match(main, /name: "animaterDetectWater"/);
  assert.match(main, /c\.name === "regions"/);
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
  const stalled = await loadMapRgba("stalled.png", { width: 8, height: 8 }, {
    timeoutMs: 5,
    fetch: (_src, { signal }) => new Promise((_resolve, reject) => { signal.addEventListener("abort", () => reject(signal.reason)); }),
  });
  assert.deepEqual(stalled, { ok: false, reason: "timeout" });
  assert.match(failureMessage("timeout"), /too long/);
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
