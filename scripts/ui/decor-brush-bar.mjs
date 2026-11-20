// The Map painting bar (the Map painting tool in Animater's controls): along the bottom of the map while the brush is out.
// Three tabs: Floors (a swatch per floor, Smart edges), Decorations (the place, a picture per kind, density) and Heights
// (raise what is under a click, or drag a ramp: engines/regions/heights.mjs), each with its rarer choices under More. It only holds the choices; main.mjs paints with them. Kept between uses on this screen.

import { DECOR_IDS, DECOR_KINDS } from '../engines/motion/decor-paint.mjs';
import { DECOR_DEFAULT_KINDS } from '../engines/motion/decor-regions.mjs';
import { decorPropRows } from './decor-prop-options.mjs';
import { AREA_FLOORS, floorColour, floorName, caveColour } from '../engines/regions/floor-detect.mjs';
import { CAVE_AMOUNT, CAVE_CHOICES, caveMenu, WATER_KINDS, TEXTURE_STYLES } from '../engines/motion/region-steps.mjs';
import { CROSSING_KINDS } from '../engines/regions/heights.mjs';
import { WALL_MATERIAL_CHOICES, WALL_THICK, paintRun } from '../engines/motion/wall-paint.mjs';
import { paintDoorLeaf } from '../engines/motion/door-paint.mjs';
import { paintWindowPane } from '../engines/motion/window-paint.mjs';
import { DOOR_CHOICES } from '../engines/motion/door-paint.mjs';
import { WINDOW_CHOICES } from '../engines/motion/window-paint.mjs';
import { ROOF_CHOICES, ROOF_FORM_CHOICES, roofShape, paintRoof } from '../engines/motion/roof-paint.mjs';
import { DRESSING_COLOURS_MOST as HOLIDAY_COLOURS, DRESSING_PLAIN as HOLIDAY_PLAIN } from '../engines/motion/holiday-dressing.mjs';
import { floorTilePixels } from '../engines/motion/floor-looks.mjs';
import { DRESSING_CHOICES } from '../engines/motion/dressing-paint.mjs';

/** How thick a drawn wall is, in squares, and how many years are on it. */
export const WALL_WIDTH = Object.freeze({ min: 0.08, max: 0.4, usual: WALL_THICK, step: 0.01 });
export const WALL_AGE = Object.freeze({ min: 0, max: 1, usual: 0, step: 0.05 });
/** How wide a doorway is cut, in squares: a cupboard door up to a pair of gates. */
export const DOOR_WIDE = Object.freeze({ min: 0.5, max: 3, usual: 1, step: 0.25 });
/** What a drag on the Structures tab does: lay stone, cut a doorway, set a window in, or rub out. */
const WALL_MODES = Object.freeze([['draw', 'Draw'], ['round', 'Round room'], ['door', 'Doorway'], ['window', 'Window'], ['roof', 'Roof'], ['move', 'Move building'], ['erase', 'Erase']]);
// What the wheel moves on the Structures tab, where there is no brush to size: the number the mode is mostly about, and
// the one behind it. A doorway is mostly how wide it is, a wall how thick, a roof how long it has stood.
const WALL_WHEEL = Object.freeze({
  draw: { main: ['wallWidth', WALL_WIDTH], second: ['wallAge', WALL_AGE] },
  round: { main: ['wallWidth', WALL_WIDTH], second: ['wallAge', WALL_AGE] },
  door: { main: ['doorWide', DOOR_WIDE] },
  window: { main: ['doorWide', DOOR_WIDE] },
  roof: { main: ['roofAge', WALL_AGE] },
});

// The swatches are painted by the painters themselves, so a GM picks a wall by looking at the wall rather than at a
// rectangle of its colour (Roi: "lets show actual walls designs and floor designs instead of just colored
// rectangles"). Each is drawn once and kept.
const SWATCH = Object.freeze({ w: 54, h: 34, unit: 90 });
const swatches = new Map();
// Plain pixels, with no device scaling in them: the painters draw in their own units, and what they draw is then
// fitted into the swatch as a whole. (Handing them a device-scaled canvas left the art in one corner, cut off.)
const plainCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };
/** The whole of a painted picture, scaled to fit the swatch and centred in it. */
const fitted = (g, src, w, h) => {
  const k = Math.min(w / src.width, h / src.height);
  g.drawImage(src, 0, 0, src.width, src.height, (w - src.width * k) / 2, (h - src.height * k) / 2, src.width * k, src.height * k);
};
const swatchOf = (key, paint) => {
  if (swatches.has(key)) return swatches.get(key);
  let url = null;
  try {
    const dpr = Math.min(3, Math.max(1, devicePixelRatio || 1));
    const c = plainCanvas(SWATCH.w * dpr, SWATCH.h * dpr), g = c.getContext('2d');
    g.scale(dpr, dpr);
    paint(g, SWATCH.w, SWATCH.h);
    url = c.toDataURL();
  } catch { url = null; }
  swatches.set(key, url);
  return url;
};
/** A short stretch of the wall itself, running right across the swatch so it reads as a wall. */
const wallSwatch = (material) => swatchOf(`wall:${material}`, (g, w, h) => {
  paintRun(g, [[-8, h / 2], [w + 8, h / 2]], material, { unit: SWATCH.unit, ink: 0.9, seed: material.length * 7 + 3, snow: 0, moss: 0, soot: 0, ruin: 0, join: [true, true] });
});
/** The leaf, lying along the swatch as it does when the door is shut. */
const doorSwatch = (kind) => swatchOf(`door:${kind}`, (g, w, h) => {
  const leaf = paintDoorLeaf(kind, SWATCH.unit * 0.9, { grid: SWATCH.unit, seed: kind.length + 2 }, plainCanvas);
  if (leaf) fitted(g, leaf.canvas, w, h);
});
/** A small roof, seen as it will be on the map. */
const roofSwatch = (kind) => swatchOf(`roof:${kind}`, (g, w, h) => {
  const pad = 3;
  paintRoof(g, kind, roofShape('gable', pad, pad, w - pad * 2, h - pad * 2, 0), { unit: SWATCH.unit * 0.55, ink: 0.7, seed: kind.length + 9, snow: 0, moss: 0.2, soot: 0, wet: 0, leaves: 0 });
});
/** The pane, set across the swatch as it is in its opening. */
const windowSwatch = (kind) => swatchOf(`window:${kind}`, (g, w, h) => {
  const pane = paintWindowPane(kind, SWATCH.unit * 0.9, { grid: SWATCH.unit, seed: kind.length + 5 }, plainCanvas);
  if (pane) fitted(g, pane.canvas, w, h);
});
/** Puts a painted swatch on a tile, falling back to its colour if the picture could not be drawn. */
const showSwatch = (sw, url, colour) => {
  if (url) { sw.style.backgroundImage = `url(${url})`; sw.style.backgroundSize = 'cover'; sw.style.backgroundPosition = 'center'; }
  else sw.style.background = colour;
};

