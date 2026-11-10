// Prop material: guessed from the tile's file name, overridable per tile; decides what can break it.
export const MATERIALS = ["wood", "glass", "clay", "metal", "stone", "none"];

const TOKENS = {
  wood: ["barrel", "crate", "box", "chest","cart", "table", "chair", "bench", "stool", "shelf", "wood", "wooden", "plank", "keg"],
  glass: ["bottle", "glass", "jar", "vial", "potion", "flask", "window"],
  clay: ["pot", "vase", "urn", "amphora", "ceramic", "clay", "jug"],
  metal: ["metal", "iron", "steel", "cage", "brazier"],
  stone: ["stone", "statue", "pillar", "column", "rock"],
};
const BOXY = new Set(["crate", "box", "chest", "table", "shelf", "cart"]);
const BREAKING = new Set(["bludgeoning", "piercing", "slashing", "fire", "cold", "electricity", "acid", "sonic", "force"]);
const BROKEN_BY = {
  wood: new Set(["bludgeoning", "slashing", "fire", "electricity", "force"]),
  metal: new Set(["bludgeoning", "force", "acid"]),
  stone: new Set(["force"]),
};
const BIG_SLAM = 2; // Large or bigger
const MAX_SIDE = 3; // squares; bigger tiles are floor or roof pieces

const TOKEN_MATERIAL = new Map();
for (const [m, words] of Object.entries(TOKENS)) for (const w of words) TOKEN_MATERIAL.set(w, m);

const decoded = (s) => { try { return decodeURIComponent(s); } catch { return s; } };
// file name only (no folders, no extension, percent-encoding undone: Old%20Barrel), camelCase split, lowercase tokens
function nameTokens(src) {
  const name = decoded(String(src ?? "").split(/[\/]/).pop()).replace(/\.[^.]*$/, "");
  return name.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

export function guessMaterial(src) {
  for (const t of nameTokens(src)) if (TOKEN_MATERIAL.has(t)) return TOKEN_MATERIAL.get(t);
  return "none";
}

export function propShape(src) {
  return nameTokens(src).some(t => BOXY.has(t)) ? "boxy" : "round";
}

// v14 drops tile.overhead; fall back to the occlusion mode
const isOverhead = tile => tile.overhead ?? (tile.occlusion?.mode > 0);

export function propMaterial(tile, grid) {
  const set = tile?.flags?.animater?.prop?.material;
  if (MATERIALS.includes(set)) return set;
  if (!tile || tile.roof || isOverhead(tile)) return "none";
  if (Math.max(tile.width, tile.height) > MAX_SIDE * grid) return "none";
  return guessMaterial(tile.texture?.src);
}

export function canBreak(material, cause = {}) {
  if (!MATERIALS.includes(material) || material === "none") return false;
  const { damageType, slam } = cause;
  if (slam) {
    if (material === "metal" || material === "stone") return slam.size >= BIG_SLAM;
    return true;
  }
  if (!BREAKING.has(damageType)) return false;
  return BROKEN_BY[material] ? BROKEN_BY[material].has(damageType) : true;
}
