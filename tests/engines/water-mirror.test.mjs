import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mirrorOf, mirrorsOf, tileMirrors, mirrorWobble, nearestFirst, lampColumn, moonPath, colorOf, MAX_MIRRORS, MAX_COLUMNS, createWaterMirror, WATER_MIRROR_SHADER } from '../../scripts/engines/motion/water-mirror.mjs';

const square = (x, y, s) => [x, y, x + s, y, x + s, y + s, x, y + s];
const pond = square(1000, 1000, 600);
const token = (over = {}) => ({ id: 'a', texture: { valid: true, width: 200, height: 200 }, x: 1300, y: 900, w: 100, h: 100, rotation: 0, alpha: 1, ...over });

test('a wall between something and the water hides its reflection', () => {
  const wallAt = (y) => (a, b) => Math.min(a.y, b.y) < y && Math.max(a.y, b.y) > y;
  assert.equal(mirrorOf(token(), [pond], { grid: 100, blocked: wallAt(975) }), null, 'a wall between them');
  assert.ok(mirrorOf(token(), [pond], { grid: 100, blocked: wallAt(800) }).wet > 0, 'a wall behind them');
  assert.ok(mirrorOf(token(), [pond], { grid: 100, blocked: () => false }).wet > 0);
  const blood = token({ id: 'tile:blood' });
  assert.deepEqual(tileMirrors([blood], [pond], { grid: 100, blocked: wallAt(975) }), [], 'blood on the floor indoors');
  assert.equal(tileMirrors([blood], [pond], { grid: 100, blocked: wallAt(800) }).length, 1);
});

test('the wall test starts just off a thing that stands on the wall line, and ends on the water', () => {
  const lines = [];
  mirrorOf(token(), [pond], { grid: 100, blocked: (a, b) => { lines.push([a, b]); return false; } });
  assert.equal(lines.length, 1);
  assert.equal(lines[0][0].y, 901, 'off its own middle');
  assert.ok(Math.abs(lines[0][1].y - 1000) < 2, 'at the shore');
});

test('nothing asks about walls when no water would show', () => {
  let asked = 0;
  mirrorOf(token({ y: 1000 - 130 - 50 }), [pond], { grid: 100, blocked: () => { asked++; return true; } });
  assert.equal(asked, 0);
});

test('a lamp behind a wall throws no light on the water', () => {
  const lamp = { x: 1300, y: 900, color: 0xff0000, radius: 200 };
  assert.ok(lampColumn(lamp, [pond], { grid: 100 }).wet > 0);
  assert.equal(lampColumn(lamp, [pond], { grid: 100, blocked: () => true }).wet, 0);
  assert.ok(lampColumn(lamp, [pond], { grid: 100, blocked: () => false }).wet > 0);
});

test('a door opening shows again what it hid, without anything moving', () => {
  let shut = true;
  const added = [];
  const PIXI = { Container: class { addChild() {} addChildAt(c) { added.push(c); } destroy() {} }, Graphics: class { clear() {} beginFill() {} drawPolygon() {} endFill() {} beginHole() {} endHole() {} }, Sprite: class { constructor(t) { this.texture = t; this.anchor = { set() {} }; this.scale = { set() {} }; this.position = { set() {} }; this.skew = {}; } }, Mesh: class { constructor(g) { this.geometry = g; } }, Geometry: class { addAttribute() { return this; } addIndex() { return this; } getBuffer() { return { update() {} }; } }, Buffer: class {}, Shader: { from: () => ({}) } };
  const mirror = createWaterMirror({ PIXI, root: () => ({ addChild() {} }), grid: () => 100, blocked: () => shut });
  mirror.water([pond]);
  mirror.tiles([token({ id: 'tile:blood' })]);
  assert.equal(mirror.busy, false, 'behind the wall');
  shut = false; mirror.walls();
  assert.equal(mirror.busy, true, 'the door is open');
  mirror.tick(0.016, { view: { x: 900, y: 500, w: 1000, h: 1000 } });
  shut = true; mirror.walls();
  assert.equal(mirror.busy, true, 'still drawn: the next ticks fade out what the door now hides');
  for (let i = 0; i < 90; i++) mirror.tick(0.016, { view: { x: 900, y: 500, w: 1000, h: 1000 } });
  assert.equal(mirror.busy, false, 'cleared, and nothing left to do');
});

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

test('how far off a creature reflects goes by its own length', () => {
  assert.ok(mirrorOf(token({ y: 1000 - 100 - 50 }), [pond], { grid: 100 }).wet > 0, 'its head still reaches the water');
  assert.equal(mirrorOf(token({ y: 1000 - 130 - 50 }), [pond], { grid: 100 }).wet, 0, 'its length falls short');
  assert.equal(mirrorOf(token({ y: 1000 - 300 - 50 }), [pond], { grid: 100 }), null, 'too far to matter');
  assert.equal(mirrorOf(token(), [], { grid: 100 }), null, 'no water');
  const big = mirrorOf(token({ y: 1000 - 300 - 150, h: 300, w: 300 }), [pond], { grid: 100 });
  assert.ok(big.wet > 0, 'a big creature reaches from further off');
});

