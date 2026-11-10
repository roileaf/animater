// What a placed area's spell can break, read from the spell itself (pure, no Foundry globals). An area breaks things when
// its animation lands, with no damage roll: its damage types come from the item that placed it, on the placing client
// and again on the GM's (prop-areas.mjs areaRefusal), never from the requester's word.
import { normalizeDamageType } from "../playback/damage-moments.mjs";
import { uuidOwners } from "./prop-triggers.mjs";

// A list from an array, a Set, a Map or Foundry Collection (its values), a {contents} or a plain object (its values).
const listOf = (v) => (v == null ? [] : typeof v === "string" ? [v] : Array.isArray(v) ? v : typeof v.values === "function" ? [...v.values()]
  : Array.isArray(v.contents) ? v.contents : typeof v === "object" ? Object.values(v) : []);
const typesFrom = (raw) => {
  const out = [];
  for (const t of raw) { const n = typeof t === "string" ? normalizeDamageType(t) : ""; if (n && !out.includes(n)) out.push(n); }
  return out;
};
// A D&D 5e activity's damage parts: {types} (a Set or array) each.
const activityTypes = (activity) => listOf(activity?.damage?.parts).flatMap((p) => listOf(p?.types ?? p?.type));

/**
 * Every damage type an item deals, normalized (damage-moments normalizeDamageType), once each, in the item's order; [] for
 * none. PF2e/SF2e: each damage partial's type (a scroll or wand: the spell it holds). D&D 5e: every activity's damage parts,
 * or only the given activity's (the one that placed the area), else the legacy parts list. Any other system: a damage
 * field's own type, as weaponDamageType reads one.
 */
export function damageTypesOfItem(item, systemId, { activity } = {}) {
  if (!item || typeof item !== "object") return [];
  if (item.type === "consumable" && item.embeddedSpell && item.embeddedSpell !== item) return damageTypesOfItem(item.embeddedSpell, systemId, { activity });
  const sys = item.system ?? {};
  if (systemId === "dnd5e") {
    if (activity) return typesFrom(activityTypes(activity));
    const fromActivities = listOf(sys.activities).flatMap(activityTypes);
    if (fromActivities.length) return typesFrom(fromActivities);
    return typesFrom(listOf(sys.damage?.parts).map((p) => (Array.isArray(p) ? p[1] : p?.type)));
  }
  if (systemId === "pf2e" || systemId === "sf2e") {
    const parts = sys.damage && typeof sys.damage === "object" && !Array.isArray(sys.damage) ? Object.values(sys.damage) : [];
    return typesFrom(parts.map((d) => d?.type ?? d?.damageType));
  }
  return typesFrom([sys.damage?.damageType, sys.damage?.type, ...listOf(sys.damage?.base?.types), ...listOf(sys.damage?.parts).map((p) => (Array.isArray(p) ? p[1] : p?.type))]);
}

/** A placed area's id as an area cause names it: a Region's (v14 templates are Regions) or a template's uuid; null otherwise. */
export function areaIdOf(doc) {
  return (doc?.documentName === "Region" || doc?.documentName === "MeasuredTemplate") && typeof doc.uuid === "string" ? doc.uuid : null;
}

/**
 * What placed an area, as its own flags name it: the item and actor (PF2e/SF2e flags.<system>.origin, D&D 5e's activity or
 * origin uuid), the D&D activity, and the PF2e spell card (messageId).
 */
export function areaOriginRefOf(doc, systemId) {
  const flags = doc?.flags?.[systemId] ?? {};
  if (systemId === "dnd5e") {
    const ref = typeof flags.activity === "string" ? flags.activity : typeof flags.origin === "string" ? flags.origin : null;
    const { itemUuid, actorUuid } = uuidOwners(ref);
    return { itemUuid, actorUuid, activityUuid: typeof flags.activity === "string" && /Activity\./.test(flags.activity) ? flags.activity : null, messageId: null };
  }
  const o = flags.origin ?? {};
  return { itemUuid: typeof o.uuid === "string" ? o.uuid : null, actorUuid: typeof o.actor === "string" ? o.actor : null, activityUuid: null,
    messageId: typeof flags.messageId === "string" ? flags.messageId : null };
}

const OWNER = 3;
const idOf = (u) => (typeof u === "string" ? u : typeof u?.id === "string" ? u.id : null);
/**
 * Who placed an area and when, from its own document and the spell card that placed it, for a GM that never saw it
 * placed (it loaded after, or reloaded): {authorId, rememberedAt} on the GM's own clock (localNow, Date.now) from an
 * epoch-ms time read on the clock serverNow is on (a card's timestamp: Date.now as well), never later than now (a sender's
 * clock running ahead), or null when neither says when. A v14 scene document keeps no
 * creation time, so it is the card's (a PF2e region's flags.pf2e.messageId), else the document's own if it has one.
 * Who: a template's author, else the one user the area was made owned by (PF2e makes its placer the owner), else the
 * card's author.
 */
export function placedRecordOf(doc, { localNow, serverNow, message } = {}) {
  if (!doc || !Number.isFinite(localNow) || !Number.isFinite(serverNow)) return null;
  const created = [Number(doc._stats?.createdTime), Number(message?.timestamp)].find(Number.isFinite);
  if (created === undefined) return null;
  const owner = Object.entries(doc.ownership ?? {}).find(([id, level]) => id !== "default" && Number(level) >= OWNER)?.[0] ?? null;
  return { authorId: idOf(doc.author) ?? owner ?? idOf(message?.author) ?? null, rememberedAt: Math.min(localNow, localNow - (serverNow - created)) };
}

/**
 * Which of an area's damage types breaks each thing: hitsOf(type) lists the things that type breaks; each thing is taken
 * once, with the first type (in the spell's order) that breaks it. [{thing, type}].
 */
export function typesBreaking(types, hitsOf, idOf) {
  const out = [], seen = new Set();
  for (const type of types ?? []) for (const thing of hitsOf(type) ?? []) {
    const id = idOf(thing);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ thing, type });
  }
  return out;
}
