// Complete native-description review for the first frozen catalog gap slice.
// Slots represent visible fiction. Delayed mechanics have preparation graphs.
const ROOTS={
 dust:'particles.002.001.complete.many.blue',in:'particles.inward.greenyellow',out:'particles.outward.greenyellow',swirl:'particles.swirl',
 feet:'footprints.shoe.grey',eye:'eyes.01.dark_green.single',eyes:'eyes.01.dark_green.many',fewEyes:'eyes.01.dark_green.few',
 words:'icon.runes.orange',rune:'ward.rune.yellow.01',star:'ward.star.yellow.01',heart:'icon.heart.pink',skull:'icon.skull.purple',horror:'icon.horror.purple',
 drop:'icon.drop.red',mute:'icon.mute.dark_red',poison:'icon.poison.dark_green',snow:'icon.snowflake.blue',shieldIcon:'icon.shield.green',
 strand:'energy_strands.complete.blue.01',link:'energy_strands.range.standard.purple.01',mesh:'energy_strands.overlay.blue.01',
 shine:'shimmer.01.blue',glint:'glint',sparkles:'swirling_sparkles',stars:'twinkling_stars',feathers:'swirling_feathers',leaves:'swirling_leaves',
 smoke:'smoke.puff.centered.grey',plume:'smoke.plumes.01.grey',fog:'fog_cloud',dark:'darkness',shadow:'drop_shadow',
 bubble:'bubble.001.001.complete.blue',bubbleLoop:'bubble.001.001.loop.blue',sphere:'energy_field.01.blue',shield:'shield.01.intro.blue',
 voice:'soundwave.02.blue',wave:'soundwave.01.blue',notes:'music_notations',wind:'wind_lines.01.01.white',windLeaf:'wind_lines.01.leaves.01.green',gust:'gust_of_wind',
 water:'liquid.splash.blue',blood:'liquid.splash02.red',pool:'liquid.blob.blue',bloodSide:'liquid.splash_side02.red',
 plant:'plant_growth.03.round.4x4.complete.greenyellow',plantSquare:'plant_growth.03.square.4x4.complete.greenyellow',vine:'vine.complete.nature.group.01.green',
 tentacles:'black_tentacles.dark_purple',web:'web.01',chain:'markers.chain.spectral_standard.complete.02.blue',
 flame:'flames.04.complete.orange',fire:'bonfire',rain:'template_square.raindrops.001.5x5.instant.combined.blue,liquid.splash.blue',ice:'ice_spikes',sleet:'sleet_storm.01.blue',
 cracks:'ground_cracks.01.orange',rocks:'falling_rocks',boulder:'boulder',bones:'bone.throw.01,arrow.physical.white',spikes:'spike_trap.05x05ft.top.holes.normal.01.01',
 static:'static_electricity.01.blue',orb:'lightning_orb.01.loop.bluepurple',die:'icosahedron.simple.blue',crystal:'icosahedron.rune.above.blueyellow',
 tool:'wrench.melee.01.white',sleep:'sleep.symbol.pink',sleepCloud:'sleep.cloud.01.pink',portal:'portals.vertical.ring',portalFloor:'portals.horizontal.ring',
 shatter:'shatter',bell:'toll_the_dead.green.bell',spirit:'spirit_guardians.blueyellow.ring',void:'sphere_of_annihilation',
 fireCone:'burning_hands',waterCone:'water_splash.cone.01.blue',force:'energy_field.02.above.blue',wall:'wall_of_force',
 muzzle:'muzzle_flash',halberd:'halberd',claw:'claws',bite:'bite',grease:'grease',boon:'on_token_buff.001.001.white',
 toadPrints:'footprints.monster.grey,footprints.shoe.grey',toadSwarm:'particles.002.001.complete.many.greenyellow,particles.002.001.complete.many.blue',
 arcaneBlast:'explosion.01.purple,explosion.02.blue',daggers:'cloud_of_daggers.daggers',
};

