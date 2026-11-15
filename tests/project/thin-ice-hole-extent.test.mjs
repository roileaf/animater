import test from "node:test";
import assert from "node:assert/strict";

// The hole the GM writes and the hole the floor reads are the same hole. One move, through main.mjs's own moveToken
// listener; what it wrote put back on the region, as Foundry would; then the floor asked at the creature's own centre and
// the creature looked at on a frame. Every footprint from Medium to Gargantuan, because the footprints an even number of
// squares across are the ones whose weight square and whose centre square are not the same square.
//
// Foundry's own deferred drawing is not wanted on a canvas this thin: setTimeout is collected and dropped.
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
globalThis.game = {
  user: { isGM: true, isActiveGM: true, id: "gm1" },
  users: Object.assign([{ id: "gm1", isGM: true }], { activeGM: { isSelf: true } }),
  settings: { get: () => undefined, set: () => {} },
  time: { serverTime: 0, worldTime: 0 },
  modules: { get: () => animater, keys: () => [] },
  system: { id: "pf2e" },
  audio: {},
};
globalThis.CONFIG = { Canvas: { polygonBackends: { sound: { create: () => null } } } , Token: { movement: { actions: {} } } };

const animater = { api: null };
const ticks = [];
let level = 0;
// One region, one scene: what the GM writes is merged back into the region's flags, which is what Foundry's own write does.
const region = { id: "reg1", flags: { animater: { iceThin: true, iceHolds: "med", thinIce: {} } }, testPoint: () => true };
const scene = {
  id: "scene1", regions: [region], flags: {},
  // Where a creature came to rest is read off the token document once the moving has stopped, so the scene has to hold it.
  tokens: { list: [], get(id) { return this.list.find((t) => t.id === id) ?? null; }, [Symbol.iterator]() { return this.list[Symbol.iterator](); }, get size() { return this.list.length; }, get contents() { return [...this.list]; }, filter(fn) { return this.list.filter(fn); }, map(fn) { return this.list.map(fn); }, find(fn) { return this.list.find(fn); }, forEach(fn) { this.list.forEach(fn); }, some(fn) { return this.list.some(fn); } },
  async updateEmbeddedDocuments(_type, updates) {
    for (const u of updates) for (const [path, value] of Object.entries(u)) {
      if (path === "_id") continue;
      const keys = path.split(".");
      let at = region;
      for (const key of keys.slice(0, -1)) at = at[key] ??= {};
      at[keys.at(-1)] = value;
    }
    return updates;
  },
};
region.parent = scene;
const tokens = [];
globalThis.canvas = {
  ready: true, scene,
  grid: { size: GRID },
  level: { id: "level0", elevation: { base: 0 } },
  dimensions: { sceneRect: { x: 0, y: 0, width: 2000, height: 2000 }, rect: { x: 0, y: 0, width: 2000, height: 2000 }, distance: 5 },
  tokens: { placeables: tokens, controlled: [], get: (id) => tokens.find((t) => t.document.id === id) ?? null },
  walls: { placeables: [] }, tiles: { placeables: [] }, primary: new Container(), stage: { pivot: new Point(), scale: new Point(1, 1) },
  app: { ticker: { add: (fn) => ticks.push(fn) }, renderer: {} },
};

await import("../../scripts/main.mjs");
for (const fn of hooks.get("ready") ?? []) { try { fn(); } catch { /* an init step this canvas cannot serve */ } }
for (const fn of hooks.get("canvasReady") ?? []) { try { fn(); } catch { /* likewise */ } }
const api = animater.api;
const moveToken = hooks.get("moveToken") ?? [];
assert.ok(api?.debug?.floorAt, "main.mjs is booted far enough to ask it about the floor");
assert.ok(moveToken.length, "and to watch a move");

const frame = () => { for (const fn of ticks) { try { fn(); } catch { /* another engine's frame on a canvas this thin */ } } };
// Long enough to outlast the quiet before the resting place is read (main.mjs ICE_REST_MS).
const settle = () => new Promise((resolve) => realTimeout(resolve, 260));

