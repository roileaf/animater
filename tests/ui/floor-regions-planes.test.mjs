import { test } from "node:test";
import assert from "node:assert/strict";
import { project, bindingFromProposal } from "../../scripts/engines/regions/image-plane.mjs";
import { floorPictures, floorWindowHTML, areaRowHTML, traceSolid, planFloorCreate, savedAreaProposals, openFloorRegions } from "../../scripts/ui/floor-regions-ui.mjs";

const sceneRect = { x: 1000, y: 1200, width: 3600, height: 4800 };
const levelId = "river";
const deckDoc = {
  id: "deck", name: "Deck", x: 2800, y: 1800, width: 1400, height: 3200, elevation: 0,
  texture: { src: "boat-bg.png" }, restrictions: { light: false, weather: false },
};
const awningDoc = {
  id: "awning", name: "Awning", x: 2600, y: 1600, width: 2200, height: 2600, elevation: 20,
  texture: { src: "boat-fg.png" }, restrictions: { light: false, weather: true },
};

function rgba(width, height, paint) {
  const data = new Uint8ClampedArray(width * height * 4);
  const set = (x, y, alpha) => {
    const i = (y * width + x) * 4;
    data[i] = 20; data[i + 1] = 20; data[i + 2] = 20; data[i + 3] = alpha;
  };
  paint(set);
  return data;
}

function row(id, floor) {
  return { id, checked: true, floor, waterKind: "still", flowTo: "", current: "", waveTo: "", seaBeach: "", texture: "", pattern: "", edge: "", overWater: false, step: "" };
}

function planeOf(tiles, tileId) {
  const pictures = floorPictures({ levelId, sceneRect, backgroundSrc: "map.png", tiles });
  return { pictures, plane: pictures.find((picture) => picture.plane.id.tileId === tileId).plane, map: pictures[0].plane };
}

function projected(plane, proposal, width, height) {
  return proposal.loops.map((loop) => {
    const points = [];
    for (let i = 0; i + 1 < loop.points.length; i += 2) {
      const at = project(plane.frame, loop.points[i] / width, loop.points[i + 1] / height);
      points.push(at.x, at.y);
    }
    return points;
  });
}

function near(actual, expected) {
  assert.equal(actual.length, expected.length);
  for (let i = 0; i < actual.length; i++) assert.ok(Math.abs(actual[i] - expected[i]) < 1e-6, `${actual[i]} vs ${expected[i]}`);
}

test("the picture list is the map, then each visible tile on this level", () => {
  const hidden = { ...deckDoc, id: "hidden", name: "Hidden", hidden: true };
  const elsewhere = { id: "else", name: "Else", levels: new Set(["other"]), x: 10, y: 10, width: 20, height: 20, texture: { src: "else.png" }, restrictions: { light: false, weather: false } };
  const cloth = { id: "cloth", name: "Cloth", levels: new Set([levelId]), x: 12, y: 12, width: 20, height: 20, texture: { src: "cloth.png" }, restrictions: { light: true, weather: false } };
  const pictures = floorPictures({ levelId, sceneRect, backgroundSrc: "map.png", tiles: [hidden, elsewhere, cloth, deckDoc] });
  assert.deepEqual(pictures.map((picture) => picture.label), ["Map", "Cloth", "Deck"]);
  assert.deepEqual(pictures.map((picture) => picture.key), [`map:${levelId}`, "tile:cloth", "tile:deck"]);
  assert.equal(pictures[0].plane.role, "floor");
  assert.equal(pictures[0].plane.elevation, null);
  assert.equal(pictures[1].plane.role, "overhead");
  assert.equal(pictures[2].plane.role, "floor");
  const html = floorWindowHTML({ proposals: [], width: 4, height: 4, pictures, pictureKey: pictures[0].key });
  assert.ok(html.indexOf(">Map</option>") < html.indexOf(">Cloth</option>"));
  assert.doesNotMatch(html, /Hidden|Else|else\.png/);
  assert.doesNotMatch(floorWindowHTML({ proposals: [], width: 4, height: 4 }), /data-plane/);
  const cover = areaRowHTML({ id: "area-1", share: 0.5, preselected: true, vertices: 4, loops: [{ points: [0, 0, 2, 0, 2, 2], hole: false }] }, { overhead: true });
  assert.match(cover, /data-overhead/);
  assert.match(cover, /<label hidden>Floor/);
  assert.match(cover, /of this picture/);
  assert.doesNotMatch(cover, /of the map/);
});

