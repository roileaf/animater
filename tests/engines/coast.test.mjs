import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tideLevel, tideBand, coastHeard, COAST_SOUNDS, COAST_REACH, TIDE_HOURS, swashFront, swashFoam, swellStep, MAX_WAVES, shoreEdges, shoreField, shoreAt, shoreCode, shoreDecode, shorePixels, crabStep, crabSpots, createCoast, COAST_SHADER } from '../../scripts/engines/motion/coast.mjs';

const seeded = (n = 7) => () => { n = (n * 16807) % 2147483647; return (n - 1) / 2147483646; };
const square = (x, y, s) => [x, y, x + s, y, x + s, y + s, x, y + s];

test('the tide goes round in about 12.4 game hours, between -1 and 1', () => {
  const period = TIDE_HOURS * 3600;
  assert.ok(Math.abs(period - 44640) < 1);
  let low = 2, high = -2;
  for (let t = 0; t < period; t += 300) { const v = tideLevel(t, { seed: 'scene' }); low = Math.min(low, v); high = Math.max(high, v); assert.ok(Math.abs(tideLevel(t + period, { seed: 'scene' }) - v) < 1e-9, 'the same a round later'); }
  assert.ok(low >= -1 && low < -0.8, 'it goes well out');
  assert.ok(high <= 1 && high > 0.8, 'it comes well in');
  assert.notEqual(tideLevel(1000, { seed: 'a' }), tideLevel(1000, { seed: 'bb' }), 'each scene has its own');
  assert.equal(tideLevel(1000, { seed: 'a' }), tideLevel(1000, { seed: 'a' }), 'and keeps it');
  assert.ok(Number.isFinite(tideLevel(undefined)));
});

test('the band and the waterline move with the tide', () => {
  const high = tideBand(1, 100), low = tideBand(-1, 100);
  assert.ok(high.line > 0 && low.line < 0, 'in over the land, out into the region');
  assert.ok(low.width > high.width, 'the tide going out leaves the most wet sand');
  assert.ok(high.outer > low.outer, 'and the top of the band moves too');
  assert.equal(tideBand(2, 100).line, high.line, 'held to the range');
});

test('the sea is heard as far as 18 squares, the nearest listener and place', () => {
  const sea = square(0, 0, 100), ear = { x: 150, y: 50 }, far = { x: 100 + 18 * 100 + 5, y: 50 };
  assert.equal(COAST_REACH, 18);
  assert.ok(COAST_SOUNDS.length >= 1 && COAST_SOUNDS.every((f) => f.endsWith('.ogg')), 'the auditioned surf');
  assert.deepEqual(coastHeard([sea], [far], { grid: 100 }), { level: 0, from: null, at: null });
  const heard = coastHeard([sea], [far, ear], { grid: 100 });
  assert.equal(heard.from, ear);
  assert.equal(heard.at.x, 100); assert.equal(heard.at.y, 50);
  assert.ok(heard.level > 0.9 && heard.level <= 1);
  assert.equal(coastHeard([sea], [{ x: 50, y: 50 }], { grid: 100 }).level, 1, 'standing in it');
  assert.equal(coastHeard([], [ear]).level, 0);
});

test('a wave runs in fast and draws back slow, losing its foam', () => {
  assert.equal(swashFront(0), 0); assert.equal(swashFront(1), 0);
  assert.equal(swashFront(0.4), 1, 'the top of its run');
  assert.ok(swashFront(0.2) > 0.5, 'quick in');
  assert.ok(swashFront(0.7) > swashFront(0.9), 'going back');
  assert.ok(swashFoam(0.2) > swashFoam(0.7) && swashFoam(0.7) > swashFoam(0.95), 'foam thins on the way back');
  assert.equal(swashFoam(1), 0);
});

