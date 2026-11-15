import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";

// That the break is HEARD and SEEN at all. The choice of recordings is pure and tested on its own; this asks main.mjs itself whether
// a hole that appears ever reaches the audio, with the right files, at the right place, and whether a map that was already
// broken stays silent. Nothing here reads main.mjs's source text: every assertion is a playback call the fake canvas recorded.
// (Originally: The shapes are pure and tested on their own; this asks main.mjs itself whether they ever
// reach the screen — whether a region with a hole really hands a water spec to the moving water, whether the cracked
// squares really reach the crack painter, and whether the shards really drift on the shared clock. The feature before this
// one in the series shipped silently dead with every test passing, because nothing crossed this seam. Nothing here reads
// main.mjs's source text: every assertion is a drawing call recorded on the canvas, or what the module says it handed over.)

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
const played = [];
const said = [];
let level = 0;
const scene = { id: "scene1", regions: [], flags: {}, async updateEmbeddedDocuments() { return []; } };
globalThis.canvas = {
  ready: true, scene,
  grid: { size: GRID },
  level: { id: "level0", elevation: { base: 0 } },
  dimensions: { sceneRect: { x: 0, y: 0, width: 2000, height: 2000 }, rect: { x: 0, y: 0, width: 2000, height: 2000 }, distance: 5 },
  tokens: { placeables: [], controlled: [], get: () => null },
  interface: { createScrollingText: (at, text, opts) => { said.push({ at: { ...at }, text, ...opts }); } },
  sounds: { getListenerPositions: () => [], playAtPosition: (file, at, radius, opts) => { played.push({ file, at: { ...at }, radius, ...opts }); return null; } },
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


const sounds = () => played.map((p) => p.file.split("/").pop());
const clear = () => { played.length = 0; said.length = 0; };
const words = () => said.map((w) => w.text);

test("a creature going through the ice is heard: the ice, then the water under it", () => {
  show([iceRegion({})]);
  clear();
  show([iceRegion({ holes: { "3,4": 2 } })]);
  assert.equal(sounds().length, 1, "the ice itself is heard the moment the hole appears");
  assert.match(sounds()[0], /^ice-break-/);
  drawSoon();
  assert.equal(sounds().length, 2, "and the splash follows it");
  assert.match(sounds()[1], /^body-splash-/);
});

test("it is heard where it broke, not at the corner of the map", () => {
  show([iceRegion({})]);
  clear();
  show([iceRegion({ holes: { "3,4": 2 } })]);
  assert.deepEqual(played[0].at, { x: 3.5 * GRID, y: 4.5 * GRID }, "the middle of the square that gave way");
  assert.ok(played[0].radius > 0, "and it carries only so far");
  assert.equal(played[0].walls, true, "a wall between muffles it");
});

test("coming to a map whose ice is already broken is silent", () => {
  drawSoon();               // let any splash an earlier test left waiting land first
  fire("canvasTearDown");   // this screen leaves the map and comes back to it, which is also what a reload is
  clear();
  show([iceRegion({ holes: { "3,4": 2, "5,6": 1 } })]);
  assert.deepEqual(sounds(), [], "nothing fell through just now: this screen only arrived");
  drawSoon();
  assert.deepEqual(sounds(), []);
});

test("a hole is heard once, not again on every redraw", () => {
  show([iceRegion({})]);
  clear();
  show([iceRegion({ holes: { "3,4": 2 } })]);
  drawSoon();
  const after = sounds().length;
  show([iceRegion({ holes: { "3,4": 2 } })]);
  drawSoon();
  assert.equal(sounds().length, after, "the same hole redrawn says nothing");
});

test("a hole the fire melted open is not someone falling in, and is silent", () => {
  show([iceRegion({})]);
  clear();
  show([iceRegion({ holes: { "3,4": "melt" } })]);
  drawSoon();
  assert.deepEqual(sounds(), [], "the fireball ate the ice; nobody went in");
});

test("ice frozen over again can break again and be heard again", () => {
  show([iceRegion({})]);
  clear();
  show([iceRegion({ holes: { "3,4": 2 } })]);
  drawSoon();
  const first = sounds().length;
  show([iceRegion({})]);                      // Refreeze
  drawSoon();
  assert.equal(sounds().length, first, "freezing it over is not itself a break");
  show([iceRegion({ holes: { "3,4": 2 } })]);
  drawSoon();
  assert.equal(sounds().length, first * 2, "the next creature through is heard");
});

test("a region the GM never marked as thin ice is never heard", () => {
  show([iceRegion({})]);
  clear();
  show([iceRegion({ holes: { "3,4": 2 } }, { thin: false })]);
  drawSoon();
  assert.deepEqual(sounds(), [], "no thin ice, no break");
});

test("every file it asks the audio for is one Animater ships", () => {
  show([iceRegion({})]);
  clear();
  for (const key of ["3,4", "7,8", "-2,5", "11,1", "0,0", "6,6"]) show([iceRegion({ holes: { [key]: 2 } })]);
  drawSoon();
  assert.ok(played.length >= 6, `something was played: ${played.length}`);
  for (const p of played) {
    assert.ok(p.file.startsWith("modules/animater/assets/sounds/surfaces/freesound/"), p.file);
    assert.ok(existsSync(new URL("../../assets/sounds/surfaces/freesound/" + p.file.split("/").pop(), import.meta.url)), p.file + " is not on disk");
  }
});

test("a cracked square says CRACK! on the map, where everyone can see it", () => {
  show([iceRegion({})]);
  clear();
  show([iceRegion({ cracks: { "1,1": 1 } })]);
  assert.deepEqual(words(), ["CRACK!"], "the crack is the one thing with no sound: it has to be seen");
  assert.deepEqual(said[0].at, { x: 1.5 * GRID, y: 1.5 * GRID }, "over the square that cracked");
  assert.ok(said[0].duration > 0 && said[0].fontSize > 0);
});

test("going through says so too, and is not also announced as a crack", () => {
  show([iceRegion({})]);
  clear();
  show([iceRegion({ cracks: { "2,2": 1 }, holes: { "2,2": 2 } })]);
  assert.deepEqual(words(), ["THROUGH!"], "one square, one word");
});

test("a word appears once, not on every redraw", () => {
  show([iceRegion({})]);
  clear();
  show([iceRegion({ cracks: { "1,1": 1 } })]);
  show([iceRegion({ cracks: { "1,1": 1 } })]);
  assert.deepEqual(words(), ["CRACK!"]);
  show([iceRegion({ cracks: { "1,1": 1, "1,2": 1 } })]);
  assert.deepEqual(words(), ["CRACK!", "CRACK!"], "but the next square cracking is its own word");
});

test("coming to a map of already-cracked ice says nothing", () => {
  drawSoon();
  fire("canvasTearDown");
  clear();
  show([iceRegion({ cracks: { "1,1": 1, "3,3": 1 }, holes: { "5,5": 2 } })]);
  assert.deepEqual(words(), [], "none of it happened just now");
});

test("ice a fire melted open says nothing: nobody fell in", () => {
  show([iceRegion({})]);
  clear();
  show([iceRegion({ holes: { "4,4": "melt" } })]);
  assert.deepEqual(words(), []);
});

test("a region the GM never marked says nothing", () => {
  show([iceRegion({})]);
  clear();
  show([iceRegion({ cracks: { "1,1": 1 } }, { thin: false })]);
  assert.deepEqual(words(), []);
});
