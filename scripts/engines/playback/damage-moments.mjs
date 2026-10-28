// Damage moments: a token that takes energy damage flashes in that damage's look,
// and one that drops to 0 HP goes down in it (burned to ash, shattered in ice...).
// The damage type comes from the latest damage roll aimed at that creature.
import { isSyntheticItem, strikeItemOf, strikeLostItem, strikeSlugFromOptions, syntheticUuid } from "../finishers/strike-finishers.mjs";
import { daggerheartAttackKind, daggerheartDamage } from "../../systems/daggerheart.mjs";

// Every system's names folded onto one set of looks.
const ALIASES = {
  lightning: "electricity", thunder: "sonic", necrotic: "void", negative: "void", unholy: "void",
  radiant: "vitality", positive: "vitality", holy: "vitality", psychic: "mental",
};
export const normalizeDamageType = (type) => {
  const t = String(type ?? "").trim().toLowerCase();
  return ALIASES[t] ?? t;
};

// hit: a short flash on the token. death: what finishes the collapse. Physical
// damage (bludgeoning, piercing, slashing, bleed) keeps the plain collapse; weapon
// hits already animate on their own.
const LOOKS = {
  fire: { color: "#ff8a3d", hit: ["jb2a.flames.01.orange", "jb2a.impact.003.orange"], death: ["jb2a.flames.04.complete.orange", "jb2a.explosion.01.orange"], after: ["jb2a.smoke.puff.centered.dark_black", "jb2a.smoke.puff.centered.grey"], label: "burns to ash" },
  cold: { color: "#8fd0ff", hit: ["jb2a.impact_themed.ice_shard.blue", "jb2a.impact.003.blue"], death: ["jb2a.ice_spikes.radial.burst.blue", "jb2a.impact.005.blue"], after: ["jb2a.shatter.blue", "jb2a.impact.003.blue"], label: "freezes and shatters" },
  electricity: { color: "#9fd8ff", hit: ["jb2a.static_electricity.01.blue", "jb2a.impact.004.blue"], death: ["jb2a.static_electricity.03.blue", "jb2a.static_electricity.01.blue"], after: ["jb2a.smoke.puff.centered.grey"], label: "is fried by lightning" },
  acid: { color: "#a6e05a", hit: ["jb2a.liquid.splash.bright_green", "jb2a.impact.003.green"], death: ["jb2a.liquid.blob.green", "jb2a.liquid.splash.green"], after: ["jb2a.fumes.04.complete.green", "jb2a.smoke.puff.centered.green"], label: "dissolves in acid" },
  poison: { color: "#9ac885", hit: ["jb2a.impact_themed.poison.greenyellow", "jb2a.impact.003.green"], death: ["jb2a.fumes.toxic.green", "jb2a.smoke.puff.centered.dark_green"], after: [], label: "succumbs to poison" },
  void: { color: "#6b4a8f", hit: ["jb2a.impact.004.dark_purple", "jb2a.impact.003.dark_purple"], death: ["jb2a.toll_the_dead.grey.skull_smoke", "jb2a.smoke.puff.centered.dark_purple"], after: [], label: "withers into shadow" },
  vitality: { color: "#ffe9a3", hit: ["jb2a.sacred_flame.target.yellow", "jb2a.impact.003.yellow"], death: ["jb2a.sacred_flame.target.white", "jb2a.sacred_flame.target.yellow"], after: ["jb2a.particle_burst.01.star.yellow"], label: "is burned away by light" },
  force: { color: "#b58cff", hit: ["jb2a.impact.005.purple", "jb2a.impact.003.pinkpurple"], death: ["jb2a.explosion.04.dark_purple", "jb2a.explosion.01.purple"], after: ["jb2a.smoke.puff.ring.01.white"], label: "is blasted apart" },
  mental: { color: "#b07cff", hit: ["jb2a.particle_burst.01.rune.bluepurple", "jb2a.impact.009.purple"], death: ["jb2a.smoke.puff.centered.dark_purple", "jb2a.impact.009.purple"], after: [], label: "collapses, mind broken" },
  sonic: { color: "#c8d0e0", hit: ["jb2a.soundwave.01.blue", "jb2a.impact.005.white"], death: ["jb2a.soundwave.02.blue", "jb2a.soundwave.01.blue"], after: ["jb2a.ground_cracks.01.white"], label: "is shaken apart" },
  spirit: { color: "#dfe6f2", hit: ["jb2a.impact.005.white", "jb2a.impact.003.yellow"], death: ["jb2a.smoke.puff.ring.01.white", "jb2a.impact.005.white"], after: [], label: "loses its spirit" },
};
export const damageLook = (type) => LOOKS[normalizeDamageType(type)] ?? null;
// Tokenshade's look for each damage type, on the token's own artwork. Each preset is
// already coloured for its damage, so no tint is laid over it.
const FILTERS = {
  fire: { preset: "Burning" }, cold: { preset: "Frostbitten" }, electricity: { preset: "Electrocuted" },
  acid: { preset: "Corroding" }, poison: { preset: "Envenomed" }, void: { preset: "Withering" },
  vitality: { preset: "Radiant Burn" }, force: { preset: "Force Jolt" }, mental: { preset: "Psychic Warp" },
  sonic: { preset: "Resonance" }, spirit: { preset: "Spirit Rend" },
};
const filterStage = (stageId, type, extra) => {
  const f = FILTERS[normalizeDamageType(type)];
  return f ? [{ stageId, kind: "tokenfx", assets: [], catalogFx: true, fxProfile: "damage", fxPreset: f.preset, fxLibrary: "tokenshade", fxTint: f.tint ?? "", ...extra }] : [];
};

