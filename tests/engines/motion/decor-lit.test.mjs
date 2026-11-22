// Light on a decoration (decor-lit.mjs): which lights fall on it, from where, and how strongly.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LIT_LIGHTS, LIT_OVERSAMPLE, LIT_FRAG, litUniforms, createLitMesh } from '../../../scripts/engines/motion/decor-lit.mjs';
import { paintKitPiece, RICH_IDS } from '../../../scripts/engines/motion/decor-kit.mjs';

const near = (a, b, e = 1e-5) => Math.abs(a - b) < e;
const dir = (u, i) => [...u.dirs.slice(i * 3, i * 3 + 3)], col = (u, i) => [...u.cols.slice(i * 4, i * 4 + 4)];

test('no lights: nothing on it, and the picture is left as painted', () => {
  const u = litUniforms({ at: { x: 0, y: 0 } });
  assert.equal(u.dirs.length, 3 * LIT_LIGHTS); assert.equal(u.cols.length, 4 * LIT_LIGHTS);
  assert.ok([...u.cols].every((v) => v === 0));
  assert.ok([...litUniforms({ sun: { angle: 1, length: 1, strength: 0 } }).cols].every((v) => v === 0));
});

test('the sun stands opposite the way its shadows fall, lower the longer they are', () => {
  // Shadows fall to the right (angle 0), as long as things are tall: the sun is to the left, 45 degrees up.
  const u = litUniforms({ sun: { angle: 0, length: 1, strength: 0.8 } }), d = dir(u, 0);
  assert.ok(near(d[0], -Math.SQRT1_2) && near(d[1], 0) && near(d[2], Math.SQRT1_2), String(d));
  assert.ok(near(col(u, 0)[3], 0.8));
  // Long shadows: a low sun. Short ones: a high sun.
  const low = dir(litUniforms({ sun: { angle: 0, length: 3, strength: 1 } }), 0), high = dir(litUniforms({ sun: { angle: 0, length: 0.3, strength: 1 } }), 0);
  assert.ok(low[2] < d[2] && d[2] < high[2]);
  // Shadows falling down the map: the sun is up it.
  assert.ok(dir(litUniforms({ sun: { angle: Math.PI / 2, length: 1, strength: 1 } }), 0)[1] < -0.7);
  // Its colour travels with it.
  assert.deepEqual(col(litUniforms({ sun: { angle: 0, length: 1, strength: 1, color: 0xff8000 } }), 0).slice(0, 3).map((v) => Math.round(v * 255)), [255, 128, 0]);
});

test('a lamp lights it from where it stands, less the further off, and not at all past its radius', () => {
  const at = { x: 500, y: 500 }, lamp = (x, y, more = {}) => ({ x, y, radius: 400, strength: 1, height: 90, ...more });
  const right = litUniforms({ at, lamps: [lamp(600, 500)] });
  assert.ok(dir(right, 0)[0] > 0.6 && near(dir(right, 0)[1], 0) && dir(right, 0)[2] > 0);
  const close = col(litUniforms({ at, lamps: [lamp(550, 500)] }), 0)[3], far = col(litUniforms({ at, lamps: [lamp(800, 500)] }), 0)[3];
  assert.ok(close > far && far > 0);
  assert.ok([...litUniforms({ at, lamps: [lamp(1000, 500)] }).cols].every((v) => v === 0));
  // Right over it: straight down, at its full strength.
  const over = litUniforms({ at, lamps: [lamp(500, 500)] }); assert.ok(near(dir(over, 0)[2], 1) && near(col(over, 0)[3], 1));
});

test('the sun first, then the strongest lamps, and never more than the shader has room for', () => {
  const at = { x: 0, y: 0 }, lamps = [50, 300, 100, 200, 150].map((x) => ({ x, y: 0, radius: 400, strength: 1 }));
  const u = litUniforms({ at, sun: { angle: 0, length: 1, strength: 0.5 }, lamps });
  assert.ok(dir(u, 0)[0] < 0, 'the sun is first');
  const amts = [1, 2, 3].map((i) => col(u, i)[3]);
  assert.ok(amts[0] > amts[1] && amts[1] > amts[2] && amts[2] > 0, String(amts));
  // The nearest three of the five.
  assert.ok(near(amts[2], (1 - 150 / 400) ** 2));
});

test('the shader leaves a flat surface as painted, and its names are safe', () => {
  // What is added is measured against a flat surface under the same light (dot(n, L) - L.z), so flat is nothing.
  assert.ok(LIT_FRAG.includes('dot(n, L) - L.z'));
  // `flat` is a word GLSL keeps for itself.
  assert.equal(/\bfloat flat\b/.test(LIT_FRAG), false);
  assert.ok(LIT_FRAG.includes(`uDir[${LIT_LIGHTS}]`));
});

test('painted finer than the grid, and lit the same however fine', () => {
  assert.equal(LIT_OVERSAMPLE, 2);
  // The slope is read across the same distance on the map: twice the texels when painted twice as fine.
  const made = [], PIXI = { Geometry: class { addAttribute() { return this; } addIndex() { return this; } }, Mesh: class { constructor(g, s) { this.shader = s; } }, Shader: { from: (v, f, uniforms) => { made.push(uniforms); return { uniforms }; } } };
  const tex = (w) => ({ width: w, height: w });
  createLitMesh(PIXI, { art: tex(200), maps: tex(200) }); createLitMesh(PIXI, { art: tex(400), maps: tex(400), oversample: 2 });
  assert.deepEqual(made[0].uTexel, made[1].uTexel);
});

test('a rich piece comes with what the engines need: no light painted in, a second picture, an outline, a height', () => {
  const make = (w, h) => ({ width: w, height: h, getContext: () => new Proxy({}, { get: (t, p) => (p in t ? t[p] : p.startsWith('create') ? () => ({ addColorStop() {} }) : () => {}), set: (t, p, v) => { t[p] = v; return true; } }) });
  for (const id of RICH_IDS) {
    const r = paintKitPiece(id, 3, 150, { finish: 'rich' }, make);
    // (A rug or a bed of straw lies flat: no height, so no shadow cast of it.)
    assert.ok(r.maps && r.shadow && r.height >= 0 && r.width === r.canvas.width, id);
    assert.equal(r.maps.width, r.canvas.width, id);
  }
  // A piece painted the first way has no second picture: it is drawn as a plain picture.
  assert.equal(paintKitPiece('crate', 3, 150, {}, make).maps, null);
  // Nothing in the richer finish paints light from a side or a shadow on the floor.
  const src = readFileSync(new URL('../../../scripts/engines/motion/decor-kit.mjs', import.meta.url), 'utf8'), rich = src.slice(src.indexOf('the richer finish (a trial)'), src.indexOf("/** The kit's pieces"));
  for (const word of ['softShadow(', 'lightOver(', 'g.translate(']) assert.equal(rich.includes(word), false, word);
  // The one gradient across a board (o.form) is the same on both its sides: the board's own roundness, not a light.
  assert.equal(rich.split('createLinearGradient').length - 1, 1);
  assert.ok(rich.includes("gr.addColorStop(0, 'rgba(24,10,0,0.38)')") && rich.includes("gr.addColorStop(1, 'rgba(24,10,0,0.38)')"));
});
