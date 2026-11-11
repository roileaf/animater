// The Map painting bar (the Map painting tool in Animater's controls): along the bottom of the map while the brush is out.
// Two tabs: Floors (a swatch per floor, Smart edges) and Decorations (the place, a picture per kind, density), each with its
// rarer choices under More. It only holds the choices; main.mjs paints with them. Kept between uses on this screen.

import { DECOR_IDS, DECOR_KINDS } from '../engines/motion/decor-paint.mjs';
import { DECOR_DEFAULT_KINDS } from '../engines/motion/decor-regions.mjs';
import { decorPropRows } from './decor-prop-options.mjs';
import { AREA_FLOORS, floorColour, floorName } from '../engines/regions/floor-detect.mjs';

export const BRUSH_SIZE = Object.freeze({ min: 0.5, max: 6, usual: 1.5 });
export const BRUSH_THICK = Object.freeze({ min: 0.2, max: 2, usual: 0.8 });
// How big the decorations it lays are, against each kind's usual size.
export const BRUSH_SCALE = Object.freeze({ min: 0.3, max: 3, usual: 1 });
// How tall they stand against their size (their shadows' length), saved on each one laid.
export const BRUSH_TALL = Object.freeze({ min: 0.3, max: 3, usual: 1 });
// Floors: how alike a colour must be to count as the stroke's floor (Smart edges).
export const BRUSH_TOL = Object.freeze({ min: 5, max: 80, usual: 32 });
// Floors: how far a new region's painted texture fades out past its line, in squares (0 a hard edge), as Floor regions' Soft edge.
export const BRUSH_EDGE = Object.freeze({ min: 0, max: 3, usual: 1 });
// Whether a floor can stand over water (a deck, a jetty, a bridge): never water or lava itself.
export const canStandOverWater = (floor) => !!floor && !['water', 'lava', 'cavern'].includes(floor);
const TEXTURE_CHOICES = [['', 'As the scene says'], ['on', 'Paint it'], ['off', "Don't paint it"]];
export const EDGE_CHOICES = Object.freeze([
  ['off', 'Off', 'Fill the whole ring.'],
  ['colour', 'Colour', 'Fill only what matches the colour where the stroke began: water stops at its bank.'],
  ['model', 'Model', 'Fill only inside the outline the smart model sees under the pointer (SAM 2.1, a one-time 456 MB download, run in this browser): a bridge is not the pool under it, a shadowed bank is still grass.'],
]);
// The bar's three places. Town is above ground (it paints and looks as outdoors does) with the built things a town has, and the
// little that grows or lies about in its streets; outdoors keeps to the wild, underground to caves and dungeons.
const TOWN = ['lampPost', 'well', 'haystack', 'fence', 'sacks', 'cobbles', 'tombstone', 'coffin', 'brazier', 'marketStall', 'tableStools', 'bench', 'trough', 'planter', 'washtub', 'produce', 'anvil', 'crate', 'barrel', 'campfire', 'pickaxe', 'papers', 'puddle', 'pebbles', 'rubble', 'grass', 'flowers', 'leaves', 'moss'];
// Kept out of the wild: the town's built things, and a dungeon's (a tomb, a hoard, a cage).
const BUILT = new Set(['bed', 'rug', 'bookshelf', 'strongbox', 'hearth', 'desk', 'throne', 'altar', 'statue', 'pottedPlant', 'bathtub', 'counter', 'brokenFurniture', 'lilyPads', 'cattails', 'streamRock', 'steppingStones', 'rowboat', 'dock', 'mooringPost', 'waterDebris', 'marketStall', 'tableStools', 'bench', 'trough', 'planter', 'washtub', 'produce', 'anvil', 'urns', 'lampPost', 'well', 'haystack', 'fence', 'sacks', 'cobbles', 'tombstone', 'brazier', 'papers', 'sarcophagus', 'coffin', 'treasure', 'cage']);
// Indoors: a room's furnishings and its clutter; Water: what floats, stands or is moored in a pond, a river or a harbour.
const INDOOR = ["bed","rug","bookshelf","strongbox","hearth","desk","throne","altar","statue","pottedPlant","bathtub","counter","brokenFurniture","crate","barrel","sacks","papers","candles","chains","tableStools","bench","washtub","urns","anvil","cage"];
const WATER = ["lilyPads","cattails","streamRock","steppingStones","rowboat","dock","mooringPost","waterDebris","reeds","puddle","log","rock","boulder","pebbles","moss"];
export const BRUSH_PLACES = Object.freeze([['surface', 'Outdoors'], ['town', 'Town'], ['indoor', 'Indoors'], ['water', 'Waterside'], ['cave', 'Underground']]);
const placeWhere = (place) => (place === 'cave' ? 'cave' : 'surface');
const remembered = { where: 'surface', kinds: { surface: [DECOR_DEFAULT_KINDS.surface[0]], town: ['well'], indoor: ['bed'], water: ['lilyPads'], cave: [DECOR_DEFAULT_KINDS.cave[0]] }, size: BRUSH_SIZE.usual, thick: BRUSH_THICK.usual, scale: BRUSH_SCALE.usual, tall: BRUSH_TALL.usual, turn: null, lock: null, props: {}, tab: 'floors', floor: 'grass', edges: 'colour', edgesChosen: false, tol: BRUSH_TOL.usual, edge: BRUSH_EDGE.usual, texture: '', overWater: false, more: false };
/** How what the brush lays of a kind breaks (pure): the choices picked for that kind, only those offered for it and not Automatic,
 *  as saved on each brushed entry (`prop`); Burst only with Black powder. Remembered per kind. */
