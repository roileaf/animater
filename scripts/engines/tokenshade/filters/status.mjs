// Status looks on the creature itself: turned into a material, frosted over, bound,
// or marked on the ground beneath. All procedural: no image files.
import { rgb, clamp } from './util.mjs';

const f = v => Number(v) || 0;

const SHAPE = `
float near(float radius) {
  float m = 0.0, d = fxDither() * TAU;
  for (int k = 0; k < 10; k++) { float ang = d + TAU * float(k) / 10.0; m = max(m, fxAlphaAt(vec2(cos(ang), sin(ang)) * radius)); }
  return m;
}
float depthIn(float radius) {
  float m = 1.0, d = fxDither() * TAU + 0.4;
  for (int k = 0; k < 8; k++) { float ang = d + TAU * float(k) / 8.0; m = min(m, fxAlphaAt(vec2(cos(ang), sin(ang)) * radius)); }
  return m;
}
// Relief from the art's own shading: a normal that makes materials catch the light.
vec3 reliefNormal(float strength) {
  float e = 1.5;
  float l = luma(unpremul(fxAt(vec2(-e, 0.0)))), r = luma(unpremul(fxAt(vec2(e, 0.0))));
  float u = luma(unpremul(fxAt(vec2(0.0, -e)))), d = luma(unpremul(fxAt(vec2(0.0, e))));
  return normalize(vec3((l - r) * strength, (u - d) * strength, 1.0));
}
`;

// The creature turned to a material. materialType: 1 stone, 2 ice, 3 iron, 4 gold,
// 5 crystal, 6 bark. color 0 keeps the material's natural colour.
const material = {
  type: 'material', order: 340,
  defaults: { materialType: 1, strength: 1, cracks: 0.5, grain: 1, color: 0, time: 0 },
  timeScale: 1,
  uniforms: {
    uKind: ['int', p => clamp(Math.round(f(p.materialType)), 1, 6)], uStrength: ['float', p => clamp(p.strength, 0, 1)],
    uCracks: ['float', p => clamp(p.cracks, 0, 1)], uGrain: ['float', p => clamp(p.grain, 0.1, 6)],
    uColor: ['vec3', p => rgb(p.color)], uNatural: ['bool', p => !(f(p.color) > 0 || Array.isArray(p.color))],
  },
  reach: () => 0,
  glsl: `${SHAPE}
void main() {
  vec4 base = fxSample(vTextureCoord);
  if (base.a <= 0.001) { gl_FragColor = base; return; }
  vec3 art = unpremul(base);
  float L = luma(art);
  float R = fxTokenRadius();
  vec2 q = fxCanvas() / (R * 0.12) * uGrain;
  vec3 n = reliefNormal(5.0);
  vec3 light = normalize(vec3(-0.45, -0.65, 0.6));
  float diffuse = clamp(dot(n, light), 0.0, 1.0);
  float spec = pow(clamp(dot(reflect(-light, n), vec3(0.0, 0.0, 1.0)), 0.0, 1.0), 18.0);
  vec3 cl = cells(q * 0.6, 0.0);
  float crack = (1.0 - smoothstep(0.0, 0.06, cl.y - cl.x)) * step(0.35, hash21(floor(q * 0.6) + cl.z)) * uCracks;
  float edge = 1.0 - depthIn(R * 0.06);
  int k = int(uKind + 0.5);
  vec3 col; float keep = 0.0;
  if (k == 1) {        // stone: grey-brown grain, chipped cracks
    vec3 stone = mix(vec3(0.42, 0.40, 0.37), vec3(0.62, 0.59, 0.54), fbm(q) + 0.5);
    col = stone * (0.35 + 0.95 * L) * (0.75 + 0.45 * diffuse);
    col = mix(col, col * 0.35, crack);
  } else if (k == 2) { // ice: the creature visible inside, frosted rim, inner fractures, glints
    vec3 ice = vec3(0.70, 0.88, 1.0);
    col = mix(art, ice * (0.5 + 0.6 * L), 0.55) + ice * edge * 0.45;
    col += vec3(0.9, 0.97, 1.0) * crack * 0.6 + spec * 0.9;
    keep = 0.15;
  } else if (k == 3) { // iron: dark, cold, brushed highlights
    float brushed = gnoise(vec2(q.x * 0.4, q.y * 6.0)) * 0.5 + 0.5;
    col = vec3(0.30, 0.32, 0.36) * (0.3 + 1.1 * L) * (0.6 + 0.6 * diffuse) + spec * 0.8 * (0.6 + 0.4 * brushed);
    col = mix(col, col * 0.5, crack * 0.6);
  } else if (k == 4) { // gold: warm ramp by brightness, bright speculars
    col = mix(vec3(0.35, 0.20, 0.04), vec3(1.0, 0.80, 0.32), smoothstep(0.05, 0.85, L * 0.8 + diffuse * 0.4)) + vec3(1.0, 0.95, 0.75) * spec;
  } else if (k == 5) { // crystal: faceted, each facet catching a different light
    vec3 facet = cells(q * 0.45, 0.0);
    float shade = 0.55 + 0.6 * hash21(vec2(facet.z * 91.0, 3.0));
    col = mix(art, vec3(0.75, 0.6, 1.0) * shade * (0.5 + 0.6 * L), 0.6);
    col += (1.0 - smoothstep(0.0, 0.05, facet.y - facet.x)) * 0.5 + spec;
    keep = 0.1;
  } else {             // bark: vertical grain, deep furrows
    float grain = fbm(vec2(q.x * 1.4, q.y * 0.25)) + 0.5;
    float furrow = smoothstep(0.55, 0.75, abs(gnoise(vec2(q.x * 2.2, q.y * 0.3))) * 2.0);
    col = mix(vec3(0.24, 0.16, 0.10), vec3(0.47, 0.34, 0.22), grain) * (0.4 + 0.9 * L) * (0.7 + 0.4 * diffuse);
    col *= 1.0 - furrow * 0.5;
  }
  if (uNatural < 0.5) col = mix(col, uColor * (0.25 + 1.1 * luma(col)), 0.65);
  col = mix(col, art, keep);
  gl_FragColor = vec4(mix(art, clamp(col, 0.0, 1.0), uStrength) * base.a, base.a);
}`,
};

