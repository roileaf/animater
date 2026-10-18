// Elemental effects: fire, lightning, smoke, fog, water, webs, fireflies.
// Everything grows from the token's silhouette and keeps the creature readable.
import { rgb, clamp } from './util.mjs';

const f = v => Number(v) || 0;
const blendU = ['int', p => clamp(Math.round(f(p.blend)), 0, 14)];

const SILHOUETTE = `
// How strongly art lies below this pixel within 'height' canvas px, leaning with 'sway'.
float fuelBelow(float height, float sway) {
  float fuel = 0.0, jit = fxJitter();
  for (int k = 0; k < 14; k++) {
    float d = (float(k) + jit) / 14.0;
    fuel = max(fuel, fxAlphaAt(vec2(-sway * d, d * height)) * pow(1.0 - d, 1.3));
  }
  return fuel;
}
// Art within 'radius' in any direction (soft), for edge-hugging effects.
float near(float radius) {
  float m = 0.0, d = fxJitter() * TAU;
  for (int k = 0; k < 10; k++) {
    float ang = d + TAU * float(k) / 10.0;
    m = max(m, fxAlphaAt(vec2(cos(ang), sin(ang)) * radius));
  }
  return m;
}
// 1 deep inside the art, 0 at its edge.
float depthIn(float radius) {
  float m = 1.0, d = fxJitter() * TAU + 0.4;
  for (int k = 0; k < 8; k++) {
    float ang = d + TAU * float(k) / 8.0;
    m = min(m, fxAlphaAt(vec2(cos(ang), sin(ang)) * radius));
  }
  return m;
}
`;
const FIRE_COLOR = `
vec3 naturalFire(float h) {
  vec3 c = mix(vec3(0.16, 0.03, 0.02), vec3(0.78, 0.13, 0.02), smoothstep(0.0, 0.3, h));
  c = mix(c, vec3(1.0, 0.47, 0.07), smoothstep(0.25, 0.6, h));
  return mix(c, vec3(1.0, 0.92, 0.62), smoothstep(0.58, 0.97, h));
}
bool isWhite(vec3 c) { return min(c.r, min(c.g, c.b)) > 0.96; }
`;

// Flames rising off the silhouette. fireBlend 0 keeps them behind the art; 1 lets tongues
// lick over it. alphaDiscard keeps the fire on the art only.
const fire = {
  type: 'fire', order: 800,
  defaults: { intensity: 1, color: 0xffffff, amplitude: 1, time: 0, blend: 2, fireBlend: 1, alphaDiscard: false },
  timeScale: -1 / 2.4,
  uniforms: {
    uIntensity: ['float', p => clamp(p.intensity, 0, 5)], uColor: ['vec3', p => rgb(p.color)],
    uAmp: ['float', p => clamp(p.amplitude, 0.1, 4)], uBlend: blendU,
    uOver: ['float', p => clamp(p.fireBlend, 0, 1)], uClip: ['bool', p => p.alphaDiscard === true],
  },
  // Flames rise at most H (0.45 size × amplitude) above the art, plus the nearness ring.
  reach: (p, c) => c.size * (0.45 * clamp(p.amplitude, 0.1, 4) + 0.06),
  // x: fuel below and around, y: depth inside the art.
  field: { glsl: `${SILHOUETTE}
vec4 field() {
  float R = fxTokenRadius();
  float H = R * 0.9 * uAmp;
  vec2 q = fxCanvas() / (R * 0.2);
  float sway = fbm3(vec2(q.x * 0.3, q.y * 0.12 + uTime * 0.4)) * 0.5 * H;
  float fuel = uClip > 0.5 ? 0.0 : max(fuelBelow(H, sway), near(R * 0.09) * 0.7);
  return vec4(fuel, depthIn(R * 0.1), 0.0, 0.0);
}` },
  glsl: `${FIRE_COLOR}
void main() {
  vec4 base = fxSample(vTextureCoord);
  vec4 shape = fxField();
  float fuel = shape.x;
  // Off the art with no fuel nothing can show (heat stays under the flame threshold).
  if (base.a <= 0.0 && (uClip > 0.5 || fuel < 0.02)) { gl_FragColor = vec4(0.0); return; }
  float R = fxTokenRadius();
  vec2 q = fxCanvas() / (R * 0.2);
  float t = uTime;
  vec2 fq = q * vec2(1.0, 0.55);
  vec2 w = vec2(fbm3(fq * 0.7 + vec2(0.0, t * 0.9)), fbm3(fq * 0.7 + vec2(5.2, t * 0.9 + 1.3)));
  float n = fbm(fq + w * 1.4 + vec2(0.0, t * 1.6)) + 0.5;
  float n2 = fbm3(fq * 2.3 + w + vec2(3.1, t * 2.7)) + 0.5;
  float power = 0.4 + 0.3 * uIntensity;
  float heat = fuel * power + (n - 0.5) + (n2 - 0.5) * 0.35 - 0.1;
  heat = clamp(heat, 0.0, 1.0) * smoothstep(0.0, 0.2, fuel);
  float a = smoothstep(0.04, 0.3, heat);
  float h = heat * heat * 0.6 + heat * 0.4;
  vec3 col = isWhite(uColor) ? naturalFire(h) : heatRamp(uColor, h);
  col *= 0.85 + 0.35 * smoothstep(0.6, 1.0, heat);
  float inner = shape.y;
  if (uClip > 0.5) {
    // Fire on the art only: tongues crawl over it.
    float lick = n * 0.75 + n2 * 0.45 + (1.0 - inner) * 0.3;
    float on = base.a * smoothstep(0.55, 0.85, lick);
    vec3 c2 = isWhite(uColor) ? naturalFire(smoothstep(0.5, 1.1, lick) * 0.85) : heatRamp(uColor, smoothstep(0.5, 1.1, lick) * 0.85);
    gl_FragColor = fxLayer(base, c2, on * clamp(uIntensity * 0.6, 0.2, 1.0), int(uBlend + 0.5));
    return;
  }
  // Warm light on the art's rim, flames behind, hottest tongues over the art.
  vec3 lit = unpremul(base) + naturalFire(0.55) * (1.0 - inner) * 0.35 * n;
  vec4 o = vec4(lit * base.a, base.a);
  o = fxBehind(o, col, a);
  float tongues = smoothstep(0.66, 0.9, n * 0.75 + n2 * 0.45 + (1.0 - inner) * 0.3);
  o = fxLayer(o, col, a * tongues * 0.75 * uOver * base.a, int(uBlend + 0.5));
  gl_FragColor = o;
}`,
};

