import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mirrorOf, mirrorsOf, tileMirrors, mirrorWobble, nearestFirst, lampGlints, moonGlints, GLINT_REACH, colorOf, MAX_MIRRORS, MAX_COLUMNS, createWaterMirror, WATER_MIRROR_SHADER, tokenTurn, createRingPictures } from '../../scripts/engines/motion/water-mirror.mjs';
import { readFileSync } from 'node:fs';

// The same player: "Can you add a dynamic ring reflection feature?" Roi: "whole token but as a setting defaulted to off".
test('a ringed token reflects from one picture of it as drawn, made again only when its ring or art changes', () => {
  class Matrix {
    constructor(a = 1, b = 0, c = 0, d = 1, tx = 0, ty = 0) { Object.assign(this, { a, b, c, d, tx, ty }); }
    clone() { return new Matrix(this.a, this.b, this.c, this.d, this.tx, this.ty); }
    invert() { const { a, b, c, d, tx, ty } = this, n = a * d - b * c; Object.assign(this, { a: d / n, b: -b / n, c: -c / n, d: a / n, tx: (c * ty - d * tx) / n, ty: -(a * ty - b * tx) / n }); return this; }
    translate(x, y) { this.tx += x; this.ty += y; return this; }
    scale(x, y) { this.a *= x; this.d *= y; this.c *= x; this.b *= y; this.tx *= x; this.ty *= y; return this; }
    apply(p) { return { x: this.a * p.x + this.c * p.y + this.tx, y: this.b * p.x + this.d * p.y + this.ty }; }
  }
  const made = [], renders = [];
  const PIXI = { Point: class { constructor(x, y) { this.x = x; this.y = y; } }, RenderTexture: { create: (o) => { const t = { ...o, destroyed: false, destroy() { this.destroyed = true; } }; made.push(t); return t; } } };
  const renderer = { render: (mesh, o) => renders.push(o) };
  const pics = createRingPictures({ PIXI, renderer: () => renderer });
  // A 100 px token drawn at 300, 400 (the mesh's middle), its local box -50..50.
  const at = new Matrix(1, 0, 0, 1, 300, 400);
  const token = (ring = { enabled: true, colors: {} }) => ({ id: 't', document: { ring }, mesh: { texture: { valid: true, baseTexture: { uid: 7 } }, tint: 0xffffff, getLocalBounds: () => ({ x: -50, y: -50, width: 100, height: 100 }), localTransform: at, worldTransform: at.clone() } });
  const pic = pics.of(token());
  assert.deepEqual([pic.x, pic.y, pic.w, pic.h], [300, 400, 100, 100]);
  assert.equal(renders.length, 1);
  // Drawn into the picture from its own corner: the mesh's middle lands in the picture's middle.
  assert.deepEqual(renders[0].transform.apply({ x: 300, y: 400 }), { x: 50, y: 50 });
  pics.of(token()); assert.equal(renders.length, 1, 'the same ring and art: the picture is kept');
  pics.of(token({ enabled: true, colors: { ring: '#ff0000' } })); assert.equal(renders.length, 2, 'a new ring colour: drawn again');
  assert.equal(made[0].destroyed, true, 'and the old picture let go');
  assert.equal(pics.of(token({ enabled: false })), null, 'no ring: the creature reflects as before');
  pics.keep(new Set()); assert.equal(made[1].destroyed, true, 'a token gone: its picture let go');
  const main = readFileSync(new URL('../../scripts/main.mjs', import.meta.url), 'utf8');
  assert.match(main, /registerSetting\("waterMirrorRings", \{ name: "Reflect token rings",[^\n]*default: false \}\);/, 'off unless the GM turns it on');
  assert.match(main, /rings = hotSetting\("waterMirrorRings"\) === true;/);
  assert.match(main, /texture: pic\?\.texture \?\? t\.mesh\.texture/);
});

