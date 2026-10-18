import test from "node:test";
import assert from "node:assert/strict";
import { resolveAutomaticWeaponRecipe, standardWeapon } from "../../../../scripts/catalogs/pf2e/weapons/weapon-catalog.mjs";
import { PF2E_ACTION_CATALOG, PF2E_ACTIONS } from "../../../../scripts/catalogs/pf2e/ability-catalog.mjs";
import { applyEventElement } from "../../../../scripts/catalogs/shared/element-choice.mjs";

const on = { enabled: true, scope: "all", independent: true };
const attack = (item, weaponMode) => resolveAutomaticWeaponRecipe({ type: "attack", systemId: "pf2e", item, weaponMode }, on, [], { customEnabled: false });

test("a weapon the catalog does not know plays its group's standard weapon, named as itself", () => {
  const fist = { type: "weapon", name: "Fist", slug: "basic-unarmed", category: "unarmed", system: { slug: "basic-unarmed", category: "unarmed", group: "brawling" } };
  const r = attack(fist, "melee");
  assert.ok(r, "a plain fist animates");
  assert.equal(r.name, "Fist · melee", "the Activity row names the attacker's own weapon");
  assert.match(r.id, /^pf2e-weapon-group-brawling-melee$/);
  assert.equal(standardWeapon({ system: { group: "sword" } }, "melee").slug, "longsword");
  assert.equal(standardWeapon({ system: { group: "bow" } }, "ranged").slug, "longbow");
  assert.equal(attack({ type: "weapon", name: "Moonblade of Ys", system: { slug: "moonblade-of-ys", group: "sword" } }, "melee")?.name, "Moonblade of Ys · melee", "homebrew swords swing like a longsword");
  assert.equal(standardWeapon({ system: { group: "spear" } }, "thrown").slug, "spear", "a group's standard in the mode used");
  assert.equal(attack({ type: "weapon", name: "Mystery", system: {} }, "melee"), null, "no group, no guess");
  assert.equal(resolveAutomaticWeaponRecipe({ type: "attack", systemId: "pf2e", item: fist, weaponMode: "melee" }, { enabled: false }, [], { customEnabled: false }), null, "the weapon catalog switch governs it");
});

test("a thrown weapon reported as ranged (or the reverse) still plays its throw", () => {
  const javelin = { type: "weapon", name: "Javelin", slug: "javelin", system: { slug: "javelin", group: "dart" } };
  assert.equal(attack(javelin, "ranged")?.name, "Javelin · thrown");
  assert.equal(attack(javelin, "thrown")?.name, "Javelin · thrown");
  assert.equal(attack({ type: "weapon", name: "Greatsword", slug: "greatsword", system: { slug: "greatsword" } }, "melee")?.name, "Greatsword · melee", "known weapons are unchanged");
});

test("Elemental Blast plays on its attack roll, in the blast's element", () => {
  const blast = PF2E_ACTIONS.find((e) => e.slug === "elemental-blast");
  assert.equal(blast.trigger, "attack");
  const item = { type: "action", name: "Elemental Blast", slug: "elemental-blast", system: { slug: "elemental-blast" } };
  const r = PF2E_ACTION_CATALOG.resolveAutomaticRecipe({ type: "attack", systemId: "pf2e", item }, on, [], { customEnabled: false });
  assert.equal(r?.trigger, "attack");
  assert.equal(r.elementChoice, true);
  const fire = applyEventElement(r, "fire");
  assert.ok(fire.stages.some((s) => s.tint === "#ff9a4d"), "fire blasts burn orange");
  assert.ok(applyEventElement(r, "water").stages.some((s) => s.tint === "#87d6ee"), "water blasts run blue");
});

