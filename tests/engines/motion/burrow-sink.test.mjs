import test from "node:test";
import assert from "node:assert/strict";
import { createBurrowSink, poseMesh, drawnBeforeSink, SUNK_SCALE, GHOST_ALPHA } from "../../../scripts/engines/motion/burrow-sink.mjs";

const clock = () => { let t = 0; return { now: () => t, at: (v) => { t = v; } }; };
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);
const player = { owner: false, gm: false }, owner = { owner: true, gm: false }, gm = { owner: false, gm: true };

test("a token on the surface has its natural pose", () => {
  const c = clock(), sink = createBurrowSink({ now: c.now });
  assert.deepEqual(sink.pose("a", player), { alpha: 1, scale: 1 });
  assert.equal(sink.update("a", false), null);
  assert.equal(sink.hiddenFor("a", player), false);
});

test("going under sinks over the duration, easing in, then hides it from a non-owner", () => {
  const c = clock(), sink = createBurrowSink({ now: c.now, duration: 400 });
  assert.equal(sink.update("a", true), "sink");
  assert.equal(sink.update("a", true), null);
  assert.deepEqual(sink.pose("a", player), { alpha: 1, scale: 1 });
  c.at(200);
  const half = sink.pose("a", player);
  close(half.alpha, 0.75); // ease-in: a quarter of the way at half time
  close(half.scale, 1 - 0.25 * (1 - SUNK_SCALE));
  assert.equal(sink.moving("a"), true);
  assert.equal(sink.hiddenFor("a", player), false);
  c.at(400);
  const down = sink.pose("a", player);
  close(down.alpha, 0);
  close(down.scale, SUNK_SCALE);
  assert.equal(sink.moving("a"), false);
  assert.equal(sink.hiddenFor("a", player), true);
});

test("its owner and the GM see a faint ghost at full size and never lose it", () => {
  const c = clock(), sink = createBurrowSink({ now: c.now, duration: 350 });
  sink.update("a", true);
  c.at(1000);
  for (const who of [owner, gm]) {
    const p = sink.pose("a", who);
    close(p.alpha, GHOST_ALPHA);
    assert.equal(p.scale, 1);
    assert.equal(sink.hiddenFor("a", who), false);
  }
});

test("rising eases out and restores exactly 1/1", () => {
  const c = clock(), sink = createBurrowSink({ now: c.now, duration: 400 });
  sink.update("a", true);
  c.at(1000);
  assert.equal(sink.update("a", false), "rise");
  assert.equal(sink.hiddenFor("a", player), false);
  c.at(1100);
  // ease-out: a quarter of the time in, it is already well up (depth 0.75, pose 0.5625 of the way down)
  close(sink.pose("a", player).alpha, 1 - 0.75 ** 2);
  c.at(1400);
  assert.deepEqual(sink.pose("a", player), { alpha: 1, scale: 1 });
  assert.deepEqual(sink.pose("a", owner), { alpha: 1, scale: 1 });
  assert.equal(sink.has("a"), false);
  assert.deepEqual(sink.ids(), []);
});

test("turning back half-way continues from where it is", () => {
  const c = clock(), sink = createBurrowSink({ now: c.now, duration: 400 });
  sink.update("a", true);
  c.at(100); // depth 0.25
  assert.equal(sink.update("a", false), "rise");
  close(sink.depth("a"), 0.25);
  c.at(200);
  assert.equal(sink.depth("a"), 0);
  assert.equal(sink.update("a", true), "sink");
  c.at(300);
  close(sink.depth("a"), 0.25);
});

test("instant puts a token already under straight down", () => {
  const c = clock(), sink = createBurrowSink({ now: c.now });
  assert.equal(sink.update("a", true, { instant: true }), null);
  assert.equal(sink.hiddenFor("a", player), true);
  assert.equal(sink.update("a", false, { instant: true }), null);
  assert.deepEqual(sink.pose("a", player), { alpha: 1, scale: 1 });
});

const mesh = (alpha = 1, sx = 0.8, sy = 0.8) => ({ alpha, scale: { x: sx, y: sy, set(x, y) { this.x = x; this.y = y; } } });

test("poseMesh multiplies into Foundry's values without stacking", () => {
  const m = mesh(0.9);
  let rec = poseMesh(m, { alpha: 0.5, scale: 0.5 });
  close(m.alpha, 0.45);
  close(m.scale.x, 0.4);
  rec = poseMesh(m, { alpha: 0.5, scale: 0.5 }, rec);
  close(m.alpha, 0.45);
  close(m.scale.y, 0.4);
  // Foundry refreshes: its own values become the base again.
  m.alpha = 1; m.scale.set(0.8, 0.8);
  rec = poseMesh(m, { alpha: 0.5, scale: 0.5 }, rec);
  close(m.alpha, 0.5);
  close(m.scale.x, 0.4);
  // Natural again: exactly what Foundry had.
  assert.equal(poseMesh(m, { alpha: 1, scale: 1 }, rec), null);
  assert.equal(m.alpha, 1);
  assert.equal(m.scale.x, 0.8);
});

test("poseMesh can leave the scale alone (another animation owns it)", () => {
  const m = mesh(1);
  poseMesh(m, { alpha: 0.5, scale: 0.5 }, null, { scale: false });
  close(m.alpha, 0.5);
  assert.equal(m.scale.x, 0.8);
});

test("a sunk token this screen could see still counts as drawn for its trail and its digging", () => {
  const seen = { visible: false }, unseen = { visible: false }, plain = { visible: true };
  const hidden = new Map([[seen, true], [unseen, false]]);
  assert.equal(drawnBeforeSink(seen, hidden), true);
  assert.equal(drawnBeforeSink(unseen, hidden), false);
  assert.equal(drawnBeforeSink(plain, hidden), true);
  assert.equal(drawnBeforeSink({ visible: false }, hidden), false);
});
