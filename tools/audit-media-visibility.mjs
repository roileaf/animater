import {catalogAuditEntries,auditScope} from './catalog-audit-entries.mjs';
// Decode real alpha throughout every selected distance/random movie. Full
// duration alone cannot reveal a slash whose visible action lasts 200 ms.
import { readFile, writeFile, stat, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { assetDatabases, variantFiles } from "./asset-databases.mjs";
import { PF2E_SPELLS, spellRecipe } from "../scripts/catalogs/pf2e/spells/spell-catalog.mjs";
import { PF2E_FEATS, featRecipe } from "../scripts/catalogs/pf2e/feats/feat-catalog.mjs";
import { PF2E_WEAPONS, weaponRecipe } from "../scripts/catalogs/pf2e/weapons/weapon-catalog.mjs";
import { resolveAsset } from "../scripts/core/model.mjs";
import { previewPose } from "../scripts/core/stage-options.mjs";

const exec = promisify(execFile), libraries = await assetDatabases();
const dataRoot = fileURLToPath(new URL("../../../", import.meta.url));
const recipes = catalogAuditEntries().map(e=>({...e,recipe:e.build()}));
const native = new Map(), selected = new Set();
for (const rows of Object.values(libraries)) for (const row of rows)
  for (const file of variantFiles(row)) if (existsSync(resolve(dataRoot, file))) native.set(basename(file), resolve(dataRoot, file));
for (const rows of Object.values(libraries)) {
  const keys = new Map(rows.map(row => [row.key, row]));
  for (const { recipe } of recipes) for (const stage of recipe.stages) {
    if (["motion", "sound", "sprite"].includes(stage.kind)) continue;
    for (const file of variantFiles(keys.get(resolveAsset(stage, rows)) ?? {})) selected.add(file);
  }
}
const cacheURL = new URL("../.cache/media-activity.json", import.meta.url);
let cache = {};
try { cache = JSON.parse(await readFile(cacheURL, "utf8")); } catch {}
const records = [], pending = new Map();
async function locate(file) {
  const own = resolve(dataRoot, file);
  if (existsSync(own)) return { path: own, source: "installed" };
  if (native.has(basename(file))) return { path: native.get(basename(file)), source: "same-filename-reference" };
  const cached = new URL(`../.cache/free-media/${basename(file)}`, import.meta.url);
  const prefix = "modules/JB2A_DnD5e/";
  if (!existsSync(cached) && file.startsWith(prefix) && process.argv.includes("--fetch-missing-free")) {
    const response = await fetch(`https://raw.githubusercontent.com/Jules-Bens-Aa/JB2A_DnD5e/main/${file.slice(prefix.length)}`);
    if (!response.ok) throw Error(`JB2A Free fetch ${response.status}: ${file}`);
    await mkdir(new URL("../.cache/free-media/", import.meta.url), { recursive: true });
    await writeFile(cached, Buffer.from(await response.arrayBuffer()));
  }
  return existsSync(cached) ? { path: fileURLToPath(cached), source: "official-free-cache" } : null;
}
async function measure(path, wantPeaks=false) {
  if(wantPeaks && !cache[path]?.activity?.peakTimes)pending.delete(path);
  if (pending.has(path)) return pending.get(path);
  const work = (async () => {
    const info = await stat(path), stamp = `alpha-v1:${info.size}:${info.mtimeMs}`;
    if (cache[path]?.stamp === stamp && (!wantPeaks || cache[path].activity.peakTimes)) return cache[path].activity;
    const { stdout } = await exec("ffprobe", ["-v", "error", "-show_entries", "format=duration:stream=codec_name,width,height", "-of", "json", path]);
    const meta = JSON.parse(stdout), stream = meta.streams[0], width = 64, height = Math.max(1, Math.round(64 * stream.height / stream.width)), fps = 24;
    const { stdout: frames } = await exec("ffmpeg", ["-v", "error", "-threads", "1", "-filter_threads", "1", "-c:v", stream.codec_name === "vp8" ? "libvpx" : "libvpx-vp9", "-i", path, "-vf", `fps=${fps},scale=${width}:${height},format=rgba`, "-f", "rawvideo", "-pix_fmt", "rgba", "pipe:1"], { encoding: "buffer", maxBuffer: 128 * 1024 * 1024 });
    const frameBytes = width * height * 4, sums = [];
    for (let start = 0; start + frameBytes <= frames.length; start += frameBytes) {
      let sum = 0;
      for (let i = start + 3; i < start + frameBytes; i += 4) sum += frames[i];
      sums.push(sum);
    }
    const peak = Math.max(...sums), active = sums.map((sum, i) => sum >= Math.max(8, peak * .1) ? i : -1).filter(i => i >= 0);
    const activity = { duration: Math.ceil(Number(meta.format.duration) * 1000), peakTime: +(sums.indexOf(peak) * 1000 / fps).toFixed(2), activeStart: active.length ? +(active[0] * 1000 / fps).toFixed(2) : null, activeEnd: active.length ? +((active.at(-1) + 1) * 1000 / fps).toFixed(2) : null, activeDuration: +(active.length * 1000 / fps).toFixed(2), peakAlphaMass: peak, width: stream.width, height: stream.height };
    activity.peakTimes=sums.map((sum,i)=>sum>=Math.max(8,peak*.95)?+(i*1000/fps).toFixed(2):null).filter(t=>t!==null);
    cache[path] = { stamp, activity };
    return activity;
  })();
  pending.set(path, work);
  return work;
}
const files = [...selected];
let next = 0, completed = 0;
await Promise.all(Array.from({ length: 4 }, async () => {
  while (next < files.length) {
    const file = files[next++], located = await locate(file);
    records.push({ file, exactInstalled: existsSync(resolve(dataRoot, file)), source: located?.source ?? "unavailable", activity: located ? await measure(located.path) : null });
    if (++completed % 100 === 0) { await writeFile(cacheURL, JSON.stringify(cache)); console.log(`Alpha activity ${completed}/${files.length}`); }
  }
}));
await writeFile(cacheURL, JSON.stringify(cache));
const byFile = new Map(records.map(row => [row.file, row.activity])), suppressed = [], authoredShapeChanges = [], fastMovies = [];
for (const { domain, item, mode, recipe } of recipes) for (const stage of recipe.stages) {
  if (!stage.oneShot || ["sound", "motion", "sprite"].includes(stage.kind) || stage.clipStart || stage.clipEnd) continue;
  for (const [edition, rows] of Object.entries(libraries)) {
    const key = resolveAsset(stage, rows), row = rows.find(row => row.key === key);
    for (const file of variantFiles(row ?? {})) {
      let activity = byFile.get(file);
      if (!activity) continue;
      const time = activity.peakTime / stage.playbackRate, pose = previewPose(stage, time);
      const opacityRetention = stage.opacity ? pose.alpha / stage.opacity : 1;
      const sizeRetention = Math.min(Math.abs(pose.scaleX), Math.abs(pose.scaleY)) / (stage.scale || 1);
      const detail = { domain, id: item.id, name: item.name, mode, stage: stage.label, key, edition, file, peakTime: time, activeDuration: activity.activeDuration / stage.playbackRate, opacityRetention: +opacityRetention.toFixed(3), sizeRetention: +sizeRetention.toFixed(3) };
      if(opacityRetention<.74||sizeRetention<.74){
        if(!activity.peakTimes){const located=await locate(file);if(located){activity=await measure(located.path,true);byFile.set(file,activity);records.find(r=>r.file===file).activity=activity;}}
        // The first maximum of a flat loop can be its first frame. Compare
        // entrances over every near-maximum frame rather than that arbitrary
        // instant. Authored contractions/cross shapes are recorded separately.
        const neutral={...stage,fadeIn:0,fadeOut:0,scaleInDuration:0,scaleOutDuration:0};
        let retained=0;
        for(const sample of activity.peakTimes??[activity.peakTime]){
          const t=sample/stage.playbackRate,actual=previewPose(stage,t),wanted=previewPose(neutral,t);
          retained=Math.max(retained,Math.min(wanted.alpha?actual.alpha/wanted.alpha:1,Math.abs(wanted.scaleX)?Math.abs(actual.scaleX/wanted.scaleX):1,Math.abs(wanted.scaleY)?Math.abs(actual.scaleY/wanted.scaleY):1));
        }
        detail.bestPeakEntranceRetention=+retained.toFixed(3);
        if(retained<.74)suppressed.push(detail);else authoredShapeChanges.push(detail);
      }
      if (detail.activeDuration < 200) fastMovies.push(detail);
    }
  }
}
const report = {
  scope:auditScope(), method: "Integrated decoded alpha mass, 24fps at 64px width; active frames >=10% of each movie's peak. First-peak candidates checked over all >=95% peak frames against their authored tracks with entrances removed; authored contractions and crossed silhouettes recorded separately. Estimates within one sample frame. Every selected random/distance variant measured; source distinguishes installed URL from reference copies.", recipes: recipes.length, selectedFiles: files.length, missingMeasurements: records.filter(row => !row.activity), suppressedCount: suppressed.length, authoredShapeChangesCount:authoredShapeChanges.length, fastMoviesCount: fastMovies.length, suppressed, authoredShapeChanges, fastMovies, records: records.sort((a, b) => a.file.localeCompare(b.file)) };
await writeFile(cacheURL,JSON.stringify(cache));
const suffix = process.argv.includes("--baseline") ? "before" : "after";
await writeFile(new URL(`../data/media-visibility-audit-${suffix}.json`, import.meta.url), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ ...report, records: undefined, suppressed: suppressed.slice(0, 20), fastMovies: undefined, missingMeasurements: report.missingMeasurements.length }, null, 2));
if (report.missingMeasurements.length) process.exitCode = 1;
