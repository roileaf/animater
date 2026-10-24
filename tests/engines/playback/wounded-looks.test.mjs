import test from "node:test";
import assert from "node:assert/strict";
import { hpLeft, woundTier, woundedPreset, woundEligible, woundActions, tokenMoving, WoundedLooks } from "../../../scripts/engines/playback/wounded-looks.mjs";

const BASE = { name: "Wounded", library: "tokenshade", params: [
  { filterType: "splash", color: 0x4a0606, seed: 0.33, splashFactor: 2, spread: 3, cut: true, edge: 0.6 },
  { filterType: "splash", color: 0x3a0404, seed: 0.79, splashFactor: 2, spread: 2, cut: true, edge: 0.75 },
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

test("the hurt look is the Wounded preset toned down; badly hurt is stronger; the shared preset is untouched", () => {
  const before = structuredClone(BASE);
  const hurt = woundedPreset(1, BASE), bad = woundedPreset(2, BASE);
  assert.deepEqual(BASE, before);
  const adj = (p) => p.params.find((x) => x.filterType === "adjustment");
  const splashes = (p) => p.params.filter((x) => x.filterType === "splash");
  assert.ok(adj(hurt).saturation > adj(BASE).saturation && adj(hurt).saturation < 1);
  assert.ok(adj(bad).saturation < adj(BASE).saturation, "badly hurt drains more colour");
  assert.equal(splashes(hurt).length, 1, "one small stain");
  assert.ok(splashes(hurt)[0].dimX < 1);
  assert.equal(splashes(bad).length, 2);
  assert.notEqual(hurt.name, bad.name);
  assert.equal(woundedPreset(0, BASE), null);
  assert.equal(woundedPreset(1, null), null);
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

test("a hurt token gets the toned-down look under its own key; badly hurt adds a hunch; healing removes both", () => {
  const h = { a: hp(40) };
  const r = rig({ hp: h });
  r.tokens.push(r.mk("a"));
  r.looks.sync();
  assert.deepEqual(r.calls, [["fx+", "a", "animater-wounded-1", "animater-wound:a"]]);
  r.calls.length = 0;
  h.a = hp(20); r.looks.sync();
  assert.deepEqual(r.calls, [["fx-", "a"], ["fx+", "a", "animater-wounded-2", "animater-wound:a"], ["body+", "animater-wound:a", "hunch"]]);
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
