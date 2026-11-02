import test from "node:test";
import assert from "node:assert/strict";
import {
  DRAW_STEEL_VERIFIED, versionBelow, powerRollCritical, targetResults, abilityRow, abilityElement, abilityLook, drawSteelAttackKind,
  drawSteelDamageType, drawSteelDamage, drawSteelAbilityEvent, abilityVerbs,
} from "../../scripts/systems/draw-steel.mjs";
import { hero, goblin, ability, powerRoll, abilityMessage } from "../fixtures/draw-steel-messages.mjs";

const gouge = ability("Gouge", { damage: [[]] });
const bolt = ability("Fire Bolt", { keywords: ["magic", "ranged", "strike", "fire"], distance: "ranged", damage: [["fire"]] });
const goblinT = { uuid: "Scene.s.Token.gt.Actor.gob" };

test("version floor: below 1.1.2 warns, equal or newer does not", () => {
  assert.equal(DRAW_STEEL_VERIFIED, "1.1.2");
  assert.equal(versionBelow("1.0.9"), true);
  assert.equal(versionBelow("1.1.2"), false);
  assert.equal(versionBelow("1.2.0"), false);
  assert.equal(versionBelow(undefined), true);
});

test("a power roll is critical on a natural 19 or 20, live getter first", () => {
  assert.equal(powerRollCritical(powerRoll({ natural: 19 })), true);
  assert.equal(powerRollCritical(powerRoll({ natural: 18 })), false);
  assert.equal(powerRollCritical(powerRoll({ natural: 18, criticalThreshold: 18 })), true);
  assert.equal(powerRollCritical({ isCritical: true }), true);
  assert.equal(powerRollCritical(null), false);
});

test("a weapon strike on a target: an attack, success, melee, the target's token and tier", () => {
  const e = drawSteelAbilityEvent(abilityMessage(gouge, { targets: [{ ...goblinT, natural: 12 }] }), "u");
  assert.equal(e.type, "attack");
  assert.equal(e.systemId, "draw-steel");
  assert.equal(e.id, "chat:msg1");
  assert.equal(e.item, gouge);
  assert.equal(e.itemUuid, gouge.uuid);
  assert.equal(e.actor, hero);
  assert.equal(e.tokenId, "t");
  assert.deepEqual(e.targetUuids, ["Scene.s.Token.gt"]);
  assert.deepEqual(e.targetOutcomes, { gt: "success" });
  assert.deepEqual(e.targetTiers, { gt: 2 });
  assert.equal(e.outcome, "success");
  assert.equal(e.weaponMode, "melee");
  assert.equal(e.dsShape, "strike");
  assert.equal(e.dsElement, "physical");
});

test("a natural 19 on one of two targets is that target's critical", () => {
  const e = drawSteelAbilityEvent(abilityMessage(bolt, { targets: [{ ...goblinT, natural: 19 }, { uuid: "Scene.s.Token.g2.Actor.g2", natural: 5 }] }), "u");
  assert.deepEqual(e.targetOutcomes, { gt: "criticalSuccess", g2: "success" });
  assert.equal(e.outcome, "criticalSuccess");
  assert.equal(e.crit, true);
  assert.equal(e.tier, 3);
  assert.equal(e.dsElement, "fire");
  assert.equal(e.weaponMode, "ranged");
});

test("a linked target actor is found on the canvas by tokenFor", () => {
  const msg = abilityMessage(gouge, { targets: [{ uuid: "Actor.gob" }] });
  assert.deepEqual(targetResults(msg), [], "no token in a linked actor's uuid");
  assert.deepEqual(targetResults(msg, { tokenFor: (uuid) => (uuid === "Actor.gob" ? "linked" : null) }).map((t) => t.id), ["linked"]);
});

