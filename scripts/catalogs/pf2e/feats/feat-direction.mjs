// Readable art direction applied to a finite cue, never to combat outcomes.
// Collision variants are explicit framing/entrance choices, not tiny hash noise.
import { TOSS_NOTES } from './feat-toss.mjs';
export const FEAT_FRAMES = [
  {name:"centered bloom",x:0,y:0,sx:1,sy:1},
  {name:"low wide sweep",x:0,y:.25,sx:1.3,sy:.7},
  {name:"high narrow rise",x:0,y:-.25,sx:.7,sy:1.3},
  {name:"left crescent",x:-.25,y:0,sx:.85,sy:1.2},
  {name:"right crescent",x:.25,y:0,sx:1.2,sy:.85},
  {name:"diagonal ascending",x:-.2,y:.2,sx:1.2,sy:.8},
  {name:"diagonal settling",x:.2,y:-.2,sx:.8,sy:1.2},
];
export const FEAT_ENTRANCES = ["expanding", "contracting", "ascending", "sweeping", "breathing", "turning", "unfolding", "closing"];
const track=(property,from,to,duration,extra={})=>({property,from,to,duration,ease:"easeInOutQuad",...extra});

// Native actor roles cannot be inferred from whichever token happened to cast
// the chat card or from an unordered set of current targets. Keep them explicit
// so automatic playback can refuse an unresolved origin instead of inventing it.
export function featPlaybackRoles(feat) {
  if(['friendly-fling','friendly-toss','jotuns-boost'].includes(feat.slug))return {source:'caster',targets:['willing-adjacent-ally'],requiresSource:false,requiresTargets:true,automatic:'requires-role-resolution',reason:`${feat.name} moves an eligible willing adjacent ally, not the current enemy target. Select that ally first for manual playback; automatic playback requires explicit ally resolution.`};
  if(feat.slug==='whirlwind-toss')return {source:'caster',targets:['grabbed-victim','adjacent-collateral-victims'],requiresSource:false,requiresTargets:true,automatic:'requires-role-resolution',reason:'Whirlwind Toss needs the actually grabbed victim first and other adjacent collateral victims afterward. Resolve these roles before automatic playback; only the held victim is thrown.'};
  const sourceRoles = {
    "bone-burst":"thrall", "eidolons-retort":"eidolon", "defend-summoner":"eidolon",
    "eidolons-trample":"eidolon", "glider-form":"eidolon", "merciless-rend":"eidolon",
    "piercing-jab":"eidolon", "surprising-leap":"eidolon",
    "engine-of-destruction":"construct-innovation", "elemental-artillery":"ballista",
    "essence-overflow":"spectral-dragon", "danse-macabre":"horde", "in-the-hordes-grip":"horde",
    "cushion-landing":"mount", "dashing-pickup":"mount", "faithful-stride":"mount",
    "strafing-breath":"mount", "to-war":"mount", "trampling-charge":"mount", "vaulting-gallop":"mount",
    "death-dive":"mount", "rearing-display":"mount", "steeds-toppling-strike":"mount",
    "power-slide":"vehicle",
  };
  const source=sourceRoles[feat.slug];
  if(source)return {source,targets:feat.slug==="defend-summoner"?["summoner"]:["selected-recipient"],requiresSource:true,requiresTargets:feat.slug==="defend-summoner",automatic:"requires-role-resolution",reason:`${feat.name} needs the actual ${source.replaceAll("-"," ")} as its animation source${feat.slug==="defend-summoner"?" and the summoner as recipient":""}. Resolve those native roles or use a manual preview with the correct tokens.`};
  if(["megavolt","guardian-lion-roar","deep-freeze","distracting-explosion","explosive-leap","megaton-strike","searing-restoration","silk-bracelet"].includes(feat.slug))return {source:"innovation",sourceAlternatives:["worn-innovation","construct-innovation"],targets:[feat.slug==="searing-restoration"?"living-recipient":"selected-recipient"],requiresSource:true,requiresTargets:false,automatic:"requires-role-resolution",reason:`${feat.name} can be performed by the inventor using their innovation or by a separate minion innovation. Resolve the native branch; do not substitute the inventor for an unresolved construct.`};
  const performerPairs={"magical-onslaught":["eidolon","summoner"],"recoiling-relocation":["mortar","operator"],"tandem-strike":["eidolon","summoner"],"tandem-movement":["eidolon","summoner"],"pack-movement":["animal-companion","ranger"],"duo-dragon-kick":["construct-innovation","inventor"],"cavaliers-charge":["mount","rider"],"mammoth-charge":["mount","rider"],"shadowpiercing-charge":["mount","rider"]};
  const performers=performerPairs[feat.slug];
  if(performers)return {source:performers[0],performers,multiplePerformers:true,targets:["selected-recipient"],requiresSource:true,requiresTargets:false,automatic:"requires-role-resolution",reason:`${feat.name} involves two actual performers (${performers.map(r=>r.replaceAll("-"," ")).join(" and ")}). The default one-source composition is a manual illustration; automatic playback requires explicit performer mapping and a corresponding customized graph.`};
  if(["cascading-ray","killshots-report"].includes(feat.slug))return {source:"caster",targets:[feat.slug==="killshots-report"?"fallen-spellstrike-victim":"previous-spellstrike-victim","secondary-victim"],requiresSource:false,requiresTargets:true,automatic:"requires-role-resolution",reason:`${feat.name} begins at the previous Spellstrike victim, then travels to a different secondary victim. Resolve both ordered roles; the current target set alone does not identify the prior victim.`};
  if(feat.slug==="chain-of-words")return {source:"first-rune-endpoint",targets:["second-rune-endpoint"],requiresSource:true,requiresTargets:true,automatic:"requires-role-resolution",reason:"Chain of Words needs both invoked rune endpoints. Select the first endpoint as source and the second as target for manual preview; rune bearers are excluded from the damaging line."};
  if(feat.slug==="cranial-detonation")return {source:"caster",targets:["fallen-foes"],requiresSource:false,requiresTargets:true,automatic:"requires-role-resolution",reason:"Cranial Detonation centers on the foes reduced to 0 HP by the triggering spell. Resolve those actual fallen foes; current targets and later successful chain detonations cannot be assumed."};
  if(feat.slug==="march-of-the-dead")return {source:"caster",targets:["commanded-thralls"],requiresSource:false,requiresTargets:true,automatic:"requires-role-resolution",reason:"March of the Dead moves commanded thralls. Resolve those thralls as recipients; selected enemies are not the moving performers, and their later saves remain conditional."};
  if(feat.slug==="you-cant-hide-from-us")return {source:"caster",targets:["previous-united-companion-victim"],requiresSource:false,requiresTargets:true,automatic:"requires-role-resolution",reason:"You Can't Hide From Us must Strike the same creature successfully struck by the united companion this round. Resolve that actual previous victim; current target selection is not evidence of that history."};
  return null;
}

