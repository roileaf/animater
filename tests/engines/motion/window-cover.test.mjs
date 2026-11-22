import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { coverJambs, createCovers } from '../../../scripts/engines/motion/roof-cover.mjs';
import { paintWindowFrame, paintWindowLeaf } from '../../../scripts/engines/motion/window-paint.mjs';
import { wallWindows } from '../../../scripts/engines/motion/wall-looks.mjs';
import { createPaintedWindows } from '../../../scripts/engines/motion/painted-windows.mjs';
import { artSuits, weathersAs, withOwnArt } from '../../../scripts/engines/mapbuild/own-art.mjs';

// A window shut, seen from above, W by H: a thin pane across the middle, a taller jamb `cap` wide at each end.
const shut = (w, h, cap, { pane = 8, jamb = 30, from = 0, to = w } = {}) => {
  const d = new Uint8ClampedArray(w * h * 4), fill = (x0, x1, tall) => { for (let x = x0; x < x1; x++) for (let y = Math.round(h / 2 - tall / 2); y < Math.round(h / 2 + tall / 2); y++) d[(y * w + x) * 4 + 3] = 255; };
  fill(from, to, pane); fill(from, from + cap, jamb); fill(to - cap, to, jamb);
  return d;
};

test('a window picture says where its jambs end and its pane begins', () => {
  assert.deepEqual(coverJambs(shut(200, 200, 12), 200, 200), { x0: 0, x1: 200, a: 12, b: 188, tall: 30 });
  // Painted with room round it: measured from where it is painted.
  assert.deepEqual(coverJambs(shut(400, 200, 28, { from: 10, to: 390 }), 400, 200), { x0: 10, x1: 390, a: 38, b: 362, tall: 30 });
});

test('one with no jambs to find is all pane, and an empty picture is taken whole', () => {
  const plain = coverJambs(shut(200, 200, 0, { pane: 40 }), 200, 200);
  assert.deepEqual([plain.a, plain.b], [0, 200]);
  assert.deepEqual(coverJambs(new Uint8ClampedArray(50 * 50 * 4), 50, 50), { x0: 0, x1: 50, a: 0, b: 50, tall: 50 });
});

test('the loader hands a window its jambs', async () => {
  const covers = createCovers({ load: async () => ({}), read: () => ({ data: shut(200, 200, 12), width: 200, height: 200 }) });
  covers.get('w.webp'); await new Promise((r) => setTimeout(r, 5));
  assert.deepEqual([covers.get('w.webp').jambs.a, covers.get('w.webp').jambs.b], [12, 188]);
});

const counting = () => {
  const calls = { drawImage: [] };
  const ctx = new Proxy({}, { get: (_, k) => (k === 'canvas' ? null : k === 'drawImage' ? (...a) => { calls.drawImage.push(a); }
    : k === 'createLinearGradient' || k === 'createRadialGradient' || k === 'createPattern' ? () => ({ addColorStop() {} })
    : k === 'getImageData' ? () => ({ data: new Uint8ClampedArray(4) }) : k === 'measureText' ? () => ({ width: 0 }) : () => {}), set: () => true });
  return { calls, make: (w, h) => ({ width: w, height: h, getContext: () => ctx }) };
};
const IMAGE = { tag: 'window' };
const COVER = { image: IMAGE, width: 200, height: 200, jambs: { x0: 0, x1: 200, a: 12, b: 188, tall: 30 } };

test('the opening keeps the picture\'s two jambs, laid to its own length, and nothing of its pane', () => {
  const { calls, make } = counting();
  const frame = paintWindowFrame('glassWindow', 100, { grid: 100, cover: COVER }, make);
  assert.ok(frame?.canvas); assert.equal(frame.length, 100);
  assert.deepEqual(calls.drawImage.map((a) => [a[1], a[3]]), [[0, 12], [188, 12]], 'its left jamb and its right, by their own columns');
  const [left, right] = calls.drawImage;
  assert.equal(left[5], -50, 'the left jamb at the opening\'s left end'); assert.equal(right[5] + right[7], 50, 'the right one ending at its right end');
  assert.equal(left[7], 6, 'half size: the picture is 200 across and the opening 100');
});

test('a window of a kind with nothing to open keeps the whole picture in its opening, and has no leaves', () => {
  const { calls, make } = counting();
  paintWindowFrame('barredWindow', 100, { grid: 100, cover: COVER }, make);
  assert.deepEqual(calls.drawImage.map((a) => [a[1], a[3], a[5], a[7]]), [[0, 200, -50, 100]]);
  assert.equal(paintWindowLeaf('barredWindow', 50, { grid: 100, cover: COVER }, make), null);
});

test('a leaf is half the pane, beginning where the jamb leaves off, hinged at the opening\'s end', () => {
  const { calls, make } = counting();
  const leaf = paintWindowLeaf('glassWindow', 50, { grid: 100, cover: COVER }, make);
  assert.ok(leaf?.canvas); assert.equal(leaf.length, 50); assert.equal(leaf.hinge[0], leaf.pad, 'hinged at its left end');
  assert.equal(calls.drawImage.length, 1);
  const [image, sx, , sw, , dx, , dw] = calls.drawImage[0];
  assert.equal(image, IMAGE); assert.equal(sx, 12); assert.equal(sw, 88, 'from its jamb to its middle'); assert.equal(dx, -25 + 6, 'set in by its jamb\'s width'); assert.equal(dw, 44);
});

