import { dnd5eAttackOutcome, dnd5eTargetOutcomes, midiTargetOutcomes, HIDDEN } from './outcome.mjs';
import { twoeEventElement, dnd5eEventElement } from "../catalogs/shared/element-choice.mjs";
import { rollPrivacy, modePrivacy, stricter, hidden, hiddenReason, hidesResult } from "../core/privacy.mjs";
import { strikeItemOf } from "../engines/finishers/strike-finishers.mjs";
import { rerollChangesNothing, rerollKind } from "./reroll.mjs";
// Normalize system events without changing rolls, items, HP, or system state.
export const pf2eEvent=(message,userId)=>twoeEvent(message,userId,'pf2e');
export const sf2eEvent=(message,userId)=>twoeEvent(message,userId,'sf2e');
// PF2e/SF2e roll option map:increases:N (0 the 1st Strike of a turn, 2 the 3rd and later), or null.
export function mapIncreasesOf(options = []) {
  const found = (Array.isArray(options) ? options : []).map(String).find((o) => /^map:increases:\d+$/.test(o));
  return found ? Number(found.slice(14)) : null;
}
export function twoeEvent(message, userId, systemId='pf2e') {
  const flags=message.flags?.[systemId], author=message.author ?? message.user, context = flags?.context;
  // A reroll plays with its new result, unless it kept the old roll (reroll.mjs).
  if (author?.id !== userId || rerollChangesNothing(message, systemId)) return null;
  if (["damage-taken", "saving-throw", "perception-check", "flat-check"].includes(context?.type)) return null;
  // An action rolled as a skill check (Shove, Trip, Grapple, Demoralize: action:shove) plays as that
  // action's use; other skill checks are no event. Finishers ride the check (checkFinisherEvent).
  const maneuver = context?.type === "skill-check" ? maneuverItem(message, context) : null;
  if (context?.type === "skill-check" && !maneuver) return null;
  const type = maneuver ? "use" : context?.type?.includes("attack")
    ? "attack"
    : message.isDamageRoll
      ? "damage"
      : !message.isRoll
        ? "use"
        : null;
  if (!type || (!maneuver && !message.item && !flags?.origin?.uuid))
    return null;
  // A rule-element strike's damage (Tiger Claw) names its strike, not the feat granting it.
  const item = maneuver ?? strikeItemOf(message, systemId) ?? originSpell(message.actor, flags?.origin);
  // See privacy.mjs: a GM's private roll plays without its outcome; hidden ones are a Skipped row.
  const privacy = rollPrivacy(message), gmPrivate = privacy === "gm";
  if (hidden(privacy)) return { skipped: hiddenReason(item?.name ?? flags?.origin?.name, privacy) };
  const options = context?.options ?? [];
  // Enabled damage dice/modifiers identify riders such as Sneak Attack (flags.<system>.dice/.modifiers).
  const live = rows => (Array.isArray(rows) ? rows : []).filter(r => r?.slug && r.enabled !== false && r.ignored !== true);
  const damageSlugs = type === "damage" ? [...live(flags?.dice).map(d => `dice:${d.slug}`), ...live(flags?.modifiers).map(m => `modifier:${m.slug}`)] : [];
  const altUsage = context?.altUsage ?? flags?.strike?.altUsage ?? item?.altUsageType;
  const weaponMode = ['weapon', 'melee'].includes(item?.type ?? flags?.origin?.type) ? altUsage === "thrown"
    ? "thrown" : altUsage === "melee" ? "melee"
      : options.includes("item:thrown") || options.includes("item:thrown-melee") ? "thrown"
        : options.includes('item:melee') ? 'melee'
          : item?.isThrown === true || (item?.system?.traits?.value?.includes("thrown") || ['bomb','grenade'].includes(item?.system?.group)) && item?.system?.range ? "thrown"
        : item?.isRanged === true || options.includes("item:ranged") || item?.system?.range
          ? "ranged" : "melee"
    // An action rolled as a Strike says which (PF2e's Elemental Blast: self:action:melee / item:ranged…).
    : item?.type === "action" ? options.includes("self:action:melee") || options.includes("item:melee") ? "melee"
      : options.includes("self:action:ranged") || options.includes("item:ranged") ? "ranged" : undefined
    : undefined;
  return {
    type,
    systemId,
    id: `chat:${message.id}`,
    messageId: message.id,
    item,
    ...(weaponMode ? { weaponMode } : {}),
    ...(damageSlugs.length ? { damageSlugs } : {}),
    itemUuid: flags?.origin?.uuid,
    ...(item?.type === 'spell' ? { castRank: Number(flags?.origin?.castRank ?? item.rank ?? item.system?.location?.heightenedLevel ?? item.system?.level?.value) || undefined } : {}),
    tokenId: message.speaker?.token,
    sceneId: message.speaker?.scene,
    actor: message.actor,
    targetUuid: context?.target?.token ?? flags?.target?.token,
    ...(twoeEventElement(message, systemId) ? { element: twoeEventElement(message, systemId) } : {}),
    ...(maneuver ? { skillCheck: true } : {}),
    // The Strike's multiple attack penalty step (map:increases:2 is the 3rd Strike of a turn), for a strained miss.
    ...(type === "attack" && mapIncreasesOf(options) !== null ? { mapIncreases: mapIncreasesOf(options) } : {}),
    // A GM's private roll shows its result unless the world hides it: then an attack plays neutrally (hidden).
    outcome: hidesResult(privacy) ? (type === "attack" ? HIDDEN : undefined) : context?.outcome,
    ...(gmPrivate ? { private: true } : {}),
    ...(rerollKind(message, systemId) ? { reroll: rerollKind(message, systemId) } : {}),
  };
}
// A spell cast from a staff (PF2e Dailies), wand or scroll is no item on the actor, and its attack and
// damage messages carry no embedded spell, so message.item is null. Find it in the actor's spellcasting
// collections or a consumable's embedded spell by id, else stand in from the origin's roll options.
function originSpell(actor, origin) {
  if (origin?.type !== "spell") return null;
  const id = /Item\.([^.]+)$/.exec(String(origin.uuid ?? ""))?.[1];
  const tryGet = (fn) => { try { return fn() ?? null; } catch { return null; } };
  if (id) {
    for (const collection of tryGet(() => actor?.spellcasting?.collections?.values()) ?? []) {
      const spell = tryGet(() => collection?.get?.(id));
      if (spell?.type === "spell") return spell;
    }
    for (const item of tryGet(() => Array.from(actor?.items ?? [])) ?? []) {
      if (item?.type !== "consumable") continue;
      const spell = tryGet(() => item.embeddedSpell);
      if (spell?.id === id) return spell;
    }
  }
  const options = (Array.isArray(origin.rollOptions) ? origin.rollOptions : []).map(String);
  const slug = options.find((o) => o.startsWith("origin:item:slug:"))?.slice(17);
  if (!slug) return null;
  const name = slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  const traits = options.filter((o) => o.startsWith("origin:item:trait:")).map((o) => o.slice(18));
  return { type: "spell", name, slug, rank: Number(origin.castRank) || undefined, system: { slug, traits: { value: traits } }, actor };
}
// The action a skill check names (action:force-open): the actor's own action item, else a stand-in
// the action catalogs find by slug.
function maneuverItem(message, context) {
  const slug = (context.options ?? []).map(String).find((o) => o.startsWith("action:"))?.slice(7);
  if (!slug) return null;
  if (message.item?.type === "action" && (message.item.slug ?? message.item.system?.slug) === slug) return message.item;
  const own = Array.from(message.actor?.items ?? []).find((i) => i?.type === "action" && (i.slug ?? i.system?.slug) === slug);
  const name = slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  return own ?? { type: "action", name, slug, system: { slug, traits: { value: [] } }, actor: message.actor };
}
// Whether a Midi-QOL workflow runs this activity. Midi keys its workflows by their card (ChatMessage.<id>)
// and, with "Use Weak References for Workflows" on, stores a WeakRef to each instead of the workflow.
export function midiRunsActivity(workflows, subject) {
  if (!subject?.uuid || typeof workflows?.values !== "function") return false;
  for (const entry of workflows.values()) {
    const w = typeof entry?.deref === "function" ? entry.deref() : entry;
    if (w && (w.activity === subject || w.activity?.uuid === subject.uuid)) return true;
  }
  return false;
}
// verdict: an attack Midi-QOL rolled without a chat message (into its own card), { messageId: its card,
// targets: [{ token: uuid, ac }], hits: token ids, or null when Midi checks no hits (then the ACs decide) }.
export function dnd5eEvent(type, subject, { rolls = [], results = {}, verdict = null } = {}) {
  const message=results.message??rolls.find(r=>r.parent?.system?.targets)?.parent??rolls[0]?.parent;
  if (!subject?.item) return null;
  const targets = verdict ? verdict.targets : Array.from(message?.system?.targets ?? []);
  const midi = verdict?.hits && type === "attack" ? midiTargetOutcomes(rolls[0], targets.map((t) => String(t.token).split(".").at(-1)), verdict.hits) : null;
  // The message's whisper and every roll's mode, the most hidden wins (privacy.mjs). The hooks run on
  // the roller's own client, so without a message author the roller is this user.
  const isGM = (message?.author ?? message?.user)?.isGM ?? globalThis.game?.user?.isGM;
  const privacy = rolls.reduce((p, r) => stricter(p, modePrivacy(r.options?.rollMode, isGM)), rollPrivacy(message, { isGM }));
  if (hidden(privacy)) return { skipped: hiddenReason(subject.item.name ?? subject.name, privacy) };
  const gmPrivate = privacy === "gm";
  return {
    type,
    systemId: 'dnd5e',
    id: message?.id ? `activity:${message.id}:${type}` : verdict?.messageId ? `activity:${verdict.messageId}:${type}` : null,
    messageId: message?.id ?? verdict?.messageId,
    item: subject.item,
    actor: subject.actor ?? subject.item.actor,
    activityId: subject.id ?? subject._id,
    activity: subject,
    activityName: subject.name,
    ...(dnd5eEventElement(subject, rolls) ? { element: dnd5eEventElement(subject, rolls) } : {}),
    tokenId: subject.getUsageToken?.()?.id,
    sceneId: subject.getUsageToken?.()?.parent?.id,
    targetUuids: verdict ? targets.map((t) => t.token) : Array.from(message?.system?.targets ?? message?.data?.system?.targets ?? rolls[0]?.options?.targets ?? []).map(t=>typeof t==='string'?t:t.token).filter(Boolean),
    ...(subject.item.type==='weapon'?{weaponMode:String(rolls[0]?.options?.attackMode??'').startsWith('thrown')?'thrown':rolls[0]?.options?.attackMode==='ranged'||subject.attack?.type?.value==='ranged'?'ranged':'melee'}:{}),
    spellLevel: subject.item.type==='spell' ? Number(message?.system?.level??message?.data?.system?.level??subject.getRollData?.()?.item?.level??rolls[0]?.data?.item?.level??subject.item.getRollData?.()?.item?.level??subject.item.system?.level) : undefined,
    // Attack rolls: natural 20/1, or the total against a single target's AC.
    outcome: hidesResult(privacy) ? (type === "attack" ? HIDDEN : undefined) : midi ? (rolls[0]?.isFumble ? "criticalFailure" : Object.keys(midi).length === 1 ? Object.values(midi)[0] : rolls[0]?.isCritical ? "criticalSuccess" : null)
      : type === "attack" ? dnd5eAttackOutcome(rolls, targets) : null,
    // Each target's own hit or miss, for sounds that differ per target (what each blow lands on).
    ...(!hidesResult(privacy) && type === "attack" ? { targetOutcomes: midi ?? dnd5eTargetOutcomes(rolls, targets) } : {}),
    ...(gmPrivate ? { private: true } : {}),
    rolls,
  };
}
// PF2e and SF2e record only the first of the roller's targets on a damage roll. A spell that strikes several
// (Electric Arc's two creatures) plays on all of them when the roller still targets the recorded one among
// others; a weapon's damage stays on the one creature its Strike hit.
export function eventTargets(event, recorded, mine = []) {
  if (!recorded) return [];
  const several = event?.item?.type === "spell" && event.type !== "attack" && mine.length > 1 && mine.some((t) => t === recorded || t?.document === recorded?.document);
  return several ? mine : [recorded];
}
