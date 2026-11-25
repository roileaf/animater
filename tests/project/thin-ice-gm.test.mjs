import test from "node:test";
import assert from "node:assert/strict";

// What the GM does to thin ice, asked of main.mjs itself: Refreeze (the region panel's button), Repair (every region at
// once, in the props' own batch) and a fire area melting the ice to open water. Every test writes through the module and
// reads back what the scene holds and what the floor says underfoot; nothing here reads main.mjs's source text.

// Foundry's own deferred work is not wanted on a canvas this thin: setTimeout is collected and dropped, so none of the
// module's debounced redraws ever runs here (thin-ice-sunk.test.mjs does the same).
const later = [];
globalThis.setTimeout = (fn) => { later.push(fn); return later.length; };
globalThis.clearTimeout = () => {};

const GRID = 100;
const hooks = new Map();
globalThis.Hooks = { on(name, fn) { hooks.set(name, [...(hooks.get(name) ?? []), fn]); }, once(name, fn) { this.on(name, fn); }, callAll() {}, call() {} };
class FakeApp { async render() { return this; } async close() {} }
class ForcedDeletion {}
globalThis.foundry = {
  applications: { api: { ApplicationV2: FakeApp, HandlebarsApplicationMixin: (Base) => class extends Base {}, DialogV2: { confirm: async () => true } } },
  data: { operators: { ForcedDeletion } },
  utils: { escapeHTML: (s) => s },
};
globalThis.window = globalThis;
globalThis.document = { addEventListener() {}, createElement: () => ({ style: {} }), head: { appendChild() {} } };
globalThis.ui = { notifications: { info() {}, warn() {} } };
globalThis.ChatMessage = { create: async () => ({}) };
class Point { constructor(x = 0, y = 0) { this.x = x; this.y = y; } set(x = 0, y = x) { this.x = x; this.y = y; return this; } copyFrom(p) { return this.set(p?.x ?? 0, p?.y ?? 0); } }
class Container {
  constructor() { this.children = []; this.parent = null; this.destroyed = false; this.visible = true; this.alpha = 1; this.tint = 0xffffff; this.position = new Point(); this.scale = new Point(1, 1); this.pivot = new Point(); this.filters = null; this.mask = null; this.zIndex = 0; }
  addChild(child) { child.parent = this; this.children.push(child); return child; }
  removeChild(child) { this.children = this.children.filter((c) => c !== child); return child; }
  removeChildren() { const was = this.children; this.children = []; return was; }
  destroy() { this.destroyed = true; }
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
const animater = { api: null };
globalThis.game = {
  user: { isGM: true, isActiveGM: true, id: "gm1" },
  users: Object.assign([{ id: "gm1", isGM: true }], { activeGM: { isSelf: true } }),
  settings: { get: () => undefined, set: () => {} },
  time: { serverTime: 0, worldTime: 0 },
  modules: { get: () => animater, keys: () => [] },
  system: { id: "pf2e" },
  scenes: { get: () => scene },
  audio: {},
  socket: { on() {}, emit() {} },
};
globalThis.CONFIG = { Canvas: { polygonBackends: { sound: { create: () => null } } }, Token: { movement: { actions: {} } } };

// A list of documents that answers as Foundry's own collection does.
const collection = (list = []) => Object.assign(list, { get contents() { return [...list]; }, get: (id) => list.find((d) => d.id === id) ?? null });

// One square of the map, as the ice keys it.
const key = (col, row) => `${col},${row}`;
const mid = (col, row) => ({ x: (col + 0.5) * GRID, y: (row + 0.5) * GRID });

// A region of thin ice covering the top-left 6x6 squares of the map, with whatever the ice has stored in it.
const iceRegion = (thinIce, { thin = true, id = "reg1", w = 600, h = 600 } = {}) => {
  const doc = {
    id, parent: null, name: "The lake", levels: [], elevation: { bottom: null, top: null },
    flags: { animater: { floor: "water", iceThin: thin, iceHolds: "med", thinIce } },
    shapes: [{ type: "rectangle", x: 0, y: 0, width: w, height: h }],
    polygons: [{ points: [0, 0, w, 0, w, h, 0, h] }],
    behaviors: [],
    testPoint: ({ x, y }) => x >= 0 && x <= w && y >= 0 && y <= h,
  };
  return doc;
};

// Foundry's own write, as far as this feature is concerned: the update is applied to the document, the hook runs with the
// changes and the options, and — exactly as createEmbeddedDocuments sets options.parent — a property is written ONTO the
// options object it was handed. A frozen or shared constant passed as the options would throw here.
const applyUpdate = (doc, update) => {
  for (const [path, value] of Object.entries(update)) {
    if (path === "_id") continue;
    const parts = path.split(".");
    let at = doc;
    for (const part of parts.slice(0, -1)) at = at[part] ??= {};
    const last = parts[parts.length - 1];
    if (value instanceof ForcedDeletion || value === null) delete at[last];
    else at[last] = value;
  }
};
const makeScene = () => {
  const s = {
    id: "scene1", name: "Frozen lake", flags: {}, writes: [],
    regions: collection([]), tiles: collection([]), walls: collection([]), lights: collection([]), tokens: collection([]), drawings: collection([]), templates: collection([]),
    grid: { size: GRID, type: 1 },
    async updateEmbeddedDocuments(type, updates, options = {}) {
      options.parent = this; // Foundry's own scratch space: it must be a fresh, extensible object
      this.writes.push({ type, updates, options });
      if (type === "Region") for (const u of updates) { const doc = this.regions.get(u._id); if (doc) { applyUpdate(doc, u); for (const fn of hooks.get("updateRegion") ?? []) { try { fn(doc, { ...u, _id: undefined }, options); } catch { /* another listener's business */ } } } }
      return updates;
    },
    async deleteEmbeddedDocuments(type, ids, options = {}) {
      options.parent = this; this.writes.push({ type, deletes: ids, options });
      if (type === "Region") for (const id of ids) { const at = this.regions.findIndex((d) => d.id === id); if (at >= 0) { const doc = this.regions[at]; this.regions = collection(this.regions.filter((d) => d !== doc)); for (const fn of hooks.get("deleteRegion") ?? []) { try { fn(doc, options); } catch { /* another listener's business */ } } } }
      return ids;
    },
    // A region made as Foundry makes one, as far as this feature reads it: its shapes as polygons, and a testPoint.
    async createEmbeddedDocuments(type, datas, options = {}) {
      options.parent = this; this.writes.push({ type, creates: datas, options });
      if (type !== "Region") return [];
      return datas.map((data, n) => {
        const inRing = (x, y, pts) => { let yes = false; for (let i = 0, j = pts.length - 2; i < pts.length; j = i, i += 2) if (pts[i + 1] > y !== pts[j + 1] > y && x < ((pts[j] - pts[i]) * (y - pts[i + 1])) / (pts[j + 1] - pts[i + 1]) + pts[i]) yes = !yes; return yes; };
        // Its shapes are read as they are now, so a hole written into it later is a hole.
        const doc = { ...structuredClone(data), id: `made${this.writes.length}_${n}`, parent: this, behaviors: [],
          get polygonTree() { const cuts = this.shapes.filter((sh) => sh.hole).map((sh) => ({ isHole: true, points: sh.points, children: [] })); return { children: this.shapes.filter((sh) => !sh.hole).map((sh) => ({ isHole: false, points: sh.points, children: cuts })) }; },
          testPoint({ x, y }) { return this.shapes.some((sh) => !sh.hole && inRing(x, y, sh.points)) && !this.shapes.some((sh) => sh.hole && inRing(x, y, sh.points)); } };
        this.regions = collection([...this.regions, doc]); // (its contents are a copy taken as it is made)
        for (const fn of hooks.get("createRegion") ?? []) { try { fn(doc, options); } catch { /* another listener's business */ } }
        return doc;
      });
    },
    async update() { return this; },
  };
  return s;
};
const scene = makeScene();
globalThis.canvas = {
  ready: true, scene,
  grid: { size: GRID },
  level: { id: "level0", elevation: { base: 0 } },
  dimensions: { sceneRect: { x: 0, y: 0, width: 1000, height: 1000 }, rect: { x: 0, y: 0, width: 1000, height: 1000 }, distance: 5 },
  tokens: { placeables: [], controlled: [], get: () => null },
  walls: { placeables: [] }, tiles: { placeables: [], get: () => null }, primary: new Container(), stage: { pivot: new Point(), scale: new Point(1, 1) },
  app: { ticker: { add: () => {} }, renderer: {} },
};

await import("../../scripts/main.mjs");
for (const name of ["ready", "canvasReady"]) for (const fn of hooks.get(name) ?? []) { try { fn(); } catch { /* an init step this canvas cannot serve */ } }
const api = animater.api;
assert.ok(api?.debug?.floorAt, "main.mjs is booted far enough to ask it about the floor");

const token = { id: "tok1", name: "Torvald", elevation: 0, width: 1, height: 1, movementAction: "walk", actor: null, getCenterPoint: () => ({ x: 0, y: 0 }) };
const floorAt = (col, row) => api.debug.floorAt(mid(col, row), token);
// A fresh scene for one test: the regions it holds, and nothing written yet. The floor cache is left exactly as the last
// test left it — putting the ice back must drop it by itself, which is what these tests are for.
const setUp = (regions) => {
  scene.regions = collection(regions);
  for (const r of regions) r.parent = scene;
  scene.writes.length = 0;
  for (const fn of hooks.get("canvasReady") ?? []) { try { fn(); } catch { /* likewise */ } }
};
const iceOf = (doc) => doc.flags.animater.thinIce ?? {};

test("a thin-ice region walks as ice whatever the weather, and its hole as open water", () => {
  setUp([iceRegion({ cracks: { [key(1, 1)]: 1 }, holes: { [key(3, 3)]: 2 } })]);
  assert.equal(floorAt(1, 1), "ice", "frozen over without a frost in sight");
  assert.equal(floorAt(3, 3), "water", "and the hole is open water");
});

test("Refreeze clears the cracks and the holes, and the floor stops reading as water", async () => {
  const region = iceRegion({ cracks: { [key(1, 1)]: 1, [key(2, 1)]: 1 }, holes: { [key(3, 3)]: 2, [key(4, 3)]: 1 } });
  setUp([region]);
  assert.equal(floorAt(3, 3), "water", "the creature is swimming in the hole first");
  await api.debug.refreezeIce(region.id);
  assert.deepEqual(iceOf(region).holes, {}, "every hole gone");
  assert.deepEqual(iceOf(region).cracks, {}, "every crack gone");
  assert.equal(floorAt(3, 3), "ice", "and the floor is ice again: nobody is left swimming in dry ground");
});

test("Refreeze is written as Animater's own, on a fresh object Foundry may write to", async () => {
  const region = iceRegion({ holes: { [key(3, 3)]: 2 } });
  setUp([region]);
  await api.debug.refreezeIce(region.id);
  const write = scene.writes.find((w) => w.type === "Region");
  assert.ok(write, "the region was written");
  assert.equal(write.options.parent, scene, "Foundry wrote to the options it was handed");
  assert.equal(Object.isFrozen(write.options), false);
  assert.ok(write.updates.every((u) => !Object.keys(u).some((k) => k.includes("-="))), "the deprecated key form never leaves");
  assert.ok(write.updates.some((u) => Object.values(u).some((v) => v instanceof ForcedDeletion)), "each key goes as the database's own deletion");
});

test("Repair puts back the ice of every region, in the props' own one region batch", async () => {
  const a = iceRegion({ cracks: { [key(1, 1)]: 1 }, holes: { [key(3, 3)]: 2 } }, { id: "reg1" });
  const b = iceRegion({ holes: { [key(5, 5)]: 1 } }, { id: "reg2" });
  setUp([a, b]);
  assert.equal(floorAt(3, 3), "water");
  await api.debug.repairProps();
  assert.deepEqual(iceOf(a), { cracks: {}, holes: {} });
  assert.deepEqual(iceOf(b), { holes: {} });
  const batches = scene.writes.filter((w) => w.type === "Region" && w.updates);
  assert.equal(batches.length, 1, "one region batch, as the decorations' repair writes");
  assert.deepEqual(batches[0].updates.map((u) => u._id).sort(), ["reg1", "reg2"]);
  assert.equal(floorAt(3, 3), "ice", "and nobody is left swimming where the hole was");
});

test("Repair leaves the regions themselves alone", async () => {
  const region = iceRegion({ holes: { [key(3, 3)]: 2 } });
  setUp([region]);
  await api.debug.repairProps();
  assert.deepEqual(scene.writes.filter((w) => w.deletes), [], "thin ice deletes no region");
});

test("a fire area over the thin ice melts it to open water", async () => {
  const region = iceRegion({ cracks: { [key(2, 2)]: 1 } });
  setUp([region]);
  assert.equal(floorAt(2, 2), "ice");
  await api.debug.meltIce(mid(2, 2), GRID * 0.9);
  assert.equal(iceOf(region).holes[key(2, 2)], "melt", "the square it covered is open water, stored as a melt");
  assert.deepEqual(iceOf(region).cracks, {}, "and the crack under it is gone");
  assert.equal(floorAt(2, 2), "water", "a creature there is in the water");
  assert.equal(floorAt(5, 5), "ice", "the ice the fire never reached still holds");
});

test("fire melts nothing on a region the GM never marked as thin ice", async () => {
  const region = iceRegion({}, { thin: false });
  setUp([region]);
  await api.debug.meltIce(mid(2, 2), GRID * 0.9);
  assert.deepEqual(scene.writes.filter((w) => w.type === "Region"), []);
});

test("a fire on a lake too wide to walk whole still melts the squares under it", async () => {
  // Eighty-one squares by fifty: walking every square of the region would be past what the melt is allowed to walk, and
  // every fireball on an ordinary outdoor lake would quietly do nothing.
  const region = iceRegion({}, { w: 8100, h: 5000 });
  setUp([region]);
  await api.debug.meltIce(mid(40, 30), GRID * 0.9);
  assert.equal(iceOf(region).holes[key(40, 30)], "melt", `the square under the fire melted: ${JSON.stringify(iceOf(region).holes)}`);
  assert.equal(Object.keys(iceOf(region).holes).length, 1, "and only the squares the fire really covers");
});

test("a player with the console melts no ice: only the GM writes a region", async () => {
  const region = iceRegion({});
  setUp([region]);
  game.user.isGM = false;
  try {
    await api.debug.meltIce(mid(2, 2), GRID * 0.9);
    assert.deepEqual(scene.writes.filter((w) => w.type === "Region"), [], "nothing was written");
    assert.deepEqual(iceOf(region).holes ?? {}, {}, "and the ice is whole");
  } finally { game.user.isGM = true; }
});

// Roi, 2026-11-25: "cold freezing pond", and of mending ice against freezing open water, "both".
test("a cold area over broken thin ice freezes it over again", async () => {
  const region = iceRegion({ cracks: { [key(2, 2)]: 1 }, holes: { [key(2, 3)]: 2, [key(5, 5)]: 1 } });
  setUp([region]);
  assert.equal(floorAt(2, 3), "water");
  await api.debug.freezeIce(mid(2, 2), GRID * 1.2);
  assert.deepEqual(iceOf(region).cracks, {});
  assert.deepEqual(Object.keys(iceOf(region).holes), [key(5, 5)], "the hole it never reached is still open");
  assert.equal(floorAt(2, 3), "ice", "and where it froze, the floor holds again");
});

test("a cold area over open water freezes nothing until the scene says cold freezes water", async () => {
  const region = iceRegion(undefined, { thin: false });
  setUp([region]);
  await api.debug.freezeIce(mid(2, 2), GRID * 1.2);
  assert.deepEqual(scene.writes.filter((w) => w.type === "Region"), []);
  assert.equal(floorAt(2, 2), "water");
});

// The whole pond freezing was built first; Roi, shown it: "Want partial".
test("with the scene's switch on, a cold area freezes the part of a pond it covers, as a sheet of ice laid over it", async () => {
  const region = iceRegion(undefined, { thin: false });
  setUp([region]);
  scene.flags = { animater: { coldFreezes: true } };
  try {
    await api.debug.freezeIce(mid(1, 1), GRID * 1.6);
    const made = scene.writes.find((w) => w.creates);
    assert.ok(made, "a region was made");
    assert.equal(made.creates.length, 1);
    assert.equal(made.creates[0].flags.animater.iceSpell, true);
    assert.equal(region.flags.animater.iceThin, false, "the pond itself is not changed");
    assert.equal(scene.regions.length, 2);
    assert.equal(floorAt(1, 1), "ice", "under the spell the water holds a creature up");
    assert.equal(floorAt(5, 5), "water", "and the rest of the pond is the water it was");
    // The same spell again lays no second sheet.
    scene.writes.length = 0;
    await api.debug.freezeIce(mid(1, 1), GRID * 1.6);
    assert.deepEqual(scene.writes.filter((w) => w.creates), []);
    // Fire takes its own shape out of the sheet, and the pond shows there again; cold lays ice over it once more.
    const sheet = scene.regions.find((d) => d.flags.animater.iceSpell === true);
    await api.debug.meltIce(mid(1, 1), GRID * 0.9);
    assert.equal(sheet.shapes.filter((sh) => sh.hole).length, 1, "a hole in the sheet's own shape");
    assert.deepEqual(iceOf(sheet).holes ?? {}, {}, "not a square stored as melted");
    assert.equal(floorAt(1, 1), "water");
    assert.equal(floorAt(2, 2), "ice", "the sheet beside the fire still holds");
    await api.debug.freezeIce(mid(1, 1), GRID * 0.9);
    assert.equal(floorAt(1, 1), "ice");
    // A fire over all of it takes the sheets away whole.
    await api.debug.meltIce(mid(1, 1), GRID * 4);
    assert.deepEqual(scene.regions.map((d) => d.id), [region.id]);
    await api.debug.freezeIce(mid(1, 1), GRID * 1.6);
    assert.equal(scene.regions.length, 2);
    // Repair takes the sheet away and leaves the pond.
    await api.debug.repairProps();
    assert.deepEqual(scene.regions.map((d) => d.id), [region.id]);
    assert.equal(floorAt(1, 1), "water");
  } finally { scene.flags = {}; }
});

test("a lake is frozen where the cold reaches too, however wide it is", async () => {
  const region = iceRegion(undefined, { thin: false, w: 8100, h: 5000 });
  setUp([region]);
  scene.flags = { animater: { coldFreezes: true } };
  try {
    await api.debug.freezeIce(mid(40, 30), GRID * 1.6);
    assert.equal(scene.writes.filter((w) => w.creates).length, 1);
    assert.equal(floorAt(40, 30), "ice");
    assert.equal(floorAt(10, 10), "water");
  } finally { scene.flags = {}; }
});

test("a river is not frozen", async () => {
  const region = iceRegion(undefined, { thin: false });
  region.flags.animater.flowTo = "e";
  setUp([region]);
  scene.flags = { animater: { coldFreezes: true } };
  try {
    await api.debug.freezeIce(mid(2, 2), GRID * 1.6);
    assert.deepEqual(scene.writes.filter((w) => w.creates), []);
  } finally { scene.flags = {}; }
});
