// Draw Steel adapter (the MCDM `draw-steel` system): pure functions that turn its ability messages
// into Animater events and damage-log entries. Shapes verified against draw-steel 1.1.2
// (draw-steel.mjs): AbilityModel#use creates one "standard" ChatMessage whose system.parts hold an
// "abilityUse" part (abilityUuid) and, when the ability has a power roll, one "abilityResult" part per
// tier rolled ({ tier, abilityUuid, rolls }). Each target gets its own PowerRoll (options.target: the
// target actor's uuid) in the part of the tier it rolled, followed by the tier's DamageRolls
// (options.type: the damage type, "" untyped; options.aoe). Damage is applied later by a button
// (DamageRoll#applyDamage → stamina), so the message itself is the only event.
// Every read is optional-chained: a shape that moves in a later version skips the event
// ({ skipped } for the caller to trace) and never throws.
import { rollPrivacy, hidden, hiddenReason, hidesResult } from "../core/privacy.mjs";
export const DRAW_STEEL_VERIFIED = "1.1.2";
// CONFIG damage types (ds.CONFIG.damageTypes, "value" is untyped) and conditions (ds.CONFIG.conditions).
export const DS_DAMAGE_TYPES = Object.freeze(["acid", "cold", "corruption", "fire", "holy", "lightning", "poison", "psychic", "sonic"]);
export const DS_CONDITIONS = Object.freeze(["bleeding", "dazed", "frightened", "grabbed", "prone", "restrained", "slowed", "surprised", "taunted", "weakened"]);

export function versionBelow(version, floor = DRAW_STEEL_VERIFIED) {
  const parts = (v) => String(v ?? "").split(".").map((n) => Number.parseInt(n, 10) || 0);
  const a = parts(version), b = parts(floor);
  for (let i = 0; i < Math.max(a.length, b.length); i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) < (b[i] ?? 0);
  return false;
}

// Sets, arrays, Maps, Foundry Collections (system.parts, power.effects) and plain source objects alike.
const list = (value) => (Array.isArray(value) ? value : value instanceof Set ? [...value] : []);
const valuesOf = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value.values === "function" && !(value.constructor === Object)) return [...value.values()];
  return Object.values(value);
};
const authorOf = (message) => message?.author?.id ?? message?.user?.id;
// A part's rolls are Roll instances on a live message, their JSON strings in source data.
const parse = (roll) => { if (typeof roll !== "string") return roll; try { return JSON.parse(roll); } catch { return null; } };
const rollClass = (roll) => (roll?.constructor && roll.constructor !== Object ? roll.constructor.name : roll?.class ?? "");
const isPowerRoll = (roll) => /PowerRoll/.test(rollClass(roll)) || ["ability", "test"].includes(roll?.options?.type) && !/DamageRoll/.test(rollClass(roll));
const isDamageRoll = (roll) => /DamageRoll/.test(rollClass(roll));
const partsOf = (message) => valuesOf(message?.system?.parts).filter(Boolean);
const rollsOf = (part) => valuesOf(part?.rolls).map(parse).filter(Boolean);
const useParts = (message) => partsOf(message).filter((p) => p?.type === "abilityUse");
const resultParts = (message) => partsOf(message).filter((p) => p?.type === "abilityResult");
const tokenIdOf = (uuid) => String(uuid ?? "").match(/Token\.([^.]+)/)?.[1] ?? null;
const actorIdOf = (uuid) => String(uuid ?? "").match(/Actor\.([^.]+)/)?.[1] ?? null;
const tokenUuids = (ids, sceneId) => (sceneId ? ids.map((id) => `Scene.${sceneId}.Token.${id}`) : []);
// Defaults for a live world: the ability by uuid, and a linked actor's token on the canvas (the one
// this user targets first).
const liveResolve = (uuid) => globalThis.fromUuidSync?.(uuid) ?? null;
export function canvasTokenFor(actorUuid) {
  const tokens = [...Array.from(globalThis.game?.user?.targets ?? []), ...(globalThis.canvas?.tokens?.placeables ?? [])];
  return tokens.find((t) => t?.actor?.uuid === actorUuid)?.id ?? null;
}

