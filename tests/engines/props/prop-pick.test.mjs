import test from "node:test";
import assert from "node:assert/strict";
import { propsInArea, propNextToMiss, propsOnPath } from "../../../scripts/engines/props/prop-pick.mjs";

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