// A player: "If I rotate the token via Shift/Ctrl + Scroll, the reflection spins. A real token is static, because it is a fixed position."
test('a token with Lock Rotation reflects unturned, as Foundry draws it', () => {
  assert.equal(tokenTurn({ rotation: 90, lockRotation: true }), 0);
  assert.equal(tokenTurn({ rotation: 90, lockRotation: false }), Math.PI / 2);
  assert.equal(tokenTurn({}), 0);
  const main = readFileSync(new URL('../../scripts/main.mjs', import.meta.url), 'utf8');
  assert.match(main, /h: pic\?\.h \?\? t\.h, rotation: mirrorTokenTurn\(t\.document\), alpha: t\.mesh\.alpha/);
});

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
  assert.ok(lampGlints(lamp, [pond], { grid: 100 }).wet > 0);
  assert.equal(lampGlints(lamp, [pond], { grid: 100, blocked: () => true }).wet, 0);
  assert.ok(lampGlints(lamp, [pond], { grid: 100, blocked: () => false }).wet > 0);
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

// Roi: "what are those lines in the water engine". The old column was what you see looking across water from its level; a map
// is seen from straight above, where a flame's glints gather close around it and no column forms.
test('a lamp glints only on the water close around it, with no column down the map', () => {
  const g = lampGlints({ x: 1300, y: 950, color: 0xff8800, radius: 300 }, [pond], { grid: 100 });
  assert.equal(g.x, 1300); assert.equal(g.y, 950);
  assert.equal(g.half, GLINT_REACH * 100, 'a square around the flame, as far as any ripple can send its light up');
  assert.equal(g.len, undefined, 'no column');
  assert.ok(g.wet > 0);
  assert.deepEqual(g.color, [1, 136 / 255, 0]);
  assert.ok(GLINT_REACH >= 1 && GLINT_REACH <= 2.5, 'a flame held at a person\'s height reaches a square or two, no more');
  assert.equal(lampGlints({ x: 1300, y: 1000 - GLINT_REACH * 100 - 10 }, [pond], { grid: 100 }), null, 'too far');
  assert.ok(lampGlints({ x: 1300, y: 1000 - GLINT_REACH * 100 + 10 }, [pond], { grid: 100 }));
  assert.ok(lampGlints({ x: 1300, y: 1650 }, [pond], { grid: 100 }).wet > 0, 'beside the water on any side, not only above it');
  assert.ok(lampGlints({ x: 1300, y: 1300 }, [pond], { grid: 100 }).wet > lampGlints({ x: 1300, y: 950 }, [pond], { grid: 100 }).wet, 'out on the water, water all round it');
  const night = lampGlints({ x: 1300, y: 950 }, [pond], { grid: 100 }), day = lampGlints({ x: 1300, y: 950 }, [pond], { grid: 100, sunny: true });
  assert.ok(day.strength < night.strength, 'lost in daylight');
});

test('colours as they come', () => {
  assert.deepEqual(colorOf(0xff0000), [1, 0, 0]);
  assert.deepEqual(colorOf('#00ff00'), [0, 1, 0]);
  assert.deepEqual(colorOf(new Number(0x0000ff)), [0, 0, 1]);
  assert.equal(colorOf(null).length, 3, 'firelight if none');
});

// Seen from straight above, every bit of water needs the same tilt to send the moon up: a rare twinkle anywhere, none with it low.
// Roi: "the glints will not show on shadowed areas where the light doesnt reach right?" A glint is the flame seen in the water, so only water the flame lights can show one.
test('a lamp glints only where its light reaches: its lit shape, walls cut out', () => {
  const lamp = { x: 1300, y: 950, color: 0xffaa66 };
  const open = lampGlints(lamp, [pond], { grid: 100 });
  // A wall straight down from it: its light reaches only the water on its left.
  const halfLit = lampGlints({ ...lamp, shape: [1100, 750, 1300, 750, 1300, 1150, 1100, 1150] }, [pond], { grid: 100 });
  assert.ok(halfLit.wet > 0 && halfLit.wet < open.wet, 'only the lit side of the water counts');
  assert.deepEqual(halfLit.shape, [1100, 750, 1300, 750, 1300, 1150, 1100, 1150], 'its shape goes with it, to cut the glints to');
  assert.equal(lampGlints({ ...lamp, shape: [1100, 700, 1500, 700, 1500, 900, 1100, 900] }, [pond], { grid: 100 }).wet, 0, 'lighting none of the water, none');
  assert.ok(lampGlints({ ...lamp, shape: [1, 2, 3, 4] }, [pond], { grid: 100 }).wet > 0, 'a broken shape is no shape');
  assert.equal(lampGlints({ ...lamp, shape: [1, 2, 3, 4] }, [pond], { grid: 100 }).shape, null);
});

