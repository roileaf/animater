export const CATALOG_PAGES = ['spells','feats','actions','features','weapons','items','conditions','effects','npc-abilities'];
export function worldCatalogSystem(environment={}) {
  return ['pf2e','dnd5e','sf2e','daggerheart'].includes(environment.systemId) ? environment.systemId : environment.demo && !environment.systemId ? 'pf2e' : null;
}
const DAGGERHEART_PAGES={spells:'domain card',weapons:'weapon',conditions:'condition'};
export function catalogNavigation(environment={}) {
  const system=worldCatalogSystem(environment);
  if(!system)return [];
  if(system==='daggerheart')return [['spells','✧','Domain cards'],['weapons','➶','Weapons'],['conditions','◎','Conditions']];
  const label=system==='sf2e'?'SF2e':system==='pf2e'?'PF2e':'D&D 5e';
  return [['spells','✧','spells'],['feats','⚔',system==='dnd5e'?'features':'feats'],...(system==='dnd5e'?[]:[['actions','➤','actions'],['features','✦','features']]),['weapons','➶','weapons'],...(system==='dnd5e'?[['items','◇','items']]:[]),['conditions','◎','conditions'],['effects','◌','effects'],['npc-abilities','☠','NPC abilities']].map(([page,icon,name])=>[page,icon,`${label} ${name}`]);
}
// With crossover on, a PF2e world borrows these SF2e catalogs and an SF2e world these PF2e ones,
// each on its own page beside the world's own.
export const BORROWED_PAGES={'sf2e-spells':'spell','sf2e-feats':'feat','sf2e-actions':'action','sf2e-features':'feature','sf2e-weapons':'weapon'};
export const PF2E_BORROWED_PAGES={'pf2e-spells':'spells','pf2e-feats':'feats','pf2e-actions':'actions','pf2e-features':'features','pf2e-weapons':'weapons'};
const BORROWED_NAV=[['spells','✧','spells'],['feats','⚔','feats'],['actions','➤','actions'],['features','✦','features'],['weapons','➶','weapons']];
export const borrowedSystem=(environment={})=>environment.crossover!==true?null:environment.systemId==='pf2e'?'sf2e':environment.systemId==='sf2e'?'pf2e':null;
export function borrowedNavigation(environment={}) {
  const system=borrowedSystem(environment),label=system==='sf2e'?'SF2e':'PF2e';
  return system?BORROWED_NAV.map(([page,icon,name])=>[`${system}-${page}`,icon,`${label} ${name}`]):[];
}
// PF2e catalogs work here: in a PF2e world, or borrowed by an SF2e one.
export const pf2eCatalogsLive=(environment={})=>environment.systemId==='pf2e'||borrowedSystem(environment)==='pf2e';
// The PF2e catalog page shown on `page` (its own name or a borrowed pf2e-* page), or null.
export function pf2eCatalogPage(page,environment={}) {
  if(PF2E_BORROWED_PAGES[page])return borrowedSystem(environment)==='pf2e'?PF2E_BORROWED_PAGES[page]:null;
  const system=worldCatalogSystem(environment);
  return !system||system==='pf2e'?page:null;
}
export function catalogPageAllowed(page,environment) {
  if(BORROWED_PAGES[page]||PF2E_BORROWED_PAGES[page])return borrowedNavigation(environment).some(([allowed])=>allowed===page);
  return !CATALOG_PAGES.includes(page)||catalogNavigation(environment).some(([allowed])=>allowed===page);
}
export const dndSettingKey=kind=>`dnd5e${kind[0].toUpperCase()+kind.slice(1)}Catalog`;
export const sfSettingKey=kind=>`sf2e${kind[0].toUpperCase()+kind.slice(1)}Catalog`;
export const dhSettingKey=kind=>`daggerheart${kind[0].toUpperCase()+kind.slice(1)}Catalog`;
export function catalogPageTitle(page,environment){
 if(PF2E_BORROWED_PAGES[page])return `PF2e ${{spells:'spell',feats:'active feat',actions:'action',features:'feature',weapons:'weapon'}[PF2E_BORROWED_PAGES[page]]} catalog`;
 if(BORROWED_PAGES[page])return `SF2e ${{spell:'spell',feat:'active feat',action:'action',feature:'feature',weapon:'weapon'}[BORROWED_PAGES[page]]} catalog`;
 if(worldCatalogSystem(environment)==='daggerheart'&&CATALOG_PAGES.includes(page))return DAGGERHEART_PAGES[page]?`Daggerheart ${DAGGERHEART_PAGES[page]} catalog`:undefined;
 const system=worldCatalogSystem(environment),kind={spells:'spell',feats:system==='dnd5e'?'active feature':'active feat',actions:system==='dnd5e'?null:'action',features:system==='dnd5e'?null:'feature',weapons:'weapon',items:'activated item',conditions:'condition',effects:'effect','npc-abilities':'NPC ability'}[page];
 return kind?`${system==='sf2e'?'SF2e':system==='dnd5e'?'D&D 5e':'PF2e'} ${kind} catalog`:{recipes:'Animation recipes',finishers:'Finishers',builder:'Build an animation',assets:'Media library',activity:'Playback activity',setup:'Ready for the table',flash:'Flash screens',flagged:'Flagged looks','creature-showcase':'Creature showcase','damage-showcase':'Damage immersion showcase'}[page];
}
// "spells, feats, weapons, conditions and effects": this system's catalogs, for welcome and Setup text.
export function catalogListText(environment = {}) {
  const names = catalogNavigation(environment).filter(([page]) => page !== 'npc-abilities').map(([, , name]) => String(name).replace(/^(PF2e|SF2e|D&D 5e) /, "").toLowerCase());
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : names[0] ?? "catalog entries";
}
