// Which document writes the map's rebuilds may ignore, as ONE thing in ONE place.
//
// Animater listens for walls, regions and scenes changing and rebuilds a great deal when they do: the floors and their
// planes, the canopy and its glows, the sky, the wall shadows, the trunks, the heights, the air, the life, the movement
// views, the ground looks, the blood, the drafts — and the smoke round's own room walk. All of that is right when a GM
// has really edited the map, and all of it is waste when the write was a feature talking to itself.
//
// Three such voices, and they are quiet:
//   - Foundry keeps the game's clock in a setting, so every tick of it arrives as a setting saved.
//   - A decoration break storing or clearing its own flag on a region (decor-break.mjs decorOnlySave).
//   - The smoke round putting its own cells back on the scene (smoke-round.mjs smokeOnlySave) and its own concealment
//     region back beside them (smoke-regions.mjs smokeRegionSave), every few seconds for as long as anything burns.
//
// This lived spelled out in main.mjs, where the only thing that could check it was a source-text regex — three of them,
// in three different suites — and the test that cared most re-implemented the composition instead of using it, so a
// clause could have been dropped here while that test went on passing. It is one exported function now: main.mjs calls
// it and keeps no copy, and no test writes its own.
import { decorOnlySave } from "./decor-break.mjs";
import { smokeOnlySave } from "./smoke-round.mjs";
import { smokeRegionSave } from "./smoke-regions.mjs";

// Foundry's own clock, saved as a setting. `first` is the setting, not a document, so it has no documentName.
export const isClockSave = (first) => first?.key === "core.time";

// `first` is whatever the hook handed over first — a Setting for a clock save, else the document written. `changes` and
// `options` are the hook's next two, which for a create or a delete are the options and the user id instead (each
// reader below knows its own shapes). True: a feature talking to itself, so the rebuilds may skip it. Pure.
export function quietSave(first, changes, options) {
  if (isClockSave(first)) return true;
  if (first?.documentName === "Region") return decorOnlySave(changes, options) || smokeRegionSave(first, changes, options);
  if (first?.documentName === "Scene") return smokeOnlySave(changes, options);
  return false;
}
