// Force-field domes and light rays.
import { rgb, clamp } from './util.mjs';

const f = v => Number(v) || 0;
const domeScale = p => clamp(0.95 + 0.12 * clamp(p.gridPadding, 0, 6), 1, 1.75) * clamp(p.radius, 0.3, 3);

// A glassy bubble around the token. shieldType picks the surface pattern:
// 1 fire, 2 hexagons, 3 smoke, 4 stone plates, 5 stone crown, 6 wind, 7 arcane, 8 soap film,
// 9 water (refracts the token), 10 dark plasma, 11 grid, 12 warped space, 13 colour swirl.
const field = {
  type: 'field', order: 900,
  defaults: { shieldType: 2, gridPadding: 1.5, color: 0xcc00cc, time: 0, blend: 2, intensity: 1, lightAlpha: 0.6, lightSize: 0.5, scale: 1, radius: 1, chromatic: false, alpha: 1 },
  timeScale: 1 / 1.5,
  uniforms: {
    uType: ['int', p => clamp(Math.round(f(p.shieldType)), 1, 13)], uColor: ['vec3', p => rgb(p.color)],
    uIntensity: ['float', p => clamp(p.intensity, 0, 4) * clamp(p.alpha ?? 1, 0, 1)], uLight: ['vec2', p => [clamp(p.lightAlpha, 0, 4), clamp(p.lightSize, 0, 2)]],
    uScale: ['float', p => clamp(p.scale, 0.1, 10)], uDome: ['float', p => domeScale(p)], uChroma: ['bool', p => p.chromatic === true],
  },
  reach: (p, c) => c.size * 0.5 * domeScale(p) + 3,
  glsl: `
float hexLines(vec2 p) {
  vec2 r = vec2(1.0, 1.7320508), h = r * 0.5;
  vec2 a = mod(p, r) - h, b = mod(p - h, r) - h;
  vec2 g = dot(a, a) < dot(b, b) ? a : b;
  vec2 ag = abs(g);
  return 0.5 - max(dot(ag, normalize(vec2(1.0, 1.7320508))), ag.x);
}
vec4 pattern(vec2 s, float z, float t, vec3 col) {
  // Returns colour and opacity of the shell pattern at sphere point s (-1..1).
  vec2 q = s * 3.0 * uScale;
  int k = int(uType + 0.5);
  if (k == 1) { float n = warped(q * vec2(1.0, 0.6) + vec2(0.0, t * 1.5), t); return vec4(heatRamp(col, n), smoothstep(0.35, 0.85, n)); }
  if (k == 2) { float l = hexLines(q * 1.4); float cellPulse = 0.5 + 0.5 * sin(t * 2.0 + hash21(floor(q * 1.4)) * 6.28); return vec4(mix(col, vec3(1.0), 0.3), smoothstep(0.08, 0.0, l) * 0.9 + 0.12 * cellPulse); }
  if (k == 3) {
    // Dense smoke that fills the bubble, swirling faster toward the middle.
    float sw = t * 0.5 + (1.0 - length(s)) * 2.2;
    float n = warped(rot2(sw) * q * 0.7, t * 0.6);
    return vec4(col * (0.45 + 0.85 * n), 0.42 + 0.53 * smoothstep(0.25, 0.8, n));
  }
  if (k == 4 || k == 5) {
    // Solid stone slabs split by dark seams. The crown (5) rises out of the ground and crumbles as it climbs.
    vec2 rise = k == 5 ? vec2(0.0, t * 0.35) : vec2(0.0);
    vec3 c = cells(q * 1.1 + rise, 0.0);
    float slab = smoothstep(0.02, 0.1, c.y - c.x);
    vec3 stone = col * (0.55 + 0.45 * c.z) * (0.75 + 0.4 * gnoise((q + rise) * 6.0));
    float a = mix(0.95, 0.72, slab);
    if (k == 5) a *= smoothstep(-0.35, 0.35, s.y + 0.25 * (c.z - 0.5));
    return vec4(mix(col * 0.22, stone, slab), a);
  }
  if (k == 6) {
    // Wind streaks whirling round the dome, with dust caught in them.
    float r = length(s);
    vec2 w = rot2(t * 3.0 + r * 1.5) * s;
    vec2 dir = normalize(w + 1e-4);
    float streak = gnoise(dir * 2.2 + vec2(r * 10.0, -r * 8.0));
    float streak2 = gnoise(rot2(-t * 1.2) * dir * 3.5 + vec2(r * 16.0 + 11.0, 3.0));
    vec3 dc = cells(rot2(t * 2.4) * q * 2.2, t);
    float dust = smoothstep(0.07, 0.0, dc.x) * step(0.82, dc.z);
    return vec4(mix(col, vec3(1.0), 0.45 + 0.4 * dust), clamp(smoothstep(0.1, 0.45, streak) * 0.95 + smoothstep(0.3, 0.6, streak2) * 0.6 + dust, 0.0, 1.0));
  }
  if (k == 7) {
    float r = length(s), ang = atan(s.y, s.x);
    // Thick bands framing two rings of runes that turn opposite ways.
    float band = smoothstep(0.08, 0.03, abs(r - 1.66)) + smoothstep(0.06, 0.02, abs(r - 1.3)) + smoothstep(0.05, 0.015, abs(r - 0.98)) * 0.8;
    float a1 = (ang + t * 0.5) / TAU * 18.0, a2 = (ang - t * 0.75) / TAU * 12.0;
    float g1 = step(0.4, hash21(vec2(mod(floor(a1), 18.0), 1.0))) * step(0.2, fract(a1)) * step(fract(a1), 0.8) * smoothstep(0.1, 0.05, abs(r - 1.48));
    float g2 = step(0.35, hash21(vec2(mod(floor(a2), 12.0), 5.0))) * step(0.2, fract(a2)) * step(fract(a2), 0.8) * smoothstep(0.08, 0.035, abs(r - 1.14));
    vec3 sp = cells(q * 2.0, t * 2.0); float spark = smoothstep(0.08, 0.0, sp.x) * step(0.85, sp.z);
    float pulse = 0.75 + 0.25 * sin(t * 3.0);
    return vec4(mix(col, vec3(1.0), 0.15 + 0.35 * (g1 + g2)), clamp((band + g1 + g2) * pulse + spark, 0.0, 1.0));
  }
  if (k == 8) { float film = s.y * 2.0 + fbm3(q * 0.5 + t * 0.2) * 2.0 + z; return vec4(hsv2rgb(vec3(fract(film * 0.35), 0.6, 1.0)), 0.35); }
  if (k == 9) {
    vec3 c = cells(q * 1.2 + vec2(fbm3(q * 0.7 + t), fbm3(q * 0.7 - t + 4.0)) * 0.5, t * 3.0);
    float caustic = 1.0 - smoothstep(0.0, 0.35, c.y - c.x);
    return vec4(mix(col, vec3(0.85, 0.97, 1.0), caustic), 0.22 + caustic * 0.7);
  }
  if (k == 10) {
    // Dark plasma: a near-black body veined with glowing ridges, beating like a heart.
    float ph = fract(t * 0.7);
    float beat = exp(-pow((ph - 0.1) * 22.0, 2.0)) + 0.6 * exp(-pow((ph - 0.3) * 22.0, 2.0));
    float n = ridged(q * 0.9 + vec2(t * 0.3, -t * 0.4));
    float ridge = smoothstep(0.55, 0.95, n);
    vec3 glow = mix(col, vec3(1.0, 0.8, 0.6), ridge * 0.35) * (1.0 + beat * 0.8);
    return vec4(mix(col * 0.1, glow, ridge), 0.6 + 0.4 * ridge);
  }
  if (k == 11) { vec2 g = abs(fract(q * 1.5 + vec2(0.0, t * 0.2)) - 0.5); float l = smoothstep(0.06, 0.0, 0.5 - max(g.x, g.y)); return vec4(col, l * 0.9 + 0.08); }
  if (k == 12) { float r = length(s); float rings = 0.5 + 0.5 * sin(r * 22.0 - t * 4.0); return vec4(mix(col, vec3(1.0), 0.5), pow(rings, 4.0) * 0.5); }
  float n = warped(q * 0.6, t * 0.4);
  return vec4(hsv2rgb(vec3(rgb2hsv(col).x + n * 0.25 - 0.1, 0.7, 1.0)), 0.35 + 0.3 * n);
}
void main() {
  vec4 base = fxSample(vTextureCoord);
  float Rd = fxTokenRadius() * uDome;
  vec2 c = fxCanvas() / Rd;
  float d = length(c);
  float aa = 1.5 / (Rd * uZoom);
  float inside = smoothstep(1.0 + aa, 1.0 - aa, d);
  if (inside <= 0.0) { gl_FragColor = base; return; }
  float t = uTime;
  int k = int(uType + 0.5);
  float z = sqrt(max(1.0 - d * d, 0.0));
  vec2 s = c / (0.55 + 0.45 * z);
  // Warped space bends the view of the token through the bubble; water refracts it.
  if (k == 12) base = fxAt(-c * Rd * (1.0 - z) * 0.35 * sin(t * 1.5 + d * 6.0));
  if (k == 9) base = fxAt(vec2(gnoise(c * 3.0 + t * 0.8), gnoise(c * 3.0 - t * 0.8 + 9.0)) * Rd * 0.05 * (0.4 + z));
  float fresnel = pow(1.0 - z, 2.2);
  vec4 pat = pattern(s, z, t, uColor);
  vec3 rimCol = uChroma > 0.5 ? hsv2rgb(vec3(fract(atan(c.y, c.x) / TAU + t * 0.1), 0.7, 1.0)) : mix(uColor, vec3(1.0), 0.25);
  // Specular glint upper-left.
  float spec = smoothstep(uLight.y * 0.45 + 0.05, 0.0, length(c - vec2(-0.38, -0.42))) * uLight.x * 0.45;
  vec3 col = mix(pat.rgb, rimCol, fresnel * 0.6) + vec3(spec);
  // Smoke, stone, wind, runes and plasma fill the face of the dome; the rest gather toward its rim.
  float body = k == 3 ? 0.75 : (k == 4 || k == 5) ? 0.6 : k == 10 ? 0.7 : k == 7 ? 0.85 : k == 6 ? 0.6 : 0.25;
  float a = clamp(pat.a * (body + (1.0 - body) * fresnel) + fresnel * 0.55 + spec, 0.0, 1.0) * inside * clamp(uIntensity, 0.0, 1.5) * 0.85;
  // The creature stays readable through the front of the bubble.
  a *= mix(1.0, 0.55, base.a);
  // Smoke and plasma darken what they cover instead of only adding light.
  gl_FragColor = fxLayer(base, col, a, (k == 3 || k == 10) ? 0 : 9);
}`,
};

