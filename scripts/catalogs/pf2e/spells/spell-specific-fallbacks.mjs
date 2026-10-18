// Replacements for the old cast/impact/rune fallback. Each explicit mapping
// follows the complete pinned native description, including delayed mechanics.
// No borrowed macro code. Unknown fiction is left for configuration.
const cue=(label,pattern,roots,extra={})=>({label,pattern,cast:'glint',...roots,castingOnly:true,...extra});
export const SPECIFIC_FALLBACK_MOTIFS={
 bodyEyes:cue('Eyes form across the body','bodyEyes',{hit:'eyes.01.dark_green.many',aura:'eyes.01.dark_green.few'}),
 senseEyes:cue('Senses sharpen','senseEyes',{hit:'eyes.01.dark_green.single',aura:'glint'}),
 forceEnclosure:cue('Force field encloses the target','forceEnclosure',{hit:'bubble.001.001.complete.blue',aura:'shield.01.loop.blue'}),
 muzzleForce:cue('Force muzzle closes around the mouth','muzzleForce',{hit:'energy_strands.complete',aura:'shimmer'},{symbolic:true}),
 delayedMoment:cue('Injury is held for a later moment','delayedMoment',{hit:'energy_field',aura:'shimmer'},{symbolic:true}),
 storedSpell:cue('A future spell is prepared','storedSpell',{hit:'ioun_stones',aura:'ward.rune'},{symbolic:true}),
 ancestralEcho:cue('Ancestral knowledge gathers','ancestralEcho',{hit:'eyes.01',aura:'twinkling_stars'},{symbolic:true}),
 angelHalo:cue('Angelic halo and healing field','angelHalo',{hit:'token_border.circle.spinning',aura:'template_circle.aura.01',area:'template_circle.aura.01'},{nativeArea:true,symbolic:true}),
 alarmWard:cue('An alert ward is placed','alarmWard',{hit:'ward.rune',area:'template_circle.aura.04.inward',aura:'ward.rune'},{nativeArea:true,symbolic:true}),
 groundAnoint:cue('Sanctifying oil and ground ward','groundAnoint',{hit:'liquid.splash',area:'template_circle.aura.01',aura:'ward.star'},{nativeArea:true,symbolic:true}),
 suppressionField:cue('Magic is suppressed within the field','suppressionField',{area:'antilife_shell',hit:'energy_field',aura:'energy_field'},{nativeArea:true,symbolic:true}),
 unravelSpell:cue('Incoming magic unravels','unravelSpell',{hit:'energy_strands.complete',aura:'particles.outward'},{symbolic:true}),
 nullifyFeedback:cue('Incoming magic breaks and feeds back','nullifyFeedback',{hit:'energy_strands.complete',aura:'energy_field'},{symbolic:true}),
 artisticSurface:cue('The object receives a new finish','artisticSurface',{hit:'shimmer',aura:'swirling_sparkles'},{symbolic:true}),
 crimsonWeapon:cue('Crimson light settles on the weapon','crimsonWeapon',{hit:'glint.red,glint',aura:'shimmer.red,shimmer'},{symbolic:true}),
 laughRipple:cue('A burst of laughter sustains magic','laughRipple',{hit:'soundwave.02',aura:'music_notations'},{symbolic:true}),
 twinBody:cue('An adjacent duplicate appears','twinBody',{hit:'shimmer',aura:'glint'},{symbolic:true}),
 companionTwin:cue('A companion duplicate appears','companionTwin',{hit:'swirling_sparkles',aura:'shimmer'},{symbolic:true}),
 adaptationWard:cue('Protection adapts to incoming energy','adaptationWard',{hit:'shield.01.intro.blue',aura:'particles.inward'},{symbolic:true}),
 sandField:cue('Swirling sand weakens defenses','sandField',{area:'particles.outward',hit:'particles.outward',aura:'particles.outward'},{nativeArea:true,symbolic:true}),
 antlionPit:cue('Sand pit','antlionPit',{area:'template_circle.vortex.loop.yellow,template_circle.vortex.loop.blue',hit:'particles.inward.white,particles.inward.greenyellow',aura:'particles.swirl.white,particles.swirl.greenyellow'},{nativeArea:true,symbolic:true}),
 lensField:cue('A suspended lens distorts space','lensField',{area:'bubble.002.001.loop.blue',aura:'shimmer',hit:'bubble.002.001.loop.blue'},{nativeArea:true}),
 divineWardField:cue('Divine protection fills the area','divineWardField',{area:'template_circle.aura.01',hit:'ward.star',aura:'ward.star'},{nativeArea:true,symbolic:true}),
 sacrificeLink:cue('Harm is transferred to the caster','sacrificeLink',{bolt:'energy_strands.range.standard',hit:'energy_strands.complete',aura:'glint'},{symbolic:true}),
 kineticRipple:cue('Kinetic force pushes outward','kineticRipple',{hit:'energy_field',aura:'energy_field'},{symbolic:true,castingOnly:false}),
 forceDismiss:cue('Mystic force drives the foe back','forceDismiss',{hit:'energy_strands.complete',aura:'particles.outward'},{symbolic:true,castingOnly:false}),
 eidolonWard:cue('The eidolon bond reinforces defenses','eidolonWard',{bolt:'energy_strands.range.standard',hit:'shield.01.intro.blue',aura:'on_token_buff.001.001'},{symbolic:true}),
 eidolonPower:cue('The eidolon bond empowers attacks','eidolonPower',{bolt:'energy_strands.range.standard',hit:'on_token_buff.001.001',aura:'energy_strands.complete'},{symbolic:true}),
 glitterSkin:cue('Glitter coats the body','glitterSkin',{hit:'swirling_sparkles',aura:'glint'}),
 planeStitch:cue('The target is stitched to its plane','planeStitch',{hit:'energy_strands.complete',aura:'ward.rune'},{symbolic:true}),
 peacefulShell:cue('An iridescent shell surrounds the area','peacefulShell',{area:'bubble.001.002.loop.blue',hit:'particle_burst.01.rune',aura:'particle_burst.01.rune'},{nativeArea:true,symbolic:true}),
 celestialBrand:cue('A blazing mark appears on the target','celestialBrand',{hit:'ward.rune.yellow',aura:'glint'},{symbolic:true}),
 dragonRoar:cue('A draconic roar fills the emanation','dragonRoar',{hit:'soundwave.02',area:'soundwave.01',aura:'soundwave.02'},{nativeArea:true,symbolic:true}),
 // Native material footage remains usable without adding generic caster rings
 // or target impacts. The shared stage factory retains the actual footprint.
 ...Object.fromEntries(['fire','cold','acid','water','wind','earth','light','shadow','sonic'].map(theme=>[
  `materialArea-${theme}`,cue(`${theme} fills the native spell area`,'materialArea',{}, {nativeArea:true,castingOnly:false,materialTheme:theme})
 ])),
 materialMist:cue('A cloud of mist fills the native area','materialArea',{area:'fog_cloud,smoke'},{nativeArea:true,symbolic:true}),
 materialSand:cue('Sand or dust fills the native area','materialArea',{area:'particles.outward',aura:'particles.outward'},{nativeArea:true,symbolic:true}),
 materialIceRain:cue('Icy rain fills the native area','materialArea',{area:'sleet_storm,ice_storm'},{nativeArea:true}),
 materialStatic:cue('Static sparks fill the native area','materialArea',{area:'static_electricity'} ,{nativeArea:true}),
 materialInwardAir:cue('Air is drawn inward','inwardAirArea',{area:'wind_lines'},{nativeArea:true,symbolic:true}),
};

