import test from "node:test";
import assert from "node:assert/strict";
import { twoeCatalogRecipe } from "../../scripts/systems/twoe-crossover.mjs";
import { findNpcAbility, npcAbilityRecipe, abilityName, breathElement, breathShape, NPC_ABILITY_IDS } from "../../scripts/catalogs/pf2e/npc-abilities.mjs";
import { BESPOKE } from "../../scripts/catalogs/bespoke/index.mjs";
import { BREATH_ELEMENTS } from "../../scripts/catalogs/bespoke/pf2e-npc-abilities.mjs";

const npc = { type: "npc" };
const action = (name, extra = {}) => ({ type: "action", name, actor: npc, system: { traits: { value: extra.traits ?? [] }, description: { value: extra.text ?? "" } } });
const event = (name, type = "use", extra = {}) => ({ type, systemId: "pf2e", item: action(name, extra), actor: npc, ...(extra.template ? { template: extra.template } : {}) });
const on = { enabled: true, scope: "all", independent: true };
const resolve = (ev, states = {}) => twoeCatalogRecipe("pf2e", ev, [], { customEnabled: false, stateFor: (kind) => (kind in states ? states[kind] : on) });

test("abilityName: frequency, variant and distance are not part of the name", () => {
  assert.equal(abilityName("Breath Weapon (Fire)"), "breath weapon");
  assert.equal(abilityName("Push 10 feet"), "push");
  assert.equal(abilityName("Grab (Jaws)"), "grab");
});

test("findNpcAbility: only an NPC's actions", () => {
  assert.equal(findNpcAbility(event("Improved Grab"))?.id, "grab");
  assert.equal(findNpcAbility(event("Swallow Whole (Large)"))?.id, "swallow");
  assert.equal(findNpcAbility({ ...event("Grab"), actor: { type: "character" }, item: { ...action("Grab"), actor: { type: "character" } } }), null);
  assert.equal(findNpcAbility({ ...event("Grab"), item: { ...action("Grab"), type: "melee" } }), null);
  assert.equal(findNpcAbility(event("Attack of Opportunity")), null, "a reaction's Strike animates on its own");
});

test("every NPC ability has a design, every breath element and shape too", () => {
  for (const id of NPC_ABILITY_IDS.filter((id) => id !== "breath")) assert.ok(BESPOKE[`pf2e:npc-${id}`], id);
  for (const element of BREATH_ELEMENTS) for (const shape of ["cone", "line"]) assert.ok(BESPOKE[`pf2e:npc-breath:${element}-${shape}`], `${element}-${shape}`);
});

test("an NPC's Grab, Constrict and Trample play their designs", () => {
  for (const [name, id] of [["Grab", "grab"], ["Greater Constrict", "constrict"], ["Trample", "trample"], ["Throw Rock", "throw-rock"], ["Turn to Mist", "mist"]]) {
    const r = resolve(event(name));
    assert.ok(r, `${name} animates`);
    assert.equal(r.bespoke, `pf2e:npc-${id}`, name);
    assert.equal(r.name, name);
    assert.ok(r.stages.length > 1, `${name} has its designed stages`);
  }
});

test("a single-target ability plays on the first target only", () => {
  const r = resolve(event("Grab"));
  assert.ok(r.stages.filter((s) => s.kind === "impact").every((s) => s.targetSelection === "first"));
});

test("Breath Weapon plays when its area is placed, in its element and shape", () => {
  assert.equal(resolve(event("Breath Weapon")), null, "posting the card alone does not breathe");
  const fire = resolve(event("Breath Weapon", "template", { traits: ["arcane", "fire"], template: { t: "cone" } }));
  assert.equal(fire.bespoke, "pf2e:npc-breath:fire-cone");
  const line = resolve(event("Breath Weapon", "template", { text: "@Template[line|distance:60] @Damage[8d6[electricity]]", template: { t: "ray" } }));
  assert.equal(line.bespoke, "pf2e:npc-breath:electricity-line");
  assert.equal(resolve(event("Chill Breath", "template", { template: { t: "cone" } })).bespoke, "pf2e:npc-breath:cold-cone");
});

test("breathElement and breathShape read traits, damage and the template", () => {
  assert.equal(breathElement(action("Breath Weapon", { traits: ["negative"] })), "void");
  assert.equal(breathElement(action("Breath Weapon", { text: "@Damage[6d6[acid]]" })), "acid");
  assert.equal(breathElement(action("Breath Weapon")), "other");
  assert.equal(breathShape(action("x", { text: "@Template[type:line|distance:30]" })), "line");
  assert.equal(breathShape(action("x"), { t: "cone" }), "cone");
});

