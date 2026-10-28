import {assetGeometry} from './spell-asset-selection.mjs';
import {colorAffinity} from './color-affinity.mjs';
import {variantFiles} from './asset-databases.mjs';

// Reviewed against the full localized native descriptions. These cues never
// move actors, decide outcomes, or change PF2e's visibility or action economy.
const palettes={vividRed:['red','#ff4a5a'],clock:['blue','#8fb0ff'],fire:['orange','#ff8a3d'],frost:['blue','#8cdcff'],grey:['grey','#b7bdc8'],white:['white','#e4e9f2'],black:['dark_black','#555765'],purple:['purple','#ba9cdd'],red:['dark_red','#cf7284'],green:['green','#9ac885'],yellow:['yellow','#e6d096'],blue:['blue','#94bdd6'],pink:['pink','#e2a6ce'],orange:['orange','#c89f83'],
 // Debuff palette: dim, desaturated hues so afflictions never read as a power-up.
 // Hue names that no JB2A key spells exactly (gray, violet, crimson, gold, cyan, silver)
 // pick the nearest footage by affinity and always colorize it to the muted hex,
 // so Patreon never swaps in a saturated native colour.
 ash:['gray','#9aa0aa'],umber:['gray','#9a6a3c'],amber:['gold','#e3a338'],crimson:['dark_red','#c8344c'],dusk:['violet','#8b7bd0'],violetMind:['violet','#a35ae0'],bruise:['violet','#c04aa8'],grave:['violet','#7a3fc0'],blood:['dark_red','#d03040'],rust:['crimson','#c4502e'],
 bile:['gold','#8fc23a'],slate:['cyan','#3f6fe0'],numb:['gold','#e0c83a'],mustard:['gold','#e0902e'],glare:['silver','#d6d0b2'],teal:['teal','#2fb8b0'],blindfold:['dark_black','#262833'],rime:['cyan','#8fb3c8'],spectral:['silver','#c3cad6']};
const track=(property,from,to,duration,pingPong=true)=>({property,from,to,duration,loop:true,pingPong,ease:'easeInOutQuad'});
const flatten=value=>[{property:'scale.y',from:value,to:value,duration:6000}];
const art=(roots,palette='grey',options={})=>({roots:Array.isArray(roots)?roots:[roots],palette,scale:1,opacity:.92,below:false,offsetX:0,offsetY:0,offsetUnits:'token',playbackRate:.8,...options});
// The color sits before the style in the database; selection handles that root.
const rim=(style,palette,options={})=>art('token_border.circle.static',palette,{style:`.${String(style).padStart(3,'0')}`,scale:1.35,below:true,...options});
const veil=(palette,options={})=>art('fog_cloud.01.white',palette,{scale:1.1,opacity:.8,...options});
const glyph=(root,palette,options={})=>art(`markers.${root}`,palette,{scale:.85,...(['fear','heart','mute','shield_cracked','skull','drop','poison','stun','runes','runes02','runes03'].includes(root)?{style:'.03'}:{}),...options});
const plan=(theme,quality,...layers)=>({theme,quality,layers});
// Visible-alpha centers measured across the complete movies, not the padded
// 400px frame. Blue and pink variants have slightly different vertical bounds.
const sleepAnchors={
 'SleepSymbol01_01_Regular_Blue_400x400.webm':{x:.6796875,y:.30859375},
 'SleepSymbol01_01_Dark_Pink_400x400.webm':{x:.6796875,y:.31640625},
};

