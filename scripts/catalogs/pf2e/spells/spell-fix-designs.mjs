// 2026-10 audit fixes. Each design was checked against the native description;
// shared clusters (shields, divination scans, polymorph silhouettes, departure
// shimmers, conjuration circles) are split only where the fiction differs.
const motif=(label,pattern,roots={},extra={})=>({label,pattern,...roots,...extra});
const colorize=tint=>({tintEnabled:true,colorize:true,tint});

export const FIX_SPELL_MOTIFS={
 // Real wards keep a shield, in their element.
 wardFire:motif('Fire ward raised','shield',{hit:'shield_themed.above.fire.01.orange,shield_themed.above.fire.03.orange',aura:'shield_themed.below.fire.01.orange,fire_ring'},{slotThemes:{hit:'fire',aura:'fire'},stageLabels:{'Force shield':'Fire ward'}}),
 wardIce:motif('Ice ward raised','shield',{hit:'shield_themed.above.ice,shield.01.intro',aura:'shield_themed.below.ice,ice_spikes.radial.loop'},{stageLabels:{'Force shield':'Ice ward'}}),
 wardEarth:motif('Earthen ward raised','shield',{hit:'shield_themed.above.molten_earth,shield.01.intro',aura:'shield_themed.below.molten_earth,ground_cracks'},{stageLabels:{'Force shield':'Earthen ward'}}),
 // Not wards: the former "Force shield raised" defaults.
 fixDismantle:motif('Object comes apart into components','fix:dismantle',{cast:'cast_shape',hit:'shatter',aura:'particles.outward'}),
 fixIceEncase:motif('Target frozen in stabilizing ice','fix:iceEncase',{hit:'ice_spikes.radial.burst',aura:'ice_spikes.radial.loop'}),
 fixAttire:motif('Attire reshapes with a stylish shimmer','fix:attire',{cast:'swirling_sparkles',hit:'shimmer',aura:'glint'}),
 fixDisguise:motif('Illusory guise changes the appearance','fix:disguise',{hit:'shimmer',aura:'markers.on_token_mask.complete.01'}),
 fixFeatherGuise:motif('Illusory feathered guise','fix:disguise',{hit:'shimmer',aura:'swirling_feathers.outburst'},{stageLabels:{'Illusory guise':'Illusory feathers'}}),
 fixArmorStow:motif('Armor whisked into extradimensional storage','fix:armorStow',{hit:'shimmer',aura:'portals.vertical.ring'}),
 fixLifeBubble:motif('Bubble of fresh air surrounds the target','fix:lifeBubble',{cast:'wind_lines',hit:'bubble.001.001.complete',aura:'bubble.001.001.loop'}),
 fixGhostRiver:motif('Ghostly river flows from the caster','fix:ghostRiver',{cast:'glint',hit:'water_splash.circle',aura:'liquid.blob'}),
 fixForceHand:motif('Disembodied hand of force guards the caster','fix:forceHand',{hit:'arcane_hand',aura:'energy_field'},{assetIntent:'force hand'}),
 fixBladeWall:motif('Churning wall of force blades','fix:bladeWall',{cast:'glint',hit:'cloud_of_daggers.daggers',aura:'energy_field'}),
 fixWeakPoint:motif('Weak point marked on the foe','fix:weakPoint',{hit:'hunters_mark.pulse',aura:'glint'}),
 fixShockWeapon:motif('Electric current runs through the weapon','fix:shockWeapon',{cast:'static_electricity',hit:'static_electricity',aura:'glint'}),
 fixWeave:motif('Fibers weave into a simple object','fix:weave',{hit:'swirling_leaves',aura:'vine.complete.nature'}),
 fixMagnetRepel:motif('Metal shudders away from the caster','fix:magnetRepel',{hit:'aura_themed.01.outward.complete.metal',aura:'glint'}),
 // Divination split by the sense actually granted.
 senseHearing:motif('Distant sounds gather','scan',{hit:'soundwave.01',aura:'soundwave.02'},{stageLabels:{'Focus perception':'Attune hearing','Arcane scan':'Distant sounds gather','Reading runes':'Listening ripples'}}),
 senseSensor:motif('Scrying sensor eye opens','scan',{hit:'eyes.01.dark_green.single',aura:'magic_signs.circle.02.divination'},{stageLabels:{'Arcane scan':'Scrying sensor opens','Reading runes':'Sensor focus'},stageTweaks:{'Arcane scan':{scale:.65,offsetY:-.35,opacity:.85}}}),
 senseDark:motif('Eyes adapt to darkness','scan',{hit:'eyes.01.dark_green.single',aura:'shimmer'},{stageLabels:{'Arcane scan':'Eyes darken','Reading runes':'Dark vision settles'},stageTweaks:{'Arcane scan':{scale:.55,offsetY:-.15,opacity:.9,...colorize('#1b1720')},'Reading runes':{opacity:.25}}}),
 senseHeat:motif('Heat-sensing eyes glow','scan',{hit:'eyes.01',aura:'detect_magic.circle'},{stageLabels:{'Arcane scan':'Heat-sensing eyes','Reading runes':'Heat outlines'},stageTweaks:{'Arcane scan':{scale:.55,offsetY:-.15,...colorize('#ff8a3d')},'Reading runes':colorize('#ff7a2e')}}),
 sensePoison:motif('Poison revealed','scan',{hit:'icon.poison.dark_green',aura:'detect_magic.circle'},{stageLabels:{'Arcane scan':'Poison revealed','Reading runes':'Toxin search'},stageTweaks:{'Arcane scan':{scale:.5,offsetY:-.2},'Reading runes':colorize('#7fbf4a')}}),
 senseMetal:motif('Metal resonance','scan',{hit:'detect_magic.circle',aura:'glint'},{stageLabels:{'Arcane scan':'Metal resonance','Reading runes':'Metal glints'},stageTweaks:{'Arcane scan':colorize('#c0c0c8'),'Reading runes':{scale:.6,below:false,...colorize('#d8d8e0')}}}),
 senseGrowth:motif('Sensing threads spread through the ground','scan',{hit:'swirling_leaves.complete.01.green',aura:'detect_magic.circle'},{stageLabels:{'Arcane scan':'Threads spread outward','Reading runes':'Sensing threads'},stageTweaks:{'Reading runes':colorize('#8fbf5a')}}),
 senseEarth:motif('Vibrations read through the ground','scan',{hit:'ground_cracks',aura:'detect_magic.circle'},{stageLabels:{'Arcane scan':'Vibrations read','Reading runes':'Tremor ripples'},stageTweaks:{'Arcane scan':{below:true,opacity:.45},'Reading runes':colorize('#c9a26b')}}),
 blindEye:motif('Object sealed against observation','scan',{hit:'eyes.01.dark_green.single',aura:'shimmer'},{stageLabels:{'Focus perception':'Seal the object','Arcane scan':'Observation sealed','Reading runes':'Scrying turned aside'},stageTweaks:{'Arcane scan':{scale:.5,opacity:.8,...colorize('#1b1720')}}}),
 bloodDuplicate:motif('Blood shapes a duplicate object','scan',{hit:'liquid.splash02',aura:'shimmer'},{stageLabels:{'Focus perception':'Draw blood','Arcane scan':'Blood shapes a duplicate','Reading runes':'Duplicate takes form'},stageTweaks:{'Arcane scan':{scale:.6},'Reading runes':colorize('#b73345')}}),
 spiritDefense:motif('Protective spirits surround the ally','scan',{hit:'spirit_guardians',aura:'spirit_guardians'},{stageLabels:{'Focus perception':'Entreat the spirits','Arcane scan':'Protective spirits gather','Reading runes':'Spirits circle the ally'}}),
 auraDisguise:motif('Magical aura disguised','scan',{hit:'detect_magic.circle',aura:'shimmer'},{stageLabels:{'Arcane scan':'Aura masked','Reading runes':'Aura disguised'}}),
 fixTrail:motif('Faint glowing trail','fix:trail',{cast:'glint',hit:'dancing_light',aura:'glint'}),
 // Mental cluster outliers.
 fixAllegro:motif('Quickening refrain','fix:allegro',{cast:'music_notations',hit:'wind_lines.01.01',aura:'swirling_sparkles'}),
 fixKillWord:motif('A word of death','fix:killWord',{cast:'soundwave.02',hit:'icon.skull',aura:'soundwave.01'}),
 fixRoarBuff:motif('Predatory aura and thundering roar','fix:roarBuff',{cast:'soundwave.02',hit:'soundwave.01',aura:'energy_field'}),
 fixBrainDrain:motif('Memories drawn from the mind','fix:brainDrain',{cast:'cast_shape',hit:'shatter',bolt:'energy_strands.range.standard',aura:'magic_signs.rune.divination.complete'}),
 // Polymorph silhouettes tinted by form family.
 formAerial:motif('Feathered transformation silhouette','form',{hit:'energy_field',aura:'swirling_feathers.outburst'},{tint:'#cfe8ff',stageLabels:{'Afterimage wisps':'Feathers scatter'}}),
 formBeast:motif('Bestial transformation silhouette','form',{hit:'energy_field',aura:'claws.200px.brown,claws'},{tint:'#9a7b4f',stageLabels:{'Afterimage wisps':'Claws and hide emerge'}}),
 formPlant:motif('Verdant transformation silhouette','form',{hit:'energy_field',aura:'swirling_leaves'},{tint:'#7fa64a',stageLabels:{'Afterimage wisps':'Leaves and bark gather'}}),
 formMetal:motif('Metallic transformation silhouette','form',{hit:'energy_field',aura:'aura_themed.01.inward.complete.metal.01.grey'},{tint:'#b8bcc4',stageLabels:{'Afterimage wisps':'Metal plates close'}}),
 formStone:motif('Stony transformation silhouette','form',{hit:'energy_field',aura:'falling_rocks.top'},{tint:'#a08a6a',stageLabels:{'Afterimage wisps':'Stone settles'}}),
 formFey:motif('Fey transformation silhouette','form',{hit:'energy_field',aura:'butterflies'},{tint:'#f0b8e8',stageLabels:{'Afterimage wisps':'Fey motes swirl'}}),
 formShadow:motif('Shadowy transformation silhouette','form',{hit:'energy_field',aura:'smoke.puff.centered'},{tint:'#4e3f5e',stageLabels:{'Afterimage wisps':'Shadow wisps'}}),
 formWater:motif('Aquatic transformation silhouette','form',{hit:'energy_field',aura:'bubble'},{tint:'#7fc3e6',stageLabels:{'Afterimage wisps':'Water bubbles'}}),
 // Teleport scale: object-sized transfers and planar gates.
 portalItem:motif('Small object blinks away','portal',{hit:'misty_step',aura:'portals'},{stageLabels:{'Prepare departure':'Object focus','Departure shimmer':'Object blinks away'},stageTweaks:{'Prepare departure':{scale:.4},'Departure shimmer':{scale:.45}},dropStages:['Departure echo']}),
 planarGate:motif('Planar gate opens','gate',{hit:'portals.vertical.vortex,portals.vertical.ring',aura:'portals'},{stageLabels:{'Departure gate':'Planar gate opens'},stageTweaks:{'Departure gate':{scale:2.6,below:false}},dropStages:['Departure echo']}),
 // Summons differentiated like Giant/Celestial/Dragon/Fiend.
 summonAnimal:motif('Conjuration circle with animal claws','fix:summon',{aura:'magic_signs.circle.02.conjuration',hit:'portals.horizontal.ring',area:'claws.200px.brown,claws'},{summonTint:'#8fbf6a',accent:'Animal claws flash',accentExtra:{scale:.8}}),
 summonConstruct:motif('Conjuration circle with metal gears','fix:summon',{aura:'magic_signs.circle.02.conjuration',hit:'portals.horizontal.ring',area:'aura_themed.01.orbit.complete.metal'},{summonTint:'#b8bcc4',accent:'Metal parts orbit',accentExtra:{scale:.9}}),
 summonFey:motif('Conjuration circle with fey motes','fix:summon',{aura:'magic_signs.circle.02.conjuration',hit:'portals.horizontal.ring',area:'butterflies'},{summonTint:'#f0b8e8',accent:'Fey motes flutter',accentExtra:{scale:1}}),
 summonPlant:motif('Conjuration circle with leaves','fix:summon',{aura:'magic_signs.circle.02.conjuration',hit:'portals.horizontal.ring',area:'swirling_leaves'},{summonTint:'#8fbf5a',accent:'Leaves and spores swirl',accentExtra:{scale:1}}),
 summonUndead:motif('Conjuration circle with a grave sign','fix:summon',{aura:'magic_signs.circle.02.conjuration',hit:'portals.horizontal.ring',area:'icon.skull'},{summonTint:'#8a7a9e',accent:'Grave sign rises',accentExtra:{scale:.5,offsetY:-.35}}),
 summonInstrument:motif('Conjuration circle with music','fix:summon',{aura:'magic_signs.circle.02.conjuration',hit:'portals.horizontal.ring',area:'music_notations'},{accent:'Instrument notes ring',accentExtra:{scale:.6,offsetY:-.35}}),
 summonServitor:motif('Conjuration circle with a planar star','fix:summon',{aura:'magic_signs.circle.02.conjuration',hit:'portals.horizontal.ring',area:'twinkling_stars'},{summonTint:'#e8d7a0',accent:'Planar servitor star',accentExtra:{scale:.8}}),
 // Individual description fixes.
 fixMoisture:motif('Water drawn into a floating droplet','fix:moisture',{cast:'water_splash.circle',hit:'liquid.splash',aura:'liquid.blob'}),
 fixGravityPull:motif('Gravity pulls the target toward the caster','fix:gravityPull',{hit:'energy_field',aura:'energy_strands.complete'}),
 fixFlense:motif('Flesh stripped from the bones','fix:flense',{cast:'cast_generic',hit:'claws',aura:'liquid.splash02'},{theme:'blood'}),
 fixGrowths:motif('Extra limbs and eyes erupt','fix:growths',{hit:'liquid.splash02',aura:'eyes.01'},{theme:'blood'}),
 fixTwinTrees:motif('Trees of life and death rise','fix:twinTrees',{cast:'cast_generic',hit:'plant_growth.03.round.4x4',aura:'plant_growth.03.round.4x4'}),
 fixVapor:motif('Body disperses into vapor','fix:vapor',{hit:'smoke.puff.centered',aura:'shimmer'}),
 fixAirWalk:motif('Air firms beneath the feet','flight',{cast:'wind_lines.01.01',hit:'wind_lines.01.01',aura:'gust_of_wind'}),
 fixAirBlast:motif('Single outward air blast','fix:airBlast',{cast:'wind_lines',area:'thunderwave.center',aura:'wind_lines'},{nativeArea:true}),
 fixFetters:motif('Ghostly manacles fly and clasp','fetters',{cast:'glint',bolt:'energy_beam',hit:'markers.chain.spectral_standard.complete.02'},{stageLabels:{'Bonds clasp':'Manacles clasp'}}),
 fixMetalShot:motif('Launched metal fragment','missile',{cast:'glint',bolt:'dart.01.throw,arrow.physical.white',hit:'impact.009',aura:'glint'},{stageTweaks:{'Missile contact':colorize('#d6d6d6')}}),
 fixMetalNeedles:motif('Three metal needles','needles',{cast:'glint',bolt:'dart,arrow',hit:'impact.009'},{stageTweaks:{'Needle contacts':colorize('#d6d6d6')}}),
 fixAquaticSwarm:motif('Predators circle in churning water','swarm',{hit:'water_splash.circle,liquid.splash',area:'water_splash.circle,liquid.splash',aura:'bubble'}),
 // Fire-tinted restoration: purifying or cauterizing flame, not a green bloom.
 fixFlameHeal:motif('Purifying flames mend','restore',{cast:'cast_generic.fire',hit:'healing_generic.03.burst.yellow,healing_generic.200px.yellow,flames.orange',aura:'flames.orange,particles.outward.orange,impact.fire'},{slotThemes:{cast:'fire',hit:'fire',aura:'fire'},stageLabels:{'Channel vitality':'Kindle purifying flame','Vitality bloom':'Flames wrap the target','Rising vital sparks':'Cleansing embers rise','Vitality pulse':'Warmth settles'}}),
 fixMagmaForm:motif('Body becomes molten lava','form',{cast:'cast_generic.fire',hit:'lava_spout.001.001.complete.orangeyellow,flames.orange',aura:'flames.orange,particles.outward.orange,ground_cracks.orange'},{slotThemes:{cast:'fire',hit:'fire',aura:'fire'},stageLabels:{'Change silhouette':'Heart of magma ignites','Shimmer':'Lava wells up','Afterimage wisps':'Molten embers'}}),
 fixCometCharge:motif('Blazing comet charge','combatLeap',{cast:'cast_generic.fire',hit:'impact.fire.01.orange,explosion.01.orange',aura:'flames.orange,particles.outward.orange'},{slotThemes:{cast:'fire',hit:'fire',aura:'fire'},stageLabels:{'Elemental power gathers':'Comet ignites','Melee contact':'Comet impact'}}),
 fixFlockSwarm:motif('Flock of birds descends','swarm',{hit:'swirling_feathers.outburst',area:'swirling_feathers.outburst',aura:'particles'}),
};

