import { mergeAreaProposals } from "../../scripts/engines/regions/floor-detect.mjs";
import { areaSignature } from "../../scripts/engines/regions/floor-memory.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { WATER_KINDS, waterKindOf, waterFlows } from "../../scripts/engines/motion/region-steps.mjs";
import {
  FLOW_OPTIONS, CURRENT_OPTIONS, noneMessage, failureMessage, clickMessage, loadMapRgba, floorWindowHTML, areaRowHTML,
  floorRegionsWindow, savedAreaProposals, readAreaChoices, planFloorCreate, commitFloorPlan, openFloorRegions, previewPixel, levelMapIsPlain, SMART_CONSENT, loadMapView, paintAreaPreview, VIEW_MAX, waterSummary, saveLabel, areaShade, rowMeta, areaListHTML, paintsTexture, worldAreas, sizeOf, AUTO_FLOOR, NO_FLOOR, learnSaved, floorMemoryStore, FLOOR_MEMORY_SETTING,
} from "../../scripts/ui/floor-regions-ui.mjs";

const sceneRect = { x: 1000, y: 2000, width: 5000, height: 2500 };
const square = {
  id: "area-1",
  share: 0.2,
  preselected: true,
  vertices: 3,
  loops: [{ points: [0, 0, 10, 0, 10, 5], hole: false }],
};
const speck = {
  id: "area-2",
  share: 0.001,
  preselected: false,
  vertices: 8,
  loops: [{ points: [1, 1, 2, 1, 2, 2], hole: false }],
};

function row(html, id) {
  const found = html.match(new RegExp(`<div class="an-floors-row" data-id="${id}"[^>]*>[\\s\\S]*?</div>`));
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
  const html = floorWindowHTML({ proposals: [speck, square], width: 10, height: 5 });
  assert.match(html, /Experimental\./);
  assert.ok(html.indexOf('data-id="area-1"') < html.indexOf('data-id="area-2"'));
  assert.match(row(html, "area-1"), /checked/);
  assert.doesNotMatch(row(html, "area-2"), /data-pick="area-2" checked/);
  assert.match(row(html, "area-1"), /20\.0%/);
  assert.match(row(html, "area-1"), /3 vertices/);
  assert.match(row(html, "area-2"), /0\.10%/);
  assert.match(html, /data-all-flow/);
  assert.match(html, /data-all-current/);
  assert.match(html, /North-east/);
  assert.match(html, /Swift/);
  assert.match(html, />Create 1 region</);
  assert.match(floorWindowHTML({ proposals: [{ ...square, regionId: "saved" }], width: 10, height: 5 }), />Save 1 updated</);
});

test("a row is one quiet line, and its settings and tools sit in its inspector", () => {
  const html = areaRowHTML({ ...square, floor: "water" }, { waterKind: "river", flowTo: "ne", current: "swift", shade: "#123456" });
  const line = html.slice(0, html.indexOf('<div class="an-inspector"'));
  assert.match(line, /<b class="an-area-num[^"]*" style="--swatch:#123456">1<\/b>/, "the map's number, in the map's shade");
  assert.match(line, /<strong>Water<\/strong><span data-row-meta><i class="an-dot"><\/i>New · Water · River<\/span>/);
  assert.doesNotMatch(line, /<select|<button/, "no controls on the line itself");
  const inspector = html.slice(html.indexOf('<div class="an-inspector"'));
  for (const control of ["data-floor", "data-kind", "data-flow", "data-current", "data-texture", "data-add-to", "data-edit-outline", "data-split", "data-tidy", "data-remove"]) assert.match(inspector, new RegExp(control));
  const saved = areaRowHTML({ ...square, regionId: "r1", name: "Grass 2", floor: "grass", preselected: true });
  assert.match(saved, /<strong>Grass 2<\/strong><span data-row-meta><i class="an-dot is-saved"><\/i>Saved · will update · Grass<\/span>/);
  assert.match(saved, /data-water-fields hidden/);
  assert.equal(rowMeta({ saved: false, checked: false, floor: "mud" }), "New · not saved · Mud");
});

