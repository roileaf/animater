import test from 'node:test';
import assert from 'node:assert/strict';
import {MediaLibrary} from '../../../scripts/ui/media-library.mjs';
import {libraryItem, mergeMedia, appendMedia, words, mediaType, assetColor} from '../../../scripts/engines/media/media-library-model.mjs';

// libraryItem memoizes its derived text by value. These pin that a memo hit is the same row a cold
// call gives, and that an entry mutated in place never gets the row of its old values.
const entry=()=>({key:'jb2a.fire_bolt.orange',file:'modules/jb2a/Library/Cantrip/Fire_Bolt/FireBolt_01_Regular_Orange_30ft.webm',source:'jb2a'});

test('an entry mutated in place derives its new values, not the memoized old ones',()=>{
  const row=entry(),first=libraryItem(row);
  assert.equal(first.color,'orange');assert.match(first.search,/fire bolt/);
  Object.assign(row,{key:'jb2a.ray_of_frost.blue',file:'modules/jb2a/Library/Cantrip/Ray_Of_Frost/RayOfFrost_01_Regular_Blue_30ft.webm',source:'Changed',family:'Frost Ray'});
  const after=libraryItem(row);
  assert.deepEqual(after,libraryItem(structuredClone(row)));
  assert.equal(after.color,'blue');assert.equal(after.family,'Frost Ray');assert.equal(after.label,'Frost Ray');
  assert.match(after.search,/ray of frost/);assert.match(after.search,/changed/);assert.doesNotMatch(after.search,/fire/);
  row.files=['../escape.webm',row.file.replace('30ft','60ft')];
  assert.deepEqual(libraryItem(row).files,[row.file,row.file.replace('30ft','60ft')]);
});

test('repeated merges give equal, separate rows; a row may be edited without touching later merges',()=>{
  const rows=[entry(),{file:'modules/sfx/Loop_Rain.ogg',type:'audio',source:'SFX'},{file:'icons/x.png',family:'F',label:'L',category:'C'}];
  const first=mergeMedia(rows),second=mergeMedia(rows);
  assert.deepEqual(second,first);
  first.forEach((item,i)=>assert.notEqual(item,second[i]));
  first[0].search='edited';first[0].files.push('x.webm');
  assert.deepEqual(mergeMedia(rows)[0],second[0]);
  assert.deepEqual(appendMedia([],rows),second);
});

test('re-normalizing a normalized row matches the raw row, and a different given family wins',()=>{
  const raw=entry(),normal=libraryItem(raw);
  assert.deepEqual(libraryItem(normal),normal);
  const renamed=libraryItem({...normal,family:'Other'});
  assert.equal(renamed.family,'Other');assert.match(renamed.search,/other/);
  const family=libraryItem({...raw,family:undefined}).family;
  assert.equal(family,normal.family);
});

test('the same file under a different key, source or type is a different row',()=>{
  const base=entry();
  const a=libraryItem(base),b=libraryItem({...base,source:'JB2A Patreon'}),c=libraryItem({...base,key:'jb2a.fire_bolt.blue'});
  assert.match(b.search,/jb2a patreon/);assert.doesNotMatch(a.search,/patreon/);
  assert.equal(c.color,'blue');assert.notEqual(a.category,undefined);
  const audio=libraryItem({file:'modules/sfx/hit.webm',type:'audio'});
  assert.equal(audio.type,'audio');assert.equal(audio.id,'audio:modules/sfx/hit.webm');
  assert.equal(libraryItem({file:'modules/sfx/hit.webm',type:'image'}),null);
});

test('text helpers keep their results',()=>{
  assert.equal(words('a_ b'),'a b');assert.equal(words(' x  _-/ y '),'x y');assert.equal(words('camelCaseX'),'camel Case X');
  assert.equal(words(null),'');assert.equal(words(3),'3');
  assert.equal(mediaType('a.OGG'),'audio');assert.equal(mediaType('.ogg'),'audio');assert.equal(mediaType('dir.webm/file'),null);
  assert.equal(mediaType('noext'),null);assert.equal(mediaType('a.b.c.webm'),'animation');assert.equal(mediaType({toString:()=>'q.png'}),'image');
  assert.equal(assetColor('jb2a.bolt.dark_red','x.webm'),'red');assert.equal(assetColor('jb2a.bolt.darkred.blue',''),'darkred');assert.equal(assetColor('',''),'none');
});

test('a catalog entry mutated after the browser opened shows its new values once loading ends',async()=>{
  const row=entry();
  const w={page:'recipes',host:{catalog:()=>[row],loadMediaCatalog:async()=>({entries:[]})},root:{querySelector:()=>null},abort:new AbortController()};
  const library=new MediaLibrary(w);
  assert.equal(library.items[0].color,'orange');
  row.key='jb2a.fire_bolt.green';row.source='Edited';
  await library.load();
  const item=library.items.find(v=>v.id===row.key);
  assert.equal(item.color,'green');assert.equal(item.source,'Edited');assert.match(item.search,/edited/);
  assert.ok(!library.items.some(v=>v.id==='jb2a.fire_bolt.orange'));
});
