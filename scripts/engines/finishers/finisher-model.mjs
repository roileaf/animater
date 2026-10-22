import { rollPrivacy, hidden } from "../../core/privacy.mjs";
import { rerollChangesNothing } from "../../systems/reroll.mjs";
// Which finishers an item plays, and the link between a catalog entry and a finisher.
// Applies-to reuses recipe matching: comma-separated names in `match`, or one exact itemUuid.
import { normalize, FINISHER_ON, FINISHER_ENDINGS } from "../../core/model.mjs";
import { pathSquares, landsTilted } from "../motion/keyframe-path.mjs";
import { BY_DAMAGE_TYPE, damageTypeFinisher, FINISHER_PRESETS, presetFinisher } from "./finisher-presets.mjs";

const names = (r) => String(r.match ?? "").split(",").map((n) => n.trim()).filter(Boolean);
const live = (recipes) => recipes.filter((r) => r?.finisher && r.enabled !== false);

export function matchFinishers(recipes, { itemName, itemSlug, itemUuid } = {}, on) {
  const wanted = new Set([itemName, itemSlug].filter(Boolean).map(normalize));
  return live(recipes).filter((r) => r.finisher.on === on &&
    ((r.itemUuid && itemUuid && r.itemUuid === itemUuid) || names(r).some((n) => wanted.has(normalize(n)))));
}

// The item's finishers that play on any of `ons`, in catalog order.
const matchAny = (recipes, item, ons) => live(recipes).filter((r) => ons.includes(r.finisher.on) && matchFinishers([r], item, r.finisher.on).length);

// The killing item's own kill (or crit-or-kill) finisher wins; otherwise the GM's default, if it
// is a finisher. "Needs: Only on a critical" holds for both: without a crit they are passed over.
// The default "by-damage-type" plays the built-in preset for the killing blow's damage type.
// `defaultEnding` (a FINISHER_ENDINGS key) overrides how the default finisher ends, e.g. "body" so
// it leaves the token Defeated instead of hiding it; the item's own finishers keep their ending.
export function killFinisher(recipes, item = {}, defaultId = "", { crit = false, damageType = null, defaultEnding = "" } = {}) {
  const fits = (r) => passesSuccess(r.finisher, crit ? "criticalSuccess" : "success");
  const own = matchAny(recipes, item, ["kill", "criticalOrKill"]).find(fits);
  if (own) return own;
  // "preset:<id>": a built-in preset used as the default as it is, without copying it first.
  const preset = String(defaultId).startsWith("preset:") ? String(defaultId).slice(7) : null;
  const fallback = defaultId === BY_DAMAGE_TYPE ? damageTypeFinisher(damageType)
    : preset ? (Object.hasOwn(FINISHER_PRESETS, preset) ? presetFinisher(preset, `builtin-${preset}`) : null)
    : live(recipes).find((r) => r.id === defaultId);
  if (!fallback || !fits(fallback)) return null;
  return Object.hasOwn(FINISHER_ENDINGS, defaultEnding) && fallback.finisher.ending !== defaultEnding
    // A finisher made to vanish that now keeps its body shows the body again once its pieces fade.
    ? { ...fallback, finisher: { ...fallback.finisher, ending: defaultEnding, revealsBody: fallback.finisher.ending === "vanish" } } : fallback;
}

// The GM's finishers that a critical hit with this item plays (when no player pick plays instead).
export const critFinishers = (recipes, item = {}) => matchAny(recipes, item, ["critical", "criticalOrKill"]);

// A hidden result (a GM's private roll, a D&D target without an AC) is as unknown as none.
const unknown = (outcome) => outcome === undefined || outcome === null || outcome === "hidden";

export function passesSuccess(finisher, outcome) {
  if (unknown(outcome)) return true;
  // Needs is hidden for the critical modes: a value stored before a switch must not gate them.
  if (["critical", "criticalOrKill"].includes(finisher.on)) return true;
  return finisher.success === "critical" ? outcome === "criticalSuccess" : ["success", "criticalSuccess"].includes(outcome);
}

