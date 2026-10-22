// Daggerheart adapter (the Foundryborne `daggerheart` system): pure functions that turn its chat
// messages and action hooks into Animater events and damage-log entries. Shapes verified against
// daggerheart 2.10.12 (build/daggerheart.js): roll messages are type "dualityRoll" (players) or
// "adversaryRoll" (adversaries); their system is DHActorRoll (source { actor uuid, item id, action },
// targets [{ id: token id, actorId: actor uuid, difficulty, evasion }], damage { main, resources }),
// and system.roll / item / action / actionActor are getters. The roll's own options.roll.type is
// "action" or "reaction" (D20Roll.buildEvaluate overwrites it with the actionType), so the attack or
// spellcast type is read from system.action.roll.type (CONFIG.DH.GENERAL.rollTypes). A hit is the system's own rule
// (DHActorRoll._getCurrentTargets): a critical, or the total reaching difficulty || evasion.
// Every read is optional-chained: a shape that moves in a later version skips the event
// ({ skipped } for the caller to trace) and never throws.
import { rollPrivacy, modePrivacy, hidden, hiddenReason, hidesResult } from "../core/privacy.mjs";
export const DAGGERHEART_VERIFIED = "2.10.12";
export const DH_ROLL_TYPES = new Set(["attack", "spellcast"]);
export const DH_MESSAGE_TYPES = new Set(["dualityRoll", "adversaryRoll"]);
// Weapon and action ranges (CONFIG.DH.GENERAL.range ids) that strike in melee.
export const MELEE_RANGES = new Set(["melee", "veryClose"]);
// The domains of 2.10.12's domain cards (the spec's nine, plus Dread).
export const DH_DOMAINS = Object.freeze(["arcana", "blade", "bone", "codex", "dread", "grace", "midnight", "sage", "splendor", "valor"]);

export function versionBelow(version, floor = DAGGERHEART_VERIFIED) {
  const parts = (v) => String(v ?? "").split(".").map((n) => Number.parseInt(n, 10) || 0);
  const a = parts(version), b = parts(floor);
  for (let i = 0; i < Math.max(a.length, b.length); i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) < (b[i] ?? 0);
  return false;
}

const list = (value) => (Array.isArray(value) ? value : value instanceof Set ? [...value] : []);
const authorOf = (message) => message?.author?.id ?? message?.user?.id;
// privacy.mjs: a GM's private roll plays without its outcome; a hidden one is a Skipped row.
const isPrivate = (message) => rollPrivacy(message) !== "public";
// A D20 or Duality roll only: a direct-damage message's rolls[0] is a DamageRoll.
const isD20Roll = (r) => Boolean(r?.dHope || r?.d20 || /Duality|D20/.test(r?.constructor?.name ?? ""));
const rollOf = (message) => message?.system?.roll ?? Array.from(message?.rolls ?? []).find(isD20Roll) ?? null;
// options.roll.type is "action" / "reaction" on a real roll: the action's own type comes first.
const rollTypeOf = (message) => {
  const fromAction = message?.system?.action?.roll?.type;
  if (DH_ROLL_TYPES.has(fromAction)) return fromAction;
  const fromRoll = rollOf(message)?.options?.roll?.type;
  return DH_ROLL_TYPES.has(fromRoll) ? fromRoll : fromAction ?? null;
};
const tokenUuids = (ids, sceneId) => (sceneId ? ids.map((id) => `Scene.${sceneId}.Token.${id}`) : []);
const actorIdOf = (uuid) => String(uuid ?? "").match(/Actor\.([^.]+)/)?.[1] ?? null;
export const domainOf = (item) => String(item?.system?.domain ?? "").toLowerCase() || null;

// The item, action and acting actor behind a roll message. An adversary's standard attack has no
// Item (its action lives on the actor): it is named by its action.
function sourceOf(message) {
  const system = message?.system;
  const item = system?.item ?? null, action = system?.action ?? null;
  const actor = system?.actionActor ?? item?.actor ?? message?.speakerActor ?? null;
  return { item, action, actor, name: item?.name ?? action?.name ?? null };
}

