// A thing lifted out of the map's picture (mapbuild/map-lift.mjs) breaks with the decorations of the region it stands in (pure).
//
// A lifted thing is a tile, and a tile breaks by what it is made of — which for most tiles is read from the name of its
// picture. A lifted thing's picture has no name to read: it is a piece cut from the map. So unless the GM opened each
// one's Tile configuration and said what it was made of, none of them ever broke. (Roi: "when we use lift from map it
// should be considered as a decoration to be set as breakable".) A region's "Decorations can break" now counts the
// lifted things standing in it: each is given the region's break options (the same six a painted decoration takes,
// decor-options.mjs), written onto the tile itself so every screen and every rule reads them as it reads any tile's.
//
// What a thing was given is remembered beside it (flags.animater.liftedProp), so that the region can change it or take
// it back, and so that a choice made on the thing itself — with the brush as it was lifted, or in its Tile
// configuration afterwards — is known for the thing's own and never written over.

import { cleanDecorProp, DECOR_PROP_KEYS } from "./decor-options.mjs";

/** What a lifted thing is made of where its region does not say: most of what is lifted is a table, a crate, a barrel. */
export const LIFTED_MATERIAL = "wood";

// One lifted as a bush or a tree is a tree tile (map-lift.mjs liftTileData): it burns, whatever stands beside it.
const grows = (tile) => tile?.flags?.animater?.sunlight === "tree";
const same = (a, b) => DECOR_PROP_KEYS.every((k) => (a[k] ?? null) === (b[k] ?? null));
const remembered = (raw) => { try { return typeof raw === "string" && raw ? cleanDecorProp(JSON.parse(raw)) : null; } catch { return null; } };

/**
 * The break options a region gives a lifted thing standing in it (pure): `decor` the region's decoration settings
 * (flags.animater.decor). Null unless its decorations can break; else its own options with a material always said.
 */
export function liftedRegionProp(tile, decor) {
  if (decor?.canBreak !== true) return null;
  // (A bush or a tree takes nothing else of the region's: it holds no water to spill and is no lamp.)
  if (grows(tile)) return { material: "plant" };
  const theirs = cleanDecorProp(decor.prop);
  return { ...theirs, material: theirs.material ?? LIFTED_MATERIAL };
}

/**
 * What to write on a lifted tile so it breaks as its region says (pure): a flat update, or null when there is nothing
 * to write. `tile` the tile (its flags), `decor` the decoration settings of the region it stands in, or null when it
 * stands in none whose decorations break. A break the tile carries (prop.broken) is never touched.
 */
export function liftedPropUpdate(tile, decor) {
  const a = tile?.flags?.animater;
  if (a?.lifted !== true) return null;
  const own = cleanDecorProp(a.prop), given = remembered(a.liftedProp), wanted = liftedRegionProp(tile, decor);
  // Its own choice: something is set on it, and it is not what a region gave.
  if (Object.keys(own).length > 0 && !(given && same(own, given))) return given ? { "flags.animater.-=liftedProp": null } : null;
  const out = {};
  if (!wanted) {
    if (!given) return null;
    for (const k of Object.keys(given)) out[`flags.animater.prop.-=${k}`] = null;
    out["flags.animater.-=liftedProp"] = null;
    return out;
  }
  if (given && same(given, wanted) && same(own, wanted)) return null;
  for (const [k, v] of Object.entries(wanted)) out[`flags.animater.prop.${k}`] = v;
  for (const k of Object.keys(given ?? {})) if (!Object.hasOwn(wanted, k)) out[`flags.animater.prop.-=${k}`] = null;
  out["flags.animater.liftedProp"] = JSON.stringify(wanted);
  return out;
}
