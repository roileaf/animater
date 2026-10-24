// Reviewed NPC activation cues. Actual checks, Strikes, spells, movement and
// conditions remain native; these finite layers never write world documents.
import {aura,cast,sprite,motion,tint,design}from'./helpers.mjs';
const out={};
const put=(id,why,build)=>out[`pf2e:npc-review-b-${id}`]=design(why,build,{sound:null});
const echo=(label,subject='source',o={})=>sprite(label,{subject,stageId:'echo',duration:850,opacity:.17,offsetY:-.025,...o});
const brace=(label='Gather posture',o={})=>motion('brace','source',{stageId:'ready',label,duration:800,intensity:.24,...o});
const puff=(label,subject='source',o={})=>aura(label,['smoke.puff.centered.grey','smoke.puff.side.grey'],{subject,stageId:'puff',duration:1100,scale:.55,opacity:.32,...o});
const shimmer=(label,subject='source',o={})=>aura(label,['shimmer.01.blue','shimmer.01.purple'],{subject,stageId:'glimmer',duration:1250,scale:.65,opacity:.32,...o});
const ring=(label,subject='source',o={})=>aura(label,['soundwave.02.blue','soundwave.01.blue'],{subject,stageId:'ring',duration:1200,scale:1,opacity:.32,...tint('#d6dce1'),...o});
const metal=(label,subject='source',o={})=>aura(label,['aura_themed.01.inward.complete.metal.01.grey'],{subject,stageId:'metal',duration:1300,scale:.65,opacity:.42,...o});
const water=(label,o={})=>aura(label,['liquid.splash.blue'],{stageId:'water',duration:1050,scale:.5,opacity:.35,...o});
const strands=(label,subject='targets',o={})=>aura(label,['energy_strands.complete.dark_red.01','energy_strands.complete.blue.01'],{subject,stageId:'strands',duration:1400,scale:.6,opacity:.4,...tint('#c5c4b7'),...o});

