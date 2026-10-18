// Daggerheart catalog polish: the sound design and token motion each Daggerheart entry plays with,
// on top of its visual stages (daggerheart-catalog.mjs). Sounds reuse the shared profiles
// (data/ability-sounds.mjs for weapons, data/spell-sounds.mjs for magic) and play only when a
// matching audio pack is installed and the catalog's Sounds switch is on. Pure: no Foundry globals.
import { addAbilitySounds } from "../../engines/sound/ability-sounds.mjs";
import { addSpellSounds } from "../../engines/sound/spell-sounds.mjs";

const first = (rules, text) => rules.find(([pattern]) => pattern.test(String(text ?? "")))?.[1] ?? null;

// Weapons: a physical profile by family and name, melee or ranged; a magic weapon's shot sounds arcane.
const MELEE_SOUNDS = {
  blade: [[/dagger|knife|knives|anlace|scalpel|razor/i, "dagger"], [/axe|hatchet|labrys/i, "axe"], [/rapier|estoc/i, "rapier"],
    [/katana|scimitar|cutlass|saber|sabre|falchion/i, "katana"], [/greatsword|claymore|zweihander|great sword/i, "greatsword"], [/scythe/i, "polearmBlade"], [/./, "sword"]],
  bow: [[/./, "staff"]],
  firearm: [[/./, "sword"]],
  magic: [[/./, "staff"]],
  hammer: [[/mace|club|baton|shillelagh/i, "club"], [/knuckle|gauntlet|fist/i, "unarmed"], [/flail/i, "flail"], [/whip|lash/i, "whip"], [/./, "hammer"]],
  spear: [[/halberd|glaive|polearm|corbin|pike|scythe/i, "polearmBlade"], [/./, "spear"]],
  shield: [[/./, "shieldStrike"]],
  generic: [[/claw|talon|rake|scratch/i, "claw"], [/bite|fang|jaw|maw|teeth|mandible|gnaw/i, "naturalPierce"],
    [/fist|punch|slam|tail|horn|ram\b|tentacle|unarmed|kick|headbutt|hoof|stomp|tusk|gore/i, "unarmed"], [/./, "sword"]],
};
const RANGED_SOUNDS = {
  blade: [[/axe|hatchet/i, "thrownAxe"], [/./, "thrownDagger"]],
  bow: [[/crossbow|arbalest/i, "crossbow"], [/sling/i, "sling"], [/longbow|greatbow/i, "longbow"], [/shortbow/i, "shortbow"], [/./, "bow"]],
  firearm: [[/pistol|revolver/i, "pistol"], [/musket|rifle|arquebus/i, "musket"], [/./, "firearm"]],
  hammer: [[/./, "thrown"]],
  spear: [[/./, "thrownSpear"]],
  shield: [[/./, "thrown"]],
  generic: [[/./, "ranged"]],
};
export function weaponSoundDesign(style, name) {
  const family = style?.family ?? "generic";
  if (!style?.melee && family === "magic") return { namespace: "spell", profile: "force" };
  const profile = first((style?.melee ? MELEE_SOUNDS : RANGED_SOUNDS)[family] ?? (style?.melee ? MELEE_SOUNDS.generic : RANGED_SOUNDS.generic), name);
  return profile ? { namespace: "ability", profile, mode: style?.melee ? "melee" : "ranged" } : null;
}

// Cards: what the card's name and design describe first (fire, frost, healing, a teleport…), then a
// sound for its domain.
const CARD_WORDS = [
  [/heal|mend|restor|cure|regenerat|revive|renew/i, "healing"], [/fire|flame|burn|cinder|ember|inferno|blaze|scorch/i, "fire"],
  [/ice|frost|cold|snow|freez|chill|winter|glacier/i, "cold"], [/lightning|thunder|storm|shock|spark|arc\b/i, "electric"],
  [/acid|corro/i, "acid"], [/poison|venom|toxic|blight|rot\b/i, "poison"], [/earth|stone|quake|rock|tremor/i, "earth"],
  [/wind|gust|whirl|gale|tempest/i, "wind"], [/water|wave|tide|flood/i, "water"], [/teleport|blink|portal|translocat|step\b/i, "teleport"],
  [/summon|conjur|familiar|companion/i, "summon"], [/shadow|dark|night|umbra|eclipse/i, "shadow"], [/light|radian|sun|dawn|glow/i, "light"],
  [/fear|terror|dread|horror|fright/i, "fear"], [/sleep|slumber|dream/i, "sleep"], [/vine|root|thorn|bramble|entangl|grow/i, "vines"],
  [/shield|ward|barrier|protect|aegis|guard/i, "shield"], [/song|sing|melod|chorus|tune/i, "song"], [/mind|psych|thought|telepath|memory/i, "psychic"],
  [/time|slow|haste|rewind/i, "time"], [/bless|inspir|hope|rally/i, "bless"],
];
const DOMAIN_SOUNDS = { arcana: "force", blade: "slash", bone: "drain", codex: "force", dread: "fear", grace: "whispers", midnight: "shadow", sage: "vines", splendor: "holy", valor: "shield" };
export function cardSoundDesign(card, design, motif = "") {
  const profile = design === "mend" ? "healing" : first(CARD_WORDS, `${card?.name ?? ""} ${motif}`) ?? DOMAIN_SOUNDS[String(card?.domain ?? "").toLowerCase()] ?? "force";
  return { namespace: "spell", profile };
}

