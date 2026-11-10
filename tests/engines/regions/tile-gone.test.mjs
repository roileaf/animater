import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { planesFrom, bindingFromProposal, regionsWithPicture } from "../../../scripts/engines/regions/image-plane.mjs";

const sceneRect = { x: 0, y: 0, width: 4000, height: 4000 };
const shipDoc = {
  id: "ship", x: 1000, y: 500, width: 800, height: 2400, elevation: 0,
  texture: { src: "ship.webp" }, restrictions: { light: false, weather: false },
};
const loop = { loops: [{ hole: false, points: [0, 0, 10, 0, 10, 10] }] };

function regionsOn(planes) {
  const ship = planes.find((plane) => plane.id.tileId === "ship")
    ?? { id: { kind: "tile", tileId: "ship" } };
  const deck = bindingFromProposal(ship, loop, { width: 10, height: 10 });
  return [
    { id: "sea", flags: { animater: { floor: "water" } } },
    { id: "deck", flags: { animater: { floor: "wood", overWater: true, castShadow: true, imageRegion: deck } } },
    { id: "pier", flags: { animater: { floor: "wood", overWater: true } } },
  ];
}

const ids = (list) => list.map((region) => region.id);

test("a region bound to a tile that is there still draws", () => {
  const planes = planesFrom({ sceneRect, levelId: "l", backgroundSrc: "map.webp", tiles: [shipDoc] });
  assert.deepEqual(ids(regionsWithPicture(regionsOn(planes), planes)), ["sea", "deck", "pier"]);
});

test("a region bound to a deleted tile draws nothing; unbound regions stay", () => {
  const planes = planesFrom({ sceneRect, levelId: "l", backgroundSrc: "map.webp", tiles: [] });
  assert.deepEqual(ids(regionsWithPicture(regionsOn(planes), planes)), ["sea", "pier"]);
});

test("a region bound to a hidden tile draws nothing until it is shown", () => {
  const planes = planesFrom({ sceneRect, levelId: "l", backgroundSrc: "map.webp", tiles: [{ ...shipDoc, hidden: true }] });
  assert.deepEqual(ids(regionsWithPicture(regionsOn(planes), planes)), ["sea", "pier"]);
});

test("the region documents are left alone", () => {
  const planes = planesFrom({ sceneRect, levelId: "l", backgroundSrc: "map.webp", tiles: [] });
  const regions = regionsOn(planes);
  regionsWithPicture(regions, planes);
  assert.equal(regions.length, 3);
  assert.equal(regions[1].flags.animater.imageRegion.source.tileId, "ship");
});

test("floor shadows and over-water cut-outs skip regions whose tile is gone", () => {
  const main = readFileSync(new URL("../../../scripts/main.mjs", import.meta.url), "utf8");
  assert.match(main, /const drawnRegions = \(\) => regionsWithPicture\(regionsHere\(\), planesHere\(\)\);/);
  const shadows = main.slice(main.indexOf("const syncFloorShadows = "), main.indexOf("const syncMovingWater = "));
  assert.match(shadows, /here = drawnRegions\(\)/);
  const water = main.slice(main.indexOf("const movingWaterList = "), main.indexOf("const floorBodyOf = "));
  assert.match(water, /const over = on \? drawnRegions\(\)\.filter\(/);
  assert.match(water, /for \(const region of drawnRegions\(\)\)/);
});