test("the setting turns NPC abilities off", () => {
  assert.equal(resolve(event("Grab"), { npcAbility: false }), null);
});

test("your own recipe for an NPC ability plays instead; a paused one silences it", () => {
  const mine = (enabled) => [{ id: "mine", name: "My grab", enabled, trigger: "use", match: "Grab", stages: [{ stageId: "s", kind: "impact", label: "x", assets: ["jb2a.impact.009.orange"] }] }];
  assert.equal(npcAbilityRecipe(event("Grab"), mine(true))?.id, "mine");
  assert.equal(npcAbilityRecipe(event("Grab"), mine(false)), null);
});

test("a one-of-a-kind ability with an area plays its shape and energy when placed", () => {
  const blast = (text, t, traits) => resolve(event("Devastating Blast", "template", { text, traits, template: { t } }));
  assert.equal(blast("@Template[cone|distance:30] @Damage[(6d6+4)[fire]]", "cone").bespoke, "pf2e:npc-generic:cone-fire");
  assert.equal(blast("@Template[emanation|distance:10] @Damage[4d6[cold]]", "circle").bespoke, "pf2e:npc-generic:emanation-cold");
  assert.equal(blast("@Template[burst|distance:20]", "circle").bespoke, "pf2e:npc-generic:burst-physical");
  assert.equal(blast("", "ray", ["electricity"]).bespoke, "pf2e:npc-generic:line-electricity");
  assert.equal(resolve(event("Devastating Blast", "use", { text: "@Template[cone|distance:30]" })), null, "it waits for the area");
});

test("a one-of-a-kind ability that deals damage strikes its target", () => {
  const r = resolve(event("Telekinetic Assault", "use", { text: "@Damage[(2d10+8)[bludgeoning]] @Check[reflex]" }));
  assert.equal(r.bespoke, "pf2e:npc-generic:hit-physical");
  assert.equal(resolve(event("Drench", "use", { text: "@Damage[3d6[persistent,acid]]" })).bespoke, "pf2e:npc-generic:hit-acid");
});

test("with no area or damage, the ability's traits pick its look; Strikes and spellshapes are left alone", () => {
  assert.equal(resolve(event("Walk the Ethereal Line", "use", { traits: ["teleportation", "occult"] })).bespoke, "pf2e:npc-blink");
  assert.equal(resolve(event("Unnerving Prowess", "use", { traits: ["emotion", "mental"] })).bespoke, "pf2e:npc-fear");
  assert.equal(resolve(event("Steady Breathing", "use", { traits: ["concentrate"] })), null);
  assert.equal(resolve(event("Vengeful Strike", "use", { text: "@Damage[2d6[fire]]" })), null, "its Strike animates");
  assert.equal(resolve(event("Quickened Casting", "use", { traits: ["arcane", "spellshape"] })), null);
});

test("every one-of-a-kind design exists", () => {
  for (const shape of ["cone", "line", "burst", "emanation", "hit"]) for (const element of ["physical", "fire", "cold", "electricity", "acid", "poison", "void", "vitality", "force", "mental", "sonic", "spirit"])
    assert.ok(BESPOKE[`pf2e:npc-generic:${shape}-${element}`], `${shape}-${element}`);
  for (const id of ["blink", "heal", "magic", "sound"]) assert.ok(BESPOKE[`pf2e:npc-${id}`], id);
});

test("a longer name plays its ability's last keyword", () => {
  for (const [name, id] of [["Boar Charge", "charge"], ["Angle-Cutting Rush", "charge"], ["Burrowing Pounce", "pounce"], ["Thrashing Retreat", "dash"], ["Squirming Embrace", "grab"], ["Petrifying Stare", "gaze"]])
    assert.equal(findNpcAbility(event(name))?.id, id, name);
  assert.equal(findNpcAbility(event("Wicked Bite")), null, "a Strike's own name is not an ability word");
});

test("with the from-what-it-does switch off, only named abilities animate", () => {
  assert.equal(resolve(event("Telekinetic Assault", "use", { text: "@Damage[2d10[bludgeoning]]" }), { npcAbilityGuess: false }), null);
  assert.ok(resolve(event("Grab"), { npcAbilityGuess: false }));
});
