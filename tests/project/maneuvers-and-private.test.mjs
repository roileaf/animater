import test from "node:test";
import assert from "node:assert/strict";
import { twoeEvent, dnd5eEvent } from "../../scripts/systems/adapters.mjs";
import { PF2E_ACTION_CATALOG } from "../../scripts/catalogs/pf2e/ability-catalog.mjs";
import { findSfEntry } from "../../scripts/catalogs/sf2e/sf2e-catalog.mjs";
import { checkFinisherEvent } from "../../scripts/engines/finishers/finisher-model.mjs";
import { twoeSaveOutcome, dnd5eSaveOutcome, saveReaction } from "../../scripts/systems/outcome.mjs";
import { daggerheartRollEvent, daggerheartDamageEvent, daggerheartUseEvent } from "../../scripts/systems/daggerheart.mjs";
import { weapon, damageRoll, rollMessage, useHook } from "../fixtures/daggerheart-messages.mjs";
import { rollPrivacy, modePrivacy, setHidePrivateResults } from "../../scripts/core/privacy.mjs";
// These tests cover the world setting "Hide the result of private GM rolls" turned on (each test file
// runs in its own process); the default, private rolls showing their result, is in tests/core/private-results.test.mjs.
setHidePrivateResults(true);

const gm = { id: "gm", isGM: true }, player = { id: "p", isGM: false };
const check = (options, over = {}) => ({ id: "m", author: player, isRoll: true, speaker: { token: "t", scene: "s" }, actor: { items: [] },
  flags: { pf2e: { context: { type: "skill-check", outcome: "success", options, target: { token: "Scene.s.Token.goblin" } } } }, ...over });

test("privacy: GM private rolls play, blind and player-private rolls stay hidden", () => {
  assert.equal(rollPrivacy({}), "public");
  assert.equal(rollPrivacy({ whisper: ["gm"], author: gm }), "gm");
  assert.equal(rollPrivacy({ whisper: ["gm"], author: player }), "private");
  assert.equal(rollPrivacy({ whisper: ["gm"], blind: true, author: gm }), "blind");
  assert.equal(modePrivacy("publicroll", false), "public");
  assert.equal(modePrivacy("gmroll", true), "gm");
  assert.equal(modePrivacy("gm", true), "gm");
  assert.equal(modePrivacy("gmroll", false), "private");
  assert.equal(modePrivacy("blindroll", true), "blind");
  assert.equal(modePrivacy("selfroll", true), "private");
});

test("an athletics maneuver's skill check plays its action from the catalog", () => {
  const e = twoeEvent(check(["action:shove", "skill:athletics"]), "p");
  assert.ok(e, "Shove's check is an event");
  assert.equal(e.type, "use");
  assert.equal(e.item.type, "action");
  assert.equal(e.item.name, "Shove");
  assert.equal(e.skillCheck, true, "finishers ride checkFinisherEvent, not this event");
  assert.equal(e.targetUuid, "Scene.s.Token.goblin");
  assert.equal(e.outcome, "success");
  assert.equal(PF2E_ACTION_CATALOG.find(e)?.slug, "shove");
  assert.equal(PF2E_ACTION_CATALOG.find(twoeEvent(check(["action:force-open"]), "p"))?.slug, "force-open");
  assert.equal(twoeEvent(check(["action:force-open"]), "p").item.name, "Force Open");
  // SF2e reads the same action.
  const sf = twoeEvent(check(["action:trip"], { flags: { sf2e: { context: { type: "skill-check", options: ["action:trip"] } } } }), "p", "sf2e");
  assert.equal(sf?.item.name, "Trip");
  if (findSfEntry({ systemId: "sf2e", type: "use", item: { type: "action", name: "Trip", slug: "trip" } })) assert.ok(findSfEntry(sf));
});

