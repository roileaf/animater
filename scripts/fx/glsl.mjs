// Shared GLSL for animater's token FX shaders (GLSL ES 1.0, PIXI v7 filters).
//
// Coordinate spaces every shader can use:
//   fxScreen()  logical screen pixels of this fragment
//   fxCanvas()  canvas pixels around the art centre, unrotated (y grows downward)
//   fxArt()     0..1 across the token art, turns with the token
// Distances in parameters are canvas pixels; multiply by uZoom for screen pixels.

export const HEADER = `
precision highp float;
varying vec2 vTextureCoord;
uniform sampler2D uSampler;
uniform vec4 inputSize;
uniform vec4 inputClamp;
uniform vec4 outputFrame;
uniform float uTime;
uniform float uZoom;
uniform vec2 uCenter;
uniform mat3 uScreenToArt;
uniform mat3 uArtToScreen;
uniform vec2 uArtSize;
uniform vec2 uTokenSize;
uniform float uSeed;

const float PI = 3.14159265;
const float TAU = 6.28318531;

vec2 fxScreen() { return vTextureCoord * inputSize.xy + outputFrame.xy; }
vec2 fxCanvas() { return (fxScreen() - uCenter) / uZoom; }
vec2 fxArt() { return (uScreenToArt * vec3(fxScreen(), 1.0)).xy; }
vec2 fxTexOf(vec2 screen) { return (screen - outputFrame.xy) * inputSize.zw; }
bool fxInside(vec2 uv) { return uv.x >= inputClamp.x && uv.y >= inputClamp.y && uv.x <= inputClamp.z && uv.y <= inputClamp.w; }
vec4 fxSample(vec2 uv) { return fxInside(uv) ? texture2D(uSampler, uv) : vec4(0.0); }
// Sample the input at an offset given in canvas pixels.
vec4 fxAt(vec2 canvasOffset) { return fxSample(vTextureCoord + canvasOffset * uZoom * inputSize.zw); }
float fxAlphaAt(vec2 canvasOffset) { return fxAt(canvasOffset).a; }
// Sample the input at a point given in art coordinates (0..1 across the art).
vec4 fxAtArt(vec2 art) { return fxSample(fxTexOf((uArtToScreen * vec3(art, 1.0)).xy)); }
// Canvas pixels → art units (accounts for the token's rotation and art size).
vec2 fxCanvasToArtDelta(vec2 d) {
  vec2 a = (uScreenToArt * vec3(uCenter + d * uZoom, 1.0)).xy;
  vec2 o = (uScreenToArt * vec3(uCenter, 1.0)).xy;
  return a - o;
}
vec2 fxArtToCanvas(vec2 art) { return ((uArtToScreen * vec3(art, 1.0)).xy - uCenter) / uZoom; }
float fxTokenRadius() { return 0.5 * max(uTokenSize.x, uTokenSize.y); }
// Stable per-pixel dither in [0,1): hides sample banding without shimmering.
float fxDither() { return fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))); }
`;

export const NOISE = `
float hash11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash21(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
vec2 hash22(vec2 p) { vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); q += dot(q, q.yzx + 33.33); return fract((q.xx + q.yz) * q.zy); }
vec2 grad2(vec2 p) { return normalize(hash22(p) * 2.0 - 1.0 + 1e-4); }
// Gradient noise, roughly -0.7..0.7, quintic fade.
float gnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = dot(grad2(i), f);
  float b = dot(grad2(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0));
  float c = dot(grad2(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0));
  float d = dot(grad2(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
const mat2 FBM_ROT = mat2(0.8, -0.6, 0.6, 0.8);
// Fractal noise centred on 0 (about -0.6..0.6).
float fbm(vec2 p) {
  float s = 0.0, a = 0.55;
  for (int i = 0; i < 5; i++) { s += a * gnoise(p); p = FBM_ROT * p * 2.03 + 17.1; a *= 0.5; }
  return s;
}
float fbm3(vec2 p) {
  float s = 0.0, a = 0.6;
  for (int i = 0; i < 3; i++) { s += a * gnoise(p); p = FBM_ROT * p * 2.07 + 9.3; a *= 0.5; }
  return s;
}
// Ridged fractal: sharp creases, good for lightning, cracks, caustics.
float ridged(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { s += a * (1.0 - abs(gnoise(p) * 1.6)); p = FBM_ROT * p * 2.1 + 3.7; a *= 0.5; }
  return s;
}
// Domain-warped fractal noise in 0..1: organic motion that never reads as a scrolling texture.
float warped(vec2 p, float t) {
  vec2 w = vec2(fbm3(p * 0.7 + vec2(0.0, t * 0.6)), fbm3(p * 0.7 + vec2(5.2, -t * 0.5 + 1.3)));
  return clamp(fbm(p + w * 1.5 + vec2(t * 0.15, 0.0)) + 0.5, 0.0, 1.0);
}
// Cellular noise: x = distance to nearest cell point, y = to second nearest, z = cell id.
vec3 cells(vec2 p, float t) {
  vec2 i = floor(p), f = fract(p);
  float d1 = 8.0, d2 = 8.0, id = 0.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(float(x), float(y));
    vec2 o = hash22(i + g);
    o = 0.5 + 0.45 * sin(t + TAU * o);
    float d = length(g + o - f);
    if (d < d1) { d2 = d1; d1 = d; id = hash21(i + g); } else if (d < d2) { d2 = d; }
  }
  return vec3(d1, d2, id);
}
mat2 rot2(float a) { float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }
`;

