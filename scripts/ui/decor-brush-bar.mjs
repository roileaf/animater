// The decorations brush's bar (the Decorations tool in Animater's controls): along the bottom of the map while the brush is
// out. Outdoors or underground, the one kind it paints (a row of chips, one lit), how big the brush and how densely it lays them.
// It only holds the choices; main.mjs paints with them. Kept between uses on this screen.

import { DECOR_IDS, DECOR_KINDS } from '../engines/motion/decor-paint.mjs';
import { DECOR_DEFAULT_KINDS } from '../engines/motion/decor-regions.mjs';

export const BRUSH_SIZE = Object.freeze({ min: 0.5, max: 6, usual: 1.5 });
export const BRUSH_THICK = Object.freeze({ min: 0.2, max: 2, usual: 0.8 });
// How big the decorations it lays are, against each kind's usual size.
export const BRUSH_SCALE = Object.freeze({ min: 0.3, max: 3, usual: 1 });
const remembered = { where: 'surface', kinds: { surface: [DECOR_DEFAULT_KINDS.surface[0]], cave: [DECOR_DEFAULT_KINDS.cave[0]] }, size: BRUSH_SIZE.usual, thick: BRUSH_THICK.usual, scale: BRUSH_SCALE.usual, lock: null };

/** The brush's choices now (pure copy): where, the one kind picked there (as a list of one), size in squares, thickness, decoration scale.
 *  While a region's own brush is out, where is the region's and the kind one of its own. */
export const brushChoices = () => ({ where: remembered.lock?.where ?? remembered.where, kinds: remembered.lock ? [remembered.lock.pick] : [...remembered.kinds[remembered.where]], size: remembered.size, thick: remembered.thick, scale: remembered.scale });
/** The kinds a place offers in the bar (pure): its own and those found in both. */
export const brushKindsFor = (where) => DECOR_IDS.filter((id) => DECOR_KINDS[id].set === 'both' || DECOR_KINDS[id].set === where);
/** Whether a kind answers a search (pure): what was typed found in its name, its id, or what sort of thing it is, any case
 *  ("tree" finds Oaks and Pines as well as Fruit trees; "water", "glow" and "cave" their own). */
export const kindMatches = (id, query) => {
  const q = String(query ?? '').trim().toLowerCase(); if (!q) return true;
  const k = DECOR_KINDS[id] ?? {}, words = [k.label ?? '', id, k.tree ? 'tree' : '', k.water ? 'water' : '', k.glow ? 'glow' : '', k.set === 'cave' ? 'cave underground' : ''].join(' ').toLowerCase();
  return words.includes(q);
};

/** Opens the bar; `onClose` when it is closed with its × or Esc. `region` ({ name, where, kinds }) for a region's own brush:
 *  its place only, and only its ticked kinds to pick from. Returns { close, setSize(squares), element }. */
