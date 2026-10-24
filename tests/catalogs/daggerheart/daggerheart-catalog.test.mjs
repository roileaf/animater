import test from "node:test";
import assert from "node:assert/strict";
import {
  DAGGERHEART_SOURCE, DH_KINDS, DOMAIN_PALETTES, WEAPON_STYLES, domainPalette, cardDesigns, cardStages, levelScale, weaponStyle, weaponStages,
  dhEntries, dhRecipe, findDhEntry, normalizeDhCatalogState, useDhEntry, dhEntryEnabled, resolveDaggerheartAutomaticRecipe, filterDhEntries,
} from "../../../scripts/catalogs/daggerheart/daggerheart-catalog.mjs";
import { DH_DOMAINS } from "../../../scripts/systems/daggerheart.mjs";
import { validateRecipe, planRecipe, resolveAsset } from "../../../scripts/core/model.mjs";
import { dhSettingKey } from "../../../scripts/catalogs/shared/catalog-system.mjs";
import { assetDatabases } from "../../../tools/asset-databases.mjs";

const context = { source: { id: "caster", center: { x: 100, y: 100 }, w: 100, h: 100 }, targets: [{ id: "target", center: { x: 500, y: 100 }, w: 100, h: 100 }], gridSize: 100, gridDistance: 5 };
const named = (kind, name) => dhEntries(kind).find((e) => e.name === name);
const SLOTS = ["cast", "projectile", "impact", "aura", "circle"];

test("every Daggerheart entry has a valid recipe per variant, tied to its native id", () => {
  assert.deepEqual([...DH_KINDS], ["card", "weapon", "condition"]);
  assert.equal(dhSettingKey("card"), "daggerheartCardCatalog");
  assert.equal(dhEntries("card").length, DAGGERHEART_SOURCE.counts.card);
  assert.equal(dhEntries("weapon").length, DAGGERHEART_SOURCE.counts.weapon + 5 + 17 + 7 + 9, "plus the melee, claw, bite, unarmed and ranged, weapon-family, feature and ability fallbacks");
  assert.equal(dhEntries("condition").length, 7);
  const ids = new Set();
  for (const entry of dhEntries()) {
    assert.equal(entry.systemId, "daggerheart");
    assert.ok(entry.variants.length, entry.name);
    if (entry.uuid) assert.match(entry.uuid, /^Compendium\.daggerheart\.(domains|weapons)\.Item\.[A-Za-z0-9]{16}$/);
    for (const v of entry.variants) {
      const r = dhRecipe(entry, v.id);
      assert.equal(r.systemId, "daggerheart", entry.name);
      assert.equal(r.catalogEntry, entry.id);
      assert.equal(r.itemUuid, entry.uuid ?? "");
      assert.equal(r.description, "");
      assert.ok(!ids.has(r.id), r.id);
      ids.add(r.id);
      validateRecipe(r);
      assert.equal(dhEntries().find((e) => e.variants.some((x) => x.recipe.id === r.id)), entry);
    }
  }
});