// Stylised magical fire. color 0 → natural flames. inlay: the fire burns inside the art
// (frost creeping, heat shimmering). chromatic: shifting rainbow flames. dispersion: sparks.
const xfire = {
  type: 'xfire', order: 800,
  defaults: { color: 0, blend: 1, amplitude: 1, dispersion: 0, chromatic: false, inlay: false, scaleX: 1, scaleY: 1, time: 0, alphaDiscard: false, discardThreshold: 0.35 },
  timeScale: -1 / 1.5,
  uniforms: {
    uColor: ['vec3', p => rgb(p.color)], uNatural: ['bool', p => !(f(p.color) > 0 || Array.isArray(p.color))],
    uBlend: blendU, uAmp: ['float', p => clamp(p.amplitude, 0.05, 4)], uSparks: ['float', p => clamp(p.dispersion, -2, 6)],
    uChroma: ['bool', p => p.chromatic === true], uInlay: ['bool', p => p.inlay === true],
    uScale: ['vec2', p => [clamp(p.scaleX, 0.1, 10), clamp(p.scaleY, 0.1, 10)]],
    uClip: ['bool', p => p.alphaDiscard === true], uCut: ['float', p => clamp(p.discardThreshold, 0, 1)],
  },
  // Sparks rise at most 1.15 H (0.49 size × amplitude) above the art, plus the nearness ring.
  reach: (p, c) => (p.inlay === true ? 0 : c.size * (0.49 * clamp(p.amplitude, 0.05, 4) + 0.055)),
  // x: fuel, y: depth inside the art, w: fuel for sparks.
  field: { glsl: `${SILHOUETTE}
vec4 field() {
  float R = fxTokenRadius();
  if (uInlay > 0.5) return vec4(0.0, depthIn(R * 0.12), 0.0, 0.0);
  vec2 q = fxCanvas() / (R * 0.16) / uScale;
  float H = R * 0.85 * uAmp;
  float sway = fbm3(vec2(q.x * 0.25, q.y * 0.1 + uTime * 0.5)) * 0.45 * H;
  float fuel = uClip > 0.5 ? 0.0 : max(fuelBelow(H, sway), near(R * 0.08) * 0.65);
  float sparks = uSparks > 0.0 && uClip < 0.5 ? fuelBelow(H * 1.15, 0.0) : 0.0;
  return vec4(fuel, depthIn(R * 0.1), 0.0, sparks);
}` },
  glsl: `${FIRE_COLOR}
vec3 flameColor(float h, vec2 q) {
  if (uChroma > 0.5) return hsv2rgb(vec3(fract(q.y * 0.05 + uTime * 0.15 + h * 0.2), 0.75, 0.4 + 0.7 * h));
  if (uNatural > 0.5) return naturalFire(h);
  return heatRamp(uColor, h);
}
void main() {
  vec4 base = fxSample(vTextureCoord);
  vec4 shape = fxField();
  // Off the art, inlaid or clipped fire is nothing; free flames need fuel (or sparks).
  if (base.a <= 0.0 && (uInlay > 0.5 || uClip > 0.5 || (shape.x < 0.02 && shape.w < 0.003))) { gl_FragColor = vec4(0.0); return; }
  float R = fxTokenRadius();
  float t = uTime;
  vec2 q = fxCanvas() / (R * 0.16) / uScale;
  int mode = int(uBlend + 0.5);
  if (uInlay > 0.5) {
    // Burning (or freezing) inside the art: veins of colour crawl across it.
    float v = ridged(q * 0.8 + vec2(0.0, t * 0.8) + fbm3(q * 0.4 - t * 0.2) * 1.5);
    float edge = 1.0 - shape.y;
    float amt = clamp(smoothstep(0.42, 0.85, v) * (0.65 + 0.35 * uAmp) + edge * 0.55, 0.0, 1.0);
    vec3 col = flameColor(clamp(v * 1.2, 0.0, 1.0), q);
    gl_FragColor = fxLayer(base, col, amt * base.a * 0.9, mode == 11 ? 4 : 9);
    return;
  }
  float fuel = shape.x;
  // Sharper, braided tongues than natural fire.
  vec2 fq = q * vec2(1.0, 0.45) + vec2(0.0, t * 2.0);
  float braid = ridged(fq + vec2(fbm3(fq * 0.5 + t * 0.3), 0.0) * 1.2);
  float heat = clamp(fuel * 0.85 + (braid - 0.62) * 1.6, 0.0, 1.0) * smoothstep(0.0, 0.2, fuel);
  float a = smoothstep(0.05, 0.3, heat);
  // Sparks: bright points rising and fading above the flames.
  if (uSparks > 0.0) {
    vec2 sq = fxCanvas() / (R * 0.07) + vec2(0.0, t * 6.0);
    vec3 cl = cells(sq, t * 2.0);
    float spark = smoothstep(0.12, 0.0, cl.x) * step(0.82 - uSparks * 0.05, cl.z) * smoothstep(0.0, 0.3, shape.w);
    heat = max(heat, spark);
    a = max(a, spark);
  }
  vec3 col = flameColor(heat, q);
  // Blackfire: smoky dark flames with a violet edge, never a solid block.
  if (mode == 11) { col = mix(vec3(0.03, 0.0, 0.05), uColor * 0.9, smoothstep(0.1, 0.45, heat) * (1.0 - smoothstep(0.55, 0.9, heat))); a *= 0.8 * smoothstep(0.0, 0.5, braid); }
  if (uClip > 0.5) {
    float edgeIn = 1.0 - shape.y;
    float lick = braid * 0.7 + edgeIn * 0.35;
    float on = base.a * smoothstep(uCut + 0.15, uCut + 0.45, lick) * 0.9;
    gl_FragColor = fxLayer(base, flameColor(smoothstep(0.45, 1.05, lick) * 0.85, q), on, mode == 11 ? 0 : 9);
    return;
  }
  vec4 o = fxBehind(base, col, a);
  float inner = shape.y;
  float tongues = smoothstep(0.7, 0.92, braid * 0.8 + (1.0 - inner) * 0.35);
  o = fxLayer(o, col, a * tongues * 0.7 * base.a, mode == 11 ? 0 : 9);
  gl_FragColor = o;
}`,
};

