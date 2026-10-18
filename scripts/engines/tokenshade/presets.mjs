// Tokenshade's built-in presets. Preset names match Token Magic FX's, so recipes and
// catalogs made with Token Magic keep working; every value
// here is tuned for animater's own shaders.
import { specFor } from './filters/index.mjs';

export const LIBRARY = { TOKEN: 'tokenshade', REGION: 'tokenshade-region', CUSTOM: 'tokenshade-custom' };
// Library ids saved before Tokenshade had its own (recipes, favorites, imports).
const LEGACY = { 'tmfx-main': LIBRARY.TOKEN, 'tmfx-region': LIBRARY.REGION, 'tmfx-template': LIBRARY.REGION, 'animater-custom': LIBRARY.CUSTOM };
export const libraryId = id => (typeof id === 'string' && Object.hasOwn(LEGACY, id) ? LEGACY[id] : id);

// Animation helpers. `flow(type, rate)`: the shader's natural motion `rate` times per second.
const flow = (type, rate = 1) => ({ animType: 'move', speed: rate / (specFor(type).timeScale * 1000) });
const cos = (a, b, ms, sync = true) => ({ animType: sync ? 'syncCosOscillation' : 'cosOscillation', loopDuration: ms, val1: a, val2: b });
const sin = (a, b, ms, sync = true) => ({ animType: sync ? 'syncSinOscillation' : 'sinOscillation', loopDuration: ms, val1: a, val2: b });
const chaos = (a, b, ms) => ({ animType: 'syncChaoticOscillation', loopDuration: ms, val1: a, val2: b, chaosFactor: 0.35 });
const hue = (a, b, ms, sync = false) => ({ animType: sync ? 'syncColorOscillation' : 'colorOscillation', loopDuration: ms, val1: a, val2: b });

const F = (filterType, params = {}, animated = undefined) => ({ filterType, ...params, ...(animated ? { animated } : {}) });
const timed = (type, rate, params = {}, more = {}) => F(type, params, { time: flow(type, rate), ...more });

const token = (name, ...params) => ({ name, library: LIBRARY.TOKEN, params });
const region = (name, ...params) => ({ name, library: LIBRARY.REGION, params });

const FIELD = (shieldType, color, extra = {}, rate = 1, more = {}) =>
  timed('field', rate, { shieldType, color, gridPadding: 1.5, intensity: 1, lightAlpha: 0.6, lightSize: 0.5, scale: 1, radius: 1, blend: 2, ...extra }, more);

const naturalFire = (extra = {}, more = {}) => timed('fire', 1, { intensity: 1, color: 0xffffff, amplitude: 1, blend: 9, fireBlend: 1, ...extra }, more);
const fireAura = (color, thick, more = {}) => timed('xglow', 1, { auraType: 2, color, thickness: thick, scale: 4, auraIntensity: 1.8, subAuraIntensity: 1, threshold: 0.35, discard: false }, more);
const iceAura = (more = {}) => timed('xglow', 0.6, { auraType: 1, color: 0x7fd4ff, thickness: 3.5, scale: 3, auraIntensity: 1.6, subAuraIntensity: 0.55, threshold: 0.3, discard: false },
  { thickness: cos(3, 4.2, 3000, false), auraIntensity: cos(1.3, 2, 3000, false), ...more });

