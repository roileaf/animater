// Colour and image-treatment filters: they change how the art looks, never its outline.
import { rgb, deg, clamp } from './util.mjs';

const f = v => Number(v) || 0;

const adjustment = {
  type: 'adjustment', order: 300,
  defaults: { gamma: 1, saturation: 1, contrast: 1, brightness: 1, red: 1, green: 1, blue: 1, alpha: 1 },
  uniforms: {
    uGamma: ['float', p => Math.max(0.01, f(p.gamma))], uSaturation: ['float', p => f(p.saturation)],
    uContrast: ['float', p => f(p.contrast)], uBrightness: ['float', p => f(p.brightness)],
    uChannels: ['vec3', p => [f(p.red), f(p.green), f(p.blue)]], uAlpha: ['float', p => clamp(p.alpha, 0, 1)],
  },
  reach: () => 0,
  glsl: `
void main() {
  vec4 c = fxSample(vTextureCoord);
  vec3 col = pow(max(unpremul(c), 0.0), vec3(1.0 / uGamma));
  col = mix(vec3(luma(col)), col, uSaturation);
  col = (col - 0.5) * uContrast + 0.5;
  col = clamp(col * uBrightness * uChannels, 0.0, 1.0);
  float a = c.a * uAlpha;
  gl_FragColor = vec4(col * a, a);
}`,
};

// Colourise like a map-maker's tint: shading is kept, hue comes from the tint.
const ddTint = {
  type: 'ddTint', order: 300,
  defaults: { tint: [1, 1, 1] },
  uniforms: { uTint: ['vec3', p => rgb(p.tint)] },
  reach: () => 0,
  glsl: `
void main() {
  vec4 c = fxSample(vTextureCoord);
  vec3 col = unpremul(c);
  float l = luma(col);
  vec3 tinted = uTint * (0.35 + 1.1 * l) * mix(vec3(1.0), col / max(l, 0.05), 0.25);
  gl_FragColor = vec4(clamp(mix(col, tinted, 0.85), 0.0, 1.0) * c.a, c.a);
}`,
};

const replaceColor = {
  type: 'replaceColor', order: 300,
  defaults: { originalColor: [1, 0, 0], newColor: [0, 0, 1], epsilon: 0.4 },
  uniforms: { uFrom: ['vec3', p => rgb(p.originalColor)], uTo: ['vec3', p => rgb(p.newColor)], uEpsilon: ['float', p => clamp(p.epsilon, 0.001, 2)] },
  reach: () => 0,
  glsl: `
void main() {
  vec4 c = fxSample(vTextureCoord);
  vec3 col = unpremul(c);
  // Compare hue and saturation more than brightness, so shaded areas of the colour match too.
  vec3 a = rgb2hsv(col), b = rgb2hsv(uFrom);
  float dh = min(abs(a.x - b.x), 1.0 - abs(a.x - b.x)) * 2.0;
  float d = length(vec3(dh * 1.4, (a.y - b.y) * 0.8, (a.z - b.z) * 0.45));
  float m = 1.0 - smoothstep(uEpsilon * 0.55, uEpsilon, d);
  vec3 hb = rgb2hsv(uTo);
  vec3 swapped = hsv2rgb(vec3(hb.x, hb.y * mix(1.0, a.y / max(b.y, 0.05), 0.5), clamp(a.z * hb.z / max(b.z, 0.05), 0.0, 1.0)));
  gl_FragColor = vec4(mix(col, swapped, m) * c.a, c.a);
}`,
};

