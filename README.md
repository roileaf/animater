[![Latest Version](https://img.shields.io/github/v/release/roi007leaf/animater?display_name=tag&sort=semver&label=Latest%20Version)](https://github.com/roi007leaf/animater/releases/latest)

[![GitHub all releases](https://img.shields.io/github/downloads/roi007leaf/animater/total)](https://github.com/roi007leaf/animater/releases)

[![Forge Installs](https://img.shields.io/badge/dynamic/json?label=Forge%20Installs&query=package.installs&suffix=%25&url=https%3A%2F%2Fforge-vtt.com%2Fapi%2Fbazaar%2Fpackage%2Fanimater)](https://forge-vtt.com/bazaar)

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/roileaf)
[![Patreon](https://c5.patreon.com/external/logo/become_a_patron_button.png)](https://www.patreon.com/roileaf)

# Animater

Automatic animations for **Pathfinder 2e**, **Starfinder 2e**, **D&D 5e**, **Daggerheart** and **Draw Steel** in **Foundry VTT 14**, powered by **Sequencer and JB2A**. Enable ready-made catalogs or choose individual animations, then cast spells, make attacks and use abilities through your system's normal workflow.

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

## Documentation

Everything is explained in the **[wiki](https://github.com/roileaf/animater/wiki)**: every feature, every setting, with pictures.

| I want to… | Go to |
|---|---|
| Get my first animation playing | [Getting Started](https://github.com/roileaf/animater/wiki/Getting-Started) |
| Understand "Everyone" and "My screen" | [How Settings Work](https://github.com/roileaf/animater/wiki/How-Settings-Work) |
| Know what's on my screen as a player | [For Players](https://github.com/roileaf/animater/wiki/For-Players) |
| Fix something that isn't working | [Troubleshooting and FAQ](https://github.com/roileaf/animater/wiki/Troubleshooting-and-FAQ) |
| Look up any setting | [Settings Reference](https://github.com/roileaf/animater/wiki/Settings-Reference) |
| Keep it smooth on a slower computer | [Performance and Quality](https://github.com/roileaf/animater/wiki/Performance-and-Quality) |

## What it does

- **Animations.** Catalogs for spells, feats, actions, weapons, conditions and NPCs, played from your system's normal workflow. Build your own in Recipe Studio, with finishers and Tokenshade looks on the token's artwork. See [Spell and Action Animations](https://github.com/roileaf/animater/wiki/Spell-and-Action-Animations), [Recipe Studio and Finishers](https://github.com/roileaf/animater/wiki/Recipe-Studio-and-Finishers), [Looks and Tokenshade](https://github.com/roileaf/animater/wiki/Looks-and-Tokenshade) and [Combat Drama](https://github.com/roileaf/animater/wiki/Combat-Drama).
- **The world.** Weather, snow and wet ground, sun, moon and shadows, moving water, fire and smoke, wildlife and town life, caves. See the [Weather Panel](https://github.com/roileaf/animater/wiki/Weather-Panel), [Sun Moon and Shadows](https://github.com/roileaf/animater/wiki/Sun-Moon-and-Shadows), [Water](https://github.com/roileaf/animater/wiki/Water), [Fire and Lights](https://github.com/roileaf/animater/wiki/Fire-and-Lights) and [Wildlife and Town Life](https://github.com/roileaf/animater/wiki/Wildlife-and-Town-Life).
- **Maps.** Painted floors, decorations, buildings with real walls, windows and doors, and props that break. See [Map Painting](https://github.com/roileaf/animater/wiki/Map-Painting), [Buildings](https://github.com/roileaf/animater/wiki/Buildings), [Decorations](https://github.com/roileaf/animater/wiki/Decorations) and [Breakable Props](https://github.com/roileaf/animater/wiki/Breakable-Props).
- **Creatures and sound.** Dust, prints and wakes under moving tokens, carriers that tokens ride, blood and what a fight leaves behind, footsteps, acoustics and creature voices. See [Movement Effects](https://github.com/roileaf/animater/wiki/Movement-Effects), [Carriers](https://github.com/roileaf/animater/wiki/Carriers), [Blood and Aftermath](https://github.com/roileaf/animater/wiki/Blood-and-Aftermath) and [Sounds and Voices](https://github.com/roileaf/animater/wiki/Sounds-and-Voices).

How Animater works beside other modules (Automated Animations, Spell Arsenal, Trigger Engine, Splatter, PF2e Visioner, Dice So Nice, PF2e Creature Sounds) is on the [Integrations](https://github.com/roileaf/animater/wiki/Integrations) page.

## API

```js
const animater = game.modules.get("animater").api;
await animater.play("Fireball", { source: canvas.tokens.controlled[0], targets: Array.from(game.user.targets) });
await animater.preview("Fireball"); // local only
animater.resolve(message);          // the recipe automatic playback would use, or null
animater.handles(item);             // true when Animater would animate this item or message
await animater.stop();
animater.flyover({ x, y, angle, pass: "land", actor: actor.uuid }); // GM only: something flies over (see below)
animater.clearGroundMarks();      // wipe ground marks: a GM clears every screen ({ everyone: false } for only yours), a player their own
await animater.importRecipes(code); // GM only: share codes, export JSON or { schema: 1, recipes }; merged by id like Import → { added, replaced, skipped }
```

Share a recipe: right-click it on the Recipes (or Finishers) page and choose **Copy share code** (one line starting `animater-recipe:1:`, paste it into **Import** in another world; several codes at once work too) or **Copy as macro** (a script macro that imports it when a GM runs it).

Macro to clear the floor at once: `game.modules.get("animater").api.clearGroundMarks()`. GMs can also bind **Clear ground marks** under Configure Controls (no key by default). Marks of lasting areas still on the board are cleared too and come back only if the area plays again.

`flyover` takes `{ x, y, angle }` (where it crosses and which way, in radians), `squares` (its true width, 3 by default), `art` (a picture of it from above; `faces` "down", "up", "left" or "right" says which way that picture points) or `shape` ("dragon", "bird", "bat", "insect", "wingless"), `spread` (false to leave its wings as drawn), `height` ("low" or "high"), `pass` ("straight", "circle" or "land"), `wings` (false for no wing beats), `voice` (an actor's uuid, or "group:dragon" for a voice family) and `actor` (the uuid of the one whose token is put down where it lands; `place: false` not to). `here: true` shows and sounds it on your screen only; its token is still put down where it lands.

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
