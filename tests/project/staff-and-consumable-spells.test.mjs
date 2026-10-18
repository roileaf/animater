import test from "node:test";
import assert from "node:assert/strict";
import { twoeEvent } from "../../scripts/systems/adapters.mjs";
import { resolveAutomaticRecipe } from "../../scripts/catalogs/pf2e/spells/spell-catalog.mjs";

// A spell cast from a staff prepared by PF2e Dailies, a wand or a scroll is not an item on the actor:
// its attack and damage messages carry only flags.pf2e.origin (the spell's would-be uuid), so PF2e's
// message.item is null and fromUuid finds nothing.
const ARC = "Compendium.pf2e.spells-srd.Item.kBhaPuzLUSwS6vVf";
const arc = (over = {}) => ({ id: "virt", type: "spell", name: "Electric Arc", slug: "electric-arc", rank: 1,
  _stats: { compendiumSource: ARC }, system: { slug: "electric-arc", traits: { value: ["concentrate", "electricity", "manipulate"] } }, ...over });
const damage = ({ actor = {}, rollOptions = [], castRank = 3 } = {}) => ({
  id: "m", author: { id: "u" }, isRoll: true, isDamageRoll: true, speaker: { token: "t", scene: "s" }, actor, item: null,
  flags: { pf2e: { context: { type: "damage-roll", options: [] }, origin: { uuid: "Actor.a.Item.virt", type: "spell", castRank, rollOptions } } },
});
const on = { enabled: true, scope: "all", independent: true };
const plays = (event) => resolveAutomaticRecipe(event, on, [], { customEnabled: false });

test("a staff spell prepared by PF2e Dailies resolves to its virtual spell and animates", () => {
  // Dailies keeps staff spells in a spellcasting collection (`<staffId>-casting`), not on the actor.
  const staff = new Map([["virt", arc()]]);
  const actor = { items: [], spellcasting: { collections: new Map([["staff-casting", staff]]) } };
  const e = twoeEvent(damage({ actor }), "u");
  assert.ok(e, "the damage roll is an event");
  assert.equal(e.item?.name, "Electric Arc");
  assert.equal(e.castRank, 3, "the cast rank comes from the message");
  assert.ok(plays(e), "the spell catalog plays it");
});

test("a wand or scroll spell resolves to the consumable's embedded spell", () => {
  const wand = { type: "consumable", category: "wand", embeddedSpell: arc() };
  const actor = { items: [{ type: "weapon" }, wand], spellcasting: { collections: new Map() } };
  const e = twoeEvent(damage({ actor }), "u");
  assert.equal(e.item?.name, "Electric Arc");
  assert.ok(plays(e));
});

test("an unresolvable spell falls back to the slug and traits the message carries", () => {
  const e = twoeEvent(damage({ rollOptions: ["origin:item:type:spell", "origin:item:id:virt", "origin:item:slug:electric-arc", "origin:item:trait:electricity"] }), "u");
  assert.ok(e, "no message.item is still an event");
  assert.equal(e.item?.type, "spell");
  assert.equal(e.item?.slug, "electric-arc");
  assert.equal(e.castRank, 3);
  assert.ok(plays(e), "the catalog matches by slug");
  // The attack trait still moves an attack spell to its attack roll.
  const ray = twoeEvent(damage({ rollOptions: ["origin:item:slug:ray-of-enfeeblement", "origin:item:trait:attack"] }), "u");
  assert.deepEqual(ray.item.system.traits.value, ["attack"]);
});

test("an embedded spell that throws or is missing does not break the event", () => {
  const broken = { type: "consumable", get embeddedSpell() { throw Error("No owning actor"); } };
  const e = twoeEvent(damage({ actor: { items: [broken] }, rollOptions: ["origin:item:slug:electric-arc"] }), "u");
  assert.equal(e.item?.slug, "electric-arc");
});

test("a non-spell origin with no item keeps resolving by uuid later", () => {
  const msg = damage();
  msg.flags.pf2e.origin = { uuid: "Actor.a.Item.b", type: "weapon" };
  const e = twoeEvent(msg, "u");
  assert.equal(e.item, null);
  assert.equal(e.itemUuid, "Actor.a.Item.b");
});
