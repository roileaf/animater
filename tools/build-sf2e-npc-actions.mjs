// Rebuild from an exported copy of the installed SF2e actor packs, never live LevelDB.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {findNpcAbility,abilityForm,breathElement,breathShape} from '../scripts/catalogs/pf2e/npc-abilities.mjs';
import {findSfEntry,sfVariantForEvent} from '../scripts/catalogs/sf2e/sf2e-catalog.mjs';

// These source-specific reviews describe the native effect, not a guess from its title.
// Strike cards deliberately prepare only: their subsequent native rolls own contact/damage.
const reviewed=new Map();
function group(id,aim,names,rationale){for(const name of names.split('|'))reviewed.set(name,{id:`review-c-${id}`,aim,trigger:'use',rationale});}
group('strike','self','Attack Pattern Alpha|Attack Pattern Beta|Attack Pattern Gamma|Ballistic Defense Matrix|Free Swing|Atmospheric Breach|Undulating Wrath|Ambush|Rapid Bombardment|Tactical Strike|Back To Nature|Battle Casting|Whirling Assault|BVR Engagement|Rain of Bullets|Orbital Lariat|Spine Volley|Spine Barrage|Causational Moments|Rampage|Death Throe|Blade Storm|Reactive Unmaking|Stone Barrage|Archon\'s Protection|Analyzed Strike|Stomp|Crystalline Ambush|Assault Jump|Counter-fire|Rampage Strikes|Reciprocal Strike|Crescent Blast|Vengeful Strike|Flyby Attack|Slide and Slash|Overhead Attack|Kill Steal|Swooping Strike|Talon|Lunging Bite|Raider\'s Assault|Block Path|Too Many Legs!|Inject Conversion|Relentless Fire|Defensive Fling|Frenetic Thrash|Not So Fast|Elusive Shot|Eclipse Swing|Inhibitor|Sonic Purification|Sentinel\'s Strike|Destructive Whirlwind|Flicker Strike|Binaric Assault|Maul','Ready the stated native attack sequence; do not duplicate its Strikes, damage, spell or route.');
group('move','self','Hypersonic Burst|Jetpack Tackle|Glacial Stride|Inexorable March|Natural Thruster|Notch Position|Circling Reposition|Quick Step|Soundless Step|Jump|Deep Plunge|Aeon Flight|Fly Free|Fly-By Thief','Movement preparation only; native movement retains the path and destination.');
group('spell','self','Reach Spell|Navigational Spellshape|Higher Dimensional Geometry|Gravitic Surge','Spell preparation; the next native spell supplies range, origin and payload.');
group('guard','self','Covered in Bugs|Accelerated Response|Exigency|Spine Deflection|Covering Posture|Deflecting Blades|Malleable Flesh|Raid Ready|Swirling Shield|Slow March|Quick Cover|Nimble Hop|Steel Wing|Armored Deflection|Spinning Deflection|Opportunistic Rotation|Attaché Expert|Absorb Shock|Tun State','Raise a physical defensive posture without changing AC, HP or attack outcomes.');
group('ward','self','Spell Membrane|Fire Shield|Copi Concealment|Warpwave|Scatter Light','Brief protective field signaling native resistance or concealment.');
group('aid','target','Stabilizing Antivenom|Vital Siphon|Minor Wish|Booster|Hang in There!|Pay Your Dues|Get Back!|Interpose|Royal Tithe','Identify the stated ally assistance; native documents control healing, damage redirection and positions.');
group('command','self','Efficient Commands|Morale Boost|Move Drone|Queen\'s Sacrifice|Into the Fray|Command the Converted','A directing/support gesture; minions and allies execute their own actions.');
group('study','self','Check Feed|Foraging Constituents|Mechanical Trickery|Ocular Scopes|Record Video','Restrained observation or device-operation cue, without revealing hidden information.');
group('mark','target','Target Tracking|Secondary Target|Focus Aim|Hunt Prey|Target Lock|Shoot to Kill|Assess Target|Multi-Weapon Aim|There You Are!|Eyes on You|Aeon Precision','Attention settles on the designated target; no attack is made by this cue.');
group('disguise','self','Pocket Protection|Freeze|Still as a Corpse|Disguise Shell|Sensor Song','A silhouette cue for hiding, disguise or holographic deception; visibility remains native.');
group('shape','self','Create Effigy|Detach Cluster|Fungible|Expand|Putty Form|Mutated Split|Reforming Merge|Stretchy Limbs|Swarm Form|Flat-Pack|Unravel|Adjust Shape','Body form changes cosmetically; never spawn creatures or resize documents.');
group('dissolve','self','Revert|Shift Dimensionality|Spore Tide|Fold Reality|Defensive Phase|Slip Through Space|Archon\'s Pursuit','Phase or disperse the outline; no token teleport is invented.');
group('imbue','self','Clatter|Energy Ray|Seep In|Absorb Aggression|Enhance Mutation|Arcanocharged Strike|Quick Tinker|Bypass Firewalls|Volatile Pods|Countdown','Power gathers for a later native attack or stated follow-up, without a fabricated impact.');
group('gather','self','Disassemble|Harvest Brain|Aeon Reload|Mass Reload|Vend','Handling/reloading/collecting gesture, with no inventory or resource modification.');
group('grip','target','Tongue Reel|Reel In|Fling|Pod Prison|Attach|Waterbear Hug','The stated grasp/haul is signaled; native checks determine movement and conditions.');
group('unbalance','target','Low Gravity Kick|Ankle Tap|Concussive Feint|Unreadable Aim|Thrashing Wisps|Dirty Business','Signal the stated distraction or push without deciding the save or moving a token.');
group('poison','target','Drink Marrow|Infest|Let Us Serve You!|Entangling Sludge','A restrained organic reagent/contamination cue; native saves and conditions remain authoritative.');
group('consume','self','Foraging Constituents|Harvest Organics|Gorge|Draw Power|Recharge with Radiation','Contained inward collection/consumption cue with no healing or resource write.');
group('recover','self','White Helmet Protocol|Fill Vitality|Quantum Recycle|Rewind Wounds','Restoration readiness without applying healing, rerolls or resources.');
group('luck','self','Fated Outcome|Well, Actually','A restrained moment of resolve for the stated fortune effect, without rolling.');
group('earth','self','Stone Powder Cloud|Bursting Rubble','A local dust cue; native terrain, saves and movement remain unchanged.');
group('ward','target','Planned Obsolescence|Malware Infection|Error Injection|Betray Tech|Gnash Gnash Gnash|Epic Haxx','A restrained targeted field identifies interference with the stated device; native glitching remains untouched.');
group('ward','self','Quantum Tranquility|Gravity Maelstrom|Quantum Agony|Gravitic Control|Thicken','A contained field/body density cue for native gravity or resistance; no terrain or forced movement.');
group('reveal','self','Stellar Mote|Creeping Warmth','A small source glimmer signals the stated light/mote; no actor, aura or illumination document is created.');
group('unbalance','self','Bouncing Blobs','Body pulse marks the swarm disruption; saves and conditions stay native.');
group('spell','target','Holospark|Redirect Arc|Flash Strike|Fire Suppressor|Possess Creature|Inhabit Ship','Restrained energy/control focus; native spell, save and movement events own their actual payload.');
group('soul','self','Soul Warden','A contained spirit collection cue, with no soul/item document automation.');
group('shape','self','Fungible','Physical composition changes; subsequent native attacks own their damage type.');
group('command','self','Trill|Rallied by the Beasts','A source gesture marks the native vocal/electromagnetic signal without an invented impact.');
group('grip','target','Breach Delivery','Draw attention to the native pull and subsequent attack sequence; never move target documents.');
group('disguise','target','Concealing Coil','A restrained target silhouette signals concealment within the coil; native visibility remains unchanged.');

