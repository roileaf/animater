// Filters that move the art's pixels: twists, bulges, waves, blurs, copies, transforms.
import { clamp, rgb } from './util.mjs';

const f = v => Number(v) || 0;

const twist = {
  type: 'twist', order: 200,
  defaults: { radiusPercent: 100, angle: 2, offsetX: 0.5, offsetY: 0.5 },
  uniforms: {
    uRadius: ['float', p => clamp(p.radiusPercent, 1, 1000) / 100], uAngle: ['float', p => f(p.angle)],
    uAnchor: ['vec2', p => [f(p.offsetX ?? 0.5), f(p.offsetY ?? 0.5)]],
  },
  reach: (p, c) => Math.max(0, clamp(p.radiusPercent, 1, 1000) / 100 - 1) * c.size * 0.5,
  glsl: `
void main() {
  vec2 centre = fxArtToCanvas(uAnchor);
  vec2 d = fxCanvas() - centre;
  float r = uRadius * fxTokenRadius();
  float k = 1.0 - smoothstep(0.0, r, length(d));
  vec2 src = centre + rot2(-uAngle * k * k) * d;
  gl_FragColor = fxAt(src - fxCanvas());
}`,
};

const bulgepinch = {
  type: 'bulgepinch', order: 200,
  defaults: { radiusPercent: 100, strength: 0.5, centerX: 0.5, centerY: 0.5 },
  uniforms: {
    uRadius: ['float', p => clamp(p.radiusPercent, 1, 1000) / 100], uStrength: ['float', p => clamp(p.strength, -1, 1)],
    uAnchor: ['vec2', p => [f(p.centerX ?? 0.5), f(p.centerY ?? 0.5)]],
  },
  reach: (p, c) => Math.max(0, clamp(p.strength, -1, 1)) * c.size * 0.35,
  glsl: `
void main() {
  vec2 centre = fxArtToCanvas(uAnchor);
  vec2 d = fxCanvas() - centre;
  float r = uRadius * fxTokenRadius();
  float x = clamp(length(d) / r, 0.0, 1.0);
  // Bulge (strength > 0) pulls samples toward the centre; pinch pushes them out.
  float k = uStrength > 0.0 ? mix(1.0 - uStrength * 0.8, 1.0, smoothstep(0.0, 1.0, x)) : 1.0 - uStrength * 0.8 * (1.0 - x) * x * 2.0;
  gl_FragColor = fxAt(centre + d * k - fxCanvas());
}`,
};

// An expanding ring that refracts and brightens what it passes.
const shockwave = {
  type: 'shockwave', order: 210,
  defaults: { time: 0, amplitude: 8, wavelength: 60, radius: -1, brightness: 1.2, speed: 25, centerX: 0.5, centerY: 0.5 },
  uniforms: {
    uRing: ['float', p => Math.max(0, f(p.time) * f(p.speed))], uAmp: ['float', p => clamp(p.amplitude, 0, 80)],
    uWave: ['float', p => clamp(p.wavelength, 4, 600)], uMax: ['float', p => f(p.radius)],
    uBright: ['float', p => clamp(p.brightness, 0, 4)], uAnchor: ['vec2', p => [f(p.centerX ?? 0.5), f(p.centerY ?? 0.5)]],
  },
  reach: (p, c) => Math.min(f(p.radius) > 0 ? f(p.radius) : c.size * 2, c.size * 2.5),
  glsl: `
void main() {
  vec2 centre = fxArtToCanvas(uAnchor);
  vec2 d = fxCanvas() - centre;
  float dist = length(d);
  float maxR = uMax > 0.0 ? uMax : fxTokenRadius() * 4.0;
  float fade = 1.0 - smoothstep(maxR * 0.6, maxR, uRing);
  float x = (dist - uRing) / (uWave * 0.5);
  float band = exp(-x * x * 2.0) * fade;
  vec2 dir = dist > 0.0 ? d / dist : vec2(0.0);
  vec4 c = fxAt(-dir * sin(x * 2.2) * uAmp * band);
  float glowA = band * 0.35 * max(uBright - 1.0, 0.0);
  c.rgb *= 1.0 + band * (uBright - 1.0);
  gl_FragColor = vec4(c.rgb + vec3(glowA) * (1.0 - c.a) * 0.5, max(c.a, glowA * 0.4));
}`,
};

