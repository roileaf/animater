import test from "node:test";
import assert from "node:assert/strict";
import { AnimaterRuntime } from "../../scripts/engines/playback/runtime.mjs";
import { validateRecipe } from "../../scripts/core/model.mjs";
import { starterRecipes } from "../../scripts/core/presets.mjs";
import { RecipePreview } from "../../scripts/engines/preview/recipe-preview.mjs";
import { recipeFrame } from "../../scripts/engines/playback/choreography.mjs";
import { artworkGeometry, artworkSize, tokenFootprint,effectFootprint,auraPreviewGrid } from "../../scripts/engines/media/media-preview.mjs";
import { PF2E_EFFECTS,stateRecipe } from '../../scripts/catalogs/pf2e/state-catalog.mjs';
import { previewPose, cropAreaArt } from "../../scripts/core/stage-options.mjs";
import { motionPose, combineMotionPoses } from "../../scripts/engines/motion/motion.mjs";

function runtimeFixture(file = "test_1000x400.webm", key = "jb2a.test") {
  const calls = [];
  const effect = new Proxy(
    {},
    {
      get:
        (_, method) =>
        (...args) => {
          calls.push([method, ...args]);
          return effect;
        },
    },
  );
  const runtime = new AnimaterRuntime({
    ready: () => true,
    userId: () => "scaling",
    gridSize: () => 100,
    database: {
      entryExists: () => true,
      getPathsUnder: () => [key],
      getAllFileEntries: () => [file],
    },
    sequence: () => ({ effect: () => effect, play: async () => {} }),
  });
  return { runtime, calls };
}
function recipe(kind, scale = 1) {
  return validateRecipe({
    ...starterRecipes()[0],
    stages: [{ kind, assets: ["jb2a.test"], duration: 100, scale }],
  });
}

test('aura sizing uses native mechanical bounds, prepared radii and scene distance without texture scale',()=>{
 const s={kind:'aura',auraRadius:30,auraSlug:'test'};
 assert.equal(effectFootprint(s,{w:200,h:300,mechanicalBounds:{width:100},document:{texture:{scaleX:3}}},100,5),1300);
 assert.equal(effectFootprint(s,{width:2,height:1},100,10),800);
 assert.equal(effectFootprint(s,{width:.5,height:.5,mechanicalWidth:1},100,5),1300);
 assert.equal(effectFootprint(s,{w:50,mechanicalBounds:{width:100},actor:{auras:new Map([['test',{radius:10}]])}},100,5),500);
 assert.equal(effectFootprint({kind:'aura'},{w:100,h:200},100,5),200);
});
test('validated import/export retains aura radius and local canvas preview renders full extent',async()=>{
 const r=recipe('aura');Object.assign(r.stages[0],{auraRadius:30,auraSlug:'demons-knot'});
 const roundTrip=validateRecipe(JSON.parse(JSON.stringify(r)));
 assert.equal(roundTrip.stages[0].auraRadius,30);
 const {runtime,calls}=runtimeFixture('Ring_400x400.webm');
 await runtime.play(roundTrip,{source:{w:100,h:100}},{preview:true});
 assert.equal(calls.find(c=>c[0]==='size')[1].width,1300);
});
test('thirty-foot catalog aura fits narrow and wide previews while preserving token-to-field ratio',()=>{
 const r=stateRecipe(PF2E_EFFECTS.find(e=>e.name==="Aura: Demon's Knot"));
 for(const width of [240,400,720]){
  const art={videoWidth:400,videoHeight:400,style:{}},layer={dataset:{layerStage:'0'},style:{setProperty(){}},querySelector:()=>art};
  const actor={style:{}},token={dataset:{previewToken:'source'},style:{},closest:()=>actor};
  const scene={clientWidth:width,clientHeight:300,style:{setProperty(){}},dataset:{previewTokens:JSON.stringify({source:{width:1,height:1}})},querySelectorAll:s=>s==='[data-layer-stage]'?[layer]:s==='[data-preview-token]'?[token]:[]};
  const player=new RecipePreview(scene,r,()=>{});player.draw(recipeFrame(player.recipe,1000));
  assert.ok(parseFloat(layer.style.width)<=Math.min(width-48,220));
  assert.ok(Math.abs(parseFloat(layer.style.width)/parseFloat(token.style.width)-13)<1e-8);
  assert.equal(player.grid,auraPreviewGrid(r,{width:1,height:1},width,300,5));
 }
});
test("padded melee artwork fills the requested visible footprint in editor and canvas", () => {
  const media = {
    file: "modules/jb2a_patreon/Library/Generic/Weapon_Attacks/Melee/GenericSlash01_01_Regular_BluePurple_800x600.webm",
    width: 800, height: 600,
  };
  // Measured alpha bounds occupy 40/128 of the frame's longest dimension.
  const factor = 128 / 40;
  const editor = artworkGeometry(55, 800, 600, media);
  assert.ok(Math.abs(editor.width - 55 * factor) < 0.05);
  assert.ok(Math.abs(editor.height - 55 * factor * .75) < 0.05);
  const canvas = artworkSize(200, media);
  assert.ok(Math.abs(canvas.width - 200 * factor) < 0.05);
  assert.equal(canvas.height, "auto");
});

