// Heat haze over fire (the "Heat haze over fires" setting): every Foundry light animated as a torch or a flame — a
// brazier, a campfire, a torch a creature carries — bends the air just around it, through the same scene filter as
// Animater's fire auras (distortion-host.mjs). A light can opt in or out with its Animater flag `heatHaze`.

export const FIRE_ANIMATIONS = Object.freeze(new Set(['torch', 'flame', 'fire', 'candle', 'flicker']));

// Whether a light (its source data, plus its document's Animater flags) is a fire.
export function isFireLight(data = {}, flags = {}) {
  return choiceOf(flags?.heatHaze) ?? FIRE_ANIMATIONS.has(String(data?.animation?.type ?? '').toLowerCase());
}
// Whether a light sends up smoke (Ambient Light configuration → Animater: Smoke): its own choice, else a fire does.
export function smokesLight(data = {}, flags = {}) {
  return choiceOf(flags?.smoke) ?? FIRE_ANIMATIONS.has(String(data?.animation?.type ?? '').toLowerCase());
}
// A light's own on/off choice (the form saves "true"/"false"; "" or none follows its animation).
const choiceOf = (v) => (v === true || v === 'true' ? true : v === false || v === 'false' ? false : null);

// The haze's tag (a lasting 'haze', see scene-distortion.mjs): over the flame and a little above it, where the heat
// rises (never over the creature holding it). A bigger fire (a bright light reaching further) is a little wider, never
// more than two squares; a torch in a creature's hand (`carried`, `at` its flame) about a third of a square.
export const hazeAbove = (radius) => radius * 0.35;
export function fireHazeTag(data = {}, { grid = 100, distancePx = grid, level = null, carried = false, at = null } = {}) {
  const bright = Number(data.bright) || 0, dim = Number(data.dim) || Number(data.radius) || 0;
  const size = carried ? 0.32 : Math.min(2, Math.max(0.5, 0.6 + (bright || dim / 2) / (distancePx * 8)));
  const radius = Math.round(grid * size), flame = at ?? { x: Number(data.x) || 0, y: Number(data.y) || 0 };
  return {
    kind: 'haze', at: { x: flame.x, y: flame.y - hazeAbove(radius) }, radius,
    startMs: 0, lengthMs: null, strength: 0.55, follow: true, area: { type: 'circle' },
    ...(typeof level === 'string' && level ? { level } : {}),
  };
}
