import {writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {sf2eSources} from './sf2e-source.mjs';
import {assetDatabases} from './asset-databases.mjs';
import {buildSpellDesign} from './twoe-spell-design.mjs';
import {profiles,classify,selectStateMedia} from './twoe-state-design.mjs';
import {classifyFeat,analyzeFeat,plainFeatDescription} from './feat-semantics.mjs';
import {analyzeWeapon} from './weapon-semantics.mjs';
import {selectWeaponMedia} from './weapon-asset-selection.mjs';
import {resolveFeatMedia} from './feat-asset-selection.mjs';
import {resolveSpellMedia,assetGeometry,coneMaterialMatches} from './spell-asset-selection.mjs';
import {SPELL_MOTIFS} from '../scripts/catalogs/pf2e/spells/spell-design.mjs';
import {SPELL_THEMES,spellRecipe} from '../scripts/catalogs/pf2e/spells/spell-choreography.mjs';
import {FEAT_MOTIFS,featRecipe} from '../scripts/catalogs/pf2e/feats/feat-choreography.mjs';
import {weaponRecipe} from '../scripts/catalogs/pf2e/weapons/weapon-choreography.mjs';
import {stateRecipe} from '../scripts/catalogs/pf2e/state-catalog.mjs';
import {statePresentation} from '../scripts/catalogs/shared/state-presentation.mjs';
import {buildConditionDesign,CONDITION_PLANS} from './pf2e-condition-designs.mjs';
import {buildAuraDesign} from './pf2e-aura-designs.mjs';
import {frameFeatCatalog} from './feat-framing.mjs';
import {diversifySpellMedia} from './spell-media-variety.mjs';
import {allocateSpellIdentities} from './spell-variety-allocation.mjs';
import {mediaTiming} from './media-timing.mjs';
import {MEDIA_DURATIONS} from '../data/media-durations.mjs';
import {PF2E_SPELLS} from '../data/pf2e-spells.mjs';
import {PF2E_FEATS} from '../data/pf2e-feats.mjs';
import {PF2E_WEAPONS} from '../data/pf2e-weapons.mjs';
import {PF2E_CONDITIONS,PF2E_EFFECTS} from '../data/pf2e-state-catalog.mjs';
import {SPELL_SOUND_DESIGNS} from '../data/spell-sounds.mjs';
import {FEAT_SOUND_DESIGNS,WEAPON_SOUND_DESIGNS,ABILITY_SOUND_PROFILES} from '../data/ability-sounds.mjs';
import {suspendBespoke} from '../scripts/catalogs/shared/bespoke.mjs';
// Variant recipes are baked generated designs; bespoke designs apply at play time.
suspendBespoke();
import {SOUND_PROFILES} from '../data/spell-sounds.mjs';
import {validateRecipe,planRecipe} from '../scripts/core/model.mjs';
import {applySfMotionPatch} from '../scripts/catalogs/sf2e/sf2e-motion.mjs';

const hash=value=>createHash('sha256').update(value).digest('hex');
const [source,databases]=await Promise.all([sf2eSources(),assetDatabases()]);
const pfSpells=new Map(PF2E_SPELLS.map(e=>[e.id,e]));
const pfStates=new Map([...PF2E_CONDITIONS,...PF2E_EFFECTS].map(e=>[e.documentId,e]));
const entries=[],spells=[],feats=[],weapons=[],states=[],excluded=[];
const timings=Object.assign({},...PF2E_FEATS.map(e=>e.mediaTiming??{}),...PF2E_WEAPONS.flatMap(e=>e.modes.map(m=>m.mediaTiming??{})));
for(const spell of PF2E_SPELLS)for(const [slot,keys]of Object.entries(spell.design.assets??{}))for(const key of keys)if(!timings[key]&&spell.design.mediaTiming?.[slot])timings[key]={...spell.design.mediaTiming[slot]};
const classes=new Set('envoy mystic operative soldier solarian witchwarper evolutionist mechanic technomancer'.split(' '));
// Actions and class/ancestry features get their own catalogs, like PF2e.
const abilityKind=entry=>entry.pack==='actions'?'action':['class-features','ancestry-features'].includes(entry.pack)?'feature':'feat';
const metadata=(entry,kind)=>{const s=entry.source.system;return {id:`sf2e-${kind}-${entry.pack}-${entry.source._id}`,documentId:entry.source._id,systemId:'sf2e',kind,nativeType:entry.source.type,pack:entry.pack,uuid:entry.uuid,name:entry.source.name,img:entry.source.img,slug:s.slug??entry.path.split('/').at(-1).replace(/\.json$/,''),level:s.level?.value??0,group:entry.pack,edition:'SF2e',publication:s.publication?.title??'',traits:s.traits?.value??[],descriptionText:plainFeatDescription(s.description?.value),descriptionHash:hash(s.description?.value??''),sourceURL:`https://github.com/foundryvtt/pf2e/blob/${source.sha}/${entry.path}`,shared:entry.shared===true};};
const themeSound=theme=>({electricity:'electric',mind:'psychic',plant:'growth',ward:'shield',gravity:'force',weapon:'metal',arcane:'force',illusion:'shadow',spirit:'holy',vitality:'healing',blood:'drain',curse:'shadow',dream:'sleep',luck:'bless',divination:'detect',web:'chainBinding'})[theme]??theme;
// Reviewed per-spell cues for SF2e spells without a PF2e composition (full
// descriptions read 2026-10-07). Replaces the old theme-keyword fallback that
// left "Needs configuration" labels on playing recipes (e.g. Absolute Zero's
// cold burst played a body-rune buff).
const SF2E_SPELL_MOTIFS={'absolute-zero':'materialArea-cold',accelerate:'swiftTime','adaptive-camouflage':'lightBend',adhere:'metalSurface','akashic-assistant':'summon','akashic-download':'eye','akashic-fount':'eye','akashic-revival':'restore','alternate-outcome':'runeBlessing',anthem:'song','awaken-computer':'empower','caustic-conversion':'acidGlob','cellular-stimulant':'swiftTime','chill-gaze':'icyRay','chrono-push':'phaseMissile','cloying-shadows':'shadowTendrils','commune-with-tech':'eye','control-machine':'mentalJolt','cozy-crashpad':'metalSurface','deadly-vitality':'drain','death-sentence':'divineRay',delete:'lightBend',discharge:'stormTouch','doom-scroll':'prismatic','dream-of-home':'charmHaze','eldritch-wrath':'shadowTendrils',electrotether:'electricalLasso','elemental-nova':'detonation','enhance-body':'empower','event-horizon':'materialArea-shadow','forge-drift-beacon':'portalStep','glow-up':'empower','gravity-field':'gravity','holographic-memory':'prismatic',howl:'sonicWave','implant-data':'eye','injury-echo':'weapon','instant-virus':'stormTouch',irradiate:'poisonMist','life-seal':'protectiveWard',measure:'eye','new-game':'prismatic',overheat:'flameRay','overload-systems':'detonation','parallel-forms':'castingRush','pocket-vacuum':'materialInwardAir',promession:'icyRay','quantum-analysis':'eye','reality-wipe':'lightBend',reorient:'restore',ricochet:'forceBolt','rocket-dash':'castingRush','root-of-all-pain':'mentalJolt','selective-invisibility':'lightBend','shadow-prison':'shadowTendrils','shadow-snap':'shadowTendrils','shifting-surge':'weaponRunes','sift-the-sphere':'eye',singlemind:'eye','singularity-seed':'gravity','skim-data':'eye','slice-reality':'darkRay','sonic-scream':'sonicWave','soul-surge':'vitalBolt','speak-with-computers':'whisper',stumble:'gravity','subjective-reality':'lightBend','tech-intuition':'eye','telekinetic-strangulation':'gravity','telekinetic-tantrum':'burstDebris','temporal-bullets':'swiftTime','time-loop':'slowTime','times-edge':'energyRay','twisted-vision':'mentalJolt','vague-idea':'eye','vibe-check':'charmHaze','vitality-web':'restore','void-scour':'materialArea-shadow','void-seed':'drain','void-whispers':'whisper','wall-of-plasma':'gapC-wall-of-fire','wall-of-steel':'gapC-wall-of-stone','warp-presence':'lightBend','warp-probability':'runeBlessing','warp-terrain':'stone','warp-time':'swiftTime','warp-world':'detonation','weight-of-ages':'gravity','wisp-ally':'lightOrb'};
// SF2e-native corrections from the 2026-10-07 audit (docs/animation-fix-plan-2026-10-07.md,
// SF2e rows). The shared PF2e designers pick fantasy art for sci-fi fiction (arrows for
// guns, music notes for gravity, glint+stars for everything). Lists are ordered
// Patreon-first chains; the resolver plays the first key each edition owns.
const jb=(...keys)=>keys.map(k=>`jb2a.${k}`),MUNDANE=jb('impact.005.white','impact.005.orange');
const SHOT={motif:'firearm',cast:jb('glint.yellow.few'),bolt:jb('bullet.01.orange'),hit:MUNDANE},BURST={...SHOT,bolt:jb('bullet.03.orange','bullet.02.orange')},SNIPE={...SHOT,bolt:jb('bullet.Snipe.orange','bullet.01.orange')};
const SF_CUES={
 tech:{cast:jb('markers_scifi.001.complete.001.blueteal'),aura:jb('markers_scifi.002.complete.001.blueteal')},
 gravity:{cast:jb('energy_strands.in.purple.01','energy_strands.in.green.01'),hit:jb('energy_strands.in.purple.01','energy_strands.in.green.01'),aura:jb('energy_strands.complete.dark_purple.01','energy_strands.complete.blue.01')},
 telepathy:{cast:jb('eyes.01.purple.single','eyes.01.dark_green.single'),aura:jb('energy_strands.overlay.purple.01','energy_strands.overlay.blue.01')},
 light:{cast:jb('markers.light.complete.yellow','markers.light.complete.blue'),aura:jb('dancing_light.yellow')},
 healing:{cast:jb('healing_generic.03.burst.green','healing_generic.200px.green'),aura:jb('healing_generic.200px.green')},
 comfort:{cast:jb('glint.yellow.few'),hit:jb('swirling_sparkles.01.yellow','swirling_sparkles.01.blue'),aura:jb('swirling_sparkles.01.yellow','swirling_sparkles.01.blue')},
 venom:{motif:'preparation',cast:jb('liquid.splash.green','particles.outward.greenyellow.01.01'),aura:jb('particles.swirl.greenyellow.01.01')},
 glitch:{motif:'concealment',cast:jb('markers_scifi.001.complete.002.blueteal','markers_scifi.001.complete.001.blueteal'),aura:jb('shimmer.01.blue')},
};
const SF2E_FEAT_MEDIA={
 'acquire-asset':SHOT,'fish-in-a-barrel':SHOT,'opportune-retort':SHOT,overwatch:SHOT,'ready-arms':SHOT,'overwhelming-shot':SHOT,
 'area-fire':BURST,'bullet-hell':BURST,'come-get-some':BURST,'concentrated-shot':BURST,'death-blossom':BURST,'fan-the-hammer':BURST,'hybrid-technique':BURST,'light-em-up':BURST,'run-hot':BURST,'shell-shower':BURST,'shot-on-the-run':BURST,'shoving-shot':BURST,'terror-forming':BURST,
 'rocket-jump':{...BURST,hit:jb('explosion.01.orange')},'longrifle-reload':SNIPE,'shobhad-special':SNIPE,
 'apply-atraxid-venom':SF_CUES.venom,'envenom-magazine':SF_CUES.venom,
 'line-up-the-shot':{motif:'preparation',cast:jb('glint.yellow.few'),aura:jb('hunters_mark.pulse.01.green')},
 // Solar flare is light energy, not an arrow; the vortex circles the solarian (no ranged leg).
 'hampering-flare':{motif:'ray',cast:SF_CUES.light.cast,bolt:jb('energy_beam.normal.yellow.01','lasershot.orange'),hit:jb('impact.006.yellow','impact.005.orange')},
 'constellation-vortex':{motif:'whirlwindStrike',cast:jb('melee_generic.whirlwind.01.orange'),hit:jb('twinkling_stars.points07.white'),aura:jb('hovering_laserweapon.one_handed.01.yellow','hovering_laserweapon.one_handed.01.blue.01')},
 'whirling-swipe':{motif:'whirlwindStrike',cast:jb('melee_generic.whirlwind.01.orange'),hit:jb('melee_generic.slash.01.orange')},
 'gravity-grasp':{motif:'utility',...SF_CUES.gravity},'black-hole':{hit:SF_CUES.gravity.hit,aura:SF_CUES.gravity.aura},
 'hostile-gravity':{cast:SF_CUES.gravity.cast,hit:jb('impact.ground_crack.01.purple','impact.ground_crack.01.orange'),aura:SF_CUES.gravity.aura},
 'apocalypse-burst':{motif:'elementCone',theme:'fire',cast:jb('cast_generic.fire.01.orange'),hit:jb('fireball.explosion.orange')},
 // Chosen-element breaths: the element is picked at play time, so use a neutral energy burst.
 ...Object.fromEntries(['draconic-breath','dragonkin-breath','dragon-breath-dragon-form'].map(s=>[s,{motif:'elementCone',cast:jb('glint.yellow.few'),hit:jb('explosion.03.blueyellow')}])),
 'eat-it':{motif:'utility',cast:jb('liquid.blob.green','particles.outward.greenyellow.01.01'),aura:jb('particles.swirl.greenyellow.01.01')},
 'bioluminescence-shirren':{motif:'utility',...SF_CUES.light},'corona':{motif:'elementAura',cast:SF_CUES.light.cast,aura:jb('energy_field.02.below.yellow','energy_field.02.below.blue')},
 'camera-blur':SF_CUES.glitch,'encode-presence':SF_CUES.glitch,'cloaking-field':SF_CUES.glitch,
 'evasive-jet':{motif:'movement',cast:jb('smoke.puff.side.02.white')},'dont-touch-that':{motif:'utility',cast:jb('ui.chevrons3.yellow'),aura:jb('glint.yellow.few')},
 'nanite-arena':{motif:'guard',cast:jb('markers_scifi.001.complete.003.blueteal','markers_scifi.001.complete.001.blueteal'),hit:jb('glint.yellow.few'),aura:jb('energy_field.02.above.blue')},
 'puff-up':{cast:jb('glint.yellow.few'),hit:MUNDANE,aura:jb('glint.yellow.few')},
 'cheer-up':{motif:'targetSupport',...SF_CUES.comfort,aura:jb('markers.heart.pink.01')},'self-soothe':{motif:'resolve',...SF_CUES.comfort},'center-your-emotions':{motif:'resolve',...SF_CUES.comfort},
 // "Perform first aid" / "perform a stunt" are not music.
 'administer-first-aid':{motif:'restoration',...SF_CUES.healing},'kiss-it-better':{motif:'restoration',...SF_CUES.healing},'akashic-sync':{motif:'utility',...SF_CUES.telepathy},'stunt':{motif:'movement',cast:jb('smoke.puff.side.02.white')},
 'star-brand':{motif:'utility',...SF_CUES.light},'wormhole':{motif:'teleport',cast:jb('portals.vertical.ring.dark_purple','portals.vertical.ring.bright_yellow'),hit:jb('misty_step.01.blue'),aura:jb('portals.vertical.ring.dark_purple','portals.vertical.ring.bright_yellow')},'fog-of-war':BURST,
 // A curled-up skittermander hurled as a ball: closest round thrown body, not an arrow or bullet.
 cannonball:{motif:'ranged',bolt:jb('boulder.toss.02.01.stone.brown'),hit:MUNDANE},
};
// Weapon media by native slug and mode. Flights replace; other slots prepend so each
// edition keeps its previous fallback when it lacks the new key.
const SF_SONIC={flight:jb('spell_projectile.sound.01.pinkteal','energy_beam.normal.blue.01'),muzzle:jb('soundwave.01.blue'),accent:jb('soundwave.01.blue')};
const SF_MISSILE={ranged:{flight:jb('ranged_missile.missile_only.001.orangeyellow','bullet.02.orange')}};
const SF2E_WEAPON_MEDIA={
 'replica-zo-microphone':{ranged:{...SF_SONIC,muzzle:jb('soundwave.01.purple','soundwave.01.blue'),accent:jb('soundwave.01.purple','soundwave.01.blue')}},
 'sonic-rifle':{ranged:{...SF_SONIC,accent:jb('soundwave.02.blue')}},streetsweeper:{ranged:{...SF_SONIC,accent:jb('soundwave.02.blue')}},
 'meme-cannon':{ranged:{flight:jb('spell_projectile.sound.01.pinkteal','energy_beam.normal.bluepink.02'),muzzle:jb('soundwave.01.purple','soundwave.01.blue'),accent:jb('dizzy_stars.200px.purple','dizzy_stars.200px.blueorange')}},
 'acid-dart-rifle':{ranged:{flight:jb('dart.01.throw.physical.white','dagger.throw.01.white')}},'reality-ripper':{ranged:{flight:jb('disintegrate.green')}},
 'gyrojet-pistol':SF_MISSILE,'reaction-breacher':SF_MISSILE,'stellar-cannon':SF_MISSILE,
 'skyfire-sword':{melee:{family:'sword',contact:jb('sword.melee.fire.orange','sword.melee.01.white')}},
 'plasma-sword':{melee:{contact:jb('lasersword.melee.orange.01')}},'quantum-reaver':{melee:{contact:jb('lasersword.melee.purple.01')}},'phase-cutlass':{melee:{contact:jb('lasersword.melee.dark_white.01')}},
 'zero-knife':{melee:{family:'dagger',contact:jb('dagger.melee.02.white')}},'force-needle':{melee:{family:'dagger',contact:jb('dagger.melee.02.white')}},
 'disintegration-lash':{melee:{family:'whip',contact:jb('melee_attack.01.flail.01')}},'fangblade':{melee:{contact:jb('melee_attack.01.sword_chainsaw.01')}},
 'bone-scepter':{melee:{element:'void',accent:jb('toll_the_dead.purple.skull_smoke','toll_the_dead.green.skull_smoke')}},
};
const SF_HOLY=/\b(holy|divine|sacred|deity|deities|god|gods|goddess|pray\w*|saint|sanctif\w*|blessing)\b/i,SF_DREAD=/\b(fear\w*|frighten\w*|death|dead|dying|doom\w*|dread\w*|terror\w*|intimidat\w*|demoraliz\w*|menac\w*|scar\w*|horr\w*|curse\w*|grave|bell|mourn\w*|sorrow\w*)\b/i;
// Lowering someone's fear is comfort, not a death knell.
const SF_COMFORT=/\b(reduce\w* (?:\w+ ){0,3}frightened|comfort\w*|calm\w*|sooth\w*|recenter\w*|reassur\w*)\b/i;
const SF_GUN=/\b(area fire|auto-?fire|ranged strikes?|ranged weapons?|guns?|firearms?|magazines?|sniper|automatic weapons?|area weapons?)\b/i;
const SF_MUSIC=/\b(music\w*|song\w*|sing\w*|perform\w*|instrument\w*|melod\w*|danc\w*|rhythm\w*|audience|concert\w*|chant\w*)\b/i;
// "Activity starts" filler → the cue its fiction names. Fortune keeps the stars.
const SF_TECH=/\b(hack\w*|computers?|tech|technolog\w*|devices?|drones?|programs?|programming|software|data|dataset|network\w*|cyber\w*|nanites?|holo\w*|androids?|robot\w*|machines?|circuit\w*|sensors?|electronic\w*|digital\w*|upload\w*|download\w*|firmware|interfaces?|augmentations?|gadgets?|toolkit|starships?|vehicles?|virus\w*|infosphere)\b/i;
// Fantasy rune circles, detect-magic scans and bardic notes on tech spells become sci-fi HUD markers.
const SF_ARCANE_KEY=/^jb2a\.(magic_signs|detect_magic|bardic_inspiration|music_notations|cast_shape|cast_generic\.01\.dark_purple|sleep\.target)/;
const sfFeatCue=(text,traits)=>traits.includes('fortune')||/\breroll/i.test(text)?null:
 SF_TECH.test(text.replace(/vitality network/gi,''))?SF_CUES.tech:
 /\b(gravit\w*|graviton|black hole|singularit\w*|telekine\w*)\b/i.test(text)?SF_CUES.gravity:
 traits.includes('healing')||/\b(regain\w* (?:\S+ ){0,4}hit points|regenerat\w*|heal\w*|temporary hit points)\b/i.test(text)?SF_CUES.healing:
 /\b(telepath\w*|psychic\w*|thoughtsense|brainwaves?|crowd the minds|link\w* (?:\S+ ){0,3}minds?)\b/i.test(text)?SF_CUES.telepathy:
 traits.includes('light')||/\b(glow\w*|photon\w*|biolumin\w*|radian\w*|luminous|shine|shining|bright light)\b/i.test(text)?SF_CUES.light:null;
function sfFeatMedia(feat,text,traits){
 const own=SF2E_FEAT_MEDIA[feat.slug],slots={...feat.assets},has=(slot,re)=>(slots[slot]??[]).some(k=>re.test(k));let patch=own;
 if(!patch&&feat.motif==='utility'&&has('aura',/twinkling_stars/))patch=sfFeatCue(text,traits);
 if(!patch&&feat.motif==='inspiration'&&has('cast',/music_notations/)&&!SF_MUSIC.test(text))patch=sfFeatCue(text,traits)??SF_CUES.comfort;
 if(patch){const {motif,theme,...media}=patch;Object.assign(slots,media);if(motif)feat.motif=motif;if(theme)feat.theme=theme;}
 // Guns fire bullets with a plain hit, never purple/blue magic bullets or arrows.
 if(!own&&['firearm','throughShot','mixedStrike','ranged'].includes(feat.motif)&&(has('bolt',/\.bullet\./)||has('bolt',/\.arrow\.physical/)&&SF_GUN.test(text))){
  if(has('bolt',/\.arrow\.physical|\.bullet\.\w+\.(purple|blue)$/))slots.bolt=/\b(area fire|auto-?fire)\b/i.test(text)?BURST.bolt:SHOT.bolt;
  if(has('hit',/^jb2a\.(impact\.00[15]\.(purple|blue)$|divine_smite)/))slots.hit=MUNDANE;
  if(feat.motif==='ranged')feat.motif='firearm';
 }
 // Holy pillar as a generic hit, death bell on non-dread fiction, acid that reads as water.
 for(const slot of ['cast','hit','aura']){
  if(has(slot,/divine_smite/)&&!SF_HOLY.test(text))slots[slot]=/\b(gravit\w*|graviton)\b/i.test(text)?SF_CUES.gravity.hit:MUNDANE;
  if(has(slot,/toll_the_dead/)&&(SF_COMFORT.test(text)||!SF_DREAD.test(text)))slots[slot]=slot!=='cast'?SF_CUES.comfort.hit:SF_COMFORT.test(text)?SF_CUES.comfort.cast:SF_CUES.telepathy.cast;
  if(feat.theme==='acid'&&slots[slot])slots[slot]=slots[slot].map(k=>k==='jb2a.liquid.blob.blue'?'jb2a.particles.outward.greenyellow.01.01':k);
 }
 // Solarian solar-weapon blows are light blades.
 if(traits.includes('solarian')&&/\bsolar weapon\b/i.test(text)&&/^jb2a\.melee_generic\./.test(slots.hit?.[0]??''))slots.hit=[...jb('lasersword.melee.yellow.01'),...slots.hit];
 if(JSON.stringify(slots)!==JSON.stringify(feat.assets)){feat.assets=slots;feat.notes=[...(feat.notes??[]),'SF2e-native media correction (2026-10-07 audit).'];}
}
// SF2e feat sounds (2026-10-08 audit, wave 2). PF2e sound designs cover only a dozen
// shared SF2e feats; the rest fell back to motif/theme defaults that played the
// "magic sensed" chime on ~350 mundane actions, anvils on Hide and wind on Stride.
// Physical blows and shots keep their motif sound; everything else takes the cue its
// fiction names, or deliberate silence (quiet utility, skill checks, rerolls).
const SF_PHYSICAL_SOUND={unarmed:'unarmed',doubleStrike:'sword',strike:'sword',heavyStrike:'greatsword',multiStrike:'sword',whirlwindStrike:'sword',drawStrike:'sword',feintStrike:'sword',fearStrike:'sword',bindStrike:'sword',tripStrike:'sword',tumbleStrike:'sword',charge:'sword',maneuverCombo:'unarmed',spellstrike:'sword',mixedStrike:'mixed',ranged:'ranged',firearm:'firearm',throughShot:'firearm',alchemicalShot:'firearm',bombThrow:'bomb',guard:'shieldRaise',shield:'shieldRaise',targetGuard:'shieldRaise',bind:'unarmed',trip:'unarmed',shove:'unarmed',trample:'earth'};
const SF_FEAT_SOUND={
 // Reviewed exceptions to the keyword rules below ('' = deliberately silent).
 'bounce-back':'','uncanny-comprehension':'','used-to-it':'','rising-to-the-challenge':'','shielding-arrogance':'','convert-information':'','pressure-plates':'','thoughts-of-a-lost-home':'','eat-it':'','hold-the-line':'','balance':'','barricade':'','feign-prone':'','adapt-to-injury':'',
 'tripartite-mind':'psychic','galaxy-brain':'psychic','empathic-pulse':'psychic','shocking-howl':'psychic','listen':'shadow',
 'drain-blood':'drain','consume-flesh':'drain','blood-feast':'drain','soul-furnace':'fire','channel-the-worlds-core':'earth','damoritoshs-claw':'holy','foresight':'bless',
 'release-radiation':'poison','entangling-mycelium':'growth','slime-spray':'water','slime-squirt':'water','spray-ink':'water','squirt-blood':'water','gooey-engulf':'water','gooey-engulf-entu':'water','slick-mucus':'water',
 'warp-reality':'time','quantum-pulse':'time','persistent-quantum-field':'time','pause-button':'teleport',
 'percussive-maintenance':'metal','break-it':'metal','disarm':'unarmed','reposition':'unarmed','piercing-spikes':'naturalPierce','hurl-ally':'allyHeave','you-should-see-the-other-guy':'sword',
 'explosive-deflection':'firearm','pin-down':'firearm','glitching-memory':'electric','sabotage':'electric',
 'auto-fire':'firearm','brutal-barrage':'firearm','covering-fire':'firearm','line-em-up':'firearm','spread-the-love':'firearm','youll-have-to-go-through-me':'firearm','strike':'sword','hampering-flare':'radiantRay',
 'draconic-breath':'dragonRoar','dragonkin-breath':'dragonRoar','dragon-breath-dragon-form':'dragonRoar','digestive-spray':'acid','volosian-spit':'acid','unleash-hell':'fire','contaminate':'poison','vibe-eruption':'psychic',
 'world-shards':'earth','timber':'earth','thunderous-slam':'earth','superhero-landing':'earth','trampling-stride':'earth','road-roller':'earth','destructive-dash':'earth','burrow':'earth','excavating-tentacles':'earth',
 'run-over':'metal',hide:'','dance-partner':'','create-a-diversion':'','rush-of-adrenaline':'healing','swear-vengeance':'','command-an-animal':'','sync-up':'psychic',infodump:'','coordinated-ambush':'',frenzy:'dragonRoar','black-hole':'force','synthesized-black-hole':'void','force-open':'metal','resonant-weapon':'metalResonance','spellsurge-ammo':'force','unleash-pneuma':'force','bone-shards':'naturalPierce',
 'shooting-star':'wind','vent-gas':'wind','dust-devil-spin':'wind','launching-jump':'wind','dive-for-cover':'wind','parkour':'wind','swim':'water','veil-of-ink':'water','synthesize-vapor':'water','adaptive-locomotion':'transform','skitter-idol-transformation':'transform',
};
const SF_T=(traits,...names)=>names.some(n=>traits.includes(n));
function sfFeatSoundCue(name,text,traits){
 const t=`${name}. ${text}`;
 if(SF_T(traits,'teleportation')||/\b(vanish\w* from existence|swap places|teleport\w*)\b/i.test(t))return 'teleport';
 if(SF_T(traits,'fire','plasma')||/\b(flames?|plasma)\b/i.test(t))return 'fire';
 if(SF_T(traits,'cold')||/\b(frost|freez\w*)\b/i.test(t))return 'cold';
 if(SF_T(traits,'electricity')||/\b(lightning|electricity damage)\b/i.test(t))return 'electric';
 if(SF_T(traits,'acid')||/\bacid damage to (?:the|each|all)\b/i.test(t))return 'acid';
 if(SF_T(traits,'poison','disease')&&/\b(spew\w*|vent\w*|spurt\w*|secret\w*|spray\w*|deal\w* (?:\S+ ){0,3}poison)\b/i.test(t)||/\bspores?\b.*\b(cloud|emanation)\b/i.test(t))return 'poison';
 if(/\b(roar\w*|bellow\w*|growl\w*|snarl\w*)\b/i.test(t))return 'dragonRoar';
 if(SF_T(traits,'sonic')||/\b(howl\w*|scream\w*|shriek\w*|caterwaul\w*|wail\w*)\b/i.test(t))return 'sonic';
 if(/\b(rage|fury|anger)\b/i.test(`${name} ${text.slice(0,200)}`))return 'dragonRoar';
 if(/\b(would (?:otherwise )?die|return from the brink|resuscitat\w*|cheating death)\b/i.test(t))return 'revive';
 if(/\bregenerat\w*\b/i.test(t))return 'natureHeal';
 if(SF_T(traits,'healing')||/\b(regain\w* (?:\S+ ){0,6}hit points|temporary hit points|transfer (?:\S+ ){0,3}hit points)\b/i.test(t))return 'healing';
 if(SF_T(traits,'light')||/\b(glow\w*|biolumin\w*|bright light|burst of light|pigmentation|colors? of your skin|shimmer\w*|strobe\w*|photon\w*)\b/i.test(t))return 'light';
 if(SF_T(traits,'darkness')||/\bdarkness\b/i.test(t))return 'shadow';
 if(SF_T(traits,'void'))return 'void';
 if(SF_T(traits,'polymorph')||/\b(change shape|grow(?:s|ing)? (?:in size|to size)|size increases|increase\w* (?:\S+ ){0,2}size|curl up into a ball)\b/i.test(t))return 'transform';
 if(/\b(gravit\w*|graviton|telekine\w* (?:hands?|lift|abilities)|gravitational)\b/i.test(t))return 'force';
 if(/\b(jets?|thrusters?|rockets?|jetpack|glide\w*|wings?)\b/i.test(t)||SF_T(traits,'move')&&/\b(leap\w*|jump\w*|fly|flies)\b/i.test(t))return 'wind';
 if(/\b(luck\w*|fortune|fate|miracle\w*|pray\w*|blessing)\b/i.test(t))return 'bless';
 if(/\b(sing|song|music\w*|danc\w*|chant\w*|melod\w*|instrument\w*)\b/i.test(t))return 'song';
 if(/\b(laugh\w*|joke\w*)\b/i.test(t))return 'laughter';
 if(/\b(applau\w*|cheer\w*)\b/i.test(t)&&/\b(crowd|audience)\b/i.test(t))return 'applause';
 if(!SF_COMFORT.test(t)&&SF_T(traits,'fear')||!SF_COMFORT.test(t)&&/\b(frighten\w*|demoraliz\w*|terrif\w*|taunt\w*)\b/i.test(t))return 'fear';
 if(/\b(telepath\w*|psychic\w*|minds?|brain\w*|consciousness)\b/i.test(t)&&SF_T(traits,'mental','concentrate'))return 'psychic';
 if(/\b(armplates?|chitinous plates|raise (?:a |your )?shield)\b/i.test(t))return 'shieldRaise';
 return '';
}
function sfFeatSound(feat,text){
 if(FEAT_SOUND_DESIGNS[feat.id])return FEAT_SOUND_DESIGNS[feat.id].profile;
 if(feat.slug in SF_FEAT_SOUND)return SF_FEAT_SOUND[feat.slug];
 const physical=SF_PHYSICAL_SOUND[feat.motif];
 // Strikes made with guns fire; a solarian's solar weapon is a blade.
 if(physical==='sword'&&/\b(ranged strikes?|guns?|firearms?|shots?|area fire|auto-?fire)\b/i.test(text)&&!/\bmelee strike\b/i.test(text))return 'firearm';
 // A physical motif on an action with no blow (Hide, Create a Diversion, oaths) is not a swing.
 if(physical==='shieldRaise'&&!/shield|armor|plate|shell|brace|block|guard|parry|cover/i.test(text))return sfFeatSoundCue(feat.name,text,feat.traits);
 if(physical&&!(feat.motif==='charge'&&/quickened/i.test(text))&&(!['sword','greatsword','unarmed','mixed'].includes(physical)||/\b(strikes?|attacks?|shove|trip|grapple|disarm|escape|reposition|hit)\b/i.test(text)))return physical;
 return sfFeatSoundCue(feat.name,text,feat.traits)||(feat.motif==='flight'&&!/\bburrow\b/i.test(text)?'wind':'');
}
// SF2e token-motion reviews (2026-10-08 audit, wave 2; full descriptions read). Movement
// feats played a stationary pulse; quickened/morale buffs rushed at a target; directives
// and encouragement lunged; helped allies recoiled as if struck. Ops: scripts/sf2e-motion.mjs.
const mRoute=(motion,label,distance=1.5,extra={})=>({motion,label,distance,duration:3000,intensity:.4,motionRange:'distance',motionArrival:40,motionHold:20,...extra});
const mApproach=(label,extra={})=>mRoute('rush',label,8,{motionRange:'target',duration:3800,motionArrival:35,motionHold:30,...extra});
const mJump=(label,extra={})=>mApproach(label,{motion:'leap',duration:4000,jumpHeight:.75,...extra});
const mStep=(label,extra={})=>mRoute('dodge',label,.5,{duration:1800,...extra});
const R=(review,keep)=>[{review,...(keep?{keep:true}:{})}],D=(...patterns)=>patterns.map(drop=>({drop}));
const calm=(...extra)=>[...D('lunge@source','recoil@targets','stagger@targets','rush@source','shake@targets'),...extra];
const settle={add:{ifNone:true,motion:'pulse',label:'Settle',intensity:.12,duration:1000,delay:150}};
const pull=label=>({review:mApproach(label,{subject:'targets',duration:3000,intensity:.25,when:'after',anchorKind:'impact'})});
const SF2E_FEAT_MOTION={
 // Stride / Step / Leap / Fly / Burrow now.
 'aerial-dash':R(mRoute('leap','Fly forward three times',2.6,{jumpHeight:.2,duration:3600,intensity:.2})),
 'another-day':R(mRoute('rush','Desperate Stride after the hit',1.2,{when:'after'})),
 'basic-flight':R(mRoute('leap','Short Fly',1.3,{jumpHeight:.15,arrivalLift:.2,duration:2700,intensity:.2})),
 brightbomb:R(mStep('Step out of the light burst')),
 'bullet-dance':R(mRoute('rush','Dancing double Stride with shots',2.2,{duration:3800})),
 burrow:[{add:{motion:'sink',label:'Dig into loose ground',duration:1400}}],
 'excavating-tentacles':[...D('levitate@source'),{add:{motion:'sink',label:'Tentacles burrow',duration:1400,delay:300}}],
 'burrowing-charge':[{review:mJump('Vertical Leap into the stinger Strike',{jumpHeight:1.1,duration:3600,delay:1400})},{add:{motion:'sink',label:'Burrow at double speed',duration:1400}}],
 'burst-of-speed':R(mRoute('rush','Hydraulic burst Stride',2,{duration:3000,intensity:.55})),
 'caterwaul-strut':R(mRoute('leap','Sashaying Stride',1.5,{jumpHeight:.1,duration:3200})),
 'caustic-trail':R(mRoute('rush','Slime-trailing double Stride',2.2,{duration:3600,intensity:.2})),
 climb:R(mRoute('rush','Climb along the incline',.5,{motionHeading:'up',duration:2200,intensity:.2})),
 'close-the-gap':R(mApproach('Advance into danger',{duration:3400})),
 'convert-tempo':R(mRoute('leap','Dancing Strides',2,{jumpHeight:.15,duration:3600})),
 'covering-flare':R(mRoute('rush','Double Stride under solar-flare cover',2.2,{duration:3800}),true),
 'crab-walk':R(mStep('Sideways scuttle',{distance:.3,duration:1500})),
 'dance-partner':R(mRoute('leap','Lead the dance partner',1,{jumpHeight:.1,duration:2600})),
 'dead-nerves':R(mRoute('rush','Double Stride through obstacles',2.2,{duration:3600})),
 'deaths-advance':R(mRoute('rush','Relentless double Stride',2.2,{duration:3700,intensity:.2})),
 'destructive-dash':R(mRoute('rush','Destructive dash',2,{duration:3400,intensity:.6})),
 'diplomatic-retreat':R(mRoute('rush','Double Stride away while talking',2.2,{motionHeading:'away',duration:3600,intensity:.2})),
 'dive-bomb':R(mJump('Diving leap at the prey',{duration:3800})),
 'dive-for-cover':R(mRoute('leap','Dive for cover',1,{jumpHeight:.3,duration:2400})),
 'double-dip':R(mStep('Two Steps',{distance:1,duration:2200})),
 'drop-and-move':R(mRoute('rush','Quadrupedal gallop',1.8,{duration:3200,intensity:.5})),
 'drop-tail':R(mRoute('rush','Stride away from the flailing tail',1.5,{motionHeading:'away',when:'after'})),
 'dwarven-gravity-hammer':[...D('lunge@source'),{review:mRoute('rush','Straight-line cannonball double Stride',2.4,{duration:3400,intensity:.65})}],
 'eager-combatant':R(mApproach('Straight Stride toward an enemy',{duration:3200})),
 'elusive-target':R(mStep('Elude the failed Strike')),
 'elven-caution':R(mRoute('rush','Half-Speed cautious Stride',.9,{duration:2400,motionHeading:'away'})),
 'evasive-jet':R(mRoute('rush','Siphon jet away from the attack',1.5,{motionHeading:'away',duration:2600,intensity:.6})),
 'expert-set-up':R(mStep('Initiative Step')),
 fidget:R(mStep('Step away from the adjacent creature',{motionHeading:'away'})),
 'flickering-existence':[{add:{motion:'flicker',label:'Vanish in static',duration:1200}},{review:mStep('Reappear 10 feet away',{distance:.8,duration:1400,when:'after'})}],
 fly:R(mRoute('leap','Fly',1.6,{jumpHeight:.15,arrivalLift:.2,duration:3000,intensity:.2})),
 'follow-their-lead':R(mRoute('rush','Stride alongside the ally',1.4,{duration:3000,intensity:.2})),
 'glitter-cloud':R(mRoute('rush','Stride inside the glitter cloud',1,{when:'after'})),
 'gooey-engulf':R(mRoute('rush','Engulfing Stride',1.6,{duration:3200,intensity:.3})),'gooey-engulf-entu':R(mRoute('rush','Engulfing Stride',1.6,{duration:3200,intensity:.3})),
 'goring-rush':R(mApproach('Double Stride into the horns Strike',{duration:4000})),
 'grace-of-the-ages':R(mStep('Step away from the attacker',{motionHeading:'away'})),
 'high-jump':R(mRoute('leap','Stride then High Jump',1.4,{jumpHeight:1.1,duration:3600})),
 jet:R(mRoute('rush','Straight-line siphon jet',2,{duration:2800,intensity:.6})),
 'land-on-your-foe':R(mJump('Leap down onto the foe',{distance:3,duration:3400}),true),
 'launching-jump':R(mRoute('leap','Posture-launched high leap',1.2,{jumpHeight:1,duration:3200})),
 leap:R(mRoute('leap','Short Leap',2,{jumpHeight:.4,duration:2600})),
 'long-jump':R(mRoute('leap','Stride into a Long Jump',3,{jumpHeight:.6,duration:3800})),
 'lucky-like-a-squox':R(mStep('Initiative Step into cover')),
 march:R(mRoute('rush','Formation Stride',1.4,{duration:3000,intensity:.25})),
 'mobile-aim':R(mRoute('rush','Stride then Aim',1.4,{duration:3000})),
 momentum:R(mStep('Two momentum Steps',{distance:1,duration:2200})),
 parkour:R(mRoute('leap','Stride and jump over obstacles',2.4,{jumpHeight:.7,duration:3800})),
 'practiced-escape':R(mStep('Step after escaping',{when:'after'})),
 'primal-vitality':R(mRoute('rush','Double Stride through creatures',2.2,{duration:3600,intensity:.2})),
 'quick-legs':R(mStep('Up to three quick Steps',{distance:1.2,duration:2400})),
 'rat-race':R(mRoute('rush','Triple Stride',3,{duration:4200})),
 'reactive-step':R(mRoute('dodge','Two Steps toward the moving creature',1,{duration:2000})),
 'ride-the-river-between':[...D('levitate@source'),{review:mRoute('rush','Move along the solar river',2,{duration:3200,intensity:.2,when:'after'})}],
 'road-roller':R(mRoute('roll','Road-rolling Stride',1.5,{duration:3000,intensity:.4})),
 'rocket-jump':R(mRoute('leap','Explosion-propelled Leap',1.6,{jumpHeight:.9,duration:3000,when:'after',anchorKind:'travel'}),true),
 'running-shot':R(mRoute('rush','Aimed Stride with a shot on the move',1.6,{duration:3200}),true),
 'scurry-to-safety':R(mRoute('rush','Scurry to safety',1.2,{motionHeading:'away',duration:2600})),
 'serpentine-scurry':R(mRoute('rush','Zig-zag Strides',2,{duration:3400})),
 'shed-skin':R(mStep('Slip away after the Escape',{when:'after'})),
 'shooting-star':R(mRoute('rush','Straight-line shooting-star dash',3,{duration:3400,intensity:.6})),
 'shore-scuttle':R(mRoute('rush','Shore scuttle',1.5,{duration:3000,intensity:.2})),
 'shot-on-the-run':R(mRoute('rush','Stride into position before firing',1.6,{duration:3000}),true),
 'skitter-wrastle':R(mApproach('Step into the grapple',{distance:1,duration:2200})),
 'slick-mucus':R(mRoute('rush','Slippery Stride',1.6,{when:'after'})),
 spellsail:[{add:{motion:'flicker',label:'Ride the spell to its target',duration:1200,after:'cast',startOffset:300}}],
 sprint:R(mRoute('rush','Sprint',3.5,{duration:4200,intensity:.55})),
 'stand-aside':R(mRoute('rush','Stride to make room',1.4,{duration:3000})),
 'steady-advance':[...D('lunge@source','recoil@targets','stagger@targets'),{review:mRoute('rush','Steady double Stride',2.2,{duration:3600,intensity:.5})}],
 'stellar-rush':R(mRoute('rush','Stellar double Stride',2.6,{duration:3600,intensity:.55})),
 step:R(mStep('Step')),stride:R(mRoute('rush','Stride',1.5)),sneak:R(mRoute('rush','Half-Speed Sneak',1,{duration:3200,intensity:.15})),
 'step-between':R(mRoute('rush','Liminal Stride',1.4)),'stride-between':R(mRoute('rush','Liminal double Stride',2.2,{duration:3600})),
 'swift-reposition':R(mStep('Twist away from the threat',{motionHeading:'away'})),
 swim:R(mRoute('rush','Swim',1,{intensity:.15})),
 'swooping-rescue':R(mRoute('leap','Swooping double Fly',2.4,{jumpHeight:.2,duration:3800,intensity:.2})),
 'tactical-advance':R(mRoute('roll','Weaving, rolling Stride',1.6,{duration:3200})),
 'telekinetic-sprint':R(mRoute('rush','Telekinetic sprint',1.8,{duration:3000})),
 'thermal-conversion':R(mRoute('rush','Heat-powered Stride',2.6,{duration:3600,intensity:.6})),
 'timely-team-up':R(mApproach('Rush to the damaged ally',{duration:4000,intensity:.25})),
 'trampling-stride':R(mRoute('rush','Trampling Stride',2.4,{duration:3800,intensity:.65})),
 'tumble-through':R(mRoute('roll','Tumble through',1.5,{duration:3000})),
 'underfoot-stampede':[...D('lunge@source'),{review:mRoute('rush','Double straight-line stampede',2.4,{duration:3800,intensity:.4})}],
 'wriggling-tail':R(mStep('Step free of the grab',{when:'after'})),
 balance:R(mRoute('rush','Careful balance',1,{duration:3000,intensity:.15})),crawl:R(mRoute('rush','Crawl 5 feet',.5,{duration:2400,intensity:.1})),
 breach:[...D('lunge@source'),{review:mRoute('leap','Whale-breach Leap',1.2,{jumpHeight:1,duration:2800})}],
 // No movement now: Quickened grants, morale, hiding, oaths, reroll luck.
 ...Object.fromEntries('activate-all-brains charged-blood create-a-diversion hide rush-of-adrenaline swear-vengeance photon-accelerator unstable-overdrive waiting-for-your-moment kick-it-into-overdrive need-for-speed you-cant-teach-speed confident-actualization soul-shield frenzy'.split(' ').map(s=>[s,calm({drop:'brace@source'},settle)])),
 // Directives, encouragement and commands: no lunge at the helped ally or animal.
 ...Object.fromEntries('delegate for-the-queen nonnegotiable-command perfect-synergy command-an-animal coordinated-ambush sync-up competitive-spirit hold-hands skillful-encouragement keep-on-keeping-on infodump'.split(' ').map(s=>[s,calm()])),
 'assistive-shove':[...D('recoil@targets','stagger@targets'),{review:mRoute('rush','Ally shoved out of harm’s way',1,{subject:'targets',targetLimit:1,motionHeading:'away',duration:2200,intensity:.2,when:'after'})}],
 // Gravity pulls victims in; it does not lunge the solarian.
 'black-hole':[...D('lunge@source','recoil@targets','stagger@targets'),{add:{motion:'press',label:'Gravity well',duration:1100,delay:100}},pull('Creatures pulled toward you')],
 'synthesized-black-hole':[...D('lunge@source','recoil@targets','stagger@targets'),{add:{motion:'press',label:'Core collapses inward',duration:1100,delay:100}},pull('Creatures pulled toward you')],
 cyclone:[...D('lunge@source','recoil@targets','stagger@targets'),{add:{motion:'spin',label:'Spin in place',duration:1400,delay:0,intensity:.35}},pull('Foes drawn into the vortex')],
 'hostile-gravity':[{swap:'levitate',to:'press'}],'gravity-grasp':[{swap:'levitate',to:'press'}],
 // Tech concealment glitches instead of drifting; defensive reactions brace.
 'camera-blur':[...D('*@source'),{add:{motion:'flicker',label:'Pixelated glitch',duration:1200,delay:200}}],
 'encode-presence':[...D('*@source'),{add:{motion:'flicker',label:'Scrambled presence',duration:1200,delay:200}}],
 'cloaking-field':[...D('*@source'),{add:{motion:'flicker',label:'Cloak engages',duration:1200,delay:200}}],
 ...Object.fromEntries('plate-deflection raise-crystalline-strands snap-shut conglobation immediate-relaxation living-shield energy-deflection fluid-anatomy deflect-force'.split(' ').map(s=>[s,[...D('*@source'),{add:{motion:'brace',label:'Brace against the blow',duration:900,delay:100}}]])),
};
// SF2e spell sound/motion corrections. FILL only replaces a silent design (the shared
// PF2e sound designs win when they assign one); FORCE replaces a contradicting cue.
const SF2E_SPELL_SOUND_FORCE={'cellular-stimulant':'time','share-life':'shield'};
const SF2E_SPELL_SOUND_FILL={command:'psychic','control-weather':'wind','divine-decree':'holy','divine-wrath':'holy','divine-inspiration':'bless',enthrall:'song','uncontrollable-dance':'song',implosion:'force','shadow-blast':'shadow','spirit-blast':'force','synaptic-pulse':'psychic','phantasmal-calamity':'psychic','wave-of-despair':'fear','vision-of-death':'fear','mask-of-terror':'fear','phantom-pain':'psychic','warp-mind':'psychic',confusion:'psychic',dominate:'psychic',paralyze:'psychic',stupefy:'psychic',possession:'psychic',charm:'psychic','never-mind':'psychic',paranoia:'psychic',phantasmagoria:'psychic',hallucination:'psychic',calm:'sleep',bane:'shadow','clear-mind':'healing','sound-body':'healing',stabilize:'healing','vital-beacon':'healing','spirit-link':'healing','spiritual-armament':'metal','telekinetic-maneuver':'force',repulsion:'force','resist-energy':'shield','planar-palace':'summon'};
// Gravity presses down; buffs and quiet hexes do not shake, recoil or lunge.
const SF2E_SPELL_MOTION={'logic-bomb':[{drop:'shake@targets'}],'twisted-vision':[{drop:'shake@targets'}],'ghost-killer-weapon':[{drop:'lunge@source'},{drop:'recoil@targets'},{drop:'stagger@targets'}],'injury-echo':[{drop:'lunge@source'}]};
const spellFallback={ward:'forceShield',healing:'restore',fear:'dread',mind:'mentalJolt',teleport:'portalStep',transform:'form',shadow:'darkShroud',divination:'eye',sonic:'song',weapon:'weaponRunes',light:'lightOrb',time:'swiftTime',force:'empower',arcane:'bodyRunes'};
for(const entry of source.entries){
 const item=entry.source,s=item.system??{},native={systemId:'sf2e',uuid:entry.uuid};
 if(item.type==='spell'){
  const spell={...buildSpellDesign(entry,databases,pfSpells.get(item._id)),...native};
  if(spell.design.unavailable){
   const text=plainFeatDescription(s.description?.value).toLowerCase();
   const motif=SF2E_SPELL_MOTIFS[spell.slug]??(/weapon|ammunition|shot|strike/.test(text)?'weaponRunes':/data|information|search|detect|computer|sensor|navigate/.test(text)?'eye':/illusion|hologram|image|disguise/.test(text)?'lightBend':/teleport|portal|dimension/.test(text)?'portalStep':spellFallback[spell.theme]??'bodyRunes');
   if(!SPELL_MOTIFS[motif])throw Error(`Unknown SF2e motif ${motif} for ${spell.slug}`);
   Object.assign(spell.design,{motif,pattern:SPELL_MOTIFS[motif].pattern,label:SPELL_MOTIFS[motif].label,unavailable:false,rationale:`${SPELL_MOTIFS[motif].label}: reviewed SF2e cue from the full description; no bespoke JB2A composition exists.`});spell.quality='symbolic';
   spell.notes=[...(spell.notes??[]).filter(n=>!n.startsWith('Configure this spell')),'Symbolic SF2e cue chosen from the full description; bespoke artwork is unavailable.'];
   spell.design.assets=resolveSpellMedia(databases,spell.theme,SPELL_MOTIFS[motif],SPELL_THEMES[spell.theme],{name:spell.name,slug:spell.slug,design:spell.design,area:spell.area,delivery:spell.delivery});
  }
  if(spell.slug==='supercharge-weapon'){
   Object.assign(spell,{theme:'force',delivery:'target',trigger:'use',quality:'themed'});Object.assign(spell.design,{motif:'empower',pattern:SPELL_MOTIFS.empower.pattern,subject:'targets',unavailable:false});spell.design.assets=resolveSpellMedia(databases,'force',SPELL_MOTIFS.empower,SPELL_THEMES.force,{name:spell.name,slug:spell.slug,design:spell.design,delivery:'target'});
  }
  const spellText=plainFeatDescription(s.description?.value);
  if(!entry.shared)for(const [slot,keys]of Object.entries(spell.design.assets??{})){
   if(SF_TECH.test(spellText.replace(/(vitality|your) network/gi,""))&&keys.some(k=>SF_ARCANE_KEY.test(k)))spell.design.assets[slot]=keys.some(k=>/\.loop\b/.test(k))?jb('markers_scifi.001.loop.001.blueteal'):slot==='cast'?SF_CUES.tech.cast:SF_CUES.tech.aura;
   // Screams and howls are sound waves, not sheet music.
   else if(keys.some(k=>/^jb2a\.music_notations\./.test(k))&&!SF_MUSIC.test(spellText))spell.design.assets[slot]=jb('soundwave.02.blue');
  }
  const motionPatch=SF2E_SPELL_MOTION[spell.slug]??(!entry.shared&&spell.design?.motif==='gravity'?[{swap:'levitate',to:'press',label:'Gravity presses down'}]:null);
  if(motionPatch)spell.motionPatch=motionPatch;
  spells.push({entry,spell});
 }else if(['feat','action'].includes(item.type)){
  const active=classifyFeat(item);if(!active.included){excluded.push({uuid:entry.uuid,type:item.type,classification:active.classification});continue;}
  const design=analyzeFeat(item,entry.path),traits=s.traits?.value??[];
  const resolved=resolveFeatMedia(databases,design.theme,FEAT_MOTIFS[design.motif],SPELL_THEMES[design.theme],{name:item.name,slug:design.slug,motif:design.motif,rationale:design.rationale,direction:design.direction,traits,description:plainFeatDescription(s.description?.value)});
  const feat={id:item._id,name:item.name,slug:design.slug,...native,...(abilityKind(entry)==='feat'?{}:{recipeKind:abilityKind(entry)}),level:s.level?.value??0,actionType:s.actionType?.value,actions:s.actions?.value,traits,classTraits:traits.filter(t=>classes.has(t)),category:s.category??entry.pack,trigger:'use',descriptionHash:active.descriptionHash,...design,...resolved};
  if(!entry.shared)sfFeatMedia(feat,plainFeatDescription(s.description?.value),traits);
  feats.push({entry,feat});
 }else if(item.type==='weapon'){
  // Launchers and some grenades ship without a native range; they fly, they are never swung.
  const launcher=/\/grenade-launcher-/.test(entry.path),grenade=s.group==='grenade'||(s.traits?.value??[]).includes('grenade')||launcher;
  const range=s.range??(grenade?Number(plainFeatDescription(s.description?.value).match(/\brange (?:increment )?(?:of )?(\d+) f/i)?.[1])||70:null);
  const weapon={...analyzeWeapon(grenade?{...item,system:{...s,group:'bomb',range}}:item,entry.path),...native,nativeGroup:grenade?'grenade':s.group};
  for(const mode of weapon.modes){
   const roots={laser:['lasershot.red','lasershot.orange'],plasma:['fire_bolt.orange'],shock:['bolt.lightning.blue','arrow.lightning.blue'],cryo:['ray_of_frost.blue','snowball_toss'],sonic:['energy_beam.normal.blue'],corrosive:['spell_projectile.poison.greenyellow','eldritch_blast.green'],projectile:['bullet.02','bullet.01'],sniper:['bullet.02','bullet.01'],dart:['dart.01.throw'],flame:['fire_bolt.orange'],mental:['eldritch_blast.purple'],null:['disintegrate.purple','eldritch_blast.purple']};
   if(mode.mode==='ranged'&&roots[s.group]){mode.family=['projectile','sniper'].includes(s.group)?'firearm':s.group==='dart'?'blowgun':'firearm';mode.flightRoots=roots[s.group];}
   Object.assign(mode,selectWeaponMedia(databases,weapon,mode));
   if(mode.mode==='ranged'&&['cryo','sonic'].includes(s.group)){
    mode.assets.flight=[...new Set(Object.values(databases).map(rows=>rows.filter(r=>roots[s.group].some(p=>r.key===`jb2a.${p}`||r.key.startsWith(`jb2a.${p}.`))&&['beam','projectile'].includes(assetGeometry(r))).sort((a,b)=>a.key.localeCompare(b.key))[0]?.key).filter(Boolean))];
   }
   if(launcher)Object.assign(mode,{mode:'ranged',family:'firearm'}),mode.assets.muzzle=jb('muzzle_flash.single.01.yellow');
   const fix=SF2E_WEAPON_MEDIA[weapon.slug]?.[mode.mode]??(mode.mode==='ranged'&&s.group==='sonic'?SF_SONIC:null);
   if(fix){const {family,element,...media}=fix;if(family)mode.family=family;if(element)Object.assign(mode,{element,elements:[element]});for(const [slot,keys]of Object.entries(media))mode.assets[slot]=[...new Set([...keys,...(slot==='flight'?[]:mode.assets[slot]??[])])];}
  }
  weapons.push({entry,weapon});
 }else if(['condition','effect'].includes(item.type)){
  const kind=entry.pack==='conditions'||item.type==='condition'?'condition':'effect',meta=metadata(entry,kind),slug=meta.slug,shared=pfStates.get(item._id),design={...classify(item),...(/^spell-effect-skyfire-wings-/.test(slug)?{theme:'fire'}:{})},profile=profiles[design.theme];
  const state={...(shared?structuredClone(shared):{}),...meta,id:`${entry.pack}-${item._id}`,systemId:'sf2e',slug,group:entry.pack,nativeDuration:s.duration??null,theme:design.theme,quality:design.quality,color:design.hex??profile.hex,description:s.description?.value??'',...selectStateMedia(databases,design.theme,slug,design.color),opacity:1,scale:1.35};
  // SF2e-only afflictions in the conditions pack (Glitching, Suppressed, Untethered)
  // share the reviewed debuff plans with the PF2e conditions.
  if(item.type==='condition'||kind==='condition'&&Object.hasOwn(CONDITION_PLANS,slug))Object.assign(state,buildConditionDesign(state,databases));
  else Object.assign(state,statePresentation(state));
  if(shared?.auras)state.auras=[];if(shared?.auraSources)state.auraSources=[];
  for(const rule of s.rules??[])if(rule.key==='Aura'){
   state.auras??=[];state.auras.push({slug:rule.slug??slug,radius:typeof rule.radius==='number'?rule.radius:null});
  }
  states.push({entry,state});
 }else excluded.push({uuid:entry.uuid,type:item.type,classification:'no-native-activation'});
}
// Aura effect links identify the source token; render the native prepared radius.
for(const {entry,state}of states)for(const sourceEntry of source.entries)for(const rule of sourceEntry.source.system?.rules??[])if(rule.key==='Aura')for(const effect of rule.effects??[]){
 const reference=effect.uuid;if(typeof reference!=='string')continue;
 if(reference!==entry.uuid&&reference!==`Compendium.sf2e.${entry.pack}.Item.${entry.source.name}`)continue;
 state.auraSources??=[];state.auraSources.push({uuid:sourceEntry.uuid,slug:rule.slug??sourceEntry.source.system?.slug??sourceEntry.path.split('/').at(-1).replace(/\.json$/,''),radius:typeof rule.radius==='number'?rule.radius:null});
}
for(const {state}of states)if(state.auras?.length||state.auraSources?.length){
 try{state.auraDesign=buildAuraDesign(state,databases);}catch{
  const media=selectStateMedia(databases,state.theme,state.slug);state.auraAssets=media.assets;state.auraDesign={id:state.slug,layers:[{assets:media.assets,stageId:'native-aura-field',scale:1,opacity:.9,below:true,playbackRate:.65}]};
 }
}
const variety=diversifySpellMedia(spells.map(e=>e.spell),databases,SPELL_MOTIFS);
console.log(`SF2e: ${spells.length} spells, ${feats.length} active abilities, ${weapons.length} weapons, ${states.length} sustained states.`);
const assets=[...spells.map(e=>e.spell.design.assets),...feats.map(e=>e.feat.assets),...weapons.flatMap(e=>e.weapon.modes.map(m=>m.assets))];
const keys=[...new Set(assets.flatMap(media=>Object.values(media).flat()))],rows=new Map(Object.values(databases).flat().map(row=>[row.key,row]));
let next=0;await Promise.all(Array.from({length:4},async()=>{while(next<keys.length){const key=keys[next++];if(!timings[key]){const row=rows.get(key),geometry=assetGeometry(row),duration=MEDIA_DURATIONS[key];const timing=duration&&!['beam','projectile','line'].includes(geometry)?{duration,baked:false}:await mediaTiming(row,databases);if(timing)timings[key]=timing;}}}));
for(const [key,timing]of Object.entries(timings))timing.duration=Math.max(timing.duration??0,MEDIA_DURATIONS[key]??0);
for(const {spell}of spells)spell.design.mediaTiming=Object.fromEntries(Object.entries(spell.design.assets).flatMap(([slot,keys])=>{const samples=keys.map(k=>timings[k]).filter(Boolean);return samples.length?[[slot,{duration:Math.max(...samples.map(t=>t.duration)),baked:samples.every(t=>t.baked),...(samples.some(t=>t.contact)?{contact:Math.max(...samples.map(t=>t.contact??0))}:{})}]]:[];}));
for(const {feat}of feats)feat.mediaTiming=Object.fromEntries(Object.values(feat.assets).flat().filter(k=>timings[k]).map(k=>[k,timings[k]]));
for(const {weapon}of weapons)for(const mode of weapon.modes){mode.mediaTiming=Object.fromEntries(Object.values(mode.assets).flat().filter(k=>timings[k]).map(k=>[k,timings[k]]));mode.approximations=mode.selections.filter(s=>s.approximation).map(s=>`${s.edition}: ${s.key}`);}
allocateSpellIdentities(spells.map(e=>e.spell),spell=>spellRecipe(spell,undefined,{motion:false}),databases,new Map(source.entries.filter(e=>e.source.type==='spell').map(e=>[e.source._id,e.source])));frameFeatCatalog(feats.map(e=>e.feat),databases);
const bind=(recipe,entry)=>validateRecipe({...recipe,description:'',systemId:'sf2e',catalogEntry:entry.id,itemUuid:entry.uuid,lifecycle:['condition','effect'].includes(entry.kind)?'document':recipe.lifecycle,stateEntry:['condition','effect'].includes(entry.kind)?entry.id:recipe.stateEntry});
for(const {entry,spell}of spells){const meta=metadata(entry,'spell'),design=SPELL_SOUND_DESIGNS[spell.id],sound=SF2E_SPELL_SOUND_FORCE[spell.slug]??(design?design.profile||SF2E_SPELL_SOUND_FILL[spell.slug]||'':SF2E_SPELL_SOUND_FILL[spell.slug]??themeSound(spell.theme));entries.push({...meta,level:spell.rank,theme:spell.theme,quality:spell.quality,spell,variants:[{id:'cast',label:spell.kind==='cantrip'?'Cantrip':`Rank ${spell.rank}`,soundProfile:sound,recipe:bind((r=>r.bespoke?r:({...r,stages:applySfMotionPatch(spell,r.stages,spell.motionPatch)}))(spellRecipe(spell)),meta)}]});}
// Guns recoil; they never lunge. Reviewed SF2e motion replaces the shared default.
const sfFeatRecipe=(feat,profile)=>{const recipe=featRecipe(feat),patch=SF2E_FEAT_MOTION[feat.slug]??(profile==='firearm'?[{swap:'lunge',to:'recoil',label:'Shot recoil'}]:null);return patch?{...recipe,stages:applySfMotionPatch(feat,recipe.stages,patch)}:recipe;};
// Foam and nausea gas are not sonic shockwaves.
const SF2E_WEAPON_SOUND={'hardening-foam-grenade':'bomb-water','miasmatic-grenade':'bomb-poison'};
// Grenades and thrown weapons wind up and throw; bow-like guns recoil.
const sfWeaponMotion=(weapon,mode)=>mode==='thrown'||weapon.nativeGroup==='grenade'&&mode!=='melee'?[{swap:'lunge',to:'throw',label:'Wind up and throw'}]:mode==='ranged'?[{swap:'lunge',to:'recoil',label:'Release and settle'}]:null;
const soundDump=[];
for(const {entry,feat}of feats){const meta=metadata(entry,abilityKind(entry)),profile=sfFeatSound(feat,meta.descriptionText);if(process.env.SF2E_SOUND_DUMP)soundDump.push(`${profile||'(silent)'}|${feat.slug}|${feat.motif}|${feat.theme}|${meta.traits.join(',')}|${meta.descriptionText.slice(0,160)}`);entries.push({...meta,theme:feat.theme,quality:feat.quality,actionType:feat.actionType,actions:feat.actions,classTraits:feat.classTraits,variants:[{id:'activate',label:feat.actionType==='action'?`${feat.actions??1} actions`:feat.actionType,soundProfile:profile,soundNamespace:'ability',recipe:bind(sfFeatRecipe(feat,profile),meta)}]});}
if(process.env.SF2E_SOUND_DUMP)await writeFile(process.env.SF2E_SOUND_DUMP,soundDump.sort().join('\n'));
for(const {entry,weapon}of weapons){
 const meta=metadata(entry,'weapon'),variants=weapon.modes.map(mode=>({id:mode.mode,label:mode.mode,weaponMode:mode.mode,soundNamespace:'ability',soundProfile:SF2E_WEAPON_SOUND[weapon.slug.replace(/-(commercial|tactical|advanced|superior|elite|ultimate|paragon)$/,'')]??WEAPON_SOUND_DESIGNS[`${weapon.id}:${mode.mode}`]?.profile??(weapon.nativeGroup==='laser'?'fireRay':weapon.nativeGroup==='cryo'?'coldRay':weapon.nativeGroup==='shock'?'electric':weapon.nativeGroup==='sonic'?'sonic':weapon.nativeGroup==='corrosive'?'acid':weapon.nativeGroup==='plasma'?'fire':mode.payload?`bomb-${mode.element}`:mode.family),recipe:bind((r=>r.bespoke?r:({...r,stages:applySfMotionPatch(weapon,r.stages,sfWeaponMotion(weapon,mode.mode))}))(weaponRecipe(weapon,mode.mode)),meta)}));
 const automatic=weapon.traits.includes('automatic'),trait=weapon.traits.find(t=>/^area-(burst|cone|line)(?:-\d+)?$/.test(t)),tag=entry.source.system.description?.value.match(/@Template\[(burst|cone|line)\|distance:(\d+)/);
 const area=automatic?{type:'cone',value:Math.max(5,Math.floor((weapon.range??entry.source.system.range??10)/2/5)*5)}:trait?{type:trait.split('-')[1],value:Number(trait.split('-')[2])||(trait.includes('burst')?5:entry.source.system.range)}:weapon.nativeGroup==='grenade'&&tag?{type:tag[1],value:Number(tag[2])}:/\/grenade-launcher-/.test(entry.path)?{type:'burst',value:10}:null;
 if(area){
  const mode=weapon.modes[0],recipe=variants[0].recipe,impact=recipe.stages.find(s=>s.kind==='impact'),flight=recipe.stages.find(s=>s.kind==='travel'),label=automatic?'Auto-Fire':'Area Fire';
  const stages=recipe.stages.filter(s=>s.kind==='motion').map(s=>({...s,distance:.08,afterStage:''}));
  if(area.type==='cone'){
   const selectedCones=Object.values(databases).map(db=>db.filter(row=>assetGeometry(row)==='cone'&&coneMaterialMatches(row.key,mode.element)).sort((a,b)=>a.key.localeCompare(b.key))[0]?.key).filter(Boolean),coneKeys=[...new Set(selectedCones)];
   if(selectedCones.length===Object.keys(databases).length){
    const samples=await Promise.all(coneKeys.map(async key=>timings[key]??await mediaTiming(rows.get(key),databases)));
    stages.push({...impact,kind:'template',stageId:`${meta.id}-area`,label,assets:coneKeys,delay:500,afterStage:'',duration:Math.max(2500,...samples.filter(Boolean).map(t=>t.duration)),scale:1,oneShot:true});
   }else stages.push({...flight,stageId:`${meta.id}-area-fan`,label,travelDestination:'area',areaLayout:'fan',fanCount:automatic?7:5,delay:500,afterStage:'',opacity:.85});
  }else{
   if(weapon.nativeGroup==='grenade'&&flight)stages.push({...flight,afterStage:'',travelDestination:'area'});
   stages.push({...impact,kind:'template',stageId:`${meta.id}-area`,label,assets:area.type==='line'?mode.assets.flight:mode.assets.accent,delay:500,afterStage:weapon.nativeGroup==='grenade'?flight?.stageId??'':'',duration:Math.max(2500,impact?.duration??0,area.type==='line'?flight?.duration??0:0),scale:1,oneShot:true});
  }
  variants.push({id:'area',label,weaponMode:'area',soundNamespace:'ability',soundProfile:variants[0].soundProfile,recipe:bind({...recipe,id:`${recipe.id}-area`,trigger:'template',weaponMode:undefined,previewArea:area,stages},meta)});
 }
 entries.push({...meta,group:weapon.nativeGroup,theme:weapon.modes[0].element,quality:'themed',variants});
}
for(const {entry,state}of states){const meta=metadata(entry,state.kind),variants=[];for(const damageType of state.slug==='persistent-damage'?Object.keys(state.damageVariants??{}):[undefined])variants.push({id:damageType??'active',label:damageType??'Active',damageType,recipe:bind(stateRecipe(state,{damageType}),meta)});entries.push({...meta,theme:state.theme,quality:state.quality,private:state.private??['hidden','invisible','undetected','unnoticed'].includes(state.slug),state,variants});}
// Physical family aliases and non-elemental grenade payloads need real profiles.
const soundAliases={chakram:'thrown',glaive:'polearmBlade',greataxe:'axe',contact:'unarmed','bomb-physical':'bomb-explosive','bomb-untyped':'bomb-soft'};
for(const entry of entries)for(const variant of entry.variants){
 variant.soundProfile=soundAliases[variant.soundProfile]??variant.soundProfile;
 if(!entry.state&&variant.soundProfile&&!{...SOUND_PROFILES,...ABILITY_SOUND_PROFILES}[variant.soundProfile])throw Error(`Unknown SF2e sound profile: ${entry.name}/${variant.soundProfile}`);
}
const context={source:{id:'s',center:{x:100,y:100},w:100,h:100,document:{width:1,height:1}},targets:[{id:'t',center:{x:400,y:100},w:100,h:100,document:{width:1,height:1}}],gridSize:100,gridDistance:5,template:{id:'area'},area:{type:'cone',center:{x:100,y:100},endpoint:{x:500,y:100},diameter:400,length:400,width:100,angle:90}};
const issues=[];for(const entry of entries)for(const variant of entry.variants)for(const [edition,db]of Object.entries(databases))try{planRecipe(variant.recipe,db,context);}catch(error){issues.push({id:entry.id,name:entry.name,variant:variant.id,edition,error:error.message});}
const meta={systemId:'sf2e',version:source.version,ref:source.ref,sha:source.sha,repository:source.repository,sourceDocuments:source.entries.length,counts:Object.fromEntries(['spell','feat','action','feature','weapon','condition','effect'].map(k=>[k,entries.filter(e=>e.kind===k).length])),variants:entries.reduce((n,e)=>n+e.variants.length,0),excluded:excluded.length,descriptionHashes:entries.length,variety,issues:issues.length};
await writeFile('data/sf2e-catalog.mjs',`// Native SF2e catalog. References only; no animation or sound media bundled.\nexport const SF2E_SOURCE=${JSON.stringify(meta)};\nexport const SF2E_ENTRIES=${JSON.stringify(entries)};\n`);
await writeFile('data/sf2e-catalog-validation.json',JSON.stringify({source:meta,issues,excluded},null,2));
console.log(JSON.stringify({source:meta,issues:issues.slice(0,15)},null,2));if(issues.length)process.exitCode=1;
