import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PF2E_CONDITIONS,PF2E_EFFECTS,PF2E_STATE_SOURCE,stateRecipe,findStateEntry,normalizeStateCatalogState,useStateEntry,resolveStateRecipe} from '../../../scripts/catalogs/pf2e/state-catalog.mjs';
import {validateRecipe,planRecipe} from '../../../scripts/core/model.mjs';
import {assetGeometry} from '../../../tools/spell-asset-selection.mjs';
import {MEDIA_FOOTPRINTS} from '../../../data/media-footprints.mjs';
import {assetDatabases} from '../../../tools/asset-databases.mjs';
import {ensureStateSources} from '../../../tools/pf2e-state-source.mjs';
const frightened=PF2E_CONDITIONS.find(e=>e.slug==='frightened'),bless=PF2E_EFFECTS.find(e=>e.name==='Spell Effect: Bless');
const native=e=>({type:e.kind,name:e.name,slug:e.kind==='condition'?e.slug:undefined,uuid:'Actor.a.Item.i',sourceId:e.uuid,system:{active:true}});

test('all native effect Aura rules retain literal radii; formulas remain native rather than being guessed',async()=>{
 const base=await ensureStateSources(),emitters=PF2E_EFFECTS.filter(e=>e.auras);
 assert.equal(emitters.length,61);
 for(const e of emitters){
  const source=JSON.parse(await readFile(`${base}/${e.sourceUrl.split('/packs/pf2e/')[1]}`,'utf8'));
  const rules=source.system.rules.filter(r=>r.key==='Aura');
  assert.deepEqual(e.auras.map(a=>a.radius),rules.map(r=>typeof r.radius==='number'?r.radius:null),e.name);
  assert.ok(e.auraAssets.every(a=>!a.startsWith('jb2a.markers.')),e.name);
 }
});
test('catalog aura sample has area extent while native recipient resolution never propagates the field',()=>{
 const e=PF2E_EFFECTS.find(e=>e.name==="Aura: Demon's Knot"),recipe=stateRecipe(e),item=native(e),state=useStateEntry({},e.id);
 assert.equal(recipe.stages[0].auraRadius,30);assert.equal(recipe.stages[0].scale,1);assert.equal(recipe.stages[0].offsetY,0);
 assert.equal(resolveStateRecipe(item,state,[]).stages[0].auraRadius,undefined);
 const customized={...state,customized:[e.id]};
 assert.equal(resolveStateRecipe(item,customized,[recipe]).stages[0].auraRadius,undefined);
});

test('reviewed sustained effects distinguish flight, protection, shields and reuse cooldowns',()=>{
 const byName=name=>{const entry=PF2E_EFFECTS.find(e=>e.name===name);assert.ok(entry,name);return entry;};
 for(const name of ['Effect: Assisted Flight','Effect: Juvenile Flight']){
  const entry=byName(name);assert.equal(entry.theme,'flight');assert.match(entry.assets[0],/token_border.circle.spinning/);assert.doesNotMatch(entry.assets.join(),/cold|nature|wood|bless/);
 }
 assert.equal(byName('Effect: Droning Wings').theme,'sonic-ward');
 for(const name of ['Effect: Shield Immunity','Effect: Rage Temporary Hit Points Immunity','Effect: Treat Wounds Immunity']){
  const entry=byName(name);assert.equal(entry.theme,'cooldown');assert.equal(entry.private,true);assert.doesNotMatch(entry.assets.join(),/shield\.01|drop|flames|aura_themed/);
 }
 for(const word of ['Antidote','Antiplague','Elixir of Life']){
  const entries=PF2E_EFFECTS.filter(e=>e.name.includes(word));assert.ok(entries.length,word);assert.ok(entries.every(e=>e.theme==='antidote'));
 }
 const fire=byName('Spell Effect: Fire Shield'),glass=byName('Spell Effect: Glass Shield'),prism=byName('Spell Effect: Prismatic Shield');
 assert.match(fire.assets[0],/shield_themed.above.fire/);assert.match(glass.editions.patreon.key,/markers\.shield/);assert.doesNotMatch(glass.editions.patreon.key,/shield\.01/,'no hex dome on the token');assert.match(prism.editions.patreon.key,/multicolored/);
 assert.match(glass.editions.free.key,/markers\.shield|refraction/);assert.match(prism.editions.free.key,/refraction/);
 assert.equal(new Set([fire,glass,prism].map(e=>e.editions.patreon.key)).size,3);
});