test("a customized maneuver plays your version: Demoralize's check has no item uuid, the copy is bound to the entry's", () => {
  const e = twoeEvent(check(["action:demoralize", "skill:intimidation"]), "p");
  const entry = PF2E_ACTION_CATALOG.find(e);
  assert.ok(entry?.uuid);
  const mine = { ...PF2E_ACTION_CATALOG.recipe(entry), name: "My Demoralize", stages: PF2E_ACTION_CATALOG.recipe(entry).stages.filter((s) => s.kind !== "sound") };
  const state = { enabled: true, scope: "all", customized: [entry.id] };
  assert.equal(mine.itemUuid, entry.uuid);
  assert.equal(PF2E_ACTION_CATALOG.resolveAutomaticRecipe(e, state, [mine])?.name, "My Demoralize");
  assert.equal(PF2E_ACTION_CATALOG.resolveAutomaticRecipe(e, state, [{ ...mine, enabled: false }]), null, "paused, your version silences the default too");
});

test("a maneuver uses the actor's own action item when it has one", () => {
  const own = { type: "action", name: "Grapple", slug: "grapple", system: { slug: "grapple" }, uuid: "Actor.a.Item.g" };
  const e = twoeEvent(check(["action:grapple"], { actor: { items: [own] } }), "p");
  assert.equal(e.item, own);
});

test("a skill check that names no action stays out of dispatch", () => {
  assert.equal(twoeEvent(check(["skill:athletics"]), "p"), null);
  assert.equal(twoeEvent(check(["action:shove"], { flags: { pf2e: { context: { type: "flat-check", options: ["action:shove"] } } } }), "p"), null);
});

test("a GM's private maneuver plays without its outcome; a player's private one plays for the player and GM", () => {
  const e = twoeEvent(check(["action:trip"], { author: gm, whisper: ["gm"] }), "gm");
  assert.equal(e.item.name, "Trip");
  assert.equal(e.outcome, undefined);
  assert.equal(e.private, true);
  assert.equal(e.audience, undefined, "a GM's private roll plays for everyone");
  const mine = twoeEvent(check(["action:trip"], { whisper: ["gm"] }), "p");
  assert.equal(mine.item.name, "Trip");
  assert.deepEqual(mine.audience, ["p", "gm"]);
  assert.equal(mine.outcome, "success", "those who see the roll see its result");
  assert.match(twoeEvent(check(["action:trip"], { blind: true, author: gm }), "gm").skipped, /blind roll/);
  assert.equal(twoeEvent(check(["action:trip"], { whisper: ["gm"] }), "someone-else"), null, "other clients stay silent");
});

test("PF2e strikes: player-private rolls play for player and GM, blind rolls are Skipped rows, routine non-events stay silent", () => {
  const strike = (over = {}) => ({ id: "m", author: player, isRoll: true, speaker: {}, actor: {}, item: { type: "weapon", name: "Shortsword", system: {} },
    flags: { pf2e: { context: { type: "attack-roll", outcome: "success", options: [] }, origin: { uuid: "x" } } }, ...over });
  assert.deepEqual(twoeEvent(strike({ whisper: ["gm"] }), "p").audience, ["p", "gm"]);
  assert.deepEqual(twoeEvent(strike({ whisper: ["p"] }), "p").audience, ["p"], "a Self Roll plays for the roller alone");
  assert.match(twoeEvent(strike({ blind: true }), "p").skipped, /blind roll/);
  const flat = strike({ whisper: ["gm"], flags: { pf2e: { context: { type: "flat-check", options: [] } } } });
  assert.equal(twoeEvent(flat, "p"), null, "a private flat check is not worth a row");
});

test("finisher checks follow the GM-private rule", () => {
  const e = checkFinisherEvent(check(["action:shove"], { author: gm, whisper: ["gm"] }), "pf2e", "gm");
  assert.equal(e?.itemName, "shove");
  assert.equal(e.outcome, undefined, "no crit finisher reveals the hidden roll");
  assert.equal(checkFinisherEvent(check(["action:shove"], { whisper: ["gm"] }), "pf2e", "p"), null);
  assert.equal(checkFinisherEvent(check(["action:shove"], { author: gm, whisper: ["gm"], blind: true }), "pf2e", "gm"), null);
});

