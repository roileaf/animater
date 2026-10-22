import test from "node:test";
import assert from "node:assert/strict";
import { AnimaterRuntime } from "../../../scripts/engines/playback/runtime.mjs";
import { starterRecipes } from "../../../scripts/core/presets.mjs";
import { validateRecipe, TELEPORT_GONE_MS } from "../../../scripts/core/model.mjs";
import { teleportMoment, withTeleportStage, teleportLink, playTeleport, holdHidden, VANISH_GRACE_MS } from "../../../scripts/engines/motion/teleport.mjs";
import { studioTracks, studioAction } from "../../../scripts/ui/studio.mjs";
import { Workspace } from "../../../scripts/ui/workspace.mjs";

const source = { id: "src", center: { x: 50, y: 50 } };
const ally = { id: "ally", center: { x: 450, y: 50 } };
const other = { id: "other", center: { x: 850, y: 50 } };
const cast = { stageId: "cast", kind: "cast", assets: ["jb2a.impact.001.orange"], delay: 0, duration: 600 };
// Friendfetch: a ray from the caster to the ally, which arrives 600 ms into its 1 s flight.
const ray = { stageId: "ray", kind: "projectile", assets: ["jb2a.fire_bolt.orange"], afterStage: "cast", timingAnchor: "end", duration: 1000, contact: 600 };
const friendfetch = (stages = [cast, ray], extra = {}) => validateRecipe({ id: "ff", name: "Friendfetch", trigger: "manual", match: "Friendfetch", stages, ...extra });
const mistyStep = (stages) => validateRecipe({ id: "ms", name: "Misty Step", trigger: "manual", match: "Misty Step", stages });

function fixture({ spot = null } = {}) {
  const calls = [];
  const effect = new Proxy({}, { get: (_, key) => (...args) => { calls.push([key, ...args]); return effect; } });
  const keys = ["jb2a.impact.001.orange", "jb2a.fire_bolt.orange"];
  const host = {
    database: { entryExists: () => true, getPathsUnder: () => keys, getAllFileEntries: (k) => [`${k}.webm`] },
    enabled: () => true, recipes: () => starterRecipes(), ready: () => true, canPlay: () => true, userId: () => "u",
    sequence: () => ({ effect: () => effect, sound: () => effect, play: async () => calls.push(["play"]) }),
    endEffects: async () => {}, endSounds: async () => {},
    motion: async (stage) => calls.push(["motion", stage.motion]),
    pickTeleport: async () => { calls.push(["pick"]); return spot; },
    teleport: async (picked, timing) => calls.push(["teleport", picked, timing]),
    previewTeleport: async (mover, recipe, context, timing) => calls.push(["previewTeleport", mover, timing]),
  };
  const runtime = new AnimaterRuntime(host);
  runtime.refreshCatalog();
  runtime.wait = async (ms) => { calls.push(["wait", ms]); return true; };
  return { runtime, host, calls };
}
// The wait of the delay group the teleport played in, and the timing it was handed.
const teleportCall = (calls, name = "teleport") => {
  const at = calls.findIndex((c) => c[0] === name);
  return at < 0 ? null : { call: calls[at], waitedFirst: calls.slice(0, at).filter((c) => c[0] === "wait").map((c) => c[1]) };
};

test("a flight to the mover places the teleport at its arrival (Friendfetch)", () => {
  const plan = [
    { kind: "cast", delay: 0, duration: 600 },
    { kind: "projectile", delay: 600, duration: 1000, contact: 600, endpoint: other },
    { kind: "projectile", delay: 650, duration: 1000, contact: 700, endpoint: ally },
  ];
  assert.equal(teleportMoment(plan, { who: "target", mover: ally }), 1350, "the flight to the ally, not the other target");
  assert.equal(teleportMoment(plan, { who: "target", mover: { document: { id: "ally" } } }), 1350, "matched by token id");
  // Without a measured contact a flight arrives at 55% of it (arrivalOf).
  assert.equal(teleportMoment([{ kind: "travel", delay: 200, duration: 1000, endpoint: ally }], { who: "target", mover: ally }), 750);
  const out = withTeleportStage(plan, { who: "target", mover: ally });
  assert.deepEqual(out.at(-1), { kind: "teleport", stageId: "teleport", label: "Teleport", synthesized: true, assets: [], delay: 1350, duration: TELEPORT_GONE_MS });
  assert.equal(TELEPORT_GONE_MS, 500);
});