// The natural 2d10 of a power roll: its first die's total, live or in JSON.
function naturalOf(roll) {
  const live = roll?.dice?.[0]?.total;
  if (Number.isFinite(live)) return live;
  const term = list(roll?.terms).find((t) => Array.isArray(t?.results));
  if (!term) return null;
  return term.results.filter((r) => r?.active !== false && !r?.discarded).reduce((sum, r) => sum + (Number(r?.result) || 0), 0);
}
// PowerRoll#isCritical: the natural result at or above the critical threshold (19 by default).
export function powerRollCritical(roll) {
  if (!roll) return false;
  if (typeof roll.isCritical === "boolean") return roll.isCritical;
  const natural = naturalOf(roll), threshold = Number(roll?.options?.criticalThreshold) || 19;
  return Number.isFinite(natural) && natural >= threshold;
}
// Every hit lands in Draw Steel: tier 1 is the weakest result, not a miss. A critical is the
// criticalSuccess outcome, every other tier a success.
const outcomeOf = (crit) => (crit ? "criticalSuccess" : "success");

// The ability behind a message: the part's own getter on a live message, else the uuid resolved by
// the caller (main.mjs passes fromUuidSync).
function abilityOf(message, resolve) {
  const part = useParts(message)[0] ?? resultParts(message)[0];
  if (!part) return { part: null, ability: null };
  const ability = part.ability ?? (part.abilityUuid && typeof resolve === "function" ? resolve(part.abilityUuid) : null);
  return { part, ability: ability ?? null };
}

// One target per PowerRoll that names one: { id: token id, actorUuid, tier, crit }. A linked actor's
// uuid has no token: `tokenFor` (main.mjs, from the canvas) finds it.
export function targetResults(message, { tokenFor = canvasTokenFor } = {}) {
  const out = [], seen = new Set();
  for (const part of resultParts(message)) {
    const tier = Number(part?.tier) || null;
    for (const roll of rollsOf(part).filter(isPowerRoll)) {
      const actorUuid = roll?.options?.target ?? null;
      if (!actorUuid) continue;
      const id = tokenIdOf(actorUuid) ?? (typeof tokenFor === "function" ? tokenFor(actorUuid) : null);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push({ id, actorUuid, tier, crit: powerRollCritical(roll) });
    }
  }
  return out;
}
// The roll without a target (no one targeted): its tier and critical.
function untargeted(message) {
  for (const part of resultParts(message)) {
    const roll = rollsOf(part).find((r) => isPowerRoll(r) && !r?.options?.target);
    if (roll) return { tier: Number(part?.tier) || null, crit: powerRollCritical(roll) };
  }
  const base = list(message?.rolls).map(parse).find(isPowerRoll);
  return base ? { tier: null, crit: powerRollCritical(base) } : null;
}

// Words that make an ability without damage a heal: its name, story and effect texts.
const HEAL_WORDS = /\b(?:heal|mend|regains?\b|recover|restor)/i;
const effectTexts = (system) => [...valuesOf(system?.effects).map((e) => e?.description),
  ...valuesOf(system?.power?.effects).flatMap((e) => ["tier1", "tier2", "tier3"].map((t) => e?.[e?.type]?.[t]?.display))].filter(Boolean).map(String);