test('the waves come in irregular sets with quiet between, not a steady beat', () => {
  const random = seeded(); let s = null, last = null; const gaps = [], reaches = [];
  for (let t = 0; t < 600; t += 0.25) {
    const before = s?.waves.length ?? 0, seeds = new Set(s?.waves.map((w) => w.seed));
    s = swellStep(s, { dt: 0.25, wind: 0.3, random });
    assert.ok(s.waves.length <= MAX_WAVES);
    const fresh = s.waves.find((w) => !seeds.has(w.seed));
    if (fresh && (before < s.waves.length || seeds.size)) { if (last !== null) gaps.push(t - last); last = t; reaches.push(fresh.reach); }
  }
  assert.ok(gaps.length > 20);
  assert.ok(Math.max(...gaps) > 11, 'a lull between sets');
  assert.ok(Math.min(...gaps) < 8, 'closer within one');
  assert.ok(Math.max(...reaches) > Math.min(...reaches) * 1.3, 'some run further');
  const calm = swellStep(null, { dt: 0.1, wind: 0, random: () => 0.5 }), wild = swellStep(null, { dt: 0.1, wind: 1, random: () => 0.5 });
  assert.ok(wild.waves[0].reach > calm.waves[0].reach, 'wind sends them further');
});

test('the shore is not the edge of the map, nor where two seas meet', () => {
  const bounds = { x: 0, y: 0, width: 1000, height: 1000 };
  // Drawn up to the top edge of the map: three real sides.
  assert.equal(shoreEdges([[200, 0, 600, 0, 600, 400, 200, 400]], { bounds, grid: 100 }).length, 12);
  assert.equal(shoreEdges([[200, 0, 600, 0, 600, 400, 200, 400]], { grid: 100 }).length, 16, 'no map: all four');
  // Side by side: the side they share is no shore.
  assert.equal(shoreEdges([square(100, 100, 200), square(300, 100, 200)], { grid: 100 }).length, 24);
  const holed = square(100, 100, 400); holed.holes = [square(200, 200, 100)];
  assert.equal(shoreEdges([holed], { grid: 100 }).length, 32, 'an island has its shore');
});

test('how far from the shore: more than none in the water, less on land', () => {
  const field = shoreField([square(500, 500, 400)], { grid: 100, size: 256 });
  assert.ok(Math.abs(shoreAt(field, 700, 700) - 200) < 15, 'the middle of it');
  assert.ok(Math.abs(shoreAt(field, 400, 700) + 100) < 15, 'a square out on the land');
  assert.ok(Math.abs(shoreAt(field, 520, 700) - 20) < 15, 'just in');
  assert.ok(shoreAt(field, -5000, 0) < 0, 'off the picture counts as land');
  const big = shoreField([square(1000, 1000, 6000)], { grid: 100, size: 128, bounds: { x: 0, y: 0, width: 8000, height: 8000 } });
  assert.ok(big.cols <= 128 && big.rows <= 128, 'the picture is kept small');
  assert.equal(shoreField([square(0, 0, 500)], { bounds: { x: 0, y: 0, w: 500, h: 500 }, grid: 100 }), null, 'all sea: no shore');
  const holed = square(0, 0, 1000); holed.holes = [square(400, 400, 200)];
  assert.ok(shoreAt(shoreField([holed], { grid: 100 }), 500, 500) < 0, 'an island is land');
});

test('the distance goes into a picture and comes back, finest at the waterline', () => {
  const range = 500;
  for (const d of [0, 10, -10, 100, -300, 500, -500]) assert.ok(Math.abs(shoreDecode(shoreCode(d, range), range) - d) < 1e-9);
  assert.equal(shoreCode(9999, range), 1); assert.equal(shoreCode(-9999, range), 0);
  // One step of a byte, near the water and far out.
  const step = (d) => shoreDecode(shoreCode(d, range) + 1 / 255, range) - d;
  assert.ok(step(5) < step(300) / 4);
  const field = shoreField([square(500, 500, 400)], { grid: 100, size: 64 }), px = shorePixels(field);
  assert.equal(px.length, field.cols * field.rows * 4);
  assert.equal(px[3], 255, 'alpha stays out of it');
});

