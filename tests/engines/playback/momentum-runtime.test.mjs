import test from "node:test";
import assert from "node:assert/strict";
import { AnimaterRuntime } from "../../../scripts/engines/playback/runtime.mjs";
import { starterRecipes } from "../../../scripts/core/presets.mjs";
import { validateRecipe } from "../../../scripts/core/model.mjs";

function fixture({ momentum = true, turn = "c:1:0" } = {}) {
  const calls = [];
  const effect = new Proxy({}, { get: (_, key) => (...args) => { calls.push([key, ...args]); return effect; } });
  const host = {
    database: { entryExists: () => true, getPathsUnder: () => [], getAllFileEntries: (k) => [`${k}.webm`] },
    enabled: () => true,
    recipes: () => starterRecipes(),
    ready: () => true,
    canPlay: () => true,
    userId: () => "u",
    sequence: () => ({ effect: () => effect, sound: () => effect, play: async () => {} }),
    endEffects: async () => {},
    endSounds: async () => {},
    motion: async (stage) => calls.push(["motion", stage]),
    stopMotion: async () => {},
    mapDistortion: () => true,
    heavyItem: () => true,
    momentum: () => momentum,
    turnKey: () => turn,
  };
  const runtime = new AnimaterRuntime(host);
  runtime.catalog = ["jb2a.impact.001.orange"].map((key) => ({ key }));
  runtime.wait = async () => true;
  return { runtime, host, calls };
}
const recipe = () => validateRecipe({
  ...starterRecipes()[0],
  stages: [
    { stageId: "lunge", kind: "motion", motion: "lunge", subject: "source", assets: [], delay: 0, duration: 680 },
    { stageId: "hit", kind: "impact", assets: ["jb2a.impact.001.orange"], delay: 300, duration: 500 },
  ],
});
const attack = (n, outcome = "success", extra = {}) => ({ type: "attack", id: `chat:${n}`, messageId: n, systemId: "pf2e", automatic: true, outcome,
  item: { id: "axe", type: "weapon" }, source: { id: "s", center: { x: 0, y: 0 } }, targets: [{ id: "t1", center: { x: 300, y: 0 } }], ...extra });
async function played(runtime, context, options = {}) {
  let plan;
  await runtime.play(recipe(), context, { ...options, onStart: (r) => { plan = r.playbackPlan; } });
  return plan;
}
const hitScale = (plan) => plan.find((s) => s.stageId === "hit")?.scale;

test("momentum: the 2nd and 3rd hit on a target in one turn land bigger", async () => {
  const { runtime } = fixture();
  const scales = [];
  for (const n of ["1", "2", "3"]) scales.push(hitScale(await played(runtime, attack(n))));
  assert.ok(Math.abs(scales[1] / scales[0] - 1.1) < 1e-9);
  assert.ok(Math.abs(scales[2] / scales[0] - 1.2) < 1e-9);
});

test("momentum: setting off, a preview or a manual play never builds it", async () => {
  for (const [setup, context] of [[{ momentum: false }, {}], [{}, { automatic: false }]]) {
    const { runtime } = fixture(setup);
    const a = hitScale(await played(runtime, attack("1", "success", context)));
    const b = hitScale(await played(runtime, attack("2", "success", context)));
    assert.equal(a, b);
  }
  const { runtime } = fixture();
  await played(runtime, attack("1"), { preview: true });
  const a = hitScale(await played(runtime, attack("2")));
  const b = hitScale(await played(runtime, attack("3")));
  assert.ok(Math.abs(b / a - 1.1) < 1e-9, "the preview did not count");
});

test("momentum: the distortion of a streaking critical hit is stronger", async () => {
  const { runtime, calls } = fixture();
  const strengths = [];
  for (const n of ["1", "2"]) {
    calls.length = 0;
    await played(runtime, attack(n, "criticalSuccess"));
    let pending = null;
    for (const c of calls) {
      if (c[0] === "addOverride") pending = c[1];
      else if (c[0] === "file" && pending) { const d = await pending(null, {}); if (d.animaterWarp) strengths.push(d.animaterWarp.strength); pending = null; }
    }
  }
  assert.equal(strengths.length, 2);
  assert.ok(Math.abs(strengths[1] / strengths[0] - 1.1) < 1e-9);
});

test("strained strike: the 3rd PF2e Strike of a turn that misses slows the gesture and stumbles", async () => {
  const { runtime } = fixture();
  await played(runtime, attack("1", "failure"));
  const second = await played(runtime, attack("2", "failure"));
  const third = await played(runtime, attack("3", "failure"));
  const lunge = (plan) => plan.find((s) => s.stageId === "lunge");
  assert.equal(second.some((s) => s.stageId === "strained-stumble"), false);
  assert.ok(lunge(third).duration > lunge(second).duration);
  assert.ok(third.some((s) => s.stageId === "strained-stumble"));
});
