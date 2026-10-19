import test from 'node:test';
import assert from 'node:assert/strict';
import {registeredMedia,mergeMedia,mediaGroups,libraryItem,mediaForReference,safeMediaFile,variantSize,matchingMediaVariant,mediaVariantChoices,mediaVariantFacets,tokenFxAssets} from '../../scripts/engines/media/media-library-model.mjs';
import {installedMediaLibrary} from '../../scripts/engines/media/media-library-sources.mjs';
import {MediaLibrary,libraryPreferences} from '../../scripts/ui/media-library.mjs';
import {validateRecipe,planRecipe} from '../../scripts/core/model.mjs';
import {AnimaterRuntime} from '../../scripts/engines/playback/runtime.mjs';
import {Workspace} from '../../scripts/ui/workspace.mjs';

function database() {
  const files={
    'jb2a.ray_of_frost.blue':{file:'modules/jb2a/ray_15ft_1000x400.webm',files:{'15ft':['modules/jb2a/ray_15ft_1000x400.webm'],'30ft':['modules/jb2a/ray_30ft_1600x400.webm']},template:[100,200,300]},
    'other.ward.gold':{file:'modules/other/ward.png',files:['modules/other/ward.png']},
    'audio.ice.hit':{file:'modules/sounds/ice-hit-01.ogg',files:['modules/sounds/ice-hit-01.ogg','modules/sounds/ice-hit-02.ogg']},
    'audio.bad':{file:'http://example.test/bad.ogg',files:['http://example.test/bad.ogg']},
    'audio.broken':null,
    'private.secret':{file:'modules/private/hidden.webm',files:['modules/private/hidden.webm']},
  };
  return {searchFor:()=>['jb2a','other','audio'],entryExists:key=>key==='jb2a'||!!files[key],getPathsUnder:namespace=>Object.keys(files).filter(k=>k.startsWith(namespace+'.')),
    getEntry:key=>files[key]?{dbPath:key,template:files[key].template,getFile:()=>files[key].file}:false,
    getAllFileEntries:key=>files[key]?.files};
}
test('public Sequencer discovery includes other visual packs and every sound/file variant, skips bad/private entries',()=>{
  const rows=registeredMedia(database());
  assert.equal(rows.length,4);
  assert.deepEqual(rows.filter(v=>v.type==='audio').map(v=>v.file),['modules/sounds/ice-hit-01.ogg','modules/sounds/ice-hit-02.ogg']);
  const ray=rows.find(v=>v.key==='jb2a.ray_of_frost.blue');
  assert.deepEqual(ray.template,[100,200,300]);assert.equal(ray.files.length,2);
  const variant=mediaForReference(rows,'modules/jb2a/ray_30ft_1600x400.webm');
  assert.equal(variant.file,'modules/jb2a/ray_30ft_1600x400.webm');assert.equal(variant.width,1600);assert.deepEqual(variant.template,[100,200,300]);
  assert.ok(rows.find(v=>v.type==='image'&&v.key==='other.ward.gold'));
});
test('search combines multiple terms, color/source/type filters, grouping, favorites and recent order',()=>{
  const rows=mergeMedia(registeredMedia(database()),[{key:'jb2a.ray_of_frost.white',file:'modules/jb2a/ice_white.webm',source:'jb2a'}]);
  const matches=mediaGroups(rows,{type:'animation',search:'cold ray',color:'blue',source:'jb2a'});
  assert.equal(matches.count,1);assert.equal(matches.groups.length,1);
  assert.equal(mediaGroups(rows,{type:'audio'}).groups[0].variants.length,2);
  const ids=rows.filter(v=>v.type==='audio').map(v=>v.id);
  assert.equal(mediaGroups(rows,{collection:'favorites'},{favorites:[ids[1]]}).count,1);
  const recent=mediaGroups(rows,{collection:'recent',grouped:false},{recent:[ids[1],ids[0]]}).groups;
  assert.deepEqual(recent.map(g=>g.variants[0].id),[ids[1],ids[0]]);
  assert.equal(mediaGroups(rows,{type:'animation',search:'absent'}).count,0);
});
test('enabled sound packs expose uncatalogued files; disabled packs and escaping directories never scanned',async()=>{
  const calls=[];
  const result=await installedMediaLibrary({database:database(),modules:new Map([['soundfxlibrary',{active:true}]]),browse:async dir=>{
    calls.push(dir);
    return dir==='modules/soundfxlibrary'?{dirs:['modules/soundfxlibrary/Combat','modules/soundfxlibrary/../private','modules/disabled/secret','../private'],files:['modules/soundfxlibrary/whoosh.ogg','modules/soundfxlibrary/code.js']}:{dirs:[],files:['modules/soundfxlibrary/Combat/unused-hit.wav']};
  }});
  assert.deepEqual(calls,['modules/soundfxlibrary','modules/soundfxlibrary/Combat']);
  assert.ok(result.entries.some(v=>v.file==='modules/soundfxlibrary/Combat/unused-hit.wav'));
  assert.ok(!result.entries.some(v=>v.file.endsWith('.js')));
  const partial=await installedMediaLibrary({database:database(),modules:new Map([['soundfxlibrary',{active:true}]]),browse:async()=>{throw Error('Permission denied');}});
  assert.ok(partial.entries.length);assert.match(partial.warning,/could not be indexed/);
});

