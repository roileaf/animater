import { test } from "node:test";
import assert from "node:assert/strict";
import { planesFrom, solidMask, rgbForModel, project, bindingFromProposal, surfaceAt, tileFrameIsPlain } from "../../../scripts/engines/regions/image-plane.mjs";

const sceneRect = { x: 1000, y: 1200, width: 3600, height: 4800 };
const deckDoc = {
  id: "deck", x: 2800, y: 1800, width: 1400, height: 3200, elevation: 0,
  texture: { src: "boat-bg.png" }, restrictions: { light: false, weather: false },
};
const awningDoc = {
  id: "awning", x: 2600, y: 1600, width: 2200, height: 2600, elevation: 20,
  texture: { src: "boat-fg.png" }, restrictions: { light: true, weather: true },
};

const hull = { x: 3000, y: 2200 };
const under = { x: 3100, y: 2300 };
const grass = { x: 1200, y: 1400 };
const above = { x: 2700, y: 1700 };

const hits = {
  water: [hull, under, above],
  grass: [grass],
  wood: [hull, under],
  awning: [under, above],
};

function contains(region, point) {
  return (hits[region.id] ?? []).some((at) => at.x === point.x && at.y === point.y);
}

function scene() {
  const planes = planesFrom({ levelId: "river", sceneRect, backgroundSrc: "map.png", tiles: [deckDoc, awningDoc] });
  const map = planes.find((plane) => plane.id.kind === "map");
  const deck = planes.find((plane) => plane.id.tileId === "deck");
  const awning = planes.find((plane) => plane.id.tileId === "awning");
  const woodBinding = bindingFromProposal(deck, { loops: [{ hole: false, points: [0, 0, 10, 0, 10, 10] }], elevation: 99 }, { width: 10, height: 10 });
  const awningBinding = bindingFromProposal(awning, { loops: [{ hole: false, points: [0, 0, 8, 0, 8, 4] }], elevation: 20, floor: "wood" }, { width: 8, height: 4 });
  const regions = [
    { id: "water", elevation: { bottom: null, top: null }, flags: { animater: { floor: "water" } } },
    { id: "grass", elevation: null, flags: { animater: { floor: "grass" } } },
    { id: "wood", elevation: { bottom: 99, top: 99 }, flags: { animater: { floor: "wood", imageRegion: woodBinding } } },
    { id: "awning", flags: { animater: { imageRegion: awningBinding } } },
  ];
  return { planes, map, deck, awning, regions, woodBinding, awningBinding };
}

function ask(point, elevation, built = scene()) {
  return surfaceAt(point, { elevation, regions: built.regions, planes: built.planes, contains });
}

test("the riverboat answers come from the live plane", () => {
  const built = scene();
  assert.equal(built.map.role, "floor");
  assert.equal(built.map.elevation, null);
  assert.equal(built.deck.role, "floor");
  assert.equal(built.deck.elevation, 0);
  assert.equal(built.awning.role, "overhead");
  assert.equal(built.awning.elevation, 20);
  assert.deepEqual(ask(hull, 0, built), { floor: "wood", blocksWeather: false, blocksLight: false, source: built.deck });
  assert.deepEqual(ask(under, 0, built), { floor: "wood", blocksWeather: true, blocksLight: true, source: built.deck });
  assert.deepEqual(ask(grass, 0, built), { floor: "grass", blocksWeather: false, blocksLight: false, source: built.map });
  assert.deepEqual(ask(grass, 40, built), { floor: "grass", blocksWeather: false, blocksLight: false, source: built.map });
  assert.deepEqual(ask(above, 25, built), { floor: "water", blocksWeather: false, blocksLight: false, source: built.map });
  assert.deepEqual(ask(hull, 99, built), { floor: "water", blocksWeather: false, blocksLight: false, source: built.map });
  assert.equal(ask(hull, 0.5, built).floor, "wood");
  assert.equal(ask(hull, 1, built).floor, "wood");
  assert.equal(ask(hull, 2, built).floor, "water");
});

test("alpha 199 is outside and alpha 200 is inside", () => {
  const rgba = new Uint8Array([
    0, 0, 0, 199,
    10, 20, 30, 200,
    1, 2, 3, 255,
    9, 9, 9, 0,
  ]);
  assert.deepEqual([...solidMask(rgba, 2, 2)], [0, 1, 1, 0]);
  const rgb = rgbForModel(rgba, 2, 2);
  assert.equal(rgb.length, 12);
  assert.deepEqual([...rgb.subarray(3, 6)], [10, 20, 30]);
  assert.deepEqual([...rgb.subarray(6, 9)], [1, 2, 3]);
  assert.deepEqual([...rgb.subarray(0, 3)], [...rgb.subarray(9, 12)]);
  assert.notDeepEqual([...rgb.subarray(0, 3)], [0, 0, 0]);
});

