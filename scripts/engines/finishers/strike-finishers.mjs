// Synthetic strikes: PF2e builds the basic unarmed attack (and rule-element strikes such as Fist,
// Jaws or Claw) as weapons its actor does not hold, so they have no Item document to flag. A
// player's finisher pick for one lives on the actor instead: flags.animater.strikeFinishers[key].
import { normalize } from "../../core/model.mjs";

export const STRIKE_FLAG = "strikeFinishers";
// The strike's slug, else its name, normalized; dots and spaces become "-" so it is a safe flag key.
export const strikeKey = ({ slug, name } = {}) => normalize(slug || name).replace(/[.\s]+/g, "-");
// An item whose actor does not hold it as itself: the basic unarmed attack, or a rule-element
// strike (whose id is its feat's, so a uuid lookup would find the feat, not the strike).
export const isSyntheticItem = (item) => {
  const items = item?.actor?.items;
  return typeof items?.get === "function" && items.get(item.id) !== item;
};
// A plain { actor, name, slug } strike, not a document.
export const isStrikeDescriptor = (x) => Boolean(x) && typeof x === "object" && !x.documentName && typeof x.getFlag !== "function"
  && Boolean(x.actor) && Boolean(x.name || x.slug);
// Whose pick lives on the actor: a descriptor, or a synthetic item.
export const picksOnActor = (x) => Boolean(x) && (isStrikeDescriptor(x) || isSyntheticItem(x));
export const strikeOf = (x) => ({ name: x?.name, slug: x?.slug ?? x?.system?.slug });
export const strikePick = (actor, strike) => {
  const key = strikeKey(strike);
  return (key && actor?.getFlag?.("animater", STRIKE_FLAG)?.[key]) || null;
};
// The struck item's slug from a roll's options (item:slug:<slug>).
export const strikeSlugFromOptions = (options) =>
  (Array.isArray(options) ? options : []).map(String).find((o) => o.startsWith("item:slug:"))?.slice("item:slug:".length) || null;
// PF2e's fixed synthetic ids: xxPF2ExUNARMEDxx, xxxxxxFISTxxxxxx.
export const syntheticUuid = (uuid) => /\.Item\.xx[A-Za-z0-9]*xx$/.test(String(uuid ?? ""));

const STRIKE_TYPES = ["weapon", "melee"];
// A strike message whose item is not the strike: a rule-element strike (Tiger Stance's Tiger Claw)
// shares its feat's id, and a damage card carries no strike identifier, so PF2e's message.item
// falls back to origin.uuid and answers the feat.
export const strikeLostItem = (message, systemId) =>
  STRIKE_TYPES.includes(message?.flags?.[systemId]?.origin?.type) && Boolean(message?.item?.type) && !STRIKE_TYPES.includes(message.item.type);
// The struck item of a PF2e/SF2e roll message: message.item, or for a rule-element strike the
// actor's strike with that id (and the roll's item:slug), else null (never the feat).
export function strikeItemOf(message, systemId) {
  if (!strikeLostItem(message, systemId)) return message?.item ?? null;
  const flags = message.flags[systemId], id = String(flags.origin.uuid ?? "").split(".").at(-1), slug = strikeSlugFromOptions(flags.context?.options);
  const actions = (message.actor ?? message.speakerActor)?.system?.actions;
  return (Array.isArray(actions) ? actions : []).find((a) => a?.item?.id === id && (!slug || (a.item.slug ?? a.slug) === slug))?.item ?? null;
}

// A PF2e sheet's Attacks entry dragged out: { type: "Action", index, actorUUID } (a character's
// strike), or an Item drag whose uuid names a synthetic strike. Answers { name, slug } or null.
export function strikeFromDrag(data, resolveActor) {
  if (!data || typeof data !== "object") return null;
  const actor = data.actorUUID ? resolveActor?.(data.actorUUID) : null;
  const actions = Array.isArray(actor?.system?.actions) ? actor.system.actions : [];
  let action = null;
  if (data.type === "Action" && Number.isInteger(Number(data.index)) && data.index !== null && data.index !== "") action = actions[Number(data.index)] ?? null;
  else if (data.type === "Item" && syntheticUuid(data.uuid)) action = actions.find((a) => a?.item?.id === String(data.uuid).split(".").at(-1)) ?? null;
  if (!action) return null;
  const name = action.item?.name ?? action.label, slug = action.item?.slug ?? action.slug ?? null;
  return name ? { name, slug } : null;
}
