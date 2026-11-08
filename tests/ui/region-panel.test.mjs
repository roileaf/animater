import test from 'node:test';
import assert from 'node:assert/strict';
import { kindFlags } from '../../scripts/ui/region-panel-model.mjs';
import { waterKindFlags, changeStep, caveKindFlags } from '../../scripts/engines/motion/region-steps.mjs';

// A small DOM, just enough to build the panel and click through it: elements with children, attributes and listeners.
function installDom() {
  const saved = { document: globalThis.document, window: globalThis.window };
  const docListeners = [];
  const make = (tag) => ({
    tagName: tag.toUpperCase(), className: '', textContent: '', children: [], attrs: {}, listeners: {}, style: {}, parent: null, value: '', type: '',
    append(...kids) { for (const k of kids) { if (typeof k !== 'object') continue; k.parent = this; this.children.push(k); } },
    replaceChildren(...kids) { this.children = []; this.append(...kids); },
    remove() { if (this.parent) this.parent.children = this.parent.children.filter((c) => c !== this); this.parent = null; },
    contains(t) { for (let n = t; n; n = n.parent) if (n === this) return true; return false; },
    setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return this.attrs[k] ?? null; },
    addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); },
    getBoundingClientRect: () => ({ width: 312, height: 400 }),
  });
  const body = make('body');
  globalThis.document = {
    createElement: make, body,
    addEventListener: (type, fn) => docListeners.push({ type, fn }),
    removeEventListener: (type, fn) => { const i = docListeners.findIndex((l) => l.type === type && l.fn === fn); if (i >= 0) docListeners.splice(i, 1); },
  };
  globalThis.window = { innerWidth: 1200, innerHeight: 800 };
  const fireDoc = (type, event) => { for (const l of docListeners.filter((x) => x.type === type)) l.fn({ stopPropagation() {}, preventDefault() {}, ...event }); };
  return { body, docListeners, fireDoc, restore() { globalThis.document = saved.document; globalThis.window = saved.window; } };
}
const walk = function* (n) { yield n; for (const c of n.children ?? []) yield* walk(c); };
const textOf = (n) => [...walk(n)].map((x) => x.textContent).join('');
const fire = (n, type, extra = {}) => { const e = { target: n, defaultPrevented: false, preventDefault() { e.defaultPrevented = true; }, stopPropagation() {}, ...extra }; for (const fn of n.listeners[type] ?? []) fn(e); return e; };
const tick = () => new Promise((r) => setTimeout(r, 0));

// Opens the panel on one region; `saves` records every save, and flagsOf follows them unless `stick` keeps the region as it was.
async function setup(start = {}, floor = 'grass', { reject = false, stick = false, texture = () => false, season = () => false, hold = false, what = null, flagsOf = null, confirm = null, configure = null, shows = null } = {}) {
  const dom = installDom();
  const { createRegionPanel } = await import('../../scripts/ui/region-panel.mjs');
  const doc = { name: 'Mill pond' };
  let own = structuredClone(start), reads = 0;
  const saves = [], edits = [], held = [];
  const panel = createRegionPanel({
    flagsOf: flagsOf ?? (() => { reads++; return own; }),
    save: (d, flags) => {
      saves.push(flags); if (reject) return Promise.reject(new Error('no'));
      // Saved as Foundry saves: `-=key` deletes that key.
      const take = () => { if (stick) return; own = { ...own }; for (const [k, v] of Object.entries(flags)) { if (k.startsWith('-=')) delete own[k.slice(2)]; else own[k] = v; } };
      if (hold) return new Promise((resolve) => held.push(() => { take(); resolve(); }));
      take(); return Promise.resolve();
    },
    edit: (d) => edits.push(d), texture, season,
    presets: () => ['Haunted', 'Forge'], weathers: () => [['fog', 'Fog'], ['rain', 'Rain']],
    ...(confirm ? { confirm } : {}),
    ...(configure ? { configure } : {}),
    ...(shows ? { shows } : {}),
  });
  panel.open(what ?? { doc, floor, at: { x: 5, y: 6 }, client: { x: 10, y: 10 }, regions: [{ doc, floor }], first: doc });
  const root = () => dom.body.children[0];
  const find = (pred) => [...walk(root())].find(pred) ?? null;
  const byLabel = (label) => find((n) => n.attrs['aria-label'] === label);
  const section = (id) => find((n) => n.attrs['data-section'] === id);
  const openSection = (id) => { const s = section(id); assert.ok(s, `section ${id} shown`); if (s.attrs['data-open'] !== 'true') fire(s.children[0], 'click'); return section(id); };
  const button = (text, within = root()) => [...walk(within)].find((n) => n.tagName === 'BUTTON' && textOf(n).trim() === text) ?? null;
  const pick = async (n, value) => { n.value = String(value); fire(n, 'change'); await tick(); };
  const click = async (n) => { assert.ok(n, 'control shown'); fire(n, 'click'); await tick(); };
  const more = async (id) => click([...walk(section(id))].find((n) => n.className?.includes('an-rp-more') && n.attrs['aria-expanded'] === 'false'));
  return { dom, panel, doc, saves, edits, held, root, find, byLabel, section, openSection, button, pick, click, more, own: () => own, reads: () => reads, done: () => { panel.close(); dom.restore(); } };
}

