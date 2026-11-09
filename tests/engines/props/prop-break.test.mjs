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
