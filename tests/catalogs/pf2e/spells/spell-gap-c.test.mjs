import test from 'node:test';
import assert from 'node:assert/strict';
import {GAP_C_MOTIFS,GAP_C_DESIGNS,gapCLayers} from '../../../../scripts/catalogs/pf2e/spells/spell-gap-c.mjs';
import {MOTIONS} from '../../../../scripts/core/model.mjs';

function layers(slug,mediaDuration=6800){
 const id=GAP_C_DESIGNS[slug][0];
 const motif=GAP_C_MOTIFS[id];
 return gapCLayers({id:slug,delivery:motif.delivery??'target',design:{motif:id,mediaTiming:Object.fromEntries(['cast','bolt','hit','aura','area'].map(k=>[k,{duration:mediaDuration}]))}}, {
  subject:'targets',
  fx:(kind,slot,label,delay,duration,extra)=>({kind,slot,label,delay,duration,...extra}),
  copy:(label,delay,duration,extra)=>({kind:'sprite',label,delay,duration,...extra}),
  pose:(motion,label,delay,duration,subject,distance)=>({kind:'motion',motion,label,delay,duration,subject,distance}),
  track:(property,from,to,duration)=>({property,from,to,duration}),
 });
}
test('Gap C has 297 explicit spell records with meaningful media roots',()=>{
 assert.equal(Object.keys(GAP_C_DESIGNS).length,297);
 for(const [slug,[id,rationale]]of Object.entries(GAP_C_DESIGNS)){
  assert.equal(rationale,'');
  assert.equal(id,`gapC-${slug}`);
  assert(GAP_C_MOTIFS[id]);
  for(const slot of ['cast','bolt','hit','aura','area']){
   assert.equal(typeof GAP_C_MOTIFS[id][slot],'string');
   assert(!GAP_C_MOTIFS[id][slot].includes(','),`${slug}/${slot}: multiple node families`);
  }
  for(const root of Object.values(GAP_C_MOTIFS[id]).filter(x=>typeof x==='string'))assert(!/cast_generic|^impact(?:[.,]|$)/.test(root));
  assert(layers(slug).length>0);
 }
});
test('Delayed mechanics and capability grants stay stationary',()=>{
 for(const slug of ['rubble-step','shattering-gem','rewinding-step','spell-turning','spellsurge','time-beacon','time-skip','tree-of-seasons','winning-streak','water-breathing','water-walk','wild-winds-stance','stoke-the-heart','vital-luminance']){
  const stages=layers(slug);
  assert(!stages.some(s=>s.kind==='motion'&&slug!=='wild-winds-stance'),slug);
  assert(!stages.some(s=>['projectile','travel'].includes(s.kind)),slug);
 }
 assert(!layers('suspended-retribution').some(s=>s.label.includes('Strike')));
 assert(!layers('weapon-of-judgment').some(s=>s.kind==='travel'||s.kind==='projectile'));
});
test('Walls preserve line footprint and compatible linear/tiled layout',()=>{
 for(const [slug,[id]]of Object.entries(GAP_C_DESIGNS).filter(([slug])=>slug.startsWith('wall-of-'))){
  const motif=GAP_C_MOTIFS[id];
  assert.equal(motif.previewArea.type,'line',slug);
  const stage=layers(slug).find(s=>s.slot==='area');
  assert.equal(stage.kind,'template',slug);
  assert.equal(stage.areaLayout,motif.pattern==='lineTiles'?'tiles':'fit',slug);
 }
});
test('Mental and material cone fans use bolt geometry with actual fan delivery',()=>{
 for(const slug of ['shatter-mind','shockwave','thunderous-strike','trim-the-blight','utter-destruction','vitrifying-blast','wave-of-despair']){
  const motif=GAP_C_MOTIFS[GAP_C_DESIGNS[slug][0]];
  assert.equal(motif.pattern,'coneObjectFan',slug);
  const fan=layers(slug).find(s=>s.areaLayout==='fan');
  assert.equal(fan.slot,'bolt',slug);
  assert.equal(fan.travelDestination,'area',slug);
  assert.equal(fan.kind,'projectile',slug);
 }
 assert(layers('vampiric-exsanguination').some(s=>s.kind==='travel'&&s.travelOrigin==='target'));
 assert(!layers('vampiric-exsanguination').some(s=>s.areaLayout==='fan'));
});
test('Complete selected films remain readable including slower playback',()=>{
 for(const slug of Object.keys(GAP_C_DESIGNS))for(const stage of layers(slug)){
  if(['motion','sprite'].includes(stage.kind))continue;
  assert(stage.duration>=(6800/(stage.playbackRate??1)),`${slug}: ${stage.label}`);
 }
});
test('Immediate cosmetic gestures use supported motion names',()=>{
 for(const slug of Object.keys(GAP_C_DESIGNS))for(const stage of layers(slug).filter(s=>s.kind==='motion'))assert(MOTIONS[stage.motion],`${slug}: ${stage.motion}`);
});
test('Ritual imagery invokes subjects without success or failure enactment',()=>{
 for(const slug of ['transmigrate','resurrect','rest-eternal','rite-of-the-red-star','still-life-storage','statuette','shadow-double','split-shadow','wish','seed-of-mercy','secure-siege-weapons']){
  const stages=layers(slug);
  assert(!stages.some(s=>['motion','sprite','projectile'].includes(s.kind)),slug);
  assert(!stages.some(s=>/resurrected|transmigrated|dies|failure|success|destroyed|teleported/i.test(s.label)),slug);
 }
 assert(layers('transmigrate').some(s=>s.label==='Upright heron feathers'));
 assert(layers('transmigrate').some(s=>s.label==='Clay beds'));
});