test('every localized native description resolves against the pinned English source',()=>{
 assert.deepEqual(PF2E_STATE_SOURCE.unresolvedLocalizations,[]);
 const sickened=PF2E_CONDITIONS.find(e=>e.slug==='sickened');
 assert.doesNotMatch(sickened.description,/@Localize/);assert.match(sickened.description,/retch|nausea/i);assert.doesNotMatch(sickened.assets.join(),/poison|toxic/);
});

test('core condition and every native effect-pack document have catalog entries and sustained localized footage in both editions',async()=>{
 assert.equal(PF2E_CONDITIONS.length,43);assert.equal(PF2E_EFFECTS.length,2962);
 const entries=[...PF2E_CONDITIONS,...PF2E_EFFECTS];assert.equal(new Set(entries.map(e=>e.id)).size,entries.length);
 assert.equal(PF2E_STATE_SOURCE.packs['campaign-effects'],68);assert.equal(PF2E_STATE_SOURCE.packs['boons-and-curses'],7);
 // Use the inventories used by the builder. An unversioned local snapshot can
 // predate an installed JB2A update and incorrectly reject its new keys.
 const db=await assetDatabases();
 for(const [edition,rows] of Object.entries(db)){
  for(const entry of entries){
   const recipe=stateRecipe(entry);assert.equal(recipe.lifecycle,'document');assert.equal(recipe.trigger,'effect');assert.ok(entry.descriptionHash);assert.ok(entry.description||PF2E_STATE_SOURCE.missingDescriptions.some(r=>r.id===entry.id));
   for(const stage of planRecipe(recipe,rows,{source:{id:'s',center:{x:100,y:100},w:100,h:100},targets:[],gridSize:100})){
    const row=rows.find(r=>r.key===stage.asset);assert.equal(assetGeometry(row),'radial',`${entry.name} ${edition}`);assert.equal(stage.kind,'aura');assert.equal(stage.persist,true);assert.ok(!/intro|outro|complete|pulse/.test(stage.asset),stage.asset);
    assert.ok(MEDIA_FOOTPRINTS[row.file.split('/').at(-1)],`Missing measured visible scale: ${row.key}`);
   }
  }
 }
});
test('persistent damage chooses fire, bleed, poison and electricity with geometry-preserving edition fallbacks',()=>{
 const damage=PF2E_CONDITIONS.find(e=>e.slug==='persistent-damage');
 const recipes=['fire','bleed','poison','electricity'].map(damageType=>stateRecipe(damage,{damageType}));
 assert.equal(new Set(recipes.map(r=>r.stages[0].assets.join())).size,4);
 assert.match(recipes[0].stages[0].assets[0],/flames/);assert.match(recipes[1].stages[0].assets[0],/drop/);assert.match(recipes[2].stages[0].assets[0],/poison/);
});
test('source identity wins; source-less ambiguous effect names do not bind arbitrarily',()=>{
 assert.equal(findStateEntry(native(frightened)),frightened);assert.equal(findStateEntry(native(bless)),bless);
 const duplicate=PF2E_EFFECTS.find(e=>PF2E_EFFECTS.some(p=>p.id!==e.id&&p.name===e.name));assert.ok(duplicate);
 assert.equal(findStateEntry({type:'effect',name:duplicate.name}),null);
});
test('use catalog, exclusion, custom priority and disabled custom layers remain independent of saved one-shot recipes',()=>{
 const item=native(bless),state=useStateEntry({},bless.id),custom={...stateRecipe(bless),name:'My blessing'};
 assert.equal(resolveStateRecipe(item,state,[]).name,bless.name);
 assert.equal(resolveStateRecipe(item,{...state,customized:[bless.id]},[custom]).name,'My blessing');
 assert.equal(resolveStateRecipe(item,{...state,excluded:[bless.id]},[custom]),null);
 assert.equal(resolveStateRecipe(item,{...state,customized:[bless.id]},[{...custom,enabled:false}]),null);
 assert.equal(resolveStateRecipe(item,normalizeStateCatalogState(),[]),null);
 const chosen=useStateEntry({...state,customized:[bless.id]},bless.id);assert.deepEqual(chosen.customized,[]);
 assert.equal(resolveStateRecipe(item,chosen,[{...custom,enabled:false}]).name,bless.name,'explicit use-catalog choice bypasses an old disabled customization');
 assert.equal(normalizeStateCatalogState({selected:['made-up'],opacity:40}).opacity,1);
});
test('unknown native effects match only their own custom document recipe',()=>{
 const other={...stateRecipe(bless),stateEntry:undefined,itemUuid:'Actor.a.Item.other',match:'Other custom effect'};
 const own={...other,id:'own-custom',name:'Own custom cue',itemUuid:'Actor.a.Item.custom',match:'Custom effect'};
 const item={type:'effect',name:'Custom effect',uuid:'Actor.a.Item.custom',system:{}};
 assert.equal(findStateEntry(item),null);
 assert.equal(resolveStateRecipe(item,{enabled:true},[other,own]).name,'Own custom cue');
 assert.equal(resolveStateRecipe({...item,name:'Unmatched effect',uuid:'Actor.a.Item.unmatched'},{enabled:true},[other,own]),null);
});
test('document-linked imports retain lifetime and reject gameplay-like motion or unbound target layers',()=>{
 const recipe=stateRecipe(frightened);assert.deepEqual(validateRecipe(JSON.parse(JSON.stringify(recipe))),recipe);
 assert.throws(()=>validateRecipe({...recipe,stages:[{...recipe.stages[0],kind:'motion'}]}),/Stays on token/);
 assert.throws(()=>validateRecipe({...recipe,stages:[{...recipe.stages[0],subject:'targets'}]}),/affected token/);
 assert.equal(validateRecipe({...recipe,trigger:'manual'}).lifecycle,undefined);
});
test('a customized fire damage loop never overrides bleed or other persistent damage types',()=>{
 const damage=PF2E_CONDITIONS.find(e=>e.slug==='persistent-damage'),fire=stateRecipe(damage,{damageType:'fire'}),state={...useStateEntry({},damage.id),customized:[damage.id]};
 const item=native(damage);item.system.persistent={damageType:'fire'};
 assert.equal(resolveStateRecipe(item,state,[{...fire,name:'My fire'}]).name,'My fire');
 item.system.persistent.damageType='bleed';const bleed=resolveStateRecipe(item,state,[{...fire,name:'My fire'}]);
 assert.equal(bleed.stateDamageType,'bleed');assert.match(bleed.stages[0].assets[0],/drop/);
});

