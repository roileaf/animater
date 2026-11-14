import test from "node:test";
import assert from "node:assert/strict";

// The active GM watching a move over thin ice: main.mjs's own moveToken listener, run here against a stand-in for Foundry.
// Nothing is asserted about main.mjs's source text; every test moves a token and reads what was written to the scene.

const GRID = 100;
const hooks = new Map();
globalThis.Hooks = { on(name, fn) { hooks.set(name, [...(hooks.get(name) ?? []), fn]); }, once() {}, callAll() {}, call() {} };
class FakeApp { async render() { return this; } async close() {} }
globalThis.foundry = {
  applications: { api: { ApplicationV2: FakeApp, HandlebarsApplicationMixin: (Base) => class extends Base {}, DialogV2: { confirm: async () => true } } },
  // v14's deletion operator: what a "-=key" field must become before it is sent (prop-requests withDeletes).
  data: { operators: { ForcedDeletion: class ForcedDeletion {} } },
};
globalThis.window = globalThis;
globalThis.document = { addEventListener() {}, createElement: () => ({ style: {} }), head: { appendChild() {} } };
globalThis.ui = { notifications: { info() {}, warn() {} } };
const whispers = [];
globalThis.ChatMessage = { create: async (data) => { whispers.push(data); return data; } };
const users = [{ id: "gm1", isGM: true }, { id: "player", isGM: false }];
globalThis.game = {
  user: { isGM: true, isActiveGM: true },
  users: Object.assign(users, { activeGM: { isSelf: true } }),
  settings: { get: () => undefined },
  time: { serverTime: 0, worldTime: 0 },
  modules: { get: () => ({ api: null }) },
};

await import("../../scripts/main.mjs");
const moveToken = hooks.get("moveToken") ?? [];

// Every write the scene is handed, with the options object it was handed with. The fake writes a property onto that options
// object, exactly as Foundry's createEmbeddedDocuments sets options.parent: a frozen or shared constant handed in as the
// options would throw here, which is how this feature's sibling shipped dead with its own tests green.
const makeScene = (regions) => ({
  id: "scene1",
  regions,
  writes: [],
  async updateEmbeddedDocuments(type, updates, options = {}) {
    options.parent = this; // Foundry's own scratch space: it must be a fresh, extensible object
    this.writes.push({ type, updates, options });
    return updates;
  },
});

const region = (id, { thin = true, holds = "med", thinIce = {}, inside = () => true } = {}) => ({
  id,
  flags: { animater: { iceThin: thin, iceHolds: holds, thinIce } },
  testPoint: inside,
});

const view = (scene) => ({
  ready: true,
  scene,
  grid: { size: GRID },
  level: { id: "ground", elevation: { base: 0 } },
  dimensions: { sceneRect: { x: 0, y: 0, width: 2000, height: 2000 }, distance: 5 },
  tokens: { placeables: [] },
});

// A token standing with its top-left corner in the square it is in, and a move as Foundry hands it over: the waypoints
// passed, each with the corner it reached.
const mover = (scene, { name = "Torvald", size = "huge", width = 1 } = {}) => ({
  id: "tok1", name, parent: scene, actor: { size }, width, height: width, elevation: 0,
});
const waypoint = (col, row, extra = {}) => ({ x: col * GRID, y: row * GRID, width: 1, height: 1, elevation: 0, action: "walk", teleport: false, ...extra });
const moved = (doc, squares, options = {}) => {
  const [first, ...rest] = squares;
  const movement = { origin: waypoint(...first), passed: { waypoints: rest.map((s) => waypoint(...s, options)) } };
  for (const fn of moveToken) fn(doc, movement);
};
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

const FLAG = "flags.animater.thinIce";
// A move over the squares named, from the first as its origin: every move Foundry hands over has an origin and at least
// one waypoint, so each `walk` names two squares or more.
const walk = async (regions, squares, who = {}, options = {}) => {
  const scene = makeScene(regions);
  globalThis.canvas = view(scene);
  whispers.length = 0;
  moved(mover(scene, who), squares, options);
  await settle();
  return scene;
};

test("thin ice watches the move itself, beside the footprints' own listener", () => {
  assert.ok(moveToken.length >= 2, `thin ice listens for itself: ${moveToken.length} moveToken listeners`);
});

test("a creature the ice holds writes nothing at all", async () => {
  const scene = await walk([region("reg1")], [[1, 1], [1, 2], [1, 3]], { size: "med" });
  assert.deepEqual(scene.writes, []);
  assert.deepEqual(whispers, []);
});

test("a creature two sizes over the limit breaks the square it entered, with one hole and no cracks", async () => {
  const scene = await walk([region("reg1")], [[1, 1], [1, 2], [1, 3]], { size: "huge" });
  assert.equal(scene.writes.length, 1);
  const { type, updates } = scene.writes[0];
  assert.equal(type, "Region");
  assert.deepEqual(updates, [{ _id: "reg1", [`${FLAG}.holes.1,1`]: 3 }]);
  assert.deepEqual(whispers.map((w) => w.content), ["Torvald breaks through the ice into the water (swim)."]);
  assert.deepEqual(whispers[0].whisper, ["gm1"], "the GMs alone");
});

