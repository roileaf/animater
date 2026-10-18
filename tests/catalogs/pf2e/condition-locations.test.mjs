import test from 'node:test';
import assert from 'node:assert/strict';
import {PF2E_CONDITIONS,stateRecipe} from '../../../scripts/catalogs/pf2e/state-catalog.mjs';
import {planRecipe} from '../../../scripts/core/model.mjs';
import {offsetInGridSquares} from '../../../scripts/engines/media/media-preview.mjs';
import {artworkGeometry} from '../../../scripts/engines/media/media-preview.mjs';
import {RecipePreview} from '../../../scripts/engines/preview/recipe-preview.mjs';
import {recipeFrame} from '../../../scripts/engines/playback/choreography.mjs';

const entry=slug=>PF2E_CONDITIONS.find(e=>e.slug===slug);
const orbit=/^jb2a\.markers\.(?:fear|heart|mute|shield_cracked|skull|drop|poison|stun|runes(?:02|03)?)\./;

test('Off-Guard and Wounded anchor their complete baked orbit at the affected token center',()=>{
 for(const slug of ['off-guard','wounded'])for(const edition of ['free','patreon'])for(const [w,h] of [[100,100],[200,200],[100,200]]){
  const e=entry(slug),catalog=e.conditionDesign.layers.map(l=>({key:l.editions[edition].key}));
  const source={id:'affected',w,h,center:{x:450,y:350}};
  const recipe=stateRecipe(e,{catalog}),plan=planRecipe(recipe,catalog,{source,targets:[],gridSize:100});
  for(const stage of plan){
   assert.equal(stage.destination,source);
   assert.deepEqual(offsetInGridSquares(stage,source,100),{x:0,y:0},`${slug} ${edition} ${w}x${h}: displaced orbit`);
  }
 }
});

test('Unconscious places the visible sleep symbols at the intended face location in both editions',()=>{
 const e=entry('unconscious');
 // Full-clip visible-alpha bounds at 128px. The file frame center is not the
 // symbol center: without compensation it drifts right and far overhead.
 const samples={patreon:{x:87/128,y:39.5/128},free:{x:87/128,y:40.5/128}};
 for(const edition of ['free','patreon']){
  const media=e.conditionDesign.layers[0].editions[edition],catalog=[{key:media.key}],r=stateRecipe(e,{catalog}),s=r.stages[0];
  const artwork={videoWidth:400,videoHeight:400,currentSrc:media.files[0],style:{}},layer={dataset:{layerStage:'0'},style:{setProperty(){}},querySelector:()=>artwork};
  const scene={clientWidth:400,clientHeight:300,dataset:{previewTokens:JSON.stringify({source:{width:1,height:1}})},querySelectorAll:selector=>selector==='[data-layer-stage]'?[layer]:[]};
  const player=new RecipePreview(scene,r,()=>{});player.draw(recipeFrame(player.recipe,2000));
  const translation=/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(artwork.style.transform);
  assert.ok(translation,artwork.style.transform);
  const geometry=artworkGeometry(55,400,400,{file:media.files[0],width:400,height:400});
  const anchor={x:s.customAnchor?s.anchorX:.5,y:s.customAnchor?s.anchorY:.5};
  // CSS scales around transformOrigin; the anchor itself stays invariant.
  const visible={x:Number(translation[1])+(anchor.x-.5+(samples[edition].x-anchor.x)*s.scale)*geometry.width,y:Number(translation[2])+(anchor.y-.5+(samples[edition].y-anchor.y)*s.scale)*geometry.height};
  assert.ok(Math.abs(visible.x-s.offsetX*55)<.1,`${edition}: visible icon drifts horizontally`);
  assert.ok(Math.abs(visible.y-s.offsetY*55)<.1,`${edition}: visible icon drifts above intended face cue`);
 }
});

test('every condition and damage-type orbit uses its encoded center rather than a side or face badge offset',()=>{
 for(const e of PF2E_CONDITIONS)for(const damageType of [undefined,...Object.keys(e.damageVariants??{})]){
  const recipe=stateRecipe(e,{damageType});
  for(const stage of recipe.stages.filter(s=>s.assets.some(key=>orbit.test(key)))){
   assert.deepEqual({x:stage.offsetX,y:stage.offsetY},{x:0,y:0},`${e.slug} ${damageType??''}: offset moves the entire orbit`);
  }
 }
});