// How the blow was struck. PF2e/SF2e strikes carry item:melee / item:ranged roll options
// (melee damage also the melee-damage domain); D&D only says weapon or spell here, so its
// weapons count as melee.
export function attackKindOf(message, systemId) {
  // Daggerheart: a weapon's range (melee / very close are melee), a spellcast roll is a spell.
  if (systemId === "daggerheart") return daggerheartAttackKind(message);
  const flags = message?.flags?.[systemId], dnd = message?.flags?.dnd5e;
  const itemType = flags?.origin?.type ?? dnd?.item?.type;
  if (itemType === "spell") return "spell";
  const marks = new Set([...(flags?.context?.domains ?? []), ...(flags?.context?.options ?? [])].map(String));
  if (marks.has("item:ranged")) return "ranged";
  if (marks.has("item:melee") || marks.has("melee-damage") || ["weapon", "melee"].includes(itemType)) return "melee";
  return "other";
}

// The main damage type of a damage roll message, and who it was aimed at.
export function damageFromMessage(message, systemId) {
  // Daggerheart writes its damage roll onto the attack card (system.damage); its type is already
  // mapped to these names (physical by weapon family, magical by domain).
  if (systemId === "daggerheart") return daggerheartDamage(message);
  const rolls = Array.from(message?.rolls ?? []);
  const pf = message?.flags?.[systemId]?.context, dnd = message?.flags?.dnd5e;
  const isDamage = pf?.type === "damage-roll" || dnd?.roll?.type === "damage" || rolls.some((r) => /DamageRoll/.test(r?.constructor?.name ?? ""));
  if (!isDamage) return null;
  const parts = rolls.flatMap((r) =>
    Array.isArray(r?.instances) && r.instances.length
      ? r.instances.map((i) => ({ type: i.type, total: Number(i.total) || 0 }))
      : [{ type: r?.options?.type ?? r?.options?.types?.[0], total: Number(r?.total) || 0 }]);
  const best = parts.filter((p) => p.type).sort((a, b) => b.total - a.total)[0];
  if (!best) return null;
  const idOf = (uuid, kind) => String(uuid ?? "").match(new RegExp(`${kind}\\.([^.]+)`))?.[1];
  const tokenIds = new Set(), actorIds = new Set();
  if (pf?.target) { const t = idOf(pf.target.token, "Token"), a = idOf(pf.target.actor, "Actor"); if (t) tokenIds.add(t); if (a) actorIds.add(a); }
  for (const target of Array.isArray(dnd?.targets) ? dnd.targets : []) {
    const t = idOf(target?.uuid, "Token"), a = idOf(target?.uuid, "Actor");
    if (t) tokenIds.add(t); if (a) actorIds.add(a);
  }
  const crit = pf?.outcome === "criticalSuccess" || rolls.some((r) => r?.isCritical === true || r?.options?.isCritical === true);
  // A synthetic strike (PF2e's basic unarmed, a rule-element strike) has no Item document: the
  // kill finds its pick on the attacking actor by the strike's name or slug.
  // A rule-element strike (Tiger Claw) is one too: its message.item is the feat that grants it.
  const origin = message?.flags?.[systemId]?.origin, item = strikeItemOf(message, systemId);
  const itemUuid = origin?.uuid ?? dnd?.item?.uuid ?? null;
  // types: every damage type in the roll, the largest share first (lens blood asks whether any of it was physical;
  // the lens effects show the first two energy types).
  const types = [...new Set(parts.filter((p) => p.type).sort((a, b) => b.total - a.total).map((p) => normalizeDamageType(p.type)))];
  return { type: normalizeDamageType(best.type), types, tokenIds, actorIds, sourceTokenId: message?.speaker?.token ?? null, attackKind: attackKindOf(message, systemId), crit,
    itemUuid, itemName: item?.name ?? null, itemSlug: item?.slug ?? item?.system?.slug ?? strikeSlugFromOptions(pf?.options) ?? null,
    actorUuid: origin?.actor ?? null, synthetic: isSyntheticItem(item) || syntheticUuid(itemUuid) || strikeLostItem(message, systemId) };
}