// slug | graph | main stage | material | supporting material | connecting material | flags
// F: native area, C: preparation only, X: caster-local, S: symbolic artwork.
const rows=`
500-toads|hopping|Hopping multitude|toadPrints|toadSwarm||FS
aberrant-whispers|whisperArea|Unknown phrases|voice|words||FS
accelerated-decomposition|wither|Body withers|smoke|dust||S
access-lore|lore|Divine lore|words|eye||CXS
achaekeks-clutch|brand|Mantis symbol|rune|drop||CS
air-bubble|headBubble|Breathing bubble|bubble|wind||
albatross-curse|bird|Spectral albatross|feathers|glint||CS
all-is-one-one-is-all|sharedEssence|Merged essence|strand|heart|link|S
all-encompassing-hunger|drain|Devouring life|void|in|link|S
alter-reality|possibility|Spiritual possibilities|crystal|words||CXS
amity-cycle|performanceRitual|Anbarit performance|notes|heart|voice|CXS
ancestral-defense|ancestralGuard|Ancestor guards will|eye|shield||CXS
anchoring-air|airClamp|Air vise|wind|strand||S
ancient-dust|coneFan|Grave soil|plume|dust||FS
angelic-messenger|portalPetition|Celestial invocation|portal|star||CXS
anima-invocation-modified|spiritRitual|Body soul connection|strand|heart||CXS
animal-messenger|messageCarrier|Animal message|feathers|words||CS
animate-object|objectRitual|Object animation rite|strand|words||CS
animus-mine|mentalMine|Mental mine armed|crystal|words||CXS
annunciation-of-the-outer-gate|invitation|Ancient invitation|voice|words|link|FS
antimagic-artifice|objectSeal|Suppression trigger|rune|mute||CS
aqueous-orb|waterOrb|Water sphere|bubble|water||S
arcane-explosion|pureMagic|Body becomes magic|sphere|arcaneBlast||FXS
arcane-weaving|weave|Shared spell weaving|strand|words|link|CS
arms-of-nature|woodShape|Wooden armament|leaves|vine||S
army-of-shadows|shadowRitual|Shadows invoked|dark|smoke||FCS
artistic-recollection|paint|Painted recollection|shine|sparkles||S
ash-strewn-ending|pyreRitual|Mythic pyre|fire|dust|wind|FCS
asmodean-wager|contract|Wager terms|words|die|link|CXS
aspirational-state|spiritRitual|Collective aspiration|strand|eye||CXS
astral-labyrinth|maze|Astral maze|mesh|strand||FS
astral-projection|astralRitual|Astral essence|strand|portal||CS
atone|prayer|Penitent prayer|words|star||CS
attacked-from-within|anguish|Spirit anguish|horror|eye||S
aura-of-the-unremarkable|subtleField|Innocuous appearance|shine|eye||FCS
avenging-wildwood|tree|Tree sprouts|plant|vine||S
awaken-animal|awakenAnimal|Animal awareness|eye|heart|link|CS
awaken-curse|curseFeed|Curse empowerment|skull|in|link|CXS
awaken-entropy|entropy|Entropic ground|cracks|dust||FS
awaken-object|awaken|Object awareness|eye|words||CS
awaken-portal|portalCharge|Portal reactivation|portal|in|strand|CS
bacchanalia|feastRitual|Celebratory feast|notes|heart||CXS
band-of-heroes|heroesRitual|Heroic gathering|star|heart|link|CXS
bandits-doom|objectSeal|Theft ward|rune|skull||CS
banishing-touch|forceTouch|Launching touch|force|wind||S
banishment|banishing|Home plane tether|portal|strand||S
bathe-in-blood|bloodBath|Blood bath rite|blood|shine||CS
battlefield-persistence|saveGuard|Battle resolve|shield|boon||CXS
beckon-the-blasphemous-brethren|tentaclePetition|Venedaemon petition|tentacles|words||CXS
behold-the-weave|timeline|Timeline strands|strand|eye||CS
benediction|defenseArea|Divine protection|shieldIcon|star||FCS
beseech-arcanotheign|heraldStorm|Arcanotheign arrives|smoke|glint|wave|S
bestial-curse|bestialChange|Bestial transformation|shine|web||S
bind-heroic-spirit|heroBind|Heroic conduit|strand|star|link|S
bind-undead|undeadCommand|Word of control|words|chain|link|CS
binding-circle|bindingRitual|Binding circle|rune|portal||CS
bit-of-luck|luckGuard|Luck tilts|die|shieldIcon||CS
blanket-of-stars|starCloak|Starry darkness cloak|dark|stars||CXS
blessed-boundary|boundary|Divine shell|bubble|dust||FCS
blessing-of-defiance|defiance|Resolve blessing|shieldIcon|strand||CS
blight|blightRitual|Plant withering rite|leaves|dust||CXS
blightburn-blast|radiationCone|Blightburn radiation|poison|dust||FS
blinding-beauty|beautyCone|Nymph glance|eye|glint||FS
blinding-fury|visionCurse|Outraged gaze|eye|dark||CS
blister|skinBlisters|Caustic blisters|pool|poison||CS
blood-infusion|bloodInfusion|Thrall blood drawn|blood|drop||S
blood-runs-cold|coldVeins|Chilled blood|blood|snow||S
blood-vendetta|bloodMark|Blood vengeance|drop|blood||S
blood-feasting-breath|dualBreath|Blood feasting breath|wind|heart||FS
bloodspray-curse|bloodMark|Wound curse|drop|rune||CS
bloody-tendrils|bloodTendrils|Bloody tendrils form|tentacles|blood||CS
blossoming-gore|roseField|Bloody roses|plant|blood||FCS
blunt-the-final-blade|soulPathRitual|Soul escape pathway|strand|skull|out|CS
bonding-meal|memoryFeast|Memory meal|plume|words||CXS
bone-spray|boneFan|Bone shards|bones|blood||FS
boneshaker|boneClamp|Skeleton compresses|skull|strand||S
bonewall-bulwark|boneWall|Bone bulwark|skull|dust||FCS
bony-barrage|boneFan|Thrall bone volley|bones|dust||FS
booming-blast|gunCry|Gunshot crack|muzzle|voice||FS
borrow-time|timeRitual|Borrowed time bubble|bubble|die||FCXS
bottle-the-storm|storedElectricity|Lightning stored|static|orb||CXS
bound-in-death|lifeTether|Spirit tether|strand|heart|link|CS
bountiful-oasis|oasisRitual|Spring invocation|water|leaves||FCS
bralani-referendum|windWard|Punishing zephyrs|wind|words||FCS
brand-the-impenitent|brand|Religious brand|rune|glint||CS
bridge-of-graves|graveBridge|Grave dirt span|cracks|skull||FCS
bridge-of-vines|vineBridge|Vine bridge|vine|leaves||FCS
buffeting-winds|windCone|Buffeting wind|wind|plume||FS
bullhorn|voice|Voice amplified|voice|wave||CX
buoyant-bubbles|foam|Buoyant foam|bubble|water||CS
burning-trail|feetFlame|Feet aflame|flame|glint||C
bursting-bloom|roseBody|Chest rose bush|plant|blood||S
butterfly-bender|fateDrink|Drinking fate rite|plume|die||CXS
calcification|boneDust|Bone dust invasion|dust|skull||S
call-fluxwraith|glassHerald|Fractured reflections|shatter|shine||S
call-of-the-quenching|rainSea|Conch sea invocation|rain|voice|water|FCXS
call-spirit|spiritPetition|Named spirit petition|portal|plume||CXS
call-the-blood|bloodDrain|Blood streams inward|blood|drop|link|S
call-to-arms|rally|Call to arms|voice|heart||FCS
calm|calmArea|Calming thoughts|heart|shine||FCS
captivating-adoration|adoration|Entrancing presence|glint|heart||FCS
carrion-mire|limbMire|Corpse limb mire|tentacles|skull||FCS
cast-into-time|timeCone|Temporal wave|shine|strand||FS
casters-imposition|interference|Cooperative magic blocked|words|strand||CS
catch-your-name|heardName|Private name heard|words|voice||CXS
cave-fangs|stoneTeeth|Flowstone teeth|ice|cracks||FS
censure-falsehoods|frogMouth|Patron reprimand|mute|strand||CS
chameleon-coat|camouflage|Colors match surroundings|shine|leaves||CS
chroma-leach|colorDrain|Color vitality drains|sparkles|shine|link|S
chthonian-wrath|unselectedCone|Outer Rifts energy|strand|dust||FS
cinder-gaze|flameDivination|Flame smoke reading|flame|eye|plume|CXS
cinder-scribe|flameScript|Flame quill writes|flame|words||CS
circle-of-protection|protectionCircle|Alignment protection|rune|shieldIcon||FCS
circle-of-weakness|weaknessCircle|Floating inscriptions|words|strand||FCS
city-of-sin|temptationRitual|Temptation invocation|heart|horror||CXS
claim-undead|undeadChallenge|Undead mastery|words|skull|link|CS
claws-of-the-otter|webbedHands|Webbed fingers|web|snow||CXS
cleanse-air|cleanAir|Air purified|wind|smoke||FCS
clinging-ice|feetIce|Sleet clings to legs|sleet|ice||S
clinging-shadows-stance|shadowHands|Clinging shadows|shadow|smoke||CXS
cloak-of-colors|colorCloak|Swirling color cloak|sparkles|shine||CS
cloak-of-shadow|shadowCloak|Shadow mantle|dark|smoke||FCS
clockwork-devotion|clockworkArmy|Clockwork battalion|crystal|halberd|tool|S
clone|cloneRitual|Clone samples|bubble|drop||CS
cloud-dragons-cloak|mistCloak|Deflecting mist|fog|wind||CS
cloudborne-haven|floatRitual|Building lift rite|cracks|wind||CS
clownish-curse|clownCurse|Awkward hands feet|notes|words||CS
coiling-dance|holyDance|Sacred coiling dance|star|notes||FCS
collective-memories|memoryRitual|Mortal memories|eyes|words||CXS
combustion|fireBody|Creature ignites|flame|plume||
commune|communeRitual|Unknown being petition|words|eye||CXS
commune-with-corazal|forestSense|Corazal senses|eyes|leaves||CXS
community-repair|repairRitual|Community repair rite|tool|strand|words|CS
companions-shadow|companionShadow|Companion shadow|shadow|smoke||CS
competitive-edge|competitive|Competitive resolve|boon|glint||CXS
concealments-curtain|mirrorRitual|Mirror eye rite|eye|shine|words|CXS
confetti-cloud|confetti|Confetti storm|dust|notes|voice|FCS
confound-the-eye-and-confuse-the-mind|castingVeil|Spellcasting disguise rite|shine|words||CS
confusing-cry|warble|Warbling cry|voice|wave||FS
conglomerate-of-limbs|limbConstruct|Severed limb thrall|tentacles|skull||CS
conjured-clockwork|cogField|Clockwork ground|crystal|tool||FCS
conjured-conveyance|woodVehicle|Wooden conveyance|plantSquare|leaves||CS
conquering-soldiers|armyHerald|Ancient army arrival|wall|voice|notes|S
consecrate|consecrateSite|Sacred site rite|rune|star||FCS
consecrate-flesh|holyBody|Holy body infusion|star|shine||CXS
construct-mindscape|mindscapeRitual|Mental environment rite|eye|crystal||CXS
contact-friends|contactRitual|Friends contacted|words|heart|link|CXS
contagious-idea|thought|Thought planted|words|eye||CS
control-water|waterLevel|Water level changes|pool|water||FCS
control-weather|weatherRitual|Weather invocation|wind|plume||CXS
coral-eruption|coralField|Coral erupts|spikes|water||FS
coral-scourge|coralBody|Coral barnacle growth|spikes|drop||CS
corpse-communion|corpseLore|Dead lore communion|skull|words||CXS
corrosive-muck|acidPools|Acidic slime pools|grease|plume||FCS
counter-performance|counterPerformance|Protective performance|shine|shieldIcon||FCS
courageous-anthem|anthem|Encouraging anthem|notes|heart||FCS
cozy-cabin|cabin|Wooden cabin|plantSquare|fire||CS
crashing-wave|waterCone|Crashing wave|waterCone|water||F
create-demiplane|demiplaneRitual|World creation rite|crystal|portal|words|CXS
create-earthen-facsimile|soilFigurine|Soil figurine|rocks|dust||CS
create-mycoguardian|fungusRitual|Fungal creation rite|dust|plume||CS
create-skinstitch|stitchRitual|Skin frame stitching|strand|drop||CS
create-thrall|thrall|Undead conjured|skull|smoke||CS
create-undead|undeadRitual|Undead creation rite|skull|dark||CS
create-water|handsWater|Water flows from hands|water|pool||CX
croak-voice|voiceCurse|Swollen vocal cords|mute|bubble||CS
crucible-of-iron|moltenIron|Molten iron pours|bloodSide|shine||S
crusade|mandate|Divine cause proclaimed|words|star|link|CS
cry-of-destruction|sonicCone|Destructive voice|voice|wave||F
cup-of-dust|thirst|Unquenchable thirst|drop|dust||CS
curse-of-calamity|misfortuneRitual|Misfortune condemnation|die|horror||CXS
curse-of-death|heartClamp|Patron grips heart|heart|strand||S
curse-of-lost-time|aging|Aging erosion curse|dust|shine||S
curse-of-recoil|armCurse|Recoil curse|strand|words||CS
cursed-metamorphosis|metamorphosis|Harmless animal transformation|shine|dust||S
cutting-eye|enviousEyes|Envious eyes open|eye|shieldIcon||CXS
daemonic-pact|bloodPact|Abaddon petition|drop|words|portal|CXS
dance-of-darkness|darkDance|Darkness dance|dark|smoke||FCXS
darkened-eyes|darkEyes|Darkness in vision|eye|smoke||CS
darkened-sight|darkVision|Darkness sight|eye|glint||CS
dawnflowers-light|goldLight|Golden revealing light|glint|eye||FCS
daydreamers-curse|daydreamCurse|Attention drifts|shine|eye||CS
dazzling-flash|symbolFlash|Religious symbol flash|star|glint||FS
death-knell|snuffLife|Life snuffed|heart|skull||S
deaths-call|deathVitality|Death invigorates|skull|in||CXS
deceivers-cloak|disguise|Illusory creature guise|shine|smoke||CXS
deep-breath|breath|Deep inhalation|wind|bubble||CX
defensive-prescience|prescience|Attack possibilities|eye|strand||CS
demonic-pact|demonPact|Demon favor petition|horror|words|portal|CXS
desiccate|dryBody|Moisture removed|water|dust||S
destroy-mindscape|mindUnravel|Mental anchors unraveled|words|shine|strand|CXS
devouring-void|voidMouths|Hungry spatial tears|void|bite||FS
diabolic-pact|devilPact|Devil service petition|chain|words|portal|CXS
diadem-of-divine-radiance|diadem|Radiant diadem|glint|star||FCXS
diamond-dust|iceCrystals|Dancing ice crystals|sleet|glint||FCS
dim-the-light|darkFlicker|Ambient light flickers|dark|smoke||CX
dinosaur-fort|fort|Primeval fort perimeter|plantSquare|skull||CS
discern-lies|lieNotes|Discordant falsehoods|notes|eye||CXS
discomfiting-whispers|whisperArea|Spiteful murmurings|voice|die||FCS
disjunction|crackleItem|Disjoining energy|static|strand||S
dispel-magic|unweave|Magic unravels|strand|out||S
dispelling-globe|globe|Counteracting globe|bubble|strand||FCS
distracting-chatter|chatter|Overlapping speech|voice|words||CS
div-pact|divPact|Div assistance petition|smoke|words|portal|CXS
divine-armageddon|divineCataclysm|Divine cataclysm|spirit|force||FS
divine-decree|litany|Faith litany|words|spirit|voice|FS
divine-dragons-watch|dragonWatch|Invisible draconic watcher|eye|shieldIcon||CS
divine-inspiration|refreshMagic|Spiritual magic refreshed|in|words||CS
divine-keystone|keystoneRitual|Cornerstone consecration|rocks|rune||FCS
divine-wrath|divineWrath|Divine fury|spirit|star||FS
diviners-sight|futureSight|Future check glimpse|eye|die||CS
divinity-leech|divineDisconnect|Divine connection disrupted|rune|strand||CS
dizzying-colors|colorsCone|Swirling colors|sparkles|glint||FS
dome-of-tranquility|quietDome|Isolated quiet dome|bubble|mute||FCS
dominate|command|Commands conveyed|words|strand|link|CS
downpour|rainField|Torrential rain|rain|plume||FC
dragon-breath|unselectedBreath|Draconic energy breath|dust|wind||FS
dragon-turret|tower|Dragon tower|wall|spirit||FCS
drain-planar-connection|leySiphon|Planar lattice siphon|crystal|strand|link|CXS
draw-blood|fangHand|Fanged palm|bite|blood||S
dream-council|dreamMeet|Shared dream invitation|sleep|words|link|CS
dreamers-call|daydreamLure|Illusory daydream|sleepCloud|shine||CS
dreaming-potential|sleepPotential|Lucid potential|sleep|words||CS
drop-dead|illusoryCorpse|Illusory corpse|shine|smoke||S
dull-ambition|ambition|Ambition dulled|plume|die||CS
duplicate-foe|duplicate|Enemy duplicate|shine|strand||CS
dutiful-challenge|challenge|Challenge attention|eye|strand|link|CS
eagles-cry|eagleCry|Eagle cry|voice|feathers||FS
earthbind|groundWeight|Earthen weight|rocks|strand||S
earthworks|barriers|Earthen barriers rise|cracks|rocks||FCS
eat-fire|ingestFire|Fire consumed|flame|plume||CX
echo-jump|teleportEcho|Departure echo|shine|force||FXS
eclipse-burst|eclipse|Freezing darkness globe|dark|sleet||FS
ectoplasmic-expulsion|ectoplasm|Ectoplasmic tendrils|strand|out||S
ectoplasmic-interstice|interstice|Planes partially merge|bubble|mesh||FCS
eidolons-wrath|unselectedEnergy|Eidolon energy release|dust|force||FS
eject-soul|soulDisrupt|Body soul disruption|strand|shine||S
electrified-crystal-ward|crystalLock|Crystalline lock|crystal|static||CS
electrostatic-glider|glider|Static gliding arc|static|wind||CXS
elemental-absorption|absorbElements|Elemental energy stored|in|shieldIcon||CXS
elemental-annihilation-wave|annihilationCone|Elemental destruction wave|fireCone|wind||FS
elemental-blast|unselectedEnergy|Elemental blast|dust|strand||FS
elemental-breath|unselectedBreath|Elemental portal breath|dust|portal||FS
elemental-counter|elementCounter|Elemental countering|shieldIcon|strand||CS
elemental-sentinel|sentinelRitual|Object wisp sentinel|eye|in||CS
elemental-servitor|servitorRitual|Elemental lord petition|words|swirl||CXS
elemental-tempest|tempestPrep|Elemental storm prepared|in|strand||CXS
elemental-zone|elementZone|Elemental amplification zone|mesh|dust||FCS
embed-message|messageSeal|Triggered message sealed|words|rune||CS
embodied-font|bodyFont|New body invocation|words|strand||CS
embodiment-of-battle|battleApparition|Battle apparition guides|shine|boon||CXS
embrace-nothingness|nothingBody|Substance emptied|shadow|smoke||CXS
empower-ley-line|leyBoost|Ley line empowerment|strand|crystal|link|CS
empty-inside|emptyMind|Emotion emptied|dark|heart||CXS
empty-pack|packVeil|Contents veiled|shine|words||CS
encroaching-woods|woodPetition|Wood spirits petitioned|leaves|eye||CS
enduring-might|mightyGuard|Might protects|shieldIcon|strand||CXS
energy-absorption|energyGuard|Energy mitigated|shield|in||CXS
enhance-victuals|gourmet|Fare enhanced|plume|glint||CS
entrancing-eyes|entrancingEye|Entrancing gaze|eye|glint||FCXS
entreat-the-many|spiralSpirits|Spiraling bonded spirits|spirit|shine||FXS
entreat-thunderbird|thunderbirdRitual|Thunderbird entreaty|feathers|voice|static|CXS
entropic-wheel|thermalWheel|Thermal wheel forms|flame|snow||CXS
equal-footing|speedHamper|Movement hampered|strand|feet||CS
eradicate-undeath|lifeCone|Life energy deluge|heart|star||FS
erase-trail|traceErase|Passage signs erased|feet|wind||FCS
establish-nexus|nexusRitual|Ley lines converge|strand|crystal|link|CS
euphoric-renewal|renewalPrepared|Renewal prepared|heart|skull||CXS
everlight|gemLight|Gemstone illumination|crystal|glint||FCS
evil-eye|resentfulEye|Baleful envious gaze|eye|horror||CS
exchange-image|swapVisage|Visages exchanged|shine|strand|link|S
execute|demise|Demise invoked|skull|strand||S
expunge-blood|fluidExpel|Vital fluids expelled|blood|out||S
extend-blood-magic|bloodExtend|Blood magic extended|drop|words||CXS
extend-boost|bondExtend|Eidolon bond extended|strand|crystal||CXS
extend-spell|spellExtend|Ancient duration lore|words|die||CXS
extract-brain|brainRitual|Brain extraction rite|skull|eye|strand|CS
extradimensional-cover|debrisCover|Semi real debris|rocks|smoke||FCS
eyes-of-the-dead|undeadSenses|Undead senses borrowed|eye|skull|link|CS
fabricated-truth|beliefWords|Statement planted|words|eye||CS
face-in-the-crowd|crowd|Nondescript appearance|shine|shadow||CXS
fact-check|tinyAvatar|Subconscious avatar|words|glint||CXS
faerie-dust|dustField|Magical dust sprinkled|dust|sparkles||FCS
faerie-fire|faerieOutline|Heatless colorful outline|sparkles|glint||FCS
fallen-soldiers-lament|ghostLament|Fallen foe illusion|plume|voice||S
falling-stars|fallingStars|Falling stars descend|stars|rocks||FS
false-nature|objectFalse|Object nature illusion|shine|words||CS
false-vision|scryFalse|Scrying scene veiled|shine|eye||FCS
falsify-heat|temperatureVeil|Temperature illusion|shine|drop||CS
fantastic-facade|facadeRitual|Settlement facade rite|shine|words||CXS
fated-confrontation|fateDuel|Fated opponents isolated|bubble|strand|link|CS
feast-of-ashes|hungerDust|Unsated hunger|void|dust||CS
feast-of-supplication|cookContest|Patron cooking contest|plume|notes|words|CXS
feral-shades|predatorMist|Predatory gray mist|plume|claw||FS
fey-abeyance|ironBells|Cold iron bell ward|bell|rune||CXS
field-of-life|lifeField|Life energy field|heart|glint||FCS
field-of-razors|wireField|Barbed metal thicket|daggers|glint||FCS
fiendish-rift|fiendRift|Fiendish tear opens|portalFloor|tentacles||FS
filter-air|lungFilter|Inhaled air filtered|wind|smoke||CX
fireproof|fireResistObject|Object heat ward|shieldIcon|glint||CS
`.trim().split('\n').map(line=>{
 const [slug,graph,label,h,a,b,flags]=line.split('|');
 return {slug,graph,label,h:ROOTS[h],a:ROOTS[a],b:ROOTS[b],flags};
});

