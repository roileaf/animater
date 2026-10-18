import {readFile,writeFile,stat,access,mkdir} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {resolve,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {PF2E_CONDITIONS,stateRecipe} from '../scripts/catalogs/pf2e/state-catalog.mjs';
import {assetDatabases} from './asset-databases.mjs';

const exec=promisify(execFile),dataRoot=fileURLToPath(new URL('../../..',import.meta.url));
const orbit=/^jb2a\.markers\.(?:fear|heart|mute|shield_cracked|skull|drop|poison|stun|runes(?:02|03)?)\./;
const cachePath=new URL('../.cache/condition-location-bounds.json',import.meta.url);
let cache={};try{cache=JSON.parse(await readFile(cachePath,'utf8'));}catch{}
const exists=path=>access(path).then(()=>true,()=>false);
const pending=new Map();
async function bounds(file){
 if(pending.has(file))return pending.get(file);
 const result=(async()=>{
  const info=await stat(file),stamp=`${info.size}:${info.mtimeMs}`;
  if(cache[file]?.stamp===stamp)return cache[file].bounds;
  const media=JSON.parse((await exec('ffprobe',['-v','error','-show_entries','stream=codec_name,width,height','-of','json',file])).stdout).streams[0];
  const width=128,height=Math.round(128*media.height/media.width);
  const {stdout:frames}=await exec('ffmpeg',['-v','error','-threads','1','-filter_threads','1','-c:v',media.codec_name==='vp8'?'libvpx':'libvpx-vp9','-i',file,'-vf',`fps=12,scale=${width}:${height},format=rgba`,'-f','rawvideo','-pix_fmt','rgba','pipe:1'],{encoding:'buffer',maxBuffer:128*1024*1024});
  let peak=0;for(let i=3;i<frames.length;i+=4)peak=Math.max(peak,frames[i]);
  const threshold=Math.max(8,Math.min(64,peak*.5));
  let left=width,top=height,right=-1,bottom=-1;
  for(let i=3;i<frames.length;i+=4)if(frames[i]>=threshold){const pixel=((i-3)/4)%(width*height),x=pixel%width,y=Math.floor(pixel/width);left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
  if(right<0)throw Error(`No visible frames: ${file}`);
  const visible=Math.max(right-left+1,bottom-top+1);
  const measured={width,height,left,top,right,bottom,centerShift:{x:+(((left+right+1)/2-width/2)/visible).toFixed(5),y:+(((top+bottom+1)/2-height/2)/visible).toFixed(5)}};
  cache[file]={stamp,bounds:measured};return measured;
 })();pending.set(file,result);return result;
}

export async function auditConditionLocations({measure=false}={}){
 const db=await assetDatabases(),records=[],issues=[];
 for(const e of PF2E_CONDITIONS)for(const damageType of [undefined,...Object.keys(e.damageVariants??{})])for(const [edition,catalog] of Object.entries(db)){
  const design=e.damageVariants?.[damageType]??e,recipe=stateRecipe(e,{damageType,catalog});
  for(const [index,stage] of recipe.stages.entries()){
   const native=design.conditionDesign.layers[index].editions[edition],isOrbit=orbit.test(native.key);
   const anchor={x:stage.customAnchor?stage.anchorX:.5,y:stage.customAnchor?stage.anchorY:.5};
   const row={condition:e.slug,...(damageType?{damageType}:{}),edition,stage:index+1,asset:native.key,offset:{x:stage.offsetX,y:stage.offsetY},anchor,scale:stage.scale,below:stage.below,orbit:isOrbit,files:[]};
   if(isOrbit&&(stage.offsetX!==0||stage.offsetY!==0))issues.push({...row,reason:'displaced-orbit'});
   if(stage.offsetUnits!=='token')issues.push({...row,reason:'non-token-offset-units'});
   if(!Number.isFinite(stage.scale)||stage.scale<=0)issues.push({...row,reason:'invalid-scale'});
   if(measure)for(const file of native.files){
    const exact=resolve(dataRoot,file),reference=resolve(dataRoot,'modules/jb2a_patreon',file.split('/').slice(2).join('/')),freeCache=fileURLToPath(new URL(`../.cache/free-media/${basename(file)}`,import.meta.url));
    const located=await exists(exact)?{path:exact,source:'installed'}:await exists(reference)?{path:reference,source:'same-filename-reference'}:await exists(freeCache)?{path:freeCache,source:'official-free-cache'}:null;
    if(!located){issues.push({...row,reason:'missing-measurement',file});continue;}
    const measured=await bounds(located.path),visible=Math.max(measured.right-measured.left+1,measured.bottom-measured.top+1);
    const centerShift={x:+(((measured.left+measured.right+1)/2-measured.width*anchor.x)/visible).toFixed(5),y:+(((measured.top+measured.bottom+1)/2-measured.height*anchor.y)/visible).toFixed(5)};
    row.files.push({file,source:located.source,bounds:measured,effectiveCenterShift:centerShift});
    if(Math.max(Math.abs(centerShift.x),Math.abs(centerShift.y))*stage.scale>.08)issues.push({...row,reason:'off-center-media',file,centerShift});
   }
   records.push(row);
  }
 }
 if(measure){await mkdir(new URL('../.cache/',import.meta.url),{recursive:true});await writeFile(cachePath,JSON.stringify(cache));}
 return {conditions:PF2E_CONDITIONS.length,damageTypes:Object.keys(PF2E_CONDITIONS.find(e=>e.slug==='persistent-damage').damageVariants).length,editions:Object.keys(db),measure,method:'Complete clip union of visible alpha at 12 fps; media center measured relative to selected artwork anchor, independently of authored offsets',records,issues};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const report=await auditConditionLocations({measure:process.argv.includes('--measure')});
 await writeFile(new URL('../data/condition-location-audit.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({conditions:report.conditions,damageTypes:report.damageTypes,layouts:report.records.length,issues:report.issues},null,2));
 if(report.issues.length)process.exitCode=1;
}
