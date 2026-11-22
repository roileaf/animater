import test from 'node:test';
import assert from 'node:assert/strict';
import { dressChoices, dressOn, dressPlan, DRESS_SLOTS } from '../../../scripts/engines/mapbuild/map-dress.mjs';
import { planDocuments } from '../../../scripts/engines/mapbuild/map-plan.mjs';
import { buildPlan } from '../../../scripts/engines/mapbuild/map-presets.mjs';
import { dressHtml, dressFrom, mapBuilderHtml } from '../../../scripts/shell/map-builder.mjs';

const BRICK = 'fa/Wall_Brick_Path.webp', STONE = 'fa/Wall_Stone_Path.webp', TILE = 'fa/Roof_Tile_Red.webp', SLATE = 'fa/Roof_Slate.webp', DOOR = 'fa/Door_Wood.webp', WIN = 'fa/Window_Gray.webp', COBBLE = 'fa/Cobble.jpg';
const pools = { wall: [{ url: BRICK, as: 'brick' }, { url: STONE, as: 'dressed' }], roof: [{ url: TILE, as: 'tile' }, { url: SLATE, as: 'slate' }], door: [{ url: DOOR, as: '' }], window: [{ url: WIN, as: 'glassWindow' }], ground: [{ url: COBBLE, as: 'street' }] };
const noOurs = Object.fromEntries(DRESS_SLOTS.map((s) => [s, false]));
const house = (id, material, more = {}) => ({ id, x: 0, y: 0, w: 400, h: 300, material, doors: [{ side: 's', from: 100, to: 200 }], windows: [{ side: 'n', from: 100, to: 200 }], roof: {}, ...more });
const plan = (buildings, more = {}) => ({ seed: 5, x: 0, y: 0, width: 3000, height: 2000, buildings, things: [], ...more });
const town = () => plan([house('a', 'brick'), house('b', 'dressed'), house('c', 'brick'), house('d', 'timber'), house('e', 'dressed'), house('f', 'brick')]);

test('the choices are cleaned: what may be used, how much, how dealt', () => {
  const c = dressChoices({ much: 4, deal: 'nonsense', pools: { wall: [{ url: BRICK, as: 'brick' }, { url: BRICK }, { url: '' }, null] } });
  assert.equal(c.much, 1); assert.equal(c.deal, 'building'); assert.equal(c.suit, true); assert.equal(c.whole, true);
  assert.deepEqual(c.pools.wall, [{ url: BRICK, as: 'brick' }]); assert.deepEqual(c.pools.roof, []); assert.equal(c.ours.wall, true);
  assert.equal(dressOn(c), true); assert.equal(dressOn(dressChoices({ much: 0, pools })), false); assert.equal(dressOn(dressChoices({ much: 1 })), false);
});

test('with nothing to deal the plan is handed back as it was', () => {
  const p = town(); assert.equal(dressPlan(p, { much: 0, pools }).plan, p); assert.equal(dressPlan(p, { much: 1 }).dressed, 0);
});

test('a picture goes only where our own kind would have been the same', () => {
  const { plan: worn, dressed } = dressPlan(town(), { much: 1, pools, ours: noOurs, whole: false });
  const by = Object.fromEntries(worn.buildings.map((b) => [b.id, b]));
  assert.equal(by.a.cover, BRICK); assert.equal(by.c.cover, BRICK); assert.equal(by.b.cover, STONE);
  assert.equal(by.d.cover, undefined, 'no strip of yours stands for timber'); assert.equal(by.a.roof.cover, TILE, 'brick takes tile, and that is the tile of yours');
  assert.equal(by.b.roof.cover, SLATE); assert.equal(by.a.doors[0].cover, DOOR); assert.equal(by.a.windows[0].cover, WIN);
  assert.equal(by.d.windows[0].cover, undefined, 'timber would have had a wooden window, not glass'); assert.equal(dressed, 6);
});

test('all yours or none: a building with no roofing or no strip of yours is left as it was', () => {
  const { plan: worn, dressed } = dressPlan(town(), { much: 1, pools: { ...pools, roof: [{ url: TILE, as: 'tile' }] }, ours: noOurs, whole: true });
  const by = Object.fromEntries(worn.buildings.map((b) => [b.id, b]));
  assert.equal(by.a.cover, BRICK); assert.equal(by.a.roof.cover, TILE);
  assert.equal(by.b.cover, undefined, 'stone would have had slate, and there is none of yours'); assert.equal(by.b.doors[0].cover, undefined, 'so nothing of it is yours');
  assert.equal(by.d.cover, undefined); assert.equal(dressed, 3);
});

