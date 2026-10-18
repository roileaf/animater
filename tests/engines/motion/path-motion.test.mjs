import test from "node:test";
import assert from "node:assert/strict";
import { validateRecipe, previewPlan, parseImport } from "../../../scripts/core/model.mjs";
import {
  motionPose,
  motionDirection,
  TokenMotionPlayer,
} from "../../../scripts/engines/motion/motion.mjs";
import { timedStages } from "../../../scripts/engines/playback/composition.mjs";
import { PF2E_FEATS, featRecipe } from "../../../scripts/catalogs/pf2e/feats/feat-catalog.mjs";
import { FEAT_MOTION_PROFILES } from "../../../scripts/catalogs/pf2e/feats/feat-motion.mjs";
import { RecipePreview } from "../../../scripts/engines/preview/recipe-preview.mjs";
import { recipeFrame } from "../../../scripts/engines/playback/choreography.mjs";
import { Workspace } from "../../../scripts/ui/workspace.mjs";
import { chainPreview } from "../../../scripts/engines/preview/chain-preview.mjs";

test('long fixed leaps and retreats stay visible in narrow and wide composition previews',()=>{
  for(const width of [280,650]) for(const extra of [
    {motion:'leap',distance:6,motionRange:'distance',jumpHeight:1},
    {motion:'rush',distance:3,motionRange:'distance',motionHeading:'away'},
  ]){
    const chain=chainPreview(path(extra),{previewWidth:width,previewHeight:300});
    const preview=Object.create(RecipePreview.prototype);
    Object.assign(preview,{chain,recipe:chain.recipe,grid:chain.grid??55,scene:{clientWidth:width,clientHeight:300}});
    const source=chain.actors[0],half=preview.grid/2;
    for(let sample=0;sample<=100;sample++){
      const frame=recipeFrame(chain.recipe,sample/100*2000),pose=preview.subjectPose('source',frame);
      const x=source.x*width/100+pose.x,y=source.y*300/100+pose.y;
      assert.ok(x-half>=10&&x+half<=width-10,`${width}px ${extra.motion}: horizontal crop at ${sample}%`);
      assert.ok(y-half>=10&&y+half<=290,`${width}px ${extra.motion}: vertical crop at ${sample}%`);
    }
    assert.deepEqual(preview.subjectPose('source',recipeFrame(chain.recipe,2000)),{x:0,y:0,rotation:0,scale:1});
  }
});

const token = (id, x, y = 100, w = 100, h = 100) => ({
  id,
  center: { x, y },
  w,
  h,
  document: { x: x - w / 2, y: y - h / 2 },
});
const source = token("s", 100),
  near = token("n", 400),
  far = token("f", 1000);
const path = (extra) =>
  validateRecipe({
    id: "path",
    name: "Path",
    trigger: "manual",
    stages: [
      {
        kind: "motion",
        motion: "rush",
        stageId: "approach",
        duration: 2000,
        distance: 12,
        motionArrival: 45,
        motionHold: 30,
        ...extra,
      },
    ],
  });

test("rush travels multiple squares, stops beside target, holds, and returns exactly", () => {
  const stage = path().stages[0],
    direction = motionDirection(source, source, near, "rush", 100);
  const arrival = motionPose(stage, 0.45, direction, 100);
  assert.equal(arrival.x, 190);
  assert.deepEqual(motionPose(stage, 0.65, direction, 100), arrival);
  assert.ok(motionPose(stage, 0.9, direction, 100).x < arrival.x);
  assert.deepEqual(motionPose(stage, 1, direction), {
    x: 0,
    y: 0,
    rotation: 0,
    scale: 1,
  });
  assert.equal(
    motionPose(
      stage,
      0.45,
      motionDirection(source, source, token("adjacent", 195), "rush"),
      100,
    ).x,
    0,
  );
  assert.equal(
    motionPose({ ...stage, distance: 1 }, 0.45, direction, 100).x,
    100,
  );
});

test("unequal rectangular footprints remain separated on diagonal approaches", () => {
  const a = token("a", 0, 0, 300, 100),
    b = token("b", 400, 400, 100, 300);
  const pose = motionPose(
    path().stages[0],
    0.45,
    motionDirection(a, a, b, "rush"),
    100,
  );
  assert.ok(
    Math.abs(b.center.x - pose.x) >= 200 ||
      Math.abs(b.center.y - pose.y) >= 200,
  );
});

