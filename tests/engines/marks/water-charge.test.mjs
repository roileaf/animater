// Lightning on water (scripts/engines/marks/water-charge.mjs): the plan of one strike, and its wiring in main.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chargePlan, chargeSpan, CHARGE_MS } from "../../../scripts/engines/marks/water-charge.mjs";

const pond = [0, 0, 1000, 0, 1000, 600, 0, 600];
const inPond = (p) => p.x >= 0 && p.x <= 1000 && p.y >= 0 && p.y <= 600;

test("a strike on water runs out from where it struck and never past the bank", () => {
  const plan = chargePlan({ spots: [{ x: 500, y: 300, r: 80 }], waters: [pond], seed: 7, grid: 100 });
  assert.deepEqual(plan.at, { x: 500, y: 300 });
  assert.equal(plan.pond, pond);
  assert.ok(plan.arcs.length > 40, "arcs to draw");
  for (const a of plan.arcs) for (const p of [{ x: a.x0, y: a.y0 }, { x: a.x1, y: a.y1 }]) assert.ok(inPond({ x: p.x + 500, y: p.y + 300 }), "inside the water");
  assert.ok(plan.arcs.some((a) => a.far === 0) && plan.arcs.some((a) => a.far > 200), "each piece knows how far along the run it lies");
  assert.ok(plan.speed > 0 && plan.reach > 0 && CHARGE_MS > 1000);
});

test("the same seed gives the same strike on every screen, another seed another", () => {
  const make = (seed) => chargePlan({ spots: [{ x: 500, y: 300, r: 80 }], waters: [pond], seed, grid: 100 }).arcs;
  assert.deepEqual(make(7), make(7));
  assert.notDeepEqual(make(7), make(8));
});

test("it finds the creatures standing in that water, and no others", () => {
  const tokens = [{ x: 600, y: 300, r: 40 }, { x: 1200, y: 300, r: 40 }, { x: 100, y: 500 }];
  const plan = chargePlan({ spots: [{ x: 500, y: 300, r: 80 }], waters: [pond], tokens, seed: 3, grid: 100 });
  assert.equal(plan.grabs.length, 2, "the one on the bank is left alone");
  assert.deepEqual({ dx: plan.grabs[0].dx, dy: plan.grabs[0].dy, r: plan.grabs[0].r, d: plan.grabs[0].d }, { dx: 100, dy: 0, r: 40, d: 100 });
  assert.equal(plan.grabs[1].r, 50, "a creature with no size given is one square");
  // Too far across a lake to be found.
  const lake = [0, 0, 5000, 0, 5000, 600, 0, 600];
  assert.equal(chargePlan({ spots: [{ x: 100, y: 300, r: 80 }], waters: [lake], tokens: [{ x: 3000, y: 300 }], grid: 100 }).grabs.length, 0);
});

test("no water under the strike, or ice over it, is no charge at all", () => {
  assert.equal(chargePlan({ spots: [], waters: [pond] }), null);
  assert.equal(chargePlan({ spots: [{ x: 2000, y: 300, r: 80 }], waters: [pond] }), null, "a spot outside every water");
  assert.equal(chargePlan({ spots: [{ x: 500, y: 300, r: 80 }], waters: [pond], wet: () => false }), null, "ice");
  assert.equal(chargePlan({ spots: [{ x: 500, y: 300, r: 80 }], waters: [pond], wet: () => { throw new Error("x"); } }), null);
  // The next stretch of water is taken when the widest is frozen.
  const other = [2000, 0, 2400, 0, 2400, 400, 2000, 400];
  const plan = chargePlan({ spots: [{ x: 500, y: 300, r: 80 }, { x: 2200, y: 200, r: 40 }], waters: [pond, other], wet: (p) => p.x > 1500 });
  assert.equal(plan.pond, other);
});

test("an island in the water stops the arcs and holds no creature in the water", () => {
  const water = Object.assign([...pond], { holes: [[600, 200, 800, 200, 800, 400, 600, 400]] });
  const plan = chargePlan({ spots: [{ x: 300, y: 300, r: 80 }], waters: [water], tokens: [{ x: 700, y: 300 }], seed: 5, grid: 100 });
  assert.equal(plan.grabs.length, 0);
  for (const a of plan.arcs) { const x = a.x1 + 300, y = a.y1 + 300; assert.ok(!(x > 600 && x < 800 && y > 200 && y < 400), "not across the island"); }
});

test("main.mjs: lightning's burn lines stay off water, and the charge plays as an element reaction", () => {
  const main = readFileSync(new URL("../../../scripts/main.mjs", import.meta.url), "utf8").replace(/\r\n/g, "\n");
  assert.ok(main.includes('["scorch", "rime", "streaks"].includes(tag?.mark)'));
  assert.ok(main.includes('if (record?.tag?.mark === "streaks") propSafe("water charge", () => {'));
  assert.ok(main.includes('movementFeelFloor(p, doc) === "water"'), "open water only: not the ice over it");
  assert.ok(main.includes('markReactions.play({ kind: "charge", durationMs: span.durationMs, at: plan.at'), "under the Element reactions switch, nothing written");
  assert.ok(main.includes('const span = chargeSpan(areaPlayLeft(record.tag.regionId));'), "for as long as the spell's animation plays");
  const fx = readFileSync(new URL("../../../scripts/engines/marks/reaction-fx.mjs", import.meta.url), "utf8");
  assert.ok(fx.includes("case 'charge':"));
});

test("a strike lasts as long as its spell's animation still plays, and never less than its own run", () => {
  assert.deepEqual(chargeSpan(0), { durationMs: CHARGE_MS, hold: 0.95 });
  assert.deepEqual(chargeSpan(500), { durationMs: CHARGE_MS, hold: 0.95 });
  const long = chargeSpan(5000);
  assert.equal(long.hold, 5);
  assert.ok(long.durationMs >= 5000 + 750, "the animation's length, and then the dying away");
  assert.equal(chargePlan({ spots: [{ x: 500, y: 300, r: 80 }], waters: [pond], hold: 5 }).hold, 5);
  assert.equal(chargePlan({ spots: [{ x: 500, y: 300, r: 80 }], waters: [pond] }).hold, 0.95);
});