// Native fields and damage traits alone do not establish visible material:
// Zombie Horde is not a rocky earthquake, and quiet air is not a whirlwind.
export function describedMaterialArea(opening,direction){
 // Directional footage needs a reviewed material match. A radial particle
 // cloud cannot be replaced with an unrelated cone simply to keep its shape.
 if(direction.kind==='ritual'||!['burst','emanation','cone'].includes(direction.delivery))return null;
 const lead=opening.split(/(?<=[.!?])\s+/).slice(0,2).join(' ');
 if(direction.delivery==='cone'){
  const material={
   fire:/\b(?:gout of flame|flame.*spray|blast of plasma)\b/i,
   cold:/\b(?:icy shards|icy cold|freezing winds|cone of.*cold)\b/i,
   acid:/\b(?:spray of acid|acid.*spray)\b/i,
   water:/\b(?:cascade of water|blast of water|spray of water)\b/i,
  };
  return material[direction.theme]?.test(lead)?`materialArea-${direction.theme}`:null;
 }
 if(/\b(?:fog|mist)\b|cloud of (?:gray soil|dust|toxic mold|mold spores)/i.test(lead))return 'materialMist';
 if(/\b(?:sandstorm|dust storm|cloud of dust|desiccating grit and sand|churning area|shifting sand)\b/i.test(lead))return 'materialSand';
 if(/\b(?:hail|sleet|cold rain|snowdrifts|icy deluge)\b/i.test(lead))return 'materialIceRain';
 if(/\b(?:inhale all air|draw the air|hoarding it|stealing the breath)\b/i.test(lead))return 'materialInwardAir';
 if(/\b(?:electrostatic sparks|static electricity|discharged.*sparks)\b/i.test(lead))return 'materialStatic';
 const tests={
  fire:/\b(?:gout of flame|flame.*spray|protective flames|blast of plasma|wave of.*destruction)\b/i,
  cold:/\b(?:icy shards|icy cold|freezing winds|cone of.*cold)\b/i,
  acid:/\b(?:shell of acid|acid.*bursts? outward)\b/i,
  water:/\b(?:crashing wave|mighty wave|towering waves|cascade of water|area of water)\b/i,
  wind:/\b(?:blast of wind|burst of wind|wind flows|gusting winds|blast of air|displaced air)\b/i,
  earth:/\b(?:energy.*ripples through the earth|earth.*destabiliz|cauldron of earth|surface to heave|churning ground)\b/i,
  light:/\b(?:flash of light|explosion of bright light|area of bright light|fills the area with bright light)\b/i,
  shadow:/\b(?:field of darkness|consuming shadow|shadows pour forth)\b/i,
  sonic:/\b(?:voice booms|mighty cry|screech|wave of sonic vibrations)\b/i,
 };
 return tests[direction.theme]?.test(lead)?`materialArea-${direction.theme}`:null;
}
export const SPECIFIC_FALLBACK_DESIGNS={
 'antlion-trap':['antlionPit',''],
 'countless-eyes':['bodyEyes','Eyes appear across the touched body. No damaging impact or caster rune.'],
 'enhance-senses':['senseEyes','Sight and other senses improve. Eye footage is a perception cue, not an attack.'],
 containment:['forceEnclosure','An immobile force enclosure forms around the creature. Save outcomes and field damage are not assumed.'],
 'binding-muzzle':['muzzleForce','A localized force weave closes at the mouth. Strand footage is a muzzle substitute; it does not bind the whole body.'],
 'delay-consequence':['delayedMoment','The triggering injury is deferred. A suspended distortion illustrates the delay; damage and recoil are not played now.'],
 contingency:['storedSpell','A spell is prepared for a future trigger. The companion spell is unknown and is not released during preparation.'],
 'ancestral-memories':['ancestralEcho','Ancestral knowledge aids the next spell. Translucent memories and insight illustrate preparation, without casting that later spell.'],
 'angelic-halo':['angelHalo','A halo and native emanation support later Heal spells. No healing burst is played at casting.'],
 alarm:['alarmWard','An alert ward is placed across the native area. The later intrusion, mental alert and bell are not played at casting.'],
 'anointed-ground':['groundAnoint','Oils sanctify a warded area. No immediate attack against the chosen creature type.'],
 'antimagic-field':['suppressionField','A suppression field occupies the native emanation. A ray mentioned as a rules example is not fired. The shell is symbolic suppression artwork.'],
 'arcane-countermeasure':['unravelSpell','Incoming spell energy weakens and disperses. No damage to its caster or invented spell projectile.'],
 nullify:['nullifyFeedback','Incoming spell energy is destroyed and feedback reaches the caster. The HP cost remains mechanical; no invented damaging projectile.'],
 'artistic-flourish':['artisticSurface','A localized surface shimmer suggests an aesthetic change to the object. The later weapon or tool bonus does not cause an attack.'],
 'bone-flense':['crimsonWeapon','The selected weapon glows crimson. Bone spurs and bleeding belong to a later damaging Strike and are not played on cast. Use the holder as a stand-in for the weapon.'],
 cackle:['laughRipple','A short mouth-level sound ripple illustrates laughter. Sustaining the existing spell does not recast its effects.'],
 bilocation:['twinBody','One adjacent translucent copy illustrates the second body. No real token is spawned or moved; the preview is finite.'],
 'clone-companion':['companionTwin','One adjacent copy of the targeted companion illustrates duplication. Later mirrored commands and Strikes are not executed.'],
 'adaptive-ablation':['adaptationWard','A neutral ward adapts after incoming damage. The triggering element is not guessed, and the triggering hit is not replayed.'],
 'destructive-aura':['sandField','Particles swirling across the native emanation stand in for divine sand. Resistance reduction is not a damaging impact.'],
 'distortion-lens':['lensField','A refractive lens is suspended in the placed area. Later projectile interactions and relocation on Sustain are not played now.'],
 'divine-aura':['divineWardField','Protection fills the native emanation. Later growth and retaliatory blindness are not pre-resolved.'],
 'champions-sacrifice':['sacrificeLink','An ally-to-caster strand transfers harm in the stated direction. Example Fireball damage is not a second attack.'],
 'kinetic-ram':['kineticRipple','A kinetic ripple and bounded cosmetic push illustrate the force. Selected action count, save outcome and actual displacement remain mechanical.'],
 begone:['forceDismiss','Mystic force pushes the target away. Cosmetic recoil is bounded and returns; save-dependent distance and collision damage are not assumed.'],
 'reinforce-eidolon':['eidolonWard','A bond connects caster and eidolon, then a defensive ward settles. No attack or immediate damage.'],
 'boost-eidolon':['eidolonPower','The bond conveys attack empowerment to the eidolon. The future unarmed Strike is not performed.'],
 sparkleskin:['glitterSkin','Glitter coats the body. The damaging wound and later glitter burst are not played at casting.'],
 'planar-tether':['planeStitch','Threads anchor the target locally to its plane. No teleport is performed or save outcome assumed.'],
 'peaceful-bubble':['peacefulShell','A shell and drifting runes cover the native area. Perception blocking is a rule, not a damaging impact.'],
 'celestial-brand':['celestialBrand','A blazing symbol marks the target for justice. Additional spirit damage belongs to later holy attacks; it is not played at casting.'],
 'roar-of-the-dragon':['dragonRoar','A draconic vocal ripple fills the native emanation. Respect and save-dependent fear remain mechanical; no dragon breath is fired.'],
};

