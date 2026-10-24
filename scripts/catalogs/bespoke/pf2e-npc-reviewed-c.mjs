// Reviewed NPC action cues, shard C. These describe the use of the ability;
// Strike/spell payloads, conditions, item transfers and movement remain native.
import {aura,sprite,motion,tint,design} from './helpers.mjs';

const out={};
const put=(id,why,build)=>{out[`pf2e:npc-review-c-${id}`]=design(why,build,{sound:null});};
const pose=(kind='brace',o={})=>motion(kind,'source',{stageId:'gesture',duration:850,intensity:.18,...o});
// An art echo is deliberately neutral. In effects-only mode it preserves a
// physical preparation cue without falling back to an invented impact/spell.
const echo=(label='Prepared stance',o={})=>sprite(label,{subject:'source',stageId:'echo',duration:650,opacity:.13,scale:1.025,...o});
const glow=(label,assets,o={})=>aura(label,assets,{stageId:'cue',duration:1100,scale:.65,opacity:.5,...o});
const targetPose=(kind='stagger',o={})=>motion(kind,'targets',{after:'cue',anchor:'start',offset:150,duration:850,intensity:.17,...o});
const physical=(id,why,kind='brace',label='Deliberate gesture')=>put(id,why,()=>[pose(kind),echo(label)]);

