import test from "node:test";
import assert from "node:assert/strict";

// That the break is drawn at all. The shapes are pure and tested on their own; this asks main.mjs itself whether they ever
// reach the screen — whether a region with a hole really hands a water spec to the moving water, whether the cracked
// squares really reach the crack painter, and whether the shards really drift on the shared clock. The feature before this
// one in the series shipped silently dead with every test passing, because nothing crossed this seam. Nothing here reads
// main.mjs's source text: every assertion is a drawing call recorded on the canvas, or what the module says it handed over.

const later = [];
const realTimeout = globalThis.setTimeout;
globalThis.setTimeout = (fn) => { later.push(fn); return later.length; };
// Everything main.mjs put off until later, run now: the floor's own redraw is debounced, and that redraw is the seam.
const drawSoon = () => { for (const fn of later.splice(0)) { try { fn(); } catch { /* another engine's redraw on a canvas this thin */ } } };

const GRID = 100;
const hooks = new Map();
globalThis.Hooks = { on(name, fn) { hooks.set(name, [...(hooks.get(name) ?? []), fn]); }, once(name, fn) { this.on(name, fn); }, callAll() {}, call() {} };
const fire = (name, ...args) => { for (const fn of hooks.get(name) ?? []) { try { fn(...args); } catch { /* an init step this canvas cannot serve */ } } };
class FakeApp { async render() { return this; } async close() {} }
globalThis.foundry = {
  applications: { api: { ApplicationV2: FakeApp, HandlebarsApplicationMixin: (Base) => class extends Base {}, DialogV2: { confirm: async () => true } } },
  data: { operators: { ForcedDeletion: class ForcedDeletion {} } },
};
globalThis.window = globalThis;
// Enough of a 2d canvas for the other floor painters to build their own one-pixel textures beside this one: without it
// the water engine throws before the thin ice is ever asked to paint, which would make this test about the wrong thing.
const context2d = () => new Proxy({}, { get: (_t, key) => (key === "createLinearGradient" || key === "createRadialGradient" ? () => ({ addColorStop() {} }) : key === "getImageData" ? () => ({ data: new Uint8ClampedArray(4) }) : key === "canvas" ? undefined : () => {}) });
globalThis.ImageData = class ImageData { constructor(data, width, height) { this.data = data; this.width = width; this.height = height; } };
globalThis.document = { addEventListener() {}, createElement: (tag) => (String(tag).toLowerCase() === "canvas" ? { width: 0, height: 0, style: {}, getContext: context2d } : { style: {} }), head: { appendChild() {} } };
globalThis.ui = { notifications: { info() {}, warn() {} } };
globalThis.ChatMessage = { create: async () => ({}) };

