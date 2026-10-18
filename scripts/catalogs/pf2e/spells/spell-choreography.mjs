import { validateRecipe } from "../../../core/model.mjs";
import {withCatalogFx} from '../../shared/catalog-fx.mjs';
import { SPELL_ASSETS } from "../../../../data/spell-assets.mjs";
import { applySpellDesign } from "./spell-design.mjs";
import { addSpellSounds } from "../../../engines/sound/spell-sounds.mjs";

// Semantic art direction. Each family has a distinct charge, delivery and finish.
// The build tool resolves these candidate families to actual edition database keys.
const theme = (label, color, cast, bolt, hit, aura, area = hit) => ({
  label,
  color,
  cast,
  bolt,
  hit,
  aura,
  area,
});
export const SPELL_THEMES = {
  fire: theme(
    "Fire",
    "#ff9967",
    "cast_generic.fire,cast_generic",
    "fire_bolt.orange,fire_bolt",
    "impact_themed.fire,fireball.explosion.orange,impact.001.orange",
    "fire_ring,flames,flaming_sphere",
    "fireball.explosion.orange,fire_ring",
  ),
  cold: theme(
    "Ice",
    "#85d8ff",
    "cast_generic.ice,cast_generic",
    "ray_of_frost.blue,ray_of_frost",
    "impact_themed.ice,ice_spikes,impact.001.blue",
    "sleet_storm,swirling_sparkles",
    "cone_of_cold,ice_spikes",
  ),
  electricity: theme(
    "Lightning",
    "#b7a2ff",
    "static_electricity,cast_generic",
    "electric_arc,chain_lightning.primary.blue,lightning_bolt",
    "lightning_strike,impact.001.blue",
    "lightning_ball,lightning_orb,static_electricity",
    "call_lightning,lightning_strike",
  ),
  acid: theme(
    "Acid",
    "#b1e56b",
    "cast_generic,particles",
    "breath_weapons.acid.line.green,energy_beam",
    "liquid,water_splash,impact.001.green",
    "fumes,bubble,energy_field",
    "liquid,particle_burst",
  ),
  poison: theme(
    "Poison",
    "#83c85b",
    "fumes,cast_generic",
    "energy_beam,eldritch_blast",
    "fumes,impact.001.green",
    "fog_cloud,fumes",
    "fog_cloud,particle_burst",
  ),
  force: theme(
    "Force",
    "#b6a0ff",
    "cast_shape,cast_generic",
    "magic_missile.purple,magic_missile",
    "impact.001.pinkpurple,impact",
    "energy_field,shield",
    "particle_burst,energy_field",
  ),
  sonic: theme(
    "Sound",
    "#89e5df",
    "music_notations,cast_generic",
    "soundwave,ranged.helix,energy_beam",
    "shatter,thunderwave",
    "music_notations,bardic_inspiration",
    "thunderwave,shatter",
  ),
  vitality: theme(
    "Vitality",
    "#91e3a4",
    "sacred_flame,cast_generic",
    "guiding_bolt,energy_beam",
    "healing_generic.03.burst.bluegreen,healing_generic",
    "cure_wounds,bless",
    "healing_generic.03.burst.bluegreen,particle_burst",
  ),
  void: theme(
    "Void",
    "#a98de6",
    "arms_of_hadar,cast_generic",
    "eldritch_blast.purple,eldritch_blast",
    "toll_the_dead,impact.001.purple",
    "sphere_of_annihilation,darkness",
    "arms_of_hadar,black_tentacles",
  ),
  spirit: theme(
    "Spirit",
    "#d5e9ff",
    "sacred_flame,cast_generic",
    "guiding_bolt,energy_beam",
    "divine_smite,sacred_flame",
    "spirit_guardians,swirling_feathers",
    "spirit_guardians,particle_burst",
  ),
  blood: theme(
    "Blood",
    "#ee7c91",
    "cast_generic,particles",
    "energy_beam,eldritch_blast",
    "liquid,impact.001.red",
    "energy_strands,particles",
    "liquid,particle_burst",
  ),
  earth: theme(
    "Earth",
    "#d4b080",
    "ground_cracks,cast_generic",
    "boulder,rolling_boulder,energy_beam",
    "ground_cracks,eruption",
    "falling_rocks,ground_cracks",
    "eruption,ground_cracks",
  ),
  water: theme(
    "Water",
    "#73cfea",
    "water_splash,cast_generic",
    "energy_beam,breath_weapons.acid.line",
    "water_splash,liquid",
    "bubble,liquid",
    "water_splash,liquid",
  ),
  wind: theme(
    "Wind",
    "#c8e8e2",
    "wind_lines,cast_generic",
    "gust_of_wind,wind_stream",
    "whirlwind,wind_lines",
    "whirlwind,swirling_feathers",
    "whirlwind,gust_of_wind",
  ),
  plant: theme(
    "Nature",
    "#93d786",
    "swirling_leaves,cast_generic",
    "vine,energy_beam",
    "entangle,plant_growth",
    "swirling_leaves,butterflies",
    "plant_growth,entangle",
  ),
  metal: theme(
    "Metal",
    "#c8d6e5",
    "cast_shape,glint",
    "energy_beam,magic_missile",
    "cloud_of_daggers,impact",
    "glint,cloud_of_daggers",
    "cloud_of_daggers,particle_burst",
  ),
  shadow: theme(
    "Shadow",
    "#a5a0dc",
    "darkness,cast_generic",
    "eldritch_blast.purple,energy_beam",
    "arms_of_hadar,toll_the_dead",
    "darkness,smoke",
    "darkness,black_tentacles",
  ),
  light: theme(
    "Light",
    "#ffe798",
    "dancing_light,cast_generic",
    "guiding_bolt,energy_beam",
    "glint,sacred_flame",
    "dancing_light,twinkling_stars",
    "moonbeam,particle_burst",
  ),
  mind: theme(
    "Mind",
    "#dba3f7",
    "cast_shape,cast_generic",
    "energy_beam,magic_missile",
    "dizzy_stars,sleep",
    "sleep,energy_strands",
    "sleep,particle_burst",
  ),
  fear: theme(
    "Fear",
    "#bd9fd5",
    "cast_generic,smoke",
    "eldritch_blast,energy_beam",
    "toll_the_dead,condition.frightened,condition.fear",
    "condition.frightened,condition.fear,smoke",
    "arms_of_hadar,smoke",
  ),
  curse: theme(
    "Curse",
    "#d88eb7",
    "magic_signs.circle.01.necromancy,cast_generic",
    "eldritch_blast,energy_beam",
    "hunters_mark,toll_the_dead",
    "hunters_mark,energy_strands",
    "arms_of_hadar,particle_burst",
  ),
  divination: theme(
    "Divination",
    "#90d9f2",
    "magic_signs.circle.01.divination,detect_magic",
    "energy_conduit,energy_beam",
    "detect_magic,eyes",
    "detect_magic,eyes,twinkling_stars",
    "detect_magic,particle_burst",
  ),
  illusion: theme(
    "Illusion",
    "#dfa9ed",
    "magic_signs.circle.01.illusion,cast_generic",
    "energy_beam,magic_missile",
    "shimmer,swirling_sparkles",
    "shimmer,swirling_sparkles",
    "fog_cloud,shimmer",
  ),
  time: theme(
    "Time",
    "#9ac9f0",
    "magic_signs.circle.01.transmutation,cast_shape",
    "energy_conduit,energy_beam",
    "dodecahedron,icosahedron,impact",
    "icosahedron,token_border",
    "energy_field,particle_burst",
  ),
  teleport: theme(
    "Teleport",
    "#bfa0f7",
    "portals,cast_generic",
    "energy_conduit,energy_beam",
    "misty_step,teleport",
    "portals,teleport",
    "portals,teleport",
  ),
  ward: theme(
    "Protection",
    "#9dd5ff",
    "magic_signs.circle.01.abjuration,cast_generic",
    "energy_conduit,energy_beam",
    "shield,ward",
    "shield,ward,antilife_shell",
    "energy_field,wall_of_force",
  ),
  healing: theme(
    "Healing",
    "#8de6bb",
    "cast_generic,cast_shape",
    "energy_conduit,energy_beam",
    "cure_wounds,healing_generic",
    "healing_generic,bless",
    "healing_generic.03.burst.bluegreen,healing_generic",
  ),
  summon: theme(
    "Summoning",
    "#e4bd8e",
    "magic_signs.circle.01.conjuration,cast_generic",
    "energy_conduit,energy_beam",
    "portals,particle_burst",
    "portals,magic_signs.circle.02.conjuration",
    "portals,particle_burst",
  ),
  transform: theme(
    "Transformation",
    "#aaddba",
    "magic_signs.circle.01.transmutation,cast_generic",
    "energy_beam,energy_conduit",
    "particle_burst,swirling_sparkles",
    "swirling_sparkles,swirling_leaves",
    "particle_burst,energy_field",
  ),
  flight: theme(
    "Flight",
    "#b6e6f2",
    "swirling_feathers,cast_generic",
    "wind_stream,energy_beam",
    "swirling_feathers,wind_lines",
    "swirling_feathers,whirlwind",
    "whirlwind,wind_lines",
  ),
  gravity: theme(
    "Gravity",
    "#aaa4ed",
    "cast_shape,ground_cracks",
    "energy_beam,energy_conduit",
    "ground_cracks,particle_burst",
    "energy_field,icosahedron",
    "ground_cracks,energy_field",
  ),
  weapon: theme(
    "Weapons",
    "#f1c095",
    "glint,cast_generic",
    "spiritual_weapon,sword,energy_beam",
    "melee_attack,divine_smite",
    "spiritual_weapon,glint",
    "cloud_of_daggers,particle_burst",
  ),
  web: theme(
    "Web",
    "#dfe7ef",
    "cast_generic,particles",
    "energy_beam,energy_strands",
    "web,entangle",
    "web,energy_strands",
    "web,entangle",
  ),
  dispel: theme(
    "Countermagic",
    "#a7cff2",
    "magic_signs.circle.01.abjuration,cast_shape",
    "energy_beam,energy_conduit",
    "particle_burst,detect_magic",
    "detect_magic,ward",
    "particle_burst,energy_field",
  ),
  disease: theme(
    "Disease",
    "#b7bf78",
    "fumes,cast_generic",
    "energy_beam,eldritch_blast",
    "fumes,smoke",
    "fumes,smoke",
    "fog_cloud,fumes",
  ),
  dream: theme(
    "Dream",
    "#c7b7f4",
    "twinkling_stars,cast_generic",
    "energy_beam,magic_missile",
    "sleep,dizzy_stars",
    "sleep,twinkling_stars",
    "sleep,fog_cloud",
  ),
  luck: theme(
    "Fortune",
    "#f6d38d",
    "glint,cast_generic",
    "guiding_bolt,energy_beam",
    "bardic_inspiration,twinkling_stars",
    "twinkling_stars,bardic_inspiration",
    "particle_burst,glint",
  ),
  arcane: theme(
    "Arcane",
    "#bda6f5",
    "magic_signs.circle.01.evocation,cast_generic",
    "energy_beam,magic_missile",
    "impact.001.pinkpurple,particle_burst",
    "swirling_sparkles,magic_signs.circle.02.evocation",
    "particle_burst,energy_field",
  ),
};

