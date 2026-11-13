// A built-in design copied into the user's own recipe, bound to what it was copied for: one creature's item
// (itemUuid) or every item with that name (match). Saved recipes play before any built-in, so the copy takes over
// once saved. `blank` keeps the binding but starts from one empty stage.
import { validateRecipe } from "./model.mjs";

const plainName = (name) => String(name ?? "").replace(/\s*\([^)]*\)\s*$/, "").trim();

export function customCopy(recipe, { id, name, names = [], itemUuid = "", trigger, systemId, activity, blank = false } = {}) {
  const match = [...new Set(names.flatMap((n) => [String(n ?? "").trim(), plainName(n)]).filter(Boolean))].join(", ");
  const { matchScope, weaponMode, lifecycle, stateEntry, finisher, ...rest } = recipe;
  const copy = validateRecipe({
    ...rest,
    id,
    name: name || recipe.name,
    category: "Custom",
    enabled: true,
    trigger: trigger ?? recipe.trigger,
    match,
    itemUuid,
    ...(systemId ? { systemId } : {}),
    ...(activity?.id ? { activityId: activity.id, activityType: activity.type, activityName: activity.name } : {}),
    stages: blank ? [{ kind: "cast", assets: ["jb2a.cast_generic"], delay: 0, duration: 1000, scale: 1 }] : recipe.stages,
  });
  // As + New recipe starts: one cast stage with no asset chosen yet (validation wants one to build it).
  if (blank) copy.stages[0].assets = [];
  return copy;
}
