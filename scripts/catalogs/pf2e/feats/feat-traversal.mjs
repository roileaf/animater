// Full descriptions read for 136 movement/flight designs. Whirlwind Toss now
// uses the dedicated multi-phase treatment in feat-toss.mjs.
// Explicit activity groups preserve their effect art; no ID/name-derived jitter.
// Paths animate mesh artwork only. These sample routes never claim legal squares,
// physical elevation, resolved checks, conditions or actual companion selection.
export const FEAT_TRAVERSAL_REVIEWS = {};
const group = (slugs, classification, reason, motion = null) => {
  for (const slug of slugs.split(" ")) {
    if (FEAT_TRAVERSAL_REVIEWS[slug]) throw Error(`Duplicate movement review ${slug}`);
    FEAT_TRAVERSAL_REVIEWS[slug] = { classification, reason, ...(motion ? { motion } : {}) };
  }
};
const path = (motion, label, distance, extra = {}) => ({
  motion, label, distance, intensity: .35, duration: 2600,
  motionRange: "distance", motionArrival: 40, motionHold: 20, ...extra,
});

group("arcane-propulsion cyclonic-ascent divine-wings dragons-rage-wings fly-on-shadowed-wings ghost-flight propulsive-leap",
  "grant", "Grants a movement mode or changes its restriction; no Fly/Stride action occurs now. Keep a finite stationary manifestation.");
group("call-to-battle hop-up kip-up dangle-vanara guided-hover smooth-hover one-toed-hop float-free",
  "local", "Stand, hang, hover or vertical-only movement has no lateral route. Retain a finite local pose rather than invent traversal.");
group("catfolk-dance disengaging-twist flashy-dodge pirouette squirm-free",
  "local", "Distracting/evasive gesture or Escape check does not itself grant unconditional traversal. Any later Step remains conditional.");
group("slip-the-grasp maneuvering-spell winding-flow",
  "choice", "Explicit alternative actions include stationary choices. Default remains a finite local cue; choose Step/Stride/Leap through configuration after resolving the activity.");
group("shift-spell",
  "area", "Moves an existing spell area rather than token artwork. The finite cue does not move TokenDocuments or guess the existing effect/template.");

group("aquatic-pirouette", "traversal", "One 5-foot underwater evasion; sample lateral route, not a Fly or damaging spin.", path("dodge", "Underwater pirouette sidestep", .5, { duration: 1800, intensity: .45 }));
group("artists-attendance", "traversal", "Two Strides toward a runebearer. Rune tracing is optional and retains the native local rune cue.", path("rush", "Double approach to the runebearer", 8, { motionRange: "target", perSquare: 230, duration: 3000 }));
group("ash-strider", "traversal", "Ash transit along a sample route; first-victim fire and real route remain player-selected. Concealment cue is finite, not a guaranteed condition.", path("rush", "Ash cloud transit", 1.7, { duration: 2900, echoes: 3 }));
group("bashing-charge", "traversal", "Two Strides toward an obstacle; no automatic Force Open success or damaging weapon Strike.", path("rush", "Double charge toward the obstacle", 2.2, { duration: 3200, echoes: 2 }));
group("benefactors-wings dragons-flight evanescent-wings fledgling-flight soaring-flight take-flight take-wing winglet-flight",
  "traversal", "Description explicitly uses Fly now. Short wing-assisted sample transit; actual height, endpoint and falling remain manual.", path("leap", "Short wing-assisted flight", 1.3, { jumpHeight: .15, arrivalLift: .2, duration: 2700, intensity: .2 }));
