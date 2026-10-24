import test from "node:test";
import assert from "node:assert/strict";
import { daggerheartRollEvent, daggerheartUseEvent, daggerheartAttackKind, featureElement, featureFields, strikeMode } from "../../../scripts/systems/daggerheart.mjs";
import { AREA_LOOKS, FEATURE_SHAPES, findDhEntry, normalizeDhCatalogState, resolveDaggerheartAutomaticRecipe, useDhEntry, dhEntries } from "../../../scripts/catalogs/daggerheart/daggerheart-catalog.mjs";
import { validateRecipe } from "../../../scripts/core/model.mjs";
import { adversaryRoll, rollMessage, target, useHook } from "../../fixtures/daggerheart-messages.mjs";
import { iceDragon, rolledFeatures, firstAction } from "../../fixtures/daggerheart-adversaries.mjs";

const weaponsOn = (kind) => (kind === "weapon" ? { ...normalizeDhCatalogState(), enabled: true, scope: "all" } : normalizeDhCatalogState());
const allOff = () => normalizeDhCatalogState();
// A feature used without an attack roll: the daggerheart.postUseAction hook's (action, config).
const used = (feature) => {
  const [action, config] = useHook({ item: feature, actor: feature.actor, action: firstAction(feature), config: { targets: [target("pc")] } });
  return daggerheartUseEvent(action, config, { sceneId: "s" });
};
// A roll message as DHActorRoll gives it: source.item is the Item id, system.item its lookup on the actor.
const rolled = (feature) => daggerheartRollEvent(rollMessage({ type: "adversaryRoll", roll: adversaryRoll(), actor: feature.actor, item: feature, action: firstAction(feature) }), "u");

test("the Ice Dragon's standard attack: no Item on the real message, melee fallback by its natural-weapon name at Close", () => {
  // DHActorRoll.item is actionActor.items.get(source.item), and a standard attack's source.item is the
  // actor's own id (action.item is the Actor): no Item comes back. system.action is actor.system.attack.
  const msg = rollMessage({ type: "adversaryRoll", roll: adversaryRoll(), actor: iceDragon, action: iceDragon.system.attack });
  assert.equal(msg.system.source.item, iceDragon.id);
  msg.system.item = undefined;
  const e = daggerheartRollEvent(msg, "u");
  assert.equal(e.item, null);
  assert.equal(e.itemName, "Bite and Claws");
  assert.equal(e.rollType, "attack");
  assert.equal(e.weaponMode, "melee", "Close, but bite and claws strike in melee");
  assert.equal(daggerheartAttackKind(msg), "melee");
  assert.equal(findDhEntry(e).id, "daggerheart-weapon-generic-claws", "Bite and Claws rakes the target");
  const r = resolveDaggerheartAutomaticRecipe(e, weaponsOn, []);
  assert.equal(r.catalogEntry, "daggerheart-weapon-generic-claws");
  assert.equal(r.trigger, "attack");
});

test("Close attacks: natural weapons, limbs and lashes in melee; thrown, shot and blasted ones ranged", () => {
  for (const name of ["Bite and Claws", "Tail Swipe", "Tentacles", "Barbed Lash", "Great Scythe", "Fists of Iron", "Lava-Coated Claws"]) assert.equal(strikeMode("close", name), "melee", name);
  for (const name of ["Javelin", "Poisoned Throwing Dagger", "Needle-Sharp Arrows", "Energy Blast", "Bursts of Fire", "Spirit Flame", "Flash"]) assert.equal(strikeMode("close", name), "ranged", name);
  assert.equal(strikeMode("veryClose", "Bolt"), "melee");
  assert.equal(strikeMode("far", "Bite"), "ranged");
});

