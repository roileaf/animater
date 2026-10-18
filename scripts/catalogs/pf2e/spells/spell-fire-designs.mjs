// Reviewed against complete PF2e 8.5.1 descriptions, not the fire trait alone.
// Area layers illustrate the cast. Saves, choices, Sustain and later damage
// never grant a reason to move a victim or play a premature detonation.
const native=(name,roots,extra={})=>({label:name,pattern:`fire:${name}`,cast:'glint',nativeArea:true,...roots,...extra});
const leaves='swirling_leaves.complete.01.orangepink,swirling_leaves.complete.01.green';
const steam='fumes.steam.white';
const fire='flames.04.complete.orange';
const groundFire='flames.04.loop.orange';
export const FIRE_SPELL_MOTIFS={
 fireDrought:native('Breath of Drought',{area:'shimmer.01.orange,shimmer.01.blue',aura:'wind_lines.01.01.white',hit:'particles.outward.orange,particles.outward.greenyellow'},{symbolic:true}),
 fireBlossoms:native('Burning Blossoms',{area:'plant_growth.04.round.4x4.complete.greenwhite,plant_growth.03.round.4x4.complete.greenyellow',hit:leaves,aura:groundFire},{delivery:'burst',contactFx:false,symbolic:true}),
 fireDehydrate:native('Dehydrate',{area:'particles.inward.orange,particles.inward.greenyellow',aura:steam,hit:fire},{symbolic:true}),
 fireCataclysm:native('Cataclysm',{area:'ground_cracks.03.orange',hit:fire,aura:'wind_lines.01.01.white',additionalMedia:{water:'water_splash.circle.01.blue',acid:'liquid.splash.green,liquid.splash.blue',cold:'ice_spikes.radial.burst.white',electric:'lightning_strike.blue'}},{symbolic:true}),
 fireConfluence:native('Elemental Confluence',{area:'wind_lines.01.02.white',hit:'plant_growth.03.round.2x2.complete.greenyellow',aura:groundFire,additionalMedia:{earth:'ground_cracks.01.orange',water:'water_splash.circle.01.blue',metal:'cloud_of_daggers'}},{contactFx:false,symbolic:true}),
 fireDouble:native('Ember Doppelgänger',{hit:fire,aura:'smoke.plumes_loop.01.grey'},{delivery:'point',symbolic:true}),
 fireBarrage:native('Explosive Barrage',{area:'fireball.explosion.orange',hit:'soundwave.02.orangeyellow,soundwave.02.blue',aura:'fireball.loop_debris.orange'}),
 fireDust:native('Explosive Dust',{area:'particles.outward.orange,particles.outward.greenyellow',aura:'particles.swirl.orange,particles.swirl.greenyellow'},{symbolic:true}),
 fireFireworkBlast:native('Firework Blast',{area:'firework.02.orangeyellow.03',hit:'soundwave.02.blue',aura:'firework.02.yellow.02'}),
 fireGeyser:native('Geyser',{area:'water_splash.circle.01.blue',hit:'liquid.splash_side.blue',aura:steam},{delivery:'burst',symbolic:true}),
 fireIgniteFireworks:native('Ignite Fireworks',{area:'firework.01.orangeyellow.01',hit:'soundwave.01.blue',aura:'firework.01.yellow.02'}),
 fireAshes:native('Incendiary Ashes',{area:'particles.outward.grey,particles.outward.greenyellow',aura:'fumes.04.loop.grey',hit:'wind_lines.01.01.white'},{symbolic:true}),
 fireFog:native('Incendiary Fog',{area:'ambient_fog.001.complete.large.black,fumes.04.complete.black,fumes.04.complete.grey',aura:'ambient_fog.001.loop.large.black,fumes.04.loop.black,fumes.04.loop.grey',hit:'particles.outward.orange,impact.fire.01.orange'},{symbolic:true}),
 fireTruth:native('Pyroclastic Truth',{area:'liquid.splash_side02.red',hit:'ward.rune.yellow',aura:groundFire},{symbolic:true}),
 fireFumarole:native('Rainbow Fumarole',{area:'lava_spout.001.001.complete.multicolored,lava_spout.001.001.complete.orangeyellow',aura:'fumes.04.loop.purple,fumes.04.loop.grey',hit:'firework.01.yellow.02'},{delivery:'burst',symbolic:true}),
 fireRedistribute:native('Redistribute Potential',{area:groundFire,hit:'ice_spikes.radial.burst.white',aura:'energy_strands.complete.blue',slotGeometry:{bolt:'beam'}},{delivery:'burst',previewArea:{type:'square',value:5},symbolic:true}),
 fireSkyrocket:native('Signal Skyrocket',{area:'firework.02.orangeyellow.01',hit:'glint.red,glint.yellow',aura:'particles.outward.red,particles.outward.greenyellow'},{delivery:'self',symbolic:true}),
 fireWhirling:native('Whirling Flames',{area:'fire_ring.500px.red',hit:groundFire,aura:'wind_lines.01.02.white'}),
 fireWildfire:native('Wildfire',{area:'flames.01.orange',hit:'particles.outward.grey,particles.outward.greenyellow',aura:'flames.02.orange'},{contactFx:false}),
 fireDivine:native('Divine Immolation',{area:'sacred_flame.target.yellow',aura:'fire_ring.900px.yellow,fire_ring.900px.red',hit:groundFire}),
 fireBile:native("Earth's Bile",{area:'lava_spout.001.001.complete.orangeyellow',hit:'ground_cracks.02.orange',aura:'liquid.splash_side02.red'}),
 firePlasma:native('Plasma Whirl',{cast:'portals.horizontal.ring.dark_red_yellow,portals.horizontal.ring.bright_yellow',area:'burning_hands.02.blue,burning_hands.01.orange',hit:'static_electricity.03.blue',aura:'lightning_strike.blue'},{delivery:'cone'}),
 fireRejuvenating:native('Rejuvenating Flames',{cast:'sacred_flame.source.yellow',area:'burning_hands.01.green,burning_hands.01.orange',hit:'swirling_sparkles.01',aura:'glint.yellow'},{delivery:'cone',slotThemes:{area:'fire'},symbolic:true}),
 fireRayGround:native('Fire Ray',{cast:'cast_generic.fire',bolt:'scorching_ray.01.orange',hit:'impact.011.orange',aura:'flames.01.orange'},{delivery:'bolt',slotGeometry:{bolt:'beam'}}),
 fireSunBlade:native('Sun Blade',{cast:'sacred_flame.source.yellow',bolt:'scorching_ray.01.yellow,scorching_ray.01.orange',hit:'sacred_flame.target.yellow',aura:'glint.yellow'},{delivery:'bolt',slotGeometry:{bolt:'beam'}}),
};
export const FIRE_SPELL_DESIGNS=Object.fromEntries(Object.entries({
 'breath-of-drought':'fireDrought','burning-blossoms':'fireBlossoms',dehydrate:'fireDehydrate',cataclysm:'fireCataclysm',
 'elemental-confluence':'fireConfluence','ember-doppelgänger':'fireDouble','explosive-barrage':'fireBarrage','explosive-dust':'fireDust',
 'firework-blast':'fireFireworkBlast',geyser:'fireGeyser','ignite-fireworks':'fireIgniteFireworks','incendiary-ashes':'fireAshes',
 'incendiary-fog':'fireFog','pyroclastic-truth':'fireTruth','rainbow-fumarole':'fireFumarole','redistribute-potential':'fireRedistribute',
 'signal-skyrocket':'fireSkyrocket','whirling-flames':'fireWhirling',wildfire:'fireWildfire','divine-immolation':'fireDivine',
 'earths-bile':'fireBile','plasma-whirl':'firePlasma','rejuvenating-flames':'fireRejuvenating','fire-ray':'fireRayGround','sun-blade':'fireSunBlade',
}).map(([slug,motif])=>[slug,[motif,'']]));

