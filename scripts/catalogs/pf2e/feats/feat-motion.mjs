// Hand-directed from each complete feat description. Paths move artwork only.
// Reach, legal movement, check outcomes and action order stay with the player.
export const FEAT_MOTION_PROFILES = {
  "defend-our-union": {
    motif:"charge",motion:"rush",label:"Protective approach toward triggering enemy",duration:3000,
    perSquare:200,distance:6,intensity:.5,motionArrival:35,motionHold:30,
    hit:"One protective Strike after approach",
    note:"Stride toward the triggering enemy, then one configured melee Strike when in reach. Native ranged alternative, reach and damage reduction remain conditional and customizable.",
  },
  "cross-the-final-horizon": {
    motif:"charge",motion:"rush",label:"Storm-wrapped advance",duration:4600,
    perSquare:220,distance:7,intensity:.65,motionArrival:30,motionHold:40,
    hit:"Three storm-wrapped unarmed contacts",hits:3,hitInterval:650,
    note:"A held approach illustrates up to three unarmed Strikes against the same foe. Choose electricity or sonic per Strike; drained requires all three hits and is never applied by the animation.",
  },
  "skyseeker": {
    motif:"charge",motion:"leap",label:"Base Skyseeker leap",duration:3000,
    perSquare:180,distance:8,intensity:.55,jumpHeight:1.1,arrivalLift:.2,
    hit:"One base airborne Strike",
    note:"Base Leap and one airborne Strike. Optional higher-level successful continuations require different creatures and are configured separately.",
  },
  "tidal-wave": {
    motif:"doubleStrike",motion:"rush",label:"Tidal Wave movement",duration:3800,
    perSquare:180,distance:6,intensity:.55,motionArrival:35,motionHold:30,
    hit:"Two flowing Strikes",hits:2,hitInterval:650,
    note:"A sample movement approach and two Strikes at the first foe. Native Tidal Wave also permits choosing different foes at points along the movement; configure that route explicitly. Quickened is conditional and never applied.",
  },
  "into-the-fray": {
    motif:"doubleStrike",motion:"rush",label:"Weapon-and-shield advance",duration:4200,
    perSquare:180,distance:6,intensity:.55,motionArrival:30,motionHold:40,
    hit:"Weapon Strike at first foe",secondaryHit:"Shield Strike at second foe",hitInterval:650,
    note:"Default Stride approach samples the chosen route, followed by different weapon and shield contacts at two selected foes. Leap or Swim is an optional movement choice; actual positions and legal reach remain manual.",
  },
  "sudden-charge": {
    motion: "rush",
    label: "Double sprint into melee",
    duration: 2200,
    perSquare: 200,
    distance: 12,
    intensity: 0.8,
    hit: "One Strike after the sprint",
    note: "Double sprint into one melee Strike. Cosmetic approach stops beside the first target, holds for contact, then returns.",
  },
  "sudden-leap": {
    motion: "leap",
    label: "Soaring approach and airborne Strike",
    duration: 2400,
    perSquare: 180,
    distance: 12,
    intensity: 0.65,
    jumpHeight: 1.15,
    arrivalLift: 0.4,
    hit: "One airborne melee Strike",
    note: "Shows one midair Strike, followed by a controlled drop and upright landing. Optional Felling Strike remains a player choice.",
  },
  "flying-kick": {
    motion: "leap",
    label: "Forward leap into a flying kick",
    duration: 2300,
    perSquare: 170,
    distance: 8,
    intensity: 0.7,
    jumpHeight: 0.75,
    arrivalLift: 0.2,
    hit: "Unarmed Strike at jump end",
    note: "Shows one unarmed Strike at the end of the jump, then landing. No extra attacks.",
  },
  "tumbling-strike": {
    motion: "roll",
    label: "Tumble through to the opposite side",
    duration: 2200,
    perSquare: 160,
    distance: 8,
    intensity: 0.65,
    motionEndpoint: "past",
    hit: "One Strike from the far side",
    note: "Illustrates a successful Acrobatics check: pass through the foe, then one Strike. Failure and critical failure branches remain manual.",
  },
  "skirmish-strike": {
    motion: "dodge",
    label: "Short lateral Step before Strike",
    duration: 1600,
    distance: 0.55,
    intensity: 0.45,
    motionRange: "distance",
    hit: "One Strike after the Step",
    note: "Default illustrates Step then Strike. Customize linked timing for Strike then Step; no full charge.",
  },
  "cartwheel-dodge": {
    motion: "roll",
    label: "Cartwheel away from danger",
    duration: 2000,
    distance: 1.2,
    intensity: 0.7,
    motionRange: "distance",
    motionSide: -1,
    note: "Successful-save reaction shown as a broad cartwheel. No attack or damage cue.",
  },
  "defensive-roll": {
    motion: "roll",
    label: "Low defensive roll absorbs the blow",
    duration: 1800,
    distance: 0.45,
    intensity: 0.35,
    motionRange: "distance",
    note: "Short evasive roll disperses a lethal physical blow. Does not depict a Strike or grant movement.",
  },
  "running-reload": {
    motion: "rush",
    label: "Run, settle, then reload",
    duration: 2400,
    distance: 1.4,
    intensity: 0.5,
    motionRange: "distance",
    reload: true,
    note: "Stride, Step or Sneak, followed by a reload cue. No projectile or gunshot.",
  },
  "dashing-pounce": {
    motif: "doubleStrike", motion: "leap", label: "Leap into paired claw attacks",
    duration: 3000, perSquare: 200, distance: 8, intensity: .7,
    jumpHeight: .8, arrivalLift: 0, motionArrival: 35, motionHold: 35, hit: "Two frenzied claw contacts", hits: 2,
    hitInterval: 550, note: "Leap then exactly two claw Strikes at the same selected foe. A failed pair's prone result remains conditional; cosmetic pose returns without changing position or conditions.",
  },
  "doctors-visitation": {
    motion: "rush", label: "Approach the patient", duration: 2600, perSquare: 220,
    distance: 8, intensity: .45, care: true,
    note: "Stride toward one selected patient, then a small care cue. Battle Medicine, Treat Poison, First Aid or Treat Condition remains a player choice; no attack, guaranteed healing or document movement.",
  },
  "incredible-sprint": {
    motion: "rush", label: "Three-Stride sprint silhouette", duration: 3000,
    distance: 2.4, intensity: .65, motionRange: "distance", echoes: 3,
    note: "Long level sprint with three departure echoes. Illustrates three Strides at sample distance; cosmetic return does not depict another action or change a token's legal destination.",
  },
  "furious-sprint": {
    motion: "rush", label: "Long straight sprint", duration: 4200,
    distance: 3.5, intensity: .8, motionRange: "distance", echoes: 4,
    note: "Broad straight sprint depicts the default five-Stride activity without attacks. Eight-Stride option and actual movement remain manual; four visible echoes are an artistic trail, not action counters.",
  },
  "marine-jet": {
    motion: "rush", label: "Long straight underwater jet", duration: 4000,
    distance: 3.2, intensity: .55, motionRange: "distance", echoes: 3,
    note: "Level underwater jet with water departure wake. Illustrates the default five Swims; eight-Swim option, vertical route and actual movement remain manual. No damaging water projectile.",
  },
  "sonic-dash": {
    motion: "rush", label: "Two-Stride sonic sprint", duration: 2900,
    distance: 1.9, intensity: .65, motionRange: "distance", echoes: 2,
    note: "Straight double sprint with a finite pressure wake. Awakened sonic damage and carrying allies are optional branches and are not emitted by the base activity.",
  },
  "ratfolk-roll": {
    motion: "roll", label: "Downhill rolling body", duration: 3400,
    distance: 2.2, intensity: .6, motionRange: "distance", motionSide: -1,
    note: "Body rolls along a straight downhill sample route and settles. Depicts the first turn only; later collision damage, continued rolling and actual relocation remain PF2e outcomes.",
  },
  "swift-leap": {
    motion: "leap", label: "Undead spring and clean landing", duration: 2400,
    distance: 1.15, intensity: .45, motionRange: "distance", jumpHeight: .65,
    note: "One short undead leap with visible arc. Satiation-powered Long/High Jump is optional; no Strike or forced relocation.",
  },
  "explosive-leap": {
    motion: "leap", label: "Explosion-powered takeoff", duration: 2800,
    distance: 1.5, intensity: .7, motionRange: "distance", jumpHeight: 1.1,
    takeoff: "Downward innovation blast", note: "Downward blast precedes a high cosmetic jump. Select the innovation as source for the minion option; no target blast damage is invented.",
  },
  "black-powder-boost": {
    motion: "leap", label: "Firearm kickback leap", duration: 2600,
    distance: 1.4, intensity: .6, motionRange: "distance", jumpHeight: .85,
    takeoff: "Source firearm discharge", note: "Small source muzzle flash powers the leap. Does not aim or fire a damaging projectile at a foe; High/Long Jump option and ammunition updates stay manual.",
  },
  "propelled-leap": {
    motion: "leap", label: "Swim momentum into vertical water leap", duration: 2800,
    distance: .65, intensity: .45, motionRange: "distance", jumpHeight: 1.25,
    note: "Steep flying-fish arc and water takeoff cue illustrate one successful jump. Athletics height, edge grabbing and submerged landing remain outcomes, not automatic updates.",
  },
  "elf-step": {
    motion: "dodge", label: "Two graceful short Steps", duration: 1400,
    distance: .55, intensity: .3, motionRange: "distance", steps: 2,
    note: "Two distinct small lateral Step cues, rather than one pulse or long sprint. Cosmetic return resets preview artwork only; actual Step direction remains a player choice.",
  },
  "quick-positioning": {
    motion: "dodge", label: "Two cautious opening Steps", duration: 1600,
    distance: .5, intensity: .25, motionRange: "distance", steps: 2,
    note: "Default depicts both optional opening Steps at a deliberate cadence. Choose one Step by reducing repeats; initiative and hunted-prey requirements stay PF2e.",
  },
  "guarded-advance": {
    motion: "dodge", label: "Two shielded Steps", duration: 1800,
    distance: .5, intensity: .2, motionRange: "distance", steps: 2, guard: true,
    note: "Shield appears before two cautious Step cues. Any legal action order remains configurable; shield state and real movement are not changed.",
  },
  "guarded-advance-knight-vigilant": {
    motion: "dodge", label: "One cautious shielded Step", duration: 1900,
    distance: .5, intensity: .15, motionRange: "distance", guard: true,
    note: "Shield plus one Step, distinct from Guardian's two-Step Guarded Advance. Reverse action order through stage timing if desired; no real relocation.",
  },
  "goblin-scuttle": {
    motion: "dodge", label: "One low scuttling Step", duration: 1400,
    distance: .55, intensity: .4, motionRange: "distance", motionSide: -1,
    note: "One short lateral scuttle follows the ally trigger. No charge, attack or automatic choice of destination.",
  },
  "step-lively": {
    motion: "dodge", label: "Skirt the larger foe's footfall", duration: 1500,
    distance: .5, intensity: .3, motionRange: "distance",
    note: "One small lateral Step cue keeps focus on avoiding a large foe. Destination adjacency is decided in PF2e, not by cosmetic artwork.",
  },
  "nimble-dodge": {
    motion: "dodge", label: "Compact evasive sidestep", duration: 1300,
    distance: .24, intensity: .3, motionRange: "distance",
    note: "Compact sideways body dodge depicts an AC reaction. This is not a granted Step or actual movement and does not assert the attack missed.",
  },
  "dodging-roll": {
    motion: "roll", label: "Low roll out of the area", duration: 1800,
    distance: .55, intensity: .3, motionRange: "distance", motionSide: -1,
    note: "Short roll depicts the one Step and defensive reaction. Resistance and leaving the area remain conditional; no long charge or attack.",
  },
  "mounting-leap": {
    motion: "leap", label: "Leap toward the willing mount", duration: 2400,
    distance: 2, perSquare: 220, intensity: .35, jumpHeight: .7, arrivalLift: .35,
    note: "Target the willing larger mount. Short rising approach settles beside it with a saddle-height cue; actual Mount, relocation and riding state remain manual.",
  },
  "hit-the-dirt": {
    motion: "leap", label: "Low evasive leap", duration: 2200,
    distance: .8, intensity: .3, motionRange: "distance", jumpHeight: .35, prone: true,
    note: "Short evasive leap ends with a finite sideways prone silhouette. Native token artwork resets after preview, not a Stand action; PF2e prone state and AC remain unchanged by the animation.",
  },
};

