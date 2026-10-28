import test from 'node:test';
import assert from 'node:assert/strict';
import * as sources from '../../../scripts/engines/media/media-library-sources.mjs';
import {MediaLibrary} from '../../../scripts/ui/media-library.mjs';
import {mergeMedia} from '../../../scripts/engines/media/media-library-model.mjs';

const settle=()=>new Promise(resolve=>setImmediate(resolve));
const modules=()=>new Map([['soundfxlibrary',{active:true,version:'1'}]]);
const db=()=>({searchFor:()=>['audio'],getPathsUnder:()=>['audio.first'],getAllFileEntries:()=>['modules/soundfxlibrary/first.ogg'],getEntry:()=>null});

test('registered media publishes before slow folder browsing completes; streamed files match final inventory',async()=>{
  let release;const gate=new Promise(resolve=>release=resolve),progress=[];
  const run=sources.installedMediaLibrary({modules:modules(),database:db(),onProgress:part=>progress.push(part),browse:async()=>{await gate;return {files:['modules/soundfxlibrary/second.ogg'],dirs:[]};}});
  await settle();assert.ok(progress.some(p=>p.entries.some(e=>e.file.endsWith('/first.ogg'))),'known media must be usable before disk scan finishes');
  release();const result=await run;
  assert.ok(progress.some(p=>p.entries.some(e=>e.file.endsWith('/second.ogg'))));
  assert.deepEqual(mergeMedia(...progress.map(p=>p.entries)).map(e=>e.id).sort(),result.entries.map(e=>e.id).sort());
});

test('discovery reuses completed results across windows; Refresh and provider/database changes rescan',async()=>{
  const active=modules(),database=db();let calls=0;
  const loader=new sources.MediaLibraryLoader(()=>({modules:active,database,browse:async()=>{calls++;return {files:[],dirs:[]};}}));
  assert.equal(loader.peek(),null);
  const first=await loader.load();assert.equal(loader.peek(),first);
  assert.equal(await loader.load(),first);assert.equal(calls,1);
  await loader.load(true);assert.equal(calls,2);
  database.getPathsUnder=()=>['audio.first','audio.second'];assert.equal(loader.peek(),null);
  await loader.load();assert.equal(calls,3);
  active.get('soundfxlibrary').active=false;assert.equal(loader.peek(),null);
  const disabled=await loader.load();assert.equal(disabled.discovery.folders,0);
});

test('two windows share one in-flight scan and both receive known and discovered media',async()=>{
  let release,calls=0;const gate=new Promise(resolve=>release=resolve),first=[],second=[];
  const loader=new sources.MediaLibraryLoader(()=>({modules:modules(),database:database,browse:async()=>{calls++;await gate;return {files:['modules/soundfxlibrary/last.ogg'],dirs:[]};}}));
  const database=db();
  const a=loader.load(false,p=>first.push(...p.entries)),b=loader.load(false,p=>second.push(...p.entries));
  await settle();assert.equal(calls,1);assert.ok(first.length&&second.length);
  release();const [ar,br]=await Promise.all([a,b]);assert.equal(ar,br);
  assert.ok(first.some(e=>e.file.endsWith('/last.ogg')));assert.ok(second.some(e=>e.file.endsWith('/last.ogg')));
});

test('cache state supports Foundry collections whose iterator yields values, and legacy namespace discovery',async()=>{
  const active=modules();active[Symbol.iterator]=()=>active.values();
  let registered=false;
  const database={entryExists:()=>registered,getPathsUnder:()=>registered?['jb2a.blue']:[],getAllFileEntries:()=>['modules/jb2a/blue.webm'],getEntry:()=>null};
  const loader=new sources.MediaLibraryLoader(()=>({modules:active,database}));
  await loader.load();assert.ok(loader.peek());registered=true;assert.equal(loader.peek(),null);
  const result=await loader.load();assert.ok(result.entries.some(e=>e.key==='jb2a.blue'));
  active.get('soundfxlibrary').version='2';assert.equal(loader.peek(),null);
});

