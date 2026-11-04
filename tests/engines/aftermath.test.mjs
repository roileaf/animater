import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bodyStage, speckCount, speckPath, speckAt, fliesLift, scaredBy, newCrow, crowStep, capShots, shotFade, shotQuiver, seedRandom, createAftermath, CROW_BACK, MOST_SPECKS, MOST_BIRDS } from '../../scripts/engines/motion/aftermath.mjs';

const fixed = (v = 0.5) => () => v;
const crow = (over = {}) => ({ ...newCrow({ tx: 0, ty: 0, ring: 85, at: 0, back: 0 }), ...over });
const onGround = (over = {}) => crow({ mode: 'ground', x: 0, y: -85, wait: 1, ...over });
const run = (q, steps, opts = {}) => { let o = q; for (let i = 0; i < steps; i++) o = crowStep(o, { dt: 1 / 60, grid: 100, ...opts }); return o; };

test('flies start about 25 s after death and are all there by 90 s', () => {
  assert.equal(bodyStage(20).flies, 0);
  assert.equal(bodyStage(25).flies, 0);
  const mid = bodyStage(55).flies;
  assert.ok(mid > 0 && mid < 1, `${mid}`);
  assert.equal(bodyStage(90).flies, 1);
  assert.equal(bodyStage(900).flies, 1);
});

test('no flies in the cold or heavy rain, and fewer at night', () => {
  assert.equal(bodyStage(200, { cold: true }).flies, 0);
  assert.equal(bodyStage(200, { cold: 0.8 }).flies, 0);
  assert.equal(bodyStage(200, { rain: 0.9 }).flies, 0);
  assert.equal(bodyStage(200, { rain: true }).flies, 0);
  assert.equal(bodyStage(200, { rain: 0.2 }).flies, 1);
  const night = bodyStage(200, { day: 0 }).flies;
  assert.ok(night > 0 && night < 1, `${night}`);
});

test('crows come only outdoors by day, the first at about 150 s and three by 300 s', () => {
  const out = { outdoors: true, day: 1 };
  assert.equal(bodyStage(149, out).crows, 0);
  assert.equal(bodyStage(150, out).crows, 1);
  assert.equal(bodyStage(230, out).crows, 2);
  assert.equal(bodyStage(300, out).crows, 3);
  assert.equal(bodyStage(5000, out).crows, 3);
  assert.equal(bodyStage(300, { outdoors: false, day: 1 }).crows, 0);
  assert.equal(bodyStage(300, { outdoors: true, day: 0.1 }).crows, 0);
  assert.ok(Number.isInteger(bodyStage(222, out).crows));
});

test('a cloud of flies is none, or 2 to 9 specks', () => {
  assert.equal(speckCount(0), 0);
  assert.equal(speckCount(0.001), 2);
  assert.equal(speckCount(1), 9);
});

test('a fly wanders round the body and stays near it, lifting when startled', () => {
  const path = speckPath(seedRandom('body')), xs = new Set();
  for (let t = 0; t < 30; t += 0.1) { const at = speckAt(path, t, { radius: 50 }); assert.ok(Math.hypot(at.x, at.y) <= 50 * Math.SQRT2, `${at.x}, ${at.y}`); xs.add(Math.round(at.x)); assert.ok(at.alpha > 0 && at.alpha <= 1); }
  assert.ok(xs.size > 20, 'it moves about');
  let lift = fliesLift(0, { startled: true });
  assert.equal(lift, 1);
  for (let i = 0; i < 60 * 5; i++) lift = fliesLift(lift, { dt: 1 / 60 });
  assert.equal(lift, 0, 'and settles');
});

test('the same id gives the same run on every screen', () => {
  const a = seedRandom('abc'), b = seedRandom('abc'), c = seedRandom('abd');
  assert.equal(a(), b());
  assert.notEqual(seedRandom('abc')(), c());
});

test('a bird is scared by anyone within about 2.5 squares or a noise, and by nothing else', () => {
  assert.ok(scaredBy(0, 0, { grid: 100, near: [{ x: 200, y: 0 }] }));
  assert.equal(scaredBy(0, 0, { grid: 100, near: [{ x: 300, y: 0 }] }), null);
  const bang = { x: 900, y: 0 };
  assert.equal(scaredBy(0, 0, { grid: 100, noise: bang }), bang);
});

