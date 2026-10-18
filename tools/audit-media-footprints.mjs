import {catalogAuditEntries,auditScope} from './catalog-audit-entries.mjs';
// Measure visible alpha, not RGB (transparent video pixels retain RGB noise).
// Reference copies provide artwork measurements, never proof a URL is installed.
import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { assetDatabases, variantFiles } from "./asset-databases.mjs";
import { PF2E_SPELLS, spellRecipe } from "../scripts/catalogs/pf2e/spells/spell-catalog.mjs";
import { PF2E_FEATS, featRecipe } from "../scripts/catalogs/pf2e/feats/feat-catalog.mjs";
import { PF2E_WEAPONS, weaponRecipe } from "../scripts/catalogs/pf2e/weapons/weapon-catalog.mjs";
import { resolveAsset } from "../scripts/core/model.mjs";
import { PF2E_CONDITIONS, PF2E_EFFECTS, stateRecipe } from "../scripts/catalogs/pf2e/state-catalog.mjs";

const exec = promisify(execFile), libraries = await assetDatabases();
const dataRoot = fileURLToPath(new URL("../../../", import.meta.url));
const native = new Map();
for (const rows of Object.values(libraries)) for (const row of rows)
  for (const file of variantFiles(row)) {
    const path = resolve(dataRoot, file);
    if (existsSync(path)) native.set(basename(file), path);
  }
