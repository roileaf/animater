import test from "node:test";
import assert from "node:assert/strict";
import { fireRate, spreadStep, cellStep, GRASS_RATE, CELL_ROUNDS, BURN_ROUNDS, regionBurns, cellId, fireUpdatesFor, dropLostDecorFire, readFire, writeFirePath, decorFireOf, fireCellsOf } from "../../../scripts/engines/props/fire-spread.mjs";

test("the rate is the higher of the material's and the contents'", () => {
  assert.equal(fireRate({ material: "plant", contents: "none" }), 2);
  assert.equal(fireRate({ material: "wood", contents: "none" }), 1);
  assert.equal(fireRate({ material: "wood", contents: "books" }), 1.6);
  assert.equal(fireRate({ material: "glass", contents: "lampoil" }), 2, "contents beat material");
  assert.equal(fireRate({ material: "stone", contents: "none" }), 0);
  assert.equal(fireRate({ material: "metal", contents: "water" }), 0);
  assert.equal(fireRate({ material: "clay", contents: "potions" }), 1.2);
  assert.equal(fireRate({}), 0);
  assert.equal(fireRate(null), 0);
});

test("a burning thing heats what is within a square of it, once per source", () => {
  const fire = { id: "a", rect: { x: 0, y: 0, w: 100, h: 100 }, traits: { material: "wood" }, fire: { burning: true, roundsLeft: 3 } };
  const near = { id: "b", rect: { x: 104, y: 0, w: 100, h: 100 }, traits: { material: "wood" }, fire: null };
  const far = { id: "c", rect: { x: 400, y: 0, w: 100, h: 100 }, traits: { material: "wood" }, fire: null };
  const r = spreadStep({ things: [fire, near, far], grid: 100 });
  assert.equal(r.heat.find((h) => h.id === "b").heat, 30);
  assert.equal(r.heat.find((h) => h.id === "c"), undefined);
});

test("touching heats faster, and the rate scales it", () => {
  const fire = { id: "a", rect: { x: 0, y: 0, w: 100, h: 100 }, traits: { material: "wood" }, fire: { burning: true, roundsLeft: 3 } };
  const touch = { id: "b", rect: { x: 100, y: 0, w: 100, h: 100 }, traits: { material: "plant" }, fire: null };
  assert.equal(spreadStep({ things: [fire, touch], grid: 100 }).heat[0].heat, 110);
});

test("stone never catches and never warns", () => {
  const fire = { id: "a", rect: { x: 0, y: 0, w: 100, h: 100 }, traits: { material: "wood" }, fire: { burning: true, roundsLeft: 3 } };
  const rock = { id: "b", rect: { x: 100, y: 0, w: 100, h: 100 }, traits: { material: "stone" }, fire: null };
  const r = spreadStep({ things: [fire, rock], grid: 100 });
  assert.deepEqual(r.heat, []);
  assert.deepEqual(r.warn, []);
});

test("heat at 50 warns, at 100 it catches", () => {
  const fire = { id: "a", rect: { x: 0, y: 0, w: 100, h: 100 }, traits: { material: "wood" }, fire: { burning: true, roundsLeft: 3 } };
  const warm = { id: "b", rect: { x: 104, y: 0, w: 100, h: 100 }, traits: { material: "wood" }, fire: { heat: 30 } };
  assert.deepEqual(spreadStep({ things: [fire, warm], grid: 100 }).warn, ["b"]);
  const hot = { ...warm, fire: { heat: 80 } };
  assert.deepEqual(spreadStep({ things: [fire, hot], grid: 100 }).caught, ["b"]);
});

test("downwind heats half again, but only out of doors", () => {
  const fire = { id: "a", rect: { x: 0, y: 0, w: 100, h: 100 }, traits: { material: "wood" }, fire: { burning: true, roundsLeft: 3 } };
  const east = { id: "b", rect: { x: 104, y: 0, w: 100, h: 100 }, traits: { material: "wood" }, fire: null };
  const wind = { angle: 0, strength: 1, outdoor: true };
  assert.equal(spreadStep({ things: [fire, east], grid: 100, wind }).heat[0].heat, 45);
  assert.equal(spreadStep({ things: [fire, east], grid: 100, wind: { ...wind, outdoor: false } }).heat[0].heat, 30);
});