// Arcs of lightning skittering over the body, with a faint charged halo.
const electric = {
  type: 'electric', order: 820,
  defaults: { color: 0xffffff, time: 0, blend: 1, intensity: 4 },
  timeScale: 1 / 2,
  uniforms: { uColor: ['vec3', p => rgb(p.color)], uBlend: blendU, uIntensity: ['float', p => clamp(p.intensity, 0, 20)] },
  reach: (p, c) => c.size * 0.12,
  // x: art nearby.
  field: { phases: 2, glsl: `${SILHOUETTE}
vec4 field() { return vec4(near(fxTokenRadius() * 0.1), 0.0, 0.0, 0.0); }` },
  glsl: `
vec2 arc(vec2 q, float t, float seed) {
  // A wandering line: the zero set of a warped noise field. x = core, y = glow.
  float jump = floor(t * 7.0 + seed);
  vec2 o = vec2(hash11(jump + seed) * 50.0, hash11(jump * 1.7 + seed) * 50.0);
  float n = fbm(q + o + vec2(fbm3(q * 1.7 + o) * 0.6, 0.0)) + gnoise(q * 6.0 + o) * 0.04;
  float on = step(0.45, hash11(jump * 3.1 + seed));
  float width = 0.018 + 0.016 * hash11(jump + 3.0);
  return vec2(smoothstep(width, width * 0.2, abs(n)), smoothstep(width * 6.0, 0.0, abs(n)) * 0.3) * on;
}
void main() {
  vec4 base = fxSample(vTextureCoord);
  float surround = fxField().x;
  // No art here or nearby: no arcs, no halo.
  if (base.a <= 0.0 && surround < 0.001) { gl_FragColor = vec4(0.0); return; }
  float R = fxTokenRadius();
  vec2 q = fxCanvas() / (R * 0.45);
  float t = uTime;
  vec2 b1 = arc(q, t, 1.0), b2 = arc(q * 1.3 + 7.0, t * 1.1, 11.0), b3 = arc(q * 0.8 - 3.0, t * 0.9, 23.0);
  float bolt = max(max(b1.x, b2.x * 0.85), b3.x * 0.75);
  float glowB = max(max(b1.y, b2.y), b3.y);
  float k = clamp(uIntensity * 0.2, 0.0, 1.2);
  float region = max(base.a, surround * 0.85);
  float onArt = (bolt + glowB * 0.5) * region * k;
  float flicker = 0.75 + 0.25 * hash11(floor(t * 20.0));
  vec3 core = mix(uColor, vec3(1.0), bolt * 0.7);
  float halo = surround * (1.0 - base.a) * 0.18 * k * flicker;
  vec4 o = fxBehind(base, uColor, halo);
  o = fxLayer(o, core, clamp(onArt * flicker, 0.0, 1.0), int(uBlend + 0.5) == 0 ? 0 : 9);
  gl_FragColor = o;
}`,
};