// Roi: a None choice for regions Animater leaves alone.
test('a region with no Animater settings opens on None, saying so, with no sections', async () => {
  const t = await setup({}, 'grass');
  assert.equal(t.byLabel('None').attrs['aria-pressed'], 'true');
  assert.match(textOf(t.root()), /Animater does nothing in this region/);
  assert.equal(t.find((n) => n.attrs['data-section']), null);
  await t.click(t.byLabel('Ground'));
  assert.equal(t.byLabel('Ground').attrs['aria-pressed'], 'true', 'picking a kind brings it back');
  t.done();
});

test('None asks first, then takes every Animater setting off the region', async () => {
  const asked = [];
  let answer = false;
  const t = await setup({ floor: 'stone', drips: true }, 'stone', { confirm: async (text) => { asked.push(text); return answer; } });
  await t.click(t.byLabel('None')); await tick();
  assert.equal(asked.length, 1); assert.deepEqual(t.saves, [], 'said no: nothing saved');
  answer = true;
  await t.click(t.byLabel('None')); await tick(); await tick();
  assert.deepEqual(t.saves, [{ '-=floor': null, '-=drips': null }]);
  assert.deepEqual(t.own(), {}); assert.equal(t.byLabel('None').attrs['aria-pressed'], 'true');
  t.done();
});

// Roi: let the panel be moved about the screen.
test('the panel moves by its heading and stays where it is put', async () => {
  const t = await setup({ floor: 'grass' }, 'grass');
  const head = t.find((n) => n.className === 'an-rp-head');
  const left0 = parseFloat(t.root().style.left), top0 = parseFloat(t.root().style.top);
  fire(head, 'pointerdown', { clientX: 100, clientY: 50, button: 0 });
  t.dom.fireDoc('pointermove', { clientX: 160, clientY: 90 });
  t.dom.fireDoc('pointerup', { clientX: 160, clientY: 90 });
  assert.equal(parseFloat(t.root().style.left), left0 + 60); assert.equal(parseFloat(t.root().style.top), top0 + 40);
  await t.click(t.byLabel('Water'));
  assert.equal(parseFloat(t.root().style.left), left0 + 60, 'a redraw keeps it there');
  t.dom.fireDoc('pointermove', { clientX: 400, clientY: 400 });
  assert.equal(parseFloat(t.root().style.left), left0 + 60, 'let go, it no longer follows');
  t.done();
});

test('clicking a kind saves what makes the region that kind', async () => {
  const t = await setup({ floor: 'grass' }, 'grass');
  await t.click(t.byLabel('Water'));
  assert.deepEqual(t.saves, [kindFlags('water', { floor: 'grass' })]);
  assert.equal(t.byLabel('Water').attrs['aria-pressed'], 'true', 'now drawn as water');
  assert.ok(t.section('water'), 'with the water section');
  t.done();
});

test('a section title folds it open and shut without saving', async () => {
  const t = await setup({ floor: 'grass' }, 'grass');
  assert.equal(t.section('ground').attrs['data-open'], 'true', 'the first section starts open');
  assert.equal(t.section('steps').children.length, 1, 'a folded section has no body built');
  t.openSection('steps');
  assert.equal(t.section('steps').attrs['data-open'], 'true');
  assert.equal(t.section('steps').children.length, 2);
  fire(t.section('steps').children[0], 'click');
  assert.equal(t.section('steps').attrs['data-open'], 'false');
  assert.deepEqual(t.saves, []);
  t.done();
});