// The canvas records what is drawn on it, so a painter that is never asked to paint is visible as silence.
const drew = [];
class Point { constructor(x = 0, y = 0) { this.x = x; this.y = y; } set(x = 0, y = x) { this.x = x; this.y = y; return this; } copyFrom(p) { return this.set(p?.x ?? 0, p?.y ?? 0); } }
class Container {
  constructor() { this.children = []; this.parent = null; this.destroyed = false; this.visible = true; this.renderable = true; this.alpha = 1; this.tint = 0xffffff; this.position = new Point(); this.scale = new Point(1, 1); this.pivot = new Point(); this.filters = null; this.mask = null; this.eventMode = "none"; this.zIndex = 0; this.width = 0; this.height = 0; this.worldAlpha = 1; }
  addChild(child) { child.parent = this; this.children.push(child); return child; }
  removeChild(child) { this.children = this.children.filter((c) => c !== child); return child; }
  removeChildren() { const was = this.children; this.children = []; return was; }
  destroy() { this.destroyed = true; }
  updateTransform() {}
  getBounds() { return { x: 0, y: 0, width: 0, height: 0 }; }
  get sortableChildren() { return true; } set sortableChildren(_v) {}
}
class Graphics extends Container {
  clear() { return this; } lineStyle() { return this; } beginFill() { return this; } endFill() { return this; }
  moveTo(x, y) { drew.push(["moveTo", this, x, y]); return this; }
  lineTo(x, y) { drew.push(["lineTo", this, x, y]); return this; }
  drawPolygon(pts) { drew.push(["drawPolygon", this, pts]); return this; }
  closePath() { return this; } drawCircle() { return this; } drawEllipse() { return this; } drawRect() { return this; } drawRoundedRect() { return this; }
  arc() { return this; } quadraticCurveTo() { return this; } bezierCurveTo() { return this; } beginHole() { return this; } endHole() { return this; }
}
// The bed a hole of water is drawn over is a one-pixel texture; the water engine itself never runs on a canvas this thin.
class BaseTexture { constructor(source) { this.destroyed = false; this.resource = { source }; this.width = 1; this.height = 1; } }
class Texture { constructor(base) { this.baseTexture = base ?? new BaseTexture(); this.valid = true; } static fromBuffer() { return new Texture(); } static from() { return new Texture(); } }
Texture.WHITE = new Texture(); Texture.EMPTY = new Texture();
globalThis.PIXI = { UPDATE_PRIORITY: { NORMAL: 0, LOW: -1 }, Container, Graphics, Point, Texture, BaseTexture, SCALE_MODES: { LINEAR: 1, NEAREST: 0 }, WRAP_MODES: { CLAMP: 33071, REPEAT: 10497 } };
globalThis.game = {
  user: { isGM: true, isActiveGM: true, id: "gm1" },
  users: Object.assign([{ id: "gm1", isGM: true }], { activeGM: { isSelf: true } }),
  // Everything this feature draws waits on the screen's quality level: the moving water a hole is made of needs the full one.
  settings: { get: (_module, key) => (key === "quality" ? "full" : undefined), set: () => {} },
  time: { serverTime: 0, worldTime: 0 },
  modules: { get: () => animater, keys: () => [] },
  system: { id: "pf2e" },
  audio: {},
  socket: { emit() {}, on() {} },
};
globalThis.CONFIG = { Canvas: { polygonBackends: { sound: { create: () => null } } }, Token: { movement: { actions: {} } } };
// Sequencer, if the table has it, is asked to clean up after itself when a map goes; nothing here uses what it would do.
const anything = () => new Proxy(function stub() {}, { get: (_t, key) => (key === "then" ? undefined : anything()), apply: () => [] });
globalThis.Sequencer = anything();
globalThis.CONST = { GRID_TYPES: { GRIDLESS: 0, SQUARE: 1 }, TOKEN_DISPOSITIONS: {}, DOCUMENT_OWNERSHIP_LEVELS: {} };

const animater = { api: null };
const ticks = [];
let level = 0;
const scene = { id: "scene1", regions: [], flags: {}, async updateEmbeddedDocuments() { return []; } };
globalThis.canvas = {
  ready: true, scene,
  grid: { size: GRID },
  level: { id: "level0", elevation: { base: 0 } },
  dimensions: { sceneRect: { x: 0, y: 0, width: 2000, height: 2000 }, rect: { x: 0, y: 0, width: 2000, height: 2000 }, distance: 5 },
  tokens: { placeables: [], controlled: [], get: () => null },
  walls: { placeables: [] }, tiles: { placeables: [] }, primary: new Container(), stage: { pivot: new Point(), scale: new Point(1, 1) },
  app: { ticker: { add: (fn) => ticks.push(fn) }, renderer: { width: 2000, height: 2000, resolution: 1, screen: { x: 0, y: 0, width: 2000, height: 2000 } } },
};

await import("../../scripts/main.mjs");
fire("ready");
fire("canvasReady");
const api = animater.api;
assert.ok(api?.debug?.iceDrawn, "main.mjs is booted far enough to say what thin ice gave the screen");

// The water engine cannot build a mesh on a PIXI this thin and says so, once per hole per redraw. That is not what this
// test is about, and the specs it was handed are counted before it tries.
const realWarn = console.warn;
console.warn = (...said) => { if (!String(said[0] ?? "").includes("moving water")) realWarn(...said); };

const frame = () => { for (const fn of ticks) { try { fn(); } catch { /* another engine's frame on a canvas this thin */ } } };
// A fresh map: the regions on it, and a level nobody has read yet, then the floor's own redraw run through.
const show = (regions) => {
  scene.regions = regions;
  canvas.level = { id: `level${++level}`, elevation: { base: 0 } };
  drew.length = 0;
  fire("canvasReady");
  drawSoon();
};
const iceRegion = (thinIce, { thin = true } = {}) => ({
  id: "reg1", parent: scene, name: "Frozen lake",
  flags: { animater: { floor: "water", iceThin: thin, iceHolds: "med", thinIce } },
  testPoint: () => true, shapes: [], elevation: { bottom: 0, top: 0 }, levels: [],
});

test("a region with a hole hands the moving water a spec of its own", () => {
  show([iceRegion({ holes: { "3,4": 2 } })]);
  assert.equal(api.debug.iceDrawn().holes, 1, "the hole reached the water engine");
  show([iceRegion({ holes: { "3,4": 2, "0,0": 1 } })]);
  assert.equal(api.debug.iceDrawn().holes, 2);
  show([iceRegion({})]);
  assert.equal(api.debug.iceDrawn().holes, 0, "ice with nothing broken in it asks for no water");
  show([iceRegion({ holes: { "3,4": 2 } }, { thin: false })]);
  assert.equal(api.debug.iceDrawn().holes, 0, "and a region the GM never marked contributes nothing");
});