// Reviewed multi-layer looks for individual effects (keyed by effect slug).
export const EFFECT_PLANS={
 // A thermal wheel: a burning ring and an orbit of icy motes turning in opposite
 // directions around the caster while the spell lasts.
 'spell-effect-entropic-wheel':plan('fire','curated',
  art('fire_ring.500px','fire',{scale:1.2,opacity:.75,below:true,playbackRate:.7,tracks:[track('rotation',0,360,7000,false)]}),
  art('aura_themed.01.orbit.loop.cold.01','frost',{scale:1.35,opacity:.85,playbackRate:.7,tracks:[track('rotation',0,-360,7000,false)]})),
 // The cast's force bubble stays up while the spell lasts: its loop in blue (the cast is purple), on the ring and
 // faint, so the token reads as inside a ward rather than behind a wall.
 'spell-effect-shield':plan('shield','curated',art('shield.01.loop','blue',{scale:1.15,opacity:.55})),
};
// Afflictions read as debuffs at a glance (Frightened is the reference): a compact,
// dim orbit marker or a low, heavy overlay in desaturated colour, with drooping,
// sinking, lurching or faltering motion. No bright swirls, haloes or spinning rings.
// Valued conditions are scaled at play time by levelIntensity (persistent-states.mjs),
// so every base look here stays between roughly 0.8x and 1.4x the token.
const sink=(ms,drop=.14,from=.9)=>[track('position.y',-.04,drop,ms,false),track('alpha',from,.1,ms,false)];
const lurch=(deg,ms)=>[track('rotation',-deg,deg,ms),track('scale.x',.86,1.06,ms*1.2)];
// One-shot footage (eyes, sleep Zs, dizzy stars, a growing drop shadow) fades in and out; a lasting layer
// loops only its steady stretch (clipStart-clipEnd, ms of the clip) so it never blinks to nothing.
const EYES={clipStart:500,clipEnd:4000},SLEEP={clipStart:500,clipEnd:2000};
const shadow=(options={})=>art('drop_shadow','black',{scale:1.15,offsetY:.15,below:true,opacity:.55,playbackRate:.5,clipStart:1900,clipEnd:2300,...options});
export const CONDITION_PLANS={
 // Sight gone, the token still readable: a dim eye over the eyes keeps fading out under a
 // dark blindfold of haze (the old darkness disc hid the whole token).
 blinded:plan('vision','symbolic',
  art('eyes.01','ash',{style:'.single',scale:.4,offsetY:-.26,opacity:.85,playbackRate:.6,...EYES,tracks:[track('alpha',.1,.8,2400)]}),
  art(['fog_cloud.01.white','ambient_fog.001.loop.small.white'],'blindfold',{scale:.62,offsetY:-.24,opacity:.9,playbackRate:.5,tracks:[...flatten(.45),track('alpha',.75,.95,2600)]})),
 broken:plan('broken','themed',glyph('shield_cracked','ash',{scale:.95})),
 // Stumbling: native yellow dizzy stars wobbling over the head, drawn above the token art.
 clumsy:plan('coordination','symbolic',art('dizzy_stars.200px','yellow',{scale:.95,offsetY:-.4,opacity:1,above:true,playbackRate:.7,clipStart:300,clipEnd:1100,tracks:[track('rotation',-12,12,1100)]})),
 // A faint refractive ring: the token stays readable (no fog over it).
 concealed:plan('fog','themed',art('template_circle.aura.04.outward.001.loop.combined','grey',{scale:1.2,opacity:.55,below:true})),
 // Reeling: a murky ring of stars lurching erratically around the head.
 confused:plan('mind','symbolic',glyph('circle_of_stars','mustard',{scale:1,offsetY:-.15,opacity:1,tracks:[track('rotation',-35,35,1700),track('position.x',-.05,.05,2300)]})),
 // Dominated: a dim violet control sigil with faint puppet strands over the body.
 controlled:plan('mind','symbolic',glyph('runes02','bruise',{scale:1,tracks:[track('alpha',.75,1,2600)]}),art('energy_strands.overlay','bruise',{scale:1.1,opacity:.65,playbackRate:.5})),
 cursebound:plan('curse','symbolic',glyph('runes','grave',{scale:1})),
 // Glare: a washed-out haze flickering across the eyes, not a halo of light.
 dazzled:plan('vision','themed',art('fog_cloud.01.white','glare',{scale:.85,offsetY:-.2,opacity:.85,playbackRate:.6,tracks:[track('alpha',.55,.95,700)]})),
 deafened:plan('silence','symbolic',glyph('mute','ash',{scale:.8})),
 // Omen of death: a grave-violet skull orbit over a creeping shadow.
 doomed:plan('death','symbolic',glyph('skull','grave',{scale:1}),art('darkness.black','black',{scale:1.15,offsetY:.1,below:true,opacity:.6})),
 // Sapped life: an ashen heart that keeps fading.
 drained:plan('health','symbolic',glyph('heart','crimson',{scale:1,tracks:[track('alpha',.65,1,2600)]})),
 // Faltering heartbeat over a pool of shadow.
 dying:plan('death','symbolic',glyph('heart','blood',{scale:1,tracks:[track('alpha',.55,1,1600)]}),art('darkness.black','black',{scale:1.2,offsetY:.1,below:true,opacity:.6})),
 // Overburdened: a heavy shadow pressed flat at the feet and laboured breath.
 encumbered:plan('slow','symbolic',shadow({scale:.8,offsetY:.28,opacity:.75,tracks:flatten(.55)}),art('smoke.plumes_loop','umber',{scale:.8,offsetY:-.28,opacity:.75,playbackRate:.45})),
 // Strength sapped: dim crimson motes drawn out of the body into a slowly draining ring at the feet,
 // while the body sags (condition-body.mjs). Both loop; the old strand burst played once and vanished.
 enfeebled:plan('weakness','symbolic',art('particles.inward','crimson',{scale:1.1,opacity:.8,playbackRate:.6}),art('template_circle.aura.03.inward.002.loop','crimson',{scale:1.3,opacity:.6,below:true,playbackRate:.6})),
 // Entranced: a glazed, unblinking stare.
 fascinated:plan('mind','symbolic',art('eyes.01','bruise',{style:'.single',scale:.75,offsetY:-.2,opacity:1,playbackRate:.5,...EYES,tracks:[track('alpha',.75,1,3000)]})),
 // Weary: a small, fading sleep cue over a sagging shadow (Unconscious uses the full symbol).
 fatigued:plan('slow','symbolic',art('sleep.symbol','dusk',{style:'.dark_pink',scale:.8,offsetY:-.2,opacity:.95,playbackRate:.45,...SLEEP,mediaAnchors:sleepAnchors,tracks:[track('alpha',.6,.95,3500)]})),
 // Panic: a dark-red horror marker circling the bearer.
 fleeing:plan('fear','symbolic',glyph('horror','blood',{style:'.03',scale:.95})),
 friendly:plan('attitude','symbolic',glyph('heart','pink',{scale:.65})),
 frightened:plan('fear','themed',glyph('fear','purple',{scale:1})),
 // The *_02 chain loops are clean rings; the *_01 loops pull chains out of dark smoke portals,
 // which read as fog clouds around the token. Each binding keeps its own chain shape.
 grabbed:plan('chains','themed',art(['markers.chain.spike.loop.02','markers.chain.standard.loop.02'],'grey',{scale:1.5})),
 helpful:plan('attitude','symbolic',glyph('heart','pink',{scale:.65}),glyph('heart','pink',{scale:.55,mirrorX:true})),
 hidden:plan('invisible','symbolic',rim(6,'grey',{opacity:.85})),
 // Aggression: a targeting sigil over the dark red attitude rim.
 hostile:plan('attitude','symbolic',rim(7,'red',{scale:1.4}),art('hunters_mark.loop','red',{scale:.38,opacity:.85,offsetX:.3,offsetY:-.3})),
 // Held in place: the binding motif of Grabbed/Restrained, shackled flat at the feet.
 immobilized:plan('chains','symbolic',art(['markers.chain.square.loop.02','markers.chain.standard.loop.02'],'grey',{scale:1.45,offsetY:.25,tracks:flatten(.55)})),
 indifferent:plan('attitude','symbolic',rim(1,'grey')),
 // A steady refractive shimmer over the body (the boon refraction was a single burst).
 invisible:plan('invisible','symbolic',art('template_circle.aura.04.inward.001.loop.combined','white',{scale:1.3,opacity:.75})),
 observed:plan('neutral','symbolic',rim(2,'white',{scale:1.3})),
 'off-guard':plan('broken','symbolic',glyph('shield_cracked','blood',{scale:.75})),
 // Locked rigid: numb, barely-moving nerve crackle over a still shadow (no chains or ice).
 paralyzed:plan('slow','symbolic',art('static_electricity','numb',{scale:1.1,opacity:.9,playbackRate:.25})),
 // Unknown type: dull blood-red tendrils of ongoing harm (no blood drop claimed).
 'persistent-damage':plan('neutral','symbolic',art('energy_strands.overlay','blood',{scale:1.1,opacity:.85,playbackRate:.6})),
 // Turned to stone: grey mineral settling inward with a faint dust haze.
 petrified:plan('stone','symbolic',art('aura_themed.01.inward.loop.metal','ash',{scale:1.3,opacity:.9,playbackRate:.4}),art(['ambient_fog.001.loop.small.white','fog_cloud.01.white'],'ash',{scale:1.1,opacity:.35,below:true,playbackRate:.4})),
 // Lying in the dirt: the token tips onto its side (condition-body.mjs) over a flattened
 // shadow and a low dust patch on the ground plane.
 prone:plan('slow','symbolic',shadow({scale:.8,offsetY:.28,opacity:.75,tracks:flatten(.4)}),art(['ambient_fog.001.loop.small.white','fog_cloud.01.white'],'umber',{scale:1.2,offsetY:.3,opacity:.7,below:true,playbackRate:.5,tracks:flatten(.35)})),
 quickened:plan('speed','symbolic',art('token_border.circle.spinning','blue',{scale:1.4,below:true,playbackRate:.75})),
 // Bound tighter than Grabbed: the chains plus a faint web holding the body (the token-sized
 // web: web.loop is the Web spell's 5x5 area and reads as fog clouds around the token).
 restrained:plan('chains','themed',art('markers.chain.standard.loop.02','grey',{scale:1.5}),art('web','white',{style:'.01',scale:1.15,opacity:.5,playbackRate:.6})),
 // Nausea: a sickly green smoke ring curling around the bearer (not a bubble, not poison).
 sickened:plan('fog','symbolic',art('markers.smoke.ring.loop','green',{scale:1.2,opacity:.95,playbackRate:.6,tracks:[track('rotation',-8,8,2200)]})),
 // Mired: a slate tar pool drags at the feet while a heavy haze sinks into it.
 // Time drags: a clock-hand sweep crawling round a dial at the bearer's feet (JB2A has no clock; the radar sweep reads as one).
 slowed:plan('slow','symbolic',art(['extras.tmfx.radar.circle.loop.01.slow','extras.tmfx.radar.circle.loop.01.normal'],'clock',{scale:1.45,below:true,opacity:1,playbackRate:.45})),
 stunned:plan('stun','themed',glyph('stun','teal',{scale:.95})),
 // Dulled mind: a blue rune marker circling the head.
 stupefied:plan('mind','symbolic',glyph('runes03','blue',{scale:1})),
 unconscious:plan('slow','themed',art('sleep.symbol','blue',{scale:.95,offsetY:-.2,playbackRate:.7,...SLEEP,mediaAnchors:sleepAnchors})),
 undetected:plan('invisible','symbolic',rim(5,'grey',{opacity:.85})),
 unfriendly:plan('attitude','symbolic',rim(3,'rust',{scale:1.35})),
 unnoticed:plan('invisible','symbolic',rim(4,'grey',{opacity:.85})),
 wounded:plan('health','symbolic',glyph('heart','blood',{scale:.75})),
 // Starfinder 2e afflictions (conditions pack entries without a PF2e twin).
 // Malfunction: steel-blue static that sputters on and off.
 glitching:plan('electricity','symbolic',art('static_electricity','slate',{scale:1.1,opacity:.85,playbackRate:.6,tracks:[track('alpha',.5,1,350)]})),
 // Pinned down under fire: pressed low in drifting gunsmoke.
 suppressed:plan('slow','symbolic',shadow({scale:.8,offsetY:.2,opacity:.7,tracks:flatten(.55)}),art('smoke.plumes_loop','ash',{scale:.95,opacity:.75,playbackRate:.5})),
 // Adrift: the shadow detaches and wavers below a body that cannot push off.
 untethered:plan('slow','symbolic',shadow({scale:.7,offsetY:.35,opacity:.55,tracks:[track('scale.x',.75,.95,3600),track('scale.y',.75,.95,3600)]}),art('fumes.04.loop','ash',{scale:.95,opacity:.6,playbackRate:.3,tracks:[track('position.y',-.06,.06,3600)]})),
};

