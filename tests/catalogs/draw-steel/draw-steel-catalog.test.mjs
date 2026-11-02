import test from "node:test";
import assert from "node:assert/strict";
import {
  DRAW_STEEL_SOURCE, DS_KINDS, DS_LOOKS, dsEntries, dsEntry, dsRecipe, findDsEntry, normalizeDsCatalogState, useDsEntry, dsEntryEnabled,
  resolveDrawSteelAutomaticRecipe, filterDsEntries, dsVariantForEvent, dsCatalogProfile,
} from "../../../scripts/catalogs/draw-steel/draw-steel-catalog.mjs";
import { DS_ELEMENTS, drawSteelAbilityEvent } from "../../../scripts/systems/draw-steel.mjs";
import { planRecipe, resolveAsset } from "../../../scripts/core/model.mjs";
import { dsSettingKey } from "../../../scripts/catalogs/shared/catalog-system.mjs";
import { assetDatabases } from "../../../tools/asset-databases.mjs";
import { ability, goblin, abilityMessage } from "../../fixtures/draw-steel-messages.mjs";

const context = { source: { id: "caster", center: { x: 100, y: 100 }, w: 100, h: 100 }, targets: [{ id: "target", center: { x: 500, y: 100 }, w: 100, h: 100 }], gridSize: 100, gridDistance: 5 };
const named = (kind, name) => dsEntries(kind).find((e) => e.name === name);
const all = () => normalizeDsCatalogState({ enabled: true });
const eventOf = (item, options = {}) => drawSteelAbilityEvent(abilityMessage(item, { targets: [{ uuid: "Scene.s.Token.gt.Actor.gob" }], ...options }), "u");

test("the library holds every hero ability of the installed compendium, fallbacks and conditions", () => {
  assert.equal(DRAW_STEEL_SOURCE.systemId, "draw-steel");
  assert.deepEqual(DS_KINDS, ["ability", "fallback", "condition"]);
  assert.equal(dsEntries("ability").length, DRAW_STEEL_SOURCE.counts.ability);
  assert.ok(DRAW_STEEL_SOURCE.counts.ability > 400);
  assert.equal(dsEntries("condition").length, 10);
  for (const element of DS_ELEMENTS) assert.ok(dsEntry(`draw-steel-fallback-${element}`), element);
  assert.equal(dsSettingKey("ability"), "drawSteelAbilityCatalog");
  assert.equal(new Set(dsEntries().map((e) => e.id)).size, dsEntries().length, "unique ids");
  for (const e of dsEntries()) for (const v of e.variants) assert.equal(v.recipe.systemId, "draw-steel", `${e.name} keeps its system`);
});

test("hero abilities: a rolled one rides its power roll, an unrolled one its use, each in its look", () => {
  const rolled = dsEntries("ability").find((e) => e.variants[0].recipe.trigger === "attack");
  const unrolled = dsEntries("ability").find((e) => e.variants[0].recipe.trigger === "use");
  assert.ok(rolled && unrolled);
  const fire = dsEntries("ability").find((e) => e.look.element === "fire" && e.look.shape === "strike" && e.look.mode === "ranged");
  assert.ok(fire.variants[0].recipe.stages.some((s) => s.stageId === "bolt"), `${fire.name} flies a bolt`);
  const burst = dsEntries("ability").find((e) => e.look.shape === "burst");
  assert.ok(burst.variants[0].recipe.stages.some((s) => s.stageId === "burst"), `${burst.name} erupts`);
  assert.equal(named("ability", "Volcano's Embrace")?.look.element, "fire");
});

test("an ability is found by its compendium source, then its Draw Steel id, then a hero's by name", () => {
  const entry = named("ability", "Volcano's Embrace"), id = entry.uuid.split(".").pop();
  assert.equal(findDsEntry({ type: "attack", item: { type: "ability", name: "Renamed", _stats: { compendiumSource: entry.uuid } } }), entry);
  assert.equal(findDsEntry({ type: "attack", item: { type: "ability", name: "Renamed", system: { _dsid: "volcanos-embrace" } } }), entry);
  assert.equal(findDsEntry({ type: "attack", item: { type: "ability", name: "Volcano's Embrace", actor: { type: "hero" } } }), entry);
  assert.ok(id);
});

