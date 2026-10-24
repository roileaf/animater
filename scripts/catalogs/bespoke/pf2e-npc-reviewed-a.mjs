// Short cues for individually reviewed native NPC actions. No document writes,
// forced paths, fake summoned creatures, or automatic success/failure imagery.
// Attack/spell preparation leaves the delivered action to its native event.
import {aura,cast,sprite,motion,tint,design} from './helpers.mjs';

const out={};
const put=(name,rationale,build)=>{out[`pf2e:npc-review-a-${name}`]=design(rationale,build,{sound:null});};
const brace=(label='Readied posture',extra={})=>motion('brace','source',{stageId:'prepare',label,duration:800,intensity:0.18,...extra});
// Token-art echoes keep non-magical preparation visible with token motion off.
const echo=(label,color='#ded9d1',extra={})=>sprite(label,{duration:700,opacity:0.16,...tint(color),...extra});
const shimmer=(label,color='#b7cddd',extra={})=>aura(label,['shimmer.01.blue','shimmer.01.purple'],{stageId:'signal',duration:1100,scale:0.65,opacity:0.4,...tint(color),...extra});
const dust=(label,color='#b9aa94',extra={})=>aura(label,['smoke.puff.ring.01.white','smoke.puff.side.grey'],{stageId:'signal',duration:950,scale:0.6,opacity:0.45,below:true,...tint(color),...extra});
const wave=(label,color='#cbd8e0',extra={})=>aura(label,['soundwave.02.blue','soundwave.01.blue'],{stageId:'signal',duration:1100,scale:1,opacity:0.45,...tint(color),...extra});

