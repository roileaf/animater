import test from 'node:test';
import assert from 'node:assert/strict';
import {installedMediaLibrary,MediaLibraryLoader} from '../../../scripts/engines/media/media-library-sources.mjs';
import {mediaFolderSources,mediaGroups} from '../../../scripts/engines/media/media-library-model.mjs';
import {MediaLibrary,libraryPreferences} from '../../../scripts/ui/media-library.mjs';
import {validateRecipe,planRecipe} from '../../../scripts/core/model.mjs';

const root='modules/bossloot/assets';
const folders=[{path:root,name:'BossLoot'}];
const browse=async path=>path===root
  ? {dirs:[`${root}/spells`,`${root}/spells`,'modules/other',`${root}/../private`,`${root}/node_modules`],files:[`${root}/ward.png`,`${root}/hit.ogg`,`${root}/index.js`,'modules/other/leak.webm']}
  : {dirs:[],files:[`${root}/spells/fire_loop.webm`,`${root}/spells/ice.mp4`]};

test('unregistered folder source discovers nested visuals and audio, filters by name and produces playable file recipes',async()=>{
  const progress=[],calls=[];
  const result=await installedMediaLibrary({folderSources:folders,onProgress:part=>progress.push(...part.entries),browse:async path=>{calls.push(path);return browse(path);}});
  assert.deepEqual(calls,[root,`${root}/spells`]);
  assert.equal(result.entries.length,4);assert.equal(result.warning,'');
  assert.ok(result.entries.every(item=>item.source==='BossLoot'));
  assert.deepEqual(progress.map(item=>item.id).sort(),result.entries.map(item=>item.id).sort());
  const matches=mediaGroups(result.entries,{type:'animation',source:'BossLoot',search:'fire'});
  assert.equal(matches.count,1);
  const item=matches.groups[0].variants[0];
  assert.equal(item.loop,true);
  const recipe=validateRecipe({id:'boss',name:'Boss',trigger:'manual',stages:[{kind:'cast',assets:[item.file]}]});
  assert.equal(planRecipe(recipe,result.entries,{source:{center:{x:0,y:0}},targets:[]})[0].asset,item.file);
});

test('folder discovery preserves registered variants and their database metadata without duplicate loose files',async()=>{
  const file=`${root}/spells/fire_loop.webm`;
  const database={searchFor:()=>['bossloot'],getPathsUnder:()=>['bossloot.fire.blue'],getAllFileEntries:()=>[file],getEntry:()=>({getFile:()=>file,template:[100,200,300]})};
  const result=await installedMediaLibrary({database,folderSources:folders,browse});
  const rows=result.entries.filter(item=>item.files.includes(file));
  assert.equal(rows.length,1);assert.equal(rows[0].key,'bossloot.fire.blue');
  assert.deepEqual(rows[0].template,[100,200,300]);
});

test('folder preferences reject invalid roots, deduplicate paths and retain custom names',()=>{
  assert.deepEqual(mediaFolderSources([null,{path:''},{path:'/'},{path:'../secret'},{path:'modules/x/../secret'},{path:'https://bad.test/assets'},{path:'C:\\assets'},{path:'modules/x?bad'},{path:'modules/.git'}]),[]);
  assert.deepEqual(libraryPreferences({sources:[{path:root+'/',name:'Old'},{path:root,name:' BossLoot '}]}).sources,folders);
  assert.equal(mediaFolderSources([{path:'worlds/demo/My Assets'}])[0].name,'My Assets');
});

test('adding, renaming and removing folder sources invalidate cached discovery; Refresh finds new files',async()=>{
  let folderSources=[],files=[],calls=0;
  const loader=new MediaLibraryLoader(()=>({folderSources,browse:async()=>{calls++;return {dirs:[],files};}}));
  await loader.load();assert.equal(calls,0);
  folderSources=folders;files=[`${root}/first.webm`];assert.equal(loader.peek(),null);
  const first=await loader.load();assert.equal(first.entries.length,1);
  assert.equal(await loader.load(),first);assert.equal(calls,1);
  files.push(`${root}/second.webm`);assert.equal((await loader.load(true)).entries.length,2);
  folderSources=[{path:root,name:'Renamed'}];assert.equal(loader.peek(),null);
  assert.ok((await loader.load()).entries.every(row=>row.source==='Renamed'));
  folderSources=[];assert.equal(loader.peek(),null);assert.equal((await loader.load()).entries.length,0);
});