export function specificFallbackLayers(spell,{fx,hit,aura,copy,pose,track,charge,subject,pattern}){
 if(!SPECIFIC_FALLBACK_MOTIFS[spell.design.motif])return null;
 const body=(slot,label,delay=0,extra={})=>fx(subject==='targets'?'impact':'cast',slot,label,delay,2800,{scale:1.15,fadeIn:350,fadeOut:500,...extra});
 const field=(slot,label,extra={})=>fx('template',slot,label,0,Math.max(3500,spell.design.mediaTiming?.[slot]?.duration??0),{scale:1,below:true,opacity:.9,fadeIn:400,fadeOut:550,...extra});
 switch(pattern){
  case 'bodyEyes':return [body('hit','Eyes form across the body',0,{scale:1.15}),body('aura','Eyes turn in every direction',400,{scale:.75,rotation:180,offsetY:-.2})];
  case 'senseEyes':return [body('hit','Vision sharpens',0,{scale:.6,offsetY:-.35}),body('aura','Senses settle',500,{scale:.7,offsetY:-.3})];
  case 'forceEnclosure':return [body('hit','Force enclosure forms',0,{scale:1.5,scaleIn:.1,scaleInDuration:1200}),body('aura','Immobile barrier',900,{scale:1.3,opacity:.65})];
  case 'muzzleForce':return [body('hit','Muzzle closes',0,{scale:.55,offsetY:-.12,tracks:[track('scale.x',1.3,.6,1600)]}),body('aura','Mouth force shimmer',550,{scale:.5,offsetY:-.12})];
  case 'delayedMoment':return [body('hit','Moment suspended',0,{scale:1.2,playbackRate:.6,tracks:[track('rotation',0,-40,2400)]}),copy('Held moment silhouette',200,3200,{copies:1,copySpread:0,opacity:.4,saturation:-.8}),body('aura','Injury remains deferred',650,{scale:1.1,playbackRate:.6})];
  case 'storedSpell':return [body('hit','Spell potential gathers',0,{scale:.8,scaleOut:.2,scaleOutDuration:2400}),body('aura','Future trigger sealed',800,{scale:.65,below:true})];
  case 'ancestralEcho':return [copy('Ancestral memory echoes',0,3300,{subject:'source',copies:2,copySpread:.6,opacity:.3,saturation:-.7}),body('hit','Knowledge recalled',500,{offsetY:-.35,scale:.6}),body('aura','Ancestral insight',1000,{offsetY:-.5,scale:.9})];
  case 'angelHalo':return [fx('cast','hit','Halo above caster',0,3500,{subject:'source',scale:.8,offsetY:-.5,tintEnabled:true,colorize:true,tint:'#ffe9ad'}),field('area','Halo healing emanation',{tintEnabled:true,colorize:true,tint:'#ffe9ad'})];
  case 'alarmWard':return [field('area','Alert boundary forms'),field('hit','Password ward settles',{scale:.65,opacity:.55,delay:700})];
  case 'groundAnoint':return [field('hit','Consecrating oil spreads',{opacity:.65}),field('area','Sanctified ground settles',{delay:500}),field('aura','Protective blessing',{scale:.65,delay:1000})];
  case 'suppressionField':return [field('area','Magic suppression boundary',{saturation:-1}),field('hit','Magic ebbs inside the field',{opacity:.45,saturation:-1,scaleOut:.25,scaleOutDuration:2500})];
  case 'unravelSpell':return [body('hit','Spell threads unravel',0,{scale:1.15,scaleOut:.2,scaleOutDuration:2400}),body('aura','Dispersing spell fragments',600,{opacity:.65})];
  case 'nullifyFeedback':return [body('hit','Incoming magic breaks',0,{scale:1.3,scaleOut:0,scaleOutDuration:1800}),fx('cast','aura','Feedback reaches caster',500,2800,{subject:'source',scale:1.15}),pose('shake','Feedback reaction',650,1800,'source',.05,.25)];
  case 'artisticSurface':return [body('hit','New surface finish',0,{maskToken:true,tracks:[track('position.y',-.4,.4,2200)]}),body('aura','Finishing detail glints',750,{scale:.85})];
  case 'crimsonWeapon':return [body('hit','Crimson weapon light',0,{scale:.7,offsetX:.25,tintEnabled:true,colorize:true,tint:'#b92035'}),body('aura','Weapon glow settles',650,{scale:.8,offsetX:.25,tintEnabled:true,colorize:true,tint:'#b92035',opacity:.65})];
  case 'laughRipple':return [fx('cast','hit','Laughter ripple',0,1800,{scale:.7,offsetY:-.1}),fx('cast','aura','Laughter fades',300,1800,{scale:.5,offsetY:-.15})];
  case 'twinBody':case 'companionTwin':return [copy('Adjacent duplicate appears',0,3500,{copies:1,copySpread:0,offsetX:1,opacity:.8}),body('hit','Duplicate arrival shimmer',0,{offsetX:1,scale:1}),body('aura','Shared existence',800,{scale:.7,offsetX:.5})];
  case 'adaptationWard':return [body('hit','Adaptive protection',0,{scale:1.3}),body('aura','Energy is absorbed inward',650,{scale:1.15,opacity:.7})];
  case 'sandField':return [field('area','Divine sand swirls',{tintEnabled:true,colorize:true,tint:'#cba66a',tracks:[track('rotation',0,120,3000)]}),field('aura','Sand crosses the defenses',{tintEnabled:true,colorize:true,tint:'#cba66a',rotation:180,delay:700})];
  case 'antlionPit':return [
   field('area','Sand basin',{duration:6000,tintEnabled:true,colorize:true,tint:'#ad8050',opacity:1,fadeIn:900,fadeOut:800}),
   field('aura','Circling sand',{duration:6000,delay:250,tintEnabled:true,colorize:true,tint:'#dec597',opacity:.8,playbackRate:.75,fadeIn:700,fadeOut:800}),
   field('hit','Sand draws inward',{duration:6000,delay:450,tintEnabled:true,colorize:true,tint:'#d9b77c',opacity:.95,playbackRate:.8,fadeIn:700,fadeOut:800}),
  ];
  case 'lensField':return [field('area','Suspended spatial lens',{below:false}),field('aura','Refractive surface',{below:false,scale:.8,opacity:.65,tracks:[track('scale.x',.75,1.2,2600,{loop:true,pingPong:true})]})];
  case 'divineWardField':return [field('area','Divine protective area'),field('hit','Defensive blessing',{scale:.65,delay:650})];
  case 'sacrificeLink':return [fx('impact','hit','Ally link gathers',0,2400,{scale:.85}),fx('travel','bolt','Harm transfers to caster',350,3200,{travelOrigin:'target',scale:.65}),fx('cast','aura','Caster receives the burden',1000,2400,{scale:1})];
  case 'kineticRipple':return [body('hit','Kinetic force gathers',0,{scale:1.2}),body('aura','Outward force ripple',250,{scale:1.4}),pose('recoil','Bounded force push',400,1800,'targets',.65,.4)];
  case 'forceDismiss':return [body('hit','Mystic force drives outward',0,{scale:1.1,tracks:[track('scale.x',.6,1.4,1800)]}),pose('recoil','Bounded dismissal',300,2000,'targets',.8,.4),body('aura','Displacement flecks',600,{scale:1.15})];
  case 'eidolonWard':case 'eidolonPower':return [fx('travel','bolt','Eidolon bond',0,3200,{scale:.5,opacity:.7}),body('hit',pattern==='eidolonWard'?'Eidolon defense':'Eidolon attack empowerment',500,{scale:1.2}),body('aura','Bond settles',1000,{scale:1.05})];
  case 'glitterSkin':return [body('hit','Glitter coats the body',0,{maskToken:true,scale:1.3}),body('aura','Glittering skin',700,{scale:.9})];
  case 'planeStitch':return [body('hit','Planar stitches gather',0,{scale:1.1}),...[-1,1].map(side=>body('aura','Local plane anchor',650,{offsetX:side*.4,offsetY:.35,scale:.45,below:true}))];
  case 'peacefulShell':return [field('area','Opaque peaceful shell',{below:false}),field('hit','Iridescent drifting runes',{below:false,scale:.8,opacity:.7,delay:650})];
  case 'celestialBrand':return [body('hit','Blazing justice mark',0,{scale:.75,tintEnabled:true,colorize:true,tint:'#ffe49b'}),body('aura','Brand light',550,{scale:.65,tintEnabled:true,colorize:true,tint:'#ffe49b'})];
  case 'dragonRoar':return [fx('cast','hit','Draconic voice',0,2800,{subject:'source',scale:.8,offsetY:-.15}),field('area','Roar fills the emanation',{below:false})];
  case 'materialArea':return [field('area','Native material spreads',{oneShot:spell.delivery==='cone',fadeIn:spell.delivery==='cone'?0:400,...(spell.design.motif==='materialSand'?{tintEnabled:true,colorize:true,tint:'#cba66a'}:{})})];
  case 'inwardAirArea':return [field('area','Air gathers inward',{tracks:[track('scale.x',1.4,.25,2400),track('scale.y',1.4,.25,2400)]})];
  default:return null;
 }
}
