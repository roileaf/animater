import test from "node:test";
import assert from "node:assert/strict";
import { MATERIALS, nameTokens, guessMaterial, propMaterial, propShape, canBreak } from "../../../scripts/engines/props/prop-material.mjs";

test("material is guessed from the file name only, by name tokens", () => {
  assert.equal(guessMaterial("fa/Core_Settlements/Clutter/Barrel_Wood_A_1x1.webp"), "wood");
  assert.equal(guessMaterial("x/Bottle_Glass_B_Red_1x1.webp"), "glass");
  assert.equal(guessMaterial("bw_catacomb_ceramic_urns_01.webp"), "clay");
  assert.equal(guessMaterial("Brazier_Iron_A.webp"), "metal");
  assert.equal(guessMaterial("Statue_Stone_Knight.webp"), "stone");
  assert.equal(guessMaterial("Core_Settlements/Rug_Red.webp"), "none");   // folder words never count
  assert.equal(guessMaterial("potato_sack.webp"), "none");                // "pot" is a token, not a substring
});
test("camelCase names split into tokens", () => {
  assert.equal(guessMaterial("BarrelA.webp"), "wood");
  assert.equal(guessMaterial("x\IronBrazier.png"), "metal");
});
test("big, overhead and roof tiles never count unless the GM set a material", () => {
  const t = (w, h, extra = {}) => ({ texture: { src: "Barrel_Wood.webp" }, width: w * 100, height: h * 100, ...extra });
  assert.equal(propMaterial(t(3, 3), 100), "wood");
  assert.equal(propMaterial(t(4, 1), 100), "none");
  assert.equal(propMaterial(t(1, 1, { overhead: true }), 100), "none");
  assert.equal(propMaterial(t(1, 1, { roof: true }), 100), "none");
  assert.equal(propMaterial(t(1, 1, { occlusion: { mode: 1 } }), 100), "none");
  assert.equal(propMaterial(t(4, 4, { flags: { animater: { prop: { material: "wood" } } } }), 100), "wood");
  assert.equal(propMaterial(t(1, 1, { flags: { animater: { prop: { material: "none" } } } }), 100), "none");
  assert.equal(propMaterial(t(1, 1, { flags: { animater: { prop: { material: "auto" } } } }), 100), "wood");
});
test("what breaks what follows the spec's table", () => {
  assert.deepEqual(MATERIALS, ["wood", "glass", "clay", "metal", "stone", "none"]);
  for (const d of ["poison", "mental", "spirit", "vitality", "void", "bleed"]) assert.equal(canBreak("glass", { damageType: d }), false, d);
  assert.equal(canBreak("glass", { damageType: "cold" }), true);
  assert.equal(canBreak("wood", { damageType: "piercing" }), false);
  assert.equal(canBreak("wood", { damageType: "electricity" }), true);
  assert.equal(canBreak("wood", { slam: { size: 1 } }), true);
  assert.equal(canBreak("metal", { damageType: "slashing" }), false);
  assert.equal(canBreak("metal", { damageType: "acid" }), true);
  assert.equal(canBreak("metal", { slam: { size: 1 } }), false);
  assert.equal(canBreak("metal", { slam: { size: 2 } }), true);
  assert.equal(canBreak("stone", { damageType: "force" }), true);
  assert.equal(canBreak("stone", { damageType: "bludgeoning" }), false);
  assert.equal(canBreak("none", { damageType: "force" }), false);
  assert.equal(canBreak("clay", { damageType: "piercing" }), true);
  assert.equal(canBreak("glass", {}), false);
});
test("crates break boxy, barrels round", () => {
  assert.equal(propShape("bw_crate_wood_rectangle_002.webp"), "boxy");
  assert.equal(propShape("Barrel_Wood_A.webp"), "round");
});
test("a chest is a boxy wooden prop", () => {
  assert.equal(guessMaterial("Treasure_Chest_02.webp"), "wood");
  assert.equal(propShape("Treasure_Chest_02.webp"), "boxy");
});

test("percent-encoded file names are read decoded; a broken encoding is read as it stands", () => {
  assert.equal(guessMaterial("props/Old%20Barrel.webp"), "wood");
  assert.equal(guessMaterial("props/Glass%20Bottle%201.png"), "glass");
  assert.equal(guessMaterial("props/Barrel%E0%A4%A.webp"), "wood");
});
test("furniture words are wood and beat glass words", () => {
  for (const s of ["Desk_Oak.webp", "Bed_Double.webp", "Bookshelf_Tall.webp", "Cabinet_A.webp", "Wardrobe_1x2.webp", "Tables_Long.webp", "Bookcase.webp"]) assert.equal(guessMaterial(s), "wood", s);
  assert.equal(guessMaterial("Shelf_Potions_A.webp"), "wood");
  assert.equal(guessMaterial("Potion_Red.webp"), "glass");
});
test("nameTokens is exported", () => {
  assert.deepEqual(nameTokens("maps/Old%20BarrelA.webp"), ["old", "barrel", "a"]);
});
