import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mirrorOf, mirrorWobble, nearestFirst, lampColumn, moonPath, colorOf, MAX_MIRRORS, MAX_COLUMNS, createWaterMirror, WATER_MIRROR_SHADER } from '../../scripts/engines/motion/water-mirror.mjs';

const square = (x, y, s) => [x, y, x + s, y, x + s, y + s, x, y + s];
const pond = square(1000, 1000, 600);
const token = (over = {}) => ({ id: 'a', texture: { valid: true, width: 200, height: 200 }, x: 1300, y: 900, w: 100, h: 100, rotation: 0, alpha: 1, ...over });

test('someone on the bank mirrors into the pond from their feet', () => {
  const spot = mirrorOf(token(), [pond], { grid: 100 });
  assert.equal(spot.foot, 950);
  assert.equal(spot.x, 1300);
  assert.ok(spot.y > spot.foot, 'down the map');
  assert.ok(spot.h > 100, 'a little stretched');
  assert.equal(spot.y, spot.foot + spot.h / 2, 'the copy starts at their feet');
  assert.equal(spot.distance, 50);
  assert.ok(spot.wet > 0 && spot.wet < 1, 'only the part over the water lands on it');
  assert.ok(spot.alpha > 0 && spot.alpha < 1);
});

test('no mirror from further than 2 squares from water', () => {
  assert.ok(mirrorOf(token({ y: 1000 - 190 - 50 }), [pond], { grid: 100 }), 'just within');
  assert.equal(mirrorOf(token({ y: 1000 - 210 - 50 }), [pond], { grid: 100 }), null);
  assert.equal(mirrorOf(token(), [], { grid: 100 }), null, 'no water');
  const big = mirrorOf(token({ y: 1000 - 210 - 50 }), [pond], { grid: 200 });
  assert.ok(big, 'counted in squares');
});

test('no mirror in rough water', () => {
  const race = square(1200, 1200, 200);
  assert.equal(mirrorOf(token({ y: 1300 }), [pond], { grid: 100, rough: [race] }), null, 'standing in it');
  const beside = mirrorOf(token({ x: 1100, y: 1300 }), [pond], { grid: 100, rough: [race] });
  assert.ok(beside, 'calm next to it');
  assert.equal(beside.distance, 0); assert.equal(beside.wet, 1);
  const above = mirrorOf(token({ y: 1100 }), [pond], { grid: 100, rough: [race] });
  assert.ok(above.wet < 1, 'what lands on the rough shows nothing');
});

test('standing below the water, nothing of the copy lands on it', () => {
  const spot = mirrorOf(token({ y: 1650 }), [pond], { grid: 100 });
  assert.equal(spot.wet, 0);
});

test('the copy turns the other way, and fades with distance and with its token', () => {
  assert.equal(mirrorOf(token({ rotation: 0.5 }), [pond], { grid: 100 }).rotation, -0.5);
  const close = mirrorOf(token({ y: 1000 }), [pond], { grid: 100 }), far = mirrorOf(token({ y: 800 }), [pond], { grid: 100 });
  assert.ok(close.alpha > far.alpha);
  assert.ok(mirrorOf(token({ alpha: 0.5 }), [pond], { grid: 100 }).alpha < mirrorOf(token(), [pond], { grid: 100 }).alpha);
});

test('the tremble is small, goes both ways, and more in wind', () => {
  let most = 0, least = 0, windy = 0;
  for (let t = 0; t < 30; t += 0.05) { const w = mirrorWobble(t, 1, 0); most = Math.max(most, w.skew); least = Math.min(least, w.skew); windy = Math.max(windy, mirrorWobble(t, 1, 1).skew); assert.ok(Math.abs(w.stretch - 1) < 0.05); }
  assert.ok(most > 0 && least < 0); assert.ok(most < 0.05);
  assert.ok(windy > most * 1.5); assert.ok(windy < 0.1);
});

test('nearest the middle of the view first, up to the limit', () => {
  const list = [{ id: 1, x: 0, y: 0 }, { id: 2, x: 500, y: 500 }, { id: 3, x: 400, y: 400 }];
  const view = { x: 0, y: 0, w: 1000, h: 1000 };
  assert.deepEqual(nearestFirst(list, view, 2).map((o) => o.id), [2, 3]);
  assert.equal(list[0].id, 1, 'leaving the list as it was');
  assert.deepEqual(nearestFirst(list, null, 2).map((o) => o.id), [1, 2]);
  assert.equal(MAX_MIRRORS, 12);
});

