import test from 'node:test';
import assert from 'node:assert/strict';
import { createFloorBlood, driedTint, washAfter, WASH_SECONDS, waterDrift, packMark, unpackMark, splatMarks, scaleMarks, POOL_DRIES, driftLook } from '../../../scripts/engines/motion/floor-blood.mjs';

// Enough of PIXI for the layer: sprites that can be counted and read.
const fakeLayer = (options = {}) => {
  const children = [];
  class Sprite { constructor(texture) { this.texture = texture; this.anchor = { set() {} }; this.position = { x: 0, y: 0, set(x, y) { this.x = x; this.y = y; }, copyFrom() {} }; this.tint = 0xffffff; this.alpha = 1; this.destroyed = false; } destroy() { this.destroyed = true; } }
  const PIXI = { Sprite, Texture: { from: (c) => c }, BLEND_MODES: { ADD: 1 } };
  const layer = createFloorBlood({ PIXI, root: () => ({ addChild: (s) => children.push(s) }), art: (kind, n, color) => `${kind}:${n}:${color}`, ...options });
  return { layer, live: () => children.filter((s) => !s.destroyed), children };
};
const stain = (over = {}) => ({ art: 'patch', n: 0, x: 100, y: 100, rot: 0, r: 50, ...over });
const run = (layer, seconds) => { for (let t = 0; t < seconds; t += 0.5) layer.tick(0.5); };

test('blood darkens as it dries, and stays dark', () => {
  assert.equal(driedTint(0), 0xffffff);
  assert.ok(driedTint(POOL_DRIES / 2) < 0xffffff && driedTint(POOL_DRIES / 2) > driedTint(POOL_DRIES));
  assert.equal(driedTint(POOL_DRIES), driedTint(POOL_DRIES * 3));
  const { layer, live } = fakeLayer({ life: () => 400 });
  layer.add([stain()]);
  run(layer, POOL_DRIES / 2);
  assert.ok(live()[0].tint < 0xffffff, 'darker half way');
  run(layer, POOL_DRIES);
  assert.equal(live()[0].tint, driedTint(POOL_DRIES), 'dry');
});

test('rain washes away what it falls on, not what is under a roof; what is left stays when it stops', () => {
  assert.equal(washAfter(0, 1, WASH_SECONDS), 1);
  assert.equal(washAfter(0, 0.5, WASH_SECONDS), 0.5);
  let rain = 1;
  const { layer, live } = fakeLayer({ life: () => 900, rain: () => rain, exposed: (x) => x < 500 });
  layer.add([stain(), stain({ x: 600 })]);
  const out = live().find((s) => s.position.x < 500), under = live().find((s) => s.position.x > 500);
  run(layer, WASH_SECONDS / 2);
  assert.ok(out.alpha < 0.6 && out.alpha > 0.4, `half gone: ${out.alpha}`);
  assert.equal(under.alpha, 1);
  rain = 0;
  const left = out.alpha;
  run(layer, 30);
  assert.equal(out.alpha, left, 'the rain has stopped');
  rain = 1;
  run(layer, WASH_SECONDS * 0.7);
  assert.equal(out.destroyed, true, 'washed away');
  assert.equal(under.destroyed, false);
});

test('blood landing in water drifts with the flow, clouds out and is gone; on land it lies', () => {
  const still = waterDrift({ flow: null }, 100), river = waterDrift({ flow: 0, current: 'swift' }, 100), gentle = waterDrift({ flow: 0 }, 100);
  assert.equal(still.vx, 0);
  assert.ok(river.vx > gentle.vx && gentle.vx > 0, 'swift water carries it faster');
  assert.ok(river.life < still.life, 'and thins it sooner');
  const { layer, live } = fakeLayer({ life: () => 900, grid: () => 100, waterAt: (x) => (x > 500 ? { flow: 0 } : null) });
  layer.add([stain(), stain({ x: 600 })]);
  const inWater = live().find((s) => s.position.x > 500), onLand = live().find((s) => s.position.x < 500), width = inWater.width;
  run(layer, 10);
  assert.ok(inWater.position.x > 700, 'carried downstream');
  assert.ok(inWater.width > width, 'clouding out');
  assert.ok(inWater.alpha < 0.75);
  assert.equal(layer.near(inWater.position.x, 100), null, 'no one steps in it');
  run(layer, 20);
  assert.equal(inWater.destroyed, true, 'dissolved');
  assert.equal(onLand.destroyed, false);
  assert.equal(onLand.position.x, 100);
});