// Found going over the panel: turning drips off shut its section, or took it away, under the pointer.
test('a section being changed stays shown and open, until it is folded or the kind changes', async () => {
  const t = await setup({ floor: 'stone', indoors: true, drips: true }, 'stone');
  t.openSection('drips');
  await t.click(t.byLabel('Drips from the ceiling'));
  assert.equal(t.own().drips, false);
  assert.ok(t.section('drips'), 'still there'); assert.equal(t.section('drips').attrs['data-open'], 'true', 'and open');
  await t.click(t.byLabel('Drips from the ceiling'));
  assert.equal(t.own().drips, true, 'turned back on from the same place');
  t.done();
});

// Roi: a button by the X for Foundry's own region configuration.
test('the cog by the close button opens Foundry\'s region configuration and closes the panel', async () => {
  const opened = [];
  const t = await setup({ floor: 'grass' }, 'grass', { configure: (d) => opened.push(d) });
  await t.click(t.byLabel('Region configuration'));
  assert.deepEqual(opened, [t.doc]); assert.equal(t.panel.isOpen, false);
  t.done();
  const plain = await setup({ floor: 'grass' }, 'grass');
  assert.equal(plain.byLabel('Region configuration'), null, 'none without a way to open it');
  plain.done();
});

// Roi: outline the region right-clicked.
test('the panel says which region it shows, to outline it, and nothing once closed', async () => {
  const told = [];
  const t = await setup({ floor: 'grass' }, 'grass', { shows: (d) => told.push(d) });
  assert.deepEqual(told, [t.doc], 'once, on opening');
  await t.click(t.byLabel('Water'));
  assert.deepEqual(told, [t.doc], 'a redraw of the same region tells nothing new');
  t.panel.close();
  assert.deepEqual(told, [t.doc, null]);
  t.done();
});

test('an animal card counts one more on a click and one fewer on a right-click, its number on it', async () => {
  const t = await setup({ floor: 'grass' }, 'grass');
  t.openSection('animals');
  await t.click(t.find((n) => n.attrs['aria-label']?.startsWith('Cows')));
  assert.deepEqual(t.saves.at(-1), { regionAnimals: { cows: '1' } });
  const card = t.find((n) => n.attrs['aria-label']?.startsWith('Cows'));
  assert.match(card.attrs['aria-label'], /: 1$/);
  assert.equal(card.children.at(-1).text ?? card.children.at(-1).textContent, '1', 'its number shows');
  const e = fire(card, 'contextmenu'); await tick();
  assert.equal(e.defaultPrevented, true, 'no browser menu');
  assert.deepEqual(t.saves.at(-1), { regionAnimals: { cows: '0' } });
  t.done();
});

test('a right-click keeps the other animals as they are', async () => {
  const t = await setup({ floor: 'grass', regionAnimals: { cows: 'few', sheep: 'usual' } }, 'grass');
  assert.equal(t.section('animals').attrs['data-open'], 'true', 'a field with animals opens on them');
  fire(t.find((n) => n.attrs['aria-label']?.startsWith('Cows')), 'contextmenu'); await tick();
  assert.deepEqual(t.saves.at(-1), { regionAnimals: { cows: '1', sheep: 'usual' } }, 'a few cows were 2: one fewer is 1, the sheep untouched');
  t.done();
});

test('the animals size slider saves a number', async () => {
  const t = await setup({ floor: 'grass' }, 'grass');
  t.openSection('animals');
  const slider = t.byLabel('Their size');
  assert.equal(slider.min, '0.5'); assert.equal(slider.max, '2'); assert.equal(slider.step, '0.05');
  await t.pick(slider, 1.4);
  assert.deepEqual(t.saves.at(-1), { regionAnimalSize: 1.4 });
  t.done();
});

test('animal sounds and keep out save their flags', async () => {
  const t = await setup({ floor: 'grass' }, 'grass');
  t.openSection('animals');
  await t.click(t.byLabel('Animal sounds'));
  assert.deepEqual(t.saves.at(-1), { animalSound: 'off' });
  await t.click(t.find((n) => n.className === 'an-rp-more' && textOf(n) === 'Keep out: none'));
  await t.click(t.button('Wolves', t.find((n) => n.className === 'an-rp-chips')));
  assert.deepEqual(t.saves.at(-1), { keepOut: { wolves: true } });
  t.done();
});