test("no targets: the lone roll's critical decides the outcome", () => {
  const e = drawSteelAbilityEvent(abilityMessage(bolt, { natural: 20 }), "u");
  assert.equal(e.outcome, "criticalSuccess");
  assert.deepEqual(e.targetUuids, []);
  assert.equal(e.targetOutcomes, undefined);
});

test("an ability without a power roll is a use, aimed at the user's targets", () => {
  const shout = ability("Rallying Shout", { keywords: [], distance: "burst", target: "ally", damage: [] });
  const e = drawSteelAbilityEvent(abilityMessage(shout), "u", { targets: ["a1"] });
  assert.equal(e.type, "use");
  assert.equal(e.outcome, null);
  assert.deepEqual(e.targetUuids, ["Scene.s.Token.a1"]);
  assert.equal(e.dsShape, "self");
  assert.equal(e.utilityLook, "boon");
});

test("only the author's client, private and missing abilities are skipped", () => {
  const msg = abilityMessage(gouge, { targets: [goblinT] });
  assert.equal(drawSteelAbilityEvent(msg, "someone-else"), null);
  assert.equal(drawSteelAbilityEvent({ id: "x", author: { id: "u" }, system: { parts: {} } }, "u"), null, "not an ability message");
  assert.match(drawSteelAbilityEvent({ ...msg, whisper: ["gm"], author: { id: "u", isGM: false } }, "u").skipped, /private roll/);
  const lost = abilityMessage(gouge);
  for (const part of Object.values(lost.system.parts)) delete part.ability;
  assert.match(drawSteelAbilityEvent(lost, "u").skipped, /could not be found/);
  assert.equal(drawSteelAbilityEvent(lost, "u", { resolve: (uuid) => (uuid === gouge.uuid ? gouge : null) }).item, gouge, "resolved by uuid");
});

test("rolls stored as JSON strings read the same", () => {
  const msg = abilityMessage(gouge, { targets: [{ ...goblinT, natural: 20 }] });
  for (const part of Object.values(msg.system.parts)) part.rolls = part.rolls.map((r) => JSON.stringify(r));
  assert.deepEqual(drawSteelAbilityEvent(msg, "u").targetOutcomes, { gt: "criticalSuccess" });
});

test("ability rows: damage types, conditions, keywords and whether it rolls", () => {
  const grab = ability("Grab", { damage: [], applied: ["grabbed"] });
  assert.deepEqual(abilityRow(bolt), { name: "Fire Bolt", keywords: ["magic", "ranged", "strike", "fire"], type: "main", category: "", distance: "ranged", target: "creature",
    damageTypes: ["fire"], damages: true, conditions: [], rolled: true, heals: false, forced: null, resource: null, verbs: [] });
  const shove = { name: "Shove", system: { power: { effects: { f: { type: "forced", forced: { tier1: { movement: ["push"], distance: "1" }, tier3: { movement: ["push"], distance: "3" } } } } } } };
  assert.deepEqual(abilityRow(shove).forced, { kind: "push", squares: 3 }, "forced movement at its furthest tier");
  assert.equal(abilityRow({ name: "Second Wind", system: { story: "You regain Stamina." } }).heals, true);
  assert.equal(abilityRow({ name: "Ward", system: { power: { effects: { o: { type: "other", other: { tier3: { display: "Each ally can spend a Recovery." } } } } } } }).heals, true, "an effect's text");
  assert.deepEqual(abilityRow(grab).conditions, ["grabbed"]);
  assert.equal(abilityRow(ability("Parry", { damage: [], reactive: true })).rolled, false);
});

test("element: damage type, then the keyword, then weapon, psionic or magic", () => {
  assert.equal(abilityElement({ damageTypes: ["holy"], keywords: ["magic", "fire"] }), "holy");
  assert.equal(abilityElement({ keywords: ["magic", "void"] }), "void");
  assert.equal(abilityElement({ keywords: ["psionic", "telekinesis"] }), "force");
  assert.equal(abilityElement({ keywords: ["psionic"] }), "psychic");
  assert.equal(abilityElement({ keywords: ["magic"] }), "arcane");
  assert.equal(abilityElement({ keywords: ["weapon", "melee"] }), "physical");
  assert.equal(abilityElement({ keywords: ["green", "magic"] }), "nature");
});