export function dhDamageKind(types) {
  const values = (Array.isArray(types) ? types : types instanceof Set ? [...types] : types ? [types] : []).map(String);
  return values.includes("magical") ? "magical" : values.includes("physical") ? "physical" : null;
}

// Strike families by weapon name (Daggerheart has no weapon groups). First match wins, so a Rune
// Shield is a shield, a Gunblade a firearm and a Hand Crossbow a bow.
const FAMILIES = [
  ["shield", /shield|buckler/i],
  ["firearm", /gun|pistol|rifle|revolver|musket|arquebus|blunderbuss|cannon|serpentine/i],
  ["bow", /bow|arbalest|sling/i],
  ["spear", /spear|\blance\b|halberd|\bpike\b|polearm|javelin|\bdarts?\b|needle|trident|glaive|corbin/i],
  ["hammer", /hammer|mace|maul|flail|club|baton|knuckle|shillelagh|\bpick\b|gauntlet/i],
  ["blade", /blade|sword|dagger|knife|knives|axe|hatchet|labrys|katana|rapier|scimitar|cutlass|falchion|saber|scythe|razor|scalpel|anlace|estoc|edge|claw|talon|chakram|zweih|\bfan\b|\bstar\b/i],
  ["magic", /staff|wand|\borb\b|\btome\b|runes?\b|scepter|\brings?\b|\bgem\b|shard|focus|pendant|bangle|\blute\b/i],
];
export function weaponFamily(name, damageTypes = []) {
  const text = String(name ?? "");
  for (const [family, pattern] of FAMILIES) if (pattern.test(text)) return family;
  return dhDamageKind(damageTypes) === "magical" ? "magic" : null;
}

// The killing blow's damage type in Animater's names (damage reactions, "By damage type" finishers):
// physical by the weapon family, magical by the card's domain. Unknown physical is slashing
// (Carved), unknown or no domain is force (Blown apart).
const PHYSICAL_TYPES = { blade: "slashing", bow: "piercing", spear: "piercing", firearm: "piercing", hammer: "bludgeoning", shield: "bludgeoning" };
const MAGICAL_TYPES = { arcana: "force", midnight: "void", dread: "void", splendor: "vitality", grace: "vitality", sage: "poison", codex: "mental", bone: "bleed", blade: "slashing", valor: "slashing" };
export function daggerheartDamageType({ type, item = null, itemName = null } = {}) {
  const kind = dhDamageKind(type);
  if (kind === "physical") return PHYSICAL_TYPES[weaponFamily(item?.name ?? itemName)] ?? "slashing";
  if (kind === "magical") return MAGICAL_TYPES[domainOf(item)] ?? "force";
  return null;
}

export function rollIsCritical(roll) {
  if (!roll) return false;
  if (roll?.isCritical === true || roll?.options?.roll?.isCritical === true || roll?.options?.roll?.result?.duality === 0) return true;
  const hope = roll?.dHope?.total, fear = roll?.dFear?.total;
  return Number.isFinite(hope) && hope === fear;
}

export function dualityOf(roll) {
  if (!roll) return null;
  if (rollIsCritical(roll)) return "critical";
  if (roll?.withHope === true) return "hope";
  if (roll?.withFear === true) return "fear";
  const coded = roll?.options?.roll?.result?.duality;
  if (coded === 1) return "hope";
  if (coded === -1) return "fear";
  const hope = roll?.dHope?.total, fear = roll?.dFear?.total;
  return Number.isFinite(hope) && Number.isFinite(fear) ? (hope > fear ? "hope" : "fear") : null;
}

