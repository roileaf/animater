import {readFile} from 'node:fs/promises';
import {databaseEntries} from './asset-databases.mjs';
import {soundInventory} from './sound-databases.mjs';
import {MediaLibrary} from '../scripts/ui/media-library.mjs';
import {mediaGroups} from '../scripts/engines/media/media-library-model.mjs';

// Local installed-data benchmark. No world documents, network or media decoders.
const visuals=(await databaseEntries(await readFile(new URL('../../jb2a_patreon/scripts/jb2a_sequencer.js',import.meta.url),'utf8'),'jb2aPatreonDatabase','patreonDatabase')).map(row=>({...row,source:'JB2A Patreon'}));
const inventory=await soundInventory();
const sounds=inventory.entries.map(row=>({...row,type:'audio',source:row.title}));
const host={catalog:()=>visuals,soundCatalog:()=>({entries:sounds})};
const workspace={host,root:{querySelector:()=>null},stageIndex:0,recipe:()=>null};
const measure=(fn,n=5)=>{
  const times=[];for(let i=0;i<n;i++){const start=performance.now();fn();times.push(performance.now()-start);}
  return Number(times.sort((a,b)=>a-b)[Math.floor(n/2)].toFixed(2));
};
let library;
const result={visuals:visuals.length,sounds:sounds.length,constructorMs:measure(()=>{library=new MediaLibrary(workspace);})};
for(const type of ['animation','audio','all']) {
  library.filters.type=type;
  result[type]={groupMs:measure(()=>mediaGroups(library.items,library.filters,library.prefs)),
    changedHtmlMs:measure(()=>{library.filters.sort=library.filters.sort==='az'?'za':'az';library.html(null);}),
    repeatedHtmlMs:measure(()=>library.html(null))};
}
host.mediaCatalog=()=>({entries:library.items,normalized:true});
result.cachedConstructorMs=measure(()=>new MediaLibrary(workspace));
console.log(JSON.stringify(result,null,2));
