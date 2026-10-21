// Builds data/surface-sounds.mjs: what a weapon's blow sounds like on each surface it can land on
// (bare flesh, leather or cloth, metal armour, a raised shield, chitin, bone or wood, stone, glass or
// crystal, an ooze, a magical ward), per kind of blow. Each profile lists recordings measured like every other automatic
// cue: GGG's by database key when that pack is installed, and Animater's own bundled CC0 recordings
// (assets/sounds/surfaces, Kenney), which always play.
import { writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import { soundInventory, probeSoundFile, modulesRoot } from "./sound-databases.mjs";

const BUNDLED = "modules/animater/assets/sounds/surfaces/kenney";
// "ggg-sfx.…": every GGG recording under that database key. "kenney:name": every bundled file starting with it.
const SOURCES = {
  blade: {
    flesh: ["ggg-sfx.melee.axe.slash.flesh.01", "ggg-sfx.impact.flesh.01", "kenney:knifeSlice", "kenney:impactPunch_medium"],
    leather: ["kenney:impactSoft_medium", "kenney:impactSoft_heavy", "kenney:dropLeather"],
    metal: ["ggg-sfx.melee.blade.block.shortsword.01", "ggg-sfx.melee.blade.block.greatsword.01", "kenney:impactPlate_medium", "kenney:impactPlate_heavy"],
    shield: ["ggg-sfx.equipment.armor.shield.impact.02.metal", "ggg-sfx.equipment.armor.shield.impact.01", "kenney:impactWood_heavy", "kenney:impactPlank_medium"],
    crunch: ["ggg-sfx.ranged.bomb.break.01", "ggg-sfx.impact.wood.01", "kenney:impactWood_light", "kenney:chop"],
    stone: ["ggg-sfx.ranged.thrown.stone.impact.01", "kenney:impactMining"],
    glass: ["kenney:impactGlass_medium", "kenney:impactGlass_heavy"],
    squish: ["ggg-sfx.magic.water.impact.bubble.01", "ggg-sfx.magic.water.impact.general.02"],
    ward: ["ggg-sfx.impact.scifi.shield.deflector.01", "ggg-sfx.magic.divine.cast.dispel.general.01", "ggg-sfx.impact.scifi.shield.general.01", "kenney:impactBell_heavy"],
  },
  blunt: {
    flesh: ["ggg-sfx.melee.unarmed.fist.strike.04", "ggg-sfx.melee.unarmed.fist.strike.03", "kenney:impactPunch_heavy"],
    leather: ["kenney:impactSoft_heavy", "kenney:dropLeather"],
    metal: ["ggg-sfx.melee.bludgeoning.strike.general.01.metal_hit", "ggg-sfx.equipment.armor.shield.impact.02.metal", "kenney:impactPlate_heavy", "kenney:impactMetal_heavy"],
    shield: ["ggg-sfx.equipment.armor.shield.impact.01", "kenney:impactWood_heavy"],
    crunch: ["ggg-sfx.ranged.bomb.break.01", "ggg-sfx.impact.wood.01", "kenney:impactWood_medium"],
    stone: ["ggg-sfx.ranged.thrown.stone.impact.01", "kenney:impactMining"],
    glass: ["kenney:impactGlass_heavy"],
    squish: ["ggg-sfx.magic.water.impact.bubble.01", "ggg-sfx.magic.water.impact.general.02"],
    ward: ["ggg-sfx.impact.scifi.shield.deflector.01", "ggg-sfx.magic.divine.cast.dispel.general.01", "ggg-sfx.impact.scifi.shield.general.01", "kenney:impactBell_heavy"],
  },
  pierce: {
    flesh: ["ggg-sfx.impact.flesh.01", "kenney:knifeSlice", "kenney:impactPunch_medium"],
    leather: ["kenney:impactSoft_medium", "kenney:handleSmallLeather"],
    metal: ["ggg-sfx.melee.blade.block.dagger.01", "ggg-sfx.melee.blade.block.rapier.01", "kenney:impactPlate_light", "kenney:impactMetal_medium"],
    shield: ["ggg-sfx.equipment.armor.shield.impact.01", "kenney:impactPlank_medium", "kenney:impactWood_medium"],
    crunch: ["ggg-sfx.ranged.bomb.break.01", "kenney:impactWood_light"],
    stone: ["ggg-sfx.ranged.thrown.stone.impact.01", "kenney:impactMining"],
    glass: ["kenney:impactGlass_light", "kenney:impactGlass_medium"],
    squish: ["ggg-sfx.magic.water.impact.bubble.01", "ggg-sfx.magic.water.impact.general.02"],
    ward: ["ggg-sfx.impact.scifi.shield.deflector.01", "ggg-sfx.magic.divine.cast.dispel.general.01", "ggg-sfx.impact.scifi.shield.general.01", "kenney:impactBell_heavy"],
  },
};
const LABELS = { flesh: "flesh", leather: "leather or cloth", metal: "metal armour", shield: "a raised shield", crunch: "chitin, bone or wood", stone: "stone", glass: "glass or crystal", squish: "an ooze", ward: "a magical shield or armour" };
const BLOWS = { blade: "Blade", blunt: "Blunt blow", pierce: "Point" };

const { entries } = await soundInventory();
const bundled = (await readdir(path.join(modulesRoot, "animater/assets/sounds/surfaces/kenney"))).filter((f) => f.endsWith(".ogg")).sort();
const recordings = (source) => source.startsWith("kenney:")
  ? bundled.filter((f) => f.startsWith(source.slice(7))).map((f) => ({ module: "animater", key: "", file: `${BUNDLED}/${f}` }))
  : entries.filter((e) => e.module === "ggg" && (e.key === source || e.key.startsWith(source + "."))).map((e) => ({ module: "ggg", key: e.key, file: e.file }));
// Alternate between sources, so the first few variants already mix packs and kinds of hit.
const interleave = (lists) => { const out = []; for (let i = 0; lists.some((l) => i < l.length); i++) for (const l of lists) if (i < l.length) out.push(l[i]); return out; };
const profiles = {};
for (const [blow, surfaces] of Object.entries(SOURCES))
  for (const [surface, sources] of Object.entries(surfaces)) {
    const found = interleave(sources.map(recordings));
    if (surface !== "squish" && !found.some((e) => e.module === "animater")) throw Error(`No bundled recording for ${blow} on ${surface}`);
    if (!found.length) throw Error(`No recording for ${blow} on ${surface}: ${sources.join(", ")}`);
    const candidates = [];
    for (const e of found) {
      const m = await probeSoundFile(e.file);
      candidates.push({ ...e, nativeDuration: m.nativeDuration, meanDb: m.meanDb, peakDb: m.peakDb, gain: m.gain, duration: Math.min(m.nativeDuration, 1500) });
    }
    profiles[`surface-${blow}-${surface}`] = [{ label: `${BLOWS[blow]} on ${LABELS[surface]}`, role: "surface", candidates }];
  }
const out = path.join(modulesRoot, "animater", "data", "surface-sounds.mjs");
await writeFile(out, `// Generated by tools/build-surface-sounds.mjs. Do not edit by hand.
// Bundled recordings: CC0, by Kenney; see modules/animater/assets/sounds/surfaces/kenney/License.txt
export const SURFACE_SOUND_PROFILES = ${JSON.stringify(profiles, null, 1)};
`);
console.log(`${Object.keys(profiles).length} surface profiles, ${Object.values(profiles).reduce((n, [c]) => n + c.candidates.length, 0)} recordings → ${out}`);
