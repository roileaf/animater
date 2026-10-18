import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { spellSources } from "./pf2e-source.mjs";
import { descriptionText } from "./spell-semantics.mjs";
import {
  PF2E_SPELLS,
  PF2E_SOURCE,
  spellRecipe,
} from "../scripts/catalogs/pf2e/spells/spell-catalog.mjs";
import { DELIVERY_DESIGNS } from "../scripts/catalogs/pf2e/spells/spell-delivery-designs.mjs";
import { timedStages } from "../scripts/engines/playback/composition.mjs";
const source = await spellSources(),
  byPath = new Map(source.spells.map((s) => [s.path, s.source]));
const issues = [],
  reviewed = [];
for (const spell of PF2E_SPELLS) {
  const native = byPath.get(spell.path),
    text = descriptionText(native?.system.description.value ?? "");
  if (
    createHash("sha256").update(text).digest("hex") !==
      spell.design.descriptionHash ||
    text.length !== spell.design.descriptionChars
  )
    issues.push({ spell: spell.name, issue: "source-description-mismatch" });
  const recipe = spellRecipe(spell),
    stages = timedStages(recipe);
  for (const stage of stages) {
    if (
      stage.kind === "travel" &&
      stage.duration < (spell.design.mediaTiming?.bolt?.duration ?? 0)
    )
      issues.push({
        spell: spell.name,
        stage: stage.label,
        issue: "truncated-native-flight",
      });
    if (
      stage.kind === "impact" &&
      stage.duration <
        (spell.design.mediaTiming?.hit?.duration ?? 0)
    )
      issues.push({
        spell: spell.name,
        stage: stage.label,
        issue: "truncated-native-contact",
      });
    if (
      ["travel", "projectile"].includes(stage.kind) &&
      !["targets", "area"].includes(stage.travelDestination)
    )
      issues.push({
        spell: spell.name,
        issue: "unresolved-flight-destination",
      });
  }
  if (
    DELIVERY_DESIGNS[spell.slug] ||
    [
      "forceShards",
      "thunderFall",
      "needleFlight",
      "energyRay",
      "darkRay",
      "icyRay",
      "flameRay",
      "prismaticRay",
      "divineRay",
      "lunarRay",
      "moonRay",
      "toxicRay",
    ].includes(spell.design.motif)
  )
    reviewed.push({
      id: spell.id,
      name: spell.name,
      descriptionChars: text.length,
      descriptionHash: spell.design.descriptionHash,
      motif: spell.design.motif,
      delivery: spell.delivery,
      rationale: spell.design.rationale,
      timing: spell.design.mediaTiming,
      stages: stages.map((s) => ({
        label: s.label,
        kind: s.kind,
        delay: s.delay,
        duration: s.duration,
        afterStage: s.afterStage,
        startOffset: s.startOffset,
        repeats: s.repeats,
        repeatScope: s.repeatScope,
        repeatInterval: s.repeatInterval,
        subject: s.subject,
        motion: s.motion,
        assets: s.assets,
        areaLayout: s.kind === "template" ? s.areaLayout : undefined,
      })),
      source: `https://github.com/foundryvtt/pf2e/blob/${source.sha}/${spell.path}`,
    });
}
const report = {
  source: PF2E_SOURCE.sha,
  total: PF2E_SPELLS.length,
  completeDescriptions: PF2E_SPELLS.filter((s) => s.design.descriptionChars)
    .length,
  emptyDescriptions: PF2E_SPELLS.filter((s) => !s.design.descriptionChars).map(
    (s) => s.name,
  ),
  authoredDeliveryCorrections: Object.keys(DELIVERY_DESIGNS).length,
  deliveryTreatments: reviewed.length,
  scope:
    "Full-description provenance and media-duration checks across the complete pinned catalog. Delivery-focused descriptions reviewed individually; this does not claim every catalog entry was manually read or watched.",
  method:
    "Actual installed footage duration; alpha-aware destination contact estimate with frame-reviewed Magic Missile arrival. Separate local impacts, overlapping total/per-target volleys, delayed outcomes, area line geometry and cosmetic token reactions. No game-state changes or copied external macro code.",
  issues,
  reviewed,
};
await writeFile(
  new URL("../data/pf2e-delivery-audit.json", import.meta.url),
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify({ ...report, reviewed: undefined }, null, 2));
if (issues.length) process.exitCode = 1;
