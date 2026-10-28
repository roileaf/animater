const martial=new Set(['strike','heavyStrike','doubleStrike','multiStrike','restorativeStrike','smite','spellstrike','fearStrike','charge','tumbleStrike','feintStrike','bindStrike','tripStrike','drawStrike','whirlwindStrike','unarmed']);
const elementProfiles={fire:'fire',cold:'cold',lightning:'electric',electricity:'electric',acid:'acid',poison:'poison',healing:'healing',vitality:'holy',holy:'holy',necrotic:'void',void:'void',water:'water',earth:'earth',wind:'wind',arcane:'force',psychic:'psychic',mental:'psychic',sonic:'sonic',force:'force',metal:'metal',shadow:'shadow',time:'time',air:'wind',plant:'vines',wood:'vines',light:'light',spirit:'spirit'};
// Explicit native element traits. Vitality/void/poison traits also mark healing,
// undead and toxin features, so they never add an elemental cue on their own.
const traitElements={fire:'fire',cold:'cold',electricity:'electric',acid:'acid',sonic:'sonic',water:'water',air:'wind',earth:'earth',metal:'metal',wood:'vines',force:'force'};
const featElement=feat=>{const own=Object.keys(traitElements).filter(t=>feat.traits?.includes(t));return traitElements[own.find(t=>traitElements[t]===elementProfiles[feat.theme])??own[0]];};
// Activities whose element is audible when the feat itself carries the element trait.
const elementalActs=new Set(['groundCreation','stance','form','bind','guard','movement','flight','lavaLeap','lightningDash','produce','targetGuard','sentinel','windMove']);
const physical=new Set([...'firearm alchemicalShot ranged throughShot mixedStrike bombThrow boomerang teleport medicine'.split(' ')]);
// 2026-10-08 audit: full-description reviews of non-generic audio decisions.
const FEAT_SOUND_OVERRIDES={
 'purge-sins':['holy','Celestial purge counteracts toxins and disease; no hit points are restored, so a radiant cue replaces the healing chime.'],
 'purge-system':['','Internal heating and cooling reduces a poison stage; no magical healing tone.'],
 'purify-element':['','Purifies one cubic foot of element; quiet, no healing tone.'],
 'resilient-physiology':['','Body rejects an affliction through a save; no audible restoration.'],
 'skin-split':['','Peeling off a premature shed is a physical, quiet act; no healing chime.'],
 'vomit-stomach':['','Expelling a poisoned stomach is not magical healing; left quiet.'],
 'spell-retaliation':['drain','Recharges Spellstrike by harnessing an enemy spell; energy-siphon cue, not healing.'],
 'swift-river':['water','Flows like water to end a movement restriction; water cue, not healing.'],
 'unwind-death':['revive','Winds a dead creature back to life; return-to-life cue.'],
 'urgent-upwelling':['force','Wellspring magic surges; raw magical energy cue, not healing.'],
 'venom-purge':['poison','Specialized venom burns out other toxins; venom cue, not healing.'],
 'gnaw':['naturalPierce','Jaws chew through an object; natural bite contact, not a blade.'],
 'sportlebore-choke':['swarm','Insect swarm crawls down throats; swarm cue, not a poison gas.'],
 'warning-shot':['gunshotAir','Demoralize by firing the loaded firearm into the air; one discharge at the source, no projectile contact.'],
 'call-wizardly-tools':['teleport','Bonded item teleports into the hand; teleport arrival cue.'],
 'cleansing-light':['light','Horn bursts with cleansing light (Restoration, dazzle); light cue rather than a healing chime.'],
 'tragic-lament':['','Dramatic poetic speech; spoken words are left to the table, no battle cry.'],
 'calacas-showstopper':['sonic','Smashes an instrument or belts a discordant note: a stunning blast of sound.'],
 'call-and-response':['song','The composition becomes a sung call-and-response chant.'],
 'do-you-know-who-i-am':['battleCry','A well-timed tirade or attention-getting shout.'],
 'shielding-taunt':['shield','Bangs loudly on the shield before the Taunt.'],
 'feed-the-void':['wind','Screaming winds rush into the void at the source.'],
 'final-form':['battleCry','The source screams out in rage and defiance as it transforms.'],
 'black-powder-boost':['gunshotAir','Discharges the firearm for kickback during the Leap; one discharge at the source, no projectile contact.'],
 'electrify-armor':['electric','Armor innovation is electrified; one discharge cue.'],
 'torch-goblin':['fireIgnition','Sets itself thoroughly on fire with a torch or incendiary.'],
 'quaking-stomp':['earthquake','Stomp creates a minor earthquake; seismic rumble.'],
 'rattle-the-earth':['earthquake','Strikes the ground to cause an earthquake; seismic rumble.'],
 'yamarajs-grandeur':['wind','A blast of icy wind and ravenous insects dealing slashing damage; wind cue rather than ice forming.'],
 'spore-cloud':['poison','A released cloud of spores and pollen; gas-release cue rather than growing roots.'],
 // Sound audit 2026-10-28.
 'resuscitate':['','A Medicine check to bring someone round; no magical healing tone.'],
 'desperate-resuscitation':['','A Medicine check to bring someone round; no magical healing tone.'],
 'steel-your-resolve':['','Stamina restored from Resolve: steadying yourself, nothing audible.'],
 'sidestep':['','A missed Strike is redirected by footwork; no magic to dispel.'],
 'confusing-commands':['','Mimicked orders are a mental trick, not a war cry.'],
 'raise-symbol':['','A held religious symbol; no shield to clang.'],
 'worms-feast':['swarm','Cave worms swarm and feast; no stone involved.'],
 'vengeful-spirit-deck':['spirit','A ghostly harrow deck; spirit surge rather than plain force.'],
 'demolishing-knockback':['hammer','A mythic blow that drives a foe through walls; a heavy crushing hit.'],
 'devastating-weaponry':['mixed','A volley of projectiles or flying weapons, not one blade cut.'],
 'implements-assault':['mixed','The implement flies and strikes; neutral release plus contact.'],
 'clans-edge':['dagger','The clan dagger.'],
 'spear-dancer':['spear','A spear thrust.'],
 'reflexive-grapple':['whip','A lash that seizes the foe.'],
 'whirling-clobber':['club','A held body swung as a club.'],
 'wukong-extension':['staff','An extending cudgel.'],
 'hardwood-armor':['vines','Grown hardwood, not a metal shield.'],
 'metal-carapace':['metal','A metal carapace forms.'],
 'tidal-shield':['water','A shield of water.'],
 'starlight-armor':['light','Armour of starlight.'],
 'terrain-shield':['earth','A shield of the terrain itself.'],
 'inked-panoply':['force','Magical inked armour, not a metal shield.'],
 'cautious-word':['force','A protective word; a ward, not a metal shield.'],
 'defensive-growth':['vines','A grown defence.'],
 'blood-shield':['drain','A shield drawn from your own blood.'],
};
// Vocal activities: only the source's own roar, howl, song or shout is audible.
function vocalProfile(feat,text){
 const name=feat.name.toLowerCase();
 // Name, or the source's own first-person vocal act ("you roar in defiance").
 // Names may use any form; descriptions need a finite verb ("you roar") or a voiced
 // noun phrase ("with a mighty shout"). Participles ("howling winds") never count.
 const own=(names,verbs,nouns)=>new RegExp(`\\b(?:${names})\\b`).test(name)||new RegExp(`\\byou\\s+(?:\\w+\\s+){0,2}(?:${verbs})\\b`,'i').test(text)||
  new RegExp(`\\b(?:with|let out|lets out|unleash|unleashes|give|gives)\\s+an?\\s+(?:[\\w-]+\\s+){0,2}(?:${nouns})\\b`,'i').test(text);
 if(own('sing|sings|song|songs|music|musical|melody|melodious|chant|lullaby|tune','sing|sings|chant|chants','song|chant|tune|melody'))return ['song','The source sings or plays; musical flourish.'];
 if(/dragon/.test(name)&&own('roar|roars|bellow','roar|roars|bellow|bellows','roar|bellow'))return ['dragonRoar','Draconic roar from the source.'];
 if(own('howl|howls|howling','howl|howls','howl'))return ['howl','The source howls; one howl cue.'];
 if(own('growl|growls|snarl|snarls|snarling|yowl|caterwaul','growl|growls|snarl|snarls','growl|snarl|yowl'))return ['growl','The source growls or snarls; one growl cue.'];
 if(own('shriek|shrieks|wail|wails|wailing|scream|screams|moan|moans','shriek|shrieks|wail|wails|scream|screams|moan|moans','shriek|wail|scream|moan'))return ['wail','The source shrieks or wails; one eerie vocal cue.'];
 if(own('roar|roars|bellow|shout|shouts|yell|war cry|battle cry','roar|roars|bellow|bellows|shout|shouts|yell|yells','roar|bellow|shout|yell|war ?cry|battle ?cry|rallying cry'))return ['battleCry','The source roars or shouts aloud; one battle-cry cue.'];
 return null;
}
export function featSoundDirection(feat){
 const text=feat.plainDescription??'',d=feat.direction??{},motif=feat.motif;
 const choose=(profile,reason)=>({profile,reason,descriptionChars:text.length,descriptionHash:feat.descriptionHash});
 if(!text)return choose('','No full description available.');
 if(FEAT_SOUND_OVERRIDES[feat.slug])return choose(...FEAT_SOUND_OVERRIDES[feat.slug]);
 if(['distracting-toss','rebounding-toss'].includes(feat.slug))return choose('physicalToss','Complete description throws a configurable weapon; neutral physical release and per-contact cues follow its actual flight and rebound, not a bow shot or recipient throw.');
 if(['friendly-fling','friendly-toss','jotuns-boost'].includes(feat.slug))return choose('allyHeave','Complete description physically lifts and throws a willing ally. A short movement whoosh follows the source preparation; no music, spell or weapon-impact sound is inferred.');
 if(feat.slug==='feral-toss')return choose('naturalPierce','One horn, antler or tusk contact; the conditional push is silent and never treated as another attack.');
 if(feat.slug==='whirlwind-toss')return choose('unarmed','Thrash contacts, including collateral victims, receive physical contact cues; the subsequent optional victim throw is not another Strike.');
 if(feat.slug==='wind-tossed-spell')return choose('wind','Source wind prepares the next spell; its later attack has separate audio.');
 const hushed=feat.traits.includes('subtle')||!martial.has(motif)&&/silent|silence|quiet|stealth|sneak|conceal|whisper/i.test(feat.name)||/\b(?:deadly|complete|absolute)\s+silence\b|\b(?:moves?|attacks?)\s+(?:and\s+attacks?\s+)?silently\b/i.test(text);
 // A damaging sonic roar keeps its sonic shockwave rather than a plain voice.
 // Likewise any audible elemental manifestation keeps its element cue.
 const sonicBlast=['elementTarget','elementAura','elementCone','elementBolt','lineCue','ray'].includes(motif)&&!!elementProfiles[feat.theme];
 const vocal=!hushed&&!sonicBlast&&!martial.has(motif)&&!physical.has(motif)&&vocalProfile(feat,text);
 if(vocal)return choose(...vocal);
 if(hushed||['concealment','perception','utility','fortune','focus','gaze','preparation','command','performance','display','craft','taunt','inspiration'].includes(motif))return choose('','Quiet, player-chosen or uncertain activity; no public sound is inferred. Choose a sound in Customize.');
 if(feat.slug==='clear-the-way')return choose('','Complete description attempts Shove maneuvers, then movement; no weapon Strike or blade-cut contact is performed.');
 if(feat.slug==='twin-shot-knockdown')return choose('ranged','Complete description makes two ranged Strikes with crossbows or firearms, rather than two melee blade contacts. Neutral release preserves the selected weapon.');
 if(feat.slug==='writhing-runelord-weapon')return choose('spear','Complete description requires a polearm or spear and two Strikes. A long-hafted contact cue replaces unrelated shortsword cuts.');
 if(feat.slug==='running-reload')return choose('','Reload type depends on the wielded weapon. Choose its reload sound in Customize; no gunshot inferred.');
 if(motif==='restorativeStrike')return choose('restorativeStrike','Complete description restores the source before one melee Strike. Healing and physical contact receive distinct phase cues; optional ally healing is not inferred as another blow.');
 if(martial.has(motif)&&d.contacts?.count!==0){
  let weapon=String(d.weapon??'').toLowerCase();
  if(!weapon||weapon==='as described'){
   if(/(?:make|making|attempt|perform)\s+(?:an?\s+|two\s+|three\s+)?unarmed\s+(?:strikes?|attacks?)/i.test(text)||/unarmed contacts/i.test(d.approach??'')||/\bunarmed attacks?\b/i.test(text)&&!/\bweapon\b/i.test(text))weapon='unarmed';
  }
  // Bites, horns and antlers pierce; a weapon-or-unarmed Strike sounds like the weapon; whips, flails, spears and daggers keep their own.
  const result=choose(/kick/.test(feat.slug)?'kick':/claw|talon/.test(weapon)||!weapon&&/\b(?:claw|talon) Strike/i.test(text)?'claw':/jaw|fang|\bbite|horn|antler|tusk/.test(weapon)?'naturalPierce':/-or-unarmed/.test(weapon)?'sword':/^lash$|whip/.test(weapon)?'whip':/unarmed|fist|^body$/.test(weapon)||motif==='unarmed'?'unarmed':/shield bash/.test(weapon)?'shieldStrike':/^flail$/.test(weapon)?'flail':/^spear|harpoon|jousting|lance/.test(weapon)?'spear':/^dagger$/.test(weapon)?'dagger':/hammer|club|staff|bludgeon|improvised/.test(weapon)?'club':'sword','Full description and reviewed contact sequence indicate physical attacks. Each authored contact receives its own cue; generic melee follows the blade artwork and can be customized for the wielded weapon.');
  // Elemental Strike feats (native element trait) add one element finish to the contact.
  const element=featElement(feat);
  if(element&&!['spellstrike'].includes(motif)){result.element=element;result.reason+=` Native ${element} trait adds one elemental finish at the first contact.`;}
  return result;
 }
 if(['firearm','alchemicalShot'].includes(motif))return /(?:firearm.*crossbow|crossbow.*firearm)/i.test(d.weapon??'')||/\bfirearm\b/i.test(text)&&/\bcrossbow\b/i.test(text)?choose('ranged','Firearm or crossbow permitted; neutral release avoids assuming the chosen weapon. Customize for its discharge.'):choose('firearm','Explicit firearm discharge, synchronized to release.');
 if(motif==='mixedStrike')return choose('mixed','Reviewed mixed melee/ranged attacks; neutral release plus physical contact avoids guessing a wielded gun or bow.');
 if(['ranged','throughShot'].includes(motif)){
  const weapon=String(d.weapon??'').toLowerCase();
  const profile=/\bor\b/.test(weapon)?'ranged':/\b(?:gun|firearm|bullet|pistol|musket|rifle)\b/.test(weapon)?'firearm':/\bblowgun\b/.test(weapon)?'blowgun':/\b(?:crossbow|ballista)\b/.test(weapon)?'crossbow':/\b(?:bow|arrow)\b/.test(weapon)?'bow':/\bsling\b/.test(weapon)?'sling':/^thrown$/.test(weapon)?'thrown':/light mortar/i.test(text)?'bomb-explosive':'ranged';
  return choose(profile,'Reviewed ranged attack; exact weapon boundaries preserve blowgun/crossbow identity. Player-choice alternatives use a neutral release cue.');
 }
 if(motif==='boomerang'&&feat.theme==='wind')return choose('wind','Description creates a blade of shearing wind; no wooden boomerang is thrown.');
 if(['boomerang','bombThrow'].includes(motif))return choose(motif==='bombThrow'?'bomb':'thrown','Description explicitly throws an object; finite release cue.');
 if(motif==='medicine')return choose('','Mundane wound treatment: no magical healing tone or heartbeat is inferred.');
 if(motif==='shield'||motif==='guard'&&/\b(?:your|a|the) shield\b|Shield Block/i.test(text)&&!featElement(feat))return choose(d.contacts?.count>0?'shieldStrike':/\b(?:raise|equip)\b/i.test(text)&&!/^shield-block$/.test(feat.slug)?'shieldRaise':'shield',d.contacts?.count>0?'Description makes an outgoing shield Strike; contact follows its blow.':'Physical shield is raised or intercepts a blow, following its reviewed action.');
 if(motif==='counteract')return choose('dispel','Description and reviewed design counteract magic.');
 if(motif==='teleport')return choose('teleport','Explicit spatial departure/arrival.');
 if(['restoration','healing','waterHeal','restorativeStrike'].includes(motif))return /\b(?:regains?|restores?|restored to|recovers?|heals?|healed)\b[^.]{0,60}\b(?:hit points?|HP)\b|\bfast healing\b|\bversion of Heal\b|\bheal(?:s|ed|ing)?\s+(?:you|yourself|the|a|an|your|each|all|that|this|target|it|them|allies|ally)\b|\b(?:return|returns|bring|brings)\b[^.]{0,30}\bto life\b|\brevive/i.test(text)?choose('healing','Description explicitly restores hit points or life through a magical effect.'):choose('','Removes or reduces a condition without restoring hit points; no healing chime is inferred.');
 if(['elementTarget','elementAura','elementCone','elementBolt','flamePath','waveGuard','lineCue','ray','phoenix'].includes(motif))return choose(elementProfiles[feat.theme]??'','Reviewed elemental manifestation; optional finite elemental cue.');
 if(elementalActs.has(motif)&&featElement(feat))return choose(featElement(feat),'Native element trait: the activity manifests its element audibly; one finite elemental cue.');
 return choose('','No reliable audible action in the complete description; silent by design.');
}
export function weaponSoundDirection(weapon,mode){
 const construction=(weapon.base+' '+weapon.name+' '+(weapon.plainDescription??'').split(/Activate|Frequency|Critical Hit/i)[0]).toLowerCase();
 const nativeType=choices=>choices.map(([pattern,profile])=>({index:construction.search(pattern),profile})).filter(r=>r.index>=0).sort((a,b)=>a.index-b.index)[0]?.profile;
 if(mode.group==='bomb'){
  const payload=mode.payload??{},material=payload.style==='pressure'?'pressure':payload.style==='thorns'?'thorns':payload.style==='spores'?'spores':payload.element==='water'?'water':payload.style==='shrapnel'?'explosive':payload.fracture?'fracture':'soft';
  return {profile:'bomb-'+material,reason:`Native ${payload.style??'bomb'} payload selects ${material} audio; a soft bladder, plant sack or foam is not assumed to break like pottery. ${mode.rationale}`,descriptionChars:weapon.descriptionChars,descriptionHash:weapon.descriptionHash};
 }
 if(mode.mode==='ranged'&&mode.family==='bow')return {profile:nativeType([[/crossbow/,'crossbow'],[/long[- ]?bow/,'longbow'],[/short[- ]?bow/,'shortbow']])??'bow',reason:'Native bow construction selects its matching draw/release; unspecified bows keep a neutral bow cue.',descriptionChars:weapon.descriptionChars,descriptionHash:weapon.descriptionHash};
 // Air repeaters fire pressurized air, never black powder (Dezullon Fountain is one).
 if(mode.mode==='ranged'&&(mode.family==='airgun'||mode.family==='firearm'&&/air[- ]repeater/.test(construction)))return {profile:'blowgun',reason:'Pressurized-air repeater: pneumatic dart release, no black-powder discharge.',descriptionChars:weapon.descriptionChars,descriptionHash:weapon.descriptionHash};
 if(mode.mode==='ranged'&&mode.family==='dart'&&/\bsling\b/.test(construction))return {profile:'sling',reason:'Dart sling: sling release rather than a hand-thrown knife.',descriptionChars:weapon.descriptionChars,descriptionHash:weapon.descriptionHash};
 if(mode.mode==='ranged'&&mode.family==='firearm')return {profile:nativeType([[/arquebus/,'arquebus'],[/musket/,'musket'],[/pistol/,'pistol']])??'firearm',reason:'Native firearm construction selects arquebus, musket or pistol discharge when explicit; other firearms use a neutral black-powder cue.',descriptionChars:weapon.descriptionChars,descriptionHash:weapon.descriptionHash};
 const equivalents={rapier:'rapier',shortsword:'sword',katana:'katana',butterflysword:'sword',sickle:'sword',scimitar:'sword',falchion:'greatsword',handaxe:'axe',greataxe:'axe',quarterstaff:/\b(?:iron|steel|metal)\b/.test(construction)?'ironStaff':'staff',greatclub:'hammer',glaive:/^(?:longspear|trident)$/.test(weapon.base)?'spear':'polearmBlade',pick:'axe',vial:/unholy/.test(construction)?'bomb-void':'bomb-vitality',halberd:'polearmBlade',scythe:'polearmBlade',mace:'club',claw:'claw',maul:'hammer',warhammer:'hammer',javelin:'spear',dart:/harpoon/.test(construction)?'thrownSpear':'thrownDagger',chakram:mode.mode==='melee'?'sword':'thrown',shieldThrow:'thrown',projectile:'ranged',airgun:'blowgun',spike:'thrownSpear',spittle:elementProfiles[mode.element]??'force',shield:'shieldStrike',contact:/javelin/.test(construction)?'spear':'dagger'};
 const family=equivalents[mode.family]??(['flask','bomb'].includes(mode.family)?'bomb':mode.family==='polearm'?'spear':mode.family);
 return {profile:mode.mode==='thrown'&&family==='axe'?'thrownAxe':mode.mode==='thrown'&&!['bomb','spear','dagger','shuriken','boomerang','thrownDagger','thrownSpear','bomb-vitality','bomb-void'].includes(family)?'thrown':family,reason:`${mode.mode} ${family} cue follows native usage and physical construction. ${mode.rationale}`,descriptionChars:weapon.descriptionChars,descriptionHash:weapon.descriptionHash};
}
