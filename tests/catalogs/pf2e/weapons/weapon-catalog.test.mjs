import test from 'node:test';
import assert from 'node:assert/strict';
import {PF2E_WEAPONS,PF2E_WEAPON_SOURCE,weaponRecipe,findCatalogWeapon,useCatalogWeapon,normalizeWeaponCatalogState,resolveAutomaticWeaponRecipe,filterWeapons} from '../../../../scripts/catalogs/pf2e/weapons/weapon-catalog.mjs';
import {pf2eEvent,sf2eEvent} from '../../../../scripts/systems/adapters.mjs';
import {validateRecipe,previewPlan,matchRecipe} from '../../../../scripts/core/model.mjs';
import {weaponModes,analyzeWeapon} from '../../../../tools/weapon-semantics.mjs';
import {planRecipe} from '../../../../scripts/core/model.mjs';
const weapon=slug=>PF2E_WEAPONS.find(w=>w.slug===slug);
const event=(w,mode)=>({type:'attack',weaponMode:mode,item:{type:'weapon',name:w.name,system:{slug:w.slug},_stats:{compendiumSource:`Compendium.pf2e.equipment-srd.Item.${w.id}`}}});
test('weapon inventory includes complete pinned pack, legacy, bombs and unarmed rune equipment',()=>{
 assert.equal(PF2E_WEAPON_SOURCE.equipmentDocuments,5914);assert.equal(PF2E_WEAPON_SOURCE.weaponDocuments,1021);assert.equal(PF2E_WEAPONS.filter(w=>!w.natural).length,1021);assert.equal(PF2E_WEAPON_SOURCE.usageCount,1130);
 assert.equal(new Set(PF2E_WEAPONS.map(w=>w.id)).size,PF2E_WEAPONS.length);assert.equal(PF2E_WEAPON_SOURCE.excluded.length,0);
 assert.ok(PF2E_WEAPONS.some(w=>w.edition==='legacy'));assert.ok(weapon('alchemists-fire-lesser'));
 assert.equal(PF2E_WEAPON_SOURCE.descriptionAudit,1021);
});
test('native weapon modes distinguish melee throws, thrown-only and combination forms',()=>{
 assert.deepEqual(weapon('dagger').modes.map(m=>m.mode),['melee','thrown']);
 assert.deepEqual(weapon('spear').modes.map(m=>m.mode),['melee','thrown']);
 assert.deepEqual(weapon('javelin').modes.map(m=>m.mode),['thrown']);
 assert.deepEqual(weapon('gun-sword').modes.map(m=>m.mode),['ranged','melee']);
 assert.deepEqual(weapon('dagger-pistol').modes.map(m=>m.mode),['ranged','melee','thrown']);
 assert.deepEqual(weaponModes({group:'firearm',range:20,damage:{damageType:'piercing'},traits:{value:[]},meleeUsage:{}}).map(m=>m.mode),['ranged']);
});
test('PF2e adapter honors attack-context alternate usage before base item range',()=>{
 const base={id:'roll',author:{id:'u'},isRoll:true,item:{type:'weapon',system:{range:30,traits:{value:['combination']}}},flags:{pf2e:{context:{type:'attack-roll',altUsage:'melee'}}}};
 assert.equal(pf2eEvent(base,'u').weaponMode,'melee');
 assert.equal(pf2eEvent({...base,flags:{pf2e:{context:{type:'attack-roll',altUsage:'melee',options:['item:thrown']}}}},'u').weaponMode,'melee');
 assert.equal(pf2eEvent({...base,flags:{pf2e:{context:{type:'attack-roll',altUsage:'thrown'}}}},'u').weaponMode,'thrown');
 assert.equal(pf2eEvent({...base,flags:{pf2e:{context:{type:'attack-roll',options:['item:ranged']}}}},'u').weaponMode,'ranged');
 const dagger={...base,item:{type:'weapon',system:{range:null,traits:{value:['thrown-10']}}},flags:{pf2e:{context:{type:'attack-roll'}}}};
 assert.equal(pf2eEvent(dagger,'u').weaponMode,'melee');
 assert.equal(pf2eEvent({...dagger,flags:{pf2e:{context:{type:'attack-roll',options:['item:thrown-melee']}}}},'u').weaponMode,'thrown');
 assert.equal(pf2eEvent({...dagger,item:{type:'weapon',system:{group:'bomb',range:20}}},'u').weaponMode,'thrown');
});
test('melee contacts stay localized; ranged and thrown animations really fly and land',()=>{
 const context={source:{id:'s',center:{x:100,y:100}},targets:[{id:'t1',center:{x:400,y:100}},{id:'t2',center:{x:700,y:100}}],gridSize:100};
 for(const w of PF2E_WEAPONS)for(const mode of w.modes){
  const r=validateRecipe(weaponRecipe(w,mode.mode));assert.equal(r.weaponMode,mode.mode);
  assert.ok(r.stages.some(s=>s.kind==='motion'));
  const p=previewPlan(r,context);assert.ok(p.every(s=>s.kind==='motion'||s.destination?.id!=='t2'));
  if(mode.mode==='melee')assert.ok(r.stages.some(s=>s.kind==='impact')&&!r.stages.some(s=>s.kind==='travel'));
  else{const flight=r.stages.find(s=>s.kind==='travel'),hit=r.stages.find(s=>s.kind==='impact');assert.ok(flight&&hit);assert.equal(hit.afterStage,flight.stageId);assert.ok(hit.startOffset>0);}
 }
 assert.notDeepEqual(weaponRecipe(weapon('dagger'),'melee').stages,weaponRecipe(weapon('dagger'),'thrown').stages);
 assert.notDeepEqual(weaponRecipe(weapon('greatsword'),'melee').stages,weaponRecipe(weapon('rapier'),'melee').stages);
});

