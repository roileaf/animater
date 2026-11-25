import test from "node:test";
import assert from "node:assert/strict";
import { spreadStep, cellStep, fireUpdatesFor, readFire, burnRoundsOf, freshFire, fireHeats, BURN_ROUNDS, CELL_ROUNDS, BURN_ROUNDS_MOST, HEAT_CATCH, NEAR_HEAT } from "../../../scripts/engines/props/fire-spread.mjs";
import { areaCatch, areaCellCatch, areaCellsLit } from "../../../scripts/engines/props/fire-rounds.mjs";
import { propSceneFieldsHTML } from "../../../scripts/ui/prop-config.mjs";

const wood = { material: "wood", contents: "none" };
const rect = (x) => ({ x, y: 0, w: 100, h: 100 });

test("a scene with no burn time set burns as it always has", () => {
  for (const v of [undefined, null, "", 0, -4, "abc", NaN, 3, 2, 1]) assert.equal(burnRoundsOf(v, BURN_ROUNDS), BURN_ROUNDS, String(v));
  assert.equal(burnRoundsOf(2, CELL_ROUNDS), CELL_ROUNDS);
  assert.deepEqual(freshFire(HEAT_CATCH, { base: BURN_ROUNDS }), { heat: HEAT_CATCH, burning: true, roundsLeft: BURN_ROUNDS });
  assert.deepEqual(freshFire(HEAT_CATCH, { rounds: 3, base: BURN_ROUNDS }), { heat: HEAT_CATCH, burning: true, roundsLeft: BURN_ROUNDS });
});

test("a burn time longer than the usual is the rounds a fire burns, whole and capped", () => {
  assert.equal(burnRoundsOf(20, BURN_ROUNDS), 20);
  assert.equal(burnRoundsOf("20", BURN_ROUNDS), 20);
  assert.equal(burnRoundsOf(7.9, BURN_ROUNDS), 7);
  assert.equal(burnRoundsOf(3, CELL_ROUNDS), 3);
  assert.equal(burnRoundsOf(1e9, BURN_ROUNDS), BURN_ROUNDS_MOST);
});

test("a long fire is lit with the usual rounds of spread and no more", () => {
  assert.deepEqual(freshFire(HEAT_CATCH, { rounds: 20, base: BURN_ROUNDS }), { heat: HEAT_CATCH, burning: true, roundsLeft: 20, spread: BURN_ROUNDS });
  assert.deepEqual(freshFire(HEAT_CATCH, { rounds: 20, base: CELL_ROUNDS }), { heat: HEAT_CATCH, burning: true, roundsLeft: 20, spread: CELL_ROUNDS });
});

test("a fire heats its neighbours unless its spread is spent", () => {
  assert.equal(fireHeats({ burning: true, roundsLeft: 2 }), true);
  assert.equal(fireHeats({ burning: true, roundsLeft: 9, spread: 1 }), true);
  assert.equal(fireHeats({ burning: true, roundsLeft: 9, spread: 0 }), false);
});

test("a saved fire keeps its spread, and one without it reads as before", () => {
  assert.deepEqual(readFire({ heat: 100, burning: true, roundsLeft: 9, spread: 2 }), { heat: 100, burning: true, roundsLeft: 9, spread: 2 });
  assert.deepEqual(readFire({ heat: 100, burning: true, roundsLeft: 2 }), { heat: 100, burning: true, roundsLeft: 2 });
});

// A fire carried round by round the way the scene's own tick carries it: step, then write, then read back.
function burnOn(fire, rounds) {
  let source = { id: "a", rect: rect(0), traits: wood, fire };
  let heatGiven = 0, lasted = 0;
  for (let n = 0; n < rounds && source.fire?.burning; n++) {
    const step = spreadStep({ things: [source, { id: "b", rect: rect(200), traits: { material: "stone", contents: "books" }, fire: null }], cap: 0 });
    heatGiven += step.heat.find((h) => h.id === "b")?.heat ?? 0;
    lasted++;
    const next = step.burning.find((b) => b.id === "a");
    source = { ...source, fire: next ? { burning: true, ...next } : null };
  }
  return { heatGiven, lasted };
}

test("a long fire burns its whole time but heats what is beside it only as long as a usual one", () => {
  const rate = 1.6; // books
  const usual = burnOn(freshFire(HEAT_CATCH, { base: BURN_ROUNDS }), 100);
  const long = burnOn(freshFire(HEAT_CATCH, { rounds: 20, base: BURN_ROUNDS }), 100);
  assert.equal(usual.lasted, BURN_ROUNDS);
  assert.equal(long.lasted, 20);
  assert.equal(usual.heatGiven, NEAR_HEAT * rate * BURN_ROUNDS);
  assert.equal(long.heatGiven, usual.heatGiven);
});

test("a long fire that has stopped spreading is still counted down, and still goes out", () => {
  const things = [{ id: "a", rect: rect(0), traits: wood, fire: { heat: 100, burning: true, roundsLeft: 5, spread: 0 } }, { id: "b", rect: rect(100), traits: wood, fire: null }];
  const step = spreadStep({ things });
  assert.deepEqual(step.heat, []);
  assert.deepEqual(step.burning, [{ id: "a", heat: 100, roundsLeft: 4, spread: 0 }]);
  const last = spreadStep({ things: [{ ...things[0], fire: { heat: 100, burning: true, roundsLeft: 1, spread: 0 } }, things[1]] });
  assert.deepEqual(last.out, ["a"]);
});