const DESIGNS={
 dismantle:['fixDismantle','The object comes apart into its components; no shield is raised.'],
 cryostasis:['fixIceEncase','The target freezes solid in stabilizing ice.'],
 'befitting-attire':['fixAttire','Illusory attire reshapes with a stylish shimmer.'],
 fashionista:['fixAttire','Clothing becomes high fashion with a shimmer and glints.'],
 'illusory-disguise':['fixDisguise','A shimmer and mask cue show the illusory change of appearance.'],
 'tricksters-feathers':['fixFeatherGuise','A shimmering illusory feathered guise; no hard-light shield.'],
 'instant-armor':['fixArmorStow','Armor shimmers into a small extradimensional pocket instead of a raised shield.'],
 'lashuntas-life-bubble':['fixLifeBubble','A bubble of fresh air forms around the target.'],
 'lifes-flowing-river':['fixGhostRiver','Ghostly water wells up beside the caster and flows outward along the river path.'],
 'forceful-hand':['fixForceHand','A disembodied hand of force appears beside the caster.'],
 'blade-barrier':['fixBladeWall','Churning force blades form the wall; its exact line placement remains manual.'],
 'conductive-weapon':['fixShockWeapon','Electric current courses through the weapon; it is not a shield.'],
 'weave-wood':['fixWeave','Plant fibers unravel and weave into a simple object.'],
 'magnetic-repulsion':['fixMagnetRepel','Metal near the caster is pushed away by magnetism.'],
 'glimpse-weakness':['fixWeakPoint','The foe\'s weak point is marked; nothing shields the caster.'],
 'glowing-trail':['fixTrail','A faint glowing path trails behind the caster; this is not a divination scan.'],
 'blind-eye':['blindEye','An object is sealed against magical observation.'],
 'blood-duplicate':['bloodDuplicate','Blood drawn from the caster shapes a duplicate object.'],
 'defended-by-spirits':['spiritDefense','Protective spirits surround the ally against one foe.'],
 'disguise-magic':['auraDisguise','A magical aura is masked rather than revealed.'],
 allegro:['fixAllegro','A quick refrain and rushing air show the ally becoming quickened; no mental-damage jolt.'],
 'power-word-kill':['fixKillWord','A single deadly word lands with a large death sign.'],
 'thundering-dominance':['fixRoarBuff','The companion gains a predatory aura and an amplified roar; it is not attacked.'],
 'brain-drain':['fixBrainDrain','Memories are torn loose and flow to the caster as knowledge, not life force.'],
 'reclined-apport':['portalItem','An object-sized blink, not a creature teleport.'],
 fetch:['portalItem','An object-sized blink, not a creature teleport.'],
 'far-flung-fetch':['portalItem','An object-sized blink, not a creature teleport.'],
 'magic-mailbox':['portalItem','An object-sized blink, not a creature teleport.'],
 'thoughtful-gift':['portalItem','An object-sized blink, not a creature teleport.'],
 'trade-items':['portalItem','An object-sized blink, not a creature teleport.'],
 gate:['planarGate','A large planar gate opens.'],
 'forest-of-gates':['planarGate','Large planar gates open.'],
 'space-fold-gate':['planarGate','A large folded-space gate opens.'],
 'summon-animal':['summonAnimal','A green-tinted conjuration circle with a claw flourish signals an animal; the creature is placed separately.'],
 'summon-construct':['summonConstruct','A metallic conjuration circle with orbiting metal signals a construct; the creature is placed separately.'],
 'summon-fey':['summonFey','A pink-tinted conjuration circle with fey motes; the creature is placed separately.'],
 'summon-plant-or-fungus':['summonPlant','A green conjuration circle with swirling leaves; the creature is placed separately.'],
 'summon-undead':['summonUndead','A pale conjuration circle with a grave sign; the creature is placed separately.'],
 'summon-instrument':['summonInstrument','A conjuration circle with musical notes; the instrument appears in hand.'],
 'summon-lesser-servitor':['summonServitor','A conjuration circle with a planar star; the servitor is placed separately.'],
 'draw-moisture':['fixMoisture','Water leaves the object and collects as a droplet in the caster\'s hand; no levitation.'],
 'gravitational-pull':['fixGravityPull','Gravity drags the target toward the caster.'],
 flense:['fixFlense','A touch strips flesh away; no weapon is involved.'],
 'grisly-growths':['fixGrowths','Extra limbs, organs and eyes erupt from the target; no weapon is involved.'],
 'tree-of-life-and-death':['fixTwinTrees','A living tree and a deathly tree rise apart from each other.'],
 'vapor-form':['fixVapor','The target disperses into vapor; no feathers.'],
 'air-walk':['fixAirWalk','Air firms beneath the target\'s feet.'],
 airburst:['fixAirBlast','A single outward blast of air.'],
 blastback:['fixAirBlast','A single outward blast of air.'],
 'magical-fetters':['fixFetters','Ghostly manacles fly to the target and clasp its limbs.'],
 'magnetic-acceleration':['fixMetalShot','A launched metal fragment with a neutral metallic contact.'],
 'needle-darts':['fixMetalNeedles','Three metal needles with neutral metallic contacts.'],
 'blood-in-the-water':['fixAquaticSwarm','Churning water and bubbles stand in for the aquatic predators.'],
 'bounty-of-the-sky':['fixFlockSwarm','Swirling feathers stand in for the descending birds.'],
 'cauterize-wounds':['fixFlameHeal','Wounds are sealed with fire; flame-tinted restoration.'],
 'cleansing-flames':['fixFlameHeal','Purifying flames wrap the target; flame-tinted restoration.'],
 'flame-barrier':['wardFire','A fiery shield of fire resistance.'],
 'mantle-of-the-magma-heart':['fixMagmaForm','The caster\'s body becomes lava; molten fire cues.'],
 'comet-charge':['fixCometCharge','A blazing comet rush with a fiery impact (chosen element shown as fire).'],
};
export const FIX_SPELL_DESIGNS=DESIGNS;

