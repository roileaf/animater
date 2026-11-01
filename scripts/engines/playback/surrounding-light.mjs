// Creatures lit by their surroundings (the "Creatures lit by their surroundings" setting): a creature near a light —
// a torch, a brazier, a glowing spell (Animater's effect lights are real Foundry lights too) — takes on the light's
// colour and catches a rim of it on the side that faces it. Strongest in the dark; nothing in full daylight.

const rgb = (c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
const hex = ([r, g, b]) => (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
// A warm torch when the light gives no colour of its own.
export const PLAIN_LIGHT = 0xffd9a0;

// The light reaching a point: { color, strength 0–1, angle (degrees, from the creature toward the light) }, or null.
// `lights`: [{ x, y, radius, color, alpha }] that reach the point (walls already tested); `darkness` 0–1.
export function lightAround(point, lights = [], darkness = 1) {
  let total = 0, r = 0, g = 0, b = 0, dx = 0, dy = 0;
  for (const l of lights) {
    const d = Math.hypot(l.x - point.x, l.y - point.y), reach = Number(l.radius) || 0;
    if (!(reach > 0) || d >= reach) continue;
    const w = (1 - d / reach) ** 1.5 * Math.min(1, Math.max(0, l.alpha ?? 0.5) * 2);
    if (!(w > 0)) continue;
    const [cr, cg, cb] = rgb(Number.isFinite(l.color) ? l.color : PLAIN_LIGHT);
    r += cr * w; g += cg * w; b += cb * w; total += w;
    if (d > 1) { dx += ((l.x - point.x) / d) * w; dy += ((l.y - point.y) / d) * w; }
  }
  const strength = Math.min(1, total) * Math.min(1, Math.max(0, darkness));
  if (strength < 0.08) return null;
  const pull = Math.hypot(dx, dy) / total;
  return {
    color: hex([r / total, g / total, b / total]), strength,
    // A creature between lights on all sides has no lit side (the rim fades with how one-sided the light is).
    angle: pull > 0.15 ? (Math.atan2(dy, dx) * 180) / Math.PI : null, side: Math.min(1, pull),
  };
}

// Rounded so a creature only re-lights on a change worth seeing (light flicker and small steps keep it as it is).
export function litKey(light) {
  if (!light) return null;
  const c = rgb(light.color).map((v) => Math.round(v / 32)).join('.');
  const a = light.angle === null ? 'x' : Math.round(light.angle / 30) * 30;
  return `${c}|${Math.round(light.strength * 5)}|${a}`;
}

// The Tokenshade look: the art tinted toward the light's colour, and a rim of it on the side facing the light.
export function litPreset(light) {
  const [r, g, b] = rgb(light.color).map((v) => v / 255);
  const k = 0.45 * light.strength, mean = (r + g + b) / 3 || 1;
  const params = [{ filterType: 'adjustment', red: 1 + k * (r / mean - 1), green: 1 + k * (g / mean - 1), blue: 1 + k * (b / mean - 1), brightness: 1 + 0.06 * light.strength }];
  // The bevel lights the edge facing away from its rotation, so it points from the light toward the creature.
  if (light.angle !== null) params.push({ filterType: 'bevel', rotation: light.angle + 180, thickness: 5, lightColor: light.color, lightAlpha: Math.min(0.9, 0.9 * light.strength * light.side), shadowColor: 0x000000, shadowAlpha: 0.25 * light.strength * light.side });
  return { name: 'Lit by surroundings', library: 'tokenshade', params };
}
