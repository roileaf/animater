import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { coverSolidTo, coverBase, coverCourses, createRoofCovers, COVER_PER_SQUARE } from '../../../scripts/engines/motion/roof-cover.mjs';
import { paintRoofPicture, gabledRoof, hippedRoof } from '../../../scripts/engines/motion/roof-paint.mjs';
import { roofsOf } from '../../../scripts/engines/motion/roof-looks.mjs';

// A roofing picture W by H of one colour, painted down to row `to` and nothing under it.
const picture = (w, h, to, [r, g, b] = [170, 60, 40]) => { const d = new Uint8ClampedArray(w * h * 4); for (let y = 0; y < to; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255; } return d; };

test('a roofing picture is roofing down to its ragged eave, and nothing under that counts', () => {
  assert.equal(coverSolidTo(picture(64, 100, 90), 64, 100), 90);
  assert.equal(coverSolidTo(picture(64, 100, 100), 64, 100), 100, 'painted to its bottom: all of it');
  // A ragged last row, only a few tiles reaching it, is not the eave line.
  const ragged = picture(64, 100, 90); for (let x = 0; x < 8; x++) { const i = (92 * 64 + x) * 4; ragged[i + 3] = 255; }
  assert.equal(coverSolidTo(ragged, 64, 100), 90);
});