// Frost creeping in from the edges, with snow settling on top.
const frost = {
  type: 'frost', order: 360,
  defaults: { amount: 0.6, snow: 0.4, color: 0xcfeaff, time: 0 },
  timeScale: 1,
  uniforms: {
    uAmount: ['float', p => clamp(p.amount, 0, 1)], uSnow: ['float', p => clamp(p.snow, 0, 1)], uColor: ['vec3', p => rgb(p.color)],
  },
  reach: (p, c) => c.size * 0.04,
  glsl: `${SHAPE}
void main() {
  vec4 base = fxSample(vTextureCoord);
  float R = fxTokenRadius();
  vec2 q = fxCanvas() / (R * 0.1);
  // How far inside the art this pixel is (0 at the edge, 1 deep inside).
  float depth = 0.0;
  for (int i = 1; i <= 4; i++) depth += depthIn(R * 0.07 * float(i));
  depth = 1.0 - depth / 4.0;
  float lace = ridged(q * 0.9 + fbm3(q * 0.3) * 1.5);
  float reach = uAmount * 1.15;
  float frosted = smoothstep(reach, reach - 0.25, depth + (lace - 0.6) * 0.35) * base.a;
  vec3 art = unpremul(base);
  vec3 cold = mix(vec3(luma(art)) * vec3(0.85, 0.93, 1.05), art, 0.35);
  vec3 col = mix(art, cold, uAmount * 0.6);
  col = mix(col, mix(uColor, vec3(1.0), 0.35) * (0.7 + 0.4 * lace), frosted * smoothstep(0.55, 0.9, lace) * 0.9);
  col = mix(col, uColor, frosted * 0.25);
  // Snow: where the art faces up (open sky above), in clumps.
  float above = fxAlphaAt(vec2(0.0, -R * 0.05));
  float top = clamp(base.a - above * 0.8, 0.0, 1.0) + smoothstep(0.65, 0.9, gnoise(q * 0.5) + 0.5) * 0.3 * base.a;
  float snow = clamp(top * 1.6, 0.0, 1.0) * uSnow * smoothstep(0.35, 0.6, gnoise(q * 1.3 + 4.0) + 0.6);
  col = mix(col, vec3(0.96, 0.98, 1.0), snow);
  // A light rime just outside the outline.
  float rime = near(R * 0.04) * (1.0 - base.a) * uAmount * 0.5 * smoothstep(0.6, 0.9, lace);
  vec4 o = vec4(clamp(col, 0.0, 1.0) * base.a, base.a);
  gl_FragColor = fxBehind(o, mix(uColor, vec3(1.0), 0.5), rime);
}`,
};