export function openBrushBar({ onClose = () => {}, onChange = () => {}, region = null } = {}) {
  document.getElementById('an-decor-brush')?.remove();
  if (region) { const kinds = region.kinds?.length ? region.kinds : brushKindsFor(region.where), had = remembered.kinds[region.where]?.[0]; remembered.lock = { where: region.where, kinds, name: region.name, pick: kinds.includes(had) ? had : kinds[0] }; }
  else remembered.lock = null;
  const lock = remembered.lock;
  const bar = document.createElement('div'); bar.id = 'an-decor-brush'; bar.className = 'an-decor-brush';
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
  let query = '';
  const draw = () => {
    // (Drawn afresh on every change; the search keeps its text, and its focus while typing in it.)
    const typing = document.activeElement?.classList?.contains('an-db-search') && bar.contains(document.activeElement);
    bar.replaceChildren();
    const head = el('div', 'an-db-head'); head.append(el('strong', '', lock ? `Decorations brush: ${lock.name || 'region'}` : 'Decorations brush'), el('span', 'an-db-hint', 'Pick a kind, drag to paint · Shift-drag rubs out · Ctrl+wheel: size · Shift+wheel: density · Alt+wheel: decoration size · Ctrl+Z undo · Esc stops'));
    const close = el('button', 'an-db-close'); close.type = 'button'; close.setAttribute('aria-label', 'Close'); close.innerHTML = '<i class="fa-solid fa-xmark"></i>'; close.addEventListener('click', () => { api.close(); onClose(); }); head.append(close);
    const where = el('div', 'an-db-seg');
    for (const [key, label] of [['surface', 'Outdoors'], ['cave', 'Underground']]) { const b = el('button', remembered.where === key ? 'an-db-on' : '', label); b.type = 'button'; b.addEventListener('click', () => { remembered.where = key; draw(); onChange(); }); where.append(b); }
    const slider = (label, bounds, key, step) => { const box = el('label', 'an-db-range'), s = el('input'), shown = el('span', '', `${remembered[key]}`); s.type = 'range'; s.min = String(bounds.min); s.max = String(bounds.max); s.step = String(step); s.value = String(remembered[key]); s.addEventListener('input', () => { remembered[key] = Number(s.value); shown.textContent = s.value; onChange(); });
      // The wheel over a slider moves it a step.
      s.addEventListener('wheel', (e) => { e.preventDefault(); const v = Math.min(bounds.max, Math.max(bounds.min, Number(s.value) + (e.deltaY < 0 ? step : -step))); s.value = String(Math.round(v * 100) / 100); s.dispatchEvent(new Event('input')); }, { passive: false });
      box.append(el('span', '', label), s, shown); return box; };
    const row = el('div', 'an-db-row'); if (!lock) row.append(where); row.append(slider('Brush', BRUSH_SIZE, 'size', 0.5), slider('Density', BRUSH_THICK, 'thick', 0.1), slider('Decoration size', BRUSH_SCALE, 'scale', 0.1));
    const chips = el('div', 'an-db-chips'), ticked = brushChoices().kinds;
    const pick = (id) => { if (lock) lock.pick = id; else remembered.kinds[remembered.where] = [id]; draw(); onChange(); };
    for (const id of lock ? lock.kinds : brushKindsFor(remembered.where)) {
      const on = ticked.includes(id), c = el('button', on ? 'an-db-chip an-db-on' : 'an-db-chip', DECOR_KINDS[id].label); c.type = 'button'; c.setAttribute('aria-pressed', String(on)); c.dataset.kind = id;
      // One kind at a time: picking one puts out the other.
      c.addEventListener('click', () => pick(id));
      chips.append(c);
    }
    // A search over the kinds: typing hides the chips that don't match; Enter picks the first one left, Esc clears it.
    const search = el('input', 'an-db-search'); search.type = 'search'; search.placeholder = 'Search kinds…'; search.value = query; search.setAttribute('aria-label', 'Search kinds');
    const filter = () => { const q = query.trim().toLowerCase(); for (const c of chips.children) c.hidden = !!q && !kindMatches(c.dataset.kind, q); };
    search.addEventListener('input', () => { query = search.value; filter(); });
    search.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); const first = [...chips.children].find((c) => !c.hidden); if (first) pick(first.dataset.kind); } else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); query = ''; search.value = ''; filter(); } });
    filter();
    bar.append(head, row, search, chips);
    if (typing) { search.focus(); search.setSelectionRange(search.value.length, search.value.length); }
  };
  const api = { element: bar, close: () => { bar.remove(); if (remembered.lock === lock) remembered.lock = null; },
    setSize: (v) => { remembered.size = Math.min(BRUSH_SIZE.max, Math.max(BRUSH_SIZE.min, Math.round(v * 2) / 2)); draw(); },
    setThick: (v) => { remembered.thick = Math.min(BRUSH_THICK.max, Math.max(BRUSH_THICK.min, Math.round(v * 10) / 10)); draw(); },
    setScale: (v) => { remembered.scale = Math.min(BRUSH_SCALE.max, Math.max(BRUSH_SCALE.min, Math.round(v * 10) / 10)); draw(); } };
  draw();
  (document.getElementById('board')?.parentElement ?? document.body).append(bar);
  return api;
}
