// The library, its index and search text are built from `actions` when first read, and again once that
// list has grown (its data loads on demand: catalog-data.mjs).
export function createNpcCatalogProfile({systemId,label,actions=[],shared=[],preview,previewShared,ready=true}){
 let built=null,count=-1;
 const build=()=>{
  if(built&&count===actions.length)return built;
  const library=[...shared.map(a=>({...a,coverage:'designed',creatures:[]})),...actions.map(a=>({...a,names:a.names??[a.name],creatures:a.creatures??[],aim:a.form?.aim??a.aim,trigger:a.form?.trigger??a.trigger??'use'}))];
  count=actions.length;
  return built={library,byId:new Map(library.map(a=>[a.id,a])),search:new Map(library.map(a=>[a.id,[...a.names,...a.creatures,...(a.traits??[])].join(' ').toLowerCase()]))};
 };
 return {systemId,label,actions,shared,preview,previewShared,ready,
  get library(){return build().library;},
  get byId(){return build().byId;},
  get search(){return build().search;},
  catalogState:w=>(systemId==='dnd5e'?w.host.dndCatalogState?.('feat'):systemId==='sf2e'?w.host.sfCatalogState?.('action'):w.host.actionCatalogState?.())??{},
 };
}