test('a crow glides in from afar, coming down as it comes, lands by the body and faces it', () => {
  let q = crowStep(crow(), { grid: 100, random: fixed() });
  assert.equal(q.mode, 'in');
  assert.equal(q.h, 1);
  assert.ok(Math.hypot(q.x, q.y) > 500, 'starts well off');
  const was = q.h;
  q = run(q, 30, { random: fixed() });
  assert.ok(q.h < was);
  for (let i = 0; i < 60 * 20 && q.mode === 'in'; i++) q = crowStep(q, { dt: 1 / 60, grid: 100, random: fixed() });
  assert.equal(q.mode, 'ground');
  assert.equal(q.h, 0);
  assert.ok(Math.abs(Math.hypot(q.x, q.y) - 85) < 1, 'at its place by the body');
});

test('on the ground a crow hops and pecks, keeping by the body and always facing it', () => {
  let q = onGround(), pecks = 0, hops = 0, i = 0;
  const random = seedRandom('peck');
  for (; i < 60 * 120; i++) {
    const was = q; q = crowStep(q, { dt: 1 / 60, grid: 100, random });
    assert.equal(q.mode, 'ground');
    if (q.peck > 0 && !(was.peck > 0)) pecks++;
    if (q.hop && !was.hop) hops++;
    const d = Math.hypot(q.x, q.y);
    assert.ok(d > 50 && d < 120, `stays by it, at ${d}`);
    const want = Math.atan2(-q.x, q.y), off = Math.atan2(Math.sin(q.a - want), Math.cos(q.a - want));
    assert.ok(Math.abs(off) < 1e-9, `faces it, off by ${off}`);
  }
  assert.ok(pecks > 5, `${pecks} pecks`);
  assert.ok(hops > 3, `${hops} hops`);
});

test('anyone near or a noise sends a crow flapping away from them, and it returns after 40 to 90 s', () => {
  const near = [{ x: 0, y: -250 }];
  const off = crowStep(onGround(), { grid: 100, near, random: fixed() });
  assert.equal(off.mode, 'away');
  assert.ok(off.vy > 0, 'away from them');
  assert.equal(crowStep(onGround(), { grid: 100, near: [{ x: 0, y: -500 }], random: fixed() }).mode, 'ground');
  assert.equal(crowStep(onGround(), { grid: 100, noise: { x: 900, y: 0 }, random: fixed() }).mode, 'away');
  assert.equal(crowStep(crow({ mode: 'in', x: 900, y: 900, fromX: 900, fromY: 900, len: 5, h: 1 }), { grid: 100, near: [{ x: 0, y: 0 }], random: fixed() }).mode, 'away', 'someone by the body turns it back in the air too');
  const flying = run(off, 60 * 2, { random: fixed() });
  assert.equal(flying.mode, 'away');
  assert.ok(flying.h > 0.9 && flying.y > off.y);
  for (const v of [0, 1]) {
    let q = off, secs = 0;
    for (; q.mode === 'away'; secs += 1 / 60) q = crowStep(q, { dt: 1 / 60, grid: 100, random: fixed(v) });
    assert.equal(q.mode, 'gone');
    secs = 0;
    for (; q.mode === 'gone'; secs += 1 / 60) q = crowStep(q, { dt: 1 / 60, grid: 100, random: fixed(v) });
    assert.ok(secs >= CROW_BACK[0] - 0.1 && secs <= CROW_BACK[1] + 0.1, `back in ${secs}`);
    assert.equal(q.mode, 'in');
  }
});

test('a scared crow does not come back while someone is by the body', () => {
  const near = [{ x: 0, y: -85 }];
  let q = crow({ back: 1 });
  q = run(q, 60 * 30, { near, random: fixed() });
  assert.equal(q.mode, 'gone');
  q = run(q, 60 * 10, { random: fixed() });
  assert.notEqual(q.mode, 'gone', 'once they have gone, it does');
});

test('a crow told to leave flies off and does not return', () => {
  const off = crowStep(onGround(), { grid: 100, leave: true, random: fixed() });
  assert.equal(off.mode, 'away');
  const q = run(off, 60 * 200, { leave: true, random: fixed() });
  assert.equal(q.mode, 'gone');
});

test('the cap keeps the newest shots and hands back the oldest', () => {
  const list = [1, 2, 3, 4, 5];
  assert.deepEqual(capShots(list, 3), { kept: [3, 4, 5], dropped: [1, 2] });
  assert.deepEqual(capShots(list, 9), { kept: list, dropped: [] });
  assert.deepEqual(capShots(list, 0), { kept: [], dropped: list });
});

test('a shot stays with no lifetime, and fades only at the end of one', () => {
  assert.equal(shotFade(99999), 1);
  assert.equal(shotFade(10, 0), 1);
  assert.equal(shotFade(10, Infinity), 1);
  assert.equal(shotFade(30, 60), 1);
  const late = shotFade(58, 60);
  assert.ok(late > 0 && late < 1, `${late}`);
  assert.equal(shotFade(60, 60), 0);
});