test('its colour taken all together is what its caps are painted in', () => {
  assert.equal(coverBase(picture(32, 32, 20, [170, 60, 40]), 32, 32), '#aa3c28');
  assert.match(coverBase(new Uint8ClampedArray(32 * 32 * 4), 32, 32), /^#[0-9a-f]{6}$/, 'an empty picture still answers');
});

test('on a slope the roofing is turned so its courses run along the eave and its bottom lies on it', () => {
  const cover = { width: 800, height: 800, solidTo: 720, per: COVER_PER_SQUARE }, roof = gabledRoof(0, 0, 400, 200, 0), [north, south] = roof.faces;
  const s = coverCourses(south, cover, 100);
  assert.ok(Math.abs(s.rot) < 1e-9, 'a slope falling down the page is laid as the picture is'); assert.equal(s.w, 400); assert.equal(s.h, 400);
  assert.equal(s.rows[0], 200 - 360, 'its solid bottom on the eave at y 200');
  assert.ok(s.cols[0] <= 0 && s.cols[s.cols.length - 1] + s.w >= 400, 'the whole width of the slope');
  const n = coverCourses(north, cover, 100);
  assert.ok(Math.abs(Math.abs(n.rot) - Math.PI) < 1e-9, 'the slope on the other side is laid the other way up');
  // A hip end falls sideways: its courses run up the page.
  const end = coverCourses(hippedRoof(0, 0, 400, 200, 0).faces[3], cover, 100);
  assert.ok(Math.abs(end.rot + Math.PI / 2) < 1e-9);
});

test('a deep slope takes more than one row, each lapping the one below, and never an endless number', () => {
  const cover = { width: 200, height: 220, solidTo: 200, per: 200 };
  const deep = coverCourses({ pts: [[0, 1000], [100, 1000], [100, 0], [0, 0]], away: [0, 1] }, cover, 100);
  assert.ok(deep.rows.length >= 10); assert.ok(deep.rows[0] - deep.rows[1] < 100, 'lapped'); assert.ok(deep.rows[deep.rows.length - 1] <= 0, 'up to the ridge');
  assert.ok(coverCourses({ pts: [[0, 1e7], [1e7, 1e7], [1e7, 0], [0, 0]], away: [0, 1] }, cover, 100).rows.length <= 400);
});

test('a roof keeps the picture it is covered with, and is painted again for another', () => {
  const one = (more) => roofsOf({ roofs: [{ id: 'a', x: 0, y: 0, w: 400, h: 200, kind: 'tile', ...more }] })[0];
  assert.equal(one({}).cover, null);
  assert.equal(one({ cover: 'assets/roof/Tile_Red.webp' }).cover, 'assets/roof/Tile_Red.webp');
  assert.notEqual(one({ cover: 'a.webp' }).key, one({}).key); assert.notEqual(one({ cover: 'a.webp' }).key, one({ cover: 'b.webp' }).key);
  assert.equal(one({ cover: 7 }).cover, null); assert.equal(one({ cover: 'x'.repeat(401) }).cover, null);
  assert.equal(one({ cover: 'a.webp' }).kind, 'tile', 'still the kind it was laid as');
});

// A canvas that only counts what is asked of it.
const counting = () => {
  const calls = { drawImage: [], rotate: 0, ops: [] };
  const ctx = new Proxy({}, { get: (_, k) => (k === 'canvas' ? null : k === 'drawImage' ? (...a) => { calls.drawImage.push(a); } : k === 'rotate' ? () => { calls.rotate++; }
    : k === 'createLinearGradient' || k === 'createRadialGradient' || k === 'createPattern' ? () => ({ addColorStop() {} })
    : k === 'getImageData' ? () => ({ data: new Uint8ClampedArray(4) }) : k === 'measureText' ? () => ({ width: 0 }) : () => {}),
  set: (_, k, v) => { if (k === 'globalCompositeOperation') calls.ops.push(v); return true; } });
  return { calls, make: (w, h) => ({ width: w, height: h, getContext: () => ctx }) };
};
const ROOM = { x: 0, y: 0, w: 400, h: 200 };

test('the painter lays the picture on every slope, tones each by the light, and still paints its weather', () => {
  const image = { tag: 'roofing' }, cover = { image, width: 800, height: 800, solidTo: 720, base: '#aa3c28', per: 200 };
  const { calls, make } = counting();
  const out = paintRoofPicture(ROOM, 'tile', { grid: 100, form: 'hip', cover, snow: 0.6, chimney: 'stone' }, make);
  assert.ok(out?.canvas); assert.ok(out.chimney, 'its chimney is still its own');
  assert.ok(calls.drawImage.length >= 4 && calls.drawImage.every((a) => a[0] === image), 'the picture, on each of its four slopes');
  assert.ok(calls.ops.includes('soft-light') && calls.ops.includes('multiply'), 'slopes toward the light paler, away from it darker');
  // Without one it is painted as it always was: no picture drawn at all.
  const plain = counting(); paintRoofPicture(ROOM, 'tile', { grid: 100, form: 'hip' }, plain.make);
  assert.equal(plain.calls.drawImage.length, 0);
  // A covering that has not arrived (no image) is no covering.
  const waiting = counting(); paintRoofPicture(ROOM, 'tile', { grid: 100, form: 'hip', cover: { image: null, width: 0, height: 0 } }, waiting.make);
  assert.equal(waiting.calls.drawImage.length, 0);
});

test('pictures are read once, answered at once, and the roofs told when one arrives', async () => {
  let loads = 0, told = [];
  const covers = createRoofCovers({ load: async (src) => { loads++; if (src === 'bad.webp') throw new Error('gone'); return { src }; }, read: () => ({ data: picture(16, 20, 18), width: 16, height: 20 }), changed: (src) => told.push(src) });
  assert.equal(covers.get(''), null); assert.equal(covers.state(''), 'none');
  assert.equal(covers.get('a.webp'), null, 'not yet'); assert.equal(covers.state('a.webp'), 'loading');
  await new Promise((r) => setTimeout(r, 5));
  const got = covers.get('a.webp');
  assert.deepEqual([got.width, got.height, got.solidTo, got.base, got.per], [16, 20, 18, '#aa3c28', COVER_PER_SQUARE]); assert.deepEqual(told, ['a.webp']); assert.equal(covers.state('a.webp'), 'ready');
  covers.get('a.webp'); covers.get('a.webp'); assert.equal(loads, 1, 'read once');
  covers.get('bad.webp'); await new Promise((r) => setTimeout(r, 5));
  assert.equal(covers.get('bad.webp'), null); assert.equal(covers.state('bad.webp'), 'failed'); assert.equal(loads, 2, 'and not asked for again'); assert.deepEqual(told, ['a.webp']);
});

test('the shell spells a covered roof\'s key one way everywhere, and the bar offers the picker', () => {
  const shell = readFileSync(new URL('../../../scripts/shell/painted-buildings.mjs', import.meta.url), 'utf8');
  assert.equal(shell.split('${roofSuffix()}${coverKey(').length - 1, 4, 'wherever a roof is asked about');
  assert.equal(/\$\{r(oof)?\.key\}\$\{roofSuffix\(\)\}(?!\$\{coverKey)/.test(shell), false, 'never without it');
  assert.match(shell, /key: `\$\{r\.key\}\$\{skyKey\}\$\{coverKey\(r\)\}`/);
  const bar = readFileSync(new URL('../../../scripts/ui/decor-brush-bar.mjs', import.meta.url), 'utf8'), paints = readFileSync(new URL('../../../scripts/shell/map-painting.mjs', import.meta.url), 'utf8');
  assert.match(bar, /roofCover: remembered\.roofCover \|\| null/); assert.ok(bar.includes("ownTiles('roof', 'roofCover'"));
  assert.match(paints, /choice\.roofCover \? \{ cover: String\(choice\.roofCover\)\.slice\(0, 400\) \}/); assert.match(paints, /pickRoofing:/);
});