// One outcome per target, by the system's own hit rule.
export function targetOutcomes(system, roll) {
  const crit = rollIsCritical(roll), total = Number(roll?.total);
  return list(system?.targets).filter((t) => t?.id).map((t) => {
    const toHit = t?.difficulty || t?.evasion;
    const hit = typeof t?.hitResult?.success === "boolean" ? t.hitResult.success : toHit === null || !roll ? false : crit || total >= toHit;
    return { id: t.id, actorUuid: t?.actorId ?? null, outcome: hit ? (crit ? "criticalSuccess" : "success") : "failure" };
  });
}
const RANK = { criticalSuccess: 3, success: 2, failure: 1 };
export const bestOutcome = (outcomes) => list(outcomes).reduce((best, o) => ((RANK[o?.outcome] ?? 0) > (RANK[best] ?? 0) ? o.outcome : best), null);

// An adversary's reach: a Close attack named for a natural weapon, limb, lash or long blade strikes in
// melee (a dragon's Bite and Claws, a Tail Swipe); a thrown, shot or blasted one stays ranged.
const REACH = /bite|claw|fang|teeth|tooth|jaw|maw|talon|tail|wing|tentacle|pseudo|lash|whip|vine|\barms?\b|\bhands?\b|fist|strangle|slash|sword|scythe|lance|armaments|weaponry|horn|tusk|hoo(?:f|ves)|slam|swipe|crush|rend/i;
const MISSILE_WORDS = /throw|arrow|blast|bolt|flash|flame|fire|javelin|spit|shot|breath/i;
export const strikeMode = (range, name = "") =>
  MELEE_RANGES.has(range) || (range === "close" && REACH.test(name) && !MISSILE_WORDS.test(name)) ? "melee" : "ranged";
function weaponModeOf(item, action) {
  if (item?.type === "weapon") { const range = item?.system?.attack?.range; return range ? { weaponMode: MELEE_RANGES.has(range) ? "melee" : "ranged" } : {}; }
  if (item && item?.type !== "feature") return {};
  // An adversary's standard attack (no Item) is named by its action, a feature by the feature.
  return action?.range ? { weaponMode: strikeMode(action.range, item?.name ?? action?.name ?? "") } : {};
}

// An adversary feature's action (Item type "feature"): what it looks like when it is used without an
// attack roll (a breath, an Avalanche, Rend and Crush). Shape by its area (a cone or line breathes, an
// emanation or circle bursts) or, without one, its range; element by the feature's own words, then its
// damage type. Only attacks, damage and saves play: a spotlight or a Fear gain is not a strike.
const ELEMENTS = [
  ["cold", /\b(?:ice|icy|frost|froze|freez|cold|snow|blizzard|chill|glaci|hail|avalanche|rime|sleet)/i],
  ["fire", /\b(?:fire|flam|burn|blaz|inferno|ember|magma|lava|scorch|smolder|pyre|molten|ash(?:es)?\b|heat\b)/i],
  ["lightning", /\b(?:lightning|thunder|storm|electr|shock(?!wave)|spark|static|volt)/i],
  ["acid", /\b(?:acid|corro|caustic|dissolv)/i],
  ["poison", /\b(?:poison|venom|toxi|spore|miasma|noxious|gas\b)/i],
];
const BREATH_SHAPES = new Set(["inFront", "line", "cone"]);
const plain = (html) => String(html ?? "").replace(/<[^>]*>|@\w+\[[^\]]*\]/g, " ");
// The element named first in the earliest text that names one; magical damage without one is arcane.
export function featureElement(texts, damageTypes) {
  for (const text of texts) {
    let best = null, at = Infinity;
    for (const [element, pattern] of ELEMENTS) { const m = pattern.exec(String(text ?? "")); if (m && m.index < at) [best, at] = [element, m.index]; }
    if (best) return best;
  }
  return dhDamageKind(damageTypes) === "magical" ? "arcane" : "physical";
}
export function featureFields(item, action) {
  if (item?.type !== "feature" || !action) return {};
  if (!["attack", "damage"].includes(action?.type) && !action?.save?.trait) return {};
  const area = list(action?.areas)[0]?.shape, range = action?.range || null;
  const featureShape = area ? (BREATH_SHAPES.has(area) ? "breath" : "burst") : range && !MELEE_RANGES.has(range) ? "breath" : "strike";
  return { featureShape, featureElement: featureElement([item?.name, action?.name, plain(item?.system?.description)], list(action?.damage?.main?.type)) };
}
// An action that only heals, gains a resource or applies an effect (a potion, Relentless, Momentum):
// its look by what it restores or spends. Domain cards and weapons keep their own animations.
const valuesOf = (value) => (value instanceof Map ? [...value.values()] : Object.values(value ?? {}));
export function utilityFields(item, action) {
  if (!item || !action || ["domainCard", "weapon"].includes(item.type)) return {};
  if (action.type === "healing") {
    const to = valuesOf(action.damage?.resources).map((r) => r?.applyTo);
    return { utilityLook: to.includes("fear") ? "fear" : to.includes("hope") ? "hope" : "heal" };
  }
  if (action.type !== "effect") return {};
  const spends = (Array.isArray(action.cost) ? action.cost : []).map((c) => c?.key);
  return { utilityLook: spends.includes("fear") ? "fear" : spends.includes("hope") ? "hope" : "boon" };
}
// The action's own id (its key in the item's system.actions): a card's per-action design is found by it.
const actionIdOf = (action) => action?.id || action?._id || null;
const cardFields = (item) => (item?.type === "domainCard" ? { domain: domainOf(item), cardLevel: Number(item?.system?.level) || undefined } : {});
const named = (item, name) => (item ? {} : { itemName: name, activityName: name });

