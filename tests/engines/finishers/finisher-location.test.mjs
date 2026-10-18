// Wall slam (and every flung finisher): the crash and landing effects play where the token
// hits, whether or not its document has been moved there when Sequencer places them.
import test from "node:test";
import assert from "node:assert/strict";
import { composeFinisher, playFinisher } from "../../../scripts/engines/finishers/finisher-play.mjs";
import { presetFinisher } from "../../../scripts/engines/finishers/finisher-presets.mjs";
import { previewPlan, validateRecipe } from "../../../scripts/core/model.mjs";
import { AnimaterRuntime } from "../../../scripts/engines/playback/runtime.mjs";

const GRID = 100;
// A token as Sequencer reads it: its live document square plus half its size.
const token = (name, x, y) => {
  const t = { id: name, name, document: { x, y, width: 1, height: 1 }, w: GRID, h: GRID };
  Object.defineProperty(t, "center", { get: () => ({ x: t.document.x + GRID / 2, y: t.document.y + GRID / 2 }) });
  return t;
};
// Walks the grid like landingSpot, stopping after `blockAfter` squares (a wall).
const landing = (blockAfter) => (m, d, squares) => {
  const steps = Math.min(squares, blockAfter), lead = Math.max(Math.abs(d.x), Math.abs(d.y));
  return { x: m.document.x + Math.round((d.x / lead) * steps) * GRID, y: m.document.y + Math.round((d.y / lead) * steps) * GRID };
};

// Plays the real preset through the real runtime. The fake Sequencer resolves each effect's
// location when the effect starts, from the token's live position (as Sequencer does for a
// placeable), and the document move is committed before the crash starts: the worst case live,
// where Sequencer is still loading the crash's media when the move lands.
async function playSlam(blockAfter) {
  const recipe = presetFinisher("wall-slam", "ws");
  const assets = [...new Set(recipe.stages.flatMap((s) => s.assets))];
  const mover = token("Orc", 100, 100), attacker = token("Hero", 0, 100);
  const drawn = [];
  let now = 0;
  const timers = [];
  const sleep = (ms) => new Promise((resolve) => timers.push({ at: now + ms, resolve }));
  const host = {
    database: { entryExists: () => true, getPathsUnder: () => assets, getAllFileEntries: (k) => [`${k}.webm`] },
    enabled: () => true, recipes: () => [], ready: () => true, canPlay: () => true, userId: () => "u", gridSize: () => GRID,
    sequence: () => {
      const effects = [];
      const chain = (calls) => new Proxy({}, { get: (_, key) => (...args) => { calls.push([key, ...args]); return chain(calls); } });
      return {
        effect: () => { const calls = []; effects.push(calls); return chain(calls); },
        sound: () => chain([]),
        play: async () => {
          // The move is written while the effects load.
          await sleep(1);
          for (const calls of effects) {
            const [, where, { offset }] = calls.find((c) => c[0] === "atLocation");
            const at = where.document ? where.center : where;
            drawn.push({ file: calls.find((c) => c[0] === "file")[1], x: at.x + offset.x * GRID, y: at.y + offset.y * GRID, onToken: Boolean(where.document) });
          }
        },
      };
    },
    endEffects: async () => {}, motion: async () => {},
  };
  const runtime = new AnimaterRuntime(host);
  runtime.refreshCatalog();
  runtime.wait = async (ms) => { await sleep(ms); return true; };
  const finisherHost = {
    gridSize: () => GRID, landing: landing(blockAfter), trace: () => {}, fade: async () => {}, wait: (ms) => sleep(ms),
    play: (r, context) => new Promise((resolve) => {
      runtime.play(r, context, { onStart: (started) => resolve(started.playbackPlan) }).then(() => resolve(null), () => resolve(null));
    }),
    commit: async (t, data) => { if (data.x !== undefined) Object.assign(t.document, { x: data.x, y: data.y }); },
  };
  const done = playFinisher({ recipe, mover, attacker, dead: true }, finisherHost);
  for (let i = 0; i < 1000; i++) {
    await new Promise((resolve) => setImmediate(resolve));
    timers.sort((a, b) => a.at - b.at);
    const next = timers.shift();
    if (!next) break;
    now = next.at;
    next.resolve();
  }
  await done;
  return { drawn, mover };
}

