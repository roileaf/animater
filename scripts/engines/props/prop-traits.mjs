// What a prop is, read from the tile: the GM's flags win, anything else falls back to a guess from the file name. Pure.
import { guessLight } from "./prop-lights.mjs";
import { MATERIALS, FURNITURE, CUTTABLE, nameTokens, guessMaterial, propMaterial } from "./prop-material.mjs";
import { DECOR_RULES, decorRuleStyle } from "./decor-rules.mjs";

export const STYLES = ["shatter", "collapse", "topple", "tip", "burn", "split"];
export const STYLE_CHOICES = ["shatter", "collapse", "topple", "burn"]; // what the "Breaks as" setting offers
export const CONTENTS = ["none", "water", "wine", "oil", "grain", "goods", "books", "potions", "lampoil", "powder"];
export const BURST_DEFAULT = 2; // a powder keg's burst, in squares (the tile's "Burst (squares)" 1-4)

const BOOKS = new Set(["book", "books", "bookshelf", "bookshelves", "bookcase", "library"]);
const POTIONS = new Set(["potion", "potions", "apothecary", "alchemy", "alchemist"]);
const LAMPS = new Set(["lantern", "lanterns", "lamp", "lamps"]); // they hold lamp oil
const POWDER = new Set(["powder", "gunpowder", "explosive", "explosives"]);
const TIPS = new Set(["brazier", "braziers"]); // knocked over whole, never broken by a slam
const TALL = new Set(["statue", "statues", "pillar", "pillars", "column", "columns", "obelisk", "obelisks"]); // they topple whole
const LEGS = new Set(["table", "tables", "chair", "chairs", "bench", "benches", "stool", "stools", "desk", "desks", "bed", "beds"]);

export function propGuesses(src) {
  const tokens = nameTokens(src), has = (set) => tokens.some((t) => set.has(t)), material = guessMaterial(src), tall = has(TALL);
  return {
    material,
    style: has(FURNITURE) ? "collapse" : tall && material === "stone" ? "topple" : material === "plant" ? "burn" : "shatter",
    contents: has(BOOKS) ? "books" : has(POTIONS) ? "potions" : has(LAMPS) ? "lampoil" : has(POWDER) ? "powder" : "none",
    legs: has(LEGS),
    light: guessLight(src),
    tips: has(TIPS),
    tall,
    cuttable: material === "plant" && has(CUTTABLE), // webs and vines; a slashing blade cuts them
  };
}

// The tile's burst setting (a form may save it as text) rounded and clamped to 1-4; BURST_DEFAULT when it is not a number.
export function burstOf(value) {
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isFinite(n) ? Math.min(4, Math.max(1, Math.round(n))) : BURST_DEFAULT;
}

export function propTraits(tile, grid, scene = {}) {
  const own = tile?.flags?.animater?.prop ?? {}, guess = propGuesses(tile?.texture?.src), material = propMaterial(tile, grid);
  return {
    material,
    // a guessed topple needs stone (the GM may have made the statue wood), a guessed burn a plant
    style: STYLES.includes(own.style) ? own.style : (guess.style === "topple" && material !== "stone") || (guess.style === "burn" && material !== "plant") ? "shatter" : guess.style,
    contents: CONTENTS.includes(own.contents) && own.contents !== "" ? own.contents : guess.contents,
    legs: guess.legs,
    cuttable: guess.cuttable,
    light: own.light === "yes" ? true : own.light === "no" ? false : guess.light,
    tips: own.tips === "yes" ? true : own.tips === "no" ? false : guess.tips,
    burst: burstOf(own.burst),
    // a toppled statue leaves difficult rubble: the tile's choice, else the scene's
    rubble: own.rubble === "yes" || (own.rubble !== "no" && scene?.flags?.animater?.rubbleDifficult === true),
    // a decoration view's own rule (decor-rules.mjs); never a tile's (it lives on the view, not in its flags)
    rule: DECOR_RULES.includes(tile?.decor?.rule) ? tile.decor.rule : null,
  };
}

// The style a break plays: a prop that tips over tips from any slam (checked first); a plant burns away from fire (a
// blast is fire) and splits from a slash, whatever its Breaks as; a prop set to Burn away burns from fire and
// otherwise shatters; a prop set (or guessed) to topple topples from force or a slam; Collapse only when the prop is
// set (or guessed) to it; otherwise it shatters.
export function breakStyle(traits, cause) {
  if (traits?.tips && cause?.slam) return "tip";
  const ruled = traits?.rule ? decorRuleStyle(traits.rule, cause) : null; // a decoration's own (a torn sack splits)
  if (ruled) return ruled;
  const fire = cause?.damageType === "fire" || cause?.blast === true;
  if (traits?.material === "plant") return fire ? "burn" : cause?.damageType === "slashing" ? "split" : "shatter";
  if (traits?.style === "burn") return fire ? "burn" : "shatter";
  if (traits?.style === "topple" && (cause?.damageType === "force" || cause?.slam)) return "topple";
  return traits?.style === "collapse" ? "collapse" : "shatter";
}