put('attack-ready','A short physical preparation precedes the real native Strike; no duplicate hit is drawn.',({recipe})=>[
  brace(`${recipe.name}: prepare attack`,{duration:900,intensity:.29}),
  echo('Attack preparation echo','source',{after:'ready',anchor:'start',offset:150,offsetX:.035}),
]);
put('spell-ready','A restrained gathering of power precedes the selected native spell; no spell payload is fabricated.',()=>[
  shimmer('Spell preparation','source',{duration:1100,scale:.5,opacity:.3}),
  motion('pulse','source',{after:'glimmer',anchor:'start',offset:150,duration:800,intensity:.15}),
]);
put('body-adjust','The creature rearranges its body; a brief own-art transition leaves size and statistics native.',()=>[
  echo('Body changes','source',{duration:1300,opacity:.24,scaleIn:.9,scaleInDuration:300,scaleOut:1.06,scaleOutDuration:350}),
  puff('Matter shifts','source',{after:'echo',anchor:'start',offset:300,scale:.55,opacity:.25}),
  motion('pulse','source',{after:'echo',anchor:'start',duration:1100,intensity:.2}),
]);
put('blood-transfer','Blood or vital fluid gathers at the recipient; no damage, healing or affliction is applied.',()=>[
  aura('Blood gathers',['liquid.splash.red','liquid.splash02.red'],{stageId:'blood',duration:900,scale:.3,opacity:.35}),
  aura('Blood contact',['liquid.splash.red','liquid.splash02.red'],{subject:'targets',after:'blood',anchor:'start',offset:250,duration:1100,scale:.45,opacity:.4}),
  echo('Vital-fluid contact','targets',{after:'blood',anchor:'start',offset:350,...tint('#9e3348')}),
]);
put('blood-surge','A brief crimson surge marks blood feeding the creature’s own vigor.',()=>[
  aura('Blood surges',['energy_strands.complete.dark_red.01','energy_strands.complete.blue.01'],{stageId:'blood',duration:1300,scale:.65,opacity:.45,...tint('#a23d50')}),
  motion('pulse','source',{after:'blood',anchor:'start',duration:900,intensity:.22}),
]);
put('materialize','A small emergence cue marks matter or another creature appearing; nothing is summoned by this animation.',()=>[
  puff('Matter gathers','source',{stageId:'gather',duration:1300,opacity:.35}),
  echo('Emergence','source',{after:'gather',anchor:'start',offset:250,duration:1100,opacity:.28,scaleIn:.85,scaleInDuration:400}),
]);
put('weapon-charge','Neutral energy or metallic light marks preparing armament, without performing an attack.',()=>[
  metal('Armament readied'),
  brace('Set the prepared weapon',{after:'metal',anchor:'start',offset:200}),
]);
put('mobility-ready','An airy body trace marks a native movement activity, without changing the path or position.',()=>[
  aura('Motion readied',['wind_lines.01.01.white'],{stageId:'wind',duration:1050,scale:.85,opacity:.35}),
  echo('Agile movement','source',{after:'wind',anchor:'start',offset:100,offsetX:.05}),
]);
put('water-mobility','A watery wake marks aquatic movement, without moving the document or adding a jaws attack.',()=>[
  water('Water parts'),
  echo('Aquatic motion','source',{after:'water',anchor:'start',offset:100,offsetX:.06,opacity:.16}),
]);
put('physical-guard','The creature braces or turns aside; its own art supplies a nonmagical defensive cue.',()=>[
  brace('Brace against the blow',{intensity:.35}),
  echo('Defensive posture','source',{after:'ready',anchor:'start',offset:120,offsetX:.035,opacity:.2}),
]);
put('handle-equipment','A short handling gesture marks an item interaction; inventory remains unchanged.',({recipe})=>[
  brace(`${recipe.name}: handle equipment`),
  echo('Hands at work','source',{after:'ready',anchor:'start',offset:200,offsetY:.025}),
]);
put('ward-self','A short ward marks magical protection while native rules determine the prevented harm.',()=>[
  aura('Protective ward',['shield.01.complete.01.white','shield.01.complete.01.blue'],{stageId:'ward',duration:1400,scale:.85,opacity:.4}),
  brace('Hold against harm',{after:'ward',anchor:'start',offset:100,intensity:.18}),
]);
put('focus','A restrained own-art glint marks observation, resolve or internal concentration without inventing magic.',()=>[
  brace('Concentrate',{intensity:.15}),
  echo('Focused attention','source',{after:'ready',anchor:'start',offset:150,duration:1000,opacity:.16,...tint('#fff0c7')}),
]);
put('stance','A settling body pose marks a stance change; no attack, status or lasting layer is added.',()=>[
  brace('Set stance',{duration:1100,intensity:.3}),
  echo('Stance settles','source',{after:'ready',anchor:'start',offset:250,duration:1000,opacity:.16,offsetY:.035}),
]);
put('tether','A pale binding outline marks grasping, tethering or restraining; native actions decide movement and Escape.',()=>[
  strands('Binding contact'),
  echo('Held outline','targets',{after:'strands',anchor:'start',offset:250,opacity:.14}),
]);
put('mental-influence','A purple shimmer reaches the recipient; the saving throw decides the effect.',()=>[
  shimmer('Influence reaches the mind','targets',{stageId:'mind',...tint('#b49fcf')}),
  echo('Mind touched','targets',{after:'mind',anchor:'start',offset:250,opacity:.14,...tint('#b49fcf')}),
]);
put('physical-maneuver','A restrained pressure gesture marks leverage, not a predetermined push or displacement.',()=>[
  echo('Leverage and pressure','targets',{stageId:'leverage',opacity:.16,offsetY:.035}),
  motion('press','targets',{after:'leverage',anchor:'start',duration:850,intensity:.16}),
]);
put('noxious-cloud','A small green haze marks nearby toxins, spores or contaminated fluid; native saves remain separate.',()=>[
  puff('Noxious matter released','source',{stageId:'cloud',...tint('#9cae62'),scale:.85,opacity:.4}),
  motion('shake','source',{after:'cloud',anchor:'start',duration:800,intensity:.12}),
]);
put('recovery','A gentle own-art pulse marks recovery without changing hit points, spell uses or conditions.',()=>[
  echo('Recovery pulse','source',{stageId:'recover',duration:1200,opacity:.18,...tint('#d8e3ce')}),
  motion('pulse','source',{after:'recover',anchor:'start',duration:1000,intensity:.18}),
]);
put('work-equipment','A deliberate work gesture marks crafting, repair or preparing an object; no equipment is created.',({recipe})=>[
  brace(`${recipe.name}: work carefully`,{duration:1200,intensity:.2}),
  echo('Tools and handling','source',{after:'ready',anchor:'start',offset:250,duration:1000,offsetY:.035,opacity:.16}),
]);
put('ground-disturbance','Dust marks the disturbed ground or rapid earthwork without drawing a damaging spell.',()=>[
  aura('Dust shifts',['smoke.puff.ring.01.white','smoke.puff.centered.grey'],{stageId:'ground',duration:1300,scale:1.1,opacity:.4,below:true,...tint('#bcae91')}),
  brace('Grounded movement',{after:'ground',anchor:'start',duration:900,intensity:.3}),
]);
put('direct-allies','Outward sound rings mark an order, story or performance; allies still act through their own actions.',()=>[
  ring('Signal to companions','source',{stageId:'signal'}),
  brace('Give the signal',{after:'signal',anchor:'start',duration:900,intensity:.18}),
]);
put('gather-electricity','A brief electrical gathering marks collection or absorption without creating an electrical attack.',()=>[
  aura('Electricity gathers',['static_electricity.01.blue'],{stageId:'charge',duration:1350,scale:.65,opacity:.45}),
  motion('pulse','source',{after:'charge',anchor:'start',duration:950,intensity:.18}),
]);
put('fire-preparation','A warm wisp marks preparing heat or flame; subsequent weapon hits and breath remain native.',()=>[
  cast('Heat gathers',['cast_generic.fire.01.orange'],{stageId:'heat',duration:1000,scale:.45,opacity:.4}),
  brace('Ready the heat',{after:'heat',anchor:'start',offset:150,intensity:.16}),
]);
put('poison-weapon','A restrained green trace marks applying poison to equipment, without rolling an attack.',()=>[
  puff('Poison coating','source',{stageId:'coat',duration:1000,scale:.35,opacity:.3,...tint('#8ba85a')}),
  brace('Coat the armament',{after:'coat',anchor:'start',intensity:.16}),
]);
put('trip-attempt','A low dust cue marks an attempt to upset balance; the target is not automatically knocked prone.',()=>[
  puff('Footing disturbed','targets',{stageId:'trip',scale:.4,opacity:.28,below:true,...tint('#c4b58f')}),
  motion('stagger','targets',{after:'trip',anchor:'start',offset:150,duration:850,intensity:.12}),
]);
put('concealment','A stilling own-art echo marks disguise or concealment; visibility and disguise are not changed.',()=>[
  echo('Shape blends into stillness','source',{stageId:'still',duration:1200,opacity:.23,blur:.4}),
  brace('Become still',{after:'still',anchor:'start',duration:1000,intensity:.1}),
]);
put('feigned-collapse','A restrained slump marks feigned death or surviving collapse without changing life state.',()=>[
  echo('Body slumps','source',{stageId:'slump',duration:1200,opacity:.18,offsetY:.065}),
  motion('press','source',{after:'slump',anchor:'start',duration:1100,intensity:.18}),
]);
put('soul-link','Pale spectral matter outlines possession or soul contact; no control or death is applied.',()=>[
  strands('Spectral contact','targets',{stageId:'soul',opacity:.35,...tint('#d5d3de')}),
  echo('Soul outline','targets',{after:'soul',anchor:'start',offset:250,opacity:.22,...tint('#e0dfee')}),
]);
put('phase-transition','Mist and an echo mark phasing or relocation; only the native ability changes position.',()=>[
  puff('Form thins','source',{stageId:'phase',duration:1200,opacity:.3}),
  echo('Phase echo','source',{after:'phase',anchor:'start',offset:100,duration:1100,opacity:.3,blur:.6}),
  motion('flicker','source',{after:'phase',anchor:'start',duration:950,intensity:.24}),
]);
put('interpose','A nonmagical guarding gesture marks stepping in for a ward without moving a token or reassigning damage.',()=>[
  brace('Interpose protectively',{intensity:.33}),
  echo('Guarding outline','source',{after:'ready',anchor:'start',offset:100,opacity:.22,offsetX:.06}),
]);
put('cold-preparation','An icy wisp marks freezing armament; native later hits decide cold effects.',()=>[
  cast('Cold gathers',['cast_generic.ice.01.blue','smoke.puff.side.grey'],{stageId:'cold',duration:1100,scale:.45,opacity:.38,...tint('#cfebf2')}),
  brace('Ready the frozen armament',{after:'cold',anchor:'start',offset:100,intensity:.15}),
]);
put('fortune','A doubled own-art echo marks a second chance; it never makes or changes the reroll.',()=>[
  echo('First possible moment','source',{stageId:'first',opacity:.16,offsetX:-.035,duration:1000}),
  echo('Second possible moment','source',{stageId:'second',after:'first',anchor:'start',offset:120,offsetX:.035,duration:1000,opacity:.16}),
  motion('pulse','source',{after:'first',anchor:'start',duration:950,intensity:.12}),
]);
put('toxic-contact','A small green puff marks noxious contact, without determining the affliction or its save.',()=>[
  puff('Noxious contact','targets',{stageId:'toxin',scale:.5,opacity:.35,...tint('#9bb06c')}),
  echo('Exposed outline','targets',{after:'toxin',anchor:'start',offset:150,opacity:.1,...tint('#b0be8d')}),
]);
put('remedy','A gentle recipient pulse marks first aid or a remedy without deciding its health effects.',()=>[
  echo('Remedy delivered','targets',{stageId:'aid',duration:1300,opacity:.2,...tint('#d7e6bd')}),
  motion('pulse','targets',{after:'aid',anchor:'start',offset:150,duration:1000,intensity:.12}),
]);
put('water-ward','Moisture gathers briefly into a watery defensive screen.',()=>[
  water('Protective water disc',{stageId:'waterward',scale:.8,opacity:.4}),
  brace('Hold the water screen',{after:'waterward',anchor:'start',intensity:.18}),
]);
put('ice-ward','A pale icy screen marks defense; attacks are redirected only by the native rule.',()=>[
  aura('Reflective ice',['shield.01.complete.01.blue','shield.01.complete.01.white'],{stageId:'iceward',duration:1300,scale:.8,opacity:.38,...tint('#cdebf3')}),
  brace('Brace behind ice',{after:'iceward',anchor:'start',intensity:.2}),
]);
put('jet-preparation','Exhaust and an airy trace mark jump jets without moving the actor.',()=>[
  puff('Jet exhaust','source',{stageId:'exhaust',scale:.4,opacity:.4,offsetY:.2,below:true}),
  aura('Jet-assisted motion',['wind_lines.01.01.white'],{after:'exhaust',anchor:'start',offset:150,duration:1100,scale:.85,opacity:.3}),
]);
put('dust-contact','Fine grit marks thrown dust or spices; native saves determine the impairment.',()=>[
  puff('Irritating grit','targets',{stageId:'grit',scale:.45,opacity:.4,...tint('#c7ae80')}),
  echo('Grit contact','targets',{after:'grit',anchor:'start',offset:100,opacity:.12}),
]);
put('mark-prey','A temporary outline marks the designated or observed quarry; no lasting condition is created.',()=>[
  metal('Quarry identified','targets',{stageId:'mark',scale:.6,opacity:.25,...tint('#b8aa8f')}),
  echo('Observed target','targets',{after:'mark',anchor:'start',offset:200,opacity:.13}),
]);
put('gather-water','Water briefly swirls as a tank fills or pressure builds, without creating an attack.',()=>[
  water('Water gathers',{stageId:'fill',scale:.45,opacity:.38}),
  brace('Build water pressure',{after:'fill',anchor:'start',offset:100,intensity:.2}),
]);
put('tether-many','Selected held creatures receive a brief tether outline; native movement moves them.',()=>[
  brace('Draw held creatures in'),
  strands('Held creatures drawn along','targets',{after:'ready',anchor:'start',offset:150,optionalTargets:true,targetSelection:'all'}),
  echo('Tether tension','source',{after:'ready',anchor:'start',offset:200}),
]);
put('arcane-contact','A restrained arcane shimmer marks a specific influence at the recipient without choosing its outcome.',()=>[
  shimmer('Arcane influence','targets',{stageId:'influence',opacity:.33,...tint('#d9d3b3')}),
  echo('Influence settles','targets',{after:'influence',anchor:'start',offset:200,opacity:.14}),
]);
put('molten-form','A warm glow marks the body returning to its molten form.',()=>[
  cast('Molten heat returns',['cast_generic.fire.01.orange'],{stageId:'molten',duration:1200,scale:.65,opacity:.38}),
  echo('Molten body outline','source',{after:'molten',anchor:'start',offset:200,opacity:.22,...tint('#edaa6a')}),
]);
put('send-signal','A compact visible signal marks information sent outward without adding a voice or attack.',()=>[
  ring('Information transmitted','source',{stageId:'signal',scale:.7,opacity:.32}),
  motion('pulse','source',{after:'signal',anchor:'start',duration:850,intensity:.13}),
]);
put('ward-ally','A quiet protective outline marks the ally while native rules grant the actual benefit.',()=>[
  aura('Ally protected',['shield.01.complete.01.white','shield.01.complete.01.blue'],{subject:'targets',stageId:'allyward',duration:1400,scale:.8,opacity:.3}),
  echo('Protected outline','targets',{after:'allyward',anchor:'start',offset:200,opacity:.13}),
]);
put('alarm','Outward rings mark an alarm without playing an unrelated voice recording.',()=>[
  ring('Alarm rings outward','source',{stageId:'alarm',scale:1.5,opacity:.45}),
  brace('Sound the alarm',{after:'alarm',anchor:'start',duration:1000,intensity:.22}),
]);
put('sonic-contact','Sound rings mark redirected vibration; the native saving throw determines its response.',()=>[
  ring('Vibration redirects','source',{stageId:'redirect',scale:.65,opacity:.28}),
  ring('Vibration reaches the target','targets',{stageId:'contact',after:'redirect',anchor:'start',offset:200,scale:.85,opacity:.35}),
]);
put('technology-link','Circuit-like sparks mark routed technological control without changing behavior.',()=>[
  aura('Control signal',['static_electricity.01.blue'],{stageId:'control',duration:1100,scale:.45,opacity:.32}),
  aura('Technological recipient',['static_electricity.01.blue'],{subject:'targets',after:'control',anchor:'start',offset:200,duration:1100,scale:.6,opacity:.35}),
]);
put('space-control','A small turning gesture marks control of nearby space without inventing hits or terrain.',()=>[
  motion('spin','source',{stageId:'turn',duration:1000,intensity:.16}),
  echo('Turning outline','source',{after:'turn',anchor:'start',offset:100,duration:1000,opacity:.18,offsetX:.035}),
]);
put('release','A loosening outline marks release while the native action changes the held condition.',()=>[
  echo('Freeing motion','source',{stageId:'loosen',duration:1000,opacity:.17}),
  echo('Restraint loosens','targets',{stageId:'released',after:'loosen',anchor:'start',offset:150,duration:1200,opacity:.22,offsetY:-.04,optionalTargets:true}),
  motion('pulse','source',{after:'loosen',anchor:'start',offset:200,duration:900,intensity:.12}),
]);
put('crystal-contact','A pale faceted outline marks crystallization; native saves determine slowing or petrification.',()=>[
  shimmer('Crystal facets form','targets',{stageId:'crystal',scale:.7,opacity:.3,...tint('#d9e3e8')}),
  echo('Crystalline outline','targets',{after:'crystal',anchor:'start',offset:250,duration:1300,opacity:.24,...tint('#cbd2d8')}),
]);
put('debilitation','A dimmed outline marks the triggered weakening effect, not another hit or a forced displacement.',()=>[
  echo('Strength falters','targets',{stageId:'weaken',duration:1200,opacity:.23,...tint('#a6a6a0')}),
  motion('press','targets',{after:'weaken',anchor:'start',offset:150,duration:900,intensity:.1}),
]);
put('ink-release','A small dark ink cloud marks poisonous ink released nearby, without applying its affliction.',()=>[
  puff('Dark ink released','source',{stageId:'ink',scale:.7,opacity:.42,...tint('#3c3048')}),
  motion('shake','source',{after:'ink',anchor:'start',duration:850,intensity:.15}),
]);
put('prismatic-surge','Different colors shimmer as unstable prismatic energy escapes; native rules resolve exposure.',()=>[
  shimmer('Prismatic red','source',{stageId:'prism',duration:1100,opacity:.22,...tint('#e7a8aa')}),
  shimmer('Prismatic green','source',{stageId:'prism-green',after:'prism',anchor:'start',offset:120,duration:1100,scale:.8,opacity:.22,...tint('#b8dfb7')}),
  shimmer('Prismatic blue','source',{stageId:'prism-blue',after:'prism',anchor:'start',offset:240,duration:1100,scale:.95,opacity:.22,...tint('#b3c9ed')}),
]);
put('spirit-projection','A pale spirit echo marks projecting bound spirits; no new creature, relocation or sense is applied.',()=>[
  strands('Spirits reach outward','source',{stageId:'spirits',scale:.8,opacity:.32,...tint('#d4d3e2')}),
  echo('Projected spirit outline','source',{after:'spirits',anchor:'start',offset:200,duration:1200,offsetY:-.09,opacity:.27,...tint('#e1e1e9')}),
]);

export default out;