test('installed audio libraries larger than 600 folders finish discovery without a false read-error banner',async()=>{
  const root='modules/ggg',calls=[];
  const result=await installedMediaLibrary({modules:new Map([['ggg',{active:true}]]),browse:async path=>{
    calls.push(path);
    return path===root?{dirs:Array.from({length:620},(_,i)=>`${root}/sound-${i}`),files:[]}:{dirs:[],files:[`${path}/take.ogg`]};
  }});
  assert.equal(result.warning,'');assert.equal(calls.length,621);
  assert.equal(result.entries.filter(e=>e.file.endsWith('/take.ogg')).length,620);
  assert.ok(result.entries.some(e=>e.file===`${root}/sound-619/take.ogg`));
});

test('discovery guard reports truncation separately, counts unique paths and respects its exact folder budget',async()=>{
  const root='modules/soundfxlibrary',calls=[];
  const result=await installedMediaLibrary({maxFolders:3,modules:new Map([['soundfxlibrary',{active:true}]]),browse:async path=>{
    calls.push(path);
    return path===root?{dirs:[`${root}/a`,`${root}/a`,`${root}/b`,`${root}/c`],files:[]}:{dirs:[],files:[`${path}/hit.ogg`]};
  }});
  assert.deepEqual(calls,[root,`${root}/a`,`${root}/b`]);
  assert.equal(result.discovery.limitReached,true);assert.equal(result.discovery.remaining,1);
  assert.deepEqual(result.discovery.failures,[]);assert.match(result.warning,/folder limit/i);
});

test('real unreadable folders disclose their path and reason, while database-only discovery has no false warning',async()=>{
  const modules=new Map([['soundfxlibrary',{active:true}]]);
  const failed=await installedMediaLibrary({modules,database:database(),browse:async()=>{throw Error('Permission denied');}});
  assert.match(failed.warning,/modules\/soundfxlibrary/);assert.match(failed.warning,/Permission denied/);
  assert.deepEqual(failed.discovery.failures,[{path:'modules/soundfxlibrary',error:'Permission denied'}]);
  const registered=await installedMediaLibrary({modules,database:database()});
  assert.equal(registered.warning,'');assert.ok(registered.entries.length);
});
test('generic database keys and relative custom visuals validate/plan; remote paths and audio-as-visual remain blocked',()=>{
  const source={center:{x:0,y:0}};
  for(const asset of ['other.ward.gold','modules/my/effect.webm','worlds/my/artwork.png']) {
    const r=validateRecipe({id:'custom',name:'Custom',trigger:'manual',stages:[{kind:'cast',assets:[asset]}]});
    assert.equal(planRecipe(r,registeredMedia(database()),{source,targets:[]})[0].asset,asset);
  }
  for(const file of ['https://bad.test/x.webm','../private.webm','C:/secret.png','/outside.webm','modules/bad?<x>.webm'])assert.equal(safeMediaFile(file),false);
  assert.throws(()=>validateRecipe({id:'bad',name:'Bad',trigger:'manual',stages:[{kind:'cast',assets:['modules/audio.ogg']}]}),/database key/);
  assert.throws(()=>planRecipe(validateRecipe({id:'unknown',name:'Unknown',trigger:'manual',stages:[{kind:'cast',assets:['unknown.asset.key']}]}),[],{source}),/no installed asset/);
});
function libraryFixture() {
  const original=validateRecipe({id:'draft',name:'Draft',trigger:'manual',stages:[{kind:'cast',assets:['other.ward.gold']}]});
  let draft=structuredClone(original),saves=0,renders=0;
  const w={host:{catalog:()=>registeredMedia(database()).filter(v=>v.type!=='audio'),soundCatalog:()=>({entries:registeredMedia(database()).filter(v=>v.type==='audio')}),setMediaPreferences:async()=>{}},selected:'draft',stageIndex:0,page:'assets',recipe:()=>draft,edit:()=>draft,render:()=>{renders++;},root:{querySelector:selector=>selector.startsWith('audio')?{duration:2.4}:null},stageLabel:s=>s.kind,abort:new AbortController()};
  const library=new MediaLibrary(w);
  return {library,w,original,get draft(){return draft;},get saves(){return saves;},get renders(){return renders;}};
}

test('teleport picker applies departure and arrival art independently, preserves stages and returns to settings', async () => {
  const f = libraryFixture(), originalStages = structuredClone(f.draft.stages);
  f.w.studioSettings = true;
  const effect = f.library.items.find(item=>item.key==='jb2a.ray_of_frost.blue');
  for (const field of ['teleportOut', 'teleportIn']) {
    f.library.open('animation', field);
    f.library.choose(effect.id);
    const html = f.library.html(f.draft);
    assert.match(html, new RegExp(`Use ${field === 'teleportOut' ? 'departure' : 'arrival'} effect`));
    assert.doesNotMatch(html, /data-action="media-add"|data-value="audio"|data-value="tokenfx"/);
    if (field === 'teleportIn') f.library.file = effect.files[1];
    await f.library.action('media-apply', {dataset:{}});
    assert.equal(f.draft[field], field==='teleportOut' ? effect.key : effect.files[1]);
    assert.equal(f.w.page, 'recipes');
    assert.equal(f.w.studioSettings, true);
    assert.equal(f.library.target, null);
    assert.deepEqual(f.draft.stages, originalStages);
  }
  assert.equal(f.draft.teleportOut, effect.key);
  assert.equal(validateRecipe(f.draft).teleportIn, effect.files[1]);
  f.library.open('animation','teleportIn');
  assert.equal(f.library.file, effect.files[1], 'exact saved file variation reopens');
  await f.library.action('media-back', {dataset:{}});
  assert.equal(f.library.target, null);
  f.library.open('animation');
  f.library.choose(effect.id);
  await f.library.action('media-apply', {dataset:{}});
  assert.deepEqual(f.draft.stages[0].assets, [effect.key], 'normal stage browser still works');
  assert.equal(f.draft.teleportIn, effect.files[1]);
});

