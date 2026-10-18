import test from "node:test";
import assert from "node:assert/strict";
import {
  DAGGERHEART_VERIFIED, DH_DOMAINS, versionBelow, dhDamageKind, weaponFamily, daggerheartDamageType, rollIsCritical, dualityOf,
  targetOutcomes, bestOutcome, daggerheartAttackKind, daggerheartRollEvent, daggerheartUseEvent, daggerheartDamage, daggerheartDamageEvent,
} from "../../scripts/systems/daggerheart.mjs";
import { hero, orc, weapon, card, dualityRoll, adversaryRoll, damageRoll, target, rollMessage, useHook } from "../fixtures/daggerheart-messages.mjs";

const sword = weapon("Longsword");

test("version floor: below 2.10.12 warns, equal or newer does not", () => {
  assert.equal(DAGGERHEART_VERIFIED, "2.10.12");
  assert.equal(versionBelow("2.9.4"), true);
  assert.equal(versionBelow("2.10.10"), true);
  assert.equal(versionBelow("2.10.12"), false);
  assert.equal(versionBelow("2.11.0"), false);
  assert.equal(versionBelow("3"), false);
  assert.equal(versionBelow(undefined), true);
});

test("a hit with Hope: success on the target, duality hope, melee weapon", () => {
  const e = daggerheartRollEvent(rollMessage({ item: sword, roll: dualityRoll({ hope: 9, fear: 4 }) }), "u");
  assert.equal(e.type, "attack");
  assert.equal(e.systemId, "daggerheart");
  assert.equal(e.id, "chat:roll1");
  assert.equal(e.item, sword);
  assert.equal(e.itemUuid, sword.uuid);
  assert.equal(e.actor, hero);
  assert.equal(e.tokenId, "t");
  assert.deepEqual(e.targetUuids, ["Scene.s.Token.target"]);
  assert.deepEqual(e.targetOutcomes, { target: "success" });
  assert.equal(e.outcome, "success");
  assert.equal(e.rollType, "attack");
  assert.equal(e.duality, "hope");
  assert.equal(e.weaponMode, "melee");
  assert.equal(e.actionId, "act", "the action that rolled, from system.source.action");
});

test("events name the action that fired: a roll by its source or its action, a use by the action's id", () => {
  const msg = rollMessage({ item: card("Book of Norai", "codex", { level: 3, cardType: "grimoire" }), action: { _id: "GI2VkIcGDOjFRxpT", name: "Fireball - Cast", roll: { type: "spellcast" } } });
  delete msg.system.source.action;
  assert.equal(daggerheartRollEvent(msg, "u").actionId, "GI2VkIcGDOjFRxpT");
  const [action, config] = useHook({ item: card("Book of Illiat", "codex", { cardType: "grimoire" }), action: { id: "tele1", name: "Telepathy", roll: { type: null } } });
  assert.equal(daggerheartUseEvent(action, config, { sceneId: "s" }).actionId, "tele1");
  const [bare, bareConfig] = useHook();
  assert.equal(daggerheartUseEvent(bare, bareConfig, { sceneId: "s" }).actionId, null);
});

test("a hit with Fear, a critical with matching dice, and a miss", () => {
  assert.equal(daggerheartRollEvent(rollMessage({ item: sword, roll: dualityRoll({ hope: 3, fear: 9 }) }), "u").duality, "fear");
  const crit = daggerheartRollEvent(rollMessage({ item: sword, roll: dualityRoll({ hope: 6, fear: 6, modifier: 0 }), targets: [target("target", { evasion: 20 })] }), "u");
  assert.equal(crit.outcome, "criticalSuccess", "a critical hits whatever the total");
  assert.equal(crit.duality, "critical");
  assert.deepEqual(crit.targetOutcomes, { target: "criticalSuccess" });
  const miss = daggerheartRollEvent(rollMessage({ item: sword, roll: dualityRoll({ hope: 3, fear: 2, modifier: 0 }) }), "u");
  assert.equal(miss.outcome, "failure");
  assert.deepEqual(miss.targetOutcomes, { target: "failure" });
});