export const brushPropFor = (kind) => Object.fromEntries(decorPropRows(kind, remembered.props[kind] ?? {}).filter((r) => r.value !== '' && (r.key !== 'burst' || remembered.props[kind]?.burst !== undefined)).map((r) => [r.key, r.value]));
/** Sets one breaking choice for a kind ('' for Automatic). */
export const setBrushProp = (kind, key, value) => { const now = { ...(remembered.props[kind] ?? {}) }; if (value === '' || value === undefined) delete now[key]; else now[key] = value; remembered.props[kind] = now; };
// How the decorations it lays are turned: null for every one its own way, else an angle in radians (Shift+wheel, 15° a step).
export const BRUSH_TURN_STEP = Math.PI / 12;

/** The brush's choices now (pure copy): where, the one kind picked there (as a list of one), size in squares, thickness, decoration scale.
 *  While a region's own brush is out, where is the region's and the kind one of its own. */
export const brushChoices = () => { const kinds = remembered.lock ? [remembered.lock.pick] : [...remembered.kinds[remembered.where]]; return { where: remembered.lock?.where ?? placeWhere(remembered.where), place: remembered.lock ? null : remembered.where, kinds, size: remembered.size, thick: remembered.thick, scale: remembered.scale, tall: remembered.tall, turn: remembered.turn, prop: brushPropFor(kinds[0]), tab: remembered.lock ? 'decor' : remembered.tab, floor: remembered.floor, smart: remembered.edges !== 'off', edges: remembered.edges, edgesChosen: remembered.edgesChosen, tol: remembered.tol, edge: remembered.edge, texture: remembered.texture, overWater: remembered.overWater && canStandOverWater(remembered.floor) }; };
/** The kinds a place offers in the bar (pure): 'town' its built things and street litter; 'surface' (outdoors) and 'cave' their
 *  own and those found in both, outdoors leaving built things to the town and the dungeon. */
export const brushKindsFor = (where) => (where === 'town' ? TOWN.filter((id) => DECOR_KINDS[id]) : where === 'indoor' ? INDOOR.filter((id) => DECOR_KINDS[id]) : where === 'water' ? WATER.filter((id) => DECOR_KINDS[id]) : DECOR_IDS.filter((id) => (DECOR_KINDS[id].set === 'both' || DECOR_KINDS[id].set === where) && !(where === 'surface' && BUILT.has(id))));
/** Whether a kind answers a search (pure): what was typed found in its name, its id, or what sort of thing it is, any case
 *  ("tree" finds Oaks and Pines as well as Fruit trees; "water", "glow" and "cave" their own). */