// Smoke clinging to the body and drifting up (sinking when time runs backward).
const smoke = {
  type: 'smoke', order: 780,
  defaults: { color: 0x9a9a9a, time: 0, blend: 2, dimX: 1, dimY: 1, alpha: 1 },
  timeScale: 1 / 9 * 2.2,
  uniforms: {
    uColor: ['vec3', p => rgb(p.color)], uBlend: blendU,
    uDim: ['vec2', p => [clamp(p.dimX, 0.05, 10), clamp(p.dimY, 0.05, 10)]], uAlpha: ['float', p => clamp(p.alpha, 0, 1)],
  },
  reach: (p, c) => c.size * 0.35,
  // x: art below and around.
  field: { phases: 2, glsl: `${SILHOUETTE}
vec4 field() { float R = fxTokenRadius(); return vec4(max(fuelBelow(R * 0.7, 0.0), near(R * 0.2) * 0.8), 0.0, 0.0, 0.0); }` },
  glsl: `
void main() {
  vec4 base = fxSample(vTextureCoord);
  float fuel = fxField().x;
  // Without art below or around there is no smoke.
  if (fuel < 0.001) { gl_FragColor = vec4(unpremul(base) * base.a, base.a); return; }
  float R = fxTokenRadius();
  vec2 q = fxCanvas() / (R * 0.35) * vec2(1.0 / max(uDim.x, 0.2), 1.0 / max(uDim.y, 0.2)) * 0.7;
  float t = uTime;
  float n = warped(q + vec2(0.0, t * 0.8), t * 0.6);
  float density = smoothstep(0.35, 0.85, n) * fuel;
  // Thin over the art so the creature stays readable; thicker around it.
  float a = density * mix(0.85, 0.4, base.a) * uAlpha;
  vec3 col = uColor * (0.75 + 0.45 * n);
  gl_FragColor = fxLayer(base, col, a, int(uBlend + 0.5) == 2 ? 2 : int(uBlend + 0.5));
}`,
};

