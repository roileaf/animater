import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { ART_GROUPS, drawnBox, fitOf, restyle, setAnimalSheet, loadAnimalArt, keyLightOf, nearestLamps, litPIXI, setAnimalLight, animalLightNow } from '../../../scripts/engines/motion/animal-art.mjs';

test('the animals are lit from where the sun stands, the moon more softly, the painted top left with neither', () => {
  const noon = keyLightOf({ angle: 90, height: 90, strength: 1 });
  assert.ok(noon.dir[2] > 0.99 && noon.on === 1);
  const east = keyLightOf({ angle: 0, height: 20, strength: 1 });
  assert.ok(east.dir[0] > 0.9 && Math.abs(east.dir[1]) < 1e-9, 'a low sun to the east lights them from the right');
  assert.equal(keyLightOf({ angle: 0, height: 30, strength: 1, moon: true }).on, 0.6);
  assert.deepEqual(keyLightOf(null), { dir: [-0.43, -0.48, 0.76], on: 0.35 });
});

test('the lamps lighting an animal are the nearest ones that reach, nearest first', () => {
  const lamps = [{ x: 0, y: 0, radius: 100 }, { x: 500, y: 0, radius: 100 }, { x: 30, y: 0, radius: 300 }, { x: 10, y: 0, radius: 0 }];
  assert.deepEqual(nearestLamps(lamps, { x: 0, y: 0 }).map((l) => l.x), [0, 30]);
  setAnimalLight({ sun: { angle: 0, height: 30, strength: 1 }, lamps, at: { x: 0, y: 0 } });
  assert.equal(animalLightNow().lampCount, 2);
});

test('a shadow is drawn out away from the sun, longer the lower it stands, and away from a near lamp in the dark', async () => {
  const { shadowStretch } = await import('../../../scripts/engines/motion/animal-art.mjs');
  const sunAt = (deg, height) => { const a = deg * Math.PI / 180, h = height * Math.PI / 180; return { key: [Math.cos(a) * Math.cos(h), Math.sin(a) * Math.cos(h), Math.sin(h)], keyOn: 1, lamps: new Float32Array(24), lampCount: 0 }; };
  const east = shadowStretch(sunAt(0, 40), 0, 0);
  assert.ok(Math.abs(Math.abs(east.dir) - Math.PI) < 1e-6, 'a sun in the east throws it west');
  assert.ok(shadowStretch(sunAt(0, 15), 0, 0).k > shadowStretch(sunAt(0, 60), 0, 0).k, 'longer at evening than at noon');
  const lamps = new Float32Array(24); lamps.set([100, 0, 300, 1]);
  const night = shadowStretch({ ...sunAt(0, 40), lamps, lampCount: 1 }, 0, 0, 0.9);
  assert.ok(Math.abs(Math.abs(night.dir) - Math.PI) < 1e-6 && night.k > 1.5, 'away from the lamp to its east');
  assert.equal(shadowStretch({ key: [0, 0, 1], keyOn: 1, lamps, lampCount: 0 }, 0, 0), null, 'a sun straight overhead throws none out');
});

test('the engines get PIXI with its Sprite lit, all else the same', () => {
  class Sprite { _render() {} }
  const PIXI = { Sprite, Texture: { EMPTY: {} }, extra: 1 };
  const lit = litPIXI(PIXI);
  assert.notEqual(lit.Sprite, Sprite); assert.ok(new lit.Sprite() instanceof Sprite);
  assert.equal(lit.Texture, PIXI.Texture); assert.equal(lit.extra, 1);
  assert.equal(litPIXI(lit), lit, 'not wrapped twice');
});

const root = new URL('../../../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');

test('the drawn part of a picture is found by its alpha, and nothing drawn is nothing', () => {
  const w = 6, h = 5, data = new Uint8ClampedArray(w * h * 4);
  for (const [x, y] of [[2, 1], [4, 3], [3, 2]]) data[(y * w + x) * 4 + 3] = 255;
  assert.deepEqual(drawnBox(data, w, h), { x: 2, y: 1, w: 3, h: 3 });
  assert.equal(drawnBox(new Uint8ClampedArray(w * h * 4), w, h), null);
});