// What an ability's own words say it does (its effect texts and tier displays), in the order its text
// first says it: each verb is a look the design module knows (draw-steel-design.mjs VERB_LOOKS).
// Enricher links ([[/heal 10 temp]], [[/apply invisible]], @UUID[...]{label}) read as their words.
export const ABILITY_VERBS = Object.freeze([
  ["teleport", /\bteleport|removed from the encounter map/], ["swap", /\b(?:swap|switch) (?:places|their location|location)/], ["portal", /\bportals?\b/],
  ["invisible", /\binvisible\b|illusion of your corpse/], ["conceal", /\bconcealment\b|black cloud|\bhide maneuver\b|\buse the hide\b/],
  ["illusion", /\billusion|\bduplicates?\b|appear as\b|you gain the target/], ["shapeshift", /\bshapeshift|animal form|hybrid form|true form/],
  ["phase", /move through solid matter|\bintangible|\bethereal/], ["telekinesis", /with your mind|\btelekinetic|vertical slide/],
  ["grow", /\bsize (?:and stability )?increases?|becoming size|\bgrow\b/], ["fly", /\bcan fly\b|\bapply fly\b|\bfly\b|\blevitat/],
  ["jump", /\bjump/], ["burrow", /\bburrow|into, out of, or through ground/],
  ["temp", /temporary stamina|\bheal [^\]]*\btemp/], ["heal", /regains? stamina|\bspend (?:a|one|any number of|one or more|up to \d) recover|recovery value/],
  ["immunity", /\bimmunity\b/], ["stability", /\bstability\b/], ["stand", /\bstand up\b/], ["escape", /\bescape the grab|no longer grabbed/],
  ["judge", /\bjudged?\b|\bjudgment\b/], ["mark", /\bmarked by you|\bmark (?:two|a|one|the)\b|\bis marked\b/],
  ["taunt", /\btaunted\b/], ["fear", /\bfrightened\b/], ["bane", /(?<!you take a )\bbanes?\b|\bis negated\b/], ["edge", /\bedges?\b/],
  ["retaliate", /source of the damage|deal half the damage|whenever an enemy damages you|each enemy within \d+ squares of them takes/],
  ["empower", /\bdeals? extra\b|\bextra (?:\w+ )?damage|bonus to rolled damage|taking an extra/],
  ["surge", /\bsurges?\b/], ["resource", /\bgain \d+ heroic|heroic resource|\bclarity\b/],
  ["rally", /(?:can|to) make a (?:melee )?free strike(?! against you)|take their turns?\b|additional main action|\bcan use a maneuver/],
  ["speed", /bonus to speed|\bshift(?:s)? up to|\bmove(?:s)? up to (?:their|your) speed|\bcan move up to|\bdisengage/],
  ["field", /\bnull field\b|\bthe area\b|\baura\b|can approach within/], ["object", /\bstatue\b|\bholes?\b|\bwall\b|\bshield (?:that )?protects|\bconjure an?\b/],
  ["potion", /\bpotion|\bvial\b/], ["telepathy", /\btelepathic\b/], ["sense", /\bvision\b|\brevealed\b|director tells you|\bsenses?\b/],
  ["time", /\btake their turn(?:s)? immediately|\bnext turn in any order|\bgrow visibly younger/],
]);
export function abilityVerbs(text) {
  const t = String(text ?? "").toLowerCase().replace(/<[^>]*>/g, " ").replace(/@\w+\[[^\]]*\]\{([^}]*)\}/g, "$1").replace(/\[\[\/(\w+) ([^\]]*)\]\](?:\{([^}]*)\})?/g, (m, verb, args, label) => ` ${verb} ${args} ${label ?? ""} `);
  return ABILITY_VERBS.map(([verb, pattern]) => [verb, t.search(pattern)]).filter(([, at]) => at >= 0).sort((a, b) => a[1] - b[1]).map(([verb]) => verb);
}
// The facts an ability's look is built from, from a live Item (system data) or a catalog row
// (tools/build-draw-steel.mjs writes the same fields).
export function abilityRow(item) {
  const system = item?.system ?? {};
  const effects = valuesOf(system?.power?.effects);
  const tiers = (effect) => ["tier1", "tier2", "tier3"].map((t) => effect?.damage?.[t]).filter(Boolean);
  const damageTypes = [...new Set(effects.filter((e) => e?.type === "damage").flatMap((e) => tiers(e).flatMap((t) => list(t?.types).length ? list(t.types) : valuesOf(t?.types))).map(String).filter(Boolean))];
  const damages = effects.some((e) => e?.type === "damage" && tiers(e).some((t) => String(t?.value ?? "") && String(t?.value) !== "0"));
  const conditions = [...new Set(effects.filter((e) => e?.type === "applied").flatMap((e) => ["tier1", "tier2", "tier3"].flatMap((t) => Object.keys(e?.applied?.[t]?.effects ?? {}))))];
  const rolled = typeof system?.power?.roll?.enabled === "boolean" ? system.power.roll.enabled : !system?.power?.roll?.reactive && effects.length > 0;
  return {
    name: item?.name ?? "", keywords: list(system?.keywords).length ? list(system.keywords).map(String) : valuesOf(system?.keywords).map(String),
    type: system?.type ?? null, category: system?.category ?? "", distance: system?.distance?.type ?? null, target: system?.target?.type ?? null,
    damageTypes, damages, conditions, rolled, heals: HEAL_WORDS.test([item?.name, system?.story, ...effectTexts(system)].join(" ")),
    forced: forcedOf(effects), resource: Number(system?.resource) || null,
    verbs: abilityVerbs(effectTexts(system).join(" ")),
  };
}
// Forced movement (a "forced" power roll effect): the first of push, pull or slide it names and its
// furthest distance, or null. Only the look uses it: the creature itself is moved by the table.
const FORCED = ["push", "pull", "slide"];
function forcedOf(effects) {
  let kind = null, squares = 0;
  for (const e of effects.filter((e) => e?.type === "forced")) for (const t of ["tier1", "tier2", "tier3"]) {
    const tier = e?.forced?.[t], moves = (list(tier?.movement).length ? list(tier.movement) : valuesOf(tier?.movement)).map(String);
    kind ??= FORCED.find((m) => moves.includes(m)) ?? null;
    const n = Number.parseInt(String(tier?.distance ?? ""), 10);
    if (Number.isFinite(n)) squares = Math.max(squares, n);
  }
  return kind ? { kind, squares: squares || 1 } : null;
}

