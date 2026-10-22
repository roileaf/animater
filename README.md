# Animater

Automatic animations for **Pathfinder 2e**, **Starfinder 2e**, **D&D 5e** and **Daggerheart** in **Foundry VTT 14**, powered by **Sequencer and JB2A**. Enable ready-made catalogs or choose individual animations, then cast spells, make attacks and use abilities through your system's normal workflow.

Animater combines visual effects, cosmetic token movement, optional sound and **Tokenshade**, its own shader effects on the token's artwork (flames off the outline, frost creeping in, auras, force fields, material changes, bindings and more). Browse and preview catalog entries, or customize them in **Recipe Studio**, a timeline editor with separate tracks for visuals, motion, sound and filters.

> PF2e has received the most live table testing. SF2e, D&D 5e and multiplayer playback have had less testing. Report bugs and requests on the [issue tracker](https://github.com/roi007leaf/animater/issues).

## Requirements

| | Module | Notes |
|---|---|---|
| Required | [Sequencer](https://github.com/fantasycalendar/FoundryVTT-Sequencer) 4.2+ | Plays every effect |
| Required (one) | JB2A Free (`JB2A_DnD5e`) or JB2A Patreon (`jb2a_patreon`) | Patreon unlocks the full art set; every animation has a Free fallback |
| Optional | GGG, PSFX, SoundFx Library, PF2e Creature Sounds | Sound cues; uses whichever packs are active |
| Optional | FXMaster | Brief scene weather for storm and weather spells |

## Install

1. In Foundry's **Add-on Modules → Install Module**, paste the manifest URL:
   `https://github.com/roi007leaf/animater/releases/latest/download/module.json`
   For a specific version, use the manifest attached to that version on the [releases page](https://github.com/roi007leaf/animater/releases).
2. Activate Sequencer, a JB2A pack and Animater in your world.
3. Open **Game Settings → Animater → Open Animater** (or the wand in Token Controls, or **Alt+Shift+A**).
4. Open a catalog and enable it with **Use entire catalog** or the corresponding **Use … catalog** button. To enable one entry, select it and choose **Use animation**. Automatic playback is off until you enable it.
5. Cast, attack or use the enabled ability normally. For a canvas preview, select a caster token first and target any affected creatures.

Install and activate **either** JB2A edition; Patreon users do not need JB2A Free as well. Animation, sound and icon media comes from your installed asset packs, rather than being bundled with Animater.

## What it animates

- **Spells.** Casting, flight, impact and area footage that follows the native template: bursts, cones, lines, emanations and walls. Spells that let you choose a damage type animate in the chosen element.
- **Feats, actions and class features.** Each has its own catalog page: Demoralize, Grapple, Raise a Shield, Rage, Sneak Attack, Flurry of Blows, Glimpse of Redemption and many more. Damage riders such as Sneak Attack play alongside the Strike.
- **Weapons.** Melee, ranged and thrown uses, chosen from the actual Strike. Elemental runes, bombs and firearms included.
- **Effects and conditions.** Persistent layers that follow the token while the native effect or condition is active, and end when it ends.
  - Afflictions read as debuffs at a glance.
  - Valued conditions such as Frightened 1–4 grow stronger with their value.
  - Persistent damage shows its damage type.
- **Token motion.** Cosmetic lunges, recoils, leaps, charges and stagger poses that return the token to its place. The real token position never changes, except finishers, which move the token where it lands.
- **Finishers.** The Finishers page holds your finishing moves: design one in the studio or copy a preset (Launch, Cleave, Burn to ash, Shatter and more). Assign a finisher to spells, feats, actions and weapons from either side: the finisher's Applies-to list, or the Finisher dropdown on a catalog entry. It plays on a killing blow or on every successful use. The real token is moved and the ending plays: it vanishes, stays as a Defeated body, or stays put. Unhide the token (and remove Defeated) to undo; it stays on the square where it landed. Player-side moves are written by the active GM. Their movement is a keyframed path you draw in the studio: drag points on a grid, retime keyframes on the timeline, and the path is aimed away from the attacker and stopped at walls at the table. A finisher can also use token fragments, which split the real token's artwork into pieces drawn on every client while the token itself stays hidden; presets: Slice in half, Bisect, Shatter into shards, Disintegrate, Sky launch, Ragdoll tumble, Vortex spiral and Pancake.
- **Sound.** Optional, synchronized to the visuals, and only from packs you have installed.

Every catalog entry can be previewed in the workspace, enabled or excluded individually, and customized into an editable recipe: stages, timing, assets, motion, sound and filters.

### Catalog controls

- Search and filter entries within each catalog.
- Enable the whole catalog, or choose individual entries with **Use animation**.
- While the whole catalog is enabled, hover a card and use **⊘** to exclude that entry. Click again to include it; excluded cards appear dimmed.
- Adjust token motion, sounds and volume using the catalog controls.
- Choose **Customize** to create an editable recipe for an entry. Entries marked as needing configuration require setup before automatic playback.

## Recipe Studio

In **Assets → Folder sources**, enter a source name (for example, **BossLoot**) and choose **Add folder**. Select its folder in Foundry's **User Data** file picker. Animater indexes animations, images and sounds in that folder and its subfolders, even without Sequencer database registration. Sources are remembered per user; **Refresh** picks up new files. **Remove** stops indexing a source without deleting files or changing saved recipes.

Build your own animation or customize a catalog entry in a timeline workspace.

- **Preview monitor:** Play, pause, stop, loop and scrub to inspect a specific moment.
- **Separate tracks:** Caster, Flight, Target, Token motion, Sound, and Filters & scene (plus Teleport on a teleport recipe). Add stages with the track's **+** button.
- **Clip editing:** Drag clips to change timing, drag their right edge to trim duration, and right-click to duplicate or delete. Clips snap to other clips and the playhead; hold **Alt** to place freely.
- **Choreography:** Start a stage *With* or *After* another stage, or *At a set time*. Linked stages stay attached when their timing changes.
- **Mute and solo:** Isolate tracks while previewing to check visuals, motion, sound and filters separately.
- **Stage inspector:** Choose assets, stage types and stage-specific options. Visual assets have previews; sound stages have a listen player and volume control.
- **Recipe settings:** Set the trigger, bound item, description, category and accent through the **⚙** trigger chip.
- **One animation for a strike type:** In **Recipe settings**, choose **Attack rolled** (or **Damage rolled**) → **Applies to: All melee strikes** or **All ranged strikes**, then save. Melee covers melee weapons, unarmed attacks and NPC melee strikes; ranged covers ranged weapons and NPC ranged strikes. No name lists needed. Both override built-in weapon animations, with specific saved bindings taking priority. Thrown and spell attacks retain their own animations.
- **Teleport appearance:** In a teleport recipe's **Recipe settings**, choose **Teleport look**, or click the **Departure effect** and **Arrival effect** preview cards to browse Assets, preview variants and choose artwork for each cue. The browser also supports your own media files. **No effect** and **Default blue mist** work separately for each cue. Set size and optional tint there too. **No extra effects** keeps the token move while suppressing the blue puffs; the recipe's normal stages still play. Existing recipes keep blue mist by default.
- **Teleport timing:** A teleport recipe (Translocate, Friendfetch, Misty Step, or any recipe with **Teleport** on) has a **Teleport** track with one stage. The token vanishes as that stage starts (the departure effect plays) and reappears at the picked spot when it ends (the arrival effect); its length (**Gone for**, 0.5 s by default, 0 to reappear at once) is how long it stays gone. Added with the playhead at the start, it follows the flight's arrival when a target is teleported, else the caster's gesture. Catalog teleports come with theirs, linked to the art they follow. A recipe without one (older recipes) teleports where its animation reaches the mover: as a flight arrives at it (Friendfetch's ray reaching the ally), else at the caster's gesture, else 0.45 s in. The spot is still picked before anything plays. **Local preview** shows the departure, hides the token for the gone time and plays the arrival where it stands, without moving it.
- **Table playback:** Try a private local canvas preview, then use **Play at table** to share the animation.

FXMaster particles can play inside the preview monitor. FXMaster scene filters need **Play at table** to inspect their appearance on the scene.

Useful shortcuts: **Space** to play/pause, **Home/End** to jump, **L** to loop, **Ctrl+D** to duplicate, **Delete** to remove a clip, **Ctrl+S** to save, and **Ctrl+wheel** to zoom the timeline.

## Tokenshade

Tokenshade is Animater's built-in shader engine for effects on the token's own artwork. It needs no other module.

- **Presets:** 164 built in. Every Token Magic FX preset name works, so older recipes keep playing, plus Tokenshade's own looks (materials such as stone, ice or gold; frost and snow; vines, nets and chains; ground markers; a distinct look for every damage type).
- **Customizable per stage:** in Recipe Studio, open *Customize effect* on a token filter stage to change every layer's settings and animations, add or remove layers, and set the speed. GMs can save the result to **My presets**.
- **Local and light:** effects are drawn on each player's screen only; nothing is written to tokens or scenes. Hidden tokens pause their effects.
- **Token Magic FX is optional:** if it is active, your world's own Token Magic presets are listed too and drawn by Tokenshade.

## Settings

| Setting | Scope | What it does |
|---|---|---|
| Animation quality (this device) | Each player | Full / Balanced / Low / Off. Lower it on slower computers; other players are unaffected |
| Weapon effect size | World | Multiplies weapon hit and residue size (default 1.5×) |
| Add token filters to catalog animations | World | Catalog animations add matching Tokenshade effects on the token itself (flames, frost, glows, shimmer) |
| Add FXMaster scene effects to catalog animations | World | Optional scene effects when FXMaster is active |
| Take over from Automated Animations | World | When both modules would animate the same item, Animater plays and Automated Animations stands down |
| Faster animations (this device) | Each player | Makes animations cheaper to draw on your computer, for every module that uses Sequencer, with no change in how they look (on by default; see below) |
| Effect lighting | World | Fire, lightning, radiant and other glowing effects light the scene around them while they play (lasting areas and auras until they end), blocked by walls like any light (on by default) |
| Effect lighting in daylight | World | Also adds a soft coloured glow around effects in fully lit scenes (on by default) |
| Flickering and flashing effect lights | Each player | Turn off to see effect lights as a steady glow, without flicker or strobe (on by default) |
| Ground marks | World | Elemental spells, areas and alchemical bombs/flasks leave a painted mark on the floor where they landed (ordinary weapon strikes and rune damage do not): scorch, rime, acid, streaks, stains or cracks by element. Full for 2 minutes, then fading over the next 3; areas get a cluster clipped to the template, and a lasting area's mark stays until the area ends. PF2e impulses and NPC actions mark only when their animation plays on the damage roll (on by default) |
| Ground mark lifetime (minutes) | World | How long a ground mark stays: full for the first 40%, then fading over the rest. 0 keeps marks until the scene changes or the page reloads. Changing it applies to marks already on the floor (default 5: full for 2 minutes, fading over the next 3) |
| Ground marks on my screen | Each player | Turn off to never draw ground marks on this screen. Marks are drawn locally, never saved, cleared on reload or on a scene or level change, not drawn at Off quality, and Low quality draws half as many (on by default) |
| Afterimage trails | World | Charges, leaps, knockbacks and teleports that Animater plays leave a brief trail of ghost copies behind the token, tinted by the action. Each ground-covering motion stage has an **Afterimages** choice in the Studio (Auto, Always, Never); off here, nothing trails (on by default) |
| Afterimages on my screen | Each player | Turn off to never draw afterimage trails on this screen. Ghosts are drawn locally and show at Full, Light and Balanced quality, not at Low or Off (on by default) |
| Map distortion | World | Big blasts ripple across the map, lasting fire shimmers with heat and teleports warp the air. Explosions, area bursts of 2 squares or more and critical hits with heavy two-handed weapons send a shockwave ring; lasting fire areas and auras shimmer until they end (an aura's shimmer moves with its token); a teleport pinches space at both ends. Drawn only on screens at Full animation quality (on by default) |
| Shockwave reach (× blast size) | World | How far a blast's shockwave ripples, as a multiple of the blast's size. Larger values reach further across the map. 0.5 to 4 (default 1.5: the ring grows to 1.5 times the blast, 3 to 12 squares; the 12-square cap grows with the setting) |
| Map distortion on my screen | Each player | Turn off to never bend the map on this screen (for example if it is uncomfortable to watch). Distortion is drawn locally, only at Full quality, and skips new ripples while your computer is busy (on by default) |
| Projectiles stop at walls | World | Arrows, bolts, spell bolts and thrown weapons strike walls instead of passing through; a hit aims at the part of the target the shooter can see (on by default) |
| Room acoustics from walls | World | In scenes without an Acoustics choice, Animater's sounds echo to fit the space around them, worked out from the walls: dry outdoors, tight in small rooms, ringing in halls (on by default; see below) |
| Room reverb on my screen | Each player | Turn off to hear Animater's sounds without room reverb. Scenes with an Acoustics choice keep their echo (on by default) |
| Muffle sounds behind walls | Each player | Animater's sounds from beyond a wall sound muffled, as Foundry's own sounds do, heard from your selected token, else your own token, else (players) the middle of your view; a GM with no token selected hears nothing muffled, as in Foundry (on by default) |

### Scene acoustics

Each scene's configuration has an **Animater acoustics** choice: open air, hall or cave. A scene with a choice sounds that way everywhere. A scene left unset (**From the walls**) follows its walls: each sound gets reverb to fit the space where it happens, worked out from the walls around it (dry in the open, short and tight in a small room, fuller in a room, long and dark in a large hall), using Foundry's own reverb. Every player hears the same room for the same spot; a player viewing another scene hears it dry. The edge of the canvas counts as open, not as a wall. Each player's **Echo** slider (Hit sounds menu) scales this reverb. Turn this off with **Room acoustics from walls**.

### Faster animations

Animater patches Sequencer in memory (its files are untouched) so every Sequencer effect in the world costs less per frame:

- **Animation engine**: the same animations, with no per-frame allocations. Tested frame for frame against Sequencer's own engine.
- **Attached effects**: effects attached to or stretched between tokens only recompute when something they follow moved.
- **Positional sounds**: a sound's area and muffling are reused until the sound, the listener or the walls change.
- **Off-screen effects**: effects with filters or masks are not drawn while out of view.

Effects that follow a token still double-check its position every 30 frames, about half a second (*Faster animations: position recheck*). If an effect from any module looks wrong, turn the setting off. Single patches can be switched from the console, e.g. `game.modules.get("animater").api.sequencerSpeedups.set("sound", false)`. To measure, run `await game.modules.get("animater").api.sequencerSpeedups.profile(10)` with the setting on and again with it off.

Animater also works ahead for your own screen. The next creature's weapons and recently used footage load before its turn starts. Copies of an effect aimed at several targets start a frame apart, so they do not all land at once. Small decorative layers that you could not see at your zoom, or that would arrive while your computer is busy, are skipped on your screen only. Skipping never drops a spell's main hit. Turning off **Faster animations (this device)** turns this preloading and skipping off too.

The per-user preview setting can minimize the Animater window during local previews and table playback, then restore it afterward.

### Animation quality

| Level | What that player sees |
|---|---|
| Full | Every layer, token motion and Tokenshade filters |
| Balanced | Main and secondary layers; no decorative layers or Tokenshade filters; up to 3 persistent effects per token |
| Low | Only the main effect of each animation, plus token motion; one persistent effect per token |
| Off | No Animater visuals (sounds still play) |

The player who starts an animation only sends optional layers to viewers whose level allows them, so slower computers never load footage they won't show.

## Integrations

- **Automated Animations.** Animater takes over items it animates. Items you customized in Automated Animations stay with Automated Animations.
- **Spell Arsenal.** Spells mapped to a Spell Arsenal area rule keep their lasting Spell Arsenal tiles. Tick *Also play Animater recipe* on a mapping to play Animater's animation beside them.
- **Trigger Engine / Trigger Animations.** Adds an *Animater: Play animation* node.

## API

```js
const animater = game.modules.get("animater").api;
await animater.play("Fireball", { source: canvas.tokens.controlled[0], targets: Array.from(game.user.targets) });
await animater.preview("Fireball"); // local only
animater.resolve(message);          // the recipe automatic playback would use, or null
animater.handles(item);             // true when Animater would animate this item or message
await animater.stop();
```

Hooks: `animater.preDispatch(event, recipe)` runs before automatic playback (return `false` to claim the event); `animater.played(event, recipe)` runs afterwards.

## Known limits

- Foundry 14 only. Multiplayer replication and live D&D 5e / SF2e play have had less testing than PF2e.
- Area animations play once when the area is placed. For visuals that last as long as the area does, use Spell Arsenal.
- Actions whose area is placed separately (e.g. Dragon Breath) use their regular animation; template-driven action areas are planned.
- Token motion is cosmetic; it never moves tokens or changes their documents.
- D&D 5e catalogs use public 2014 and 2024 SRD content. Passive features are excluded from active ability catalogs.
- Daggerheart support is verified against system 2.10.12 and has had the least live testing. Its library lists the system's own domain cards, weapons and conditions (names and icons only); animations are designed from the card's domain and kind or the weapon's family and range, not from card text.
- No animation, sound or icon media is bundled; everything comes from the JB2A and sound modules you install.

## Development

```bash
npm ci                         # install development dependencies
npm test                       # unit and integration tests
npm run build                  # rebuild changed catalogs
npm run build -- --dry-run      # inspect the incremental build plan
node tools/release-files.mjs    # list release ZIP contents
```

Catalog data is generated by `tools/build-*.mjs` from pinned system compendium sources. Release archives contain only runtime files; audits and docs stay local.

Development-only `data/feat-*-review.mjs` maps are Git-ignored. Catalog builds and review audits recreate missing maps from the retained review generators and pinned feat catalog.

Runtime catalog data, sound mappings, FX description flags and media measurements remain tracked because Foundry loads them directly. Development inspection helpers are local-only; release archives exclude tools, tests, caches and development review maps.

D&D 5e descriptions include content from the System Reference Document 5.1 and 5.2 by Wizards of the Coast LLC, available under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

## License

GPL-3.0. See [LICENSE](LICENSE).