// Roi: "like real life". Rough water still sends a flame up to the eye: its steeper ripples only spread the glints wider. A token's copy needs calm water; a glint does not.
test('a lamp glints on swift water too, marked rough so its ripples run steeper; never on a dock', () => {
  const lamp = { x: 1300, y: 950, color: 0xffaa66 };
  const swift = lampGlints(lamp, [], { grid: 100, rough: [pond] });
  assert.ok(swift && swift.wet > 0, 'glints on rough water');
  assert.equal(swift.rough, 1, 'all of it rough');
  assert.equal(lampGlints(lamp, [pond], { grid: 100 }).rough, 0, 'calm water, none rough');
  assert.equal(lampGlints(lamp, [pond], { grid: 100, decks: [square(900, 800, 900)] }).wet, 0, 'a dock over all of it: nothing shows');
});

test('the layer: glints on rough water as on calm, the moon steeper there', () => {
  const PIXI = fakePIXI(), root = new PIXI.Container(), layer = createWaterMirror({ PIXI, root: () => root, grid: () => 100 }), view = { x: 1000, y: 800, w: 600, h: 800 };
  layer.water([], { rough: [pond] });
  layer.look({ tokens: [token({ y: 950 })], lamps: [{ x: 1300, y: 950, color: 0xffaa66 }], moon: { angle: 45, height: 70, strength: 0.8 }, sunny: false });
  layer.tick(0.05, { view });
  const holder = root.children[0], shine = holder.children[2], [calmMoon, roughMoon, ...lamps] = shine.children.filter((c) => c.shader);
  assert.equal(shine.mask, holder.children[3], 'glints cut to all the water');
  assert.ok(holder.children[3].polys >= 1, 'rough water in it');
  const on = lamps.filter((m) => m.visible);
  assert.equal(on.length, 1, 'the lamp glints on swift water');
  assert.ok(Math.abs(on[0].geometry.getBuffer('aBand').data[3] - 0.45) < 1e-6, 'marked rough');
  assert.equal(calmMoon.visible, false, 'no calm water for the calm moon');
  assert.equal(roughMoon.visible, true); assert.equal(roughMoon.geometry.getBuffer('aBand').data[3], 1.5, 'the moon on rough water, marked rough');
  assert.equal(holder.children[0].children.filter((c) => c.texture && c.visible).length, 0, 'but no copy of anyone: rough water mirrors nothing');
  layer.water([], { rough: [pond], dull: [pond] });
  layer.tick(0.05, { view });
  assert.equal(lamps.filter((m) => m.visible).length, 0, 'water with reflections off shows no glints either');
  layer.clear();
});

// Roi: "where are the glints?" Under the lighting, a torch's glints were added to water its light had already made bright, and
// vanished in it. A glint is the flame itself seen in the water, far brighter than the lit water: drawn over the lighting, as the embers are.
test('the layer: glints go over the lighting when given somewhere to, the copies stay on the floor', () => {
  const PIXI = fakePIXI(), root = new PIXI.Container(), glow = new PIXI.Container(), view = { x: 1000, y: 800, w: 600, h: 800 };
  const layer = createWaterMirror({ PIXI, root: () => root, glowRoot: () => glow, grid: () => 100 });
  layer.water([pond]);
  layer.look({ tokens: [token({ y: 950 })], lamps: [{ x: 1300, y: 950, color: 0xffaa66 }], moon: null, sunny: false });
  layer.tick(0.05, { view });
  const shine = glow.children[0]?.children.find((c) => c.mask && c.children.some((m) => m.shader));
  assert.ok(shine, 'the glints over the lighting');
  assert.ok(shine.children.some((m) => m.shader && m.visible), 'the lamp\'s glints there');
  assert.ok(!root.children[0].children.some((c) => c === shine), 'not on the floor');
  assert.ok(root.children[0].children[0].children.some((c) => c.texture && c.visible), 'the copies still on the floor');
  layer.tick(0.05, { view: { x: 9000, y: 9000, w: 100, h: 100 } });
  assert.equal(glow.children[0].visible, false, 'out of view, hidden too');
  layer.clear();
  assert.equal(glow.children.length, 0, 'and gone with the rest');
});