// Something wrapped around the creature. bindType: 1 vines, 2 net, 3 chains, 4 ropes.
const bindings = {
  type: 'bindings', order: 780,
  defaults: { bindType: 1, color: 0, thickness: 1, density: 1, tightness: 0, time: 0 },
  timeScale: 1,
  uniforms: {
    uKind: ['int', p => clamp(Math.round(f(p.bindType)), 1, 4)], uColor: ['vec3', p => rgb(p.color)],
    uNatural: ['bool', p => !(f(p.color) > 0 || Array.isArray(p.color))],
    uThick: ['float', p => clamp(p.thickness, 0.2, 4)], uDensity: ['float', p => clamp(p.density, 0.3, 4)],
    uTight: ['float', p => clamp(p.tightness, 0, 1)],
  },
  reach: (p, c) => c.size * 0.05,
  glsl: `${SHAPE}
// Distance from p to a wavy band crossing the token at angle a, offset o (token radii).
float band(vec2 p, float a, float o, float wav, float freq, float ph) {
  vec2 d = rot2(a) * p;
  return abs(d.y - o - sin(d.x * freq + ph) * wav);
}
void main() {
  vec4 base = fxSample(vTextureCoord);
  float R = fxTokenRadius();
  vec2 p = fxCanvas() / R;
  float t = uTime;
  float squeeze = 1.0 - uTight * 0.04 * (0.5 + 0.5 * sin(t * 3.0));
  p /= squeeze;
  float w = 0.035 * uThick;
  float region = max(base.a, near(R * 0.05) * 0.9);
  int k = int(uKind + 0.5);
  vec3 col = vec3(0.0); float a = 0.0;
  if (k == 1) {
    // Vines: a few strands winding across, with leaves along them.
    for (int i = 0; i < 4; i++) {
      float fi = float(i);
      if (fi >= 2.0 + uDensity * 1.5) break;
      float ang = -0.7 + fi * 0.55 + hash11(fi) * 0.3;
      float off = (fi - 1.5) * 0.32;
      float dd = band(p, ang, off, 0.08, 7.0 + fi, fi * 2.1 + t * 0.2);
      float stem = smoothstep(w, w * 0.4, dd);
      vec2 along = rot2(ang) * p;
      float leafPhase = fract(along.x * 4.0 + fi * 0.37);
      float leaf = smoothstep(0.07, 0.03, length(vec2((leafPhase - 0.5) * 0.25, dd - 0.04 * sign(sin(along.x * 12.0 + fi)))));
      float shade = 0.75 + 0.35 * gnoise(p * 30.0 + fi);
      vec3 c = uNatural > 0.5 ? mix(vec3(0.16, 0.36, 0.10), vec3(0.32, 0.58, 0.16), leaf) : uColor;
      float m = max(stem, leaf * 0.95);
      col = mix(col, c * shade, m); a = max(a, m);
    }
  } else if (k == 2) {
    // Net: knotted mesh, sagging slightly.
    vec2 g = rot2(0.785) * p * (5.0 * uDensity);
    g.y += sin(g.x * 0.6) * 0.15;
    vec2 cell = abs(fract(g) - 0.5);
    float line = smoothstep(w * 6.0, w * 3.0, min(cell.x, cell.y));
    float knot = smoothstep(0.16, 0.08, length(cell - 0.5));
    vec3 c = uNatural > 0.5 ? vec3(0.55, 0.45, 0.30) : uColor;
    col = c * (0.7 + 0.3 * gnoise(p * 40.0)) * (1.0 - knot * 0.25); a = max(line, knot);
  } else if (k == 3) {
    // Chains: links along two crossing bands, metal-lit.
    for (int i = 0; i < 2; i++) {
      float fi = float(i);
      float ang = fi < 0.5 ? 0.55 : -0.6;
      vec2 d = rot2(ang) * p; d.y -= (fi - 0.5) * 0.3;
      float u = d.x * 9.0 * uDensity;
      float link = fract(u) - 0.5;
      bool isFlat = mod(floor(u), 2.0) < 1.0;
      vec2 e = vec2(link * 0.11 / uDensity, d.y);
      float ring = isFlat ? abs(length(e / vec2(1.0, 0.55)) - 0.05) : abs(e.y) + max(abs(e.x) - 0.04, 0.0);
      float m = smoothstep(w * 0.7, w * 0.25, ring);
      float lit = 0.55 + 0.45 * sin(link * 6.0 + fi);
      vec3 c = (uNatural > 0.5 ? vec3(0.55, 0.57, 0.62) : uColor) * lit + pow(lit, 8.0) * 0.4;
      col = mix(col, c, m); a = max(a, m);
    }
  } else {
    // Ropes: twisted cords wrapped around the body.
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      if (fi >= 1.0 + uDensity * 1.5) break;
      float ang = 0.15 - fi * 0.12;
      float off = (fi - 1.0) * 0.38;
      float dd = band(p, ang, off, 0.03, 3.0, fi);
      float cord = smoothstep(w * 1.4, w * 0.8, dd);
      vec2 along = rot2(ang) * p;
      float twist = 0.6 + 0.4 * sin((along.x * 40.0 + dd * 60.0));
      vec3 c = (uNatural > 0.5 ? vec3(0.64, 0.50, 0.30) : uColor) * twist;
      col = mix(col, c, cord); a = max(a, cord);
    }
  }
  // Bindings sit on the body: a contact shadow beneath, shading on the strands.
  a *= region;
  vec4 o = fxLayer(base, col, a, 0);
  gl_FragColor = o;
}`,
};

