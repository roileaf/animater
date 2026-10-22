import {validateRecipe} from '../../../core/model.mjs';
import {withCatalogFx} from '../../shared/catalog-fx.mjs';
import {addAbilitySounds} from '../../../engines/sound/ability-sounds.mjs';
import {addSurfaceSounds} from '../../../engines/sound/surface-sounds.mjs';
import {WEAPON_COLORS as colors,BOMB_PAYLOADS,payloadAppearance} from './weapon-payloads.mjs';
import {normalizeElement} from '../../shared/element-choice.mjs';
import {MARKS} from '../../../engines/marks/ground-marks.mjs';
export function weaponRecipe(weapon,modeName=weapon?.modes?.[0]?.mode,options={}){
 const mode=weapon?.modes?.find(m=>m.mode===modeName);
 if(!mode?.assets)throw Error('Choose a supported weapon use from the catalog.');
 const systemId=weapon.systemId??'pf2e';
 const id=`${systemId}-weapon-${weapon.id}-${mode.mode}`,color=colors[mode.element]??colors.physical;
 const stage=(kind,slot,label,delay,extra={})=>{const film=Math.max(1300,...(mode.assets[slot]??[]).map(k=>mode.mediaTiming?.[k]?.duration??0))+150,long=kind==='impact'&&film>4650;
  return {kind,stageId:`${id}-${slot}`,assets:mode.assets[slot],label,delay,duration:long?4650:film,...(long?{clipEnd:4050}:{}),scale:1,oneShot:true,fadeIn:0,fadeOut:long?600:120,scaleInDuration:0,targetSelection:'first',...extra};};
 const firing=mode.mode==='ranged'&&['firearm','airgun'].includes(mode.family);
 // Per-mode body language: melee lunges (reach weapons extend rather than
 // step in), thrown objects and bombs wind back and release (the throw snaps
 // forward at 35%, so flight starts there), bows draw back, crossbows and
 // other launchers kick lightly at release, guns recoil on discharge.
 const thrown=mode.mode==='thrown',drawn=mode.mode==='ranged'&&mode.family==='bow';
 const duration=thrown?mode.heavy?1100:900:mode.heavy?1500:mode.agile?1000:1250;
 const start=firing?(mode.heavy?520:420):thrown?Math.round(duration*.38):duration/2;
 const motion=firing?'recoil':thrown?'throw':mode.mode==='melee'?'lunge':drawn?'brace':'recoil';
 const distance=mode.mode==='melee'?mode.reach?.12:mode.heavy?.2:.14:firing?mode.traits?.includes('kickback')?.14:.08:thrown?mode.heavy?.16:.12:drawn?.1:.05;
 const launcher=!firing&&!thrown&&!drawn&&mode.mode==='ranged';
 const gesture={kind:'motion',stageId:`${id}-motion`,label:mode.mode==='melee'?mode.reach?'Reaching thrust':mode.heavy?'Weighty wind-up':'Measured approach':thrown?'Wind back and throw':firing?'Discharge recoil':drawn?'Draw and loose':'Release kick',assets:[],motion,subject:'source',delay:firing?start:launcher?Math.max(0,start-60):0,duration:firing?900:launcher?600:duration,intensity:1,distance,targetSelection:'first'};
 let stages=[];
 let contactStage;
 if(options.motion!==false)stages.push(gesture);
 if(mode.mode==='melee'){
  const contact=stage('impact','contact',mode.family==='contact'?'Weapon contact':`${mode.family} contact`,start,{scale:mode.contactScale??(mode.family==='dagger'?.85:mode.heavy?1.2:1),rotation:mode.family==='axe'?-25:mode.family==='whip'?25:0});
  stages.push(contact);
  contactStage=contact;
  if(mode.element!=='physical')stages.push(stage('impact','accent',`${mode.element} finish`,start+180,{scale:.9,afterStage:contact.stageId,timingAnchor:'start',startOffset:180,...payloadAppearance(mode.element,mode.assets.accent)}));
 }else{
  const flight=stage('travel','flight',`${mode.family} ${mode.mode==='thrown'?'flight':'shot'}`,start,{scale:mode.family==='sling'?.55:mode.family==='bomb'||mode.family==='flask'?.75:1});
  if(firing&&mode.family==='firearm'&&mode.assets.muzzle?.length)stages.push(stage('cast','muzzle','Muzzle flash',Math.max(0,start-40),{scale:.55,opacity:.95,faceTarget:true,duration:Math.min(900,Math.max(300,...mode.assets.muzzle.map(k=>mode.mediaTiming?.[k]?.duration??600)))}));
  stages.push(flight);
  const contacts=mode.assets.flight.map(k=>mode.mediaTiming?.[k]?.contact).filter(Number.isFinite);
  const offset=contacts.length?Math.max(...contacts):Math.max(400,flight.duration-200);
  // The flight arrives when its contact lands: playback moves that contact (and what is timed to it) to the
  // landing of the range variant it plays (engines/playback/flight-path.mjs).
  flight.contact=offset;
  const payload=mode.payload;
  contactStage=stage('impact','accent',payload?`${BOMB_PAYLOADS[payload.style]?.label??'Contents splash'} · ${payload.element}`:mode.element!=='physical'?`${mode.element} contact finish`:'Contact finish',start+offset,{afterStage:flight.stageId,timingAnchor:'start',startOffset:offset,scale:payload?1.25:.65,...payloadAppearance(payload?.element??mode.element,mode.assets.accent)});
  stages.push(contactStage);
  if(payload?.style==='crossFire'){
   Object.assign(contactStage,{label:'Horizontal flame release',tracks:[{property:'scale.x',from:1.9,to:1.9,duration:contactStage.duration},{property:'scale.y',from:.3,to:.3,duration:contactStage.duration}]});
   stages.push({...contactStage,stageId:`${id}-cross-vertical`,label:'Perpendicular flame release',rotation:90});
  }
  if(mode.returning)stages.push(stage('travel','return','Return to wielder',start+offset+250,{travelOrigin:'target',afterStage:flight.stageId,timingAnchor:'end',startOffset:0}));
 }
 // Bolas wrap the first target: a brief binding cue after a hit.
 if(mode.family==='bola'&&mode.assets.bind?.length)stages.push(stage('aura','bind','Bola wraps target · brief binding cue',contactStage.delay+150,{subject:'targets',requiresHit:true,afterStage:contactStage.stageId,timingAnchor:'start',startOffset:150,duration:1800,oneShot:false,fadeIn:120,fadeOut:400,scale:.6,opacity:.85,persist:false}));
 // Heavy shoving/tripping blows knock the struck target back a little.
 if(options.motion!==false&&mode.mode==='melee'&&mode.heavy&&['shove','trip'].some(t=>mode.traits?.includes(t)))stages.push({kind:'motion',stageId:`${id}-stagger`,label:'Target staggers',assets:[],motion:'stagger',subject:'targets',delay:contactStage.delay+120,afterStage:contactStage.stageId,timingAnchor:'start',startOffset:120,duration:900,intensity:.8,distance:.1,targetSelection:'first',requiresHit:true});
 if(mode.assets.fracture?.length)stages.push(stage('impact','fracture','Glass fragments',contactStage.delay+50,{afterStage:contactStage.stageId,timingAnchor:'start',startOffset:50,scale:.7,opacity:.55}));
 if(mode.onHitCue==='warpwave'&&mode.assets.onHit?.length)stages.push(stage('aura','onHit','Successful-hit Warpwave · visual cue',contactStage.delay+250,{subject:'targets',requiresHit:true,afterStage:contactStage.stageId,timingAnchor:'start',startOffset:250,duration:2200,oneShot:false,fadeIn:150,fadeOut:450,scale:1.15,opacity:.8,persist:false}));
 const secondary=[...new Set([...(mode.elements??[]).filter(e=>e!==mode.element),mode.payload?.secondary].filter(Boolean))];
 for(const [index,element]of secondary.entries())stages.push(stage('impact',`accent${index+2}`,`${element} additional finish`,contactStage.delay+180+index*100,{afterStage:contactStage.stageId,timingAnchor:'start',startOffset:180+index*100,scale:.85,...payloadAppearance(element,mode.assets[`accent${index+2}`])}));
 // Item-trait/construction flourishes (Staff of Fire, holy starknives): visual only, never damage.
 for(const [index,flavor]of (mode.flavor??[]).entries())if(mode.assets[`flavor${index+1}`]?.length)stages.push(stage('impact',`flavor${index+1}`,`${flavor} flourish`,contactStage.delay+220+index*110,{afterStage:contactStage.stageId,timingAnchor:'start',startOffset:220+index*110,scale:.8,opacity:.9,...payloadAppearance(flavor,mode.assets[`flavor${index+1}`])}));
 if(mode.assets.residue?.length)stages.push(stage('aura','residue',`${mode.payload?.style==='spores'?'Fungal growth':mode.payload?.style==='foam'?'Hardening debris':mode.persistent||mode.payload?.element||mode.element} residue · brief visual cue`,contactStage.delay+300,{subject:'targets',afterStage:contactStage.stageId,timingAnchor:'start',startOffset:300,duration:2400,oneShot:false,fadeIn:180,fadeOut:500,scale:.85,opacity:.75,persist:false,...payloadAppearance(mode.payload?.style==='spores'?'poison':mode.payload?.style==='insects'?'darkInsects':mode.persistent||mode.payload?.element||mode.element,mode.assets.residue)}));
 stages=addAbilitySounds(weapon,stages,{...options,mode:mode.mode,...(mode.soundDesign?{design:mode.soundDesign}:{})});
 // The blow also sounds like what it lands on (armour, a shield, chitin, stone), chosen per target as it plays.
 if(options.surfaceSound!==false)stages=addSurfaceSounds(weapon,stages,{sounds:options.sounds??options.soundCatalog,soundVolume:options.soundVolume,mode,anchor:contactStage,heft:mode.heavy?'heavy':mode.agile||mode.traits?.includes('finesse')?'light':null});
 const markElement=payloadMark(mode);
 return withCatalogFx(validateRecipe({id,name:`${weapon.name} · ${mode.mode}`,description:mode.rationale,category:'Weapons',color,trigger:'attack',match:`${weapon.name},${weapon.slug}`,itemUuid:weapon.uuid??`Compendium.${systemId}.${systemId==='sf2e'?'equipment':'equipment-srd'}.Item.${weapon.id}`,weaponMode:mode.mode,...(markElement?{markElement}:{}),stages}),weapon,{...options,mode});
}
// The floor mark a payload weapon's contents leave: its payload's element, else a bomb's persistent one. A gas
// cloud leaves nothing, nor do runes (a flaming longsword has no payload).
function payloadMark(mode){
 if(!mode.payload||mode.payload.style==='gas')return null;
 return [mode.payload.element,mode.persistent].map(normalizeElement).find(e=>e&&MARKS[e])??null;
}
