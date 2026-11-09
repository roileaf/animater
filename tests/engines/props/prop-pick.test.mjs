import test from "node:test";
import assert from "node:assert/strict";
import { propsInArea, propNextToMiss, propsOnPath, propsUnderTravel, headsInto, onLevel, tilesOnLevel } from "../../../scripts/engines/props/prop-pick.mjs";

const tile = (id, gx, gy, src = "Barrel_Wood.webp", extra = {}) => ({ id, x: gx * 100, y: gy * 100, width: 100, height: 100, rotation: 0, hidden: false, texture: { src }, flags: {}, ...extra });
test("area: centre inside, damage allowed, not already broken", () => {
  const tiles = [tile("a", 0, 0), tile("b", 5, 5), tile("c", 1, 0, "Barrel_Wood.webp", { flags: { animater: { prop: { broken: { seed: 1 } } } } })];
  const inside = ({ x }) => x < 300;
  assert.deepEqual(propsInArea(tiles, inside, 100, "fire").map((t) => t.id), ["a"]);
  assert.deepEqual(propsInArea(tiles, inside, 100, "poison"), []);
});
test("area: hidden tiles are skipped", () => {
  assert.deepEqual(propsInArea([tile("h", 0, 0, "Barrel_Wood.webp", { hidden: true })], () => true, 100, "fire"), []);
});
test("miss: only a square next to the target; nearest the attacker→target line wins", () => {
  const target = { x: 300, y: 300, w: 100, h: 100 }, attacker = { x: 150, y: 350 };
  const behind = tile("behind", 4, 3), side = tile("side", 3, 2), far = tile("far", 6, 3);
  assert.equal(propNextToMiss({ attacker, target }, [side, behind, far], 100, "bludgeoning")?.id, "behind");
  assert.equal(propNextToMiss({ attacker, target }, [far], 100, "bludgeoning"), null);
  assert.equal(propNextToMiss({ attacker, target }, [behind], 100, "piercing"), null);   // wood ignores piercing
});
test("miss: a prop on the attacker's side of the target is never hit", () => {
  const target = { x: 300, y: 300, w: 100, h: 100 }, attacker = { x: 150, y: 350 };
  const near = tile("near", 2, 3), behind = tile("behind", 4, 3);
  assert.equal(propNextToMiss({ attacker, target }, [near, behind], 100, "bludgeoning")?.id, "behind");
  assert.equal(propNextToMiss({ attacker, target }, [near], 100, "bludgeoning"), null);
});
test("miss: a big target uses the ring around its whole footprint", () => {
  const target = { x: 300, y: 300, w: 200, h: 200 }, attacker = { x: 0, y: 400 };
  assert.equal(propNextToMiss({ attacker, target }, [tile("r", 5, 4)], 100, "bludgeoning")?.id, "r");
  assert.equal(propNextToMiss({ attacker, target }, [tile("x", 6, 4)], 100, "bludgeoning"), null);
});
test("path: a mover crossing a prop breaks it by the slam rule", () => {
  const path = [{ x: 50, y: 150 }, { x: 450, y: 150 }];
  const wood = tile("w", 2, 1), stone = tile("s", 3, 1, "Statue_Stone.webp");
  assert.deepEqual(propsOnPath(path, 1, [wood, stone], 100).map((t) => t.id), ["w"]);
  assert.deepEqual(propsOnPath(path, 2, [wood, stone], 100).map((t) => t.id), ["w", "s"]);
});
test("path: results follow path order, off-path props are ignored", () => {
  const path = [{ x: 450, y: 150 }, { x: 50, y: 150 }];
  const a = tile("a", 1, 1), b = tile("b", 3, 1), off = tile("off", 2, 5);
  assert.deepEqual(propsOnPath(path, 1, [a, b, off], 100).map((t) => t.id), ["b", "a"]);
});
test("travel: a prop breaks only where the mover's centre runs through it, at its share of the stage", () => {
  const points = [{ x: 50, y: 150, p: 0 }, { x: 450, y: 150, p: 0.4 }];
  const crossed = tile("x", 2, 1), beside = tile("b", 2, 2), stone = tile("s", 3, 1, "Statue_Stone.webp");
  const hits = propsUnderTravel(points, 1, [beside, stone, crossed], 100);
  assert.deepEqual(hits.map((h) => h.t.id), ["x"]);
  assert.equal(hits[0].p, 0.2);
  assert.deepEqual(hits[0].at, { x: 250, y: 150 });
  // a polyline: crossed on its second segment, reached later in the stage
  const bend = [{ x: 50, y: 150, p: 0 }, { x: 250, y: 150, p: 0.5 }, { x: 250, y: 350, p: 1 }];
  assert.deepEqual(propsUnderTravel(bend, 1, [tile("d", 2, 2)], 100).map((h) => [h.t.id, h.p]), [["d", 0.75]]);
  assert.deepEqual(propsUnderTravel([{ x: 50, y: 150, p: 0 }], 1, [crossed], 100), []);
});

