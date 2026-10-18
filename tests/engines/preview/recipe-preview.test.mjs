import test from "node:test";
import assert from "node:assert/strict";
import { RecipePreview } from "../../../scripts/engines/preview/recipe-preview.mjs";
import { recipeFrame } from "../../../scripts/engines/playback/choreography.mjs";
import { validateRecipe } from "../../../scripts/core/model.mjs";
import {chainPreview} from '../../../scripts/engines/preview/chain-preview.mjs';

test('tiled wall preview preserves rendered plan indices when inspector dimensions differ',()=>{
  const recipe=validateRecipe({id:'tiled-wall',name:'Water wall',trigger:'manual',previewArea:{type:'line',value:60,width:5},stages:[{kind:'template',assets:['jb2a.liquid.splash.blue'],areaLayout:'tiles',delay:0,duration:6000}]});
  const rendered=chainPreview(recipe,{previewWidth:400,previewHeight:300});
  const videos=rendered.recipe.playbackPlan.map((s,i)=>({tagName:'VIDEO',dataset:{previewStage:String(s.index),previewPlan:String(i)},currentTime:0,duration:6,closest:()=>null,play:()=>Promise.resolve(),pause(){}}));
  const scene={dataset:{chainPreview:'',previewWidth:'400',previewHeight:'300'},clientWidth:280,clientHeight:240,querySelectorAll:selector=>selector.startsWith('video')?videos:[]};
  const player=new RecipePreview(scene,recipe,()=>{});
  assert.equal(player.recipe.playbackPlan.length,rendered.recipe.playbackPlan.length);
  assert.doesNotThrow(()=>player.draw(recipeFrame(player.recipe,500)));
});

test("ray composition preserves connecting length at reduced scale and return projectiles move toward caster", () => {
  const recipe = {
    stages: [
      { kind: "travel", delay: 0, duration: 1000, scale: 0.6 },
      { kind: "projectile", delay: 0, duration: 1000, travelOrigin: "target" },
    ],
  };
  const layers = recipe.stages.map((s, i) => ({
    dataset: {
      layerStage: String(i),
      previewTemplate: "[200,200,200]",
      mediaWidth: "1000",
      mediaHeight: "400",
    },
    style: { setProperty() {} },
    art: { style: {} },
    querySelector() {
      return this.art;
    },
  }));
  const scene = {
    dataset: {},
    clientWidth: 400,
    clientHeight: 300,
    querySelectorAll: (selector) =>
      selector === "[data-layer-stage]" ? layers : [],
  };
  const player = new RecipePreview(scene, recipe, () => {});
  player.draw(recipeFrame(player.recipe, 250));
  assert.equal(layers[0].style.width, `${(208 * 1000) / 600}px`);
  assert.equal(layers[0].style.left, "24%");
  assert.match(layers[0].art.style.transform, /scale\(1,0.6\)/);
  assert.equal(layers[0].art.style.objectFit, "fill");
  const early = parseFloat(layers[1].style.left);
  player.draw(recipeFrame(player.recipe, 750));
  assert.ok(parseFloat(layers[1].style.left) < early);
});

function fixture(recipe) {
  const layers = recipe.stages.map(() => ({ hidden: true }));
  const videos = recipe.stages.flatMap((s, i) =>
    s.kind === "motion"
      ? []
      : [
          {
            dataset: { previewStage: String(i) },
            currentTime: 7,
            paused: true,
            closest: () => layers[i],
            play() {
              this.paused = false;
              return Promise.resolve();
            },
            pause() {
              this.paused = true;
            },
          },
        ],
  );
  const token = { dataset: { previewToken: "source" }, style: {} };
  const scene = {
    dataset: {},
    querySelectorAll: (selector) =>
      selector.startsWith("video")
        ? videos
        : selector.startsWith("audio")
          ? []
          : selector.startsWith("[data-preview-token]")
            ? [token]
            : layers,
  };
  const frames = [];
  return {
    player: new RecipePreview(scene, recipe, (f) => frames.push(f)),
    videos,
    layers,
    token,
    frames,
  };
}