test('a shaft quivers only just after it lands', () => {
  assert.ok(Math.abs(shotQuiver(0.03)) > 0.005);
  assert.ok(Math.abs(shotQuiver(0.03)) > Math.abs(shotQuiver(0.54)));
  assert.equal(shotQuiver(0.7), 0);
  assert.equal(shotQuiver(100), 0);
});

// ---- The layer, on a stand-in for PIXI and the canvas ----------------------------------------------------------------------
const pixi = () => {
  const sprites = [];
  class Sprite {
    constructor(texture) { this.texture = texture; this.visible = true; this.alpha = 1; this.rotation = 0; this.parent = null; this.destroyed = false; this.position = { set: (x, y) => { this.x = x; this.y = y; } }; this.anchor = { set: () => {} }; this.scale = { set: (v) => { this.size = v; } }; sprites.push(this); }
    destroy() { this.destroyed = true; this.parent?.children.delete(this); }
  }
  return { PIXI: { Sprite, Texture: { from: () => ({ baseTexture: { destroyed: false } }) } }, sprites };
};
const container = () => ({ children: new Set(), addChild(s) { s.parent?.children.delete(s); s.parent = this; this.children.add(s); } });
globalThis.document ??= { createElement: () => ({ getContext: () => new Proxy({}, { get: (_, k) => (String(k).startsWith('create') ? () => ({ addColorStop() {} }) : () => {}), set: () => true }) }) };
const layer = (opts = {}) => { const floor = container(), sky = container(), { PIXI, sprites } = pixi(); return { floor, sky, sprites, a: createAftermath({ PIXI, floor, sky, ...opts }) }; };
const live = (sprites) => sprites.filter((s) => !s.destroyed);
const shown = (c) => [...c.children].filter((s) => s.visible);
const tickFor = (a, seconds, opts = {}) => { for (let left = seconds; left > 0; left -= 0.05) a.tick(0.05, opts); };

test('shots past the cap take the oldest out, and clear() takes the lot', () => {
  const { a, floor, sprites } = layer({ cap: 3 });
  assert.equal(a.busy, false);
  for (let i = 0; i < 5; i++) { a.stick({ x: i, y: 0, angle: 1, kind: 'bolt', into: i % 2 ? 'wall' : 'floor', seed: `s${i}` }); a.tick(0.05); }
  assert.equal(a.counts.shots, 3);
  assert.equal(live(sprites).length, 3, 'the old sprites are destroyed');
  assert.deepEqual(shown(floor).map((s) => s.x).sort(), [2, 3, 4]);
  a.clear();
  assert.equal(a.busy, false);
  assert.equal(live(sprites).length, 0);
});

test('containers or functions both do for the layers', () => {
  const floor = container(), { PIXI } = pixi(), a = createAftermath({ PIXI, floor: () => floor, sky: () => container() });
  a.stick({ x: 0, y: 0 }); a.tick(0.05);
  assert.equal(shown(floor).length, 1);
});

test('shots off the view or out of sight are not drawn', () => {
  const { a, floor } = layer();
  a.stick({ x: 5000, y: 0, seed: 'far' }); a.stick({ x: 10, y: 10, seed: 'close' });
  a.tick(0.05, { view: { x: 0, y: 0, w: 100, h: 100 } });
  assert.equal(shown(floor).length, 1);
  const { a: b, floor: f2 } = layer();
  b.stick({ x: 10, y: 10 }); b.tick(0.05, { seen: () => false });
  assert.equal(shown(f2).length, 0);
});

test('a shot in a creature follows it, hides with it and comes out with dropFrom', () => {
  const { a, sky, floor } = layer();
  a.stickInto('t1', { dx: 5, dy: -5, angle: 0.5, kind: 'arrow' });
  a.stickInto('t2', { dx: 0, dy: 0 });
  let where = { x: 100, y: 200, w: 100, h: 100, visible: true };
  const tokens = (id) => (id === 't1' ? where : null);
  a.tick(0.05, { tokens });
  assert.equal(shown(floor).length, 0);
  assert.equal(shown(sky).length, 1);
  assert.equal(shown(sky)[0].x, 155); assert.equal(shown(sky)[0].y, 245);
  where = { ...where, x: 300 };
  a.tick(0.05, { tokens });
  assert.equal(shown(sky)[0].x, 355);
  where = { ...where, visible: false };
  a.tick(0.05, { tokens });
  assert.equal(shown(sky).length, 0);
  assert.equal(a.counts.inCreatures, 2);
  a.dropFrom('t1');
  assert.equal(a.counts.inCreatures, 1);
  assert.equal(a.counts.shots, 1);
});

