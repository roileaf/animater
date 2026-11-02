// Tokenshade swarm fields: a swarm of small creatures (insects, maggots, vermin) drawn by a shader where JB2A has
// none. Hundreds of small dark bodies, each turned along its flight, jitter and clump as they move: swirling round a
// circle (a swarm over a creature, a round area) or pouring out along a cone or line from its origin, the front
// reaching the far end first. One quad centred on the origin and turned along the area; a faint shadow lies under
// the densest part. Pure data and GLSL here; the canvas mesh lives with the playback engine (playback/aura-fields.mjs).
import { NOISE } from './glsl.mjs';

export const SWARM_SHAPES = Object.freeze({ line: 0, cone: 1, circle: 2 });
// How the swarm looks: body length (canvas px at a 100 px grid), share of the ground's cells holding one (0..1), speed
// (px a second), seconds for the front of a cone or line to reach its end, and how dark its shadow is (0..1).
export const SWARM_FIELD_DEFAULTS = Object.freeze({ color: 0x1e1810, size: 11, density: 0.8, speed: 55, travel: 0.9, shadow: 0.12 });

// Uniforms: uShape 0 line / 1 cone / 2 circle, uLength the line's or cone's length or the circle's radius (px),
// uHalfAngle the cone's half angle, uHalfWidth the line's half width, uTime seconds, uCell the cell each body roams
// (px), uSize body length (px), uDensity, uSpeed, uTravel, uShadow, uColor, uAlpha.
export const SWARM_FRAGMENT = `precision highp float;
const float PI = 3.14159265;
const float TAU = 6.28318531;
${NOISE}
varying vec2 vLocal;
uniform float uShape, uLength, uHalfAngle, uHalfWidth, uTime, uCell, uSize, uDensity, uSpeed, uTravel, uShadow, uAlpha;
uniform vec3 uColor;

// The area, softly: 1 inside, 0 outside.
float inside(vec2 p) {
  float d = length(p);
  if (uShape > 1.5) return smoothstep(uLength, uLength * 0.82, d);
  if (p.x <= 0.0) return 0.0;
  float side = uShape > 0.5
    ? smoothstep(uHalfAngle, uHalfAngle * 0.78, abs(atan(p.y, p.x)))
    : smoothstep(uHalfWidth, uHalfWidth * 0.7, abs(p.y));
  return side * smoothstep(uLength, uLength * 0.88, d);
}
// One body: a small dark ellipse along its heading, with a darker head.
float body(vec2 q, vec2 dir) {
  vec2 r = vec2(dot(q, dir), dot(q, vec2(-dir.y, dir.x)));
  float e = length(r / vec2(uSize * 0.5, uSize * 0.22));
  float head = length((r - vec2(uSize * 0.32, 0.0)) / (uSize * 0.17));
  return max(smoothstep(1.0, 0.6, e), smoothstep(1.0, 0.5, head));
}
void main() {
  vec2 p = vLocal;
  float area = inside(p);
  if (area <= 0.0) discard;
  // A cone or line fills from the mouth: nothing ahead of the front.
  float front = uShape > 1.5 ? 1.0 : smoothstep(uTime / uTravel * uLength + uCell, uTime / uTravel * uLength - uCell, length(p));
  if (front <= 0.0) discard;
  // The whole swarm moves as one (round a circle, out along a cone or line), so the field is read in its own moving
  // frame q; every body roams its own cell there and jitters. Neighbours are checked so none is cut off.
  float turn = uTime * uSpeed / max(uLength * 0.6, 1.0);
  vec2 q = uShape > 1.5 ? mat2(cos(turn), sin(turn), -sin(turn), cos(turn)) * p : p - vec2(uSpeed * uTime, 0.0);
  vec2 cellOf = floor(q / uCell);
  float bugs = 0.0;
  for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++) {
    vec2 c = cellOf + vec2(float(i), float(j));
    float h = hash21(c);
    // Clumps: some patches thick with them, some bare.
    float clump = smoothstep(-0.3, 0.3, gnoise(c * 0.3 + uTime * 0.2));
    if (h > uDensity * (0.3 + 0.9 * clump)) continue;
    vec2 jitter = vec2(sin(uTime * (3.0 + h * 5.0) + h * 40.0), cos(uTime * (2.5 + h * 6.0) + h * 70.0)) * uCell * 0.3;
    vec2 at = (c + 0.5) * uCell + jitter + (hash22(c) - 0.5) * uCell * 0.4;
    // Heading: along the swarm's way (round the circle, out along the cone), wavering.
    vec2 way = uShape > 1.5 ? normalize(vec2(at.y, -at.x) + 1e-4) : vec2(1.0, 0.0);
    float wob = sin(uTime * (5.0 + h * 4.0) + h * 20.0) * 0.9;
    vec2 dir = normalize(way + vec2(-way.y, way.x) * wob);
    bugs = max(bugs, body(q - at, dir));
  }
  // A faint, even shadow under the swarm, a little thicker where it crowds.
  float shade = uShadow * (0.7 + 0.3 * gnoise(p / 80.0 + uTime * 0.2));
  float a = max(bugs * 0.95, shade) * area * front * uAlpha;
  gl_FragColor = vec4(uColor * a, a);
}`;

// Uniform values for a swarm field (pure: tests and the preview use it). `shape`: 'circle', 'cone' or 'line';
// `length` the radius of a circle or the length of a cone or line (px); `grid` the scene's grid (px) the bodies scale with.
export function swarmUniforms(settings = {}, { shape = 'circle', length = 150, halfAngle = Math.PI / 4, halfWidth = 50, time = 0, grid = 100 } = {}) {
  const s = { ...SWARM_FIELD_DEFAULTS, ...settings };
  const color = Number(s.color) >>> 0, k = Math.max(0.2, (Number(grid) || 100) / 100);
  const size = Math.max(2, (Number(s.size) || 7) * k);
  return {
    uShape: SWARM_SHAPES[shape] ?? 2, uLength: Math.max(1, Number(length) || 1),
    uHalfAngle: Math.min(Math.PI / 2, Math.max(0.05, Number(halfAngle) || 0.05)), uHalfWidth: Math.max(1, Number(halfWidth) || 1),
    uTime: Math.max(0, Number(time) || 0), uCell: size * 2.4, uSize: size,
    uDensity: Math.min(1, Math.max(0, Number(s.density) || 0)), uSpeed: Math.max(0, Number(s.speed) || 0) * k,
    uTravel: Math.max(0.1, Number(s.travel) || 0.9), uShadow: Math.min(1, Math.max(0, Number(s.shadow) || 0)),
    uColor: [((color >> 16) & 255) / 255, ((color >> 8) & 255) / 255, (color & 255) / 255], uAlpha: 1,
  };
}
