import test from "node:test";
import assert from "node:assert/strict";
import { critTargets, targetPassed } from "../../../scripts/engines/finishers/finisher-model.mjs";
import { daggerheartDamageFinisher, damageTypeFinisher } from "../../../scripts/engines/finishers/finisher-presets.mjs";

test("per-target outcomes: a crit finisher plays only on critically struck targets, a use finisher only on hit ones", () => {
  const a = { id: "a" }, b = { id: "b" };
  const event = { type: "attack", outcome: "success", targets: [a, b], targetOutcomes: { a: "success", b: "failure" } };
  assert.deepEqual(critTargets(event), []);
  assert.equal(targetPassed(event, a), true);
  assert.equal(targetPassed(event, b), false);
  assert.deepEqual(critTargets({ ...event, outcome: "criticalSuccess", targetOutcomes: { a: "criticalSuccess", b: "criticalSuccess" } }), [a, b]);
  assert.deepEqual(critTargets({ type: "attack", outcome: "criticalSuccess", targets: [a, b] }), [a, b], "systems without per-target outcomes are unchanged");
  assert.equal(targetPassed({ type: "attack", outcome: "failure", targets: [a] }, a), true, "no per-target outcomes: the event's own gate decides");
});

test("Daggerheart by damage type: physical by weapon family, magical by domain", () => {
  const id = (type, item) => daggerheartDamageFinisher({ type, item })?.id ?? null;
  assert.equal(id("physical", { name: "Longsword" }), "builtin-carved");
  assert.equal(id("physical", { name: "Battleaxe" }), "builtin-carved");
  assert.equal(id("physical", { name: "Shortbow" }), "builtin-perforated");
  assert.equal(id("physical", { name: "Hand Crossbow" }), "builtin-perforated");
  assert.equal(id("physical", { name: "Spear" }), "builtin-perforated");
  assert.equal(id("physical", { name: "Runelock Pistol" }), "builtin-perforated");
  assert.equal(id("physical", { name: "Warhammer" }), "builtin-pulverized");
  assert.equal(id("physical", { name: "Mace" }), "builtin-pulverized");
  assert.equal(id("physical", { name: "Rocket Maul" }), "builtin-pulverized");
  assert.equal(id("physical", { name: "Round Shield" }), "builtin-pulverized", "a shield bash pulverizes");
  assert.equal(id("physical", { name: "Claws" }), "builtin-carved", "unknown → carved");
  const domain = (d) => ({ system: { domain: d } });
  assert.equal(id("magical", domain("arcana")), "builtin-blown-apart");
  assert.equal(id("magical", domain("midnight")), "builtin-consumed");
  assert.equal(id("magical", domain("dread")), "builtin-consumed", "Dread (void) consumes");
  assert.equal(id("magical", domain("splendor")), "builtin-smitten");
  assert.equal(id("magical", domain("grace")), "builtin-smitten");
  assert.equal(id("magical", domain("sage")), "builtin-withered");
  assert.equal(id("magical", domain("codex")), "builtin-unraveled");
  assert.equal(id("magical", domain("bone")), "builtin-bled-out");
  assert.equal(id("magical", domain("blade")), "builtin-carved");
  assert.equal(id("magical", domain("valor")), "builtin-carved");
  assert.equal(id("magical", { name: "Wand" }), "builtin-blown-apart", "no domain → blown apart");
  assert.equal(id(null, { name: "Longsword" }), null);
  assert.equal(daggerheartDamageFinisher({ type: "physical", item: { name: "Shortbow" } }).name, damageTypeFinisher("piercing").name);
});