test('how much: none, some, all — and turning it up never reshuffles the ones already dressed', () => {
  const at = (much) => dressPlan(town(), { much, pools, ours: noOurs, suit: false, whole: false, deal: 'building' }).plan.buildings.map((b) => b.cover ?? null);
  const half = at(0.5), all = at(1);
  assert.ok(all.every(Boolean)); assert.ok(half.some(Boolean) && half.some((c) => !c), `some of them (${half.filter(Boolean).length})`);
  half.forEach((c, i) => { if (c) assert.equal(c, all[i], 'the same picture as when every building is dressed'); });
});

test('dealt whole map alike, each building its own, or every piece', () => {
  const two = { ...pools, door: [{ url: DOOR, as: '' }, { url: 'fa/Door_B.webp', as: '' }] };
  const many = plan(Array.from({ length: 14 }, (_, i) => house(`h${i}`, 'brick', { doors: [{ side: 's', from: 0, to: 100 }, { side: 'n', from: 0, to: 100 }, { side: 'e', from: 0, to: 100 }] })));
  const deal = (how) => dressPlan(many, { much: 1, pools: two, ours: noOurs, suit: false, whole: false, deal: how }).plan.buildings;
  const alike = deal('map'); assert.equal(new Set(alike.map((b) => b.cover)).size, 1, 'one strip for the whole map'); assert.equal(new Set(alike.flatMap((b) => b.doors.map((d) => d.cover))).size, 1);
  const own = deal('building'); assert.equal(new Set(own.map((b) => b.cover)).size, 2, 'buildings differ'); assert.ok(own.every((b) => new Set(b.doors.map((d) => d.cover)).size === 1), 'but a building\'s doors are alike');
  const each = deal('piece'); assert.ok(each.some((b) => new Set(b.doors.map((d) => d.cover)).size === 2), 'doors differ within a building');
});

test('our own stay in the mix unless told otherwise, and the same seed deals the same', () => {
  const many = plan(Array.from({ length: 30 }, (_, i) => house(`h${i}`, 'brick')));
  const mixed = dressPlan(many, { much: 1, pools, whole: false }).plan.buildings;
  assert.ok(mixed.some((b) => b.cover) && mixed.some((b) => !b.cover), 'some yours, some ours');
  assert.deepEqual(dressPlan(many, { much: 1, pools, whole: false }).plan, dressPlan(many, { much: 1, pools, whole: false }).plan);
  assert.notDeepEqual(dressPlan(many, { much: 1, pools, whole: false }, 6).plan.buildings.map((b) => b.cover), mixed.map((b) => b.cover), 'another seed, another deal');
});

test('a round tower keeps our cone, and ground takes a picture only where it is that floor', () => {
  const p = plan([house('t', 'dressed', { round: true })], { ground: { floor: 'grass', style: 'meadow' }, patches: [{ floor: 'stone', style: 'cobbles', shape: { x: 0, y: 0, width: 300, height: 300 } }], paths: [{ floor: 'dirt', line: [[0, 0], [500, 0]], width: 150 }] });
  const { plan: worn } = dressPlan(p, { much: 1, pools, ours: noOurs });
  assert.equal(worn.buildings[0].cover, STONE); assert.equal(worn.buildings[0].roof.cover, undefined, 'roofing cut into wedges does not suit a cone');
  assert.equal(worn.patches[0].image, COBBLE); assert.equal(worn.ground.image, undefined, 'cobbles are never dealt onto a meadow'); assert.equal(worn.paths[0].image, undefined);
  assert.equal(p.buildings[0].cover, undefined, 'the plan handed in is left as it was');
});

test('the documents carry what was dealt: the strip on every wall, the leaf, the window, the roofing, the ground', () => {
  const p = plan([house('a', 'brick')], { patches: [{ floor: 'stone', style: 'cobbles', shape: { x: 500, y: 500, width: 300, height: 300 } }] });
  const docs = planDocuments(dressPlan(p, { much: 1, pools, ours: noOurs }).plan, { grid: 100 });
  const flags = docs.walls.map((w) => w.flags.animater);
  assert.ok(flags.length >= 6 && flags.every((f) => f.cover === BRICK)); assert.equal(flags.find((f) => f.door).doorCover, DOOR); assert.equal(flags.find((f) => f.window).windowCover, WIN);
  assert.equal(docs.roofs[0].cover, TILE); assert.equal(docs.regions.find((r) => r.flags.animater.floor === 'stone').flags.animater.textureImage, COBBLE);
  const bare = planDocuments(p, { grid: 100 });
  assert.ok(bare.walls.every((w) => !('cover' in w.flags.animater) && !('doorCover' in w.flags.animater))); assert.equal('cover' in bare.roofs[0], false);
});