test('2e adapters keep native weapon usage when the chat item awaits UUID resolution',()=>{
 for(const [system,adapt] of [['pf2e',pf2eEvent],['sf2e',sf2eEvent]]){
  const message={id:'pending-item',author:{id:'u'},isRoll:true,item:null};
  const adaptUsage=context=>adapt({...message,flags:{[system]:{origin:{type:'weapon',uuid:'Actor.a.Item.w'},context:{type:'attack-roll',...context}}}},'u');
  assert.equal(adaptUsage({options:['item:melee']}).weaponMode,'melee');
  assert.equal(adaptUsage({options:['item:ranged']}).weaponMode,'ranged');
  assert.equal(adaptUsage({altUsage:null,options:['item:ranged','item:thrown','item:thrown-melee']}).weaponMode,'thrown');
  assert.equal(adaptUsage({altUsage:'melee',options:['item:ranged']}).weaponMode,'melee');
  assert.equal(adaptUsage({altUsage:'thrown'}).weaponMode,'thrown');
  assert.equal(adapt({...message,flags:{[system]:{origin:{type:'spell',uuid:'Actor.a.Item.s'},context:{type:'attack-roll',options:['item:ranged']}}}},'u').weaponMode,undefined);
 }
});
test('weapon opt-in is independent; customization applies only to its mode',()=>{
 const w=weapon('dagger'),state=useCatalogWeapon({},w.id),melee=event(w,'melee'),thrown=event(w,'thrown');
 const custom={...weaponRecipe(w,'melee'),name:'Edited dagger'};
 const customized={...state,customized:[`${w.id}:melee`]};
 assert.equal(resolveAutomaticWeaponRecipe(melee,customized,[custom],{customEnabled:false}).name,'Edited dagger');
 assert.equal(resolveAutomaticWeaponRecipe(thrown,customized,[custom],{customEnabled:false}).weaponMode,'thrown');
 assert.equal(matchRecipe([custom],thrown),null);
 assert.equal(resolveAutomaticWeaponRecipe({...thrown,type:'damage'},state,[],{customEnabled:false}),null);
 assert.equal(resolveAutomaticWeaponRecipe({...thrown,type:'use'},state,[],{customEnabled:false}),null);
 assert.equal(resolveAutomaticWeaponRecipe(thrown,{...state,excluded:[w.id]}),null);
 assert.equal(findCatalogWeapon({...thrown,item:{...thrown.item,type:'feat'}}),null);
 assert.equal(resolveAutomaticWeaponRecipe(event(weapon('javelin'),'melee'),{enabled:true,scope:'all'}),null);
 assert.deepEqual(useCatalogWeapon(customized,w.id).customized,[]);
});
test('source matching keeps renamed items and safely uses a known base weapon',()=>{
 const w=weapon('dagger'),evt=event(w,'thrown');evt.item.name='My knife';assert.equal(findCatalogWeapon(evt).id,w.id);
 assert.equal(findCatalogWeapon({item:{type:'weapon',system:{baseItem:'dagger'},name:'Custom knife'}}).id,w.id);
 assert.equal(findCatalogWeapon({item:{type:'weapon',name:'Unknown alien sword'}}),null);
 assert.ok(filterWeapons({mode:'thrown',group:'knife'}).every(w=>w.modes.some(m=>m.mode==='thrown')));
 assert.equal(normalizeWeaponCatalogState({selected:['bad'],soundVolume:9}).soundVolume,1);
 assert.deepEqual(normalizeWeaponCatalogState({customized:'bad'}).customized,[]);
 assert.deepEqual(normalizeWeaponCatalogState({customized:[`${w.id}:thrown:bad`,`${w.id}:thrown`]}).customized,[`${w.id}:thrown`]);
});
test('activated powers in full text never become unconditional Strike elements',()=>{
 const item={_id:'x',name:'Staff of Fire',system:{range:null,group:'club',baseItem:'staff',usage:{value:'held-in-one-hand'},traits:{value:['fire','magical']},damage:{damageType:'bludgeoning',die:'d4'},description:{value:'<p>Wooden staff.</p><p>Activate: cast fireball and create flames.</p>'},runes:{property:[]}}};
 assert.equal(analyzeWeapon(item,'staff-of-fire.json').modes[0].element,'physical');
 item.system.runes.property=['flaming'];assert.equal(analyzeWeapon(item,'staff-of-fire.json').modes[0].element,'fire');
});
test('elemental spittle guns select matching flights rather than knives or unrelated magic',()=>{
 for(const w of PF2E_WEAPONS.filter(w=>w.modes.some(m=>m.family==='spittle'))){
  const mode=w.modes[0];assert.ok(mode.assets.flight.every(k=>!k.includes('dagger')&&!/earth|ice_shard|heart/.test(k)));
  if(mode.element==='fire')assert.ok(mode.assets.flight.every(k=>k.includes('fire_bolt.orange')));
  if(['acid','poison'].includes(mode.element))assert.ok(mode.assets.flight.every(k=>k.includes('poison')));
  if(mode.element==='acid')assert.ok(mode.approximations.length,'acid shares poison-colored liquid footage and must say so');
 }
});

