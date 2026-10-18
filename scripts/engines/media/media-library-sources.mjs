import {registeredMedia, mergeMedia, libraryItem, safeMediaFile, mediaFolderSources} from './media-library-model.mjs';
import {installedSoundCatalog, SOUND_SOURCE} from '../sound/spell-sounds.mjs';
// Foundry's browse answers URL-encoded paths ("My%20Sounds/..."); a folder source is stored as picked.
const decoded=path=>{try{return decodeURIComponent(path);}catch{return path;}};
const within=(path,root)=>decoded(path).startsWith(decoded(root)+'/');
// FilePicker remains the permission boundary. Scan enabled sound modules and selected folders,
// skip code/non-media files, and report partial discovery instead of hiding it.
export async function installedMediaLibrary({modules,database,browse,folderSources=[],maxFolders=10_000,onProgress}) {
  const entries=registeredMedia(database).map(entry=>({...entry,source:entry.source==='jb2a'
    ? modules?.get?.('jb2a_patreon')?.active?'JB2A Patreon':'JB2A Free'
    : SOUND_SOURCE.packs.find(p=>p.module===entry.source)?.title ?? modules?.get?.(entry.source)?.title ?? entry.source})), failures=[];
  const sounds=installedSoundCatalog(modules,database);
  const inventory=new Map(mergeMedia(entries,sounds.entries??[]).map(item=>[item.id,item]));
  const knownFiles=new Set([...inventory.values()].flatMap(item=>item.files??[item.file]));
  let added=[],lastPublish=performance.now(),lastFolders=0;
  const publish=()=>{
    if(added.length)onProgress?.({entries:added,normalized:true});
    added=[];lastPublish=performance.now();lastFolders=visited.size;
  };
  const jobs=browse?[
    ...mediaFolderSources(folderSources).map(p=>({path:p.path,root:p.path,source:p.name})),
    ...SOUND_SOURCE.packs.filter(p=>modules?.get?.(p.module)?.active).map(p=>({path:`modules/${p.module}`,root:`modules/${p.module}`,source:p.title,type:'audio'})),
  ]:[];
  const visited=new Set();
  const scheduled=new Set(jobs.map(job=>job.path));
  onProgress?.({entries:[...inventory.values()],normalized:true});
  // Large installed packs routinely exceed 600 folders together. Retain a
  // safety budget without truncating ordinary libraries or counting duplicates.
  if(browse)while(jobs.length&&visited.size<maxFolders) {
    const batch=jobs.splice(0,Math.min(4,maxFolders-visited.size));
    await Promise.all(batch.map(async job=>{
      if(visited.has(job.path))return;visited.add(job.path);
      try {
        const result=await browse(job.path);
        for(const file of result.files??[])if(safeMediaFile(file,job.type)&&within(file,job.root)) {
          const item=libraryItem({file,type:job.type,source:job.source});
          if(item&&!inventory.has(item.id)&&!knownFiles.has(file)){inventory.set(item.id,item);knownFiles.add(file);added.push(item);}
        }
        for(const path of result.dirs??[]) {
          if(typeof path==='string'&&within(path,job.root)&&mediaFolderSources([{path}]).length&&!scheduled.has(path)) {
            scheduled.add(path);jobs.push({...job,path});
          }
        }
      } catch(error) {failures.push({path:job.path,error:String(error?.message??error)});}
    }));
    if(added.length&&(added.length>=500||visited.size-lastFolders>=64||performance.now()-lastPublish>=150))publish();
  }
  publish();
  const discovery={folders:visited.size,failures,limitReached:jobs.length>0,remaining:jobs.length};
  const warnings=[];
  if(failures.length)warnings.push(`Some media folders could not be indexed. Browse files to add missing media. ${failures.slice(0,3).map(f=>`${f.path}: ${f.error}`).join(' · ')}${failures.length>3?` (+${failures.length-3})`:''}`);
  if(discovery.limitReached)warnings.push(`Media indexing reached folder limit (${maxFolders}). Browse files to add missing media.`);
  // File identity merges registered and loose audio into one result. Preserve
  // audited duration/gain where a cue also belongs to the curated catalog.
  return {entries:[...inventory.values()],normalized:true,warning:warnings.join(' '),discovery};
}

// One client/session cache across workspace instances. Namespace counts catch
// late Sequencer registrations; module state/version changes invalidate it.
// `store` ({get(key), set(key, result)}) keeps the last index across world reloads under the
// same key, so reopening a world does not rescan; Refresh always rescans. A failing store is ignored.
export class MediaLibraryLoader {
  constructor(sources,{store=null}={}){this.sources=sources;this.store=store;}
  state() {
    const options=this.sources(),{modules,database}=options;
    const packs=modules?.entries?[...modules.entries()].filter(([,m])=>m.active).map(([id,m])=>[id,m.version??m.data?.version??'',m.title??'']).sort()
      :SOUND_SOURCE.packs.map(p=>[p.module,modules?.get?.(p.module)?.active===true]);
    let namespaces;
    try{namespaces=database?.searchFor?.('');}catch{/* Not yet registered. */}
    if(!Array.isArray(namespaces))namespaces=database?.entryExists?.('jb2a')?['jb2a']:[];
    const paths=(Array.isArray(namespaces)?namespaces:[]).filter(n=>typeof n==='string').sort().map(n=>{
      try{return [n,database.getPathsUnder(n,{fullyQualified:true})?.length??0];}catch{return [n,-1];}
    });
    return {options,database,key:JSON.stringify([packs,paths,mediaFolderSources(options.folderSources)])};
  }
  matches(row,state){return row&&row.database===state.database&&row.key===state.key;}
  peek(){const state=this.state();return this.matches(this.cached,state)?this.cached.result:null;}
  load(refresh=false,onProgress) {
    const state=this.state();
    if(refresh)this.cached=null;
    if(!refresh&&this.matches(this.cached,state))return Promise.resolve(this.cached.result);
    if(this.matches(this.pending,state)) {
      if(onProgress){this.pending.listeners.add(onProgress);if(this.pending.available.size)onProgress({entries:[...this.pending.available.values()],normalized:true});}
      return this.pending.promise;
    }
    const row={...state,listeners:new Set(onProgress?[onProgress]:[]),available:new Map()};
    this.pending=row;
    // Defer one microtask so the pending row is installed before callbacks run.
    const progress=part=>{
      for(const item of part.entries)row.available.set(item.id,item);
      for(const listener of row.listeners)listener(part);
    };
    row.promise=Promise.resolve().then(async()=>{
      const saved=refresh?null:await Promise.resolve(this.store?.get(state.key)).catch(()=>null);
      if(Array.isArray(saved?.entries)){if(saved.entries.length)progress({entries:saved.entries,normalized:true});return saved;}
      const result=await installedMediaLibrary({...state.options,onProgress:progress});
      void Promise.resolve(this.store?.set(state.key,result)).catch(()=>{});
      return result;
    }).then(result=>{if(this.pending===row)this.cached={...state,result};return result;})
      .finally(()=>{row.listeners.clear();if(this.pending===row)this.pending=null;});
    return row.promise;
  }
}
