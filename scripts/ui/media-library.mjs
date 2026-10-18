import { uuid } from "../core/uuid.mjs";
import { linkStartModes } from '../engines/playback/choreography.mjs';
import {libraryItem, mergeMedia, appendMedia, mediaGroups, safeMediaFile, visualReference, title, mediaType, matchingMediaVariant, mediaVariantChoices, mediaVariantFacets, tokenFxAssets, mediaFolderSources} from '../engines/media/media-library-model.mjs';
import {validateRecipe, MAX_STAGES} from '../core/model.mjs';
import {patchDOM, reconcileChildren} from './dom-patch.mjs';
import {RecipePreview} from '../engines/preview/recipe-preview.mjs';
import {TELEPORT_STYLES} from '../engines/motion/teleport.mjs';
import { sampleRecipe } from "../engines/playback/composition.mjs";
// A library card's window preview runs in passes this long, looped without a visible restart.
const WINDOW_LOOP_MS=10*60*1000;
const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const svg = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">${{
  animation:'<path d="m13 3-9 11h7l-1 7 10-12h-7z"/>',
  audio:'<path d="M9 18V5l11-2v13M9 9l11-2"/><ellipse cx="6" cy="18" rx="3" ry="2"/><ellipse cx="17" cy="16" rx="3" ry="2"/>',
  image:'<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1"/><path d="m3 17 6-6 4 4 3-3 5 5"/>',
  tokenfx:'<circle cx="12" cy="12" r="7"/><circle cx="12" cy="10" r="2"/><path d="M8 16c0-4 8-4 8 0M3 3v4M1 5h4M21 17v6M18 20h6"/>',
  star:'<path d="m12 3 2.8 5.8 6.4.9-4.6 4.5 1.1 6.3-5.7-3-5.7 3 1.1-6.3-4.6-4.5 6.4-.9z"/>',
  search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
}[name] ?? '<path d="M4 7h16M4 12h16M4 17h16"/>'}</svg>`;
const select = (key,label,values,value) => `<label>${label}<select data-media-filter="${key}" aria-label="${label}">${values.map(([id,name])=>`<option value="${esc(id)}" ${id===value?'selected':''}>${esc(name)}</option>`).join('')}</select></label>`;
const colors = {blue:'#71bfff',green:'#75ddb0',orange:'#ffad70',purple:'#b49aff',red:'#fa858b',yellow:'#ffe38a',white:'#edeff5',black:'#353a47',pink:'#eda2df',grey:'#8c96a8',gray:'#8c96a8',brown:'#b8916d',rainbow:'linear-gradient(90deg,#ef837b,#eace71,#86cbad,#91a8ef)',greenyellow:'linear-gradient(90deg,#72d890,#e9da73)',orangeyellow:'linear-gradient(90deg,#e99863,#e6d675)',purplered:'linear-gradient(90deg,#ae8ff0,#ed7b88)',bluepurple:'linear-gradient(90deg,#76b8ee,#b58aea)',blueteal:'linear-gradient(90deg,#76b8ee,#67cec3)',greenpurple:'linear-gradient(90deg,#72d890,#ae8ff0)',pinkyellow:'linear-gradient(90deg,#eda2df,#e6d675)'};
colors.multicolored = colors.rainbow;
const colorLabel = color => color === 'none' ? 'Original' : title(color);
const sizeLabel = size => !size ? 'Default' : /^\d+x\d+$/.test(size) ? size.replace('x',' × ') : title(size);
// Discovery snapshots already passed libraryItem at the provider boundary.
const mergeSnapshots=(existing,incoming)=>{
  const rows=new Map(existing.map(item=>[item.id,item]));
  for(const item of incoming)rows.set(item.id,rows.has(item.id)?{...rows.get(item.id),...item}:item);
  return [...rows.values()];
};
export function libraryPreferences(value = {}) {
  if(!value||typeof value!=='object')value={};
  const ids = (list,max) => [...new Set(Array.isArray(list) ? list.filter(v=>typeof v==='string'&&v.length<1500) : [])].slice(0,max);
  return {favorites:ids(value.favorites,500),recent:ids(value.recent,60),custom:(Array.isArray(value.custom)?value.custom:[]).map(libraryItem).filter(item=>item&&item.type!=='tokenfx').slice(0,500),sources:mediaFolderSources(value.sources)};
}
export class MediaLibrary {
  constructor(workspace) {
    this.w = workspace;
    this.filters = {type:'animation',search:'',source:'all',category:'all',color:'all',loop:'all',collection:'all',grouped:true,sort:'az'};
    this.prefs = libraryPreferences(workspace.host.mediaPreferences?.());
    const cached=workspace.host.mediaCatalog?.();
    this.items = cached?.normalized
      ?appendMedia(cached.entries,this.prefs.custom,tokenFxAssets(workspace.host.fxCatalog?.()))
      :mergeMedia(workspace.host.catalog(), workspace.host.soundCatalog?.()?.entries ?? [], this.prefs.custom,tokenFxAssets(workspace.host.fxCatalog?.()));
    this.loaded=!!cached?.normalized;
    this.page = 0;
    this.pageSize = 36;
    this.view = 'grid';
    this.preview = {rate:1,volume:.35,loop:true,background:'grid',size:100};
    this.selectedId = null;
    this.file = null;
    this.error = cached?.warning??'';
    this.tokenFx = {subject:'source',duration:3000,tint:''};
    this.fxPreviewEpoch=0;
    this.fxStatus='';
    this.fxArtwork='sample';
  }
  index() {
    if(this.indexedItems===this.items&&this.indexedLength===this.items.length)return this.itemIndex;
    const ids=new Map(),families=new Map(),facets=new Map();
    for(const item of this.items) {
      ids.set(item.id,item);
      const key=`${item.type}:${item.source}:${item.family}`;
      if(!families.has(key))families.set(key,[]);families.get(key).push(item);
      for(const type of ['all',item.type]) {
        if(!facets.has(type))facets.set(type,{count:0,sources:new Set(),categories:new Set(),colors:new Set()});
        const facet=facets.get(type);facet.count++;facet.sources.add(item.source);facet.categories.add(item.category);if(item.color!=='none')facet.colors.add(item.color);
      }
    }
    this.indexedItems=this.items;this.indexedLength=this.items.length;
    return this.itemIndex={ids,families,facets};
  }
  results() {
    const index=this.index(),key=JSON.stringify([this.filters,
      this.filters.collection==='favorites'?this.prefs.favorites:[],this.filters.collection==='recent'?this.prefs.recent:[]]);
    if(this.resultIndex!==index||this.resultKey!==key){this.resultIndex=index;this.resultKey=key;this.result=mediaGroups(this.items,this.filters,this.prefs);}
    return this.result;
  }
  get selected() { return this.index().ids.get(this.selectedId); }
  familyVariants(item = this.selected, group) {
    return !item ? [] : this.filters.grouped
      ? this.index().families.get(`${item.type}:${item.source}:${item.family}`)??[]
      : group?.variants ?? [item];
  }
  render({resetResults=false} = {}) {
    const root=this.w.root.querySelector('.an-media-library');
    if(!root)return;
    void this.stopTokenPreview();
    const list=root.querySelector('.an-asset-list'),detail=root.querySelector('.an-media-detail-body');
    const scroll=list?.scrollTop??0,detailScroll=detail?.scrollTop??0,previous=this.selected;
    const referenceOpen=!!root.querySelector('.an-media-reference[open]');
    const sourcesOpen=!!root.querySelector('.an-media-sources[open]');
    const template=root.ownerDocument.createElement('template');
    template.innerHTML=this.html(this.w.recipe());
    reconcileChildren(root,template.content.firstElementChild);
    if(sourcesOpen)root.querySelector('.an-media-sources')?.setAttribute('open','');
    root.querySelector('.an-asset-list').scrollTop=resetResults?0:scroll;
    const nextDetail=root.querySelector('.an-media-detail-body');
    if(nextDetail)nextDetail.scrollTop=this.sameFamily(previous,this.selected)?detailScroll:0;
    if(referenceOpen&&this.sameFamily(previous,this.selected))root.querySelector('.an-media-reference')?.setAttribute('open','');
    this.syncPreview();
    this.w.observeThumbnails?.();
  }
  sameFamily(a,b) { return a&&b&&a.type===b.type&&a.source===b.source&&a.family===b.family; }
  sourceControls() {
    // Add and Remove stay usable while indexing: a change made mid-scan is indexed when that scan ends.
    const open=this.w.root?.querySelector?.('.an-media-sources')?.open;
    return `<details class="an-media-sources" ${open?'open':''}><summary>Folder sources${this.prefs.sources.length?` (${this.prefs.sources.length})`:''}</summary><div class="an-media-source-panel"><p class="an-hint">Include media from a User Data folder and its subfolders.</p><div class="an-media-source-add"><input data-media-source-name aria-label="Folder source name" maxlength="100" placeholder="Source name (optional)" value="${esc(this.sourceName??'')}"><button data-action="media-source-add" ${!this.w.host.pickMediaFolder?'disabled':''}>+ Add folder</button></div>${this.prefs.sources.map(source=>`<div class="an-media-source-row"><span><b>${esc(source.name)}</b> <small>${esc(source.path)}</small></span><button data-action="media-source-remove" data-path="${esc(source.path)}" aria-label="Remove ${esc(source.name)} folder source">Remove</button></div>`).join('')}</div></details>`;
  }
  inspect(id,{reveal=false} = {}) {
    const previous=this.selected;
    this.choose(id);
    if(!this.selected)return;
    // Choosing a family variant may expand a filtered result set.
    const hiddenByColor=this.filters.color!=='all'&&this.filters.color!==this.selected.color;
    if(reveal&&(hiddenByColor||this.filters.collection!=='all')) {
      if(hiddenByColor)this.filters.color='all';
      this.filters.collection='all';this.render();return;
    }
    const detail=this.w.root.querySelector('.an-media-detail');
    if(!detail)return;
    const top=detail.querySelector('.an-media-detail-body')?.scrollTop??0;
    const referenceOpen=!!detail.querySelector('.an-media-reference[open]');
    const group=this.groups?.find(g=>g.variants.some(v=>v.id===id));
    patchDOM(detail,this.detail(this.selected,group,this.w.recipe()));
    detail.querySelector('.an-media-detail-body').scrollTop=this.sameFamily(previous,this.selected)?top:0;
    if(referenceOpen&&this.sameFamily(previous,this.selected))detail.querySelector('.an-media-reference')?.setAttribute('open','');
    let changedThumbnail=false;
    for(const card of this.w.root.querySelectorAll('.an-media-card')) {
      const active=card.dataset.mediaId===group?.id;
      card.classList.toggle('is-selected',active);
      card.querySelector('.an-media-card-main').setAttribute('aria-pressed',String(active));
      if(active&&card.querySelector('.an-media-card-main').dataset.id!==id) {
        const template=card.ownerDocument.createElement('template');
        template.innerHTML=this.card(group,this.selected);
        reconcileChildren(card,template.content.firstElementChild);
        changedThumbnail=true;
      }
    }
    this.syncPreview();
    if(changedThumbnail)this.w.observeThumbnails?.();
  }
  // A refresh asked for while a scan runs (a folder source added or removed) runs once that scan ends.
  load(refresh = false) {
    if (this.loading) { if (refresh) this.reloadQueued = true; return this.loadPromise; }
    if (this.loaded && !refresh) return Promise.resolve();
    this.loadPromise = this.loadOnce(refresh).then(() => {
      if (!this.reloadQueued || this.w.abort?.signal.aborted) return;
      this.reloadQueued = false;
      return this.load(true);
    });
    return this.loadPromise;
  }
  async loadOnce(refresh) {
    this.loading = true;
    this.error = '';
    let scheduled=null;
    try {
      const result = await this.w.host.loadMediaCatalog?.(refresh,part=>{
        if(this.w.abort?.signal.aborted||!part?.entries?.length)return;
        this.items=part.normalized?mergeSnapshots(this.items,part.entries):appendMedia(this.items,part.entries);
        if(this.w.page!=='assets')return;
        // New audio needn't replace a visible animation/filter preview.
        if(this.filters.type!=='all'&&!part.entries.some(item=>item.type===this.filters.type)){this.syncCounts();return;}
        if(scheduled===null)scheduled=requestAnimationFrame(()=>{
          scheduled=null;if(!this.w.abort?.signal.aborted&&this.w.page==='assets')this.render();
        });
      });
      if (this.w.abort?.signal.aborted) return;
      this.items = result?.normalized
        ?appendMedia(result.entries,this.prefs.custom,tokenFxAssets(this.w.host.fxCatalog?.()))
        :mergeMedia(this.w.host.catalog(), result?.entries ?? result ?? [], this.w.host.soundCatalog?.()?.entries ?? [], this.prefs.custom,tokenFxAssets(this.w.host.fxCatalog?.()));
      if(this.fxHandle&&!this.items.some(v=>v.id===this.selectedId))void this.stopTokenPreview();
      this.error = result?.warning ?? '';
      this.loaded = true;
    } catch (error) { this.error = error.message; }
    finally {
      if(scheduled!==null)cancelAnimationFrame(scheduled);
      this.loading = false;
      if (!this.w.abort?.signal.aborted && this.w.page==='assets') this.render();
    }
  }
  syncCounts() {
    const facets=this.index().facets;
    for(const button of this.w.root.querySelectorAll?.('[data-action="media-type"]')??[]) {
      const count=button.querySelector('small');if(count)count.textContent=(facets.get(button.dataset.value)?.count??0).toLocaleString();
    }
  }
  persist() { void Promise.resolve(this.w.host.setMediaPreferences?.(this.prefs)).catch(error=>{this.error=error.message;}); }
  remember(item) {
    this.prefs.recent = [item.id,...this.prefs.recent.filter(id=>id!==item.id)].slice(0,60);
    this.persist();
  }
  choose(id) {
    if (this.selectedId !== id) {this.file = null;void this.stopTokenPreview();}
    this.selectedId = id;
    if (this.selected) this.remember(this.selected);
  }
  open(type, teleportField = null) {
    const recipe = this.w.recipe();
    this.target = ['teleportOut', 'teleportIn'].includes(teleportField) && recipe
      ? {recipeId:recipe.id,field:teleportField,settingsScroll:this.w.root.querySelector('.an-st-settings')?.scrollTop ?? 0} : null;
    if (type) this.filter('type',type);
    this.filters.collection='all'; this.filters.category='all'; this.filters.color='all'; this.filters.source='all'; this.filters.search=''; this.page=0;
    const stage = recipe?.stages[this.w.stageIndex];
    const reference = this.target ? recipe[teleportField] || TELEPORT_STYLES.blue[teleportField === 'teleportOut' ? 'out' : 'in'] : stage?.assets?.[0];
    let current = this.items.find(item=>type==='tokenfx'?item.type==='tokenfx'&&item.fxPreset===stage?.fxPreset&&item.fxLibrary===stage?.fxLibrary:type==='audio'?item.file===stage?.soundFile:!['audio','tokenfx'].includes(item.type)&&(item.key===reference||item.file===reference||item.files.includes(reference)));
    if (this.target && !current && safeMediaFile(reference)) {
      current = libraryItem({file:reference,source:'Custom files'});
      this.prefs.custom = mergeMedia([current], this.prefs.custom).slice(0,500);
      this.items = appendMedia(this.items, [current]);
    }
    if (this.target && current?.type === 'image') this.filter('type','image');
    if(type==='tokenfx'&&stage?.kind==='tokenfx')this.tokenFx={subject:stage.subject??'source',duration:stage.duration,tint:stage.fxTint??''};
    if (current) this.choose(current.id);
    if (this.target && current && reference !== current.key && current.files.includes(reference)) this.file = reference;
    this.w.page='assets'; this.w.render();
    this.w.root.querySelector('[data-search="assets"]')?.focus();
  }
  backToRecipe() {
    const target = this.target;
    this.target = null;
    this.w.page = 'recipes'; this.w.render();
    if (target) {
      const settings = this.w.root.querySelector('.an-st-settings');
      if (settings) settings.scrollTop = target.settingsScroll;
      this.w.root.querySelector(`[data-action="browse-teleport"][data-field="${target.field}"]`)?.focus({preventScroll:true});
    }
  }
  filter(key,value) {
    void this.stopTokenPreview();
    this.filters[key]=value; this.page=0;
    if (key==='type') {
      this.filters.category='all';this.filters.color='all';this.filters.loop='all';this.preview.loop=value!=='audio';
      if(!this.items.some(v=>(value==='all'||v.type===value)&&v.source===this.filters.source))this.filters.source='all';
    }
  }
  input(target) {
    if(target.hasAttribute?.('data-media-source-name')){this.sourceName=target.value;return true;}
    if(target.dataset.mediaFx) {
      const before=JSON.stringify([this.tokenFx,this.fxArtwork]);
      const key=target.dataset.mediaFx;
      if(key==='duration')this.tokenFx.duration=Math.min(30000,Math.max(500,Number(target.value)||3000));
      if(key==='subject')this.tokenFx.subject=target.value==='targets'?'targets':'source';
      if(key==='tintEnabled')this.tokenFx.tint=target.checked?'#ffffff':'';
      if(key==='tint'&&/^#[\da-f]{6}$/i.test(target.value))this.tokenFx.tint=target.value;
      if(key==='artwork') {
        this.fxArtwork=['source','targets'].includes(target.value)?target.value:'sample';
      }
      if(before===JSON.stringify([this.tokenFx,this.fxArtwork]))return true;
      void this.stopTokenPreview();
      if(key==='artwork') {
        const scene=this.w.root.querySelector('[data-media-fx-scene]');
        if(scene)patchDOM(scene,this.tokenFxArtworkHTML());
      }
      this.syncTokenPreview();void this.auditionTokenFx('window');return true;
    }
    if (target.dataset.search==='assets') {
      if(this.filters.search===target.value)return true;
      this.filter('search',target.value); this.render({resetResults:true}); return true;
    }
    if (target.dataset.mediaPreview) {
      const key=target.dataset.mediaPreview;
      this.preview[key]=['volume','rate','size'].includes(key)?Number(target.value):target.value;
      this.syncPreview(); return true;
    }
    return false;
  }
  change(target) {
    if (target.dataset.mediaFilter) {if(this.filters[target.dataset.mediaFilter]!==target.value){this.filter(target.dataset.mediaFilter,target.value);this.render({resetResults:true});}return true;}
    if (target.hasAttribute('data-media-variant')) {
      if(this.selectedId!==target.value){this.inspect(target.value,{reveal:true});if(this.selected?.type==='tokenfx')void this.auditionTokenFx('window');}
      return true;
    }
    if (target.hasAttribute('data-media-file')) {if(this.file!==(target.value||null)){this.file=target.value||null;this.inspect(this.selectedId);}return true;}
    return this.input(target);
  }
  async action(action,button) {
    if (!action.startsWith('media-')) return false;
    const value=button.dataset.value;
    if (action === 'media-back') {
      await this.stopTokenPreview();
      this.backToRecipe();
      return true;
    }
    if (this.target && action === 'media-type' && !['animation','image'].includes(value)) return true;
    if(action==='media-fx-canvas'){void this.auditionTokenFx('canvas');return true;}
    if (action==='media-type') {if(this.filters.type===value)return true;this.filter('type',value);}
    if (action==='media-collection') {if(this.filters.collection===value)return true;this.filter('collection',value);}
    if (action==='media-variant') {
      const id=button.dataset.id;
      if(id&&id!==this.selectedId){this.inspect(id,{reveal:true});if(this.selected?.type==='tokenfx')void this.auditionTokenFx('window');}
      return true;
    }
    if (action==='media-color'||action==='media-size') {
      const variant = value === undefined ? this.items.find(v=>v.id===button.dataset.id)
        : matchingMediaVariant(this.familyVariants(),this.selected,{[action==='media-color'?'color':'size']:value});
      if(variant&&variant.id!==this.selectedId)this.inspect(variant.id,{reveal:true});
      return true;
    }
    if (action==='media-inspect') {
      if(this.selectedId!==button.dataset.id)this.inspect(button.dataset.id);
      if(this.selected?.type==='audio')return this.action('media-audition',button);
      if(this.selected?.type==='tokenfx')void this.auditionTokenFx('window');
      return true;
    }
    if (action==='media-page') this.page+=Number(value);
    if (action==='media-view') {
      if(this.view===value)return true;
      this.view=value;
      const list=this.w.root.querySelector('.an-asset-list');
      list?.classList.toggle('is-grid',value==='grid');list?.classList.toggle('is-list',value==='list');
      for(const control of this.w.root.querySelectorAll('[data-action="media-view"]'))control.setAttribute('aria-pressed',String(control.dataset.value===value));
      return true;
    }
    if (action==='media-group') {this.filters.grouped=!this.filters.grouped;this.page=0;}
    if (action==='media-clear') {Object.assign(this.filters,{search:'',source:'all',category:'all',color:'all',loop:'all',collection:'all'});this.page=0;}
    if (action==='media-favorite') {
      const id=button.dataset.id;
      this.prefs.favorites=this.prefs.favorites.includes(id)?this.prefs.favorites.filter(v=>v!==id):[id,...this.prefs.favorites].slice(0,500);
      this.persist();
      for(const control of this.w.root.querySelectorAll('[data-action="media-favorite"]')) {
        const on=this.prefs.favorites.includes(control.dataset.id);
        control.classList.toggle('is-favorite',on);control.setAttribute('aria-pressed',String(on));
      }
      if(this.filters.collection==='favorites')this.render();
      return true;
    }
    if (action==='media-refresh') {
      await this.stopTokenPreview();
      await this.w.host.refreshCatalog?.();
      this.loaded=false; void this.load(true); this.render(); return true;
    }
    if (action==='media-preview-loop') {
      this.preview.loop=!this.preview.loop;this.syncPreview();
      button.setAttribute('aria-pressed',String(this.preview.loop));button.textContent=`Loop ${this.preview.loop?'on':'off'}`;
      return true;
    }
    if (action==='media-audition') {
      const audio=this.w.root.querySelector('[data-library-preview]');
      if (audio?.tagName==='AUDIO') {
        if (audio.paused) {
          this.w.root.querySelectorAll('audio').forEach(other=>{if(other!==audio)other.pause();});
          try{await audio.play();}catch(error){if(error.name!=='AbortError')throw error;}
        }
        else audio.pause();
      }
      return true;
    }
    if(action==='media-source-add') {
      const name=this.sourceName??this.w.root.querySelector('[data-media-source-name]')?.value??'';
      this.w.host.pickMediaFolder?.(async path=>{
        if(this.w.abort?.signal.aborted)return;
        const [source]=mediaFolderSources([{path,name}]);
        if(!source){this.error='Choose a folder in User Data.';this.render();return;}
        const next=mediaFolderSources([...this.prefs.sources,source]);
        if(!next.some(row=>row.path===source.path)){this.error='Folder source limit reached (50). Remove a source first.';this.render();return;}
        try {
          await this.w.host.setMediaPreferences?.({...this.prefs,sources:next});
          this.prefs.sources=next;this.sourceName='';
          this.filters.source=source.name;this.filters.collection='all';this.filters.search='';this.filters.category='all';this.filters.color='all';this.filters.loop='all';this.page=0;
          await this.load(true);
        } catch(error){this.error=error.message;this.render();}
      });
      return true;
    }
    if(action==='media-source-remove') {
      const next=this.prefs.sources.filter(source=>source.path!==button.dataset.path);
      await this.w.host.setMediaPreferences?.({...this.prefs,sources:next});
      this.prefs.sources=next;this.filters.source='all';this.page=0;
      await this.load(true);
      return true;
    }
    if (action==='media-import') {
      const epoch=this.w.selected,importType=this.filters.type;
      this.w.host.pickMedia?.(importType==='audio'?'audio':'imagevideo',this.selected?.file??'',file=>{
        if(this.w.abort?.signal.aborted)return;
        const path=file.replace(/^\//,'');
        const type=importType==='audio'?'audio':mediaType(path);
        if(!safeMediaFile(path,type)){this.error='Unsupported file path.';this.render();return;}
        const item=libraryItem({file:path,type,source:'Custom files'});
        this.prefs.custom=mergeMedia([item],this.prefs.custom).slice(0,500);
        this.items=mergeMedia(this.items,[item]);this.filter('type',type);this.filters.source='all';this.filters.category='all';this.filters.color='all';this.filters.loop='all';this.filters.search='';this.choose(item.id);this.persist();
        if(this.w.selected!==epoch)this.error='File added to library. Select a recipe to apply it.';
        this.render({resetResults:true});
      });
      return true;
    }
    if(action==='media-apply'||action==='media-add') {
      const item=this.selected;
      if(!item||!this.w.recipe())return true;
      if (this.target) {
        if (this.target.recipeId !== this.w.recipe().id) throw Error('Recipe changed. Reopen the teleport asset picker.');
        if (action !== 'media-apply' || !['animation', 'image'].includes(item.type)) return true;
        const reference = this.file ?? item.key ?? item.file;
        // Validate before editing so a bad custom reference never dirties the recipe.
        if (!visualReference(reference)) throw Error('Choose a database key or relative visual media file.');
        this.w.stopEditorPreview?.();
        this.w.edit()[this.target.field] = reference;
        await this.stopTokenPreview(); this.remember(item);
        this.backToRecipe();
        return true;
      }
      const r=this.w.edit();
      let stage=r.stages[this.w.stageIndex];
      if(action==='media-add') {
        if(r.stages.length>=MAX_STAGES)throw Error(`Recipes support up to ${MAX_STAGES} stages.`);
        const linked=r.lifecycle==='document'&&r.trigger==='effect';
        const next=validateRecipe({id:'media-stage',name:'Stage',trigger:linked?'effect':'manual',lifecycle:linked?'document':undefined,stages:[item.type==='tokenfx'
          ? {...this.tokenFxStage(),subject:linked?'source':this.tokenFx.subject,persist:linked}
          : item.type==='audio'
          ? {kind:'sound',soundFile:this.file??item.file,duration:1500,volume:this.preview.volume}
          : {kind:'cast',assets:[this.file??item.key??item.file],duration:1500,scale:1}]}).stages[0];
        next.stageId=uuid();next.label=item.label;
        if(!linked&&r.stages.length){next.startMode=item.type==='audio'||item.type==='tokenfx'?'with':'after';next.startRef=r.stages.at(-1).stageId;next.startOffset=0;}
        r.stages.push(next);linkStartModes(r.stages);this.w.stageIndex=r.stages.length-1;stage=next;
      }
      if(item.type==='tokenfx') {
        if(stage.kind!=='tokenfx')throw Error('Select a Tokenshade stage or add a token filter stage.');
        stage.fxPreset=item.fxPreset;stage.fxLibrary=item.fxLibrary;stage.assets=[];delete stage.fxLayers;
        delete stage.catalogFx;delete stage.fxProfile;
      } else if(item.type==='audio') {
        if(stage.kind!=='sound')throw Error('Select a sound stage or add a sound stage.');
        stage.soundFile=this.file??item.file;delete stage.optionalSound;
        const duration=Number(this.w.root.querySelector('audio[data-library-preview]')?.duration)*1000;
        if(Number.isFinite(duration)&&duration>0)stage.duration=Math.min(60000,Math.max(100,Math.round(duration)));
      } else {
        if(['sound','motion','sprite','tokenfx','scenefx'].includes(stage.kind))throw Error('Select an effect stage or add an effect stage.');
        stage.assets=[this.file??item.key??item.file];
      }
      await this.stopTokenPreview();this.remember(item);this.w.page='recipes';this.w.render();return true;
    }
    this.render({resetResults:true}); return true;
  }
  tokenFxStage() {
    return {kind:'tokenfx',assets:[],fxPreset:this.selected?.fxPreset,fxLibrary:this.selected?.fxLibrary,
      fxTint:this.tokenFx.tint,subject:this.w.recipe()?.lifecycle==='document'?'source':this.tokenFx.subject,duration:this.tokenFx.duration};
  }
  async stopTokenPreview() {
    ++this.fxPreviewEpoch;
    const handle=this.fxHandle;this.fxHandle=null;this.fxScene=null;this.fxStatus='';
    this.syncTokenPreview();
    try{await handle?.stop();}catch(error){this.fxStatus=error.message;this.syncTokenPreview();}
  }
  async auditionTokenFx(mode='window') {
    if(this.selected?.type!=='tokenfx')return;
    if((mode==='window'&&!this.w.host.createTokenFxPreview)||(mode==='canvas'&&!this.w.host.previewTokenFx))return;
    const stage=this.tokenFxStage(),pendingStop=this.stopTokenPreview(),epoch=this.fxPreviewEpoch;
    await pendingStop;
    if(epoch!==this.fxPreviewEpoch||this.w.abort?.signal.aborted)return;
    this.fxStatus='Starting preview…';this.syncTokenPreview();
    try {
      let handle;
      if(mode==='window') {
        const scene=this.w.root.querySelector('[data-media-fx-scene]');
        if(!scene)throw Error('Token preview is not open.');
        delete scene.dataset.fxError;
        // The card shows the effect continuously (one long pass, looped) until another
        // card is chosen or the library closes; the stage duration only applies to recipes.
        const recipe=validateRecipe({id:'media-tokenfx-preview',name:this.selected.label,trigger:'manual',
          stages:[{...stage,subject:'source',persist:false}]});
        // Preview-only timing, never saved: past the recipe stage limit on purpose.
        const timed=sampleRecipe(recipe);timed.stages[0].duration=WINDOW_LOOP_MS;
        const run=new RecipePreview(scene,timed,()=>{
          // Defer until RecipeClock has registered this frame's handle, so a
          // failed first draw also cancels cleanly instead of reporting Playing.
          if(scene.dataset.fxError)queueMicrotask(()=>run.stop());
        }, {tokenFx:async(s,r)=>{
          const preview=await this.w.host.createTokenFxPreview(s,r);
          if(!preview)throw Error('Tokenshade is turned off.');
          return preview;
        }});
        this.fxScene=scene;
        handle={stop:()=>{if(!run.abort.signal.aborted)run.stop();}};
        this.fxHandle=handle;
        await run.prepareTokenFx();
        if(scene.dataset.fxError)throw Error(`${scene.dataset.fxError}. Use canvas preview for this preset.`);
        handle.done=run.play({loop:()=>epoch===this.fxPreviewEpoch});
      } else handle=await this.w.host.previewTokenFx(stage);
      if(epoch!==this.fxPreviewEpoch||this.w.abort?.signal.aborted){await handle.stop();return;}
      this.fxHandle=handle;this.fxStatus=mode==='window'?'Playing in window':'Playing on canvas · only you can see this';this.syncTokenPreview();
      await handle.done;
      if(epoch===this.fxPreviewEpoch&&mode==='window')await handle.stop();
      if(epoch===this.fxPreviewEpoch&&this.fxScene?.dataset.fxError)
        throw Error(`${this.fxScene.dataset.fxError}. Use canvas preview for this preset.`);
      if(epoch===this.fxPreviewEpoch)this.fxStatus='Preview finished';
    } catch(error) {if(epoch===this.fxPreviewEpoch)this.fxStatus=error.message;}
    finally {if(epoch===this.fxPreviewEpoch){this.fxHandle=null;this.fxScene=null;this.syncTokenPreview();}}
  }
  syncTokenPreview() {
    const root=this.w.root;
    if(this.fxScene&&this.fxScene!==root.querySelector('[data-media-fx-scene]')) {
      void this.stopTokenPreview();return;
    }
    const status=root.querySelector('[data-media-fx-status]');if(status)status.textContent=this.fxStatus;
    const playing=!!this.fxHandle||this.fxStatus==='Starting preview…';
    const canvas=root.querySelector('[data-action="media-fx-canvas"]');
    if(canvas)canvas.disabled=playing||!this.w.host.previewTokenFx||this.w.host.environment?.().demo===true;
    const tint=root.querySelector('[data-media-fx="tint"]');if(tint)tint.disabled=!this.tokenFx.tint||!this.selected?.tintable;
  }
  tokenFxArtworkHTML() {
    const info=this.fxArtwork==='sample'?null:this.w.host.previewTokens?.()?.[this.fxArtwork];
    const file=info?.img??'icons/svg/mystery-man.svg';
    const img=this.w.host.mediaURL?.(file)??file;
    return `<div class="an-tokenfx-sample" data-preview-token="source" style="width:112px;height:112px"><div class="an-preview-token-art"><img src="${esc(img)}" alt="${esc(info?.name??'Sample token')}" style="width:112px;height:112px"></div></div>`;
  }
  syncPreview() {
    this.syncTokenPreview();
    const box=this.w.root.querySelector('.an-media-preview');
    if(!box)return;
    box.dataset.background=this.preview.background;
    box.style.setProperty('--media-size',`${this.preview.size}%`);
    for(const node of box.querySelectorAll('video,audio')) {node.playbackRate=this.preview.rate;node.volume=this.preview.volume;node.loop=this.preview.loop;}
    const volume=this.w.root.querySelector('[data-media-volume-value]');if(volume)volume.textContent=`${Math.round(this.preview.volume*100)}%`;
    const size=this.w.root.querySelector('[data-media-size-value]');if(size)size.textContent=`${this.preview.size}%`;
  }
  html(recipe) {
    const {groups,count}=this.results();
    this.groups=groups;
    this.page=Math.max(0,Math.min(this.page,Math.ceil(groups.length/this.pageSize)-1));
    const visible=groups.slice(this.page*this.pageSize,(this.page+1)*this.pageSize);
    if(!groups.some(g=>g.variants.some(v=>v.id===this.selectedId))){void this.stopTokenPreview();this.selectedId=visible[0]?.variants[0]?.id??null;this.file=null;}
    const selected=this.selected;
    const group=groups.find(g=>g.variants.some(v=>v.id===selected?.id));
    const facets=this.index().facets,facet=facets.get(this.filters.type);
    const sources=[...(facet?.sources??[])].sort(),categories=[...(facet?.categories??[])].sort(),palette=[...(facet?.colors??[])].sort();
    return `<section class="an-media-library" aria-label="Media library">
      <div class="an-media-toolbar"><div class="an-media-types" role="group" aria-label="Media type">${[['animation','Animations'],['audio','Sounds'],['image','Images'],['tokenfx','Tokenshade'],['all','All media']].filter(([id])=>!this.target||['animation','image'].includes(id)).map(([id,label])=>`<button data-action="media-type" data-value="${id}" aria-pressed="${this.filters.type===id}" class="${this.filters.type===id?'is-selected':''}">${svg(id)}${label}<small>${(facets.get(id)?.count??0).toLocaleString()}</small></button>`).join('')}</div><div class="an-media-tools">${this.sourceControls()}${this.filters.type==='tokenfx'?'':`<button data-action="media-import" ${this.w.host.pickMedia?'':'disabled'}>+ Browse files</button>`}<button data-action="media-refresh" ${this.loading?'disabled':''}>${this.loading?'Loading…':'Refresh'}</button></div></div>
      <div class="an-media-search-row"><div class="an-search">${svg('search')}<input data-search="assets" aria-label="Search media" placeholder="Search effects, weapons, creatures, colors, sounds…" value="${esc(this.filters.search)}"></div><div class="an-media-collections" role="group" aria-label="Library collection">${[['all','Library'],['favorites','Favorites'],['recent','Recent']].map(([id,label])=>`<button data-action="media-collection" data-value="${id}" aria-pressed="${this.filters.collection===id}" class="${this.filters.collection===id?'is-selected':''}">${label}</button>`).join('')}</div></div>
      <div class="an-media-filters">${select('source','Source',[['all','All sources'],...sources.map(v=>[v,v])],this.filters.source)}${select('category','Category',[['all','All categories'],...categories.map(v=>[v,v])],this.filters.category)}${['audio','tokenfx'].includes(this.filters.type)?'':select('color','Color',[['all','All colors'],...palette.map(v=>[v,title(v)])],this.filters.color)}${this.filters.type==='tokenfx'?'':select('loop','Playback',[['all','Any playback'],['loop','Loops'],['one','Other clips']],this.filters.loop)}${select('sort','Sort',[['az','Name A–Z'],['za','Name Z–A']],this.filters.sort)}<button data-action="media-clear" class="an-media-reset">Reset</button></div>
      ${this.error?`<div class="an-media-notice" role="status">${esc(this.error)}</div>`:''}
      <div class="an-media-context">${recipe?`<span><b>${esc(recipe.name)}</b> · ${this.target ? `Teleport ${this.target.field === 'teleportOut' ? 'departure' : 'arrival'} effect` : `Stage ${this.w.stageIndex+1}: ${esc(this.w.stageLabel(recipe.stages[this.w.stageIndex]))}`}</span><button data-action="media-back">Back to recipe</button>`:'<span>Select a recipe to insert media.</span>'}</div>
      <div class="an-media-work"><div class="an-media-results"><div class="an-media-result-bar"><span><b>${groups.length.toLocaleString()}</b> ${this.filters.grouped?'families':'results'} <small>· ${count.toLocaleString()} variants</small></span><div><button data-action="media-group" aria-pressed="${this.filters.grouped}">${this.filters.grouped?'Group variants':'Show variants'}</button><button data-action="media-view" data-value="grid" aria-label="Grid view" aria-pressed="${this.view==='grid'}">▦</button><button data-action="media-view" data-value="list" aria-label="List view" aria-pressed="${this.view==='list'}">☰</button></div></div>
      <div class="an-asset-list an-media-cards is-${this.view}">${visible.map(g=>this.card(g,selected)).join('')||`<div class="an-media-empty">${svg(this.filters.type)}<h2>${this.filters.collection==='favorites'?'No favorites yet':this.filters.collection==='recent'?'No recent picks':'No matching media'}</h2><p>${this.filters.type==='tokenfx'?(this.w.host.fxCatalog?.().tokenReady?'Change filters to see installed presets.':'Turn on token filters in Animater settings, then refresh.'):this.filters.type==='audio'?'Activate a sound pack or browse your own audio files.':'Change filters or browse your own files.'}</p><button data-action="media-clear">Reset filters</button></div>`}</div>
      <div class="an-media-pagination"><span>${groups.length?`${this.page*this.pageSize+1}–${Math.min((this.page+1)*this.pageSize,groups.length)} of ${groups.length.toLocaleString()}`:'0 results'}</span><div><button data-action="media-page" data-value="-1" ${this.page===0?'disabled':''} aria-label="Previous media page">←</button><span>${this.page+1} / ${Math.max(1,Math.ceil(groups.length/this.pageSize))}</span><button data-action="media-page" data-value="1" ${(this.page+1)*this.pageSize>=groups.length?'disabled':''} aria-label="Next media page">→</button></div></div></div>
      <aside class="an-media-detail">${selected?this.detail(selected,group,recipe):'<div class="an-media-empty">Select media to preview.</div>'}</aside></div></section>`;
  }
  card(group,selected) {
    const item=group.variants.find(v=>v.id===selected?.id)??group.variants[0];
    const active=group.variants.some(v=>v.id===selected?.id);
    const palette=[...new Set(group.variants.map(v=>v.color))].filter(v=>colors[v]);
    const url=this.w.host.mediaURL?.(item.file)??item.file;
    if(item.type==='tokenfx')return `<article data-media-id="${esc(group.id)}" class="an-media-card ${active?'is-selected':''}"><button class="an-media-card-main" data-action="media-inspect" data-id="${esc(item.id)}" aria-pressed="${active}" aria-label="Inspect ${esc(group.label)}"><span class="an-media-thumbnail is-tokenfx">${svg('tokenfx')}<span class="an-thumb-state">Token filter</span><span class="an-media-variant-count">${group.variants.length>1?`${group.variants.length} libraries`:'Live FX'}</span></span><span class="an-media-card-copy"><b>${esc(group.label)}</b><small>${esc(item.category)} · ${esc(item.filterTypes.map(title).join(', ')||'Native preset')}</small></span></button><button class="an-media-star ${this.prefs.favorites.includes(item.id)?'is-favorite':''}" data-action="media-favorite" data-id="${esc(item.id)}" aria-label="Favorite ${esc(group.label)}" aria-pressed="${this.prefs.favorites.includes(item.id)}">${svg('star')}</button></article>`;
    return `<article data-media-id="${esc(group.id)}" class="an-media-card ${active?'is-selected':''}"><button class="an-media-card-main" data-action="media-inspect" data-id="${esc(item.id)}" aria-pressed="${active}" aria-label="Preview ${esc(group.label)}"><span class="an-media-thumbnail ${item.type==='audio'?'is-audio':'an-asset-thumb'}">${item.type==='animation'?`<video muted playsinline loop preload="none" src="${esc(url)}" aria-hidden="true"></video><span class="an-thumb-state">Preview</span>`:item.type==='image'?`<img src="${esc(url)}" alt="" loading="lazy">`:`${svg('audio')}<span>Listen</span>`}<span class="an-media-variant-count">${group.variants.length>1?`${group.variants.length} variants`:item.type==='audio'?'Audio':item.loop?'Loop':'Clip'}</span></span><span class="an-media-card-copy"><b>${esc(group.label)}</b><small>${esc(item.source)} · ${esc(item.category)}</small><span class="an-media-swatches">${palette.slice(0,7).map(v=>`<i style="background:${colors[v]}" data-tooltip="${esc(title(v))}"></i>`).join('')}</span></span></button><button class="an-media-star ${this.prefs.favorites.includes(item.id)?'is-favorite':''}" data-action="media-favorite" data-id="${esc(item.id)}" aria-label="Favorite ${esc(group.label)}" aria-pressed="${this.prefs.favorites.includes(item.id)}">${svg('star')}</button></article>`;
  }
  detail(item,group,recipe) {
    if(item.type==='tokenfx')return this.tokenFxDetail(item,group,recipe);
    const url=this.w.host.mediaURL?.(this.file??item.file)??this.file??item.file;
    const stage=recipe?.stages[this.w.stageIndex];
    const compatible=this.target ? recipe?.id===this.target.recipeId && ['animation','image'].includes(item.type) : stage&&(item.type==='audio'?stage.kind==='sound':!['sound','motion','sprite','tokenfx','scenefx'].includes(stage.kind));
    const variants=this.familyVariants(item,group);
    const choices=mediaVariantChoices(variants,item);
    const remainingVariants=item.type==='audio'?variants:choices.variants;
    return `<div class="an-media-detail-body"><div class="an-media-detail-heading"><div><small>${esc(item.source)}</small><h2>${esc(item.label)}</h2></div><button class="an-media-star ${this.prefs.favorites.includes(item.id)?'is-favorite':''}" data-action="media-favorite" data-id="${esc(item.id)}" aria-label="Favorite selected media" aria-pressed="${this.prefs.favorites.includes(item.id)}">${svg('star')}</button></div>
      <div class="an-media-preview" data-background="${this.preview.background}" style="--media-size:${this.preview.size}%">${item.type==='audio'?`<div class="an-media-audio-art">${svg('audio')}<span>${esc(item.category)}</span><button data-action="media-audition">Play / pause</button></div><audio controls preload="metadata" src="${esc(url)}" data-library-preview data-media-id="${esc(item.id)}" aria-label="Sound library preview"></audio>`:item.type==='image'?`<img src="${esc(url)}" alt="${esc(item.label)}">`:`<video controls autoplay muted playsinline ${this.preview.loop?'loop':''} src="${esc(url)}" data-library-preview data-media-id="${esc(item.id)}" aria-label="Animation library preview"></video>`}<span class="an-media-preview-error" hidden>Preview unavailable</span></div>
      <div class="an-media-preview-settings">${item.type==='audio'?`<label>Volume <output data-media-volume-value>${Math.round(this.preview.volume*100)}%</output><input type="range" min="0" max="1" step="0.05" data-media-preview="volume" value="${this.preview.volume}" aria-label="Preview volume"></label>`:`<label>Background<select data-media-preview="background" aria-label="Preview background">${['grid','dark','light'].map(v=>`<option value="${v}" ${this.preview.background===v?'selected':''}>${title(v)}</option>`).join('')}</select></label><label>Zoom <output data-media-size-value>${this.preview.size}%</output><input type="range" min="25" max="150" step="5" data-media-preview="size" value="${this.preview.size}" aria-label="Preview zoom"></label>`}${item.type==='image'?'':`<label>Speed<select data-media-preview="rate" aria-label="Preview speed">${[.5,.75,1,1.25,1.5,2].map(v=>`<option value="${v}" ${this.preview.rate===v?'selected':''}>${v}×</option>`).join('')}</select></label><button data-action="media-preview-loop" aria-pressed="${this.preview.loop}">Loop ${this.preview.loop?'on':'off'}</button>`}</div>
      ${item.type!=='audio'&&choices.colors.length>1?`<div class="an-media-variant-section"><div class="an-media-variant-heading">Color <span>${esc(colorLabel(item.color))}</span></div><div class="an-media-color-picks" role="group" aria-label="Asset color">${choices.colors.map(({value:color,selected,available})=>`<button data-action="media-color" data-value="${esc(color)}" aria-label="Preview ${esc(colorLabel(color))} variant" aria-pressed="${selected}" ${available?'':'disabled'} data-tooltip="${esc(colorLabel(color))}${available?'':' · unavailable in this size'}"><i style="background:${colors[color]??'#414a5d'}" class="${color==='none'?'is-original':''}"></i></button>`).join('')}</div></div>`:''}
      ${item.type!=='audio'&&choices.sizes.some(c=>c.value)?`<div class="an-media-variant-section"><div class="an-media-variant-heading">Size</div><div class="an-media-size-picks" role="group" aria-label="Asset size">${choices.sizes.map(({value:size,selected,available})=>`<button data-action="media-size" data-value="${esc(size)}" aria-label="Preview ${esc(sizeLabel(size))} size" aria-pressed="${selected}" ${available?'':'disabled'} data-tooltip="${esc(sizeLabel(size))}${available?'':' · unavailable in this color'}">${esc(sizeLabel(size))}</button>`).join('')}</div></div>`:''}
      ${item.type==='audio'?(remainingVariants.length>1?`<label class="an-media-variant-label">Variant<select data-media-variant aria-label="Asset variant">${remainingVariants.map(v=>`<option value="${esc(v.id)}" ${item.id===v.id?'selected':''}>${esc(v.file.split('/').at(-1))}</option>`).join('')}</select></label>`:'')
        :mediaVariantFacets(remainingVariants,item).map(row=>`<div class="an-media-variant-section"><div class="an-media-variant-heading">${esc(row.label)} <span>${esc(row.chips.find(c=>c.selected)?.label??'')}</span></div><div class="an-media-size-picks an-media-variant-picks" role="group" aria-label="${esc(row.label)}">${row.chips.map(c=>`<button data-action="media-variant" data-id="${esc(c.id??'')}" aria-pressed="${c.selected}" ${c.id?'':'disabled'} data-tooltip="${esc(c.label)}">${esc(c.label)}</button>`).join('')}</div></div>`).join('')}
      ${item.files.length>1?`<label class="an-media-variant-label">File variation<select data-media-file aria-label="File variation"><option value="" ${this.file?'':'selected'}>Database default · sample preview</option>${item.files.map(file=>`<option value="${esc(file)}" ${this.file===file?'selected':''}>${esc(file.split('/').at(-1))}</option>`).join('')}</select></label>`:''}
      <div class="an-media-tags"><span>${esc(item.category)}</span><span>${item.type==='audio'?'Audio':title(item.color==='none'?item.type:item.color)}</span><span>${esc((this.file??item.file).split('.').at(-1).toUpperCase())}</span>${item.width&&item.height?`<span>${item.width} × ${item.height}</span>`:''}</div>
      <details class="an-media-reference"><summary>Media reference</summary><code>${esc(item.key??item.file)}</code><small>${esc(this.file??item.file)}</small></details></div>
      <div class="an-media-insert"><button class="an-primary" data-action="media-apply" ${compatible?'':'disabled'}>${this.target ? `Use ${this.target.field === 'teleportOut' ? 'departure' : 'arrival'} effect` : `${item.type==='audio'?'Use sound':'Use asset'} · stage ${this.w.stageIndex+1}`}</button>${this.target ? '' : `<button data-action="media-add" ${recipe&&recipe.stages.length<MAX_STAGES?'':'disabled'}>+ Add ${item.type==='audio'?'sound':'effect'} stage</button>`}<small>${!recipe?'Select a recipe first.':compatible?'Updates draft. Save recipe when ready.':this.target?'Choose an animation or image for the teleport effect.':`Current stage is ${esc(stage?.kind)}. Add a ${item.type==='audio'?'sound':'effect'} stage to use this media.`}</small></div>`;
  }
  tokenFxDetail(item,group,recipe) {
    const variants=this.familyVariants(item,group),stage=recipe?.stages[this.w.stageIndex];
    const compatible=stage?.kind==='tokenfx',linked=recipe?.lifecycle==='document';
    const available=!!this.w.host.previewTokenFx&&this.w.host.environment?.().demo!==true;
    const windowAvailable=!!this.w.host.createTokenFxPreview,tokens=this.w.host.previewTokens?.()??{};
    return `<div class="an-media-detail-body"><div class="an-media-detail-heading"><div><small>Tokenshade</small><h2>${esc(item.label)}</h2></div><button class="an-media-star ${this.prefs.favorites.includes(item.id)?'is-favorite':''}" data-action="media-favorite" data-id="${esc(item.id)}" aria-label="Favorite selected media" aria-pressed="${this.prefs.favorites.includes(item.id)}">${svg('star')}</button></div>
      <div class="an-media-preview an-tokenfx-scene" data-media-fx-scene data-fit-token-fx data-background="${esc(this.preview.background)}" aria-label="Token filter preview">${this.tokenFxArtworkHTML()}</div>
      <div class="an-media-preview-settings"><label>Artwork<select data-media-fx="artwork" aria-label="Preview token artwork"><option value="sample" ${this.fxArtwork==='sample'?'selected':''}>Sample token</option><option value="source" ${this.fxArtwork==='source'?'selected':''} ${tokens.source?.img?'':'disabled'}>Source image</option><option value="targets" ${this.fxArtwork==='targets'?'selected':''} ${tokens.targets?.img?'':'disabled'}>Target image</option></select></label><label>Background<select data-media-preview="background" aria-label="Preview background">${['grid','dark','light'].map(v=>`<option value="${v}" ${this.preview.background===v?'selected':''}>${title(v)}</option>`).join('')}</select></label></div>
      <p class="an-tokenfx-status" data-media-fx-status role="status">${esc(this.fxStatus)}</p>
      <div class="an-media-tags">${item.filterTypes.map(type=>`<span>${esc(title(type))}</span>`).join('')}<span>${esc(item.category)}</span></div>
      ${variants.length>1?`<label class="an-media-variant-label">Preset library<select data-media-variant aria-label="Preset library">${variants.map(v=>`<option value="${esc(v.id)}" ${v.id===item.id?'selected':''}>${v.fxLibrary==='tmfx-main'?'Token presets':v.fxLibrary==='animater-custom'?'My presets':'Region presets'}</option>`).join('')}</select></label>`:`<p class="an-hint">${item.fxLibrary==='tmfx-main'?'Token presets':item.fxLibrary==='animater-custom'?'My presets':'Region presets'}</p>`}
      <div class="an-tokenfx-settings"><strong>Preview & new stage</strong><label>Apply to<select data-media-fx="subject" aria-label="Token filter subject" ${linked?'disabled':''}><option value="source" ${linked||this.tokenFx.subject==='source'?'selected':''}>${linked?'Affected token':'Selected source'}</option><option value="targets" ${!linked&&this.tokenFx.subject==='targets'?'selected':''}>Targeted tokens</option></select></label><label>Preview duration (ms)<input type="number" data-media-fx="duration" min="500" max="30000" step="100" value="${this.tokenFx.duration}" aria-label="Token filter duration"></label><label class="an-tokenfx-check"><input type="checkbox" data-media-fx="tintEnabled" ${this.tokenFx.tint?'checked':''} ${item.tintable?'':'disabled'}>Override preset color</label><input type="color" data-media-fx="tint" aria-label="Token filter color" value="${esc(this.tokenFx.tint||'#ffffff')}" ${this.tokenFx.tint&&item.tintable?'':'disabled'}>
      <p class="an-hint">${windowAvailable?'Window preview uses a copy of the artwork.':'Window preview needs Tokenshade turned on.'}</p><button data-action="media-fx-canvas" ${available?'':'disabled'}>Preview on canvas</button></div>
      <details class="an-media-reference"><summary>Preset reference</summary><code>${esc(item.fxPreset)}</code><small>${esc(item.fxLibrary)}</small></details></div>
      <div class="an-media-insert"><button class="an-primary" data-action="media-apply" ${compatible?'':'disabled'}>Use preset · stage ${this.w.stageIndex+1}</button><button data-action="media-add" ${recipe&&recipe.stages.length<MAX_STAGES?'':'disabled'}>+ Add token filter stage</button><small>${!recipe?'Select a recipe first.':compatible?'Keeps stage placement, timing and color. Save recipe when ready.':linked?'Filter stays while its native condition or effect is active.':'Adds a draft stage using the preview settings.'}</small></div>`;
  }
}
