import test from "node:test";
import assert from "node:assert/strict";
import { DESIGN_SHAPES, validateCardDesign, designStages, stageSignature } from "../../../scripts/catalogs/daggerheart/daggerheart-card-design.mjs";
import { DOMAIN_DESIGNS, CARD_DESIGNS } from "../../../data/daggerheart-card-designs/index.mjs";
import { DAGGERHEART_CARD_TEXT } from "../../../data/daggerheart-card-text.mjs";
import { DAGGERHEART_CARDS } from "../../../data/daggerheart-catalog.mjs";
import { DOMAIN_PALETTES, cardDesigns, cardStages, levelScale, dhEntries, dhRecipe, normalizeDhCatalogState, resolveDaggerheartAutomaticRecipe } from "../../../scripts/catalogs/daggerheart/daggerheart-catalog.mjs";
import { DH_DOMAINS, DH_ROLL_TYPES } from "../../../scripts/systems/daggerheart.mjs";
import { planRecipe, resolveAsset } from "../../../scripts/core/model.mjs";
import { assetDatabases } from "../../../tools/asset-databases.mjs";

const context = { source: { id: "caster", center: { x: 100, y: 100 }, w: 100, h: 100 }, targets: [{ id: "target", center: { x: 500, y: 100 }, w: 100, h: 100 }], gridSize: 100, gridDistance: 5 };
const cardEntry = (card) => dhEntries("card").find((e) => e.id === `daggerheart-card-${card.id}`);
const designed = Object.entries(DOMAIN_DESIGNS).filter(([, designs]) => Object.keys(designs).length);
const jb2a = (key) => (key.startsWith("jb2a.") ? key : `jb2a.${key}`);
const layers = (record) => [record.cast, record.travel, record.impact, record.aura, ...(record.extra ?? [])].filter((l) => l && l !== true)
  .map((l) => (Array.isArray(l) ? l : l.assets));
const allKeys = (record) => [...layers(record), ...(record.use ? layers(record.use) : []), ...Object.values(record.actions ?? {}).flatMap(layers)].flat();
// The trigger an action plays on: its roll message ("attack") for a spellcast or attack roll, its use otherwise.
const triggerOf = (action) => (DH_ROLL_TYPES.has(action.roll) ? "attack" : "use");
const everything = () => ({ ...normalizeDhCatalogState(), enabled: true, scope: "all" });
// What plays when this action of this card fires, as the runtime resolves it.
const played = (card, action) => resolveDaggerheartAutomaticRecipe({ type: triggerOf(action), systemId: "daggerheart", item: { type: "domainCard", name: card.name }, actionId: action.id }, everything, []);
const sample = { shape: "bolt", motif: "violet dart", notes: 'The card says "a dart of force".', travel: ["magic_missile.purple"], impact: { assets: ["impact.005.purple"], scale: 1.2 },
  motion: { motion: "stagger", subject: "targets" } };

test("the design schema accepts a compact record and names what is wrong with a bad one", () => {
  assert.deepEqual(validateCardDesign(sample), []);
  assert.deepEqual(validateCardDesign({ ...sample, use: { shape: "aura", motif: "glow", aura: ["energy_strands.overlay.purple"] } }), []);
  assert.ok(Object.keys(DESIGN_SHAPES).includes("teleport"));
  const bad = (patch) => validateCardDesign({ ...sample, ...patch });
  assert.match(bad({ shape: "laser" }).join(), /shape/);
  assert.match(bad({ notes: "no quote" }).join(), /quote/);
  assert.match(bad({ travel: [] }).join(), /1–8 assets/);
  assert.match(bad({ travel: ["not a key!"] }).join(), /asset/);
  assert.match(bad({ motion: { motion: "moonwalk", subject: "source" } }).join(), /moonwalk/);
  assert.match(bad({ tint: "purple" }).join(), /tint/);
  assert.match(bad({ colour: "#ffffff" }).join(), /unknown field colour/);
  assert.match(bad({ impact: { assets: ["impact.005.purple"], size: 3 } }).join(), /unknown option size/);
  assert.match(bad({ extra: [{ role: "flare", assets: ["impact.005.purple"] }] }).join(), /role/);
  assert.match(bad({ use: { ...sample, use: sample } }).join(), /use: unknown field use/);
  assert.match(validateCardDesign({ shape: "aura", motif: "x", notes: 'Says "nothing at all".', cast: false }).join(), /no visual layer/);
});

