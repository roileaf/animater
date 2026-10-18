import test from "node:test";
import assert from "node:assert/strict";
import { normalizeDamageType, damageFromMessage, damageFromParts, recallDamage, attackKindOf, recallAttribution, hitRecipe, deathRecipe, DAMAGE_MEMORY_MS } from "../../../scripts/engines/playback/damage-moments.mjs";
import { validateRecipe } from "../../../scripts/core/model.mjs";

test("every system's damage names share one look", () => {
  assert.equal(normalizeDamageType("Lightning"), "electricity");
  assert.equal(normalizeDamageType("necrotic"), "void");
  assert.equal(normalizeDamageType("radiant"), "vitality");
  assert.equal(normalizeDamageType("psychic"), "mental");
  assert.equal(normalizeDamageType("fire"), "fire");
});

test("a PF2e damage roll gives its biggest damage type and its target", () => {
  class DamageRoll { constructor(instances) { this.instances = instances; } }
  const message = { rolls: [new DamageRoll([{ type: "slashing", total: 4 }, { type: "fire", total: 9 }])], flags: { pf2e: { context: { type: "damage-roll", target: { actor: "Actor.abc", token: "Scene.s.Token.tok" } } } } };
  const d = damageFromMessage(message, "pf2e");
  assert.equal(d.type, "fire");
  assert.ok(d.tokenIds.has("tok") && d.actorIds.has("abc"));
  assert.equal(damageFromMessage({ rolls: [], flags: { pf2e: { context: { type: "attack-roll" } } } }, "pf2e"), null);
});

test("a D&D damage roll reads its roll type and targets", () => {
  const message = { rolls: [{ options: { type: "cold" }, total: 7 }], flags: { dnd5e: { roll: { type: "damage" }, targets: [{ uuid: "Actor.orc" }] } } };
  const d = damageFromMessage(message, "dnd5e");
  assert.equal(d.type, "cold");
  assert.ok(d.actorIds.has("orc"));
});

test("D&D applied damage parts give the biggest type for that actor", () => {
  const d = damageFromParts([{ type: "slashing", value: 3 }, { type: "necrotic", value: 8 }, { type: "fire", value: 0 }], "orc");
  assert.equal(d.type, "void");
  assert.ok(d.actorIds.has("orc"));
  assert.equal(damageFromParts([], "orc"), null);
});

test("the damage a creature took is the newest roll aimed at it, else an untargeted one, while fresh", () => {
  const now = 100000;
  const log = [
    { type: "fire", tokenIds: new Set(["a"]), actorIds: new Set(), at: now - 5000 },
    { type: "cold", tokenIds: new Set(), actorIds: new Set(), at: now - 1000 },
    { type: "acid", tokenIds: new Set(["a"]), actorIds: new Set(), at: now - DAMAGE_MEMORY_MS - 1 },
  ];
  assert.equal(recallDamage(log, { tokenId: "a" }, now).type, "fire");
  assert.equal(recallDamage(log, { tokenId: "b" }, now).type, "cold");
  assert.equal(recallDamage(log.slice(2), { tokenId: "a" }, now), null);
});

test("energy damage flashes on the token; physical damage does not; knockouts finish the collapse", () => {
  const collapse = { id: "c", name: "Collapse", trigger: "manual", stages: [{ stageId: "collapse", kind: "motion", motion: "collapse", subject: "source", duration: 1800, assets: [] }] };
  assert.equal(hitRecipe("slashing"), null);
  assert.equal(hitRecipe(undefined), null);
  const hit = validateRecipe(hitRecipe("fire"));
  assert.equal(hit.stages[0].kind, "cast", "plays on the damaged token");
  assert.equal(deathRecipe("piercing", collapse), collapse, "physical keeps the plain collapse");
  const death = validateRecipe(deathRecipe("cold", collapse));
  assert.deepEqual(death.stages.map((s) => s.kind), ["motion", "tokenfx", "cast", "cast"]);
  assert.equal(death.stages[1].fxPreset, "Frostbitten", "frost creeping over the token");
  for (const [type, preset] of [["acid", "Corroding"], ["poison", "Envenomed"], ["necrotic", "Withering"], ["radiant", "Radiant Burn"], ["force", "Force Jolt"], ["psychic", "Psychic Warp"], ["thunder", "Resonance"], ["spirit", "Spirit Rend"], ["lightning", "Electrocuted"], ["fire", "Burning"]])
    assert.equal(hitRecipe(type).stages.find((s) => s.kind === "tokenfx").fxPreset, preset, type);
  assert.deepEqual(hit.stages.map((s) => s.kind), ["cast", "tokenfx"]);
  assert.match(death.name, /freezes and shatters/);
});

test("a PF2e killing blow names its attacker, how it struck, and a critical", () => {
  class DamageRoll { constructor(instances) { this.instances = instances; } }
  const message = (context, origin = { type: "weapon" }) => ({ speaker: { token: "atk" }, rolls: [new DamageRoll([{ type: "slashing", total: 9 }])],
    flags: { pf2e: { origin, context: { type: "damage-roll", domains: ["damage", "strike-damage"], options: [], ...context } } } });
  let d = damageFromMessage(message({ options: ["item:melee"] }), "pf2e");
  assert.equal(d.sourceTokenId, "atk");
  assert.equal(d.attackKind, "melee");
  assert.equal(d.crit, false);
  d = damageFromMessage(message({ options: ["item:ranged"], outcome: "criticalSuccess" }), "pf2e");
  assert.equal(d.attackKind, "ranged");
  assert.equal(d.crit, true);
  assert.equal(damageFromMessage(message({ domains: ["melee-damage"] }), "pf2e").attackKind, "melee");
  assert.equal(damageFromMessage(message({ domains: ["melee-damage"] }, { type: "spell" }), "pf2e").attackKind, "spell", "a melee spell is still a spell");
  assert.equal(damageFromMessage(message({}, { type: "melee" }), "pf2e").attackKind, "melee", "an NPC attack with no range options");
  assert.equal(damageFromMessage(message({}, null), "pf2e").attackKind, "other");
});

