import {stageFrame} from '../../core/stage-options.mjs';
import {tintedPreset} from '../playback/optional-fx.mjs';
import {presetFilters} from '../tokenshade/engine.mjs';

// animater's own shaders on a copy of the token art, drawn in an off-canvas renderer
// with the preview's own clock. Nothing touches the canvas or any document.
export function previewFilters(preset, stage, {PIXI, tokenSize=null}) {
  const filters=presetFilters(PIXI,tintedPreset(preset??{name:stage.fxPreset},stage),{tokenSize,key:'preview'});
  if(!filters.length)throw Error(`Unsupported token FX preset: ${preset?.name??''}`);
  return filters;
}

export class TokenFxPreview {
  constructor({scene,recipe,PIXI,tokenFx,world=()=>Date.now()}) {
    Object.assign(this,{scene,recipe,PIXI,tokenFx,world});
    this.abort=new AbortController();this.records=[];this.stopped=false;
    this.info=JSON.parse(scene.dataset.previewTokens??'{}');
    // index: position in the plan (or stages); stageIndex: the recipe stage it plays.
    this.entries=(recipe.playbackPlan??recipe.stages).flatMap((stage,index)=>stage.kind==='tokenfx'?[{stage,index,stageIndex:stage.index??index}]:[]);
  }
  async ready() {
    const {PIXI,scene}=this;
    for(const entry of this.entries)entry.preset=this.tokenFx.getPresets(entry.stage.fxLibrary??'tokenshade').find(p=>p.name===entry.stage.fxPreset);
    for(const token of scene.querySelectorAll('[data-preview-token]')) {
      if(this.stopped)return;
      const image=token.querySelector('img');
      if(image&&!image.complete)await new Promise(resolve=>{
        const finish=()=>{clearTimeout(timer);image.removeEventListener('load',finish);image.removeEventListener('error',finish);this.abort.signal.removeEventListener('abort',finish);resolve();};
        const timer=setTimeout(finish,5000);image.addEventListener('load',finish,{once:true});image.addEventListener('error',finish,{once:true});this.abort.signal.addEventListener('abort',finish,{once:true});
      });
      if(this.stopped)return;
      const width=parseFloat(token.style.width)||token.clientWidth||55,height=parseFloat(token.style.height)||token.clientHeight||55;
      const container=new PIXI.Container();
      let art,texture;
      if(image?.naturalWidth>0) {
        // Own this texture, rather than leaving each rerendered HTML image in
        // PIXI's global Texture.from cache after the preview is closed.
        texture=new PIXI.Texture(new PIXI.BaseTexture(image));
        art=new PIXI.Sprite(texture);art.anchor.set(.5);
        art.width=parseFloat(image.style.width)||width;art.height=parseFloat(image.style.height)||height;
        if(scene.dataset.fitTokenFx!==undefined&&image.naturalHeight>0) {
          const fit=Math.min(art.width/image.naturalWidth,art.height/image.naturalHeight);
          art.width=image.naturalWidth*fit;art.height=image.naturalHeight*fit;
        }
        const info=this.info.targetList?.find(t=>t.id===token.dataset.previewActor)??this.info[token.dataset.previewToken];
        art.rotation=(info?.rotation??0)*Math.PI/180;
        if(info?.textureScaleX<0)art.scale.x*=-1;if(info?.textureScaleY<0)art.scale.y*=-1;
      } else {
        art=new PIXI.Graphics();const radius=Math.min(width,height)*.43;
        art.lineStyle(2,0xc4b3ff).beginFill(0x35314b).drawCircle(0,0,radius).endFill();
        art.beginFill(0xded5ff).drawCircle(0,-radius*.25,radius*.22).drawRoundedRect(-radius*.43,radius*.12,radius*.86,radius*.44,radius*.15).endFill();
      }
      container.addChild(art);
      const view=scene.ownerDocument.createElement('canvas');view.className='an-tokenfx-preview';view.hidden=true;
      view.setAttribute('aria-label','Token FX preview');token.append(view);
      this.records.push({token,container,art,texture,view,context:view.getContext('2d'),width,height,groups:new Map()});
    }
    if(!this.stopped&&this.records.length)this.renderer=new PIXI.Renderer({width:256,height:256,resolution:1,backgroundAlpha:0,antialias:true,preserveDrawingBuffer:true});
  }
  state(entry,frame) {
    if(frame.muted?.has(entry.stageIndex))return {state:'pending',progress:0,localTime:0,stage:entry.stage};
    return this.recipe.playbackPlan?{...stageFrame({...entry.stage,repeats:1,targetStagger:0},frame.time),stage:entry.stage}:frame.stages[entry.index];
  }
  matches(record,stage) {
    if(record.token.dataset.previewToken!==(stage.subject??'source'))return false;
    if(this.recipe.playbackPlan&&stage.destination?.id&&record.token.dataset.previewActor)return stage.destination.id===record.token.dataset.previewActor;
    return !this.recipe.playbackPlan||stage.subject!=='targets'||Number(record.token.dataset.targetIndex??0)===Number(stage.targetIndex??0);
  }
  draw(frame) {
    if(this.stopped||!this.renderer)return;
    for(const record of this.records) {
      const active=this.entries.filter(e=>this.matches(record,e.stage)&&this.state(e,frame)?.state==='playing');
      if(!active.length){this.clear(record);record.failed=null;continue;}
      const signature=active.map(e=>`${e.index}:${this.state(e,frame).iteration??0}`).join(',');
      if(record.failed===signature){this.clear(record);continue;}
      try {
        const filters=[];
        for(const entry of active) {
          const state=this.state(entry,frame),key=`${entry.index}:${state.iteration??0}`;
          let group=record.groups.get(key);
          if(!group) {
            const preset=entry.preset;
            if(!preset?.params?.length&&!entry.stage.fxLayers?.length)throw Error('Token FX preset unavailable');
            group={filters:previewFilters(preset,entry.stage,{PIXI:this.PIXI,tokenSize:{width:record.width,height:record.height}})};record.groups.set(key,group);
          }
          const speed=entry.stage.fxSpeed??1;
          for(const filter of group.filters) {filter.update(Math.max(0,state.localTime)*speed,this.world()*speed);filters.push(filter);}
        }
        record.art.filters=filters;
        for(const f of filters)f.measure?.(record.art);
        // Room for what the effect actually reaches past the art, so small effects fill the box.
        const pad=Math.min(192,Math.ceil(Math.max(12,...filters.map(f=>Number(f.padding)||0))));
        const size=Math.ceil(Math.max(record.width,record.height,Math.abs(record.art.width),Math.abs(record.art.height))*1.42+pad*2);
        if(this.renderer.width!==size||this.renderer.height!==size)this.renderer.resize(size,size);
        record.art.position.set(size/2,size/2);
        this.renderer.render(record.container);
        if(record.view.width!==size||record.view.height!==size){record.view.width=size;record.view.height=size;record.view.style.width=`${size}px`;record.view.style.height=`${size}px`;}
        if(this.scene.dataset.fitTokenFx!==undefined) {
          const fit=Math.min(1,Math.max(1,this.scene.clientWidth-16)/size,Math.max(1,this.scene.clientHeight-16)/size);
          record.view.style.width=`${size*fit}px`;record.view.style.height=`${size*fit}px`;
        }
        record.context.clearRect(0,0,size,size);record.context.drawImage(this.renderer.view,0,0);
        record.view.hidden=false;record.token.classList.add('an-tokenfx-active');
      } catch(error) {record.failed=signature;this.clear(record);this.scene.dataset.fxError=error.message;}
    }
  }
  clear(record) {record.view.hidden=true;record.token.classList.remove('an-tokenfx-active');record.art.filters=null;}
  stop() {
    if(this.stopped)return;this.stopped=true;this.abort.abort();
    for(const record of this.records) {
      this.clear(record);record.view.remove();
      record.groups.forEach(g=>g.filters.forEach(f=>f.destroy?.()));
      record.container.destroy({children:true,texture:false,baseTexture:false});
      record.texture?.destroy(true);
    }
    this.renderer?.destroy(true);this.records=[];
  }
}
