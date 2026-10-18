import { normalize, STRIKE_SCOPES } from "./model.mjs";

// What a recipe is linked to, as comparable keys: the bound item, or each
// name it matches (a catalog copy also matches its condition or effect name).
function linkKeys(r, entryName) {
  const kind = [r.trigger, r.lifecycle ?? "", r.weaponMode ?? "", r.activityId ?? ""].join("|");
  if (Object.hasOwn(STRIKE_SCOPES, r.matchScope ?? '')) return [`${kind}|name:${STRIKE_SCOPES[r.matchScope].toLowerCase()}`];
  if (r.itemUuid) return [`${kind}|item:${r.itemUuid}`];
  const names = String(r.match ?? "").split(",").map((n) => normalize(n)).filter(Boolean);
  const entry = r.stateEntry && entryName?.(r.stateEntry);
  if (entry) names.push(normalize(entry));
  return [...new Set(names)].map((n) => `${kind}|name:${n}`);
}
// Which recipe plays when several match the same thing, mirroring playback:
// a catalog copy before a handmade lasting one, a bound item before a name, then id order.
const rank = (a, b) =>
  Number(Boolean(b.stateEntry)) - Number(Boolean(a.stateEntry)) ||
  Number(Boolean(b.itemUuid)) - Number(Boolean(a.itemUuid)) ||
  a.id.localeCompare(b.id);

// For each enabled recipe that shares a link with another: who plays, and what it shares.
export function recipeConflicts(recipes, { entryName } = {}) {
  const byKey = new Map();
  for (const r of recipes.filter((r) => r.enabled !== false))
    for (const key of linkKeys(r, entryName)) byKey.set(key, [...(byKey.get(key) ?? []), r]);
  const out = new Map();
  for (const [key, group] of byKey) {
    if (group.length < 2) continue;
    const winner = [...group].sort(rank)[0];
    const what = key.split("|name:")[1] ?? `item:${key.split("|item:")[1]}`;
    for (const r of group) {
      const note = out.get(r.id) ?? { plays: true, others: new Set(), what: new Set() };
      if (r !== winner) { note.plays = false; note.winner = winner; }
      for (const o of group) if (o !== r) note.others.add(o);
      note.what.add(what);
      out.set(r.id, note);
    }
  }
  return out;
}
// A saved recipe that can never play because nothing links it.
export const unlinked = (r) => !Object.hasOwn(STRIKE_SCOPES, r.matchScope ?? '') && !r.itemUuid && !r.stateEntry && !String(r.match ?? "").trim() && ["effect", "use", "attack", "damage", "template"].includes(r.trigger);
