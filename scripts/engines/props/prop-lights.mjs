// Light props: which props hold a light, and which AmbientLights go out when one breaks. Pure.
import { nameTokens } from "./prop-material.mjs";
import { onLevel } from "./prop-pick.mjs";

export const LIGHT_WORDS = ["brazier", "lantern", "lamp", "candle", "candelabra", "torch", "chandelier"];

// Whether the file name says the prop carries a light.
export const guessLight = (src) => nameTokens(src).some((t) => LIGHT_WORDS.includes(t));

// The visible lights whose centre lies inside the prop's rect grown by a quarter square, on the given levels; never a
// burning-oil light (a neighbour's fire is not this prop's own). rect: {x, y, width, height}; lights: {id, x, y, hidden, levels, flags?}[].
export function lightsOfProp(rect, lights, grid, levels) {
  const m = grid / 4;
  return (lights ?? []).filter((l) => !l.hidden && !l.flags?.animater?.propFire && Number.isFinite(l.x) && Number.isFinite(l.y)
    && l.x >= rect.x - m && l.x <= rect.x + rect.width + m && l.y >= rect.y - m && l.y <= rect.y + rect.height + m
    && onLevel(l.levels, levels));
}

export const hideLights = (lights) => (lights ?? []).map((l) => ({ _id: l.id, hidden: true }));

// Only the named lights that still exist and are hidden come back.
export function unhideLights(ids, lights) {
  const want = new Set(ids ?? []);
  return (lights ?? []).filter((l) => want.has(l.id) && l.hidden === true).map((l) => ({ _id: l.id, hidden: false }));
}

// Burning lamp oil: a lantern or lamp that breaks while lit, or by fire, leaves its oil burning for a minute. The glow
// is one temporary AmbientLight the GM creates (flags.animater.propFire = {tileId, until}); the fire-sound engine plays
// its fire-pot loop and the light's own smoke rises from it; flame: false because the wreck draws the patch's flames.
export const BURN_MS = 60000;

export const oilCatches = ({ contents, damageType, lights } = {}) => contents === "lampoil" && (damageType === "fire" || (lights?.length ?? 0) > 0);

// The burning patch's light at the tile's centre, its tile's levels and elevation; distance is the scene's grid distance.
export function burnLightData({ centre, distance, levels, elevation, tileId, now }) {
  return {
    x: centre.x, y: centre.y, elevation, levels: [...(levels ?? [])],
    config: { bright: distance * 0.5, dim: distance * 1.5, color: "#ff9a40", alpha: 0.5, animation: { type: "fire", speed: 5, intensity: 5 } },
    flags: { animater: { propFire: { tileId, until: now + BURN_MS }, flame: false, fireKind: "pot", fireSound: true, smoke: true } },
  };
}

const fireOf = (l) => l?.flags?.animater?.propFire;
// Fire lights whose minute has passed (a GM who reloaded or left never deleted them).
export const staleFires = (lights, now) => (lights ?? []).filter((l) => { const f = fireOf(l); return f && Number(f.until) <= now; }).map((l) => l.id);
export const firesOf = (tileId, lights) => (lights ?? []).filter((l) => fireOf(l)?.tileId === tileId).map((l) => l.id);
export const allFires = (lights) => (lights ?? []).filter((l) => fireOf(l)).map((l) => l.id);