group("burning-jet", "traversal", "Base impulse is a straight flame-powered Stride. Higher-level Leap/hover is optional, not the default.", path("rush", "Straight flame-propelled jet", 2.1, { duration: 2800, echoes: 3, intensity: .6 }));
group("clang", "traversal", "Default shows Stride toward the attacker; the alternative Strike is not emitted in addition.", path("rush", "Armor glance into approach", 6, { motionRange: "target", perSquare: 220, duration: 2700 }));
group("clever-gambit seize-advantage", "traversal", "Post-trigger Step or Stride; sample short reposition only, not another Strike.", path("dodge", "Exploit the opening with a short reposition", .6, { duration: 2100 }));
group("cycle-of-souls", "traversal", "One Step then a chosen animist stance; stance selection stays manual.", path("dodge", "Guided Step before stance", .5, { duration: 2000 }));
group("daring-act", "traversal", "Shows the successful check's half-Speed departure; critical full-Speed choice stays manual.", path("rush", "Daring maneuver into retreat", 1.1, { motionHeading: "away", duration: 2600 }));
group("defensive-instincts exploit-blunder", "traversal", "One short Step after the trigger; no invented long charge.", path("dodge", "One alert defensive Step", .5, { duration: 1800 }));
group("determined-dash", "traversal", "Base activity is two Strides; third-Stride option, terrain and checks remain PF2e.", path("rush", "Determined double dash", 2.2, { duration: 3100, echoes: 2, intensity: .5 }));
group("distant-waterbirds-poise", "traversal", "Jump after the triggering Spellstrike; no extra attack or guaranteed standing-on-water effect.", path("leap", "Waterbird leap away after contact", 1.2, { motionHeading: "away", jumpHeight: .7, duration: 2800 }));
group("dive-of-the-divine", "traversal", "Downward map silhouette illustrates the vertical dive. Selected victim cues approximate the landing area; actual height, landing area and pushes remain manual.", path("rush", "Divine downward dive", 1.3, { motionHeading: "down", duration: 2500, contacts: "Selected landing spirit contacts" }));
group("dragons-journey", "traversal", "Source Stride with fans; optional allied reaction routes remain manual and are not auto-selected.", path("rush", "Fan-guided graceful transit", 1.6, { duration: 2900, echoes: 2 }));
group("elude-trouble scamper scurry", "traversal", "Retreat/departure sample goes away from the selected threat. Legal cover, endpoint and movement type remain player choices.", path("rush", "Quick departure away from the threat", 1.6, { motionHeading: "away", duration: 2700, echoes: 2 }));
group("farabellus-flip", "traversal", "Compact twisting somersault depicts the AC reaction. Hit-dependent Step is not automatically granted.", path("roll", "Compact defensive somersault", .3, { duration: 2200, intensity: .4 }));
group("generals-gambit", "traversal", "Stride toward the chosen foe followed by diversion cue; no guaranteed fascination or attack.", path("rush", "Strategic approach before diversion", 6, { motionRange: "target", perSquare: 220, duration: 2800 }));
group("ghostly-stride", "traversal", "Half-Speed incorporeal transit, no real obstacle bypass or teleport.", path("rush", "Soft incorporeal half-stride", 1.1, { duration: 2800, echoes: 3, opacity: .12 }));
group("glory-on-high", "traversal", "Upward map silhouette illustrates ascent before the holy display. Actual 60-foot emanation/save results stay manual.", path("rush", "Rise before the holy display", 1.4, { motionHeading: "up", duration: 3100, intensity: .2 }));
group("grand-dance", "traversal", "Air-walking Stride is a shallow sample arc, not unrestricted flight or an automatic fall.", path("leap", "Shallow air-walking dance", 1.5, { jumpHeight: .25, arrivalLift: .15, duration: 3000 }));
group("green-dash", "traversal", "One plant-assisted fast Stride; actual tree, terrain and movement type remain selected by the player.", path("rush", "Vegetation-assisted dash", 1.9, { duration: 2700, echoes: 3, intensity: .5 }));
group("heavens-step-offense", "traversal", "Straight half-Speed departure toward another enemy after the prior Strike; does not replay its attack.", path("rush", "Flourishing approach to the next foe", 5, { motionRange: "target", perSquare: 240, duration: 2700 }));
group("hopping-stride", "traversal", "Small repeated forward hops illustrate the hopping gait. Actual every-other-square route and terrain avoidance stay PF2e.", path("leap", "Low hopping gait", .55, { jumpHeight: .18, duration: 2200, steps: 3, repeatInterval: 120 }));
group("implausible-infiltration stone-passage", "traversal", "Short passage sample, never an actual wall bypass. Material, thickness and successful route remain manual.", path("rush", "Finite passage through a chosen opening", 1.2, { duration: 3000, echoes: 2 }));
group("iruxi-glide tripkee-glide", "traversal", "Forward glide, not a steep takeoff leap. Cosmetic sample is level in a top-down scene; true descent and unsupported ending remain manual.", path("rush", "Controlled forward glide", 1.8, { duration: 3300, intensity: .12 }));
group("it-was-me-all-along", "traversal", "Reveal then Stride/Feint; no actual disguise dismissal or guaranteed attack advantage.", path("rush", "Dramatic reveal into stride", 1.5, { duration: 3000, echoes: 1 }));
group("keep-pace no-escape reactive-pursuit relentless-stalker tight-follower magitaxis", "traversal", "Approach the selected triggering creature without an additional attack. This samples pursuit; does not track historical movement or auto-select an actor.", path("rush", "Controlled pursuit toward the triggering creature", 7, { motionRange: "target", perSquare: 250, duration: 3000 }));
group("levered-swing", "traversal", "Shallow pivot arc samples the lash swing; select an anchor and resolve its real reach/landing manually.", path("leap", "Lash-assisted pivot arc", 1.2, { jumpHeight: .35, duration: 2900, intensity: .25 }));
group("light-paws", "traversal", "Default shows Stride then Step. Reversed order stays configurable; terrain legality remains PF2e.", path("rush", "Careful Stride followed by Step", 1.3, { duration: 2500, followStep: true }));
group("magpie-snatch", "traversal", "Two Strides and optional unattended pickup; no item is removed or an object automatically selected.", path("rush", "Double dash with pickup cue", 2, { duration: 3100, echoes: 2 }));
group("malleable-movement", "traversal", "Brief arc illustrates the triggering Leap's aid, not a second independent jump or attack.", path("leap", "Weapon-assisted leap silhouette", .7, { jumpHeight: .5, duration: 2400 }));
group("nightwave-springing-reload", "traversal", "Default Leap then reload; inverse order and two-action High/Long Jump remain configurable. No gunshot.", path("leap", "Boarding leap before reload", 1.1, { jumpHeight: .65, duration: 2800, reload: true }));
group("perfect-dive", "traversal", "Low arc samples intentional entry into water, no impact damage or automatic water detection.", path("leap", "Controlled dive toward the water", 1.1, { jumpHeight: .3, duration: 2700 }));
group("plane-stepping-dash", "traversal", "One swift planar Stride, not an unrestricted teleport or additional action.", path("rush", "Planar-edged single stride", 1.6, { duration: 2700, echoes: 3 }));
group("rabid-sprint", "traversal", "Three-Stride all-fours sprint; departure echoes are an artistic trail, not action counters.", path("rush", "Low all-fours triple sprint", 2.7, { duration: 3600, echoes: 3, intensity: .65 }));
group("rain-scribe-mobility", "traversal", "Two Strides with a rain-magic wake; no actual difficult-terrain deletion.", path("rush", "Rain-clearing double transit", 2, { duration: 3300, echoes: 3 }));
group("rapid-response", "traversal", "Hasten toward the selected fallen ally. Does not restore HP, stand the ally up or add an attack.", path("rush", "Hasten toward the fallen ally", 8, { motionRange: "target", perSquare: 220, duration: 2700 }));
group("roll-with-it", "traversal", "Sample the attacker's chosen displacement and prone silhouette; no automatic minimum damage, stunned status or legal destination.", path("roll", "Bounce away with the blow", 2, { motionHeading: "away", duration: 3200, prone: true, intensity: .5 }));
group("running-recharge", "traversal", "Default half-Speed Stride with a finite recharge cue; Step alternative, Spellstrike recharge and actual location stay PF2e.", path("rush", "Short stride while recharging", 1, { duration: 2600 }));
group("rushing-boar", "traversal", "Straight approach after taking damage; no retaliatory Strike is granted.", path("rush", "Straight boar-form rush", 7, { motionRange: "target", perSquare: 230, duration: 3000, intensity: .6 }));
group("shadow-tempo", "traversal", "Follow a selected ally with source artwork only. Exact historical route is not available to the animation.", path("rush", "Shadow-rhythm following stride", 6, { motionRange: "target", perSquare: 250, duration: 3000, echoes: 2 }));
group("shadowplay tumbling-diversion the-bigger-they-are", "traversal", "Successful Tumble Through sample passes the selected foe. Checks, flank/weakness/hidden outcomes and a real route remain manual; no new Strike.", path("roll", "Successful tumble to the far side", 7, { motionRange: "target", motionEndpoint: "past", perSquare: 230, duration: 2900, subject: "source", motionSide: -1 }));
group("shamble", "traversal", "Slow deliberate double-Stride sample, rather than quick pulse. Triple-Stride option and body deterioration remain manual.", path("rush", "Unfaltering shambling double stride", 1.8, { duration: 4300, intensity: .2, echoes: 2 }));
group("shared-tide", "traversal", "Double Swim source transit; optional nearby allies' swim-Speed grant is not actual allied movement.", path("rush", "Long shared-tide swim", 2.2, { duration: 3300, intensity: .2, echoes: 2 }));
group("shed-tail", "traversal", "Escape then depart. Does not restore a missing tail or automatically remove the native grabbed condition.", path("rush", "Tail-shedding departure", 1.4, { motionHeading: "away", duration: 2800, echoes: 1 }));
group("shift-the-little-ones", "traversal", "Source Stride sample; contingent allied Steps are not automatically emitted or resolved.", path("rush", "Careful large-body stride", 1.4, { duration: 3300, intensity: .2 }));
group("sonic-strafe", "traversal", "Two Fly actions produce a source transit plus one local sonic contact per selected victim. Route adjacency and save results remain manual.", path("rush", "Double sonic flight strafe", 2.7, { duration: 3400, echoes: 3, contacts: "One sonic passage per selected victim" }));
group("spinning-release", "traversal", "Held target spins then receives a 10-foot release sample. Save-dependent confused/sickened results and forced movement remain manual.", path("roll", "Target spins into release", 1.5, { subject: "targets", motionHeading: "away", duration: 2900, intensity: .4 }));
group("surface-rush", "traversal", "Three-part shore transit sample. Water detection and which Swim/Stride order actually applies remain manual.", path("rush", "Shore crossing with sustained momentum", 2.5, { duration: 3600, echoes: 3 }));
group("swan-dive", "traversal", "Dive arc then a separate forward swim sample, rather than a damaging impact.", path("leap", "Swan dive into water", 1.2, { jumpHeight: .35, duration: 2500, followSwim: true }));
group("swift-elusion", "traversal", "Default successful check illustrates source reposition beside the foe. Moving the foe instead remains an alternative; no guaranteed check success.", path("dodge", "Successful evasive reposition", .7, { duration: 2100 }));
group("swim-through-earth", "traversal", "Sample the immediately granted Burrow. Dense rock option, sustaining and ending-condition penalties remain manual.", path("rush", "Earth-swimming forward passage", 1.5, { duration: 3200, echoes: 2 }));
group("synchronous-slither", "traversal", "Half-Speed source stride after an ally trigger, not another attack or automatically copied ally route.", path("rush", "Half-stride in allied rhythm", 1, { duration: 2700 }));
group("tactical-entry", "traversal", "One stealthy opening Stride with no attack or guaranteed stealth result.", path("rush", "Quiet opening stride", 1.4, { duration: 3000, echoes: 2, opacity: .12 }));
group("thunderous-landing", "traversal", "Downward map silhouette and finite source landing cue. Optional actual landing area and enemy pushes remain manual.", path("rush", "Controlled thunderous landing", 1.2, { motionHeading: "down", duration: 2700, contacts: "Selected landing shock-wave cue" }));
group("tikling-bird-twirl", "traversal", "Default short Step after the already-resolved critical Strike. Longer Stride/Swim is optional; no second attack.", path("dodge", "Post-contact dancing Step", .5, { duration: 1800 }));
group("tunnel-roll", "traversal", "Initial-turn downhill roll sample only; continued turns, collision damage and slowed status remain native outcomes.", path("roll", "Downhill tunnel roll", 2.7, { duration: 4100, motionSide: -1, intensity: .6 }));
group("vexing-tumble", "traversal", "Half-Speed tumbling departure sample; per-foe checks and reaction suppression remain unresolved.", path("roll", "Vexing half-stride tumble", 1.1, { duration: 2900, motionSide: -1, intensity: .35 }));
group("vivacious-afterimage", "traversal", "Default source Stride leaves a finite visible copy. Sending only the image, duration/flanking and disbelief remain manual.", path("rush", "Stride leaving a visible afterimage", 1.6, { duration: 2900, echoes: 1, opacity: .35 }));
group("volcanic-escape", "traversal", "One selected enemy's lava contact precedes a half-Speed escape Leap. Save/damage results remain manual.", path("leap", "Leap away from the volcanic reaction", 1.2, { motionHeading: "away", jumpHeight: .65, duration: 2800, subject: "source", contacts: "Selected triggering enemy's lava reaction", contactBefore: true }));
group("wall-run", "traversal", "Uphill map sample represents the wall traverse. No wall is detected, real elevation or fall state is changed.", path("rush", "Upward wall-running silhouette", 1.8, { motionHeading: "up", duration: 3200, echoes: 2 }));
group("water-strider", "traversal", "Base one-Stride surface transit with water wake. Three-Stride option and valid supported destination remain manual.", path("rush", "Single water-surface stride", 1.6, { duration: 2900, intensity: .2 }));
group("whirling-throw", "traversal", "Successful throw branch samples one held target traveling away; strength distance, obstacle damage and critical prone are not automatically resolved.", path("leap", "Successful held-target throw", 1.5, { subject: "targets", motionHeading: "away", jumpHeight: .45, duration: 3100, intensity: .45 }));
group("wild-dance", "traversal", "Graceful Stride sample; reaction saves and fascination are not guaranteed.", path("leap", "Graceful dancing stride", 1.5, { jumpHeight: .2, duration: 2900 }));
group("wild-stride", "traversal", "Two quick Strides; one/two-hand movement bonuses remain native rather than invented animation distance.", path("rush", "Open-handed double stride", 2.1, { duration: 3000, echoes: 2 }));
group("wing-step", "traversal", "Exactly two small Steps with a wing cue; not a Fly or long charge.", path("dodge", "Two light wing-assisted Steps", .5, { duration: 1600, steps: 2 }));
group("zealous-rush", "traversal", "Default short blessed Stride after a one-action spell. Full-Speed option depends on the actual spell's action cost.", path("rush", "Short stride carrying self blessing", 1, { duration: 2400 }));