test("leap has an airborne contact then lands; roll passes through; dodge goes laterally", () => {
  const direction = motionDirection(source, source, near, "leap");
  const leap = path({ motion: "leap", jumpHeight: 1, arrivalLift: 0.4 })
    .stages[0];
  assert.ok(motionPose(leap, 0.225, direction).y < -90);
  assert.equal(motionPose(leap, 0.45, direction).y, -40);
  assert.equal(motionPose(leap, 0.7, direction).y, 0);
  const roll = path({ motion: "roll", motionEndpoint: "past" }).stages[0];
  assert.equal(motionPose(roll, 0.45, direction).x, 410);
  assert.equal(motionPose(roll, 0.45, direction).rotation, Math.PI * 2);
  const dodge = path({ motion: "dodge", distance: 0.55 }).stages[0];
  assert.ok(Math.abs(motionPose(dodge, 0.45, direction).x) < 0.00001);
  assert.ok(Math.abs(motionPose(dodge, 0.45, direction).y - 55) < 0.00001);
  for (const stage of [leap, roll, dodge])
    assert.deepEqual(motionPose(stage, 1), {
      x: 0,
      y: 0,
      rotation: 0,
      scale: 1,
    });
});

test("arrival links follow actual target distance and explicit second-target routing", () => {
  const recipe = path({ perSquare: 200, targetSelection: "second" });
  recipe.stages.push({
    kind: "impact",
    stageId: "strike",
    assets: ["jb2a.impact.001.blue"],
    duration: 1000,
    afterStage: "approach",
    timingAnchor: "arrival",
    startOffset: 50,
    targetSelection: "second",
  });
  recipe.stages.push({
    kind: "cast",
    stageId: "settle",
    assets: ["jb2a.impact.001.blue"],
    duration: 1000,
    afterStage: "approach",
    timingAnchor: "arrival",
    startOffset: 50,
  });
  const plan = previewPlan(validateRecipe(recipe), {
    source,
    targets: [near, far],
    gridSize: 100,
  });
  assert.equal(plan[0].motionTarget, far);
  assert.equal(plan[0].duration, 3800);
  assert.equal(plan[1].destination, far);
  assert.equal(plan[1].delay, 1760);
  assert.equal(plan[2].delay, plan[1].delay);
  assert.throws(
    () =>
      timedStages({
        stages: [{ ...recipe.stages[0], motion: "pulse" }, recipe.stages[1]],
      }),
    /Arrival timing needs/,
  );
  // Existing long projectile flights keep their uncapped distance scaling.
  assert.equal(
    timedStages(
      {
        stages: [
          { kind: "projectile", duration: 1000, delay: 0, perSquare: 100 },
        ],
      },
      30,
    )[0].duration,
    4000,
  );
});

test("path options round-trip, clamp phase budget, and fixed gestures work without targets", () => {
  const recipe = path({
    motion: "leap",
    motionEndpoint: "past",
    motionArrival: 70,
    motionHold: 80,
    jumpHeight: 1.4,
    arrivalLift: 0.3,
    stopGap: 0.25,
    motionSide: -1,
  });
  const imported = parseImport(
    JSON.stringify({ schema: 1, recipes: [recipe] }),
  )[0];
  assert.deepEqual(imported, recipe);
  assert.equal(imported.stages[0].motionHold, 20);
  assert.throws(
    () => previewPlan(recipe, { source, targets: [] }),
    /needs a target/,
  );
  const fixed = path({ motionRange: "distance", distance: 1.5 });
  assert.equal(previewPlan(fixed, { source, targets: [] }).length, 1);
  const direction = motionDirection(source, source, undefined, "rush");
  assert.equal(motionPose(fixed.stages[0], 0.45, direction).x, 150);
});

test("directed feats preserve described contacts, motion shape, and effects-only playback", () => {
  const seen = new Set();
  for (const [slug, profile] of Object.entries(FEAT_MOTION_PROFILES)) {
    const feat = PF2E_FEATS.find((f) => f.slug === slug),
      recipe = featRecipe(feat);
    // Reviewed bespoke compositions replace the generated profile on purpose.
    if (recipe.bespoke) continue;
    const approach = recipe.stages.find((s) => s.kind === "motion");
    assert.equal(approach.motion, profile.motion, slug);
    assert.equal(
      recipe.stages.filter((s) => s.kind === "impact").length,
      profile.hit || profile.care ? profile.secondaryHit ? 2 : 1 : 0,
      slug,
    );
    assert.ok(
      !recipe.stages.some((s) => ["travel", "projectile"].includes(s.kind)),
      slug,
    );
    const native = previewPlan(recipe, {
      source,
      targets: [near, far],
      gridSize: 100,
    });
    const move = native.find((s) => s.kind === "motion"),
      hit = native.find((s) => s.kind === "impact");
    if (hit) {
      assert.equal(hit.destination, near);
      const contact = Math.max(
        0,
        ...hit.assets.map((key) => feat.mediaTiming?.[key]?.contact ?? 0),
      );
      assert.equal(
        hit.delay + contact,
        move.delay + (move.duration * approach.motionArrival) / 100 + (profile.care ? 120 + contact : 0),
        slug,
      );
    }
    if (profile.reload) {
      const cue = native.find((s) => s.kind === "cast");
      assert.ok(cue.assets.every((key) => key.startsWith("jb2a.glint.")));
      assert.ok(cue.delay >= move.delay + move.duration);
    }
    const effects = featRecipe(feat, { motion: false });
    assert.ok(!effects.stages.some((s) => s.kind === "motion"));
    assert.doesNotThrow(() =>
      previewPlan(effects, { source, targets: [near] }),
    );
    seen.add(
      JSON.stringify(recipe.stages.map(({ stageId, label, ...s }) => s)),
    );
  }
  assert.equal(seen.size, Object.keys(FEAT_MOTION_PROFILES).filter(slug => !featRecipe(PF2E_FEATS.find(f => f.slug === slug)).bespoke).length);
});