test('a lamp within 4 squares throws its colour down the map', () => {
  const c = lampColumn({ x: 1300, y: 950, color: 0xff8800, radius: 300 }, [pond], { grid: 100 });
  assert.equal(c.x, 1300); assert.equal(c.y, 950);
  assert.ok(c.len >= 400); assert.ok(c.wet > 0.5);
  assert.deepEqual(c.color, [1, 136 / 255, 0]);
  assert.equal(lampColumn({ x: 1300, y: 1000 - 410, radius: 300 }, [pond], { grid: 100 }), null, 'too far');
  assert.ok(lampColumn({ x: 1300, y: 1000 - 390, radius: 300 }, [pond], { grid: 100 }));
  assert.equal(lampColumn({ x: 1300, y: 1650 }, [pond], { grid: 100 }).wet, 0, 'below the water it throws nowhere');
  const night = lampColumn({ x: 1300, y: 950 }, [pond], { grid: 100 }), day = lampColumn({ x: 1300, y: 950 }, [pond], { grid: 100, sunny: true });
  assert.ok(day.strength < night.strength, 'lost in daylight');
  assert.ok(lampColumn({ x: 1300, y: 950 }, [pond], { grid: 100 }).strength > lampColumn({ x: 1300, y: 650 }, [pond], { grid: 100 }).strength, 'stronger close by');
});

test('colours as they come', () => {
  assert.deepEqual(colorOf(0xff0000), [1, 0, 0]);
  assert.deepEqual(colorOf('#00ff00'), [0, 1, 0]);
  assert.deepEqual(colorOf(new Number(0x0000ff)), [0, 0, 1]);
  assert.equal(colorOf(null).length, 3, 'firelight if none');
});

test('the moon comes down the water to the bottom of the view', () => {
  const view = { x: 0, y: 500, w: 1000, h: 1000 };
  assert.equal(moonPath(null, view), null);
  assert.equal(moonPath({ x: 1, y: 1, strength: 0 }, view), null);
  const p = moonPath({ x: 400, y: 800, strength: 0.7 }, view, { grid: 100 });
  assert.equal(p.y, 800); assert.equal(p.y + p.len, 1600); assert.equal(p.strength, 0.7);
  assert.equal(moonPath({ x: 400, y: 0, strength: 1 }, view, { grid: 100 }).y, 400, 'from just above the view');
  assert.equal(moonPath({ x: 400, y: 5000, strength: 1 }, view, { grid: 100 }), null, 'below it');
  assert.ok(moonPath({ x: 1, y: 1, strength: 1 }, null, { grid: 100 }).len > 0);
});

function fakePIXI() {
  let made = 0;
  class Thing {
    constructor() { this.children = []; this.visible = true; this.scale = { x: 1, y: 1, set: (x, y) => { this.scale.x = x; this.scale.y = y; } }; this.skew = { x: 0 }; this.position = { set: (x, y) => { this.x = x; this.y = y; } }; this.anchor = { set() {} }; }
    addChild(c) { c.parent = this; this.children.push(c); return c; }
    addChildAt(c, i) { c.parent = this; this.children.splice(i, 0, c); return c; }
    removeChild(c) { this.children = this.children.filter((o) => o !== c); }
    destroy() { this.destroyed = true; for (const c of this.children) c.destroy(); }
  }
  class Sprite extends Thing { constructor(texture) { super(); this.texture = texture; made++; } }
  class Mesh extends Thing { constructor(geometry, shader) { super(); this.geometry = geometry; this.shader = shader; } }
  class Graphics extends Thing { constructor() { super(); this.polys = 0; this.cuts = 0; this.inHole = false; } clear() { this.polys = this.cuts = 0; } beginFill() {} endFill() {} drawPolygon() { if (this.inHole) this.cuts++; else this.polys++; } beginHole() { this.inHole = true; } endHole() { this.inHole = false; } }
  class Geometry { constructor() { this.buffers = {}; } addAttribute(name, buffer) { this.buffers[name] = buffer; return this; } addIndex() { return this; } getBuffer(name) { return this.buffers[name]; } }
  class Buffer { constructor(data) { this.data = data; this.updates = 0; } update() { this.updates++; } }
  return { Container: Thing, Sprite, Mesh, Graphics, Geometry, Buffer, Shader: { from: (v, f, uniforms) => ({ uniforms }) }, get made() { return made; } };
}