test('blood can stay until it is cleared: the life says so, and more of it is allowed', () => {
  let forever = false;
  const { layer, live } = fakeLayer({ life: () => (forever ? Infinity : 20), most: () => (forever ? 3 : 1) });
  layer.add([stain()]);
  run(layer, 25);
  assert.equal(live().length, 0, 'an ordinary life ends');
  forever = true;
  layer.add([stain({ x: 1 }), stain({ x: 2 }), stain({ x: 3 }), stain({ x: 4 })]);
  run(layer, 5000);
  assert.equal(live().length, 3, 'the cap still holds, the oldest going');
  assert.ok(live().every((s) => s.alpha === 1));
  layer.clear();
  assert.equal(live().length, 0);
});

test('a dressed scene: saved marks come back dry in their own colours, only what changed changes, and rain and time leave them', () => {
  const { layer, live, children } = fakeLayer({ life: () => 20, rain: () => 1 });
  const a = stain({ color: 0x00ff00 }), b = stain({ x: 300, color: 0x0000ff });
  layer.dress([a, b]);
  assert.equal(live().length, 2);
  assert.equal(live()[0].tint, driedTint(POOL_DRIES));
  assert.match(live()[0].texture, /:65280$/, 'its own colour');
  run(layer, 200);
  assert.equal(live().length, 2, 'time and rain leave it');
  const first = live()[0];
  layer.dress([a]);
  assert.equal(live().length, 1);
  assert.equal(live()[0], first, 'the same sprite: nothing redrawn');
  assert.equal(children.length, 2);
  assert.equal(layer.near(100, 100), null, 'old and dry: no footprints');
  layer.clear();
  assert.equal(layer.count, 0);
});

test('saved marks pack small and come back the same, and a snapshot lists what lies', () => {
  const mark = { art: 'slash', n: 2, x: 123.4, y: 55.5, rot: 1.234, r: 41.26, squash: 0.81, alpha: 0.9, color: 0x123456 };
  const back = unpackMark(JSON.parse(JSON.stringify(packMark(mark))));
  assert.deepEqual(back, { art: 'slash', n: 2, x: 123, y: 56, rot: 1.23, r: 41.3, squash: 0.81, alpha: 0.9, color: 0x123456 });
  assert.equal(unpackMark('nonsense'), null);
  const { layer } = fakeLayer({ waterAt: (x) => (x > 500 ? { flow: null } : null) });
  layer.add([stain(), stain({ x: 600 })], 0x445566);
  const list = layer.snapshot();
  assert.equal(list.length, 1, 'what drifts away is not kept');
  assert.equal(list[0].color, 0x445566);
});

test('wet blood is found underfoot in its colour; a drop is too small, and dry blood no longer wet', () => {
  const { layer } = fakeLayer({ life: () => 900 });
  layer.add([stain(), { art: 'drop', n: 0, x: 400, y: 100, r: 50 }], 0x00aa00);
  assert.equal(layer.near(100, 100).color, 0x00aa00);
  assert.equal(layer.near(400, 100), null);
  assert.equal(layer.near(100, 300), null);
  run(layer, POOL_DRIES + 1);
  assert.equal(layer.near(100, 100), null);
});

test('splatMarks dresses the ground around a creature, the same for the same seed, nothing in flight', () => {
  const at = { x: 500, y: 500 }, marks = splatMarks({ at, width: 100, grid: 100, seed: 's' });
  assert.deepEqual(marks, splatMarks({ at, width: 100, grid: 100, seed: 's' }));
  assert.notDeepEqual(marks, splatMarks({ at, width: 100, grid: 100, seed: 't' }));
  assert.equal(marks[0].art, 'pool');
  assert.ok(marks.length > 10 && marks.some((m) => m.art === 'drop'));
  assert.ok(marks.every((m) => m.fromX === undefined && !m.wait && !m.spreads));
  assert.ok(marks.every((m) => Math.hypot(m.x - 500, m.y - 500) < 200), 'around it');
});

test('the amount scales blood: stains grow and shrink, drops come and go, 0 is none, 1 is unchanged', () => {
  const marks = [stain(), ...Array.from({ length: 200 }, (_, i) => ({ art: 'drop', n: 0, x: i, y: 0, r: 4 }))];
  assert.equal(scaleMarks(marks, 1), marks);
  assert.deepEqual(scaleMarks(marks, 0), []);
  const low = scaleMarks(marks, 0.5, 'x'), high = scaleMarks(marks, 2, 'x');
  assert.deepEqual(low, scaleMarks(marks, 0.5, 'x'), 'the same each time');
  assert.ok(low[0].r < 50 && high[0].r > 50);
  assert.ok(low.length > 70 && low.length < 130, `about half the drops: ${low.length}`);
  assert.ok(high.length > 350, `about twice the drops: ${high.length}`);
});

test('what a scene keeps does not lie on water', () => {
  const water = { flow: null };
  const { layer, live } = fakeLayer({ life: () => 400, waterAt: (x) => (x > 500 ? water : null) });
  layer.dress([stain(), stain({ x: 600 })]);
  assert.equal(live().filter((s) => s.position.x > 500).length, 0, 'none on the water');
  assert.equal(live().filter((s) => s.position.x < 500).length, 1, 'kept on the ground');
});