// Up to four stops; linear (0), radial (1) or conic (2), laid over the art only.
const colorGradient = {
  type: 'colorGradient', order: 320,
  defaults: { stops: [{ offset: 0, color: 0xff0000, alpha: 1 }, { offset: 1, color: 0x0000ff, alpha: 1 }], type: 0, angle: 90, alpha: 1, replace: false },
  uniforms: {
    uOffsets: ['vec4', p => { const s = stops(p); return [0, 1, 2, 3].map(i => s[Math.min(i, s.length - 1)].offset); }],
    uS0: ['vec4', p => stopColor(p, 0)], uS1: ['vec4', p => stopColor(p, 1)], uS2: ['vec4', p => stopColor(p, 2)], uS3: ['vec4', p => stopColor(p, 3)],
    uKind: ['int', p => clamp(Math.round(+p.type || 0), 0, 2)], uAngle: ['float', p => deg(p.angle)],
    uAlpha: ['float', p => clamp(p.alpha, 0, 1)], uReplace: ['bool', p => p.replace === true],
  },
  reach: () => 0,
  glsl: `
vec4 stopAt(float t) {
  vec4 c = uS0;
  c = mix(c, uS1, smoothstep(uOffsets.x, max(uOffsets.y, uOffsets.x + 1e-3), t));
  c = mix(c, uS2, smoothstep(uOffsets.y, max(uOffsets.z, uOffsets.y + 1e-3), t));
  c = mix(c, uS3, smoothstep(uOffsets.z, max(uOffsets.w, uOffsets.z + 1e-3), t));
  return c;
}
void main() {
  vec4 c = fxSample(vTextureCoord);
  vec2 q = fxArt() - 0.5;
  float t;
  if (uKind < 0.5) t = dot(q, vec2(cos(uAngle), sin(uAngle))) + 0.5;
  else if (uKind < 1.5) t = length(q) * 2.0;
  else t = fract(atan(q.y, q.x) / TAU + uAngle / TAU);
  vec4 g = stopAt(clamp(t, 0.0, 1.0));
  vec3 col = unpremul(c);
  vec3 laid = uReplace > 0.5 ? g.rgb * (0.4 + 0.8 * luma(col)) : blendMode(5, col, g.rgb);
  gl_FragColor = vec4(mix(col, laid, g.a * uAlpha) * c.a, c.a);
}`,
};
function stops(p) {
  const list = Array.isArray(p.stops) ? p.stops.filter(s => s && Number.isFinite(+s.offset)).slice(0, 4) : [];
  return list.length ? list.sort((a, b) => a.offset - b.offset) : colorGradient.defaults.stops;
}
function stopColor(p, i) { const s = stops(p), st = s[Math.min(i, s.length - 1)]; return [...rgb(st.color), clamp(st.alpha ?? 1, 0, 1)]; }

// Halftone print: dot size follows brightness on a rotated screen.
const dot = {
  type: 'dot', order: 320,
  defaults: { scale: 1, angle: 5, grayscale: true },
  uniforms: { uScale: ['float', p => clamp(p.scale, 0.1, 10)], uAngle: ['float', p => +p.angle || 0], uGray: ['bool', p => p.grayscale !== false] },
  reach: () => 0,
  glsl: `
void main() {
  vec4 c = fxSample(vTextureCoord);
  float cell = 6.0 / uScale;
  vec2 q = rot2(uAngle) * fxCanvas() / cell;
  vec2 g = fract(q) - 0.5;
  vec3 col = unpremul(c);
  float ink = 1.0 - luma(col);
  float r = sqrt(ink) * 0.62;
  float aa = 1.5 / (cell * uZoom);
  float d = smoothstep(r + aa, r - aa, length(g));
  vec3 paper = uGray > 0.5 ? vec3(0.96, 0.95, 0.92) : mix(col, vec3(1.0), 0.75);
  vec3 inkCol = uGray > 0.5 ? vec3(0.08) : col * 0.55;
  gl_FragColor = vec4(mix(paper, inkCol, d) * c.a, c.a);
}`,
};

