import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { cardRow, cardText, weaponRow, conditionIdsFrom, validateRows, renderModule, renderTextModule, plainText, CONDITION_IDS } from "../../../tools/build-daggerheart.mjs";

const longsword = { _id: "Iv8BZM1R24QMT72M", name: "Longsword", type: "weapon", img: "icons/weapons/swords/sword-guard.webp",
  system: { tier: 1, burden: "twoHanded", attack: { range: "melee", roll: { trait: "agility", type: "attack" }, damage: { main: { type: ["physical"] } } } } };
const touched = { _id: "5PvMQKCjrgSxzstn", name: "Arcana-Touched", type: "domainCard", img: "systems/daggerheart/assets/icons/domains/domain-card/arcana.png",
  system: { domain: "arcana", level: 7, type: "ability", recallCost: 2, actions: { hBh4Lt0Bdd9CtJY7: { type: "effect", target: { type: "any" } } } } };
// CONFIG.DH.GENERAL conditions as 2.10.11 writes them (DH:214-252).
const snippet = `const defeatedConditionChoices = {
    deathMove: {
        id: 'deathMove',
        name: 'DAGGERHEART.CONFIG.Condition.deathMove.name'
    },
    defeated: { id: 'defeated', name: 'DAGGERHEART.CONFIG.Condition.defeated.name' },
    unconscious: {\r\n        id: 'unconscious',\r\n        name: 'DAGGERHEART.CONFIG.Condition.unconscious.name'\r\n    },
    dead: { id: 'dead', name: 'DAGGERHEART.CONFIG.Condition.dead.name' }
};
const conditions = () => ({
    vulnerable: { id: 'vulnerable', name: 'DAGGERHEART.CONFIG.Condition.vulnerable.name', img: 'x' },
    hidden: { id: 'hidden', name: 'DAGGERHEART.CONFIG.Condition.hidden.name' },
    restrained: { id: 'restrained', name: 'DAGGERHEART.CONFIG.Condition.restrained.name' }
});`;

test("rows keep only the fields the library needs", () => {
  assert.deepEqual(weaponRow(longsword), { id: "Iv8BZM1R24QMT72M", name: "Longsword", img: "icons/weapons/swords/sword-guard.webp", tier: 1, range: "melee", trait: "agility", damageTypes: ["physical"], burden: "twoHanded" });
  assert.deepEqual(cardRow(touched), { id: "5PvMQKCjrgSxzstn", name: "Arcana-Touched", img: "systems/daggerheart/assets/icons/domains/domain-card/arcana.png", domain: "arcana", level: 7, cardType: "ability", recallCost: 2,
    actions: [{ id: "hBh4Lt0Bdd9CtJY7", type: "effect", roll: null, target: "any" }] });
  assert.deepEqual(cardRow({ _id: "x", name: "Bare", system: {} }).actions, []);
});

const cinder = { _id: "5PvMQKCjrgSxzst2", name: "Cinder Grasp", type: "domainCard", system: { domain: "Arcana", level: 2, type: "spell",
  description: "<p>Make a <strong>Spellcast Roll</strong> against a target within Melee range.&nbsp;It&#39;s <em>On Fire</em>.</p>",
  actions: { a1: { type: "attack", name: "Cast", roll: { type: "spellcast" }, target: { type: "any", amount: 2 }, range: "melee",
    damage: { main: { applyTo: "hitPoints", type: ["magical"], value: { custom: { enabled: false }, multiplier: "flat", flatMultiplier: 1, dice: "d20", bonus: 3 } }, resources: {} },
    effects: [{ _id: "fx1", onSave: false }], areas: [{ name: "Blast", type: "placed", shape: "emanation", size: "close" }] },
    a2: { type: "healing", name: "Hope", roll: { type: null }, target: { type: "self" }, range: "self",
    damage: { main: null, resources: { hope: { applyTo: "hope", value: { custom: { enabled: true, formula: "3" } } } } }, effects: [] } } },
  effects: [{ _id: "fx1", name: "On Fire", statuses: ["burning"] }] };

test("card text: plain description and the actions' rolls, targets, ranges, damage, effects and areas", () => {
  assert.equal(plainText("<p>A <strong>b</strong>&nbsp;c&#39;s &amp; d</p><p>e</p>"), "A b c's & d e");
  assert.deepEqual(cardText(cinder), { id: "5PvMQKCjrgSxzst2", name: "Cinder Grasp", domain: "arcana", level: 2, cardType: "spell",
    description: "Make a Spellcast Roll against a target within Melee range. It's On Fire.",
    actions: [
      { id: "a1", name: "Cast", type: "attack", roll: "spellcast", target: "any", amount: 2, range: "melee",
        parts: [{ applyTo: "hitPoints", types: ["magical"], formula: "1d20+3" }],
        effects: [{ name: "On Fire", statuses: ["burning"] }], areas: [{ shape: "emanation", size: "close", type: "placed" }] },
      { id: "a2", name: "Hope", type: "healing", roll: null, target: "self", amount: null, range: "self", parts: [{ applyTo: "hope", types: [], formula: "3" }], effects: [], areas: [] },
    ] });
});

