# Animater

Automatic animations for **Pathfinder 2e**, **Starfinder 2e**, **D&D 5e** and **Daggerheart** in **Foundry VTT 14**, powered by **Sequencer and JB2A**. Enable ready-made catalogs or choose individual animations, then cast spells, make attacks and use abilities through your system's normal workflow.

Animater combines visual effects, cosmetic token movement, optional sound and **Tokenshade**, its own shader effects on the token's artwork (flames off the outline, frost creeping in, auras, force fields, material changes, bindings and more). Browse and preview catalog entries, or customize them in **Recipe Studio**, a timeline editor with separate tracks for visuals, motion, sound and filters.

> PF2e has received the most live table testing. SF2e, D&D 5e and multiplayer playback have had less testing. Report bugs and requests on the [issue tracker](https://github.com/roileaf/animater/issues).

## Requirements

| | Module | Notes |
|---|---|---|
| Required | [Sequencer](https://github.com/fantasycalendar/FoundryVTT-Sequencer) 4.2+ | Plays every effect |
| Required (one) | JB2A Free (`JB2A_DnD5e`) or JB2A Patreon (`jb2a_patreon`) | Patreon unlocks the full art set; every animation has a Free fallback |
| Optional | GGG, PSFX, SoundFx Library, PF2e Creature Sounds | Sound cues; uses whichever packs are active |
| Optional | FXMaster | Brief scene weather for storm and weather spells |

## Install

1. In Foundry's **Add-on Modules → Install Module**, paste the manifest URL:
   `https://github.com/roileaf/animater/releases/latest/download/module.json`
   For a specific version, use the manifest attached to that version on the [releases page](https://github.com/roileaf/animater/releases).
2. Activate Sequencer, a JB2A pack and Animater in your world.
3. Open **Game Settings → Animater → Open Animater** (or the wand in Token Controls, or **Alt+Shift+A**).
4. Open a catalog and enable it with **Use entire catalog** or the corresponding **Use … catalog** button. To enable one entry, select it and choose **Use animation**. Automatic playback is off until you enable it.
5. Cast, attack or use the enabled ability normally. For a canvas preview, select a caster token first and target any affected creatures.

Install and activate **either** JB2A edition; Patreon users do not need JB2A Free as well. Animation, sound and icon media comes from your installed asset packs, rather than being bundled with Animater.

## What it animates

Token Configuration → Appearance → **Animater movement sounds** offers per-token gait, body and flight overrides, or silent movement. Contact/body volume and pitch, weight/bass volume and camera tremor strength are independent (1 = default, 0 = off, up to 2). **Play four steps** previews unsaved choices on any floor with Walk, Fly or Land; it plays only on your device and moves no token. Stop or close the window to end the preview. Save Token Configuration to apply overrides; **Reset to automatic** restores defaults in the form.

Token Configuration → Appearance → **Animater creature voice** sets how that token cries out when it attacks, is hurt or falls: its creature's own voice (named in brackets), Silent, or any voice group (a man, a wolf, a dragon, a ghost...), listed by category (people, animals and beasts, undead and spirits, constructs, oozes and plants...). The second list picks one voice of that group by name, under Female, Male and Creature. **Attack**, **Hurt** and **Death** play the choice on your screen only. Animater ships 150 voices, each with its own attack, hurt and death cries; a group with none of its own borrows a related one. On PF2e with PF2e Creature Sounds active, the first choice is **Use PF2e Creature Sounds**; picking any Animater voice instead mutes that module for the token's actor, and going back restores its sound set.

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
- **The damage lens.** On players' screens only: a creature hurt next to theirs splashes its blood on the lens, whoever struck it; when it is hit, the view closes in and its own blood splashes the screen. Splats grow with the share of HP lost, a critical hit always lands hard, and the damage type shapes them (slashes streak, piercing sprays, bludgeoning bursts). Energy types leave their own mark too: fire scorches the edges, cold frosts them, lightning arcs, force cracks the lens. A heartbeat and the **Wounded view** follow the creature's HP, darkening the edges, muffling the world and playing going down, dying, waking and death. Preview every piece of it on any creature in the workspace's **Damage showcase**.
- **The world around the fight.** Big blasts ripple the map and shake the view, a killing blow can get a slow-motion kill-cam, creatures breathe and fliers hover, and wounded creatures look hurt and limp. Moving tokens kick up dust, leave footprints by floor, splash through water and puddles when it rains, and burrow in and out of the ground; footsteps carry as far as you choose and sound softer when sneaking.

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

Open **Configure Settings → Animater → Animater settings**. The window has a tab per topic (Look & light, Motion, Floor & world, Sound, Combat drama, Automation & catalogs, Interface & performance, Integrations) and a search box that finds a setting in any tab. Each feature is one row: the GM's **Everyone** switch for the whole world beside each player's own **My screen** switch, with its extra choices (lifetime, strength, reach) under it. Players see only the switches for their own screen. Changes apply as soon as you make them. **Animation quality (this device)** also stays in Configure Settings, beside the **Animater workspace** and **Hit sounds** menus. Settings that only apply to a system or a module (PF2e, Daggerheart, Dice So Nice, PF2e Visioner, Splatter, Automated Animations, Trigger Animations) show only where it is active.

**Look & light**

| Setting | Scope | What it does |
|---|---|---|
| Animation quality (this device) | Each player | Lower this on slower computers. Applies only to what you see; other players keep their own setting (Full / Light / Balanced / Low / Off; default Full) |
| Condition looks | World | How catalog conditions show on a creature. Tokenshade: a quiet look on the creature itself. JB2A: the condition’s JB2A animation only, with no Tokenshade filters. Also set from each conditions catalog in Animater (Tokenshade / JB2A; default Tokenshade) |
| Tokenshade filters in catalog animations | World | Catalog animations add matching shader effects on the token itself (flames, frost, glows, shimmer). Drawn by Animater on each screen; nothing is saved to the token (on by default) |
| FXMaster scene effects in catalog animations | World | When FXMaster is active, weather-like catalog spells add brief scene effects (rain, fog, embers). Skipped automatically when the module is missing (on by default) |
| Effect lighting | World | Fire, lightning and other glowing effects light up the scene around them while they play (lasting areas and auras until they end), blocked by walls like any light (on by default) |
| Effect lighting on my screen | Each player | Turn off to never light the scene from Animater's effects on this screen (on by default) |
| Effect lighting in daylight | World | Also add a soft coloured glow around effects in fully lit scenes (on by default) |
| Flickering and flashing effect lights | Each player | Turn off to see effect lights as a steady glow, without flicker or strobe (on by default) |
| Weapon effect size | World | Multiplies the size of weapon hit and residue effects (1 = the target token's footprint) (0.5 to 3, default 1.5) |
| Weapon rune flourishes | World | Catalog weapon Strikes show each weapon’s runes: potency adds a glint, striking a bigger hit, and each property rune (flaming, frost, shock, holy…) its own accent on a hit. Saved recipes are never changed (on by default) |
| Wounded looks | World | Creatures show how hurt they are. At half their HP or less they look wounded; at a quarter or less the look is stronger, they stand hunched and limp as they move. Healing takes it away, and a defeated creature shows the defeated look instead. Choose whether every creature shows it or only player characters (All creatures / Player characters only / Off; default All creatures) |
| Wounded looks on my screen | Each player | Turn off to never draw wounded looks, hunches or limps on this screen (on by default) |
| Defeated look | World | How a Defeated token is drawn (combat tracker, system or finisher). Small icon: a normal status icon instead of the skull over the whole token. Animater effect: the small icon, faint skull smoke and a greyed token while it stays Defeated. Applies to tokens defeated from now on; existing Defeated effects keep their look (Foundry default (skull over the whole token) / Small icon / Animater effect; default Foundry default (skull over the whole token)) |
| Damage reactions | World | A token that takes energy damage (fire, cold, lightning, acid, poison and so on) flashes in that damage's look. Physical damage keeps its weapon animation only (on by default) |
| Damage-typed knockouts | World | A creature dropping to 0 HP goes down in the look of the damage that dropped it: burned to ash, frozen and shattered, fried by lightning. Off: a plain collapse (on by default) |

**Motion**

| Setting | Scope | What it does |
|---|---|---|
| Animater's token motions come first | World | While Animater moves a token (a finisher or attack, a condition's trembling or swaying, a look that rocks it), other modules' passing Sequencer motions on that token don't play, such as PF2e RPG Numbers' damage shake. Off: both play, and the token can jitter between them (on by default) |
| Afterimage trails | World | Charges, leaps, knockbacks and teleports that Animater plays leave a brief trail of ghost copies behind the token (on by default) |
| Afterimages on my screen | Each player | Turn off to never draw afterimage trails on this screen (on by default) |
| Idle life | World | Creatures on screen idle subtly: living creatures breathe and fliers bob in the air. Constructs, undead, objects and creatures that are down or defeated stay still, and any condition's movement takes over. Drawn on each screen at Balanced quality or better (on by default) |
| Idle life on my screen | Each player | Turn off to never draw idle breathing or hovering on this screen (on by default) |
| Idle life strength | Each player | How much creatures breathe and fliers bob on this screen: 1 is a visible but calm breath, 2 twice as much, 0.5 half (0.5 to 2, default 1) |
| Breath shows in the cold | World | In the cold (snow falling, a snow or ice floor underfoot, or a scene flagged cold), breathing creatures on screen puff a faint white cloud with each breath out. Constructs and undead do not. Drawn on each screen at Balanced quality or better, and not where idle life is off on that screen (on by default) |
| Idle breathing | World | Living creatures on screen breathe, a slow rise and fall. Off: they stand still (fliers can still hover) (on by default) |
| Idle breathing on my screen | Each player | Turn off to never draw idle breathing on this screen (fliers can still hover) (on by default) |
| Fliers hover | World | Flying creatures bob gently in the air, so they stand out from those on the ground. Off: they hold still (others can still breathe) (on by default) |
| Fliers hover on my screen | Each player | Turn off to never draw fliers bobbing on this screen (others can still breathe) (on by default) |
| Teleport tokens | World | Teleport spells (Translocate, Friendfetch…) let whoever cast them click a spot, and the token jumps there (Friendfetch drags its targets to the caster on its own). Turn off if another module already moves tokens for these spells: they then only play their animation (on by default) |
| Camera shake | World | Big blasts jolt the view for a moment on each screen, more for bigger blasts and less the further away they land. Drawn only on screens at Full or Light animation quality (on by default) |
| Camera shake on my screen | Each player | Turn off to never shake the view on this screen. Off at first when this browser asks for reduced motion (on by default) |
| Camera shake strength | Each player | How hard blasts shake the view on this screen, as a multiple of the usual jolt. Above 1 it also lasts longer (4 shakes about twice as long) (0.25 to 4, default 1) |
| Giant footfalls shake the view | World | Every footfall of a Huge or Gargantuan creature gives a small tremor to screens that hear it nearby, stronger the heavier it is (a stone golem or a dragon more than a giant). Needs Camera shake on (on by default) |
| Slow-motion kill-cam | World | When a killing blow lands on an NPC, every screen that can see it eases the view towards it with a gentle zoom, slows Animater's effects on it and fades the colour for a moment, then pans back. The finisher and Finish Him! wait for it. Drawn only on screens at Full or Light animation quality (off by default) |
| Kill-cam on my screen | Each player | Turn off to never move the view or slow effects for a kill-cam on this screen (on by default) |
| Map distortion | World | Big blasts ripple across the map, lasting fire shimmers with heat and teleports warp the air. Drawn only on screens at Full animation quality (on by default) |
| Map distortion on my screen | Each player | Turn off to never bend the map on this screen (for example if it is uncomfortable to watch) (on by default) |
| Shockwave reach (× blast size) | World | How far a blast's shockwave ripples across the map, as a multiple of the blast's size. It always clears the blast by at least a square, and its ripple keeps the same width at any reach (1 to 4, default 1.5) |

**Floor & world**

| Setting | Scope | What it does |
|---|---|---|
| Ground marks | World | Fire, frost, acid and other elemental hits leave a fading mark on the floor where they landed. Marks are drawn on each screen and never saved (on by default) |
| Ground marks on my screen | Each player | Turn off to never draw ground marks on this screen (on by default) |
| Ground mark lifetime (minutes) | World | How long a ground mark stays before it is gone: fully visible for the first 40%, then fading. 0 keeps marks until the scene changes or the page reloads (0 to 60, default 5) |
| Element reactions | World | A new ground mark that lands on an older one can react: fire on frost puffs steam and melts it, frost on a scorch hisses out in smoke, fire on poison flares, lightning on acid arcs to the creatures standing in it, and acid on frost sizzles. Drawn on each screen that shows ground marks (on by default) |
| Element reactions on my screen | Each player | Turn off to never draw element reactions (steam, smoke, flares, arcs) on this screen (on by default) |
| Movement effects | World | Moving tokens kick up dust on dirt, grass, sand and snow, ripple water and faintly scuff stone and wood; fliers cast a soft shadow on the ground. Set each scene's floor in its configuration. Footprint lifetimes below are separate for each ground (0 = natural fading). Drawn on each screen and never saved (on by default) |
| Movement effects on my screen | Each player | Turn off to never draw movement dust, ripples or flier shadows on this screen (on by default) |
| Footprint lifetime per floor (seconds) | World | One setting each for sand, mud, snow, dirt, grass, stone, wood, water and ice: total time until footprints, creature grooves and flattened grass on that floor fully fade, including carried wet, muddy or snowy prints. 0 keeps their natural lifetime (sand 6 seconds, mud 12, snow 20). Applies to marks already on the floor (0 to 3600, default 0) |
| Swimming wake lifetime (seconds) | World | Time until fully faded. 0 keeps natural fading (1.6 seconds). Applies to existing and new effects. Burrow holes keep their own lifetime (0 to 3600, default 0) |
| Underwater bubble lifetime (seconds) | World | Time until fully faded. 0 keeps natural fading (1.8 seconds). Applies to existing and new effects. Burrow holes keep their own lifetime (0 to 3600, default 0) |
| Submerged token appearance | World | Below the water surface, visible swimmers fade to a blue, translucent silhouette. Surfacing restores their original appearance. This changes artwork only, not Foundry visibility or detection (on by default) |
| Submerged token opacity | World | How clearly a submerged creature’s artwork is drawn (0.35 = 35%). Applies equally to GM and player artwork, while Foundry still decides who can see the creature (0.1 to 1, default 0.35) |
| Burrow path lifetime (seconds) | World | Time until fully faded. 0 keeps natural fading (8 seconds). Applies to existing and new effects. Burrow holes keep their own lifetime (0 to 3600, default 0) |
| Hide burrow paths at relative elevation | World | Burrowing at or below this elevation relative to the viewed level’s floor leaves no visible path. -10 hides paths 10 scene units below that floor; 0 hides every underground path. Entrance and exit holes still appear when the creature crosses the surface. Existing shallow trails fade normally (-1000 to 0, default -10) |
| Movement respects stealth | World | Players only see and hear what their characters could: an undetected or unnoticed creature moves in silence and leaves no tracks, and a hidden one is heard but leaves nothing to see (PF2e Visioner, judged from each player's own tokens, else the creature's conditions). Off: everyone sees and hears every movement drawn on their screen. Tokens the GM hid never give anything away either way (on by default) |
| Burrow holes | World | A burrowing creature leaves a hole where it goes under and a wider one where it comes up, with earth thrown out, lingering about 20 seconds (on by default) |
| Burrowed creatures sink out of sight | World | A creature below the floor sinks into its hole and vanishes for players who don't own it (they still see the ground churn and hear it dig); its owner and the GM see a faint ghost. It rises back out where it surfaces (on by default) |
| Feet carry mud, water and snow | World | A creature that walked through water, mud or snow leaves wet, muddy or snowy prints in its own tracks on the next floor for a few strides, fainter each stride. Creatures that slither, ooze or leave no prints carry nothing (on by default) |
| Wounded creatures leave blood drops | World | A badly hurt creature (a quarter of its HP or less) now and then drips blood as it moves, lasting about 20 seconds. Constructs, elementals, oozes and incorporeal creatures never bleed. With Splatter painting the blood (Splatter: blood follows the damage), Splatter's blood is used instead (on by default) |
| Weather on the ground | World | When it rains on the scene (Foundry's scene weather or FXMaster), every step splashes, dirt turns to mud (its sound and prints), stone, wood, grass and sand get puddles under each step, and prints on sand, dirt and mud look wet; when it snows, every step kicks up a light dusting. Never under a region that suppresses weather (on by default) |
| Walked path highlight | Each player | Foundry highlights every square a token moves through, which hides the dust, prints and splashes it leaves. Faded: the squares already walked show at a quarter strength (the way ahead stays as it is). Hidden: walked squares are not highlighted. As Foundry draws it: unchanged (Faded / Hidden / As Foundry draws it; default Faded) |
| GM perceives movement | Each player | As my selected token: with a token selected, you see and hear only what it could, as its player would (a creature PF2e Visioner says it has not detected leaves no tracks and makes no sound); with none selected, everything. Everything: you always see and hear every creature move (except tokens hidden in Foundry) (Everything / As my selected token; default As my selected token) |
| Sneaking is quiet | World | A creature moving stealthily steps softer, slower and duller, and only a Huge or bigger one still thuds: PF2e's Avoid Notice exploration activity or a Sneak effect, PF2e Visioner's sneaking, D&D 5e's Hiding status (on by default) |
| Projectiles stop at walls | World | Arrows, bolts and thrown weapons strike walls instead of passing through; a hit aims at the part of the target the shooter can see (on by default) |
| Dispels shatter lasting effects | World | After a successful counteract check (PF2e, SF2e) or Dispel Magic or Counterspell (D&D 5e), Animater's lasting areas and auras that end in the next few seconds break apart like glass. A failed one makes the lasting animations on its targets flicker, then hold (on by default) |
| Dispel shatter on my screen | Each player | Turn off to never draw dispels shattering or flickering lasting effects on this screen (on by default) |

**Sound**

| Setting | Scope | What it does |
|---|---|---|
| Room acoustics from walls | World | In scenes without an Acoustics choice, Animater's sounds echo to fit the space around them, worked out from the walls: dry outdoors, tight in small rooms, ringing in halls (on by default) |
| Room reverb on my screen | Each player | Turn off to hear Animater's sounds without room reverb (on by default) |
| Muffle sounds behind walls | Each player | Animater's sounds from beyond a wall sound muffled, as Foundry's own sounds do (on by default) |
| Footstep sounds | World | Moving tokens make their sounds: footsteps by floor and feet, wing beats, a burrower's churn, a swimmer's stroke, the thud of a landing. Off: tokens move silently; the view still shakes under giant footfalls (Giant footfalls shake the view) (on by default) |
| Footstep sounds on my screen | Each player | Turn off to hear no footsteps, wing beats or other movement sounds on this device. Other players keep theirs (on by default) |
| Footsteps ring in the room | World | Footsteps, wing beats and footfall thuds echo softly in the room they happen in and sound muffled from behind a wall, as Animater's hit sounds do (with Room acoustics and Muffle sounds behind walls on) (on by default) |
| Footstep hearing range | World | How far away footsteps, wing beats and other movement sounds can be heard (Foundry plays them only to tokens within this range). Huge and bigger creatures carry half as far again. Close 3 squares, Normal 6, Far 10, Very far 15 (Close (3 squares) / Normal (6 squares) / Far (10 squares) / Very far (15 squares); default Normal (6 squares)) |
| Creatures growl on their turn | World | With PF2e Creature Sounds active, a Large or bigger NPC sometimes growls from where it stands as its combat turn starts, heard only by those who could hear it. Uses that module's sound sets and volume (on by default) |
| Creatures cry out when they attack and are hurt | World + this screen | An attacking creature now and then grunts, snarls or roars as it attacks, a hurt one now and then cries out, in a voice for its creature and its creature type (a man or a woman, small folk, a wolf, a bear, a bird, a dragon, a zombie, a spider, a fiend and more), and one that falls always does, a little different each time in pitch and level, heard only by those who could hear it. Ghosts wail, skeletons rattle, oozes gurgle; animated objects and elementals stay silent. Works on every system; on PF2e, PF2e Creature Sounds voices them instead when it is active (on by default) |
| Creature voices from my own folder | World | A folder of your own creature sounds in your Data folder, used besides Animater's: each sub-folder is one voice, filed by its name (Huge Dragon, orc, banshee, Crow…), its `attack`, `hurt` and `death` folders holding the takes. The GM's screen scans it once and shares the list; the files stay yours and are played from your server, never bundled, so a commercial library you own can be used in your own games. An `animater-voices.json` beside the voices (`{"keep": [...], "reject": [...], "family": {"folder": "dragon"}}`) drops rejected folders, re-files folders, and once it keeps any, plays only those. A folder holding only part of a voice (no attack, hurt or death takes) is skipped, as is a folder whose sounds Animater already ships; the GM's screen rescans at each start (empty by default) |

**Combat drama**

| Setting | Scope | What it does |
|---|---|---|
| Momentum | World | Hits in a row by the same attacker on the same target, in one turn (or within 12 seconds out of combat), land harder: bigger, louder and with stronger ripples. A miss starts the streak over. In PF2e and SF2e, a third Strike in a turn that misses looks strained (on by default) |
| Damage lens | World | Blood on the lens, on players' screens only. When a creature is hurt, its blood splats on the screens of players whose creature stands next to it, whoever struck it (Enemy blood reaches), more for more damage, on the side it is; a ranged attacker far off sees none. When the player's own creature is hit, the view closes in (tunnel vision) and its own blood splashes the screen; a badly hurt creature keeps a faint tunnel in combat. Uses Splatter's blood colours and bloodless creatures when Splatter is active. Bloodless creatures, creatures that screen cannot see and hidden tokens never bleed on it. Players' Blood sounds choice (Hit sounds) Off turns it off, Subtle makes it subtle (on by default) |
| Damage lens on my screen | Each player | Turn off to never see the damage lens (blood on the screen) or tunnel vision on this screen. Off at first when this browser asks for reduced motion (on by default) |
| Damage lens amount | Each player | Heavy: bigger splats that drip and stay about four and a half seconds for a big hit. Subtle: a few small splats near the edges for about three seconds, and a lighter tunnel vision. Low animation quality always draws Subtle. How long it stays is set with Damage lens duration (Heavy / Subtle; default Heavy) |
| Tunnel vision when hurt | Each player | When your creature is hit, the view closes in from the edges for a few seconds, harder hits closer. Off at first when this browser asks for reduced motion (on by default) |
| Heartbeat when hurt | Each player | When your creature is hit, a few heavy heartbeats under the tunnel vision, harder hits louder and faster; while it stays at or under a quarter of its HP in combat, a quiet heartbeat that quickens the lower it gets. Played at the Hit sounds volume (on by default) |
| Wounded view | Each player | With the damage lens on, your own creature's state stays on your screen: from half its HP the edges darken red, deeper as it falls (beating with the heartbeat at a quarter HP in combat, much fainter out of combat), each hit taken leaves a stain or two on the edges that stay until it is healed, and under a quarter HP in combat the music and ambience close in. At 0 HP, dying or unconscious, the view closes to a dim blurred window, the world goes nearly silent and a faint heartbeat goes on; waking up gasps back to the light. Damage lens amount Subtle halves it; Low animation quality keeps only the edges (on by default) |
| Damage type effects | World | On players' screens only, with the same rule as the damage lens: each energy damage type their creature takes, or a creature next to it takes, leaves its own short mark on the screen beside the blood. Fire scorches the edges and throws embers, cold frosts them over, lightning arcs across, acid drops and bubbles, poison sways the view, sonic ripples it, force cracks the lens, void drains its colour, vitality flares, mental damage doubles the view, spirit sends pale wisps; Daggerheart's magic shimmers. Stronger for more damage, clearly stronger for critical hits. Damage lens amount Subtle and Subtle gore tone it down; Low animation quality keeps only the marks (on by default) |
| Damage type effects on my screen | Each player | Turn off to never see the damage type effects (scorch, frost, arcs, cracks, double vision...) on this screen. Off at first when this browser asks for reduced motion (on by default) |
| Enemy blood reaches | World | Whose screens a hurt creature's blood splashes: players whose creature is adjacent to it, also those one square away (reach), whoever struck it; or only the player whose creature struck it, wherever it stands (a ranged shot too). With adjacent or reach, a ranged attacker far off sees none (Adjacent creatures / Within one square (reach) / The attacker, wherever it is; default Adjacent creatures) |
| Damage lens shows | World | Which blows reach a player's screen: hits their creature takes and blood from creatures hurt next to it, only hits it takes, or only creatures hurt next to it. Covers the blood, tunnel vision, the heartbeat on a hit and the damage type effects. The wounded view of a hurt creature stays with its own switch (Hits taken and creatures hurt nearby / Only hits taken / Only creatures hurt nearby; default Hits taken and creatures hurt nearby) |
| Damage lens shows on my screen | Each player | Your own choice of which blows reach this screen: hits your creature takes, creatures hurt next to it, or both. As the GM set uses the GM's Damage lens shows (As the GM set / Hits taken and creatures hurt nearby / Only hits taken / Only creatures hurt nearby; default As the GM set) |
| Damage lens duration (seconds) | World | How long a big hit's blood stays on players' screens, in seconds (4.5 by default). Smaller hits stay proportionally shorter, drying and fading stretch with it, and damage type effects hold longer or shorter to match (2 to 20, default 4.5) |
| Damage lens duration on my screen (seconds) | Each player | Your own length for a big hit's blood on this screen, in seconds. 0 uses the GM's Damage lens duration (0 to 20, default 0) |
| Show flash screen menus in the Combat Tracker | Each player | The ⚡ Opening and Ending menus in the Encounter tab, its popout and PF2e HUD's tracker. Hidden, combats still play the default flash screens (on by default) |
| Hide the result of private GM rolls | World | A GM's private attack or save animates without showing whether it hit or missed: the shot flies at the target and nothing lands. Off: private rolls animate their real result, like public ones (the numbers stay private either way) (off by default) |
| Wait for Dice So Nice | Each player | Attack and damage animations start when the 3D dice for that roll have landed, so a hit or miss plays after you see the result (on by default) |
| Hope/Fear accent | World | Daggerheart: a duality roll with Hope adds a short gold glint on the roller's token, one with Fear a dark purple wisp, beside the item's own animation. Critical successes keep their own crit visuals (on by default) |

**Automation & catalogs**

| Setting | Scope | What it does |
|---|---|---|
| Play my own recipes automatically | World | Your saved recipes play when their spell, attack, damage or area happens. The catalogs have their own Plug & play switch and play whether or not this is on. Turn off overlapping animations in other modules to avoid playing twice (off by default) |
| Also use the SF2e catalogs | World | Items none of this world's recipes or catalogs know, such as Starfinder Anachronism guns and tech, play their SF2e catalog animation. The SF2e spell, feat, action, feature and weapon catalogs appear in Animater under Borrowed from SF2e, where you can turn them on, exclude entries or customize them (off by default) |
| Animate NPC abilities | World | PF2e and SF2e NPCs' monster abilities animate when used: Grab, Constrict, Swallow Whole, Engulf, Breath Weapon (when its area is placed), Trample, Pounce, Rend, Knockdown, Throw Rock, Ferocity, Change Shape and more. Your own recipes for an ability still come first (on by default) |
| Animate other NPC abilities from what they do | World | With Animate NPC abilities on, an NPC ability that has no animation of its own gets one from what it does: an area it places plays in that shape (cone, line, burst, emanation) and its damage's colour, damage with no area strikes its target, else its traits decide (a teleport blinks, a fear ability cries out). Off: only the named monster abilities animate (on by default) |
| Guess NPC Strikes | World | An NPC Strike that no weapon or creature attack name places still animates: by its damage (a slashing one rakes like a claw, others land as a blow), and a ranged one by what it throws or spits. Off: those Strikes play nothing unless you make a recipe for them (on by default) |
| Lasting condition animations (this device) | Each player | How lasting conditions and effects show on your screen. "Follow the catalog setting" uses each catalog's Lasting animation switch in Animater. "On application and at its turn start" plays them when applied and again briefly whenever that creature's turn starts in combat. The Defeated look keeps its own setting. Each player's choice affects only their screen (Follow the catalog setting / Always visible / On application and at its turn start / On application only; default Follow the catalog setting) |

**Interface & performance**

| Setting | Scope | What it does |
|---|---|---|
| Show Animater scene control button | Each player | Shows the Animater button in the token controls. Turn off to hide it; Alt+Shift+A still opens Animater (on by default) |
| Minimize Animater during canvas playback | Each player | Local preview and Play at table minimize the Animater window while the animation runs, then restore it (on by default) |
| Explain animations on hover | Each player | Hovering a token shows what Animater is playing on it right now: each animation's name, whether it comes from a catalog or a recipe, and whether it lasts (on by default) |
| Faster animations (this device) | Each player | Makes animations cheaper for your computer to draw, with no change in how they look. Covers every module that plays animations through Sequencer, not only Animater. In combat it also loads the next creature’s animations ahead of its turn, and it skips tiny details you could not see at your current zoom. Only your screen is affected. Turn this off if an animation from any module looks wrong (on by default) |
| Faster animations: position recheck (frames) | Each player | How often effects and sounds that follow a token double-check where it is, even when nothing seems to have moved. 30 frames is about half a second. Lower it if an effect trails behind a token that another module moves (1 to 600, default 30) |

**Integrations**

| Setting | Scope | What it does |
|---|---|---|
| Effect light reveals creatures (PF2e Visioner, homebrew) | World | For PF2e Visioner's auto-visibility only. When on, a creature lit by a spell's light (a Fireball in a dark room) counts as lit, so anyone with line of sight can see it for that moment. Not the rules: most spells don't shed light. Off, Visioner ignores effect lights. Needs PF2e Visioner 8.14.12 or later; without Visioner this does nothing (off by default) |
| Splatter: blood follows the damage | World | Animater sets how much each wound bleeds in Splatter: slashing and piercing most, bludgeoning less, fire and lightning little, psychic not at all. Critical hits and killing blows bleed more, and a kill's blood waits for its Finish Him! screen. The creature keeps its own blood color. Off: Splatter bleeds on its own (on by default) |
| Take over from Automated Animations when Animater has an animation | World | Automated Animations skips items Animater animates. Items customized in Automated Animations stay with it. If “Only animate what Automated Animations doesn't” is also on, that one wins (on by default) |
| Only animate what Automated Animations doesn't | World | Items Automated Animations animates (by its Automatic Recognition or a customized item) stay with it; Animater animates the rest. Items turned off in Automated Animations play Animater's animation (off by default) |
| Take over from Trigger Animations when Animater has an animation | World | Trigger Animations skips attacks, actions, areas, effects and conditions Animater animates, its wildcard triggers and Trove's included. A trigger made for that very item (naming its UUID) stays with it. If “Only animate what Trigger Animations doesn't” is also on, that one wins (off by default) |
| Only animate what Trigger Animations doesn't | World | Items a Trigger Animations trigger names (attack:longsword, template:fireball, condition:frightened, or the item's UUID) stay with it; Animater animates the rest. Wildcard triggers such as damage:* don't count (off by default) |

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
| Light | Every layer and token motion, without blur, glow or Tokenshade filters |
| Balanced | Main and secondary layers; no decorative layers or Tokenshade filters; up to 3 persistent effects per token |
| Low | Only the main effect of each animation, plus token motion; one persistent effect per token |
| Off | No Animater visuals (sounds still play) |

The player who starts an animation only sends optional layers to viewers whose level allows them, so slower computers never load footage they won't show.

## Integrations

- **Automated Animations.** Animater takes over items it animates. Items you customized in Automated Animations stay with Automated Animations.
- **Spell Arsenal.** Spells mapped to a Spell Arsenal area rule keep their lasting Spell Arsenal tiles. Tick *Also play Animater recipe* on a mapping to play Animater's animation beside them.
- **Trigger Engine / Trigger Animations.** Adds an *Animater: Play animation* node. **Only animate what Trigger Animations doesn't** leaves the items its triggers name to it; **Take over from Trigger Animations** does the reverse.
- **Splatter.** Animater sets how much each wound bleeds by its damage type, critical hits and killing blows bleed more, and the damage lens uses each creature's Splatter blood colour.
- **PF2e Visioner.** Footsteps, tracks and other movement effects respect what each player's tokens have detected; optionally, a spell's light counts as lighting the creatures it touches.
- **Dice So Nice.** Attack and damage animations wait for the 3D dice to land.
- **PF2e Creature Sounds.** Large and bigger NPCs sometimes growl as their turn starts, and on PF2e it voices attacking, hurt and dying creatures in place of Animater's own cries, except tokens given an Animater voice.

## API

```js
const animater = game.modules.get("animater").api;
await animater.play("Fireball", { source: canvas.tokens.controlled[0], targets: Array.from(game.user.targets) });
await animater.preview("Fireball"); // local only
animater.resolve(message);          // the recipe automatic playback would use, or null
animater.handles(item);             // true when Animater would animate this item or message
await animater.stop();
animater.clearGroundMarks();      // wipe ground marks: a GM clears every screen ({ everyone: false } for only yours), a player their own
await animater.importRecipes(code); // GM only: share codes, export JSON or { schema: 1, recipes }; merged by id like Import → { added, replaced, skipped }
```

Share a recipe: right-click it on the Recipes (or Finishers) page and choose **Copy share code** (one line starting `animater-recipe:1:`, paste it into **Import** in another world; several codes at once work too) or **Copy as macro** (a script macro that imports it when a GM runs it).

Macro to clear the floor at once: `game.modules.get("animater").api.clearGroundMarks()`. GMs can also bind **Clear ground marks** under Configure Controls (no key by default). Marks of lasting areas still on the board are cleared too and come back only if the area plays again.

Hooks: `animater.preDispatch(event, recipe)` runs before automatic playback (return `false` to claim the event); `animater.played(event, recipe)` runs afterwards.

## Known limits

- Foundry 14 only. Multiplayer replication and live D&D 5e / SF2e play have had less testing than PF2e.
- Area animations play once when the area is placed. For visuals that last as long as the area does, use Spell Arsenal.
- Actions whose area is placed separately (e.g. Dragon Breath) use their regular animation; template-driven action areas are planned.
- Token motion is cosmetic: lunges, recoils and other motions return the token to its place without changing its document. Only finishers and teleports move a token for real.
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
