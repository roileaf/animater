// Audits data/surface-sounds.mjs: every recording a hit can play is the right kind of sound for what it lands on,
// exists, decodes, is not silent, starts with its hit, is not cut off mid-sound, and sits near its set's loudness.
// node tools/audit-surface-sounds.mjs [--output=docs/surface-sound-audit.json]
import { writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import path from "node:path";
import { SURFACE_SOUND_PROFILES } from "../data/surface-sounds.mjs";
import { modulesRoot } from "./sound-databases.mjs";

const output = process.argv.find((a) => a.startsWith("--output="))?.slice(9);
// What a recording must not be, by what the blow lands on (its file path is the evidence: pack folders and names).
const SHATTER = /glass|crystal|shatter|pot break|bomb\.break|bell|chime|frost|\bice\b/i;
const HARD = /metal|plate|clang|anvil|block blade|shield block|ricochet/i;
const FORBID = {
  flesh: [SHATTER, HARD, /wood|plank|mining|stone/i],
  leather: [SHATTER, HARD, /wood|plank|mining|stone|blood/i],
  crunch: [SHATTER, HARD, /wood|plank|blood/i],
  wood: [SHATTER, HARD, /flesh|blood|squish/i],
  stone: [SHATTER, /flesh|blood|squish|leather/i],
  squish: [SHATTER, HARD, /wood|plank|mining|stone/i],
  metal: [/flesh|blood|squish|leather|wood(?!-)|glass|chime/i],
  shield: [/flesh|blood|squish|glass|chime|frost/i],
  glass: [/flesh|blood|squish|leather|wood|mining/i],
  ward: [/flesh|blood|squish|leather|wood|mining|bell/i],
};
// What it must be, where only one kind of sound fits.
const REQUIRE = {
  glass: /glass|crystal|frost|ice/i,
  ward: /ward-chime|deflector|dispel|shield/i,
};
// An element on a body: its own touch.
const ELEMENT = { fire: /fire-|steam-/, electricity: /electric-/, cold: /frost-/, acid: /acid-/ };
const LAYER = { blood: /blood-/, burst: /fire-burst/, tinkle: /frost-crack/, shards: /impactGlass/, shimmer: /ward-chime|impactGlass/ };

const decode = (file) => new Promise((resolve, reject) => execFile("ffmpeg", ["-v", "error", "-i", path.resolve(modulesRoot, "..", file), "-ac", "1", "-ar", "22050", "-f", "f32le", "-"],
  { encoding: "buffer", maxBuffer: 1 << 28, windowsHide: true }, (e, out) => (e ? reject(e) : resolve(new Float32Array(out.buffer, out.byteOffset, Math.floor(out.byteLength / 4))))));
// Level per 10 ms window, in dB.
function envelope(x, rate = 22050) {
  const w = Math.round(rate / 100), out = [];
  for (let i = 0; i + w <= x.length; i += w) { let s = 0; for (let j = i; j < i + w; j++) s += x[j] * x[j]; out.push(10 * Math.log10(s / w + 1e-12)); }
  return out;
}
const measured = new Map();
async function measure(file) {
  if (!measured.has(file)) measured.set(file, decode(file).then((x) => {
    const e = envelope(x), peak = Math.max(...e), at = e.indexOf(peak), loud = e.filter((v) => v > peak - 20);
    return { length: Math.round((x.length / 22050) * 1000), peakDb: +peak.toFixed(1), peakMs: at * 10, endDb: +(Math.max(...e.slice(-3)) - peak).toFixed(1), levelDb: +(loud.reduce((a, b) => a + b, 0) / loud.length).toFixed(1) };
  }));
  return measured.get(file);
}

const issues = [], profiles = Object.entries(SURFACE_SOUND_PROFILES);
const flag = (profile, file, type, detail) => issues.push({ profile, file, type, detail });
for (const [key, [rule]] of profiles) {
  const [, blow, surface, , layer] = key.match(/^surface-([a-z]+)-([a-z]+)(-layer-([a-z]+))?$/) ?? [];
  if (!blow) { flag(key, null, "unknown-profile"); continue; }
  const levels = [];
  for (const c of rule.candidates) {
    const where = c.file;
    if (layer) { if (!LAYER[layer]?.test(where)) flag(key, where, "wrong-layer-sound", `a ${layer} layer`); }
    else {
      // An element's own touch is checked below; what it rings off still has to fit.
      if (!ELEMENT[blow] || ["ward", "shield", "glass"].includes(surface)) for (const re of FORBID[surface] ?? []) if (re.test(where)) flag(key, where, "wrong-kind", `${surface} must not sound like ${re}`);
      if (REQUIRE[surface] && !REQUIRE[surface].test(where)) flag(key, where, "wrong-kind", `${surface} needs ${REQUIRE[surface]}`);
      if (ELEMENT[blow] && !["ward", "shield", "glass"].includes(surface) && !ELEMENT[blow].test(where) && !/impactPlate/.test(where)) flag(key, where, "wrong-element", blow);
    }
    try {
      const m = await measure(where);
      if (![m.peakDb, m.peakMs, m.endDb, m.levelDb].every(Number.isFinite)) throw Error("unmeasurable");
      if (m.peakDb < -45) flag(key, where, "silent", `${m.peakDb} dB`);
      if (m.length < 100) flag(key, where, "too-short", `${m.length} ms`);
      // A hit starts with its blow; a burst or a crackle may build a little.
      if (m.peakMs > (layer || ELEMENT[blow] ? 600 : 400)) flag(key, where, "late-hit", `loudest at ${m.peakMs} ms`);
      // Still loud at its very end: cut off mid-sound.
      if (m.endDb > -30 && m.length > 150) flag(key, where, "cut-off", `ends ${m.endDb} dB under its peak`);
      if (c.duration < Math.min(m.length, 2000) - 50) flag(key, where, "played-short", `plays ${c.duration} of ${m.length} ms`);
      levels.push(m.levelDb + 20 * Math.log10(c.gain ?? 1));
    } catch (e) { flag(key, where, "missing-or-unplayable", e.message.split("\n")[0]); }
  }
  // As played (after each file's gain), a set's recordings should not jump far in loudness.
  if (levels.length > 1 && Math.max(...levels) - Math.min(...levels) > 14) flag(key, null, "uneven-loudness", `${(Math.max(...levels) - Math.min(...levels)).toFixed(1)} dB spread`);
}
const summary = { profiles: profiles.length, recordings: profiles.reduce((n, [, [r]]) => n + r.candidates.length, 0), files: measured.size, issues: issues.length,
  byType: issues.reduce((o, i) => ({ ...o, [i.type]: (o[i.type] ?? 0) + 1 }), {}) };
if (output) await writeFile(output, JSON.stringify({ summary, issues, files: Object.fromEntries(await Promise.all([...measured].map(async ([f, p]) => [f, await p]))) }, null, 1) + "\n");
console.log(JSON.stringify(summary, null, 1));
for (const i of issues) console.log(`${i.type.padEnd(22)} ${i.profile}  ${i.file?.split("/").pop() ?? ""}  ${i.detail ?? ""}`);
if (issues.length) process.exitCode = 1;