test('a real village comes out dressed, and the same choices on the same seed build the same one', () => {
  const size = { x: 0, y: 0, width: 4000, height: 3000, grid: 100, seed: 4242 }, bare = buildPlan('village', size);
  const every = { much: 1, pools: { wall: ['timber', 'fieldstone', 'dressed', 'brick', 'adobe', 'palisade'].map((m) => ({ url: `fa/${m}.webp`, as: m })), roof: ['thatch', 'tile', 'slate', 'shingle', 'plank', 'lead', 'turf', 'canvas'].map((k) => ({ url: `fa/${k}.webp`, as: k })) }, ours: noOurs };
  const worn = dressPlan(bare, every, bare.seed);
  assert.ok(bare.buildings.length > 0); assert.ok(worn.dressed > 0, `some of ${bare.buildings.length} dressed`);
  assert.deepEqual(dressPlan(buildPlan('village', size), every, bare.seed).plan, worn.plan);
  assert.ok(planDocuments(worn.plan, { grid: 100 }).walls.some((w) => w.flags.animater.cover));
});

// A form just big enough to be read.
const formOf = (boxes) => ({ querySelector: (sel) => boxes.find((b) => sel === `[name="${b.name}"]` || sel === `input[name="${b.name}"]`) ?? null, querySelectorAll: (sel) => boxes.filter((b) => sel === `input[name="${b.name}"]:checked` && b.checked) });
const ART = [{ what: 'wall', url: BRICK, name: 'Wall Brick Path', thumb: '', as: 'brick' }, { what: 'wall', url: STONE, name: 'Wall Stone Path', thumb: '', as: 'dressed' }, { what: 'roof', url: TILE, name: 'Roof Tile Red', thumb: '', as: 'tile' }, { what: 'decor', url: 'fa/Barrel.webp', name: 'Barrel', thumb: '', as: 'waist' }];

test('the window offers the GM\'s own pictures a tick each, and says so plainly when there are none', () => {
  const html = dressHtml(ART, { off: [STONE], deal: 'map', much: 0.4 });
  assert.match(html, /Dress it with your pictures/); assert.match(html, new RegExp(`name="dress-wall" value="${BRICK}" checked`)); assert.match(html, new RegExp(`name="dress-wall" value="${STONE}" >`), 'unticked last time, unticked now');
  assert.match(html, /name="dress-much"[^>]*value="40"/); assert.match(html, /<option value="map" selected>/); assert.match(html, /Doors<\/label><div class="form-fields"><em[^>]*>None of yours yet/);
  assert.equal(html.includes('Barrel'), false, 'a decoration is nothing a building wears');
  assert.match(dressHtml([], {}), /Pick pictures of your own/); assert.match(dressHtml([ART[3]], {}), /Pick pictures of your own/);
  assert.match(mapBuilderHtml({ art: ART }), /Dress it with your pictures/);
  assert.equal(dressHtml([{ ...ART[0], name: '<b>x</b>' }], {}).includes('<b>x</b>'), false, 'a name is never markup');
});

test('what the GM ticked is what is dealt, and what they unticked is remembered', () => {
  const form = formOf([{ name: 'dress-much', value: '60' }, { name: 'dress-deal', value: 'piece' }, { name: 'dress-suit', checked: false }, { name: 'dress-whole', checked: true },
    { name: 'dress-wall', value: BRICK, checked: true }, { name: 'dress-wall', value: STONE, checked: false }, { name: 'dress-roof', value: TILE, checked: true }, { name: 'dress-ours-wall', checked: false }, { name: 'dress-ours-roof', checked: true }]);
  const { dress, kept } = dressFrom(form, ART);
  assert.equal(dress.much, 0.6); assert.equal(dress.deal, 'piece'); assert.equal(dress.suit, false); assert.equal(dress.whole, true);
  assert.deepEqual(dress.pools.wall, [{ url: BRICK, as: 'brick' }]); assert.deepEqual(dress.pools.roof, [{ url: TILE, as: 'tile' }]); assert.equal(dress.ours.wall, false); assert.equal(dress.ours.roof, true);
  assert.deepEqual(kept.off, [STONE]); assert.equal(kept.deal, 'piece');
  assert.equal(dressFrom(formOf([]), ART), null, 'no such part in the window: nothing to deal');
});