test('blood in water thins away, drawn out along a current', () => {
  const start = driftLook(0, true), mid = driftLook(0.5, true), still = driftLook(0.5, false);
  assert.ok(start.alpha < 0.75 && mid.alpha < start.alpha);
  assert.equal(driftLook(1, true).alpha, 0);
  assert.ok(mid.along > mid.across, 'along the way it flows');
  assert.equal(still.along, still.across, 'evenly where it does not');
});

test('blood on the floor goes by the game clock: it waits while the clock stands still', () => {
  let time = 1000;
  const { layer, live } = fakeLayer({ life: () => 300, now: () => time });
  layer.add([stain()]);
  run(layer, 600);
  assert.equal(live().length, 1, 'real time alone takes none of it');
  assert.equal(live()[0].tint, 0xffffff, 'nor dries it');
  time += POOL_DRIES;
  run(layer, 1);
  assert.equal(live()[0].tint, driedTint(POOL_DRIES), 'dry as the game moves on');
  time -= 500;
  run(layer, 1);
  assert.equal(live().length, 1, 'a clock set back does no harm');
  time += 2000;
  run(layer, 1);
  assert.equal(live().length, 0, 'gone after a long rest');
});

test('rain washes blood by the game clock: none while it stands still', () => {
  let time = 1000;
  const { layer, live } = fakeLayer({ life: () => 900, now: () => time, rain: () => 1, exposed: () => true });
  layer.add([stain()]);
  run(layer, WASH_SECONDS);
  assert.equal(live()[0].alpha, 1, 'the clock has not moved');
  time += WASH_SECONDS / 2;
  run(layer, 1);
  assert.ok(live()[0].alpha < 0.6 && live()[0].alpha > 0.4, 'half gone as it moves');
  time += WASH_SECONDS;
  run(layer, 1);
  assert.equal(live().length, 0);
});

test('splat blood starts wet, dries by the game clock, and can be stepped in until then; older saved blood is dry', () => {
  let time = 1000;
  const { layer, live } = fakeLayer({ life: () => 300, now: () => time });
  layer.dress([stain({ art: 'pool', x: 100, y: 100, r: 50, at: 1000, color: 0x00aa00 })]);
  assert.equal(live()[0].tint, 0xffffff, 'wet');
  assert.equal(layer.near(100, 100).color, 0x00aa00);
  run(layer, 600);
  assert.equal(live()[0].tint, 0xffffff, 'waits for the clock');
  time += POOL_DRIES;
  run(layer, 1);
  assert.equal(live()[0].tint, driedTint(POOL_DRIES), 'dry');
  assert.equal(layer.near(100, 100), null);
  time += 100000;
  run(layer, 1);
  assert.equal(live().length, 1, 'and it stays');
  const old = fakeLayer({ life: () => 300, now: () => time });
  old.layer.dress([stain({ art: 'pool', x: 100, y: 100, r: 50, color: 0x00aa00 })]);
  assert.equal(old.live()[0].tint, driedTint(POOL_DRIES));
  assert.equal(old.layer.near(100, 100), null);
  assert.equal(unpackMark(packMark({ art: 'pool', x: 1, y: 2, r: 3, at: 77 })).at, 77);
  assert.equal(unpackMark(packMark({ art: 'pool', x: 1, y: 2, r: 3 })).at, undefined);
});

test('fresh splat blood on water clouds away once; on a scene loading, it does not play again', () => {
  const water = { flow: 0 };
  const { layer, live } = fakeLayer({ life: () => 300, now: () => 1000, waterAt: (x) => (x > 500 ? water : null) });
  const old = stain({ art: 'pool', x: 600, y: 100, r: 50, at: 900 }), fresh = stain({ art: 'pool', x: 700, y: 100, r: 50, at: 1000 }), dry = stain({ art: 'pool', x: 800, y: 100, r: 50 }), land = stain({ art: 'pool', x: 100, y: 100, r: 50, at: 1000 });
  layer.dress([old]);
  assert.equal(live().length, 0, 'there as it loaded: stays quiet');
  layer.dress([old, fresh, dry, land]);
  assert.equal(live().filter((s) => s.position.x === 700).length, 1, 'the new one on water plays');
  assert.equal(live().filter((s) => s.position.x === 800).length, 0, 'long-dry blood does not');
  assert.equal(live().filter((s) => s.position.x === 100).length, 1, 'land keeps its own');
  const before = live().length;
  layer.dress([old, fresh, dry, land]);
  assert.equal(live().length, before, 'and once only');
  run(layer, 30);
  assert.equal(live().filter((s) => s.position.x > 500).length, 0, 'gone');
  assert.equal(live().filter((s) => s.position.x === 100).length, 1, 'and the land stays');
});