test("a monster's ability plays the fallback of its look: weapon strikes by name, elements by shape", () => {
  const bite = ability("Bite", { actor: goblin });
  assert.equal(findDsEntry(eventOf(bite)).id, "draw-steel-fallback-weapon-bite");
  const spear = ability("Spear Charge", { actor: goblin });
  assert.equal(findDsEntry(eventOf(spear)).id, "draw-steel-fallback-weapon-melee");
  const bow = ability("Shortbow", { actor: goblin, keywords: ["ranged", "strike", "weapon"], distance: "ranged" });
  assert.equal(findDsEntry(eventOf(bow)).id, "draw-steel-fallback-weapon-ranged");
  const breath = ability("Fire Breath", { actor: goblin, keywords: ["area", "magic"], distance: "line", damage: [["fire"]] });
  const e = eventOf(breath), entry = findDsEntry(e);
  assert.equal(entry.id, "draw-steel-fallback-fire");
  assert.equal(dsVariantForEvent(entry, e).dsShape, "line");
  const rot = ability("Rotting Touch", { actor: goblin, keywords: ["magic", "melee", "strike"], damage: [["corruption"]] });
  const r = eventOf(rot);
  assert.equal(dsVariantForEvent(findDsEntry(r), r).id, "draw-steel-fallback-corruption-strike-melee");
  const ward = ability("Ward", { actor: goblin, keywords: ["magic"], distance: "self", target: "self", damage: [] });
  assert.equal(findDsEntry(eventOf(ward)).id, "draw-steel-fallback-utility-boon");
  assert.equal(findDsEntry({ type: "use", item: { type: "kit", name: "Mountain" } }), null, "not an ability");
});

test("automatic playback: the catalog when on, your own recipe by name first, conditions as layers", () => {
  const bite = ability("Bite", { actor: goblin }), e = eventOf(bite);
  assert.equal(resolveDrawSteelAutomaticRecipe(e, () => normalizeDsCatalogState(), []), null, "catalog off");
  const recipe = resolveDrawSteelAutomaticRecipe(e, all, []);
  assert.equal(recipe.catalogEntry, "draw-steel-fallback-weapon-bite");
  assert.equal(recipe.trigger, "attack");
  const unrolled = ability("Taunt", { actor: goblin, keywords: ["magic", "ranged"], distance: "ranged", target: "creature", damage: [], applied: [] });
  const u = drawSteelAbilityEvent(abilityMessage(unrolled), "u");
  assert.equal(u.type, "use");
  assert.equal(resolveDrawSteelAutomaticRecipe(u, all, [])?.trigger, "use", "a fallback plays on the event that fired");
  const own = { id: "mine", name: "Bite", match: "Bite", trigger: "attack", enabled: true, stages: [{ stageId: "x", kind: "impact", assets: ["jb2a.impact.003.blue"] }] };
  assert.equal(resolveDrawSteelAutomaticRecipe(e, all, [own])?.id, "mine");
  assert.equal(resolveDrawSteelAutomaticRecipe({ type: "effect", item: { statuses: new Set(["dazed"]) } }, all, []), null, "lasting");
  const dazed = dsEntry("draw-steel-condition-dazed");
  assert.equal(dsRecipe(dazed).lifecycle, "document");
});

test("catalog state: Use picks an entry, filters search by name, class and cost", () => {
  const entry = named("ability", "Volcano's Embrace"), state = useDsEntry({}, entry.id);
  assert.equal(dsEntryEnabled(entry.id, state), true);
  assert.equal(dsEntryEnabled("draw-steel-fallback-fire", state), false, "only the picked entry");
  assert.equal(filterDsEntries("ability", { search: "volcano's embrace" })[0], entry);
  assert.ok(filterDsEntries("ability", { theme: "Elementalist" }).every((e) => e.theme === "Elementalist"));
  assert.ok(filterDsEntries("ability", { level: "5" }).every((e) => e.level === 5));
  assert.equal(dsCatalogProfile.kinds.spells, "ability");
  assert.ok(dsCatalogProfile.chips("ability").length > 5);
});