// These activities require two explicitly selected participants. Both artwork
// poses use the same map-axis sample; independent target-relative vectors would
// incorrectly send leader and follower in opposite directions.
group("lead-the-way tandem-movement",
  "joint", "Source and one selected willing partner share a parallel sample route. Exact allied/eidolon identity, real route and reactions stay manual.", path("rush", "Leader and selected partner advance", 1.3, { duration: 2900, joint: true, motionHeading: "right" }));
group("lesson-of-the-circling-gale", "joint", "One source Step and one selected student's optional reaction Step share a small parallel sample. Student identity, reaction and real squares remain manual.", path("rush", "Teacher and selected student each Step", .5, { duration: 2000, joint: true, motionHeading: "right", intensity: .2 }));
group("ferry-through-waves", "joint", "Source and one selected willing ally Swim in parallel. Two-Swim option and the actual water route remain manual.", path("rush", "Swimmer and carried ally cross together", 1.4, { duration: 3100, joint: true, motionHeading: "right", intensity: .2 }));
group("march-the-mines", "joint", "Default two-Strides source/selected ally sample; alternate Burrow and trailing-square destination remain manual.", path("rush", "Leader and trailing ally march", 2, { duration: 3400, joint: true, motionHeading: "right", partnerDelay: 180 }));
group("pressure-change", "joint", "Source and held target rise together on the map sample. Choose actual up/down pressure path manually; save conditions remain unresolved.", path("rush", "Underwater pair rise together", 1.2, { duration: 2900, joint: true, motionHeading: "up", intensity: .15 }));
group("riptide", "joint", "Source and selected grabbed target enter water together on a sample route. Actual water position/condition updates remain manual.", path("rush", "Grappler and victim enter water together", 1, { duration: 2700, joint: true, motionHeading: "right", intensity: .25 }));
group("cratering-drop", "joint", "Source and selected already-falling target descend together. Actual height, ground contact and falling damage remain native outcomes.", path("rush", "Attacker and falling foe descend together", 1.4, { duration: 2700, joint: true, motionHeading: "down", intensity: .3 }));