test("an adversary's d20 critical with its standard attack (no Item): named by the action, melee by its range", () => {
  const e = daggerheartRollEvent(rollMessage({ type: "adversaryRoll", roll: adversaryRoll({ d20: 20 }), actor: orc, action: { name: "Claws", roll: { type: "attack" }, range: "melee" } }), "u");
  assert.equal(e.item, null);
  assert.equal(e.itemName, "Claws");
  assert.equal(e.activityName, "Claws");
  assert.equal(e.actor, orc);
  assert.equal(e.outcome, "criticalSuccess");
  assert.equal(e.duality, null, "d20 rolls have no Hope or Fear");
  assert.equal(e.weaponMode, "melee");
});

test("a multi-target spellcast with mixed results: per-target outcomes, the best for the event", () => {
  const arcana = card("Blink Out", "arcana", { level: 4 });
  const e = daggerheartRollEvent(rollMessage({ item: arcana, roll: dualityRoll({ hope: 7, fear: 5, modifier: 2, type: "spellcast" }), action: { name: "Cast", roll: { type: "spellcast" } },
    targets: [target("a", { difficulty: 12 }), target("b", { evasion: 16 })] }), "u");
  assert.deepEqual(e.targetOutcomes, { a: "success", b: "failure" });
  assert.equal(e.outcome, "success");
  assert.equal(e.rollType, "spellcast");
  assert.equal(e.domain, "arcana");
  assert.equal(e.cardLevel, 4);
  assert.equal(e.weaponMode, undefined, "cards have no weapon mode");
  assert.deepEqual(targetOutcomes({ targets: [{ id: "x", actorId: "Actor.x", difficulty: null }] }, dualityRoll({ hope: 4, fear: 4 })), [{ id: "x", actorUuid: "Actor.x", outcome: "criticalSuccess" }], "the system's rule: a crit hits even with no evasion");
  assert.deepEqual(targetOutcomes({ targets: [{ id: "x", actorId: "Actor.x", difficulty: null }] }, dualityRoll({ hope: 9, fear: 4 })), [{ id: "x", actorUuid: "Actor.x", outcome: "failure" }], "nothing to beat and no crit: no hit");
  assert.equal(bestOutcome([]), null);
});

test("trait, reaction and other non-attack rolls, other users' and private messages are not attack events", () => {
  assert.equal(daggerheartRollEvent(rollMessage({ item: sword, roll: dualityRoll({ type: "trait" }), action: { name: "Act", roll: { type: "trait" } } }), "u"), null);
  assert.equal(daggerheartRollEvent(rollMessage({ item: sword, author: "other" }), "u"), null);
  assert.match(daggerheartRollEvent(rollMessage({ item: sword, whisper: ["gm"] }), "u").skipped, /private roll/);
  assert.match(daggerheartRollEvent(rollMessage({ item: sword, blind: true }), "u").skipped, /blind roll/);
  assert.equal(daggerheartRollEvent({ ...rollMessage({ item: sword }), type: "base" }, "u"), null);
  assert.equal(daggerheartRollEvent(null, "u"), null);
});

test("an attack with no targets: no target uuids, no per-target outcomes, outcome unknown unless critical", () => {
  const e = daggerheartRollEvent(rollMessage({ item: sword, targets: [] }), "u");
  assert.deepEqual(e.targetUuids, []);
  assert.equal(e.targetOutcomes, undefined);
  assert.equal(e.outcome, null);
  assert.equal(daggerheartRollEvent(rollMessage({ item: sword, targets: [], roll: dualityRoll({ hope: 5, fear: 5 }) }), "u").outcome, "criticalSuccess");
  assert.deepEqual(daggerheartRollEvent(rollMessage({ item: sword, speaker: { token: "t" } }), "u", { sceneId: "s2" }).targetUuids, ["Scene.s2.Token.target"], "the canvas scene when the speaker has none");
});

test("a roll whose item and action cannot be found is skipped with a reason, never thrown", () => {
  const skipped = daggerheartRollEvent(rollMessage({ item: null, action: { roll: { type: "attack" } } }), "u");
  assert.match(skipped.skipped, /could not be found/);
  const broken = rollMessage({ item: sword });
  broken.system.targets = "not a list";
  assert.deepEqual(daggerheartRollEvent(broken, "u").targetUuids, []);
});

