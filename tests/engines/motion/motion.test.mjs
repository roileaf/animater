import test from "node:test";
import assert from "node:assert/strict";
import {
  TokenMotionPlayer,
  motionPose,
  motionDirection,
} from "../../../scripts/engines/motion/motion.mjs";
import { validateRecipe, planRecipe } from "../../../scripts/core/model.mjs";
function fixture({ afterimages = null } = {}) {
  let now = 0,
    id = 0;
  const callbacks = new Map();
  const point = (x, y) => ({
    x,
    y,
    set(x, y) {
      this.x = x;
      this.y = y;
    },
  });
  const token = {
    visible: true,
    document: { x: 50, y: 50 },
    center: { x: 100, y: 100 },
    mesh: { position: point(100, 100), rotation: 0.5, scale: point(1.2, 0.8) },
  };
  const player = new TokenMotionPlayer({
    now: () => now,
    frame: (f) => {
      callbacks.set(++id, f);
      return id;
    },
    cancel: (i) => callbacks.delete(i),
    grid: () => 100,
    afterimages,
  });
  const advance = (t) => {
    now = t;
    const queued = [...callbacks.values()];
    callbacks.clear();
    queued.forEach((f) => f(now));
  };
  const stage = {
    kind: "motion",
    motion: "lunge",
    duration: 1000,
    distance: 0.35,
    intensity: 1,
  };
  return { token, player, stage, advance };
}
test("token motion animates actual mesh and restores pose without document writes", async () => {
  const { token, player, stage, advance } = fixture();
  const original = structuredClone(token.document);
  const playing = player.play(token, stage, { x: 1, y: 0 }, "u");
  advance(500);
  assert.equal(token.mesh.position.x, 135);
  assert.deepEqual(token.document, original);
  advance(1000);
  await playing;
  assert.equal(token.mesh.position.x, 100);
  assert.equal(token.mesh.rotation, 0.5);
  assert.equal(token.mesh.scale.x, 1.2);
});
test("a motion starting mid-shake plays from the token's own spot, not the shaken one", async () => {
  // Another module (pf2e-rpg-numbers' damage shake, via Sequencer) has the mesh swung aside.
  const { token, player, stage, advance } = fixture();
  token.mesh.position.set(107, 98);
  const playing = player.play(token, stage, { x: 1, y: 0 }, "u");
  advance(500);
  assert.deepEqual([token.mesh.position.x, token.mesh.position.y], [135, 100]);
  advance(1000);
  await playing;
  assert.deepEqual([token.mesh.position.x, token.mesh.position.y], [100, 100]);
});
test("saved short motion retains explicit duration and reaches its pose midpoint", async () => {
  const { token, player, stage, advance } = fixture();
  const playing = player.play(
    token,
    { ...stage, duration: 100 },
    { x: 1, y: 0 },
    "u",
  );
  advance(50);
  assert.equal(token.mesh.position.x, 135);
  assert.equal(player.active.size, 1);
  advance(100);
  await playing;
  assert.equal(token.mesh.position.x, 100);
  assert.equal(player.active.size, 0);
});
test("default frame functions retain browser receiver binding", async () => {
  const previousFrame = globalThis.requestAnimationFrame,
    previousCancel = globalThis.cancelAnimationFrame;
  let callback;
  globalThis.requestAnimationFrame = function (fn) {
    assert.equal(this, globalThis);
    callback = fn;
    return 1;
  };
  globalThis.cancelAnimationFrame = function () {
    assert.equal(this, globalThis);
  };
  try {
    const { token, stage } = fixture();
    const player = new TokenMotionPlayer({ now: () => 0 });
    const playing = player.play(token, stage, { x: 1, y: 0 }, "u");
    callback(500);
    player.stop();
    await playing;
    assert.equal(token.mesh.position.x, 100);
  } finally {
    globalThis.requestAnimationFrame = previousFrame;
    globalThis.cancelAnimationFrame = previousCancel;
  }
});
test("default frames step on the canvas ticker after other modules' motions, so the pose is the one drawn", async () => {
  // Sequencer moves token meshes from a NORMAL+1 ticker listener, and the ticker draws the frame.
  // A bare animation frame would write after the draw, and the other module's pose would show.
  const saved = { raf: globalThis.requestAnimationFrame, caf: globalThis.cancelAnimationFrame, canvas: globalThis.canvas };
  const rafs = [], once = [];
  globalThis.requestAnimationFrame = (fn) => rafs.push(fn);
  globalThis.cancelAnimationFrame = () => {};
  globalThis.canvas = { app: { ticker: { addOnce: (fn, ctx, priority) => once.push({ fn, priority }), remove: () => {} } } };
  try {
    const { token, stage } = fixture();
    let now = 0;
    const player = new TokenMotionPlayer({ now: () => now });
    const playing = player.play(token, stage, { x: 1, y: 0 }, "u");
    rafs.shift()();
    assert.equal(once.length, 1);
    assert.equal(once[0].priority, 1);
    now = 500;
    once.shift().fn(16.6);
    assert.equal(token.mesh.position.x, 135);
    player.stop();
    await playing;
  } finally {
    globalThis.requestAnimationFrame = saved.raf;
    globalThis.cancelAnimationFrame = saved.caf;
    globalThis.canvas = saved.canvas;
  }
});
test("overlap and user stop restore only owned animations", async () => {
  const { token, player, stage, advance } = fixture();
  const first = player.play(token, stage, { x: 1, y: 0 }, "u");
  advance(250);
  const second = player.play(
    token,
    { ...stage, motion: "pulse" },
    { x: 1, y: 0 },
    "v",
  );
  await first;
  assert.equal(token.mesh.position.x, 100);
  advance(500);
  assert.ok(token.mesh.scale.x > 1.2);
  player.stop("u");
  assert.equal(player.active.size, 1);
  player.stop("v");
  await second;
  assert.equal(token.mesh.scale.x, 1.2);
});
test("moving token cancels old pose without undoing its new location", async () => {
  const { token, player, stage, advance } = fixture();
  const playing = player.play(token, stage, { x: 1, y: 0 }, "u");
  advance(500);
  token.document.x = 250;
  token.mesh.position.set(300, 100);
  advance(600);
  await playing;
  assert.equal(token.mesh.position.x, 300);
  assert.equal(player.active.size, 0);
});
test("hidden tokens never become visible through motion", async () => {
  const { token, player, stage } = fixture();
  token.document.hidden = true;
  assert.equal(await player.play(token, stage, { x: 1, y: 0 }, "u"), false);
  assert.equal(player.active.size, 0);
});
test("live rotation change cancels motion without restoring obsolete rotation", async () => {
  const { token, player, stage, advance } = fixture();
  const playing = player.play(
    token,
    { ...stage, motion: "spin" },
    { x: 1, y: 0 },
    "u",
  );
  advance(500);
  token.document.rotation = 90;
  token.mesh.rotation = Math.PI / 2;
  advance(600);
  await playing;
  assert.equal(token.mesh.rotation, Math.PI / 2);
  assert.equal(player.active.size, 0);
});
test("all poses return to baseline and directional recoil points away from caster", () => {
  for (const motion of [
    "lunge",
    "recoil",
    "shake",
    "spin",
    "levitate",
    "pulse",
  ]) {
    assert.deepEqual(motionPose({ motion }, 1), {
      x: 0,
      y: 0,
      rotation: 0,
      scale: 1,
    });
    assert.ok(
      Object.values(motionPose({ motion }, 0.4)).every(Number.isFinite),
    );
  }
  assert.deepEqual(
    motionDirection(
      { center: { x: 0, y: 10 } },
      { center: { x: 0, y: 0 } },
      null,
      "recoil",
    ),
    { x: 0, y: 1 },
  );
});
test("motion imports need no JB2A file and require targets only for directional lunge", () => {
  const recipe = validateRecipe({
    id: "motion",
    name: "Motion",
    trigger: "manual",
    stages: [{ kind: "motion", motion: "pulse", assets: [] }],
  });
  assert.equal(planRecipe(recipe, [], { source: {}, targets: [] }).length, 1);
  recipe.stages[0].motion = "lunge";
  assert.throws(
    () => planRecipe(recipe, [], { source: {}, targets: [] }),
    /Lunge needs/,
  );
});

