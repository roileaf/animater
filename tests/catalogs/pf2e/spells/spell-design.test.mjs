import test from "node:test";
import assert from "node:assert/strict";
import {
  PF2E_SPELLS,
  PF2E_SOURCE,
  spellRecipe,
  automaticCatalogRecipe,
} from "../../../../scripts/catalogs/pf2e/spells/spell-catalog.mjs";
import { planRecipe } from "../../../../scripts/core/model.mjs";
import { analyzeSpellDescription } from "../../../../tools/spell-semantics.mjs";
import { visualFingerprint } from "../../../../tools/design-audit.mjs";
import { timedStages } from "../../../../scripts/engines/playback/composition.mjs";
const record = (name) => PF2E_SPELLS.find((s) => s.name === name);
const recipe = (name) => spellRecipe(record(name));
const catalog = [{ key: "jb2a.beam", file: "beam.webm" }];
test("full descriptions are analyzed including narrative beyond the old 900-character cutoff", () => {
  const item = {
    name: "Test",
    system: {
      description: {
        value: `<p>${"Long narrative. ".repeat(80)}You push the creature back and deal persistent fire damage.</p>`,
      },
      target: { value: "1 creature" },
      time: { value: "2" },
      traits: { value: [] },
      damage: {},
    },
  };
  const d = analyzeSpellDescription(item, {
    slug: "test",
    theme: "fire",
    delivery: "target",
    kind: "spell",
  });
  assert.ok(d.descriptionChars > 900);
  assert.equal(d.push, true);
  assert.equal(d.persistent, true);
  assert.equal(d.analysis, "full-description");
  assert.match(d.descriptionHash, /^[a-f0-9]{64}$/);
  assert.equal(
    PF2E_SOURCE.designs.descriptionsAnalyzed,
    PF2E_SPELLS.filter((s) => s.design.descriptionChars > 0).length,
  );
  assert.ok(
    PF2E_SPELLS.filter((s) => !s.design.descriptionChars).every(
      (s) => s.design.analysis === "native-fields-only",
    ),
  );
});
test("authored spell fiction changes delivery, token subject and projectile count", () => {
  assert.ok(!recipe("Ignition").stages.some((s) => s.kind === "travel"));
  assert.ok(
    recipe("Frostbite").stages.some(
      (s) =>
        s.kind === "aura" && s.subject === "targets" && s.scaleInDuration > 0,
    ),
  );
  assert.ok(
    recipe("Frostbite").stages.some(
      (s) =>
        s.kind === "motion" && s.motion === "shake" && s.subject === "targets",
    ),
  );
  assert.equal(
    recipe("Needle Darts").stages.find((s) => s.kind === "travel").repeats,
    3,
  );
  assert.equal(
    recipe("Blazing Bolt").stages.find((s) => s.kind === "travel").repeats,
    1,
  );
  const mirror = recipe("Mirror Image").stages.find((s) => s.kind === "sprite");
  const blur = recipe("Blur").stages.find((s) => s.kind === "sprite");
  assert.deepEqual([mirror.copies, mirror.subject], [3, "source"]);
  assert.deepEqual([blur.copies, blur.subject], [2, "targets"]);
  assert.ok(recipe("Fly").stages.some((s) => s.kind === "sprite" && s.shadow));
  assert.ok(
    recipe("Fly").stages.some(
      (s) =>
        s.kind === "motion" &&
        s.motion === "levitate" &&
        s.subject === "targets",
    ),
  );
});
test("effects-only catalog preserves VFX and removes native token motion without changing saved recipes", () => {
  for (const s of PF2E_SPELLS) {
    const full = spellRecipe(s),
      effects = spellRecipe(s, undefined, { motion: false });
    const resolvedEffects = r => timedStages(r).filter(p => p.kind !== 'motion')
      .map(p => ({...p,afterStage:'',timingAnchor:'end',startOffset:0}));
    assert.deepEqual(
      resolvedEffects(effects),
      resolvedEffects(full),
      s.name,
    );
  }
  const s = record("Frostbite");
  const r = automaticCatalogRecipe(
    {
      type: s.trigger,
      item: { type: "spell", name: s.name, system: { slug: s.slug } },
    },
    { enabled: true, motion: false },
  );
  assert.ok(r.stages.every((p) => p.kind !== "motion"));
});
test("self, ceremony and area recipes play without requiring unrelated creature targets", () => {
  const source = { id: "caster", center: { x: 0, y: 0 } };
  for (const s of PF2E_SPELLS.filter((s) => !s.design.unavailable &&
    [
      "self",
      "emanation",
      "portal",
      "transform",
      "point",
      "ritual",
      "burst",
      "cone",
      "line",
      "wall",
    ].includes(s.delivery),
  )) {
    const r = spellRecipe(s);
    const db = r.stages.flatMap((p) =>
      p.assets.map((key) => ({ key, file: `${key}.webm` })),
    );
    assert.doesNotThrow(
      () =>
        planRecipe(r, db, {
          source,
          targets: [],
          template: { id: "circle" },
          area: { type:s.area?.type==='cone'?'cone':s.area?.type==='line'?'line':'circle',center: { x: 300, y: 0 },endpoint:{x:600,y:0},length:300,width:300,angle:90, diameter: 300 },
        }),
      s.name,
    );
  }
});
test("similar spells retain visibly different compositions and audit ignores names, IDs and inactive tint", () => {
  for (const [a, b] of [
    ["Ignition", "Frostbite"],
    ["Heal", "Soothe"],
    ["Harm", "Void Warp"],
    ["Haste", "Slow"],
    ["Shield", "Glass Shield"],
    ["Shield", "Bone Shield"],
    ["Mirror Image", "Blur"],
    ["Translocate", "Teleport"],
  ])
    assert.notEqual(
      visualFingerprint(recipe(a), catalog),
      visualFingerprint(recipe(b), catalog),
      `${a}/${b}`,
    );
  const r = recipe("Frostbite"),
    renamed = structuredClone(r);
  renamed.name = "Anything";
  renamed.stages.forEach((s, i) => {
    s.stageId = `renamed-${i}`;
    s.label = "Different";
    s.tint = "#010101";
  });
  assert.equal(
    visualFingerprint(r, catalog),
    visualFingerprint(renamed, catalog),
  );
  assert.ok(PF2E_SPELLS.filter(s=>s.design.unavailable).every(s=>s.design.sharedCount===0),'unfinished drafts must not claim distinct animation compositions');
});
test("beam plans route chain through actual targets and drain back to caster; other stages keep token references out", () => {
  const source = { id: "source" },
    targets = [{ id: "first" }, { id: "second" }, { id: "third" }];
  const r = recipe("Chain Lightning");
  r.stages = r.stages
    .filter((s) => s.kind === "travel")
    .map((s) => ({ ...s, assets: ["jb2a.beam"] }));
  const plan = planRecipe(r, catalog, { source, targets });
  assert.deepEqual(
    plan.map((s) => [s.origin.id, s.endpoint.id, s.delay]),
    [
      ["source", "first", r.stages[0].delay],
      ["first", "second", r.stages[0].delay + 260],
      ["second", "third", r.stages[0].delay + 520],
    ],
  );
  r.stages[0].travelOrigin = "target";
  assert.deepEqual(
    planRecipe(r, catalog, { source, targets }).map((s) => [
      s.origin.id,
      s.endpoint.id,
    ]),
    [
      ["first", "source"],
      ["second", "source"],
      ["third", "source"],
    ],
  );
  r.stages[0].travelOrigin = "source";
  assert.ok(
    planRecipe(r, catalog, { source, targets }).every(
      (s) => s.origin === source,
    ),
  );
  r.stages = [
    {
      ...r.stages[0],
      kind: "motion",
      assets: [],
      subject: "source",
      motion: "pulse",
    },
  ];
  const motion = planRecipe(r, catalog, { source, targets })[0];
  assert.equal(motion.origin, undefined);
  assert.equal(motion.endpoint, undefined);
});
