import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { coverBand, createCovers } from '../../../scripts/engines/motion/roof-cover.mjs';
import { paintRunPicture } from '../../../scripts/engines/motion/wall-paint.mjs';
import { paintDoorLeaf } from '../../../scripts/engines/motion/door-paint.mjs';
import { wallRuns, wallDoors } from '../../../scripts/engines/motion/wall-looks.mjs';

// A strip of wall W by H: wall from row `top` to row `bottom`, nothing above or below.
const strip = (w, h, top, bottom) => { const d = new Uint8ClampedArray(w * h * 4); for (let y = top; y < bottom; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; d[i] = 120; d[i + 1] = 112; d[i + 2] = 96; d[i + 3] = 255; } return d; };

test('a strip of wall says where its wall is: the band across its middle', () => {
  assert.deepEqual(coverBand(strip(160, 200, 68, 132), 160, 200), [68, 132]);
  assert.deepEqual(coverBand(strip(160, 40, 0, 40), 160, 40), [0, 40], 'wall all through');
  assert.deepEqual(coverBand(new Uint8ClampedArray(160 * 40 * 4), 160, 40), [0, 40], 'an empty picture is taken whole rather than as nothing');
});

test('the loader hands a strip its band along with the rest', async () => {
  const covers = createCovers({ load: async () => ({}), read: () => ({ data: strip(160, 200, 68, 132), width: 160, height: 200 }) });
  covers.get('wall.webp'); await new Promise((r) => setTimeout(r, 5));
  assert.deepEqual(covers.get('wall.webp').band, [68, 132]);
});

// A canvas that only keeps what is drawn onto it and how it was turned.
const counting = () => {
  const calls = { drawImage: [], rotate: [], clips: 0 };
  const ctx = new Proxy({}, { get: (_, k) => (k === 'canvas' ? null : k === 'drawImage' ? (...a) => { calls.drawImage.push(a); } : k === 'rotate' ? (a) => { calls.rotate.push(a); } : k === 'clip' ? () => { calls.clips++; }
    : k === 'createLinearGradient' || k === 'createRadialGradient' || k === 'createPattern' ? () => ({ addColorStop() {} })
    : k === 'getImageData' ? () => ({ data: new Uint8ClampedArray(4) }) : k === 'measureText' ? () => ({ width: 0 }) : () => {}), set: () => true });
  return { calls, make: (w, h) => ({ width: w, height: h, getContext: () => ctx }) };
};
const COVER = { image: { tag: 'strip' }, width: 1650, height: 200, band: [68, 132] };
const ELBOW = [[100, 100], [500, 100], [500, 400]];

test('a covered wall is laid with the strip along each stretch, turned the way that stretch runs', () => {
  const { calls, make } = counting();
  assert.ok(paintRunPicture(ELBOW, 'brick', { grid: 100, cover: COVER }, make));
  assert.ok(calls.drawImage.length >= 2 && calls.drawImage.every((a) => a[0] === COVER.image));
  assert.ok(calls.rotate.some((a) => Math.abs(a) < 1e-9), 'along the first stretch'); assert.ok(calls.rotate.some((a) => Math.abs(a - Math.PI / 2) < 1e-9), 'and down the second');
  // The strip's wall is made exactly as thick as ours is drawn (0.17 of a square either side), whatever it was painted at.
  const [, , y, w, h] = calls.drawImage[0], k = 34 / 64;
  assert.ok(Math.abs(h - 200 * k) < 1e-6 && Math.abs(w - 1650 * k) < 1e-6); assert.ok(Math.abs(y + 100 * k) < 1e-6, 'its band\'s middle on our line');
  const thick = counting(); paintRunPicture(ELBOW, 'brick', { grid: 100, thick: 0.3, cover: COVER }, thick.make);
  assert.ok(Math.abs(thick.calls.drawImage[0][4] - 200 * (60 / 64)) < 1e-6, 'a thicker wall, a bigger strip');
});

test('a long stretch takes the strip more than once, its courses carried on round the corner', () => {
  const { calls, make } = counting();
  paintRunPicture([[0, 0], [1500, 0], [1500, 300]], 'brick', { grid: 100, cover: COVER }, make, 4096);
  const w = calls.drawImage[0][3], xs = calls.drawImage.map((a) => a[1]);
  assert.ok(calls.drawImage.length >= 4); assert.ok(xs.some((x) => Math.abs(((x % w) + w) % w) > 1), 'the second stretch does not start the strip afresh');
});