export function daggerheartAttackKind(message) {
  const { item, action } = sourceOf(message);
  if (rollTypeOf(message) === "spellcast") return "spell";
  if (item?.type === "weapon") { const range = item?.system?.attack?.range; if (range) return MELEE_RANGES.has(range) ? "melee" : "ranged"; }
  else if ((!item || item?.type === "feature") && action?.range) return strikeMode(action.range, item?.name ?? action?.name ?? "");
  return "other";
}

// An attack or spellcast roll message by this user: one event, outcome per target.
export function daggerheartRollEvent(message, userId, { sceneId = null } = {}) {
  if (!DH_MESSAGE_TYPES.has(message?.type)) return null;
  if (authorOf(message) !== userId) return null;
  const rollType = rollTypeOf(message);
  if (!DH_ROLL_TYPES.has(rollType)) return null;
  const roll = rollOf(message), { item, action, actor, name } = sourceOf(message), privacy = rollPrivacy(message);
  if (hidden(privacy)) return { skipped: hiddenReason(name ?? message?.system?.title, privacy) };
  if (!name) return { skipped: `${message?.system?.title || "Daggerheart roll"}: its item or action could not be found.` };
  if (!roll) return { skipped: `${name}: its roll could not be read.` };
  const scene = message?.speaker?.scene ?? sceneId, outcomes = targetOutcomes(message?.system, roll);
  if (hidesResult(privacy)) return { type: "attack", systemId: "daggerheart", id: `chat:${message?.id}`, messageId: message?.id,
    item, itemUuid: item?.uuid, ...named(item, name), actor, tokenId: message?.speaker?.token, sceneId: scene,
    targetUuids: tokenUuids(outcomes.map((o) => o.id), scene), outcome: undefined, private: true,
    rollType, duality: null, actionId: message?.system?.source?.action || actionIdOf(action),
    ...weaponModeOf(item, action), ...cardFields(item), ...featureFields(item, action) };
  return {
    type: "attack", systemId: "daggerheart", id: `chat:${message?.id}`, messageId: message?.id,
    item, itemUuid: item?.uuid, ...named(item, name), actor,
    tokenId: message?.speaker?.token, sceneId: scene,
    targetUuids: tokenUuids(outcomes.map((o) => o.id), scene),
    ...(outcomes.length ? { targetOutcomes: Object.fromEntries(outcomes.map((o) => [o.id, o.outcome])) } : {}),
    outcome: outcomes.length ? bestOutcome(outcomes) : rollIsCritical(roll) ? "criticalSuccess" : null,
    rollType, duality: message?.type === "dualityRoll" ? dualityOf(roll) : null, actionId: message?.system?.source?.action || actionIdOf(action),
    ...weaponModeOf(item, action), ...cardFields(item), ...featureFields(item, action),
  };
}

