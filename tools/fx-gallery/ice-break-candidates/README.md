# Thin ice: creak and break sound candidates

Candidates for the two sounds thin ice wants, for Roi to audition on
`tools/fx-gallery/ice-sounds-audition.html`. Nothing is wired up and nothing ships until he picks.

The two events:

- **creak** — a creature one size over the limit cracks the square it enters. Happens up to several times
  in one move. Short and small.
- **break** — the ice gives way and the creature is in the water. Happens once. Roi's note on the first
  round: *"it needs to be a big splash of water"*. Everything the module already owned was bucket-scale,
  so 16 new candidates were fetched for this.

Two kinds of files are listed here:

- **Fetched candidates** (`icewater/`, `bigsplash/`) — new, trimmed and loudness-matched for this feature.
  The `.ogg` files stay **untracked**; only this README and the audition page are committed, exactly as
  the breakable-props audit does. Nothing is added to `assets/` until Roi picks.
- **Already bundled** — files the module already ships, measured as they are for comparison. Nothing was
  re-encoded.

## Sources and licence proof

- Every fetched recording is from Freesound and **CC0 1.0** (public domain). The licence was checked per
  file on its own sound page, and the fetch script **refuses to download** any page that does not link
  `creativecommons.org/publicdomain/zero/1.0/`; the search itself was also filtered to CC0. Every file
  below came through that gate, so its presence here is the proof.