// Element: the damage it deals first, then the keyword that names its power, then how it strikes.
const KEYWORD_ELEMENTS = [
  ["fire", ["fire", "pyrokinesis"]], ["cold", ["cryokinesis"]], ["earth", ["earth"]], ["void", ["void"]], ["nature", ["green", "animal", "rot", "metamorphosis"]],
  ["time", ["chronopathy"]], ["force", ["telekinesis"]], ["psychic", ["telepathy", "animapathy"]], ["sonic", ["resopathy", "performance"]],
];
export const DS_ELEMENTS = Object.freeze(["fire", "cold", "lightning", "acid", "poison", "corruption", "holy", "psychic", "sonic", "earth", "void", "nature", "time", "force", "arcane", "physical"]);
export function abilityElement(row) {
  const types = list(row?.damageTypes).filter((t) => DS_DAMAGE_TYPES.includes(t));
  if (types.length) return types[0];
  const keywords = new Set(list(row?.keywords));
  for (const [element, words] of KEYWORD_ELEMENTS) if (words.some((w) => keywords.has(w))) return element;
  if (keywords.has("weapon")) return "physical";
  if (keywords.has("psionic")) return "psychic";
  if (keywords.has("magic")) return "arcane";
  return "physical";
}
// Shape by its distance: a strike flies or swings to each target, a burst or aura erupts around the
// user, a cube or wall lands where it is placed, a line breathes. Self and special abilities with no
// damage are a utility (a boon, or a heal by its words).
const ALLY_TARGETS = new Set(["self", "ally", "selfOrAlly", "selfAlly"]);
export function abilityLook(row) {
  const distance = row?.distance ?? null, keywords = new Set(list(row?.keywords));
  const damages = Boolean(row?.damages) || list(row?.damageTypes).length > 0;
  const shape = ["burst", "aura"].includes(distance) ? "burst" : ["cube", "wall"].includes(distance) ? "area" : distance === "line" ? "line"
    : ["melee", "ranged", "meleeRanged"].includes(distance) ? "strike" : null;
  if (!damages && (ALLY_TARGETS.has(row?.target) || !shape)) {
    return { shape: "self", element: abilityElement(row), utility: row?.heals ? "heal" : "boon" };
  }
  const mode = distance === "ranged" || (distance !== "melee" && distance !== "meleeRanged" && keywords.has("ranged") && !keywords.has("melee")) ? "ranged" : "melee";
  return { shape: shape ?? "strike", element: abilityElement(row), mode, weapon: keywords.has("weapon") && (shape ?? "strike") === "strike" };
}
// How the blow was struck, for the damage log and finishers.
export function drawSteelAttackKind(row) {
  const look = abilityLook(row), keywords = new Set(list(row?.keywords));
  if (look.shape === "strike" && look.weapon) return look.mode;
  if (keywords.has("magic") || keywords.has("psionic")) return "spell";
  return look.shape === "strike" ? look.mode : "other";
}

// The damage types of the message's rolls (the tier that rolled), the largest first.
function rolledDamage(message) {
  const parts = resultParts(message).flatMap((p) => rollsOf(p).filter(isDamageRoll)).filter((r) => !r?.options?.isHeal);
  return parts.map((r) => ({ type: String(r?.options?.type ?? ""), total: Number(r?.total ?? r?._total) || 0, aoe: Boolean(r?.options?.aoe) })).sort((a, b) => b.total - a.total);
}
// Draw Steel names onto Animater's damage looks (damage-moments.mjs ALIASES folds holy, psychic and
// lightning); corruption withers as void. Untyped damage: a weapon by how it struck, else a blow.
const DAMAGE_NAMES = { corruption: "void" };
export function drawSteelDamageType(type, attackKind = "other") {
  const t = String(type ?? "").toLowerCase();
  if (t && t !== "value") return DAMAGE_NAMES[t] ?? t;
  return attackKind === "ranged" ? "piercing" : attackKind === "melee" ? "slashing" : "bludgeoning";
}

