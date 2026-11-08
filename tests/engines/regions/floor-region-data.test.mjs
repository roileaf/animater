import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DETECT_FLOORS, FLOOR_META, floorFlags, floorMeta, toRegionData, editableWaterRegionIds, WATER_FLAG_KEYS, DETECT_GENERATED, LEGACY_WATER_GENERATED,
} from "../../../scripts/engines/regions/floor-region-data.mjs";
import { planWaterCreate } from "../../../scripts/ui/water-detect-ui.mjs";

const rect = { x: 0, y: 0, width: 100, height: 50 };
const loops = [{ points: [0, 0, 10, 0, 10, 10, 0, 10], hole: false }];
const proposal = { loops, floor: "water", share: 0.1, pixels: new Int32Array([0]) };

test("DETECT_FLOORS covers every Animater floor plus none", () => {
  for (const floor of ["stone", "wood", "dirt", "grass", "sand", "snow", "water", "ice", "mud", "pebbles", "glass", "metal", "lava", "none"]) {
    assert.ok(DETECT_FLOORS.includes(floor), floor);
    assert.ok(FLOOR_META[floor]?.name);
    assert.ok(FLOOR_META[floor]?.color);
  }
});

test("toRegionData writes per-floor name, colour, and generated floor-detect", () => {
  const stone = toRegionData({ ...proposal, floor: "stone" }, { sceneRect: rect, imageWidth: 10, imageHeight: 10, levelId: "L1", floor: "stone" });
  assert.equal(stone.name, "Stone");
  assert.equal(stone.color, FLOOR_META.stone.color);
  assert.equal(stone.flags.animater.floor, "stone");
  assert.equal(stone.flags.animater.generated, DETECT_GENERATED);
  assert.equal(stone.flags.animater.waterKind, undefined);

  const water = toRegionData(proposal, { sceneRect: rect, imageWidth: 10, imageHeight: 10, floor: "water", waterKind: "river", flowTo: "n", current: "swift" });
  assert.equal(water.flags.animater.floor, "water");
  assert.equal(water.flags.animater.waterKind, "river");
  assert.equal(water.flags.animater.flowTo, "n");
  assert.equal(water.flags.animater.current, "swift");

  const lava = toRegionData(proposal, { sceneRect: rect, imageWidth: 10, imageHeight: 10, floor: "lava" });
  assert.equal(lava.flags.animater.floor, "lava");
  assert.equal(lava.flags.animater.cavern, "");
  assert.equal(lava.flags.animater.generated, DETECT_GENERATED);

  const none = toRegionData(proposal, { sceneRect: rect, imageWidth: 10, imageHeight: 10, floor: "none" });
  assert.equal(none.flags.animater.floor, "none");
  assert.equal(none.name, "None");
});

test("legacy water-detect regions remain editable beside floor-detect", () => {
  const ids = editableWaterRegionIds([
    { id: "legacy", levels: ["L1"], flags: { animater: { generated: LEGACY_WATER_GENERATED } } },
    { id: "fresh", levels: ["L1"], flags: { animater: { generated: DETECT_GENERATED } } },
    { id: "manual", levels: ["L1"], flags: { animater: { floor: "stone" } } },
  ], "L1");
  assert.deepEqual(ids, ["legacy", "fresh"]);
});

test("switching a saved region off water clears water flags", () => {
  const saved = {
    ...proposal,
    id: "water-1",
    regionId: "reg-1",
    floor: "water",
    savedChoices: { floor: "water", waterKind: "sea", flowTo: "", current: "", waveTo: "ne", seaBeach: "off" },
  };
  const plan = planWaterCreate({
    proposals: [saved],
    picked: [{ id: "water-1", checked: true, floor: "stone" }],
    sceneRect: rect,
    imageWidth: 10,
    imageHeight: 10,
    levelId: "L1",
    regions: [{ id: "reg-1", levels: ["L1"], flags: { animater: { generated: "water-detect", floor: "water" } } }],
  });
  assert.equal(plan.creates.length, 0);
  assert.equal(plan.updates.length, 1);
  const patch = plan.updates[0];
  assert.equal(patch["flags.animater.floor"], "stone");
  for (const key of WATER_FLAG_KEYS) assert.equal(patch[`flags.animater.${key}`], "");
});

test("floorFlags keeps water extras only on water", () => {
  assert.equal(floorFlags("grass").waterKind, undefined);
  assert.equal(floorFlags("water", { waterKind: "still" }).waterKind, "still");
  assert.equal(floorMeta("mud").name, "Mud");
});