// Corrections from complete native activation descriptions. These describe the
// current action, not attacks granted for a later action or conditional riders.
// Builders and direct recipe callers share the same activation semantics.
export function reviewedFeatActivation(feat) {
  const patches = {
    'distracting-toss': {contacts:{count:1,distribution:'same-target',conditional:false},weapon:'thrown',shape:'upward distraction then one other thrown weapon',finish:['conditional-catch-first-weapon']},
    'rebounding-toss': {contacts:{count:2,distribution:'ordered-chain',conditional:true},weapon:'thrown',shape:'first weapon arrival then confirmed-hit rebound to second enemy'},
    'feral-toss': {contacts:{count:1,distribution:'same-target',conditional:true},weapon:'horn-antler-or-tusk',shape:'head shake then piercing natural weapon thrust',finish:['confirmed-hit-push']},
    'friendly-fling': {contacts:{count:0,distribution:'willing-adjacent-ally',conditional:false},shape:'horn scoop and piercing nick then low ally arc',finish:['upright-landing','optional-ally-reaction-strike']},
    'friendly-toss': {contacts:{count:0,distribution:'willing-adjacent-ally',conditional:false},shape:'backward windup then two-arm heave and high ally arc',finish:['upright-landing','optional-ally-reaction-strike']},
    'jotuns-boost': {contacts:{count:0,distribution:'willing-adjacent-ally',conditional:false},shape:'vertical lift then flatter outward ally boost',finish:['upright-landing','optional-ally-reaction-strike']},
    'whirlwind-toss': {contacts:{count:1,distribution:'held-victim then other adjacent collateral victims once each',conditional:false},shape:'held-victim whirl then Thrash then optional victim-only throw'},
    'wind-tossed-spell': {contacts:{count:0,distribution:'source',conditional:false},shape:'source wind preparation; later spell separate'},
    "defend-our-union": { motif:"charge", contacts:{count:1,distribution:"triggering enemy",conditional:true}, shape:"protective Stride toward the enemy then one Strike in reach" },
    "cauterize": {},
    "paired-shots": { motif:"firearm", theme:"weapon", contacts:{count:2,distribution:"same-target",conditional:false}, weapon:"two firearms or crossbows", tempo:"simultaneous", shape:"two converging shots at one foe" },
    "twin-shot-knockdown": { motif:"firearm", theme:"weapon", contacts:{count:2,distribution:"same-target",conditional:true}, weapon:"two firearms or crossbows", tempo:"sequential", shape:"two shots at one foe; knockdown only after both hit" },
    "everstand-strike": { motif:"strike", theme:"weapon", contacts:{count:1,distribution:"same-target",conditional:false}, weapon:"two-handed shield bash", shape:"one shield bash; conditional source guard follows" },
    "clear-the-way": { motif:"clearWay", contacts:{count:5,distribution:"up to five different targets",conditional:false}, weapon:"two-handed weapon used to Shove", shape:"wide non-damaging shoves then half-Speed Stride" },
    "cross-the-final-horizon": { weapon:"storm-wrapped unarmed limbs", contacts:{count:3,distribution:"same-target",conditional:true}, shape:"approach then three unarmed storm contacts" },
    "skyseeker": { contacts:{count:1,distribution:"one target",conditional:true}, shape:"one base Leap and Strike; higher-level continuation is optional" },
    "impossible-flurry": { contacts:{count:6,distribution:"selected foe or multiple foes",conditional:false} },
    "tidal-wave": { contacts:{count:2,distribution:"selected foe or multiple foes",conditional:true} },
    "anatomical-quartering": { contacts:{count:4,distribution:"up to four different targets",conditional:false} },
  };
  const patch=patches[feat.slug],playbackRoles=featPlaybackRoles(feat);
  if(!patch)return playbackRoles?{...feat,playbackRoles}:feat;
  const {motif=feat.motif,theme=feat.theme,...direction}=patch;
  return {...feat,motif,theme,...(playbackRoles?{playbackRoles}:{}),...(TOSS_NOTES[feat.slug]?{rationale:TOSS_NOTES[feat.slug]}:{}),direction:{...feat.direction,...direction},notes:[...new Set([...(feat.notes??[]),
    ...(feat.slug==="skyseeker"?["Default depicts the base one-Strike activity. Optional level-12/16 leaps require successful hits and different creatures; add those branches explicitly."]:[]),
    ...(feat.slug==="cauterize"?["Default after-shot heated-barrel cue assists the source. For an adjacent wounded ally, customize that cue's recipient; assistance does not guarantee ending bleed."]:[]),
    ...(feat.slug==="paired-shots"||feat.slug==="twin-shot-knockdown"?["Default firearm footage; choose crossbow projectile footage when wielding crossbows. Knockdown is never applied automatically."]:[])])]};
}

