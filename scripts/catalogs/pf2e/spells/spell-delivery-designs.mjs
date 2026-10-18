// Full native descriptions reviewed for initial delivery, later attacks,
// optional outcomes and heightened variants. No external macro code used.
const motif = (label, pattern, roots) => ({ label, pattern, ...roots });
export const DELIVERY_MOTIFS = {
  thrownSpear: motif("Hurled barbed spear", "missile", {
    cast: "glint",
    bolt: "javelin.01.throw,arrow",
    hit: "melee_generic.piercing,impact",
    aura: "glint",
  }),
  stoneMissile: motif("Launched stone lance", "missile", {
    cast: "glint",
    bolt: "spell_projectile.earth,arrow",
    hit: "side_impact,impact",
    aura: "particles",
  }),
  hurledStone: motif("Hurled stone and shattered rubble", "object", {
    cast: "glint",
    bolt: "boulder,throwable",
    hit: "side_impact,impact",
    aura: "ground_cracks",
  }),
  snowball: motif("Hurled dense snowball", "missile", {
    cast: "glint",
    bolt: "snowball_toss",
    hit: "impact_themed.ice,impact",
    aura: "swirling_sparkles",
  }),
  metalShot: motif("Launched metal fragment", "missile", {
    cast: "glint",
    bolt: "dart.01.throw,arrow.physical.white",
    hit: "melee_generic.piercing,impact",
    aura: "glint",
  }),
  seedShot: motif("Crimson seeds lodge in flesh", "missile", {
    cast: "swirling_leaves",
    bolt: "arrow.physical.red,arrow",
    hit: "liquid.splash.red,impact",
    aura: "plant_growth",
  }),
  voidDart: motif("Void dart leaves a dark mark", "missile", {
    cast: "cast_generic",
    bolt: "ranged_missile.001.purplered,magic_missile",
    hit: "impact_themed.darkness,impact",
    aura: "energy_field",
  }),
  spiritDart: motif("Spirit dart and contact nimbus", "missile", {
    cast: "cast_generic",
    bolt: "ranged_missile.001.pinkyellow,guiding_bolt",
    hit: "glint",
    aura: "glint",
  }),
  phaseMissile: motif("Flickering phase bolt", "missile", {
    cast: "shimmer",
    bolt: "ranged_missile.001.bluepurple,magic_missile",
    hit: "impact",
    aura: "shimmer",
  }),
  electricJavelin: motif(
    "Electrical javelin leaves a charged field",
    "missile",
    {
      cast: "static_electricity",
      bolt: "javelin.01.throw,arrow.lightning,lightning_bolt",
      hit: "static_electricity.03",
      aura: "static_electricity.01",
    },
  ),
  thunderArrows: motif("Arrow-shaped thunderbolts", "missile", {
    cast: "glint",
    bolt: "arrow.lightning,arrow.electric",
    hit: "static_electricity",
    aura: "soundwave",
  }),
  woodSplinters: motif("Flying wooden splinters", "needles", {
    cast: "swirling_leaves",
    bolt: "arrow.physical.green,arrow.physical",
    hit: "melee_generic.piercing,impact",
    aura: "swirling_leaves",
  }),
  boomerangShot: motif("Curved wood projectile", "missile", {
    cast: "swirling_leaves",
    bolt: "boomerang.01.white.01",
    hit: "side_impact,impact",
    aura: "swirling_leaves",
  }),
  spectralKnife: motif("Spectral blade thrown and returned", "armament", {
    cast: "glint",
    bolt: "spiritual_weapon.dagger,spiritual_weapon",
    hit: "melee_generic.slashing,impact",
    aura: "glint",
  }),
  burningGlob: motif("Viscous bubble catches fire", "movingGlob", {
    cast: "flames",
    bolt: "liquid.blob.orange,liquid.blob",
    hit: "flames",
    aura: "fireflies",
  }),
  soundBall: motif("Lobbed sound sphere and sonic contact", "movingGlob", {
    cast: "soundwave",
    bolt: "bubble",
    hit: "shatter",
    aura: "soundwave",
  }),
  windJet: motif("Slicing stream of air", "push", {
    cast: "wind_lines",
    bolt: "gust_of_wind,wind_stream",
    hit: "wind_lines,impact",
    aura: "wind_lines",
  }),
  localClaws: motif("Dragon claws appear beside foes", "localStrike", {
    cast: "cast_generic",
    hit: "claws",
    aura: "glint",
  }),
  localMaw: motif("Maw opens beneath target", "localStrike", {
    cast: "cast_generic",
    hit: "bite",
    aura: "healing_generic",
  }),
  divineWeaponFall: motif("Divine weapon manifests above foe", "spiritWeapon", {
    cast: "magic_signs.circle.01.divination",
    hit: "spiritual_weapon",
    aura: "soundwave",
  }),
  localShadow: motif("Target shadow rises and strikes", "localStrike", {
    cast: "smoke",
    hit: "arms_of_hadar",
    aura: "smoke",
  }),
  localVine: motif("Surface vine constricts foe", "tendrils", {
    cast: "swirling_leaves",
    hit: "entangle",
    aura: "swirling_leaves",
  }),
  fetters: motif("Ghostly bonds fly and clasp", "fetters", {
    cast: "glint",
    bolt: "energy_strands,energy_beam",
    hit: "energy_field",
    aura: "energy_field",
  }),
  electricalLasso: motif(
    "Electrical strands fly and crackle at contact",
    "electricLasso",
    {
      symbolic: true,
      cast: "static_electricity.01",
      bolt: "witch_bolt,energy_strands.range",
      hit: "static_electricity.03",
      aura: "lightning_orb",
    },
  ),
  arrowAreaVolley: motif(
    "Arrow salvo flies into the selected area",
    "areaVolley",
    {
      cast: "glint",
      bolt: "arrow.physical.white",
      hit: "ground_cracks",
      area: "smoke.puff",
    },
  ),
  boneRain: motif("Pale fragments rain beneath a bone cloud", "areaRain", {
    symbolic: true,
    cast: "glint",
    area: "fog_cloud",
    hit: "falling_rocks",
  }),
  forceRain: motif("Magic shards rain in the selected square", "areaRain", {
    symbolic: true,
    cast: "glint",
    area: "fog_cloud",
    hit: "falling_rocks",
  }),
  groundUpdraft: motif("Ground wind lifts and drops the target", "gravity", {
    cast: "wind_lines",
    hit: "whirlwind",
    aura: "whirlwind",
  }),
  earthSkyLift: motif("Caster lifts on a dragon-like gust", "flight", {
    cast: "wind_lines",
    hit: "whirlwind",
    aura: "whirlwind",
  }),
  fabricContact: motif("Fabric strike releases binding threads", "localBind", {
    symbolic: true,
    cast: "glint",
    hit: "energy_strands.complete",
    aura: "glint",
  }),
  fetchTether: motif("Telekinetic strands pull inward", "tetherPull", {
    cast: "glint",
    bolt: "energy_strands,energy_beam",
    hit: "glint",
    aura: "glint",
  }),
  shadowPull: motif("Dark tendril pulls toward caster", "tetherPull", {
    cast: "smoke",
    bolt: "energy_strands,energy_beam",
    hit: "arms_of_hadar",
    aura: "smoke",
  }),
  fallingLightning: motif("Lightning descends on target", "lightningFall", {
    cast: "static_electricity.01",
    hit: "lightning_strike",
    aura: "static_electricity.03",
  }),
  lightningCharge: motif(
    "Lightning strikes foe and charges caster",
    "drawLightning",
    {
      cast: "static_electricity.01",
      bolt: "energy_conduit,energy_beam",
      hit: "lightning_strike",
      aura: "static_electricity.03",
    },
  ),
  revitalizingStorm: motif(
    "Storm cloud and revitalizing lightning",
    "stormHeal",
    {
      cast: "glint",
      hit: "lightning_strike",
      aura: "healing_generic",
      area: "fog_cloud",
    },
  ),
  stormEnclosure: motif(
    "Clouds, wind and lightning encircle foe",
    "stormEnclosure",
    {
      cast: "static_electricity",
      hit: "whirlwind",
      aura: "static_electricity.03",
    },
  ),
  vitalitySeed: motif(
    "Seed embeds, drains outward and restores",
    "vitalitySeed",
    {
      cast: "swirling_leaves",
      bolt: "arrow.physical.green,arrow",
      hit: "energy_field",
      aura: "healing_generic",
    },
  ),
  frostPellet: motif("Ice pellet flies from frozen air", "missile", {
    cast: "ice_spikes.radial.loop",
    bolt: "snowball_toss",
    hit: "impact_themed.ice,impact",
    aura: "ice_spikes.radial.loop",
  }),
  telekineticTug: motif("Invisible power grips and tugs", "localTug", {
    cast: "glint",
    hit: "energy_field",
    aura: "glint",
  }),
  sonicWords: motif("Voice projects a directed sonic wave", "push", {
    cast: "music_notations",
    bolt: "energy_beam.normal.blue,energy_beam",
    hit: "soundwave",
    aura: "soundwave",
  }),
  rootedLightning: motif("Planted weapon arcs to foe", "chain", {
    cast: "static_electricity",
    bolt: "electric_arc",
    hit: "static_electricity",
    aura: "static_electricity",
  }),
  iceLodges: motif("Hollow icicle lodges without detonating", "missile", {
    cast: "glint",
    bolt: "spell_projectile.ice_shard,snowball_toss",
    hit: "glint",
    aura: "glint",
  }),
  combatLeap: motif("Elemental charge and melee contact", "combatLeap", {
    cast: "energy_field",
    hit: "impact",
    aura: "energy_field",
  }),
  stormTouch: motif("Crackling hand and electrical touch", "localStrike", {
    cast: "static_electricity",
    hit: "static_electricity.03",
    aura: "static_electricity.01",
  }),
  runeBlessing: motif("Fortune rune settles on weapon", "runes", {
    cast: "glint",
    hit: "magic_signs.circle.01.divination",
    aura: "glint",
  }),
  delayedBlast: motif("Element gathers at fist", "gatherOnly", {
    cast: "flames",
    hit: "flames",
    aura: "fireflies",
  }),
  delayedWater: motif("Water gathers at fist", "gatherOnly", {
    cast: "water_splash",
    hit: "liquid.blob.blue",
    aura: "water_splash",
  }),
  graspPortal: motif("Small portal snags weapon", "localTug", {
    cast: "portals",
    hit: "portals",
    aura: "glint",
  }),
  rangedShadow: motif("Illusory missile duplicate", "missile", {
    cast: "smoke",
    bolt: "magic_missile.grey,magic_missile",
    hit: "impact_themed.darkness,impact",
    aura: "smoke",
  }),
  burstDebris: motif("Debris lashes throughout the area", "areaDebris", {
    cast: "glint",
    area: "cloud_of_daggers,falling_rocks",
    hit: "side_impact,impact",
    aura: "particles",
  }),
  darkTeeth: motif("Shadow teeth gnaw inside darkness", "areaDarkness", {
    cast: "smoke",
    area: "darkness",
    hit: "bite",
    aura: "smoke",
  }),
  stormCloud: motif("Storm cloud and one localized bolt", "stormCloud", {
    cast: "static_electricity",
    area: "fog_cloud,smoke",
    hit: "lightning_strike",
    aura: "static_electricity",
  }),
  launchedBomb: motif(
    "Thrown container bursts into a toxic cloud",
    "areaMissile",
    {
      cast: "glint",
      bolt: "throwable,liquid.blob",
      area: "fumes",
      hit: "liquid.splash",
      aura: "fumes",
    },
  ),
  landscapeMissile: motif(
    "Large landscape fragment crashes into area",
    "areaMissile",
    {
      cast: "glint",
      bolt: "boulder",
      area: "eruption",
      hit: "ground_cracks",
      aura: "particles",
    },
  ),
  iceGround: motif("Icicle embeds and chills", "missile", {
    cast: "glint",
    bolt: "spell_projectile.ice_shard,snowball_toss",
    hit: "impact_themed.ice,glint",
    aura: "glint",
  }),
  splinterImpact: motif("Scrap shard strikes with a spirit echo", "missile", {
    cast: "glint",
    bolt: "dart.01.throw,arrow.physical.white",
    hit: "melee_generic.piercing,impact",
    aura: "glint",
  }),
  elementalChunk: motif("Chosen elemental chunk hurled", "object", {
    cast: "glint",
    bolt: "boulder,throwable",
    hit: "impact",
    aura: "particles",
    symbolic: true,
  }),
  lightningLine: motif("Lightning flashes through the line", "lineBeam", {
    cast: "static_electricity",
    area: "lightning_bolt.narrow",
  }),
  voidLine: motif("Weakening void beam", "lineBeam", {
    cast: "cast_generic",
    area: "energy_beam.normal.dark_purplered,energy_beam.normal",
  }),
  radiantLine: motif("Blinding light beam", "lineBeam", {
    cast: "glint",
    area: "energy_beam.normal.yellow,energy_beam.normal",
  }),
  frostRift: motif("Frigid crack along the line", "lineBeam", {
    cast: "glint",
    area: "template_line.ice,ice_spikes",
    symbolic: true,
  }),
  starLinks: motif("One burning starlight link", "lineBeam", {
    cast: "twinkling_stars",
    area: "energy_beam.normal.yellow",
    symbolic: true,
  }),
  rollingDisc: motif("Spinning bladed disc rolls forward", "lineFlight", {
    cast: "glint",
    area: "chakram,shield_attack.ranged.throw",
    symbolic: true,
  }),
  magmaRift: motif("Magma erupts along the fissure", "lineTiles", {
    cast: "ground_cracks",
    area: "eruption",
    symbolic: true,
  }),
  thrallSpear: motif("Bone spear from chosen thrall origin", "lineFlight", {
    cast: "glint",
    area: "spear.ranged,arrow.physical.white,arrow",
    symbolic: true,
  }),
  chromaticBarrier: motif("Colored wall of light", "lineBarrier", {
    cast: "glint",
    area: "energy_wall,wall_of_force",
    symbolic: true,
  }),
  icyFlurry: motif("Cold shard-laden gust", "lineBeam", {
    cast: "wind_lines",
    area: "template_line_piercing.ice,ray_of_frost",
    symbolic: true,
  }),
  icePath: motif("Ice appears beneath the path", "lineTiles", {
    cast: "glint",
    area: "ice_spikes",
    symbolic: true,
  }),
  darkTendrilsLine: motif("Dark tendrils race through air", "lineBeam", {
    cast: "arms_of_hadar.dark_purple",
    bolt: "energy_strands.range.standard.dark_purple02.01,energy_strands.range.standard.purple.01",
    area: "energy_strands.range.multiple.dark_purple02.01,energy_strands.range.multiple.purple.01",
    symbolic: true,
  }),
  windLine: motif("Wind blasts outward along line", "lineBeam", {
    cast: "wind_lines",
    area: "gust_of_wind,wind_stream",
  }),
  waterLine: motif("Water torrent batters the line", "lineBeam", {
    cast: "water_splash",
    area: "template_line.water,energy_beam.normal.blue",
    symbolic: true,
  }),
  radianceTorrent: motif(
    "Hands gather energy then release a torrent",
    "lineBeam",
    {
      cast: "cast_shape",
      area: "energy_beam.normal.yellow,energy_beam.normal",
    },
  ),
  rootedDrainLine: motif("Roots cascade and restore caster", "lineBeam", {
    cast: "swirling_leaves",
    area: "vine,energy_strands.green",
    aura: "healing_generic",
    symbolic: true,
  }),
  deathWaveLine: motif("Death energy travels outward", "lineBeam", {
    cast: "smoke",
    area: "energy_beam.normal.dark_purplered",
    symbolic: true,
  }),
  clearPath: motif("Dust settles along cleared ground", "lineTiles", {
    cast: "glint",
    area: "particles",
    symbolic: true,
  }),
  prismaticBarrier: motif("Multicolored barrier", "lineBarrier", {
    cast: "glint",
    area: "energy_wall,wall_of_force",
    symbolic: true,
  }),
  fallingScree: motif("Rocks cascade along the remote area", "lineTiles", {
    cast: "glint",
    area: "falling_rocks",
    symbolic: true,
  }),
  musicalBridge: motif("Notes sketch a translucent path", "lineTiles", {
    cast: "music_notations",
    area: "music_notations",
    symbolic: true,
  }),
  spiritTorrent: motif("Spiritual essence flows outward", "lineBeam", {
    cast: "cast_generic",
    area: "energy_beam.normal.yellow,energy_beam.normal",
    symbolic: true,
  }),
  rainbowPath: motif("Transparent rainbow spans the area", "lineBarrier", {
    cast: "twinkling_stars",
    area: "energy_wall,wall_of_force",
    symbolic: true,
  }),
  fallenTree: motif("Tree fall shown by scattered leaves", "lineTiles", {
    cast: "swirling_leaves",
    area: "swirling_leaves",
    symbolic: true,
  }),
  vortexLine: motif("Violent wind flows along line", "lineBeam", {
    cast: "wind_lines",
    area: "gust_of_wind,wind_stream",
  }),
  vectorBarrier: motif(
    "Telekinetic screen ripples across line",
    "lineBarrier",
    { cast: "glint", area: "wall_of_force,energy_wall" },
  ),
  ropeLash: motif("Animated rope lashes from caster", "localStrike", {
    cast: "vine",
    hit: "vine",
    aura: "glint",
    symbolic: true,
  }),
  wardStrike: motif("Nature animates inside the ward", "areaDebris", {
    cast: "swirling_leaves",
    area: "swirling_leaves",
    hit: "falling_rocks",
    aura: "swirling_leaves",
  }),
  thrallLaunch: motif("Thrall launch requires its own origin", "localTug", {
    cast: "smoke",
    hit: "energy_field",
    aura: "smoke",
    symbolic: true,
  }),
  thrallReanimate: motif(
    "Thrall enters corpse and reanimates it",
    "reanimate",
    {
      cast: "magic_signs.circle.01.necromancy",
      hit: "bone.return,energy_strands",
      aura: "smoke",
      symbolic: true,
    },
  ),
  stormForm: motif("Body becomes pure lightning", "form", {
    cast: "static_electricity",
    hit: "energy_field",
    aura: "lightning_orb",
  }),
  delayedSpit: motif(
    "Initial stomach morph and immediate acid spit",
    "movingGlob",
    {
      cast: "shimmer",
      bolt: "liquid.blob.brown,liquid.blob.green",
      hit: "liquid.splash",
      aura: "fumes",
    },
  ),
  foamShot: motif("Caustic foam spray clings to face", "movingGlob", {
    cast: "bubble",
    bolt: "liquid.blob.green",
    hit: "bubble",
    aura: "fumes",
  }),
  swellingAcid: motif("Growing acid glob lands in a puddle", "movingGlob", {
    cast: "fumes",
    bolt: "liquid.blob.green",
    hit: "liquid.splash.green",
    aura: "grease",
  }),
  toxicSpit: motif("Caustic saltwater spit scours wounds", "movingGlob", {
    cast: "water_splash",
    bolt: "liquid.blob.green",
    hit: "liquid.splash.green",
    aura: "fumes",
  }),
  launchedAir: motif("Air blast lifts caster", "push", {
    cast: "wind_lines",
    bolt: "gust_of_wind",
    hit: "wind_lines",
    aura: "wind_lines",
  }),
  wardedStorm: motif(
    "Force and lightning erupt around caster",
    "stormEnclosure",
    {
      cast: "static_electricity",
      hit: "energy_field",
      aura: "static_electricity",
    },
  ),
};
export const DELIVERY_DESIGNS = {
  "barbed-spear": [
    "thrownSpear",
    "A spear flies from caster and lodges at contact; its condition and removal stay with PF2e.",
  ],
  "exploding-earth": [
    "hurledStone",
    "A hard-packed earth ball travels, then shatters at target instead of opening the ground before flight.",
  ],
  "hurtling-stone": [
    "hurledStone",
    "A conjured stone is hurled; contact includes restrained cosmetic recoil.",
  ],
  "stone-lance": [
    "stoneMissile",
    "A jagged stone lance travels and lodges; a stone-colored missile stands in for the exact lance.",
  ],
  "glacial-skewer": [
    "iceGround",
    "A large ice spike flies and makes contact before a cosmetic push; actual forced movement remains manual.",
  ],
  snowball: [
    "snowball",
    "A dense snowball travels and bursts against its target.",
  ],
  "purifying-icicle": [
    "iceGround",
    "A life-infused icicle flies and lodges before melting; no ray or caster aura substitutes for flight.",
  ],
  "magnetic-acceleration": [
    "metalShot",
    "A nail-sized metal shot flies from caster; magnetic fields are casting accents.",
  ],
  "warshard-shot": [
    "splinterImpact",
    "A scrap shard flies to foe, followed by piercing contact and a spirit echo.",
  ],
  "charged-javelin": [
    "electricJavelin",
    "An electrical javelin flies and leaves a charged field after contact; Free uses an arrow silhouette.",
  ],
  "pierce-the-sky": [
    "thunderArrows",
    "One arrow-shaped thunderbolt per selected target; contact includes a sonic flash. Hazardous lines remain manual.",
  ],
  "blood-chestnuts": [
    "seedShot",
    "Crimson seeds fly and lodge. A tree is not shown immediately because growth is a later disease stage.",
  ],
  "doom-mark": [
    "voidDart",
    "A void dart strikes and leaves a dark mark. Sustained attacks are separate casts.",
  ],
  "vindicators-mark": [
    "spiritDart",
    "A magical dart travels before a brief nimbus cue. The mark is private in the rules; persistent visibility is not changed.",
  ],
  "phase-bolt": [
    "phaseMissile",
    "A magical missile flickers in flight, then pierces at contact.",
  ],
  "boomerang-shot": [
    "boomerangShot",
    "Curved wood flies toward the foe. It does not render a return that the spell never specifies.",
  ],
  "spectral-blade": [
    "spectralKnife",
    "A spectral blade flies out, makes contact and returns to caster.",
  ],
  "splinter-volley": [
    "woodSplinters",
    "A tightly grouped splinter volley flies to each chosen foe. Bleed remains outcome-dependent.",
  ],
  "sticky-fire": [
    "burningGlob",
    "A viscous bubble travels, sparks into flame at contact and leaves embers.",
  ],
  "percussive-impact": [
    "soundBall",
    "A compressed sphere of sound is lobbed before the impact shockwave.",
  ],
  "blinding-foam": [
    "foamShot",
    "A caustic liquid spray travels and clings around the face before fumes linger.",
  ],
  "disintegrating-puddle": [
    "swellingAcid",
    "A growing acid glob flies, splashes and leaves a short puddle cue.",
  ],
  "brine-dragon-bile": [
    "toxicSpit",
    "Caustic spit reaches the wounded target before acid residue appears.",
  ],
  "camel-spit": [
    "delayedSpit",
    "The initial morph is followed by its immediate spit attack; later spit attacks require another playback.",
  ],
  "crystallized-vapors": [
    "frostPellet",
    "An icy pellet flies on the initial cast; the surrounding difficult terrain is separate.",
  ],
  "elemental-toss": [
    "elementalChunk",
    "A chunk travels and strikes. Stone is a symbolic default; customize its element to the bloodline.",
  ],
  "flurry-of-claws": [
    "localClaws",
    "Claws appear beside two foes and slash locally; no claw missile or caster lunge.",
  ],
  "gluttons-jaws": [
    "localMaw",
    "A maw appears beneath foe and bites locally; no missile flies from caster.",
  ],
  "deitys-strike": [
    "divineWeaponFall",
    "A divine weapon manifests above foe and strikes locally. Its directional secondary shockwave needs separate placement.",
  ],
  "malicious-shadow": [
    "localShadow",
    "The target’s own shadow rises and strikes locally; it never flies from caster.",
  ],
  "murderous-vine": [
    "localVine",
    "A vine appears from an adjacent surface and constricts foe; it does not grow across the caster-to-target gap.",
  ],
  "magical-fetters": [
    "fetters",
    "Ghostly energy strands fly from hand and clasp at foe; no literal manacle art exists in JB2A.",
  ],
  "lightning-lasso": [
    "electricalLasso",
    "Electrical strands connect caster to foe, then crackle briefly at contact. JB2A strands approximate the thrown lasso; immobilized, restrained and later Sustain damage depend on the save and are not assumed.",
  ],
  "arrow-salvo": [
    "arrowAreaVolley",
    "Several complete arrow flights converge on the selected burst before dusty contacts. This illustrates a massive salvo; the literal giant bow and arrows scattered at every creature are not available in this base composition.",
  ],
  "calcium-rain": [
    "boneRain",
    "A pale cloud releases falling fragments into the selected burst. Falling rocks approximate tiny bone shards; persistent bleeding is not shown as an automatic outcome.",
  ],
  "force-rain": [
    "forceRain",
    "A purple cloud rains solidified fragments on the selected 5-foot square. Tinted falling fragments approximate magical shards; this base uses the one-action footprint. Customize area and homing cues for two or three actions.",
  ],
  updraft: [
    "groundUpdraft",
    "A ground whirlwind lifts the targeted creature and lets its artwork settle back. The cosmetic rise and fall does not move its document or assume prone on a successful save.",
  ],
  "earth-and-sky": [
    "earthSkyLift",
    "Wind gathers at caster, followed by a cosmetic upward lift and return. Nearby creatures are not lifted unconditionally; real altitude, falling damage and saves remain mechanical.",
  ],
  "home-among-mulberry-leaves": [
    "fabricContact",
    "A short fabric-Strike gesture is followed by a local burst of luminous threads at the foe. No ranged missile, automatic cocoon or save-dependent condition is assumed; thread artwork approximates qi fabric and needles.",
  ],
  friendfetch: [
    "fetchTether",
    "Telekinetic strands connect caster and willing targets; token artwork briefly leans inward and returns.",
  ],
  "shadow-strike": [
    "shadowPull",
    "A dark tendril connects caster and foe, then gives a restrained inward tug.",
  ],
  "sudden-bolt": [
    "fallingLightning",
    "One lightning bolt descends directly on target; it does not travel from caster.",
  ],
  "draw-the-lightning": [
    "lightningCharge",
    "Lightning descends through foe, then returns charge to caster with a weapon/body glow.",
  ],
  "shock-to-the-system": [
    "revitalizingStorm",
    "A cloud surrounds target before a revitalizing lightning jolt and healing bloom.",
  ],
  "tempest-surge": [
    "stormEnclosure",
    "Wind, cloud and static swirl around target rather than showing a horizontal missile.",
  ],
  "vital-seed": [
    "vitalitySeed",
    "A seed embeds, void energy radiates outward, then vitality returns. The healing amount stays with PF2e.",
  ],
  "telekinetic-maneuver": [
    "telekineticTug",
    "Invisible force grips target and gives a restrained cosmetic tug; selected maneuver resolves separately.",
  ],
  "shadow-projectile": [
    "rangedShadow",
    "A translucent missile duplicate flies to the triggering target; exact original projectile requires customization.",
  ],
  "slashing-gust": [
    "windJet",
    "Directed air ripples fly from caster and slice each chosen target.",
  ],
  "biting-words": [
    "sonicWords",
    "The voice sends a directed sonic wave before localized contact; later attacks are separate playbacks.",
  ],
  "propelling-air-stream": [
    "launchedAir",
    "A directed air blast strikes foe and briefly lifts caster artwork, then restores its pose.",
  ],
  "for-love-for-lightning": [
    "rootedLightning",
    "A planted weapon crackles before an arc strikes the selected foe; later Sustain arcs play separately.",
  ],
  "winter-bolt": [
    "iceLodges",
    "A hollow icicle flies and lodges. Its explosion happens at the end of the target’s next turn and is not part of the initial cast.",
  ],
  "comet-charge": [
    "combatLeap",
    "Caster artwork lunges into a melee contact and returns. The chosen element and actual 120-foot movement require PF2e/manual resolution.",
  ],
  "shocking-grasp": [
    "stormTouch",
    "Crackling hands touch target with local electrical contact; there is no ranged bolt.",
  ],
  "siege-weapons-blessing": [
    "runeBlessing",
    "A fortune rune settles on the siege weapon; no attacking weapon flourish or caster lunge.",
  ],
  "aqueous-blast": [
    "delayedWater",
    "Water gathers around the fist on casting. The later one-action blast is separate and should be configured as another recipe.",
  ],
  "scorching-blast": [
    "delayedBlast",
    "Fire gathers around the fist on casting. The later one-action blast is separate and should be configured as another recipe.",
  ],
  "vanish-weapon": [
    "graspPortal",
    "A small local portal snags the triggering weapon; no projectile flies across the scene.",
  ],
  "animated-assault": [
    "burstDebris",
    "Objects hover and lash throughout the selected area; debris is an approximation for arbitrary scenery objects.",
  ],
  "ravenous-darkness": [
    "darkTeeth",
    "Darkness fills the selected burst and teeth bite inside it; attack metadata does not imply caster missiles.",
  ],
  "lightning-storm": [
    "stormCloud",
    "A storm cloud forms over the area and one bolt strikes its center as a sample; actual chosen bolt placement remains manual.",
  ],
  "blister-bomb": [
    "launchedBomb",
    "A small enchanted container travels to the selected burst, then releases diseased fumes.",
  ],
  "blinding-bottle": [
    "launchedBomb",
    "A conjured bottle travels to the selected burst, then releases a sight-stealing toxin.",
  ],
  "telekinetic-bombardment": [
    "landscapeMissile",
    "A landscape fragment flies to the selected burst before crashing into rubble; the alternate remote line needs customization.",
  ],
  "lightning-bolt": [
    "lightningLine",
    "Lightning flashes outward from hand along the selected line.",
  ],
  enervation: [
    "voidLine",
    "A void beam extends from finger along the selected line.",
  ],
  "radiant-beam": [
    "radiantLine",
    "Blinding light extends along the selected line; saves and dazzled conditions remain with PF2e.",
  ],
  "arctic-rift": [
    "frostRift",
    "Ice cues appear along the selected rift. JB2A has no literal jagged air crack; freezing is outcome-dependent.",
  ],
  asterism: [
    "starLinks",
    "One selected line previews one starlight link. Five connected lines and breaking links require separate native placements.",
  ],
  "beheading-buzz-saw": [
    "rollingDisc",
    "A spinning disc travels along the selected line, not a fire breath. Shield/disc footage approximates the saw; no decapitation is shown before saves.",
  ],
  "blazing-fissure": [
    "magmaRift",
    "Eruptions appear along the selected ground line and fade. Native terrain and prone outcomes remain mechanical.",
  ],
  "bone-spear": [
    "thrallSpear",
    "A pale piercing projectile follows the selected line from the thrall's former space. Place that origin manually; the caster is not the origin.",
  ],
  "chromatic-wall": [
    "chromaticBarrier",
    "A light barrier follows the selected remote line. Purple is a symbolic default; customize to the rolled color.",
  ],
  "frigid-flurry": [
    "icyFlurry",
    "A cold gust follows the line, with a brief caster shimmer. Jagged shards and actual travel to the endpoint require customization/PF2e movement.",
  ],
  "glacial-causeway": [
    "icePath",
    "Ice cues appear beneath the selected path. They are a symbolic path, not damaging cold missiles or automatic terrain changes.",
  ],
  "grim-tendrils": [
    "darkTendrilsLine",
    "Dark curling strands travel along the native line, followed by a winding strand. The source curl is brief; bleed depends on saves.",
  ],
  "gust-of-wind": [
    "windLine",
    "Wind extends from the selected origin to the far end; only cosmetic caster recoil is used, because forced movement depends on saves.",
  ],
  "hydraulic-torrent": [
    "waterLine",
    "Water-colored streaming footage follows the selected line. Free uses a blue energy stream where native water footage is unavailable.",
  ],
  "inner-radiance-torrent": [
    "radianceTorrent",
    "Hands gather light before a directed torrent. Base preview uses the two-action 60-foot line; longer casting and shining state need customization.",
  ],
  "life-draining-roots": [
    "rootedDrainLine",
    "Root-like strands reach along the line, then caster receives a vitality bloom. Temporary Hit Points remain PF2e-managed.",
  ],
  massacre: [
    "deathWaveLine",
    "Death energy flows outward. The reverse wave only happens if nobody is killed, so it is not played unconditionally.",
  ],
  "pave-ground": [
    "clearPath",
    "Dust clears along the selected ground line; no explosion, attack or forced movement is invented. Terrain changes remain manual.",
  ],
  "prismatic-wall": [
    "prismaticBarrier",
    "Seven colored light strips approximate the layered wall; native wall placement, vertical extent and counteracting remain manual.",
  ],
  "scatter-scree": [
    "fallingScree",
    "Rocks appear along the selected remote line, not from caster. Terrain persists mechanically; the visual preview is temporary.",
  ],
  "sonata-span": [
    "musicalBridge",
    "Musical notes sketch the selected path. JB2A provides no literal load-bearing bridge; elevation and bridge mechanics remain manual.",
  ],
  "spiritual-torrent": [
    "spiritTorrent",
    "Spiritual energy follows the base two-action line. Customize vitality/void color to caster and use another recipe for the three-action cone.",
  ],
  "the-queens-rainbow": [
    "rainbowPath",
    "Seven colored light strips approximate the transparent rainbow. No creature condition is applied visually before saves.",
  ],
  timber: [
    "fallenTree",
    "Leaf cues mark the falling tree's line; JB2A lacks a literal dead-tree fall. No unrelated stone or fire missile is shown.",
  ],
  "tornadic-gale": [
    "vortexLine",
    "Wind flows from caster along the line. Pull, push and prone depend on creature sizes and saves; token documents are unchanged.",
  ],
  "vector-screen": [
    "vectorBarrier",
    "A transparent energy barrier spans the selected remote line. It does not fire ammunition at creatures.",
  ],
  "lashing-rope": [
    "ropeLash",
    "Rope surrounds caster and lashes locally; vine art is symbolic and its object choice stays manual.",
  ],
  "establish-ward": [
    "wardStrike",
    "Natural features animate inside the selected ward; the initial attack is local to that area.",
  ],
  "dead-weight": [
    "thrallLaunch",
    "The thrall must be chosen as animation source to show its jump. Initial cue remains local instead of inventing a caster missile.",
  ],
  "reanimate-foe": [
    "thrallReanimate",
    "Reanimation energy resolves at the selected corpse; the launching thrall’s separate origin and actor creation need manual handling.",
  ],
  "living-thunderbolt": [
    "stormForm",
    "Body changes into lightning before gaining flight; later pass-through damage is separate.",
  ],
  "wronged-monks-wrath": [
    "wardedStorm",
    "Force and electrical energy erupt around caster as a cosmetic emanation cue.",
  ],
};
export const REVIEWED_DELIVERY = {
  "deitys-strike": "target",
  "flurry-of-claws": "target",
  "gluttons-jaws": "target",
  "malicious-shadow": "target",
  "murderous-vine": "target",
  "magical-fetters": "bolt",
  "lightning-lasso": "bolt",
  "force-rain": "burst",
  "home-among-mulberry-leaves": "melee",
  friendfetch: "bolt",
  "shadow-projectile": "bolt",
  "blood-chestnuts": "bolt",
  "for-love-for-lightning": "bolt",
  "telekinetic-maneuver": "target",
  "aqueous-blast": "self",
  "scorching-blast": "self",
  "lashing-rope": "melee",
  "vanish-weapon": "melee",
  "ravenous-darkness": "burst",
  "establish-ward": "burst",
};
