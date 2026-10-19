// Activity rows in plain words: what happened to an event, and the one thing to do about it.
// Pure: entries come from Runtime.trace (status, detail, recipe, item, reason, itemType).

// What each status means, for the legend.
export const ACTIVITY_STATUSES = Object.freeze({
  Played: "Played on the canvas",
  Persistent: "Started a lasting animation",
  Previewed: "Played only on your screen",
  Skipped: "Nothing played, and why",
  Blocked: "Tried to play but failed",
  Ended: "A lasting animation ended",
  Stopped: "Stopped by hand",
});
// The filter chips: which statuses each one shows.
export const ACTIVITY_FILTERS = Object.freeze({
  all: { label: "All", statuses: null },
  played: { label: "Played", statuses: ["Played", "Persistent", "Previewed"] },
  skipped: { label: "Skipped", statuses: ["Skipped"] },
  blocked: { label: "Blocked", statuses: ["Blocked"] },
});
export const activityShown = (entry, filter = "all") => {
  const statuses = ACTIVITY_FILTERS[filter]?.statuses;
  return !statuses || statuses.includes(entry?.status);
};

const item = (e) => e.item || "This item";
// reason → sentence and fix. `catalog` opens the catalog page that fits the item's type.
const REASONS = {
  off: (e) => ({ text: `Nothing is set to play automatically, so ${item(e)} did not animate. Turn on a catalog's Plug & play, or Play my own recipes automatically in Setup.`, fix: { label: "Open Setup", page: "setup" } }),
  "no-recipe": (e) => ({ text: `No animation is set for ${item(e)}: its catalog entry is off or excluded, and no recipe of yours names it.`, fix: { label: "Find it in a catalog", catalog: e.itemType || "any" }, also: { label: "Make a recipe", action: "new" } }),
  claimed: (e) => ({ text: `Another module handled ${item(e)} and asked Animater not to play.`, fix: null }),
  aa: (e) => ({ text: `${item(e)} is left to Automated Animations (${e.why || "it animates it"}).`, fix: { label: "Open Setup", page: "setup" } }),
};

// The title, sentence and fix for one log entry. Unknown reasons keep the logged detail.
export function explainEntry(entry = {}) {
  const known = entry.reason && REASONS[entry.reason]?.(entry);
  return {
    title: entry.recipe || entry.item || entry.status || "",
    text: known?.text ?? entry.detail ?? "",
    fix: known?.fix ?? null,
    also: known?.also ?? null,
  };
}

// The catalog page that fits an item type, from the pages the sidebar lists ([page, icon, name]).
export function catalogPageFor(type, pages = []) {
  const ids = pages.map(([page]) => page);
  const words = { spell: ["spell"], cantrip: ["spell"], weapon: ["weapon"], melee: ["weapon"], ranged: ["weapon"], feat: ["feat"], action: ["action"], ability: ["feat", "action"], feature: ["feature", "feat"], condition: ["condition"], effect: ["effect"], card: ["card", "domain"] }[String(type ?? "").toLowerCase()] ?? [];
  for (const w of words) { const hit = ids.find((id) => id.toLowerCase().includes(w)); if (hit) return hit; }
  return ids[0] ?? "setup";
}
