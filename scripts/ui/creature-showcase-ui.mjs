import {RecipePreview} from '../engines/preview/recipe-preview.mjs';
import {previewRecipeSounds} from '../engines/sound/spell-sounds.mjs';
import {BOSS_STYLES,BOSS_TIMING} from '../engines/showcase/boss-entrance.mjs';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const SHOWCASE_PAGE='creature-showcase';

export class CreatureShowcaseUI{
 constructor(workspace,{Preview=RecipePreview}={}){this.w=workspace;this.Preview=Preview;this.index=0;this.serial=0;this.options={style:'dread',title:'',subtitle:'',camera:true,sound:true,volume:.5};}
 html(){
  this.snapshot=this.w.host.creatureShowcase?.(this.tokenId)??{tokens:[],steps:[]};
  this.tokenId=this.snapshot.selectedId;
  this.index=Math.min(this.index,Math.max(0,this.snapshot.steps.length-1));
  const {tokens,creature,steps,unavailable=[],total=steps.length}=this.snapshot,disabled=!creature||!steps.length;
  const env=this.w.host.environment(),bossDisabled=!creature||!env.ready;
  const creatureName=/^(unknown|unidentified(?: creature)?)$/i.test(creature?.name??'')?creature.actorName||creature.name:creature?.name;
  return `<div class="an-showcase"><section class="an-showcase-select"><div class="an-showcase-picker-head"><div><b>Choose a creature</b><small>Scene tokens · actual creature names shown to the GM</small></div><button data-action="showcase-refresh">↻ Refresh from scene</button></div><div class="an-showcase-token-grid" role="group" aria-label="Scene creatures">${tokens.map(t=>{const unknown=/^(unknown|unidentified(?: creature)?)$/i.test(t.name),name=unknown&&t.actorName?t.actorName:t.name,src=t.img||'icons/svg/mystery-man.svg';return `<button type="button" class="an-showcase-token${t.id===this.tokenId?' is-selected':''}" data-action="showcase-token" data-id="${esc(t.id)}" aria-pressed="${t.id===this.tokenId}" title="${esc(`${t.name}${t.actorName&&t.actorName!==t.name?` · ${t.actorName}`:''} · ${t.id}`)}">${/\.(webm|mp4)(?:\?|$)/i.test(src)?`<video src="${esc(src)}" muted autoplay loop playsinline aria-label="${esc(name)}"></video>`:`<img src="${esc(src)}" alt="${esc(name)}" loading="lazy">`}<span><b>${esc(name)}</b><small>${esc(t.actorName&&t.actorName!==name?t.actorName:`Token ${t.id.slice(-4)}`)}${t.hidden?' · Hidden':''}</small></span>${t.id===this.tokenId?'<i aria-hidden="true">✓</i>':''}</button>`;}).join('')||'<p class="an-hint">No NPC tokens on this scene.</p>'}</div></section>
   <div class="an-showcase-columns"><section class="an-showcase-choreography"><div class="an-eyebrow">COMBAT CHOREOGRAPHY · LOCAL PREVIEW</div><h2>${esc(creatureName??'Choose a creature')}</h2><p>Movement, attacks and abilities against stand-in targets. No rolls or changes to creatures. Shows available designs even when automatic playback is off.</p>
    <div class="an-catalog-controls"><button class="an-primary" data-action="showcase-play" ${disabled?'disabled':''}>▶ Play choreography</button><button data-action="showcase-stop">■ Stop preview</button></div>
    <div data-showcase-stage>${this.stepHTML()}</div><p class="an-hint" role="status" data-showcase-status>${steps.length?`${steps.length} steps${total>steps.length?` of ${total} available (first ${steps.length})`:''}. Click a step to preview it.`:'No creature selected.'}</p>
    <div class="an-showcase-steps">${steps.map((s,i)=>`<button data-action="showcase-step" data-index="${i}" class="${i===this.index?'is-active':''}"><b>${i+1}. ${esc(s.name)}</b><small>${esc(s.kind)}</small></button>`).join('')}</div>
    ${unavailable.length?`<details class="an-showcase-missing"><summary>${unavailable.length} actions without a playable preview</summary><p>${unavailable.map(a=>esc(a.name)).join(', ')}</p><small>Passive features and spellcasting containers are omitted. Paused custom recipes stay paused.</small></details>`:''}
   </section><aside class="an-showcase-boss"><div class="an-eyebrow">BOSS ENTRANCE</div><h2>Make an entrance</h2><p>A cinematic creature reveal: portrait, letterbox framing, gathering energy and a timed impact, with optional camera focus. Each viewer returns to their previous view.</p>
    <label>Style<select data-showcase="style">${Object.entries(BOSS_STYLES).map(([id,name])=>`<option value="${id}" ${id===this.options.style?'selected':''}>${name}</option>`).join('')}</select></label>
    <label>Public title<input data-showcase="title" maxlength="100" placeholder="${esc(creature?.name??'Creature name')}" value="${esc(this.options.title)}"><small>Blank uses the token's name. Creature names in the picker stay GM-only.</small></label>
    <label>Subtitle<input data-showcase="subtitle" maxlength="160" placeholder="The storm has arrived" value="${esc(this.options.subtitle)}"></label>
    <label class="an-showcase-check"><input type="checkbox" data-showcase="camera" ${this.options.camera?'checked':''}> Focus camera, then return</label>
    <label class="an-showcase-check"><input type="checkbox" data-showcase="sound" ${this.options.sound?'checked':''}> Play entrance sound</label>
    <label>Volume<input type="range" min="0" max="1" step=".05" data-showcase="volume" value="${this.options.volume}" aria-label="Boss entrance volume"></label>
    <button data-action="boss-preview" ${bossDisabled?'disabled':''}>▶ Preview on my screen</button><button class="an-primary" data-action="boss-play" ${bossDisabled||creature.hidden?'disabled':''}>Play for everyone</button><button data-action="boss-stop">■ Stop entrance</button>
    <p class="an-hint">${creature?.hidden?'This token is hidden. Local preview is available; make it visible in Foundry before playing for everyone.':'Only viewers on this scene who can see this creature receive its entrance.'} Camera focus respects reduced motion and animation quality. Taking control of the camera cancels its return.</p>
   </aside></div></div>`;
 }
 stepHTML(){
  const step=this.snapshot?.steps[this.index];if(!step)return '<div class="an-empty">Select a scene NPC to build its showcase.</div>';
  return `<h3>${esc(step.name)}</h3><div class="an-preview an-showcase-preview">${this.w.recipePreviewHTML(step.recipe,this.snapshot.previewTokens)}</div>`;
 }
 status(text){const el=this.w.root.querySelector('[data-showcase-status]');if(el)el.textContent=text;}
 stop(){this.serial++;this.run?.stop();this.run=null;this.movementStop?.();this.movementStop=null;this.status('Preview stopped.');}
 suspend(){this.stop();}
 restoreBossWindow(){clearTimeout(this.restoreTimer);const restore=this.restoreWindow;this.restoreWindow=null;void restore?.();}
 destroy(){this.stop();this.restoreBossWindow();}
 async play(only){
  this.stop();const serial=this.serial,steps=this.snapshot?.steps??[],indices=only===undefined?steps.map((_,i)=>i):[only];
  try{for(const i of indices){
   if(serial!==this.serial||this.w.page!==SHOWCASE_PAGE)break;
   const step=steps[i];if(!step)continue;this.index=i;
   const container=this.w.root.querySelector('[data-showcase-stage]');if(!container)break;
   container.innerHTML=this.stepHTML();
   this.w.root.querySelectorAll('[data-action="showcase-step"]').forEach(el=>el.classList.toggle('is-active',Number(el.dataset.index)===i));
   this.status(`Loading ${i+1}/${steps.length}: ${step.name}…`);
   const recipe=previewRecipeSounds(step.recipe,this.w.host.soundCatalog?.());
   const run=this.run=new this.Preview(container.querySelector('[data-recipe-scene]'),recipe,frame=>{
    if(serial===this.serial)this.status(`${i+1}/${steps.length}: ${step.name} · ${(frame.time/1000).toFixed(1)} s`);
   },{tokenFx:this.w.host.createTokenFxPreview,sceneFx:this.w.host.createSceneFxPreview});
   await run.prepare?.();if(serial!==this.serial){run.stop();break;}
   if(step.kind==='movement')this.movementStop=this.w.host.previewCreatureMovement?.(this.tokenId);
   const completed=await run.play();run.stop();if(this.run===run)this.run=null;this.movementStop?.();this.movementStop=null;
   if(!completed||serial!==this.serial)break;
  }
  if(serial===this.serial)this.status('Choreography complete. Replay any step or the whole sequence.');
  }catch(error){if(serial===this.serial){this.stop();this.status(`Preview unavailable: ${error.message}`);}}
 }
 change(el){
  const field=el.dataset.showcase;if(!field)return false;
  if(field==='token'){this.stop();this.tokenId=el.value;this.index=0;this.options.title='';this.w.render();}
  else if(Object.hasOwn(this.options,field))this.options[field]=el.type==='checkbox'?el.checked:field==='volume'?Number(el.value):el.value;
  return true;
 }
 async action(action,b){
  if(!['showcase-token','showcase-refresh','showcase-play','showcase-step','showcase-stop','boss-preview','boss-play','boss-stop'].includes(action))return false;
  if(this.w.host.playerMode)throw Error('Only a GM can use Creature showcase.');
  if(action==='showcase-token'){this.stop();this.tokenId=b.dataset.id;this.index=0;this.options.title='';this.options.subtitle='';this.w.render();}
  else if(action==='showcase-refresh'){this.stop();this.tokenId=undefined;this.index=0;this.w.render();}
  else if(action==='showcase-stop')this.stop();
  else if(action==='showcase-play'||action==='showcase-step')void this.play(action==='showcase-step'?Number(b.dataset.index):undefined);
  else if(action==='boss-stop'){this.w.host.stopBossEntrance({everyone:true});this.restoreBossWindow();}
  else {
   this.stop();this.restoreBossWindow();this.restoreWindow=await this.w.host.tuckWindow?.();
   try{const played=await this.w.host.playBossEntrance(this.tokenId,{...this.options,everyone:action==='boss-play',onFinish:()=>this.restoreBossWindow()});if(played)this.restoreTimer=setTimeout(()=>this.restoreBossWindow(),BOSS_TIMING.duration+500);else this.restoreBossWindow();}
   catch(error){this.restoreBossWindow();throw error;}
  }
  return true;
 }
}
