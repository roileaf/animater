// The decorations brush's bar (the Decorations tool in Animater's controls): along the bottom of the map while the brush is
// out. Outdoors, town or underground, the one kind it paints (a row of chips, one lit), how big the brush and how densely it lays them.
// It only holds the choices; main.mjs paints with them. Kept between uses on this screen.

import { DECOR_IDS, DECOR_KINDS } from '../engines/motion/decor-paint.mjs';
import { DECOR_DEFAULT_KINDS } from '../engines/motion/decor-regions.mjs';

export const BRUSH_SIZE = Object.freeze({ min: 0.5, max: 6, usual: 1.5 });
export const BRUSH_THICK = Object.freeze({ min: 0.2, max: 2, usual: 0.8 });
// How big the decorations it lays are, against each kind's usual size.
export const BRUSH_SCALE = Object.freeze({ min: 0.3, max: 3, usual: 1 });
// The bar's three places. Town is above ground (it paints and looks as outdoors does) with the built things a town has, and the
// little that grows or lies about in its streets; outdoors keeps to the wild, underground to caves and dungeons.
const TOWN = ['lampPost', 'well', 'haystack', 'fence', 'sacks', 'cobbles', 'tombstone', 'coffin', 'brazier', 'marketStall', 'tableStools', 'bench', 'trough', 'planter', 'washtub', 'produce', 'anvil', 'crate', 'barrel', 'campfire', 'pickaxe', 'papers', 'puddle', 'pebbles', 'rubble', 'grass', 'flowers', 'leaves', 'moss'];
// Kept out of the wild: the town's built things, and a dungeon's (a tomb, a hoard, a cage).
const BUILT = new Set(['marketStall', 'tableStools', 'bench', 'trough', 'planter', 'washtub', 'produce', 'anvil', 'urns', 'lampPost', 'well', 'haystack', 'fence', 'sacks', 'cobbles', 'tombstone', 'brazier', 'papers', 'sarcophagus', 'coffin', 'treasure', 'cage']);
export const BRUSH_PLACES = Object.freeze([['surface', 'Outdoors'], ['town', 'Town'], ['cave', 'Underground']]);
const placeWhere = (place) => (place === 'cave' ? 'cave' : 'surface');
const remembered = { where: 'surface', kinds: { surface: [DECOR_DEFAULT_KINDS.surface[0]], town: ['well'], cave: [DECOR_DEFAULT_KINDS.cave[0]] }, size: BRUSH_SIZE.usual, thick: BRUSH_THICK.usual, scale: BRUSH_SCALE.usual, turn: null, lock: null };
// How the decorations it lays are turned: null for every one its own way, else an angle in radians (Shift+wheel, 15° a step).
export const BRUSH_TURN_STEP = Math.PI / 12;

/** The brush's choices now (pure copy): where, the one kind picked there (as a list of one), size in squares, thickness, decoration scale.
 *  While a region's own brush is out, where is the region's and the kind one of its own. */
export const brushChoices = () => ({ where: remembered.lock?.where ?? placeWhere(remembered.where), place: remembered.lock ? null : remembered.where, kinds: remembered.lock ? [remembered.lock.pick] : [...remembered.kinds[remembered.where]], size: remembered.size, thick: remembered.thick, scale: remembered.scale, turn: remembered.turn });
/** The kinds a place offers in the bar (pure): 'town' its built things and street litter; 'surface' (outdoors) and 'cave' their
 *  own and those found in both, outdoors leaving built things to the town and the dungeon. */
export const brushKindsFor = (where) => (where === 'town' ? TOWN.filter((id) => DECOR_KINDS[id]) : DECOR_IDS.filter((id) => (DECOR_KINDS[id].set === 'both' || DECOR_KINDS[id].set === where) && !(where === 'surface' && BUILT.has(id))));
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
    const head = el('div', 'an-db-head'); head.append(el('strong', '', lock ? `Decorations brush: ${lock.name || 'region'}` : 'Decorations brush'), el('span', 'an-db-hint', 'Pick a kind, drag to paint · Shift-drag rubs out · Ctrl+wheel: size · Shift+wheel: rotate · Ctrl+Shift+wheel: density · Alt+wheel: decoration size · Ctrl+Z undo · Esc stops'));
    const close = el('button', 'an-db-close'); close.type = 'button'; close.setAttribute('aria-label', 'Close'); close.innerHTML = '<i class="fa-solid fa-xmark"></i>'; close.addEventListener('click', () => { api.close(); onClose(); }); head.append(close);
    const where = el('div', 'an-db-seg');
    for (const [key, label] of BRUSH_PLACES) { const b = el('button', remembered.where === key ? 'an-db-on' : '', label); b.type = 'button'; b.addEventListener('click', () => { remembered.where = key; draw(); onChange(); }); where.append(b); }
    const slider = (label, bounds, key, step) => { const box = el('label', 'an-db-range'), s = el('input'), shown = el('span', '', `${remembered[key]}`); s.type = 'range'; s.min = String(bounds.min); s.max = String(bounds.max); s.step = String(step); s.value = String(remembered[key]); s.addEventListener('input', () => { remembered[key] = Number(s.value); shown.textContent = s.value; onChange(); });
      // The wheel over a slider moves it a step.
      s.addEventListener('wheel', (e) => { e.preventDefault(); const v = Math.min(bounds.max, Math.max(bounds.min, Number(s.value) + (e.deltaY < 0 ? step : -step))); s.value = String(Math.round(v * 100) / 100); s.dispatchEvent(new Event('input')); }, { passive: false });
      box.append(el('span', '', label), s, shown); return box; };
    const row = el('div', 'an-db-row'); if (!lock) row.append(where); row.append(slider('Brush', BRUSH_SIZE, 'size', 0.5), slider('Density', BRUSH_THICK, 'thick', 0.1), slider('Decoration size', BRUSH_SCALE, 'scale', 0.1));
    // Rotation: shown in degrees once turned; Random sets every decoration its own way again.
    const turnBox = el('div', 'an-db-range an-db-turn'), deg = remembered.turn === null ? null : Math.round(((remembered.turn * 180) / Math.PI % 360 + 360) % 360);
    const rot = el('button', remembered.turn === null ? 'an-db-on' : '', 'Random'); rot.type = 'button'; rot.addEventListener('click', () => { remembered.turn = null; draw(); onChange(); });
    const turnLeft = el('button', '', '⟲'), turnRight = el('button', '', '⟳'); for (const [b, dir] of [[turnLeft, -1], [turnRight, 1]]) { b.type = 'button'; b.addEventListener('click', () => { api.turnBy(dir); onChange(); }); }
    turnBox.append(el('span', '', 'Rotation'), turnLeft, el('span', 'an-db-deg', deg === null ? '—' : `${deg}°`), turnRight, rot); row.append(turnBox);
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
    setScale: (v) => { remembered.scale = Math.min(BRUSH_SCALE.max, Math.max(BRUSH_SCALE.min, Math.round(v * 10) / 10)); draw(); },
    // Turns the brush a step either way (from upright when it was random).
    turnBy: (dir) => { remembered.turn = (((remembered.turn ?? 0) + dir * BRUSH_TURN_STEP) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2); draw(); } };
  draw();
  (document.getElementById('board')?.parentElement ?? document.body).append(bar);
  return api;
}