test("a record may carry per-action designs keyed by the action's id; each quotes the card and nests nothing", () => {
  const spell = { shape: "debuff", motif: "sleep", notes: 'Says "falls asleep".', impact: ["sleep.cloud.01.blue"] };
  assert.deepEqual(validateCardDesign({ ...sample, actions: { GI2VkIcGDOjFRxpT: spell } }), []);
  const bad = (actions) => validateCardDesign({ ...sample, actions }).join();
  assert.match(bad({ "not an id": spell }), /actions: key/);
  assert.match(bad({ GI2VkIcGDOjFRxpT: { ...spell, notes: "no quote" } }), /GI2VkIcGDOjFRxpT: notes must quote/);
  assert.match(bad({ GI2VkIcGDOjFRxpT: { ...spell, use: spell } }), /unknown field use/);
  assert.match(bad({ GI2VkIcGDOjFRxpT: { ...spell, actions: {} } }), /unknown field actions/);
  assert.match(bad([spell]), /actions must map/);
  assert.match(validateCardDesign({ ...sample, use: { ...spell, actions: {} } }).join(), /use: unknown field actions/);
});

test("an action plays its own design, then the card's rolled or use design; the library's Use plays the card's design", () => {
  const norai = DAGGERHEART_CARDS.find((c) => c.name === "Book of Norai"), record = CARD_DESIGNS[norai.id], text = DAGGERHEART_CARD_TEXT[norai.id];
  const fireball = text.actions.find((a) => a.name === "Fireball - Cast"), tether = text.actions.find((a) => a.name === "Mystic Tether");
  const options = { palette: DOMAIN_PALETTES.codex, level: norai.level, levelScale };
  assert.ok(record.actions?.[fireball.id], "Fireball's roll has its own design");
  assert.equal(stageSignature(played(norai, fireball).stages), stageSignature(designStages(record.actions[fireball.id], options)));
  assert.equal(stageSignature(played(norai, tether).stages), stageSignature(designStages(record.actions[tether.id] ?? record, options)));
  assert.notEqual(stageSignature(played(norai, fireball).stages), stageSignature(played(norai, tether).stages), "Fireball no longer plays the tether");
  assert.equal(stageSignature(played(norai, { id: "unknownAction000", roll: "spellcast" }).stages), stageSignature(designStages(record, options)), "an unknown action plays the rolled design");
  const entry = cardEntry(norai);
  assert.equal(stageSignature(dhRecipe(entry, `${entry.id}-attack`).stages), stageSignature(designStages(record, options)), "the library's Use and preview play the card's design");
  const plain = DAGGERHEART_CARDS.find((c) => !CARD_DESIGNS[c.id] && c.actions.length);
  if (plain) assert.deepEqual(played(plain, plain.actions[0]).stages.map((s) => s.assets),
    cardStages(cardDesigns(plain)[triggerOf(plain.actions[0])], DOMAIN_PALETTES[plain.domain], plain.level).map((s) => s.assets), "no record: the palette fallback");
});

test("a record becomes timed stages: cast, flight, contact, linger, then motion, scaled by level", () => {
  const palette = DOMAIN_PALETTES.arcana;
  const stages = designStages(sample, { palette, level: 1, levelScale });
  assert.deepEqual(stages.map((s) => s.kind), ["cast", "travel", "impact", "motion"]);
  assert.deepEqual(stages[0].assets, palette.cast, "the palette cast when the record leaves it out");
  assert.equal(stages[1].assets[0], "jb2a.magic_missile.purple", "short keys gain the jb2a prefix");
  assert.ok(stages[2].delay > stages[1].delay);
  assert.equal(stages[2].optionalTargets, undefined, "a bolt needs its target");
  assert.ok(designStages(sample, { palette, level: 10, levelScale })[2].scale > stages[2].scale);
  const self = designStages({ shape: "ward", motif: "m", notes: '"x y z"', cast: false, impact: ["shield.01.complete.purple"], aura: { assets: ["energy_strands.overlay.purple"], on: "targets" } }, { palette });
  assert.deepEqual(self.map((s) => [s.kind, s.subject ?? null, s.optionalTargets ?? false]), [["cast", null, false], ["aura", "targets", true]], "self shapes land on the caster; target layers become optional");
  assert.deepEqual(designStages({ ...sample, tint: "#a070ff" }, { palette })[1].tint, "#a070ff");
  assert.equal(stageSignature(stages), stageSignature(designStages(sample, { palette, level: 7, levelScale })), "level never changes what is shown");
  const ghosts = designStages({ ...sample, copies: { count: 3 } }, { palette }).find((s) => s.kind === "sprite");
  assert.deepEqual([ghosts.copies, ghosts.subject], [3, "source"], "afterimages are copies of the caster");
  assert.match(validateCardDesign({ ...sample, copies: { count: 9 } }).join(), /count/);
});