const recipes = [...catalogAuditEntries().map(e=>e.build()),...PF2E_EFFECTS.filter(e=>e.auras||e.auraSources).map(e=>stateRecipe(e,{aura:null}))];
const selected = new Map();
for (const [edition, rows] of Object.entries(libraries)) {
  const byKey = new Map(rows.map(r => [r.key, r]));
  for (const recipe of recipes) for (const s of recipe.stages) {
    if (["travel", "overlay", "motion", "sound", "sprite"].includes(s.kind)) continue;
    const row = byKey.get(resolveAsset(s, rows));
    if (!row) continue;
    for (const file of variantFiles(row)) selected.set(file, { file, edition });
  }
}
const cacheURL = new URL("../.cache/media-footprints.json", import.meta.url);
let cache = {};
try { cache = JSON.parse(await readFile(cacheURL, "utf8")); } catch {}
const pending = new Map(), records = [], profiles = {};
async function locate(file) {
  const path = resolve(dataRoot, file);
  if (existsSync(path)) return { path, source: "installed" };
  const reference = native.get(basename(file));
  if (reference) return { path: reference, source: "same-filename-reference" };
  if (!file.startsWith("modules/JB2A_DnD5e/")) return null;
  const cached = new URL(`../.cache/free-media/${basename(file)}`, import.meta.url);
  if (!existsSync(cached) && process.argv.includes("--fetch-missing-free")) {
    const response = await fetch(`https://raw.githubusercontent.com/Jules-Bens-Aa/JB2A_DnD5e/main/${file.slice("modules/JB2A_DnD5e/".length)}`);
    if (!response.ok) throw Error(`Free footprint fetch failed ${response.status}: ${file}`);
    await mkdir(new URL("../.cache/free-media/", import.meta.url), { recursive: true });
    await writeFile(cached, Buffer.from(await response.arrayBuffer()));
  }
  return existsSync(cached) ? { path: fileURLToPath(cached), source: "official-free-cache" } : null;
}
async function measure(path) {
  if (pending.has(path)) return pending.get(path);
  const run = (async () => {
    const info = await stat(path), stamp = `${info.size}:${info.mtimeMs}`;
    if (cache[path]?.stamp === stamp) return cache[path].profile;
    const { stdout } = await exec("ffprobe", ["-v", "error", "-show_entries", "stream=codec_name,width,height", "-of", "json", path]);
    const m = JSON.parse(stdout).streams[0], width = 128;
    const height = Math.max(1, Math.round(width * m.height / m.width));
    const { stdout: frames } = await exec("ffmpeg", [
      "-v", "error", "-threads", "1", "-filter_threads", "1", "-c:v",
      m.codec_name === "vp8" ? "libvpx" : "libvpx-vp9", "-i", path,
      "-vf", `fps=6,scale=${width}:${height},format=rgba`, "-f", "rawvideo", "-pix_fmt", "rgba", "pipe:1",
    ], { encoding: "buffer", maxBuffer: 64 * 1024 * 1024 });
    let maxAlpha = 0;
    for (let i = 3; i < frames.length; i += 4) maxAlpha = Math.max(maxAlpha, frames[i]);
    // Low-opacity footage (e.g. 20% wind) never reaches alpha 64.
    const threshold = Math.max(8, Math.min(64, maxAlpha * .5));
    let left = width, top = height, right = -1, bottom = -1;
    for (let i = 3; i < frames.length; i += 4) if (frames[i] >= threshold) {
      const pixel = ((i - 3) / 4) % (width * height), x = pixel % width, y = Math.floor(pixel / width);
      left = Math.min(left, x); right = Math.max(right, x);
      top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
    if (right < 0) throw Error(`No visible alpha found: ${basename(path)}`);
    // Preserve frame center and all pixels. Only enlarge the padded frame.
    const visibleWidth = (right - left + 1) / width * m.width;
    const visibleHeight = (bottom - top + 1) / height * m.height;
    const profile = [m.width, m.height, visibleWidth, visibleHeight].map(n => +n.toFixed(4));
    cache[path] = { stamp, profile };
    return profile;
  })();
  pending.set(path, run);
  return run;
}
let next = 0, complete = 0;
const work = [...selected.values()];
await Promise.all(Array.from({ length: 4 }, async () => {
  while (next < work.length) {
    const row = work[next++], located = await locate(row.file);
    const profile = located ? await measure(located.path) : null;
    if (profile) profiles[basename(row.file)] = profile;
    records.push({ ...row, exactInstalled: existsSync(resolve(dataRoot, row.file)), source: located?.source ?? "unavailable", profile });
    if (++complete % 100 === 0) {
      await writeFile(cacheURL, JSON.stringify(cache));
      console.log(`Footprints ${complete}/${work.length}`);
    }
  }
}));
await mkdir(new URL("../.cache/", import.meta.url), { recursive: true });
await writeFile(cacheURL, JSON.stringify(cache));
const report = {
  scope:auditScope(),
  method: "Union of alpha >= min(64, half peak alpha), minimum 8, at 6fps, 128px sample width; preserves original aspect and center",
  selectedFiles: work.length, measuredFiles: Object.keys(profiles).length,
  installedFiles: records.filter(r => r.exactInstalled).length,
  referenceFiles: records.filter(r => r.profile && !r.exactInstalled).length,
  missingMeasurements: records.filter(r => !r.profile),
  records: records.toSorted((a, b) => a.file.localeCompare(b.file)),
};
await writeFile(new URL("../data/media-footprint-audit.json", import.meta.url), JSON.stringify(report, null, 2) + "\n");
if (process.argv.includes("--write")) {
  if (report.missingMeasurements.length) throw Error("Missing artwork measurements; output not replaced");
  await writeFile(new URL("../data/media-footprints.mjs", import.meta.url),
    `// Measured frame/visible alpha dimensions [width, height, visibleWidth, visibleHeight].\n// Rebuild: rtk proxy node tools/audit-media-footprints.mjs --all-systems --fetch-missing-free --write\nexport const MEDIA_FOOTPRINTS = ${JSON.stringify(Object.fromEntries(Object.entries(profiles).sort()), null, 2)};\n`);
}
console.log(JSON.stringify({ ...report, records: undefined, missingMeasurements: report.missingMeasurements.length }, null, 2));
if (report.missingMeasurements.length) process.exitCode = 1;