test("runtime and editor apply measured padding to local stages while keeping beam stretch", async () => {
  const file = "modules/jb2a_patreon/Library/Generic/Weapon_Attacks/Melee/GenericSlash01_01_Regular_BluePurple_800x600.webm";
  for (const kind of ["cast", "impact", "aura", "projectile"]) {
    const { runtime, calls } = runtimeFixture(file);
    await runtime.play(recipe(kind, 1.2), { source: { w: 200, h: 100 }, targets: [{ w: 200, h: 100 }] }, { preview: true });
    assert.ok(Math.abs(calls.find(c => c[0] === "size")[1].width - 240 * 128 / 40) < .05);
  }
  const { runtime, calls } = runtimeFixture(file);
  await runtime.play(recipe("travel"), { source: { w: 100, h: 100 }, targets: [{ w: 100, h: 100 }] }, { preview: true });
  assert.ok(calls.some(c => c[0] === "stretchTo"));
  assert.ok(!calls.some(c => c[0] === "size"));
  const r = recipe("impact"), art = { currentSrc: `https://localhost/${file}`, videoWidth: 800, videoHeight: 600, style: {} };
  const layer = { dataset: { layerStage: "0" }, style: { setProperty() {} }, querySelector: () => art };
  const player = new RecipePreview({ dataset: {}, querySelectorAll: s => s === "[data-layer-stage]" ? [layer] : [] }, r, () => {});
  player.draw(recipeFrame(player.recipe, 50));
  assert.ok(Math.abs(parseFloat(layer.style.width) - 55 * 128 / 40) < .05);
  assert.ok(Math.abs(parseFloat(layer.style.height) - 55 * 128 / 40 * .75) < .05);
});
test("beam scale changes thickness while distance and padding remain connected", async () => {
  for (const scale of [0.4, 1, 2]) {
    const { runtime, calls } = runtimeFixture();
    await runtime.play(
      recipe("travel", scale),
      { source: { w: 100, h: 100 }, targets: [{ w: 100, h: 100 }] },
      { preview: true },
    );
    const actual = calls.find((c) => c[0] === "scale")[1];
    // Installed Sequencer divides distance by scale.x before scaling both axes.
    // A scalar therefore cancels itself and cannot adjust thickness.
    const axes = typeof actual === "number" ? { x: actual, y: actual } : actual;
    const ratio = 300 / axes.x / (1000 - 200 - 200);
    assert.equal((1000 - 400) * ratio * axes.x, 300);
    assert.equal(400 * ratio * axes.y, 200 * scale);
  }
});
test("local artwork preserves native aspect on large rectangular and mirrored tokens", async () => {
  for (const [w, h] of [
    [100, 100],
    [200, 100],
    [100, 300],
  ]) {
    const { runtime, calls } = runtimeFixture();
    await runtime.play(
      recipe("cast", 1.4),
      { source: { w, h, document: { texture: { scaleX: -2, scaleY: 0.5 } } } },
      { preview: true },
    );
    assert.deepEqual(calls.find((c) => c[0] === "size")?.[1], {
      width: Math.max(w, h) * 1.4,
      height: "auto",
    });
    assert.ok(!calls.some((c) => c[0] === "scaleToObject"));
  }
});
test("copySprite keeps Sequencer mesh sizing instead of replacing it with grid footprint", async () => {
  const { runtime, calls } = runtimeFixture();
  await runtime.play(
    recipe("sprite", 0.8),
    { source: { w: 200, h: 100, mesh: { width: 400, height: 100 } } },
    { preview: true },
  );
  assert.ok(calls.some((c) => c[0] === "copySprite"));
  assert.equal(calls.find((c) => c[0] === "scale")?.[1], 0.8);
  assert.ok(!calls.some((c) => ["size", "scaleToObject"].includes(c[0])));
});
test("circular area sizes preserve non-square media aspect instead of forcing square texture", async () => {
  const { runtime, calls } = runtimeFixture();
  await runtime.play(
    recipe("template", 0.9),
    { template: {}, area: { center: { x: 0, y: 0 }, diameter: 600 } },
    { preview: true },
  );
  assert.deepEqual(calls.find((c) => c[0] === "size")?.[1], {
    width: 540,
    height: "auto",
  });
});
test("cone media uses native vertex/reach, aperture and a portable area mask", async () => {
  const { runtime, calls } = runtimeFixture("Cone_600x600.webm");
  const shape = { points: [0, 0, 600, -600, 600, 600] };
  runtime.host.areaMask = () => shape;
  const area = { type: "cone", center: { x: 0, y: 0 }, endpoint: { x: 600, y: 0 }, length: 600, angle: 90 };
  await runtime.play(recipe("template"), { template: {}, area }, { preview: true });
  assert.deepEqual(calls.find(c => c[0] === "stretchTo")[1], area.endpoint);
  assert.equal(calls.find(c => c[0] === "scale")[1].x, 1);
  assert.ok(Math.abs(calls.find(c => c[0] === "scale")[1].y - 2) < 1e-8);
  assert.deepEqual(calls.find(c => c[0] === "mask")[1], shape);
  assert.ok(!calls.some(c => c[0] === "size"));
});
test("Crop to area shape: a circle crops only when ticked, a cone unless unticked", async () => {
  const circle = { template: {}, area: { type: "circle", center: { x: 0, y: 0 }, diameter: 600 } };
  const plain = runtimeFixture();
  plain.runtime.host.areaMask = () => ({ points: [1, 2, 3, 4] });
  await plain.runtime.play(recipe("template"), circle, { preview: true });
  assert.ok(!plain.calls.some(c => c[0] === "mask"), "a circle's art may spill by default");
  const ticked = runtimeFixture();
  ticked.runtime.host.areaMask = () => ({ points: [1, 2, 3, 4] });
  const r = recipe("template");
  r.stages[0].maskArea = true;
  await ticked.runtime.play(validateRecipe(r), circle, { preview: true });
  assert.deepEqual(ticked.calls.find(c => c[0] === "mask")?.[1], { points: [1, 2, 3, 4] });
  assert.equal(cropAreaArt({}, "cone"), true);
  assert.equal(cropAreaArt({}, "line"), false);
  assert.equal(cropAreaArt({ maskArea: false }, "cone"), false);
  assert.equal(cropAreaArt({ maskArea: true }, "line"), true);
});
test("a cone stage uncropped and reaching past the area runs its art beyond the far edge, widening with it", async () => {
  const { runtime, calls } = runtimeFixture("Cone_600x600.webm");
  runtime.host.areaMask = () => ({ points: [] });
  const area = { type: "cone", center: { x: 0, y: 0 }, endpoint: { x: 600, y: 0 }, length: 600, angle: 90 };
  const r = recipe("template");
  Object.assign(r.stages[0], { maskArea: false, areaReach: 50 });
  await runtime.play(validateRecipe(r), { template: {}, area }, { preview: true });
  assert.deepEqual(calls.find(c => c[0] === "stretchTo")[1], { x: 900, y: 0 });
  assert.ok(Math.abs(calls.find(c => c[0] === "scale")[1].y - 3) < 1e-8);
  assert.ok(!calls.some(c => c[0] === "mask"));
  assert.equal(validateRecipe(recipe("template")).stages[0].areaReach, undefined, "untouched recipes keep their shape");
  const cropped = runtimeFixture("Cone_600x600.webm");
  cropped.runtime.host.areaMask = () => ({ points: [0, 0, 600, -600, 600, 600] });
  const kept = recipe("template");
  Object.assign(kept.stages[0], { areaReach: 50 });
  await cropped.runtime.play(validateRecipe(kept), { template: {}, area }, { preview: true });
  assert.deepEqual(cropped.calls.find(c => c[0] === "mask")[1].points, [0, 0, 900, -900, 900, 900], "cropped to the cone grown by the reach");
});
test("editor composes active token gestures and retains unfinished earlier movement", () => {
  const recipe = validateRecipe({ id: "overlap", name: "Overlap", trigger: "manual", stages: [
    { kind: "motion", subject: "source", motion: "pulse", delay: 0, duration: 2000, intensity: .25 },
    { kind: "motion", subject: "source", motion: "spin", delay: 200, duration: 1000, intensity: .1 },
  ] });
  const player = new RecipePreview({ dataset: {}, querySelectorAll: () => [] }, recipe, () => {});
  const frame = recipeFrame(player.recipe, 700);
  assert.deepEqual(player.subjectPose("source", frame), combineMotionPoses(recipe.stages.map((stage, i) => motionPose(stage, frame.stages[i].progress, { x: 1, y: 0 }, 55))));
  const later = recipeFrame(player.recipe, 1500);
  assert.deepEqual(player.subjectPose("source", later), motionPose(recipe.stages[0], later.stages[0].progress, { x: 1, y: 0 }, 55));
});
test("cone editor framing fits full aperture in narrow and wide preview panels", () => {
  for (const width of [240, 400, 720]) {
    const r = { ...recipe("template"), previewArea: { type: "cone", value: 30 } };
    const art = { videoWidth: 600, videoHeight: 600, style: {} };
    const layer = { dataset: { layerStage: "0", previewTemplate: "[100,0,0]" }, style: { setProperty() {} }, querySelector: () => art };
    const scene = { clientWidth: width, clientHeight: 300, dataset: { chainPreview: "", previewTokens: "{}" }, querySelectorAll: selector => selector === "[data-layer-stage]" ? [layer] : [] };
    const player = new RecipePreview(scene, r, () => {});
    player.draw(recipeFrame(player.recipe, 50));
    const fullHeight = parseFloat(layer.style.height) * 2;
    assert.ok(fullHeight <= scene.clientHeight * .81, `${width}px preview crops cone`);
    assert.equal(layer.style.top, "50%");
  }
});
test("editor local artwork uses token footprint and intrinsic media aspect, not a fixed 115px square", () => {
  const r = { stages: [{ kind: "cast", delay: 0, duration: 1000, scale: 1 }] };
  const layer = {
    dataset: { layerStage: "0", mediaWidth: "800", mediaHeight: "400" },
    style: { setProperty() {} },
    art: { style: {} },
    querySelector() {
      return this.art;
    },
  };
  const scene = {
    dataset: {
      previewTokens: JSON.stringify({ source: { width: 2, height: 1 } }),
    },
    querySelectorAll: (s) => (s === "[data-layer-stage]" ? [layer] : []),
  };
  const player = new RecipePreview(scene, r, () => {});
  player.draw(recipeFrame(player.recipe, 100));
  assert.equal(layer.style.width, "110px");
  assert.equal(layer.style.height, "55px");
  assert.equal(layer.art.style.objectFit, "fill");
});

