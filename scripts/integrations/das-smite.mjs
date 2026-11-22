// DAS · Core (module id dnd5e-combat) resolves a smite itself: after a weapon hits it asks which smite to cast, spends
// the slot directly, and writes the save cards by hand. D&D 5e never "uses" the spell, so no item-used event exists
// and no area is ever placed. DAS marks the weapon's damage message instead:
//   flags["dnd5e-combat"].smite = { item: uuid, name, level, save: activity id, target: token uuid, kind?: "rider" }
// That message, on the client that rolled it, is the smite's cast.
export const DAS_ID = "dnd5e-combat";

// The smite DAS recorded on a chat message, or null.
export const dasSmiteOf = (message) => {
  const smite = message?.flags?.[DAS_ID]?.smite;
  return smite && typeof smite.item === "string" && smite.item ? smite : null;
};

// The cast as an Animater event. `item` is the smite's item (resolved from smite.item by the caller). A smite whose
// activity names an area (Hail of Thorns: a 5 ft emanation) is that area's event, since no template will ever come;
// `castWithoutArea` has the area built from the spell's own size around the creature hit. Any other smite (Divine
// Smite, Searing Smite, a species rider) is an item-used event aimed at that creature.
export function dasSmiteEvent(message, item, { userId } = {}) {
  const smite = dasSmiteOf(message);
  if (!smite || !item) return null;
  if ((message.author?.id ?? message.user?.id) !== userId) return null;
  const activities = item.system?.activities;
  const activity = (smite.save && typeof activities?.get === "function" ? activities.get(smite.save) : null) ?? null;
  const area = activity?.target?.template, hasArea = Boolean(area?.type) && Number(area?.size) > 0;
  return {
    id: `das-smite:${message.id}`,
    type: hasArea ? "template" : "use",
    systemId: "dnd5e",
    castWithoutArea: true,
    ...(hasArea ? {} : { placedArea: false }),
    item,
    actor: item.actor ?? null,
    activity,
    activityId: activity?.id ?? activity?._id,
    activityName: activity?.name,
    tokenId: message.speaker?.token ?? undefined,
    sceneId: message.speaker?.scene ?? undefined,
    targetUuids: [smite.target].filter(Boolean),
    spellLevel: Number(smite.level) || undefined,
  };
}