const ITEM_TELEPORTS=new Set(['reclined-apport','fetch','far-flung-fetch','magic-mailbox','thoughtful-gift','trade-items']);
// Rule-level refinement of generic cluster motifs (not used for authored designs).
export function refineSpellMotif(motif,{name='',traits=[],theme}={}){
 const n=name.toLowerCase();
 if(motif==='forceShield'){
  if(theme==='fire'||traits.includes('fire'))return 'wardFire';
  if(theme==='cold'||traits.includes('cold'))return 'wardIce';
  if(theme==='earth'||traits.includes('earth'))return 'wardEarth';
 }
 if(motif==='eye'){
  if(/clairaudience|\bhear(?:ing)?\b|\blisten/.test(n))return 'senseHearing';
  if(/darkvision/.test(n))return 'senseDark';
  if(/heat ?vision/.test(n))return 'senseHeat';
  if(/poison/.test(n))return 'sensePoison';
  if(/\bmetal\b/.test(n))return 'senseMetal';
  if(/fung|hyphae|root reading/.test(n))return 'senseGrowth';
  if(/tremorsense|stonesense/.test(n))return 'senseEarth';
  if(!/^detect/.test(n)&&(/scrying|clairvoyance|far sight/.test(n)||traits.includes('scrying')))return 'senseSensor';
 }
 if(motif==='form'){
  if(/aerial|bird|wing|feather/.test(n))return 'formAerial';
  if(/thorn|forest|plant|vine|wood|tree|nature|vibrant/.test(n)||traits.includes('plant')||traits.includes('wood'))return 'formPlant';
  if(/ferrous|metal|iron|leaden|steel/.test(n)||traits.includes('metal'))return 'formMetal';
  if(/stone|earth/.test(n))return 'formStone';
  if(/\bfey\b/.test(n))return 'formFey';
  if(/\bdark|devouring|shadow/.test(n))return 'formShadow';
  if(/\bfins?\b|ooze|hippocampus/.test(n))return 'formWater';
  if(/dinosaur|elephant|animal|beast|insect|mantis|monstrosity|moon|pest|apex|companion|untamed|claw|fang|snake|carapace|herd|frenzy|stripes/.test(n))return 'formBeast';
 }
 return motif;
}