// A marker on the ground beneath the token. baseType: 1 disc, 2 ring, 3 pulse, 4 rune circle.
const baseMark = {
  type: 'base', order: 10,
  defaults: { baseType: 2, color: 0x44dd66, radius: 0.55, alpha: 0.8, time: 0 },
  timeScale: 1,
  uniforms: {
    uKind: ['int', p => clamp(Math.round(f(p.baseType)), 1, 4)], uColor: ['vec3', p => rgb(p.color)],
    uRadius: ['float', p => clamp(p.radius, 0.2, 1.5)], uAlpha: ['float', p => clamp(p.alpha, 0, 1)],
  },
  reach: (p, c) => Math.max(0, c.size * (clamp(p.radius, 0.2, 1.5) - 0.5)) + c.size * 0.06,
  glsl: `
void main() {
  vec4 base = fxSample(vTextureCoord);
  vec2 c = fxCanvas() / (max(uTokenSize.x, uTokenSize.y));
  float d = length(c) / uRadius;
  float aa = 2.0 / (max(uTokenSize.x, uTokenSize.y) * uRadius * uZoom);
  float t = uTime;
  int k = int(uKind + 0.5);
  float a;
  if (k == 1) a = smoothstep(1.0 + aa, 1.0 - aa, d) * (0.35 + 0.25 * smoothstep(1.0, 0.6, d)) + smoothstep(aa * 2.0, 0.0, abs(d - 0.97)) * 0.6;
  else if (k == 2) a = smoothstep(0.045 + aa, 0.02, abs(d - 0.94)) + smoothstep(0.18, 0.0, abs(d - 0.94)) * 0.2;
  else if (k == 3) { float ring = fract(t * 0.6); a = (smoothstep(0.06 + aa, 0.0, abs(d - ring)) * (1.0 - ring)) + smoothstep(0.035 + aa, 0.015, abs(d - 0.95)) * 0.8; }
  else {
    float ang = atan(c.y, c.x) + t * 0.25;
    float rings = smoothstep(0.03 + aa, 0.0, abs(d - 0.95)) + smoothstep(0.025 + aa, 0.0, abs(d - 0.78));
    float slot = fract(ang / TAU * 16.0);
    float glyph = step(abs(d - 0.865), 0.05) * step(0.25, slot) * step(slot, 0.75) * step(0.4, hash11(floor(ang / TAU * 16.0) + 3.0)) * (0.6 + 0.4 * sin(t * 2.0 + floor(ang * 3.0)));
    a = clamp(rings + glyph, 0.0, 1.0);
  }
  gl_FragColor = fxBehind(base, mix(uColor, vec3(1.0), 0.15), a * uAlpha);
}`,
};

export const STATUS_SPECS = [material, frost, bindings, baseMark];
