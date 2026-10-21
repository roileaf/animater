// Builds data/surface-sounds.mjs: what a weapon's blow sounds like on each surface it can land on
// (bare flesh, leather or cloth, metal armour, a raised shield, chitin, bone or wood, stone, glass or
// crystal, an ooze, a magical ward), per kind of blow. Chitin and bone crunch; wood and bark knock. Each profile lists recordings measured like every other automatic
// cue: GGG's by database key when that pack is installed, and Animater's own bundled CC0 recordings
// (assets/sounds/surfaces, Kenney), which always play.
import { writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import { soundInventory, probeSoundFile, modulesRoot } from "./sound-databases.mjs";

const BUNDLED = "modules/animater/assets/sounds/surfaces";
// "ggg-sfx.…": every GGG recording under that database key. "kenney:name" / "freesound:name": every bundled
// file in that folder starting with it.
const SOURCES = {
  // An arrow or bolt: thunks into wood and shields, ticks off plate, stabs into flesh.
  arrow: {
    flesh: ["freesound:flesh-pierce"],
    leather: ["freesound:leather-hit", "freesound:flesh-pierce"],
    metal: ["kenney:impactPlate_light", "ggg-sfx.melee.blade.block.dagger.01"],
    shield: ["freesound:arrow-wood", "kenney:impactWood_heavy"],
    crunch: ["freesound:crunch"],
    wood: ["freesound:arrow-wood", "kenney:impactWood_medium"],
    stone: ["kenney:impactMining", "ggg-sfx.ranged.thrown.stone.impact.01"],
    glass: ["kenney:impactGlass_light"],
    squish: ["freesound:squish"],
    ward: ["freesound:ward-chime", "ggg-sfx.impact.scifi.shield.deflector.01", "ggg-sfx.magic.divine.cast.dispel.general.01"],
  },
  // A bullet: a wet smack in flesh, a ricochet off metal, a chip off stone.
  bullet: {
    flesh: ["freesound:bullet-flesh", "freesound:flesh-pierce"],
    leather: ["freesound:leather-hit", "freesound:bullet-flesh"],
    metal: ["freesound:bullet-metal", "freesound:ricochet"],
    shield: ["freesound:bullet-metal", "kenney:impactWood_heavy"],
    crunch: ["freesound:crunch"],
    wood: ["kenney:impactWood_light", "kenney:impactPlank_medium"],
    stone: ["kenney:impactMining", "freesound:ricochet"],
    glass: ["kenney:impactGlass_heavy"],
    squish: ["freesound:squish"],
    ward: ["freesound:ward-chime", "ggg-sfx.impact.scifi.shield.deflector.01", "ggg-sfx.magic.divine.cast.dispel.general.01"],
  },
  // An attack spell keeps its own impact; it rings only where there is something to ring: a ward or a shield
  // turning it aside, a glass body, metal armour.
  spell: {
    ward: ["freesound:ward-chime", "ggg-sfx.impact.scifi.shield.deflector.01", "ggg-sfx.magic.divine.cast.dispel.general.01"],
    shield: ["kenney:impactBell_heavy", "ggg-sfx.impact.scifi.shield.general.01"],
    glass: ["kenney:impactGlass_light"],
    metal: ["kenney:impactPlate_light"],
  },
  blade: {
    flesh: ["freesound:flesh-blade", "ggg-sfx.melee.axe.slash.flesh.01", "kenney:knifeSlice", "ggg-sfx.impact.flesh.01"],
    leather: ["freesound:leather-hit", "kenney:dropLeather"],
    metal: ["ggg-sfx.melee.blade.block.shortsword.01", "ggg-sfx.melee.blade.block.greatsword.01", "kenney:impactPlate_medium", "kenney:impactPlate_heavy"],
    shield: ["ggg-sfx.equipment.armor.shield.impact.02.metal", "ggg-sfx.equipment.armor.shield.impact.01", "kenney:impactWood_heavy", "kenney:impactPlank_medium"],
    crunch: ["freesound:crunch"],
    wood: ["kenney:impactWood_light", "ggg-sfx.impact.wood.01", "kenney:chop"],
    stone: ["ggg-sfx.ranged.thrown.stone.impact.01", "kenney:impactMining"],
    glass: ["kenney:impactGlass_medium", "kenney:impactGlass_heavy"],
    squish: ["freesound:squish", "ggg-sfx.magic.water.impact.bubble.01", "ggg-sfx.magic.water.impact.general.02"],
    ward: ["freesound:ward-chime", "ggg-sfx.impact.scifi.shield.deflector.01", "ggg-sfx.magic.divine.cast.dispel.general.01", "ggg-sfx.impact.scifi.shield.general.01"],
  },
  blunt: {
    flesh: ["freesound:flesh-blunt", "ggg-sfx.melee.unarmed.fist.strike.04", "ggg-sfx.melee.unarmed.fist.strike.03"],
    leather: ["freesound:leather-hit", "kenney:dropLeather"],
    metal: ["ggg-sfx.equipment.armor.shield.impact.02.metal", "kenney:impactPlate_heavy"],
    shield: ["ggg-sfx.equipment.armor.shield.impact.01", "kenney:impactWood_heavy"],
    crunch: ["freesound:crunch"],
    wood: ["kenney:impactWood_medium", "ggg-sfx.impact.wood.01"],
    stone: ["ggg-sfx.ranged.thrown.stone.impact.01", "kenney:impactMining"],
    glass: ["kenney:impactGlass_heavy"],
    squish: ["freesound:squish", "ggg-sfx.magic.water.impact.bubble.01", "ggg-sfx.magic.water.impact.general.02"],
    ward: ["freesound:ward-chime", "ggg-sfx.impact.scifi.shield.deflector.01", "ggg-sfx.magic.divine.cast.dispel.general.01", "ggg-sfx.impact.scifi.shield.general.01"],
  },
  pierce: {
    flesh: ["freesound:flesh-pierce", "ggg-sfx.impact.flesh.01"],
    leather: ["freesound:leather-hit", "kenney:handleSmallLeather"],
    metal: ["ggg-sfx.melee.blade.block.dagger.01", "ggg-sfx.melee.blade.block.rapier.01", "kenney:impactPlate_light"],
    shield: ["ggg-sfx.equipment.armor.shield.impact.01", "kenney:impactPlank_medium", "kenney:impactWood_medium"],
    crunch: ["freesound:crunch"],
    wood: ["kenney:impactWood_light", "kenney:impactPlank_medium"],
    stone: ["ggg-sfx.ranged.thrown.stone.impact.01", "kenney:impactMining"],
    glass: ["kenney:impactGlass_light", "kenney:impactGlass_medium"],
    squish: ["freesound:squish", "ggg-sfx.magic.water.impact.bubble.01", "ggg-sfx.magic.water.impact.general.02"],
    ward: ["freesound:ward-chime", "ggg-sfx.impact.scifi.shield.deflector.01", "ggg-sfx.magic.divine.cast.dispel.general.01", "ggg-sfx.impact.scifi.shield.general.01"],
  },
};
// Layers played with a surface's recording: blood on flesh, by kind of blow (a slash splatters, a point
// gushes, a hammer lands with gore).
// An element spell meets each surface in its own way: fire sizzles and bursts, electricity zaps, cold cracks
// like ice, acid hisses. It still rings off a ward or a shield that turns it aside, like any spell.
const COLD_CRACK = ["freesound:frost-crack-213579", "freesound:frost-crack-422619", "freesound:frost-crack-608685", "freesound:frost-crack-539696"];
const ELEMENT_TOUCH = {
  fire: { body: ["freesound:fire-sear"], metal: ["freesound:fire-sear", "kenney:impactPlate_light"], squish: ["freesound:steam-hiss"] },
  electricity: { body: ["freesound:electric-arc"], metal: ["freesound:electric-arc", "kenney:impactPlate_light"] },
  cold: { body: COLD_CRACK, metal: [...COLD_CRACK, "kenney:impactPlate_light"], glass: [...COLD_CRACK, "kenney:impactGlass_light"] },
  acid: { body: ["freesound:acid-fizz"], metal: ["freesound:acid-fizz"] },
};
for (const [element, touch] of Object.entries(ELEMENT_TOUCH)) {
  SOURCES[element] = { ward: SOURCES.spell.ward, shield: SOURCES.spell.shield, glass: SOURCES.spell.glass };
  for (const surface of ["flesh", "leather", "crunch", "wood", "stone", "squish", "metal", "glass"]) SOURCES[element][surface] = touch[surface] ?? (surface === "glass" ? SOURCES.spell.glass : touch.body);
}
// Layers played over a surface's sound, each with its own chance (a critical hit plays them all), delay after
// the blow (ms) and level: blood on flesh, a burst of flame under fire's sizzle, icicles tinkling after a frost
// crack, shards after glass, a shimmer over a ward's chime.
const BODIES = ["flesh", "leather", "crunch", "wood", "stone"];
const BLOOD = { arrow: ["freesound:blood-splat"], bullet: ["freesound:blood-gush", "freesound:blood-splat"], blade: ["freesound:blood-splat"], pierce: ["freesound:blood-gush", "freesound:blood-splat"], blunt: ["freesound:blood-gore", "freesound:blood-splat"] };
const LAYER_RULES = [
  { name: "blood", label: "Blood", blows: Object.keys(BLOOD), surfaces: ["flesh"], sources: (blow) => BLOOD[blow], chance: 0.55, offset: [15, 60], gain: 0.7 },
  { name: "burst", label: "Flame burst", blows: ["fire"], surfaces: [...BODIES, "metal"], sources: () => ["freesound:fire-burst"], chance: 0.7, offset: [0, 15], gain: 0.8 },
  { name: "tinkle", label: "Icicles", blows: ["cold"], surfaces: [...BODIES, "metal", "glass"], sources: () => ["freesound:frost-crack-264420", "freesound:frost-crack-114253"], chance: 0.45, offset: [50, 140], gain: 0.5 },
  { name: "shards", label: "Shards", blows: null, surfaces: ["glass"], sources: () => ["kenney:impactGlass_light"], chance: 0.5, offset: [50, 150], gain: 0.45 },
  { name: "shimmer", label: "Shimmer", blows: null, surfaces: ["ward"], sources: () => ["freesound:ward-chime-707618", "kenney:impactGlass_light"], chance: 0.7, offset: [15, 50], gain: 0.35 },
];
const LABELS = { flesh: "flesh", leather: "leather or cloth", metal: "metal armour", shield: "a raised shield", crunch: "chitin or bone", wood: "wood or bark", stone: "stone", glass: "glass or crystal", squish: "an ooze", ward: "a magical shield or armour" };
const BLOWS = { blade: "Blade", blunt: "Blunt blow", pierce: "Point", arrow: "Arrow", bullet: "Bullet", spell: "Spell", fire: "Fire", electricity: "Lightning", cold: "Cold", acid: "Acid" };

const { entries } = await soundInventory();
const folders = {};
for (const dir of ["kenney", "freesound"]) folders[dir] = (await readdir(path.join(modulesRoot, "animater/assets/sounds/surfaces", dir))).filter((f) => f.endsWith(".ogg")).sort();
const bundledSource = /^(kenney|freesound):(.+)$/;
const recordings = (source) => bundledSource.test(source)
  ? (([, dir, prefix]) => folders[dir].filter((f) => f.startsWith(prefix)).map((f) => ({ module: "animater", key: "", file: `${BUNDLED}/${dir}/${f}` })))(source.match(bundledSource))
  : entries.filter((e) => e.module === "ggg" && (e.key === source || e.key.startsWith(source + "."))).map((e) => ({ module: "ggg", key: e.key, file: e.file }));
// Alternate between sources, so the first few variants already mix packs and kinds of hit.
const interleave = (lists) => { const out = []; for (let i = 0; lists.some((l) => i < l.length); i++) for (const l of lists) if (i < l.length) out.push(l[i]); return out; };
const profiles = {};
for (const [blow, surfaces] of Object.entries(SOURCES))
  for (const [surface, sources] of Object.entries(surfaces)) {
    const found = interleave(sources.map(recordings));
    if (!found.some((e) => e.module === "animater")) throw Error(`No bundled recording for ${blow} on ${surface}`);
    if (!found.length) throw Error(`No recording for ${blow} on ${surface}: ${sources.join(", ")}`);
    const candidates = [];
    for (const e of found) {
      const m = await probeSoundFile(e.file);
      candidates.push({ ...e, nativeDuration: m.nativeDuration, meanDb: m.meanDb, peakDb: m.peakDb, gain: m.gain, duration: Math.min(m.nativeDuration, 2000) });
    }
    profiles[`surface-${blow}-${surface}`] = [{ label: `${BLOWS[blow]} on ${LABELS[surface]}`, role: "surface", candidates }];
  }
for (const rule of LAYER_RULES)
  for (const blow of rule.blows ?? Object.keys(SOURCES))
    for (const surface of rule.surfaces) {
      if (!SOURCES[blow]?.[surface]) continue;
      const found = interleave(rule.sources(blow).map(recordings));
      if (!found.length) throw Error(`No ${rule.name} recording for ${blow} on ${surface}`);
      const candidates = [];
      for (const e of found) {
        const m = await probeSoundFile(e.file);
        candidates.push({ ...e, nativeDuration: m.nativeDuration, meanDb: m.meanDb, peakDb: m.peakDb, gain: m.gain, duration: Math.min(m.nativeDuration, 2000) });
      }
      profiles[`surface-${blow}-${surface}-layer-${rule.name}`] = [{ label: `${rule.label}, ${BLOWS[blow].toLowerCase()} on ${LABELS[surface]}`, role: "layer", chance: rule.chance, offset: rule.offset, gain: rule.gain, candidates }];
    }
const out = path.join(modulesRoot, "animater", "data", "surface-sounds.mjs");
await writeFile(out, `// Generated by tools/build-surface-sounds.mjs. Do not edit by hand.
// Bundled recordings: CC0, by Kenney (modules/animater/assets/sounds/surfaces/kenney/License.txt) and Freesound
// authors (modules/animater/assets/sounds/surfaces/freesound/License.txt).
export const SURFACE_SOUND_PROFILES = ${JSON.stringify(profiles, null, 1)};
`);
console.log(`${Object.keys(profiles).length} surface profiles, ${Object.values(profiles).reduce((n, [c]) => n + c.candidates.length, 0)} recordings → ${out}`);