// Fine filaments of vapour weaving around the edges.
const fumes = {
  type: 'fumes', order: 780,
  defaults: { color: 0x808080, time: 0, blend: 8, alpha: 1 },
  timeScale: 1,
  uniforms: { uColor: ['vec3', p => rgb(p.color)], uBlend: blendU, uAlpha: ['float', p => clamp(p.alpha, 0, 1)] },
  reach: (p, c) => c.size * 0.25,
  // x: art around, y: depth inside it.
  field: { phases: 2, glsl: `${SILHOUETTE}
vec4 field() { float R = fxTokenRadius(); return vec4(near(R * 0.25), depthIn(R * 0.18), 0.0, 0.0); }` },
  glsl: `
void main() {
  vec4 base = fxSample(vTextureCoord);
  vec4 shape = fxField();
  if (shape.x < 0.001) { gl_FragColor = vec4(unpremul(base) * base.a, base.a); return; }
  float R = fxTokenRadius();
  vec2 q = fxCanvas() / (R * 0.3);
  float t = uTime;
  vec2 w = vec2(fbm3(q * 0.5 + t * 0.15), fbm3(q * 0.5 - t * 0.12 + 3.0));
  float n = fbm3(q * 0.7 + w * 1.6 + vec2(0.0, t * 0.35));
  float strands = 1.0 - abs(n) * 3.0;
  float fil = smoothstep(0.6, 0.97, strands) * (0.5 + 0.5 * gnoise(q * 0.4 + t * 0.1));
  float around = shape.x;
  float edge = 1.0 - shape.y;
  float a = fil * around * mix(0.9, 0.2 + 0.6 * edge, base.a) * 0.7 * uAlpha;
  gl_FragColor = fxLayer(base, uColor * (0.8 + 0.4 * strands), a, int(uBlend + 0.5) == 8 ? 2 : int(uBlend + 0.5));
}`,
};

// Rolling fog over and around the token.
const fog = {
  type: 'fog', order: 760,
  defaults: { color: 0x000000, density: 0.5, time: 0, dimX: 1, dimY: 1 },
  timeScale: 1 / 2200,
  uniforms: { uColor: ['vec3', p => rgb(p.color)], uDensity: ['float', p => clamp(p.density, 0, 1)], uDim: ['vec2', p => [clamp(p.dimX, 0.05, 10), clamp(p.dimY, 0.05, 10)]] },
  reach: (p, c) => c.size * 0.3,
  // x: art around.
  field: { phases: 2, glsl: `${SILHOUETTE}
vec4 field() { return vec4(near(fxTokenRadius() * 0.3), 0.0, 0.0, 0.0); }` },
  glsl: `
void main() {
  vec4 base = fxSample(vTextureCoord);
  float around = fxField().x;
  if (around < 0.001) { gl_FragColor = vec4(unpremul(base) * base.a, base.a); return; }
  float R = fxTokenRadius();
  vec2 q = fxCanvas() / (R * 0.5) / uDim;
  float n = warped(q, uTime * 0.35);
  float a = smoothstep(0.25, 0.8, n) * uDensity * around * mix(1.0, 0.55, base.a);
  gl_FragColor = fxLayer(base, uColor + vec3(0.06) * n, a, 0);
}`,
};

// Thick, slowly churning fog or living fluid.
const xfog = {
  type: 'xfog', order: 760,
  defaults: { color: 0x3090ff, time: 0, density: 0.75, alphaDiscard: false },
  timeScale: 1 / 0.65,
  uniforms: { uColor: ['vec3', p => rgb(p.color)], uDensity: ['float', p => clamp(p.density, 0, 1)], uClip: ['bool', p => p.alphaDiscard === true] },
  reach: (p, c) => (p.alphaDiscard === true ? 0 : c.size * 0.3),
  // x: where the fog may be.
  field: { phases: 2, glsl: `${SILHOUETTE}
vec4 field() { return vec4(uClip > 0.5 ? 0.0 : near(fxTokenRadius() * 0.3), 0.0, 0.0, 0.0); }` },
  glsl: `
void main() {
  vec4 base = fxSample(vTextureCoord);
  float region = uClip > 0.5 ? base.a : fxField().x;
  if (region < 0.001) { gl_FragColor = vec4(unpremul(base) * base.a, base.a); return; }
  float R = fxTokenRadius();
  vec2 q = fxCanvas() / (R * 0.4);
  float t = uTime;
  float n = warped(q * 0.9, t * 0.5);
  float billow = smoothstep(0.3, 0.75, n);
  float shade = 0.55 + 0.6 * smoothstep(0.4, 0.95, warped(q * 1.7 + 4.0, t * 0.7));
  vec3 col = uColor * shade;
  float a = billow * region * uDensity * mix(1.0, 0.7, base.a);
  gl_FragColor = fxLayer(base, col, a, 0);
}`,
};

