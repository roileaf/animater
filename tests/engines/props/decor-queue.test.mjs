import test from "node:test";
import assert from "node:assert/strict";
import { createDecorQueue } from "../../../scripts/engines/props/decor-break.mjs";

// A queue whose ticks run when the test says, and whose writes resolve when the test says.
function harness({ fail = () => false } = {}) {
  const ticks = [], writes = [], traced = [];
  const queue = createDecorQueue({
    later: (fn) => ticks.push(fn),
    trace: (m) => traced.push(m),
    write: (target, entries) => new Promise((resolve, reject) => {
      writes.push({ target, keys: entries.map((e) => e.key), resolve: (v) => resolve(v), reject });
      if (fail(target, entries)) reject(new Error("region gone"));
    }),
  });
  const tick = () => { const run = ticks.splice(0); for (const fn of run) fn(); };
  const settle = () => new Promise((r) => setTimeout(r, 0));
  return { queue, ticks, writes, traced, tick, settle };
}
const e = (key) => ({ key, kind: "crate", x: 1, y: 2, note: { seed: 1 } });

test("twenty breaks of one region in one tick are one write carrying them all, in order", async () => {
  const h = harness(), done = [];
  for (let i = 0; i < 20; i++) done.push(h.queue.add("R1", e(`crate:${i}`), "doc-R1"));
  assert.equal(h.ticks.length, 1, "one flush planned for the region");
  assert.equal(h.writes.length, 0, "nothing written before the tick");
  h.tick();
  assert.equal(h.writes.length, 1);
  assert.deepEqual(h.writes[0].keys, Array.from({ length: 20 }, (_, i) => `crate:${i}`));
  assert.equal(h.writes[0].target, "doc-R1");
  h.writes[0].resolve();
  assert.deepEqual(await Promise.all(done), Array(20).fill(true));
});

test("each region writes on its own", async () => {
  const h = harness();
  const a = h.queue.add("R1", e("a"), "doc-R1"), b = h.queue.add("R2", e("b"), "doc-R2");
  h.tick();
  assert.deepEqual(h.writes.map((w) => [w.target, w.keys]), [["doc-R1", ["a"]], ["doc-R2", ["b"]]]);
  for (const w of h.writes) w.resolve();
  assert.deepEqual(await Promise.all([a, b]), [true, true]);
});

test("queued and in-flight keys are reported until the write lands, then forgotten", async () => {
  const h = harness();
  const a = h.queue.add("R1", e("a"), "doc");
  assert.deepEqual(h.queue.keys("R1"), ["a"], "queued");
  assert.deepEqual(h.queue.keys("R2"), []);
  h.tick();
  assert.deepEqual(h.queue.keys("R1"), ["a"], "in flight still counts (no second rubble, no second whisper)");
  h.writes[0].resolve();
  await a;
  assert.deepEqual(h.queue.keys("R1"), []);
});

test("a break asked while the region's write is in flight waits for it, then writes alone", async () => {
  const h = harness();
  const a = h.queue.add("R1", e("a"), "doc");
  h.tick();
  const b = h.queue.add("R1", e("b"), "doc");
  assert.deepEqual(h.queue.keys("R1"), ["a", "b"]);
  h.tick();
  assert.equal(h.writes.length, 1, "no second write while the first is in flight (it would read stale breaks)");
  h.writes[0].resolve();
  assert.equal(await a, true);
  await h.settle();
  h.tick();
  assert.equal(h.writes.length, 2);
  assert.deepEqual(h.writes[1].keys, ["b"]);
  h.writes[1].resolve();
  assert.equal(await b, true);
  assert.deepEqual(h.queue.keys("R1"), []);
});

test("a write that fails or declines resolves false, is traced, and the queue goes on", async () => {
  const h = harness({ fail: (target) => target === "gone" });
  const a = h.queue.add("R1", e("a"), "gone");
  h.tick();
  assert.equal(await a, false);
  assert.equal(h.traced.length, 1);
  assert.match(h.traced[0], /region gone/);
  assert.deepEqual(h.queue.keys("R1"), []);
  const b = h.queue.add("R1", e("b"), "doc");
  h.tick();
  h.writes[1].resolve(false);
  assert.equal(await b, false, "a write that returns false wrote nothing");
  const c = h.queue.add("R1", e("c"), "doc");
  h.tick();
  h.writes[2].resolve();
  assert.equal(await c, true);
});

test("the write goes to the region as last handed in", async () => {
  const h = harness();
  const a = h.queue.add("R1", e("a"), "old"), b = h.queue.add("R1", e("b"), "new");
  h.tick();
  assert.equal(h.writes[0].target, "new");
  h.writes[0].resolve();
  await Promise.all([a, b]);
});

test("idle: resolves at once with nothing to write, else once the region's writes (or every region's) have landed", async () => {
  const h = harness();
  const order = [];
  await h.queue.idle("R1"); order.push("empty");
  const a = h.queue.add("R1", e("a"), "doc"), b = h.queue.add("R2", e("b"), "doc2");
  const one = h.queue.idle("R1").then(() => order.push("R1 idle")), all = h.queue.idle().then(() => order.push("all idle"));
  h.tick();
  await h.settle();
  assert.deepEqual(order, ["empty"], "nothing lands before the writes do");
  h.writes[0].resolve(); await a; await one;
  assert.deepEqual(order, ["empty", "R1 idle"]);
  h.writes[1].resolve(); await b; await all;
  assert.deepEqual(order, ["empty", "R1 idle", "all idle"]);
  // A break queued behind one in flight: idle waits for both writes.
  const c = h.queue.add("R1", e("c"), "doc");
  h.tick();
  const d = h.queue.add("R1", e("d"), "doc");
  let done = false; const waiting = h.queue.idle("R1").then(() => { done = true; });
  h.writes[2].resolve(); await c; await h.settle(); h.tick();
  assert.equal(done, false, "the second write is still to come");
  h.writes[3].resolve(); await d; await waiting;
  assert.equal(done, true);
});
