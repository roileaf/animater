import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { OWN_ART_MOST, artName, artSuits, cardAsset, ownArtAs, ownArtList, weathersAs, withOwnArt, withoutOwnArt } from '../../../scripts/engines/mapbuild/own-art.mjs';

// A card as an asset browser marks one: plain facts about the asset, and a thumbnail from its library.
const LIB = 'https://assets.example.test/assets';
const card = (path, more = {}) => ({ contentPath: path, url: path, name: artName(path), width: '1400', height: '200', source: 'cloud', tier: 'free', ...more });
const WALL = '!Core/Structures/Walls/Wall_Brick_A/Wall_Brick_Earthy_A_Straight_Path.webp';

test('a card says what its asset is, and where its picture is kept beside its thumbnail', () => {
  const a = cardAsset(card(WALL), `${LIB}/thumbnails/${WALL}`);
  assert.equal(a.name, 'Wall Brick Earthy A Straight Path'); assert.equal(a.width, 1400); assert.equal(a.height, 200); assert.equal(a.locked, false);
  assert.equal(a.url, `${LIB}/free_assets/${WALL}`, 'the library\'s full pictures, beside its thumbnails'); assert.equal(a.thumb, `${LIB}/thumbnails/${WALL}`);
});

test('a card with a whole address, or kept on this machine, is taken as it says', () => {
  assert.equal(cardAsset(card('x/Door_A.webp', { url: 'https://elsewhere.test/Door_A.webp' }), '').url, 'https://elsewhere.test/Door_A.webp');
  assert.equal(cardAsset(card('packs/fa/Door_A.webp', { source: 'local', url: 'packs/fa/Door_A.webp' }), '').url, 'packs/fa/Door_A.webp');
});

test('a locked one has no picture to give, and a card that says nothing is no asset', () => {
  const locked = cardAsset(card(WALL, { tier: 'premium' }), `${LIB}/thumbnails/${WALL}`);
  assert.equal(locked.locked, true); assert.equal(locked.url, null);
  assert.equal(cardAsset({}, ''), null); assert.equal(cardAsset({ contentPath: 'data:image/png;base64,AAAA' }, ''), null, 'a made-up swatch is not an asset');
  assert.equal(cardAsset(card(WALL), 'not-a-library').url, null, 'where its picture is cannot be told');
});

test('a wall wants the long strip, not the pieces sold beside it', () => {
  assert.equal(artSuits('wall', { path: WALL, width: 1650, height: 200 }).ok, true);
  assert.equal(artSuits('wall', { path: 'Fence_Stone_Earthy_C1_Path.webp', width: 1400, height: 200 }).ok, true);
  for (const piece of ['Wall_Brick_Earthy_A_Corner_A_1x1', 'Wall_Brick_Earthy_A_Joint_B_1x1', 'Wall_Brick_Earthy_A_Ending_A_1x1', 'Wall_Brick_Earthy_A_Connector_DIAG_A_1x1', 'Wall_Brick_Earthy_A_Straight_B_2x1']) {
    const said = artSuits('wall', { path: `${piece}.webp`, width: 200, height: 200 });
    assert.equal(said.ok, false, piece); assert.match(said.why, /strip|Path/);
  }
  assert.equal(artSuits('wall', { path: 'Barrel_Wood.webp', width: 200, height: 200 }).ok, false, 'not long and thin');
  assert.equal(artSuits('wall', { path: 'my wall strip.webp' }).ok, true, 'size unknown: by its name');
});

test('a door wants the leaf, a roof wants roofing, and a locked one suits nothing', () => {
  assert.equal(artSuits('door', { path: 'Door_Wood_Dark_A_1x1.webp', width: 200, height: 200 }).ok, true);
  for (const no of ['Shack_Door_Frame_Wood_Ashen_A1_3x1', 'Door_Fallen_Wood_Dark_A1_2x2', 'Trapdoor_Wood_A', 'Barrel_Wood_E']) assert.equal(artSuits('door', { path: `${no}.webp` }).ok, false, no);
  assert.equal(artSuits('roof', { path: 'Roof_Texture_Tile_Red_A1.webp', width: 1400, height: 1400 }).ok, true);
  assert.equal(artSuits('roof', { path: 'Crops_Wheat_Dry_A.jpg', width: 1400, height: 1400 }).ok, false);
  assert.equal(artSuits('roof', { path: 'Roof_Edge_Tile.webp', width: 1400, height: 200 }).ok, false, 'a strip is not a covering');
  assert.equal(artSuits('wall', { path: WALL, locked: true }).ok, false);
  assert.equal(artSuits('window', { path: WALL }).ok, false);
});