// A floor is not painted on a canvas like a wall or a door: it is a shader the map runs. So its swatch is baked by
// running that same shader small and reading the pixels back — the floor itself, not a drawing of it (Roi: "floors
// still show colors instead of [swatches]"). The shader is compiled over the frames after it is first asked for,
// so a tile shows its colour to begin with and is filled in as soon as the floor is ready.
const FLOOR_SWATCH_SIDE = 128;
const floorSwatches = new Map(); // floor -> url, or null while it is being compiled
const floorTileUrl = (floor) => {
  if (floorSwatches.has(floor)) return floorSwatches.get(floor);
  let url = null;
  try {
    const data = floorTilePixels(globalThis.PIXI, globalThis.canvas?.app?.renderer, floor, '', FLOOR_SWATCH_SIDE);
    if (data) {
      const c = plainCanvas(FLOOR_SWATCH_SIDE, FLOOR_SWATCH_SIDE), g = c.getContext('2d');
      const pic = g.createImageData(FLOOR_SWATCH_SIDE, FLOOR_SWATCH_SIDE);
      pic.data.set(data);
      g.putImageData(pic, 0, 0);
      url = c.toDataURL('image/png');
      floorSwatches.set(floor, url);
    }
  } catch { url = null; }
  return url;
};
/** Fill a floor tile in once its shader is ready, trying a few frames before giving the colour the last word. */
const floorSwatchSoon = (sw, floor, colour, tries = 24) => {
  const url = floorTileUrl(floor);
  if (url) { showSwatch(sw, url, colour); return; }
  if (tries <= 0) return;
  globalThis.requestAnimationFrame?.(() => { if (sw.isConnected) floorSwatchSoon(sw, floor, colour, tries - 1); });
};

// How wide the brush lays, in squares. A quarter of a square is the smallest worth offering: the map is read back for
// painting at 1024 pixels on its long side, so on a 4000-pixel map a quarter-square dab is about three of those pixels
// across and a tenth-square one barely a single pixel — a size that would promise an edge finer than the brush can see.
// (Asked for, for the awkward places where two zones meet.)
export const BRUSH_SIZE = Object.freeze({ min: 0.25, max: 6, usual: 1.5, step: 0.25 });
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
// The Floors tab's tiles: every floor, then Cave, which paints cave growth (glowing fungus, crystals, mist...) over whatever
// floor is there, as the region panel's Cave kind: its own regions, kept apart from the floors'.
export const BRUSH_FLOORS = Object.freeze([...AREA_FLOORS, 'cavern']);
// What Cave holds, as the region panel's Cavern section offers it (lava is a floor of its own), and every growth under More.
export const BRUSH_CAVE_KINDS = Object.freeze(CAVE_CHOICES.filter(([key]) => key !== 'lava'));
export const BRUSH_CAVE_MORE = Object.freeze([['fungus', 'Glowing fungus'], ['crystals', 'Crystals'], ['mist', 'Mist on the floor'], ['webs', 'Cobwebs'], ['wet', 'Wet walls'], ['steam', 'Steam vents'], ['foul', 'Bad air']]);
const tileName = (id) => (id === 'cavern' ? 'Cave' : floorName(id));
const tileColour = (id, cave) => (id === 'cavern' ? caveColour(cave) : floorColour(id));
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
const remembered = { where: 'surface', kinds: { surface: [DECOR_DEFAULT_KINDS.surface[0]], town: ['well'], indoor: ['bed'], water: ['lilyPads'], cave: [DECOR_DEFAULT_KINDS.cave[0]] }, size: BRUSH_SIZE.usual, thick: BRUSH_THICK.usual, scale: BRUSH_SCALE.usual, tall: BRUSH_TALL.usual, turn: null, lock: null, props: {}, tab: 'floors', floor: 'grass', edges: 'colour', edgesChosen: false, tol: BRUSH_TOL.usual, edge: BRUSH_EDGE.usual, texture: '', overWater: false, more: false, cave: 'fungus-green', caveTones: { fungus: 'green', crystals: 'amethyst' }, caveStep: null, caveSize: 1, caveAmount: 1, waterKind: 'still', styles: {}, heightMode: 'raise', crossKind: 'ramp', wallMaterial: WALL_MATERIAL_CHOICES[0].id, wallWidth: WALL_WIDTH.usual, wallAge: WALL_AGE.usual, wallMode: 'draw', wallCurve: false, doorKind: '', doorFlip: false, doorWide: DOOR_WIDE.usual, windowKind: '', windowWalk: false, swing: 'in', roofKind: '', roofForm: '', roofAge: 0, roofChimney: '', roofDressed: false, wallTint: '', roofTint: '', dressingKind: 'garlands' };
/** How what the brush lays of a kind breaks (pure): the choices picked for that kind, only those offered for it and not Automatic,
 *  as saved on each brushed entry (`prop`); Burst only with Black powder. Remembered per kind. */
export const brushPropFor = (kind) => Object.fromEntries(decorPropRows(kind, remembered.props[kind] ?? {}).filter((r) => r.value !== '' && (r.key !== 'burst' || remembered.props[kind]?.burst !== undefined)).map((r) => [r.key, r.value]));
/** Sets one breaking choice for a kind ('' for Automatic). */
export const setBrushProp = (kind, key, value) => { const now = { ...(remembered.props[kind] ?? {}) }; if (value === '' || value === undefined) delete now[key]; else now[key] = value; remembered.props[kind] = now; };
// How the decorations it lays are turned: null for every one its own way, else an angle in radians (Shift+wheel, 15° a step).
export const BRUSH_TURN_STEP = Math.PI / 12;

