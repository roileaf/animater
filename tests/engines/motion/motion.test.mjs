import test from "node:test";
import assert from "node:assert/strict";
import {
  TokenMotionPlayer,
  motionPose,
  motionDirection,
} from "../../../scripts/engines/motion/motion.mjs";
import { validateRecipe, planRecipe } from "../../../scripts/core/model.mjs";
function fixture() {
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
