import { test } from "node:test";
import assert from "node:assert/strict";
import { toRegionData, editableFloorRegionIds, AREA_FLOORS, floorName, floorColour, GENERATED_MARK, pickerFloor, savedFloor } from "../../../scripts/engines/regions/floor-detect.mjs";
import { planFloorCreate, areaRowHTML, FLOOR_OPTIONS } from "../../../scripts/ui/floor-regions-ui.mjs";

const sceneRect = { x: 0, y: 0, width: 1000, height: 500 };
const loops = [{ points: [0, 0, 10, 0, 10, 5], hole: false }];
const area = (over = {}) => ({ id: "area-1", share: 0.2, preselected: true, vertices: 3, loops, ...over });
const row = (over = {}) => ({ id: "area-1", checked: true, floor: "water", waterKind: "still", flowTo: "", current: "", waveTo: "", seaBeach: "", ...over });

test("every Animater floor can be an area, water first, each with a name", () => {
  assert.equal(AREA_FLOORS[0], "water");
  for (const floor of ["stone", "wood", "dirt", "grass", "sand", "snow", "ice", "mud", "pebbles", "glass", "metal", "lava"]) assert.ok(AREA_FLOORS.includes(floor), floor);
  assert.deepEqual(FLOOR_OPTIONS.find(([key]) => key === "grass"), ["grass", "Grass"]);
  assert.equal(floorName("nonsense"), "Water");
});

test("a region of another floor carries its floor and the new marker, and no water settings", () => {
  const grass = toRegionData(area(), { sceneRect, imageWidth: 10, imageHeight: 5, levelId: "L", floor: "grass", waterKind: "river", flowTo: "e" });
  assert.deepEqual(grass.flags, { animater: { floor: "grass", generated: GENERATED_MARK } });
  assert.equal(grass.name, "Grass");
  assert.notEqual(grass.color, toRegionData(area(), { sceneRect, imageWidth: 10, imageHeight: 5, floor: "water" }).color);
  const lava = toRegionData(area(), { sceneRect, imageWidth: 10, imageHeight: 5, floor: "lava" });
  assert.equal(lava.flags.animater.floor, "lava");
  assert.equal(lava.flags.animater.cavern, "", "lava's own cave settings come with it");
  assert.equal(toRegionData(area(), { sceneRect, imageWidth: 10, imageHeight: 5, floor: "carpet" }).flags.animater.floor, "water", "an unknown floor falls back to water");
});

test("a cave is Cavern in the picker and an empty floor with cave growth on the region", () => {
  assert.ok(AREA_FLOORS.includes("cavern"));
  assert.equal(floorName("cavern"), "Cave");
  assert.equal(savedFloor("cavern"), "");
  assert.equal(savedFloor("grass"), "grass");
  assert.equal(pickerFloor({ floor: "", cavern: "fungus-green" }), "cavern");
  assert.equal(pickerFloor({ cavern: "fungus-green" }), "cavern");
  assert.equal(pickerFloor({ floor: "grass" }), "grass");
  assert.equal(pickerFloor({ floor: "" }), "water", "an empty floor with no cave growth is not a cave");
  assert.equal(pickerFloor({}), "water");
  const cave = toRegionData(area(), { sceneRect, imageWidth: 10, imageHeight: 5, floor: "cavern", waterKind: "river", flowTo: "e" });
  assert.equal(cave.flags.animater.floor, "");
  assert.equal(cave.flags.animater.cavern, "fungus-green", "the growth the region panel's Cave starts with");
  assert.equal(pickerFloor(cave.flags.animater), "cavern", "a saved cave reopens as a cave");
  assert.equal(cave.name, "Cave");
  assert.equal(cave.color, floorColour("cavern"));
  assert.equal(cave.flags.animater.waterKind, undefined);
});

test("an area with no floor yet never saves as a cave", () => {
  const none = toRegionData(area(), { sceneRect, imageWidth: 10, imageHeight: 5, floor: "" });
  assert.equal(none.flags.animater.floor, "water", "as before Cave: an empty floor falls back to water");
  assert.equal(none.flags.animater.cavern, undefined);
});

test("regions made by the old water generator and the new floor generator are both editable", () => {
  const regions = [
    { id: "old", levels: ["L"], flags: { animater: { generated: "water-detect" } } },
    { id: "new", levels: ["L"], flags: { animater: { generated: "floor-detect" } } },
    { id: "hand", levels: ["L"], flags: { animater: { floor: "grass" } } },
  ];
  assert.deepEqual(editableFloorRegionIds(regions, "L"), ["old", "new"]);
});

