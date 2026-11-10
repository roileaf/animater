// A breakable decoration's own options (pure, no Foundry globals): the tile's Breakable prop choices (Material, Breaks as,
// Contents, Burst, Light prop, Tips over) for painted decorations. Each is picked in three places, the first set winning: the
// decoration's own (saved on its brushed entry by the brush), its region's (the region panel), then its kind's default.
// Automatic never guesses from a file name: decorations have none. The options decide how a decoration breaks, never where it
// stands: they stay out of the placements, the keys and the painter's rebuilds.

import { MATERIALS } from "./prop-material.mjs";
import { CONTENTS, STYLE_CHOICES, BURST_DEFAULT, burstOf } from "./prop-traits.mjs";

/** The options, in the order the tile's fieldset shows them. */
export const DECOR_PROP_KEYS = Object.freeze(["material", "style", "contents", "burst", "light", "tips"]);
// What holds something to spill: Contents is offered (and the region's Contents applies) only for these.
export const DECOR_CONTAINERS = Object.freeze(new Set(["barrel", "crate", "produce", "sacks", "urns", "strongbox", "trough", "washtub", "bathtub", "bookshelf", "coffin", "cage", "planter", "cart", "sarcophagus", "counter", "desk", "marketStall"]));
// What is knocked over whole by any shove (a brazier, a street lamp, candles): Tips over is offered only for these.
export const DECOR_TIPPERS = Object.freeze(new Set(["brazier", "lampPost", "candles"]));
// What carries a light of its own (decorations.lights()): Light prop is Yes for these by default.
export const DECOR_LIGHT_KINDS = Object.freeze(new Set(["lampPost", "brazier", "candles", "hearth"]));
const YES_NO = new Set(["yes", "no"]);

/** The options as saved (pure): only known keys with a valid choice; Automatic ("" or missing) is left out. */
export function cleanDecorProp(raw) {
  const out = {};
  if (!raw || typeof raw !== "object") return out;
  if (MATERIALS.includes(raw.material)) out.material = raw.material;
  if (STYLE_CHOICES.includes(raw.style)) out.style = raw.style;
  if (CONTENTS.includes(raw.contents)) out.contents = raw.contents;
  const burst = typeof raw.burst === "number" ? raw.burst : typeof raw.burst === "string" && raw.burst.trim() ? Number(raw.burst) : NaN;
  if (Number.isFinite(burst)) out.burst = burstOf(burst);
  if (YES_NO.has(raw.light)) out.light = raw.light;
  if (YES_NO.has(raw.tips)) out.tips = raw.tips;
  return out;
}

/** Whether an option is offered for a kind (pure): Contents and Burst for containers, Tips over for what tips; the rest for any. */
export function decorOptionApplies(kind, key) {
  if (key === "contents" || key === "burst") return DECOR_CONTAINERS.has(kind);
  if (key === "tips") return DECOR_TIPPERS.has(kind);
  return DECOR_PROP_KEYS.includes(key);
}

/**
 * A kind's own answer to each option (pure), from its break entry (decor-break DECOR_BREAKS, the painted one for a throne,
 * a bathtub or a mooring post): { material, style, contents, burst, light, tips } with light and tips as booleans.
 */
export function decorPropDefaults(kind, entry) {
  return { material: entry?.material ?? "none", style: entry?.style ?? "shatter", contents: entry?.contents ?? "none", burst: BURST_DEFAULT,
    light: DECOR_LIGHT_KINDS.has(kind), tips: entry?.tips === true };
}

/**
 * How a decoration breaks (pure): each option its own choice (`own`, its brushed entry's `prop`), else its region's (`region`,
 * the region's `prop`), else its kind's default; a region's choice only where the option is offered for the kind. `rule`
 * (decor-rules) is the kind's own and holds only while its material is the kind's: a decoration made of something else breaks
 * by that material's rules. Returns { material, style, contents, burst, light, tips, rule }.
 */
export function resolveDecorProp(kind, entry, own, region) {
  const mine = cleanDecorProp(own), theirs = cleanDecorProp(region), base = decorPropDefaults(kind, entry);
  const pick = (key) => (decorOptionApplies(kind, key) && Object.hasOwn(mine, key) ? mine[key] : decorOptionApplies(kind, key) && Object.hasOwn(theirs, key) ? theirs[key] : undefined);
  const yes = (v, d) => (v === "yes" ? true : v === "no" ? false : d);
  const material = pick("material") ?? base.material;
  return {
    material, style: pick("style") ?? base.style, contents: pick("contents") ?? base.contents, burst: pick("burst") ?? base.burst,
    light: yes(pick("light"), base.light), tips: yes(pick("tips"), base.tips),
    rule: entry?.rule && material === base.material ? entry.rule : null,
  };
}

/** The prop flags a decoration view carries (pure): every option spelled out, so the prop rules never fall back to a name guess. */
export const decorPropFlags = (r) => ({ material: r.material, style: r.style, contents: r.contents, burst: r.burst, light: r.light ? "yes" : "no", tips: r.tips ? "yes" : "no" });
