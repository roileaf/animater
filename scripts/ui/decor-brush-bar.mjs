// The decorations brush's bar (the Decorations tool in Animater's controls): along the bottom of the map while the brush is
// out. Outdoors or underground, which kinds it paints (each a chip, on or off), how big the brush and how thick it lays them.
// It only holds the choices; main.mjs paints with them. Kept between uses on this screen.

import { DECOR_IDS, DECOR_KINDS } from '../engines/motion/decor-paint.mjs';
import { DECOR_DEFAULT_KINDS } from '../engines/motion/decor-regions.mjs';

export const BRUSH_SIZE = Object.freeze({ min: 0.5, max: 6, usual: 1.5 });
export const BRUSH_THICK = Object.freeze({ min: 0.2, max: 2, usual: 0.8 });
const remembered = { where: 'surface', kinds: { surface: [...DECOR_DEFAULT_KINDS.surface], cave: [...DECOR_DEFAULT_KINDS.cave] }, size: BRUSH_SIZE.usual, thick: BRUSH_THICK.usual };

/** The brush's choices now (pure copy): where, the kinds ticked there, size in squares, thickness. */
export const brushChoices = () => ({ where: remembered.where, kinds: [...remembered.kinds[remembered.where]], size: remembered.size, thick: remembered.thick });
/** The kinds a place offers in the bar (pure): its own and those found in both. */
export const brushKindsFor = (where) => DECOR_IDS.filter((id) => DECOR_KINDS[id].set === 'both' || DECOR_KINDS[id].set === where);

/** Opens the bar; `onClose` when it is closed with its × or Esc. Returns { close, setSize(squares), element }. */
export function openBrushBar({ onClose = () => {}, onChange = () => {} } = {}) {
  document.getElementById('an-decor-brush')?.remove();
  const bar = document.createElement('div'); bar.id = 'an-decor-brush'; bar.className = 'an-decor-brush';
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
  const draw = () => {
    bar.replaceChildren();
    const head = el('div', 'an-db-head'); head.append(el('strong', '', 'Decorations brush'), el('span', 'an-db-hint', 'Drag to paint · Shift-drag rubs out · Ctrl+wheel: size · Shift+wheel: thickness · Ctrl+Z undo · Esc stops'));
    const close = el('button', 'an-db-close'); close.type = 'button'; close.setAttribute('aria-label', 'Close'); close.innerHTML = '<i class="fa-solid fa-xmark"></i>'; close.addEventListener('click', () => { api.close(); onClose(); }); head.append(close);
    const where = el('div', 'an-db-seg');
    for (const [key, label] of [['surface', 'Outdoors'], ['cave', 'Underground']]) { const b = el('button', remembered.where === key ? 'an-db-on' : '', label); b.type = 'button'; b.addEventListener('click', () => { remembered.where = key; draw(); onChange(); }); where.append(b); }
    const slider = (label, bounds, key, step) => { const box = el('label', 'an-db-range'), s = el('input'), shown = el('span', '', `${remembered[key]}`); s.type = 'range'; s.min = String(bounds.min); s.max = String(bounds.max); s.step = String(step); s.value = String(remembered[key]); s.addEventListener('input', () => { remembered[key] = Number(s.value); shown.textContent = s.value; onChange(); });
      // The wheel over a slider moves it a step.
      s.addEventListener('wheel', (e) => { e.preventDefault(); const v = Math.min(bounds.max, Math.max(bounds.min, Number(s.value) + (e.deltaY < 0 ? step : -step))); s.value = String(Math.round(v * 100) / 100); s.dispatchEvent(new Event('input')); }, { passive: false });
      box.append(el('span', '', label), s, shown); return box; };
    const row = el('div', 'an-db-row'); row.append(where, slider('Brush', BRUSH_SIZE, 'size', 0.5), slider('Thickness', BRUSH_THICK, 'thick', 0.1));
    const chips = el('div', 'an-db-chips'), ticked = remembered.kinds[remembered.where];
    for (const id of brushKindsFor(remembered.where)) {
      const on = ticked.includes(id), c = el('button', on ? 'an-db-chip an-db-on' : 'an-db-chip', DECOR_KINDS[id].label); c.type = 'button'; c.setAttribute('aria-pressed', String(on));
      c.addEventListener('click', () => { const list = remembered.kinds[remembered.where], i = list.indexOf(id); if (i >= 0) list.splice(i, 1); else list.push(id); draw(); onChange(); });
      chips.append(c);
    }
    bar.append(head, row, chips);
  };
  const api = { element: bar, close: () => bar.remove(),
    setSize: (v) => { remembered.size = Math.min(BRUSH_SIZE.max, Math.max(BRUSH_SIZE.min, Math.round(v * 2) / 2)); draw(); },
    setThick: (v) => { remembered.thick = Math.min(BRUSH_THICK.max, Math.max(BRUSH_THICK.min, Math.round(v * 10) / 10)); draw(); } };
  draw();
  (document.getElementById('board')?.parentElement ?? document.body).append(bar);
  return api;
}
