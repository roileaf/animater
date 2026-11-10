[![Latest Version](https://img.shields.io/github/v/release/roi007leaf/animater?display_name=tag&sort=semver&label=Latest%20Version)](https://github.com/roi007leaf/animater/releases/latest)

[![GitHub all releases](https://img.shields.io/github/downloads/roi007leaf/animater/total)](https://github.com/roi007leaf/animater/releases)

[![Forge Installs](https://img.shields.io/badge/dynamic/json?label=Forge%20Installs&query=package.installs&suffix=%25&url=https%3A%2F%2Fforge-vtt.com%2Fapi%2Fbazaar%2Fpackage%2Fanimater)](https://forge-vtt.com/bazaar)

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/roileaf)
[![Patreon](https://c5.patreon.com/external/logo/become_a_patron_button.png)](https://www.patreon.com/roileaf)

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
| Optional | Calendaria | Weather works without it, from the scene's weather and the Weather panel; with it, Animater also follows the calendar's weather and temperature |

## Install

1. In Foundry's **Add-on Modules → Install Module**, paste the manifest URL:
   `https://github.com/roileaf/animater/releases/latest/download/module.json`
   For a specific version, use the manifest attached to that version on the [releases page](https://github.com/roileaf/animater/releases).
2. Activate Sequencer, a JB2A pack and Animater in your world.
3. Open **Game Settings → Animater → Open Animater** (or the wand in the Animater controls, or **Alt+Shift+A**).
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
- **What a fight leaves behind.** Arrows and bolts stay stuck in the walls, floors and shields they struck, and a body left on the map draws flies, then crows (a vulture for a big one) that scatter when anyone comes near. Drawn on each screen, never saved.
- **Shores and falling water.** A water region marked **This is the sea** gets waves, wet sand moving with the tide and crabs; one marked **This is a waterfall** falls the way it flows, with foam, mist and a rainbow in the spray. Still water and dripping pools mirror creatures and tiles on any bank, falling out across the water from the nearest one, along with nearby fires and the moon.
- **The sound of places.** The sea, waterfalls and flies at a body are heard as you come near. A region marked **This is a tavern** murmurs with voices: loud inside, faint through its walls, spilling out of an open door.
- **Dawn and dusk.** Birds sing all around at first light and go quiet at sunset; after a hush the crickets take over. Flames, torches and smoke out of doors lean with the wind.
- **Chosen scene by scene.** Scene configuration → Animater → **Outdoor life** (off or on) brings the animals, their calls, the crickets at night and the dawn chorus. **Town life** (off, quiet or busy) brings pigeons, chickens, a cat and a stray dog, and windows that go dark through the night. **Old tracks** (off, the GM sees them, or everyone) keeps prints that age by the game's clock for as many game hours as you set, with a button to clear them. Tracks of hidden or sneaking creatures show only to the GM. All three are off until you turn them on.
- **Breakable props.** Prop tiles such as barrels, crates and pots break: from an area spell once its damage is rolled, when a creature is forced into them (finisher knockback, a push, a blast push) or charges, rolls, dodges or lunges through them, and when a melee strike misses next to the target (a critical failure always; a plain miss by the scene's chance, rolled by the GM). The prop's own picture breaks into pieces that stay as wreckage, with a scorch, frost, stain, burn or dust mark for the kind of damage, and what it held (water, wine, oil, grain, loose goods) spills. The tile is hidden from players (the GM sees it faded) and the walls drawn on it stop blocking. It breaks with a sound of its material (wood, glass, clay, metal or stone, plus a splash when it held water, wine or oil), heard where it breaks. Furniture collapses into planks, bookshelves drop their books and potion shelves their bottles, lanterns go out and their oil can burn, braziers tip over, powder kegs explode in a chain, statues topple into rubble, and webs, vines and bushes burn away. Doors and windows break too, and a door can be forced open from its own control icon in PF2e, SF2e, D&D 5e, Daggerheart and Draw Steel (see [Breakable props](#breakable-props)). Unhide the tile, or press **Repair broken props**, to put the prop and its walls back (Repair also puts back doors, windows, lights and rubble). Off until you turn on **Breakable props** for the scene. Props painted into a map image, and FA Nexus flattened tiles, can't break.
- **The world around the fight.** Big blasts ripple the map and shake the view, a killing blow can get a slow-motion kill-cam, creatures breathe and fliers hover, and wounded creatures look hurt and limp. Moving tokens kick up dust, leave footprints by floor, splash through water and puddles when it rains, and burrow in and out of the ground; footsteps carry as far as you choose and sound softer when sneaking.

Every catalog entry can be previewed in the workspace, enabled or excluded individually, and customized into an editable recipe: stages, timing, assets, motion, sound and filters.

### Catalog controls

- Search and filter entries within each catalog.
- Enable the whole catalog, or choose individual entries with **Use animation**.
- While the whole catalog is enabled, hover a card and use **⊘** to exclude that entry. Click again to include it; excluded cards appear dimmed.
- Adjust token motion, sounds and volume using the catalog controls.
- Choose **Customize** to create an editable recipe for an entry. Entries marked as needing configuration require setup before automatic playback.
- **Reset catalog…** (GM, in a catalog page's header) puts that catalog back to the stock catalog after you confirm: its picked, left-out and customised entries are cleared, its look and sound choices go back to their defaults, and the recipes **Customize** made for its entries are deleted (the question names them). Your own recipes, the starters, other catalogs' and players' recipes are kept. It stays on or paused as it was unless you tick **Also switch this catalog back to its fresh-install state (off)**. The question marks which of those recipes you edited since Customize made them. A copy of what it deletes, with the catalog's state, is kept inside the world (one per catalog, until its next reset): **Restore last reset…** in the same header puts it back, recipes and state. The same backup also downloads as a file, which **Import** on the Recipes page takes back; for a copy of every recipe first, use **Export** there.

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

- **Reset to defaults…** (the window's footer) or **Reset this tab** (beside each tab's heading) puts the window's settings back to their defaults after you confirm: a GM chooses the world settings, this screen's or both; a player resets only their own screen's. A backup of every value about to change downloads first (a JSON file for your own records; nothing in Animater reads it back in), and settings already at their default are left alone. Menus (Hit sounds, Blood colours), catalogs, your recipes, the switch that plays them and the switch that borrows the other system's catalogs are never reset.

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
| Experimental: floor regions from the map | World | On the Floor & world tab, for the GM. Adds a Floor regions button in the Animater controls. Click it and Animater proposes water regions from this level's map. You can click areas of any floor on its preview. It runs only when you click (off by default) |
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
| Show Animater scene control button | Each player | Shows the Animater button in the Animater controls (for players, in the Token controls). Turn off to hide it; Alt+Shift+A still opens Animater (on by default) |
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

### Breakable props

Scene configuration → Animater → **This place** has **Breakable props** (off by default), **Chance a miss breaks a prop (%)** (25 by default), **Doors and windows break** (on; it only matters while Breakable props is on), **Rubble is difficult terrain** (off by default) and a **Repair broken props** button. The switches only decide new breaks; wreckage already on the map stays until you repair it.

Tile Configuration → **Overhead** tab → **Breakable prop** (its own box, below the Animater one; ground props have it there too) sets what a tile is. Every field starts on **Automatic**, which shows what was guessed from the picture's file name (it works best with FA Nexus props), such as *Automatic (wood)*; pick a value to override it.

- **Material:** Wood, Glass, Clay, Metal, Stone or Plant, or **Won't break**. Tiles larger than 3×3 squares, overhead tiles and roof tiles don't break unless you set a material by hand; a plant (a web, vine or bush) may be up to 6 squares long.
- **Breaks as:** **Shatter** (into pieces where it stands), **Collapse** (furniture: tables, chairs, benches, shelves, bookshelves, desks and beds fall into long planks and leg stubs that keep the furniture's outline), **Topple** (tall stone statues, pillars, columns and obelisks fall over along the hit) or **Burn away** (plants).
- **Contents:** what spills when it breaks: Nothing, Water, Wine, Oil, Grain, Loose goods, **Books** (pages and a few books slide off), **Potions** (coloured glass and stains), **Lamp oil** or **Black powder**. Bookshelves guess Books, apothecary and alchemy shelves Potions, lanterns and lamps Lamp oil, and powder kegs Black powder.
- **Burst (squares):** shows for Black powder: how far its explosion reaches, 1 to 4 (2 by default).
- **Light prop:** a lantern, lamp, candle, candelabra, torch, chandelier or brazier puts out the lights standing on it when it breaks.
- **Tips over instead of breaking:** a brazier is knocked over by any shove, whatever the creature's size: its fire goes out and hot coals scatter and fade. Spells and blows still break it by its material.
- **Rubble is difficult terrain:** shows for a prop that topples: **Scene default** follows the scene's switch, or say Yes or No for this one.

What happens to each kind of prop:

- **Lamp oil** spills when a lantern or lamp breaks, and catches fire when the cause was fire or the lamp was lit: a burning patch with flames, a glow and a crackling fire for about a minute, then a scorch mark. After a reload it is just the scorch.
- **Black powder** explodes when fire, electricity or another explosion breaks the keg: a flash, smoke, debris, a big scorch and an explosion sound, and every prop, door and window inside the burst breaks, nearest first, so a row of kegs goes off one after another (each keg once). Broken any other way, say by an axe, the powder spills instead, and a fire spell over that spill later sets it off once. Tokens are not damaged: the GM gets a whisper, "Powder keg exploded — 2-square burst", naming the tokens inside. Roll their damage yourself.
- **A statue or pillar** topples from force damage or a slam from a Large or bigger creature. It falls along the hit and breaks into big chunks over a strip about 1.4 times its longer side, with a dust cloud. With rubble as difficult terrain, the strip becomes a Region where walking costs double. Tokens under it are not damaged: the GM gets a whisper naming them.
- **A plant** only breaks from fire: it chars and crumbles to ash from the side the fire came from, with embers, leaving an ash mark. A web or vine also breaks from slashing: it is cut and the halves sag apart.

**Doors and windows.** Wall Configuration has a **Breakable** box on every wall.

- On a door (or secret door): **Breakable door** (**Automatic**, on when the scene has Breakable props, or **Never**), **Material** (Wood, Metal or Stone), **Can be forced open** (on by default) and **Force open DC** (blank is Automatic by material, shown as *Automatic (15)*). A wooden door breaks from bludgeoning, slashing, force or a fire area, and when a Large or bigger creature is forced or charges through it; a medium creature shoved into it does not break it. A metal or stone door breaks only from force or a Huge or bigger creature. Locked doors break too. A broken door becomes an open gap: splinters and broken planks lie on the far side, and a dark jagged gap is painted over the door so a door painted into the map reads as smashed.
- On any other wall: tick **Window** to make it a window, with **Material** Glass (the default) or **Won't break**. A window breaks from anything that breaks glass, from any creature forced through it, from a ranged attack whose missed shot flies into it, and from a melee strike that misses next to it. A missed shot flies on past its target, a little to one side, as its animation shows: the first window on that path breaks when the shot reaches it. A missed melee strike can break a window beside its target as it would a prop, but never one on the attacker's side. A critical failure always breaks it; a plain miss breaks it by the scene's **Chance a miss breaks a prop (%)**. A broken window lets sight, light and sound through but still blocks movement (you'd have to climb through the frame). Glass shards fan out on the far side.
- An area breaks a door or window when it covers the middle of the door or window.
- An area only breaks things when it was placed on the map for that spell (its template or region), by that player or a GM, in the last 10 minutes, on the same level. The GM's screen checks this, so a player can't break a door or set off spilled powder without a real area over it.
- **GM smash:** Shift+right-click a door's control icon to smash it open (from the selected token's side, if one is selected), in any game system.

**Force open from the door.** In PF2e, SF2e, D&D 5e, Daggerheart and Draw Steel, a player right-clicks a closed or locked breakable door's control icon and is asked "Force it open? Athletics vs DC 15" (in the system's words). It rolls for their selected token, or their only token within 1 square of the door. A GM does the same for a selected token with Alt+right-click. A roll that meets the DC breaks the door open.

- **PF2e and SF2e:** the system's Force Open action with the door's DC; a success or critical success breaks it. A Force Open rolled from the character sheet without a DC is checked against the DC of the closest closed breakable door within 1 square.
- **D&D 5e:** a Strength (Athletics) check; a total that meets the DC breaks it.
- **Daggerheart:** a Strength action roll against the door's Difficulty; a total that meets it breaks it, and a critical always forces it.
- **Draw Steel:** a Might test; tier 2 or 3 breaks a wooden door, only tier 3 a metal or stone one.
- **Default DCs:** PF2e, SF2e and D&D 5e: wood 15, metal 20, stone 25. Daggerheart: wood 13, metal 16, stone 19. Type your own DC to change it for a door.
- **Other systems** have no Force open roll here: the GM smashes the door with Shift+right-click.
- **Tested so far:** the PF2e roll has been tried at the table. The SF2e, D&D 5e, Daggerheart and Draw Steel rolls follow each system's own roll but have not been tried in play yet; if one shows a warning instead of a roll, report it.

**Decorations.** A region's painted decorations can break too, the same way prop tiles do. Right-click the region → **Decorations** and tick **Decorations can break** (off by default, for each region). Nothing breaks unless the scene's **Breakable props** is on as well; the panel says so when it is off. They break from the same things as props: an area once its damage is rolled, a melee strike that misses beside its target (never on the attacker's side), a creature shoved, blasted or charging into one, and a powder keg's burst.

- **Crates** and **Barrels** are wood: they shatter into pieces where they stand.
- **Crystals** are glass: they shatter from almost any damage.
- **Bushes**, **Ferns**, **Spiky plants** and **Reeds** are plants: only fire burns them away. A creature shoved through a bush leaves it standing.
- **Cobwebs** burn from fire, and a slashing hit cuts them apart.
- **Stalagmites** and **Rock columns** are stone: force, or a Large or bigger creature slammed into one, topples it along the hit. With **Rubble is difficult terrain** on, the fallen strip is difficult terrain, and the GM gets a whisper naming any tokens under it.
- **Coffins**, **Produce crates** and **Water troughs** are wood and break like boxes; **Washtubs** break round. Produce spills its goods, troughs and washtubs their water.
- **Fences** and **Benches** are wood and collapse into their boards.
- **Gravestones** are stone and topple like a stalagmite (force, or a Large or bigger creature).
- **Urns** and **Planters** break like clay, from almost any damage; urns spill their grain.
- **Sarcophagi** are stone too heavy to shove over: only force breaks one.
- **Cages** are metal: bludgeoning, force or acid, or a Large or bigger creature shoved into one.
- **Braziers** tip over from any shove, spilling their coals, and break like metal from damage. A broken or tipped brazier's light goes out until it is repaired.
- **Hay bales**, **Tents** and **Bedrolls** burn away, from fire only.
- **Sacks** tear open from a slashing or piercing hit and spill their grain; fire burns them. A club or a shove only thumps them.
- Underground, cobwebs and crystals are drawn by the cave's webs and crystals: a cobweb breaks only where a web is drawn (in a corner against walls), and crystals only while the scene draws cave crystals.
- Every other kind (rocks, boulders, trees, stumps, logs, mushrooms, bones, mine timbers, wells, paving, anvils, treasure, street lamps, tables, market stalls and the rest) never breaks.

The wreck is cut from the decoration's own painting, and every screen sees the same one; after a reload it lies there settled and silent. Breaks are stored on the region. Turning the switch off stops new breaks, but the ones already made stay. The region panel's **Repair decorations** button (GM) puts back every broken decoration in that region and removes their rubble. **Repair broken props** puts back every region's decorations too.

A scattered decoration is known by where it stands. Editing the region so its decorations move (its shape, **How dense**, **Size**, a kind's size or how many, ticking kinds, **Reshuffle**, or rubbing out with the brush) brings its decorations back whole, and a toppled one's rubble goes with it. Undoing that edit brings the other breaks back. Decorations you painted by hand keep their breaks for as long as they stay.

**Repair broken props** puts back everything: props, their walls, doors (locked ones locked again), windows, the lights that went out, broken decorations, and rubble regions; burning oil's lights go too.

What breaks what: glass and clay break from any bludgeoning, piercing, slashing, fire, cold, electricity, acid, sonic or force damage; wood from bludgeoning, slashing, fire, electricity or force; metal from bludgeoning, force or acid; stone from force. A creature forced into wood, glass or clay breaks it; into metal or stone, only a Large or bigger creature does. Poison, mental, spirit, vitality, void and bleed never break a prop. Deleting a broken tile puts its walls back as they were.

A charge, roll, dodge or lunge (or a keyframed path) that carries a token's centre through a prop smashes it as the token gets there, by the same rule as being forced into it; a leap goes over it. Only a prop ahead of the creature breaks: one it stands on (a table, a cart, a bridge), or one overlapping its square that it moves away from or past, stays whole.

On a scene with levels, a prop breaks only from something on its own level (the area's level, the missed target's, the moving creature's), and its wreckage shows only while that level is viewed, as the tile itself would.

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

## Experimental: floor regions from the map

This is an experiment. It is off until you turn it on.

Open **Animater settings**, go to the **Floor & world** tab, and turn on **Experimental: floor regions from the map**. Only a GM sees this switch. On a scene, open the **Animater** controls and click **Floor regions**.

**Any floor.** The automatic read finds water. Every other floor comes from your clicks: stone, pebbles, wood, dirt, grass, sand, snow, ice, mud, glass, metal and lava.
- **Floor to add:** pick a floor from the **Floor** picker in the toolbar, and each area you mark takes that floor. Areas are painted in their floor's colour and numbered as in the list.
- **Marked by itself, learned from your regions:** once you have saved some floor regions, opening the window (or **Mark areas** in the toolbar) marks the areas that look like them, of any floor, as ticked rows with their floor, texture, pattern, soft edge and Over water. Each says "learned". The map is cut with the Smart model when it is already downloaded (it never asks here), else by colour. Untick or remove a wrong one before you save, and it is remembered as not a region: it is not marked again. Ctrl+Z takes all the marked areas back at once.
- **Auto:** on **Auto** (the picker's first choice), an area you click takes the floor of the saved regions it looks most like. When nothing looks alike yet, its row says **Pick a floor** and stays unticked until you pick one; colour alone can't tell dirt from stone or murky water, so Auto never guesses. With a floor picked, that floor stays, and only its look is learned.
- **What it remembers:** every region you save, and every floor region already on a scene you open, in the world (the last 400). Nothing leaves your world.
- **Changing it later:** every row has its own **Floor** to change afterwards. The water settings (kind, flow, current, waves, beach) show only on water rows.
- **Saved regions:** a region is saved with its floor. Switching a saved region away from water clears its water settings, and switching it to lava brings lava's own steps. Smart selection (below) is usually the better way to mark floors that are not water.

**Combine areas.** Tick two or more areas and choose **Combine ticked** to merge them into one region.
- **Which area survives:** the merged region keeps the largest ticked area's floor and settings. A ticked saved region is kept instead, so it is updated, not replaced.
- **What can't be merged:** two saved regions.
- **Undo:** **Undo last change** splits them again.

Animater reads that level's map and opens a window. It shows a preview of the map and a list of proposed pieces. Each blue area it found is one row. Large areas start ticked. Small ones start unticked. Hover a row to see it on the preview.

**Click the water.** The automatic read finds only strongly coloured blue and teal water. If it found nothing, the window says why and stays open. Click water on the preview, and Animater follows that colour out from your click and adds a ticked row. This is how you get muted underground water, and water of any other colour. A bad click on stone is easy to undo. A clicked piece larger than a quarter of the map shows a warning, and **Remove** takes any row away. Outside Add to area mode, a click on a piece already in the list adds nothing, and neither does a click on a spot with no clear colour or a patch too small to be a region. You get a short message instead.

**Review the map.** Use the zoom buttons or scroll over the preview to zoom in. Drag or middle-drag to pan (middle-drag pans in any mode, even while editing an outline), and choose **Fit map** to see the whole image again. The area list scrolls separately. Its heading shows the number of areas found and selected. The save button shows how many areas are selected, and a notification confirms the number created and updated.

**Extend one area.** Choose **Add to area** (the + on the ocean's row), then click missed shallow water on the map. Each click samples that water's colour and adds its shape to the same draft region. The region keeps its kind, flow, wave, and beach settings. To combine an existing piece, click that piece on the map while Add to area is active. Each click adds only the area you click. The row checkboxes only choose which areas to save. They do not control Add to area, and choosing a target does not tick its checkbox. Disconnected pieces can belong to one region without filling the land between them. **Undo last change** restores the previous shapes. Choose **Done** to return to adding separate areas. These edits remain proposals until you create the regions.

**Edit an outline.** Select the area in the list and choose **Outline**. Drag a handle to pull back an overshoot, including a dock or bank the colour read included. Double-click an edge to insert a vertex. Select a handle, then choose **Delete vertex** or press Delete or Backspace. Every ring needs at least three vertices. Shores and holes cannot cross, touch, or change which shore contains a hole. Invalid changes leave the draft unchanged. Drag empty space or use the middle mouse button to pan. Escape cancels the current drag, then exits editing. **Smooth shore** softens outer shores with at most two read pixels of boundary drift per action and leaves hole coordinates unchanged. **Undo last change** keeps up to 20 outline edits and additions, while preserving current checkbox and water settings for rows still present. Edits do not tick rows. Choose **Done**, then tick the areas you want to save.

**Click colour range** starts at **Narrow**. Choose **Wide** to follow more shades through connected water. Wide can also join touching grass or banks of similar colour, so inspect its result before creating regions. Both ranges preserve contrasting floating objects as holes.

**Smart selection.** Switch the tool above the preview from **Colour** to **Smart** to trace areas from their shape and texture, not only their colour. It works better for rooms, wood, stone, and water drawn in muted colours.
- **The model:** it uses SAM 2.1 large, a segmentation model that runs in your browser.
- **The download:** the first time, Animater asks before downloading about 456 MB from huggingface.co and its library from cdn.jsdelivr.net. After that, it loads from the browser's cache. The map is read on your computer and is not sent anywhere.
- **Speed:** with WebGPU, reading a map takes a few seconds and each mark under a second. Without WebGPU it runs on the CPU, which is much slower.
- **Marking:**
  - Click an area to add it. The click is checked against a few nearby points, so a click on a rock or a bush still finds the floor around it.
  - **Shift+drag** a box around a room or a pond to add what is inside it.
  - Right-click a bush, rock or patch inside any area to cut it out. The model finds that thing on its own and leaves a hole where it was. When the thing is only partly inside the area, just the part inside goes. Press **1**, **2** or **3** right after to cut a smaller or larger piece. A big thing that plainly looks different (a stone bridge over a small pool) can be cut too, up to most of the area.
  - **Same colours** (on by default, next to the Floor picker): a click keeps to the colours around it, so chairs, a rug or a bush of another colour standing on the floor are left out as holes. Turn it off for a floor of many colours.
  - What you take out stays out: a part cut, swept or right-clicked out of an area is left out of every later selection of that floor, so selecting the next grass area does not take the bush back. Another floor can still take it. To put one back, click right on it: just that part returns, into the area you are adding to or the area it touches. Undo also brings it back.
  - Floor texture: **Floor texture** at the bottom of the window chooses whether the ticked regions paint their floor's texture over the map (as the scene says, paint it, or don't), and what new areas start with. Each area can set its own when selected.
  - Texture preview: an area that will paint its floor shows on the map drawn by the scene's own floor renderer, so it looks as it will once saved. Select it to choose its **Pattern** and **Soft edge**.
- Step and Over water: a selected area can pick its starting **Step** (the same list as the region's right-click menu) and, for a floor you can stand on, **Over water** for a deck, jetty or bridge.
  - Undo: Ctrl+Z, or the undo button in the toolbar, undoes the last change of any kind, including settings, new areas and removed ones.
  - Split off part: select the area and choose **Split**, then drag a loop around part of that area on the map (a waterfall in a river). That part becomes its own area with the same floor and settings, ready for its own kind.
  - Stray spots and fingers: right-click a small separate piece of an area, or a thin finger of it running into a bush, to remove it (in Smart or Colour), or select the area and choose **Tidy** to remove every small piece at once, or **Remove all small spots** at the bottom to do it for every area. Ctrl+Z undoes the last change. The main body and pieces at least 5% of its size stay.
  - Press **1**, **2** or **3**, or use the **Size** buttons at the bottom right of the map, to switch the last area or cut between the model's small, middle and large versions. The size in use is highlighted, and the buttons show only while there is something to resize.
- **What it keeps:** only the pieces you clicked, with small enclosed holes (a table, a bush) filled in.
- **Adding to an area:** after **Add to area** (the + on its row), a smart click joins that area.
- **Accuracy:** in testing on 41 hand-drawn regions from real adventure maps, a click or a box with at most one correction matched the drawn region at 85% overlap three times in four. Check each area before creating regions.

Set **Kind** to still pool, river, rapids, waterfall, or sea. Flowing water supports compass directions or **Follows the wind**. Rivers can be gentle or swift. Rapids and waterfalls use a swift current. For the sea, choose the wave direction and whether to add a beach. These choices use the same water settings as Region configuration. Shared controls set kind, flow, or current for every ticked row.

**Create regions** writes the ticked shapes as regions on this level, each with its row's floor. Several new regions of one floor are numbered (Grass 1, Grass 2).

**Edit saved water.** Reopening the generator loads regions it previously created on this level, with their saved outlines, names, and water settings. They start unticked. Choose **Add to area** to extend one, **Edit outline** to change its shore, or change its settings, then tick that row and save. The generator updates that same region ID. It preserves the region's name, color, behaviors, steps, and settings outside these controls. An unchanged or unticked saved region receives no update. New areas are created alongside existing regions. Nothing is deleted, including regions created since the window opened. Shared, all-level, and hand-drawn regions stay outside the editor. A saved area cannot be absorbed into another saved area; edit it separately. If you move to another scene while the window is open, it still saves to the scene it opened on.

**Limits.**

- Image resizing can hide a narrow dock or channel. Use **Edit outline** to pull the shore back around it.
- A saturated roof larger than the water can fool the automatic read. Untick it, then click the real water.
- A lone pool under about a quarter of a percent of the map can be too small for the automatic read. So can a thin river, even a long one, because the read needs a block of solid colour. Click it.
- A map with more saturated colours can lift roofs into the automatic selection. Untick them. The window shows every piece before anything is made.
- Pieces never share a map pixel, but their simplified shores can overlap by up to 2 pixels of the 1024-pixel read where two pieces meet.
- Click selection follows connected similar colours. A sharply different rim or disconnected pool needs another click or manual drawing.
- A video or SVG background cannot be read. Use a PNG, WebP or JPEG map.
- A level whose background is moved, scaled or rotated in its configuration cannot be read, because the shapes would land in the wrong place. The tool says so and opens nothing. Reset the position first.
- Detailed shores can go over the tool's target of 400 corners a piece, because it keeps the shape accurate rather than rounding it off.

If it marks a roof, or misses water you can see, report the map on the [issue tracker](https://github.com/roileaf/animater/issues).

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