test('a save that fails redraws the panel from the region as it is', async () => {
  const t = await setup({ floor: 'water' }, 'water', { reject: true });
  const before = t.reads();
  await t.click(t.byLabel('Reflections'));
  assert.deepEqual(t.saves, [{ reflections: 'off' }]);
  assert.ok(t.reads() > before, 'read the flags again');
  assert.equal(t.byLabel('Reflections').attrs['aria-checked'], 'true', 'still shows reflections on');
  t.done();
});

test('Escape closes the panel', async () => {
  const t = await setup({ floor: 'grass' }, 'grass');
  assert.equal(t.panel.isOpen, true);
  t.dom.fireDoc('keydown', { key: 'Escape' });
  assert.equal(t.panel.isOpen, false);
  assert.equal(t.dom.body.children.length, 0);
  assert.equal(t.dom.docListeners.length, 0, 'its listeners go with it');
  t.dom.restore();
});

test('the close button and a click outside close it too', async () => {
  const t = await setup({ floor: 'grass' }, 'grass');
  await t.click(t.byLabel('Close'));
  assert.equal(t.panel.isOpen, false);
  t.dom.restore();
  const u = await setup({ floor: 'grass' }, 'grass');
  u.dom.fireDoc('pointerdown', { target: u.byLabel('Water') });
  assert.equal(u.panel.isOpen, true, 'a click inside keeps it');
  u.dom.fireDoc('pointerdown', { target: {} });
  assert.equal(u.panel.isOpen, false);
  u.dom.restore();
});

test('water: its kind, way, depth, reflections, freezing and sound', async () => {
  const t = await setup({ floor: 'water' }, 'water');
  await t.click(t.button('River', t.byLabel('Kind of water')));
  assert.deepEqual(t.saves.at(-1), waterKindFlags({ floor: 'water' }, 'river'));
  await t.click(t.byLabel('North'));
  assert.deepEqual(t.saves.at(-1), { flowTo: 'n' });
  await t.click(t.button('Swift', t.byLabel('Current')));
  assert.deepEqual(t.saves.at(-1), { current: 'swift' });
  await t.pick(t.byLabel('How deep the water is'), 'deep');
  assert.deepEqual(t.saves.at(-1), { waterDepth: 'deep' });
  await t.click(t.byLabel('Reflections'));
  assert.deepEqual(t.saves.at(-1), { reflections: 'off' });
  await t.click(t.byLabel('Freezes in the cold'));
  assert.deepEqual(t.saves.at(-1), { noFreeze: true });
  await t.click(t.byLabel('Water sound'));
  assert.deepEqual(t.saves.at(-1), { regionSound: 'off' });
  t.done();
});

test('water: the sea has its waves and beach, and drips, coast and waterfall fold under More', async () => {
  const t = await setup({ floor: 'water', waterKind: 'sea' }, 'water');
  await t.click(t.byLabel('Waves toward').children.find((b) => b.attrs['aria-label'] === 'East'));
  assert.deepEqual(t.saves.at(-1), { waveTo: 'e' });
  await t.click(t.byLabel('Beach along the shore'));
  assert.deepEqual(t.saves.at(-1), { seaBeach: 'off' });
  assert.equal(t.byLabel('Drips from the ceiling'), null, 'folded away');
  await t.more('water');
  await t.click(t.byLabel('Drips from the ceiling'));
  assert.deepEqual(t.saves.at(-1), { drips: true });
  await t.click(t.byLabel('Coast waves and tide'));
  assert.deepEqual(t.saves.at(-1), { sea: true });
  await t.click(t.byLabel('Waterfall spray'));
  assert.deepEqual(t.saves.at(-1), { waterfall: true });
  t.done();
});

test('no Moving water switch anywhere', async () => {
  const t = await setup({ floor: 'water' }, 'water');
  for (const id of ['water', 'steps', 'animals', 'air', 'look']) t.openSection(id);
  await t.more('water');
  assert.equal(t.find((n) => /moving water/i.test(n.textContent) || /moving water/i.test(n.attrs['aria-label'] ?? '')), null);
  t.done();
});