put('weapon-ready','Weapon or unarmed attack preparation only; actual hits retain the native Strike animation.',()=>[
  brace('Attack readied'),echo('Weapon or limb readied','#e4ded3',{after:'prepare',anchor:'start',offset:100}),
]);
put('spell-ready','A spell or spell modification is readied, without playing its delivered payload twice.',()=>[
  brace('Spell prepared'),shimmer('Spell energy readied','#b9c7e8',{after:'prepare',anchor:'start',offset:100}),
]);
put('absorb','Incoming magic is drawn in or countered; no attack result is asserted.',()=>[
  aura('Incoming energy gathers',['aura_themed.01.inward.complete.metal.01.grey'],{stageId:'signal',duration:1400,scale:0.75,opacity:0.4,...tint('#b8c1e0')}),
  motion('pulse','source',{after:'signal',anchor:'start',offset:200,duration:900,intensity:0.14}),
]);
put('resolve','The creature steadies itself in response to adversity, without changing any condition.',()=>[
  brace('Composure recovered'),echo('Resolve returns','#e7d9b3',{after:'prepare',anchor:'start',offset:100}),
]);
put('focus','The creature focuses its senses or studies a weakness without revealing the target.',()=>[
  brace('Attention focuses'),echo('A measured appraisal','#abcbd8',{after:'prepare',anchor:'start',offset:100}),
]);
put('move','Readiness for native movement, without an invented path or distance.',()=>[
  aura('Movement gathers',['wind_lines.01.01.white'],{stageId:'signal',duration:800,scale:0.7,opacity:0.25}),
  echo('A quick shift of weight','#d7e0e0'),
]);
put('guard','A physical defensive posture or interposition, not a magical shield or an extra attack.',()=>[
  brace('Guard raised'),echo('Body or equipment interposes','#cbd2d3',{after:'prepare',anchor:'start',offset:120}),
]);
put('ward','A short protective ward or magical redirection without choosing the result.',()=>[
  aura('Protective ward',['shield.01.complete.01.white','shield.01.complete.01.blue'],{stageId:'signal',duration:1300,scale:0.65,opacity:0.5}),
  brace('Protection gathers'),
]);
put('ward-target','A selected ally receives a brief protective or supportive visual; native rules retain its benefit.',()=>[
  aura('Allied protection',['shield.01.complete.01.white','shield.01.complete.01.blue'],{subject:'targets',stageId:'signal',duration:1300,scale:0.65,opacity:0.45}),
]);
put('luck','A brief favorable glint accompanies a reroll without changing the die.',()=>[
  shimmer('Fortune turns','#e5cb83',{duration:1000,scale:0.55,opacity:0.35}),
]);
put('change','A brief transition marks reconfigured body or equipment without altering documents.',()=>[
  shimmer('Shape shifts','#c4c5d8'),echo('The old outline fades','#d8d4db',{delay:150,duration:800,opacity:0.2}),
]);
put('veil','A disguise or concealment transition leaves native visibility authoritative.',()=>[
  echo('Outline blends','#b8c3c2',{stageId:'outline',duration:1100,opacity:0.2}),
  shimmer('Surface blends','#9baaa7',{after:'outline',anchor:'start',offset:150,scale:0.7,opacity:0.24}),
]);
put('earth','A small earth or root disturbance signals the action, without terrain changes.',()=>[
  dust('Earth stirs'),brace('Grounded posture'),
]);
put('water','A short local splash signals waterborne movement, not an imposed swim path.',()=>[
  aura('Water disturbed',['liquid.splash.blue','smoke.puff.ring.01.white'],{stageId:'signal',duration:1000,scale:0.65,opacity:0.45,below:true,...tint('#a7cddd')}),
]);
put('command','A local visible call signals coordination, warning or rhetoric without imposing an outcome.',()=>[
  wave('Call carries','#d7c995',{scale:0.9}),brace('Communication gesture'),
]);
put('charge','Power gathers or is replenished without firing an attack or modifying a resource.',()=>[
  shimmer('Power readied','#c3d0dc'),motion('pulse','source',{after:'signal',anchor:'start',duration:850,intensity:0.15}),
]);
put('fire-charge','Heat gathers on the creature or held item before a native action delivers it.',()=>[
  cast('Heat gathers',['cast_generic.fire.01.orange'],{stageId:'signal',duration:900,scale:0.4,opacity:0.55}),
  brace('Heat readied'),
]);
put('poison-charge','A short toxin-preparation cue without adding poison to a document.',()=>[
  aura('Venom prepared',['smoke.puff.side.green','smoke.puff.side.grey'],{stageId:'signal',duration:950,scale:0.45,opacity:0.35,...tint('#91ad69')}),
  echo('Coating handled','#b6bf9a'),
]);
put('poison-control','A toxic influence redirects the recipient native attack without adding a source attack.',()=>[
  shimmer('Toxic influence','#a4b574',{subject:'targets',duration:1100,scale:0.5,opacity:0.3}),
]);
put('heal','A soft restorative cue marks temporary vitality or recovery without changing hit points.',()=>[
  shimmer('Vitality returns','#b6d69a',{duration:1250,opacity:0.42}),
  motion('pulse','source',{after:'signal',anchor:'start',offset:150,duration:1000,intensity:0.14}),
]);
put('stance','A settled bodily stance or readied weapon without an added hit or spell.',()=>[
  brace('Stance settles'),echo('Readied outline','#c5c8c4',{duration:950,opacity:0.17}),
]);
put('equipment','A small handling or crafting gesture; no item is created, transferred or destroyed.',()=>[
  brace('Equipment handled'),echo('A deft adjustment','#c8c0a8',{after:'prepare',anchor:'start',offset:200}),
]);
put('grip','A restrained-looking cosmetic grip marks the attempt, not a successful grapple.',()=>[
  aura('Grip tightens',['aura_themed.01.inward.complete.metal.01.grey'],{subject:'targets',stageId:'signal',duration:1250,scale:0.6,opacity:0.32,...tint('#c6c1b3')}),
]);
put('pull','An inward pressure marks a pulling attempt without forced token movement.',()=>[
  dust('Inward pressure','#c5c3ba',{subject:'targets',scale:0.55,opacity:0.3}),
  motion('press','targets',{after:'signal',anchor:'start',duration:850,intensity:0.12}),
]);
put('shove','Brief pressure and dust mark a maneuver attempt without imposing prone or displacement.',()=>[
  dust('Balance challenged','#b9b5a9',{subject:'targets',scale:0.55,opacity:0.3}),
]);
put('soul','A brief unsettling spiritual tug without trapping a soul or applying a condition.',()=>[
  shimmer('Spirit disturbed','#b1a4ca',{subject:'targets',duration:1350,scale:0.65,opacity:0.4}),
]);
put('blood','Blood-colored threads signal a drain without a fabricated bite or extra attack.',()=>[
  aura('Vitality drawn',['energy_strands.complete.dark_red.01','energy_strands.complete.blue.01'],{subject:'targets',stageId:'signal',duration:1400,scale:0.55,opacity:0.4,...tint('#a24343')}),
]);
put('debilitate','A subtle follow-through cue; native saves decide lasting debilitation.',()=>[
  echo('Debilitating follow-through','#a8b1b4',{subject:'targets',stageId:'signal',duration:950,opacity:0.16}),
  motion('shake','targets',{after:'signal',anchor:'start',duration:800,intensity:0.1}),
]);
put('cloud','A brief dispersal cloud without changing concealment, damage or token shape.',()=>[
  aura('Form disperses',['smoke.puff.centered.grey','smoke.puff.side.grey'],{stageId:'signal',duration:1400,scale:0.8,opacity:0.45}),
]);
put('summon','An arrival signal only; native mechanics create any reinforcements.',()=>[
  dust('An arrival is called','#b4adc3',{scale:1.1,duration:1250}),
  shimmer('The call gathers','#b8b3cc',{stageId:'arrival',scale:0.65,opacity:0.25}),
]);
put('phantom','A ghostly overlap signals separation, phasing or a reflected body without relocating it.',()=>[
  echo('A second outline','#c2cadb',{stageId:'outline',duration:1300,opacity:0.25}),
  shimmer('Outline becomes insubstantial','#b5becf',{after:'outline',anchor:'start',offset:150,opacity:0.28}),
]);
put('trap','A low physical placement cue without creating a false trap or hazard.',()=>[
  brace('Trap prepared'),dust('Careful placement','#b8ab8d',{after:'prepare',anchor:'start',offset:250,scale:0.35,opacity:0.2}),
]);
put('container','A short close-handling cue signals containment or transfer without moving another document.',()=>[
  brace('Containment handled'),echo('A close transfer','#c2b9ab',{duration:850,opacity:0.17}),
]);
put('spores','A small organic release cue; native rules determine exposure and sickness.',()=>[
  aura('Organic cloud released',['smoke.puff.side.green','smoke.puff.side.grey'],{stageId:'signal',duration:1350,scale:0.75,opacity:0.4,...tint('#9ea96e')}),
]);
put('tremor','A heavy local landing pulse without invented fissures or persistent terrain changes.',()=>[
  dust('Landing disturbance','#b8b1a2',{scale:1.35,duration:1400,opacity:0.5}),
  motion('slam','source',{after:'signal',anchor:'start',duration:1000,intensity:0.2}),
]);
put('water-target','A current or buoyancy cue on a chosen subject; native rules retain actual movement.',()=>[
  aura('Current disturbed',['liquid.splash.blue','smoke.puff.ring.01.white'],{subject:'targets',stageId:'signal',duration:1200,scale:0.7,opacity:0.35,below:true,...tint('#9dbfce')}),
]);
put('signal','A non-damaging bright signal, not an arrow attack at a creature.',()=>[
  wave('Signal rises','#eddb9b',{scale:1.3,opacity:0.5,duration:1300}),
]);
put('weather','A localized wind and cloud preparation cue, not a full-scene weather replacement.',()=>[
  aura('Wind gathers',['wind_lines.01.01.white'],{stageId:'signal',duration:1400,scale:1.1,opacity:0.35}),
  dust('Clouds stir','#b4bec4',{stageId:'cloud',delay:150,duration:1300,scale:0.85,opacity:0.22}),
]);
put('disrupt','A small discordant wave signals an interruption attempt without canceling any action.',()=>[
  wave('Discordant interruption','#bfb1cc',{scale:0.8,opacity:0.38}),
]);
put('disturb','A brief flutter around a target without damage or an imposed condition.',()=>[
  aura('Distracting flutter',['wind_lines.01.01.white'],{subject:'targets',stageId:'signal',duration:1050,scale:0.5,opacity:0.3}),
]);
put('infection','A small sickly contact cue without deciding whether disease takes hold.',()=>[
  shimmer('Exposure marked','#b6bd86',{subject:'targets',duration:1000,scale:0.45,opacity:0.28}),
]);
put('shock','An electric release at the selected target without an extra Strike or applied damage.',()=>[
  aura('Charge released',['static_electricity.01.blue'],{subject:'targets',stageId:'signal',duration:1300,scale:0.6,opacity:0.65}),
]);
put('nature','Natural power supports concentration without casting the sustained spell again.',()=>[
  shimmer('Natural concentration','#a9bd86',{duration:1100,scale:0.65,opacity:0.35}),
]);
put('pulse','A visible outward force pulse without moving its recipients.',()=>[
  wave('Force presses outward','#c8d5e1',{duration:1300,scale:1.3,opacity:0.4}),
]);
put('menace','A short threatening presence signals a displayed trophy without deciding fear saves.',()=>[
  wave('Threatening display','#a98685',{duration:1200,scale:1.15,opacity:0.3}),
]);
put('fluid','A short blood splash indicates the special exposure, not a separate attack.',()=>[
  aura('Blood exposure',['liquid.splash02.red','liquid.splash.red'],{subject:'targets',stageId:'signal',duration:1200,scale:0.5,opacity:0.55}),
]);
put('breath-ready','Readies a recharged breath; its own placed area delivers the full exhalation.',()=>[
  brace('Breath readied'),echo('The creature inhales','#cfd5d3',{after:'prepare',anchor:'start',offset:100,duration:800,opacity:0.17}),
]);

export default out;