test("new regions are named by floor: one of a floor by its name, several numbered", () => {
  const proposals = [area({ id: "area-1", share: 0.3 }), area({ id: "area-2", share: 0.2 }), area({ id: "area-3", share: 0.1 })];
  const picked = [row({ id: "area-1", floor: "grass" }), row({ id: "area-2", floor: "water" }), row({ id: "area-3", floor: "grass" })];
  const { creates } = planFloorCreate({ proposals, picked, sceneRect, imageWidth: 10, imageHeight: 5, levelId: "L", regions: [] });
  assert.deepEqual(creates.map((c) => c.name), ["Grass 1", "Water", "Grass 2"]);
});

test("a saved water region switched to grass sets its floor, clears its water settings, and keeps its old marker", () => {
  const regions = [{ id: "r1", levels: ["L"], flags: { animater: { generated: "water-detect", floor: "water", waterKind: "river" } } }];
  const saved = area({ regionId: "r1", savedChoices: { floor: "water", generated: "water-detect", waterKind: "river", flowTo: "s", current: "", waveTo: "", seaBeach: "" } });
  const { updates } = planFloorCreate({ proposals: [saved], picked: [row({ floor: "grass", waterKind: "river", flowTo: "s" })], sceneRect, imageWidth: 10, imageHeight: 5, levelId: "L", regions });
  assert.deepEqual(updates, [{
    _id: "r1", "flags.animater.floor": "grass",
    "flags.animater.waterKind": "", "flags.animater.flowTo": "", "flags.animater.current": "", "flags.animater.waveTo": "", "flags.animater.seaBeach": "",
  }]);
});

test("a saved region switched to lava gets lava's flags; to water it gets a full set of water settings", () => {
  const regions = [{ id: "r1", levels: ["L"], flags: { animater: { generated: "floor-detect", floor: "grass" } } }];
  const saved = area({ regionId: "r1", savedChoices: { floor: "grass", generated: "floor-detect", waterKind: "still", flowTo: "", current: "", waveTo: "", seaBeach: "" } });
  const plan = (r) => planFloorCreate({ proposals: [saved], picked: [r], sceneRect, imageWidth: 10, imageHeight: 5, levelId: "L", regions }).updates[0];
  const lava = plan(row({ floor: "lava" }));
  assert.equal(lava["flags.animater.floor"], "lava");
  assert.equal(lava["flags.animater.cavern"], "");
  assert.ok(!("flags.animater.waterKind" in lava));
  const water = plan(row({ floor: "water", waterKind: "river", flowTo: "e" }));
  assert.equal(water["flags.animater.floor"], "water");
  assert.equal(water["flags.animater.waterKind"], "river");
  assert.equal(water["flags.animater.flowTo"], "e");
  const unchanged = planFloorCreate({ proposals: [saved], picked: [row({ floor: "grass" })], sceneRect, imageWidth: 10, imageHeight: 5, levelId: "L", regions }).updates;
  assert.deepEqual(unchanged, [], "an unchanged saved region gets no update");
});

test("a saved cave stays a cave: reopening it is not water, and saving it again does not rewrite the floor", () => {
  const regions = [{ id: "r1", levels: ["L"], flags: { animater: { generated: "floor-detect", floor: "", cavern: "fungus-green" } } }];
  const saved = area({ regionId: "r1", floor: "cavern", savedChoices: { floor: "cavern", generated: "floor-detect", waterKind: "still", flowTo: "", current: "", waveTo: "", seaBeach: "" } });
  const { updates, creates } = planFloorCreate({ proposals: [saved], picked: [row({ floor: "cavern" })], sceneRect, imageWidth: 10, imageHeight: 5, levelId: "L", regions });
  assert.deepEqual(creates, []);
  assert.deepEqual(updates, [], "the picker id cavern and the empty wire floor are the same cave");
});

test("a row shows its floor, and the water fields only on water", () => {
  const grass = areaRowHTML(area({ floor: "grass" }));
  assert.match(grass, /<select data-floor="area-1">[\s\S]*<option value="grass" selected>Grass<\/option>/);
  assert.match(grass, /<div class="an-water-fields" data-water-fields hidden>/);
  assert.match(grass, /--swatch:#5f9f45/, "the swatch shows the floor");
  const water = areaRowHTML(area());
  assert.match(water, /<div class="an-water-fields" data-water-fields>/);
  assert.match(areaRowHTML(area({ floor: "grass" }), { floor: "water" }), /<div class="an-water-fields" data-water-fields>/, "the row's own choice wins over the area's floor");
});
