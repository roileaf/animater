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

// An effect at a bare point (an area's art) has no height of its own, so Sequencer draws it at 0, under anything raised:
// a dragon's breath under the dragon. It goes as high as the highest of the caster and those caught in it. On a scene of several
// levels it stays within the caster's, since Sequencer hides an effect outside the level on screen. Null when nobody is off the floor.
export function areaElevation(context, viewedLevel = globalThis.canvas?.level) {
  const heightOf = (t) => { const own = Number((t?.document ?? t)?.elevation); return Number.isFinite(own) ? own : 0; };
  const high = Math.max(...[context?.source, ...(context?.targets ?? [])].filter(Boolean).map(heightOf), -Infinity);
  const source = context?.source?.document ?? context?.source, level = source?.parent?.levels?.get?.(source?.level) ?? viewedLevel;
  const floor = Number(level?.elevation?.base ?? 0) || 0, top = Number(level?.elevation?.top);
  if (!(high > floor)) return null;
  return Number.isFinite(top) && source?.parent?.levels?.size > 1 ? Math.min(high, top) : high;
}
