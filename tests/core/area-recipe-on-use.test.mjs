// A recipe set to "Item used" that draws on a placed area cannot play when the item is used: there is no area yet.
// It plays when that item's area is placed instead (reported with a D&D 5e Hail of Thorns recipe bound to one hero's
// spell: its use was Blocked for want of an area, and the catalog's animation played on the area).
import test from "node:test";
import assert from "node:assert/strict";
import { matchRecipe, validateRecipe } from "../../scripts/core/model.mjs";
import { DND5E_BOOK_ENTRIES } from "../../data/dnd5e-book-catalog.mjs";
import { addDndBookEntries, dndEntry, dndRecipe, resolveDndAutomaticRecipe } from "../../scripts/catalogs/dnd5e/dnd5e-catalog.mjs";

addDndBookEntries(DND5E_BOOK_ENTRIES, () => true);
const entry = dndEntry("dnd5e-players-handbook-spells-phbsplHailofThor"), variant = entry.variants[0];
const activity = { id: "dnd5eactivity000", type: "save", name: "", target: { template: { type: "radius" } } };
const item = { type: "spell", name: "Hail of Thorns", uuid: "Actor.JGVolstCCLbv2g75.Item.PzQUqOclzWQqtgMG", _stats: { compendiumSource: entry.uuid }, system: { identifier: "hail-of-thorns", activities: new Map([[activity.id, activity]]) } };
const event = (type, extra = {}) => ({ type, systemId: "dnd5e", activity, activityId: activity.id, activityName: activity.name, item, targets: [], ...extra });
// As the GM saved it: the catalog's design, bound to the hero's own spell and switched to "Item used".
const own = { ...validateRecipe({ ...dndRecipe(entry, variant.id), trigger: "use", match: "Hail of Thorns", itemUuid: item.uuid }), name: "Mine" };
const on = { enabled: true, independent: true, preferCatalog: true, scope: "all", selected: [], excluded: [], customized: [] };

test("an Item-used recipe with an area stage waits for the area", () => {
  assert.ok(own.stages.some((s) => s.kind === "template"), "it draws on an area");
  assert.equal(matchRecipe([own], event("use", { placedArea: true })), null, "not at the use: no area yet");
  assert.equal(matchRecipe([own], event("use")), null, "nor at a use that placed none");
  assert.equal(matchRecipe([own], event("template"))?.name, "Mine", "it plays when the area is placed");
  assert.equal(matchRecipe([own], event("damage")), null);
});

test("an Item-used recipe with no area stage still plays at the use, and not on an area", () => {
  const plain = { ...own, stages: own.stages.filter((s) => s.kind !== "template") };
  assert.equal(matchRecipe([plain], event("use"))?.name, "Mine");
  assert.equal(matchRecipe([plain], event("template")), null);
});

test("an Area-placed recipe for the same item wins over one waiting for the area", () => {
  const placed = { ...own, id: "placed", name: "Placed", trigger: "template" };
  assert.equal(matchRecipe([own, placed], event("template"))?.name, "Placed");
  assert.equal(matchRecipe([placed, own], event("template"))?.name, "Placed");
});

test("D&D 5e: the GM's Item-used Hail of Thorns plays on its area instead of the catalog's", () => {
  const resolve = (e) => resolveDndAutomaticRecipe(e, () => on, [own], { customEnabled: true });
  assert.equal(resolve(event("template"))?.name, "Mine");
  assert.equal(resolve(event("use", { placedArea: true })), null);
  // Paused and never marked customized, it is out of the way: Plug & play's own animation plays, as for any paused recipe.
  assert.equal(resolveDndAutomaticRecipe(event("template"), () => on, [{ ...own, enabled: false }], { customEnabled: true })?.name, entry.name);
});

// A cast that is known to have placed no area (a module that resolves a smite itself: damage and effect, no
// template) gives the recipe nothing to wait for. It plays at the use, on an area built from the spell's own size.
import { castArea } from "../../scripts/engines/preview/canvas-preview-area.mjs";
import { previewPlan, withCastArea } from "../../scripts/core/model.mjs";
import { dnd5eEvent } from "../../scripts/systems/adapters.mjs";

const token = (x, y, squares = 1) => ({ id: `t${x}-${y}`, center: { x: x + squares * 50, y: y + squares * 50 }, w: squares * 100, h: squares * 100, document: { width: squares, height: squares } });
const grid = { gridSize: 100, gridDistance: 5 };

test("a use known to have placed no area plays an Item-used area recipe; one that placed an area, or may yet, waits", () => {
  assert.equal(matchRecipe([own], event("use", { placedArea: false }))?.name, "Mine");
  assert.equal(matchRecipe([own], event("use", { placedArea: true })), null);
  assert.equal(matchRecipe([own], event("use")), null, "a system that cannot say: the area may still come");
});

test("D&D 5e says whether a use placed an area", () => {
  const subject = { id: "a", name: "", item: { name: "Hail of Thorns", type: "spell", system: {} } };
  assert.equal(dnd5eEvent("use", subject, { results: { templates: [{}] } }).placedArea, true);
  assert.equal(dnd5eEvent("use", subject, { results: { templates: [] } }).placedArea, false);
  assert.equal(dnd5eEvent("use", subject, { results: {} }).placedArea, false);
  assert.equal("placedArea" in dnd5eEvent("damage", subject, {}), false);
});

