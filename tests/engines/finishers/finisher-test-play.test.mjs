// Testing a finisher from the studio (Play at table, Local preview) or api.play plays it composed,
// as a kill would: the travel stops at the wall and the crash shows where the token hits. It never
// writes the token (no move, no hide, no defeat).
import test from "node:test";
import assert from "node:assert/strict";
import { planFinisher, playFinisher, previewFinisher, travelEnd } from "../../../scripts/engines/finishers/finisher-play.mjs";
import { presetFinisher } from "../../../scripts/engines/finishers/finisher-presets.mjs";
import { AnimaterRuntime } from "../../../scripts/engines/playback/runtime.mjs";
import { previewPlan } from "../../../scripts/core/model.mjs";

const GRID = 100;
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
// A test host: no commit, fade or wait — a test play has nothing to write with.
const testHost = (blockAfter, traces = []) => ({ gridSize: () => GRID, landing: landing(blockAfter), trace: (...t) => traces.push(t) });
const by = (recipe, id) => recipe.stages.find((s) => s.stageId === id);

test("planFinisher: a wall slam blocked after 3 squares cuts the travel and pins the crash 0.6 square past it", () => {
  const recipe = presetFinisher("wall-slam", "ws");
  const mover = token("Orc", 100, 100), attacker = token("Hero", 0, 100);
  const planned = planFinisher({ recipe, mover, attacker, target: mover, dead: true }, testHost(3));
  assert.deepEqual(planned.to, { x: 400, y: 100 });
  assert.deepEqual(planned.from, { x: 100, y: 100 });
  assert.equal(planned.moves, true);
  for (const id of ["wall-crack", "wall-dust"]) {
    assert.deepEqual(by(planned.composed, id).atPoint, { x: 150, y: 150 }, `${id} pinned to the start centre`);
    assert.ok(Math.abs(by(planned.composed, id).offsetX - 3.6) < 1e-9, `${id} offset to the wall`);
  }
  assert.equal(by(planned.composed, "landing"), undefined, "a slam has no landing");
  assert.equal(planned.context.source, attacker);
  assert.deepEqual(planned.context.targets, [mover]);
  assert.deepEqual(mover.document, { x: 100, y: 100, width: 1, height: 1 }, "planning writes nothing");
});

test("planFinisher with no wall: the landing is pinned and offset to the landing square", () => {
  const recipe = presetFinisher("wall-slam", "ws");
  const mover = token("Orc", 100, 100);
  const { composed } = planFinisher({ recipe, mover, attacker: token("Hero", 0, 100), target: mover, dead: true }, testHost(Infinity));
  assert.equal(by(composed, "wall-crack"), undefined, "no wall, no crash");
  assert.deepEqual(by(composed, "landing").atPoint, { x: 150, y: 150 });
  assert.equal(by(composed, "landing").offsetX, 6);
});

test("planFinisher with no attacker: a wall slam still cuts at the wall and offsets the crash", () => {
  const recipe = presetFinisher("wall-slam", "ws");
  const mover = token("Orc", 100, 100);
  const { composed, to } = planFinisher({ recipe, mover, dead: true }, testHost(3));
  assert.deepEqual(to, { x: 400, y: 100 });
  for (const id of ["wall-crack", "wall-dust"]) {
    assert.deepEqual(by(composed, id).atPoint, { x: 150, y: 150 });
    assert.ok(Math.abs(by(composed, id).offsetX - 3.6) < 1e-9);
  }
});

test("planFinisher with no attacker and no wall: the landing is offset", () => {
  const recipe = presetFinisher("wall-slam", "ws");
  const mover = token("Orc", 100, 100);
  const { composed } = planFinisher({ recipe, mover, dead: true }, testHost(Infinity));
  assert.deepEqual(by(composed, "landing").atPoint, { x: 150, y: 150 });
  assert.equal(by(composed, "landing").offsetX, 6);
});

test("planFinisher with no attacker aims along the mover's rotation when it has one", () => {
  const recipe = presetFinisher("wall-slam", "ws");
  const mover = token("Orc", 100, 100);
  mover.document.rotation = 90;
  const { to } = planFinisher({ recipe, mover, dead: true }, testHost(Infinity));
  assert.equal(to.x, 100);
  assert.ok(to.y > 100);
});

test("planFinisher with an attacker is unchanged by the default aim", () => {
  const recipe = presetFinisher("wall-slam", "ws");
  const mover = token("Orc", 100, 100);
  mover.document.rotation = 90;
  const planned = planFinisher({ recipe, mover, attacker: token("Hero", 0, 100), target: mover, dead: true }, testHost(3));
  assert.deepEqual(planned.to, { x: 400, y: 100 });
  assert.ok(Math.abs(by(planned.composed, "wall-crack").offsetX - 3.6) < 1e-9);
});

