import test from "node:test";
import assert from "node:assert/strict";

// What a hole in the thin ice does to the creature in it, asked of main.mjs itself: the floor underfoot (its own
// movementFeelFloor, which the footsteps, the movement feel and the swim out of the water all read), and the token drawn
// sunk in the water (the underwater look, through the sink that runs each frame). Nothing here reads main.mjs's source.
//
// Foundry's own deferred drawing is not wanted on a canvas this thin: setTimeout is collected and dropped, so none of the
// module's debounced redraws ever runs a frame here.
const later = [];
const realTimeout = globalThis.setTimeout;
globalThis.setTimeout = (fn) => { later.push(fn); return later.length; };

const GRID = 100;
const hooks = new Map();
globalThis.Hooks = { on(name, fn) { hooks.set(name, [...(hooks.get(name) ?? []), fn]); }, once(name, fn) { this.on(name, fn); }, callAll() {}, call() {} };
class FakeApp { async render() { return this; } async close() {} }
globalThis.foundry = {
  applications: { api: { ApplicationV2: FakeApp, HandlebarsApplicationMixin: (Base) => class extends Base {}, DialogV2: { confirm: async () => true } } },
  data: { operators: { ForcedDeletion: class ForcedDeletion {} } },
};
globalThis.window = globalThis;
globalThis.document = { addEventListener() {}, createElement: () => ({ style: {} }), head: { appendChild() {} } };
globalThis.ui = { notifications: { info() {}, warn() {} } };
globalThis.ChatMessage = { create: async () => ({}) };
// Enough of PIXI for the other engines' own frames to run quietly beside this one: they draw into a container nobody looks at.
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
  moveTo() { return this; } lineTo() { return this; } closePath() { return this; } drawPolygon() { return this; }
  drawCircle() { return this; } drawEllipse() { return this; } drawRect() { return this; } drawRoundedRect() { return this; }
  arc() { return this; } quadraticCurveTo() { return this; } bezierCurveTo() { return this; } beginHole() { return this; } endHole() { return this; }
}
globalThis.PIXI = { UPDATE_PRIORITY: { NORMAL: 0, LOW: -1 }, Container, Graphics, Point };
const settings = new Map();
// A setting written announces itself, as Foundry's does, so main.mjs reads it afresh.
const setSetting = (key, value) => {
  if (value === undefined) settings.delete(key); else settings.set(key, value);
  for (const hook of ["clientSettingChanged", "updateSetting"]) for (const fn of hooks.get(hook) ?? []) { try { fn(`animater.${key}`, value, {}); } catch { /* another listener's business */ } }
};
const animater = { api: null };
globalThis.game = {
  user: { isGM: true, isActiveGM: true, id: "gm1" },
  users: [{ id: "gm1", isGM: true }],
  settings: { get: (_module, key) => settings.get(key), set: (_module, key, value) => settings.set(key, value) },
  time: { serverTime: 0, worldTime: 0 },
  modules: { get: () => animater, keys: () => [] },
  system: { id: "pf2e" },
  audio: {},
};
globalThis.CONFIG = { Canvas: { polygonBackends: { sound: { create: () => null } } }, Token: { movement: { actions: {} } } };

// One canvas, kept across the tests so the frame ticker is installed once; the level's name changes with each scene set
// up, which is what tells the floor cache and the sink to look again.
const ticks = [];
let level = 0;
const scene = { id: "scene1", regions: [], flags: {} };
const tokens = [];
globalThis.canvas = {
  ready: true, scene,
  grid: { size: GRID },
  level: { id: "level0", elevation: { base: 0 } },
  dimensions: { sceneRect: { x: 0, y: 0, width: 1000, height: 1000 }, rect: { x: 0, y: 0, width: 1000, height: 1000 }, distance: 5 },
  tokens: { placeables: tokens, controlled: [], get: (id) => tokens.find((t) => t.document.id === id) ?? null },
  walls: { placeables: [] }, tiles: { placeables: [] }, primary: new Container(), stage: { pivot: new Point(), scale: new Point(1, 1) },
  app: { ticker: { add: (fn) => ticks.push(fn) }, renderer: {} },
};

await import("../../scripts/main.mjs");
for (const fn of hooks.get("ready") ?? []) { try { fn(); } catch { /* an init step this canvas cannot serve */ } }
for (const fn of hooks.get("canvasReady") ?? []) { try { fn(); } catch { /* likewise */ } }
const api = animater.api;
assert.ok(api?.debug?.floorAt, "main.mjs is booted far enough to ask it about the floor");
assert.ok(ticks.length, "and to run a frame");

// One frame. The other engines' tickers have no renderer to draw with here; what this feature does is read back from the
// token's own mesh, so their frame failing is not this test's business.
const frame = () => { for (const fn of ticks) { try { fn(); } catch { /* another engine's frame on a canvas this thin */ } } };