test('Acid Flask lands corrosive liquid and a brief target residue in both editions',()=>{
 const w=weapon('acid-flask-lesser'),recipe=weaponRecipe(w,'thrown',{motion:false});
 const dbs=Object.fromEntries(['patreon','free'].map(edition=>[edition,w.modes[0].selections.filter(s=>s.edition===edition).map(s=>({key:s.key}))]));
 for(const [edition,db] of Object.entries(dbs)){
  const plan=planRecipe(recipe,db,{source:{id:'s',center:{x:100,y:100}},targets:[{id:'t',center:{x:400,y:100}}],gridSize:100});
  const splash=plan.find(s=>s.kind==='impact');
  assert.match(splash.asset,/^jb2a\.liquid\.splash\./,`${edition}: Acid Flask must show liquid, not generic impact`);
  assert.equal(splash.destination.id,'t');
  assert.equal(splash.colorize,true);assert.equal(splash.tint,'#b8e580');
  assert.ok(plan.some(s=>s.kind==='aura'&&s.destination.id==='t'&&!s.persist),`${edition}: finite corrosive residue on target`);
 }
});

test('bomb contents preserve frost, electricity, gas, sticky liquids and shrapnel instead of neutral hits',()=>{
 const cases={'frost-vial-lesser':'frost','bottled-lightning-lesser':'lightning','dread-ampoule-lesser':'gas','water-bomb-lesser':'liquid','glue-bomb-lesser':'liquid','junk-bomb-lesser':'shrapnel'};
 for(const[slug,style]of Object.entries(cases)){
  const w=weapon(slug);assert.ok(w,slug);assert.equal(w.modes[0].payload.style,style);
  const r=weaponRecipe(w,'thrown');assert.ok(r.stages.some(s=>s.kind==='impact'&&s.assets.every(k=>!/^jb2a\.(impact\.001|side_impact\.part\.smoke)/.test(k))),slug);
 }
 assert.ok(weaponRecipe(weapon('bottled-sunlight-lesser'),'thrown').stages.some(s=>s.label==='fire additional finish'));
});