test("previewFinisher plays each target's composed recipe, onStart for the first only, and writes nothing", async () => {
  const recipe = presetFinisher("wall-slam", "ws");
  const hero = token("Hero", 0, 100), orc = token("Orc", 100, 100), gob = token("Gob", 100, 300);
  const plays = [];
  const host = { ...testHost(3), commit: () => assert.fail("a test play never writes") };
  const result = await previewFinisher(recipe, { source: hero, targets: [orc, gob], template: "t" }, host, async (composed, context, first) => {
    plays.push({ composed, context, first });
    return `played ${context.targets[0].name}`;
  });
  assert.equal(result, "played Orc");
  assert.deepEqual(plays.map((p) => [p.context.targets[0].name, p.first, p.context.source.name, p.context.template]), [["Orc", true, "Hero", "t"], ["Gob", false, "Hero", "t"]]);
  const crack = by(plays[0].composed, "wall-crack");
  assert.deepEqual(crack.atPoint, { x: 150, y: 150 });
  assert.equal(by(plays[0].composed, "landing"), undefined);
  assert.deepEqual([orc.document.x, orc.document.y, gob.document.x, gob.document.y], [100, 100, 100, 300]);
});

test("previewFinisher: no mover token or no finisher block falls back (null) to the raw play", () => {
  const play = () => assert.fail("nothing composed to play");
  const hero = token("Hero", 0, 100);
  assert.equal(previewFinisher(presetFinisher("wall-slam", "ws"), { source: hero, targets: [] }, testHost(3), play), null);
  assert.equal(previewFinisher({ id: "r", name: "R", stages: [] }, { source: hero, targets: [token("Orc", 100, 100)] }, testHost(3), play), null);
  const sourceMover = presetFinisher("wall-slam", "ws");
  sourceMover.finisher = { ...sourceMover.finisher, mover: "source" };
  assert.equal(previewFinisher(sourceMover, { source: hero, targets: [] }, testHost(3), play), null, "an old source mover moves targets too: none, nothing to compose");
});

test("previewFinisher: an old source-mover finisher moves the target, aimed away from the source", async () => {
  const recipe = presetFinisher("wall-slam", "ws");
  recipe.finisher = { ...recipe.finisher, mover: "source" };
  const hero = token("Hero", 0, 100), orc = token("Orc", 100, 100), plays = [];
  await previewFinisher(recipe, { source: hero, targets: [orc] }, testHost(3), (composed, context) => { plays.push(context); return true; });
  assert.equal(plays.length, 1);
  assert.equal(plays[0].source, hero);
  assert.deepEqual(plays[0].targets, [orc]);
});

test("playFinisher still writes the landing for automation", async () => {
  const recipe = presetFinisher("wall-slam", "ws");
  const mover = token("Orc", 100, 100), commits = [];
  const host = { ...testHost(3), play: async (r) => r.stages.map((s) => ({ ...s, delay: s.delay ?? 0, duration: s.duration ?? 0 })), wait: async () => {}, fade: async () => {}, commit: async (t, data) => commits.push(data) };
  assert.equal(await playFinisher({ recipe, mover, attacker: token("Hero", 0, 100), target: mover, dead: true }, host), true);
  assert.deepEqual(commits[0], { x: 400, y: 100, fromX: 100, fromY: 100, finisher: "ws" });
});

// End to end through the real runtime, as main.mjs's playTest drives it: the fake Sequencer
// records where each effect is drawn.
test("a studio test play of wall slam draws the crash at the wall through the real runtime", async () => {
  const recipe = presetFinisher("wall-slam", "ws");
  const assets = [...new Set(recipe.stages.flatMap((s) => s.assets))];
  const drawn = [];
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
          for (const calls of effects) {
            const [, where, { offset }] = calls.find((c) => c[0] === "atLocation");
            const at = where.document ? where.center : where;
            drawn.push({ file: calls.find((c) => c[0] === "file")[1], x: at.x + offset.x * GRID, y: at.y + offset.y * GRID });
          }
        },
      };
    },
    endEffects: async () => {}, motion: async () => {},
  };
  const runtime = new AnimaterRuntime(host);
  runtime.refreshCatalog();
  runtime.wait = async () => true;
  const hero = token("Hero", 0, 100), orc = token("Orc", 100, 100);
  let started = 0;
  await previewFinisher(recipe, { source: hero, targets: [orc] }, testHost(3), (composed, context, first) =>
    runtime.play(composed, context, { preview: true, ...(first ? { onStart: () => started++ } : {}) }));
  assert.equal(started, 1);
  const crash = drawn.filter((d) => !(d.x === 150 && d.y === 150));
  assert.ok(crash.length >= 2, JSON.stringify(drawn));
  for (const d of crash) assert.deepEqual([Math.round(d.x), d.y], [510, 150], `${d.file} at the wall: ${JSON.stringify(d)}`);
  assert.deepEqual([orc.document.x, orc.document.y], [100, 100], "the token is never moved");
});

