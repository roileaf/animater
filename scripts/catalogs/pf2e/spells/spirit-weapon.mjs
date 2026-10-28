// Spiritual Armament makes a ghostly copy of a weapon the caster wields: the flung and hovering weapon takes that
// weapon's shape (an axe, a hammer, a spear, a sword…) from JB2A's spirit weapons. Without a held weapon, the
// caster's deity's favored weapon; without either, the stage's own art (a mace or club).
import { heavyItem } from "../../../systems/heavy-item.mjs";

// JB2A spirit weapon families, by PF2e base item.
const BY_BASE = {
  club: "club", greatclub: "greatclub", dagger: "dagger", "main-gauche": "dagger", falchion: "falchion", glaive: "glaive",
  halberd: "halberd", greataxe: "greataxe", "battle-axe": "greataxe", hatchet: "handaxe", handaxe: "handaxe",
  javelin: "javelin", katana: "katana", longsword: "longsword", "bastard-sword": "longsword", greatsword: "greatsword",
  mace: "mace", morningstar: "mace", maul: "maul", earthbreaker: "maul", staff: "quarterstaff", bo: "quarterstaff",
  rapier: "rapier", scimitar: "scimitar", scythe: "scythe", shortsword: "shortsword", spear: "spear",
  longspear: "spear", trident: "trident", warhammer: "warhammer", "light-hammer": "hammer",
};
// By weapon group: [one-handed, two-handed].
const BY_GROUP = {
  axe: ["handaxe", "greataxe"], hammer: ["warhammer", "maul"], sword: ["longsword", "greatsword"], knife: ["dagger", "dagger"],
  spear: ["spear", "spear"], polearm: ["glaive", "halberd"], club: ["club", "greatclub"], flail: ["mace", "mace"],
  pick: ["warhammer", "warhammer"],
};
export const SPIRIT_WEAPON_FAMILIES = Object.freeze([...new Set([...Object.values(BY_BASE), ...Object.values(BY_GROUP).flat()])]);

const slugOf = (s) => String(s ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
// The spirit weapon family of one PF2e weapon item (null for a ranged or unarmed weapon).
export function weaponFamily(item, systemId = "pf2e") {
  const sys = item?.system ?? {};
  const base = BY_BASE[slugOf(sys.baseItem)] ?? BY_BASE[slugOf(sys.slug)];
  if (base) return base;
  const group = BY_GROUP[sys.group];
  return group ? group[heavyItem(item, systemId) ? 1 : 0] : null;
}

// The family for this caster: the first held melee weapon, else the deity's favored weapon.
export function spiritWeaponFamily(actor, systemId = "pf2e") {
  const weapons = Array.from(actor?.itemTypes?.weapon ?? actor?.items ?? []).filter((i) => i?.type === "weapon" || i?.system?.group);
  const held = weapons.filter((w) => w.system?.equipped?.carryType === "held" && !(Number(w.system?.range) > 0));
  for (const w of held) { const f = weaponFamily(w, systemId); if (f) return f; }
  for (const slug of actor?.deity?.system?.weapons ?? []) { const f = BY_BASE[slugOf(slug)]; if (f) return f; }
  return null;
}

// The keys to try for a family: astral purple (the spell's colour) first, then any of its art.
export const spiritWeaponAssets = (family) => family ? [`jb2a.spiritual_weapon.${family}.01.astral.01.purple`, `jb2a.spiritual_weapon.${family}`] : [];

// The recipe with its spirit-weapon stages showing the caster's weapon (their own art stays as a fallback).
export function withSpiritWeapon(recipe, actor, systemId = "pf2e") {
  if (!recipe?.stages?.some((s) => s.spiritWeapon)) return recipe;
  const family = spiritWeaponFamily(actor, systemId);
  if (!family) return recipe;
  const keys = spiritWeaponAssets(family);
  return { ...recipe, stages: recipe.stages.map((s) => s.spiritWeapon ? { ...s, assets: [...keys, ...s.assets.filter((a) => !keys.includes(a))].slice(0, 8) } : s) };
}