// Projectile-fan cones also show a faint native cone footprint (area slot).
const FAN_GRAPHS=new Set(['coneFan','boneFan','radiationCone','timeCone','unselectedCone','colorsCone','predatorMist','windCone','sonicCone','eagleCry','lifeCone','beautyCone','symbolFlash','dualBreath','unselectedBreath']);
export const GAP_A_MOTIFS=Object.fromEntries(rows.map(r=>[`gapA-${r.slug}`,{
 label:r.label,pattern:`gapA-${r.graph}`,cast:r.h,hit:r.h,aura:r.a,area:r.h,bolt:r.b,assetIntent:r.label,
 nativeArea:r.flags.includes('F'),castingOnly:r.flags.includes('C'),symbolic:r.flags.includes('S'),
 slotGeometry:{...(r.b?{bolt:r.b.startsWith('energy_strands.range.')?'beam':'radial'}:{}),
  ...(r.graph==='boneFan'?{hit:'projectile'}:{}),
  ...(['armyHerald','tower'].includes(r.graph)?{hit:'wall'}:{}),
  ...(['waterCone','annihilationCone'].includes(r.graph)?{area:'cone'}:{}),
 },
}]));
for(const r of rows){
 const motif=GAP_A_MOTIFS[`gapA-${r.slug}`];
 if(['boneFan','armyHerald','tower'].includes(r.graph))motif.cast=r.a;
 if(['waterCone','annihilationCone'].includes(r.graph)){motif.cast=r.a;motif.hit=r.a;}
 if(r.graph==='waterCone')motif.theme='water';
 if(r.graph==='annihilationCone')motif.theme='fire';
 if(FAN_GRAPHS.has(r.graph))motif.area='detect_magic.cone';
}
export const GAP_A_DESIGNS=Object.fromEntries(rows.map(r=>[r.slug,[`gapA-${r.slug}`,'']]));
const reviewSpecs=Object.fromEntries(rows.map(r=>[r.slug,r]));
export {reviewSpecs as GAP_A_REVIEW_SPECS};

const PREVIEW_AREAS={
 'aqueous-orb':{type:'burst',value:5,details:'10-foot-diameter water sphere'},
 'blossoming-gore':{type:'burst',value:20},
 'bonewall-bulwark':{type:'line',value:10,width:1},
 'bridge-of-graves':{type:'line',value:120,width:10},
 'bridge-of-vines':{type:'line',value:60,width:10},
 'call-of-the-quenching':{type:'burst',value:5280},
 'confetti-cloud':{type:'burst',value:10},
 'control-water':{type:'square',value:50},
 'corrosive-muck':{type:'burst',value:10,details:'two 10-foot bursts'},
 'cozy-cabin':{type:'square',value:20},
 'dance-of-darkness':{type:'burst',value:10},
 'dawnflowers-light':{type:'emanation',value:60},
 'diadem-of-divine-radiance':{type:'emanation',value:60},
 'everlight':{type:'emanation',value:20},
 'earthworks':{type:'burst',value:10},
 'field-of-razors':{type:'burst',value:20},
 'falling-stars':{type:'burst',value:40,details:'four 40-foot bursts'},
 'cloak-of-shadow':{type:'emanation',value:20},
};
for(const [slug,previewArea] of Object.entries(PREVIEW_AREAS))Object.assign(GAP_A_MOTIFS[`gapA-${slug}`],{
 previewArea,nativeArea:true,delivery:['square','cube','cylinder'].includes(previewArea.type)?'burst':previewArea.type,
 ...(previewArea.type==='line'?{areaLayout:'tiles'}:{}),
});

