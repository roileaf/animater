import test from "node:test";
import assert from "node:assert/strict";
import { hpLeft, woundTier, woundStage, STAGE_LINES, woundedPreset, woundEligible, woundActions, tokenMoving, WoundedLooks } from "../../../scripts/engines/playback/wounded-looks.mjs";

const BASE = { name: "Wounded", library: "tokenshade", params: [
  { filterType: "stain", color: 0x5a0606, seed: 0.33, count: 1, size: 0.3, edge: 0.5, wet: 0.4, spatter: 0.6 },
  { filterType: "adjustment", saturation: 0.85, brightness: 0.93 },
] };

test("HP left counts down, or what is unmarked on a marked track (Daggerheart)", () => {
  assert.equal(hpLeft({ value: 5, max: 20, marked: false }), 0.25);
  assert.equal(hpLeft({ value: 3, max: 4, marked: true }), 0.25);
  assert.equal(hpLeft({ value: 5, max: 0, marked: false }), null);
  assert.equal(hpLeft(null), null);
});

test("tiers: hurt at 50% or less, badly hurt at 25% or less, with a small margin before healing clears them", () => {
  const s = (value, max = 100) => ({ value, max, down: value <= 0, marked: false });
  assert.equal(woundTier(s(80)), 0);
  assert.equal(woundTier(s(50)), 1);
  assert.equal(woundTier(s(25)), 2);
  assert.equal(woundTier(s(0)), 0, "down: the defeated look takes over");
  assert.equal(woundTier(s(51), 1), 1, "just above the line keeps the look");
  assert.equal(woundTier(s(54), 1), 0, "healed clear of the line removes it");
  assert.equal(woundTier(s(27), 2), 2);
  assert.equal(woundTier(s(30), 2), 1);
  assert.equal(woundTier(s(51), 0), 0, "a fresh token at 51% is not hurt");
  assert.equal(woundTier(null, 2), 0);
});

test("blood builds by stages as HP falls and goes back as it heals, with a margin", () => {
  const s = (value, max = 100) => ({ value, max, down: value <= 0, marked: false });
  assert.equal(woundStage(s(100)), 0);
  assert.equal(woundStage(s(81)), 0);
  for (let i = 0; i < STAGE_LINES.length; i++) assert.equal(woundStage(s(STAGE_LINES[i] * 100)), i + 1);
  assert.equal(woundStage(s(5)), STAGE_LINES.length);
  assert.equal(woundStage(s(0)), 0, "down: the defeated look takes over");
  assert.equal(woundStage(s(61), 2), 2, "just above the line keeps the stage");
  assert.equal(woundStage(s(65), 2), 1, "healed clear of the line takes it back one");
  assert.equal(woundStage(s(90), 4), 0, "healed well up takes it all back");
  assert.equal(woundStage(null, 3), 0);
});

test("the Wounded preset grows by stage, in the creature's blood; the shared preset is untouched", () => {
  const before = structuredClone(BASE);
  const looks = [1, 2, 3, 4, 5].map((stage) => woundedPreset(stage, BASE));
  assert.deepEqual(BASE, before);
  const adj = (p) => p.params.find((x) => x.filterType === "adjustment"), stain = (p) => p.params.find((x) => x.filterType === "stain");
  for (let i = 1; i < looks.length; i++) {
    assert.ok(stain(looks[i]).size > stain(looks[i - 1]).size, "more blood each stage");
    assert.ok(stain(looks[i]).count >= stain(looks[i - 1]).count);
    assert.ok(adj(looks[i]).saturation < adj(looks[i - 1]).saturation, "the colour goes each stage");
    assert.notEqual(looks[i].name, looks[i - 1].name);
  }
  assert.ok(stain(looks[4]).count <= 3, "the stain draws three at most");
  assert.equal(stain(looks[0]).color, BASE.params[0].color, "no blood given: the preset's own");
  assert.equal(stain(woundedPreset(3, BASE, { color: 0x204080 })).color, 0x183060, "its blood, soaked in and darker");
  assert.equal(woundedPreset(0, BASE), null);
  assert.equal(woundedPreset(1, null), null);
});

test("bloodless creatures get no stain, and the amount scales the blood or turns the look off", () => {
  const stain = (p) => p.params.find((x) => x.filterType === "stain");
  const construct = woundedPreset(3, BASE, { bleeds: false });
  assert.equal(stain(construct), undefined);
  assert.ok(construct.params.some((x) => x.filterType === "adjustment"), "its colour still lowers");
  assert.ok(stain(woundedPreset(3, BASE, { amount: 2 })).size > stain(woundedPreset(3, BASE)).size);
  assert.ok(stain(woundedPreset(3, BASE, { amount: 0.5 })).size < stain(woundedPreset(3, BASE)).size);
  assert.equal(woundedPreset(3, BASE, { amount: 0 }), null);
});

