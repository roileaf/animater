// Editor controls for every filter setting: what kind of input, its range and its label.
// Derived from each spec's defaults, with explicit choices where a number means a style.
import { SPECS, specFor } from './filters/index.mjs';
import { isColorArray } from './filters/util.mjs';
import { ANIM_TYPES } from './animation.mjs';

export const BLEND_MODES = ['Normal', 'Add', 'Screen', 'Overlay', 'Multiply', 'Soft light', 'Hard light', 'Colour dodge', 'Lighten', 'Glow', 'Difference', 'Subtract', 'Exclusion', 'Hue', 'Luminosity'];
const SELECTS = {
  blend: Object.fromEntries(BLEND_MODES.map((label, i) => [i, label])),
  shieldType: { 1: 'Fire', 2: 'Hexagons', 3: 'Smoke', 4: 'Stone plates', 5: 'Stone crown', 6: 'Wind', 7: 'Arcane runes', 8: 'Soap film', 9: 'Water', 10: 'Plasma', 11: 'Grid', 12: 'Warped space', 13: 'Colour swirl' },
  auraType: { 1: 'Cold (soft)', 2: 'Hot (licking)' },
  materialType: { 1: 'Stone', 2: 'Ice', 3: 'Iron', 4: 'Gold', 5: 'Crystal', 6: 'Bark' },
  bindType: { 1: 'Vines', 2: 'Net', 3: 'Chains', 4: 'Ropes' },
  baseType: { 1: 'Disc', 2: 'Ring', 3: 'Pulse', 4: 'Rune circle' },
};
const TYPE_SELECTS = {
  colorGradient: { type: { 0: 'Linear', 1: 'Radial', 2: 'Conic' } },
  polymorph: { type: { 1: 'Burning dissolve', 2: 'Wipe upward', 3: 'From the centre', 4: 'Pixel scatter' } },
};
// Settings driven by animations or internal bookkeeping, not shown as plain inputs.
const HIDDEN = new Set(['time', 'seed', 'padding']);

// [pattern, min, max, step] — first match wins.
const RANGES = [
  [/^(?:amount|snow|cracks|tightness|alpha|[a-z]*Alpha|alphaImg|alphaChr|alphaTolerance|threshold|discardThreshold|billowy|tintIntensity|glint|sepia|noise|lineContrast|vignetting|vignettingBlur|scratchDensity|tintIntensity|epsilon)$/, 0, 1, 0.01],
  [/^(?:anchor|pivot|center|offset)[XY]$/, -0.5, 1.5, 0.01],
  [/^translation[XY]$/, -1, 1, 0.01],
  [/^(?:scale[XY]|maskSpriteScale[XY])$/, 0.05, 10, 0.05],
  [/^(?:rotation)$/, -360, 360, 1],
  [/^angle$/, -6.3, 6.3, 0.05],
  [/^(?:radiusPercent|innerRadiusPercent|progress)$/, 0, 400, 1],
  [/^(?:distance|thickness|amount|spread)$/, 0, 60, 0.5],
  [/^(?:blur|blurX|blurY)$/, 0, 30, 0.25],
  [/^(?:outerStrength|innerStrength|intensity|auraIntensity|subAuraIntensity|bloomScale)$/, 0, 10, 0.05],
  [/^(?:amplitude|strength|brightness|contrast|saturation|gamma|red|green|blue|maxIntensity|minIntensity|magnify)$/, 0, 4, 0.01],
  [/^(?:frequency|wavelength)$/, 1, 600, 1],
  [/^(?:speed)$/, 0, 200, 1],
  [/^(?:radius)$/, -1, 3, 0.05],
  [/^(?:grain|density)$/, 0.1, 6, 0.05],
  [/^(?:scale)$/, 0.05, 400, 0.05],
  [/^(?:size[XY]?|lineWidth|noiseSize|scratchWidth)$/, 0.5, 64, 0.5],
  [/^(?:nbImage|div1|div2|divisor|splashFactor|gridPadding)$/, 0, 64, 1],
  [/^(?:dim[XY])$/, 0.05, 20, 0.05],
  [/^(?:curvature|dispersion)$/, -2, 10, 0.1],
  [/^(?:redX|redY|greenX|greenY|blueX|blueY)$/, -40, 40, 0.5],
];
const words = key => key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([A-Za-z])(\d)/g, '$1 $2').replace(/^./, c => c.toUpperCase()).replace(/\bX\b/, '(horizontal)').replace(/\bY\b/, '(vertical)');
const LABELS = { originalColor: 'Colour to replace', newColor: 'Replace with', alphaImg: 'Copies opacity', alphaChr: 'Copies colour fringe', nbImage: 'Copies', div1: 'Spokes', div2: 'Rings', fireBlend: 'Over the art', alphaDiscard: 'Only on the art', inlay: 'Burn inside the art', discard: 'Aura only', shadowOnly: 'Shadow only', zapshadow: 'Remove baked shadow', top: 'Over the art', cut: 'Only on the art' };