export const COLOR = `
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec3 hsv2rgb(vec3 c) { vec3 p = abs(fract(c.xxx + vec3(1.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0); return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y); }
vec3 rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + 1e-10)), d / (q.x + 1e-10), q.x);
}
vec3 unpremul(vec4 c) { return c.a > 0.0 ? c.rgb / c.a : vec3(0.0); }
// Heat ramp built from one tint colour: dark ember → tint → hot near-white core.
vec3 heatRamp(vec3 tint, float h) {
  vec3 dark = tint * vec3(0.18, 0.1, 0.08) + vec3(0.04, 0.0, 0.0);
  vec3 hot = mix(tint, vec3(1.0, 0.97, 0.88), 0.75);
  vec3 c = mix(dark, tint * 0.85, smoothstep(0.0, 0.35, h));
  c = mix(c, tint, smoothstep(0.3, 0.6, h));
  return mix(c, hot, smoothstep(0.62, 1.0, h));
}
// Blend modes (animater's own table): 0 normal, 1 add, 2 screen, 3 overlay, 4 multiply,
// 5 soft light, 6 hard light, 7 colour dodge, 8 lighten, 9 glow (soft add), 10 difference,
// 11 subtract, 12 exclusion, 13 hue/colour, 14 luminosity.
float ov1(float b, float l) { return b < 0.5 ? 2.0 * b * l : 1.0 - 2.0 * (1.0 - b) * (1.0 - l); }
vec3 blendMode(int mode, vec3 b, vec3 l) {
  if (mode == 1) return min(b + l, 1.0);
  if (mode == 2) return 1.0 - (1.0 - b) * (1.0 - l);
  if (mode == 3) return vec3(ov1(b.r, l.r), ov1(b.g, l.g), ov1(b.b, l.b));
  if (mode == 4) return b * l;
  if (mode == 5) return mix(2.0 * b * l + b * b * (1.0 - 2.0 * l), sqrt(b) * (2.0 * l - 1.0) + 2.0 * b * (1.0 - l), step(0.5, l));
  if (mode == 6) return vec3(ov1(l.r, b.r), ov1(l.g, b.g), ov1(l.b, b.b));
  if (mode == 7) return min(b / max(1.0 - l, 0.02), 1.0);
  if (mode == 8) return max(b, l);
  if (mode == 9) return b + l * (1.0 - b * 0.5);
  if (mode == 10) return abs(b - l);
  if (mode == 11) return max(b - l, 0.0);
  if (mode == 12) return b + l - 2.0 * b * l;
  if (mode == 13) { vec3 hb = rgb2hsv(b), hl = rgb2hsv(l); return hsv2rgb(vec3(hl.x, hl.y, hb.z)); }
  if (mode == 14) return b * (luma(l) / max(luma(b), 0.02));
  return l;
}
// Lay an effect colour over premultiplied art: on the art it blends with the art's
// colour, beyond the art it is simply drawn with its own opacity.
vec4 fxLayer(vec4 base, vec3 col, float a, int mode) {
  a = clamp(a, 0.0, 1.0);
  vec3 art = unpremul(base);
  vec3 onArt = mix(art, blendMode(mode, art, col), a);
  vec3 rgb = onArt * base.a + col * a * (1.0 - base.a);
  float alpha = base.a + a * (1.0 - base.a);
  return vec4(rgb, alpha);
}
// Same, but the effect only exists behind the art (it never covers the token).
vec4 fxBehind(vec4 base, vec3 col, float a) {
  a = clamp(a, 0.0, 1.0) * (1.0 - base.a);
  return vec4(base.rgb + col * a, base.a + a);
}
`;

export function fragment(uniformDecls, body) {
  return `${HEADER}\n${NOISE}\n${COLOR}\n${uniformDecls}\n${body}`;
}