test('without a picture a wall is painted as it always was', () => {
  const { calls, make } = counting();
  paintRunPicture(ELBOW, 'brick', { grid: 100 }, make); assert.equal(calls.drawImage.length, 0);
  paintRunPicture(ELBOW, 'brick', { grid: 100, cover: { image: null, width: 0, height: 0 } }, make); assert.equal(calls.drawImage.length, 0, 'nor with one that has not arrived');
});

const wall = (id, c, more = {}) => ({ id, c, animater: { material: 'brick', ...more } });

test('a run keeps the strip its first wall was laid with, and is painted again for another', () => {
  const run = (more) => wallRuns([wall('a', [0, 0, 100, 0], more), wall('b', [100, 0, 200, 0], more)])[0];
  assert.equal(run({}).cover, null); assert.equal(run({ cover: 'fa/Wall_Brick_Path.webp' }).cover, 'fa/Wall_Brick_Path.webp');
  assert.notEqual(run({ cover: 'a.webp' }).key, run({}).key); assert.notEqual(run({ cover: 'a.webp' }).key, run({ cover: 'b.webp' }).key);
  assert.equal(run({ cover: 5 }).cover, null); assert.equal(run({ cover: 'x'.repeat(401) }).cover, null);
  assert.equal(run({ cover: 'a.webp' }).id, run({}).id, 'the same stones, whatever they wear');
});

test('a door keeps the leaf picture it was hung with', () => {
  const door = (more) => wallDoors([{ ...wall('d', [0, 0, 100, 0], more), door: 1, ds: 0 }])[0];
  assert.equal(door({}).cover, null); assert.equal(door({ doorCover: 'fa/Door_Wood.webp' }).cover, 'fa/Door_Wood.webp');
  assert.notEqual(door({ doorCover: 'a.webp' }).key, door({}).key);
  // A pair: both leaves.
  const pair = wallDoors([{ ...wall('d', [0, 0, 200, 0], { pair: true, doorCover: 'a.webp' }), door: 1, ds: 0 }]);
  assert.deepEqual(pair.map((l) => l.cover), ['a.webp', 'a.webp']);
});

test('a door hung with a picture is that picture, turned so its hinge is on ours and sized to the opening', () => {
  const { calls, make } = counting(), image = { tag: 'leaf' };
  const leaf = paintDoorLeaf('banded', 100, { grid: 100, cover: { image, width: 200, height: 200 } }, make);
  assert.ok(leaf?.canvas); assert.equal(leaf.length, 100);
  assert.deepEqual(calls.drawImage, [[image, -50, -50, 100, 100]]); assert.ok(calls.rotate.some((a) => Math.abs(a - Math.PI) < 1e-9));
  const plain = counting(); paintDoorLeaf('banded', 100, { grid: 100 }, plain.make); assert.equal(plain.calls.drawImage.length, 0);
});

test('the shell hands walls and doors their pictures and the bar offers a picker for each', () => {
  const shell = readFileSync(new URL('../../../scripts/shell/painted-buildings.mjs', import.meta.url), 'utf8');
  assert.ok(shell.includes('${litKey}${coverKey(run)}`, look: {') && shell.includes('lit, cover: run.cover ? covers.get(run.cover) : null } };'));
  assert.match(shell, /\$\{litKey\}\$\{coverKey\(d\)\}`, lit, cover: d\.cover \? covers\.get\(d\.cover\) : null/);
  const bar = readFileSync(new URL('../../../scripts/ui/decor-brush-bar.mjs', import.meta.url), 'utf8'), paints = readFileSync(new URL('../../../scripts/shell/map-painting.mjs', import.meta.url), 'utf8');
  for (const [what, key] of [['roof', 'roofCover'], ['wall', 'wallCover'], ['door', 'doorCover']]) { assert.ok(bar.includes(`ownTiles('${what}', '${key}'`), what); assert.ok(bar.includes(`${key}: remembered.${key} || null`), key); }
  assert.match(paints, /choice\.wallCover \? \{ cover: String\(choice\.wallCover\)\.slice\(0, 400\) \}/);
  assert.equal(paints.split('choice.doorCover ?').length - 1, 2, 'a door cut new and a door changed');
});