test("a self teleport lands on the caster's gesture, else 450 ms (Misty Step)", () => {
  const gesture = { kind: "motion", subject: "source", motion: "pulse", delay: 100, duration: 1000 };
  assert.equal(teleportMoment([{ kind: "cast", delay: 0, duration: 800 }, gesture], { who: "source", mover: source }), 550);
  assert.equal(teleportMoment([{ kind: "cast", delay: 0, duration: 800 }], { who: "source", mover: source }), 450);
  // A target teleport with no flight to it falls back the same way.
  assert.equal(teleportMoment([{ kind: "cast", delay: 0, duration: 800 }], { who: "target", mover: ally }), 450);
});

test("an authored teleport stage is kept as it is", () => {
  const own = { kind: "teleport", stageId: "t", delay: 900, duration: 0 };
  const plan = [{ kind: "projectile", delay: 0, duration: 1000, endpoint: ally }, own];
  assert.equal(withTeleportStage(plan, { who: "target", mover: ally }), plan);
});

test("validation keeps a teleport stage: no art, a length of 0 allowed, 500 ms by default", () => {
  const r = friendfetch([cast, { stageId: "t", kind: "teleport", delay: 800, duration: 0 }, { stageId: "u", kind: "teleport", afterStage: "cast", timingAnchor: "start", startOffset: 200 }]);
  const [, gone, fallback] = r.stages;
  assert.deepEqual([gone.kind, gone.delay, gone.duration, gone.assets], ["teleport", 800, 0, []]);
  assert.deepEqual([fallback.duration, fallback.afterStage, fallback.startOffset, fallback.repeats], [500, "cast", 200, 1]);
});

test("an old Friendfetch recipe (no teleport stage) teleports as the ray reaches the ally", async () => {
  const spot = { mover: ally, x: 0, y: 100 };
  const { runtime, calls } = fixture({ spot });
  await runtime.play(friendfetch(), { source, targets: [ally] });
  const played = teleportCall(calls);
  assert.ok(played, "it teleports");
  assert.equal(played.call[1], spot, "the picked spot, picked before anything plays");
  assert.deepEqual(played.call[2], { outAt: 0, goneMs: 500 });
  assert.equal(played.waitedFirst.at(-1), 1200, "after the ray's arrival: cast 600 + contact 600");
  assert.equal(calls[0][0], "pick");
});

test("an old Misty Step recipe teleports on the gesture, else at 450 ms", async () => {
  const spot = { mover: source, x: 300, y: 0 };
  let { runtime, calls } = fixture({ spot });
  await runtime.play(mistyStep([cast, { stageId: "g", kind: "motion", motion: "pulse", subject: "source", delay: 200, duration: 1000 }]), { source, targets: [] });
  assert.equal(teleportCall(calls).waitedFirst.at(-1), 650);
  ({ runtime, calls } = fixture({ spot }));
  await runtime.play(mistyStep([cast]), { source, targets: [] });
  assert.equal(teleportCall(calls).waitedFirst.at(-1), 450, "as before");
});

test("an authored teleport stage's start and length drive the jump", async () => {
  const spot = { mover: ally, x: 0, y: 100 };
  const { runtime, calls } = fixture({ spot });
  await runtime.play(friendfetch([cast, ray, { stageId: "t", kind: "teleport", afterStage: "ray", timingAnchor: "start", startOffset: 300, duration: 250 }]), { source, targets: [ally] });
  const played = teleportCall(calls);
  assert.deepEqual(played.call[2], { outAt: 0, goneMs: 250 });
  assert.equal(played.waitedFirst.at(-1), 900, "ray starts at 600, +300");
  assert.equal(calls.filter((c) => c[0] === "teleport").length, 1);
});

test("a cancelled pick or a recipe that does not teleport plays without a jump", async () => {
  let { runtime, calls } = fixture({ spot: null });
  await runtime.play(friendfetch([cast, ray, { stageId: "t", kind: "teleport", delay: 100 }]), { source, targets: [ally] });
  assert.equal(teleportCall(calls), null);
  assert.ok(calls.some((c) => c[0] === "play"), "the animation still plays");
  ({ runtime, calls } = fixture({ spot: { mover: ally, x: 0, y: 0 } }));
  runtime.host.pickTeleport = async () => null;
  await runtime.play(validateRecipe({ id: "x", name: "X", trigger: "manual", match: "Fireball", stages: [cast, { stageId: "t", kind: "teleport", delay: 100 }] }), { source, targets: [] });
  assert.equal(teleportCall(calls), null);
});

