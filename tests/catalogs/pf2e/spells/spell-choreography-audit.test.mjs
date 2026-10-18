import test from "node:test";
import assert from "node:assert/strict";
import { spellRecipe } from "../../../../scripts/catalogs/pf2e/spells/spell-choreography.mjs";
import {
  SPELL_MOTIFS,
  AUTHORED_SPELL_DESIGNS,
} from "../../../../scripts/catalogs/pf2e/spells/spell-design.mjs";
import { resolveSpellMedia } from "../../../../tools/spell-asset-selection.mjs";
const recipe = (motif, extra = {}) =>
  spellRecipe({
    id: "reviewed",
    name: "Reviewed spell",
    slug: "reviewed",
    rank: 2,
    theme: "arcane",
    delivery: "bolt",
    trigger: "attack",
    notes: [],
    ...extra,
    design: {
      motif,
      label: motif,
      rationale: "Description-reviewed fixture",
      subject: "targets",
      actions: 2,
      assets: {
        cast: ["jb2a.cast"],
        bolt: ["jb2a.flight"],
        hit: ["jb2a.impact"],
        aura: ["jb2a.residue"],
        area: ["jb2a.area"],
      },
      ...extra.design,
    },
  });
test("thrown acid and saltwater are moving glob objects, not focused rays", () => {
  for (const motif of ["acidSplash", "waterBolt"]) {
    const r = recipe(motif);
    assert.equal(
      r.stages.filter((s) => s.kind === "projectile").length,
      1,
      motif,
    );
    assert.ok(!r.stages.some((s) => s.kind === "travel"), motif);
    assert.ok(
      r.stages.some((s) => s.kind === "impact"),
      motif,
    );
  }
});
test("arrow, hollow icicle and single force bolt remain single missile flights", () => {
  for (const motif of ["acidArrow", "iceShard", "forceBolt", "vitalBolt"]) {
    const r = recipe(motif),
      flight = r.stages.find((s) => s.kind === "travel");
    assert.ok(flight, motif);
    assert.equal(flight.repeats, 1, motif);
    assert.ok(!flight.label.includes("ray"), motif);
  }
});
test("Spiritual Armament flies outward and returns; Spiritual Weapon materializes at foe without caster lunge", () => {
  const armament = recipe("spiritualArmament"),
    weapon = recipe("spiritualWeapon", { delivery: "target" });
  const flights = armament.stages.filter((s) => s.kind === "projectile");
  assert.equal(flights.length, 2);
  assert.equal(flights[0].travelOrigin, "source");
  assert.equal(flights[1].travelOrigin, "target");
  assert.ok(weapon.stages.some((s) => s.kind === "impact"));
  assert.ok(
    !weapon.stages.some(
      (s) =>
        s.kind === "motion" && s.subject === "source" && s.motion === "lunge",
    ),
  );
});
test("reviewed ray roots and focused rays do not reuse bolt or vertical impact artwork", () => {
  for (const motif of [
    "divineRay",
    "moonRay",
    "darkRay",
    "toxicRay",
    "prismaticRay",
  ]) {
    assert.ok(SPELL_MOTIFS[motif], motif);
    assert.match(
      SPELL_MOTIFS[motif].bolt,
      /energy_beam|ray_of_frost|disintegrate/,
    );
    assert.doesNotMatch(
      SPELL_MOTIFS[motif].bolt,
      /guiding_bolt|divine_smite|moonbeam/,
    );
    assert.equal(
      recipe(motif).stages.filter((s) => s.kind === "travel").length,
      1,
    );
  }
  assert.equal(AUTHORED_SPELL_DESIGNS["holy-light"][0], "divineRay");
});
test("staggered fire ray reactions follow each target's own contact", () => {
  const r = recipe("flameRay");
  const flight = r.stages.find((s) => s.kind === "travel");
  const contact = r.stages.find((s) => s.kind === "impact");
  const reaction = r.stages.find((s) => s.kind === "motion");
  assert.equal(contact.afterStage, flight.stageId);
  assert.equal(reaction.afterStage, contact.stageId);
  assert.equal(reaction.targetStagger, 0);
  assert.equal(contact.targetStagger, 0); // target staggering is inherited once
});
test("ground crush and shadow tendrils use expanding then closing local or area shapes", () => {
  const crush = recipe("groundCrush", { delivery: "target" });
  assert.ok(
    crush.stages.some(
      (s) => s.kind === "impact" && s.scaleOutDuration > 0 && s.scaleOut < 1,
    ),
  );
  const tendrils = recipe("shadowTendrils", {
    delivery: "burst",
    design: { subject: "source" },
  });
  assert.ok(tendrils.stages.some((s) => s.kind === "template"));
  assert.ok(
    !tendrils.stages.some((s) => s.kind === "travel" || s.kind === "motion"),
  );
});
test("lunar casting cues stay silvery when native damage theme is fire", () => {
  const rows = [
    {
      key: "jb2a.cast_generic.fire.01.orange",
      file: "GenericCastFire_01_Orange_400x400.webm",
    },
    {
      key: "jb2a.cast_generic.02.blue",
      file: "GenericCast_01_Blue_400x400.webm",
    },
    {
      key: "jb2a.cast_generic.03.white",
      file: "GenericCast_03_White_600x600.webm",
    },
    {
      key: "jb2a.energy_beam.normal.blue.01",
      file: "EnergyBeam_01_Blue_15ft_1000x400.webm",
    },
    { key: "jb2a.impact.001.blue", file: "Impact_01_Blue_400x400.webm" },
  ];
  const databases = { patreon: rows, free: rows };
  const defaults = {
    cast: "cast_generic.fire",
    bolt: "energy_beam",
    hit: "impact",
    aura: "impact",
    area: "impact",
  };
  for (const motif of ["lunarRay", "moonRay"]) {
    const selected = resolveSpellMedia(
      databases,
      "fire",
      SPELL_MOTIFS[motif],
      defaults,
      { name: "Moonbeam", design: { pattern: "ray" } },
    );
    assert.ok(
      selected.cast.every((key) => /blue|white/.test(key)),
      JSON.stringify(selected.cast),
    );
  }
});
test("Murder of Crows sends a flock to one creature, then torments it without an energy ray", () => {
  const r = recipe("crowFlock");
  assert.equal(r.stages.filter((s) => s.kind === "projectile").length, 1);
  assert.ok(
    !r.stages.some((s) => s.kind === "travel" || s.kind === "template"),
  );
  assert.ok(
    r.stages.some(
      (s) => s.kind === "impact" && s.label === "Flock torments target",
    ),
  );
  assert.equal(SPELL_MOTIFS.crowFlock.symbolic, true);
  assert.equal(AUTHORED_SPELL_DESIGNS["murder-of-crows"][0], "crowFlock");
  assert.match(AUTHORED_SPELL_DESIGNS["murder-of-crows"][1], /bats.*stand in/i);
});
