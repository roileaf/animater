import {catalogAuditEntries,auditScope} from './catalog-audit-entries.mjs';
import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { assetDatabases, variantFiles } from "./asset-databases.mjs";
import { PF2E_SPELLS, spellRecipe } from "../scripts/catalogs/pf2e/spells/spell-catalog.mjs";
import { PF2E_FEATS, featRecipe } from "../scripts/catalogs/pf2e/feats/feat-catalog.mjs";
import { PF2E_WEAPONS, weaponRecipe } from "../scripts/catalogs/pf2e/weapons/weapon-catalog.mjs";
const weaponUses = PF2E_WEAPONS.flatMap(w => w.modes.map(m => ({ ...w, usage: m.mode, id: `${w.id}-${m.mode}` })));
const weaponForUse = item => weaponRecipe({ ...item, id: item.id.replace(/-(melee|ranged|thrown)$/, "") }, item.usage);
import { resolveAsset } from "../scripts/core/model.mjs";

const exec = promisify(execFile),
  libraries = await assetDatabases();
const modulesRoot = fileURLToPath(new URL("../../", import.meta.url));
const native = new Map();
for (const rows of Object.values(libraries))
  for (const row of rows)
    for (const file of variantFiles(row)) {
      const path = resolve(modulesRoot, "..", file);
      if (existsSync(path)) native.set(basename(file), path);
    }
const cacheURL = new URL("../.cache/media-durations.json", import.meta.url);
let cache = {};
try {
  cache = JSON.parse(await readFile(cacheURL, "utf8"));
} catch {}
const pending = new Map();
const cachedFreeFiles = new Map();
async function nativePath(file) {
  const own = resolve(modulesRoot, "..", file);
  if (existsSync(own)) return own;
  const local = native.get(basename(file));
  if (local) return local;
  const prefix = "modules/JB2A_DnD5e/";
  if (!file.startsWith(prefix)) return null;
  const cached = new URL(
    `../.cache/free-media/${basename(file)}`,
    import.meta.url,
  );
  const source = `https://raw.githubusercontent.com/Jules-Bens-Aa/JB2A_DnD5e/main/${file.slice(prefix.length)}`;
  if (!existsSync(cached) && process.argv.includes("--fetch-missing-free")) {
    const response = await fetch(source);
    if (!response.ok)
      throw Error(`JB2A Free media fetch failed: ${response.status}: ${file}`);
    await mkdir(new URL("../.cache/free-media/", import.meta.url), {
      recursive: true,
    });
    await writeFile(cached, Buffer.from(await response.arrayBuffer()));
  }
  if (!existsSync(cached)) return null;
  cachedFreeFiles.set(file, { file, source });
  return fileURLToPath(cached);
}
async function measured(file) {
  const path = await nativePath(file);
  if (!path) return null;
  if (pending.has(path)) return pending.get(path);
  const promise = (async () => {
    const meta = await stat(path),
      stamp = `${meta.size}:${meta.mtimeMs}`;
    if (cache[path]?.stamp === stamp) return cache[path].duration;
    const { stdout } = await exec("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "csv=p=0",
      path,
    ]);
    const duration = Math.ceil(Number(stdout.trim()) * 1000);
    if (!Number.isFinite(duration) || duration <= 0)
      throw Error(`Invalid duration: ${file}`);
    cache[path] = { stamp, duration };
    return duration;
  })();
  pending.set(path, promise);
  return promise;
}
const selected = new Set();
for (const entry of catalogAuditEntries()) {
  const recipe = entry.build();
  for (const stage of recipe.stages)
    if (!["motion", "sound", "sprite"].includes(stage.kind))
      for (const edition of Object.keys(libraries)) {
        const key = resolveAsset(stage, libraries[edition]);
        if (key) selected.add(`${edition}:${key}`);
      }
}
const work = [...selected].map((id) => {
  const [edition, ...parts] = id.split(":");
  return { id, row: libraries[edition].find((r) => r.key === parts.join(":")) };
});
const media = {};
let next = 0;
await Promise.all(
  Array.from({ length: 8 }, async () => {
    while (next < work.length) {
      const { id, row } = work[next++];
      const files = [];
      for (const file of variantFiles(row)) {
        const duration = await measured(file);
        const exactInstalled = existsSync(resolve(modulesRoot, "..", file));
        files.push({ file, duration, exactInstalled,
          measurementSource: exactInstalled ? "installed" : duration === null ? "unavailable" : "reference-copy-or-cache" });
      }
      media[id] = {
        duration: Math.max(0, ...files.map((f) => f.duration ?? 0)),
        files,
      };
    }
  }),
);
await mkdir(new URL("../.cache/", import.meta.url), { recursive: true });
await writeFile(cacheURL, JSON.stringify(cache));
if (process.argv.includes("--write-durations")) {
  const durations = {};
  for (const [id, entry] of Object.entries(media)) {
    const key = id.slice(id.indexOf(":") + 1);
    if (entry.duration)
      durations[key] = Math.max(durations[key] ?? 0, entry.duration);
  }
  await writeFile(
    new URL("../data/media-durations.mjs", import.meta.url),
    `// Measured full clips across selected JB2A distance/random variants.\n// Rebuild: rtk proxy node tools/audit-media-completeness.mjs --write-durations\nexport const MEDIA_DURATIONS = ${JSON.stringify(Object.fromEntries(Object.entries(durations).sort()), null, 2)};\n`,
  );
}
const issues = [],
  fades = [],
  intentionalClips = [];