// Explicit authored exceptions precede semantic classification. The same spell's
// legacy/remaster entries retain separate compendium IDs, not ambiguous aliases.
export const SIGNATURES = {
  ignition: ["fire", "bolt"],
  "produce-flame": ["fire", "bolt"],
  "ray-of-frost": ["cold", "bolt"],
  "electric-arc": ["electricity", "chain"],
  "chain-lightning": ["electricity", "chain"],
  "lightning-bolt": ["electricity", "line"],
  "force-barrage": ["force", "volley"],
  "magic-missile": ["force", "volley"],
  fireball: ["fire", "burst"],
  "breathe-fire": ["fire", "cone"],
  "burning-hands": ["fire", "cone"],
  "cone-of-cold": ["cold", "cone"],
  frostbite: ["cold", "target"],
  "needle-darts": ["metal", "bolt"],
  "telekinetic-projectile": ["force", "bolt"],
  "acid-splash": ["acid", "bolt"],
  "caustic-blast": ["acid", "burst"],
  "gouging-claw": ["weapon", "melee"],
  "live-wire": ["electricity", "bolt"],
  "void-warp": ["void", "target"],
  "chill-touch": ["void", "target"],
  daze: ["mind", "target"],
  "puff-of-poison": ["poison", "target"],
  "phase-bolt": ["force", "bolt"],
  "tangle-vine": ["plant", "bolt"],
  tanglefoot: ["plant", "bolt"],
  spout: ["water", "target"],
  "divine-lance": ["spirit", "bolt"],
  "vitality-lash": ["vitality", "target"],
  "haunting-hymn": ["sonic", "cone"],
  shield: ["ward", "self"],
  "mystic-armor": ["ward", "self"],
  "mage-armor": ["ward", "self"],
  heal: ["healing", "target"],
  harm: ["void", "target"],
  soothe: ["healing", "target"],
  restoration: ["healing", "target"],
  bless: ["spirit", "emanation"],
  bane: ["curse", "emanation"],
  heroism: ["luck", "target"],
  fear: ["fear", "target"],
  "phantom-pain": ["mind", "target"],
  "phantasmal-killer": ["fear", "target"],
  "vision-of-death": ["fear", "target"],
  sleep: ["dream", "burst"],
  "color-spray": ["illusion", "cone"],
  "vibrant-pattern": ["illusion", "burst"],
  "hypnotic-pattern": ["illusion", "burst"],
  invisibility: ["illusion", "vanish"],
  "mirror-image": ["illusion", "mirror"],
  blur: ["illusion", "mirror"],
  disappearance: ["illusion", "vanish"],
  "illusory-disguise": ["illusion", "self"],
  "illusory-object": ["illusion", "point"],
  "illusory-creature": ["illusion", "point"],
  hallucination: ["illusion", "target"],
  "detect-magic": ["divination", "self"],
  "read-aura": ["divination", "target"],
  clairvoyance: ["divination", "self"],
  scrying: ["divination", "self"],
  light: ["light", "target"],
  "dancing-lights": ["light", "self"],
  darkness: ["shadow", "burst"],
  darkvision: ["divination", "target"],
  "faerie-fire": ["light", "burst"],
  "revealing-light": ["light", "burst"],
  sunburst: ["light", "burst"],
  "moonlight-ray": ["light", "bolt"],
  "dimension-door": ["teleport", "portal"],
  translocate: ["teleport", "portal"],
  teleport: ["teleport", "portal"],
  blink: ["teleport", "portal"],
  "warp-step": ["teleport", "portal"],
  "collective-transposition": ["teleport", "portal"],
  haste: ["time", "target"],
  slow: ["time", "target"],
  "time-stop": ["time", "self"],
  stasis: ["time", "target"],
  fly: ["flight", "target"],
  levitate: ["gravity", "target"],
  jump: ["flight", "target"],
  "air-walk": ["flight", "target"],
  "gust-of-wind": ["wind", "line"],
  whirlwind: ["wind", "burst"],
  "control-water": ["water", "point"],
  "hydraulic-push": ["water", "bolt"],
  "hydraulic-torrent": ["water", "line"],
  "draw-the-lightning": ["electricity", "target"],
  entangle: ["plant", "burst"],
  "entangling-flora": ["plant", "burst"],
  "wall-of-thorns": ["plant", "wall"],
  "wall-of-fire": ["fire", "wall"],
  "wall-of-force": ["ward", "wall"],
  "wall-of-ice": ["cold", "wall"],
  "wall-of-stone": ["earth", "wall"],
  web: ["web", "burst"],
  grease: ["water", "burst"],
  "black-tentacles": ["shadow", "burst"],
  slither: ["shadow", "burst"],
  "spiritual-weapon": ["weapon", "target"],
  "spiritual-armament": ["weapon", "target"],
  "floating-flame": ["fire", "point"],
  "flaming-sphere": ["fire", "point"],
  disintegrate: ["force", "bolt"],
  "polar-ray": ["cold", "bolt"],
  "scorching-ray": ["fire", "volley"],
  "blazing-bolt": ["fire", "volley"],
  "searing-light": ["light", "bolt"],
  "holy-light": ["spirit", "bolt"],
  "sound-burst": ["sonic", "burst"],
  shatter: ["sonic", "target"],
  thunderstrike: ["electricity", "target"],
  "vampiric-touch": ["blood", "target"],
  "vampiric-feast": ["blood", "target"],
  "vampiric-exsanguination": ["blood", "cone"],
  earthquake: ["earth", "burst"],
  "cave-fangs": ["earth", "burst"],
  "spike-stones": ["earth", "burst"],
  "dispel-magic": ["dispel", "target"],
  "cleanse-affliction": ["healing", "target"],
  "remove-curse": ["dispel", "target"],
  "animal-form": ["transform", "transform"],
  "dragon-form": ["transform", "transform"],
  "battle-form": ["transform", "transform"],
  enlarge: ["transform", "target"],
  shrink: ["transform", "target"],
  "pest-form": ["transform", "transform"],
  truestrike: ["divination", "self"],
  "true-strike": ["divination", "self"],
  "sure-strike": ["divination", "self"],
  "weight-of-the-world": ["gravity", "target"],
  "aqueous-orb": ["water", "point"],
  "wall-of-water": ["water", "wall"],
  "bracing-tendrils": ["force", "self"],
  "hellfire-plume": ["fire", "burst"],
  "punishing-winds": ["wind", "burst"],
  "cyclone-rondo": ["wind", "burst"],
  "astral-rain": ["force", "burst"],
  "corrosive-body": ["acid", "transform"],
  "fiery-body": ["fire", "transform"],
  "mantle-of-the-frozen-heart": ["cold", "self"],
  "ash-form": ["shadow", "transform"],
  "disperse-into-air": ["wind", "transform"],
  "wooden-fists": ["plant", "self"],
  "dragon-wings": ["flight", "self"],
};

