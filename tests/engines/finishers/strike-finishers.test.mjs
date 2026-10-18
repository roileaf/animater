import test from "node:test";
import assert from "node:assert/strict";
import { strikeKey, isSyntheticItem, isStrikeDescriptor, picksOnActor, strikePick, strikeSlugFromOptions, strikeFromDrag, syntheticUuid } from "../../../scripts/engines/finishers/strike-finishers.mjs";

const actorWith = (items = []) => {
  const map = new Map(items.map((i) => [i.id, i]));
  return { items: { get: (id) => map.get(id) } };
};

test("strikeKey: the strike's slug, else its name, normalized into a safe flag key", () => {
  assert.equal(strikeKey({ slug: "basic-unarmed", name: "Unarmed Attack" }), "basic-unarmed");
  assert.equal(strikeKey({ name: "Fist" }), "fist");
  assert.equal(strikeKey({ name: "Big  Claw.Jaws" }), "big-claw-jaws");
  assert.equal(strikeKey({}), "");
});

test("isSyntheticItem: an item its actor does not hold (PF2e's basic unarmed, rule-element strikes)", () => {
  const sword = { id: "sword", name: "Longsword" };
  const actor = actorWith([sword, { id: "feat1", name: "Animal Instinct" }]);
  sword.actor = actor;
  assert.equal(isSyntheticItem(sword), false);
  assert.equal(isSyntheticItem({ id: "xxPF2ExUNARMEDxx", name: "Unarmed Attack", actor }), true);
  assert.equal(isSyntheticItem({ id: "feat1", name: "Jaws", actor }), true, "a strike sharing its feat's id is still not that feat");
  assert.equal(isSyntheticItem({ id: "w", name: "World item" }), false, "no actor: an ordinary item");
  assert.equal(isSyntheticItem({ id: "x", actor: {} }), false, "an actor without an items collection");
});

test("isStrikeDescriptor / picksOnActor: plain { actor, name, slug } objects and synthetic items", () => {
  const actor = actorWith([]);
  assert.equal(isStrikeDescriptor({ actor, name: "Fist" }), true);
  assert.equal(isStrikeDescriptor({ actor, slug: "fist" }), true);
  assert.equal(isStrikeDescriptor({ actor }), false);
  assert.equal(isStrikeDescriptor({ actor, name: "Fist", documentName: "Item" }), false);
  assert.equal(picksOnActor({ actor, name: "Fist" }), true);
  assert.equal(picksOnActor({ id: "xxPF2ExUNARMEDxx", name: "Fist", actor, documentName: "Item" }), true);
  assert.equal(picksOnActor(null), false);
});

test("strikePick reads the actor's strikeFinishers flag by key", () => {
  const actor = { getFlag: (scope, key) => (scope === "animater" && key === "strikeFinishers" ? { "basic-unarmed": "pick" } : undefined) };
  assert.equal(strikePick(actor, { slug: "basic-unarmed" }), "pick");
  assert.equal(strikePick(actor, { name: "Fist" }), null);
  assert.equal(strikePick(null, { name: "Fist" }), null);
});

test("strikeSlugFromOptions / syntheticUuid", () => {
  assert.equal(strikeSlugFromOptions(["self:x", "item:slug:basic-unarmed", "item:melee"]), "basic-unarmed");
  assert.equal(strikeSlugFromOptions(["origin:item:slug:fist"]), null);
  assert.equal(strikeSlugFromOptions(undefined), null);
  assert.equal(syntheticUuid("Actor.a.Item.xxPF2ExUNARMEDxx"), true);
  assert.equal(syntheticUuid("Actor.a.Item.xxxxxxFISTxxxxxx"), true);
  assert.equal(syntheticUuid("Actor.a.Item.abcdef0123456789"), false);
  assert.equal(syntheticUuid(null), false);
});

test("strikeFromDrag: a PF2e sheet's Attacks entry (type Action + index, or a synthetic Item uuid)", () => {
  const actor = { system: { actions: [
    { slug: "longsword", label: "Longsword", item: { id: "sword", name: "Longsword", slug: "longsword" } },
    { slug: "basic-unarmed", label: "Unarmed Attack", item: { id: "xxPF2ExUNARMEDxx", name: "Unarmed Attack", slug: "basic-unarmed" } },
  ] } };
  const resolveActor = (uuid) => (uuid === "Actor.a" ? actor : null);
  assert.deepEqual(strikeFromDrag({ type: "Action", index: 1, actorUUID: "Actor.a", actorId: "a" }, resolveActor), { name: "Unarmed Attack", slug: "basic-unarmed" });
  assert.deepEqual(strikeFromDrag({ type: "Item", uuid: "Actor.a.Item.xxPF2ExUNARMEDxx", actorUUID: "Actor.a" }, resolveActor), { name: "Unarmed Attack", slug: "basic-unarmed" });
  assert.equal(strikeFromDrag({ type: "Action", elementTrait: "fire", actorUUID: "Actor.a" }, resolveActor), null, "a kinetic blast is not a strike");
  assert.equal(strikeFromDrag({ type: "Action", index: 9, actorUUID: "Actor.a" }, resolveActor), null);
  assert.equal(strikeFromDrag({ type: "Item", uuid: "Item.axe" }, resolveActor), null, "an ordinary item drop is not a strike");
  assert.equal(strikeFromDrag(null, resolveActor), null);
});