/** The brush's choices now (pure copy): where, the one kind picked there (as a list of one), size in squares, thickness, decoration scale.
 *  While a region's own brush is out, where is the region's and the kind one of its own. */
export const brushChoices = () => { const kinds = remembered.lock ? [remembered.lock.pick] : [...remembered.kinds[remembered.where]]; return { where: remembered.lock?.where ?? placeWhere(remembered.where), place: remembered.lock ? null : remembered.where, kinds, size: remembered.size, thick: remembered.thick, scale: remembered.scale, tall: remembered.tall, turn: remembered.turn, prop: brushPropFor(kinds[0]), tab: remembered.lock ? 'decor' : remembered.tab, floor: remembered.floor, smart: remembered.edges !== 'off', edges: remembered.edges, edgesChosen: remembered.edgesChosen, tol: remembered.tol, edge: remembered.edge, texture: remembered.texture, overWater: remembered.overWater && canStandOverWater(remembered.floor), heightMode: remembered.heightMode, crossKind: remembered.crossKind, cave: remembered.floor === 'cavern' ? caveChoice() : null, waterKind: remembered.waterKind, pattern: remembered.styles[remembered.floor] ?? '',
  wallMaterial: remembered.wallMaterial, wallWidth: remembered.wallWidth, wallAge: remembered.wallAge, wallMode: remembered.wallMode, wallCurve: remembered.wallCurve === true, doorKind: remembered.doorKind || null, doorFlip: remembered.doorFlip === true, doorWide: remembered.doorWide, windowKind: remembered.windowKind || null, windowWalk: remembered.windowWalk === true, swing: remembered.swing === 'out' ? 'out' : 'in',
  roofKind: remembered.roofKind || null, roofForm: remembered.roofForm || null, roofAge: remembered.roofAge, roofChimney: remembered.roofChimney || null, roofDressed: remembered.roofDressed === true,
  wallTint: remembered.wallTint || null, roofTint: remembered.roofTint || null, dressingKind: remembered.dressingKind || 'garlands' }; };
// What Cave lays (pure copy): the growth as its `cavern` word, and its stage, size and how many as the region panel saves
// them (null while at their usual: the last stage, 100%).
const caveMenuNow = () => caveMenu({ cavern: remembered.cave, caveStep: remembered.caveStep, caveSize: remembered.caveSize, caveAmount: remembered.caveAmount }, 'cavern');
const caveChoice = () => { const menu = caveMenuNow();
  return { cavern: remembered.cave, caveStep: menu?.steps && remembered.caveStep !== null ? menu.step : null, caveSize: menu?.steps && remembered.caveSize !== 1 ? menu.size : null, caveAmount: menu?.steps && remembered.caveAmount !== 1 ? menu.amount : null }; };
/** Picks what Cave holds: a kind (fungus, crystals: in the colour last picked for it) or a whole word ("webs", "fungus-blue"). */
export const setBrushCave = (value) => {
  const [kind, tone] = String(value ?? '').split('-'); if (!kind || kind === 'lava') return;
  const tones = caveMenu({ cavern: kind }, 'cavern')?.tones, was = remembered.cave.split('-')[0];
  if (tone && tones?.some(([t]) => t === tone)) remembered.caveTones[kind] = tone;
  remembered.cave = tones ? `${kind}-${remembered.caveTones[kind] ?? tones[0][0]}` : kind;
  if (kind !== was) { remembered.caveStep = null; const range = caveMenu({ cavern: remembered.cave }, 'cavern')?.sizeRange; if (range) remembered.caveSize = Math.min(range.max, remembered.caveSize); }
};
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

// Heights: what the pointer does. Raise: a brush, as Floors' is, painting raised ground (the wheel over it sets its height).
// Ramp: a drag up across a raised edge lays a ramp.
export const HEIGHT_MODES = Object.freeze([['raise', 'Raise', 'Paint raised ground with the brush (Edges keeps it to what is under the pointer): a stroke on a raised part grows it, on lower ground raises it a step. The wheel over a raised part raises or lowers it; Shift-drag rubs it out.'], ['ramp', 'Crossing', 'Drag a way between heights: a ramp, ladder or rope up across a raised edge, or a bridge from one raised part to another. Shift-click removes one.']]);
const TAB_KEYS = { floors: 1, decor: 2, heights: 3, walls: 4 };

/** Opens the Map painting bar; `onClose` when it is closed with its × or Esc. `onChange` whenever a choice changes, `onTab`
 *  when the tab does, `onUndo` / `onRedo` for its two buttons, `onReadMap` for the Floors tab's "Read the whole map…" (left out
 *  when not given), `sceneTicks` ({ get() → { walls, shadows }, set(key, on) }) the Heights tab's two choices kept on the scene, `thumb(kind)` a small canvas of a decoration kind for its picture (or null). `region` ({ name, where, kinds })
 *  for a region's own brush: its place only, and only its ticked kinds to pick from.
 *  Returns { close, setSize, setThick, setScale, setTol, turnBy, setTab, setStatus(text, { undo, redo }), element }. */
