import test from "node:test";
import assert from "node:assert/strict";
import { twoeEvent } from "../../scripts/systems/adapters.mjs";
import { resolveAutomaticRecipe } from "../../scripts/catalogs/pf2e/spells/spell-catalog.mjs";
import { setHidePrivateResults } from "../../scripts/core/privacy.mjs";
// These tests cover the world setting "Hide the result of private GM rolls" turned on (each test file
// runs in its own process); the default, private rolls showing their result, is in tests/core/private-results.test.mjs.
setHidePrivateResults(true);

const strike = (over = {}) => ({ id: "m", author: { id: "gm", isGM: true }, isRoll: true, speaker: {}, actor: {},
  item: { type: "weapon", name: "Shortsword", system: {} },
  flags: { pf2e: { context: { type: "attack-roll", outcome: "criticalSuccess", options: [] }, origin: { uuid: "Actor.a.Item.b" } } }, ...over });

test("a GM's private roll animates for the table, without giving away its result", () => {
  const e = twoeEvent(strike({ whisper: ["gm"] }), "gm");
  assert.ok(e, "monsters rolled in Private GM Roll mode still animate");
  assert.equal(e.type, "attack");
  assert.equal(e.outcome, "hidden", "no crit, hit or miss variant reveals the hidden roll");
  assert.equal(e.private, true);
  assert.equal(twoeEvent(strike(), "gm").outcome, "criticalSuccess", "a public roll keeps its outcome");
  assert.match(twoeEvent(strike({ whisper: ["gm"], blind: true }), "gm").skipped, /blind roll/, "blind rolls stay hidden");
  assert.deepEqual(twoeEvent(strike({ whisper: ["gm"], author: { id: "p", isGM: false } }), "p").audience, ["p", "gm"], "a player's own private roll plays for the player and GM only");
});

test("a spell with the attack trait animates on its attack roll, not on its cast card", () => {
  // Legacy Ray of Enfeeblement: an attack spell whose catalog entry (the remaster's Enfeeble) plays on use.
  const item = { type: "spell", name: "Ray of Enfeeblement", slug: "ray-of-enfeeblement", sourceId: "Compendium.pf2e.spells-srd.Item.J7Y7tl0bbdz7TcCc",
    _stats: { compendiumSource: "Compendium.pf2e.spells-srd.Item.J7Y7tl0bbdz7TcCc" }, system: { slug: "ray-of-enfeeblement", traits: { value: ["attack", "concentrate", "manipulate"] } } };
  const on = { enabled: true, scope: "all", independent: true };
  const at = (type) => resolveAutomaticRecipe({ type, systemId: "pf2e", item }, on, [], { customEnabled: false });
  assert.equal(at("use"), null, "the cast card stays quiet");
  const r = at("attack");
  assert.ok(r, "the attack roll animates");
  assert.equal(r.trigger, "attack");
  // A spell without the attack trait keeps its own trigger.
  const save = { ...item, name: "Enfeeble", slug: "enfeeble", system: { slug: "enfeeble", traits: { value: ["concentrate", "manipulate"] } } };
  assert.ok(resolveAutomaticRecipe({ type: "use", systemId: "pf2e", item: save }, on, [], { customEnabled: false }), "Enfeeble still animates when cast");
});