test("an emanation is built around the one creature aimed at, else around the caster", () => {
  const caster = token(0, 0), ogre = token(600, 0, 2), other = token(900, 300);
  const spec = { type: "radius", size: "5" };
  assert.deepEqual(castArea(spec, { source: caster, targets: [ogre], ...grid }), { center: { x: 700, y: 100 }, diameter: 400 }, "5 ft each side of a Large creature");
  assert.deepEqual(castArea(spec, { source: caster, targets: [], ...grid }), { center: { x: 50, y: 50 }, diameter: 300 });
  assert.deepEqual(castArea(spec, { source: caster, targets: [ogre, other], ...grid }).center, { x: 50, y: 50 }, "several: the caster's own emanation");
  assert.deepEqual(castArea({ type: "emanation", value: 10 }, { source: caster, targets: [caster], ...grid }), { center: { x: 50, y: 50 }, diameter: 500 }, "PF2e's words, aimed at oneself");
});

test("a burst lands on what is aimed at; a cube is a square there", () => {
  const caster = token(0, 0), a = token(400, 0), b = token(600, 200);
  assert.deepEqual(castArea({ type: "sphere", size: 20 }, { source: caster, targets: [a, b], ...grid }), { center: { x: 550, y: 150 }, diameter: 800 });
  assert.deepEqual(castArea({ type: "burst", value: 5 }, { source: caster, targets: [], ...grid }), { center: { x: 50, y: 50 }, diameter: 200 });
  assert.deepEqual(castArea({ type: "cube", size: 10 }, { source: caster, targets: [a], ...grid }), { type: "square", center: { x: 450, y: 50 }, diameter: 200, width: 200 });
});

test("a cone or a line runs from the caster toward what is aimed at, and needs both", () => {
  const caster = token(0, 0), east = token(400, 0);
  const cone = castArea({ type: "cone", size: 15 }, { source: caster, targets: [east], coneAngle: 53.13, ...grid });
  assert.equal(cone.type, "cone"); assert.deepEqual(cone.center, { x: 50, y: 50 }); assert.deepEqual(cone.endpoint, { x: 350, y: 50 }); assert.equal(cone.angle, 53.13);
  const line = castArea({ type: "line", size: 30, width: 5 }, { source: caster, targets: [east], ...grid });
  assert.deepEqual(line, { type: "line", center: { x: 50, y: 50 }, endpoint: { x: 650, y: 50 }, length: 600, width: 100 });
  assert.equal(castArea({ type: "cone", size: 15 }, { source: caster, targets: [], ...grid }), null);
  assert.equal(castArea({ type: "line", size: 30 }, { source: null, targets: [east], ...grid }), null);
});

test("no size, no shape or no one to build it on: no area", () => {
  assert.equal(castArea(null, { source: token(0, 0), ...grid }), null);
  assert.equal(castArea({ type: "radius", size: "" }, { source: token(0, 0), ...grid }), null);
  assert.equal(castArea({ type: "radius", size: 5 }, { source: null, targets: [], ...grid }), null);
  assert.equal(castArea({ type: "ring", size: 5 }, { source: token(0, 0), ...grid }), null);
});

test("the built area stands in for a placed one only for a use whose recipe draws on an area", () => {
  const caster = token(0, 0), ogre = token(600, 0, 2), built = { area: { center: { x: 700, y: 100 }, diameter: 400 }, template: { id: "cast-area", center: { x: 700, y: 100 } } };
  let asked = 0; const build = () => { asked++; return built; };
  const use = { ...event("use", { placedArea: false }), source: caster, targets: [ogre] };
  const played = withCastArea(use, own, build);
  assert.equal(played.area, built.area); assert.equal(played.template, built.template); assert.equal(use.area, undefined, "the event itself is left alone");
  const plain = { ...own, stages: own.stages.filter((s) => s.kind !== "template") };
  assert.equal(withCastArea(use, plain, build), use);
  assert.equal(withCastArea({ ...use, template: { id: "real" } }, own, build).template.id, "real");
  assert.equal(withCastArea({ ...use, type: "attack" }, own, build).area, undefined);
  assert.equal(asked, 1);
  assert.equal(withCastArea(use, own, () => null), use, "nothing to build from: played as it is (and says why)");
  // The plan accepts the stand-in as its area.
  assert.ok(previewPlan(own, { ...played, automatic: true }).some((s) => s.kind === "template"));
});

test("D&D 5e: a smite resolved with no template plays the GM's Item-used recipe at the use", () => {
  assert.equal(resolveDndAutomaticRecipe(event("use", { placedArea: false }), () => on, [own], { customEnabled: true })?.name, "Mine");
  // The catalog's own area design stays with a placed area: a template set down later must not play it twice.
  assert.equal(resolveDndAutomaticRecipe(event("use", { placedArea: false }), () => on, [], { customEnabled: true }), null);
});
