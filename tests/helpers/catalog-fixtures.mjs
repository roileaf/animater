import {PF2E_SPELLS} from '../../scripts/catalogs/pf2e/spells/spell-catalog.mjs';

// Exercise the public catalog paths with an unfinished imported record even
// after the shipped native catalog has complete coverage.
export async function withUnconfiguredSpell(name,run){
 const spell=PF2E_SPELLS.find(s=>s.name===name);
 if(!spell)throw Error(`Missing fixture spell: ${name}`);
 const original={design:spell.design,quality:spell.quality,notes:spell.notes};
 Object.assign(spell,{quality:'unconfigured',notes:[],design:{...spell.design,motif:'generic',unavailable:true,sharedCount:0,assets:{cast:[],bolt:[],hit:[],aura:[],area:[]}}});
 try{return await run(spell);}finally{Object.assign(spell,original);}
}
