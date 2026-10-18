import {colorAffinity} from './color-affinity.mjs';
import {writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dnd5eSources,dnd5eBookSources,hasNativeActivation} from './dnd5e-source.mjs';
import {nativeDirection,weaponModes,weaponSound,weaponVisualFamily,damageThemes,deliveryGesture,LASTING_AREAS,LASTING_EVENT,LASTING_EMANATIONS} from './dnd5e-directions.mjs';
import {assetDatabases} from './asset-databases.mjs';
import {resolveSpellMedia,assetGeometry} from './spell-asset-selection.mjs';
import {SPELL_THEMES} from '../scripts/catalogs/pf2e/spells/spell-choreography.mjs';
import {validateRecipe} from '../scripts/core/model.mjs';
import {statePresentation} from '../scripts/catalogs/shared/state-presentation.mjs';
import {selectWeaponMedia} from './weapon-asset-selection.mjs';
import {ABILITY_SOUND_PROFILES} from '../data/ability-sounds.mjs';
import {SOUND_PROFILES} from '../data/spell-sounds.mjs';
import {MEDIA_DURATIONS} from '../data/media-durations.mjs';
const hash=v=>createHash('sha256').update(String(v)).digest('hex');
const seed=v=>parseInt(hash(v).slice(0,8),16);
// --books builds the official-book catalog from the developer's local export (see
// dnd5eBookSources): only content the SRD lacks, without any of its text.
const BOOKS=process.argv.includes('--books');
const data=BOOKS?await dnd5eBookSources():await dnd5eSources(),db=await assetDatabases(),rows=[];
const allAssets=new Map(Object.values(db).flat().map(r=>[r.key,r]));
const mediaCache=new Map();
const siblingCache=new Map();
// Rotate genuine sibling variants only: same geometry, family and color.
function siblings(key,id,edition){const base=allAssets.get(key);if(!base)return key;const identity=k=>k.split('.').map(p=>/^\d+$/.test(p)?'#':p).join('.');const cacheKey=edition+identity(key);if(!siblingCache.has(cacheKey))siblingCache.set(cacheKey,db[edition].filter(r=>identity(r.key)===identity(key)&&assetGeometry(r)===assetGeometry(base)));const options=siblingCache.get(cacheKey);return (options[seed(id)%options.length]??base).key;}
function media(direction,row,id){
 const theme=SPELL_THEMES[direction.theme]?direction.theme:'arcane',defaults=SPELL_THEMES[theme];
 const profile={...defaults,...Object.fromEntries(['bolt','hit','area','aura','cast'].filter(k=>typeof direction[k]==='string').map(k=>[k,direction[k]])),...(direction.areaAsset?{area:direction.areaAsset}:{}),...(direction.slotThemes?{slotThemes:direction.slotThemes}:{})};
 // The shared necrotic/curse themes list Toll the Dead's bell first: as a generic
 // impact it rang on Finger of Death, Harm or a life-stealing sword. Only spells
 // that name it keep the bell; other necrotic hits drain life inward.
 if(typeof profile.hit==='string'&&/^toll_the_dead/.test(profile.hit)&&typeof direction.hit!=='string'&&!/toll|knell|bell/i.test(row.source.name))profile.hit='energy_strands.in,impact.004.dark_purple,impact.001.purple';
 // The fire theme's hit is Fireball's whole explosion: only things that explode
 // keep it; a creature touching Wall of Fire or rammed by Flaming Sphere burns.
 if(typeof profile.hit==='string'&&/(?:^|,)fireball\.explosion/.test(profile.hit)&&typeof direction.hit!=='string'&&!/fireball|meteor|explo|blast|burst|bomb|grenade/i.test(`${row.source.name} ${direction.activity?.name??''}`))profile.hit='impact.fire,'+profile.hit.split(',').filter(k=>!k.startsWith('fireball.explosion')).join(',');
 const key=JSON.stringify([theme,profile,row.source.name,direction.delivery,direction.areaTiles]);
 if(!mediaCache.has(key))mediaCache.set(key,resolveSpellMedia(db,theme,profile,defaults,{system:'dnd5e',name:row.source.name,slug:id,delivery:direction.delivery==='fork'?'chain':direction.delivery==='rayFan'?'coneRayFan':direction.delivery,design:{...(direction.areaTiles?{areaLayout:'tiles'}:{}),pattern:['ray','fork','rayFan'].includes(direction.delivery)?'ray':['missile','areaMissile'].includes(direction.delivery)?'missile':'generic',assetIntent:row.source.name}}));
 const resolved=mediaCache.get(key);
 return Object.fromEntries(Object.entries(resolved).map(([slot,keys])=>[slot,[...new Set(['patreon','free'].map(edition=>{const key=keys.find(k=>db[edition].some(r=>r.key===k));return siblings(key,id+slot,edition);} ))]]));
}
const sustained={blinded:'markers.runes',charmed:'markers.heart',deafened:'markers.mute',exhaustion:'token_border.circle.static',frightened:'markers.fear',grappled:'markers.chain',incapacitated:'markers.stun',invisible:'condition.boon.02.001.refraction,token_border.circle.static',paralyzed:'markers.chain',petrified:'token_border.circle.static',poisoned:'markers.poison',prone:'token_border.circle.static',restrained:'web.0,markers.chain',stunned:'markers.stun',unconscious:'markers.sleep,token_border.circle.static',dead:'markers.skull',concentrating:'markers.runes',bloodied:'markers.drop'};
// Marker grammar: icon = category, color = valence or damage type. Variants are
// chosen deterministically by color affinity (never a random color per entry)
// and substituted colors are tinted so Advantage/Disadvantage, buffs/penalties
// and resistance types stay distinguishable.
const DAMAGE_HEX={acid:'#b8e580',cold:'#8cdcff',fire:'#ffad64',force:'#c9b8ff',lightning:'#acb0ff',necrotic:'#9366bf',poison:'#8dd998',psychic:'#e29be9',radiant:'#fff0ab',thunder:'#b9cff5',bludgeoning:'#d8bf8a',piercing:'#d8bf8a',slashing:'#d8bf8a'};
const DAMAGE_COLOR={acid:'green',cold:'blue',fire:'orange',force:'purple',lightning:'blue',necrotic:'purple',poison:'green',psychic:'pink',radiant:'yellow',thunder:'blue',bludgeoning:'grey',piercing:'grey',slashing:'grey'};
const THEME_HEX={fire:'#ffad64',cold:'#8cdcff',electricity:'#acb0ff',acid:'#b8e580',poison:'#8dd998',blood:'#ed859b',light:'#ffe2a0',spirit:'#fff0cf',void:'#9366bf',shadow:'#8c7ab8',plant:'#9de6b0',healing:'#8be6c4',water:'#87d6ee',ward:'#8bbdf4',earth:'#c9a27a'};
function stateAssets(row,theme){
 const name=row.source.name.toLowerCase(),status=row.statusId??row.source.statuses?.[0];
 const damage=name.match(/\b(acid|cold|fire|force|lightning|necrotic|poison|psychic|radiant|thunder|bludgeoning|piercing|slashing)\b/)?.[1];
 const vulnerable=/vulnerab/.test(name),defense=/resistan|immun|ward|shield|armor/.test(name)&&!vulnerable;
 const negative=vulnerable||/disadvantage|penalt|cursed|lethargy|\bslow|withered|enfeebl|enervat|weaken|sickness|fatigue|taxed|insanit|befuddl|disease|cannot heal|wounded|-\s*\d|−\s*\d/.test(name);
 const positive=!negative&&/advantage|bonus|\+\s*\d|blessed|bless|heroism|\baid\b|enhanced|guidance/.test(name);
 // Iron chains are chains even when the native status is Restrained.
 const chained=/chain|manacle|shackle|iron/.test(name)&&/restrain|chain|bound|imprison/.test(name);
 const hint=chained?'markers.chain':sustained[status]??(
  vulnerable?'condition.curse,token_border.circle.static':
  defense&&damage==='fire'?'shield_themed.above.fire,shield.01.loop':
  defense&&damage==='cold'?'shield_themed.above.ice,shield.01.loop':
  defense&&!damage&&/armor|\bac\b/.test(name)?'shield.02.loop,shield.01.loop':
  defense?'shield.01.loop':
  /insanit|befuddl|confus|madness/.test(name)?'dizzy_stars':
  /disease/.test(name)?'fumes.04.loop,markers.poison':
  /divine|thaumaturg/.test(name)?'dancing_light':
  /cloud giant strength|giant strength \(cloud\)/.test(name)?'whirlwind':
  /storm giant strength|giant strength \(storm\)/.test(name)?'static_electricity,lightning_ball':
  /messenger|message/.test(name)?'swirling_feathers':
  /imprisonment: slumber/.test(name)?'sleep.symbol,sleep.cloud':
  /imprisonment: buried/.test(name)?'falling_rocks.top,ground_cracks':
  /imprison/.test(name)?'energy_field.01,energy_field':
  /ioun|enhanced (?:agility|awareness|fortitude|insight|intellect|leadership|mastery|protection|strength)/.test(name)?'markers.light_orb,dancing_light':
  /\bfly|flying|levitat/.test(name)?'token_border.circle.spinning':
  /haste|speed/.test(name)&&!negative?'token_border.circle.spinning':
  /slow|letharg|exhaust/.test(name)?'token_border.circle.static':
  /hunt|mark/.test(name)?'hunters_mark.loop':
  /chain|manacle|shackle|iron/.test(name)&&/restrain|chain|bound|imprison/.test(name)?'markers.chain':
  /temporary hit points|temp hp/.test(name)?'markers.heart':
  /rage/.test(name)?'aura_themed.01.orbit.loop.metal':
  /invisib/.test(name)?sustained.invisible:
  negative?'condition.curse,token_border.circle.static':
  positive?'condition.boon,token_border.circle.static':
  // No floating spectral weapon or annihilation sphere as an ambient marker.
  ({weapon:'token_border.circle.static',ward:'shield.01.loop,shield.02.loop',void:'energy_strands.overlay.dark_purple,token_border.circle.static'}[theme]??SPELL_THEMES[theme]?.aura??'token_border.circle.static'));
 const color=({poisoned:'green',bloodied:'red',exhaustion:'yellow',petrified:'grey',dead:'grey',restrained:'white',grappled:'grey',paralyzed:'yellow',diseased:'green'}[status]??(/disease/.test(name)?'green':damage&&(defense||vulnerable||/hunter/.test(name))?DAMAGE_COLOR[damage]:negative?'dark_red':positive?'green':{fire:'orange',cold:'blue',electricity:'blue',acid:'green',poison:'green',blood:'red',light:'yellow',spirit:'yellow',void:'purple',shadow:'purple',plant:'green',healing:'green',water:'blue',ward:'blue',earth:'brown'}[theme]));
 const hex=/disease/.test(name)||status==='diseased'?'#9cc26a':damage&&(defense||vulnerable||/hunter/.test(name))?DAMAGE_HEX[damage]:negative?'#e07a84':positive?'#a9dbb4':THEME_HEX[theme];
 const choose=options=>[...options].sort((a,b)=>colorAffinity(b.key,color)-colorAffinity(a.key,color)||a.key.localeCompare(b.key))[0].key;
 const assets=[...new Set(Object.entries(db).map(([edition,inventory])=>{for(const prefix of hint.split(',')){const options=inventory.filter(r=>r.key.startsWith('jb2a.'+prefix)&&assetGeometry(r)==='radial'&&!/intro|outro|complete|pulse|outburst/.test(r.key)&&!/markers\.chain\.[a-z_]+\.loop\.01|web\.loop/.test(r.key));if(options.length)return choose(options);}const options=inventory.filter(r=>r.key.startsWith('jb2a.token_border.circle.static'));if(!options.length)throw Error('No sustained media '+edition);return choose(options);} ))];
 const needsTint=Boolean(color&&hex)&&assets.some(k=>colorAffinity(k,color)<0.9);
 return {assets,tint:needsTint?{tintEnabled:true,colorize:true,tint:hex}:{}};
}
// One-shot stages play their whole movie (media-lifetime). Instantaneous
// actions must not hold the stage for 8-16 s: speed long clips up to 1.5x, then
// clip with a fade so casts end within ~3 s and other one-shots within ~4 s.
// Persistent (document) stages and travel flights are left alone.
function capOneShot(s){
 if(!s.assets?.length||s.persist||s.oneShot===false||s.clipEnd||['travel','projectile','motion','sound'].includes(s.kind))return;
 const cap=s.kind==='cast'?3000:4000,native=Math.max(0,...s.assets.map(k=>MEDIA_DURATIONS[k]??0));
 if(!native||native/(s.playbackRate??1)<=cap+250)return;
 s.playbackRate=Math.round(Math.min(1.5,Math.max(1,native/cap))*100)/100;
 if(native/s.playbackRate>cap+250){s.clipEnd=Math.round(cap*s.playbackRate);s.duration=cap;s.fadeOut=Math.max(s.fadeOut??0,500);}
}
function finiteRecipe(entry,row,raw,mode){
 const d=nativeDirection(row,raw,mode),id=`${raw._id}${mode?'-'+mode:''}`,m=mode?{}:media(d,row,entry.id+id),a=d.activity;
 let elementalSound;
 if(mode){
  const sound=weaponSound(row.source,mode),family=weaponVisualFamily(row.source);
  const type=row.source.system?.damage?.base?.types?.[0]??a.damage?.parts?.find(p=>p.types?.length===1)?.types[0]??'slashing';
  const material=t=>({lightning:'electricity',thunder:'sonic',necrotic:'void',radiant:'spirit',psychic:'mental'}[t]??t),element=material(type),physical=['slashing','piercing','bludgeoning'].includes(type);
  // Damage parts belong to this native attack variant. Do not infer a dormant
  // Flaming or conditional rider from the weapon's name/other activities.
  const hasDamage=p=>Number(p.number)>0||String(p.bonus??'').trim()&&!/^0+$/.test(String(p.bonus).trim())||p.custom?.enabled&&String(p.custom.formula??'').trim()&&!/^0+$/.test(String(p.custom.formula).trim());
  const elements=[...new Set([...(physical?[]:[element]),...(a.damage?.parts??[]).filter(p=>p.types?.length===1&&hasDamage(p)).flatMap(p=>p.types).filter(t=>!['slashing','piercing','bludgeoning'].includes(t)).map(material)])];
  d.nativeEnergy=!physical&&family==='contact';
  if(d.nativeEnergy){
   d.theme=damageThemes[type]??type;
   if(!d.area)d.delivery=mode==='melee'?'contact':/ray|beam/i.test(row.source.name)?'ray':'missile';
   d.sound=({electricity:'electric',sonic:'sonic',void:'void',mind:'psychic',light:'light'}[d.theme]??d.theme);
   Object.assign(m,media(d,row,entry.id+id));
  }else{
  const native=selectWeaponMedia(db,{name:row.source.name,slug:entry.slug},{mode,family,element:elements[0]??'physical',elements,damage:type,hands:row.source.system?.properties?.includes('two')?2:1,...(['contact','spike'].includes(family)?{contactRoots:[`melee_generic.${physical?type:'piercing'}`]}:family==='boulder'?{contactRoots:['impact.boulder'],flightRoots:['boulder.toss.01','boulder.toss.02'],}:family==='sword'?{flightRoots:['sword.throw.white','greatsword.throw']}:['hammer','maul','warhammer'].includes(family)?{flightRoots:['hammer.throw']}:{} )});
  if(family==='boulder')d.nativeMaterialProfile='earth';
  for(const [slot,keys]of Object.entries({bolt:native.assets.flight,hit:mode==='melee'?native.assets.contact:native.assets.accent}))m[slot]=[...new Set(['patreon','free'].map(edition=>siblings(keys.find(key=>db[edition].some(r=>r.key===key)),entry.id+id+slot,edition)).filter(Boolean))];
  // A dancing weapon flies and strikes on its own: show the spectral blade at
  // the victim instead of the wielder lunging with an ordinary swing.
  const dancing=mode==='melee'&&/^dancing /i.test(row.source.name)&&row.source.system?.type?.baseItem;
  if(dancing){const keys=['patreon','free'].map(edition=>[`.01.spectral.01.blue`,`.01.spectral`,``].map(p=>db[edition].find(r=>r.key.startsWith(`jb2a.spiritual_weapon.${dancing}${p}`))?.key).find(Boolean)).filter(Boolean);if(keys.length){m.hit=[...new Set(keys)];d.flyingWeapon=true;}}
  // A magical melee material adds a payload layer to its physical contact.
  if(elements.length&&mode==='melee')m.payload=native.assets.accent;
  for(const [i,keys]of Object.entries(native.assets).filter(([k])=>/^accent\d+$/.test(k)))m['payload'+i]=keys;
  const enchanted=`enchanted-${sound}-${elements[0]}`;if(ABILITY_SOUND_PROFILES[enchanted])elementalSound=enchanted;
  if(d.area)m.area=media(d,row,entry.id+id).area;
  }
 }
 const stages=[],add=(kind,slot,label,extra={})=>{
  if(!m[slot]?.length)throw Error(`Missing ${slot} for ${entry.name} / ${raw._id} / ${mode??d.delivery}`);
  const fast=m[slot].some(key=>/jb2a\.(?:teleport\.01|impact\.(?:008|009)|melee_generic\.slash)/.test(key));
  // Shared physical sound profiles anchor melee blows to contact, ranged
  // landings and elemental finishes to accent. Preserve these phase IDs.
  const phase=physical&&kind==='impact'?(slot==='hit'?(mode==='melee'||!mode?'contact':'accent'):slot.startsWith('payload')?'accent':slot):slot;
  const tint=d.tints?.[slot]?{tintEnabled:true,colorize:true,tint:d.tints[slot]}:{};
  const s={stageId:`${stages.length}-${phase}`,kind,label,assets:m[slot],duration:1400,scale:kind==='travel'?.65:1.65,opacity:1,fadeIn:0,fadeOut:180,oneShot:true,playbackRate:fast?.5:1,delay:0,...tint,...extra};stages.push(s);return s;
 };
 const motion=(motion,subject,delay,duration=1200,distance=.16)=>stages.push({stageId:'motion-'+stages.length,kind:'motion',label:motion==='pulse'?'Casting breath':motion==='lunge'?'Measured approach':motion==='levitate'?'Illustrative lift':motion==='dodge'?'Wind step':'Guard and settle',assets:[],motion,subject,delay,duration,distance,intensity:.6,...(motion==='dodge'?{motionRange:'distance'}:{})});
 // Delivery-aware performer gesture (tools/dnd5e-directions.mjs deliveryGesture).
 const gesture=(subject,delay,physical=false)=>{for(const g of [deliveryGesture(d,{subject,physical})].flat().filter(Boolean))stages.push({stageId:'motion-'+stages.length,kind:'motion',assets:[],delay,...g,...(g.motion==='dodge'?{motionRange:'distance'}:{})});};
 const physical=!d.nativeEnergy&&mode||d.physicalThrow||d.theme==='weapon',source=d.delivery==='source';
 // A net has no flight film: the wielder throws, then the binding web settles
 // on the first target (no arrow, no spark).
 const netThrow=Boolean(mode)&&mode!=='melee'&&/^net$/i.test(row.source.name);
 const launcher=/bow|crossbow|sling|blowgun|pistol|musket|rifle|revolver|shotgun|firearm|cannon|ballista|\bgun\b/i.test(`${row.source.system?.type?.baseItem??''} ${row.source.name}`);
 if(!d.followup&&!physical&&d.motion!=='none'&&!d.noCast)add('cast','cast','Gather '+(SPELL_THEMES[d.theme]?.label??'magic'),{scale:1.2,duration:1600});
 if(d.delivery==='fork'){
  const first=add('travel','bolt','Primary arc',{delay:350,targetSelection:'first',scale:.65});
  add('travel','bolt','Forks from primary',{afterStage:first.stageId,timingAnchor:'start',startOffset:450,travelOrigin:'firstTarget',targetSelection:'secondary',targetLimit:3,scale:.55});
  add('impact','hit','Electrical contact',{delay:950,scale:1.45,targetLimit:4});
  gesture('source',0);
 }else if(d.delivery==='rayFan'){
  add('travel','bolt','Eight prismatic rays',{delay:350,travelDestination:'area',areaLayout:'fan',fanCount:8,scale:.35,fanColors:['#ff4040','#ff9f38','#ffe166','#62dc85','#73b9ff','#795dce','#b87afa','#ff4040']});
  gesture('source',0);
 }else if(netThrow){
  m.hit=[...new Set(['patreon','free'].map(edition=>['jb2a.web.complete.002.white','jb2a.web.01','jb2a.web.02'].find(k=>db[edition].some(r=>r.key===k))).filter(Boolean))];
  motion('throw','source',0,1400,.12);stages.at(-1).label='Wind-up and throw';
  add('impact','hit','Net binds the target',{delay:650,scale:1.2,targetLimit:1});
  d.nativeMaterialProfile='chainBinding';
 }else if(['missile','ray','areaMissile'].includes(d.delivery)){
  const volley=d.count?{repeats:d.count,repeatScope:'total',repeatSimultaneous:entry.slug==='magic-missile',repeatInterval:120}:{};
  const travel=add('travel','bolt',physical?'Weapon release':d.delivery==='ray'?'Ray to recipient':'Flight to recipient',{delay:physical?250:400,scale:d.delivery==='ray'?.6:.7,...(d.delivery==='areaMissile'?{travelDestination:'area'}:{}),...volley});
  add(d.area?'template':'impact',d.area?'area':'hit',physical?'Weapon contact':'Payload contact',{afterStage:travel.stageId,timingAnchor:'end',scale:d.area?1:1.55,...volley});
  if(physical&&launcher)stages.push({stageId:'motion-'+stages.length,kind:'motion',assets:[],label:'Release and settle',motion:'recoil',subject:'source',delay:250,duration:1100,distance:.06,intensity:.5});
  else if(physical)motion('throw','source',0,1400,.12),stages.at(-1).label='Wind-up and throw';else gesture('source',0);
 }else if(d.area){
  const layout=d.area.type==='line'&&m.area.every(key=>assetGeometry(allAssets.get(key))==='radial')?'tiles':'fit';
  if(d.nativeCounts?.layers===7){
   const colors=['#ff4040','#ff9f38','#ffe166','#62dc85','#73b9ff','#795dce','#b87afa'];
   for(const [i,tint]of colors.entries())add('template','area',`Prismatic layer ${i+1}`,{delay:350+i*100,scale:d.area.type==='line'?.2:.72+i*.05,areaLayout:layout,tintEnabled:true,colorize:true,tint,offsetY:d.area.type==='line'?(i-3)*.12:0});
  }else add('template','area',a.name||'Area manifests',{delay:350,scale:d.areaScale??1,areaLayout:layout});
  gesture('source',0);
 }else{
  if(physical&&mode==='melee'&&!d.flyingWeapon)motion('lunge','source',0,1500,.22);
  const kind=source?'aura':d.delivery==='contact'?'impact':'aura';
  add(kind,source||!physical&&kind==='aura'?'aura':'hit',d.followup?'Follow-up contact':physical?'Physical contact':source?'Activation bloom':'Recipient bloom',{delay:physical||d.motion==='throw-small'?650:350,subject:source?'source':'targets',scale:physical?1.35:1.8});
  if(!d.followup&&!(physical&&mode==='melee'&&!d.flyingWeapon))gesture(source?'source':'targets',d.motion==='throw-small'?0:300,physical);
 }
 const contact=stages.find(s=>s.kind==='impact');
 if(contact)for(const slot of Object.keys(m).filter(k=>k.startsWith('payload')))add('impact',slot,'Native magical material',{afterStage:contact.stageId,timingAnchor:'start',scale:1.5});
 const enchantmentTemplate=row.source.type==='weapon'&&!row.source.system?.type?.value&&row.effects?.some(e=>e.type==='enchantment');
 const missingPhysicalBase=row.source.type==='weapon'&&!row.source.system?.type?.value&&!row.source.system?.type?.baseItem&&!row.source.system?.damage?.base?.number&&a.attack?.type?.classification!=='spell';
 const weaponNeedsBase=enchantmentTemplate||missingPhysicalBase;
 const delegated=weaponNeedsBase||['cast','forward','summon'].includes(a.type)||d.trigger==='manual'||raw._id==='manual';
 const roles=delegated?{automatic:'requires-role-resolution',source:'native performer',targets:['chosen recipient or summon'],requiresSource:true,requiresTargets:false,reason:a.type==='check'?d.note:enchantmentTemplate?'This native enchantment template requires a chosen base weapon in Foundry. Its catalog preview is symbolic; customize the applied weapon before enabling automatic playback.':missingPhysicalBase?'This native item has no physical weapon base or damage. Use its resulting native spells; this symbolic cue remains manual.':'This activity delegates spell casting or creates another performer. Use the native resulting spell/attack animation; this symbolic activation is available for manual preview.'}:undefined;
 const targetLimit=a.type==='attack'?1:Number(d.nativeCounts?.maxTargets??a.target?.affects?.count);
 if(targetLimit>0&&d.delivery!=='fork'&&!d.count)for(const s of stages)if(['travel','impact','projectile'].includes(s.kind)||s.subject==='targets')s.targetLimit=targetLimit;
 if(d.nativeCounts?.illustrativeBeats){
  // The native attack activities own actual hit contacts. These are cosmetic
  // performer beats, distinguishing basic and heightened Flurry activations.
  const beat=stages.find(s=>s.kind==='motion');if(beat){beat.motion='lunge';beat.distance=.1;beat.repeats=d.nativeCounts.illustrativeBeats;beat.repeatInterval=1100;beat.duration=1100;beat.label=`${beat.repeats} illustrative flurry beats`;}
 }
 // A lasting area (Fog Cloud, Web, Wall of Fire…) stays on its template: the art
 // loops until the template is removed. Instantaneous areas play once.
 const duration=a.duration?.override?a.duration:row.source.system?.duration;
 const spellName=row.source.name.toLowerCase(),actName=(a.name??'').toLowerCase();
 const emanation=LASTING_EMANATIONS.has(spellName);
 const lasting=d.area&&d.trigger==='template'&&!d.followup&&row.source.type==='spell'&&(LASTING_AREAS.has(spellName)||emanation)&&!LASTING_EVENT.test(actName)&&!['inst',''].includes(duration?.units??'');
 // A lasting ward is a circle on the ground, never a standing hex dome; a shelter or
 // globe that is a sphere uses the smooth force sphere.
 const globe=/tiny hut|prismatic wall/.test(spellName);
 const lasts=k=>{
  if(/^jb2a\.energy_field\.02\./.test(k))return globe?'jb2a.wall_of_force.sphere.blue':'jb2a.magic_signs.circle.02.abjuration.loop.blue';
  for(const from of ['.complete.','.burst.']){const l=k.replace(from,'.loop.');if(l!==k&&allAssets.has(l))return l;}
  return k;
 };
 if(lasting)for(const s of stages.filter(s=>s.kind==='template')){
  s.persist=true;s.oneShot=false;s.fadeOut=Math.max(s.fadeOut??0,800);
  if(emanation)s.followSource=true;
  s.assets=[...new Set(s.assets.map(lasts))];
 }
 for(const s of stages)capOneShot(s);
 const recipe=validateRecipe({id:`animater-${entry.id}-${id}`,name:entry.name,systemId:'dnd5e',catalogEntry:entry.id,activityId:raw._id,...(mode?{weaponMode:mode}:{}),itemUuid:row.uuid,match:entry.slug,description:d.note,category:entry.group,color:SPELL_THEMES[d.theme]?.color,trigger:delegated?'manual':d.trigger,previewArea:d.area,playbackRoles:roles,stages});
 let soundProfile=d.sound===null?null:d.nativeMaterialProfile??elementalSound??(d.physicalThrow||d.nativeEnergy?d.sound:mode?weaponSound(row.source,mode):physical?ABILITY_SOUND_PROFILES[d.sound]||SOUND_PROFILES[d.sound]?d.sound:weaponSound(row.source,mode):d.sound);
 const RAY_FALLBACK={fireRay:'fire',coldRay:'cold',forceRay:'force',radiantRay:'holy',moonRay:'light',darkRay:'void',poisonRay:'poison',forceMissile:'force',chainLightning:'electric',teleport:'force',objectWhoosh:'wind',starFlight:'light'};
 const exclude=d.followup&&!mode?['cast','release','chain']:d.physicalThrow?['cast']:[],flight=stages.some(s=>['travel','projectile'].includes(s.kind));
 if(soundProfile&&RAY_FALLBACK[soundProfile]&&!(SOUND_PROFILES[soundProfile]??[]).some(c=>!exclude.includes(c.role)&&(flight||!['release','chain'].includes(c.role))))soundProfile=RAY_FALLBACK[soundProfile];
 const soundNamespace=!d.nativeMaterialProfile&&!d.nativeEnergy&&!d.physicalThrow&&(mode||d.theme==='weapon')&&ABILITY_SOUND_PROFILES[soundProfile]?'ability':'spell';
 if(soundProfile&&!(soundNamespace==='ability'?ABILITY_SOUND_PROFILES:SOUND_PROFILES)[soundProfile])throw Error(`Unregistered sound profile ${soundProfile} for ${entry.name}`);
 return {id,label:`${a.name||a.type}${mode?' · '+mode:''}`,activityId:raw._id,activityName:a.name||'',activityType:a.type,reviewed:d.reviewed,theme:d.theme,...(mode?{weaponMode:mode}:{}),rationale:d.note,artLimit:d.reviewed?'Native choreography reviewed; edition fallback may substitute color.':'Semantic composition; symbolic artwork where no literal JB2A asset exists.',soundNamespace,soundProfile,soundExcludeRoles:d.followup&&!mode?['cast','release','chain']:d.physicalThrow?['cast']:[],recipe};
}
function entryFor(row,kind){
 const s=row.source,id=`dnd5e-${row.pack}-${s._id}${row.parent?'-'+row.parent._id:''}`;
 const dummy=row.parent?{...row,source:row.parent}:row,d=nativeDirection(dummy,{_id:'state',type:'utility',activation:{type:'special'},target:{affects:{type:'self'}}});
 const name=s.name??'Effect',slug=(s.system?.identifier??name.toLowerCase().replace(/[^a-z0-9]+/g,'-'));
 const entry={id,uuid:row.uuid,documentId:s._id,pack:row.pack,path:row.path,sourceURL:row.sourceURL,name,slug,identifier:s.system?.identifier??slug,descriptionText:row.description,descriptionHash:hash(row.description),edition:row.edition,kind,img:s.img??row.parent?.img,level:s.system?.level??null,group:kind==='spell'?s.system?.school??'Spell':kind==='feat'?s.system?.type?.value??'Feature':kind==='weapon'?s.system?.type?.baseItem??'Weapon':kind==='condition'?'Condition':kind==='effect'?'Native effect':s.system?.type?.value??s.type,theme:d.theme,quality:d.reviewed?'curated':'symbolic',reviewed:d.reviewed,...(row.statusId?{statusId:row.statusId}:{}),...(row.parent?{parentUuid:row.uuid.split('.ActiveEffect.')[0],parentDocumentId:row.parent._id,transfer:s.transfer===true}:{}),variants:[]};
 if(['condition','effect'].includes(kind)){
  const {assets,tint}=stateAssets(row,d.theme),p=statePresentation({assets});
  entry.variants=[{id:'sustained',label:'Sustained native state',rationale:'Attached visual follows the native active document. Removal, suppression, scene changes and native expiry stop it; no sound loop or token displacement.',artLimit:'Symbolic status cue. Native rules and visibility remain authoritative.',recipe:validateRecipe({id:`animater-${id}-state`,name,systemId:'dnd5e',catalogEntry:id,stateEntry:id,lifecycle:'document',trigger:'effect',itemUuid:row.uuid,category:entry.group,color:SPELL_THEMES[d.theme]?.color,match:name,stages:[{stageId:'sustained',kind:'aura',label:'Sustained visual',assets,...p,...tint,subject:'source',persist:true,duration:6000,fadeIn:400,fadeOut:400}]})}];
 }else{
  for(const a of row.activities)for(const mode of kind==='weapon'?weaponModes(s,a):[undefined])entry.variants.push(finiteRecipe(entry,row,a,mode));
  if(!entry.variants.length)entry.variants.push(finiteRecipe(entry,row,{_id:'manual',type:'utility',name:'Manual native activation',activation:{type:'special'}},undefined));
  entry.reviewed=entry.variants.some(v=>v.reviewed);entry.quality=entry.reviewed?'curated':'symbolic';entry.theme=entry.variants[0].theme;
 }
 if(row.book){delete entry.descriptionText;delete entry.descriptionHash;delete entry.path;delete entry.sourceURL;entry.requires=row.book;}
 return entry;
}
if(BOOKS){
 const {DND5E_ENTRIES}=await import('../data/dnd5e-catalog.mjs');
 const {srdSpellName}=await import('../scripts/catalogs/dnd5e/dnd5e-catalog.mjs');
 const {normalize}=await import('../scripts/core/model.mjs');
 const kindOf=s=>s.type==='spell'?'spell':s.type==='feat'?'feat':s.type==='weapon'?'weapon':'item';
 const srd=new Set(DND5E_ENTRIES.flatMap(e=>[`${e.kind}:${normalize(e.name)}`,`${e.kind}:id:${e.identifier}`]));
 // A book copy of SRD content already resolves to the SRD entry at play time.
 const covered=s=>[s.name,kindOf(s)==='spell'?srdSpellName(s.name):s.name].some(n=>srd.has(`${kindOf(s)}:${normalize(n)}`))||s.system?.identifier&&srd.has(`${kindOf(s)}:id:${s.system.identifier}`);
 for(const [kind,list] of [['spell',data.spells],['feat',data.features.filter(r=>hasNativeActivation(r.source))],['weapon',data.weapons],['item',data.items.filter(r=>hasNativeActivation(r.source))]]){
  // Books reprint each other (Heroes of the Borderlands repeats PHB spells): one entry
  // per kind and identifier, the Player's Handbook copy first.
  const rank=r=>/players-handbook/.test(r.book)?0:/dungeon-masters/.test(r.book)?1:/monster-manual/.test(r.book)?2:3,seen=new Set();
  for(const row of [...list].sort((x,y)=>rank(x)-rank(y))){const k=`${kind}:${row.source.system?.identifier||normalize(row.source.name)}`;if(seen.has(k)||covered(row.source))continue;seen.add(k);rows.push(entryFor(row,kind));}
 }
 const counts=Object.fromEntries(['spell','feat','weapon','item'].map(k=>[k,rows.filter(r=>r.kind===k).length]));
 await writeFile(new URL('../data/dnd5e-book-catalog.mjs',import.meta.url),`// Generated from the developer's official D&D book modules: content the SRD lacks.\n// Names, ids and Animater's own compositions only; no book text. Entries show only\n// while their book module (entry.requires) is active.\nexport const DND5E_BOOK_ENTRIES=${JSON.stringify(rows)};\n`);
 console.log(JSON.stringify({books:counts,variants:rows.reduce((n,r)=>n+r.variants.length,0)}));
 process.exit(0);
}
for(const [kind,list] of [['spell',data.spells],['feat',data.features.filter(r=>hasNativeActivation(r.source))],['weapon',data.weapons],['item',data.items.filter(r=>hasNativeActivation(r.source))],['condition',data.conditions],['effect',[...data.standaloneEffects,...data.embeddedEffects].filter(r=>r.source.type!=='enchantment')]])for(const row of list)rows.push(entryFor(row,kind));
const source={version:data.systemVersion,ref:data.ref,sha:data.sha,scope:'Public SRD 5.1 and 5.2, 2014 and 2024 official system packs',license:'SRD text CC-BY-4.0; system code MIT',counts:Object.fromEntries(['spell','feat','weapon','item','condition','effect'].map(k=>[k,rows.filter(r=>r.kind===k).length]))};
await writeFile(new URL('../data/dnd5e-catalog.mjs',import.meta.url),`// Generated from pinned official public D&D sources. See docs/dnd5e-native-research.md.\nexport const DND5E_SOURCE=${JSON.stringify(source)};\nexport const DND5E_ENTRIES=${JSON.stringify(rows)};\n`);
console.log(JSON.stringify({...source,variants:rows.reduce((n,r)=>n+r.variants.length,0)}));
