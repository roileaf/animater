// How loud each bundled voice set is, measured, so one creature is not twenty times another.
//
// Every bundled sound was measured (loudest 100 ms RMS, the metric the props audit matches on). The creature voices
// came in 26 dB apart from set to set: a cyclops sat at -0.8 dBFS and a golem at -26.9, which is twenty times the
// amplitude, and the table heard it (Roi: "some of them are loud as FUCK"). Everything else -- props, vehicles, the
// surfaces -- already sat within about 5 dB, so only the voices are levelled here.
//
// Each set is brought to -16 dBFS, the level the props families already use, so a goblin and a breaking crate sit
// together. The gain is applied when the cry is played, NOT baked into the files: the .ogg stay as they were shipped,
// which keeps them free of a second lossy encode and makes any number here a one-line change if it sounds wrong.
//
// No set is lifted so far that its own loudest peak would pass -1 dBFS. A few sets are spiky -- a short, hard
// transient over a quiet cry -- so they stop short of the target rather than clip; they are named at the foot of this
// file. A set already within half a decibel of the target is not listed at all.
//
// A voice from the GM's own folder (voice-library.mjs) is not in here and is played as it is: it was never measured,
// and guessing at it would be worse than leaving it alone.
export const VOICE_LEVELS = Object.freeze({
  "voices/bat": 0.889,
  "voices/brute": 0.679,
  "voices/canine": 0.733,
  "voices/dragon": 0.597,
  "voices/equine": 0.814,
  "voices/fiend-woman": 0.759,
  "voices/giant": 0.771,
  "voices/goblin": 0.807,
  "voices/golem": 0.464,
  "voices/kaiju": 0.565,
  "voices/khron/aberration/hurt": 1.111,
  "voices/khron/dragon/attack": 0.909,
  "voices/khron/goblin/death": 0.859,
  "voices/khron/goblin/hurt": 1.127,
  "voices/khron/monster-vol-1/attack": 0.911,
  "voices/khron/monster-vol-1/death": 0.827,
  "voices/khron/monster-vol-2/death": 0.937,
  "voices/khron/orc/attack": 1.198,
  "voices/khron/orc/death": 1.108,
  "voices/khron/orc/hurt": 1.068,
  "voices/khron/skeleton/death": 1.164,
  "voices/khron/spectre/attack": 0.727,
  "voices/khron/spectre/death": 0.884,
  "voices/khron/spectre/hurt": 0.769,
  "voices/khron/spider/attack": 1.107,
  "voices/khron/spider/death": 0.93,
  "voices/khron/spider/hurt": 1.063,
  "voices/khron/troll/attack": 0.944,
  "voices/khron/troll/death": 0.928,
  "voices/library/aberration/aberration-flutter-male": 1.287,
  "voices/library/aberration/aberration-male": 0.727,
  "voices/library/aberration/alien": 0.286,
  "voices/library/aberration/giant-worm": 0.291,
  "voices/library/bear/great-bear": 0.232,
  "voices/library/beast/beast": 0.35,
  "voices/library/beast/seal": 0.7,
  "voices/library/bird/ancient-bird": 0.49,
  "voices/library/bird/crow": 1.083,
  "voices/library/bird/phoenix": 0.561,
  "voices/library/bird/pterodactyl": 0.33,
  "voices/library/brute/ogre-animalistic-male": 1.149,
  "voices/library/brute/ogre-male": 0.677,
  "voices/library/brute/orc": 0.356,
  "voices/library/brute/orc-aggressive-male": 0.579,
  "voices/library/brute/orc-animalistic-female": 1.108,
  "voices/library/brute/orc-female": 0.759,
  "voices/library/brute/orc-male": 0.725,
  "voices/library/brute/troll-male": 0.634,
  "voices/library/canine/hell-hound": 0.242,
  "voices/library/dragon/dragon": 0.347,
  "voices/library/dragon/dragon-huge": 0.18,
  "voices/library/dragon/wyvern": 0.268,
  "voices/library/elephant/mammoth": 0.179,
  "voices/library/feline/sabre-toothed-cat": 0.242,
  "voices/library/fiend-woman/creature-animalistic-female": 0.807,
  "voices/library/fiend-woman/creature-croaky-female": 0.846,
  "voices/library/fiend-woman/creature-eerie-female": 0.914,
  "voices/library/fiend-woman/creature-howling-female": 0.737,
  "voices/library/fiend-woman/creature-roaring-female": 0.921,
  "voices/library/fiend-woman/creature-small-female": 0.855,
  "voices/library/fiend-woman/creature-throaty-female": 0.872,
  "voices/library/fiend-woman/hag-female": 0.83,
  "voices/library/fiend-woman/hag-roaring-female": 1.245,
  "voices/library/giant/cyclops": 0.174,
  "voices/library/giant/giant-deep-male": 1.54,
  "voices/library/giant/giant-male": 0.635,
  "voices/library/giant/water-giant": 0.218,
  "voices/library/goblin/goblin-female": 0.81,
  "voices/library/goblin/goblin-small-female": 1.176,
  "voices/library/goblin/kobold-male": 0.713,
  "voices/library/goblin/kobold-small-male": 1.467,
  "voices/library/goblin/raging-goblin": 0.503,
  "voices/library/golem/golem": 0.621,
  "voices/library/golem/golem-raspy": 3.521,
  "voices/library/hoofed/great-rhino": 0.179,
  "voices/library/insect/ant-warrior": 0.504,
  "voices/library/insect/bug": 0.512,
  "voices/library/monster/creature-aggressive-male": 0.821,
  "voices/library/monster/creature-animalistic-male": 0.831,
  "voices/library/monster/creature-crazy-male": 0.735,
  "voices/library/monster/creature-croaky-male": 0.874,
  "voices/library/monster/creature-deep-male": 0.854,
  "voices/library/monster/creature-flutter-male": 0.859,
  "voices/library/monster/creature-generic-male": 0.853,
  "voices/library/monster/creature-greasy-male": 0.8,
  "voices/library/monster/creature-howling-male": 0.815,
  "voices/library/monster/creature-raspy-male": 0.796,
  "voices/library/monster/creature-screeching-male": 0.777,
  "voices/library/monster/creature-slimy-male": 0.864,
  "voices/library/monster/creature-small-male": 0.746,
  "voices/library/monster/creature-throaty-male": 0.757,
  "voices/library/ooze/ooze": 0.654,
  "voices/library/raptor/vulture": 0.86,
  "voices/library/reptile/basilisk": 0.24,
  "voices/library/reptile/brontosaurus": 0.19,
  "voices/library/reptile/lizard-man": 0.336,
  "voices/library/reptile/serpent": 0.294,
  "voices/library/reptile/t-rex": 0.197,
  "voices/library/reptile/velociraptor": 0.241,
  "voices/library/spider/spider-queen": 0.271,
  "voices/library/swine/pig": 0.575,
  "voices/library/swine/warthog": 0.428,
  "voices/library/swine/wild-boar": 0.334,
  "voices/library/undead/vampire-croaky-male": 0.925,
  "voices/library/undead/vampire-male": 0.657,
  "voices/library/wraith/banshee": 0.311,
  "voices/library/wraith/banshee-eerie-echo-female": 1.389,
  "voices/library/wraith/banshee-female": 0.514,
  "voices/library/wraith/spectre-male": 0.575,
  "voices/library/wraith/spectre-screeching-male": 1.595,
  "voices/library/wraith/wraith-air-male": 0.709,
  "voices/library/wraith/wraith-eerie-male": 0.882,
  "voices/library/wraith/wraith-male": 0.525,
  "voices/library/zombie/ghast-male": 0.605,
  "voices/library/zombie/ghast-throaty-male": 1.877,
  "voices/library/zombie/ghoul-crazy-male": 1.462,
  "voices/library/zombie/ghoul-croaky-female": 1.484,
  "voices/library/zombie/ghoul-female": 0.674,
  "voices/library/zombie/ghoul-male": 0.66,
  "voices/library/zombie/mummy-female": 0.692,
  "voices/library/zombie/mummy-throaty-female": 1.295,
  "voices/library/zombie/wight-howling-male": 1.14,
  "voices/library/zombie/wight-male": 0.622,
  "voices/library/zombie/zombie": 0.345,
  "voices/library/zombie/zombie-female": 0.687,
  "voices/library/zombie/zombie-generic-male": 0.751,
  "voices/library/zombie/zombie-male": 0.756,
  "voices/man": 0.694,
  "voices/monster": 0.799,
  "voices/ooze": 0.833,
  "voices/reptile": 0.813,
  "voices/rodent": 1.266,
  "voices/skeleton": 1.117,
  "voices/spider": 0.941,
  "voices/swarm": 0.87,
  "voices/woman": 0.737,
  "voices/wraith": 0.639,
  "voices/zombie": 0.83,
});