test('teleport picker rejects audio and stale recipes; custom images and incomplete drafts remain selectable', async () => {
  const f = libraryFixture(), originalStages = structuredClone(f.draft.stages);
  f.draft.teleportOut = 'worlds/demo/custom.png';
  f.library.open('animation', 'teleportOut');
  assert.equal(f.library.filters.type, 'image');
  assert.equal(f.library.selected.file, 'worlds/demo/custom.png');
  await f.library.load(true);
  assert.equal(f.library.selected.file, 'worlds/demo/custom.png', 'legacy custom paths survive discovery refresh');
  const before = structuredClone(f.draft);
  f.library.choose(f.library.items.find(item=>item.type==='audio').id);
  await f.library.action('media-apply', {dataset:{}});
  await f.library.action('media-add', {dataset:{}});
  assert.deepEqual(f.draft, before);
  f.library.choose(f.library.items.find(item=>item.key==='other.ward.gold').id);
  f.draft.id = 'another-recipe';
  await assert.rejects(f.library.action('media-apply', {dataset:{}}), /Recipe changed/);
  assert.deepEqual(f.draft.stages, originalStages);
  f.library.open('animation', 'teleportIn');
  f.draft.stages[0].assets = [];
  f.library.choose(f.library.items.find(item=>item.key==='other.ward.gold').id);
  await f.library.action('media-apply', {dataset:{}});
  assert.equal(f.draft.teleportIn, 'other.ward.gold');
  assert.deepEqual(f.draft.stages[0].assets, [], 'teleport choice does not require a complete stage');
});

