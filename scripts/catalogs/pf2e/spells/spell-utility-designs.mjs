// Largest formerly identical utility cluster: all 66 complete native descriptions
// individually read. These are finite illustrations, never save outcomes or rules.
const motif = (label, pattern, roots, symbolic = false) => ({label,pattern,...roots,...(symbolic?{symbolic:true}:{})});
export const UTILITY_SPELL_MOTIFS = {
  edibleObject:motif('Object softens into edible substance','edibleObject',{hit:'liquid.blob',aura:'magic_signs.rune.transmutation'},true),
  animatedRope:motif('Rope coils and responds','animatedRope',{hit:'markers.chain.spectral_standard.complete',aura:'energy_strands.complete'},true),
  loadBearing:motif('Musculoskeletal reinforcement','loadBearing',{hit:'energy_strands.complete',aura:'on_token_buff.001.001'},true),
  perilForesight:motif('Brief foresight at eyes','perilForesight',{hit:'eyes.01',aura:'ward.star'}),
  constellationGuide:motif('Constellation grants insight','constellationGuide',{hit:'twinkling_stars',aura:'ward.star'}),
  sightOcclusion:motif('Eyes dim behind an obscuring veil','sightOcclusion',{hit:'darkness.black',aura:'eyes.01'},true),
  mouthPocket:motif('Small extradimensional mouth entrance','mouthPocket',{hit:'portals.vertical.vortex',aura:'shimmer'},true),
  glitterTrail:motif('Glittering foot-level trail','glitterTrail',{hit:'glint',aura:'twinkling_stars'}),
  curseTransfer:motif('Curse threads drawn back to caster','curseTransfer',{bolt:'energy_strands.range.standard',hit:'energy_strands.complete',aura:'magic_signs.rune.necromancy'},true),
  cuisineCleanse:motif('Food cleansed and enhanced','cuisineCleanse',{hit:'liquid.blob',aura:'swirling_sparkles'},true),
  nearFocus:motif('Sharp near vision and hazy periphery','nearFocus',{hit:'eyes.01',aura:'fog_cloud,smoke'},true),
  currentLink:motif('Shared current with enemy','currentLink',{bolt:'energy_strands.range.standard',hit:'wind_lines',aura:'glint'},true),
  objectFloat:motif('Held object floats nearby','objectFloat',{hit:'shimmer',aura:'glint'},true),
  timeWeariness:motif('A day of weariness passes over body','timeWeariness',{hit:'magic_signs.circle.01.divination',aura:'shimmer'},true),
  hearingMute:motif('Hearing wave falls quiet','hearingMute',{hit:'soundwave.02',aura:'music_notations'},true),
  corpseDecay:motif('Decay begins around corpse','corpseDecay',{hit:'smoke.plumes_loop,smoke',aura:'particles.outward'},true),
  diabolicTask:motif('Diabolic task seal','diabolicTask',{hit:'magic_signs.rune.enchantment',aura:'ward.rune'},true),
  patronSecrets:motif('Whispered secrets sharpen perception','patronSecrets',{hit:'eyes.01',aura:'particle_burst.01.rune'},true),
  flutterDecoy:motif('Colorful fluttering distraction','flutterDecoy',{hit:'butterflies.single',aura:'glint'}),
  elementalWeakness:motif('Elemental vulnerability mark','elementalWeakness',{hit:'magic_signs.rune.transmutation',aura:'template_circle.aura.04.inward'},true),
  enduringMind:motif('Encouraging endurance and temporary vitality','enduringMind',{hit:'icon.heart',aura:'on_token_buff.001.001'},true),
  familiarSensor:motif('Companion senses become a remote sensor','familiarSensor',{hit:'eyes.01',aura:'magic_signs.rune.divination'},true),
  corpseJourney:motif('Last journey glimpsed from corpse','corpseJourney',{hit:'eyes.01',aura:'glint'},true),
  floatingHarness:motif('Harness supports companion nearby','floatingHarness',{hit:'markers.chain.spectral_standard.complete',aura:'shimmer'},true),
  voiceQuiet:motif('Voice reduced to whispers','voiceQuiet',{hit:'music_notations',aura:'soundwave.02'},true),
  summonFortitude:motif('Summoned ally gains resilience','summonFortitude',{hit:'shield.01.intro',aura:'on_token_buff.001.001'}),
  friendlyPropulsion:motif('Willing creature gently propelled','friendlyPropulsion',{hit:'wind_lines',aura:'energy_strands.complete'},true),
  geckoPurchase:motif('Clinging grip at hands and feet','geckoPurchase',{hit:'web.01',aura:'swirling_leaves'},true),
  genieVanish:motif('Colored smoke conceals and reveals','genieVanish',{hit:'smoke.puff.centered',aura:'swirling_sparkles'}),
  companionGroom:motif('Dirt lifts from companion','companionGroom',{hit:'particles.outward',aura:'glint'},true),
  healerPromise:motif('Vital connection blessed for later healing','healerPromise',{hit:'icon.heart',aura:'ward.star'},true),
  psychicImprint:motif('Psychic message pressed into object','psychicImprint',{hit:'particle_burst.01.rune',aura:'magic_signs.rune.divination'},true),
  inertiaAnchor:motif('Object anchored to exact spot','inertiaAnchor',{hit:'ward.rune',aura:'glint'},true),
  escapeCommand:motif('Liberating cry loosens restraint','escapeCommand',{hit:'markers.chain.standard.complete',aura:'particle_burst.01.rune'},true),
  heldItemFuse:motif('Held object bound to hand','heldItemFuse',{hit:'markers.chain.spectral_standard.complete',aura:'energy_strands.complete'},true),
  companionHide:motif('Protective hide thickens on companion','companionHide',{hit:'shield.01.intro',aura:'swirling_leaves'},true),
  mistPiercing:motif('Eyes discern through mist','mistPiercing',{hit:'eyes.01',aura:'fog_cloud,smoke'},true),
  odorErase:motif('Scent veil quietly dissipates','odorErase',{hit:'fumes,smoke',aura:'glint'},true),
  fateNudge:motif('A small twist of fate','fateNudge',{hit:'energy_strands.02.marker',aura:'ward.star'},true),
  objectExpertise:motif('Past expertise echoes from tool','objectExpertise',{hit:'magic_signs.rune.divination',aura:'eyes.01'},true),
  objectPsychometry:motif('Object emotional history revealed','objectPsychometry',{hit:'eyes.01',aura:'magic_signs.rune.divination'},true),
  suddenMeal:motif('Food fills the recipient','suddenMeal',{hit:'liquid.blob',aura:'icon.heart'},true),
  paintedSensor:motif('Small drawn scout forms on stone','paintedSensor',{hit:'eyes.01',aura:'magic_signs.rune.divination'},true),
  preservedCorpse:motif('Quiet preservative ward on corpse','preservedCorpse',{hit:'ward.rune',aura:'shimmer'},true),
  companionPocket:motif('Companion drawn into pocket dimension','companionPocket',{hit:'portals.vertical.vortex',aura:'swirling_sparkles'},true),
  physiqueBoost:motif('Physical capacity briefly reinforced','physiqueBoost',{hit:'on_token_buff.001.001',aura:'energy_field'},true),
  practicedCorrection:motif('A failed effort receives correction','practicedCorrection',{hit:'magic_signs.rune.divination',aura:'glint'},true),
  objectSorting:motif('Scattered groups settle into ordered piles','objectSorting',{hit:'particle_burst.01.rune',aura:'glint'},true),
  environmentalAdaptation:motif('Environment lends a bodily adaptation','environmentalAdaptation',{hit:'particles.inward',aura:'shimmer'},true),
  garmentRestyle:motif('Appearance sweeps across existing garment','garmentRestyle',{hit:'shimmer',aura:'swirling_sparkles'},true),
  retrievingHook:motif('Magical hook reaches out and draws inward','retrievingHook',{bolt:'energy_strands.range.standard',hit:'markers.chain.spectral_standard.complete',aura:'glint'},true),
  gratitudeVitality:motif('Reciprocal aid becomes temporary vitality','gratitudeVitality',{hit:'icon.heart',aura:'ward.star'},true),
  biologicalDisarray:motif('Localized nauseating biological distortion','biologicalDisarray',{hit:'fumes,energy_field',aura:'shimmer'},true),
  sharedEyes:motif('Two participants share sight','sharedEyes',{bolt:'energy_strands.range.standard',hit:'eyes.01',aura:'glint'},true),
  tinySigil:motif('Small personal sigil placed on target','tinySigil',{hit:'icon.runes',aura:'glint'},true),
  brinyFaceTendril:motif('Blue portal and briny face tentacle','brinyFaceTendril',{hit:'black_tentacles',aura:'portals.vertical.vortex'},true),
  timedSigil:motif('Quiet timed sigil is set','timedSigil',{hit:'icon.runes',aura:'ward.rune'},true),
  movementPair:motif('Matching foot sigils link willing movers','movementPair',{hit:'magic_signs.rune.enchantment',aura:'wind_lines'},true),
  tetherConnection:motif('Tether joins target and caster','tetherConnection',{bolt:'energy_strands.range.standard',hit:'markers.chain.standard.complete',aura:'energy_strands.complete'},true),
  gossipInsight:motif('Chattering echo reveals a weakness','gossipInsight',{hit:'butterflies.single',aura:'eyes.01'},true),
  languageMeaning:motif('Written and spoken meaning becomes clear','languageMeaning',{hit:'particle_burst.01.rune',aura:'magic_signs.rune.divination'},true),
  weaponOverlays:motif('Legendary weapon images overlay broken weapon','weaponOverlays',{hit:'shimmer',aura:'glint'},true),
  eidolonUnfetter:motif('Eidolon link loosens without relocation','eidolonUnfetter',{hit:'markers.chain.spectral_standard.complete',aura:'energy_strands.complete'},true),
  alluringMusk:motif('Musk draws faint traces inward','alluringMusk',{hit:'fumes,smoke',aura:'particles.inward'},true),
  weaknessInsight:motif('Gaze identifies a foe weak point','weaknessInsight',{hit:'hunters_mark',aura:'eyes.01'},true),
  companionWatch:motif('Watchful companion receives an alert ward','companionWatch',{hit:'eyes.01',aura:'ward.star'},true),
};
export const UTILITY_SPELL_DESIGNS = {
  allfood:['edibleObject','An unattended object becomes bland gooey food; a soft localized material transition illustrates this. No healing or creature attack. Food artwork is a symbolic liquid substitute.'],
  'animate-rope':['animatedRope','The rope coils, loops and responds. Local chain/strand artwork stands in for rope. Bind, Crawl and later commands are player choices, not automatic attacks or movement of a creature.'],
  'ant-haul':['loadBearing','Low body reinforcement suggests stronger weight bearing. No increased body size, leap or attack; Bulk changes remain rules.'],
  'anticipate-peril':['perilForesight','One eye-level glimpse and alert star express brief foresight before initiative, without a damaging impact.'],
  'beseech-the-sphinx':['constellationGuide','A small constellation above the recipient suggests the Sphinx cosmic guide; chosen skill/save are not guessed.'],
  blindness:['sightOcclusion','The recipient eye cue dims beneath a small dark veil. This represents loss of sight, not an area Darkness spell; no document vision or save outcome is changed.'],
  'bottomless-stomach':['mouthPocket','A small shimmering pocket entrance forms near the mouth. No whole-creature teleport, eating action or premature disgorging of stored objects.'],
  breadcrumbs:['glitterTrail','Foot-level glitter suggests the trail left during later movement. Casting does not move the recipient or invent a full route.'],
  'claim-curse':['curseTransfer','Fate threads lift from the afflicted target and flow back to caster, then retie locally. Caster-to-target harm would reverse the described transfer.'],
  'cleanse-cuisine':['cuisineCleanse','A washing and seasoning swirl over the food location illustrates enhancement and optional cleansing, not a creature heal or damaging splash.'],
  'clouded-focus':['nearFocus','A sharp central eye cue is bordered by muted hazy periphery, matching improved near senses with reduced distant perception.'],
  'connective-current':['currentLink','A faint current links caster and enemy. The later reaction Stride is not performed during casting.'],
  'cradle-aloft':['objectFloat','The selected object silhouette lifts gently beside its stand-in location. This is not levitation of the holder or a gravity attack.'],
  'days-weight':['timeWeariness','A rotating time seal passes over a subtly drooping translucent silhouette, suggesting accumulated fatigue. Saves and fatigue state remain mechanical.'],
  deafness:['hearingMute','A sound wave contracts and a small note fades near the head, distinguishing hearing loss from blind eye darkness and from a sonic blast.'],
  decompose:['corpseDecay','A faint decay veil begins over the corpse while a translucent copy loses opacity. The real corpse remains; complete decay takes the written duration.'],
  'diabolic-edict':['diabolicTask','An oath-like enchantment seal settles on the recipient. The task, reward or refusal penalty is not pre-resolved.'],
  'discern-secrets':['patronSecrets','A patron whisper becomes a small perception cue and rune near the head. The free knowledge/Seek/Sense Motive action is resolved by the player.'],
  'distracting-decoy':['flutterDecoy','One colorful fluttering shape draws the eye; butterflies are a fitting allowed illustrative small shape. No ray or target impact.'],
  'elemental-betrayal':['elementalWeakness','A neutral elemental vulnerability sigil forms; air/earth/metal/fire/water/wood selection requires customization rather than inventing fire damage.'],
  endure:['enduringMind','A quiet heart and body reinforcement convey temporary vitality and encouragement. No wound healing or creature displacement.'],
  'familiars-face':['familiarSensor','The companion receives an eye sensor while caster receives a small paired rune. No harmful strike or companion teleport.'],
  'fates-travels':['corpseJourney','A divinatory eye and drifting memory flecks rise from the corpse. The actual historical route is unknown and is not fabricated on canvas.'],
  'floating-harness':['floatingHarness','A spectral harness rings the companion with a gentle supported rise. It does not teleport the companion to caster or change adjacency rules.'],
  'forced-quiet':['voiceQuiet','A small voice symbol near the mouth subsides into a restrained wave; hearing is not removed and verbal spellcasting remains possible.'],
  'fortify-summoning':['summonFortitude','A resilience ward forms on an already summoned creature. No extra creature or offensive summon attack is invented.'],
  'friendly-push':['friendlyPropulsion','A soft force cue and bounded cosmetic recoil illustrate willing propulsion. Direction and actual ten-foot placement remain the player decision.'],
  'gecko-grip':['geckoPurchase','Two tiny grip patches form near hands and feet. Web/leaves are symbolic clinging-hair substitutes; casting does not immediately climb.'],
  'genies-veil':['genieVanish','Colored smoke and sparkles envelop a fading then returning silhouette. The real token is never hidden, moved or left invisible.'],
  'groom-companion':['companionGroom','Dirt-like particles lift outward, followed by clean glints. No wounds are healed or creature strength increased.'],
  'healers-blessing':['healerPromise','A quiet vital heart/star blessing anticipates later healing. The cast itself does not regain Hit Points.'],
  'imprint-message':['psychicImprint','Rune flecks draw inward into the object, depicting written psychic vibrations; opposite direction from reading past impressions.'],
  'inertia-lock':['inertiaAnchor','A stationary object ward and four fixed anchor glints express release in an exact spot. No pulling, dropping or holder motion.'],
  'liberating-command':['escapeCommand','A command rune and outward-fading restraint cue suggest permission to Escape. The ally reaction and escape success are not assumed.'],
  'lock-item':['heldItemFuse','A small hand-level chain seal binds held object and holder. No whole-body paralysis, weapon attack or automatic drop.'],
  'magic-hide':['companionHide','A body-fitted protective film and natural surface veil suggest thicker animal hide, not a weapon strike or changed battle form.'],
  'mist-sight':['mistPiercing','A small mist veil parts around a clear eye cue. Secondary sight emanation is not a newly created fog area.'],
  'negate-aroma':['odorErase','A very faint neutral odor veil disperses outward and fades, contrasting the inward attraction of Verminous Lure.'],
  'nudge-fate':['fateNudge','One subtle strand turns and settles into a small fortune star. No roll outcome, extra Strike or full-body spin is pre-resolved.'],
  'object-memory':['objectExpertise','Three quiet impressions echo from the tool/weapon into a proficiency rune. No assumed weapon type or attack flourish.'],
  'object-reading':['objectPsychometry','An eye reads the object and a divinatory impression lifts toward caster. Historical events remain GM information.'],
  overstuff:['suddenMeal','A lower-body soft material pulse suggests sudden food and drink, with a gentle nausea reaction. No vomiting or critical-failure outcome is assumed.'],
  'painted-scout':['paintedSensor','A small dark drawn eye marker forms on the stone surface. No creature token is spawned, or later scout movement invented.'],
  'peaceful-rest':['preservedCorpse','A quiet preservative rune and still shimmer settle over the corpse, opposing Decompose without resurrecting it.'],
  'pet-cache':['companionPocket','A pocket entrance and shrinking companion silhouette express storage. The token document remains and no spell-end reappearance is pre-played.'],
  'physical-boost':['physiqueBoost','A brief body-fitted strengthening film conveys physical capability; the next skill/save is not rolled automatically.'],
  'practice-makes-perfect':['practicedCorrection','A small returning rune echo illustrates correcting a failed effort. No duplicate action or roll-result branch is invented.'],
  'quick-sort':['objectSorting','Three scattered glyph groups converge into ordered rows over the object location. This depicts sorting, not a damaging blast or literal object updates.'],
  'rapid-adaptation':['environmentalAdaptation','Environmental flecks gather into the companion silhouette. The actual surrounding adaptation must be customized; no random aquatic or arctic form is guessed.'],
  restyle:['garmentRestyle','A colored appearance sweep crosses existing clothing without growing, shrinking or replacing its shape/material. The desired style remains editable.'],
  'retrieving-hook':['retrievingHook','A strand stands in for magical hook and rope reaching the target, followed by a bounded cosmetic approach toward caster. Actual destination, unwilling save and hook artwork remain explicit limitations.'],
  'return-the-favor':['gratitudeVitality','A small paired gratitude cue returns support to ally, then a quiet heart settles as temporary vitality. No wound-heal film or attack.'],
  'scramble-body':['biologicalDisarray','A masked internal distortion and restrained nausea wobble represent biological disarray. No acid missile or save outcome is assumed.'],
  'share-vision':['sharedEyes','Eye cues appear at both participants and thin strands flow both ways. Shared vision, blindness and perception remain rules.'],
  sigil:['tinySigil','One small visible personal mark is illustrated near the surface. Invisible mode and exact unique mark design require customization; no full-footprint floor rune.'],
  'sting-of-the-sea':['brinyFaceTendril','A blue portal and localized wet tentacle veil cover the face. Tentacle cluster footage symbolically stands in for one long appendage; later save outcomes are not played.'],
  synchronize:['timedSigil','A small timed mark is applied quietly. The three flashes belong to the chosen later time and are not falsely played at casting.'],
  'synchronize-steps':['movementPair','Matching foot-level mental sigils appear on the targeted willing participants. No caster link or actual Step/Stride is assumed during casting.'],
  tether:['tetherConnection','A non-electric magical tether spans caster and target with a localized restraint loop. No successful immobilization or broken tether is pre-resolved.'],
  'the-parrots-whisper':['gossipInsight','A tiny fluttering echo and eye cue represent the garrulous insight. A butterfly symbol is an explicit parrot substitute; answer content and save-dependent reveal time remain GM decisions.'],
  translate:['languageMeaning','Runic symbols settle near the head and become legible, distinguishing language comprehension from a music spell or damaging projectile.'],
  'unbroken-panoply':['weaponOverlays','Three translucent copies of the selected weapon stand-in overlay the original with shimmer. No generic longsword is assumed for an unknown weapon, and no attack occurs.'],
  'unfetter-eidolon':['eidolonUnfetter','The binding cue opens outward around eidolon. No relocation or later unmanifestation occurs during casting.'],
  'verminous-lure':['alluringMusk','A faint neutral musk surrounds target and inward traces illustrate attraction. No animal swarm is created or attack made by the cast itself.'],
  'vision-of-weakness':['weaknessInsight','A localized foe marker and caster eye glimpse express recognition of weak defenses. The granted later attack is not animated during casting.'],
  watchdog:['companionWatch','A watchful eye and quiet alert ward settle on companion. Later alarm and spell-end teleport are not played immediately.'],
};