test("a preview vanishes in place: no pick, no real teleport", async () => {
  const { runtime, calls } = fixture({ spot: { mover: ally, x: 0, y: 0 } });
  await runtime.play(friendfetch(), { source, targets: [ally] }, { preview: true });
  assert.ok(!calls.some((c) => c[0] === "pick" || c[0] === "teleport"));
  const shown = teleportCall(calls, "previewTeleport");
  assert.equal(shown.call[1], ally, "the one who would move");
  assert.deepEqual(shown.call[2], { outAt: 0, goneMs: 500 });
  assert.equal(shown.waitedFirst.includes(1200), true);
});

test("playTeleport: out effect and vanish at outAt, the move and in effect after goneMs", async () => {
  const calls = [], mover = { id: "tok", document: { id: "tok" }, w: 100, h: 100, center: { x: 50, y: 50 } };
  const host = {
    wait: async (ms) => calls.push(["wait", ms]),
    effect: (asset, point, size, tint, data = null) => calls.push(["effect", asset, data && Object.keys(data)]),
    move: async (token, x, y) => calls.push(["move", x, y]),
  };
  await playTeleport({ mover, x: 400, y: 0, visuals: { out: "o", in: "i", scale: 1, tint: "" } }, host, { outAt: 300, goneMs: 250 });
  assert.deepEqual(calls, [["wait", 300], ["effect", "o", ["animaterVanish"]], ["wait", 250], ["move", 400, 0], ["effect", "i", ["animaterTrail"]]]);
  calls.length = 0;
  await playTeleport({ mover, x: 400, y: 0, visuals: { out: "o", in: "i", scale: 1, tint: "" } }, host, { outAt: 0, goneMs: 0 });
  assert.deepEqual(calls, [["effect", "o", null], ["move", 400, 0], ["effect", "i", ["animaterTrail"]]], "gone for no time: no waits, no vanish");
});

test("a preview's move is the host's: the document never moves", async () => {
  const doc = { id: "tok", x: 0, y: 0, update: () => assert.fail("no document update") };
  const mover = { id: "tok", document: doc, w: 100, h: 100, center: { x: 50, y: 50 } };
  const effects = [];
  await playTeleport({ mover, x: doc.x, y: doc.y, visuals: { out: "o", in: "i", scale: 1, tint: "" } },
    { wait: async () => {}, effect: (asset, point) => effects.push([asset, point]), move: async () => {} }, { outAt: 0, goneMs: 500 });
  assert.deepEqual(effects, [["o", { x: 50, y: 50 }], ["i", { x: 50, y: 50 }]], "out and in at the token's own spot");
  assert.deepEqual([doc.x, doc.y], [0, 0]);
});

test("holdHidden keeps the token out of sight until it has moved, then gives it back", () => {
  let clock = 0;
  const frames = [], flags = [];
  const token = { mesh: { alpha: 1 }, document: { x: 0, y: 0 }, renderFlags: { set: (f) => flags.push(f) } };
  const opts = { now: () => clock, frame: (cb) => { frames.push(cb); return cb; }, cancel: () => {} };
  const tick = (ms) => { clock += ms; frames.shift()?.(); };
  holdHidden(token, 500, opts);
  tick(200);
  assert.equal(token.mesh.alpha, 0, "gone after its quick fade");
  tick(100);
  assert.equal(token.mesh.alpha, 0, "a refresh showing it again is undone every frame");
  token.document.x = 400;
  tick(16);
  assert.equal(token.mesh.alpha, 1, "back once it has moved");
  assert.deepEqual(flags, [{ refreshState: true }]);
  assert.equal(frames.length, 0);
  // Never moved (a preview): back after its time and a little grace.
  clock = 0;
  const still = { mesh: { alpha: 1 }, document: { x: 0, y: 0 } };
  holdHidden(still, 500, opts);
  tick(500);
  assert.equal(still.mesh.alpha, 0);
  tick(VANISH_GRACE_MS);
  assert.equal(still.mesh.alpha, 1);
  assert.equal(typeof holdHidden(null, 500, opts), "function", "no token: nothing to hide");
});