test("your own lasting recipe plays with the catalog off, unless custom recipes are off or you picked the catalog version", async () => {
  const { resolveStateRecipe, PF2E_CONDITIONS } = await import("../../../scripts/catalogs/pf2e/state-catalog.mjs");
  const { validateRecipe } = await import("../../../scripts/core/model.mjs");
  const entry = PF2E_CONDITIONS.find((e) => e.slug === "frightened");
  const item = { type: "condition", slug: "frightened", name: "Frightened" };
  const lasting = (extra) => validateRecipe({ id: "mine", name: "Mine", trigger: "effect", lifecycle: "document", stages: [{ kind: "aura", assets: ["jb2a.impact.001.orange"], persist: true }], ...extra });
  assert.equal(resolveStateRecipe(item, { enabled: false }, [lasting({ match: "frightened" })], [])?.id, "mine");
  assert.equal(resolveStateRecipe(item, { enabled: false }, [lasting({ stateEntry: entry.id })], [])?.id, "mine", "a customized catalog copy too");
  assert.equal(resolveStateRecipe(item, { enabled: false }, [lasting({ match: "frightened" })], [], { customEnabled: false }), null, "custom recipes switched off");
  const picked = resolveStateRecipe(item, { enabled: true, scope: "selected", selected: [entry.id] }, [lasting({ stateEntry: entry.id })], []);
  assert.notEqual(picked?.id, "mine", "explicitly using the catalog version");
  assert.equal(resolveStateRecipe(item, { enabled: false }, [lasting({ match: "frightened", enabled: false })], []), null);
});
