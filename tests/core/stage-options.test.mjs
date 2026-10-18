import test from "node:test";
import assert from "node:assert/strict";
import { validateRecipe, planRecipe, parseImport } from "../../scripts/core/model.mjs";
import { starterRecipes } from "../../scripts/core/presets.mjs";
import {
  normalizeOptions,
  applyEffectOptions,
  previewPose,
} from "../../scripts/core/stage-options.mjs";
import { recipeDuration, recipeFrame } from "../../scripts/engines/playback/choreography.mjs";

const recipe = (stage) =>
  validateRecipe({
    ...starterRecipes()[0],
    stages: [
      {
        kind: "cast",
        assets: ["jb2a.impact"],
        delay: 0,
        duration: 1000,
        ...stage,
      },
    ],
  });

test('color replacement removes source hue before applying tint in Sequencer',()=>{
 const calls=[],effect=new Proxy({},{get:(_,key)=>(...args)=>{calls.push([key,...args]);return effect;}});
 const r=recipe({tintEnabled:true,colorize:true,tint:'#b8e580'});
 assert.equal(parseImport(JSON.stringify({schema:1,recipes:[r]}))[0].stages[0].colorize,true);
 applyEffectOptions(effect,r.stages[0]);
 assert.ok(!calls.some(([key])=>key==='tint'),'Sprite tint would darken a blue splash before grayscale');
 const filter=calls.find(([key,name])=>key==='filter'&&name==='ColorMatrix')[2];
 assert.equal(filter.saturate,-1);assert.equal(filter.tint,0xb8e580);
 assert.ok(Object.keys(filter).indexOf('saturate')<Object.keys(filter).indexOf('tint'));
});
test("configuration round-trips through export and old recipes gain neutral defaults", () => {
  const r = recipe({
    offsetX: 0.4,
    mirrorY: true,
    attach: true,
    bindRotation: true,
    tintEnabled: true,
    tint: "#ff8800",
    glow: 2,
    repeats: 3,
    fadeIn: 200,
    tracks: [
      {
        property: "position.y",
        from: 0,
        to: -0.5,
        duration: 400,
        ease: "easeOutQuad",
        loop: true,
        pingPong: true,
      },
    ],
  });
  assert.deepEqual(parseImport(JSON.stringify({ schema: 1, recipes: [r] })), [
    r,
  ]);
  const neutral = normalizeOptions({ duration: 1000 });
  assert.equal(neutral.repeats, 1);
  assert.equal(neutral.copies, 1);
  assert.equal(neutral.fadeIn, 0);
  assert.equal(neutral.contrast, 0);
  assert.equal(neutral.bindAlpha, true);
  assert.deepEqual(neutral.tracks, []);
  assert.equal(previewPose(recipe({}).stages[0], 500).alpha, 1);
});
test("bounded configuration rejects arbitrary track paths and audio schemes", () => {
  const s = recipe({
    repeats: 100,
    copies: 100,
    offsetY: -100,
    fadeIn: 30000,
    playbackRate: 0,
  }).stages[0];
  assert.equal(s.repeats, 18);
  assert.equal(s.copies, 6);
  assert.equal(s.offsetY, -10);
  assert.equal(s.fadeIn, 1000);
  assert.equal(s.playbackRate, 0.25);
  assert.throws(
    () => recipe({ tracks: [{ property: "__proto__.polluted" }] }),
    /supported property/,
  );
  for (const soundFile of [
    "javascript:alert(1).ogg",
    "../secret.wav",
    "https://host/sound.mp3",
    "sounds/foo.txt",
    "",
  ])
    assert.throws(
      () => recipe({ kind: "sound", soundFile }),
      /relative Foundry audio/,
    );
  assert.equal(
    recipe({ kind: "sound", soundFile: "sounds/spell impact.ogg" }).stages[0]
      .soundFile,
    "sounds/spell impact.ogg",
  );
});
test("repeat/copy/stagger plan preserves settings and preview follows repeat boundaries", () => {
  const r = recipe({
    kind: "sprite",
    subject: "targets",
    repeats: 2,
    repeatGap: 200,
    copies: 3,
    copySpread: 0.5,
    targetStagger: 150,
  });
  const targets = [{ id: "a" }, { id: "b" }];
  const plan = planRecipe(r, [], { source: {}, targets });
  assert.equal(plan.length, 12);
  assert.deepEqual(
    plan.slice(0, 3).map((s) => s.offsetX),
    [-0.5, 0, 0.5],
  );
  assert.deepEqual(
    [...new Set(plan.map((s) => s.delay))],
    [0, 1200, 150, 1350],
  );
  assert.equal(recipeDuration(r), 2200);
  assert.equal(recipeFrame(r, 999).stages[0].state, "playing");
  assert.equal(recipeFrame(r, 1000).stages[0].state, "waiting");
  assert.equal(recipeFrame(r, 1200).stages[0].iteration, 1);
  assert.equal(recipeFrame(r, 1200).stages[0].progress, 0);
  assert.equal(recipeDuration({ ...r, targetCount: 2 }), 2350);
});
test("Sequencer compiler uses verified effect APIs; loops and transitions remain bounded by stage", () => {
  const calls = [];
  const effect = new Proxy(
    {},
    {
      get:
        (_, key) =>
        (...args) => {
          calls.push([key, ...args]);
          return effect;
        },
    },
  );
  const s = recipe({
    fadeIn: 150,
    fadeOut: 200,
    scaleIn: 0.2,
    scaleInDuration: 150,
    rotateOut: 90,
    rotateOutDuration: 200,
    tintEnabled: true,
    brightness: 0.8,
    contrast: 0.2,
    blur: 2,
    glow: 3,
    playbackRate: 2,
    tracks: [
      {
        property: "position.x",
        from: 0,
        to: 1,
        duration: 200,
        loop: true,
        pingPong: true,
      },
      { property: "alpha", from: 1, to: 0, duration: 200, fromEnd: true },
    ],
  }).stages[0];
  applyEffectOptions(effect, s);
  assert.ok(
    calls.some((c) => c[0] === "scaleIn" && c[1] === 0.2 && c[2] === 150),
  );
  assert.deepEqual(calls.find((c) => c[0] === "loopProperty").slice(1, 3), [
    "spriteContainer",
    "position.x",
  ]);
  assert.equal(calls.find((c) => c[0] === "loopProperty")[3].gridUnits, true);
  assert.equal(calls.find((c) => c[0] === "animateProperty")[3].fromEnd, true);
  const neutralCalls = [];
  const neutral = new Proxy(
    {},
    {
      get: (_, key) => () => {
        neutralCalls.push(key);
        return neutral;
      },
    },
  );
  applyEffectOptions(neutral, recipe({}).stages[0]);
  assert.ok(!neutralCalls.includes("filter"));
  assert.ok(!neutralCalls.includes("anchor"));
  assert.ok(!neutralCalls.includes("mirrorX"));
});
test("composition transitions, mirrors and property tracks share saved units and easing", () => {
  const s = recipe({
    offsetX: 0.5,
    mirrorX: true,
    fadeIn: 200,
    fadeOut: 200,
    scaleIn: 0,
    scaleInDuration: 200,
    rotateOut: 90,
    rotateOutDuration: 200,
    tracks: [
      { property: "position.y", from: 0, to: -1, duration: 500 },
      { property: "scale.y", from: 1, to: 2, duration: 500 },
    ],
  }).stages[0];
  assert.equal(previewPose(s, 0).alpha, 0);
  const halfway = previewPose(s, 250, 100);
  assert.equal(halfway.x, 50);
  assert.equal(halfway.y, -50);
  assert.equal(halfway.scaleX, -1);
  assert.equal(halfway.scaleY, 1.5);
  assert.equal(previewPose(s, 1000).rotation, 90);
  assert.equal(previewPose(s, 1000).alpha, 0);
});