test("a wall between them blocks the heat", () => {
  const fire = { id: "a", rect: { x: 0, y: 0, w: 100, h: 100 }, traits: { material: "wood" }, fire: { burning: true, roundsLeft: 3 } };
  const past = { id: "b", rect: { x: 104, y: 0, w: 100, h: 100 }, traits: { material: "wood" }, fire: null, blocked: ["a"] };
  assert.deepEqual(spreadStep({ things: [fire, past], grid: 100 }).heat, []);
});

test("things on another level are untouched", () => {
  const fire = { id: "a", rect: { x: 0, y: 0, w: 100, h: 100 }, levels: ["L1"], traits: { material: "wood" }, fire: { burning: true, roundsLeft: 3 } };
  const up = { id: "b", rect: { x: 104, y: 0, w: 100, h: 100 }, levels: ["L2"], traits: { material: "wood" }, fire: null };
  assert.deepEqual(spreadStep({ things: [fire, up], grid: 100 }).heat, []);
});

test("a burning thing counts its round down and goes out at zero", () => {
  const fire = { id: "a", rect: { x: 0, y: 0, w: 100, h: 100 }, traits: { material: "wood" }, fire: { burning: true, roundsLeft: 1 } };
  assert.deepEqual(spreadStep({ things: [fire], grid: 100 }).out, ["a"]);
});

test("the cap limits how many catch in one round", () => {
  const fire = { id: "a", rect: { x: 0, y: 0, w: 100, h: 100 }, traits: { material: "wood" }, fire: { burning: true, roundsLeft: 3 } };
  const hot = (i, heat) => ({ id: `h${i}`, rect: { x: 100, y: 0, w: 100, h: 100 }, traits: { material: "wood" }, fire: { heat } });
  const r = spreadStep({ things: [fire, hot(1, 90), hot(2, 70), hot(3, 99)], grid: 100, cap: 2 });
  assert.deepEqual(r.caught, ["h3", "h1"]);
});

test("a burning thing with rounds left does not go out", () => {
  const fire = { id: "a", rect: { x: 0, y: 0, w: 100, h: 100 }, traits: { material: "wood" }, fire: { burning: true, roundsLeft: 3 } };
  assert.deepEqual(spreadStep({ things: [fire], grid: 100 }).out, []);
});

test("two sources add up on one target, and one source counts once", () => {
  const src = (id, x) => ({ id, rect: { x, y: 0, w: 100, h: 100 }, traits: { material: "wood" }, fire: { burning: true, roundsLeft: 3 } });
  const mid = { id: "m", rect: { x: 204, y: 0, w: 100, h: 100 }, traits: { material: "wood" }, fire: null };
  assert.equal(spreadStep({ things: [src("a", 100), src("b", 308), mid], grid: 100 }).heat[0].heat, 60);
  assert.equal(spreadStep({ things: [src("a", 100), mid], grid: 100 }).heat[0].heat, 30);
});

test("things sharing a level interact, and no levels means every level", () => {
  const fire = { id: "a", rect: { x: 0, y: 0, w: 100, h: 100 }, levels: ["L1", "L2"], traits: { material: "wood" }, fire: { burning: true, roundsLeft: 3 } };
  const mk = (levels) => ({ id: "b", rect: { x: 104, y: 0, w: 100, h: 100 }, levels, traits: { material: "wood" }, fire: null });
  assert.equal(spreadStep({ things: [fire, mk(["L2", "L3"])], grid: 100 }).heat[0].heat, 30);
  assert.equal(spreadStep({ things: [fire, mk([])], grid: 100 }).heat[0].heat, 30);
  assert.equal(spreadStep({ things: [fire, mk(undefined)], grid: 100 }).heat[0].heat, 30);
  const anywhere = { ...fire, levels: [] };
  assert.equal(spreadStep({ things: [anywhere, mk(["L9"])], grid: 100 }).heat[0].heat, 30);
});

test("a burning thing is never itself heated", () => {
  const a = { id: "a", rect: { x: 0, y: 0, w: 100, h: 100 }, traits: { material: "wood" }, fire: { burning: true, roundsLeft: 3 } };
  const b = { id: "b", rect: { x: 100, y: 0, w: 100, h: 100 }, traits: { material: "wood" }, fire: { burning: true, roundsLeft: 3 } };
  assert.deepEqual(spreadStep({ things: [a, b], grid: 100 }).heat, []);
});