test('a baked picture is laid over the engine frame as long as its animal and on its middle', () => {
  const own = { x: 10, y: 20, w: 20, h: 40 }, baked = { x: 50, y: 40, w: 40, h: 80 };
  const fit = fitOf(own, baked);
  assert.equal(fit.scale, 0.5);
  // the baked box's middle (70, 80) lands on the engine's (20, 40)
  assert.equal(70 * fit.scale + fit.dx, 20); assert.equal(80 * fit.scale + fit.dy, 40);
  // a rat drawn facing right is matched across the picture
  assert.equal(fitOf({ x: 0, y: 0, w: 60, h: 20 }, { x: 0, y: 0, w: 30, h: 90 }, true).scale, 2);
  assert.equal(fitOf(null, baked), null);
  assert.equal(fitOf(own, { x: 0, y: 0, w: 0, h: 0 }), null);
});

test('without its sheet, or without a canvas to draw on, an engine set comes back untouched', () => {
  const tex = { baseTexture: {} }, set = { stand: tex, walk: [tex, tex] };
  setAnimalSheet('town', null);
  assert.equal(restyle({}, 'town', set, 'pigeon/0'), set);
  setAnimalSheet('town', { map: { cell: 8, cols: 1, frames: { 'pigeon/0/stand': { i: 0, ref: 'pigeon/0/stand' } } }, img: {} });
  assert.equal(restyle({}, 'town', set, 'pigeon/0'), set, 'no document in node: drawn as it was');
  setAnimalSheet('town', null);
});

test('the sheets load once, a missing one leaving its group as drawn', async () => {
  const asked = [];
  await loadAnimalArt({ base: 'x', fetchJson: async (u) => { asked.push(u); return u.includes('town') ? { frames: {} } : null; }, loadImage: async () => ({}) });
  await loadAnimalArt({ fetchJson: async () => { throw new Error('asked twice'); } });
  assert.deepEqual(asked.sort(), ART_GROUPS.map((g) => `x/${g}.json`).sort());
});

test('every animal engine hands its frames through restyle under its own group, and main gives it to all of them', () => {
  const wants = { 'town-life': ["'town'", "'pigeon'", "'hen'", '`cat/${i}`', '`dog/${i}`'], wildlife: ["'wildlife'"], 'field-life': ["'field'", "'herd'", "'fox'", "'wolf'", "'squirrel'", "'snake'", "'fly'", "'owl'", "'bat'"], 'pond-life': ["'pond'"], 'farm-life': ["'farm'", '`${kind}/${coat}`'], vermin: ["'vermin'", "'rat'", "'bat'"] };
  for (const [file, names] of Object.entries(wants)) {
    const src = read(`scripts/engines/motion/${file}.mjs`);
    assert.match(src, /restyle = null/, `${file} takes restyle`);
    for (const n of names) assert.ok(src.includes(n), `${file} names ${n}`);
  }
  const main = read('scripts/main.mjs');
  const calls = main.match(/create(TownLife|Wildlife|FieldLife|PondLife|FarmLife|Vermin)\(\{[^}]*\}/g) ?? [];
  assert.ok(calls.length >= 11);
  for (const c of calls) assert.match(c, /restyle: animalLook/, c);
  assert.match(main, /loadAnimalArt\(\)/);
});

test('each group has its baked sheet and map, every frame placed in the sheet and fitted by a frame of its own', () => {
  for (const g of ART_GROUPS) {
    assert.ok(existsSync(new URL(`assets/animals/${g}.webp`, root)), `${g}.webp`);
    const map = JSON.parse(read(`assets/animals/${g}.json`)), frames = Object.entries(map.frames), cells = new Set();
    assert.ok(map.cell > 0 && map.cols > 0 && frames.length > 0, g);
    for (const [path, f] of frames) {
      assert.ok(Number.isInteger(f.i) && f.i >= 0, `${g} ${path}`);
      assert.ok(!cells.has(f.i), `${g} ${path} shares a cell`); cells.add(f.i);
      assert.ok(map.frames[f.ref], `${g} ${path} fitted by ${f.ref}`);
    }
  }
});