test("shape: strike, burst, area, line and self by distance", () => {
  assert.deepEqual(abilityLook({ distance: "melee", keywords: ["weapon", "strike", "melee"], damages: true }), { shape: "strike", element: "physical", mode: "melee", weapon: true });
  assert.equal(abilityLook({ distance: "ranged", keywords: ["magic"], damages: true }).mode, "ranged");
  assert.equal(abilityLook({ distance: "burst", damages: true }).shape, "burst");
  assert.equal(abilityLook({ distance: "aura", damages: true }).shape, "burst");
  assert.equal(abilityLook({ distance: "cube", damages: true }).shape, "area");
  assert.equal(abilityLook({ distance: "line", damages: true }).shape, "line");
  assert.deepEqual(abilityLook({ distance: "self", target: "self", heals: true }), { shape: "self", element: "physical", utility: "heal" });
  assert.equal(abilityLook({ distance: "ranged", target: "ally", name: "Ward" }).utility, "boon");
  assert.equal(abilityLook({ distance: "ranged", target: "creature", conditions: ["slowed"] }).shape, "strike", "a debuff without damage still strikes its target");
});

test("attack kinds and damage names for the damage log", () => {
  assert.equal(drawSteelAttackKind(abilityRow(gouge)), "melee");
  assert.equal(drawSteelAttackKind(abilityRow(bolt)), "spell");
  assert.equal(drawSteelDamageType("corruption"), "void");
  assert.equal(drawSteelDamageType("fire"), "fire");
  assert.equal(drawSteelDamageType("", "melee"), "slashing");
  assert.equal(drawSteelDamageType("", "ranged"), "piercing");
  assert.equal(drawSteelDamageType("", "spell"), "bludgeoning");
});

test("the damage log: type, targets, source and crit from the ability message", () => {
  const d = drawSteelDamage(abilityMessage(bolt, { targets: [{ ...goblinT, natural: 20 }] }));
  assert.equal(d.type, "fire");
  assert.deepEqual([...d.tokenIds], ["gt"]);
  assert.deepEqual([...d.actorIds], ["gob"]);
  assert.equal(d.sourceTokenId, "t");
  assert.equal(d.attackKind, "spell");
  assert.equal(d.crit, true);
  assert.equal(d.itemName, "Fire Bolt");
  assert.equal(d.actorUuid, hero.uuid);
  assert.equal(drawSteelDamage(abilityMessage(ability("Grab", { damage: [], applied: ["grabbed"] }), { targets: [goblinT] })), null, "no damage roll");
  assert.equal(drawSteelDamage(abilityMessage(gouge, { targets: [goblinT] })).type, "slashing", "untyped weapon damage");
  assert.ok(goblin);
});

test("verbs: what an ability's text says it does, in the order it says it", () => {
  assert.deepEqual(abilityVerbs("You teleport up to 5 squares. If you have concealment or cover at your destination, you can use the Hide maneuver. You [[/surge 1]]."), ["teleport", "conceal", "surge"]);
  assert.deepEqual(abilityVerbs("You turn [[/apply invisible]] and create a magical illusion of your corpse falling in your space."), ["invisible", "illusion"]);
  assert.deepEqual(abilityVerbs("The target is grabbed by you, but the target can make a melee free strike against you first."), [], "a free strike against you rallies no one");
  assert.deepEqual(abilityVerbs("You take a bane on this maneuver if you are smaller. You are no longer grabbed."), ["escape"], "your own bane is no curse");
  assert.deepEqual(abilityVerbs("Each target can make a free strike."), ["rally"]);
  assert.deepEqual(abilityVerbs("The target is removed from the encounter map until the start of their next turn."), ["teleport"]);
});