test("saves: a GM's private save reacts without showing its degree", () => {
  const save = (over = {}) => ({ author: gm, flags: { pf2e: { context: { type: "saving-throw", outcome: "criticalFailure", origin: { actor: "a" } } } }, ...over });
  assert.equal(twoeSaveOutcome(save()), "criticalFailure");
  assert.equal(twoeSaveOutcome(save({ whisper: ["gm"] })), "hidden");
  assert.equal(twoeSaveOutcome(save({ whisper: ["gm"], author: player })), null);
  assert.equal(twoeSaveOutcome(save({ blind: true })), null);
  assert.ok(saveReaction("hidden")?.stages.length, "a neutral reaction");
  const rolls = (mode) => [{ total: 5, options: { target: 12, rollMode: mode } }];
  assert.equal(dnd5eSaveOutcome(rolls("publicroll")), "failure");
  assert.equal(dnd5eSaveOutcome(rolls("gmroll"), { isGM: true }), "hidden");
  assert.equal(dnd5eSaveOutcome(rolls("gmroll"), { isGM: false }), null);
  assert.equal(dnd5eSaveOutcome(rolls("blindroll"), { isGM: true }), null);
});

test("D&D 5e: a GM's private roll animates without its outcome", () => {
  const subject = { id: "act", name: "Attack", item: { type: "weapon", name: "Scimitar" }, getUsageToken: () => null };
  const rolls = (mode) => [{ total: 25, isCritical: true, options: { rollMode: mode }, parent: { id: "m", author: gm, whisper: mode === "gmroll" ? ["gm"] : [] } }];
  const e = dnd5eEvent("attack", subject, { rolls: rolls("gmroll") });
  assert.ok(e && !e.skipped, "monsters in Private GM Roll mode animate");
  assert.equal(e.outcome, "hidden", "plays neutrally: neither a hit nor a miss");
  assert.equal(e.private, true);
  assert.equal(dnd5eEvent("attack", subject, { rolls: rolls("publicroll") }).outcome, "criticalSuccess");
  const mine = [{ total: 25, options: { rollMode: "gmroll" }, parent: { id: "m", author: player, whisper: ["gm"] } }];
  assert.deepEqual(dnd5eEvent("attack", subject, { rolls: mine }).audience, ["p", "gm"], "a player's private roll plays for the player and GM");
  const blind = [{ total: 25, options: { rollMode: "blindroll" }, parent: { id: "m", author: gm, blind: true, whisper: ["gm"] } }];
  assert.match(dnd5eEvent("attack", subject, { rolls: blind }).skipped, /blind roll/);
});

test("Daggerheart: a GM's private roll and damage animate without their outcome", () => {
  const sword = weapon("Longsword"), gmMsg = (over = {}) => ({ ...rollMessage({ item: sword, author: "gm", ...over }), author: gm });
  const pub = daggerheartRollEvent(gmMsg(), "gm");
  assert.equal(pub.type, "attack");
  assert.ok(pub.outcome, "a public roll keeps its outcome");
  const e = daggerheartRollEvent(gmMsg({ whisper: ["gm"] }), "gm");
  assert.equal(e.type, "attack");
  assert.equal(e.outcome, undefined);
  assert.equal(e.targetOutcomes, undefined);
  assert.equal(e.private, true);
  assert.ok(e.targetUuids.length, "it still flies to its target");
  assert.match(daggerheartRollEvent(rollMessage({ item: sword, whisper: ["gm"] }), "u").skipped, /Longsword: a private roll/);
  assert.match(daggerheartRollEvent(gmMsg({ whisper: ["gm"], blind: true }), "gm").skipped, /blind roll/);
  const dmg = daggerheartDamageEvent(gmMsg({ whisper: ["gm"], damage: damageRoll() }), "gm");
  assert.equal(dmg?.type, "damage");
});

test("Daggerheart: a GM's private action still animates", () => {
  const [action, config] = useHook({ item: weapon("Greatsword") });
  assert.equal(daggerheartUseEvent(action, { ...config, selectedMessageMode: "gm" }, { isGM: true })?.type, "use");
  assert.match(daggerheartUseEvent(action, { ...config, selectedMessageMode: "gm" }, { isGM: false })?.skipped ?? "", /private roll/);
  assert.match(daggerheartUseEvent(action, { ...config, selectedMessageMode: "blind" }, { isGM: true })?.skipped ?? "", /blind roll/);
  assert.equal(daggerheartUseEvent(action, config, { isGM: false })?.type, "use");
});