// The damage-log entry damageFromMessage answers for a Draw Steel ability message (damage-moments.mjs).
export function drawSteelDamage(message, { resolve = liveResolve, tokenFor = canvasTokenFor } = {}) {
  const rolled = rolledDamage(message);
  if (!rolled.length) return null;
  const { ability } = abilityOf(message, resolve), row = abilityRow(ability), attackKind = drawSteelAttackKind(row);
  const targets = targetResults(message, { tokenFor });
  const types = [...new Set(rolled.map((r) => drawSteelDamageType(r.type, attackKind)))];
  return {
    type: types[0], types, dsType: rolled[0].type || null,
    tokenIds: new Set(targets.map((t) => t.id)), actorIds: new Set(targets.map((t) => actorIdOf(t.actorUuid)).filter(Boolean)),
    sourceTokenId: message?.speaker?.token ?? null, attackKind, crit: targets.some((t) => t.crit) || Boolean(untargeted(message)?.crit),
    itemUuid: ability?.uuid ?? null, itemName: ability?.name ?? null, itemSlug: ability?.system?._dsid ?? null,
    actorUuid: ability?.actor?.uuid ?? null, synthetic: false, itemKind: ability?.type ?? null,
  };
}

// An ability used by this user: one event, rolled ("attack", outcome per target) or not ("use").
// `targets`: the user's targeted token ids, for an ability without a power roll.
export function drawSteelAbilityEvent(message, userId, { sceneId = null, resolve = liveResolve, tokenFor = canvasTokenFor, targets = [] } = {}) {
  if (!useParts(message).length && !resultParts(message).length) return null;
  if (authorOf(message) !== userId) return null;
  const { part, ability } = abilityOf(message, resolve), privacy = rollPrivacy(message);
  const name = ability?.name ?? message?.title ?? message?.content ?? null;
  if (hidden(privacy)) return { skipped: hiddenReason(name ?? "Draw Steel ability", privacy) };
  if (!ability) return { skipped: `${name || "Draw Steel ability"}: its ability could not be found${part?.abilityUuid ? ` (${part.abilityUuid})` : ""}.` };
  const row = abilityRow(ability), look = abilityLook(row), scene = message?.speaker?.scene ?? sceneId;
  const results = targetResults(message, { tokenFor }), lone = results.length ? null : untargeted(message);
  const rolled = resultParts(message).length > 0;
  const ids = results.length ? results.map((t) => t.id) : list(targets).filter(Boolean);
  const base = {
    type: rolled ? "attack" : "use", systemId: "draw-steel", id: `chat:${message?.id}`, messageId: message?.id,
    item: ability, itemUuid: ability?.uuid, actor: ability?.actor ?? message?.speakerActor ?? null,
    tokenId: message?.speaker?.token, sceneId: scene, targetUuids: tokenUuids(ids, scene),
    dsShape: look.shape, dsElement: look.element, ...(look.utility ? { utilityLook: look.utility } : {}),
    ...(look.mode ? { weaponMode: look.mode } : {}), keywords: row.keywords,
    ...(row.forced ? { dsForced: row.forced } : {}), ...(row.conditions.length ? { dsConditions: row.conditions } : {}), ...(row.verbs.length ? { dsVerbs: row.verbs } : {}),
  };
  if (!rolled) return { ...base, outcome: null };
  if (hidesResult(privacy)) return { ...base, outcome: undefined, private: true };
  const crit = results.length ? results.some((t) => t.crit) : Boolean(lone?.crit);
  const tier = results.length ? Math.max(...results.map((t) => t.tier ?? 0)) || null : lone?.tier ?? null;
  return {
    ...base,
    ...(results.length ? { targetOutcomes: Object.fromEntries(results.map((t) => [t.id, outcomeOf(t.crit)])), targetTiers: Object.fromEntries(results.map((t) => [t.id, t.tier])) } : {}),
    outcome: outcomeOf(crit), tier, crit,
  };
}
