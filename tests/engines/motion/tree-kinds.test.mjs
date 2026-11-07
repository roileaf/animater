import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PATTERN_SIZE, TREE_DARK, TREE_KINDS, branchesOf, createTreePatterns, frondsOf, isOneTree, treeFieldAt, treeKindOf, treeShadeAt } from '../../../scripts/engines/motion/tree-kinds.mjs';

test('a tree tile\'s kind: its own choice, else its name, else a broadleaf', () => {
  assert.equal(treeKindOf({ src: 'trees/Oak_Large_03.webp' }), 'broadleaf');
  assert.equal(treeKindOf({ src: 'Pine%20Tree%2002.webp' }), 'pine');
  assert.equal(treeKindOf({ src: 'tropical/palm_tree_a.png' }), 'palm');
  assert.equal(treeKindOf({ src: 'willow-1.webp' }), 'willow');
  assert.equal(treeKindOf({ src: 'dead_tree.webp' }), 'bare');
  assert.equal(treeKindOf({ src: 'Birch Tree.webp' }), 'birch');
  assert.equal(treeKindOf({ src: 'pine.webp', own: 'palm' }), 'palm', 'its own choice first');
  assert.equal(treeKindOf({ src: 'pine.webp', own: 'nonsense' }), 'pine');
  assert.deepEqual(TREE_KINDS.map(([k]) => k), ['', 'broadleaf', 'pine', 'palm', 'birch', 'bare', 'willow']);
});

test('each kind is darker than the old half shade, a birch lightest and a pine darkest', () => {
  for (const k of Object.keys(TREE_DARK)) assert.ok(TREE_DARK[k] >= 0.55 && TREE_DARK[k] <= 0.8, k);
  assert.equal(Math.min(...Object.values(TREE_DARK)), TREE_DARK.birch);
  assert.equal(Math.max(...Object.values(TREE_DARK)), TREE_DARK.pine);
});

test('their shapes: clumps inside the crown and none past it, branches forking, fronds combed', () => {
  for (const kind of ['broadleaf', 'pine', 'birch', 'willow']) {
    assert.equal(treeShadeAt(kind, 200, 0, 1), 0, `${kind}: nothing past its crown`);
    let some = 0; for (let x = -60; x <= 60; x += 6) for (let y = -60; y <= 60; y += 6) some += treeShadeAt(kind, x, y, 1);
    assert.ok(some > 10, `${kind}: shade inside`);
  }
  assert.equal(treeShadeAt('palm', 0, 0), null, 'lines, not a field');
  const b = branchesOf(3); assert.ok(b.length > 30); assert.ok(b.every(([, , , , w]) => w > 0));
  assert.deepEqual(branchesOf(3), branchesOf(3), 'the same every time');
  assert.equal(frondsOf(1, 11).length, 11 * 24 * 3);
});

test('patterns are made once a kind and look, and none without a page to draw on', () => {
  assert.equal(createTreePatterns({ doc: null }).get('pine'), null);
  let drawn = 0;
  const ctx = { createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, arc() {}, fill() {}, fillRect() {}, drawImage() {}, createRadialGradient: () => ({ addColorStop() {} }) };
  const doc = { createElement: () => { drawn++; return { getContext: () => ctx }; } };
  const patterns = createTreePatterns({ doc });
  const a = patterns.get('palm', 5), again = patterns.get('palm', 7);
  assert.equal(a, again, 'seeds two looks apart share one'); assert.equal(drawn, 2, 'the pattern and its cut-out');
  assert.notEqual(patterns.get('palm', 6), a); assert.equal(patterns.get('cactus'), null);
  assert.notEqual(patterns.get('palm', 5, true), a, 'a stand of palms has its own repeating one');
});

test('a stand of trees gets a repeating pattern that meets itself; one tree its own crown', () => {
  assert.ok(isOneTree({ width: 300, height: 280, grid: 100 }));
  assert.ok(!isOneTree({ width: 1420, height: 1400, grid: 200 }), 'seven squares wide is a stand');
  assert.ok(!isOneTree({ width: 400, height: 150, grid: 100 }), 'a long hedge is not one crown');
  for (const kind of ['broadleaf', 'birch', 'willow', 'pine']) {
    for (const y of [3, 100, 200]) assert.ok(Math.abs(treeFieldAt(kind, 0, y, 2) - treeFieldAt(kind, PATTERN_SIZE, y, 2)) < 1e-9, `${kind}: left meets right`);
    for (const x of [3, 100, 200]) assert.ok(Math.abs(treeFieldAt(kind, x, 0, 2) - treeFieldAt(kind, x, PATTERN_SIZE, 2)) < 1e-9, `${kind}: top meets bottom`);
  }
  assert.equal(treeFieldAt('palm', 5, 5), null);
});

test('the canopy bakes each tree by its kind, finer, and the tile says its kind', () => {
  const canopy = readFileSync(new URL('../../../scripts/engines/motion/canopy-light.mjs', import.meta.url), 'utf8'), main = readFileSync(new URL('../../../scripts/main.mjs', import.meta.url), 'utf8');
  assert.match(canopy, /uTrees: bake\(trees\.length \? sprites\(trees, false, true, kt, true\) : none, 1\.5, true\)/);
  assert.match(canopy, /s\.alpha \*= \(TREE_DARK\[t\.kind\] \?\? 0\.8\) \/ 0\.8;/);
  assert.match(canopy, /cut\.blendMode = PIXI\.BLEND_MODES\.ERASE/);
  assert.match(canopy, /holder\.filters = \[new Alpha\(1\)\]/);
  assert.match(canopy, /cover \* \(1\.0 - fleck\) \* 0\.8/);
  assert.match(main, /name="flags\.\$\{ID\}\.sunTree"/);
  assert.match(main, /treeKindOf\(\{ src: d\.texture\?\.src, own: d\.flags\?\.\[ID\]\?\.sunTree \?\? "" \}\)/);
});
