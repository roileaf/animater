export function createNpcCatalogProfile({systemId,label,actions=[],shared=[],preview,previewShared,ready=true}){
 const library=[...shared.map(a=>({...a,coverage:'designed',creatures:[]})),...actions.map(a=>({...a,names:a.names??[a.name],creatures:a.creatures??[],aim:a.form?.aim??a.aim,trigger:a.form?.trigger??a.trigger??'use'}))];
 return {systemId,label,actions,shared,preview,previewShared,ready,library,
  byId:new Map(library.map(a=>[a.id,a])),
  search:new Map(library.map(a=>[a.id,[...a.names,...a.creatures,...(a.traits??[])].join(' ').toLowerCase()])),
  catalogState:w=>(systemId==='dnd5e'?w.host.dndCatalogState?.('feat'):systemId==='sf2e'?w.host.sfCatalogState?.('action'):w.host.actionCatalogState?.())??{},
 };
}
