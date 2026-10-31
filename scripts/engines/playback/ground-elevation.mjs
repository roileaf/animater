// Foundry 14 sorts the canvas by elevation before sort layer, so a layer drawn "below tokens" (Sequencer's
// belowTokens: sort layer 600) but bound to a flying token's elevation draws over every creature on the ground.
// Such a layer is pinned to the floor under its token instead: the base of the token's level, or the token's own
// elevation when that is lower (a creature down in a pit). It still follows the token across the map.
export function groundElevation(token, viewedLevel = globalThis.canvas?.level) {
  const doc = token?.document ?? token;
  const level = doc?.parent?.levels?.get?.(doc?.level) ?? viewedLevel;
  const base = Number(level?.elevation?.base ?? 0) || 0;
  const own = Number(doc?.elevation);
  return Number.isFinite(own) ? Math.min(own, base) : base;
}

// Sends a Sequencer effect below tokens and keeps it on the ground under `token` (see above).
export function onGroundBelow(effect, token) {
  effect.belowTokens();
  if (token) effect.elevation?.(groundElevation(token), { absolute: true });
  return effect;
}
