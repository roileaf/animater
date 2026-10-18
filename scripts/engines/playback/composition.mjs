import { number, EASES, stageSpan } from "../../core/stage-options.mjs";
import { isPathMotion, motionPhases } from "../motion/motion-path.mjs";

// Stable stage references survive reordering. Resolve timing per target, so a
// distant target's impact follows its own orb instead of the first target's.
export function compositionOptions(stage, index, reserved = []) {
  let fallback = `stage-${index + 1}`;
  while (reserved.includes(fallback)) fallback += "-auto";
  return {
    stageId: /^[a-zA-Z0-9_-]{1,80}$/.test(stage.stageId ?? "")
      ? stage.stageId
      : fallback,
    label:
      typeof stage.label === "string" ? stage.label.trim().slice(0, 80) : "",
    afterStage:
      typeof stage.afterStage === "string" ? stage.afterStage.slice(0, 80) : "",
    timingAnchor: ["start", "arrival"].includes(stage.timingAnchor)
      ? stage.timingAnchor
      : "end",
    startOffset: number(stage.startOffset, -30000, 30000, 0),
    perSquare: number(stage.perSquare, 0, 2000, 0),
    moveDelay: number(stage.moveDelay, 0, 10000, 0),
    moveEase: Object.hasOwn(EASES, stage.moveEase) ? stage.moveEase : "linear",
    landingGroup:
      typeof stage.landingGroup === "string"
        ? stage.landingGroup.trim().slice(0, 40)
        : "",
    scatter: number(stage.scatter, 0, 2, 0),
    travelDestination: stage.travelDestination === "area" ? "area" : "targets",
    travelOrigin: ["source", "previousTarget", "firstTarget", "target"].includes(
      stage.travelOrigin,
    )
      ? stage.travelOrigin
      : "source",
  };
}
export function timedStages(
  recipe,
  distance = 3,
  targetIndex = 0,
  pathDistanceFor = () => distance,
) {
  const stages = recipe.stages.map((s, index) => ({
    ...s,
    ...compositionOptions(
      s,
      index,
      recipe.stages.map((p) => p.stageId),
    ),
  }));
  if (new Set(stages.map((s) => s.stageId)).size !== stages.length)
    throw Error("Stage IDs must be unique.");
  const resolved = new Map(),
    visiting = new Set();
  const resolve = (s) => {
    if (resolved.has(s.stageId)) return resolved.get(s.stageId);
    if (visiting.has(s.stageId))
      throw Error(
        "Stage timing contains a cycle. Choose an earlier independent stage.",
      );
    visiting.add(s.stageId);
    const duration = Math.min(
      30000,
      s.kind==='sound' && s.clipEnd>0 ? s.clipEnd-s.clipStart : Infinity,
      s.duration +
        (s.kind === "projectile"
          ? s.perSquare * distance
          : isPathMotion(s) && s.motionRange === "target"
            ? s.perSquare * Math.min(pathDistanceFor(s), s.distance ?? 20)
            : 0),
    );
    let delay = s.delay;
    if (s.afterStage) {
      const parent = stages.find((p) => p.stageId === s.afterStage);
      if (!parent)
        throw Error(
          `Stage ${s.label || s.stageId}: linked stage was removed. Choose another timing reference.`,
        );
      const reference = resolve(parent);
      // Arrival: a path motion's arrival phase, or the moment a travel/projectile
      // film reaches its target (measured contact, else ~55% of the flight).
      const flight = ["travel", "projectile"].includes(reference.kind);
      if (s.timingAnchor === "arrival" && !isPathMotion(reference) && !flight)
        throw Error(
          "Arrival timing needs a rush, leap, roll, dodge, travel or projectile reference.",
        );
      delay = Math.max(
        0,
        reference.delay +
          (s.timingAnchor === "start"
            ? 0
            : s.timingAnchor === "arrival"
              ? flight
                ? stageSpan(reference) - reference.duration +
                  Math.min(reference.duration, Number(reference.contact) > 0 ? Number(reference.contact) : reference.duration * 0.55)
                : stageSpan(reference) -
                  reference.duration +
                  reference.duration * motionPhases(reference).arrival
              : stageSpan(reference)) +
          s.startOffset,
      );
    }
    if (
      ["travel", "projectile", "impact"].includes(s.kind) ||
      s.subject === "targets"
    )
      delay += targetIndex * (s.targetStagger ?? 0);
    const result = { ...s, duration, delay };
    if (s.kind === "projectile" && s.moveDelay >= s.duration)
      throw Error("Launch pause must be shorter than orb duration.");
    visiting.delete(s.stageId);
    resolved.set(s.stageId, result);
    return result;
  };
  return stages.map(resolve);
}
export function sampleRecipe(recipe, distance = recipe.previewDistance ?? 3) {
  return recipe.timingResolved
    ? recipe
    : {
        ...recipe,
        stages: timedStages(recipe, distance),
        timingResolved: true,
      };
}
export function centerOf(token) {
  return token?.center ?? { x: token?.x ?? 0, y: token?.y ?? 0 };
}
export function targetDistance(source, target, grid = 100) {
  const a = centerOf(source),
    b = centerOf(target);
  return Math.hypot(b.x - a.x, b.y - a.y) / Math.max(1, grid);
}

// Random variants: stages sharing a variantGroup are alternatives; each play keeps
// one of them. Each variant is a full stage with its own asset, size and timing.
export function variantMembers(stages, group) {
  return group ? stages.filter((s) => s.variantGroup === group) : [];
}
export function pickVariants(recipe, random = Math.random) {
  const groups = new Map();
  for (const s of recipe.stages) if (s.variantGroup) groups.set(s.variantGroup, [...(groups.get(s.variantGroup) ?? []), s]);
  const dropped = new Map();
  for (const members of groups.values()) {
    if (members.length < 2) continue;
    const kept = members[Math.min(members.length - 1, Math.floor(random() * members.length))];
    for (const s of members) if (s !== kept) dropped.set(s.stageId, kept.stageId);
  }
  if (!dropped.size) return recipe;
  // A stage linked to a variant that did not play follows the one that did.
  // (A variant linked to its own dropped sibling keeps its plain start time instead.)
  const follow = (id, self) => { const to = dropped.get(id) ?? id; return to === self ? "" : to; };
  return {
    ...recipe,
    stages: recipe.stages.filter((s) => !dropped.has(s.stageId)).map((s) => {
      const next = { ...s };
      if (s.afterStage) next.afterStage = follow(s.afterStage, s.stageId);
      if (s.startRef) next.startRef = follow(s.startRef, s.stageId) || undefined;
      if (!next.afterStage) { delete next.startMode; delete next.startRef; }
      return next;
    }),
  };
}
// Studio monitor: show one variant per group (the selected one if it is a variant,
// else the first) without changing stage positions, so the timeline still lines up.
export function previewVariants(recipe, selectedIndex = -1) {
  const selected = recipe.stages[selectedIndex];
  const shown = new Map();
  for (const s of recipe.stages) if (s.variantGroup && !shown.has(s.variantGroup)) shown.set(s.variantGroup, s);
  if (selected?.variantGroup) shown.set(selected.variantGroup, selected);
  if (![...shown.keys()].some((g) => variantMembers(recipe.stages, g).length > 1)) return recipe;
  return {
    ...recipe,
    stages: recipe.stages.map((s) => (s.variantGroup && shown.get(s.variantGroup) !== s && variantMembers(recipe.stages, s.variantGroup).length > 1
      ? { ...s, opacity: 0, volume: 0, skipSound: true } : s)),
  };
}
