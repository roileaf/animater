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