// I1: only what lies ahead of the mover breaks; standing on a prop or moving away from one leaves it whole.
const table = (extra = {}) => ({ id: "table", x: 0, y: 100, width: 200, height: 200, rotation: 0, hidden: false, texture: { src: "Wooden_Table.webp" }, flags: {}, ...extra });
const overlapping = () => ({ id: "barrel", x: 80, y: 100, width: 100, height: 100, rotation: 0, hidden: false, texture: { src: "Barrel_Wood.webp" }, flags: {} });
const onSquare = { x: 50, y: 150 }; // a Medium mover's centre on the square (0..100, 100..200)
test("path: a mover standing on a table never smashes it, whichever way it is pushed", () => {
  for (const to of [{ x: 350, y: 150 }, { x: -250, y: 150 }, { x: 50, y: 450 }, { x: 85, y: 150 }])
    assert.deepEqual(propsOnPath([onSquare, to], 1, [table()], 100), [], JSON.stringify(to));
  assert.deepEqual(propsUnderTravel([{ ...onSquare, p: 0 }, { x: 85, y: 150, p: 0.5 }], 1, [table()], 100), []);
});
test("path: a barrel overlapping the mover's square breaks only when pushed into, not away or aside", () => {
  assert.deepEqual(propsOnPath([onSquare, { x: -250, y: 150 }], 1, [overlapping()], 100), []);
  assert.deepEqual(propsOnPath([onSquare, { x: 50, y: 450 }], 1, [overlapping()], 100), []);
  assert.deepEqual(propsOnPath([onSquare, { x: 350, y: 150 }], 1, [overlapping()], 100).map((t) => t.id), ["barrel"]);
});
test("path: a prop out of reach at the start breaks when the move reaches it", () => {
  const crate = tile("crate", 3, 1);
  assert.deepEqual(propsOnPath([onSquare, { x: 450, y: 150 }], 1, [crate], 100).map((t) => t.id), ["crate"]);
  assert.deepEqual(propsOnPath([{ x: 450, y: 150 }, onSquare], 1, [tile("behind", 5, 1)], 100), []);
});
test("headsInto: on it never; touching only when the prop's centre is past the mover's front", () => {
  const b = overlapping();
  assert.equal(headsInto(onSquare, { x: 150, y: 150 }, table(), 50), false);
  assert.equal(headsInto(onSquare, { x: 150, y: 150 }, b, 50), true);
  assert.equal(headsInto(onSquare, { x: -50, y: 150 }, b, 50), false);
  assert.equal(headsInto(onSquare, { x: 50, y: 250 }, b, 50), false);
  assert.equal(headsInto(onSquare, onSquare, b, 50), false); // no move
  assert.equal(headsInto(onSquare, { x: -50, y: 150 }, tile("far", 5, 1), 50), true); // out of reach: the path decides
});

// I2: levels
test("onLevel: a tile on no level, or a cause on no level, always matches; otherwise the levels must meet", () => {
  assert.equal(onLevel(undefined, "L1"), true);
  assert.equal(onLevel(new Set(), "L1"), true);
  assert.equal(onLevel(["L1"], undefined), true);
  assert.equal(onLevel(["L1"], null), true);
  assert.equal(onLevel(new Set(["L1"]), "L1"), true);
  assert.equal(onLevel(new Set(["L1"]), "L2"), false);
  assert.equal(onLevel(["L1", "L2"], new Set(["L2", "L3"])), true);
  assert.equal(onLevel(["L1"], ["L2", "L3"]), false);
});
test("tilesOnLevel keeps only the tiles a cause on that level reaches", () => {
  const up = tile("up", 0, 0, "Barrel_Wood.webp", { levels: ["upstairs"] }), down = tile("down", 0, 0, "Barrel_Wood.webp", { levels: ["ground"] }), every = tile("every", 0, 0);
  assert.deepEqual(tilesOnLevel([up, down, every], "ground").map((t) => t.id), ["down", "every"]);
  assert.deepEqual(tilesOnLevel([up, down, every], new Set(["upstairs"])).map((t) => t.id), ["up", "every"]);
  // a single-level scene: everything is on its one level, or names none
  assert.deepEqual(tilesOnLevel([tile("a", 0, 0, "Barrel_Wood.webp", { levels: ["only"] }), every], "only").map((t) => t.id), ["a", "every"]);
  assert.deepEqual(tilesOnLevel([up, down], undefined).map((t) => t.id), ["up", "down"]);
});