test("moving projectiles retain origin footprint and native aspect, including return flights", async () => {
  const source = { id: "caster", w: 100, h: 100 },
    target = { id: "large-target", w: 300, h: 200 };
  for (const reverse of [false, true]) {
    const { runtime, calls } = runtimeFixture();
    const r = recipe("projectile", 0.5);
    r.stages[0].travelOrigin = reverse ? "target" : "source";
    await runtime.play(r, { source, targets: [target] }, { preview: true });
    assert.deepEqual(calls.find((c) => c[0] === "size")[1], {
      width: reverse ? 150 : 50,
      height: "auto",
    });
    assert.equal(
      calls.find((c) => c[0] === "atLocation")[1],
      reverse ? target : source,
    );
    assert.equal(
      calls.find((c) => c[0] === "moveTowards")[1],
      reverse ? source : target,
    );
  }
});
test("editor copies respect captured mesh dimensions and inherited texture mirrors", () => {
  const r = {
    stages: [
      {
        kind: "sprite",
        subject: "source",
        delay: 0,
        duration: 1000,
        scale: 0.8,
        mirrorX: true,
      },
    ],
  };
  const layer = {
    dataset: { layerStage: "0", copy: "0" },
    style: { setProperty() {} },
    art: { style: {} },
    querySelector() {
      return this.art;
    },
  };
  const scene = {
    dataset: {
      previewTokens: JSON.stringify({
        source: {
          width: 2,
          height: 1,
          spriteWidth: 4,
          spriteHeight: 1,
          textureScaleX: -2,
          textureScaleY: 1,
        },
      }),
    },
    querySelectorAll: (s) => (s === "[data-layer-stage]" ? [layer] : []),
  };
  const player = new RecipePreview(scene, r, () => {});
  player.draw(recipeFrame(player.recipe, 100));
  assert.equal(layer.style.width, "220px");
  assert.equal(layer.style.height, "55px");
  assert.match(layer.art.style.transform, /scale\(-0\.8,0\.8\)/);
});
test("portrait art and footprint fallbacks remain uniform and finite", () => {
  assert.deepEqual(artworkGeometry(110, 400, 800), { width: 55, height: 110 });
  assert.equal(tokenFootprint({ document: { width: 2, height: 1 } }, 100), 200);
  assert.equal(tokenFootprint({ width: 2, height: 1 }, 55), 110);
  assert.equal(tokenFootprint({ w: NaN, h: -1 }, 55), 55);
  // Dynamic-ring tokens (measured in Foundry): the creature is drawn at texture scale ÷ subject scale.
  const ringed = (w, scale, subject = 2) => ({ w, h: w, document: { width: w / 100, texture: { scaleX: scale, scaleY: scale }, ring: { enabled: true, subject: { scale: subject } } } });
  assert.equal(tokenFootprint(ringed(100, 2), 100), 100, "Medium fills its square");
  assert.equal(tokenFootprint(ringed(100, 1.6), 100), 80, "Small is drawn at 0.8");
  assert.equal(tokenFootprint(ringed(50, 1.6), 100), 40, "Tiny half square at 0.8");
  assert.equal(tokenFootprint(ringed(100, -1.6), 100), 80, "mirrored");
  // Without a ring, texture oversizing does not grow effects.
  assert.equal(tokenFootprint({ w: 100, h: 100, document: { texture: { scaleX: 1.6 }, ring: { enabled: false, subject: { scale: 2 } } } }, 100), 100);
  assert.deepEqual(artworkGeometry(55, undefined, undefined), {
    width: 55,
    height: 55,
  });
});
test("width/height animation tracks use rendered artwork dimensions and preserve grid units", () => {
  const s = {
    duration: 1000,
    scale: 1,
    tracks: [
      { property: "width", from: 0, to: 1, duration: 1000 },
      { property: "height", from: 0, to: 1, duration: 1000 },
    ],
  };
  const pose = previewPose(s, 1000, 55, { width: 55, height: 110 });
  assert.equal(pose.scaleX * 55, 110);
  assert.equal(pose.scaleY * 110, 165);
});

test("a JB2A melee swing is stretched from the wielder to the target, never sized on the target", async () => {
  const { runtime, calls } = runtimeFixture("Sword01_01_Regular_White_800x600.webm", "jb2a.sword.melee.01.white");
  const source = { w: 100, h: 100, center: { x: 400, y: 100 } }, target = { w: 100, h: 100, center: { x: 300, y: 100 } };
  const r = validateRecipe({ ...starterRecipes()[0], stages: [{ kind: "impact", assets: ["jb2a.sword.melee.01.white"], duration: 100, scale: 1.2 }] });
  await runtime.play(r, { source, targets: [target] }, { preview: true });
  assert.equal(calls.find(c => c[0] === "atLocation")[1], source);
  assert.equal(calls.find(c => c[0] === "stretchTo")[1], target);
  assert.deepEqual(calls.find(c => c[0] === "scale")[1], { x: 1, y: 1.2 });
  assert.ok(!calls.some(c => ["size", "rotateTowards"].includes(c[0])));
  assert.ok(calls.some(c => c[0] === "mirrorY" && c[1] === true), "swinging leftward: kept blade-up");
});