test('successful library refresh clears prior indexing warning and exposes audio in deeply nested folders',async()=>{
  const f=libraryFixture(),modules=new Map([['soundfxlibrary',{active:true}]]);
  let result=await installedMediaLibrary({modules,browse:async()=>{throw Error('Permission denied');}});
  f.w.host.loadMediaCatalog=async()=>result;
  await f.library.load(true);assert.match(f.library.html(f.draft),/could not be indexed/);
  const root='modules/soundfxlibrary';
  result=await installedMediaLibrary({modules,browse:async path=>path.split('/').length<15?{dirs:[`${path}/nested`],files:[]}:{dirs:[],files:[`${path}/deep-hit.ogg`]}});
  await f.library.load(true);
  assert.equal(f.library.error,'');assert.doesNotMatch(f.library.html(f.draft),/could not be indexed/);
  assert.ok(f.library.items.some(e=>e.file.startsWith(root)&&e.file.endsWith('/deep-hit.ogg')));
});
const fxCatalog=()=>({tokenReady:true,presets:[
  {name:'fire',library:'tokenshade',filterTypes:['fire'],tintable:true},
  {name:'fire',library:'tokenshade-region',filterTypes:['fire','fog'],tintable:true},
  {name:'My custom ward',library:'tokenshade',filterTypes:['glow']},
]});
function tokenLibraryFixture() {
  const f=libraryFixture();f.w.host.fxCatalog=fxCatalog;
  f.library.items=mergeMedia(f.library.items,tokenFxAssets(fxCatalog()));
  f.library.choose(f.library.items.find(v=>v.type==='tokenfx').id);
  return f;
}
test('Tokenshade metadata includes custom and region presets without inventing file assets',()=>{
  const rows=tokenFxAssets(fxCatalog());assert.equal(rows.length,3);
  assert.deepEqual(tokenFxAssets({...fxCatalog(),tokenReady:false}),[]);
  assert.equal(tokenFxAssets({tokenReady:true,presets:[{name:'x',library:'unknown'}]}).length,0);
  assert.equal(rows[0].file,'');assert.deepEqual(rows[0].files,[]);
  assert.equal(mediaForReference(rows,''),null);assert.equal(safeMediaFile(rows[0].id),false);
  const fire=mediaGroups(rows,{type:'tokenfx',search:'fire',source:'Tokenshade'});
  assert.equal(fire.groups.length,1);assert.equal(fire.count,2);
  assert.equal(mediaGroups(rows,{search:'custom glow'}).count,1);
  assert.equal(mediaGroups(rows,{collection:'favorites'},{favorites:[rows[2].id]}).count,1);
  assert.equal(libraryPreferences({custom:rows,favorites:[rows[0].id]}).custom.length,0);
});
test('token filter insertion uses native preset, subject, tint and duration while preserving original draft',async()=>{
  const f=tokenLibraryFixture();f.library.tokenFx={subject:'targets',duration:4100,tint:'#00eeaa'};
  await f.library.action('media-add',{dataset:{}});
  const s=validateRecipe(f.draft).stages[1];
  assert.equal(s.kind,'tokenfx');assert.equal(s.fxPreset,'fire');assert.equal(s.fxLibrary,'tokenshade');
  assert.equal(s.subject,'targets');assert.equal(s.duration,4100);assert.equal(s.fxTint,'#00eeaa');assert.deepEqual(s.assets,[]);
  assert.equal(s.persist,false);assert.equal(f.original.stages.length,1);assert.equal(f.saves,0);
});
test('document recipe adds retained token filter only to affected token, preserving document lifecycle',async()=>{
  const f=tokenLibraryFixture();f.draft.lifecycle='document';f.draft.trigger='effect';f.draft.stages[0].kind='aura';f.draft.stages[0].persist=true;
  f.library.tokenFx.subject='targets';
  await f.library.action('media-add',{dataset:{}});
  const r=validateRecipe(f.draft),s=r.stages[1];
  assert.equal(r.lifecycle,'document');assert.equal(s.kind,'tokenfx');assert.equal(s.persist,true);assert.equal(s.subject,'source');
});
test('preset replacement preserves timing, placement and tint and refuses to replace media stages',async()=>{
  const f=tokenLibraryFixture();
  await assert.rejects(f.library.action('media-apply',{dataset:{}}),/Tokenshade stage/);
  await f.library.action('media-add',{dataset:{}});
  const s=f.draft.stages[1];Object.assign(s,{subject:'targets',delay:1200,duration:4200,fxTint:'#1188ff',catalogFx:true,fxProfile:'fire'});
  const id=f.library.items.find(v=>v.type==='tokenfx'&&v.fxLibrary==='tokenshade-region').id;f.library.choose(id);
  await f.library.action('media-apply',{dataset:{}});
  assert.equal(s.fxLibrary,'tokenshade-region');assert.equal(s.subject,'targets');assert.equal(s.delay,1200);assert.equal(s.duration,4200);assert.equal(s.fxTint,'#1188ff');
  assert.ok(!s.catalogFx&&!s.fxProfile);
  f.library.choose(f.library.items.find(v=>v.type==='animation').id);
  await assert.rejects(f.library.action('media-apply',{dataset:{}}),/effect stage/);assert.deepEqual(s.assets,[]);
});
test('native filter detail previews sample artwork in the window and keeps canvas audition optional',()=>{
  const f=tokenLibraryFixture();f.library.filter('type','tokenfx');
  const html=f.library.html(f.draft);
  assert.match(html,/Tokenshade/);assert.match(html,/Preview on canvas/);assert.match(html,/Add token filter stage/);
  assert.match(html,/data-media-fx-scene/);assert.match(html,/icons\/svg\/mystery-man.svg/);
  assert.doesNotMatch(html,/media-fx-preview|media-fx-stop|Replay preset|>Preview preset</);assert.match(html,/Sample token/);
  assert.doesNotMatch(html,/Live token filter|Preview on the Foundry canvas/);
  assert.match(html,/Preset library/);assert.ok(!html.includes('<video')&&!html.includes('<audio'));
  assert.ok(!html.includes('data-media-filter="color"')&&!html.includes('data-media-filter="loop"'));
  f.w.host.fxCatalog=()=>({tokenReady:false,presets:[]});f.library.items=[];
  assert.match(f.library.html(f.draft),/Turn on token filters in Animater settings/);
});
test('refresh drops disabled token provider but keeps its favorites and updates only library',async()=>{
  const f=tokenLibraryFixture(),id=f.library.selectedId;let updates=0;
  f.library.prefs.favorites=[id];f.library.render=()=>{updates++;};f.w.host.fxCatalog=()=>({tokenReady:false,presets:[]});
  f.w.host.loadMediaCatalog=async()=>({entries:[]});await f.library.load(true);
  assert.ok(!f.library.items.some(v=>v.type==='tokenfx'));assert.deepEqual(f.library.prefs.favorites,[id]);
  assert.equal(updates,1);assert.equal(f.renders,0);
});
test('preset preview controls and selection cancel only their own audition without workspace render',async()=>{
  const f=tokenLibraryFixture();let stopped=0,finish,played;
  f.w.host.previewTokenFx=stage=>{played=stage;return{done:new Promise(resolve=>{finish=resolve;}),stop:async()=>{stopped++;finish();}};};
  const running=f.library.auditionTokenFx('canvas');await new Promise(resolve=>setImmediate(resolve));
  assert.equal(played.fxPreset,'fire');assert.equal(played.duration,3000);assert.match(f.library.fxStatus,/Playing on canvas/);
  f.library.input({dataset:{mediaFx:'duration'},value:'5500'});await running;
  assert.equal(stopped,1);assert.equal(f.library.tokenFx.duration,5500);assert.equal(f.renders,0);
  const again=f.library.auditionTokenFx('canvas');await new Promise(resolve=>setImmediate(resolve));
  f.library.choose(f.library.items.find(v=>v.type==='image').id);await again;
  assert.equal(stopped,2);assert.equal(f.library.fxHandle,null);
});
test('late preview handle and immediate Stop both honor cancellation before a provider settles',async()=>{
  const f=tokenLibraryFixture();let complete,stopped=0,calls=0;
  f.w.host.previewTokenFx=()=>{calls++;return new Promise(resolve=>{complete=resolve;});};
  const pending=f.library.auditionTokenFx('canvas');await new Promise(resolve=>setImmediate(resolve));
  await f.library.stopTokenPreview();complete({done:Promise.resolve(),stop:async()=>{stopped++;}});await pending;
  assert.equal(stopped,1);assert.equal(f.library.fxHandle,null);
  const instant=f.library.auditionTokenFx('canvas');await f.library.stopTokenPreview();await instant;
  assert.equal(calls,1,'Stop before starting must not apply a filter later');
});

function windowTokenFixture(t) {
  const f=tokenLibraryFixture(),frames=new Map(),native={ready:async()=>{},draw(){},stop(){stops++;}};
  let stops=0,canvasCalls=0,index=0;
  const oldFrame=globalThis.requestAnimationFrame,oldCancel=globalThis.cancelAnimationFrame;
  globalThis.requestAnimationFrame=cb=>{frames.set(++index,cb);return index;};
  globalThis.cancelAnimationFrame=id=>frames.delete(id);
  t.after(()=>{globalThis.requestAnimationFrame=oldFrame;globalThis.cancelAnimationFrame=oldCancel;});
  const scene={dataset:{},querySelectorAll:()=>[]};
  f.w.root.querySelector=selector=>selector==='[data-media-fx-scene]'?scene:null;
  f.w.root.querySelectorAll=()=>[];
  f.w.host.createTokenFxPreview=async(s,r)=>{assert.equal(s,scene);f.w.previewRecipe=r;return native;};
  f.w.host.previewTokenFx=()=>{canvasCalls++;throw Error('Canvas must stay untouched');};
  return {...f,scene,native,frames,get stops(){return stops;},get canvasCalls(){return canvasCalls;}};
}

