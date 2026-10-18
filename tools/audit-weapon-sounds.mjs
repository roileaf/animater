// Deep inventory/semantic/phase audit. References only; no audio is bundled.
import {readFile,readdir,writeFile,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {PF2E_WEAPONS,PF2E_WEAPON_SOURCE,weaponRecipe} from '../scripts/catalogs/pf2e/weapons/weapon-catalog.mjs';
import {PF2E_FEATS,featRecipe} from '../scripts/catalogs/pf2e/feats/feat-catalog.mjs';
import {PF2E_SPELLS,spellRecipe} from '../scripts/catalogs/pf2e/spells/spell-catalog.mjs';
import {SOUND_PROFILES,SPELL_SOUND_DESIGNS,installedSoundCatalog} from '../scripts/engines/sound/spell-sounds.mjs';
import {ABILITY_SOUND_PROFILES,FEAT_SOUND_DESIGNS,WEAPON_SOUND_DESIGNS} from '../scripts/engines/sound/ability-sounds.mjs';
import {soundInventory} from './sound-databases.mjs';
import {weaponSources} from './pf2e-weapon-source.mjs';
import {analyzeWeapon} from './weapon-semantics.mjs';
import {descriptionText} from './spell-semantics.mjs';
import {soundDirection} from './spell-sound-semantics.mjs';
import {featSoundDirection,weaponSoundDirection} from './ability-sound-semantics.mjs';
import {assetDatabases} from './asset-databases.mjs';
import {assetGeometry} from './spell-asset-selection.mjs';
import {planRecipe,MAX_STAGES} from '../scripts/core/model.mjs';
import {timedStages} from '../scripts/engines/playback/composition.mjs';
import {repeatStride} from '../scripts/core/stage-options.mjs';
const exec=promisify(execFile),sha=PF2E_WEAPON_SOURCE.sha;
const hash=text=>createHash('sha256').update(text).digest('hex');
const output=process.argv.find(a=>a.startsWith('--output='))?.slice(9)??'data/deep-weapon-sound-audit.json';
const levels=process.argv.includes('--probe-audio');
const [source,{entries,packs},databases]=await Promise.all([weaponSources(),soundInventory(),assetDatabases()]);
const sourceById=new Map(source.weapons.map(r=>['weapon:'+r.source._id,r.source]));
// Cached official descriptions are keyed by Git blob SHA, not item slug. Index
// their document IDs without refetching or substituting installed system data.
const cache=path.join(tmpdir(),'animater-pf2e-source',sha),files=(await readdir(cache)).filter(n=>n.endsWith('.json'));let cursor=0;
await Promise.all(Array.from({length:12},async()=>{while(cursor<files.length){const source=JSON.parse(await readFile(path.join(cache,files[cursor++]),'utf8'));if(['spell','feat'].includes(source.type))sourceById.set(source.type+':'+source._id,source);}}));
const dbFiles=new Map();
for(const entry of entries)if(entry.key)dbFiles.set(entry.key,[...(dbFiles.get(entry.key)??[]),entry.file]);
const registered={entryExists:key=>dbFiles.has(key),getAllFileEntries:key=>dbFiles.get(key)};
const configurations=[[],...packs.map(p=>[p.module]),packs.map(p=>p.module)];
const catalogs=configurations.map(active=>({active,catalog:installedSoundCatalog(new Map(active.map(m=>[m,{active:true}])),registered)}));
const allCatalog=catalogs.at(-1).catalog;
const candidates=new Map();
for(const profiles of [SOUND_PROFILES,ABILITY_SOUND_PROFILES])for(const[profile,cues]of Object.entries(profiles))for(const cue of cues)for(const candidate of cue.candidates){const key=candidate.module+':'+candidate.file;const prior=candidates.get(key);candidates.set(key,{...candidate,profiles:[...new Set([...(prior?.profiles??[]),profile])]});}
const issues=[],audioEvidence=[];let nextAudio=0;
const candidateRows=[...candidates.values()];
await Promise.all(Array.from({length:6},async()=>{while(nextAudio<candidateRows.length){const candidate=candidateRows[nextAudio++],full=path.resolve('..','..',candidate.file),row={...candidate,exactFileExists:false,activeDatabaseResolves:Boolean(allCatalog.resolve(candidate))};try{row.exactFileExists=(await stat(full)).isFile();if(levels){const duration=await exec('ffprobe',['-v','error','-show_entries','format=duration','-of','csv=p=0',full],{windowsHide:true});row.nativeDuration=Math.ceil(Number(duration.stdout.trim())*1000);const probe=await exec('ffmpeg',['-hide_banner','-nostats','-threads','1','-i',full,'-af','volumedetect','-f','null','-'],{windowsHide:true});row.meanDb=Number(probe.stderr.match(/mean_volume:\s*(-?[\d.]+)/)?.[1]);row.peakDb=Number(probe.stderr.match(/max_volume:\s*(-?[\d.]+)/)?.[1]);if(!Number.isFinite(row.nativeDuration)||row.nativeDuration<=0)issues.push({kind:'audio',file:candidate.file,type:'invalid-duration'});}}catch(error){issues.push({kind:'audio',file:candidate.file,type:'missing-or-unplayable',message:error.message});}if(!row.activeDatabaseResolves)issues.push({kind:'audio',file:candidate.file,type:'registered-candidate-does-not-resolve'});audioEvidence.push(row);}}));
const context={source:{id:'source',center:{x:100,y:100},document:{width:1,height:1}},targets:[{id:'target',center:{x:400,y:100},document:{width:1,height:1}},{id:'other',center:{x:800,y:100},document:{width:1,height:1}}],gridSize:100,gridDistance:5,template:{id:'area',center:{x:400,y:100}},area:{type:'circle',shape:'burst',center:{x:400,y:100},diameter:600}};
const families=assets=>assets.map(k=>k.replace(/\.(?:blue|white|purple|green|yellow|orange|red|pink|dark_[a-z]+|[a-z]+yellow|[a-z]+purple)\b/g,'').replace(/\.\d{2,3}(?=\.|$)/g,''));
const structural=stages=>JSON.stringify(stages.filter(s=>s.kind!=='sound').map(s=>({kind:s.kind,media:families(s.assets??[]),motion:s.motion,subject:s.subject,repeats:s.repeats,scope:s.repeatScope,origin:s.travelOrigin,area:s.areaLayout})));
const rows={weapon:PF2E_WEAPONS.flatMap(item=>item.modes.map(mode=>({item,mode:mode.mode,direction:WEAPON_SOUND_DESIGNS[`${item.id}:${mode.mode}`],build:sounds=>weaponRecipe(item,mode.mode,{sounds})}))),feat:PF2E_FEATS.map(item=>({item,direction:FEAT_SOUND_DESIGNS[item.id],build:sounds=>featRecipe(item,{sounds})})),spell:PF2E_SPELLS.map(item=>({item,direction:SPELL_SOUND_DESIGNS[item.id],build:sounds=>spellRecipe(item,undefined,{sounds})}))};
const evidence=[],summaries={};
for(const[kind,items]of Object.entries(rows)){
 const signatures=new Map(),selectedAudio=new Set(),selectedVisual=Object.fromEntries(Object.keys(databases).map(e=>[e,new Set()]));const activeCounts={};
 for(const{item,mode,direction,build}of items){
  const original=sourceById.get(kind+':'+item.id),raw=original?.system?.description?.value??'',descriptionHash=hash(raw),recipe=build(allCatalog),timed=timedStages(recipe),audio=recipe.stages.filter(s=>s.kind==='sound'),modeData=mode?item.modes.find(m=>m.mode===mode):null;
  const record={kind,id:item.id,name:item.name,mode,sourceDescriptionHash:descriptionHash,sourceDescriptionChars:descriptionText(raw).length,fullDescriptionMatched:Boolean(direction?.descriptionHash&&descriptionHash.startsWith(direction.descriptionHash)),profile:direction?.profile||'',soundReason:direction?.reason??'',visualStages:recipe.stages.filter(s=>s.kind!=='sound').map(s=>({kind:s.kind,label:s.label,assets:s.assets,motion:s.motion,delay:s.delay,repeats:s.repeats,scale:s.scale})),audioStages:audio.map(s=>({label:s.label,file:s.soundFile,provider:s.optionalSound?.candidates[0]?.module,anchor:s.afterStage,delay:timed.find(t=>t.stageId===s.stageId)?.delay,duration:s.duration,repeats:s.repeats,stride:repeatStride(s),volume:s.volume})),activePackAvailability:{}};
  if(!original)issues.push({kind,name:item.name,mode,type:'missing-native-source'});
  if(!record.fullDescriptionMatched)issues.push({kind,name:item.name,mode,type:'description-hash-mismatch'});
  let expectedProfile=kind==='spell'?soundDirection(item,original??{}).profile:kind==='feat'?featSoundDirection(item).profile:weaponSoundDirection(item,modeData).profile;
  if(kind==='weapon'){
   const elements={fire:'fire',cold:'cold',electricity:'electric',acid:'acid',poison:'poison',void:'void',vitality:'holy',mental:'psychic',sonic:'sonic'},element=elements[modeData.element];
   if(modeData.mode==='thrown'&&['spear','dagger'].includes(expectedProfile))expectedProfile=expectedProfile==='spear'?'thrownSpear':'thrownDagger';
   if(modeData.group==='bomb'&&SOUND_PROFILES[element])expectedProfile='bomb-'+modeData.element;
   else if(element&&ABILITY_SOUND_PROFILES[expectedProfile]&&SOUND_PROFILES[element])expectedProfile='enchanted-'+expectedProfile+'-'+modeData.element;
  }
  if(expectedProfile!==(direction?.profile??''))issues.push({kind,name:item.name,mode,type:'sound-decision-stale',expected:expectedProfile,actual:direction?.profile});
  if(recipe.stages.length>MAX_STAGES)issues.push({kind,name:item.name,mode,type:'stage-budget'});
  if(item.traits.includes('subtle')&&audio.length)issues.push({kind,name:item.name,mode,type:'subtle-action-has-audio'});
  if(mode){
   const current=original?analyzeWeapon(original,item.path).modes.find(m=>m.mode===mode):null;
   if(current?.family!==modeData.family||current?.payload?.style!==modeData.payload?.style)issues.push({kind,name:item.name,mode,type:'catalog-stale-after-semantic-change'});
   const physical=audio.filter(s=>['contact','thrust','strike'].some(word=>s.label.toLowerCase().includes(word))&&!/shockwave|thunder/i.test(s.label));
   if(mode==='melee'&&physical.length>1)issues.push({kind,name:item.name,mode,type:'one-strike-duplicates-physical-contact'});
   for(const[edition,db]of Object.entries(databases))try{
    const plan=planRecipe(recipe,db,context);
    for(const stage of plan)if(stage.asset){selectedVisual[edition].add(stage.asset);const row=db.find(r=>r.key===stage.asset),geometry=assetGeometry(row);if(['impact','aura'].includes(stage.kind)&&geometry!=='radial')issues.push({kind,name:item.name,mode,edition,type:'nonlocalized-weapon-contact',asset:stage.asset,geometry});if(stage.kind==='travel'&&geometry!=='projectile')issues.push({kind,name:item.name,mode,edition,type:'weapon-flight-wrong-geometry',asset:stage.asset,geometry});}
    if(plan.some(s=>s.destination?.id==='other'))issues.push({kind,name:item.name,mode,edition,type:'weapon-strike-hits-second-target'});
   }catch(error){issues.push({kind,name:item.name,mode,edition,type:'invalid-weapon-plan',message:error.message});}
  }
  for(const s of audio){selectedAudio.add(s.soundFile);const anchor=recipe.stages.find(a=>a.stageId===s.afterStage);if(!anchor)issues.push({kind,name:item.name,mode,type:'sound-missing-anchor'});if((anchor?.repeats??1)>1&&(s.repeats!==anchor.repeats||repeatStride(s)!==repeatStride(anchor)))issues.push({kind,name:item.name,mode,type:'sound-repeat-cadence-mismatch',sound:s.label});
   if(kind==='weapon'){const cue=(ABILITY_SOUND_PROFILES[s.optionalSound?.profile]??SOUND_PROFILES[s.optionalSound?.profile])?.[s.optionalSound?.cue],slot=cue?.anchorSlot??(cue?.role==='contact'?'contact':'accent');if(['contact','impact'].includes(cue?.role)&&!anchor?.stageId.endsWith('-'+slot))issues.push({kind,name:item.name,mode,type:'weapon-sound-wrong-action-phase',sound:s.label,anchor:anchor?.stageId});}
  }
  for(const{active,catalog}of catalogs){const count=build(catalog).stages.filter(s=>s.kind==='sound').length,key=active.join('+')||'none';record.activePackAvailability[key]=count;if(count)activeCounts[key]=(activeCounts[key]??0)+1;if(!active.length&&count)issues.push({kind,name:item.name,mode,type:'audio-with-no-active-provider'});}
  const signature=structural(recipe.stages);signatures.set(signature,[...(signatures.get(signature)??[]),item.name+(mode?' ['+mode+']':'')]);evidence.push(record);
 }
 summaries[kind]={entries:items.length,withSound:evidence.filter(e=>e.kind===kind&&e.audioStages.length).length,quiet:evidence.filter(e=>e.kind===kind&&!e.profile).length,profiles:new Set(items.map(i=>i.direction?.profile).filter(Boolean)).size,selectedAudioFiles:selectedAudio.size,structuralVisualCompositions:signatures.size,largestSharedStructuralGroups:[...signatures.values()].sort((a,b)=>b.length-a.length).slice(0,8).map(names=>({count:names.length,examples:names.slice(0,8)})),activeProviderCoverage:activeCounts,weaponSelectedVisualKeys:modeSelected(selectedVisual)};
}
function modeSelected(map){return Object.fromEntries(Object.entries(map).map(([edition,set])=>[edition,set.size]));}
const report={date:'2026-10-07',source:{pf2e:'8.6.0',sha,nativeDescriptions:sourceById.size,equipmentDocuments:source.total,weaponDocuments:source.weapons.length,catalogWeaponDocuments:PF2E_WEAPONS.length,scope:'Native weapon Strike uses only; activated consumables and equipment powers are not a separate item catalog.'},summaries,packs,audio:{candidateFiles:candidates.size,probed:levels?audioEvidence.length:0,exactMissing:audioEvidence.filter(e=>!e.exactFileExists).length,unresolved:audioEvidence.filter(e=>!e.activeDatabaseResolves).length,meanDbRange:levels?[Math.min(...audioEvidence.map(e=>e.meanDb)),Math.max(...audioEvidence.map(e=>e.meanDb))]:null,cuesOverAutomatic4500ms:audioEvidence.filter(e=>e.nativeDuration>4500).length,evidence:audioEvidence},issues,entries:evidence,limitations:['Full descriptions were parsed and hashed for every entry; selected suspect descriptions were read individually. This is not 5,000 individual watched/listened playthroughs.','Structural signatures exclude delay, scale, tint, decorative angles, IDs and labels; related tiers/base weapons may correctly share the same Strike.','Audio meanings use installed provider keys/filenames and native rules; playable duration and loudness are probed when --probe-audio is used. Timbre is not proven by filename.','Free geometry/key coverage is distinct from installed exact video-path availability; this audit does not claim a missing Free pack is installed.','Weapon contact-start timing is authored cosmetic alignment; exact visible contact frames remain media-specific.']};
await writeFile(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({output,summaries:Object.fromEntries(Object.entries(summaries).map(([kind,{largestSharedStructuralGroups,...summary}])=>[kind,summary])),audio:{candidateFiles:candidates.size,probed:report.audio.probed,exactMissing:report.audio.exactMissing,unresolved:report.audio.unresolved,meanDbRange:report.audio.meanDbRange,cuesOverAutomatic4500ms:report.audio.cuesOverAutomatic4500ms},issues:issues.length,issueExamples:issues.slice(0,12)},null,2));
if(issues.length)process.exitCode=1;