export function controlsFor(type) {
  const spec = specFor(type);
  if (!spec) return [];
  return Object.entries(spec.defaults).flatMap(([key, value]) => {
    if (HIDDEN.has(key)) return [];
    const label = LABELS[key] ?? words(key);
    if (key === 'imagePath') return [{ key, label: 'Image', kind: 'path' }];
    if (key === 'stops') return [{ key, label: 'Colour stops', kind: 'stops' }];
    const select = TYPE_SELECTS[type]?.[key] ?? SELECTS[key];
    if (select) return [{ key, label, kind: 'select', choices: select }];
    if (typeof value === 'boolean') return [{ key, label, kind: 'check' }];
    if (isColorArray(value)) return [{ key, label, kind: 'color', array: true }];
    if (typeof value === 'number' && /colou?r$|^tint$/i.test(key)) return [{ key, label, kind: 'color' }];
    if (typeof value !== 'number') return [];
    const range = RANGES.find(([re]) => re.test(key));
    const [, min, max, step] = range ?? [null, Math.min(0, value * 4), Math.max(1, Math.abs(value) * 4), 0.01];
    return [{ key, label, kind: 'range', min, max, step }];
  });
}
// Every numeric setting can be animated (colours with colour oscillations).
export function animatableKeys(type) {
  return controlsFor(type).filter(c => c.kind === 'range' || c.kind === 'color' && !c.array).map(c => c.key).concat(specFor(type)?.defaults.time !== undefined ? ['time'] : []);
}
export const ANIM_LABELS = {
  move: 'Flow (steady)', rotation: 'Spin', syncRotation: 'Spin (in sync)',
  cosOscillation: 'Pulse', syncCosOscillation: 'Pulse (in sync)', halfCosOscillation: 'Ease one way',
  sinOscillation: 'Wave', syncSinOscillation: 'Wave (in sync)', halfSinOscillation: 'Swell',
  chaoticOscillation: 'Flicker', syncChaoticOscillation: 'Flicker (in sync)',
  colorOscillation: 'Colour shift', syncColorOscillation: 'Colour shift (in sync)', halfColorOscillation: 'Colour fade',
  randomNumber: 'Random each frame', randomNumberPerLoop: 'Random each loop', randomColor: 'Random colour each frame', randomColorPerLoop: 'Random colour each loop',
};
export const ANIM_CHOICES = Object.fromEntries(ANIM_TYPES.map(t => [t, ANIM_LABELS[t] ?? t]));
export const FILTER_LABELS = {
  adjustment: 'Colour adjust', ascii: 'Text art', dot: 'Halftone', distortion: 'Heat haze', crt: 'Old monitor', oldfilm: 'Old film',
  glow: 'Glow', outline: 'Outline', colorGradient: 'Colour gradient', bevel: 'Bevel', xbloom: 'Bloom', shadow: 'Drop shadow',
  twist: 'Twist', zoomblur: 'Zoom blur', blur: 'Blur', bulgepinch: 'Bulge / pinch', zapshadow: 'Remove baked shadow', ray: 'Light rays',
  fog: 'Fog', xfog: 'Thick fog', electric: 'Lightning', wave: 'Ripples', shockwave: 'Shockwave', fire: 'Fire', fumes: 'Fumes',
  smoke: 'Smoke', flood: 'Water', images: 'Mirror images', field: 'Force field', xray: 'Sun rays', liquid: 'Liquid', xglow: 'Living aura',
  pixel: 'Pixelate', web: 'Spider web', ripples: 'Sun ripples', globes: 'Fireflies', transform: 'Move / turn / squash', splash: 'Splash',
  polymorph: 'Polymorph', xfire: 'Magic fire', sprite: 'Image overlay', spriteMask: 'Image mask', replaceColor: 'Replace colour',
  ddTint: 'Map tint', rgbSplit: 'RGB split', material: 'Material (stone, ice, metal…)', frost: 'Frost and snow', bindings: 'Bindings (vines, net, chains, ropes)', base: 'Ground marker',
};
export const filterLabel = type => FILTER_LABELS[type] ?? words(type);
export const FILTER_CHOICES = Object.fromEntries(Object.keys(SPECS).map(t => [t, filterLabel(t)]).sort((a, b) => a[1].localeCompare(b[1])));
