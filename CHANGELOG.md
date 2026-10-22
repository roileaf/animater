# Changelog

## Unreleased

- **Map distortion.** Big magic now bends the scene itself, map, tiles, tokens and effects together. Explosions, area bursts of 2 squares or more and critical hits with heavy two-handed weapons send a shockwave ring rippling out from the blast; lasting fire areas and fire auras shimmer with heat until they end, the aura's shimmer moving with its token; an Animater teleport pinches space where the token leaves and where it lands. Up to four distortions show at once, kept subtle and the same at any zoom; nothing is added while the map is still. Distortion is drawn on each screen at Full quality only, and a screen that is running slow skips new ripples (heat haze carries on). Turn it off with **Map distortion** (world) or **Map distortion on my screen** (each player, for example if it is uncomfortable to watch).
- **Afterimage trails.** Charges, leaps, knockbacks and teleports leave a brief afterimage trail; each screen can turn it off. While a token rushes, leaps, rolls or is flung at speed, translucent copies of its art drop behind it and fade within half a second, only on the way out and never on a slow drift or an in-place lunge. A teleport leaves a short streak of copies from where the token stood to where it lands. Copies take the action's colour (the stage's tint, the spell's element, the recipe colour, else a soft white; a misty step streaks blue), look the same on every screen, and sit under the token. Each rush, leap, roll, dodge, path, push or pull stage has an **Afterimages** choice in the Studio: Auto (moves of a square or more), Always or Never. They show at Full, Light and Balanced quality. Turn them off with **Afterimage trails** (world) or **Afterimages on my screen** (each player).
- **Ground marks.** Elemental hits now leave fading scorch, frost and acid marks on the floor where they landed: fire scorch, cold rime, acid residue, electricity streaks, poison stains, sonic and force cracks, and withered void. Elemental spells (spell attacks and damaging spells), areas and alchemical bombs and flasks mark the floor; ordinary weapon strikes and rune damage do not. A single target gets a mark under it and an area gets a cluster clipped to the template. Marks stay full for 2 minutes, then fade over the next 3 (set **Ground mark lifetime (minutes)** to change this, or 0 to keep them until the scene changes); a lasting area's mark stays until the area ends. PF2e impulses and NPC actions mark only when their animation plays on the damage roll. Marks are drawn on each screen, never saved, and cleared on reload or on a scene or level change; Off quality draws none and Low draws half as many. Turn them off with **Ground marks** (world) or **Ground marks on my screen** (each player).
- **Projectiles stop at walls.** A hit that the shooter can see flies on to the visible part of its target, while a shot at someone fully behind cover thunks into the wall and the target shows no impact. A miss flies wide past its target and fades out, and only a miss that meets a wall on its line thunks into it; with several targets, a target that was missed shows no impact even when the others were hit. A wall strike knocks on stone (on wood for a door) when the recipe plays sounds. Shots fly through anything that does not block them, such as an arrow slit. Turn it off with **Projectiles stop at walls** (world).
- **Effect lighting.** Fire, lightning, radiant and other glowing effects now light the scene around them with a temporary real light, on every screen. Walls block it like any light, and in dark scenes tokens with sight of the area see what it lights; it never reveals more than normal light rules would. Flights carry a travelling glow, impacts flash, lightning strobes, fire flickers, and lasting areas pulse or flicker until they end. A cone or line lights its middle, an aura's light moves with its token, and the light sits on the caster's level. In fully lit scenes it shows as a soft coloured glow instead. Each part can be turned off: **Effect lighting** and **Effect lighting in daylight** (world), and **Flickering and flashing effect lights** (each player) for a steady glow instead of flicker or strobe.
- **Faster animations.** Animater now makes Sequencer itself cheaper to run, for every module's effects, not only Animater's. Sequencer's animation engine no longer allocates every frame (same results, checked frame for frame against the original); effects attached to or stretched between tokens only recompute when something moved; positional sounds stop rebuilding their area and muffling every frame; and effects with filters or masks are skipped while off-screen. Animater also loads the next creature's weapons and recently used footage before its turn, starts per-target copies a frame apart, skips decorative layers too small to see at your zoom or arriving while your computer is busy (on your screen only), and never skips a spell's main hit. On by default under **Faster animations (this device)** (each player), which also switches that preloading and skipping; turn it off if an effect from any module looks wrong.

## 1.6.3 (2026-10-22)

- **A Light animation quality.** **Animation quality (this device)** has a new **Light** level between Full and Balanced: every animation and every layer still plays, with token motion, but cheaper to draw. Token shader filters are off (as on Balanced), and the costliest effect filters, blur and glow, are left out; colours and tints stay. Balanced and Low now leave out blur and glow too. Like the other levels, it only changes what you see on your own screen.

## 1.6.2 (2026-10-22)