test('Tokenshade card click starts window preview; selecting it again replays without rendering workspace',async t=>{
  const f=windowTokenFixture(t),settle=()=>new Promise(resolve=>setImmediate(resolve));
  const preset=f.library.selectedId;
  await f.library.action('media-inspect',{dataset:{id:preset}});await settle();
  assert.match(f.library.fxStatus,/Playing in window/);assert.equal(f.frames.size,1);assert.equal(f.canvasCalls,0);
  [...f.frames.values()][0](performance.now()+4000);await settle();
  assert.match(f.library.fxStatus,/Playing in window/,'the card keeps playing past the stage duration');assert.equal(f.stops,0);
  assert.equal(f.w.previewRecipe.stages[0].duration>=60000,true);
  await f.library.action('media-inspect',{dataset:{id:preset}});await settle();
  assert.match(f.library.fxStatus,/Playing in window/);assert.equal(f.renders,0);
  await f.library.stopTokenPreview();await settle();assert.equal(f.stops,2);
});

test('changing preview duration and tint restarts card audition once and preserves recipe settings',async t=>{
  const f=windowTokenFixture(t),settle=()=>new Promise(resolve=>setImmediate(resolve));let starts=0;
  const create=f.w.host.createTokenFxPreview;f.w.host.createTokenFxPreview=(...args)=>{starts++;return create(...args);};
  await f.library.action('media-inspect',{dataset:{id:f.library.selectedId}});await settle();
  f.library.input({dataset:{mediaFx:'duration'},value:'5500'});await settle();
  assert.equal(starts,2);assert.equal(f.stops,1);assert.match(f.library.fxStatus,/Playing in window/);
  f.library.input({dataset:{mediaFx:'tintEnabled'},checked:true});await settle();
  f.library.input({dataset:{mediaFx:'tint'},value:'#11aaff'});await settle();
  const before=starts;f.library.input({dataset:{mediaFx:'tint'},value:'#11aaff'});await settle();
  assert.equal(starts,before,'input/change events carrying the same value must not restart twice');
  assert.equal(f.w.previewRecipe.stages[0].fxTint,'#11aaff');assert.equal(f.original.stages.length,1);assert.equal(f.renders,0);
  await f.library.stopTokenPreview();await settle();
});

test('sample-token audition uses native window renderer without a scene or canvas backend, then disposes it',async t=>{
  const f=windowTokenFixture(t);
  f.library.tokenFx.subject='targets';
  const running=f.library.auditionTokenFx();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(f.w.previewRecipe.stages[0].subject,'source');
  assert.equal(f.library.tokenFx.subject,'targets','Sample preview must not change stage placement');
  assert.match(f.library.fxStatus,/Playing in window/);assert.equal(f.canvasCalls,0);
  await f.library.action('media-favorite',{dataset:{id:f.library.selectedId}});
  assert.equal(f.renders,0);assert.ok(f.library.fxHandle,'Favorite preserves playing shader');
  [...f.frames.values()][0](performance.now()+4000);await new Promise(resolve=>setImmediate(resolve));
  assert.ok(f.library.fxHandle,'still playing after the stage duration');
  await f.library.stopTokenPreview();await running;
  assert.equal(f.stops,1);assert.equal(f.library.fxHandle,null);
});

test('changing a library preset cancels a pending window renderer before it loads or touches the canvas',async t=>{
  const f=windowTokenFixture(t);let complete,ready=0;
  f.native.ready=async()=>{ready++;};
  f.w.host.createTokenFxPreview=()=>new Promise(resolve=>{complete=resolve;});
  const running=f.library.auditionTokenFx();await new Promise(resolve=>setImmediate(resolve));
  f.library.choose(f.library.items.find(item=>item.type==='image').id);
  complete(f.native);await running;
  assert.equal(ready,0);assert.equal(f.stops,1);assert.equal(f.frames.size,0);assert.equal(f.canvasCalls,0);
});

test('image preparation reports Starting and a canceled card cannot start its clock after loading',async t=>{
  const f=windowTokenFixture(t);let complete;
  f.native.ready=()=>new Promise(resolve=>{complete=resolve;});
  const running=f.library.auditionTokenFx();await new Promise(resolve=>setImmediate(resolve));
  assert.match(f.library.fxStatus,/Starting preview/);assert.equal(f.frames.size,0);
  await f.library.stopTokenPreview();complete();await running;
  assert.equal(f.frames.size,0);assert.equal(f.library.fxHandle,null);assert.equal(f.canvasCalls,0);
});

test('a shader failing its first draw reports the error immediately and never leaves a scheduled clock',async t=>{
  const f=windowTokenFixture(t);
  f.native.draw=()=>{f.scene.dataset.fxError='Unsupported Token Magic filter: missing';};
  await f.library.auditionTokenFx();
  assert.match(f.library.fxStatus,/Unsupported Token Magic filter.*Use canvas preview/);
  assert.equal(f.frames.size,0);assert.equal(f.stops,1);
});