test("a long-burning prop that has stopped spreading does not set the grass under it going", () => {
  const cells = [{ i: 0 }, { i: 1 }];
  const spent = cellStep({ cells, cols: 2, rows: 1, things: [{ id: "a", rect: rect(0), fire: { heat: 100, burning: true, roundsLeft: 9, spread: 0 } }] });
  assert.deepEqual(spent.heat, []);
  const fresh = cellStep({ cells, cols: 2, rows: 1, things: [{ id: "a", rect: rect(0), fire: { heat: 100, burning: true, roundsLeft: 9, spread: 2 } }] });
  assert.equal(fresh.heat.length, 2);
});

test("a long-burning grass square heats the next one only while its spread lasts, and props likewise", () => {
  const lit = (spread) => [{ i: 0, burning: true, roundsLeft: 9, heat: 100, spread }, { i: 1 }];
  const on = cellStep({ cells: lit(1), cols: 2, rows: 1 });
  assert.equal(on.heat.length, 1);
  assert.deepEqual(on.burning, [{ i: 0, roundsLeft: 8, spread: 0 }]);
  const off = cellStep({ cells: lit(0), cols: 2, rows: 1 });
  assert.deepEqual(off.heat, []);
  assert.deepEqual(off.burning, [{ i: 0, roundsLeft: 8, spread: 0 }]);
  const prop = { id: "b", rect: rect(100), traits: wood, fire: null };
  assert.equal(spreadStep({ things: [prop], cells: [{ i: 0, burning: true, spread: 1 }], cols: 2 }).heat.length, 1);
  assert.deepEqual(spreadStep({ things: [prop], cells: [{ i: 0, burning: true, spread: 0 }], cols: 2 }).heat, []);
});

test("what catches on a scene with a burn time starts at it; with none, at the usual rounds", () => {
  const step = { heat: [{ id: "t", heat: 120 }, { id: "k", heat: 110 }], caught: ["t", "k"], out: [], burning: [] };
  const cellSteps = { r: { heat: [{ i: 4, heat: 130 }], caught: [4], out: [], burning: [] } };
  const regions = [{ id: "r", keys: ["k"], cells: [4], flags: {} }];
  const long = fireUpdatesFor(step, { tiles: [{ id: "t" }], regions, cellSteps, burnRounds: 12 });
  assert.deepEqual(long.tiles, [{ _id: "t", "flags.animater.prop.fire": { heat: 120, burning: true, roundsLeft: 12, spread: BURN_ROUNDS } }]);
  assert.deepEqual(long.regions, [{ _id: "r",
    "flags.animater.decorFire.k": { heat: 110, burning: true, roundsLeft: 12, spread: BURN_ROUNDS },
    "flags.animater.fireCells.4": { heat: 130, burning: true, roundsLeft: 12, spread: CELL_ROUNDS } }]);
  const usual = fireUpdatesFor(step, { tiles: [{ id: "t" }], regions, cellSteps });
  assert.deepEqual(usual.tiles, [{ _id: "t", "flags.animater.prop.fire": { heat: 120, burning: true, roundsLeft: BURN_ROUNDS } }]);
  assert.deepEqual(usual.regions[0]["flags.animater.fireCells.4"], { heat: 130, burning: true, roundsLeft: CELL_ROUNDS });
});

test("a long fire still burning is written with what is left of its spread", () => {
  const step = { heat: [], caught: [], out: [], burning: [{ id: "t", heat: 100, roundsLeft: 8, spread: 1 }] };
  assert.deepEqual(fireUpdatesFor(step, { tiles: [{ id: "t" }] }).tiles, [{ _id: "t", "flags.animater.prop.fire": { heat: 100, burning: true, roundsLeft: 8, spread: 1 } }]);
  const cellSteps = { r: { heat: [], caught: [], out: [], burning: [{ i: 4, roundsLeft: 8, spread: 0 }] } };
  const got = fireUpdatesFor({}, { regions: [{ id: "r", keys: [], cells: [4], flags: { animater: { fireCells: { 4: { heat: 100, burning: true, roundsLeft: 9, spread: 1 } } } } }], cellSteps });
  assert.deepEqual(got.regions[0]["flags.animater.fireCells.4"], { heat: 100, burning: true, roundsLeft: 8, spread: 0 });
});

test("a fire area lights things and grass for the scene's burn time", () => {
  const args = { fireSpreads: true, kind: "area", damageType: "fire" };
  assert.deepEqual(areaCatch({ ...args, traits: wood, burnRounds: 10 }), { heat: HEAT_CATCH, burning: true, roundsLeft: 10, spread: BURN_ROUNDS });
  assert.deepEqual(areaCatch({ ...args, traits: wood }), { heat: HEAT_CATCH, burning: true, roundsLeft: BURN_ROUNDS });
  assert.deepEqual(areaCellCatch({ ...args, burns: true, burnRounds: 10 }), { heat: HEAT_CATCH, burning: true, roundsLeft: 10, spread: CELL_ROUNDS });
  assert.deepEqual(areaCellCatch({ ...args, burns: true }), { heat: HEAT_CATCH, burning: true, roundsLeft: CELL_ROUNDS });
  const lit = areaCellsLit({ ...args, burnRounds: 10, inArea: () => true, regions: [{ id: "r", burns: true, cells: [{ i: 0, point: { x: 0, y: 0 }, saved: null }] }] });
  assert.equal(lit.regions[0]["flags.animater.fireCells.0"].roundsLeft, 10);
});

test("the scene form offers the burn time, empty until the GM sets one", () => {
  const empty = propSceneFieldsHTML({});
  assert.match(empty, /<input type="number"[^>]*name="flags\.animater\.fireBurnRounds"[^>]*value=""/);
  assert.match(propSceneFieldsHTML({ burnRounds: 20 }), /name="flags\.animater\.fireBurnRounds"[^>]*value="20"/);
  assert.match(propSceneFieldsHTML({ burnRounds: "junk" }), /name="flags\.animater\.fireBurnRounds"[^>]*value=""/);
});