// Descriptive stage labels where the media family name would only repeat the spell name.
const STAGE_LABELS={
 fireWhirling:{cast:'Flames begin to whirl',area:'Flame vortex rises',hit:'Burning ground',aura:'Hot wind spirals'},
 fireWildfire:{cast:'Spark the blaze',area:'Wildfire spreads',aura:'Second flame front',hit:'Ash drifts'},
 fireSkyrocket:{cast:'Light the fuse',hit:'Rocket climbs',area:'Burst overhead',aura:'Sparks scatter'},
};
export function fireSpellLayers(spell,{cast:castFx,fx,track,charge,copy}){
 if(!FIRE_SPELL_MOTIFS[spell.design?.motif])return null;
 const d=spell.design,name=spell.name,labels=STAGE_LABELS[d.motif]??{};
 const cast=label=>castFx(labels.cast??label);
 const mediaName=slot=>{if(labels[slot])return labels[slot];const family=d.assets[slot]?.[0]?.split('.')[1]?.replaceAll('_',' ')??name;return family[0].toUpperCase()+family.slice(1);};
 const oneShot=slot=>!d.assets[slot]?.some(k=>/\.loop\.|_loop\.|\.flames\.(01|02)\./.test(k));
 const area=(slot,delay=charge,duration=3600,extra={})=>fx('template',slot,mediaName(slot),delay,duration,{scale:1,below:true,oneShot:oneShot(slot),...extra});
 const local=(slot,delay=charge,duration=2600,extra={})=>fx('cast',slot,mediaName(slot),delay,duration,{subject:'source',oneShot:oneShot(slot),...extra});
 const heat={tintEnabled:true,colorize:true,tint:'#e9b36a'};
 const ash={tintEnabled:true,colorize:true,tint:'#9a9286'};
 switch(d.motif){
  case 'fireDrought':return [cast(name),area('area',charge,4000,{...heat,opacity:.6}),area('aura',charge,3600,{...heat,opacity:.55}),area('hit',charge+700,3200,{...ash,opacity:.35,tracks:[track('position.x',-.15,.15,2600)]})];
  case 'fireBlossoms':return [cast(name),area('area',charge,5200,{scaleIn:.05,scaleInDuration:1600,opacity:.8}),area('hit',charge+1200,4800,{tintEnabled:true,colorize:true,tint:'#fff3e8',below:false,tracks:[track('position.y',-.25,.25,3600)]}),area('aura',charge+1400,4200,{tintEnabled:true,colorize:true,tint:'#fff5ef',opacity:.5})];
  case 'fireDehydrate':return [cast(name),area('area',charge,3600,{...heat}),area('hit',charge+250,3200,{opacity:.5,scale:.75}),area('aura',charge+650,3200,{opacity:.65,below:false,tracks:[track('position.y',.15,-.2,2400)]})];
  case 'fireCataclysm':return [cast(name),area('area'),area('acid',charge+200,3200,{tintEnabled:true,colorize:true,tint:'#74d954',opacity:.65}),area('cold',charge+450,3200,{opacity:.7}),area('aura',charge+600,3600,{opacity:.65}),area('electric',charge+800,2600,{below:false}),area('water',charge+900,3000,{opacity:.7}),area('hit',charge+1050,3200,{opacity:.65})];
  case 'fireConfluence':return [cast(name),area('area',charge,4500,{opacity:.8,tracks:[track('rotation',0,160,3800)]}),...['earth','water','aura','metal','hit'].map((slot,i)=>area(slot,charge+i*130,4000,{scale:.38,offsetX:Math.cos(i*Math.PI*2/5)*.27,offsetY:Math.sin(i*Math.PI*2/5)*.27,opacity:.8}))];
  case 'fireDouble':return [cast(name),copy(name,charge,4400,{subject:'source',copies:1,copySpread:0,offsetX:.8,opacity:.65,tintEnabled:true,tint:'#eb7b31'}),local('hit',charge,4400,{offsetX:.8,opacity:.7,scale:1.2}),local('aura',charge+350,4200,{offsetX:.8,scale:1.3,opacity:.65})];
  case 'fireBarrage':return [cast(name),area('area'),area('hit',charge+150,2800,{below:false,opacity:.8}),area('aura',charge+600,3200,{opacity:.7})];
  case 'fireDust':return [cast(name),area('area',charge,3600,{...ash,opacity:.45}),area('aura',charge+500,3500,{...ash,opacity:.5,tracks:[track('rotation',0,40,2800)]})];
  case 'fireFireworkBlast':return [cast(name),area('area',charge,3500,{below:false}),area('aura',charge+250,3500,{below:false,offsetX:.16,offsetY:-.14}),area('hit',charge+200,2600,{opacity:.6})];
  case 'fireGeyser':return [cast(name),area('area',charge,3200,{below:false}),area('hit',charge,3500,{below:false,tracks:[track('scale.y',.25,1.2,1300)]}),area('aura',charge+850,3800,{below:false,tracks:[track('position.y',0,-.15,2400)]})];
  case 'fireIgniteFireworks':return [cast(name),area('area',charge,3500,{below:false}),area('aura',charge+400,3300,{below:false}),area('hit',charge+150,2800,{scale:.9,opacity:.65})];
  case 'fireAshes':return [cast(name),area('area',charge,4400,{...ash,below:false,tracks:[track('position.y',-.3,.2,3400)]}),area('hit',charge+200,3600,{...ash,opacity:.55}),area('aura',charge+900,3300,{...ash,opacity:.45})];
  case 'fireFog':return [cast(name),area('area',charge,4200,{opacity:.85,below:false,scaleIn:.1,scaleInDuration:1200}),area('aura',charge+900,4000,{opacity:.7,below:false}),{...area('hit',charge+1400,2200,{opacity:.75,below:false,scale:.6}),label:'Embers flicker in the dust'}];
  case 'fireTruth':return [cast(name),area('area',charge,3000,{below:false,tintEnabled:true,colorize:true,tint:'#e67b21'}),area('aura',charge+350,3800,{opacity:.7}),area('hit',charge+500,3500,{scale:.75,opacity:.6,below:false})];
  case 'fireFumarole':return [cast(name),area('area',charge,4000,{below:false}),area('hit',charge+200,3600,{below:false,tracks:[track('rotation',0,120,2600)]}),area('aura',charge+700,4200,{below:false,opacity:.65})];
  case 'fireRedistribute':return [cast(name),area('hit',charge,3400,{offsetX:-.5,scale:1}),area('area',charge+300,3600,{offsetX:.5,scale:1}),area('aura',charge,3400,{tintEnabled:true,colorize:true,tint:'#d8bdf2',tracks:[track('position.x',-.35,.35,2200)]})];
  case 'fireSkyrocket':return [cast(name),local('hit',charge,2400,{tintEnabled:true,colorize:true,tint:'#ff4c39',scale:.5,tracks:[track('position.y',0,-2,1800)]}),local('area',charge+1700,3600,{offsetY:-2,scale:2.2}),local('aura',charge+1700,3500,{offsetY:-2,scale:2,opacity:.7,tintEnabled:true,colorize:true,tint:'#ff4c39'})];
  case 'fireWhirling':return [cast(name),area('area',charge,4000,{tracks:[track('rotation',0,260,3400)]}),area('hit',charge+300,3800,{opacity:.7}),area('aura',charge+450,3400,{opacity:.5,tracks:[track('rotation',0,-160,3000)]})];
  case 'fireWildfire':return [cast(name),area('area',charge,4400,{opacity:.75}),area('aura',charge+450,4200,{opacity:.7,rotation:70}),area('hit',charge+300,3900,{...ash,opacity:.5})];
  case 'fireDivine':return [cast(name),area('area',charge,3500,{below:false}),area('aura',charge+300,4000,{opacity:.75}),area('hit',charge+650,3600,{tintEnabled:true,colorize:true,tint:'#ffeb9e',opacity:.6})];
  case 'fireBile':return [cast(name),area('hit',charge,3800),area('area',charge+300,4000,{below:false}),area('aura',charge+850,3400,{opacity:.7})];
  case 'firePlasma':return [local('cast',0,3300,{below:true,scale:1.5}),area('area',charge,3600,{below:false}),local('hit',charge+150,3300,{scale:1.6,opacity:.8}),local('aura',charge+300,3000,{scale:1.25,opacity:.65})];
  case 'fireRejuvenating':return [local('cast',0,2600,{scale:1.2}),area('area',charge,3600,{below:false,tintEnabled:true,colorize:true,tint:'#dcf08a'}),local('hit',charge+150,3300,{scale:1.5,opacity:.75,tintEnabled:true,colorize:true,tint:'#fff4b5'})];
  case 'fireRayGround':return [cast(name),fx('travel','bolt',name,charge,2400,{scale:.85,oneShot:true,fadeIn:0}),fx('impact','hit',name,charge+1400,1800,{scale:1.35}),fx('aura','aura',name,charge+1500,3500,{subject:'targets',below:true,scale:1.1,requiresHit:true})];
  case 'fireSunBlade':return [local('cast',0,2300,{offsetX:.25,offsetY:.15,scale:.8}),fx('travel','bolt',name,charge,2400,{scale:.8,oneShot:true,fadeIn:0,tintEnabled:true,colorize:true,tint:'#ffe47c'}),fx('impact','hit',name,charge+1400,2600,{scale:1.5})];
 }
}
