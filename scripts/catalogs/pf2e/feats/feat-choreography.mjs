import { validateRecipe } from "../../../core/model.mjs";
import {withCatalogFx} from '../../shared/catalog-fx.mjs';
import { SPELL_THEMES } from "../spells/spell-choreography.mjs";
import { applyFeatDirection, reviewedFeatActivation } from "./feat-direction.mjs";
import { directedFeatMotion, reviewFeatMotion } from "./feat-motion.mjs";
import { applyCatalogMotion, FEAT_ACTION_MOTION_REVIEWS, addPhysicalFeatGesture } from '../../shared/catalog-motion.mjs';
import { applyReviewedTraversal } from "./feat-traversal.mjs";
import { timedStages } from "../../../engines/playback/composition.mjs";
import { addAbilitySounds } from "../../../engines/sound/ability-sounds.mjs";
import { tossFeatRecipe } from "./feat-toss.mjs";

export const FEAT_THEMES = Object.fromEntries(Object.entries(SPELL_THEMES).map(([key, value]) => [key, { label: value.label, color: value.color }]));
export const FEAT_MOTIFS = {
  ray: { label: "Gather → directed beam → contact", cast: "energy_field,cast_generic", bolt: "energy_beam,disintegrate", hit: "impact" },
  lineCue: { label: "Element gathers → directed line cue", bolt: "energy_beam,energy_conduit", hit: "impact" },
  firearm: { label: "Aim → firearm shot → contact", cast: "glint", bolt: "bullet.01.orange,bullet.02.orange,bullet", hit: "impact" },
  bombThrow: { label: "Ready bomb → throw → contact", cast: "glint", bolt: "throwable.bomb,throwable,boulder", hit: "explosion,impact" },
  spellshape: { label: "Shape next spell at source", cast: "cast_shape,cast_generic", aura: "energy_field,magic_signs" },
  alchemicalShot: { label: "Alchemical load → firearm shot → finish", cast: "liquid,bubble", bolt: "bullet.01.orange,bullet.02.orange,bullet", hit: "impact" },
  strike: { label: "One measured melee blow", hit: "melee_generic.slash,melee_generic.slashing,side_impact,impact", aura: "glint" },
  heavyStrike: { label: "Wind-up → weighty blow", hit: "melee_generic.slashing,melee_generic.slash,impact", aura: "ground_cracks,side_impact,impact" },
  doubleStrike: { label: "Paired attacks → combined finish", cast: "glint", hit: "melee_generic.slash,sword.melee,impact", aura: "glint" },
  multiStrike: { label: "Ordered melee sequence", cast: "glint", hit: "melee_generic.slash,sword.melee,impact", aura: "glint" },
  mixedStrike: {label:"Ordered ranged and melee attacks",cast:"glint",bolt:"bullet.01.orange,bullet.02.orange,arrow.physical",hit:"melee_generic.slash",aura:"glint"},
  restorativeStrike: {label:"Source healing → melee → optional ally restoration",cast:"healing_generic",hit:"melee_generic.slash",aura:"healing_generic.loop"},
  throughShot: {label:"One shot through aligned targets",cast:"glint",bolt:"bullet.01.orange,bullet.02.orange,arrow.physical",hit:"impact",aura:"glint"},
  smite: {label:"One melee blow → damaging channel",cast:"energy_field",hit:"melee_generic.slash",aura:"impact"},
  counteract:{label:"Defensive interference → counteract",cast:"shield,magic_signs",hit:"glint",aura:"magic_signs,shield"},
  feint:{label:"Distracting gesture → target attention",cast:"glint",hit:"dizzy_stars",aura:"dizzy_stars"},
  spellstrike:{label:"Weapon contact → magic discharge",cast:"glint",hit:"melee_generic.slash",aura:"impact"},
  gaze:{label:"Focus gaze → observer impression",cast:"eyes",hit:"eyes",aura:"eyes"},
  phoenix:{label:"Self restoration → outward phoenix fire",cast:"healing_generic.03.burst",aura:"fireball.explosion"},
  maneuverCombo:{label:"Two selected maneuvers → settle",cast:"glint",hit:"glint",aura:"energy_field,glint"},
  fearStrike: { label: "Contact → shattering confidence", hit: "melee_generic.slash,impact", aura: "toll_the_dead,eyes,condition.frightened" },
  medicine: { label: "Careful wound dressing", cast: "glint", hit: "healing_generic.03.burst,healing_generic", aura: "healing_generic.loop" },
  shield: { label: "Shield up → contact", cast: "shield.01.complete,shield", hit: "impact", aura: "shield" },
  waveGuard: { label: "Cascade → water guard → disperse", cast: "water_splash", hit: "water_splash,liquid", aura: "shield,water_splash,bubble" },
  flamePath: { label: "Flame hops through selected route", cast: "flaming_sphere,flames", bolt: "fire_bolt", hit: "impact_themed.fire,fireball.explosion" },
  produce: { label: "Grow produce at recipient", hit: "plant_growth,swirling_leaves", aura: "swirling_leaves,butterflies" },
  sentinel: { label: "Roots → sheltering growth", cast: "plant_growth,entangle", hit: "entangle,plant_growth", aura: "shield,swirling_leaves" },
  waterHeal: { label: "Soothing splash → restoration", hit: "water_splash,healing_generic", aura: "healing_generic.loop,liquid" },
  windMove: { label: "Wind gathers → movement cue", hit: "wind_lines", aura: "wind_lines,swirling_feathers" },
  splinterCone: { label: "Wood fan cue", cast: "swirling_leaves", hit: "plant_growth,impact", aura: "swirling_leaves" },
  boomerang: { label: "Air blade → endpoint whirl", bolt: "gust_of_wind,wind_stream", hit: "wind_lines,whirlwind", aura: "wind_lines" },
  tumbleStrike: { label: "Tumble afterimage → melee contact", hit: "melee_generic.slash,impact", aura: "smoke" },
  feintStrike: { label: "Distract → second slash", hit: "melee_generic.slash,impact", aura: "dizzy_stars" },
  bindStrike: { label: "Melee contact → restraint", hit: "melee_generic.slash,impact", aura: "energy_field,entangle" },
  tripStrike: { label: "Strike → low contact", hit: "melee_generic.slash,impact", aura: "ground_cracks,impact" },
  display: { label: "Threatening flourish → fear", cast: "melee_generic.whirlwind", hit: "toll_the_dead,eyes", aura: "eyes" },
  dread: { label: "Threat → target dread", cast: "eyes,toll_the_dead", hit: "toll_the_dead,condition.frightened", aura: "eyes,toll_the_dead" },
  taunt: { label: "Quip → distraction", cast: "music_notations,bardic_inspiration", hit: "dizzy_stars", aura: "dizzy_stars" },
  drawStrike: { label: "Draw glint → weapon contact", cast: "glint", hit: "melee_generic.slash,impact" },
  whirlwindStrike: { label: "Source whirl → nearby contacts", cast: "melee_generic.whirlwind", hit: "melee_generic.slash,impact" },
  elementCone: { label: "Element gathers → fan accents" }, elementAura: { label: "Elemental source aura" },
  guard: { label: "Protective barrier", cast: "shield,ward", hit: "glint", aura: "shield,ward" },
  targetGuard: { label: "Selected allies protected", hit: "glint", aura: "shield,ward" },
  charge: { label: "Sprint afterimage → melee contact", cast: "wind_lines", hit: "melee_generic.slash,impact", aura: "wind_lines" },
  ranged: { label: "Aim → shot → arrival", cast: "glint", bolt: "arrow.physical,arrow,bolt", hit: "impact" },
  unarmed: { label: "Poised fist → contact", hit: "unarmed_strike.physical,unarmed_strike,impact", aura: "glint" },
  bind: { label: "Hold → restraint pulse", hit: "energy_field,entangle", aura: "energy_field,entangle" },
  shove: { label: "Measured shove → recoil", hit: "impact,side_impact" }, trip: { label: "Low contact → balance cue", hit: "ground_cracks,impact" },
  healing: { label: "Restoration bloom", hit: "healing_generic.03.burst,healing_generic", aura: "healing_generic.loop,cure_wounds" },
  teleport: { label: "Transit afterimage", cast: "misty_step,teleport,portals", hit: "misty_step,teleport", aura: "portals" },
  stealth: { label: "Soft shadow entrance", cast: "smoke,darkness", hit: "shimmer", aura: "smoke" },
  transform: { label: "Form shimmer", cast: "shimmer", hit: "shimmer", aura: "shimmer" },
  flight: { label: "Updraft → settled rise", cast: "swirling_feathers,wind_lines", aura: "swirling_feathers" },
  movement: { label: "Movement afterimage", cast: "wind_lines", aura: "wind_lines" },
  lightningDash: { label: "Body becomes lightning → traversal contacts → reform", cast: "static_electricity", hit: "static_electricity,impact.001.blue", aura: "static_electricity" },
  lavaLeap: { label: "Molten shell → leap → lava contacts → cooled protection", cast: "flames,fire_ring", hit: "fireball.explosion,impact_themed.fire", aura: "stoneskin,shield" },
  trample: { label: "Heavy source trail → one ground contact per selected victim", cast: "wind_lines", hit: "ground_cracks,impact", aura: "smoke,ground_cracks" },
  inspiration: { label: "Rallying performance", cast: "bardic_inspiration,music_notations", hit: "bardic_inspiration", aura: "music_notations" },
  perception: { label: "Focus → sense pulse", cast: "eyes,detect_magic", hit: "detect_magic,eyes", aura: "eyes" },
  stance: { label: "Settle into stance", cast: "impact,wind_lines", aura: "energy_field,impact" },
  elementBolt: { label: "Element launches → target finish" }, elementTarget: { label: "Element manifests at target" },
  utility: { label: "Symbolic activity cue", cast: "glint", hit: "glint", aura: "twinkling_stars" },
  preparation: {label:"Prepare now → later use remains separate",cast:"glint",aura:"glint,energy_field"},
  fortune: {label:"Second-chance cycle",cast:"twinkling_stars",hit:"twinkling_stars",aura:"magic_signs,twinkling_stars"},
  resolve: {label:"Composure → inward resolve",cast:"glint",aura:"energy_field,glint"},
  restoration: {label:"Source recovery → gentle settle",cast:"healing_generic",aura:"healing_generic.loop"},
  targetSupport: {label:"Source support → chosen recipient",cast:"glint",hit:"glint",aura:"shield,energy_field"},
  focus: {label:"Study → focused attention",cast:"detect_magic,eyes",hit:"detect_magic,eyes",aura:"detect_magic,eyes"},
  command: {label:"Call → allied response",cast:"music_notations,bardic_inspiration",hit:"bardic_inspiration,glint",aura:"music_notations,glint"},
  performance: {label:"Performance → observers' impression",cast:"music_notations,bardic_inspiration",hit:"dizzy_stars",aura:"music_notations"},
  form: {label:"Morphing shell → changed silhouette",cast:"shimmer",aura:"shimmer,energy_field"},
  concealment: {label:"Veil → soft echo",cast:"smoke,shimmer",aura:"smoke,shimmer"},
  absorb: {label:"Inward energy → stored power",cast:"energy_strands,energy_field",aura:"energy_field,glint"},
  craft: {label:"Precise preparation at chosen object",cast:"glint",hit:"glint",aura:"glint"},
  rune: {label:"Trace → inscribed focus",cast:"magic_signs,runes",hit:"magic_signs,runes",aura:"magic_signs,runes"},
  groundCreation: {label:"Foundation → finite manifestation"},
  time: {label:"Temporal focus → converging echoes",cast:"magic_signs,energy_field",aura:"magic_signs"},
  clearWay: {label:"Up to five Shoves → half-Speed Stride",cast:"melee_generic.whirlwind",hit:"side_impact,impact",aura:"wind_lines"},
};