export function sfNpcForm(row){
 const event={type:'use',systemId:'sf2e',actor:row.actor,item:{...row.item,actor:row.actor}};
 const explicit=reviewed.get(row.item.name);if(explicit)return {form:{...explicit},coverage:'reviewed'};
 const native=findSfEntry(event);if(native){const variant=sfVariantForEvent(native,event)??native.variants[0];return {native:{entryId:native.id,variantId:variant.id},form:{id:'review-c-study',aim:'self',trigger:variant.recipe.trigger,rationale:'Reuse the authored native SF2e catalog composition.'},coverage:'native'};}
 const form=findNpcAbility(event)??abilityForm(event);
 if(!form)throw Error(`Unreviewed SF2e action: ${row.item.name} (${row.actor.name})`);
 return {form:{id:form.id,aim:form.aim,trigger:form.trigger??'use',...(form.variant?{variant:form.variant}:{}),...(form.id==='breath'?{variant:`${breathElement(row.item)}-${breathShape(row.item)}`}:{})},coverage:'shared'};
}

export function buildSfNpcActions(rows){
 const groups=new Map();
 for(const row of rows){const classified=sfNpcForm(row),item=row.item,traits=[...(item.system?.traits?.value??[])].sort();
  const key=JSON.stringify([item.name,traits,item.system?.actionType?.value,item.system?.actions?.value,classified]);
  let action=groups.get(key);if(!action){action={id:`sf2e-npc-${createHash('sha256').update(key).digest('hex').slice(0,12)}`,systemId:'sf2e',name:item.name,traits,actionType:item.system?.actionType?.value,actions:item.system?.actions?.value,...classified,creatures:[],sources:[]};groups.set(key,action);}
  if(!action.creatures.includes(row.actor.name))action.creatures.push(row.actor.name);action.sources.push(row.source);
 }
 return [...groups.values()].sort((a,b)=>a.name.localeCompare(b.name)||a.id.localeCompare(b.id));
}
if(process.argv[1]?.replaceAll('\\','/').endsWith('/build-sf2e-npc-actions.mjs')){
 const source=process.argv[2]??'.cache/system-npc-sources.json',rows=JSON.parse(fs.readFileSync(source,'utf8')).sf2e;
 const actions=buildSfNpcActions(rows),meta={system:'sf2e',version:'1.6.1',actors:new Set(rows.map(r=>r.actor.id)).size,occurrences:rows.length,actions:actions.length,scope:'Active embedded action items in installed native SF2e NPC Actor packs; passive items excluded.'};
 fs.writeFileSync('data/sf2e-npc-actions.mjs',`// Generated by tools/build-sf2e-npc-actions.mjs from native SF2e actor packs.\nexport const SF_NPC_ACTION_SOURCE=${JSON.stringify(meta)};\nexport const SF_NPC_ACTIONS=${JSON.stringify(actions)};\n`);
 console.log(JSON.stringify(meta));
}

