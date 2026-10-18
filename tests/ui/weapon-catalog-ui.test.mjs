import test from 'node:test';
import assert from 'node:assert/strict';
import {weaponCatalogHTML} from '../../scripts/ui/weapon-catalog-ui.mjs';
import {PF2E_WEAPONS} from '../../scripts/catalogs/pf2e/weapons/weapon-catalog.mjs';
const fixture=(slug,mode)=>({weaponFilters:{search:slug,group:'all',mode:'all',category:'all',edition:'all'},weaponPage:0,selectedWeapon:PF2E_WEAPONS.find(w=>w.slug===slug).id,weaponMode:mode,host:{weaponCatalogState:()=>({}),environment:()=>({ready:true,systemId:'pf2e'}),enabled:()=>false,recipes:()=>[],soundCatalog:()=>({resolve:c=>c,packs:[]})},recipePreviewHTML:r=>`<div aria-label="${r.weaponMode} full recipe">${r.stages.length}</div>`,previewDuration:()=>3000});
test('weapons expose only native modes, sound controls and complete highlighted choreography',()=>{
 const html=weaponCatalogHTML(fixture('dagger-pistol','thrown'));
 assert.match(html,/data-mode="ranged"/);assert.match(html,/data-mode="melee"/);assert.match(html,/data-mode="thrown"/);
 assert.match(html,/data-action="weapon-auto"/);assert.match(html,/data-action="use-weapon"/);assert.match(html,/data-action="copy-weapon"/);
 assert.match(html,/data-action="weapon-sound"/);assert.match(html,/data-ability-volume="weapon"/);assert.match(html,/data-stage-drag="4"/);
 assert.match(html,/data-action="audition-sound"/);assert.match(html,/Customize edits only thrown/);
 assert.match(html,/data-action="item-details" data-kind="weapon"/);assert.match(html,/aria-label="Open Dagger Pistol details"/);
 assert.doesNotMatch(html,/Weapon description|data-options-group="weapon-description"/);
 const javelin=weaponCatalogHTML(fixture('javelin','thrown'));assert.ok(!javelin.includes('data-mode="melee"'));
});
test('weapon list includes description search, safe empty results and demo gating',()=>{
 const w=fixture('dagger','melee');w.host.environment=()=>({demo:true,ready:true});assert.match(weaponCatalogHTML(w),/data-action="use-weapon"[^>]+disabled/);
 w.weaponFilters.search='nothingmatcheszz';assert.match(weaponCatalogHTML(w),/No weapons match/);
});

test('Handwraps show native unarmed Strike binding and unarmed training filter',()=>{
 const html=weaponCatalogHTML(fixture('handwraps-of-mighty-blows','melee'));
 assert.match(html,/Handwraps of Mighty Blows/);
 assert.match(html,/data-mode="melee"[^>]*>Unarmed<\/button>/);
 assert.match(html,/option value="unarmed"/);
 assert.match(html,/Attack rolled · Unarmed Strike/);
 assert.match(html,/wraps are worn and invested/);
 assert.doesNotMatch(html,/worn rune items excluded/);
 assert.match(html,/data-action="item-details" data-kind="weapon"/);
});