// Small reviewed stage corrections for designs owned by shared motifs.
const STAGE_TWEAKS={
 'biting-words':{labels:{'Water jet':'Sonic words fly','Water splash':'Words strike','Water recoil':'Sonic recoil'}},
 'percussive-impact':{labels:{'Gather liquid':'Compress sound','Moving glob':'Sound sphere flies','Liquid splash':'Sonic burst'}},
 'call-of-the-grave':{stages:{'Focused ray':colorize('#7a9e4a'),'Ray impact':colorize('#7a9e4a')}},
 'chilling-darkness':{stages:{'Focused ray':colorize('#9fd6ff'),'Ray impact':colorize('#9fd6ff')}},
 'draw-ire':{stages:{'Mental stars':colorize('#e0483c')},labels:{'Mental stars':'Ire flares'}},
 'telepathic-demand':{stages:{'Message arrives':{opacity:.55,...colorize('#9b4dca')},'Reply fades':{opacity:.35,...colorize('#7a2fa8')}},labels:{'Message arrives':'Demand intrudes','Reply fades':'Compulsion lingers'}},
 'ash-cloud':{tint:'#8a8378'},
 'ashen-wind':{tint:'#8a8378'},
 'dust-storm':{tint:'#c7a77e',labels:{'Native material spreads':'Choking dust spreads'}},
 grease:{stages:{'Conjure slick':colorize('#6b4f2a')}},
 'angelic-halo':{stages:{'Halo healing emanation':{opacity:.5}}},
 'dragon-form':{tint:'#d9653b'},
 'living-thunderbolt':{stages:{'Afterimage wisps':{opacity:.75,scale:1.4}},labels:{'Afterimage wisps':'Living lightning crackles'}},
 'raise-dead':{stages:{'Vitality bloom':{scale:1.8,duration:2600},'Rising vital sparks':{scale:1.6,duration:2400,opacity:.85}},labels:{'Vitality bloom':'Life returns'}},
 'unblinking-flame-aura':{tint:'#ffb067'},
 'vicious-jealousy':{labels:{'Resentment threads turn away':'Ties to allies sever'}},
 'zero-gravity':{stages:{'Zero-gravity field forms':{opacity:.45},'Suspended weightless flecks':{opacity:.65}}},
 'acid-arrow':{stages:{'Lingering residue':{opacity:.45}}},
 // Nothing heals the caster: keep the returning strand, drop the healing loop.
 // The weapon theme's default aura is a floating spectral weapon; it is not a
 // fitting residue for bites, ritual cuts or worms.
 'blood-feast':{drop:['Lingering residue']},
 'mutilate':{drop:['Lingering residue']},
 'worms-repast':{drop:['Lingering residue']},
 'shadow-siphon':{drop:['Caster receives','Recovery pulse']},
 'defy-the-gods':{drop:['Caster receives','Recovery pulse']},
 // Native areas with no area stage (no template is placed for these casts).
 'necrotic-bomb':{stages:{'Single detonation':{kind:'aura',subject:'targets',auraRadius:10,scale:1,duration:5150}},labels:{'Single detonation':'Void blast fills the emanation'}},
 'final-sacrifice':{stages:{'Single detonation':{kind:'aura',subject:'targets',auraRadius:20,scale:1,duration:4200}},labels:{'Single detonation':'Minion explodes across 20 feet'}},
 'rolling-boulders':{stages:{'Stones called':{kind:'aura',subject:'source',auraRadius:10,scale:1}},labels:{'Stones called':'Boulders rise around the caster'}},
 'crystallized-vapors':{add:[['area','Icy pellets fill the emanation',-200,3200,{subject:'source',auraRadius:15,opacity:.8}]]},
 'pulverizing-wake':{add:[['aura','Sonic wake bursts from the struck creature',300,1400,{subject:'targets',auraRadius:15,below:false,opacity:.85}]]},
 'garden-of-death':{add:[['cast','Deadly garden spreads',900,5200,{subject:'source',auraRadius:40,opacity:.6}]]},
};