test('the lifetime setter ends shots with a fade, and null keeps them', () => {
  const { a, floor } = layer();
  a.stick({ x: 0, y: 0 });
  a.lifetime = 20;
  assert.equal(a.lifetime, 20);
  a.tick(18);
  assert.ok(shown(floor)[0].alpha < 1 && shown(floor)[0].alpha > 0);
  a.tick(3);
  assert.equal(a.counts.shots, 0);
  a.stick({ x: 0, y: 0 }); a.lifetime = null;
  a.tick(5000);
  assert.equal(a.counts.shots, 1);
});

test('flies gather on a body over the sky layer, never off view, and never too many', () => {
  const { a, sky } = layer();
  a.body({ id: 'b', x: 0, y: 0, size: 1, outdoors: true });
  a.tick(10);
  assert.equal(a.counts.specks, 0);
  a.tick(100); tickFor(a, 5);
  assert.equal(a.counts.specks, 9);
  assert.equal(shown(sky).length, 9);
  tickFor(a, 0.2, { view: { x: 5000, y: 5000, w: 10, h: 10 } });
  assert.equal(a.counts.specks, 0);
  assert.equal(shown(sky).length, 0);
  const { a: many } = layer();
  for (let i = 0; i < 20; i++) many.body({ id: `b${i}`, x: i * 300, y: 0 });
  many.tick(100); tickFor(many, 5);
  assert.equal(many.counts.specks, MOST_SPECKS);
});

test('crows arrive with a caw, land, and scatter with wings at anyone near; the one body token itself does not count', () => {
  const { a, floor, sky } = layer(), calls = [];
  const sound = (kind, at) => calls.push([kind, at]);
  a.body({ id: 'b', x: 1000, y: 1000, size: 1, outdoors: true });
  const self = { id: 'b', x: 1000, y: 1000 };
  a.tick(150, { near: [self], sound });
  tickFor(a, 30, { near: [self], sound });
  assert.ok(calls.some(([k]) => k === 'crowCaw'), 'caw');
  assert.equal(a.counts.landed, 1);
  assert.ok(shown(floor).length >= 2, 'crow and shadow on the floor');
  assert.equal(calls.filter(([k]) => k === 'wingsUp').length, 0);
  a.tick(0.05, { near: [self, { id: 'hero', x: 1100, y: 1000 }], sound });
  assert.equal(a.counts.landed, 0);
  assert.equal(calls.filter(([k]) => k === 'wingsUp').length, 1);
  assert.equal(typeof calls.at(-1)[1].x, 'number');
  a.tick(0.05, { sound });
  assert.ok([...sky.children].some((s) => s.visible && s.texture !== undefined), 'flying over all');
  tickFor(a, 6, { sound });
  assert.equal(a.counts.away, 1);
  assert.equal(a.counts.crows, 0);
});

test('a noise scatters landed crows; flies merely lift', () => {
  const { a } = layer();
  a.body({ id: 'b', x: 0, y: 0, outdoors: true });
  a.tick(150); tickFor(a, 30);
  assert.equal(a.counts.landed, 1);
  const specks = a.counts.specks;
  a.noise({ x: 0, y: 0, radius: 1000 });
  tickFor(a, 0.2);
  assert.equal(a.counts.landed, 0);
  assert.equal(a.counts.specks, specks);
});

test('a big body draws one vulture, and bodies together never draw too many birds', () => {
  const { a } = layer();
  a.body({ id: 'giant', x: 0, y: 0, size: 3, outdoors: true });
  a.tick(400); tickFor(a, 30);
  assert.equal(a.counts.landed, 1);
  const { a: many } = layer();
  for (let i = 0; i < 10; i++) many.body({ id: `b${i}`, x: i * 1000, y: 0, outdoors: true });
  many.tick(400); tickFor(many, 30);
  assert.equal(many.counts.crows + many.counts.away, MOST_BIRDS);
});

test('bodyGone sends the birds off and the flies away before it is done with the body', () => {
  const { a, sprites } = layer(), calls = [];
  a.body({ id: 'b', x: 0, y: 0, outdoors: true });
  a.tick(150); tickFor(a, 30);
  a.bodyGone('b');
  assert.equal(a.busy, true);
  a.tick(0.05, { sound: (k) => calls.push(k) });
  assert.deepEqual(calls, ['wingsUp']);
  tickFor(a, 8);
  assert.equal(a.busy, false);
  assert.equal(a.counts.bodies, 0);
  assert.equal(live(sprites).length, 0);
});

test('no crows indoors, however long it lies', () => {
  const { a } = layer();
  a.body({ id: 'b', x: 0, y: 0, outdoors: false });
  a.tick(1000); tickFor(a, 5);
  assert.equal(a.counts.crows + a.counts.away, 0);
  assert.ok(a.counts.specks > 0);
});