test("the Studio shows a Teleport track only on recipes that teleport, and adds one stage there", async () => {
  const ids = (r) => studioTracks(r).tracks.map((t) => t.id);
  assert.ok(ids(friendfetch()).includes("teleport"));
  assert.ok(!ids(validateRecipe({ id: "x", name: "X", trigger: "manual", match: "Fireball", stages: [cast] })).includes("teleport"));
  assert.ok(!ids(friendfetch([cast], { teleport: "none" })).includes("teleport"), "turned off");
  const saved = friendfetch();
  const w = Object.create(Workspace.prototype);
  Object.assign(w, { drafts: new Map(), dirty: new Set(), selected: "ff", stageIndex: 0, busy: false, studioTime: 0, root: { querySelector: () => null } });
  w.host = { recipes: () => [saved] };
  w.recipe = () => w.drafts.get("ff") ?? saved;
  w.stopEditorPreview = () => {}; w.render = () => {}; w.stageLabel = (s) => s.label || s.kind;
  await studioAction(w, "studio-add", { dataset: { stTrack: "teleport" } });
  const added = w.recipe().stages.at(-1);
  assert.deepEqual([added.kind, added.duration, added.afterStage, added.timingAnchor, added.startOffset], ["teleport", 500, "ray", "arrival", 0], "on the ray's arrival");
  assert.deepEqual(validateRecipe(w.recipe()).stages.at(-1).kind, "teleport");
  await studioAction(w, "studio-add", { dataset: { stTrack: "teleport" } });
  assert.equal(w.recipe().stages.filter((s) => s.kind === "teleport").length, 1, "one per recipe");
  assert.deepEqual(teleportLink([cast], "source"), { afterStage: "", delay: 450 });
  assert.deepEqual(teleportLink([cast, { stageId: "g", kind: "motion", duration: 1000 }], "source"), { afterStage: "g", timingAnchor: "start", startOffset: 450, delay: 0 });
});

test("the inspector shows a teleport stage's start and how long it is gone, nothing else", () => {
  const r = friendfetch([cast, ray, { stageId: "t", kind: "teleport", delay: 900, duration: 0 }]);
  const w = Object.create(Workspace.prototype);
  w.host = { catalog: () => [], soundCatalog: () => null };
  w.stageLabel = Workspace.prototype.stageLabel;
  const html = w.stageEssentialsHTML(r, r.stages[2], 2, null, false, r.stages[2]) + w.stageTypeHTML(r, r.stages[2], 2, false, r.stages[2]);
  assert.match(html, /<label>Gone for<span class="an-unit"><input type="number" data-field="duration" data-index="2" data-scale="1000" min="0"/);
  assert.doesNotMatch(html, /Fade in|data-action="browse"|data-field="scale"/);
  assert.match(html, /vanishes as this stage starts/);
  for (const tab of ["look", "motion", "place", "time"]) assert.equal(w.inspectorTabHTML(tab, r, r.stages[2], 2, false), "", tab);
});

test("the Studio monitor hides the mover while its teleport stage plays", async () => {
  const { RecipePreview } = await import("../../../scripts/engines/preview/recipe-preview.mjs");
  const p = Object.create(RecipePreview.prototype);
  p.recipe = friendfetch([cast, { stageId: "t", kind: "teleport", delay: 0, duration: 500 }]);
  const frame = (state) => ({ time: 100, stages: [{ state: "done" }, { state }] });
  assert.equal(p.teleportGone("targets", 0, frame("playing")), true, "Friendfetch moves the ally");
  assert.equal(p.teleportGone("source", 0, frame("playing")), false);
  assert.equal(p.teleportGone("targets", 1, frame("playing")), false, "only the first target");
  assert.equal(p.teleportGone("targets", 0, frame("done")), false, "back after its length");
  p.muted = new Set([1]);
  assert.equal(p.teleportGone("targets", 0, frame("playing")), false, "a muted teleport track hides nothing");
});

test("the Studio never doubles a teleport stage by duplicating or pasting it", async () => {
  const saved = friendfetch([cast, ray, { stageId: "t", kind: "teleport", delay: 900 }]);
  const w = Object.create(Workspace.prototype);
  Object.assign(w, { drafts: new Map(), dirty: new Set(), selected: "ff", stageIndex: 2, busy: false, studioTime: 0, root: { querySelector: () => null } });
  w.host = { recipes: () => [saved] };
  w.recipe = () => w.drafts.get("ff") ?? saved;
  w.stopEditorPreview = () => {}; w.render = () => {}; w.stageLabel = (s) => s.label || s.kind;
  await studioAction(w, "studio-dup-stage", { dataset: { index: "2" } });
  await studioAction(w, "studio-copy-stage", { dataset: { index: "2" } });
  await studioAction(w, "studio-paste-stage", { dataset: { index: "0" } });
  assert.equal(w.recipe().stages.filter((s) => s.kind === "teleport").length, 1);
});