const iceRegion = (holes, { holds = "med", thin = true } = {}) => ({
  id: "reg1", parent: scene,
  flags: { animater: { iceThin: thin, iceHolds: holds, thinIce: { holes } } },
  testPoint: () => true,
});

// A token with a mesh to be drawn on: Foundry writes its alpha, scale and tint, and the underwater look multiplies into them.
const mesh = () => ({ alpha: 1, tint: 0xffffff, destroyed: false, scale: { x: 1, y: 1, set(x, y) { this.x = x; this.y = y; } } });
let nextToken = 0;
const standing = ({ at, action = "walk", elevation = 0 } = {}) => {
  const id = `tok${++nextToken}`;
  const token = {
    id, isPreview: false, isOwner: true, visible: true, center: { ...at }, mesh: mesh(),
    document: { id, name: "Torvald", elevation, width: 1, height: 1, movementAction: action, actor: null, getCenterPoint: () => ({ ...at }) },
    renderFlags: { set() {} },
  };
  return token;
};

// A fresh scene: the region's holes, the tokens on it, and a level nobody has read yet.
const setUp = (regions, placeables) => {
  scene.regions = regions;
  tokens.length = 0;
  tokens.push(...placeables);
  canvas.level = { id: `level${++level}`, elevation: { base: 0 } };
};

const inHole = { x: 350, y: 450 }, onIce = { x: 50, y: 50 };

test("the floor in a hole in the ice is open water, and the ice beside it is not", () => {
  const token = standing({ at: inHole });
  setUp([iceRegion({ "3,4": 2 })], [token]);
  assert.equal(api.debug.floorAt(inHole, token.document), "water");
  assert.notEqual(api.debug.floorAt(onIce, token.document), "water", "the square next door still holds");
});

test("a region with no hole in it, and one the GM never marked as thin ice, leave the floor alone", () => {
  const token = standing({ at: inHole });
  setUp([iceRegion({})], [token]);
  assert.notEqual(api.debug.floorAt(inHole, token.document), "water");
  setUp([iceRegion({ "3,4": 2 }, { thin: false })], [token]);
  assert.notEqual(api.debug.floorAt(inHole, token.document), "water");
});

test("a creature standing in the hole is drawn sunk in the water, without its elevation ever changing", () => {
  const token = standing({ at: inHole });
  setUp([iceRegion({ "3,4": 2 })], [token]);
  frame();
  assert.ok(token.mesh.alpha < 1, `it is drawn into the water (alpha ${token.mesh.alpha})`);
  assert.notEqual(token.mesh.tint, 0xffffff, "and the water's colour is over it");
  assert.equal(token.document.elevation, 0, "nothing moved it below the floor");
  assert.equal(api.debug.sinkState().tints, 1);
});

test("a creature on the ice beside the hole is drawn as it is", () => {
  const token = standing({ at: onIce });
  setUp([iceRegion({ "3,4": 2 })], [token]);
  frame();
  assert.equal(token.mesh.alpha, 1);
  assert.equal(token.mesh.tint, 0xffffff);
});

test("a flier over the hole, and a burrower under it, are not in the water", () => {
  for (const action of ["fly", "burrow", "displace"]) {
    const token = standing({ at: inHole, action });
    setUp([iceRegion({ "3,4": 2 })], [token]);
    frame();
    assert.equal(token.mesh.alpha, 1, `${action} over the hole`);
    assert.equal(token.mesh.tint, 0xffffff, action);
  }
});

test("a GM who has turned the submerged look off does not get it back through the ice", () => {
  setSetting("underwaterLooks", false);
  try {
    const token = standing({ at: inHole });
    setUp([iceRegion({ "3,4": 2 })], [token]);
    frame();
    assert.equal(token.mesh.alpha, 1);
    assert.equal(token.mesh.tint, 0xffffff);
  } finally { setSetting("underwaterLooks", undefined); }
});

test("a creature that climbs out of the hole rises back out of the water", async () => {
  const token = standing({ at: inHole });
  setUp([iceRegion({ "3,4": 2 })], [token]);
  frame();
  assert.ok(token.mesh.alpha < 1, "in the water first");
  token.center = { ...onIce };
  token.document.getCenterPoint = () => ({ ...onIce });
  setUp([iceRegion({ "3,4": 2 })], [token]);
  frame();
  assert.deepEqual(api.debug.sinkState().moving, [token.document.id], "it is on its way back up");
  // The rise takes its own time, as the sink does; after it, the token's own alpha and colour are back.
  await new Promise((resolve) => realTimeout(resolve, 520));
  frame();
  assert.equal(token.mesh.alpha, 1, "out of the water, its own alpha back");
  assert.equal(token.mesh.tint, 0xffffff);
});
