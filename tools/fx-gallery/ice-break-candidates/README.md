# Thin ice: creak and break sound candidates

Candidates for the two sounds thin ice wants, for Roi to audition on
`tools/fx-gallery/ice-sounds-audition.html`. Nothing is wired up and nothing ships until he picks.

**Every candidate here is already bundled with Animater.** No recording was fetched, added, re-encoded
or re-mastered for this audit: these are the files that already sit under `assets/sounds/`, measured as
they are. So this audit adds no licence risk and no bytes — it only says which of what we already have
could carry the two events, and how each one measures.

The two events, as the feature already whispers them:

- **creak** — a creature one size over the limit cracks the square it enters. Happens up to several times
  in one move. Wants to be short and small.
- **break** — the ice gives way and the creature is in the water. Happens once. Wants weight, and
  arguably a wet half (see "The pairing question").

## Sources and licence proof

- **Freesound candidates** are CC0 1.0 (public domain), attributed per file in
  `assets/sounds/surfaces/freesound/License.txt` and `assets/sounds/props/License.txt`, each line naming
  the source page. They were trimmed, faded and loudness-matched when they were first bundled, for their
  own original uses; this audit did not touch them.
- **Kenney candidates** (`impactGlass_heavy_*`) are CC0 from Kenney's Impact Sounds 1.0,
  https://kenney.nl/assets/impact-sounds, recorded in `assets/sounds/surfaces/kenney/License.txt`.
- No Pixabay, Mixkit, ZapSplat, Sonniss, CC-BY, NC, SA or ND material.

## How these were measured

Same metrics and the same thresholds as `tools/fx-gallery/props-break-candidates/README.md`, so the two
tables can be read side by side:

- **peak** — sample peak of the encoded `.ogg` as decoded. The props standard wants `<= -1.2 dBFS`.
- **100ms RMS** — loudest 100 ms RMS, sliding with a 10 ms hop. This is the loudness-match metric.
- **LUFS** — ebur128 integrated loudness. **Only meaningful above about 0.4 s**: ebur128 gates in 400 ms
  blocks, so a shorter clip returns its floor (`-70`). Those are shown as `n/a`, not as silence.
- **noise floor** — quietest 5% of 20 ms blocks. `-inf` means the clip contains digital silence.
- **clipping** — a run of 4 or more consecutive samples at `>= 0.985` of full scale. The props standard
  rejects a source on this.

**Method check:** run against the four candidates this audit shares with the props audit, every figure
reproduces that README exactly (`bottle-shatter-202093` -9.1 / -18.1 / -21.9, `bottle-smash-199401`
-1.9 / -18.1 / -25.0, `bottle-break-212698` -3.0 / -18.1 / -22.6, `water-splash-186748` -2.1 / -17.7 /
-19.6). The measurements below are on the same footing as the ones already accepted.

## creak — 8 candidates

All from `assets/sounds/surfaces/freesound/`, already played as the `cold` surface by
`engines/motion/energy-blast.mjs`. Three of them are literally recordings of ice breaking, not of frost.

