// Incremental catalog build: `npm run build [-- --force|--only=a,b|--dry-run|--jobs=N]`.
//
// Each step is one generator script. Its input set is the script plus its full
// static module graph across tools/, scripts/ and data/ (minus the files the
// step itself writes), plus external inventories it reads (JB2A databases,
// optional sound packs). A step reruns only when that input hash, its recorded
// outputs, or its arguments changed. Step order comes from the graph: when one
// step's outputs are another's inputs, the consumer waits. Shared-registry
// cycles (catalogs <-> sound designs through scripts/catalogs/shared/bespoke.mjs) are broken by
// declaration order and settled by a follow-up pass that reruns only steps whose
// inputs actually changed bytes.
import { spawn, execFileSync } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { ROOT, closure, fileHash, forgetHashes, digest, saveGraphCache, moduleInfo } from "./build-graph.mjs";
import { SOUND_PACKS, audioFile } from "./sound-databases.mjs";
import { ensureFeatReviews, FEAT_REVIEW_GENERATORS } from "./ensure-feat-reviews.mjs";

const FEAT_REVIEWS = FEAT_REVIEW_GENERATORS.flatMap(({script, output}) => [script, output]);
const featOutputs = (data, audit) => [data, `${audit}.json`, `${audit}.csv`];
// Declaration order is the tie-break inside dependency cycles (and matches the
// historical hand-run order: catalogs, then sounds, then audits).
export const STEPS = [
  { name: "weapons", script: "tools/build-pf2e-weapon-catalog.mjs", outputs: ["data/pf2e-weapons.mjs", "data/pf2e-weapon-audit.json", "data/pf2e-weapon-audit.csv"] },
  { name: "spells", script: "tools/build-pf2e-catalog.mjs", outputs: ["data/pf2e-spells.mjs", "data/spell-assets.mjs", "data/pf2e-spell-variety-audit.json", "data/pf2e-design-audit.json", "data/pf2e-animation-catalog.csv"] },
  // loadFeatReviews() imports the review maps through a template path.
  { name: "feats", script: "tools/build-pf2e-feat-catalog.mjs", extraInputs: FEAT_REVIEWS, outputs: featOutputs("data/pf2e-feats.mjs", "data/pf2e-feat-audit") },
  { name: "states", script: "tools/build-pf2e-state-catalog.mjs", outputs: ["data/pf2e-state-catalog.mjs", "data/pf2e-state-catalog-audit.json"] },
  { name: "dnd5e", script: "tools/build-dnd5e-catalog.mjs", outputs: ["data/dnd5e-catalog.mjs"] },
  { name: "sf2e", script: "tools/build-sf2e-catalog.mjs", outputs: ["data/sf2e-catalog.mjs", "data/sf2e-catalog-validation.json"] },
  { name: "actions", script: "tools/build-pf2e-feat-catalog.mjs", args: ["--catalog=actions"], extraInputs: FEAT_REVIEWS, outputs: featOutputs("data/pf2e-actions.mjs", "data/pf2e-action-audit") },
  { name: "classfeatures", script: "tools/build-pf2e-feat-catalog.mjs", args: ["--catalog=classfeatures"], extraInputs: FEAT_REVIEWS, outputs: featOutputs("data/pf2e-class-features.mjs", "data/pf2e-class-feature-audit") },
  { name: "spell-sounds", script: "tools/build-spell-sounds.mjs", outputs: ["data/spell-sounds.mjs", "data/spell-sound-coverage.json", "data/pf2e-spell-sounds.csv"] },
  { name: "ability-sounds", script: "tools/build-ability-sounds.mjs", outputs: ["data/ability-sounds.mjs", "data/pf2e-ability-sound-audit.json"] },
  { name: "footprints", script: "tools/audit-media-footprints.mjs", args: ["--write", "--fetch-missing-free", "--all-systems"], outputs: ["data/media-footprints.mjs", "data/media-footprint-audit.json"] },
  { name: "verify-dnd5e", script: "tools/verify-dnd5e-catalog.mjs", outputs: ["data/dnd5e-catalog-validation.json"] },
  { name: "daggerheart", script: "tools/build-daggerheart.mjs", outputs: ["data/daggerheart-catalog.mjs", "data/daggerheart-card-text.mjs"] },
];

