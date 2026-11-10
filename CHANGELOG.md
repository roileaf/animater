# Changelog

## Unreleased

- **Breakable props.** Prop tiles (barrels, crates, pots, urns, bottles) now break. An area spell breaks the props in its area once the damage is rolled, a creature forced into one (finisher knockback, a push, a blast push) smashes it, and a melee strike that misses next to the target can break it (a critical failure always; a plain miss by a chance you set, 25% by default). The prop's own picture breaks into pieces that stay as wreckage with a scorch, frost, stain, burn or dust mark for the damage, and its contents spill, with a break sound for its material (and a splash for a liquid) heard where it breaks. The tile is hidden from players and the walls drawn on it stop blocking; unhiding the tile, or **Repair broken props** in the scene's Animater settings, puts the prop and its walls back, and deleting a broken tile restores them. Tile Configuration → **Overhead** tab → **Breakable prop** sets the **Material** (guessed from the picture's file name) and **Contents**; Scene configuration → Animater → **This place** has **Breakable props** (off until you turn it on) and **Chance a miss breaks a prop (%)**. Props painted into a map image and FA Nexus flattened tiles can't break.
- **Breaking more things.** With **Breakable props** on, the rest of the battlefield breaks too.
  - **Furniture collapses:** tables, chairs, benches, shelves, bookshelves, desks and beds fall into long planks and leg stubs that keep the furniture's outline. New **Contents**: **Books** (pages and books slide off) and **Potions** (coloured glass and stains), guessed for bookshelves and apothecary shelves.
  - **Doors break:** a wooden door gives way to bludgeoning, slashing, force, a fire area, or a Large or bigger creature forced through it (a medium one isn't enough); metal and stone doors only to force or a Huge creature. Locked doors break too. The door becomes an open gap with splinters and planks on the far side and a dark jagged gap painted over it. The GM can smash any door with Shift+right-click on its control icon.
  - **Force open from the door:** in PF2e, SF2e, D&D 5e, Daggerheart and Draw Steel, a player right-clicks a closed or locked door and is asked "Force it open? Athletics vs DC 15" (in the system's words); the GM does it for a selected token with Alt+right-click. Meeting the DC breaks the door. Default DCs: wood 15, metal 20, stone 25 (PF2e, SF2e, D&D 5e); Daggerheart 13, 16, 19, and a Daggerheart critical always forces it; Draw Steel goes by tier (tier 2 or 3 for wood, tier 3 for metal or stone). A PF2e or SF2e Force Open rolled from the sheet without a DC uses the closest door's DC. Other systems: the GM smashes the door by hand.
  - **Windows:** tick **Window** on a wall to make it glass that breaks from blows, shoves, a ranged attack whose missed shot flies into it (it breaks as the shot reaches it, on the path the miss animation shows), and a melee strike that misses beside it (never on the attacker's side). A broken window lets sight, light and sound through but still blocks movement.
  - **Lights go out:** breaking a lantern, lamp, candle, torch, chandelier or brazier puts out the lights on it. A lantern's **Lamp oil** spills and burns for about a minute when the cause was fire or the lamp was lit, then leaves a scorch. A brazier tips over from any shove: its fire goes out and its coals scatter.
  - **Powder kegs:** **Black powder** explodes from fire, electricity or another blast, breaking every prop, door and window in its **Burst (squares)**, so a row of kegs chain-reacts, each keg once. An axe spills the powder instead, and a later fire spell sets the spill off. Tokens are not damaged: the GM is whispered who stood in the burst.
  - **Statues topple:** stone statues, pillars, columns and obelisks fall along the hit from force or a Large slam, into chunks over a strip about 1.4 times their longer side. With **Rubble is difficult terrain** (scene switch, or per tile) the strip costs double to walk through. Tokens under it are not damaged: the GM is whispered their names.
  - **Plants burn away:** the new **Plant** material (webs, vines, bushes, hedges) chars to ash from fire; a web or vine can also be cut by slashing.
  - **Settings on everything:** Tile Configuration → **Breakable prop** adds **Breaks as**, **Light prop**, **Tips over instead of breaking**, **Burst (squares)** and **Rubble is difficult terrain**; Wall Configuration gets a **Breakable** box (**Breakable door**, **Material**, **Can be forced open**, **Force open DC**, or **Window**); the scene's **This place** adds **Doors and windows break** and **Rubble is difficult terrain**.
  - **Repair puts it all back:** **Repair broken props** now also restores doors (locked ones stay locked), windows, the lights that went out, and removes rubble regions and burning oil's lights.
  - **New sounds:** door crashes, explosions, falling stone, falling books and a metal clatter for tipped braziers (CC0).
- **Decorations break.** A region's painted crates and barrels shatter, crystals shatter like glass, bushes, ferns, spiky plants and reeds burn away, cobwebs burn or are cut by slashing, and stalagmites and rock columns topple from force or a Large slam (with rubble and the GM's whisper, as statues have). They break from the same things as props: an area's damage, a missed melee strike beside the target, a shove, blast or charge into one, and a powder keg's burst. Each wreck is cut from the decoration's own painting and is the same on every screen. Turn it on per region with **Decorations can break** in the region panel's **Decorations** section (off by default); the scene's **Breakable props** must be on too. **Repair decorations** in the region panel puts one region's decorations back, and **Repair broken props** (the toolbar hammer or the scene configuration) puts back every region's. Editing a region so its decorations move (shape, density, size, kinds, Reshuffle or rubbing out) brings its decorations back whole; ones painted by hand keep their breaks.
- **Charges smash props.** A charge, roll, dodge or lunge that runs a token through a prop breaks it (leaps go over). Only a prop ahead of the creature breaks: one it stands on, or one beside it that it moves away from, stays whole. On a scene with levels, props break only from something on their own level, and wreckage shows only on that level.
- **Decorations for regions.** Right-click a region → **Decorations** to scatter painted rocks, boulders, trees, bushes, ferns, puddles, mushrooms, logs, stumps, flowers, bones, crates and more over it, in the map's own hand-inked look: crowns heaped in clumps of small leaves or needles, faceted stones, stained bones, crystals growing out of rock. Town and dungeon kinds too, with their own **Town** tab on the brush bar: street lamps and braziers (each a real light that lights the area and throws shadows, flickering like a flame), wells, hay bales, fences, sacks, paving, gravestones, sarcophagi, coffins, mine rails, dropped tools, treasure, scattered papers, cages, broken pillars, market stalls, tables, benches, water troughs, planters, washtubs, produce crates, anvils, urns, collapsed timbers, stake fences, straw beds, bones in rubble, tents and bedrolls, all drawn after the world's own maps. Underground there are stalagmites, rock columns, rubble, cave pools, lichen, fissures, mine timbers, and glowing mushrooms, crystals and cracks. Choose which kinds, how dense, each kind's size and how many, and **Reshuffle** for another layout; every screen shows the same one. To draw them by hand, the new **Decorations** button in Animater's controls opens a brush with a bar to pick the kind it paints (one at a time, with a search: "tree" finds every tree), brush size, **Density** and **Decoration size**: a stroke that starts in a region with decorations paints into it, and one on open ground makes a new region round the stroke. A faint ghost of the next dab follows the brush and changes as the sliders and kinds do; a click lays exactly what it shows. A region's own **Brush** opens the same bar, with just that region's ticked kinds to pick from. Shift-drag rubs out, Ctrl+Z takes back the last stroke (Ctrl+Shift+Z or Ctrl+Y puts it back), Ctrl+wheel sets the brush size, Shift+wheel turns what it lays (15° a step; **Random** lets each lie its own way again), Ctrl+Shift+wheel its density and Alt+wheel the decorations' size (the wheel alone still zooms), and right-click or Esc stops; a right-drag still pans the map. They throw shadows from the sun and moon and from nearby lights (a torch, a lantern, a Light spell; by day a light is too weak beside the sun to throw one), tokens walk under the trees (the crown opens to show the trunk), and the trees join the canopy's shade with ten kinds and their own leaves. Leaves turn with the seasons and trees go bare in winter. Snow lies on them as it lies on the ground, following it as it builds up and melts: a dusting on their tops at first, capping them white when deep (a brazier's or a lamp's fire keeps its own clear). Rain darkens wood, cloth and stone until they dry, in the wind a market stall's awning and a tent's canvas ripple (never their poles or the wares beside them) and bushes, grass, reeds, flowers and tree crowns sway from their roots out, further in a stronger wind rather than faster, and puddles are moving water. Underground, the glowing kinds are the cavern's own fungus, crystals and lava, and cobwebs hang in the corners. The canopy also has two new tree kinds, **Spruce, fir or cypress** and **Blossom or fruit tree**; blossom trees drop petals.
- **Texture opacity.** A region that paints its floor has a **Texture opacity** slider under Texture style, from 10% to full. Less lets the map's own picture show through the painted floor, grass blades included.
- **The Animals panel counts the regions' animals.** A line at the top gives the whole map's animals, the scene's and every region's together, and how many of them are in regions. Each kind shows **+N in regions** beside its own count. The counts stay current while the panel is open.
- **Light sources against the sun, as real light goes.** A torch, lantern or Light spell is tiny beside daylight, so it no longer throws a second shadow at noon or lights up the floor, water and snow around it. From dusk it begins to show, and by night it is all the light there is. Under a roof, where daylight doesn't reach, a light keeps its full strength at any hour.
- **A deleted tile leaves nothing behind.** Deleting or hiding a ship tile left its deck's painted floor, its shadow and its cut in the sea behind on the water. A floor region traced on a tile now draws nothing while that tile is gone or hidden, and the water reflects and creatures wade there again. The region itself is kept, so showing a hidden tile again brings the deck back.
- **Floor regions on a ship tile.** Floor regions can trace a tile as well as the map. A deck is the floor underfoot. An awning keeps the rain and the sun off whatever is below it, and the deck's drawing sits on the tile. A tile that is rotated or scaled is left out, because its outline would land in the wrong place. A token a fraction off the deck's height, such as 10.5 on a deck at 10, still walks the deck.
- **Waves break on a ship.** Tick **Animater: waves break on it** in a tile's configuration (Appearance), and the sea's waves crash white along that tile's picture on the side they come from, a stretch at a time with each wave, while its far side lies calm. For a ship or a rock tile standing in moving sea. It follows the tile when it is moved or turned. Off unless ticked.
- **Give an animal orders.** As GM, right-click an animal for a small HUD like a token's. **Go here** sends it to a spot you click, **Follow token** has it keep beside a token, and **Circle token** sends it round and round one (a hawk circles overhead). **Let it go** sends it back to wandering, and **Remove** takes away one you placed. Each goes in its own way: deer and wolves walk, a fox trots, a rabbit hops, a squirrel dashes, a snake slides and a bird flies. An ordered animal doesn't run from people. Orders are kept with the scene, so every screen moves it the same way. Works for rabbits, birds, hawks, deer, foxes, wolves, squirrels, snakes, ducks, herons, gulls, frogs, pigeons, hens, dogs, cows, goats, sheep, pigs and horses, including animals a region asks for. Birds up on a roof or in a tree (crows, songbirds, pigeons) and crows flying over can take orders too: one hops down to its mark, sits there and hops after it when it moves. All of them can now be placed by hand in the Animals panel too. A right-drag that starts on an animal still pans the map. A bird told to circle a token flies close round it, about a square out, and every player sees it circle. An animal you place or give orders shows even on a scene with Outdoor life off, like a region's animals.
- **Tokenshade on the token HUD.** Right-click a token: a new **Tokenshade** button opens a quick picker. Hover a look to try it on the token (your screen only), click to apply it for everyone, and press × on a look already on the token to take it off. Search, sections like the Tokenshade page's, your recent looks and your own presets are all there. The GM can use it on any token, a player on their own.
- **Ducks stay off the sea.** On a map with a sea and a river or pond, a startled duck could come down on the sea, and one could paddle out of the river mouth into it. Ducks and frogs now keep to the fresh water. Only when a map has none for them do ducks wait on the sea.
- **Shadows thrown up the map no longer show the creature mirrored.** Under a midday sun or a lamp below a token, its long shadow showed the art reversed side to side, so a flipped and an unflipped token side by side looked like their shadows leaned opposite ways. A shadow thrown up the map now shows the creature as its token does, its right side on the right; a flipped token's shadow follows the token's flip and still falls the way the light throws it. Shadows thrown down or across the map lie as before, like a reflection in water.
- **A friend's blow on the damage lens.** When a friend hits the enemy next to your creature, the blow crosses your screen before the enemy's blood lands. It comes big and from the friend's side: a sword, axe, spear or mace swing, an arrow, or a fire, cold, lightning or force spell, picked from the weapon or spell. The view flinches and the hit flashes in the damage's colour as it connects. Uses JB2A's own clips. Turn it off in the damage lens settings with **Show a friend's blow**. GMs can try it in the Damage immersion showcase: **A friend hits** (target), with any weapon or spell.
- **Apply a Tokenshade look to a token.** In Animater → Tokenshade, the Use it card has **Apply to selected tokens**: the look you are viewing, with any changes you made to it, goes on each selected token you own, and everyone sees it until you select the token and press **Remove**. It stays through reloads and scene changes.
- **Ducks tip up to feed.** A duck feeding now shows it: head and breast dim under the water, the rump and tail up (the drake's white under-tail and black curl), orange feet kicking behind, rings spreading where its head went in. Before, the feeding duck was the swimming one with its head left off, which hardly showed from above.
- **Size buttons for smart areas.** After a smart click, box or cut, **Size: 1 Small · 2 Middle · 3 Large** shows at the bottom right of the map with the size in use highlighted. Click one, or press 1, 2 or 3 as before. It hides when there is nothing to resize.
- **Smart selection keeps to the clicked colours.** With **Same colours** on (the default, next to the Floor picker), a smart click leaves out what stands on the floor in another colour, such as green chairs on grey stone or a red rug, as holes in the area. The floor's own light and dark patches stay. Turn it off for a floor of many colours.
- **Right-click cuts out a bridge.** A right-click could only take out a part under a quarter of the area, so a stone bridge across a small pool answered "Nothing there to take out". A bigger part that plainly differs in colour from the rest of the area can now be cut, up to nine tenths of it. Where the model sees the bridge and the pool as one thing, the right-click cuts the part of the area in the clicked colours instead.
- **Smart selection shows when it is working.** After a click, a right-click or a box, a spinning ring sits on the map where you clicked, saying "Finding the area…" (or "Finding the part to take out…"), and the cursor shows busy, until the area appears. Before, the second the model takes looked like nothing had happened.
- **Floor regions learn from your regions and mark areas by themselves.** Once you have saved some floor regions, opening the window, or **Mark areas** in the toolbar, marks the areas that look like them, of any floor, as ticked rows with their floor and look (texture, pattern, soft edge, Over water); each row says "learned". It cuts the map with the Smart model when that is already downloaded, else by colour. Untick or remove a wrong one before saving and it is remembered as not a region, so it is not marked next time. The **Floor** picker also starts on **Auto**: an area you click takes the floor of the saved regions it looks most like; when nothing looks alike yet, its row asks you to pick a floor (Auto never guesses water); with a floor picked, only that floor's look is learned. Every region you save, and the floor regions on each scene you open, teach it; it is kept in the world (the last 400). In testing on 44 GM-drawn regions from 16 adventure maps, guessing each from the other maps only, it was right 32 times, wrong 3 times, and left 9 to the GM.
- **Floor regions for every floor (experimental).** The water generator is now **Floor regions**. The automatic read still finds water, and your clicks can add stone, pebbles, wood, dirt, grass, sand, snow, ice, mud, glass, metal or lava.
  - **Choosing floors:** pick a floor from the **Floor** picker in the toolbar before clicking, or change an area's **Floor** afterwards. The water settings show only on water rows.
  - **Window layout:** areas are painted in their floor's colour and numbered as in the list. Each area is one compact row, and the Smart / Colour switch sits above the map. Your last floor and tool are remembered in this browser.
  - **Saved regions:** they keep their floor. Switching one away from water clears its water settings, and switching it to lava brings lava's steps.
  - **Older regions:** regions made by the old water generator still open and save.
- **Floor texture from the generator.** Choose whether the regions paint their floor's texture over the map: **Floor texture** at the bottom sets it for the ticked areas and for new ones, and each selected area can differ. Don't paint suits a map that is already painted; As the scene says follows the scene's setting. New regions also number on from the ones already on the scene, so a second save no longer makes another "Grass 1".
- **See the floor texture before saving.** Areas that will paint their floor show on the map exactly as the scene will paint them: the scene's own floor renderer draws them, lit as the scene is now, with their pattern, size and soft edge. For the first moment, while it draws, a quick tile preview stands in. A selected area that paints can choose its **Pattern** (the floor's texture styles) and its **Soft edge** (0 is a hard edge on the region's line); both are saved with the region.
- **Step and Over water in the generator.** A selected area can pick its **Step** (fresh, bloodied, burnt and so on: the same steps as the region's right-click menu) and, for a floor you can stand on, **Over water** for a deck, jetty or bridge. Both are saved with the region, and a saved region keeps its own step list.
- **No separate Dock kind.** A dock is Ground with **Over water** on. The region panel's kind row no longer lists Dock. A dock region shows as Ground, and its Built as, Posts and shadow settings appear under Ground while Over water is on. Docks you already made keep working unchanged.
- **Roof switch.** A region's **Air** section starts with **Roof**: on, it keeps the weather, the sun and the sky's light out, as indoors or in a cave. It adds Foundry's Suppress Weather behavior to the region, or switches one already there on and off, so you no longer need the region configuration for it. **Open to the sky** still lets the weather in through a hole.
- **Undo for every change.** Ctrl+Z, or the undo button in the toolbar, now undoes adding or removing an area and changing any setting (a tick, floor, water kind, texture, pattern or edge), not only shape edits. It also works right after picking from a drop-down, and it no longer reaches Foundry's own undo (which undid a token move instead) while you work in the window.
- **A redesigned floor regions window.** One toolbar holds the Smart / Colour switch, a **Floor** picker, undo and zoom. The help sits on the map. The list is quiet: each area is one line with its map number, name and status ("Saved · will update · Grass"), with saved regions grouped above new ones. Select an area to edit it below the list: its floor, water settings, floor texture, and Add to, Outline, Split, Tidy and Remove. The map shows the areas lightly, so the painting shows through, with numbered badges that match the list, and the selected area outlined. Areas of the same floor get different shades. The save button says how many regions are new and how many are updated, and the help line is shorter, with the full text in its tooltip.
- **What you take out stays out.** A bush, spot or finger taken out of an area is left out of every later selection of the same floor, so the next grass area you select no longer picks it back up. Another floor can still take it. Click right on a part you took out to put just that part back; the others stay out.
- **Split off part of an area.** Select the area, choose **Split** and drag a loop around part of that area, such as the waterfall in a river. It becomes its own area with the same floor and settings, so you can give it its own water kind.
- **A bigger floor regions window.** It opens at most of the screen, with the floors, tools and zoom in one bar and the help in one line, so the map gets the room.
- **Smart selection asks once.** Agreeing to the model download is remembered in this browser, and a model already in its cache is not asked about again.
- **A sharp map in the floor regions window.** The map is shown at up to 4096 pixels and drawn at screen resolution, so it stays crisp when you zoom in, and outlines and numbers keep one size on screen. It sharpens a moment after the window opens.
- **Remove stray spots and fingers.** Right-click a small separate piece of an area, or a thin finger of it poking into a bush, to remove it, with either tool. A right-click on a bush the area only partly covers takes out just the covered part. Or select the area and choose **Tidy** to remove all the small pieces at once, or **Remove all small spots** at the bottom of the window to clean every area in one go. Ctrl+Z undoes the last change to the areas.
- **Middle-drag pans the floor regions map.** Hold the middle mouse button and drag to move around the map in any mode, even while editing an outline.
- **Combine ticked areas.** Tick two or more areas and choose **Combine ticked** to merge them into one region. It keeps the largest area's floor and settings, or the saved region's. Undo splits them again.

- **Smart selection in the water generator (experimental).** Switch to **Smart** in the Floor regions window to trace areas with SAM 2.1 large, a segmentation model that runs in your browser.
  - **Marking:** click an area, **Shift+drag** a box around a room or pond, right-click a bush or rock inside any area to cut it out (the hole stays), and press **1**, **2** or **3** to change the size of the last area or cut.
  - **The download:** the first time, it asks before downloading about 456 MB, and the browser keeps the model afterwards. The map is read on your computer and is not sent anywhere.
  - **Colour selection** still works as before and stays the default.

## 3.8.12

- **Much faster first load for players.** The animation catalogs (about 58 MB of data in a PF2e world) no longer download and load with the module. Each catalog loads a moment after the scene has drawn, and only if it is turned on. Every catalog loads when the Animater window opens. The SF2e catalogs stay out of a PF2e world unless crossover is on, and a catalog that is off never loads for players. In the first second or two after joining, the catalogs play nothing until they are in.
- **Rivers keep their fish.** Where a river runs off the edge of the map, fish wandering near it swim off, and each was made good only one every one to two minutes, so the river slowly emptied (five down to one in a few minutes). One that leaves is now replaced within seconds, and one a heron catches within half a minute.
- **The Animals panel's numbers stay current.** While it is open, the rows left on Auto and the count at the top follow the animals as they come and go, every two seconds, instead of keeping the numbers from when it opened.

## 3.8.11

- **Animal counts left Scene configuration.** Its drop-downs (None, Few, Usual, More, Many) could not show an exact count set in the Animals panel: Frogs set to 1 showed None, and saving Scene configuration wrote None over it. How many of each animal and how big are now set only in the Animals panel.
- **The fox stops to look round.** With no rabbit about, a fox now and then stops, ears up, and looks about for a few seconds before trotting on. Before, it never stood still unless it was hunting, so its look-about pose never showed. Every other animal's idles (pecking, grazing, washing, puffing, tipping up, sniffing and the rest) were checked and do play.
- **Startled farm animals run a few seconds.** A cow, goat, sheep, pig or horse sent running kept the rest of its grazing time as its run, so it could gallop off for up to about 13 seconds; it now runs two to four.
- **No shadow under the water or the earth.** A creature swimming below the surface, or burrowing, cast its ground shadow on the water above it as if it stood there.
- **Diving and surfacing splash.** Going under the water and coming back up each play a splash, heard as the creature crosses the surface (the surfacing splash also shows, as before).
- **Swimmers walk out of the water.** A creature set to Swim whose move leaves the water (onto land, a bridge or ice) swims to the edge and walks from there, as it crosses, and one under the surface comes up at the edge first. A move made by other means that ends off the water switches once it stops. Animater settings → Movement → Swimmers walk out of the water turns it off.
- **Frogs leap in from further off.** A frog on a lily pad with no water within about a square of it (a pad by the bank, or where the map's water has drawn back) sat still as creatures walked right past. It now leaps for the nearest water up to two and a half squares away, away from whoever came close.

## 3.8.10

- **Each fire sounds like itself.** The four fires nearest you now each play their own loop: each keeps its own recording of its kind and its own pitch, a few percent higher or lower, and starts its loop at a place of its own, so a hall of torches is several torches crackling out of step instead of one. Before, every fire of a kind in a scene shared one loop.

## 3.8.9

- **Fires have sounds.** Fire lights crackle close by, each by its kind: Ambient Light configuration → Animater → Fire now offers Torch, Lantern (quieter), Brazier, Campfire and the new **Cooking pot**, which bubbles over a small fire. Torches and lanterns creatures hold crackle too. Each fades within a few squares and is quieter through a wall. The light's **Sound** button turns one off, or on for any light; the **Fire sounds** setting and its Fire volume are under the settings' sounds. Fourteen CC0 recordings, one per kind picked for each scene.

## 3.8.8

- **Ponds lap quietly; only swamps play the swamp.** Since 3.8.7 every still water region played a swamp's insects and mud. Now a pond plays soft lapping water, like a quiet lake shore, and only still water whose Texture style is Swamp plays the swamp.

## 3.8.7

- **Reset a catalog.** Each catalog page has a **Reset catalog…** button in its header (GM) that puts that catalog back to the stock catalog: picked, left-out and customised entries cleared, look and sound choices back to their defaults, and the recipes Customize made for its entries deleted. It asks first, naming those recipes and marking the ones you edited. A copy of what it deletes is kept in the world, and **Restore last reset…** beside it puts the catalog back as it was; the same backup downloads as a file that the Recipes page's Import takes back. The catalog stays on or paused as it was unless you also ask for its fresh-install state; your own recipes, the starters and other catalogs' are kept.
- **Reset to defaults.** The Animater settings window has a **Reset to defaults…** button in its footer and a **Reset this tab** button on each tab. It asks first (a GM picks the world settings, this screen's or both), downloads a backup of the values it changes, and leaves menus, catalogs, recipes and the switch that plays them alone.
- **Ponds and still water have a sound.** A water region set to Still (not the sea) now plays a quiet swamp loop near it, as rivers do; Region configuration → Animater → Region sound Off silences one. Two CC0 recordings, one picked per scene.
- **Sparks have their own switch.** Ambient Light configuration → Animater → Sparks turns a light's sparks and embers on or off apart from its heat haze. Before, only the Heat haze choice decided them, and turning heat haze off on a fire also stopped it counting as a fire for its flame, moths and soot.
- **Buttons instead of drop-downs on lights.** The Animater section of Ambient Light configuration shows its choices (flame, fire kind, size, moths, soot, smoke, heat haze, sparks, chimney) as rows of buttons, and the light previews each click at once.
- **The scene's outer walls no longer make every room sound closed.** Room echo treats walls along the scene's edge as open, so an outdoor map fenced by boundary walls sounds outdoors.

## 3.8.6

- **Outdoor life and Town life left Scene configuration.** The Animals panel now switches each scene's animals. **Outdoor life on this scene** is its On/Off, and the town's pigeons, hens, cats and dogs come when given a count under **Town**, without Outdoor life on. A scene that had Town life set turns it into those counts the first time the GM opens it, and any counts already set stay as they were.
- **The Tokenshade preview no longer crashes on token art from another site.** On The Forge, or with a token picture given as an https:// link, the workspace's Tokenshade preview broke the canvas with a cross-origin WebGL error. The picture is now loaded with that site's leave, as Foundry's canvas does, and where a site will not share it the preview shows its stand-in figure. Effects on tokens on the map were never affected.

## 3.8.5

- **Season colours can be turned off for a scene.** Scene configuration → Animater → Season colours on the ground: Off keeps a map as painted. With a scene's floor on Grass, the season's colour covered the whole map, its painted paths and trees too.
- **The hawk's shadow shows again, and high birds' shadows are easier to see.** A hawk circling high cast a shadow at about one hundredth of full strength, and the painted birds' soft shadows copied only a corner of the picture. High birds (the hawk, crows, gulls, herons) now cast a soft shadow as dark as the light makes it, landing further off the higher they fly.

## 3.8.4

- **Kill-cam length, with a Preview.** The slow-motion kill-cam now lasts 2.5 seconds by default (it was 1.2) and the GM sets it from 1 to 5 seconds (Animater settings → Motion → Kill-cam length). A longer one also plays the effects slower. The Preview button plays it on your screen, on your selected token or the middle of your view.
- **Fewer animal settings.** Birds, rabbits and fish, Fireflies, Dawn chorus and Bodies draw flies and crows no longer have a switch for the whole table: each scene's Outdoor life and Animals panel decide. Each keeps one switch for your own screen, and their descriptions are shorter.

## 3.8.3

- **The Animals panel says why no animals show.** With Outdoor life on and nothing appearing, it now names the cause: Animals in the wild off in the settings, this screen's quality at Low or Off, a scene floor animals don't live on (they need grass, dirt, snow, mud or sand; set Floor in Scene configuration → Animater), or a map all under roofs or walled in.

## 3.8.2

- **River and other looping sounds no longer pulse.** A river, the surf, a waterfall, a pool, the night or the weather could throb two or three times a second after being placed or as a scene loaded, sounding as if it kept restarting. Each now changes volume smoothly, from where it was, only when the change can be heard.

## 3.8.1

- **River sounds no longer restart while a river is placed or a scene loads.** A river's, the surf's or a waterfall's loop that dipped to silence for a moment was stopped and started again from its beginning, so for the first half minute or so it could restart over and over. It now fades out and keeps going, stopping only after several seconds of real silence; and a river goes quiet for ice only once it is frozen over.

## 3.8.0

- **Painted animals.** Every animal Animater draws (town, wildlife, field, pond, farm, rats and bats, and the crows and vultures that come down to the fallen) is now drawn in the battlemaps' own painted look: inked outlines, shading in a few painted steps, muted colours, real coats and markings that stay put as they move. Each keeps everything it did before: how it walks, grazes, flees and flocks, its size, its sounds and its shadow. Dragonflies, flying ducks and herons are painted too, and fish seen through moving water now show as the painted fish, tinted by the water, instead of a dark shape.
- **Animals lit where they stand.** They are shaded by the light that is really on them: the sun from where it stands in the sky through the day, the moon at night, and each lamp and torch near them from its own side. Their shadows now stretch out from their feet away from the light, longer as the sun gets low, and away from the nearest lamp at night.
- **Sharp on fine grids.** The animals' pictures are drawn finer, so they stay crisp on maps with large grid squares and when zoomed in.
- **Count every animal.** The Animals panel and the region panel give each kind a number. In the Animals panel, − and + set exactly how many; left on Auto (or after Quiet, Usual or Lively) each row shows how many the scene has right now, worked out from the map as before. In the region panel each card shows its count: click for one more, right-click for one fewer. Regions set before keep their animals.
- **More animals to choose.** Crows, hawks, herons and gulls each have their own row, in the Animals panel and in a region's animals; Water birds are now called Ducks. The scene's Animals panel also has the town's animals (pigeons, hens, cats, dogs) and farm animals (cows, goats, sheep, pigs, horses), none until chosen, without turning on Town life.
- **Birds go between trees and roofs.** Besides the flocks, single crows, songbirds and pigeons now fly off on their own, land on a roof's ridge or eaves, sit and peck, then fly on to another roof or back into the trees.
- **Sparrows hop.** A songbird on the ground hops over a moment, now and then two or three hops in a row, instead of jumping to its next spot at once.
- **Sunlight through the trees.** The light coming through a tree's canopy is soft dappled patches of varied shape, brighter where the leaves are thin and moving with the wind, shaped to the kind of tree (broadleaf, pine, palm, birch, bare, willow), in place of the round pale spots.
- **More animal sounds.** Deer, squirrels, snakes, herons and crabs have calls of their own (CC0 recordings).
- **Over water, said plainly.** A region's Ground and Dock sections have an Over water switch: on, the region is a deck, jetty or bridge built over water (the same as choosing Dock); off, it is ground again. Its floor is kept either way.
- **The region panel's animals open and work.** Changing a region's animals brings them in at once; town animals use the region's own numbers; raised regions are tested at their own floor; animals stand on any dry floor in their region, under roofs too. The panel has a button to open Foundry's own region window, and the region's outline shows while the panel is open.
- **Weather sounds volume per player.** Each player can set how loud the weather's sounds are on their own screen.
- **Energy Blast editor picks from the asset browser.** A blast's animation is chosen in Animater's asset browser, with Choose and Change buttons.
- **Lava glow stays under tiles and tokens.** The glow of lava no longer shows through tiles and tokens over it.
- **One right-click panel for every region setting.** The GM right-clicks any region on the map (on the Tokens or Regions layer) and a panel opens by the pointer with all of its Animater settings. First you say what the region is (Water, Ground, Indoors, Cave, Dock or Lava), then come only the sections that kind uses, each folded to a one-line summary until opened: its water or floor, steps, animals, air, look, drips. Anything a region already uses always shows, and the rest wait under More sections, so no setting is out of reach. Where regions overlap, each gets a tab. Every change is saved at once. It replaces the Animater tab in the region window (which now only points to the panel and opens it) and the old right-click step menu; Cave-in stays on the Animater controls.
- **Animals' size is a slider.** A region's animals can be any size from half to twice the usual, in place of the old small, usual and big; regions set before keep their size.
- **All water is moving water.** Every water region on every scene now moves, flows and waves; the scene's Moving water option and the region's switch to turn it off are gone. The old still look of water is kept only where moving water is not drawn: at Low quality, or with the Moving water setting off.
- **Edit water outlines in the preview.** Move, insert, and delete polygon vertices, including holes. Smooth outer shores explicitly within two read pixels per action. Invalid geometry stays unchanged. Undo restores up to 20 edits and additions without resetting current save selections or water settings.

- **Edit water without replacing other regions.** Reopening loads saved generator regions. Save updates only the edited, ticked regions by ID and creates new regions alongside them. Names, behaviors, steps, unrelated settings, and all other regions stay.

- **Add water to an existing draft.** Extend a chosen area with shoreline clicks or click existing pieces into that region. Checkboxes only choose which areas to save. Its water settings stay, and the last addition can be undone.

- **Water review window.** Separate map and area panels, zoom and pan controls, live selection counts, and a confirmation of how many regions were created.

- **Experimental: detect water regions.** Off until you turn it on in the Floor & world tab of Animater settings. The Animater controls can propose blue and teal water from this level's map. Review the pieces, choose a water kind and its flow or sea settings, then create them. Reruns load saved regions limited to this level for editing. Untouched regions stay unchanged. Hand-drawn, shared, and all-level regions stay.
- **Click the water it missed.** The preview opens even when automatic detection finds nothing. Click water of any colour to add a selected piece. Narrow colour selection is the default. Wide follows more connected shades but can also include similarly coloured land. Contrasting floating objects stay as holes. Remove any incorrect piece before saving.
- **What it leaves alone.** A saturated roof larger than the water can still fool the automatic read, so untick it and click the water instead. A lone pool under about a quarter of a percent of the map needs a click too. A video or SVG background, or a level background moved, scaled or rotated in its configuration, cannot be read, and it says so.

## 3.7.6

- **Your own Energy Blasts.** The Energy Blast picker lists blasts of your own after the ten kinds, each in its colours; a GM makes one with New blast and changes or deletes them with Edit mine. Each is built on a kind (how it moves, what it leaves on the floor) with its own name, main and highlight colours (recolouring all of it, fire's flames and smoke too), size, what it does to the creatures it catches (as its kind, nothing, burn, frost, shock, shove, tremble, or any Tokenshade preset), its sound (as any kind, silent, or a file from Foundry's file picker, starting in Animater's own sounds), its shake and whether it melts snow. Kept for the world; a fired blast carries its whole look, so every screen draws it alike.
- **Heroic resources as ready recipes.** Each system's heroic looks come as starter recipes: Heroic Inspiration gained and spent, Hero and Mythic Points, Hope, Victory. Left as they come they are the glow itself, each screen keeping its own switch; change one and yours plays instead. Worlds made before this get them once, when the GM next loads.
- **Weather from the date.** Simple Calendar Reborn (or Foundry's own clock) has no weather of its own: the Weather panel now offers a climate (temperate, cold, dry or tropical) and Animater makes the weather from the date and season, changing every six hours, the same on every screen with nothing saved. The coming week shows under it, by night, morning, afternoon and evening. Calendaria's weather is used as before when it is on, and a scene's own weather still comes first.
- **Cloud height per map.** A Cloud height slider under Cloud cover in the Weather panel, from Low (as before) to High: higher clouds are bigger and fewer, their shadows falling a little further off, so a town at 5 ft squares gets clouds over whole blocks instead of puffs over its roofs.
- **Reflections in every water nearby.** A creature shows a copy into each water it reaches, below, above or to the side, so on a bridge both sides show it; each grows and fades with its distance and eases in and out instead of jumping from one bank to the other, and keeps up with a token as it glides. Wading in open water shows only the copy below. Regions set to Stands over water (docks, bridges) show no reflection on their decks, and a creature on one is not wading.
- **Shadows lie the way reflections do.** In sunlight, moonlight, lamplight and window light, a standing creature's shadow lies with its head away from the light and its sides where they are on the map, as its reflection does, instead of keeping the art upright whichever way the light threw it. Fliers keep the art as drawn from above.
- **Blast reactions fit the creature.** The flames, frost and dark haze of an Energy Blast on a creature are sized by its squares, not by its art scaled up, so a one-square token with big art no longer burns several squares high.
- **Smoother on Macs.** On Apple GPUs (Metal), batched drawing now gets its own vertex buffers, which lifts the frame rate. Thanks to camrun91 for the fix.

## 3.7.5

- **Squirrels and snakes stay on the map.** A squirrel bolting from a creature with no tree to run to, or a snake fleeing, could run off the edge of the map into the padding around it. They now stop at the map's edge.

## 3.7.4

- **Only swimmers bob.** A creature standing in a water region bobbed on the swell whatever its movement type. Now only one set to swim does; one standing or wading in the water holds still.

## 3.7.3

- **Shadows in a window's lamplight.** A creature standing in a lit window's light outside now throws its shadow from the lamp. The light now fans out from the lamp through the window, off to one side when the lamp is, so its panes radiate from the lamp too and whoever stands in it sees the lamp. One standing at the light's very edge, the window's end between it and the lamp, still throws its shadow; it was dropped before, and with creature-shaped shadows on nothing was left. Curtains and frosted glass still spread their light evenly.

## 3.7.2

- **Only a full moon lightens the night.** With Darkness follows the sun, the moon kept every night a little lighter by how much of it was lit, so even a half moon stopped the scene short of full dark. Now only a full moon high in a clear sky does (about a day either side of it); otherwise the night goes fully dark, and the moon's silver tint is left at full strength.

## 3.7.1

- **Full tree shade on tiles of several bushes.** A tree tile holding a few thick bushes with open ground between them was taken for one thin, gappy crown, so its shade came out about half as dark. Its leaves are now judged by the bushes themselves, not the open ground round them. Leaves and Tree type set in Tile configuration still decide.
- **Darkness follows the sun.** A new setting, off by default, under Sunrise and sunset colour. The active scene's Darkness Level then follows how far the sun is under the horizon, as real twilight does: a little dark at sunset, about half dark half an hour later, fully dark an hour and a half after sunset until dawn's first light. Calendaria's darkness by the time of day only reached full dark at the very middle of the night (around 23:30 to midnight in midsummer); it is turned off while this is on. Foundry's lighting, vision and the game's light rules follow it. Scenes under the ground, scenes with their darkness locked and scenes where Calendaria was told to leave the darkness alone are left as they are, and a storm still darkens it further. With Moonlight on, a bright moon high in a clear sky keeps the night a little lighter (at most a fifth), and its silver tint is lessened to match, so the moon isn't counted twice.
- **Lamplight carries the window out.** A lit room's light spilling out of a window at night now carries that window's pattern onto the ground outside, as sunlight does coming in: stained glass and rose windows their coloured panes (taken by the lamp's colour), leaded windows their diamond net, glass its frame's cross, lattices and bars their lines. Frosted glass only spreads it, and a window or door thrown open lets it out whole.

## 3.7.0

- **Cavern floors you can adjust.** Right-click a fungus, crystal or mist region for a popup, as on a floor: which it is, its colour or stone, Size, Amount and three stages (Dormant, Growing, In bloom; Dim, Awake, Blazing; Thin, Low, Thick). Regions you've already made look as they did.
- **Cavern is a real floor type.** Pick Cavern in a region's Animater floor (it starts as lava) or Lava in the popup: it walks as a floor, with embers underfoot, and has its own steps, Crust, Cracking and Molten, so a chamber can fill or cool. Crust walks as stone. It uses stone's footstep sounds for now. Regions already set to lava become lava floors.
- **Mist stays when you change scene or level.** It was gathering again from nothing each time, which left the room clear for a long while. It's now there as soon as the map opens.
- **Clouds line up with their shadows.** Cloud shadows and drawn clouds were two separate skies, so turning on drawn clouds swapped the shadows for new ones elsewhere. Now there's one sky: the shadows come from the same clouds, and drawing them fades the clouds in right over the shadows already showing. Cloud shadows on a map with no drawn clouds now look like separate clouds' shadows instead of a broken deck, and they're darker, closer to real ones under a bright sun.
- **Soft edges at rooms.** Rain, snow, clouds, cloud shadows and the sun's own light and shade used to stop at a room's edge in a hard line, which looked like a dark box over the floor. They now fade in over half a square. A new Edge softness slider in Region configuration (Weather and climate) sets it per room, and 0 brings back the hard line.
- **Darker token shadows in the sun.** A standing token's shadow is now about as dark as a real one on a painted map, a little over half dark in full sun. It stays that dark however long it gets, instead of fading in the evening, and stays sharper, softening only a little as it lengthens. Clouds, dusk and wall shade still lighten it.
- **Sunlight through holes in roofs.** A region marked Open to the sky inside a room now lets the sun in: the floor under it is lit and warm, creatures there cast sun shadows, and a passing cloud darkens it. Its edge fades as far as its Edge softness says, instead of a hard dark box when a cloud's shadow fell through.
- **Tree shade by kind of tree.** A tree tile now throws the shade of its kind: a broadleaf's heavy clumps with its branches in the gaps, a pine's whorls of needles, a palm's combed fronds, a birch's light lace, a bare tree's branches, or a willow's trailing strands, with the sun's round spots coming through the gaps. It's darker than before, up to 80% under a pine. Pick it in Tile configuration (Animater → Tree type); Auto goes by the tile's name, else a broadleaf.
- **Sunlight through windows, at sunset most of all.** Shut glass now prints its frame's cross in the patch of light on the floor, and slatted shutters the bar where they meet across their slats' bands; any window thrown open lets the light in whole. The patch stops at the far wall, and the rest of the light shows as a bright band along that wall's foot. Each sunlit window glows softly, and as the sun goes down the room dims, so the light through its windows blazes deep gold, then orange-pink. A creature standing in that light casts its sun shadow there, away from the window. Doorways and curtains stay as they were.
- **More kinds of window.** A wall's Animater window can now be mosaic or stained glass, leaded diamonds, a rose window, or frosted glass or oiled paper, all opening and closing like glass, or a wooden lattice, iron bars or an arrow slit, always open. Each prints its own sunlight on the floor: coloured panes, a fine net, small squares, stripes, a thin blade, or a soft glow. Frosted glass lets light in but nothing is seen through it. A Pattern size slider on each window, and on a roof opening's window, makes its panes finer or larger.
- **Light through roof openings stays in its room.** As the sun gets low, the pool of light from an opening slides away from it, but it now stops at the wall instead of showing through into the next room, and the warm sunlit floor stops with it.
- **Windows in roof openings.** A region marked Open to the sky can now hold a window (Region configuration → Window in it): a glass skylight, coloured glass, leaded diamonds, a rose window or frosted glass keep the rain and snow out while the sun comes through in their pattern, coloured where the glass is; a wooden lattice or an iron grate let the weather in too.
- **Sunlight's colour through the day.** The sun's light now warms gradually as it goes down: near white high up, soft yellow in the afternoon, golden lower, deep orange-red at sunset and a fading crimson as it slips under, instead of staying white until the last moment. A winter sun, never climbing as high, stays a little yellow even at noon. Windows, roof openings and the open ground all share it, and the open ground now takes it with a fixed sun too, not only one following the clock.
- **Color the scene as the time of day.** A new setting, on by default. Turn it off if you prefer a calendar module's own scene ambience, such as Calendaria's: Animater then leaves its "Sync Scene Ambience" settings as you set them and its sunrise and sunset colour steps aside. On, Animater still turns them off so the map isn't coloured twice, now also when the Weather one is turned back on mid-session.
- **Tail drags fit the creature.** A dragon's or lizard's tail line in snow, mud and sand is now as broad as the creature is big, not the same thin line for all, and it curves smoothly through a turn instead of breaking into sharp corners.
- **Energy blasts touch the creatures.** Creatures caught in a blast now react: fire sets them alight a while, cold rimes them with frost, lightning crackles round them, force and sonic throw them back, void and psychic make them tremble. How long is a setting (5 seconds by default), and a GM can have force and sonic blasts really push tokens half a square away, never through a wall. Still a show only: no one is hurt. Each reaction is drawn to look real: flames licking up from the creature, a furry hoarfrost rim, branching violet arcs, and for the void a dark haze while the creature's own art warps.
- **Cold blasts leave real frost.** The ground a cold blast freezes now looks like hoarfrost: grey-white grains with the floor still showing, a broken edge where the frost only holds on the high spots, thin frost feathers reaching out, and at the middle a glazed sheet of ice with white cracks through it, glinting here and there.
- **Energy blasts sound the part.** With a sound pack installed (GGG, PSFX or Sound FX Library), every blast plays a real spell hit layered with a second sound: lightning like Chain Lightning (a thunder crash and a leaping strike), cold a frost nova with ice cracking, fire a fireball going off, acid a splash eating in, force a gravity blast with a shockwave slam, sonic a shockwave with a boom of thunder, void an abyssal pulse, radiant a flare of holy light, poison a venomous hit, psychic a confusing pulse. Without a pack, they keep their own sounds.
- **More spiders in big webs.** There was only ever one spider, however much web a map had. Now there's about one to every three webs, up to eight.
- **Rain puddle and splash size per map.** While it rains, the Weather panel has a size slider for each, down to none. Smaller puddles stay apart: handy on town maps with painted buildings, where a big puddle can run across the roofs. Every map stays as it was until you change it.
- **Animals panel.** It only offers what can live on the scene: rats, bats, moths and crawlers on underground scenes, open-ground and placed animals everywhere else, and water animals only on maps with water.
- **Clouds and the sun.** Moving the sun no longer turns the drawn clouds: it moves across them, lighting whichever side faces it. A clear sky now has no drawn clouds, and partly cloudy a few, unless Cloud cover asks for more. Clouds no longer show indoors; their shadows and high birds' fall through regions marked Open to the sky, underground too.
- **Weather and animals per level.** In a scene with levels, the Weather and Animals panels can set this level or the whole scene.
- **Underground per level.** Each level of a scene can now be underground or above ground on its own, in its level settings: a cellar under a farmyard, or an upper floor over a dungeon. Left alone, a level goes by its scene as before.
- **Ducks and walls.** A duck in the air now clears a wall instead of sticking against it.
- **Squirrels and trunks.** Walls drawn round a tree's trunk no longer stop a frightened squirrel going up its tree.
- **Window icon hover.** A window's control gets an outline under the pointer, as a door's does.
- **Glowing fungus under tokens.** Its glow no longer shows over a creature standing on it, and it no longer flashes while they stand there: it stays dim, and brightens again once they have gone.
- **Weather eases from one to the next.** Rain coming on or a storm breaking now ramps over a set time (10 seconds by default, "Weather changes take" in the settings), with what falls, the clouds, the fog and the light moving across together.
- **Weather across all scenes.** A second Weather button sets the weather for every scene at once. A scene's own weather, sliders, direction or No weather still come first, so a map can opt out.
- **Weather and climate per region.** A region can have its own weather (mist in a hollow, snow on one peak) and its own climate, so breath shows only in a cold cave.
- **No shadows on a map.** A new Sun option in Scene configuration turns off the sun's shadows while keeping its light.
- **Swimmers bob.** Creatures in the water ride a gentle swell, as fliers hover.
- **Birds fly higher.** Their shadows now land further away, softer and fainter. A new Bird height slider in the Animals panel sets how high for each map: higher, birds look bigger and their shadows wider, softer and fainter still.
- **Windows.** New curtains let only a dim light through until opened. Windows can be set so creatures pass through when fully open. "Window icons" can make their controls faint or hide them until a creature is near or the pointer is over one. With the Arms Reach module, windows follow its reach.
- **Blood on portraits.** A new setting, off by default, shows a hurt creature's blood on its character sheet picture and in the Image Hover module.

## 3.6.2 (2026-11-07)

- **Drawn clouds actually cross the map.** They were scattered over a wide area beyond the map's edges, so a small map hardly saw any, and they drew over the padding around it. They now stay close to the map, in numbers that suit its size, and stop at its edge.
- **Less blinking as the game's clock ticks.** Every tick was taken as a setting changed, so the tree light, lamps, floor looks and wildlife were built again each game minute, with sunlight flecks, falling leaves and window dust jumping back to their start. They now carry on smoothly, and a heat wave's shimmer no longer blinks.

## 3.6.1 (2026-11-07)

- **Clouds with real volume, lit by the sun.** Drawn clouds now read as solid forms, with a bright side toward the sun and a connected shaded side, billows gathered in places and soft, wispy edges, in a wider mix of sizes. The sun recolours them through the day, white at noon, gold when it is low, glowing at sunset and blue by moonlight, and they dim with the scene's darkness.

## 3.6.0 (2026-11-07)

- **Drawn clouds.** A new Drawn clouds effect in the Weather panel puts real clouds over the map, each with its own shadow, above the rain and the roofs. Cloud cover says how many, from a few fair clouds to a closed, rolling overcast, and a Cloud transparency slider sets how much of the map shows through. Off unless the GM turns it on for a scene.
- **Cloud shadows drift smoothly, and puddles stop blinking.** Every tick of the game clock rebuilt the sky, which threw the clouds back to where they started and redrew the puddles. Now it's only rebuilt when the map itself changes, and the clouds carry on from where they are when it is, or when the wind changes.
- **New footprints for every creature.** Redrawn from how real tracks look: long-toed talons, heavy clawed dragon feet, slender five-toed lizards, dog and cat paws, round horse hooves and cloven ones, soled boots, and more. Cats and cloven animals are recognised by name.
- **Tracks that look walked.** Every step now turns its own way, lands a little off, presses in deeper or shallower and varies slightly in size. Left and right feet are mirrored, and every player sees the same tracks. Prints in sand are now pressed in like those in snow and mud.
- **Tokenshade auras can be customized.** With Aura style set to Tokenshade, Customize now opens the aura as Tokenshade, with its pattern and colour ready to change, instead of its JB2A clip. Any customized aura can switch with its new Area look choice, and customized auras you already have keep their JB2A look until you switch them.
- **Dragon tread, properly this time.** On snow and mud, a tail's drag was drawn as a giant claw print at every stride, the real cause of the "three feet". It's a thin line again. Reptile claws had the same problem, and slither and ooze trails on those floors no longer turn into prints either.

## 3.5.2 (2026-11-07)

- **NPC breaths and other area abilities play with nobody in the area.** Dragon's Breath, Acid Breath, Cold Breath and others stopped dead when the template caught no one, because the creature's lunge had no one to aim at. It now lunges toward the area.
- **Fewer false alarms in History.** Using something that places an area no longer also logs "No animation is set" when the area's own animation plays.

## 3.5.1 (2026-11-07)

- **Dragon tread leaves clean tracks.** Large creatures left clumps that read as three feet, packed close together. It's now one clear print at a time, left then right, spaced for the creature's size.
- **Blood stays on its own level.** Stains now show only on the level where they fell, and Bake blood leaves other levels' blood alone. Blood saved in a scene before this update has no level, so it still shows on all of them until cleared.
- **Area animations no longer play under raised tokens.** A breath or other area spell from a flying or elevated creature now draws at that creature's height instead of on the ground beneath it.

## 3.5.0 (2026-11-06)

### New

- **Waves that break like real ones.** On a small sea, or any sea with Waves toward set, each breaking wave now has a sharp bright front, thick foam behind it that ages into lace with holes in it and streaks the way it runs, a dark band ahead of the crest and pale water behind. Fronts wander and join, and break on a shore that lies ahead of them. It all goes by the wind, as on the Beaufort scale: only ripples and a lip of foam on the shore in a light air, a wave every 2.5 seconds or so, up to sheets of foam and a wave every 8 seconds in a gale, with longer swells to match. However light the air, fine ripples, soft bands and drifting gusts show which way it is moving.
- **Turn off all of Animater's sounds.** A new All Animater sounds setting, at the top of the Sound tab, silences everything the module plays: for the whole table, or for one player on their own screen. Sounds already playing stop, and your other sound settings stay as they are for when you turn it back on. Sound from the game and other modules isn't touched, and clicking a sound to preview it in Animater's windows still plays it.
- **A calm sea sounds calm.** Seas have a new gentle wash for light winds, fading across to the surf as the wind rises. Recording: "Calm Sea" by clement.bernardeau (CC0).
- **Clear turquoise water.** Depth has a new choice, Clear turquoise: water in its own colours instead of the map's, pale turquoise over the shallows to deep blue offshore.

### Fixed

- Waves on a sea now come from one side. On a small sea, or any sea with Waves toward set, surf and foam used to start in the middle of the water and spread out to every shore, which looked as if a dock in the middle was splitting it. They now cross at a steady pace the way the waves are heading, and the shore they left stays calm.
- A wolf walks up to the deer it has brought down before hauling it off, and holds it by its mouth at any animal size, instead of pulling it along from a distance.
- Right-clicking a window or door icon is about that icon, even with a region under it: the region's menu no longer opens over it.
- Bats round lamps out of doors take their size from the Bats slider, not the Owls one.

## 3.4.1 (2026-11-06)

### New

- **A size slider for every animal.** In the Animals panel and Scene configuration, each animal now has a slider from 10% to 300% of its usual size, in place of Small, Big and Huge. Scenes that already chose one of those keep the same size. A new All animals on this map slider multiplies them all, for a map drawn at a different scale. Frogs' lily pads shrink and grow with them.

## 3.4.0 (2026-11-06)

### New

- **The immersion popup no longer opens for players.** Maps are the GM's to set, so Choose your immersion now only opens by itself for the GM. A new setting, Ask players to choose their immersion, brings it back for players, leaving out any features you have locked for them with BBMM. Players can still open it from their Animater settings at any time.
- Hard edges meet their line: with Soft edge off, a painted floor reaches the region's own edge, and water runs a little way under a painted dock, so no strip of the map shows between them.
- **Docks built like real ones.** A wood, stone or metal floor that casts a shadow has a new Built as choice in its right-click menu. Plain, the default, is just the floor and its shadow. Old boards gives it edge boards, dark gaps between its planks, and thick posts rising past the deck with beam ends between them. Railed pier gives it slim posts, rails and a ladder of rail shadow. Both throw a clean shadow set apart from the deck, joined to it by the thin shadows of the posts, with the water showing between once it stands high enough. Posts have their own tick, so either can go without. Stone stands on square pillars with no beams, metal on thin struts, and posts ring the water they stand in.
- The shadow of anything over moving water is now a deeper blue with the waves still in it, instead of a flat dark.
- **Floors can cast shadows.** A new Casts a shadow box on a region with a floor throws a shadow on the ground, floors and moving water below it, away from the sun and longer as the sun gets low. On moving water it trembles with the waves, and the sun's glitter stops in it. The higher the region stands above what is below it, by their elevations, the longer the shadow. It is on by default for a region that Stands over water. Each floor has its own shadows to choose from: planks, slats and beams for wood; arches for stone; a grate for metal; coloured light, frosted and leaded for glass; faint and cracked for ice; dappled for grass and earth; with softness and darkness in the region's right-click menu.

## 3.3.3 (2026-11-06)

### Fixes

- Pattern size moves in steps of 5%, and can now be exactly 100%.
- Edge softness can be turned off, for a hard edge along the region's own line. Turn it back on and the softness you had returns.
- A sea no longer draws a ring inside its region. Without a beach, its waterline now runs along the region's edge rather than a rounded line within it, and narrow water, up to about a dozen squares across, has its shore and shallows drawn in to suit, so its middle no longer reads as shallows, with fewer wave fronts and little breaking surf. Wider seas with a beach look as they did.

### New

- **Overlapping regions in the right-click menu.** Where two or more regions with a floor overlap, the menu has a tab for each, whatever their height, so a dock over water and the water beneath it can both be reached from the same spot. It opens on the one it always did.
- **Stands over water.** A new box on a region, in its settings and its right-click menu, for a dock, a bridge or a raft: moving water and its waves run on underneath it, unbroken, instead of over it, and its own floor is what creatures walk on, whichever region is listed first. Give it an elevation and only a creature swimming below that is in the water; anyone else there is on it. Ducks, fish and other swimmers keep out from under it. Off by default. Set its floor too, or the water stays underfoot.

## 3.3.2 (2026-11-06)

### Fixes

- Water now keeps to its region. With a texture on its floor, moving water spilled past the region's edge and covered any hole cut in it, such as one left for a pier or boats; it now stops at the edge and leaves holes clear. Painted water that isn't moving no longer stops short of the edge, and narrow holes stay clear in every region look. Waves still run on as if under a narrow hole, cut off at its edge; a hole only makes a shore when it is several squares across.

## 3.3.1 (2026-11-06)

### Fixes

- A region's Keep out now has a box for each animal: Wolves, Squirrels and Snakes, and Crows, Hawk and Owl, are new; Water birds is now Ducks, Herons and Gulls; Insects is Butterflies, Dragonflies and Fireflies; Town animals is Pigeons, Hens, Cats and Dogs. Regions with an old box ticked keep working and show its animals ticked. Wolves used to go by the Foxes box, squirrels and snakes by Rabbits; those boxes no longer hold them back, so tick the new ones on any region that should keep them out.
- Snow melted by fire now comes back by the game clock instead of real time, taking as long as snow takes to lie in that weather. It only fills in while snow is still falling and it is cold enough to stay; if the weather has changed, the patch stays until snow falls again or the rest of the snow goes. Winding the clock back to before the blast brings the snow back at once.

### New

- **Wolves howl.** A wolf calls now and then, more by night, and a pack joins in; you hear them from a long way off, and when they come in from the edge of the map. They are silent while hunting, hauling or running. A wolf growls at anyone coming within five squares. They follow the Wildlife sounds setting.
- **Keep out all animals.** A region's Keep out has an All animals box, for a region no creature comes into, without ticking each one. Crows, the owl and the hawk pick a way round it; gulls stop fishing there but may still glide over.

## 3.3.0 (2026-11-06)

### Fixes

- Starter recipes no longer take over catalog animations. Fire nova played for Fireball, and turning it off stopped Fireball animating at all; the same went for Ember shot, Frost lance, Storm arc, Force volley, Mending light, Arcane ward, Arrow strike and Blade strike. A starter you haven't edited now only plays where nothing else would, and one you have edited still wins.
- D&D 5e: spells with no roll to wait for, like Dragon's Breath, now play when cast with nobody targeted, on the caster.
- D&D 5e: breath weapons and exhales from the catalog now draw breath first, with a sound pack that has an inhale.
- Searches survive switching tabs. In Animater settings, clicking a tab keeps your words and shows that tab's matches; typing again looks through every tab. On the Tokenshade page, the search stays as you move between Token, Region and your own presets.

### New

- **Animals panel.** A new Animals button in the Animater controls sets how many of each animal a scene has and how big, with Quiet, Usual and Lively for the outdoors at once. These are the same settings as Scene configuration, so either place changes both. Outdoor life on this scene is here too.
- **Squirrels.** They forage in quick bursts near trees and race under the leaves when anyone comes close, coming back out a while later. On maps whose trees are painted into the picture rather than drawn as tiles, they just bolt away. Set per scene and placeable by hand.
- **Snakes.** They lie still in the open, slide on a little now and then, and go off quickly if anyone comes within a couple of squares. They stay out of sight in the cold. Set per scene and placeable by hand. Keep-out regions for rabbits apply to squirrels and snakes too.
- **A balanced wild.** However many animals are asked for, a map only gets what its open ground has room for, so scenes no longer crowd. Animals you place by hand are extra.
- **New animals walk in.** A rabbit or deer that gets caught is replaced in a while by another coming in from the edge of the map, instead of appearing out of nowhere.
- **Wolves.** A pack that walks in from the edge of the map, keeps together behind its leader, trots about, lies up, and hunts deer: sometimes it brings one down, feeds, and hauls it off the map, coming back a good while later. Driven off a carcass, it comes back for it once things are quiet. It runs from people, noise and fires. Out by day and by night. None until you ask for them on a scene, in the Animals panel or Scene configuration. They have no sounds yet.
- **Put animals down by hand.** Pick a rabbit, bird, deer, fox or wolf and click the map, as many as you like. They are kept with the scene and start there on every screen; after that each wanders its own way on each screen. Take the last one of a kind away from the panel.
- **Fire melts snow.** An Energy blast of fire melts the lying snow where it lands, with an uneven edge. The snow creeps back over time. It is only a look, on every screen that sees it, and nothing is saved.
- **Your own heroic moments.** A new recipe trigger, Heroic resource, plays your animation when a character gains or spends one: Hero Points in PF2e and SF2e, Mythic Points in PF2e, Heroic Inspiration in D&D 5e, Hope in Daggerheart, Victories in Draw Steel. It plays in place of the usual glow.
- **Hope and Victory glow.** Daggerheart's Hope and Draw Steel's Victories now glow on the character's tokens as Hero Points do, each with its own setting.
- **What's active on this scene.** The top of the Weather panel now lists what is at work and where it comes from: the calendar's weather, the scene's own, what you set in the panel, storm darkness, and FXMaster's effects. Anything set in Animater can be turned off from its row; Calendaria's and FXMaster's stay theirs to change. The list keeps up as they change.

## 3.2.2 (2026-11-06)

### Fixes

- Window icons no longer have a box or border around them.

## 3.2.1 (2026-11-06)

### Fixes

- Seagulls keep to the sea. Rivers, lakes and ponds no longer get them, however wide they are.

### New

- **Storms can change the scene's darkness.** A new setting, off by default, makes a storm that shuts the sky raise the scene's real Darkness Level, easing in and going back when the storm ends, while still following the clock. Vision, PF2e light levels and PF2e Visioner then follow it. Storm darkness says how far, up to fully dark at 100%; past the scene's global light limit, creatures without darkvision or a light lose sight of the outdoors. Each scene can opt out.

## 3.2.0 (2026-11-06)

### New

- **New storm darkness engine.** When a storm shuts the sky altogether by day, the outdoors dims toward dusk. It is only a look: the scene's darkness and everyone's vision stay as they were.
  - **When:** a thunderstorm, a blizzard or another weather with a fully closed sky, or Cloud cover at full. Plain cloud and overcast only dull the day.
  - **How dark:** a Storm darkness setting and a Weather panel slider decide, a little darker in rain, and the map always stays readable. It fades away as real night comes on, so night is no darker for it.
  - **Lights cut through it:** lamps, torches and fires show up against the dark, as far as walls let their light go, and a lightning strike lifts it for a moment.
  - **Rooms spill light:** light from indoors comes out through open doors and windows as it does at night, only fainter, with creatures' shadows in it.
- **New window engine.** Three Window types on a wall, a Wooden window, Wooden shutters and Glass, open and close with a control on the map like a door's, and the light around them follows.
  - **Who can use them:** the GM, and players allowed to use doors who have a creature within reach. The GM's right click locks one shut, or unlocks it. They make no sound, and each icon shows its type and state.
  - **What they let through:** a shut wooden window stops light, sight and sound. Wooden shutters do too, then a click opens their slats so you can see out, and another opens the window. Shut glass lets light and sight through. None lets sound or air through until it is open; open, each lets all of it through, fog included. Nobody walks through a window either way, and the wall's own settings are left as they were.
  - **Bands through shutters:** with the slats open, lamplight and sunlight show through in bands, by day and night. The bands are only a look: by the rules the light stops at the shutters.
  - **Light out of doors and windows:** the glow now takes the colour of the light in the room (a light with none gives warm lamplight), only comes from a light that actually reaches the opening, and stops at any wall outside.
  - **Sun and lightning in:** a wall just beyond an opening keeps sun and lightning out, and a flash only lights the windows and open doors facing the strike.
- **Rainbow.** A new effect in the Weather panel, in any weather, with its rotation and size.
- **Weather panel buttons.** Every dropdown is now buttons: weathers in family tabs, what falls, the effects as on and off, and your presets.
- **Lightning lights the scene.** A bolt and its light now show over the darkness, where before the night dimmed them, with a wide pool of light round where it lands, stopped by walls that block light. A strike that lands flashes harder the closer it is, all but washing out the map beside you, and the dark of a closed sky gives way for the moment. Each player can turn flashes down with a new setting, and those who ask for less motion get a gentler one.
- **Lightning throws sparks.** Where a bolt lands, sparks fly out from the spot and die away. In a room they stop at walls that block light.
- **Ground gets wet in.** A new setting under Wet ground says how many game minutes the hardest rain takes to soak the ground, 5 by default (it was 15). Lighter rain takes longer.
- **Lighter clouds.** Clouds darkened scenes too much: broken cloud is now passing shade, and overcast is dull but plainly day.
- **No weather on a scene.** A new switch in the Weather panel and Scene configuration turns weather off on one scene, whatever the calendar says.
- **Puddles.** Wet ground now gathers real puddles, spreading and joining as it gets wetter: dark, soaked, holding a pale sheen of the sky and mirroring nearby lamps and torches in their colour, only where their light reaches past the walls. An opening in a roof always gathers a pool.
- **Ripples on wet ground.** Rain now rings on any wet ground where it lands, not only on water: clearly in puddles, faintly elsewhere.
- **Thunder comes from where the lightning struck.** It is panned by the strike's direction from the selected token, or from the middle of the view with none selected (a setting, on by default, for each player). Volume, delay, muffling and boom follow one smooth curve from a crack overhead to a rumble at the far side of the map, scaled to the map, with every recording evened out so only distance decides how loud it is. A strike right beside a token booms at once. Under a roof it is muffled as well as quieter, and strikes close together no longer pile up.
- **More distant thunder.** Four new CC0 recordings of far-off rolling thunder, so a distant storm repeats itself less.
- **Clear all.** The panel's Reset all is now Clear all: it also puts back the calendar's weather, the direction and the wind's direction. Your presets stay.

## 3.1.0 (2026-11-06)

### Fixes

- Ducks and other pond creatures only ripple open water, and a duck's splashes stop as soon as it leaves the water, instead of following it into the air and over ice.
- Baked blood stays sharp: its tile covers only where the blood is, at the map's own resolution, instead of the whole scene shrunk to fit one picture.

### New

- **New snow engine.** Lying snow is rebuilt from the ground up, replacing the old pale wash.
  - **Real shape:** each scene gets its own drifts and small mounds gathered at random, with torn edges where the snow thins out.
  - **Sun and moon:** slopes are lit from where the sun or moon is now, in its colour, with long soft shading when it is low. Every rise throws a shadow, and snow sparkles on the slopes facing the light. The trees' shade lies on it.
  - **Lamps and fires:** nearby lights catch the side of each rise that faces them.
  - **Roofs, trees and ice:** snow on roofs and trees and frozen water follow the sun, moon and nearby lights too.
  - **Ice floors:** a river's Frozen over look, or any ice floor, only takes a dusting, so its look still shows.
  - Wet ground also darkens more where water stands.
- **Weather panel.** A new Weather button in the Animater controls builds a scene's weather. Start from any weather or the calendar, choose what falls (rain, snow, hail, ash, petals, leaves, spores, sand, embers, gusts, debris, up to two at once) with its amount, size, speed and colour, and add any effect: temperature (a cold, sunny day: snow lies and water freezes under a clear sky), fog, mist, rain sheets, spiral clouds, tornado, dust devil, smoke, heat haze, frost, ice glaze, sun rays, glow, aurora, sparks, wisps, meteors, static, plus lightning, wind and cloud cover. Sliders show on the GM's screen as they move and reach everyone on letting go. What falls also drives the wet ground, lying snow, rain sound and blood wash. Save it as your own preset and pick it on any scene.
- **Rain and snow from straight above.** For top-down maps: rain and snow stream in toward the point under the camera and rain lands in the same ripples as rain on water, instead of slanting across the map. Chosen per scene in the panel or Scene configuration.
- **Fog and mist come indoors.** They creep in through open doors and walls that let light through, as far as the room's walls allow, further with the wind blowing in and hardly at all against it, and linger, thinning away slowly, once the door shuts. Both now move faster and draw out into streaks the harder the wind blows.
- **Weather through regions open to the sky.** A region marked Open to the sky now lets the weather reach the floor, on an underground scene or inside a region that suppresses weather. It shows as what it leaves: wet ground, puddles and snow gathering in mounds, with a soft, uneven edge instead of the region's straight lines. Falling rain and snow, fog and cloud stay out of the room. Lightning can strike down through it: the opening takes the flash whole and the strike lights up the room around it, stopping at walls that block light and passing those that do not.
- **Rain and snow fall down the map.** A new setting keeps them coming down the map, with the wind only leaning them, so they never go sideways or upward. Each scene can follow it or choose for itself. Off by default: the wind takes them as before.

## 3.0.4 (2026-11-05)

### New

- **Sound switches on a region.** A region's right-click menu can turn off its water or dripping sound, and the sounds of animals inside it.
- **Walls wildlife ignores.** Wall configuration has a new Wildlife passes through tick, for a thicket a character cannot get through. Creatures, sight and light are not changed.
- **Fish can leave.** Where water reaches the map's edge, a fish can swim off it, and another comes back in a while.
- **Damage lens without the blood.** Damage lens amount has a new None choice: no blood on the screen, while tunnel vision and the heartbeat keep working by their own switches.

### Fixes

- Bloody footprints are easier to see and last longer: stronger, for more strides, from anywhere on a wet stain.
- Splat blood starts wet and dries by the game clock, and can be stepped in while it is wet. It still stays until cleared; what was splatted before stays dry. What lands on water clouds and flows away.
- Blood in water looks like it: a soft cloud kept to the water, drawn out along the current and thinning away, not a stain sliding over the banks. Splat blood and blood kept with a scene no longer lie on top of water.
- Blood on the floor goes by the game clock, not real time: it waits while the clock stands still and is gone after a long rest. It dries visibly, in under a minute of game time, and stays longer: five minutes by default, for worlds that haven't set their own. Rain washes it by the game clock too: about three minutes of game time in hard rain, not one, and far longer in drizzle, which now counts as light rain when set as a scene's weather.

## 3.0.3 (2026-11-05)

### New

- **A blizzard you can hear.** A blizzard or snowstorm has its own howling wind, one of three recordings for each scene, in place of the plain strong wind.
- **Lightning strikes.** In a storm a bolt now hits somewhere on the scene now and then, about once a minute in a thunderstorm, while most flashes are far off. The closer it lands, the sooner and louder the thunder. Its flash throws shadows from where it struck.
- **Water takes its time to freeze.** Water freezes and thaws over 24 to 48 game hours, different for each scene. The GM sets the range under Water freezes in Animater settings. Snow on the ground comes and goes within minutes of game time.
- **Clouds that look like clouds.** They now show in what they do to the land instead of as a pale layer over it: firm shadows and warm sunlit patches under a broken sky, moving and stretching with the wind; a dim, cool sky with slow lighter patches once it closes over. Drizzle and rain are darker, with no morning mist, and overcast has no grey wash.
- **Water depth.** A region's water menu has a Depth choice: Shallow shows more of the bed, Deep and Very deep darken it and hide what is under it. Medium is how water has always looked. It changes the look only.

### Fixes

- Changing a scene's weather shows at once, without building the sky's layers again.
- Ducks, herons, frogs and fish leave water that has frozen over, and come back when it thaws.
- Sun shadows fade with the sky when rain, snow or cloud is set as the scene's own weather. The sun used to ignore it and shine at full strength.
- A sandstorm no longer sounds like rain and thunder when set as the scene's weather: it is wind and sand.
- A tornado spins much faster and travels across the map with the wind.
- A hurricane shows as one: its eye on the map, a wall of cloud round it and spiral arms turning, instead of a single pale band.
- Trees throw no sun flecks under an overcast or rainy sky, or where a cloud's shadow is passing.
- Snow on roofs builds from patches into one thick blanket of Animater's own snow, with soft swells and shade, rounded at the eaves, instead of a flat sheet.
- A heat wave is a pale drifting haze and shimmering air, without the bands.
- A sunshower rains a quarter less.
- Rabbits, songbirds, deer and foxes bolt when heavy rain or snow comes on, and only then go in, instead of simply fading away.
- An energy blast's mark no longer covers floor textures with the map's own picture: it scorches the texture.
- A sea with "Beach along the shore" off now fills its region right to the edge, with its shoreline there, and its animals and step looks go with it.
- A wall's configuration keeps its own settings in view when another module adds a section of its own: Animater's sections now scroll with the rest.
- Fish in moving water are easier to see: a little bigger and darker, each with its shadow on the bed, and about twice as many on smaller waters. The faint line that ran out from their nose and tail is gone.
- Deer, foxes, ducks, herons and town animals no longer have their shadow drawn over them, and animals' shadows on the ground stay closer to their feet.
- A creature swimming on moving water leaves only its wake again, without the rings that looked like wading steps.
- Daggerheart: the Defeated, Unconscious and Dead catalog entries now say where the Defeated look setting really is, and that Animater effect is the choice that animates them.

## 3.0.2 (2026-11-05)

### Fixes

- Fixed a WebGL warning that could fill the console after painted floors or looks were drawn.
- Ducks, herons and frogs now leave water a region step has just turned bad, instead of staying on it or vanishing. Ducks and herons fly to the nearest good water, and a frog dives and swims to a new lily pad while its old one sinks. With no good water left they go until it comes back, and ducks and herons driven onto the sea fly home when their pond clears.
- A region step that changes a lot of a map's water no longer starts all its animals over.
- The first frame of a scene no longer holds for a few hundred milliseconds while Animater's floor, lamp, cave and water shaders compile: they now compile in the background as soon as there is a canvas.
- Light through windows and open doors now has the sun's current colour, the same as on floors and water, instead of staying pale when the sun is low.

## 3.0.1 (2026-11-05)

### Fixes

- Blood from slashing wounds no longer has straight, squared-off edges: its stain ran past the edge of its own picture and was cut off.
- Animals now run from ground a region step has just turned bad, toward the nearest good ground, instead of vanishing and reappearing elsewhere. Birds fly off.

## 3.0.0 (2026-11-05)

Water that really moves, floors that change during play, and blood that stays. **Moving water is off until you turn it on: Scene configuration → Animater → Moving water.**

What you may notice first: GMs now find Animater's buttons under their own icon in the left bar instead of the Token controls, and the sun has real colour, whiter at noon and warmer at dawn and dusk.

### Moving water

- **A live water surface.** Waves run along the current and before the wind, the map or painted floor bends beneath them, and the sun, the moon and flames glint on them.
- **Choose the kind of water:** still, river, rapids, waterfall or sea. Any water region can opt out in its right-click menu.
- **Flows toward.** A river, rapids or waterfall runs the way you set, or choose **Follows the wind**. A river's current follows its banks, so the direction mostly picks which way along them it goes. A waterfall takes the nearest compass direction of the wind, and turns when the wind really turns.
- **Waterfalls.** Water drops into a pool, with foam and rings where it lands. It is as loud as its stream is strong.
- **Works on any scene,** including one with no map image, where the water brings its own colour.
- **Separate from the older checkboxes.** Choosing the Waterfall or Sea type no longer ticks "This is a waterfall" or "This is the sea".
- **Water reacts to what's in it.** Swimmers, footsteps and animals send out rings.
- **Painted water floors** give the water its colour, and the engine draws the waves.

### The sea

- **Waves that behave like waves.** They swing round to the shore, crowd and steepen in the shallows, arrive in sets, and merge where they meet. You can set the direction they travel.
- **Realistic foam.** A dense white rope at the front breaks into clumps and thin threads behind it. Foam stays on the water, and only a wave already running in reaches the wet sand.
- **Spray and splash.** Thin spray blows off the crests with the wind, and waves splash lightly where they reach the waterline.
- **A natural shoreline.** The water ends along a wandering line, never at the straight sides of its region. With the beach on, sand runs up to it, using Animater's own sand floor and darkening near the water. With it off, the map's own ground shows through the shallows.
- **Floor looks stop at the waterline,** so a bloody or oily sea leaves its shore alone.
- **Crabs** walk along the shore rather than just up and down it.
- **Gulls** glide and wander over the sea, hang on the wind and dive for fish, with more natural wing proportions.
- **Fish** stay out in the water and are drawn beneath the surface, so waves, foam and glare pass over them.

### Right-click a region

Change the ground during play without opening a thing. As GM, with tokens selectable (the Token or Animater controls), quickly right-click any region that has a floor. Hold or drag and it pans as usual, and a token keeps its own right-click.

- **Region steps.** The menu lists the region's steps: click one and the floor changes, spreading from where you clicked (or from upstream on a river). Clear water turns bloody, fresh grass burns, stone floods. Each step has its own look, footsteps and sounds, and can switch on an effect.
- **On any floor:** hide the step, show or hide the painted floor and pick its texture style, and soften its edge.
- **Look strength.** A slider sets how strong a step's look is, such as how much blood.
- **Pattern size.** A slider makes a region's floor and look pattern bigger or smaller, such as more panes of glass.
- **On water:** choose still, river, rapids, waterfall or sea, which way it flows or its waves travel, whether it moves at all, its reflections, and the beach along a sea.
- **On grass:** whether the season colours it.
- **Edit steps…** opens a window to name, add and remove steps, set what each looks like, walks as and switches on, and choose how a change happens: spreading or fading, at once or over up to 12 seconds. Every floor starts with a ready-made list.

### Painted floors and looks

- **Painted floors.** A region can paint its floor on a bare map, including grass blades that respond to wind, sun and whatever walks through them.
- **Looks repainted.** Burning, burnt, ash, snow, drifts, withered, churned, flowers, vines, rust, oil, acid, poison, blight, cursed and more were redrawn, with torn edges instead of blurred clouds and a real mix of sizes.
- **New looks,** including a more realistic glass mosaic and bones. Blood lies flat on land as specks, streaks and a few big splashes, and spreads in soft red clouds on water.

### Light, shadow and weather on floors and water

Painted floors, shiny looks and moving water all respond to the world around them.

- **The sun.** Glossy floors, shiny looks and water catch a highlight that sits toward the sun and moves only as the sun moves, not as you pan. Each surface answers in its own way: glass and polished stone flash sharply, snow and ice glitter, and rough ground only shows its relief.
- **Sunset colour.** The sun now changes colour with its height: near white overhead, gold as it gets low, deep orange-red on the horizon, at dawn and dusk alike. Water, floors, looks and grass all read the same colour.
- **Sun on the sea.** The glitter comes from the waves themselves: bright slivers lying across the sun's path, merging into a sheet at its heart and breaking into flecks at its edges. Calm water gathers it tight and a gale throws it wide. The moon lays a dim silver track.
- **Sunrise and sunset colour goes deeper.** It now shifts the colours of everything outdoors, the map, floors, water, roofs, trees and tokens, and keeps the darks dark, with no film over the map. Rooms under a faded roof keep their own colour, and overall darkness stays with Foundry or your calendar. It is on by default, with its strength in the module's settings. A scene can now have its own say in its configuration: as the module's setting, off, subtle or strong.
- **The moon.** At night the moon puts its own glare on water and shiny floors, and its light catches grass blades.
- **Light sources.** Lit torches, lamps and other lights glint on nearby floors, looks and waves. Even rough floors and dull looks show their bumps lit on the side facing the flame. Grass blades light up on the side toward it, in its colour.
- **Every look answers the light** unless it is light or vapour itself: burning, glowing and misty looks have no surface to catch it.
- **Waves in the light.** Each wave is lit on the side facing the light and dark on the other. Falling water is too broken to hold a long glare.
- **Shadows.** Wall shadows fall across floors and water. Sun and moonlight stop in the shade of walls, roofs and trees, so nothing glares or casts a sun shadow there. Grass blades throw their own shadows away from the sun, the moon or a nearby flame. Sun flecks under trees barely show on water.
- **Clouds** dim the sun and moon on every floor and on water.
- **Rain** soaks rough floors, which darken and take on a wet shine.
- **Wind** bends grass, pushes waves along and ruffles shiny looks such as oil and flooded floors.
- **Lightning** flashes across floors and water like a burst of sun.
- **Ice.** Freezing weather stills moving water, and a region can opt out of freezing.
- **Roofs.** Under a roof a floor or body of water gets no sun or moon, and floors get no rain or wind. Water there barely stirs. Lights still glint on it.
- **Animation quality** sets how much of this is drawn, including how many lights are counted.

### Blood

- **Separate amounts** for blood from hits, drips and blood on tokens: from none to twice as much.
- **Wounded creatures drip blood** has its own setting: Always, Only in combat or Never.
- **Blood stays until cleared.** It can stay with the scene instead of fading.
- **Splat blood** dresses the ground around selected tokens with old blood.
- **Bake blood** turns the blood on the floor into a tile.
- **Rain washes blood away,** but not under a roof.
- **Blood in water** clouds out and dissolves, carried along by any current. Frozen water holds it like a floor.
- **Bloody footprints.** A creature stepping in wet blood leaves prints in that blood's colour for its next few strides.
- **Blood dries** darker over about two minutes.

### Other additions

- **Animater has its own controls.** Its buttons (the workspace, cave-in, energy blast, blood and clouds) moved from the Token controls to their own group, and tokens stay selectable there. A new Clear ground marks button joins them. Flames stays with the Lighting controls, as it works on selected lights. Players keep their Studio button on the Token controls.
- **River volume and Waterfall volume** sliders for each player.
- **Animater breath from** gains None for individual tokens.
- **Casts no shadow** option for walls.
- **Aura accent under the token,** for the Tokenshade aura style.

### Performance

- **Animation quality** now also sets how much of the floor and water effects is drawn. Moving water is drawn in full on Full and Light, simpler on Balanced, and not at all on Low.
- **No more freezes** while new floors and looks are prepared, because they now build in the background.
- **Sharper floors.** Full and Light paint floors at twice the resolution, so they hold up when zoomed in. Balanced and Low keep the smaller size to save memory.
- **Better floor textures.** Stone, dirt, sand, snow, mud, wood, metal, glass and ice all gained close-up detail: grain, crumbs, scratches, trapped bubbles and small cracks. Cobbles lost their twisted seams, and dirt, sand and snow lost their round blobs, black dots and blocky specks.

### Fixes

- Flames now show on torch lights standing on sconces drawn in a map's foreground picture. The picture was hiding them as if they were under a roof; real roofs still hide what is under them.
- Clearing ground marks now also clears the scorches energy blasts leave.
- Grass no longer shows a repeating pattern of dark patches, and a river's glare no longer looks like crinkled plastic.
- Animals no longer appear on flooded ground, waterfalls or rapids.
- Animals stay off ground a region step has made dangerous or foul, such as burning, lava, acid, poison, cursed, burnt or freshly bloodied ground, and any standing on it move off when the step changes. Snow, frost, mist, bones and dried blood don't bother them.
- Animals no longer get shut inside sealed wall rings, and any already trapped are moved to open ground.
- Bats no longer gather around a light someone is carrying.
- Window light no longer shows through walls the viewer can't see past.
- The right-click menu opens only on a quick click, not when you right-click and hold to pan.
- Wakes and ripples no longer redraw the map over painted water.
- Sun flecks under trees barely show on water now.
- Animater's wall sections show in the wall palette again.

## 2.12.6 (2026-11-04)

Reflections stop at walls, and you choose where water reflects.

- **Fixed: reflections came through walls.** Tiles, creatures and fires inside a building no longer show in water on the other side of its wall. Reflections stop at whatever blocks sight, so a closed door hides them, and an open door or a window lets them through.
- **Reflections can be turned off for a scene or a region.** Scene configuration → Animater → Reflections on still water covers the whole map, and Region configuration → Animater → Reflections covers one body of water. Both are on by default.
- **Fixed: a reflection could stay on the water** after the last thing reflected had gone.

## 2.12.5 (2026-11-04)

Flames burn indoors again.

- **Fixed: flames vanished indoors.** Since 2.12.4, light flames, held torches, lanterns and embers stayed hidden under a roof even after it faded for a creature inside. They now show as soon as the roof fades, and hide again when it comes back. Roofs that open only around a creature or within its sight show flames only there.

## 2.12.4 (2026-11-04)

Reflections from every bank and of every tile, recipes for a whole weapon category, and flames that stay under the roof.

- **Reflections fall from the nearest bank.** A creature on any side of still water now reflects, out across the water from where it stands, not only from the north.
- **Tiles reflect too.** Trees, statues, rocks and any other tile near still water show in it. Tiles bigger than 12 squares are left out, since those are usually overlays for the whole map.
- **Dripping pools reflect.** A region marked as dripping mirrors what stands by it, whatever the floor around it.
- **More natural reflections.** Someone at the water's edge reflects from the part of them over it, and the further from the shore, the less of the reflection shows and the fainter it is.
- **Recipes for a weapon category.** A recipe's Applies to now lists the system's own categories: weapon categories and groups in PF2e and SF2e, weapon types in D&D 5e, slot, burden, range and trait in Daggerheart, and ability keywords in Draw Steel. A recipe for a specific item still wins over a category, and a category wins over all melee or all ranged. PF2e and SF2e NPC natural attacks have no group or category, so all melee or all ranged still covers those.
- **A Settings button on the Setup page.** It opens Animater settings from the main window.
- **Fixed: flames showed through roofs.** Light flames, held torches, lanterns and embers now hide under a roof, a tile or the map's foreground art while it is drawn. They come back as the roof fades for someone inside.
- **Fixed: all melee and all ranged never played in Draw Steel.** They now match its abilities.

## 2.12.3 (2026-11-04)

**Wildlife is now chosen scene by scene: to bring your animals back, turn on Outdoor life in Scene configuration → Animater.** Also new: what a fight leaves behind, coasts and waterfalls, reflections, town life, old tracks, and the sound of places.

- **Outdoor life is now your choice for each scene.** Animals, their calls, the night crickets, fireflies and the dawn chorus no longer start by themselves. Every scene starts with it off, including your existing ones.
- **What a fight leaves behind.** Arrows and bolts stay stuck in the walls, floors and shields they struck, until the scene changes. A body left on the map draws flies, then crows or a vulture, who scatter when anyone comes near.
- **The coast.** Mark a water region as the sea (Region configuration → Floor and water) for waves, wet sand that moves with the tide over the game's day, crabs and the sound of surf.
- **Waterfalls.** Mark a water region as a waterfall for falling water, foam, mist on the wind, a faint rainbow in the spray and the roar of it.
- **Reflections.** Still water mirrors creatures on its banks, nearby fires and the moon.
- **Town life.** Choose Quiet or Busy for a scene (Scene configuration → Animater) for pigeons, chickens, a cat on the walls and a stray dog, with their calls. Windows go dark one by one through the night. Off until you choose.
- **Old tracks.** Choose for a scene whether only the GM or everyone sees prints that stay and age by the game's clock, and how many game hours they last. Mud keeps them longest and stone hardly at all. Tracks of hidden or sneaking creatures show only to the GM. Off until you choose.
- **Tavern murmur.** Mark a region as a tavern for a crowd's voices: loud inside, faint through its walls, spilling out when a door opens.
- **Dawn and dusk.** Birds sing all around at first light and go quiet at sunset, then a hush falls before the crickets start.
- **Flames in the wind.** Out of doors, flames, torches and their smoke lean with the wind and swell in the gusts. The light itself never changes.
- **Choose your immersion.** The new features are offered after this update, each with an example on the open scene, and the GM can set Outdoor life, Town life and Old tracks for that scene right there.
- **Fixed: the Choose your immersion rows looked wrong.** They are compact again, with each checkbox beside its name.

## 2.12.2 (2026-11-04)

D&D 5e in other languages: the catalog speaks your compendium's language, and translated items find their animations.

- **The D&D 5e catalog shows translated names.** In a world that isn't in English, with a translation such as Babele and the Russian translation module, spells, features, weapons and items show the names your compendiums use, and search finds them. English names still search too. Conditions and effects keep their English names for now.
- **Translated items find their animation more often.** An item that lost its compendium link and identifier is now recognized by the English name Babele keeps on it, or by its translated name. Custom recipes named in English match translated items the same way, and so do NPC abilities on imported creatures.
- **Fixed: some spell effects on a target showed no lasting animation.** An effect a spell applies to a target now follows its source back to the spell, in any language. Effects that share a name, such as each level of Acid Arrow, now find the right one.

## 2.12.1 (2026-11-04)

Regions keep to their floor, rain ripples like a pool, and the gulls go fishing.

- **Fixed: a region on one level reached every level.** A Suppress Weather region on the basement took the weather off every floor, and a Keep out region kept animals off every floor. Animater now reads only the regions on the level in view, for everything it takes from regions.
- **Night sounds, scene by scene.** A new choice in Scene configuration, Animater, turns off the constant crickets on a map whose nights should be quiet. Its other animals still call now and then.
- **Rain on water ripples like a pool.** The flat white circles are gone: drops send out small lit waves with dark troughs, and on land they throw a soft bit of spray.
- **Weather moves the animals.** A downpour or heavy snowfall sends the birds, rabbits, deer, foxes, insects, owls and bats in; ducks, herons, gulls and frogs stay out. Any real rain puts out the fireflies, and heavy rain stops the crickets.
- **Gulls and herons fish.** A gull folds into a dive at a fish, splashes in and sometimes climbs away carrying it. A heron turns to a fish in reach and stabs, and may hold it in its bill a moment. Another fish swims up in a while.
- **Not every lightning flash thunders.** Far-off flashes are often silent, fewer of them in the thick of a storm.
- **Bird shadows removed.** Real birds cast their own shadows now, so the setting and the scene choice are gone.

## 2.12.0 (2026-11-04)

Choose how much of it you want, and swimmers leave a real wake.

- **Choose your immersion.** Once after this update a window lists Animater's immersion features in ten plain groups: animals, vermin, sun and shadows, weather on the map, fire and lamplight, feet on the floor, living creatures, caves, sounds of the world, and blood and impact. Click one to see it explained and shown on the scene you have open, on your screen only and with nothing saved. Tick what you want, or just press Use all or Use none. The GM chooses for the table; each player chooses for their own screen from what the GM left on. A feature you leave alone keeps its settings as they were. Open it again any time from Animater settings, Floor & world, and later versions only ask about what is new.
- **A swimmer's wake.** Swimmers, ducks and frogs now leave a wake drawn with the pool's own ripples, in place of the old V: one narrow V opening to the angle real wakes have, gently curved, made of a few bowed crests with fainter ones across the water between. Each piece stays where it was made, spreads and fades, so nothing bends with the swimmer, and nothing goes ahead of it. It stays in the water.
- **Ducks and frogs ripple the water.** A feeding duck and a standing heron send out rings now and then, and taking off, striking or jumping in splashes properly.
- **Wind sounds start at Moderate.** Calm, Light and a scene's Breeze are now silent.

## 2.11.0 (2026-11-04)

The open air gets louder and fuller: weather, rivers and a night you can hear, deer and a fox, and creatures that scatter at a loud bang.

- **Weather sounds.** Light and heavy rain, light and strong wind and hail, as loops that grow and fade with the weather and the scene's wind and are muffled under a roof. Thunder follows each lightning flash: a near clap almost at once, or a far rumble a few seconds later. For the weathers Animater sounds itself, Calendaria's own loop stands down on each screen; your Calendaria settings are not changed, and its fantasy weathers keep their sound. A new Weather sounds setting turns this off.
- **River sounds.** Any water region with a Flows toward direction plays running water, gentle or swift to match its setting, loudest at the bank, fading with distance, quieter through walls and silent while frozen. A new River sounds setting turns this off.
- **Crickets all night.** A constant bed of night sound out of doors, fading in with the dark, gone in a storm or with snow on the ground, and muffled indoors. It goes with Wildlife sounds.
- **Deer.** A small herd on big open maps grazes, lifts its heads, walks and bounds away, turning along a bank or wall instead of running into it.
- **A fox.** It trots about, creeps up on the rabbits in bursts, coils and pounces, and sometimes carries one off.
- **Butterflies and dragonflies.** Butterflies wander and glide by day; dragonflies hover, lean and dart over the water.
- **Night life.** Fireflies blink on warm nights, an owl glides over now and then, and bats hunt round the lamps out of doors.
- **Noise scares them.** Energy blasts, cave-ins and big spell shockwaves send birds up, rabbits and deer running and frogs into the water, spreading out from the bang.
- **Animals use the shadow and light engines.** Their shadows follow the sun's height, the moon and nearby lamps, drop away in a wall's shade, and day animals go in when a scene turns dark.
- **More voices.** Gulls call, crows caw and rustle as a flock passes, and every frog going in makes its own splash. Each sound varies a little in volume as well as pitch.
- **An Animater tab in Scene configuration.** All of Animater's scene settings now live in one tab: This place, Sun and Creatures. New rows set how many deer, foxes, insects and owls a scene has, and regions can keep out deer, foxes and insects.
- **Rabbits turn** smoothly instead of snapping round.
- **Fixes.**
  - The GM heard creatures' sounds at full volume however far away. Everyone now hears by distance; a GM with no creature selected listens from the middle of the view.
  - Every sound asked for before the first click played at once on that click. Those sounds are now dropped, and a scene's animals ease in.
  - Birds no longer show inside rooms. High fliers stay over a drawn roof and are cut out of a room seen into, as the weather is. Low fliers turn back at walls, closed rooms and Keep out regions, and a walled room with no region now counts as closed.
  - Low fliers fly under trees and roofs, and fireflies hide beneath them.
  - Region edits no longer replace all the animals unless they change a good part of the ground or water.
  - Animals no longer crawl at a low frame rate.

## 2.10.1 (2026-11-04)

Animals stay where they are, and rabbits calm down.

- **Animals no longer vanish and reappear.** Wildlife, pond life, rats and bats were thrown away and placed anew whenever a scene, a light or any module's setting changed, which happened often. Now they only change when something they depend on does: the scene, how many you set, or a water, floor or Keep out region.
- **Rabbit thumps.** A rabbit thumps once as it is first startled, not on every run while it is chased.
- **The hawk catches more.** It now misses one stoop in five instead of nearly half.

## 2.10.0 (2026-11-04)

The open air comes alive: birds, rabbits, fish, ducks, herons, gulls and frogs. Underground, smoke and mist now move with the air, and a door can burst with bats or rats.

- **Wildlife.** On open ground by day, a hawk circles overhead and now and then stoops on a rabbit, sometimes carrying it off. Crows pass over, songbirds peck about and burst into the air, and rabbits sit, hop and bolt from anyone who comes near. Fish drift in the water and dart away. Rabbits and birds keep to grass, dirt, sand, mud or snow, and never go into water, even when fleeing.
- **Pond life.** Ducks paddle, tip up to feed and clatter away, a heron stands in the shallows and lifts off on slow wings, gulls wheel over wide water, and frogs on lily pads puff their throats and leap in with a plop. Frogs stay out at night; the rest go in. They need a region with its floor set to water.
- **Wildlife sounds.** A hawk's cry, crows, songbirds, wings, a rabbit's thump, a fish's splash, ducks and frogs, a few at a time and only near enough to be heard. Herons and gulls stay silent for now: no recording passed our checks or an audition. A new Wildlife sounds setting turns them off.
- **How many, and where.** Scene configuration → Animater creatures sets how many and how big, for each of rabbits, birds, fish, water birds and frogs. A region's Keep out holds any of them out of it.
- **Door bursts.** Wall configuration → Animater door can send a flock of bats or a rush of rats at whoever opens that door, with its size, and whether it happens every time or only once.
- **Rat and bat sounds.** Claws and squeaks, sharper when a rat bolts, and wings and chirps from the bats, muffled by walls. A new Rat and bat sounds setting turns them off.
- **Smoke gathers.** Underground, smoke from a fire now fills the room little by little, and leaves through open doors toward the way out. It drifts in soft billows rather than streams.
- **Mist moves with the air.** A mist region's mist drifts along the airflow as it builds up, instead of being there all at once. Opening a door lets it spread through gently, even when no way outside is open.
- **Door wind.** A door only makes its rush of wind if it really connects to the outside air.
- **Shadows bob.** A flying creature's shadows now bob with it, both its sun shadow and the ones cast by nearby lights.
- **Hide Animater's buttons.** Each GM can hide the Cave-in, Energy Blast, Clear rubble, Clear blood, Clouds and Flames buttons from Animater settings → Interface & performance.
- **Flames button.** It now also sets soot, smoke, heat haze and chimney smoke, for the selected lights or all of them.
- **Fixes.**
  - The first energy blast of a session no longer freezes the screen.
  - Moth shadows no longer grow huge when a moth flies close to a light.

## 2.9.1 (2026-11-04)

A new way to fall down, and blood that actually shines.

- **Prone.** A creature knocked down now tips over backwards like a cutout laid on the floor, in perspective, with a small bounce and a puff of dust, and comes to rest in the middle of its square. It lies under anyone standing there, with a dark edge where it meets the ground instead of an upright shadow, and pushes itself back up in two moves. This replaces both the quarter turn and the flat drawing look on top-down art.
- **Blood shines in the light.** Every large stain now picks up the colour of the light on it, not only the pool from a killing blow, and pools and trails hold a small reflection. It fades as the blood dries, and blood you cannot see no longer shines through fog of war.
- **Breath.** A creature lying down breathes from where its mouth now is.

## 2.9.0 (2026-11-04)

Blood on the floor, energy blasts, and every weather gone over so the map stays readable.

- **Blood on the floor.** A hit sprays blood away from the blow, shaped by its damage, and a killing blow leaves a pool. Any wound drips a little as the creature walks or stands, more at half its HP and freely at a quarter; prone and crawling, it drags a trail. Pools catch the light near them, and blood fades after a time you set (How long blood stays on the floor). Every screen draws its own, the GM's too; a new Clear blood button in the Token controls wipes it for everyone.
- **Energy Blast.** A new button in the Token controls: choose fire, cold, electricity, acid, force, void, radiant, sonic, poison or psychic, then click where it goes off. A flash, a shockwave that ripples the floor and the tokens, the energy itself and a mark left behind, each kind with its own look and sound. Several kinds still borrow a pitched wind sound for now.
- **Size it with the wheel.** Aiming a blast or a cave-in, scroll to change its size from half a square to ten; Shift doubles it. A cave-in's stones and boulders grow with the circle.
- **Crawling sounds.** A prone creature that moves now drags itself along the floor, with its own sound.
- **How much a step kicks up.** A new setting for the bits thrown up by footsteps, down to none.
- **Moths anywhere.** A light with Moths set to On draws them on any scene; Auto keeps them to fire lights underground. The Flames button on the Lighting controls sets Moths too.
- **Clouds on demand.** A new button in the Token controls, and the Clouds over the map setting, turn the white clouds and an overcast sky's grey deck off and on, leaving the rain, snow and the rest. The clouds are also much thinner than before.
- **A gentler blizzard.** Far fewer and smaller flakes, and thinner fog, so you can still see the map. Calm wind now means calm: a blizzard or a storm only forces a strong wind when neither the scene nor the calendar says how windy it is. A preset's intensity can no longer make a weather thicker than its usual amount.
- **Other weathers softened.** Mist is broad and soft instead of long streaks; Gravewind and Black Sun lose their solid blades; tornadoes and dust devils are see-through dust and fine grit; Permafrost Surge creeps in as patchy frost; sandstorm grains are soft specks; Wildfire Smoke has fewer embers; Blood Rain is clearly red.
- **Fixes.**
  - Shockwaves, from blasts and spells alike, went missing on maps with many fires, whose heat hazes took every slot. A shockwave always gets one now.
  - A swimmer leaves only its wake, with no stroke rings on top.
  - Bats no longer fly through walls or into Keep out regions.
  - Rats near a token and a wall no longer shake on the spot: they pick an open way and run, or cower.

## 2.8.1 (2026-11-04)

Underground gets its sounds, new floors, and much better looks for what walkers kick up and what comes down in a cave-in. Plus a round of fixes from the community.

- **Clearer rooms.** The fires' smoke was laying a pale fog over the floor and everyone on it, washing out the map. It is now thin and dark, and the rooms are visibly crisper.
- **What a step kicks up.** Painted bits instead of flat shapes, most with a shadow of their own: broken stone with lit and shaded faces, bouncing and settling; splinters and sawdust on wood; soft dust and clods on dirt; curved blades of grass that flutter down; grains of sand; clumps of snow; frost shards; wet clods of mud.
- **New floors.** Pebbles, Glass and Metal, for scenes and regions, each with its own footsteps and marks. Pebbles crunch and scatter on every step, in any scene.
- **Underground sounds.** A cave-in roars with a deep thud under it. Drops plip into pools, pools lap softly as you come near, the wind sighs through a door as it opens. Each rings in its room and is muffled behind walls, with its take and pitch varied.
- **Cave-ins.** Real boulders with faces, each with a dark shadow that closes in as it falls, and the floor stained and cracked where they hit. Shift brings down far bigger boulders, much louder, thud after thud, with a harder and longer shake.
- **Spiders and cobwebs.** A shaded spider with jointed legs and a shadow, that shows on a dark floor, and webs twice as bright and thick.
- **How many, how big.** Scene configuration → Animater creatures: how many rats, bats, moths and crawlers a map has, and how big each is.
- **Keep them out.** Region configuration → Animater → Underground → Keep out: tick rats, bats, moths, crawlers or eyes to keep them out of a room.
- **Flames on many lights at once.** A new Flames button on the Lighting controls sets Flame, Fire and Flame size on the lights you have selected, or on every light in the scene.
- **Shadows under the sky.** A creature standing in the pool of light under an opening to the sky casts a sun or moon shadow, even underground.
- **Bird shadows are now off by default.** Scene configuration → Animater → bird shadows: choose a size for a map that should have them.
- **Fixes.**
  - Flames and sparks no longer show through walls or fog of war, and a flame only shows on its light's own level.
  - Sparks, smoke and heat shimmer stay out of the next room, including from a torch on a wall.
  - Candles and lanterns get one flame instead of a brazier's three (choose Brazier or Campfire on the light for a bigger fire).
  - A swimmer leaves its wake again, not a wading step's rings.
  - A rat caught in the light runs out of it instead of spinning on the spot.
  - Cavern mist draws again.
  - The stutter from the flames' glow is gone.

## 2.8.0 (2026-11-03)

Underground scenes come alive. Every new effect has a world setting and an "on my screen" setting (Animater settings); most are set per region on the new **Animater tab of Region configuration**, or per light under Light configuration → Animater.

- **The air moves.** In an underground scene (or one with a region marked as opening to the outside), the air flows through every open door toward the way out, fastest through doorways and narrow passages. Opening a door sends a gust that swells through the rooms and settles into a steady draft; a sealed room's air stands still. Dust drifts with it, specks of dust stream through the doorways, sparks are carried off, and the fires' flames lean with it and flicker harder in a gust.
- **Smoke in the air.** The fires' smoke hangs as a faint haze in their rooms, drawn out along the draft where it runs fast.
- **Flames on fire lights.** A torch, brazier or campfire light burns with a real flame where it stands, for maps that draw their sconces and bowls without fire: one tongue for a torch, a bed of flames for a brazier or a bonfire. Light configuration → Animater: Fire (its kind) and Flame size.
- **Caverns** (Region configuration → Animater → Cavern): low mist hugging the floor that parts as creatures walk through; glowing fungus that dims where it is brushed; crystals catching the lights; lava under a drifting crust, lighting the rock orange; dusty cobwebs in the corners with a spider now and then; water seeping down the walls; steam vents breathing from the floor; and bad air, a sickly haze in which the fires burn low and light less far.
- **Dripping water.** A region can drip from the ceiling into a puddle, a pool or deep water, each drop ringing it, at its own pace. Pools and deep water count as water underfoot. Walking through water rings it the same way.
- **Light through openings to the sky.** A region marked as open to the sky lets daylight (or moonlight) fall into an underground scene as a pool on the floor with a shaft of light and dust turning in it. Nowhere else underground does the sun or moon reach, and underground it is always night for everything else.
- **Life in the dark.** Rats scurry along the walls, keeping out of the light and scattering from anyone who comes near; bats circle overhead. Moths loop round the fires (Light configuration → Animater → Moths), beetles and a centipede run along the foot of the walls, and now and then a pair of eyes glints back from a dark corner (Scene configuration → Animater: eyes in the dark, now and then, often or never). All cast shadows from the lights and keep out of the walls.
- **Wear and weight.** Soot blackens the wall behind a wall torch (Light configuration → Animater → Soot). A heavy creature's step shakes dust from the ceiling. A step on stone or earth now and then kicks a pebble skittering ahead.
- **Cave-ins.** The GM brings a ceiling down anywhere with the new Cave-in button in the Token controls (Shift for a bigger fall): the view shakes, rocks fall and bounce, dust rolls out on the air, and the rubble stays where it fell, for everyone. Clear rubble takes it away.
- **Breath and prints.** Breath in the cold rises as a soft, torn cloud. Prints in snow and mud are pressed hollows, and a creature out of the water leaves wet prints.
- **Bird shadows per map.** Scene configuration → Animater: bird shadows normal, small, tiny (a city or region map, where a square covers a lot of ground) or off.
- **A floor of None.** Scenes and regions can choose None for their floor: no step sounds and no marks there.
- **Fixes.** Fireflies come out only over grass and water banks, not over every plain map at dusk. The season's colour lies only on grass, so city streets and stone floors are no longer tinted green. With the sun turned off for a map, the morning mist still clears a few hours after sunrise.

## 2.7.1 (2026-11-03)

- **Lighter weather.** The weather on the map costs two to three times less on the graphics card: lighter noise where its finest detail never showed, the clouds' lit side and the sandstorm's billows worked out more cheaply, and nothing drawn over a room you look into. Same look, smoother on modest machines.
- **Ice without a ruled edge.** Frozen water thins out raggedly at the edge of its region, so a water region drawn a little off the painted banks no longer leaves a straight line across the ice.

## 2.7.0 (2026-11-03)

Animater now draws the weather itself. Every new effect has a world setting and an "on my screen" setting (Animater settings, Sky).

- **Weather on the map.** All of Calendaria's weathers, drawn by Animater on the graphics card in one pass, whatever the weather. Clouds are seen from above and lit from the sun's side, with their shadows thrown where the sun casts them; an overcast sky closes into one grey ceiling. Rain falls in four depths with splashes and gusting sheets; drizzle is fine, a sunshower sunlit, a monsoon torrential with standing water. Snow drifts on eddies, a blizzard whites out, sleet and hail fall as they should. Fog banks and low mist settle in the hollows. A thunderstorm, hurricane, monsoon or tornado brings lightning. A tornado or dust devil swirls across the map, a hurricane's bands spiral overhead, a sandstorm billows, a heat wave shimmers, wildfire smoke rolls with embers in it. An ice storm glazes everything and permafrost creeps in from the edges. The fantasy weathers too: blood and acid rain, aurora, ley surges, divine light, a black sun, the nullfront's static, gravewind's wisps, meteor showers, spores and miasma. The glowing ones shine through the night's darkness. FXMaster's effects for Calendaria's weather are hidden on your screen while this is on (its settings are never changed).
- **Animater weathers for any scene.** Scene configuration → Weather Effect lists every Animater weather, so a scene can have its own without Calendaria.
- **Weather light.** The weather lights the outdoors its own way: a grey day's flat, cool light, rain's grey-blue, a storm's dark green-grey, a sandstorm's amber. A room you look into keeps its own light. Calendaria's "Sync Scene Ambience with Weather" is turned off while this is on.
- **Cloud shadows** cross roofs and trees as well as the ground, fade out under a closed overcast sky, and are cast from FXMaster's own clouds when it draws them.
- **Moonlight on the ground** is stronger, and halves itself if Calendaria's moon darkness is on, so the night is never brightened twice.
- **Light through windows at night:** a creature no longer casts a shadow from a lamp through a closed door or a wall, and a lamp's shadow stops at its room's walls.

## 2.6.4 (2026-11-03)

- **Tracks only where the snow lies.** Light snow lies in patches, and creatures now leave snow prints (and crunch) only on those patches, not on the bare grass between them; as it deepens and the patches join, the tracks spread with them.

## 2.6.3 (2026-11-03)

- **The weather goes on where the party is not.** As the GM moves the clock, every scene with water carries on under its weather: a river left half frozen keeps freezing in a frost while the party is elsewhere, and thaws when it warms. Each scene follows Calendaria's weather for its own climate zone (else the zone in play), and a blizzard set on the scene freezes it whatever the calendar says. Needs a GM connected; with none, a scene catches up when it is next viewed.
- **Every screen sees the same ground.** The puddles, snow and ice are kept in the scene, written by the GM, so every player finds the same river frozen (no longer kept on each screen).

## 2.6.2 (2026-11-03)

- **Chimney smoke shows.** A light set to Chimney smoke: On now smokes from its chimney even with its own Smoke set to Off (a hearth that smokes only above the roof), and whether or not the fire inside can be seen from outside.
- **No chimney smoke in the room.** While the roof is faded to look inside, its chimney's smoke is hidden with it.
- **Paler chimney smoke.** A chimney's plume is lighter and fuller, so it reads against dark shingles, by night too.

## 2.6.1 (2026-11-03)

More life on the map through the weather and the year. Each new effect has a world setting and an "on my screen" setting (Animater settings, Sky).

- **Water freezes.** In a hard frost (from −3 °C, over some hours, faster the colder) the water freezes over, the ice creeping in from the banks: pale and matte with fine cracks, sparkling, snow lying on it, and creatures skidding on it as on ice. It thaws above freezing. Region configuration → Never freezes keeps a hot spring open.
- **Rivers flow.** Region configuration → Flows toward gives a river its direction (and Gentle or Swift): its ripples, glints and streaks of foam are carried downstream instead of drifting with the wind.
- **Trees in the wind.** Tree tiles sway with the wind, each out of step with the next: barely in still air, a good deal in a gale.
- **Chimney smoke.** A fire in a room smokes from the roof above it while the roof is drawn, its plume leaning downwind. Light configuration → Animater → Chimney smoke: Auto, On (a forge, always above the roofs) or Off.
- **The ground through the seasons.** The open ground takes the season's colour, most on grass: fresh green in spring, sun-bleached in summer, brown in autumn, grey in winter. In autumn fallen leaves lie around the trees, fewer in a wind and none under deep snow.
- **Moonlight on the ground.** By night a faint silver light lies on the open ground, as bright as the moon is full (none at new moon), broken where clouds pass over it. Part of the Moonlight setting.
- **Rainbows.** When the rain stops and the sun comes out under a clearing sky, a soft rainbow arcs over the map away from the sun, fading as the ground dries.

## 2.6.0 (2026-11-03)

The sky comes down to the map: light through the trees, weather that settles on the ground and the roofs, life in the grass and over the water, and light from the windows at night. Every effect has a world setting and an "on my screen" setting (Animater settings, Sky), and most are drawn from Balanced quality up.

- **Light through the trees.** Tree tiles cast their shade on the ground away from the sun, broken by sun flecks that drift and wink as the leaves move: short at noon, long and golden at dusk, silver under the moon. A tile's height is read from its level (a roof as tall as its storey, a tree by its name), and its leaves are sparse, medium or dense by its name or picture. Tile configuration → Animater sets the sunlight (tree, roof or none), leaves and height for one tile.
- **Roof shadows.** Roof tiles cast a building's shadow on the open ground, and let the sun in through their holes onto the floor inside.
- **Cloud shadows** drift over the open ground with the wind on a cloudy day.
- **Sun on the water, snow and ice.** Soft sheen and a few bright, sun-coloured glints on water, gathering where the swell turns to the sun and never in shade; snow and ice sparkle.
- **Heat shimmer** over hot ground at midday under a clear sky.
- **Lightning that lights the room through its windows.** In a thunderstorm the map flashes, and a room only where the flash comes in: a bright patch fanning in from each window and open door. Strikes follow the storm's severity (Calendaria's rain and wind, else FXMaster's lightning frequency): a mild storm flashes now and then and dimly, a fierce one often, brightly and sometimes twice. While these flashes are on, Calendaria's HUD lightning and FXMaster's lightning are stood in for on each screen (their settings are never changed).
- **Warm light from the windows at night.** A lit room's light spills out of its windows and open doors onto the ground outside, in the light's colour, hidden under the eaves and the trees. Creatures standing in it cast their own shapes' shadows away from the lamp, falling across other creatures too. Wall configuration → Animater window says what fills a window: glass, an open frame, curtains (a dim, soft light) or shutters (light in bands).
- **Falling leaves** drift from under the trees: a few in summer, many and golden red in autumn, blossom in spring.
- **Morning mist** over water and low ground before sunrise, burning off as the sun climbs.
- **Wet ground after rain:** darkened ground and puddles that catch the sky, drying over a few hours of game time; soil stays mud underfoot until it dries.
- **Snow cover:** falling snow whitens the open ground, the roofs and the trees (a new "Snow on roofs and trees" setting), and melts once it is warm. Snow from the scene's weather settles whatever the calendar's temperature says.
- **Tracks in the snow.** Snow lying on the open ground is snow underfoot: it crunches and takes the creatures' tracks, darker now so they read, and fresh snow fills them in (rain softens tracks in mud).
- **Fireflies** on warm summer evenings over the grass and by the water.
- **Bird shadows** cross the map on a clear day, over the roofs and the trees.
- **Rain on water:** rings where the drops land, on water and on puddles.
- **Wind for the scene.** Scene configuration → Animater wind sets how strong (calm, breeze, windy, gale, or sheltered to halve the weather's) and where it comes from, alongside Calendaria's.
- **Leshies walk on roots.** Leshies and plant creatures leave root-tendril prints and shed a leaf every other stride.
- **Holes in regions.** A hole drawn in a region is a hole for Animater's floors, surfaces and roofs too.
- **Snow on creatures is a dusting.** "Dusted with snow" now settles soft snow on the top edges only, without frost veins.
- **Shadows keep up with moving creatures,** and the window light no longer rebuilds while creatures walk about.

## 2.5.3 (2026-11-03)

- **A hovering creature's shadow stays put.** A token set to Fly no longer has its shadow slide back and forth across the floor as it bobs; it keeps its place, as a striding creature's does, and only softens a little as the body rises.

## 2.5.2 (2026-11-03)

- **Spell lights leave when their shot does, measured from the clips.** Each shot's launch is now read from the JB2A clip's own frames instead of guessed, so Magic Missile, Fire Bolt and other bolts no longer hold their light at the caster while the missile is already flying (a 2.5.1 regression). Eldritch Blast waits at the caster through its charge at every range, short ones included.
- **Beams light their line when they fire.** Ray of Frost, energy strands, Chain Lightning and other beams light the line only once the beam appears, and arcs from one target to the next wait for their launch too.
- **More spells glow.** Guiding Bolt, Starry Wisp, Witch Bolt, Disintegrate and Spray of Stars now light the scene as they fly.
- **Lightning makes every target convulse.** An electric spell written without a hit reaction (Lightning Bolt, Chain Lightning, Shocking Grasp, Call Lightning and more) now jolts its targets as the lightning lands.

## 2.5.1 (2026-11-03)

- **A shot's light leaves when the shot does.** The light of a spell that charges before it fires (Eldritch Blast) waits at the caster while it charges, then sweeps to the target as the ray crosses, instead of creeping along the line the whole time. Every measured shot's light now sets off when its clip launches.

## 2.5.0 (2026-11-02)

- **Sunrise and sunset colour.** In scenes whose sun follows the time of day, the low sun turns open ground golden, then deep orange at the horizon, with a rose afterglow just after sunset and before sunrise. Only where the light falls: rooms under a roof keep their own colours and shade keeps little of it. Drawn on each screen; the scene's lighting and darkness are never changed. Turning it on turns off Calendaria's own "Sync Scene Ambience with Time of Day", so the map is not coloured twice.
- **Moonlight.** By night the moon tints open ground silver-blue and casts faint shadows from creatures and walls, by how much of it is lit (the brightest of the world's moons, from Calendaria or Simple Calendar Reborn): bright at full moon, nothing at new moon. A fixed sun follows the clock too: by night the moon shines from the same spot.
- **Clouds hide the sun and the moon.** Calendaria's weather (or the scene's own weather) dims shadows, light through windows and the dawn and dusk colour: fainter under clouds, none under a storm. The scene's Shadow strength still applies on top.
- **Light through windows.** The sun shines through windows and open doors onto the floor under a roof, from where it stands: short pools at noon, long golden shafts at dawn and dusk, silver under a bright moon. Windows are Foundry's window walls or glass (light none, movement blocked) at real sizes; a door between two rooms lets no daylight through.
- **The sun dial shows the moon** by night, with its phase, its place in the sky and its faint shadow.
- **Smoke and heat haze per light.** Ambient Light configuration → Light Animation → Animater: Smoke and Heat haze, each Auto, On or Off.
- **Fixes:** a calendar not yet ready no longer lights a time-of-day scene with a full sun at night; creatures hidden from this screen (out of the selected token's sight) cast no shadow; colour no longer shows tokens as dark shapes through roofs.

## 2.4.20 (2026-11-02)

- **Play once plays your whole animation.** A Condition / effect recipe of your own set to play once now shows its lasting layers for their full length (a 6 s ward turns all the way round), instead of fading after 3 seconds. Built-in looks still show for their brief moment.
- **Re-applied D&D 5e effects play again.** Applying a spell's effect to a creature that still has it disabled re-enables that effect rather than creating a new one; it now animates as freshly applied, for while-on-token and one-shot effect recipes alike.

## 2.4.19 (2026-11-02)

- **D&D 5e spell effects in any language.** An effect a spell applies to its target now plays its Condition / effect recipe when the world is translated: the recipe bound to the spell's compendium effect, or named after the spell in English, finds the target's copy ("Protection contre le mal et le bien") through the spell that applied it.
- **Drop an effect on an effect recipe.** A Condition / effect recipe now takes an Active Effect dropped from a sheet or compendium, and a bound compendium effect shows its spell's name instead of "Unavailable item".

## 2.4.18 (2026-11-02)

- **Tokenshade travel looks, redrawn.** Ropes, vines, chains, tongues, snares, silk and bolas are now shaded, textured and lifted off the ground with their shadow beneath: a twisted rope that wraps round its target, a thorned vine with leaves cracking like a whip, polished chain links, a burning chain shedding embers, a glossy tapering tongue, a bola spinning in an arc, a snare that cinches tight, a silk wad that bursts into a web, and glowing motes with trails.

## 2.4.17 (2026-11-02)

- **Top-down tokens get their own condition looks.** On a top-down or pop-out creature (cut-out art, not a ring token) nothing is painted on the ground under it, nothing assumes a head at the top, and stars, question marks and other glyphs circle over its body on a flat circle seen from above. Doom loses its ground sigil, Blinded dims the whole body, and no fake drop shadows are added.
- **Prone, pressed flat.** A prone top-down creature drops where it lies, flattens into a drawing (flat tones under dark ink) with dust settling round it, and its long shadow shrinks to a tight one under it. Every prone creature now casts a short shadow.
- **Conditions move the art itself.** Paralyzed, Petrified, Unconscious and Dying hold a Tokener animation still; Slowed, Fatigued and Prone slow it; Quickened and Frightened speed it up. It plays as before when the condition ends.
- **Effects stay on the body.** A lasting effect on a top-down creature (Blaze's flames) burns only on its body, not across its square; wards, domes, condition badges and markers keep their own shape.
- **Every generated animation checked.** A frame-by-frame audit of all 2,022 looks in the generated PF2e, D&D 5e, SF2e, Daggerheart and Draw Steel catalogs fixed 451 of them: condition badges no longer show a syringe, biohazard sign or bee on unrelated effects, Petrified and other conditions change the creature itself, kanji hunter's marks became an eye, and many tints that turned clips black are corrected.
- **New Tokenshade looks:** Dragon, Fiendish, Feathered and Luminous Wings; Fungal Growth, Mycelium, Coral Growth, Scaled Hide and Ink-Smeared; Chattering, Weighed Down, Spirit Current and Clinging Silk. In the Tokenshade studio, wings and growths sit under Body forms.
- **Tokenshade travel looks.** A travel or projectile stage can now be drawn instead of playing a clip: a rope that coils round its target, a vine, a chain or burning chain, a tongue, a thrown snare, silk wad or bola, or a stream of motes. Ropes, vines, tongues, snares and energy drains across the catalogs use them, and the studio's new Travel tab previews each one.

## 2.4.16 (2026-11-02)

- **Every animation checked against what it shows.** A frame-by-frame audit of all 1,754 looks in the hand-written designs fixed 161 of them: radiant bursts, tremors and judgement waves no longer leave a ring of music notes; Second Wind's heartbeat beats instead of flatlining; stomps and quakes crack the earth instead of glowing like lava; Enlarge, Reduce and Rulership lose their charm hearts; curses show blood and withering instead of a radiation sign and a treble clef; red rage, blood and spore effects are no longer tinted to black; Beheading Buzz Saw flies forward; Prismatic Sphere's seven layers nest as coloured domes; and many more.
- **More Tokenshade where JB2A falls short.** Paralysis, poison, sickness, corrosion, drowning pressure and heat change the creature itself; more sound cones roll out as waves; more swarms swarm; skulls, notes, radiance and ripples are drawn on the ground. Every one keeps its animation for worlds without Tokenshade, and on JB2A Free.
- **Fix: oversized art no longer oversizes effects.** A token whose art is scaled past its square (a Tokenizer pop-out) gets effects sized to the creature, not to its art.

## 2.4.15 (2026-11-02)

- **Breath weapons, reworked.** A creature rears back with a deep inhale, roars, and the breath is out at once: each clip plays from just before it forms to its fade (a lightning breath is out in about two seconds and over in under five, not nine). Its sound is layered like Chain Lightning's: the inhale, a dragon's roar, then its element when the breath is fully out (a lightning bolt and thunder, a gout of flame, a freezing gale...), each ringing out and fading. Creatures react when the breath reaches them. Lightning keeps its own colours; void, radiant, cold lines, sonic and other breaths have art of their own; its light flashes along the breath as it leaves the mouth instead of washing the map for seconds.
- **Sound drawn as waves.** Where no animation fits sound poured out in a cone or line, Animater draws it: pale waves rolling out from the mouth (sonic breaths, Thunderous Strike, Wail, Eagle's Cry, Ponpoko-Pon!, NPC sonic cones and lines). Any cone or line set to the Tokenshade area look gets them.
- **Swarms drawn as swarms.** Insect clouds, locusts, ants, bees, mosquitoes, maggots, rats and vermin are now hundreds of small dark bodies swirling round a creature or pouring over an area, instead of glowing motes.
- **Bodies that change, change.** Skin turning to stone or iron, bark growing over a creature, nets, ropes and chains binding it, rust and mud: 35 effects now change the creature itself with Tokenshade instead of floating a recoloured swirl over it. The stage editor has the option too (Tokenshade look on the creature); where Tokenshade cannot play it, the animation plays as before.
- **Better-fitting animations.** An audit of recoloured animations swapped 28 for ones that fit: real insects and mayflies, mud, slime and bile splashes, glass and red-hot shards, falling stars, a water jet, rain, crimson mist, a healing glow, a blue-white plasma wall, and projectiles that no longer end in a skull or biohazard burst.
- **Effect lights.** A long animation played once (a breath) flashes and settles instead of holding a steady glow, and a line of it lights the ground along it rather than a map-sized circle. New stage option: Effect light starts after (ms).
- **Fixes.** A disabled Concentrating effect no longer draws sustain threads. A Tokener top-down token is no longer darkened in a disc by a big creature's shadow.

## 2.4.14 (2026-11-02)

- **Animated tokens cast moving shadows.** A token whose art plays (a video, such as Tokener's animated top-down tokens) casts its shadow from its own frames as they play, so its wings and tail move in its shadow too.

## 2.4.13 (2026-11-02)

- **Shadows stay while a creature casts.** A creature playing one of Animater's animations (a spell's cast, a lunge, a recoil) no longer loses its shadow until the animation ends; it only leaves no steps or dust meanwhile. A teleport still takes the shadow away while the creature is gone.

## 2.4.12 (2026-11-02)

- **No more white circles near walls.** A shadow cut off at a wall could leave its cut-out shape drawn as a white patch the size of the light's reach, most often for a moment after a refresh, before each creature's shaped shadow was made.

## 2.4.11 (2026-11-02)

- **A height for each wall's shadow.** Wall configuration has an Animater shadow section (Shadow top and Shadow bottom, in the scene's units) when the Wall Height module is not on; empty, a wall takes the level's ceiling, else the Wall height setting.
- **Big creatures half in a wall's shade keep half their sun shadow.** Shade is measured across a creature's footprint, not only its middle, so a dragon with part of it in the sun still casts that part's shadow.
- **Big creatures' shadows are as crisp as small ones'.** A large creature's silhouette is made at a size close to how it is drawn, instead of stretched (and blurred) several times over.

## 2.4.10 (2026-11-02)

- **Draw Steel support.** Hero abilities from the system's Abilities compendium play their own animations, designed from each ability's element, shape, class style and name; every other ability (monsters, homebrew) plays its look's fallback with its forced movement and conditions; the ten conditions show as lasting looks. Verified with Draw Steel 1.1.2.
- **Walls cast shadows in sunlight** (new setting, off by default). Each wall that stops light throws a soft shadow away from the sun, longer as it sinks and moving with the time of day; windows and foliage cast half, open doors none. Wall height comes from the Wall Height module's top and bottom (a raised wall leaves a lit gap beside it), else the level's ceiling, else a new Wall height setting. A creature standing in a wall's shade casts no sun shadow of its own.
- **No sun indoors.** Inside a region that suppresses weather, creatures cast no sun shadow (only their lamps') and walls cast none.
- **Creature shadows stop at walls.** A shadow reaching a wall that stops its light ends there, and a creature's sun shadow no longer darkens floor a wall already shades.

## 2.4.9 (2026-11-02)

- **Every light casts its own shadow.** A creature lit by the sun and several lights shows a shadow away from each (the four brightest), each fading in and out on its own, instead of one shadow from all of them averaged.
- **Light spell orbs cast shadows.** A light's strength now comes from Foundry's own settings: its bright and dim radius, luminosity and attenuation. Its colour intensity only tints, so PF2e's Light spell (intensity 0.05) shines as brightly as a torch.
- **Shadows flicker with their light.** A torch, flame or siren light's shadows darken, shorten and sway as its flame flares, in step with Foundry's animation of it; a pulse light's swell and ebb.
- **Big creatures cast proper shadows.** A dragon's shadow is as dark as a cat's, only bigger, and a creature taller than a light (a torch on the ground) still casts one. Large and bigger creatures standing between a light and smaller ones put them in their shade, within each token's ring.
- **Deeper shadows by a lone light.** At night, a creature lit by a single light casts a darker shadow; beside other light or in daylight, as before.
- **No more round shadow under tokens.** The soft disc under every standing token is gone; free-standing token art (no ring) gets a tight shadow hugging its own outline instead.

## 2.4.8 (2026-11-01)

- **Valued conditions change without a flash.** A condition changing value soon after it landed (Drained 1 to 3) no longer replays its landing, which started again from the plain token. Several updates at once (PF2e updates the condition, then the actor) also keep the old look until the new one is up.
- **Landings end as the condition looks.** Drained, sickened, doomed, petrified and persistent poison each land on exactly the look they then keep, at the same strength, and crossfade into it, so the colour no longer shifts as the landing ends.
- **Off-guard shows nothing.** It is on creatures all the time (flanked, prone, grabbed) and only cluttered them. A GM can still pick it in the catalog.
- **Works with PF2e Effects Halo again.** Hiding the light icons (2.4.7) stopped Halo from arranging the other icons round the token.

## 2.4.7 (2026-11-01)

- **No plain token between looks.** A condition landing (stone creeping up, sickness spreading) now holds its transition until the lasting look has fully faded in, and a condition changing value (Frightened 2 to 1) keeps its old look until the new one is in, so the bare token never flashes between them.
- **Condition looks, from the audition.** Sleeping and unconscious show only their Z's and the dimming, no breathing. Doomed lands with its own look growing in (rune ring, veins, dark halo) instead of a pink wash. Off-guard (and flat-footed, vulnerable, marked, surprised) is an amber caution ring, no longer red like dying. Wounded is drawn with a new realistic stain: blood soaked in with uneven edges, darker where it pooled, a dried rim and flung droplets, more at each value. Mud-caked uses the same stain in gritty brown.
- **Hide light icons on tokens.** A new world setting, on by default: a creature drawn holding its torch or lantern, or with a Light spell orb at its shoulder, leaves that light's status icon off its token (the lit torch, Spell Effect: Light). Thanks, Sherp.
- **Coloured flames.** A held torch's or lantern's flame, glow and sparks take its light's colour: an Everburning Torch with a blue light burns blue. Orange, yellow, white or no colour keep the natural fire. Thanks, Sherp.

## 2.4.6 (2026-11-01)

- **Signs circling over the head.** A new Tokenshade filter, Circling over the head: little stars, sparkles, hearts, question marks or dizzy swirls going round on a tilted ring, passing behind the head and coming round in front. Stunned has stars, confused question marks, stupefied dizzy swirls (more at each level), fascinated golden sparkles and charmed hearts, so they read at a glance even zoomed out.
- **Doomed and blinded show from afar.** Doomed has a dark rune ring turning under the creature, stronger at each level; blinded a much heavier black veil over the head.

## 2.4.5 (2026-11-01)

- **No snow indoors.** With Weather on creatures on, a creature under a roof (a Suppress Weather region) kept a faint dusting of snow: the frost faded with the weather but the snow itself stayed. Now the snow goes too, so a sheltered creature is dry and clean.

## 2.4.4 (2026-11-01)

- **Tokens that cast no shadow.** A new "Animater casts no shadow" checkbox on the token sheet (Appearance), on placed tokens and on an actor's prototype token. Ticked, the token has no shadow on the ground or in flight: for a ghost, a marker, or art with its shadow drawn in.

## 2.4.3 (2026-11-01)

- **A spider's Web shoots silk.** An NPC Strike named Web (or Silk) now shoots a white strand of silk, splashes webbing over the target and wraps it on a hit. It used to borrow the bola's look, which flies a mace.
- **Condition looks that fit.** Many Tokenshade condition looks were a colour tint and a glow, too alike to tell apart, and some turned the whole token, which reads as a spin from above. Sickened now comes in waves of nausea, a sickly flush welling up and ebbing; frightened is pale and shivering with the dark closing in; slowed wades through amber; stunned sees stars; confused swirls; clumsy lurches; grabbed is held by a hemp rope; paralyzed twitches instead of frosting over; suffocating gasps; deafened has rings of sound dying away. Fatigued, enfeebled and encumbered breathe and shrink from the middle.
- **Zzz.** Sleeping and unconscious creatures have small Z's drifting up out of their heads.

## 2.4.2 (2026-11-01)

- **A switch for every shadow.** Two new settings under Floor & world: "Shadows in creatures' shapes" (off: round shadows, which still fall away from the light) and "A shadow for each light" (off: one shadow per creature, from the stronger light). They, "Shadows under every token" and "Flier shadows fall on creatures" each have their own row and an "on my screen" switch for slower computers.

## 2.4.1 (2026-11-01)

- **Your own light casts your shadow.** A creature carrying a torch or lantern, or with a Light orb at its shoulder, now casts its shadow away from that light. Before, a creature's own light was left out, so in the dark it had no shadow at all. A plain light at a token's middle still casts none.

## 2.4.0 (2026-11-01)

- **Shadows in each creature's shape.** A flier's shadow is now its own outline (wings, tail and all) instead of a round blob, laid flat on the floor and softer the higher it flies. It breathes with its hover: a little larger and fainter as it rises. With "Shadows under every token", standing creatures cast their outline too. Art with no outline of its own (an opaque square portrait) keeps the round shadow. Dynamic-ring tokens cast the creature, not the ring.
- **Shadows follow the light.** A shadow falls away from the strongest light reaching the creature, and as far as that light really throws it: short under a light high above, none from a light below a flier. It is dark and crisp in a light's bright radius, faint and soft in its dim light, and swings round smoothly as the creature passes from one light to another.
- **The sun.** A new Sun and time of day window (Animater settings → Floor & world) sets the world's default sun: following the time of day (long shadows at dawn and dusk, short at noon, none at night), fixed where you put it, or none. The time, sunrise and sunset come from Calendaria, Simple Calendar Reborn or Foundry's own clock. Each scene can choose its own sun (Scene configuration → Environment → Animater sun), on a dial of the map with a day ruler to preview any hour.
- **A shadow for each light.** A creature lit by both the sun and a torch casts two shadows, each as dark as its light's share: in full day the torch's is faint, at dusk both show, at night only the torch's. A light only casts a shadow if it is above the whole creature, so a torch beside a dragon, even one low in the air, throws none.
- **Shadows that fit together.** Every shadow follows the same rule: as long as its light really throws it (long under a low sun or beside a torch, short at noon), stretched along the light from a standing creature's feet, crisp in sunlight and softer in dim light. Shadows are darker overall, and standing creatures keep a soft contact shadow under their feet, so they sit on the map even at noon.
- **Faster.** Animater's per-frame cost on a busy scene dropped by about three quarters: setting values are kept until they change instead of re-read every frame (Foundry scans every stored setting on each read), and a still creature's shadow is left alone once it has settled.
- **An unlit torch stays unlit.** A creature holding an unlit torch while it has some other light no longer shows the torch burning.

## 2.3.1 (2026-11-01)

- **Lanterns look like lanterns.** The lantern a creature carries is now an iron hanging lantern: a wire handle, a vented cap, three glass panes between iron posts, and a candle inside whose flame lights the glass and flickers like the torch fire.
- **The right light in hand.** A creature carrying both a torch and a lantern shows the one that is lit. A running Light spell shows its orb even when the creature holds a lantern.
- **Prototype tokens.** Animater's token settings (which side the light is held on, how it shows, where breath comes from, blood colour, creature voice and movement sounds) are now on an actor's prototype token too, so new tokens dropped from it get them.

## 2.3.0 (2026-11-01)

- **Tokenshade page.** A new page in the Animater window (Tools → Tokenshade): every Tokenshade look in a list grouped by kind, a live preview on a map, light or dark background, the layer editor beside it, shuffle, share codes to copy and paste, and "Add to animation" to put the look you made into any recipe. Recipes get their own Tokenshade lane in the timeline.
- **Transitions and live looks.** Looks can now play once (dissolves in ten styles and five directions, colour washes) or follow the game: hit points lost, height, whose turn it is, darkness and weather. Looks crossfade in and out instead of popping.
- **Tokenshade across Animater.** Knocked-out creatures partly dissolve, vanishing finishers dissolve away, finisher fragments can carry a Tokenshade look, teleports dissolve and form again where they land, summoned creatures form in, and conditions such as Petrified or Doomed play a transition as they land.
- **Conditions grow with their value.** Frightened, Drained, Doomed, Dying, Sickened, Stupefied, Enfeebled, Clumsy and D&D's Exhaustion show a stronger look at each value. The new setting "Condition looks grow with their value" switches this off.
- **Region looks.** Give a region an Animater look (Region configuration) and every creature inside shows it, fading in and out as they come and go. New looks for places: Haunted ground, Firelit, Moonlit, Fey glade, Heat shimmer, Cold mist.
- **The world reacts.** Fire creatures shimmer with heat and cold ones breathe mist. Creatures near a light take on its colour, with a rim on the side facing it. Frost left by a spell is ice underfoot, acid is mud, and fire burns grass bare and melts snow. With the new "Weather on creatures" setting, every creature is soaked in rain and dusted in snow, unless under a roof.
- **Fire you can see.** Torch and flame lights get heat haze and a trail of smoke. A creature with a torch light holds a burning torch in its square (Token configuration: which side, or none), its light coming from the flame. A creature holding a lantern carries it swinging from its hand.
- **Light spells as orbs.** PF2e's Light and Everlight (and D&D's Light) float as a small glowing orb at the creature's shoulder in the light's own colour; Dancing Lights become four wisps circling it. The catalog's own Light marker steps aside while the orb shows.
- **Sustain threads.** While a creature sustains a spell on another (PF2e and SF2e sustained spells, D&D concentration and the creatures it summoned), a faint shimmering thread runs from the caster to it.
- **Fliers.** Fliers kick up dust as they take off and land, their shadow falls on the creatures below them, and effects on a hovering creature bob with it. Creatures drip after swimming or wading through water.
- **Settings for all of it.** Every new effect has a world setting and an "on my screen" setting for players on slower computers, plus a Smoke amount slider.
- **Fixed: lasting effects after a reload.** Right after reloading, lasting condition and effect animations could fail to come back on the scene until something changed. They now always return.

## 2.2.32 (2026-11-01)

- **Aura style.** A new world setting (Animater settings → Look & light): keep auras as JB2A animations, or let Animater draw them with Tokenshade. A Tokenshade aura is drawn on the ground under the tokens: a crisp line exactly at its reach, and a band of the aura's own motif in its colour just inside it (runes, hexes, flame, frost, wind, vines, sparks, ripples, shadow, radiance, storm, music notes, skulls, hearts, eyes, blades or drops), picked from the aura itself, with nothing over the creatures inside. Lighter on slower computers too. The aura's small accent around its creature stays.
- **Clearer token looks panel.** Holding Shift over a token now labels each look: Aura, From an aura, Effect or Condition.
- **No double aura on its source.** A creature giving off an aura (a marshal in their own Marshal's Aura) no longer also shows the effect its aura hands back to it; allies inside keep theirs.

## 2.2.31 (2026-11-01)

- **Calmer auras.** No aura fills its whole radius with heavy footage any more: glyph circles, vortexes, whirls, flow fields and fire rings now sit as a small accent around the creature. Each aura's own light motion (themed orbits, leaves, wind, drifting motes in its colour) spans its reach, and a thin ring in its colour marks the edge, its style differing from aura to aura. This covers PF2e auras, Workbench and patreon-v3 module auras, homebrew auras and SF2e auras.

## 2.2.30 (2026-11-01)

- **Auras outside combat.** A new world setting (Animater settings → Look & light) for auras while no combat has started on the scene: show them, draw them subtle, or hide them until initiative is rolled. Allies inside an aura keep their small copy, and every aura shows as usual in combat.
- **Footsteps outside combat.** A new world setting (Animater settings → Sound) for a party walking about the map in exploration: footsteps and other movement sounds play normally, quieter (half volume, heard within 3 squares) or not at all until combat starts.

## 2.2.29 (2026-10-31)

- **Cleaner token looks panel.** The panel you get by holding Shift over a token's tooltip no longer has a close button: letting go of Shift closes it.

## 2.2.28 (2026-10-31)

- **Subtle effects, conditions and auras.** A new world switch (Animater settings → Look & light) draws every catalog effect, condition and aura look on a creature smaller, fainter and calmer, for tables that want only light touches. An aura's ring keeps its size so its reach still shows. Attack and spell animations and your own recipes are unchanged.
- **Reuse timers show nothing.** Treat Wounds, Battle Medicine, Guidance, Shield and Rage temporary HP immunities are bookkeeping, not magic: they no longer put a ring on the creature. Pick one in the effects catalog to bring it back.
- **Gentler Bless and Courageous Anthem.** Bless is a small, faint warm glow at the feet; Courageous Anthem shows a few golden music notes instead of a red battle orbit.
- **Act on a look from the token.** Hold Shift while a token's hover tooltip shows to get its lasting looks with buttons: Hide here (until the effect is applied again), Always off (left out of its catalog) and Flag (for a new look). Let go of Shift for the tooltip again.
- **Flagged looks.** A new Flagged page (Tools) lists every flagged look: open it in its catalog, clear it, or copy the whole list to send Animater's author. Flagged entries carry a badge and a filter in the Conditions and Effects catalogs.
- **Full names in Now playing.** Activity's Now playing shows "Bless" instead of "Spell Effect…": the shared prefix is dropped and long names wrap.

Thanks to DoritoBob for the feedback.

## 2.2.27 (2026-10-31)

- **Auras of flying creatures stay on the ground.** A layer drawn below a token (a lasting stance or aura, a one-time aura) followed its token's elevation, so under a flying creature it covered every creature on the ground. It now sits on the floor under its token and still follows it across the map. Thanks to ythguanK for the report ([#13](https://github.com/roileaf/animater/issues/13)).

## 2.2.26 (2026-10-31)

- **Spell Arsenal ground marks wait for the spell.** A Spell Arsenal area's scorch used to appear right after the area was placed, before the fire had played. It now waits for Spell Arsenal's own tiles and lands as their burst ends.

## 2.2.25 (2026-10-31)

- **Spell Arsenal spells leave ground marks.** A harmful area that Spell Arsenal animates (its tiles, with or without "Also play Animater recipe") now leaves Animater's ground mark too: Fireball scorches the floor in the placed area's shape on every screen. Follows the usual Ground marks settings.

## 2.2.24 (2026-10-29)

- **Lock players' Animater options with BBMM.** Where Big Bad Module Manager is active, each player's own Animater options (damage lens, tunnel vision, heartbeat, screen tint, camera shake and the rest) are also listed in Configure Settings, under the same tabs as the Animater settings window, so a GM can lock them or push a default to every player with BBMM's lock icons. Without BBMM nothing changes.

## 2.2.23 (2026-10-29)

- **Rings hug Small and Tiny creatures.** Effects on a token with Foundry's dynamic ring are sized to the creature as drawn (texture scale ÷ ring subject scale), not its bare square. Shield's bubble and other lasting rings no longer stand off a Small or Tiny creature with a gap; Medium tokens are unchanged.

## 2.2.22 (2026-10-28)

- **Strategic Strike has its own sound.** An investigator's Strike on a devised stratagem now plays a violet precision flash on the target with GGG's new Strategic Strike sound (GGG 0.2.3), on top of the weapon's own Strike. Turn it on in the Features catalog, like Sneak Attack.

## 2.2.21 (2026-10-28)

- **Sustaining with PF2e Combater keeps the spell's animation.** Combater's Sustain re-posts the spell card. Animater used to read that as a new cast and replay it; now Spiritual Armament's hovering weapon (and any sustained lasting animation) simply stays, counted as sustained this round. Needs PF2e Combater 2.6.7.

## 2.2.20 (2026-10-28)

- **Animater's own sounds in the media library.** Every sound Animater ships, 8,227 files, can now be found in the Assets library under the source Animater: creature voices, creature movement, and hits and surfaces, each sound one card with its takes as variants. Audition them and put them on a sound stage like any sound pack's.

## 2.2.19 (2026-10-28)

- **Screen tint.** An elemental spell washes the view in its element's colour for a moment as it lands: a Fireball glows orange, lightning strobes electric blue, cold blinks icy blue, void dims the screen. Bigger areas tint more and a far-off blast less; Chain Lightning blinks again on each leap. Weapon Strikes never tint. Settings: Screen tint (world), on my screen, and strength, under Look & light. With reduced motion, lightning flashes once instead of strobing.
- **Lightning convulses its targets.** A creature struck by electricity (Chain Lightning, Lightning Bolt, an electric breath, any catalog) convulses instead of a plain hit shake: it locks stiff, twitches in three weakening bursts and slumps as the current lets go. Taking electricity damage plays it too. The motion is also in the recipe editor as Electrocuted convulsion.
- **A scarier Chain Lightning.** The air charges as it is cast, a thunderbolt cracks loose, thunder crashes on the first creature, and each leap lands as a full strike instead of a short tick.
- **Catalog sounds audited.** Every catalog's sound choices were checked against what the ability does, and about 400 were fixed:
  - PF2e spells (143): harmful void spells no longer play a healing chime, teleport spells no longer sound like summoning, summon, polymorph and teleport spells that were silent now have a cue, and meteors, quakes and storms got bigger sounds.
  - PF2e feats and weapons (104): bites and horns pierce, picks swing like axes, crossbows, darts and harpoons keep their own sounds, regaining a Focus or Mythic Point is no longer a heal, and elemental wards no longer clang like metal shields.
  - Daggerheart cards (about 75): card words no longer match inside other words (Voice is no ice, Flight no light), Bone domain cards strike instead of draining, and whips crack.
  - D&D 5e, PF2e and SF2e bespoke designs (about 40): breath weapons roar, ropes and nets lash, big blasts sound big, and generic NPC breaths and bursts use their shape's sound.
  - Sound files: hits that were whooshes, 10-20 second loops used as short hits, nearly silent takes and a dragon roar that was a whoosh were replaced.
- **PF2e Creature Sounds stays its own.** Animater no longer plays any of that module's files in its catalog sounds.

## 2.2.18 (2026-10-28)

- **Players' private rolls animate for the player and GM.** An attack, spell or action a player rolls in Private GM Roll mode (Spiritual Armament, a Strike) played nothing at all, not even for the GM. It now plays for those who can read its chat message: the roller and the GM, or the roller alone for a Self Roll, with its real result. Other players see and hear nothing, and finishers that would move tokens stay off. Blind rolls stay hidden. PF2e, SF2e and D&D 5e.

## 2.2.17 (2026-10-28)

- **Shield's bubble sits over the token (PF2e).** The lasting Spell Effect: Shield bubble was drawn under round token art, so only a faint rim showed past the ring. It now encloses the creature, faint enough to keep the art readable.

## 2.2.16 (2026-10-28)

- **Heroic Inspiration glows (D&D 5e).** A character given Heroic Inspiration glows gold for a moment on its tokens, and flares bright when it spends it. The world setting Heroic Inspiration glow and each player's "on my screen" switch turn it off.
- **Mythic Points glow (PF2e).** A character who gains a Mythic Point pulses violet and gold; one who spends one flares violet. The Mythic Point glow setting sits under Hero Point glow.
- **Spiritual Armament summons your own weapon (PF2e).** The ghostly weapon takes the shape of the weapon the caster holds (an axe, a hammer, a spear, a sword and more; without one, their deity's favored weapon). After each strike it hovers at the caster's side and follows them, until a turn passes without sustaining the spell, a minute at most, or combat ends.
- **A calmer Bless (PF2e).** Bless's lasting field is fainter, so it no longer buries the map and the tokens in it.
- **A calmer Shield (PF2e).** Spell Effect: Shield now keeps the cast's force bubble up, in a faint blue on the token's ring, instead of a large, solid shield marker.

## 2.2.15 (2026-10-27)

- **Hero Points glow.** In PF2e and SF2e, a character awarded a Hero Point (from the sheet, the party sheet or a macro) glows gold for a moment on its tokens. The world setting Hero Point glow and each player's "on my screen" switch, under Combat drama, turn it off.
- **Effects stay inside the token.** Animater fits each animation's art to the token it plays on. It now counts an effect's faint glow and haze as part of its art, so the whole effect, glow included, stays within the token (and its ring) instead of spilling past it. Most effects are a few percent smaller; soft, hazy ones up to half.

## 2.2.14 (2026-10-27)

- **Enemy blood reaches whoever stands next to it.** A creature hurt in a fight now splashes its blood on the screens of the players whose creatures stand next to it, whoever struck it; a ranged attacker far off sees none. The new world setting Enemy blood reaches picks who gets it: adjacent creatures (the default), creatures within one square (reach), or only the attacker wherever it stands, as before.
- **Damage lens shows** now offers hits taken, creatures hurt nearby, or both, on the world and on each player's screen.
- **Every creature hurt at once splashes.** Several creatures hurt by one attack each leave their own blood, instead of the first one hiding the rest.
- The workspace's Damage showcase plays "An enemy hurt next to you" in place of "Your creature hits an enemy".

## 2.2.13 (2026-10-27)

- **15 more creature voices.** A wailing banshee, a moaning ghost, a snarling ghoul, a shrieking goblin, a stone golem, a bellowing ogre, raider orcs (female and male), a reptiloid, a roaring cyclops, a mutant and four more zombies (two female, two male), each with its own attack, hurt and death cries. Lizardfolk, iruxi and troglodytes now take the reptiloid's voice, and cyclopes, golems and mutants their own. Animater ships 150 voices.
- **A smaller download.** Creature voices recorded in stereo or at high sample rates are now mono 44.1 kHz, which is all a cry on the map needs: about 35 MB less to download.
- **Every voice credited.** The sound credits (assets/sounds/voices/License.txt) now list the bundled sound library's voices too.

## 2.2.12 (2026-10-27)

- **12 more creature voices.** Bats, swarms (a hornet), monitors (an alien pest), a witch, a cackling skeleton, a moaning zombie, a slime, a small spider, a ghost, a brute orc, a colossus and a young dragon now have voices of their own, each with its own attack, hurt and death cries. Animater ships 135 voices.
- **A voice group lists its own voices.** Choosing Man in Token Configuration → Animater creature voice listed orcs, ogres and trolls (female ones too), since they can stand in for a man. Each group now lists only its own voices, and borrows a related group's only when it has none.
- **Groups with nothing to play are hidden.** Elemental, construct, plant, treant, fey, celestial and small folk have no voices yet, so they no longer appear in the voice list (a token already set to one keeps it).

## 2.2.11 (2026-10-27)

- **Creatures cry out.** An attacking creature now and then grunts, snarls or roars, a hurt one now and then cries out, and one that falls always does, in a voice for its creature: a man or a woman, a goblin, an orc, a wolf, a bear, a dragon, a zombie, a ghost, a spider and many more. Each cry is a little different in pitch and level, and only those who could hear the creature hear it. Turn it off for the world or just your screen in Animater settings (Creatures cry out when they attack and are hurt).
- **123 voices ship with Animater.** Each has its own attack, hurt and death cries, grouped by creature (people, monstrous folk, animals, dragons and reptiles, insects, monsters, undead and spirits...). A group with no voice of its own borrows a related one. This makes the module about 280 MB.
- **Pick a token's voice.** Token Configuration → Appearance → Animater creature voice: its creature's own voice, Silent, or any group, then one voice of that group by name. Attack, Hurt and Death buttons preview it on your screen.
- **Works with PF2e Creature Sounds.** On PF2e with that module active, tokens keep its sounds unless you give them an Animater voice; then it is muted for that actor, and choosing Use PF2e Creature Sounds again brings its sound set back.
- **Your own voice folder.** Creature voices from my own folder adds a folder of your sounds (one sub-folder per voice, with `attack`, `hurt` and `death` inside). Folders missing a cry, and folders whose sounds Animater already ships, are skipped.

## 2.2.10 (2026-10-27)

- **Settings rows keep their text readable.** A row with two dropdowns (Damage lens shows) squeezed its description into a narrow column. When a row's controls leave the text too little room they now sit under it, and in a narrow window they wrap instead of running off the side.

## 2.2.9 (2026-10-27)

- **Teleports reach their spot in D&D 5e.** With D&D 5e's full movement automation, a teleport Animater moved stopped beside the first hostile token on the straight line to its destination. Teleports and fetches now ignore tokens, walls and terrain on the way, as a teleport should.
- **No "Wounded view" error on the GM's screen.** Selecting a token as GM logged a Blocked "Wounded view: Cannot read properties of null (reading 'life')" in the Activity panel. The GM has no wounded view, and now nothing is logged.

## 2.2.8 (2026-10-26)

- **Module auras in the Effects catalog.** The auras PF2e Workbench and patreon-v3 put on a performer (Aura: Courageous Anthem, Rallying Anthem, Dirge of Doom, Bane, Malediction, Song of Strength, Triple Time, Protector's Sphere, Desert Wind and more) are now Effects catalog entries under **Module auras**, listed while their module is active. An aura both modules ship is one entry, so leaving out Courageous Anthem leaves out both versions. Each has its own field at the aura's radius (a gold field of song for Courageous Anthem, a dark inward field for Dirge of Doom), and can be customised or left out like any built-in aura.
- **Auras that hand out an effect look like auras.** A PF2e aura with no animation of its own (a homebrew "Aura: Courageous Anthem" that gives allies Spell Effect: Courageous Anthem) used to borrow that effect's look, so the aura's owner and every ally in it looked the same. Its owner now shows a ring at the aura's radius in the effect's colour, around the effect's own look, and the allies inside keep the plain effect.

## 2.2.7 (2026-10-26)

- **Damage lens shows.** A new choice in Combat drama: the damage lens and damage type effects for hits a player's creature takes and deals, only the hits it takes, or only the hits it deals. The GM sets it for the world; each player can pick their own with **Damage lens shows on my screen**.
- **Footstep sounds switch.** **Footstep sounds** (Sound tab) turns off footsteps, wing beats and other movement sounds for everyone, and **Footstep sounds on my screen** for one player. Giant footfalls still shake the view.
- **Take over from Trigger Animations.** With **Take over from Trigger Animations when Animater has an animation** on (Integrations, off by default), Trigger Animations skips the attacks, actions, areas, effects and conditions Animater animates, its wildcard and Trove triggers included. A trigger made for that very item (naming its UUID) still plays.

## 2.2.6 (2026-10-25)

- **Flash screens after the finisher.** **Last One Standing**, **Enemy Defeated** and **Party Member Down** played the moment a creature dropped, on top of its kill finisher. They now wait for the finisher to end (Finish Him! still plays before the last enemy's finisher).
- **No more "stretching over a distance of 0" errors.** A flying effect with nowhere to go (its start and end on the same spot, such as during a finisher) is left out instead of raising a Sequencer error, and a melee swing on the same spot plays without stretching.

## 2.2.5 (2026-10-25)

- **Shockwaves that start where they should.** Raising **Shockwave reach** also made the ring rush outward faster, so by the time a blast's flash faded it was already far past where it started at 1.5×. The ring now leaves the blast at the same pace whatever the reach; a longer reach simply carries it further, for longer.

## 2.2.4 (2026-10-25)

- **Shockwave reach that behaves.** Raising **Shockwave reach** widened the ripple along with its distance, so at 3× the whole map slid and smeared instead of rippling; lowering it kept the ring inside the explosion, where the flash hid it. The ripple now keeps the same width at any reach (reach only sets how far it travels) and always runs at least a square past the blast. The setting now starts at 1×.

## 2.2.3 (2026-10-25)

- **Shockwaves you can see.** A big blast's ripple across the map (Map distortion) was drawn, but so faint and short that the explosion's own flash hid it, worst with D&D's Fireball. It now runs twice as long and bends the map clearly past the edge of the flash, stays visible on zoomed-out views, and plays even on a busy scene whose frames are running slow.

## 2.2.2 (2026-10-25)

- **Tidier settings window.** Dropdowns keep one width everywhere (the Damage lens amount and Walked path highlight ones no longer stretch across their row), a row's only dropdown has room for its longest choice (Animation quality shows in full), two sliders side by side no longer squeeze their setting's text, slider value boxes fit values like 0.35 and -10, and **Wounded view on my screen** is now **Wounded view** (this screen).

## 2.2.1 (2026-10-25)

- **Damage lens duration.** Choose how long a big hit's blood stays on players' screens, in seconds: the GM sets **Damage lens duration (seconds)** for the world (4.5 by default, as before, from 2 to 20), and each player can set their own **Damage lens duration on my screen** (0 uses the GM's). Smaller hits stay proportionally shorter, drying, fading and each damage type's reaction stretch with it, damage type effects hold longer or shorter to match, and the tunnel vision eases out up to twice as slowly. The Damage showcase previews it.

## 2.2.0 (2026-10-25)

- **Damage lens: what a hit feels like, on players' screens.** When a player's creature hits an enemy, the enemy's blood splats across that player's screen; when the player's own creature is hit, its blood splashes the screen, the view closes in (tunnel vision) and a heartbeat thumps. The blood lands around the middle of the screen and grows with the damage: a scratch leaves a few flecks, a third of a creature's HP a solid splash, and about 60% of it (or any critical hit) a big, gory splatter of organic splats, thrown streaks, spray and drips that shine wet, dry and fade. It runs from the left edge of the screen to the sidebar, behind Foundry's interface, and is painted off the main thread so a big hit never stalls the game. Creatures a player cannot see, hidden tokens and bloodless creatures never bleed on their screen. The GM turns it on or off for the world with **Damage lens**; each player has **Damage lens on my screen**, **Damage lens amount** (Heavy or Subtle), **Tunnel vision when hurt** and **Heartbeat when hurt** in the Combat drama tab. It starts off where the browser asks for reduced motion, and a Blood sounds choice of Off turns it all off.
- **Every damage type leaves its own mark.** Slashing blood leaves scratches (sometimes a claw's set of marks), piercing jets of spray (sometimes a bite's punctures) and bludgeoning big bursts. The blood itself reacts: fire makes it fizzle, steam and cook to a charred crust; cold freezes its drips mid-run until it thaws; lightning fries its edges and sparks between splats; acid eats holes in it; poison gives it an oily sheen; void withers it black; vitality glows gold and evaporates it; sonic makes it ripple, force slams it flat, mental damage ghosts it, spirit thins it to wisps, and bleed keeps it running. Energy also spills less blood and shifts its colour. On top of the blood each energy type has its own short effect on the screen: scorched edges and embers, frost that thaws, lightning arcs, bubbling acid, a green poisoned sway, a sonic ripple, a cracked lens for force (and crushing crits), draining colour and veins for void, a blinding flare for vitality, double vision for mental damage, pale wisps for spirit, and a violet shimmer for Daggerheart magic. Up to two energy types per hit, stronger for more damage and clearly stronger and longer for crits, in PF2e, SF2e, D&D 5e and Daggerheart. The GM's **Damage type effects** and each player's **Damage type effects on my screen** turn the effects on or off.
- **Wounded view and going down.** Below half its HP, a player's own creature is felt on screen: dark red creeps in from the edges, deepening as HP falls and pulsing with the heartbeat at a quarter or less; a hit while hurt leaves a stain on the lens that stays until healed; and in combat at a quarter HP or less the music and ambience grow muffled. At 0 HP, dying or unconscious, the screen goes nearly black around a dim, blurred window, the world falls almost silent, and a faint, uneven heartbeat follows PF2e's dying value, D&D 5e's death saves or Daggerheart's last Hit Point. Waking up brings the view back in a warm rush; death lets the heartbeat fade and holds the dark a moment before it clears. The heartbeat slows as death nears, and creatures without a heart (undead, constructs, oozes, elementals, spirits, plants and fungi such as leshies) have none. Each player has **Wounded view on my screen**.
- **Damage showcase.** A new GM page plays all of it on the GM's own screen, exactly as players see it: pick a player creature and another creature (PCs and NPCs of the scene, mixed and matched), the damage %, damage type and crit, then play either way round; preview the wounded view at any HP and each down state (dying, unconscious, stable, dead, waking). Animater tucks itself away while a preview plays.
- **Blood colours by creature type.** Without Splatter, creatures now bleed the colour of what they are: dark red for humanoids and beasts, yellow-green ichor for aberrations, a paler green-yellow for insects and spiders, green sap for plants, near-black for zombies and vampires, a deep red for fiends, a faint gold for celestials; constructs, elementals, oozes, spirits, skeletons and objects do not bleed at all. The GM changes any of them, or gives a type no blood, in **Blood colours** (Combat drama tab), and a single token can have its own colour or none (Token configuration, **Animater blood colour**). The damage lens, blood drops on the ground and the showcase all follow it. With Splatter active, its Blood Sheet still decides.
- **Footstep hearing range.** A new world setting sets how far footsteps, wing beats and other movement sounds carry: Close (3 squares), Normal (6, as before), Far (10) or Very far (15); Huge and bigger creatures carry half as far again.
- **Rain wets the floor.** Out in the rain (Foundry's scene weather or FXMaster, not under a region that suppresses weather), dirt turns to mud, in its sound and its prints, and stone, wood, grass and sand splash quietly under every step (**Weather on the ground**).
- **Stronger camera shake.** **Camera shake strength** now goes up to 4×, and above 1× the shake also lasts longer (4× about twice as long). Thanks to y_deda_povis for the request.
- **Players choose breathing and hovering.** Each player now has **Idle breathing on my screen** and **Fliers hover on my screen**, under the GM's world switches. Thanks to y_deda_povis for the request.

## 2.1.8 (2026-10-25)

- **A live check for stealthy movement.** For testing in a world: select the observing token and run `await (await import('/modules/animater/tools/live/hidden-footsteps.mjs')).run({ target: 'Ed' })` in the browser console. Animater walks the target past the observer at several distances (on that screen only, then puts it back) and reports, against the observer's PF2e Visioner state or the target's conditions, whether its tracks showed and its footsteps were heard where they should be. The module API gains read-only `debug.movementPerception(token)` and `debug.movementMarks(id)` for such checks.

## 2.1.7 (2026-10-25)

- **Tracks follow who is looking.** A creature's footprints, dust, splashes, trails and burrow holes now show only while the current point of view can perceive it. Select a token that PF2e Visioner says has not detected (or not noticed) a creature, and that creature's tracks vanish from your screen; select one that can see it and they come back. Before, tracks laid while you had the creature itself selected (to move it) stayed in view for everyone. A GM now perceives movement as the selected token by default (**GM perceives movement**: As my selected token); with nothing selected a GM still sees everything, and Everything remains a choice.

## 2.1.6 (2026-10-25)

- **Big D&D blasts shake and ripple.** Camera shake and map distortion barely ever fired in D&D 5e. A Fireball, Shatter or Meteor Swarm plays its whole explosion clip (four seconds and more), which Animater took for a lasting area, so it got at most a faint heat haze and no shockwave or shake. A placed circle also never counted as a round area. Now a one-shot blast sends its shockwave however long its clip runs, and a big round area (a sphere, cylinder or radius) ripples when its spell deals damage; a healing or detecting sphere stays calm. The settings window also says when this screen's animation quality never draws one of them: map distortion needs Full, camera shake Full or Light. Thanks to y_deda_povis for the report.
- **Midi attacks play once with weak workflow references.** With Midi-QOL's **Use Weak References for Workflows** on, a fast-forwarded attack (a Longbow shot, Sorcerous Burst) played its animation twice: once on the roll and again on Midi's verdict. Animater now recognizes Midi's attack either way, so each one plays once, on Midi's hits and misses. Thanks to y_deda_povis for the report.
- **Breathing and hovering switch separately.** Idle life now has two world settings under it: **Idle breathing** (living creatures' slow rise and fall) and **Fliers hover** (flying creatures bobbing in the air). Turn breathing off and fliers still stand out by hovering, or the other way round; both are on by default. Thanks to y_deda_povis for the request.
- **Breath weapons fill their cone or line.** Every D&D 5e breath in the Features catalog (Dragonborn **Breath Weapon** 2024 in either shape, the 2014 dragon ancestries, and monsters' Fire, Cold, Lightning, Acid, Poison, Sleep and other breaths) stopped after 2.2 seconds, while the breath was still growing out of the mouth, so the cone or line never appeared. A breath now plays its whole clip: it streams out, fills the area and fades. The same goes for breath art in the other systems' built-in designs (Kobold Breath, Daggerheart breath features and more). Thanks to y_deda_povis for the report.
- **One-shot clips no longer freeze.** A stage timed for the longest of its art choices held a shorter clip on its last frame for the rest of that time. Chill Touch with JB2A Patreon froze its two-second energy strands for two and a half seconds more; its casting flash froze too. A clip that plays once now ends when the clip does, after its fade-out, wherever it is used. Thanks to y_deda_povis for the report.

## 2.1.5 (2026-10-24)

- **Wounded token positioning.** Wounded and condition body poses now anchor to the token's current drawn center instead of adopting temporary damage-shake or recoil offsets. This prevents displaced artwork remaining outside its occupied square after major damage, while following native movement and restoring the latest position when the pose ends.

## 2.1.4 (2026-10-24)

- **Prone rotation compatibility.** Fixed a temporary action animation's rotation being adopted as a prone token's upright direction, producing a near-upside-down pose and leaving a sideways token after removing Prone. The prone pose now keeps its original direction while respecting deliberate document rotation changes.

## 2.1.3 (2026-10-24)

- **Revived token shape.** Fixed death collapses capturing an idle breath, wounded hunch or condition pose as the token's normal size and rotation. Reviving after combat now restores the original artwork geometry without reloading. The same handoff fix protects other one-off token motions.

## 2.1.2 (2026-10-24)

- **Visible underwater treatment.** Submerged swimmers now fade to a water-blue, translucent silhouette (35% opacity by default), including for the GM and owner, and return to their original alpha and tint on surfacing. The treatment and opacity are configurable under Movement effects; native visibility/detection remains authoritative. Bubbles are larger, brighter, more numerous and sized to the creature. Breaking the surface creates a large, creature-sized splash with expanding ripples and arcing spray, including stationary elevation changes.
- **Visual creature picker and cinematic entrances.** Replaced Creature showcase's dropdown with token-art cards, selected states and hidden badges. GM-only creature names identify tokens named Unknown. Boss entrances now build up to a synchronized impact across three visual layers, with a large token portrait, letterbox framing, styled title reveal and a bass accent for larger creatures. Each viewer can Skip/Esc locally. Camera return, visibility guards, reduced-motion support and cleanup remain in place; private creature names are not automatically used in public titles.
- **Softer plant movement.** Ordinary plants, vegetables, gourds and other leshies now use quieter bush/leaf rustling rather than creaking wood. Woody creaks require an explicitly woody creature, such as a treant, arboreal, animated tree or wood golem. Token body-sound choices now distinguish soft plant rustling from woody creaking; existing manual overrides remain available.
- **Swimming, underwater movement and deep burrowing.** Surface swimmers leave wakes; submerged swimmers leave bubbles and retain swimming sounds, without dirt trails, footprints or burrow holes. Water and explicit Swim movement below a level's surface no longer trigger the burrow sink. Swimming wakes, underwater bubbles and burrow paths have separate fade-time controls. A new relative-elevation cutoff (default -10) hides deep burrow paths while retaining surface entrance/exit holes. Raised levels use their own floor as zero. Existing shallow tracks fade normally; stealth and per-screen visibility still apply.
- **Removed Combat recap.** Removed automatic highlight recording/replay, recap settings, the Activity replay button, keybinding and macro API.
- **Movement footprint lifetimes by ground.** Added separate GM controls for sand, mud, snow, dirt, grass, stone, wood, water and ice in Animater settings → Floor & world → Movement effects. Set how many seconds until footprints, carried prints, creature grooves and flattened grass on each ground fully fade (up to one hour). Zero preserves natural lifetimes. Changes affect existing and new tracks; dust, blood, water ripples and burrow holes retain their own timing, and track budgets remain bounded.
- **Combat choreography preview.** New GM tool, Creature showcase: choose a scene NPC and preview its movement, attacks, breath weapons, abilities and spells in sequence against stand-in targets. Replay individual steps or stop at any time. Uses real embedded items and distinct D&D activities, preserves native area dimensions, skips passive helpers and duplicate inventory weapons, and lists actions without a playable preview. Previewing never rolls actions or changes token positions, visibility or actor data.
- **Boss entrances.** Creature showcase includes Dread, Arcane and Primal entrances with custom titles/subtitles, sound, volume and optional camera focus. Preview locally or play for everyone who can already see that creature on the scene. The camera returns afterward unless the viewer takes control; reduced motion and local animation quality govern camera/effects. Hidden creatures cannot be broadcast. Stop and scene changes clean up effects, audio and titles; only authenticated GM requests can start shared entrances.
- **SF2e and D&D NPC abilities.** Added native NPC tabs with searchable creatures, previews and automatic playback. SF2e 1.6.1 includes all 958 active action occurrences, grouped into 660 entries. D&D 5e 6.0.6 includes 1,593 active feature activities across 722 NPCs, grouped into 481 entries: 317 existing catalog designs, 124 new mappings and 40 spellcasting delegations. Passive and turn-boundary helpers stay excluded. Native spell activations retain their own effects, avoiding duplicate playback. Custom recipes, paused recipes and native catalog exclusions retain priority. NPC item-sheet Animation buttons open their system's NPC tab.
- **Action-sheet shortcuts.** The Animation button on a PF2e NPC action opens NPC abilities and selects its native action or shared design. PC action buttons open Actions, searched to the clicked action.
- **Workspace update compatibility.** Opening the workspace after its files update no longer crashes when the running client still has the older shared-only NPC module loaded. That client sees a reload notice; reloading loads the complete action library.
- **Complete indexed NPC action coverage.** Search all 6,109 native PF2e bestiary action variants by action, creature or trait, with 40 results per page. The remaining 1,921 variants now have explicit action-level designs or preparation cues, alongside 4,188 existing shared and data-based mappings. Physical guards, maneuvers, movement, equipment handling, recovery, communication, counters, wards and supernatural effects each receive fitting cues, including Magnetic Skink's Unsteadying Magnetism. Strike and spell sequences show their preparation and retain their native attack or spell animation. Individual and shared-family exclusions remain available, and native source matching keeps unrelated custom or foreign actions on their own semantics. Multi-recipient actions retain all selected recipients; protection appears on the intended ally. Both JB2A Free and Patreon support every new cue with token motion on or off. Native rules determine conditions, equipment changes and movement.
- **Complete NPC breath weapons.** Cone and line exhalations now play their entire native movie once, including its natural fade, rather than cutting off after about two seconds. The same fix covers other NPC area blasts using breath footage. Breaths can play on their placed area without selecting a creature target, and measured clip timing keeps playback and cleanup aligned. Megavolt's whole-clip timing also follows its measured lightning breath footage.

## 2.1.1 (2026-10-24)

### Performance and reliability

- **Faster creature movement.** Share primitive settings reads within each rendered frame and reuse stationary token metadata, while preserving immediate settings changes, perception, offscreen footsteps and moving-token updates. In a 100-token test scene, movement processing fell from about 7.3 to 0.3 ms per frame while stationary, and from 7.2 to 0.7 ms with 20 tokens moving; results depend on the device and other modules.
- **Lighter startup.** Load catalog data only for the world's game-system family and load the workspace when first opened. PF2e and SF2e retain both catalogs for crossover support; headless catalog tools retain access to every system.
- **Less background work.** Burrowing updates process changed tokens and active sink/rise transitions. Ordinary token changes refresh only that token's persistent condition layers; observer and global changes still refresh the whole scene. Batched changes merge without dropping unaffected layers or replaying stopped effects.
- **Sound cleanup.** Expired sound-shaping requests are removed even when their sound never plays. Pending requests are bounded and cleared when leaving a scene, with FIFO playback matching and safe handling of encoded sound paths.
- **Responsive quality changes.** Use the new setting value during change callbacks so animation quality and its routing flag remain synchronized. Deferred workspace loading also handles overlapping renders and closed windows safely.

## 2.1.0 (2026-10-24)

Creature movement, living tokens, cinematic combat and expanded NPC animation coverage. This release includes all changes since 2.0.3.

### Creature movement and sound

- **Movement feel.** Every token move now shows on the floor, whether it is dragged, moved along a ruler or by a macro, with a look of its own for every floor about every half square: tiny grey grit chips that hop out and settle on stone, fine light sawdust drifting low on wood (both with a faint scuff), a brown dust puff on dirt, bright yellow-green, dark-edged grass blades flicked up and back on grass while a tuft at the foot bends and springs back and the grass under each foot is trampled flat for a couple of seconds before it slowly springs back up, low pale spray thrown backwards on sand, a white powder puff on snow, ripples and droplets on water, cold glints that twinkle out and a thin skid on ice (now and then a hairline crack), and dark splatter flung short on mud. Sand, snow and mud also keep footprints, left and right in turn along the path: shallow ones in sand that fade in about 6 seconds, wet dark ones in mud that last about 12, and snow prints that linger about 20. Each creature leaves its own tracks, read from its traits or creature type and its name: boot soles for humanoids, giants, fey, fiends, celestials, undead and constructs (and every player character, unless their ancestry has hooves or talons), paw prints in staggered pairs for wolves, cats, bears and other beasts, three-toed talons for birds, griffons and raptors, broad, heavy clawed prints in staggered pairs with a tail drag for dragons, wyverns and drakes, hoof crescents for horses, deer, goats and centaurs, splayed clawed prints with a tail drag for lizards and crocodiles, one wavy groove for snakes, nagas and worms, a wide smear for oozes and clusters of tiny dots for spiders, insects and swarms, with bigger, sparser prints for Huge and Gargantuan creatures. Creatures Animater can't place (and wheeled things) still raise the floor's dust and make footsteps but leave no tracks, and incorporeal ones leave nothing at all. A flying token (its movement action is Fly, or it has a flying status; height alone is not flight, so a creature standing on a ledge or platform walks) kicks up nothing and casts a soft shadow on the ground instead, a flat ellipse at its feet, straight below it and centred left to right, so even a Gargantuan dragon's full-frame art shows it below the token; the higher it flies, the further down, smaller and fainter it is, following it as it moves. Set the floor with the new **Animater floor** choice in Scene configuration (Stone, Wood, Dirt, Grass, Sand, Snow, Water, Ice or Mud): **From the scene (auto)** picks dirt for scenes with global illumination or a name or background that sounds outdoors, stone otherwise. A Region named for water (river, lake, pond, sea, stream, swamp) is water inside, and a Region's own **Animater floor** choice overrides the scene's inside it. Animater's own teleports and motions keep their afterimages and leave no dust. Every floor also has its own quiet footsteps near the token, weighted by the creature: its size (Tiny to Gargantuan) sets how deep and loud each step is, from a pixie's light, quick patter to a giant's slow, deep tread, and a heavy body (constructs, golems and statues, giants, dragons, earth elementals) sounds deeper still; steps keep each creature's own beat whatever speed the token slides at, from a Tiny creature's quick patter through a Medium walk to a Huge creature's slow THUMP … THUMP and a Gargantuan one's slower still, and from Large up each step lands with a deep, weighty thud underneath, timed to the moment the foot strikes in that recording: an octave down for a Huge creature and lower still for a Gargantuan one, its slap filtered off and its low end boosted, with a sub-bass rumble under Huge and bigger, always the same deep thud for a given size, and kept clean (the bass boost is paid for in level and a limiter catches the layers, so it never clips) (every footstep is loaded with the scene, so none arrives late) (Huge and bigger are heard further away); each step picks a different recording from the last, in each creature's own order, with its own slight pitch and loudness, so a walk never sounds like a loop and two creatures never step in unison, and scaled by the **Volume** in the Hit sounds menu: free CC0 recordings bundled with Animater (Freesound recordings of real footsteps on each surface for stone, wood, dirt, grass, sand, water, mud and ice, and Kenney's Impact Sounds for snow, credited in the sound folders' License.txt). With PSFX active, dirt uses its outdoor footsteps instead. How a token moves (its movement action) changes the sound: a winged flier beats its wings while it moves (silent while it hovers still), while wingless and unknown fliers use an air pass, from a Tiny creature's quick flutter to a Huge or Gargantuan dragon's slow, deep WHOOMP, lower, darker and louder the heavier it is; a burrower churns the earth in a slow, deep rhythm and leaves a low ridge of dark, crumbly churned earth along its path that fades in about 8 seconds instead of dust or footprints, with a hole where it went under, the moment its elevation drops below the floor of its level (its earth thrown back as it dug in), and a wider one where its elevation comes back up (earth and gravel thrown all around); a creature below the floor churns this trail and digs as it moves even without the Burrow movement action, and one that only burrows along the surface makes no holes, each ringed by loose earth and lingering about 20 seconds (**Burrow holes**, world, to turn them off); a swimmer strokes through the water and leaves a V-shaped wake behind it on water; a climber's hands and feet grip the rock; a crawl is a quiet shuffle of body and clothes; and a jump whooshes as it leaves the ground and lands with a heavier footstep and a puff where it stops. Blink and other teleports stay silent. These recordings load with the scene; each source and its CC0 or CC BY license is credited in its sound folder’s License.txt. Each screen only shows and plays what that player may know, on the level they are viewing: a token the GM hid gives nothing away to anyone; with PF2e Visioner, judged from each of the player's own tokens, a creature that is undetected or unnoticed moves in silence and leaves nothing, and a hidden one is heard (its steps, wings or digging) but leaves no dust, prints or trail; without Visioner, the creature's undetected, unnoticed, hidden or invisible condition does the same, and otherwise what you can see is what you get (turn this off with **Movement respects stealth**, world; a GM sees and hears everything, or picks **As my selected token** in **GM perceives movement** to perceive only what their selected token could); it is drawn on each screen and never saved, in full at Balanced quality or better and at half density on Low. Feet carry what they walked through: after water, mud or snow, a creature's next strides on another floor leave its own prints in that, each fainter than the last: wet, dark prints for 6 strides that dry in about 8 seconds, muddy brown ones for 8 strides lasting about 12, and faint white ones for 4 strides gone in about 5 (creatures that slither, ooze or leave no prints carry nothing; **Feet carry mud, water and snow**, world). A badly hurt creature (a quarter of its HP or less) drips a small dark-red drop about every third stride, lasting about 20 seconds, in its Splatter blood colour when it has one; constructs, elementals, oozes and incorporeal creatures never bleed, and with **Splatter: blood follows the damage** on, Splatter paints the blood instead (**Wounded creatures leave blood drops**, world). When it rains on the scene (Foundry's scene weather Rain or Rain Storm, or an FXMaster rain or hail effect), every step splashes a few drops and a small ring and prints on sand, dirt and mud look wet; when it snows (Snow, Blizzard, or FXMaster snow), every step off the water kicks up a light white dusting; never inside a region with a Suppress Weather behavior (**Weather on the ground**, world). Footsteps, wing beats and thuds now ring softly in the room they happen in and sound muffled from behind a wall, just as Animater's hit sounds do (a little less room than a hit, since they are small sounds), and further off they sound duller and pan to their side of the screen; this follows **Room acoustics**, **Room reverb on my screen** and **Muffle sounds behind walls** (**Footsteps ring in the room**, world). A creature moving stealthily steps softer, on a slower beat and a little duller, and only a Huge or bigger one still thuds: in PF2e and SF2e with Avoid Notice as its exploration activity (until initiative) or a Sneak or Avoid Notice effect, when PF2e Visioner marks it as sneaking, and in D&D 5e while it has the Hiding status (**Sneaking is quiet**, world). Every footfall of a Huge or Gargantuan creature gives the view a small tremor as the foot lands, about a pixel for a Huge giant up to three for the heaviest Gargantuan, for a fifth of a second, on screens that hear it, fading out within about 8 squares beyond the view’s edge; never for a sneaking one, and only with **Camera shake** and **Camera shake on my screen** on, at Full or Light quality (**Giant footfalls shake the view**, world). A creature that goes below the floor now shrinks and fades into its hole and vanishes for players who don't own it (who still see the ground churn and hear it dig), shows as a faint ghost to its owner and the GM, and rises back out where it surfaces (**Burrowed creatures sink out of sight**, world). So the marks show, the squares a token has already walked in Foundry's movement highlight fade to a quarter strength while the way ahead stays as Foundry draws it (each player chooses Faded, Hidden or As Foundry draws it in **Walked path highlight**). A creature's body is heard as it moves too, read from its traits, type and name: skeletons rattle, iron golems, animated armor and clockwork clank, stone golems, gargoyles and earth elementals grind, woody plants creak and leafy plants rustle with every step, while water, fire and air elementals don't step at all but slosh, flare or gust with each stride. Turn it off with **Movement effects** (world) or **Movement effects on my screen** (each player).

- **Completed creature movement sound library.** Bundled 49 new or replacement recordings for paws, hard and soft hoof contacts, wooden hooves, heavy dragon feet, soil slides, hard/wet/sand/snow slithering, broad padded feet, webbed feet, leaf rustles and wingless air movement. Creature contacts work without an external sound pack. Recordings are cut into individual events, faded and level-matched; source links, modifications and CC0 or CC BY attribution are included with each sound set. Foley is used where a suitable real creature recording is unavailable.

- **Horses sound like hooves.** Riding horses and other ordinary Large hoofed creatures keep the recording’s natural pitch instead of being slowed into a dull knock, and no longer receive a giant’s bass thud over their clip-clop. Stone uses hard hoof contacts, Wood has dedicated paired wooden hoof Foley, and soft ground uses muted contacts. Huge, Gargantuan and unusually heavy hoofed creatures retain their deeper weight layers.

- **Correct feet for frogs and elephants.** Frogs and toads use soft, splayed webbed contacts and tracks instead of reptile claws. Elephants, mammoths and mastodons use broad padded contacts and tracks instead of hooves. Leafy and vine-covered plant creatures rustle separately from woody creatures that creak.

- **Wingless flight stays wingless.** A flight speed or flying status alone no longer gives a creature wingbeats. Creatures with evidence of wings use wing sounds; levitating, wingless and otherwise unknown fliers use an air pass. Water, fire and air bodies retain their own movement texture. The token’s flight override handles unusual creature art or anatomy.

- **Distinct Stone and Wood creature contacts.** Wooden floors now select their own paired hoof Foley, instead of sharing Stone's clops. Other creature contacts without a dedicated wooden recording use a warmer, filtered Wood response; ordinary boot steps keep their existing floor recordings. This applies to movement and the token sound preview.

- **Distinct Grass and Dirt creature contacts.** Grass now cushions creature contacts and adds a vegetation brush; Dirt adds granular soil motion. Shared soft-ground recordings no longer produce identical playback on both floors. These physical ground textures follow Contact volume and preview cancellation; snakes retain their existing soil slide on Dirt without a duplicate layer.

- **Token movement sound controls and preview.** Token Configuration → Appearance now offers gait, body and winged/wingless flight overrides, silent movement, separate contact/body volume and pitch, weight/bass volume and camera tremor strength. Muting contact or bass leaves the other layers available; bass and tremor align independently to the contact's impact. A four-step local preview uses unsaved choices across every floor, with Walk, Fly and Land modes; Stop, closing the configuration or leaving the scene cancels pending steps and layers. Reset to automatic restores the form defaults; saving applies them to the token.

- **Reliable giant footfall tremors.** Huge and Gargantuan steps now trigger their camera tremor independently of the bass layer, timed to the contact’s actual impact. Muting bass does not mute tremor. Visible creatures near the edge of a zoomed-out view still shake it; off-screen tremors fade with distance beyond the view. Expired tremors cannot block later steps when rendering is slow.


### Creature life

- **Idle life.** Creatures on screen now idle: living creatures breathe, a slow rise and fall about 2.5% deep (each player sets how much with **Idle life strength**, half to double) every 4 seconds or so, each token in its own rhythm so a crowd never breathes in step, and fliers (moving by flying, or with a flying status) bob gently in the air; a creature that only stands high, on a ledge or platform, breathes like anyone else. Constructs, undead, oozes, plants and fungi, elementals, swarms, spirits and incorporeal creatures, objects, hazards and vehicles do not breathe, and creatures that are prone, unconscious, dying or defeated lie still. Any condition's own movement (trembling in fear, swaying with poison, lying prone) takes over, and an attack or other Animater motion plays as usual. Only the tokens in view idle, at most 40 at a time, drawn on each screen at Balanced quality or better and never saved. Turn it off with **Idle life** (world) or **Idle life on my screen** (each player); either takes effect at once. In the cold (the new **Animater climate** choice in Scene configuration set to Cold, or, left on From the weather and floor, snow or a blizzard falling or a snow or ice floor underfoot), breathing creatures in view also puff a soft white cloud sized by the creature (a pixie's quick little wisp, a dragon's slow, billowing cloud, bigger creatures breathing slower) from the mouth (on portrait art just above the token's middle; on turned top-down art where it faces; or where the token's new **Animater breath from** choice in Token configuration says, for art drawn with its head at an edge) of breath in front of the face with each breath out, in their own rhythm, at most 20 at a time, at Balanced quality or better; turn it off with **Breath shows in the cold** (world), and it never shows where **Idle life on my screen** is off.

- **Creatures growl on their turn.** With PF2e Creature Sounds active, a Large or bigger NPC now sometimes (about one turn in three, never twice in a turn) voices a growl from where it stands as its combat turn starts, using the sound set that module picks for it (its own choice on the actor, or its name, traits and size) and that module's volume and on/off switch, pitched lower the bigger the creature. Every screen agrees on when, and only screens that could hear the creature play it, ringing in the room like its footsteps. A creature with no sound set stays silent. Turn it off with **Creatures growl on their turn** (world).

- **Wounded creatures look it.** A creature at half its HP or less now shows faint old stains and slightly duller colour; at a quarter or less the stains darken, its colour drains further, it stands with a slight hunch and limps as it moves, an uneven bob and tilt with every other step. Healing a little past the line takes the look away, and a creature that is down or defeated shows the defeated look instead. Daggerheart counts the hit points still unmarked. The look sits alongside any condition's own look, and any condition's movement takes over from the hunch and limp. Every screen draws it from the same HP and never saves it, never on hidden tokens or ones you cannot see; the stains need the quality that plays token effects, the hunch and limp the quality that plays motions. Choose **All creatures**, **Player characters only** or **Off** with **Wounded looks** (world), or turn it off with **Wounded looks on my screen** (each player).


### Combat drama and effects

- **Camera shake.** Big blasts now jolt the view for a moment: explosions, area bursts of 2 squares or more and critical hits with heavy two-handed weapons, the same blasts that send a shockwave across the map, whether **Map distortion** is on or not. Bigger blasts shake harder and a little longer (about a third to half a second, never more than a few pixels), and a blast far from the middle of the view shakes it less, or not at all once it is well off-screen. Panning and zooming carry on as usual during a shake, and the view ends exactly where it was. A shake shows only on screens viewing the blast's level that can see it, at Full or Light quality. Turn it off with **Camera shake** (world) or **Camera shake on my screen** (each player; off at first when the browser asks for reduced motion), and set how hard it shakes with **Camera shake strength** (each player, 0.25 to 2, default 1).

- **Momentum.** Hits in a row by the same attacker on the same target, within one combat turn (or within 12 seconds out of combat), now land harder: the second hit plays 10% bigger, the third 20% and the fourth and later 30%, with its lights, ground marks and shockwave growing alike, its sounds louder (never past full volume) and its ripples stronger. A miss starts the streak over, a hidden result leaves it as it was, a reroll counts once, and a Strike's damage roll plays at the strength its attack reached. In PF2e and SF2e a third or later Strike in a turn that misses looks strained: the attacker's swing plays slower and it stumbles a little after it. Turn it off with **Momentum** (world).

- **Rerolls are marked on the Activity page.** A PF2e or SF2e check rerolled and played with its new result now carries a tag on its Activity row: **Hero Point**, **Mythic Point**, or **Reroll** (a fortune effect or the reroll menu).

- **Ground marks react to each other.** A new elemental mark that lands on an older one can now set it off: fire on frost puffs up steam and melts the frost, frost on a scorch hisses out in grey smoke and puts it out, fire on a poison stain flares green and orange, lightning on acid sends crackling arcs to each visible creature standing in it, and acid on frost sizzles. The reaction plays the moment the new mark lands, looks the same on every screen, and a melted mark fades away instead of vanishing. Turn it off with **Element reactions** (world); a screen with **Ground marks on my screen** off, or at Off quality, shows no reactions.

- **Dispelled magic shatters.** When a counteract check succeeds in PF2e or SF2e, or Dispel Magic or Counterspell is cast in D&D 5e, Animater's lasting areas and auras that end in the next 4 seconds now break apart like glass: shards in the effect's own colour (pale blue-white when it has none) burst out from its middle, tumble and fade in under a second, instead of the plain fade. A counteract check that fails makes the lasting animations on its targets flicker for a moment, then hold. A check rolled without a DC, or whose result is hidden, still shatters whatever the GM ends right after, but never flickers. In D&D, an ability check the caster makes against a DC soon after the cast (against higher-level magic) decides it again: a pass shatters what ends next, a failure flickers. Every screen viewing the scene shows it, never for hidden tokens, at any quality but Off. Turn it off with **Dispels shatter lasting effects** (world).

- **Splatter's blood follows the damage.** With the Splatter module on, a new world setting, **Splatter: blood follows the damage** (on by default, shown only when Splatter is active), lets Animater decide how much each wound bleeds: slashing and piercing most, bludgeoning less, fire and lightning little, psychic and spirit not at all. Critical hits and killing blows bleed more, and a kill's blood waits for its Finish Him! screen instead of landing under it. The creature keeps its own blood color, and Splatter's own switches (blood on, only in combat, threshold, delay) still apply. Hidden tokens leave no blood. Off: Splatter bleeds on its own, as before.

- **Slow-motion kill-cam.** When a killing blow lands on an NPC, every screen that can see it now eases the view towards the creature with a gentle zoom (never past the scene's maximum zoom), slows Animater's effects on and around it to a third of their speed for under a second, and fades the colour behind a soft vignette, then lets the effects run on and pans back to where the view was. It plays on any NPC's killing blow, with or without a finisher, and the finisher, the Finish Him! screen and a kill's Splatter blood wait for it. A player who is panning the view themselves keeps the camera. Only screens on that scene that can see the creature show it, never for hidden tokens, at Full or Light quality. Turn it on with **Slow-motion kill-cam** (world, off by default), and off for one screen with **Kill-cam on my screen** (each player).

- **Combat recap reel.** When a combat ends, after its ending screen, a short cinematic replay of the fight's three best moments plays (under 20 seconds). Letterbox bars and a soft vignette come in. For each moment the camera eases over to frame the attacker and its target, the original animation replays on the real tokens and slows to a crawl at the impact, and a lower-third caption gives the attacker's portrait, what happened, the damage and who it hit (for example "Valeros — Critical Hit — 38 damage — vs Kobold Dragon Mage") with badges such as KILL, CRIT, NAT 20 and BIGGEST HIT. A summary card of all three closes the reel, then the bars leave and your view goes back to where it was. **Skip** (or Esc) ends it at once, and the view is always put back. The replay is a local preview on each screen, so nothing is written, rolled, damaged or marked. A token that has since been deleted is stood in for by a temporary copy of its art, drawn only on your screen. A moment on another scene, or a screen set to Balanced or Low quality, gets a caption and art card instead of the camera and slow motion. Off quality shows nothing. Each strike is one moment: its critical hit, natural 20 and killing blow are badges on that one moment, so one strike never fills the reel three times. The number is the damage actually dealt, so a creature left on 1 HP that takes 38 shows 38, not 1. The moments favour different attackers. Whispered and blind rolls and hidden tokens are left out. Players never see a moment with a hidden token, and a creature whose name players cannot see shows as "a foe". The GM's screen keeps track as the combat runs, and the last recap is saved so it can be replayed after a reload: **Play recap** on the Activity page or the **Play combat recap** key (no key by default, under Configure Controls) replays it on your screen, and macros can use `game.modules.get("animater").api.recap({ everyone: true })` to play it on every screen (GM only). Choose who sees it at combat end with **Combat recap** (world): **Everyone** (default), **GM only** or **Off**. Turn it off on one screen with **Combat recap on my screen**. While **Movement respects stealth** is on, the recap also respects what each player had detected at the time (PF2e Visioner, or the undetected, unnoticed, hidden and invisible conditions): a moment with a creature they never detected is left out, and one they only heard plays as a card naming it "something unseen", with no art of it.


### NPC and system coverage

- **Every PF2e NPC Strike animates.** Before, an NPC's attack played only when its name was a catalog weapon or one of 15 exact creature attacks (Jaws, Claw, Tail…), so about 45% of NPC Strikes played nothing. Now a longer name plays its creature word ("Spiked Tail" a tail, "Storm-Beak Jab" a beak, "Claws" a claw), with many more of them (Tongue, Tusk, Horns, Vine, Branch, Pseudopod, Pincer…). A ranged Strike throws or spits what its name says: rocks and boulders sling, quills, thorns and spikes fly as darts, webs and nets as a bola, spit and beams in their damage's colour. An NPC's bomb ("Alchemical Bomb — Frost Vial", "Greater Acid Flask") plays the catalog's bomb. Anything else plays by its damage: a slashing Strike rakes like a claw, others land as a blow, and a ranged one flies by its damage type. Your own recipes still come first. Across every installed bestiary 99.7% of NPC Strikes now play. A new world setting, **Guess NPC Strikes** (on by default), turns off the guesses by damage and by what a ranged Strike throws, leaving only Strikes a weapon or creature-attack name places.

- **PF2e NPC abilities animate.** The monster abilities that hundreds of creatures share now play when an NPC uses them: Grab and Improved Grab, Constrict, Swallow Whole, Engulf, Blood Drain, Knockdown, Push, Rend, Wide Swing and tail sweeps, Trample, charges, Pounce, Throw Rock and Catch Rock, Ferocity, frightful moans and croaks, Focus Gaze, Dominate, Turn to Mist, Shield Block, Spore Cloud and more. Breath Weapon plays when its area is placed, in its energy (fire, cold, lightning, acid, poison, void…) and as a cone or a line to match. Names with a frequency or distance count too ("Breath Weapon (Fire)", "Push 10 feet"), and so do longer names by their keyword ("Boar Charge", "Squirming Embrace", "Petrifying Stare"). Every other NPC ability gets a look built from what it does: an area it places plays when placed, as a cone, line, burst or emanation in the colour of its damage (fire, cold, lightning, acid, void, force…); damage with no area strikes its target in that damage's look; with neither, its traits decide (a teleport blinks, a fear ability cries out, a mental one bends the target's mind, a healing one glows). Reactions that only make a Strike (Attack of Opportunity, Reactive Strike) are left to the Strike's own animation. Before, about 4% of NPC abilities played anything; across every installed bestiary nearly every offensive ability now animates, and about 70% of all active ones. A basic action the action catalog knows (Grapple, Shove) keeps its own animation, and your own recipes come first. Two new world settings, both on by default: **Animate NPC abilities** turns all of it off, and **Animate other NPC abilities from what they do** keeps only the named monster abilities.

- **NPC abilities page in the Studio (PF2e).** A new **NPC abilities** page under Library lists the 26 named monster abilities (Grab, Constrict, Swallow Whole, Breath Weapon…) with every name each one matches. Preview any of them here or on the canvas with your selected token. The page also has switches for **Animate NPC abilities**, **Animate other NPC abilities from what they do** and **Guess NPC Strikes**, and a **Leave out** button per ability: an ability you leave out plays only your own recipe for it.

- **Older NPCs' spells animate.** Creatures from older bestiaries still carry pre-Remaster spell names; these now play the spell each became: Produce Flame plays Ignition, Dancing Lights plays Light, Magic Missile plays Force Barrage, Dimension Door plays Translocate, Remove Curse and Remove Disease play Cleanse Affliction, and about 60 more; this also helps third-party bestiaries whose spells carry no compendium link. The alignment spells, which are gone, play the nearest one (Detect Alignment plays Detect Magic). Notes in a spell's name no longer stop it from matching ("Dragon Breath (Gold)", "Detect Alignment (At Will) (Evil Only)"). Across the pf2e system's bestiaries, 99.98% of NPC spells now animate.

- **SF2e NPCs animate too.** Before, no SF2e NPC Strike played anything and almost no monster ability did, unless **Also use the PF2e catalogs** was on. Now an NPC's gun, blade or grenade plays the SF2e weapon of its name (Laser Rifle, Phase Cutlass; a plain "Frag Grenade" plays the catalog's lowest grade, thrown), natural attacks and every other Strike play as in PF2e, and monster abilities (Grab, Swallow Whole, breath weapons…) use the NPC ability looks, all without the crossover setting. They follow the SF2e weapon and action catalogs' switches, and the three NPC settings now show in SF2e worlds too. In the official SF2e bestiaries, every NPC Strike and 99.7% of offensive abilities now animate, up from none.

- **More D&D 5e monster attacks and abilities animate.** A statblock's attack now finds its design whether the statblock calls it a feature or a weapon (older Bite, Claw, Slam, Rend and Sting are features, Constrict and Stomp weapons), and older monsters' copies from the SRD compendiums match their own entry. When a monster's ability uses activities of its own, Animater now plays the design for the same kind of activity (the first, if there are several, as with Gore's Attack and Moving Attack), or the entry's only automatic design when the kinds differ (2014 Breath Weapons, Sleep); designs that only play by hand (summons, Mage Hand) still do. Across the system's and official books' monsters, offensive features that animate rose from 73% to 85%, other active features from 85% to 88%, attacks from 95.7% to 96.4% and spells from 88% to 89%. Your own recipes still come first.

- **Daggerheart adversaries look like what they do.** An adversary's standard attack now strikes as the weapon its name names, even when the library has no such weapon: a Greataxe cleaves, Daggers stab, a Warclub or Maul smashes, Spears thrust, a Javelin is thrown, a Recurved Bow shoots, a Magitech Cannon fires and a Corrupted Staff casts. A magic attack with no weapon in its name plays its element or a magic bolt instead of an arrow or a plain slash (Fire Bolt and Spirit Flame burn, Lightning Bolt crackles, Chill Touch freezes, Psychic Strike and Necrotic Blast fly as magic). More creature attacks are recognised too (Chomp, Beak, Pincers, Hooves, Antlers, Body Bash). A feature's attack roll plays its element (Spit Acid, Lightning Strike, Venomous Bite) rather than a weapon. Summons and reinforcements open a portal over a summoning circle, countdowns toll a bell, transformations and evolutions burst into their new form, and a feature that only costs Stress, Hope or Armor (Terrifying, Scare Tactic) plays dread or a cracked guard instead of a physical blow. A grouped action (Elemental Breath) plays the action it picks. Across the system's adversaries and environments every active feature now animates (before: 85% of adversary features and 64% of environment features), and only 13 of 267 standard attacks still play the plain slash or arrow (before: 132). Your own recipes still come first.


### Settings, Studio and sharing

- **All of Animater's settings in one window.** Configure Settings now has an **Animater settings** button that opens a window with a tab per topic: Look & light, Motion, Floor & world, Sound, Combat drama, Automation & catalogs, Interface & performance and Integrations, with a search box that finds a setting in any tab. Each feature is one row: the GM's **Everyone** switch for the whole world beside each player's own **My screen** switch, with its extra choices (a lifetime, a strength, a reach) right under it. Players see only the switches for their own screen, with a note when the GM has turned that feature off for everyone. Changes apply at once; there is no Save button. The Sound tab opens the **Hit sounds** menu. Configure Settings itself keeps only **Animation quality (this device)** and the **Animater workspace**, **Hit sounds** and **Animater settings** menus. Settings for one system or module (PF2e, Daggerheart, Dice So Nice, PF2e Visioner, Splatter, Automated Animations, Trigger Animations) show only where it is active. Every saved value stays as it was.

- **More "on my screen" switches.** Four new client settings, all on by default, turn a feature off on one screen while everyone else keeps it: **Effect lighting on my screen** (effects no longer light the scene here; other players still see them lit), **Element reactions on my screen**, **Dispel shatter on my screen** and **Combat recap on my screen** (the Highlights screen is still recorded and shown to everyone else). Find them beside each feature's world switch in the Animater settings window.

- **Hover a token to see what plays on it.** Hovering a token now shows a small tooltip at its top-right corner listing what Animater is playing on it right now: each animation's name, where it comes from (Catalog, Your recipe, a player's recipe or the GM's recipe) and whether it is lasting. Several of the same play show once with a count, and past six the list ends with "and N more". Nothing playing, no tooltip. The GM sees it on every token; players only on tokens they own or can see. A new client setting, **Explain animations on hover**, turns it on or off on your screen; it starts on for GMs and off for players. An animation started on another screen is listed while it shows on yours.

- **Share a recipe in one line.** Right-click a recipe on the Recipes or Finishers page and choose **Copy share code**: a single line starting `animater-recipe:1:` lands on your clipboard, ready to paste in chat, Discord or a forum. In another world, paste it into **Import** (several codes at once work too, even if a chat wrapped them over a few lines) and review it as usual. Names in any language come through intact. **Copy as macro** copies a script macro instead: a GM who runs it gets the recipe, merged by id like Import. Macros and other modules can do the same with `game.modules.get("animater").api.importRecipes(...)`, which takes share codes or export JSON and says how many recipes it added, replaced and skipped.


### Maintenance

- **Release packaging and development cleanup.** The module archive now includes bundled sound recordings whose paths are assembled at runtime, along with their license and attribution files. Obsolete creature audition pages, candidate staging helpers and one-off audit/inspection code were removed. Runtime code, regression tests, required catalog/build audits and source credits remain.


## 2.0.3 (2026-10-23)

- **Spell light can reveal creatures in PF2e Visioner (homebrew).** For PF2e Visioner only: a new world setting, **Effect light reveals creatures (PF2e Visioner, homebrew)**, off by default, decides whether Visioner's auto-visibility counts a spell's light (a Fireball lighting a dark room) as lighting the creatures in it, so anyone with line of sight sees them for that moment. It is not in the rules, so it is off by default. Needs PF2e Visioner 8.14.12 or later; without Visioner it does nothing. Thanks to camrun91 for the idea.

## 2.0.2 (2026-10-23)

- **D&D 5e with Midi-QOL: attacks play their real hit or miss.** With Midi-QOL's activities, the attack roll goes into Midi's own card instead of a chat message of its own, so Animater never learned whether it hit: every arrow flew straight into its target, a miss never flew wide, and nothing thunked into a wall. Animater now waits for Midi to finish the attack and plays Midi's own verdict for each target (cover, reactions and Automated Conditions 5e's changes included); with Midi's **Auto check hits** off, the roll is compared with each target's AC. A miss flies wide again, or into the wall on its line. Each Midi attack also plays once, not twice. Thanks to y_deda_povis for the report.

## 2.0.1 (2026-10-22)

- **A GM's private attack no longer shows a miss as a hit.** Attacks and saves rolled as a Private GM Roll used to hide their result, and the hidden result played as a hit: the arrow flew into the target with its impact, even straight through a wall. Private GM rolls now animate their real result, like public ones (a miss flies wide or into the wall), while the numbers stay private. To keep players guessing, turn on **Hide the result of private GM rolls** (world): the shot then flies at the visible part of the target (or into the wall if it is out of sight) and nothing lands, no impact, flinch, dodge or ground mark. PF2e, SF2e, D&D 5e and Daggerheart. Thanks to y_deda_povis for the video.
- **D&D 5e: an attack at a target in total cover no longer always hits.** D&D leaves out the AC of a target in total cover, and Animater read it as AC 0, so every roll looked like a hit. Such an attack now plays neutrally too; a natural 20 or a natural 1 still shows as a crit or a fumble.
- **Clear ground marks at once.** A GM can now wipe every ground mark from the floor on all connected screens: run the macro `game.modules.get("animater").api.clearGroundMarks()`, or bind **Clear ground marks** under Configure Controls (no key by default). A player running the macro clears only their own screen. Marks under a lasting area that is still on the board go too, and come back only if the area plays again. Thanks to y_deda_povis for the request.

## 2.0.0 (2026-10-22)

Animater's biggest update: effects now light the scene, leave marks on the floor, bend the map, ring like the room they are in and stop at walls, fast moves leave afterimages, teleports land on their own timing, and Sequencer itself runs lighter for every module. Each new look has its own world setting and, where it is a matter of taste or comfort, a setting for each player.

- **Teleport stage.** A teleport now happens on the recipe's own timing instead of a fixed half second: Friendfetch's ally vanishes as the ray reaches them, not before it. Teleport recipes get a **Teleport** track in the Recipe Studio with one stage: the token vanishes (departure effect) as it starts and reappears at the picked spot (arrival effect) when it ends, 0.5 s later by default. Recipes without one, catalog entries and older recipes included, teleport as their flight reaches the one who moves, else at the caster's gesture, else 0.45 s in. While it is gone the token is hidden on every screen (with **No effect** as the departure, it jumps as the stage starts). Once a spot is picked the token always gets there, even if the animation is stopped or fails first. **Local preview** shows the jump: the token vanishes in its departure effect, a copy of its art lands three squares off (toward its target) with the arrival effect, holds a moment and fades as the token comes back; on your screen only, and the token never moves. The afterimage streak and the map distortion still ride the two effects, and the GM still moves a creature the caster does not own.
- **Catalog teleports on the timeline, and more of them.** Teleports from the catalogs now show their **Teleport** stage in the Recipe Studio, ready to drag. New real teleports (pick a spot, the token jumps): PF2e Dimensional Steps, Echo Jump and Flicker (10 feet, where you pick, standing in for the GM's random direction); D&D Blink (on its Blink roll, or the 2024 spell's cast, within 10 feet), Shadowy Teleport and Warp Step (30 feet), Deathly Teleport and Radiant Teleport (60 feet) and Trickster's Transposition (to your illusion, up to 120 feet); Daggerheart Blink Out (Far range, 60 feet). Only the one who acts moves: companions brought along and Trickster's illusion stay where they are. Friendfetch's ally vanishes as the tether connects and reappears beside you, and is no longer pulled toward you afterwards (an ally not teleported still is). A caster vanishes at the height of the cast's flicker or departure mist. A Misty Step blink is gone for 0.4 s, Friendfetch 0.5 s, and Dimension Door and Translocate 0.7 s. The departure and arrival mists take the spell's own colour (purple for Dimension Door, Translocate and Friendfetch; a golden flash for Radiant Teleport). A mist on the caster no longer jumps along with them: the departure mist stays where they stood, arrival art (Dimension Door's mist, Blink Out's blink back in) plays where they reappear, and Radiant Teleport's burst waits until it has arrived. Dimension Door's failed-teleport damage roll no longer asks for a spot.
- **Room-aware sound.** Animater's sounds now ring like the space they happen in. In a scene with no Acoustics choice, the walls around each sound decide: an open field stays dry, a tiny cell sounds close and tight, a room fuller, and a great hall or cave rings on, using Foundry's own reverb. Each spot is worked out once, every player hears the same room, and the **Echo** slider in the **Hit sounds** menu scales it too. A scene with an Acoustics choice (open air, hall or cave) sounds exactly as before. Sounds from beyond a wall are muffled, as Foundry's own sounds are, heard from your selected token, else your own token (a player without one hears from the middle of the view; a GM with no token selected hears nothing muffled, as in Foundry); this applies in every scene. The canvas edge counts as open, so a small unwalled map stays dry. The Scene configuration's unset Acoustics option now reads **From the walls**. Turn it off with **Room acoustics from walls** (world), **Room reverb on my screen** or **Muffle sounds behind walls** (each player).
- **Map distortion.** Big magic now bends the scene itself, map, tiles, tokens and effects together. Explosions, area bursts of 2 squares or more and critical hits with heavy two-handed weapons send a shockwave ring rippling out from the blast; lasting fire areas and fire auras shimmer with heat until they end, the aura's shimmer moving with its token; an Animater teleport pinches space where the token leaves and where it lands. Up to four distortions show at once, kept subtle and the same at any zoom; nothing is added while the map is still. Distortion is drawn on each screen at Full quality only, and a screen that is running slow skips new ripples (heat haze carries on). Turn it off with **Map distortion** (world) or **Map distortion on my screen** (each player, for example if it is uncomfortable to watch). **Shockwave reach (× blast size)** (world, 0.5 to 4, default 1.5) sets how far a blast's ring ripples, as a multiple of the blast's size. A distortion shows only on screens viewing its level and only where that screen can see it, and the shader is ready before the first blast, even on browsers that cannot compile it in the background.
- **Afterimage trails.** Charges, leaps, knockbacks and teleports leave a brief afterimage trail; each screen can turn it off. While a token rushes, leaps, rolls or is flung at speed, translucent copies of its art drop behind it and fade within half a second, only on the way out and never on a slow drift or an in-place lunge. A teleport leaves a short streak of copies from where the token stood to where it lands. Copies take the action's colour (the stage's tint, the spell's element, the recipe colour, else a soft white; a misty step streaks blue), look the same on every screen, and sit under the token. Each rush, leap, roll, dodge, path, push or pull stage has an **Afterimages** choice in the Studio: Auto (moves of a square or more), Always or Never. They show at Full, Light and Balanced quality. Turn them off with **Afterimage trails** (world) or **Afterimages on my screen** (each player).
- **Ground marks.** Elemental hits now leave fading scorch, frost and acid marks on the floor where they landed: fire scorch, cold rime, acid residue, electricity streaks, poison stains, sonic and force cracks, and withered void. Elemental spells (spell attacks and damaging spells), areas and alchemical bombs and flasks mark the floor; ordinary weapon strikes and rune damage do not. A single target gets a mark under it and an area gets a cluster clipped to the template. Marks stay full for 2 minutes, then fade over the next 3 (set **Ground mark lifetime (minutes)** to change this, or 0 to keep them until the scene changes); a lasting area's mark stays until the area ends. PF2e impulses and NPC actions mark only when their animation plays on the damage roll. Marks are drawn on each screen, never saved, and cleared on reload or on a scene or level change; Off quality draws none and Low draws half as many. Turn them off with **Ground marks** (world) or **Ground marks on my screen** (each player).
- **Projectiles stop at walls.** A hit that the shooter can see flies on to the visible part of its target, while a shot at someone fully behind cover thunks into the wall and the target shows no impact. A miss flies wide past its target and fades out, and only a miss that meets a wall on its line thunks into it; with several targets, a target that was missed shows no impact even when the others were hit. A wall strike knocks on stone (on wood for a door) when the recipe plays sounds. Shots fly through anything that does not block them, such as an arrow slit. Turn it off with **Projectiles stop at walls** (world).
- **Thrown weapons, bombs and arrows hit as they land.** The splash, impact, residue, mark and light of a thrown or launched weapon now go off when the missile actually arrives at the distance it was thrown, instead of at a fixed moment: an Alchemist's Fire no longer explodes mid-flight, and a D&D flask or arrow no longer hits up to two seconds after it vanished. Spells, beams and areas keep their timing.
- **Effect lighting.** Fire, lightning, radiant and other glowing effects now light the scene around them with a temporary real light, on every screen. Walls block it like any light, and in dark scenes tokens with sight of the area see what it lights; it never reveals more than normal light rules would. Flights carry a travelling glow, impacts flash, lightning strobes, fire flickers, and lasting areas pulse or flicker until they end. A cone or line lights its middle, an aura's light moves with its token, and the light sits on the caster's level. In fully lit scenes it shows as a soft coloured glow instead. Each part can be turned off: **Effect lighting** and **Effect lighting in daylight** (world), and **Flickering and flashing effect lights** (each player) for a steady glow instead of flicker or strobe. Wall of Fire and glowing summons (Floating Flame, Ignite the Sun) from **PF2e Summons Assistant** light the scene too, going dark while their token is hidden.
- **Faster animations.** Animater now makes Sequencer itself cheaper to run, for every module's effects, not only Animater's. Sequencer's animation engine no longer allocates every frame (same results, checked frame for frame against the original); effects attached to or stretched between tokens only recompute when something moved; positional sounds stop rebuilding their area and muffling every frame; and effects with filters or masks are skipped while off-screen. Animater also loads the next creature's weapons and recently used footage before its turn, starts per-target copies a frame apart, skips decorative layers too small to see at your zoom or arriving while your computer is busy (on your screen only), and never skips a spell's main hit. On by default under **Faster animations (this device)** (each player), which also switches that preloading and skipping; turn it off if an effect from any module looks wrong.
- **Importing flash screens no longer duplicates them.** Export used to save every flash screen, the untouched starters included, and import added each one again under a new id, so a world ended up with two of everything. Export now saves only the screens you made or changed. Import replaces the screen with the same id, so a starter you customized overwrites the starter, and screens you already have are skipped: importing the same file twice adds nothing. Thanks to silentbrad for the report.
- **Duplicates from an earlier import are cleaned up.** When the GM loads the world, exact copies of a flash screen are removed and the first one is kept; a screen switched on through a copy stays on. If you imported into another world, your customized starter and that world's original are not exact copies and both stay: delete the one you don't want.
- **Recipes and finishers export separately, and only what's yours.** Export on the Recipes page saves your own recipes and the starters you changed, and leaves out the starters you never touched. Finishers have their own Export and Import on the Finishers page. Either Import takes either file and replaces entries with the same id. It also skips unchanged starters from an older export, so they can't undo a starter you changed.
- **Delete a flash screen from the library.** Each tile has a delete button on hover, and right-clicking a tile offers Edit and Delete, so you no longer have to open a screen to delete it.

## 1.6.5 (2026-10-22)

- **D&D 5e recipes play in any language.** A recipe made from a catalog spell matches it by name ("fireball"), so in a translated world a copy of the spell that is not linked to the SRD (an importer's, say: "Огненный шар") never matched. Recipes now also match the spell's D&D identifier, which stays the same in every language and book. ([#10](https://github.com/roileaf/animater/issues/10))

## 1.6.4 (2026-10-22)

- **D&D 5e recipes now really play for spells from other books.** 1.6.2 still missed one common case: a book or module whose spells were built from the SRD ones keeps a link back to the SRD spell but gives each activity a new id, and Animater treated it as the SRD spell itself, which needed the SRD activity id. Now, when the spell does not have the recipe's activity at all, the same kind of activity (save, attack, heal) plays the recipe; on a spell that does have it, only that activity does. Thanks again to y-deda-povis. ([#10](https://github.com/roileaf/animater/issues/10))

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