test("a burning cell lights the cell beside it, faster downwind", () => {
  const cells = [{ i: 0, burning: true, roundsLeft: 2 }, { i: 1, heat: 0 }];
  const r = cellStep({ cells, cols: 4, rows: 1, cell: 100, origin: { x: 0, y: 0 } });
  assert.ok(r.heat.find((h) => h.i === 1).heat > 0);
  const windy = cellStep({ cells, cols: 4, rows: 1, cell: 100, origin: { x: 0, y: 0 }, wind: { angle: 0, strength: 1, outdoor: true } });
  assert.ok(windy.heat.find((h) => h.i === 1).heat > r.heat.find((h) => h.i === 1).heat);
});

test("a burning prop lights the grass under and beside it, and burning grass lights a prop", () => {
  const prop = { id: "a", rect: { x: 0, y: 0, w: 100, h: 100 }, traits: { material: "wood" }, fire: { burning: true, roundsLeft: 3 } };
  assert.ok(cellStep({ cells: [{ i: 1, heat: 0 }], things: [prop], cols: 4, rows: 1, cell: 100, origin: { x: 0, y: 0 } }).heat.length === 1);
  const cells = [{ i: 0, burning: true, roundsLeft: 2 }];
  const near = { id: "b", rect: { x: 0, y: 0, w: 100, h: 100 }, traits: { material: "wood" }, fire: null };
  assert.ok(spreadStep({ things: [near], cells, cols: 4, rows: 1, cell: 100, origin: { x: 0, y: 0 }, grid: 100 }).heat.length === 1);
});

test("a burnt cell stays burnt and never relights", () => {
  const cells = [{ i: 0, burning: true, roundsLeft: 1 }, { i: 1, charred: true, heat: 0 }];
  const r = cellStep({ cells, cols: 4, rows: 1, cell: 100, origin: { x: 0, y: 0 } });
  assert.deepEqual(r.out, [0]);
  assert.deepEqual(r.heat.filter((h) => h.i === 1), []);
});

test("the cap holds a huge field to a few cells a round, and the hottest are the ones that catch", () => {
  // Ten squares burn along the top; the ten under them are each heated past catching, the later ones hotter.
  const burning = Array.from({ length: 10 }, (_, i) => ({ i, burning: true, roundsLeft: 2 }));
  const below = Array.from({ length: 10 }, (_, k) => ({ i: 10 + k, heat: 60 + k }));
  const args = { cells: [...burning, ...below], cols: 10, rows: 2, cell: 100, origin: { x: 0, y: 0 } };
  assert.equal(cellStep({ ...args, cap: 100 }).caught.length, 10, "all ten are about to catch");
  const capped = cellStep({ ...args, cap: 3 }).caught;
  assert.equal(capped.length, 3);
  assert.deepEqual(capped, [19, 18, 17], "hottest first");
});

test("the cap holds the props too, hottest first, with grass fire beside them", () => {
  const cells = Array.from({ length: 6 }, (_, i) => ({ i, burning: true, roundsLeft: 2 }));
  const things = Array.from({ length: 6 }, (_, k) => ({ id: `p${k}`, rect: { x: k * 100, y: 100, w: 100, h: 100 }, traits: { material: "wood" }, fire: { heat: 40 + k * 2 } }));
  const args = { things, cells, cols: 6, cell: 100, origin: { x: 0, y: 0 }, grid: 100 };
  assert.equal(spreadStep({ ...args, cap: 100 }).caught.length, 6);
  const hottest = spreadStep({ ...args, cap: 100 }).heat.sort((a, b) => b.heat - a.heat).slice(0, 2).map((h) => h.id);
  assert.deepEqual(spreadStep({ ...args, cap: 2 }).caught, hottest);
});

test("a wall between burning grass and a prop stops it, as it stops a burning prop", () => {
  const cells = [{ i: 0, burning: true, roundsLeft: 2 }];
  const crate = { id: "c", rect: { x: 100, y: 0, w: 100, h: 100 }, traits: { material: "wood" }, fire: null };
  const args = { cells, cols: 4, rows: 1, cell: 100, origin: { x: 0, y: 0 }, grid: 100 };
  assert.equal(spreadStep({ ...args, things: [crate] }).heat.length, 1);
  assert.deepEqual(spreadStep({ ...args, things: [{ ...crate, blocked: [cellId(0)] }] }).heat, []);
  assert.deepEqual(spreadStep({ ...args, things: [{ ...crate, blocked: ["other"] }] }).heat.length, 1, "only the walled source is stopped");
  const own = [{ i: 0, id: "g0", burning: true, roundsLeft: 2 }];
  assert.deepEqual(spreadStep({ ...args, cells: own, things: [{ ...crate, blocked: ["g0"] }] }).heat, [], "a square's own id counts");
});