for (const entry of catalogAuditEntries()) {
    const {domain:kind,item}=entry; const recipe=entry.build();
    for (const [index, stage] of recipe.stages.entries())
      if (stage.oneShot || stage.kind === "travel")
        for (const edition of Object.keys(libraries)) {
          const key = resolveAsset(stage, libraries[edition]),
            entry = media[`${edition}:${key}`];
          if (!entry?.duration) continue;
          const clipEnd = stage.clipEnd
            ? Math.min(stage.clipEnd, entry.duration)
            : entry.duration;
          const required =
            Math.max(0, clipEnd - stage.clipStart) / stage.playbackRate;
          const detail = {
            kind,
            id: item.id,
            name: item.name,
            index,
            label: stage.label,
            edition,
            key,
            stageDuration: stage.duration,
            nativeDuration: entry.duration,
            requiredDuration: required,
          };
          if (stage.clipEnd || stage.clipStart) intentionalClips.push(detail);
          if (stage.duration + 1 < required) issues.push(detail);
          if (
            !stage.clipEnd &&
            !stage.clipStart &&
            stage.duration - required < stage.fadeOut &&
            stage.fadeOut > 0
          )
            fades.push(detail);
        }
  }
const mode = process.argv.includes("--baseline") ? "before" : "after";
const report = {
  scope:auditScope(),
  spells: PF2E_SPELLS.filter(s=>!s.design?.unavailable).length,
  unconfiguredSpells:PF2E_SPELLS.filter(s=>s.design?.unavailable).length,
  feats: PF2E_FEATS.length,
  weapons: PF2E_WEAPONS.length,
  weaponUses: weaponUses.length,
  selectedMedia: work.length,
  probedFiles: pending.size,
  cachedFreeFiles: [...cachedFreeFiles.values()],
  // Timing can be measured from an identical filename in another edition or
  // official cache. That never proves the original preview URL is available.
  installedAvailability: Object.fromEntries(Object.keys(libraries).map(edition => {
    const files = [...new Map(Object.entries(media).filter(([id]) => id.startsWith(`${edition}:`)).flatMap(([,m]) => m.files).map(f => [f.file, f])).values()];
    return [edition, { selectedFiles: files.length, exactPathsPresent: files.filter(f => f.exactInstalled).length,
      exactPathsAbsent: files.filter(f => !f.exactInstalled).map(f => f.file),
      referenceMeasurements: files.filter(f => !f.exactInstalled && f.duration !== null).length }];
  })),
  missingFiles: [
    ...new Set(
      Object.values(media).flatMap((m) =>
        m.files.filter((f) => f.duration === null).map((f) => f.file),
      ),
    ),
  ],
  issues,
  fades,
  intentionalClips,
  media,
};
await writeFile(
  new URL(`../data/pf2e-media-completeness-${mode}.json`, import.meta.url),
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  JSON.stringify(
    {
      spells: report.spells,
      unconfiguredSpells:report.unconfiguredSpells,
      feats: report.feats,
      weapons: report.weapons,
      weaponUses: report.weaponUses,
      selectedMedia: work.length,
      probedFiles: pending.size,
      missingFiles: report.missingFiles.length,
      installedAvailability: Object.fromEntries(Object.entries(report.installedAvailability).map(([edition, entry]) => [edition, { ...entry, exactPathsAbsent: entry.exactPathsAbsent.length }])),
      cutoffStages: issues.length,
      affectedSpells: new Set(
        issues.filter((i) => i.kind === "spell").map((i) => i.id),
      ).size,
      affectedFeats: new Set(
        issues.filter((i) => i.kind === "feat").map((i) => i.id),
      ).size,
      earlyFades: fades.length,
      examples: issues.slice(0, 10),
    },
    null,
    2,
  ),
);
if (
  mode === "after" &&
  (issues.length || fades.length || report.missingFiles.length)
)
  process.exitCode = 1;
