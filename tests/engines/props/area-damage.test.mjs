import test from "node:test";
import assert from "node:assert/strict";
import { damageTypesOfItem, areaIdOf, areaOriginRefOf, placedRecordOf, typesBreaking } from "../../../scripts/engines/props/area-damage.mjs";
import { areaRefusal } from "../../../scripts/engines/props/prop-areas.mjs";

// PF2e 8.x spell: system.damage is an object of partials, each naming its `type`.
const fireball = { type: "spell", system: { damage: { 0: { formula: "6d6", type: "fire", kinds: {} } } } };

test("a PF2e or SF2e spell's damage types are every partial's type, normalized, once each", () => {
  assert.deepEqual(damageTypesOfItem(fireball, "pf2e"), ["fire"]);
  const chromatic = { type: "spell", system: { damage: { a: { type: "fire" }, b: { type: "lightning" }, c: { type: "fire" } } } };
  assert.deepEqual(damageTypesOfItem(chromatic, "pf2e"), ["fire", "electricity"]);
  // an older shape names it damageType
  assert.deepEqual(damageTypesOfItem({ type: "spell", system: { damage: { 0: { damageType: "cold" } } } }, "sf2e"), ["cold"]);
});

test("a spell with no damage type has none, and nothing is no item", () => {
  assert.deepEqual(damageTypesOfItem({ type: "spell", system: { damage: {} } }, "pf2e"), []);
  assert.deepEqual(damageTypesOfItem({ type: "spell", system: {} }, "pf2e"), []);
  assert.deepEqual(damageTypesOfItem(null, "pf2e"), []);
  assert.deepEqual(damageTypesOfItem({ type: "spell", system: { damage: { 0: { type: "" } } } }, "pf2e"), []);
});

test("a scroll or wand reads the spell it holds", () => {
  assert.deepEqual(damageTypesOfItem({ type: "consumable", embeddedSpell: fireball, system: { damage: null } }, "pf2e"), ["fire"]);
});

test("a D&D 5e item's damage types: every activity's damage parts, or the one activity that placed the area", () => {
  const acts = new Map([["a", { damage: { parts: [{ types: new Set(["fire"]) }] } }], ["b", { damage: { parts: [{ types: ["thunder", "fire"] }] } }]]);
  const item = { type: "spell", system: { activities: acts } };
  assert.deepEqual(damageTypesOfItem(item, "dnd5e"), ["fire", "sonic"]);
  assert.deepEqual(damageTypesOfItem(item, "dnd5e", { activity: acts.get("b") }), ["sonic", "fire"]);
  // the legacy parts list [[formula, type]]
  assert.deepEqual(damageTypesOfItem({ type: "spell", system: { damage: { parts: [["8d6", "fire"]] } } }, "dnd5e"), ["fire"]);
  // a Collection-like activities field
  assert.deepEqual(damageTypesOfItem({ type: "spell", system: { activities: { contents: [{ damage: { parts: [{ types: ["cold"] }] } }] } } }, "dnd5e"), ["cold"]);
});

test("an area's id: a Region's or a template's uuid, nothing else", () => {
  assert.equal(areaIdOf({ documentName: "Region", uuid: "Scene.s.Region.r" }), "Scene.s.Region.r");
  assert.equal(areaIdOf({ documentName: "MeasuredTemplate", uuid: "Scene.s.MeasuredTemplate.t" }), "Scene.s.MeasuredTemplate.t");
  assert.equal(areaIdOf({ documentName: "Tile", uuid: "Scene.s.Tile.t" }), null);
  assert.equal(areaIdOf(null), null);
});

test("an area's origin as its own flags name it: PF2e's origin, D&D's activity", () => {
  const region = { flags: { pf2e: { messageId: "m", origin: { uuid: "Actor.a.Item.i", actor: "Actor.a" } } } };
  assert.deepEqual(areaOriginRefOf(region, "pf2e"), { itemUuid: "Actor.a.Item.i", actorUuid: "Actor.a", activityUuid: null, messageId: "m" });
  const tpl = { flags: { dnd5e: { activity: "Actor.a.Item.i.Activity.x", origin: "Scene.s.Token.t" } } };
  assert.deepEqual(areaOriginRefOf(tpl, "dnd5e"), { itemUuid: "Actor.a.Item.i", actorUuid: "Actor.a", activityUuid: "Actor.a.Item.i.Activity.x", messageId: null });
  assert.deepEqual(areaOriginRefOf({ flags: {} }, "pf2e"), { itemUuid: null, actorUuid: null, activityUuid: null, messageId: null });
});

test("an area the GM never saw placed is read from its own document and its spell card, on the GM's own clock", () => {
  // a PF2e v14 Region keeps no author or creation time: PF2e makes its placer its owner, and its card says when
  const region = { documentName: "Region", ownership: { default: 0, p: 3 } };
  const card = { timestamp: 9000, author: { id: "gm" } };
  assert.deepEqual(placedRecordOf(region, { localNow: 100500, serverNow: 10000, message: card }), { authorId: "p", rememberedAt: 99500 });
  // owned by no one in particular: the card's author
  assert.deepEqual(placedRecordOf({ documentName: "Region", ownership: { default: 0 } }, { localNow: 100500, serverNow: 10000, message: card }), { authorId: "gm", rememberedAt: 99500 });
  // a template names its author; a document with its own creation time needs no card
  assert.deepEqual(placedRecordOf({ documentName: "MeasuredTemplate", author: { id: "q" }, _stats: { createdTime: 1 } }, { localNow: 50, serverNow: 1 }), { authorId: "q", rememberedAt: 50 });
  // a sender's clock running ahead never makes the area younger than now
  assert.deepEqual(placedRecordOf(region, { localNow: 5000, serverNow: 5000, message: { timestamp: 5600 } }), { authorId: "p", rememberedAt: 5000 });
  // nothing says when: no record
  assert.equal(placedRecordOf({ documentName: "Region", ownership: { p: 3 } }, { localNow: 1, serverNow: 1 }), null);
  assert.equal(placedRecordOf(null, { localNow: 1, serverNow: 1, message: card }), null);
});

