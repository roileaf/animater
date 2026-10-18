export const PATH_MOTIONS = new Set(["rush", "leap", "roll", "dodge"]);
// Motions that may end where they finish instead of returning (finishers move the token there).
export const HOLDING_MOTIONS = new Set(["rush", "leap", "roll", "fade", "path", "fragments"]);
export const isPathMotion = (stage) =>
  stage?.kind === "motion" && PATH_MOTIONS.has(stage.motion);

export function motionPhases(stage) {
  const arrival = Math.max(
    0.15,
    Math.min(0.7, (stage.motionArrival ?? 45) / 100),
  );
  const hold = Math.max(
    0.05,
    Math.min(0.9 - arrival, (stage.motionHold ?? 25) / 100),
  );
  return { arrival, release: arrival + hold };
}

export function pathDistance(stage, direction, grid) {
  const maximum = Math.max(0, (stage.distance ?? 8) * grid);
  if (stage.motionRange === "distance" || stage.motion === "dodge")
    return maximum;
  if (!Number.isFinite(direction.length)) return maximum;
  const clearance = Math.max(0, direction.clearance ?? grid);
  const gap = (stage.stopGap ?? 0.1) * grid;
  return stage.motionEndpoint === "past"
    ? Math.min(maximum, direction.length + clearance + gap)
    : Math.min(maximum, Math.max(0, direction.length - clearance - gap));
}