test("a change of stage or blood swaps the look, and a look with nothing changed stays", () => {
  const token = { id: "t", visible: true, mesh: {}, document: { id: "t" }, actor: { type: "npc" } }, applied = [];
  let hp = { value: 70, max: 100, down: false }, color = 0xaa0000;
  const looks = new WoundedLooks({ body: { add() {}, remove() {} }, fx: () => ({ apply: (t, preset) => { applied.push(preset); return () => {}; } }), preset: () => BASE, tokens: () => [token], hp: () => hp, blood: () => ({ color, bleeds: true }), motionAllowed: () => false });
  looks.sync();
  assert.equal(applied.length, 1);
  looks.sync();
  assert.equal(applied.length, 1, "nothing changed");
  hp = { value: 50, max: 100, down: false };
  looks.sync();
  assert.equal(applied.length, 2, "worse");
  hp = { value: 90, max: 100, down: false };
  looks.sync();
  assert.equal(looks.shown.size, 0, "healed: gone");
  hp = { value: 50, max: 100, down: false };
  looks.sync();
  color = 0x00aa00;
  looks.sync();
  assert.equal(applied.at(-1).params[0].color, 0x008000, "a new blood colour redraws it");
});

test("who gets a look: all creatures, player characters only, or nobody", () => {
  const pc = { type: "character", hasPlayerOwner: true }, npc = { type: "npc", hasPlayerOwner: false }, owned = { type: "npc", hasPlayerOwner: true };
  assert.equal(woundEligible(npc, "all"), true);
  assert.equal(woundEligible(npc, "pcs"), false);
  assert.equal(woundEligible(pc, "pcs"), true);
  assert.equal(woundEligible(owned, "pcs"), true, "a player-owned creature counts");
  assert.equal(woundEligible({ type: "character", hasPlayerOwner: false }, "pcs"), true);
  assert.equal(woundEligible(pc, "off"), false);
  assert.equal(woundEligible(null, "all"), false);
  assert.equal(woundEligible({ type: "loot" }, "all"), false, "not a creature");
});

test("the diff only touches what changed", () => {
  const t = {};
  const shown = new Map([["a", { token: t, tier: 1, fx: true, kind: null }], ["b", { token: t, tier: 2, fx: true, kind: "hunch" }], ["c", { token: t, tier: 1, fx: true, kind: null }]]);
  const want = new Map([["a", { token: t, tier: 1, fx: true, kind: null }], ["b", { token: t, tier: 2, fx: true, kind: "limp" }], ["d", { token: t, tier: 2, fx: true, kind: "hunch" }]]);
  const ops = woundActions(shown, want).map((a) => `${a.op}:${a.id}${a.kind ? ":" + a.kind : ""}${a.tier ? ":" + a.tier : ""}`);
  assert.deepEqual(ops.sort(), ["body-off:b", "body-on:b:limp", "body-on:d:hunch", "fx-off:c", "fx-on:d:2"].sort());
});

function rig({ hp = {}, moving = new Set(), defeated = new Set(), mode = "all", fxOk = true, motionOk = true } = {}) {
  const calls = [], removers = [];
  const mk = (id, extra = {}) => ({ id, visible: true, mesh: {}, document: { id, hidden: false }, actor: { id, type: "npc", hasPlayerOwner: false }, ...extra });
  const tokens = [];
  let timer = null;
  const body = { add: (name, token, kind) => calls.push(["body+", name, kind]), remove: (name) => calls.push(["body-", name]) };
  const fx = { apply: (token, preset, opts) => { calls.push(["fx+", token.id, preset.name, opts.key]); const r = () => calls.push(["fx-", token.id]); removers.push(r); return r; } };
  const looks = new WoundedLooks({ body, fx: () => fx, preset: () => BASE, tokens: () => tokens, enabled: () => true, mode: () => mode,
    fxAllowed: () => fxOk, motionAllowed: () => motionOk,
    hp: (actor) => hp[actor.id] ?? null, defeated: (token) => defeated.has(token.id), moving: (token) => moving.has(token.id),
    schedule: (fn) => { timer = fn; return 1; }, cancel: () => { timer = null; } });
  return { looks, calls, tokens, mk, tick: () => { const f = timer; timer = null; f?.(); }, pending: () => timer !== null, set: (o) => { if ("mode" in o) mode = o.mode; if ("fxOk" in o) fxOk = o.fxOk; } };
}
const hp = (value, max = 100) => ({ value, max, down: value <= 0, marked: false });