test('a crab scuttles sideways, stops, and keeps to the sand', () => {
  const c0 = { x: 0, y: 0, a: 0, side: 1, mode: 'still', left: 0.01, hide: 0 };
  let c = crabStep(c0, { dt: 0.05, random: () => 0.9 });
  assert.equal(c.mode, 'scuttle');
  c.a = 0; c.side = 1; c.left = 1;
  const moved = crabStep(c, { dt: 0.1, grid: 100 });
  assert.ok(moved.x > 5 && Math.abs(moved.y) < 1e-9, 'facing up the map, it goes across');
  const stopped = crabStep({ ...moved, left: 0.01 }, { dt: 0.1, grid: 100, random: () => 0.5 });
  assert.equal(stopped.mode, 'still');
  const edge = crabStep({ x: 0, y: 0, a: 0, side: 1, mode: 'scuttle', left: 1, hide: 0 }, { dt: 0.1, grid: 100, ok: (x) => x < 3 });
  assert.equal(edge.side, -1, 'turned back at the edge of the wet');
  assert.equal(edge.x, 0);
  const lost = crabStep({ x: 0, y: 0, a: 0, side: 1, mode: 'scuttle', left: 1, hide: 0 }, { dt: 0.1, grid: 100, ok: (x, y) => y > 20 });
  assert.ok(lost.y > 0, 'left high and dry, it makes for the sand');
});

test('a crab dives when anyone comes within 2 squares and stays down until they go', () => {
  const near = [{ x: 190, y: 0 }], c0 = { x: 0, y: 0, a: 0, side: 1, mode: 'still', left: 5, hide: 0 };
  assert.equal(crabStep(c0, { dt: 0.1, grid: 100, near: [{ x: 210, y: 0 }] }).mode, 'still', 'not yet');
  let c = crabStep(c0, { dt: 0.1, grid: 100, near });
  assert.equal(c.mode, 'dive');
  for (let i = 0; i < 5; i++) c = crabStep(c, { dt: 0.1, grid: 100, near, random: () => 0 });
  assert.equal(c.mode, 'under'); assert.equal(c.hide, 1);
  for (let i = 0; i < 100; i++) c = crabStep(c, { dt: 0.1, grid: 100, near: [{ x: 250, y: 0 }], random: () => 0 });
  assert.equal(c.mode, 'under', 'still someone within 3 squares');
  c = crabStep(c, { dt: 0.1, grid: 100, near: [] });
  assert.equal(c.mode, 'up');
  const back = crabStep(c, { dt: 0.1, grid: 100, near });
  assert.equal(back.mode, 'dive', 'back down if they return');
  for (let i = 0; i < 10; i++) c = crabStep(c, { dt: 0.1, grid: 100, random: () => 0 });
  assert.equal(c.mode, 'still'); assert.equal(c.hide, 0);
});

test('crabs start in the wet band', () => {
  const seas = [square(500, 500, 600)], field = shoreField(seas, { grid: 100 }), edges = shoreEdges(seas, { grid: 100 });
  for (const tide of [-1, 0, 1]) {
    const band = tideBand(tide, 100), spots = crabSpots(field, edges, { count: 5, line: band.line, width: band.width, grid: 100, random: seeded(11) });
    assert.equal(spots.length, 5);
    for (const c of spots) { const on = shoreAt(field, c.x, c.y) + band.line; assert.ok(on < 0 && on > -band.width, `tide ${tide}: ${on}`); }
  }
  assert.deepEqual(crabSpots(field, [], {}), []);
});

