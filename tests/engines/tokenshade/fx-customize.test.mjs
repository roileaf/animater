import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeLayers, setLayerValue, setLayerAnimation, addLayer, removeLayer, moveLayer, layersOf, MAX_LAYERS} from '../../../scripts/engines/tokenshade/layers.mjs';
import {controlsFor, animatableKeys} from '../../../scripts/engines/tokenshade/controls.mjs';
import {FILTER_TYPES} from '../../../scripts/engines/tokenshade/filters/index.mjs';
import {builtinPreset} from '../../../scripts/engines/tokenshade/presets.mjs';
import {tokenFxEditorHTML, applyTokenFxEdit, tokenFxAction} from '../../../scripts/ui/token-fx-editor.mjs';
import {normalizeFxStage, tintedPreset} from '../../../scripts/engines/playback/optional-fx.mjs';
import {validateRecipe, parseImport} from '../../../scripts/core/model.mjs';

test('every filter type offers editor controls for its settings',()=>{
  for(const type of FILTER_TYPES){
    const controls=controlsFor(type);
    assert.ok(controls.length>0,type);
    for(const c of controls){
      assert.ok(['range','check','color','select','path','stops'].includes(c.kind),`${type}.${c.key}`);
      if(c.kind==='range')assert.ok(c.min<c.max&&c.step>0,`${type}.${c.key}`);
    }
  }
  assert.ok(controlsFor('field').some(c=>c.key==='shieldType'&&c.kind==='select'));
  assert.ok(controlsFor('fire').some(c=>c.key==='color'&&c.kind==='color'));
  assert.ok(animatableKeys('fire').includes('time'));
});
test('stored layers are sanitized: unknown filters, keys, animations and unsafe images are dropped',()=>{
  const layers=normalizeLayers([
    {filterType:'nope'},
    {filterType:'glow',color:0xffffff,outerStrength:'3',evil:'x',distance:1e12,animated:{color:{animType:'colorOscillation',val1:0,val2:0xffffff,loopDuration:5},bogus:{animType:'move'},outerStrength:{animType:'hack'}}},
    {filterType:'sprite',imagePath:'https://evil.example/x.png'},
    {filterType:'sprite',imagePath:'modules/animater/assets/fx/star.svg'},
  ]);
  assert.equal(layers.length,3);
  assert.equal(layers[0].color,0xffffff,'colours keep their full range');
  assert.equal(layers[0].outerStrength,3);assert.equal(layers[0].evil,undefined);
  assert.ok(layers[0].distance<=1e8);
  assert.deepEqual(Object.keys(layers[0].animated),['color']);assert.equal(layers[0].animated.color.loopDuration,16);
  assert.equal(layers[1].imagePath,undefined);assert.equal(layers[2].imagePath,'modules/animater/assets/fx/star.svg');
  assert.equal(normalizeLayers(Array(20).fill({filterType:'glow'})).length,MAX_LAYERS);
  assert.equal(normalizeLayers([]),undefined);
});
test('layer edits are copy-on-write: the preset is never changed',()=>{
  const preset=builtinPreset('pure-fire-aura'),before=JSON.stringify(preset);
  let layers=layersOf({},preset);
  layers=setLayerValue(layers,0,'color',0x3388ff);
  layers=setLayerValue(layers,1,'enabled',false);
  layers=setLayerAnimation(layers,2,'thickness',{animType:'syncCosOscillation',val1:1,val2:3,loopDuration:900});
  layers=addLayer(layers,'electric');
  assert.equal(layers.length,4);assert.equal(layers[3].animated.time.animType,'move','new layers start moving');
  layers=moveLayer(layers,3,-1);assert.equal(layers[2].filterType,'electric');assert.ok(layers.every((l,i)=>l.zOrder===(i+1)*10));
  layers=removeLayer(layers,2);assert.equal(layers.length,3);
  assert.equal(layers[0].color,0x3388ff);assert.equal(layers[1].enabled,false);
  assert.equal(setLayerAnimation(layers,0,'nonsense',{animType:'move'}),layers,'only real settings animate');
  assert.equal(JSON.stringify(preset),before);
});
test('stage customization round-trips through recipes and drives playback',()=>{
  const r=validateRecipe({id:'c',name:'c',trigger:'manual',stages:[{kind:'tokenfx',fxPreset:'fire',fxLibrary:'tokenshade',subject:'source',duration:1000,fxSpeed:9,
    fxLayers:[{filterType:'fire',color:0x3388ff,junk:1},{filterType:'unknown'}]}]});
  const s=r.stages[0];
  assert.deepEqual(s.fxLayers,[{filterType:'fire',color:0x3388ff}]);assert.equal(s.fxSpeed,5,'speed is bounded');
  assert.deepEqual(parseImport(JSON.stringify({schema:1,recipes:[r]}))[0].stages[0].fxLayers,s.fxLayers);
  const played=tintedPreset(builtinPreset('fire'),{...s,fxTint:'#00ff00'});
  assert.equal(played.params.length,1);assert.equal(played.params[0].color,0x00ff00,'tint still applies to an edited effect');
  assert.equal(normalizeFxStage({kind:'tokenfx',fxLibrary:'tokenshade-custom'}).fxLibrary,'tokenshade-custom');
  assert.equal(normalizeFxStage({kind:'tokenfx',fxLibrary:'elsewhere'}).fxLibrary,'tokenshade');
});
test('the editor renders every layer and applies inputs once',()=>{
  const preset=builtinPreset('pure-fire-aura'),stage={kind:'tokenfx',fxPreset:'pure-fire-aura'};
  const html=tokenFxEditorHTML(stage,2,preset,{canSave:true});
  assert.equal((html.match(/<fieldset/g)??[]).length,3);
  assert.match(html,/data-field="fxSpeed" data-index="2"/);assert.match(html,/Save as my preset/);assert.match(html,/as the preset/);
  assert.doesNotMatch(tokenFxEditorHTML(stage,2,preset),/Save as my preset/,'players cannot write world presets');
  assert.equal(applyTokenFxEdit(stage,preset,{layer:'0',key:'color'},{type:'color',value:'#3388ff'}),true);
  assert.equal(stage.fxLayers[0].color,0x3388ff);
  applyTokenFxEdit(stage,preset,{key:'__add'},{value:'glow'});assert.equal(stage.fxLayers.length,4);
  assert.equal(applyTokenFxEdit(stage,preset,{key:'__add'},{value:''}),false);
  applyTokenFxEdit(stage,preset,{layer:'3',key:'__animate'},{value:'outerStrength'});
  assert.equal(stage.fxLayers[3].animated.outerStrength.animType,'cosOscillation');
  applyTokenFxEdit(stage,preset,{layer:'3',key:'outerStrength',anim:'val2'},{type:'number',value:'7'});
  assert.equal(stage.fxLayers[3].animated.outerStrength.val2,7);
  applyTokenFxEdit(stage,preset,{layer:'0',key:'time',anim:'rate'},{type:'number',value:'2'});
  assert.ok(Math.abs(stage.fxLayers[0].animated.time.speed*(-1/2.4)*1000-2)<1e-9,'motion rate is in natural-speed multiples');
  applyTokenFxEdit(stage,preset,{layer:'3',key:'outerStrength',anim:'animType'},{value:''});
  assert.equal(stage.fxLayers[3].animated,undefined);
  assert.match(tokenFxEditorHTML(stage,2,preset),/edited for this stage/);
  tokenFxAction('fx-layers-reset',stage,preset,{});assert.equal(stage.fxLayers,undefined);
});