test("one size over cracks every square it crossed and breaks the one it stopped on", async () => {
  const scene = await walk([region("reg1")], [[1, 1], [1, 2], [1, 3]], { name: "Bron", size: "lg" });
  assert.deepEqual(scene.writes[0].updates, [{
    _id: "reg1",
    [`${FLAG}.holes.1,3`]: 2,
    [`${FLAG}.cracks.1,1`]: 1,
    [`${FLAG}.cracks.1,2`]: 1,
  }]);
});

test("the squares written are the ones the move passed through, not the ones its waypoints landed on", async () => {
  // One waypoint, two squares away on the diagonal: the square between them cracks as well.
  const scene = await walk([region("reg1")], [[0, 0], [2, 2]], { name: "Bron", size: "lg" });
  const [u] = scene.writes[0].updates;
  assert.deepEqual(Object.keys(u).filter((k) => k.includes("cracks")).sort(), [`${FLAG}.cracks.0,0`, `${FLAG}.cracks.1,1`]);
  assert.equal(u[`${FLAG}.holes.2,2`], 2, "and it stopped on the far one");
});

test("a second heavy creature crossing the first's cracks falls through them", async () => {
  const scene = await walk([region("reg1", { thinIce: { cracks: { "1,1": 1, "1,2": 1 } } })], [[1, 1], [1, 2]], { name: "Bron", size: "lg" });
  const [u] = scene.writes[0].updates;
  assert.equal(u[`${FLAG}.holes.1,1`], 2);
  assert.equal(u[`${FLAG}.holes.1,2`], 2);
  assert.equal(Object.keys(u).filter((k) => k.includes("cracks.")).length, 2, "both cracks cleared, none added");
});

test("a crack cleared by name reaches the scene as the database's own deletion, comma and minus and all", async () => {
  const scene = await walk([region("reg1", { thinIce: { cracks: { "-1,2": 1 } } })], [[-2, 2], [-1, 2]], { name: "Bron", size: "lg" });
  const [u] = scene.writes[0].updates;
  assert.ok(!Object.keys(u).some((k) => k.includes("-=")), `the deprecated key form never leaves: ${Object.keys(u)}`);
  assert.ok(u[`${FLAG}.cracks.-1,2`] instanceof foundry.data.operators.ForcedDeletion, `the crack is deleted by name: ${Object.keys(u)}`);
  assert.equal(u[`${FLAG}.holes.-1,2`], 2);
});

test("the write is stamped as Animater's own, on a fresh object Foundry may write to", async () => {
  const scene = await walk([region("reg1")], [[1, 1], [1, 2]], { size: "huge" });
  const { options } = scene.writes[0];
  assert.equal(options.animater?.thinIce, true);
  assert.equal(options.parent, scene, "Foundry wrote to the options it was handed");
  assert.equal(Object.isFrozen(options), false);
  const second = await walk([region("reg1")], [[2, 2], [2, 3]], { size: "huge" });
  assert.notEqual(second.writes[0].options, scene.writes[0].options, "each write carries its own options object");
});

test("flying, burrowing, swimming, blinking across and rising above the ice leave it whole", async () => {
  for (const options of [{ action: "fly" }, { action: "burrow" }, { action: "swim" }, { action: "displace" }, { teleport: true }, { elevation: 10 }]) {
    const scene = await walk([region("reg1")], [[1, 1], [1, 2]], { size: "huge" }, options);
    assert.deepEqual(scene.writes, [], `${JSON.stringify(options)} broke the ice`);
    assert.deepEqual(whispers, []);
  }
});

test("only the squares the region itself holds are written, and a region without thin ice is left alone", async () => {
  const only12 = (point) => Math.floor(point.y / GRID) === 2;
  const scene = await walk([region("reg1", { inside: only12 }), region("reg2", { thin: false })], [[1, 1], [1, 2], [1, 3]], { name: "Bron", size: "lg" });
  assert.equal(scene.writes.length, 1);
  assert.deepEqual(scene.writes[0].updates, [{ _id: "reg1", [`${FLAG}.cracks.1,2`]: 1 }]);
});

test("two thin-ice regions under one move are each written, and one that throws never stops the other", async () => {
  const broken = region("bad");
  broken.testPoint = () => { throw new Error("a region mid-change"); };
  const scene = await walk([broken, region("reg2")], [[1, 1], [1, 2]], { size: "huge" });
  assert.equal(scene.writes.length, 1);
  assert.deepEqual(scene.writes[0].updates, [{ _id: "reg2", [`${FLAG}.holes.1,1`]: 3 }]);
});

test("a client that is not the active GM writes nothing: every screen draws what the GM stored", async () => {
  game.user.isActiveGM = false;
  try {
    const scene = await walk([region("reg1")], [[1, 1], [1, 2]], { size: "huge" });
    assert.deepEqual(scene.writes, []);
    assert.deepEqual(whispers, []);
  } finally { game.user.isActiveGM = true; }
});

test("a move on another scene than the one in view is left to that scene's own GM", async () => {
  const scene = makeScene([region("reg1")]);
  globalThis.canvas = view(makeScene([region("reg1")]));
  whispers.length = 0;
  moved(mover(scene, { size: "huge" }), [[1, 1], [1, 2]]);
  await settle();
  assert.deepEqual(scene.writes, []);
});

test("nothing is written twice: a move over a square that is already a hole changes nothing", async () => {
  const scene = await walk([region("reg1", { thinIce: { holes: { "1,1": 3 } } })], [[1, 1], [1, 2]], { size: "huge" });
  assert.deepEqual(scene.writes, []);
  assert.deepEqual(whispers, [], "and the GM is not told again");
});