test("grass on another level does not reach a prop, and a prop on another level does not reach grass", () => {
  const crate = (levels) => ({ id: "c", rect: { x: 100, y: 0, w: 100, h: 100 }, traits: { material: "wood" }, fire: null, levels });
  const args = { cols: 4, rows: 1, cell: 100, origin: { x: 0, y: 0 }, grid: 100 };
  const grass = (levels) => [{ i: 0, burning: true, roundsLeft: 2, levels }];
  assert.equal(spreadStep({ ...args, cells: grass(["a"]), things: [crate(["a"])] }).heat.length, 1, "same level");
  assert.deepEqual(spreadStep({ ...args, cells: grass(["a"]), things: [crate(["b"])] }).heat, [], "other level");
  assert.equal(spreadStep({ ...args, cells: grass(undefined), things: [crate(["b"])] }).heat.length, 1, "no list means every level");
  const fire = (levels) => ({ id: "f", rect: { x: 0, y: 0, w: 100, h: 100 }, traits: { material: "wood" }, fire: { burning: true, roundsLeft: 3 }, levels });
  assert.equal(cellStep({ ...args, cells: [{ i: 1, heat: 0, levels: ["a"] }], things: [fire(["a"])] }).heat.length, 1);
  assert.deepEqual(cellStep({ ...args, cells: [{ i: 1, heat: 0, levels: ["b"] }], things: [fire(["a"])] }).heat, []);
});

test("the reach is one grass square both ways, whatever the prop grid", () => {
  const geo = { cols: 5, rows: 1, cell: 100, origin: { x: 0, y: 0 } };
  const box = (x) => ({ id: "p", rect: { x, y: 0, w: 100, h: 100 }, traits: { material: "wood" }, fire: null });
  const grass = [{ i: 0, burning: true, roundsLeft: 2 }];
  for (const grid of [50, 100, 400]) {
    // Grass at 0..100 to a prop at 200..300 (a gap of one square) reaches; at 300..400 (two squares) it does not.
    assert.equal(spreadStep({ ...geo, grid, cells: grass, things: [box(200)] }).heat.length, 1, `grass to prop a square off, grid ${grid}`);
    assert.deepEqual(spreadStep({ ...geo, grid, cells: grass, things: [box(300)] }).heat, [], `grass to prop two squares off, grid ${grid}`);
  }
  // The same distances, the other way round: a burning prop at 0..100, grass in square 2 (200..300) and square 3.
  const burning = { ...box(0), fire: { burning: true, roundsLeft: 3 } };
  assert.equal(cellStep({ ...geo, cells: [{ i: 2, heat: 0 }], things: [burning] }).heat.length, 1, "prop to grass a square off");
  assert.deepEqual(cellStep({ ...geo, cells: [{ i: 3, heat: 0 }], things: [burning] }).heat, [], "prop to grass two squares off");
});

test("cells heat only their four neighbours: no diagonals, no wrapping onto the next row", () => {
  const cells = [{ i: 5, burning: true, roundsLeft: 2 }, ...[0, 1, 2, 4, 6, 8, 9, 10].map((i) => ({ i, heat: 0 }))];
  const hit = cellStep({ cells, cols: 4, rows: 3, cell: 100, origin: { x: 0, y: 0 } }).heat.map((h) => h.i).sort((a, b) => a - b);
  assert.deepEqual(hit, [1, 4, 6, 9]);
  const edge = cellStep({ cells: [{ i: 3, burning: true, roundsLeft: 2 }, { i: 4, heat: 0 }], cols: 4, rows: 2, cell: 100, origin: { x: 0, y: 0 } });
  assert.deepEqual(edge.heat, []);
});

test("cell wind: only out of doors, only within 90 degrees, by 1 + 0.5 * strength", () => {
  const base = { cells: [{ i: 1, burning: true, roundsLeft: 2 }, { i: 0, heat: 0 }, { i: 2, heat: 0 }], cols: 3, rows: 1, cell: 100, origin: { x: 0, y: 0 } };
  const calm = cellStep(base).heat;
  const heatOf = (r, i) => r.find((h) => h.i === i).heat;
  assert.equal(heatOf(calm, 0), 30 * GRASS_RATE);
  const indoors = cellStep({ ...base, wind: { angle: 0, strength: 1, outdoor: false } }).heat;
  assert.equal(heatOf(indoors, 2), heatOf(calm, 2));
  const out = cellStep({ ...base, wind: { angle: 0, strength: 1, outdoor: true } }).heat;
  assert.equal(heatOf(out, 2), heatOf(calm, 2) * 1.5, "downwind");
  assert.equal(heatOf(out, 0), heatOf(calm, 0), "upwind");
});