test("planFinisher: a fragments-only finisher with knockback is shoved to the landing square and cut there", () => {
  const recipe = { ...presetFinisher("slice-in-half", "sl"), finisher: { ...presetFinisher("slice-in-half", "sl").finisher, knockback: 3 } };
  const mover = token("Orc", 100, 100);
  const planned = planFinisher({ recipe, mover, attacker: token("Hero", 0, 100), dead: true }, testHost(Infinity));
  assert.equal(planned.moves, true);
  assert.deepEqual(planned.to, { x: 400, y: 100 });
  const [shove] = planned.composed.stages;
  assert.equal(shove.motion, "rush");
  assert.deepEqual(shove.motionOffset, { x: 3, y: 0 });
  assert.equal(by(planned.composed, "slash").offsetX, 3);
  assert.equal(by(planned.composed, "cut").delay, 250 + shove.duration);
  assert.equal(planFinisher({ recipe, mover, attacker: token("Hero", 0, 100), dead: true }, testHost(1)).composed.stages[0].motionOffset.x, 1, "a wall shortens it");
});

test("a studio test play of a shove draws the slash on the landing square and writes nothing", async () => {
  const base = presetFinisher("slice-in-half", "sl"), recipe = { ...base, finisher: { ...base.finisher, knockback: 2 } };
  const assets = [...new Set(recipe.stages.flatMap((s) => s.assets))];
  const drawn = [], motions = [];
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
          for (const calls of effects) {
            const [, where, { offset }] = calls.find((c) => c[0] === "atLocation");
            const at = where.document ? where.center : where;
            drawn.push({ x: at.x + offset.x * GRID, y: at.y + offset.y * GRID });
          }
        },
      };
    },
    endEffects: async () => {}, motion: async (stage) => { motions.push(stage); },
  };
  const runtime = new AnimaterRuntime(host);
  runtime.refreshCatalog();
  runtime.wait = async () => true;
  const hero = token("Hero", 0, 100), orc = token("Orc", 100, 100);
  const writes = { ...testHost(Infinity), commit: () => assert.fail("a test play never writes"), fade: () => assert.fail("nor fades") };
  await previewFinisher(recipe, { source: hero, targets: [orc] }, writes, (composed, context) => runtime.play(composed, context, { preview: true }));
  assert.ok(drawn.length >= 1);
  for (const d of drawn) assert.deepEqual([Math.round(d.x), d.y], [350, 150], "the slash plays two squares over");
  assert.ok(motions.some((m) => m.motion === "rush" && m.motionOffset?.x === 2), "the shove is played");
  assert.deepEqual([orc.document.x, orc.document.y], [100, 100], "the token is never moved");
});

// Local preview runs the whole plan: the runtime waits out the latest stage end and gives every
// effect its full stage duration, for a plain recipe and for a composed finisher alike.
test("a local preview waits out the whole plan and plays every effect at full length", async () => {
  const finisher = presetFinisher("wall-slam", "ws");
  const plain = { id: "p", name: "Plain", trigger: "manual", stages: [
    { stageId: "a", kind: "impact", assets: ["jb2a.impact.003.white"], delay: 0, duration: 2600 },
    { stageId: "b", kind: "impact", assets: ["jb2a.impact.005.white"], afterStage: "a", timingAnchor: "end", startOffset: -1700, delay: 0, duration: 2600 }] };
  for (const recipe of [plain, finisher]) {
    const assets = [...new Set(recipe.stages.flatMap((s) => s.assets))];
    const durations = [], waits = [];
    let plan = null;
    const host = {
      database: { entryExists: () => true, getPathsUnder: () => assets, getAllFileEntries: (k) => [`${k}.webm`] },
      enabled: () => true, recipes: () => [], ready: () => true, canPlay: () => true, userId: () => "u", gridSize: () => GRID,
      sequence: () => {
        const chain = (calls) => new Proxy({}, { get: (_, key) => (...args) => { calls.push([key, ...args]); return chain(calls); } });
        const effects = [];
        return { effect: () => { const c = []; effects.push(c); return chain(c); }, sound: () => chain([]),
          play: async () => { for (const c of effects) durations.push(c.find((x) => x[0] === "duration")?.[1]); } };
      },
      endEffects: async () => {}, motion: async () => {},
    };
    const runtime = new AnimaterRuntime(host);
    runtime.refreshCatalog();
    runtime.wait = async (ms) => { waits.push(ms); return true; };
    const hero = token("Hero", 0, 100), orc = token("Orc", 100, 100);
    const play = (r, context) => runtime.play(r, context, { preview: true, onStart: (p) => { plan = p.playbackPlan; } });
    const done = await (previewFinisher(recipe, { source: hero, targets: [orc] }, testHost(Infinity), play) ?? play(recipe, { source: hero, targets: [orc] }));
    assert.ok(done, recipe.name);
    const end = Math.max(...plan.map((s) => s.delay + s.duration));
    assert.ok(end >= (recipe === plain ? 3500 : 2300), `${recipe.name}: plan runs to ${end}`);
    assert.ok(waits.includes(end), `${recipe.name}: waits ${end} (${waits})`);
    const effects = plan.filter((s) => s.kind === "impact").map((s) => s.duration * (s.playbackRate ?? 1));
    assert.deepEqual([...durations].sort((a, b) => a - b), [...effects].sort((a, b) => a - b), `${recipe.name}: full effect durations`);
  }
});