// A roll whose outcome is unknown (D&D with several targets or a hidden AC) may be a miss:
// skip it. Only a use without any roll passes without an outcome.
export function usePasses(finisher, event) {
  const moment = finisherMoment(event);
  if (!moment || (moment === "roll" && unknown(event.outcome))) return false;
  return passesSuccess(finisher, event.outcome);
}

// A use finisher rides the roll that has a degree of success when the item has one,
// else the use itself (a buff, a save spell). Damage rolls never carry it.
export function finisherMoment(event) {
  if (["attack", "check"].includes(event?.type)) return "roll";
  if (event?.type !== "use") return null;
  const traits = event.item?.system?.traits?.value ?? [];
  const rolls = ["weapon", "melee"].includes(event.item?.type) || traits.includes("attack") || event.activity?.type === "attack";
  return rolls ? null : "use";
}

// PF2e/SF2e actions such as Shove roll a skill check that names the action (action:shove);
// normal dispatch ignores skill checks, so finishers read them here.
export function checkFinisherEvent(message, systemId, userId) {
  const context = message?.flags?.[systemId]?.context;
  if ((message?.author?.id ?? message?.user?.id) !== userId || context?.type !== "skill-check") return null;
  // Hidden rolls, and rerolls that kept the old roll, stay quiet, as normal dispatch does (twoeEvent); a GM's
  // private one plays without its outcome, so no crit finisher gives it away.
  const privacy = rollPrivacy(message);
  if (hidden(privacy) || rerollChangesNothing(message, systemId)) return null;
  const action = (context.options ?? []).map(String).find((o) => o.startsWith("action:"))?.slice(7);
  if (!action) return null;
  return { type: "check", systemId, id: `finisher-check:${message.id}`, messageId: message.id, itemName: action, tokenId: message.speaker?.token, sceneId: message.speaker?.scene, targetUuid: context.target?.token, outcome: privacy === "gm" ? undefined : context.outcome };
}

// PF2e/SF2e: a creature's saving throw against a spell or effect. The saver (the speaker, also
// context.target) is the one struck; the caster is context.origin.token, a token uuid. The spell is
// flags.<system>.origin.uuid, which carries the caster's finisher pick. Without a resolvable caster
// token there is no tokenId (the item's actor may stand in); a save against itself has no attacker
// (noSource). Only a critically failed save can start a finisher, so the others are not events.
export function saveFinisherEvent(message, systemId, userId) {
  const flags = message?.flags?.[systemId], context = flags?.context, speaker = message?.speaker ?? {};
  if ((message?.author?.id ?? message?.user?.id) !== userId || context?.type !== "saving-throw" || context.outcome !== "criticalFailure") return null;
  if (message.blind || message.whisper?.length || rerollChangesNothing(message, systemId) || !flags.origin?.uuid) return null;
  const saver = context.target?.token ?? (speaker.scene && speaker.token ? `Scene.${speaker.scene}.Token.${speaker.token}` : null);
  if (!saver) return null;
  const self = context.origin?.token === saver;
  const caster = context.origin?.token && !self ? /Token.([^.]+)$/.exec(context.origin.token)?.[1] : undefined;
  return { type: "save", systemId, id: `finisher-save:${message.id}`, messageId: message.id, itemUuid: flags.origin.uuid, tokenId: caster, sceneId: speaker.scene, targetUuid: saver, outcome: context.outcome, ...(self ? { noSource: true } : {}) };
}