test("a cell catches at the catch heat, adds to what it holds, and the rounds it burns are CELL_ROUNDS", () => {
  const r = cellStep({ cells: [{ i: 0, burning: true, roundsLeft: 2 }, { i: 1, heat: 80 }], cols: 2, rows: 1, cell: 100, origin: { x: 0, y: 0 } });
  assert.deepEqual(r.caught, [1]);
  assert.equal(r.heat[0].heat, 80 + 30 * GRASS_RATE);
  assert.equal(CELL_ROUNDS, 2);
});

test("a charred cell is never a source, even if it is marked burning", () => {
  const r = cellStep({ cells: [{ i: 0, charred: true, burning: true, roundsLeft: 1 }, { i: 1, heat: 0 }], cols: 2, rows: 1, cell: 100, origin: { x: 0, y: 0 } });
  assert.deepEqual(r.heat, []);
  assert.deepEqual(r.out, []);
});

test("burning grass heats a prop beside it, downwind first, and not one a square away", () => {
  const cells = [{ i: 0, burning: true, roundsLeft: 2 }];
  const east = { id: "e", rect: { x: 100, y: 0, w: 100, h: 100 }, traits: { material: "wood" }, fire: null };
  const args = { things: [east], cells, cols: 4, rows: 1, cell: 100, origin: { x: 0, y: 0 }, grid: 100 };
  const calm = spreadStep(args).heat[0].heat;
  assert.ok(spreadStep({ ...args, wind: { angle: 0, strength: 1, outdoor: true } }).heat[0].heat > calm);
  const far = { id: "f", rect: { x: 300, y: 0, w: 100, h: 100 }, traits: { material: "wood" }, fire: null };
  assert.deepEqual(spreadStep({ ...args, things: [far] }).heat, []);
});

test("grass burns by default, and a region's own say wins", () => {
  assert.equal(regionBurns({}, "grass"), true);
  assert.equal(regionBurns({}, "field"), true);
  assert.equal(regionBurns({}, "stone"), false);
  assert.equal(regionBurns({ burns: false }, "grass"), false);
  assert.equal(regionBurns({ burns: true }, "stone"), true);
});

test("a wall between two grass squares stops the spread, and only from the square it names", () => {
  const geo = { cols: 3, rows: 1, cell: 100, origin: { x: 0, y: 0 } };
  const fire = { i: 0, burning: true, roundsLeft: 2 };
  assert.equal(cellStep({ ...geo, cells: [fire, { i: 1, heat: 0 }] }).heat.length, 1, "open ground");
  assert.deepEqual(cellStep({ ...geo, cells: [fire, { i: 1, heat: 0, blocked: [cellId(0)] }] }).heat, [], "walled off");
  assert.equal(cellStep({ ...geo, cells: [fire, { i: 1, heat: 0, blocked: [cellId(2)] }] }).heat.length, 1, "a wall from another side does not stop it");
  assert.deepEqual(cellStep({ ...geo, cells: [{ ...fire, id: "g0" }, { i: 1, heat: 0, blocked: ["g0"] }] }).heat, [], "a square's own id counts");
  assert.equal(cellStep({ ...geo, cells: [{ ...fire, id: "g0" }, { i: 1, heat: 0, blocked: [cellId(0)] }] }).heat.length, 1, "and is no longer cell:<i>");
});

test("a wall stops a burning prop reaching grass, and grass on another level is not reached by the spread", () => {
  const geo = { cols: 3, rows: 1, cell: 100, origin: { x: 0, y: 0 } };
  const prop = { id: "torch", rect: { x: 0, y: 0, w: 100, h: 100 }, traits: { material: "wood" }, fire: { burning: true, roundsLeft: 3 } };
  assert.equal(cellStep({ ...geo, cells: [{ i: 1, heat: 0 }], things: [prop] }).heat.length, 1);
  assert.deepEqual(cellStep({ ...geo, cells: [{ i: 1, heat: 0, blocked: ["torch"] }], things: [prop] }).heat, []);
  const fire = (levels) => ({ i: 0, burning: true, roundsLeft: 2, levels });
  assert.equal(cellStep({ ...geo, cells: [fire(["a"]), { i: 1, heat: 0, levels: ["a"] }] }).heat.length, 1, "same level");
  assert.deepEqual(cellStep({ ...geo, cells: [fire(["a"]), { i: 1, heat: 0, levels: ["b"] }] }).heat, [], "other level");
  assert.equal(cellStep({ ...geo, cells: [fire(["a"]), { i: 1, heat: 0 }] }).heat.length, 1, "no list means every level");
});

