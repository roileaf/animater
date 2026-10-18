import test from 'node:test';
import assert from 'node:assert/strict';
import {PF2E_FEATS} from '../../data/pf2e-feats.mjs';
import {PF2E_WEAPONS} from '../../data/pf2e-weapons.mjs';
import {featRecipe} from '../../scripts/catalogs/pf2e/feats/feat-choreography.mjs';
import {weaponRecipe} from '../../scripts/catalogs/pf2e/weapons/weapon-choreography.mjs';
import {reviewedFeatActivation,featPlaybackRoles} from '../../scripts/catalogs/pf2e/feats/feat-direction.mjs';
import {analyzeWeapon} from '../../tools/weapon-semantics.mjs';
import {payloadAppearance} from '../../scripts/catalogs/pf2e/weapons/weapon-payloads.mjs';
import {nativeFeatRoots} from '../../tools/feat-asset-selection.mjs';
import {selectWeaponMedia} from '../../tools/weapon-asset-selection.mjs';
import {previewPlan} from '../../scripts/core/model.mjs';
const token=(id,x)=>({id,center:{x,y:100},w:100,h:100,document:{x:x-50,y:50,width:1,height:1}});
const source=token('source',100),targets=Array.from({length:6},(_,i)=>token(`target-${i+1}`,400+200*i));
const context={source,targets,gridSize:100};
const feat=slug=>{
 const f=reviewedFeatActivation(PF2E_FEATS.find(f=>f.slug===slug));assert.ok(f,slug);
 const assets={...f.assets,bolt:['jb2a.bullet.physical.white'],hit:['jb2a.melee_generic.slash.01.white'],transfer:['jb2a.particles.002.white'],guard:['jb2a.shield.01.white'],shieldHit:['jb2a.melee_attack.06.shield.white'],landing:['jb2a.ground_cracks.01.white'],magicFinish:['jb2a.energy_field.01.blue'],spiritFinish:['jb2a.divine_smite.target.yellowwhite'],manifestation:['jb2a.shimmer.01.blue'],rescue:['jb2a.shield.01.white']};
 return {...f,assets,mediaTiming:{}};
};
const plan=slug=>previewPlan(featRecipe(feat(slug)),context);
test('two firearm feats fly to one foe, rather than showing paired swords',()=>{
 for(const slug of ['paired-shots','twin-shot-knockdown']){
  const recipe=featRecipe(feat(slug)),shots=previewPlan(recipe,context).filter(s=>s.kind==='travel');
  assert.equal(shots.length,2,slug);assert.ok(shots.every(s=>s.destination.id==='target-1'),slug);
  assert.ok(!recipe.stages.some(s=>s.motion==='lunge'),slug);
 }
});
test('Bullet Split sends one simultaneous projectile to each of two different foes',()=>{
 const shots=plan('bullet-split').filter(s=>s.kind==='travel');
 assert.equal(shots.length,2);assert.deepEqual(shots.map(s=>s.destination.id),['target-1','target-2']);
 assert.equal(shots[0].delay,shots[1].delay);
});
test('Anatomical Quartering visits at most four distinct foes, with spirit at final capped foe',()=>{
 const recipe=featRecipe(feat('anatomical-quartering'));
 for(const count of [1,3,6]){
  const p=previewPlan(recipe,{...context,targets:targets.slice(0,count)});
  const hits=p.filter(s=>s.label==='Ordered melee contacts');
  assert.equal(hits.length,Math.min(4,count));assert.equal(new Set(hits.map(s=>s.destination.id)).size,hits.length);
  const spirit=p.find(s=>s.label.includes('becomes spirit'));assert.equal(spirit.destination.id,`target-${Math.min(4,count)}`);
 }
});
test('Cross Final Horizon approaches and holds for three same-foe unarmed contacts',()=>{
 const f=feat('cross-the-final-horizon'),r=featRecipe(f),p=previewPlan(r,context);
 const path=p.find(s=>s.kind==='motion'&&s.motionRange==='target'),hits=p.filter(s=>s.label.includes('unarmed contacts'));
 assert.equal(hits.length,3);assert.ok(hits.every(s=>s.destination.id==='target-1'));
 assert.ok(hits.at(-1).delay<path.delay+path.duration*(path.motionArrival+path.motionHold)/100);
 assert.ok(nativeFeatRoots(f)[0].includes('unarmed'));
});
test('Clear the Way depicts Shove attempts and later movement, without weapon Strikes',()=>{
 const r=featRecipe(feat('clear-the-way')),p=previewPlan(r,context);
 assert.equal(p.filter(s=>s.label.includes('Shove attempt')).length,5);
 const shoves=p.filter(s=>s.label.includes('Shove attempt')),stride=p.find(s=>s.motion==='rush');
 assert.ok(stride.delay>=Math.max(...shoves.map(s=>s.delay+s.duration)));
 assert.ok(!r.stages.some(s=>s.label.includes('melee contacts')));
});
test('Everstand and Clans Edge guard the source after correct contact counts',()=>{
 for(const [slug,count] of [['everstand-strike',1],['clans-edge',2]]){
  const r=featRecipe(feat(slug)),p=previewPlan(r,context),hits=p.filter(s=>s.kind==='impact');
  assert.equal(hits.length,count,slug);
  const guard=r.stages.find(s=>s.assets.includes('jb2a.shield.01.white'));assert.equal(guard.subject,'source');
  assert.ok(!r.stages.some(s=>s.kind==='aura'&&s.subject==='targets'));
 }
});
test('Into the Fray uses different weapon and shield recipients and actual approach',()=>{
 const r=featRecipe(feat('into-the-fray')),p=previewPlan(r,context),hits=p.filter(s=>s.kind==='impact');
 assert.deepEqual(hits.map(s=>s.destination.id),['target-1','target-2']);
 assert.notDeepEqual(hits[0].assets,hits[1].assets);assert.ok(p.some(s=>s.motion==='rush'));
});
test('Triggerbrand Blitz uses first second third and does not duplicate missing third target',()=>{
 const r=featRecipe(feat('triggerbrand-blitz'));
 for(const n of [2,4]){
  const p=previewPlan(r,{...context,targets:targets.slice(0,n)});
  const attacks=p.filter(s=>s.kind==='impact'||s.kind==='travel');
  assert.deepEqual(attacks.map(s=>s.destination.id),n===2?['target-1','target-2']:['target-1','target-2','target-3']);
 }
});
test('intake feats carry visible moving energy from victim to source',()=>{
 for(const slug of ['borrowed-ability','brain-drain','exsanguinate','desiccating-inhalation','desperate-revival']){
  const r=featRecipe(feat(slug)),p=previewPlan(r,{...context,targets:targets.slice(0,1)}),mote=p.find(s=>s.kind==='projectile');
  assert.ok(mote,slug);assert.equal(mote.origin.id,'target-1');assert.equal(mote.endpoint.id,'source');
  assert.ok(!r.stages.some(s=>s.motion==='lunge'));
 }
});
test('secondary rays originate at previously struck foe and rune endpoints are not attacked',()=>{
 for(const slug of ['cascading-ray','killshots-report']){
  const p=plan(slug),ray=p.find(s=>s.kind==='travel');assert.equal(ray.origin.id,'target-1');assert.equal(ray.destination.id,'target-2');
  assert.equal(p.filter(s=>s.kind==='travel').length,1);assert.ok(!p.some(s=>s.kind==='cast'));
 }
 assert.ok(!featRecipe(feat('chain-of-words')).stages.some(s=>s.kind==='impact'));
});
test('Godbreaker has synchronized bounded ascent, three unarmed contacts and a final ground slam',()=>{
 const p=plan('godbreaker'),paths=p.filter(s=>s.kind==='motion');
 assert.equal(paths.length,2);assert.ok(paths.every(s=>s.motionHeading==='up'&&s.distance<=2));
 assert.equal(p.filter(s=>s.label.includes('upward unarmed')).length,3);
 const slam=p.find(s=>s.label.includes('ground slam'));assert.ok(slam.delay>=paths[0].delay+paths[0].duration);
});
test('Blazing Streak contacts different victims once; Chain Reaction only fires the initial bullet',()=>{
 const streak=featRecipe(feat('blazing-streak'));
 for(const count of [1,3,6]){
  const p=previewPlan(streak,{...context,targets:targets.slice(0,count)}),hits=p.filter(s=>s.kind==='impact');
  assert.equal(hits.length,Math.min(count,4));assert.equal(new Set(hits.map(s=>s.destination.id)).size,hits.length);
  assert.ok(p.some(s=>s.kind==='motion'&&s.motionRange==='target'));
 }
 const chain=plan('chain-reaction');assert.equal(chain.filter(s=>s.kind==='travel').length,1);
 assert.equal(chain.filter(s=>s.kind==='impact').length,targets.length);
});
function bomb(slug){
 const w=PF2E_WEAPONS.find(w=>w.slug===slug);assert.ok(w,slug);
 const old=w.modes[0],s={group:'bomb',range:20,damage:{damageType:old.damage,dice:1,die:'d6',...(old.persistent?{persistent:{number:1,type:old.persistent}}:{})},traits:{value:w.traits},description:{value:w.description}};
 const analyzed=analyzeWeapon({_id:w.id,name:w.name,img:w.img,system:s},`${slug}.json`);
 analyzed.modes[0].assets={...old.assets,accent:['jb2a.fireball.explosion.orange'],accent2:['jb2a.impact.001.white'],flight:['jb2a.throwable.throw.bomb.black'],residue:['jb2a.energy_field.01.blue']};analyzed.modes[0].mediaTiming={};
 return analyzed;
}
test('native bomb material distinctions survive shared damage types',()=>{
 for(const [slug,style,hue] of [['silversoul-bomb','silverLight','silver'],['silverscrap-bomb-lesser','shrapnel','silver'],['vexing-vapor-lesser','gas','redPowder'],['crystal-shards-moderate','crystal','crystal'],['blightburn-bomb','radiation','poison'],['sticky-algae-bomb-lesser','algae','poison']]){
  const payload=bomb(slug).modes[0].payload;assert.equal(payload.style,style,slug);assert.equal(payload.element,hue,slug);
 }
 assert.equal(bomb('aether-marbles-lesser').modes[0].payload.residue,true);
 assert.equal(payloadAppearance('redPowder',['jb2a.smoke.grey']).tint,'#c64e49');
 assert.deepEqual(payloadAppearance('physical',['jb2a.explosion.shrapnel.black']),{});
});
test('Star Grenade produces two perpendicular local flame arms at the same arrival',()=>{
 const r=weaponRecipe(bomb('star-grenade-lesser'),'thrown'),p=previewPlan(r,context),arms=p.filter(s=>s.label.includes('flame release'));
 assert.equal(arms.length,2);assert.equal(arms[0].delay,arms[1].delay);assert.equal(arms[1].rotation-arms[0].rotation,90);
 assert.ok(arms.every(s=>s.destination.id==='target-1'));
});
test('mode-specific persistence stays with its own usage and unconditional wounding stays visible',()=>{
 const system={group:'firearm',range:20,traits:{value:['combination']},damage:{damageType:'piercing',die:'d6',persistent:{number:1,type:'acid'}},meleeUsage:{group:'sword',traits:[],damage:{damageType:'slashing',die:'d8'}},description:{value:'A combination gun sword.'}};
 const combo=analyzeWeapon({_id:'combo',name:'Combo',system},'combo.json');
 assert.deepEqual(combo.modes.map(m=>m.persistent),['acid','']);
 const bleeding=analyzeWeapon({_id:'wounding',name:'Wounding dagger',system:{group:'knife',traits:{value:[]},damage:{damageType:'piercing',die:'d4'},runes:{property:['wounding']},description:{value:'Always-on wounding rune.'}}},'wounding.json');
 assert.equal(bleeding.modes[0].persistent,'bleed');
 const conditional=analyzeWeapon({_id:'crit',name:'Critical flame',system:{group:'sword',traits:{value:[]},damage:{damageType:'slashing',die:'d6'},rules:[{key:'DamageDice',selector:'{item|id}-damage',damageType:'fire',category:'persistent',critical:true}],description:{value:'Critical hits ignite the target.'}}},'crit.json');
 assert.equal(conditional.modes[0].persistent,'');assert.ok(!conditional.modes[0].elements.includes('fire'));
 const tearing=analyzeWeapon({_id:'tear',name:'Obsidian edged club',system:{group:'club',traits:{value:['tearing']},damage:{damageType:'slashing',die:'d8'},description:{value:'Razor-sharp obsidian edges.'}}},'macuahuitl.json');
 assert.equal(tearing.modes[0].persistent,'bleed');assert.ok(tearing.modes[0].elements.includes('bleed'));
 const implicit=analyzeWeapon({_id:'bleed',name:'Bleeding spear',system:{group:'spear',traits:{value:[]},damage:{damageType:'piercing',die:'d6'},rules:[{key:'DamageDice',selector:'{item|id}-damage',damageType:'bleed',diceNumber:1,dieSize:'d6'}],description:{value:'Always-on bleed damage.'}}},'bleeding-spear.json');
 assert.equal(implicit.modes[0].persistent,'bleed');
});
test('Cane of Maelstrom adds finite Warpwave after melee and thrown contact, without activated powers',()=>{
 const native=PF2E_WEAPONS.find(w=>w.slug==='cane-of-the-maelstrom');assert.ok(native);
 const weapon=analyzeWeapon({_id:native.id,name:native.name,system:{group:'club',baseItem:'club',traits:{value:['thrown-10']},damage:{damageType:'slashing',die:'d6'},description:{value:native.description}}},'cane-of-the-maelstrom.json');
 for(const mode of weapon.modes){
  assert.equal(mode.onHitCue,'warpwave');assert.equal(mode.element,'physical');
  mode.assets={contact:['jb2a.club.melee.01.white'],flight:['jb2a.dagger.throw.01.white'],accent:['jb2a.impact.001.white'],onHit:['jb2a.energy_field.01.multicolored','jb2a.energy_field.01.blue']};mode.mediaTiming={};
  const recipe=weaponRecipe(weapon,mode.mode),p=previewPlan(recipe,context),wave=p.find(s=>s.label.includes('Warpwave'));
  assert.ok(wave);assert.equal(wave.destination.id,'target-1');assert.equal(wave.persist,false);assert.equal(wave.oneShot,false);
  const contact=p.find(s=>s.stageId===wave.afterStage);assert.ok(contact);assert.equal(wave.delay,contact.delay+250);
  assert.equal(p.filter(s=>s.kind==='travel').length,mode.mode==='thrown'?1:0);
  assert.ok(!recipe.stages.some(s=>/mirage|creation|shield/i.test(s.label)));
 }
 const rows=['jb2a.club.melee.01.white','jb2a.impact.001.white','jb2a.energy_field.01.multicolored','jb2a.energy_field.01.blue'].map(key=>({key,file:`${key}.webm`}));
 const selection=selectWeaponMedia({patreon:rows,free:rows.filter(r=>!r.key.includes('multicolored'))},weapon,weapon.modes[0]);
 assert.deepEqual(selection.assets.onHit,['jb2a.energy_field.01.multicolored','jb2a.energy_field.01.blue']);
 assert.equal(selection.selections.find(s=>s.slot==='onHit'&&s.edition==='free').approximation,true);
});
test('native performer and ordered victim roles are explicit, never inferred from caster and current targets',()=>{
 const reviewed=PF2E_FEATS.filter(f=>featPlaybackRoles(f));assert.equal(reviewed.length,51);
 for(const f of reviewed){const roles=featPlaybackRoles(f);assert.equal(roles.automatic,'requires-role-resolution');assert.ok(roles.requiresSource||roles.requiresTargets);assert.ok(!roles.reason.includes('undefined'));}
 for(const [slug,sourceRole] of [['bone-burst','thrall'],['eidolons-retort','eidolon'],['defend-summoner','eidolon'],['merciless-rend','eidolon'],['piercing-jab','eidolon'],['surprising-leap','eidolon'],['engine-of-destruction','construct-innovation'],['elemental-artillery','ballista'],['essence-overflow','spectral-dragon'],['danse-macabre','horde'],['power-slide','vehicle'],['trampling-charge','mount'],['death-dive','mount'],['rearing-display','mount'],['steeds-toppling-strike','mount']]){
  const f=feat(slug),roles=featPlaybackRoles(f);assert.equal(roles.source,sourceRole,slug);assert.equal(roles.requiresSource,true);assert.equal(roles.automatic,'requires-role-resolution');assert.ok(roles.reason.includes(f.name));assert.deepEqual(f.playbackRoles,roles);
 }
 for(const slug of ['cascading-ray','killshots-report']){
  const roles=featPlaybackRoles(feat(slug));assert.equal(roles.requiresSource,false);assert.equal(roles.requiresTargets,true);assert.equal(roles.targets[1],'secondary-victim');assert.ok(roles.targets[0].includes('spellstrike-victim'));
 }
 for(const slug of ['megavolt','guardian-lion-roar','deep-freeze','distracting-explosion','explosive-leap','megaton-strike','searing-restoration','silk-bracelet'])assert.deepEqual(featPlaybackRoles(feat(slug)).sourceAlternatives,['worn-innovation','construct-innovation'],slug);
 assert.equal(featPlaybackRoles(feat('magical-onslaught')).multiplePerformers,true);
 assert.deepEqual(featPlaybackRoles(feat('magical-onslaught')).performers,['eidolon','summoner']);
 for(const slug of ['tandem-strike','tandem-movement','pack-movement','duo-dragon-kick','cavaliers-charge','mammoth-charge','shadowpiercing-charge'])assert.equal(featPlaybackRoles(feat(slug)).multiplePerformers,true,slug);
 assert.equal(featPlaybackRoles(feat('chain-of-words')).requiresTargets,true);
 assert.equal(featPlaybackRoles(feat('march-of-the-dead')).targets[0],'commanded-thralls');
 // Centaur/Sarangay body traversal and ordinary victim-to-caster intake do
 // not become companion actions merely because they resemble their motif.
 for(const slug of ['borrowed-ability','brain-drain','exsanguinate','sudden-charge'])assert.equal(featPlaybackRoles(feat(slug)),null,slug);
});
test('Defend Our Union visibly approaches once before its conditional protective Strike',()=>{
 const p=plan('defend-our-union'),path=p.find(s=>s.kind==='motion'&&s.motionRange==='target'),hits=p.filter(s=>s.kind==='impact');
 assert.ok(path);assert.equal(path.motion,'rush');assert.equal(hits.length,1);assert.equal(hits[0].destination.id,'target-1');
 assert.ok(hits[0].delay>=path.delay+path.duration*path.motionArrival/100);assert.ok(hits[0].delay<path.delay+path.duration*(path.motionArrival+path.motionHold)/100);
});
