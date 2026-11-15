// The sound thin ice makes when it gives way: the ice itself, and a body going into the water under it. Two recordings, not
// one, because no recording is both at the weight this wants — the ice file carries the give, the splash carries the fall.
// Pure: no Foundry, no audio, no clock. The caller plays what this names, `gap` milliseconds apart.
//
// Chosen from the square's own key, so every screen plays the same break from what the GM stored, the same way the cracks and
// the hole are drawn from it (ice-break-look.mjs). Junk input gives null rather than an error, as the look does.

import { newKeys } from "./thin-ice.mjs";
// `newKeys` lives with the ice's own state: the word that floats over a break hangs on the same "new since this screen
// last looked" question. Passed on from here so a caller that only wants the sound has one import.
export { newKeys };

const ROOT = "modules/animater/assets/sounds/surfaces/freesound/";

// Roi's picks, auditioned on tools/fx-gallery/ice-sounds-audition.html. Loudness-matched to -17.5 dBFS (loudest 100 ms RMS)
// within 0.4 dB of each other, so one is never louder than another: tools/fx-gallery/ice-break-candidates/README.md.
export const ICE_BREAK_FILES = Object.freeze(["ice-break-840050-0.ogg", "ice-break-209818-0.ogg", "ice-break-837154-0.ogg"]);
export const ICE_SPLASH_FILES = Object.freeze(["body-splash-637947-0.ogg", "body-splash-530152-0.ogg", "body-splash-529794-0.ogg", "body-splash-469608-0.ogg"]);
// The gap he settled on auditioning the pair: the ice goes, then the water takes them.
export const ICE_SPLASH_GAP_MS = 120;

const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const pick = (list, n) => list[Math.min(list.length - 1, Math.floor(hash(n) * list.length))];

// "3,4" or "-1,2" -> a number to seed from, else null.
function keyNumber(key) {
  const m = typeof key === "string" ? /^(-?\d+),(-?\d+)$/.exec(key) : null;
  return m ? Number(m[1]) * 7919 + Number(m[2]) * 104729 : null;
}

// What the break sounds like at `key`: { ice, splash, gap } with full file paths, or null for a key that is not a square.
// `seed` separates two regions that both broke at the same square of the grid.
export function iceBreakSound(key, seed = 0) {
  const n = keyNumber(key);
  if (n === null) return null;
  const s = Number.isFinite(Number(seed)) ? Number(seed) : 0;
  return {
    ice: ROOT + pick(ICE_BREAK_FILES, n + s * 31),
    splash: ROOT + pick(ICE_SPLASH_FILES, n * 3 + s * 17 + 0.5),
    gap: ICE_SPLASH_GAP_MS,
  };
}
