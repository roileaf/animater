// Flames and smoke out of doors going with the wind. Pure: how far a fire leans now, how low a gust presses it, and where
// its smoke is carried. The wind is 0-1 and blows toward `angle` (radians, sky-light.mjs weatherOf). A fire under a roof or
// in a room feels none of it, and nothing here ever changes a real light: a gust only presses the flame down for a moment.

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// A seed from a fire's key, so no two gutter in step.
export function windSeed(key = '') { let h = 0; for (const c of String(key)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return (h % 1000) / 1000; }

// How much gust there is at `t` seconds (pure), 0-1: slow swells with quick flurries on them, each fire a moment off the next.
export function gustAt(t, seed = 0) {
  const at = t * 0.31 + seed * 2.1;
  const swell = 0.5 + 0.5 * Math.sin(at) * Math.sin(at * 0.37 + 1.3);
  const flurry = 0.5 + 0.5 * Math.sin(at * 3.7 + seed * 9);
  return clamp(swell * (0.7 + 0.3 * flurry), 0, 1);
}

/**
 * The wind on one fire (pure). { lean -1..1 across the screen, dip 0-1 how low a gust presses it, drift { x, y } in rises for its smoke }.
 * Below a breath of wind nothing happens; `shelter` 0-1 takes it away (1: under cover).
 */
export function flameWind({ wind = 0, angle = 0, t = 0, key = '', shelter = 0 } = {}) {
  const felt = clamp(Number(wind) || 0, 0, 1) * (1 - clamp(shelter, 0, 1));
  if (felt < 0.04) return { lean: 0, dip: 0, drift: { x: 0, y: 0 } };
  const gust = gustAt(t, windSeed(key)), push = felt * (0.55 + 0.45 * gust);
  return {
    lean: clamp(Math.cos(angle) * push * 1.1, -1, 1),
    // Only real gusts in a real wind press a flame down.
    dip: felt > 0.45 && gust > 0.72 ? clamp((gust - 0.72) / 0.28, 0, 1) * clamp((felt - 0.45) / 0.55, 0, 1) * 0.6 : 0,
    drift: { x: Math.cos(angle) * push * 1.4, y: Math.sin(angle) * push * 1.4 },
  };
}