test("water, grass and stone on the map save with no binding and no elevation", () => {
  const { map } = planeOf([deckDoc], "deck");
  const proposals = [
    { id: "area-1", share: 0.5, loops: [{ hole: false, points: [0, 0, 10, 0, 10, 5] }] },
    { id: "area-2", share: 0.3, loops: [{ hole: false, points: [0, 0, 10, 0, 10, 5] }] },
    { id: "area-3", share: 0.2, loops: [{ hole: false, points: [0, 0, 10, 0, 10, 5] }] },
  ];
  const picked = [row("area-1", "water"), row("area-2", "grass"), row("area-3", "stone")];
  const scaleX = sceneRect.width / 10, scaleY = sceneRect.height / 5;
  const loop = [0, 0, 10, 0, 10, 5];
  const world = [];
  for (let i = 0; i < loop.length; i += 2) world.push(sceneRect.x + loop[i] * scaleX, sceneRect.y + loop[i + 1] * scaleY);
  for (const plane of [map, null]) {
    const { creates } = planFloorCreate({ proposals, picked, sceneRect, imageWidth: 10, imageHeight: 5, levelId, regions: [], plane });
    assert.deepEqual(creates.map((data) => data.flags.animater.floor), ["water", "grass", "stone"]);
    for (const data of creates) {
      assert.equal(data.flags.animater.imageRegion, undefined);
      assert.equal("elevation" in data, false);
      assert.deepEqual(data.shapes[0].points, world);
      assert.notEqual(data.shapes[0].points[0], deckDoc.x);
    }
  }
});

test("a deck save binds the tile and projects the hull, not the tile rectangle", () => {
  const { plane } = planeOf([deckDoc], "deck");
  assert.equal(plane.role, "floor");
  const image = rgba(4, 4, (set) => {
    set(0, 0, 199);
    for (const [x, y] of [[1, 1], [2, 1], [1, 2], [2, 2]]) set(x, y, 255);
  });
  const proposals = traceSolid(image, 4, 4);
  assert.equal(proposals.length, 1);
  assert.equal(proposals[0].share, 1);
  assert.equal(proposals[0].pixels.length, 4);
  assert.deepEqual(proposals[0].loops[0].points, [1, 1, 3, 1, 3, 3, 1, 3]);
  const { creates } = planFloorCreate({
    proposals, picked: [row(proposals[0].id, "wood")], sceneRect, imageWidth: 4, imageHeight: 4, levelId, regions: [], plane,
  });
  assert.equal(creates.length, 1);
  const data = creates[0];
  assert.equal(data.flags.animater.floor, "wood");
  assert.equal("elevation" in data, false);
  const binding = data.flags.animater.imageRegion;
  assert.deepEqual(binding.source, { kind: "tile", tileId: "deck" });
  assert.equal("elevation" in binding, false);
  assert.deepEqual(binding.loops[0].points, [0.25, 0.25, 0.75, 0.25, 0.75, 0.75, 0.25, 0.75]);
  near(data.shapes[0].points, projected(plane, proposals[0], 4, 4)[0]);
  const far = project(plane.frame, 1, 1);
  assert.ok(!data.shapes[0].points.some((value, index) => index % 2 === 0 && value === far.x && data.shapes[0].points[index + 1] === far.y));
});

test("an awning save writes the binding and no floor flag", () => {
  const { plane } = planeOf([awningDoc], "awning");
  assert.equal(plane.role, "overhead");
  const image = rgba(6, 4, (set) => {
    set(5, 3, 199);
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) set(x, y, 255);
    for (let y = 0; y < 2; y++) for (let x = 3; x < 5; x++) set(x, y, 255);
  });
  const proposals = traceSolid(image, 6, 4);
  assert.equal(proposals.length, 2);
  assert.equal(proposals.reduce((sum, proposal) => sum + proposal.pixels.length, 0), 8);
  for (const proposal of proposals) assert.equal(proposal.share, 0.5);
  assert.deepEqual(proposals.map((proposal) => proposal.loops[0].points), [
    [0, 0, 2, 0, 2, 2, 0, 2],
    [3, 0, 5, 0, 5, 2, 3, 2],
  ]);
  const { creates } = planFloorCreate({
    proposals,
    picked: proposals.map((proposal) => row(proposal.id, "wood")),
    sceneRect, imageWidth: 6, imageHeight: 4, levelId, regions: [], plane,
  });
  assert.equal(creates.length, 2);
  const expected = proposals.map((proposal) => projected(plane, proposal, 6, 4)[0]);
  for (const data of creates) {
    assert.deepEqual(Object.keys(data.flags.animater).sort(), ["generated", "imageRegion"]);
    assert.equal("elevation" in data, false);
    const binding = data.flags.animater.imageRegion;
    assert.deepEqual(binding.source, { kind: "tile", tileId: "awning" });
    assert.equal("elevation" in binding, false);
    assert.ok(expected.some((points) => points.length === data.shapes[0].points.length && points.every((value, index) => Math.abs(value - data.shapes[0].points[index]) < 1e-6)));
    const far = project(plane.frame, 1, 1);
    assert.ok(!data.shapes[0].points.some((value, index) => index % 2 === 0 && value === far.x && data.shapes[0].points[index + 1] === far.y));
  }
});

