import { test } from "node:test";
import assert from "node:assert/strict";

const hooks = new Map();
globalThis.Hooks = { on(name, fn) { hooks.set(name, [...(hooks.get(name) ?? []), fn]); }, once() {}, callAll() {} };

let renderedApp = null;
class FakeApp {
  async render() { renderedApp = this; return this; }
  async close() {}
}
globalThis.foundry = { applications: { api: { ApplicationV2: FakeApp, HandlebarsApplicationMixin: (Base) => class extends Base {}, DialogV2: { confirm: async () => true } } } };
globalThis.window = globalThis;
globalThis.document = { addEventListener() {}, createElement: () => ({ style: {} }), head: { appendChild() {} } };
globalThis.ui = { notifications: { info() {}, warn() {} } };
const settings = new Map([["experimentalWaterRegions", true], ["toolDetectWater", true]]);
globalThis.game = { user: { isGM: true }, settings: { get: (_module, key) => settings.has(key) ? settings.get(key) : undefined } };
globalThis.fetch = async () => ({ ok: true, blob: async () => ({ type: "image/png" }) });
globalThis.createImageBitmap = async (_blob, size) => ({ width: size.resizeWidth, height: size.resizeHeight, close() {} });
globalThis.OffscreenCanvas = class {
  getContext() {
    return {
      drawImage() {},
      getImageData: (_x, _y, w, h) => ({ data: Uint8ClampedArray.from({ length: w * h * 4 }, (_, i) => [20, 140, 210, 255][i % 4]) }),
    };
  }
};

await import("../../scripts/main.mjs");

const makeScene = (id) => ({
  id,
  regions: { contents: [] },
  writes: [],
  async createEmbeddedDocuments(_type, data) { this.writes.push(...data); },
  async deleteEmbeddedDocuments() {},
});
const viewing = (scene, levelId, size, textures = {}) => ({
  ready: true,
  scene,
  level: { id: levelId, background: { src: `maps/${scene.id}.png` }, textures },
  dimensions: { sceneRect: { x: 0, y: 0, width: size, height: size } },
});
const buildControls = () => {
  const controls = { regions: { name: "regions", tools: {} } };
  for (const fn of hooks.get("getSceneControlButtons")) fn(controls);
  return controls;
};

test("Detect water sits in the Animater group only while the experimental setting and tool toggle allow it", () => {
  settings.set("experimentalWaterRegions", true);
  settings.set("toolDetectWater", true);
  let controls = buildControls();
  assert.ok(controls.animater?.tools?.animaterDetectWater);
  assert.equal(controls.animater.tools.animaterDetectWater.visible, true);
  assert.equal(controls.animater.tools.animaterDetectWater.button, true);
  assert.equal(controls.regions.tools.animaterDetectWater, undefined);

  settings.set("experimentalWaterRegions", false);
  controls = buildControls();
  assert.equal(controls.animater.tools.animaterDetectWater.visible, false);
  assert.equal(controls.regions.tools.animaterDetectWater, undefined);

  settings.set("experimentalWaterRegions", true);
  settings.set("toolDetectWater", false);
  controls = buildControls();
  assert.equal(controls.animater.tools.animaterDetectWater.visible, false);
  settings.set("toolDetectWater", true);
});

test("a scene switch during the first click's module load still writes to the scene clicked on", async () => {
  settings.set("experimentalWaterRegions", true);
  settings.set("toolDetectWater", true);
  const controls = buildControls();
  const sceneA = makeScene("A"), sceneB = makeScene("B");
  globalThis.canvas = viewing(sceneA, "level-A", 200);
  controls.animater.tools.animaterDetectWater.onChange();
  globalThis.canvas = viewing(sceneB, "level-B", 800, { scaleX: 2 });
  await new Promise((resolve) => setTimeout(resolve, 80));
  assert.ok(renderedApp, "a moved level B map would have refused to open");
  renderedApp.element = {
    querySelector: () => null,
    querySelectorAll: (selector) => (selector === "[data-id]" ? [{
      dataset: { id: "water-1" },
      querySelector: (inner) => (inner === "[data-pick]" ? { checked: true } : { value: "" }),
    }] : []),
  };
  await renderedApp.create();
  assert.equal(sceneA.writes.length, 1);
  assert.equal(sceneB.writes.length, 0);
  assert.deepEqual(sceneA.writes[0].levels, ["level-A"]);
});