test('what it is made of is guessed from its name', () => {
  assert.equal(weathersAs('wall', 'Wall_Brick_Earthy_A_Straight_Path'), 'brick'); assert.equal(weathersAs('wall', 'Shack_Wall_Wood_A_Path'), 'timber');
  assert.equal(weathersAs('wall', 'Wall_PlasterWood_C_Path'), 'adobe'); assert.equal(weathersAs('wall', 'Wall_StoneWood_Earthy_Ashen_D_Path'), 'dressed'); assert.equal(weathersAs('wall', 'Thing'), 'dressed');
  assert.equal(weathersAs('roof', 'Roof_Texture_Hay_01_A1'), 'thatch'); assert.equal(weathersAs('roof', 'Roof_Texture_Slate_Blue'), 'slate'); assert.equal(weathersAs('roof', 'Roof_Texture_Wood_Dark_Shingle'), 'shingle');
  assert.equal(weathersAs('roof', 'Roof_Texture_Tile_Red'), 'tile'); assert.equal(weathersAs('roof', 'Corrugated_Metal_Gray'), 'lead'); assert.equal(weathersAs('door', 'Door_Wood'), '');
});

test('the GM\'s list is kept clean: only what can be used, none twice', () => {
  const list = ownArtList([{ what: 'wall', url: 'a.webp', name: 'A' }, { what: 'wall', url: 'a.webp' }, { what: 'window', url: 'b.webp' }, { what: 'roof', url: '' }, { what: 'door', url: 'javascript:alert(1)' }, null, { what: 'roof', url: 'Roof_Texture_Slate_Blue.webp', thumb: 'data:x' }]);
  assert.deepEqual(list.map((it) => `${it.what}:${it.url}`), ['wall:a.webp', 'roof:Roof_Texture_Slate_Blue.webp']);
  assert.equal(list[1].name, 'Roof Texture Slate Blue'); assert.equal(list[1].as, 'slate'); assert.equal(list[1].thumb, '');
  assert.deepEqual(ownArtList('nonsense'), []);
});

test('one more goes to the head, one already there moves up, and a row never grows past its length', () => {
  let list = withOwnArt([], { what: 'wall', url: 'a.webp' }); list = withOwnArt(list, { what: 'wall', url: 'b.webp' }); list = withOwnArt(list, { what: 'door', url: 'd.webp' });
  assert.deepEqual(list.map((it) => it.url), ['d.webp', 'b.webp', 'a.webp']);
  assert.deepEqual(withOwnArt(list, { what: 'wall', url: 'a.webp' }).map((it) => it.url), ['a.webp', 'd.webp', 'b.webp']);
  for (let i = 0; i < OWN_ART_MOST + 5; i++) list = withOwnArt(list, { what: 'wall', url: `w${i}.webp` });
  assert.equal(list.filter((it) => it.what === 'wall').length, OWN_ART_MOST); assert.equal(list.filter((it) => it.what === 'door').length, 1, 'another kind is not pushed out');
  assert.deepEqual(withOwnArt(list, { what: 'nope', url: 'x' }), list);
});

test('one can be taken off, and what one is made of changed', () => {
  const list = withOwnArt(withOwnArt([], { what: 'wall', url: 'a.webp' }), { what: 'roof', url: 'a.webp' });
  assert.deepEqual(withoutOwnArt(list, 'wall', 'a.webp').map((it) => it.what), ['roof'], 'only that kind\'s');
  assert.equal(ownArtAs(list, 'wall', 'a.webp', 'brick').find((it) => it.what === 'wall').as, 'brick'); assert.notEqual(ownArtAs(list, 'wall', 'a.webp', 'brick').find((it) => it.what === 'roof').as, 'brick');
});

test('the bar shows them beside our own, and the shell picks in the asset browser without setting anything down', () => {
  const bar = readFileSync(new URL('../../../scripts/ui/decor-brush-bar.mjs', import.meta.url), 'utf8'), shell = readFileSync(new URL('../../../scripts/shell/map-painting.mjs', import.meta.url), 'utf8');
  assert.equal(bar.includes('ownPick'), false, 'no longer a row hidden under More');
  assert.match(bar, /const on = !remembered\.wallCover && remembered\.wallMaterial === id/); assert.match(bar, /remembered\.wallMaterial = id; remembered\.wallCover = '';/);
  assert.match(bar, /if \(remembered\.wallCover\) row\.append\(seg\('Weathers as'/); assert.match(bar, /if \(remembered\.roofCover\) row\.append\(seg\('Weathers as'/);
  assert.match(bar, /if \(ownArt\.browser\?\.\(\)\) adder\('Pick in Nexus'/); assert.match(bar, /adder\('From a file'/);
  assert.match(shell, /ownArt: ownArtFor\(\),/);
  assert.match(shell, /e\.preventDefault\(\); e\.stopImmediatePropagation\(\);\r?\n        if \(e\.type !== "click"\) return;/, 'the browser never starts setting it down');
  assert.match(shell, /const fit = artSuits\(what, art\);\r?\n        if \(!fit\.ok\)/); assert.match(shell, /if \(e\.key === "Escape"\)/); assert.match(shell, /if \(!win\(\)\) end\(null\);/);
  assert.match(shell, /game\.user\?\.setFlag\?\.\(ID, "ownArt", list\)/);
});
