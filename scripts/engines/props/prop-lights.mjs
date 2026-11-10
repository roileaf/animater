// Light props: which props hold a light, and which AmbientLights go out when one breaks. Pure.
import { nameTokens } from "./prop-material.mjs";
import { onLevel } from "./prop-pick.mjs";

export const LIGHT_WORDS = ["brazier", "lantern", "lamp", "candle", "candelabra", "torch", "chandelier"];

// Whether the file name says the prop carries a light.
export const guessLight = (src) => nameTokens(src).some((t) => LIGHT_WORDS.includes(t));

// The visible lights whose centre lies inside the prop's rect grown by a quarter square, on the given levels.
// rect: {x, y, width, height}; lights: {id, x, y, hidden, levels}[].
export function lightsOfProp(rect, lights, grid, levels) {
  const m = grid / 4;
  return (lights ?? []).filter((l) => !l.hidden && Number.isFinite(l.x) && Number.isFinite(l.y)
    && l.x >= rect.x - m && l.x <= rect.x + rect.width + m && l.y >= rect.y - m && l.y <= rect.y + rect.height + m
    && onLevel(l.levels, levels));
}

export const hideLights = (lights) => (lights ?? []).map((l) => ({ _id: l.id, hidden: true }));

// Only the named lights that still exist and are hidden come back.
export function unhideLights(ids, lights) {
  const want = new Set(ids ?? []);
  return (lights ?? []).filter((l) => want.has(l.id) && l.hidden === true).map((l) => ({ _id: l.id, hidden: false }));
}