// Persistent damage keeps its element but shows harm on the body, not a protective dome.
export const DAMAGE_PLANS={
 // Corrosion: fizzing acid bubbles with a dripping acid marker.
 acid:plan('acid','themed',art('bubble.001.001.loop','bile',{scale:1.1,opacity:.8}),glyph('drop','bile',{scale:.75})),
 bleed:plan('blood','themed',glyph('drop','red',{scale:.85})),
 // Bruising blow: a cracked marker in bruise violet.
 bludgeoning:plan('broken','symbolic',glyph('shield_cracked','bruise',{scale:.9})),
 // Frostbite: a rimed snowflake marker circling the bearer.
 cold:plan('cold','themed',glyph('snowflake','rime',{style:'.03',scale:.9})),
 // Crackling shocks across the body.
 electricity:plan('lightning','themed',art('static_electricity','blue',{scale:1.1,opacity:.85})),
 fire:plan('fire','themed',art('flames.04.loop','orange',{scale:1.2,opacity:.85})),
 // Crushing pressure: violet strands squeezing in.
 force:plan('shield','symbolic',art('energy_strands.overlay','purple',{scale:1.05,opacity:.7,tracks:[track('scale.x',.9,1.02,900),track('scale.y',.9,1.02,900)]})),
 mental:plan('mind','symbolic',glyph('runes03','grave',{scale:.9,brightness:.85})),
 // Physical persistent damage: a repeating stab for piercing and red claw rakes for
 // slashing, so the three physical types no longer differ only by rotation.
 piercing:plan('broken','symbolic',art(['melee_generic.piercing.one_handed','rapier.melee.01'],'red',{scale:.95,opacity:.55,playbackRate:.6})),
 poison:plan('poison','themed',glyph('poison','green',{scale:1})),
 slashing:plan('broken','symbolic',art('claws.200px','red',{scale:1.05,opacity:.6,playbackRate:.6})),
 // Concussive ringing: a dim field that judders against the body.
 sonic:plan('sonic','symbolic',art('energy_field.01','ash',{scale:1.1,opacity:.5,tracks:[track('scale.x',.9,1.04,300),track('scale.y',.9,1.04,300)]})),
 // Spirit wound: an anguished spectral horror marker.
 spirit:plan('void','symbolic',glyph('horror','spectral',{style:'.03',scale:.9})),
 // Searing vitality: pale steam scalding the bearer.
 vitality:plan('light','symbolic',art('fumes.steam','glare',{scale:1.05,opacity:.65,playbackRate:.6})),
 void:plan('void','symbolic',art('energy_strands.overlay','black',{scale:1.2})),
};

