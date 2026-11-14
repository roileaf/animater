import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { propSceneFieldsHTML } from "../../../scripts/ui/prop-config.mjs";

const main = readFileSync(new URL("../../../scripts/main.mjs", import.meta.url), "utf8");

test("the scene's switch is off by default and says what thick and thin smoke do", () => {
  const off = propSceneFieldsHTML({});
  assert.match(off, /name="flags\.animater\.roomSmoke"/);
  assert.doesNotMatch(off, /roomSmoke"[^>]*checked/);
  assert.match(off, /Fires fill rooms with smoke/);
  assert.match(off, /[Tt]hick smoke blocks sight/);
  assert.match(off, /thin smoke conceals/);
  assert.match(propSceneFieldsHTML({ roomSmoke: true }), /roomSmoke"[^>]*checked/);
});

test("the scene configuration passes the switch it saves", () => {
  assert.match(main, /propSceneFieldsHTML\(\{[^}]*roomSmoke: flags\.roomSmoke === true/);
});

test("a fire light's own switch is there, unticked, so a hearth does not fog the inn", () => {
  assert.match(main, /Fills the room with smoke/);
  assert.match(main, /name="flags\.\$\{ID\}\.roomSmoke"\$\{flags\.roomSmoke === true \? " checked" : ""\}/);
});

test("the smoke runs on the fire's own round, in the fire's own loop: no second clock", () => {
  const tick = main.slice(main.indexOf("async function fireRoundsNow"));
  assert.match(tick, /await smokeRound\(scene, burning\)/);
  // Only the one interval the fire already keeps.
  assert.equal([...main.matchAll(/setInterval\(fireTick/g)].length, 1);
  assert.equal([...main.matchAll(/smokeRound\(/g)].length, 2, "declared once, called once");
});

test("only the active GM writes, and nothing is drawn from the wall clock or chance", () => {
  const round = main.slice(main.indexOf("async function smokeRound"), main.indexOf("async function smokeRegionNow"));
  assert.match(round, /game\.users\?\.activeGM\?\.isSelf/);
  assert.doesNotMatch(round, /Math\.random\(|Date\.now\(/);
});

test("the geometry the cells were indexed with is written beside them, key by key, so Foundry merges it", () => {
  const round = main.slice(main.indexOf("async function smokeRound"), main.indexOf("async function smokeRegionNow"));
  // cols, cell and the level, each at its own path: never one write of the whole object.
  assert.match(round, /\$\{SMOKE_GRID_FLAG\}\.\$\{key\}/);
  assert.match(round, /const want = \{ cols, cell, \.\.\.\(level \? \{ level \} : \{\}\) \}/);
  // The same smokeGridOf the fence reads against.
  assert.match(round, /smokeGridOf\(scene\.dimensions\)/);
  // Cells only ever clear through smokeUpdatesFor's own deletes, or an explicit keyed delete.
  assert.match(round, /smokeUpdatesFor\(next, \{ scene \}\)/);
  assert.doesNotMatch(round, /`flags\.\$\{ID\}\.smoke` *[:=]/);
});

test("the regions of the scene are read through viewedRegions, never raw", () => {
  const smoke = main.slice(main.indexOf("const LEVEL_ID ="), main.indexOf("// The ticker: every scene with both switches on"));
  assert.equal([...smoke.matchAll(/\.regions/g)].length, [...smoke.matchAll(/viewedRegions\(scene\.regions\)/g)].length);
});

test("an outdoor fire fills nothing: sources and results are kept to the cells indoors", () => {
  const round = main.slice(main.indexOf("async function smokeRound"), main.indexOf("async function smokeRegionNow"));
  assert.match(round, /sources: sourcesAll\.filter\(\(s\) => indoors\(s\.i\)\)/);
  assert.match(round, /step\.cells\.filter\(\(c\) => indoors\(c\.i\)\)/);
  // Smoke never crosses out of the room, and where no wall stands in the way the room breathes out there.
  assert.match(round, /if \(!indoors\(n\)\) \{ blocked\.push\(\{ from: i, to: n \}\); if \(!wall\) breathes = true;/);
  assert.match(round, /openings\.push\(i\)/);
  // Underground is all indoors.
  assert.match(round, /undergroundOf\(scene\?\.flags\?\.\[ID\]|undergroundOf\(scene\.flags\?\.\[ID\]/);
});

test("concealment needs visioner's behaviour registered, not merely installed", () => {
  assert.match(main, /game\.modules\?\.get\("pf2e-visioner"\)\?\.active === true && !!CONFIG\.RegionBehavior\?\.dataModels\?\.\[CONCEALMENT_BEHAVIOUR\]/);
});

test("fireRound hands its burning things on instead of gathering them twice", () => {
  const fire = main.slice(main.indexOf("async function fireRound(scene)"), main.indexOf("// ---- The smoke a fire fills"));
  assert.match(fire, /const burningNow = /);
  assert.match(fire, /\n  return burningNow;\r?\n\}/);
  // Every early exit of the round says "nothing is burning".
  assert.doesNotMatch(fire, /\n  if \([^\n]*\) return;\r?\n/);
});