test('a picture that is all jamb gives no leaves, and without a picture a window is painted as it always was', () => {
  const { calls, make } = counting();
  assert.equal(paintWindowLeaf('glassWindow', 50, { grid: 100, cover: { ...COVER, jambs: { x0: 0, x1: 200, a: 100, b: 100, tall: 30 } } }, make), null);
  const plain = counting(); assert.ok(paintWindowFrame('glassWindow', 100, { grid: 100 }, plain.make)); assert.ok(paintWindowLeaf('glassWindow', 50, { grid: 100 }, plain.make));
  assert.equal(plain.calls.drawImage.length, 0);
});

test('a window keeps the picture it was hung with, and is painted again for another', () => {
  const win = (more) => wallWindows([{ id: 'w', c: [0, 0, 100, 0], animater: { material: 'brick', window: 'glassWindow', ...more } }])[0];
  assert.equal(win({}).cover, null); assert.equal(win({ windowCover: 'fa/Window_A.webp' }).cover, 'fa/Window_A.webp');
  assert.notEqual(win({ windowCover: 'a.webp' }).key, win({}).key); assert.equal(win({ windowCover: 9 }).cover, null);
});

test('hung, it opens and shuts as ours do: two leaves on their own jambs, moved and never repainted', () => {
  class Container { constructor() { this.children = []; } addChild(c) { c.parent = this; this.children.push(c); return c; } removeChild() {} destroy() {} }
  class Sprite extends Container { constructor(t) { super(); this.texture = t; this.rotation = 0; this.anchor = { set() {} }; this.position = { set(x, y) { this.x = x; this.y = y; } }; this.scale = { set() {} }; } }
  const made = []; const PIXI = { Container, Sprite, Texture: { from: (c) => { const t = { c, destroy() {} }; made.push(t); return t; } } };
  const { make } = counting(), root = new Container(), layer = createPaintedWindows({ PIXI, root: () => root, grid: () => 100, make });
  const win = (open) => ({ id: 'w', key: 'w:cover', kind: 'glassWindow', material: 'brick', middle: [500, 300], along: 0, length: 100, way: 1, open, cover: COVER });
  layer.populate({ windows: [win(false)] }); layer.settle();
  assert.equal(layer.state.leaves, 2, 'a pair'); assert.equal(root.children.length, 3, 'the opening and its two leaves');
  const [, a, b] = root.children, pictures = made.length;
  assert.deepEqual([a.position.x, b.position.x], [450, 550], 'each at its own end of the opening'); assert.equal(a.rotation, 0);
  layer.populate({ windows: [win(true)] }); layer.settle();
  assert.ok(Math.abs(a.rotation) > 1 && Math.abs(b.rotation - Math.PI) > 1, 'both swung'); assert.ok(a.rotation * (b.rotation - Math.PI) < 0, 'away from each other');
  assert.equal(made.length, pictures, 'nothing painted again to open it');
});

test('the GM\'s list knows windows: what suits one, and which of ours it opens as', () => {
  assert.equal(artSuits('window', { path: 'Shack_Window_Large_Wood_Ashen_A1_2x1.webp', width: 400, height: 200 }).ok, true);
  for (const no of ['Shack_Window_Sill_Wood_Ashen_A1_1x1', 'Window_Frame_Stone_A', 'Door_Wood_Dark_A_1x1']) assert.equal(artSuits('window', { path: `${no}.webp` }).ok, false, no);
  assert.equal(weathersAs('window', 'Stained_Window_Metal_Gray_A_1x1'), 'mosaicWindow'); assert.equal(weathersAs('window', 'Wired_Window_Metal_Gray_A_1x1'), 'leadedWindow');
  assert.equal(weathersAs('window', 'Shack_Window_Wood_Dark_A1_1x1'), 'woodWindow'); assert.equal(weathersAs('window', 'Window_Metal_Gray_C_1x1'), 'glassWindow');
  assert.deepEqual(withOwnArt([], { what: 'window', url: 'w.webp', name: 'Window Metal Gray C' }).map((it) => [it.what, it.as]), [['window', 'glassWindow']]);
});

test('the shell and the bar carry it: a key spelled with its covering, a Yours row, and what it opens as', () => {
  const shell = readFileSync(new URL('../../../scripts/shell/painted-buildings.mjs', import.meta.url), 'utf8'), bar = readFileSync(new URL('../../../scripts/ui/decor-brush-bar.mjs', import.meta.url), 'utf8'), paints = readFileSync(new URL('../../../scripts/shell/map-painting.mjs', import.meta.url), 'utf8');
  assert.ok(shell.includes("lift: w.flat ? 0 : lift, lit, key: `${w.key}${p}${w.flat ? ':f' : ''}${litKey}${coverKey(w)}`, cover: w.cover ? covers.get(w.cover) : null }"));
  assert.ok(bar.includes("ownTiles('window', 'windowCover'")); assert.ok(bar.includes("if (remembered.windowCover) row.append(choice('Opens as'")); assert.ok(bar.includes('windowCover: remembered.windowCover || null'));
  assert.equal(paints.split('choice.windowCover ?').length - 1, 2, 'a window cut new and a window changed'); assert.ok(paints.includes('window: "assets"') && paints.includes('window: "Window"'));
});
