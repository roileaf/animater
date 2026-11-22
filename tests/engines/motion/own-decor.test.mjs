import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DECOR_KINDS, DECOR_IDS, OWN_KINDS, paintDecor } from '../../../scripts/engines/motion/decor-paint.mjs';
import { createDecorations, decorHeight, pictureOf } from '../../../scripts/engines/motion/decorations.mjs';
import { decorRole, decorSettings } from '../../../scripts/engines/motion/decor-regions.mjs';
import { STANDS, standsAs } from '../../../scripts/engines/motion/tile-props.mjs';
import { artSuits, ownArtList, stampOwn, weathersAs } from '../../../scripts/engines/mapbuild/own-art.mjs';
import { prefabOf } from '../../../scripts/engines/mapbuild/decor-select.mjs';

const URL_A = 'https://assets.example.test/assets/free_assets/Storage/Barrel_Wood_Light_E_1x1.webp';

test('a picture of the GM\'s own is a kind of decoration that nothing of ours paints, scatters or lists', () => {
  assert.deepEqual([...OWN_KINDS], ['ownArt', 'ownArtFlat']);
  assert.equal(DECOR_KINDS.ownArt.flat, false); assert.equal(DECOR_KINDS.ownArtFlat.flat, true);
  for (const id of OWN_KINDS) { assert.equal(DECOR_IDS.includes(id), false, 'in no list of ours'); assert.equal(DECOR_KINDS[id].set, 'own', 'in no scatter'); assert.equal(paintDecor(id, 1, 100, {}), null, 'and never painted'); }
  assert.equal(decorRole({ kind: 'ownArt' }), 'standing'); assert.equal(decorRole({ kind: 'ownArtFlat' }), 'flat');
});

test('how a picture stands is guessed from its name', () => {
  assert.equal(standsAs('Cart_Wood_Light_Filled_A3_2x3.webp'), 'tall'); assert.equal(standsAs('Rug_Rectangle_Huge_A1_5x4.webp'), 'flat');
  assert.equal(standsAs('Sack_Olive_Leaking_Grain_A1_1x1.webp'), 'low'); assert.equal(standsAs('Barrel_Wood_Light_E_1x1.webp'), 'waist');
  assert.equal(weathersAs('decor', 'Furniture/Statue_Stone_A.webp'), 'tall'); assert.deepEqual(STANDS, { flat: 0, low: 0.3, waist: 0.6, tall: 1 });
  assert.equal(artSuits('decor', { path: 'anything at all.webp' }).ok, true); assert.equal(artSuits('decor', { path: 'x.webp', locked: true }).ok, false);
});

test('the GM\'s list keeps a decoration\'s size, within reason', () => {
  const [it] = ownArtList([{ what: 'decor', url: URL_A, name: 'Barrel Wood Light E', size: 1 }]);
  assert.equal(it.size, 1); assert.equal(it.as, 'waist');
  assert.equal(ownArtList([{ what: 'decor', url: 'a.webp', size: 400 }])[0].size, 12); assert.equal('size' in ownArtList([{ what: 'decor', url: 'a.webp' }])[0], false);
});

test('the brush lays one: its picture, its own size, how it stands, and room left for the next', () => {
  const own = { url: URL_A, size: 2, as: 'tall' }, d = stampOwn({ x: 500, y: 400, radius: 50, grid: 100, own, seed: 7 });
  assert.equal(d.kind, 'ownArt'); assert.equal(d.art, URL_A); assert.equal(d.size, 2); assert.equal(d.high, 1); assert.ok(Math.hypot(d.x - 500, d.y - 400) <= 51);
  assert.deepEqual(stampOwn({ x: 500, y: 400, radius: 50, grid: 100, own, seed: 7 }), d, 'the same every time for the same seed');
  assert.equal(stampOwn({ x: 0, y: 0, radius: 10, grid: 100, own: { ...own, as: 'flat' }, seed: 3 }).kind, 'ownArtFlat'); assert.equal(stampOwn({ x: 0, y: 0, radius: 10, grid: 100, own: { ...own, as: 'flat' }, seed: 3 }).high, 0);
  assert.equal(stampOwn({ x: 0, y: 0, radius: 10, grid: 100, own, seed: 3, scale: 0.5 }).size, 1); const turned = stampOwn({ x: 0, y: 0, radius: 10, grid: 100, own, seed: 3, turn: 1.5 }); assert.equal(turned.turn, 1.5); assert.equal(turned.fixed, true);
  // No room among what already stands there; a flat one lies anywhere.
  const crowd = [{ kind: 'ownArt', x: 0, y: 0, size: 3 }];
  assert.equal(stampOwn({ x: 0, y: 0, radius: 20, grid: 100, own, seed: 5, existing: crowd }), null); assert.ok(stampOwn({ x: 0, y: 0, radius: 20, grid: 100, own: { ...own, as: 'flat' }, seed: 5, existing: crowd }));
  assert.equal(stampOwn({ x: 0, y: 0, radius: 10, own: null }), null);
});