test("wall slam, blocked after 3 of 6 squares: the crash is drawn 0.6 square past the landing even after the move is written", async () => {
  const { drawn, mover } = await playSlam(3);
  assert.equal(mover.document.x, 400, "the token landed 3 squares out");
  // Everything but the hit (drawn on the token at 150, 150 before anything moves).
  const crash = drawn.filter((d) => !(d.x === 150 && d.y === 150));
  assert.ok(crash.length >= 2, `crack and dust were drawn: ${JSON.stringify(drawn)}`);
  for (const d of crash) {
    assert.deepEqual([Math.round(d.x), d.y], [510, 150], `${d.file} at the wall, not past it: ${JSON.stringify(d)}`);
    assert.equal(d.onToken, false, "anchored to a canvas point, not to the moving token");
  }
});

test("wall slam with no wall in the way: the landing is drawn on the landing square after the move is written", async () => {
  const { drawn, mover } = await playSlam(Infinity);
  assert.equal(mover.document.x, 700);
  const land = drawn.filter((d) => !(d.x === 150 && d.y === 150));
  assert.equal(land.length, 1, JSON.stringify(drawn));
  assert.deepEqual([land[0].x, land[0].y], [750, 150]);
});

test("the hit stays on the token where it is struck", async () => {
  const { drawn } = await playSlam(3);
  const hit = drawn.find((d) => d.x === 150);
  assert.ok(hit && hit.onToken, JSON.stringify(drawn));
});

test("compose pins the mover's offset stages to its starting centre; other stages keep their token", () => {
  const recipe = presetFinisher("wall-slam", "ws");
  const at = { x: 150, y: 150 };
  const slam = { keyframes: [{ at: 0, x: 0, y: 0 }, { at: 1, x: 3, y: 0 }], t: 0.5, aim: { x: 1, y: 0 } };
  const { recipe: hit } = composeFinisher(recipe, { offset: { x: 3, y: 0 }, frame: { aim: { x: 1, y: 0 }, length: 6 }, slam, at });
  const by = (id) => hit.stages.find((s) => s.stageId === id);
  assert.deepEqual(by("wall-crack").atPoint, at);
  assert.deepEqual(by("wall-dust").atPoint, at);
  assert.equal(by("wall-squash").atPoint, undefined, "a motion moves the token itself");
  assert.equal(by("hit").atPoint, undefined);
  const { recipe: free } = composeFinisher(recipe, { offset: { x: 6, y: 0 }, frame: { aim: { x: 1, y: 0 }, length: 6 }, at });
  assert.deepEqual(free.stages.find((s) => s.stageId === "landing").atPoint, at);
  const { recipe: none } = composeFinisher(recipe, { offset: { x: 6, y: 0 }, frame: { aim: { x: 1, y: 0 }, length: 6 } });
  assert.equal(none.stages.find((s) => s.stageId === "landing").atPoint, undefined, "no point given: unchanged");
});

test("a canvas point survives validation and planning as the stage's location, with its offset", () => {
  const r = validateRecipe({ id: "r", name: "R", trigger: "manual", stages: [
    { stageId: "crash", kind: "impact", assets: ["jb2a.impact.005.white"], offsetX: 3.6, atPoint: { x: 150, y: 150 } },
    { stageId: "shake", kind: "motion", motion: "shake", subject: "targets", assets: [], atPoint: { x: 1, y: 2 } },
    { stageId: "bad", kind: "impact", assets: ["jb2a.impact.005.white"], atPoint: { x: "a", y: Infinity } },
  ] });
  assert.deepEqual(r.stages[0].atPoint, { x: 150, y: 150 });
  assert.equal(r.stages[1].atPoint, undefined, "motion has no location to pin");
  assert.equal(r.stages[2].atPoint, undefined, "not a point");
  const target = token("Orc", 100, 100);
  const plan = previewPlan(r, { source: token("Hero", 0, 100), targets: [target], gridSize: GRID });
  const crash = plan.find((s) => s.stageId === "crash");
  assert.deepEqual(crash.landing, { x: 150, y: 150 });
  assert.equal(crash.offsetX, 3.6);
  assert.equal(crash.destination, target, "still sized from its token");
  assert.equal(plan.find((s) => s.stageId === "bad").landing, null);
});