// Shafts of light from an anchor point. alphaDiscard keeps them on the art; otherwise
// they also spill past it. A share of plain colour keeps them visible on pale art.
const ray = {
  type: 'ray', order: 740,
  defaults: { time: 0, color: 0xcf8000, alpha: 0.5, divisor: 24, anchorX: 0, anchorY: 0, alphaDiscard: true },
  timeScale: 2,
  uniforms: {
    uColor: ['vec3', p => rgb(p.color)], uAlpha: ['float', p => clamp(p.alpha, 0, 1)],
    uCount: ['float', p => clamp(p.divisor, 1, 128)], uAnchor: ['vec2', p => [f(p.anchorX), f(p.anchorY)]], uClip: ['bool', p => p.alphaDiscard !== false],
  },
  reach: (p, c) => (p.alphaDiscard === false ? c.size * 0.32 : 0),
  glsl: `
void main() {
  vec4 base = fxSample(vTextureCoord);
  vec2 d = fxArt() - uAnchor;
  // Spilled shafts fade out before the edge of the filter's reach.
  float spill = smoothstep(1.6, 0.7, length(fxCanvas()) / fxTokenRadius());
  float ang = atan(d.y, d.x);
  float r = length(d);
  float beams = gnoise(vec2(ang * uCount / PI, uTime * 0.6)) * 0.5 + gnoise(vec2(ang * uCount * 0.5 / PI + 7.0, uTime * 0.35)) * 0.5;
  float a = smoothstep(0.0, 0.45, beams + 0.15) * smoothstep(1.6, 0.0, r) * uAlpha;
  vec3 col = mix(uColor, vec3(1.0), 0.2);
  vec4 o = fxLayer(base, uColor, a * base.a * 0.45, 0);
  o = fxLayer(o, col, a * base.a, 9);
  if (uClip < 0.5) o = fxBehind(o, col, a * spill * 0.8);
  gl_FragColor = o;
}`,
};

