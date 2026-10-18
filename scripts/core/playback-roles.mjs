// Roles are descriptive data, never token IDs inferred from a chat author.
export function normalizePlaybackRoles(value) {
 if(!value || value.automatic!=='requires-role-resolution')return null;
 const text=v=>typeof v==='string'?v.trim().slice(0,800):'';
 const role=v=>text(v).slice(0,80);
 const list=values=>(Array.isArray(values)?values:[]).map(role).filter(Boolean).slice(0,12);
 return {source:role(value.source),targets:list(value.targets),requiresSource:value.requiresSource===true,requiresTargets:value.requiresTargets===true,automatic:'requires-role-resolution',reason:text(value.reason)||'This animation needs explicit native performer and recipient roles. Use a manual preview with the correct tokens.',
  ...(value.sourceAlternatives?{sourceAlternatives:list(value.sourceAlternatives)}:{}),...(value.multiplePerformers?{multiplePerformers:true,performers:list(value.performers)}:{})};
}