// 2026-10-08 motion review: fiction-specific motion types replace generic
// lunge/recoil/pulse. Cosmetic only; recipients are the enemies the PF2e
// action affects (shoved, tripped, frightened), never helped allies.
const SLAM_FEATS = new Set(["quaking-stomp", "impressive-landing", "world-breaking-footfall", "shifting-terrain", "rattle-the-earth"]);
const SINK_FEATS = new Set(["mirror-refuge"]);
const BRACE_FEATS = new Set(["aggressive-block", "drive-back", "knights-retaliation", "repulse-the-wicked", "armored-rebuff"]);
export function reviewFeatMotion(feat, stages, motion) {
  const text = feat.plainDescription ?? "";
  const source = stages.filter(s => s.kind === "motion" && s.subject === "source");
  const first = stages.find(s => ["impact", "aura", "cast"].includes(s.kind));
  for (const s of stages.filter(s => s.kind === "motion")) {
    // Shoved, tripped or heavily struck foes stagger rather than twitch back.
    if (s.subject === "targets" && ((s.motion === "recoil" && ["shove", "trip", "tripStrike"].includes(feat.motif)) || (s.motion === "shake" && feat.motif === "heavyStrike")))
      Object.assign(s, { motion: "stagger", intensity: .5, distance: s.motion === "shake" ? .1 : s.distance });
    // Thrown bombs and weapons wind back and release instead of lunging.
    if (s.subject === "source" && s.stageId?.endsWith("-physical-release") && s.motion === "lunge") s.motion = "throw";
    // A source raising its own guard braces rather than pulsing.
    if (s.subject === "source" && s.motion === "pulse" && s.label === "Brace" && ["shield", "guard", "waveGuard"].includes(feat.motif)) Object.assign(s, { motion: "brace", intensity: .4 });
  }
  // Reactions that push from behind a raised shield or after a foe's failed
  // attack: brace first, the foe staggers away; no forward attack lunge.
  if (BRACE_FEATS.has(feat.slug)) for (const s of source.filter(s => s.motion === "lunge")) Object.assign(s, { motion: "brace", label: "Brace and push back", intensity: .45 });
  if (feat.slug === "boulder-roll") for (const s of source.filter(s => s.motion === "lunge"))
    Object.assign(s, { motion: "rush", label: "Step into the foe's square", motionRange: "target", targetSelection: "first", distance: 2, perSquare: 220, duration: 1800, motionArrival: 45, motionHold: 25, stopGap: 0, intensity: .45 });
  if (feat.slug === "roll-with-it-kingmaker") for (const s of source.filter(s => ["pulse", "brace"].includes(s.motion))) Object.assign(s, { motion: "dodge", label: "Dodge the giant's blow", duration: 1800, distance: .3, intensity: .35, motionRange: "distance" });
  // Sneak up, not sprint: a slow low creep toward the distracted foe.
  if (feat.slug === "underhanded-assault") for (const s of source.filter(s => s.motion === "rush")) Object.assign(s, { label: "Sneak up on the distracted foe", intensity: .12, duration: 3800 });
  const add = (name, subject, label, extra = {}) => stages.push(motion(name, subject, label, first?.delay ?? 0, extra.duration ?? 1300, { ...extra }));
  if (SLAM_FEATS.has(feat.slug)) for (const s of source.filter(s => s.motion === "pulse")) Object.assign(s, { motion: "slam", label: "Ground slam", intensity: .5, duration: Math.max(1300, s.duration ?? 0) });
  if (!source.length && SLAM_FEATS.has(feat.slug)) add("slam", "source", "Ground slam", { intensity: .5 });
  if (!source.length && SINK_FEATS.has(feat.slug)) add("sink", "source", "Meld into the surface", { duration: 1600, intensity: .5 });
  // Teleport and sudden invisibility phase the body out and back.
  if (!source.length && (feat.motif === "teleport" || feat.motif === "concealment" && /\byou (?:\w+ ){0,2}become (?:invisible|ethereal|incorporeal)\b|\bblink of an eye\b/i.test(text)))
    add("flicker", "source", feat.motif === "teleport" ? "Phase out and back" : "Fade from sight", { duration: 1400, intensity: .5 });
  // Demoralize-type fear: the frightened foes cower.
  if (feat.motif === "dread" && (feat.traits?.includes("fear") || /\b(?:demoraliz|frightened)/i.test(text)) && !stages.some(s => s.kind === "motion" && s.subject === "targets")) {
    const hit = stages.find(s => s.kind === "impact");
    stages.push(motion("cower", "targets", "Frightened foes cower", 0, 1400, { intensity: .35, ...(hit ? { afterStage: hit.stageId, timingAnchor: "start", startOffset: 150 } : {}) }));
  }
  return stages;
}