test('ground: its floor, seasons, texture and pattern size', async () => {
  const t = await setup({ floor: 'grass' }, 'grass', { texture: (own) => own.texture === 'on' });
  await t.pick(t.byLabel('Floor'), 'sand');
  assert.deepEqual(t.saves.at(-1), { floor: 'sand' });
  await t.pick(t.byLabel('Floor'), 'grass');
  await t.click(t.byLabel('Changes with the seasons'));
  assert.deepEqual(t.saves.at(-1), { season: 'on' });
  await t.click(t.byLabel('Floor texture'));
  assert.deepEqual(t.saves.at(-1), { texture: 'on' });
  await t.pick(t.byLabel('Pattern size'), 1.5);
  assert.deepEqual(t.saves.at(-1), { stepScale: 1.5 });
  await t.pick(t.byLabel('Texture style'), 'clover');
  assert.deepEqual(t.saves.at(-1), { textureStyles: { grass: 'clover' } });
  t.done();
});

test('air: weather, climate, tavern, openings and the edge', async () => {
  const t = await setup({ floor: 'wood', indoors: true }, 'wood');
  t.openSection('air');
  await t.pick(t.byLabel('Weather here'), 'fog');
  assert.deepEqual(t.saves.at(-1), { regionWeather: 'fog' });
  await t.click(t.button('Cold', t.byLabel('Climate here')));
  assert.deepEqual(t.saves.at(-1), { cold: 'cold' });
  await t.click(t.byLabel('Tavern murmur'));
  assert.deepEqual(t.saves.at(-1), { tavern: true });
  await t.click(t.byLabel('Opens to the outside'));
  assert.deepEqual(t.saves.at(-1), { opensOutside: true });
  await t.click(t.byLabel('Open to the sky'));
  assert.deepEqual(t.saves.at(-1), { openSky: true });
  await t.pick(t.byLabel('Window in it'), 'rose');
  assert.deepEqual(t.saves.at(-1), { skyWindow: 'rose' });
  await t.pick(t.byLabel('Window pattern size'), 1.25);
  assert.deepEqual(t.saves.at(-1), { skyPattern: 1.25 });
  await t.more('air');
  await t.pick(t.byLabel('Weather edge'), 1.2);
  assert.deepEqual(t.saves.at(-1), { indoorEdge: 1.2 });
  t.done();
});

test('cave: what it holds, and its drips with their pace and pool', async () => {
  const t = await setup({ cavern: 'fungus-green' }, 'cavern');
  await t.click(t.button('Crystals', t.byLabel("What's here")));
  assert.deepEqual(t.saves.at(-1), caveKindFlags({ cavern: 'fungus-green' }, 'crystals'));
  await t.click(t.button('Rose', t.byLabel('Stone')));
  assert.deepEqual(t.saves.at(-1), { cavern: 'crystals-rose' });
  t.openSection('drips');
  await t.click(t.byLabel('Drips from the ceiling'));
  assert.deepEqual(t.saves.at(-1), { drips: true });
  await t.click(t.button('Fast', t.byLabel('Drip pace')));
  assert.deepEqual(t.saves.at(-1), { dripPace: 'fast' });
  await t.click(t.button('Pool', t.byLabel('Pool depth')));
  assert.deepEqual(t.saves.at(-1), { dripDepth: 'pool' });
  await t.click(t.byLabel('Dripping sound'));
  assert.deepEqual(t.saves.at(-1), { regionSound: 'off' });
  t.done();
});

test('dock: how it is built, its posts and its shadow', async () => {
  const t = await setup({ floor: 'wood', overWater: true }, 'wood');
  await t.click(t.button('Old boards', t.byLabel('Built as')));
  assert.deepEqual(t.saves.at(-1), { dockStyle: 'old' });
  await t.click(t.byLabel('Posts'));
  assert.deepEqual(t.saves.at(-1), { overPosts: false });
  await t.pick(t.byLabel('Its shadow'), 'slats');
  assert.deepEqual(t.saves.at(-1), { overShadows: { wood: 'slats' } });
  await t.more('deck');
  await t.pick(t.byLabel('Shadow softness'), 0.3);
  assert.deepEqual(t.saves.at(-1), { overShadowSoft: 0.3 });
  await t.pick(t.byLabel('Shadow darkness'), 0.6);
  assert.deepEqual(t.saves.at(-1), { overShadowDark: 0.6 });
  await t.click(t.byLabel('Casts a shadow'));
  assert.deepEqual(t.saves.at(-1), { castShadow: false });
  t.done();
});