// Enough of PIXI to run the layer without a screen.
function fakePIXI() {
  class Thing {
    constructor() { this.children = []; this.visible = true; this.scale = { set() {} }; this.position = { set: (x, y) => { this.x = x; this.y = y; } }; this.anchor = { set() {} }; }
    addChild(c) { c.parent = this; this.children.push(c); return c; }
    removeChild(c) { this.children = this.children.filter((o) => o !== c); }
    destroy() { this.destroyed = true; }
  }
  class Sprite extends Thing { constructor(texture) { super(); this.texture = texture; } }
  class Mesh extends Thing { constructor(geometry, shader) { super(); this.geometry = geometry; this.shader = shader; } }
  class Geometry { addAttribute() { return this; } addIndex() { return this; } getBuffer() { return { update() {} }; } }
  class Buffer { constructor(data) { this.data = data; } }
  return { Container: Thing, Sprite, Mesh, Geometry, Buffer, Shader: { from: (v, f, uniforms) => ({ uniforms }) }, Texture: { from: () => ({ baseTexture: {} }), fromBuffer: (data, w, h) => ({ data, w, h, destroy() { this.gone = true; } }) }, SCALE_MODES: { LINEAR: 1 }, MIPMAP_MODES: { OFF: 0 } };
}
const paper = new Proxy({}, { get: () => () => ({ addColorStop() {} }), set: () => true });
globalThis.document ??= { createElement: () => ({ getContext: () => paper }) };

test('the layer: builds, stays out of the way when out of view, stills, and clears', () => {
  const PIXI = fakePIXI(), root = new PIXI.Container(), coast = createCoast({ PIXI, floor: () => root });
  assert.equal(coast.busy, false);
  coast.build({ seas: [], grid: 100 });
  assert.equal(coast.busy, false, 'nothing to do');
  coast.tick(0.1, {});
  coast.look({ tide: 1, wind: 0.5, windAngle: 1, light: 0.5, frozen: false });
  coast.build({ seas: [square(500, 500, 800)], grid: 100, bounds: { x: 0, y: 0, width: 3000, height: 3000 }, crabs: 3, random: seeded() });
  assert.equal(coast.busy, true); assert.equal(coast.count, 3);
  const mesh = root.children.find((c) => c.shader), u = mesh.shader.uniforms;
  assert.equal(u.uLine, tideBand(1, 100).line, 'the tide it was told before it was built');
  assert.ok(u.uWaves.some((v) => v > 0), 'the sea is already going');

  coast.tick(0.05, { view: { x: 5000, y: 5000, w: 100, h: 100 } });
  assert.equal(mesh.visible, false, 'out of view');
  const was = u.uTime;
  coast.tick(0.05, { view: { x: 5000, y: 5000, w: 100, h: 100 } });
  assert.equal(u.uTime, was, 'and paused');

  const sounds = [];
  coast.tick(0.05, { view: { x: 0, y: 0, w: 3000, h: 3000 }, near: [], sound: (k) => sounds.push(k) });
  assert.equal(mesh.visible, true); assert.ok(u.uTime > was);
  coast.look({ tide: -1 });
  assert.equal(u.uLine, tideBand(-1, 100).line);

  coast.look({ frozen: true });
  assert.equal(u.uFrozen, 1);
  const still = u.uTime, waves = [...u.uWaves];
  coast.tick(0.05, { view: { x: 0, y: 0, w: 3000, h: 3000 } });
  assert.equal(u.uTime, still); assert.deepEqual([...u.uWaves], waves, 'hung still');

  coast.clear();
  assert.equal(coast.busy, false); assert.equal(coast.count, 0);
  assert.equal(root.children.filter((c) => c.shader).length, 0);
  assert.ok(mesh.destroyed);
  coast.tick(0.05, {});
});

test('the shader says what it uses', () => {
  for (const name of ['uField', 'uRect', 'uWaves', 'uDrift', 'uGrid', 'uTime', 'uLine', 'uWidth', 'uRange', 'uLight', 'uFrozen']) assert.ok(COAST_SHADER.frag.includes(`${name}`), name);
  assert.ok(!/\b(texture|in|out)\s*\(/.test(COAST_SHADER.frag), 'WebGL1: texture2D, no WebGL2 words');
  const count = (s, c) => s.split(c).length - 1;
  assert.equal(count(COAST_SHADER.frag, '{'), count(COAST_SHADER.frag, '}'));
});