// Automatic actor lookup would move the wrong artwork. Illustrate the explicitly
// selected performer, and state what has to be chosen in the actual scene.
group("cushion-landing dashing-pickup faithful-stride", "performer", "Choose the actual mount as animation source. Mount transit is sampled; the rider's fall/pickup and real Mount operation remain manual.", path("rush", "Selected mount's controlled transit", 1.8, { duration: 3100, echoes: 2 }));
group("glider-form", "performer", "Choose the eidolon as source. Depicts its forward glide; does not move or grant flight to the summoner.", path("rush", "Selected eidolon's controlled glide", 1.8, { duration: 3300, subject: "source", intensity: .12 }));
group("power-slide", "performer", "Choose the vehicle as source. One skid sample, not automatic pilot movement or resolved 90/180-degree turn.", path("dodge", "Selected vehicle's controlled skid", 1.1, { duration: 3000, intensity: .4 }));
group("recoiling-relocation", "performer", "Choose the mortar/performer as source. One recoil-powered arc; paired rider/mortar identity and actual destination remain manual.", path("leap", "Selected performer's exhaust-powered relocation", 1.5, { duration: 3000, jumpHeight: .5, motionHeading: "away", intensity: .4 }));
group("danse-macabre", "performer", "Choose the horde as source. Its transit is sampled; once-per-victim Mobbing Assault and conditional dragging require selected actual victims.", path("rush", "Selected horde's dragging march", 2, { duration: 3800, subject: "source", contacts: "One horde passage per selected victim" }));
group("liberating-dive", "performer", "Source flies along a sample route. Choose actual enemy and rescued ally separately; one optional Blast/Escape is not automatically emitted at every target.", path("leap", "Steel-wing liberating transit", 1.9, { duration: 3000, subject: "source", jumpHeight: .2, arrivalLift: .2 }));
group("strafing-breath to-war trampling-charge", "performer", "Choose the actual mount as source. Once-per-selected-victim traversal contact is sampled; rider/aura/allied benefits, legal sizes and real route remain PF2e.", path("rush", "Selected mount's sweeping route", 2.4, { duration: 3600, subject: "source", contacts: "Once-per-victim mount passage", echoes: 3 }));
group("vaulting-gallop", "performer", "Choose the actual mount as source. Samples one low vault during its double Stride; obstacle heights/routes remain manual.", path("leap", "Selected mount's low vaulting gallop", 1.8, { duration: 3200, subject: "source", jumpHeight: .45 }));
group("repositioning-block", "traversal", "Successful Reposition branch samples the attacker shifting sideways after Shield Block. No free hand/check or actual location is changed.", path("dodge", "Attacker shifts under shield momentum", .65, { subject: "targets", duration: 2200 }));
group("divert-streamflow", "traversal", "Successful Reposition branch samples the attacker shifting. Optional source Step is not automatically combined on a failed check.", path("dodge", "Attacker diverted by the flowing guard", .6, { subject: "targets", duration: 2200, motionSide: -1 }));
group("switcheroo", "choice", "A successful opposed two-body swap requires the actual adjacent footprints and selected outcome. Retain a finite attempt cue; no guessed swap or attack retargeting is performed.");
group("log-roll", "local", "Unsteady-surface check, not an unconditional roll or Stride. Target pose feedback remains local; success/failure determines who actually falls.");

