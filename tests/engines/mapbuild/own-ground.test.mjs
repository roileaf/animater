import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathRegion, areaRegion } from '../../../scripts/engines/mapbuild/path-lay.mjs';
import { artSuits, weathersAs, withOwnArt } from '../../../scripts/engines/mapbuild/own-art.mjs';
import { OWN_TILE_PER_SQUARE } from '../../../scripts/engines/motion/floor-looks.mjs';

const DIRT = 'https://assets.example.test/assets/free_assets/Textures/Dirt/Dirt_Path_A.jpg';
const LINE = [[100, 100], [600, 100], [900, 400]];

test('a road laid with the GM\'s own ground keeps where that picture is, and is a road in every other way', () => {
  const plain = pathRegion('road', LINE, { grid: 100 }), own = pathRegion('road', LINE, { grid: 100, image: DIRT });
  assert.equal(own.flags.animater.textureImage, DIRT); assert.equal('textureImage' in plain.flags.animater, false);
  const { textureImage, ...rest } = own.flags.animater; void textureImage;
  assert.deepEqual({ ...rest, pathSeed: 0 }, { ...plain.flags.animater, pathSeed: 0 }); assert.deepEqual(own.shapes, plain.shapes);
});

test('water and laid pieces take no ground picture', () => {
  assert.equal('textureImage' in pathRegion('stream', LINE, { grid: 100, image: DIRT }).flags.animater, false);
  assert.equal('textureImage' in pathRegion('fence', LINE, { grid: 100, image: DIRT }).flags.animater, false);
});

test('ground filled in keeps it too: an outline, a box, the whole map; never a pond', () => {
  const box = { x: 0, y: 0, width: 400, height: 300 };
  assert.equal(areaRegion('dirt', { box, image: DIRT }).flags.animater.textureImage, DIRT);
  assert.equal(areaRegion('stone', { points: [[0, 0], [300, 0], [300, 300]], image: DIRT }).flags.animater.textureImage, DIRT);
  assert.equal(areaRegion('grass', { box, whole: true, image: DIRT }).flags.animater.textureImage, DIRT);
  assert.equal('textureImage' in areaRegion('water', { box, image: DIRT }).flags.animater, false);
  assert.equal('textureImage' in areaRegion('dirt', { box }).flags.animater, false);
  assert.equal(areaRegion('dirt', { box, image: 'x'.repeat(900) }).flags.animater.textureImage.length, 400);
});

test('ground wants a texture that repeats: not a strip, not one small thing', () => {
  assert.equal(artSuits('ground', { path: 'Dirt_Path_A.jpg', width: 1400, height: 1400 }).ok, true);
  assert.equal(artSuits('ground', { path: 'Wall_Brick_A_Straight_Path.webp', width: 1650, height: 200 }).ok, false);
  assert.equal(artSuits('ground', { path: 'Barrel_Wood_E_1x1.webp', width: 200, height: 200 }).ok, false);
  assert.equal(artSuits('ground', { path: 'mine.png' }).ok, true, 'size unknown: taken on trust');
  assert.equal(artSuits('ground', { path: 'Dirt.jpg', width: 1400, height: 1400, locked: true }).ok, false);
});

test('which of our paths it is laid as is guessed from its name', () => {
  assert.equal(weathersAs('ground', 'Cobblestone_Gray_A'), 'street'); assert.equal(weathersAs('ground', 'Brick_Floor_01_D1'), 'street');
  assert.equal(weathersAs('ground', 'Gravel_Light_B'), 'gravel'); assert.equal(weathersAs('ground', 'Wood_Planks_Dark_A'), 'boardwalk');
  assert.equal(weathersAs('ground', 'Grass_Lush_C'), 'track'); assert.equal(weathersAs('ground', 'Dirt_Path_A'), 'road');
  assert.deepEqual(withOwnArt([], { what: 'ground', url: DIRT, name: 'Dirt Path A' }).map((it) => [it.what, it.as]), [['ground', 'road']]);
});

test('the floor engine lays the picture in the tile\'s place, at the size it was painted for', () => {
  assert.equal(OWN_TILE_PER_SQUARE, 200);
  const engine = readFileSync(new URL('../../../scripts/engines/motion/floor-looks.mjs', import.meta.url), 'utf8');
  assert.ok(engine.includes('uTile: own || tileOf(floor, style), uTileSize: size * (own ? own.width / OWN_TILE_PER_SQUARE : 4) * scaleNow,'));
  assert.ok(engine.includes("image = ownImage(spec), useBlades = spec.blades !== false && !image, shineOn = spec.shine !== false && !image,"), 'no grass blades and no painted relief of ours on somebody else\'s ground');
  assert.ok(engine.includes("(entry.image ?? '') === image"), 'another picture is another floor');
  assert.ok(engine.includes('base = image ? tile : tileOf(spec.floor, style)'), 'one still on its way is waited for');
  assert.ok(engine.includes('return had.failed ? false : had.texture?.baseTexture?.valid ? had.texture : null;'), 'one that cannot be had leaves the floor to our own tile');
  assert.ok(engine.includes('if (ownArrived) { ownArrived = false; this.sync(lastList); tileReady(); }'));
});

test('main, the bar and the brush carry it', () => {
  const read = (p) => readFileSync(new URL(`../../../scripts/${p}`, import.meta.url), 'utf8'), main = read('main.mjs'), bar = read('ui/decor-brush-bar.mjs'), shell = read('shell/map-painting.mjs');
  assert.match(main, /image: typeof own\.textureImage === "string" \? own\.textureImage : "" \};/);
  assert.equal(bar.split("ownTiles('ground', 'pathImage'").length - 1, 2, 'on a line and on ground filled in'); assert.ok(bar.includes("row.append(choice('Laid as', GROUND_PATHS.map(")); assert.ok(bar.includes('pathImage: remembered.pathImage || null'));
  assert.equal(bar.split("remembered.pathImage = '';").length - 1, 2, 'one of ours lets the GM\'s go');
  assert.equal(shell.split('image: c.pathImage || ""').length - 1, 4, 'a line, an outline, a box and the whole map'); assert.ok(shell.includes('ground: "textures"'));
});