// Feature fallbacks by element and shape; ability fallbacks by look.
const FEATURE_SOUNDS = {
  cold: { breath: "coldCone", burst: "cold", strike: "cold" }, fire: { breath: "fireCone", burst: "explosion", strike: "fire" },
  lightning: { breath: "lightningBolt", burst: "electric", strike: "electricTouch" }, acid: { breath: "acid", burst: "acid", strike: "acidSplash" },
  poison: { breath: "poison", burst: "poison", strike: "poison" }, arcane: { breath: "force", burst: "force", strike: "force" },
  physical: { breath: "earthquake", burst: "earthquake", strike: "bludgeon" },
};
export const featureSoundDesign = (element, shape) => ({ namespace: "spell", profile: (FEATURE_SOUNDS[element] ?? FEATURE_SOUNDS.physical)[shape] ?? "force" });
const UTILITY_SOUNDS = { heal: "healing", hope: "bless", fear: "fear", boon: "shield" };
export const utilitySoundDesign = (look) => ({ namespace: "spell", profile: UTILITY_SOUNDS[look] ?? "shield" });

// The variant's sounds on its stages (dhRecipe). Without an audio pack or a design, the stages as they are.
export function withDhSounds(entry, variant, stages, { sounds, soundVolume = 0.35 } = {}) {
  const design = variant?.sound;
  if (!sounds || !design?.profile) return stages;
  const item = { id: variant.id, slug: entry.name ?? entry.id };
  return design.namespace === "ability"
    ? addAbilitySounds(item, stages, { sounds, soundVolume, mode: design.mode, design: { profile: design.profile } })
    : addSpellSounds(item, stages, { sounds, soundVolume, design: { profile: design.profile } });
}

// Token motion, as PF2e weapons have it: melee wielders lunge, bows draw, guns kick, throwers wind
// back, casters pulse; a struck target shakes. Stage delays leave the visuals' timing as authored
// except the strike, which lands at the height of the lunge.
const move = (stageId, label, motion, subject, delay, duration, intensity, distance, extra = {}) =>
  ({ kind: "motion", stageId, label, assets: [], motion, subject, delay, duration, intensity, distance, targetSelection: "first", ...extra });
const shake = (delay) => move("target-shake", "Struck target shakes", "shake", "targets", delay, 500, 0.6, 0.04, { requiresHit: true, optionalTargets: true });
export function weaponMotion(style, stages) {
  const hit = stages.find((s) => s.stageId?.startsWith("hit"));
  if (style?.melee) {
    const lead = 520;
    const timed = stages.map((s) => ({ ...s, delay: (s.delay ?? 0) + lead }));
    return [move("wielder-lunge", style.family === "spear" ? "Reaching thrust" : "Lunge into the strike", "lunge", "source", 0, 1250, 1, style.family === "spear" ? 0.12 : 0.14),
      ...timed, shake((hit?.delay ?? 550) + lead + 80)];
  }
  const thrown = ["blade", "spear", "hammer", "shield"].includes(style?.family), firearm = style?.family === "firearm", bow = style?.family === "bow";
  const shot = stages.find((s) => s.kind === "travel");
  const gesture = firearm ? move("wielder-recoil", "Discharge recoil", "recoil", "source", shot?.delay ?? 0, 900, 1, 0.08)
    : bow ? move("wielder-draw", "Draw and loose", "brace", "source", 0, 900, 1, 0.1)
    : thrown ? move("wielder-throw", "Wind back and throw", "throw", "source", 0, 900, 1, 0.12)
    : move("wielder-pulse", "Casting pulse", "pulse", "source", 0, 700, 0.8, 0.05);
  return [gesture, ...stages, shake((hit?.delay ?? 850) + 80)];
}
export function featureMotion(element, shape, stages) {
  const hit = stages.find((s) => s.stageId === "hit");
  const source = shape === "burst" && element === "physical" ? move("adversary-slam", "Rise and slam down", "slam", "source", 0, 1100, 1, 0.1)
    : shape === "strike" ? null : move("adversary-pulse", shape === "breath" ? "Rears back to breathe" : "Gathers power", "pulse", "source", 0, 900, 1, 0.06);
  return [...(source ? [source] : []), ...stages, { ...shake((hit?.delay ?? 700) + 80), requiresHit: false }];
}
export function utilityMotion(look, stages) {
  return [move("user-pulse", look === "heal" ? "Rises with renewed strength" : look === "fear" ? "Darkens with menace" : "Draws on resolve",
    look === "heal" ? "levitate" : "pulse", "source", 0, 1100, look === "fear" ? 1 : 0.6, 0.05), ...stages];
}