// Motif- and slug-level presentation: tint, labels, stage tweaks and drops.
export function applyFixStyle(spell,motifDef,layers,{fx,charge=0}={}){
 const tweak=STAGE_TWEAKS[spell.slug?.replace(/-legacy$/,'')]??{};
 // Reviewed area stages: an aura sized by auraRadius (feet) on the area's origin
 // token, for native emanations/bursts that place no template.
 if(fx&&tweak.add)layers=[...layers,...tweak.add.map(([slot,label,offset,duration,extra])=>fx('aura',slot,label,charge+offset,Math.max(duration,(spell.design?.mediaTiming?.[slot]?.duration??0)+(extra?.fadeOut??500)),{scale:1,below:true,fadeIn:250,fadeOut:500,...extra}))];
 const tint=tweak.tint??motifDef?.tint;
 const labels={...motifDef?.stageLabels,...tweak.labels};
 const stages={...motifDef?.stageTweaks,...tweak.stages};
 const drop=new Set([...(motifDef?.dropStages??[]),...(tweak.drop??[])]);
 if(!tint&&!Object.keys(labels).length&&!Object.keys(stages).length&&!drop.size)return layers;
 return layers.filter(s=>!drop.has(s.label)).map(s=>{
  let out={...s};
  if(tint&&s.kind!=='motion'&&s.kind!=='sprite'&&!s.tintEnabled)Object.assign(out,colorize(tint));
  if(stages[s.label])Object.assign(out,stages[s.label]);
  if(labels[s.label])out.label=labels[s.label];
  return out;
 });
}