test('library ids saved before Tokenshade had its own are translated wherever data comes in',async()=>{
  const {libraryItem}=await import('../../../scripts/engines/media/media-library-model.mjs');
  const {libraryPreferences}=await import('../../../scripts/ui/media-library.mjs');
  assert.equal(normalizeFxStage({kind:'tokenfx',fxLibrary:'tmfx-main',fxPreset:'fire'}).fxLibrary,'tokenshade');
  assert.equal(normalizeFxStage({kind:'tokenfx',fxLibrary:'tmfx-region'}).fxLibrary,'tokenshade-region');
  assert.equal(normalizeFxStage({kind:'tokenfx',fxLibrary:'animater-custom'}).fxLibrary,'tokenshade-custom');
  assert.equal(libraryItem({type:'tokenfx',fxPreset:'fire',fxLibrary:'tmfx-main'}).id,'tokenfx:tokenshade:fire');
  assert.deepEqual(libraryPreferences({favorites:['tokenfx:tmfx-region:Flames','tokenfx:tokenshade-region:Flames']}).favorites,['tokenfx:tokenshade-region:Flames']);
  const r=validateRecipe({id:'old',name:'old',trigger:'manual',stages:[{kind:'tokenfx',fxPreset:'glow',fxLibrary:'tmfx-main',subject:'source',duration:500}]});
  assert.equal(r.stages[0].fxLibrary,'tokenshade');
});
