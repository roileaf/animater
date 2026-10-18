import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {GAP_B_MOTIFS,GAP_B_DESIGNS,gapBLayers,gapBReviewProfile} from '../scripts/catalogs/pf2e/spells/spell-gap-b.mjs';
import {resolveSpellMedia} from './spell-asset-selection.mjs';
import {SPELL_THEMES} from '../scripts/catalogs/pf2e/spells/spell-choreography.mjs';
import {descriptionText} from './spell-semantics.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const source=JSON.parse(fs.readFileSync(`${root}.cache/catalog-availability-source.json`));
const entries=source.missing.filter(x=>x.system==='pf2e'&&x.kind==='spell'&&x.reason==='unconfigured').slice(300,600);
const databases=JSON.parse(fs.readFileSync(`${root}.cache/spell-gap-b-assets.json`));
const matches=(key,roots)=>roots.split(',').some(r=>key===`jb2a.${r}`||key.startsWith(`jb2a.${r}.`));
const themes=['fire','cold','water','air','earth','metal','wood','poison','electricity','sonic','vitality','void','mental'];
const failures=[],review=[];
assert.equal(entries.length,300);
assert.equal(Object.keys(GAP_B_DESIGNS).length,300);
for(const item of entries){
  const slug=item.slug.replace(/-legacy$/,'');
  assert(GAP_B_DESIGNS[slug],slug);
  const motif=GAP_B_DESIGNS[slug][0],profile=GAP_B_MOTIFS[motif],semantic=gapBReviewProfile(slug);
  const area=profile.previewArea??item.native.area;
  const ritual=/day|week|hour/.test(item.native.time.value);
  const delivery=profile.delivery??(ritual?'ritual':area?['cube','square','cylinder'].includes(area.type)?'burst':area.type:item.native.target.value?'target':'self');
  const theme=themes.find(t=>item.native.traits.value.includes(t))??'arcane';
  const design={motif,pattern:profile.pattern,label:profile.label,assetIntent:profile.assetIntent,areaLayout:profile.areaLayout};
  let assets;
  try{assets=resolveSpellMedia(databases,theme,profile,SPELL_THEMES[theme]??SPELL_THEMES.arcane,{name:item.name,slug,design,area,delivery});}
  catch(error){failures.push({slug,error:error.message});continue;}
  for(const role of semantic.stageRoles){
    if(!role.root)continue;
    for(const edition of ['patreon','free']){
      const key=assets[role.slot].find(k=>databases[edition].some(r=>r.key===k));
      if(!key||!matches(key,role.root)) failures.push({slug,edition,slot:role.slot,expected:role.root,key});
    }
  }
  const mediaTiming=Object.fromEntries(Object.keys(assets).map(slot=>[slot,{duration:5000}]));
  const spell={id:item.id,slug,delivery,design:{...design,assets,mediaTiming}};
  const fx=(kind,slot,label,delay,duration,extra)=>({kind,slot,label,delay,duration,...extra});
  const copy=(label,delay,duration,extra)=>({kind:'sprite',label,delay,duration,...extra});
  const track=(property,from,to,duration)=>({property,from,to,duration});
  const stages=gapBLayers(spell,{fx,copy,track,subject:item.native.target.value?'targets':'source'});
  assert(stages.length,slug);
  assert(stages.every(s=>s.kind==='sprite'||s.duration>=5000/(s.playbackRate??1)),`${slug}: truncated footage`);
  assert(stages.every(s=>s.kind!=='motion'),`${slug}: token movement`);
  if(profile.nativeArea&&!ritual&&area)assert(stages.some(s=>s.kind==='template'||s.travelDestination==='area'),`${slug}: footprint absent`);
  const nativeDescription=item.native.description.value||item.native.description.gm||'';
  review.push({id:item.id,slug:item.slug,sourceHash:crypto.createHash('sha256').update(nativeDescription).digest('hex'),descriptionHash:crypto.createHash('sha256').update(descriptionText(nativeDescription)).digest('hex'),descriptionChars:descriptionText(nativeDescription).length,
    ...semantic,nativeArea:item.native.area??null,nativeTime:item.native.time.value,nativeTarget:item.native.target.value,
    selectedSlots:Object.fromEntries([...new Set(semantic.stageRoles.map(s=>s.slot).filter(Boolean))].map(slot=>[slot,assets[slot]]))});
}
console.log(JSON.stringify({entries:entries.length,reviewed:review.length,failures},null,2));
if(failures.length)process.exitCode=1;
else fs.writeFileSync(`${root}docs/spell-gap-b-review.json`,JSON.stringify(review,null,2)+'\n');