test('pages reuse grouped search results; new search, collection or inventory invalidates them',()=>{
  const catalog=Array.from({length:100},(_,i)=>({key:`custom.spell_${i}.blue`,file:`modules/custom/spell_${i}_blue.webm`}));
  const w={host:{catalog:()=>catalog},root:{querySelector:()=>null},stageIndex:0,recipe:()=>null};
  const library=new MediaLibrary(w);library.filters.search='blue';library.html(null);
  const first=library.groups;library.page=1;library.html(null);assert.equal(library.groups,first);
  library.filters.search='spell 25';library.html(null);assert.notEqual(library.groups,first);
  assert.equal(library.groups.length,1);
  library.filters.search='';library.filters.collection='favorites';library.prefs.favorites=[library.items[0].id];library.html(null);
  const favorite=library.groups;library.prefs.favorites=[library.items[1].id];library.html(null);assert.notEqual(library.groups,favorite);
  library.filters.collection='all';library.items=library.items.slice(0,3);library.html(null);assert.equal(library.groups.length,3);
});

test('cached discovery opens a new browser without reading and normalizing native catalogs again',async()=>{
  const cached=await sources.installedMediaLibrary({modules:modules(),database:db()});
  const library=new MediaLibrary({host:{mediaCatalog:()=>cached,catalog:()=>{throw Error('No re-enumeration');},soundCatalog:()=>{throw Error('No sound re-enumeration');}},root:{querySelector:()=>null}});
  assert.equal(library.loaded,true);assert.equal(library.items.filter(i=>i.source!=='Animater').length,cached.entries.length);
  assert.equal(library.items[0],cached.entries[0]);
});

test('progressive loading exposes sounds and repaints before the full scan; leaving Assets prevents later repaint',async t=>{
  const frames=new Map();let index=0,progress,complete,renders=0;
  const oldFrame=globalThis.requestAnimationFrame,oldCancel=globalThis.cancelAnimationFrame;
  globalThis.requestAnimationFrame=fn=>{frames.set(++index,fn);return index;};globalThis.cancelAnimationFrame=id=>frames.delete(id);
  t.after(()=>{globalThis.requestAnimationFrame=oldFrame;globalThis.cancelAnimationFrame=oldCancel;});
  const w={page:'assets',host:{catalog:()=>[],loadMediaCatalog:(_refresh,onProgress)=>{progress=onProgress;return new Promise(resolve=>complete=resolve);}},root:{querySelector:()=>null},abort:new AbortController()};
  const library=new MediaLibrary(w);library.filters.type='audio';library.render=()=>renders++;
  const pending=library.load();progress({entries:[{file:'modules/soundfxlibrary/first.ogg',type:'audio'}]});
  assert.equal(library.items.filter(i=>i.source!=='Animater').length,1);assert.equal(library.loading,true);
  const [id,paint]=[...frames.entries()][0];frames.delete(id);paint();assert.equal(renders,1);
  w.page='recipes';progress({entries:[{file:'modules/soundfxlibrary/last.ogg',type:'audio'}]});
  assert.equal(frames.size,0);assert.equal(library.items.filter(i=>i.source!=='Animater').length,2);
  complete({entries:library.items,normalized:true});await pending;assert.equal(renders,1);assert.equal(library.loaded,true);
});

test('new background audio updates counts while preserving an active Token Magic audition',async()=>{
  let progress,complete;
  const w={page:'assets',host:{catalog:()=>[],loadMediaCatalog:(_r,p)=>{progress=p;return new Promise(resolve=>complete=resolve);}},root:{querySelector:()=>null},abort:new AbortController()};
  const library=new MediaLibrary(w);library.filters.type='tokenfx';library.fxHandle={stop:()=>{throw Error('Do not stop the visible filter');}};
  const pending=library.load();progress({entries:[{file:'modules/soundfxlibrary/first.ogg',type:'audio'}]});
  assert.ok(library.fxHandle);w.abort.abort();complete({entries:library.items,normalized:true});await pending;
});