// Text-mode art: each cell becomes a procedural glyph whose density follows brightness.
const ascii = {
  type: 'ascii', order: 320,
  defaults: { size: 8, color: 0x33ff66, colorize: false },
  uniforms: { uSize: ['float', p => clamp(p.size, 3, 64)], uColor: ['vec3', p => rgb(p.color)], uColorize: ['bool', p => p.colorize === true] },
  reach: () => 0,
  glsl: `
float glyph(vec2 g, float level) {
  // g in 0..1 within the cell; five ink levels from dot to block.
  vec2 c = abs(g - 0.5);
  if (level < 0.2) return 0.0;
  if (level < 0.4) return step(length(g - vec2(0.5, 0.75)), 0.12);
  if (level < 0.6) return step(c.y, 0.08) * step(c.x, 0.32) + step(c.x, 0.08) * step(c.y, 0.32);
  if (level < 0.8) return step(abs(c.x - c.y), 0.09) * step(max(c.x, c.y), 0.38) + step(c.y, 0.08) * step(c.x, 0.38);
  return step(max(c.x, c.y), 0.4) * (1.0 - step(max(c.x, c.y), 0.2) * 0.6);
}
void main() {
  vec2 q = fxCanvas() / uSize;
  vec2 cellCentre = (floor(q) + 0.5) * uSize;
  vec4 s = fxAt(cellCentre - fxCanvas());
  vec3 col = unpremul(s);
  float ink = glyph(fract(q), luma(col) * s.a);
  vec3 tone = uColorize > 0.5 ? uColor : col * 1.3;
  float a = max(fxSample(vTextureCoord).a, s.a) * mix(0.15, 1.0, ink);
  gl_FragColor = vec4(mix(vec3(0.02), tone, ink) * a, a);
}`,
};

const pixel = {
  type: 'pixel', order: 320,
  defaults: { sizeX: 4, sizeY: 4 },
  uniforms: { uCell: ['vec2', p => [clamp(p.sizeX, 1, 200), clamp(p.sizeY, 1, 200)]] },
  reach: () => 0,
  glsl: `
void main() {
  vec2 q = fxCanvas();
  vec2 centre = (floor(q / uCell) + 0.5) * uCell;
  gl_FragColor = fxAt(centre - q);
}`,
};

const rgbSplit = {
  type: 'rgbSplit', order: 330,
  defaults: { redX: -6, redY: 0, greenX: 0, greenY: 6, blueX: 0, blueY: 0 },
  uniforms: { uR: ['vec2', p => [f(p.redX), f(p.redY)]], uG: ['vec2', p => [f(p.greenX), f(p.greenY)]], uB: ['vec2', p => [f(p.blueX), f(p.blueY)]] },
  reach: p => Math.max(...['redX', 'redY', 'greenX', 'greenY', 'blueX', 'blueY'].map(k => Math.abs(f(p[k])))) + 2,
  glsl: `
void main() {
  vec4 r = fxAt(-uR), g = fxAt(-uG), b = fxAt(-uB);
  gl_FragColor = vec4(r.r, g.g, b.b, max(max(r.a, g.a), b.a));
}`,
};

