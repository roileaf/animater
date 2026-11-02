// Tokenshade wave fields: a cone or line drawn by a shader as waves rolling out along it from its origin (a sonic
// breath's sound pouring out of the mouth), where JB2A has no footage that fits. One quad centred on the origin and
// turned along the area; the shader keeps to the cone's angle or the line's width, arcs of sound travel out to the
// far end one after another, a shimmer bends them, and only a breath of colour lies between them.
// Pure data and GLSL here; the canvas mesh that carries it lives with the playback engine (playback/aura-fields.mjs).
import { NOISE } from './glsl.mjs';

export const WAVE_SHAPES = Object.freeze({ line: 0, cone: 1 });
// How the waves look: seconds for a front to reach the far end, gap between fronts (share of the length, at least
// WAVE_MIN_GAP canvas px), how bright the fronts and the wash between them are (0..1).
export const WAVE_FIELD_DEFAULTS = Object.freeze({ color: 0xe2e6f0, travel: 0.8, gap: 0.12, front: 0.8, wash: 0.07 });
const WAVE_MIN_GAP = 40;

// Uniforms: uLength the area's length (canvas px), uHalfAngle the cone's half angle (radians), uHalfWidth the line's
// half width (px), uShape 0 line / 1 cone, uTime seconds, uSpeed px a second, uGap px between fronts, uStrength
// (front, wash), uColor, uAlpha overall opacity.
export const WAVE_FRAGMENT = `precision highp float;
const float PI = 3.14159265;
const float TAU = 6.28318531;
${NOISE}
varying vec2 vLocal;
uniform float uLength, uHalfAngle, uHalfWidth, uShape, uTime, uSpeed, uGap, uAlpha;
uniform vec2 uStrength;
uniform vec3 uColor;
void main() {
  vec2 p = vLocal;
  if (p.x <= 0.0) discard;
  float d = length(p);
  // Inside the area, softly: the cone's angle or the line's width, and its far end.
  float side = uShape > 0.5
    ? smoothstep(uHalfAngle, uHalfAngle * 0.8, abs(atan(p.y, p.x)))
    : smoothstep(uHalfWidth, uHalfWidth * 0.75, abs(p.y));
  float inside = side * smoothstep(uLength, uLength * 0.9, d) * smoothstep(0.0, uGap * 0.5, d);
  if (inside <= 0.0) discard;
  // Fronts leave the mouth one after another; none is ahead of the first.
  float lead = uTime * uSpeed;
  float behind = smoothstep(lead + uGap * 0.2, lead - uGap * 0.2, d);
  // A shimmer bends each front a little, as sound bends the air.
  float bend = gnoise(p / 160.0 + vec2(uTime * 0.9, 0.0)) * uGap * 0.08;
  float phase = (d + bend - lead) / uGap;
  // A crisp crest in a soft halo, as a pressure wave.
  float wave = 0.5 + 0.5 * cos(TAU * phase);
  float front = pow(wave, 24.0) + 0.25 * pow(wave, 4.0);
  // Strongest by the mouth, fading toward the far end.
  float reach = 1.0 - 0.7 * clamp(d / uLength, 0.0, 1.0);
  float a = (front * uStrength.x * reach + uStrength.y) * inside * behind * uAlpha;
  gl_FragColor = vec4(uColor * a, a);
}`;

// Uniform values for a wave field (pure: tests and the preview use it). `wave`: 'cone' or 'line'; `length`, `halfWidth`
// in canvas px; `halfAngle` in radians; `time` in seconds.
export function waveUniforms(settings = {}, { wave = 'cone', length = 600, halfAngle = Math.PI / 4, halfWidth = 50, time = 0 } = {}) {
  const s = { ...WAVE_FIELD_DEFAULTS, ...settings };
  const color = Number(s.color) >>> 0, len = Math.max(1, Number(length) || 1);
  return {
    uLength: len, uShape: WAVE_SHAPES[wave] ?? 1,
    uHalfAngle: Math.min(Math.PI / 2, Math.max(0.05, Number(halfAngle) || 0.05)), uHalfWidth: Math.max(1, Number(halfWidth) || 1),
    uTime: Math.max(0, Number(time) || 0), uSpeed: len / Math.max(0.1, Number(s.travel) || 0.8), uGap: Math.max(WAVE_MIN_GAP, len * (Number(s.gap) || 0.12)),
    uStrength: [s.front, s.wash].map((v) => Math.min(1, Math.max(0, Number(v) || 0))),
    uColor: [((color >> 16) & 255) / 255, ((color >> 8) & 255) / 255, (color & 255) / 255], uAlpha: 1,
  };
}
