import test from 'node:test';
import assert from 'node:assert/strict';
import {previewFilters,TokenFxPreview} from '../../../scripts/engines/preview/token-fx-preview.mjs';
import {RecipePreview} from '../../../scripts/engines/preview/recipe-preview.mjs';
import {recipeFrame} from '../../../scripts/engines/playback/choreography.mjs';
import {validateRecipe} from '../../../scripts/core/model.mjs';

function fixture() {
  const calls=[];
  class Point {constructor(x=0,y=x){this.x=x;this.y=y;}set(x,y=x){this.x=x;this.y=y;}}
  class Filter {constructor(vertex,fragment,uniforms){this.uniforms=uniforms;this.enabled=true;}destroy(){calls.push(['filter-destroy',this]);}}
  class Container {constructor(){this.children=[];}addChild(art){this.children.push(art);}destroy(options){calls.push(['container-destroy',options]);}}
  class Graphics extends Container {constructor(){super();this.position=new Point();this.width=55;this.height=55;}lineStyle(){return this;}beginFill(){return this;}drawCircle(){return this;}drawRoundedRect(){return this;}endFill(){return this;}}
  class Renderer {constructor(){calls.push(['renderer']);}resize(w,h){this.width=w;this.height=h;}render(){calls.push(['render']);}destroy(){calls.push(['renderer-destroy']);}}
  const PIXI={Point,Matrix:class{},Container,Graphics,Renderer,Filter,Texture:{EMPTY:{}}};
  const preset={name:'Super-Frost',params:[{filterType:'fire',color:0xffffff,animated:{time:{animType:'move',speed:-.0024}}}]};
  const tokenFx={getPresets:()=>[preset]};
  const token=subject=>({dataset:{previewToken:subject},style:{width:'55px',height:'55px'},classList:{add:()=>calls.push(['hide-art',subject]),remove:()=>calls.push(['show-art',subject])},querySelector:()=>null,append:view=>calls.push(['append',subject,view])});
  const source=token('source'),target=token('targets');
  const scene={dataset:{},querySelectorAll:()=>[source,target],ownerDocument:{createElement:()=>({style:{},setAttribute(){},getContext:()=>({clearRect(){},drawImage(){calls.push(['copy']);}}),remove:()=>calls.push(['view-remove'])})}};
  const recipe=validateRecipe({id:'fx-preview',name:'FX',trigger:'manual',stages:[{kind:'tokenfx',fxPreset:preset.name,subject:'targets',duration:1000,delay:300}]});
  return {calls,PIXI,tokenFx,preset,scene,recipe,source,target,world:()=>0};
}
test('preview filters use a tinted copy of the preset and the engine’s own clock',()=>{
  const f=fixture(),original=structuredClone(f.preset);
  const [filter]=previewFilters(f.preset,{fxTint:'#11ddff'},{PIXI:f.PIXI});
  assert.equal(filter.current.color,0x11ddff);assert.deepEqual(f.preset,original);
  filter.update(2000,0);assert.ok(Math.abs(filter.uniforms.uTime-2)<1e-9);
});
test('window shaders run on intended token only during stage timing, then restore art and release GPU resources',async()=>{
  const f=fixture(),preview=new TokenFxPreview(f);await preview.ready();
  preview.draw(recipeFrame(f.recipe,100));assert.ok(!f.calls.some(c=>c[0]==='render'));
  preview.draw(recipeFrame(f.recipe,500));
  assert.equal(f.calls.filter(c=>c[0]==='render').length,1);
  assert.deepEqual(f.calls.filter(c=>c[0]==='hide-art').map(c=>c[1]),['targets']);
  preview.draw(recipeFrame(f.recipe,1500));assert.ok(f.calls.some(c=>c[0]==='show-art'&&c[1]==='targets'));
  preview.stop();preview.stop();
  assert.equal(f.calls.filter(c=>c[0]==='renderer-destroy').length,1);
  // The fire filter and its silhouette field pass.
  assert.equal(f.calls.filter(c=>c[0]==='filter-destroy').length,2);
  assert.ok(f.calls.filter(c=>c[0]==='container-destroy').every(c=>c[1].texture===false&&c[1].baseTexture===false));
});
test('unknown filter types are skipped; a preset with nothing drawable is refused',()=>{
  const f=fixture();
  f.preset.params.push({filterType:'unknown'});
  assert.equal(previewFilters(f.preset,{},{PIXI:f.PIXI}).length,1);
  assert.throws(()=>previewFilters({name:'odd',params:[{filterType:'unknown'}]},{},{PIXI:f.PIXI}),/Unsupported token FX preset/);
});
test('asset-window shader output fits padded effects inside its preview bounds',async()=>{
  const f=fixture();f.preset.params[0].amplitude=4;f.scene.dataset.fitTokenFx='';f.scene.clientWidth=240;f.scene.clientHeight=235;
  const preview=new TokenFxPreview(f);await preview.ready();preview.draw(recipeFrame(f.recipe,500));
  const {view}=preview.records[1];
  assert.ok(view.width>219);assert.ok(Math.abs(parseFloat(view.style.width)-219)<1e-8);
  assert.ok(Math.abs(parseFloat(view.style.height)-219)<1e-8);preview.stop();
});
test('token artwork keeps native dimensions, rotation and mirrors without leaking image textures',async()=>{
  const f=fixture();
  class Texture {constructor(base){this.baseTexture=base;}destroy(base){f.calls.push(['texture-destroy',base]);}}
  class Sprite {constructor(texture){this.texture=texture;this.anchor=new f.PIXI.Point();this.position=new f.PIXI.Point();this.scale=new f.PIXI.Point(1);}}
  Object.assign(f.PIXI,{BaseTexture:class {constructor(image){this.resource=image;}},Texture,Sprite});
  const image={complete:true,naturalWidth:128,style:{width:'70px',height:'90px'}};
  f.source.querySelector=()=>image;
  f.scene.dataset.previewTokens=JSON.stringify({source:{rotation:45,textureScaleX:-1,textureScaleY:1}});
  const preview=new TokenFxPreview(f);await preview.ready();
  const {art,texture}=preview.records[0];
  assert.equal(texture.baseTexture.resource,image);assert.equal(art.width,70);assert.equal(art.height,90);
  assert.equal(art.rotation,Math.PI/4);assert.equal(art.scale.x,-1);assert.equal(art.scale.y,1);
  preview.stop();preview.stop();assert.deepEqual(f.calls.filter(c=>c[0]==='texture-destroy'),[['texture-destroy',true]]);
  f.scene.dataset.fitTokenFx='';Object.assign(image,{naturalHeight:64,style:{width:'112px',height:'112px'}});
  const sample=new TokenFxPreview(f);await sample.ready();
  assert.equal(sample.records[0].art.width,112);assert.equal(sample.records[0].art.height,56);
  sample.stop();
});
test('unsupported active shaders preserve artwork and fail once instead of retrying every frame',async()=>{
  const f=fixture();let lookups=0;
  f.tokenFx.getPresets=()=>{lookups++;return [{name:'Super-Frost',params:[{filterType:'unknown'}]}];};
  const preview=new TokenFxPreview(f);await preview.ready();
  for(const time of [500,700,900])preview.draw(recipeFrame(f.recipe,time));
  assert.equal(lookups,1);assert.match(f.scene.dataset.fxError,/Unsupported token FX/);
  assert.ok(!f.calls.some(c=>c[0]==='hide-art'));preview.stop();
});
test('recipe preview buffers and drives shader lifecycle, including late preparation cancellation',async()=>{
  const f=fixture(),calls=[];
  const scene={dataset:{},querySelectorAll:()=>[]};
  const native={ready:async()=>calls.push('ready'),draw:()=>calls.push('draw'),stop:()=>calls.push('stop')};
  const preview=new RecipePreview(scene,f.recipe,()=>{}, {tokenFx:async()=>native});
  await preview.prepareTokenFx();preview.draw(recipeFrame(f.recipe,500));preview.stop();
  assert.deepEqual(calls,['ready','draw','stop']);
  let complete;const pending=new RecipePreview(scene,f.recipe,()=>{}, {tokenFx:()=>new Promise(resolve=>{complete=resolve;})});
  const ready=pending.prepareTokenFx();await new Promise(resolve=>setImmediate(resolve));pending.stop();complete(native);await ready;
  assert.equal(calls.at(-1),'stop');assert.equal(calls.filter(c=>c==='ready').length,1);
});