export function utilitySpellLayers(spell,{cast,hit,aura,copy,pose,fx,track,charge}) {
 const source=(slot,label,delay,duration,extra={})=>fx('cast',slot,label,delay,duration,{...extra});
 const tiny=(label,extra={})=>hit(label,charge,2100,{scale:0.55,offsetY:-0.3,opacity:0.55,...extra});
 const reading=(label,extra={})=>[cast('Read the impression'),tiny(label,extra),source('aura','Insight at caster',charge+400,1700,{scale:0.65,opacity:0.35,offsetY:-0.3})];
 const link=(label,extra={})=>fx('travel','bolt',label,charge,4400,{scale:0.55,opacity:0.4,...extra});
 switch(spell.design.pattern){
  case 'edibleObject':return [cast('Matter softens'),hit('Soft edible substance',charge,2500,{scale:0.9,opacity:0.6,tintEnabled:true,colorize:true,tint:'#ccb898',tracks:[track('scale.y',1,0.75,1200)]}),aura('aura','Changed material settles',charge+600,2100,{scale:0.65,opacity:0.3})];
  case 'animatedRope':return [cast('Rope awakens'),hit('Rope-like coil',charge,2600,{scale:0.9,opacity:0.6,rotateIn:-90,rotateInDuration:1500}),aura('aura','Responsive loops',charge+400,2300,{scale:0.85,opacity:0.3,tracks:[track('rotation',0,25,1400,{pingPong:true,loop:true})]})];
  case 'loadBearing':return [cast('Frame reinforced'),hit('Load-bearing structure',charge,2400,{scale:1.05,maskToken:true,opacity:0.45}),aura('aura','Low strength support',charge+450,2100,{scale:0.75,offsetY:0.3,opacity:0.4})];
  case 'perilForesight':return [cast('Danger anticipated'),tiny('Foresight glimpse'),aura('aura','Alert star',charge+350,2100,{scale:0.55,offsetY:-0.5,opacity:0.4})];
  case 'constellationGuide':return [cast('Look to the Sphinx'),...[-0.4,0,0.4].map((x,i)=>hit('Constellation point',charge,2400,{scale:0.35,offsetX:x,offsetY:-0.45-(i===1?0.2:0),opacity:0.6})),aura('aura','Cosmic guidance',charge+500,1900,{scale:0.8,opacity:0.3})];
  case 'sightOcclusion':return [cast('Sight veiled'),aura('aura','Sight dims',charge,1600,{scale:0.5,offsetY:-0.3,scaleOut:0.1,scaleOutDuration:1000,opacity:0.5}),tiny('Obscuring eye veil',{scale:0.75,opacity:0.65,fadeIn:350,fadeOut:650})];
  case 'mouthPocket':return [cast('Storage opens'),tiny('Mouth pocket entrance',{scale:0.5,offsetY:-0.1,opacity:0.55}),aura('aura','Mouth shimmer',charge+400,2000,{scale:0.5,offsetY:-0.1,opacity:0.3})];
  case 'glitterTrail':return [cast('Trail blessed'),...[-0.5,-0.2,0.1].map(x=>hit('Footfall glitter',charge,2100,{scale:0.35,offsetX:x,offsetY:0.4,below:true,opacity:0.55})),aura('aura','Tracking flecks',charge+500,1800,{scale:0.75,offsetY:0.35,opacity:0.3})];
  case 'curseTransfer':return [cast('Fate threads burned'),tiny('Curse threads lift',{scale:1,offsetY:0}),link('Curse flows to caster',{travelOrigin:'target'}),source('aura','Curse retied at caster',charge+950,2100,{scale:0.85,opacity:0.45})];
  case 'cuisineCleanse':return [cast('Cuisine enhanced'),hit('Food and drink wash',charge,2200,{scale:0.7,opacity:0.4}),aura('aura','Clean gourmet swirl',charge+400,2400,{scale:0.9,opacity:0.45})];
  case 'nearFocus':return [cast('Near senses sharpen'),tiny('Clear close perception'),aura('aura','Distant haze',charge,2600,{scale:1.45,blur:3,opacity:0.2,fadeOut:650})];
  case 'currentLink':return [cast('Shared current forms'),link('Enemy current connected'),tiny('Motion current cue',{scale:1,offsetY:0.3}),source('aura','Caster link',charge+200,2000,{scale:0.55,opacity:0.3})];
  case 'objectFloat':return [cast('Release gravity'),hit('Object shimmer',charge,2100,{scale:0.6,opacity:0.35}),copy('Floating object illustration',charge,2800,{copies:1,copySpread:0,opacity:0.45,tracks:[track('position.y',0,-0.35,1600)]}),aura('aura','Suspended glint',charge+600,1900,{scale:0.5,offsetY:-0.35,opacity:0.35})];
  case 'timeWeariness':return [cast('Day fast-forwards'),hit('Time passes',charge,2400,{scale:1.1,opacity:0.4,tracks:[track('rotation',0,180,1900)]}),copy('Tired silhouette',charge+150,2500,{copies:1,copySpread:0,opacity:0.3,saturation:-1,tracks:[track('scale.y',1,0.9,1300),track('position.y',0,0.08,1300)]})];
  case 'hearingMute':return [cast('Hearing quiets'),tiny('Hearing wave contracts',{scaleIn:1.4,scaleInDuration:1000,scaleOut:0.1,scaleOutDuration:650}),aura('aura','Audible note fades',charge+300,1700,{scale:0.45,offsetX:0.35,offsetY:-0.2,opacity:0.35,scaleOut:0,scaleOutDuration:800})];
  case 'corpseDecay':return [cast('Decay accelerated'),hit('Decay begins',charge,2700,{maskToken:true,scale:1,opacity:0.25}),copy('Decaying impression',charge+250,2700,{copies:1,copySpread:0,opacity:0.3,saturation:-1,tracks:[track('alpha',0.3,0,2400)]}),aura('aura','Organic flecks depart',charge+650,2100,{scale:1,opacity:0.25})];
  case 'diabolicTask':return [cast('Task proclaimed'),tiny('Diabolic oath seal',{scale:0.7,offsetY:0,tintEnabled:true,colorize:true,tint:'#b53946'}),aura('aura','Edict binds',charge+450,2200,{scale:0.65,opacity:0.3})];
  case 'patronSecrets':return [cast('Patron whispers'),tiny('Perception opens'),aura('aura','Secret runes',charge+350,1900,{scale:0.45,offsetX:0.35,offsetY:-0.4,opacity:0.35})];
  case 'flutterDecoy':return [cast('Decoy appears'),tiny('Fluttering distraction',{scale:0.6,offsetX:0.55,offsetY:-0.15,opacity:0.8}),aura('aura','Colorful glimmer',charge+250,1800,{scale:0.45,offsetX:0.55,offsetY:-0.15,opacity:0.35})];
  case 'elementalWeakness':return [cast('Element betrays'),hit('Chosen-element vulnerability seal',charge,2400,{scale:0.8,opacity:0.4}),aura('aura','Neutral vulnerable field',charge+500,2100,{scale:1.1,opacity:0.3})];
  case 'enduringMind':return [cast('Urge to press on'),tiny('Mind heartened',{scale:0.6,offsetY:0.05}),aura('aura','Temporary vitality settles',charge+450,2200,{scale:1,opacity:0.45})];
  case 'familiarSensor':return [cast('Companion senses linked'),tiny('Remote companion eyes'),source('aura','Caster receives senses',charge+250,2200,{scale:0.6,offsetY:-0.3,opacity:0.35})];
  case 'corpseJourney':return [cast('Last journey recalled'),tiny('Corpse memory eye'),...[-0.4,0,0.4].map(x=>aura('aura','Travel memory fragment',charge+400,2200,{scale:0.3,offsetX:x,offsetY:-0.35,opacity:0.3,tracks:[track('position.y',0,-0.25,1600)]}))];
  case 'floatingHarness':return [cast('Support harness forms'),hit('Harness cradles companion',charge,2600,{scale:1.1,below:true,opacity:0.5}),pose('levitate','Gentle supported rise',charge+250,2200,'targets',0.15,0.3),aura('aura','Support shimmer',charge+500,2200,{scale:1,opacity:0.3})];
  case 'voiceQuiet':return [cast('Voice lowered'),tiny('Whisper symbol',{scale:0.4,offsetY:-0.1,opacity:0.4,scaleOut:0.2,scaleOutDuration:900}),aura('aura','Voice wave subsides',charge+250,2200,{scale:0.7,offsetY:-0.1,opacity:0.3,scaleOut:0.2,scaleOutDuration:1200})];
  case 'summonFortitude':return [cast('Summoned ally fortified'),hit('Resilience ward',charge,2400,{scale:1.1,opacity:0.55}),aura('aura','Ferocity and resilience',charge+450,2100,{scale:1,maskToken:true,opacity:0.4})];
  case 'friendlyPropulsion':return [cast('Willing ally propelled'),hit('Gentle force',charge,2100,{scale:0.9,opacity:0.5}),pose('recoil','Bounded friendly push',charge+200,1600,'targets',0.65,0.3),aura('aura','Force settles',charge+600,1800,{scale:0.9,opacity:0.25})];
  case 'geckoPurchase':return [cast('Clinging hairs sprout'),...[-1,1].map(side=>hit('Small grip patch',charge,2400,{scale:0.35,offsetX:side*0.3,offsetY:0.3,opacity:0.4})),aura('aura','Natural purchase',charge+500,2100,{scale:0.75,offsetY:0.3,opacity:0.3})];
  case 'genieVanish':return [cast('Wish for protection'),hit('Colored smoke',charge,2300,{scale:1.1,tintEnabled:true,colorize:true,tint:'#ba7ee8',opacity:0.6}),copy('Vanishing and returning silhouette',charge,2400,{copies:1,copySpread:0,opacity:0.5,tracks:[track('alpha',0.5,0,700),track('alpha',0,0.5,700,{delay:850})]}),aura('aura','Wish sparkles',charge+150,2300,{scale:1.1,opacity:0.5})];
  case 'companionGroom':return [cast('Companion tidied'),hit('Grime lifts outward',charge,2200,{scale:1.1,opacity:0.4}),aura('aura','Fresh clean coat',charge+600,2100,{scale:1,opacity:0.4})];
  case 'healerPromise':return [cast('Vital link blessed'),tiny('Promise of healing',{scale:0.55,offsetY:0.1}),aura('aura','Later-healing blessing',charge+300,2300,{scale:0.75,opacity:0.35})];
  case 'psychicImprint':return [cast('Message impressed'),hit('Psychic vibrations draw inward',charge,2300,{scale:0.65,scaleIn:1.4,scaleInDuration:1200,opacity:0.5}),aura('aura','Imprinted sensation',charge+600,2100,{scale:0.6,opacity:0.3})];
  case 'inertiaAnchor':return [cast('Object anchored'),hit('Stationary gravity seal',charge,2600,{scale:0.6,below:true,opacity:0.5}),...[-1,1].flatMap(x=>[-1,1].map(y=>aura('aura','Fixed anchor',charge+300,2200,{scale:0.2,offsetX:x*0.3,offsetY:y*0.3,opacity:0.35})))];
  case 'escapeCommand':return [cast('Liberating cry'),hit('Restraint loosens',charge,2200,{scale:0.95,scaleOut:1.4,scaleOutDuration:1400,opacity:0.4}),aura('aura','Command to Escape',charge+250,1900,{scale:0.6,offsetY:-0.3,opacity:0.4})];
  case 'heldItemFuse':return [cast('Grip fused'),hit('Hand-level item binding',charge,2400,{scale:0.5,offsetX:0.35,offsetY:0.1,opacity:0.55}),aura('aura','Grip holds',charge+400,2100,{scale:0.5,offsetX:0.35,offsetY:0.1,opacity:0.3})];
  case 'companionHide':return [cast('Hide thickens'),hit('Protective skin',charge,2400,{maskToken:true,scale:1.1,opacity:0.4}),aura('aura','Natural surface reinforcement',charge+500,2100,{maskToken:true,scale:1,opacity:0.3})];
  case 'mistPiercing':return [cast('Mist sight granted'),aura('aura','Mist parts at eyes',charge,2300,{scale:0.75,offsetY:-0.3,opacity:0.25,scaleOut:1.7,scaleOutDuration:1800}),tiny('Clear eyes through mist',{fadeIn:400,opacity:0.6})];
  case 'odorErase':return [cast('Odor erased'),hit('Scent veil disperses',charge,2300,{scale:1,opacity:0.2,saturation:-1,scaleOut:1.5,scaleOutDuration:1800,fadeOut:1000}),aura('aura','Quiet odorless presence',charge+600,1800,{scale:0.55,opacity:0.2})];
  case 'fateNudge':return [cast('Spool nudged'),tiny('Fate thread turns',{scale:0.75,offsetY:0,rotateIn:-45,rotateInDuration:1500,opacity:0.4}),aura('aura','Fortune settles',charge+500,2100,{scale:0.55,offsetY:-0.3,opacity:0.35})];
  case 'objectExpertise':return [cast('Past experience drawn forth'),...[-0.3,0,0.3].map(x=>hit('Experience echo',charge,2400,{scale:0.4,offsetX:x,opacity:0.3,tracks:[track('position.y',0,-0.2,1500)]})),source('aura','Expertise understood',charge+500,1900,{scale:0.5,offsetY:-0.3,opacity:0.4})];
  case 'objectPsychometry':return reading('Emotional history read',{offsetY:0,scale:0.7});
  case 'suddenMeal':return [cast('Sudden meal created'),hit('Food fills stomach',charge,2400,{maskToken:true,scale:0.7,offsetY:0.25,opacity:0.45,tintEnabled:true,colorize:true,tint:'#ccb898'}),pose('shake','Gentle fullness reaction',charge+600,1300,'targets',0.035,0.2),aura('aura','Nourishment impression',charge+500,1900,{scale:0.4,offsetY:0.15,opacity:0.3})];
  case 'paintedSensor':return [cast('Stone scouts painted'),tiny('Small inked scout',{scale:0.4,offsetY:0,tintEnabled:true,colorize:true,tint:'#39333f'}),aura('aura','Painted sensor imprint',charge+450,2100,{scale:0.45,opacity:0.25})];
  case 'preservedCorpse':return [cast('Rest preserved'),hit('Preservation seal',charge,2600,{scale:0.75,below:true,opacity:0.4}),aura('aura','Still protective veil',charge+500,2200,{scale:1,maskToken:true,opacity:0.25})];
  case 'companionPocket':return [cast('Pocket opens'),hit('Companion pocket entrance',charge,2400,{scale:1.1,opacity:0.55}),copy('Companion drawn inward',charge+250,2500,{copies:1,copySpread:0,opacity:0.55,tracks:[track('scale.x',1,0.15,1500),track('scale.y',1,0.15,1500),track('alpha',0.55,0,1900)]}),aura('aura','Pocket sparkles settle',charge+600,1900,{scale:0.65,opacity:0.3})];
  case 'physiqueBoost':return [cast('Physique reinforced'),hit('Physical capacity rises',charge,2400,{maskToken:true,scale:1.1,opacity:0.55}),aura('aura','Capacity held ready',charge+400,2200,{scale:1.1,opacity:0.3})];
  case 'practicedCorrection':return [cast('Practice recalled'),tiny('Corrective rune returns',{scale:0.7,rotateIn:90,rotateInDuration:1700,offsetY:0}),aura('aura','Corrected effort glint',charge+600,1900,{scale:0.6,opacity:0.4})];
  case 'objectSorting':return [cast('Objects sorted'),...[-1,0,1].map((group)=>hit('Group sorts into a row',charge,2600,{scale:0.4,opacity:0.45,offsetX:group*0.4,offsetY:group*0.25,tracks:[track('position.y',group*0.25,0,1600)]})),aura('aura','Ordered stacks glint',charge+1000,1800,{scale:0.9,opacity:0.3})];
  case 'environmentalAdaptation':return [cast('Environment lent'),hit('Terrain energy gathers',charge,2600,{maskToken:true,scale:1.1,opacity:0.45}),copy('Adaptation silhouette',charge+300,2600,{copies:1,copySpread:0,opacity:0.3,blur:1}),aura('aura','Adaptation settles',charge+650,2200,{maskToken:true,scale:1.1,opacity:0.3})];
  case 'garmentRestyle':return [cast('Appearance restyled'),hit('Clothing appearance sweep',charge,2500,{scale:1,maskToken:true,opacity:0.5,tintEnabled:true,colorize:true,tint:'#83c4ef',tracks:[track('position.y',-0.3,0.3,1800)]}),aura('aura','Pattern and color settle',charge+600,2100,{scale:0.8,opacity:0.3})];
  case 'retrievingHook':{const pull={...pose('rush','Bounded draw toward caster',charge+600,2500,'targets',6,0.45),motionRange:'target',motionArrival:45,motionHold:25,perSquare:180};return [cast('Hook and rope conjured'),link('Symbolic rope reaches target'),tiny('Hook catches',{offsetY:0,scale:0.85}),pull,aura('aura','Retrieval glint',charge+800,2100,{scale:0.55,opacity:0.3})];}
  case 'gratitudeVitality':return [cast('Favor acknowledged'),source('aura','Gratitude offered',charge,1800,{scale:0.55,opacity:0.35}),tiny('Ally heartened',{scale:0.6,offsetY:0}),aura('aura','Temporary vitality received',charge+450,2200,{scale:0.7,opacity:0.35})];
  case 'biologicalDisarray':return [cast('Biology unsettled'),hit('Internal nausea veil',charge,2500,{maskToken:true,scale:1,opacity:0.3,saturation:-0.5}),copy('Unwell impression',charge+250,2400,{copies:1,copySpread:0,opacity:0.25,blur:1}),pose('shake','Restrained nausea',charge+400,1500,'targets',0.035,0.25)];
  case 'sharedEyes':return [cast('Sight linked'),fx('aura','hit','Recipient eyes',charge,2300,{subject:'targets',below:false,scale:0.55,offsetY:-0.3,opacity:0.55}),source('hit','Caster eyes',charge,2300,{scale:0.55,offsetY:-0.3,opacity:0.55}),link('Sight shared outward',{opacity:0.2}),link('Sight shared inward',{travelOrigin:'target',opacity:0.2})];
  case 'tinySigil':return [cast('Mark placed'),hit('Small personal sigil',charge,2400,{scale:0.3,offsetX:0.2,offsetY:0.1,opacity:0.55}),aura('aura','Quiet mark glint',charge+500,1900,{scale:0.25,offsetX:0.2,offsetY:0.1,opacity:0.3})];
  case 'brinyFaceTendril':return [cast('Briny portal opens'),aura('aura','Blue face portal',charge,2900,{scale:0.6,offsetY:-0.3,opacity:0.5,tintEnabled:true,colorize:true,tint:'#62c5ef'}),tiny('Wet face tentacle',{scale:0.7,maskToken:true,opacity:0.55,tintEnabled:true,colorize:true,tint:'#438fae'})];
  case 'timedSigil':return [cast('Timer chosen'),hit('Quiet timed mark applied',charge,2400,{scale:0.3,offsetX:0.2,offsetY:0.1,opacity:0.4}),aura('aura','Timer remains unflashed',charge+450,2200,{scale:0.35,offsetX:0.2,offsetY:0.1,opacity:0.25})];
  case 'movementPair':return [cast('Movers mentally linked'),hit('Matching movement sigil',charge,2400,{scale:0.65,below:true,offsetY:0.3,opacity:0.5}),aura('aura','Paired step readiness',charge+500,2200,{scale:0.85,offsetY:0.3,opacity:0.3})];
  case 'tetherConnection':return [cast('Tethers extended'),link('Caster-target tether'),hit('Tether loop',charge,2600,{scale:1.1,opacity:0.5}),aura('aura','Tether holds',charge+650,2200,{scale:1.05,opacity:0.3})];
  case 'gossipInsight':return [cast('Echo called'),tiny('Fluttering gossip echo',{offsetX:0.45,scale:0.45,opacity:0.65}),source('aura','Weakness insight received',charge+500,2100,{scale:0.5,offsetY:-0.3,opacity:0.4})];
  case 'languageMeaning':return [cast('Language interpreted'),tiny('Symbols become meaningful',{scale:0.55,rotateIn:-45,rotateInDuration:1500}),aura('aura','Comprehension settles',charge+400,2100,{scale:0.65,offsetY:-0.3,opacity:0.3})];
  case 'weaponOverlays':return [cast('Legendary images overlay'),hit('Weapon shimmer',charge,2300,{scale:0.85,opacity:0.4}),copy('Similar weapon images',charge,2800,{copies:3,copySpread:0.15,opacity:0.35,tracks:[track('alpha',0.35,0,1900)]}),aura('aura','Broken condition suppressed',charge+650,1900,{scale:0.6,opacity:0.35})];
  case 'eidolonUnfetter':return [cast('Bond loosened'),hit('Binding opens',charge,2600,{scale:1.05,scaleOut:1.6,scaleOutDuration:1700,opacity:0.45}),aura('aura','Freedom around eidolon',charge+600,2200,{scale:1.35,opacity:0.3,fadeOut:800})];
  case 'alluringMusk':return [cast('Alluring musk begins'),hit('Neutral musk veil',charge,2600,{scale:1.2,opacity:0.2,saturation:-1}),aura('aura','Scent traces draw inward',charge+350,2400,{scale:1.2,opacity:0.3})];
  case 'weaknessInsight':return [cast('Weakness discerned'),hit('Foe weak-point marker',charge,2400,{scale:0.55,opacity:0.45}),source('aura','Divine gaze insight',charge+350,2100,{scale:0.5,offsetY:-0.3,opacity:0.4})];
  case 'companionWatch':return [cast('Companion stands watch'),tiny('Watchful eyes'),aura('aura','Quiet alert ward',charge+500,2300,{scale:0.75,below:true,opacity:0.3})];
  default:return null;
 }
}
