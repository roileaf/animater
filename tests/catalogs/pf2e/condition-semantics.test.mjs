import test from 'node:test';
import assert from 'node:assert/strict';
import {PF2E_CONDITIONS,PF2E_EFFECTS,stateRecipe,resolveStateRecipe,useStateEntry} from '../../../scripts/catalogs/pf2e/state-catalog.mjs';
const entry=slug=>PF2E_CONDITIONS.find(e=>e.slug===slug);
const assets=slug=>stateRecipe(entry(slug)).stages.flatMap(s=>s.assets).join(' ');

test('condition placement uses reviewed body or ground positions rather than universal overhead markers',()=>{
 for(const e of PF2E_CONDITIONS){
  const stages=stateRecipe(e).stages;
  assert.ok(e.conditionDesign?.layers?.length,`${e.slug}: missing explicit condition design`);
  assert.ok(stages.every(s=>s.offsetY>=-.4&&s.offsetY<=.5),`${e.slug}: misplaced overhead marker`);
  assert.doesNotMatch(stages.flatMap(s=>s.assets).join(),/on_token_mask/,`${e.slug}: skull-mask footage is not a neutral veil`);
  assert.equal(e.conditionDesign.descriptionHash,e.descriptionHash,e.slug);
 }
 assert.equal(stateRecipe(entry('frightened')).stages[0].offsetY,0);
 assert.ok(stateRecipe(entry('prone')).stages.every(s=>s.below), 'Prone belongs on ground plane');
});

test('condition art avoids inventing poison, bleeding, chains, curses and healing',()=>{
 assert.doesNotMatch(assets('sickened'),/poison|toxic/);
 assert.doesNotMatch(assets('paralyzed'),/chain|ice|snowflake/);
 for(const slug of ['drained','wounded'])assert.doesNotMatch(assets(slug),/drop|liquid\.splash/);
 for(const slug of ['blinded','enfeebled','unfriendly'])assert.doesNotMatch(assets(slug),/runes|condition\.curse/);
 assert.match(assets('unconscious'),/sleep/);
 assert.doesNotMatch(assets('helpful'),/bless|condition\.boon/);
 assert.doesNotMatch(assets('hostile'),/aura_themed|flames/);
 for(const slug of ['friendly','helpful','unfriendly','hostile','indifferent'])assert.equal(entry(slug).theme,'attitude');
});

test('afflictions read as debuffs: no bright swirls, spinning rings, haloes or boon art',()=>{
 // Beneficial, attitude and stealth conditions are not afflictions.
 const exempt=new Set(['quickened','friendly','helpful','indifferent','observed','hostile','unfriendly','concealed','hidden','invisible','undetected','unnoticed']);
 for(const e of PF2E_CONDITIONS.filter(e=>!exempt.has(e.slug))){
  assert.doesNotMatch(assets(e.slug),/particles\.(?:swirl|outward)|token_border\.circle\.spinning|markers\.light|light_orb|twinkling_stars|swirling_sparkles|condition\.boon|bless/,e.slug);
  assert.ok(stateRecipe(e).stages.every(s=>s.scale<=1.5),`${e.slug}: covers neighbours`);
 }
 for(const slug of ['clumsy','slowed','enfeebled','fatigued','encumbered','prone'])assert.doesNotMatch(assets(slug),/token_border/,`${slug}: a plain ring reads as an aura`);
});

test('persistent damage shows destructive type cues rather than musical notes, healing hearts or ice for void',()=>{
 const e=entry('persistent-damage'),keys=type=>stateRecipe(e,{damageType:type}).stages.flatMap(s=>s.assets).join(' ');
 assert.doesNotMatch(keys('sonic'),/music/);
 assert.doesNotMatch(keys('vitality'),/heart|bless/);
 assert.doesNotMatch(keys('void'),/cold|snowflake/);
 for(const type of ['bludgeoning','piercing','slashing','force']){
  assert.equal(stateRecipe(e,{damageType:type}).stateDamageType,type);
  assert.doesNotMatch(keys(type),/drop/);
 }
 assert.doesNotMatch(stateRecipe(e).stages[0].assets.join(),/drop/,'Unknown damage type must not claim blood loss');
});

test('installed edition selection retains condition-specific layout while custom placements stay intact',()=>{
 for(const e of PF2E_CONDITIONS)for(const damageType of [undefined,...Object.keys(e.damageVariants??{})])for(const edition of ['free','patreon']){
  const design=e.damageVariants?.[damageType]??e;
  const rows=design.conditionDesign?.layers?.map(l=>({key:l.editions[edition].key}));
  assert.ok(rows?.length,e.slug);
  const original=stateRecipe(e,{damageType}),resolved=stateRecipe(e,{damageType,catalog:rows});
  assert.deepEqual(resolved.stages.map(s=>[s.offsetX,s.offsetY,s.scale,s.below]),original.stages.map(s=>[s.offsetX,s.offsetY,s.scale,s.below]),e.slug);
 }
 const e=entry('frightened'),custom={...stateRecipe(e),stages:stateRecipe(e).stages.map(s=>({...s,offsetY:-1.1,scale:.4}))};
 const state={...useStateEntry({},e.id),customized:[e.id]};
 const item={type:'condition',name:e.name,slug:e.slug,system:{active:true}};
 assert.equal(resolveStateRecipe(item,state,[custom]).stages[0].offsetY,-1.1);
});

test('lasting conditions and effects never use footage that reads as fog clouds on a token', () => {
 // The *_01 chain loops pull chains out of dark smoke portals; web.loop is the Web spell's 5x5 area.
 const smoky = /markers\.chain\.[a-z_]+\.loop\.01|web\.loop/;
 for (const e of [...PF2E_CONDITIONS, ...PF2E_EFFECTS]) {
  const keys = stateRecipe(e).stages.flatMap(s => s.assets).join(' ');
  assert.doesNotMatch(keys, smoky, e.name);
 }
});
