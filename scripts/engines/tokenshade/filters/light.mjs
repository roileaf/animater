// Light around and on the silhouette: glows, outlines, bevels, shadows, bloom, auras.
import { rgb, deg, clamp } from './util.mjs';

const f = v => Number(v) || 0;

// Soft coverage of the art around this pixel within `radius` canvas px (0..1), from
// three dithered rings. Shared by glow-like effects.
const COVERAGE = `
float coverage(float radius) {
  float acc = 0.0, wsum = 0.0, d = fxJitter() * TAU;
  for (int ring = 1; ring <= 3; ring++) {
    float r = radius * float(ring) / 3.0;
    float w = 1.25 - float(ring) * 0.3;
    for (int k = 0; k < 10; k++) {
      float ang = d + TAU * (float(k) + 0.5 * float(ring)) / 10.0;
      acc += fxAlphaAt(vec2(cos(ang), sin(ang)) * r) * w;
      wsum += w;
    }
  }
  return acc / wsum;
}
float nearest(float radius) {
  float m = 0.0, d = fxJitter() * TAU;
  for (int k = 0; k < 16; k++) {
    float ang = d + TAU * float(k) / 16.0;
    m = max(m, fxAlphaAt(vec2(cos(ang), sin(ang)) * radius));
  }
  return m;
}
float innerEdge(float radius) {
  float m = 1.0, d = fxJitter() * TAU;
  for (int k = 0; k < 12; k++) {
    float ang = d + TAU * float(k) / 12.0;
    m = min(m, fxAlphaAt(vec2(cos(ang), sin(ang)) * radius));
  }
  return 1.0 - m;
}
`;

const glow = {
  type: 'glow', order: 700,
  defaults: { outerStrength: 4, innerStrength: 0, color: 0xffffff, distance: 14, alpha: 1, knockout: false },
  uniforms: {
    uOuter: ['float', p => clamp(p.outerStrength, 0, 20)], uInner: ['float', p => clamp(p.innerStrength, 0, 20)],
    uColor: ['vec3', p => rgb(p.color)], uDistance: ['float', p => clamp(p.distance, 1, 120)],
    uAlpha: ['float', p => clamp(p.alpha, 0, 1)], uKnockout: ['bool', p => p.knockout === true],
  },
  reach: p => clamp(p.distance, 1, 120) * 1.15 + 2,
  // x: coverage around, y: inner edge.
  field: {
    spacing: p => clamp(p.distance, 1, 120) * 0.2,
    glsl: `${COVERAGE}
vec4 field() { return vec4(coverage(uDistance), innerEdge(uDistance * 0.35), 0.0, 0.0); }` },
  glsl: `
void main() {
  vec4 base = fxSample(vTextureCoord);
  vec4 shape = fxField();
  float cov = shape.x;
  if (base.a <= 0.0 && cov < 0.001) { gl_FragColor = uKnockout > 0.5 ? vec4(0.0) : base; return; }
  // Bright close to the edge, long soft tail: reads as light, not as a blurred halo.
  float outer = (1.0 - base.a) * (1.0 - exp(-cov * uOuter * 0.9)) * uAlpha;
  float inner = base.a * shape.y * clamp(uInner * 0.18, 0.0, 1.0) * uAlpha;
  vec3 hot = mix(uColor, vec3(1.0), 0.35 * clamp(cov * 2.0 - 0.6, 0.0, 1.0));
  vec4 o = fxBehind(base, hot, outer);
  o.rgb += uColor * inner * o.a;
  if (uKnockout > 0.5) o = vec4(hot * outer, outer);
  gl_FragColor = o;
}`,
};

const outline = {
  type: 'outline', order: 720,
  defaults: { thickness: 2, color: 0x000000, alpha: 1 },
  uniforms: { uThickness: ['float', p => clamp(p.thickness, 0, 60)], uColor: ['vec3', p => rgb(p.color)], uAlpha: ['float', p => clamp(p.alpha, 0, 1)] },
  reach: p => clamp(p.thickness, 0, 60) + 2,
  glsl: `${COVERAGE}
void main() {
  vec4 base = fxSample(vTextureCoord);
  float t = max(uThickness, 0.01);
  float edge = max(nearest(t), nearest(t * 0.5));
  float a = smoothstep(0.15, 0.55, edge) * uAlpha;
  gl_FragColor = fxBehind(base, uColor, a);
}`,
};

