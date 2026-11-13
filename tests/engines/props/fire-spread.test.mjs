import test from "node:test";
import assert from "node:assert/strict";
import { fireRate } from "../../../scripts/engines/props/fire-spread.mjs";

test("the rate is the higher of the material's and the contents'", () => {
  assert.equal(fireRate({ material: "plant", contents: "none" }), 2);
  assert.equal(fireRate({ material: "wood", contents: "none" }), 1);
  assert.equal(fireRate({ material: "wood", contents: "books" }), 1.6);
  assert.equal(fireRate({ material: "glass", contents: "lampoil" }), 2, "contents beat material");
  assert.equal(fireRate({ material: "stone", contents: "none" }), 0);
  assert.equal(fireRate({ material: "metal", contents: "water" }), 0);
  assert.equal(fireRate({ material: "clay", contents: "potions" }), 1.2);
  assert.equal(fireRate({}), 0);
  assert.equal(fireRate(null), 0);
});
