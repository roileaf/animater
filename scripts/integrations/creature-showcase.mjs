import {resolveAsset} from '../core/model.mjs';
import {qualityRank} from '../core/quality.mjs';
import {uuid} from '../core/uuid.mjs';
import {buildCreatureShowcase,isShowcaseCreature} from '../engines/showcase/creature-showcase.mjs';
import {createBossEntrance,bossEntranceOptions,bossEntranceDesign,receiveBossEntrance} from '../engines/showcase/boss-entrance.mjs';
import {creatureBulk} from '../engines/motion/creature-gait.mjs';
import {thudFile,thudLevel,stepWeight} from '../engines/motion/movement-feel.mjs';
import {npcAbilityPreview} from '../catalogs/pf2e/npc-abilities.mjs';

const ID='animater';
const art=token=>{
 const grid=canvas.grid?.size||100,doc=token.document;
 return {id:token.id,name:token.name,img:doc?.texture?.src,width:(token.w||grid)/grid,height:(token.h||grid)/grid,
  spriteWidth:Math.abs(token.mesh?.width??token.w??grid)/grid,spriteHeight:Math.abs(token.mesh?.height??token.h??grid)/grid,
  textureScaleX:doc?.texture?.scaleX??1,textureScaleY:doc?.texture?.scaleY??1,rotation:doc?.rotation??0};
};
export function createCreatureShowcaseTools({resolve,sounds,catalog,movement,trace,quality,canFocus,clientId}){
 let lastShared=null;
 const gm=()=>{if(!game.user.isGM)throw Error('Only a GM can use Creature showcase.');};
 const target=(id,sceneId,{preview=false}={})=>{
  const token=canvas?.ready&&canvas.scene?.id===sceneId?canvas.tokens?.get(id):null;
  if(!token||!isShowcaseCreature(token.actor)||qualityRank(quality())===0)return null;
  if(!(preview&&game.user.isGM)&&(token.visible!==true||token.document?.hidden===true))return null;
  return token;
 };
 const entrance=createBossEntrance({
  target,sameScene:id=>canvas?.ready&&canvas.scene?.id===id,
  view:()=>canvas?.ready?{x:canvas.stage.pivot.x,y:canvas.stage.pivot.y,scale:canvas.stage.scale.x}:null,
  maxZoom:()=>canvas.dimensions?.scale?.max??CONFIG.Canvas?.maxZoom??3,
  canPan:()=>qualityRank(quality())===3&&!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches&&canFocus(),
  pan:to=>void Promise.resolve(canvas.animatePan(to)).catch(()=>{}),
  watchCamera:interrupt=>{
   const board=document.getElementById('board');board?.addEventListener('pointerdown',interrupt);board?.addEventListener('wheel',interrupt,{passive:true});
   return ()=>{board?.removeEventListener('pointerdown',interrupt);board?.removeEventListener('wheel',interrupt);};
  },
  overlay:options=>{
   const root=document.createElement('div');root.className=`animater-boss-entrance is-${options.style}`;root.setAttribute('role','status');root.setAttribute('aria-live','polite');
   root.style?.setProperty('--boss-duration',`${options.duration}ms`);root.style?.setProperty('--boss-impact',`${options.impact}ms`);
   const stage=document.createElement('div');stage.className='animater-boss-composition';
   const portrait=document.createElement('div');portrait.className='animater-boss-portrait';
   const media=document.createElement(/\.(webm|mp4)(?:\?|$)/i.test(options.img)?'video':'img');media.src=options.img||'icons/svg/mystery-man.svg';media.alt='Revealed creature';
   if(media.tagName==='VIDEO'){media.muted=true;media.autoplay=true;media.loop=true;media.playsInline=true;}
   portrait.append(media);
   const copy=document.createElement('div');copy.className='animater-boss-copy';
   const kicker=document.createElement('div');kicker.className='animater-boss-kicker';kicker.textContent={dread:'An ominous presence',arcane:'Arcane power awakens',primal:'The wild awakens'}[options.style];
   const title=document.createElement('div');title.className='animater-boss-title';title.textContent=options.title;
   const sub=document.createElement('div');sub.className='animater-boss-subtitle';sub.textContent=options.subtitle;
   copy.append(kicker,title,sub);stage.append(portrait,copy);
   const skip=document.createElement('button');skip.type='button';skip.className='animater-boss-skip';skip.textContent='Skip · Esc';skip.addEventListener('click',options.onSkip);
   const onKey=e=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();options.onSkip();}};
   globalThis.addEventListener?.('keydown',onKey,true);
   root.append(stage,skip);document.body.append(root);return ()=>{globalThis.removeEventListener?.('keydown',onKey,true);media.pause?.();root.remove();};
  },
  effects:(token,options,id)=>{
   if(qualityRank(quality())<2)return;
   const designs=bossEntranceDesign(options.style).map(d=>({...d,asset:resolveAsset({kind:'aura',assets:d.assets},catalog())})).filter(d=>d.asset);if(!designs.length)return;
   const name=`animater-boss-${id}`;let active=true;
   const end=()=>{try{void Sequencer.EffectManager.endEffects({name},false);}catch{/* scene cleared */}};
   const sequence=new Sequence({moduleName:ID});
   for(const d of designs)sequence.effect().file(d.asset).atLocation(token).scaleToObject(d.scale).tint(d.tint).opacity(d.opacity).delay(d.delay).duration(d.duration).fadeIn(200).fadeOut(700).name(name);
   void Promise.resolve(sequence.play({local:true})).then(()=>{if(!active)end();}).catch(error=>trace('Blocked',`Boss entrance effect: ${error.message}`));
   return ()=>{active=false;end();};
  },
  sound:async(token,options)=>{
   const recipe=npcAbilityPreview(options.style==='primal'?'fury':options.style==='arcane'?'blink':'fear',{motion:false,soundCatalog:sounds(),soundVolume:options.volume});
   const cue=recipe?.stages.find(s=>s.kind==='sound'&&s.soundFile&&!s.skipSound);
   const bulk=creatureBulk({system:game.system.id,actor:token.actor,name:token.name}),weight=stepWeight({size:bulk.size,squares:(token.w||100)/(canvas.grid.size||100),heavy:bulk.heavy});
   const thud=weight>=3?thudFile(weight,0,token.id):null;
   const requests=[...(cue?[game.audio.play(cue.soundFile,{volume:cue.volume*.8,context:game.audio.interface})]:[]),...(thud?[game.audio.play(thud,{volume:Math.min(1,thudLevel(weight).gain*options.volume*.5),context:game.audio.interface})]:[])];
   const playing=(await Promise.allSettled(requests)).filter(r=>r.status==='fulfilled'&&r.value).map(r=>r.value);
   return {stop:()=>{for(const sound of playing)sound.stop?.();}};
  },
  schedule:(fn,ms)=>setTimeout(fn,ms),cancel:id=>clearTimeout(id),trace,
 });
 function snapshot(tokenId){
  gm();const all=canvas?.ready?(canvas.tokens?.placeables??[]).filter(t=>isShowcaseCreature(t.actor)):[];
  const selected=tokenId===undefined?all.find(t=>t.controlled):all.find(t=>t.id===tokenId);
  const tokens=all.map(t=>({id:t.id,name:t.name,actorName:t.actor?.name??'',img:t.document?.texture?.src||t.actor?.img||'icons/svg/mystery-man.svg',hidden:!!t.document?.hidden}));
  if(!selected)return {tokens,selectedId:'',steps:[],unavailable:[]};
  const plan=buildCreatureShowcase({actor:selected.actor,systemId:game.system.id,resolve});
  const stand=i=>({id:`showcase-target-${i}`,name:`Target ${i+1}`,img:'icons/svg/target.svg',width:1,height:1});
  return {...plan,tokens,selectedId:selected.id,creature:{id:selected.id,name:selected.name,actorName:selected.actor?.name??'',hidden:!!selected.document?.hidden},
   previewTokens:{source:art(selected),targets:stand(0),targetList:[stand(0),stand(1),stand(2)],targetCount:3,gridDistance:canvas.scene?.grid?.distance??5}};
 }
 function playBoss(tokenId,raw={}){
  gm();if(!canvas?.ready)throw Error('Open a scene first.');
  const token=canvas.tokens.get(tokenId??canvas.tokens.controlled?.[0]?.id);
  if(!isShowcaseCreature(token?.actor))throw Error('Choose an NPC on this scene.');
  if(raw.everyone&&token.document?.hidden)throw Error('Make the creature visible before playing its entrance for everyone.');
  if(raw.everyone&&game.modules.get(ID)?.socket!==true)throw Error('Restart the Foundry server to register Animater’s broadcast channel, then reload. Local preview is available.');
  const data={type:'boss-entrance',action:'play',id:uuid(),tokenId:token.id,sceneId:canvas.scene.id,userId:game.user.id,sender:clientId,options:bossEntranceOptions(raw)};
  if(raw.everyone){lastShared=data.id;game.socket.emit(`module.${ID}`,data);}
  return entrance.play({...data,preview:!raw.everyone,onFinish:raw.onFinish});
 }
 function stopBoss({everyone=false}={}){
  gm();if(everyone&&lastShared){game.socket.emit(`module.${ID}`,{type:'boss-entrance',action:'stop',id:lastShared,userId:game.user.id,sender:clientId});lastShared=null;}
  return entrance.stop();
 }
 return {snapshot,playBoss,stopBoss,
  movement:id=>{gm();return movement(id);},
  receive:(data,senderId)=>receiveBossEntrance(data,senderId,{isGM:id=>game.users.get(id)?.isGM===true,play:data=>entrance.play(data),stop:id=>{if(entrance.id===id)entrance.stop();}}),
  clear:()=>entrance.stop({restore:false}),get playing(){return entrance.playing;},
 };
}