// Ripples spreading over the art from an anchor point.
const wave = {
  type: 'wave', order: 210,
  defaults: { time: 0, anchorX: 0.5, anchorY: 0.5, strength: 0.015, frequency: 120, color: 0xffffff, maxIntensity: 1.6, minIntensity: 0.9 },
  timeScale: 1 / 0.0085 / 1000 * 1.6,
  uniforms: {
    uAnchor: ['vec2', p => [f(p.anchorX), f(p.anchorY)]], uStrength: ['float', p => clamp(p.strength, 0, 0.3)],
    uFreq: ['float', p => clamp(p.frequency, 1, 1000)], uColor: ['vec3', p => rgb(p.color)],
    uIntensity: ['vec2', p => [clamp(p.minIntensity, 0, 4), clamp(p.maxIntensity, 0, 4)]],
  },
  reach: (p, c) => clamp(p.strength, 0, 0.3) * c.size * 0.6,
  glsl: `
void main() {
  vec2 a = fxArt();
  vec2 d = a - uAnchor;
  float dist = length(d);
  float phase = dist * uFreq * 0.25 - uTime * 2.5;
  float s = sin(phase);
  vec2 dir = dist > 0.0 ? d / dist : vec2(0.0);
  vec4 c = fxAtArt(a + dir * s * uStrength);
  float light = mix(uIntensity.x, uIntensity.y, 0.5 + 0.5 * cos(phase));
  vec3 col = unpremul(c) * mix(vec3(1.0), uColor, 0.35) * light;
  gl_FragColor = vec4(clamp(col, 0.0, 1.0) * c.a, c.a);
}`,
};

// Heat-haze shimmer from flowing noise (no mask image needed).
const distortion = {
  type: 'distortion', order: 210,
  defaults: { maskSpriteX: 0, maskSpriteY: 0, maskSpriteScaleX: 5, maskSpriteScaleY: 5, amount: 6 },
  uniforms: {
    uFlow: ['vec2', p => [f(p.maskSpriteX) * 0.02, f(p.maskSpriteY) * 0.02]],
    uScale: ['vec2', p => [clamp(p.maskSpriteScaleX, 0.2, 40), clamp(p.maskSpriteScaleY, 0.2, 40)]],
    uAmount: ['float', p => clamp(p.amount, 0, 60)],
  },
  reach: p => clamp(p.amount, 0, 60) + 2,
  glsl: `
void main() {
  vec2 q = fxCanvas() / (fxTokenRadius() * 0.08 * (uScale.x + uScale.y) * 0.5 + 1.0);
  vec2 off = vec2(fbm(q + uFlow), fbm(q.yx * 1.1 - uFlow.yx + 4.7)) * 2.0;
  gl_FragColor = fxAt(off * uAmount);
}`,
};

const zoomblur = {
  type: 'zoomblur', order: 230,
  defaults: { strength: 0.1, innerRadiusPercent: 50, radiusPercent: 100, centerX: 0.5, centerY: 0.5 },
  uniforms: {
    uStrength: ['float', p => clamp(p.strength, 0, 1)], uInner: ['float', p => clamp(p.innerRadiusPercent, 0, 1000) / 100],
    uOuter: ['float', p => clamp(p.radiusPercent, 1, 1000) / 100], uAnchor: ['vec2', p => [f(p.centerX ?? 0.5), f(p.centerY ?? 0.5)]],
  },
  reach: (p, c) => clamp(p.strength, 0, 1) * c.size * 0.5,
  glsl: `
void main() {
  vec2 centre = fxArtToCanvas(uAnchor);
  vec2 d = fxCanvas() - centre;
  float r = fxTokenRadius();
  float k = smoothstep(uInner * r, max(uOuter, uInner + 0.01) * r, length(d)) * uStrength;
  vec4 acc = vec4(0.0);
  float jitter = fxDither();
  for (int i = 0; i < 16; i++) {
    float t = (float(i) + jitter) / 16.0;
    acc += fxAt(-d * k * t);
  }
  gl_FragColor = acc / 16.0;
}`,
};

