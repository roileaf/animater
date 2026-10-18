import test from "node:test";
import assert from "node:assert/strict";
import { PF2E_SPELLS, spellRecipe } from "../../scripts/catalogs/pf2e/spells/spell-catalog.mjs";
import { planRecipe } from "../../scripts/core/model.mjs";
import { recipeFrame } from "../../scripts/engines/playback/choreography.mjs";
import { chainPreview } from "../../scripts/engines/preview/chain-preview.mjs";
import { validateRecipe } from "../../scripts/core/model.mjs";
import { paceDeliveryEffects } from "../../scripts/catalogs/pf2e/spells/spell-delivery-timing.mjs";
import { visibleContact } from "../../tools/media-timing.mjs";
const spell = (n) => PF2E_SPELLS.find((s) => s.name === n);
test("Force Barrage shows complete flying shards and readable target contacts with matching cadence", () => {
  const recipe = spellRecipe(spell("Force Barrage"));
  const flight = recipe.stages.find((s) => s.kind === "travel"),
    impact = recipe.stages.find((s) => s.kind === "impact");
  assert.ok(
    flight.duration >= 1800,
    "native missile footage must reach the target",
  );
  assert.ok(
    impact.duration >= 800,
    "contact cannot end before the impact appears",
  );
  assert.ok(
    flight.repeatInterval > 0 && flight.repeatInterval < flight.duration,
    "volley launches overlap complete flights",
  );
  assert.equal(impact.repeatInterval, flight.repeatInterval);
  assert.equal(impact.afterStage, flight.stageId);
  assert.ok(
    impact.startOffset >= 900 && impact.startOffset <= 1300,
    "force contact follows the missile head, not transparent RGB padding",
  );
  assert.ok(
    recipe.stages.some((s) => s.kind === "motion" && s.subject === "targets"),
  );
  const catalog = [...new Set(recipe.stages.flatMap((s) => s.assets))].map(
    (key) => ({ key }),
  );
  const context = {
    source: { id: "caster", center: { x: 0, y: 0 } },
    targets: [{ id: "foe", center: { x: 300, y: 0 } }],
    gridSize: 100,
  };
  const plan = planRecipe(recipe, catalog, context),
    flights = plan.filter((s) => s.kind === "travel"),
    hits = plan.filter((s) => s.kind === "impact");
  assert.equal(flights.length, 3);
  assert.equal(hits.length, 3);
  for (let i = 0; i < 3; i++)
    assert.equal(hits[i].delay - flights[i].delay, impact.startOffset);
  const frame = recipeFrame(
    { ...recipe, playbackPlan: plan },
    hits[0].delay + 100,
  );
  assert.equal(frame.stages[recipe.stages.indexOf(impact)].state, "playing");
});
test("contact detection ignores RGB data in transparent pixels", () => {
  const frames = Buffer.alloc(16000 * 24);
  for (let f = 0; f < 24; f++)
    for (let y = 3; y < 37; y++) {
      const i = (f * 4000 + y * 100 + 80) * 4;
      frames[i] = 255;
      frames[i + 3] = f >= 20 ? 255 : 0;
    }
  assert.equal(visibleContact(frames, 1867, 80), 1000);
});
test("Thunderstrike lands its descending bolt on the target and follows with centered thunder", () => {
  const r = spellRecipe(spell("Thunderstrike")),
    lightning = r.stages.find((s) => s.label === "Descending lightning");
  assert.ok(lightning.duration >= 2000);
  assert.equal(lightning.fadeIn, 0);
  assert.ok(
    r.stages
      .find((s) => s.label === "Thunder ring")
      .assets.some((k) => k.includes("soundwave")),
  );
});
test("physical launch descriptions retain a flight; attacks appearing at foes have no caster flight", () => {
  for (const n of [
    "Barbed Spear",
    "Exploding Earth",
    "Hurtling Stone",
    "Glacial Skewer",
    "Percussive Impact",
    "Stone Lance",
    "Magnetic Acceleration",
    "Snowball",
    "Blood Chestnuts",
    "Magical Fetters",
    "Lightning Lasso",
    "Shadow Projectile",
    "Vital Seed",
  ])
    assert.ok(
      spellRecipe(spell(n)).stages.some((s) =>
        ["travel", "projectile"].includes(s.kind),
      ),
      n,
    );
  for (const n of [
    "Deity's Strike",
    "Flurry of Claws",
    "Glutton's Jaws",
    "Malicious Shadow",
    "Murderous Vine",
  ])
    assert.ok(
      !spellRecipe(spell(n)).stages.some((s) =>
        ["travel", "projectile"].includes(s.kind),
      ),
      n,
    );
});
test("Force Barrage total volley distributes through target order without multiplying shards or contacts", () => {
  const recipe = spellRecipe(spell("Force Barrage"));
  const catalog = [...new Set(recipe.stages.flatMap((s) => s.assets))].map(
    (key) => ({ key }),
  );
  for (const count of [1, 2, 3, 4]) {
    const targets = Array.from({ length: count }, (_, i) => ({
      id: `foe-${i}`,
      center: { x: 200 + i * 100, y: i * 100 },
    }));
    const plan = planRecipe(recipe, catalog, {
      source: { id: "caster", center: { x: 0, y: 0 } },
      targets,
      gridSize: 100,
    });
    for (const kind of ["travel", "impact"]) {
      const stages = plan
        .filter((s) => s.kind === kind)
        .sort((a, b) => a.iteration - b.iteration);
      assert.equal(stages.length, 3, `${count} targets, ${kind}`);
      assert.deepEqual(
        stages.map((s) => s.targetIndex),
        [0, 1 % count, 2 % count],
      );
      for (let i = 1; i < 3; i++)
        assert.equal(stages[i].delay - stages[i - 1].delay, 300);
    }
    const hit = plan.find((s) => s.kind === "impact");
    for (const motion of plan.filter(
      (s) => s.kind === "motion" && s.subject === "targets",
    )) {
      assert.ok(motion.targetIndex < 3);
      assert.equal(motion.delay, hit.delay + 30 + motion.targetIndex * 300);
    }
  }
  const expanded = chainPreview(recipe, {});
  assert.equal(
    expanded.recipe.playbackPlan.filter((s) => s.kind === "travel").length,
    3,
  );
  const time =
    expanded.recipe.playbackPlan.find((s) => s.kind === "impact").delay + 100;
  assert.equal(
    recipeFrame(expanded.recipe, time).stages[
      recipe.stages.findIndex((s) => s.kind === "travel")
    ].state,
    "playing",
  );
  assert.equal(
    recipeFrame(expanded.recipe, time).stages[
      recipe.stages.findIndex((s) => s.kind === "impact")
    ].state,
    "playing",
  );
});
test("catalog contact effects use targeted creatures when PF2e omits its target text", () => {
  for (const name of [
    "Doom Mark",
    "Inkshot",
    "Camel Spit",
    "Winter Bolt",
    "Snowball",
  ]) {
    const s = spell(name),
      recipe = spellRecipe(s);
    assert.equal(s.design.subject, "targets", name);
    assert.ok(
      recipe.stages.some((s) => s.kind === "impact"),
      name,
    );
  }
});
test("heightened three-action Force Barrage supports fifteen total shards in editable choreography", () => {
  const recipe = validateRecipe({
    ...spellRecipe(spell("Force Barrage")),
    stages: spellRecipe(spell("Force Barrage")).stages.map((s) =>
      ["travel", "impact"].includes(s.kind) ? { ...s, repeats: 15 } : s,
    ),
  });
  const catalog = [...new Set(recipe.stages.flatMap((s) => s.assets))].map(
    (key) => ({ key }),
  );
  const plan = planRecipe(recipe, catalog, {
    source: { id: "caster", center: { x: 0, y: 0 } },
    targets: [
      { id: "a", center: { x: 200, y: 0 } },
      { id: "b", center: { x: 300, y: 0 } },
    ],
    gridSize: 100,
  });
  assert.equal(plan.filter((s) => s.kind === "travel").length, 15);
  assert.equal(plan.filter((s) => s.kind === "impact").length, 15);
});
test("initial casting does not invent later explosions or outcome-dependent growth", () => {
  for (const name of ["Winter Bolt", "Blood Chestnuts"]) {
    const recipe = spellRecipe(spell(name));
    assert.ok(
      !recipe.stages.some((s) => s.label === "Lingering residue"),
      name,
    );
    assert.ok(
      !recipe.stages.some((s) => s.label?.toLowerCase().includes("explosion")),
      name,
    );
  }
  for (const name of ["Aqueous Blast", "Scorching Blast"]) {
    const recipe = spellRecipe(spell(name));
    assert.ok(
      !recipe.stages.some((s) =>
        ["travel", "projectile", "impact"].includes(s.kind),
      ),
      name,
    );
  }
  const vital = spellRecipe(spell("Vital Seed"));
  const flight = vital.stages.find((s) => s.kind === "travel"),
    hit = vital.stages.find((s) => s.kind === "impact");
  assert.equal(hit.afterStage, flight.stageId);
  assert.equal(
    vital.stages.find((s) => s.label === "Restorative pulse").afterStage,
    vital.stages.find((s) => s.label === "Vital energy returns").stageId,
  );
});
test("native clips are not double-moved or looped and hyphenated JB2A keys survive validation", () => {
  const paced = paceDeliveryEffects(
    [
      {
        kind: "projectile",
        stageId: "flight",
        delay: 200,
        duration: 500,
        perSquare: 100,
        moveDelay: 100,
      },
      { kind: "impact", delay: 600, duration: 180 },
    ],
    {
      mediaTiming: {
        bolt: { duration: 1867, baked: true, contact: 1100 },
        hit: { duration: 867 },
      },
    },
  );
  assert.equal(paced[0].kind, "travel");
  assert.equal(paced[0].perSquare, 0);
  assert.equal(paced[0].moveDelay, 0);
  assert.equal(paced[0].oneShot, true);
  assert.equal(paced[1].afterStage, "flight");
  assert.equal(paced[1].startOffset, 1100);
  assert.equal(
    validateRecipe({
      ...spellRecipe(spell("Force Barrage")),
      stages: [
        {
          kind: "cast",
          assets: ["jb2a.template_line.lava-spout.orange"],
          duration: 1000,
        },
      ],
    }).stages[0].assets[0],
    "jb2a.template_line.lava-spout.orange",
  );
});
test("line spell artwork distinguishes streams, thrown discs, stationary scenery and barriers", () => {
  for (const name of [
    "Lightning Bolt",
    "Enervation",
    "Radiant Beam",
    "Gust of Wind",
  ])
    assert.ok(
      spellRecipe(spell(name)).stages.some(
        (s) => s.kind === "template" && s.areaLayout === "fit",
      ),
      name,
    );
  const disc = spellRecipe(spell("Beheading Buzz Saw")).stages.find(
    (s) => s.kind === "template",
  );
  assert.ok(disc.assets.some((k) => /chakram|shield_attack/.test(k)));
  assert.ok(!disc.assets.some((k) => k.includes("breath_weapons")));
  for (const name of [
    "Glacial Causeway",
    "Pave Ground",
    "Scatter Scree",
    "Timber",
  ]) {
    const r = spellRecipe(spell(name));
    assert.ok(
      r.stages.some((s) => s.kind === "template" && s.areaLayout === "tiles"),
      name,
    );
    assert.ok(
      !r.stages.some((s) => ["travel", "projectile"].includes(s.kind)),
      name,
    );
  }
  assert.equal(
    spellRecipe(spell("Prismatic Wall")).stages.filter(
      (s) => s.kind === "template",
    ).length,
    7,
  );
});

