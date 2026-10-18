import test from 'node:test';
import assert from 'node:assert/strict';
import {PF2E_SPELLS,spellRecipe} from '../../scripts/catalogs/pf2e/spells/spell-catalog.mjs';
import {planRecipe} from '../../scripts/core/model.mjs';
import {effectIdentity} from '../../tools/spell-identity-audit.mjs';
import {spellCastingEvidence} from '../../tools/spell-variety-allocation.mjs';
import {diversifySpellMedia} from '../../tools/spell-media-variety.mjs';
import {readFile} from 'node:fs/promises';
const get=name=>PF2E_SPELLS.find(s=>s.name===name);
const visual=recipe=>recipe.stages.filter(s=>!['motion','sound'].includes(s.kind)).map(s=>({
 kind:s.kind,subject:s.subject,assets:s.assets,origin:s.travelOrigin,destination:s.travelDestination,
 copies:s.copies,tracks:s.tracks?.map(t=>({property:t.property,from:t.from,to:t.to,loop:t.loop})),
}));
test('reported fear relatives have distinct effects even without motion or sound',()=>{
 const names=['Dread Secret','Fear','Fear the Sun','Fearful Feast','Friends to Foes','Hollow Heart'];
 const compositions=names.map(name=>JSON.stringify(visual(spellRecipe(get(name),undefined,{motion:false,sound:false}))));
 assert.equal(new Set(compositions).size,names.length,'timing, label and scale differences do not establish a distinct animation');
});
test('Fearful Feast draws confidence from recipient back to caster',()=>{
 const recipe=spellRecipe(get('Fearful Feast'));
 const source={id:'caster',center:{x:0,y:0},w:100,h:100},target={id:'victim',center:{x:300,y:0},w:100,h:100};
 const rows=[...new Set(recipe.stages.flatMap(s=>s.assets))].map(key=>({key,file:`${key}.webm`}));
 const returning=planRecipe(recipe,rows,{source,targets:[target],gridSize:100}).find(s=>s.kind==='travel'&&s.travelOrigin==='target');
 assert.ok(returning);assert.equal(returning.origin,target);assert.equal(returning.endpoint,source);
 assert.ok(!recipe.stages.some(s=>/heal|restore hp/i.test(s.label)),'save-dependent healing must not be shown unconditionally');
});
test('Fear the Sun depicts vision sensitivity instead of death bells',()=>{
 const spell=get('Fear the Sun');
 assert.equal(spell.design.motif,'solarSensitivity');
 assert.ok(!spellRecipe(spell).stages.some(s=>s.assets.some(a=>/toll_the_dead|arms_of_hadar/.test(a))));
});
test('reviewed life drain and spiritual support travel in opposite directions',()=>{
 const source={id:'caster',center:{x:0,y:0},w:100,h:100},target={id:'recipient',center:{x:300,y:0},w:100,h:100};
 for(const [name,origin,endpoint,theme] of [['Devour Life',target,source,'void'],['Spirit Link',source,target,'spirit']]){
  const spell=get(name),recipe=spellRecipe(spell,undefined,{sound:false});
  const rows=[...new Set(recipe.stages.flatMap(s=>s.assets))].map(key=>({key,file:`${key}.webm`}));
  const travel=planRecipe(recipe,rows,{source,targets:[target],gridSize:100}).find(s=>s.kind==='travel');
  assert.ok(travel,name);assert.equal(spell.theme,theme);
  assert.equal(travel.origin,origin,name);assert.equal(travel.endpoint,endpoint,name);
 }
});
test('stabilization and prepared healing do not play immediate wound restoration',()=>{
 for(const name of ['Stabilize','Fated Healing']){
  const recipe=spellRecipe(get(name),undefined,{sound:false});
  assert.ok(!recipe.stages.some(s=>s.kind==='motion'),name);
  assert.ok(!recipe.stages.some(s=>s.mediaSlot!=='cast'&&s.assets.some(k=>/healing_generic|cure_wounds/.test(k))),name);
 }
});
test('preparing life links and delayed healing plays when cast rather than waiting for later healing dice',()=>{
 for(const name of ['Spirit Link','Fated Healing','Life Pact','Life Connection','Vital Beacon'])
  assert.equal(get(name).trigger,'use',name);
});
test('tentacular and defensive weapon attempts require the native target rather than a self-only pose',()=>{
 for(const name of ['Tentacular Innervation','Warding Aggression']){
  const spell=get(name),recipe=spellRecipe(spell,undefined,{sound:false});
  assert.equal(spell.delivery,'melee',name);assert.equal(spell.design.spellAttack,false,name);
  assert.ok(recipe.stages.some(s=>s.kind==='impact'),name);
  assert.ok(recipe.stages.some(s=>s.kind==='motion'&&s.subject==='source'),name);
 }
});
test('Safe Passage tiles protection signs across a full ten-foot-wide corridor',async()=>{
 const spell=get('Safe Passage'),recipe=spellRecipe(spell,undefined,{sound:false});
 assert.equal(recipe.previewArea.type,'line');assert.equal(recipe.previewArea.value,60);assert.equal(recipe.previewArea.width,10);
 const audit=JSON.parse(await readFile(new URL('../../data/pf2e-spell-variety-audit.json',import.meta.url),'utf8'));
 for(const rows of Object.values(audit.editionAssets)){
  const keys=new Set(rows.map(row=>row.key));
  const corridor=recipe.stages.find(stage=>stage.kind==='template'&&stage.label==='Protective passage signs along the corridor');
  assert.equal(corridor.areaLayout,'tiles');
  assert.match(corridor.assets.find(key=>keys.has(key)),/magic_signs.*abjuration/);
 }
});
test('identity auditing ignores labels, timing, scale, sounds and token motion',()=>{
 const rows=[{key:'jb2a.test',file:'effect.webm'}],r={stages:[{kind:'cast',assets:['jb2a.test'],stageId:'one',label:'A',delay:0,duration:1000,scale:1}]};
 const changed=structuredClone(r);Object.assign(changed.stages[0],{label:'Different spell',delay:900,duration:3000,scale:2});
 changed.stages.push({kind:'motion',motion:'shake'},{kind:'sound',soundFile:'sound.ogg'});
 changed.stages.push({kind:'cast',assets:['jb2a.test'],opacity:0,tracks:[{property:'position.x',from:-1,to:1}]});
 assert.equal(effectIdentity(r,rows),effectIdentity(changed,rows));
 assert.equal(effectIdentity(r,rows),effectIdentity({stages:[{...r.stages[0],below:false,repeats:1,repeatScope:'perTarget'}]},rows));
 assert.equal(effectIdentity(r,[{key:'jb2a.test',file:'effect_400x400.webm'}]),effectIdentity(r,[{key:'jb2a.test',file:'effect_1200x1200.webm'}]));
 changed.stages[0].tracks=[{property:'position.y',from:.5,to:-.5}];
 assert.notEqual(effectIdentity(r,rows),effectIdentity(changed,rows));
});
test('creature is not a creation cue and casting evidence records its native words',()=>{
 assert.equal(spellCastingEvidence('A creature loses all confidence.').preferred.includes('bloom'),false);
 assert.ok(spellCastingEvidence('You create a glowing ring.').preferred.includes('bloom'));
});
test('numbered media diversity preserves geometry, color, edition priority and pinned art',()=>{
 const row=key=>({key,file:`${key}_400x400.webm`});
 const patreon=['jb2a.cast_generic.01.purple','jb2a.cast_generic.02.purple','jb2a.cast_generic.01.yellow','jb2a.cast_generic.02.yellow'].map(row);
 const free=patreon.filter(r=>r.key.includes('yellow'));
 const spells=Array.from({length:4},(_,i)=>({id:String(i),name:String(i),slug:String(i),design:{motif:'generic',assets:{cast:['jb2a.cast_generic.01.purple','jb2a.cast_generic.01.yellow']}}}));
 diversifySpellMedia(spells,{patreon,free},{generic:{}});
 assert.ok(spells.every(s=>s.design.assets.cast[0].endsWith('purple')),'Free fallback must not erase the Patreon color');
 assert.equal(new Set(spells.map(s=>s.design.assets.cast[0])).size,2);
 const pinned=structuredClone(spells);pinned.forEach(s=>s.design.assets.cast=['jb2a.cast_generic.01.purple']);
 diversifySpellMedia(pinned,{patreon,free},{generic:{cast:'cast_generic.01'}});
 assert.ok(pinned.every(s=>s.design.assets.cast[0]==='jb2a.cast_generic.01.purple'));
 const sharedRows=['jb2a.cast_generic.01.blue','jb2a.cast_generic.02.blue','jb2a.cast_generic.03.blue'].map(row);
 const shared=Array.from({length:3},(_,i)=>({id:String(i),name:String(i),slug:String(i),design:{motif:'generic',assets:{cast:['jb2a.cast_generic.01.blue','jb2a.cast_generic.02.blue']}}}));
 const changes=diversifySpellMedia(shared,{patreon:sharedRows,free:sharedRows.slice(1)},{generic:{}});
 for(const change of changes.variants.filter(v=>v.edition==='patreon'))
  assert.equal(shared.find(s=>s.id===change.id).design.assets.cast[0],change.to,'Free selection cannot override a recorded Patreon decision');
});
test('ready PF2e compositions match the audited identity count; shared native films are reported honestly',async()=>{
 const audit=JSON.parse(await readFile(new URL('../../data/pf2e-spell-variety-audit.json',import.meta.url),'utf8'));
 const ready=PF2E_SPELLS.filter(s=>!s.design.unavailable);
 assert.equal(audit.entries,ready.length);
 for(const [edition,rows] of Object.entries(audit.editionAssets)){
  const fingerprints=new Map();
  for(const spell of ready){
   const recipe=spellRecipe(spell,undefined,{motion:false,sound:false});
   const key=effectIdentity(recipe,rows);
   if(fingerprints.has(key))assert.ok(audit.sharedNativeCompositions.some(s=>s.id===spell.id||s.id===fingerprints.get(key).id),`${edition}: ${spell.name} has unreported shared native footage`);
   fingerprints.set(key,spell);
  }
  assert.equal(fingerprints.size,audit.distinct[edition]);
 }
});
