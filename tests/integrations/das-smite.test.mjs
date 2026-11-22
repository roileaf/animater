// DAS · Core casts a smite without D&D 5e's own use: the weapon's damage message carries it (read from a live world).
import test from "node:test";
import assert from "node:assert/strict";
import { DAS_ID, dasSmiteOf, dasSmiteEvent } from "../../scripts/integrations/das-smite.mjs";
import { matchRecipe, validateRecipe } from "../../scripts/core/model.mjs";
import { DND5E_BOOK_ENTRIES } from "../../data/dnd5e-book-catalog.mjs";
import { addDndBookEntries, dndEntry, dndRecipe, resolveDndAutomaticRecipe } from "../../scripts/catalogs/dnd5e/dnd5e-catalog.mjs";

addDndBookEntries(DND5E_BOOK_ENTRIES, () => true);
const entry = dndEntry("dnd5e-players-handbook-spells-phbsplHailofThor");
const save = { id: "dnd5eactivity000", type: "save", name: "Save", target: { template: { type: "radius", size: "5", units: "ft" } } };
const hail = { type: "spell", name: "Hail of Thorns", uuid: "Actor.JGVolstCCLbv2g75.Item.PzQUqOclzWQqtgMG", actor: { id: "JGVolstCCLbv2g75" }, _stats: { compendiumSource: entry.uuid }, system: { level: 1, activities: new Map([[save.id, save]]) } };
// The damage message of the bow shot, as DAS 0.290 writes it.
const message = (smite, author = "gm") => ({ id: "UB8QD40BQrnzM8xa", type: "damage", author: { id: author },
  speaker: { actor: "JGVolstCCLbv2g75", alias: "Octavia", scene: "9uJu2W2ukQuL5O4S", token: "CevsaTS55vFQf6Io" },
  flags: { core: {}, [DAS_ID]: { smite, applied: {} } } });
const smite = { effect: null, formula: null, free: false, item: hail.uuid, level: 1, name: "Hail of Thorns", save: "dnd5eactivity000", scaling: 0, target: "Scene.9uJu2W2ukQuL5O4S.Token.aOpk0wbtQNrx4B7v", type: null };

test("a smite with an area is that area's event, cast with no template", () => {
  const event = dasSmiteEvent(message(smite), hail, { userId: "gm" });
  assert.equal(event.type, "template"); assert.equal(event.castWithoutArea, true); assert.equal(event.id, "das-smite:UB8QD40BQrnzM8xa");
  assert.equal(event.item, hail); assert.equal(event.activity, save); assert.equal(event.activityId, "dnd5eactivity000");
  assert.equal(event.tokenId, "CevsaTS55vFQf6Io"); assert.equal(event.sceneId, "9uJu2W2ukQuL5O4S");
  assert.deepEqual(event.targetUuids, [smite.target]); assert.equal(event.spellLevel, 1);
});

test("only the client that rolled it plays it, and only a message DAS marked", () => {
  assert.equal(dasSmiteEvent(message(smite, "other"), hail, { userId: "gm" }), null);
  assert.equal(dasSmiteEvent({ ...message(smite), flags: { [DAS_ID]: { applied: {} } } }, hail, { userId: "gm" }), null);
  assert.equal(dasSmiteEvent(message({ ...smite, item: "" }), hail, { userId: "gm" }), null);
  assert.equal(dasSmiteEvent(message(smite), null, { userId: "gm" }), null, "the item is gone");
  assert.equal(dasSmiteOf({ flags: {} }), null);
});

test("a smite with no area is an item-used event aimed at the creature hit", () => {
  const damage = { id: "dmg", type: "damage", name: "", target: { template: { type: "", size: "" } } };
  const divine = { ...hail, name: "Divine Smite", system: { level: 1, activities: new Map([[damage.id, damage]]) } };
  const event = dasSmiteEvent(message({ ...smite, save: null, formula: "2d8", type: "radiant" }), divine, { userId: "gm" });
  assert.equal(event.type, "use"); assert.equal(event.placedArea, false); assert.equal(event.activity, null);
  assert.deepEqual(event.targetUuids, [smite.target]);
  const rider = dasSmiteEvent(message({ kind: "rider", item: hail.uuid, name: "Stone's Endurance", target: smite.target }), divine, { userId: "gm" });
  assert.equal(rider.type, "use"); assert.equal(rider.spellLevel, undefined);
});

test("Hail of Thorns cast through DAS plays: the catalog's area design, or the GM's own recipe whatever its trigger", () => {
  const on = { enabled: true, independent: true, preferCatalog: true, scope: "all", selected: [], excluded: [], customized: [] };
  const event = () => dasSmiteEvent(message(smite), hail, { userId: "gm" });
  assert.equal(resolveDndAutomaticRecipe(event(), () => on, [], { customEnabled: false })?.catalogEntry, entry.id, "out of the box");
  const base = validateRecipe(dndRecipe(entry, entry.variants[0].id));
  const used = { ...base, name: "Mine", trigger: "use", match: "Hail of Thorns", itemUuid: hail.uuid };
  assert.equal(matchRecipe([used], event())?.name, "Mine", "set to Item used, as the GM had it");
  assert.equal(resolveDndAutomaticRecipe(event(), () => on, [used], { customEnabled: true })?.name, "Mine");
  assert.equal(resolveDndAutomaticRecipe(event(), () => ({ ...on, customized: [entry.id] }), [{ ...base, name: "Copy" }], { customEnabled: false })?.name, "Copy", "an Area placed copy");
});