test('always-on own-weapon damage rules and multiple elemental runes get visible finishes',()=>{
 for(const[slug,type]of [['ankhrav-duster','acid'],['storm-hammer','electricity'],['glacier-hammer','cold'],['alicorn-lance','spirit'],['lionfish-spear-greater','poison']]){
  const w=weapon(slug);assert.ok(w,slug);assert.ok(w.modes[0].elements.includes(type),slug);
  assert.ok(weaponRecipe(w,'melee').stages.some(s=>s.label.includes(type)&&s.label.endsWith('finish')),slug);
 }
 for(const slug of ['poisonous-dagger','bloodletting-kukri','iris-of-the-sky','mageslayer'])assert.equal(weapon(slug).modes[0].element,'physical',`${slug} conditional rider must stay conditional`);
 const s={damage:{damageType:'slashing',die:'d8'},group:'sword',usage:{value:'held-in-one-hand'},traits:{value:[]},runes:{property:['flaming','shock']},description:{value:'<p>Blade.</p>'}};
 assert.deepEqual(analyzeWeapon({_id:'x',name:'Elemental blade',system:s},'blade.json').modes[0].elements,['fire','electricity']);
 s.runes.property=['brilliant','astral','wounding'];
 const native=analyzeWeapon({_id:'x',name:'Radiant blade',system:s},'blade.json').modes[0];
 assert.deepEqual(native.elements,['fire','spirit','bleed']);assert.equal(native.persistent,'bleed','PF2e 8.5.1 DamageDicePF2e and ModifierPF2e automatically classify bleed as persistent');
});