physical('strike','The creature gathers itself for its stated native attacks. This card cue contains no contact or damage animation.','brace','Attack readied');
put('spell','The creature focuses on the stated spell or spell preparation; native spellcasting supplies the actual effect.',()=>[
  pose('brace'),glow('Spell focus gathers',['shimmer.01.blue','shimmer.01.purple'],{scale:.45,opacity:.3}),
]);
physical('guard','A practiced physical guard comes up; native AC and damage rules remain untouched.','brace','Guard raised');
put('ward','A defensive field briefly turns around the creature, signaling its stated resistance.',()=>[
  pose('brace'),glow('Protection gathers',['aura_themed.01.inward.complete.metal.01.grey'],{opacity:.35,...tint('#c6d6de')}),
]);
put('aid','A restrained supportive glimmer identifies the stated ally; it applies no bonus or recovery.',()=>[
  glow('Support offered',['shimmer.01.blue','shimmer.01.purple'],{subject:'targets',scale:.5,opacity:.35,...tint('#c9e0cf')}),
  targetPose('pulse',{intensity:.12}),
]);
physical('command','The speaker makes a deliberate directing gesture; allies execute their own native actions.','pulse','Order given');
physical('study','A steady observing pose marks examination without pretending it causes damage or reveals hidden information.','brace','Attention focuses');
put('disguise','A restrained silhouette marks the described disguise or concealment posture; native visibility is unchanged.',()=>[
  pose('brace'),echo('Outline shifts',{opacity:.17,scale:1.015}),
]);
physical('boost','The creature gathers itself as its stated speed or available resource becomes ready.','pulse','Ready to act');
put('imbue','Energy collects for the stated later empowered attack, leaving its actual Strike and damage separate.',()=>[
  pose('brace'),glow('Power readied',['energy_strands.complete.dark_red.01','shimmer.01.blue'],{scale:.55,opacity:.38,...tint('#bbc8d5')}),
]);
put('poison','A faint green preparation curl marks venom or reagents being readied; it creates no injury or equipment change.',()=>[
  pose('brace'),glow('Reagent prepared',['smoke.puff.side.green','smoke.puff.side.grey'],{scale:.35,opacity:.35,...tint('#9ab86d')}),
]);
put('grip','A contained tightening gesture marks the stated grasp or haul; the native check controls any movement.',()=>[
  glow('Grip tightens',['energy_strands.complete.dark_red.01','energy_strands.complete.blue.01'],{subject:'targets',scale:.55,opacity:.35,...tint('#b9ad8d')}),
  targetPose('press',{intensity:.18}),
]);
put('unbalance','A short weight shift marks the stated Feint, shove or trip attempt without deciding its success.',()=>[
  sprite('Balance tested',{subject:'targets',stageId:'cue',duration:700,opacity:.13,scale:1.025}),
  targetPose('stagger',{intensity:.17}),
]);
put('move','An afterimage marks the stated movement preparation while the native movement owns its route.',()=>[
  pose('brace'),echo('Movement readied',{opacity:.16}),
]);
put('dissolve','The silhouette briefly loosens as the body disperses or shifts planes; native form and location stay authoritative.',()=>[
  motion('flicker','source',{stageId:'gesture',duration:1000,intensity:.22}),echo('Body disperses',{duration:1000,opacity:.2}),
]);
physical('consume','A contained inward gesture marks the stated consumption, collection or absorption.','pulse','Material gathered');
physical('gather','The creature makes a restrained handling gesture as the stated item or material is collected.','brace','Object handled');
put('earth','A small dust puff marks the stated earthwork without creating a pit, barrier or terrain rule.',()=>[
  pose('brace'),glow('Earth disturbed',['smoke.puff.side.grey'],{scale:.45,opacity:.4,below:true,...tint('#baa587')}),
]);
put('recover','A soft return of light marks the stated repair, cleansing or recovery; native health remains unchanged.',()=>[
  pose('pulse'),glow('Recovery gathers',['shimmer.01.blue','shimmer.01.purple'],{scale:.55,opacity:.3,...tint('#b9d5c1')}),
]);
put('luck','A small turning shimmer marks a second chance or improved result without rolling any dice.',()=>[
  echo('Second chance',{rotation:8,opacity:.17}),pose('pulse',{intensity:.1}),
]);
put('targetluck','A small art glint marks the ally receiving a second chance; the actual reroll remains native.',()=>[
  sprite('Second chance offered',{subject:'targets',stageId:'cue',duration:750,opacity:.17,scale:1.03}),
  targetPose('pulse',{intensity:.1}),
]);
physical('reveal','The creature makes the stated revealing gesture; native disguise and observation determine who recognizes it.','pulse','Disguise revealed');
put('mark','A restrained target outline marks the creature singled out by the native challenge or observation.',()=>[
  sprite('Chosen focus',{subject:'targets',stageId:'cue',duration:1050,opacity:.2,scale:1.04}),
]);
put('rebound','A short ward turns outward to signal the stated redirection, leaving native target selection intact.',()=>[
  pose('brace'),glow('Effect turned aside',['aura_themed.01.inward.complete.metal.01.grey'],{mirrorX:true,scale:.65,opacity:.38,...tint('#c4d4de')}),
]);
physical('escape','The creature makes a contained escape gesture; the check and native movement decide whether it gets free.','shake','Grip contested');
put('shape','A short squash and art echo signal the stated physical reshaping; no lasting native form is changed.',()=>[
  motion('squash','source',{stageId:'gesture',duration:800,intensity:.18}),echo('Form shifts',{duration:850,opacity:.18}),
]);
put('drink','A small pale liquid curl marks the stated drink without applying intoxication or recovery.',()=>[
  pose('brace'),glow('Drink taken',['liquid.splash.blue'],{scale:.25,opacity:.3,...tint('#c2a478')}),
]);
put('drench','A small pale liquid splash identifies the creature receiving the forced drink or contact.',()=>[
  glow('Liquid contact',['liquid.splash.blue'],{subject:'targets',scale:.35,opacity:.4,...tint('#c2b68f')}),
]);
put('soul','An inward blue strand marks the stated collection of soul energy without creating an item or possessing a target.',()=>[
  pose('pulse'),glow('Essence gathered',['energy_strands.complete.dark_red.01','energy_strands.complete.blue.01'],{scale:.6,opacity:.45,...tint('#99bddf')}),
]);
put('darktarget','A dim gray-violet shimmer marks the stated obscuring influence; lasting perception and conditions remain native.',()=>[
  glow('Shadow settles',['shimmer.01.purple','shimmer.01.blue'],{subject:'targets',scale:.6,opacity:.4,...tint('#736b88')}),
]);
put('light','A brief pale glimmer announces the stated light flash rather than applying a blindness result.',()=>[
  glow('Light flashes',['shimmer.01.blue','shimmer.01.purple'],{scale:1.05,opacity:.7,...tint('#fff0bc')}),
]);
put('lighttarget','A brief pale glimmer identifies the stated directed light effect, leaving its saving throw native.',()=>[
  glow('Light focuses',['shimmer.01.blue','shimmer.01.purple'],{subject:'targets',scale:.6,opacity:.6,...tint('#fff0bc')}),
]);
put('confuse','A short unsettled gesture marks the described disorientation without adding a lasting condition.',()=>[
  sprite('Poise unsettled',{subject:'targets',stageId:'cue',duration:850,opacity:.17,scale:1.025}),targetPose('stagger'),
]);
put('blood','A contained dark red strand marks the stated blood preparation without showing an invented second wound.',()=>[
  pose('brace'),glow('Blood power readied',['energy_strands.complete.dark_red.01','energy_strands.complete.blue.01'],{scale:.5,opacity:.4,...tint('#a53d51')}),
]);
put('bloodtarget','A contained dark-red strand marks the directed blood magic; the native spell attack determines harm.',()=>[
  glow('Blood magic gathers',['energy_strands.complete.dark_red.01','energy_strands.complete.blue.01'],{subject:'targets',scale:.5,opacity:.4,...tint('#a53d51')}),
]);
physical('tendril','The creature extends or readies its stated limb or weapon without moving a target.','pulse','Reach readied');
put('fumes','A small low haze marks the stated emission or suppression of foul air; no area or condition is applied.',()=>[
  glow('Air stirs',['smoke.puff.side.grey'],{scale:.55,opacity:.3,...tint('#a0a579')}),
]);
put('flood','A local liquid ripple announces the stated water manipulation while the actual terrain remains native.',()=>[
  pose('pulse'),glow('Water gathers',['liquid.splash.blue'],{scale:.8,opacity:.4,below:true}),
]);
put('bind','A short strand identifies the stated binding or holding attempt without making any forced move.',()=>[
  glow('Binding readied',['energy_strands.complete.dark_red.01','energy_strands.complete.blue.01'],{subject:'targets',scale:.55,opacity:.4,...tint('#bbc29e')}),targetPose('press',{intensity:.15}),
]);
put('summon','A contained emergence puff marks the stated summon or release; native play places the new creature.',()=>[
  pose('brace'),glow('Arrival readied',['smoke.puff.side.grey'],{scale:.65,opacity:.45,...tint('#aab6bc')}),
]);
physical('focus','The creature pauses and gathers its attention for the stated skill or mental preparation.','brace','Attention steadies');
put('spores','A small earthy cloud announces the stated fungal emergence, without applying disease or a new area.',()=>[
  pose('pulse'),glow('Spores stir',['smoke.puff.side.green','smoke.puff.side.grey'],{scale:.65,opacity:.4,...tint('#b8ae7b')}),
]);
put('fade','A faint silhouette signals the stated dissipation without changing native visibility or deleting the token.',()=>[
  echo('Dissipation',{duration:800,opacity:.16}),motion('flicker','source',{duration:800,intensity:.16}),
]);
put('collapse','A restrained folding gesture marks the stated feigned fall or protective curl; native conditions still control the creature.',()=>[
  motion('squash','source',{duration:900,intensity:.25}),echo('Body folds',{duration:900,opacity:.15}),
]);
physical('hands','A restrained equipment-handling gesture marks the stated item manipulation without changing inventory.','brace','Equipment handled');
put('spellblood','A contained red strand marks blood-powered spell preparation; native spellcasting supplies the spell itself.',()=>[
  pose('brace'),glow('Blood fuels spellcraft',['energy_strands.complete.dark_red.01','energy_strands.complete.blue.01'],{scale:.5,opacity:.4,...tint('#a53d51')}),
]);
put('rune','A restrained blue shimmer marks the stated magical construction or activation without creating a world object.',()=>[
  pose('pulse'),glow('Power takes shape',['shimmer.01.blue','shimmer.01.purple'],{scale:.6,opacity:.38}),
]);
put('enfeeble','A contained downward gesture marks the described weakening or compulsory pause, without deciding the save.',()=>[
  sprite('Strength checked',{subject:'targets',stageId:'cue',duration:900,opacity:.17}),targetPose('press',{intensity:.15}),
]);
put('sweep','A short physical sweep marks the described area maneuver; native rolls determine who is affected.',()=>[
  pose('spin',{duration:1400,intensity:.12}),echo('Area maneuver',{duration:1000,opacity:.15}),
]);
put('heat','A warm local shimmer marks the stated heat emission without fabricating a damage result.',()=>[
  pose('pulse'),glow('Heat gathers',['shimmer.01.blue','shimmer.01.purple'],{scale:.8,opacity:.35,...tint('#eab982')}),
]);
put('sow','Small dusty motes mark the stated release of organic material without placing another creature.',()=>[
  pose('brace'),glow('Material released',['smoke.puff.side.grey'],{scale:.45,opacity:.35,...tint('#b9ac88')}),
]);
put('acidtarget','A small green liquid splash marks the stated caustic contact without applying its damage or equipment effects.',()=>[
  glow('Caustic contact',['liquid.splash.bright_green','liquid.splash.blue'],{subject:'targets',scale:.5,opacity:.5,...tint('#abc56f')}),
]);
put('psychic','A contained violet shimmer expands from the creature to signal the stated psychic backlash; native saves and damage remain separate.',()=>[
  pose('pulse'),glow('Psychic echo',['shimmer.01.purple','shimmer.01.blue'],{scale:1.2,opacity:.4,...tint('#bca3d6')}),
]);
put('fury','A brief dark-red gathering marks the described rage without repeating its weapon attacks or applying combat bonuses.',()=>[
  pose('brace'),glow('Rage gathers',['energy_strands.complete.dark_red.01','energy_strands.complete.blue.01'],{scale:.65,opacity:.4,...tint('#a53d51')}),
]);
put('mist','A local curl of mist announces the stated Dragonmist release, without inventing another spell or placing its area.',()=>[
  pose('pulse'),glow('Mist releases',['smoke.puff.side.grey'],{scale:.9,opacity:.4,...tint('#c4d1da')}),
]);
put('heave','A contained bracing gesture and water splash mark an attempt to overturn a vessel; the native Athletics check decides movement.',()=>[
  pose('brace'),glow('Water churns',['liquid.splash.blue'],{scale:.65,opacity:.4,below:true}),
]);
put('paint','Bright painted droplets mark a thrown egg filled with paint and glitter, rather than a damaging blast.',()=>[
  glow('Paint splashes',['liquid.splash.blue'],{subject:'targets',scale:.4,opacity:.55,...tint('#dfa9df')}),
  sprite('Glitter catches the light',{subject:'targets',duration:800,opacity:.14,scale:1.025}),
]);
put('vocal','A focused scream and a brief unsettled gesture identify the chosen listener; native saves determine any lost actions.',()=>[
  glow('Focused scream',['soundwave.02.blue','soundwave.01.blue'],{subject:'source',scale:.7,opacity:.4}),
  targetPose('shake',{intensity:.16}),
]);
put('time','A short flickering silhouette marks the stated temporal displacement while the native save and effect control its outcome.',()=>[
  sprite('Moment slips',{subject:'targets',stageId:'cue',duration:1000,opacity:.18,scale:1.035,rotation:5}),
  motion('flicker','targets',{after:'cue',anchor:'start',duration:1000,intensity:.18}),
]);
export default out;
