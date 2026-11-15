# Every bundled sound, measured

All 8508 bundled .ogg measured with ffmpeg: sample peak, loudest 100 ms RMS (the metric the props audit
matches families on, sliding window, 10 ms hop), the noise floor (quietest 5% of 20 ms blocks), and whether four
samples in a row sit at full scale. Run after Roi said some sounds were far louder than others.

## What it found

| role | folders | files | quietest set | median | loudest set | spread | clipped files |
| --- | --- | --- | --- | --- | --- | --- | --- |
| creature voices | 162 | 7840 | -26.9 | -14.2 | -0.8 | 26.1 dB | 638 |
| surfaces | 2 | 360 | -17.8 | -12.6 | -12.6 | 5.2 dB | 75 |
| wildlife | 24 | 101 | -34.6 | -24.0 | -14.7 | 19.9 dB | 0 |
| creatures | 3 | 49 | -25.9 | -21.2 | -20.7 | 5.3 dB | 0 |
| vehicles | 1 | 41 | -18.1 | -18.1 | -18.1 | 0.0 dB | 0 |
| props | 11 | 37 | -20.6 | -17.7 | -16.1 | 4.5 dB | 0 |
| underground | 7 | 35 | -30.6 | -21.1 | -18.0 | 12.5 dB | 0 |
| places | 2 | 23 | -24.3 | -23.1 | -23.1 | 1.3 dB | 0 |
| weather | 5 | 22 | -30.0 | -24.4 | -12.7 | 17.3 dB | 2 |

The creature voices are the finding: 26.1 dB from the quietest set to the loudest, which is twenty times the
amplitude. A cyclops sat at -0.8 dBFS and a golem at -26.9. Props, vehicles and the surfaces were already within
about 5 dB of themselves and were left alone. Some of the wildlife spread is meant: a cricket should be quieter
than a wolf, so ambience was not levelled either.

## What was done

Each voice set is brought to -16 dBFS, the level the props families already use, by a gain applied WHEN THE CRY IS
PLAYED (scripts/engines/sound/voice-levels.mjs). The .ogg are untouched: baking the gain in would mean a second
lossy encode of 203 MB, and a number that is wrong by ear is then a one-line change instead of a re-encode.

No set is lifted so far that its own loudest peak would pass -1 dBFS, so 18 spiky sets stop short of the target.
Set to set, the spread falls from 26.1 dB to 8.4 dB, and 90% of sets land within 0.3 dB of -16.

## Clipped at source: 715 files, in 35 folders

Four or more samples in a row at full scale. The distortion is already in the file, so playback gain cannot undo
it; turning the set down makes it less audible and nothing more. Fixing it properly needs the uncompressed
originals, which are not in the repository. Recorded here so it is known rather than rediscovered.

| folder | clipped |
| --- | --- |
| `surfaces/kenney` | 74 |
| `voices/library/swine/pig` | 68 |
| `voices/library/spider/spider-queen` | 24 |
| `voices/library/reptile/velociraptor` | 24 |
| `voices/library/reptile/t-rex` | 24 |
| `voices/library/reptile/serpent` | 24 |
| `voices/library/reptile/brontosaurus` | 24 |
| `voices/library/reptile/basilisk` | 24 |
| `voices/library/hoofed/great-rhino` | 24 |
| `voices/library/giant/cyclops` | 24 |
| `voices/library/feline/sabre-toothed-cat` | 24 |
| `voices/library/elephant/mammoth` | 24 |
| `voices/library/dragon/wyvern` | 24 |
| `voices/library/dragon/dragon-huge` | 24 |
| `voices/library/bird/pterodactyl` | 24 |
| `voices/library/bear/great-bear` | 24 |
| `voices/library/dragon/dragon` | 22 |
| `voices/library/swine/wild-boar` | 20 |
| `voices/library/brute/orc` | 20 |
| `voices/library/reptile/lizard-man` | 18 |
| `voices/library/canine/hell-hound` | 18 |
| `voices/library/swine/warthog` | 16 |
| `voices/library/goblin/raging-goblin` | 16 |
| `voices/library/brute/orc-aggressive-male` | 16 |
| `voices/library/wraith/banshee` | 14 |
| `voices/library/giant/water-giant` | 14 |
| `voices/library/aberration/alien` | 14 |
| `voices/library/beast/beast` | 12 |
| `voices/library/zombie/zombie` | 10 |
| `voices/library/aberration/giant-worm` | 8 |
| `voices/library/bird/ancient-bird` | 6 |
| `voices/library/beast/seal` | 6 |
| `voices/library/insect/ant-warrior` | 4 |
| `weather/thunder` | 2 |
| `surfaces/freesound` | 1 |