- The audio fetched is the Freesound HQ preview mp3 from the public CDN (the original download needs a
  login), decoded with ffmpeg. Raw downloads sit in `C:\tmp\props-sounds-raw\icewater\<id>.mp3` and
  `...\bigsplash\<id>.mp3` (that folder name is the props run's; the ice fetch reused its tooling) and
  were only ever read by ffmpeg, never executed. Cached source pages are in `...\pages\<id>.html`.
- Bundled files are attributed in `assets/sounds/surfaces/freesound/License.txt`,
  `assets/sounds/props/License.txt` and `assets/sounds/surfaces/kenney/License.txt`.
- No Pixabay, Mixkit, ZapSplat, Sonniss, CC-BY, NC, SA or ND material.

## How these were measured and made

Same pipeline, metrics and thresholds as `tools/fx-gallery/props-break-candidates/README.md`, so the two
can be read side by side. Mono, 44.1 kHz, trimmed to the event, 3 ms fade in, cosine fade out, plain gain
iterated until the encoded file measures on target, a peak limiter (ffmpeg `alimiter`, ceiling -2.2 dBFS)
and Vorbis q5.

- **peak** — sample peak of the encoded `.ogg`, must be `<= -1.2 dBFS`.
- **100ms RMS** — loudest 100 ms RMS, 10 ms hop. The loudness-match metric.
- **LUFS** — ebur128 integrated loudness. Only meaningful above about 0.4 s; shorter clips show `n/a`.
- **noise floor** — quietest 5% of 20 ms blocks of the whole source with the applied gain added.
- **clipping** — a run of 4+ consecutive samples at `>= 0.985` of full scale is a rejection.

**Loudness target for the break: -17.5 dBFS** 100ms RMS, matching the props splash family. Every fetched
candidate below lands between **-17.4 and -17.8** — within 0.4 dB of each other, so they can be compared
by character instead of by volume.

**Two independent measurements agree.** The mastering pipeline measures its own output, and a separate
script re-measured every finished `.ogg` from scratch. Every figure matches. The same script reproduces
the props audit's published numbers exactly on the four files the two audits share.

## break — ice into water (7 candidates)

The ideal: one recording that is already both halves of the event. These are real ice giving way over
real water.

| file | source | author | licence | what it is | length | peak | 100ms RMS | LUFS | noise floor | clipping |
|---|---|---|---|---|---|---|---|---|---|---|
| `icewater/break-through-boots-840050.ogg` | [Breaking through ice into water.](https://freesound.org/people/mentos987/sounds/840050/) | mentos987 | CC0 1.0 | **The event itself.** The author repeatedly broke through the ice of a shallow pond with their boots and edited the wind out. Loudest break of the take. | 1.30 s | -2.1 | -17.5 | -20.4 | -47.6 | no |
| `icewater/break-through-boots-840050-b.ogg` | [Breaking through ice into water.](https://freesound.org/people/mentos987/sounds/840050/) | mentos987 | CC0 1.0 | Another break from the same recording, a little drier. | 1.30 s | -1.9 | -17.7 | -22.0 | -47.6 | no |
| `icewater/break-through-pond-209818-b.ogg` | [Icy Water - Cracking and Break through](https://freesound.org/people/DogOmlet/sounds/209818/) | DogOmlet | CC0 1.0 | The author walked on ice over water until it gave: this is cut from where they go in. Wettest of the set. **Noisy source** — see the floor note below. | 1.60 s | -2.5 | -17.4 | -22.4 | -37.1 | no |
| `icewater/ice-sheets-splash-347389.ogg` | [ice_sheets_breaking_wet_splashing_ST.wav](https://freesound.org/people/wilhelmsqueek/sounds/347389/) | wilhelmsqueek | CC0 1.0 | Thin ice sheets off a pond surface broken and thrown back in. Sheet-like rather than a single plunge. | 1.40 s | -1.4 | -17.6 | -21.5 | -67.3 | no |
| `icewater/ice-chunk-splash-666549.ogg` | [Ice Splash 5](https://freesound.org/people/giwake/sounds/666549/) | giwake | CC0 1.0 | A big chunk of ice splashing into water. Heavy, clean. | 1.40 s | -2.6 | -17.7 | -18.0 | -59.2 | no |
| `icewater/ice-chunk-drop-560886.ogg` | [WATRSpls_Big Ice Piece Drop On Water In The Woods](https://freesound.org/people/jakubp.jp/sounds/560886/) | jakubp.jp | CC0 1.0 | A big ice chunk kicked into flooded woodland. Quietest source of the set — digital silence around it. | 1.40 s | -3.9 | -17.7 | -27.2 | -inf | no |
| `icewater/creek-ice-break-837154.ogg` | [Breaking the ice of a frozen creek](https://freesound.org/people/solippsound/sounds/837154/) | solippsound | CC0 1.0 | Creek ice cracked by hand. Well recorded (Neumann KM 184) but distant, so it needed +22 dB. **Noisy after gain** — see below. | 1.40 s | -2.5 | -17.8 | -19.8 | -48.7 | no |

## break — big splash (9 candidates)

A body going into open water, for pairing with a creak or an ice crack, or for use alone.

| file | source | author | licence | what it is | length | peak | 100ms RMS | LUFS | noise floor | clipping |
|---|---|---|---|---|---|---|---|---|---|---|
| `bigsplash/body-dive-in-637947.ogg` | [water movement body dive in.flac](https://freesound.org/people/kyles/sounds/637947/) | kyles | CC0 1.0 | **A body entering water**, recorded as foley rather than as an event in a place. The closest to the feature's own words. | 1.60 s | -4.0 | -17.7 | -21.6 | -44.8 | no |
| `bigsplash/cannonball-530152.ogg` | [POOL CANONBALL DIVE 4](https://freesound.org/people/tbsounddesigns/sounds/530152/) | tbsounddesigns | CC0 1.0 | Cannonball into a pool. The biggest, roundest splash of the set. **Noisy source.** | 1.60 s | -3.5 | -17.7 | -23.3 | -39.4 | no |
| `bigsplash/cannonball-dock-260131.ogg` | [Cannonball off dock, splashing, swimming.wav](https://freesound.org/people/SpliceSound/sounds/260131/) | SpliceSound | CC0 1.0 | Cannonball off a dock into a lake, with the swimming after it. Outdoors, so it carries its own air. **Noisiest of all — see below.** | 1.60 s | -3.5 | -17.5 | -22.6 | -29.8 | no |
| `bigsplash/dive-5m-529794.ogg` | [5 meters dive.wav](https://freesound.org/people/bruno.auzet/sounds/529794/) | bruno.auzet | CC0 1.0 | A five-metre dive. Deep and slow — reads as weight going in. | 1.60 s | -5.3 | -17.5 | -24.2 | -43.0 | no |
| `bigsplash/swimmer-dive-438844.ogg` | [G54-25-Swimmer Diving.wav](https://freesound.org/people/craigsmith/sounds/438844/) | craigsmith | CC0 1.0 | A swimmer diving in. Tidier and smaller than the cannonballs. | 1.40 s | -8.1 | -17.5 | -24.2 | -73.9 | no |
| `bigsplash/water-splash-434978.ogg` | [Water Splash](https://freesound.org/people/felix.blume/sounds/434978/) | felix.blume | CC0 1.0 | A plain large splash, field recorded. **Noisy source.** | 1.40 s | -2.5 | -17.7 | -27.0 | -40.5 | no |
| `bigsplash/watersplash-469608.ogg` | [Watersplash](https://freesound.org/people/Sheyvan/sounds/469608/) | Sheyvan | CC0 1.0 | Short, close, dry splash. Would layer under an ice crack without fighting it. | 1.40 s | -5.0 | -17.7 | -25.2 | -51.1 | no |
| `bigsplash/splash-45103.ogg` | [splash.wav](https://freesound.org/people/Matias.Reccius/sounds/45103/) | Matias.Reccius | CC0 1.0 | A clean single splash, no room on it. | 1.40 s | -7.0 | -17.7 | -22.0 | -52.1 | no |
| `bigsplash/frantic-splashing-679403.ogg` | [frantic splashing](https://freesound.org/people/adviseme333/sounds/679403/) | adviseme333 | CC0 1.0 | Someone thrashing in water. Not the entry — the half-second **after**, which is arguably the scarier sound. | 1.60 s | -1.8 | -17.6 | -22.0 | -44.6 | no |

## The noise-floor note

The props standard rejects a candidate whose noise floor, after gain, sits above **-55 dBFS**. That
threshold was set for prop foley recorded in a quiet room. Most of what a big splash sounds like was
recorded **outdoors**, where the lake, the air and the day are part of the sound and cannot be gated out.

Six candidates above (`209818-b`, `837154`, `530152`, `260131`, `434978`, `438844`) fail that threshold
on their source material. Rather than drop them silently — which would have thrown away the cannonballs
and the one recording of someone actually going through pond ice — they are rendered and listed, with
their real floor in the table and a mark on the audition page. **Roi's ear decides.** The thing to listen
for is hiss or outdoor air under the splash in a quiet indoor scene. `cannonball-dock-260131` at -29.8 is
the extreme case; if it sounds fine, the threshold is simply wrong for this material.

Nothing else about the standard was relaxed: peak, clipping and the loudness target are unchanged, and
every candidate passes them.

## Rejected outright (3)

| file | why |
|---|---|
| [Big Water Splash](https://freesound.org/people/qubodup/sounds/442773/) by qubodup | **Clipped source** — a run of 5 consecutive samples at full scale. A hard rejection under the standard, whatever it sounds like. Frustrating: the title is exactly what was asked for. |
| [Icy Water - Cracking and Break through](https://freesound.org/people/DogOmlet/sounds/209818/) at 1:50 | The break the author describes needed 8.9 dB of limiting to reach the target — it would come out crushed. The later break from the same recording (`209818-b`) is used instead. |
| [ICEImpt_ImpactBreak01](https://freesound.org/people/InMotionAudio/sounds/719169/) by InMotionAudio | Needed 7.1 dB of limiting. Also a designed sample rather than a recording of ice, which is audible. |

## creak — 8 candidates, already bundled

All from `assets/sounds/surfaces/freesound/`, already played as the `cold` surface by
`engines/motion/energy-blast.mjs`, so the sound-selection standard does not block them. Three are
recordings of ice breaking rather than of frost. Measured as they are; nothing re-encoded.

| file | source | author | licence | what it is | length | peak | 100ms RMS | LUFS | noise floor | clipping |
|---|---|---|---|---|---|---|---|---|---|---|
| `frost-crack-213579-0.ogg` | [Ice Break Crunch Crack Foott 02](https://freesound.org/people/JackMenhorn/sounds/213579/) | JackMenhorn | CC0 1.0 | A foot breaking through ice crust. The nearest bundled thing to the event. | 0.56 s | -2.9 | -12.3 | -17.2 | -inf | no |
| `frost-crack-213579-1.ogg` | [Ice Break Crunch Crack Foott 02](https://freesound.org/people/JackMenhorn/sounds/213579/) | JackMenhorn | CC0 1.0 | Second take of the same. | 0.58 s | -3.1 | -12.7 | -17.9 | -139.5 | no |
| `frost-crack-422619-0.ogg` | [Breaking ice - small 2](https://freesound.org/people/Aurelon/sounds/422619/) | Aurelon | CC0 1.0 | Small sheet ice breaking. Dry, no water. | 0.81 s | -0.5 | -14.8 | -19.0 | -inf | no |
| `frost-crack-114253-0.ogg` | [Icicles breaking.wav](https://freesound.org/people/GodofPH/sounds/114253/) | GodofPH | CC0 1.0 | Icicles snapping. Brittle and high; frost more than sheet. | 0.75 s | -0.6 | -18.5 | -25.3 | -inf | no |
| `frost-crack-264420-0.ogg` | [ICICLES breaking series.wav](https://freesound.org/people/RMSound/sounds/264420/) | RMSound | CC0 1.0 | Icicles, series. **Peaks above full scale (+0.7).** | 0.45 s | +0.7 | -13.5 | -14.6 | -155.7 | no |
| `frost-crack-264420-1.ogg` | [ICICLES breaking series.wav](https://freesound.org/people/RMSound/sounds/264420/) | RMSound | CC0 1.0 | Shortest of the set — a single tick. | 0.20 s | -0.8 | -17.3 | n/a | -105.1 | no |
| `frost-crack-539696-0.ogg` | [throwing a single ice cube at roof.wav](https://freesound.org/people/Anthousai/sounds/539696/) | Anthousai | CC0 1.0 | An ice cube thrown at a roof. Has a tail and a room on it. | 1.60 s | -1.4 | -14.3 | -26.8 | -inf | no |
| `frost-crack-608685-0.ogg` | [Wham n Shatter](https://freesound.org/people/eben-frostey/sounds/608685/) | eben-frostey | CC0 1.0 | A whack then a shatter. Loudest of the set; reads as an impact. | 1.23 s | -4.3 | -11.9 | -21.1 | -180.6 | no |

**Finding — this set is not loudness-matched.** Its 100ms RMS spreads **6.6 dB**, from -11.9 to -18.5.
They were matched for their original use, not against each other, so a creak picking among them at random
will jump in volume between steps of one walk. Pick **one**, or gain-match a few before anything ships.

## Already bundled, break-scale — measured, all rejected by ear

These were the first round, before Roi heard them. Kept here so the record shows why they are out.

| file | author | 100ms RMS | peak | verdict |
|---|---|---|---|---|
| `props/glass/bottle-shatter-202093.ogg` | spookymodem | -18.3 | -9.1 | Reads as a bottle, not as ice over water. |
| `props/glass/bottle-break-212698.ogg` | dasebr | -18.1 | -3.0 | As above. |
| `props/glass/bottle-smash-199401.ogg` | martinimeniscus | -18.1 | -1.9 | The only one with liquid in it, still a bottle. |
| `surfaces/kenney/impactGlass_heavy_000-004.ogg` | Kenney | -13.2 to -14.9 | **+1.9 to +2.2** | **Fails the standard.** All five peak above full scale and all five clip by the run test. Out on measurement, before taste. |
| `props/splash/water-splash-186748.ogg` | rombart | -17.7 | -2.1 | Bucket-scale. This is what "not a big splash" sounded like. |
| `surfaces/freesound/body-water-166313-0.ogg` | deleted_user_2104797 | -18.5 | -3.6 | Sloshing, not entry. |
| `surfaces/freesound/body-water-841151-0/1.ogg` | SonicOddities | -18.7 / -19.7 | -2.9 / -3.6 | As above. |

## The pairing question

Still open, and now sharper. Three shapes are possible and all three are auditionable on the page:

- **one `icewater` file** — the whole event in one recording, nothing to time.
- **creak + `bigsplash`** — the ice heard as it goes, then the body in the water.
- **`icewater` + `bigsplash`** — the plunge with more water behind it than any single take has.

The audition page's **Pair** panel plays any two with a gap you set.

## If a pick needs gain

A chosen file goes into `assets/sounds/` and is registered the usual way. Any level change wanted after
the fact belongs in the sound profile as a **playback gain**, not baked into the asset — several of the
bundled candidates are played by other features, and re-mastering one in place would change it for them.

## Unrelated finding, not fixed here

Three bundled files have **no attribution line** in `assets/sounds/surfaces/freesound/License.txt`:
`ice-step-405635-0.ogg`, `ice-step-539683-0.ogg` and `ice-step-539683-2.ogg`. Every other file in that
folder has one. The Freesound ids are in the filenames so it is recoverable, but confirming each source
page is a licence claim not to be made from a filename. Worth clearing before the next release.