test('steps: a chip moves to that step, and Edit steps opens the list', async () => {
  const t = await setup({ floor: 'water' }, 'water');
  t.openSection('steps');
  const chips = t.find((n) => n.className === 'an-rp-steps');
  const second = chips.children[1];
  await t.click(second);
  assert.deepEqual(t.saves.at(-1), changeStep({ floor: 'water' }, 'water', 1, { x: 5, y: 6 }));
  await t.click(t.button('Edit steps…'));
  assert.equal(t.edits.length, 1);
  assert.equal(t.panel.isOpen, false, 'the panel makes way for the list');
  t.dom.restore();
});

test('look: the creatures inside wear a Tokenshade look', async () => {
  const t = await setup({ floor: 'water' }, 'water');
  t.openSection('look');
  await t.pick(t.byLabel('Animater look'), 'Haunted');
  assert.deepEqual(t.saves.at(-1), { tokenshade: 'Haunted' });
  await t.click(t.byLabel('Floor texture'));
  assert.deepEqual(t.saves.at(-1), { texture: 'on' });
  await t.more('look');
  await t.click(t.byLabel('Soft edge'));
  assert.deepEqual(t.saves.at(-1), { stepEdgeOff: true });
  t.done();
});

test('switching kind to lava from a cave follows the new floor', async () => {
  const t = await setup({ cavern: 'fungus-green' }, 'cavern');
  await t.click(t.button('Lava', t.byLabel("What's here")));
  assert.equal(t.byLabel('Lava').attrs['aria-pressed'], 'true', 'drawn as lava now');
  t.done();
});

test('Indoors to Ground through the panel: the room stops being indoors', async () => {
  const t = await setup({ floor: 'wood', indoors: true }, 'wood');
  assert.equal(t.byLabel('Indoors').attrs['aria-pressed'], 'true');
  await t.click(t.byLabel('Ground'));
  assert.equal(t.saves.at(-1).indoors, false);
  assert.equal(t.byLabel('Ground').attrs['aria-pressed'], 'true', 'drawn as ground now');
  t.done();
});

test('Cave to Water through the panel: its decor goes', async () => {
  const t = await setup({ cavern: 'fungus-green' }, 'cavern');
  await t.click(t.byLabel('Water'));
  assert.equal(t.saves.at(-1).cavern, '');
  assert.equal(t.byLabel('Water').attrs['aria-pressed'], 'true');
  assert.ok(t.section('water'));
  t.done();
});

test('Lava to Cave through the panel: a cave, with fungus, and no floor saved', async () => {
  const t = await setup({ floor: 'lava' }, 'lava');
  await t.click(t.byLabel('Cave'));
  assert.equal(t.saves.at(-1).floor, '');
  assert.equal(t.saves.at(-1).cavern, 'fungus-green');
  assert.equal(t.byLabel('Cave').attrs['aria-pressed'], 'true');
  t.done();
});

test('a refused kind change leaves the panel on the old kind', async () => {
  const t = await setup({ floor: 'grass' }, 'grass', { reject: true });
  await t.click(t.byLabel('Water'));
  assert.equal(t.saves.length, 1);
  assert.equal(t.byLabel('Ground').attrs['aria-pressed'], 'true', 'still ground');
  assert.equal(t.section('water'), null);
  await t.pick(t.byLabel('Floor'), 'sand');
  assert.match(t.section('ground').children[0].children[2].textContent, /^Grass/, 'a refused floor keeps the old floor too');
  t.done();
});

test('ground and indoors keep the shadow controls under More', async () => {
  for (const [own, floor] of [[{ floor: 'stone' }, 'stone'], [{ floor: 'wood', indoors: true }, 'wood']]) {
    const t = await setup(own, floor);
    assert.equal(t.byLabel('Casts a shadow'), null, 'folded away');
    await t.more('ground');
    await t.click(t.byLabel('Casts a shadow'));
    assert.deepEqual(t.saves.at(-1), { castShadow: true });
    const last = t.byLabel('Its shadow').children.at(-1).value;
    await t.pick(t.byLabel('Its shadow'), last);
    assert.deepEqual(t.saves.at(-1), { overShadows: { [floor]: last } });
    await t.pick(t.byLabel('Shadow darkness'), 0.6);
    assert.deepEqual(t.saves.at(-1), { overShadowDark: 0.6 });
    await t.pick(t.byLabel('Shadow softness'), 0.2);
    assert.deepEqual(t.saves.at(-1), { overShadowSoft: 0.2 });
    t.done();
  }
});