test("same-owner overlapping gestures share baseline without cancelling earlier movement", async () => {
  const { token, player, stage, advance } = fixture();
  let firstResolved = false;
  const first = player.play(token, stage, { x: 1, y: 0 }, "u").then(() => { firstResolved = true; });
  advance(500);
  assert.equal(token.mesh.position.x, 135);
  const second = player.play(token, { ...stage, motion: "pulse" }, { x: 1, y: 0 }, "u");
  await Promise.resolve();
  assert.equal(firstResolved, false, "second gesture must not stop first mid-pose");
  assert.equal(token.mesh.position.x, 135, "adding pulse must not snap lunge to baseline");
  advance(750);
  assert.equal(token.mesh.position.x, 117.5);
  assert.ok(token.mesh.scale.x > 1.2);
  advance(1000);
  await first;
  assert.equal(token.mesh.position.x, 100);
  assert.ok(token.mesh.scale.x > 1.2, "finishing first gesture must retain remaining pulse");
  advance(1500);
  await second;
  assert.equal(token.mesh.scale.x, 1.2);
  assert.equal(player.active.size, 0);
});

test("token resize or texture flip cancels old motion without restoring obsolete scale", async () => {
  for (const change of [
    token => { token.document.width = 2; token.mesh.position.set(150, 100); },
    token => { token.document.texture = { scaleX: -1, scaleY: 1 }; },
  ]) {
    const { token, player, stage, advance } = fixture();
    token.document.width = 1;
    token.document.height = 1;
    token.document.texture = { scaleX: 1, scaleY: 1 };
    const playing = player.play(token, stage, { x: 1, y: 0 }, "u");
    advance(500);
    change(token);
    token.mesh.scale.set(-2.4, 1.6);
    advance(600);
    assert.equal(player.active.size, 0, "size changes invalidate captured pose");
    await playing;
    assert.equal(token.mesh.scale.x, -2.4);
    assert.equal(token.mesh.scale.y, 1.6);
  }
});

