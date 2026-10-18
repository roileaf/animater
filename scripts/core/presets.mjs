import { validateRecipe } from "./model.mjs";
import { paceGeneratedMotion } from "../engines/motion/motion-pacing.mjs";
import { STARTER_MEDIA_TIMING } from "../../data/starter-media-timing.mjs";
const stage = (kind, assets, delay = 0, duration = 1500, scale = 1) => ({
  kind,
  assets: assets.split(","),
  delay,
  duration,
  scale,
  opacity: 1,
  oneShot: kind !== "aura",
  below: kind === "aura",
  persist: false,
});
export function starterRecipes() {
  const definitions = [
    [
      "ember",
      "Ember shot",
      "Fire",
      "#ff9967",
      "attack",
      "fire bolt,ignition,produce flame",
      "A source flash, a fiery bolt, then a sharp impact.",
      [
        stage(
          "cast",
          "jb2a.impact.001.orange,jb2a.impact.004.orange,jb2a.impact",
          0,
          650,
          0.65,
        ),
        stage("travel", "jb2a.fire_bolt.orange,jb2a.fire_bolt", 180, 900),
        stage(
          "impact",
          "jb2a.impact.001.orange,jb2a.impact.004.orange,jb2a.impact",
          950,
          800,
        ),
      ],
    ],
    [
      "frost",
      "Frost lance",
      "Ice",
      "#85d8ff",
      "attack",
      "ray of frost,frostbite",
      "A clean ice projectile with a cool blue finish.",
      [
        stage("travel", "jb2a.ray_of_frost.blue,jb2a.ray_of_frost", 0, 1100),
        stage("impact", "jb2a.impact.001.blue,jb2a.impact", 900, 900),
      ],
    ],
    [
      "storm",
      "Storm arc",
      "Lightning",
      "#b7a2ff",
      "damage",
      "electric arc,chain lightning",
      "A lightning connection to every target, followed by impact.",
      [
        stage(
          "travel",
          "jb2a.chain_lightning.primary.blue,jb2a.chain_lightning,jb2a.lightning_bolt",
          0,
          1300,
        ),
        stage("impact", "jb2a.impact.001.blue,jb2a.impact", 900, 900),
      ],
    ],
    [
      "force",
      "Force volley",
      "Arcane",
      "#bf9dff",
      "damage",
      "force barrage,magic missile",
      "A magical volley with a bright arcane impact.",
      [
        stage(
          "travel",
          "jb2a.magic_missile.purple,jb2a.magic_missile",
          0,
          1200,
        ),
        stage("impact", "jb2a.impact.001.pinkpurple,jb2a.impact", 950, 800),
      ],
    ],
    [
      "mend",
      "Mending light",
      "Healing",
      "#7ee5bf",
      "damage",
      "heal,healing word,cure wounds",
      "A gentle healing burst on each chosen target.",
      [
        stage(
          "impact",
          "jb2a.healing_generic.200px.green,jb2a.healing_generic",
          0,
          2200,
          1.4,
        ),
      ],
    ],
    [
      "ward",
      "Arcane ward",
      "Arcane",
      "#bf9dff",
      "use",
      "shield",
      "A brief protective aura which follows its source.",
      [
        stage(
          "aura",
          "jb2a.shield.01.blue,jb2a.shield,jb2a.antilife_shell.blue_no_circle",
          0,
          4500,
          1.5,
        ),
      ],
    ],
    [
      "arrow",
      "Arrow strike",
      "Weapons",
      "#e7c89c",
      "attack",
      "longbow,shortbow,crossbow",
      "A directional arrow and a compact hit effect.",
      [
        stage(
          "travel",
          "jb2a.arrow.physical.white.01,jb2a.arrow.physical",
          0,
          900,
        ),
        // Mundane arrow: neutral white contact (Free falls back to impact.005), not a magic spark.
        stage("impact", "jb2a.impact.005.white,jb2a.impact.005,jb2a.impact", 700, 600, 0.65),
      ],
    ],
    [
      "blade",
      "Blade strike",
      "Weapons",
      "#e7c89c",
      "attack",
      "longsword,shortsword,dagger",
      "A quick weapon swing pointed toward the target.",
      [
        stage(
          "impact",
          "jb2a.melee_generic.slashing.one_handed,jb2a.melee_generic.slashing,jb2a.sword.melee",
          0,
          1000,
        ),
      ],
    ],
    [
      "nova",
      "Fire nova",
      "Fire",
      "#ff9967",
      "template",
      "fireball",
      "A circular burst scaled to the placed spell area.",
      [
        stage(
          "template",
          "jb2a.fireball.explosion.orange,jb2a.fireball.explosion",
          0,
          2500,
        ),
      ],
    ],
    [
      "cinematic-blade",
      "Cinematic blade",
      "Motion",
      "#e7c89c",
      "manual",
      "",
      "Source lunges, blade swings, target recoils. All tokens return to their pose.",
      [
        {
          kind: "motion",
          assets: [],
          motion: "lunge",
          subject: "source",
          delay: 0,
          duration: 650,
          distance: 0.35,
          intensity: 1,
        },
        stage(
          "impact",
          "jb2a.melee_generic.slashing.one_handed,jb2a.melee_generic.slashing,jb2a.sword.melee",
          180,
          800,
        ),
        {
          kind: "motion",
          assets: [],
          motion: "recoil",
          subject: "targets",
          delay: 350,
          duration: 450,
          distance: 0.2,
          intensity: 1,
        },
      ],
    ],
    [
      "casting-flourish",
      "Casting flourish",
      "Motion",
      "#bf9dff",
      "manual",
      "",
      "Source rises and settles into an arcane burst.",
      [
        {
          kind: "motion",
          assets: [],
          motion: "levitate",
          subject: "source",
          delay: 0,
          duration: 1600,
          distance: 0.3,
          intensity: 1,
        },
        stage("cast", "jb2a.impact.001.pinkpurple,jb2a.impact", 400, 1000, 1.3),
      ],
    ],
    [
      "impact-reaction",
      "Impact reaction",
      "Motion",
      "#ff9967",
      "manual",
      "",
      "A sharp hit shakes every target token, with a matching impact.",
      [
        {
          kind: "motion",
          assets: [],
          motion: "shake",
          subject: "targets",
          delay: 0,
          duration: 650,
          distance: 0.25,
          intensity: 1,
        },
        stage("impact", "jb2a.impact.001.orange,jb2a.impact", 0, 650),
      ],
    ],
  ];
  return definitions.map(
    ([id, name, category, color, trigger, match, description, stages]) => {
      const timing=STARTER_MEDIA_TIMING[id],primaryIndex=stages.findIndex(s=>s.kind==='travel'||s.assets?.some(k=>/\.(?:melee_generic|sword)\./.test(k)));
      if(timing&&primaryIndex>=0){
        const flight=stages[primaryIndex];flight.stageId=`${id}-contact`;flight.duration=Math.max(flight.duration,timing.duration);
        for(const contact of stages.filter(s=>s!==flight&&(s.kind==='impact'||s.kind==='motion'&&s.subject==='targets')))
          Object.assign(contact,{afterStage:flight.stageId,timingAnchor:'start',startOffset:timing.contact});
        if(id==='cinematic-blade')stages[0].duration=Math.max(stages[0].duration,flight.delay+timing.contact+600);
      }
      return validateRecipe({
        id,
        name,
        category,
        color,
        trigger,
        match,
        description,
        stages: stages.map(paceGeneratedMotion),
        enabled: true,
      });},
  );
}
