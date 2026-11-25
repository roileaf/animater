import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LIFT_BREAKS, LIFT_BURNS, LIFT_CHOICES, LIFT_GROWS, LIFT_MOST, LIFT_STANDS, LIFT_TREES, cutPixels, liftMask, liftPlaces, liftTileData, maskBox, roomyBox } from '../../../scripts/engines/mapbuild/map-lift.mjs';

const blob = (w, h, x0, y0, x1, y1) => { const m = new Uint8Array(w * h); for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) m[y * w + x] = 1; return m; };

test('the outline taken is the surest one that is neither a speck nor a great part of the map', () => {
  const w = 100, h = 100;
  const speck = blob(w, h, 5, 5, 5, 5), bush = blob(w, h, 40, 40, 49, 49), meadow = blob(w, h, 0, 0, 99, 79);
  const got = liftMask({ masks: [speck, bush, meadow], scores: [0.99, 0.8, 0.97], width: w, height: h });
  assert.deepEqual(maskBox(got, w, h), { x: 40, y: 40, w: 10, h: 10, count: 100 });
  // Of two that fit, the surer.
  const rock = blob(w, h, 10, 10, 19, 19);
  assert.equal(maskBox(liftMask({ masks: [bush, rock], scores: [0.7, 0.9], width: w, height: h }), w, h).x, 10);
  // Nothing fits: nothing lifted.
  assert.equal(liftMask({ masks: [speck, meadow], scores: [1, 1], width: w, height: h }), null);
  assert.equal(liftMask({ masks: [], scores: [], width: 0, height: 0 }), null);
});

test('a mask of any values comes back as 0s and 1s', () => {
  const m = new Float32Array(100 * 100); for (let i = 0; i < 50; i++) m[i] = 7.5;
  const got = liftMask({ masks: [m], scores: [1], width: 100, height: 100 });
  assert.ok(got instanceof Uint8Array);
  assert.equal(got[0], 1); assert.equal(got[60], 0);
});

test('an empty mask has no box, and the roomy box stays on the picture', () => {
  assert.equal(maskBox(new Uint8Array(16), 4, 4), null);
  assert.deepEqual(roomyBox({ x: 0, y: 1, w: 3, h: 2 }, 4, 4, 2), { x: 0, y: 0, w: 4, h: 4 });
  assert.deepEqual(roomyBox({ x: 10, y: 10, w: 5, h: 5 }, 100, 100, 2), { x: 8, y: 8, w: 9, h: 9 });
});

test('a box of the read map is placed on the scene and in the full picture', () => {
  const map = { width: 1000, height: 500, rect: { x: 200, y: 100, width: 4000, height: 2000 } };
  const at = liftPlaces({ x: 100, y: 50, w: 20, h: 10 }, map, { width: 8000, height: 4000 });
  assert.deepEqual(at.scene, { x: 600, y: 300, width: 80, height: 40 });
  assert.deepEqual(at.source, { x: 800, y: 400, width: 160, height: 80 });
  assert.deepEqual(at.cut, { width: 160, height: 80 });
  // A great thing is kept no bigger than LIFT_MOST a side, in proportion.
  const big = liftPlaces({ x: 0, y: 0, w: 1000, h: 250 }, map, { width: 8000, height: 4000 });
  assert.equal(big.cut.width, LIFT_MOST); assert.equal(big.cut.height, LIFT_MOST / 4);
});

test('the cut keeps the thing and clears the rest, with a soft edge between', () => {
  const mw = 8, mh = 8, mask = blob(mw, mh, 2, 2, 5, 5), box = { x: 0, y: 0, w: 8, h: 8 }, cw = 32, ch = 32;
  const rgba = new Uint8ClampedArray(cw * ch * 4).fill(200);
  const out = cutPixels(rgba, cw, ch, mask, mw, mh, box), a = (x, y) => out[(y * cw + x) * 4 + 3];
  assert.equal(a(16, 16), 200, 'the middle is kept whole');
  assert.equal(a(1, 1), 0, 'outside is clear');
  const edge = a(8, 16); assert.ok(edge > 0 && edge < 200, `the edge is part clear (${edge})`);
  assert.equal(out[(16 * cw + 16) * 4], 200, 'colour is not touched');
  assert.equal(rgba[(1 * cw + 1) * 4 + 3], 200, 'the piece given is left as it was');
});

test('a lifted thing is laid as an object tile over where it was painted', () => {
  const data = liftTileData({ src: 'worlds/w/animater-lifted/a.webp', scene: { x: 600, y: 300, width: 80, height: 40 }, stands: 'tall', per: 5, levelId: 'L1', elevation: 10 });
  assert.equal(data.x, 640); assert.equal(data.y, 320); assert.equal(data.width, 80); assert.equal(data.height, 40);
  assert.deepEqual(data.texture, { src: 'worlds/w/animater-lifted/a.webp', anchorX: 0.5, anchorY: 0.5 });
  assert.deepEqual(data.flags.animater, { sunlight: 'prop', sunHeight: 5, lifted: true });
  assert.deepEqual(data.levels, ['L1']); assert.equal(data.elevation, 10);
  // Flat casts nothing; an unknown choice stands waist high; no level, none named.
  assert.equal(liftTileData({ src: 'a.webp', scene: { x: 0, y: 0, width: 10, height: 10 }, stands: 'flat' }).flags.animater.sunHeight, 0);
  const plain = liftTileData({ src: 'a.webp', scene: { x: 0, y: 0, width: 10, height: 10 }, stands: 'nonsense' });
  assert.equal(plain.flags.animater.sunHeight, 3); assert.equal('levels' in plain, false);
  assert.equal(liftTileData({ src: '', scene: { x: 0, y: 0, width: 10, height: 10 } }), null);
  assert.equal(liftTileData({ src: 'a.webp', scene: { x: 0, y: 0, width: 0, height: 10 } }), null);
});