// Chiselled edges lit from one side.
const bevel = {
  type: 'bevel', order: 650,
  defaults: { rotation: 45, thickness: 2, lightColor: 0xffffff, lightAlpha: 0.7, shadowColor: 0x000000, shadowAlpha: 0.7 },
  uniforms: {
    uDir: ['vec2', p => [Math.cos(deg(p.rotation)), Math.sin(deg(p.rotation))]], uThickness: ['float', p => clamp(p.thickness, 0.2, 40)],
    uLight: ['vec4', p => [...rgb(p.lightColor), clamp(p.lightAlpha, 0, 1)]], uShade: ['vec4', p => [...rgb(p.shadowColor), clamp(p.shadowAlpha, 0, 1)]],
  },
  reach: () => 0,
  glsl: `
void main() {
  vec4 base = fxSample(vTextureCoord);
  float lit = 0.0, shade = 0.0;
  for (int i = 1; i <= 4; i++) {
    float r = uThickness * float(i) / 4.0;
    lit += base.a - fxAlphaAt(-uDir * r);
    shade += base.a - fxAlphaAt(uDir * r);
  }
  lit = clamp(lit / 4.0, 0.0, 1.0) * uLight.a;
  shade = clamp(shade / 4.0, 0.0, 1.0) * uShade.a;
  vec3 col = unpremul(base);
  col = mix(col, uLight.rgb, lit);
  col = mix(col, uShade.rgb, shade);
  gl_FragColor = vec4(col * base.a, base.a);
}`,
};

const shadow = {
  type: 'shadow', order: 150,
  defaults: { rotation: 45, distance: 8, blur: 3, alpha: 0.6, color: 0x000000, shadowOnly: false, stretch: 0 },
  uniforms: {
    uOffset: ['vec2', p => [Math.cos(deg(p.rotation)) * f(p.distance), Math.sin(deg(p.rotation)) * f(p.distance)]],
    uBlur: ['float', p => clamp(p.blur, 0, 40) * 2.2 + 0.5], uColor: ['vec3', p => rgb(p.color)],
    uAlpha: ['float', p => clamp(p.alpha, 0, 1)], uOnly: ['bool', p => p.shadowOnly === true], uStretch: ['float', p => clamp(p.stretch, 0, 1)],
  },
  reach: p => Math.abs(f(p.distance)) + clamp(p.blur, 0, 40) * 2.2 + 3,
  glsl: `
void main() {
  vec4 base = fxSample(vTextureCoord);
  float acc = 0.0, d = fxDither() * TAU;
  for (int k = 0; k < 20; k++) {
    float r = uBlur * sqrt((float(k) + 0.5) / 20.0);
    float ang = d + float(k) * 2.39996;
    // stretch smears the shadow back along its offset, like one cast by a low sun.
    float along = 1.0 - uStretch * fract(float(k) * 0.618 + d * 0.159);
    acc += fxAlphaAt(-uOffset * along + vec2(cos(ang), sin(ang)) * r);
  }
  float a = acc / 20.0 * uAlpha;
  if (uOnly > 0.5) { gl_FragColor = vec4(uColor * a, a); return; }
  gl_FragColor = fxBehind(base, uColor, a);
}`,
};

// Bright parts of the art bleed light.
const xbloom = {
  type: 'xbloom', order: 680,
  defaults: { threshold: 0.5, bloomScale: 1, brightness: 1, blur: 2 },
  uniforms: {
    uThreshold: ['float', p => clamp(p.threshold, 0, 2)], uBloom: ['float', p => clamp(p.bloomScale, 0, 10)],
    uBrightness: ['float', p => clamp(p.brightness, 0, 4)], uRadius: ['float', p => 4 + clamp(p.blur, 0, 20) * 4],
  },
  reach: p => 4 + clamp(p.blur, 0, 20) * 4,
  glsl: `
void main() {
  vec4 base = fxSample(vTextureCoord);
  vec3 acc = vec3(0.0); float d = fxDither() * TAU;
  for (int k = 0; k < 24; k++) {
    float r = uRadius * sqrt((float(k) + 0.5) / 24.0);
    float ang = d + float(k) * 2.39996;
    vec4 s = fxAt(vec2(cos(ang), sin(ang)) * r);
    vec3 c = unpremul(s);
    float over = max(luma(c) - uThreshold * 0.5, 0.0);
    acc += c * over * s.a * (1.2 - r / uRadius);
  }
  vec3 light = acc / 24.0 * uBloom * 2.5;
  vec3 col = base.rgb * uBrightness + light;
  float a = clamp(max(base.a, luma(light) * 1.5), 0.0, 1.0);
  gl_FragColor = vec4(min(col, vec3(a)), a);
}`,
};

