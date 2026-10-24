export const BOSS_STYLES=Object.freeze({dread:'Dread',arcane:'Arcane',primal:'Primal'});
export const BOSS_TIMING=Object.freeze({impact:1100,duration:6200});
export function bossEntranceDesign(style){
 const tint={dread:'#ae7ec9',arcane:'#78caff',primal:'#efbd72'}[style]??'#ae7ec9';
 return [
  {label:'Gather',assets:style==='arcane'?['jb2a.energy_strands.complete.blue.01','jb2a.shimmer.01.blue']:['jb2a.smoke.puff.centered.grey'],tint,scale:2.8,delay:0,duration:2600,opacity:.65},
  {label:'Arrival',assets:style==='primal'?['jb2a.impact.009.orange']:['jb2a.impact.005.orange','jb2a.impact.004.blue'],tint,scale:3.6,delay:BOSS_TIMING.impact,duration:1800,opacity:.85},
  {label:'Presence',assets:style==='primal'?['jb2a.smoke.puff.centered.grey']:['jb2a.shimmer.01.blue'],tint,scale:2.2,delay:BOSS_TIMING.impact+250,duration:3500,opacity:.5},
 ];
}
export function bossEntranceOptions(raw={}){
 return {style:Object.hasOwn(BOSS_STYLES,raw.style)?raw.style:'dread',
  title:String(raw.title??'').trim().slice(0,100),subtitle:String(raw.subtitle??'').trim().slice(0,160),
  camera:raw.camera!==false,sound:raw.sound!==false,volume:Number.isFinite(Number(raw.volume))?Math.min(1,Math.max(0,Number(raw.volume))):.5};
}
// Every client plays locally after authorizing the GM request. No token flags,
// visibility, combat state or document positions change.
export function createBossEntrance(host){
 let running=null;
 const seen=new Set();
 function finish({restore=true}={}){
  const r=running;if(!r)return false;running=null;
  for(const timer of r.timers){try{host.cancel(timer);}catch{/* cleanup must continue */}}
  for(const clean of r.cleanup.reverse()){try{clean?.();}catch{/* effect already ended */}}
  if(restore&&r.panned&&!r.interrupted&&host.sameScene(r.sceneId))host.pan({...r.view,duration:450});
  try{r.onFinish?.();}catch{/* caller closed its workspace */}
  return true;
 }
 function play({id,tokenId,sceneId,options={},preview=false,onFinish}={}){
  if(typeof id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(id)||seen.has(id))return false;
  const token=host.target(tokenId,sceneId,{preview});if(!token)return false;
  finish();seen.add(id);if(seen.size>100)seen.delete(seen.values().next().value);
  const config=bossEntranceOptions(options),r=running={id,sceneId,tokenId,preview,cleanup:[],timers:[],panned:false,interrupted:false,view:host.view(),onFinish:typeof onFinish==='function'?onFinish:null};
  const later=(ms,fn)=>r.timers.push(host.schedule(()=>{if(running===r)fn();},ms));
  try{
   r.cleanup.push(host.watchCamera?.(()=>{r.interrupted=true;}));
   if(config.camera&&host.canPan()&&r.view){
    const scale=Math.min(host.maxZoom()||3,r.view.scale*1.35,Math.min(1.6,800/Math.max(token.w||100,token.h||100)));
    r.panned=true;host.pan({...token.center,scale,duration:700});
   }
   r.cleanup.push(host.overlay({...config,title:config.title||token.name,img:token.document?.texture?.src??'',duration:BOSS_TIMING.duration,impact:BOSS_TIMING.impact,onSkip:()=>finish()}));
   r.cleanup.push(host.effects?.(token,config,id));
   if(config.sound&&config.volume>0){
    later(BOSS_TIMING.impact,()=>{Promise.resolve().then(()=>running===r?host.sound?.(token,config):null).then(sound=>{
     if(!sound)return;if(running===r)r.cleanup.push(()=>sound.stop?.());else sound.stop?.();
    }).catch(error=>host.trace?.('Blocked',`Boss entrance sound: ${error.message}`));});
   }
   // Visibility may change during the entrance. Remove it immediately afterward.
   const check=()=>{if(!host.target(tokenId,sceneId,{preview}))finish({restore:host.sameScene(sceneId)});else later(200,check);};
   later(200,check);later(BOSS_TIMING.duration,()=>finish());
   host.trace?.(preview?'Previewed':'Played',`Boss entrance: ${config.title||token.name}`);
   return true;
  }catch(error){finish();host.trace?.('Blocked',`Boss entrance: ${error.message}`);return false;}
 }
 return {play,stop:finish,get playing(){return running!==null;},get id(){return running?.id??null;}};
}

export function receiveBossEntrance(data,senderId,{isGM,play,stop}={}){
 if(data?.type!=='boss-entrance'||!senderId||data.userId!==senderId||!isGM(senderId))return false;
 if(data.action==='stop'&&typeof data.id==='string'){stop(data.id);return true;}
 if(data.action!=='play'||typeof data.id!=='string'||typeof data.tokenId!=='string'||typeof data.sceneId!=='string')return false;
 return play({...data,options:bossEntranceOptions(data.options),preview:false});
}