// Water washing over the art: caustic light, tint and glints.
const flood = {
  type: 'flood', order: 760,
  defaults: { time: 0, color: 0x0020bb, billowy: 0.4, tintIntensity: 0.6, glint: 0.3, scale: 70 },
  timeScale: 1 / 0.6,
  uniforms: {
    uColor: ['vec3', p => rgb(p.color)], uBillow: ['float', p => clamp(p.billowy, 0, 1)],
    uTint: ['float', p => clamp(p.tintIntensity, 0, 1)], uGlint: ['float', p => clamp(p.glint, 0, 1)], uScale: ['float', p => clamp(p.scale, 5, 1000)],
  },
  reach: () => 0,
  glsl: `
void main() {
  vec2 q = fxCanvas() / uScale * 2.0;
  float t = uTime;
  vec2 wob = vec2(fbm3(q + t * 0.3), fbm3(q.yx - t * 0.25)) * uBillow * 6.0;
  vec4 base = fxAt(wob);
  if (base.a <= 0.0) { gl_FragColor = vec4(0.0); return; }
  vec3 cl = cells(q * 1.6 + wob * 0.05, t * 1.2);
  float caustic = 1.0 - smoothstep(0.0, 0.14, cl.y - cl.x);
  vec3 col = unpremul(base);
  col = mix(col, mix(col, uColor * (0.4 + luma(col)), 0.7), uTint * 0.8);
  col += caustic * 0.28 * mix(uColor, vec3(1.0), 0.65);
  float g = pow(max(0.0, gnoise(q * 3.0 + t * 0.7) * 1.5), 10.0) * uGlint * 3.0;
  col += g;
  gl_FragColor = vec4(clamp(col, 0.0, 1.0) * base.a, base.a);
}`,
};

// Flowing liquid colour; spectral turns it into a ghostly, see-through shimmer.
const liquid = {
  type: 'liquid', order: 750,
  defaults: { color: 0x20aaee, time: 0, blend: 8, intensity: 4, spectral: false, scale: 1, alphaDiscard: true },
  timeScale: 1,
  uniforms: {
    uColor: ['vec3', p => rgb(p.color)], uBlend: blendU, uIntensity: ['float', p => clamp(p.intensity, 0, 20)],
    uSpectral: ['bool', p => p.spectral === true], uScale: ['float', p => clamp(p.scale, 0.05, 20)],
  },
  reach: () => 0,
  glsl: `
void main() {
  float R = fxTokenRadius();
  vec2 q = fxCanvas() / (R * 0.5) * uScale;
  float t = uTime;
  vec2 flow = vec2(fbm(q + vec2(t * 0.4, 0.0)), fbm(q * 1.2 + vec2(0.0, -t * 0.35) + 5.0));
  float k = clamp(uIntensity / 4.0, 0.0, 3.0);
  vec4 base = fxAt(flow * R * 0.06 * k);
  if (base.a <= 0.0) { gl_FragColor = vec4(0.0); return; }
  float swirl = warped(q * 0.8 + flow, t * 0.5);
  vec3 col = unpremul(base);
  if (uSpectral > 0.5) {
    // Ghostly: the art keeps its detail, drained toward the spirit colour and see-through.
    vec3 ghost = mix(col, uColor * (0.35 + 1.1 * luma(col)), 0.65) * (0.85 + 0.35 * swirl);
    float a = base.a * (0.5 + 0.3 * swirl);
    gl_FragColor = vec4(ghost * a, a);
    return;
  }
  vec3 tint = uColor * (0.6 + 0.8 * swirl);
  vec3 mixed = blendMode(int(uBlend + 0.5) == 8 ? 5 : int(uBlend + 0.5), col, tint);
  float amt = clamp(0.2 + 0.08 * k, 0.0, 0.5);
  gl_FragColor = vec4(mix(col, mixed, amt) * base.a, base.a);
}`,
};