test("user prefix stops every owned session without affecting another user's motion", async () => {
  const { token, player, stage, advance } = fixture();
  const other = { ...token, document: { ...token.document }, mesh: {
    position: { ...token.mesh.position }, scale: { ...token.mesh.scale }, rotation: token.mesh.rotation,
  } };
  const first = player.play(token, stage, { x: 1, y: 0 }, "user:session-a");
  const second = player.play(other, stage, { x: 1, y: 0 }, "user-two:session-b");
  advance(500);
  player.stop("user", { prefix: true });
  await first;
  assert.equal(token.mesh.position.x, 100);
  assert.equal(player.active.size, 1);
  assert.equal(other.mesh.position.x, 135);
  player.stop("user-two", { prefix: true });
  await second;
  assert.equal(player.active.size, 0);
});

// Records what the player hands the afterimage renderer.
function ghostLog({ throws = false } = {}) {
  const log = { drops: [], ticks: 0, fadeOuts: 0 };
  log.renderer = {
    drop(token, mesh, tint, clock) {
      if (throws) throw new Error("boom");
      log.drops.push({ x: mesh.position.x, y: mesh.position.y, tint, clock });
    },
    tick() { log.ticks++; },
    fadeOut() { log.fadeOuts++; },
  };
  return log;
}
const rush = { kind: "motion", motion: "rush", duration: 600, motionOffset: { x: 3, y: 0 }, trailTint: "#ff8800" };
const playFrames = (advance, until, from = 0, step = 16) => { for (let t = from + step; t <= until; t += step) advance(t); };

test("a 3-square rush drops ghosts behind the token", async () => {
  const log = ghostLog();
  const { token, player, advance } = fixture({ afterimages: log.renderer });
  const xs = [];
  const playing = player.play(token, rush, { x: 1, y: 0 }, "u");
  for (let t = 16; t <= 640; t += 16) { advance(t); xs.push({ t, x: token.mesh.position.x }); }
  await playing;
  assert.ok(log.drops.length >= 4, `${log.drops.length} ghosts`);
  assert.ok(log.drops.every((d) => d.tint === "#ff8800"));
  // Each ghost is where the token was drawn that frame, and the token then moves on past it.
  const peak = Math.max(...xs.map((p) => p.x));
  for (const d of log.drops) {
    assert.equal(d.x, xs.find((p) => p.t === d.clock).x);
    assert.ok(d.x > 100 && d.x < peak);
  }
  // Outbound only: dropped in order away from rest, none on the way back.
  const peakAt = xs.find((p) => p.x === peak).t;
  assert.ok(log.drops.every((d, i) => d.clock <= peakAt && (i === 0 || d.x > log.drops[i - 1].x)));
  assert.ok(log.ticks > 0);
  assert.equal(log.fadeOuts, 1);
});

test("an in-place lunge drops no ghosts", async () => {
  const log = ghostLog();
  const { token, player, stage, advance } = fixture({ afterimages: log.renderer });
  const playing = player.play(token, { ...stage, duration: 200, distance: 1 }, { x: 1, y: 0 }, "u");
  playFrames(advance, 220);
  await playing;
  assert.equal(log.drops.length, 0);
});

test("stopping a rush lets its ghosts fade out", async () => {
  const log = ghostLog();
  const { token, player, advance } = fixture({ afterimages: log.renderer });
  const playing = player.play(token, rush, { x: 1, y: 0 }, "u");
  playFrames(advance, 160);
  assert.ok(log.drops.length > 0);
  player.stop("u");
  await playing;
  assert.equal(log.fadeOuts, 1);
  assert.equal(token.mesh.position.x, 100);
});

test("a destroyed mesh ends the motion and its ghosts cleanly", async () => {
  const log = ghostLog();
  const { token, player, advance } = fixture({ afterimages: log.renderer });
  const playing = player.play(token, rush, { x: 1, y: 0 }, "u");
  playFrames(advance, 160);
  const dropped = log.drops.length;
  token.mesh.destroyed = true;
  playFrames(advance, 320, 160);
  assert.equal(await playing, true);
  assert.equal(log.fadeOuts, 1);
  assert.equal(log.drops.length, dropped);
});

test("a broken afterimage renderer does not stop the motion", async () => {
  const log = ghostLog({ throws: true });
  const { token, player, advance } = fixture({ afterimages: log.renderer });
  const warn = console.warn;
  console.warn = () => {};
  try {
    const playing = player.play(token, rush, { x: 1, y: 0 }, "u");
    playFrames(advance, 160);
    assert.ok(token.mesh.position.x > 100);
    playFrames(advance, 640, 160);
    await playing;
  } finally { console.warn = warn; }
  assert.equal(token.mesh.position.x, 100);
  assert.equal(player.active.size, 0);
});