const blur = {
  type: 'blur', order: 240,
  // blurX / blurY, when above zero, override `blur` on their axis.
  defaults: { blur: 2, blurX: 0, blurY: 0 },
  uniforms: { uRadius: ['vec2', p => { const b = clamp(p.blur, 0, 60), x = f(p.blurX) > 0 ? f(p.blurX) : b, y = f(p.blurY) > 0 ? f(p.blurY) : b; return [clamp(x, 0, 60) * 2.2, clamp(y, 0, 60) * 2.2]; }] },
  reach: p => Math.max(clamp(p.blur, 0, 60), f(p.blurX), f(p.blurY)) * 2.2 + 2,
  glsl: `
void main() {
  if (max(uRadius.x, uRadius.y) < 0.3) { gl_FragColor = fxSample(vTextureCoord); return; }
  vec4 acc = vec4(0.0); float wsum = 0.0, d = fxDither() * TAU;
  for (int k = 0; k < 28; k++) {
    float r = sqrt((float(k) + 0.5) / 28.0);
    float ang = d + float(k) * 2.39996;
    float w = exp(-r * r * 2.0);
    acc += fxAt(vec2(cos(ang), sin(ang)) * r * uRadius) * w;
    wsum += w;
  }
  gl_FragColor = acc / wsum;
}`,
};

// Illusory duplicates drifting around the creature, which stays crisp on top.
const images = {
  type: 'images', order: 180,
  defaults: { time: 0, nbImage: 4, alphaImg: 0.6, alphaChr: 0.5, blend: 4, ampX: 0.1, ampY: 0.1 },
  timeScale: 1 / 0.001 / 1000,
  uniforms: {
    uCount: ['float', p => clamp(p.nbImage, 1, 9)], uImgAlpha: ['float', p => clamp(p.alphaImg, 0, 1)],
    uFringe: ['float', p => clamp(p.alphaChr, 0, 1)], uAmp: ['vec2', p => [clamp(p.ampX, 0, 1), clamp(p.ampY, 0, 1)]],
  },
  reach: (p, c) => Math.max(clamp(p.ampX, 0, 1), clamp(p.ampY, 0, 1)) * c.size + 4,
  glsl: `
void main() {
  vec4 base = fxSample(vTextureCoord);
  vec4 ghosts = vec4(0.0);
  vec2 span = uAmp * uTokenSize;
  for (int i = 0; i < 9; i++) {
    float fi = float(i);
    if (fi >= floor(uCount + 0.5)) break;
    float ph = uTime * (0.9 + 0.13 * fi) + fi * TAU / max(uCount, 1.0);
    vec2 off = vec2(cos(ph), sin(ph * 1.3 + fi)) * span;
    vec4 g = fxAt(-off);
    // Chromatic fringe on the copies sells them as illusions.
    vec4 gr = fxAt(-off + vec2(2.0, 0.0)), gb = fxAt(-off - vec2(2.0, 0.0));
    vec3 tint = mix(g.rgb, vec3(gr.r, g.g, gb.b), uFringe);
    ghosts = max(ghosts, vec4(tint * vec3(0.85, 0.9, 1.1), g.a) * (0.7 - 0.04 * fi));
  }
  ghosts *= uImgAlpha;
  gl_FragColor = base + ghosts * (1.0 - base.a);
}`,
};

// Moves, turns and squashes the art inside the filter, so the token itself never moves.
const transform = {
  type: 'transform', order: 100,
  defaults: { translationX: 0, translationY: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0.5, pivotY: 0.5 },
  uniforms: {
    uMove: ['vec2', p => [f(p.translationX), f(p.translationY)]], uRotation: ['float', p => f(p.rotation) * Math.PI / 180],
    uScale: ['vec2', p => [clamp(p.scaleX, 0.05, 10), clamp(p.scaleY, 0.05, 10)]], uPivot: ['vec2', p => [f(p.pivotX), f(p.pivotY)]],
  },
  reach: (p, c) => c.size * (Math.max(Math.abs(f(p.translationX)), Math.abs(f(p.translationY))) + Math.max(0, clamp(p.scaleX, 0.05, 10) - 1, clamp(p.scaleY, 0.05, 10) - 1) * 0.5 + (f(p.rotation) ? 0.22 : 0)) + 2,
  glsl: `
void main() {
  // Work in canvas pixels around the pivot so translation is in token sizes.
  vec2 pivot = fxArtToCanvas(uPivot);
  vec2 q = fxCanvas() - pivot - uMove * uTokenSize;
  q = rot2(-uRotation) * q / uScale;
  gl_FragColor = fxAt(pivot + q - fxCanvas());
}`,
};

export const WARP_SPECS = [twist, bulgepinch, shockwave, wave, distortion, zoomblur, blur, images, transform];