export function applyReviewedTraversal(stages, feat, { motion, copy, impact, cast }) {
  const review = FEAT_TRAVERSAL_REVIEWS[feat.slug];
  if (!review?.motion || !["movement", "flight"].includes(feat.motif)) return review ?? null;
  const { label, subject = "source", joint, partnerDelay = 0, steps = 1, repeatInterval = 200,
    echoes = 1, opacity = .18, followStep, followSwim, prone, reload,
    contacts, contactBefore, ...route } = review.motion;
  for (const cue of stages.filter(stage => stage.kind === "impact")) {
    // This is the retained departure cue, not another per-victim contact.
    if (subject === "source") cue.kind = "cast";
    else cue.targetSelection = "first";
  }
  // Replace the old 3.6px pulse/rise, preserve the effect composition it belongs to.
  const index = stages.findIndex(stage => stage.kind === "motion");
  const approach = motion(route.motion, subject, label, 180, route.duration, {
    ...route, targetSelection: "first", stopGap: .1,
    ...(steps > 1 ? { repeats: steps, repeatScope: "total", repeatInterval: route.duration + repeatInterval } : {}),
  });
  if (index >= 0) stages.splice(index, 1, approach); else stages.push(approach);
  const echo = stages.find(stage => stage.kind === "sprite");
  if (echo) Object.assign(echo, { subject, copies: echoes, opacity, copySpread: .12, duration: 1500, fadeOut: 700 });
  else stages.unshift(copy("Departure silhouette", 0, { subject, copies: echoes, opacity, duration: 1500, fadeOut: 700 }));
  if (joint) stages.push(motion(route.motion, "targets", "Selected partner follows the same sample route", 180 + partnerDelay,
    route.duration, { ...route, targetSelection: "first", stopGap: .1 }));
  if (followStep || followSwim) stages.push(motion(followStep ? "dodge" : "rush", subject,
    followStep ? "Small Step after the Stride" : "Forward Swim after the dive", 0, followStep ? 1800 : 2500,
    { motionRange: "distance", distance: followStep ? .5 : 1.2, intensity: .25,
      motionArrival: 40, motionHold: 20, afterStage: approach.stageId, timingAnchor: "end", startOffset: 120 }));
  if (prone) stages.push(copy("Finite prone ending silhouette", 0, { subject,
    copies: 1, rotation: 90, opacity: .35, duration: 1500, fadeIn: 0, fadeOut: 650,
    afterStage: approach.stageId, timingAnchor: "arrival" }));
  if (reload) stages.push(cast("Reload cue after the leap", 0, 1500, { assets: feat.assets.reload ?? feat.assets.aura,
    scale: .55, afterStage: approach.stageId, timingAnchor: "end", startOffset: 120 }));
  if (contacts) stages.push(impact(contacts, contactBefore ? 100 : 0, 1500, {
    ...(contactBefore ? {} : { afterStage: approach.stageId, timingAnchor: "arrival", startOffset: 100 }),
    targetSelection: contactBefore ? "first" : "all", targetStagger: contactBefore ? 0 : 250,
    repeats: 1, scale: .9, opacity: .8,
  }));
  return review;
}
