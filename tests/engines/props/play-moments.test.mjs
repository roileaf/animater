import test from "node:test";
import assert from "node:assert/strict";
import { createPlayWatch, strikeMoment, momentWait } from "../../../scripts/engines/props/play-moments.mjs";

// A hand-run clock and timers.
const clock = () => {
  let t = 0, id = 0; const timers = new Map();
  return {
    now: () => t,
    later: (fn, ms) => { timers.set(++id, { fn, at: t + ms }); return id; },
    cancel: (k) => timers.delete(k),
    tick(ms) { t += ms; for (const [k, v] of [...timers]) if (v.at <= t) { timers.delete(k); v.fn(); } },
  };
};

test("a play that starts is handed to its waiter with its plan and how long ago it started", async () => {
  const c = clock(), w = createPlayWatch(c);
  w.started("m1", [{ kind: "impact", delay: 300 }]);
  c.tick(120);
  assert.deepEqual(await w.wait("m1", 5000), { plan: [{ kind: "impact", delay: 300 }], age: 120 });
  // a waiter that came first is answered as the play starts
  const p = w.wait("m2", 5000);
  c.tick(50); w.started("m2", []);
  assert.deepEqual(await p, { plan: [], age: 0 });
});

test("a roll whose play never starts (nothing set to play, no recipe, skipped) answers null as soon as that is known", async () => {
  const c = clock(), w = createPlayWatch(c);
  const p = w.wait("m", 5000);
  w.ended("m");
  assert.equal(await p, null);
  // told before it was asked
  w.ended("n");
  assert.equal(await w.wait("n", 5000), null);
  // an end after the start changes nothing: the start is kept
  w.started("o", [{ kind: "cast", delay: 0 }]); w.ended("o");
  assert.deepEqual((await w.wait("o", 5000)).plan, [{ kind: "cast", delay: 0 }]);
});

test("a waiter gives up after its cap; a missing key answers null at once", async () => {
  const c = clock(), w = createPlayWatch(c);
  const p = w.wait("m", 1000);
  c.tick(1000);
  assert.equal(await p, null);
  assert.equal(await w.wait(undefined, 1000), null);
  // a stale report is dropped after keep
  w.started("old", []); c.tick(20000);
  const q = w.wait("old", 10); c.tick(10);
  assert.equal(await q, null);
});

test("when a melee strike reaches its target: the swing clip's blow, else the first hit on a target, else the attacker's gesture", () => {
  // a JB2A sword swing: it lands 47% into the clip
  assert.equal(strikeMoment([{ kind: "cast", delay: 0, duration: 400 }, { kind: "impact", delay: 200, duration: 1000, subject: "source", assets: ["jb2a.sword.melee.01.white"] }]), 670);
  assert.equal(strikeMoment([{ kind: "motion", subject: "source", motion: "lunge", delay: 0, duration: 600 }, { kind: "impact", subject: "targets", delay: 350, duration: 800, assets: ["jb2a.impact.003"] }]), 350);
  assert.equal(strikeMoment([{ kind: "motion", subject: "source", motion: "lunge", delay: 100, duration: 600 }]), 370);
  // a flight's arrival (a thrown weapon's plan with no timed hit)
  assert.equal(strikeMoment([{ kind: "projectile", delay: 200, duration: 1000 }]), 750);
  assert.equal(strikeMoment([]), 0);
  assert.equal(strikeMoment(null), 0);
});

test("how long to wait from now for a moment of a play that started age ms ago, capped", () => {
  assert.equal(momentWait(670, 120), 550);
  assert.equal(momentWait(100, 400), 0);
  assert.equal(momentWait(90000, 0), 5000);
  assert.equal(momentWait(NaN, 0), 0);
});
