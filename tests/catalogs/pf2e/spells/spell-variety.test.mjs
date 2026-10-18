import test from "node:test";
import assert from "node:assert/strict";
import { analyzeSpellDescription } from "../../../../tools/spell-semantics.mjs";
import { SPELL_MOTIFS, applySpellDesign } from "../../../../scripts/catalogs/pf2e/spells/spell-design.mjs";
import { resolveSpellMedia } from "../../../../tools/spell-asset-selection.mjs";
const analyze = (
  slug,
  prose,
  theme = "arcane",
  delivery = "target",
  traits = [],
) =>
  analyzeSpellDescription(
    {
      name: slug.replaceAll("-", " "),
      system: {
        description: { value: `<p>${prose}</p>` },
        traits: { value: traits },
        target: { value: delivery === "self" ? "" : "1 creature" },
        time: { value: "2" },
        damage: {},
      },
    },
    { slug, theme, delivery, kind: "spell" },
  );

test("unrelated arcane spells never borrow giant hand through generic label words", () => {
  const row = (key) => ({
    key: `jb2a.${key}`,
    file: "Square_400x400.webm",
    ...(key.startsWith("arcane_hand")
      ? { metadata: { name: "Arcane casting hand cue" } }
      : {}),
  });
  const rows = [
    "cast_generic.purple",
    "magic_missile.purple",
    "impact.purple",
    "magic_signs.circle.evocation.dark_red",
    "arcane_hand.purple",
  ].map(row);
  const defaults = {
    cast: "cast_generic",
    bolt: "magic_missile",
    hit: "impact",
    aura: "magic_signs.circle.evocation",
    area: "impact",
  };
  const out = resolveSpellMedia(
    { free: rows, patreon: rows },
    "arcane",
    SPELL_MOTIFS.generic,
    defaults,
    {
      name: "Prestidigitation",
      design: { label: "Arcane casting cue", pattern: "generic" },
    },
  );
  assert.equal(out.aura[0], "jb2a.magic_signs.circle.evocation.dark_red");
});
test("thematic casting material outranks generic flash when both have valid geometry", () => {
  const rows = [
    "cast_generic.green",
    "swirling_leaves.green",
    "magic_missile.green",
    "impact.green",
    "energy_field.green",
  ].map((key) => ({ key: `jb2a.${key}`, file: "Square_400x400.webm" }));
  const defaults = {
    cast: "swirling_leaves,cast_generic",
    bolt: "magic_missile",
    hit: "impact",
    aura: "energy_field",
    area: "impact",
  };
  assert.equal(
    resolveSpellMedia(
      { free: rows, patreon: rows },
      "plant",
      SPELL_MOTIFS.generic,
      defaults,
      { name: "Nature spell", design: { pattern: "generic" } },
    ).cast[0],
    "jb2a.swirling_leaves.green",
  );
});

test("reviewed utility spells use distinct description-led treatments", () => {
  const examples = [
    [
      "message",
      "You mouth words quietly; they reach the ears of the target.",
      "whisper",
    ],
    ["command", "You shout a command that is hard to ignore.", "commandWord"],
    ["charm", "Your visage seems bathed in a dreamy haze.", "charmHaze"],
    ["silence", "The target makes no sound.", "silenceField"],
    [
      "sculpt-sound",
      "You change the sounds made by a creature or object.",
      "soundSculpt",
    ],
    [
      "runic-weapon",
      "The weapon glimmers with magic as temporary runes carve down its length.",
      "weaponRunes",
    ],
    ["runic-body", "Glowing runes appear on the target body.", "bodyRunes"],
    [
      "mystic-armor",
      "You ward yourself with shimmering magical energy.",
      "armorMantle",
    ],
    ["protection", "You ward a creature against harm.", "protectiveWard"],
    [
      "resist-energy",
      "A shield of elemental energy protects a creature.",
      "elementalGuard",
    ],
    ["darkness", "You create a shroud of darkness.", "darkShroud"],
    ["prestidigitation", "The simplest magic does your bidding.", "minorMagic"],
    ["telekinetic-hand", "You create a floating magical hand.", "floatingHand"],
    ["enfeeble", "You sap the target strength.", "strengthSap"],
  ];
  for (const [slug, prose, motif] of examples)
    assert.equal(analyze(slug, prose).motif, motif, slug);
  assert.equal(
    new Set(examples.map(([slug, prose]) => analyze(slug, prose).motif)).size,
    examples.length,
  );
});

test("opening-led automation separates communication, sound and harmless empowerment", () => {
  assert.equal(
    analyze("new-communication", "You send a mental message to your ally.")
      .motif,
    "whisper",
  );
  assert.equal(
    analyze(
      "new-buff",
      "You empower your ally, granting a status bonus to attacks.",
    ).motif,
    "empower",
  );
  assert.equal(
    analyze("new-sound", "You amplify the sounds produced by the target.")
      .motif,
    "soundSculpt",
  );
  assert.equal(
    analyze(
      "incidental",
      "You conjure a stone. On a failure, the target cannot send a message.",
    ).motif,
    "generic",
  );
});

test("encouragement wording never replaces healing, threatening fear, incarnate or musical fiction", () => {
  assert.equal(
    analyze(
      "lifelink-check",
      "You draw on your connection to strengthen your shared life force. Your eidolon gains fast healing.",
      "healing",
      "self",
      ["healing"],
    ).motif,
    "restore",
  );
  assert.equal(
    analyze(
      "fear-check",
      "With a cruel laugh, you warn that death will strengthen another. The target is frightened.",
      "fear",
      "target",
      ["fear"],
    ).motif,
    "dread",
  );
  assert.equal(
    analyze(
      "song-check",
      "You bolster your allies with a hearty song. They gain a status bonus.",
      "mind",
      "emanation",
      ["composition"],
    ).motif,
    "song",
  );
  assert.equal(
    analyze(
      "heat-check",
      "You veil signs of vitality, altering apparent body temperature.",
      "fire",
      "target",
      ["illusion"],
    ).motif,
    "generic",
  );
});
test("buffing a weapon manifests runes without charging its caster into melee", () => {
  const design = analyze(
    "runic-weapon",
    "The weapon glimmers as runes carve down its length.",
  );
  const stages = applySpellDesign(
    { id: "qa", rank: 1, delivery: "target", design },
    [],
    (kind, slot, delay, duration, extra) => ({
      kind,
      slot,
      delay,
      duration,
      ...extra,
    }),
  );
  assert.ok(stages.some((s) => s.label === "Runes inscribe"));
  assert.ok(!stages.some((s) => s.motion === "lunge" || s.motion === "recoil"));
  assert.ok(stages.every((s) => !["travel", "projectile"].includes(s.kind)));
});

test("darkness burst keeps placed-area stages and silence has fading sound rather than an attack", () => {
  const compile = (slug, prose, delivery) =>
    applySpellDesign(
      {
        id: "qa",
        rank: 2,
        delivery,
        design: analyze(slug, prose, "arcane", delivery),
      },
      [],
      (kind, slot, delay, duration, extra) => ({
        kind,
        slot,
        delay,
        duration,
        ...extra,
      }),
    );
  const darkness = compile(
    "darkness",
    "You create a shroud of darkness.",
    "burst",
  );
  assert.ok(darkness.some((s) => s.kind === "template"));
  const silence = compile("silence", "The target makes no sound.", "target");
  assert.ok(silence.some((s) => s.label === "Sound fades"));
  assert.ok(!silence.some((s) => s.kind === "motion" || s.kind === "travel"));
});