test('folder scan reports permission errors and exact folder budget instead of silently dropping assets',async()=>{
  const limited=await installedMediaLibrary({folderSources:folders,browse,maxFolders:1});
  assert.equal(limited.discovery.folders,1);assert.equal(limited.discovery.limitReached,true);
  assert.match(limited.warning,/Media indexing reached folder limit/);
  const failed=await installedMediaLibrary({folderSources:folders,browse:async()=>{throw Error('Permission denied');}});
  assert.match(failed.warning,/BossLoot|modules\/bossloot\/assets/);assert.match(failed.warning,/Permission denied/);
});

test('source controls persist folders, refresh named results and remove indexing without changing recipe',async()=>{
  let prefs=libraryPreferences(),picked;
  const recipe=validateRecipe({id:'existing',name:'Existing',trigger:'manual',stages:[{kind:'cast',assets:[`${root}/ward.png`]}]});
  const before=structuredClone(recipe);
  const host={catalog:()=>[],mediaPreferences:()=>prefs,setMediaPreferences:async value=>{prefs=libraryPreferences(value);},pickMediaFolder:callback=>{picked=callback;},loadMediaCatalog:()=>installedMediaLibrary({folderSources:prefs.sources,browse})};
  const w={host,page:'recipes',root:{querySelector:selector=>selector==='[data-media-source-name]'?{value:'BossLoot'}:null},recipe:()=>recipe,stageLabel:stage=>stage.kind,stageIndex:0,abort:new AbortController()};
  const library=new MediaLibrary(w);library.render=()=>{};
  assert.match(library.html(recipe),/Add folder/);
  await library.action('media-source-add',{dataset:{}});await picked(root);
  assert.deepEqual(prefs.sources,folders);assert.equal(library.filters.source,'BossLoot');
  assert.equal(library.results().count,2);
  assert.match(library.html(recipe),/Remove BossLoot folder source/);
  const reopened=new MediaLibrary(w);assert.deepEqual(reopened.prefs.sources,folders);
  await library.action('media-source-remove',{dataset:{path:root}});
  assert.deepEqual(prefs.sources,[]);assert.equal(library.items.filter(i=>i.source!=='Animater').length,0,'only the bundled sounds remain');
  assert.deepEqual(recipe,before);
});

test('failed preference save leaves source state unchanged and canceled picker cannot add a source',async()=>{
  let picked;
  const abort=new AbortController();
  const library=new MediaLibrary({host:{catalog:()=>[],pickMediaFolder:callback=>{picked=callback;},setMediaPreferences:async()=>{throw Error('Save failed');}},root:{querySelector:()=>null},abort});
  library.render=()=>{};
  await library.action('media-source-add',{dataset:{}});await picked(root);
  assert.deepEqual(library.prefs.sources,[]);assert.equal(library.error,'Save failed');
  abort.abort();library.error='';await picked(root);
  assert.deepEqual(library.prefs.sources,[]);assert.equal(library.error,'');
});

// Issue #3: Foundry's browse answers URL-encoded paths ("My%20Sounds/..."); the picker hands back the folder as typed.
test('a folder source with spaces in its name indexes its files and subfolders',async()=>{
  const calls=[];
  const result=await installedMediaLibrary({folderSources:[{path:'My Sounds',name:'Mine'}],browse:async path=>{
    calls.push(path);
    return path==='My Sounds'?{dirs:['My%20Sounds/Big%20Hits'],files:['My%20Sounds/zap%20one.ogg']}:{dirs:[],files:['My%20Sounds/Big%20Hits/boom.ogg']};
  }});
  assert.deepEqual(calls,['My Sounds','My%20Sounds/Big%20Hits']);
  assert.deepEqual(result.entries.map(item=>item.file).sort(),['My%20Sounds/Big%20Hits/boom.ogg','My%20Sounds/zap%20one.ogg']);
});