test("the Ice Dragon's feature attacks each play: breath, avalanche burst, and cold strikes", () => {
  // Frozen Scales only makes its attacker mark Stress, but names its element: a cold strike.
  const expect = { "Blizzard Breath": ["breath", "cold"], Avalanche: ["burst", "cold"], "Frozen Scales": ["strike", "cold"] };
  for (const [name, [shape, element]] of Object.entries(expect)) {
    const feature = iceDragon.features[name], e = used(feature);
    assert.equal(e.type, "use", name);
    assert.equal(e.item, feature, name);
    assert.equal(e.actionId, firstAction(feature)._id, name);
    assert.equal(e.featureShape, shape, name);
    assert.equal(e.featureElement, element, name);
    const r = resolveDaggerheartAutomaticRecipe(e, weaponsOn, []);
    assert.ok(r, `${name} plays`);
    assert.equal(r.catalogEntry, `daggerheart-weapon-feature-${element}`, name);
    assert.equal(r.id, `animater-daggerheart-weapon-feature-${element}-${shape}`, name);
    assert.equal(r.trigger, "use", name);
    assert.equal(resolveDaggerheartAutomaticRecipe(e, allOff, []), null, `${name}: the weapon catalog off plays nothing`);
  }
  const breath = resolveDaggerheartAutomaticRecipe(used(iceDragon.features["Blizzard Breath"]), weaponsOn, []);
  assert.ok(breath.stages.some((s) => s.kind === "travel" && s.assets.includes("jb2a.breath_weapons.cold.cone.blue")), "an icy cone to the targets");
  const avalanche = resolveDaggerheartAutomaticRecipe(used(iceDragon.features.Avalanche), weaponsOn, []);
  assert.ok(avalanche.stages.some((s) => s.kind === "cast" && s.assets.includes("jb2a.ice_spikes.radial.burst.white")), "ice bursts around the dragon");
});

test("feature actions that are not strikes get no strike shape: a spotlight, a Fear gain", () => {
  for (const name of ["Relentless (3)", "Momentum"]) {
    const e = used(iceDragon.features[name]);
    assert.equal(e.featureShape, undefined, name);
    assert.ok(findDhEntry(e)?.id.startsWith("daggerheart-weapon-utility-"), name);
  }
});

test("a feature's attack roll is its roll message's event and gets the weapon fallback by its range", () => {
  const expect = { "Tail Swipe": "unarmed", "Dive-Bomb": "ranged", "Leaping Strike": "ranged" };
  for (const [name, mode] of Object.entries(expect)) {
    const feature = rolledFeatures[name], e = rolled(feature);
    assert.equal(e.type, "attack", name);
    assert.equal(e.item, feature, name);
    assert.equal(e.rollType, "attack", name);
    const [action, config] = useHook({ item: feature, actor: feature.actor, action: firstAction(feature), config: { hasRoll: true } });
    assert.equal(daggerheartUseEvent(action, config), null, `${name}: no second event from the use`);
    const r = resolveDaggerheartAutomaticRecipe(e, weaponsOn, []);
    assert.equal(r.catalogEntry, `daggerheart-weapon-generic-${mode}`, name);
    assert.equal(r.trigger, "attack", name);
  }
});

test("save-based feature messages carry no roll event: the use plays once", () => {
  const breath = iceDragon.features["Blizzard Breath"];
  assert.equal(rolled(breath), null, "a save has no attack or spellcast roll type");
});

test("your recipe by the feature's name wins; excluding the element fallback silences it", () => {
  const e = used(iceDragon.features["Blizzard Breath"]);
  const mine = validateRecipe({ id: "mine", name: "Mine", trigger: "use", match: "Blizzard Breath", stages: [{ kind: "cast", assets: ["jb2a.impact.001.orange"] }] });
  assert.equal(resolveDaggerheartAutomaticRecipe(e, weaponsOn, [mine]).id, "mine");
  const excluded = (kind) => (kind === "weapon" ? { ...weaponsOn(kind), excluded: ["daggerheart-weapon-feature-cold"] } : allOff());
  assert.equal(resolveDaggerheartAutomaticRecipe(e, excluded, []), null);
  const picked = (kind) => (kind === "weapon" ? useDhEntry({}, "daggerheart-weapon-feature-cold") : allOff());
  assert.equal(resolveDaggerheartAutomaticRecipe(e, picked, []).catalogEntry, "daggerheart-weapon-feature-cold");
});

