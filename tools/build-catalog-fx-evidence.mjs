import fs from 'node:fs';
import path from 'node:path';
import {PF2E_SPELLS,PF2E_SOURCE} from '../data/pf2e-spells.mjs';
import {PF2E_CONDITIONS,PF2E_EFFECTS,PF2E_STATE_SOURCE} from '../data/pf2e-state-catalog.mjs';
import {SF2E_ENTRIES} from '../data/sf2e-catalog.mjs';
import {fxSemantics} from '../scripts/catalogs/shared/catalog-fx-semantics.mjs';
const root=path.resolve(`.cache/persistent-research/pf2e-${PF2E_STATE_SOURCE.sha}`),evidence={},missing=[];
const nativeSources=new Map(),packs=path.join(root,'packs/pf2e');
for(const file of fs.readdirSync(packs,{recursive:true})){
  if(!file.endsWith('.json'))continue;
  const source=JSON.parse(fs.readFileSync(path.join(packs,file),'utf8'));
  if(source._id){const rows=nativeSources.get(source._id)??[];rows.push(source);nativeSources.set(source._id,rows);}
}
const lang=JSON.parse(fs.readFileSync(path.join(root,'static/lang/en.json'),'utf8'));
const localize=html=>String(html??'').replace(/@Localize\[([^\]]+)\]/g,(raw,key)=>key.split('.').reduce((v,k)=>v?.[k],lang)??raw);
let count=0;
for(const e of [...PF2E_SPELLS,...PF2E_CONDITIONS,...PF2E_EFFECTS]){
  try {
    const uuid=e.uuid??e.sourceUUID??`Compendium.pf2e.spells-srd.Item.${e.id}`;
    const id=uuid.split('.Item.')[1],rows=nativeSources.get(id)??[];
    const source=rows.length===1?rows[0]:rows.find(s=>s.name===e.name);
    if(!source)throw Error('Missing native source');
    const flags=fxSemantics(e,localize(source.system?.description?.value));
    evidence[uuid]=Object.entries(flags).filter(([,value])=>value).map(([key])=>key);count++;
  }catch(error){missing.push({name:e.name,path:e.path,error:error.code});}
}
const sf=JSON.parse(fs.readFileSync('.cache/sf2e-source/sf2e-1.5.1-assembled-v2.json','utf8'));
const sources=new Map(sf.entries.map(e=>[e.uuid,e.source]));
for(const e of SF2E_ENTRIES){
  const source=sources.get(e.uuid);if(!source){missing.push({name:e.name,uuid:e.uuid});continue;}
  evidence[e.uuid]=Object.entries(fxSemantics(e,source.system?.description?.value)).filter(([,value])=>value).map(([key])=>key);count++;
}
if(missing.length){console.log(JSON.stringify({count,missing:missing.slice(0,12)},null,2));process.exitCode=1;}
else {
  fs.writeFileSync('data/catalog-fx-evidence.mjs',`// Native description predicates; no generated prose.\nexport const CATALOG_FX_SOURCE=${JSON.stringify({pf2e:PF2E_SOURCE.sha,states:PF2E_STATE_SOURCE.sha,sf2e:sf.sha,count})};\nexport const CATALOG_FX_EVIDENCE=${JSON.stringify(evidence)};\n`);
  console.log(JSON.stringify({descriptions:count,matched:Object.values(evidence).filter(v=>v.length).length}));
}
