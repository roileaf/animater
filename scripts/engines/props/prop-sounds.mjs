// The sound of a prop breaking: one recording of its material's family (wood for an unknown one), a splash when it
// held a liquid and a page flutter (extra) when it held books. Pure; `rand` (0-1) picks, so a note's seed gives every screen the same recording. Played by prop-wreck.mjs.
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
// A powder keg going off: four powder blasts (tannerite, a fireball, a cherry bomb).
export const BLAST_SOUNDS = names("explosion", "tannerite-tree-530163", "tannerite-forest-530162", "fireball-251759", "cherry-bomb-870713");
// A statue or pillar toppling: a statue falling over and a cinder block dropping.
export const TOPPLE_SOUNDS = names("stone-topple", "statue-fall-363836", "cinder-block-452579");
// A door or window frame forced, kicked or smashed in.
export const DOOR_SOUNDS = names("door-burst", "door-forced-160213", "wood-smash-536777", "door-kick-452609");
// Books spilling out of a broken bookcase or crate: laid over the wood break.
export const PAGE_SOUNDS = names("pages", "heavy-book-648959", "book-fall-185041", "books-falling-394912", "books-falling-509531");
// A brazier tipping over: metal clattering on the ground.
export const TIP_SOUNDS = names("metal-clatter", "steel-cup-569286", "metal-bucket-870887", "pots-pans-209002");
// A web, vine or bush burning away: the bundled fire sears. A cut web is
// silent: no honest recording of a web tearing was found (Roi's audition).
export const BURN_SOUNDS = ["fire-sear-630497-0", "fire-sear-630497-1", "fire-sear-852985-0", "fire-sear-852985-1", "fire-sear-873540-0", "fire-sear-873540-1"].map((id) => `modules/animater/assets/sounds/surfaces/freesound/${id}.ogg`);
const LIQUIDS = new Set(["water", "wine", "oil"]);

const pick = (list, rand) => list[Math.min(list.length - 1, Math.floor(rand() * list.length))];

// powder: a keg note's powder; "exploded" sounds the explosion in place of the material's break (spilled powder breaks
// like its material, without a splash). style "topple": a toppled statue sounds of falling stone, whatever its material;
// "burn": a prop burning away sounds of fire; "split": a cut web makes no sound (file null).
export function propSound(material, contents, rand, { powder, style } = {}) {
  if (powder === "exploded") return { file: pick(BLAST_SOUNDS, rand) };
  if (style === "topple") return { file: pick(TOPPLE_SOUNDS, rand) };
  if (style === "burn") return { file: pick(BURN_SOUNDS, rand) };
  if (style === "split") return { file: null };
  const list = Object.hasOwn(BREAK_SOUNDS, material) ? BREAK_SOUNDS[material] : BREAK_SOUNDS.wood;
  const out = { file: pick(list, rand) };
  if (LIQUIDS.has(contents)) out.splash = pick(SPLASH_SOUNDS, rand);
  if (contents === "books") out.extra = pick(PAGE_SOUNDS, rand);
  return out;
}

// The sound of a door or window breaking, by the wall note's kind. A door bursts with the door-burst family; a window shatters with the glass family; an unknown kind sounds like a door. Played by
// wall-wreck.mjs. material: a metal door clatters (the metal-clatter family), a stone one falls like stone (stone-topple).
const WALL_SOUNDS = { door: DOOR_SOUNDS, window: BREAK_SOUNDS.glass };
const DOOR_MATERIAL_SOUNDS = { metal: TIP_SOUNDS, stone: TOPPLE_SOUNDS };
export function wallSound(kind, rand, material) {
  if (kind === "door" && Object.hasOwn(DOOR_MATERIAL_SOUNDS, material)) return { file: pick(DOOR_MATERIAL_SOUNDS[material], rand) };
  return { file: pick(Object.hasOwn(WALL_SOUNDS, kind) ? WALL_SOUNDS[kind] : WALL_SOUNDS.door, rand) };
}

// A brazier tipping over and spilling its coals.
export const tipSound = (rand) => ({ file: pick(TIP_SOUNDS, rand) });