test('the layer: at most 12 copies, nearest first, the sprites used over', () => {
  const PIXI = fakePIXI(), root = new PIXI.Container(), layer = createWaterMirror({ PIXI, root: () => root, grid: () => 100 }), view = { x: 1000, y: 800, w: 600, h: 800 };
  assert.equal(layer.busy, false);
  layer.tick(0.1, { view });
  assert.equal(root.children.length, 0, 'made only when there is something to show');
  layer.water([pond]);
  const crowd = Array.from({ length: 20 }, (_, i) => token({ id: `t${i}`, x: 1020 + i * 28, y: 1300 }));
  layer.look({ tokens: crowd, lamps: [], moon: null, sunny: true });
  assert.equal(layer.busy, true);
  layer.tick(0.05, { view, wind: 0.2 });
  const holder = root.children[0], inner = holder.children[0];
  const on = () => inner.children.filter((c) => c.texture && c.visible);
  assert.equal(on().length, 12);
  assert.ok(on().every((s) => s.scale.y < 0), 'flipped');
  assert.ok(on().some((s) => s.skew.x !== 0), 'trembling');
  // The ones nearest the middle are the ones that show.
  assert.ok(on().every((s) => Math.abs(s.x - 1300) < 200));
  assert.equal(inner.mask, holder.children[1], 'cut to the water');

  const made = PIXI.made;
  for (let i = 0; i < 5; i++) { layer.look({ tokens: crowd.map((t) => ({ ...t, y: t.y + i })), lamps: [], moon: null, sunny: true }); layer.tick(0.3, { view }); }
  assert.equal(PIXI.made, made, 'no new sprites');

  layer.look({ tokens: crowd.slice(0, 2), lamps: [], moon: null, sunny: true });
  layer.tick(0.3, { view });
  assert.equal(on().length, 2, 'the rest put away');

  const out = { x: 9000, y: 9000, w: 100, h: 100 };
  layer.tick(0.05, { view: out });
  assert.equal(holder.visible, false, 'out of view');
  layer.tick(0.05, { view });
  assert.equal(holder.visible, true);

  layer.clear();
  assert.equal(layer.busy, false); assert.ok(holder.destroyed);
  assert.equal(root.children.length, 0);
  layer.tick(0.05, { view });
});

test('the layer: lamps and the moon go in one mesh, the moon not by day', () => {
  const PIXI = fakePIXI(), root = new PIXI.Container(), layer = createWaterMirror({ PIXI, root: () => root, grid: () => 100 }), view = { x: 1000, y: 800, w: 600, h: 800 };
  layer.water([pond]);
  const lamps = Array.from({ length: MAX_COLUMNS + 4 }, (_, i) => ({ x: 1020 + i * 40, y: 950, color: 0xffaa66, radius: 300 }));
  layer.look({ tokens: [], lamps, moon: { x: 1200, y: 1000, strength: 0.8 }, sunny: false });
  layer.tick(0.05, { view });
  const inner = root.children[0].children[0], mesh = inner.children.find((c) => c.shader), band = mesh.geometry.getBuffer('aBand').data, pos = mesh.geometry.getBuffer('aVertexPosition').data;
  assert.equal(mesh.visible, true);
  const kinds = []; for (let i = 0; i < MAX_COLUMNS + 1; i++) if (pos[i * 8 + 5] !== 0) kinds.push(band[i * 16 + 3]);
  assert.equal(kinds.filter((k) => k === 0).length, MAX_COLUMNS, 'only as many columns as it can hold');
  assert.equal(kinds.filter((k) => k === 1).length, 1, 'and the moon');

  const updates = mesh.geometry.getBuffer('aBand').updates;
  layer.look({ tokens: [], lamps, moon: { x: 1200, y: 1000, strength: 0.8 }, sunny: false });
  layer.tick(0.05, { view });
  assert.equal(mesh.geometry.getBuffer('aBand').updates, updates, 'nothing changed: nothing worked out again');

  layer.look({ tokens: [], lamps: [], moon: { x: 1200, y: 1000, strength: 0.8 }, sunny: true });
  layer.tick(0.05, { view });
  assert.equal(mesh.visible, false, 'no moon by day');
  layer.clear();
});

test('rough water inside calm water is cut from the mask; beside it, left alone', () => {
  const PIXI = fakePIXI(), root = new PIXI.Container(), layer = createWaterMirror({ PIXI, root: () => root, grid: () => 100 }), view = { x: 1000, y: 800, w: 600, h: 800 };
  layer.water([pond], { rough: [square(1200, 1200, 100), square(5000, 5000, 100)] });
  layer.look({ tokens: [token()], lamps: [], moon: null, sunny: true });
  layer.tick(0.05, { view });
  const mask = root.children[0].children[1];
  assert.equal(mask.polys, 1); assert.equal(mask.cuts, 1);
  layer.clear();
});

test('the shader is written for WebGL1', () => {
  assert.ok(!/#version|\btexture\s*\(|\bout vec4\b/.test(WATER_MIRROR_SHADER.frag));
  assert.ok(WATER_MIRROR_SHADER.vert.includes('attribute vec4 aBand'));
  assert.equal(WATER_MIRROR_SHADER.frag.split('{').length, WATER_MIRROR_SHADER.frag.split('}').length);
});