test("criticals and duality from the roll's own fields", () => {
  assert.equal(rollIsCritical({ isCritical: true }), true);
  assert.equal(rollIsCritical({ dHope: { total: 4 }, dFear: { total: 4 } }), true);
  assert.equal(rollIsCritical({ options: { roll: { result: { duality: 0 } } } }), true);
  assert.equal(rollIsCritical({ isCritical: false, d20: { total: 19 } }), false);
  assert.equal(rollIsCritical(null), false);
  assert.equal(dualityOf({ dHope: { total: 9 }, dFear: { total: 2 } }), "hope");
  assert.equal(dualityOf({ options: { roll: { result: { duality: -1 } } } }), "fear");
  assert.equal(dualityOf(null), null);
});

test("an ability used with no roll is a use event; an attack or spellcast action rides its roll message", () => {
  const bond = card("A Soldier's Bond", "blade", { level: 2, cardType: "ability" });
  const [action, config] = useHook({ item: bond });
  const e = daggerheartUseEvent(action, config, { sceneId: "s" });
  assert.equal(e.type, "use");
  assert.equal(e.item, bond);
  assert.equal(e.actor, hero);
  assert.equal(e.outcome, null);
  assert.equal(e.domain, "blade");
  assert.deepEqual(e.targetUuids, []);
  const [attack, rolled] = useHook({ item: sword, action: { name: "Attack", roll: { type: "attack" } }, config: { hasRoll: true } });
  assert.equal(daggerheartUseEvent(attack, rolled), null, "the attack roll message carries it");
  const [cast, castConfig] = useHook({ item: bond, action: { name: "Cast", roll: { type: "spellcast" } }, config: { hasRoll: true } });
  assert.equal(daggerheartUseEvent(cast, castConfig), null, "the spellcast roll message carries it");
  const [trait, traitConfig] = useHook({ item: bond, action: { name: "Act", roll: { type: "trait" } }, config: { hasRoll: true } });
  assert.equal(daggerheartUseEvent(trait, traitConfig).type, "use", "a trait roll is not an attack message: the use plays");
  const [standard, standardConfig] = useHook({ actor: orc, action: { name: "Roar", roll: { type: null } }, config: { targets: [target("p1")] } });
  const roar = daggerheartUseEvent(standard, standardConfig, { sceneId: "s" });
  assert.equal(roar.item, null);
  assert.equal(roar.itemName, "Roar");
  assert.deepEqual(roar.targetUuids, ["Scene.s.Token.p1"]);
  const [secret, secretConfig] = useHook({ item: bond, config: { selectedMessageMode: "gm" } });
  assert.match(daggerheartUseEvent(secret, secretConfig).skipped, /private roll/, "a player's private use plays nothing");
  assert.equal(daggerheartUseEvent(null, {}), null);
});

test("damage: physical by weapon family, magical by domain, magical wins, crit from the damage roll or the card's roll", () => {
  const physical = daggerheartDamage(rollMessage({ item: sword, damage: damageRoll() }));
  assert.equal(physical.type, "slashing");
  assert.equal(physical.dhType, "physical");
  assert.ok(physical.tokenIds.has("target"));
  assert.ok(physical.actorIds.has("target"));
  assert.equal(physical.sourceTokenId, "t");
  assert.equal(physical.attackKind, "melee");
  assert.equal(physical.itemUuid, sword.uuid);
  assert.equal(physical.itemName, "Longsword");
  assert.equal(physical.itemKind, "weapon");
  assert.equal(physical.weaponFamily, "blade");
  assert.equal(physical.synthetic, false);
  assert.equal(physical.crit, false);
  const magical = daggerheartDamage(rollMessage({ item: card("Dark Whispers", "midnight"), roll: dualityRoll({ type: "spellcast" }), damage: damageRoll({ types: ["physical", "magical"], critical: true }) }));
  assert.equal(magical.type, "void");
  assert.equal(magical.dhType, "magical");
  assert.equal(magical.domain, "midnight");
  assert.equal(magical.attackKind, "spell");
  assert.equal(magical.crit, true);
  const fromRoll = daggerheartDamage(rollMessage({ item: sword, roll: dualityRoll({ hope: 5, fear: 5 }), damage: damageRoll() }));
  assert.equal(fromRoll.crit, true, "matching dice make the card's damage critical");
  const json = daggerheartDamage(rollMessage({ item: sword, damage: JSON.stringify(damageRoll({ types: ["magical"] })) }));
  assert.equal(json.dhType, "magical", "raw source data stores the roll as JSON");
  assert.equal(daggerheartDamage(rollMessage({ item: sword })), null, "no damage rolled yet");
  assert.equal(daggerheartDamage(rollMessage({ item: sword, damage: damageRoll(), hasHealing: true })), null, "healing is not damage");
  const missed = daggerheartDamage(rollMessage({ item: sword, roll: dualityRoll({ hope: 2, fear: 1, modifier: 0 }), damage: damageRoll() }));
  assert.equal(missed.tokenIds.size, 0, "a missed target took no damage");
  const claws = daggerheartDamage(rollMessage({ type: "adversaryRoll", roll: adversaryRoll(), actor: orc, action: { name: "Claws", roll: { type: "attack" }, range: "melee", damage: { main: { type: new Set(["physical"]) } } }, damage: damageRoll({ types: [] }) }));
  assert.equal(claws.dhType, "physical", "the action's damage type when the roll has none");
  assert.equal(claws.synthetic, true);
  assert.equal(claws.actorUuid, "Actor.orc");
  assert.equal(claws.itemName, "Claws");
});