test('the moon twinkles anywhere on the water when it is high, and not at all when it is low', () => {
  const view = { x: 0, y: 500, w: 1000, h: 1000 };
  assert.equal(moonGlints(null, view), null);
  assert.equal(moonGlints({ angle: 90, height: 70, strength: 0 }, view), null);
  assert.equal(moonGlints({ angle: 90, height: 25, strength: 1 }, view), null, 'too low for any ripple to send it up');
  const m = moonGlints({ angle: 90, height: 70, strength: 0.6 }, view, { grid: 100 });
  assert.ok(m.x <= view.x && m.y <= view.y && m.x + m.w >= view.x + view.w && m.y + m.h >= view.y + view.h, 'all the water in view');
  assert.equal(m.strength, 0.6);
  assert.ok(Math.abs(m.tilt[0]) < 1e-9 && Math.abs(m.tilt[1] - Math.tan((10 * Math.PI) / 180)) < 1e-9, 'half its angle from overhead, leaning toward it');
  assert.ok(Math.hypot(...moonGlints({ angle: 0, height: 85, strength: 1 }, view).tilt) < Math.hypot(...m.tilt), 'higher, gentler tilt, more twinkles');
  assert.equal(moonGlints({ angle: 0, height: 70, strength: 1 }, null), null, 'no view, nothing to cover');
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
  class Graphics extends Thing { constructor() { super(); this.polys = 0; this.cuts = 0; this.inHole = false; } clear() { this.polys = this.cuts = 0; } beginFill() {} endFill() {} drawPolygon(points) { if (this.inHole) this.cuts++; else { this.polys++; this.drawn = points; } } beginHole() { this.inHole = true; } endHole() { this.inHole = false; } }
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

test('the layer: each lamp its own glints cut to its light, the moon over all, the moon not by day', () => {
  const PIXI = fakePIXI(), root = new PIXI.Container(), layer = createWaterMirror({ PIXI, root: () => root, grid: () => 100 }), view = { x: 1000, y: 800, w: 600, h: 800 };
  layer.water([pond]);
  const lamps = Array.from({ length: MAX_COLUMNS + 4 }, (_, i) => ({ x: 1020 + i * 40, y: 950, color: 0xffaa66, radius: 300, shape: i === 7 ? [1200, 800, 1400, 800, 1400, 1200, 1200, 1200] : null }));
  layer.look({ tokens: [], lamps, moon: { angle: 45, height: 70, strength: 0.8 }, sunny: false });
  layer.tick(0.05, { view });
  const shine = root.children[0].children[2], [moon, , ...lampMeshes] = shine.children.filter((c) => c.shader);
  assert.equal(lampMeshes.filter((m) => m.visible).length, MAX_COLUMNS, 'only as many lamps as it can hold');
  assert.ok(lampMeshes.every((m) => m.geometry.getBuffer('aBand').data[3] === 0), 'lamps');
  assert.ok(lampMeshes.filter((m) => m.visible).every((m) => m.mask.polys === 1), 'each cut to its own light');
  assert.ok(lampMeshes.some((m) => m.visible && m.mask.drawn?.[0] === 1200), 'a lamp with a lit shape is cut to that shape');
  assert.equal(moon.visible, true); assert.equal(moon.geometry.getBuffer('aBand').data[3], 1, 'and the moon');

  const updates = moon.geometry.getBuffer('aBand').updates;
  layer.look({ tokens: [], lamps, moon: { angle: 45, height: 70, strength: 0.8 }, sunny: false });
  layer.tick(0.05, { view });
  assert.equal(moon.geometry.getBuffer('aBand').updates, updates, 'nothing changed: nothing worked out again');
  layer.look({ tokens: [], lamps: lamps.map((l, i) => (i === 7 ? { ...l, shape: [1200, 800, 1450, 800, 1450, 1200, 1200, 1200] } : l)), moon: { angle: 45, height: 70, strength: 0.8 }, sunny: false });
  layer.tick(0.05, { view });
  assert.ok(moon.geometry.getBuffer('aBand').updates > updates, 'a door opening changes a light\'s shape: worked out again');

  layer.look({ tokens: [], lamps: [], moon: { angle: 45, height: 70, strength: 0.8 }, sunny: true });
  layer.tick(0.05, { view });
  assert.equal(moon.visible, false, 'no moon by day');
  assert.ok(lampMeshes.every((m) => !m.visible), 'and no lamps left');
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
