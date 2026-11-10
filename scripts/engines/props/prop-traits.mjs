// What a prop is, read from the tile: the GM's flags win, anything else falls back to a guess from the file name. Pure.
import { MATERIALS, FURNITURE, nameTokens, guessMaterial, propMaterial } from "./prop-material.mjs";

export const STYLES = ["shatter", "collapse", "topple", "tip", "burn", "split"];
export const STYLE_CHOICES = ["shatter", "collapse"]; // what the "Breaks as" setting offers
export const CONTENTS = ["none", "water", "wine", "oil", "grain", "goods", "books", "potions"];

const BOOKS = new Set(["book", "books", "bookshelf", "bookshelves", "bookcase", "library"]);
const POTIONS = new Set(["potion", "potions", "apothecary", "alchemy", "alchemist"]);
const LEGS = new Set(["table", "tables", "chair", "chairs", "bench", "benches", "stool", "stools", "desk", "desks", "bed", "beds"]);

export function propGuesses(src) {
  const tokens = nameTokens(src), has = (set) => tokens.some((t) => set.has(t));
  return {
    material: guessMaterial(src),
    style: has(FURNITURE) ? "collapse" : "shatter",
    contents: has(BOOKS) ? "books" : has(POTIONS) ? "potions" : "none",
    legs: has(LEGS),
  };
}

export function propTraits(tile, grid, scene = {}) { // eslint-disable-line no-unused-vars
  const own = tile?.flags?.animater?.prop ?? {}, guess = propGuesses(tile?.texture?.src);
  return {
    material: propMaterial(tile, grid),
    style: STYLES.includes(own.style) ? own.style : guess.style,
    contents: CONTENTS.includes(own.contents) && own.contents !== "" ? own.contents : guess.contents,
    legs: guess.legs,
  };
}

// The style a break plays: Collapse only when the prop is set (or guessed) to it, otherwise it shatters.
export function breakStyle(traits, cause) { // eslint-disable-line no-unused-vars
  return traits?.style === "collapse" ? "collapse" : "shatter";
}