test("a tile region reloads on its tile, and a map region reloads on the map", () => {
  const { map, plane } = planeOf([deckDoc, awningDoc], "deck");
  const awning = planeOf([deckDoc, awningDoc], "awning").plane;
  const hull = [1, 1, 3, 1, 3, 3, 1, 3];
  const deckBinding = bindingFromProposal(plane, { loops: [{ hole: false, points: hull }] }, { width: 4, height: 4 });
  const awningBinding = bindingFromProposal(awning, { loops: [{ hole: false, points: [0, 0, 2, 0, 2, 2, 0, 2] }] }, { width: 6, height: 4 });
  const grass = {
    id: "grass", name: "Grass", levels: [levelId],
    shapes: [{ type: "polygon", hole: false, points: [1000, 1200, 1900, 1200, 1900, 2400] }],
    flags: { animater: { generated: "floor-detect", floor: "grass" } },
  };
  const deck = {
    id: "deck-region", name: "Wood", levels: [levelId],
    shapes: [{ type: "polygon", hole: false, points: [2800, 1800, 4200, 1800, 4200, 5000, 2800, 5000] }],
    flags: { animater: { generated: "floor-detect", floor: "wood", imageRegion: deckBinding } },
  };
  const cover = {
    id: "cover", name: "Overhead", levels: [levelId],
    shapes: [{ type: "polygon", hole: false, points: [2600, 1600, 4800, 1600, 4800, 4200, 2600, 4200] }],
    flags: { animater: { generated: "floor-detect", imageRegion: awningBinding } },
  };
  const regions = [grass, deck, cover];
  const ids = (planeArg, width, height) => savedAreaProposals(regions, { levelId, sceneRect, width, height, plane: planeArg }).map((proposal) => proposal.regionId);
  assert.deepEqual(ids(map, 10, 5), ["grass"]);
  assert.deepEqual(ids(null, 10, 5), ["grass"]);
  assert.deepEqual(ids(plane, 4, 4), ["deck-region"]);
  assert.deepEqual(ids(awning, 6, 4), ["cover"]);
  const onDeck = savedAreaProposals(regions, { levelId, sceneRect, width: 4, height: 4, plane })[0];
  assert.deepEqual(onDeck.loops[0].points, hull);
  assert.equal(onDeck.floor, "wood");
  const onCloth = savedAreaProposals(regions, { levelId, sceneRect, width: 6, height: 4, plane: awning })[0];
  assert.equal(onCloth.floor, "");
  assert.deepEqual(onCloth.loops[0].points, [0, 0, 2, 0, 2, 2, 0, 2]);
});

