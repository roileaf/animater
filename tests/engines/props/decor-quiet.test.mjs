import test from "node:test";
import assert from "node:assert/strict";
import { decorPrunedRubble, decorOnlySave, decorRubbleId } from "../../../scripts/engines/props/decor-break.mjs";

const rubble = (id, owner) => ({ id, flags: { animater: { propRubble: owner } } });
const entry = (key, region) => ({ key, kind: "stalagmite", x: 1, y: 1, note: { seed: 1, ...(region ? { region } : {}) } });

test("a pruned toppled entry's own rubble is deleted with it", () => {
  const regions = [rubble("RUB1", decorRubbleId("R1")), rubble("RUB2", decorRubbleId("R1")), { id: "R1", flags: {} }];
  const keys = new Set(["live"]);
  assert.deepEqual(decorPrunedRubble([entry("live", "RUB1"), entry("stale", "RUB2")], keys, regions, "R1"), ["RUB2"]);
});
test("only the region's own decoration rubble: another region's, a statue's, a missing one or none is kept", () => {
  const regions = [rubble("OTHER", decorRubbleId("R2")), rubble("STATUE", "tile123"), rubble("MINE", decorRubbleId("R1"))];
  const keys = new Set();
  assert.deepEqual(decorPrunedRubble([entry("a", "OTHER"), entry("b", "STATUE"), entry("c", "GONE"), entry("d")], keys, regions, "R1"), []);
  assert.deepEqual(decorPrunedRubble([entry("e", "MINE"), entry("f", "MINE")], keys, regions, "R1"), ["MINE"], "named twice, deleted once");
  assert.deepEqual(decorPrunedRubble(undefined, keys, regions, "R1"), []);
});

const write = { flags: { animater: { decorBroken: [entry("a")] } }, _id: "R1" };
test("a break write or a decoration repair touching only decorBroken is quiet", () => {
  assert.equal(decorOnlySave(write, { animater: { decorBreak: true } }), true);
  assert.equal(decorOnlySave({ _id: "R1", flags: { animater: { "-=decorBroken": null } } }, { animater: { decorRepair: true } }), true);
  assert.equal(decorOnlySave({ _id: "R1", "flags.animater.-=decorBroken": null }, { animater: { decorRepair: true } }), true, "flat keys");
  assert.equal(decorOnlySave({ ...write, _stats: { modifiedTime: 5 } }, { animater: { decorBreak: true } }), true, "bookkeeping ignored");
});
test("a real edit is never swallowed, even in the same update", () => {
  const opt = { animater: { decorBreak: true } };
  assert.equal(decorOnlySave(write, {}), false, "no option: someone else's write");
  assert.equal(decorOnlySave(write, undefined), false);
  assert.equal(decorOnlySave({ ...write, shapes: [] }, opt), false, "shape changed too");
  assert.equal(decorOnlySave({ _id: "R1", flags: { animater: { decorBroken: [], decor: { seed: 2 } } } }, opt), false, "decorations edited too");
  assert.equal(decorOnlySave({ _id: "R1", flags: { animater: { decorBroken: [] }, other: { x: 1 } } }, opt), false, "another module's flag");
  assert.equal(decorOnlySave({ _id: "R1", flags: { animater: { step: {} } } }, opt), false, "a region step");
  assert.equal(decorOnlySave({ _id: "R1", "flags.animater.decorBroken": [], name: "x" }, opt), false, "flat with a rename");
  assert.equal(decorOnlySave({ _id: "R1" }, opt), false, "nothing changed");
  assert.equal(decorOnlySave({ _id: "R1", flags: { animater: {} } }, opt), false);
});