test('a region keeps them, a prefab keeps their picture, and their height is their own', () => {
  const d = { kind: 'ownArt', art: URL_A, x: 10, y: 20, size: 1, turn: 0, seed: 4, high: 0.3 };
  assert.deepEqual(decorSettings({ on: true, brushed: [d] }).brushed, [d]);
  assert.equal(decorHeight(d), 0.3);
  const item = prefabOf([d], 'Mine').items[0]; assert.equal(item.art, URL_A); assert.equal(item.high, 0.3); assert.equal(item.kind, 'ownArt');
  assert.match(pictureOf(d, { season: 'autumn' }).key, /^own\|.*\|autumn$/); assert.notEqual(pictureOf(d, {}).key, pictureOf({ ...d, art: 'b.webp' }, {}).key);
});

// A PIXI just big enough for the decorations, with what a lit mesh needs.
function world({ arrived = true } = {}) {
  class Container {
    constructor() { this.children = []; this.parent = null; this.alpha = 1; this.visible = true; this.rotation = 0; this.destroyed = false; this.position = { x: 0, y: 0, set(x, y) { this.x = x; this.y = y ?? x; } }; this.scale = { x: 1, y: 1, set(x, y) { this.x = x; this.y = y ?? x; } }; }
    addChild(c) { c.parent?.removeChild(c); c.parent = this; this.children.push(c); return c; }
    addChildAt(c, i) { c.parent = this; this.children.splice(i, 0, c); return c; }
    getChildIndex(c) { return this.children.indexOf(c); }
    removeChild(c) { this.children = this.children.filter((x) => x !== c); c.parent = null; return c; }
    destroy() { this.destroyed = true; }
  }
  class Sprite extends Container { constructor(texture) { super(); this.texture = texture; this.tint = 0xffffff; this.isSprite = true; this.anchor = { set() {} }; } }
  const PIXI = { Container, Sprite, Geometry: class { addAttribute() { return this; } addIndex() { return this; } }, Shader: { from: (v, f, uniforms) => ({ uniforms }) } };
  PIXI.Mesh = class extends Container { constructor(geometry, shader) { super(); this.shader = shader; this.worldAlpha = 1; } };
  const layers = { shadows: new Container(), ground: new Container(), flat: new Container() }, state = { arrived, asked: [] };
  const texture = { width: 200, height: 200, destroyed: false }, autumn = { width: 200, height: 200, destroyed: false }, maps = { width: 200, height: 200, destroyed: false };
  const ownArt = Object.assign((url, look) => { state.asked.push([url, look?.season]); return state.arrived ? { texture, art: look?.season === 'autumn' ? autumn : texture, maps: state.maps === false ? null : maps } : null; }, { state: () => (state.arrived ? 'ready' : 'loading') });
  const decorations = createDecorations({ PIXI, shadows: () => layers.shadows, ground: () => layers.ground, above: () => layers.ground, flat: () => layers.flat, grid: () => 100, ownArt });
  return { layers, decorations, state, texture, autumn, maps };
}
const AREA = [0, 0, 2000, 0, 2000, 2000, 0, 2000];
const spec = (brushed, look = {}) => ({ id: 'r1', settings: decorSettings({ on: true, density: 0, kinds: {}, brushed }), areas: [AREA], look });
const barrel = (more = {}) => ({ kind: 'ownArt', art: URL_A, x: 600, y: 500, size: 1, turn: 0, fixed: true, seed: 9, high: 0.6, ...more });