test("heat and catching become tile updates, and going out clears the flag", () => {
  const step = { heat: [{ id: "t1", heat: 60 }], caught: ["t2"], out: ["t3"], warn: [] };
  const r = fireUpdatesFor(step, { tiles: [{ id: "t1" }, { id: "t2" }, { id: "t3" }] });
  assert.deepEqual(r.tiles.find((u) => u._id === "t1")["flags.animater.prop.fire"], { heat: 60, burning: false, roundsLeft: 0 });
  assert.equal(r.tiles.find((u) => u._id === "t2")["flags.animater.prop.fire"].burning, true);
  assert.equal(r.tiles.find((u) => u._id === "t2")["flags.animater.prop.fire"].roundsLeft, 3);
  assert.equal(r.tiles.find((u) => u._id === "t3")["flags.animater.prop.-=fire"], null);
});

test("a decoration key that no longer exists is dropped", () => {
  const stored = { "crate:3:4:0": { burning: true, roundsLeft: 2 }, "gone:1:1:0": { burning: true, roundsLeft: 1 } };
  assert.deepEqual(Object.keys(dropLostDecorFire(stored, ["crate:3:4:0"])), ["crate:3:4:0"]);
});

test("nothing to say makes no update at all", () => {
  assert.deepEqual(fireUpdatesFor({ heat: [], caught: [], out: [], warn: [] }, { tiles: [] }), { tiles: [], regions: [] });
});

// A crate beside a long-burning fire catches, then counts down every round until it goes out; the saved flag is carried forward.
function crateLife(rounds, region = false) {
  const key = "crate:3:4:0";
  const source = { id: "fire", rect: { x: 0, y: 0, w: 50, h: 50 }, traits: {}, fire: { heat: 100, burning: true, roundsLeft: 99 } };
  const crate = { id: region ? key : "crate", rect: { x: 50, y: 0, w: 50, h: 50 }, traits: { material: "plant" }, fire: null };
  const log = [];
  let stored = {};
  for (let n = 0; n < rounds; n++) {
    const step = spreadStep({ things: [source, crate] });
    const r = region
      ? fireUpdatesFor(step, { regions: [{ id: "r1", keys: [key], flags: { animater: { decorFire: stored } } }] })
      : fireUpdatesFor(step, { tiles: [{ id: "crate" }] });
    const u = region ? r.regions[0] : r.tiles[0];
    const flag = region ? "flags.animater.decorFire" : "flags.animater.prop.fire";
    const cleared = region ? `flags.animater.decorFire.-=${key}` :"flags.animater.prop.-=fire";
    if (u && flag in u) {
      crate.fire = region ? u[flag][key] : u[flag];
      stored = region ? u[flag] : stored;
    } else if (u && cleared in u) { crate.fire = null; stored = {}; }
    log.push(crate.fire ? crate.fire.roundsLeft : "cleared");
  }
  return log;
}

test("a crate's whole fire: catches at 3, then 2, then 1, then goes out and the flag is cleared", () => {
  assert.deepEqual(crateLife(4), [3, 2, 1, "cleared"]);
});

test("a decoration's whole fire counts down the same way in its region flag", () => {
  assert.deepEqual(crateLife(4, true), [3, 2, 1, "cleared"]);
});

test("a thing that catches this round is not also counted down", () => {
  const step = { heat: [], caught: ["a"], out: [], warn: [], burning: [{ id: "a", heat: 100, roundsLeft: 1 }] };
  assert.equal(fireUpdatesFor(step, { tiles: [{ id: "a" }] }).tiles[0]["flags.animater.prop.fire"].roundsLeft, 3);
  const gone = { heat: [], caught: [], out: ["a"], warn: [], burning: [{ id: "a", heat: 100, roundsLeft: 1 }] };
  assert.equal(fireUpdatesFor(gone, { tiles: [{ id: "a" }] }).tiles[0]["flags.animater.prop.-=fire"], null);
});