// D&D 5e: the damage parts it is about to apply to this actor (dnd5e.calculateDamage).
export function damageFromParts(parts, actorId) {
  const sorted = Array.from(parts ?? []).filter((p) => p?.type && Number(p.value) > 0).sort((a, b) => Number(b.value) - Number(a.value)), best = sorted[0];
  return best ? { type: normalizeDamageType(best.type), types: [...new Set(sorted.map((p) => normalizeDamageType(p.type)))], tokenIds: new Set(), actorIds: new Set([actorId]) } : null;
}
// The damage a creature most likely just took: the newest roll aimed at it, else
// the newest roll aimed at nobody in particular, within the last half minute.
export const DAMAGE_MEMORY_MS = 30000;
export function recallDamage(log, { actorId, tokenId }, now = Date.now()) {
  const fresh = log.filter((d) => now - d.at <= DAMAGE_MEMORY_MS).sort((a, b) => b.at - a.at);
  return fresh.find((d) => d.tokenIds.has(tokenId) || d.actorIds.has(actorId))
    ?? fresh.find((d) => !d.tokenIds.size && !d.actorIds.size) ?? null;
}
// Who struck the blow: D&D's applied damage does not say, so ask the newest roll that does.
export const recallAttribution = (log, ids, now = Date.now()) => recallDamage(log.filter((d) => d.sourceTokenId), ids, now);

// Cast stages play on the source token: here, the creature that took the damage.
const stage = (stageId, assets, extra) => ({ stageId, kind: "cast", assets, ...extra });
// How the body takes the hit: a creature struck by lightning convulses as the current runs through it.
const BODY = { electricity: { motion: "electrocute", duration: 1300, distance: 0.35, intensity: 1 } };
// A short flash on the damaged token.
export function hitRecipe(type) {
  const look = damageLook(type), body = BODY[normalizeDamageType(type)];
  if (!look) return null;
  return { id: `animater-hit-${normalizeDamageType(type)}`, name: `Took ${normalizeDamageType(type)} damage`, trigger: "manual", color: look.color, stages: [stage("hit", look.hit, { duration: 1200, scale: 0.9, opacity: 0.9 }), ...filterStage("hit-filter", type, { duration: 1400 }),
    ...(body ? [{ stageId: "hit-body", kind: "motion", subject: "source", assets: [], ...body }] : [])] };
}
// The 0 HP collapse, finished in the damage's look (or plain for physical damage).
export function deathRecipe(type, collapse) {
  const look = damageLook(type);
  if (!look) return collapse;
  return {
    ...collapse, id: `animater-death-${normalizeDamageType(type)}`, name: `Dropped to 0 HP: ${look.label}`, color: look.color,
    stages: [...collapse.stages,
      ...filterStage("death-filter", type, { duration: 2400 }),
      stage("death", look.death, { delay: 150, duration: 2000, scale: 1.2 }),
      ...(look.after.length ? [stage("after", look.after, { delay: 1400, duration: 1800, scale: 1, opacity: 0.85 })] : [])],
  };
}