const nativePhysicalFilm = key => /^jb2a\.(?:melee_generic\.|unarmed_strike\.|(?:greatsword|sword|shortsword|lasersword)\.melee\.)/.test(key);

export function featRecipe(feat, options = {}) {
  feat=reviewedFeatActivation(feat);
  if (!feat?.id || !FEAT_MOTIFS[feat.motif]) throw Error("Choose an active feat from the catalog.");
  const art = FEAT_THEMES[feat.theme] ?? FEAT_THEMES.arcane, media = feat.assets ?? feat.design?.assets;
  if (!media) throw Error("Feat has no audited animation media.");
  let n = 0;
  const effect = (kind, slot, label, delay, duration, extra = {}) => {
    const oneShot = media[slot]?.some(key=>nativePhysicalFilm(key)||/^jb2a\.lava_spout\..*\.complete\./.test(key)) ?? false;
    return { kind, stageId: `feat-${feat.id}-${++n}`, label, assets: media[slot], delay, duration,
      scale: 1, opacity: 1, fadeIn: oneShot ? 0 : 120, fadeOut: 220, below: false,
      oneShot, scaleIn: .35, scaleInDuration: oneShot ? 0 : 300, tint: art.color, ...extra };
  };
  const cast = (label = "Gather", delay = 0, duration = 1000, extra = {}) => effect("cast", "cast", label, delay, duration, extra);
  const impact = (label = "Contact", delay = 600, duration = 1300, extra = {}) => effect("impact", "hit", label, delay, duration, extra);
  const aura = (subject = feat.subject ?? "source", label = "Resolve", delay = 700, duration = 1800, extra = {}) => effect("aura", "aura", label, delay, duration, { subject, attach: true, scale: 1.2, ...extra });
  const motion = (name, subject, label, delay, duration = 1000, extra = {}) => ({ kind: "motion", stageId: `feat-${feat.id}-${++n}`, label, assets: [], motion: name, subject, delay, duration,
    intensity: name === "lunge" ? .6 : name === "recoil" ? .5 : .3,
    distance: name === "lunge" ? .2 : name === "recoil" ? .15 : .12, ease: "easeInOutQuad", ...extra });
  const copy = (label, delay = 0, extra = {}) => ({ kind: "sprite", stageId: `feat-${feat.id}-${++n}`, label, assets: [], subject: "source", delay, duration: 1300,
    copies: 2, copySpread: 0.16, shadow: true, opacity: 0.25, fadeIn: 200, fadeOut: 700, ...extra });
  const travel = (label = "Launch", delay = 500, extra = {}) => effect("travel", "bolt", label, delay, 1800, { fadeIn: 0, scaleInDuration: 0, fadeOut: 150, oneShot: true, ...extra });
  const direction=feat.direction??{}, recipient=feat.subject??"source";
  const attackCount=fallback=>Number.isFinite(Number(direction.contacts?.count))?Math.max(1,Math.min(6,Number(direction.contacts.count))):fallback;
  const selected=(slot,label,delay,duration,extra={})=>effect(recipient==="source"?"cast":"impact",slot,label,delay,duration,extra);
  const toss = tossFeatRecipe(feat, { effect, cast, impact, aura, motion, copy, travel });
  const directed = !toss && directedFeatMotion({ ...feat, assets: media }, { motion, copy, impact, cast, aura });
  let stages = toss?.stages ?? directed?.stages;
  if (!toss && !directed) switch (feat.motif) {
    case "strike": case "unarmed": case "drawStrike":
      stages = [...(feat.motif === "drawStrike" ? [cast("Draw", 0, 650, { scale: 0.8 })] : []), motion("lunge", "source", "Measured attack", 100),
        impact("Melee contact", 400), aura("targets", "Contact spark", 1100, 650, { scale: 0.65, opacity: 0.55 })]; break;
    case "phoenix":
      stages=[cast("Self restoration",0,1800,{scale:.85}),aura("source","Outward phoenix fireball",800,2400,{scale:1.6,below:true}),motion("pulse","source","Rise from ashes",300,1600,{intensity:.15})];break;
    case "maneuverCombo":
      stages=[cast("Prepare flowing combination",0,1200,{scale:.55}),impact("Two chosen maneuver cues",500,1300,{repeats:2,repeatScope:"total",repeatInterval:700,scale:.65}),aura("targets","Grip and balance settle",1400,1700,{scale:.8,opacity:.5})];break;
    case "heavyStrike":
      stages = [motion("pulse", "source", "Wind up", 0, 900, { intensity: 0.18 }), motion("lunge", "source", "Commit to swing", 550, 1100, { distance: 0.2 }),
        impact("One heavy blow", 800, 1700, { scale: 1.25 }), aura("targets", "Weighted contact", 1500, 1200, { scale: 1.35, below: true }), motion("shake", "targets", "Impact feedback", 1250, 850, { intensity: 0.15 })]; break;
    case "doubleStrike": case "feintStrike":
      if(feat.slug==="double-slice") {
        stages=[motion("pulse","source","Plant for paired cuts",0,1200,{intensity:.16}),impact("Leading diagonal cut",450,1200,{rotation:-45,offsetY:-.15}),
          motion("pulse","source","Counterbalance second weapon",650,1000,{intensity:.12}),impact("Overlapping opposing cut",1000,1200,{rotation:45,mirrorX:true,offsetY:.15}),aura("targets","Combined same-foe finish",1750,1200,{scale:.85})];
      } else if(feat.slug==="twin-takedown") {
        stages=[cast("Focus on hunted prey",0,900,{scale:.6}),copy("Short pursuit echo",100,{copies:1,copySpread:.1,opacity:.18}),motion("lunge","source","Commit to prey",200,1200,{distance:.14}),
          impact("First quick diagonal",750,1200,{rotation:-15,scale:.85,offsetX:-.15}),impact("Alternating second cut",1050,1200,{rotation:75,mirrorX:true,scale:.85,offsetX:.15}),aura("targets","Paired prey contact settles",1800,1300,{scale:.7})];
      } else {
        stages = [motion("lunge", "source", "First attack", 100, 1000), impact("First slash", 400, 1200, { rotation: -35, opacity: feat.motif === "feintStrike" ? 0.5 : 0.9 }),
          motion("pulse", "source", "Second attack", 850, 1000, { intensity: 0.2 }), impact("Opposing second slash", 1100, 1200, { rotation: 35, mirrorX: true }),
          aura("targets", feat.motif === "feintStrike" ? "Distraction" : "Combined finish", 1850, 1300, { scale: 0.9 })];
      }
      break;
    case "multiStrike":
      stages=[copy("Distinct source facets",0,{copies:Math.min(4,attackCount(3))}),motion("lunge","source","Ordered attacks",250,1300),
        impact("Ordered melee contacts",700,1300,{repeats:attackCount(3),repeatScope:"total",repeatInterval:650,targetSelection:/same|single|one target/.test(direction.contacts?.distribution??"")?"first":"all"}),aura("targets","Sequence settles",2100,1400,{targetSelection:/same|single|one target/.test(direction.contacts?.distribution??"")?"first":"all"})];
      if(/up to .*different targets/.test(direction.contacts?.distribution??"")){
        Object.assign(stages[2],{repeats:1,repeatScope:"perTarget",targetLimit:attackCount(3),targetStagger:650});
        stages.at(-1).targetLimit=attackCount(3);stages.at(-1).targetStagger=0;
      }
      stages.at(-1).afterStage=stages[2].stageId;stages.at(-1).timingAnchor="end";stages.at(-1).delay=0;break;
    case "clearWay": {
      const shoves=impact("One Shove attempt per selected adjacent foe",550,1300,{repeats:1,repeatScope:"perTarget",targetLimit:5,targetStagger:220,scale:.7});
      stages=[cast("Massive weapon clears a path",0,1700,{scale:1.1}),shoves,
        motion("rush","source","Half-Speed Stride after Shoves",0,2800,{afterStage:shoves.stageId,timingAnchor:"end",startOffset:200,motionRange:"distance",distance:1.2,motionArrival:45,motionHold:10,intensity:.5}),
        aura("source","Clear path settles",0,1500,{afterStage:shoves.stageId,timingAnchor:"end",scale:.8})];break;
    }
    case "mixedStrike": {
      if(feat.slug==="rebounding-assault"){
        const thrown=effect("travel","thrown","Thrown melee weapon",500,1800,{oneShot:true,targetSelection:"first",fadeIn:0,scaleInDuration:0});
        const bullet=travel("Bullet follows thrown weapon",950,{targetSelection:"first"});
        const returning=effect("travel","thrown","Conditional weapon rebound",0,1800,{afterStage:bullet.stageId,timingAnchor:"end",startOffset:150,travelOrigin:"target",targetSelection:"first",oneShot:true,fadeIn:0,scaleInDuration:0});
        stages=[cast("Prepare throw and shot",0,1100,{scale:.55}),thrown,bullet,returning,aura("source","Weapon returns to hand",0,1400,{afterStage:returning.stageId,timingAnchor:"end",scale:.65})];break;
      }
      const shotFirst=["drifters-juke","throw-and-catch"].includes(feat.slug);
      const shot=travel("Ranged portion of combination",shotFirst?650:1400,{targetSelection:"first"});
      const cut=impact("Melee portion of combination",shotFirst?1650:650,1500,{targetSelection:"first"});
      if(shotFirst)cut.afterStage=shot.stageId,cut.timingAnchor="end",cut.startOffset=250;
      stages=[copy("Combination approach",0,{copies:1}),motion("lunge","source","Measured combination",150,1400),...(shotFirst?[shot,cut]:[cut,shot]),aura("targets","Combination settles",2200,1500)];break;
    }
    case "restorativeStrike":
      stages=[cast("Self restoration first",0,1500,{scale:.8}),motion("lunge","source","Commit after restoration",500,1200),impact("One melee Strike",1050,1500),aura("source","Optional ally restoration held at source",1600,1900,{scale:.8,opacity:.55})];break;
    case "smite":
      stages=[cast("Channel damaging energy",0,1400,{scale:.65}),motion("lunge","source","Committed melee",250,1200),impact("Single empowered Strike",750,1600),aura("targets","Damage channel settles",1400,1500,{scale:.85})];break;
    case "spellstrike":
      stages=[cast("Magic gathered into weapon",0,1400,{scale:.6}),motion("lunge","source","Measured weapon approach",200,1200),impact("Weapon contact",700,1500),aura("targets","Chosen spell discharge cue",1350,1700,{scale:.9})];break;
    case "counteract":
      stages=[cast("Defensive interference",0,1500,{scale:.85}),aura(recipient,"Counteract focus settles",700,1800,{scale:.9,opacity:.6})];break;
    case "feint": case "gaze":
      stages=[cast(feat.motif==="gaze"?"Focused gaze":"Distracting gesture",0,1300,{scale:.6}),impact("Chosen observer impression",650,1500,{scale:.65}),aura("targets","Attention settles",1150,1700,{scale:.85,opacity:.6})];break;
    case "throughShot": {
      const shot=travel("Single shot through aligned targets",600,{targetSelection:"last"});
      stages=[cast("Align one shot",0,1200,{scale:.6}),shot,impact("Aligned contacts, one projectile",0,1500,{afterStage:shot.stageId,timingAnchor:"end",startOffset:-200,targetStagger:250}),aura("targets","Line contacts settle",1800,1400,{scale:.65})];break;
    }
    case "fearStrike": case "bindStrike": case "tripStrike":
      stages = [motion("lunge", "source", "Melee approach", 0, 1000), impact("Strike first", 400), aura("targets", feat.motif === "fearStrike" ? "Confidence breaks" : feat.motif === "tripStrike" ? "Low contact" : "Restrict escape", 1200, 1900, { below: feat.motif === "tripStrike" }),
        ...(feat.motif === "tripStrike" ? [motion("recoil", "targets", "Balance feedback", 1300, 1000, { distance: 0.07 })] : [])]; break;
    case "charge": case "tumbleStrike":
      { const approach=motion(/leap|jump|descending|airborne/.test(direction.shape??"")?"leap":feat.motif==="tumbleStrike"?"roll":"rush","source","Sampled movement approach",150,attackCount(1)>1?4800:3000,{motionRange:"target",distance:6,perSquare:180,motionArrival:30,motionHold:40,intensity:.5,jumpHeight:.65,targetSelection:"first"});
        stages=[copy(feat.motif==="charge"?"Sprint afterimage":"Tumbling afterimage",0),approach,
          impact("Strike at arrival",0,1500,{afterStage:approach.stageId,timingAnchor:"arrival",targetSelection:"first"})];break; }
    case "medicine": case "healing": case "waterHeal":
      stages = [selected("hit",feat.motif === "medicine" ? "Dress wounds" : feat.motif === "waterHeal" ? "Soothing water" : "Healing bloom", 100, 1800, { scale: 0.9 }), aura(recipient, "Gentle restoration", 700, 2200, { scale: 1.05, opacity: 0.7 })]; break;
    case "shield": case "guard": case "waveGuard":
      stages = [selected("cast",feat.motif === "waveGuard" ? "Cascade" : "Defend", 0, 1300, { scale: 1.1 }), aura(recipient, feat.motif === "waveGuard" ? "Water guard" : "Barrier", 200, 1800), selected("hit", "Disperse contact", 1000, 1100, { scale: 0.8 }), motion("pulse", recipient, "Brace", 100, 1100, { intensity: 0.15 })]; break;
    case "produce":
      stages = [impact("Growth at recipient", 0, 1600, { below: true, scale: 0.85 }), aura("targets", "Produce appears", 500, 1600, { scale: 0.7 })]; break;
    case "targetGuard":
      stages = [impact("Protect chosen allies", 0, 1100, { scale: 0.7, opacity: 0.55 }), aura("targets", "Ally protection", 250, 1800, { scale: 1.05 })]; break;
    case "sentinel":
      stages = [cast("Ground roots", 0, 1800, { below: true, scale: 1.35 }), effect("cast", "hit", "Sheltering growth", 450, 2300, { below: true, scale: 1.5 }), aura("source", "Tree guard cue", 1100, 1800)]; break;
    case "flamePath": {
      const launch = travel("Flame hops", 450, { travelOrigin: "previousTarget", targetStagger: 550, scale: 0.8 });
      const land = impact("Flame passes through", 0, 1200, { afterStage: launch.stageId, timingAnchor: "end", startOffset: -180, scale: 0.9 });
      stages = [cast("Tiny flame takes shape", 0, 950, { scale: 0.7 }), launch, land]; break;
    }
    case "ranged": case "elementBolt": case "boomerang": case "ray": case "lineCue": case "firearm": case "alchemicalShot": case "bombThrow": {
      const beam=["ray","lineCue"].includes(feat.motif);
      const launch = travel(feat.motif === "boomerang" ? "Air blade out" : beam ? "Directed beam" : feat.motif === "bombThrow" ? "Bomb leaves source" : "Shot leaves source"), land = impact(beam ? "Beam contact" : "Arrival", 0, 1300, { afterStage: launch.stageId, timingAnchor: "end", startOffset: -180, scale: 1.05 });
      stages = [cast(feat.motif === "alchemicalShot" ? "Load alchemical contents" : feat.motif === "ray" ? "Gather beam" : "Aim", 0, 1000, { scale: 0.8 }), launch, land];
      if(feat.motif==="boomerang")stages.push(aura("targets","Wind spins at endpoint",1600,2000,{scale:.8}));
      break;
    }
    case "dread": case "taunt": case "bind":
      stages = [cast(feat.motif === "taunt" ? "Speak" : "Focus intent", 0, 1100, { scale: 0.8 }), impact("Affected creature", 550, 1500, { scale: 1 }), aura("targets", "Lingering impression", 1100, 2000, { opacity: 0.65 })]; break;
    case "shove": case "trip":
      stages = [motion("lunge", "source", "Maneuver", 0, 1050, { distance: 0.13 }), impact("Contact", 400, 1400, { below: feat.motif === "trip", scale: 0.9 }), motion("recoil", "targets", "Balance feedback", 500, 1100, { distance: 0.08 })]; break;
    case "teleport": case "stealth": case "transform":
      stages = [cast("Departure / change cue", 0, 1600), copy("Cosmetic afterimage", 300, { copies: 2, copySpread: 0.12 }), aura("source", "Settle", 850, 2100, { opacity: 0.65 })]; break;
    case "windMove":
      stages = [impact("Wind reaches chosen allies", 0, 1500, { below: true }), aura("targets", "Allied wind halos", 250, 1900, { opacity: 0.65 }), motion("levitate", "targets", "Cosmetic wind lift", 350, 1600, { distance: 0.12, intensity: 0.2 })]; break;
    case "movement": case "flight":
      stages = [selected("cast", "Movement gathers", 0, 1500, { below: true }), copy("Movement afterimage", 200, { subject: recipient }), motion(feat.motif === "movement" ? "pulse" : "levitate", recipient, "Cosmetic movement cue", 350, 1600, { distance: 0.12, intensity: 0.2 })]; break;
    case "lightningDash": {
      const dash=motion("rush","source","Body lightning transit",300,2800,{motionRange:"target",targetSelection:"last",motionEndpoint:"past",distance:7,perSquare:240,motionArrival:50,motionHold:15,intensity:.65});
      stages=[cast("Body gathers electrical charge",0,1500,{scale:.85}),copy("Electrical departure echoes",150,{copies:3,opacity:.2}),dash,
        impact("Traversal shocks at selected victims",0,1500,{afterStage:dash.stageId,timingAnchor:"start",startOffset:650,targetStagger:300,scale:.7}),
        aura("source","Normal form settles after cosmetic return",0,1400,{afterStage:dash.stageId,timingAnchor:"end",scale:.75,opacity:.55})];
      break;
    }
    case "lavaLeap": {
      const jump=motion("leap","source","Molten-stone leap",250,2800,{motionRange:"target",targetSelection:"first",distance:8,perSquare:220,jumpHeight:.95,motionArrival:45,motionHold:25,intensity:.65});
      stages=[cast("Molten shell surrounds source",0,1600,{scale:1.1}),copy("Molten takeoff silhouette",100,{copies:1,opacity:.18}),jump,
        impact("Lava-wave contacts at selected victims",0,2000,{afterStage:jump.stageId,timingAnchor:"arrival",startOffset:100,targetStagger:0,scale:1.1,below:true}),
        aura("source","Cooling protective shell",0,2300,{afterStage:jump.stageId,timingAnchor:"end",startOffset:100,scale:1.05,opacity:.65})];
      break;
    }
    case "trample": {
      const run=motion("rush","source","Heavy trampling trail",200,3200,{motionRange:"distance",distance:2.2,motionArrival:45,motionHold:15,intensity:.65});
      stages=[cast("Heavy departure wake",0,1500,{scale:.9,below:true}),copy("Trampling body trail",100,{copies:3,copySpread:.18,opacity:.2}),run,
        impact("One trampling contact per selected victim",0,1600,{afterStage:run.stageId,timingAnchor:"start",startOffset:550,targetStagger:300,scale:1.05,below:true})];
      break;
    }
    case "display": case "whirlwindStrike":
      stages = [cast("Source flourish", 0, 1900, { scale: 1.2 }), impact(feat.motif === "display" ? "Observers shaken" : "Nearby melee contacts", 450, 1400, { targetStagger: 220 }), motion("spin", "source", "Restrained flourish", 150, 1400, { intensity: 0.2 })]; break;
    case "elementAura": case "stance":
      stages = [selected("cast","Set stance / element", 0, 1200, { below: true }), aura(recipient, "Surrounding field", 300, 2600, { below: true, scale: feat.motif === "elementAura" ? 1.7 : 1.05 }), motion("pulse", recipient, "Settle", 250, 1400, { intensity: 0.12 })]; break;
    case "elementCone": case "splinterCone":
      stages = [cast("Gather directional element", 0, 1500), impact("Selected-target fan accents", 600, 1800, { targetStagger: 130, scale: 1.05 })]; break;
    case "elementTarget":
      stages = [cast("Element gathers", 0, 1200), selected("hit","Element manifests", 550, 1900), aura(recipient, "Element settles", 1100, 1800, { opacity: 0.55 })]; break;
    case "inspiration":
      stages = [cast("Rally / perform", 0, 1800), aura("source", "Performance surrounds", 400, 2200, { opacity: 0.65 })]; break;
    case "perception":
      stages = [cast("Sharpen focus", 0, 1200, { scale: 0.85 }), aura("source", "Sense pulse", 300, 1800, { opacity: 0.55 })]; break;
    case "spellshape":
      stages = [cast("Shape upcoming magic", 0, 1600, { scale: 0.9 }), aura("source", "Power held for next use", 500, 2200, { scale: 1.1, opacity: 0.65 })]; break;
    case "preparation":
      stages=[selected("cast","Prepare focus",0,1300,{scale:.65}),aura(recipient,"Enhancement held for later use",600,1800,{scale:.85,opacity:.6})];break;
    case "fortune":
      stages=[selected("cast","Second chance opens",0,1300,{scale:.7}),aura(recipient,"Fortune cycle reforms",650,1800,{scale:1,opacity:.7})];break;
    case "resolve": case "absorb":
      if(feat.motif==="absorb"&&/target|thrall|creature|cone|emanation/.test(direction.origin??"")){
        const intake=effect("projectile","transfer","Energy transfers from victim to source",550,1600,{travelOrigin:"target",speed:220,scale:.4,fadeIn:0,scaleInDuration:0,fadeOut:120});
        stages=[effect("aura","cast","Energy releases from selected creature",0,1500,{subject:"targets",attach:true,scale:.65,opacity:.6}),intake,
          aura("source","Borrowed energy settles inward",0,1900,{afterStage:intake.stageId,timingAnchor:"end",scale:.9,opacity:.65}),motion("pulse","source","Inward settling",800,1500,{intensity:.12})];
      }else stages=[cast(feat.motif==="absorb"?"Energy draws inward":"Gather composure",0,1600,{scale:.85}),aura("source",feat.motif==="absorb"?"Stored energy settles":"Resolve settles",800,1800,{scale:.8,opacity:.65}),motion("pulse","source","Inward settling",300,1400,{intensity:.12})];break;
    case "restoration":
      stages=[selected("cast","Affected creature recovers",0,1800,{scale:.85}),aura(recipient,"Recovery settles",700,2100,{scale:1,opacity:.65})];break;
    case "targetSupport": case "command": case "performance":
      stages=[cast(feat.motif==="command"?"Call encouragement":feat.motif==="performance"?"Perform":"Offer support",0,1400,{scale:.75}),
        selected("hit","Selected recipient cue",650,1500,{scale:.85,targetStagger:250}),aura(recipient,"Impression settles",1200,1900,{scale:.9,opacity:.6})];break;
    case "focus":
      stages=[cast("Gather attention",0,1200,{scale:.55}),selected("hit","Study chosen focus",600,1600,{scale:.7,targetStagger:350}),aura(recipient,"Knowledge focus settles",1200,1600,{scale:.85,opacity:.5})];break;
    case "form": case "concealment":
      stages=[selected("cast",feat.motif==="form"?"Form shell changes":"Veil spreads",0,1700),copy("Finite silhouette echo",400,{subject:recipient,copies:2,copySpread:.12,opacity:.2}),aura(recipient,"New silhouette settles",1000,2200,{scale:1,opacity:.65})];break;
    case "craft": case "rune":
      stages=[selected("cast",feat.motif==="rune"?"Trace inscription":"Prepare object",0,1400,{scale:.65}),aura(recipient,feat.motif==="rune"?"Inscribed focus settles":"Preparation settles",650,1900,{scale:.8,opacity:.65})];break;
    case "groundCreation":
      stages=[selected("hit","Foundation appears",0,1800,{below:true,scale:.85}),aura(recipient,"Finite manifestation rises",650,2200,{below:true,scale:1,opacity:.65})];break;
    case "time":
      stages=[cast("Temporal focus opens",0,1700,{scale:.9}),copy("Converging temporal echoes",300,{copies:3,copySpread:.2,opacity:.2}),aura("source","Present moment settles",1200,2200,{scale:1,opacity:.65})];break;
    default:
      stages = [cast("Activity starts", 0, 1100, { scale: 0.7, opacity: 0.7 }), aura("source", "Symbolic activity cue", 450, 1500, { scale: 0.85, opacity: 0.45 })];
  }
  if(feat.slug==="throw-and-catch"){
    const shot=stages.find(s=>s.kind==="travel"),cut=stages.find(s=>s.kind==="impact");shot.assets=media.thrown;
    const returning=effect("travel","thrown","Weapon returns before melee",0,1800,{afterStage:shot.stageId,timingAnchor:"end",startOffset:100,travelOrigin:"target",targetSelection:"first",oneShot:true,fadeIn:0,scaleInDuration:0});
    stages.splice(stages.indexOf(cut),0,returning);cut.afterStage=returning.stageId;cut.timingAnchor="end";cut.startOffset=250;
  }
  if(feat.slug==="triggerbrand-blitz"){
    const cut=stages.find(s=>s.kind==="impact"),shot=stages.find(s=>s.kind==="travel");
    cut.targetSelection="first";shot.targetSelection="second";
    stages.splice(stages.indexOf(shot)+1,0,impact("Third combination melee contact",0,1500,{afterStage:shot.stageId,timingAnchor:"end",startOffset:250,targetSelection:"third"}));
  }
  if(["everstand-strike","clans-edge"].includes(feat.slug)){
    stages=stages.filter(s=>!(s.kind==="aura"&&s.subject==="targets"));
    const last=stages.findLast(s=>s.kind==="impact");
    stages.push(effect("aura","guard",feat.slug==="clans-edge"?"Source Parry after both dagger Strikes":"Conditional source Raise a Shield",0,1900,{subject:"source",attach:true,afterStage:last.stageId,timingAnchor:"end",scale:1,opacity:.6}));
  }
  if(feat.slug==="spinning-stand"||feat.slug==="hindquarter-kick")stages.unshift(motion("spin","source","Rotating talon stance",0,1700,{intensity:.35}));
  if(feat.slug==="split-spellstrike"||feat.slug==="devastating-manifestation"){
    if(feat.slug==="devastating-manifestation")stages.unshift(effect("cast","manifestation","Soulforged armament manifests",0,1400,{scale:1.15}));
    const contacts=stages.filter(s=>s.kind==="impact");
    for(const [i,contact] of contacts.entries()){
      contact.targetSelection=i?"second":"first";
      stages.push(effect("impact",feat.slug==="split-spellstrike"?"magicFinish":"spiritFinish",feat.slug==="split-spellstrike"?"Chosen spell discharges at weapon contact":"Soulforged spirit contact",0,1600,{afterStage:contact.stageId,timingAnchor:"start",startOffset:220,targetSelection:contact.targetSelection,scale:.8}));
    }
  }
  if(feat.slug==="anatomical-quartering"){
    const contact=stages.find(s=>s.kind==="impact");
    stages.push(effect("impact","spiritFinish","Final different-foe Strike becomes spirit",0,1500,{afterStage:contact.stageId,timingAnchor:"start",startOffset:220,targetSelection:"last",targetLimit:4,scale:.8}));
  }
  if(feat.slug==="godbreaker"){
    const rise=motion("rush","source","Successful-branch grappling ascent",180,5400,{motionRange:"distance",motionHeading:"up",distance:1.5,motionArrival:25,motionHold:50,intensity:.5});
    const foe={...rise,stageId:`feat-${feat.id}-${++n}`,label:"Grabbed foe rises with source",subject:"targets",targetSelection:"first"};
    const blows=impact("Three successful upward unarmed Strikes",0,1500,{afterStage:rise.stageId,timingAnchor:"arrival",repeats:3,repeatScope:"total",repeatInterval:900,targetSelection:"first",offsetY:-1.5});
    stages=[copy("Grappling takeoff echo",0,{copies:1}),rise,foe,blows,
      effect("impact","landing","Final successful-branch ground slam",0,2000,{afterStage:rise.stageId,timingAnchor:"end",targetSelection:"first",scale:1.4,below:true,oneShot:true,fadeIn:0,scaleInDuration:0})];
  }
  // 2026-10-07 audit: melee in a line is one blade contact per enemy, not a ray.
  if(feat.slug==="snakebirds-shadow"){
    const cuts=impact("One blade Strike per enemy in the line",450,1300,{repeats:1,repeatScope:"perTarget",targetSelection:"all",targetStagger:280,scale:.9});
    stages=[cast("Water shadows surge from the blade",0,1000,{scale:.7}),motion("lunge","source","Darting line of cuts",150,1100,{distance:.18}),cuts,
      aura("targets","Water-shadow wake",0,1400,{afterStage:cuts.stageId,timingAnchor:"start",startOffset:300,targetSelection:"all",targetStagger:280,scale:.7,opacity:.6})];
  }
  if(feat.slug==="belly-flop")stages.push(motion("shake","targets","Crushing armored weight",900,900,{intensity:.25}));
  if(feat.slug==="walk-the-plank")stages.push(motion("rush","targets","Successful Demoralize forces a Stride",1500,2800,{motionRange:"distance",distance:1.5,motionHeading:"away",motionArrival:40,motionHold:20,intensity:.35,targetSelection:"first"}));
  if(feat.slug==="smoke-curtain")stages.push(aura("source","Black-powder smoke cloud fills the emanation",350,2600,{scale:2.4,opacity:.75,below:false}));
  if(feat.slug==="celestial-cacophony")stages.push(aura("targets","Sonic crackle of the fireworks",900,1500,{scale:.8,opacity:.75,targetStagger:130}));
  if(feat.slug==="ride-the-tsunami")for(const stage of stages.filter(s=>s.kind==="impact"))stage.scale=2.2;
  // Size-changing forms read their new size; a tiny rat and a Large giant differ.
  if(["form","transform"].includes(feat.motif)){
    const shape=`${feat.name} ${direction.shape??""}`,size=/\b(?:giant|giants|towering|huge|gargantuan|enlarge|swell|swells|grow|grows|oni)\b/i.test(shape)?1.45:/\b(?:shrink|shrinks|tiny|rat|mouse|small)\b/i.test(shape)?.65:1;
    if(size!==1)for(const stage of stages.filter(s=>["cast","impact","aura","sprite"].includes(s.kind)))stage.scale=(stage.scale??1)*size;
  }
  if(["strike","unarmed","heavyStrike","doubleStrike","feintStrike","drawStrike","fearStrike","bindStrike","tripStrike","charge","tumbleStrike","smite","mixedStrike","restorativeStrike"].includes(feat.motif)){
    const split=/different|split|distinct targets|multiple foes/.test(direction.contacts?.distribution??"");let contactIndex=0;
    for(const stage of stages.filter(s=>s.kind==="impact"||s.kind==="aura"&&s.subject==="targets"))stage.targetSelection??=split&&stage.kind==="impact"&&contactIndex++>0?"second":"first";
  }
  if(!directed&&["charge","tumbleStrike"].includes(feat.motif)&&attackCount(1)>1){
    const contact=stages.find(s=>s.kind==="impact"),split=/different|separate|distinct/.test(direction.contacts?.distribution??"");
    Object.assign(contact,split?{repeats:1,repeatScope:"perTarget",targetLimit:attackCount(1),targetStagger:650,targetSelection:"all"}:{repeats:attackCount(1),repeatScope:"total",repeatInterval:650,targetSelection:/same|single|one target/.test(direction.contacts?.distribution??"")?"first":"all"});
  }
  if(!toss&&!stages.some(s=>s.kind==="aura"||s.kind==="cast"&&!s.oneShot))stages.push(aura("source","Activity accent settles",950,1600,{scale:.75,opacity:.55}));
  // Attack counts and ordered routing come from reviewed current activation,
  // never from incidental text or future granted Strikes.
  if(!toss&&["ranged","firearm","ray","elementBolt"].includes(feat.motif)){
    const launch=stages.find(s=>s.kind==="travel"),contact=stages.find(s=>s.afterStage===launch?.stageId);
    const count=attackCount(1);
    if(launch){launch.repeats=count;launch.repeatInterval=600;launch.repeatScope="total";
      if(/single|one foe|same|hunted prey/.test(direction.contacts?.distribution??""))launch.targetSelection="first";
      if(/chain|previous|previously struck/.test([direction.origin,direction.approach,direction.shape].join(" ").toLowerCase())){launch.travelOrigin="previousTarget";launch.targetStagger=600;launch.repeats=1;launch.repeatScope="perTarget";launch.targetSelection="all";}
      if(contact){contact.repeats=count;contact.repeatInterval=600;contact.repeatScope=launch.repeatScope;contact.targetSelection=launch.targetSelection??"all";}
      if(contact&&launch.travelOrigin==="previousTarget")contact.repeats=1,contact.targetStagger=0;
      if(/up to .*targets/.test(direction.contacts?.distribution??"")&&count>1){
        launch.repeats=1;launch.repeatScope="perTarget";launch.targetSelection="all";launch.targetLimit=count;
        if(contact)contact.repeats=1,contact.repeatScope="perTarget",contact.targetSelection="all",contact.targetLimit=count;
      }
      if(count>1&&count<=3&&/simultaneous|triangle/.test([direction.tempo,direction.shape,direction.approach].join(" ").toLowerCase())){
        const different=/different|separate|distinct/.test(direction.contacts?.distribution??"");
        if(different){
          Object.assign(launch,{repeats:1,repeatScope:"perTarget",targetSelection:"all",targetLimit:count,targetStagger:0});
          if(contact)Object.assign(contact,{repeats:1,repeatScope:"perTarget",targetSelection:"all",targetLimit:count,targetStagger:0,label:"Separate simultaneous arrivals"});
        }else{
        launch.repeats=1;launch.offsetY=-.2;
        if(contact)contact.repeats=1,contact.label="Combined simultaneous arrival";
        const i=stages.indexOf(launch);
        stages.splice(i+1,0,...Array.from({length:count-1},(_,j)=>({...launch,stageId:`feat-${feat.id}-${++n}`,label:`Parallel shot ${j+2}`,offsetY:count===2?.2:j*.2})));
        }
      }
    }
  }
  if(["cascading-ray","killshots-report"].includes(feat.slug)){
    const ray=stages.find(s=>s.kind==="travel"),land=stages.find(s=>s.kind==="impact");
    Object.assign(ray,{travelOrigin:"firstTarget",targetSelection:"second",repeats:1,repeatScope:"perTarget",targetStagger:0,label:"Previously struck creature emits secondary ray"});
    Object.assign(land,{targetSelection:"second",repeats:1,repeatScope:"perTarget",targetStagger:0});
    stages=[ray,land];
  }
  if(feat.slug==="chain-reaction"){
    const shot=stages.find(s=>s.kind==="travel"),contact=stages.find(s=>s.kind==="impact");
    Object.assign(shot,{travelOrigin:"source",targetSelection:"first",repeats:1,repeatScope:"total",targetStagger:0,label:"One shot begins the improbable chain"});
    Object.assign(contact,{repeats:1,repeatScope:"perTarget",targetSelection:"all",targetStagger:650,label:"One consequence per selected new victim"});
  }
  if(["bullet-dancer-reload","cauterize"].includes(feat.slug)){
    const shot=stages.find(s=>s.kind==="travel");
    stages.push(effect("aura","cast",feat.slug==="cauterize"?"Heated barrel assists the source's bleeding wound":"Source reload glint after the shot",0,1500,{subject:"source",attach:true,afterStage:shot.stageId,timingAnchor:"end",startOffset:200,scale:.55,opacity:.65}));
  }
  if(feat.slug==="chain-of-words"){
    const line=stages.find(s=>s.kind==="travel");
    line.targetSelection="first";line.label="Line connects the two chosen rune endpoints";stages=[line];
  }
  const traversal = !toss && !directed && applyReviewedTraversal(stages, feat, { motion, copy, impact, cast });
  if(feat.slug==="liberating-dive"){
    stages=stages.filter(s=>!(s.kind==="impact"||s.kind==="aura"&&s.subject==="targets"));
    const flight=stages.find(s=>s.kind==="motion"&&s.motionRange);
    stages.push(impact("Optional metal-wing Blast at first selected foe",0,1500,{afterStage:flight.stageId,timingAnchor:"arrival",targetSelection:"first",oneShot:true,fadeIn:0,scaleInDuration:0}),
      effect("aura","rescue","Second selected ally receives an Escape opportunity",0,1600,{subject:"targets",attach:true,afterStage:flight.stageId,timingAnchor:"arrival",targetSelection:"second",scale:.8,opacity:.6}));
  }
  if (!toss) {
    applyFeatDirection(stages,feat);
    stages = applyCatalogMotion(feat, stages, FEAT_ACTION_MOTION_REVIEWS[feat.slug]);
    stages = addPhysicalFeatGesture(feat, stages);
    stages = reviewFeatMotion(feat, stages, motion);
  }
  if (options.motion === false) {
    const sample = timedStages({ stages });
    const removed = new Set(stages.filter(s => s.kind === "motion").map(s => s.stageId));
    stages = stages.filter(s => s.kind !== "motion").map(s => removed.has(s.afterStage)
      ? { ...s, delay: sample.find(p => p.stageId === s.stageId).delay, afterStage: "" } : s);
  }
  // Baked flights and weapon contacts retain complete clips. Loop ambience has
  // finite authored envelopes and never persists after the cue.
  for (const stage of stages) {
    const timings = stage.assets?.map(key => feat.mediaTiming?.[key]).filter(Boolean) ?? [];
    if ((stage.oneShot || stage.kind === "travel" || timings.some(t => t.baked || t.melee)) && timings.length) {
      stage.oneShot = true; stage.duration = Math.max(stage.duration, ...timings.map(t => t.duration));
      stage.fadeIn = 0; stage.fadeOut = Math.min(180, stage.duration / 8); stage.scaleInDuration = 0;
    }
  }
  for (const stage of stages.filter(s => s.afterStage && s.kind === "impact")) {
    const parent = stages.find(s => s.stageId === stage.afterStage);
    const contacts = parent?.assets?.map(key => feat.mediaTiming?.[key]?.contact).filter(Number.isFinite) ?? [];
    if (parent?.kind === "travel" && contacts.length) {
      stage.timingAnchor = "start"; stage.startOffset = Math.max(...contacts)+(feat.motif==="mixedStrike"?250:0);
      // Linked starts already inherit the launch's per-target stagger.
      if (parent.travelOrigin==="previousTarget") parent.targetStagger = Math.max(550,parent.targetStagger??0, stage.startOffset),stage.targetStagger=0;
    }
  }
  stages = addAbilitySounds(feat, stages, options);
  const routeNote=feat.motif==="lightningDash"?"Selected victims approximate the line route; order targets along the path. The final-square transformation is symbolic: this does not place or move a 30-foot line or relocate the source token.":feat.motif==="lavaLeap"?"Selected victim contacts approximate the landing emanation. The effect does not place a 10-foot area at the cosmetic mesh destination; choose actual affected targets and resolve real movement manually.":feat.motif==="trample"?"Selected victim contacts are a route approximation, each played once. Choose the actual trampling actor or eidolon as source; legal creature sizes, route, saves and damage remain PF2e.":"";
  const systemId=feat.systemId??'pf2e';
  return withCatalogFx(validateRecipe({ id: `${systemId}-${feat.recipeKind??'feat'}-${feat.id}`, name: feat.name, description: `${toss?.note ?? directed?.note ?? FEAT_MOTIFS[feat.motif].label + "."} ${traversal?.reason ?? ""} ${toss ? "" : feat.rationale} ${routeNote} ${(feat.notes ?? []).join(" ")}`,
    category: `${feat.recipeKind==='action'?'Action':feat.recipeKind==='feature'?'Feature':'Feat'} · ${art.label}`, color: art.color, enabled: true, trigger: feat.trigger ?? "use", match: `${feat.name},${feat.slug}`, itemUuid: feat.uuid??`Compendium.${systemId}.${systemId==='sf2e'?'feats':'feats-srd'}.Item.${feat.id}`, ...(feat.playbackRoles?{playbackRoles:feat.playbackRoles}:{}), stages }),feat,options);
}