// Removes the soft baked-in drop shadows many token artists leave around the figure.
const zapshadow = {
  type: 'zapshadow', order: 50,
  defaults: { alphaTolerance: 0.5 },
  uniforms: { uTolerance: ['float', p => clamp(p.alphaTolerance, 0, 1)] },
  reach: () => 0,
  glsl: `
void main() {
  vec4 c = fxSample(vTextureCoord);
  vec3 col = unpremul(c);
  // Shadow pixels are see-through and dark; keep anything solid or bright.
  float keep = smoothstep(uTolerance - 0.08, uTolerance + 0.04, c.a + luma(col) * 0.35);
  gl_FragColor = c * keep;
}`,
};

// Living aura hugging the silhouette. auraType 1: cold, slow and smooth; 2: hot, licking.
const xglow = {
  type: 'xglow', order: 690,
  defaults: { auraType: 2, color: 0xff6a00, thickness: 4, scale: 4, time: 0, auraIntensity: 1.5, subAuraIntensity: 1, threshold: 0.4, discard: false },
  timeScale: 0.45 / 0.0027 / 1000,
  uniforms: {
    uType: ['int', p => clamp(Math.round(f(p.auraType)), 1, 2)], uColor: ['vec3', p => rgb(p.color)],
    uThickness: ['float', p => clamp(p.thickness, 0.2, 30) * 5], uScale: ['float', p => clamp(p.scale, 0.2, 20)],
    uAura: ['float', p => clamp(p.auraIntensity, 0, 10)], uSub: ['float', p => clamp(p.subAuraIntensity, 0, 10)],
    uThreshold: ['float', p => clamp(p.threshold, 0, 1)], uDiscard: ['bool', p => p.discard === true],
  },
  reach: p => clamp(p.thickness, 0.2, 30) * 5 * 1.3 + 4,
  // x: coverage around, y: inner edge, z: art below (hot aura's lift).
  field: {
    spacing: p => clamp(p.thickness, 0.2, 30) * 5 * 0.1,
    glsl: `${COVERAGE}
vec4 field() {
  float lift = 0.0;
  if (uType > 1.5) {
    float jit = fxJitter();
    for (int k = 0; k < 8; k++) { float d = (float(k) + jit) / 8.0; lift = max(lift, fxAlphaAt(vec2(0.0, d * uThickness * 1.6)) * (1.0 - d)); }
  }
  return vec4(coverage(uThickness), innerEdge(uThickness * 0.3), lift, 0.0);
}` },
  glsl: `
void main() {
  vec4 base = fxSample(vTextureCoord);
  vec4 shape = fxField();
  float cov = shape.x;
  // A cold aura is nothing where no art is near.
  if (uType < 1.5 && base.a <= 0.0 && cov < 0.004) { gl_FragColor = base; return; }
  vec2 q = fxCanvas() / (fxTokenRadius() * 0.12 * uScale + 1.0);
  float t = uTime;
  float a, h;
  if (uType < 1.5) {
    // Cold: a soft breath of light with slow plumes and the odd glint.
    float n = warped(q * 0.6, t * 0.5);
    float field = pow(cov, 0.75) * (0.45 + 0.75 * n);
    a = smoothstep(uThreshold * 0.2, uThreshold * 0.2 + 0.55, field);
    vec3 g = cells(q * 2.2, t);
    a += smoothstep(0.07, 0.0, g.x) * step(0.9, g.z) * cov;
    h = clamp(field * 1.3, 0.0, 1.0);
  } else {
    // Hot: tongues licking upward off the outline.
    float lift = shape.z;
    float n = warped(q * vec2(0.9, 0.5) + vec2(0.0, t * 1.4), t);
    float field = max(cov * 0.9, lift) + (n - 0.5) * 0.9;
    a = smoothstep(0.3 + uThreshold * 0.2, 0.7, field);
    h = clamp(field, 0.0, 1.0);
  }
  a *= (1.0 - base.a) * clamp(uAura * 0.45, 0.0, 1.0);
  vec3 col = uType < 1.5 ? mix(uColor * 0.75, mix(uColor, vec3(1.0), 0.75), h) : heatRamp(uColor, h);
  float n = h;
  vec4 o = fxBehind(base, col, a);
  // Sub-aura: the light washing over the art's rim.
  float rim = base.a * shape.y * clamp(uSub * 0.35, 0.0, 1.0) * (0.6 + 0.6 * n);
  if (uDiscard < 0.5) o.rgb = mix(o.rgb, col * o.a, rim * 0.7);
  gl_FragColor = o;
}`,
};

export const LIGHT_SPECS = [glow, outline, bevel, shadow, xbloom, zapshadow, xglow];