export function gapALayers(spell,helpers){
 const layers=gapAGraphLayers(spell,helpers);
 const r=layers&&(reviewSpecs[spell.slug?.replace(/-legacy$/,'')]??rows.find(x=>`gapA-${x.slug}`===spell.design.motif));
 if(!layers||!FAN_GRAPHS.has(r.graph)||spell.delivery!=='cone'||layers.some(s=>s.kind==='template'))return layers;
 const duration=Math.max(4200,spell.design.mediaTiming?.area?.duration??0)+350;
 return [...layers,helpers.fx('template','area','Cone footprint',0,duration,{scale:1,below:true,opacity:.4,fadeIn:300,fadeOut:300})];
}
function gapAGraphLayers(spell,{fx,copy,track,subject,pattern}){
 const r=reviewSpecs[spell.slug?.replace(/-legacy$/,'')]??rows.find(x=>`gapA-${x.slug}`===spell.design.motif);
 if(!r||!pattern.startsWith('gapA-'))return null;
 const who=r.flags.includes('X')?'source':subject;
 const length=(slot,n=4200)=>Math.max(n,spell.design.mediaTiming?.[slot]?.duration??0)+350;
 const body=(slot,label,delay=0,extra={})=>fx(who==='targets'?'impact':'cast',slot,label,delay,length(slot),{subject:who,scale:1,fadeIn:300,fadeOut:450,...extra});
 const source=(slot,label,delay=0,extra={})=>fx('cast',slot,label,delay,length(slot),{subject:'source',scale:.8,fadeIn:300,fadeOut:450,...extra});
 const area=(slot,label,delay=0,extra={})=>fx('template',slot,label,delay,length(slot,5200),{scale:1,below:true,opacity:.85,fadeIn:400,fadeOut:550,...extra});
 const link=(label,delay=0,extra={})=>fx('travel','bolt',label,delay,length('bolt'),{scale:.45,opacity:.7,fadeIn:150,fadeOut:450,...extra});
 const echo=(label,extra={})=>copy(label,0,5000,{subject:who,copies:1,copySpread:0,opacity:.3,fadeIn:500,fadeOut:550,...extra});
 const head=(slot,label,extra={})=>body(slot,label,0,{scale:.5,offsetY:-.35,...extra});
 const wordNodes=(slot,label,n=3,extra={})=>Array.from({length:n},(_,i)=>head(slot,label,{scale:.26,offsetX:(i-(n-1)/2)*.35,offsetY:-.45-Math.abs(i-(n-1)/2)*.08,delay:i*200,...extra}));
 const fan=(slot,label,delay=0,extra={})=>fx(spell.design.slotGeometry?.[slot]==='projectile'||GAP_A_MOTIFS[spell.design.motif]?.slotGeometry?.[slot]==='projectile'?'travel':'projectile',slot,label,delay,length(slot),{travelDestination:'area',areaLayout:'fan',fanCount:7,scale:.4,opacity:.85,fadeIn:0,fadeOut:450,...extra});
 const tiles=(slot,label,delay=0,extra={})=>area(slot,label,delay,{areaLayout:'tiles',scale:.75,...extra});
 const tinted=(tint)=>({tintEnabled:true,colorize:true,tint});
 const main=r.label;
 switch(r.graph){
 case 'hopping':return [tiles('hit',main,0,{scale:.18,...tinted('#7d8f4a'),tracks:[track('position.y',0,-.12,650,{loop:true,pingPong:true})]}),tiles('aura','Multitude grain',400,{scale:.5,opacity:.45,...tinted('#829f52')})];
 case 'whisperArea':return [source('hit',main,0,{scale:.6,offsetY:-.15}),area('aura','Surrounding murmurs',350,{opacity:.45})];
 case 'wither':return [body('hit',main,0,{maskToken:true,saturation:-1,scaleOut:.4,scaleOutDuration:3000}),echo('Fading vitality',{saturation:-1,opacity:.18}),body('aura','Decay fragments',700,{opacity:.55})];
 case 'lore':case 'memoryRitual':return [...wordNodes('hit',main,r.graph==='lore'?3:5),head('aura','Knowledge focus',{scale:.5,delay:600})];
 case 'brand':return [body('hit',main,0,{scale:.55,maskToken:true}),body('aura','Mark radiance',600,{scale:.35,offsetY:-.1,opacity:.65})];
 case 'headBubble':return [head('hit',main,{scale:.75}),head('aura','Pure air',{scale:.45,delay:350,opacity:.45})];
 case 'bird':return [body('hit',main,0,{scale:.75,offsetX:.55,offsetY:-.4}),body('aura','Spectral guide',500,{scale:.3,offsetX:.55,offsetY:-.4})];
 case 'sharedEssence':return [body('hit',main,0,{maskToken:true,opacity:.65}),link('Shared vital essence',250),body('aura','Vital portions',700,{scale:.45})];
 case 'drain':return [body('hit',main,0,{scale:.75}),link('Life drawn inward',350,{travelOrigin:'target'}),source('aura','Absorbing essence',700,{scale:.6})];
 case 'possibility':case 'demiplaneRitual':return [source('hit',main,0,{scale:1.15,opacity:.55}),...wordNodes('aura','Unselected possibilities',4,{subject:'source',opacity:.6}),...(r.b?[source('bolt','Planar key',900,{scale:.5,offsetY:.4})]:[])];
 case 'performanceRitual':case 'cookContest':return [source('hit',main,0,{scale:.8}),...wordNodes('aura',r.graph==='cookContest'?'Cheering audience':'Community unity',3,{subject:'source',offsetY:.35}),source('bolt',r.graph==='cookContest'?'Patron invitation':'Spoken performance',700,{scale:1.1})];
 case 'ancestralGuard':return [echo('Ancestral presence',{subject:'source',offsetX:-.45,saturation:-.7}),head('hit',main,{subject:'source'}),source('aura','Will protection',400,{scale:1.1})];
 case 'airClamp':return [-1,1].map(side=>body(side<0?'hit':'aura',side<0?main:'Air grips attack',0,{offsetX:side*.35,scale:.55,tracks:[track('position.x',side*.55,side*.25,2400)]}));
 case 'coneFan':case 'boneFan':case 'radiationCone':case 'timeCone':case 'unselectedCone':case 'colorsCone':case 'predatorMist':return [fan('hit',main),fan('aura',r.graph==='boneFan'?'Shard debris':r.graph==='predatorMist'?'Predatory forms':'Cone detail',550,{scale:r.graph==='predatorMist'?.3:.23,fanCount:5,opacity:.45,...(r.slug==='ancient-dust'?{saturation:-1}:{}),...(r.graph==='radiationCone'?tinted('#a7c754'):{})})];
 case 'portalPetition':case 'spiritPetition':return [source('hit',main,0,{scale:1.1,opacity:.6}),source('aura','Petition focus',650,{scale:.5,offsetY:-.35})];
 case 'spiritRitual':return [source('hit',main,0,{maskToken:true}),echo('Intended spiritual form',{subject:'source',offsetY:-.25,opacity:.2}),source('aura','Soul focus',700,{scale:.45})];
 case 'messageCarrier':return [body('hit',main,0,{scale:.55}),body('aura','Message imprinted',600,{scale:.25,offsetY:-.35})];
 case 'objectRitual':case 'stitchRitual':return [body('hit',main,0,{maskToken:true,tracks:[track('position.y',-.35,.35,3000)]}),...wordNodes('aura',r.graph==='stitchRitual'?'Skin frame materials':'Object enchantment',2,{offsetY:.15})];
 case 'mentalMine':return [head('hit',main,{scale:.65}),head('aura','Trigger remains latent',{scale:.35,delay:600})];
 case 'invitation':return [source('hit',main,0,{offsetY:-.15}),area('aura','Pact invitation spreads',450,{opacity:.35}),link('Telepathic invitation',800,{opacity:.25})];
 case 'objectSeal':case 'messageSeal':return [body('hit',main,0,{scale:.45,maskToken:true}),body('aura','Trigger sealed',650,{scale:.35,offsetY:.25,opacity:.6})];
 case 'waterOrb':return [area('hit',main,0,{scale:.85,below:false}),area('aura','Water gathers',300,{scale:.7,opacity:.55})];
 case 'pureMagic':return [source('hit',main,0,{maskToken:true,scale:1.2}),area('aura','Outward magical force',450),echo('Pure magic silhouette',{subject:'source',opacity:.15})];
 case 'weave':return [link(main),body('hit','Shared threads',400,{scale:.8}),...wordNodes('aura','Spell knowledge',3,{offsetY:.2})];
 case 'woodShape':return [body('hit',main,0,{scale:.75,offsetY:.25}),body('aura','Wood takes shape',600,{scale:.65,offsetY:.15})];
 case 'shadowRitual':return [area('hit',main,0,{opacity:.5}),source('aura','Shadow petition',400,{scale:.75,opacity:.6})];
 case 'paint':return [body('hit',main,0,{maskToken:true,scale:.7,tracks:[track('position.x',-.3,.3,3000)]}),body('aura','Pastel brush texture',450,{scale:.6,opacity:.5})];
 case 'pyreRitual':return [body('hit',main,0,{scale:1.25}),area('aura','Ash scattering',500,{opacity:.5,saturation:-1}),area('bolt','Ash carried by wind',1000,{opacity:.3})];
 case 'contract':return [...wordNodes('hit',main,3),body('aura','Undecided wager',600,{scale:.4,offsetY:.3}),link('Agreement bonds',850,{opacity:.4})];
 case 'maze':return [area('hit',main,0,{opacity:.55}),...[-45,45].map(rotation=>area('aura','Astral crossings',500,{scale:.85,rotation,opacity:.35}))];
 case 'astralRitual':return [body('hit','Silver cord invocation',0,{scale:.8}),echo(main,{offsetY:-.5,saturation:-.65}),body('aura','Astral threshold',600,{scale:.75,opacity:.35})];
 case 'prayer':return [...wordNodes('hit',main,3),body('aura','Faith petition',550,{scale:.55,below:true})];
 case 'anguish':return [head('hit',main),head('aura','Painful memory',{scale:.35,delay:400}),echo('Inner anguish echo',{offsetX:.25,opacity:.18})];
 case 'subtleField':return [area('hit',main,0,{opacity:.2}),area('aura','Perception softens',600,{opacity:.12,scale:.6})];
 case 'tree':return [area('hit',main,0,{scale:.7}),area('aura','Living branches',600,{scale:.65})];
 case 'awaken':return [head('hit',main,{scale:.5}),...wordNodes('aura','Object language invocation',3,{scale:.25}),body('aura','Object consciousness',650,{maskToken:true,scale:.55,opacity:.35})];
 case 'awakenAnimal':return [link('Animal spirit invocation'),head('hit',main,{scale:.5}),body('aura','Awareness potential',700,{scale:.45})];
 case 'curseFeed':return [source('aura','Life essence offered',0,{scale:.7}),link('Curse receives essence',500,{opacity:.45}),body('hit',main,850,{scale:.55})];
 case 'entropy':return [area('hit',main,0,{saturation:-1}),area('aura','Matter crumbles',500,{saturation:-1,opacity:.6,scaleOut:.5,scaleOutDuration:3500})];
 case 'portalCharge':return [body('hit',main,0,{scale:1.25,opacity:.5}),body('aura','Portal energy gathers',450,{scale:.6}),body('bolt','Gate connections',850,{scale:.85})];
 case 'feastRitual':case 'memoryFeast':return [source('hit',main,0,{scale:.8,opacity:.6}),...wordNodes('aura',r.graph==='memoryFeast'?'Shared home memories':'Celebratory spirit',3,{subject:'source',offsetY:.25,scale:.35})];
 case 'heroesRitual':return [source('hit',main,0,{scale:.65,offsetY:-.45}),link('Shared cause',350),...wordNodes('aura','Heroic bonds',3,{subject:'source',offsetY:.3})];
 case 'forceTouch':return [body('hit',main,0,{scale:.85}),body('aura','Launching force',350,{scale:.9,tracks:[track('position.y',.15,-.25,2000)]})];
 case 'banishing':return [body('hit',main,0,{scale:1.25,opacity:.45}),body('aura','Home plane connection',400,{scale:.8,scaleOut:.3,scaleOutDuration:3000})];
 case 'bloodBath':return [body('hit',main,0,{below:true,scale:1.25}),body('aura','Alchemical immersion',500,{maskToken:true,opacity:.35})];
 case 'saveGuard':case 'defiance':return [-1,1].map((side,i)=>body(i?'aura':'hit',i?'Resilience settles':main,i*450,{scale:i?.65:1.05,offsetX:side*.15}));
 case 'tentaclePetition':return [source('hit',main,0,{below:true,opacity:.5}),...wordNodes('aura','Forbidden petition',3,{subject:'source'})];
 case 'timeline':return [echo('Possible future selves',{copies:2,copySpread:.4,opacity:.2}),body('hit',main,0,{opacity:.55}),head('aura','Timeline viewed',{delay:700})];
 case 'defenseArea':return [area('hit',main,0,{opacity:.5}),area('aura','Faith protection',650,{scale:.55,opacity:.55})];
 case 'heraldStorm':return [area('hit',main,0,{scale:.85,saturation:-1}),area('hit','White storm half',300,{scale:.55,offsetX:-.2,...tinted('#ffffff')}),area('aura','Arrival flash',600,{scale:.9}),area('bolt','Arrival sonic crash',900,{scale:1.3})];
 case 'bestialChange':return [body('hit',main,0,{maskToken:true}),body('aura','Changing features',550,{maskToken:true,scale:.6,opacity:.35})];
 case 'heroBind':return [body('hit','Thrall conduit',0,{scale:.7}),link('Heroic spirit joins caster',450,{travelOrigin:'target'}),source('aura',main,850,{scale:.65}),echo('Heroic guide',{subject:'source',offsetX:-.3,opacity:.2})];
 case 'undeadCommand':case 'undeadChallenge':return [source('hit','Command spoken',0,{scale:.45,offsetY:-.2}),link('Command connection',300),body('aura',main,650,{scale:.7})];
 case 'bindingRitual':return [body('hit',main,0,{below:true,scale:1.2}),body('aura','Extraplanar invitation',650,{scale:.85,opacity:.5})];
 case 'luckGuard':return [head('hit',main,{scale:.35}),body('aura','Disaster ward',600,{scale:.55,offsetY:.25})];
 case 'starCloak':return [body('hit',main,0,{maskToken:true,opacity:.65}),body('aura','Starlight pinpricks',500,{maskToken:true,scale:1.05})];
 case 'boundary':return [area('hit',main,0,{below:false,opacity:.7}),area('aura','Swirling force fragments',350,{below:false,scale:.95,opacity:.65})];
 case 'blightRitual':return [source('hit',main,0,{saturation:-1,scaleOut:.45,scaleOutDuration:3500}),source('aura','Soil petition',800,{below:true,saturation:-1,opacity:.5})];
 case 'beautyCone':case 'symbolFlash':return [source('hit',main,0,{scale:.45,offsetY:-.3}),fan('aura',r.graph==='beautyCone'?'Beautiful glance':'Blinding light',450,{fanCount:5,scale:.4})];
 case 'visionCurse':case 'darkEyes':return [head('hit',main,{scale:.4}),head('aura','Vision obscured',{delay:650,scale:.6,opacity:.6})];
 case 'skinBlisters':return [body('hit',main,0,{maskToken:true,scale:.55}),body('aura','Caustic fluid retained',700,{scale:.3,offsetY:.2})];
 case 'bloodInfusion':return [body('hit',main,0,{scaleOut:.4,scaleOutDuration:2400}),body('aura','Infusion material',650,{scale:.5,offsetY:.2})];
 case 'coldVeins':return [body('hit',main,0,{maskToken:true,scale:.85,opacity:.35}),...[-.3,.3].map(offsetY=>body('aura','Cold in veins',600,{scale:.35,offsetY}))];
 case 'bloodMark':return [body('hit',main,0,{scale:.5}),body('aura','Blood curse settles',500,{scale:.7,opacity:.4,maskToken:true})];
 case 'dualBreath':return [fan('hit','First cone inhales life',0,{tracks:[track('scale.x',1,.3,3000)],opacity:.55}),source('hit','Breath drawn in',0,{scale:.6,offsetY:-.15}),fan('aura','Second cone restores life',1800,{scale:.3,fanCount:5})];
 case 'bloodTendrils':return [area('hit',main,0,{scale:.85,...tinted('#a53145')}),area('aura','Blood tendril base',500,{below:true,scale:.6})];
 case 'roseField':return [area('aura','Thrall blood feeds ground'),area('hit',main,500,{...tinted('#983e53')})];
 case 'soulPathRitual':return [body('hit',main,0,{scale:.9}),body('aura','Trapped souls petitioned',500,{scale:.5}),body('bolt','Intended release pathway',850,{scale:.7,tracks:[track('position.y',.3,-.4,3200)],opacity:.5})];
 case 'boneClamp':return [body('hit',main,0,{scale:.6,maskToken:true}),body('aura','Skeleton grip',300,{scale:.9,tracks:[track('scale.x',1.2,.7,3000)]})];
 case 'boneWall':case 'graveBridge':case 'vineBridge':return [tiles('hit',main,0,{scale:.8,...(r.graph==='graveBridge'?{saturation:-1}: {})}),tiles('aura',r.graph==='vineBridge'?'Woven plant span':r.graph==='graveBridge'?'Tombstone span':'Reaching bone structure',650,{scale:.4,opacity:.55})];
 case 'gunCry':return [source('hit',main,0,{scale:.6,offsetX:.3}),area('aura','Gunshot sound spreads',350,{below:false})];
 case 'timeRitual':return [area('hit',main,0,{below:false,opacity:.6}),area('aura','Borrowed time symbol',700,{scale:.25,below:false})];
 case 'storedElectricity':return [source('hit',main,0,{maskToken:true}),source('aura','Stored lightning',550,{scale:.65,opacity:.6})];
 case 'lifeTether':return [link(main),body('hit','Spirit bond',500,{scale:.7,opacity:.5}),source('aura','Caster life anchor',700,{scale:.35})];
 case 'oasisRitual':return [area('hit',main,0,{opacity:.55}),area('aura','Spring terrain petition',650,{scale:.6,opacity:.35})];
 case 'windWard':return [area('hit',main,0,{opacity:.65}),area('aura','Condition interdiction',700,{scale:.45,opacity:.35})];
 case 'windCone':return [fan('hit',main),fan('aura','Buffeting air flecks',450,{scale:.3,opacity:.4})];
 case 'waterCone':return [area('area',main,0,{oneShot:true,fadeIn:0,below:false}),fan('aura','Wave spray',450,{scale:.2,opacity:.35})];
 case 'voice':return [source('hit',main,0,{scale:.6,offsetY:-.2}),source('aura','Clear vocal carry',500,{scale:1.25,offsetY:-.15,opacity:.4})];
 case 'foam':return [...[-1,1].map(side=>body('hit',main,0,{scale:.45,offsetX:side*.3,offsetY:.35,tracks:[track('position.y',.3,-.2,3500)]})),body('aura','Foam adheres',750,{scale:.7,maskToken:true,opacity:.4})];
 case 'feetFlame':return [-1,1].map((side,i)=>body(i?'aura':'hit',i?'Foot flame glow':main,i*250,{scale:.4,offsetX:side*.25,offsetY:.4}));
 case 'roseBody':return [body('aura','Initial bloody bloom',0,{scale:.8}),body('hit',main,350,{scale:.9,maskToken:true,...tinted('#9d3152')})];
 case 'fateDrink':return [source('hit',main,0,{scale:.7,offsetY:.3,opacity:.6}),source('aura','Fate undecided',650,{scale:.3,offsetY:-.4})];
 case 'boneDust':return [body('hit',main,0,{scale:.85,saturation:-1,maskToken:true}),body('aura','Bone solidification begins',700,{scale:.55,...tinted('#eee5d3')})];
 case 'glassHerald':return [area('hit',main,0,{scale:.8}),area('aura','Broken reflection body',500,{scale:.7,opacity:.65}),...[-.3,.3].map(offsetX=>area('aura','Fractured time reflection',900,{scale:.35,offsetX,opacity:.4}))];
 case 'rainSea':return [source('aura','Conch call',0,{scale:.65,offsetY:-.15}),area('hit',main,350),area('bolt','Boundless water',800,{opacity:.5})];
 case 'bloodDrain':return [body('hit',main,0,{scale:.75,offsetY:-.25}),link('Blood reaches caster',400,{travelOrigin:'target',...tinted('#b73345')}),source('aura','Blood at mouth',1000,{scale:.3,offsetY:-.2})];
 case 'rally':return [source('hit',main,0,{scale:.65,offsetY:-.2}),area('aura','Allies inspired',450,{opacity:.5})];
 case 'calmArea':return [area('hit',main,0,{opacity:.4,scale:.65}),area('aura','Soothing mental field',600,{opacity:.3})];
 case 'adoration':return [source('hit',main,0,{scale:.7}),area('aura','Captivating aura',600,{opacity:.35})];
 case 'limbMire':return [area('hit',main,0,{scale:.9,below:true}),tiles('aura','Corpse limbs symbol',500,{scale:.25,opacity:.4})];
 case 'interference':return [...wordNodes('hit',main,2),body('aura','Shared magic interferes',650,{scale:.7,tracks:[track('scale.x',1,.3,3000)]})];
 case 'heardName':return [source('aura','Name reaches caster',0,{scale:.65,offsetY:-.2}),...wordNodes('hit',main,2,{subject:'source'})];
 case 'stoneTeeth':return [area('aura','Flowstone ground ruptures'),area('hit',main,450,{...tinted('#998d74')})];
 case 'frogMouth':case 'voiceCurse':return [head('hit',main,{scale:.3,offsetY:-.1}),head('aura',r.graph==='frogMouth'?'Animals await speech':'Throat swelling',{scale:.4,offsetY:-.1,delay:600})];
 case 'camouflage':return [body('hit',main,0,{maskToken:true,opacity:.55}),body('aura','Environmental color veil',600,{maskToken:true,opacity:.25,scale:1.15})];
 case 'colorDrain':return [source('hit','Impossible hand colors',0,{scale:.45,offsetX:.35}),body('aura',main,450,{maskToken:true,saturation:-1}),echo('Drained color echo',{saturation:-1,opacity:.2})];
 case 'flameDivination':return [source('hit',main,0,{scale:.6,offsetY:.3}),source('bolt','Smoke patterns',550,{scale:.65,offsetY:-.05}),head('aura','Future reading',{subject:'source',delay:1000})];
 case 'flameScript':return [body('hit',main,0,{scale:.25,offsetX:.3,tracks:[track('position.x',-.3,.3,3000)]}),body('aura','Concealed inscription',550,{scale:.4,maskToken:true,opacity:.5})];
 case 'protectionCircle':case 'weaknessCircle':return [area('hit',main,0,{opacity:.6}),area('aura',r.graph==='protectionCircle'?'Protected boundary':'Energy susceptibility inscriptions',650,{scale:.65,opacity:.5})];
 case 'temptationRitual':return [...wordNodes('hit',main,3,{subject:'source'}),head('aura','Mortal inhibitions',{subject:'source',delay:600,scale:.45})];
 case 'webbedHands':return [...[-1,1].map(side=>source('hit',main,0,{scale:.3,offsetX:side*.4,offsetY:.1})),source('aura','Cold claws prepared',700,{scale:.3,offsetY:.3})];
 case 'cleanAir':return [area('hit',main,0,{opacity:.55}),area('aura','Contaminants disperse',0,{opacity:.45,scaleOut:.2,scaleOutDuration:3600})];
 case 'feetIce':return [body('hit',main,0,{scale:.55,offsetY:.35}),body('aura','Legs iced',450,{scale:.65,offsetY:.4})];
 case 'shadowHands':return [source('hit',main,0,{below:true,scale:1.1}),...[-1,1].map(side=>source('aura','Shadow grasp prepared',500,{scale:.4,offsetX:side*.4,offsetY:.1,opacity:.6}))];
 case 'colorCloak':return [body('hit',main,0,{maskToken:true}),body('aura','Color folds',500,{maskToken:true,opacity:.55})];
 case 'shadowCloak':return [body('aura','Swirling shadow mantle',0,{maskToken:true,opacity:.65}),area('hit',main,300,{opacity:.5})];
 case 'clockworkArmy':return [area('hit',main,0,{scale:.85}),...[-.5,0,.5].map(offsetX=>area('aura','Arrival halberds',500,{scale:.5,offsetX})),area('bolt','Clockwork tools',900,{scale:.4,opacity:.4})];
 case 'cloneRitual':return [body('aura',main,0,{scale:.35}),echo('Growing duplicate symbol',{scale:.45,offsetX:.8,opacity:.35}),body('hit','Alchemical growth vessel',650,{scale:.65,offsetX:.8,opacity:.45})];
 case 'mistCloak':return [body('hit',main,0,{maskToken:true,opacity:.7}),body('aura','Deflecting cloud motion',500,{scale:1.1,opacity:.35})];
 case 'floatRitual':return [body('hit',main,0,{below:true,saturation:-.6,opacity:.5}),body('aura','Intended lift currents',600,{opacity:.6,tracks:[track('position.y',.35,-.35,3500)]})];
 case 'clownCurse':return [...[-1,1].map(side=>body('hit',main,0,{scale:.3,offsetX:side*.4,offsetY:.35})),head('aura','Ridiculous noise curse',{delay:700,scale:.3})];
 case 'holyDance':return [source('aura','Coiling dance rhythm',0,{scale:.65}),area('hit',main,500,{opacity:.55})];
 case 'fireBody':return [body('hit',main,0,{maskToken:true,scale:1.05}),body('aura','Burning smoke',550,{scale:.8,opacity:.45})];
 case 'communeRitual':case 'contactRitual':return [...wordNodes('hit',main,r.graph==='contactRitual'?3:4,{subject:'source'}),source('aura','Petition attention',700,{scale:.4,offsetY:-.35}),...(r.b?[link('Mental outreach',450,{opacity:.35})]:[])];
 case 'forestSense':return [source('aura','Forest connection',0,{scale:1.1,below:true}),source('hit',main,500,{scale:.8,offsetY:-.25})];
 case 'repairRitual':return [body('hit',main,0,{scale:.55}),body('aura','Repair seams',500,{maskToken:true}),...wordNodes('bolt','Community anecdotes',3)];
 case 'companionShadow':return [echo(main,{offsetX:.4,offsetY:.25,saturation:-1,opacity:.35}),body('hit','Companion shadow base',0,{below:true,offsetX:.4,offsetY:.25}),body('aura','Shadow bond',650,{scale:.65,opacity:.4})];
 case 'competitive':return [source('hit',main,0,{scale:1.15}),source('aura','Competitive focus',600,{scale:.3,offsetY:-.35})];
 case 'mirrorRitual':return [source('aura','Ritual mirror',0,{scale:.8,opacity:.6}),head('hit',main,{subject:'source',scale:.45}),...wordNodes('bolt','Target name invocation',2,{subject:'source'})];
 case 'confetti':return [area('hit',main,0,{opacity:.8}),area('aura','Festival sounds',400,{scale:.75,opacity:.4}),area('bolt','Party cacophony',900,{scale:.6,opacity:.25})];
 case 'castingVeil':return [body('hit',main,0,{maskToken:true,opacity:.6}),...wordNodes('aura','Disguised spell identity',2,{opacity:.5})];
 case 'warble':return [source('hit',main,0,{scale:.65,offsetY:-.2}),...[-25,25].map(rotation=>area('aura','Warbling sound field',500,{rotation,opacity:.55}))];
 case 'limbConstruct':return [area('hit',main,0,{scale:1.3}),area('aura','Undead limb mass',500,{scale:.6})];
 case 'cogField':return [tiles('hit',main,0,{scale:.45}),tiles('aura','Interlocking mechanism',650,{scale:.35,rotation:90,opacity:.5})];
 case 'woodVehicle':case 'cabin':return [area('hit',main,0,{opacity:.65}),area('aura',r.graph==='cabin'?'Cabin hearth':'Plant matter framework',700,{scale:r.graph==='cabin'?.25:.8,opacity:.5})];
 case 'armyHerald':return [...[-.35,.35].map(offsetX=>area('hit',main,0,{scale:.75,offsetX,opacity:.5})),area('aura','Arrival victory cry',500,{scale:1.2}),area('bolt','Military herald rhythm',800,{scale:.5,opacity:.4})];
 case 'consecrateSite':case 'keystoneRitual':return [area('hit',main,0,{scale:.35,opacity:.65}),area('aura','Sacred site invocation',650,{opacity:.5})];
 case 'holyBody':return [source('hit',main,0,{scale:.75,maskToken:true}),source('aura','Holy energy settles',650,{maskToken:true,opacity:.5})];
 case 'mindscapeRitual':return [source('hit',main,0,{scale:.5,offsetY:-.35}),source('aura','Imagined boundary',550,{scale:1.15,opacity:.5})];
 case 'thought':case 'beliefWords':return [...wordNodes('hit',main,r.graph==='thought'?2:3),head('aura','Mind receives words',{delay:650})];
 case 'waterLevel':return [area('hit',main,0,{opacity:.7}),area('aura','Water responds',500,{opacity:.45,tracks:[track('scale.y',.8,1.1,3000,{loop:true,pingPong:true})]})];
 case 'weatherRitual':return [source('hit',main,0,{scale:1.1}),source('aura','Weather potential',650,{scale:.65,offsetY:-.45,opacity:.5})];
 case 'coralField':return [area('hit',main,0,{...tinted('#db8d88')}),area('aura','Reef terrain',500,{opacity:.35})];
 case 'coralBody':return [...[-1,1].map(side=>body('hit',main,0,{scale:.3,offsetX:side*.35,offsetY:.15,...tinted('#dca79e')})),body('aura','Aquatic growth',650,{scale:.3,offsetY:.3})];
 case 'corpseLore':return [source('hit',main,0,{scale:.45,offsetY:.35}),...wordNodes('aura','Lore of the dead',4,{subject:'source'})];
 case 'acidPools':return [area('hit',main,0,{...tinted('#8fa863'),opacity:.75}),area('aura','Acid pool vapor',700,{...tinted('#b3bb80'),opacity:.25,scale:.6})];
 case 'counterPerformance':return [source('hit',main,0,{scale:.8,maskToken:true}),area('aura','Performance protection',500,{scale:.65,opacity:.45})];
 case 'anthem':return [source('hit',main,0,{scale:.65,offsetY:-.2}),area('aura','Allied courage',550,{opacity:.45})];
 case 'soilFigurine':return [body('hit',main,0,{scale:.35,offsetX:.35,offsetY:.05,scaleIn:.7,scaleInDuration:2200}),body('aura','Soil hardens',650,{scale:.3,offsetX:.35,opacity:.4,...tinted('#9e8265')})];
 case 'fungusRitual':return [body('hit',main,0,{maskToken:true,...tinted('#b7b195')}),body('aura','Spore invocation',600,{scale:.8,opacity:.5})];
 case 'thrall':case 'undeadRitual':return [area('aura',r.graph==='thrall'?'Undead arrival mist':'Undead invocation',0,{scale:.85,opacity:.55}),area('hit',main,500,{scale:.55})];
 case 'handsWater':return [...[-1,1].map(side=>source('hit',main,0,{scale:.35,offsetX:side*.3,offsetY:.1})),source('aura','Water collects',650,{below:true,scale:.65,offsetY:.4})];
 case 'moltenIron':return [body('hit',main,0,{scale:1.05,tracks:[track('position.y',-.5,.35,3000)],...tinted('#e68a40')}),body('aura','Iron surface cools',900,{maskToken:true,saturation:-1,opacity:.65})];
 case 'mandate':return [source('hit',main,0,{scale:.45,offsetY:-.2}),link('Divine mandate',350),body('aura','Cause conveyed',650,{scale:.45})];
 case 'sonicCone':case 'eagleCry':case 'lifeCone':return [source('hit',main,0,{scale:.55,offsetY:-.2}),fan('hit',main,350,{scale:.55}),fan('aura',r.graph==='lifeCone'?'Vitality in cone':r.graph==='eagleCry'?'Eagle cry accents':'Sound harmonics',750,{scale:.3,opacity:.45,fanCount:5})];
 case 'thirst':return [head('hit',main,{scale:.35,offsetY:-.1,scaleOut:.3,scaleOutDuration:3000}),body('aura','Dryness curse',600,{maskToken:true,saturation:-1,opacity:.45})];
 case 'misfortuneRitual':return [source('hit',main,0,{scale:.4,offsetY:-.4}),source('aura','Calamity petition',650,{scale:.55,below:true,opacity:.45})];
 case 'heartClamp':return [body('hit',main,0,{scale:.45}),body('aura','Heart grip',450,{scale:.7,tracks:[track('scale.x',1.3,.6,3000)]})];
 case 'aging':return [body('hit',main,0,{maskToken:true,saturation:-1,opacity:.65}),echo('Aging surface',{saturation:-1,opacity:.2}),body('aura','Erosion veil',700,{maskToken:true,opacity:.45})];
 case 'armCurse':return [...[-1,1].map(side=>body('hit',main,0,{scale:.45,offsetX:side*.35})),body('aura','Kickback curse sealed',700,{scale:.35,offsetY:.25})];
 case 'metamorphosis':return [body('hit',main,0,{maskToken:true}),echo('Changing outline',{opacity:.2,scale:.75}),body('aura','Transformation potential',650,{scale:.75,opacity:.45})];
 case 'enviousEyes':return [head('hit',main,{subject:'source',scale:.5}),source('aura','Defensive stolen power',650,{scale:.65})];
 case 'bloodPact':case 'demonPact':case 'devilPact':case 'divPact':return [source('hit',main,0,{scale:.55,offsetY:.25}),...wordNodes('aura','Terms petitioned',3,{subject:'source'}),source('bolt','Planar invitation',850,{scale:1.1,opacity:.35})];
 case 'darkDance':return [source('aura','Dance shadow',0,{scale:.9,below:true}),area('hit',main,500,{opacity:.7})];
 case 'darkVision':return [head('hit',main,{scale:.5}),head('aura','Greater darkvision',{delay:650,scale:.3})];
 case 'goldLight':return [body('hit',main,0,{scale:.5,...tinted('#ffe9a9')}),area('hit','Golden light radius',500,{opacity:.25,...tinted('#ffe9a9')}),body('aura','Truth revealing cue',850,{scale:.35,offsetY:-.3})];
 case 'daydreamCurse':case 'daydreamLure':return [head('hit',main,{scale:.7,opacity:.6}),head('aura',r.graph==='daydreamLure'?'Dream image potential':'Drifting attention',{scale:.4,delay:650})];
 case 'snuffLife':return [body('hit',main,0,{scale:.45,scaleOut:.15,scaleOutDuration:3000,saturation:-1}),body('aura','Death invocation',600,{scale:.4,opacity:.55})];
 case 'deathVitality':return [source('hit',main,0,{scale:.45}),source('aura','Vitality gathers inward',450,{scale:.9,opacity:.6})];
 case 'disguise':case 'temperatureVeil':return [body('hit',main,0,{maskToken:true,opacity:.6}),body('aura',r.graph==='disguise'?'Unknown guise veil':'Apparent warmth veiled',550,{scale:.75,opacity:.35,maskToken:true})];
 case 'breath':return [source('hit',main,0,{scale:.65,offsetY:-.1,tracks:[track('scale.x',1.2,.5,3000),track('scale.y',1.2,.5,3000)]}),source('aura','Breath held',900,{scale:.35,offsetY:.1,opacity:.45})];
 case 'prescience':return [source('hit','Eyes foresee attack',0,{scale:.5,offsetY:-.35}),echo('Possible attacker moments',{copies:2,copySpread:.25,opacity:.18}),body('aura',main,550,{scale:.8,opacity:.45})];
 case 'dryBody':return [body('hit',main,0,{maskToken:true,scaleOut:.3,scaleOutDuration:3500}),body('aura','Dehydration fragments',700,{opacity:.5,saturation:-1})];
 case 'mindUnravel':return [...wordNodes('hit',main,3,{subject:'source',scaleOut:.2,scaleOutDuration:3200}),source('bolt','Anchor ideas loosen',500,{scale:.85,opacity:.5}),source('aura','Memory flashes',1000,{scale:.65,opacity:.35})];
 case 'voidMouths':return [area('hit',main,0,{opacity:.6}),...[-.35,0,.35].map(offsetX=>area('aura','Spatial mouth',650,{scale:.35,offsetX,opacity:.65}))];
 case 'diadem':return [source('hit',main,0,{scale:.5,offsetY:-.45}),source('aura','Diadem light',650,{scale:.4,offsetY:-.45}),area('hit','Radiant light radius',700,{opacity:.15})];
 case 'iceCrystals':return [area('hit',main),tiles('aura','Refracting ice flecks',650,{scale:.25,opacity:.6})];
 case 'darkFlicker':return [source('hit',main,0,{opacity:.55,maskToken:true}),source('aura','Shadow flicker',650,{opacity:.45,maskToken:true})];
 case 'fort':return [area('hit',main,0,{opacity:.65}),...[-.6,.6].flatMap(offsetX=>[-.6,.6].map(offsetY=>area('aura','Dinosaur adornment symbols',650,{scale:.3,offsetX,offsetY,opacity:.55})))];
 case 'lieNotes':return [...[-1,1].map(side=>source('hit',main,0,{scale:.3,offsetX:side*.35,offsetY:-.2})),head('aura','Perception listens',{subject:'source',delay:650,scale:.4})];
 case 'crackleItem':return [body('hit',main,0,{maskToken:true}),body('aura','Magic structure disjoins',650,{scaleOut:.3,scaleOutDuration:3200,opacity:.6})];
 case 'unweave':return [body('hit',main,0,{scaleOut:.25,scaleOutDuration:3500}),body('aura','Loosened magic fragments',750,{opacity:.55})];
 case 'globe':return [area('hit',main,0,{below:false}),area('aura','Counteracting boundary',600,{below:false,scale:.9,opacity:.5})];
 case 'chatter':return [...[-.35,0,.35].map((offsetX,i)=>head('hit',main,{offsetX,offsetY:-.15,scale:.45,delay:i*200})),...wordNodes('aura','Overlapping voices',3)];
 case 'divineCataclysm':return [area('hit',main,0,{scale:1.1}),area('aura','Divine destructive force',550,{scale:.9,opacity:.55})];
 case 'litany':return [source('hit',main,0,{scale:.45,offsetY:-.2}),area('bolt','Mandate voice',450),area('aura','Spirit force',750,{opacity:.65})];
 case 'dragonWatch':return [head('hit',main,{scale:.55,opacity:.55}),body('aura','Watcher protects',700,{scale:.6,opacity:.55})];
 case 'refreshMagic':return [body('hit',main,0,{scale:1.05}),...wordNodes('aura','Recovered magic potential',3,{scale:.3})];
 case 'divineWrath':return [area('hit',main),area('aura','Divinity mandate',700,{scale:.55,opacity:.6})];
 case 'futureSight':return [head('hit',main),head('aura','Future die value',{scale:.3,offsetX:.35,delay:650})];
 case 'divineDisconnect':return [body('hit',main,0,{scale:.5}),body('aura','Divine threads loosen',550,{scale:.85,scaleOut:.25,scaleOutDuration:3500})];
 case 'quietDome':return [area('hit',main,0,{below:false,opacity:.6}),area('aura','Outside sound excluded',650,{scale:.3,opacity:.6})];
 case 'command':return [source('hit','Commands spoken',0,{scale:.4,offsetY:-.2}),link('Mental command channel',350),head('aura',main,{delay:700,scale:.6})];
 case 'rainField':return [area('hit',main,0,{below:false}),area('aura','Rain vapor',750,{opacity:.3,scale:.7})];
 case 'unselectedBreath':return [source('aura','Breath power gathers',0,{scale:.5,offsetY:-.15}),fan('hit',main,450,{scale:.4,fanCount:7,opacity:.65})];
 case 'tower':return [area('hit',main,0,{scale:1,below:false,opacity:.65}),area('aura','Bound dragon presence',650,{scale:.7,below:false,opacity:.45})];
 case 'leySiphon':return [source('aura','Planar energy draws inward',0,{scale:1.25,opacity:.5}),...Array.from({length:6},(_,i)=>{const theta=i*Math.PI/3;return source('hit',main,i*180,{scale:.3,offsetX:Math.cos(theta)*.65,offsetY:Math.sin(theta)*.65});}),link('Ley line conduction',650,{opacity:.4})];
 case 'fangHand':return [source('hit',main,0,{scale:.4,offsetX:.35,offsetY:.1}),body('aura','Initial blood drawn',450,{scale:.65})];
 case 'dreamMeet':return [head('hit',main,{scale:.4}),link('Dream invitation',400,{opacity:.4}),...wordNodes('aura','Dream conversation',3)];
 case 'sleepPotential':return [head('hit',main,{scale:.4}),...wordNodes('aura','Potential explored in dream',3),echo('Dream possibilities',{copies:2,copySpread:.25,opacity:.15})];
 case 'illusoryCorpse':return [echo(main,{rotation:90,offsetY:.25,opacity:.75}),body('hit','Illusion separates from target',0,{maskToken:true,opacity:.55}),body('aura','Corpse illusion texture',700,{scale:.65,offsetY:.25,opacity:.25})];
 case 'ambition':return [head('hit',main,{scale:.65,opacity:.6}),head('aura','Misfortune in initiative',{scale:.3,delay:750,saturation:-1})];
 case 'duplicate':return [echo(main,{offsetX:1,opacity:.75}),body('hit','Adjacent duplicate shimmer',0,{offsetX:1}),body('aura','Unstable duplicate essence',700,{offsetX:1,scale:.65,opacity:.4})];
 case 'challenge':return [link(main),head('hit','Attention on challenger',{delay:400}),source('aura','Mutual challenge bond',650,{scale:.7,opacity:.55})];
 case 'groundWeight':return [body('hit',main,0,{below:true,scale:.7}),body('aura','Gravity binding threads',500,{scale:.8,...tinted('#9b7a55'),tracks:[track('position.y',-.25,.35,3000)]})];
 case 'barriers':return [area('hit',main,0,{saturation:-.6}),tiles('aura','Small earth barriers',650,{scale:.35,saturation:-.6})];
 case 'ingestFire':return [source('hit',main,0,{scale:.55,offsetY:-.1,scaleOut:.15,scaleOutDuration:3200}),source('aura','Smoke retained',900,{maskToken:true,scale:.65,opacity:.35})];
 case 'teleportEcho':return [echo(main,{subject:'source',opacity:.3}),source('hit','Teleport departure shimmer',0,{scale:.85}),area('aura','Echo force explosion',550,{subject:'source',scale:1.1})];
 case 'eclipse':return [area('hit',main,0,{opacity:.7}),area('aura','Freezing shadow crystals',550,{opacity:.65})];
 case 'ectoplasm':return [body('hit',main,0,{maskToken:true}),body('aura','Affliction carried outward',650,{opacity:.55})];
 case 'interstice':return [area('hit',main,0,{opacity:.5}),area('aura','Ethereal physical overlap',650,{opacity:.55,rotation:45})];
 case 'unselectedEnergy':return spell.delivery==='cone'?[fan('hit',main),fan('aura','Unselected energy',550,{scale:.25,opacity:.45})]:spell.delivery==='line'?[tiles('hit',main),tiles('aura','Unselected energy',550,{scale:.45,opacity:.4})]:[area('hit',main),area('aura','Unselected energy',550,{opacity:.4})];
 case 'soulDisrupt':return [body('hit',main,0,{maskToken:true}),echo('Soul connection strain',{offsetY:-.25,opacity:.25}),body('aura','Body soul resonance',650,{opacity:.4})];
 case 'crystalLock':return [body('hit',main,0,{scale:.4}),body('aura','Latent electricity',650,{scale:.45,opacity:.6})];
 case 'glider':return [source('hit',main,0,{scale:1.1,offsetY:-.5}),source('aura','Air currents available',650,{scale:.8,offsetY:.3,opacity:.5})];
 case 'absorbElements':case 'energyGuard':return [source('hit',main,0,{scale:1.1}),source('aura',r.graph==='absorbElements'?'Stored elemental protection':'Initial energy absorbed',650,{scale:.75})];
 case 'annihilationCone':return [area('area',main,0,{oneShot:true,fadeIn:0,below:false}),fan('aura','Destructive elemental pressure',350,{scale:.45})];
 case 'elementCounter':return [body('hit',main,0,{scale:.9}),body('aura','Opposed elemental cycle',650,{scale:.65,tracks:[track('scale.x',1,.35,3200)]})];
 case 'sentinelRitual':return [body('aura','Wisp containment rite',0,{scale:.7}),head('hit',main,{scale:.35})];
 case 'servitorRitual':return [...wordNodes('hit',main,3,{subject:'source'}),source('aura','Unselected elemental offering',650,{scale:.75,opacity:.45})];
 case 'tempestPrep':return [source('hit',main,0,{scale:.7}),source('aura','Next spell remains uncast',650,{scale:.55,opacity:.45})];
 case 'elementZone':return [area('hit',main,0,{opacity:.6}),area('aura','Unselected elemental potential',650,{opacity:.45})];
 case 'bodyFont':return [...wordNodes('hit','Magic item power',3,{offsetY:.25}),body('aura',main,650,{opacity:.55,maskToken:true})];
 case 'battleApparition':return [echo(main,{subject:'source',offsetX:-.4,opacity:.25}),source('hit','Apparition guidance',0,{maskToken:true,opacity:.45}),source('aura','Martial empowerment',650,{scale:1.05})];
 case 'nothingBody':return [source('hit',main,0,{below:true,opacity:.4}),source('aura','Substance thins',500,{maskToken:true,opacity:.3}),echo('Empty outline',{subject:'source',opacity:.12})];
 case 'leyBoost':case 'nexusRitual':return [link(r.graph==='nexusRitual'?'Converging ley lines':'Ambient ley energy'),body('hit',main,450,{scale:.9}),body('aura','Node focus',800,{scale:.45}),...(r.graph==='nexusRitual'?[-45,45].map(rotation=>body('hit','Intersecting node threads',950,{scale:.8,rotation,opacity:.4})):[])];
 case 'emptyMind':return [head('hit',main,{scale:.75,opacity:.55}),head('aura','Emotion counteracted',{scale:.3,delay:650,scaleOut:.1,scaleOutDuration:3200,saturation:-1})];
 case 'packVeil':return [body('hit',main,0,{maskToken:true,opacity:.45}),body('aura','Hidden contents',650,{scale:.35,opacity:.25,maskToken:true})];
 case 'woodPetition':return [body('hit',main,0,{scale:1.2,below:true}),...wordNodes('aura','Forest spirit attention',3,{offsetY:.15,opacity:.45})];
 case 'mightyGuard':return [source('hit',main,0,{scale:1.15}),source('aura','Strength divine protection',650,{maskToken:true,opacity:.5})];
 case 'gourmet':return [body('hit',main,0,{scale:.7,offsetY:-.2,opacity:.5}),body('aura','Food finish',650,{scale:.35})];
 case 'entrancingEye':return [source('hit',main,0,{scale:.55,offsetY:-.35}),area('aura','Entrancing gaze range',600,{opacity:.2})];
 case 'spiralSpirits':return [source('hit',main,0,{scale:1.15}),echo('Bonded spirit echoes',{subject:'source',copies:3,copySpread:.45,opacity:.22}),area('hit','Spirit cyclone',500,{rotation:45}),area('aura','Colorful spiritual forms',750,{opacity:.4})];
 case 'thunderbirdRitual':return [source('hit',main,0,{scale:.95,offsetY:-.35}),source('aura','Tempestuous petition',450,{scale:.7}),source('bolt','Thunderbird storm signs',900,{scale:.75,opacity:.5})];
 case 'thermalWheel':return [-1,1].map((side,i)=>source(i?'aura':'hit',i?'Cold thermal mote':main,0,{scale:.45,offsetX:side*.45,tracks:[track('rotation',0,360,4500)]}));
 case 'speedHamper':return [body('hit',main,0,{scale:.6,offsetY:.35}),body('aura','Footing impeded',600,{scale:.35,offsetY:.45,saturation:-1})];
 case 'traceErase':return [tiles('hit',main,0,{scale:.3,opacity:.6,scaleOut:.1,scaleOutDuration:3500}),area('aura','Trail disturbance settles',650,{opacity:.4})];
 case 'renewalPrepared':return [source('hit',main,0,{scale:.4,offsetX:-.3}),source('aura','Death threshold preparation',650,{scale:.35,offsetX:.3,opacity:.55})];
 case 'gemLight':return [body('hit',main,0,{scale:.35}),body('aura','Gemstone glow',600,{scale:.55}),area('aura','Light radius',650,{opacity:.25})];
 case 'resentfulEye':return [source('hit',main,0,{scale:.5,offsetY:-.35}),head('aura','Patron resentment',{scale:.4,delay:650,opacity:.65})];
 case 'swapVisage':return [link(main),body('hit','Target visage veil',350,{maskToken:true}),source('hit','Caster visage veil',650,{maskToken:true}),body('aura','Shared illusion threads',950,{opacity:.45})];
 case 'demise':return [body('hit',main,0,{scale:.5}),body('aura','Life boundary invocation',500,{scale:.8,scaleOut:.3,scaleOutDuration:3000})];
 case 'fluidExpel':return [body('hit',main,0,{scale:1.05}),body('aura','Fluid expelled outward',550,{...tinted('#ab3444'),opacity:.6})];
 case 'bloodExtend':case 'bondExtend':case 'spellExtend':return [source('hit',main,0,{scale:.55,maskToken:r.graph==='bloodExtend'}),source('aura',r.graph==='bondExtend'?'Extended bond potential':r.graph==='spellExtend'?'Duration held':'Ancient blood lore',650,{scale:.4,offsetY:-.35})];
 case 'brainRitual':return [head('hit',main,{scale:.5}),head('bolt','Delicate extraction pathway',{delay:500,scale:.65}),head('aura','Brain preservation symbol',{delay:950,scale:.35,offsetX:.5})];
 case 'debrisCover':return [area('hit',main,0,{opacity:.55}),area('aura','Semi real cover veil',650,{opacity:.3})];
 case 'undeadSenses':return [source('hit','Caster enters senses trance',0,{scale:.45,offsetY:-.35}),link('Undead perception connection',350,{opacity:.5}),head('hit',main,{delay:750}),body('aura','Undead subject',950,{scale:.35,below:true})];
 case 'crowd':return [echo('Crowd guise silhouettes',{subject:'source',copies:3,copySpread:.4,saturation:-.7,opacity:.15}),source('hit',main,0,{maskToken:true,opacity:.45}),source('aura','Bland outline',650,{below:true,opacity:.25})];
 case 'tinyAvatar':return [echo(main,{subject:'source',scale:.2,offsetX:.4,offsetY:-.3,opacity:.85}),source('hit','Avatar sorts memories',300,{scale:.25,offsetX:.4,offsetY:-.4}),source('aura','Memory detail',750,{scale:.15,offsetX:.4,offsetY:-.3})];
 case 'dustField':return [area('hit',main,0,{opacity:.75}),area('aura','Trickery dust',650,{opacity:.5,scale:.65})];
 case 'faerieOutline':return [area('hit',main,0,{opacity:.55}),body('aura','Limned creature outline',600,{maskToken:true,scale:1.05})];
 case 'ghostLament':return [echo(main,{opacity:.55,saturation:-.6}),body('hit','Ghost mist',0,{opacity:.35}),body('aura','Illusory battlefield lament',650,{scale:1.4,opacity:.55})];
 case 'fallingStars':return [area('hit',main,0,{scale:1.1,tracks:[track('position.y',-.55,0,2500)],below:false}),area('aura','Central physical collision',1600,{scale:.25}),area('hit','Unselected star energy',2100,{opacity:.65})];
 case 'objectFalse':return [source('aura','Declarative illusion',0,{scale:.35,offsetY:-.2}),body('hit',main,400,{maskToken:true,opacity:.65})];
 case 'scryFalse':return [area('hit',main,0,{opacity:.4}),area('aura','Scrying senses diverted',650,{scale:.45,opacity:.55})];
 case 'facadeRitual':return [source('hit',main,0,{scale:1.25,opacity:.5}),...wordNodes('aura','Programmed illusions petitioned',4,{subject:'source'})];
 case 'fateDuel':return [link('Threads of confrontation'),body('hit',main,500,{scale:1.15,opacity:.55}),body('aura','Third party fate boundary',900,{scale:1,opacity:.6})];
 case 'hungerDust':return [body('hit',main,0,{scale:.55,offsetY:.15,opacity:.6}),body('aura','Hunger curse settles',650,{maskToken:true,opacity:.45,saturation:-1})];
 case 'ironBells':return [source('hit',main,0,{scale:.5,offsetY:.2}),...wordNodes('aura','Cold iron wards',3,{subject:'source',offsetY:.35})];
 case 'lifeField':return [area('hit',main,0,{opacity:.45}),area('aura','Rejuvenating warmth',650,{opacity:.4})];
 case 'wireField':return [area('hit',main,0,{saturation:-1,...tinted('#8c969b')}),tiles('aura','Metal prong glints',750,{scale:.2,opacity:.65})];
 case 'fiendRift':return [area('hit',main,0,{opacity:.65}),area('aura','Fiend appendages reach',450,{scale:.9})];
 case 'lungFilter':return [source('hit',main,0,{scale:.7,offsetY:.1,tracks:[track('scale.x',1,.4,3000)]}),source('aura','Harmful molecules disperse',650,{maskToken:true,scaleOut:.2,scaleOutDuration:3200,opacity:.4})];
 case 'fireResistObject':return [body('hit',main,0,{scale:.85}),body('aura','Heat barrier settles',650,{maskToken:true,scale:.6,opacity:.45})];
 default:throw Error(`Unhandled reviewed gap A graph: ${r.graph}`);
 }
}