// The sets that could not reach the target without their own peaks clipping, and where they ended up instead. Kept as
// a note, not as code: nothing reads it, and it is here so the next person does not re-measure to learn it.
/* held back by their own peaks:
 *    -24.4 dBFS  voices/library/aberration/aberration-flutter-male  (wanted 10.6 dB, peak -3.2)
 *    -23.1 dBFS  voices/library/zombie/ghoul-crazy-male  (wanted 10.4 dB, peak -4.3)
 *    -22.3 dBFS  voices/library/raptor/vulture  (wanted 5.0 dB, peak 0.3)
 *    -20.9 dBFS  voices/library/zombie/mummy-throaty-female  (wanted 7.1 dB, peak -3.2)
 *    -20.7 dBFS  voices/library/brute/ogre-animalistic-male  (wanted 5.9 dB, peak -2.2)
 *    -20.7 dBFS  voices/library/zombie/ghoul-croaky-female  (wanted 8.1 dB, peak -4.4)
 *    -20.3 dBFS  voices/library/giant/giant-deep-male  (wanted 8.1 dB, peak -4.7)
 *    -20.2 dBFS  voices/library/brute/orc-animalistic-female  (wanted 5.1 dB, peak -1.9)
 *    -19.9 dBFS  voices/library/zombie/ghast-throaty-male  (wanted 9.4 dB, peak -6.5)
 *    -19.2 dBFS  voices/library/goblin/kobold-small-male  (wanted 6.5 dB, peak -4.3)
 *    -18.3 dBFS  voices/library/swine/pig  (wanted -2.5 dB, peak 3.8)
 */

/** What to multiply a bundled cry's volume by, 1 for anything not measured (a GM's own voice, or a set already at
 *  the target). `file` is the path it is played from; the set is the folder it sits in. Pure. */
export function voiceGain(file, levels = VOICE_LEVELS) {
  const path = String(file ?? "");
  const at = path.indexOf("assets/sounds/");
  if (at < 0) return 1;
  const parts = path.slice(at + "assets/sounds/".length).split("/");
  parts.pop();
  return levels[parts.join("/")] ?? 1;
}
