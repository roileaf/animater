// What goes inside each section of the region panel (region-panel.mjs): the controls, and which flags each one saves.
// Every builder takes the panel's context `c` ({ doc, own, floor, kind, at, act, toFloor, more, texture, season, presets,
// weathers, close, edit }) and returns the elements of that section's body. They save the same flags the region window's
// Animater tab and the old right-click step menu saved.

import { FLOOR_CHOICES } from '../engines/motion/movement-feel.mjs';
import { floorBody } from '../engines/motion/floor-shadows.mjs';
import { WATER_DEPTHS, WATER_TOWARD, waterFlows, waterKindFlags, waterKindOf, DOCK_STYLES, OVER_DARK, OVER_SOFT, castsShadow, dockStyleOf, overShadowChoices, overShadowOf, showsPosts, STEP_EDGE, STEP_SCALE, STEP_STRENGTH, STEP_SPEEDS, TEXTURE_STYLES, textureFloor, textureStyleOf, activeStep, changeStep, setStepSpeed, setStepStrength, stepEdge, stepMenu, stepScale, CAVE_AMOUNT, CAVE_CHOICES, caveKindFlags, caveMenu, INDOOR_EDGE, indoorEdgeOf } from '../engines/motion/region-steps.mjs';
import { REGION_ANIMAL_GROUPS, ANIMAL_SIZE, animalSizeOf, MOST_HAWKS, MOST_COUNT, regionAnimalCounts } from '../engines/motion/region-animals.mjs';
import { SKY_WINDOWS, skyWindowOf, WINDOW_PATTERN, patternScaleOf } from '../engines/motion/wall-shadows.mjs';
import { keepsOut } from '../engines/motion/wildlife.mjs';
import { REGION_LOOK_FLAG } from '../engines/playback/region-looks.mjs';
import { choice } from './region-steps-ui.mjs';
import { ROOM_DRESSING, kindFlags } from './region-panel-model.mjs';
// Whether the ground here is built out over water (a dock): on, it shows how it is built, its posts and its shadow.
const OVER_WATER_TIP = 'Built out over water: a deck, a jetty, a bridge. The water goes on under it; what walks here walks on its boards, and it shows how it is built, its posts and its shadow.';