test('color replacement preview grayscales before tint instead of erasing the finished hue',()=>{
 const recipe=validateRecipe({id:'color-test',name:'Acid color',trigger:'manual',stages:[{kind:'impact',assets:['jb2a.liquid.splash.blue'],delay:0,duration:1000,tintEnabled:true,colorize:true,tint:'#b8e580'}]});
 const art={style:{}},layer={dataset:{layerStage:'0',tintFilter:'acid-tint'},style:{setProperty(){}},querySelector:()=>art};
 const player=new RecipePreview({dataset:{},clientWidth:400,querySelectorAll:selector=>selector==='[data-layer-stage]'?[layer]:[]},recipe,()=>{});
 player.draw(recipeFrame(recipe,500));
 assert.match(art.style.filter,/^grayscale\(1\) url\(#acid-tint\)/);
 assert.match(art.style.filter,/saturate\(1\)/);
});

test("composition plays overlapping videos together, hides completed layers and stops media", () => {
  const recipe = {
    stages: [
      { kind: "cast", delay: 0, duration: 650 },
      { kind: "travel", delay: 180, duration: 900 },
    ],
  };
  const { player, videos, layers, frames } = fixture(recipe);
  player.draw(recipeFrame(recipe, 200));
  assert.deepEqual(
    videos.map((v) => v.paused),
    [false, false],
  );
  assert.deepEqual(
    layers.map((l) => l.hidden),
    [false, false],
  );
  assert.deepEqual(
    videos.map((v) => v.currentTime),
    [0.2, 0.02],
  );
  videos[1].currentTime = 0.5;
  player.draw(recipeFrame(recipe, 700));
  assert.equal(videos[1].currentTime, 0.5); // No seek on every frame.
  assert.deepEqual(
    videos.map((v) => v.paused),
    [true, false],
  );
  assert.deepEqual(
    layers.map((l) => l.hidden),
    [true, false],
  );
  assert.equal(frames.length, 2);
  player.stop();
  assert.deepEqual(
    videos.map((v) => v.paused),
    [true, true],
  );
  assert.ok(layers.every((l) => l.hidden));
});
test("late preview frames seek each flight to its planned position and correct large drift", () => {
  const recipe = {
    stages: [
      { kind: "travel", delay: 500, duration: 1900, oneShot: true },
      { kind: "impact", delay: 1500, duration: 900, oneShot: true },
    ],
  };
  const { player, videos } = fixture(recipe);
  player.draw(recipeFrame(recipe, 1200));
  assert.equal(videos[0].currentTime, 0.7);
  player.draw(recipeFrame(recipe, 1700));
  assert.equal(videos[0].currentTime, 1.2);
  assert.equal(videos[1].currentTime, 0.2);
  assert.equal(videos[0].loop, false);
  assert.equal(videos[1].loop, false);
  videos[0].currentTime = 1.21;
  player.draw(recipeFrame(recipe, 1720));
  assert.equal(videos[0].currentTime, 1.21);
});

test("composition keeps Force Barrage visible beyond its old cutoff and through the final fade", () => {
  const recipe = validateRecipe({
    id: "old-barrage",
    name: "Old barrage",
    trigger: "manual",
    stages: [
      {
        kind: "travel",
        assets: ["jb2a.magic_missile.purple"],
        duration: 1900,
        oneShot: true,
        fadeOut: 100,
      },
    ],
  });
  const { player, videos, layers } = fixture(recipe);
  videos[0].duration = 2.2;
  player.draw(recipeFrame(recipe, 2100));
  assert.equal(layers[0].hidden, false);
  assert.equal(videos[0].paused, false);
  assert.equal(videos[0].currentTime, 2.1);
  assert.equal(recipeFrame(recipe, 2100).complete, false);
  player.draw(recipeFrame(recipe, 2250));
  assert.equal(layers[0].hidden, false);
  assert.equal(recipeFrame(recipe, 2250).complete, false);
  player.draw(recipeFrame(recipe, 2300));
  assert.equal(layers[0].hidden, true);
  assert.equal(videos[0].paused, true);
  assert.equal(recipeFrame(recipe, 2300).complete, true);
});

test("pausing a pending play is not a missing asset, while unsupported media remains visible", async () => {
  const recipe = { stages: [{ kind: "impact", delay: 0, duration: 900 }] };
  for (const name of ["AbortError", "NotAllowedError", "NotSupportedError"]) {
    const { player, videos, layers } = fixture(recipe);
    const classes = new Set();
    layers[0].classList = { add: (value) => classes.add(value) };
    layers[0].setAttribute = () => {};
    videos[0].play = () =>
      Promise.reject(Object.assign(new Error(name), { name }));
    player.draw(recipeFrame(recipe, 100));
    videos[0].pause();
    await Promise.resolve();
    assert.equal(classes.has("is-unavailable"), name === "NotSupportedError");
    assert.equal(
      Boolean(player.scene.dataset.mediaError),
      name === "NotSupportedError",
    );
  }
});

test("a recovered video loses the stale unavailable badge before replay", async () => {
  const recipe = { stages: [{ kind: "impact", delay: 0, duration: 900 }] };
  const { player, videos, layers } = fixture(recipe);
  const classes = new Set(["is-unavailable"]);
  layers[0].classList = { add: v => classes.add(v), remove: v => classes.delete(v) };
  layers[0].removeAttribute = () => {};
  videos[0].readyState = 4;
  videos[0].error = null;
  await player.ready(videos[0]);
  assert.equal(classes.has("is-unavailable"), false);
});

test("same-recipe levitation and pulse compose while VFX plays, then restore together", () => {
  const recipe = {
    stages: [
      {
        kind: "motion",
        subject: "source",
        motion: "levitate",
        distance: 1,
        delay: 0,
        duration: 1000,
      },
      { kind: "cast", delay: 0, duration: 1000 },
      {
        kind: "motion",
        subject: "source",
        motion: "pulse",
        delay: 250,
        duration: 100,
      },
    ],
  };
  const { player, token, videos } = fixture(recipe);
  player.draw(recipeFrame(recipe, 200));
  assert.match(token.style.transform, /translate\(0px,-/);
  assert.equal(videos[0].paused, false);
  player.draw(recipeFrame(recipe, 300));
  assert.match(token.style.transform, /translate\(0px,-[\d.]+px\).*scale\(1\.18\)/);
  player.draw(recipeFrame(recipe, 600));
  assert.match(token.style.transform, /translate\(0px,-[\d.]+px\).*scale\(1\)/);
  player.draw(recipeFrame(recipe, 1000));
  assert.equal(
    token.style.transform,
    "translate(0px,0px) rotate(0rad) scale(1)",
  );
  player.stop();
  assert.equal(token.style.transform, "");
});

test("composed audio pauses in repeat gaps, restarts at clip opening and stops cleanly", () => {
  const recipe = {
    stages: [
      {
        kind: "sound",
        soundFile: "sounds/spell.wav",
        delay: 0,
        duration: 1000,
        repeats: 2,
        repeatGap: 300,
        clipStart: 100,
        volume: 0.4,
        fadeIn: 200,
      },
    ],
  };
  const audio = {
    tagName: "AUDIO",
    dataset: { previewStage: "0" },
    currentTime: 0,
    paused: true,
    starts: 0,
    closest: () => null,
    play() {
      this.paused = false;
      this.starts++;
      return Promise.resolve();
    },
    pause() {
      this.paused = true;
    },
  };
  const scene = {
    dataset: {},
    querySelectorAll: (selector) =>
      selector.startsWith("audio") ? [audio] : [],
  };
  const player = new RecipePreview(scene, recipe, () => {});
  player.draw(recipeFrame(recipe, 100));
  assert.equal(audio.paused, false);
  assert.equal(audio.currentTime, 0.2);
  assert.equal(audio.volume, 0.2);
  player.draw(recipeFrame(recipe, 1100));
  assert.equal(audio.paused, true);
  audio.currentTime = 0.4;
  player.draw(recipeFrame(recipe, 1400));
  assert.equal(audio.paused, false);
  assert.equal(audio.starts, 2);
  assert.equal(audio.currentTime, 0.2);
  player.stop();
  assert.equal(audio.paused, true);
});
test("completed pulse leaves ongoing levitation intact; repeat gap and completion restore neutral pose", () => {
  const recipe = {
    stages: [
      {
        kind: "motion",
        subject: "source",
        motion: "levitate",
        delay: 0,
        duration: 1000,
        repeats: 2,
        repeatGap: 100,
      },
      {
        kind: "motion",
        subject: "source",
        motion: "pulse",
        delay: 800,
        duration: 100,
      },
    ],
  };
  const { player, token } = fixture(recipe);
  player.draw(recipeFrame(recipe, 950));
  assert.match(token.style.transform, /translate\(0px,-[\d.]+px\).*scale\(1\)/);
  player.draw(recipeFrame(recipe, 1050));
  assert.match(token.style.transform, /translate\(0px,0px\)/);
  player.draw(recipeFrame(recipe, 1500));
  assert.match(token.style.transform, /translate\(0px,-/);
  player.draw(recipeFrame(recipe, 2100));
  assert.equal(token.style.transform, "translate(0px,0px) rotate(0rad) scale(1)");
  player.stop();
});
