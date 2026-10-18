// Filters that use a second image: overlays, masks and shape-changing.
import { rgb, clamp, deg } from './util.mjs';

const f = v => Number(v) || 0;
const placement = {
  uPlace: ['vec4', p => [clamp(p.scaleX, 0.01, 50), clamp(p.scaleY, 0.01, 50), f(p.translationX), f(p.translationY)]],
  uTurn: ['float', p => deg(p.rotation)], uRepeat: ['bool', p => p.repeat === true],
  uKeepAspect: ['bool', p => p.maintainAspectRatio === true],
};
const PLACE = `
// Where on the second image this art point falls; w = 0 outside a non-repeating image.
vec3 imageUV(vec2 art) {
  vec2 q = art - 0.5 - uPlace.zw;
  q = rot2(-uTurn) * q;
  vec2 sc = uPlace.xy;
  if (uKeepAspect > 0.5 && uImageSize.y > 0.0) sc.y *= (uImageSize.y / uImageSize.x) * (uArtSize.x / uArtSize.y);
  vec2 uv = q / sc + 0.5;
  if (uRepeat > 0.5) return vec3(fract(uv), 1.0);
  return vec3(uv, step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0));
}
`;

const sprite = {
  type: 'sprite', order: 760,
  defaults: { imagePath: '', repeat: false, alphaDiscard: true, colorize: false, color: 0xffffff, inverse: false, scaleX: 1, scaleY: 1, translationX: 0, translationY: 0, rotation: 0, alpha: 1, top: true, maintainAspectRatio: false },
  textures: { uImage: p => p.imagePath },
  uniforms: {
    ...placement, uColor: ['vec3', p => rgb(p.color)], uColorize: ['bool', p => p.colorize === true], uInverse: ['bool', p => p.inverse === true],
    uAlpha: ['float', p => clamp(p.alpha, 0, 1)], uTop: ['bool', p => p.top !== false], uClip: ['bool', p => p.alphaDiscard !== false],
  },
  reach: () => 0,
  glsl: `${PLACE}
void main() {
  vec4 base = fxSample(vTextureCoord);
  if (uImageSize.x < 1.0) { gl_FragColor = base; return; }
  vec3 uv = imageUV(fxArt());
  vec4 img = texture2D(uImage, uv.xy) * uv.z;
  vec3 col = unpremul(img);
  float ia = img.a;
  // Inverse: the pattern is the image's empty space, filled with the colour.
  if (uInverse > 0.5) { ia = (1.0 - img.a) * uv.z; col = uColor; }
  if (uColorize > 0.5) col = uColor * (0.25 + 0.95 * luma(col));
  float a = ia * uAlpha * (uClip > 0.5 ? base.a : 1.0);
  gl_FragColor = uTop > 0.5 ? fxLayer(base, col, a, 0) : fxBehind(base, col, a);
}`,
};

// The art shows only where the mask image is opaque.
const spriteMask = {
  type: 'spriteMask', order: 260,
  defaults: { imagePath: '', repeat: false, scaleX: 1, scaleY: 1, translationX: 0, translationY: 0, rotation: 0, alpha: 1, inverse: false, maintainAspectRatio: false },
  textures: { uImage: p => p.imagePath },
  uniforms: { ...placement, uAlpha: ['float', p => clamp(p.alpha, 0, 1)], uInverse: ['bool', p => p.inverse === true] },
  reach: () => 0,
  glsl: `${PLACE}
void main() {
  vec4 base = fxSample(vTextureCoord);
  // Until the mask has loaded the art shows whole: a missing image never hides the token.
  if (uImageSize.x < 1.0) { gl_FragColor = base; return; }
  vec3 uv = imageUV(fxArt());
  float m = texture2D(uImage, uv.xy).a * uv.z;
  if (uInverse > 0.5) m = 1.0 - m;
  gl_FragColor = base * mix(1.0, m, uAlpha);
}`,
};

// The creature dissolves into another image along a glowing, burning seam.
const polymorph = {
  type: 'polymorph', order: 120,
  defaults: { imagePath: '', type: 1, progress: 0, magnify: 1, color: 0xb070ff },
  textures: { uImage: p => p.imagePath },
  uniforms: {
    uProgress: ['float', p => clamp(p.progress, 0, 100) / 100], uStyle: ['int', p => clamp(Math.round(f(p.type)), 1, 9)],
    uMagnify: ['float', p => clamp(p.magnify, 0.1, 4)], uColor: ['vec3', p => rgb(p.color)],
  },
  reach: () => 0,
  glsl: `
void main() {
  vec4 base = fxSample(vTextureCoord);
  if (uImageSize.x < 1.0) { gl_FragColor = base; return; }
  vec2 art = fxArt();
  vec2 iuv = (art - 0.5) / uMagnify + 0.5;
  vec4 img = texture2D(uImage, clamp(iuv, 0.0, 1.0)) * step(0.0, iuv.x) * step(iuv.x, 1.0) * step(0.0, iuv.y) * step(iuv.y, 1.0);
  int s = int(uStyle + 0.5);
  float field;
  if (s == 2) field = 1.0 - art.y;                       // wipe upward
  else if (s == 3) field = length(art - 0.5) * 1.4;     // from the centre out
  else if (s == 4) field = hash21(floor(art * 24.0));   // pixel scatter
  else field = fbm(art * 6.0) + 0.5;                    // burning dissolve
  float p = uProgress * 1.2 - 0.1;
  float k = smoothstep(p - 0.05, p + 0.05, field);
  float seam = (1.0 - smoothstep(0.0, 0.08, abs(field - p))) * step(0.001, uProgress) * step(uProgress, 0.999);
  vec4 o = mix(img, base, k);
  o.rgb += uColor * seam * max(o.a, 0.6);
  o.a = max(o.a, seam * 0.8);
  gl_FragColor = o;
}`,
};

export const IMAGE_SPECS = [sprite, spriteMask, polymorph];