// Rings of light pulsing outward from the token like a disturbed sun.
const ripples = {
  type: 'ripples', order: 740,
  defaults: { color: 0xff8800, time: 0, alphaDiscard: false, intensity: 1 },
  timeScale: 2,
  uniforms: { uColor: ['vec3', p => rgb(p.color)], uClip: ['bool', p => p.alphaDiscard === true], uIntensity: ['float', p => clamp(p.intensity, 0, 4)] },
  reach: (p, c) => (p.alphaDiscard === true ? 0 : c.size * 0.4),
  // x: art around.
  field: { phases: 2, glsl: `${SILHOUETTE}
vec4 field() { return vec4(uClip > 0.5 ? 0.0 : near(fxTokenRadius() * 0.35), 0.0, 0.0, 0.0); }` },
  glsl: `
void main() {
  vec4 base = fxSample(vTextureCoord);
  float region = uClip > 0.5 ? base.a : max(base.a, fxField().x);
  if (region < 0.001) { gl_FragColor = vec4(unpremul(base) * base.a, base.a); return; }
  float R = fxTokenRadius();
  vec2 c = fxCanvas();
  float d = length(c) / R;
  float ang = atan(c.y, c.x);
  float wob = fbm3(vec2(ang * 1.5, uTime * 0.3)) * 0.25;
  float ring = 0.5 + 0.5 * sin((d + wob) * 14.0 - uTime * 4.0);
  ring = pow(ring, 3.0);
  float fall = 1.0 - smoothstep(0.6, 1.5, d);
  float a = ring * fall * region * 0.6 * uIntensity;
  gl_FragColor = fxLayer(base, mix(uColor, vec3(1.0), ring * 0.3), a, 9);
}`,
};

// A splatter of liquid across the art (blood, ichor, paint).
const splash = {
  type: 'splash', order: 760,
  defaults: { color: 0x900505, time: 0, seed: 0.1, splashFactor: 4, spread: 6, blend: 2, dimX: 1, dimY: 1, cut: true, textureAlphaBlend: true },
  timeScale: 1 / 0.9,
  uniforms: {
    uColor: ['vec3', p => rgb(p.color)], uSeedP: ['float', p => f(p.seed)], uSpikes: ['float', p => clamp(p.splashFactor, 1, 20)],
    uSpread: ['float', p => clamp(p.spread, 0.5, 40)], uDim: ['vec2', p => [clamp(p.dimX, 0.1, 10), clamp(p.dimY, 0.1, 10)]],
    uCut: ['bool', p => p.cut !== false],
  },
  reach: (p, c) => (p.cut !== false ? 0 : c.size * 0.4),
  glsl: `
void main() {
  vec4 base = fxSample(vTextureCoord);
  float R = fxTokenRadius();
  float s = uSeedP * 97.0;
  vec2 c = (fxCanvas() / (R * uDim) - (vec2(hash11(s), hash11(s + 1.7)) - 0.5) * 0.5) * 1.6;
  float ang = atan(c.y, c.x);
  float d = length(c);
  // Ragged outline: spikes plus noise; satellite droplets around it.
  float edge = 0.35 + 0.1 * uSpread / 10.0 + 0.18 * pow(abs(sin(ang * uSpikes * 0.5 + s)), 6.0) + 0.08 * gnoise(vec2(ang * 3.0, s));
  float blob = smoothstep(edge + 0.02, edge - 0.02, d);
  vec3 drops = cells(c * 5.0 + s, 0.0);
  float droplets = smoothstep(0.18, 0.1, drops.x) * step(0.7, drops.z) * smoothstep(1.1, 0.4, d);
  // Slow drip.
  float drip = smoothstep(0.03, 0.0, abs(fract(c.x * 4.0 + s) - 0.5) - 0.02) * step(hash11(floor(c.x * 4.0 + s)), 0.35)
             * smoothstep(edge, edge + 0.25 * fract(uTime * 0.05 + hash11(floor(c.x * 4.0))), c.y) * step(0.0, c.y) * step(c.y, edge + 0.3);
  float a = clamp(blob + droplets + drip * 0.8, 0.0, 1.0);
  float shine = smoothstep(0.6, 1.0, gnoise(c * 6.0 + s) + 0.6) * 0.25;
  vec3 col = uColor * (0.75 + 0.25 * gnoise(c * 3.0)) + shine;
  if (uCut > 0.5) a *= base.a;
  // Wet and dark where it soaks the art, glossy on top.
  vec4 o = fxLayer(base, col, a * 0.55, 4);
  gl_FragColor = fxLayer(o, col + shine, a * 0.45, 0);
}`,
};

