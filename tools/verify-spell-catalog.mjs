import { writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { assetDatabases } from "./asset-databases.mjs";
import {
  PF2E_SPELLS,
  PF2E_SOURCE,
  spellRecipe,
} from "../scripts/catalogs/pf2e/spells/spell-catalog.mjs";
import { planRecipe } from "../scripts/core/model.mjs";
const databases = await assetDatabases();
const source = { id: "source", center: { x: 0, y: 0 }, w: 100, h: 100 };
const target = { id: "target", center: { x: 300, y: 0 }, w: 100, h: 100 };
const context = {
  source,
  targets: [target],
  gridSize: 100,
  template: { id: "area" },
  area: { center: { x: 300, y: 0 }, diameter: 400 },
};
const report = { source: PF2E_SOURCE, editions: {}, missingFiles: [] };
for (const [edition, catalog] of Object.entries(databases)) {
  const files = new Set();
  let effects = 0;
  for (const record of PF2E_SPELLS) {
    if(record.design?.unavailable)continue;
    const recipe = spellRecipe(record);
    const shape = recipe.previewArea?.type ?? record.area?.type;
    const length=(recipe.previewArea?.value ?? record.area?.value ?? 20)*20;
    const directional = ['line','cone'].includes(shape);
    const ctx = directional
      ? {
          ...context,
          area: {
            type: shape,
            center: { x: 0, y: 0 },
            endpoint: { x: length, y: 0 },
            length,
            width: (recipe.previewArea?.width ?? 5)*20,
            angle:90,
          },
        }
      : {...context,area:{type:['square','cube'].includes(shape)?'square':'circle',center:target.center,diameter:length*(['square','cube'].includes(shape)?1:2)}};
    const plan = planRecipe(recipe, catalog, ctx);
    effects += plan.length;
    for (const effect of plan)
      if (effect.asset)
        files.add(catalog.find((e) => e.key === effect.asset).file);
  }
  report.editions[edition] = {
    spells: PF2E_SPELLS.filter(s=>!s.design?.unavailable).length,
    unconfigured:PF2E_SPELLS.filter(s=>s.design?.unavailable).length,
    effects,
    uniqueMedia: files.size,
    missingAssets: 0,
  };
  if (edition === "patreon")
    for (const file of files)
      if (
        !existsSync(
          resolve(fileURLToPath(new URL("../../..", import.meta.url)), file),
        )
      )
        report.missingFiles.push(file);
  console.log(edition, report.editions[edition]);
}
if (report.missingFiles.length)
  throw Error(`Installed media missing: ${report.missingFiles.join(", ")}`);
await writeFile(
  new URL("../data/pf2e-catalog-coverage.json", import.meta.url),
  JSON.stringify(report, null, 2) + "\n",
);
