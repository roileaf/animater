import { test } from "node:test";
import assert from "node:assert/strict";
import { planesFrom, bindingFromProposal, surfaceAt, regionsForSurface, weatherSheltered, indoorPolygonsOf } from "../../../scripts/engines/regions/image-plane.mjs";

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

const hits = {
  water: [hull, under],
  grass: [grass],
  wood: [hull, under],
  awning: [under],
};

function contains(region, point) {
  return (hits[region.id] ?? []).some((at) => at.x === point.x && at.y === point.y);
}

function scene() {
  const planes = planesFrom({ levelId: "river", sceneRect, backgroundSrc: "map.png", tiles: [deckDoc, awningDoc] });
  const deck = planes.find((plane) => plane.id.tileId === "deck");
  const awning = planes.find((plane) => plane.id.tileId === "awning");
  const woodBinding = bindingFromProposal(deck, { loops: [{ hole: false, points: [0, 0, 10, 0, 10, 10] }] }, { width: 10, height: 10 });
  const awningBinding = bindingFromProposal(awning, { loops: [{ hole: false, points: [0, 0, 8, 0, 8, 4] }] }, { width: 8, height: 4 });
  const regions = [
    { id: "water", elevation: { bottom: null, top: null }, flags: { animater: { floor: "water" } } },
    { id: "grass", elevation: null, flags: { animater: { floor: "grass" } } },
    { id: "wood", elevation: { bottom: 99, top: 99 }, flags: { animater: { floor: "wood", imageRegion: woodBinding } } },
    { id: "awning", flags: { animater: { imageRegion: awningBinding } } },
  ];
  return { planes, regions };
}

function ask(point, elevation, built = scene()) {
  return surfaceAt(point, { elevation, regions: built.regions, planes: built.planes, contains });
}

function sheltered(point, elevation, extra = {}, built = scene()) {
  return weatherSheltered(point, { elevation, regions: built.regions, planes: built.planes, contains, ...extra });
}

test("the hull at elevation 0 is wood while the water region underneath still exists", () => {
  const built = scene();
  const waterOnly = built.regions.filter((region) => region.id === "water");
  assert.equal(surfaceAt(hull, { elevation: 0, regions: waterOnly, planes: built.planes, contains }).floor, "water");
  assert.equal(ask(hull, 0, built).floor, "wood");
  assert.equal(ask(hull, 0, built).blocksWeather, false);
  assert.equal(ask(hull, 0, built).blocksLight, false);
  assert.equal(sheltered(hull, 0, {}, built), false);
});

test("grass with no elevation matches every height", () => {
  const built = scene();
  assert.equal(ask(grass, 0, built).floor, "grass");
  assert.equal(ask(grass, 40, built).floor, "grass");
  assert.equal(sheltered(grass, 40, {}, built), false);
});

test("under the awning at elevation 0 is sheltered, and at the cloth it is not", () => {
  const built = scene();
  assert.equal(sheltered(under, 0, {}, built), true);
  assert.equal(ask(under, 0, built).floor, "wood");
  assert.equal(sheltered(under, 20, {}, built), false);
  assert.equal(ask(under, 20, built).floor, "water");
  assert.equal(ask(under, 20, built).blocksWeather, false);
  assert.equal(ask(under, 20, built).blocksLight, false);
  assert.equal(sheltered(under, 0, { openToSky: true }, built), false);
});

test("a suppress-weather region keeps the weather out, including only its span", () => {
  const built = scene();
  const room = { id: "room", elevation: { bottom: 0, top: 0 }, behaviors: [{ type: "suppressWeather" }], flags: { animater: {} } };
  const off = { id: "room", elevation: null, behaviors: [{ type: "suppressWeather", disabled: true }], flags: { animater: {} } };
  const inside = (region, point) => region.id === "room" && point.x === 1 && point.y === 1;
  const at = (regions, elevation) => weatherSheltered({ x: 1, y: 1 }, { elevation, regions, planes: built.planes, contains: inside });
  assert.equal(at([room], 0), true);
  assert.equal(at([room], 5), false);
  assert.equal(at([off], 0), false);
});

test("light is blocked under the awning and the awning is not an indoor polygon", () => {
  const built = scene();
  const cabin = [0, 0, 4, 0, 4, 4];
  const room = { id: "cabin", behaviors: [{ type: "suppressWeather" }], flags: { animater: {} } };
  const indoors = indoorPolygonsOf([...built.regions, room], (region) => {
    if (region.id === "cabin") return [cabin];
    if (region.id === "awning") return [[8, 8, 9, 8, 9, 9]];
    return [];
  });
  assert.equal(ask(under, 0, built).blocksLight, true);
  assert.deepEqual(indoors, [cabin]);
});

test("a non-swimmer below a legacy dock stands on it, and a bound hull does not", () => {
  const planes = planesFrom({ levelId: "river", sceneRect, backgroundSrc: "map.png", tiles: [deckDoc] });
  const deck = planes.find((plane) => plane.id.tileId === "deck");
  const woodBinding = bindingFromProposal(deck, { loops: [{ hole: false, points: [0, 0, 10, 0, 10, 10] }] }, { width: 10, height: 10 });
  const water = { id: "water", elevation: null, flags: { animater: { floor: "water" } } };
  const dock = { id: "dock", elevation: { bottom: 10, top: 10 }, flags: { animater: { floor: "wood", overWater: true } } };
  const bound = { id: "wood", elevation: { bottom: 10, top: 10 }, flags: { animater: { floor: "wood", overWater: true, imageRegion: woodBinding } } };
  const anywhere = () => true;
  const floorOf = (regions, elevation) => surfaceAt({ x: 1, y: 1 }, { elevation, regions, planes, contains: anywhere }).floor;
  const standing = regionsForSurface([dock, water], { elevation: 0, action: "walk", present: true });
  assert.equal(floorOf(standing, 0), "wood");
  assert.equal(dock.elevation.bottom, 10);
  const swimming = regionsForSurface([dock, water], { elevation: 0, action: "swim", present: true });
  assert.equal(floorOf(swimming, 0), "water");
  const away = regionsForSurface([dock, water], { elevation: 0, action: "walk", present: false });
  assert.equal(floorOf(away, 0), "water");
  const lifted = regionsForSurface([bound, water], { elevation: 5, action: "walk", present: true });
  assert.equal(floorOf(lifted, 5), "water");
  assert.equal(lifted.find((region) => region.id === "wood").flags.animater.imageRegion, woodBinding);
});