// One-shot stages longer than ~9 s are sped up (never slowed), and near-
// invisible asset layers get a readable opacity floor.
export function capSpellStages(spell,layers){
 const timing=spell.design?.mediaTiming??{};
 return layers.map(s=>{
  if(['motion','sound'].includes(s.kind))return s;
  const out={...s};
  if(s.kind!=='sprite'&&(s.opacity??1)<.2)out.opacity=.25;
  const media=timing[s.mediaSlot??(['travel','projectile'].includes(s.kind)?'bolt':'hit')]?.duration??0;
  const exit=Math.max(s.fadeOut??0,s.scaleOutDuration??0,s.rotateOutDuration??0);
  if(s.kind==='sprite'||s.persist||(s.playbackRate??1)!==1||Math.max(s.duration,media+exit)<=9000)return out;
  if(!media){out.duration=8000;return out;}
  // Target about 8 s including the authored exit (fade/shrink).
  const rate=Math.min(3,Math.max(1.05,Math.ceil(media/Math.max(3000,8000-exit)*100)/100));
  out.playbackRate=rate;
  if(s.duration>=media/rate)out.duration=Math.ceil(media/rate+exit);
  return out;
 });
}

export function fixSpellLayers(spell,{cast,hit,aura,pose,copy,fx,track,charge,subject}){
 const d=spell.design,m=FIX_SPELL_MOTIFS[d?.motif];
 if(!m||!m.pattern.startsWith('fix:'))return null;
 switch(m.pattern){
  case 'fix:dismantle':return [cast('Loosen every fastening'),hit('Object comes apart',charge,1300,{scale:.9}),aura('aura','Components scatter',charge+350,1700,{opacity:.75,below:false}),pose('shake','Parts shudder loose',charge+100,600,'targets',.05,.35)];
  case 'fix:iceEncase':return [cast('Cold gathers'),hit('Ice encases the target',charge,1500,{scale:1.1}),copy('Frozen silhouette',charge+300,2600,{copies:1,copySpread:0,opacity:.4,tintEnabled:true,tint:'#bfe6ff'}),aura('aura','Stasis ice holds',charge+700,2200,{opacity:.6})];
  case 'fix:attire':return [cast('Style gathers'),hit('Attire reshapes',charge,1700,{opacity:.6,fadeIn:400,fadeOut:500}),aura('aura','Fashionable glints',charge+500,1500,{scale:.7,below:false,fadeOut:500})];
  case 'fix:disguise':return [cast('Bend appearance'),hit('Appearance shifts',charge,1600,{opacity:.55,fadeIn:400,fadeOut:500}),copy('Changed silhouette',charge+200,2200,{copies:1,copySpread:0,opacity:.3,tracks:[track('alpha',.3,0,1800,{delay:400})]}),aura('aura','Illusory guise',charge+600,1800,{scale:.6,offsetY:-.15,below:false,opacity:.8})];
  case 'fix:armorStow':return [cast('Call the stored armor'),hit('Armor shimmers away',charge,1600,{opacity:.6,scaleOut:.6,scaleOutDuration:1400}),aura('aura','Extradimensional pocket',charge+300,1500,{scale:.45,offsetX:.45,below:false,opacity:.7})];
  case 'fix:lifeBubble':return [cast('Fresh air gathers'),hit('Air bubble forms',charge,1600,{scale:1.15}),aura('aura','Breathable air holds',charge+700,1800,{opacity:.45,scale:1.15,below:false})];
  case 'fix:ghostRiver':return [cast('Call ghostly water'),hit('River wells up',charge,1500,{scale:1.2,...colorize('#bfe8ff')}),aura('aura','Ghostly current flows',charge+400,2000,{opacity:.55,...colorize('#bfe8ff'),tracks:[track('position.x',0,.8,1800)]})];
  case 'fix:forceHand':return [cast('Hand of force forms'),hit('Disembodied force hand',charge,2000,{scale:.9,offsetX:.65,scaleIn:.2,scaleInDuration:500}),aura('aura','Hand guards the caster',charge+600,1700,{opacity:.3,offsetX:.35})];
  case 'fix:bladeWall':return [cast('Blades of force gather'),hit('Churning force blades',charge,2200,{scale:1.6,opacity:.85}),aura('aura','Blade wall plane',charge+400,2000,{opacity:.35,scale:1.8,tracks:[track('scale.y',1,.35,1600)]})];
  case 'fix:shockWeapon':return [cast('Channel current'),hit('Current courses through the weapon',charge,1500,{scale:.8,offsetX:.35}),aura('aura','Sparks crackle',charge+400,1400,{scale:.6,offsetX:.35,below:false})];
  case 'fix:weave':return [cast('Fibers loosen'),hit('Fibers unravel',charge,1400,{scale:.7}),aura('aura','Strands weave together',charge+500,1600,{scale:.6,below:false})];
  case 'fix:magnetRepel':return [cast('Reverse polarity'),hit('Metal shudders away',charge,1600,{scale:1.2}),aura('aura','Repelled glints',charge+400,1300,{scale:.8,below:false})];
  case 'fix:weakPoint':return [cast('Read the foe'),hit('Weak point marked',charge,1500,{scale:.75}),aura('aura','Opening glints',charge+500,1300,{scale:.5,below:false})];
  case 'fix:trail':return [cast('Mist begins to glow'),...[0,1,2].map(i=>fx('cast','hit','Glowing trail',charge+i*250,2200,{subject:'source',scale:.35-i*.07,offsetX:-.35-i*.3,opacity:.7-i*.15,fadeIn:300,fadeOut:700})),aura('aura','Trail lingers',charge+500,1800,{subject:'source',scale:.6,offsetX:-.6,opacity:.35})];
  case 'fix:allegro':return [cast('Quickening refrain'),hit('Tempo quickens',charge,1300,{scale:.9,fadeOut:300}),aura('aura','Quickened energy',charge+400,1300,{opacity:.5,below:false}),pose('pulse','Quickened lift',charge+200,900,'targets',.08,.3)];
  case 'fix:killWord':return [cast('Word of death spoken'),hit('Death word lands',charge,1800,{scale:1.6,scaleIn:.3,scaleInDuration:400}),aura('aura','Life snuffed',charge+300,1600,{scale:2,opacity:.6,below:false,...colorize('#3a2442')}),pose('shake','Fatal shudder',charge+150,700,'targets',.1,.7)];
  case 'fix:roarBuff':return [cast('Amplify the voice'),hit('Thundering roar resonates',charge,1300,{scale:1.2}),aura('aura','Predatory aura',charge+400,1700,{opacity:.45}),pose('pulse','Dominant stance',charge+200,900,'targets',.08,.35)];
  case 'fix:brainDrain':return [cast('Probe the mind'),hit('Thoughts torn loose',charge,900,{opacity:.7,scale:.8}),fx('travel','bolt','Memories flow to caster',charge+250,1200,{travelOrigin:'target',opacity:.7,scale:.6}),fx('cast','aura','Stolen knowledge sorted',charge+900,1300,{subject:'source',scale:.6,offsetY:-.3}),pose('shake','Mind jolted',charge+100,500,'targets',.05,.35)];
  case 'fix:summon':{
   const tinted=m.summonTint?colorize(m.summonTint):{};
   return [fx('cast','aura','Conjuration circle',0,2200,{below:true,scale:1.8,rotateIn:-90,rotateInDuration:1600,...tinted}),
    fx('cast','hit','Conjuration opens',charge,1800,{scale:1.8,scaleIn:.05,scaleInDuration:1000,...tinted}),
    fx('cast','area',m.accent,charge+700,1600,{opacity:.8,fadeIn:300,fadeOut:500,...m.accentExtra})];
  }
  case 'fix:moisture':return [cast('Draw water out'),hit('Moisture leaves the object',charge,1300,{scale:.6,opacity:.6,scaleOut:.3,scaleOutDuration:1100}),fx('cast','aura','Droplet floats in hand',charge+600,1800,{subject:'source',scale:.3,offsetX:.3,offsetY:-.2,tracks:[track('position.y',-.2,-.28,900,{loop:true,pingPong:true})]})];
  case 'fix:gravityPull':return [cast('Bend gravity'),hit('Gravity seizes the target',charge,1400,{opacity:.6,scaleOut:.5,scaleOutDuration:1200}),aura('aura','Pull toward caster',charge+200,1400,{opacity:.45}),{...pose('rush','Pulled toward caster',charge+300,1700,'targets',2,.3),motionRange:'target',motionArrival:40,motionHold:30}];
  case 'fix:flense':return [cast('Necromantic touch'),hit('Flesh is stripped',charge,1000,{scale:1.1}),aura('aura','Viscera falls away',charge+250,1500,{opacity:.75}),pose('recoil','Stripped recoil',charge+150,500,'targets',.1,.5)];
  case 'fix:growths':return [cast('Twist the anatomy'),hit('Flesh erupts',charge,1200,{scale:.9}),aura('aura','Extra eyes pop open',charge+300,1600,{scale:.7,below:false}),pose('shake','Growths erupt',charge+100,700,'targets',.07,.5)];
  case 'fix:twinTrees':return [cast('Call the twin trees'),fx('cast','hit','Tree of life',charge,2600,{subject:'source',offsetX:-.7,scale:.8,...colorize('#8fd16a')}),fx('cast','aura','Tree of death',charge+250,2600,{subject:'source',offsetX:.7,scale:.8,...colorize('#5b3f6e')})];
  case 'fix:vapor':return [cast('Body loosens to vapor'),hit('Body becomes vapor',charge,1800,{opacity:.65,scale:1.1}),copy('Fading solid form',charge+200,1800,{copies:1,copySpread:0,opacity:.35,tracks:[track('alpha',.35,0,1500,{delay:300})]}),aura('aura','Drifting mist',charge+600,1800,{opacity:.4}),pose('levitate','Drifts upward',charge+300,1800,subject,.25,.4)];
  case 'fix:airBlast':return [fx('template','area','Air bursts outward',0,1600,{scale:1,oneShot:true,fadeIn:0,fadeOut:150,...colorize('#eef6ff')}),fx('template','aura','Wind lines scatter',250,1400,{scale:1,opacity:.6,fadeOut:300})];
 }
 throw Error(`Unhandled fix pattern ${m.pattern}`);
}