test("a binding has no elevation field", () => {
  const { deck, woodBinding } = scene();
  assert.deepEqual(Object.keys(woodBinding).sort(), ["loops", "source"]);
  assert.equal("elevation" in woodBinding, false);
  assert.deepEqual(woodBinding.source, { kind: "tile", tileId: "deck" });
  assert.deepEqual(woodBinding.loops, [{ hole: false, points: [0, 0, 1, 0, 1, 1] }]);
  assert.equal(deck.elevation, 0);
});

test("an overhead binding has no floor", () => {
  const built = scene();
  assert.equal("floor" in built.awningBinding, false);
  assert.equal("elevation" in built.awningBinding, false);
  const only = [{ id: "awning", flags: { animater: { floor: "wood", imageRegion: built.awningBinding } } }];
  const underCloth = surfaceAt(under, { elevation: 0, regions: only, planes: built.planes, contains });
  assert.deepEqual(underCloth, { floor: null, blocksWeather: true, blocksLight: true, source: null });
  const onCloth = surfaceAt(above, { elevation: 20, regions: built.regions, planes: built.planes, contains });
  assert.deepEqual(onCloth, { floor: "water", blocksWeather: false, blocksLight: false, source: built.map });
});

test("a legacy region with a set elevation matches only that span", () => {
  const planes = planesFrom({ levelId: "L", sceneRect: { x: 0, y: 0, width: 10, height: 10 }, backgroundSrc: "map.png", tiles: [] });
  const stone = { id: "stone", elevation: { bottom: 10, top: 10 }, flags: { animater: { floor: "stone" } } };
  const at = (elevation) => surfaceAt({ x: 1, y: 1 }, { elevation, regions: [stone], planes, contains: () => true });
  assert.equal(at(10).floor, "stone");
  assert.equal(at(0).floor, null);
  assert.equal(at(10).source, planes[0]);
});

test("project maps a normalized point through the top-left frame", () => {
  const { deck, awning } = scene();
  assert.deepEqual(project(deck.frame, 0.5, 0.5), { x: 3500, y: 3400 });
  assert.deepEqual(project(awning.frame, 0, 0), { x: 2600, y: 1600 });
  assert.deepEqual(project(deck.frame, 1, 1), { x: 4200, y: 5000 });
});

test("a tile with either restriction is overhead, and a hidden tile is absent", () => {
  const planes = planesFrom({
    levelId: "L",
    sceneRect: { x: 0, y: 0, width: 10, height: 10 },
    backgroundSrc: "map.png",
    tiles: [
      { id: "shade", x: 1, y: 2, width: 3, height: 4, elevation: 15, texture: { src: "shade.png" }, restrictions: { light: true, weather: false } },
      { id: "gone", hidden: true, x: 0, y: 0, width: 2, height: 2, elevation: 0, texture: { src: "gone.png" } },
      { id: "elsewhere", levels: ["other"], x: 0, y: 0, width: 2, height: 2, elevation: 0, texture: { src: "other.png" } },
      { id: "turned", rotation: 45, x: 0, y: 0, width: 2, height: 2, elevation: 0, texture: { src: "turned.png" } },
      { id: "scaled", x: 0, y: 0, width: 2, height: 2, elevation: 0, texture: { src: "scaled.png", scaleX: 2, scaleY: 1 } },
    ],
  });
  assert.deepEqual(planes.map((plane) => plane.id), [
    { kind: "map", levelId: "L" },
    { kind: "tile", tileId: "shade" },
  ]);
  assert.equal(planes[1].role, "overhead");
  assert.equal(planes[1].blocksLight, true);
  assert.equal(planes[1].blocksWeather, false);
  assert.equal(planes[1].elevation, 15);
  assert.equal(tileFrameIsPlain({ rotation: 0, texture: { scaleX: 1, scaleY: 1 } }), true);
  assert.equal(tileFrameIsPlain({ rotation: 45, texture: {} }), false);
  const kept = planesFrom({ levelId: "L", sceneRect: { x: 0, y: 0, width: 10, height: 10 }, backgroundSrc: "map.png", tiles: [{ id: "gone", hidden: true, x: 0, y: 0, width: 2, height: 2, texture: { src: "gone.png" } }], allowHidden: true });
  assert.deepEqual(kept.map((plane) => plane.id.tileId).filter(Boolean), ["gone"]);
});
