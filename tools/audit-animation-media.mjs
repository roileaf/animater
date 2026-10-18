import { writeFile } from "node:fs/promises";
import { assetDatabases } from "./asset-databases.mjs";
import { PF2E_SPELLS, spellRecipe } from "../scripts/catalogs/pf2e/spells/spell-catalog.mjs";
import { resolveAsset } from "../scripts/core/model.mjs";
import { assetGeometry } from "./spell-asset-selection.mjs";
// Individually checked against the first substantive PF2e description opening.
const directRays = new Set([
  "Admonishing Ray",
  "Blazing Bolt",
  "Call of the Grave",
  "Chilling Darkness",
  "Chromatic Ray",
  "Disintegrate",
  "Divine Lance",
  "Fire Ray",
  "Holy Light",
  "Moonbeam",
  "Moonlight Ray",
  "Polar Ray",
  "Ray of Corruption",
  "Ray of Frost",
  "Sun Blade",
]);
const libraries = await assetDatabases();
const reports = {};
for (const [edition, entries] of Object.entries(libraries)) {
  const keys = new Map(entries.map((e) => [e.key, e]));
  const auditedRaySpells = new Set();
  const used = new Set(),
    families = new Set(),
    issues = [];
  let effects = 0,
    rays = 0;
  for (const spell of PF2E_SPELLS) {
    const recipe = spellRecipe(spell);
    for (const [index, stage] of recipe.stages.entries()) {
      if (["motion", "sprite", "sound"].includes(stage.kind)) continue;
      effects++;
      const key = resolveAsset(stage, entries),
        entry = keys.get(key);
      if (!entry) {
        issues.push({
          spell: spell.name,
          index,
          kind: stage.kind,
          issue: "missing-key",
        });
        continue;
      }
      used.add(key);
      families.add(key.split(".")[1]);
      const shape = assetGeometry(entry);
      const ranged = ["beam", "line", "projectile"].includes(shape);
      if (stage.kind === "travel" && !ranged)
        issues.push({
          spell: spell.name,
          index,
          kind: stage.kind,
          key,
          issue: "stationary-art-stretched-as-travel",
        });
      const fittedLine =
        stage.kind === "template" &&
        recipe.previewArea?.type === "line" &&
        stage.areaLayout === "fit";
      if (
        ["cast", "impact", "aura", "template"].includes(stage.kind) &&
        ranged &&
        !fittedLine
      )
        issues.push({
          spell: spell.name,
          index,
          kind: stage.kind,
          key,
          issue: "directional-art-centered-on-token",
        });
      if (stage.kind === "travel" && directRays.has(spell.name)) {
        rays++;
        auditedRaySpells.add(spell.name);
        if (!["beam", "line"].includes(shape))
          issues.push({
            spell: spell.name,
            index,
            kind: stage.kind,
            key,
            issue: "ray-uses-non-beam-art",
          });
      }
    }
  }
  for (const name of directRays)
    if (!auditedRaySpells.has(name))
      issues.push({ spell: name, issue: "direct-ray-has-no-beam-stage" });
  reports[edition] = {
    inventoryKeys: entries.length,
    inventoryFamilies: new Set(entries.map((e) => e.key.split(".")[1])).size,
    spells: PF2E_SPELLS.length,
    baseEffectStages: effects,
    usedKeys: used.size,
    usedFamilies: families.size,
    rayStages: rays,
    auditedDirectRaySpells: auditedRaySpells.size,
    issues,
    selectedFamilies: [...families].sort(),
  };
}
const mode = process.argv.includes("--baseline") ? "before" : "after";
const path = new URL(`../data/pf2e-media-audit-${mode}.json`, import.meta.url);
await writeFile(path, JSON.stringify(reports, null, 2) + "\n");
console.log(
  JSON.stringify(
    Object.fromEntries(
      Object.entries(reports).map(
        ([edition, { issues, selectedFamilies, ...metrics }]) => [
          edition,
          { ...metrics, issues: issues.length, examples: issues.slice(0, 8) },
        ],
      ),
    ),
    null,
    2,
  ),
);
if (Object.values(reports).some((r) => r.issues.length)) process.exitCode = 1;