export const kindMatches = (id, query) => {
  const q = String(query ?? '').trim().toLowerCase(); if (!q) return true;
  const k = DECOR_KINDS[id] ?? {}, words = [k.label ?? '', id, k.tree ? 'tree' : '', k.water ? 'water' : '', k.glow ? 'glow' : '', k.set === 'cave' ? 'cave underground' : ''].join(' ').toLowerCase();
  return words.includes(q);
};

/** Opens the Map painting bar; `onClose` when it is closed with its × or Esc. `onChange` whenever a choice changes, `onTab`
 *  when the tab does, `onUndo` / `onRedo` for its two buttons, `onReadMap` for the Floors tab's "Read the whole map…" (left out
 *  when not given), `thumb(kind)` a small canvas of a decoration kind for its picture (or null). `region` ({ name, where, kinds })
 *  for a region's own brush: its place only, and only its ticked kinds to pick from.
 *  Returns { close, setSize, setThick, setScale, setTol, turnBy, setTab, setStatus(text, { undo, redo }), element }. */
export function openBrushBar({ onClose = () => {}, onChange = () => {}, onTab = () => {}, onUndo = () => {}, onRedo = () => {}, onReadMap = null, thumb = () => null, region = null } = {}) {
  document.getElementById('an-decor-brush')?.remove();
  if (region) { const kinds = region.kinds?.length ? region.kinds : brushKindsFor(region.where), had = remembered.kinds[region.where]?.[0]; remembered.lock = { where: region.where, kinds, name: region.name, pick: kinds.includes(had) ? had : kinds[0] }; remembered.tab = 'decor'; }
  else remembered.lock = null;
  const lock = remembered.lock;
  const bar = document.createElement('div'); bar.id = 'an-decor-brush'; bar.className = 'an-decor-brush an-map-paint';
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
  let query = '', status = { text: '', undo: false, redo: false };
  const draw = () => {
    // (Drawn afresh on every change; the search keeps its text, and its focus while typing in it.)
    const typing = document.activeElement?.classList?.contains('an-db-search') && bar.contains(document.activeElement);
    bar.replaceChildren();
    const floors = remembered.tab === 'floors' && !lock;
    // The header: the two tabs, what is on the map, undo and redo, and close.
    const head = el('div', 'an-db-head an-mp-head');
    for (const [key, icon, label] of [['floors', 'fa-solid fa-layer-group', 'Floors'], ['decor', 'fa-solid fa-tree', 'Decorations']]) {
      if (lock && key === 'floors') continue;
      const t = el('button', remembered.tab === key ? 'an-mp-tab is-on' : 'an-mp-tab'); t.type = 'button'; t.setAttribute('aria-pressed', String(remembered.tab === key)); t.dataset.tab = key;
      t.innerHTML = `<i class="${icon}"></i>`; t.append(el('span', '', lock && key === 'decor' ? `Decorations: ${lock.name || 'region'}` : label));
      t.title = `${label} (${key === 'floors' ? 1 : 2})`; t.addEventListener('click', () => api.setTab(key)); head.append(t);
    }
    head.append(el('span', 'an-mp-status', status.text));
    const iconBtn = (icon, title, on, fn) => { const b = el('button', 'an-mp-icon'); b.type = 'button'; b.title = title; b.setAttribute('aria-label', title); b.innerHTML = `<i class="${icon}"></i>`; b.disabled = !on; b.addEventListener('click', fn); return b; };
    head.append(iconBtn('fa-solid fa-rotate-left', 'Undo (Ctrl+Z)', status.undo, () => onUndo()), iconBtn('fa-solid fa-rotate-right', 'Redo (Ctrl+Shift+Z)', status.redo, () => onRedo()));
    const close = el('button', 'an-db-close an-mp-icon'); close.type = 'button'; close.setAttribute('aria-label', 'Close'); close.title = 'Close (Esc)'; close.innerHTML = '<i class="fa-solid fa-xmark"></i>'; close.addEventListener('click', () => { api.close(); onClose(); }); head.append(close);
    const body = el('div', 'an-mp-body');
    const slider = (label, bounds, key, step, unit = '') => { const box = el('label', 'an-db-range'), s = el('input'), shown = el('b', '', `${remembered[key]}${unit}`); s.type = 'range'; s.min = String(bounds.min); s.max = String(bounds.max); s.step = String(step); s.value = String(remembered[key]); s.addEventListener('input', () => { remembered[key] = Number(s.value); shown.textContent = `${s.value}${unit}`; onChange(); });
      // The wheel over a slider moves it a step.
      s.addEventListener('wheel', (e) => { e.preventDefault(); const v = Math.min(bounds.max, Math.max(bounds.min, Number(s.value) + (e.deltaY < 0 ? step : -step))); s.value = String(Math.round(v * 100) / 100); s.dispatchEvent(new Event('input')); }, { passive: false });
      box.append(el('span', '', label), s, shown); return box; };
    const choice = (label, options, value, save) => { const box = el('label', 'an-db-prop'), input = el('select'); for (const [v, l] of options) { const o = el('option', '', l); o.value = v; o.selected = v === value; input.append(o); } input.addEventListener('change', () => { save(input.value); draw(); onChange(); }); box.append(el('span', '', label), input); return box; };
    const tick = (label, key, tip) => { const box = el('label', 'an-mp-tick'), input = el('input'); input.type = 'checkbox'; input.checked = remembered[key] === true; input.addEventListener('change', () => { remembered[key] = input.checked; onChange(); }); box.title = tip; box.append(input, el('span', '', label)); return box; };
    const grid = el('div', 'an-db-chips an-mp-grid');
    const row = el('div', 'an-db-row an-mp-row'), extra = el('div', 'an-db-row an-db-props an-mp-extra');
    if (floors) {
      // Floors: a swatch each; the brush and Smart edges; the rest under More.
      for (const id of AREA_FLOORS) {
        const on = remembered.floor === id, t = el('button', on ? 'an-mp-tile an-db-on' : 'an-mp-tile'); t.type = 'button'; t.setAttribute('aria-pressed', String(on)); t.dataset.floor = id;
        const sw = el('span', 'an-mp-swatch'); sw.style.background = floorColour(id); t.append(sw, el('span', '', floorName(id)));
        t.addEventListener('click', () => { remembered.floor = id; if (!canStandOverWater(id)) remembered.overWater = false; draw(); onChange(); }); grid.append(t);
      }
      // Edges: where a dab stops. Colour: what matches the colour where the stroke began. Model: the outline the segmentation
      // model sees under the pointer (a bridge is not the pool under it). Off: the whole ring.
      const edges = el('div', 'an-db-seg an-mp-edges'); edges.append(el('span', '', 'Edges'));
      for (const [key, label, tip] of EDGE_CHOICES) { const b = el('button', remembered.edges === key ? 'an-db-on' : '', label); b.type = 'button'; b.dataset.edges = key; b.title = tip; b.setAttribute('aria-pressed', String(remembered.edges === key)); b.addEventListener('click', () => { remembered.edges = key; remembered.edgesChosen = true; draw(); onChange(); }); edges.append(b); }
      row.append(slider('Brush', BRUSH_SIZE, 'size', 0.5, ' sq'), edges);
      extra.append(slider('How alike', BRUSH_TOL, 'tol', 1), choice('Texture', TEXTURE_CHOICES, remembered.texture, (v) => { remembered.texture = v; }));
      const soft = slider('Soft edge', BRUSH_EDGE, 'edge', 0.1, ' sq'); soft.title = "How far a new region's painted texture fades out past its line, in squares. 0 is a hard edge."; extra.append(soft);
      if (canStandOverWater(remembered.floor)) extra.append(tick('Over water', 'overWater', 'A deck, a jetty or a bridge: standing over the water below.'));
      if (onReadMap) { const read = el('button', 'an-mp-link', 'Read the whole map…'); read.type = 'button'; read.title = 'Open Floor regions to read the whole map at once'; read.addEventListener('click', () => onReadMap()); extra.append(read); }
    } else {
      // Decorations: the place and a search over its kinds, a picture each; the brush and density; the rest under More.
      const where = el('select', 'an-mp-place'); where.setAttribute('aria-label', 'Place');
      for (const [key, label] of BRUSH_PLACES) { const o = el('option', '', label); o.value = key; o.selected = remembered.where === key; where.append(o); }
      where.addEventListener('change', () => { remembered.where = where.value; draw(); onChange(); });
      const search = el('input', 'an-db-search'); search.type = 'search'; search.placeholder = 'Search kinds…'; search.value = query; search.setAttribute('aria-label', 'Search kinds');
      const pickRow = el('div', 'an-mp-pickhead');
      if (!lock) pickRow.append(where);
      pickRow.append(search); body.append(pickRow);
      const chips = grid, ticked = brushChoices().kinds;
      const pick = (id) => { if (lock) lock.pick = id; else remembered.kinds[remembered.where] = [id]; draw(); onChange(); };
      for (const id of lock ? lock.kinds : brushKindsFor(remembered.where)) {
        const on = ticked.includes(id), c = el('button', on ? 'an-db-chip an-mp-tile an-db-on' : 'an-db-chip an-mp-tile'); c.type = 'button'; c.setAttribute('aria-pressed', String(on)); c.dataset.kind = id; c.title = DECOR_KINDS[id].label;
        const pic = thumb(id); if (pic) { const img = el('canvas', 'an-mp-pic'); img.width = 48; img.height = 40; try { const g = img.getContext('2d'); const s = Math.min(48 / pic.width, 40 / pic.height); g.drawImage(pic, (48 - pic.width * s) / 2, (40 - pic.height * s) / 2, pic.width * s, pic.height * s); } catch { /* no picture */ } c.append(img); }
        c.append(el('span', '', DECOR_KINDS[id].label));
        // One kind at a time: picking one puts out the other.
        c.addEventListener('click', () => pick(id));
        chips.append(c);
      }
      // A search over the kinds: typing hides the tiles that don't match; Enter picks the first one left, Esc clears it.
      const filter = () => { const q = query.trim().toLowerCase(); for (const c of chips.children) c.hidden = !!q && !kindMatches(c.dataset.kind, q); };
      search.addEventListener('input', () => { query = search.value; filter(); });
      search.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); const first = [...chips.children].find((c) => !c.hidden); if (first) pick(first.dataset.kind); } else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); query = ''; search.value = ''; filter(); } });
      filter();
      row.append(slider('Brush', BRUSH_SIZE, 'size', 0.5, ' sq'), slider('Density', BRUSH_THICK, 'thick', 0.1));
      extra.append(slider('Decoration size', BRUSH_SCALE, 'scale', 0.1), slider('Decoration height', BRUSH_TALL, 'tall', 0.1));
      // Rotation: shown in degrees once turned; Random sets every decoration its own way again.
      const turnBox = el('div', 'an-db-range an-db-turn'), deg = remembered.turn === null ? null : Math.round(((remembered.turn * 180) / Math.PI % 360 + 360) % 360);
      const rot = el('button', remembered.turn === null ? 'an-db-on' : '', 'Random'); rot.type = 'button'; rot.addEventListener('click', () => { remembered.turn = null; draw(); onChange(); });
      const turnLeft = el('button', '', '⟲'), turnRight = el('button', '', '⟳'); for (const [b, dir] of [[turnLeft, -1], [turnRight, 1]]) { b.type = 'button'; b.addEventListener('click', () => { api.turnBy(dir); onChange(); }); }
      turnBox.append(el('span', '', 'Rotation'), turnLeft, el('span', 'an-db-deg', deg === null ? '—' : `${deg}°`), turnRight, rot); extra.append(turnBox);
      // How the kind picked breaks (when it can): the tile's Breakable prop options that apply to it, saved on each one it lays.
      const kind = brushChoices().kinds[0];
      for (const r of decorPropRows(kind, remembered.props[kind] ?? {})) {
        const box = el('label', 'an-db-prop'); box.title = r.hint;
        let input;
        if (r.type === 'select') { input = el('select'); for (const [v, l] of r.options) { const o = el('option', '', l); o.value = v; o.selected = v === r.value; input.append(o); } }
        else { input = el('input'); input.type = 'number'; input.min = String(r.min); input.max = String(r.max); input.step = '1'; input.value = String(r.value); }
        input.addEventListener('change', () => { setBrushProp(kind, r.key, r.type === 'number' ? Math.min(r.max, Math.max(r.min, Math.round(Number(input.value) || r.value))) : input.value); draw(); onChange(); });
        box.append(el('span', '', r.label), input); extra.append(box);
      }
    }
    // More: the choices most strokes don't need.
    const more = el('button', 'an-mp-more', remembered.more ? 'Less ▴' : 'More ▾'); more.type = 'button'; more.setAttribute('aria-expanded', String(!!remembered.more));
    more.addEventListener('click', () => { remembered.more = !remembered.more; draw(); });
    row.append(more); extra.hidden = !remembered.more;
    body.append(grid, row, extra);
    const keys = el('div', 'an-db-hint an-mp-keys', 'Drag to paint · Shift-drag rubs out · Ctrl+wheel: brush size · 1 / 2: tabs · Saved as you paint');
    keys.title = floors ? 'Ctrl+wheel: size · Alt+wheel: how alike · Ctrl+Z undo · Ctrl+Shift+Z redo · Esc stops' : 'Ctrl+wheel: size · Shift+wheel: rotate · Ctrl+Shift+wheel: density · Alt+wheel: decoration size · Ctrl+Z undo · Esc stops';
    bar.append(head, body, keys);
    if (typing) { const s = bar.querySelector('.an-db-search'); s?.focus(); s?.setSelectionRange(s.value.length, s.value.length); }
  };
  const api = { element: bar, close: () => { bar.remove(); if (remembered.lock === lock) remembered.lock = null; },
    setSize: (v) => { remembered.size = Math.min(BRUSH_SIZE.max, Math.max(BRUSH_SIZE.min, Math.round(v * 2) / 2)); draw(); },
    setThick: (v) => { remembered.thick = Math.min(BRUSH_THICK.max, Math.max(BRUSH_THICK.min, Math.round(v * 10) / 10)); draw(); },
    setScale: (v) => { remembered.scale = Math.min(BRUSH_SCALE.max, Math.max(BRUSH_SCALE.min, Math.round(v * 10) / 10)); draw(); },
    setEdges: (v) => { remembered.edges = EDGE_CHOICES.some(([k]) => k === v) ? v : 'colour'; draw(); },
    setTol: (v) => { remembered.tol = Math.min(BRUSH_TOL.max, Math.max(BRUSH_TOL.min, Math.round(v))); draw(); },
    // Turns the brush a step either way (from upright when it was random).
    turnBy: (dir) => { remembered.turn = (((remembered.turn ?? 0) + dir * BRUSH_TURN_STEP) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2); draw(); },
    setTab: (tab) => { const next = tab === 'floors' && !lock ? 'floors' : 'decor'; if (next === remembered.tab) return; remembered.tab = next; draw(); onTab(next); onChange(); },
    setStatus: (text, { undo = false, redo = false } = {}) => { status = { text: String(text ?? ''), undo, redo }; draw(); } };
  draw();
  (document.getElementById('board')?.parentElement ?? document.body).append(bar);
  return api;
}
