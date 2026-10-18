import { validateRecipe, resolveAsset } from "../../core/model.mjs";
import { number } from "../../core/stage-options.mjs";

export const ORB_ELEMENTS = {
  acid: "Acid",
  cold: "Cold",
  fire: "Fire",
  lightning: "Lightning",
  poison: "Poison",
  thunder: "Thunder",
};
const palettes = {
  // [orb shell, shell hue shift, impact color, recipe color]. Acid is a
  // yellow-green lime, poison a deeper emerald, lightning an electric blue
  // shell with a yellow discharge flash.
  acid: ["yellow", 20, "green", "#a8e05a"],
  cold: ["blue", 0, "blue", "#85d8ff"],
  fire: ["yellow", -15, "orange", "#ff9967"],
  lightning: ["blue", 0, "yellow", "#9fd4ff"],
  poison: ["green", 20, "green", "#5fd39a"],
  thunder: ["white", 0, "blue", "#ccd7ff"],
};
export function orbRecipe(config = {}, id = "chromatic-orb", catalog) {
  const element = Object.hasOwn(ORB_ELEMENTS, config.element)
    ? config.element
    : "fire";
  const [orb, hue, impact, color] = palettes[element];
  const charge = number(config.charge, 500, 5000, 1500);
  const flight = number(config.flight, 600, 5000, 800);
  const perSquare = number(config.perSquare, 0, 1000, 100);
  const pause = Math.min(number(config.pause, 0, 4000, 500), flight - 100);
  const scatter = number(config.scatter, 0, 1, 0.25);
  const impactKeys = [
    `jb2a.impact.002.${impact}`,
    `jb2a.impact.001.${impact}`,
    "jb2a.impact",
  ];
  const shrink = ["width", "height"].map((property) => ({
    property,
    from: 0,
    to: -1,
    duration: charge,
    ease: "easeOutCubic",
  }));
  const moving = {
    kind: "projectile",
    delay: charge,
    duration: flight,
    perSquare,
    moveDelay: pause,
    moveEase: "easeInBack",
    landingGroup: "orb-hit",
    scatter,
    fadeIn: 250,
  };
  const recipe = validateRecipe({
    id,
    name: `Chromatic orb · ${ORB_ELEMENTS[element]}`,
    category: "Arcane",
    color,
    description:
      "Two charging layers gather around the caster. A layered orb pulls back, flies to each target, then bursts on arrival. Element colors use installed JB2A variants.",
    enabled: true,
    trigger: "manual",
    match: "chromatic orb",
    stages: [
      {
        stageId: "charge-ring",
        label: "Orbit charge",
        kind: "cast",
        assets: [
          "jb2a.aura_themed.01.orbit.complete.metal.01.grey",
          "jb2a.aura_themed.01",
          "jb2a.impact",
        ],
        delay: 0,
        duration: charge + 1700,
        scale: 1.75,
        fadeIn: 500,
        clipStart: 5500,
        zIndex: 1,
        tracks: shrink,
      },
      {
        stageId: "charge-light",
        label: "Rainbow charge",
        kind: "cast",
        assets: [
          "jb2a.moonbeam.01.complete.rainbow",
          "jb2a.moonbeam.01",
          "jb2a.impact",
        ],
        delay: 0,
        duration: charge + 1000,
        scale: 1.5,
        fadeIn: 500,
        playbackRate: 1.25,
        fadeOut: 250,
        tracks: shrink,
      },
      {
        stageId: "release",
        label: "Release flash",
        kind: "cast",
        assets: impactKeys,
        delay: charge,
        duration: 650,
        scale: 1,
        zIndex: 3,
      },
      {
        ...moving,
        stageId: "orb-shell",
        label: "Orb shell",
        assets: [
          `jb2a.markers.light_orb.loop.${orb}`,
          "jb2a.markers.light_orb.loop",
          "jb2a.impact",
        ],
        scale: 1,
        hue,
        saturation: 1,
        scaleIn: 0,
        scaleInDuration: 500,
        ease: "easeOutBack",
        zIndex: 2,
      },
      {
        ...moving,
        stageId: "orb-core",
        label: "Rainbow core",
        assets: [
          "jb2a.moonbeam.01.loop.rainbow",
          "jb2a.moonbeam.01.loop",
          "jb2a.moonbeam.01",
          "jb2a.impact",
        ],
        scale: 0.45,
        zIndex: 1,
      },
      {
        stageId: "impact",
        label: `${ORB_ELEMENTS[element]} impact`,
        kind: "impact",
        assets: impactKeys,
        afterStage: "orb-core",
        startOffset: -100,
        delay: 0,
        duration: 900,
        scale: 1,
        landingGroup: "orb-hit",
        scatter,
      },
    ],
  });
  if (
    catalog &&
    resolveAsset(recipe.stages[0], catalog) !== recipe.stages[0].assets[0]
  )
    recipe.stages[0].clipStart = 0;
  // Free includes blue orb/impact variants. Shift those substitutes toward the
  // selected element instead of making every element appear blue.
  if (catalog)
    for (const index of [2, 3, 5]) {
      const stage = recipe.stages[index],
        resolved = resolveAsset(stage, catalog);
      if (resolved !== stage.assets[0] && resolved?.includes(".blue")) {
        stage.hue = {
          acid: -120,
          cold: 0,
          fire: 140,
          lightning: 0,
          poison: -100,
          thunder: 0,
        }[element];
        if (element === "thunder") {
          stage.saturation = -1;
          stage.brightness = 1.5;
        }
      }
    }
  return recipe;
}
