import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {catalogDataNeeded,catalogSystem} from '../../scripts/catalogs/shared/catalog-data.mjs';
test('Foundry early game placeholder uses native system script paths, with safe ambiguous fallback',()=>{
 const doc=paths=>({querySelectorAll:()=>paths.map(path=>({getAttribute:key=>key==='src'?path:null}))});
 assert.equal(catalogSystem({game:{view:'game'},document:doc(['scripts/foundry.mjs','systems/pf2e/pf2e.mjs','modules/pf2e-subsystems/main.js'])}),'pf2e');
 assert.equal(catalogSystem({game:{view:'game'},document:doc(['systems/dnd5e/dnd5e.mjs'])}),'dnd5e');
 assert.equal(catalogSystem({game:{},document:doc(['systems/pf2e/pf2e.mjs','systems/sf2e/sf2e.mjs'])}),undefined);
 assert.equal(catalogSystem({game:{system:{id:'sf2e'}},document:doc(['systems/pf2e/pf2e.mjs'])}),'sf2e');
});
test('load only active system family; keep both 2e catalogs for crossover',()=>{
  for(const active of ['pf2e','sf2e']){
    assert.equal(catalogDataNeeded('pf2e',active),true);
    assert.equal(catalogDataNeeded('sf2e',active),true);
    assert.equal(catalogDataNeeded('dnd5e',active),false);
  }
  assert.equal(catalogDataNeeded('pf2e','dnd5e'),false);
  assert.equal(catalogDataNeeded('sf2e','daggerheart'),false);
  assert.equal(catalogDataNeeded('dnd5e','dnd5e'),true);
  assert.equal(catalogDataNeeded('pf2e',undefined),true);
});
test('actual catalog imports omit inactive data and retain native/crossover lookup indexes',()=>{
 const pf=new URL('../../scripts/catalogs/pf2e/spells/spell-catalog.mjs',import.meta.url).href;
 const sf=new URL('../../scripts/catalogs/sf2e/sf2e-catalog.mjs',import.meta.url).href;
 const dnd=new URL('../../scripts/catalogs/dnd5e/dnd5e-catalog.mjs',import.meta.url).href;
 for(const active of ['pf2e','sf2e','dnd5e','daggerheart']){
   const code=`globalThis.game={system:{id:${JSON.stringify(active)}}};
     const p=await import(${JSON.stringify(pf)}),s=await import(${JSON.stringify(sf)}),d=await import(${JSON.stringify(dnd)});
     console.log(JSON.stringify({pf:p.PF2E_SPELLS.length,sf:s.sfEntries().length,dnd:d.dndEntries().length,pfLookup:p.PF2E_SPELLS.length?!!p.catalogSpell(p.PF2E_SPELLS[0].id):false,sfLookup:s.sfEntries().length?!!s.sfEntry(s.sfEntries()[0].id):false}));`;
   const child=spawnSync(process.execPath,['--input-type=module','-e',code],{encoding:'utf8'});
   assert.equal(child.status,0,child.stderr);
   const result=JSON.parse(child.stdout),twoe=['pf2e','sf2e'].includes(active);
   assert.equal(result.pf>0,twoe);assert.equal(result.sf>0,twoe);
   assert.equal(result.pfLookup,twoe);assert.equal(result.sfLookup,twoe);
   assert.equal(result.dnd>0,active==='dnd5e');
 }
});