// A spider web strung across the token.
const web = {
  type: 'web', order: 770,
  defaults: { anchorX: 0.5, anchorY: 0.5, time: 0, color: 0xdddddd, thickness: 1.5, div1: 14, div2: 6, alphaDiscard: false },
  timeScale: 2,
  uniforms: {
    uAnchor: ['vec2', p => [f(p.anchorX), f(p.anchorY)]], uColor: ['vec3', p => rgb(p.color)],
    uThickness: ['float', p => clamp(p.thickness, 0.2, 20)], uDiv: ['vec2', p => [clamp(Math.round(f(p.div1)), 3, 64), clamp(Math.round(f(p.div2)), 1, 40)]],
    uClip: ['bool', p => p.alphaDiscard === true],
  },
  reach: (p, c) => (p.alphaDiscard === true ? 0 : c.size * 0.15),
  glsl: `
void main() {
  vec4 base = fxSample(vTextureCoord);
  vec2 centre = fxArtToCanvas(uAnchor);
  vec2 c = fxCanvas() - centre;
  float R = fxTokenRadius() * 1.15;
  float d = length(c), ang = atan(c.y, c.x);
  float sway = sin(uTime * 0.8) * 0.01;
  float spokesF = uDiv.x / TAU;
  float spokeIdx = floor(ang * spokesF + 0.5);
  float spokeAng = spokeIdx / spokesF + hash11(spokeIdx) * 0.06 + sway;
  float spoke = abs(sin(ang - spokeAng)) * d;
  // Rings sag between spokes, like real silk.
  float local = fract(ang * spokesF + 0.5) - 0.5;
  float ringD = d / R * uDiv.y + (local * local) * 1.2 + gnoise(vec2(spokeIdx, d * 0.05)) * 0.15;
  float ring = abs(fract(ringD) - 0.5) * R / uDiv.y;
  float w = uThickness * 0.6;
  float silk = max(smoothstep(w + 0.8, w * 0.3, spoke), smoothstep(w + 0.8, w * 0.3, ring) * step(0.6, ringD));
  silk *= 1.0 - smoothstep(R * 0.9, R, d);
  float glint = 0.75 + 0.25 * sin(d * 0.15 - uTime * 2.0);
  float region = uClip > 0.5 ? base.a : 1.0;
  gl_FragColor = fxLayer(base, uColor * glint, silk * region * 0.85, 2);
}`,
};

// Glowing motes drifting around the token.
const globes = {
  type: 'globes', order: 790,
  defaults: { color: 0x26ff1d, time: 0, distortion: 0.3, scale: 80, alphaDiscard: false },
  timeScale: 1,
  uniforms: { uColor: ['vec3', p => rgb(p.color)], uDistortion: ['float', p => clamp(p.distortion, 0, 4)], uScale: ['float', p => clamp(p.scale, 5, 1000)], uClip: ['bool', p => p.alphaDiscard === true] },
  reach: (p, c) => (p.alphaDiscard === true ? c.size * 0.08 : c.size * 0.3),
  // x: art around (closer when clipped).
  field: {
    phases: 2,
    spacing: (p, c) => c.size * (p.alphaDiscard === true ? 0.01 : 0.015),
    glsl: `${SILHOUETTE}
vec4 field() { float R = fxTokenRadius(); return vec4(uClip > 0.5 ? near(R * 0.06) : near(R * 0.3), 0.0, 0.0, 0.0); }` },
  glsl: `
void main() {
  vec4 base = fxSample(vTextureCoord);
  float region = fxField().x;
  if (region < 0.001) { gl_FragColor = vec4(unpremul(base) * base.a, base.a); return; }
  float R = fxTokenRadius();
  float cell = R * clamp(uScale / 160.0, 0.15, 3.0);
  vec2 q = fxCanvas() / cell;
  float t = uTime;
  q += vec2(fbm3(q * 0.5 + t * 0.2), fbm3(q * 0.5 - t * 0.2 + 7.0)) * uDistortion;
  vec3 cl = cells(q + vec2(0.0, -t * 0.25), t * (0.6 + uDistortion));
  float twinkle = 0.55 + 0.45 * sin(t * 3.0 + cl.z * 40.0);
  float mote = smoothstep(0.22, 0.0, cl.x) * step(0.45, cl.z) * twinkle;
  float halo = smoothstep(0.5, 0.0, cl.x) * step(0.45, cl.z) * 0.25 * twinkle;
  vec3 col = mix(uColor, vec3(1.0), smoothstep(0.1, 0.0, cl.x) * 0.7);
  float a = (mote + halo) * region;
  gl_FragColor = fxLayer(base, col, a, 9);
}`,
};

export const ELEMENT_SPECS = [fire, xfire, electric, smoke, fumes, fog, xfog, flood, liquid, ripples, splash, web, globes];