test("every domain has a palette with a colour, a motif and five asset slots; unknown domains use Arcana", () => {
  assert.deepEqual(Object.keys(DOMAIN_PALETTES).sort(), [...DH_DOMAINS].sort());
  for (const [domain, p] of Object.entries(DOMAIN_PALETTES)) {
    assert.match(p.color, /^#[0-9a-f]{6}$/i, domain);
    assert.ok(p.motif, domain);
    for (const slot of SLOTS) assert.ok(p[slot]?.length && p[slot].every((k) => k.startsWith("jb2a.")), `${domain}.${slot}`);
  }
  assert.equal(domainPalette("Midnight"), DOMAIN_PALETTES.midnight);
  assert.equal(domainPalette("homebrew"), DOMAIN_PALETTES.arcana);
  assert.equal(domainPalette(undefined), DOMAIN_PALETTES.arcana);
});

test("card design is deterministic: kind by rolls and card type, intensity by level", () => {
  assert.deepEqual(cardDesigns({ cardType: "spell", actions: [{ type: "attack", roll: "spellcast" }] }), { attack: "bolt", use: null });
  assert.deepEqual(cardDesigns({ cardType: "spell", actions: [{ type: "attack", roll: null, target: "self" }, { type: "attack", roll: "spellcast" }] }), { attack: "bolt", use: "aura" });
  assert.deepEqual(cardDesigns({ cardType: "spell", actions: [{ type: "healing", roll: "spellcast" }] }), { attack: "mend", use: null });
  assert.deepEqual(cardDesigns({ cardType: "grimoire", actions: [{ type: "attack", roll: "spellcast" }, { type: "effect", roll: null }] }), { attack: "circle", use: "circle" });
  assert.deepEqual(cardDesigns({ cardType: "ability", actions: [] }), { attack: null, use: "aura" });
  assert.equal(levelScale(1), 1);
  assert.equal(levelScale(10), 1.36);
  assert.equal(levelScale("x"), 1);
  const p = DOMAIN_PALETTES.midnight;
  assert.equal(cardStages("bolt", p, 4).length, 3);
  assert.equal(cardStages("bolt", p, 5).length, 4, "an extra layer from level 5");
  assert.deepEqual(cardStages("aura", p, 7), cardStages("aura", p, 7));
  assert.ok(cardStages("bolt", p, 9)[0].scale > cardStages("bolt", p, 1)[0].scale);
  const blink = named("card", "Blink Out");
  assert.deepEqual(blink.variants.map((v) => v.recipe.trigger), ["attack"]);
  assert.equal(blink.theme, "Arcana");
  assert.equal(dhRecipe(blink).color, DOMAIN_PALETTES.arcana.color);
  assert.ok(dhRecipe(blink).stages.some((s) => s.kind === "motion" && s.motion === "flicker"), "Blink Out plays its design: a teleport blink");
  assert.ok(cardStages("bolt", p, 1).some((s) => s.kind === "travel" && s.assets[0] === p.projectile[0]), "the palette rule for undesigned cards shoots the domain's projectile");
  assert.ok(cardStages("circle", p, 1).some((s) => s.assets[0].startsWith("jb2a.magic_signs.circle.")), "grimoires draw a magic circle");
});

test("weapon families pick the strike, range picks melee or projectile", () => {
  const style = (name, range, damageTypes = ["physical"]) => weaponStyle({ name, range, damageTypes });
  assert.equal(style("Longsword", "melee").family, "blade");
  assert.equal(style("Longsword", "melee").melee, true);
  assert.equal(style("Longsword", "melee").strike[0], "jb2a.sword.melee.01.white");
  assert.equal(style("Dagger", "melee").strike[0], "jb2a.dagger.melee.02.white");
  assert.equal(style("Battleaxe", "melee").strike[0], "jb2a.greataxe.melee.standard.white");
  assert.equal(style("Throwing Knives", "melee").strike[0], "jb2a.dagger.melee.02.white", "range decides: melee knives stab");
  assert.equal(style("Shortbow", "far").strike[0], "jb2a.arrow.physical.white.01");
  assert.equal(style("Hand Crossbow", "far").strike[0], "jb2a.bolt.physical.white");
  assert.deepEqual(style("Runelock Pistol", "far", ["magical"]).muzzle, ["jb2a.muzzle_flash.single.01.yellow"]);
  assert.deepEqual(style("Wand", "far", ["magical"]).strike, ["jb2a.magic_missile.purple"]);
  assert.deepEqual(style("Arc Wand", "far", ["physical"]).strike, ["jb2a.magic_missile.orange", "jb2a.magic_missile.purple"], "in the damage's colour");
  assert.equal(style("Warhammer", "melee").strike[0], "jb2a.hammer.melee.01.white");
  assert.equal(style("Spear", "veryClose").strike[0], "jb2a.spear.melee.01.white");
  assert.equal(style("Javelins", "close").strike[0], "jb2a.javelin.01.throw");
  assert.equal(style("Round Shield", "melee").family, "shield");
  assert.equal(style("Whip", "veryClose").family, null);
  assert.deepEqual(style("Whip", "veryClose").strike, ["jb2a.melee_generic.slashing.one_handed", "jb2a.unarmed_strike.physical.01.blue"]);
  assert.equal(style("Mystery Thing", "far").strike[0], "jb2a.arrow.physical.white.01", "unknown and ranged: an arrow");
  assert.deepEqual(weaponStages({ name: "Longsword", range: "melee", damageTypes: ["physical"] }).map((s) => s.kind), ["travel", "impact"], "the swing reaches from wielder to target");
  assert.deepEqual(weaponStages({ name: "Runelock Pistol", range: "far", damageTypes: ["magical"] }).map((s) => s.kind), ["cast", "travel", "impact"]);
  assert.deepEqual(weaponStages({ name: "Shortbow", range: "far", damageTypes: ["physical"] }).map((s) => s.kind), ["travel", "impact"]);
  assert.deepEqual(Object.keys(WEAPON_STYLES).sort(), ["blade", "bow", "firearm", "generic", "hammer", "magic", "shield", "spear"]);
});

test("conditions: lasting layers for Vulnerable, Hidden and Restrained, a moment for Death move, the Defeated look for the rest", () => {
  const byStatus = Object.fromEntries(dhEntries("condition").map((e) => [e.statusId, e]));
  assert.deepEqual(Object.keys(byStatus).sort(), ["dead", "deathMove", "defeated", "hidden", "restrained", "unconscious", "vulnerable"]);
  for (const id of ["vulnerable", "hidden", "restrained"]) {
    const r = dhRecipe(byStatus[id]);
    assert.equal(r.lifecycle, "document", id);
    assert.ok(r.stages.every((s) => s.kind === "aura" && s.persist), id);
  }
  const death = dhRecipe(byStatus.deathMove);
  assert.equal(death.trigger, "effect");
  assert.equal(death.lifecycle, undefined, "a moment, not a lasting layer");
  for (const id of ["defeated", "unconscious", "dead"]) assert.equal(byStatus[id].state.defeated, true, id);
});

test("events match entries by name, then compendium source; homebrew and adversary attacks fall back by range", () => {
  const sword = named("weapon", "Longsword");
  assert.equal(findDhEntry({ type: "attack", item: { type: "weapon", name: "longsword" } }), sword);
  assert.equal(findDhEntry({ type: "attack", item: { type: "weapon", name: "Grandpa's Blade", _stats: { compendiumSource: sword.uuid } } }), sword);
  assert.equal(findDhEntry({ type: "attack", item: { type: "weapon", name: "Homebrew Lance" }, weaponMode: "melee" }).id, "daggerheart-weapon-generic-spear", "a lance thrusts as a spear");
  assert.equal(findDhEntry({ type: "attack", item: { type: "weapon", name: "Homebrew Thing" }, weaponMode: "melee" }).id, "daggerheart-weapon-generic-melee");
  assert.equal(findDhEntry({ type: "attack", item: null, itemName: "Longbow", rollType: "attack", weaponMode: "ranged" }), named("weapon", "Longbow"));
  assert.equal(findDhEntry({ type: "attack", item: null, itemName: "Claws", rollType: "attack", weaponMode: "melee" }).id, "daggerheart-weapon-generic-claws", "an adversary's claws rake");
  assert.equal(findDhEntry({ type: "attack", item: null, itemName: "Spit", rollType: "attack", weaponMode: "ranged" }).id, "daggerheart-weapon-generic-ranged");
  const blink = named("card", "Blink Out");
  assert.equal(findDhEntry({ type: "attack", item: { type: "domainCard", name: "Blink Out" } }), blink);
  assert.equal(findDhEntry({ type: "use", item: { type: "domainCard", name: "My Card", flags: { core: { sourceId: blink.uuid } } } }), blink);
  assert.equal(findDhEntry({ type: "use", item: { type: "domainCard", name: "My Card" } }), null);
  assert.equal(findDhEntry({ type: "effect", item: { statuses: new Set(["deathMove"]) } }).statusId, "deathMove");
  assert.equal(findDhEntry({ type: "use", item: { type: "armor", name: "Leather" } }), null);
  assert.equal(findDhEntry(null), null);
});

test("resolveDaggerheartAutomaticRecipe: off nothing, on the entry, your recipe by name wins, lasting conditions stay with the layers", () => {
  const blink = named("card", "Blink Out"), event = { type: "attack", systemId: "daggerheart", item: { type: "domainCard", name: "Blink Out" }, rollType: "spellcast" };
  const off = () => normalizeDhCatalogState();
  assert.equal(resolveDaggerheartAutomaticRecipe(event, off, []), null);
  const on = (kind) => (kind === "card" ? useDhEntry({}, blink.id) : normalizeDhCatalogState());
  assert.equal(resolveDaggerheartAutomaticRecipe(event, on, []).catalogEntry, blink.id);
  const mine = validateRecipe({ id: "mine", name: "Mine", trigger: "attack", match: "Blink Out", stages: [{ kind: "cast", assets: ["jb2a.impact.001.orange"] }] });
  const all = () => ({ ...normalizeDhCatalogState(), enabled: true, scope: "all" });
  assert.equal(resolveDaggerheartAutomaticRecipe(event, all, [mine]).id, "mine", "a user recipe by name wins over the catalog");
  assert.equal(resolveDaggerheartAutomaticRecipe(event, all, [{ ...mine, enabled: false }]), null, "a paused user recipe keeps the catalog quiet");
  assert.equal(resolveDaggerheartAutomaticRecipe({ ...event, type: "use" }, on, []), null, "Blink Out has no use variant");
  assert.equal(resolveDaggerheartAutomaticRecipe({ type: "effect", item: { statuses: new Set(["vulnerable"]) } }, all, []), null);
  assert.equal(resolveDaggerheartAutomaticRecipe({ type: "effect", item: { statuses: new Set(["deathMove"]) } }, all, []).trigger, "effect");
  assert.equal(dhEntryEnabled(blink.id, useDhEntry({}, blink.id)), true);
  assert.ok(filterDhEntries("card", { theme: "Midnight" }).every((e) => e.domain === "midnight"));
  assert.equal(filterDhEntries("card", { search: "blink out" })[0], blink);
  assert.ok(filterDhEntries("card", { level: "10" }).every((e) => e.level === 10));
});

test("every palette slot and every catalog recipe plays with JB2A Free and Patreon", async () => {
  const db = await assetDatabases();
  for (const [edition, rows] of Object.entries(db)) {
    for (const [domain, p] of Object.entries(DOMAIN_PALETTES)) for (const slot of SLOTS)
      assert.ok(resolveAsset({ kind: "cast", assets: p[slot] }, rows), `${edition} ${domain}.${slot}`);
    for (const entry of dhEntries()) for (const v of entry.variants)
      assert.ok(planRecipe(dhRecipe(entry, v.id), rows, context).length, `${edition} ${entry.name} ${v.id}`);
  }
});