const CACHE = join(ROOT, ".cache"), LOGS = join(CACHE, "build-logs"), MANIFEST = join(CACHE, "build-manifest.json");
const MANIFEST_VERSION = 1, MAX_PASSES = 3;
const ignoredInput = path => path.startsWith(".cache/");

// ---------------------------------------------------------------- inputs ----
export function stepInputs(step) {
  const own = new Set(step.outputs);
  return closure([step.script, ...(step.extraInputs ?? []).filter(p => existsSync(join(ROOT, p)))], { exclude: own }).filter(p => !own.has(p) && !ignoredInput(p));
}

function listFiles(dir, filter = () => true) {
  const out = [];
  const walk = d => {
    let entries;
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const full = join(d, e.name);
      if (e.isDirectory()) walk(full);
      else if (filter(e.name)) out.push(`${relative(dir, full).split(sep).join("/")}:${statSync(full).size}`);
    }
  };
  walk(dir);
  return out.sort();
}
const optionalHash = file => existsSync(file) ? digest(readFileSync(file)) : "missing";
const MODULES = resolve(ROOT, "..");
const JB2A_FREE_DB = "https://raw.githubusercontent.com/Jules-Bens-Aa/JB2A_DnD5e/main/scripts/jb2a_sequencer.js";

// External inventories, keyed by the module whose presence in a step's graph
// means the step reads them. Values are fingerprints, recomputed once per pass.
const EXTERNALS = {
  jb2a: {
    when: "tools/asset-databases.mjs",
    label: "JB2A inventory",
    async compute() {
      let free;
      try {
        const response = await fetch(JB2A_FREE_DB, { headers: { "User-Agent": "Animater-build" } });
        if (!response.ok) throw Error(String(response.status));
        free = digest(await response.text());
      } catch (error) { free = null; warn(`JB2A Free database unavailable (${error.message}); assuming unchanged.`); }
      return {
        free,
        patreon: optionalHash(join(MODULES, "jb2a_patreon/scripts/jb2a_sequencer.js")),
        patreonModule: optionalHash(join(MODULES, "jb2a_patreon/module.json")),
        freeModule: optionalHash(join(MODULES, "JB2A_DnD5e/module.json")),
        // Media timing and footprints fall back to fetched free films.
        freeMediaCache: digest(listFiles(join(CACHE, "free-media"))),
      };
    },
  },
  sounds: {
    when: "tools/sound-databases.mjs",
    label: "sound-pack inventory",
    async compute() {
      return Object.fromEntries(Object.keys(SOUND_PACKS).map(module => {
        const dir = join(MODULES, module);
        return [module, digest([optionalHash(join(dir, "module.json")), optionalHash(join(dir, "scripts/soundDB.js")), optionalHash(join(dir, "scripts/psfx_sequencer.js")), listFiles(dir, n => audioFile.test(n))])];
      }));
    },
  },
};
const externalCache = new Map();
async function externalsFor(inputs) {
  const out = { node: process.versions.node.split(".")[0] };
  for (const [name, ext] of Object.entries(EXTERNALS)) {
    if (!inputs.includes(ext.when)) continue;
    if (!externalCache.has(name)) externalCache.set(name, ext.compute());
    out[name] = await externalCache.get(name);
  }
  return out;
}
function resetExternals() { externalCache.clear(); }

// -------------------------------------------------------------- manifest ----
function loadManifest() {
  try {
    const value = JSON.parse(readFileSync(MANIFEST, "utf8"));
    if (value.version === MANIFEST_VERSION) return value;
  } catch {}
  return { version: MANIFEST_VERSION, steps: {} };
}
function saveManifest(manifest) {
  mkdirSync(CACHE, { recursive: true });
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1) + "\n");
}