// daggerheart.postUseAction: an action used without an attack or spellcast roll (a buff, a heal, a
// feature). A rolled one is skipped: its roll message is the event, so it never plays twice.
export function daggerheartUseEvent(action, config, { sceneId = null, tokenId = null, isGM = globalThis.game?.user?.isGM } = {}) {
  if (!action || (config?.hasRoll && DH_ROLL_TYPES.has(action?.roll?.type))) return null;
  const item = action?.item?.documentName === "Item" ? action.item : null;
  const actor = action?.actor ?? item?.actor ?? null, name = item?.name ?? action?.name ?? null;
  // The hook runs on the user's own client: a GM's private action still plays.
  const privacy = modePrivacy(config?.selectedMessageMode, isGM);
  if (hidden(privacy)) return { skipped: hiddenReason(name ?? "Daggerheart action", privacy) };
  if (!name) return { skipped: "Daggerheart action: its item could not be found." };
  const ids = list(config?.targets).map((t) => t?.id).filter(Boolean);
  return {
    type: "use", systemId: "daggerheart", ...(config?.message?.id ? { id: `use:${config.message.id}` } : {}),
    item, itemUuid: item?.uuid, ...named(item, name), actor, sceneId,
    tokenId: tokenId ?? config?.message?.speaker?.token ?? config?.speaker?.token,
    targetUuids: tokenUuids(ids, sceneId), outcome: null, rollType: action?.roll?.type ?? null, duality: null, actionId: actionIdOf(action),
    ...weaponModeOf(item, action), ...cardFields(item), ...featureFields(item, action), ...utilityFields(item, action),
  };
}

// system.damage.main: a DamageRoll on a live message, its JSON in raw source data.
function damageMain(system) {
  const main = system?.damage?.main;
  if (typeof main !== "string") return main ?? null;
  try { return JSON.parse(main); } catch { return null; }
}
function damageKindOf(message) {
  const main = damageMain(message?.system), { item, action } = sourceOf(message);
  if (!main) return null;
  const rolled = list(main?.options?.damageTypes);
  if (rolled.length) return dhDamageKind(rolled);
  // action.damage.main.type is a SetField: a Set.
  return dhDamageKind(action?.damage?.main?.type) ?? dhDamageKind(item?.system?.attack?.damage?.main?.type);
}
function damageCrit(message) {
  const flag = damageMain(message?.system)?.options?.isCritical;
  return flag === true || (flag !== false && rollIsCritical(rollOf(message)));
}
// The targets the damage reached: the hit ones when the card rolled, all of them for direct damage.
function damagedTargets(message) {
  const all = targetOutcomes(message?.system, rollOf(message));
  return { all, hit: message?.system?.hasRoll ? all.filter((o) => o.outcome !== "failure") : all };
}

