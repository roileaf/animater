import test from "node:test";
import assert from "node:assert/strict";
import { PF2E_SPELLS, spellRecipe } from "../../../scripts/catalogs/pf2e/spells/spell-catalog.mjs";
import { PF2E_FEATS, featRecipe } from "../../../scripts/catalogs/pf2e/feats/feat-catalog.mjs";
import { PF2E_WEAPONS, weaponRecipe } from "../../../scripts/catalogs/pf2e/weapons/weapon-catalog.mjs";
import { PF2E_ACTION_CATALOG, PF2E_FEATURE_CATALOG } from "../../../scripts/catalogs/pf2e/ability-catalog.mjs";

// Every installed candidate resolves, so each catalog picks its normal cues.
const sounds = { resolve: (c) => c, packs: [{ title: "Test pack" }] };
const cueVolumes = (recipe) => recipe.stages.filter((s) => s.kind === "sound" && s.soundFile).map((s) => s.volume);
// The slider must change every cue, and louder must never be quieter.
function assertSliderMatters(label, build) {
  const quiet = cueVolumes(build(0.15)), loud = cueVolumes(build(1));
  assert.ok(loud.length > 0, `${label}: has sound cues`);
  assert.equal(quiet.length, loud.length, `${label}: same cues at any volume`);
  quiet.forEach((v, i) => assert.ok(v < loud[i], `${label}: cue ${i} quieter at 15% (${v}) than 100% (${loud[i]})`));
}
const named = (list, name) => list.find((e) => e.name === name);

test("spell sounds slider scales spell cues", () => {
  assertSliderMatters("Fireball", (soundVolume) => spellRecipe(named(PF2E_SPELLS, "Fireball"), undefined, { sounds, soundVolume }));
});
test("feat sounds slider scales feat cues", () => {
  assertSliderMatters("Sudden Charge", (soundVolume) => featRecipe(named(PF2E_FEATS, "Sudden Charge"), { soundCatalog: sounds, soundVolume }));
});
test("action and feature sound sliders scale their cues", () => {
  const voiced = (catalog) => catalog.entries.find((e) => cueVolumes(catalog.recipe(e, { sound: true }, sounds)).length);
  for (const [catalog, entry] of [[PF2E_ACTION_CATALOG, PF2E_ACTION_CATALOG.entries.find((e) => e.name === "Demoralize")], [PF2E_FEATURE_CATALOG, voiced(PF2E_FEATURE_CATALOG)]])
    assertSliderMatters(entry.name, (soundVolume) => catalog.recipe(entry, { sound: true, soundVolume }, sounds));
});
test("weapon sounds slider scales weapon cues", () => {
  const weapon = named(PF2E_WEAPONS, "Longsword");
  assertSliderMatters("Longsword", (soundVolume) => weaponRecipe(weapon, weapon.modes[0].mode, { soundCatalog: sounds, soundVolume }));
});
test("D&D 5e and SF2e sound sliders also scale re-cued bespoke sounds", async () => {
  const { dndEntries, dndRecipe } = await import("../../../scripts/catalogs/dnd5e/dnd5e-catalog.mjs");
  const { sfEntries, sfRecipe } = await import("../../../scripts/catalogs/sf2e/sf2e-catalog.mjs");
  const dnd = dndEntries().find((e) => e.name === "Alter Self");
  const sf = sfEntries().find((e) => e.name === "Atomic Blast");
  assertSliderMatters("D&D Alter Self", (soundVolume) => dndRecipe(dnd, dnd.variants[0].id, { sounds, soundVolume }));
  assertSliderMatters("SF2e Atomic Blast", (soundVolume) => sfRecipe(sf, sf.variants[0].id, { sounds, soundVolume }));
});