// Shield Boss: a held travel path, then blood and fragments linked to its end. The pieces burst
// where the travel lands; the mover's effects that start once it has landed play there too, in a
// test play (nothing written) and a real play (the move is written at travelEnd, racing them).
const shieldBoss = ({ linked = true } = {}) => {
  const base = presetFinisher("wall-slam", "sb");
  const at = linked ? { afterStage: "fly", timingAnchor: "end", delay: 0 } : { delay: 1100 };
  return { ...base, stages: [...base.stages.filter((s) => s.stageId !== "landing"),
    { stageId: "blood", kind: "impact", assets: ["jb2a.liquid.splash.red"], duration: 1300, ...at },
    { stageId: "cut", kind: "motion", motion: "fragments", subject: "targets", assets: [], pattern: "crush", behavior: "flatten", motionEnd: "hold", duration: 1600, ...at }] };
};
const noWall = (blockAfter) => ({ ...testHost(blockAfter), wallHit: () => null });

test("a linked fragments stage starts exactly when the composed travel lands, fit or slam", () => {
  for (const [label, host, end] of [["full", noWall(Infinity), 1100], ["fit at 4", noWall(4), 1100], ["slam at 3", { ...testHost(3), wallHit: () => 3 }, null]]) {
    const mover = token("Hob", 2200, 1400), attacker = token("Flint", 2400, 825);
    const { composed, context } = planFinisher({ recipe: shieldBoss(), mover, attacker, dead: true }, host);
    const plan = previewPlan(composed, { ...context, gridSize: GRID });
    const cut = plan.find((s) => s.stageId === "cut"), fly = plan.find((s) => s.stageId === "fly");
    assert.equal(cut.delay, travelEnd(plan), `${label}: the pieces start as the travel lands`);
    assert.equal(cut.delay, fly.delay + fly.duration, label);
    if (end) assert.equal(cut.delay, end, label);
    assert.equal(cut.duration, 1600, label);
  }
});

test("the mover's effects that start once the travel lands play on the landing square, linked or not", () => {
  for (const linked of [true, false]) {
    const mover = token("Hob", 2200, 1400), attacker = token("Flint", 2400, 825);
    const { composed, to, from } = planFinisher({ recipe: shieldBoss({ linked }), mover, attacker, dead: true }, noWall(Infinity));
    const blood = by(composed, "blood"), hit = by(composed, "hit");
    assert.deepEqual(blood.atPoint, { x: 2250, y: 1450 }, `${linked}: pinned to where the mover stood`);
    assert.deepEqual([blood.offsetX, blood.offsetY], [(to.x - from.x) / GRID, (to.y - from.y) / GRID], `${linked}: offset to the landing`);
    assert.equal(hit.atPoint, undefined, `${linked}: the opening hit stays on the token`);
    assert.equal(by(composed, "cut").atPoint, undefined, "a motion is never pinned");
  }
  // A Wall slam: the crash at the wall, the blood where the token stops.
  const mover = token("Hob", 100, 100);
  const { composed } = planFinisher({ recipe: shieldBoss(), mover, attacker: token("Hero", 0, 100), dead: true }, testHost(3));
  assert.equal(by(composed, "blood").offsetX, 3);
  assert.ok(Math.abs(by(composed, "wall-crack").offsetX - 3.6) < 1e-9, "the crash stays at the wall");
  // A survivor that does not move keeps its effects on the token.
  const still = planFinisher({ recipe: shieldBoss(), mover: token("Hob", 100, 100), attacker: token("Hero", 0, 100), dead: true }, testHost(0)).composed;
  assert.equal(by(still, "blood").atPoint, undefined, "no landing, nothing pinned");
});