test("every look slot and every catalog recipe plays with JB2A Free and Patreon", async () => {
  const db = await assetDatabases();
  for (const [edition, rows] of Object.entries(db)) {
    for (const [element, look] of Object.entries(DS_LOOKS)) for (const slot of ["cast", "bolt", "hit", "burst", "breath"])
      if (look[slot]) assert.ok(resolveAsset({ kind: "cast", assets: look[slot] }, rows), `${edition} ${element}.${slot}`);
    for (const entry of dsEntries()) for (const v of entry.variants)
      assert.ok(planRecipe(dsRecipe(entry, v.id), rows, context).length, `${edition} ${entry.name} ${v.id}`);
  }
});

const sig = (recipe) => JSON.stringify(recipe.stages.map((s) => [s.kind, s.motion, s.assets?.[0], s.fxPreset, s.scale]));
const ofLook = (pred) => dsEntries("ability").filter((e) => pred(e));

test("hero abilities look distinct: no more than a handful share one animation", () => {
  const groups = new Map();
  for (const e of dsEntries("ability")) { const k = sig(dsRecipe(e)); groups.set(k, [...(groups.get(k) ?? []), e.name]); }
  const largest = Math.max(...[...groups.values()].map((g) => g.length));
  assert.ok(groups.size >= dsEntries("ability").length * 0.75, `${groups.size} distinct looks for ${dsEntries("ability").length} abilities`);
  assert.ok(largest <= 8, `largest group of identical looks: ${largest}`);
});

test("every ability moves a token, and typed hits mark the struck body through Tokenshade", () => {
  for (const e of dsEntries("ability")) assert.ok(dsRecipe(e).stages.some((s) => s.kind === "motion"), `${e.name} has token motion`);
  const fire = ofLook((e) => e.look.element === "fire" && e.look.shape !== "self")[0];
  const body = dsRecipe(fire).stages.find((s) => s.kind === "tokenfx" && s.subject === "targets");
  assert.equal(body?.fxPreset, "Burning", `${fire.name} burns its targets`);
  const holy = ofLook((e) => e.look.element === "holy" && e.look.shape !== "self")[0];
  assert.equal(dsRecipe(holy).stages.find((s) => s.kind === "tokenfx")?.fxPreset, "Radiant Burn");
  const boon = ofLook((e) => e.look.shape === "self")[0];
  assert.ok(dsRecipe(boon).stages.some((s) => s.kind === "tokenfx" && s.subject === "source" && s.fxPreset === "glow"), "a boon glows on its user");
  for (const e of dsEntries()) for (const v of e.variants) assert.ok(dsRecipe(e, v.id).stages.length <= 16, `${e.name} fits the stage limit`);
});

test("class styles: the same kind of strike differs by class", () => {
  const swing = (group) => { const e = ofLook((x) => x.group === group && x.look.shape === "strike" && x.look.weapon && x.look.mode === "melee")[0]; return dsRecipe(e).stages.find((s) => s.stageId === "swing")?.assets?.[0]; };
  assert.notEqual(swing("Fury"), swing("Shadow"));
  assert.match(swing("Null") ?? "", /unarmed_strike/, "a Null strikes with its fists");
  const censor = ofLook((x) => x.group === "Censor" && x.look.weapon && x.look.element === "physical")[0];
  assert.ok(dsRecipe(censor).stages.some((s) => s.stageId === "accent" && /sacred_flame/.test(s.assets[0])), "a Censor's blow lands in holy light");
});

test("forced movement and conditions ride the hit; a charge rushes in first", () => {
  const push = ofLook((e) => e.look.shape !== "self" && dsRecipe(e).stages.some((s) => s.stageId === "forced" && s.motion === "recoil"))[0];
  assert.ok(push, "a push drives its target back");
  const pull = ofLook((e) => dsRecipe(e).stages.some((s) => s.stageId === "forced" && s.motion === "stagger"))[0];
  assert.ok(pull, "a pull drags its target in");
  assert.ok(ofLook((e) => dsRecipe(e).stages.some((s) => s.stageId === "cond-grabbed")).length > 0, "a grab chains its target");
  const charge = ofLook((e) => e.look.shape === "strike" && e.look.mode === "melee" && /charge/i.test(e.name))[0];
  if (charge) assert.equal(dsRecipe(charge).stages[0].motion, "rush", `${charge.name} rushes in`);
  assert.ok(dsRecipe(push).stages.every((s) => s.kind !== "motion" || !["push", "pull"].includes(s.motion)), "the look never moves the creature itself");
});