export function openBrushBar({ onClose = () => {}, onChange = () => {}, onTab = () => {}, onUndo = () => {}, onRedo = () => {}, onReadMap = null, thumb = () => null, region = null, sceneTicks = null, sceneHoliday = null } = {}) {
  document.getElementById('an-decor-brush')?.remove();
  if (region) { const kinds = region.kinds?.length ? region.kinds : brushKindsFor(region.where), had = remembered.kinds[region.where]?.[0]; remembered.lock = { where: region.where, kinds, name: region.name, pick: kinds.includes(had) ? had : kinds[0] }; remembered.tab = 'decor'; }
  else remembered.lock = null;
  const lock = remembered.lock;
  const bar = document.createElement('div'); bar.id = 'an-decor-brush'; bar.className = 'an-decor-brush an-map-paint';
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
  let query = '', status = { text: '', undo: false, redo: false };
  // The header's line and its two buttons, kept so a new status can change them where they stand: the whole bar is drawn
  // afresh on every change, and a redraw here would take the slider out from under a pointer dragging it.
  let statusEl = null, undoEl = null, redoEl = null;
  const draw = () => {
    // (Drawn afresh on every change; the search keeps its text, and its focus while typing in it.)
    const typing = document.activeElement?.classList?.contains('an-db-search') && bar.contains(document.activeElement);
    bar.replaceChildren();
    const floors = remembered.tab === 'floors' && !lock, heights = remembered.tab === 'heights' && !lock, walls = remembered.tab === 'walls' && !lock;
    // The header: the tabs, what is on the map, undo and redo, and close.
    const head = el('div', 'an-db-head an-mp-head');
    for (const [key, icon, label] of [['floors', 'fa-solid fa-layer-group', 'Floors'], ['decor', 'fa-solid fa-tree', 'Decorations'], ['walls', 'fa-solid fa-grip-lines', 'Structures'], ['heights', 'fa-solid fa-mountain', 'Heights']]) {
      if (lock && key !== 'decor') continue;
      const t = el('button', remembered.tab === key ? 'an-mp-tab is-on' : 'an-mp-tab'); t.type = 'button'; t.setAttribute('aria-pressed', String(remembered.tab === key)); t.dataset.tab = key;
      t.innerHTML = `<i class="${icon}"></i>`; t.append(el('span', '', lock && key === 'decor' ? `Decorations: ${lock.name || 'region'}` : label));
      t.title = `${label} (${TAB_KEYS[key]})`; t.addEventListener('click', () => api.setTab(key)); head.append(t);
    }
    statusEl = el('span', 'an-mp-status', status.text); head.append(statusEl);
    const iconBtn = (icon, title, on, fn) => { const b = el('button', 'an-mp-icon'); b.type = 'button'; b.title = title; b.setAttribute('aria-label', title); b.innerHTML = `<i class="${icon}"></i>`; b.disabled = !on; b.addEventListener('click', fn); return b; };
    undoEl = iconBtn('fa-solid fa-rotate-left', 'Undo (Ctrl+Z)', status.undo, () => onUndo());
    redoEl = iconBtn('fa-solid fa-rotate-right', 'Redo (Ctrl+Shift+Z)', status.redo, () => onRedo());
    head.append(undoEl, redoEl);
    const close = el('button', 'an-db-close an-mp-icon'); close.type = 'button'; close.setAttribute('aria-label', 'Close'); close.title = 'Close (Esc)'; close.innerHTML = '<i class="fa-solid fa-xmark"></i>'; close.addEventListener('click', () => { api.close(); onClose(); }); head.append(close);
    const body = el('div', walls ? 'an-mp-body an-mp-onwalls' : 'an-mp-body');
    const slider = (label, bounds, key, step, unit = '', fmt = (v) => `${v}${unit}`) => { const box = el('label', 'an-db-range'), s = el('input'), shown = el('b', '', fmt(remembered[key])); s.type = 'range'; s.min = String(bounds.min); s.max = String(bounds.max); s.step = String(step); s.value = String(remembered[key]); s.addEventListener('input', () => { remembered[key] = Number(s.value); shown.textContent = fmt(Number(s.value)); onChange(); });
      // The wheel over a slider moves it a step.
      s.addEventListener('wheel', (e) => { e.preventDefault(); const v = Math.min(bounds.max, Math.max(bounds.min, Number(s.value) + (e.deltaY < 0 ? step : -step))); s.value = String(Math.round(v * 100) / 100); s.dispatchEvent(new Event('input')); }, { passive: false });
      box.append(el('span', '', label), s, shown); return box; };
    const choice = (label, options, value, save) => { const box = el('label', 'an-db-prop'), input = el('select'); for (const [v, l] of options) { const o = el('option', '', l); o.value = v; o.selected = v === value; input.append(o); } input.addEventListener('change', () => { save(input.value); draw(); onChange(); }); box.append(el('span', '', label), input); return box; };
    const tick = (label, key, tip) => { const box = el('label', 'an-mp-tick'), input = el('input'); input.type = 'checkbox'; input.checked = remembered[key] === true; input.addEventListener('change', () => { remembered[key] = input.checked; onChange(); }); box.title = tip; box.append(input, el('span', '', label)); return box; };
    // A colour to paint the stuff in, or None for the colour it comes in. The swatch shows what is chosen; the
    // colour is mixed into the material when it is painted, so it is still stone, still slate, still thatch.
    const tintPick = (label, key, tip) => {
      const box = el('label', 'an-mp-tint'); box.title = tip;
      const input = el('input'); input.type = 'color'; input.value = remembered[key] || '#9a8a68'; input.dataset.tint = key;
      input.addEventListener('input', () => { remembered[key] = input.value; onChange(); });
      const off = el('button', remembered[key] ? '' : 'an-db-on', 'None'); off.type = 'button'; off.dataset.tintOff = key;
      off.setAttribute('aria-pressed', String(!remembered[key]));
      off.addEventListener('click', () => { remembered[key] = ''; draw(); onChange(); });
      box.append(el('span', '', label), input, off);
      return box;
    };
    // A feast the GM calls themselves: no calendar needed, and up to three colours to hang out in. Kept on the
    // scene, not on the bar — it is what day it is for everybody looking at this map, not a brush setting.
    const holidayPick = () => {
      // Read back at every change rather than kept in hand: two pickers changed in a row both have to count, and
      // the second was overwriting the first with what it had been shown when the bar was drawn.
      const said = () => { const now = sceneHoliday.get() ?? {}; const wear = (Array.isArray(now.colours) ? now.colours : []).filter(Boolean).slice(0, HOLIDAY_COLOURS); return { on: now.on === true, colours: wear.length ? wear : [HOLIDAY_PLAIN] }; };
      const now = said();
      const box = el('div', 'an-mp-tint an-mp-holiday');
      box.title = 'Today is a feast day, whatever the calendar says — or with no calendar at all. Buildings set to dress for holidays hang out garlands, lanterns or banners in these colours. Kept on this scene.';
      // Everything else on this bar is a brush setting, kept for whoever is painting. This one is the scene's: it is
      // what day it is for everybody looking at the map, so it says so rather than sitting among them unmarked.
      box.append(el('span', 'an-mp-scene', 'This scene'));
      const tickBox = el('label', 'an-mp-tick'), input = el('input'); input.type = 'checkbox'; input.checked = now.on; input.dataset.holidayOn = 'on';
      input.addEventListener('change', () => { sceneHoliday.set({ ...said(), on: input.checked }); draw(); onChange(); });
      tickBox.append(input, el('span', '', 'Holiday today'));
      box.append(tickBox);
      if (now.on) {
        box.append(el('span', '', 'Colours'));
        for (let n = 1; n <= HOLIDAY_COLOURS; n++) {
          const b = el('button', now.colours.length === n ? 'an-db-on' : '', String(n)); b.type = 'button'; b.dataset.holidayCount = String(n);
          b.setAttribute('aria-pressed', String(now.colours.length === n));
          b.addEventListener('click', () => {
            const wear = said().colours;
            sceneHoliday.set({ on: true, colours: Array.from({ length: n }, (_, k) => wear[k] ?? wear[wear.length - 1] ?? HOLIDAY_PLAIN) });
            draw(); onChange();
          });
          box.append(b);
        }
        for (let i = 0; i < now.colours.length; i++) {
          const pick = el('input'); pick.type = 'color'; pick.value = now.colours[i] || HOLIDAY_PLAIN; pick.dataset.holidayColour = String(i);
          pick.addEventListener('input', () => {
            const wear = said().colours.slice();
            wear[i] = pick.value;
            sceneHoliday.set({ on: true, colours: wear });
            onChange();
          });
          box.append(pick);
        }
      }
      return box;
    };
    const seg = (label, options, value, save, data) => { const box = el('div', 'an-db-seg'); if (label) box.append(el('span', '', label));
      for (const [key, text] of options) { const b = el('button', key === value ? 'an-db-on' : '', text); b.type = 'button'; b.dataset[data] = String(key); b.setAttribute('aria-pressed', String(key === value)); b.addEventListener('click', () => { save(key); draw(); onChange(); }); box.append(b); }
      return box; };
    const grid = el('div', 'an-db-chips an-mp-grid');
    // What the tiles are for comes before the tiles. Drawing a wall and cutting a window show quite different tiles,
    // and the mode that decides which was underneath them — so the tiles had to be read to work out the mode.
    const modes = el('div', 'an-mp-modes');
    const row = el('div', 'an-db-row an-mp-row'), extra = el('div', 'an-db-row an-db-props an-mp-extra');
    const edgeButtons = () => { const edges = el('div', 'an-db-seg an-mp-edges'); edges.append(el('span', '', 'Edges'));
      for (const [key, label, tip] of EDGE_CHOICES) { const b = el('button', remembered.edges === key ? 'an-db-on' : '', label); b.type = 'button'; b.dataset.edges = key; b.title = tip; b.setAttribute('aria-pressed', String(remembered.edges === key)); b.addEventListener('click', () => { remembered.edges = key; remembered.edgesChosen = true; draw(); onChange(); }); edges.append(b); }
      return edges; };
    if (heights) {
      // Heights: Raise or Ramp; for Raise, how the outline under a click is found; the scene's two choices under More.
      const modes = el('div', 'an-db-seg an-mp-heightmode');
      for (const [key, label, tip] of HEIGHT_MODES) { const b = el('button', remembered.heightMode === key ? 'an-db-on' : '', label); b.type = 'button'; b.dataset.heightMode = key; b.title = tip; b.setAttribute('aria-pressed', String(remembered.heightMode === key)); b.addEventListener('click', () => { remembered.heightMode = key; draw(); onChange(); }); modes.append(b); }
      row.append(modes);
      if (remembered.heightMode === 'raise') { row.append(slider('Brush', BRUSH_SIZE, 'size', BRUSH_SIZE.step, ' sq'), edgeButtons()); extra.append(slider('How alike', BRUSH_TOL, 'tol', 1)); }
      // Crossing: which kind; a ramp or a bridge as wide as the brush (a whole side of a raised part can slope).
      else {
        const kinds = el('div', 'an-db-seg an-mp-crosskind');
        for (const [key, label] of CROSSING_KINDS) { const b = el('button', remembered.crossKind === key ? 'an-db-on' : '', label); b.type = 'button'; b.dataset.crossKind = key; b.setAttribute('aria-pressed', String(remembered.crossKind === key)); b.addEventListener('click', () => { remembered.crossKind = key; draw(); onChange(); }); kinds.append(b); }
        row.append(kinds);
        if (remembered.crossKind === 'ramp' || remembered.crossKind === 'bridge') row.append(slider('Brush', BRUSH_SIZE, 'size', BRUSH_SIZE.step, ' sq'));
      }
      if (sceneTicks) {
        const now = sceneTicks.get() ?? {};
        for (const [key, label, tip] of [['walls', 'Cliff edges block movement', 'Walls that stop movement (not sight) along raised edges no ramp meets. Kept on this scene.'], ['shadows', 'Draw raised ground', 'An ink rim round each raised part, a painted cliff face below it, a short shadow away from the sun, and its ladders, ropes and bridges. Kept on this scene.'], ['topdown', 'Top-down cliffs', 'For a map drawn straight from above: each cliff shows as an inked rim with a ring every 5 ft stepping out from it, instead of a rock face hanging down the map. Kept on this scene.']]) {
          const box = el('label', 'an-mp-tick'), input = el('input'); input.type = 'checkbox'; input.checked = key === 'topdown' ? now[key] === true : now[key] !== false; input.dataset.sceneTick = key;
          input.addEventListener('change', () => sceneTicks.set(key, input.checked)); box.title = tip; box.append(input, el('span', '', label)); extra.append(box);
        }
      }
    } else if (walls && remembered.wallMode === 'roof') {
      // Roofs: what it is covered with, and a click inside a walled room lays one over that room.
      for (const { id, label, about, base } of [{ id: '', label: 'To match', about: 'The roof the walls of that room would carry.', base: '#8a7f6c' }, ...ROOF_CHOICES]) {
        const on = (remembered.roofKind ?? '') === id, t = el('button', on ? 'an-mp-tile an-db-on' : 'an-mp-tile');
        t.type = 'button'; t.setAttribute('aria-pressed', String(on)); t.dataset.roofKind = id; t.title = about;
        const sw = el('span', 'an-mp-swatch'); showSwatch(sw, id ? roofSwatch(id) : null, base); t.append(sw, el('span', '', label));
        t.addEventListener('click', () => { remembered.roofKind = id; draw(); onChange(); }); grid.append(t);
      }
      modes.append(seg('', WALL_MODES, remembered.wallMode, (v) => { remembered.wallMode = v; }, 'wallMode'));
      row.append(seg('Shape', [['', 'To fit'], ...ROOF_FORM_CHOICES.map((f) => [f.id, f.label])], remembered.roofForm, (v) => { remembered.roofForm = v; }, 'roofForm'));
      row.append(slider('Years on it', WALL_AGE, 'roofAge', WALL_AGE.step, '', (v) => (v < 0.05 ? 'new' : v < 0.5 ? 'weathered' : v < 0.85 ? 'old' : 'falling in')));
      extra.append(seg('Chimney', [['', 'None'], ['brick', 'Brick'], ['stone', 'Stone']], remembered.roofChimney, (v) => { remembered.roofChimney = v; }, 'roofChimney'));
      extra.append(tintPick('Colour', 'roofTint', 'A colour mixed into the covering: red pantiles over one house, grey slate over the hall, green copper on the temple. Mixed in, so every tile is its own shade of it.'));
      extra.append(tick('Dressed for holidays', 'roofDressed', "On a feast day in the calendar, this building puts up garlands, lanterns or banners in that day's own colour. They hang off the eaves, swing in the wind, cast their own shadows and light up at dusk."));
      extra.append(seg('Hangs out', DRESSING_CHOICES.map((d) => [d.id, d.label]), remembered.dressingKind, (v) => { remembered.dressingKind = v; }, 'dressingKind'));
      if (sceneHoliday) extra.append(holidayPick());
    } else if (walls && remembered.wallMode === 'window') {
      // Openings: which window, and a click on a painted wall cuts the opening and sets it in.
      for (const { id, label, about, opens } of [{ id: '', label: 'To match', about: 'The window the wall it is cut into would have.', opens: false }, ...WINDOW_CHOICES]) {
        const on = (remembered.windowKind ?? '') === id, t = el('button', on ? 'an-mp-tile an-db-on' : 'an-mp-tile');
        t.type = 'button'; t.setAttribute('aria-pressed', String(on)); t.dataset.windowKind = id;
        t.title = `${about}${opens ? ' It opens and closes.' : ''}`;
        const sw = el('span', 'an-mp-swatch'); showSwatch(sw, id ? windowSwatch(id) : null, opens ? '#8aa6b4' : '#6e6c64'); t.append(sw, el('span', '', label));
        t.addEventListener('click', () => { remembered.windowKind = id; draw(); onChange(); }); grid.append(t);
      }
      modes.append(seg('', WALL_MODES, remembered.wallMode, (v) => { remembered.wallMode = v; }, 'wallMode'));
      row.append(slider('Wide', DOOR_WIDE, 'doorWide', DOOR_WIDE.step, '', (v) => (v === 1 ? 'one square' : `${Math.round(v * 100) / 100} squares`)));
      row.append(seg('Opens', [['in', 'Inside'], ['out', 'Outside']], remembered.swing, (v) => { remembered.swing = v; }, 'swing'));
      row.append(tick('Can be climbed through', 'windowWalk', 'Opened, this window may be climbed through. Shut, nobody passes it either way.'));
    } else if (walls && remembered.wallMode === 'door') {
      // Doorways: which leaf hangs in them, and a click on a painted wall cuts the opening and hangs it.
      for (const { id, label, about, base } of [{ id: '', label: 'To match', about: 'The door the wall it is cut into would have: planked in timber, banded oak in stone, a slab in hewn rock.', base: '#8a7f6c' }, ...DOOR_CHOICES]) {
        const on = (remembered.doorKind ?? '') === id, t = el('button', on ? 'an-mp-tile an-db-on' : 'an-mp-tile');
        t.type = 'button'; t.setAttribute('aria-pressed', String(on)); t.dataset.doorKind = id; t.title = about;
        const sw = el('span', 'an-mp-swatch'); showSwatch(sw, id ? doorSwatch(id) : null, base); t.append(sw, el('span', '', label));
        t.addEventListener('click', () => { remembered.doorKind = id; draw(); onChange(); }); grid.append(t);
      }
      modes.append(seg('', WALL_MODES, remembered.wallMode, (v) => { remembered.wallMode = v; }, 'wallMode'));
      row.append(slider('Wide', DOOR_WIDE, 'doorWide', DOOR_WIDE.step, '', (v) => (v === 1 ? 'one square' : `${Math.round(v * 100) / 100} squares`)));
      row.append(seg('Opens', [['in', 'Inside'], ['out', 'Outside']], remembered.swing, (v) => { remembered.swing = v; }, 'swing'));
      row.append(tick('Hinge the far end', 'doorFlip', 'The door hangs on the other end of the opening. Which end it hangs on and which way it opens are two different things.'));
    } else if (walls) {
      // Walls: what the next wall is made of, how thick it is drawn and how long it has stood. Dragging on the map
      // lays it — a wall of Foundry's own, which is what the vision needs, carrying the material that paints it.
      for (const { id, label, about, base } of WALL_MATERIAL_CHOICES) {
        const on = remembered.wallMaterial === id, t = el('button', on ? 'an-mp-tile an-db-on' : 'an-mp-tile');
        t.type = 'button'; t.setAttribute('aria-pressed', String(on)); t.dataset.wallMaterial = id; t.title = about;
        const sw = el('span', 'an-mp-swatch'); showSwatch(sw, wallSwatch(id), base); t.append(sw, el('span', '', label));
        t.addEventListener('click', () => { remembered.wallMaterial = id; draw(); onChange(); }); grid.append(t);
      }
      modes.append(seg('', WALL_MODES, remembered.wallMode, (v) => { remembered.wallMode = v; }, 'wallMode'));
      row.append(slider('Thick', WALL_WIDTH, 'wallWidth', WALL_WIDTH.step, '', (v) => `${Math.round(v * 100) / 100} sq`));
      row.append(slider('Years on it', WALL_AGE, 'wallAge', WALL_AGE.step, '', (v) => (v < 0.05 ? 'kept' : v < 0.5 ? 'lived in' : v < 0.85 ? 'abandoned' : 'ruined')));
      row.append(tick('Curved', 'wallCurve', 'The run bends through the corners you drag instead of turning at them: a round tower, an apse, a cave mouth. The walls themselves become short chords along the curve, so sight and movement follow it exactly.'));
      extra.append(tintPick('Colour', 'wallTint', 'A colour mixed into the stuff this wall is made of: whitewash, red sandstone, a painted timber house. Mixed in, not laid over, so it is still stone with all its blotches and grain — and the walls already up keep the colour they were drawn in.'));
    } else if (floors) {
      // Floors: a swatch each; the brush and Smart edges; the rest under More.
      for (const id of BRUSH_FLOORS) {
        const on = remembered.floor === id, t = el('button', on ? 'an-mp-tile an-db-on' : 'an-mp-tile'); t.type = 'button'; t.setAttribute('aria-pressed', String(on)); t.dataset.floor = id;
        if (id === 'cavern') t.title = 'Cave growth: glowing fungus, crystals, mist, cobwebs... painted over whatever floor is there.';
        const sw = el('span', 'an-mp-swatch'); const base = tileColour(id, remembered.cave); sw.style.background = base;
        // Cave is not a floor but growth laid over whatever floor is there, so it keeps its colour.
        if (id !== 'cavern') floorSwatchSoon(sw, id, base);
        t.append(sw, el('span', '', tileName(id)));
        t.addEventListener('click', () => { remembered.floor = id; if (!canStandOverWater(id)) remembered.overWater = false; draw(); onChange(); }); grid.append(t);
      }
      // Edges: where a dab stops. Colour: what matches the colour where the stroke began. Model: the outline the segmentation
      // model sees under the pointer (a bridge is not the pool under it). Off: the whole ring.
      row.append(slider('Brush', BRUSH_SIZE, 'size', BRUSH_SIZE.step, ' sq'), edgeButtons());
      if (remembered.floor === 'cavern') {
        // Cave: what it holds, its colour and stage, as the region panel's Cavern section; size, how many and the rarer growth under More.
        const menu = caveMenuNow(), kind = remembered.cave.split('-')[0];
        const caveRow = el('div', 'an-db-row an-mp-row an-mp-cave');
        caveRow.append(seg('Holds', BRUSH_CAVE_KINDS, menu ? kind : '', (v) => setBrushCave(v), 'caveKind'));
        if (menu?.tones) caveRow.append(seg(menu.toneLabel, menu.tones, menu.tone, (tone) => setBrushCave(`${kind}-${tone}`), 'caveTone'));
        if (menu?.steps) caveRow.append(seg('Stage', menu.steps.map((name, i) => [i, name]), menu.step, (i) => { remembered.caveStep = i; }, 'caveStep'));
        body.append(caveRow);
        const pct = (v) => `${Math.round(v * 100)}%`;
        if (menu?.steps) extra.append(slider('Size', menu.sizeRange, 'caveSize', 0.05, '', pct), slider('How many', CAVE_AMOUNT, 'caveAmount', 0.1, '', pct));
        const other = choice('Any growth', BRUSH_CAVE_MORE, kind, (v) => setBrushCave(v));
        other.title = 'Every cave growth: cobwebs in its corners, water down its walls, steam from its floor, or bad air that starves the fires.'; extra.append(other, slider('How alike', BRUSH_TOL, 'tol', 1));
      } else {
        if (remembered.floor === 'water') { const kind = choice('Water', WATER_KINDS, remembered.waterKind, (v) => { remembered.waterKind = v; }); kind.title = 'What new water regions are: a still pool, a river, rapids, a waterfall or the sea (which way it flows is set in the region panel).'; row.append(kind); }
        extra.append(slider('How alike', BRUSH_TOL, 'tol', 1), choice('Texture', TEXTURE_CHOICES, remembered.texture, (v) => { remembered.texture = v; }));
        const styles = TEXTURE_STYLES[remembered.floor];
        if (styles && remembered.texture !== 'off') { const style = choice('Style', styles, remembered.styles[remembered.floor] || styles[0][0], (v) => { remembered.styles[remembered.floor] = v; }); style.title = 'How new regions paint this floor, when they paint it.'; extra.append(style); }
        const soft = slider('Soft edge', BRUSH_EDGE, 'edge', 0.1, ' sq'); soft.title = "How far a new region's painted texture fades out past its line, in squares. 0 is a hard edge."; extra.append(soft);
        if (canStandOverWater(remembered.floor)) extra.append(tick('Over water', 'overWater', 'A deck, a jetty or a bridge: standing over the water below.'));
      }
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
      row.append(slider('Brush', BRUSH_SIZE, 'size', BRUSH_SIZE.step, ' sq'), slider('Density', BRUSH_THICK, 'thick', 0.1));
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
    body.append(modes, grid, row, extra);
    const keys = el('div', 'an-db-hint an-mp-keys', walls ? (remembered.wallMode === 'roof'
      ? 'Click inside a room the walls close in: a roof goes over it, with its ridge along the room · Click a roof to take it off · It fades while somebody is under it · 1 / 2 / 3 / 4: tabs'
      : remembered.wallMode === 'window'
      ? 'Click a painted wall: an opening is cut there and the window set into it · Click an opening that is already there to put this in it instead · 1 / 2 / 3 / 4: tabs'
      : remembered.wallMode === 'door'
      ? 'Click a painted wall: a doorway is cut there and the leaf hung in it · Click an opening that is already there to put this in it instead · 1 / 2 / 3 / 4: tabs'
      : remembered.wallMode === 'move'
      ? 'Drag from inside a building: its walls, its doorways and windows, and the roof over it all go together · Drag a wall itself to move just that one · It lands on the grid · Ctrl+Z puts it back · 1 / 2 / 3 / 4: tabs'
      : remembered.wallMode === 'round'
      ? 'Drag from the middle of the room outwards: a ring of walls, as round as a tower · Drag further for a wider one · A room this round takes a conical roof · 1 / 2 / 3 / 4: tabs'
      : remembered.wallMode === 'erase'
      ? 'Click or drag over a painted wall: it goes · Only walls painted here — never the map’s own · Shift: draw instead · 1 / 2 / 3 / 4: tabs'
      : `Drag along the map: a wall${remembered.wallCurve ? ', bending through your corners' : ', turning where you turn'} · Drag back over a corner to take that leg off · Shift: rub out · Ctrl+wheel: how thick · 1 / 2 / 3 / 4: tabs`) : heights ? (remembered.heightMode === 'ramp' ? (remembered.crossKind === 'bridge' ? 'Drag from one raised part to another: a bridge as wide as the brush' : `Drag up across a raised edge: a ${remembered.crossKind}${remembered.crossKind === 'ramp' ? ' as wide as the brush' : ''}`) + ' · Shift-click removes one · 1 / 2 / 3: tabs · Saved as you go' : 'Drag: raise the ground · Wheel over it: higher or lower · Shift-drag rubs out · Alt-drag along an edge: open it (Alt+Shift closes) · 1 / 2 / 3: tabs') : `Drag to paint · Shift-drag rubs out${floors ? (remembered.floor === 'cavern' ? ' the picked growth' : ' the picked floor') : ''} · Ctrl+wheel: brush size · 1 / 2 / 3: tabs · Saved as you paint`);
    keys.title = walls ? 'Ctrl+wheel: the number this mode is about (how wide, how thick, how old) · Shift+wheel: the years on it · Ctrl+Z undo · Ctrl+Shift+Z redo · Esc stops' : heights ? 'Ctrl+Z undo · Ctrl+Shift+Z redo · Esc stops' : floors ? 'Ctrl+wheel: size · Alt+wheel: how alike · Ctrl+Z undo · Ctrl+Shift+Z redo · Esc stops' : 'Ctrl+wheel: size · Shift+wheel: rotate · Ctrl+Shift+wheel: density · Alt+wheel: decoration size · Ctrl+Z undo · Esc stops';
    bar.append(head, body, keys);
    if (typing) { const s = bar.querySelector('.an-db-search'); s?.focus(); s?.setSelectionRange(s.value.length, s.value.length); }
  };
  const api = { element: bar, close: () => { bar.remove(); if (remembered.lock === lock) remembered.lock = null; },
    // Ctrl+wheel moves it by the same step the slider does, and lands on it exactly (0.1 + 0.2 is not 0.3 in binary).
    setSize: (v) => { remembered.size = Math.min(BRUSH_SIZE.max, Math.max(BRUSH_SIZE.min, Math.round(v / BRUSH_SIZE.step) * BRUSH_SIZE.step)); draw(); },
    setThick: (v) => { remembered.thick = Math.min(BRUSH_THICK.max, Math.max(BRUSH_THICK.min, Math.round(v * 10) / 10)); draw(); },
    setScale: (v) => { remembered.scale = Math.min(BRUSH_SCALE.max, Math.max(BRUSH_SCALE.min, Math.round(v * 10) / 10)); draw(); },
    setEdges: (v) => { remembered.edges = EDGE_CHOICES.some(([k]) => k === v) ? v : 'colour'; draw(); },
    setTol: (v) => { remembered.tol = Math.min(BRUSH_TOL.max, Math.max(BRUSH_TOL.min, Math.round(v))); draw(); },
    /**
     * A step of the number the Structures tab's mode is mostly about — a wider doorway, a thicker wall, an older roof —
     * without letting go of the map to reach the slider. `which` is 'main' or 'second'; answers whether it took it,
     * so a mode with nothing to move leaves the wheel to the map.
     */
    nudge: (which, dir) => {
      if (lock || remembered.tab !== 'walls') return false;
      const pick = WALL_WHEEL[remembered.wallMode]?.[which];
      if (!pick) return false;
      const [key, bounds] = pick;
      const now = Number(remembered[key] ?? bounds.usual) || 0;
      const next = Math.min(bounds.max, Math.max(bounds.min, Math.round((now + dir * bounds.step) / bounds.step) * bounds.step));
      remembered[key] = Math.round(next * 1000) / 1000;
      draw();
      return true;
    },
    // Turns the brush a step either way (from upright when it was random).
    turnBy: (dir) => { remembered.turn = (((remembered.turn ?? 0) + dir * BRUSH_TURN_STEP) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2); draw(); },
    setTab: (tab) => { const next = (tab === 'floors' || tab === 'heights' || tab === 'walls') && !lock ? tab : 'decor'; if (next === remembered.tab) return; remembered.tab = next; draw(); onTab(next); onChange(); },
    // (From a raised part's panel, Add crossing: Heights, crossing mode, that kind.)
    setCrossing: (kind) => { if (lock) return; remembered.heightMode = 'ramp'; if (CROSSING_KINDS.some(([k]) => k === kind)) remembered.crossKind = kind; const tabbed = remembered.tab !== 'heights'; remembered.tab = 'heights'; draw(); if (tabbed) onTab('heights'); onChange(); },
    // The line changes where it stands. (It is set as the pointer moves over the map and whenever a choice changes, so
    // drawing the bar afresh here replaced the slider being dragged and the drag died on its first step.)
    setStatus: (text, { undo = false, redo = false } = {}) => {
      status = { text: String(text ?? ''), undo, redo };
      if (statusEl && undoEl && redoEl) { statusEl.textContent = status.text; undoEl.disabled = !status.undo; redoEl.disabled = !status.redo; return; }
      draw();
    } };
  draw();
  (document.getElementById('board')?.parentElement ?? document.body).append(bar);
  return api;
}