// ------------------------------------------------------ bespoke registry ----
// Builders read scripts/catalogs/bespoke/index.mjs, which merges every design file into
// one BESPOKE map. tools/build-trace.mjs records which keys a builder actually
// reads; an edit to a design file then only invalidates builders that read one
// of its keys. That holds for a design file whose only importer in the step's
// graph is the index, whose top level is declarative (no side effects besides
// its export), and while the ordered key set is unchanged.
const BESPOKE_INDEX = "scripts/catalogs/bespoke/index.mjs";
let registryPromise = null;
function bespokeRegistry() {
  registryPromise ??= (async () => {
    try {
      const index = resolve(ROOT, BESPOKE_INDEX);
      const { BESPOKE } = await import(pathToFileURL(index).href);
      const keysOf = new Map();
      for (const file of moduleInfo(index).refs) {
        const path = relative(ROOT, file).split(sep).join("/");
        const designs = (await import(pathToFileURL(file).href)).default;
        keysOf.set(path, new Set(designs && typeof designs === "object" ? Object.keys(designs) : []));
      }
      return { keyset: digest(Object.keys(BESPOKE)), keysOf };
    } catch (error) {
      warn(`bespoke registry failed to load (${error.message}); bespoke edits rebuild every consumer.`);
      return null;
    }
  })();
  return registryPromise;
}
const filesDefining = (registry, keys) => [...registry.keysOf].filter(([, set]) => keys.some(k => set.has(k))).map(([file]) => file).sort();

async function bespokeSnapshot(inputs) {
  if (!inputs.includes(BESPOKE_INDEX)) return null;
  const registry = await bespokeRegistry();
  if (!registry) return null;
  const inside = new Set(inputs), importers = new Map();
  for (const file of inputs) for (const ref of moduleInfo(resolve(ROOT, file)).refs) {
    const path = relative(ROOT, ref).split(sep).join("/");
    if (inside.has(path)) importers.set(path, (importers.get(path) ?? 0) + 1);
  }
  const eligible = [...registry.keysOf.keys()].filter(path => inside.has(path) && importers.get(path) === 1 && moduleInfo(resolve(ROOT, path)).declarative);
  // The registry rides along for staleReason() but is not persisted.
  return Object.defineProperty({ keyset: registry.keyset, eligible }, "registry", { value: registry });
}

async function snapshot(step) {
  const inputs = stepInputs(step);
  const files = Object.fromEntries(inputs.map(p => [p, fileHash(p)]));
  const externals = await externalsFor(inputs);
  const args = step.args ?? [];
  const bespoke = await bespokeSnapshot(inputs);
  return { hash: digest({ files, externals, args }), files, externals, args, bespoke };
}

const summarize = (list, n = 3) => list.length <= n ? list.join(", ") : `${list.slice(0, n).join(", ")} +${list.length - n} more`;
// Why a step must rebuild, or null when its recorded build is current.
export function staleReason(step, now, record) {
  if (!record) return "never built";
  const missing = step.outputs.filter(p => !existsSync(join(ROOT, p)));
  if (missing.length) return `output missing: ${summarize(missing)}`;
  const touched = step.outputs.filter(p => record.outputs?.[p] && fileHash(p) !== record.outputs[p]);
  if (touched.length) return `output changed outside the build: ${summarize(touched)}`;
  if (record.hash === now.hash) return null;
  const reasons = [];
  let changed = Object.keys(now.files).filter(p => p in record.files && record.files[p] !== now.files[p]);
  // Design files whose entries this builder never read cannot affect its output.
  const bespokeEdits = changed.filter(p => now.bespoke?.eligible.includes(p));
  if (bespokeEdits.length && record.trace && now.bespoke.registry) {
    if (record.bespoke?.keyset !== now.bespoke.keyset) reasons.push("bespoke key set changed");
    else {
      const read = new Set([...record.trace.files, ...filesDefining(now.bespoke.registry, record.trace.keys)]);
      const unused = bespokeEdits.filter(p => !read.has(p));
      changed = changed.filter(p => !unused.includes(p));
      if (unused.length) now.unusedBespoke = unused;
    }
  }
  const added = Object.keys(now.files).filter(p => !(p in record.files));
  const removed = Object.keys(record.files).filter(p => !(p in now.files));
  if (changed.length) reasons.push(`changed ${summarize(changed)}`);
  if (added.length) reasons.push(`new input ${summarize(added)}`);
  if (removed.length) reasons.push(`dropped input ${summarize(removed)}`);
  for (const [name, value] of Object.entries(now.externals)) {
    if (JSON.stringify(value) !== JSON.stringify(record.externals?.[name])) reasons.push(name === "node" ? "Node.js version changed" : `${EXTERNALS[name].label} changed`);
  }
  if (JSON.stringify(now.args) !== JSON.stringify(record.args)) reasons.push("arguments changed");
  return reasons.join("; ") || (now.unusedBespoke ? null : "input hash changed");
}

