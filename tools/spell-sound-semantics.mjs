import { descriptionText, descriptionOpening, nativeSpellDescription } from "./spell-semantics.mjs";
import { BROAD_VARIETY_MOTIFS } from '../scripts/catalogs/pf2e/spells/spell-broad-variety-designs.mjs';
// Reviewed complete utility descriptions. A visual illustration is not evidence
// of a sonic event, a resolved save, a selected material, or somebody's voice.
const utilityQuietReasons = Object.fromEntries([
  ["perilForesight constellationGuide nearFocus patronSecrets familiarSensor corpseJourney fateNudge objectExpertise objectPsychometry practicedCorrection sharedEyes languageMeaning weaknessInsight psychicImprint", "Private perception, thought, expertise or comprehension changes; no public voices, ray impacts or discovery noises are inferred."],
  ["loadBearing sightOcclusion hearingMute enduringMind geckoPurchase companionHide physiqueBoost gratitudeVitality environmentalAdaptation biologicalDisarray voiceQuiet timeWeariness", "Bodily support, temporary vitality, sensory loss or internal discomfort; no healing, injury, growl or sonic blast is inferred."],
  ["odorErase alluringMusk", "Olfactory change only; scent removal or attraction does not create an audible mist, animal swarm or attack."],
  ["tinySigil timedSigil companionWatch", "A small mark or watch condition is set now; later timer flashes, alarms and ending teleport are not played during casting."],
  ["diabolicTask escapeCommand gossipInsight", "Words, command or information are supplied by the player or GM; no prerecorded voice, answer, creature squawk or successful escape is assumed."],
  ["edibleObject cuisineCleanse companionGroom garmentRestyle suddenMeal corpseDecay preservedCorpse weaponOverlays", "Material appearance, cleanliness, nourishment or preservation changes; no wound healing, vomiting, fire, attack or noisy repair process is assumed."],
  ["animatedRope currentLink objectFloat mouthPocket glitterTrail floatingHarness inertiaAnchor heldItemFuse paintedSensor objectSorting movementPair tetherConnection eidolonUnfetter friendlyPropulsion curseTransfer", "Quiet support, a connection or a player-chosen object operation; no metal chain clank, selected object material, future movement or success sound is inferred."],
  ["flutterDecoy elementalWeakness genieVanish brinyFaceTendril mistPiercing", "The stated visual or selected-element illustration does not establish an audible strike, animal voice, explosion or large splash; optional sound remains customizable."],
].flatMap(([motifs, reason]) => motifs.split(" ").map(motif => [motif, reason])));
// Rules read the full native description. Traits alone never imply an explosion,
// animal voice, gunshot or spoken incantation. Uncertain utility spells stay quiet.
export function soundDirection(spell, source) {
  const description = nativeSpellDescription(source);
  const text = descriptionText(description);
  const opening = descriptionOpening(description);
  const name = spell.name.toLowerCase(),
    motif = spell.design?.motif ?? "";
  const choose = (profile, reason) => ({
    profile,
    reason,
    descriptionChars: text.length,
  });
  if (!text)
    return choose("", "No source description; no automatic sound inferred.");
  if (Object.hasOwn(AUDIBLE_OVERRIDES, spell.slug))
    return choose(AUDIBLE_OVERRIDES[spell.slug][0], 'Reviewed: ' + AUDIBLE_OVERRIDES[spell.slug][1]);
  const reviewedFire={
    fireDrought:'',fireDehydrate:'',fireDust:'',fireFog:'',fireAshes:'',fireRedistribute:'',
    fireBlossoms:'fireIgnition',fireWildfire:'fireIgnition',fireDivine:'holy',fireSunBlade:'radiantRay',
    fireRayGround:'fireRay',fireGeyser:'water',fireBile:'earth',firePlasma:'fireCone',fireRejuvenating:'fireCone',
    fireBarrage:'fireball',fireFireworkBlast:'explosion',fireIgniteFireworks:'sonic',fireSkyrocket:'sonic',
    fireCataclysm:'earthquake',fireConfluence:'summon',fireDouble:'fireIgnition',fireTruth:'fire',fireWhirling:'fireCone',fireFumarole:'fireIgnition',
  };
  if(Object.hasOwn(reviewedFire,motif))
    return choose(reviewedFire[motif], 'Reviewed native fire-spell casting event; deferred ignition, internal heat and unresolved choices do not play explosion audio.');
  if (['solarSensitivity','secretRevelation','betrayalVision','ambitionIsolation','doomForecast','mentalContingency','defensiveTerrorMask','fatedWeapon','ownDeathVision','privateNightmare'].includes(motif))
    return choose('', 'Private perception, belief, a spoken secret or a prepared contingency; symbolic public artwork does not establish an audible fear or damage event.');
  // Composition spells are performances by definition (bard muse, instrument or
  // voice). A mimed wall and a performance-preparing buff stay quiet.
  if (spell.traits.includes('composition') && !['house-of-imaginary-walls','fortissimo-composition'].includes(spell.slug))
    return choose('song', 'Composition spell: the caster performs aloud; short musical flourish follows the cast.');
  if (motif==='confidenceSiphon')
    return choose('drain','Confidence is inhaled from the victim; a finite energy draw follows the returning strand. Save-dependent healing is not played.');
  if (BROAD_VARIETY_MOTIFS[motif]) {
    const reviewedProfiles = {
      broadDevourLife:['drain','Life is drawn from victim toward caster; no healing of the victim is inferred.'],
      broadVitalHeal:['healing','Immediate restoration of living targets; native undead use remains system context.'],
      broadAnimalHeal:['natureHeal','Immediate natural restoration of an animal; no creature voice is inferred.'],
      broadCompanionHeal:['natureHeal','Immediate natural restoration of an animal companion.'],
      broadStardustHeal:['healing','Finite starlit restoration, without claiming that later light effects have resolved.'],
      broadFamiliarReturn:['revive','Return of the familiar at one Hit Point; finite return cue, without general full healing.'],
      broadRevival:['revive','Finite return/restoration illustration; native living or dead target distinction remains unresolved.'],
      broadDeathIntercede:['healing','An immediate life spark intervenes against death; no general resurrection sound.'],
      broadLaughter:['laughter','Involuntary laughter is explicitly described.'],
      broadApplause:['applause','Audible cheers and applause are explicitly described.'],
    };
    const selected = reviewedProfiles[motif]
      ?? (/^broadSummon/.test(motif) ? ['summon','Summoning arrival; creature species remains player choice.']
      : /Form$/.test(motif) && spell.traits.includes('polymorph') ? ['transform','Brief transformation cue; no assumed creature voice.']
      : spell.traits.includes('teleportation') ? ['teleport','Spatial departure/arrival; short teleport cue.'] : null);
    return selected ? choose(...selected) : choose('', 'Reviewed private perception, prepared benefit, support, cleansing, object or casting-only illustration. No wound restoration, chosen voice/material, future impact or successful outcome is inferred; audio remains customizable.');
  }
  const reviewedQuiet = {
    "boots-on-the-ground": "Complete description forbids intelligible sounds such as music; no musical flourish is inferred for the illusory troops.",
    "canticle-of-everlasting-grief": "The melody is explicitly audible only to its target. Automatic public audio would expose a private manifestation; choose a private cue manually if desired.",
    "enthrall": "Caster may speak or sing. Words and performance are player chosen; no lute, prerecorded speech, or mandatory music is inferred.",
    "fortissimo-composition": "This preparation improves the next composition, rather than performing that composition now; its later music receives no premature cue.",
    "fold-metal": "An object is magically reshaped; no anvil strike, hammering, or impact is described.",
    "precious-metals": "Metal is transmuted into a selected material. No hammering, impact, or injury happens during this buff.",
    "serrate": "The weapon's surface twists into jagged edges; this buff does not itself make a Strike or ring an anvil.",
    "field-of-razors": "Metal dust becomes a barbed area. Its movement-triggered damage occurs later; no immediate anvil blow is inferred.",
    "rust-cloud": "Rust particles form a cloud. Metal corrosion and damage occur later; no immediate metal-contact blow is inferred.",
    "steel-fortifications": "Metal structures appear in empty squares. No impact or breakage occurs until later damage; no anvil strike is inferred.",
    "wall-of-metal": "An unbroken metal wall is conjured in empty space. No metal collision or later breakage is inferred at formation.",
  };
  if (reviewedQuiet[spell.slug]) return choose("", reviewedQuiet[spell.slug]);
  if (
    spell.traits.includes("subtle") ||
    /^(silence|quiet|message|dream message|embed message|imprint message|message rune)$/i.test(
      name,
    ) ||
    ["silenceField", "whisper"].includes(motif)
  )
    return choose(
      "",
      "Silent, subtle or private communication; no public sound cue.",
    );
  if (
    name === "ghost sound" ||
    /sculpt sound|ventriloquis|sound of silence/.test(name)
  )
    return choose(
      "",
      "Player chooses the sound or silence; choose an audio file in Customize.",
    );
  if (motif === "summonFortitude")
    return choose("transform", "Complete description transforms and fortifies an existing summoned ally's body; finite transformation cue, not another summoning arrival or creature voice.");
  if (motif === "healerPromise")
    return choose("bless", "Words bless the recipient for later vitality healing; beneficial blessing cue, with no immediate restoration or Hit Point gain assumed.");
  if (motif === "retrievingHook")
    return choose("objectWhoosh", "A magical hook and rope explicitly hurtle toward the target; neutral object-flight cue follows extension, with no metal-chain clank, impact or save result assumed.");
  if (motif === "companionPocket")
    return choose("pocketTransition", "Companion is drawn into an extradimensional pocket; finite spatial departure follows the target pocket entrance, without playing spell-end reappearance.");
  if (utilityQuietReasons[motif])
    return choose("", utilityQuietReasons[motif]);
  if (motif === "coneStarFan")
    return choose("starFlight", "Tiny shooting stars spread through a cone; light-particle shimmer follows their flight release. Fire damage does not turn the described stars into a flame blast or late dazzling impact.");
  if (spell.slug === "metal-reverberation")
    return choose("metalResonance", "The full description explicitly strikes a tuning fork and repeats its resonant note; a brief chime replaces an unrelated anvil smash.");
  if (spell.slug === "restraining-chains")
    return choose("chainBinding", "A steel chain weaves around the target and pulls on it; a finite moving-chain cue follows formation, without another physical Strike.");
  if (["needles", "metalShot", "fixMetalNeedles", "fixMetalShot"].includes(motif))
    return choose("metalProjectile", "Metal needles or a small metal object fly toward the target. A neutral flight cue follows release; metal contact follows the landing sample, rather than an anvil sound during casting.");
  if (name === "roar of the dragon")
    return choose(
      "dragonRoar",
      "Description explicitly channels a dragon roar.",
    );
  if (name === "roaring applause")
    return choose(
      "applause",
      "Description calls for cheering and applause, not an animal roar.",
    );
  if (/hideous laughter|laughing fit/.test(name))
    return choose("laughter", "Involuntary laughter described by spell.");
  if (/dispel magic|counterspell/.test(name) || motif === "dispel")
    return choose("dispel", "Magic is unraveled rather than detonated.");
  if (["guidedInsight", "mentalParalysis", "mentalConfusion", "compelledDance", "castingRush"].includes(motif))
    return choose("", "Guidance, altered thought or compelled movement does not itself establish an audible manifestation; no extra voices or music are inferred.");
  if (["mistVeil", "boilingBlood"].includes(motif))
    return choose("", "Quiet mist or internal heating does not imply an external splash, flame detonation or bodily injury sound.");
  if (motif === "ashVeil")
    return choose("wind", "Ash drifts in a cloud or swirling wind; finite air movement follows formation, without a fire explosion or assumed cough.");
  if (motif === "flamingArmory")
    return choose("fireIgnition", "A flaming weapon materializes as a buff; ignition follows formation, without weapon-contact audio before an attack.");
  if (motif === "waterVortex")
    return choose("water", "Churning waves form a watery vortex; finite water surge, without assuming an injury outcome.");
  if (motif === "windVortex" && name !== "cyclone rondo")
    return choose("wind", "A cyclone or tornado forms; finite wind cue follows formation.");
  if (
    /time jump|time beacon|time stop|temporal|slow|haste/.test(name) ||
    ["time", "timeRipple"].includes(motif)
  )
    return choose(
      /slow/.test(name) ? "slow" : "time",
      "Time alteration uses a short temporal cue.",
    );
  if (/unlock|knock/.test(name))
    return choose("unlock", "Lock opens; mechanical unlock cue.");
  if (/mending|repair|make whole/.test(name))
    return choose("mending", "Repair and restoration of an object.");
  if (/detect magic|read aura/.test(name))
    return choose("detect", "Brief magical detection cue.");
  if (
    ["portal", "teleport", "blink", "dimensionDoor", "teleportStrike"].includes(motif) ||
    /\b(teleport|translocate|dimensional|dimension door|blink)\b/.test(name)
  )
    return choose("teleport", "Spatial departure/arrival; short teleport cue.");
  if (/fireball|delayed blast/.test(name))
    return choose(
      "fireball",
      "Fire gathers, then detonates in a roaring area blast.",
    );
  if (/force barrage|magic missile/.test(name))
    return choose(
      "forceMissile",
      "Homing force missiles; missile release cue.",
    );
  if (/chain lightning/.test(name))
    return choose(
      "chainLightning",
      "Short electric discharge follows each target-to-target hop.",
    );
  if (/lightning bolt|lightning storm/.test(name) || ["fallingLightning","thunderFall","lightningCharge","stormSky","thunderArrows","rootedLightning"].includes(motif))
    return choose(
      "lightningBolt",
      "Lightning discharge, with a separate thunderous impact.",
    );
  if (motif === "energyRay")
    return choose(
      "forceRay",
      "Description states a ray of energy; bludgeoning damage does not imply rocks.",
    );
  if (["prismaticRay", "divineRay"].includes(motif))
    return choose(
      "radiantRay",
      "A luminous ray uses a directional magical-energy cue.",
    );
  if (["lunarRay", "moonRay"].includes(motif))
    return choose(
      "moonRay",
      "Moonlight beam uses a lunar shimmer, not fire audio inferred from damage type.",
    );
  if (motif === "darkRay")
    return choose(
      "darkRay",
      "Sickening or dark energy ray uses a dark release cue, not an explosion.",
    );
  if (motif === "toxicRay")
    return choose(
      "poisonRay",
      "Toxic-spore ray uses a poison release; no corrosive-acid substitution.",
    );
  if (/scorching ray|blazing bolt/.test(name) || motif === "flameRay")
    return choose(
      "fireRay",
      "Directional fire ray; beam cue rather than explosion.",
    );
  if (/ray of frost/.test(name) || motif === "icyRay")
    return choose(
      "coldRay",
      "Directed freezing ray; dedicated frost-ray audio.",
    );
  if (/cone of cold/.test(name))
    return choose("coldCone", "Broad freezing cone; sustained rush of cold.");
  if (/burning hands|breathe fire/.test(name))
    return choose(
      "fireCone",
      "A fan of flame rather than a projectile impact.",
    );
  if (/shocking grasp/.test(name))
    return choose(
      "electricTouch",
      "Contact electricity; short crackling shock.",
    );
  if (/acid splash/.test(name))
    return choose(
      "acidSplash",
      "Small acid splash; no poison-labelled substitute.",
    );
  if (
    (spell.traits.includes("healing") && !spell.traits.includes("void") &&
    /\bheal\b|\bhealing\b|\brestore hit points\b|\bregain.{0,30}hit points/.test(
      opening.toLowerCase(),
    )) ||
    ["healing", "healBurst", "regeneration"].includes(motif)
  )
    return choose(
      spell.theme === "water"
        ? "waterHeal"
        : spell.theme === "plant"
          ? "natureHeal"
          : "healing",
      "Description restores health; gentle restorative cue.",
    );
  if (/reviv|resurrect|raise dead/.test(name))
    return choose("revive", "Return to life uses a resurrection cue.");
  if (
    /\bshield\b|\bward\b|\bbarrier\b/.test(name) ||
    ["shield", "forceShield", "protect", "ward"].includes(motif)
  )
    return choose("shield", "Protective field; short ward activation.");
  if (/\bbless\b|heroism|courage/.test(name))
    return choose("bless", "Encouragement or blessing; gentle beneficial cue.");
  if (
    /entangle|tangle|root|bramble|thorn/.test(name) ||
    ["entangle", "vines", "rootSnare"].includes(motif)
  )
    return choose(
      /wall/.test(name) ? "thornWall" : "vines",
      "Growing roots or vines; organic growth cue.",
    );
  if (/plant growth|verdant|timber|wood/.test(name) && spell.theme === "plant")
    return choose("growth", "Plant growth or wood formation.");
  if (
    /\bswarm\b|\bbugs\b|\binsect/.test(opening.toLowerCase()) &&
    spell.theme === "plant"
  )
    return choose("swarm", "Audible insects explicitly described.");
  if (/earthquake|seismic|\bquake\b|upheaval|heaving earth/.test(name))
    return choose("earthquake", "Ground shaking uses a short seismic rumble.");
  if (/wall of stone|stone wall/.test(name))
    return choose("stoneWall", "Stone structure rises into place.");
  if (/wall of ice|ice wall/.test(name))
    return choose("iceWall", "Ice structure forms and cracks.");
  if (/wall of fire|flame pillar/.test(name))
    return choose(
      "fireWall",
      "Rising flame, rather than a travelling fireball.",
    );
  if ((/\b(light|lights|illuminate)\b/.test(name) || spell.theme === "light") && !spell.traits.includes("darkness"))
    return choose("light", "Light appears with a brief shimmer.");
  if (/\bsleep\b|slumber/.test(name))
    return choose("sleep", "Sleep magic uses a soft dream cue.");
  if (/\bfear\b|\bhorrif/.test(name) || ["fear", "dread"].includes(motif))
    return choose(
      "fear",
      "Fear effect uses a short ominous cue, without creature injury sounds.",
    );
  if (/siphon|drain|vampiric/.test(name) || motif === "drain")
    return choose("drain", "Life or energy is drawn away; siphon cue.");
  if (
    /musical|melody|music|\bsong\b/.test(opening.toLowerCase()) &&
    (spell.traits.includes("auditory") || motif === "song")
  )
    return choose(
      "song",
      "Description explicitly calls for music; short musical flourish.",
    );
  if (spell.delivery === "portal")
    return choose("teleport", "Spatial departure/arrival; short teleport cue.");
  if (spell.delivery === "summon" || /\bsummon\b/.test(name))
    return choose(
      "summon",
      "Summoning arrival; creature species remains player choice.",
    );
  if (spell.delivery === "transform" || motif === "form")
    return choose(
      "transform",
      "Brief transformation cue; no assumed animal voice.",
    );
  // Damage and visible material effects provide safer family cues than school.
  const theme = {
    fire: "fire",
    cold: "cold",
    electricity: "electric",
    acid: "acid",
    poison: "poison",
    water: "water",
    wind: "wind",
    earth: "earth",
    metal: "metal",
    plant: "growth",
    sonic: "sonic",
    force: "force",
    void: "void",
    shadow: "shadow",
    healing: "healing",
    vitality: "holy",
    holy: "holy",
  }[spell.theme];
  if (motif === "restore")
    return choose(
      "healing",
      "Restoration or cleansing uses a gentle restorative cue.",
    );
  if (spell.traits.includes("auditory") && /\b(scream\w*|shriek\w*|wail\w*|howl\w*)\b/.test(opening.toLowerCase()))
    return choose("scream", "Auditory spell whose opening is a scream, wail or howl.");
  if (motif === "mentalJolt" && /\b(damage|pain|jolt|psychic)\b/i.test(opening))
    return choose(
      "psychic",
      "Psychic attack uses a short mental pulse, without spoken voices.",
    );
  if (spell.theme === "time")
    return choose("time", "Temporal effect uses a short time-shift cue.");
  if (spell.theme === "teleport")
    return choose(
      "teleport",
      "Spatial effect uses a short departure/arrival cue.",
    );
  if (
    motif === "swarm" &&
    /\b(insects?|bugs?|beetles?|flies|wasps?)\b/i.test(opening)
  )
    return choose("swarm", "Description explicitly evokes buzzing insects.");
  if (
    theme &&
    (spell.design?.damageDice ||
      /\b(damage|blast|burst|erupt\w*|flames?|freez\w*|surge|splash|stone|ice|wind|growth|energy|water|roots?|thorns?)\b/i.test(
        opening,
      ))
  )
    return choose(
      theme,
      `Description and ${spell.theme} treatment support a ${theme} effect cue.`,
    );
  const audible = audibleFallback(spell, source, text, opening);
  if (audible) return choose(...audible);
  if (spell.traits.includes("incarnate"))
    return choose("summon", "Incarnate spell conjures a being; arrival cue.");
  return choose(
    "",
    "No unambiguous audible effect in description; quiet by default.",
  );
}
// Reviewed per-spell exceptions for the audible fallback ('' keeps the spell quiet).
const AUDIBLE_OVERRIDES = {
  'arcane-explosion': ['explosion', 'A meteor, eruption or arcane detonation of great size; a full explosion, not a small energy cue.'],
  'detonate-magic': ['explosion', 'A meteor, eruption or arcane detonation of great size; a full explosion, not a small energy cue.'],
  'falling-stars': ['explosion', 'A meteor, eruption or arcane detonation of great size; a full explosion, not a small energy cue.'],
  'metallic-meteorite-glyph': ['explosion', 'A meteor, eruption or arcane detonation of great size; a full explosion, not a small energy cue.'],
  'sunburst': ['explosion', 'A meteor, eruption or arcane detonation of great size; a full explosion, not a small energy cue.'],
  'planar-collision': ['explosion', 'A meteor, eruption or arcane detonation of great size; a full explosion, not a small energy cue.'],
  'divine-armageddon': ['divineWrath', 'A divine cataclysm of void and spirit; divine wrath, never a healing chime.'],
  'blood-feasting-breath': ['drain', 'Life is drawn out of the target; an energy siphon.'],
  'trade-death-for-life': ['drain', 'Life is drawn out of the target; an energy siphon.'],
  'draw-blood': ['drain', 'Life is drawn out of the target; an energy siphon.'],
  'consecrate-flesh': ['holy', 'Sanctified flesh; a holy cue, not healing.'],
  'phantom-orchestra': ['song', 'An invisible orchestra plays.'],
  'thunderburst': ['sonic', 'A peal, blast or ear-piercing sound is described.'],
  'disorienting-flash': ['sonic', 'A peal, blast or ear-piercing sound is described.'],
  'booming-blast': ['sonic', 'A peal, blast or ear-piercing sound is described.'],
  'voice-on-the-breeze': ['', 'Nothing audible is described: a message, a reading, a sense or a stored memory.'],
  'bee-mans-summons': ['', 'Nothing audible is described: a message, a reading, a sense or a stored memory.'],
  'root-reading': ['', 'Nothing audible is described: a message, a reading, a sense or a stored memory.'],
  'entangle-fate': ['', 'Nothing audible is described: a message, a reading, a sense or a stored memory.'],
  'untwisting-iron-roots': ['earth', 'Earth or stone heaves; no plant involved.'],
  'engrave-memory': ['', 'Nothing audible is described: a message, a reading, a sense or a stored memory.'],
  'dim-the-light': ['shadow', 'Light is dimmed into darkness.'],
  'blade-barrier': ['force', 'A churning wall of force blades, not a protective ward.'],
  'patrons-protector': ['transform', 'The familiar changes form.'],
  'living-thunderbolt': ['lightningBolt', 'The caster becomes a bolt of lightning.'],
  'dancing-fountain': ['water', 'A fountain of water dances.'],
  'frog-tongue': ['bludgeon', 'A blunt blow, not stone.'],
  'dancing-blade': ['slash', 'Blades cut through the area.'],
  'boneshaker': ['bludgeon', 'A blunt blow, not stone.'],
  'arrow-salvo': ['pierce', 'A volley of giant arrows.'],
  'weapon-storm': ['slash', 'Blades cut through the area.'],
  'weapon-tide': ['slash', 'Blades cut through the area.'],
  'blast-of-the-bellows': ['wind', 'A churning eddy of air.'],
  'falling-sky': ['gravity', 'Crushing pressure slams down.'],
  'undertaker': ['earth', 'Earth or stone heaves; no plant involved.'],
  'rouse-skeletons': ['earth', 'Earth or stone heaves; no plant involved.'],
  'dragon-turret': ['dragonRoar', 'A dragon-shaped turret breathes and roars.'],
  'implosion': ['gravity', 'The target collapses in on itself; a gravitic crush cue, not an explosion.'],
  'curse-of-lost-time': ['time', 'Rapid aging or erosion; temporal cue.'],
  'horde-of-underlings': ['summon', 'Underlings are summoned; arrival cue, creature species player chosen.'],
  'power-word-kill': ['psychic', 'A spoken word of power strikes the mind; mental pulse without prerecorded speech.'],
  'power-word-blind': ['psychic', 'A spoken word of power strikes the mind; mental pulse without prerecorded speech.'],
  'power-word-stun': ['psychic', 'A spoken word of power strikes the mind; mental pulse without prerecorded speech.'],
  'malicious-shadow': ['shadow', 'The target\'s own shadow becomes a deadly form; shadow cue.'],
  'quench': ['water', 'Air becomes supersaturated with water vapour and fires are doused; water cue.'],
  'shock-and-awe': ['explosion', 'Illusory cannons explode overhead; explosion cue for the illusion.'],
  'weapon-of-judgment': ['divineWrath', 'An immense spiritual weapon of the deity manifests above the target.'],
  'deitys-strike': ['divineWrath', 'The deity\'s favored weapon falls from above; divine strike cue.'],
  'gouging-claw': ['claws', 'Limb becomes a claw for a melee spell attack; claw strike cue.'],
  'spiked-carapace': ['pierce', 'A spiked bone gauntlet strikes; piercing hit cue.'],
  'buzzing-bites': ['swarm', 'Buzzing, biting insects are explicitly described.'],
  'worms-repast': ['swarm', 'Gnawing worms materialize inside the target; crawling swarm cue.'],
  'murder-of-crows': ['scream', 'A flock of crows torments the target; shrieking flock cue.'],
  'songbirds-call': ['song', 'The caster\'s voice calls a storm of songbirds.'],
  'sudden-swarm': ['', 'A familiar divides; piercing damage comes from the familiar\'s later bites.'],
  'final-fate-of-the-locust-host': ['swarm', 'A locust host bursts from Deskari\'s corpse.'],
  'incarnate-ancient-specter': ['summon', 'An ancient wraith is summoned; arrival cue.'],
  'blood-vendetta': ['', 'Reactive curse; bleed is caused later by the cursed creature\'s own wounds.'],
  'blossoming-gore': ['growth', 'A field of bloody roses grows; organic growth cue.'],
  'feast-of-ashes': ['', 'A hunger curse; no audible effect.'],
  'inevitable-disaster': ['', 'Deferred doom; no immediate audible effect.'],
  'animus-mine': ['', 'A mental mine is implanted; it detonates later only when triggered.'],
  'bandits-doom': ['', 'Ward on an item; mental damage happens only when the item is stolen.'],
  'defensive-prescience': ['', 'Private foresight of an incoming attack; no audible effect.'],
  'instant-minefield': ['', 'Mines are hidden now and explode later when stepped on.'],
  'shattering-gem': ['', 'A gem orbits the target and shatters only when a Strike lands later.'],
  'lashing-rope': ['', 'A rope animates and wreathes the caster; its slashing happens on a later attack.'],
  'door-to-beyond': ['wind', 'Air rushes through hairline cracks in reality; wind cue.'],
  'poltergeists-fury': ['wind', 'A telekinetic storm whirls loose objects; rushing wind cue.'],
  'grasping-grave': ['earth', 'Skeletal arms erupt from the ground; earth rumble cue.'],
  'coral-eruption': ['earth', 'Razor coral erupts from the ground; earth rumble cue.'],
  'conjured-clockwork': ['metal', 'A clockwork device spreads across the ground; metal cue.'],
  'etheric-shards': ['force', 'Splinters of force are sown; force cue.'],
  'redistribute-potential': ['', 'Reviewed native energy transfer; quiet.'],
  'hippocampus-retreat': ['water', 'The caster swims away with a hippocampus tail; water cue.'],
  'inner-upheaval': ['force', 'Qi focused into a Strike; force cue.'],
  'grisly-growths': ['transform', 'Flesh grows excess limbs and organs; transformation cue.'],
  'flense': ['slash', 'Flesh is stripped from the target; slashing cue.'],
  'mutilate': ['slash', 'Ritual cuts mirrored onto the target; slashing cue.'],
  'split-the-tongue': ['slash', 'The target\'s tongue splits; slashing cue.'],
  'blood-feast': ['claws', 'An enormous maw feasts on the target; savage bite cue.'],
  'gluttons-jaws': ['claws', 'A slavering maw bites the target; savage bite cue.'],
  'weight-of-the-world': ['gravity', 'A burst of multiplied gravity; gravitic crush cue.'],
  'gravity-wave': ['gravity', 'A ripple of gravitic force lifts and slams; gravitic cue.'],
  'calcium-rain': ['pierce', 'A torrent of bone shards rains down; piercing cue.'],
  'shadow-raid': ['shadow', 'Illusory flying shadows strike; shadow cue.'],
  'shadow-army': ['shadow', 'Semi-real shadow copies swarm the battlefield; shadow cue.'],
  'abyssal-plague': ['', 'A disease touch; the plague siphons soul fragments silently.'],
  'bullhorn': ['', 'The caster\'s own voice is amplified; player speaks.'],
  'illusory-creature': ['', 'Illusion sounds are player chosen.'],
  'illusory-scene': ['', 'Illusion sounds are player chosen.'],
  'seashell-of-stolen-sound': ['', 'A stored sound is player chosen.'],
  'whispering-quiet': ['', 'Sound is suppressed.'],
  'unseen-heralds': ['', 'Illusory heralds; alarm sounds are player chosen.'],
  'rallying-banner': ['', 'A visual banner; no audible effect is described.'],
  'procyal-philosophy': ['', 'Advice dispensed is player chosen.'],
  'overwhelming-presence': ['', 'Visual splendor; no audible effect is described.'],
  'ghost-sound': ['', 'Player chooses the sound.'],
  'cleansing-flames': ['fireIgnition', 'Purifying flames wrap the target; flame ignition instead of a healing chime.'],
  'cauterize-wounds': ['fireIgnition', 'Wounds are sealed with fire; flame ignition instead of a healing chime.'],
  'forest-of-gates': ['teleport', 'The group is transported to an extraplanar realm; spatial transition cue.'],
  'reapers-lantern': ['light', 'A ghostly lantern sheds light; no healing is described.'],
  'scroungers-glee': ['fear', 'A cruel laugh promises death; ominous cue, not a healing chime.'],
  'share-life': ['', 'A life link redistributes later damage; no immediate healing or audible effect.'],
  'tireless-worker': ['bless', 'A condition is suppressed; gentle beneficial cue, no Hit Points restored.'],
  'vital-singularity': ['', 'A ritual pact for later sacrifice; no immediate restoration or audible effect.'],
  'entropic-wheel': ['fireIgnition', 'A thermal wheel ignites around the caster; flame ignition (no combined frost cue profile exists).'],
  'mantle-of-the-magma-heart': ['fireIgnition', 'Skin becomes burning lava wreathed in fire magic; flame ignition instead of a generic transformation.'],
  'comet-charge': ['fire', 'The caster rushes wreathed in elemental power; fire cue for the comet.'],
  'unrelenting-gravity': ['gravity', 'Gravity is greatly increased on the target; gravitic crush cue.'],
  'chosen-gravity': ['gravity', 'Gravity\'s direction is changed for the target; gravitic cue.'],
  'gravity-weapon': ['gravity', 'Gravitational force is funneled into the caster\'s blows; gravitic cue.'],
  'amity-cycle':['song', 'The ritual performance includes singing and music.'],
  'ash-strewn-ending': ['song', 'The ritual is sung aloud.'],
  'clawsong': ['song', 'The caster sings a low, growling prayer.'],
  'raga-of-remembrance': ['song', 'A musical raga is performed.'],
  'regale-the-lost-ones': ['song', 'Music is performed for the lost ones.'],
  'release-the-ego-to-restore-the-soul': ['song', 'Abundant music rallies a crowd into a dance.'],
  'song-of-silver': ['song', 'A performance is the core of the casting.'],
  'containment': ['shield', 'A force field wraps the creature; ward cue.'],
  'resist-energy': ['shield', 'A shield of elemental energy protects the creature; ward cue.'],
  'shielding-formation': ['shield', 'Magical shields of force are conjured; ward cue.'],
  'cordyceps-command': ['poison', 'A mote of spores is whisked at the target; poison release cue.'],
  'stinking-cloud': ['poison', 'A cloud of putrid mist is released; poison release cue.'],
  'dread-mosquito-storm': ['swarm', 'A plague of undead mosquitoes is released; buzzing swarm cue.'],
  'electrostatic-glider': ['electric', 'An arc of static electricity forms above the caster.'],
  'frenzied-revelry': ['scream', 'The caster dances and howls wildly.'],
  'spiral-of-horrors': ['scream', 'Shades and spirits howl and whirl around the caster.'],
  'incarnate-tempest-of-shades': ['scream', 'An amalgam of howling vengeful dead is called forth.'],
  'vicious-howl': ['scream', 'The caster howls with passion.'],
  'overselling-flourish': ['scream', 'A grand, screaming spectacle of being hit.'],
  'invoke-the-crimson-oath': ['battleCry', 'The caster shouts the final line of the Crimson Oath.'],
  'incarnate-draconic-legion': ['explosion', 'Summoned dragons unleash annihilating blasts.'],
  'incarnate-kaiju': ['dragonRoar', 'A massive rampaging monster rises; monstrous roar cue.'],
  'kinetic-ram': ['force', 'Kinetic energy rams outward; force cue.'],
  'forceful-hand': ['force', 'A hand of magical force appears; force cue.'],
  'force-fling': ['force', 'A force echo of a weapon is flung; force cue.'],
  'telekinetic-maneuver': ['force', 'A rush of telekinetic power moves a foe; force cue.'],
  'friendfetch': ['force', 'Telekinetic strands drag targets toward the caster; force cue.'],
  'shadow-blast': ['shadow', 'A blast of shadow energy; shadow cue.'],
  'soul-cutter': ['spirit', 'A blade of spiritual energy cuts the soul; spirit cue.'],
  'spiritual-armament': ['spirit', 'A ghostly echo of a weapon is flung; spirit cue.'],
  'synaptic-pulse': ['psychic', 'A pulsating mental blast; mental pulse.'],
  'void-harvest': ['void', 'A conduit to the Void opens; void cue.'],
  'vital-luminance': ['holy', 'The caster glows as a beacon of vitality; radiant cue.'],
  'zero-gravity': ['gravity', 'Gravity is negated in the area; gravitic cue.'],
  'variable-gravity': ['gravity', 'The caster adjusts gravity\'s grip; gravitic cue.'],
  'proximal-shift': ['teleport', 'With a thunderous crack the caster vanishes and reappears.'],
  'psychic-outburst': ['psychic', 'Psychic energy bursts outward from the mind; mental pulse.'],
  'luring-wail': ['scream', 'A plaintive wailing cry lures enemies.'],
  'confusing-cry': ['scream', 'An unsettling, warbling cry.'],
  'tattoo-whispers': ['', 'A ritual tattoo is inked; its later whispers are private.'],
  'indolent-haze': ['', 'A faint scent and soothing calm; no audible effect.'],
  'sacred-nimbus': ['water', 'A small cloud rains warm sanctified water; rain cue.'],
  'banishing-touch': ['force', 'A surge of magic launches the target away; force cue.'],
  'annunciation-of-the-outer-gate': ['', 'The caster speaks the announcement; player speech, no prerecorded voice.'],
};
const DAMAGE_PROFILES = { fire:'fire', cold:'cold', electricity:'electric', acid:'acid', poison:'poison', sonic:'sonic', force:'force', void:'void', vitality:'holy', mental:'psychic', bleed:'', spirit:'spirit', slashing:'slash', piercing:'pierce', bludgeoning:'bludgeon', untyped:'' };
const MATERIAL_THEMES = { earth:'earth', metal:'metal', plant:'growth', wind:'wind', water:'water', fire:'fire', cold:'cold', electricity:'electric', acid:'acid', poison:'poison', sonic:'sonic', shadow:'shadow', void:'void', force:'force' };
// Fallback for spells that no earlier semantic rule covered: audible vocal or
// musical traits, explicit explosions, and finally the native damage types.
function audibleFallback(spell, source, text, opening) {
  if (Object.hasOwn(AUDIBLE_OVERRIDES, spell.slug)) {
    const [profile, reason] = AUDIBLE_OVERRIDES[spell.slug];
    return [profile, 'Reviewed: ' + reason];
  }
  const lower = text.toLowerCase();
  const auditory = spell.traits.includes('auditory');
  if (auditory && !/\b(tale|story|stories|folklore)\b/.test(lower)) {
    if (/\b(scream\w*|shriek\w*|wail\w*|howl\w*|screech\w*)\b/.test(lower))
      return ['scream', 'Auditory spell with an explicit scream, wail or howl.'];
    if (/\b(sings?|singing|song|chant\w*|melody|music\w*|tune|chorus|dirge|lament|anthem|ode|perform\w*)\b/.test(lower))
      return ['song', 'Auditory spell with explicit singing, chanting or performance.'];
    if (/\b(shout\w*|cry|cries|yell\w*|bellow\w*|call to arms|exhortation|boast\w*|insult\w*)\b/.test(lower))
      return ['battleCry', 'Auditory spell with an explicit shout, cry or boast.'];
    if (/\b(whisper\w*|murmur\w*|utter\w*|unknown tongue|chatter\w*|cacophony)\b/.test(lower))
      return ['whispers', 'Auditory spell with explicit whispers or utterances; no intelligible speech is assumed.'];
  }
  // Only the opening imagery: later Depart/critical-failure explosions are not the cast.
  const lead = String(opening ?? '').toLowerCase();
  if (/\b(explod\w*|explosion|detonat\w*)\b/.test(lead))
    return ['explosion', 'Description explicitly describes an explosion.'];
  if (/\bthunder(?:ous|clap)?\b/.test(lead))
    return ['sonic', 'Description explicitly describes thunder.'];
  const types = [...new Set(Object.values(source?.system?.damage ?? {}).filter(d => d.kinds?.includes?.('damage') ?? true).map(d => d.type).filter(Boolean))];
  if (!types.length) return null;
  const material = MATERIAL_THEMES[spell.theme];
  const physical = types.every(t => ['slashing','piercing','bludgeoning','bleed','untyped'].includes(t));
  if (physical && material)
    return [material, `Physical damage delivered by ${spell.theme} material; material cue.`];
  for (const type of types) {
    let profile = DAMAGE_PROFILES[type];
    if (type === 'spirit' && /\b(divin\w*|deity|faith|holy|sanctified|celestial|god|gods)\b/.test(lower) && !/\b(fiend\w*|abyss|hell)\b/.test(lower)) profile = 'divineWrath';
    if (type === 'slashing' && /\b(claws?|talons?)\b/.test(lower)) profile = 'claws';
    if (type === 'spirit' && /\bbeam of\b.*\blight\b/.test(lower)) profile = 'radiantRay';
    if (profile) return [profile, `Native ${type} damage; ${profile} cue follows the visible contact.`];
  }
  if (types.includes('untyped') && /\b(energy|elemental)\b/.test(lower))
    return ['force', 'Untyped or chosen-energy damage; neutral magical energy cue.'];
  return null;
}
