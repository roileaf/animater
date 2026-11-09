// Suggests which Animater floor a clicked patch is, from its average colour alone. It is a guess for the GM to confirm.

import { rgbToLab } from "./floor-select.mjs";

const PROTOTYPE_COLOURS = Object.freeze({
  stone: [[128, 128, 130], [90, 90, 92], [165, 165, 165]],
  metal: [[120, 126, 138], [90, 96, 108]],
  glass: [[150, 205, 205]],
  ice: [[185, 215, 230]],
  snow: [[240, 242, 245]],
  water: [[40, 90, 150], [30, 70, 110], [70, 150, 170]],
  grass: [[70, 120, 50], [50, 90, 40], [110, 150, 70]],
  sand: [[200, 175, 110], [220, 200, 150]],
  dirt: [[105, 80, 50], [135, 105, 70]],
  wood: [[120, 80, 40], [90, 60, 35], [160, 110, 60]],
  mud: [[70, 55, 40]],
  pebbles: [[140, 130, 115], [115, 108, 98]],
  lava: [[225, 85, 20], [240, 140, 30], [150, 30, 10]],
});

export const FLOOR_PROTOTYPES = Object.freeze(Object.entries(PROTOTYPE_COLOURS).flatMap(([floor, colours]) =>
  colours.map((rgb) => Object.freeze({ floor, rgb, lab: rgbToLab(...rgb) }))));

export const SUGGEST_TUNING = Object.freeze({
  sample: 1500,
  // Confident only when the runner-up floor is clearly further away, as stone is from metal or dirt from wood is not.
  runnerUpRatio: 1.5,
  runnerUpMargin: 10,
});

export function suggestFloor(rgba, width, height, pixels) {
  const total = pixels?.length ?? 0;
  if (!total) return null;
  const { sample, runnerUpRatio, runnerUpMargin } = SUGGEST_TUNING;
  const n = Math.min(total, sample);
  let L = 0, a = 0, b = 0;
  for (let k = 0; k < n; k++) {
    // One pixel from each equal slice of the list, at a fixed pseudo-random spot, so no regular stripe can line up with it.
    const spot = Math.min(total - 1, Math.floor((k + ((Math.imul(k + 1, 2654435761) >>> 0) / 4294967296)) * total / n));
    const i = pixels[spot] * 4;
    const lab = rgbToLab(rgba[i], rgba[i + 1], rgba[i + 2]);
    L += lab[0]; a += lab[1]; b += lab[2];
  }
  const mean = [L / n, a / n, b / n];
  const nearest = new Map();
  for (const { floor, lab } of FLOOR_PROTOTYPES) {
    const d = Math.hypot(lab[0] - mean[0], lab[1] - mean[1], lab[2] - mean[2]);
    if (d < (nearest.get(floor) ?? Infinity)) nearest.set(floor, d);
  }
  const ranked = [...nearest.entries()].sort((x, y) => x[1] - y[1]);
  const [[floor, best], [runnerUp, second]] = ranked;
  const confident = second >= best * runnerUpRatio && second - best >= runnerUpMargin;
  return { floor, runnerUp, confidence: confident ? "high" : "low" };
}