test("the list puts saved regions first, each group under its heading, with per-floor shades", () => {
  const a = { ...square, id: "area-1", floor: "grass" }, b = { ...speck, id: "area-2", floor: "grass", regionId: "r2", name: "Grass 1" };
  const html = areaListHTML([a, b], () => ({}), (p) => p.floor);
  assert.ok(html.indexOf("On this scene") < html.indexOf('data-id="area-2"'));
  assert.ok(html.indexOf('data-id="area-2"') < html.indexOf(">New<"));
  assert.ok(html.indexOf(">New<") < html.indexOf('data-id="area-1"'));
  assert.match(html, /--swatch:#5f9f45">1</, "first grass area: the floor's own colour");
  assert.doesNotMatch(html, /--swatch:#5f9f45">2</, "the second grass area gets another shade");
  assert.doesNotMatch(areaListHTML([a], () => ({}), (p) => p.floor), /On this scene/);
});

test("water summary, save label and per-area shades", () => {
  assert.equal(waterSummary("still", "s", "", ""), "Still pool");
  assert.match(waterSummary("river", "s", "", ""), /^River · gentle · toward south$/);
  const saved = { id: "a", regionId: "r" }, fresh = { id: "b" };
  assert.equal(saveLabel([fresh], new Set(["b"])), "Create 1 region");
  assert.equal(saveLabel([saved, fresh], new Set(["a", "b"])), "Save 1 new · 1 updated");
  assert.equal(saveLabel([saved, fresh], new Set(["b"])), "Save 1 new");
  assert.equal(saveLabel([saved, fresh], new Set()), "Save 0 regions");
  assert.equal(areaShade("#4a8a30", 0), "#4a8a30");
  assert.notEqual(areaShade("#4a8a30", 1), areaShade("#4a8a30", 2));
  assert.match(areaShade("#4a8a30", 1), /^#[0-9a-f]{6}$/);
});

test("floor texture: each row and the footer choose it, new regions save it, saved ones update it only when changed", () => {
  const html = floorWindowHTML({ proposals: [square], width: 10, height: 5, sceneTexture: "on", shared: { texture: "off" } });
  assert.match(html, /<select data-all-texture="">[\s\S]*As the scene says \(paint\)[\s\S]*<option value="off" selected>/);
  assert.match(row(floorWindowHTML({ proposals: [square], width: 10, height: 5, shared: { texture: "off" } }), "area-1") + html, /data-texture="area-1"/);
  assert.match(html, /<select data-texture="area-1">[\s\S]*?<option value="off" selected>/, "a new area starts with the footer's choice");
  assert.match(areaRowHTML(square), /As the scene says \(don't paint\)/);
  const plan = (texture, saved) => planFloorCreate({
    proposals: [{ ...square, ...(saved ? { regionId: "r1", savedChoices: { floor: "grass", texture: saved } } : {}) }],
    picked: readAreaChoices([{ id: "area-1", checked: true, floor: "grass", texture }]),
    sceneRect, imageWidth: 10, imageHeight: 5, levelId: "level-1",
    regions: { contents: saved ? [{ id: "r1", levels: ["level-1"], flags: { animater: { generated: "floor-detect", floor: "grass" } } }] : [] },
  });
  assert.equal(plan("off").creates[0].flags.animater.texture, "off");
  assert.equal("texture" in plan("").creates[0].flags.animater, false, "as the scene says: no flag");
  assert.equal(plan("on", "off").updates[0]["flags.animater.texture"], "on");
  assert.equal(plan("", "off").updates[0]["flags.animater.texture"], "");
  assert.equal(plan("off", "off").updates.length, 0, "unchanged: nothing written");
});

test("pattern and soft edge: shown while the area paints, saved on new regions, updated only when changed", () => {
  assert.equal(paintsTexture("grass", "on", ""), true);
  assert.equal(paintsTexture("grass", "", "on"), true);
  assert.equal(paintsTexture("grass", "off", "on"), false);
  assert.equal(paintsTexture("lava", "on", "on"), false, "lava never paints");
  const shown = areaRowHTML({ ...square, floor: "grass" }, { texture: "on", pattern: "clover", edge: "0" });
  assert.match(shown, /data-texture-fields>/);
  assert.match(shown, /<select data-pattern="area-1">[\s\S]*?<option value="clover" selected>Clover/);
  assert.match(shown, /data-edge="area-1"[^>]*>|value="0"/);
  assert.match(shown, /<output data-edge-value>Hard<\/output>/);
  assert.match(areaRowHTML({ ...square, floor: "grass" }, { texture: "off" }), /data-texture-fields hidden/);
  const plan = (row, saved) => planFloorCreate({
    proposals: [{ ...square, ...(saved ? { regionId: "r1", savedChoices: { floor: "grass", ...saved } } : {}) }],
    picked: readAreaChoices([{ id: "area-1", checked: true, floor: "grass", ...row }]),
    sceneRect, imageWidth: 10, imageHeight: 5, levelId: "level-1",
    regions: { contents: saved ? [{ id: "r1", levels: ["level-1"], flags: { animater: { generated: "floor-detect", floor: "grass" } } }] : [] },
  });
  const made = plan({ pattern: "clover", edge: "0" }).creates[0].flags.animater;
  assert.deepEqual(made.textureStyles, { grass: "clover" });
  assert.equal(made.stepEdgeOff, true);
  assert.equal(plan({ edge: "2" }).creates[0].flags.animater.stepEdge, 2);
  const update = plan({ pattern: "clover", edge: "1.5" }, { pattern: "meadow", edge: "1" }).updates[0];
  assert.equal(update["flags.animater.textureStyles.grass"], "clover");
  assert.equal(update["flags.animater.stepEdge"], 1.5);
  assert.equal(plan({ pattern: "meadow", edge: "1" }, { pattern: "meadow", edge: "1" }).updates.length, 0, "unchanged: nothing written");
});

test("over water: a toggle for what can stand on water, saved on new regions, updated only when changed", () => {
  const wood = areaRowHTML({ ...square, floor: "wood" }, { overWater: true });
  assert.match(wood, /<label class="an-insp-check" data-over-water-field[^>]*><input type="checkbox" data-over-water="area-1" checked> Over water/);
  assert.match(wood, /Wood · over water/);
  assert.match(areaRowHTML({ ...square, floor: "water" }), /data-over-water-field[^>]*hidden/, "water itself cannot be over water");
  assert.match(areaRowHTML({ ...square, floor: "lava" }), /data-over-water-field[^>]*hidden/);
  assert.equal(readAreaChoices([{ id: "a", floor: "water", overWater: true }])[0].overWater, false);
  const plan = (row, saved) => planFloorCreate({
    proposals: [{ ...square, ...(saved ? { regionId: "r1", savedChoices: { floor: "wood", ...saved } } : {}) }],
    picked: readAreaChoices([{ id: "area-1", checked: true, floor: "wood", ...row }]),
    sceneRect, imageWidth: 10, imageHeight: 5, levelId: "level-1",
    regions: { contents: saved ? [{ id: "r1", levels: ["level-1"], flags: { animater: { generated: "floor-detect", floor: "wood" } } }] : [] },
  });
  assert.equal(plan({ overWater: true }).creates[0].flags.animater.overWater, true);
  assert.equal("overWater" in plan({}).creates[0].flags.animater, false);
  assert.equal(plan({ overWater: true }, { overWater: false }).updates[0]["flags.animater.overWater"], true);
  assert.equal(plan({ overWater: false }, { overWater: true }).updates[0]["flags.animater.overWater"], false);
  assert.equal(plan({ overWater: true }, { overWater: true }).updates.length, 0, "unchanged: nothing written");
});

test("step: the floor's steps to pick, saved as the step menu saves them, only when another was picked", () => {
  const html = areaRowHTML({ ...square, floor: "grass" }, { step: "2" });
  assert.match(html, /<select data-step="area-1" data-floor-of="grass">[\s\S]*?<option value="0">Fresh<\/option>[\s\S]*?<option value="2" selected>Bloodied/);
  assert.match(areaRowHTML({ ...square, floor: "lava" }), /<option value="2" selected>Molten/, "lava starts molten, as the menu does");
  const plan = (row, saved) => planFloorCreate({
    proposals: [{ ...square, ...(saved ? { regionId: "r1", savedChoices: { floor: "grass", ...saved } } : {}) }],
    picked: readAreaChoices([{ id: "area-1", checked: true, floor: "grass", ...row }]),
    sceneRect, imageWidth: 10, imageHeight: 5, levelId: "level-1",
    regions: { contents: saved ? [{ id: "r1", levels: ["level-1"], flags: { animater: { generated: "floor-detect", floor: "grass" } } }] : [] },
  });
  const made = plan({ step: "2" }).creates[0].flags.animater;
  assert.equal(made.step, 2);
  assert.equal(made.stepsFloor, "grass");
  assert.equal(made.steps[2].name, "Bloodied");
  assert.equal("steps" in plan({ step: "0" }).creates[0].flags.animater, false, "the usual step: nothing written");
  const update = plan({ step: "3" }, { step: "0" }).updates[0];
  assert.equal(update["flags.animater.step"], 3);
  assert.equal(update["flags.animater.stepsFloor"], "grass");
  assert.equal(plan({ step: "0" }, { step: "0" }).updates.length, 0, "unchanged: nothing written");
  const kept = { steps: [{ name: "Mine", look: "blood", walks: "grass", effect: "" }, { name: "Other", look: "none", walks: "grass", effect: "" }], stepsFloor: "grass", step: 1, stepsEdited: true };
  assert.match(areaRowHTML({ ...square, floor: "grass", regionId: "r1", name: "G", savedChoices: { floor: "grass", stepsOwn: kept, step: "1" } }), /<option value="0">Mine<\/option><option value="1" selected>Other/, "a saved region keeps its own list");
});

test("worldAreas: read-pixel loops become scene rings, each hole with the ring around it", () => {
  const rect = { x: 100, y: 200, width: 1000, height: 500 };
  const out = worldAreas([
    { hole: false, points: [0, 0, 10, 0, 10, 5, 0, 5] },
    { hole: true, points: [2, 1, 4, 1, 4, 3] },
    { hole: false, points: [20, 0, 30, 0, 30, 5] },
  ], rect, 100, 50);
  assert.equal(out.length, 2);
  assert.deepEqual(Array.from(out[0]), [100, 200, 200, 200, 200, 250, 100, 250]);
  assert.deepEqual(out[0].holes, [[120, 210, 140, 210, 140, 230]]);
  assert.deepEqual(out[1].holes, []);
});

test("painted areas are drawn by the scene's own floor renderer once it can, the tile preview standing in until then", async () => {
  const { App } = waterApp();
  const W = 60, H = 40, mask = new Uint8Array(W * H);
  for (let y = 0; y < 30; y++) for (let x = 0; x < 30; x++) mask[y * W + x] = 1;
  const pixels = []; for (let p = 0; p < mask.length; p++) if (mask[p]) pixels.push(p);
  const grass = { ...mergeAreaProposals([{ id: "area-1", pixels: Int32Array.from(pixels) }], W, H), id: "area-1", floor: "grass", preselected: true };
  const asks = [], image = { width: 120, height: 80 };
  let ready = false;
  const { app } = await openFloorRegions(opening({ Application: App, scene: { ...fakeScene(), flags: { animater: { floorTextures: "on" } } },
    load: async () => ({ ok: true, rgba: new Uint8Array(W * H * 4), width: W, height: H }), detect: () => ({ proposals: [grass] }),
    snapshot: (list, rect, width, height) => { asks.push({ list, rect, width, height }); return ready ? image : null; } }));
  assert.equal(app.paintedSnapshot(), null, "nothing yet: the tile preview stands in");
  await new Promise((done) => setTimeout(done, 150));
  assert.ok(asks.length >= 1, "asked once the areas settled");
  assert.equal(asks[0].list[0].floor, "water", "the row's floor (the test rows read as water)");
  assert.equal(asks[0].list[0].style, "deep", "the floor's usual pattern");
  assert.equal(asks[0].list[0].edge, 1, "the usual soft edge");
  assert.equal(asks[0].width, 120, "twice the read across");
  ready = true;
  await new Promise((done) => setTimeout(done, 300));
  const shown = app.paintedSnapshot();
  assert.equal(shown?.image, image, "a tile that was still being made: asked again, and then shown");
  assert.ok(shown.ids.has("area-1"));
  await app.close();
});

test("new region names carry on after the ones already on the scene", () => {
  const two = { ...speck, id: "area-2", preselected: true };
  const { creates } = planFloorCreate({
    proposals: [square, two], picked: readAreaChoices([{ id: "area-1", checked: true, floor: "grass" }, { id: "area-2", checked: true, floor: "grass" }]),
    sceneRect, imageWidth: 10, imageHeight: 5, levelId: "level-1", regions: { contents: [{ id: "a", name: "Grass 1" }, { id: "b", name: "Grass 3" }] },
  });
  assert.deepEqual(creates.map((c) => c.name), ["Grass 4", "Grass 5"]);
  const one = planFloorCreate({ proposals: [square], picked: readAreaChoices([{ id: "area-1", checked: true, floor: "grass" }]), sceneRect, imageWidth: 10, imageHeight: 5, levelId: "level-1", regions: { contents: [{ id: "a", name: "Grass" }] } });
  assert.equal(one.creates[0].name, "Grass 2");
  assert.equal(waterSummary("river", "wind", "", ""), "River · gentle · follows the wind");
});

test("the same proposals always draw the same form", () => {
  const once = floorWindowHTML({ proposals: [square, speck], width: 10, height: 5 });
  const twice = floorWindowHTML({ proposals: [speck, square], width: 10, height: 5 });
  assert.equal(once, twice);
});

test("create keeps the ticked pieces, maps them onto the scene, and leaves hand-drawn water alone", () => {
  const picked = readAreaChoices([
    { id: "area-2", checked: true, waterKind: "river", flowTo: "n", current: "" },
    { id: "area-1", checked: true, waterKind: "river", flowTo: "se", current: "swift" },
    { id: "area-9", checked: true, waterKind: "still", flowTo: "", current: "" },
  ]);
  const plan = planFloorCreate({
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
  const quiet = planFloorCreate({
    proposals: [square],
    picked: [{ id: "area-1", checked: true, waterKind: "still", flowTo: "", current: "" }],
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
  const done = await commitFloorPlan({ creates: [{ name: "Water" }], updates: [] }, { scene });
  assert.deepEqual(scene.calls, [["create", "Region", 1]]);
  assert.deepEqual(done, { created: 1, updated: 0 });
});

test("created water kinds follow the upstream engine contract", () => {
  for (const [kind] of WATER_KINDS) {
    const plan = planFloorCreate({ proposals: [square], picked: [{ id: square.id, checked: true, waterKind: kind, flowTo: "wind", current: "swift", waveTo: "ne", seaBeach: "off" }], sceneRect, imageWidth: 10, imageHeight: 5, levelId: "level-1", regions: [] });
    const own = plan.creates[0].flags.animater;
    assert.equal(waterKindOf(own), kind);
    assert.equal(own.flowTo, waterFlows(kind) ? "wind" : "");
    assert.equal(own.current, waterFlows(kind) ? "swift" : "");
    assert.equal(own.waveTo, kind === "sea" ? "ne" : undefined);
    assert.equal(own.seaBeach, kind === "sea" ? "off" : undefined);
    const gentle = planFloorCreate({ proposals: [square], picked: [{ id: square.id, checked: true, waterKind: kind }], sceneRect, imageWidth: 10, imageHeight: 5, levelId: "level-1", regions: [] }).creates[0].flags.animater;
    if (kind === "rapids" || kind === "falls") assert.equal(gentle.current, "swift", "fast kinds keep their canonical current");
  }
});

test("with nothing ticked, create says so and the regions the tool made stay", async () => {
  const scene = fakeScene([{ id: "old", flags: { animater: { generated: "water-detect" } } }]);
  const plan = planFloorCreate({
    proposals: [square],
    picked: [{ id: "area-1", checked: false, flowTo: "", current: "" }],
    sceneRect,
    imageWidth: 10,
    imageHeight: 5,
    regions: scene.regions,
  });
  const notes = [];
  const outcome = await commitFloorPlan(plan, { scene, confirm: async () => true, notify: (message) => notes.push(message) });
  assert.deepEqual(outcome, { created: 0, updated: 0 });
  assert.deepEqual(scene.calls, []);
  assert.match(notes[0], /Tick an edited or new area first/);
});

test("create surfaces the reopen-generator error instead of a generic warning", async () => {
  const ui = waterApp();
  const warned = [];
  const scene = fakeScene([savedRegion("ocean")]);
  const { app } = await openFloorRegions(opening({
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
  const parseRows = (html) => html.split('<div class="an-floors-row"').slice(1).map((part) => {
    const [, id, checked] = part.match(/data-id="([^"]+)"[^>]*>\s*<label class="an-floors-pick"[^>]*><input type="checkbox" data-pick="[^"]+"( checked)?/);
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
  const shared = { kind: { value: "still" }, flow: { value: "s" }, current: { value: "" }, range: { value: "narrow" }, selection: { value: "colour" }, smartStatus: { textContent: "" }, addFloor: { value: "water" }, combine: { disabled: true } };
  const list = { set innerHTML(html) { rows = parseRows(html); }, scrollTop: 0, insertAdjacentHTML: (_where, html) => { rows.unshift(...parseRows(html)); } };
  const status = Object.fromEntries(["data-area-count", "data-selection-count", "data-create", "data-area-empty", "data-add-status", "data-add-message", "data-undo-add"].map((key) => [key, {}]));
  const query = (selector) => {
    if (map && selector === ".an-floors-frame") return map.frame;
    if (map && selector === "canvas.an-floors-preview") return map.canvas;
    if (status[selector.slice(1, -1)]) return status[selector.slice(1, -1)];
    if (selector === ".an-floors-list") return list;
    if (selector === ".an-floors-reason") return hasReason ? { remove: () => { hasReason = false; } } : null;
    if (selector === "[data-all-kind]") return shared.kind;
    if (selector === "[data-all-flow]") return shared.flow;
    if (selector === "[data-all-current]") return shared.current;
    if (selector === "[data-click-range]") return shared.range;
    if (selector === "[data-select-mode]") return shared.selection;
    if (selector === "[data-smart-status]") return shared.smartStatus;
    if (selector === "[data-add-floor]") return shared.addFloor;
    if (selector === "[data-combine-ticked]") return shared.combine;
    return null;
  };
  const queryAll = (selector) => {
    if (selector === "[data-id]" || selector === ".an-floors-row") return [...rows];
    if (selector === "[data-pick]:checked") return rows.filter((row) => row.querySelector("[data-pick]").checked).map((row) => row.querySelector("[data-pick]"));
    if (["[data-kind]", "[data-flow]", "[data-current]"].includes(selector)) return rows.map((row) => row.querySelector(selector));
    return [];
  };
  const content = {
    set innerHTML(html) { rows = parseRows(html); hasReason = html.includes("an-floors-reason"); },
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
    closest: (selector) => (selector === "canvas.an-floors-preview" ? preview : null),
    getBoundingClientRect: () => ({ left: 10, top: 10, width: 40, height: 20 }),
  };
  const setShared = (flow, current, kind = "river", range = "narrow") => { shared.kind.value = kind; shared.flow.value = flow; shared.current.value = current; shared.range.value = range; };
  return { App, fire, button, preview, status, rows: () => rows, hasReason: () => hasReason, listeners, setShared, shared };
}

const pieces = (over = {}) => ({ id: "area-1", share: 0.3, preselected: true, vertices: 3, loops: [{ points: [0, 0, 10, 0, 10, 5], hole: false }], pixels: new Int32Array(), ...over });
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
  const opened = await openFloorRegions(opening({
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
  assert.match(html, /click the map to add one/);
  assert.deepEqual(opened.app.detect.proposals, []);
});

test("video, an unreadable image, and a moved level map warn and open nothing", async () => {
  let built = 0;
  class Counted { constructor() { built++; } async render() {} }
  const warned = [];
  const base = { Application: Counted, warn: (message) => warned.push(message), detect: () => { throw new Error("should not detect"); } };
  assert.equal((await openFloorRegions(opening({ ...base, load: async () => ({ ok: false, reason: "video" }) }))).opened, false);
  assert.match(warned.at(-1), /video/);
  assert.equal((await openFloorRegions(opening({ ...base, load: async () => ({ ok: false, reason: "tainted" }) }))).opened, false);
  assert.match(warned.at(-1), /could not be read/);
  const moved = await openFloorRegions(opening({ ...base, textures: { offsetX: 200 }, load: async () => { throw new Error("should not load"); } }));
  assert.equal(moved.opened, false);
  assert.equal(moved.reason, "transformed");
  assert.match(warned.at(-1), /moved, scaled or rotated/);
  assert.equal(built, 0);
});

test("a click adds a ticked row without a re-render, a bad click only notifies, and remove undoes it", async () => {
  const { App, fire, button, preview, rows, hasReason } = waterApp();
  const notes = [];
  const clicks = [];
  let answer = { status: "found", proposal: pieces({ id: "area-2", clicked: true }), seed: { hue: 200, saturation: 0.4 } };
  const { app } = await openFloorRegions(opening({
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
  assert.deepEqual(rows().map((row) => row.dataset.id), ["area-2"]);
  assert.equal(rows()[0].querySelector("[data-pick]").checked, true);
  assert.equal(hasReason(), false, "the reason no longer applies");
  answer = { status: "none", reason: "already-water" };
  fire("click", preview);
  assert.equal(clicks[1].claimed, 1);
  assert.match(notes.at(-1), /already in the list/);
  assert.equal(rows().length, 1);
  fire("click", button("remove", "area-2"));
  assert.deepEqual(rows(), []);
  assert.deepEqual(app.detect.proposals, []);
  app.undoAdd();
  assert.deepEqual(rows().map((row) => row.dataset.id), ["area-2"], "undo brings a removed area back");
  app.undoAdd();
  assert.deepEqual(rows(), [], "and undo again takes the new area away");
});

test("every change is an undo step: a setting, a tick, and Ctrl+Z works with a drop-down focused", async () => {
  const { App, fire, preview, rows, listeners } = waterApp();
  const { app } = await openFloorRegions(opening({
    scene: fakeScene(),
    detect: () => ({ status: "none", reason: "no-candidates" }),
    select: () => ({ status: "found", proposal: pieces({ id: "area-2", clicked: true }), seed: { hue: 200, saturation: 0.4 } }),
    Application: App,
  }));
  fire("click", preview);
  const kind = rows()[0].querySelector("[data-kind]");
  kind.value = "river";
  fire("change", kind);
  assert.equal(rows()[0].querySelector("[data-kind]").value, "river");
  let stopped = false;
  for (const fn of listeners.keydown) fn({ key: "z", ctrlKey: true, target: { closest: (sel) => (/select/.test(sel) && !/textarea/.test(sel) ? kind : null) }, preventDefault() {}, stopPropagation() { stopped = true; } });
  assert.ok(stopped, "Ctrl+Z with the drop-down still focused");
  assert.equal(rows()[0].querySelector("[data-kind]").value, "still", "the kind goes back");
  const box = rows()[0].querySelector("[data-pick]");
  const row = rows()[0];
  box.closest = (sel) => (sel === "[data-id]" ? row : sel === "[data-pick]" ? box : null);
  box.checked = false;
  fire("change", box);
  app.undoAdd();
  assert.equal(rows()[0].querySelector("[data-pick]").checked, true, "a tick goes back");
  await app.close();
});

test("a clicked row takes the flow and current the shared selects show", async () => {
  const { App, fire, preview, rows, setShared } = waterApp();
  const { app } = await openFloorRegions(opening({
    scene: fakeScene(),
    detect: () => ({ status: "none", reason: "no-candidates" }),
    select: () => ({ status: "found", proposal: pieces({ id: "area-2", clicked: true }), seed: { hue: 200, saturation: 0.4 } }),
    Application: App,
  }));
  setShared("s", "swift");
  fire("click", preview);
  assert.equal(rows()[0].querySelector("[data-flow]").value, "s");
  assert.equal(rows()[0].querySelector("[data-current]").value, "swift");
  const plan = planFloorCreate({ proposals: app.detect.proposals, picked: [{ id: "area-2", checked: true, waterKind: "river", flowTo: rows()[0].querySelector("[data-flow]").value, current: rows()[0].querySelector("[data-current]").value }], sceneRect, imageWidth: 10, imageHeight: 1, levelId: "level-1", regions: [] });
  assert.equal(plan.creates[0].flags.animater.waterKind, "river");
  assert.equal(plan.creates[0].flags.animater.flowTo, "s");
  assert.equal(plan.creates[0].flags.animater.current, "swift");
});

test("wide click selection is explicit and defaults to narrow", async () => {
  const { App, fire, preview, setShared } = waterApp();
  const broad = [];
  const { app } = await openFloorRegions(opening({ Application: App, select: (_rgba, _w, _h, _at, options) => { broad.push(options.broad); return { status: "none", reason: "too-small" }; } }));
  fire("click", preview);
  setShared("s", "", "still", "wide");
  fire("click", preview);
  assert.deepEqual(broad, [false, true]);
  assert.match(await app._renderHTML(), /Wide can join touching grass/);
});

test("shared kinds change checked rows and preserve an unchecked row", async () => {
  const { App, fire, rows, setShared } = waterApp();
  const { app } = await openFloorRegions(opening({ Application: App, detect: () => ({ status: "found", proposals: [square, speck] }) }));
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
  const shared = areaRowHTML(pieces({ id: "area-3" }), { waterKind: "river", flowTo: "ne", current: "swift" });
  assert.match(shared, /<option value="ne" selected>/);
  assert.match(shared, /<option value="swift" selected>/);
  assert.match(areaRowHTML(pieces({ id: "area-3" })), /<option value="still" selected>/);
});

test("a clicked piece above a quarter of the map carries a warning, and only a clicked one", () => {
  assert.match(areaRowHTML(pieces({ clicked: true, share: 0.39 })), /39\.0% of the map\. Is this all/);
  assert.doesNotMatch(areaRowHTML(pieces({ clicked: true, share: 0.2 })), /Is this all/);
  assert.doesNotMatch(areaRowHTML(pieces({ share: 0.73 })), /Is this all/);
  assert.match(areaRowHTML(pieces()), /data-remove="area-1"/);
  assert.match(areaRowHTML(pieces()), /data-add-to="area-1"[^>]*>.*Add to/);
  assert.match(areaRowHTML(pieces()), /data-edit-outline="area-1"/);
  assert.doesNotMatch(areaRowHTML(pieces()), /Remove water/);
});

test("a second render keeps the controls and the GM's choices", async () => {
  const { App, fire, button, rows, listeners } = waterApp();
  const scene = fakeScene();
  const { app } = await openFloorRegions(opening({
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
  await openFloorRegions(opening({
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
  const [first, second] = await Promise.all([openFloorRegions(args), openFloorRegions(args)]);
  assert.equal(loads, 1, "one read");
  assert.equal(first.app, second.app, "one window");
  const before = App.closed;
  const third = await openFloorRegions(args);
  assert.equal(App.closed, before + 1);
  assert.notEqual(third.app, first.app);
});

test("a second click on the tool replaces the open window", async () => {
  const { App } = waterApp();
  const args = opening({ scene: fakeScene(), detect: () => ({ status: "none", reason: "no-candidates" }), Application: App });
  await openFloorRegions(args);
  const before = App.closed;
  await openFloorRegions(args);
  assert.equal(App.closed, before + 1);
});

test("the setting is registered off and Floor regions is wired into the Animater controls", () => {
  const main = readFileSync(new URL("../../scripts/main.mjs", import.meta.url), "utf8");
  assert.match(main, /registerSetting\("experimentalWaterRegions", \{[\s\S]*?name: "Experimental: floor regions from the map"[\s\S]*?default: false/);
  assert.match(main, /hint: "Adds a Floor regions button in the Animater controls/);
  assert.match(main, /\['toolDetectWater','Show the Floor regions button'/);
  assert.match(main, /name: "animaterFloorRegions"/);
  assert.match(main, /toolShown\("toolDetectWater"\) && game\.settings\.get\(ID, "experimentalWaterRegions"\) === true/);
  assert.doesNotMatch(main, /c\.name === "regions"/);
  assert.match(main, /import\("\.\/ui\/floor-regions-ui\.mjs"\)/);
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
  const opening = openFloorRegions(openOptions("a", first.load));
  const moved = openFloorRegions(openOptions("b", second.load));
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
  const opening = openFloorRegions(openOptions("a", held.load));
  const joined = openFloorRegions(openOptions("a", () => assert.fail("a second load started"), { notify: (m) => notes.push(m) }));
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
  const prior = await openFloorRegions(openOptions("held", load, { Application: SlowApp }));
  const first = openFloorRegions(openOptions("superseded", load, { Application: SlowApp }));
  await didEnter;
  const last = openFloorRegions(openOptions("latest", load, { Application: SlowApp }));
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
  const { app } = await openFloorRegions(opening({ scene: fakeScene(), Application: ui.App,
    detect: () => ({ status: "found", proposals: [pieces(), pieces({ id: "area-2", preselected: false })], width: 10, height: 1 }),
    select: () => ({ status: "found", proposal: pieces({ id: "area-3", clicked: true }) }),
    notify: (message) => notes.push(message),
  }));
  assert.equal(ui.status["data-area-count"].textContent, "2 found · 1 selected");
  assert.equal(ui.status["data-create"].textContent, "Create 1 region");
  const box = ui.rows()[0].querySelector("[data-pick]");
  box.checked = false;
  ui.fire("change", { closest: () => null });
  assert.equal(ui.status["data-create"].disabled, true);
  ui.fire("click", ui.preview);
  assert.equal(ui.status["data-area-count"].textContent, "3 found · 1 selected");
  app.removeRow("area-2");
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
  const Window = floorRegionsWindow(class {});
  const app = new Window();
  app.detect = { width: 1000, height: 1000 };
  app.element = { querySelector: (selector) => ({ ".an-floors-frame": frame, "canvas.an-floors-preview": canvas, "[data-zoom-label]": label })[selector] };
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
  const Window = floorRegionsWindow(class {}, { select: () => { clicks++; return { status: "none", reason: "no-colour" }; } });
  const app = new Window();
  app.detect = { rgba: new Uint8Array(400), width: 10, height: 10, proposals: [] };
  app.element = { querySelector: (selector) => selector === ".an-floors-frame" ? frame : null,
    addEventListener: (name, fn) => { rootEvents[name] = fn; } };
  app._onRender();
  frameEvents.pointerdown({ button: 0, clientX: 50, clientY: 50 });
  frameEvents.pointermove({ clientX: 80, clientY: 70, pointerId: 1, preventDefault() {} });
  frameEvents.pointerup();
  assert.equal(frame.scrollLeft, 120);
  assert.equal(frame.scrollTop, 80);
  const preview = { closest: (selector) => selector === "canvas.an-floors-preview" ? preview : null,
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
  const proposals = [pieces({ id: "area-1", pixels: new Int32Array([0, 1, 10, 11]) }), pieces({ id: "area-2", pixels: new Int32Array([8, 9, 18, 19]) }), pieces({ id: "area-3", preselected: false, pixels: new Int32Array([50, 51, 60, 61]) })];
  const scene = fakeScene();
  let created;
  scene.createEmbeddedDocuments = async (_type, data) => { created = data; };
  const { app } = await openFloorRegions(opening({ scene, Application: ui.App,
    load: async () => ({ ok: true, rgba: new Uint8Array(400), width: 10, height: 10 }),
    detect: () => ({ status: "found", proposals }),
  }));
  const ocean = ui.rows()[0];
  ocean.querySelector("[data-kind]").value = "sea";
  ocean.querySelector("[data-wave]").value = "ne";
  ocean.querySelector("[data-beach]").checked = false;
  ui.fire("click", ui.button("add-to", "area-1"));
  app.clickPreview({ target: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }) }, clientX: 85, clientY: 5 });
  assert.deepEqual(app.detect.proposals.map((p) => p.id), ["area-1", "area-3"]);
  const merged = ui.rows().find((row) => row.dataset.id === "area-1");
  assert.equal(merged.querySelector("[data-kind]").value, "sea");
  assert.equal(merged.querySelector("[data-wave]").value, "ne");
  assert.equal(merged.querySelector("[data-beach]").checked, false);
  assert.equal(merged.querySelector("[data-pick]").checked, true);
  assert.deepEqual([...app.detect.proposals[0].pixels].sort((a,b)=>a-b), [0, 1, 8, 9, 10, 11, 18, 19]);
  assert.equal(ui.status["data-area-count"].textContent, "2 found · 1 selected");
  app.undoAdd();
  assert.deepEqual(app.detect.proposals.map((p) => p.id), ["area-1", "area-2", "area-3"]);
  assert.equal(ui.status["data-area-count"].textContent, "3 found · 2 selected");
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
  const { app } = await openFloorRegions(opening({ scene: fakeScene(), Application: ui.App,
    load: async () => ({ ok: true, rgba: new Uint8Array(400), width: 10, height: 10 }),
    detect: () => ({ status: "found", proposals: [pieces({ pixels: new Int32Array([0, 1, 10, 11]) }), pieces({ id: "area-2", pixels: new Int32Array([88, 89, 98, 99]) })] }),
    select: (_rgba, _w, _h, _point, options) => { claimed = options.claimed; return { status: "found", proposal: pieces({ pixels: new Int32Array([2, 3, 12, 13]) }) }; },
  }));
  app.setAddTarget("area-1");
  ui.fire("click", ui.preview);
  assert.deepEqual(claimed.map((p) => p.id), ["area-2"]);
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
  const { app } = await openFloorRegions(opening({ scene: fakeScene(), Application: ui.App,
    load: async () => ({ ok: true, rgba: new Uint8Array(400), width: 10, height: 10 }),
    detect: () => ({ status: "found", proposals: [
      pieces({ id: "area-1", preselected: false, pixels: new Int32Array([0, 1, 10, 11]) }),
      pieces({ id: "area-2", preselected: false, pixels: new Int32Array([8, 9, 18, 19]) }),
      pieces({ id: "area-3", pixels: new Int32Array([88, 89, 98, 99]) }),
    ] }),
    select: () => { selectedCalls++; return { status: "found", proposal: pieces({ pixels: new Int32Array([2, 3, 12, 13]) }) }; },
  }));
  app.setAddTarget("area-1");
  assert.equal(ui.rows()[0].querySelector("[data-pick]").checked, false, "choosing a target does not select it for saving");
  app.clickPreview({ target: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }) }, clientX: 85, clientY: 5 });
  assert.equal(selectedCalls, 0, "clicking an existing area adds its exact shape");
  assert.deepEqual(app.detect.proposals.map((p) => p.id), ["area-1", "area-3"]);
  assert.equal(app.detect.proposals[0].pixels.length, 8);
  assert.equal(ui.rows()[0].querySelector("[data-pick]").checked, false);
  assert.equal(ui.rows()[1].querySelector("[data-pick]").checked, true, "a different checked area is not merged");
  const box = ui.rows()[0].querySelector("[data-pick]");
  box.checked = true;
  box.checked = false;
  ui.fire("change", { ...box, closest: (selector) => selector === "[data-pick]" ? box : null });
  assert.equal(app.mode.areaId, "area-1", "unticking the target does not stop Add water");
  ui.fire("click", ui.preview);
  assert.equal(selectedCalls, 1);
  assert.equal(app.detect.proposals[0].pixels.length, 12, "an unchecked target can still gain missed water");
  assert.equal(ui.rows()[0].querySelector("[data-pick]").checked, false);
  assert.equal(ui.status["data-area-count"].textContent, "2 found · 1 selected");
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
  const [proposal] = savedAreaProposals([region], { levelId: "level-1", sceneRect: editRect, width: 20, height: 20 });
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
  const proposals = savedAreaProposals(regions, { levelId: "level-1", sceneRect: editRect, width: 20, height: 20 });
  const picked = proposals.map((p, i) => ({ id: p.id, checked: true, ...p.savedChoices, ...(i === 0 ? { waveTo: "s" } : {}) }));
  const plan = planFloorCreate({ proposals, picked, regions, levelId: "level-1", sceneRect: editRect, imageWidth: 20, imageHeight: 20 });
  assert.deepEqual(plan.creates, []);
  assert.deepEqual(plan.updates, [{ _id: "ocean", "flags.animater.waveTo": "s" }]);
  const scene = fakeScene(regions);
  const result = await commitFloorPlan(plan, { scene });
  assert.deepEqual(scene.calls, [["update", "Region", [{ _id: "ocean", "flags.animater.waveTo": "s" }]]]);
  assert.deepEqual(result, { created: 0, updated: 1 });
  assert.equal(JSON.stringify(regions), before, "no source geometry, behavior, steps or other flags are mutated by planning");
});

test("saved regions reopen without duplicate automatic proposals and extend by updating their original ID", async () => {
  const ui = waterApp();
  const ocean = savedRegion("ocean"), other = savedRegion("other", 220);
  const scene = fakeScene([ocean, other]);
  const initial = savedAreaProposals([ocean], { levelId: "level-1", sceneRect: editRect, width: 20, height: 20 })[0];
  const { app } = await openFloorRegions(opening({ scene, sceneRect: editRect, Application: ui.App,
    load: async () => ({ ok: true, rgba: new Uint8Array(1600), width: 20, height: 20 }),
    detect: () => ({ status: "found", proposals: [{ ...initial, regionId: undefined }] }),
    select: () => ({ status: "found", proposal: pieces({ pixels: new Int32Array([8,9,28,29,48,49,68,69]) }) }),
  }));
  assert.equal(app.detect.proposals.length, 2, "only the two saved regions, no duplicate detection");
  app.setAddTarget("area-1");
  ui.fire("click", ui.preview);
  assert.equal(ui.rows().find((r) => r.dataset.id === "area-1").querySelector("[data-pick]").checked, false);
  const row = ui.rows().find((r) => r.dataset.id === "area-1");
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
  const proposals = savedAreaProposals([region], { levelId: "level-1", sceneRect: editRect, width: 20, height: 20 });
  const picked = [{ id: proposals[0].id, checked: true, waterKind: "still", flowTo: "s", current: "", waveTo: "ne", seaBeach: "off" }];
  const plan = planFloorCreate({ proposals, picked, regions: [region], levelId: "level-1", sceneRect: editRect, imageWidth: 20, imageHeight: 20 });
  assert.deepEqual(plan, { creates: [], updates: [], sources: [] });
});


test("saved geometry uses Foundry's resolved polygon tree for edited shape types", () => {
  const region = savedRegion("shaped");
  region.shapes = [{ type: "rectangle", x: 100, y: 200, width: 80, height: 80 }];
  region.polygonTree = { children: [{ points: [100, 200, 180, 200, 180, 280, 100, 280], isHole: false, children: [
    { points: [120, 220, 140, 220, 140, 240, 120, 240], isHole: true, children: [] },
  ] }] };
  const [proposal] = savedAreaProposals([region], { levelId: "level-1", sceneRect: editRect, width: 20, height: 20 });
  assert.equal(proposal.pixels.length, 60);
  assert.equal(proposal.loops[1].hole, true);
});

test("reopening saved water leaves fresh suggestions unticked and Leave unchanged writes nothing", async () => {
  const ui = waterApp();
  const scene = fakeScene([savedRegion("ocean")]);
  const { app } = await openFloorRegions(opening({ scene, sceneRect: editRect, Application: ui.App,
    load: async () => ({ ok: true, rgba: new Uint8Array(1600), width: 20, height: 20 }),
    detect: () => ({ status: "found", proposals: [pieces({ pixels: new Int32Array([210,211,230,231]) })] }),
  }));
  assert.equal(app.detect.proposals.length, 2);
  assert.equal(ui.rows().every((row) => !row.querySelector("[data-pick]").checked), true);
  ui.rows()[0].querySelector("[data-pick]").checked = true;
  app.removeRow("area-1");
  assert.equal(app.detect.proposals[0].regionId, "ocean", "saved row stays available");
  await app.create();
  assert.deepEqual(scene.calls, []);
  await app.close();
});

test("reopening a saved shore does not offer a junk row of combined sliver fragments", async () => {
  const { WATER_TUNING, areaProposalFromLoops } = await import("../../scripts/engines/regions/floor-detect.mjs");
  const width = 200, height = 200, count = width * height;
  const min = count * WATER_TUNING.componentMinShare;
  const savedLoops = [{ points: [10, 10, 50, 10, 50, 50, 10, 50], hole: false }];
  const saved = { ...areaProposalFromLoops(savedLoops, width, height), id: "area-1", regionId: "river", name: "River",
    savedChoices: { waterKind: "still", flowTo: "", current: "", waveTo: "", seaBeach: "" }, preselected: false };
  const slivers = [];
  for (let i = 0; i < Math.ceil(min) + 10; i++) slivers.push(60 * width + 2 * i);
  assert.ok(slivers.length / count >= WATER_TUNING.componentMinShare);
  const detected = { id: "area-1", pixels: Int32Array.from([...saved.pixels, ...slivers]), loops: savedLoops, share: (saved.pixels.length + slivers.length) / count, vertices: 4 };
  const region = {
    id: "river", name: "River", levels: ["level-1"],
    shapes: [{ type: "polygon", points: savedLoops[0].points.flatMap((v, i) => i % 2 ? 200 + v : 100 + v), hole: false }],
    flags: { animater: { generated: "water-detect", floor: "water", waterKind: "still" } },
  };
  const ui = waterApp();
  const { app } = await openFloorRegions(opening({
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
  const { app } = await openFloorRegions(opening({
    Application: ui.App, scene, sceneRect: editRect,
    load: async () => ({ ok: true, rgba: null, width: 20, height: 20 }),
    detect: () => ({ proposals: [] }),
    confirm: async (message) => { asks.push(message); return allow; },
  }));
  ui.fire("click", ui.button("edit-outline", "area-1"));
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
  const again = await openFloorRegions(opening({
    Application: ui2.App, scene: fakeScene([savedRegion("edited")]), sceneRect: editRect,
    load: async () => ({ ok: true, rgba: null, width: 20, height: 20 }),
    detect: () => ({ proposals: [] }),
    confirm: async (message) => { closeAsks.push(message); return false; },
  }));
  ui2.fire("click", ui2.button("edit-outline", "area-1"));
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
  const { app } = await openFloorRegions(opening({ Application: ui.App, scene, sceneRect: editRect,
    load: async () => ({ ok: true, rgba: null, width: 20, height: 20 }),
    detect: () => ({ proposals: [] }), select: () => { selects++; return { status: "none", reason: "too-small" }; },
  }));
  const before = app.detect.proposals[0], other = app.detect.proposals[1];
  ui.fire("click", ui.button("edit-outline","area-1"));
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
  const { areaProposalFromLoops } = await import("../../scripts/engines/regions/floor-detect.mjs");
  const original = { ...areaProposalFromLoops([{ points: [0,0,8,0,8,8,0,8],hole:false }],20,20),id:"area-1",preselected:false };
  let claimed;
  const { app } = await openFloorRegions(opening({ Application:ui.App,scene:fakeScene(),
    load:async()=>({ok:true,rgba:null,width:20,height:20}),detect:()=>({proposals:[original]}),
    select:(_rgba,_w,_h,_at,options)=>{ claimed=options.claimed; return { status:"none",reason:"too-small" }; },
  }));
  ui.fire("click",ui.button("edit-outline","area-1"));
  map.fire("pointerdown",8,0);map.fire("pointermove",5.25,0);map.fire("pointerup",5.25,0);
  const trimmed=app.detect.proposals[0];
  app.setAddTarget(null);app.suppressClick=false;ui.fire("click",ui.preview);
  assert.strictEqual(claimed[0],trimmed);
  assert.ok(!claimed[0].pixels.includes(7));
  app.setAddTarget("area-1");
  const addition=areaProposalFromLoops([{ points:[12,0,16,0,16,4,12,4],hole:false }],20,20);
  app.combineAreas([{...addition,id:"addition"}]);
  assert.ok(app.detect.proposals[0].loops[0].points.includes(5.25));
  assert.equal(app.detect.proposals[0].pixels.length,trimmed.pixels.length+16);
  assert.equal(ui.rows()[0].querySelector("[data-pick]").checked,false);
  app.undoAdd(); app.undoAdd();
  assert.strictEqual(app.detect.proposals[0],original);
  const editedSource={...areaProposalFromLoops([{points:[12.25,0,16,0,16,4,12.25,4],hole:false}],20,20),id:"addition",geometryChanged:true,outlineEdited:true};
  app.combineAreas([editedSource]);
  assert.ok(app.detect.proposals[0].loops.some((loop)=>loop.points.includes(12.25)),"absorbing an edited source also preserves its exact outline");
  await app.close();
});

test("invalid drags and triangle deletion keep the proposal and history untouched with feedback", async (t) => {
  const map=outlineMap(t),ui=waterApp(map),notes=[];
  const { areaProposalFromLoops }=await import("../../scripts/engines/regions/floor-detect.mjs");
  const initial={...areaProposalFromLoops([{points:[0,0,12,0,12,12,0,12],hole:false},{points:[3,3,5,3,4,5],hole:true}],20,20),id:"area-1"};
  const {app}=await openFloorRegions(opening({Application:ui.App,scene:fakeScene(),notify:(message)=>notes.push(message),
    load:async()=>({ok:true,rgba:null,width:20,height:20}),detect:()=>({proposals:[initial]})}));
  ui.fire("click",ui.button("edit-outline","area-1"));
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
  const {areaProposalFromLoops}=await import("../../scripts/engines/regions/floor-detect.mjs");
  const points=[0,0,20,0,20,20];
  for(let i=19;i>0;i--) points.push(i+1,i,i,i);
  const hole={points:[14,3,16,3,16,5,14,5],hole:true};
  const initial={...areaProposalFromLoops([{points,hole:false},hole],20,20),id:"area-1",preselected:false};
  const {app}=await openFloorRegions(opening({Application:ui.App,scene:fakeScene(),
    load:async()=>({ok:true,rgba:null,width:20,height:20}),detect:()=>({proposals:[initial]})}));
  ui.fire("click",ui.button("edit-outline","area-1"));
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
  const { fitSize } = await import("../../scripts/engines/regions/floor-detect.mjs");
  const f=fitSize(sw,sh), rect={x:100,y:200,width:sw,height:sh};
  const region={id:"edited",name:"Ocean",levels:["level-1"],flags:{animater:{generated:"water-detect",waterKind:"sea",floor:"water"}},behaviors:[{name:"keep"}],shapes:[{type:"polygon",hole:false,points:ring(rect)}]};
  const scene=fakeScene([region]);
  const {app}=await openFloorRegions(opening({Application:ui.App,scene,sceneRect:rect,notify:(m)=>notes.push(m),load:async()=>({ok:true,rgba:null,width:f.width,height:f.height}),detect:()=>({proposals:[]})}));
  map.rect.width=f.width; map.rect.height=f.height;
  return {map,ui,app,scene,f};
}
test("saved ocean reaching the bottom edge can be dragged", async (t)=>{
  const notes=[];
  const {map,ui,app,scene,f}=await savedOpen(t,{sw:1300,sh:2000,notes,ring:(r)=>[r.x,r.y,r.x+r.width,r.y,r.x+r.width,r.y+r.height,r.x,r.y+r.height]});
  const before=app.detect.proposals[0];
  ui.fire("click",ui.button("edit-outline","area-1"));
  assert.equal(Math.max(...before.loops[0].points.filter((_,i)=>i%2===0)),f.width);
  map.fire("pointerdown",0,0);map.fire("pointermove",1,1);map.fire("pointerup",1,1);
  assert.notStrictEqual(app.detect.proposals[0],before,"dragging the in-map top-left handle should change the proposal");
});
test("Delete pressed during a drag is not undone by pointerup", async (t)=>{
  const notes=[],map=outlineMap(t),ui=waterApp(map);
  const {areaProposalFromLoops}=await import("../../scripts/engines/regions/floor-detect.mjs");
  const initial={...areaProposalFromLoops([{points:[0,0,12,0,12,12,0,12,0,6],hole:false}],20,20),id:"area-1",preselected:false};
  const {app}=await openFloorRegions(opening({Application:ui.App,scene:fakeScene(),notify:(m)=>notes.push(m),load:async()=>({ok:true,rgba:null,width:20,height:20}),detect:()=>({proposals:[initial]})}));
  ui.fire("click",ui.button("edit-outline","area-1"));
  map.fire("pointerdown",12,0);map.fire("pointermove",10,1);
  for(const fn of ui.listeners.keydown) fn({key:"Delete",target:{},preventDefault(){},stopPropagation(){}});
  const afterDelete=app.detect.proposals[0].vertices;
  map.fire("pointerup",10,1);
  assert.equal(app.detect.proposals[0].vertices,afterDelete,"deletion should survive the end of the gesture");
});
test("zero-pixel edit is refused and not written to the saved region", async (t)=>{
  const notes=[],map=outlineMap(t),ui=waterApp(map);
  const scene=fakeScene([savedRegion("edited")]);
  const {app}=await openFloorRegions(opening({Application:ui.App,scene,sceneRect:editRect,notify:(m)=>notes.push(m),load:async()=>({ok:true,rgba:null,width:20,height:20}),detect:()=>({proposals:[]})}));
  const before=app.detect.proposals[0];
  ui.fire("click",ui.button("edit-outline","area-1"));
  assert.equal(app.commitOutline([{points:[0.1,0.1,0.4,0.1,0.4,0.4,0.1,0.4],hole:false}]),false);
  assert.strictEqual(app.detect.proposals[0],before);
  assert.equal(app.history?.length??0,0);
  assert.match(notes.at(-1),/some of the area/);
  ui.rows()[0].querySelector("[data-pick]").checked=true;
  await app.create();
  assert.deepEqual(scene.calls,[]);
  await app.close();
});

test("keyboard Undo mid-drag does not get overwritten", async (t)=>{
  const map=outlineMap(t),ui=waterApp(map);
  const {areaProposalFromLoops:WP}=await import("../../scripts/engines/regions/floor-detect.mjs");
  const a={...WP([{points:[0,0,6,0,6,6,0,6],hole:false}],20,20),id:"area-1",preselected:false};
  const {app}=await openFloorRegions(opening({Application:ui.App,scene:fakeScene(),load:async()=>({ok:true,rgba:null,width:20,height:20}),detect:()=>({proposals:[a]})}));
  ui.fire("click",ui.button("edit-outline","area-1"));
  map.fire("pointerdown",6,0);map.fire("pointermove",5,0);map.fire("pointerup",5,0);
  map.fire("pointerdown",5,0);map.fire("pointermove",4,0);
  ui.fire("click",ui.button("undo-add",""));
  assert.equal(app.detect.proposals[0],a);
  map.fire("pointerup",4,0);
  assert.equal(app.detect.proposals[0],a);
});

test("second Add water with a diagonal touch", async () => {
  const ui=waterApp(), notes=[];
  const {mergeAreaProposals:M}=await import("../../scripts/engines/regions/floor-detect.mjs");
  const W=20,H=20,mk=(id,x,y,w,h)=>{const a=[];for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)a.push(j*W+i);return {id,pixels:new Int32Array(a),preselected:true};};
  const target={...M([mk("area-1",0,0,4,4)],W,H),id:"area-1",preselected:false};
  const adds=[{...M([mk("a",10,0,4,4)],W,H),id:"area-8"},{...M([mk("b",4,4,4,4)],W,H),id:"area-9"}];
  let n=0;
  const {app}=await openFloorRegions(opening({Application:ui.App,scene:fakeScene(),notify:(m)=>notes.push(m),
    load:async()=>({ok:true,rgba:new Uint8Array(W*H*4),width:W,height:H}),detect:()=>({proposals:[target]}),
    select:()=>({status:"found",proposal:adds[n++]})}));
  ui.fire("click",ui.button("add-to","area-1"));
  ui.fire("click",ui.preview);
  ui.fire("click",ui.preview);
  const p=app.detect.proposals[0];
  assert.ok(p.pixels.length>=47,"both additions are kept");
  await app.close();
});

test("a manual shore edit supersedes the outline cut it replaces during later Add", async () => {
  const { areaProposalFromLoops } = await import("../../scripts/engines/regions/floor-detect.mjs");
  const ui = waterApp();
  const initial = { ...areaProposalFromLoops([{ points: [0, 0, 10, 0, 10, 10, 0, 10], hole: false }], 20, 20), id: "area-1" };
  const { app } = await openFloorRegions(opening({ Application: ui.App, scene: fakeScene(), load: async () => ({ ok: true, rgba: null, width: 20, height: 20 }), detect: () => ({ proposals: [initial] }) }));
  app.setMode({ kind: "vertices", areaId: "area-1" });
  const notched = [{ points: [0, 0, 10, 0, 10, 4, 8, 4, 8, 6, 10, 6, 10, 10, 0, 10], hole: false }];
  assert.equal(app.commitOutline(notched), true);
  assert.equal(app.detect.proposals[0].pixels.includes(4 * 20 + 8), false);
  const pulled = app.detect.proposals[0].loops.map((loop) => ({ ...loop, points: loop.points.map((value, index) => index % 2 === 0 && value === 8 ? 9 : value) }));
  assert.equal(app.commitOutline(pulled), true);
  assert.equal(app.detect.proposals[0].pixels.includes(4 * 20 + 8), true);
  app.setAddTarget("area-1");
  app.combineAreas([{ ...areaProposalFromLoops([{ points: [12, 0, 15, 0, 15, 3, 12, 3], hole: false }], 20, 20), id: "addition" }]);
  assert.equal(app.detect.proposals[0].pixels.includes(4 * 20 + 8), true);
  await app.close();
});

// Smart selection, with a fake model: three nested squares around whatever point it is given (small, middle,
// large), so every click finds the middle one, and the sizes are easy to tell apart.
function fakeSmart(W, H, log) {
  const square = (cx, cy, r) => { const m = new Uint8Array(W * H); for (let y = Math.max(0, cy - r); y < Math.min(H, cy + r); y++) for (let x = Math.max(0, cx - r); x < Math.min(W, cx + r); x++) m[y * W + x] = 1; return m; };
  return async ({ onProgress } = {}) => {
    log.loads++; onProgress?.(50e6, 456e6);
    return {
      device: "webgpu",
      read: async (rgba, width, height) => { log.reads.push([width, height]); return { width, height }; },
      masks: async (_view, points) => {
        log.marks.push(points);
        const p = points.find((q) => q.label === 1) ?? points[0], cx = Math.round(p.x), cy = Math.round(p.y);
        return { masks: [square(cx, cy, 12), square(cx, cy, 3), square(cx, cy, 7)], scores: [0.6, 0.7, 0.95] };
      },
    };
  };
}
const smartOpening = (App, log, over = {}) => opening({
  scene: fakeScene(), Application: App, detect: () => ({ status: "none", reason: "no-candidates" }),
  load: async () => ({ ok: true, rgba: new Uint8Array(60 * 40 * 4), width: 60, height: 40 }),
  smart: fakeSmart(60, 40, log), ...over,
});
const count = (pixels) => pixels.length;

test("choosing Smart asks once before the download; declining keeps colour selection and loads nothing", async () => {
  const { App, listeners, shared } = waterApp();
  const log = { loads: 0, reads: [], marks: [] }, asked = [];
  const { app } = await openFloorRegions(smartOpening(App, log, { confirm: async (text) => { asked.push(text); return false; } }));
  shared.selection.value = "smart";
  shared.selection.closest = (s) => (s === "[data-select-mode]" ? shared.selection : null);
  for (const fn of listeners.change) fn({ target: shared.selection });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(asked, [SMART_CONSENT]);
  assert.match(SMART_CONSENT, /456 MB/);
  assert.match(SMART_CONSENT, /huggingface\.co/);
  assert.match(SMART_CONSENT, /not sent anywhere/);
  assert.equal(shared.selection.value, "colour", "declined: back to colour");
  assert.equal(log.loads, 0);
  await app.close();
});

test("a smart click loads the model, reads the map once, and adds the area the nearby clicks agree on", async () => {
  const { App, rows, shared } = waterApp();
  const log = { loads: 0, reads: [], marks: [] }, asked = [];
  const { app } = await openFloorRegions(smartOpening(App, log, { confirm: async (text) => { asked.push(text); return true; } }));
  shared.selection.value = "smart";
  await app.smartMark({ at: { x: 30, y: 20 } });
  assert.equal(asked.length, 1, "asked before downloading");
  assert.deepEqual(log.reads, [[60, 40]], "read once, at the generator's size");
  assert.equal(log.marks.length, 5, "the click and four nearby clicks");
  assert.deepEqual(rows().map((row) => row.dataset.id), ["area-1"]);
  const area = app.detect.proposals[0];
  assert.equal(area.smart, true);
  assert.equal(count(area.pixels), 14 * 14, "the middle size (7 around the click)");
  assert.match(shared.smartStatus.textContent, /Shift\+drag/);
  await app.smartMark({ at: { x: 8, y: 8 } });
  assert.equal(asked.length, 1, "not asked again");
  assert.equal(log.reads.length, 1, "the map is not read again");
  assert.equal(app.detect.proposals.length, 2);
  assert.ok(!app.detect.proposals[1].pixels.some((p) => area.pixels.includes(p)), "the second area does not overlap the first");
  await app.close();
});

test("while the model works on a click the status says so, and goes back to the help after", async () => {
  const { App, shared } = waterApp();
  const log = { loads: 0, reads: [], marks: [] }, seen = [];
  const model = fakeSmart(60, 40, log);
  const smart = async (...args) => { const m = await model(...args); return { ...m, masks: async (view, points) => { seen.push(shared.smartStatus.textContent); return m.masks(view, points); } }; };
  const { app } = await openFloorRegions(smartOpening(App, log, { confirm: async () => true, smart }));
  shared.selection.value = "smart";
  await app.smartMark({ at: { x: 30, y: 20 } });
  assert.ok(seen.length && seen.every((text) => text === "Finding the area…"), seen.join(" | "));
  assert.match(shared.smartStatus.textContent, /Shift\+drag/);
  await app.smartMark({ remove: { x: 30, y: 20 } });
  assert.equal(seen.at(-1), "Finding the part to take out…");
  await app.close();
});

test("1 to 3 switch the last smart area's size in place, and undo brings the earlier size back", async () => {
  const { App, listeners, shared } = waterApp();
  const log = { loads: 0, reads: [], marks: [] };
  const { app } = await openFloorRegions(smartOpening(App, log));
  shared.selection.value = "smart";
  await app.smartMark({ at: { x: 30, y: 20 } });
  const key = async (k) => { for (const fn of listeners.keydown) fn({ key: k, target: { closest: () => null }, preventDefault() {}, stopPropagation() {} }); await new Promise((r) => setTimeout(r, 0)); };
  await key("3");
  assert.equal(app.detect.proposals.length, 1, "the same area, not a new one");
  assert.equal(app.detect.proposals[0].id, "area-1");
  assert.equal(count(app.detect.proposals[0].pixels), 24 * 24, "large");
  await key("1");
  assert.equal(count(app.detect.proposals[0].pixels), 6 * 6, "small");
  app.undoAdd();
  assert.equal(count(app.detect.proposals[0].pixels), 24 * 24, "undo: back to large");
  await app.close();
});

test("a smart box starts on the model's top score", async () => {
  const { App, shared } = waterApp();
  const log = { loads: 0, reads: [], marks: [] };
  const { app } = await openFloorRegions(smartOpening(App, log));
  shared.selection.value = "smart";
  await app.smartMark({ box: [40, 30, 20, 10] });
  assert.deepEqual(log.marks.at(-1), [{ x: 20, y: 10, label: 2 }, { x: 40, y: 30, label: 3 }], "the box as its corners");
  assert.equal(count(app.detect.proposals[0].pixels), 14 * 14, "top score (0.95): the middle square");
  await app.close();
});

test("a right-click cuts the clicked thing out of whichever area is under it, keeps the hole, and 1 to 3 resize the cut", async () => {
  const { App, listeners, shared } = waterApp();
  const log = { loads: 0, reads: [], marks: [] }, notes = [];
  const { app } = await openFloorRegions(smartOpening(App, log, { notify: (m) => notes.push(m) }));
  shared.selection.value = "smart";
  const key = async (k) => { for (const fn of listeners.keydown) fn({ key: k, target: { closest: () => null }, preventDefault() {}, stopPropagation() {} }); await new Promise((r) => setTimeout(r, 0)); };
  await app.smartMark({ at: { x: 30, y: 20 } });
  await key("3"); // Area 1: the large square, 24 x 24 around (30, 20)
  await app.smartMark({ at: { x: 8, y: 8 } }); // Area 2 is now the last area
  const second = app.detect.proposals[1];
  await app.smartMark({ remove: { x: 30, y: 20 } });
  assert.deepEqual(log.marks.at(-1), [{ x: 30, y: 20, label: 1 }], "the model is asked what the clicked thing is on its own");
  const cut = app.detect.proposals[0];
  assert.equal(cut.id, "area-1", "the area under the click, not the last one");
  assert.equal(count(cut.pixels), 24 * 24 - 8 * 8, "the small size, grown by a pixel: the middle one is over a quarter of the area, the large one is the area");
  assert.ok(cut.loops.some((loop) => loop.hole), "the hole is kept, not filled back in");
  assert.equal(cut.geometryChanged, true);
  assert.equal(cut.exclusions.length, 1, "remembered as cut, so later additions leave it out");
  assert.equal(app.detect.proposals[1], second, "the other area is untouched");
  await key("2");
  assert.equal(count(app.detect.proposals[0].pixels), 24 * 24 - 16 * 16, "2: the middle cut instead, from the area as it was");
  app.undoAdd();
  assert.equal(count(app.detect.proposals[0].pixels), 24 * 24 - 8 * 8, "undo: back to the small cut");
  await app.smartMark({ remove: { x: 55, y: 35 } });
  assert.match(notes.at(-1), /inside an area/, "outside every area: says so");
  await app.close();
});

test("the size of a smart mark is known, so the Size control can show it", async () => {
  const m = (n) => { const a = new Uint8Array(100); a.fill(1, 0, n); return a; };
  const small = m(10), middle = m(40), large = m(90);
  assert.equal(sizeOf([large, small, middle], small), 0);
  assert.equal(sizeOf([large, small, middle], large), 2);
  assert.equal(sizeOf([large, small, middle], m(35)), 1, "another mask: the nearest size");
  assert.equal(sizeOf([], small), null);
  const { App, listeners, shared } = waterApp();
  const log = { loads: 0, reads: [], marks: [] };
  const { app } = await openFloorRegions(smartOpening(App, log));
  shared.selection.value = "smart";
  await app.smartMark({ at: { x: 30, y: 20 } });
  assert.equal(app.smartLast.size, 1, "a click starts on the middle size");
  await app.smartResize(2);
  assert.equal(app.smartLast.size, 2);
  await app.close();
});

test("a right-click on a bridge filling most of a small pool cuts the bridge by colour when the model's piece is the whole thing", async () => {
  const { App } = waterApp();
  const W = 60, H = 40, rgba = new Uint8Array(W * H * 4), poolPixels = [];
  const isBridge = (x, y) => y >= 3 && y < 27;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const p = y * W + x, inPool = x < 40 && y < 30;
    rgba.set(inPool && isBridge(x, y) ? [150, 150, 145, 255] : inPool ? [40, 110, 170, 255] : [60, 120, 50, 255], p * 4);
    if (inPool) poolPixels.push(p);
  }
  const pool = { ...mergeAreaProposals([{ id: "area-1", pixels: Int32Array.from(poolPixels) }], W, H), id: "area-1", preselected: true, floor: "water" };
  // The model sees the bridge and nearly all the water as one thing, at every size.
  const big = new Uint8Array(W * H); for (const p of poolPixels) if (Math.floor(p / W) < 26) big[p] = 1; // 87% of the pool: under the size cap, grey on average
  const model = { device: "webgpu", read: async () => ({}), masks: async () => ({ masks: [big, big, big], scores: [1, 1, 1] }) };
  const notes = [];
  const { app } = await openFloorRegions(opening({ Application: App, scene: fakeScene(), notify: (m) => notes.push(m), confirm: async () => true,
    load: async () => ({ ok: true, rgba, width: W, height: H }), detect: () => ({ proposals: [pool] }), smart: async () => model, autoMark: false }));
  await app.smartMark({ remove: { x: 20, y: 15 } });
  const left = app.detect.proposals[0].pixels;
  const bridgeLeft = [...left].filter((p) => isBridge(p % W, Math.floor(p / W))).length;
  assert.ok(bridgeLeft <= 4, `bridge pixels left: ${bridgeLeft}`);
  assert.ok(left.length >= 40 * 4, `the water strips stay: ${left.length} pixels`);
  assert.doesNotMatch(notes.join("\n"), /whole area|Nothing there/);
  await app.close({ force: true });
});

test("a right-click on a stray spot removes it in either tool, and the broom removes every small spot", async () => {
  const { App, listeners } = waterApp();
  const notes = [];
  const W = 60, H = 40, mask = new Uint8Array(W * H);
  const fill = (x0, y0, x1, y1) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) mask[y * W + x] = 1; };
  fill(0, 0, 30, 30); fill(40, 5, 42, 7); fill(50, 30, 52, 32);
  const pixels = []; for (let p = 0; p < mask.length; p++) if (mask[p]) pixels.push(p);
  const sand = { ...mergeAreaProposals([{ id: "area-1", pixels: Int32Array.from(pixels) }], W, H), id: "area-1", preselected: true };
  const { app } = await openFloorRegions(opening({ Application: App, scene: fakeScene(), notify: (m) => notes.push(m),
    load: async () => ({ ok: true, rgba: new Uint8Array(W * H * 4), width: W, height: H }), detect: () => ({ proposals: [sand] }) }));
  assert.equal(app.removeSpot({ x: 15, y: 15 }), false, "the main body is not a spot");
  assert.equal(app.removeSpot({ x: 40.5, y: 5.5 }), true);
  assert.equal(app.detect.proposals[0].pixels.length, 900 + 4, "one bead gone");
  assert.equal(app.detect.proposals[0].id, "area-1");
  assert.equal(app.smartLast, null, "a spot cannot be resized");
  app.tidyArea("area-1");
  assert.equal(app.detect.proposals[0].pixels.length, 900, "the broom took the other bead");
  app.tidyArea("area-1");
  assert.match(notes.at(-1), /no small stray spots/);
  app.undoAdd();
  assert.equal(app.detect.proposals[0].pixels.length, 904, "undo brings the bead back");
  await app.close();
});

test("selecting an area: a row click, a tool on it, or a split's new area; a gone area selects none", async () => {
  const { App, listeners } = waterApp();
  const W = 60, H = 40, mask = new Uint8Array(W * H);
  for (let y = 0; y < 30; y++) for (let x = 0; x < 30; x++) mask[y * W + x] = 1;
  const pixels = []; for (let p = 0; p < mask.length; p++) if (mask[p]) pixels.push(p);
  const sand = { ...mergeAreaProposals([{ id: "area-1", pixels: Int32Array.from(pixels) }], W, H), id: "area-1", preselected: true };
  const { app } = await openFloorRegions(opening({ Application: App, scene: fakeScene(),
    load: async () => ({ ok: true, rgba: new Uint8Array(W * H * 4), width: W, height: H }), detect: () => ({ proposals: [sand] }) }));
  app.select("area-1");
  assert.equal(app.selectedId, "area-1");
  app.select("area-9");
  assert.equal(app.selectedId, "", "an area that is not there selects none");
  app.setMode({ kind: "add", areaId: "area-1" });
  assert.equal(app.selectedId, "area-1", "a tool on an area selects it");
  app.setMode({ kind: "inspect" });
  assert.equal(app.splitArea("area-1", [0, 0, 10, 0, 10, 30, 0, 30]), true);
  assert.equal(app.selectedId, "area-2", "the split-off part is selected");
  await app.close();
});

test("remove all small spots tidies every area as one undo step, and Ctrl+Z undoes it", async () => {
  const { App, listeners } = waterApp();
  const notes = [];
  const W = 80, H = 40;
  const area = (id, x0, bead) => {
    const mask = new Uint8Array(W * H);
    const fill = (a, b, c, d) => { for (let y = b; y < d; y++) for (let x = a; x < c; x++) mask[y * W + x] = 1; };
    fill(x0, 0, x0 + 30, 30); if (bead) fill(bead, 34, bead + 2, 36);
    const pixels = []; for (let p = 0; p < mask.length; p++) if (mask[p]) pixels.push(p);
    return { ...mergeAreaProposals([{ id, pixels: Int32Array.from(pixels) }], W, H), id, preselected: true };
  };
  const { app } = await openFloorRegions(opening({ Application: App, scene: fakeScene(), notify: (m) => notes.push(m),
    load: async () => ({ ok: true, rgba: new Uint8Array(W * H * 4), width: W, height: H }),
    detect: () => ({ proposals: [area("area-1", 0, 5), area("area-2", 40, 45)] }) }));
  const before = app.history?.length ?? 0;
  assert.equal(app.tidyAll(), 2);
  assert.deepEqual(app.detect.proposals.map((p) => p.pixels.length), [900, 900], "both beads gone");
  assert.equal(app.history.length, before + 1, "one undo step for all of them");
  assert.match(notes.at(-1), /from 2 areas/);
  assert.equal(app.tidyAll(), 0);
  assert.match(notes.at(-1), /No area has small stray spots/);
  assert.equal(app.history.length, before + 1, "nothing to do leaves no undo step");
  let stopped = false;
  for (const fn of listeners.keydown) fn({ key: "z", ctrlKey: true, target: {}, preventDefault() {}, stopPropagation() { stopped = true; } });
  assert.ok(stopped, "Ctrl+Z is handled");
  assert.deepEqual(app.detect.proposals.map((p) => p.pixels.length), [904, 904], "Ctrl+Z brings both beads back");
  await app.close();
});

test("in add mode a smart click joins the area being added to, and cannot be resized afterwards", async () => {
  const { App, shared } = waterApp();
  const log = { loads: 0, reads: [], marks: [] };
  const { app } = await openFloorRegions(smartOpening(App, log));
  shared.selection.value = "smart";
  await app.smartMark({ at: { x: 30, y: 20 } });
  app.setAddTarget("area-1");
  await app.smartMark({ at: { x: 40, y: 20 }, target: app.detect.proposals[0] });
  assert.equal(app.detect.proposals.length, 1, "merged into Area 1");
  assert.ok(count(app.detect.proposals[0].pixels) > 14 * 14);
  assert.equal(app.smartLast, null);
  await app.close();
});

// Areas on a 20 × 20 map, built from outlines so they have real pixels to combine.
async function areasApp(defs, over = {}) {
  const { areaProposalFromLoops } = await import("../../scripts/engines/regions/floor-detect.mjs");
  const ui = waterApp();
  const proposals = defs.map(([id, x0, y0, x1, y1, extra = {}]) => ({ ...areaProposalFromLoops([{ points: [x0, y0, x1, y0, x1, y1, x0, y1], hole: false }], 20, 20), id, preselected: true, ...extra }));
  const { app } = await openFloorRegions(opening({
    scene: fakeScene(), Application: ui.App, detect: () => ({ status: "found", proposals }),
    load: async () => ({ ok: true, rgba: new Uint8Array(20 * 20 * 4), width: 20, height: 20 }), ...over,
  }));
  return { ...ui, app };
}

test("Combine ticked merges the ticked areas into the largest one, keeps it in the list once, and undo splits them again", async () => {
  const { app, rows, shared } = await areasApp([["area-1", 0, 0, 8, 8], ["area-2", 12, 12, 15, 15], ["area-3", 0, 12, 3, 15]]);
  assert.equal(shared.combine.disabled, false, "three ticked: combine is on");
  const big = app.detect.proposals.find((p) => p.id === "area-1").pixels.length;
  const small = app.detect.proposals.find((p) => p.id === "area-2").pixels.length;
  rows().find((r) => r.dataset.id === "area-3").querySelector("[data-pick]").checked = false;
  app.combineTicked();
  assert.deepEqual(app.detect.proposals.map((p) => p.id).sort(), ["area-1", "area-3"], "area-2 joined water-1; the unticked one stays");
  assert.equal(app.detect.proposals.find((p) => p.id === "area-1").pixels.length, big + small);
  app.undoAdd();
  assert.deepEqual(app.detect.proposals.map((p) => p.id).sort(), ["area-1", "area-2", "area-3"]);
  await app.close({ force: true });
});

test("Combine ticked needs two areas and refuses to merge two saved regions", async () => {
  const notes = [];
  const { app, rows } = await areasApp([["area-1", 0, 0, 8, 8, { regionId: "a" }], ["area-2", 12, 12, 15, 15, { regionId: "b" }]], { notify: (m) => notes.push(m) });
  for (const r of rows()) r.querySelector("[data-pick]").checked = true;
  app.combineTicked();
  assert.equal(app.detect.proposals.length, 2, "two saved regions stay apart");
  assert.match(notes.at(-1), /Two saved regions cannot be combined/);
  rows()[0].querySelector("[data-pick]").checked = false;
  app.combineTicked();
  assert.equal(app.detect.proposals.length, 2);
  assert.match(notes.at(-1), /Tick two or more areas/);
  await app.close({ force: true });
});

test("a clicked area takes the floor chosen in Floor to add", async () => {
  const { App, fire, preview, rows, shared } = waterApp();
  const { app } = await openFloorRegions(opening({
    scene: fakeScene(), Application: App, detect: () => ({ status: "none", reason: "no-candidates" }),
    select: () => ({ status: "found", proposal: pieces({ id: "area-2", clicked: true }), seed: { hue: 30, saturation: 0.4 } }),
  }));
  shared.addFloor.value = "wood";
  fire("click", preview);
  assert.equal(app.detect.proposals[0].floor, "wood");
  assert.equal(rows().length, 1);
  await app.close({ force: true });
});

// Floor memory: a black 10 × 1 map, so every area's signature is all zeros.
const blackSig = [0, 0, 0, 0, 0, 0, 0];
const memoryStore = (examples = []) => { const saved = []; return { saved, load: () => examples, save: async (list) => { saved.push(list); } }; };
const learningApp = async (examples, scene = fakeScene(), over = {}) => {
  const ui = waterApp(), store = memoryStore(examples);
  const { app } = await openFloorRegions(opening({
    scene, Application: ui.App, detect: () => ({ status: "none", reason: "no-candidates" }), memory: store, autoMark: false,
    select: () => ({ status: "found", proposal: pieces({ id: "area-2", clicked: true, pixels: Int32Array.from([0, 1, 2]) }), seed: { hue: 0, saturation: 0 } }),
    ...over,
  }));
  return { ...ui, app, store, scene };
};

test("on Auto, a new area takes the floor and look of the saved region it looks like", async () => {
  const { app, fire, preview, shared } = await learningApp([{ key: "s:r1", sig: blackSig, floor: "wood", look: { overWater: true } }]);
  shared.addFloor.value = AUTO_FLOOR;
  fire("click", preview);
  assert.equal(app.detect.proposals[0].floor, "wood");
  assert.equal(app.detect.proposals[0].learned, true);
  await app.close({ force: true });
});

test("on Auto with nothing alike, a new area has no floor yet: unticked, asking for one, never water", async () => {
  const notes = [];
  const { app, fire, preview, shared, rows } = await learningApp([{ key: "s:r1", sig: [90, 0, 0, 1, 0, 0, 1], floor: "snow" }], fakeScene(), { notify: (m) => notes.push(m) });
  shared.addFloor.value = AUTO_FLOOR;
  fire("click", preview);
  assert.equal(app.detect.proposals[0].floor, NO_FLOOR);
  assert.notEqual(app.detect.proposals[0].learned, true);
  const row = rows()[0];
  assert.equal(row.querySelector("[data-pick]").checked, false, "not ticked until it has a floor");
  assert.match(shared.smartStatus.textContent, /doesn't know this floor/);
  // Ticked anyway, the save asks for the floor instead of writing water.
  row.dataset.floor = NO_FLOOR;
  Object.assign(row, { hasAttribute: (name) => name === "data-needs-floor", removeAttribute() {} });
  row.querySelector("[data-pick]").checked = true;
  await app.create();
  assert.match(notes.at(-1), /Pick a floor/);
  // Picking a floor gives the area that floor and ticks it.
  row.querySelector("[data-pick]").checked = false;
  app.floorGiven(row, "dirt");
  assert.equal(app.detect.proposals[0].floor, "dirt");
  assert.equal(row.querySelector("[data-pick]").checked, true);
  await app.close({ force: true });
});

test("a row with no floor reads back as no floor, and a redraw keeps it asking", () => {
  assert.equal(readAreaChoices([{ id: "a", floor: NO_FLOOR }])[0].floor, NO_FLOOR);
  assert.equal(readAreaChoices([{ id: "a" }])[0].floor, "water");
  const html = areaRowHTML({ id: "area-1", floor: NO_FLOOR, preselected: true, share: 0.1, vertices: 4 }, { floor: NO_FLOOR });
  assert.match(html, /<option value="" selected>Pick a floor…<\/option>/);
  assert.match(html, /data-needs-floor/);
  assert.doesNotMatch(html, /data-pick="area-1" checked/);
  assert.match(html, /data-water-fields hidden/);
  assert.match(rowMeta({ saved: false, checked: false, floor: NO_FLOOR }), /pick one/);
});

test("with a floor picked, the floor stays; only that floor's look is learned", async () => {
  const examples = [{ key: "s:r1", sig: blackSig, floor: "wood", look: { overWater: true } }];
  const grass = await learningApp(examples);
  grass.shared.addFloor.value = "grass";
  grass.fire("click", grass.preview);
  assert.equal(grass.app.detect.proposals[0].floor, "grass");
  assert.notEqual(grass.app.detect.proposals[0].learned, true);
  await grass.app.close({ force: true });
  const wood = await learningApp(examples);
  wood.shared.addFloor.value = "wood";
  wood.fire("click", wood.preview);
  assert.equal(wood.app.detect.proposals[0].learned, true);
  await wood.app.close({ force: true });
});

test("saving teaches the memory each ticked area, keyed by the region it made", async () => {
  const scene = fakeScene();
  scene.id = "scene-1";
  scene.createEmbeddedDocuments = async (type, data) => data.map((_, i) => ({ id: `new-${i}` }));
  const { app, fire, preview, store, rows } = await learningApp([], scene);
  fire("click", preview);
  rows()[0].querySelector("[data-pick]").checked = true;
  await app.create();
  assert.equal(store.saved.length, 1);
  assert.deepEqual(store.saved[0].map((e) => [e.key, e.floor, e.sig]), [["scene-1:new-0", "water", blackSig]]);
});

// A 10 × 1 map: pixels 0-4 black, 5-9 white. Colour selection returns the half under the click, minus what is claimed.
const halfMap = () => { const rgba = new Uint8Array(40); for (let p = 5; p < 10; p++) rgba.set([255, 255, 255, 255], p * 4); return rgba; };
const halfSelect = (rgba, width, height, at, { claimed = [] } = {}) => {
  const taken = new Set(claimed.flatMap((c) => [...(c.pixels ?? [])]));
  const pixels = (at.x < 5 ? [0, 1, 2, 3, 4] : [5, 6, 7, 8, 9]).filter((p) => !taken.has(p));
  return pixels.length ? { status: "found", proposal: pieces({ id: "picked", clicked: true, pixels: Int32Array.from(pixels) }) } : { status: "none", reason: "claimed" };
};

test("on open, areas like the saved regions are marked by themselves, ticked, with their learned floor", async () => {
  const { app, rows } = await learningApp([{ key: "s:r1", sig: areaSignature(halfMap(), 10, 1, [0, 1, 2, 3, 4]), floor: "wood", look: { overWater: true } }], fakeScene(), {
    autoMark: true, load: async () => ({ ok: true, rgba: halfMap(), width: 10, height: 1 }), select: halfSelect,
  });
  assert.equal(await app.firstMark, 1);
  assert.deepEqual(app.detect.proposals.map((p) => [p.floor, p.auto, p.preselected, [...p.pixels].join("")]), [["wood", true, true, "01234"]]);
  assert.equal(rows().length, 1);
  await app.close({ force: true });
});

test("with no floors learned yet, nothing is marked and nothing is cut", async () => {
  let cuts = 0;
  const { app } = await learningApp([{ key: "n", sig: blackSig, floor: "none" }], fakeScene(), { autoMark: true, select: () => { cuts++; return { status: "none" }; } });
  assert.equal(await app.firstMark, 0);
  assert.equal(cuts, 0);
  await app.close({ force: true });
});

test("Mark areas marks on demand, and with nothing learned says how to teach it", async () => {
  const notes = [];
  const empty = await learningApp([], fakeScene(), { notify: (m) => notes.push(m), select: halfSelect, load: async () => ({ ok: true, rgba: halfMap(), width: 10, height: 1 }) });
  assert.match(await empty.app._renderHTML(), /data-auto-mark[^>]*aria-disabled="true"/);
  await empty.app.markClicked();
  assert.match(notes.at(-1), /Nothing learned yet/);
  assert.equal(empty.app.detect.proposals.length, 0);
  await empty.app.close({ force: true });
  const taught = await learningApp([{ key: "s:r1", sig: areaSignature(halfMap(), 10, 1, [0, 1, 2, 3, 4]), floor: "wood" }], fakeScene(), { select: halfSelect, load: async () => ({ ok: true, rgba: halfMap(), width: 10, height: 1 }) });
  assert.match(await taught.app._renderHTML(), /data-auto-mark[^>]*aria-disabled="false"/);
  await taught.app.markClicked();
  assert.deepEqual(taught.app.detect.proposals.map((p) => p.floor), ["wood"]);
  await taught.app.markClicked();
  assert.equal(taught.app.detect.proposals.length, 1, "marking again finds nothing new");
  await taught.app.close({ force: true });
});

test("a marked area removed is remembered as not a region; one saved, as its floor", async () => {
  const scene = fakeScene();
  scene.id = "scene-1";
  scene.createEmbeddedDocuments = async (type, data) => data.map((_, i) => ({ id: `new-${i}` }));
  const whiteSig = areaSignature(halfMap(), 10, 1, [5, 6, 7, 8, 9]);
  const { app, store } = await learningApp([{ key: "s:r1", sig: areaSignature(halfMap(), 10, 1, [0, 1, 2, 3, 4]), floor: "wood" }, { key: "s:r2", sig: whiteSig, floor: "snow" }], scene, {
    autoMark: true, load: async () => ({ ok: true, rgba: halfMap(), width: 10, height: 1 }), select: halfSelect,
  });
  assert.equal(await app.firstMark, 2);
  app.removeRow(app.detect.proposals.find((p) => p.floor === "wood").id);
  await app.create();
  const learned = store.saved.at(-1).slice(-2).map((e) => [e.key.replace(/:none:.*/, ":none"), e.floor]);
  assert.deepEqual(learned.sort(), [["scene-1:new-0", "water"], ["scene-1:none", "none"]].sort());
});

test("regions already on the scene teach the memory once, and again only when they change", async () => {
  const store = memoryStore([]);
  const saved = [{ regionId: "r1", pixels: [0, 1], floor: "stone", savedChoices: { floor: "stone", texture: "off" } }];
  const map = { scene: { id: "s" }, rgba: new Uint8Array(40), width: 10, height: 1 };
  const first = await learnSaved(store, saved, map);
  assert.deepEqual(first.map((e) => [e.key, e.floor, e.look]), [["s:r1", "stone", { texture: "off" }]]);
  const again = memoryStore(first);
  await learnSaved(again, saved, map);
  assert.equal(again.saved.length, 0, "nothing new: no write");
  await learnSaved(again, [{ ...saved[0], savedChoices: { floor: "dirt" }, floor: "dirt" }], map);
  assert.equal(again.saved.at(-1)[0].floor, "dirt");
});

test("the memory store registers its world setting on first use and saves only for a GM", async () => {
  const values = new Map(), registered = new Map();
  const game = { user: { isGM: true }, settings: {
    settings: registered,
    register: (id, key, config) => registered.set(`${id}.${key}`, config),
    get: (id, key) => values.get(`${id}.${key}`) ?? registered.get(`${id}.${key}`).default,
    set: async (id, key, value) => values.set(`${id}.${key}`, value),
  } };
  const store = floorMemoryStore(game);
  assert.deepEqual(store.load(), []);
  assert.equal(registered.get(`animater.${FLOOR_MEMORY_SETTING}`).scope, "world");
  await store.save([{ key: "a", sig: blackSig, floor: "wood", look: {} }]);
  assert.equal(store.load().length, 1);
  game.user.isGM = false;
  await store.save([]);
  assert.equal(store.load().length, 1);
  assert.equal(floorMemoryStore(undefined), null);
});

test("the window's map is a sharp copy: the art's own size up to VIEW_MAX, in the read's shape", async () => {
  const made = [], closed = [];
  const bitmap = (width, height) => ({ width, height, close() { closed.push([width, height]); } });
  const deps = (w, h) => ({
    fetch: async () => ({ ok: true, blob: async () => ({ type: "image/webp" }) }),
    createImageBitmap: async (source, options) => { made.push(options ?? null); return options ? bitmap(options.resizeWidth, options.resizeHeight) : bitmap(w, h); },
  });
  const big = await loadMapView("maps/a.webp", { width: 1024, height: 512 }, deps(8000, 4000));
  assert.deepEqual([big.width, big.height], [VIEW_MAX, VIEW_MAX / 2]);
  assert.equal(made.at(-1).resizeQuality, "high");
  assert.deepEqual(closed.at(-1), [8000, 4000], "the full-size decode is let go");
  const small = await loadMapView("maps/b.webp", { width: 1024, height: 512 }, deps(2048, 1024));
  assert.deepEqual([small.width, small.height], [2048, 1024], "never above the art's own size");
  const tiny = await loadMapView("maps/c.webp", { width: 1024, height: 512 }, deps(600, 300));
  assert.deepEqual([tiny.width, tiny.height], [1024, 512], "never below the read");
  assert.equal(await loadMapView("maps/d.webm", { width: 10, height: 10 }, deps(10, 10)), null, "a video has no sharp copy");
  assert.equal(await loadMapView("maps/e.webp", { width: 10, height: 10 }, { fetch: async () => ({ ok: false }), createImageBitmap: async () => bitmap(1, 1) }), null);
});

test("the preview draws the sharp map scaled to the canvas, with outlines one size on screen", () => {
  const calls = [];
  const ctx = new Proxy({}, { get: (_, key) => key in ctx_ ? ctx_[key] : (...args) => calls.push([key, ...args]), set: (_, key, value) => { calls.push(["set", key, value]); return true; } });
  const ctx_ = {};
  const image = { width: 400, height: 200 };
  const area = { id: "area-1", floor: "grass", loops: [{ points: [0, 0, 10, 0, 10, 10, 0, 10], hole: false }], pixels: Int32Array.from([0]) };
  paintAreaPreview(ctx, null, 100, 50, [area], "", null, { image, scale: 4, unit: 0.5 });
  assert.deepEqual(calls.find((c) => c[0] === "setTransform"), ["setTransform", 4, 0, 0, 4, 0, 0]);
  assert.deepEqual(calls.find((c) => c[0] === "drawImage"), ["drawImage", image, 0, 0, 100, 50], "the sharp map, in read pixels");
  assert.ok(calls.some((c) => c[0] === "set" && c[1] === "lineWidth" && c[2] === 0.9375), "a 1.9-pixel outline on screen, at half a read pixel per screen pixel");
});

test("the sharp map arrives after the window opens and is let go when it closes", async () => {
  const { App } = waterApp();
  let closed = 0, resolveView;
  const image = { width: 120, height: 80, close: () => { closed++; } };
  const { app } = await openFloorRegions(opening({ Application: App, scene: fakeScene(), view: () => new Promise((r) => { resolveView = r; }) }));
  assert.equal(app.detect.image, undefined, "the read shows first");
  resolveView(image); await new Promise((r) => setTimeout(r, 0));
  assert.equal(app.detect.image, image);
  await app.close();
  assert.equal(closed, 1);
});

test("split: the part of an area inside a drawn loop becomes a new area with the same floor and settings, and undo joins them", async () => {
  const { App } = waterApp();
  const notes = [];
  const W = 60, H = 40, pixels = [];
  for (let y = 5; y < 35; y++) for (let x = 0; x < 60; x++) pixels.push(y * W + x); // a river across the map
  const river = { ...mergeAreaProposals([{ id: "area-1", pixels: Int32Array.from(pixels) }], W, H), id: "area-1", floor: "water", preselected: true };
  const { app } = await openFloorRegions(opening({ Application: App, scene: fakeScene(), notify: (m) => notes.push(m),
    load: async () => ({ ok: true, rgba: new Uint8Array(W * H * 4), width: W, height: H }), detect: () => ({ proposals: [river] }) }));
  app.setMode({ kind: "split", areaId: "area-1" });
  assert.equal(app.splitArea("area-1", [40, 0, 60, 0, 60, 40, 40, 40]), true, "a loop around the river's east end");
  const [rest, fall] = app.detect.proposals;
  assert.equal(rest.id, "area-1");
  assert.equal(rest.pixels.length, 40 * 30, "the original keeps the rest");
  assert.equal(rest.geometryChanged, true);
  assert.equal(rest.exclusions.length, 1, "the split part is remembered as cut from it");
  assert.equal(fall.id, "area-2");
  assert.equal(fall.pixels.length, 20 * 30);
  assert.equal(fall.floor, "water");
  assert.equal(fall.regionId, undefined, "a new region, not the original's");
  assert.equal(app.mode.kind, "inspect");
  assert.match(notes.at(-1), /Split off as Area 2/);
  assert.equal(app.splitArea("area-1", [-5, -5, 70, -5, 70, 50, -5, 50]), false, "all of an area cannot be split off");
  assert.match(notes.at(-1), /all of Area 1/);
  assert.equal(app.splitArea("area-1", [0, 36, 10, 36, 10, 39]), false, "a loop off the area");
  app.undoAdd();
  assert.equal(app.detect.proposals.length, 1);
  assert.equal(app.detect.proposals[0].pixels.length, 60 * 30, "undo: one river again");
  await app.close();
});

test("a part cut out of an area stays out of later selections of that floor, until a click on it puts it back", async () => {
  const { App, listeners, shared } = waterApp();
  const log = { loads: 0, reads: [], marks: [] }, notes = [];
  const { app } = await openFloorRegions(smartOpening(App, log, { notify: (m) => notes.push(m) }));
  shared.selection.value = "smart";
  shared.addFloor.value = "grass";
  const key = async (k) => { for (const fn of listeners.keydown) fn({ key: k, target: { closest: () => null }, preventDefault() {}, stopPropagation() {} }); await new Promise((r) => setTimeout(r, 0)); };
  await app.smartMark({ at: { x: 30, y: 20 } });
  await key("3"); // Area 1: 24 x 24 around (30, 20)
  assert.equal(app.detect.proposals[0].floor, "grass", "a resize keeps the floor");
  app.areaFloor = (area) => area.floor; // the fake rows carry no floor; a real row shows the area's
  await app.smartMark({ remove: { x: 30, y: 20 } }); // cut the small square (8 x 8 with its rim)
  assert.equal(app.detect.proposals[0].pixels.length, 24 * 24 - 64);
  assert.equal(app.excluded.grass.length, 1, "the cut is remembered for grass, as one piece");
  assert.equal(app.excluded.grass[0].length, 64);
  app.undoAdd();
  assert.ok(!app.excluded.grass?.length, "undoing the cut brings the part back");
  await app.smartMark({ remove: { x: 30, y: 20 } });
  assert.equal(app.isExcluded("grass", { x: 30, y: 20 }), true);
  assert.equal(app.isExcluded("stone", { x: 30, y: 20 }), false, "only for grass");
  app.removeRow("area-1"); // the area goes, its cut stays out
  await app.smartMark({ at: { x: 25, y: 20 } });
  const again = app.detect.proposals.at(-1);
  assert.equal(app.detect.proposals.length, 1, "a new grass area");
  assert.equal(again.pixels.length, 14 * 14 - 6 * 8, "the middle square without the part that was cut");
  assert.ok(!again.pixels.some((p) => app.excluded.grass[0].includes(p)), "it leaves the cut part out");
  assert.ok(!app.claimedFor(null, "stone").some((c) => c.pixels === app.excluded.grass[0]), "stone may still take it");
  // A click right on the piece puts it back, into the grass area it touches.
  const piece = app.excludedPieceAt("grass", { x: 30, y: 20 });
  assert.equal(app.putBack("grass", piece, null), true);
  assert.equal(app.detect.proposals.length, 1, "into the touching area, not a new one");
  assert.equal(app.detect.proposals[0].pixels.length, 14 * 14 - 6 * 8 + 64, "the whole piece is back");
  assert.equal(app.excluded.grass.length, 0, "and no longer kept out");
  assert.match(notes.at(-1), /Put back/);
  await app.close();
});