test("damage events: the roller's own, private ones skipped, nothing when every target was missed", () => {
  const e = daggerheartDamageEvent(rollMessage({ item: sword, damage: damageRoll() }), "u");
  assert.equal(e.type, "damage");
  assert.equal(e.id, "damage:roll1");
  assert.deepEqual(e.targetUuids, ["Scene.s.Token.target"]);
  assert.equal(e.damageType, "physical");
  assert.equal(e.weaponMode, "melee");
  assert.equal(daggerheartDamageEvent(rollMessage({ item: sword, damage: damageRoll() }), "other"), null);
  assert.match(daggerheartDamageEvent(rollMessage({ item: sword, damage: damageRoll(), whisper: ["gm"] }), "u").skipped, /private roll/);
  assert.equal(daggerheartDamageEvent(rollMessage({ item: sword }), "u"), null);
  assert.equal(daggerheartDamageEvent(rollMessage({ item: sword, roll: dualityRoll({ hope: 2, fear: 1, modifier: 0 }), damage: damageRoll() }), "u"), null);
  const direct = daggerheartDamageEvent(rollMessage({ type: "adversaryRoll", roll: null, hasRoll: false, item: sword, damage: damageRoll() }), "u");
  assert.deepEqual(direct.targetUuids, ["Scene.s.Token.target"], "direct damage with no roll reaches every target");
  assert.match(daggerheartDamageEvent(rollMessage({ item: null, action: null, damage: damageRoll() }), "u").skipped, /could not be found/);
});

test("attack kind: melee and very close weapons are melee, longer ranges ranged, spellcasts spells", () => {
  assert.equal(daggerheartAttackKind(rollMessage({ item: weapon("Spear", "veryClose") })), "melee");
  assert.equal(daggerheartAttackKind(rollMessage({ item: weapon("Shortbow", "far") })), "ranged");
  assert.equal(daggerheartAttackKind(rollMessage({ item: card("Blink Out", "arcana"), roll: dualityRoll({ type: "spellcast" }) })), "spell");
  assert.equal(daggerheartAttackKind(rollMessage({ actor: orc, action: { name: "Spit", roll: { type: "attack" }, range: "far" } })), "ranged");
  assert.equal(daggerheartAttackKind(rollMessage({ item: card("Bare Bones", "valor", { cardType: "ability" }), roll: dualityRoll({ type: "trait" }) })), "other");
});

test("weapon families by name, magical damage as a last resort, deterministic", () => {
  const cases = {
    Longsword: "blade", Dagger: "blade", Battleaxe: "blade", Katana: "blade", "Talon Blades": "blade", "Enchanted Chakram": "blade",
    Shortbow: "bow", "Hand Crossbow": "bow", "Gravity Arbalest": "bow", "Hand Sling": "bow",
    "Runelock Pistol": "firearm", Arquebus: "firearm", Blunderbuss: "firearm", Gunblade: "firearm", "Hand Cannon": "firearm",
    Wand: "magic", Greatstaff: "magic", "Mage Orb": "magic", "Glowing Rings": "magic", Scepter: "magic", "Focus Runes": "magic",
    Warhammer: "hammer", Mace: "hammer", "Rocket Maul": "hammer", "Double Flail": "hammer", "Brass Knuckles": "hammer",
    Spear: "spear", Halberd: "spear", Lance: "spear", Javelins: "spear", "War Dart": "spear", "Bec de Corbin": "spear",
    "Round Shield": "shield", "Rune Shield": "shield", Buckler: "shield",
    Whip: null, "Soul Chain": null, "Fighting Cloak": null,
  };
  for (const [name, family] of Object.entries(cases)) assert.equal(weaponFamily(name), family, name);
  assert.equal(weaponFamily("Eldritch Vambrace", ["magical"]), "magic");
  assert.equal(weaponFamily("Heavy Frame Wheelchair", ["physical"]), null);
  assert.equal(weaponFamily(undefined), null);
  assert.equal(dhDamageKind(["physical", "magical"]), "magical");
  assert.equal(dhDamageKind("physical"), "physical");
  assert.equal(dhDamageKind([]), null);
  assert.equal(DH_DOMAINS.length, 10);
});