| file | source | author | licence | what it is | length | peak | 100ms RMS | LUFS | noise floor | clipping |
|---|---|---|---|---|---|---|---|---|---|---|
| `frost-crack-213579-0.ogg` | [Ice Break Crunch Crack Foott 02](https://freesound.org/people/JackMenhorn/sounds/213579/) | JackMenhorn | CC0 1.0 | A foot breaking through ice crust. The nearest thing we own to the event itself. | 0.56 s | -2.9 | -12.3 | -17.2 | -inf | no |
| `frost-crack-213579-1.ogg` | [Ice Break Crunch Crack Foott 02](https://freesound.org/people/JackMenhorn/sounds/213579/) | JackMenhorn | CC0 1.0 | Second take of the same. | 0.58 s | -3.1 | -12.7 | -17.9 | -139.5 | no |
| `frost-crack-422619-0.ogg` | [Breaking ice - small 2](https://freesound.org/people/Aurelon/sounds/422619/) | Aurelon | CC0 1.0 | Small sheet ice breaking. Dry, no water. | 0.81 s | -0.5 | -14.8 | -19.0 | -inf | no |
| `frost-crack-114253-0.ogg` | [Icicles breaking.wav](https://freesound.org/people/GodofPH/sounds/114253/) | GodofPH | CC0 1.0 | Icicles snapping. Brittle and high; reads as frost more than as a sheet. | 0.75 s | -0.6 | -18.5 | -25.3 | -inf | no |
| `frost-crack-264420-0.ogg` | [ICICLES breaking series.wav](https://freesound.org/people/RMSound/sounds/264420/) | RMSound | CC0 1.0 | Icicles, series. | 0.45 s | +0.7 | -13.5 | -14.6 | -155.7 | no |
| `frost-crack-264420-1.ogg` | [ICICLES breaking series.wav](https://freesound.org/people/RMSound/sounds/264420/) | RMSound | CC0 1.0 | Shortest of the set — a single tick. | 0.20 s | -0.8 | -17.3 | n/a | -105.1 | no |
| `frost-crack-539696-0.ogg` | [throwing a single ice cube at roof.wav](https://freesound.org/people/Anthousai/sounds/539696/) | Anthousai | CC0 1.0 | An ice cube thrown at a roof. Has a tail and a room on it; longest of the set. | 1.60 s | -1.4 | -14.3 | -26.8 | -inf | no |
| `frost-crack-608685-0.ogg` | [Wham n Shatter](https://freesound.org/people/eben-frostey/sounds/608685/) | eben-frostey | CC0 1.0 | A whack then a shatter. Loudest of the set; reads as an impact, not a creak. | 1.23 s | -4.3 | -11.9 | -21.1 | -180.6 | no |

**Finding — this set is not loudness-matched.** Its 100ms RMS spreads **6.6 dB**, from -11.9
(`608685-0`) to -18.5 (`114253-0`). They were matched for their original use, not against each other.
If the creak picks at random from several of these, the volume will jump audibly between steps of one
walk. Either pick **one** file, or pick a few and gain-match them to a single target before they ship.

**Finding — `264420-0` peaks at +0.7 dBFS**, above full scale on decode, against the props standard's
`<= -1.2`. It does not clip by the run test, but it has no headroom.

## break, ice half — 8 candidates

| file | source | author | licence | what it is | length | peak | 100ms RMS | LUFS | noise floor | clipping |
|---|---|---|---|---|---|---|---|---|---|---|
| `props/glass/bottle-shatter-202093.ogg` | [Bottle Shattering.wav](https://freesound.org/people/spookymodem/sounds/202093/) | spookymodem | CC0 1.0 | Glass bottle shattering. Already loudness-matched to the props glass family. | 0.85 s | -9.1 | -18.3 | -21.9 | -69.5 | no |
| `props/glass/bottle-break-212698.ogg` | [Breaking a glass bottle](https://freesound.org/people/dasebr/sounds/212698/) | dasebr | CC0 1.0 | Glass bottle breaking, shorter. | 0.56 s | -3.0 | -18.1 | -22.6 | -64.7 | no |
| `props/glass/bottle-smash-199401.ogg` | [Small Bottle Smash FF223.aif](https://freesound.org/people/martinimeniscus/sounds/199401/) | martinimeniscus | CC0 1.0 | Liquid-filled bottle smashed with a hammer. Bright; the only one with liquid in it. | 0.94 s | -1.9 | -18.1 | -25.0 | -75.4 | no |
| `surfaces/kenney/impactGlass_heavy_000.ogg` | [Impact Sounds 1.0](https://kenney.nl/assets/impact-sounds) | Kenney | CC0 | Heavy glass impact. | 0.24 s | **+2.1** | -13.9 | n/a | -108.9 | **yes** |
| `surfaces/kenney/impactGlass_heavy_001.ogg` | [Impact Sounds 1.0](https://kenney.nl/assets/impact-sounds) | Kenney | CC0 | Heavy glass impact. | 0.43 s | **+2.2** | -13.6 | -21.4 | -inf | **yes** |
| `surfaces/kenney/impactGlass_heavy_002.ogg` | [Impact Sounds 1.0](https://kenney.nl/assets/impact-sounds) | Kenney | CC0 | Heavy glass impact. | 0.24 s | **+2.0** | -14.9 | n/a | -124.7 | **yes** |
| `surfaces/kenney/impactGlass_heavy_003.ogg` | [Impact Sounds 1.0](https://kenney.nl/assets/impact-sounds) | Kenney | CC0 | Heavy glass impact; shortest. | 0.17 s | **+1.9** | -14.1 | n/a | -111.5 | **yes** |
| `surfaces/kenney/impactGlass_heavy_004.ogg` | [Impact Sounds 1.0](https://kenney.nl/assets/impact-sounds) | Kenney | CC0 | Heavy glass impact; noisiest floor of the five. | 0.40 s | **+2.0** | -13.2 | n/a | -34.8 | **yes** |

**Finding — every Kenney `impactGlass_heavy` file fails the props standard on two counts.** All five
peak **above full scale** (+1.9 to +2.2 dBFS) and all five carry runs of 4 or more consecutive samples at
or above 0.985 of full scale. The props audit rejects a source on exactly that test. They are also 4-5 dB
hotter by 100ms RMS than every other break candidate, so dropped in beside the glass family they would
jump out and distort.

This overshoot is partly expected of a lossy source mastered to full scale — Vorbis decode can exceed
±1.0 where the original sat at the ceiling — but the consequence at the table is the same, so **I would
not ship these as the break.** That removes one of the three candidates I named in the hand-over note;
calling them a candidate there was a guess, and measuring them is what caught it. They are a pre-existing
bundled asset used elsewhere as a surface hit, so this is a note about this feature, not a defect to fix
on this branch.

## break, water half — 4 candidates

| file | source | author | licence | what it is | length | peak | 100ms RMS | LUFS | noise floor | clipping |
|---|---|---|---|---|---|---|---|---|---|---|
| `props/splash/water-splash-186748.ogg` | [Splash-eau-goudron1.wav](https://freesound.org/people/rombart/sounds/186748/) | rombart | CC0 1.0 | Close-miked splash, denoised. Reads as the creature going in. | 0.45 s | -2.1 | -17.7 | -19.6 | -73.4 | no |
| `surfaces/freesound/body-water-166313-0.ogg` | [Sloshing.wav](https://freesound.org/people/deleted_user_2104797/sounds/166313/) | deleted_user_2104797 | CC0 1.0 | Water sloshing. Softer; reads as water moving, not as entry. | 0.29 s | -3.6 | -18.5 | n/a | -58.0 | no |
| `surfaces/freesound/body-water-841151-0.ogg` | [Watering_Can_Slosh](https://freesound.org/people/SonicOddities/sounds/841151/) | SonicOddities | CC0 1.0 | Slosh. | 0.37 s | -2.9 | -18.7 | n/a | -58.9 | no |
| `surfaces/freesound/body-water-841151-1.ogg` | [Watering_Can_Slosh](https://freesound.org/people/SonicOddities/sounds/841151/) | SonicOddities | CC0 1.0 | Slosh, shorter. | 0.25 s | -3.6 | -19.7 | n/a | -79.3 | no |

This half is well behaved: all four within 2 dB of each other and of the glass family.

## The pairing question

A real break is two things in a row — ice giving way, then a body in water — and we own no single
recording of that. The audition page therefore has a **Pair** panel at the bottom: pick an ice file, pick
a water file, set a delay, and hear them together. The answer decides what the feature plays:

- **one file** — simplest, and `bottle-smash-199401` is the only candidate with any liquid in it.
- **a pair** — richer, and the only way to get both halves from what we have. Costs a second playback
  call and a decision about the gap.

My own reading, worth exactly what an unlistened opinion is worth: `frost-crack-213579-0` for the creak
(it is a foot going through ice crust, which is the event), and `bottle-break-212698` + `water-splash-186748`
at about 120 ms apart for the break. **Do not take that as a pick.** The standard is that you hear them.

## Proposed loudness targets, if anything ships

Not applied — stated so there is something to match against. Following the props families and the
existing surface sounds (-13 to -18):

- **creak: -18.0 dBFS** 100ms RMS. It fires repeatedly under one walk and must not nag. Every candidate
  except `114253-0` and `264420-1` needs cutting, `608685-0` by 6.1 dB.
- **break: -17.5 dBFS** 100ms RMS, matching the props splash family. The three Freesound glass files are
  already within 0.8 dB; the water half within 2.2 dB.

Re-mastering a bundled file in place would change it for every other feature that plays it, so a pick
that needs gain should be written as a **playback gain** in the sound profile, not baked into the asset.

## Not candidates, and why

- `crunch-*.ogg` — all five are gore: bone breaks and an egg shell. Wrong event.
- `ice-step-*.ogg`, `glass-step-*.ogg` — footfalls, far too small for a break and already the ice's steps.
- `props/stone/rock-crumble-*.ogg`, `stone-crumble-*.ogg` — read as rock; no ice or water in them.
- `kenney/footstep_snow_*.ogg` — snow underfoot, not ice giving way.

## Unrelated finding, not fixed here

Three bundled files have **no attribution line** in `assets/sounds/surfaces/freesound/License.txt`:
`ice-step-405635-0.ogg`, `ice-step-539683-0.ogg` and `ice-step-539683-2.ogg`. Every other file in that
folder has one (232 lines cover the rest), and their siblings `ice-step-416939-0.ogg` and
`ice-step-732880-*.ogg` are listed. The Freesound ids are in the filenames, so the provenance is
recoverable, but as the folder stands those three ship without the CC0 declaration the others carry.

Pre-existing, nothing to do with thin ice, and not fixed on this branch: filling it in means confirming
each source page, which is a licence claim I will not make from a filename. Worth a look before the next
release.
