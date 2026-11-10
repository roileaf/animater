import test from "node:test";
import assert from "node:assert/strict";
import { propGuesses, propTraits, breakStyle, STYLES, STYLE_CHOICES, CONTENTS } from "../../../scripts/engines/props/prop-traits.mjs";

test("furniture collapses; chests and barrels shatter", () => {
  for (const s of ["Table_Round.webp", "Bookshelf_A.webp", "Chair_2.webp", "Bench.webp", "Stool.webp", "Desk.webp", "Bed.webp", "Cabinet.webp", "Wardrobe.webp"]) assert.equal(propGuesses(s).style, "collapse", s);
  assert.equal(propGuesses("Chest_Wood.webp").style, "shatter");
  assert.equal(propGuesses("Barrel_Wood.webp").style, "shatter");
});
test("contents guessed from the name", () => {
  for (const s of ["Bookshelf_A.webp", "Library_Shelf.webp", "Shelf_Books.webp"]) assert.equal(propGuesses(s).contents, "books", s);
  for (const s of ["Shelf_Potions.webp", "Apothecary_Shelf.webp", "Alchemy_Table.webp"]) assert.equal(propGuesses(s).contents, "potions", s);
  assert.equal(propGuesses("Barrel_Wood.webp").contents, "none");
});
test("legs only for tables, chairs, benches, stools, desks, beds", () => {
  assert.equal(propGuesses("Table_A.webp").legs, true);
  for (const s of ["Chair.webp", "Benches.webp", "Stools.webp", "Desk.webp", "Beds.webp"]) assert.equal(propGuesses(s).legs, true, s);
  assert.equal(propGuesses("Bookshelf_A.webp").legs, false);
  assert.equal(propGuesses("Cabinet.webp").legs, false);
  assert.equal(propGuesses("Wardrobe.webp").legs, false);
});
test("the guess carries the material", () => {
  assert.equal(propGuesses("Table_A.webp").material, "wood");
  assert.equal(propGuesses("Potion_Red.webp").material, "glass");
});
test("the GM's choice beats the guess; junk falls back", () => {
  const t = (prop) => ({ texture: { src: "Table_A.webp" }, width: 200, height: 100, flags: { animater: { prop } } });
  const r = propTraits(t({ style: "shatter", contents: "wine" }), 100);
  assert.deepEqual([r.material, r.style, r.contents, r.legs], ["wood", "shatter", "wine", true]);
  assert.equal(propTraits(t({ style: "evil", contents: "lava" }), 100).style, "collapse");
  assert.equal(propTraits(t({ contents: "" }), 100).contents, "none");
  assert.equal(propTraits(t({ contents: "none" }), 100).contents, "none");
});
test("a saved contents beats a books guess, an empty one takes it", () => {
  const t = (prop) => ({ texture: { src: "Bookshelf_A.webp" }, width: 100, height: 100, flags: { animater: { prop } } });
  assert.equal(propTraits(t({}), 100).contents, "books");
  assert.equal(propTraits(t({ contents: "" }), 100).contents, "books");
  assert.equal(propTraits(t({ contents: "none" }), 100).contents, "none");
  assert.equal(propTraits(t({ contents: "potions" }), 100).contents, "potions");
});
test("a tile with no flags reads from the guess", () => {
  assert.equal(propTraits({ texture: { src: "Chair.webp" }, width: 100, height: 100 }, 100).style, "collapse");
});
test("breakStyle", () => {
  assert.equal(breakStyle({ style: "collapse" }, { damageType: "bludgeoning" }), "collapse");
  assert.equal(breakStyle({ style: "shatter" }, { slam: { size: 1 } }), "shatter");
  assert.equal(breakStyle({ style: "topple" }, {}), "shatter");
});
test("the lists", () => {
  assert.deepEqual(STYLES, ["shatter", "collapse", "topple", "tip", "burn", "split"]);
  assert.deepEqual(STYLE_CHOICES, ["shatter", "collapse"]);
  assert.deepEqual(CONTENTS, ["none", "water", "wine", "oil", "grain", "goods", "books", "potions", "lampoil", "powder"]);
});

test("lanterns and lamps hold lamp oil; the GM can choose it", () => {
  for (const s of ["Lantern_A.webp", "Lamp_Oil.webp", "props/Lantern_Hanging.webp"]) assert.equal(propGuesses(s).contents, "lampoil", s);
  assert.equal(propGuesses("Brazier_Iron.webp").contents, "none");
  assert.equal(propGuesses("Candle_Stand.webp").contents, "none");
  const t = (prop) => ({ texture: { src: "Lantern_A.webp" }, width: 100, height: 100, flags: { animater: { prop } } });
  assert.equal(propTraits(t({}), 100).contents, "lampoil");
  assert.equal(propTraits(t({ contents: "none" }), 100).contents, "none");
  assert.equal(propTraits({ texture: { src: "Barrel.webp" }, width: 100, height: 100, flags: { animater: { prop: { contents: "lampoil" } } } }, 100).contents, "lampoil");
});

test("braziers tip from any slam; damage still follows metal", () => {
  assert.equal(propGuesses("Brazier_Iron.webp").tips, true);
  assert.equal(propGuesses("Barrel.webp").tips, false);
  assert.equal(propGuesses("Lantern.webp").tips, false);
  assert.equal(breakStyle({ style: "shatter", tips: true }, { slam: { size: 1 } }), "tip");
  assert.equal(breakStyle({ style: "collapse", tips: true }, { slam: { size: 3 } }), "tip", "tipping is checked first");
  assert.equal(breakStyle({ style: "shatter", tips: true }, { damageType: "bludgeoning" }), "shatter");
  assert.equal(breakStyle({ style: "shatter", tips: false }, { slam: { size: 1 } }), "shatter");
});
test("the GM's Tips over setting beats the guess", () => {
  const t = (src, tips) => ({ texture: { src }, width: 100, height: 100, flags: { animater: { prop: tips === undefined ? {} : { tips } } } });
  assert.equal(propTraits(t("Brazier.webp"), 100).tips, true);
  assert.equal(propTraits(t("Brazier.webp", ""), 100).tips, true);
  assert.equal(propTraits(t("Brazier.webp", "no"), 100).tips, false);
  assert.equal(propTraits(t("Barrel.webp", "yes"), 100).tips, true);
  assert.equal(propTraits(t("Barrel.webp", "maybe"), 100).tips, false);
  assert.equal(propTraits({ texture: { src: "Brazier.webp" }, width: 100, height: 100 }, 100).tips, true);
});