export const DELIVERY_LABELS = {
  bolt: "Charge → projectile → impact",
  volley: "Charge → staggered volley → impacts",
  chain: "Charge → arcs → discharge",
  melee: "Weapon cue → contact flare",
  target: "Caster cue → target bloom → aura",
  self: "Caster cue → attached flourish",
  burst: "Charge → circular area → finish",
  emanation: "Caster cue → expanding aura",
  cone: "Charge → placed cone → finish",
  line: "Charge → selected line → finish",
  wall: "Barrier casting cue",
  point: "Conjuration at caster",
  portal: "Portal → departure flourish",
  mirror: "Three token afterimages",
  vanish: "Smoke → fading token afterimages",
  transform: "Vortex → silhouette flourish",
  ritual: "Runic circle → channel → seal",
};

export function spellRecipe(spell, libraries = SPELL_ASSETS, options = {}) {
  const systemId=spell.systemId??'pf2e';
  const itemUuid=spell.uuid??`Compendium.${systemId}.${systemId==='sf2e'?'spells':'spells-srd'}.Item.${spell.id}`;
  const art = SPELL_THEMES[spell.theme];
  // A configuration draft keeps the native binding without pretending that an
  // unrelated casting ring/impact is a finished animation for this spell.
  if(spell.design?.unavailable || spell.design?.motif==='generic'){
   const kind=spell.design?.nativeFootprint?'template':spell.design?.subject==='targets'?'impact':'cast';
   const draft=validateRecipe({
    id:`${systemId}-${spell.id}`,name:spell.name,description:'Needs configuration',
    category:art.label,color:art.color,enabled:false,trigger:spell.trigger,
    match:`${spell.name},${spell.slug}`,itemUuid,
    previewArea:spell.area,stages:[{kind,stageId:`${spell.id}-configure`,label:'Choose an asset',assets:['jb2a.cast_generic'],delay:0,duration:2500}],
   });
   draft.stages[0].assets=[];
   return draft;
  }
  const media = spell.design?.assets ?? libraries[spell.theme];
  const stage = (kind, slot, delay, duration, extra = {}) => ({
    mediaSlot: slot,
    kind: spell.design?.nativeFootprint && spell.delivery !== "cone" &&
      !(kind === "cast" && extra.subject === "source") &&
      ["hit", "aura", "area"].includes(slot) && ["cast", "impact", "aura"].includes(kind)
      ? "template" : kind,
    stageId: `${spell.id}-${slot}-${delay}`,
    label:
      slot === "cast"
        ? "Gather"
        : slot === "bolt"
          ? "Release"
          : slot === "hit"
            ? "Land"
            : "Resolve",
    assets: media[slot],
    delay,
    duration,
    scale: 1,
    opacity: 1,
    below: false,
    persist: false,
    fadeIn: Math.min(200, duration / 4),
    fadeOut: Math.min(300, duration / 3),
    tintEnabled: false,
    tint: art.color,
    ...extra,
  });
  const cast = stage("cast", "cast", 0, 700, {
    scale: 1.15,
    scaleIn: 0.2,
    scaleInDuration: 350,
    scaleOut: 0,
    scaleOutDuration: 200,
  });
  const bloom = (subject = "targets", delay = 1000) =>
    stage("aura", "aura", delay, 1600, {
      subject,
      scale: 1.5,
      below: true,
      scaleIn: 0.25,
      scaleInDuration: 450,
    });
  let stages;
  switch (spell.delivery) {
    case "bolt":
    case "volley":
    case "chain":
      stages = [
        cast,
        stage("travel", "bolt", 200, 1000, {
          travelOrigin:
            spell.delivery === "chain" ? "previousTarget" : "source",
          targetStagger: spell.delivery === "chain" ? 160 : 0,
          repeats: spell.delivery === "volley" ? 3 : 1,
          repeatGap: 100,
        }),
        stage("impact", "hit", 1100, 850, {
          scale: 1.35,
          repeats: spell.delivery === "volley" ? 3 : 1,
          repeatGap: 250,
          targetStagger: spell.delivery === "chain" ? 160 : 0,
        }),
      ];
      break;
    case "target":
    case "melee":
      stages = [
        cast,
        stage("impact", "hit", spell.delivery === "melee" ? 200 : 350, 1250, {
          scale: 1.35,
          scaleIn: 0.1,
          scaleInDuration: 250,
        }),
        bloom(),
      ];
      break;
    case "cone":
      stages = [
        cast,
        stage("template", "area", 350, Math.max(2400, spell.design?.mediaTiming?.area?.duration ?? 0), {
          scale: 1, oneShot: true, fadeIn: 0, fadeOut: 100,
          label: "Cone spreads from origin",
        }),
      ];
      break;
    case "line":
      stages = [
        cast,
        stage("template", "area", 350, 4000, {
          scale: 1,
          fadeIn: 0,
          fadeOut: 150,
        }),
      ];
      break;
    case "burst":
      stages = [
        cast,
        stage("template", "area", 250, 1800, { scale: 1, below: true }),
        stage("template", "hit", 1000, 1000, { scale: 0.9, opacity: 0.65 }),
      ];
      break;
    case "mirror":
    case "vanish":
    case "transform":
      stages = [
        cast,
        {
          ...stage("sprite", "aura", 300, 2000),
          assets: [],
          subject: "source",
          copies: spell.delivery === "mirror" ? 3 : 2,
          copySpread: 0.5,
          copyShadow: true,
          opacity: 0.45,
          tracks: [
            {
              property: "alpha",
              from: 0.45,
              to: 0,
              delay: 900,
              duration: 1100,
              ease: "easeOutCubic",
              loop: false,
              pingPong: false,
              fromEnd: false,
            },
          ],
        },
        bloom("source", 500),
      ];
      break;
    case "portal":
      stages = [
        cast,
        stage("cast", "hit", 600, 1600, {
          scale: 2,
          scaleIn: 0.1,
          scaleInDuration: 400,
        }),
        bloom("source", 1000),
      ];
      break;
    case "ritual":
      stages = [
        stage("cast", "cast", 0, 2200, { scale: 2.5, below: true }),
        stage("aura", "aura", 600, 2400, {
          subject: "source",
          scale: 2,
          rotation: 90,
          scaleIn: 0.2,
          scaleInDuration: 600,
        }),
        stage("cast", "hit", 2100, 1000, { scale: 1.8 }),
      ];
      break;
    default:
      stages = [
        cast,
        bloom("source", 400),
        stage("cast", "hit", 1000, 800, {
          scale: ["cone", "line", "wall", "point"].includes(spell.delivery)
            ? 1.8
            : 1.2,
          opacity: 0.6,
        }),
      ];
  }
  return withCatalogFx(validateRecipe({
    id: `${systemId}-${spell.id}`,
    name: spell.name,
    description: spell.design
      ? `${spell.design.label}. ${spell.design.rationale} ${spell.notes.join(" ")}`
      : `${art.label} · ${DELIVERY_LABELS[spell.delivery]}. ${spell.notes.join(" ")}`,
    category: art.label,
    color: art.color,
    enabled: true,
    trigger: spell.trigger,
    match: `${spell.name},${spell.slug}`,
    itemUuid,
    previewArea: spell.area,
    stages: addSpellSounds(
      spell,
      applySpellDesign(spell, stages, stage, options),
      options,
    ),
  }),spell,options);
}