test("feature elements: the feature's own words first, then its damage type", () => {
  assert.equal(featureElement(["Blizzard Breath"], ["magical"]), "cold");
  assert.equal(featureElement(["Searing Breath", "", "a gout of flame"], ["magical"]), "fire");
  assert.equal(featureElement(["Breath", "", "exhales a bolt of lightning, then frost"], ["magical"]), "lightning", "the first element named");
  assert.equal(featureElement(["Spit", "", "corrosive acid"], ["physical"]), "acid");
  assert.equal(featureElement(["Spore Cloud"], []), "poison");
  assert.equal(featureElement(["Shockwave"], ["physical"]), "physical");
  assert.equal(featureElement(["Arcane Blast"], ["magical"]), "arcane");
  assert.equal(featureElement(["Crush"], ["physical"]), "physical");
  assert.deepEqual(featureFields({ type: "weapon" }, { type: "attack" }), {}, "only features");
  assert.deepEqual(featureFields({ type: "feature", name: "Spit Acid" }, { type: "attack", range: "far", roll: { type: null }, save: { trait: "agility" } }), { featureShape: "breath", featureElement: "acid" },
    "ranged with no area breathes at its targets");
});

test("every feature fallback has a use variant per shape and, with a bolt, an attack variant per range", () => {
  const entries = dhEntries("weapon").filter((e) => e.id.startsWith("daggerheart-weapon-feature-"));
  assert.deepEqual(entries.map((e) => e.element).sort(), Object.keys(AREA_LOOKS).sort());
  for (const entry of entries) {
    assert.equal(entry.generic, true);
    const uses = entry.variants.filter((v) => v.recipe.trigger === "use"), attacks = entry.variants.filter((v) => v.recipe.trigger === "attack");
    assert.deepEqual(uses.map((v) => v.featureShape), [...FEATURE_SHAPES]);
    assert.deepEqual(attacks.map((v) => v.weaponMode), AREA_LOOKS[entry.element].bolt ? ["ranged", "melee"] : [], entry.element);
    for (const v of entry.variants) validateRecipe(v.recipe);
  }
  const fire = dhEntries("weapon").find((e) => e.id === "daggerheart-weapon-feature-fire");
  const bolt = fire.variants.find((v) => v.weaponMode === "ranged").recipe;
  assert.ok(bolt.stages.some((s) => s.kind === "travel" && s.assets[0] === "jb2a.fire_bolt.orange"), "a fire bolt flies to the target");
});

test("a feature's attack roll strikes as its element; a physical one keeps the weapon fallback", () => {
  const actor = { id: "adv", uuid: "Actor.adv", documentName: "Actor", name: "Adversary", type: "adversary" };
  const roll = (name, description, range, damage) => {
    const action = { _id: `${name}-a`, type: "attack", name: "Attack", range, roll: { type: "attack" }, save: { trait: null }, areas: [], damage: { main: { type: new Set(damage) }, resources: {} } };
    const item = { id: name, uuid: `Actor.adv.Item.${name}`, documentName: "Item", type: "feature", name, actor, system: { description, actions: new Map([[action._id, action]]) } };
    return daggerheartRollEvent(rollMessage({ type: "adversaryRoll", roll: adversaryRoll(), actor, item, action }), "u");
  };
  const cases = [
    ["Spit Acid", "<p>spits a glob of acid</p>", "far", ["physical"], "acid", "ranged"],
    ["Tentacle Rays", "<p>corrosive beams</p>", "far", ["magical"], "acid", "ranged"],
    ["Lightning Strike", "", "far", ["magical"], "lightning", "ranged"],
    ["Chill Touch", "", "melee", ["magical"], "cold", "melee"],
    ["Venomous Bite", "<p>its venom burns</p>", "melee", ["physical"], "poison", "melee"],
  ];
  for (const [name, text, range, damage, element, mode] of cases) {
    const e = roll(name, text, range, damage);
    assert.equal(findDhEntry(e)?.id, `daggerheart-weapon-feature-${element}`, name);
    const r = resolveDaggerheartAutomaticRecipe(e, weaponsOn, []);
    assert.equal(r.id, `animater-daggerheart-weapon-feature-${element}-attack-${mode}`, name);
    assert.equal(r.trigger, "attack", name);
  }
  assert.equal(findDhEntry(roll("Arcane Lash", "", "far", ["magical"])).id, "daggerheart-weapon-feature-arcane", "magic with no element: a magic bolt");
  assert.equal(findDhEntry(roll("Gore", "", "melee", ["physical"])).id, "daggerheart-weapon-generic-unarmed", "physical keeps the weapon fallback");
});