export const PRESETS = [
  // ── Token library ──────────────────────────────────────────────────────────
  token('bevel', F('bevel', { rotation: 0, thickness: 4, lightColor: 0xffe2a8, lightAlpha: 0.75, shadowColor: 0x241018, shadowAlpha: 0.65 }, { rotation: { animType: 'syncRotation', loopDuration: 4000, clockWise: true } })),
  token('adjustment', F('adjustment', { saturation: 1.4, brightness: 1.15, contrast: 1.25, gamma: 1, red: 1.15, green: 0.9, blue: 0.9, alpha: 1 }, { alpha: cos(0.35, 1, 5000) })),
  token('dropshadow', F('shadow', { rotation: 50, distance: 14, blur: 4, alpha: 0.65, color: 0x000000 })),
  token('outline', F('outline', { thickness: 2, color: 0xee5f35, alpha: 1 }, { thickness: cos(1.5, 4.5, 1600) })),
  token('glow', F('glow', { outerStrength: 4.5, innerStrength: 1, color: 0x2ee8a0, distance: 14 }, { color: hue(0x1bb07a, 0x7dffcf, 3000) })),
  token('bloom', F('xbloom', { threshold: 0.45, bloomScale: 1, brightness: 1.05, blur: 2 }, { bloomScale: cos(0.2, 1.8, 2400), threshold: cos(0.25, 0.75, 1800) })),
  token('distortion', F('distortion', { maskSpriteScaleX: 5, maskSpriteScaleY: 5, amount: 5 }, { maskSpriteX: { animType: 'move', speed: 0.05 }, maskSpriteY: { animType: 'move', speed: 0.07 } })),
  token('oldfilm',
    F('oldfilm', { sepia: 0.6, noise: 0.25, noiseSize: 1, scratch: 0.7, scratchDensity: 0.4, scratchWidth: 1.2, vignetting: 0.3, vignettingAlpha: 0.7, vignettingBlur: 0.3 }, { seed: { animType: 'randomNumberPerLoop', loopDuration: 90, val1: 0, val2: 1 }, vignetting: cos(0.25, 0.4, 2000) }),
    F('outline', { thickness: 1, color: 0x1c140c, alpha: 0.8 })),
  token('twist', F('twist', { radiusPercent: 110, angle: 0 }, { angle: sin(-1.6, 1.6, 9000, false) })),
  token('bulge', F('bulgepinch', { radiusPercent: 160, strength: 0 }, { strength: cos(0, 0.4, 2000, false) })),
  token('blur', F('blur', { blur: 0 }, { blurX: cos(0, 5, 900), blurY: cos(0, 5, 1300) })),
  token('zoomblur', F('zoomblur', { strength: 0.18, innerRadiusPercent: 45, radiusPercent: 110 }, { innerRadiusPercent: sin(40, 55, 600, false) })),
  token('shockwave', F('shockwave', { amplitude: 7, wavelength: 50, brightness: 1.4, speed: 30, radius: -1 }, { time: cos(0, 9, 1800, false) })),
  token('zapshadow', F('zapshadow', { alphaTolerance: 0.5 })),
  token('rays', timed('ray', 1, { color: 0xd1b06b, alpha: 0.55, divisor: 28, anchorX: 0.5, anchorY: 0.1, alphaDiscard: true })),
  token('fog', timed('fog', 1, { color: 0x1a1d22, density: 0.6, dimX: 1, dimY: 1 })),
  token('fumes', timed('fumes', 1, { color: 0x9c9c9c, blend: 2 })),
  token('electric', timed('electric', 1, { color: 0x9fd8ff, blend: 1, intensity: 4 })),
  token('fire', naturalFire({}, { intensity: cos(0.85, 1.6, 9000), amplitude: cos(0.95, 1.25, 4400) })),
  token('waves', timed('wave', 1, { strength: 0.012, frequency: 110, color: 0xbfe8ff, maxIntensity: 1.35, minIntensity: 0.9 }, { anchorX: chaos(0.2, 0.8, 20000), anchorY: sin(0.2, 0.8, 20000) })),
  token('flood', timed('flood', 1, { color: 0x1a5fd6, billowy: 0.45, tintIntensity: 0.55, glint: 0.35, scale: 70 })),
  token('smoke', timed('smoke', 1, { color: 0x50a0dd, blend: 2, dimX: 0.6, dimY: 1 })),
  token('images', timed('images', 1, { nbImage: 4, alphaImg: 0.55, alphaChr: 0.4, ampX: 0.12, ampY: 0.1 })),
  token('chaos-images', timed('images', 1, { nbImage: 5, alphaImg: 0.6, alphaChr: 0.8, ampX: 0.15, ampY: 0.15 },
    { ampX: chaos(0.02, 0.28, 2000), ampY: chaos(0.02, 0.28, 1650), nbImage: { animType: 'syncSinOscillation', loopDuration: 1400, val1: 2, val2: 8, wantInteger: true } })),
  token('spectral-images', timed('images', 1, { nbImage: 3, alphaImg: 0.5, alphaChr: 0.6, ampX: 0.1, ampY: 0.1 }, { ampX: cos(0.02, 0.2, 2500), ampY: cos(0.02, 0.22, 2500), alphaImg: sin(0.25, 0.75, 2500) })),
  token('hexa-field', FIELD(2, 0xcc33cc, { gridPadding: 1.5, lightAlpha: 0.5 })),
  token('fire-field', FIELD(1, 0xff6a1f, { gridPadding: 2, intensity: 1.1, lightAlpha: 0.9, lightSize: 0.7 })),
  token('smoke-field', FIELD(3, 0x5a6470, { gridPadding: 1.5, intensity: 1.1, lightAlpha: 0.5, lightSize: 0.7 })),
  token('earth-field', FIELD(4, 0xb98a5c, { gridPadding: 2, intensity: 1.15, lightAlpha: 0.5, lightSize: 0.7 })),
  token('earth-field-top', FIELD(5, 0xa9a29a, { gridPadding: 2.5, intensity: 1.2, lightAlpha: 0.6, lightSize: 0.7, chromatic: true })),
  token('air-field', FIELD(6, 0x9fd6e8, { gridPadding: 1.2, lightAlpha: 0.7, lightSize: 0.7 })),
  token('magic-field', FIELD(7, 0xb48cff, { gridPadding: 1, intensity: 0.9, lightAlpha: 0.7, lightSize: 0.45 })),
  token('chromatic-field', FIELD(8, 0xaaaaaa, { gridPadding: 1.8, lightAlpha: 0.8, lightSize: 0.4, chromatic: true }, 3)),
  token('water-field', FIELD(9, 0x2a8eee, { gridPadding: 1.2, lightAlpha: 0.7, lightSize: 0.5, scale: 0.8 })),
  token('evil-field', FIELD(10, 0xff2a20, { gridPadding: 1.8, intensity: 1.1, lightAlpha: 0.9, lightSize: 0.6, scale: 0.6 }, 0.8, { lightSize: cos(0.3, 0.9, 5000) })),
  token('grid-field', FIELD(11, 0x00cccc, { gridPadding: 1.8, lightAlpha: 0.6, lightSize: 0.3, scale: 0.6 }, 0.6)),
  token('warp-field', FIELD(12, 0xe8e0ff, { gridPadding: 1.8, lightAlpha: 0.6, lightSize: 0.5, scale: 0.9 }, 0.6)),
  token('color-field', FIELD(13, 0x00cc55, { gridPadding: 1.8, lightAlpha: 0.4, lightSize: 0.3 }, 0.6)),
  token('sunburst', timed('xray', 1, { rayType: 0, color: 0xffbb33, blend: 9, dimX: 1, dimY: 1, anchorX: 0.5, anchorY: 0.5, divisor: 18, intensity: 2.2 })),
  token('clover', timed('xray', 1, { rayType: 1, color: 0x33ff66, blend: 9, dimX: 1, dimY: 1, anchorX: 0.5, anchorY: 0.5, divisor: 4, intensity: 2 })),
  token('scan', timed('xray', 1, { rayType: 2, color: 0x6fe8ff, blend: 9, intensity: 1.8 })),
  token('blue-rays', timed('xray', 0.6, { rayType: 3, color: 0x3f9fff, blend: 9, dimX: 1, dimY: 1, anchorX: 0.5, anchorY: -0.15, divisor: 10, intensity: 1.8 }, { anchorX: cos(0.35, 0.65, 12000) })),
  token('spectral-body', timed('liquid', 1, { color: 0x20aaee, blend: 8, intensity: 4, spectral: true, scale: 0.9 }, { color: hue(0xcfefff, 0x2fa8ff, 6000) })),
  token('mantle-of-madness', timed('liquid', 1.4, { color: 0x0090ff, blend: 6, intensity: 6, spectral: false, scale: 2 }, { intensity: cos(6, 2.5, 30000), scale: cos(1, 3, 30000) })),
  token('drift-in-plans',
    timed('wave', 1, { strength: 0.012, frequency: 90, color: 0xffffff, maxIntensity: 1.3, minIntensity: 0.9 }, { anchorX: cos(0.35, 0.65, 10000), anchorY: sin(0.35, 0.65, 10000) }),
    timed('liquid', 1.6, { color: 0xff3030, blend: 6, intensity: 5, spectral: false, scale: 2.5 }, { color: hue(0xff2020, 0xffffff, 9000) })),
  token('fire-aura', F('zapshadow', { alphaTolerance: 0.5 }), fireAura(0xff6a12, 4, { thickness: cos(3, 5, 3000, false) })),
  token('glacial-aura', F('zapshadow', { alphaTolerance: 0.5 }), iceAura()),
  // anti-aura: a light-eating void; dark wisps pour inward and only a thin violet rim catches the light.
  token('anti-aura', F('zapshadow', { alphaTolerance: 0.5 }), F('adjustment', { saturation: 0.3, brightness: 0.8 }),
    timed('xglow', 0.5, { auraType: 2, color: 0x0a0010, thickness: 4, scale: 4, auraIntensity: 2, subAuraIntensity: 1, threshold: 0.3, discard: false },
      { auraIntensity: cos(2.5, 1.2, 3000), subAuraIntensity: cos(1.5, 0.6, 3000) }),
    timed('fumes', -0.8, { color: 0x14001f, blend: 0, alpha: 0.9 }), F('outline', { thickness: 1.2, color: 0xb36bff, alpha: 0.9 }, { alpha: cos(0.5, 1, 3000) })),
  // pure-fire-aura: a clean ring of fire behind the creature, which stays untouched under a hot rim.
  token('pure-fire-aura', naturalFire({ fireBlend: 0, amplitude: 0.85 }, { intensity: cos(0.9, 1.6, 6000) }), F('zapshadow', { alphaTolerance: 0.5 }),
    F('outline', { thickness: 1.5, color: 0xffc860, alpha: 0.9 }, { thickness: cos(1.2, 2.2, 3000, false) })),
  // pure-fire-aura-2: two temperatures, blue roots hugging the body under tall orange flames.
  token('pure-fire-aura-2', F('zapshadow', { alphaTolerance: 0.5 }), naturalFire({ amplitude: 1.4, fireBlend: 0.4 }, { intensity: cos(1, 2, 9000), amplitude: cos(1.2, 1.6, 4400) }),
    timed('xfire', 1.3, { color: 0x3c8cff, blend: 1, amplitude: 0.35, scaleX: 0.8, zOrder: 810 })),
  token('pure-ice-aura', F('zapshadow', { alphaTolerance: 0.5 }), iceAura(), timed('smoke', -0.7, { color: 0x8ad8ff, blend: 2, dimX: 0.35, dimY: 1 }, { dimX: cos(0.4, 0.25, 3000, false) })),
  token('pixelate', F('pixel', { sizeX: 4, sizeY: 4 })),
  token('Fire v2', timed('xfire', 1, { color: 0, blend: 1, amplitude: 1, dispersion: 0, chromatic: false, scaleX: 1.4, scaleY: 1, inlay: false })),
  token('Fire v2 (chromatic)', timed('xfire', 1, { color: 0, blend: 2, amplitude: 1.1, dispersion: 0, chromatic: true, scaleX: 1, scaleY: 1, inlay: false })),
  token('Fire v2 (sparks)', timed('xfire', 1, { color: 0, blend: 2, amplitude: 0.6, dispersion: 6, chromatic: false, scaleX: 1.6, scaleY: 1.6, inlay: false })),
  token('Fire v2 (coldfire)', timed('xfire', 1, { color: 0x3a8cff, blend: 1, amplitude: 1, dispersion: 0, chromatic: false, scaleX: 1, scaleY: 1, inlay: false })),
  token('Fire v2 (blackfire)', timed('xfire', 0.9, { color: 0x6a3a9a, blend: 11, amplitude: 1, dispersion: 1.5, chromatic: false, scaleX: 2, scaleY: 1.8, inlay: false })),
  token('Super-Frost', timed('frost', 1, { amount: 0.8, snow: 0.3 }), F('adjustment', { saturation: 0.55, red: 0.85, blue: 1.15 }),
    timed('xglow', 0.5, { auraType: 1, color: 0xbfe8ff, thickness: 1.5, scale: 3, auraIntensity: 1.3, subAuraIntensity: 0.4, threshold: 0.3, discard: true }),
    timed('globes', 0.5, { color: 0xffffff, distortion: 0.1, scale: 22, alphaDiscard: true })),
  token('Super-Heat', F('distortion', { amount: 4, maskSpriteScaleX: 1.5, maskSpriteScaleY: 3 }, { maskSpriteY: { animType: 'move', speed: -0.12 } }),
    F('adjustment', { saturation: 1.2, red: 1.2, green: 1, blue: 0.8, brightness: 1.05 }),
    timed('xglow', 2, { auraType: 2, color: 0xff7a1a, thickness: 1.5, scale: 5, auraIntensity: 1.4, subAuraIntensity: 0.5, threshold: 0.3, discard: true })),
  token('Evade Stance', F('transform', { pivotX: 0.5, pivotY: 0.55 }, { translationX: sin(-0.12, 0.12, 1400, false), translationY: cos(-0.03, 0.03, 1400, false) })),
  token('Saving Roll', F('transform', { pivotX: 0.5, pivotY: 0.5 }, {
    translationX: sin(-0.2, 0.2, 1250, false), rotation: sin(-360, 360, 1250, false), scaleX: cos(1, 1.3, 625, false), scaleY: cos(1, 1.25, 625, false) })),
  token('Dodge Jump', F('transform', { pivotX: 0.5, pivotY: 0.9 }, { translationY: cos(0, -0.22, 900, false), scaleX: cos(1, 0.8, 450, false), scaleY: cos(1, 1.12, 450, false) })),
  token('Fairy Outline', timed('globes', 1.4, { color: 0x30a0ee, distortion: 0.9, scale: 120, alphaDiscard: true }), F('glow', { outerStrength: 3, distance: 10, color: 0xff3080 }, { color: hue(0xff3060, 0x30ff60, 3000) })),
  token('Replace Color', F('replaceColor', { originalColor: [0.85, 0.15, 0.15], newColor: [0.2, 0.5, 1], epsilon: 0.45 })),
  token('Dot Shade', F('dot', { scale: 1.1, angle: 0.4, grayscale: true })),
  token('CRT Monitor', F('crt', { curvature: 2, lineWidth: 1.2, lineContrast: 0.3, noise: 0.25, noiseSize: 1, vignetting: 0.3, vignettingAlpha: 0.8, vignettingBlur: 0.35 }, { seed: { animType: 'randomNumber', val1: 0, val2: 1 }, time: { animType: 'move', speed: 0.001 } }),
    F('outline', { thickness: 1.2, color: 0x0a0a0a, alpha: 0.9 })),
  token('RGB Split', F('rgbSplit', { redX: -5, redY: 0, greenX: 0, greenY: 4, blueX: 3, blueY: -2 })),
  token('Criss-Cross', F('sprite', { imagePath: 'modules/animater/assets/fx/crosshatch.svg', repeat: true, alphaDiscard: true, colorize: true, color: 0xfea42a, scaleX: 0.18, scaleY: 0.18, rotation: 45, alpha: 0.85, top: true })),
  token('Star Mask', F('spriteMask', { imagePath: 'modules/animater/assets/fx/star.svg', repeat: false, scaleX: 1, scaleY: 1, alpha: 1 })),
  token('Tropical Gradient', F('colorGradient', { stops: [{ offset: 0, color: 0xffa01e, alpha: 0.65 }, { offset: 0.5, color: 0xff3d7f, alpha: 0.6 }, { offset: 1, color: 0x00e5ff, alpha: 0.7 }], type: 0, angle: 90, alpha: 1, replace: false })),

  // ── Region library (played on tokens by animater) ─────────────────────────
  // The region twins each have a look of their own, apart from the token preset they started as.
  // Watery Surface: a pond seen from above, deep blue with rings spreading over it.
  region('Watery Surface', timed('flood', 0.6, { color: 0x0a46b0, billowy: 0.25, tintIntensity: 0.9, glint: 0.6, scale: 110 }),
    timed('ripples', 0.5, { color: 0x9fd8ff, alphaDiscard: true, intensity: 0.9 })),
  // Protoplasm: thick, bubbling green-yellow ooze that wobbles (spectral-body is the see-through ghost).
  region('Protoplasm', F('bulgepinch', { radiusPercent: 150, strength: 0 }, { strength: cos(-0.1, 0.1, 3200, false) }),
    timed('liquid', 0.6, { color: 0xa6e22e, blend: 6, intensity: 10, spectral: false, scale: 1.1 }), timed('corrode', 0.7, { color: 0xd4f25a, amount: 0.35, bubbles: 0.9 })),
  region('Watery Surface 2', timed('liquid', 1, { color: 0x20aaee, blend: 4, intensity: 9, spectral: false, scale: 1.4 })),
  // Smoky Area: smoke lying low around the feet, rolling sideways.
  region('Smoky Area', timed('smoke', 0.6, { color: 0xb4b4b4, blend: 2, dimX: 1.6, dimY: 0.4, ground: true })),
  region('Shock', timed('electric', 1, { color: 0xffffff, blend: 1, intensity: 5 })),
  region('Annihilating Rays', F('adjustment', { saturation: 0.35, contrast: 1.25, brightness: 1.1 }),
    timed('xray', 1, { rayType: 4, color: 0xffbb00, blend: 9, dimX: 1, dimY: 1, anchorX: 0.5, anchorY: 0.5, divisor: 6, intensity: 2.6 })),
  region('Classic Rays', timed('ray', 0.7, { color: 0xcf8000, alpha: 0.6, divisor: 32, anchorX: 0.5, anchorY: -0.1, alphaDiscard: false })),
  // Smoke Filaments: thin wisps climbing high and quick.
  region('Smoke Filaments', timed('fumes', 1.4, { color: 0xc8c8c8, blend: 2, rise: 1 })),
  region('Flames', naturalFire({ intensity: 1.3, amplitude: 1.9 }, { intensity: cos(1.1, 1.7, 5000) })),
  region('Thick Fog', timed('xfog', 1, { color: 0x8a8f99, density: 0.85 })),
  region('Glowing Outline', F('glow', { outerStrength: 4, distance: 12, color: 0xffd36b }, { outerStrength: cos(5, 2, 3000) })),
  region('Waves', timed('wave', 1, { strength: 0.015, frequency: 120, color: 0xffffff, maxIntensity: 1.4, minIntensity: 0.9 })),
  region('Waves 2', timed('wave', 4, { strength: 0.01, frequency: 200, color: 0xffffff, maxIntensity: 1.3, minIntensity: 0.9 })),
  region('Waves 3', timed('wave', 1, { strength: 0.025, frequency: 60, color: 0xbfe0ff, maxIntensity: 1.5, minIntensity: 0.85, anchorX: 0.5, anchorY: 1 })),
  region('Zone : Fire', F('base', { baseType: 1, color: 0xff4a00, radius: 0.72, alpha: 0.5 }), timed('base', 1, { baseType: 3, color: 0xffa040, radius: 0.72, alpha: 0.85 }),
    naturalFire({ intensity: 1.4, amplitude: 0.5 })),
  region('Zone : Electricity', timed('xglow', 1, { auraType: 2, color: 0x7fc8ff, thickness: 1.5, scale: 4, auraIntensity: 1.6, subAuraIntensity: 1, threshold: 0.35, discard: true }, { thickness: cos(1, 2, 3000, false) }), timed('electric', 1, { color: 0xdff2ff, blend: 1, intensity: 5 })),
  region('Zone : Blizzard', F('adjustment', { saturation: 0.5, brightness: 1.08, red: 0.9, blue: 1.12 }), timed('frost', 1.5, { amount: 0.4, snow: 1 }),
    timed('xfog', 2, { color: 0xe8f4ff, density: 0.55 }), timed('globes', 2.2, { color: 0xffffff, distortion: 1.2, scale: 28 })),
  // Bulging Out: slow breathing, with a faint ring thrown off at each swell.
  region('Bulging Out', F('bulgepinch', { radiusPercent: 200, strength: 0.1 }, { strength: cos(0.1, 0.55, 4000, false) }),
    F('shockwave', { amplitude: 3, wavelength: 70, brightness: 1.15, speed: 30, radius: -1 }, { time: { animType: 'halfCosOscillation', loopDuration: 4000, val1: 0, val2: 9 } })),
  // Blurred Texture: a sideways heat shimmer rather than an all-over blur.
  region('Blurred Texture', F('blur', { blur: 0, blurX: 0, blurY: 0 }, { blurX: chaos(0, 3, 700) }),
    F('distortion', { amount: 2, maskSpriteScaleX: 3, maskSpriteScaleY: 1 }, { maskSpriteX: { animType: 'move', speed: 0.05 } })),
  // Bloomed Texture: a warm, low-threshold bloom with gold glints on the art.
  region('Bloomed Texture', F('adjustment', { red: 1.08, blue: 0.88, brightness: 1.05 }),
    F('xbloom', { threshold: 0.2, bloomScale: 2, brightness: 1.1, blur: 3 }, { bloomScale: cos(1.5, 3, 1200) }),
    timed('globes', 0.6, { color: 0xffd76a, distortion: 0.2, scale: 30, alphaDiscard: true })),
  // Wild Magic: the whole colour wheel racing over the art, the body doubling, sparks of random colour.
  region('Wild Magic', timed('liquid', 1.8, { color: 0xffffff, blend: 6, intensity: 6, spectral: false, scale: 2.5, rainbow: true }),
    timed('images', 1, { nbImage: 2, alphaImg: 0.45, alphaChr: 0.8, ampX: 0.06, ampY: 0.05 }, { ampX: chaos(0.01, 0.12, 900), ampY: chaos(0.01, 0.1, 1100) }),
    timed('globes', 2, { color: 0xffffff, distortion: 2.5, scale: 45 }, { color: { animType: 'randomColorPerLoop', loopDuration: 600 } })),
  region('Spider Web 1', timed('web', 0.3, { color: 0xdddddd, thickness: 1.4, div1: 15, div2: 6, anchorX: 0.5, anchorY: 0.5 }), F('blur', { blur: 0.3 })),
  region('Spider Web 2', timed('web', 0.2, { color: 0xcfcfcf, thickness: 1.8, div1: 12, div2: 5, anchorX: 0.5, anchorY: 0.45 }), timed('xfog', 0.4, { color: 0x6a6a6a, density: 0.4 }),
    F('bulgepinch', { radiusPercent: 140, strength: 0 }, { strength: cos(0.35, 0, 3000, false) })),
  region('Spider Web 4', F('web', { color: 0xf0f0f0, thickness: 1.6, div1: 16, div2: 7, anchorX: 0.5, anchorY: 0.5, alphaDiscard: true }, { time: cos(0, 3, 5000, false) }), F('glow', { outerStrength: 2, distance: 10, color: 0xffffff }, { outerStrength: cos(2.4, 1.2, 3000) })),
  region('Spider Web 5', F('web', { color: 0xbfffd0, thickness: 1.2, div1: 20, div2: 9, anchorX: 0.5, anchorY: 0.5, alphaDiscard: true }, { time: cos(0, 2, 5000, false) }), F('glow', { outerStrength: 1.8, distance: 10, color: 0x7fffaa }, { outerStrength: cos(2, 1, 3000) })),
  region('Ripples : Solar', timed('ripples', 1, { color: 0xff9a2a, alphaDiscard: false })),
  region('Ripples : Shadow Sun', F('adjustment', { saturation: 0.5, brightness: 0.55 }), timed('ripples', 1, { color: 0x9a3cff, alphaDiscard: false })),
  region('Ripples : Scars', timed('ripples', 1, { color: 0xc8102e, alphaDiscard: true, intensity: 1.5 }), F('glow', { outerStrength: 1.5, distance: 10, color: 0xc8102e }, { outerStrength: cos(2, 1, 3000) })),
  region('Fairy Fireflies : Calm', timed('globes', 0.4, { color: 0x26ff1d, distortion: 0.2, scale: 130, alphaDiscard: false })),
  region('Fairy Fireflies : Excited', timed('globes', 1.2, { color: 0x00ccff, distortion: 0.6, scale: 75, alphaDiscard: false }), F('glow', { outerStrength: 1.2, distance: 10, color: 0x00ccff }, { outerStrength: cos(1.6, 0.8, 3000) })),
  region('Fairy Fireflies : Frenetic', timed('globes', 2.6, { color: 0xe1e000, distortion: 1.8, scale: 38, alphaDiscard: false }), F('glow', { outerStrength: 1, distance: 8, color: 0xe1e000 }, { outerStrength: { animType: 'randomNumber', val1: 0.4, val2: 1.6 } })),
  region('Living Fluid', timed('xfog', 1, { color: 0x30a0ff, density: 0.8, alphaDiscard: true })),
  region('Living Fluid 2', timed('xfog', 1, { color: 0x30ff9a, density: 0.8, alphaDiscard: true }), F('glow', { outerStrength: 1.5, distance: 10, color: 0x30ff9a })),
  // Living Fluid 3 spills past the silhouette; Living Fluid stays inside it.
  region('Living Fluid 3', timed('liquid', 1, { color: 0x69dc92, blend: 8, intensity: 4, spectral: true, scale: 1.4, alphaDiscard: true }), timed('xfog', 0.8, { color: 0x69dc92, density: 0.55 })),
  region('Living Fluid 4', timed('liquid', 1, { color: 0xe6842b, blend: 4, intensity: 8, spectral: false, scale: 1.4, alphaDiscard: true }), F('glow', { outerStrength: 1.5, distance: 10, color: 0xe6842b })),
  region('Flames 2', F('adjustment', { saturation: 0.6, brightness: 0.55, contrast: 1.15, red: 1.15, green: 0.9, blue: 0.8 }), naturalFire({ intensity: 1.6, amplitude: 1.3, alphaDiscard: true })),
  region('Flames 3', F('adjustment', { brightness: 0.75, contrast: 1.1, red: 1.1, blue: 0.85 }), naturalFire({ intensity: 1.5, amplitude: 1.3, alphaDiscard: true }), timed('xglow', 1, { auraType: 1, color: 0xff7a1a, thickness: 3, scale: 4, auraIntensity: 1.6, subAuraIntensity: 1, threshold: 0.35, discard: true }, { thickness: cos(2, 4, 3000, false) })),
  region('Classic Rays 2', timed('ray', 1.8, { color: 0xcf8000, alpha: 0.9, divisor: 16, anchorX: 0.5, anchorY: 0.1, alphaDiscard: true })),
  region('Fire Rays', naturalFire({ intensity: 1.2, amplitude: 0.8 }),
    timed('ray', 1.8, { color: 0xffa020, alpha: 0.9, divisor: 24, anchorX: 0.5, anchorY: 0.5, alphaDiscard: false, zOrder: 850 }), F('glow', { outerStrength: 1.5, distance: 10, color: 0xff8a20 })),
  region('Splash 1', F('splash', { color: 0x900505, seed: 0.1, splashFactor: 5, spread: 10, dimX: 1, dimY: 1, cut: true }), F('glow', { outerStrength: 2, distance: 6, color: 0x400000 })),
  // Splash 2: splats thrown against the silhouette's edges rather than one in the middle.
  region('Splash 2', timed('splash', 1, { color: 0x900505, seed: 0.37, splashFactor: 3, spread: 8, dimX: 1, dimY: 1, cut: true, edge: 0.62, drip: 0.2 }),
    timed('splash', 1, { color: 0xa00808, seed: 0.83, splashFactor: 5, spread: 6, dimX: 1, dimY: 1, cut: true, edge: 0.7, drip: 0.2 }), F('glow', { outerStrength: 2, distance: 6, color: 0x400000 })),
  region('Splash 3', timed('fumes', 1, { color: 0x38517e, blend: 2 }), timed('splash', 1, { color: 0x38517e, seed: 0.61, splashFactor: 3, spread: 10, dimX: 1, dimY: 1, cut: true }),
    F('glow', { outerStrength: 2, distance: 6, color: 0x101a30 }), timed('liquid', 1.5, { color: 0x38517e, blend: 8, intensity: 3, spectral: false, scale: 2 })),
  region('Flames 4 (colorizable)', timed('xfire', 1.1, { color: 0, blend: 1, amplitude: 1.4, dispersion: 0, inlay: false, scaleX: 0.7, scaleY: 1.2 })),
  region('Flames 5 (colorizable)', F('adjustment', { saturation: 0.6, brightness: 0.55, contrast: 1.15 }), timed('xfire', 1, { color: 0, blend: 1, amplitude: 1, dispersion: 0, inlay: false, alphaDiscard: true, discardThreshold: 0.35 })),
  region('Flames 6 (colorizable)', F('adjustment', { saturation: 0.8, brightness: 0.6, red: 1.25, green: 0.8, blue: 0.7 }), F('distortion', { amount: 3, maskSpriteScaleX: 2, maskSpriteScaleY: 2 }, { maskSpriteY: { animType: 'move', speed: -0.08 } }),
    timed('xfire', 1, { color: 0, blend: 1, amplitude: 1, dispersion: 0, inlay: false, alphaDiscard: true, discardThreshold: 0.3 })),

  // ── animater originals: creature states and looks Token Magic had no answer for ──
  // Grounding and elevation
  token('Grounded Shadow', F('shadow', { rotation: 90, distance: 5, blur: 3, alpha: 0.55, color: 0x0a0806 })),
  // Long Shadow: a low sun throws it far and smears it out.
  token('Long Shadow', F('shadow', { rotation: 20, distance: 40, blur: 4, alpha: 0.5, color: 0x0a0806, stretch: 0.85 })),
  token('Levitate', F('transform', { pivotX: 0.5, pivotY: 0.5 }, { translationY: cos(0, -0.07, 2600, false) }),
    F('shadow', { rotation: 90, blur: 6, alpha: 0.4, color: 0x050505 }, { distance: cos(6, 16, 2600, false), alpha: cos(0.45, 0.28, 2600, false) })),
  token('Gentle Sway', F('transform', { pivotX: 0.5, pivotY: 0.95 }, { rotation: sin(-3, 3, 4200, false) })),
  token('Hanging Swing', F('transform', { pivotX: 0.5, pivotY: 0.02 }, { rotation: sin(-9, 9, 2600, false) })),
  // Elemental channelling: power gathered in the body
  // Searing: tall, thin, white-gold jets throwing sparks.
  token('Channel: Searing', timed('xfire', 1.8, { color: 0xffc23a, blend: 1, amplitude: 1, dispersion: 2, inlay: false, scaleX: 0.75, scaleY: 1.6 }), F('glow', { outerStrength: 1.5, distance: 12, color: 0xff7a22 }, { outerStrength: cos(1.2, 2.2, 1800) })),
  // Frigid: no flames; the body frosts over under a pale rim while flakes drift down.
  token('Channel: Frigid', timed('frost', 1, { amount: 0.6, snow: 0.15, color: 0xcfeaff }),
    timed('xglow', 0.6, { auraType: 1, color: 0x9fdcff, thickness: 1.5, scale: 3, auraIntensity: 1.4, subAuraIntensity: 0.4, threshold: 0.3, discard: true }),
    timed('globes', 1.2, { color: 0xe6f6ff, distortion: 0.2, scale: 32 })),
  // Arcane: a small rune circle underfoot, arcs crackling, flames drifting violet to cyan.
  token('Channel: Arcane', timed('base', 0.6, { baseType: 4, color: 0xb48cff, radius: 0.6, alpha: 0.75 }),
    timed('xfire', 1, { color: 0xa070ff, blend: 1, amplitude: 0.4, inlay: false }, { color: hue(0xa070ff, 0x50d0ff, 4000) }), timed('electric', 0.8, { color: 0xd9c4ff, intensity: 5 })),
  // Venom: flames that hang and drip, bubbling on the skin.
  token('Channel: Venom', timed('corrode', 1, { color: 0x8fdc4a, amount: 0.3, bubbles: 0.8 }), timed('xfire', 0.8, { color: 0x7dd94a, blend: 1, amplitude: 0.7, scaleY: 1.3, inlay: false, fall: true })),
  token('Arcane Charge', F('zapshadow', { alphaTolerance: 0.5 }), timed('xglow', 1, { auraType: 1, color: 0x8a6bff, thickness: 2, scale: 3, auraIntensity: 1.1, subAuraIntensity: 0.5, threshold: 0.3 }),
    timed('electric', 1.4, { color: 0xcdb8ff, intensity: 6 }), timed('globes', 1, { color: 0xb49cff, distortion: 0.7, scale: 50 })),
  // Motes around the creature
  token('Ember Motes', timed('globes', 1.3, { color: 0xff8a2a, distortion: 0.5, scale: 60, alphaDiscard: false }), F('glow', { outerStrength: 1.5, distance: 10, color: 0xff6a1a })),
  token('Pixie Motes', timed('globes', 0.9, { color: 0xffe08a, distortion: 0.8, scale: 70, alphaDiscard: false })),
  // Turned into a material
  token('Petrified', timed('material', 1, { materialType: 1, strength: 1, cracks: 0.6 })),
  token('Frozen Solid', timed('material', 1, { materialType: 2, strength: 0.9, cracks: 0.5 }), timed('frost', 1, { amount: 0.55, snow: 0.35 })),
  token('Gilded', timed('material', 1, { materialType: 4, strength: 1, cracks: 0 })),
  token('Ironskin', timed('material', 1, { materialType: 3, strength: 0.85, cracks: 0.15 })),
  token('Crystallized', timed('material', 1, { materialType: 5, strength: 0.9, cracks: 0 }), F('glow', { outerStrength: 1.5, distance: 8, color: 0xb9a0ff })),
  token('Barkskin', timed('material', 1, { materialType: 6, strength: 0.75, cracks: 0 })),
  // Cold, drained, washed out
  token('Frostbitten', timed('frost', 1, { amount: 0.45, snow: 0.2 })),
  token('Snowed Over', timed('frost', 1, { amount: 0.3, snow: 0.95 })),
  // Drained Colour: life seeping away, the colour gone grey from the feet up and slowly ebbing.
  token('Drained Colour', F('colorGradient', { type: 0, angle: 90, replace: true, stops: [{ offset: 0, color: 0x9a9a9a, alpha: 0 }, { offset: 0.45, color: 0x9a9a9a, alpha: 0.35 }, { offset: 1, color: 0x8c8c8c, alpha: 0.85 }] }),
    F('adjustment', { brightness: 0.94 }, { saturation: cos(0.35, 0.7, 4200) })),
  token('Wintry Pallor', F('adjustment', { saturation: 0.45, brightness: 1.05, red: 0.88, green: 0.97, blue: 1.12 })),
  // Held fast
  token('Entangled', timed('bindings', 0.6, { bindType: 1, thickness: 1.1, density: 1.5, tightness: 0.6 })),
  token('Netted', timed('bindings', 0.4, { bindType: 2, thickness: 0.8, density: 1 })),
  token('Chained', timed('bindings', 0.5, { bindType: 3, thickness: 1.2, density: 1, tightness: 0.4 })),
  token('Bound', timed('bindings', 0.3, { bindType: 4, thickness: 1.1, density: 1 })),
  // Grime and wounds
  token('Mud-Caked', F('splash', { color: 0x4a3622, seed: 0.23, splashFactor: 7, spread: 14, cut: true }), F('splash', { color: 0x3b2a1a, seed: 0.71, splashFactor: 4, spread: 8, cut: true }),
    F('adjustment', { saturation: 0.8, brightness: 0.9 })),
  token('Scorched', F('adjustment', { saturation: 0.5, brightness: 0.7, contrast: 1.15, red: 1.05, green: 0.9, blue: 0.82 }), timed('xfire', 0.3, { color: 0x2a0d04, blend: 11, amplitude: 0.6, inlay: true }),
    timed('globes', 0.6, { color: 0xff6a1a, distortion: 0.3, scale: 30, alphaDiscard: true })),
  // Blood-Soaked: darker and glossier than the Splash presets, with blood running down from the splats.
  token('Blood-Soaked', timed('splash', 1, { color: 0x4a0202, seed: 0.42, splashFactor: 6, spread: 12, cut: true, drip: 1 }), timed('splash', 1.3, { color: 0x6a0606, seed: 0.88, splashFactor: 3, spread: 6, cut: true, drip: 0.8 })),
  token('Molten', timed('xfire', 1.2, { color: 0xff4a10, blend: 5, amplitude: 1, inlay: true }), F('xbloom', { threshold: 0.4, bloomScale: 1.4, brightness: 1.05, blur: 2 }, { bloomScale: cos(0.9, 1.8, 2200) })),
  // Surroundings
  token('Submerged', F('distortion', { amount: 4, maskSpriteScaleX: 3, maskSpriteScaleY: 3 }, { maskSpriteX: { animType: 'move', speed: 0.02 }, maskSpriteY: { animType: 'move', speed: 0.015 } }),
    F('adjustment', { saturation: 0.75, brightness: 0.9, red: 0.75, green: 0.95, blue: 1.15 }), timed('flood', 0.6, { color: 0x1a6fd6, billowy: 0.2, tintIntensity: 0.2, glint: 0.15, scale: 90 })),
  token('Far Away', F('blur', { blur: 1.6 }), F('adjustment', { saturation: 0.7, contrast: 0.85, brightness: 1.05 })),
  // Markers on the ground
  // Ally, Caution and Foe differ in shape too (filled ring, blinking dashes, spikes), not only in colour.
  token('Marker: Ally', timed('base', 1, { baseType: 5, color: 0x44dd66, radius: 0.53, alpha: 0.85 })),
  token('Marker: Caution', timed('base', 1, { baseType: 6, color: 0xffcc33, radius: 0.53, alpha: 0.9 })),
  token('Marker: Foe', timed('base', 1, { baseType: 7, color: 0xff4040, radius: 0.53, alpha: 0.85 })),
  token('Marker: Ring', F('base', { baseType: 2, color: 0xffffff, radius: 0.53, alpha: 0.7 })),
  token('Marker: Disc', F('base', { baseType: 1, color: 0x4aa3ff, radius: 0.52, alpha: 0.6 })),
  // Damage: how each kind of harm shows on the body (used by damage flashes and catalogs)
  token('Burning', naturalFire({ amplitude: 0.9 }, { intensity: cos(1, 1.8, 1400, false) }), timed('xfire', 2, { color: 0xff6a1a, blend: 5, amplitude: 0.4, inlay: true })),
  token('Electrocuted', timed('electric', 2.5, { color: 0xbfe6ff, blend: 1, intensity: 7 }),
    F('adjustment', { saturation: 0.7 }, { brightness: { animType: 'randomNumber', val1: 0.85, val2: 1.6 } }), F('glow', { outerStrength: 3, distance: 10, color: 0x7fc8ff }, { outerStrength: { animType: 'randomNumber', val1: 1, val2: 4.5 } })),
  token('Corroding', timed('corrode', 1, { color: 0x9be04a, bubbles: 0.7 }, { amount: { animType: 'halfCosOscillation', val1: 0.15, val2: 0.65, loopDuration: 1600, loops: 1 } }),
    timed('fumes', 0.8, { color: 0xa6e05a, blend: 2, alpha: 0.3 })),
  token('Envenomed', timed('veins', 1, { color: 0x4f9a24, thickness: 1, pulse: 1.2, glow: 0.45 }, { amount: { animType: 'halfCosOscillation', val1: 0.15, val2: 0.8, loopDuration: 1800, loops: 1 } }),
    F('adjustment', { saturation: 0.75, red: 0.92, green: 1.06, blue: 0.9 })),
  token('Withering', timed('veins', 0.8, { color: 0x3a1650, thickness: 1.3, pulse: 0.6, glow: 0.3 }, { amount: { animType: 'halfCosOscillation', val1: 0.2, val2: 0.9, loopDuration: 2000, loops: 1 } }),
    F('adjustment', { contrast: 1.05 }, { saturation: { animType: 'halfCosOscillation', val1: 1, val2: 0.25, loopDuration: 2000, loops: 1 }, brightness: { animType: 'halfCosOscillation', val1: 1, val2: 0.7, loopDuration: 2000, loops: 1 } }),
    timed('fumes', 0.6, { color: 0x2a0f3a, blend: 0, alpha: 0.8 })),
  token('Radiant Burn', F('xbloom', { threshold: 0.3, brightness: 1.15, blur: 3 }, { bloomScale: cos(1.2, 2.6, 900, false) }),
    timed('xray', 0.6, { color: 0xffe9a3, blend: 9, anchorX: 0.5, anchorY: 0.5, divisor: 12, intensity: 1.6 }), F('glow', { outerStrength: 4, distance: 14, color: 0xfff1c0 })),
  token('Force Jolt', F('shockwave', { amplitude: 9, wavelength: 45, brightness: 1.5, speed: 40, radius: -1 }, { time: { animType: 'halfCosOscillation', val1: 0, val2: 6, loopDuration: 900 } }),
    F('bulgepinch', { radiusPercent: 120 }, { strength: { animType: 'halfSinOscillation', val1: 0, val2: -0.25, loopDuration: 900 } }), F('glow', { outerStrength: 3, distance: 12, color: 0xba9cff })),
  token('Psychic Warp', F('rgbSplit', {}, { redX: sin(-7, 7, 700, false), greenY: sin(5, -5, 900, false), blueX: sin(4, -4, 1100, false) }),
    F('twist', { radiusPercent: 90 }, { angle: sin(-0.5, 0.5, 1300, false) }), F('glow', { outerStrength: 3, distance: 12, color: 0xb07cff }, { outerStrength: cos(2, 4.5, 800, false) })),
  token('Resonance', F('transform', { pivotX: 0.5, pivotY: 0.5 }, { translationX: sin(-0.012, 0.012, 70, false), translationY: sin(0.008, -0.008, 90, false) }),
    timed('ripples', 3, { color: 0xdfe8ff, alphaDiscard: false, intensity: 1.2 }), F('rgbSplit', { redX: -2, blueX: 2 })),
  token('Spirit Rend', timed('images', 1.5, { nbImage: 3, alphaImg: 0.5, alphaChr: 0.8, ampX: 0.08, ampY: 0.05 }),
    timed('liquid', 1.2, { color: 0xdfe6f2, blend: 8, intensity: 4, spectral: true, scale: 1.2 })),
  // Lasting conditions: quiet, steady looks on the creature (no one-off growth or bursts)
  token('Fading', F('adjustment', { saturation: 0.2, brightness: 0.62, contrast: 0.92, blue: 1.05 }, { brightness: cos(0.58, 0.68, 4000) })),
  // Doom: dark veins and a black halo pressing in.
  token('Doom', timed('veins', 0.4, { color: 0x3a1650, amount: 0.6, thickness: 1.1, pulse: 0.5, glow: 0.4 }), F('glow', { distance: 12, color: 0x12061a }, { outerStrength: cos(2, 3.6, 3000) }),
    F('adjustment', { saturation: 0.65, brightness: 0.88 })),
  // Sickly (poisoned): green veins creeping under the skin.
  token('Sickly', timed('veins', 0.5, { color: 0x6aa82a, amount: 0.55, thickness: 1, pulse: 0.7, glow: 0.4 }), F('adjustment', { saturation: 0.8, red: 0.93, green: 1.06, blue: 0.88 })),
  // Muddled (stupefied): a dull haze drifting over the mind, the creature dimmed. Nothing flickers.
  token('Muddled', timed('fumes', 0.3, { color: 0x8a7fa8, blend: 2, alpha: 0.35 }), F('blur', { blur: 0.6 }), F('adjustment', { saturation: 0.7, brightness: 0.92, contrast: 0.9 })),
  // Bewildered (confused): soft lights wandering round, the creature swaying slowly as if lost.
  token('Bewildered', timed('globes', 0.5, { color: 0xc8b0ff, distortion: 0.6, scale: 45, alphaDiscard: false }), F('transform', { pivotX: 0.5, pivotY: 0.95 }, { rotation: sin(-2, 2, 5200, false) }),
    F('adjustment', { saturation: 0.85 })),
  token('Dominated', timed('veins', 0.5, { color: 0x8a4ad0, amount: 0.3, thickness: 0.8, pulse: 0.8, glow: 0.6 }), F('glow', { outerStrength: 1.6, distance: 10, color: 0x9a5ae0 }, { outerStrength: cos(1, 2.2, 3000) })),
  // Dazzled: glare off the creature, washing it out, light streaking across it from above.
  token('Dazzled', F('xbloom', { threshold: 0.32, brightness: 1.08, blur: 2 }, { bloomScale: cos(0.7, 1.5, 1700) }), F('adjustment', { saturation: 0.8, contrast: 0.85, brightness: 1.06 }),
    timed('ray', 0.5, { color: 0xfffaf0, alpha: 0.45, divisor: 18, anchorX: 0.2, anchorY: 0, alphaDiscard: true }), F('glow', { distance: 10, color: 0xfff6d8 }, { outerStrength: cos(0.8, 2.2, 1700) })),
  // Paralyzed: locked rigid, colour gone cold, a thin glassy shell round the outline.
  token('Paralyzed', F('adjustment', { saturation: 0.3, brightness: 0.88, contrast: 1.1, red: 0.92, green: 0.97, blue: 1.1 }), timed('frost', 0.2, { amount: 0.3, snow: 0, color: 0xc8d4e0 }),
    F('outline', { thickness: 1.5, color: 0xcfe0f0, alpha: 0.7 })),
  token('Haze', F('blur', { blur: 0.9 }), F('adjustment', { alpha: 0.82, contrast: 0.9 })),
  token('Unseen', F('distortion', { amount: 3, maskSpriteScaleX: 3, maskSpriteScaleY: 3 }, { maskSpriteX: { animType: 'move', speed: 0.02 }, maskSpriteY: { animType: 'move', speed: 0.025 } }),
    F('adjustment', { saturation: 0.6 }, { alpha: cos(0.3, 0.42, 3200) })),
  token('Quickened', timed('images', 2.5, { nbImage: 2, alphaImg: 0.3, alphaChr: 0.4, ampX: 0.05, ampY: 0.02 }), F('glow', { outerStrength: 1.2, distance: 8, color: 0x9fd0ff })),
  token('Glitching', F('rgbSplit', {}, { redX: { animType: 'randomNumberPerLoop', loopDuration: 180, val1: -5, val2: 5 }, blueY: { animType: 'randomNumberPerLoop', loopDuration: 230, val1: -3, val2: 3 } }),
    F('crt', { curvature: 0, lineWidth: 1, lineContrast: 0.22, noise: 0.15, vignetting: 0 }, { time: { animType: 'move', speed: 0.001 }, seed: { animType: 'randomNumberPerLoop', loopDuration: 120, val1: 0, val2: 1 } }),
    F('transform', {}, { translationX: { animType: 'randomNumberPerLoop', loopDuration: 260, val1: -0.015, val2: 0.015 } })),
  // Blinded: a dark veil drawn over the eyes, the rest dimmed.
  token('Blinded', F('colorGradient', { type: 0, angle: 90, stops: [{ offset: 0, color: 0x050508, alpha: 0.85 }, { offset: 0.42, color: 0x050508, alpha: 0.55 }, { offset: 0.62, color: 0x050508, alpha: 0 }] }),
    F('adjustment', { saturation: 0.6, brightness: 0.85 })),
  // Muffled: colour dulled, faint rings spreading as if through water.
  token('Muffled', timed('ripples', 0.4, { color: 0x9aa4b0, intensity: 0.35, alphaDiscard: true }), F('adjustment', { saturation: 0.65, contrast: 0.85, brightness: 0.95 })),
  token('Cracked', timed('material', 1, { materialType: 1, strength: 0.6, cracks: 1, grain: 0.2 })),
  // Unsteady: stumbling, catching itself.
  token('Unsteady', F('transform', { pivotX: 0.5, pivotY: 0.95 }, { rotation: sin(-5, 5, 1600, false), translationX: sin(-0.012, 0.012, 2300, false) })),
  // Burdened: pressed down under the load, heavier on the ground.
  token('Burdened', F('transform', { pivotX: 0.5, pivotY: 0.95, scaleX: 1.03 }, { scaleY: cos(0.93, 0.97, 2600, false) }), F('shadow', { rotation: 90, distance: 4, blur: 5, alpha: 0.75, color: 0x080604 }),
    F('adjustment', { brightness: 0.92 })),
  // Fascinated: slow golden rings spreading over the creature, entrancing, and a warm pulse.
  token('Fascinated', timed('wave', 0.35, { strength: 0.006, frequency: 70, color: 0xffe0a0, maxIntensity: 1.25, minIntensity: 0.95, anchorX: 0.5, anchorY: 0.35 }),
    F('glow', { outerStrength: 1.2, distance: 8, color: 0xffd36a }, { outerStrength: cos(0.8, 1.6, 3600) })),
  // Held: a single rope looped round, drawing tight now and then.
  token('Held', timed('bindings', 0.3, { bindType: 4, thickness: 0.9, density: 0.45 }, { tightness: cos(0.15, 0.55, 2400) })),
  token('Rooted', timed('bindings', 0.4, { bindType: 1, thickness: 0.9, density: 0.6, tightness: 0.3 }), F('shadow', { rotation: 90, distance: 4, blur: 3, alpha: 0.6, color: 0x0a0806 })),
  // Exposed: a thin red edge that keeps catching the eye.
  token('Exposed', F('outline', { thickness: 1.5, color: 0xd8342c }, { alpha: cos(0.35, 0.9, 1400) })),
  // Prone: flat on the ground, a wide shadow round it.
  token('Prone', F('transform', { pivotX: 0.5, pivotY: 1, scaleY: 0.8, scaleX: 1.05 }), F('shadow', { rotation: 90, distance: 2, blur: 6, alpha: 0.75, color: 0x0a0806 }), F('adjustment', { brightness: 0.86 })),
  // Dazed: seeing double, the creature reeling slowly and greyed.
  token('Dazed', timed('images', 0.5, { nbImage: 2, alphaImg: 0.4, alphaChr: 0.3, ampX: 0.03, ampY: 0.02 }), F('transform', { pivotX: 0.5, pivotY: 0.95 }, { rotation: sin(-2.5, 2.5, 3400, false) }),
    F('adjustment', { saturation: 0.7 }, { brightness: cos(0.85, 1, 2400, false) })),
  // Sluggish: heavy and cold, the picture smearing as it moves.
  token('Sluggish', F('blur', { blur: 0 }, { blurX: cos(0.2, 1.4, 3600, false) }), F('transform', { pivotX: 0.5, pivotY: 0.95 }, { rotation: sin(-1.5, 1.5, 6000, false) }),
    F('adjustment', { saturation: 0.65, brightness: 0.92, red: 0.88, green: 0.95, blue: 1.14 })),
  // Attitudes: how the creature regards the party, as a coloured edge (shape and pulse differ too).
  token('Attitude: Helpful', F('outline', { thickness: 2, color: 0x3fd96a, alpha: 0.85 }), F('glow', { outerStrength: 1.5, distance: 8, color: 0x3fd96a })),
  token('Attitude: Friendly', F('outline', { thickness: 1.5, color: 0x6fcf7f, alpha: 0.7 })),
  token('Attitude: Indifferent', F('outline', { thickness: 1.2, color: 0xb0b4b8, alpha: 0.55 })),
  token('Attitude: Unfriendly', F('outline', { thickness: 1.5, color: 0xe8862a, alpha: 0.75 })),
  token('Attitude: Hostile', F('outline', { thickness: 2, color: 0xe03030 }, { alpha: cos(0.55, 1, 1800) }), F('glow', { outerStrength: 1.4, distance: 8, color: 0xc02020 }, { outerStrength: cos(0.8, 1.8, 1800) })),
  token('Observed', F('outline', { thickness: 1, color: 0xf0f0f0 }, { alpha: cos(0.2, 0.45, 3000) })),
  token('Unnoticed', F('distortion', { amount: 4, maskSpriteScaleX: 3, maskSpriteScaleY: 3 }, { maskSpriteX: { animType: 'move', speed: 0.02 }, maskSpriteY: { animType: 'move', speed: 0.025 } }),
    F('adjustment', { saturation: 0.4 }, { alpha: cos(0.16, 0.26, 3200) })),
  // Bleeding: a wound that keeps running.
  token('Bleeding', timed('splash', 0.8, { color: 0x7a0606, seed: 0.57, splashFactor: 3, spread: 4, cut: true, edge: 0.55, drip: 1 }), timed('splash', 1.1, { color: 0x5a0303, seed: 0.21, splashFactor: 2, spread: 3, cut: true, edge: 0.7, drip: 0.8 }),
    F('adjustment', { saturation: 0.85, brightness: 0.95 })),
  token('Lifeless', F('adjustment', { saturation: 0, brightness: 0.55, contrast: 0.9, blue: 1.04 })),
  token('Stable', F('adjustment', { saturation: 0.45, brightness: 0.78 }, { brightness: cos(0.74, 0.82, 4400) })),
  // Sleeping: dim, breathing slowly.
  token('Sleeping', F('transform', { pivotX: 0.5, pivotY: 0.95 }, { scaleY: cos(0.985, 1.015, 4200, false) }), F('adjustment', { saturation: 0.7, brightness: 0.78, blue: 1.06 })),
  token('Ethereal', timed('liquid', 0.6, { color: 0xcfe2ff, blend: 8, intensity: 3, spectral: true, scale: 1.2 }), F('adjustment', { saturation: 0.5 }, { alpha: cos(0.45, 0.6, 3600) })),
  token('Focused', F('glow', { outerStrength: 1, distance: 8, color: 0x8fc8ff }, { outerStrength: cos(0.6, 1.6, 2600) })),
  token('Evasive', timed('images', 2, { nbImage: 2, alphaImg: 0.3, alphaChr: 0.35, ampX: 0.06, ampY: 0.015 })),
  token('Suffocating', F('adjustment', { saturation: 0.6, red: 0.85, green: 0.92, blue: 1.15 }, { brightness: cos(0.78, 0.92, 1400, false) })),
  token('Shifting', F('twist', { radiusPercent: 90 }, { angle: sin(-0.3, 0.3, 2800, false) }), F('glow', { outerStrength: 1.2, distance: 8 }, { color: hue(0x7ad08a, 0xa07cff, 3000) })),
  // Weary (fatigued, exhaustion): heavy slow breaths, shoulders sagging, colour dulled.
  token('Weary', F('transform', { pivotX: 0.5, pivotY: 0.95 }, { scaleY: cos(0.965, 1.015, 3800, false), rotation: sin(-1.2, 1.2, 7600, false) }), F('adjustment', { saturation: 0.6, brightness: 0.85 }),
    F('shadow', { rotation: 90, distance: 4, blur: 4, alpha: 0.6, color: 0x080604 })),
  // Weakened (enfeebled): shrunk thin, knees giving a little.
  token('Weakened', F('transform', { pivotX: 0.5, pivotY: 0.95, scaleX: 0.92 }, { scaleY: cos(0.95, 0.98, 2200, false), rotation: sin(-1.5, 1.5, 2600, false) }), F('adjustment', { saturation: 0.7, brightness: 0.92 })),
  // Dying: a red dark closing in, a slow heartbeat glow.
  token('Dying', F('colorGradient', { type: 1, stops: [{ offset: 0, color: 0x200000, alpha: 0 }, { offset: 0.55, color: 0x200000, alpha: 0.15 }, { offset: 1, color: 0x300000, alpha: 0.8 }] }),
    F('adjustment', { saturation: 0.35, brightness: 0.72 }), F('glow', { distance: 10, color: 0xa01010 }, { outerStrength: cos(0.2, 1.8, 1500) })),
  // Nauseated (sickened): green about the gills, queasy and swaying.
  token('Nauseated', F('transform', { pivotX: 0.5, pivotY: 0.95 }, { rotation: sin(-2.5, 2.5, 2800, false), translationY: sin(-0.008, 0.008, 1900, false) }),
    F('adjustment', { saturation: 0.75, red: 0.9, green: 1.08, blue: 0.86 }), F('glow', { outerStrength: 1, distance: 6, color: 0x8fbf3a })),
  // Feverish (diseased): flushed, heat shimmering off the skin.
  token('Feverish', F('distortion', { amount: 2, maskSpriteScaleX: 2, maskSpriteScaleY: 2 }, { maskSpriteY: { animType: 'move', speed: -0.03 } }),
    F('adjustment', { saturation: 1.05, red: 1.14, green: 0.92, blue: 0.88 }), F('glow', { distance: 8, color: 0xe0602a }, { outerStrength: cos(0.6, 1.4, 2600) })),
  // Trembling (frightened, fleeing): pale and shivering.
  token('Trembling', F('transform', { pivotX: 0.5, pivotY: 0.95 }, { translationX: sin(-0.006, 0.006, 190, false) }), F('adjustment', { saturation: 0.45, brightness: 1.05, red: 0.88, green: 0.97, blue: 1.12 })),
  // Smitten (charmed): a rosy warmth and soft pink rings.
  token('Smitten', timed('wave', 0.3, { strength: 0.004, frequency: 60, color: 0xffb0d0, maxIntensity: 1.2, minIntensity: 0.95, anchorX: 0.5, anchorY: 0.3 }),
    F('adjustment', { red: 1.08, green: 0.95, blue: 1.02 }), F('glow', { distance: 10, color: 0xff7fb4 }, { outerStrength: cos(1, 2.2, 2400) })),
  // Misted (concealed): a pale mist hanging round the creature.
  token('Misted', timed('xfog', 0.4, { color: 0xd8dee6, density: 0.55, alphaDiscard: true }), F('blur', { blur: 0.5 }), F('adjustment', { contrast: 0.85 })),
  // Wounded: old wounds, dried stains, colour a little lower.
  token('Wounded', F('splash', { color: 0x4a0606, seed: 0.33, splashFactor: 2, spread: 3, cut: true, edge: 0.6 }), F('splash', { color: 0x3a0404, seed: 0.79, splashFactor: 2, spread: 2, cut: true, edge: 0.75 }),
    F('adjustment', { saturation: 0.85, brightness: 0.93 })),
  token('Rune Circle',timed('base', 1, { baseType: 4, color: 0xb48cff, radius: 0.62, alpha: 0.85 })),
];

// The library is shared: nothing may change it. Callers clone before tinting or scaling.
const freeze = o => { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); Object.values(o).forEach(freeze); } return o; };
PRESETS.forEach(freeze);

// Copies so callers can tint and scale freely.
export function builtinPresets(library) {
  return PRESETS.filter(p => !library || p.library === library).map(p => structuredClone(p));
}
export function builtinPreset(name, library = LIBRARY.TOKEN) {
  const p = PRESETS.find(x => x.name === name && x.library === library);
  return p ? structuredClone(p) : null;
}