// The small pieces every section is made of.
export const element = (tag, className, text) => { const el = document.createElement(tag); if (className) el.className = className; if (text !== undefined) el.textContent = text; return el; };
export const button = (text, className, click) => { const b = element('button', className, text); b.type = 'button'; b.addEventListener('click', click); return b; };
export const icon = (name, className = '') => { const i = element('i', `fa-solid ${name}${className ? ` ${className}` : ''}`); i.setAttribute('aria-hidden', 'true'); return i; };
// A hover explanation, in place of a paragraph.
export const tip = (node, text) => { if (text) node.setAttribute('data-tooltip', text); return node; };
const percent = (v) => `${Math.round(v * 100)}%`;
// A name on the left, its control on the right (`wide`: the control under its name, for a long row of buttons).
const row = (label, control, hint, wide = false) => { const r = element('div', wide ? 'an-rp-row an-rp-wide' : 'an-rp-row'); r.append(element('span', '', label), control); return tip(r, hint); };
// A row of buttons, one of them chosen: [value, label] options.
const seg = (options, current, pick, label) => {
  const box = element('div', 'an-rp-seg'); box.setAttribute('role', 'group'); box.setAttribute('aria-label', label);
  for (const [value, text] of options) { const on = value === current, b = button(text, on ? 'an-rp-on' : '', () => { if (!on) pick(value); }); b.setAttribute('aria-pressed', String(on)); box.append(b); }
  return box;
};
// A switch, with its words beside it.
const toggle = (label, on, change, hint) => {
  const r = element('div', 'an-rp-tog'), sw = button('', on ? 'an-rp-sw an-rp-on' : 'an-rp-sw', () => change(!on));
  sw.setAttribute('role', 'switch'); sw.setAttribute('aria-checked', String(on)); sw.setAttribute('aria-label', label);
  r.append(element('span', '', label), sw);
  return tip(r, hint);
};
// A slider saved when let go, so a drag does not redraw the region at every step. Saves a number.
const range = (label, bounds, value, words, change, step, hint, name = label) => {
  const box = element('div', 'an-rp-range'), slider = element('input'), shown = element('span', 'an-rp-value');
  slider.type = 'range'; slider.min = String(bounds.min); slider.max = String(bounds.max); slider.step = String(step); slider.value = String(value);
  slider.setAttribute('aria-label', name);
  const say = () => { shown.textContent = words(Number(slider.value)); };
  say();
  slider.addEventListener('input', say);
  slider.addEventListener('change', () => change(Number(slider.value)));
  box.append(slider, shown);
  return row(label, box, hint);
};
// Eight ways round a centre: `centre` [value, label] is the ninth (with the wind).
const compass = (label, value, pick, [middle, middleLabel]) => {
  const box = element('div', 'an-rp-compass'), names = Object.fromEntries(WATER_TOWARD), short = { n: 'N', ne: 'NE', e: 'E', se: 'SE', s: 'S', sw: 'SW', w: 'W', nw: 'NW' };
  box.setAttribute('role', 'group'); box.setAttribute('aria-label', label);
  for (const way of ['nw', 'n', 'ne', 'w', null, 'e', 'sw', 's', 'se']) {
    const v = way ?? middle, on = v === value, b = button(way ? short[way] : '', on ? 'an-rp-on' : '', () => { if (!on) pick(v); });
    if (!way) b.append(icon('fa-wind'));
    b.setAttribute('aria-label', way ? names[way] : middleLabel); b.setAttribute('aria-pressed', String(on)); tip(b, way ? names[way] : middleLabel);
    box.append(b);
  }
  return box;
};
// On or off as the old tick boxes saved them.
const said = (own, key) => own?.[key] === true;
const flip = (key, act) => (on) => act({ [key]: on });
const soundOn = (own) => own.regionSound !== 'off';

