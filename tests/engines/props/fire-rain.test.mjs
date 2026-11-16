import test from "node:test";
import assert from "node:assert/strict";
import { spreadStep, cellStep, wetness, dampFactor, rainCooling, soakedRounds, DAMP_MOST, COOL_MOST, NEAR_HEAT, TOUCH_HEAT, GRASS_RATE, CELL_ROUNDS } from "../../../scripts/engines/props/fire-spread.mjs";

// A barn fire in a downpour: rain is the one thing every table expects to fight a fire, and until now the weather
// did nothing but bend the flames. The wet comes in on the same object the wind does, so one weather reading serves.
const dry = { outdoor: true, angle: 0, strength: 0 };
const pouring = { outdoor: true, angle: 0, strength: 0, wet: 1 };
const indoors = { outdoor: false, angle: 0, strength: 0, wet: 1 };

const crate = (id, x) => ({ id, rect: { x, y: 0, w: 100, h: 100 }, traits: { material: "wood" }, fire: null });
const burner = (id, x, roundsLeft = 3) => ({ id, rect: { x, y: 0, w: 100, h: 100 }, traits: { material: "wood" }, fire: { burning: true, heat: 100, roundsLeft } });
const heatOf = (r, id) => r.heat.find((h) => h.id === id)?.heat;

test("the wet is what falls out of doors, nothing indoors and nothing of a dry sky", () => {
  assert.equal(wetness(pouring), 1);
  assert.equal(wetness(dry), 0, "a dry sky soaks nothing");
  assert.equal(wetness(indoors), 0, "rain does not fall through a roof");
  assert.equal(wetness(null), 0);
  assert.equal(wetness({ outdoor: true, wet: 0.4 }), 0.4, "drizzle is its own share");
  assert.equal(wetness({ outdoor: true, wet: 7 }), 1, "no more than soaked");
  assert.equal(wetness({ outdoor: true, wet: -3 }), 0);
});

test("rain damps the heat a fire gives what stands beside it", () => {
  assert.equal(dampFactor(dry), 1);
  assert.equal(dampFactor(pouring), 1 - DAMP_MOST);
  assert.ok(dampFactor({ outdoor: true, wet: 0.5 }) > dampFactor(pouring), "drizzle damps less than a downpour");

  const sunny = spreadStep({ things: [burner("a", 0), crate("b", 104)], wind: dry, grid: 100 });
  assert.equal(heatOf(sunny, "b"), NEAR_HEAT);

  // A drizzle: what reaches the crate is damped, and the rain takes its own cooling off on top.
  const drizzle = { outdoor: true, angle: 0, strength: 0, wet: 0.2 };
  const light = spreadStep({ things: [burner("a", 0), crate("b", 104)], wind: drizzle, grid: 100 });
  assert.equal(heatOf(light, "b"), NEAR_HEAT * dampFactor(drizzle) - rainCooling(drizzle));
  assert.ok(heatOf(light, "b") < heatOf(sunny, "b"));

  // A downpour: a square away, a crate beside a burning crate never even gets warm.
  const wet = spreadStep({ things: [burner("a", 0), crate("b", 104)], wind: pouring, grid: 100 });
  assert.equal(heatOf(wet, "b"), 0, "the rain takes off more than the fire puts on");
});

test("the same rain changes nothing in a room with a roof on it", () => {
  const inside = spreadStep({ things: [burner("a", 0), crate("b", 100)], wind: indoors, grid: 100 });
  assert.equal(heatOf(inside, "b"), TOUCH_HEAT, "touching, and dry under the roof");
});

test("rain cools what is smouldering but has not caught, and never past cold", () => {
  assert.equal(rainCooling(dry), 0);
  assert.equal(rainCooling(pouring), COOL_MOST);

  // No fire anywhere near it: a prop left half-heated by a fire that went out dries back to nothing in the rain.
  const warm = { ...crate("b", 0), fire: { burning: false, heat: 70 } };
  const r = spreadStep({ things: [warm], wind: pouring, grid: 100 });
  assert.equal(heatOf(r, "b"), 70 - COOL_MOST);

  const nearly = { ...crate("c", 0), fire: { burning: false, heat: 10 } };
  const cold = spreadStep({ things: [nearly], wind: pouring, grid: 100 });
  assert.equal(heatOf(cold, "c"), 0, "cold is as low as it goes");

  const dryDay = spreadStep({ things: [warm], wind: dry, grid: 100 });
  assert.equal(heatOf(dryDay, "b"), undefined, "a dry day leaves it exactly as it was");
});

test("rain beats a fire that would otherwise have caught", () => {
  // Touching a fire, and a barrel of lamp oil at that (rate 2, so one round is enough): dry it catches, in a
  // downpour it does not.
  const oil = { ...crate("b", 100), traits: { material: "wood", contents: "lampoil" } };
  const things = [burner("a", 0), oil];
  assert.deepEqual(spreadStep({ things, wind: dry, grid: 100 }).caught, ["b"]);
  assert.deepEqual(spreadStep({ things, wind: pouring, grid: 100 }).caught, []);
});

test("a fire burns out sooner in the rain", () => {
  assert.equal(soakedRounds(dry), 0);
  assert.equal(soakedRounds(pouring), 1);
  assert.equal(soakedRounds({ outdoor: true, wet: 0.2 }), 0, "a drizzle does not put it out, it only slows it");

  const long = [burner("a", 0, 3)];
  assert.equal(spreadStep({ things: long, wind: dry, grid: 100 }).burning[0].roundsLeft, 2);
  assert.equal(spreadStep({ things: long, wind: pouring, grid: 100 }).burning[0].roundsLeft, 1, "the rain takes a round off it");

  const last = [burner("a", 0, 2)];
  assert.deepEqual(spreadStep({ things: last, wind: dry, grid: 100 }).out, [], "dry it has a round in hand");
  assert.deepEqual(spreadStep({ things: last, wind: pouring, grid: 100 }).out, ["a"], "wet, that round is gone");
});

test("rain runs through burning grass as well", () => {
  const geo = { cells: [{ i: 0, burning: true, roundsLeft: CELL_ROUNDS }, { i: 1 }], cols: 4, rows: 4, origin: { x: 0, y: 0 }, cell: 100 };
  const sunny = cellStep({ ...geo, wind: dry });
  const wet = cellStep({ ...geo, wind: pouring });
  const heat = (r, i) => r.heat.find((h) => h.i === i)?.heat;
  assert.equal(heat(sunny, 1), NEAR_HEAT * GRASS_RATE);
  assert.equal(heat(wet, 1), NEAR_HEAT * GRASS_RATE * (1 - DAMP_MOST));
});
