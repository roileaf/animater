// What a prop is, read from the tile: the GM's flags win, anything else falls back to a guess from the file name. Pure.
import { guessLight } from "./prop-lights.mjs";
import { MATERIALS, FURNITURE, nameTokens, guessMaterial, propMaterial } from "./prop-material.mjs";

export const STYLES = ["shatter", "collapse", "topple", "tip", "burn", "split"];
export const STYLE_CHOICES = ["shatter", "collapse"]; // what the "Breaks as" setting offers
export const CONTENTS = ["none", "water", "wine", "oil", "grain", "goods", "books", "potions", "lampoil"];

const BOOKS = new Set(["book", "books", "bookshelf", "bookshelves", "bookcase", "library"]);
const POTIONS = new Set(["potion", "potions", "apothecary", "alchemy", "alchemist"]);
const LAMPS = new Set(["lantern", "lanterns", "lamp", "lamps"]); // they hold lamp oil
const TIPS = new Set(["brazier", "braziers"]); // knocked over whole, never broken by a slam
const LEGS = new Set(["table", "tables", "chair", "chairs", "bench", "benches", "stool", "stools", "desk", "desks", "bed", "beds"]);

export function propGuesses(src) {
  const tokens = nameTokens(src), has = (set) => tokens.some((t) => set.has(t));
  return {
    material: guessMaterial(src),
    style: has(FURNITURE) ? "collapse" : "shatter",
    contents: has(BOOKS) ? "books" : has(POTIONS) ? "potions" : has(LAMPS) ? "lampoil" : "none",
    legs: has(LEGS),
    light: guessLight(src),
    tips: has(TIPS),
  };
}

export function propTraits(tile, grid, scene = {}) { // eslint-disable-line no-unused-vars
  const own = tile?.flags?.animater?.prop ?? {}, guess = propGuesses(tile?.texture?.src);
  return {
    material: propMaterial(tile, grid),
    style: STYLES.includes(own.style) ? own.style : guess.style,
    contents: CONTENTS.includes(own.contents) && own.contents !== "" ? own.contents : guess.contents,
    legs: guess.legs,
    light: own.light === "yes" ? true : own.light === "no" ? false : guess.light,
    tips: own.tips === "yes" ? true : own.tips === "no" ? false : guess.tips,
  };
}

// The style a break plays: a prop that tips over tips from any slam (checked first); Collapse only when the prop is set
// (or guessed) to it; otherwise it shatters.
export function breakStyle(traits, cause) {
  if (traits?.tips && cause?.slam) return "tip";
  return traits?.style === "collapse" ? "collapse" : "shatter";
}