test("a grass square's whole fire: catches at CELL_ROUNDS, then one fewer, then out", () => {
  const cells = [{ i: 0, burning: true, roundsLeft: 99 }, { i: 1, heat: 60 }];
  const log = [];
  for (let n = 0; n < 3; n++) {
    const s = cellStep({ cells, cols: 2, rows: 1 });
    const c1 = cells[1];
    if (s.out.includes(1)) { c1.burning = false; c1.charred = true; log.push("out"); }
    else if (s.caught.includes(1)) { c1.burning = true; c1.roundsLeft = CELL_ROUNDS; log.push(c1.roundsLeft); }
    else if (s.burning.some((b) => b.i === 1)) { c1.roundsLeft = s.burning.find((b) => b.i === 1).roundsLeft; log.push(c1.roundsLeft); }
  }
  assert.deepEqual(log, [CELL_ROUNDS, 1, "out"]);
});

const none = { heat: [], caught: [], out: [], warn: [], burning: [] };
const dflag = (stored) => ({ animater: { decorFire: stored } });

test("a decoration going out is deleted from decorFire by key, the others untouched", () => {
  const stored = { "a:1:1:0": { heat: 100, burning: true, roundsLeft: 1 }, "b:2:2:0": { heat: 100, burning: true, roundsLeft: 2 } };
  const r = fireUpdatesFor({ ...none, out: ["a:1:1:0"], burning: [{ id: "b:2:2:0", heat: 100, roundsLeft: 1 }] },
    { regions: [{ id: "r1", keys: ["a:1:1:0", "b:2:2:0"], flags: dflag(stored) }] });
  assert.equal(r.regions.length, 1);
  assert.ok("flags.animater.decorFire.-=a:1:1:0" in r.regions[0]);
  assert.equal(r.regions[0]["flags.animater.decorFire.-=a:1:1:0"], null);
  assert.deepEqual(Object.keys(r.regions[0]["flags.animater.decorFire"]), ["b:2:2:0"]);
  assert.equal("flags.animater.-=decorFire" in r.regions[0], false);
});

test("a decoration key no longer painted is deleted by key, not left to merge back", () => {
  const stored = { "crate:3:4:0": { heat: 0, burning: true, roundsLeft: 2 }, "gone:1:1:0": { heat: 0, burning: true, roundsLeft: 1 } };
  const r = fireUpdatesFor(none, { regions: [{ id: "r1", keys: ["crate:3:4:0"], flags: dflag(stored) }] });
  assert.deepEqual(r.regions, [{ _id: "r1", "flags.animater.decorFire.-=gone:1:1:0": null }]);
});

test("a region with nothing to change makes no update", () => {
  const stored = { "a:1:1:0": { heat: 100, burning: true, roundsLeft: 2 } };
  assert.deepEqual(fireUpdatesFor(none, { regions: [{ id: "r1", keys: ["a:1:1:0"], flags: dflag(stored) }] }).regions, []);
});

test("readFire returns a burning fire even with no heat, and nothing for no fire", () => {
  assert.deepEqual(readFire({ burning: true, roundsLeft: 2 }), { heat: 0, burning: true, roundsLeft: 2 });
  assert.deepEqual(readFire({ flags: { animater: { prop: { fire: { heat: 60, burning: false, roundsLeft: 0 } } } } }), { heat: 60, burning: false, roundsLeft: 0 });
  assert.deepEqual(readFire({ fire: { heat: 10 } }), { heat: 10, burning: false, roundsLeft: 0 });
  assert.equal(readFire({ burning: false }), null);
  assert.equal(readFire({}), null);
  assert.equal(readFire(null), null);
});

test("writeFirePath names the tile flag, and is empty for an empty id", () => {
  assert.equal(writeFirePath("t1"), "flags.animater.prop.fire");
  assert.equal(writeFirePath(""), "");
  assert.equal(writeFirePath(undefined), "");
  assert.deepEqual(fireUpdatesFor({ ...none, caught: [""] }, { tiles: [{ id: "" }] }).tiles, []);
});

test("decorFireOf and fireCellsOf copy what the region saved, or give an empty object", () => {
  const saved = { "a:1:1:0": { burning: true, roundsLeft: 2 } };
  const got = decorFireOf({ flags: dflag(saved) });
  assert.deepEqual(got, saved);
  assert.notEqual(got, saved);
  assert.deepEqual(decorFireOf({}), {});
  assert.deepEqual(decorFireOf({ flags: dflag([1]) }), {});
  assert.deepEqual(fireCellsOf({ flags: { animater: { fireCells: { 4: { charred: true } } } } }), { 4: { charred: true } });
  assert.deepEqual(fireCellsOf(null), {});
});