test("a monster's fallback carries its own forced movement and conditions", () => {
  const slam = ability("Tail Slam", { actor: goblin, applied: ["prone"] });
  slam.system.power.effects.f = { type: "forced", forced: { tier3: { movement: ["push"], distance: "2" } } };
  const e = eventOf(slam), r = resolveDrawSteelAutomaticRecipe(e, all, []);
  assert.deepEqual(e.dsForced, { kind: "push", squares: 2 });
  assert.ok(r.stages.some((s) => s.stageId === "forced"), "pushed back");
  assert.ok(r.stages.some((s) => s.stageId === "cond-prone"), "knocked prone");
  assert.ok(!dsRecipe(dsEntry("draw-steel-fallback-weapon-unarmed")).stages.some((s) => s.stageId === "forced"), "the plain fallback has no rider");
});

test("clips play to their end: short ones whole, long ones fade out instead of being cut", async () => {
  const { clipLength } = await import("../../../scripts/engines/media/media-lifetime.mjs");
  for (const e of dsEntries()) for (const v of e.variants) for (const s of dsRecipe(e, v.id).stages) {
    if (!["impact", "travel"].includes(s.kind) || s.persist) continue;
    const len = Math.max(0, ...s.assets.map(clipLength));
    if (len && !s.oneShot) assert.ok(s.duration >= len || s.fadeOut >= 600, `${e.name} ${s.stageId}: ${s.duration} ms of a ${len} ms clip`);
  }
});

test("an ability used with no one targeted plays in place instead of blocking", () => {
  const charge = dsEntries("ability").find((e) => e.name === "Charge");
  const r = dsRecipe(charge, null, { untargeted: true });
  assert.ok(r.stages.every((s) => !(s.kind === "motion" && (s.motion === "lunge" || s.motionRange === "target"))), "no motion needs a target");
  assert.ok(r.stages.filter((s) => ["travel", "impact"].includes(s.kind)).every((s) => s.optionalTargets), "target stages skip");
  assert.ok(r.stages.some((s) => s.kind === "motion" && s.subject === "source"), "the user still moves");
});

test("abilities play what their text says they do", () => {
  const stagesOf = (name) => dsRecipe(dsEntries("ability").find((e) => e.name === name)).stages;
  const has = (name, pred, why) => assert.ok(stagesOf(name).some(pred), `${name}: ${why}`);
  has("Black Ash Teleport", (s) => /misty_step/.test(s.assets?.[0] ?? ""), "mists away");
  has("Fake Your Death", (s) => s.kind === "tokenfx" && s.fxPreset === "Unseen", "turns invisible");
  has("Fake Your Death", (s) => s.motion === "fade", "fades from sight");
  has("Judgement", (s) => s.kind === "tokenfx" && s.fxPreset === "Exposed" && s.subject === "targets", "brands its foe");
  has("Mark", (s) => /hunters_mark/.test(s.assets?.[0] ?? ""), "marks its foe");
  has("Aspect of the Wild", (s) => s.fxPreset === "Shifting", "shapeshifts");
  has("Claw Dirt", (s) => s.motion === "sink", "digs in");
  has("Escape Grab", (s) => /chain/.test(s.assets?.[0] ?? ""), "breaks the chain");
  has("Grab", (s) => s.stageId === "cond-grabbed", "grabs");
  assert.ok(!stagesOf("Grab").some((s) => /sword|axe|mace|spear/.test(s.assets?.[0] ?? "")), "a grab swings no weapon");
  has("Edict of Stillness", (s) => /magic_signs|bless|token_border/.test(s.assets?.[0] ?? "") && s.below, "spreads its aura");
  has("One Vial Makes You Better", (s) => s.kind === "travel" && /flask/.test(s.assets[0]), "lobs a potion");
  assert.ok(!stagesOf("Escape Grab").some((s) => s.kind === "tokenfx" && s.subject === "targets"), "the grabber does not glow");
});

test("maneuvers look distinct from one another", () => {
  const maneuvers = dsEntries("ability").filter((e) => ["boon", "heal"].every(() => true) && e.descriptionText && e.variants[0].recipe.trigger);
  const groups = new Map();
  for (const e of maneuvers) { const k = sig(dsRecipe(e)); groups.set(k, (groups.get(k) ?? 0) + 1); }
  assert.ok(Math.max(...groups.values()) <= 5, `largest group ${Math.max(...groups.values())}`);
});