const WATER_SHORT = [['still', 'Pond'], ['river', 'River'], ['rapids', 'Rapids'], ['falls', 'Falls'], ['sea', 'Sea']];
const CURRENTS = [['slower', 'Crawl'], ['slow', 'Slow'], ['', 'Gentle'], ['swift', 'Swift']];
const DRIP_PACE = [['slow', 'Slow'], ['', 'Steady'], ['fast', 'Fast'], ['faster', 'Trickle']];
const DRIP_POOL = [['', 'Puddle'], ['pool', 'Pool'], ['deep', 'Deep']];
const CLIMATES = [['', 'Scene'], ['cold', 'Cold'], ['warm', 'Warm']];
// "From the scene" saves no floor of its own: the panel then shows it as its kind's floor (region-panel-model.mjs).
const GROUND_FLOORS = [['', 'From the scene'], ...FLOOR_CHOICES.filter(([v]) => v && v !== 'water' && v !== 'lava')];
// A floor the list does not name (an old or hand-set one) still shows as chosen.
const withFloor = (list, value) => (!value || list.some(([v]) => v === value) ? list : [...list, [value, capital(value)]]);
const capital = (s) => String(s).charAt(0).toUpperCase() + String(s).slice(1);
const DECK_FLOORS = FLOOR_CHOICES.filter(([v]) => v && !['water', 'lava', 'none'].includes(v));
const CAVE_KINDS = [['', 'None'], ['mist', 'Mist on the floor'], ['fungus-green', 'Glowing fungus (green)'], ['fungus-blue', 'Glowing fungus (blue)'], ['fungus-violet', 'Glowing fungus (violet)'], ['crystals-amethyst', 'Crystals (amethyst)'], ['crystals-quartz', 'Crystals (clear quartz)'], ['crystals-rose', 'Crystals (rose)'], ['lava', 'Lava'], ['webs', 'Cobwebs'], ['wet', 'Wet walls'], ['steam', 'Steam vents'], ['foul', 'Bad air']];
const KEEP_OUT = [['all', 'All animals'], ['rats', 'Rats'], ['bats', 'Bats'], ['moths', 'Moths'], ['crawlers', 'Crawlers'], ['eyes', 'Eyes'], ['rabbits', 'Rabbits'], ['deer', 'Deer'], ['foxes', 'Foxes'], ['wolves', 'Wolves'], ['squirrels', 'Squirrels'], ['snakes', 'Snakes'], ['songbirds', 'Songbirds'], ['crows', 'Crows'], ['hawk', 'Hawk'], ['owl', 'Owl'], ['fish', 'Fish'], ['frogs', 'Frogs'], ['ducks', 'Ducks'], ['herons', 'Herons'], ['gulls', 'Gulls'], ['butterflies', 'Butterflies'], ['dragonflies', 'Dragonflies'], ['fireflies', 'Fireflies'], ['pigeons', 'Pigeons'], ['hens', 'Hens'], ['cats', 'Cats'], ['dogs', 'Dogs']];
const ANIMAL_ICONS = { crows: 'fa-crow', hawks: 'fa-feather-pointed', herons: 'fa-water', gulls: 'fa-wind', rabbits: 'fa-carrot', wildBirds: 'fa-dove', deer: 'fa-tree', foxes: 'fa-paw', wolves: 'fa-moon', squirrels: 'fa-leaf', snakes: 'fa-staff-snake', insects: 'fa-bug', owls: 'fa-feather', fish: 'fa-fish', waterBirds: 'fa-crow', frogs: 'fa-frog', pigeons: 'fa-dove', hens: 'fa-egg', cats: 'fa-cat', dogs: 'fa-dog', cows: 'fa-cow', goats: 'fa-horse-head', sheep: 'fa-cloud', pigs: 'fa-piggy-bank', horses: 'fa-horse', rats: 'fa-cheese', bats: 'fa-cloud-moon' };
// Which animals each kind of region shows first; the rest wait under "More animals".
const ANIMALS_FIRST = { water: ['Water', 'Open ground', 'Farm', 'Town'], ground: ['Farm', 'Open ground', 'Town', 'Water'], indoors: ['Town', 'Dark places', 'Farm'], cave: ['Dark places'] };

// The floor's texture style, for the floor the region is on now, and how big its pattern is.
const styleRow = ({ own, floor, act }) => { const now = textureFloor(own, floor); return row('Texture style', choice(TEXTURE_STYLES[now] ?? [], textureStyleOf(own, now), 'Texture style', (v) => act({ textureStyles: { ...(own.textureStyles ?? {}), [now]: v } }))); };
const scaleRow = ({ own, act }) => range('Pattern size', STEP_SCALE, stepScale(own), percent, (v) => act({ stepScale: v }), 0.05, 'Smaller for more of it: more panes of glass, more stones.');
const scaleShown = (c) => c.texture(c.own) || stepMenu(c.own, c.floor).strength !== null;
// Whether it throws a shadow on what is below, which one, and (`fine`, else under a More line) how soft and dark.
const shadowParts = (c, fine) => {
  const { own, floor, act } = c, shadow = castsShadow(own);
  const parts = [toggle('Casts a shadow', shadow, flip('castShadow', act), 'It throws a shadow on what is below, away from the sun and longer as the sun gets low.')];
  if (!shadow) return parts;
  const s = overShadowOf(own, floor), more = () => [range('Softness', OVER_SOFT, s.soft, percent, (v) => act({ overShadowSoft: v }), 0.05, '', 'Shadow softness'),
    range('Darkness', OVER_DARK, s.dark, percent, (v) => act({ overShadowDark: v }), 0.05, '', 'Shadow darkness')];
  parts.push(row('Shadow', choice(overShadowChoices(floor), s.kind, 'Its shadow', (v) => act({ overShadows: { ...(own.overShadows ?? {}), [floor]: v } }))));
  return [...parts, ...(fine ? more() : c.more('deck', 'More: shadow softness, darkness…', more))];
};

