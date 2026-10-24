import test from "node:test";
import assert from "node:assert/strict";
import { twoeCatalogRecipe, twoeSettingKey } from "../../scripts/systems/twoe-crossover.mjs";
import { findSfEntry } from "../../scripts/catalogs/sf2e/sf2e-catalog.mjs";

const ON = { enabled: true, scope: "all", independent: true };
const npc = { type: "npc" };
const strike = (name, ...types) => ({ type: "melee", name, actor: npc, system: { traits: { value: [] }, damageRolls: Object.fromEntries(types.map((damageType, i) => [i, { damageType }])) } });
const action = (name, text = "") => ({ type: "action", name, actor: npc, system: { traits: { value: [] }, description: { value: text } } });
const resolve = (item, type, extra = {}, states = {}) => twoeCatalogRecipe("sf2e", { type, systemId: "sf2e", item, actor: npc, ...extra }, [], { customEnabled: false, stateFor: (kind) => (kind in states ? states[kind] : ON) });

test("an SF2e NPC's gun or blade plays the SF2e weapon of its name", () => {
  assert.match(resolve(strike("Laser Rifle", "fire"), "attack", { weaponMode: "ranged" }).id, /^sf2e-weapon-.*-ranged$/);
  assert.match(resolve(strike("Phase Cutlass", "slashing"), "attack", { weaponMode: "melee" }).id, /^sf2e-weapon-.*-melee$/);
  assert.equal(findSfEntry({ systemId: "sf2e", item: strike("Laser Pistol") })?.kind, "weapon");
});

test("an SF2e NPC's plain grenade is the catalog's lowest grade, thrown", () => {
  assert.equal(findSfEntry({ systemId: "sf2e", item: strike("Frag Grenade") })?.name, "Frag Grenade (Commercial)");
  assert.match(resolve(strike("Frag Grenade", "piercing"), "attack", { weaponMode: "ranged" }).id, /^sf2e-weapon-.*-thrown$/);
});

test("an SF2e NPC's natural attacks and guessed Strikes play without crossover", () => {
  assert.equal(resolve(strike("Jaws", "piercing"), "attack", { weaponMode: "melee" }).id, "pf2e-weapon-natural-jaws-melee");
  assert.ok(resolve(strike("Crushing Grip", "bludgeoning"), "attack", { weaponMode: "melee" }));
  assert.equal(resolve(strike("Jaws", "piercing"), "attack", { weaponMode: "melee" }, { weapon: { enabled: false } }), null, "the SF2e weapon catalog's switch holds");
});

test("an SF2e NPC's monster abilities use the NPC ability catalog", () => {
  assert.equal(resolve(action("Grab"), "use").bespoke, "pf2e:npc-grab");
  assert.equal(resolve(action("Radiation Breath", "@Template[cone|distance:30] @Damage[6d6[fire]]"), "template", { template: { t: "cone" } }).bespoke, "pf2e:npc-breath:fire-cone");
  assert.equal(resolve(action("Grab"), "use", {}, { npcAbility: false }), null);
  assert.equal(resolve(action("Akashic Barrage", "@Damage[4d6[force]]"), "use", {}, { npcAbilityGuess: false }), null);
});

test("a PC's items in SF2e keep to the SF2e catalog", () => {
  const pc = { type: "character" };
  assert.equal(twoeCatalogRecipe("sf2e", { type: "use", systemId: "sf2e", item: { ...action("Grab"), actor: pc }, actor: pc }, [], { customEnabled: false, stateFor: () => ON }), null);
});

test("the NPC switches are the same settings in SF2e worlds", () => {
  assert.equal(twoeSettingKey("sf2e", "npcAbility"), "npcAbilities");
  assert.equal(twoeSettingKey("sf2e", "npcAbilityGuess"), "npcAbilityGuess");
  assert.equal(twoeSettingKey("sf2e", "weapon"), "sf2eWeaponCatalog");
});
