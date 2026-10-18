import test from "node:test";
import assert from "node:assert/strict";
import { dhEntries, dhEntry, dhRecipe, normalizeDhCatalogState, resolveDaggerheartAutomaticRecipe, weaponStages } from "../../../scripts/catalogs/daggerheart/daggerheart-catalog.mjs";
import { weaponSoundDesign, cardSoundDesign, featureSoundDesign, utilitySoundDesign } from "../../../scripts/catalogs/daggerheart/daggerheart-polish.mjs";
import { ABILITY_SOUND_PROFILES } from "../../../data/ability-sounds.mjs";
import { SOUND_PROFILES } from "../../../data/spell-sounds.mjs";
import { bodyTreatment } from "../../../scripts/engines/motion/condition-body.mjs";

// A sound catalog where every candidate is installed (as installedSoundCatalog gives it).
const sounds = { resolve: (c) => ({ module: c.module, file: c.file ?? `${c.key}.ogg`, duration: c.duration ?? 800, gain: 1 }) };
const named = (kind, name) => dhEntries(kind).find((e) => e.name === name);
const kinds = (recipe) => recipe.stages.map((s) => s.kind);

test("every Daggerheart attack, card, feature and ability variant has a registered sound design", () => {
  for (const entry of dhEntries()) for (const v of entry.variants) {
    if (entry.kind === "condition" && !entry.state?.moment) { assert.equal(v.sound, undefined, entry.name); continue; }
    assert.ok(v.sound?.profile, `${entry.name} ${v.id}`);
    const registry = v.sound.namespace === "ability" ? ABILITY_SOUND_PROFILES : SOUND_PROFILES;
    assert.ok(registry[v.sound.profile], `${entry.name}: ${v.sound.namespace} profile ${v.sound.profile}`);
  }
});

test("weapons sound like their family; magic shots and cards like their element or domain", () => {
  const design = (name) => named("weapon", name).variants[0].sound;
  assert.deepEqual(design("Longsword"), { namespace: "ability", profile: "sword", mode: "melee" });
  assert.equal(design("Longbow").profile, "longbow");
  assert.equal(weaponSoundDesign({ family: "firearm", melee: false }, "Runelock Pistol").profile, "pistol");
  assert.equal(weaponSoundDesign({ family: "magic", melee: false }, "Wand").profile, "force");
  assert.equal(named("weapon", "Any claw attack").variants[0].sound.profile, "claw", "adversary claws");
  assert.equal(named("weapon", "Any bite attack").variants[0].sound.profile, "naturalPierce");
  assert.equal(named("weapon", "Any melee attack").variants[0].sound.profile, "sword");
  assert.equal(cardSoundDesign({ name: "Cinder Grasp", domain: "arcana" }, "bolt").profile, "fire");
  assert.equal(cardSoundDesign({ name: "Untouchable", domain: "midnight" }, "aura").profile, "shadow");
  assert.equal(cardSoundDesign({ name: "Not Good Enough", domain: "blade" }, "aura").profile, "slash");
  assert.equal(cardSoundDesign({ name: "Anything", domain: "splendor" }, "mend").profile, "healing");
  assert.equal(featureSoundDesign("cold", "breath").profile, "coldCone");
  assert.equal(utilitySoundDesign("heal").profile, "healing");
});

test("sounds join the recipe only with an audio pack and the Sounds switch on", () => {
  const sword = named("weapon", "Longsword"), id = sword.variants[0].id;
  assert.ok(!kinds(dhRecipe(sword, id)).includes("sound"));
  const loud = dhRecipe(sword, id, { sounds, soundVolume: 0.5 });
  assert.ok(kinds(loud).includes("sound"), "the strike's contact cue");
  const event = { type: "attack", systemId: "daggerheart", rollType: "attack", item: { type: "weapon", name: "Longsword" }, weaponMode: "melee" };
  const on = (kind) => ({ ...normalizeDhCatalogState(), enabled: true, scope: "all", ...(kind === "weapon" ? {} : {}) });
  assert.ok(kinds(resolveDaggerheartAutomaticRecipe(event, on, [], { sounds })).includes("sound"));
  assert.ok(!kinds(resolveDaggerheartAutomaticRecipe(event, (k) => ({ ...on(k), sound: false }), [], { sounds })).includes("sound"));
  for (const name of ["Whirlwind", "Book of Ava"]) {
    const card = named("card", name);
    assert.ok(card.variants.some((v) => kinds(dhRecipe(card, v.id, { sounds })).includes("sound")), name);
  }
  assert.ok(kinds(dhRecipe(dhEntry("daggerheart-weapon-feature-cold"), "daggerheart-weapon-feature-cold-breath", { sounds })).includes("sound"));
  assert.ok(kinds(dhRecipe(dhEntry("daggerheart-weapon-utility-heal"), "daggerheart-weapon-utility-heal-use", { sounds })).includes("sound"));
});

