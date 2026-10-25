import test from "node:test";
import assert from "node:assert/strict";
import { IdleLife, IDLE_CAP, idleKind, idlePhase, breathPeriod, breathes, pickIdle } from "../../../scripts/engines/motion/idle-life.mjs";

const creature = (system = {}, type = "npc") => ({ type, system });

test("living creatures breathe; constructs, undead, objects, hazards and vehicles do not", () => {
  assert.equal(breathes(creature({ traits: { value: ["humanoid", "elf"] } })), true);
  assert.equal(breathes(creature({ traits: { value: ["construct"] } })), false, "PF2e construct");
  assert.equal(breathes(creature({ traits: { value: ["undead", "zombie"] } })), false, "PF2e undead");
  assert.equal(breathes(creature({ traits: { value: ["object"] } })), false);
  assert.equal(breathes(creature({ traits: { value: new Set(["construct"]) } })), false, "a Set of traits");
  assert.equal(breathes(creature({}, "hazard")), false);
  assert.equal(breathes(creature({}, "vehicle")), false);
  assert.equal(breathes(creature({}, "loot")), false);
  assert.equal(breathes(creature({ details: { type: { value: "undead" } } })), false, "D&D creature type");
  assert.equal(breathes(creature({ details: { type: { value: "beast" } } })), true);
  assert.equal(breathes(creature({ type: "standard" }, "adversary")), true, "Daggerheart adversary");
  assert.equal(breathes(creature({}, "environment")), false, "Daggerheart environment");
  assert.equal(breathes(null), false, "a token without an actor");
});

test("which idle a token gets: fliers hover, the rest breathe, the down and defeated stay still", () => {
  const actor = creature({ traits: { value: ["humanoid"] } });
  assert.equal(idleKind({ actor }), "idle-breathe");
  assert.equal(idleKind({ actor, elevation: 10 }), "idle-breathe", "standing on a raised platform is not flying");
  assert.equal(idleKind({ actor, elevation: 10, movementAction: "walk" }), "idle-breathe");
  assert.equal(idleKind({ actor, statuses: ["flying"] }), "idle-hover");
  assert.equal(idleKind({ actor, movementAction: "fly" }), "idle-hover");
  assert.equal(idleKind({ actor: creature({ traits: { value: ["construct"] } }), movementAction: "fly" }), "idle-hover", "a flying construct still hovers");
  assert.equal(idleKind({ actor: creature({ traits: { value: ["construct"] } }) }), null);
  for (const s of ["prone", "unconscious", "dead", "dying", "defeated", "paralyzed", "petrified"])
    assert.equal(idleKind({ actor, statuses: [s], elevation: 10 }), null, s);
  assert.equal(idleKind({ actor, defeated: true }), null);
  assert.equal(idleKind({ actor: creature({}, "hazard"), elevation: 5 }), null, "a hazard never hovers");
});

test("the phase and breath period are seeded by the token id, so tokens breathe out of step", () => {
  assert.equal(idlePhase("abc"), idlePhase("abc"));
  assert.notEqual(idlePhase("abc"), idlePhase("abd"));
  for (const id of ["a", "Token.xyz", "0000", "zzzzzzzzzzzzzzzz"]) {
    assert.ok(idlePhase(id) >= 0 && idlePhase(id) < 1);
    assert.ok(breathPeriod(id) >= 3.5 && breathPeriod(id) <= 5);
  }
});

test("only tokens in view, nearest the middle first, capped", () => {
  const view = { x: 0, y: 0, width: 1000, height: 1000 };
  const at = (id, x, y) => ({ id, x, y, w: 100, h: 100 });
  const picked = pickIdle([at("far", 5000, 5000), at("edge", 950, 950), at("mid", 450, 450), at("near", 300, 400)], view, 2);
  assert.deepEqual(picked.map((t) => t.id), ["mid", "near"]);
  assert.deepEqual(pickIdle([at("edge", 950, 950)], view).map((t) => t.id), ["edge"], "partly in view counts");
  assert.equal(IDLE_CAP, 40);
});

function host({ tokens, enabled = () => true, view = { x: 0, y: 0, width: 2000, height: 2000 } }) {
  const calls = [];
  const body = { add: (name, token, kind, opts) => calls.push(["add", name, kind, opts]), remove: (name) => calls.push(["remove", name]) };
  const life = new IdleLife({ body, tokens: () => tokens, view: () => view, enabled, statuses: (t) => t.statuses ?? [], defeated: () => false, levelBase: () => 0 });
  return { life, calls };
}
const tok = (id, extra = {}) => ({ id, x: 100, y: 100, w: 100, h: 100, visible: true, document: { id, hidden: false, elevation: 0 }, actor: creature({ traits: { value: ["humanoid"] } }), ...extra });