// Fix round 1: a picked spot is a game move, never dropped with the animation.
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
test("a picked teleport still moves the token when the animation fails before its stage", async () => {
  const spot = { mover: ally, x: 0, y: 100, visuals: { out: "o", in: "i", scale: 1, tint: "" } };
  const { runtime, host, calls } = fixture({ spot });
  host.motion = async () => { throw Error("motion channel gone"); };
  // The ray is still in flight (real time) when the gesture fails.
  runtime.wait = (ms) => new Promise((resolve) => setTimeout(() => resolve(true), ms >= 1200 ? 20 : 0));
  const recipe = friendfetch([cast, ray, { stageId: "g", kind: "motion", motion: "pulse", subject: "source", delay: 0, duration: 500 }]);
  await assert.rejects(runtime.play(recipe, { source, targets: [ally] }), /motion channel gone/);
  await new Promise((resolve) => setTimeout(resolve, 40));
  const moves = calls.filter((c) => c[0] === "teleport");
  assert.equal(moves.length, 1);
  assert.equal(moves[0][1].x, 0);
  assert.deepEqual([moves[0][1].visuals.out, moves[0][1].visuals.in], [null, null], "a plain move, no effects");
  assert.deepEqual(moves[0][2], { outAt: 0, goneMs: 0 });
});

test("Stop before the teleport stage still moves the token, once", async () => {
  const spot = { mover: ally, x: 0, y: 100, visuals: { out: "o", in: "i", scale: 1, tint: "" } };
  const { runtime, calls } = fixture({ spot });
  runtime.wait = async (ms) => { calls.push(["wait", ms]); return ms < 1200; }; // stopped while the ray flies
  assert.equal(await runtime.play(friendfetch(), { source, targets: [ally] }), null);
  await settle();
  const moves = calls.filter((c) => c[0] === "teleport");
  assert.equal(moves.length, 1);
  assert.deepEqual(moves[0][2], { outAt: 0, goneMs: 0 });
  // Played normally: the stage's own jump, and no second move after.
  const ok = fixture({ spot });
  await ok.runtime.play(friendfetch(), { source, targets: [ally] });
  await settle();
  assert.equal(ok.calls.filter((c) => c[0] === "teleport").length, 1);
  assert.deepEqual(ok.calls.find((c) => c[0] === "teleport")[2], { outAt: 0, goneMs: 500 });
});

test("an authored stage linked to a flight's arrival follows the flight as planned (a wall stop)", () => {
  const own = { kind: "teleport", stageId: "t", afterStage: "ray", timingAnchor: "arrival", startOffset: 100, delay: 1300, duration: 400 };
  const plan = [{ kind: "projectile", stageId: "ray", delay: 600, duration: 1000, contact: 250, endpoint: ally }, own];
  const out = withTeleportStage(plan, { who: "target", mover: ally });
  assert.equal(out.find((s) => s.kind === "teleport").delay, 950, "600 + the wall contact 250 + 100");
  assert.equal(out.find((s) => s.kind === "teleport").duration, 400);
  const r = friendfetch([cast, ray, { stageId: "t", kind: "teleport", afterStage: "ray", timingAnchor: "arrival", startOffset: 0 }]);
  assert.deepEqual([r.stages[2].afterStage, r.stages[2].timingAnchor], ["ray", "arrival"], "validation keeps the arrival link");
});

test("with no departure effect the token moves as the stage starts", async () => {
  const calls = [], mover = { id: "tok", document: { id: "tok", x: 0, y: 0 }, w: 100, h: 100, center: { x: 50, y: 50 } };
  await playTeleport({ mover, x: 400, y: 0, visuals: { out: null, in: "i", scale: 1, tint: "" } }, {
    wait: async (ms) => calls.push(["wait", ms]), effect: (asset) => calls.push(["effect", asset]), move: async () => calls.push(["move"]),
  }, { outAt: 0, goneMs: 300 });
  assert.deepEqual(calls, [["move"], ["wait", 300], ["effect", "i"]]);
});