test("weapon strikes move the token: melee lunges, bows draw, guns kick, struck targets shake", () => {
  const motions = (name) => dhRecipe(named("weapon", name), named("weapon", name).variants[0].id).stages.filter((s) => s.kind === "motion").map((s) => `${s.subject}:${s.motion}`);
  assert.deepEqual(motions("Longsword"), ["source:lunge", "targets:shake"]);
  assert.deepEqual(motions("Longbow"), ["source:brace", "targets:shake"]);
  assert.deepEqual(motions("Any melee attack"), ["source:lunge", "targets:shake"]);
  const sword = dhRecipe(named("weapon", "Longsword"), named("weapon", "Longsword").variants[0].id);
  const lunge = sword.stages.find((s) => s.motion === "lunge"), contact = sword.stages.find((s) => s.stageId === "swing");
  assert.ok(contact.delay > lunge.delay && contact.delay < lunge.delay + lunge.duration, "the blade lands during the lunge");
  assert.ok(!dhRecipe(named("weapon", "Longsword"), named("weapon", "Longsword").variants[0].id, { motion: false }).stages.some((s) => s.kind === "motion"), "Token motion off");
  // The visual stages stay as authored.
  assert.deepEqual(weaponStages({ name: "Longsword", range: "melee", damageTypes: ["physical"] }).map((s) => s.stageId), ["swing", "hit-contact"]);
  for (const id of ["daggerheart-weapon-feature-physical-burst", "daggerheart-weapon-utility-heal-use"])
    assert.ok(dhRecipe(dhEntry(id.replace(/-(burst|use)$/, "")), id).stages.some((s) => s.kind === "motion"), id);
});

test("richer conditions: Vulnerable wobbles, Hidden has a second veil, Death move sounds", () => {
  assert.equal(bodyTreatment("Vulnerable"), "wobble");
  assert.ok(named("condition", "Hidden").variants[0].recipe.stages.length >= 2);
  const death = named("condition", "Death move");
  assert.ok(kinds(dhRecipe(death, death.variants[0].id, { sounds })).includes("sound"));
});

test("fit: swings stretch from wielder to target, natural attacks land on it, bursts stay under the token", async () => {
  const { findDhEntry } = await import("../../../scripts/catalogs/daggerheart/daggerheart-catalog.mjs");
  const swing = (name) => weaponStages({ name, range: "melee", damageTypes: ["physical"] })[0];
  assert.equal(swing("Longsword").kind, "travel", "a blade reaches from the wielder to the target");
  assert.equal(swing("Battleaxe").kind, "travel");
  const melee = (itemName) => findDhEntry({ type: "attack", rollType: "attack", item: null, itemName, weaponMode: "melee" })?.name;
  assert.equal(melee("Bite and Claws"), "Any claw attack");
  assert.equal(melee("Bite"), "Any bite attack");
  assert.equal(melee("Tail Swipe"), "Any unarmed attack");
  assert.equal(melee("Strike"), "Any melee attack");
  assert.equal(findDhEntry({ type: "attack", rollType: "attack", item: null, itemName: "Hurled Stones", weaponMode: "ranged" })?.name, "Any ranged attack");
  for (const [name, kind] of [["Any claw attack", "impact"], ["Any bite attack", "impact"], ["Any unarmed attack", "travel"]])
    assert.equal(dhRecipe(named("weapon", name), named("weapon", name).variants[0].id).stages.find((s) => s.stageId === "swing").kind, kind, name);
  // Physical blows: a crisp star for blades and arrows, a warm burst for blunt weapons; never the fiery flash.
  const hit = (name, range = "melee") => weaponStages({ name, range, damageTypes: ["physical"] }).find((s) => s.stageId.startsWith("hit")).assets[0];
  assert.equal(hit("Longsword"), "jb2a.impact.007.white");
  assert.equal(hit("Longbow", "far"), "jb2a.impact.007.white");
  assert.equal(hit("Warhammer"), "jb2a.impact.010.orange");
  assert.ok(weaponStages({ name: "Runelock Pistol", range: "far", damageTypes: ["physical"] }).find((s) => s.stageId === "flash")?.faceTarget, "the muzzle flash faces the target");
  const burst = dhRecipe(dhEntry("daggerheart-weapon-feature-fire"), "daggerheart-weapon-feature-fire-burst").stages.find((s) => s.stageId === "burst");
  assert.equal(burst.below, true);
  assert.equal(burst.assets[0], "jb2a.fire_ring.500px.red");
});

test("card designs: melee and unarmed clips aimed at targets stretch from the caster; no on-token layer is a speck", () => {
  const card = (name) => { const e = named("card", name); return dhRecipe(e, e.variants[0].id); };
  const choke = card("Chokehold").stages.find((s) => s.assets?.[0]?.startsWith("jb2a.unarmed_strike."));
  assert.equal(choke.kind, "travel");
  for (const entry of dhEntries("card")) for (const v of entry.variants)
    for (const s of dhRecipe(entry, v.id).stages) if (["cast", "impact", "aura"].includes(s.kind)) assert.ok(s.scale >= 1, `${entry.name} ${s.stageId} ${s.scale}`);
});