// The damage-log entry damageFromMessage answers for a Daggerheart message (see damage-moments.mjs).
export function daggerheartDamage(message) {
  const system = message?.system;
  if (!damageMain(system) || system?.hasHealing) return null;
  const kind = damageKindOf(message), { item, action, actor, name } = sourceOf(message), { hit } = damagedTargets(message);
  return {
    type: daggerheartDamageType({ type: kind, item, itemName: name }), dhType: kind,
    tokenIds: new Set(hit.map((o) => o.id)), actorIds: new Set(hit.map((o) => actorIdOf(o.actorUuid)).filter(Boolean)),
    sourceTokenId: message?.speaker?.token ?? null, attackKind: daggerheartAttackKind(message), crit: damageCrit(message),
    itemUuid: item?.uuid ?? null, itemName: name, itemSlug: null,
    actorUuid: system?.source?.actor ?? actor?.uuid ?? null, synthetic: !item && Boolean(name),
    itemKind: item?.type ?? (action ? "action" : null), domain: domainOf(item), weaponFamily: weaponFamily(item?.name ?? name, kind ? [kind] : []),
  };
}

// A damage (or healing) roll by this user: created with its own message, or written onto the
// attack/spellcast card it was rolled from.
export function daggerheartDamageEvent(message, userId, { sceneId = null } = {}) {
  const system = message?.system;
  if (!damageMain(system) && !Object.keys(system?.damage?.resources ?? {}).length) return null;
  if (authorOf(message) !== userId) return null;
  const { item, action, actor, name } = sourceOf(message), privacy = rollPrivacy(message);
  if (hidden(privacy)) return { skipped: hiddenReason(name ?? system?.title, privacy) };
  // Resource-only damage (stress, fear...) has no hit-point type: nothing to play.
  if (!system?.hasHealing && !damageKindOf(message)) return null;
  if (!name) return { skipped: `${system?.title || "Daggerheart damage"}: its item or action could not be found.` };
  // A feature's, potion's or other non-weapon item's damage card: its use or attack roll already played.
  if (item && !["weapon", "domainCard"].includes(item.type)) return null;
  const { all, hit } = damagedTargets(message);
  if (all.length && !hit.length) return null;
  const scene = message?.speaker?.scene ?? sceneId;
  return {
    type: "damage", systemId: "daggerheart", id: `damage:${message?.id}`, messageId: message?.id,
    item, itemUuid: item?.uuid, ...named(item, name), actor,
    tokenId: message?.speaker?.token, sceneId: scene, targetUuids: tokenUuids(hit.map((o) => o.id), scene),
    damageType: damageKindOf(message), healing: Boolean(system?.hasHealing), crit: hidesResult(privacy) ? false : damageCrit(message),
    ...weaponModeOf(item, action), ...cardFields(item),
  };
}

// Hope / Fear accent (world setting daggerheartDualityAccent): a ~600 ms glint or wisp on the roller's
// token, played beside the item's own animation. A critical gets none: its crit visuals and finisher
// already show it. Patreon keys first, then keys JB2A Free has.
export const HOPE_ASSETS = Object.freeze(["jb2a.particle_burst.01.star.yellow", "jb2a.twinkling_stars.points07.orange"]);
export const FEAR_ASSETS = Object.freeze(["jb2a.energy_strands.overlay.dark_purple.01", "jb2a.smoke.puff.centered.dark_purple", "jb2a.particle_burst.01.circle.bluepurple"]);
export function dualityAccentRecipe(duality) {
  const hope = duality === "hope";
  if (!hope && duality !== "fear") return null;
  return { id: `animater-dh-${duality}`, name: hope ? "Hope" : "Fear", trigger: "manual", color: hope ? "#f5c84c" : "#5b2a86",
    stages: [{ stageId: duality, kind: "cast", assets: [...(hope ? HOPE_ASSETS : FEAR_ASSETS)], duration: 600, scale: 0.8, opacity: 0.9 }] };
}
// The accent for this user's public duality roll with Hope or Fear, and the token it plays on.
export function dualityAccent(message, userId) {
  if (message?.type !== "dualityRoll" || authorOf(message) !== userId || isPrivate(message)) return null;
  const recipe = dualityAccentRecipe(dualityOf(rollOf(message)));
  return recipe && message?.speaker?.token ? { recipe, tokenId: message.speaker.token, sceneId: message?.speaker?.scene ?? null } : null;
}
