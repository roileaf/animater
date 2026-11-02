// Creatures lit by their surroundings (the "Creatures lit by their surroundings" setting): a creature near a light —
// a torch, a brazier, a glowing spell (Animater's effect lights are real Foundry lights too) — takes on the light's
// colour and catches a rim of it on the side that faces it. Strongest in the dark; nothing in full daylight.

const rgb = (c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
const hex = ([r, g, b]) => (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
// A warm torch when the light gives no colour of its own.
export const PLAIN_LIGHT = 0xffd9a0;

// A light's bright radius (pixels; half its reach when not given, as a torch's).
const brightOf = (l, reach) => Math.min(reach, Math.max(0, Number(l.bright ?? reach / 2) || 0));
// How brightly one light shines `d` pixels from it (0 to 1.5), from Foundry's own settings: full in its bright
// radius, fading out across its dim light from half (its `attenuation` 0–1: 0 a hard edge holding its light, 1 soft,
// fading early); times its `luminosity` (0.5 Foundry's plain light, 1 half again as bright, 0 half, below 0 a light
// that darkens: none). Its colour intensity (`alpha`) only tints.
export function lightShine(l, d, reach = Number(l.radius) || 0) {
  if (!(reach > 0) || d >= reach) return 0;
  const lum = Number(l.luminosity ?? 0.5), att = Math.min(1, Math.max(0, Number(l.attenuation ?? 0.5) || 0));
  if (!(lum >= 0)) return 0;
  const bright = brightOf(l, reach);
  const fade = d <= bright ? 1 : 0.5 * (1 - (d - bright) / Math.max(1, reach - bright)) ** (0.5 + 2 * att);
  return fade * Math.min(1.5, 0.5 + lum);
}

// How bright a light is this moment against its steady self (about 0.5 to 1.4), as Foundry animates it, or null for
// a light that holds steady (no animation, or one that only moves its colour: fog, starlight, chroma…). `animation`
// is the light source's animation state ({ intensity, time }), `uniforms` its illumination shader's: a torch, flame or
// siren flickers by Foundry's own brightnessPulse (0.55 to 1, past it for a fierce torch), a pulse swells and ebbs by its wave.
export function lightFlicker(type, animation = {}, uniforms = {}) {
  if (type === 'pulse') {
    const i = (10 - (Number(animation.intensity) || 5)) * 0.1, w = 0.5 * (Math.cos((Number(animation.time) || 0) * 2.5) + 1);
    return 1 - 0.5 * (1 - i) * (1 - w);
  }
  if (!['torch', 'flame', 'siren'].includes(type)) return null;
  const pulse = Number(uniforms.brightnessPulse);
  return Number.isFinite(pulse) ? Math.min(1.4, Math.max(0.5, 1 + 0.6 * ((pulse - 0.55) / 0.45 - 0.5))) : 1;
}

// A light's dance this moment: { brightness (lightFlicker), sway -1 to 1 }, or null for a steady light. A torch,
// flame or siren sways side to side on Foundry's own animation clock (its time runs with the light's speed), more the
// fiercer it burns (intensity 5 a full sway); a pulse only swells.
export function lightDance(type, animation = {}, uniforms = {}) {
  const brightness = lightFlicker(type, animation, uniforms);
  if (brightness === null) return null;
  if (type === 'pulse') return { brightness, sway: 0 };
  const time = Number(animation.time) || 0, amount = Math.min(1, (Number(animation.intensity) || 5) / 5);
  return { brightness, sway: amount * (0.6 * Math.sin(time * 2.3) + 0.4 * Math.sin(time * 5.9 + 1.3)) };
}

// The light reaching a point: { color, strength 0–1, angle (degrees, from the creature toward the light) }, or null.
// `lights`: [{ x, y, radius, color, alpha, elevation }] that reach the point (walls already tested); `darkness` 0–1.
// Also `elevation` and `distance` (pixels): the lights' height and how far they are, weighted as the colour is, and
// `brightness` 0–1: 1 inside a light's bright radius (`bright`, pixels), 0.5 fading to 0.2 across its dim light.
// `strength` is how much its colour shows (a light's `alpha` is Foundry's colour intensity), `shine` how much it lights
// the creature whatever its colour: PF2e's Light spell (colour intensity 0.05) shines as bright as a torch, barely tinting.
export function lightAround(point, lights = [], darkness = 1) {
  let total = 0, shone = 0, r = 0, g = 0, b = 0, dx = 0, dy = 0, up = 0, far = 0, lit = 0;
  for (const l of lights) {
    const d = Math.hypot(l.x - point.x, l.y - point.y), reach = Number(l.radius) || 0;
    if (!(reach > 0) || d >= reach) continue;
    const s = lightShine(l, d, reach), w = s * Math.min(1, Math.max(0, l.alpha ?? 0.5) * 2);
    if (!(s > 0)) continue;
    const [cr, cg, cb] = rgb(Number.isFinite(l.color) ? l.color : PLAIN_LIGHT);
    r += cr * w; g += cg * w; b += cb * w; total += w; shone += s;
    up += (Number(l.elevation) || 0) * s; far += d * s;
    const bright = brightOf(l, reach);
    lit += (d <= bright ? 1 : 0.5 - 0.3 * ((d - bright) / Math.max(1, reach - bright))) * s;
    if (d > 1) { dx += ((l.x - point.x) / d) * s; dy += ((l.y - point.y) / d) * s; }
  }
  const dark = Math.min(1, Math.max(0, darkness)), strength = Math.min(1, total) * dark, shine = Math.min(1, shone) * dark;
  if (shine < 0.08) return null;
  const pull = Math.hypot(dx, dy) / shone, mix = total > 0 ? total : 1;
  return {
    color: total > 0 ? hex([r / mix, g / mix, b / mix]) : PLAIN_LIGHT, strength, shine,
    // A creature between lights on all sides has no lit side (the rim fades with how one-sided the light is).
    angle: pull > 0.15 ? (Math.atan2(dy, dx) * 180) / Math.PI : null, side: Math.min(1, pull),
    elevation: up / shone, distance: far / shone, brightness: lit / shone,
  };
}

// Rounded so a creature only re-lights on a change worth seeing (light flicker and small steps keep it as it is).
export function litKey(light) {
  // A light whose colour barely shows leaves the creature as it is.
  if (!light || light.strength < 0.08) return null;
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