export function semanticEntrance(direction={}) {
  const text=[direction.shape,direction.approach,...(direction.finish??[])].join(" ").toLowerCase();
  if(/absorb|inward|contract|siphon|encas|encirc|enclos|tighten/.test(text))return "contracting";
  if(/wings|updraft|rise|rising|upward|feather|tower|climb/.test(text))return "ascending";
  if(/scan|sweep|flow|wave|line|slid|wash/.test(text))return "sweeping";
  if(/swarm|splinter|shard|facet|flicker|unfold|petal/.test(text))return "unfolding";
  if(/rune|script|turn|spiral|coil|card|orbit|swirl/.test(text))return "turning";
  if(/fog|mist|vapor|shade|quiet|shadow|aura|breath/.test(text))return "breathing";
  if(/close|brace|harden|lock|settle|resolve|seal/.test(text))return "closing";
  return "expanding";
}

export function applyFeatDirection(stages,feat) {
  const direction=feat.direction??{}, framing=feat.framing??{};
  // Choose an ambient/gather cue. One-shot flights and actual weapon contacts
  // retain complete footage, natural aspect, measured rate and arrival timing.
  const cue=stages.findLast(s=>s.kind==="aura")??stages.find(s=>s.kind==="cast"&&!s.oneShot);
  if(!cue)return stages;
  const frame=FEAT_FRAMES[framing.frame??0]??FEAT_FRAMES[0],entrance=framing.entrance??semanticEntrance(direction);
  const duration=Math.max(800,Math.min(1600,cue.duration)),amount=framing.size??1;
  cue.offsetX=(cue.offsetX??0)+frame.x;cue.offsetY=(cue.offsetY??0)+frame.y;
  cue.scale=(cue.scale??1)*amount;
  cue.fadeIn=Math.min(400,Math.round(duration*.2));cue.fadeOut=Math.min(500,Math.round(duration*.3));
  cue.scaleInDuration=0;
  const x=frame.sx,y=frame.sy;
  const tracks={
    expanding:[track("scale.x",x*.65,x*1.2,duration),track("scale.y",y*.65,y*1.2,duration)],
    contracting:[track("scale.x",x*1.4,x*.75,duration),track("scale.y",y*1.4,y*.75,duration)],
    ascending:[track("position.y",.25,-.25,duration),track("scale.x",x*.7,x,duration),track("scale.y",y*.7,y*1.2,duration)],
    sweeping:[track("position.x",-.3,.3,duration),track("scale.x",x*.7,x*1.2,duration),track("scale.y",y,y,duration)],
    breathing:[track("scale.x",x*.85,x*1.15,duration,{loop:true,pingPong:true}),track("scale.y",y*.85,y*1.15,duration,{loop:true,pingPong:true})],
    turning:[track("rotation",-45,45,duration),track("scale.x",x*.8,x*1.15,duration),track("scale.y",y*.8,y*1.15,duration)],
    unfolding:[track("scale.x",x*.55,x*1.25,duration),track("scale.y",y*1.2,y*.8,duration)],
    closing:[track("scale.x",x*1.3,x*.8,duration),track("scale.y",y*.7,y*1.15,duration)],
  };
  cue.tracks=tracks[entrance]??tracks.expanding;
  if(framing.pause)cue.delay+=framing.pause;
  return stages;
}

