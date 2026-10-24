import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('a workspace opened after an on-disk update tolerates the already loaded legacy NPC module',async()=>{
 const original=new URL('../../scripts/ui/npc-ability-ui.mjs',import.meta.url);
 // This module surface is exactly what a running 2.1.1 client already has:
 // the shared families and their preview, with no expanded action exports.
 const legacy='data:text/javascript;base64,'+Buffer.from(`export {NPC_ABILITIES,npcAbilityPreview} from ${JSON.stringify(new URL('../../scripts/catalogs/pf2e/npc-abilities.mjs',import.meta.url).href)};`).toString('base64');
 const source=(await fs.readFile(original,'utf8')).replace(/from\s*(["'])([^"']+)\1/g,(all,quote,spec)=>{
  const target=spec==='../catalogs/pf2e/npc-abilities.mjs'?legacy:new URL(spec,original).href;
  return `from ${JSON.stringify(target)}`;
 });
 const ui=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 const w={host:{environment:()=>({systemId:'pf2e',ready:true})},recipePreviewHTML:()=>'',previewDuration:()=>1000};
 const html=ui.npcAbilityCatalogHTML(w);
 assert.match(html,/Reload Foundry/);
 assert.match(html,/26 shared NPC ability designs/);
 assert.doesNotMatch(html,/0 NPC actions/);
});
