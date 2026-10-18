import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {GAP_A_MOTIFS,GAP_A_DESIGNS,gapALayers} from '../../../../scripts/catalogs/pf2e/spells/spell-gap-a.mjs';

function recipe(slug,{subject='targets',delivery='target',duration=24000}={}){
 const motif=GAP_A_DESIGNS[slug][0],m=GAP_A_MOTIFS[motif];
 const fx=(kind,slot,label,delay,duration,extra={})=>({kind,slot,label,delay,duration,...extra});
 const copy=(label,delay,duration,extra={})=>({kind:'sprite',label,delay,duration,...extra});
 const track=(property,from,to,duration,extra={})=>({property,from,to,duration,...extra});
 return gapALayers({id:slug,slug,delivery:m.delivery??delivery,design:{...m,motif,mediaTiming:Object.fromEntries(['hit','aura','area','bolt'].map(slot=>[slot,{duration}]))}},{fx,copy,track,subject,pattern:m.pattern});
}

test('gap A keeps 300 explicit hash-reviewed spell designs',async()=>{
 const review=JSON.parse(await readFile(new URL('../../../../docs/spell-gap-a-review.json',import.meta.url),'utf8'));
 assert.equal(review.length,300);
 assert.equal(Object.keys(GAP_A_DESIGNS).length,300);
 for(const item of review){
  assert.match(item.descriptionHash,/^[a-f0-9]{64}$/);
  assert.match(item.sourceHash,/^[a-f0-9]{64}$/);
  assert.ok(item.descriptionChars>0,item.slug);
  assert.deepEqual(GAP_A_DESIGNS[item.slug],[item.motif,'']);
  for(const roots of Object.values(item.materials))assert.doesNotMatch(roots,/(?:^|,)(?:cast_generic|impact|magic_signs\.circle)(?:[.,]|$)/);
 }
});

test('gap A preserves complete body and object movies without game-state motion',()=>{
 for(const slug of Object.keys(GAP_A_DESIGNS)){
  const stages=recipe(slug);
  assert.ok(stages.length,slug);
  assert.ok(stages.every(s=>s.kind!=='motion'),slug);
  assert.ok(stages.every(s=>s.kind==='sprite'||s.duration>=24000/(s.playbackRate??1)),`${slug}: movie truncated`);
 }
});

test('delayed fire trail, mental mine and elemental tempest stay prepared',()=>{
 for(const slug of ['burning-trail','animus-mine','elemental-tempest','electrostatic-glider','euphoric-renewal']){
  const stages=recipe(slug,{subject:'source'});
  assert.ok(stages.every(s=>!['template','travel','projectile','motion'].includes(s.kind)),slug);
  assert.equal(GAP_A_MOTIFS[GAP_A_DESIGNS[slug][0]].castingOnly,true);
 }
});

test('bone volleys use directional fans; mist and color fans fly radial artwork',()=>{
 for(const slug of ['bone-spray','bony-barrage']){
  const stages=recipe(slug,{delivery:'cone'});
  assert.ok(stages.some(s=>s.kind==='travel'&&s.areaLayout==='fan'&&s.slot==='hit'));
 }
 for(const slug of ['ancient-dust','dizzying-colors','feral-shades']){
  const stages=recipe(slug,{delivery:'cone'});
  assert.ok(stages.some(s=>s.kind==='projectile'&&s.areaLayout==='fan'));
  assert.ok(stages.every(s=>s.kind!=='travel'));
 }
 assert.ok(recipe('crashing-wave',{delivery:'cone'}).some(s=>s.kind==='template'&&s.slot==='area'));
});

test('grave and vine spans retain their native linear dimensions with radial tiles',()=>{
 for(const [slug,value,width] of [['bridge-of-graves',120,10],['bridge-of-vines',60,10],['bonewall-bulwark',10,1]]){
  const m=GAP_A_MOTIFS[GAP_A_DESIGNS[slug][0]];
  assert.deepEqual(m.previewArea,{type:'line',value,width});
  assert.equal(m.areaLayout,'tiles');
  assert.ok(recipe(slug,{delivery:'line'}).every(s=>s.kind==='template'&&s.areaLayout==='tiles'));
 }
});

test('knowledge avatar stays shoulder-sized and corpse remains an illustration',()=>{
 const avatar=recipe('fact-check',{subject:'source'}).find(s=>s.kind==='sprite');
 assert.equal(avatar.scale,.2);
 assert.equal(avatar.offsetY,-.3);
 const corpse=recipe('drop-dead').find(s=>s.kind==='sprite');
 assert.equal(corpse.rotation,90);
 assert.ok(recipe('drop-dead').every(s=>s.kind!=='motion'));
});