test("the text module round-trips", async () => {
  const text = renderTextModule({ source: { version: "x" }, texts: [cardText(cinder)] });
  const mod = await import(`data:text/javascript;base64,${Buffer.from(text).toString("base64")}`);
  assert.equal(mod.DAGGERHEART_CARD_TEXT["5PvMQKCjrgSxzst2"].name, "Cinder Grasp");
});

test("the committed card text covers every card", async () => {
  const { DAGGERHEART_CARDS } = await import("../../../data/daggerheart-catalog.mjs");
  const { DAGGERHEART_CARD_TEXT } = await import("../../../data/daggerheart-card-text.mjs");
  assert.deepEqual(Object.keys(DAGGERHEART_CARD_TEXT).sort(), DAGGERHEART_CARDS.map((c) => c.id).sort());
  for (const t of Object.values(DAGGERHEART_CARD_TEXT)) { assert.ok(t.description.length > 20, t.name); assert.doesNotMatch(t.description, /<|&nbsp;/, t.name); }
  assert.match(DAGGERHEART_CARD_TEXT[DAGGERHEART_CARDS.find((c) => c.name === "Blink Out").id].description, /teleport/);
  for (const c of DAGGERHEART_CARDS) assert.deepEqual(c.actions.map((a) => a.id), DAGGERHEART_CARD_TEXT[c.id].actions.map((a) => a.id), `${c.name}: action ids`);
  for (const t of Object.values(DAGGERHEART_CARD_TEXT)) for (const a of t.actions) assert.match(a.id, /^[A-Za-z0-9]{16}$/, `${t.name}: ${a.name} has its action id`);
});

test("condition ids are read from the system bundle, CRLF or LF", () => {
  assert.deepEqual(conditionIdsFrom(snippet).sort(), [...CONDITION_IDS].sort());
  const bundle = fileURLToPath(new URL("../../../../../systems/daggerheart/build/daggerheart.js", import.meta.url));
  if (existsSync(bundle)) for (const id of CONDITION_IDS) assert.ok(conditionIdsFrom(readFileSync(bundle, "utf8")).includes(id), id);
});

test("row validation catches what would break the library", () => {
  assert.deepEqual(validateRows({ cards: [cardRow(touched)], weapons: [weaponRow(longsword)] }), []);
  assert.equal(validateRows({ cards: [{ ...cardRow(touched), level: 0 }], weapons: [] }).length, 1);
  assert.equal(validateRows({ cards: [], weapons: [{ ...weaponRow(longsword), range: "" }] }).length, 1);
  assert.equal(validateRows({ cards: [{ ...cardRow(touched), id: "bad id" }], weapons: [] }).length, 1);
});

test("the rendered module round-trips", async () => {
  const source = { systemId: "daggerheart", version: "2.10.11", reader: "leveldb", counts: { card: 1, weapon: 1 } };
  const text = renderModule({ source, cards: [cardRow(touched)], weapons: [weaponRow(longsword)] });
  const mod = await import(`data:text/javascript;base64,${Buffer.from(text).toString("base64")}`);
  assert.deepEqual(mod.DAGGERHEART_SOURCE, source);
  assert.equal(mod.DAGGERHEART_CARDS[0].name, "Arcana-Touched");
  assert.equal(mod.DAGGERHEART_WEAPONS[0].range, "melee");
});

test("the committed library matches Daggerheart 2.10.12", async () => {
  const { DAGGERHEART_SOURCE, DAGGERHEART_CARDS, DAGGERHEART_WEAPONS } = await import("../../../data/daggerheart-catalog.mjs");
  assert.equal(DAGGERHEART_SOURCE.version, "2.10.12");
  assert.ok(["leveldb", "github"].includes(DAGGERHEART_SOURCE.reader));
  assert.deepEqual(DAGGERHEART_SOURCE.counts, { card: DAGGERHEART_CARDS.length, weapon: DAGGERHEART_WEAPONS.length });
  assert.equal(DAGGERHEART_CARDS.length, 210);
  assert.equal(DAGGERHEART_WEAPONS.length, 324);
  const domains = {};
  for (const c of DAGGERHEART_CARDS) domains[c.domain] = (domains[c.domain] ?? 0) + 1;
  assert.deepEqual(Object.keys(domains).sort(), ["arcana", "blade", "bone", "codex", "dread", "grace", "midnight", "sage", "splendor", "valor"]);
  assert.ok(Object.values(domains).every((n) => n === 21));
  assert.deepEqual(validateRows({ cards: DAGGERHEART_CARDS, weapons: DAGGERHEART_WEAPONS }), []);
  assert.equal(new Set([...DAGGERHEART_CARDS, ...DAGGERHEART_WEAPONS].map((r) => r.id)).size, 534);
  const names = DAGGERHEART_CARDS.map((c) => c.name);
  assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b)));
  assert.deepEqual(DAGGERHEART_CARDS.find((c) => c.name === "Blink Out").actions.map((a) => a.roll), ["spellcast"]);
});
