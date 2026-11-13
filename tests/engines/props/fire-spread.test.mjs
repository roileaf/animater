import test from "node:test";
import assert from "node:assert/strict";
import { fireRate, spreadStep, cellStep, GRASS_RATE, CELL_ROUNDS, regionBurns } from "../../../scripts/engines/props/fire-spread.mjs";

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

test("the cap holds a huge field to a few cells a round", () => {
  const cells = [{ i: 0, burning: true, roundsLeft: 2 }, ...Array.from({ length: 30 }, (_, k) => ({ i: k + 1, heat: 99 }))];
  assert.ok(cellStep({ cells, cols: 40, rows: 1, cell: 100, origin: { x: 0, y: 0 }, cap: 8 }).caught.length <= 8);
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
