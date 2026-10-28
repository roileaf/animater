import test from "node:test";
import assert from "node:assert/strict";
import { stat } from "node:fs/promises";
import path from "node:path";
import {
  PF2E_SPELLS,
  spellRecipe,
  normalizeCatalogState,
  automaticCatalogRecipe,
  resolveAutomaticRecipe,
} from "../../../scripts/catalogs/pf2e/spells/spell-catalog.mjs";
import {
  SOUND_PROFILES,
  SPELL_SOUND_DESIGNS,
  SOUND_SOURCE,
  installedSoundCatalog,
  prepareRecipeSounds,
  previewRecipeSounds,
} from "../../../scripts/engines/sound/spell-sounds.mjs";
import { previewPlan, validateRecipe } from "../../../scripts/core/model.mjs";
import { timedStages } from "../../../scripts/engines/playback/composition.mjs";
import { soundDirection } from "../../../tools/spell-sound-semantics.mjs";
const spell = (name) => PF2E_SPELLS.find((s) => s.name === name);
const allCandidates = Object.values(SOUND_PROFILES).flatMap((c) =>
  c.flatMap((s) => s.candidates),
);
test('reviewed fear and support art does not invent public fear or premature healing audio', () => {
  const source={system:{description:{value:'A fully described magical change takes place.'}}};
  for(const name of ['Fear the Sun','Dread Secret','Friends to Foes','Hollow Heart','Spirit Link','Fated Healing','Stabilize'])
    assert.equal(soundDirection(spell(name),source).profile,'',name);
  assert.equal(soundDirection(spell('Devour Life'),source).profile,'drain');
  assert.equal(soundDirection(spell('Fearful Feast'),source).profile,'drain');
});
function fixture(
  active = ["ggg", "psfx", "soundfxlibrary", "pf2e-creature-sounds"],
  relocate = false,
) {
  const paths = new Map();
  for (const c of allCandidates)
    if (c.key)
      paths.set(c.key, [
        ...(paths.get(c.key) ?? []),
        relocate && c.module === "psfx"
          ? c.file.replace("modules/psfx", "audio/peri")
          : c.file,
      ]);
  const modules = new Map(active.map((m) => [m, { active: true }]));
  const database = {
    entryExists: (k) => paths.has(k),
    getAllFileEntries: (k) => paths.get(k),
  };
  return {
    modules,
    database,
    catalog: installedSoundCatalog(modules, database),
  };
}
const context = {
  source: { center: { x: 0, y: 0 } },
  targets: [100, 400, 800].map((x) => ({ center: { x, y: 0 } })),
  gridSize: 100,
};
const sounds = (r) => r.stages.filter((s) => s.kind === "sound");
test("complete description audit has no unclassified entries and every referenced file exists", async () => {
  assert.equal(Object.keys(SPELL_SOUND_DESIGNS).length, PF2E_SPELLS.length);
  assert.equal(SOUND_SOURCE.sha, "581c2bf2ca9734f4dd83f034fbcc93f8e4fd96eb");
  for (const s of PF2E_SPELLS) {
    const d = SPELL_SOUND_DESIGNS[s.id];
    assert.ok(d.reason);
    assert.ok(d.descriptionChars >= 0);
    if (!d.descriptionChars) assert.equal(d.profile, "");
    assert.match(d.descriptionHash, /^[a-f0-9]{16}$/);
    if (d.profile)
      assert.ok(
        SOUND_PROFILES[d.profile]?.some((c) => c.candidates.length),
        s.name,
      );
  }
  await Promise.all(
    [...new Set(allCandidates.map((c) => c.file))].map(async (f) =>
      assert.ok((await stat(path.resolve("..", "..", f))).isFile(), f),
    ),
  );
});
test("pack activation is optional; no packs means exactly the original visual recipe", () => {
  const base = spellRecipe(spell("Fireball"));
  assert.deepEqual(
    spellRecipe(spell("Fireball"), undefined, { sounds: fixture([]).catalog }),
    base,
  );
  assert.deepEqual(
    spellRecipe(spell("Fireball"), undefined, { sounds: null }),
    base,
  );
});
test("every supported audio pack contributes fitting cues without requiring another pack", () => {
  for (const [pack, name] of [
    ["ggg", "Heal"],
    ["psfx", "Ray of Frost"],
    ["soundfxlibrary", "Chain Lightning"],
  ]) {
    const r = spellRecipe(spell(name), undefined, {
      sounds: fixture([pack]).catalog,
    });
    assert.ok(sounds(r).length, pack);
    assert.ok(
      sounds(r).every((s) => s.optionalSound.candidates[0].module === pack),
    );
  }
  // PF2e Creature Sounds is that module's own library: Animater never plays its files.
  const r = spellRecipe(spell("Roar of the Dragon"), undefined, { sounds: fixture(["pf2e-creature-sounds"]).catalog });
  assert.equal(sounds(r).length, 0);
});
test("manager-only modules cannot invent an audio library", () => {
  const { catalog } = fixture([
    "monks-sound-enhancements",
    "moulinette-soundboards",
    "soundbrett",
    "the-sound-of-silence",
  ]);
  assert.equal(catalog.packs.length, 0);
  assert.equal(
    sounds(spellRecipe(spell("Heal"), undefined, { sounds: catalog })).length,
    0,
  );
});
test("silent, private and player-chosen auditory spells stay quiet", () => {
  for (const name of [
    "Silence",
    "Message",
    "Dream Message",
    "Ghost Sound",
    "Sculpt Sound",
  ])
    assert.equal(
      sounds(spellRecipe(spell(name), undefined, { sounds: fixture().catalog }))
        .length,
      0,
      name,
    );
});
test("dragon roar, cheering, rays and explosive impacts remain distinct", () => {
  assert.equal(
    SPELL_SOUND_DESIGNS[spell("Roar of the Dragon").id].profile,
    "dragonRoar",
  );
  assert.equal(
    SPELL_SOUND_DESIGNS[spell("Roaring Applause").id].profile,
    "applause",
  );
  assert.ok(
    SOUND_PROFILES.applause[0].candidates.every((c) => /Cheering/.test(c.file)),
  );
  const frost = sounds(
    spellRecipe(spell("Ray of Frost"), undefined, {
      sounds: fixture(["psfx"]).catalog,
    }),
  );
  assert.match(frost[0].soundFile, /ray-of-frost/);
  const fireball = sounds(
    spellRecipe(spell("Fireball"), undefined, {
      sounds: fixture(["psfx"]).catalog,
    }),
  );
  assert.equal(fireball.length, 2);
  assert.equal(fireball[0].label, "Fireball charge");
  assert.doesNotMatch(fireball[0].soundFile, /beam/);
  assert.match(fireball[1].soundFile, /explosion/);
  for (const c of SOUND_PROFILES.acid[0].candidates)
    assert.match(c.file, /acid/i);
});
test("reviewed rays use their stated energy rather than damage-derived material", () => {
  for (const [name, profile] of [
    ["Admonishing Ray", "forceRay"],
    ["Moonbeam", "moonRay"],
    ["Polar Ray", "coldRay"],
    ["Fire Ray", "fireRay"],
    ["Divine Lance", "radiantRay"],
    ["Chilling Darkness", "darkRay"],
    ["Ray of Corruption", "poisonRay"],
  ])
    assert.equal(SPELL_SOUND_DESIGNS[spell(name).id].profile, profile, name);
  const r = spellRecipe(spell("Admonishing Ray"), undefined, {
    sounds: fixture(["ggg"]).catalog,
  });
  // GGG now supplies an arcane energy-arrow fallback; never an earth rumble.
  assert.ok(
    sounds(r).every((s) => /Energy Arrow/.test(s.soundFile) && !/earth|stone|rumble/i.test(s.soundFile)),
    "GGG plays its energy ray fallback, not an invented earth rumble",
  );
});
test("saved optional cues are silent in editor when pack is off without shifting highlight indices", () => {
  const r = spellRecipe(spell("Fireball"), undefined, {
    sounds: fixture().catalog,
  });
  const preview = previewRecipeSounds(r, fixture([]).catalog);
  assert.equal(preview.stages.length, r.stages.length);
  assert.ok(sounds(preview).every((s) => s.skipSound));
  assert.equal(preview.stages[0].stageId, r.stages[0].stageId);
  assert.ok(
    sounds(previewRecipeSounds(r, fixture(["ggg"]).catalog)).every(
      (s) => !s.skipSound && s.soundFile.includes("modules/ggg"),
    ),
  );
});
test("full description drives cues while misleading spell name cannot override silence", () => {
  const s = {
    ...spell("Fireball"),
    name: "Thunder Dragon Fireball",
    traits: ["subtle"],
  };
  const d = soundDirection(s, {
    system: {
      description: {
        value: "You quietly conceal the target, making no sound.",
      },
    },
  });
  assert.equal(d.profile, "");
  const loud = soundDirection(
    { ...spell("Heal"), name: "Custom Restoration" },
    {
      system: {
        description: { value: "<p>The target regains 10 hit points.</p>" },
      },
    },
  );
  assert.equal(loud.profile, "healing");
});
test("late database registration becomes available without cached absence; PSFX relocation preserves chosen file variant", () => {
  const { modules, database } = fixture(["psfx"], true);
  const empty = installedSoundCatalog(modules, { entryExists: () => false });
  assert.equal(
    sounds(spellRecipe(spell("Fireball"), undefined, { sounds: empty })).length,
    0,
  );
  const catalog = installedSoundCatalog(modules, database);
  const r = spellRecipe(spell("Fireball"), undefined, { sounds: catalog });
  assert.equal(sounds(r).length, 2);
  assert.ok(sounds(r).every((s) => s.soundFile.startsWith("audio/peri/")));
});
test("the installed sound catalog is reused until the packs or the database's size change", () => {
  const { modules, database } = fixture(["psfx"], true);
  let asked = 0;
  const db = { ...database, flattenedEntries: [1, 2], entryExists: (key) => (asked++, database.entryExists(key)) };
  const first = installedSoundCatalog(modules, db);
  const before = asked;
  assert.ok(before > 0);
  assert.equal(installedSoundCatalog(modules, db), first, "same packs, same database: no new lookups");
  assert.equal(asked, before);
  db.flattenedEntries.push(3);
  assert.notEqual(installedSoundCatalog(modules, db), first, "a pack registered later is picked up");
  const unsized = { entryExists: () => false };
  assert.notEqual(installedSoundCatalog(modules, unsized), installedSoundCatalog(modules, unsized), "a database that cannot tell its size is always asked");
});
test("removed optional pack falls back or skips audio while preserving visuals and custom file overrides", () => {
  const r = spellRecipe(spell("Fireball"), undefined, {
    sounds: fixture().catalog,
  });
  const ggg = prepareRecipeSounds(r, fixture(["ggg"]).catalog);
  assert.equal(sounds(ggg).length, 2);
  assert.match(sounds(ggg)[0].soundFile, /modules\/ggg/);
  const off = prepareRecipeSounds(r, fixture([]).catalog);
  assert.equal(sounds(off).length, 0);
  assert.deepEqual(
    off.stages,
    r.stages.filter((s) => s.kind !== "sound"),
  );
  const manual = structuredClone(r);
  const audio = sounds(manual)[0];
  audio.soundFile = "worlds/demo/custom.ogg";
  delete audio.optionalSound;
  assert.ok(
    sounds(prepareRecipeSounds(manual, fixture([]).catalog)).some(
      (s) => s.soundFile === "worlds/demo/custom.ogg",
    ),
  );
});
test("custom stage linked to a skipped optional cue keeps its absolute timing", () => {
  const r = spellRecipe(spell("Heal"), undefined, {
    sounds: fixture().catalog,
  });
  const sound = sounds(r)[0];
  const child = {
    ...r.stages[0],
    stageId: "following-custom",
    afterStage: sound.stageId,
    startOffset: 100,
    timingAnchor: "end",
  };
  r.stages.push(child);
  const expected = timedStages(r).at(-1).delay;
  const retained = prepareRecipeSounds(r, fixture([]).catalog);
  assert.equal(retained.stages.at(-1).afterStage, "");
  assert.equal(timedStages(retained).at(-1).delay, expected);
});
test("cue start follows referenced stage start without changing with its duration; impact cue follows arrival", () => {
  const s = spell("Fireball");
  const r = spellRecipe(s, undefined, { sounds: fixture().catalog });
  for (const distance of [1, 3, 12]) {
    const timed = timedStages(r, distance);
    for (const cue of timed.filter((s) => s.kind === "sound"))
      assert.equal(
        cue.delay,
        timed.find((p) => p.stageId === cue.afterStage).delay,
      );
  }
  const base = validateRecipe({
    id: "link",
    name: "link",
    trigger: "manual",
    stages: [
      {
        kind: "projectile",
        stageId: "flight",
        assets: ["jb2a.fireball"],
        delay: 100,
        duration: 1000,
        perSquare: 100,
      },
      {
        kind: "sound",
        stageId: "cue",
        soundFile: "audio/frost.ogg",
        afterStage: "flight",
        timingAnchor: "start",
        duration: 1000,
      },
    ],
  });
  assert.equal(timedStages(base, 20)[1].delay, 100);
});
test("chain cue plays once per actual hop; normal multi-target sounds play once", () => {
  const r = spellRecipe(spell("Chain Lightning"), undefined, {
    sounds: fixture().catalog,
  });
  const plan = previewPlan(r, context);
  const hops = plan.filter((s) => s.kind === "travel"),
    audio = plan.filter((s) => s.kind === "sound"),
    leaps = audio.filter((s) => s.label === "Lightning leaps");
  // A storm, not a spark: the air charges, a thunderbolt cracks loose and thunder crashes, besides each leap.
  assert.deepEqual([...new Set(audio.map((s) => s.label))].sort(), ["Lightning leaps", "Storm gathers", "Thunder crash", "Thunderbolt release"]);
  assert.equal(leaps.length, hops.length, "one strike per actual hop");
  assert.deepEqual(leaps.map((s) => s.delay), hops.map((s) => s.delay));
  assert.ok(leaps[1].delay > leaps[0].delay);
  assert.ok(audio.every((s) => s.volume < 0.35));
  assert.ok(leaps.every((s) => s.duration > 550 && s.duration <= 1100), "each leap rings out, not a tick");
  assert.ok(leaps.every((s) => s.optionalSound.candidates[0].module === "ggg"));
  const fire = previewPlan(
    spellRecipe(spell("Fireball"), undefined, { sounds: fixture().catalog }),
    {
      ...context,
      template: { center: { x: 400, y: 0 } },
      area: { center: { x: 400, y: 0 }, diameter: 400 },
    },
  );
  assert.equal(fire.filter((s) => s.kind === "sound").length, 2);
});
test("catalog sound toggle/volume applies to automatic roll resolver without modifying custom recipes", () => {
  const s = spell("Ray of Frost"),
    event = {
      type: s.trigger,
      item: {
        type: "spell",
        name: s.name,
        uuid: `Compendium.pf2e.spells-srd.Item.${s.id}`,
        system: { slug: s.slug },
      },
    };
  const state = normalizeCatalogState({
    enabled: true,
    motion: false,
    soundVolume: 0.2,
  });
  const native = automaticCatalogRecipe(event, state, [], fixture().catalog);
  assert.equal(sounds(native)[0].volume, 0.2 * (sounds(native)[0].optionalSound.gain ?? 1));
  assert.equal(
    sounds(
      automaticCatalogRecipe(
        event,
        { ...state, sound: false },
        [],
        fixture().catalog,
      ),
    ).length,
    0,
  );
  const custom = { ...spellRecipe(s), id: "custom" };
  assert.equal(
    resolveAutomaticRecipe(event, state, [custom], {
      soundCatalog: fixture().catalog,
    }),
    custom,
  );
  assert.equal(normalizeCatalogState({ soundVolume: 5 }).soundVolume, 1);
  assert.equal(normalizeCatalogState().sound, true);
});
test("all generated audio recipes validate for each pack combination within stage budget", () => {
  for (const packs of [
    [],
    ["ggg"],
    ["psfx"],
    ["soundfxlibrary"],
    ["pf2e-creature-sounds"],
    ["ggg", "psfx", "soundfxlibrary", "pf2e-creature-sounds"],
  ]) {
    const catalog = fixture(packs).catalog;
    for (const s of PF2E_SPELLS.filter(s=>!s.design.unavailable)) {
      const r = spellRecipe(s, undefined, { sounds: catalog });
      assert.ok(r.stages.length <= 12);
      assert.doesNotThrow(() => validateRecipe(r), `${packs}: ${s.name}`);
      for (const audio of sounds(r)) assert.ok(audio.duration <= 4500);
    }
  }
});
