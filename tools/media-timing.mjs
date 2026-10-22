import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { resolve, basename } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { assetDatabases, variantFiles } from "./asset-databases.mjs";
import { assetGeometry } from "./spell-asset-selection.mjs";
import { persistentProbe } from "./probe-cache.mjs";
const exec = promisify(execFile),
  cache = new Map(),
  metadataCache = new Map(),
  nativeMaps = new WeakMap();
const dataRoot = fileURLToPath(new URL("../../../", import.meta.url));
function mediaPath(file, databases) {
  const own = resolve(dataRoot, file);
  if (existsSync(own)) return own;
  if (file.startsWith("modules/JB2A_DnD5e/")) {
    const cachedFree = fileURLToPath(
      new URL(`../.cache/free-media/${basename(file)}`, import.meta.url),
    );
    if (existsSync(cachedFree)) return cachedFree;
  }
  if (!nativeMaps.has(databases)) {
    const native = new Map();
    for (const row of Object.values(databases).flat()) {
      for (const candidate of variantFiles(row)) {
        const path = resolve(dataRoot, candidate);
        if (existsSync(path)) native.set(basename(candidate), path);
      }
    }
    nativeMaps.set(databases, native);
  }
  return nativeMaps.get(databases).get(basename(file)) ?? null;
}
async function mediaMetadata(file, databases) {
  const path = mediaPath(file, databases);
  if (!path) return null;
  if (!metadataCache.has(path)) {
    metadataCache.set(
      path,
      persistentProbe(import.meta.url, "metadata", path, null, async () => {
        const { stdout } = await exec("ffprobe", [
          "-v",
          "error",
          "-show_entries",
          "format=duration:stream=codec_name",
          "-of",
          "json",
          path,
        ]);
        const metadata = JSON.parse(stdout);
        const duration = Math.ceil(Number(metadata.format.duration) * 1000);
        if (!Number.isFinite(duration) || duration <= 0)
          throw Error(`Invalid duration: ${file}`);
        return { metadata, duration };
      }).then((measured) => ({ path, ...measured })),
    );
  }
  return metadataCache.get(path);
}
async function representativeTiming(row, databases) {
  const filename = basename(row.file);
  const identity = `${row.file}:${JSON.stringify([row.template, row.width])}`;
  if (cache.has(identity)) return cache.get(identity);
  const run = (async () => {
    const measured = await mediaMetadata(row.file, databases);
    if (!measured) return null;
    const { path, metadata, duration } = measured;
    const baked = ["beam", "line", "projectile"].includes(assetGeometry(row));
    if (!baked) return { duration, baked };
    const contact = await fileContact(measured, row.template, row.width);
    // Magic Missile has a large leading glow. Frame inspection places its head
    // at destination around 1s; a glow threshold alone registers too early.
    const calibrated =
      /^MagicMissile_01_Regular_.*_15ft_01_1000x400\.webm$/i.test(filename)
        ? 1000
        : null;
    return {
      duration,
      baked,
      contact: calibrated ?? contact,
      ...(calibrated
        ? { contactMethod: "frame-reviewed" }
        : { contactMethod: "alpha-weighted-estimate" }),
    };
  })();
  cache.set(identity, run);
  return run;
}
// When the shot in one measured file reaches its far end (media ms): the
// endpoint column sits template[2] px before the file's right edge.
async function fileContact({ path, metadata, duration }, template, width) {
  // Transparent pixels retain arbitrary RGB values. Decode alpha with the
  // correct libvpx decoder before estimating visible destination contact.
  const decoder =
    metadata.streams[0].codec_name === "vp8" ? "libvpx" : "libvpx-vp9";
  const endpoint = Math.round(
    100 * (1 - (template?.[2] ?? 0) / (width || 1000)),
  );
  // Persisted per file, decoder and endpoint: the same frames give the same contact.
  return persistentProbe(import.meta.url, "contact", path, { decoder, duration, endpoint }, async () => {
    const { stdout: frames } = await exec(
      "ffmpeg",
      [
        "-v",
        "error",
        "-threads",
        "1",
        "-filter_threads",
        "1",
        "-c:v",
        decoder,
        "-i",
        path,
        "-vf",
        "fps=20,scale=100:40,format=rgba",
        "-f",
        "rawvideo",
        "-pix_fmt",
        "rgba",
        "pipe:1",
      ],
      { encoding: "buffer", maxBuffer: 32 * 1024 * 1024 },
    );
    return visibleContact(frames, duration, endpoint);
  });
}
// When the shot lands in each range variant (05/15/30/60/90 ft) of a ranged
// clip, in media ms rounded up to 10 ms: { "30ft": 650, ... }. A variant with
// random alternatives takes the latest of them, so a strike timed to it is
// never early. Null when the row has no measured variant.
export async function variantLandings(row, databases) {
  if (!row?.distanceFiles) return null;
  const landings = {};
  for (const [ft, files] of Object.entries(row.distanceFiles)) {
    const times = [];
    for (const file of [files].flat(Infinity).filter((f) => typeof f === "string" && f.endsWith(".webm"))) {
      const measured = await mediaMetadata(file, databases);
      const width = Number(basename(file).match(/_(\d+)x\d+\.webm$/i)?.[1]);
      if (measured) times.push(await fileContact(measured, row.template, width));
    }
    if (times.length) landings[ft] = Math.ceil(Math.max(...times) / 10) * 10;
  }
  return Object.keys(landings).length ? landings : null;
}
export async function mediaTiming(row, databases) {
  if (!row) return null;
  const representative = await representativeTiming(row, databases);
  const durations = [];
  // Contact uses the representative geometry; lifetime must cover every file
  // Sequencer can choose, including distant targets and random variants.
  for (const file of variantFiles(row)) {
    const measured = await mediaMetadata(file, databases);
    if (measured) durations.push(measured.duration);
  }
  if (!durations.length) return null;
  return {
    ...(representative ?? {
      baked: ["beam", "line", "projectile"].includes(assetGeometry(row)),
    }),
    duration: Math.max(...durations),
  };
}
export function contactFrames(frames, endpoint) {
  const weights = [];
  for (let frame = 0; frame < frames.length / 16000; frame++) {
    let weight = 0;
    for (let y = 3; y < 37; y++)
      for (
        let x = Math.max(0, endpoint - 3);
        x < Math.min(100, endpoint + 2);
        x++
      ) {
        const i = (frame * 4000 + y * 100 + x) * 4;
        if (frames[i + 3] > 25)
          weight +=
            ((frames[i + 3] / 255) *
              Math.max(frames[i], frames[i + 1], frames[i + 2])) /
            255;
      }
    weights.push(weight);
  }
  return weights;
}
export function visibleContact(frames, duration, endpoint) {
  const weights = contactFrames(frames, endpoint),
    threshold = Math.max(3, Math.max(...weights) * 0.5);
  const contact = weights.findIndex((weight) => weight >= threshold);
  if (contact >= 0) return Math.max(50, contact * 50);
  return Math.round(duration * 0.6);
}
export async function designMediaTiming(assets, databases) {
  const result = {};
  for (const slot of Object.keys(assets)) {
    const rows = Object.values(databases)
      .flat()
      .filter((r) => (assets[slot] ?? []).includes(r.key));
    const times = (
      await Promise.all(rows.map((row) => mediaTiming(row, databases)))
    ).filter(Boolean);
    if (!times.length) continue;
    result[slot] = {
      duration: Math.max(...times.map((t) => t.duration)),
      baked: times.every((t) => t.baked),
      ...(times.some((t) => t.contact)
        ? { contact: Math.max(...times.map((t) => t.contact ?? 0)) }
        : {}),
    };
  }
  return result;
}
// Writes data/media-landings.mjs: when the shot lands in each range variant of
// every ranged (projectile) clip, keyed by the variant's Sequencer database path.
// Rebuild: rtk proxy node tools/media-timing.mjs --write-landings
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href && process.argv.includes("--write-landings")) {
  const databases = await assetDatabases(), landings = {};
  for (const rows of Object.values(databases))
    for (const row of rows) {
      if (!row.distanceFiles || assetGeometry(row) !== "projectile") continue;
      for (const [ft, ms] of Object.entries((await variantLandings(row, databases)) ?? {})) {
        const key = `${row.key}.${ft}`;
        landings[key] = Math.max(landings[key] ?? 0, ms);
      }
    }
  const keys = Object.keys(landings).sort();
  await writeFile(new URL("../data/media-landings.mjs", import.meta.url),
    `// When the shot in each range variant of a JB2A ranged clip reaches its far end
// (media ms from the clip's start, rounded up to 10 ms; the latest of a variant's
// random alternatives). Keyed by the variant's Sequencer database path.
// Rebuild: rtk proxy node tools/media-timing.mjs --write-landings
export const MEDIA_LANDINGS = {
${keys.map((k) => `  ${JSON.stringify(k)}: ${landings[k]},`).join("\n")}
};
`);
  console.log(`${keys.length} variant landings`);
}