function build(entry,definition,db,id){
 if(!definition)throw Error(`Missing reviewed condition design: ${id}`);
 const layers=definition.layers.map((spec,index)=>{
  const {roots,palette,style,mediaAnchors,...layout}=spec,[color,tint]=palettes[palette],chosen={};
  for(const [edition,rows] of Object.entries(db)){
   let candidates=[];
   for(const root of roots){
    candidates=rows.filter(r=>(r.key===`jb2a.${root}`||r.key.startsWith(`jb2a.${root}.`))&&assetGeometry(r)==='radial'&&!/intro|outro|complete|outburst|pulse/.test(r.key)&&!/markers\.chain\.[a-z_]+\.loop\.01|web\.loop/.test(r.key)&&(!style||r.key.endsWith(style)));
    if(candidates.length)break;
   }
   if(!candidates.length)throw Error(`Missing ${id} layer ${index+1}: ${roots} (${edition})`);
   const colored=candidates.filter(r=>r.key.split('.').some(c=>c===color||c===`dark_${color}`));
   chosen[edition]=(colored.length?colored:candidates).sort((a,b)=>colorAffinity(b.key,color)-colorAffinity(a.key,color)||a.key.localeCompare(b.key))[0];
  }
  const editions=Object.fromEntries(Object.entries(chosen).map(([edition,row])=>{
   const files=variantFiles(row),anchor=mediaAnchors?.[files[0]?.split(/[\\/]/).at(-1)];
   if(mediaAnchors&&(files.length!==1||!anchor))throw Error(`Unmeasured ${id} artwork anchor (${edition}): ${files}`);
   return [edition,{key:row.key,files,colorSubstitution:!row.key.split('.').some(c=>c===color||c===`dark_${color}`),...(anchor?{anchor}:{})}];
  }));
  const primaryAnchor=editions.patreon.anchor;
  return {...layout,...(primaryAnchor?{customAnchor:true,anchorX:primaryAnchor.x,anchorY:primaryAnchor.y}:{}),stageId:`condition-${index+1}`,label:entry.name,assets:[...new Set([chosen.patreon.key,chosen.free.key])],tint,tintEnabled:true,colorize:true,editions};
 });
 const primary=layers[0];
 return {theme:definition.theme,quality:definition.quality,color:primary.tint,rationale:'',evidence:'native-condition-description',conditionDesign:{id,descriptionHash:entry.descriptionHash,layers},...primary,presentationRole:primary.below?'field':'body'};
}

export function buildEffectDesign(entry,db){
 return EFFECT_PLANS[entry.slug]?{...build(entry,EFFECT_PLANS[entry.slug],db,entry.slug),evidence:'Reviewed complete native description'}:null;
}
export function buildConditionDesign(entry,db){
 const design=build(entry,CONDITION_PLANS[entry.slug],db,entry.slug);
 if(entry.slug==='persistent-damage')design.damageVariants=Object.fromEntries(Object.entries(DAMAGE_PLANS).map(([type,definition])=>[type,build(entry,definition,db,`persistent-${type}`)]));
 return design;
}
