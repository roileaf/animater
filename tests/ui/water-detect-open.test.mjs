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
globalThis.game = { user: { isGM: true }, settings: { get: (_module, key) => key === "experimentalWaterRegions" } };
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

test("a scene switch during the first click's module load still writes to the scene clicked on", async () => {
  const controls = { regions: { name: "regions", tools: {} } };
  for (const fn of hooks.get("getSceneControlButtons")) fn(controls);
  const sceneA = makeScene("A"), sceneB = makeScene("B");
  globalThis.canvas = viewing(sceneA, "level-A", 200);
  controls.regions.tools.animaterDetectWater.onChange();
  globalThis.canvas = viewing(sceneB, "level-B", 800, { scaleX: 2 });
  await new Promise((resolve) => setTimeout(resolve, 80));
  assert.ok(renderedApp, "a moved level B map would have refused to open");
  renderedApp.element = {
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