test("sync adds idle treatments, keeps them steady, and switches or removes them as tokens change", () => {
  const a = tok("a"), b = tok("b");
  const tokens = [a, b];
  const { life, calls } = host({ tokens });
  life.sync();
  assert.deepEqual(calls.map((c) => [c[0], c[1], c[2]]), [["add", "animater-idle:a", "idle-breathe"], ["add", "animater-idle:b", "idle-breathe"]]);
  const opts = calls[0][3];
  assert.equal(opts.period, breathPeriod("a"));
  assert.equal(opts.phase, idlePhase("a") * breathPeriod("a"));
  calls.length = 0;
  life.sync();
  assert.deepEqual(calls, [], "nothing changes, nothing is re-added");
  a.document.movementAction = "fly";
  b.visible = false;
  life.sync();
  assert.deepEqual(calls.map((c) => [c[0], c[1], c[2]]), [["remove", "animater-idle:b", undefined], ["add", "animater-idle:a", "idle-hover"]]);
  calls.length = 0;
  tokens.splice(0, 2);
  life.sync();
  assert.deepEqual(calls, [["remove", "animater-idle:a"]], "a deleted token loses its idle");
});

test("hidden tokens, tokens out of view and more than the cap get no idle", () => {
  const many = Array.from({ length: 50 }, (_, i) => tok(`t${i}`));
  many[0].document.hidden = true;
  many[1].x = 99999;
  const { life, calls } = host({ tokens: many });
  life.sync();
  const added = calls.filter((c) => c[0] === "add").map((c) => c[1]);
  assert.equal(added.length, 40);
  assert.ok(!added.includes("animater-idle:t0") && !added.includes("animater-idle:t1"));
});

test("turned off (setting or quality), every idle is removed at once, and comes back when turned on", () => {
  let on = true;
  const { life, calls } = host({ tokens: [tok("a")], enabled: () => on });
  life.sync();
  on = false; calls.length = 0;
  life.sync();
  assert.deepEqual(calls, [["remove", "animater-idle:a"]]);
  calls.length = 0;
  life.sync();
  assert.deepEqual(calls, []);
  on = true;
  life.sync();
  assert.equal(calls[0][1], "animater-idle:a");
  calls.length = 0;
  life.clear();
  assert.deepEqual(calls, [["remove", "animater-idle:a"]]);
});

test("a token that throws while being read is skipped, not fatal", () => {
  const bad = tok("bad");
  Object.defineProperty(bad, "actor", { get() { throw new Error("gone"); } });
  const { life, calls } = host({ tokens: [bad, tok("ok")] });
  life.sync();
  assert.deepEqual(calls.map((c) => c[1]), ["animater-idle:ok"]);
});

test('idle kinds can be switched separately: fliers keep hovering with breathing off, and the other way round', () => {
  const calls = [];
  const body = { add: (name, token, kind) => calls.push(['add', name, kind]), remove: (name) => calls.push(['remove', name]) };
  const actor = { type: 'npc', system: { traits: { value: ['humanoid'] } } };
  const walker = { id: 'w', x: 100, y: 100, w: 100, h: 100, visible: true, actor, document: { id: 'w', hidden: false, elevation: 0, width: 1 } };
  const flier = { id: 'f', x: 300, y: 100, w: 100, h: 100, visible: true, actor, document: { id: 'f', hidden: false, elevation: 30, width: 1, movementAction: 'fly' } };
  let kinds = { breathe: false, hover: true };
  const life = new IdleLife({ body, tokens: () => [walker, flier], view: () => ({ x: 0, y: 0, width: 1000, height: 1000 }), kinds: () => kinds });
  life.sync();
  assert.deepEqual(calls.filter((c) => c[0] === 'add').map((c) => c[2]), ['idle-hover'], 'only the flier bobs');
  calls.length = 0;
  kinds = { breathe: true, hover: false };
  life.sync();
  assert.deepEqual(calls.filter((c) => c[0] === 'add').map((c) => c[2]), ['idle-breathe'], 'only the walker breathes now');
  assert.deepEqual(calls.filter((c) => c[0] === 'remove').map((c) => c[1]), ['animater-idle:f'], 'the flier stops bobbing');
});
