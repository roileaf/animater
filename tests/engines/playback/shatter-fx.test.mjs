import test from 'node:test';
import assert from 'node:assert/strict';
import { SHATTER_MS, shardGeometry, shardTint, shatterSeed, shatterVisual, createShatterHost, spotFromBounds } from '../../../scripts/engines/playback/shatter-fx.mjs';

function fakePIXI() {
  class Graphics {
    constructor() { this.calls = []; this.position = { set: (x, y) => { this.x = x; this.y = y; } }; this.destroyed = false; }
    clear() { this.calls = []; return this; }
    beginFill(color, alpha) { this.calls.push(['fill', color, alpha]); return this; }
    drawPolygon(points) { this.calls.push(['poly', points]); return this; }
    drawCircle(x, y, r) { this.calls.push(['circle', x, y, r]); return this; }
    lineStyle(...a) { this.calls.push(['line', ...a]); return this; }
    endFill() { return this; }
    destroy() { this.destroyed = true; }
  }
  return { Graphics, BLEND_MODES: { ADD: 1 } };
}

test('shards: the same seed draws the same shards on every screen, and each is a triangle', () => {
  const a = shardGeometry(42, 100), b = shardGeometry(42, 100), c = shardGeometry(43, 100);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
  assert.ok(a.length >= 10 && a.length <= 40);
  for (const s of a) {
    assert.equal(s.points.length, 6);
    assert.ok(Number.isFinite(s.dx) && Number.isFinite(s.dy) && Number.isFinite(s.spin));
  }
});

test('shards: a bigger effect breaks into more and larger pieces, within a cap', () => {
  const small = shardGeometry(1, 40), big = shardGeometry(1, 400);
  assert.ok(big.length >= small.length);
  assert.ok(big.length <= 40);
  const size = (list) => Math.max(...list.flatMap((s) => s.points.map(Math.abs)));
  assert.ok(size(big) > size(small));
});

test('the shard tint follows the effect\'s tint, else a pale blue-white', () => {
  assert.equal(shardTint(0xff0000), 0xff0000);
  assert.equal(shardTint('#00ff00'), 0x00ff00);
  assert.equal(shardTint('nope'), 0xdcecff);
  assert.equal(shardTint(undefined), 0xdcecff);
  assert.equal(shardTint({ valueOf: () => 0x123456 }), 0x123456);
});

test('the seed comes from the effect id', () => {
  assert.equal(shatterSeed('abc'), shatterSeed('abc'));
  assert.notEqual(shatterSeed('abc'), shatterSeed('abd'));
  assert.ok(Number.isInteger(shatterSeed(undefined)));
});

test('a spot from a sprite\'s screen bounds and the stage transform', () => {
  const spot = spotFromBounds({ x: 100, y: 200, width: 200, height: 100 }, { tx: 0, ty: 0, scale: 2 });
  assert.deepEqual(spot, { x: 100, y: 125, radius: 50 });
  assert.equal(spotFromBounds({ x: 0, y: 0, width: 0, height: 0 }, { tx: 0, ty: 0, scale: 1 }), null);
  assert.equal(spotFromBounds(null, { scale: 1 }), null);
});

test('the shatter visual bursts, fades and ends after its time', () => {
  const PIXI = fakePIXI();
  const fx = shatterVisual(PIXI, { at: { x: 10, y: 20 }, radius: 80, tint: 0xff0000, seed: 5 }, 1000);
  assert.equal(fx.display.x, 10);
  assert.equal(fx.update(1000 + 50), true);
  const early = fx.display.calls.filter((c) => c[0] === 'poly');
  assert.ok(early.length > 0);
  assert.ok(fx.display.calls.some((c) => c[0] === 'circle'), 'a brief flash at the start');
  fx.update(1000 + 600);
  assert.ok(!fx.display.calls.some((c) => c[0] === 'circle'), 'the flash is gone');
  const late = fx.display.calls.filter((c) => c[0] === 'fill').map((c) => c[2]);
  assert.ok(Math.max(...late) < 0.5, 'shards fade');
  assert.equal(fx.update(1000 + SHATTER_MS + 1), false);
  fx.destroy();
  assert.equal(fx.display.destroyed, true);
});

test('the shatter host caps how many play, ticks them out and clears', () => {
  let t = 0;
  const made = [];
  const host = createShatterHost({ now: () => t, max: 2, spawn: (spec) => { const fx = shatterVisual(fakePIXI(), spec, t); made.push(fx); return fx; } });
  const spec = { at: { x: 0, y: 0 }, radius: 50, seed: 1 };
  assert.equal(host.play(spec), true);
  assert.equal(host.play(spec), true);
  assert.equal(host.play(spec), false);
  t = 100; host.tick();
  assert.equal(host.count(), 2);
  t = SHATTER_MS + 200; host.tick();
  assert.equal(host.count(), 0);
  assert.ok(made.every((fx) => fx.display.destroyed));
  host.play(spec);
  host.clear();
  assert.equal(host.count(), 0);
});

test('the shatter host never throws on a broken spawn or visual', () => {
  const host = createShatterHost({ now: () => 0, spawn: () => { throw new Error('no canvas'); } });
  assert.equal(host.play({ at: { x: 0, y: 0 }, radius: 10 }), false);
  const broken = createShatterHost({ now: () => 0, spawn: () => ({ update() { throw new Error('x'); }, destroy() { throw new Error('y'); } }) });
  broken.play({ at: { x: 0, y: 0 }, radius: 10 });
  assert.doesNotThrow(() => broken.tick());
  assert.equal(broken.count(), 0);
});