test("damage types for finishers: physical by weapon family, magical by domain, with the spec's defaults", () => {
  const physical = { Longsword: "slashing", Battleaxe: "slashing", Shortbow: "piercing", "Hand Crossbow": "piercing", Spear: "piercing", "Runelock Pistol": "piercing",
    Warhammer: "bludgeoning", Mace: "bludgeoning", "Rocket Maul": "bludgeoning", "Round Shield": "bludgeoning", Whip: "slashing", Quarterstaff: "slashing" };
  for (const [name, type] of Object.entries(physical)) assert.equal(daggerheartDamageType({ type: "physical", item: { name } }), type, name);
  assert.equal(daggerheartDamageType({ type: "physical", itemName: "Claws" }), "slashing", "unknown → carved");
  const magical = { arcana: "force", midnight: "void", dread: "void", splendor: "vitality", grace: "vitality", sage: "poison", codex: "mental", bone: "bleed", blade: "slashing", valor: "slashing" };
  for (const [domain, type] of Object.entries(magical)) assert.equal(daggerheartDamageType({ type: "magical", item: { system: { domain } } }), type, domain);
  assert.equal(daggerheartDamageType({ type: "magical", item: { name: "Wand" } }), "force", "no domain → blown apart");
  assert.equal(daggerheartDamageType({ type: "magical", item: { system: { domain: "Homebrew" } } }), "force");
  assert.equal(daggerheartDamageType({ type: null }), null);
});

test("the roll type comes from system.action, since options.roll.type is overwritten with action or reaction", () => {
  const spell = card("Blink Out", "arcana");
  const msg = rollMessage({ item: spell, roll: dualityRoll({ type: "spellcast" }) });
  assert.equal(msg.rolls[0].options.roll.type, "action");
  assert.equal(msg.system.action.roll.type, "spellcast");
  assert.equal(daggerheartRollEvent(msg, "u").rollType, "spellcast");
  assert.equal(daggerheartAttackKind(msg), "spell");
  const reaction = rollMessage({ item: sword, action: { name: "Parry", roll: { type: "reaction" } } });
  assert.equal(daggerheartRollEvent(reaction, "u"), null);
});

test("a use event carries the token: the option, or the config message's speaker", () => {
  const [action, config] = useHook({ item: card("Bond", "blade", { cardType: "ability" }) });
  assert.equal(daggerheartUseEvent(action, config, { sceneId: "s", tokenId: "t9" }).tokenId, "t9");
  assert.equal(daggerheartUseEvent(action, { ...config, message: { speaker: { token: "t5" } } }, { sceneId: "s" }).tokenId, "t5");
});

test("a direct-damage message's DamageRoll is not read as the attack roll", () => {
  const msg = rollMessage({ type: "adversaryRoll", roll: null, hasRoll: false, item: sword, damage: damageRoll() });
  msg.rolls = [{ isCritical: true, total: 5, options: {} }];
  assert.equal(daggerheartDamage(msg).crit, false);
  assert.equal(daggerheartDamageEvent(msg, "u").crit, false);
});

test("resource-only damage (stress) is no damage event, healing still is", () => {
  assert.equal(daggerheartDamageEvent(rollMessage({ item: sword, damage: damageRoll({ types: ["stress"] }) }), "u"), null);
  const resourceOnly = rollMessage({ item: sword });
  resourceOnly.system.damage.resources = { stress: {} };
  assert.equal(daggerheartDamageEvent(resourceOnly, "u"), null);
  const heal = daggerheartDamageEvent(rollMessage({ item: sword, damage: damageRoll({ types: ["stress"] }), hasHealing: true }), "u");
  assert.equal(heal.healing, true);
});
