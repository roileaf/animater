import test from "node:test";
import assert from "node:assert/strict";
import { starterRecipes } from "../../scripts/core/presets.mjs";
import {
  validateRecipe,
  parseImport,
  matchRecipe,
  resolveAsset,
  planRecipe,
} from "../../scripts/core/model.mjs";
import { pf2eEvent, dnd5eEvent } from "../../scripts/systems/adapters.mjs";
const recipe = () => starterRecipes()[0];
const catalog = [
  { key: "jb2a.fire_bolt.orange" },
  { key: "jb2a.impact.001.orange" },
];
test("all starter recipes validate and have distinct IDs", () => {
  const all = starterRecipes();
  assert.equal(new Set(all.map((r) => r.id)).size, all.length);
  all.forEach((r) => assert.deepEqual(validateRecipe(r), r));
});
test("exact names and native slugs match without substring accidents", () => {
  const r = recipe();
  assert.equal(
    matchRecipe([r], { type: "attack", item: { name: "Ignition" } }),
    r,
  );
  assert.equal(
    matchRecipe([r], {
      type: "attack",
      item: { system: { slug: "produce-flame" } },
    }),
    r,
  );
  assert.equal(
    matchRecipe([r], {
      type: "attack",
      item: { name: "Greater Fire Bolt of Doom" },
    }),
    null,
  );
  assert.equal(
    matchRecipe([r], { type: "damage", item: { name: "Ignition" } }),
    null,
  );
});
test("item UUID wins; bound recipe never applies by name alone", () => {
  const base = recipe(),
    bound = { ...base, id: "bound", itemUuid: "Actor.a.Item.b" };
  assert.equal(
    matchRecipe([base, bound], {
      type: "attack",
      item: { name: "Ignition", uuid: "Actor.a.Item.b" },
    }),
    bound,
  );
  assert.equal(
    matchRecipe([bound], {
      type: "attack",
      item: { name: "Ignition", uuid: "Actor.a.Item.other" },
    }),
    null,
  );
});
test("fallback picks installed asset without inventing premium variants", () => {
  assert.equal(
    resolveAsset({ assets: ["jb2a.fire_bolt.red", "jb2a.fire_bolt"] }, catalog),
    "jb2a.fire_bolt.orange",
  );
  assert.equal(resolveAsset({ assets: ["jb2a.missing"] }, catalog), null);
});
test("full recipe validates before playback; missing target or asset blocks it", () => {
  const r = recipe();
  assert.throws(
    () => planRecipe(r, catalog, { source: {}, targets: [] }),
    /Target at least one/,
  );
  assert.throws(
    () => planRecipe(r, [], { source: {}, targets: [{}] }),
    /no installed asset/,
  );
  const plan = planRecipe(r, catalog, {
    source: {},
    targets: [{ id: "a" }, { id: "b" }],
  });
  assert.equal(plan.length, 5);
  assert.equal(plan.filter((s) => s.kind === "cast").length, 1);
});
test("unsafe imports and unbounded settings rejected or constrained", () => {
  const r = recipe();
  // Exercise numeric validation independently of the full-film extension.
  r.stages[0].oneShot = false;
  r.stages[0].delay = Infinity;
  r.stages[0].scale = 99;
  r.stages[0].duration = -200;
  const cleaned = validateRecipe(r);
  assert.equal(cleaned.stages[0].delay, 0);
  assert.equal(cleaned.stages[0].scale, 5);
  assert.equal(cleaned.stages[0].duration, 100);
  r.stages[0].assets = ["https://example.com/effect.webm"];
  assert.throws(() => validateRecipe(r), /database key or relative media file/);
  assert.throws(
    () =>
      parseImport(JSON.stringify({ schema: 1, recipes: [recipe(), recipe()] })),
    /Duplicate/,
  );
  assert.throws(
    () => parseImport(JSON.stringify({ schema: 2, recipes: [] })),
    /Expected/,
  );
});
test("PF2e adapter separates events and suppresses private, remote, reroll messages", () => {
  const msg = {
    id: "m",
    author: { id: "u" },
    item: { name: "Ignition" },
    speaker: { token: "t", scene: "s" },
    flags: {
      pf2e: { context: { type: "attack-roll", outcome: "criticalSuccess" } },
    },
  };
  assert.equal(pf2eEvent(msg, "u").type, "attack");
  const nativeTarget = {
    ...msg,
    flags: {
      pf2e: {
        context: {
          type: "attack-roll",
          target: { token: "Scene.s.Token.target" },
        },
      },
    },
  };
  assert.equal(pf2eEvent(nativeTarget, "u").targetUuid, "Scene.s.Token.target");
  assert.equal(pf2eEvent(msg, "other"), null);
  assert.match(pf2eEvent({ ...msg, blind: true }, "u").skipped, /blind roll/);
  assert.match(pf2eEvent({ ...msg, whisper: ["g"] }, "u").skipped, /private roll/);
  // A reroll (a Hero Point) plays with its new result; one that kept the old roll changed nothing and stays quiet.
  const rerolled = (content) => ({ ...msg, content, flags: { ...msg.flags, pf2e: { ...msg.flags.pf2e, context: { ...msg.flags.pf2e.context, isReroll: true } } } });
  assert.equal(pf2eEvent(rerolled('<div class="reroll-discard">old</div><div class="reroll-second ">new</div>'), "u").type, pf2eEvent(msg, "u").type);
  assert.equal(pf2eEvent(rerolled('<div class="">old</div><div class="reroll-second reroll-discard">new</div>'), "u"), null);
  assert.equal(
    pf2eEvent({ ...msg, isDamageRoll: true, flags: {} }, "u").type,
    "damage",
  );
  assert.equal(
    pf2eEvent({ ...msg, isRoll: false, flags: {} }, "u").type,
    "use",
  );
  assert.equal(
    pf2eEvent(
      { ...msg, flags: { pf2e: { context: { type: "saving-throw" } } } },
      "u",
    ),
    null,
  );
});
test("D&D 5e adapter reads activity subject and skips anonymous global rolls", () => {
  assert.equal(dnd5eEvent("attack", null), null);
  const actor = { id: "a" },
    item = { name: "Fire Bolt", actor },
    subject = { item, actor, name: "Attack" };
  const e = dnd5eEvent("attack", subject, { rolls: [{ total: 12 }] });
  assert.equal(e.item, item);
  assert.equal(e.actor, actor);
  assert.equal(e.outcome, null);
  assert.match(dnd5eEvent("use", subject, { results: { message: { blind: true } } }).skipped, /blind roll/);
});
test("a recipe bound to a compendium spell also plays for the same spell from another book; one bound to a character's own item does not", () => {
  const spell = (uuid, extra = {}) => ({ id: "r", name: "Fireball look", trigger: "attack", enabled: true, match: "Fireball", itemUuid: uuid, stages: [], ...extra });
  const cast = (uuid) => ({ type: "attack", item: { name: "Fireball", uuid: `Actor.hero.Item.x`, _stats: { compendiumSource: uuid } } });
  const srd = spell("Compendium.dnd5e.spells.Item.fireball");
  assert.equal(matchRecipe([srd], cast("Compendium.dnd5e.spells.Item.fireball")), srd, "the bound spell itself");
  assert.equal(matchRecipe([srd], cast("Compendium.dnd-players-handbook.spells.Item.ztgcdrWPshKRpFd0")), srd, "the same spell from the 2024 Player's Handbook");
  assert.equal(matchRecipe([srd], { type: "attack", item: { name: "Fireball" } }), srd, "an imported copy with no compendium link");
  // The exact item still wins over a same-named one.
  const phb = spell("Compendium.dnd-players-handbook.spells.Item.ztgcdrWPshKRpFd0", { id: "phb" });
  assert.equal(matchRecipe([srd, phb], cast("Compendium.dnd-players-handbook.spells.Item.ztgcdrWPshKRpFd0")).id, "phb");
  // One hero's own spell: only theirs.
  const heroes = spell("Actor.hero.Item.x", { id: "hero" });
  assert.equal(matchRecipe([heroes], { type: "attack", item: { name: "Fireball", uuid: "Actor.other.Item.y" } }), null);
  assert.equal(matchRecipe([heroes], { type: "attack", item: { name: "Fireball", uuid: "Actor.hero.Item.x" } }), heroes);
});
test("a recipe for one activity plays for the same activity of the spell from another book (its activity has another id)", async () => {
  const { DND5E_ENTRIES, dndRecipe } = await import("../../scripts/catalogs/dnd5e/dnd5e-catalog.mjs");
  const entry = DND5E_ENTRIES.find((e) => e.kind === "spell" && e.slug === "fireball");
  const saved = { ...validateRecipe({ ...dndRecipe(entry, "dnd5eactivity000"), id: "my-fireball", enabled: true }) };
  assert.equal(saved.activityType, "save", "a customized copy remembers its activity's kind");
  const cast = (uuid, activityId, type = "save") => ({ type: saved.trigger, systemId: "dnd5e", activityId, activity: { id: activityId, type, name: "Save" },
    item: { name: "Fireball", uuid: "Actor.hero.Item.f", _stats: { compendiumSource: uuid } } });
  assert.equal(matchRecipe([saved], cast(saved.itemUuid, "dnd5eactivity000"))?.id, "my-fireball", "SRD 5.2's own Fireball");
  assert.equal(matchRecipe([saved], cast("Compendium.other.spells.Item.fb", "dNWpG5SEHROQG5AS"))?.id, "my-fireball", "another book's Fireball, another activity id");
  assert.equal(matchRecipe([saved], cast("Compendium.other.spells.Item.fb", "dNWpG5SEHROQG5AS", "attack")), null, "not a different kind of activity");
  assert.equal(matchRecipe([saved], cast(saved.itemUuid, "someOtherActivity")), null, "on the very item it was made for, only its own activity");
  // A recipe saved before activity kinds were remembered still plays for the other book's copy.
  const legacy = { ...saved, id: "old" }; delete legacy.activityType; delete legacy.activityName;
  assert.equal(matchRecipe([legacy], cast("Compendium.other.spells.Item.fb", "dNWpG5SEHROQG5AS"))?.id, "old");
});
test("a copy of a spell linked back to the SRD original, with activities of its own, plays the recipe; the original keeps its activities apart", async () => {
  const { DND5E_ENTRIES, dndRecipe } = await import("../../scripts/catalogs/dnd5e/dnd5e-catalog.mjs");
  const entry = DND5E_ENTRIES.find((e) => e.kind === "spell" && e.slug === "fireball");
  const saved = validateRecipe({ ...dndRecipe(entry, "dnd5eactivity000"), id: "mine", enabled: true });
  const cast = (activityId, activities, type = "save") => ({ type: saved.trigger, systemId: "dnd5e", activityId, activity: { id: activityId, type },
    item: { name: "Fireball", uuid: "Actor.hero.Item.f", _stats: { compendiumSource: saved.itemUuid }, system: { activities: new Map(activities.map((id) => [id, {}])) } } });
  // Another book built from the SRD: linked to the SRD Fireball, its save activity has a new id.
  assert.equal(matchRecipe([saved], cast("dNWpG5SEHROQG5AS", ["dNWpG5SEHROQG5AS"]))?.id, "mine");
  assert.equal(matchRecipe([saved], cast("dNWpG5SEHROQG5AS", ["dNWpG5SEHROQG5AS"], "attack")), null, "but not a different kind of activity");
  // The SRD Fireball itself, with a second activity of the same kind: only the recipe's own activity plays it.
  assert.equal(matchRecipe([saved], cast("second", ["dnd5eactivity000", "second"])), null);
  assert.equal(matchRecipe([saved], cast("dnd5eactivity000", ["dnd5eactivity000", "second"]))?.id, "mine");
});
test("a D&D 5e recipe plays for its spell in any language: the identifier matches when the name is translated", () => {
  const recipe = { id: "r", name: "My fireball", trigger: "template", enabled: true, match: "fireball", stages: [] };
  assert.equal(matchRecipe([recipe], { type: "template", item: { name: "Огненный шар", system: { identifier: "fireball" } } })?.id, "r");
  assert.equal(matchRecipe([recipe], { type: "template", item: { name: "Огненный шар", system: { identifier: "fire-storm" } } }), null);
});
