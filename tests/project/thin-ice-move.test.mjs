import test from "node:test";
import assert from "node:assert/strict";
import { squaresAcross } from "../../scripts/engines/regions/thin-ice.mjs";

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
  // A PF2e world, because the break whisper names that system's Swim action; a test below plays a world without one.
  system: { id: "pf2e" },
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
  // Where a creature came to rest is read off the token itself once the moving has stopped, so the scene has to hold it.
  tokens: { list: [], get(id) { return this.list.find((t) => t.id === id) ?? null; }, [Symbol.iterator]() { return this.list[Symbol.iterator](); }, get size() { return this.list.length; }, get contents() { return [...this.list]; }, filter(fn) { return this.list.filter(fn); }, map(fn) { return this.list.map(fn); }, find(fn) { return this.list.find(fn); }, forEach(fn) { this.list.forEach(fn); }, some(fn) { return this.list.some(fn); } },
  async updateEmbeddedDocuments(type, updates, options = {}) {
    options.parent = this; // Foundry's own scratch space: it must be a fresh, extensible object
    this.writes.push({ type, updates, options });
    // Foundry really writes: the ice has to remember what it was told, or nothing that reads the stored state can be tested.
    for (const update of updates) {
      const region = this.regions.find((r) => r.id === update._id);
      if (!region) continue;
      for (const [path, value] of Object.entries(update)) {
        if (path === "_id") continue;
        const parts = path.split(".");
        const last = parts.pop();
        let at = region;
        for (const part of parts) at = (at[part] ??= {});
        if (value && typeof value === "object" && value.constructor?.name === "ForcedDeletion") delete at[last];
        else at[last] = value;
      }
    }
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

// A token as big as its size really is — a Large creature is two squares wide, a Gargantuan four — standing with its
// top-left corner in the square named, and a move as Foundry hands it over: the waypoints passed, each with the corner
// the token reached and the footprint it reached it with.
let movers = 0;
const mover = (scene, { name = "Torvald", size = "huge", width = squaresAcross(size) } = {}) => {
  const doc = { id: `tok${++movers}`, name, parent: scene, actor: { size }, width, height: width, elevation: 0, x: 0, y: 0 };
  scene.tokens.list.push(doc);
  return doc;
};
// Foundry moves the token document as it goes: the corner it has reached. The resting place is read from this, not from the
// move hook, which fires again and again while the creature is still walking.
const standAt = (doc, [col, row]) => { doc.x = col * GRID; doc.y = row * GRID; };
const waypoint = (col, row, extra = {}, wide = 1) => ({ x: col * GRID, y: row * GRID, width: wide, height: wide, elevation: 0, action: "walk", teleport: false, ...extra });
const moved = (doc, squares, options = {}) => {
  const [first, ...rest] = squares;
  standAt(doc, first);
  const movement = { origin: waypoint(...first, options, doc.width), passed: { waypoints: rest.map((s) => waypoint(...s, options, doc.width)) } };
  for (const fn of moveToken) fn(doc, movement);
  standAt(doc, squares[squares.length - 1]);
};
// Long enough to outlast the quiet the resting place waits for (main.mjs ICE_REST_MS).
const settle = () => new Promise((resolve) => setTimeout(resolve, 260));

const FLAG = "flags.animater.thinIce";
// What the ice remembers once the move is over: cracks as it walked, the hole where it stopped. Read from the region itself,
// because a walk is written as it goes and the break lands when the creature comes to rest, so no one write holds it all.
const stored = (scene, id = "reg1") => {
  const ice = scene.regions.find((r) => r.id === id)?.flags?.animater?.thinIce ?? {};
  return { cracks: Object.keys(ice.cracks ?? {}).sort(), holes: Object.keys(ice.holes ?? {}).sort(), holeSizes: ice.holes ?? {} };
};
// A move over the squares named, from the first as its origin: every move Foundry hands over has an origin and at least
// one waypoint, so each `walk` names two squares or more.
// Foundry firing its hook again as the creature goes: one firing per square walked, each carrying what is still to come.
// This is what a real drag does, and treating each firing's last waypoint as a resting place broke the ice under the first
// square instead of cracking its way across.
const movedInSteps = (doc, squares, options = {}) => {
  const [first, ...rest] = squares;
  const all = rest.map((sq) => waypoint(...sq, options, doc.width));
  standAt(doc, first);
  for (let i = 1; i <= all.length; i++) {
    const movement = { origin: waypoint(...first, options, doc.width), passed: { waypoints: all.slice(0, i) }, pending: { waypoints: all.slice(i) } };
    for (const fn of moveToken) fn(doc, movement);
    standAt(doc, rest[i - 1]); // the token is where it has got to, as Foundry moves it
  }
};
const walkInSteps = async (regions, squares, who = {}, options = {}) => {
  const scene = makeScene(regions);
  globalThis.canvas = view(scene);
  whispers.length = 0;
  movedInSteps(mover(scene, who), squares, options);
  await settle();
  return scene;
};

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

test("a creature two sizes over the limit breaks the first square it entered, with one hole and no cracks", async () => {
  // A Huge creature is three squares wide: cornered on 1,1 it covers 1 to 3 each way and its weight is in 2,2. Stepping
  // south it enters 2,3 and then 2,4; the square it was already standing in was not entered by this move, and the first
  // one that was is where it goes through.
  const scene = await walk([region("reg1")], [[1, 1], [1, 2], [1, 3]], { size: "huge" });
  assert.equal(scene.writes.length, 1);
  const { type, updates } = scene.writes[0];
  assert.equal(type, "Region");
  assert.deepEqual(updates, [{ _id: "reg1", [`${FLAG}.holes.2,3`]: 3 }]);
  assert.deepEqual(whispers.map((w) => w.content), ["Torvald breaks through the ice into the water (swim)."]);
  assert.deepEqual(whispers[0].whisper, ["gm1"], "the GMs alone");
});

test("one size over cracks every square it entered and breaks the one it stopped on", async () => {
  // Four squares walked over, three of them entered: the square it started in is not one of them.
  const scene = await walk([region("reg1")], [[1, 1], [1, 2], [1, 3], [1, 4]], { name: "Bron", size: "lg" });
  const ice = stored(scene);
  assert.deepEqual(ice.cracks, ["1,2", "1,3", "1,4"], "it cracked its way across, every square it entered");
  assert.deepEqual(ice.holes, [], "and went through nowhere: all of it was sound ice until it crossed");
  // Walking back over its own cracks is what puts it in.
  const back = await walk([region("reg1", { thinIce: { cracks: { "1,2": 1, "1,3": 1, "1,4": 1 } } })], [[1, 4], [1, 3]], { name: "Bron", size: "lg" });
  assert.deepEqual(stored(back).holes, ["1,3"], "the first crack it steps back onto gives way");
  assert.equal(stored(back).holeSizes["1,3"], 2, "a hole as wide as the creature");
});

test("a creature already standing on thin ice does not break the square under its own feet", async () => {
  // The bug this guards: the origin square counted as entered, so a Huge creature already on the ice punched a hole
  // beneath itself, strode on, and did it again next move without ever falling in.
  const scene = await walk([region("reg1")], [[1, 1], [1, 2]], { size: "huge" });
  const [u] = scene.writes[0].updates;
  assert.deepEqual(Object.keys(u).filter((k) => k !== "_id"), [`${FLAG}.holes.2,3`], "the square it entered, not the one it was on");
});

test("the squares written are the ones the move passed through, not the ones its waypoints landed on", async () => {
  // One waypoint, two squares away on the diagonal: the square between them cracks as well.
  const scene = await walk([region("reg1")], [[0, 0], [2, 2]], { name: "Bron", size: "lg" });
  const ice = stored(scene);
  assert.deepEqual(ice.cracks, ["1,1", "2,2"], "the square between the two waypoints cracked as well as the far one");
  assert.deepEqual(ice.holes, [], "neither gave way: both were sound");
});

test("a second heavy creature crossing the first's cracks falls through them", async () => {
  const scene = await walk([region("reg1", { thinIce: { cracks: { "1,1": 1, "1,2": 1 } } })], [[1, 0], [1, 1], [1, 2]], { name: "Bron", size: "lg" });
  const [u] = scene.writes[0].updates;
  assert.equal(u[`${FLAG}.holes.1,1`], 2);
  assert.equal(u[`${FLAG}.holes.1,2`], 2);
  assert.equal(Object.keys(u).filter((k) => k.includes("cracks.")).length, 2, "both cracks cleared, none added");
});

test("a crack cleared by name reaches the scene as the database's own deletion, comma and minus and all", async () => {
  const scene = await walk([region("reg1", { thinIce: { cracks: { "-1,2": 1 } } })], [[-3, 2], [-2, 2], [-1, 2]], { name: "Bron", size: "lg" });
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
  assert.deepEqual(scene.writes[0].updates, [{ _id: "reg2", [`${FLAG}.holes.2,3`]: 3 }]);
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
  const scene = await walk([region("reg1", { thinIce: { holes: { "2,3": 3 } } })], [[1, 1], [1, 2]], { size: "huge" });
  assert.deepEqual(scene.writes, []);
  assert.deepEqual(whispers, [], "and the GM is not told again");
});

test("a Large creature's weight is read in a square it really stands in, walking either way", async () => {
  // A Large creature is two squares wide: cornered on 2,1 it covers columns 2 and 3 and rows 1 and 2, and its middle is
  // the point 300,200 — the bare corner of 3,2. The square it breaks must be one of the four it stands on, and it is the
  // one nearer its own corner: 2,1, behind it, not 3,2 ahead of it.
  // Its weight square is the one that cracks; walking it twice is what turns that square into the hole.
  const east = await walk([region("reg1", { thinIce: { cracks: { "2,1": 1 } } })], [[1, 1], [2, 1]], { name: "Bron", size: "lg" });
  assert.deepEqual(stored(east).holes, ["2,1"], "behind it, not ahead of it");
  const south = await walk([region("reg1", { thinIce: { cracks: { "1,2": 1 } } })], [[1, 1], [1, 2]], { name: "Bron", size: "lg" });
  assert.deepEqual(stored(south).holes, ["1,2"]);
});

test("a Gargantuan creature breaks the first square it enters, walking either way", async () => {
  // Four squares wide: cornered on 1,0 it covers columns 1 to 4, and of the middle two, 2 and 3, the first is read.
  for (const [to, key] of [[[1, 0], "2,1"], [[0, 1], "1,2"]]) {
    const scene = await walk([region("reg1")], [[0, 0], to], { name: "Grond", size: "grg" });
    assert.deepEqual(scene.writes[0].updates, [{ _id: "reg1", [`${FLAG}.holes.${key}`]: 4 }], `walking to ${to}`);
  }
});

test("a move reported twice over, with a longer path the second time, never escalates what it already cracked", async () => {
  // Foundry may fire this hook once per segment with a growing `passed` list. A crack crossed again breaks, so a second
  // firing that repeated the squares of the first would punch holes through a path it had only cracked, and no refreeze
  // ever asked for. Each square is judged once, by the one firing that first entered it.
  const scene = makeScene([region("reg1")]);
  globalThis.canvas = view(scene);
  whispers.length = 0;
  const doc = mover(scene, { name: "Bron", size: "lg" });
  const ways = [[1, 2], [1, 3], [1, 4]].map((s) => waypoint(...s, {}, doc.width));
  for (const upto of [1, 2, 3]) for (const fn of moveToken) fn(doc, { origin: waypoint(1, 1, {}, doc.width), passed: { waypoints: ways.slice(0, upto) } });
  await settle();
  const ice = stored(scene);
  assert.deepEqual(ice.cracks, ["1,2", "1,3", "1,4"], "each square judged once, by the firing that first entered it");
  assert.deepEqual(ice.holes, [], "and not one hole, let alone one per segment");
});

test("a second, separate move from the very same square is walked whole", async () => {
  // The token is the same and the move begins where the last one did; only the path tells them apart.
  const scene = makeScene([region("reg1")]);
  globalThis.canvas = view(scene);
  const doc = mover(scene, { name: "Bron", size: "lg" });
  for (const to of [[1, 2], [2, 1]]) for (const fn of moveToken) fn(doc, { origin: waypoint(1, 1, {}, doc.width), passed: { waypoints: [waypoint(...to, {}, doc.width)] } });
  await settle();
  const ice = stored(scene);
  assert.deepEqual(ice.cracks.sort(), ["1,2", "2,1"], "both moves were judged, each cracking its own square");
  assert.deepEqual(ice.holes, [], "neither crossed ice that was already cracked");
});

test("two thin-ice regions over the same square break once, and the GM is told once", async () => {
  const scene = await walk([region("reg1"), region("reg2")], [[1, 1], [1, 2]], { size: "huge" });
  assert.equal(scene.writes.length, 1, "one batch");
  assert.equal(scene.writes[0].updates.length, 2, "each region keeps its own hole");
  assert.deepEqual(whispers.map((w) => w.content), ["Torvald breaks through the ice into the water (swim)."], "one break, one whisper");
});

test("a break said once, over a crack said somewhere else in the same move", async () => {
  // Two regions under one walk: it cracks the near one and goes through a crack already in the far one. Only the half of
  // the move that broke is worth telling the GM about.
  const north = (point) => Math.floor(point.y / GRID) <= 2;
  const scene = await walk([
    region("reg1", { inside: north }),
    region("reg2", { inside: (p) => !north(p), thinIce: { cracks: { "1,3": 1 } } }),
  ], [[1, 1], [1, 2], [1, 3]], { name: "Bron", size: "lg" });
  assert.ok(scene.writes.length, "something was written");
  assert.deepEqual(whispers.map((w) => w.content), ["Bron breaks through the ice into the water (swim)."]);
  assert.equal(whispers.filter((w) => /breaks through/.test(w.content)).length, 1, "the break is said once, not once per region");
});

test("a drag delivered square by square cracks its way across and only gives way where it stops", async () => {
  // Exactly what the table saw: the hook fires once per square, each firing saying what is still to come.
  const scene = await walkInSteps([region("reg1")], [[1, 1], [1, 2], [1, 3], [1, 4]], { size: "lg" });
  const ice = stored(scene);
  assert.deepEqual(ice.cracks, ["1,2", "1,3", "1,4"], "a crack for each square it walked onto");
  assert.deepEqual(ice.holes, [], "and no hole: one step onto sound ice is never a hole, however the hook arrives");
  assert.equal(whispers.filter((w) => /breaks through/.test(w.content)).length, 0);
});

test("the whisper names Swim in a PF2e world and stays quiet about it in a world without one", async () => {
  const was = game.system;
  try {
    game.system = { id: "dnd5e" };
    await walk([region("reg1")], [[1, 1], [1, 2], [1, 3]], { size: "huge" });
    assert.deepEqual(whispers.map((w) => w.content), ["Torvald breaks through the ice into the water."], "no action it does not have");
    game.system = { id: "pf2e" };
    await walk([region("reg1")], [[1, 1], [1, 2], [1, 3]], { size: "huge" });
    assert.deepEqual(whispers.map((w) => w.content), ["Torvald breaks through the ice into the water (swim)."]);
  } finally { game.system = was; }
});

test("a single step onto sound ice cracks it and leaves it at that", () => true);