test("an adversary's standard attack the library does not know strikes as the weapon it names, or by its damage", () => {
  const attack = (name, range, damage) => {
    const action = { _id: "std", type: "attack", name, range, roll: { type: "attack" }, save: { trait: null }, damage: { main: { type: new Set([damage]) }, resources: {} } };
    const msg = rollMessage({ type: "adversaryRoll", roll: adversaryRoll(), actor: iceDragon, action });
    msg.system.item = undefined;
    return daggerheartRollEvent(msg, "u");
  };
  const cases = [
    ["Greataxe", "veryClose", "physical", "axe"], ["Daggers", "melee", "physical", "dagger"], ["Claymore", "veryClose", "physical", "sword"],
    ["Warclub", "melee", "physical", "club"], ["Spiked Mace", "veryClose", "physical", "mace"], ["Maul", "veryClose", "physical", "maul"],
    ["Spears", "veryClose", "physical", "spear"], ["Javelin", "close", "physical", "javelin"], ["Recurved Bow", "far", "physical", "bow"],
    ["Needle-Sharp Arrows", "close", "physical", "bow"], ["Magitech Cannon", "far", "magical", "firearm"], ["Corrupted Staff", "far", "magical", "staff-ranged"],
    ["Great Scythe", "close", "physical", "scythe"], ["Chomp", "melee", "physical", "bite"], ["Hooves", "veryClose", "physical", "unarmed"],
    ["Swipe", "melee", "physical", "melee"], ["Thrown Object", "far", "physical", "ranged"],
  ];
  for (const [name, range, damage, fallback] of cases) {
    const e = attack(name, range, damage);
    assert.equal(e.damageKind, damage, name);
    assert.equal(findDhEntry(e)?.id, `daggerheart-weapon-generic-${fallback}`, name);
    assert.ok(resolveDaggerheartAutomaticRecipe(e, weaponsOn, []), `${name} plays`);
  }
  const magic = { "Fire Bolt": ["veryFar", "fire"], "Spirit Flame": ["close", "fire"], "Lightning Bolt": ["far", "lightning"], "Chill Touch": ["melee", "cold"],
    "Psychic Strike": ["far", "arcane"], "Necrotic Blast": ["far", "arcane"] };
  for (const [name, [range, element]] of Object.entries(magic)) {
    const e = attack(name, range, "magical"), r = resolveDaggerheartAutomaticRecipe(e, weaponsOn, []);
    assert.equal(r.catalogEntry, `daggerheart-weapon-feature-${element}`, name);
    assert.ok(!r.stages.some((s) => s.assets?.some((a) => /^jb2a\.arrow\.|melee_generic/.test(a))), `${name}: no arrow or plain slash`);
  }
  const greataxe = resolveDaggerheartAutomaticRecipe(attack("Greataxe", "veryClose", "physical"), weaponsOn, []);
  assert.ok(greataxe.stages.some((s) => s.assets?.[0] === "jb2a.greataxe.melee.standard.white"), "a greataxe cleaves");
  const mine = validateRecipe({ id: "mine", name: "Mine", trigger: "attack", match: "Greataxe", stages: [{ kind: "cast", assets: ["jb2a.impact.001.orange"] }] });
  assert.equal(resolveDaggerheartAutomaticRecipe(attack("Greataxe", "veryClose", "physical"), weaponsOn, [mine]).id, "mine", "your recipe still wins");
});