test('window shader errors release the renderer and offer canvas fallback without applying native filters',async t=>{
  const f=windowTokenFixture(t);
  let fail=false;
  f.native.draw=()=>{if(fail)f.scene.dataset.fxError='Canvas-only Token Magic filter: distortion';};
  const running=f.library.auditionTokenFx();await new Promise(resolve=>setImmediate(resolve));
  fail=true;
  // Errors must stop the first failed frame, not wait until the whole duration.
  const [id,tick]=[...f.frames.entries()][0];f.frames.delete(id);tick(performance.now()+100);
  await new Promise(resolve=>setImmediate(resolve));
  assert.match(f.library.fxStatus,/Use canvas preview/);assert.equal(f.stops,1);assert.equal(f.canvasCalls,0);
  assert.equal(f.frames.size,0);
  await running;
});
test('inserting sound adds a draft stage with actual duration; replacing sound removes optional pack binding',async()=>{
  const f=libraryFixture();
  f.library.choose(f.library.items.find(v=>v.type==='audio').id);
  await f.library.action('media-add',{dataset:{}});
  assert.equal(f.draft.stages.length,2);assert.equal(f.draft.stages[1].kind,'sound');assert.equal(f.draft.stages[1].duration,2400);
  assert.equal(f.original.stages.length,1);assert.equal(f.saves,0);assert.equal(f.w.page,'recipes');
  f.draft.stages[1].optionalSound={profile:'old'};
  f.library.choose(f.library.items.filter(v=>v.type==='audio')[1].id);
  await f.library.action('media-apply',{dataset:{}});
  assert.ok(!f.draft.stages[1].optionalSound);assert.ok(f.draft.stages[1].soundFile.endsWith('02.ogg'));
});
test('asset replacement preserves placement and timing; exact file variation survives validation',async()=>{
  const f=libraryFixture();f.library.choose(f.library.items.find(v=>v.type==='animation').id);
  f.library.file='modules/jb2a/ray_30ft_1600x400.webm';
  const before={kind:f.draft.stages[0].kind,delay:f.draft.stages[0].delay,duration:f.draft.stages[0].duration};
  await f.library.action('media-apply',{dataset:{}});
  assert.deepEqual({...before},Object.fromEntries(Object.keys(before).map(k=>[k,f.draft.stages[0][k]])));
  assert.equal(validateRecipe(f.draft).stages[0].assets[0],f.library.file);
  f.w.page='assets';f.library.filter('search','ward');f.library.html(f.draft);
  assert.equal(f.library.file,null);
});
test('library collections sanitize malformed preferences and retain favorites independently of active pack',()=>{
  assert.deepEqual(libraryPreferences(null),{favorites:[],recent:[],custom:[],sources:[]});
  const prefs=libraryPreferences({favorites:['x','x',null],recent:['gone'],custom:[null,{file:'../unsafe.png'},{file:'worlds/w/custom.png'}]});
  assert.deepEqual(prefs.favorites,['x']);assert.equal(prefs.custom.length,1);assert.deepEqual(prefs.recent,['gone']);
});
test('adding an effect uses native cast stage and leaves prior animation intact',async()=>{
  const f=libraryFixture();f.library.choose(f.library.items.find(v=>v.type==='image').id);
  await f.library.action('media-add',{dataset:{}});
  assert.equal(f.draft.stages.length,2);assert.equal(f.draft.stages[1].kind,'cast');
  assert.equal(f.draft.stages[1].assets[0],'other.ward.gold');assert.equal(f.original.stages.length,1);
  assert.doesNotThrow(()=>validateRecipe(f.draft));
});
test('sound-card click auditions one cue; changing type clears incompatible source and disables audio looping',async()=>{
  const f=libraryFixture();let plays=0,stops=0;
  const audio={tagName:'AUDIO',paused:true,play:async()=>{plays++;audio.paused=false;},pause:()=>{stops++;audio.paused=true;}};
  f.w.root.querySelector=selector=>selector==='[data-library-preview]'?audio:null;f.w.root.querySelectorAll=()=>[audio,{pause:()=>{stops++;}}];
  f.library.filters.source='jb2a';f.library.filter('type','audio');
  assert.equal(f.library.filters.source,'all');assert.equal(f.library.preview.loop,false);
  await f.library.action('media-inspect',{dataset:{id:f.library.items.find(v=>v.type==='audio').id}});
  assert.equal(plays,1);assert.equal(stops,1);
  await f.library.action('media-inspect',{dataset:{id:f.library.selectedId}});
  assert.equal(plays,1);assert.equal(stops,2);
});
test('workspace media clicks update the library without rendering the whole workspace',async()=>{
  const f=libraryFixture();
  f.w.mediaLibrary=f.library;f.w.busy=false;
  let libraryUpdates=0;
  f.library.render=()=>{libraryUpdates++;};
  f.w.root.querySelectorAll=()=>[];
  const click=async dataset=>Workspace.prototype.onClick.call(f.w,{
    target:{closest:()=>({dataset,disabled:false,setAttribute(){}})},preventDefault(){}
  });
  const id=f.library.items.find(v=>v.type==='animation').id;
  await click({action:'media-inspect',id});
  await click({action:'media-favorite',id});
  await click({action:'media-preview-loop'});
  await click({action:'media-view',value:'list'});
  await click({action:'media-collection',value:'favorites'});
  assert.ok(f.library.prefs.favorites.includes(id));
  assert.equal(f.library.preview.loop,false);
  assert.equal(f.library.view,'list');
  assert.equal(f.library.filters.collection,'favorites');
  assert.equal(f.renders,0,'media controls must not call Workspace.render');
  assert.ok(libraryUpdates>0,'changed library results must still update');
});
test('media search and filters update results locally, repeated active controls do nothing',async()=>{
  const f=libraryFixture();let updates=0,inspections=0;
  f.library.render=()=>{updates++;};f.library.inspect=id=>{inspections++;f.library.choose(id);};
  f.w.root.querySelectorAll=()=>[];
  f.library.input({dataset:{search:'assets'},value:'r'});
  f.library.input({dataset:{search:'assets'},value:'ray'});
  // Typing settles first: one search, after the pause.
  await new Promise(r=>setTimeout(r,200));
  assert.equal(f.library.filters.search,'ray');
  const target={dataset:{mediaFilter:'color'},value:'blue'};
  f.library.change(target);f.library.change(target);
  assert.equal(updates,2);
  await f.library.action('media-type',{dataset:{value:'animation'}});
  await f.library.action('media-collection',{dataset:{value:'all'}});
  await f.library.action('media-view',{dataset:{value:'grid'}});
  f.library.choose(f.library.items.find(v=>v.type==='animation').id);
  await f.library.action('media-inspect',{dataset:{id:f.library.selectedId}});
  assert.equal(updates,2);assert.equal(inspections,0);assert.equal(f.renders,0);
});
test('async media refresh patches only the library after discovery completes',async()=>{
  const f=libraryFixture();let updates=0,loads=0;
  f.library.render=()=>{updates++;};
  f.w.host.loadMediaCatalog=async()=>{loads++;return {entries:registeredMedia(database())};};
  await f.library.load();await f.library.load();
  assert.equal(loads,1);assert.equal(updates,1);assert.equal(f.renders,0);
  await f.library.load(true);
  assert.equal(loads,2);assert.equal(updates,2);assert.equal(f.renders,0);
});
test('native runtime sends non-JB2A visuals and exact variation files through Sequencer with original beam metadata',async()=>{
  const calls=[];
  const section=new Proxy({}, {get:(_,name)=>(...args)=>{calls.push([name,...args]);return section;}});
  const sequence={effect:()=>section,play:async()=>{}};
  const runtime=new AnimaterRuntime({database:database(),soundCatalog:()=>null,ready:()=>true,canPlay:()=>true,userId:()=> 'qa',gridSize:()=>100,sequence:()=>sequence});
  runtime.wait=async()=>true;
  await runtime.play({id:'other',name:'Other',trigger:'manual',stages:[{kind:'cast',assets:['other.ward.gold'],duration:100}]},{source:{center:{x:0,y:0}}},{preview:true});
  assert.ok(calls.some(c=>c[0]==='file'&&c[1]==='other.ward.gold'));
  calls.length=0;
  await runtime.play({id:'file',name:'File',trigger:'manual',stages:[{kind:'cast',assets:['modules/jb2a/ray_30ft_1600x400.webm'],duration:100}]},{source:{center:{x:0,y:0}}},{preview:true});
  assert.ok(calls.some(c=>c[0]==='file'&&c[1]==='modules/jb2a/ray_30ft_1600x400.webm'));
});

