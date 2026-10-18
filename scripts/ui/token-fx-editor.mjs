// The Tokenshade stage editor: every layer of the effect, every setting and every animation.
// A stage plays its preset until the first edit; from then on it keeps its own copy
// (stage.fxLayers), so the preset itself never changes.
import { specFor } from '../engines/tokenshade/filters/index.mjs';
import { controlsFor, animatableKeys, ANIM_CHOICES, FILTER_CHOICES, filterLabel } from '../engines/tokenshade/controls.mjs';
import { layersOf, setLayerValue, setLayerAnimation, addLayer, removeLayer, moveLayer, layerValue, MAX_LAYERS } from '../engines/tokenshade/layers.mjs';

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const opts = (choices, value) => Object.entries(choices).map(([k, v]) => `<option value="${esc(k)}" ${String(k) === String(value) ? 'selected' : ''}>${esc(v)}</option>`).join('');
const hex = n => `#${(Number(n) >>> 0 & 0xffffff).toString(16).padStart(6, '0')}`;
const arrayHex = a => hex(Math.round(a[0] * 255) << 16 | Math.round(a[1] * 255) << 8 | Math.round(a[2] * 255));
const fromHex = h => parseInt(String(h).replace('#', ''), 16) || 0;
const toArray = h => { const n = fromHex(h); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
const round = v => Math.round(Number(v) * 1000) / 1000;
// A `move` on time is shown as a rate: 1 = the filter's natural motion speed.
const timeScale = type => specFor(type)?.timeScale ?? 1;
const flowRate = (type, speed) => round((Number(speed) || 0) * timeScale(type) * 1000);
const flowSpeed = (type, rate) => Number(rate) / (timeScale(type) * 1000);
const COLOR_ANIMS = new Set(['colorOscillation', 'syncColorOscillation', 'halfColorOscillation', 'randomColor', 'randomColorPerLoop']);

function controlHTML(c, layer, attrs) {
  const v = layerValue(layer, c.key), a = `${attrs} data-key="${esc(c.key)}"`;
  if (c.kind === 'check') return `<label class="an-check"><input type="checkbox" ${a} ${v ? 'checked' : ''}>${esc(c.label)}</label>`;
  if (c.kind === 'select') return `<label>${esc(c.label)}<select ${a}>${opts(c.choices, Math.round(Number(v) || 0))}</select></label>`;
  if (c.kind === 'color') return `<label>${esc(c.label)}<input type="color" ${a} value="${c.array ? arrayHex(v) : hex(v)}"></label>`;
  if (c.kind === 'path') return `<label class="an-fx-wide">${esc(c.label)}<input type="text" ${a} value="${esc(v)}" placeholder="modules/…/image.webp"></label>`;
  if (c.kind === 'stops') return (Array.isArray(v) ? v : []).concat(Array(4).fill(null)).slice(0, 4).map((s, i) =>
    `<div class="an-fx-stop"><span>Stop ${i + 1}</span><input type="color" ${a} data-stop="${i}" data-part="color" value="${hex(s?.color ?? 0xffffff)}" aria-label="Stop ${i + 1} colour"><input type="number" ${a} data-stop="${i}" data-part="offset" min="0" max="1" step="0.05" value="${s ? round(s.offset) : ''}" placeholder="—" aria-label="Stop ${i + 1} position"><input type="number" ${a} data-stop="${i}" data-part="alpha" min="0" max="1" step="0.05" value="${s ? round(s.alpha) : ''}" placeholder="—" aria-label="Stop ${i + 1} opacity"></div>`).join('');
  return `<label>${esc(c.label)}<span class="an-fx-range"><input type="range" ${a} min="${c.min}" max="${c.max}" step="${c.step}" value="${esc(round(v))}"><output>${esc(round(v))}</output></span></label>`;
}
function animHTML(type, key, anim, attrs, label) {
  const a = `${attrs} data-key="${esc(key)}"`;
  const colorish = COLOR_ANIMS.has(anim.animType);
  const field = (part, value, extra = '') => `<input type="${colorish && part.startsWith('val') ? 'color' : 'number'}" ${a} data-anim="${part}" ${extra} value="${colorish && part.startsWith('val') ? hex(value ?? 0) : esc(round(value ?? 0))}" aria-label="${esc(label)} ${part}">`;
  const body = anim.animType === 'move'
    ? `<label>Rate${field('rate', key === 'time' ? flowRate(type, anim.speed) : anim.speed, 'step="0.05"')}</label>`
    : anim.animType.includes('otation')
      ? `<label>Turn every (ms)${field('loopDuration', anim.loopDuration ?? 3000, 'min="16" step="50"')}</label><label class="an-check"><input type="checkbox" ${a} data-anim="clockWise" ${anim.clockWise === false ? '' : 'checked'}>Clockwise</label>`
      : `<label>From${field('val1', anim.val1)}</label><label>To${field('val2', anim.val2)}</label><label>Every (ms)${field('loopDuration', anim.loopDuration ?? 3000, 'min="16" step="50"')}</label>`;
  return `<div class="an-fx-anim"><b>${esc(label)}</b><select ${a} data-anim="animType" aria-label="${esc(label)} animation"><option value="">Not animated</option>${opts(ANIM_CHOICES, anim.animType)}</select>${body}</div>`;
}

// The editor section for a token FX stage. `preset` is the stage's library preset (or null).
export function tokenFxEditorHTML(stage, index, preset, { canSave = false } = {}) {
  const layers = layersOf(stage, preset), edited = !!stage.fxLayers?.length;
  const base = `data-field="fxLayer" data-index="${index}"`;
  const layerHTML = layers.map((layer, li) => {
    const attrs = `${base} data-layer="${li}"`, animated = layer.animated ?? {};
    const label = filterLabel(layer.filterType);
    const controls = controlsFor(layer.filterType).filter(c => !animated[c.key]).map(c => controlHTML(c, layer, attrs)).join('');
    const anims = Object.entries(animated).map(([key, a]) => animHTML(layer.filterType, key, a, attrs, key === 'time' ? 'Motion' : controlsFor(layer.filterType).find(c => c.key === key)?.label ?? key)).join('');
    const free = animatableKeys(layer.filterType).filter(k => !animated[k]);
    const addAnim = free.length ? `<label>Animate<select ${attrs} data-key="__animate"><option value="">Choose a setting…</option>${free.map(k => `<option value="${esc(k)}">${esc(k === 'time' ? 'Motion' : controlsFor(layer.filterType).find(c => c.key === k)?.label ?? k)}</option>`).join('')}</select></label>` : '';
    return `<fieldset class="an-fx-layer${layer.enabled === false ? ' is-off' : ''}"><legend><label class="an-check"><input type="checkbox" ${attrs} data-key="enabled" ${layer.enabled === false ? '' : 'checked'}>${esc(label)}</label><span class="an-fx-layer-tools"><button type="button" data-action="fx-layer-move" data-index="${index}" data-layer="${li}" data-by="-1" ${li ? '' : 'disabled'} aria-label="Move ${esc(label)} down the stack">↑</button><button type="button" data-action="fx-layer-move" data-index="${index}" data-layer="${li}" data-by="1" ${li < layers.length - 1 ? '' : 'disabled'} aria-label="Move ${esc(label)} up the stack">↓</button><button type="button" data-action="fx-layer-remove" data-index="${index}" data-layer="${li}" aria-label="Remove ${esc(label)}">✕</button></span></legend><div class="an-options-grid">${controls}</div>${anims ? `<div class="an-fx-anims">${anims}</div>` : ''}${addAnim}</fieldset>`;
  }).join('');
  const speed = stage.fxSpeed ?? 1;
  return `<details class="an-fx-editor" ${edited ? 'open' : ''}><summary>Customize effect <small>${layers.length} layer${layers.length === 1 ? '' : 's'} · ${edited ? 'edited for this stage' : 'as the preset'}</small></summary>
<label>Speed<span class="an-fx-range"><input type="range" data-field="fxSpeed" data-index="${index}" min="0.1" max="5" step="0.05" value="${round(speed)}"><output>${round(speed)}×</output></span></label>
${layerHTML || '<p class="an-hint">Choose a preset or add a layer.</p>'}
${layers.length < MAX_LAYERS ? `<label>Add layer<select ${base} data-key="__add"><option value="">Choose a filter…</option>${opts(FILTER_CHOICES, '')}</select></label>` : `<p class="an-hint">Up to ${MAX_LAYERS} layers.</p>`}
<div class="an-fx-editor-actions"><button type="button" data-action="fx-layers-reset" data-index="${index}" ${edited ? '' : 'disabled'}>Back to the preset</button>${canSave ? `<input data-fx-preset-name="${index}" maxlength="80" placeholder="Preset name" aria-label="Preset name" value="${esc(stage.fxPreset ?? '')}"><button type="button" data-action="fx-preset-save" data-index="${index}">Save as my preset</button>${stage.fxLibrary === 'animater-custom' && stage.fxPreset ? `<button type="button" data-action="fx-preset-delete" data-index="${index}">Delete “${esc(stage.fxPreset)}”</button>` : ''}` : ''}</div>
</details>`;
}

// Apply one input event to the stage. Returns true when the stage changed.
export function applyTokenFxEdit(stage, preset, data, input) {
  const layers = layersOf(stage, preset), li = Number(data.layer), key = data.key;
  let next = layers;
  if (key === '__add') { if (!input.value) return false; next = addLayer(layers, input.value); }
  else if (key === '__animate') {
    if (!input.value) return false;
    const layer = layers[li], k = input.value, spec = specFor(layer?.filterType);
    if (!spec) return false;
    const v = layerValue(layer, k);
    const anim = k === 'time' ? { animType: 'move', speed: flowSpeed(layer.filterType, 1) }
      : /colou?r$/i.test(k) ? { animType: 'colorOscillation', val1: Number(v) || 0, val2: 0xffffff, loopDuration: 3000 }
        : { animType: 'cosOscillation', val1: Number(v) || 0, val2: (Number(v) || 0) * 1.5 || 1, loopDuration: 2000 };
    next = setLayerAnimation(layers, li, k, anim);
  } else if (data.anim) {
    const layer = layers[li];
    if (!layer) return false;
    if (data.anim === 'animType') next = setLayerAnimation(layers, li, key, input.value ? { animType: input.value } : null);
    else if (data.anim === 'rate') next = setLayerAnimation(layers, li, key, { speed: key === 'time' ? flowSpeed(layer.filterType, input.value) : Number(input.value) });
    else if (data.anim === 'clockWise') next = setLayerAnimation(layers, li, key, { clockWise: input.checked });
    else next = setLayerAnimation(layers, li, key, { [data.anim]: input.type === 'color' ? fromHex(input.value) : Number(input.value) });
  } else if (key === 'stops') {
    const layer = layers[li], stops = structuredClone(Array.isArray(layerValue(layer, 'stops')) ? layerValue(layer, 'stops') : []);
    const i = Number(data.stop);
    stops[i] ??= { offset: i / 3, color: 0xffffff, alpha: 1 };
    stops[i][data.part] = data.part === 'color' ? fromHex(input.value) : Number(input.value);
    next = setLayerValue(layers, li, 'stops', stops.filter(Boolean));
  } else {
    const layer = layers[li];
    if (!layer) return false;
    const d = specFor(layer.filterType)?.defaults[key];
    const value = input.type === 'checkbox' ? input.checked
      : input.type === 'color' ? (Array.isArray(d) ? toArray(input.value) : fromHex(input.value))
        : typeof d === 'number' ? Number(input.value) : input.value;
    next = setLayerValue(layers, li, key, value);
  }
  if (next === layers) return false;
  stage.fxLayers = next;
  return true;
}
export function tokenFxAction(action, stage, preset, data) {
  const layers = layersOf(stage, preset), li = Number(data.layer);
  if (action === 'fx-layers-reset') { delete stage.fxLayers; return true; }
  if (action === 'fx-layer-remove') { stage.fxLayers = removeLayer(layers, li); return true; }
  if (action === 'fx-layer-move') { stage.fxLayers = moveLayer(layers, li, Number(data.by)); return true; }
  return false;
}