test("summon, countdown, transform and evolution actions play their look; a grouped action leaves it to the action it picks", () => {
  const actor = { id: "adv", uuid: "Actor.adv", documentName: "Actor", name: "Adversary", type: "adversary" };
  const looks = { Reinforcements: ["summon", "summon"], "Accursed Caress": ["countdown", "countdown"], "Final Transformation": ["transform", "transform"], "Hellwing": ["evolution", "transform"] };
  for (const [name, [type, look]] of Object.entries(looks)) {
    const item = utilityItem("feature", name, { _id: name, type, name: "Use", cost: [{ key: "fear", value: 1 }] });
    item.actor = actor;
    const e = useOf(item);
    assert.equal(e.utilityLook, look, name);
    const r = resolveDaggerheartAutomaticRecipe(e, weaponsOn, []);
    assert.equal(r?.catalogEntry, `daggerheart-weapon-utility-${look}`, name);
    assert.equal(r.trigger, "use", name);
  }
  const summon = resolveDaggerheartAutomaticRecipe(useOf(utilityItem("feature", "Reinforcements", { _id: "s", type: "summon", name: "Spend Fear" })), weaponsOn, []);
  assert.ok(summon.stages.some((s) => s.below && s.assets[0].includes("conjuration")), "a summoning circle under the adversary");
  const breath = { _id: "b", type: "attack", name: "Fire", range: "close", roll: { type: null }, save: { trait: "agility" }, areas: [], damage: { main: { type: new Set(["magical"]) }, resources: {} } };
  const grouped = { _id: "g", type: "grouped", name: "Mark Stress", grouped: { selectionType: "selected", groupedActions: ["b"] } };
  const item = { ...utilityItem("feature", "Elemental Breath", grouped), system: { actions: new Map([["g", grouped], ["b", breath]]) } };
  assert.equal(useOf(item), null, "the chosen breath plays on its own use");
});

test("a Stress, Hope or Armor loss with no blow plays dread or a sundering, not a physical strike", async () => {
  const { resourceLoss } = await import("../../../scripts/systems/daggerheart.mjs");
  const loss = (name, resources, extra = {}) => utilityItem("feature", name, { _id: name, type: "damage", name: "Damage", range: "", damage: { main: null, resources: Object.fromEntries(resources.map((r) => [r, { applyTo: r }])) }, ...extra });
  const cases = [[loss("Terrifying", ["hope"]), "dread"], [loss("Scare Tactic", ["stress"]), "dread"], [loss("Armor-Shredding Shards", ["armor"]), "sunder"], [iceDragon.features["Rend and Crush"], "dread"]];
  for (const [item, look] of cases) {
    const e = useOf(item);
    assert.equal(e.featureShape, undefined, item.name);
    assert.equal(findDhEntry(e)?.id, `daggerheart-weapon-utility-${look}`, item.name);
  }
  assert.equal(findDhEntry(useOf(loss("Acidic Form", ["armor"]))).id, "daggerheart-weapon-feature-acid", "an element it names still plays");
  assert.equal(resourceLoss({ type: "damage", damage: { main: null, resources: { hitPoints: { applyTo: "hitPoints" } } } }), null, "hit points are a blow");
  assert.equal(resourceLoss({ type: "damage", save: { trait: "agility" }, damage: { main: null, resources: { stress: { applyTo: "stress" } } } }), null, "a save keeps its shape");
});