test('the further from the edge, the less shows and the fainter it is', () => {
  const at = (gap) => mirrorOf(token({ y: 1000 - gap - 50 }), [pond], { grid: 100 });
  assert.equal(at(0).down, 0);
  assert.ok(Math.abs(at(50).down - 50) < 4, String(at(50).down));
  assert.ok(at(0).wet > at(50).wet && at(50).wet > at(100).wet);
  assert.ok(at(0).alpha > at(50).alpha && at(50).alpha > at(100).alpha);
});

test('tiles by the water show in it; hidden, map-sized and far ones do not', () => {
  const tile = (over = {}) => ({ id: 'tile:a', texture: { valid: true, width: 200, height: 200 }, x: 1300, y: 900, w: 100, h: 100, rotation: 0, alpha: 1, ...over });
  const [tree] = tileMirrors([tile()], [pond], { grid: 100 });
  assert.ok(tree.wet > 0); assert.equal(tree.h, 100, 'not stretched'); assert.ok(tree.texture);
  assert.deepEqual(tileMirrors([tile({ hidden: true })], [pond], { grid: 100 }), []);
  assert.deepEqual(tileMirrors([tile({ w: 1300, h: 1300 })], [pond], { grid: 100 }), [], 'a map overlay');
  assert.deepEqual(tileMirrors([tile({ y: 300 })], [pond], { grid: 100 }), [], 'too far');
  assert.deepEqual(tileMirrors([tile()], [], { grid: 100 }), []);
});

// Roi: walking Celdar up and down over the river, his reflection jumped from one side to the other; with water on both
// sides both should show. Each water within reach shows its own copy, each fading with its own distance.
test('each water within reach shows its own copy; wading, only the one down the map', () => {
  const ways = (t, areas = [pond]) => mirrorsOf(token(t), areas, { grid: 100 }).map((s) => s.dir).sort();
  assert.deepEqual(ways({ x: 1300, y: 950 }), [0], 'on the north bank: into the pond below');
  assert.deepEqual(ways({ x: 950, y: 1300 }), [2], 'on the west bank: into the pond beside');
  assert.deepEqual(ways({ x: 1300, y: 1650 }), [1], 'on the south bank: up into it');
  // A river running across the map, a bridge over it down the map: from the bridge the water lies to either side.
  const river = [0, 1000, 3000, 1000, 3000, 1400, 0, 1400], bridge = [1250, 950, 1350, 950, 1350, 1450, 1250, 1450];
  assert.deepEqual(ways({ x: 1300, y: 1200 }, [river]), [0], 'standing in the river: wading');
  assert.deepEqual(mirrorsOf(token({ x: 1300, y: 1200 }), [river], { grid: 100, decks: [bridge] }).map((s) => s.dir).sort(), [2, 3], 'on the bridge: the water on both sides, none on the deck');
  // A pier out into the pond from its north bank: in its middle, water to the east, west and south.
  const pier = [1250, 900, 1350, 900, 1350, 1300, 1250, 1300];
  assert.deepEqual(mirrorsOf(token({ x: 1300, y: 1200 }), [pond], { grid: 100, decks: [pier] }).map((s) => s.dir).sort(), [0, 2, 3]);
  const side = mirrorsOf(token({ x: 950, y: 1300 }), [pond], { grid: 100 })[0];
  assert.equal(side.footX, 1000, 'from the edge facing the water'); assert.ok(Math.abs(side.rotation + Math.PI / 2) < 1e-9, 'its top away from them');
});

// (Sampled in strips, a copy's strength steps a little; the layer eases every change over half a second.)
test('walking over a bridge, each copy slides along and grows and fades smoothly, never jumping', () => {
  const river = [0, 1000, 3000, 1000, 3000, 1400, 0, 1400], bridge = [1250, 950, 1350, 950, 1350, 1450, 1250, 1450];
  const was = new Map(); let seen = 0;
  for (let y = 700; y <= 1700; y += 5) {
    const now = new Map(mirrorsOf(token({ x: 1300, y, dry: true }), [river], { grid: 100, decks: [bridge] }).map((s) => [s.dir, s]));
    for (const [dir, s] of now) {
      seen++;
      const before = was.get(dir);
      if (before) { assert.ok(Math.abs(s.y - before.y - 5) < 1e-6, `${dir} at ${y} moved ${s.y - before.y}`); assert.ok(Math.abs(s.alpha - before.alpha) < 0.35, `${dir} at ${y}: ${before.alpha} to ${s.alpha}`); }
      else assert.ok(s.alpha < 0.35, `${dir} at ${y} comes in faint (${s.alpha})`);
    }
    for (const [dir, before] of was) if (!now.has(dir)) assert.ok(before.alpha < 0.35, `${dir} at ${y} goes out faint (${before.alpha})`);
    was.clear(); for (const [dir, s] of now) was.set(dir, s);
  }
  assert.ok(seen > 40, `${seen}`);
});