test("precedence: out beats caught, caught beats burning, burning beats heated", () => {
  const tile = (step) => fireUpdatesFor({ ...none, ...step }, { tiles: [{ id: "a" }] }).tiles[0];
  assert.equal(tile({ out: ["a"], caught: ["a"] })["flags.animater.prop.-=fire"], null);
  assert.equal(tile({ caught: ["a"], burning: [{ id: "a", heat: 100, roundsLeft: 1 }] })["flags.animater.prop.fire"].roundsLeft, BURN_ROUNDS);
  assert.equal(tile({ burning: [{ id: "a", heat: 100, roundsLeft: 1 }], heat: [{ id: "a", heat: 70 }] })["flags.animater.prop.fire"].roundsLeft, 1);
  assert.equal(tile({ burning: [{ id: "a", heat: 100, roundsLeft: 1 }], heat: [{ id: "a", heat: 70 }] })["flags.animater.prop.fire"].burning, true);
  const key = "a:1:1:0";
  const reg = (step) => fireUpdatesFor({ ...none, ...step }, { regions: [{ id: "r", keys: [key], flags: dflag({ [key]: { heat: 100, burning: true, roundsLeft: 2 } }) }] }).regions[0];
  assert.equal(reg({ out: [key], caught: [key] })[`flags.animater.decorFire.-=${key}`], null);
  assert.equal(reg({ caught: [key], burning: [{ id: key, heat: 100, roundsLeft: 1 }] })["flags.animater.decorFire"][key].roundsLeft, BURN_ROUNDS);
  assert.equal(reg({ burning: [{ id: key, heat: 100, roundsLeft: 1 }], heat: [{ id: key, heat: 70 }] })["flags.animater.decorFire"][key].burning, true);
});

const fireCellsReg = (saved = {}) => ({ id: "r", cells: [3, 4, 5], flags: { animater: { fireCells: saved } } });
const cnone = { heat: [], caught: [], out: [], burning: [] };

test("grass squares are saved in fireCells: heated, caught, still burning", () => {
  const r = fireUpdatesFor(none, {
    regions: [fireCellsReg({ 5: { heat: 100, burning: true, roundsLeft: 2 } })],
    cellStep: { ...cnone, heat: [{ i: 3, heat: 42 }], caught: [4], burning: [{ i: 5, roundsLeft: 1 }] },
  });
  assert.deepEqual(r.regions[0]["flags.animater.fireCells"], {
    3: { heat: 42, burning: false, roundsLeft: 0 },
    4: { heat: 100, burning: true, roundsLeft: CELL_ROUNDS },
    5: { heat: 100, burning: true, roundsLeft: 1 },
  });
});

test("a grass square going out is kept as charred so it never relights, and is not re-charred", () => {
  const r = fireUpdatesFor(none, { regions: [fireCellsReg({ 3: { heat: 100, burning: true, roundsLeft: 1 } })], cellStep: { ...cnone, out: [3] } });
  assert.deepEqual(r.regions[0]["flags.animater.fireCells"], { 3: { heat: 0, burning: false, roundsLeft: 0, charred: true } });
  const again = fireUpdatesFor(none, {
    regions: [fireCellsReg({ 3: { heat: 0, burning: false, roundsLeft: 0, charred: true } })],
    cellStep: { ...cnone, heat: [{ i: 3, heat: 90 }], caught: [3] },
  });
  assert.deepEqual(again.regions, []);
});

test("a saved grass square the region no longer has is deleted by key", () => {
  const r = fireUpdatesFor(none, { regions: [fireCellsReg({ 9: { heat: 5, burning: false, roundsLeft: 0 } })], cellStep: cnone });
  assert.deepEqual(r.regions, [{ _id: "r", "flags.animater.fireCells.-=9": null }]);
});

test("grass precedence: out beats caught, caught beats burning, burning beats heated", () => {
  const cell = (step) => fireUpdatesFor(none, { regions: [fireCellsReg()], cellStep: { ...cnone, ...step } }).regions[0]["flags.animater.fireCells"][3];
  assert.equal(cell({ out: [3], caught: [3] }).charred, true);
  assert.equal(cell({ caught: [3], burning: [{ i: 3, roundsLeft: 1 }] }).roundsLeft, CELL_ROUNDS);
  assert.equal(cell({ burning: [{ i: 3, roundsLeft: 1 }], heat: [{ i: 3, heat: 40 }] }).burning, true);
});