// The targets a use critically struck, which its crit finisher plays on: every target of a
// critical attack roll or check, or the saver whose own saving throw against it critically failed.
// A critically successful save never counts. An area spell rolls one save per creature.
export function critTargets(event) {
  const targets = (event?.targets ?? []).filter(Boolean);
  if (event?.type === "save") return event.outcome === "criticalFailure" ? targets : [];
  if (!["attack", "check"].includes(event?.type)) return [];
  // A roll judged per target (Daggerheart: against each target's own Difficulty or Evasion).
  if (event.targetOutcomes) return targets.filter((t) => event.targetOutcomes[t.id] === "criticalSuccess");
  return event.outcome === "criticalSuccess" ? targets : [];
}

// With per-target outcomes, a use finisher plays only on the targets the roll struck.
export const targetPassed = (event, token) => !event?.targetOutcomes || ["success", "criticalSuccess"].includes(event.targetOutcomes[token?.id]);

// The catalog dropdown: the entry belongs to at most one finisher. A given uuid is remembered
// on that finisher for its Applies-to card; the finishers that lose the name forget its link.
export function linkFinisher(recipes, entryName, finisherId, uuid) {
  const key = normalize(entryName);
  return recipes.map((r) => {
    if (!r?.finisher) return r;
    const kept = names(r).filter((n) => normalize(n) !== key);
    const target = r.id === finisherId;
    if (target) kept.push(String(entryName).trim());
    const match = kept.join(", ");
    const finisher = target && uuid ? linkFinisherItem(r.finisher, entryName, uuid) : target ? r.finisher : unlinkFinisherItem(r.finisher, entryName);
    if (match === String(r.match ?? "") && finisher === r.finisher) return r;
    return { ...r, match, finisher };
  });
}

// The item a name in Applies to was dropped from (display and opening only).
export const finisherItemLink = (finisher, name) => finisher?.links?.[normalize(name)] ?? null;
export function linkFinisherItem(finisher, name, uuid) {
  const key = normalize(name);
  if (!key || !uuid || finisher?.links?.[key] === uuid) return finisher;
  return { ...finisher, links: { ...finisher?.links, [key]: String(uuid) } };
}
export function unlinkFinisherItem(finisher, name) {
  const key = normalize(name);
  if (!finisher?.links || !Object.hasOwn(finisher.links, key)) return finisher;
  const { [key]: _gone, ...links } = finisher.links;
  return { ...finisher, links };
}

// The Applies-to chips: the names in `match`, and adding or removing one case-insensitively, kept as "A, B".
export const finisherNames = (match) => names({ match });
export function addFinisherName(match, name) {
  const list = names({ match }), add = String(name ?? "").trim();
  if (add && !list.some((n) => normalize(n) === normalize(add))) list.push(add);
  return list.join(", ");
}
export const removeFinisherName = (match, name) => names({ match }).filter((n) => normalize(n) !== normalize(String(name ?? "").trim())).join(", ");

export const linkedFinisher = (recipes, entryName) =>
  live(recipes).find((r) => names(r).some((n) => normalize(n) === normalize(entryName))) ?? null;

// The active GM writes a finisher's move for a player who controls the moved token or the
// token that struck it (a fighter flinging an enemy they do not own).
export const mayDisplace = ({ ownsToken, ownsAttacker }) => Boolean(ownsToken || ownsAttacker);

// The target's held keyframed path (a finisher moves only its targets): its drawn length is the knockback.
export const finisherTravelPath = (recipe) => recipe?.stages?.find((s) => s.kind === "motion" && s.motion === "path" && s.motionEnd === "hold"
  && s.subject === "targets") ?? null;

const ENDING_SHORT = { vanish: "Vanish", body: "Body", stay: "Stay" };
// What the studio chip says about a finisher: when it plays, where it lands, how it ends.
export function finisherChipText(recipe) {
  const f = recipe.finisher, path = finisherTravelPath(recipe), squares = path ? pathSquares(path.keyframes) : f.knockback;
  return `${FINISHER_ON[f.on]} · ${squares ? `lands ${squares} sq` : "in place"} · ${ENDING_SHORT[f.ending]}${path && landsTilted(path.keyframes) ? " · ⚠ lands tilted" : ""}`;
}