test("staggered targets retain stage highlight until last target and gap completes", () => {
  const r = {
    ...recipe({ kind: "impact", duration: 100, targetStagger: 300 }),
    targetCount: 2,
  };
  assert.equal(recipeFrame(r, 50).stages[0].state, "playing");
  assert.equal(recipeFrame(r, 150).stages[0].state, "waiting");
  assert.equal(recipeFrame(r, 350).stages[0].state, "playing");
  assert.equal(recipeFrame(r, 350).stages[0].targetIndex, 1);
  assert.equal(recipeFrame(r, 399).complete, false);
  assert.equal(recipeFrame(r, 400).complete, true);
});
test("media clips validate before playback and end-relative tracks use Sequencer delay direction", () => {
  assert.throws(() => recipe({ clipStart: 500, clipEnd: 200 }), /Clip end/);
  const calls = [];
  const effect = new Proxy(
    {},
    {
      get:
        (_, key) =>
        (...args) => {
          calls.push([key, ...args]);
          return effect;
        },
    },
  );
  const s = recipe({
    clipStart: 200,
    clipEnd: 800,
    tracks: [
      {
        property: "alpha",
        from: 1,
        to: 0,
        duration: 200,
        delay: -100,
        fromEnd: true,
      },
    ],
  }).stages[0];
  applyEffectOptions(effect, s);
  assert.deepEqual(
    calls.find((c) => c[0] === "timeRange"),
    ["timeRange", 200, 800],
  );
  assert.equal(calls.find((c) => c[0] === "animateProperty")[3].absolute, true);
  assert.equal(previewPose(s, 600).alpha, 1);
  assert.equal(previewPose(s, 800).alpha, 0.5);
  assert.equal(previewPose(s, 900).alpha, 0);
});