// A creature as big as its size really is, standing with its corner in the square named.
const mesh = () => ({ alpha: 1, tint: 0xffffff, destroyed: false, scale: { x: 1, y: 1, set(x, y) { this.x = x; this.y = y; } } });
let nextToken = 0;
const creature = (size, wide, col, row) => {
  const id = `tok${++nextToken}`, at = () => ({ x: (col + wide / 2) * GRID, y: (row + wide / 2) * GRID });
  return {
    id, isPreview: false, isOwner: true, visible: true, mesh: mesh(), renderFlags: { set() {} },
    get center() { return at(); },
    document: { id, name: "Bron", elevation: 0, width: wide, height: wide, movementAction: "walk", actor: { size }, getCenterPoint: at, parent: scene },
  };
};
const waypoint = (col, row, wide) => ({ x: col * GRID, y: row * GRID, width: wide, height: wide, elevation: 0, action: "walk", teleport: false });

// One step onto the ice, judged and written by the GM's own listener, then the creature standing where it landed.
const fellThrough = async (size, wide, from, to) => {
  region.flags.animater.thinIce = {};
  const token = creature(size, wide, ...to);
  tokens.length = 0; tokens.push(token);
  canvas.level = { id: `level${++level}`, elevation: { base: 0 } };
  const doc = { ...token.document, parent: scene, x: to[0] * GRID, y: to[1] * GRID };
  scene.tokens.list = [doc];
  // The ice asks where the creature came to rest a moment after the moving stops, and this canvas collects what is put off
  // rather than running it. Run back exactly what this move put off — not what the rest of the map left lying about.
  const waiting = later.length;
  for (const fn of moveToken) fn(doc, { origin: waypoint(...from, wide), passed: { waypoints: [waypoint(...to, wide)] } });
  const mine = later.splice(waiting);
  await settle();
  for (const fn of mine) { try { fn(); } catch { /* another engine's timer on a canvas this thin */ } }
  await settle();
  canvas.level = { id: `level${++level}`, elevation: { base: 0 } };
  return token;
};

// Medium over Small-limit ice is the one footprint whose weight square and centre square agree; the others are the feature.
for (const [name, size, wide, holds] of [["a Medium creature", "med", 1, "sm"], ["a Large creature", "lg", 2, "med"], ["a Huge creature", "huge", 3, "med"], ["a Gargantuan creature", "grg", 4, "med"]]) {
  test(`${name} that broke the ice stands in the water it fell into`, async () => {
    region.flags.animater.iceHolds = holds;
    const token = await fellThrough(size, wide, [1, 1], [1, 2]);
    const holes = region.flags.animater.thinIce?.holes ?? {};
    assert.ok(Object.keys(holes).length === 1, `it went through: ${JSON.stringify(holes)}`);
    assert.equal(api.debug.floorAt(token.center, token.document), "water", `the floor under ${JSON.stringify(token.center)} is the water it fell into, hole at ${JSON.stringify(holes)}`);
    frame();
    assert.ok(token.mesh.alpha < 1, `and it is drawn sunk in it (alpha ${token.mesh.alpha})`);
    assert.notEqual(token.mesh.tint, 0xffffff, "with the water's colour over it");
  });
}

test("the dark water beside the hole's own square reads as water too, as far as it is drawn", async () => {
  region.flags.animater.iceHolds = "med";
  const token = await fellThrough("lg", 2, [1, 1], [1, 2]);
  const [key] = Object.keys(region.flags.animater.thinIce?.holes ?? {});
  const [col, row] = key.split(",").map(Number);
  // The hole a Large creature leaves is drawn three squares across: the square it is keyed by, and the ring round it.
  const beside = { x: (col + 0.5) * GRID, y: (row - 0.5) * GRID };
  assert.equal(api.debug.floorAt(beside, token.document), "water", `the square above ${key} is inside the hole that is drawn`);
  const away = { x: (col + 4.5) * GRID, y: (row + 4.5) * GRID };
  assert.notEqual(api.debug.floorAt(away, token.document), "water", "and the ice well away from it still holds");
});
