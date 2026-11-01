// Tokenshade variations and sharing (the Tokenshade page): Shuffle nudges every setting of an effect within its own
// range and turns its colours a little round the wheel; a share code carries an effect as plain text to paste in
// Discord or an issue, and back. Pure, so the page and tests share it.
import { controlsFor } from './controls.mjs';
import { normalizeLayers } from './layers.mjs';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
// A colour turned round the hue wheel by `turn` (0..1), keeping its brightness and saturation.
function turnHue(color, turn) {
  const r = (color >> 16 & 255) / 255, g = (color >> 8 & 255) / 255, b = (color & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = ((h / 6 + turn) % 1 + 1) % 1;
  const s = max ? d / max : 0, v = max;
  const f = (n) => { const k = (n + h * 6) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); };
  return Math.round(f(5) * 255) << 16 | Math.round(f(3) * 255) << 8 | Math.round(f(1) * 255);
}

// A variation: each range setting moved by up to `amount` of its own span, each colour turned by up to a sixth of the
// wheel (all of one effect's colours together, so they still go with each other). Styles and switches stay.
export function shuffleLayers(layers, { amount = 0.2, random = Math.random } = {}) {
  const turn = (random() - 0.5) / 3;
  return (layers ?? []).map((layer) => {
    const next = structuredClone(layer);
    for (const c of controlsFor(layer.filterType)) {
      const v = next[c.key];
      if (c.kind === 'range' && typeof v === 'number' && !next.animated?.[c.key]) {
        const span = c.max - c.min, moved = v + (random() - 0.5) * 2 * amount * span;
        next[c.key] = Math.round(clamp(moved, c.min, c.max) / c.step) * c.step;
      } else if (c.kind === 'color' && typeof v === 'number' && v > 0) next[c.key] = turnHue(v, turn);
    }
    return next;
  });
}

// Share codes: "animater-fx:" and the effect as JSON. Reading one keeps only what Tokenshade can draw.
const PREFIX = 'animater-fx:';
export function shareCode(name, layers) {
  return PREFIX + JSON.stringify({ name: String(name ?? '').slice(0, 80), params: normalizeLayers(layers) ?? [] });
}
export function readShareCode(text) {
  const raw = String(text ?? '').trim();
  const body = raw.startsWith(PREFIX) ? raw.slice(PREFIX.length) : raw;
  let data;
  try { data = JSON.parse(body); } catch { throw Error('That is not a Tokenshade share code.'); }
  const params = normalizeLayers(data?.params);
  if (!params) throw Error('That share code has no effect Tokenshade can draw.');
  return { name: String(data.name ?? '').trim().slice(0, 80) || 'Shared effect', params };
}