test('a bush or a tree is lifted as a tree tile of its kind, not as an object', () => {
  const at = { x: 0, y: 0, width: 300, height: 300 };
  assert.deepEqual(liftTileData({ src: 'a.webp', scene: at, stands: 'tree', tree: 'willow', per: 5 }).flags.animater, { sunlight: 'tree', sunTree: 'willow', sunHeight: 25, lifted: true });
  assert.deepEqual(liftTileData({ src: 'a.webp', scene: at, stands: 'bush', tree: 'pine', per: 5 }).flags.animater, { sunlight: 'tree', sunTree: 'pine', sunHeight: 6, lifted: true });
  // No kind said, or one there is not: a broadleaf.
  assert.equal(liftTileData({ src: 'a.webp', scene: at, stands: 'tree', tree: 'cactus' }).flags.animater.sunTree, 'broadleaf');
  assert.equal(liftTileData({ src: 'a.webp', scene: at, stands: 'tree' }).flags.animater.sunTree, 'broadleaf');
  // An object is given no kind of tree.
  assert.equal('sunTree' in liftTileData({ src: 'a.webp', scene: at, stands: 'tall', tree: 'pine' }).flags.animater, false);
});

test('the kinds offered are the tree engine\'s own', async () => {
  const { TREE_DARK } = await import('../../../scripts/engines/motion/tree-kinds.mjs');
  assert.deepEqual(LIFT_TREES.map(([k]) => k).sort(), Object.keys(TREE_DARK).sort());
  for (const k of LIFT_GROWS) assert.ok(k in LIFT_STANDS, k);
});

test('every choice offered is one that stands', () => {
  for (const [key] of LIFT_CHOICES) assert.ok(key in LIFT_STANDS, key);
  assert.equal(LIFT_STANDS.flat, 0);
});

test('Map painting lifts on a click, and a lift can be taken back and put back', () => {
  const shell = readFileSync(new URL('../../../scripts/shell/map-painting.mjs', import.meta.url), 'utf8');
  assert.match(shell, /if \(liftOn\(\)\) \{ void liftAt\(p\); return; \}/);
  assert.match(shell, /rememberDecorStep\(\{ kind: "tile", id: made\.id/);
  assert.match(shell, /step\.kind === "tile"\) await canvas\.scene\?\.tiles\?\.get\(step\.id\)\?\.delete\(\)/);
  assert.match(shell, /step\.kind === "tile"\) \{ const \{ _id, \.\.\.data \} = step\.data/);
  const bar = readFileSync(new URL('../../../scripts/ui/decor-brush-bar.mjs', import.meta.url), 'utf8');
  assert.match(bar, /\['lift', 'Lift from map'\]\], lifting \? 'lift' : 'lay'/);
  // Lifting has the tab to itself: no kinds, no brush, no density beside it.
  assert.match(bar, /if \(lifting\) \{\s+row\.append\(seg\('It stands'/);
  assert.match(bar, /lift: remembered\.lift === true, liftStands:/);
});

// Roi: "lets also add option to auto set it as breakable in the brush bar".
test('a thing lifted with Breaks set is made of that, and so breaks; left at Won\'t it is given no material', async () => {
  const { MATERIALS } = await import('../../../scripts/engines/props/prop-material.mjs');
  const at = { x: 0, y: 0, width: 100, height: 100 };
  assert.deepEqual(LIFT_BREAKS.map(([k]) => k), ['no', 'wood', 'stone', 'metal', 'clay', 'glass']);
  for (const [k] of LIFT_BREAKS.slice(1)) assert.ok(MATERIALS.includes(k), k);
  assert.deepEqual(LIFT_BURNS.map(([k]) => k), ['no', 'plant']);
  assert.deepEqual(liftTileData({ src: 'a.webp', scene: at, stands: 'waist', breaks: 'clay' }).flags.animater.prop, { material: 'clay' });
  // Nothing written for Won't, so the region it stands in can still say (lifted-props.mjs).
  for (const breaks of ['no', '', undefined, 'nonsense', 'none']) assert.equal('prop' in liftTileData({ src: 'a.webp', scene: at, breaks }).flags.animater, false, String(breaks));
  // A bush or a tree burns, whatever was picked for the things beside it.
  assert.deepEqual(liftTileData({ src: 'a.webp', scene: at, stands: 'bush', breaks: 'stone' }).flags.animater.prop, { material: 'plant' });
  assert.deepEqual(liftTileData({ src: 'a.webp', scene: at, stands: 'tree', breaks: 'plant' }).flags.animater.prop, { material: 'plant' });
  assert.equal('prop' in liftTileData({ src: 'a.webp', scene: at, stands: 'tree', breaks: 'no' }).flags.animater, false);
  assert.equal('prop' in liftTileData({ src: 'a.webp', scene: at, stands: 'tall', breaks: 'plant' }).flags.animater, false, 'an object is not a plant');
  const bar = readFileSync(new URL('../../../scripts/ui/decor-brush-bar.mjs', import.meta.url), 'utf8');
  assert.match(bar, /seg\('Breaks', grows \? LIFT_BURNS : LIFT_BREAKS,/);
  assert.match(bar, /liftBreaks: LIFT_BREAKS\.some\(\(\[k\]\) => k === remembered\.liftBreaks\) \? remembered\.liftBreaks : 'no',/);
  const shell = readFileSync(new URL('../../../scripts/shell/map-painting.mjs', import.meta.url), 'utf8');
  assert.match(shell, /tree: brushChoices\(\)\.liftTree, breaks: brushChoices\(\)\.liftBreaks,/);
});