test('all elemental weapon uses have meaningful target finishes; residue cues end and stay on first target',()=>{
 const context={source:{id:'s',center:{x:100,y:100}},targets:[{id:'t',center:{x:400,y:100}},{id:'other',center:{x:600,y:100}}],gridSize:100};
 for(const w of PF2E_WEAPONS)for(const m of w.modes){
  if(m.element!=='physical')assert.ok(m.assets.accent.every(k=>!/^jb2a\.(impact\.001|side_impact\.part\.smoke)/.test(k)),`${w.name}: missing ${m.element} finish`);
  const r=weaponRecipe(w,m.mode),residue=r.stages.find(s=>s.kind==='aura');
  if(residue){assert.equal(residue.persist,false);assert.equal(residue.subject,'targets');assert.ok(residue.duration>=1800&&residue.duration<=3000,'Target residue and successful-hit fields have finite readable windows');assert.equal(residue.oneShot,false);}
  const db=m.selections.filter(s=>s.edition==='free').map(s=>({key:s.key}));
  const p=planRecipe(r,db,context);
  // Firearm muzzle flashes play at the shooter (facing the target); every other stage lands on the first target.
  assert.ok(p.every(s=>s.kind==='motion'||s.stageId.endsWith('-muzzle')&&s.destination.id==='s'&&s.facing?.id==='t'||s.destination.id==='t'),w.name);
 }
});
test('your own recipe for a weapon beats a catalog turned on wholesale; starters and a hand-picked entry do not',async()=>{
 const {starterRecipes}=await import('../../../../scripts/core/presets.mjs');
 const {STARTER_RECIPE_IDS}=await import('../../../../scripts/core/model.mjs');
 assert.deepEqual([...STARTER_RECIPE_IDS],starterRecipes().map(r=>r.id),'the starter list matches the starters');
 const w=weapon('dagger'),strike=event(w,'melee'),plugAndPlay={...normalizeWeaponCatalogState({}),enabled:true,scope:'all',independent:true,preferCatalog:true};
 const mine=validateRecipe({id:'my-dagger',name:'My dagger',trigger:'attack',match:'dagger',enabled:true,stages:[{kind:'impact',assets:['jb2a.impact.001'],subject:'targets'}]});
 assert.equal(resolveAutomaticWeaponRecipe(strike,plugAndPlay,[mine]).name,'My dagger','your recipe plays');
 const blade=starterRecipes().find(r=>r.id==='blade');
 assert.notEqual(resolveAutomaticWeaponRecipe(strike,plugAndPlay,[blade]).id,'blade','a starter makes way for the catalog');
 assert.notEqual(resolveAutomaticWeaponRecipe(strike,{...plugAndPlay,selected:[w.id]},[mine]).name,'My dagger','a catalog entry picked by hand still wins');
 assert.notEqual(resolveAutomaticWeaponRecipe(strike,plugAndPlay,[{...mine,enabled:false}])?.name,'My dagger');
});
// Ground marks: payload weapons name the mark their contents leave on the floor (engines/marks/ground-marks.mjs).
test("alchemist's fire recipe carries markElement fire",()=>{
 assert.equal(weaponRecipe(weapon('alchemists-fire-lesser'),'thrown').markElement,'fire');
 assert.equal(weaponRecipe(weapon('acid-flask-lesser'),'thrown').markElement,'acid');
 assert.equal(weaponRecipe(weapon('frost-vial-lesser'),'thrown').markElement,'cold');
 // Through the catalog as it plays (bespoke designs and rune flourishes keep it).
 const state=normalizeWeaponCatalogState({enabled:true});
 assert.equal(resolveAutomaticWeaponRecipe(event(weapon('alchemists-fire-lesser'),'thrown'),state,[],{runes:true}).markElement,'fire');
 // A payload with no mark (a glue bomb, a gas cloud) names none.
 for(const w of PF2E_WEAPONS)for(const m of w.modes)if(m.payload&&['glue','foam','mud'].includes(m.payload.element)||m.payload?.style==='gas')assert.equal(weaponRecipe(w,m.mode).markElement,undefined,w.slug);
});
test('flaming longsword carries none',()=>{
 const w=weapon('longsword'),state=normalizeWeaponCatalogState({enabled:true});
 const flaming={...event(w,'melee')};flaming.item={...flaming.item,system:{...flaming.item.system,runes:{potency:1,striking:1,property:['flaming']}}};
 const recipe=resolveAutomaticWeaponRecipe(flaming,state,[],{runes:true});
 assert.ok(recipe.stages.some(s=>s.stageId.includes('-rune-flaming')));
 assert.equal(recipe.markElement,undefined);
 assert.equal(weaponRecipe(w,'melee').markElement,undefined);
});