// Old monitor: barrel curve, scanlines, grain and vignette on the art.
const crt = {
  type: 'crt', order: 340,
  defaults: { curvature: 1, lineWidth: 1, lineContrast: 0.25, verticalLine: false, noise: 0.3, noiseSize: 1, vignetting: 0.3, vignettingAlpha: 1, vignettingBlur: 0.3, seed: 0, time: 0 },
  timeScale: 1,
  uniforms: {
    uCurve: ['float', p => clamp(p.curvature, 0, 10)], uLine: ['vec2', p => [clamp(p.lineWidth, 0.2, 40), clamp(p.lineContrast, 0, 1)]],
    uVertical: ['bool', p => p.verticalLine === true], uNoise: ['vec2', p => [clamp(p.noise, 0, 1), clamp(p.noiseSize, 0.2, 20)]],
    uVig: ['vec3', p => [clamp(p.vignetting, 0, 1), clamp(p.vignettingAlpha, 0, 1), clamp(p.vignettingBlur, 0.01, 1)]], uSeedP: ['float', p => f(p.seed)],
  },
  reach: () => 0,
  glsl: `
void main() {
  vec2 a = fxArt() - 0.5;
  vec2 bent = a * (1.0 + uCurve * 0.04 * dot(a, a) * 4.0);
  vec4 c = fxAtArt(bent + 0.5);
  float inside = step(abs(bent.x), 0.5) * step(abs(bent.y), 0.5);
  vec3 col = unpremul(c);
  float coord = uVertical > 0.5 ? fxCanvas().x : fxCanvas().y;
  float line = 0.5 + 0.5 * cos(TAU * coord / (uLine.x * 3.0) + uTime * 3.0);
  col *= 1.0 - uLine.y * line;
  float n = hash21(floor(fxCanvas() / uNoise.y) + floor(uTime * 24.0) + uSeedP * 91.0) - 0.5;
  col += n * uNoise.x * 0.35;
  float v = smoothstep(0.5, 0.5 - uVig.z * 0.5, length(bent) * (0.6 + uVig.x));
  col *= mix(1.0 - uVig.y, 1.0, v);
  float alpha = c.a * inside;
  gl_FragColor = vec4(clamp(col, 0.0, 1.0) * alpha, alpha);
}`,
};

const oldfilm = {
  type: 'oldfilm', order: 340,
  defaults: { sepia: 0.3, noise: 0.3, noiseSize: 1, scratch: 0.5, scratchDensity: 0.3, scratchWidth: 1, vignetting: 0.3, vignettingAlpha: 1, vignettingBlur: 0.3, seed: 0 },
  uniforms: {
    uSepia: ['float', p => clamp(p.sepia, 0, 1)], uNoise: ['vec2', p => [clamp(p.noise, 0, 1), clamp(p.noiseSize, 0.2, 20)]],
    uScratch: ['vec3', p => [clamp(p.scratch, -1, 1), clamp(p.scratchDensity, 0, 1), clamp(p.scratchWidth, 0.2, 20)]],
    uVig: ['vec3', p => [clamp(p.vignetting, 0, 1), clamp(p.vignettingAlpha, 0, 1), clamp(p.vignettingBlur, 0.01, 1)]], uSeedP: ['float', p => f(p.seed)],
  },
  reach: () => 0,
  glsl: `
void main() {
  vec4 c = fxSample(vTextureCoord);
  vec3 col = unpremul(c);
  vec3 sep = vec3(dot(col, vec3(0.393, 0.769, 0.189)), dot(col, vec3(0.349, 0.686, 0.168)), dot(col, vec3(0.272, 0.534, 0.131)));
  col = mix(col, sep, uSepia);
  float frame = floor(uSeedP * 997.0);
  vec2 q = fxCanvas();
  float grain = hash21(floor(q / uNoise.y) + frame * 13.0) - 0.5;
  col += grain * uNoise.x * 0.4;
  // A few vertical scratches that jump between frames.
  float sx = q.x / max(uTokenSize.x, 1.0) * 40.0;
  float lane = floor(sx);
  float on = step(1.0 - uScratch.y * 0.25, hash11(lane * 7.3 + frame));
  float w = abs(fract(sx) - 0.5) * 40.0 / uScratch.z;
  float scratch = on * smoothstep(1.0, 0.0, w) * (0.6 + 0.4 * gnoise(vec2(lane, q.y * 0.05 + frame)));
  col += scratch * uScratch.x * 0.5;
  float v = smoothstep(0.5, 0.5 - uVig.z * 0.5, length(fxArt() - 0.5) * (0.6 + uVig.x));
  col *= mix(1.0 - uVig.y, 1.0, v);
  gl_FragColor = vec4(clamp(col, 0.0, 1.0) * c.a, c.a);
}`,
};

export const COLOR_SPECS = [adjustment, ddTint, replaceColor, colorGradient, dot, ascii, pixel, rgbSplit, crt, oldfilm];