// ----------------------------------------------------------------- graph ----
// edges[b] = [{from:a, files}] when b reads a's outputs. Cycles are cut by
// keeping only edges that go forward in declaration order inside each SCC.
export function dependencyGraph(steps) {
  const inputs = new Map(steps.map(s => [s.name, new Set(stepInputs(s))]));
  const all = new Map(steps.map(s => [s.name, []]));
  for (const b of steps) for (const a of steps) {
    if (a === b) continue;
    const files = a.outputs.filter(p => inputs.get(b.name).has(p));
    if (files.length) all.get(b.name).push({ from: a.name, files });
  }
  // Tarjan SCC.
  const index = new Map(), low = new Map(), onStack = new Set(), stack = [], scc = new Map();
  let i = 0, c = 0;
  const visit = v => {
    index.set(v, i); low.set(v, i); i++; stack.push(v); onStack.add(v);
    for (const { from: w } of all.get(v)) {
      if (!index.has(w)) { visit(w); low.set(v, Math.min(low.get(v), low.get(w))); }
      else if (onStack.has(w)) low.set(v, Math.min(low.get(v), index.get(w)));
    }
    if (low.get(v) === index.get(v)) { let w; do { w = stack.pop(); onStack.delete(w); scc.set(w, c); } while (w !== v); c++; }
  };
  for (const s of steps) if (!index.has(s.name)) visit(s.name);
  const rank = new Map(steps.map((s, n) => [s.name, n]));
  const edges = new Map(), cut = [];
  for (const [b, list] of all) {
    edges.set(b, list.filter(e => scc.get(e.from) !== scc.get(b) || rank.get(e.from) < rank.get(b)));
    for (const e of list) if (!edges.get(b).includes(e)) cut.push({ from: e.from, to: b, files: e.files });
  }
  return { edges, cut };
}

// ---------------------------------------------------------------- runner ----
const warnings = [];
function warn(message) { if (!warnings.includes(message)) { warnings.push(message); console.warn(`warning: ${message}`); } }
const seconds = ms => `${(ms / 1000).toFixed(1)}s`;