test("a hurt token gets its stage's look under its own key; badly hurt adds a hunch; healing removes both", () => {
  const h = { a: hp(40) };
  const r = rig({ hp: h });
  r.tokens.push(r.mk("a"));
  r.looks.sync();
  assert.deepEqual(r.calls, [["fx+", "a", "animater-wounded-3", "animater-wound:a"]]);
  r.calls.length = 0;
  h.a = hp(20); r.looks.sync();
  assert.deepEqual(r.calls, [["fx-", "a"], ["fx+", "a", "animater-wounded-4", "animater-wound:a"], ["body+", "animater-wound:a", "hunch"]]);
  r.calls.length = 0;
  r.looks.sync();
  assert.deepEqual(r.calls, [], "nothing changed: nothing done");
  h.a = hp(90); r.looks.sync();
  assert.deepEqual(r.calls, [["fx-", "a"], ["body-", "animater-wound:a"]]);
});

test("hidden, invisible, defeated and down tokens show nothing; pcs mode skips NPCs; off clears everything", () => {
  const r = rig({ hp: { a: hp(10), b: hp(10), c: hp(10), d: hp(0), e: hp(10) }, defeated: new Set(["c"]) });
  r.tokens.push(r.mk("a", { document: { id: "a", hidden: true } }), r.mk("b", { visible: false }), r.mk("c"), r.mk("d"),
    r.mk("e", { actor: { id: "e", type: "character", hasPlayerOwner: true } }), r.mk("f", { actor: { id: "e", type: "npc", hasPlayerOwner: false } }));
  r.looks.sync();
  assert.deepEqual(r.calls.filter((c) => c[0] === "fx+").map((c) => c[1]), ["e", "f"]);
  r.calls.length = 0;
  r.set({ mode: "pcs" }); r.looks.sync();
  assert.deepEqual(r.calls, [["fx-", "f"], ["body-", "animater-wound:f"]]);
  r.calls.length = 0;
  r.set({ mode: "off" }); r.looks.sync();
  assert.deepEqual(r.calls, [["fx-", "e"], ["body-", "animater-wound:e"]]);
});

test("below Tokenshade quality only the body pose plays", () => {
  const r = rig({ hp: { a: hp(10) }, fxOk: false });
  r.tokens.push(r.mk("a"));
  r.looks.sync();
  assert.deepEqual(r.calls, [["body+", "animater-wound:a", "hunch"]]);
});

test("a badly hurt token limps while it moves and hunches again when it stops", () => {
  const moving = new Set();
  const r = rig({ hp: { a: hp(10), b: hp(40) }, moving });
  r.tokens.push(r.mk("a"), r.mk("b"));
  r.looks.sync();
  r.calls.length = 0;
  moving.add("a"); moving.add("b");
  r.looks.poke();
  assert.deepEqual(r.calls, [["body-", "animater-wound:a"], ["body+", "animater-wound:a", "limp"]], "only badly hurt tokens limp");
  assert.ok(r.pending(), "keeps watching while it moves");
  r.calls.length = 0;
  r.tick();
  assert.deepEqual(r.calls, [], "still moving: no churn");
  moving.clear(); r.tick();
  assert.deepEqual(r.calls, [["body-", "animater-wound:a"], ["body+", "animater-wound:a", "hunch"]]);
  assert.equal(r.pending(), false, "stops watching once nothing moves");
});

test("clear removes every look and stops watching", () => {
  const moving = new Set(["a"]);
  const r = rig({ hp: { a: hp(10) }, moving });
  r.tokens.push(r.mk("a"));
  r.looks.sync(); r.looks.poke();
  r.calls.length = 0;
  r.looks.clear();
  assert.deepEqual(r.calls, [["fx-", "a"], ["body-", "animater-wound:a"]]);
  assert.equal(r.pending(), false);
});

test("a token is moving while Foundry animates it or its drawn spot trails its document", () => {
  assert.equal(tokenMoving({ x: 100, y: 100, document: { x: 100, y: 100 }, animationContexts: new Map() }), false);
  assert.equal(tokenMoving({ x: 100, y: 100, document: { x: 100, y: 100 }, animationContexts: new Map([["m", {}]]) }), true);
  assert.equal(tokenMoving({ x: 60, y: 100, document: { x: 100, y: 100 } }), true);
  assert.equal(tokenMoving(null), false);
});