test("a melee Elemental Blast strikes up close; a ranged one flies, each in its element", async () => {
  const { twoeEvent } = await import("../../../../scripts/systems/adapters.mjs");
  const item = { type: "action", name: "Elemental Blast", slug: "elemental-blast", system: { slug: "elemental-blast" } };
  // PF2e's ElementalBlast#attack adds these roll options (self:action:melee, melee, item:melee); the element is a trait.
  const message = (mode) => ({ id: `m-${mode}`, author: { id: "u" }, isRoll: true, item, speaker: {}, actor: {},
    flags: { pf2e: { context: { type: "attack-roll", options: ["action:elemental-blast", `self:action:${mode}`, mode, `item:${mode}`, "item:trait:fire", "item:trait:impulse"] }, origin: { uuid: "Actor.a.Item.b" } } } });
  const melee = twoeEvent(message("melee"), "u"), ranged = twoeEvent(message("ranged"), "u");
  assert.equal(melee.weaponMode, "melee");
  assert.equal(ranged.weaponMode, "ranged");
  assert.equal(melee.element, "fire", "the element trait colours the blast");
  const resolve = (event) => applyEventElement(PF2E_ACTION_CATALOG.resolveAutomaticRecipe(event, on, [], { customEnabled: false }), event.element);
  const up = resolve(melee), far = resolve(ranged);
  const shows = (r) => r.stages.map((s) => s.kind === "motion" ? `${s.subject}:${s.motion}` : `${s.kind}:${s.assets?.[0] ?? ""}`);
  assert.ok(shows(up).includes("source:lunge") && !shows(up).includes("source:throw"), "melee: the kineticist lunges");
  assert.ok(shows(up).some((x) => x.startsWith("travel:jb2a.unarmed_strike.magical.")), "melee: an elemental strike reaches the target");
  assert.ok(shows(far).includes("source:throw") && shows(far).some((x) => x.startsWith("travel:") && !x.includes("unarmed_strike")), "ranged: thrown and flown");
  assert.notEqual(up.id, far.id, "each has its own id");
  assert.ok(up.stages.some((s) => s.kind === "travel" && s.tint === "#ff9a4d"), "melee: the strike burns fire-orange");
  assert.ok(far.stages.some((s) => s.kind === "travel" && /fire/.test(s.assets[0])), "ranged: the element's own projectile (a fire bolt)");
});

test("each Elemental Blast element flies for its own clip's length and lands when its projectile arrives", async () => {
  const { timedStages } = await import("../../../../scripts/engines/playback/composition.mjs");
  const blast = PF2E_ACTIONS.find((e) => e.slug === "elemental-blast");
  const base = PF2E_ACTION_CATALOG.recipe(blast, on);
  const timing = (element) => {
    const r = applyEventElement(base, element), stages = timedStages(r);
    const flight = stages.find((s) => s.stageId === "eb"), hit = stages.find((s) => s.kind === "impact");
    return { duration: flight.duration, lands: hit.delay - flight.delay, oneShot: flight.oneShot === true };
  };
  // Measured on the 30 ft JB2A clips: wood's leaves stream for 4.5 s and reach the target at 1.3 s.
  // Sequencer picks the clip by distance (wood: 3.5 s at 5 ft to 5.5 s at 90 ft): the flight lasts as long as the
  // longest and plays once, so a shorter one ends instead of looping back to its start after the hit.
  assert.deepEqual(timing("wood"), { duration: 5550, lands: 1300, oneShot: true }, "wood is neither cut off nor replayed");
  assert.equal(timing("earth").duration, 3300);
  assert.equal(applyEventElement(base, null).stages.find((s) => s.stageId === "eb").oneShot, true, "the default projectile plays once too");
  assert.equal(timing("earth").lands, 1400, "the boulder lands when it lands, not half a second early");
  assert.equal(timing("fire").lands, 550);
  for (const element of ["fire", "cold", "electricity", "air", "earth", "metal", "water", "wood"]) {
    const t = timing(element);
    assert.ok(t.lands < t.duration, `${element}: lands within its flight`);
  }
});