test("cards without a record keep the domain palette rules", () => {
  let fallbacks = 0;
  for (const card of DAGGERHEART_CARDS) {
    if (CARD_DESIGNS[card.id]) continue;
    fallbacks++;
    const entry = cardEntry(card);
    assert.equal(entry.quality, "themed", card.name);
    for (const [trigger, design] of Object.entries(cardDesigns(card)).filter(([, d]) => d))
      assert.deepEqual(entry.variants.find((v) => v.recipe.trigger === trigger).recipe.stages.map((s) => s.assets),
        cardStages(design, DOMAIN_PALETTES[card.domain], card.level).map((s) => s.assets), card.name);
  }
  assert.equal(fallbacks + Object.keys(CARD_DESIGNS).length, DAGGERHEART_CARDS.length);
});

test("every domain has a design file; Arcana is designed", () => {
  assert.deepEqual(Object.keys(DOMAIN_DESIGNS).sort(), [...DH_DOMAINS].sort());
  const arcana = DAGGERHEART_CARDS.filter((c) => c.domain === "arcana");
  assert.equal(arcana.length, 21);
  for (const card of arcana) assert.ok(DOMAIN_DESIGNS.arcana[card.id], `Arcana card without a design: ${card.name}`);
});

for (const [domain, designs] of designed) {
  const cards = DAGGERHEART_CARDS.filter((c) => c.domain === domain);
  test(`${domain}: every card has a valid record designed from its text, played by its catalog entry`, () => {
    assert.deepEqual(Object.keys(designs).sort(), cards.map((c) => c.id).sort(), "records are keyed by this domain's card ids, one per card");
    for (const card of cards) {
      const record = designs[card.id], text = DAGGERHEART_CARD_TEXT[card.id];
      assert.deepEqual(validateCardDesign(record), [], card.name);
      const quoted = [...record.notes.matchAll(/["“]([^"”]+)["”]/g)].map((m) => m[1].toLowerCase());
      assert.ok(quoted.some((q) => text.description.toLowerCase().includes(q)), `${card.name}: notes quote the card's own words`);
      const entry = cardEntry(card), triggers = Object.entries(cardDesigns(card)).filter(([, d]) => d).map(([t]) => t);
      assert.equal(entry.quality, "signature", card.name);
      assert.equal(Boolean(record.use), triggers.length === 2, `${card.name}: a \`use\` design exactly when the card has a second (use) variant`);
      for (const v of entry.variants) {
        const r = dhRecipe(entry, v.id), part = v.recipe.trigger === "use" && record.use ? record.use : record;
        // A teleporting card (Blink Out) adds its Teleport stage (catalog-teleport.mjs).
        assert.equal(stageSignature(r.stages.filter((s) => s.kind !== "teleport")), stageSignature(designStages(part, { palette: DOMAIN_PALETTES[domain], level: card.level, levelScale })), `${card.name} ${v.id}`);
      }
      for (const [id, design] of Object.entries(record.actions ?? {})) {
        const action = text.actions.find((a) => a.id === id);
        assert.ok(action, `${card.name}: per-action design ${id} names one of its actions`);
        const quotedHere = [...design.notes.matchAll(/["“]([^"”]+)["”]/g)].map((m) => m[1].toLowerCase());
        assert.ok(quotedHere.some((q) => text.description.toLowerCase().includes(q)), `${card.name} ${action.name}: notes quote the card's own words`);
        assert.equal(stageSignature(played(card, action).stages), stageSignature(designStages(design, { palette: DOMAIN_PALETTES[domain], level: card.level, levelScale })), `${card.name} ${action.name} plays its own design`);
      }
    }
  });

  test(`${domain}: per-action designs are pairwise distinct within each card, and from the card's own designs`, () => {
    for (const card of cards) {
      const record = designs[card.id];
      if (!record.actions) continue;
      const seen = new Map(cardEntry(card).variants.map((v) => [stageSignature(v.recipe.stages), `${v.recipe.trigger} design`]));
      for (const [id, design] of Object.entries(record.actions)) {
        const sig = stageSignature(designStages(design, { palette: DOMAIN_PALETTES[domain], level: card.level, levelScale })), name = DAGGERHEART_CARD_TEXT[card.id].actions.find((a) => a.id === id)?.name ?? id;
        assert.ok(!seen.has(sig), `${card.name}: ${name} looks the same as its ${seen.get(sig)}`);
        seen.set(sig, name);
      }
    }
  });

  test(`${domain}: every asset resolves in Patreon and every recipe plays in Free and Patreon`, async () => {
    const db = await assetDatabases();
    for (const card of cards) {
      for (const key of allKeys(designs[card.id])) assert.ok(resolveAsset({ kind: "cast", assets: [jb2a(key)] }, db.patreon), `${card.name}: ${key} in Patreon`);
      const entry = cardEntry(card);
      for (const v of entry.variants) for (const [edition, rows] of Object.entries(db))
        assert.ok(planRecipe(dhRecipe(entry, v.id), rows, context).length, `${edition} ${card.name} ${v.id}`);
      for (const action of DAGGERHEART_CARD_TEXT[card.id].actions.filter((a) => designs[card.id].actions?.[a.id])) for (const [edition, rows] of Object.entries(db))
        assert.ok(planRecipe(played(card, action), rows, context).length, `${edition} ${card.name} ${action.name}`);
    }
  });

  test(`${domain}: recipes are pairwise distinct unless a record names its twin with sameAs`, () => {
    const seen = new Map();
    for (const card of cards) {
      const record = designs[card.id];
      if (record.sameAs) assert.ok(cards.some((c) => c.id === record.sameAs), `${card.name}: sameAs names a ${domain} card`);
      for (const v of cardEntry(card).variants) {
        const sig = stageSignature(v.recipe.stages), twin = seen.get(sig);
        if (twin) assert.ok(record.sameAs === twin.id || designs[twin.id].sameAs === card.id, `${card.name} (${v.recipe.trigger}) looks the same as ${twin.name}`);
        seen.set(sig, card);
      }
      for (const [id, design] of Object.entries(record.actions ?? {})) {
        const sig = stageSignature(designStages(design, { palette: DOMAIN_PALETTES[domain], level: card.level, levelScale })), twin = seen.get(sig);
        if (twin && twin !== card) assert.ok(record.sameAs === twin.id || designs[twin.id].sameAs === card.id, `${card.name} (action ${id}) looks the same as ${twin.name}`);
        seen.set(sig, card);
      }
    }
  });
}

test("codex: every spell in a Book card plays its own design, built from that spell", () => {
  const books = DAGGERHEART_CARDS.filter((c) => c.domain === "codex" && /^Book of /.test(c.name));
  assert.equal(books.length, 13);
  for (const book of books) {
    const seen = new Map();
    for (const action of DAGGERHEART_CARD_TEXT[book.id].actions) {
      const sig = stageSignature(played(book, action).stages);
      assert.ok(!seen.has(sig), `${book.name}: ${action.name} plays the same animation as ${seen.get(sig)}`);
      seen.set(sig, action.name);
    }
  }
  const assetsOf = (book, spell) => {
    const card = DAGGERHEART_CARDS.find((c) => c.name === book), action = DAGGERHEART_CARD_TEXT[card.id].actions.find((a) => a.name === spell);
    return played(card, action).stages.flatMap((s) => s.assets ?? []).join(" ");
  };
  assert.match(assetsOf("Book of Norai", "Fireball - Cast"), /fireball/, "Fireball is a fireball");
  assert.match(assetsOf("Book of Norai", "Fireball - Explosion"), /explosion/, "the explosion explodes");
  assert.doesNotMatch(assetsOf("Book of Illiat", "Telepathy"), /magic_missile/, "Telepathy is not Arcane Barrage");
  assert.match(assetsOf("Book of Illiat", "Arcane Barrage"), /magic_missile/);
  assert.match(assetsOf("Book of Ava", "Ice Spike"), /ice/);
  assert.match(assetsOf("Book of Tyfar", "Mysterious Mist"), /fog|cloud|mist/);
  assert.match(assetsOf("Book of Grynn", "Wall Of Flame"), /wall_of_fire/);
  assert.match(assetsOf("Book of Vagras", "Arcane Door"), /portal/);
});