test("switching pictures keeps the other picture's unsaved draft", async () => {
  const loads = [];
  const hull = rgba(4, 4, (set) => { for (const [x, y] of [[1, 1], [2, 1], [1, 2], [2, 2]]) set(x, y, 255); });
  const { plane } = planeOf([deckDoc], "deck");
  const deckBinding = bindingFromProposal(plane, { loops: [{ hole: false, points: [1, 1, 3, 1, 3, 3, 1, 3] }] }, { width: 4, height: 4 });
  const scene = {
    id: "scene",
    regions: [
      { id: "grass", name: "Grass", levels: [levelId], shapes: [{ type: "polygon", hole: false, points: [1000, 1200, 1900, 1200, 1900, 2400] }], flags: { animater: { generated: "floor-detect", floor: "grass" } } },
      { id: "deck-region", name: "Wood", levels: [levelId], shapes: [{ type: "polygon", hole: false, points: [2800, 1800, 4200, 1800, 4200, 5000, 2800, 5000] }], flags: { animater: { generated: "floor-detect", floor: "wood", imageRegion: deckBinding } } },
    ],
  };
  class Quiet { async render() {} async close() {} }
  const opened = await openFloorRegions({
    src: "map.png", scene, sceneRect, levelId, tiles: [deckDoc], memory: null, autoMark: false, view: null,
    Application: Quiet, notify() {}, warn() {},
    detect: () => ({ proposals: [], reason: "" }),
    load: async (src) => {
      loads.push(src);
      return src === "map.png" ? { ok: true, rgba: new Uint8ClampedArray(10 * 5 * 4), width: 10, height: 5 } : { ok: true, rgba: hull, width: 4, height: 4 };
    },
  });
  assert.equal(opened.opened, true);
  const { app } = opened;
  assert.equal(app.plane.id.kind, "map");
  assert.equal(app.planeKey, `map:${levelId}`);
  assert.deepEqual(app.pictures.map((picture) => picture.label), ["Map", "Deck"]);
  assert.deepEqual(app.detect.proposals.map((proposal) => proposal.regionId), ["grass"]);
  app.detect.proposals[0].draftMark = "keep";
  await app.showPicture("tile:deck");
  assert.equal(app.plane.id.tileId, "deck");
  assert.deepEqual(app.detect.proposals.map((proposal) => proposal.regionId), ["deck-region"]);
  assert.deepEqual(app.detect.proposals[0].loops[0].points, [1, 1, 3, 1, 3, 3, 1, 3]);
  await app.showPicture(`map:${levelId}`);
  assert.equal(app.detect.proposals[0].draftMark, "keep");
  assert.deepEqual(loads, ["map.png", "boat-bg.png"]);
});

test("a second switch waits until the tile has loaded", async () => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const loads = [];
  class Quiet { async render() {} async close() {} }
  const { app } = await openFloorRegions({
    src: "map.png", scene: { id: "scene", regions: [] }, sceneRect, levelId, tiles: [deckDoc], memory: null, autoMark: false, view: null,
    Application: Quiet, notify() {}, warn() {},
    detect: () => ({ proposals: [{ id: "area-1", share: 1, vertices: 4, loops: [{ hole: false, points: [0, 0, 4, 0, 4, 4] }], pixels: new Int32Array([0]) }], reason: "" }),
    load: async (src) => {
      loads.push(src);
      if (src === "boat-bg.png") await gate;
      return { ok: true, rgba: new Uint8ClampedArray(16), width: 2, height: 2 };
    },
  });
  app.detect.proposals[0].id = "draft-mark";
  const first = app.showPicture("tile:deck");
  const second = app.showPicture(`map:${levelId}`);
  await second;
  assert.equal(app.planeKey, "tile:deck");
  assert.equal(app.detect.proposals[0].id, "draft-mark");
  release();
  await first;
  assert.equal(app.plane.id.kind, "tile");
  assert.ok(app.detect.proposals.every((proposal) => proposal.id !== "draft-mark"));
  await app.showPicture(`map:${levelId}`);
  assert.equal(app.detect.proposals[0].id, "draft-mark");
  assert.deepEqual(loads, ["map.png", "boat-bg.png"]);
});

test("a tile that fails to load leaves the map draft in place", async () => {
  const notes = [];
  class Quiet { async render() {} async close() {} }
  const { app } = await openFloorRegions({
    src: "map.png", scene: { id: "scene", regions: [] }, sceneRect, levelId, tiles: [deckDoc], memory: null, autoMark: false, view: null,
    Application: Quiet, notify() {}, warn: (message) => notes.push(message),
    detect: () => ({ proposals: [], reason: "" }),
    load: async (src) => src === "map.png" ? { ok: true, rgba: new Uint8ClampedArray(16), width: 2, height: 2 } : { ok: false, reason: "fetch" },
  });
  app.detect.proposals.push({ id: "draft-mark", share: 0, vertices: 0, loops: [], pixels: new Int32Array() });
  await app.showPicture("tile:deck");
  assert.match(notes.at(-1), /could not be loaded/);
  assert.equal(app.planeKey, `map:${levelId}`);
  assert.equal(app.plane.id.kind, "map");
  assert.equal(app.detect.proposals[0].id, "draft-mark");
});
