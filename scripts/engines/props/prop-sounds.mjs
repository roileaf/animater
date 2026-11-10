// The sound of a prop breaking: one recording of its material's family (wood for an unknown one), and a splash when it
// held a liquid. Pure; `rand` (0-1) picks, so a note's seed gives every screen the same recording. Played by prop-wreck.mjs.
const BASE = "modules/animater/assets/sounds/props";
const names = (family, ...ids) => ids.map((id) => `${BASE}/${family}/${id}.ogg`);

export const BREAK_SOUNDS = {
  wood: names("wood", "barrel-break-66772", "crate-break-66780", "pallet-break-856631", "barrel-break-66769", "barrel-break-66770", "barrel-break-66771", "crate-break-66777", "crate-break-66778", "crate-break-66779"),
  glass: names("glass", "bottle-shatter-202093", "bottle-smash-199401", "bottle-break-212698"),
  clay: names("clay", "ceramic-break-623130-a", "clay-pottery-399080-a"),
  metal: names("metal", "metal-clang-686649"),
  stone: names("stone", "rock-crumble-391919", "stone-crumble-521956", "stone-impact-513694", "rock-drop-746473", "small-rocks-576108"),
};
export const SPLASH_SOUNDS = names("splash", "water-splash-186748");
const LIQUIDS = new Set(["water", "wine", "oil"]);

const pick = (list, rand) => list[Math.min(list.length - 1, Math.floor(rand() * list.length))];

export function propSound(material, contents, rand) {
  const list = Object.hasOwn(BREAK_SOUNDS, material) ? BREAK_SOUNDS[material] : BREAK_SOUNDS.wood;
  const out = { file: pick(list, rand) };
  if (LIQUIDS.has(contents)) out.splash = pick(SPLASH_SOUNDS, rand);
  return out;
}

// The sound of a door or window breaking, by the wall note's kind. Until a door's own family ships (Task 17), a door
// breaks with the wood family; an unknown kind sounds like a door. Played by wall-wreck.mjs.
const WALL_SOUNDS = { door: BREAK_SOUNDS.wood };
export function wallSound(kind, rand) {
  return { file: pick(Object.hasOwn(WALL_SOUNDS, kind) ? WALL_SOUNDS[kind] : WALL_SOUNDS.door, rand) };
}
