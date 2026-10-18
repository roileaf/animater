// Harm showing on the body: corrosion eating pits into it, veins spreading under the skin.
import { rgb, clamp } from './util.mjs';

const depthChunk = `
float depthIn(float radius) {
  float m = 1.0, d = fxDither() * TAU + 0.4;
  for (int k = 0; k < 8; k++) { float ang = d + TAU * float(k) / 8.0; m = min(m, fxAlphaAt(vec2(cos(ang), sin(ang)) * radius)); }
  return m;
}
// 0 at the art's edge, rising to 1 deep inside.
float inward(float R) {
  float s = 0.0;
  for (int i = 1; i <= 4; i++) s += depthIn(R * 0.07 * float(i));
  return s / 4.0;
}
`;

// Corrosion: pits open in the art (through it, at full amount), rimmed with sizzling colour.
const corrode = {
  type: 'corrode', order: 370,
  defaults: { color: 0x9be04a, amount: 0.5, bubbles: 0.6, time: 0 },
  timeScale: 1,
  uniforms: { uColor: ['vec3', p => rgb(p.color)], uAmount: ['float', p => clamp(p.amount, 0, 1)], uBubbles: ['float', p => clamp(p.bubbles, 0, 1)] },
  reach: () => 0,
  glsl: `
void main() {
  vec4 base = fxSample(vTextureCoord);
  if (base.a <= 0.001) { gl_FragColor = base; return; }
  float R = fxTokenRadius();
  vec2 q = fxCanvas() / (R * 0.16);
  float t = uTime;
  // Warped space so pits come out ragged and eaten, never round.
  vec2 wq = q + vec2(fbm3(q * 0.9), fbm3(q * 0.9 + 5.3)) * 0.9;
  vec3 cl = cells(wq, t * 0.15);
  // Pits grow with the amount; each cell has its own size so they look eaten, not stamped.
  float size = uAmount * (0.25 + 0.45 * hash11(cl.z * 37.0)) * step(0.35 - uAmount * 0.3, hash11(cl.z * 11.0));
  float edgeNoise = gnoise(q * 4.0) * 0.08 + gnoise(q * 9.0 + 2.0) * 0.04;
  float pit = smoothstep(size, size - 0.08, cl.x + edgeNoise);
  float rim = smoothstep(size + 0.07 + edgeNoise, size, cl.x + edgeNoise) * (1.0 - pit) * step(0.001, size);
  vec3 art = unpremul(base);
  // Staining spreads around the pits; rims sizzle.
  float stain = smoothstep(size + 0.4, size, cl.x) * uAmount;
  vec3 col = mix(art, art * mix(vec3(1.0), uColor, 0.7) * 0.75, stain * 0.6);
  float sizzle = 0.7 + 0.3 * sin(t * 9.0 + cl.z * 40.0);
  col = mix(col, mix(uColor, vec3(1.0, 1.0, 0.8), 0.35) * sizzle, rim * 0.85);
  // Bubbles rising off the wound.
  vec3 b = cells(q * 2.6 + vec2(0.0, t * 0.8), t);
  float bubble = smoothstep(0.12, 0.05, abs(b.x - 0.1)) * step(0.7, b.z) * uBubbles * smoothstep(size + 0.3, size, cl.x);
  col = mix(col, mix(uColor, vec3(1.0), 0.5), bubble);
  float a = base.a * (1.0 - pit * smoothstep(0.55, 1.0, uAmount));
  vec3 inner = mix(col, uColor * 0.25, pit);
  gl_FragColor = vec4(inner * a, a);
}`,
};

// Veins: dark lines spreading in from the edges under the skin, pulsing.
const veins = {
  type: 'veins', order: 365,
  defaults: { color: 0x3d7a1f, amount: 0.6, thickness: 1, pulse: 1, glow: 0.5, time: 0 },
  timeScale: 1,
  uniforms: {
    uColor: ['vec3', p => rgb(p.color)], uAmount: ['float', p => clamp(p.amount, 0, 1)],
    uThick: ['float', p => clamp(p.thickness, 0.2, 4)], uPulse: ['float', p => clamp(p.pulse, 0, 4)], uGlow: ['float', p => clamp(p.glow, 0, 1)],
  },
  reach: () => 0,
  glsl: `${depthChunk}
void main() {
  vec4 base = fxSample(vTextureCoord);
  if (base.a <= 0.001) { gl_FragColor = base; return; }
  float R = fxTokenRadius();
  vec2 q = fxCanvas() / (R * 0.22);
  float t = uTime;
  float depth = inward(R);
  // Branching lines: the creases of a warped ridged field, finer as they reach inward.
  vec2 w = vec2(fbm3(q * 0.5), fbm3(q * 0.5 + 9.0));
  // Main vessels where a warped noise field crosses zero, finer capillaries off them.
  float main = smoothstep(0.045 * uThick, 0.0, abs(fbm(q * 0.9 + w * 1.2)));
  float fine = smoothstep(0.025 * uThick, 0.0, abs(fbm(q * 2.2 + w * 0.8 + 7.0))) * 0.6;
  float lines = max(main, fine);
  float spread = smoothstep(uAmount * 1.1, uAmount * 1.1 - 0.3, depth + (gnoise(q * 0.7) * 0.15));
  float v = lines * spread;
  // A pulse travelling inward along the veins.
  float wave = 0.5 + 0.5 * sin(depth * 14.0 - t * 3.0 * uPulse);
  vec3 art = unpremul(base);
  vec3 dark = mix(art * 0.35, uColor * 0.45, 0.6);
  vec3 col = mix(art, dark, v * 0.9);
  col += uColor * v * wave * uGlow * 0.8;
  // The skin around the veins takes on a sickly cast.
  col = mix(col, col * mix(vec3(1.0), uColor * 1.4, 0.4), spread * uAmount * 0.35);
  gl_FragColor = vec4(clamp(col, 0.0, 1.0) * base.a, base.a);
}`,
};

export const DAMAGE_SPECS = [corrode, veins];