test('laid on the map it is the picture at its own size, with its foot and its shadow, lit where it has a relief', () => {
  const { layers, decorations, texture, maps } = world();
  decorations.sync([spec([barrel()])]);
  const [contact, cast] = layers.shadows.children;
  assert.equal(contact.children[0].children.length, 1, 'the dark at its foot'); assert.equal(contact.children[0].children[0].texture, texture, 'which is its own picture, made dark');
  assert.equal(cast.children[0].children.length, 1, 'and its cast shadow');
  const piece = layers.ground.children[0];
  assert.equal(piece.lit, true, 'drawn lit'); assert.equal(piece.shader.uniforms.uMaps, maps); assert.equal(piece.shader.uniforms.uShade, 0, 'only what shines');
  assert.equal(piece.position.x, 600); assert.equal(piece.scale.x, 0.5, 'a square wide: a 200 pixel picture on a 100 pixel grid');
  decorations.light({ sun: { angle: 0, length: 1, strength: 0.9 } });
  assert.ok(Math.abs(piece.shader.uniforms.uCol[3] - 0.9) < 1e-6, 'the sun reaches it'); assert.ok(cast.children[0].children[0].position.x > 600);
  decorations.lamps([{ x: 500, y: 500, radius: 600, strength: 1 }]); assert.ok(piece.shader.uniforms.uCol[7] > 0.3, 'and a torch');
});

test('without a relief it is a plain sprite, a flat one lies on the ground with no shadow, and bigger is bigger', () => {
  const w = world(); w.state.maps = false;
  w.decorations.sync([spec([barrel({ size: 3 }), { kind: 'ownArtFlat', art: URL_A, x: 900, y: 900, size: 2, turn: 0, seed: 2, high: 0 }], { wet: 1 })]);
  const piece = w.layers.ground.children.find((c) => c.isSprite);
  assert.equal(piece.lit, undefined); assert.equal(piece.scale.x, 1.5); assert.ok(piece.tint < 0xffffff, 'rain darkens it');
  assert.equal(w.layers.flat.children.length, 1, 'the rug on the ground'); assert.equal(w.layers.shadows.children[0].children[0].children.length, 1, 'one foot: the barrel\'s alone');
});

test('a picture still on its way leaves its place empty, and the region is drawn again when it arrives', () => {
  const w = world({ arrived: false });
  w.decorations.sync([spec([barrel()])]);
  assert.equal(w.layers.ground.children.length, 0);
  w.decorations.sync([spec([barrel()])]); assert.equal(w.layers.ground.children.length, 0, 'still waiting, nothing new');
  w.state.arrived = true; w.decorations.sync([spec([barrel()])]);
  assert.equal(w.layers.ground.children.length, 1, 'there now');
});

test('the season is asked of the picture, so a bush of the GM\'s turns with the year', () => {
  const w = world(); w.decorations.sync([spec([barrel()], { season: 'autumn' })]);
  assert.equal(w.layers.ground.children[0].shader.uniforms.uArt, w.autumn); assert.equal(w.layers.shadows.children[0].children[0].children[0].texture, w.texture, 'its shadow is still its own outline');
  assert.ok(w.state.asked.some(([, season]) => season === 'autumn'));
});

test('main, the bar and the brush carry it', () => {
  const read = (p) => readFileSync(new URL(`../../../scripts/${p}`, import.meta.url), 'utf8'), main = read('main.mjs'), bar = read('ui/decor-brush-bar.mjs'), shell = read('shell/map-painting.mjs');
  assert.match(main, /createDecorations\(\{ PIXI: globalThis\.PIXI, ownArt: ownDecorArt,/); assert.match(main, /art: tileInSeason\(texture, look\?\.season\) \?\? texture, maps: relief\?\.animaterShines \? relief : null/);
  assert.ok(bar.includes("ownTiles('decor', 'ownDecor')")); assert.ok(bar.includes("seg('Stands', [['flat', 'Flat'], ['low', 'Low'], ['waist', 'Waist'], ['tall', 'Tall']]")); assert.ok(bar.includes('ownDecor: remembered.ownDecor?.url ? remembered.ownDecor : null'));
  assert.equal(bar.split('remembered.ownDecor = null;').length - 1, 2, 'picking one of ours lets the GM\'s go');
  assert.ok(shell.includes('const stampAny = (given) => (given.own ? stampOwn(given) : stampDecor(given));')); assert.equal(shell.split('stampAny({ own').length - 1, 2, 'the ghost and the dab alike');
});