test("the vanish names the spot it leaves and the preview's short grace", async () => {
  const tags = [], mover = { id: "tok", document: { id: "tok", x: 0, y: 100 }, w: 100, h: 100, center: { x: 50, y: 150 } };
  await playTeleport({ mover, x: 400, y: 0, visuals: { out: "o", in: null, scale: 1, tint: "" } },
    { wait: async () => {}, move: async () => {}, vanishGrace: 0, effect: (a, p, s, t, data) => tags.push(data) }, { outAt: 0, goneMs: 500 });
  assert.deepEqual(tags[0].animaterVanish, { tokenId: "tok", ms: 500, from: { x: 0, y: 100 }, grace: 0 });
});

test("a vanish that arrives after the move never hides the token at its destination", () => {
  let clock = 0;
  const frames = [];
  const opts = { now: () => clock, frame: (cb) => { frames.push(cb); return cb; }, cancel: () => {} };
  const landed = { mesh: { alpha: 1 }, document: { x: 400, y: 0 } };
  holdHidden(landed, 500, { ...opts, origin: { x: 0, y: 0 } });
  assert.equal(landed.mesh.alpha, 1);
  assert.equal(frames.length, 0);
  // A GM-moved ally: hidden well past its time until the move lands, then back at once.
  const ally = { mesh: { alpha: 1 }, document: { x: 0, y: 0 } };
  holdHidden(ally, 500, { ...opts, origin: { x: 0, y: 0 } });
  for (let i = 0; i < 10; i++) { clock += 100; frames.shift()?.(); }
  assert.equal(ally.mesh.alpha, 0, "1 s in, still waiting for its move");
  ally.document.x = 400; clock += 16; frames.shift()?.();
  assert.equal(ally.mesh.alpha, 1);
  // A preview's grace of 0: back as its arrival plays.
  clock = 0;
  const shown = { mesh: { alpha: 1 }, document: { x: 0, y: 0 } };
  holdHidden(shown, 500, { ...opts, grace: 0 });
  clock += 499; frames.shift()?.();
  assert.equal(shown.mesh.alpha, 0);
  clock += 1; frames.shift()?.();
  assert.equal(shown.mesh.alpha, 1);
  assert.equal(VANISH_GRACE_MS, 1500);
});

// Fix round 2: the fallback move reads only the token's document.
test("a stopped play lands through host.place, even when the token's canvas getters throw", async () => {
  const gone = { id: "ally", document: { id: "ally" } };
  for (const key of ["w", "h", "center"]) Object.defineProperty(gone, key, { get: () => { throw Error("destroyed"); } });
  const spot = { mover: gone, x: 0, y: 100, visuals: { out: "o", in: "i", scale: 1, tint: "" } };
  const { runtime, host, calls } = fixture({ spot });
  host.place = async (picked) => calls.push(["place", picked.mover.document.id, picked.x, picked.y]);
  runtime.wait = async (ms) => ms < 1200;
  await runtime.play(friendfetch(), { source, targets: [ally] });
  await settle();
  assert.deepEqual(calls.filter((c) => c[0] === "place" || c[0] === "teleport"), [["place", "ally", 0, 100]]);
});

test("a throw between the pick and playback still lands the picked move", async () => {
  const spot = { mover: ally, x: 0, y: 100 };
  const { runtime, host, calls } = fixture({ spot });
  host.place = async () => calls.push(["place"]);
  host.userId = () => { throw Error("no user"); };
  await assert.rejects(runtime.play(friendfetch(), { source, targets: [ally] }), /no user/);
  await settle();
  assert.equal(calls.filter((c) => c[0] === "place").length, 1);
});

test("a teleport that throws mid-stage falls back to the plain move once", async () => {
  const spot = { mover: ally, x: 0, y: 100 };
  const { runtime, host, calls } = fixture({ spot });
  host.place = async () => calls.push(["place"]);
  host.teleport = async () => { throw Error("token torn down"); };
  await runtime.play(friendfetch(), { source, targets: [ally] });
  await settle();
  assert.equal(calls.filter((c) => c[0] === "place").length, 1);
});

test("a spot where the token already stands waits for no move", async () => {
  const tags = [], mover = { id: "tok", document: { id: "tok", x: 0, y: 100 }, w: 100, h: 100, center: { x: 50, y: 150 } };
  await playTeleport({ mover, x: 0, y: 100, visuals: { out: "o", in: null, scale: 1, tint: "" } },
    { wait: async () => {}, move: async () => {}, effect: (a, p, s, t, data) => tags.push(data) }, { outAt: 0, goneMs: 500 });
  assert.equal(tags[0].animaterVanish.grace, 0);
});
