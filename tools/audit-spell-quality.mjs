import { writeFile } from "node:fs/promises";
import {
  PF2E_SOURCE,
  PF2E_SPELLS,
  spellRecipe,
} from "../scripts/catalogs/pf2e/spells/spell-catalog.mjs";
import {
  GENERATED_MOTION_DURATION,
  shakeCycles,
} from "../scripts/engines/motion/motion-pacing.mjs";
import { assetDatabases } from "./asset-databases.mjs";

const databases = await assetDatabases();
const editions = Object.fromEntries(
  Object.entries(databases).map(([edition, rows]) => [
    edition,
    {
      keys: new Set(rows.map((r) => r.key)),
      used: new Set(),
      bySpell: new Map(),
      missing: [],
    },
  ]),
);
const motions = {},
  shortMotions = [],
  acceleratedMedia = [];
for (const spell of PF2E_SPELLS) {
  const recipe = spellRecipe(spell);
  const selected = Object.fromEntries(
    Object.keys(editions).map((k) => [k, new Set()]),
  );
  for (const stage of recipe.stages) {
    if (stage.kind === "motion") {
      const row = (motions[stage.motion] ??= {
        stages: 0,
        minDuration: Infinity,
        maxDuration: 0,
        maxCyclesPerSecond: 0,
      });
      row.stages++;
      row.minDuration = Math.min(row.minDuration, stage.duration);
      row.maxDuration = Math.max(row.maxDuration, stage.duration);
      if (stage.motion === "shake")
        row.maxCyclesPerSecond = Math.max(
          row.maxCyclesPerSecond,
          (shakeCycles(stage) * 1000) / stage.duration,
        );
      if (stage.duration < GENERATED_MOTION_DURATION[stage.motion])
        shortMotions.push({
          spell: spell.name,
          motion: stage.motion,
          duration: stage.duration,
        });
    } else if (stage.playbackRate > 1)
      acceleratedMedia.push({
        spell: spell.name,
        stage: stage.label,
        rate: stage.playbackRate,
        reviewed:
          spell.slug === "haste" &&
          stage.label === "Quick trails" &&
          stage.playbackRate === 1.7,
        rationale:
          spell.slug === "haste" && stage.label === "Quick trails"
            ? "Intentional accelerated trails express Haste's quickened movement."
            : "Needs review",
      });
    if (!stage.assets.length) continue;
    for (const [edition, state] of Object.entries(editions)) {
      const key = stage.assets.find((k) => state.keys.has(k));
      if (!key) state.missing.push({ spell: spell.name, stage: stage.label });
      else {
        state.used.add(key);
        selected[edition].add(key);
      }
    }
  }
  for (const [edition, keys] of Object.entries(selected))
    for (const key of keys)
      editions[edition].bySpell.set(
        key,
        (editions[edition].bySpell.get(key) ?? 0) + 1,
      );
}
const report = {
  source: PF2E_SOURCE.sha,
  spells: PF2E_SPELLS.length,
  designs: PF2E_SOURCE.designs,
  motions,
  shortMotions,
  acceleratedMedia,
  editions: Object.fromEntries(
    Object.entries(editions).map(([edition, state]) => [
      edition,
      {
        inventoryKeys: state.keys.size,
        selectedKeys: state.used.size,
        selectedFamilies: new Set([...state.used].map((k) => k.split(".")[1]))
          .size,
        mostReused: [...state.bySpell]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([key, spells]) => ({ key, spells })),
        giantHandSpells: state.bySpell.get("jb2a.arcane_hand.purple") ?? 0,
        missing: state.missing,
      },
    ]),
  ),
};
await writeFile(
  new URL("../data/pf2e-quality-audit.json", import.meta.url),
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report, null, 2));
if (
  shortMotions.length ||
  acceleratedMedia.some((s) => !s.reviewed) ||
  Object.values(editions).some((e) => e.missing.length)
)
  process.exitCode = 1;