test('the ground floor list leads with "From the scene", which saves no floor and stays Ground', async () => {
  // (Ground with its animals: with nothing else set, a floor from the scene is a region Animater leaves alone, None.)
  const t = await setup({ floor: 'stone', regionAnimals: { cows: 'usual' } }, 'stone');
  t.openSection('ground');
  const values = t.byLabel('Floor').children.map((o) => o.value);
  assert.equal(values[0], '');
  assert.ok(values.includes('grass') && values.includes('stone'));
  await t.pick(t.byLabel('Floor'), '');
  assert.deepEqual(t.saves.at(-1), { floor: '' });
  assert.equal(t.byLabel('Ground').attrs['aria-pressed'], 'true', 'still ground');
  assert.equal(t.byLabel('Floor').children.find((o) => o.selected)?.value, '', 'showing From the scene');
  t.done();
});

test('a floor the list does not name still shows as chosen', async () => {
  const t = await setup({ floor: 'none' }, null);
  assert.equal(t.byLabel('Floor').children.find((o) => o.selected)?.value, 'none');
  t.done();
});

test('a region with no floor and regions sharing a name open with their tabs, without throwing', async () => {
  const a = { name: '' }, b = { name: 'Hall' }, c = { name: 'Hall' };
  const t = await setup({}, undefined, { what: { doc: a, first: a, floor: undefined, at: { x: 1, y: 1 }, client: { x: 1, y: 1 }, regions: [{ doc: a, floor: undefined }, { doc: b, floor: undefined }, { doc: c }] } });
  assert.equal(t.panel.isOpen, true);
  const tabs = [...walk(t.root())].filter((n) => n.attrs.role === 'tab');
  assert.equal(tabs.length, 3);
  assert.ok(tabs.every((n) => !/undefined/.test(textOf(n))), tabs.map(textOf).join(' | '));
  assert.ok(!/undefined/.test(textOf(t.root())));
  const second = textOf(tabs[1]);
  await t.click(tabs[1]);
  assert.equal(textOf([...walk(t.root())].find((n) => n.attrs.role === 'tab' && n.attrs['aria-selected'] === 'true')), second, 'another tab opens');
  t.done();
});

test('a panel that cannot be drawn leaves nothing behind', async () => {
  const warn = console.warn; console.warn = () => {};
  try {
    const t = await setup({}, 'grass', { flagsOf: () => { throw new Error('broken'); } });
    assert.equal(t.panel.isOpen, false);
    assert.equal(t.dom.body.children.length, 0);
    assert.equal(t.dom.docListeners.length, 0);
    t.dom.restore();
  } finally { console.warn = warn; }
});

test('a floorless region: its shadow, steps and summaries all go by the same floor', async () => {
  const t = await setup({ regionWeather: 'fog' }, undefined);
  assert.equal(t.byLabel('Ground').attrs['aria-pressed'], 'true');
  assert.equal(t.byLabel('Floor').children.find((o) => o.selected)?.value, '');
  await t.more('ground');
  await t.click(t.byLabel('Casts a shadow'));
  const last = t.byLabel('Its shadow').children.at(-1).value;
  await t.pick(t.byLabel('Its shadow'), last);
  assert.deepEqual(t.saves.at(-1), { overShadows: { grass: last } });
  assert.ok(!('undefined' in (t.saves.at(-1).overShadows ?? {})));
  t.openSection('steps');
  const chips = t.find((n) => n.className === 'an-rp-steps'), on = chips.children.find((b) => b.className === 'an-rp-on');
  const summary = t.section('steps').children[0].children[2].textContent;
  assert.ok(summary.startsWith(textOf(on)), `${summary} / ${textOf(on)}`);
  assert.equal(summary.match(/of (\d+)\)/)[1], String(chips.children.length));
  t.done();
});

test('a failed save warns', async () => {
  const warn = console.warn, said = [];
  console.warn = (...a) => said.push(a);
  try {
    const t = await setup({ floor: 'water' }, 'water', { reject: true });
    await t.click(t.byLabel('Reflections'));
    assert.equal(said.length, 1);
    assert.equal(said[0][0], 'Animater | region panel save');
    t.done();
  } finally { console.warn = warn; }
});