test("a D&D damage roll names its attacker, a spell, and a critical", () => {
  const roll = (isCritical) => ({ options: { type: "fire" }, total: 7, isCritical });
  const d = damageFromMessage({ speaker: { token: "wiz" }, rolls: [roll(true)], flags: { dnd5e: { roll: { type: "damage" }, item: { type: "spell" }, targets: [{ uuid: "Actor.orc" }] } } }, "dnd5e");
  assert.equal(d.sourceTokenId, "wiz");
  assert.equal(d.attackKind, "spell");
  assert.equal(d.crit, true);
  assert.equal(attackKindOf({ flags: { dnd5e: { item: { type: "weapon" } } } }, "dnd5e"), "melee");
});

test("the attacker is recalled from the newest roll that knows one, even when applied damage does not", () => {
  const now = 100000;
  const log = [
    { type: "fire", tokenIds: new Set(), actorIds: new Set(["orc"]), sourceTokenId: "wiz", attackKind: "spell", crit: false, at: now - 3000 },
    { type: "fire", tokenIds: new Set(), actorIds: new Set(["orc"]), at: now - 1000 },
  ];
  assert.equal(recallAttribution(log, { actorId: "orc" }, now).sourceTokenId, "wiz");
  assert.equal(recallAttribution(log.slice(1), { actorId: "orc" }, now), null);
});

test("a damage roll remembers which item dealt it", () => {
  class DamageRoll { constructor(instances) { this.instances = instances; } }
  const pf = damageFromMessage({ item: { name: "Greataxe" }, speaker: { token: "atk" }, rolls: [new DamageRoll([{ type: "slashing", total: 9 }])],
    flags: { pf2e: { origin: { type: "weapon", uuid: "Actor.a.Item.axe" }, context: { type: "damage-roll", options: ["item:melee"] } } } }, "pf2e");
  assert.equal(pf.itemUuid, "Actor.a.Item.axe");
  assert.equal(pf.itemName, "Greataxe");
  const dnd = damageFromMessage({ rolls: [{ options: { type: "fire" }, total: 7 }], flags: { dnd5e: { roll: { type: "damage" }, item: { type: "spell", uuid: "Actor.w.Item.fb" } } } }, "dnd5e");
  assert.equal(dnd.itemUuid, "Actor.w.Item.fb");
  assert.equal(dnd.itemName, null);
});

test("a synthetic strike's damage remembers the attacker actor and the strike's name and slug", () => {
  class DamageRoll { constructor(instances) { this.instances = instances; } }
  const actor = { items: { get: () => undefined } };
  const fist = { id: "xxPF2ExUNARMEDxx", name: "Unarmed Attack", slug: "basic-unarmed", actor };
  const msg = (item, options = []) => ({ item, speaker: { token: "atk" }, rolls: [new DamageRoll([{ type: "bludgeoning", total: 4 }])],
    flags: { pf2e: { origin: { type: "weapon", actor: "Actor.a", uuid: "Actor.a.Item.xxPF2ExUNARMEDxx" }, context: { type: "damage-roll", options } } } });
  const pf = damageFromMessage(msg(fist), "pf2e");
  assert.equal(pf.synthetic, true);
  assert.equal(pf.actorUuid, "Actor.a");
  assert.equal(pf.itemName, "Unarmed Attack");
  assert.equal(pf.itemSlug, "basic-unarmed");
  const bare = damageFromMessage(msg(null, ["item:slug:basic-unarmed"]), "pf2e");
  assert.equal(bare.synthetic, true, "an unresolved item with PF2e's synthetic id");
  assert.equal(bare.itemSlug, "basic-unarmed", "the slug from the roll options");
  const axe = damageFromMessage({ ...msg({ name: "Greataxe", slug: "greataxe" }), flags: { pf2e: { origin: { uuid: "Actor.a.Item.axe" }, context: { type: "damage-roll" } } } }, "pf2e");
  assert.equal(axe.synthetic, false);
});

import { rollMessage, weapon, card, dualityRoll, damageRoll } from "../../fixtures/daggerheart-messages.mjs";

test("Daggerheart damage on an attack card: hit targets, physical by weapon family, magical by domain", () => {
  const sword = damageFromMessage(rollMessage({ item: weapon("Longsword"), damage: damageRoll() }), "daggerheart");
  assert.equal(sword.type, "slashing");
  assert.ok(sword.tokenIds.has("target"));
  assert.equal(sword.attackKind, "melee");
  assert.equal(attackKindOf(rollMessage({ item: weapon("Shortbow", "far") }), "daggerheart"), "ranged");
  const spell = damageFromMessage(rollMessage({ item: card("Blink Out", "arcana"), roll: dualityRoll({ type: "spellcast" }), damage: damageRoll({ types: ["magical"] }) }), "daggerheart");
  assert.equal(spell.type, "force");
  assert.equal(spell.attackKind, "spell");
  assert.equal(damageFromMessage(rollMessage({ item: weapon("Longsword") }), "daggerheart"), null, "no damage rolled yet");
});