const sizedVariant = (size,color,version='001') => libraryItem({
  key:`jb2a.ball_bearing.top.${version}.${size}.${color}`,
  file:`modules/jb2a/ball_${version}_${size}_${color}_600x600.webm`,source:'jb2a',
});

test('color and size choices preserve each other and prefer the selected style/version',()=>{
  const variants=['1x1','2x2'].flatMap(size=>['blue','brown','multicolored'].flatMap(color=>['001','002'].map(version=>sizedVariant(size,color,version))));
  const selected=variants.find(v=>v.key==='jb2a.ball_bearing.top.002.2x2.blue');
  const brown=matchingMediaVariant(variants,selected,{color:'brown'});
  assert.equal(brown.key,'jb2a.ball_bearing.top.002.2x2.brown');
  assert.equal(matchingMediaVariant(variants,brown,{size:'1x1'}).key,'jb2a.ball_bearing.top.002.1x1.brown');
  assert.equal(variants.find(v=>v.key.endsWith('multicolored')).color,'multicolored');
  assert.deepEqual(mediaVariantChoices(variants,selected).variants.map(v=>v.key),[
    'jb2a.ball_bearing.top.001.2x2.blue','jb2a.ball_bearing.top.002.2x2.blue',
  ]);
});

test('unavailable color/size combinations stay disabled; video pixel dimensions are not asset size variants',()=>{
  const variants=[sizedVariant('1x1','blue'),sizedVariant('2x2','blue'),sizedVariant('1x1','brown')];
  const selected=variants[2],choices=mediaVariantChoices(variants,selected);
  assert.equal(choices.sizes.find(v=>v.value==='2x2').available,false);
  assert.equal(matchingMediaVariant(variants,selected,{size:'2x2'}),null);
  assert.equal(variantSize(libraryItem({key:'jb2a.cast.blue',file:'modules/jb2a/cast_600x600.webm'})), '');
  assert.equal(variantSize(libraryItem({file:'modules/jb2a/image_600x600.png'})), '');
  assert.equal(variantSize(libraryItem({key:'jb2a.ambient_fog.001.complete.large.blue',file:'modules/jb2a/fog_1200x1200.webm'})), 'large');
  const fogSizes=['large','small'].map(size=>libraryItem({key:`jb2a.ambient_fog.001.complete.${size}.blue`,file:`modules/jb2a/fog_${size}_1200x1200.webm`}));
  assert.deepEqual(mediaVariantChoices(fogSizes,fogSizes[0]).sizes.map(v=>v.value),['small','large']);
  const f=libraryFixture();f.library.items=variants;f.library.choose(selected.id);
  const html=f.library.detail(selected,null,f.draft);
  assert.match(html,/data-action="media-size" data-value="2x2"[^>]*disabled/);
  assert.match(html,/aria-label="Asset color"/);
  assert.match(html,/aria-label="Asset size"/);
  assert.doesNotMatch(html,/data-media-variant/,'color/size pairs need no combined dropdown');
});