test('the layer eases each copy in and out rather than popping', () => {
  const sprites = [];
  class Sprite { constructor(t) { this.texture = t; this.alpha = 1; this.anchor = { set() {} }; this.scale = { set() {} }; this.position = { set() {} }; this.skew = {}; sprites.push(this); } }
  const PIXI = { Container: class { addChild() {} addChildAt() {} destroy() {} }, Graphics: class { clear() {} beginFill() {} drawPolygon() {} endFill() {} beginHole() {} endHole() {} }, Sprite, Mesh: class { constructor(g) { this.geometry = g; } }, Geometry: class { addAttribute() { return this; } addIndex() { return this; } getBuffer() { return { update() {} }; } }, Buffer: class {}, Shader: { from: () => ({}) } };
  const mirror = createWaterMirror({ PIXI, root: () => ({ addChild() {} }), grid: () => 100 });
  mirror.water([pond]);
  const view = { x: 900, y: 500, w: 1000, h: 1500 };
  mirror.look({ tokens: [token({ y: 950 })], sunny: true });
  mirror.tick(0.016, { view }); const first = sprites[0].alpha;
  for (let i = 0; i < 60; i++) mirror.tick(0.016, { view });
  assert.ok(first < sprites[0].alpha * 0.3, `${first} then ${sprites[0].alpha}`);
  mirror.look({ tokens: [], sunny: true });
  mirror.tick(0.016, { view }); assert.ok(sprites[0].visible !== false && sprites[0].alpha > 0, 'still fading out');
  for (let i = 0; i < 90; i++) mirror.tick(0.016, { view });
  assert.equal(sprites[0].visible, false); assert.equal(mirror.busy, false);
});

test('between looks the drawn copy keeps up with the token as it glides', () => {
  const sprites = [];
  class Sprite { constructor(t) { this.texture = t; this.anchor = { set() {} }; this.scale = { set() {} }; this.at = null; this.position = { set: (x, y) => { this.at = { x, y }; } }; this.skew = {}; sprites.push(this); } }
  const PIXI = { Container: class { addChild() {} addChildAt() {} destroy() {} }, Graphics: class { clear() {} beginFill() {} drawPolygon() {} endFill() {} beginHole() {} endHole() {} }, Sprite, Mesh: class { constructor(g) { this.geometry = g; } }, Geometry: class { addAttribute() { return this; } addIndex() { return this; } getBuffer() { return { update() {} }; } }, Buffer: class {}, Shader: { from: () => ({}) } };
  const mirror = createWaterMirror({ PIXI, root: () => ({ addChild() {} }), grid: () => 100 });
  mirror.water([pond]);
  const live = { x: 1300, y: 950 };
  mirror.look({ tokens: [token({ y: 950, live })] });
  const view = { x: 900, y: 500, w: 1000, h: 1500 };
  mirror.tick(0.016, { view }); const first = { ...sprites[0].at };
  live.y += 30; mirror.tick(0.016, { view });
  assert.ok(Math.abs(sprites[0].at.y - first.y - 30) < 2, `moved ${sprites[0].at.y - first.y}`);
});

test('no mirror in rough water', () => {
  const race = square(1200, 1200, 200);
  assert.equal(mirrorOf(token({ y: 1300 }), [pond], { grid: 100, rough: [race] }), null, 'standing in it');
  const beside = mirrorOf(token({ x: 1300, y: 1130 }), [pond], { grid: 100, rough: [square(1200, 1400, 200)] });
  assert.ok(beside, 'calm next to it');
  assert.equal(beside.distance, 0); assert.ok(beside.wet > 0.5);
  const above = mirrorOf(token({ x: 1300, y: 1100 }), [pond], { grid: 100, rough: [square(1200, 1000, 200)] });
  assert.equal(above, null, 'nearest bank is the race itself: its feet stand in it');
  const facing = mirrorOf(token({ x: 1300, y: 1130 }), [pond], { grid: 100, rough: [square(1200, 1250, 200)] });
  assert.ok(facing.wet < 1, 'what lands on the rough shows nothing');
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
  for (let i = 0; i < 12; i++) layer.tick(0.3, { view });
  assert.equal(on().length, 2, 'the rest faded and put away');

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

test('dripping pools mirror on any floor; plain ground, the sea, falls and swift water do not', async () => {
  const { waterStillness } = await import('../../scripts/engines/motion/water-mirror.mjs');
  assert.equal(waterStillness({}, false), null);
  assert.equal(waterStillness({ drips: true }, false), 'calm');
  assert.equal(waterStillness({}, true), 'calm');
  assert.equal(waterStillness({ current: 'swift' }, true), 'rough');
  assert.equal(waterStillness({ sea: true }, true), 'rough');
  assert.equal(waterStillness({ waterfall: true }, true), 'rough');
  assert.equal(waterStillness({ drips: true, current: 'swift' }, true), 'rough');
  assert.equal(waterStillness({ reflections: 'off' }, true), 'rough', 'this water asked for none');
  assert.equal(waterStillness({ reflections: 'off', drips: true }, false), 'rough');
  assert.equal(waterStillness({ reflections: 'off' }, false), null, 'no water at all');
  assert.equal(waterStillness({ reflections: '' }, true), 'calm');
});