test("a cracked square reaches the crack painter, and lines are really drawn for it", () => {
  show([iceRegion({ cracks: { "1,1": 1, "1,2": 1 } })]);
  assert.equal(api.debug.iceDrawn().cracks, 2, "both cracked squares were handed over");
  const lines = drew.filter(([what]) => what === "lineTo");
  assert.ok(lines.length >= 8, `the crack painter drew them: ${lines.length} line segments`);
  // Every one of them inside the two squares that cracked, which no other painter on this canvas would be.
  for (const [, , x, y] of lines) assert.ok(x >= 100 && x <= 200 && y >= 100 && y <= 300, `a crack at ${x},${y}`);
  show([iceRegion({})]);
  assert.equal(api.debug.iceDrawn().cracks, 0);
  assert.equal(drew.filter(([what]) => what === "lineTo").length, 0, "and nothing is painted on ice that never cracked");
});

test("the plates of a broken sheet ride the water on the shared clock, frame by frame", () => {
  show([iceRegion({ holes: { "3,4": 2 } })]);
  assert.ok(api.debug.iceDrawn().plates > 0, "the sheet was handed over in plates");
  game.time.serverTime = 0;
  drew.length = 0;
  frame();
  const first = drew.filter(([what]) => what === "drawPolygon").map(([, , pts]) => pts.join(","));
  assert.ok(first.length > 0, "the plates are painted on a frame");
  game.time.serverTime = 4000;
  drew.length = 0;
  frame();
  const later_ = drew.filter(([what]) => what === "drawPolygon").map(([, , pts]) => pts.join(","));
  assert.equal(later_.length, first.length, "the same plates");
  assert.notDeepEqual(later_, first, "in another place: they ride the water on the clock every screen shares");
});

test("a break is drawn as a few big plates, not as a scatter of chips", () => {
  show([iceRegion({ holes: { "3,4": 2 } })]);
  const drawn = api.debug.iceDrawn();
  assert.ok(drawn.plates >= 3 && drawn.plates <= 12, `slabs you can count: ${drawn.plates}`);
  assert.equal(drawn.shards, 0, "a break leaves no loose chips: that is what a fire melt leaves");
});

test("what a fire melted leaves slush round its rim, not plates", () => {
  show([iceRegion({ holes: { "3,4": "melt" } })]);
  const drawn = api.debug.iceDrawn();
  assert.ok(drawn.shards > 0, "slush");
  assert.equal(drawn.plates, 0, "nothing broke: the fire ate it");
});

test("the break is painted again after the map is put away and brought back", () => {
  // The painter's Graphics belongs to the map it was made on: a scene switch destroys it, and the same stored state
  // handed over again must draw it afresh rather than be waved through as already drawn.
  show([iceRegion({ cracks: { "1,1": 1 } })]);
  assert.ok(drew.some(([what]) => what === "lineTo"), "painted the first time");
  fire("canvasTearDown");
  canvas.primary = new Container();
  show([iceRegion({ cracks: { "1,1": 1 } })]);
  assert.ok(drew.some(([what]) => what === "lineTo"), "and painted again on the map that came back, with nothing stored changed");
});

test("with the moving water running, the hole is left to it: its ripples belong in the hole, not under a flat fill", () => {
  show([iceRegion({ holes: { "3,4": 2 } })]);
  const drawn = api.debug.iceDrawn();
  assert.ok(drawn.holes > 0, "the hole goes to the moving water as its own spec");
  assert.equal(drawn.water, 0, "and this layer paints none of its own over it: it sits above the engine and would hide it");
  assert.ok(drawn.plates > 0, "the broken sheet is still drawn here, over the engine’s water");
});


test("the ice is drawn even where the screen draws no moving water at all", () => {
  // Moving water off, or a quality too low for it: a creature standing in open water must still read as standing in it.
  const was = game.settings.get;
  try {
    game.settings.get = (module, key) => (key === "movingWater" || key === "movingWaterLocal" ? false : was(module, key));
    show([iceRegion({ holes: { "3,4": 2 } })]);
    const drawn = api.debug.iceDrawn();
    assert.ok(drawn.plates > 0, "the broken sheet is still handed to the painter");
    assert.ok(drawn.water > 0, "and so is the water it floats on: neither waits on the moving water setting");
  } finally { game.settings.get = was; }
});