// Fingerprint the rendered effect after choosing an installed edition. Ignore
// IDs, labels, unused tint and empty timing/option knobs. Coarse values reject
// distinctions based only on 1ms/1px differences. Motion is audited separately.
export function visibleFeatComposition(recipe,keys=null,{motion=true}={}) {
  const stages=recipe.stages.filter(s=>motion||!["motion","sprite"].includes(s.kind));
  const q=(v,unit)=>Math.round((v??0)/unit)*unit;
  return stages.map(s=>({
    kind:s.kind,asset:keys?s.assets.find(k=>keys.has(k))??null:s.assets,
    subject:s.kind==="cast"?"source":s.kind==="impact"?"targets":s.subject,
    delay:q(s.delay,200),duration:q(s.duration,200),after:s.afterStage?recipe.stages.findIndex(p=>p.stageId===s.afterStage):-1,
    anchor:s.afterStage?s.timingAnchor:null,startOffset:s.afterStage?q(s.startOffset,200):0,
    scale:q(s.scale,.1),opacity:q(s.opacity,.1),below:s.below,
    offset:[q(s.offsetX,.1),q(s.offsetY,.1)],mirror:[s.mirrorX,s.mirrorY],
    rotation:q(s.rotation,15),tint:s.tintEnabled?s.tint:null,
    repeat:[s.repeats,s.repeatScope,q(s.repeatInterval,200),q(s.targetStagger,200)],origin:s.travelOrigin,selection:s.targetSelection,limit:s.targetLimit,
    motion:s.kind==="motion"?[s.motion,q(s.distance,.05),q(s.intensity,.05),...(s.motionRange?[s.motionRange,s.motionHeading,s.motionEndpoint,s.motionArrival,s.motionHold,q(s.jumpHeight,.1),q(s.arrivalLift,.1),q(s.stopGap,.1),s.motionSide,q(s.perSquare,50)]:[])]:null,
    copies:s.kind==="sprite"?[s.copies,q(s.copySpread,.1),s.shadow]:null,
    tracks:s.tracks.map(t=>({...t,from:q(t.from,t.property==="rotation"?15:.1),to:q(t.to,t.property==="rotation"?15:.1),duration:q(t.duration,200),delay:q(t.delay,200)})),
  }));
}