test('size/color button changes only media selection; applying uses the selected database variant',async()=>{
  const f=libraryFixture();
  f.library.items=['1x1','2x2'].flatMap(size=>['blue','brown'].map(color=>sizedVariant(size,color)));
  f.library.choose(f.library.items[0].id);
  let inspections=0;
  f.library.inspect=id=>{inspections++;f.library.choose(id);};
  await f.library.action('media-size',{dataset:{value:'2x2'}});
  await f.library.action('media-color',{dataset:{value:'brown'}});
  assert.equal(f.library.selected.key,'jb2a.ball_bearing.top.001.2x2.brown');
  assert.equal(f.renders,0);assert.equal(f.draft.stages[0].assets[0],'other.ward.gold');
  await f.library.action('media-size',{dataset:{value:'2x2'}});
  assert.equal(inspections,2,'clicking the current size is a no-op');
  await f.library.action('media-apply',{dataset:{}});
  assert.equal(f.draft.stages[0].assets[0],'jb2a.ball_bearing.top.001.2x2.brown');
  assert.doesNotThrow(()=>validateRecipe(f.draft));
});

test('separate visual variants leave sound takes selectable',()=>{
  const f=libraryFixture(),sounds=f.library.items.filter(v=>v.type==='audio');
  f.library.choose(sounds[1].id);
  const html=f.library.detail(sounds[1],{variants:sounds},f.draft);
  assert.match(html,/data-media-variant/);
  assert.match(html,/ice-hit-01\.ogg/);assert.match(html,/ice-hit-02\.ogg/);
  assert.doesNotMatch(html,/data-action="media-size"|aria-label="Asset color"/);
});

test('size selection preserves a compatible color filter without rebuilding results',async()=>{
  const f=libraryFixture();let updates=0;f.library.render=()=>{updates++;};
  f.library.items=['1x1','2x2'].flatMap(size=>['blue','brown'].map(color=>sizedVariant(size,color)));
  f.library.choose(f.library.items[0].id);f.library.filters.color='blue';
  await f.library.action('media-size',{dataset:{value:'2x2'}});
  assert.equal(f.library.selected.key,'jb2a.ball_bearing.top.001.2x2.blue');
  assert.equal(f.library.filters.color,'blue');assert.equal(updates,0);
  await f.library.action('media-color',{dataset:{value:'brown'}});
  assert.equal(f.library.selected.key,'jb2a.ball_bearing.top.001.2x2.brown');
  assert.equal(f.library.filters.color,'all');assert.equal(updates,1);assert.equal(f.renders,0);
});
test('style and version picks are chip rows: each varying part of the key, closest variant per chip',()=>{
 const v=(key)=>({id:key,key,label:key,color:'blue'});
 const items=['jb2a.magic_signs.circle.02.abjuration.loop.blue','jb2a.magic_signs.circle.02.abjuration.intro.blue','jb2a.magic_signs.circle.02.necromancy.loop.blue','jb2a.magic_signs.circle.02.necromancy.intro.blue','jb2a.magic_signs.circle.01.abjuration.blue','jb2a.magic_signs.rune.02.complete.01.blue','jb2a.magic_signs.rune.02.loop.01.blue'].map(v);
 const rows=mediaVariantFacets(items,items[0]);
 assert.deepEqual(rows.map(r=>r.label),['Style','Version','School','Playback']);
 assert.deepEqual(rows[0].chips.map(c=>[c.value,c.selected]),[['circle',true],['rune',false]]);
 assert.equal(rows[2].chips.find(c=>c.value==='necromancy').id,'jb2a.magic_signs.circle.02.necromancy.loop.blue','switching school keeps loop playback');
 assert.equal(rows[3].chips.find(c=>c.value==='intro').id,'jb2a.magic_signs.circle.02.abjuration.intro.blue');
 assert.equal(rows[1].chips.find(c=>c.value==='01').label,'1');
 assert.deepEqual(mediaVariantFacets([items[0]],items[0]),[],'a single variant shows no rows');
});

test('browsing does not fill Recent; only an applied asset counts as used', () => {
  const f = libraryFixture();
  const id = f.library.items.find((v) => v.type === 'animation').id;
  f.library.prefs.recent = [];
  f.library.choose(id);
  assert.deepEqual(f.library.prefs.recent, []);
  f.library.remember(f.library.items.find((v) => v.id === id));
  assert.equal(f.library.prefs.recent[0], id);
});

test('an empty stage opens on its track\'s category, shown as a chip that clears it', async () => {
  const f = libraryFixture();
  f.draft.stages[0].assets = [];
  f.w.recipe = () => f.draft; f.w.stageIndex = 0; f.w.render = () => {}; f.w.root.querySelector = () => null;
  f.library.open('animation');
  assert.equal(f.library.filters.category, 'Casting');
  assert.match(f.library.html(f.draft), /data-action="media-clear-auto"[^>]*>Casting for this stage ✕/);
  await f.library.action('media-clear-auto', { dataset: {} });
  assert.equal(f.library.filters.category, 'all');
});

test('a dark effect previews on a light background until you choose one', () => {
  const f = libraryFixture();
  const dark = f.library.items.find((v) => v.type === 'animation' && ['blue', 'purple', 'black', 'grey', 'darkpurple'].includes(v.color));
  assert.ok(dark, 'the fixture has a dark animation');
  f.library.selectedId = dark.id;
  const bg = () => /an-media-detail-body[\s\S]*?class="an-media-preview" data-background="(\w+)"/.exec(f.library.detail(dark, null, f.draft))?.[1];
  assert.equal(bg(), 'light', dark.color);
  f.library.preview.backgroundChosen = true; f.library.preview.background = 'dark';
  assert.equal(bg(), 'dark', 'your choice wins');
});
