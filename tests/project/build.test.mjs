import test from "node:test";
import assert from "node:assert/strict";
import { STEPS, stepInputs, dependencyGraph, staleReason } from "../../tools/build.mjs";

const step = name => STEPS.find(s => s.name === name);

test("build inputs follow the static graph but exclude the step's own outputs", () => {
  const spells = stepInputs(step("spells"));
  assert.ok(spells.includes("tools/build-pf2e-catalog.mjs"));
  assert.ok(spells.includes("tools/asset-databases.mjs"));
  assert.ok(spells.some(p => p.startsWith("scripts/catalogs/bespoke/")), "bespoke registry is part of the spell graph");
  assert.ok(!spells.includes("data/pf2e-spells.mjs") && !spells.includes("data/spell-assets.mjs"));
  assert.ok(!spells.some(p => p.startsWith(".cache/")));
  for (const name of ["feats", "actions", "classfeatures"]) assert.ok(stepInputs(step(name)).includes("tools/feat-support-review.mjs"));
});

test("dependencies come from the import graph and cycles are cut by declaration order", () => {
  const { edges, cut } = dependencyGraph(STEPS);
  const deps = name => edges.get(name).map(e => e.from);
  assert.ok(deps("feats").includes("spells"), "feats read data/spell-assets.mjs");
  assert.deepEqual(["weapons", "spells", "feats", "states"].filter(n => deps("sf2e").includes(n)), ["weapons", "spells", "feats", "states"]);
  assert.ok(deps("verify-dnd5e").includes("dnd5e") && deps("verify-dnd5e").includes("footprints"));
  assert.ok(deps("ability-sounds").includes("feats"));
  // Kept edges form a DAG.
  const seen = new Set(), active = new Set();
  const visit = n => { assert.ok(!active.has(n), `cycle through ${n}`); if (seen.has(n)) return; active.add(n); for (const d of deps(n)) visit(d); active.delete(n); seen.add(n); };
  for (const s of STEPS) visit(s.name);
  const rank = new Map(STEPS.map((s, i) => [s.name, i]));
  for (const e of cut) assert.ok(rank.get(e.from) > rank.get(e.to), `${e.from}->${e.to} cut against declaration order`);
});

test("stale reasons name what changed", () => {
  const s = { name: "x", outputs: [] };
  const record = { hash: "a", files: { "tools/a.mjs": "1", "tools/b.mjs": "2" }, externals: { node: "24" }, args: [], outputs: {} };
  assert.equal(staleReason(s, { ...record }, record), null);
  assert.equal(staleReason(s, record, undefined), "never built");
  const now = { hash: "b", files: { "tools/a.mjs": "9", "tools/c.mjs": "3" }, externals: { node: "24" }, args: [] };
  assert.equal(staleReason(s, now, record), "changed tools/a.mjs; new input tools/c.mjs; dropped input tools/b.mjs");
  assert.match(staleReason({ name: "y", outputs: ["data/does-not-exist.mjs"] }, record, record), /output missing/);
});
