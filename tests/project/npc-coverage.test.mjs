import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { animates } from "../../tools/audit-npc-coverage.mjs";

// The most common NPC Strikes, abilities and spells across the installed bestiaries, weighted by how
// often they appear (tools/audit-npc-coverage.mjs --fixture). Each kind must keep animating.
const fixture = JSON.parse(fs.readFileSync(new URL("../fixtures/npc-coverage.json", import.meta.url), "utf8"));
const coverage = (rows) => {
  const total = rows.reduce((n, r) => n + r.count, 0), shown = rows.filter(animates);
  return { percent: (100 * shown.reduce((n, r) => n + r.count, 0)) / total, missed: rows.filter((r) => !animates(r)).slice(0, 10).map((r) => r.name) };
};
for (const [kind, floor] of [["melee strikes", 99], ["ranged strikes", 99], ["offensive abilities", 98], ["spells", 98], ["other active abilities", 55]]) {
  test(`NPC ${kind} animate (at least ${floor}%)`, () => {
    const { percent, missed } = coverage(fixture[kind]);
    assert.ok(percent >= floor, `${percent.toFixed(1)}% of ${kind}; missed: ${missed.join(", ")}`);
  });
}