// Actions that only heal, gain a resource or apply an effect: no attack, no damage type.
const utilityItem = (type, name, action) => ({ id: name, uuid: `Actor.pc.Item.${name}`, documentName: "Item", type, name, actor: { id: "pc", type: "character" }, system: { actions: new Map([[action._id, action]]) } });
const useOf = (item) => { const [a, c] = useHook({ item, actor: item.actor, action: firstAction(item), config: { targets: [] } }); return daggerheartUseEvent(a, c, { sceneId: "s" }); };
test("heal, Hope, Fear and effect actions play a look by what they restore or spend", async () => {
  const { utilityFields } = await import("../../../scripts/systems/daggerheart.mjs");
  const heal = { _id: "h", type: "healing", name: "Drink", damage: { main: null, resources: { hitPoints: { applyTo: "hitPoints" } } }, cost: [{ key: "quantity", value: 1 }] };
  const cases = [
    [utilityItem("consumable", "Minor Health Potion", heal), "heal"],
    [utilityItem("feature", "Hardy", { ...heal, _id: "hardy", name: "Healing" }), "heal"],
    [utilityItem("feature", "Inspire", { _id: "i", type: "healing", name: "Gain Hope", damage: { main: null, resources: { hope: { applyTo: "hope" } } } }), "hope"],
    [iceDragon.features.Momentum, "fear"],
    [iceDragon.features["Relentless (3)"], "boon"],
    [utilityItem("feature", "Relentless (3)", { _id: "r", type: "effect", name: "Spotlight", cost: [{ key: "fear", value: 1 }] }), "fear"],
    [utilityItem("feature", "No Mercy", { _id: "n", type: "effect", name: "Spend Hope", cost: [{ key: "hope", value: 3 }] }), "hope"],
    [utilityItem("feature", "Retract", { _id: "t", type: "effect", name: "Mark Stress", cost: [{ key: "stress", value: 1 }] }), "boon"],
  ];
  for (const [item, look] of cases) {
    assert.equal(utilityFields(item, firstAction(item)).utilityLook, look, item.name);
    const e = useOf(item);
    assert.equal(findDhEntry(e)?.id, `daggerheart-weapon-utility-${look}`, item.name);
    const r = resolveDaggerheartAutomaticRecipe(e, weaponsOn, []);
    assert.equal(r?.catalogEntry, `daggerheart-weapon-utility-${look}`, item.name);
    assert.equal(r.trigger, "use");
    assert.equal(resolveDaggerheartAutomaticRecipe(e, allOff, []), null, "the weapon catalog switch governs them");
  }
  // Domain cards and weapons keep their own animations; attacks and damage are not utilities.
  assert.deepEqual(utilityFields(utilityItem("domainCard", "Whirlwind", { _id: "w", type: "effect", cost: [{ key: "hope" }] }), { _id: "w", type: "effect" }), {});
  assert.deepEqual(utilityFields(utilityItem("feature", "Claws", { _id: "c", type: "attack", roll: { type: "attack" }, damage: { main: { type: new Set(["physical"]) } } }), { _id: "c", type: "attack", roll: { type: "attack" }, damage: { main: { type: new Set(["physical"]) } } }), {});
  // A feature's own element look still wins over a utility look.
  assert.equal(findDhEntry(used(iceDragon.features["Blizzard Breath"])).id, "daggerheart-weapon-feature-cold");
});

test("a damage card from a feature, potion or other non-weapon item stays quiet: its use already played", async () => {
  const { daggerheartDamageEvent } = await import("../../../scripts/systems/daggerheart.mjs");
  const { damageRoll } = await import("../../fixtures/daggerheart-messages.mjs");
  const splash = rolledFeatures["Tail Swipe"];
  const msg = rollMessage({ type: "adversaryRoll", roll: null, hasRoll: false, actor: splash.actor, item: splash, action: firstAction(splash), damage: damageRoll() });
  assert.equal(daggerheartDamageEvent(msg, "u"), null);
});