// Strong light rays around the token. rayType: 0 turning sunburst, 1 clover petals,
// 2 scanning bar, 3 shafts falling from the anchor, 4 hard spokes with a white-hot core.
// Beams shine past the silhouette, so they read on any art.
const xray = {
  type: 'xray', order: 740,
  defaults: { time: 0, color: 0xffb800, blend: 9, dimX: 1, dimY: 1, anchorX: 0.5, anchorY: 0.5, divisor: 24, intensity: 1, rayType: 0 },
  timeScale: 1 / 1.2,
  uniforms: {
    uColor: ['vec3', p => rgb(p.color)], uBlend: ['int', p => clamp(Math.round(f(p.blend)), 0, 14)],
    uDim: ['vec2', p => [clamp(p.dimX, 0.01, 50), clamp(p.dimY, 0.01, 50)]], uAnchor: ['vec2', p => [f(p.anchorX), f(p.anchorY)]],
    uCount: ['float', p => clamp(p.divisor, 1, 128)], uIntensity: ['float', p => clamp(p.intensity, 0, 10)],
    uKind: ['int', p => clamp(Math.round(f(p.rayType)), 0, 4)],
  },
  reach: (p, c) => c.size * (Math.round(f(p.rayType)) === 2 ? 0.12 : Math.round(f(p.rayType)) === 3 ? 0.6 : 0.45),
  glsl: `
float spokes(float ang, float n, float sharp) { return pow(0.5 + 0.5 * cos(ang * n), sharp); }
void main() {
  vec4 base = fxSample(vTextureCoord);
  float R = fxTokenRadius();
  float t = uTime;
  int kind = int(uKind + 0.5);
  int mode = int(uBlend + 0.5);
  if (mode == 0) mode = 9;
  vec3 col = uColor;
  float on, off;
  if (kind == 2) {
    // A bright bar sweeps down the art; a ghost of it trails behind in scanlines.
    vec2 art = fxArt();
    float dy = art.y - (fract(t * 0.3) * 1.5 - 0.25);
    float bar = exp(-dy * dy * 700.0);
    float lines = 0.55 + 0.45 * step(0.5, fract(fxCanvas().y / 3.0));
    float trail = (dy < 0.0 ? exp(dy * 7.0) : 0.0) * lines;
    // The bar runs a little past the silhouette on both sides.
    float side = max(max(fxAlphaAt(vec2(R * 0.12, 0.0)), fxAlphaAt(vec2(-R * 0.12, 0.0))),
                     max(fxAlphaAt(vec2(R * 0.24, 0.0)), fxAlphaAt(vec2(-R * 0.24, 0.0))) * 0.6);
    on = (bar * 1.1 + trail * 0.3) * uIntensity * 0.55;
    off = bar * side * uIntensity * 0.6;
    vec4 o = fxLayer(base, col, clamp(on, 0.0, 0.9) * base.a * 0.6, 0);
    o = fxLayer(o, mix(col, vec3(1.0), bar * 0.6), clamp(on, 0.0, 0.9) * base.a, mode);
    gl_FragColor = fxBehind(o, mix(col, vec3(1.0), 0.4), clamp(off, 0.0, 0.9));
    return;
  }
  vec2 c = (fxCanvas() - fxArtToCanvas(uAnchor)) / R / sqrt(uDim);
  float r = length(c), ang = atan(c.y, c.x);
  float beam, core;
  if (kind == 1) {
    // Petals: lobes whose tips breathe, bright along their edges.
    float lobe = abs(cos((ang + t * 0.12) * uCount * 0.5));
    float tip = 0.45 + 0.95 * pow(lobe, 1.5) * (0.88 + 0.12 * sin(t * 2.2));
    float fill = smoothstep(tip, tip - 0.5, r);
    float edge = exp(-abs(r - tip) * 14.0) * smoothstep(0.2, 0.6, lobe);
    vec3 cl = cells(c * 7.0, t * 3.0);
    float glint = smoothstep(0.1, 0.0, cl.x) * step(0.9, cl.z) * fill;
    beam = fill * 0.45 + edge * 0.9 + glint;
    core = smoothstep(0.4, 0.0, r);
    col = mix(col, vec3(1.0), edge * 0.35 + glint * 0.7);
  } else if (kind == 3) {
    // Shafts falling in a cone from the anchor, drifting sideways.
    float down = ang - PI * 0.5;
    float cone = smoothstep(0.95, 0.35, abs(down));
    float shafts = gnoise(vec2(down * uCount * 0.35 + t * 0.25, t * 0.15)) + 0.5 * gnoise(vec2(down * uCount * 0.9 - t * 0.1, 3.0));
    beam = smoothstep(0.0, 0.5, shafts + 0.15) * cone * smoothstep(3.2, 0.6, r) * smoothstep(2.15, 1.5, length(fxCanvas()) / R);
    core = 0.0;
  } else if (kind == 4) {
    // Hard spokes, turning fast, with a flickering white-hot core.
    beam = spokes(ang + t * 1.3, uCount, 26.0) * (0.85 + 0.15 * sin(t * 25.0)) * smoothstep(1.85, 0.25, r);
    beam += spokes(ang - t * 0.7, uCount * 2.0, 40.0) * 0.5 * smoothstep(1.4, 0.2, r);
    core = smoothstep(0.75, 0.0, r);
    col = mix(col, vec3(1.0), core * 0.8);
  } else {
    // Soft beams turning slowly around a glowing core.
    beam = spokes(ang + t * 0.35, uCount, 3.0) * (0.6 + 0.4 * gnoise(vec2(ang * 3.0, r * 4.0 - t))) * smoothstep(1.9, 0.3, r);
    core = smoothstep(0.55, 0.0, r) * (0.85 + 0.15 * sin(t * 3.0));
    col = mix(col, vec3(1.0), core * 0.5);
  }
  on = clamp((beam + core * 0.4) * uIntensity * 0.22, 0.0, 0.85);
  off = clamp((beam + core * 0.6) * uIntensity * 0.3, 0.0, 0.85);
  vec4 o = fxLayer(base, col, on * base.a, mode);
  gl_FragColor = fxBehind(o, col, off);
}`,
};

export const FIELD_SPECS = [field, ray, xray];
