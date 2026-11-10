import test from "node:test";
import assert from "node:assert/strict";
import { breakLook, brokenNote, readNote, missBreaks } from "../../../scripts/engines/props/prop-break.mjs";

test("each material breaks its own way; fire scorches, cold frosts", () => {
  const w = breakLook({ material: "wood", shape: "round", damageType: "fire" });
  assert.deepEqual([w.stage.pattern, w.stage.pieces, w.stage.keep, w.wreckTint, w.mark], ["shards", 10, true, 0x8a6f60, "scorch"]);
  assert.equal(breakLook({ material: "wood", shape: "boxy", damageType: "bludgeoning" }).stage.pattern, "diced");
  assert.equal(breakLook({ material: "clay", shape: "round", damageType: "cold" }).mark, "frost");
  assert.equal(breakLook({ material: "wood", shape: "round", slam: { size: 1 } }).mark, "dust");
});
test("the stage carries the look's numbers and the named tint", () => {
  const s = (o) => breakLook({ shape: "round", ...o }).stage;
  assert.deepEqual([s({ material: "wood" }).spread, s({ material: "wood" }).spin, s({ material: "wood" }).fall, s({ material: "wood" }).duration], [0.32, 120, 0, 1400]);
  assert.deepEqual([s({ material: "wood", shape: "boxy" }).pieces, s({ material: "wood", shape: "boxy" }).spread, s({ material: "wood", shape: "boxy" }).spin], [3, 0.45, 70]);
  assert.deepEqual([s({ material: "clay" }).pattern, s({ material: "clay" }).pieces, s({ material: "clay" }).spread, s({ material: "clay" }).spin], ["crush", 3, 0.28, 90]);
  assert.deepEqual([s({ material: "glass" }).pattern, s({ material: "glass" }).pieces, s({ material: "glass" }).spread, s({ material: "glass" }).spin], ["shards", 10, 0.3, 150]);
  for (const m of ["metal", "stone"]) assert.deepEqual([s({ material: m }).pattern, s({ material: m }).pieces, s({ material: m }).spread, s({ material: m }).spin], ["crush", 2, 0.2, 40]);
  assert.equal(s({ material: "wood", damageType: "fire" }).tint, "scorched");
  assert.equal(s({ material: "wood", damageType: "cold" }).tint, "frosted");
  assert.equal(s({ material: "wood", damageType: "bludgeoning" }).tint, "none");
  const r = (damageType) => breakLook({ material: "wood", shape: "round", damageType });
  assert.deepEqual([r("cold").wreckTint, r("acid").mark, r("electricity").mark, r("acid").wreckTint], [0xcfe4f2, "stain", "burn", null]);
});
test("the note round-trips and junk is refused", () => {
  const look = breakLook({ material: "wood", shape: "round", damageType: "fire" });
  const note = brokenNote({ seed: 12, cutAngle: 0.5, look, from: { x: 10, y: 20 }, walls: ["w1"], size: 1 });
  assert.equal(note.tint, "scorched");
  assert.deepEqual(readNote(JSON.parse(JSON.stringify(note))), note);
  assert.equal(readNote({ seed: "x" }), null);
  assert.equal(readNote(null), null);
  assert.equal(readNote({ ...note, walls: Array(500).fill("w") })?.walls.length, 64);
  assert.equal(readNote({ ...note, pattern: "evil" }), null);
  assert.equal(readNote({ ...note, tint: "evil" }), null);
  assert.equal(readNote({ ...note, mark: "evil" }), null);
});
test("a critical failure always breaks; a miss by the chance; a hit never", () => {
  assert.equal(missBreaks("criticalFailure", 0, 0.99), true);
  assert.equal(missBreaks("miss", 25, 0.24), true);
  assert.equal(missBreaks("miss", 25, 0.25), false);
  assert.equal(missBreaks("hit", 100, 0), false);
  assert.equal(missBreaks("criticalSuccess", 100, 0), false);
});
test("old notes read as shatter with no lights; a bad style is refused", () => {
  const old = { seed: 9, cutAngle: 0.4, pattern: "shards", pieces: 10, spread: 0.32, spin: 120, tint: "none", mark: "dust", from: { x: 0, y: 0 }, walls: [] };
  assert.equal(readNote(old).style, "shatter");
  assert.deepEqual(readNote(old).lights, []);
  assert.equal(readNote({ ...old, style: "evil" }), null);
  assert.equal(readNote({ ...old, style: "collapse" }).style, "collapse");
});
test("brokenNote always writes style and lights; lights are capped on read", () => {
  const look = breakLook({ material: "wood" });
  const n = brokenNote({ seed: 1, cutAngle: 0, look, from: { x: 0, y: 0 }, walls: [], size: 1 });
  assert.equal(n.style, "shatter");
  assert.deepEqual(n.lights, []);
  assert.equal(brokenNote({ seed: 1, cutAngle: 0, look, from: { x: 0, y: 0 }, walls: [], size: 1, style: "collapse" }).style, "collapse");
  const many = Array.from({ length: 20 }, (_, i) => `L${i}`);
  const read = readNote({ ...n, lights: [...many, "x".repeat(33), 7] });
  assert.equal(read.lights.length, 16);
  assert.deepEqual(read.lights, many.slice(0, 16));
  const again = readNote({ ...n, style: "collapse", lights: ["a"] });
  assert.deepEqual(readNote(again), again);
});

test("a fire note keeps fire: true; anything else drops it", () => {
  const look = breakLook({ material: "glass" });
  const n = brokenNote({ seed: 1, cutAngle: 0, look, from: { x: 0, y: 0 }, walls: [], size: 1 });
  assert.equal("fire" in n, false);
  assert.equal(brokenNote({ seed: 1, cutAngle: 0, look, from: { x: 0, y: 0 }, walls: [], size: 1, fire: true }).fire, true);
  assert.equal("fire" in brokenNote({ seed: 1, cutAngle: 0, look, from: { x: 0, y: 0 }, walls: [], size: 1, fire: "yes" }), false);
  assert.equal(readNote({ ...n, fire: true }).fire, true);
  assert.equal("fire" in readNote({ ...n, fire: "true" }), false);
  assert.equal("fire" in readNote(n), false);
  const lit = readNote({ ...n, fire: true });
  assert.deepEqual(readNote(JSON.parse(JSON.stringify(lit))), lit);
});