test("editor motion uses actual scene size and matches canvas pose for held arrival", () => {
  const recipe = path(),
    scene = {
      dataset: { chainPreview: "", previewTokens: "{}" },
      clientWidth: 600,
      clientHeight: 320,
      querySelectorAll: () => [],
    };
  const player = new RecipePreview(scene, recipe, () => {});
  const move = player.recipe.playbackPlan.find((s) => s.kind === "motion");
  const pose = player.subjectPose(
    "source",
    recipeFrame(player.recipe, move.delay + move.duration * 0.6),
  );
  const source = { center: { x: 0.24 * 600, y: 0.45 * 320 }, w: 55, h: 55 };
  const target = { center: { x: 0.76 * 600, y: 0.45 * 320 }, w: 55, h: 55 };
  assert.deepEqual(
    pose,
    motionPose(
      move,
      0.6,
      motionDirection(source, source, target, "rush", 55),
      55,
    ),
  );
  assert.equal(pose.x, 251.5);
});

test("editor offers path controls and arrival anchor only for an appropriate reference", () => {
  const w = Object.create(Workspace.prototype),
    recipe = path();
  const html = w.motionControlsHTML(recipe.stages[0], 0);
  assert.match(html, /Maximum path \(squares\)/);
  assert.match(html, /Path &amp; pacing/);
  assert.match(html, /data-field="motionHold"/);
  const strike = {
    afterStage: "approach",
    stageId: "hit",
    kind: "impact",
    timingAnchor: "arrival",
  };
  assert.match(w.compositionHTML(recipe, strike, 1), /Destination reached/);
  recipe.stages[0].motion = "pulse";
  assert.doesNotMatch(
    w.compositionHTML(recipe, strike, 1),
    /Destination reached/,
  );
});

test("switching from a small gesture to rush gives a readable path; fixed range stays compact", () => {
  const w = Object.create(Workspace.prototype),
    recipe = path({ motion: "lunge", distance: 0.12, duration: 800 });
  w.busy = false;
  w.stopEditorPreview = () => {};
  w.edit = () => recipe;
  w.root = { querySelector: () => null };
  const change = (field, value, type = "select-one") =>
    w.updateField({ dataset: { index: "0", field }, value, type });
  change("motion", "rush");
  assert.equal(recipe.stages[0].distance, 8);
  assert.equal(recipe.stages[0].duration, 2200);
  change("motionRange", "distance");
  assert.equal(recipe.stages[0].distance, 1.4);
  change("motionRange", "target");
  assert.equal(recipe.stages[0].distance, 8);
  change("motionArrival", "70", "number");
  assert.equal(recipe.stages[0].motionHold, 20);
});

test("moving endpoint cancels a live rush, restores source mesh, and writes no documents", async () => {
  let callback,
    now = 0;
  const point = (x, y) => ({
    x,
    y,
    set(x, y) {
      this.x = x;
      this.y = y;
    },
  });
  const actor = {
    ...source,
    document: { ...source.document },
    visible: true,
    mesh: { position: point(100, 100), scale: point(1, 1), rotation: 0.3 },
  };
  const target = { ...near, document: { ...near.document }, visible: true };
  const documents = structuredClone([actor.document, target.document]);
  const player = new TokenMotionPlayer({
    frame: (f) => {
      callback = f;
      return 1;
    },
    cancel() {},
    now: () => now,
  });
  const promise = player.play(
    actor,
    path().stages[0],
    motionDirection(actor, actor, target, "rush"),
    "owner",
    { target },
  );
  now = 1100;
  callback(now);
  assert.equal(actor.mesh.position.x, 290);
  assert.deepEqual([actor.document, target.document], documents);
  target.document.x += 100;
  now = 1200;
  callback(now);
  await promise;
  assert.equal(player.active.size, 0);
  assert.equal(actor.mesh.position.x, 100);
  assert.equal(actor.mesh.rotation, 0.3);
});