// Issue #3: Add and Remove stay usable while the library is still indexing, and the change is indexed once that scan ends.
test('folder sources can be added and removed while a scan is running',async()=>{
  let prefs=libraryPreferences(),picked,release;
  const scans=[];
  const host={catalog:()=>[],mediaPreferences:()=>prefs,setMediaPreferences:async value=>{prefs=libraryPreferences(value);},pickMediaFolder:callback=>{picked=callback;},
    loadMediaCatalog:async()=>{const sources=prefs.sources.map(s=>s.path);scans.push(sources);if(scans.length===1)await new Promise(r=>{release=r;});return installedMediaLibrary({folderSources:prefs.sources,browse});}};
  const w={host,page:'assets',root:{querySelector:selector=>selector==='[data-media-source-name]'?{value:'BossLoot'}:null},recipe:()=>null,stageLabel:stage=>stage.kind,stageIndex:0,abort:new AbortController()};
  const library=new MediaLibrary(w);library.render=()=>{};
  const first=library.load();
  assert.equal(library.loading,true);
  assert.match(library.sourceControls(),/data-action="media-source-add" >\+ Add folder/,'Add stays enabled while indexing');
  await library.action('media-source-add',{dataset:{}});
  assert.ok(picked,'the folder picker opens while indexing');
  const adding=picked(root);
  release();await first;await adding;
  assert.deepEqual(scans,[[],[root]],'the added folder is indexed after the running scan');
  assert.equal(library.results().count,2);
  assert.equal(library.loading,false);
});

test('the folder source name typed by the user survives a re-render',()=>{
  const library=new MediaLibrary({host:{catalog:()=>[],pickMediaFolder:()=>{}},root:{querySelector:()=>null},abort:new AbortController()});
  library.input({dataset:{mediaSourceName:''},hasAttribute:name=>name==='data-media-source-name',value:'Boss Loot'});
  assert.match(library.sourceControls(),/data-media-source-name[^>]*value="Boss Loot"/);
});

// Issue #3: the index survives a world reload; a new client finds it in the store and does not rescan.
test('the media index is saved and reused after a reload until something it depends on changes or Refresh is pressed',async()=>{
  const saved=new Map(),store={get:async key=>saved.get(key)??null,set:async(key,result)=>{saved.set(key,structuredClone(result));}};
  let calls=0,folderSources=folders;
  const options=()=>({folderSources,browse:async path=>{calls++;return browse(path);}});
  const first=await new MediaLibraryLoader(options,{store}).load();
  assert.equal(first.entries.length,4);const scanned=calls;assert.ok(scanned>0);
  const progress=[];
  const reloaded=new MediaLibraryLoader(options,{store});
  const again=await reloaded.load(false,part=>progress.push(...part.entries));
  assert.equal(calls,scanned,'a reloaded client reuses the saved index');
  assert.equal(again.entries.length,4);assert.equal(progress.length,4,'the saved entries reach the library as progress');
  assert.equal(reloaded.peek()?.entries.length,4);
  await reloaded.load(true);assert.ok(calls>scanned,'Refresh rescans');
  const afterRefresh=calls;
  folderSources=[{path:root,name:'Renamed'}];await new MediaLibraryLoader(options,{store}).load();
  folderSources=folders;await new MediaLibraryLoader(options,{store}).load();
  assert.equal(calls,afterRefresh+2,'a changed folder list rescans; the saved index for it is reused');
});

test('a failing media index store never stops a scan',async()=>{
  const store={get:async()=>{throw Error('blocked');},set:async()=>{throw Error('quota');}};
  const result=await new MediaLibraryLoader(()=>({folderSources:folders,browse}),{store}).load();
  assert.equal(result.entries.length,4);
});