export function directedFeatMotion(feat, { motion, copy, impact, cast, aura }) {
  const profile = FEAT_MOTION_PROFILES[feat.slug];
  if (!profile) return null;
  const motif = profile.motif ?? (profile.hit
    ? feat.slug === "tumbling-strike"
      ? "tumbleStrike"
      : "charge"
    : "movement");
  if (feat.motif !== motif) return null;
  const { label, hit, secondaryHit, note, reload, care, guard, takeoff, prone, hits = 1, hitInterval = 550, steps = 1, echoes, motif: _motif, ...path } = profile;
  const approach = motion(path.motion, "source", label, 180, path.duration, {
    motionRange: "target",
    // Outbound and cosmetic reset get equal travel budgets. Earlier 45/30
    // left only 25% for return, making the same path reset 1.8 times faster.
    motionArrival: 40,
    motionHold: 20,
    stopGap: 0.1,
    targetSelection: "first",
    ...(steps > 1 ? { repeats: steps, repeatInterval: path.duration + 200, repeatScope: "total" } : {}),
    ...path,
  });
  const echo = copy(
    path.motion === "leap"
      ? "Takeoff silhouette"
      : path.motion === "roll"
        ? "Departure afterimage"
        : path.motion === "dodge"
          ? "Sidestep silhouette"
          : "Sprint departure echoes",
    0,
    {
      copies: echoes ?? (path.motion === "rush" ? 2 : 1),
      copySpread: 0.12,
      opacity: 0.18,
      duration: 1000,
      fadeOut: 650,
    },
  );
  const stages = [echo, approach];
  if (prone) stages.push(copy("Prone landing silhouette", 0, {
    afterStage: approach.stageId, timingAnchor: "arrival", copies: 1,
    rotation: 90, offsetY: .2, opacity: .35, duration: 1500, fadeIn: 0, fadeOut: 650,
  }));
  if (takeoff || guard) stages.unshift(cast(takeoff ?? "Raise the shield before advancing", 0, guard ? 2600 : 1000, { scale: guard ? 1.05 : .65, below: !!takeoff, opacity: guard ? .7 : 1 }));
  if (hit) {
    // Start the full native film early enough that its measured contact lands
    // at arrival; preserve footage and the held destination pose afterward.
    const contact = Math.max(
      0,
      ...(feat.assets.hit ?? []).map(
        (key) => feat.mediaTiming?.[key]?.contact ?? 0,
      ),
    );
    stages.push(
      impact(hit, 0, 1500, {
        afterStage: approach.stageId,
        timingAnchor: "arrival",
        startOffset: -contact,
        targetSelection: "first",
        ...(hits > 1 ? { repeats: hits, repeatScope: "total", repeatInterval: hitInterval } : {}),
        rotation: path.motionEndpoint === "past" ? 180 : 0,
      }),
    );
    if(secondaryHit)stages.push(impact(secondaryHit,0,1500,{
      assets:feat.assets.shieldHit,afterStage:approach.stageId,timingAnchor:"arrival",
      startOffset:hitInterval,targetSelection:"second",oneShot:true,fadeIn:0,scaleInDuration:0,
    }));
    stages.push(
      aura("targets", "Contact settles after arrival", 0, 1600, {
        afterStage: approach.stageId,
        timingAnchor: "arrival",
        startOffset: 180,
        targetSelection: "first",
        scale: 0.75,
        opacity: 0.55,
      }),
    );
  } else if (care) {
    stages.push(impact("Care at the selected patient", 0, 1500, {
      afterStage: approach.stageId, timingAnchor: "arrival", startOffset: 120,
      targetSelection: "first", scale: .65, opacity: .75,
    }));
    stages.push(aura("targets", "Finite patient care settles", 0, 1700, {
      afterStage: approach.stageId, timingAnchor: "arrival", startOffset: 400,
      targetSelection: "first", scale: .8, opacity: .55,
    }));
  } else {
    const cue = cast(
      reload ? "Reload after movement" : "Movement settles",
      0,
      1500,
      {
        afterStage: approach.stageId,
        timingAnchor: reload || steps > 1 ? "end" : "start",
        startOffset: reload ? 120 : 0,
        scale: 0.6,
        opacity: 0.6,
      },
    );
    if (reload) cue.assets = feat.assets.reload ?? feat.assets.aura;
    stages.push(cue);
  }
  return { stages, note };
}
