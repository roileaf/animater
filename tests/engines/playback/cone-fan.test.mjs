import test from "node:test";
import assert from "node:assert/strict";
import { validateRecipe, previewPlan, parseImport } from "../../../scripts/core/model.mjs";
import { coneFanPoints } from "../../../scripts/engines/playback/cone-fan.mjs";
import { chainPreview } from "../../../scripts/engines/preview/chain-preview.mjs";
import { Workspace } from "../../../scripts/ui/workspace.mjs";
import { AnimaterRuntime } from "../../../scripts/engines/playback/runtime.mjs";
import { RecipePreview } from "../../../scripts/engines/preview/recipe-preview.mjs";
import { recipeFrame } from "../../../scripts/engines/playback/choreography.mjs";

const area = { type: "cone", center: { x: 300, y: 300 }, endpoint: { x: 300, y: 600 }, length: 300, angle: 60 };
const recipe = (extra = {}) => validateRecipe({ id: "stars", name: "Stars", trigger: "template", previewArea: { type: "cone", value: 15 }, stages: [{ kind: "projectile", travelDestination: "area", areaLayout: "fan", fanCount: 7, assets: ["jb2a.twinkling_stars"], duration: 2600, scale: .35, perSquare: 100, ...extra }] });
const context = { source: { id: "caster", center: { x: 0, y: 0 } }, targets: [], area, gridSize: 100 };

test("cone fan follows rotated native vertex and aperture without creature targeting", () => {
  const plan = previewPlan(recipe(), context);
  assert.equal(plan.length, 7);
  for (const stage of plan) {
    assert.ok(stage.areaFan);
    assert.equal(stage.origin.x, area.center.x);
    assert.equal(stage.origin.y, area.center.y);
    const dx = stage.endpoint.x - area.center.x, dy = stage.endpoint.y - area.center.y;
    assert.ok(Math.abs(Math.atan2(dx, dy)) < Math.PI / 6);
    assert.ok(Math.abs(Math.hypot(dx, dy) - 270) < 1e-8);
    assert.ok(Math.abs(stage.duration - 2870) < 1e-8);
  }
  assert.equal(new Set(plan.map(s => `${s.endpoint.x},${s.endpoint.y}`)).size, 7);
  assert.deepEqual(previewPlan(recipe(), { ...context, targets: [{ id: "ignored", center: { x: 2000, y: 2000 } }] }).map(s => s.endpoint), plan.map(s => s.endpoint));
});

test("fan configuration roundtrips with bounded count and rejects unsupported area or return", () => {
  const r = recipe();
  const imported = parseImport(JSON.stringify({ schema: 1, recipes: [r] }))[0];
  assert.equal(imported.stages[0].areaLayout, "fan");
  assert.equal(imported.stages[0].fanCount, 7);
  assert.equal(recipe({ fanCount: 999 }).stages[0].fanCount, 9);
  assert.throws(() => previewPlan(r, { ...context, area: { type: "circle" } }), /placed cone/);
  assert.throws(() => previewPlan(recipe({ travelOrigin: "target" }), context), /outward/);
});

test("fan editor exposes layout and count; responsive previews retain separate endpoints", () => {
  const r = recipe();
  const html = Workspace.prototype.stageOptionsHTML(r.stages[0], 0);
  assert.match(html, /Spread through cone/);
  assert.match(html, /data-field="fanCount"/);
  for (const width of [240, 400, 720]) {
    const preview = chainPreview(r, { previewWidth: width, previewHeight: 280 });
    assert.equal(preview.recipe.playbackPlan.length, 7);
    for (const shot of preview.recipe.playbackPlan) {
      const x = shot.endpoint.x / preview.width * 100, y = shot.endpoint.y / preview.height * 100;
      assert.ok(x > 24 && x < 100);
      assert.ok(y > 10 && y < 90);
    }
  }
});

test("canvas compiler moves separate films from native vertex; editor highlights and moves every ray", async () => {
  const calls = [];
  const effect = new Proxy({}, { get: (_, key) => (...args) => { calls.push([key, ...args]); return effect; } });
  const runtime = new AnimaterRuntime({ ready: () => true, userId: () => "fan", gridSize: () => 100, database: { entryExists: () => true, getPathsUnder: () => ["jb2a.twinkling_stars"], getAllFileEntries: () => ["Star_600x600.webm"] }, sequence: () => ({ effect: () => effect, play: async () => {} }) });
  const r = recipe();
  await runtime.play(r, context, { preview: true });
  assert.equal(calls.filter(c => c[0] === "moveTowards").length, 7);
  for (const call of calls.filter(c => c[0] === "atLocation")) assert.deepEqual({ x: call[1].x, y: call[1].y }, area.center);
  const layers = Array.from({ length: 7 }, (_, i) => ({ dataset: { layerStage: "0", previewPlan: String(i) }, style: { setProperty() {} }, querySelector: () => ({ videoWidth: 600, videoHeight: 600, style: {} }) }));
  const scene = { clientWidth: 350, clientHeight: 280, dataset: { chainPreview: "", previewTokens: "{}" }, querySelectorAll: selector => selector === "[data-layer-stage]" ? layers : [] };
  const player = new RecipePreview(scene, r, () => {});
  player.draw(recipeFrame(player.recipe, 1300));
  assert.ok(layers.every(layer => !layer.hidden && parseFloat(layer.style.left) > 24));
  assert.equal(new Set(layers.map(layer => layer.style.top)).size, 7);
});

test('beam fans stretch seven colored rays and editor renders actual cone endpoints without actor IDs',async()=>{
 const colors=['#ff0000','#ff8000','#ffff00','#00ff00','#00bfff','#0000ff','#8000ff'];
 const r=recipe({kind:'travel',assets:['jb2a.energy_beam'],fanColors:colors});
 const calls=[];const effect=new Proxy({}, {get:(_,key)=>(...args)=>{calls.push([key,...args]);return effect;}});
 const runtime=new AnimaterRuntime({ready:()=>true,userId:()=> 'rays',gridSize:()=>100,database:{entryExists:()=>true,getPathsUnder:()=>['jb2a.energy_beam'],getAllFileEntries:()=>['Ray_1000x400.webm']},sequence:()=>({effect:()=>effect,play:async()=>{}})});
 await runtime.play(r,context,{preview:true});
 assert.equal(calls.filter(c=>c[0]==='stretchTo').length,7);assert.equal(calls.filter(c=>c[0]==='moveTowards').length,0);
 assert.deepEqual(calls.filter(c=>c[0]==='filter'&&c[1]==='ColorMatrix').map(c=>c[2].tint),colors.map(color=>parseInt(color.slice(1),16)));
 const layers=Array.from({length:7},(_,i)=>({dataset:{layerStage:'0',previewPlan:String(i)},style:{setProperty(){}},querySelector:()=>({videoWidth:1000,videoHeight:400,style:{}})}));
 const scene={clientWidth:350,clientHeight:280,dataset:{chainPreview:'',previewTokens:'{}'},querySelectorAll:selector=>selector==='[data-layer-stage]'?layers:[]};
 const player=new RecipePreview(scene,r,()=>{});player.draw(recipeFrame(player.recipe,700));
 assert.ok(layers.every(layer=>!layer.hidden&&!/NaN/.test(layer.style.transform)&&parseFloat(layer.style.width)>0));
 assert.equal(new Set(layers.map(layer=>layer.style.transform)).size,7);
});