// Players' own finishers: the GM gives finishers to players ("players"), a player picks one
// per item (item flag animater.finisher), and the pick plays when its "Plays on" matches.
export const finisherAvailableTo = (recipe, userId) => {
  const players = recipe?.finisher?.players ?? [];
  return players.includes("*") || (Boolean(userId) && players.includes(userId));
};
export const playerFinisherChoices = (recipes, { userId, itemName, itemSlug, itemUuid } = {}) =>
  recipes.filter((r) => r?.finisher && r.enabled !== false && finisherAvailableTo(r, userId)
    && matchFinishers([r], { itemName, itemSlug, itemUuid }, r.finisher.on).length > 0);
export function pickedFinisher(recipes, { choiceId, ownerUserIds = [], itemName, itemSlug, itemUuid } = {}) {
  if (!choiceId) return null;
  const r = recipes.find((x) => x?.id === choiceId && x.finisher && x.enabled !== false);
  // An item with no player owners (a GM-run creature) keeps whatever the GM picked.
  if (!r || (ownerUserIds.length && !ownerUserIds.some((u) => finisherAvailableTo(r, u)))) return null;
  return matchFinishers([r], { itemName, itemSlug, itemUuid }, r.finisher.on).length ? r : null;
}
// A player-owned item plays only its owner's pick, when the pick's "Plays on" fits the moment:
// a crit (critical, criticalOrKill), a kill (kill, criticalOrKill, honouring "Needs") or a use.
export function pickPlays(pick, moment, { outcome, event } = {}) {
  const on = pick?.finisher?.on;
  if (moment === "crit") return ["critical", "criticalOrKill"].includes(on) && outcome === "criticalSuccess" ? pick : null;
  if (moment === "kill") return ["kill", "criticalOrKill"].includes(on) && passesSuccess(pick.finisher, outcome) ? pick : null;
  if (moment === "use") return on === "use" && usePasses(pick.finisher, event) ? pick : null;
  return null;
}
export function finisherFires(finisher, { outcome, killed = false } = {}) {
  const crit = outcome === "criticalSuccess";
  switch (finisher?.on) {
    case "kill": return Boolean(killed);
    case "critical": return crit;
    case "criticalOrKill": return crit || Boolean(killed);
    default: return passesSuccess(finisher, outcome);
  }
}
// One action plays a finisher once per target: a crit that then kills only adds the ending.
export function createFinishedMemory(ttlMs = 30000, now = Date.now) {
  const seen = new Map();
  return {
    mark: (key) => seen.set(key, now()),
    has: (key) => { const at = seen.get(key); if (at === undefined) return false; if (now() - at > ttlMs) { seen.delete(key); return false; } return true; },
    // A crit whose play never started takes its mark back.
    forget: (key) => { seen.delete(key); },
    // The kill uses the crit's mark once.
    consume(key) { const held = this.has(key); seen.delete(key); return held; },
  };
}
// The crit's attack roll and the killing damage roll are separate messages (often on separate
// clients), so one action is the attacker, the target, the item and the finisher played.
// A critically failed save marks its own key (`save`): the spell's non-critical damage ends it.
export const finishedKey = ({ attackerId, targetId, itemUuid, recipeId, save = false }) => `${attackerId ?? ""}:${targetId ?? ""}:${itemUuid ?? ""}:${recipeId ?? ""}${save ? ":save" : ""}`;
// Every client keeps the memory: a crit broadcasts its mark (played) or takes it back (played: false).
export const FINISHED_MESSAGE = "finisher-played";
export function finishedMessage(data) {
  if (data?.type !== FINISHED_MESSAGE || typeof data.key !== "string" || !data.key || data.key.length > 400) return null;
  if (data.played !== undefined && typeof data.played !== "boolean") return null;
  return { key: data.key, played: data.played !== false };
}
