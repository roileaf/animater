import test from "node:test";
import assert from "node:assert/strict";
import { twoeCatalogRecipe } from "../../scripts/systems/twoe-crossover.mjs";
import { findCatalogWeapon, PF2E_WEAPONS, filterWeapons } from "../../scripts/catalogs/pf2e/weapons/weapon-catalog.mjs";

const on = { enabled: true, scope: "all", independent: true };
const resolve = (item, weaponMode = "melee") =>
  twoeCatalogRecipe("pf2e", { type: "attack", systemId: "pf2e", item, weaponMode }, [], { customEnabled: false, stateFor: () => on });

test("an NPC Strike (a melee item) plays its weapon's catalog animation", () => {
  const mace = { type: "melee", name: "Light Mace", system: { slug: null, traits: { value: ["agile", "finesse", "shove"] } } };
  assert.equal(findCatalogWeapon({ type: "attack", item: mace })?.slug, "light-mace");
  const r = resolve(mace);
  assert.ok(r, "the NPC's light mace animates");
  assert.equal(r.trigger, "attack");
});

test("an NPC Strike linked to a carried weapon plays that weapon", () => {
  const sword = { type: "weapon", name: "Longsword", system: { slug: "longsword", group: "sword" } };
  const strike = { type: "melee", name: "Ancestral Blade", linkedWeapon: sword, system: { traits: { value: [] } } };
  assert.equal(findCatalogWeapon({ type: "attack", item: strike })?.slug, "longsword");
});

test("an NPC attack no catalog knows is not guessed", () => {
  assert.equal(findCatalogWeapon({ type: "attack", item: { type: "melee", name: "Crushing Grip", system: { traits: { value: ["unarmed"] } } } }), null);
  assert.equal(findCatalogWeapon({ type: "attack", item: { type: "melee", name: "Spiked Tail", system: { traits: { value: [] } } } }), null, "only exact names");
});

test("an NPC Fist punches like a PC's fist, named as itself", () => {
  const fist = { type: "melee", name: "Fist", system: { slug: "fist", traits: { value: ["agile", "nonlethal", "unarmed"] } } };
  const r = resolve(fist);
  assert.ok(r, "the NPC's fist animates");
  assert.equal(r.name, "Fist · melee");
  assert.match(r.id, /^pf2e-weapon-group-brawling-melee$/);
});

test("an NPC Strike linked to a homebrew weapon plays that weapon's group", () => {
  const blade = { type: "weapon", name: "Moonblade of Ys", system: { slug: "moonblade-of-ys", group: "sword" } };
  assert.equal(resolve({ type: "melee", name: "Moonblade of Ys", linkedWeapon: blade, system: { traits: { value: [] } } })?.name, "Moonblade of Ys · melee");
});

const npc = (name, ...types) => ({ type: "melee", name, system: { traits: { value: ["unarmed"] }, damageRolls: Object.fromEntries(types.map((damageType, i) => [`r${i}`, { damage: "1d6", damageType }])) } });
const contact = (r) => r.stages.find((s) => s.stageId.endsWith("-contact"));

test("natural attacks play bites, claws and blows by their exact name", () => {
  for (const [name, family] of [["Jaws", "bite"], ["Bite", "bite"], ["Fangs", "bite"], ["Beak", "bite"], ["Mandibles", "bite"], ["Claw", "claw"], ["Talon", "claw"], ["Rake", "claw"], ["Tail", "blow"], ["Tentacle", "blow"], ["Horn", "blow"], ["Slam", "blow"], ["Hoof", "blow"], ["Wing", "blow"], ["Stinger", "blow"]]) {
    const r = resolve(npc(name, "piercing"));
    assert.ok(r, `${name} animates`);
    assert.equal(r.name, `${name} · melee`);
    assert.match(contact(r).assets[0], { bite: /^jb2a\.bite\./, claw: /^jb2a\.claws\./, blow: /^jb2a\.unarmed_strike\./ }[family], name);
  }
});

test("a natural attack's colour follows its damage type", () => {
  assert.match(contact(resolve(npc("Jaws", "piercing"))).assets[0], /\.red$/);
  const fire = resolve(npc("Jaws", "piercing", "fire"));
  assert.match(contact(fire).assets[0], /\.orange$/);
  assert.ok(fire.stages.some((s) => /fire finish/.test(s.label)), "an energy finish rides the bite");
  assert.match(contact(resolve(npc("Claw", "slashing", "poison"))).assets[0], /\.bright_green$/);
  assert.match(contact(resolve(npc("Tail", "bludgeoning", "cold"))).assets[0], /\.blue$/);
  assert.match(contact(resolve(npc("Jaws", "void"))).assets[0], /\.purple$/);
});

test("a PC's unarmed Jaws (an ancestry attack) bites too", () => {
  const jaws = { type: "weapon", name: "Jaws", system: { slug: "jaws", category: "unarmed", group: "brawling", damage: { damageType: "piercing" } } };
  assert.match(contact(resolve(jaws)).assets[0], /^jb2a\.bite\..*\.red$/);
});

test("natural attacks are listed on the weapons page", () => {
  const natural = PF2E_WEAPONS.filter((w) => w.group === "natural");
  assert.equal(natural.length, 15);
  assert.ok(filterWeapons({ group: "natural", search: "jaws" }).length === 1);
});
