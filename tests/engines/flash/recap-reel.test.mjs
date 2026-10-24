import test from "node:test";
import assert from "node:assert/strict";
import { frameTokens, planReel, createReelPlayer, canReel, REEL } from "../../../scripts/engines/flash/recap-reel.mjs";

const person = (name, tokenId, extra = {}) => ({ name, img: `${name}.webp`, src: `tokens/${name}.webp`, tokenId, actorId: `a${tokenId}`, x: 0, y: 0, w: 100, h: 100, ...extra });
const moment = (n, extra = {}) => ({
  badges: ["crit"], actor: person(`Hero${n}`, `h${n}`, { x: 100 * n, y: 100 }), targets: [person(`Foe${n}`, `f${n}`, { x: 100 * n + 400, y: 300 })],
  amount: 10 + n, sceneId: "s1", attackMessageId: `m${n}`, at: n, ...extra,
});
const live = (map) => (id) => map[id] ?? null;
const screen = { w: 1920, h: 1080 }, view = { x: 500, y: 400, scale: 0.8 };

test("framing two tokens: both in view between the bars and above the caption, zoom capped", () => {
  const a = { x: 1000, y: 1000, w: 100, h: 100 }, b = { x: 1600, y: 1200, w: 100, h: 100 };
  const f = frameTokens({ points: [a, b], screen, maxZoom: 3 });
  assert.ok(f.x > a.x && f.x < b.x);
  // Each token's screen position stays on screen, between the bars, above the lower third.
  for (const p of [a, b]) {
    const sx = (p.x - f.x) * f.scale + screen.w / 2, sy = (p.y - f.y) * f.scale + screen.h / 2;
    assert.ok(sx > 0 && sx < screen.w, `x ${sx}`);
    assert.ok(sy > screen.h * 0.1 && sy < screen.h * 0.7, `y ${sy}`);
  }
  // Two tokens side by side would zoom far in: capped.
  const close = frameTokens({ points: [a, { x: 1100, y: 1000, w: 100, h: 100 }], screen, maxZoom: 3 });
  assert.equal(close.scale, REEL.zoomCap);
  assert.equal(frameTokens({ points: [a], screen, maxZoom: 1.2 }).scale, 1.2, "the scene's own max zoom");
  assert.equal(frameTokens({ points: [], screen }), null);
});

test("the reel: moments in order, each framed, replayed and slowed at the impact, then the summary", () => {
  const tokens = { h1: { center: { x: 150, y: 150 }, w: 100, h: 100 }, f1: { center: { x: 550, y: 350 }, w: 100, h: 100 },
    h2: { center: { x: 250, y: 150 }, w: 100, h: 100 }, f2: { center: { x: 650, y: 350 }, w: 100, h: 100 },
    h3: { center: { x: 350, y: 150 }, w: 100, h: 100 }, f3: { center: { x: 750, y: 350 }, w: 100, h: 100 } };
  const plan = planReel({ moments: [moment(1), moment(2), moment(3)], viewer: { sceneId: "s1", gm: false, quality: "full" }, tokens: live(tokens), view, screen, maxZoom: 3 });
  assert.equal(plan.steps.length, 3);
  let last = 0;
  for (const s of plan.steps) {
    assert.equal(s.mode, "replay");
    assert.ok(s.start >= last && s.captionAt > s.start && s.replayAt > s.start && s.slow.at > s.replayAt && s.slow.at + s.slow.ms <= s.end);
    assert.ok(s.camera && s.camera.scale > 0);
    assert.equal(s.slow.rate, 0.35);
    assert.deepEqual(s.ghosts, []);
    last = s.end;
  }
  assert.ok(plan.summary.start >= last && plan.end > plan.summary.end);
  assert.ok(plan.end <= REEL.maxMs, `${plan.end} ms`);
  assert.equal(plan.summary.cards.length, 3);
  assert.deepEqual(plan.restore, view);
});

test("a token gone since the fight is replayed against a ghost of its recorded art", () => {
  const plan = planReel({ moments: [moment(1)], viewer: { sceneId: "s1", gm: true, quality: "full" },
    tokens: live({ h1: { center: { x: 150, y: 150 }, w: 100, h: 100 } }), view, screen, maxZoom: 3 });
  const [step] = plan.steps;
  assert.equal(step.mode, "replay");
  assert.deepEqual(step.live, [{ role: "source", tokenId: "h1" }]);
  assert.equal(step.ghosts.length, 1);
  assert.deepEqual({ ...step.ghosts[0] }, { role: "target", tokenId: "f1", actorId: "af1", name: "Foe1", src: "tokens/Foe1.webp", x: 500, y: 300, w: 100, h: 100, elevation: 0 });
  // No art and no token: a caption and art card instead.
  const bare = planReel({ moments: [moment(1, { actor: { name: "Hero", img: "" } })], viewer: { sceneId: "s1", quality: "full" }, tokens: () => null, view, screen });
  assert.equal(bare.steps[0].mode, "card");
});