export const SECTIONS = {
  water(c) {
    const { own, act } = c, kind = waterKindOf(own);
    const parts = [row('Kind', seg(WATER_SHORT, kind, (v) => act(waterKindFlags(own, v)), 'Kind of water'), 'How the water engine moves it, and what it sounds like.', true)];
    if (waterFlows(kind)) parts.push(row('Flows toward', compass('Flows toward', own.flowTo || 's', (v) => act({ flowTo: v }), ['wind', 'With the wind']), 'The way the water runs (north is up the map): its ripples, glints and foam are carried downstream.'),
      row('Current', seg(CURRENTS, own.current ?? '', (v) => act({ current: v }), 'Current')));
    if (kind === 'sea') parts.push(row('Waves toward', compass('Waves toward', own.waveTo ?? '', (v) => act({ waveTo: v }), ['', 'With the wind'])),
      toggle('Beach along the shore', own.seaBeach !== 'off', (on) => act({ seaBeach: on ? '' : 'off' })));
    if (kind !== 'falls') parts.push(row('Depth', choice(WATER_DEPTHS, own.waterDepth ?? '', 'How deep the water is', (v) => act({ waterDepth: v }))));
    parts.push(toggle('Reflections', own.reflections !== 'off', (on) => act({ reflections: on ? '' : 'off' }), 'Still water mirrors creatures, tiles, fires and the moon. Off in Scene configuration turns them off everywhere.'),
      toggle('Freezes in the cold', own.noFreeze !== true, (on) => act({ noFreeze: !on }), 'Off: stays open in a hard frost, like a hot spring or a fast river.'),
      toggle('Water sound', soundOn(own), (on) => act({ regionSound: on ? '' : 'off' })));
    parts.push(...c.more('water', 'More: drips, coast, waterfall…', () => [...SECTIONS.drips(c),
      toggle('Coast waves and tide', said(own, 'sea'), flip('sea', act), 'Waves wash in on its shores, the wet sand moves with the tide, and crabs keep to the shore.'),
      toggle('Waterfall spray', said(own, 'waterfall'), flip('waterfall', act), 'The water falls the way it flows, with foam at its foot, mist and a rainbow in the spray.')]));
    return parts;
  },

  drips(c) {
    const { own, act, kind } = c, on = !!own.drips;
    const parts = [toggle('Drips from the ceiling', on, flip('drips', act), 'Water seeps through the ceiling and drips into a pool here, its rings bending the floor seen through it. Over open water, the water itself rings.')];
    if (!on) return parts;
    parts.push(row('Pace', seg(DRIP_PACE, own.dripPace ?? '', (v) => act({ dripPace: v }), 'Drip pace')),
      row('Pool', seg(DRIP_POOL, own.dripDepth ?? '', (v) => act({ dripDepth: v }), 'Pool depth'), 'A puddle shows the floor through it; a pool or deep water is a water floor for anyone walking through.'));
    if (kind !== 'water') parts.push(toggle('Dripping sound', soundOn(own), (on_) => act({ regionSound: on_ ? '' : 'off' })));
    return parts;
  },

  ground(c) {
    const { own, floor, act } = c, textured = c.texture(own);
    const parts = [row('Floor', choice(withFloor(GROUND_FLOORS, own.floor), own.floor || '', 'Floor', (v) => c.toFloor({ floor: v })), 'What creatures walk on here: their footsteps, sounds and prints. From the scene: whatever the scene\'s floor is.')];
    parts.push(toggle('Over water', false, (on) => { if (on) c.toFloor(kindFlags('deck', own)); }, OVER_WATER_TIP));
    if (stepMenu(own, floor).grassy) parts.push(toggle('Changes with the seasons', c.season(own), (on) => act({ season: on ? 'on' : 'off' })));
    parts.push(toggle('Floor texture', textured, (on) => act({ texture: on ? 'on' : 'off' }), 'Paint the floor here, over the map.'));
    if (textured) parts.push(styleRow(c));
    if (scaleShown(c)) parts.push(scaleRow(c));
    // A raised floor (a stage, a balcony) can throw a shadow too: rarely, so it waits under More.
    parts.push(...c.more('ground', 'More: its shadow…', () => shadowParts(c, true)));
    return parts;
  },

  cavern(c) {
    const { own, floor, act } = c, menu = caveMenu(own, floor), parts = [];
    if (!menu || menu.choosable) parts.push(row('Holds', seg(CAVE_CHOICES, menu?.kind ?? '', (v) => c.toFloor(caveKindFlags(own, v)), "What's here"), '', true));
    if (menu?.tones) parts.push(row(menu.toneLabel, seg(menu.tones, menu.tone, (tone) => act({ cavern: `${menu.kind}-${tone}` }), menu.toneLabel)));
    if (menu?.steps) parts.push(row('Stage', seg(menu.steps.map((name, i) => [i, name]), menu.step, (i) => act({ caveStep: i }), 'Stage'), '', true),
      range('Size', menu.sizeRange, menu.size, percent, (v) => act({ caveSize: v }), 0.05),
      range('How many', CAVE_AMOUNT, menu.amount, percent, (v) => act({ caveAmount: v }), 0.1));
    parts.push(...c.more('cavern', 'More: cobwebs, steam, bad air…', () => [row('Cavern', choice(CAVE_KINDS, own.cavern ?? '', 'Cavern', (v) => act({ cavern: v })), 'Every cavern effect: cobwebs in its corners, water down its walls, steam from its floor, or bad air that starves the fires.', true)]));
    return parts;
  },

  air(c) {
    const { own, kind, act } = c;
    const parts = [toggle('Roof', c.roofed, (on) => c.setRoof(on), "Keeps the weather, the sun and the sky's light out, as indoors or in a cave: Foundry's Suppress Weather on this region. Open to the sky below lets it in through a hole."),
      row('Weather', choice([['', 'As the scene'], ...c.weathers()], own.regionWeather ?? '', 'Weather here', (v) => act({ regionWeather: v })), "Weather drawn only inside this region, in place of the scene's. Only the look: the ground, sounds and footsteps stay as the scene's."),
      row('Climate', seg(CLIMATES, own.cold ?? '', (v) => act({ cold: v }), 'Climate here'), "Whether creatures' breath shows inside, whatever the scene's climate.")];
    parts.push(toggle('Tavern murmur', said(own, 'tavern'), flip('tavern', act), 'The murmur of a crowd inside: loud in here, faint through the walls, spilling out of an open door.'));
    // A room's dressing: a cave sets it in its own section, every other kind here.
    const dressing = () => (kind === 'cave' ? [] : [row('Room dressing', choice(withFloor(ROOM_DRESSING, own.cavern), own.cavern ?? '', 'Room dressing', (v) => act({ cavern: v })), 'Cobwebs in its corners, water down its walls, steam from its floor, or bad air that starves the fires.')]);
    const openings = () => {
      const out = [toggle('Opens to the outside', said(own, 'opensOutside'), flip('opensOutside', act), 'A way out to the open air: stairs up, a cave mouth, an air shaft. The air indoors flows toward it.'),
        toggle('Open to the sky', said(own, 'openSky'), flip('openSky', act), 'The weather reaches the floor here, and underground the sky shows through: a hole in the roof, a shaft.')];
      if (said(own, 'openSky')) out.push(row('Window', choice(SKY_WINDOWS, skyWindowOf(own), 'Window in it', (v) => act({ skyWindow: v }))));
      if (said(own, 'openSky') && skyWindowOf(own)) out.push(range('Pane size', WINDOW_PATTERN, patternScaleOf(own.skyPattern), percent, (v) => act({ skyPattern: v }), 0.05, "How big the window's panes are in its light.", 'Window pattern size'));
      return out;
    };
    const edge = () => [range('Weather edge', INDOOR_EDGE, indoorEdgeOf(own), (v) => v.toFixed(1), (v) => act({ indoorEdge: v }), 0.1, 'Where this region keeps the weather out or is open to the sky: how far the weather fades in at its edge, in squares. 0 is a hard line.')];
    if (kind === 'cave') parts.push(...openings(), ...c.more('air', 'More: weather edge…', edge));
    else if (kind === 'indoors') parts.push(...openings(), ...c.more('air', 'More: weather edge, cobwebs…', () => [...edge(), ...dressing()]));
    else parts.push(...c.more('air', 'More: openings, weather edge, cobwebs…', () => [...openings(), ...edge(), ...dressing()]));
    return parts;
  },

  deck(c) {
    const { own, floor, act } = c, parts = [row('Floor', choice(withFloor(DECK_FLOORS, own.floor || floor), own.floor || floor, 'Floor', (v) => c.toFloor({ floor: v }))),
      toggle('Over water', true, (on) => { if (!on) c.toFloor(kindFlags('ground', own)); }, OVER_WATER_TIP)];
    if (floorBody(floor).post) {
      parts.push(row('Built as', seg(DOCK_STYLES, dockStyleOf(own), (v) => act({ dockStyle: v }), 'Built as'), 'Plain is the floor and its shadow; old boards and a railed pier show edge boards, planks and beam ends.', true));
      if (dockStyleOf(own)) parts.push(toggle('Posts', showsPosts(own), flip('overPosts', act), 'What holds it up along its long edges, standing in the water.'));
    }
    return [...parts, ...shadowParts(c, false)];
  },

  steps(c) {
    const { own, floor, act } = c, menu = stepMenu(own, floor), chips = element('div', 'an-rp-steps');
    menu.steps.forEach((name, i) => chips.append(button(name, i === menu.current ? 'an-rp-on' : '', () => act(changeStep(own, floor, i, c.at)))));
    const parts = [tip(chips, menu.walks ? `This step walks as ${menu.walks}: its footsteps, sounds and prints.` : '')];
    if (menu.speed) parts.push(row('Speed', seg(STEP_SPEEDS, menu.speed, (v) => act(setStepSpeed(own, floor, v)), 'Speed, this step')));
    if (menu.strength !== null) parts.push(range('Strength', STEP_STRENGTH, menu.strength, percent, (v) => act(setStepStrength(own, floor, v)), 0.1, 'How much of its look this step puts down.', 'Look strength'));
    if (activeStep(own) || own.stepHidden) parts.push(toggle('Hide this step', menu.hidden, (on) => act({ stepHidden: on })));
    parts.push(button('Edit steps…', 'an-rp-more an-rp-link', () => { c.close(); c.edit(c.doc); }));
    return parts;
  },

  animals(c) {
    const { own, kind, act } = c, now = own.regionAnimals ?? {};
    // Every kind counted: how many the region has of it (a hawk one unless set), its number on the card; click for one
    // more, right-click for one fewer, saved as that number.
    const counts = regionAnimalCounts(own), amountOf = (k) => counts[k] > 0;
    const card = (k, label) => {
      const n = counts[k] ?? 0, most = k === 'hawks' ? MOST_HAWKS : MOST_COUNT;
      // (While a save is on its way, a click would only repeat it.)
      const set = (to) => { if (c.saving?.()) return; const next = Math.max(0, Math.min(most, to)); if (next !== n) act({ regionAnimals: { ...now, [k]: String(next) } }); };
      const b = button('', n ? 'an-rp-animal an-rp-on' : 'an-rp-animal', () => set(n + 1));
      b.addEventListener('contextmenu', (e) => { e.preventDefault(); set(n - 1); });
      b.setAttribute('aria-label', `${label}: ${n}`); tip(b, `${n === 0 ? 'None' : n}. Click for one more, right-click for one fewer.`);
      b.append(icon(ANIMAL_ICONS[k] ?? 'fa-paw'), element('span', '', label), element('div', 'an-rp-count', String(n)));
      return b;
    };
    const group = ([name, list]) => { const grid = element('div', 'an-rp-animals'); for (const [k, label] of list) grid.append(card(k, label)); return [element('div', 'an-rp-group', name), grid]; };
    const first = ANIMALS_FIRST[kind] ?? REGION_ANIMAL_GROUPS.map(([name]) => name);
    const shown = REGION_ANIMAL_GROUPS.filter(([name, list]) => first.includes(name) || list.some(([k]) => amountOf(k))).sort(([a], [b]) => (first.indexOf(a) + 1 || 99) - (first.indexOf(b) + 1 || 99));
    const rest = REGION_ANIMAL_GROUPS.filter((g) => !shown.includes(g));
    const parts = shown.flatMap(group);
    if (rest.length) parts.push(...c.more('animals-kinds', 'More animals…', () => rest.flatMap(group)));
    parts.push(range('Their size', ANIMAL_SIZE, animalSizeOf(own), percent, (v) => act({ regionAnimalSize: v }), ANIMAL_SIZE.step),
      toggle('Animal sounds', own.animalSound !== 'off', (on) => act({ animalSound: on ? '' : 'off' })));
    const kept = own.keepOut ?? {}, keeps = (k) => (k === 'all' ? kept.all === true : keepsOut({ ...kept, all: false }, k));
    const named = KEEP_OUT.filter(([k]) => keeps(k)).map(([, label]) => label.toLowerCase());
    parts.push(...c.more('keep', `Keep out: ${named.length ? named.join(', ') : 'none'}`, () => {
      const chips = element('div', 'an-rp-chips');
      for (const [k, label] of KEEP_OUT) { const on = keeps(k), b = button(label, on ? 'an-rp-on' : '', () => act({ keepOut: { ...kept, [k]: !on } })); b.setAttribute('aria-pressed', String(on)); chips.append(b); }
      return [tip(chips, 'The creatures picked never come in here: a sealed room, a shrine, a garden. High fliers go round it.')];
    }));
    return parts;
  },

  look(c) {
    const { own, kind, act } = c, groundless = kind !== 'ground' && kind !== 'indoors', parts = [];
    if (groundless && kind !== 'lava') parts.push(toggle('Floor texture', c.texture(own), (on) => act({ texture: on ? 'on' : 'off' }), 'Paint the floor here, over the map.'));
    if (groundless && c.texture(own)) parts.push(styleRow(c));
    if (groundless && scaleShown(c)) parts.push(scaleRow(c));
    parts.push(row('Creatures inside', choice([['', 'None'], ...c.presets().map((n) => [n, n])], own[REGION_LOOK_FLAG] ?? '', 'Animater look', (v) => act({ [REGION_LOOK_FLAG]: v })), 'A Tokenshade look every creature inside shows, fading in as they step in: haunted ground, a forge’s warmth, deep water.'));
    if (kind !== 'lava') parts.push(...c.more('look', 'More: soft edge…', () => {
      const soft = own.stepEdgeOff !== true, out = [toggle('Soft edge', soft, (on) => act({ stepEdgeOff: !on }), "Off: the region's own hard line.")];
      if (soft) out.push(range('Softness', STEP_EDGE, stepEdge(own), (v) => v.toFixed(1), (v) => act({ stepEdge: v }), 0.1, '', 'Edge softness'));
      return out;
    }));
    // Lava has no ground section to hold its shadow (raised lava, a forge's trough): it waits here.
    if (kind === 'lava') parts.push(...c.more('look', 'More: its shadow…', () => shadowParts(c, true)));
    return parts;
  },
};