test("arrow rain has flights, force rain uses its remote area and updraft lifts the affected creature", () => {
  const arrows = spellRecipe(spell("Arrow Salvo"));
  assert.ok(
    arrows.stages.some(
      (s) =>
        s.kind === "travel" &&
        s.travelDestination === "area" &&
        s.assets.some((k) => k.includes("arrow")),
    ),
  );
  const catalog = [...new Set(arrows.stages.flatMap((s) => s.assets))].map(
    (key) => ({ key }),
  );
  const area = { center: { x: 600, y: 0 }, diameter: 400 };
  const plan = planRecipe(arrows, catalog, {
    source: { id: "caster", center: { x: 0, y: 0 } },
    targets: [],
    template: { id: "burst" },
    area,
    gridSize: 100,
  });
  const flights = plan.filter((s) => s.kind === "travel");
  assert.equal(flights.length, 3);
  assert.ok(
    flights.every(
      (s) => s.endpoint.x === area.center.x && s.endpoint.y === area.center.y,
    ),
  );
  const rain = spellRecipe(spell("Force Rain"));
  assert.equal(rain.trigger, "template");
  assert.ok(rain.stages.some((s) => s.kind === "template"));
  assert.ok(
    spellRecipe(spell("Updraft")).stages.some(
      (s) =>
        s.kind === "motion" &&
        s.motion === "levitate" &&
        s.subject === "targets",
    ),
  );
  assert.ok(
    spellRecipe(spell("Home Among Mulberry Leaves")).stages.some(
      (s) => s.kind === "impact",
    ),
  );
});