- **D&D 5e recipes play for the same spell from any book, activity included.** A recipe made for one of a spell's activities (every catalog recipe you customize is) only played for that exact activity id, and each compendium gives its activities ids of their own: the 2024 Player's Handbook Fireball or Sorcerous Burst still did nothing. On a copy of the spell from another book, a module or an importer, the same kind of activity (a save, an attack, a heal) now counts as the same. On the very spell it was made for, a recipe still plays only for its own activity. Thanks to y-deda-povis for tracking this down. ([#10](https://github.com/roileaf/animater/issues/10))

## 1.6.1 (2026-10-21)

- **A recipe bound to a spell plays for that spell from any book.** Dropping a spell from a compendium onto a recipe used to make it play only for items made from that very compendium entry, so the same spell from the 2024 Player's Handbook, another module, an importer or a copy stayed silent. It now plays for any item of the same name, and the exact item it was bound to still comes first. A recipe bound to one character's own item still plays for that character only. ([#10](https://github.com/roileaf/animater/issues/10))
- **Recipes say when they won't play.** A recipe card and the Studio used to say "Ready to play" even while **Play my own recipes automatically** was off, so a recipe could preview fine and then do nothing at the table. They now say "Won't play: Own recipes are off" and how to turn it on. ([#11](https://github.com/roileaf/animater/issues/11))

## 1.6.0 (2026-10-21)

- **Push and Pull stages move targets for real.** Two new motions on the timeline, **Push away** and **Pull closer**, move each target a set number of squares (1 to 10) away from whoever acted, or toward them, at the moment the stage starts: place it after the blast, the swing or anything else. Walls stop the move, and a pull stops beside the puller. **Only on a hit** leaves targets that were missed where they are. **Who picks the square** lets the one who acted, or the target's side (the GM for monsters, the player for their character), click where the target goes: any square inside a shaded wedge pointing away from the attacker (toward them, for a pull), 90° wide unless you set its **Direction cone**, with no wall in between. Esc, or no pick within a minute, leaves it in place. A local preview shows a recoil or lunge and moves nothing, and the recipe's composition preview draws the reach: a push with the target beside the caster and the wedge opening away, a pull with the target its squares away and the wedge pointing back (a straight arrow when nobody picks). Thanks to doubledunkindonuts and camrun91 for the ideas.
- **Pan the map while picking a spot.** While you pick where a teleport lands or where a push or pull goes, right-click and drag pans the canvas as usual; only Esc cancels. Before, a right-click cancelled the pick.
- **Your own recipes beat a catalog you turned on.** With a catalog on (Plug & play), a recipe you made for an item, such as your own dagger animation, now plays instead of the catalog's. Before, turning the weapons catalog on (and the others) silently replaced it. A catalog entry you picked by hand (Use animation) still plays over your recipe, and the starter recipes every world begins with still make way for the catalog. The catalog pages say which one plays.
- **Rerolls animate.** A Pathfinder 2e or Starfinder 2e reroll (a Hero Point, a fortune effect) now plays with its new result: a miss turned into a critical hit plays the critical hit, crit finishers and Shove or Trip finishers included. A reroll that kept the old roll changed nothing and stays quiet.
- **Finish Him! plays before the finishing blow.** When a finisher kills the last enemy, the Last enemy falls screen now plays first and the finisher follows it, instead of both playing at once.

## 1.5.6 (2026-10-21)

- **Flash screens can name the party and ask the GM for names.** Two new words for any text layer:
  - **{party}** (or **{partyname}**) is your party's name: Pathfinder 2e's Party, D&D 5e's primary party, else "The Party".
  - **{manual}** asks the GM to type a name as the screen plays, and shows it to everyone. **{manual:Enemy side}** asks with that label, and a screen can ask for several names in one popup. The combat remembers the answers, so the next screen starts with them filled in.

  Thanks to silentbrad for the idea.

## 1.5.5 (2026-10-21)

- **Spells with several targets animate on all of them.** Pathfinder 2e records only the first of your targets on a damage roll, so a two-target spell such as Electric Arc could leap to just one enemy. A spell now plays on every creature you have targeted when you roll its damage. A weapon's damage still plays on the one creature its Strike hit.
- **The weapon catalog's switches no longer overlap.** In a narrow window, the Weapon sounds switch could slide under Surface sounds; the switches now wrap to a second line instead.

## 1.5.4 (2026-10-21)

- **Block or dodge.** A miss against a raised or magical shield now either rings off the shield or is dodged, never both. The shield takes about three misses in five, critical misses included; a blocked arrow or bullet flies into the shield instead of wide. Each attack draws one for each target, and every player sees the same.
- **Steel shields ring, wooden shields thunk.** A raised shield sounds like what it is made of: steel shields, bucklers and fortress shields clang like metal; wooden, tower and hide shields knock like wood. In Starfinder, shields are metal.
- **Melee hit sounds land when the weapon connects.** A swing animation winds up before it strikes; the hit sound used to play when the swing started, up to a second early for an axe. It now lands as the weapon reaches the target. Arrow, bolt, bullet and thrown-weapon impact sounds now land as the shot arrives.
- **Blood follows the blow.** The splatter now always comes after the body's hit, never before it.
- **A missed arrow or bullet blocked by a raised shield now thunks as it arrives.** Before, the block sounded most of a second late, after the shot had already flown past, and the target dodged late too.

## 1.5.3 (2026-10-21)

- **Cleaner hit recordings.** An audit of every hit sound found and fixed: arrows hitting flesh or leather that thunked like an archery target, two recordings that hit twice, a metal hit with its own swing baked in, five glass and plate hits that cut off abruptly (now fade out), and magical ward chimes that played quieter than the rest of their set.
- **Skeletons and shelled creatures no longer sound like breaking glass.** Their hits now use only bone and shell crunches; a shattering pot recording is gone from the set.
- **The body answers the blow.** A weapon's own hit now always comes first, and what it lands on (armour, flesh, a shell) follows a moment later. Before, a clang could ring before the strike, and a slow crunch could trail far behind it.

## 1.5.2 (2026-10-21)

- **All hit sounds in one menu.** A new **Hit sounds** menu in Animater's module settings holds the whole hit sounds engine. The GM turns weapon surface sounds on or off for the world, and each player sets their own device: hit sounds on or off, volume, blood, echo, and hearing hits where they happen. Turning hit sounds off for your device silences surface hits and plays Animater's other sounds plain, for you only.
- **Hear hits where they happen.** Animation sounds now come from where they happen, heard from your own token (or the middle of your view without one). A hit far away is quieter and duller, and one on the left of your screen sounds on the left. Each player can turn it off in the **Hit sounds** menu.
- **Scenes have acoustics.** A new **Animater acoustics** field in Scene configuration sets how hits ring in that scene: **Open air** has little echo, **Hall or temple** has a longer one, and **Cave or dungeon** has a long, dark one that also gives Animater's other sounds some room.
- **New recordings:** a magical ward now chimes like crystal instead of ringing like a bell, leather and padded armour thud like real leather, oozes have more squelches, and fire has more flame bursts.
- **Chests, altars and traps sound like what they are made of.** Loot and hazard tokens are no longer treated as flesh: a coffin or cupboard knocks like wood, an altar or pedestal sounds like stone, an iron chest clangs, and a haunt makes no sound.
- **Hits on flesh, shells and oozes sound real.** A blade on bare skin now slices, a dagger stabs and a hammer thuds wetly, instead of sounding like a punch. Spiders, insects and skeletons crunch and crack instead of knocking like wood, and oozes squelch. These are real recordings cut into single hits, bundled with Animater, so they play without any sound pack.
- **Every hit rings in its own space.** Each surface hit gets an echo rolled anew every time: a shield's short metallic slap-back, a ward's long shimmer, glass ringing, metal and stone a quick slap, soft bodies only a hint of room. Everyone at the table hears the same echo.
- **Each kind of weapon sounds like itself.** A hammer lands lower and heavier, a dagger higher and sharper, a sword in between, on every surface.
- **Flesh bleeds.** A hit on flesh adds a short splatter of blood just after the blow: a splat for a slash, a gush for a stab, wet gore for a crushing blow.
- **Bows, guns and attack spells sound like themselves.** An arrow thunks into wood and shields and ticks off plate; a bullet smacks into flesh and ricochets off armour; an attack spell (Produce Flame, Fire Bolt, Daggerheart magic) keeps its own impact and only rings where there is something to ring: a ward or a shield turning it aside, metal armour, a glass body.
- **Each element has its own touch.** Fire sizzles and bursts, lightning zaps and arcs off metal, cold cracks like ice, acid hisses, on every surface; force and other energy only ring off wards, shields, metal and glass.
- **Starfinder guns sound like what they fire.** Projectile and sniper weapons hit like bullets; lasers, flamers and plasma sizzle, shock weapons zap, cryo weapons crack like ice, corrosive weapons hiss. Grenades keep their own area sounds.
- **A smarter, layered hit.** Each hit now builds from a main sound plus layers, each played by chance: blood on flesh (about half the time), a burst of flame under fire, icicles after a frost crack, shards after glass, a shimmer over a ward. A critical hit plays every layer, a little louder and lower. A set never plays the same recording twice in a row, and the surface lands a few milliseconds after the weapon's own impact instead of piling onto it.
- **Big bodies and heavy weapons sound like it.** A hit on a Huge creature lands lower and heavier than one on a Tiny creature, and a two-handed or heavy weapon lands harder than a light, agile one, in every system.
- **Your own mix.** Each player sets their own surface sounds volume, blood sounds (full, subtle or off) and echo amount in the **Hit sounds** menu. They change only what you hear.
- **No pile-ups in busy moments.** When many hits land at once (a flurry, several attacks together), each player hears at most six surface sounds at a time, and the extra layers drop out first.
- **Every hit at the same loudness.** All bundled recordings are balanced to one level, so no variant is near-silent or harsh, and none clip.
- **Hits no longer cut off.** Every bundled recording now plays its full natural tail, and sizzles and hisses die away instead of stopping.
- **The echo stays under the blow.** It now sits well below the hit itself: a clear ring off shields, wards and glass, only a hint of room on bodies.
- **Wood is its own sound.** Treants and other plants, wooden armour, animated furniture and dolls, and Barkskin now knock like wood, apart from the crunch of chitin and bone.
- **More free sounds, credited.** The new recordings come from Freesound creators AKkingStudio, ani_music, Anthousai, Aurelon, aust_paul, BrassKnucklesFilms, caiogracco, craigsmith, cyoung510, dav0r, DSPena, eben-frostey, elliott.klein, exorsten, gagglepod, GodofPH, GreatNate98, harrisonlace, iainmccurdy, ihitokage, JackMenhorn, janbezouska, jawbutch, JelloApocalypse, jimbo555, JustInvoke, Kreastricon62, kyles, LookIMadeAThing, lori.mortimer, MadPanCake, magnuswaker, martian, MHockett, modusmogulus, nebulasnails, omerbhatti34, Pancakebees, Perel, qubodup, rafaelzimrp, RMSound, rsellick, rubberduck9999, Sadiquecat, SignatureSoundsOrg, sillygrizzlies, SoundDesignForYou, SoundsForHim, szegvari, The_Chemical_Workshop, TheFilmLook, ThefitzyG, tortillathrilla, Vikra9409, Vinni_R, Vrymaa and wilhellboy, all CC0 (free to use). Thank you! Each file and its source is listed in `assets/sounds/surfaces/freesound/License.txt`.

## 1.5.1 (2026-10-21)

- **Surface sounds in every system.** D&D 5e, Daggerheart and Starfinder 2e weapon animations now sound like what they hit too, not only Pathfinder 2e's:
  - **D&D 5e:** reads the armour and shield a creature wears, its creature type (constructs, oozes, plants, elementals), and Mage Armor, Shield or Barkskin.
  - **Daggerheart:** reads the armour a character has equipped.
  - **Several targets:** with more than one D&D 5e or Daggerheart target, each gets its own hit or miss, and its own sound.
  - **One setting:** **Weapon surface sounds** in Animater's module settings turns them on or off for every system. The switch in the PF2e Weapons catalog changes the same setting.
- **A miss against a raised or magical shield now rings off it.** Before, the block sound could be dropped along with the missed hit.
- **More creatures sound right:** illusions are silent, as are more creatures made of flame or wind (Storm Lord, Living Wildfire); padded armour, clothes and aprons sound like leather; robots clang.

## 1.5.0 (2026-10-21)

- **Weapon hits sound like what they land on.** The same dagger clangs off plate, slaps leather, thuds into flesh, cracks a spider's shell, knocks on a skeleton and rings off a wizard's Shield. Every catalog weapon Strike that connects adds a second sound under its own, picked for each target:
  - **Metal:** chain, plate or any heavy armour, metal creatures, clockwork and animated armour.
  - **Leather:** leather, hide, cloth and polymer armour.
  - **Crunch:** spiders, insects and other shelled creatures, skeletons and bone constructs, plants, wooden, bone or ceramic armour, and animated furniture or dolls.
  - **Stone:** golems and earth elementals.
  - **Glass:** glass and crystal creatures.
  - **Squish:** oozes and water elementals.
  - **Ward:** magical armour such as Mystic Armor or Protection, on a target with no real armour.
  - **Flesh:** everyone else.
  - **Misses:** a miss against a raised shield clangs off it; against a magical shield (Shield, Glass Shield, Prismatic Shield…) it rings off the ward. Other misses stay silent.
  - **Silent:** ghosts and creatures made of flame or wind.
  Each hit picks one of several recordings, at a slightly different pitch and loudness, so blow after blow never sounds the same. Edged, blunt and piercing weapons each have their own set. Turn them off with **Surface sounds** in the Weapons catalog.
- **Surface sounds work without any sound pack.** Animater now bundles about a hundred short impact recordings from Kenney's [Impact Sounds](https://kenney.nl/assets/impact-sounds) and [RPG Audio](https://kenney.nl/assets/rpg-audio) packs (CC0, free to use). Thank you, Kenney! With GGG's sound collection installed, its recordings join them for more variety.
- **A defeated creature drops its other lasting animations.** A dead monster no longer stays Frightened or Blessed on screen; only its Defeated look remains, and the others return if it is revived.

## 1.4.9 (2026-10-21)

- **A weapon's damage roll no longer says it has no animation.** After a Strike that animated, rolling damage logged “no enabled damage recipe”, and Activity explained that no animation was set for the weapon. The animation belongs to the attack roll, so a damage roll for a weapon that animates on its attack now logs nothing.
- **Lasting animations no longer disappear after changing scene or floor.** Sequencer resets a scene shortly after it loads, about half a second after a scene change, and that reset also removed Animater's lasting animations without saying so. They then stayed gone until the effect was applied again. Animater now notices animations Sequencer removed and draws them again within a few seconds. It was most noticeable on maps with floors (Foundry 14 levels), such as the Secrets of Grayce maps.

## 1.4.8 (2026-10-20)

- **Persistent damage copies for different damage types no longer warn about each other.** A Fire copy said “Not playing: Persistent Damage plays instead” when a Bleed copy existed, though each already played for its own type.

## 1.4.7 (2026-10-20)

- **Customizing persistent damage now says which damage type it covers.** Customize already made a copy for the previewed type only, such as fire, but nothing said so. The button now reads **Customize Fire**, the copy is named **Persistent Damage (Fire)**, and its editor has a **Damage type** choice, so a copy made for the wrong type can be switched (for example from Bleed to Fire) and given its own Lasting animation choice. Other damage types keep the catalog version.

## 1.4.6 (2026-10-20)

- **You can hide the Animater button in the token controls** ([#9](https://github.com/roileaf/animater/issues/9)). Turn off **Show Animater scene control button** in the module settings. Each player chooses for their own screen, and Alt+Shift+A still opens Animater.

## 1.4.5 (2026-10-20)

- **The canvas no longer freezes for good after a token motion** (since 1.4.3). When two of Animater's token motions finished in the same frame, such as a spell's target shake on a dying creature, Foundry stopped drawing the canvas while the rest of the interface kept working, until a reload.

## 1.4.4 (2026-10-20)

- **Hovering and selecting tokens no longer stutters lasting animations.** Animater re-checked every token's lasting animations each time Foundry refreshed a token, which it does many times a second while you move the mouse over tokens. It now re-checks only when something they depend on changes (the token shown or hidden, redrawn, resized, new art or actor), so busy scenes stay smooth.

## 1.4.3 (2026-10-20)

- **New *Animater's token motions come first* setting** (world, on by default): while Animater moves a token (a finisher or attack, a condition's trembling or swaying, a look that rocks it), other modules' passing Sequencer motions on it don't play, such as PF2e RPG Numbers' damage shake. Turn it off to let both play.
- **A finisher no longer plays off-center** when another module was shaking the token as it started: it plays from the token's real spot, and its movement shows instead of being drawn over by the other motion.

## 1.4.2 (2026-10-20)

- **Recall Knowledge has a sound.** With GGG active, Recall Knowledge, Recall the Teachings, Recall Under Pressure and Slayer's Identification play GGG's new Recall Knowledge sound. They stay silent without GGG, since the other sound packs have no match. PF2e.

## 1.4.1 (2026-10-20)

- **Your version of a catalog action plays.** A customized copy of an action rolled as a skill check (Demoralize, Shove, Trip, Grapple, Force Open…) now plays instead of the catalog default, so removing Demoralize's battle cry sticks. Pausing your version silences the default too. PF2e and SF2e.
- **Conditions and effects set to play once stay quiet** while they last, even when the token is hidden and seen again (selecting another observer, line of sight changes) or redrawn. Removing and reapplying one plays it again. D&D 5e and Daggerheart states, and auras, now also stay quiet after a reload.
- **New *Only animate what Trigger Animations doesn't* setting** (world, listed when Trigger Animations is active): items a Trigger Animations trigger names (`attack:longsword`, `template:fireball`, `condition:frightened`, or the item's UUID) stay with it, the way Automated Animations' customized items do. Wildcard triggers such as `damage:*` don't count.
- **New *Crop to area shape* option on template stages.** Cones crop their art to the cone unless you untick it, so wide art is no longer forced inside; circles and lines crop only when you tick it, so existing recipes look the same. A lasting emanation that follows its caster is never cropped.
- **New *Show flash screen menus in the Combat Tracker* setting** (per GM): turn it off to remove the ⚡ Opening/Ending menus from the Encounter tab, its popout and PF2e HUD's tracker. Combats still play the default flash screens.
- **Cone and line art can reach past the template.** A new *Reach past the area (%)* option on template stages runs the art on beyond the area's far edge (50% is half again as long), and a cone widens with it. It works whether *Crop to area shape* is ticked or not; the checkbox only decides the edges. Ticked, the art is cropped to the outline grown by the same reach, so a cone stays a clean, longer cone; unticked, wide art can also spill out the sides. Circles don't use it: to make circle art bigger than its template, raise the stage's *Scale* with cropping off. The studio preview shows the reach but never crops; the table and Local preview do.
- *Take over from Automated Animations* is only listed when Automated Animations is active in the world.

## 1.4.0 (2026-10-19)

- **A first run that starts in the right place.** While nothing plays automatically, Animater opens on Setup, where turning the catalogs on comes first, followed by three steps that match how the module is used (turn on the catalogs, try one on the canvas, customize it). Tokenshade, FXMaster and your own recipes sit under Fine-tuning.
- **Clearer missing-module messages:** they say to turn the module on in Manage Modules and reload the world (F5), and no longer suggest opening the browser console.
- The asset browser's Sources menu opens inside the window.
- **Window messages you can read and dismiss:** errors show in red and things to do first in amber, and both stay until you close them with ✕. Confirmations fade after a few seconds.
- **See what you left out of Plug & play:** in the catalog chip, click "N left out" to list only those entries. Click it again to see everything.
- **Keyframed paths in the studio:** keyframe diamonds now sit where playback actually reaches them. A path that returns to rest shows its return as a shaded tail at the end of the clip. While you drag a keyframe dot, the curve and the token ghost follow it.
- **Asset browser:** opened from a recipe it says what you are choosing for (*Choosing for Source · stage 1*) with a *← Back to* button, and *Use for Source* names the stage it fills; colour, size and playback picks sit right under the preview, with background, zoom and speed folded into *View*; black and dark-shaded effects (shadows, darkness) preview on a light background until you pick one; Folder sources, Browse files and Refresh share one *Sources* menu; repeated variant chips show once.
- Animater's scrollbars are thin and neutral instead of Foundry's red.
- **A clearer catalog entry panel** in every catalog: one status line says whether the entry plays (automatically, your version, left out, or not at all) with the buttons that change that (Use animation, Customize, Leave out / Put back); *Preview* and *On canvas* sit in one row; its stages (in seconds), sounds, notes and source fold into one *Details* section. The panel is about half as tall.
- **Now playing, by token.** Each token is a small card (portrait, name, ■ All to stop everything on it), and its animations are one-line chips with their picture, time and stop buttons; tokens with the same name stay apart, and cards sit side by side.
- **Players know where their animations stand.** Saving a change to an approved animation asks first, since it goes back for approval; GMs online get a whisper when something new waits, and the GM's Recipes item shows how many wait.
- **Asset library:** picking art for an empty stage keeps your last search; the automatic category for the stage shows as a chip you can clear; Recent lists what you used rather than everything you clicked; typing in search no longer stalls on every key.
- **Flash screens:** *Play for everyone* asks before showing a screen on every player's screen (and warns when it has unsaved changes), and Revert asks before discarding your edits.
- **Catalogs speak one language.** Every system's catalog uses the same quality badges (Signature, Themed, Symbolic, Needs setup), each explained on hover, and the same Plug & play wording: *Leave out of Plug & play* / *Put back in Plug & play*.
- **See at a glance what plays.** A chip beside the results says whether the whole catalog is on (and how many entries are left out) or only hand-picked entries play.
- **Lasting animation is three clear choices** (stay while active, play once, play once and at turn start) side by side instead of a button that cycles, and notes when your own device setting overrides it.
- **Shorter sidebar.** Catalog pages are listed as Spells, Feats, Conditions… under a caption naming the system (LIBRARY · PF2E).
- **Settings say what they do.** *Automatic playback* is now *Play my own recipes automatically* (the catalogs have their own Plug & play), the Setup page uses the same names as Foundry's settings, and settings that cannot apply are hidden: Automated Animations takeover without that module, weapon rune flourishes outside PF2e. Teleport examples name the system's own spells.
- The welcome message and Setup list the system's real catalogs (Daggerheart: domain cards, weapons and conditions).
- D&D 5e and other catalogs show the Visibility slider's value.
- **Activity answers "why didn't it play?"** Skipped events name the item and say why in plain words (no animation set for it, nothing set to play automatically, left to Automated Animations, claimed by another module), with a button for the fix: find it in its catalog, make a recipe, or open Setup.
- **No more silent Activity page.** When nothing is set to play automatically, the page says so with a link to Setup, and each item used meanwhile is listed once a minute with the reason.
- **Activity filters and legend.** Show all, played, skipped or blocked events (with counts); hover a status to see what it means. The last 40 events stay through a page reload.
- **Players have an Activity page** for their own animations.
- **Timeline help on click.** The ? button opens a panel of what you can do on the timeline and every shortcut (it was a hover tooltip only).
- **Fields where 0 means off say so**: Off, All, When finished, Its end, instead of a bare 0.
- **The art browser opens on the right shelf**: a stage with no art yet starts on Casting, Projectiles, Impacts, Areas or Auras & loops, and a one-off clip you pick sets the stage to its own length.
- **Resizing a clip that repeats** changes the length of each play, instead of growing it by the repeats.
- **Token filter editor:** the layer move buttons say which way they move, and image layers get a Browse button for their file.
- Finishers show *Save finisher* while being edited, not *Save recipe*.
- **Start from a template.** New recipe now offers the twelve sample recipes (Ember shot, Blade strike, Fire nova…) as already-timed starting points, next to a blank recipe, and points to Customize in the catalogs for a particular spell, feat or weapon.
- **New stages play in order.** With the playhead at the start, a new flight stage follows the cast and a new target stage follows the flight (or the cast), instead of all starting at once.
- **Copy and paste stages,** even between recipes: Ctrl+C and Ctrl+V on the timeline, or Copy / Paste after it in a clip's right-click menu.
- **Motion path shapes.** A keyframed token path can start from Hop, Zigzag, Circle, Knockback or Spin, and *+ At playhead* adds a keyframe where the playhead is.
- **Sounds play in full.** Typing a sound path sets the stage to the sound's real length, as choosing one in the library already did.
- **The studio preview keeps playing while you edit.** Changing a field no longer stops playback; it picks up where it was, with your change in.
- **Loop just one clip.** The new ⟲ clip button (or Shift+L) loops the selected clip in the monitor so you can tune it while it repeats.
- **Local preview plays the variant you are editing**, as the monitor does, instead of a random one.
- **True scale in the monitor.** Its grid now draws one cell per grid square, with a 1 square key, so sizes and distances read right; keyframed token paths are framed so they no longer run off the edge, and a held motion stays where it ended.
- **Clearer scene-effect notes.** FXMaster particles say they show in previews and at the table; scene filters say they play only at the table.
- **Undo and redo in the studio.** ↶ and ↷ in the studio bar, or Ctrl+Z and Ctrl+Shift+Z (Ctrl+Y), step through your edits to the recipe; undoing back to the saved version clears Unsaved changes.
- **No more lost work.** Revert and closing the Animater window ask first when a recipe has unsaved changes.
- **Timing links survive moves.** Dragging or arrow-nudging a linked clip on the timeline keeps it linked and shifts its offset (the guide says so); hold Alt while dragging to unlink it on purpose.
- **Number fields check their range as you finish typing**, pulling a value back into range with a note instead of changing it silently on save.
- **A recipe that can never play says so.** Its card reads *Won't play* and the studio bar shows a warning that opens Recipe settings, instead of *Ready to play*.
- **A cleaner stage panel in the studio.** The right-hand panel now opens with a card for the stage (its art, a readable asset name, type and track, plus variant, duplicate and delete buttons), then the essentials in the same order for every stage: art, one *When* control that says in words what the stage follows, length, size and fades. The stage type's own settings come next (flight path, Tokenshade preset, token motion, sound volume), and everything else sits in four tabs, Look, Motion, Placement and Timing, instead of eight collapsed sections. A dot marks a tab with changed settings, and each tab can be reset. Times show in seconds and size as a percentage; saved recipes are unchanged.

## 1.3.3 (2026-10-19)

- **Lasting animation per recipe.** A customized condition or effect animation (Customize in its catalog) has its own *Lasting animation* choice in its recipe settings: stay while active, play once, or play once and at turn start (e.g. Divine Health only when its turn starts), or follow the catalog. Each player's own *Lasting condition animations* setting still applies on their screen.

## 1.3.2 (2026-10-19)

- **Choose how the default finisher ends.** A new *Default finisher ends* select under *Default finisher for other kills* overrides its ending, e.g. **Body (stays, Defeated)** so the damage-type finishers break the creature apart and then leave its token on the ground, Defeated, instead of hiding it. Finishers assigned to items keep their own ending.
- **Finishers trigger on strikes granted by feats and stances**, such as the monk's Tiger Claw from Tiger Stance. Their damage was read as the feat (Tiger Stance), so a kill finisher assigned to the strike never played.

## 1.3.1 (2026-10-18)

- **Conditions show on the creature, quietly.** Lasting conditions whose meaning is a change in the body now use a Tokenshade look instead of a looping JB2A animation: Petrified turns to stone; Drained greys from the feet up; Enfeebled shrinks thin; Fatigued and Exhaustion breathe heavily and sag; Dying darkens red with a slow heartbeat; Unconscious sleeps; Doomed and Cursebound grow dark veins under a black halo; Sickened turns green and queasy; Poisoned grows green veins; Diseased flushes with heat shimmer; Frightened and Fleeing go pale and shiver; Confused wanders among soft lights and Stupefied clouds over; Controlled glows violet; Charmed warms rosy pink; Dazzled glares, light streaking across it; Paralyzed locks rigid in a glassy shell; Restrained is chained; Concealed is wrapped in mist and Hidden hazes over; Invisible shimmers faintly; Quickened leaves a trail; Glitching jitters; persistent damage shows its damage type. Valued conditions grow stronger with their value. Applies to PF2e, SF2e, D&D 5e and Daggerheart; without Tokenshade the JB2A layers play as before.
- **Every condition has a Tokenshade look**, in every system: Blinded wears a dark veil, Deafened and Silenced are muffled, Stunned and Incapacitated see double, Grabbed and Grappled are held by a rope, Immobilized is rooted, Off-guard and Vulnerable show a red edge, Prone lies low, Slowed smears and drags, Fascinated is caught in slow golden rings, attitudes show as coloured edges (Helpful to Hostile), Bleeding runs red while Wounded shows old stains, Broken cracks, the dead lose all colour, sleepers breathe slowly, ethereal creatures turn spectral, and more.
- **New *Condition look* switch in each conditions catalog** (PF2e, SF2e, D&D 5e, Daggerheart; also a world setting): **Tokenshade** shows conditions quietly on the creature, **JB2A** plays only their JB2A animations, with no Tokenshade filters.
- **Condition looks stay at Balanced and Low quality**, since they are how the condition shows at all, and play briefly when a condition is set to play once.
- **Dazzled shows on the dazzled creature too**, not only as everyone else looking Concealed to it.
- Removed the DungeonDraft Tint preset (a map colour tint, not a token look).

## 1.3.0 (2026-10-18)

- **Tokenshade: Animater's own token effects.** Token filters are drawn by a new built-in shader engine instead of Token Magic FX, which is no longer needed. Every Token Magic preset name still works (so existing recipes play unchanged), each redrawn to look better: flames rise off the token's outline, auras lick and glow, force fields are glassy domes, and effects never bury the creature's face. Effects are local to each screen, write nothing to the world, follow token redraws and pause on hidden tokens.
- **Customize any token effect.** A token filter stage's *Customize effect* section edits every layer's settings and animations, adds, removes, reorders or turns off layers, and sets the speed. GMs can save the result as a world preset in **My presets**.
- **New looks.** Petrified, Frozen Solid, Gilded, Ironskin, Crystallized and Barkskin; Frostbitten and Snowed Over; Entangled, Netted, Chained and Bound; Levitate, elemental channels, motes, Mud-Caked, Scorched, Blood-Soaked, Submerged; ground markers and a rune circle.
- **Every damage type has its own look.** Damage flashes and knockouts burn, frost, crackle, corrode, poison veins, wither, sear with light, jolt, warp the mind, shake with sound or rend the spirit, instead of tinted glows.
- **Baileywiki presets are no longer offered.** Tokenshade's own takes replace the "[BW]" presets that Nuts and Bolts imports into Token Magic.
- **Media library:** the Tokenshade card preview plays continuously and can be zoomed (slider or mouse wheel).
- **Distinct looks for look-alike presets.** Rays shine past the art (sunburst, petals, scanning bar, falling shafts, spokes), fields and markers have their own shapes (Ally, Caution and Foe differ by shape, not only colour), the fire family drips and licks differently, and region presets no longer copy their token twins.
- **Faster effects.** Heavy shaders (fire, auras, glows, smoke) read the token's outline once per frame instead of at every pixel, so they cost about a quarter of what they did. Shaders compile in the background after the scene loads, so the first fireball no longer freezes the canvas for a couple of seconds.
- **Smoother first preview.** A spell's first local canvas preview no longer stalls for about a second.

## 1.2.14 (2026-10-18)

- **BLFX assets are found.** Assets from Boss Loot FX (BLFX) and other libraries that register with Sequencer late showed as missing in recipes until the asset library was refreshed by hand. Animater now notices new Sequencer libraries on its own.

## 1.2.13 (2026-10-17)

- **Burning shows on the token.** A lasting Burning condition (D&D 5e) and other lasting fire effects drew their flames under round tokens (dynamic token rings), so only an ember showed past the token's edge, although the studio preview showed the creature on fire. Lasting flames now burn over the token at half strength, so the creature looks on fire and its face still shows. Your own saved recipes keep their Below tokens choice.

## 1.2.12 (2026-10-17)

- **Animate only what Automated Animations doesn't.** A new world setting, shown when Automated Animations is active: with it on, anything Automated Animations animates (an item customized there, or a spell, weapon, feat, action, condition or effect its Automatic Recognition matches by name) stays with it, and Animater animates everything else. Area templates check its template menu, and conditions and effects its active effect menu, as Automated Animations does. Items turned off in Automated Animations play Animater's animation, and the Activity page says when an event was left to Automated Animations. Off by default.

## 1.2.11 (2026-10-17)

- **NPC weapon Strikes animate (PF2e).** An NPC's Light Mace, Longsword or other weapon Strike logged "no enabled attack recipe" and played nothing, because NPC attacks never reached the weapon catalog. They now play their weapon's catalog animation, by the weapon they were made from or by name. An NPC Fist punches like a PC's fist, and an NPC attack made from a homebrew weapon plays its weapon group.
- **Natural attacks animate (PF2e).** Jaws, Bite, Fangs, Beak and Mandibles bite; Claw, Talon and Rake rake; Tail, Tentacle, Horn, Slam, Hoof, Wing and Stinger strike a blow. Only these exact names match, for NPCs and for PC unarmed attacks such as an ancestry's Jaws. The animation takes the colour of the attack's damage type (a fire bite glows orange and ends in flame, a poison claw is green), and the attacks are listed on the PF2e weapons page under Natural, where they can be turned off or customized. JB2A Free plays the red bite and claws and the blue blow.

## 1.2.10 (2026-10-17)

- **Finisher fragment tints show on the table.** Frozen, charred, stone, ghostly, burning, electric, acid and poison fragments played untinted on the table, both from the studio's Play at table and on a real kill, although the studio preview showed the tint. The pieces now take their tint everywhere.

## 1.2.9 (2026-10-17)

- **Athletics maneuvers animate (PF2e, SF2e).** Shove, Trip, Grapple, Disarm, Reposition, Escape, Force Open and other actions rolled as a skill check played nothing, because skill checks were never animated. The check now plays the action's catalog animation on its target. Finishers still play once, from the check.
- **Private GM rolls animate everywhere.** Monster and NPC rolls in Private GM Roll mode now animate in D&D 5e and Daggerheart too (attacks, damage, actions), and so do PF2e and SF2e maneuver checks. As before, they play without the hidden result: no critical, hit or miss variant. A GM's private saving throw now gets a neutral "braces" reaction instead of nothing. Blind rolls and players' own private rolls stay hidden.
- **Activity explains hidden rolls.** A blind roll, or a player's private roll, that Animater leaves alone now shows as a Skipped row in Activity with the reason, instead of disappearing without a trace.
- **Targets dodge missed attacks.** On a miss the target now sidesteps as the attack arrives (as a shot reaches it, or as the swing comes in), instead of only the attacker moving. A missed melee weapon still swings through the air. Every player sees the target dodge to the same side.
- **Melee swings come from the attacker.** A sword, axe or fist swing played at the target, always facing the same way wherever the attacker stood. It now stretches from the attacker to the target, reaching exactly that far, and is mirrored when it swings leftward so the blade stays on top.
- **Weapon runes show on Strikes (PF2e, SF2e).** A catalog weapon Strike now wears the attacking weapon's runes. Potency (+1 to +3) adds a glint that brightens per tier, striking makes the hit land bigger per tier, and every property rune adds its own accent on a hit. All 89 PF2e and SF2e property runes are covered, for example flaming fire, frost ice, shock lightning, corrosive acid, thundering sound, holy and unholy radiance, ghost touch mist, keen glint, vorpal slash, bloodthirsty bats, rooting vines, anchoring chains and speed wind. Greater, major and true runes play larger. Accents only play on a hit, and your saved recipes are never changed. Turn it off with the new **Weapon rune flourishes** setting.
- **Staff, wand and scroll spells animate (PF2e, SF2e).** A spell cast from a staff prepared by PF2e Dailies, a wand, a scroll or another consumable is not an item on the character, so its attack and damage rolls found no spell and played nothing. Animater now finds the spell in the staff or item it was cast from, or recognizes it from the roll itself, and plays its animation as usual.

## 1.2.8 (2026-10-17)

- **Private GM rolls animate (PF2e, SF2e).** Monster and NPC attacks and spells rolled in Private GM Roll mode, or made private by the world, played nothing, so most enemy actions never animated. They now play for everyone, without giving away the hidden result: no critical, hit or miss variant, just the attack itself. Blind rolls and players' own private rolls stay hidden.
- **Attack spells animate on their attack roll (PF2e).** A spell with the attack trait whose animation was set to play when cast (legacy Ray of Enfeeblement, matched to the remaster's Enfeeble) never played on its attack. It now plays once, on the attack roll.

## 1.2.7 (2026-10-17)

- **Ranged Elemental Blasts are no longer cut off (PF2e).** Every element flew for the same 1.3 seconds and landed at the same moment, so wood's stream of leaves stopped just as it reached the target, a boulder landed half a second after its impact, and ice, lightning and water were trimmed. Each element now flies for its own clip's length and lands when its projectile arrives. The flight plays once, so at short range (where the clip is shorter) it no longer starts over after the target is hit.

## 1.2.6 (2026-10-17)

- **Melee and ranged Elemental Blasts look different (PF2e).** A melee blast now has the kineticist lunge and an elemental strike reaching the target; a ranged blast is thrown and flies as the element's own projectile (a fire bolt for fire). Both take the element rolled. The element is also read from the blast's traits.

## 1.2.5 (2026-10-17)

- **Every PF2e Strike animates.** A weapon the catalog did not know by name played nothing: the basic Fist, homebrew weapons, renamed or reskinned ones. It now plays its group's standard weapon (a homebrew sword swings like a longsword, a fist strikes like a gauntlet, an unknown bow shoots like a longbow), shown under its own name in Activity. The Weapons catalog switch and exclusions apply as before.
- **Thrown weapons thrown as ranged attacks animate (PF2e).** A javelin or dagger thrown from its ranged attack found no animation, since the catalog keeps it as a thrown weapon. Ranged and thrown now stand in for each other.
- **Elemental Blast animates, in its element (PF2e).** Its animation waited for a use that never comes: a blast is an attack roll. It now plays on the attack, coloured by the element rolled: fire, water, air, earth, metal or wood.

## 1.2.4 (2026-10-16)

- **Taller layer tracks in the flash screen editor.** A drag bar under the stage's play controls works like the one in the recipe studio: drag it up to make the stage smaller and see more layers at once, down for a bigger stage. Your choice is remembered on this device; double-click the bar to go back to a full-width stage.
- **The popped-out Combat Tracker looks right again.** Right-click → pop out put the Opening and Ending flash menus in the window's title bar, over its menu and close buttons. They now sit in the tracker's own header, as in the sidebar.
- **Flash screen sounds show their real length and can be trimmed.** A Sound layer's bar was drawn to the end of the screen whatever the file. It is now as long as the sound file (read when you pick it), and its end has a grip: drag it to cut the sound shorter, back to the file's end to play it whole. A trimmed sound stops there with a short fade, in the preview and at the table.
- **Flash screen tracks look like the recipe timeline.** Each layer is a full-height bar showing its name and time span, with visible grips at its ends for trimming, a faint gridline every half second, and a ruler labelled every half second. Moving, trimming, entrances and exits and keyframes work as before.

## 1.2.3 (2026-10-16)

- **Invisible looks right on the token again (PF2e)** ([#3](https://github.com/roi007leaf/animater/issues/3)). Its ripple is a refraction clip, which only reads as a ripple under the token; Animater drew it on top, so a pale square covered the creature. Refraction layers now always stay under the token, as in the local preview.
- **The Folder sources panel is no longer cut off** (#3). In a narrower window it opened leftwards from its button, under Foundry's sidebar. It now opens rightwards and stays inside the library.

## 1.2.2 (2026-10-16)

- **Choose how lasting conditions show on your screen.** New setting *Lasting condition animations (this device)* in Configure Settings → Animater, for every system. *Follow the catalog setting* (the default) uses each catalog's Lasting animation switch in Animater; *Always visible* keeps them on; *On application only* plays each once when applied; *On application and at its turn start* also replays a creature's conditions briefly whenever its turn starts in combat, one after another so they read separately. The creature's own motion (trembling, swaying) follows the same choice. Reloading or changing scenes never replays them. The Defeated look keeps its own setting, and each player's choice affects only their screen.
- **Catalogs can replay conditions at turn start too.** The Lasting animation switch on the Conditions and Effects catalog pages (every system) now has a third choice, *Play once and at turn start*, after *Stay while active* and *Play once, then fade*. Players who follow the catalog setting see it on their screen.

## 1.2.1 (2026-10-16)

- **Daggerheart animations fit their targets.** Checked on the canvas, frame by frame:
  - **Weapon swings reach the target.** Sword, axe, hammer and spear clips stretch from the wielder to the target as JB2A draws them, instead of sitting small on the target's edge.
  - **Natural attacks look natural.** An adversary's "Claws" or "Bite and Claws" rakes red claw marks across the target, a "Bite" bites, a "Tail Swipe" or fists strike unarmed; other unknown melee attacks slash. Each sounds like itself.
  - **Hits match the blow.** Blades, arrows and bullets land a crisp white star, hammers and shields a warm burst; the fiery flash is gone from physical hits. A gun's muzzle flash faces the target.
  - **A fire burst rings the adversary** in flame under its token, instead of a fireball that hid the creature.
  - **No more specks.** Card, heal, Hope, Fear and effect layers on a token are at least token-sized, and card designs that swing a weapon or strike unarmed reach from the caster to the target.
- **Daggerheart animations have sound.** Weapons, domain cards, feature attacks, abilities and the Death move now play matching sounds when GGG, PSFX or Sound FX Library is active: a blade strike for a Longsword, a bowstring for a Longbow, claws for an adversary's bite, a gust for Whirlwind, a heal for a potion. Weapons sound like their family, cards like what their name describes (fire, frost, healing, a teleport…) or else their domain. The catalog pages' Sounds switch and volume slider apply.
- **Daggerheart strikes move the token.** As in PF2e, a melee wielder lunges into the swing, a bow draws, a gun kicks, a thrower winds back, and a struck target shakes. Feature attacks rear back, burst or slam, and abilities rise or pulse. The Token motion switch turns it off.
- **Richer Daggerheart conditions.** Vulnerable makes the creature wobble off balance, Hidden adds a faint veil to its smoke, and the Death move tolls with a sound.
- **Daggerheart heals, Hope, Fear and effects animate.** Actions that only heal, gain Hope or Fear, or apply an effect played nothing: a Minor Health Potion, Hardy, No Mercy, Retract, an adversary's Relentless or Momentum. They now glow on the user, and on each target when there is one: green for healing, gold for Hope, purple for Fear, a soft boon for other effects. Domain cards and weapons keep their own animations. The four looks sit with the fallbacks on the Weapons page, governed by its switch.
- **No more Skipped rows for feature and potion damage (Daggerheart).** A damage card from a feature, potion or other non-weapon item added a Skipped row to Activity although its use had already played.

## 1.2.0 (2026-10-16)

- **PF2e and SF2e can use each other's catalogs.** New world setting *Also use the SF2e catalogs* (in a PF2e world) or *Also use the PF2e catalogs* (in an SF2e world), off by default. With it on, an item that none of the world's recipes or catalogs know plays the other system's catalog animation: Starfinder Anachronism guns and tech in a PF2e game, Pathfinder magic in an SF2e game. Covers spells, feats, actions, features and weapons; conditions and effects are not borrowed. Items the world already covers keep their own animation, and an entry you excluded stays silent.
  - **Borrowed catalogs have their own pages.** A PF2e world gets a *Borrowed from SF2e* section in Animater's sidebar, an SF2e world a *Borrowed from PF2e* section, each with the other system's spell, feat, action, feature and weapon catalogs: turn them on, exclude or customize entries as in that system's own world. Turning the setting on starts each untouched borrowed catalog like the matching one of the world (on for every entry, same motion and sound).
- **Daggerheart adversary features animate.** An adversary's feature attacks played nothing (a Young Ice Dragon's Blizzard Breath, Avalanche, Rend and Crush). A feature that rolls to attack (Tail Swipe, Dive-Bomb, Leaping Strike) now plays the melee or ranged weapon fallback by its range. One that calls for a reaction roll or deals damage without an attack roll plays its element's look: a breath fills a cone or line toward the targets, an area attack bursts around the adversary, the rest strike the targets. The element comes from the feature's own words (ice and frost are cold, then fire, lightning, acid, poison) or its damage type. These are new *Any feature attack* entries on the Daggerheart weapons page, so they follow that catalog being on or off, exclusions, and your own recipes by the feature's name. Spotlight and Fear-gain features stay quiet.
- **Daggerheart adversaries' Close-range bites and claws strike in melee.** An adversary's standard attack at Close range named for a natural weapon or reach weapon (Bite and Claws, Tail Swipe, Tentacles, Great Scythe) now plays the melee fallback instead of an arrow. Thrown, shot or blasted attacks stay ranged.

## 1.1.6 (2026-10-16)

- **Faster page switching in the workspace** ([#3](https://github.com/roi007leaf/animater/issues/3)). Each switch re-read the sound catalog several times and, on Recipes, copied every recipe and re-checked conflicts once per card. Those are now read once per switch: the Recipes page switches about 10× faster and the catalog pages (Spells, Feats, Weapons…) 2-4× faster.
- **Assets opens faster the first time** (#3). Media details are worked out once instead of on every pass over the library.

## 1.1.5 (2026-10-16)

- **Folder sources work while the library is indexing** ([#3](https://github.com/roi007leaf/animater/issues/3)). Add folder and Remove were greyed out until the whole library finished scanning, which could take a while, and removing a folder started a full rescan that greyed them out again. They now always work: a folder added or removed mid-scan is indexed once that scan ends. The source name you type is no longer wiped while indexing, and the panel stays open.
- **Folder sources with spaces or accents in their path are indexed, subfolders included** (#3). Foundry reports file paths URL-encoded (`My%20Sounds/...`), so they never matched the folder you picked and nothing was found.
- **Sounds are no longer re-indexed every time you open the world** (#3). The media index is saved in your browser and reused until your modules, Sequencer's database or your folder sources change. Refresh still rescans.
- **Local preview always gives the window back** (#3). The window is tucked away during a preview; if the preview never finished it stayed minimized. It now comes back when the preview ends, when you press Stop, or after 30 seconds at most.
- **The window fits smaller screens** (#3). Its minimum width no longer pushes it under Foundry's sidebar, the studio inspector is never wider than the window leaves room for (a width saved in a bigger window is kept for later), and the folder sources panel fits the window.

## 1.1.4 (2026-10-16)

- **SF2e lasting animations: "Play once, then fade" saves again.** Switching an SF2e condition or effect to play once and fade did nothing, because the setting was dropped when the catalog saved. ([#4](https://github.com/roi007leaf/animater/issues/4))

## 1.1.3 (2026-10-16)

- **Finishers are always on.** The Module Settings → Finishers switch is gone: finishers are part of Animater, so a finisher you assign plays without turning anything on. To keep one from playing, disable it or remove its Applies-to items.

## 1.1.2 (2026-10-16)

- **Combat start and end cards have an On switch** in the Flash screens library, like the other combat moments, instead of a "Set default" badge that showed only on hover. On is the world default. Several openings can be on: at Begin Combat the GM gets the same window as for Combat initiated, with each one playing, and clicks the one everyone sees (or None). A screen picked for that combat in the Combat Tracker still plays without asking.
- **Combat initiated flash screen:** a new moment that plays once when an encounter gets its combatants, before Begin Combat, so it can say "Roll for Initiative!" while the opening (Combat start) waits for the GM to begin. Set a screen's "Plays at" to Combat initiated and switch it on in the library's own Combat initiated section. Several can be on (say "Roll for Initiative!" and "Ambush!"): as combatants are added, the GM gets a window with each one playing and clicks the one everyone sees (or None). Off by default. It replaces the "On add" switch: the Combat start screen now always plays on Begin Combat.
- **Finishers on players' weapons play again.** A finisher the GM linked to a player character's weapon (Applies to) never played unless a player had picked it in Combater, and such an item played no default finisher either. Now only an actual pick replaces the GM's finishers for that item; with no pick, Applies-to and the default finisher play as they do for NPCs.
- **Available to shows only with pf2e-combater.** It decides which players may pick a finisher in Combater's item sheet, so without Combater the setting and the cards' Players pill are hidden.
- **Flash screens page scrolls with the mouse wheel again.** Each group of screens was its own scroll box, so the wheel stopped over the cards instead of moving the page.

## 1.1.1 (2026-10-16)

- **No more stall on load with JB2A Patreon.** Animater read Sequencer's database one key at a time, and each lookup scanned the whole database, so with Patreon's thousands of animations Foundry froze for 1-3 seconds after loading (twice: on ready and when Sequencer finished). It now indexes the database in one pass, about 20 times faster, with the same results.

## 1.1.0 (2026-10-15)

- **Daggerheart** (system 2.10.12): actions, attack and spellcast rolls (with a hit, miss or critical per target), damage and kills animate automatically. Damage written onto an attack card plays once; private rolls stay quiet; a message whose item cannot be found shows a Skipped row in Activity.
- **Daggerheart library:** domain cards (all ten domains, filter chips, levels 1-10), weapons (by family and range, with melee and ranged fallbacks for homebrew and adversary attacks) and conditions (Vulnerable, Hidden, Restrained as lasting layers; Death move as a moment; Defeated, Unconscious and Dead follow the Defeated look, as one lasting layer per creature). Built by `tools/build-daggerheart.mjs` from the installed system.
- **Every domain card has its own animation:** all 210 cards are designed from what their text does: bolts, wards, summons, teleports, illusions, heals, curses and more. They stay in each domain's colours, with exceptions where a card calls for them (Cinder Grasp burns, Earthquake is earth). Cards with several separate effects play one per action, so each spell in a Codex Book (Fireball, Mystic Tether, Telepathy...) has its own look. Everything plays in JB2A Free and Patreon.
- **Daggerheart library pages** are named Domain cards, Weapons and Conditions; the domain chips replace the duplicate Domain dropdown.
- **Activity:** lasting conditions (Daggerheart Vulnerable, Hidden, Restrained and the defeated set) no longer add a misleading Skipped row; their layer is listed as Persistent.
- **Recipe preview:** the "Play every stage together" hint sits under the composition label instead of over the token names.
- **Hope/Fear accent** (world setting, on by default): a duality roll with Hope adds a short gold glint on the roller, one with Fear a dark purple wisp.
- **Finishers in Daggerheart:** kills land when an adversary marks its last hit point (a companion its last stress); adversaries and creatures no player owns count as NPCs. "By damage type" picks by weapon family for physical damage and by domain for magical damage. A use or critical finisher plays only on the targets that roll struck.
- **Kills in every system** now go through one per-system HP helper; PF2e, SF2e and D&D 5e behave as before.

## 1.0.3 (2026-10-15)

- **Finishers:** the mover's impacts and auras that start once its travel has landed (blood linked to the travel's end, or timed after it) now play on the landing square, with the fragments, in test plays and at the table. They used to burst where the token stood, so linked fragments seemed to vanish: they were bursting several squares away, at the real landing.
- **Damage-type finishers:** new fragment cuts **Perforate**, **Slashes**, **Crush** and **Lightning**; new behaviours **Crushed flat**, **Shudder apart**, **Glitch out** and **Sink and fade**; new tints **Burning**, **Electric**, **Acid** and **Poison**; and 14 presets, one per damage type (Perforated, Carved, Pulverized, Bled out, Cinders, Frostbitten, Thunderstruck, Dissolved, Sound shatter, Blown apart, Consumed, Smitten, Unraveled, Withered). The Default finisher for NPC kills can now be **By damage type**: it plays the preset matching the killing blow's damage type.
- **Catalog cast stages play their whole clip:** built-in spell, feat and other catalog recipes now skip the blank lead-in of JB2A cast clips (cast rings, fire/ice/earth casts, magic circles; up to about 1 s of nothing) and last until the clip's last visible frame (capped at 1.8 s) instead of cutting off around half a second, so the full gather shows at the table and in previews. Stages linked to the cast's end follow it. Saved and edited recipes keep their own timing.
- **Defeated look** (world setting): how a Defeated token is drawn, from the combat tracker, the system or a finisher body ending. **Foundry default** keeps the skull over the whole token; **Small icon** makes it a normal status icon; **Animater effect** adds faint grey skull smoke and a greyed body while it stays Defeated (listed in Activity's Now playing, where Stop ends it until the next defeat). Applies from then on; existing Defeated effects keep their look.
- **Local preview and table plays:** a recipe's opening Sequencer effects at a token (impacts, slashes, splashes) no longer vanish when that token breaks into fragments (or fully fades). The token's art is now kept at a tiny, invisible alpha instead of 0, so modules that hide every Sequencer effect at a token whose art reads as hidden (PF2e Visioner) keep drawing them.
- **Token fragments:** new behaviour **Crumble to a heap**: pieces fall straight down, the top of the token first, with a little jitter and roll, and pile up in a low heap at its feet before fading. New finisher preset **Turn to dust** (Pieces): turned to grey stone, crumbles into a heap of dust, then a last puff.
- **Finishers page:** the card and preset glyphs are drawn still and only animate while their card or tile is hovered or focused (never with reduced motion), so the page no longer runs ~300 looping SVG animations at once. The page HTML is about half the size, and the preset tiles are built once.
- **Finishers:** synthetic PF2e strikes (Fist, the basic unarmed attack, rule-element strikes such as Jaws) can have a player finisher pick. `api.finishers.choices/getChoice/setChoice` also take a strike `{ actor, name, slug }`; its pick (and a synthetic strike item's) is kept on the actor (`flags.animater.strikeFinishers`), and crits and kills with the strike play it. A player's strike with no pick still plays no finisher. Dragging a strike from a PF2e sheet's Attacks onto a finisher's Applies to adds its name.
- **Finishers:** fragments stay where the token was when they burst, even when a held travel lands under them and is written; a Wall slam that only reaches the scene edge (no wall) now shrinks to fit and lands instead of crashing into the edge.

## 1.0.2 (2026-10-15)

- **Activity page:** each Now playing row now shows a small preview of its main animation (it plays when you hover the row), the token it is on, and the effect name under the title.

## 1.0.1 (2026-10-15)

After updating, restart Foundry and hard-reload the browser (Ctrl+Shift+R) so the new version loads.

- **Activity page:** a new **Now playing** list shows the lasting animations on the table right now (who they are on, how long they have run). **Stop ■** ends one of them: a lasting condition or effect animation stays off until the condition is applied again (a GM stops it for everyone; a player only on their own screen). GMs also get **Exclude ⊘** there and on automatic History rows: it leaves a built-in entry out of its catalog, or disables and saves your recipe. **Undo** puts it back.
- New starter flash screen **Crossed Swords** (Combat start): two blades sweep in and clash, sparks fly, and "TO ARMS!" slams in over the scene name. Find it under + New flash screen.
- **Flash screens gallery:** each Combat start and Combat end card now has a Default switch. Click it to make that screen the default for its event, or click the current default to turn it off. "Set default" shows on hover.
- **Studio tracks:** a finisher's timeline now leads with Token motion, Target, Sound and Filters & scene. Source and Flight sit behind a "+ More tracks" row at the bottom (they show on their own when they hold stages). Normal recipes keep all six tracks. The "Caster" track, token and subject labels now read "Source" everywhere; saved data is unchanged.
- The sidebar footer shows Animater's real version instead of a fixed "v0.2".

## 1.0.0 (2026-10-15)

**Finishers**: finishing moves that play on the real token, then fling, cut, shatter or dissolve it.

- **Finishers page:** a sidebar page with animated cards, quick Edit and Duplicate, and presets grouped as Flung, In place and Pieces. Pick a default finisher for NPC kills. Turn finishers on under Module Settings → Finishers.
- **Design them in the studio, or start from a preset:** Launch, Wall slam, Sky launch, Ragdoll tumble, Slice in half, Bisect, Shatter into shards, Disintegrate, Vortex spiral, Pancake, Diced, Claw shred, Soul drain, Frozen shatter, Ember ascent, Pixel delete and more.
- **Applies to:** attach spells, feats, actions and weapons by dropping them onto the finisher, or with the Finisher dropdown on catalog entries.
- **Plays on:** a killing blow, every successful use, a critical hit, or a critical hit or killing blow. Crits count per target. In PF2e and SF2e, a critically failed save against a spell counts as the caster's crit.
- **The real token moves:** it lands where its travel ends, stopping at walls, then vanishes, stays as a Defeated body, or stays. Moves made on a player's side are written by the active GM. To undo, unhide the token and remove Defeated.
- **Knockback:** shoves the target that many squares before the rest of the finisher plays. **Wall slam** seeks the nearest wall within reach, never back toward the attacker, and crashes into it with squash and dust.
- **Players' finishers:** the GM gives finishers to players with Available to. Each player picks one per item, in pf2e-combater or through `api.finishers`. A player-owned item plays only its owner's pick, and "None" turns it off. NPC items keep the GM's Applies-to matching.
- **🎓 Show me:** two guided tours on the Finishers page, "A flying finisher" and "A shattering finisher". They build a practice finisher, which is never saved.

**New token motions** (in every recipe, not just finishers)

- **Keyframed path:** draw the token's movement as keyframes on the timeline and a draggable grid canvas: position, rotation, size, opacity, stretch, path easing, and Make smooth.
- **Token fragments:** the token's own artwork splits apart. There are 11 cuts: halves, top/bottom, shards, dust, cross cut, claw marks, diced, starburst, rings, pixelate and ribbons. There are 6 behaviours: burst, implode, drawn to the attacker, rise, fall and bounce, and melt down. Four tints are available: frozen, charred, stone and ghostly. Every client draws the same pieces, and the studio preview shows them too.

**Workspace**

- The sidebar is grouped into Create, Library and Tools, left-aligned, with counts.
- `api.play`, which Trigger Engine also uses, and the studio's test play now play finisher recipes composed: aimed, cut at walls, landing pinned. They still write nothing to the token.
- The Flash screens Show me tour now uses a shared tour engine. It behaves the same, and Esc no longer closes the window mid-tour.
- **Flash screens, Opening on add:** a switch (Flash screens editor, and the tracker's flash bar defaults) plays a combat's opening flash as soon as combatants are added, instead of waiting for Begin Combat. Turning it on picks a default opening if none is set, and a combat only counts as opened once a screen actually plays.

## 0.3.17 (2026-10-13)

- **Rings frame every token, on top.** Hollow rings (marker rings such as Courageous Anthem's notes, attitude and curse rims, glyph and fire rings) were drawn under the token. A ring sits just outside the token's edge, so round art whose frame reaches the edge (Tokenizer portraits) hid almost all of it, not only square art. Hollow rings are now drawn on top of every token: they frame the creature without covering its face. Webs, smoke and sparkles still go under round and dynamic-ring tokens, and on top of square art at half strength. Also fixes 0.3.16 dimming those rings on square art, where they were wrongly treated as filling footage.

## 0.3.16 (2026-10-13)

- **Square token art shows its animations.** Some lasting animations are drawn under the token on purpose (attitude and curse rims, marker rings, and since 0.3.11 webs, smoke and sparkles), which works for round or dynamic-ring tokens. Square token art without a dynamic ring is opaque to its corners and hid them, leaving only a sliver at the edges. Animater now checks whether a token's art is opaque to its corners: if so, those layers are drawn on top, hollow rings as they are and filling footage (webs, smoke, sparkles) at half strength so the face stays visible. Dynamic-ring and transparent tokens are unchanged, and recipes you saved keep their own *Below tokens* choice.

## 0.3.15 (2026-10-13)

- **Animater works for players who join over plain http.** Browsers only provide `crypto.randomUUID()` on secure pages (HTTPS or localhost). A player joining a world at an address like `http://192.168.1.20:30000` or a Tailscale IP got an error while Animater loaded, so the module never started for them: no settings in Configure Settings, no wand button in the token controls, no animations on their screen. Animater now creates its IDs in a way that works on any page.

## 0.3.14 (2026-10-12)

- **Your own recipes keep their "Below tokens" setting.** 0.3.11 started drawing token-sized webs, smoke, sparkles and shield domes under the token so built-in designs stop burying it, but the rule also overrode recipes you made yourself: a custom Shield effect with *Below tokens* unticked still appeared under the token. The rule now applies only to Animater's built-in designs; a saved recipe is drawn exactly as you set it.

## 0.3.13 (2026-10-11)

- **Preview and browse teleport effects.** Departure and arrival artwork now use animated preview cards and the same Assets browser as stages. Pick each cue independently, preview variants or browse your own files, then return to Recipe settings. Each cue also has buttons to restore blue mist or disable its extra effect.

- **Acid and poison no longer flood the token.** The catalog's acid and poison body filters used Token Magic's fumes and smoke presets, which lay a coloured fog over the whole token art and have no transparency setting, so even Strength 0.1 left the face buried. They now glow green on the body's outline instead. The Strength hint says which filters have nothing to fade (outlines, smoke and fumes overlays, distortions).
- **No more "could not find document" errors.** When a token was deleted (a defeated creature removed) or the scene changed while a lasting animation was being drawn, Sequencer showed a red error for each layer. Animater now skips a token that is gone and only ties animations to documents that still exist.

## 0.3.12 (2026-10-11)

- **Recipe search stays visible.** The recipe library's search bar remains at the top while scrolling through cards, so a search can be started without scrolling back up.

- **Custom teleport effects.** Recipe settings now offer teleport looks, separate departure and arrival artwork, size and optional tint. The extra puffs can be disabled while keeping the token move. Existing recipes retain blue mist.

- **One animation for all melee or all ranged strikes.** Attack and damage recipes can bind to every melee strike or every ranged strike without listing names, including NPC attacks and melee unarmed strikes. Both override built-in weapon animations while preserving specific saved exceptions and separate thrown and spell attacks.

## 0.3.11 (2026-10-11)

- **Lasting effects no longer bury the token.** An audit of every lasting condition and effect in PF2e, SF2e and D&D 5e measured how much of the token's face each layer drawn over it covers: 275 covered half or more (nets and vines up to 90%, fumes, fog, sleep clouds and darkness, sparkles, lightning orbs, flames, and D&D's shield dome on 135 immunity and resistance effects). Footage that fills its frame (web, vines, smoke, fog, sparkles, flames, orbs, shield domes, marker rings) is now drawn under the token when it is token-sized: a net binds round the feet, smoke is ground haze, a dome is a halo round the edges. Small, deliberate placements such as Blinded's blindfold stay on top. After the change, 5 layers cover half the face, down from 275.

- **Marks no longer cover the token.** Lasting effects drawn with JB2A's Hunter's Mark art (bold opaque icons: an eye, a paw, a glyph) held it at 1.4 times the token over the art for as long as the effect lasted, hiding the creature. SF2e's *Get 'Em!* stamped a large glyph over every ally. About 280 such effects (PF2e, SF2e, D&D 5e), the Hostile attitude and D&D's psychic, quarry and defenses marks now show the mark as a small badge in the token's top corner, inside its own square. One-time cast and hit flashes keep their full-size mark.

## 0.3.10 (2026-10-11)

- **Strength for Token Magic FX stages.** Token Magic presets have no shared opacity, so a filter stage now has a *Strength* setting (0.1 to 1). It scales every visibility setting the preset's filters have (alpha, glow strength, aura intensity, fog density, bevel light and shade, image overlays), animated values too, in the studio preview and at the table. Outlines and distortions (blur, ripples, twist) have no such setting and stay at full strength.

## 0.3.9 (2026-10-11)

- **No empty "Asset & visibility" section.** Token Magic FX, scene FX, motion and sound stages have no asset keys, opacity or below-token setting, so the studio no longer shows that section for them (it opened to nothing).

## 0.3.8 (2026-10-11)

- **Conditions and effects can play once and fade away.** The Conditions and Effects tabs of every system's catalog (PF2e, SF2e, D&D 5e) each have a new *Lasting animation* switch. *Stay while active* (the default) keeps the animation on the token until the condition or effect ends, as before. *Play once, then fade* shows it when it is applied, for a few seconds, then fades it out; reloading or changing scenes never replays it for one that was already there.
- **No more skulls on Bless.** The radiating rings under many auras come in five motifs (hearts, screaming spirits, digital blocks, flame-like tendrils and clean ripples), and auras were picking them by number. Bless, Benediction, Angelic Halo, Righteous Call and the marshal and banner auras showed screaming skulls or hearts. Every aura now picks its ring by meaning: clean ripples for holy, protective and leadership auras, tendrils for wrath, flame and raw power, spirits only for despair, grief, dread and possession, and hearts only for Mantle of the Unwavering Heart.

## 0.3.7 (2026-10-10)

- **Asset variants are chips, like colors.** In the media library, the long "Style / version" dropdown is replaced by a row of chips for each part of the asset that varies: Style, Version, School, Playback (intro, loop, outro, complete), Shade. Each row offers only what exists under the choices above it, and picking a chip keeps the rest of your pick where it can (switching school keeps a loop a loop).
- **PF2e 8.6.0 content is animated.** The PF2e catalogs are now built from the PF2e 8.6.0 release (they were built from 8.5.1).
  - **New spells:** 19 spells get animations, among them Turnip Lantern, Brimstone Rain, Searing Rain, Silver Spear, Spray of Salt, Piercing Jet, Gloom Mantle and The Night is Mine.
  - **New feats:** 31 feats from the infernal pactbreaker, bugbear, fetchling and strix lines get animations.
  - **New auras:** *Aura: Turnip Lantern* is a soft golden glow rimming its 20-foot bright light, with small orange lights drifting and flickering inside it, and allies who get *Spell Effect: Turnip Lantern* share that look. *Effect: Horn of Rust* is a ring of rusty metal shards orbiting the bearer, with falling rust flakes.
  - **Updated content:** new 8.6.0 effects, weapons and equipment are in the catalogs too. Final Form and the legacy Divine Vessel, both removed in 8.6.0, are gone.
- **Shield is centred.** The force dome of Shield (and the glass, bone, fire, ice and earthen ward spells that share its design) sat a quarter square off to the side; it now surrounds the caster.
- **One-time animations can't get stuck.** A cast circle or other one-time animation still on screen 5 seconds after it should have ended is now ended on every screen (a player saw spell casting circles left over tokens during a combat).
- **Dazzled shows how the token sees others (PF2e, SF2e).** Select a Dazzled token and every other token shows the Concealed look on your screen. The Dazzled token keeps its own motion but no longer wears an overlay. Works with PF2e Visioner too.
- **Markers no longer float over heads.** Effects drawn with a JB2A marker (hearts, shields, runes, drops and so on, about 840 effects, Shield among them) are now a ring of icons under the token, wide enough that the icons orbit just outside its art, instead of hovering above the head into the next square.
- **Allies inside an aura see its effect clearly.** An ally's copy is no longer squeezed to token size unless it is the aura's own ring, so effects like Angelic Halo's marker are no longer hidden behind the token art. When an aura's telling layer is only glints or motes, the ally also gets the aura's ring in its colour.
- **Conditions never blink out.**
  - Blinded, Fascinated, Clumsy, Fatigued, Unconscious, Prone and Encumbered used clips that fade in and out once; they now loop only the steady part of the clip.
  - Invisible is a steady refractive shimmer instead of a one-time burst.
- **Enfeebled** is dim crimson motes drawn out of the body into a slowly draining ring at the feet, while the token sags.
- **Fuming Cloak** is thick black smoke filling its 15-foot aura, drawn under the tokens, as the item describes. It no longer looks like a demonic energy aura.
- **Auras show their size and keep looping.**
  - Every aura now has a layer that fills its whole radius, and the build checks this.
  - Layers that played once and vanished (sparkles, the second energy field, radar pings) are replaced with continuous loops.
  - The tall flame clip that rose above the token is now a fire ring.
  - Elysian Dew is an outward ring of growth with green motes; Form a Flock, Protector's Sphere, Blazing Banner, Mantle of the Unwavering Heart and Stink Sap get a reach layer too.
- **No more smoke over tokens.**
  - **Auras:** aura effects no longer use smoke, fume or fog footage, which buried the tokens inside them. Their hazes are coloured drifting motes; Creeping Ashes, Ghosts in the Storm and Miasma get rings, ash motes and storm currents instead. Fuming Cloak, which is literally smoke, is the one exception (see above).
  - **Hidden, Undetected and Unnoticed** show only their rim, not a fog veil over the token.
  - **Concealed** is a faint refractive ring.
  - **Effects:** poison, acid, fog, invisible and fiend effects pick sigils, bubbles, shimmer rings or energy strands instead of smoke. D&D 5e Invisible uses the same shimmer instead of a skull mask.
- **Allies inside an aura get their own, smaller look.** In PF2e, an aura such as Protective Wards, Marshal's Aura or Righteous Call gives an effect to every ally inside it. Animater drew that effect with the full aura ring on each ally, so a group filled the map with overlapping circles. Now the aura's owner keeps the ring. Allies who only receive it show the aura's most telling layer (its glyph, motes, flame or bubbles, rather than the generic ring every aura shares) at token size, so different auras stay recognisable.
- **Aquatic Combat is a few bubbles (PF2e).** Every creature fighting in water carries *Effect: Aquatic Combat*, and it showed as a large red curse sigil under each of them. It now shows a few small rising bubbles on the token, as SF2e already did.
- **Taking over Automated Animations covers conditions and effects.** With *Take over Automated Animations* on, both modules still animated the same condition or effect (Frightened, Grabbed, Bless…), because the takeover only checked Animater's recipes and conditions are its lasting animations. Now Automated Animations also stands down for every condition or effect Animater shows itself: its catalog is on, or you made your own version. Conditions Animater doesn't animate, such as a paused catalog or excluded entries, still play in Automated Animations.

## 0.3.6 (2026-10-09)

- **The Activity page updates live.** While it's open, new playback entries appear within a second, with no need to switch pages. It now also says that it lists what *this* browser played: each player's own casts appear on their own Activity page.
- **Lasting areas loop their whole clip.** Animater gave every lasting layer its short stage length, so Sequencer looped only that part of the clip and jumped back. For example, Darkness looped 2.3 seconds of its 5-second clip, which looked like it kept re-forming. Lasting areas and auras now loop the full footage, which JB2A makes seamless. This replaces 0.3.5's middle-only Darkness loop.

## 0.3.5 (2026-10-09)

### New
- **Turn every catalog on in one click.** Animater's Setup page has an *Every catalog* card. One button turns on every built-in catalog for your system (spells, feats, actions, features, weapons, items, conditions, effects) and Automatic playback. Exclusions and your own versions stay.
- **First-run welcome.** On a world's first load, the GM is asked once whether to turn every catalog on. Saying yes posts a short whispered chat note. Worlds that already have a catalog on are never asked.
- **Teleport tokens setting.** A world setting (*Configure Settings → Animater → Teleport tokens*, on by default) turns Animater's teleporting off. Use it at tables where another module already moves tokens for teleport spells, such as D&D premade-spell modules. When it's off, those spells only play their animation.

### Fixed
- **Sustained area spells stay on the map (PF2e, SF2e).** A lasting spell placed as an area kept its animation only if its name sounded like a standing area (wall, cloud, fog, darkness…), so *Pernicious Poltergeist* and similar played once and vanished.
  - Now a sustained area spell stays until its template is removed.
  - So does any area whose description says it keeps acting (on whoever enters it or starts a turn in it).
  - Spells that only affect creatures when cast (Calm, Fear, Slow) still play once.
- **Darkness loops smoothly.** Its footage grows in from nothing and dissolves away, so looping it made the darkness vanish and re-form every 5 seconds. A lasting Darkness now loops only its solid middle.
- **PSFX Patreon sounds are used.** Animater only recognised free PSFX (`psfx`), so tables with only PSFX Patreon (`psfx-patreon`) got no PSFX sounds in the catalogs. Both now count.
- **No more PSFX install prompt when you have PSFX Patreon.** Foundry checks recommended modules by id, so it offered free PSFX even with the Patreon version installed. Installing both loads the same sounds twice and fills the console with Sequencer errors on world load. Animater no longer recommends PSFX in its manifest; it uses whichever PSFX you have.
  - If you already ended up with both, disable one of them (keep the Patreon version).

## 0.3.4 (2026-10-09)

- **No more fog clouds around bound creatures.** JB2A's first chain animations pull the chains out of dark smoke portals, which looked like grey fog clouds around the token. *Grabbed*, *Immobilized*, Animate Rope and D&D's shackles, ropes, traps and held creatures now use the clean chain rings.
  - **Each its own chain:** Grabbed has spiked chains and Immobilized square chains (JB2A Free shows the plain ring for both). Restrained keeps its plain ring with a web.
  - **Webs:** PF2e *Clinging web* and *Spider silk* use a token-sized web instead of the Web spell's area.

## 0.3.3 (2026-10-09)

### New
- **Teleport spells really teleport.** When a teleport spell plays, whoever cast it clicks where to go.
  - A ring shows the spell's range, and a ghost of the token follows the mouse (red when out of range). Esc or right-click cancels.
  - The token vanishes in a misty step, jumps there without walking, and reappears.
  - It's the only Animater setting that actually moves a token.
  - **Spells:** on by default for PF2e Translocate, Dimension Door and Friendfetch (which brings the first target to a spot next to you), and D&D Misty Step, Thunder Step, Far Step and Dimension Door.
  - **Any recipe:** turn it on in the Studio's recipe settings: *Teleport* (the caster or the first target), a range in feet or the spell's own, and optionally *Next to the caster*. Or turn it off for a spell you'd rather move by hand.
  - **Moving someone else:** if a player moves a creature they don't own (an ally fetched to them), the GM's client moves it, but only if that player owns the caster on the same scene.
- **Animation button on item sheets (GM).** Spell, feat, action, feature, weapon, condition and effect sheets have an *Animation* button in their header (D&D 5e: in the header's ⋮ menu).
  - **Your own recipe:** if you made one for the item, it opens in the Studio.
  - **Otherwise:** the item's catalog entry opens, ready to preview or customize.

  Entries are found by the item's compendium source, so an NPC's *Slow (2/day)* opens *Slow* and a *+1 Flaming Kukri* opens *Kukri*.
- **Token motion switch for conditions and effects.** The condition and effect catalogs (PF2e, SF2e and D&D 5e) now have the *Token motion* switch the other catalogs have. Choose *Effects only* to keep the visuals without the creature trembling, swaying or lying down.

### Fixed
- **Condition animations no longer blink out when a turn passes.** When a condition's value changes, such as PF2e lowering Frightened 2 to 1 at the end of a turn, its animation used to end and then restart at the new strength, leaving a gap. The old animation now stays until the new one is playing.
- **Restrained no longer shows fog clouds.** Its web layer used the Web spell's 5×5 area footage, which looks like grey clouds around the token. It now uses a token-sized spider web.
- **Condition markers vanishing while a token is selected (PF2e Visioner users).** This is fixed in PF2e Visioner, not Animater. While you view through a selected token, Visioner lowered every lasting effect under token art, including markers attached to that token. Update PF2e Visioner once its fix is released.

## 0.3.2 (2026-10-09)

### Flash screens

- **New moment: Last enemy falls.** A during-combat flash screen can now play when the final enemy drops to 0 HP, or is marked defeated while it still has HP. It plays once per combat, so dropping to 0 and then being marked defeated doesn't play it twice. Before, nothing marked that moment: the combat's ending screen only plays when the combat is closed. Switch it on like any other moment: the On/Off switch under _During combat_, or the ⚙ panel in the Combat Tracker.
- **Finish Him! plays when the last enemy falls**, not when one enemy is left standing (that is still _Last One Standing_). If you already made a copy from the gallery, it still says _Last enemy standing_: open it, set _Plays at_ to _Last enemy falls_, save, and switch it on.

## 0.3.1 (2026-10-09)

### Updates from inside Foundry work again

Animater's update link pointed at GitHub's "latest" release, which never includes prereleases. So Foundry could never find an update, and each version had to be installed by hand with a new manifest.

A permanent _Update link_ release now always carries the newest manifest, and the release pipeline refreshes it with every version. Copies already installed (0.2.x, 0.3.0) find this update and every later one, with no reinstall.

### Conditions

- **Prone creatures lie down.**
  - A prone token falls onto its side (about 80°), sits a little lower, and gets back up smoothly when the condition ends or a preview finishes.
  - Before, Prone only drew a shadow and dust under the token, which barely showed.
  - Only the token's picture moves, on each screen; the token itself never moves.
  - An unconscious creature, which PF2e also makes prone, now lies down instead of only breathing.
  - Works in PF2e, SF2e and D&D 5e.
- **A better Blinded (PF2e, SF2e).** The black darkness disc that hid the whole token is gone. Now a dark blindfold of haze lies across the eyes, with a dim eye under it that keeps fading out, so you can still see who is blinded.
- **No darkness over unconscious creatures (PF2e, SF2e).** Unconscious automatically adds Blinded, whose animation covered the sleeping token and its sleep symbol. While a creature is Unconscious, the Blinded animation stays off. Blinded on its own still shows.
- **Concealed** is a lighter haze, so the token stays readable through it.
- **Restrained** adds a faint web over the chains, so it no longer looks the same as Grabbed.
- **Steadier body motions.** Condition body motions (trembling, swaying, lying down…) now move in step with Foundry's own drawing, so a token no longer flickers back to its natural pose for a frame when it is hovered, selected or updated.

### Flash screens

- **Finish Him!** A new ready-made screen in a fighting-game style. When one enemy is left standing:
  - the scene freezes dark;
  - a red burst and embers flare;
  - _FINISH HIM!_ slams in with a camera punch, a red flash and a shake.

  Find it in **+ New flash screen**, then switch it on under _During combat_. The text is yours to change, for example to _FINISH THEM!_.

## 0.3.0 (2026-10-09)

The big one: **flash screens**, full-screen title cards for your table, with their own editor. Also random variants, damage reactions and damage-typed knockouts.

### Flash screens

Full-screen title cards ("Roll for Initiative!", "Boss Battle", "Victory"…) that play on every player's screen at the moments you choose. They replace the short-lived _Combat moments_ option; Foundry already marks the current turn.

**When they play**

- **Combat start and end.** The Combat Tracker shows _Opening_ and _Ending_ menus for the current combat: a screen, _Random_ or _None_, plus ▶ to preview. PF2e HUD's tracker has the same menus behind a ⚡ button in its header. A combat that picks nothing uses the world default.
- **Off until you choose.** No screen plays by default. Set the defaults in the ⚙ panel of the tracker picker, or with _Use for_ on the screen's _Screen_ tab.
- **During combat.** Screens can play on a _new round_, a _critical hit_, an _enemy defeated_, the _last enemy standing_ or a _party member down_. Each is off until you switch it on, using the _On/Off_ switch on its card in the library or the tracker's ⚙ panel. A moment never interrupts a screen that is already showing.
- **Before an animation.** A recipe can show a flash screen right before it plays (Studio, ⚙ _Recipe settings_, _Flash screen first_). The animation starts as the screen fades. The screen shows only once the animation is sure to play, and _Stop_ cancels both.
- Only the active GM triggers screens, so each plays once for everyone. Players with Animation quality _Off_ don't see them. Playing music dips while a screen shows (per screen, on by default).

**The library**

- _Flash screens_ is its own page in the Animater menu, like Recipes.
  - Every screen is a card with a small live preview.
  - Cards are grouped into _Combat start_, _During combat_, _Combat end_ and _Before an animation_.
  - Import, Export and **+ New flash screen** are in the page header.
- **+ New flash screen** opens a gallery: start from a blank screen or a copy of any ready-made one.
- **Twelve ready-made screens:**
  - _Roll for Initiative!_, _Boss Battle_, _Face Off_ (party vs enemies) and _Ambush!_
  - _Signature Move_ and _Cut-in_ (before an animation)
  - _Next Round_, _Critical!_ and _Last One Standing_
  - _Victory_ and _Battle Over_
- **Share:** _Export_ saves every screen to a file; _Import_ adds screens from one.

**The editor**

- Opening a card takes you to the editor on its own page. Animater's menu shrinks to icons, like the recipe Studio. **←** (or the _Flash screens_ menu item) goes back to the library; unsaved changes are kept and marked •.
- **Layout:**
  - A one-row header: the name, _Plays at_, then undo, redo, duplicate, delete, revert and save.
  - A 16:9 stage.
  - A timeline with a seconds ruler.
  - An inspector with **Layer** and **Screen** tabs.
- **Quick tools.** The toolbar over the stage changes with the selected layer to offer its most used actions:
  - text: bold, italic, gradient, size, entrance;
  - images: choose a file, size, blend;
  - portraits: who, frame, names;
  - particles: type, direction, amount, speed;
  - sounds: move to the playhead, listen;
  - flash, shake and punch: move to the playhead, strength.

  Every layer on the stage also gets centre buttons and a keyframe button.

- **On the stage:**
  - drag a layer to move it;
  - the corner handle resizes it;
  - the round handle rotates it (_Shift_ snaps to 15°);
  - band edges stretch a band.

  The mouse wheel sets opacity, and _Shift_+wheel sets size. Layers snap to the centre and to each other with pink guide lines; hold _Alt_ to place freely.

- **On the timeline:**
  - drag a bar to move it in time;
  - drag its ends to trim it;
  - drag its shaded ends to set the entrance and exit;
  - drag ◆ to retime a keyframe;
  - drag the **yellow end of the ruler** to make the whole screen longer or shorter.

  Zoom with −, + and _Fit_ or Ctrl+wheel, and scroll with Shift+wheel. Click or drag the ruler to move the playhead.

- **Rows:** each has an icon for its kind of layer, 👁 to hide it while you edit, and **M**/**S** to mute or solo it in the editor's preview. Saved screens always play every layer.
- **Fields:** drag any number field's label to change it (_Shift_ faster, _Alt_ finer).
- **Preview** plays the screen in the editor, with the slider, clock and playhead following along. _Play for everyone_ shows it on every player's screen now.
- **Undo and redo** (Ctrl+Z, Ctrl+Shift+Z). You can also duplicate layers, and copy keyframes from one layer and paste them onto another.
- **Shortcuts:**
  - arrows nudge (_Shift_ ×10);
  - `[` `]` rotate;
  - `-` `=` resize;
  - `K` adds a keyframe;
  - Space plays;
  - `,` `.` step the playhead;
  - Tab picks the next layer;
  - Ctrl+D duplicates;
  - Delete removes.

  They only act while you work in the editor, so the map never moves.

- **?** lists every shortcut and the words that fill themselves in.
- **Show me:** guided walkthroughs (_A sliding title_, _A signature move_). A virtual mouse builds a screen on the real interface one step at a time, with _Next_, _Back_, ↺ replay and ✕. It all happens on a practice screen that is never saved.

**Layers**

- **Text:**
  - font, size, colour, outline, glow, bold, italic and spacing;
  - a two-colour _gradient_;
  - _letters_ or _words_ arriving one by one.
- **Image or video:** any file, or a JB2A key.
- **Portraits:** fill in from the encounter when the screen plays:
  - who: _the party_ (player-owned or friendly tokens), _the enemies_, _the boss_ (highest level or CR), _everyone_, or _the one using the action_;
  - token images or actor portraits;
  - framed as circles, rounded squares or a **Slash** cut-in;
  - optional names;
  - popping in one after another, in rows (_Per row_: 2 makes "2 above 2").

  Hidden combatants never appear. With no encounter, stand-ins show in the editor.

- **Colour band:** a slanted strip of colour behind a title.
- **Speed lines:** manga lines rushing to a point you place.
- **Light burst:** turning rays from behind.
- **Slash streak:** a bright cut across the screen.
- **Particles:** embers, sparks, snow, ash, petals or blood, with direction, amount, speed and size.
- **Moments:**
  - _Sound_ cues at exact times;
  - _Screen flash_;
  - _Screen shake_;
  - **Camera punch** (the whole card zooms in hard, then eases back).

**Animating layers**

- **Entrances and exits:**
  - fade;
  - slide (four ways);
  - zoom;
  - slam;
  - type on;
  - wipe;
  - blur;
  - _Outline, then fill_: the outline draws itself, then the colour pours in.
- **Keyframes:** add a ◆, move the playhead, then drag or resize the layer. It moves, scales, turns and fades smoothly between keyframes. A text's keyframes can also change its colour and glow.
- **Loop effects** while a layer shows, at a chosen speed:
  - pulse;
  - glow;
  - heartbeat;
  - glitch;
  - flicker;
  - wobble;
  - float;
  - spin.
- **Blend modes** on every layer: Screen, Add, Multiply, Overlay. _Screen_ or _Add_ hides the black around JB2A videos so they glow.

**The screen**

- **Backdrop:** a colour and darkness, dark edges, and _Cinematic bars_.
- **Animated background:** a JB2A loop (bad omen, fog, crimson or ember fog, storm, darkness, fireflies, sleet, runes, energy field) or any video.
- **A sound** for the whole screen.
- **Game scene behind it:** freeze the map and turn it grey, dark or sepia while the card shows. Each player's map comes back when the card ends.
- **Words that fill themselves in.** Text layers have chips to insert them.

  | Word       | Shows                        |
  | ---------- | ---------------------------- |
  | `{scene}`  | the scene name               |
  | `{round}`  | the round number             |
  | `{boss}`   | the strongest enemy          |
  | `{name}`   | who crit, fell or acted      |
  | `{action}` | the attack, spell or ability |

### Random variants

- A stage can have random variants: copies with their own asset, size and timing. Each play picks one, so repeated attacks don't look identical.
- To add one, select a stage in the Studio and click _🎲 Add a random variant_ under Type, then change the copy as you like.
- In the timeline, a group is one clip with numbered tabs on top (_1 2 3 +_). Click a number to edit that variant, or _+_ to add another.
- _Remove this variant_ in the stage panel deletes one.
- While you edit a variant, the others are hidden in the preview. Stages linked to a variant follow whichever one played.

### Damage reactions and knockouts

- **Damage reactions:** a token that takes energy damage flashes in that damage's look:
  - flames for fire;
  - an ice shard for cold;
  - crackle for electricity;
  - a splash for acid;
  - also poison, void/necrotic, vitality/radiant, force, mental/psychic, sonic/thunder and spirit.

  With Token Magic FX, the token's own artwork also burns, frosts, crackles or glows for a moment. Physical damage keeps its weapon animation only. Setting: _Damage reactions_ (on by default).

- **Damage-typed knockouts:** dropping to 0 HP still collapses the token, and now finishes in the look of the damage that did it: burned to ash, frozen and shattered, fried by lightning, dissolved in acid, or blasted apart by force. With Token Magic FX, the matching filter plays on the falling token. Physical damage keeps the plain collapse. Setting: _Damage-typed knockouts_ (on by default). Artwork missing from JB2A Free is skipped and never blocks the collapse.
- Both work in PF2e, SF2e and D&D 5e.

### Smaller changes

- **JB2A status is honest.** The sidebar dot used to turn green as soon as Sequencer was running, even when JB2A's animations weren't in Sequencer's database. It now stays grey in that case. The Setup card says "Active, but Sequencer has no JB2A animations · reload Foundry; if it stays, press F12 and look for JB2A errors".
- The tagline is now _Make every moment felt_.

## 0.2.7 (2026-10-08)

- **Your customized conditions and effects play with plug & play off.** A condition or effect you customized (or made yourself) now plays from your Recipes whenever Automatic playback is on, even if that catalog is paused. Spells, feats and weapons already worked this way. It doesn't play if you explicitly chose "Use animation" for the catalog version of that entry, or if you disable the recipe. Turning Automatic playback on or off updates lasting animations right away.
- **Leaner condition and effect catalog page.** The "Using catalog animation" box is gone (the Use / Customize buttons already show it), the Local canvas preview button has space above it, and "Loops while document active" now reads "Loops while it is on the token".
- **Recipes say when they can't play.**
  - **Same link:** when two enabled recipes are linked to the same item, condition or effect, the card that loses says "⚠ Not playing: “Spell Effect: Shield” is also linked to … and plays instead", and the winner says which recipe it overrides. The Studio header shows the warning too.
  - **Who wins:** a catalog copy beats a handmade lasting animation, a recipe bound to an item beats one matched by name, and otherwise the tie is broken by internal recipe ID.
  - **Not linked:** a recipe with a trigger but no names or item says "Not linked to anything yet" instead of looking ready to play.
- **Studio trigger chip text is centered.** "Attack rolled · fire bolt" now sits in the middle of its pill instead of near the top.
- **Studio buttons line up.** In a narrower window, "Save recipe" no longer wraps onto two lines and grows taller than Revert. The bar buttons share one height, and the recipe name shrinks instead.
- **New recipe asks what kind of animation you want.**
  - **Action animation:** plays once when something happens: a spell, an attack, damage, or an area.
  - **Lasting animation:** stays on a token while a condition or effect is on it, and stops when it is removed.
  - Each choice has a one-line explanation and an example. A lasting animation opens its Recipe settings so you can type the condition or effect name first.
  - Players, and worlds without condition support, go straight to an action animation.
- **Duplicating a lasting animation keeps it lasting** instead of turning it into a manual one.
- **Condition and effect recipes are marked as such.** Their recipe cards carry a teal "◷ Condition · stays while on token" (or Effect) badge. In the Studio, the trigger reads "Effect · while on token", so they no longer look like ordinary one-shot recipes.
- **Condition and effect layers always stay on the token.** A layer added to a condition or effect animation used to stay invisible until a hidden "keep" box was ticked. These layers now always last while the condition or effect is on the token. The one-choice Subject menu is gone, and a note explains that Duration only sets the preview length.
- **Tidier Studio stage panel.**
  - Target options (which targets, maximum targets, skip without targets, spread across targets, delay between targets) only show on stages that play on or toward targets, not on Caster, Area or screen stages.
  - Anchor X/Y show only after ticking "Override artwork anchor", and tint colour options only after ticking "Apply tint".
  - Remove stage is now a small bin next to the stage type, instead of hiding under Asset & visibility.
  - Plainer labels: "Restart every", "Stop clip at", "Play the clip once, no looping", "Recolor fully".
- **Customizing a catalog entry uses your version right away.** Clicking Customize on a condition, effect or D&D entry now plays your saved version instead of the catalog one, with no extra "Enable customization" step. If that catalog was off, it turns on for that one entry only.
- **Plainer wording for condition and effect animations.** "Document-linked" and "native document" are gone: the Studio now says the animation plays while the condition or effect is on the token.

## 0.2.6 (2026-10-08)

- **"Attached aura" stages are now called "Stays on token"**, which says what they do: the animation sits on the token and moves with it.
- **"Stay until the effect ends" for token auras.** A looping aura (a Shield ward, a glow) can now stay on the token for exactly as long as the spell's effect lasts, with no duration in milliseconds to guess.
  - **Where to find it:** a checkbox right under Duration on any aura stage in the Studio. It replaces the old "Persist until stopped" option, which was hidden under Asset & visibility.
  - **When it ends:** when the item's effect leaves the token (for example "Spell Effect: Shield" in PF2e/SF2e, or the item's Active Effect in D&D), when the spell ends, or when you press Stop.
  - **No effect applied:** if no effect is applied within a minute, the animation stops on its own.
  - **Duration:** now only sets how long the preview lasts.
- **Players can make their own animations, with GM approval.**
  - **Players:** they open Animater (toolbar button or Alt+Shift+A) to a Studio of their own recipes, with the asset library; catalogs and settings stay GM-only. Each recipe card shows whether it is waiting for the GM, approved or declined.
  - **GM:** the Recipes page lists every player animation, waiting ones first, with Preview, Approve and Decline (or Revoke).
  - **Playback:** an approved animation plays only for the items that player's own characters use, even when the GM's automatic playback is off.
  - **Open in Studio:** the GM can open any player animation in the full Studio to inspect or fix it. A banner shows whose animations are open, with Approve, Decline and Done reviewing. Saved edits go back to that player and need approving again; the GM's own recipes and drafts come back when they're done reviewing.
  - **Approval covers one version:** any edit sends the recipe back for approval, and players cannot approve their own.
- **FXMaster effects stay inside the template.** When an animation has a placed template, its FXMaster particles or filters (snowstorm, fog, bloom…) now play only inside that template, as a temporary FXMaster region effect on the template, instead of over the whole scene. They are removed when the stage ends or the template is deleted. Without a template they still cover the scene. Local preview keeps its particles inside the preview area too.
- **Local preview shows FXMaster particles.** Snow, rain, embers, snowstorms and other FXMaster particle stages now appear in Local preview on your screen only; the scene is not changed. FXMaster scene filters (bloom, fog…) still need Play at table.
- **Play at table works without a template.** A recipe with an area used to stop with "Select a supported area first" while the window was tucked away, so it looked like the window just shrank. It now plays at the same sample area Local preview uses. If anything still prevents playback, the reason shows as a notification.
- **"Off" animation quality silences Animater too.** A player who sets Animation quality to Off no longer hears Animater sounds either; everyone else still does.
- **PF2e and SF2e effects no longer share one animation per theme.**
  - Effects of the same kind used to look identical: every lightning effect showed the same orb, and over 400 effects shared one blue border. They now take the theme's variants in turn.
  - Effects with the same name stem (Lightning Armillary, Catcher, Powered, Rod) always get different animations.
  - Lightning draws from orbs, static crackle and lightning balls; fire and poison have wider pools; enhanced senses show glowing eyes.
  - Wards use a compact shield marker instead of the large hex dome.
- **D&D official books reviewed.** A visual pass over the generated Player's Handbook, Monster Manual and Dungeon Master's Guide content:
  - **Smites** (Banishing, Blinding, Staggering, Thunderous, Wrathful) now strike the target in their own colour instead of glowing on the paladin.
  - **Book spells with literal JB2A footage:** Cloud of Daggers, Hunger of Hadar's darkness, Conjure Barrage and Conjure Volley's arrow volleys, Thunderclap and Destructive Wave's thunder, Armor of Agathys' ice shield.
  - **Book areas that last:** Cloud of Daggers, Hunger of Hadar, Jallarzi's Storm of Radiance and Tasha's Bubbling Cauldron loop, and Yolande's Regal Presence follows the caster.
  - **The beholder's Eye Rays** fire a ray, and each of the ten lands as its own effect.
  - **Weapon maneuvers and strike riders** (Commander's Strike, Trip Attack, Assassinate, Great Weapon Master…) land on the target as weapon hits.
  - **DMG firearms** fire bullets, the Ballista fires a bolt and the Cannon a cannonball. Reloading, loading and aiming no longer animate.
  - **Monster Manual:** "Expend Use" and "Roll 1d10" bookkeeping steps no longer play their own animation before the attack they lead to.

## 0.2.5 (2026-10-08)

- **All four degrees of success show.**
  - **Attacks:** a critical failure is a fumble. The attack goes wide and the attacker stumbles, unlike a plain miss.
  - **Saving throws against a spell or effect:** the saving creature reacts to its own result. It shrugs it off on a critical success, resists with a small shake on a success, staggers on a failure, and is overwhelmed on a critical failure.
  - **Systems:** PF2e and SF2e use all four. D&D 5e saves against a known DC use success and failure.
  - **Private rolls:** saves rolled privately or blind show nothing, so they give nothing away.
- **PF2e and SF2e lasting emanations and sustained spells.**
  - An aura emanation (Divine Aura, Destructive Aura, Reaper's Lantern…) loops around the caster and follows them. Emanations without the aura trait (Synaptic Pulse, Confusing Cry) only affect whoever is inside when cast, so they still play once.
  - Emanations that apply a spell effect (Bless, Protector's Sphere…) already show their aura from that effect, so they are not doubled.
  - Sustained spells count as lasting too. Their area ends when the spell's effect on the caster ends, or when the template is removed.
- **Auras that move with the caster.** Spirit Guardians, Aura of Life, Holy Aura, Antimagic Field and Antilife Shell (and, with the Player's Handbook, Aura of Purity, Aura of Vitality, Crusader's Mantle and Circle of Power) now keep looping around the caster and follow them as they move, instead of playing once.
- **Lasting areas end with concentration.** When a D&D caster stops concentrating (broken, dropped or expired), the looping animation of that spell's area ends too, even if its template is left on the map.
- **Hits, misses and crits look different.** A missed attack still flies, but wide of the target, and nothing lands on it: no impact, flinch or impact sound. A critical hit lands with a bigger impact and rocks the target harder. PF2e uses its degrees of success; D&D 5e uses natural 20s and 1s, and the attack total against the target's AC when one creature is targeted.
- **Creatures collapse when they drop.** A creature reaching 0 HP tips over and sags for a moment (D&D 5e, PF2e and SF2e); its Unconscious or Dying motion takes over from there.
- **Animations wait for Dice So Nice.** With Dice So Nice active, attack and damage animations start when the 3D dice for that roll land instead of while they are still tumbling. Each player can turn this off with the **Wait for Dice So Nice** setting (shown only when Dice So Nice is active).
- **D&D everyday spells look like themselves.** About 35 cantrips and 1st–3rd level spells that shared one purple divination circle or a blue shield marker now have their own look:
  - Divination opens glowing eyes (True Strike, Identify, Detect Thoughts, Clairvoyance, the Locate spells, Find Traps) or floating runes (Comprehend Languages, Tongues, Augury).
  - Guidance sparkles, Light glows, Mending draws threads together, Command rings out as a sound wave, and Hex and Bestow Curse wrap the target in dark strands.
  - Shield of Faith and Protection from Evil and Good raise star and rune wards, Sanctuary a golden blessing, Goodberry sprouts, and familiars, steeds and servants arrive through a portal ring.

## 0.2.4 (2026-10-08)

- **Several conditions on one creature.** The token now moves for the most important one instead of the most recent. From highest to lowest: Petrified (no motion), Paralyzed or Dead (held still), Unconscious, Dying or Sleeping (breathing), grappled or restrained (struggling), stunned or confused (wobbling), Frightened (trembling), poisoned or sickened (swaying), Blinded (searching), and tiredness or encumbrance (sagging). Applies in D&D 5e, PF2e and SF2e. New motions: D&D Dead, Stable, Dehydration and Malnutrition; PF2e/SF2e Slowed and Controlled; SF2e Glitching and Untethered.

## 0.2.3 (2026-10-08)

- **Right-click a recipe** in the recipe list to open it in the Studio, duplicate it or delete it, without opening it first.
- **Recipe delete is a red bin** in the Studio bar instead of the ⌫ symbol.
- **PF2e Dying no longer makes the token vanish.** Dying brings Unconscious, and the two breathing motions compounded every frame until the token shrank to nothing and stayed that way after the condition ended. A token now shows one condition motion at a time and returns to its natural pose when the last one ends.

## 0.2.2 (2026-10-08)

- **Custom asset sources.** Add named User Data folders in Assets to browse animations, images and sounds without Sequencer database registration, including subfolders. Sources are remembered per user and can be refreshed or removed. Folder source controls open in a compact toolbar popover.
- **Conditions move the creature.** While a condition lasts, the token itself reacts (on this screen only; the token never moves on the map): Frightened trembles, Poisoned/Sickened/Diseased sway, Stunned/Incapacitated wobble, Exhausted/Encumbered sag, Grappled/Restrained struggle, Blinded searches, Unconscious breathes slowly, and Petrified turns grey stone. Attacks and other token motion take priority; the device quality setting can turn it off.
- **No more force-field domes.** Wards, stone and water effects no longer wrap the token in Token Magic's large field bubble; they glow on the body instead. D&D wards and armour use a compact shield marker instead of JB2A's hex dome.
- **D&D conditions reviewed on a live scene:** Blinded, Invisible, Petrified, Prone, Paralyzed, Exhaustion, Grappled, Cursed, Charmed, Deafened and Incapacitated reworked to read clearly.
- **D&D spell areas.** Fog Cloud and Confusion (2024) fill their sphere instead of playing on the caster. A new Sunbeam (2024) fires along its line. The 2014 Sunbeam cast stays a mote in the caster's hand instead of a column of moonlight. Saves made inside an existing area (Cloudkill, Stinking Cloud, Web, Weird, Moonbeam's start-of-turn saves…) play only on the creature, not a fresh cast from the caster.
- **D&D official books.** With the Player's Handbook, Dungeon Master's Guide, Monster Manual or Heroes of the Borderlands modules active, their spells, features, weapons and items animate too. Book copies of SRD content use the SRD design (Evard's Black Tentacles, Bigby's Hand…). About 590 book-only entries (Toll the Dead, Arms of Hadar, smites, summons, Monster Manual attacks, DMG magic items) get their own compositions and appear in the D&D catalog marked PHB, DMG, MM or Borderlands. They appear only while that book module is active.
- **D&D save spells cast before targeting** (Sacred Flame, Toll the Dead) now play on their damage roll instead of being blocked.
- **Lasting areas stay on the map.** A spell area that lasts (a cloud, a wall, a web, darkness, a storm) keeps its animation looping on the template until the template is removed. Instant blasts and areas that only affect creatures when cast still play once. D&D 5e marks these spells in its catalog. In PF2e and SF2e, Animater decides when the spell is cast, from the spell's duration and what its name describes. Lasting wards show a circle on the ground instead of a dome.
- **Area spells that catch no one still play.** Casting Fear (or any area with creature reactions) at empty ground used to stop with "Target at least one token first"; the area now plays and only the reactions are skipped.
- **Foundry 14 templates passed by macros.** A MeasuredTemplate document handed to Animater now uses its Region's geometry; the template document's distance assumes a 100px grid and made cones and lines up to three times too long on larger grids.
- **Sunbeam reads as a 5-foot beam** instead of a thin thread, and Acid Splash (2024) bursts evenly across its sphere instead of splashing to one side.
- **Studio preview no longer stalls** on a sound stage without a volume.
- **JB2A warning.** When neither JB2A Free nor JB2A Patreon is active, the GM gets a notification on load and every Animater page shows a warning with a link to Setup. Built-in animations need one of them for their artwork.
- **D&D 5e / SF2e catalog styling.** Pagination, Reset filters, the Token motion / Sounds toggles, the volume readout and the quality badges now match the PF2e catalogs. Form controls keep Animater's font even when a game system restyles buttons and inputs.
- **Include from the catalog card.** When plug & play is off or set to picked entries, each card has a ✓ toggle that adds just that entry to plug & play (click again to remove it). While the whole catalog runs, cards show the ⊘ exclude toggle instead.
- **Sound volume sliders now apply everywhere.** Entries with a bespoke composition ignored the catalog volume and played at the 35% default: every PF2e action, plus about 1,000 D&D 5e and 350 SF2e activities. All of them now follow their catalog's slider.

## 0.2.1 (2026-10-08)

- **Exclude from the catalog card.** Every catalog card (spells, feats, actions, features, weapons, conditions, effects, and the D&D 5e / SF2e catalogs) has a ⊘ toggle on hover. It excludes that entry from plug & play without selecting it first; click again to include it. Excluded cards are dimmed and marked _Excluded_.

## 0.2.0 (2026-10-08)

### Recipe Studio

Opening a recipe fills the whole window, laid out like a video editor.

- **Monitor.** A large preview with play/pause, stop, go to start/end, loop and a time readout. Click or drag the ruler (or empty track space) to scrub; the monitor shows that exact moment.
- **FXMaster in the monitor.** Particle effects (bats, rain, embers…) play inside the preview, scaled to the preview grid, and follow scrubbing, pause and loop. Scene filters (bloom, fog…) still need Play at table.
- **Timeline.** Tracks for Caster, Flight, Target, Token motion, Sound and Filters & scene; stages that don't overlap share a row. Each track's **+** adds a stage at the playhead.
- **Editing clips.** Drag clips to move them; they snap to other clips and to the playhead (hold Alt to place freely). Drag a clip's right edge to trim it. Lines show what the selected clip starts with or after. Right-click for Start at playhead, Duplicate or Delete.
- **Mute / Solo.** Each track has **M** and **S**. Muted tracks (or every track but the soloed ones) are hidden and silent in the monitor, including token motion and Token Magic filters.
- **Inspector.** Shows only the selected stage. The Type choice offers the variants that fit its track (e.g. Target or Area). Visual assets show a small looping preview; sound stages have a volume slider and a listen player.
- **Recipe settings.** Trigger, item binding, description, category and accent open from the ⚙ trigger chip in the Studio bar (Esc closes). The bound item shows its name and icon; click it to open its sheet.
- **Shortcuts.** Space plays or pauses, Home/End jump, `,` `.` and the arrow keys step (Shift for larger steps), L loops, Ctrl+D duplicates, Delete removes, Ctrl+S saves, Ctrl+wheel zooms. Zoom, Fit and a help tooltip sit in the timeline's corner.
- **Layout.** The inspector's width and the timeline's height are adjustable and remembered per browser. The recipe library uses the full window width; **← Recipes** (or the Recipes nav item) returns to it.

### Choreography

- Stages have a **Start** choice: _After_ (optional gap) or _With_ another stage, or _At a set time_. Pick a specific stage to follow (e.g. stage 3 with stage 1); it stays attached when stages move. New stages follow the previous one; sounds and token motion start with it. Loops are refused.

### Workspace

- Local preview and Play at table check for a selected caster token first, instead of minimizing the window and failing quietly. The window minimizes while they run and restores afterwards (per-user setting).
- Catalog controls (Plug & play, Token motion, sounds) share one compact row on every catalog tab; their descriptions show on hover.
- Tooltips use Foundry's tooltip style.

### Installation

- Installing no longer offers JB2A Free when you use JB2A Patreon: the manifest no longer recommends a specific JB2A edition (install either one).

## 0.1.0 — prerelease (2026-10-08)

First public prerelease.

### Catalogs

- PF2e: 1,994 spells, 2,308 active feats, the native actions pack (Demoralize, Grapple, Raise a Shield, Rage…), class and ancestry features (Sneak Attack, Flurry of Blows, Glimpse of Redemption…), 1,013 weapons with melee/ranged/thrown uses, 43 conditions and 2,929 effects.
- SF2e: spells, feats, actions, features, weapons (including Area Fire and Auto-Fire), conditions and effects.
- D&D 5e (2014 and 2024 SRD): spells, features, weapons, activated items, statuses and effects.
- Every entry is matched to its own description, with bespoke compositions for thousands of entries combining JB2A footage, token motion, Token Magic FX and sound. Every animation resolves in both JB2A Free and Patreon.

### Playback

- Automatic playback from native chat cards, attack and damage rolls, placed areas and applied effects; per-entry enable, exclude and customize.
- Spells that offer a damage-type choice animate in the chosen element.
- Persistent effects and conditions follow the token while the native document is active. Afflictions read as debuffs; valued conditions (Frightened 1–4, Clumsy, Drained, Doomed…) grow with their value. Persistent damage shows its type.
- Cold area spells freeze the creatures they catch (Token Magic frost; Baileywiki's ice overlay when Nuts and Bolts and its Maps Premium Towns art are active).
- Cosmetic token motion: lunge, recoil, leap, charge, stagger, press, sink, throw, brace, cower, slam, drift and more.
- Optional sound from GGG, PSFX, SoundFx Library and PF2e Creature Sounds, falling back to whichever packs are installed.

### Settings and performance

- Per-device _Animation quality_ (Full / Balanced / Low / Off); optional layers are only sent to viewers whose setting allows them.
- _Weapon effect size_ (default 1.5×), and toggles for Token Magic FX and FXMaster enhancements.

### Integrations

- Automated Animations stands down for items Animater animates (items customized in Automated Animations stay with it).
- Spell Arsenal keeps its mapped area spells, with an opt-in to also play the Animater recipe.
- Trigger Engine node _Animater: Play animation_; `animater.preDispatch` / `animater.played` hooks; `api.resolve` and `api.handles`.

### Workspace

- Catalog pages with search and filters, full composed previews with stage highlights, private canvas previews, a recipe editor (stages, timing, tracks, motion, sound, overlays), a JB2A/Token Magic/sound media library, activity log and import/export.