test('animal cards wait for the save before taking another click', async () => {
  const t = await setup({ floor: 'grass' }, 'grass', { hold: true });
  t.openSection('animals');
  const cows = () => t.find((n) => n.attrs['aria-label']?.startsWith('Cows'));
  fire(cows(), 'click'); fire(cows(), 'click'); await tick();
  assert.equal(t.saves.length, 1, 'the second click came while the first was saving');
  t.held.shift()(); await tick();
  fire(cows(), 'click'); await tick();
  assert.deepEqual(t.saves.at(-1), { regionAnimals: { cows: '2' } });
  t.held.shift()(); await tick();
  t.done();
});

test('settings a region uses show whatever its kind: a dock with weather, a stone room with drips', async () => {
  const t = await setup({ floor: 'wood', overWater: true, regionWeather: 'fog' }, 'wood');
  assert.ok(t.section('air'), 'a dock shows Air when it has its own weather');
  t.done();
  const u = await setup({ floor: 'stone', drips: true }, 'stone');
  assert.ok(u.section('drips'), 'a stone room with drips shows Drips');
  u.done();
});

test('Cave offers Look through More sections', async () => {
  const t = await setup({ cavern: 'mist' }, 'cavern');
  assert.equal(t.section('look'), null);
  const line = t.find((n) => n.className === 'an-rp-more' && textOf(n) === 'More sections');
  await t.click(line);
  await t.click(t.button('Look', t.find((n) => n.className?.includes('an-rp-add'))));
  assert.ok(t.section('look'), 'added');
  assert.equal(t.section('look').attrs['data-open'], 'true', 'and open');
  await t.pick(t.byLabel('Animater look'), 'Haunted');
  assert.deepEqual(t.saves.at(-1), { tokenshade: 'Haunted' });
  assert.ok(t.section('look'), 'still there once set');
  t.done();
});

test('a stone room with cobwebs is ground, keeps them on clicking Indoors, and sets them under Air', async () => {
  const t = await setup({ floor: 'stone', cavern: 'webs' }, 'stone');
  assert.equal(t.byLabel('Ground').attrs['aria-pressed'], 'true');
  t.openSection('air');
  await t.more('air');
  await t.pick(t.byLabel('Room dressing'), 'steam');
  assert.deepEqual(t.saves.at(-1), { cavern: 'steam' });
  await t.click(t.byLabel('Indoors'));
  assert.ok(!('cavern' in t.saves.at(-1)));
  assert.equal(t.saves.at(-1).floor, 'stone');
  assert.equal(t.byLabel('Indoors').attrs['aria-pressed'], 'true');
  t.done();
});

test('a drip pool on stone is ground, and Ground and Indoors still switch', async () => {
  const t = await setup({ floor: 'stone', drips: true, dripDepth: 'pool' }, 'stone');
  assert.equal(t.byLabel('Ground').attrs['aria-pressed'], 'true');
  await t.click(t.byLabel('Indoors'));
  assert.equal(t.byLabel('Indoors').attrs['aria-pressed'], 'true');
  await t.click(t.byLabel('Ground'));
  assert.equal(t.byLabel('Ground').attrs['aria-pressed'], 'true');
  t.done();
});

test('the tavern murmur is there on any kind', async () => {
  const t = await setup({ floor: 'wood', overWater: true, tavern: true }, 'wood');
  t.openSection('air');
  await t.click(t.byLabel('Tavern murmur'));
  assert.deepEqual(t.saves.at(-1), { tavern: false });
  t.done();
});

test('long explanations are tooltips, not paragraphs', async () => {
  const t = await setup({ floor: 'water' }, 'water');
  for (const id of ['water', 'steps', 'animals', 'air', 'look']) t.openSection(id);
  assert.equal(t.find((n) => n.tagName === 'P'), null);
  assert.ok(t.find((n) => n.attrs['data-tooltip']), 'some tooltips');
  t.done();
});

test('Over water says in so many words what Dock means: on from Ground builds it out over the water, off from Dock brings it back to Ground', async () => {
  const t = await setup({ floor: 'wood' }, 'wood');
  t.openSection('ground');
  await t.click(t.byLabel('Over water'));
  assert.equal(t.saves.at(-1).overWater, true);
  assert.equal(t.saves.at(-1).floor, 'wood', 'its floor kept');
  t.done();
  const d = await setup({ floor: 'wood', overWater: true }, 'wood');
  d.openSection('deck');
  await d.click(d.byLabel('Over water'));
  assert.equal(d.saves.at(-1).overWater, false);
  assert.equal(d.saves.at(-1).floor, 'wood');
  d.done();
});