function runStep(step, env) {
  mkdirSync(LOGS, { recursive: true });
  const log = join(LOGS, `${step.name}.log`), trace = join(LOGS, `${step.name}.trace.json`);
  rmSync(trace, { force: true });
  const out = createWriteStream(log);
  const started = Date.now();
  return new Promise(done => {
    out.write(`$ node ${[step.script, ...(step.args ?? [])].join(" ")}\n`);
    const child = spawn(process.execPath, ["--import", "./tools/build-trace.mjs", step.script, ...(step.args ?? [])], { cwd: ROOT, env: { ...env, ANIMATER_BUILD_TRACE: trace }, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    child.stdout.pipe(out, { end: false });
    child.stderr.pipe(out, { end: false });
    child.on("error", error => { out.end(`\n${error.stack}\n`); done({ code: -1, ms: Date.now() - started, log, trace }); });
    child.on("close", code => { out.end(`\n[exit ${code} after ${seconds(Date.now() - started)}]\n`, () => done({ code, ms: Date.now() - started, log, trace })); });
  });
}

// Bespoke entries the finished builder read, or null (unknown: every design counts).
async function readTrace(file, now) {
  if (!now.bespoke) return null;
  let trace;
  try { trace = JSON.parse(readFileSync(file, "utf8")); } catch { return null; }
  if (!trace.traced) return { keys: [], files: [] };
  return { keys: trace.keys, files: filesDefining(now.bespoke.registry, trace.keys) };
}

function limiter(n) {
  let active = 0;
  const queue = [];
  const next = () => { if (active < n && queue.length) { active++; queue.shift()(); } };
  return async task => {
    await new Promise(r => { queue.push(r); next(); });
    try { return await task(); } finally { active--; next(); }
  };
}

function githubEnv() {
  const env = { ...process.env };
  if (!env.GITHUB_TOKEN) {
    try { env.GITHUB_TOKEN = execFileSync("gh", ["auth", "token"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], windowsHide: true }).trim(); }
    catch { warn("GITHUB_TOKEN unset and `gh auth token` failed; GitHub API calls are rate-limited."); }
  }
  return env;
}

async function pass(steps, graph, { force, jobs, env, manifest, results, passNumber }) {
  resetExternals();
  const run = limiter(jobs), finished = new Map();
  const ran = [];
  // Topological order so every dependency's promise exists before its consumer's.
  for (const step of topological(steps, graph)) {
    finished.set(step.name, (async () => {
      const deps = graph.edges.get(step.name).filter(e => finished.has(e.from));
      const upstream = await Promise.all(deps.map(e => finished.get(e.from)));
      const blockedBy = deps.filter((e, n) => ["failed", "blocked"].includes(upstream[n].status)).map(e => e.from);
      if (blockedBy.length) return record(step, { status: "blocked", note: `needs ${blockedBy.join(", ")}` });
      const now = await snapshot(step);
      const reason = force ? "forced" : staleReason(step, now, manifest.steps[step.name]);
      if (!reason) return record(step, { status: "skipped", note: now.unusedBespoke ? `up to date (reads no entry of ${summarize(now.unusedBespoke.map(p => p.split("/").at(-1)), 2)})` : "up to date" });
      return run(async () => {
        console.log(`> ${step.name}: ${reason}`);
        const { code, ms, log, trace } = await runStep(step, env);
        forgetHashes(step.outputs);
        ran.push(step.name);
        if (code !== 0) {
          delete manifest.steps[step.name];
          saveManifest(manifest);
          console.log(`x ${step.name} failed (exit ${code}, ${seconds(ms)}) - ${relative(ROOT, log)}`);
          return record(step, { status: "failed", ms, log, note: `exit ${code}` });
        }
        manifest.steps[step.name] = { ...now, outputs: Object.fromEntries(step.outputs.map(p => [p, fileHash(p)])), trace: await readTrace(trace, now), ms, builtAt: new Date().toISOString() };
        saveManifest(manifest);
        console.log(`  ${step.name} done in ${seconds(ms)}`);
        return record(step, { status: "built", ms, log, note: reason });
      });
    })());
  }
  function record(step, result) {
    const prior = results.get(step.name);
    // Keep the most informative status across passes (a later skip does not hide a build).
    if (!prior || result.status !== "skipped") results.set(step.name, { ...result, ms: (prior?.ms ?? 0) + (result.ms ?? 0), passes: (prior?.passes ?? 0) + (result.status === "built" || result.status === "failed" ? 1 : 0), passNumber });
    return result;
  }
  await Promise.all([...finished.values()]);
  return ran;
}

async function dryRun(steps, graph, { force, manifest }) {
  const predicted = new Map();
  const order = topological(steps, graph);
  console.log("Dry run: nothing is executed.\n");
  for (const step of order) {
    const now = await snapshot(step);
    let reason = force ? "forced" : staleReason(step, now, manifest.steps[step.name]);
    let certain = Boolean(reason);
    if (!reason) {
      const upstream = graph.edges.get(step.name).filter(e => predicted.get(e.from));
      if (upstream.length) reason = `may rebuild if ${upstream.map(e => `${e.from} changes ${summarize(e.files, 2)}`).join("; ")}`;
    }
    predicted.set(step.name, Boolean(reason));
    const note = now.unusedBespoke ? `up to date (reads no entry of ${summarize(now.unusedBespoke.map(p => p.split("/").at(-1)), 2)})` : "up to date";
    console.log(`${(reason ? (certain ? "REBUILD" : "maybe") : "skip").padEnd(8)} ${step.name.padEnd(15)} ${reason ?? note}`);
  }
  if (graph.cut.length) console.log(`\nCycle edges settled by a follow-up pass: ${graph.cut.map(e => `${e.from} -> ${e.to}`).join(", ")}`);
}

function topological(steps, graph) {
  const done = new Set(), order = [];
  const visit = s => { if (done.has(s.name)) return; done.add(s.name); for (const e of graph.edges.get(s.name)) { const d = steps.find(x => x.name === e.from); if (d) visit(d); } order.push(s); };
  for (const s of steps) visit(s);
  return order;
}

export async function main(argv = process.argv.slice(2)) {
  const flag = name => argv.includes(`--${name}`);
  const option = name => argv.find(a => a.startsWith(`--${name}=`))?.split("=")[1];
  if (flag("help")) {
    console.log(`npm run build -- [--force] [--only=name,...] [--dry-run] [--jobs=N] [--graph]\nSteps: ${STEPS.map(s => s.name).join(", ")}\n--only restricts the run to the named steps (downstream steps are not run); combine with --force to rebuild them unconditionally.`);
    return 0;
  }
  const only = option("only")?.split(",").filter(Boolean);
  const unknown = only?.filter(n => !STEPS.some(s => s.name === n)) ?? [];
  if (unknown.length) { console.error(`Unknown step(s): ${unknown.join(", ")}. Steps: ${STEPS.map(s => s.name).join(", ")}`); return 2; }
  const steps = only ? STEPS.filter(s => only.includes(s.name)) : STEPS;
  if (steps.some(s => s.extraInputs === FEAT_REVIEWS)) ensureFeatReviews();
  const jobs = Math.max(1, Number(option("jobs") ?? 3));
  const force = flag("force");
  const graph = dependencyGraph(steps);
  saveGraphCache();
  const manifest = loadManifest();
  if (flag("graph")) {
    for (const s of steps) console.log(`${s.name}: ${graph.edges.get(s.name).map(e => e.from).join(", ") || "-"}`);
    console.log(`cut (cycle) edges: ${graph.cut.map(e => `${e.from}->${e.to} via ${e.files.join(",")}`).join("; ") || "-"}`);
    return 0;
  }
  if (flag("dry-run")) { await dryRun(steps, graph, { force, manifest }); return 0; }

  const env = githubEnv(), results = new Map(), started = Date.now();
  let ran = await pass(steps, graph, { force, jobs, env, manifest, results, passNumber: 1 });
  // Cycle edges (and edits made while building) may leave consumers stale.
  for (let n = 2; n <= MAX_PASSES && ran.length && ![...results.values()].some(r => r.status === "failed"); n++) {
    ran = await pass(steps, graph, { force: false, jobs, env, manifest, results, passNumber: n });
    if (ran.length) console.log(`(pass ${n} rebuilt ${ran.join(", ")} after cycle inputs changed)`);
  }
  console.log("\nBuild summary");
  for (const step of steps) {
    const r = results.get(step.name);
    console.log(`  ${r.status.padEnd(8)} ${step.name.padEnd(15)} ${(r.ms ? seconds(r.ms) : "").padStart(7)}  ${r.status === "built" ? (r.passes > 1 ? `x${r.passes} ` : "") + r.note : r.note}${r.log && r.status === "failed" ? `  log: ${relative(ROOT, r.log)}` : ""}`);
  }
  const counts = [...results.values()].reduce((m, r) => ({ ...m, [r.status]: (m[r.status] ?? 0) + 1 }), {});
  console.log(`  ${Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(", ")} in ${seconds(Date.now() - started)}; logs in ${relative(ROOT, LOGS)}`);
  if (ran.length && !counts.failed) warn(`still changing after ${MAX_PASSES} passes: ${ran.join(", ")}`);
  return counts.failed || counts.blocked ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = await main();