test("another scene, Balanced or Low quality: caption and art cards, no camera, no slow motion", () => {
  const tokens = live({ h1: { center: { x: 150, y: 150 }, w: 100, h: 100 } });
  for (const viewer of [{ sceneId: "other", quality: "full" }, { sceneId: "s1", quality: "balanced" }, { sceneId: "s1", quality: "low" }]) {
    const plan = planReel({ moments: [moment(1)], viewer, tokens, view, screen });
    assert.equal(plan.steps[0].mode, "card");
    assert.equal(plan.steps[0].camera, null);
    assert.equal(plan.steps[0].slow, null);
    assert.equal(plan.moved, false);
  }
  assert.equal(planReel({ moments: [moment(1)], viewer: { sceneId: "s1", quality: "off" }, tokens, view, screen }), null);
  assert.equal(planReel({ moments: [moment(1)], viewer: { sceneId: "s1", quality: "full", local: false }, tokens, view, screen }), null);
  assert.equal(canReel({ quality: "low" }), true);
});

test("players never see a moment with a hidden token; GMs do", () => {
  const hidden = moment(1, { targets: [person("Lurker", "f1", { hidden: true })] });
  const nowHidden = moment(2);
  const tokens = live({ f2: { center: { x: 1, y: 1 }, w: 100, h: 100, hidden: true } });
  const player = planReel({ moments: [hidden, nowHidden, moment(3)], viewer: { sceneId: "s1", quality: "full" }, tokens, view, screen });
  assert.deepEqual(player.steps.map((s) => s.moment.attackMessageId), ["m3"]);
  const gm = planReel({ moments: [hidden, nowHidden, moment(3)], viewer: { sceneId: "s1", gm: true, quality: "full" }, tokens, view, screen });
  assert.equal(gm.steps.length, 3);
  assert.equal(planReel({ moments: [hidden], viewer: { sceneId: "s1", quality: "full" }, tokens, view, screen }), null);
});

function fakeHost() {
  const timers = new Map(), log = [];
  let nextId = 1, now = 0;
  const host = {
    log, ghostsLive: new Set(), slowed: 0, panned: [],
    overlay: { open: () => log.push("open"), caption: (c) => log.push(c ? "caption" : "caption-off"), card: (s) => log.push(s ? "card" : "card-off"), summary: (c) => log.push(c ? "summary" : "summary-off"), close: (ms) => log.push(`close:${ms}`) },
    pan: (to) => host.panned.push(to),
    ghosts: { add: (g) => { const h = { ...g }; host.ghostsLive.add(h); return h; }, remove: (h) => host.ghostsLive.delete(h) },
    replay: () => { log.push("replay"); return Promise.resolve(); },
    slow: () => { host.slowed++; return () => { host.slowed--; }; },
    schedule: (fn, ms) => { const id = nextId++; timers.set(id, { fn, at: now + ms }); return id; },
    cancel: (id) => timers.delete(id),
    run(until) {
      for (;;) {
        const due = [...timers.entries()].filter(([, t]) => t.at <= until).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        timers.delete(due[0]); now = due[1].at; due[1].fn();
      }
      now = until;
    },
    pending: () => timers.size,
  };
  return host;
}
const ghostPlan = () => planReel({ moments: [moment(1), moment(2)], viewer: { sceneId: "s1", gm: true, quality: "full" },
  tokens: live({ h1: { center: { x: 150, y: 150 }, w: 100, h: 100 }, h2: { center: { x: 250, y: 150 }, w: 100, h: 100 } }), view, screen, maxZoom: 3 });

test("the player runs the timeline and ends with the view put back", async () => {
  const host = fakeHost(), player = createReelPlayer(host), plan = ghostPlan();
  const done = player.play(plan);
  assert.equal(player.playing, true);
  host.run(plan.steps[0].slow.at + 10);
  assert.equal(host.slowed, 1, "slowed at the impact");
  assert.equal(host.ghostsLive.size, 1, "the gone target's ghost");
  host.run(plan.steps[0].slow.at + plan.steps[0].slow.ms + 10);
  assert.equal(host.slowed, 0, "back to speed");
  host.run(plan.end + 10);
  assert.equal(await done, "done");
  assert.equal(player.playing, false);
  assert.deepEqual({ x: host.panned.at(-1).x, y: host.panned.at(-1).y, scale: host.panned.at(-1).scale }, view);
  assert.equal(host.ghostsLive.size, 0);
  assert.ok(host.log.includes("summary") && host.log.filter((l) => l === "replay").length === 2);
  assert.equal(host.pending(), 0);
});

test("skip mid-reel: at once the view, the effects' speed and the ghosts are put back and the overlay closes", async () => {
  const host = fakeHost(), player = createReelPlayer(host), plan = ghostPlan();
  const done = player.play(plan);
  host.run(plan.steps[0].slow.at + 10);
  assert.equal(host.slowed, 1);
  player.skip();
  assert.equal(await done, "skipped");
  assert.equal(host.slowed, 0);
  assert.equal(host.ghostsLive.size, 0);
  assert.equal(host.pending(), 0, "nothing left scheduled");
  const back = host.panned.at(-1);
  assert.deepEqual({ x: back.x, y: back.y, scale: back.scale }, view);
  assert.ok(back.duration <= 50);
  assert.equal(host.log.at(-1), "close:0");
  // A second reel can start; one while one plays cannot.
  const again = player.play(plan);
  assert.equal(await player.play(plan), false);
  player.clear();
  assert.equal(await again, "skipped");
});

test("a replay that fails shows the moment's art card instead", async () => {
  const host = fakeHost();
  host.replay = () => Promise.reject(new Error("no recipe"));
  const player = createReelPlayer(host), plan = ghostPlan();
  void player.play(plan);
  host.run(plan.steps[0].replayAt + 1);
  await new Promise((r) => setTimeout(r, 0));
  assert.ok(host.log.includes("card"));
  player.skip();
});