test("which of an area's damage types breaks each thing: the first that does, each thing once", () => {
  const things = { crate: ["fire", "bludgeoning"], glass: ["sonic"], plant: ["fire"] };
  const hitsOf = (type) => Object.keys(things).filter((k) => things[k].includes(type)).map((id) => ({ id }));
  const picked = typesBreaking(["sonic", "fire"], hitsOf, (t) => t.id);
  assert.deepEqual(picked.map((p) => [p.thing.id, p.type]), [["glass", "sonic"], ["crate", "fire"], ["plant", "fire"]]);
  assert.deepEqual(typesBreaking([], hitsOf, (t) => t.id), []);
});

// The GM's check takes the area's damage types from its own read of the spell, never the requester's word.
const circle = (p) => Math.hypot(p.x - 500, p.y - 500) <= 200;
const area = (x = {}) => ({ uuid: "Scene.s.Region.r", sceneId: "s", authorId: "p", rememberedAt: 1000, testPoint: circle, levels: [], damageTypes: ["fire"], ...x });
const ask = (cause) => ({ cause: { areaUuid: "Scene.s.Region.r", ...cause }, sceneId: "s", sender: { id: "p", isGM: false }, point: { x: 520, y: 500 }, levels: [], now: 2000 });

test("an area cause's damage type must be one the GM reads from the area's spell", () => {
  assert.equal(areaRefusal(area(), ask({ kind: "area", damageType: "fire" })), null);
  assert.equal(areaRefusal(area(), ask({ kind: "area", damageType: "bludgeoning" })), "area");
  assert.equal(areaRefusal(area(), ask({ kind: "area" })), "area");
  // a spell the GM finds no damage type in breaks nothing; a GM with no read of it refuses too
  assert.equal(areaRefusal(area({ damageTypes: [] }), ask({ kind: "area", damageType: "fire" })), "area");
  assert.equal(areaRefusal(area({ damageTypes: undefined }), ask({ kind: "area", damageType: "fire" })), "area");
  // a GM sender is held to the spell's types as well
  assert.equal(areaRefusal(area(), { ...ask({ kind: "area", damageType: "cold" }), sender: { id: "gm", isGM: true } }), "area");
});

test("spilled powder lit by an area needs fire among the spell's types", () => {
  assert.equal(areaRefusal(area(), ask({ kind: "ignite", damageType: "fire" })), null);
  assert.equal(areaRefusal(area({ damageTypes: ["cold"] }), ask({ kind: "ignite", damageType: "fire" })), "area");
});

// A spell whose damage type is chosen at cast (or a kineticist impulse) names none on its item: the GM reads the area's
// damage roll from its own copy of the message the cause names.
import { rollDamageTypes } from "../../../scripts/engines/props/area-damage.mjs";
const roll = (x = {}) => ({ isDamage: true, itemUuid: "Actor.a.Item.i", actorUuid: "Actor.a", authorId: "p", timestamp: 10000, types: ["cold", "fire"], ...x });
const origin = { itemUuid: "Actor.a.Item.i", actorUuid: "Actor.a" };
const player = { id: "p", isGM: false };

test("the damage roll a cause names gives the area its types: the area's own spell, rolled by the sender, lately", () => {
  assert.deepEqual(rollDamageTypes(roll(), { ...origin, sender: player, now: 12000 }), ["cold", "fire"]);
  // a GM may name anyone's roll
  assert.deepEqual(rollDamageTypes(roll({ authorId: "q" }), { ...origin, sender: { id: "gm", isGM: true }, now: 12000 }), ["cold", "fire"]);
});

test("any other roll gives nothing: not a damage roll, another item or caster, someone else's, too old, from the future, or none", () => {
  const ok = { ...origin, sender: player, now: 12000 };
  assert.deepEqual(rollDamageTypes(roll({ isDamage: false }), ok), []);
  assert.deepEqual(rollDamageTypes(roll({ itemUuid: "Actor.a.Item.other" }), ok), []);
  assert.deepEqual(rollDamageTypes(roll({ actorUuid: "Actor.b" }), ok), []);
  assert.deepEqual(rollDamageTypes(roll({ authorId: "q" }), ok), []);
  assert.deepEqual(rollDamageTypes(roll({ timestamp: 12000 - 600001 }), ok), []);
  assert.deepEqual(rollDamageTypes(roll({ timestamp: 12000 + 5000 }), ok), []);
  assert.deepEqual(rollDamageTypes(null, ok), []);
  assert.deepEqual(rollDamageTypes(roll(), { ...ok, itemUuid: null }), []);
  assert.deepEqual(rollDamageTypes(roll({ types: undefined }), ok), []);
});
