import {buildSpellDesign} from './twoe-spell-design.mjs';
import { writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { spellSources } from "./pf2e-source.mjs";
import { assetDatabases } from "./asset-databases.mjs";
import {
  SPELL_THEMES,
  DELIVERY_LABELS,
  spellRecipe,
} from "../scripts/catalogs/pf2e/spells/spell-choreography.mjs";
import { recipeDuration } from "../scripts/engines/playback/choreography.mjs";
import { SPELL_MOTIFS } from "../scripts/catalogs/pf2e/spells/spell-design.mjs";
import { auditDesigns } from "./design-audit.mjs";
import { resolveSpellMedia } from "./spell-asset-selection.mjs";
import { designMediaTiming } from "./media-timing.mjs";
import { MEDIA_DURATIONS } from "../data/media-durations.mjs";
import { allocateSpellIdentities } from './spell-variety-allocation.mjs';
import { diversifySpellMedia } from './spell-media-variety.mjs';

const [source, databases] = await Promise.all([
  spellSources(),
  assetDatabases(),
]);
const previous = process.argv.includes("--reuse-media") ? await import("../data/pf2e-spells.mjs") : null;
if (previous && previous.PF2E_SOURCE.sha !== source.sha) throw Error("Cannot reuse media from a different PF2e source revision.");
const previousById = new Map((previous?.PF2E_SPELLS ?? []).map(spell => [spell.id, spell]));
const assets = previous ? structuredClone((await import("../data/spell-assets.mjs")).SPELL_ASSETS) : {};
if (!previous) for (const [name, profile] of Object.entries(SPELL_THEMES))
  assets[name] = resolveSpellMedia(databases, name, profile);

const spells = source.spells.map(entry=>buildSpellDesign(entry,databases,previousById.get(entry.source._id)));

if (new Set(spells.map((s) => s.id)).size !== spells.length)
  throw Error(
    "Duplicate compendium spell IDs; inspect before claiming coverage.",
  );
const mediaVariety=diversifySpellMedia(spells,databases,SPELL_MOTIFS);
// Probe selected footage, with bounded workers and a shared media cache.
let next = 0;
await Promise.all(
  Array.from({ length: 4 }, async () => {
    while (next < spells.length) {
      const spell = spells[next++];
      if(spell.design.unavailable){spell.design.mediaTiming={};continue;}
      const cached = previousById.get(spell.id);
      if (cached && JSON.stringify(cached.design.assets) === JSON.stringify(spell.design.assets)) {
        // Keep reviewed arrival estimates while refreshing complete variant lifetimes.
        spell.design.mediaTiming = structuredClone(cached.design.mediaTiming ?? {});
        const missingSlots=Object.fromEntries(Object.entries(spell.design.assets).filter(([slot,keys])=>keys.length&&!spell.design.mediaTiming[slot]));
        if(Object.keys(missingSlots).length)Object.assign(spell.design.mediaTiming,await designMediaTiming(missingSlots,databases));
        for (const [slot, timing] of Object.entries(spell.design.mediaTiming)) {
          timing.duration = Math.max(timing.duration, ...(spell.design.assets[slot] ?? []).map(key => MEDIA_DURATIONS[key] ?? 0));
        }
      } else {
        spell.design.mediaTiming = await designMediaTiming(spell.design.assets, databases);
      }
    }
  }),
);
const identityAudit = allocateSpellIdentities(spells.filter(s=>!s.design.unavailable), s=>spellRecipe(s,assets,{motion:false,sound:false}), databases,
  new Map(source.spells.map(entry=>[entry.source._id,entry.source])));
identityAudit.mediaVariety=mediaVariety;
await writeFile(new URL('../data/pf2e-spell-variety-audit.json',import.meta.url),JSON.stringify(identityAudit,null,2)+'\n');
const counts = (field) =>
  Object.fromEntries(
    [...new Set(spells.map((s) => s[field]))]
      .sort()
      .map((key) => [key, spells.filter((s) => s[field] === key).length]),
  );
const designAudit = auditDesigns(
  spells,
  (s) => spellRecipe(s, assets),
  databases,
);
await writeFile(
  new URL("../data/pf2e-design-audit.json", import.meta.url),
  JSON.stringify(designAudit, null, 2) + "\n",
);
const metadata = {
  system: "pf2e",
  version: "8.6.0",
  ref: source.ref,
  sha: source.sha,
  source: `https://github.com/foundryvtt/pf2e/tree/${source.sha}/packs/pf2e/spells`,
  total: spells.length,
  designs: {
    descriptionsAnalyzed: designAudit.descriptionsAnalyzed,
    individuallyReviewed: designAudit.individuallyReviewed,
    distinctCompositions: designAudit.distinctCompositions,
    motionRecipes: designAudit.motionRecipes,
    motionStages: designAudit.motionStages,
    motifCount: Object.keys(designAudit.motifs).length,
    ready: spells.filter(s=>!s.design.unavailable).length,
    unconfigured: spells.filter(s=>s.design.unavailable).length,
  },
  sourceFiles: source.count,
  digest: createHash("sha256")
    .update(
      spells
        .map((s) => s.id)
        .sort()
        .join("\n"),
    )
    .digest("hex"),
  kinds: counts("kind"),
  editions: counts("edition"),
  quality: counts("quality"),
  themes: counts("theme"),
  deliveries: counts("delivery"),
  assets: Object.fromEntries(
    Object.entries(databases).map(([edition, rows]) => [edition, rows.length]),
  ),
};
await mkdir(new URL("../data/", import.meta.url), { recursive: true });
await writeFile(
  new URL("../data/spell-assets.mjs", import.meta.url),
  `// Generated from JB2A Free official database and installed Patreon database. No media bundled.\nexport const SPELL_ASSETS = ${JSON.stringify(assets, null, 2)};\n`,
);
await writeFile(
  new URL("../data/pf2e-spells.mjs", import.meta.url),
  `// Generated factual index from ${metadata.ref} (${metadata.sha}). No spell rules prose bundled.\nexport const PF2E_SOURCE = ${JSON.stringify(metadata, null, 2)};\nexport const PF2E_SPELLS = [\n${spells.map((s) => JSON.stringify(s)).join(",\n")}\n];\n`,
);
const csv = (v) => `"${String(v ?? "").replaceAll('"', '""')}"`;
const columns = [
  "name",
  "id",
  "rank",
  "kind",
  "edition",
  "traditions",
  "rarity",
  "traits",
  "theme",
  "delivery",
  "trigger",
  "quality",
  "choreography",
  "design",
  "design_rationale",
  "description_analysis",
  "token_motions",
  "shared_composition_count",
  "stage_timeline",
  "duration_ms",
  "patreon_media",
  "free_media",
  "notes",
  "source",
];
const editionKeys = Object.fromEntries(
  Object.entries(databases).map(([edition, rows]) => [
    edition,
    // Bespoke stages may name a key prefix (e.g. a sign without its colour);
    // the runtime resolves those to the first matching row.
    new Set(
      rows.flatMap((r) =>
        r.key.split(".").map((_, i, parts) => parts.slice(0, i + 1).join(".")),
      ),
    ),
  ]),
);
const timeline = (recipe) =>
  recipe.stages
    .map(
      (s) =>
        `${s.label}: ${s.kind} at ${s.delay}ms, ${s.duration}ms${s.repeats > 1 ? ` x${s.repeats}` : ""}${s.copies > 1 ? `, ${s.copies} copies` : ""}`,
    )
    .join("; ");
const editionMedia = (recipe, edition) =>
  recipe.stages
    .map((s) => {
      const key = s.assets.find((candidate) =>
        editionKeys[edition].has(candidate),
      );
      if (s.assets.length && !key)
        throw Error(`No ${edition} media for ${recipe.name}/${s.label}`);
      return `${s.label}: ${key ?? "native token artwork"}`;
    })
    .join("; ");
await writeFile(
  new URL("../data/pf2e-animation-catalog.csv", import.meta.url),
  "\ufeff" +
    [
      columns.join(","),
      ...spells.map((s) => {
        const recipe = spellRecipe(s, assets);
        return [
          s.name,
          s.id,
          s.rank,
          s.kind,
          s.edition,
          s.traditions.join("; "),
          s.rarity,
          s.traits.join("; "),
          s.theme,
          s.delivery,
          s.trigger,
          s.quality,
          DELIVERY_LABELS[s.delivery],
          s.design.label,
          s.design.rationale,
          !s.design.descriptionChars
            ? "No source description; native fields only"
            : s.design.authored
              ? "Full description individually reviewed"
              : "Full description analyzed by semantic rules",
          recipe.stages
            .filter((p) => p.kind === "motion")
            .map((p) => `${p.subject}: ${p.motion}`)
            .join("; "),
          s.design.sharedCount,
          s.design.unavailable?'':timeline(recipe),
          s.design.unavailable?0:recipeDuration(recipe),
          s.design.unavailable?'Needs configuration':editionMedia(recipe, "patreon"),
          s.design.unavailable?'Needs configuration':editionMedia(recipe, "free"),
          s.notes.join(" "),
          `https://github.com/foundryvtt/pf2e/blob/${metadata.sha}/${s.path}`,
        ]
          .map(csv)
          .join(",");
      }),
    ].join("\r\n") +
    "\r\n",
);
console.log(JSON.stringify(metadata, null, 2));
