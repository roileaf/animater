import { writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { soundInventory, probeSoundFile } from "./sound-databases.mjs";
import { spellSources } from "./pf2e-source.mjs";
import { soundDirection } from "./spell-sound-semantics.mjs";
import {nativeSpellDescription} from './spell-semantics.mjs';
import { PF2E_SPELLS } from "../scripts/catalogs/pf2e/spells/spell-catalog.mjs";
import { validateSoundFile } from "../scripts/core/stage-options.mjs";
// Cross-pack fallbacks: every cue lists each optional pack that has a fitting
// recording, so a user with any one pack still hears it. Runtime order decides.
// PF2e Creature Sounds is another module's own library: Animater never plays its files, so a cue's sixth
// argument (once its selector) is ignored.
const QUIET_DB = -34;
const cue = (label, role, ggg = "", psfx = "", files = "") => ({
  label,
  role,
  selectors: { ggg, psfx, soundfxlibrary: files },
});
const profiles = {
  fireball: [
    cue(
      "Fireball charge",
      "cast",
      "magic\\.fire\\.fireball.*cast",
      "^psfx\\.casting\\.fire",
    ),
    cue(
      "Fireball explosion",
      "impact",
      "magic\\.fire\\.fireball.*impact",
      "^psfx\\.3rd-level-spells\\.fireball.*explosion",
    ),
  ],
  // A storm called down, not a spark: the air charges, a thunderbolt cracks loose, thunder crashes on the first
  // creature and each leap to the next lands as a heavy strike of its own.
  chainLightning: [
    cue(
      "Storm gathers",
      "cast",
      "magic\\.electricity\\.cast\\.storm",
      "^psfx\\.3rd-level-spells\\.call-lightning\\.[^.]+\\.cast$",
    ),
    cue(
      "Thunderbolt release",
      "release",
      "magic\\.electricity\\.cast\\.charge",
      "^psfx\\.3rd-level-spells\\.call-lightning\\.[^.]+\\.primary$",
    ),
    cue(
      "Thunder crash",
      "impact",
      "magic\\.electricity\\.impact\\.crash",
      "^psfx\\.3rd-level-spells\\.call-lightning\\.[^.]+\\.primary$",
      "Nature/Single/Thunder/thunder-[1256]\\.",
    ),
    cue(
      "Lightning leaps",
      "chain",
      "magic\\.electricity\\.(?:impact\\.charge|lightning_bolt\\.[^.]+\\.impact)",
      "^psfx\\.3rd-level-spells\\.call-lightning\\.[^.]+\\.secondary$",
      "Spell Impact Lightning",
    ),
  ],
  lightningBolt: [
    cue(
      "Lightning release",
      "release",
      "magic\\.electricity\\.lightning_bolt.*cast",
      // Not call-lightning's cast: a 10 s storm build-up for a bolt's release.
      "^psfx\\.3rd-level-spells\\.call-lightning\\.[^.]+\\.secondary$",
    ),
    cue(
      "Thunder strike",
      "impact",
      "magic\\.electricity\\.(thunder\\.strike|impact\\.crackle)",
      "^psfx\\.3rd-level-spells\\.call-lightning\\.[^.]+\\.primary$",
      // The rolls that have died down by the cue's end (3 and 4 are still rumbling, then cut off).
      "Nature/Single/Thunder/thunder-[1256]\\.",
    ),
  ],
  fireRay: [
    cue(
      "Fire ray",
      "release",
      "magic\\.fire\\.surge\\.flames",
      "scorching-ray",
    ),
  ],
  coldRay: [
    cue(
      "Frost ray",
      "release",
      "magic\\.ice\\.ice_lance.*cast",
      "ray-of-frost",
    ),
  ],
  forceRay: [cue("Energy ray", "release", "^ggg-sfx\\.magic\\.arcane\\.cast\\.arrow", "ranged-magic\\.generic\\.beam")],
  radiantRay: [
    cue(
      "Radiant ray",
      "release",
      "magic\\.divine\\.light",
      "ranged-magic\\.generic\\.beam",
    ),
  ],
  moonRay: [
    cue(
      "Moonlight release",
      "release",
      "magic\\.arcane\\.light",
      // Not the moonbeam intros: 16 s sustained beams for a ray's release.
      "ranged-magic\\.generic\\.beam",
    ),
  ],
  darkRay: [
    cue(
      "Dark ray release",
      "release",
      "magic\\.occult\\.bolt.*cast",
      "^psfx\\.cantrips\\.eldritch-blast",
    ),
  ],
  poisonRay: [
    cue(
      "Toxic ray release",
      "release",
      "magic\\.acid\\.cast\\.general\\.03",
      "cantrips\\.poison-spray",
    ),
  ],
  forceMissile: [
    cue(
      "Force missile",
      "release",
      "^ggg-sfx\\.magic\\.arcane\\.cast\\.missiles\\.02",
      "magic-missile",
    ),
  ],
  coldCone: [
    cue("Freezing rush", "effect", "magic\\.ice\\.gale", "cone-of-cold"),
  ],
  fireCone: [
    cue(
      "Fan of flame",
      "effect",
      "magic\\.fire\\.surge\\.flames",
      "burning-hands",
    ),
  ],
  electricTouch: [
    cue(
      "Contact shock",
      "impact",
      "magic\\.electricity\\.zap",
      "shocking-grasp",
      "Spell Impact Lightning",
    ),
  ],
  acidSplash: [
    cue(
      "Acid splash",
      "impact",
      // Acid hitting, not the 5–7 s "Grotesque Acid" debuff swells.
      "magic\\.acid\\.cast\\.toss\\.impact",
      "acid-splash",
    ),
  ],
  fire: [
    cue(
      "Flame release",
      "effect",
      "magic\\.fire\\.(impact\\.general|ignite)",
      // Not create-bonfire: a 20 s ambient loop, cut off still burning at the cue's end.
      "^psfx\\.(casting\\.fire|weapon-swooshes\\.fire)",
    ),
  ],
  fireIgnition: [
    cue("Flame ignites", "effect", "^ggg-sfx\\.magic\\.fire\\.ignite", "^psfx\\.cantrips\\.produce-flame\\.v1\\.001\\.intro$"),
  ],
  cold: [
    cue(
      "Ice forms",
      "effect",
      // Not "Ailments Freeze 002" (10 s): this cue is also every frost weapon's hit accent.
      "magic\\.ice\\.(freeze\\.0[12]|impact\\.general\\.02)",
      "impacts\\.magicaleffects\\.cold",
    ),
  ],
  electric: [
    cue(
      "Electric discharge",
      "effect",
      "magic\\.electricity\\.(impact\\.general|zap|lightning_bolt\\.[^.]+\\.impact)",
      "impacts\\.magicaleffects\\.lightning",
      "Spell Impact Lightning",
    ),
  ],
  acid: [
    cue(
      "Corrosive surge",
      "effect",
      "magic\\.acid\\.debuff\\.virulent",
      "acid-splash",
    ),
  ],
  poison: [
    cue(
      "Poison releases",
      "effect",
      "magic\\.acid\\.(cast\\.general|impact)",
      "poison-spray",
    ),
  ],
  water: [
    cue(
      "Water surge",
      "effect",
      "magic\\.water\\.(jet.*cast|impact\\.general)",
      "casting\\.water",
      "Misc/Single/Water Splash",
    ),
  ],
  wind: [
    cue("Wind gust", "effect", "magic\\.air\\.wind\\.gust", "cantrips\\.gust"),
  ],
  earth: [
    cue(
      "Stone rumble",
      "effect",
      "magic\\.earth\\.(rise|impact\\.general)",
      "casting\\.earth",
    ),
  ],
  metal: [
    cue(
      "Metal rings",
      "effect",
      "magic\\.metal\\.impact\\.anvil\\.01",
      "",
      "Shield Hit",
    ),
  ],
  metalProjectile: [
    cue("Metal projectile release", "release", "^ggg-sfx\\.ranged\\.thrown\\.general", "^psfx\\.weapon-swooshes\\.light\\.v1\\.group01"),
    cue("Metal projectile contact", "impact", "^ggg-sfx\\.magic\\.metal\\.cast\\.hit"),
  ],
  metalResonance: [
    cue("Resonant metal note", "effect", "^ggg-sfx\\.magic\\.divine\\.cast\\.shimmer\\.03"),
  ],
  chainBinding: [
    cue("Chains weave", "effect", "^ggg-sfx\\.melee\\.bludgeoning\\.throw\\.chain|magic\\.arcane\\.surge\\.crystals\\.04"),
  ],
  sonic: [
    cue("Sonic shockwave", "effect", "magic\\.sonic\\.slam", "thunderclap"),
  ],
  force: [
    cue(
      "Force energy",
      "effect",
      "magic\\.arcane\\.impact\\.blast",
      "ranged-magic\\.generic\\.beam",
      "Combat/Single/Spell Impact/",
    ),
  ],
  void: [
    cue(
      "Void pulse",
      "effect",
      "magic\\.occult\\.pulse.*abyss",
      // The necrotic melee impacts sit near −32 dB: all but silent.
      "arms-of-hadar",
    ),
  ],
  shadow: [cue("Shadow gathers", "effect", "magic\\.occult\\.bolt.*cast")],
  psychic: [cue("Mental pulse", "effect", "^ggg-sfx\\.magic\\.occult\\.curse\\.confused", "cantrips\\.mind-sliver")],
  holy: [
    cue(
      "Radiant light",
      "effect",
      "magic\\.divine\\.light",
      "sacred-flame.*caster",
    ),
  ],
  healing: [
    cue("Healing glow", "effect", "magic\\.divine\\.healing", "cure-wounds"),
  ],
  natureHeal: [
    cue(
      "Natural restoration",
      "effect",
      "magic\\.primal\\.healing",
      "cure-wounds",
    ),
  ],
  waterHeal: [
    cue(
      "Restorative water",
      "effect",
      "magic\\.water\\.heal",
      "cure-wounds",
      "Misc/Single/Water Splash",
    ),
  ],
  revive: [cue("Return to life", "effect", "magic\\.divine\\.revivify")],
  shield: [
    cue(
      "Ward forms",
      "effect",
      "magic\\.divine\\.buff\\.ward",
      "shield-spell\\.intro",
    ),
  ],
  bless: [
    cue(
      "Blessing",
      "effect",
      "magic\\.divine\\.buff\\.bless",
      "1st-level-spells\\.bless",
    ),
  ],
  vines: [
    cue(
      "Roots grow",
      "effect",
      "magic\\.primal\\.(growth\\.02|burst\\.bramble)",
      "entangle\\.vines.*intro",
    ),
  ],
  growth: [
    cue(
      "Verdant growth",
      "effect",
      "magic\\.primal\\.growth\\.01",
      "entangle\\.vines.*intro",
    ),
  ],
  thornWall: [
    cue(
      "Thorn wall rises",
      "effect",
      "magic\\.primal\\.structure\\.wall\\.thorns",
      "entangle\\.vines.*intro",
    ),
  ],
  swarm: [
    cue("Insect swarm", "effect", "magic\\.primal\\.bugs\\.poisonous_swarm"),
  ],
  // The ground heaving, not one seismic pulse.
  earthquake: [
    cue("Seismic rumble", "effect", "magic\\.earth\\.(earthquake\\.(close\\.short|impact)|pulse\\.seismic)", "^psfx\\.casting\\.earth"),
  ],
  stoneWall: [
    cue(
      "Stone wall rises",
      "effect",
      "magic\\.earth\\.structure\\.wall",
      "casting\\.earth",
    ),
  ],
  iceWall: [
    cue(
      "Ice wall forms",
      "effect",
      "magic\\.ice\\.structure\\.wall",
      "impacts\\.magicaleffects\\.cold",
    ),
  ],
  fireWall: [
    cue(
      "Flame rises",
      "effect",
      "magic\\.fire\\.structure\\.pillar",
      "^psfx\\.(casting\\.fire|1st-level-spells\\.burning-hands)",
    ),
  ],
  light: [
    cue(
      "Light appears",
      "effect",
      "magic\\.divine\\.light",
      "cantrips\\.(light|dancing-lights)",
    ),
  ],
  sleep: [cue("Sleep settles", "effect", "^ggg-sfx\\.magic\\.occult\\.curse\\.hypnotize", "1st-level-spells\\.sleep")],
  fear: [cue("Dread rises", "effect", "magic\\.occult\\.curse\\.general\\.02", "toll-the-dead\\.ominous-bell")],
  drain: [
    cue(
      "Energy siphon",
      "effect",
      "magic\\.occult\\.siphon",
      "arms-of-hadar",
    ),
  ],
  song: [
    cue(
      "Musical flourish",
      "effect",
      "magic\\.sonic\\.harp\\.surge",
      "musical-instruments\\.lute",
    ),
  ],
  summon: [
    cue(
      "Summoning arrival",
      "effect",
      "magic\\.primal\\.cast\\.general\\.03",
      "magic-signs\\.circle.*conjuration.*intro",
    ),
  ],
  transform: [
    cue("Form shifts", "effect", "magic\\.primal\\.cast\\.general\\.03", "^psfx\\.casting\\.on-token"),
  ],
  teleport: [
    cue(
      "Teleport departure",
      "cast",
      "magic\\.occult\\.movement\\.teleportation",
      "misty-step.*intro\\.generic",
    ),
  ],
  pocketTransition: [
    cue("Pocket departure", "effect", "^ggg-sfx\\.magic\\.occult\\.movement\\.teleportation", "misty-step.*intro\\.generic"),
  ],
  objectWhoosh: [
    cue("Hook and rope extension", "release", "^ggg-sfx\\.ranged\\.thrown\\.general", "^psfx\\.weapon-swooshes\\.light\\.v1\\.group01"),
  ],
  starFlight: [
    cue("Star-flight shimmer", "release", "^ggg-sfx\\.magic\\.arcane\\.light\\.revealing"),
  ],
  explosion: [
    cue("Explosion", "impact", "^ggg-sfx\\.(impact\\.explosion\\.general|ranged\\.bomb\\.explosion|ranged\\.siege_weapons\\.cannon\\.impact)", "fireball.*explosion"),
  ],
  // GGG's creatures.shriek.generic key points at "Rusty Tool" recordings; use the void screams only.
  scream: [cue("Piercing shriek", "effect", "^ggg-sfx\\.creatures\\.shriek\\.void")],
  battleCry: [cue("Rallying cry", "cast", "", "", "Battle Cry")],
  whistle: [cue("Sharp whistle", "cast", "^ggg-sfx\\.abilities\\.gunslinger\\.whistle")],
  whispers: [
    // Only the audible takes: dissonant-whispers 002 and 003 sit at −48 and −42 dB.
    cue("Eerie whispers", "effect", "^ggg-sfx\\.magic\\.occult\\.cast\\.whispers", "dissonant-whispers\\.v1\\.00[14]"),
  ],
  spirit: [cue("Spirit surge", "effect", "^ggg-sfx\\.magic\\.occult\\.(cast|buff)\\.ghostly")],
  divineWrath: [
    cue("Divine wrath", "effect", "^ggg-sfx\\.magic\\.divine\\.(impact\\.wrath|cast\\.smite)", "sacred-flame.*caster"),
  ],
  slash: [
    // Blades striking, not swinging through the air (the general key is whooshes).
    cue("Slashing hit", "impact", "^ggg-sfx\\.melee\\.blade\\.strike\\.(shortsword|greatsword)\\.01", "^psfx\\.impacts\\.slashing", "Melee Hit"),
  ],
  pierce: [
    cue("Piercing hit", "impact", "^ggg-sfx\\.impact\\.arrow\\.hit", "", "Arrow Impact"),
  ],
  bludgeon: [
    cue("Bludgeoning hit", "impact", "^ggg-sfx\\.melee\\.bludgeoning\\.strike\\.one-hand", "^psfx\\.impacts\\.bludgeoning", "Misc/Single/Impact/"),
  ],
  claws: [cue("Rending claws", "impact", "^ggg-sfx\\.(impact\\.flesh\\.01|melee\\.claws\\.strike\\.stab)", "^psfx\\.impacts\\.slashing", "Combat/Single/Melee Hit/")],
  gravity: [cue("Gravity crush", "effect", "^ggg-sfx\\.magic\\.occult\\.movement\\.whoosh\\.gravity")],
  dispel: [cue("Magic unravels", "effect", "magic\\.counter\\.dispel", "magic-signs\\.circle\\.v1\\.abjuration\\.outro")],
  time: [cue("Time shifts", "effect", "magic\\.time\\.reverse")],
  slow: [cue("Time slows", "effect", "magic\\.time\\.slow")],
  // PSFX's door locks are −32 to −40 dB.
  unlock: [cue("Lock opens", "effect", "magic\\.tech\\.lock\\.unlock|equipment\\.misc\\.lock\\.unlock\\.02")],
  mending: [
    cue(
      "Object repairs",
      "effect",
      "magic\\.tech\\.healing",
      "cantrips\\.mending.*with-cast",
    ),
  ],
  detect: [cue("Magic sensed", "effect", "^ggg-sfx\\.magic\\.arcane\\.light\\.revealing", "detect-magic")],
  laughter: [cue("Laughter", "effect", "^ggg-sfx\\.(actions\\.laugh|magic\\.occult\\.cast\\.laughter)", "hideous-laughter\\.fem-group")],
  applause: [
    cue(
      "Audience cheers",
      "effect",
      "\\.cheer\\.01\\.01$",
      "",
      "(applause|clapping)",
    ),
  ],
  dragonRoar: [
    {
      ...cue("Dragon roar", "effect", "", "creature.*dragon.*roar"),
      // GGG's "sonic roar" files are air whooshes and it has no dragon; a bear's rage roar and monster growls.
      selectors: {
        ggg: "magic\\.primal\\.buff\\.bear_rage",
        psfx: "creature.*dragon.*roar",
        soundfxlibrary: "Creatures/Monsters/Growl/",
      },
    },
  ],
};
const { entries, packs } = await soundInventory();
const usable = entries.filter((e) => {
  try {
    validateSoundFile(e.file);
    return !/(?:loop|death|hurt|latin|incantation)/i.test(
      e.key + " " + path.basename(e.file),
    );
  } catch {
    return false;
  }
});
const missing = [],
  selected = new Map();
for (const [profile, cues] of Object.entries(profiles))
  for (const c of cues) {
    c.candidates = [];
    for (const [module, pattern] of Object.entries(c.selectors)) {
      if (!pattern) continue;
      const regex = new RegExp(pattern, "i"),
        seen = new Set();
      const matches = usable
        .filter((e) => e.module === module && regex.test(e.key || e.file))
        .filter((e) => {
          // Distance variants are longer recordings of the same effect. Use
          // the normal 15ft clip rather than arbitrarily chopping a 90ft take.
          if (/\.(?:0?5|30|60|90|120)ft$/.test(e.key)) return false;
          // GGG's acid cast/impact labels contain poison files. Match real material.
          if (
            ["acid", "acidSplash"].includes(profile) &&
            !/acid/i.test(path.basename(e.file))
          )
            return false;
          if (
            ["poison", "poisonRay"].includes(profile) &&
            !/poison/i.test(path.basename(e.file))
          )
            return false;
          if (seen.has(e.file)) return false;
          seen.add(e.file);
          return true;
        })
        .sort(
          (a, b) => a.key.localeCompare(b.key) || a.file.localeCompare(b.file),
        )
        .slice(0, 6);
      c.candidates.push(
        ...matches.map((e) => ({ module: e.module, key: e.key, file: e.file })),
      );
    }
    if (!c.candidates.length) missing.push({ profile, label: c.label });
    delete c.selectors;
    for (const e of c.candidates) selected.set(e.file, e);
  }
const durations = new Map(),
  files = [...selected.keys()];
let cursor = 0;
await Promise.all(
  Array.from({ length: 8 }, async () => {
    while (cursor < files.length) {
      const f = files[cursor++];
      durations.set(f, await probeSoundFile(f));
    }
  }),
);
for (const cues of Object.values(profiles))
  for (const c of cues) {
    for (const e of c.candidates)
      Object.assign(e, durations.get(e.file), { duration: Math.min(4500, durations.get(e.file).nativeDuration) });
    // Automatic balancing only turns files down, so a take quieter than −34 dB mean stays all but inaudible:
    // dropped while the cue has a louder one.
    if (c.candidates.some((e) => e.meanDb >= QUIET_DB)) c.candidates = c.candidates.filter((e) => e.meanDb >= QUIET_DB);
  }
const sources = await spellSources();
const byId = new Map(sources.spells.map((e) => [e.source._id, e.source]));
const designs = {};
for (const spell of PF2E_SPELLS) {
  const source = byId.get(spell.id);
  if (!source) throw Error(`Missing description: ${spell.name}`);
  const d = soundDirection(spell, source);
  designs[spell.id] = {
    ...d,
    descriptionHash: createHash("sha256")
      .update(nativeSpellDescription(source))
      .digest("hex")
      .slice(0, 16),
  };
}
const counts = {};
for (const d of Object.values(designs))
  counts[d.profile || "quiet"] = (counts[d.profile || "quiet"] ?? 0) + 1;
const source = {
  pf2e: sources.ref,
  sha: sources.sha,
  spells: PF2E_SPELLS.length,
  packs,
};
await writeFile(
  "data/spell-sounds.mjs",
  "// Generated by tools/build-spell-sounds.mjs. Audio references only; no audio redistributed.\nexport const SOUND_SOURCE = " +
    JSON.stringify(source) +
    ";\nexport const SOUND_PROFILES = " +
    JSON.stringify(profiles) +
    ";\nexport const SPELL_SOUND_DESIGNS = " +
    JSON.stringify(designs) +
    ";\n",
);
const coverage = {
  ...source,
  descriptionAudit: PF2E_SPELLS.length,
  emptyDescriptions: Object.values(designs).filter((d) => !d.descriptionChars)
    .length,
  profiles: Object.keys(profiles).length,
  selectedFiles: files.length,
  counts,
  unavailableProfiles: missing,
  packCoverage: Object.fromEntries(
    packs.map((p) => [
      p.module,
      PF2E_SPELLS.filter((s) =>
        profiles[designs[s.id].profile]?.some((c) =>
          c.candidates.some((e) => e.module === p.module),
        ),
      ).length,
    ]),
  ),
  notes: [
    "Full native descriptions analyzed by semantic rules; exception spells individually reviewed.",
    "Quiet/ambiguous utility effects receive no invented sound.",
    "All selected files exist and ffprobe confirms playable duration.",
    "Unmatched profiles stay quiet when the active pack has no fitting cue.",
    "Six alternatives maximum per pack per cue; semantic choice precedes deterministic variant rotation.",
    "Per-file attenuation targets at most -20 dBFS mean and -3 dBFS peak at full user volume. Quiet sounds are never boosted; RMS is not perceived loudness.",
  ],
};
await writeFile(
  "data/spell-sound-coverage.json",
  JSON.stringify(coverage, null, 2) + "\n",
);
const csv = (value) => '"' + String(value ?? "").replaceAll('"', '""') + '"';
await writeFile(
  "data/pf2e-spell-sounds.csv",
  [
    "Spell,ID,Profile,Reason,GGG,PSFX,SoundFx Library,PF2e Creature Sounds",
    ...PF2E_SPELLS.map((s) => {
      const d = designs[s.id],
        cues = profiles[d.profile] ?? [];
      return [
        s.name,
        s.id,
        d.profile || "quiet",
        d.reason,
        ...packs.map((p) =>
          cues
            .flatMap((c) =>
              c.candidates
                .filter((e) => e.module === p.module)
                .map((e) => e.key || e.file),
            )
            .join(" | "),
        ),
      ]
        .map(csv)
        .join(",");
    }),
  ].join("\n") + "\n",
);
console.log(JSON.stringify(coverage, null, 2));
