// A stage's own copy of an effect: its layers (filters), every setting and animation.
// Everything stored in recipes passes through normalizeLayers, so imported or hand-edited
// data can never reach a shader malformed or unbounded.
import { specFor } from './filters/index.mjs';
import { isColorArray } from './filters/util.mjs';
import { ANIM_TYPES } from './animation.mjs';

export const MAX_LAYERS = 8;
const ANIM_SET = new Set(ANIM_TYPES);
// Bounds wide enough for colours (up to 0xffffff) and long animation clocks.
const finite = (v, lo = -1e8, hi = 1e8) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : undefined);
// Images: module or user-data paths, no traversal or remote URLs.
const safePath = p => typeof p === 'string' && p.length <= 300 && !/(^|\/)\.\.(\/|$)|^[a-z]+:|^\/\//i.test(p) && /^[\w\-./ %()[\]]+$/.test(p);

function cleanValue(key, value, fallback) {
  if (typeof fallback === 'boolean') return typeof value === 'boolean' ? value : undefined;
  if (typeof fallback === 'number') return finite(typeof value === 'string' && value.trim() !== '' ? Number(value) : value);
  if (key === 'imagePath') return value === '' || safePath(value) ? value : undefined;
  if (isColorArray(fallback)) return isColorArray(value) ? value.map(n => Math.min(1, Math.max(0, n))) : undefined;
  if (key === 'stops' && Array.isArray(value))
    return value.slice(0, 4).map(s => ({ offset: finite(+s?.offset, 0, 1) ?? 0, color: finite(+s?.color, 0, 0xffffff) ?? 0, alpha: finite(+s?.alpha, 0, 1) ?? 1 }));
  return undefined;
}
function cleanAnim(spec) {
  if (!spec || typeof spec !== 'object' || !ANIM_SET.has(spec.animType)) return null;
  const out = { animType: spec.animType };
  for (const [k, lo, hi] of [['loopDuration', 16, 600000], ['val1', -1e7, 1e8], ['val2', -1e7, 1e8], ['speed', -1000, 1000], ['loops', 0, 1e6], ['pauseBetweenDuration', 0, 600000], ['syncShift', 0, 600000], ['chaosFactor', 0, 1]]) {
    const v = finite(spec[k], lo, hi);
    if (v !== undefined) out[k] = v;
  }
  for (const k of ['active', 'clockWise', 'wantInteger']) if (typeof spec[k] === 'boolean') out[k] = spec[k];
  return out;
}
export function normalizeLayer(layer) {
  const spec = specFor(layer?.filterType);
  if (!spec) return null;
  const out = { filterType: spec.type };
  if (layer.enabled === false) out.enabled = false;
  const z = finite(layer.zOrder, -10000, 10000);
  if (z !== undefined) out.zOrder = z;
  for (const [key, value] of Object.entries(layer)) {
    if (!Object.hasOwn(spec.defaults, key)) continue;
    const v = cleanValue(key, value, spec.defaults[key]);
    if (v !== undefined) out[key] = v;
  }
  const animated = {};
  for (const [key, a] of Object.entries(layer.animated ?? {})) {
    if (!Object.hasOwn(spec.defaults, key)) continue;
    const clean = cleanAnim(a);
    if (clean) animated[key] = clean;
  }
  if (Object.keys(animated).length) out.animated = animated;
  return out;
}
export function normalizeLayers(layers) {
  if (!Array.isArray(layers)) return undefined;
  const out = layers.slice(0, MAX_LAYERS).map(normalizeLayer).filter(Boolean);
  return out.length ? out : undefined;
}

// ── Editing (all return a new array; the stage keeps the result) ────────────────
export const layersOf = (stage, preset) => structuredClone(stage.fxLayers ?? preset?.params ?? []).map(normalizeLayer).filter(Boolean);
export function setLayerValue(layers, index, key, value) {
  const next = structuredClone(layers), layer = next[index];
  if (!layer) return layers;
  if (key === 'enabled') { if (value) delete layer.enabled; else layer.enabled = false; return next; }
  const spec = specFor(layer.filterType), v = cleanValue(key, value, spec?.defaults[key]);
  if (v === undefined) return layers;
  layer[key] = v;
  return next;
}
// `spec` null removes the animation; otherwise fields are merged into it.
export function setLayerAnimation(layers, index, key, spec) {
  const next = structuredClone(layers), layer = next[index];
  if (!layer || !Object.hasOwn(specFor(layer.filterType)?.defaults ?? {}, key)) return layers;
  layer.animated ??= {};
  if (!spec) delete layer.animated[key];
  else {
    const merged = cleanAnim({ ...(layer.animated[key] ?? {}), ...spec });
    if (merged) layer.animated[key] = merged;
  }
  if (!Object.keys(layer.animated).length) delete layer.animated;
  return next;
}
export function addLayer(layers, filterType) {
  if (layers.length >= MAX_LAYERS || !specFor(filterType)) return layers;
  const spec = specFor(filterType);
  const layer = { filterType };
  // A layer whose look moves over time starts moving at its natural speed.
  if (spec.timeScale) layer.animated = { time: { animType: 'move', speed: 1 / (spec.timeScale * 1000) } };
  return [...structuredClone(layers), layer];
}
export function removeLayer(layers, index) { return layers.filter((_, i) => i !== index); }
export function moveLayer(layers, index, by) {
  const to = index + by;
  if (to < 0 || to >= layers.length) return layers;
  const next = structuredClone(layers);
  [next[index], next[to]] = [next[to], next[index]];
  // Stacking follows the list order once someone reorders by hand.
  next.forEach((l, i) => { l.zOrder = (i + 1) * 10; });
  return next;
}
// The current value a control shows: the layer's own value, else the filter default.
export const layerValue = (layer, key) => (Object.hasOwn(layer, key) ? layer[key] : specFor(layer.filterType)?.defaults[key]);
