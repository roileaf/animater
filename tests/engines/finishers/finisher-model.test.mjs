import test from "node:test";
import assert from "node:assert/strict";
import { validateRecipe, normalizeFinisher } from "../../../scripts/core/model.mjs";
import { matchFinishers, killFinisher, passesSuccess, usePasses, finisherMoment, checkFinisherEvent, linkFinisher, linkedFinisher, mayDisplace, finisherTravelPath, finisherChipText, addFinisherName, removeFinisherName, linkFinisherItem, unlinkFinisherItem, finisherItemLink, finisherAvailableTo, playerFinisherChoices, pickedFinisher, finisherFires, pickPlays, createFinishedMemory, critFinishers, finishedKey, finishedMessage, critTargets, saveFinisherEvent } from "../../../scripts/engines/finishers/finisher-model.mjs";

const fin = (id, match, finisher = {}, extra = {}) => ({ id, name: id, trigger: "manual", match, finisher: normalizeFinisher(finisher), stages: [{ kind: "motion", motion: "shake", assets: [] }], ...extra });

test("the finisher block is normalized, kept, and makes the recipe a manual Finisher", () => {
  assert.deepEqual(normalizeFinisher({}), { on: "kill", knockback: 0, ending: "body", success: "success", wall: "fit", players: [] });
  assert.deepEqual(normalizeFinisher({ on: "use", knockback: 9, ending: "vanish", success: "critical", wall: "slam" }), { on: "use", knockback: 6, ending: "vanish", success: "critical", wall: "slam", players: [] });
  assert.equal(normalizeFinisher({ wall: "bounce" }).wall, "fit", "an unknown wall mode stops short");
  assert.equal(Object.hasOwn(normalizeFinisher({ mover: "source" }), "mover"), false, "an old saved mover: \"source\" loads as moving the targets");
  const r = validateRecipe({ id: "f", name: "F", trigger: "attack", category: "Custom", finisher: { on: "use" }, stages: [{ kind: "motion", motion: "shake", assets: [] }] });
  assert.equal(r.trigger, "manual", "normal dispatch never matches a finisher");
  assert.equal(r.category, "Finisher");
  assert.equal(r.finisher.on, "use");
  assert.equal(validateRecipe({ id: "n", name: "N", trigger: "manual", stages: [{ kind: "motion", motion: "shake", assets: [] }] }).finisher, undefined);
});

test("finishers match their items by name, slug or exact item, and by trigger", () => {
  const list = [fin("a", "Shove, Whirlwind Toss", { on: "use" }), fin("b", "greataxe"), fin("c", "", {}, { itemUuid: "Actor.x.Item.y" }), fin("d", "Shove", { on: "use" }, { enabled: false })];
  assert.deepEqual(matchFinishers(list, { itemName: "Shove" }, "use").map((r) => r.id), ["a"]);
  assert.deepEqual(matchFinishers(list, { itemSlug: "whirlwind-toss" }, "use").map((r) => r.id), ["a"]);
  assert.deepEqual(matchFinishers(list, { itemName: "Greataxe" }, "kill").map((r) => r.id), ["b"]);
  assert.deepEqual(matchFinishers(list, { itemUuid: "Actor.x.Item.y" }, "kill").map((r) => r.id), ["c"]);
  assert.deepEqual(matchFinishers(list, { itemName: "Greataxe" }, "use"), []);
  assert.deepEqual(matchFinishers([fin("x", "Shove", { on: "use" }), fin("y", "shove", { on: "use" })], { itemName: "Shove" }, "use").map((r) => r.id), ["x", "y"], "use plays every match");
});

test("a kill picks the killing item's first kill finisher, else the default, else none", () => {
  const list = [fin("a", "Greataxe"), fin("b", "Greataxe"), fin("def", "")];
  assert.equal(killFinisher(list, { itemName: "Greataxe" }, "def").id, "a");
  assert.equal(killFinisher(list, { itemName: "Dagger" }, "def").id, "def");
  assert.equal(killFinisher(list, { itemName: "Dagger" }, ""), null);
  assert.equal(killFinisher(list, {}, "missing"), null);
  assert.equal(killFinisher(list, { itemName: "Greataxe" }, "def", { crit: true }).id, "a");
  assert.equal(killFinisher([{ id: "plain", name: "P", match: "Dagger", stages: [] }], { itemName: "Dagger" }, "plain"), null, "a non-finisher is never a default");
});

test("a critical-only kill finisher plays only on a crit; the default obeys the same rule", () => {
  const list = [fin("crit", "Greataxe", { success: "critical" }), fin("def", "", { success: "critical" }), fin("plain", "")];
  assert.equal(killFinisher(list, { itemName: "Greataxe" }, "def", { crit: true }).id, "crit");
  assert.equal(killFinisher(list, { itemName: "Greataxe" }, "def", { crit: false }), null, "no crit: neither the item's nor the default plays");
  assert.equal(killFinisher(list, { itemName: "Greataxe" }, "def"), null, "unknown crit is not a crit");
  assert.equal(killFinisher(list, { itemName: "Greataxe" }, "plain").id, "plain", "falls through to a default that needs no crit");
  assert.equal(killFinisher([fin("both", "Greataxe", { success: "critical" }), fin("any", "Greataxe")], { itemName: "Greataxe" }, "").id, "any");
});

test("a kill also plays the item's crit-or-kill finishers, in catalog order, before the default", () => {
  const list = [fin("crit", "Greataxe", { on: "critical" }), fin("either", "Greataxe", { on: "criticalOrKill" }), fin("k", "Greataxe"), fin("def", "")];
  assert.equal(killFinisher(list, { itemName: "Greataxe" }, "def").id, "either", "the first of the item's kill or crit-or-kill finishers");
  assert.equal(killFinisher(list.filter((r) => r.id !== "either"), { itemName: "Greataxe" }, "def").id, "k", "a critical-only finisher is not a kill finisher");
  assert.equal(killFinisher(list, { itemName: "Dagger" }, "def").id, "def", "the default fallback is unchanged");
  assert.equal(killFinisher([fin("either", "Greataxe", { on: "criticalOrKill", success: "critical" })], { itemName: "Greataxe" }, "", { crit: false })?.id, "either", "Needs is hidden for crit-or-kill, so a stored critical-only does not gate it");
});

test("a crit plays the item's critical and crit-or-kill finishers", () => {
  const list = [fin("k", "Greataxe"), fin("u", "Greataxe", { on: "use" }), fin("crit", "Greataxe", { on: "critical" }), fin("either", "", { on: "criticalOrKill" }, { itemUuid: "Actor.x.Item.y" }), fin("off", "Greataxe", { on: "critical" }, { enabled: false })];
  assert.deepEqual(critFinishers(list, { itemName: "Greataxe", itemUuid: "Actor.x.Item.y" }).map((r) => r.id), ["crit", "either"]);
  assert.deepEqual(critFinishers(list, { itemName: "Dagger" }), []);
  assert.deepEqual(critFinishers(list, {}), []);
});

test("a use finisher on a roll needs a known outcome; a plain use needs none", () => {
  const plain = normalizeFinisher({ on: "use" });
  assert.equal(usePasses(plain, { type: "attack", outcome: null }), false, "D&D with several targets or hidden AC");
  assert.equal(usePasses(plain, { type: "check" }), false);
  assert.equal(usePasses(plain, { type: "attack", outcome: "success" }), true);
  assert.equal(usePasses(plain, { type: "attack", outcome: "failure" }), false);
  assert.equal(usePasses(plain, { type: "use", item: { type: "spell" } }), true);
  assert.equal(usePasses(plain, { type: "damage" }), false);
});

test("success rule: success or critical by default, critical only when chosen, no roll always passes", () => {
  const plain = normalizeFinisher({}), crit = normalizeFinisher({ success: "critical" });
  assert.equal(passesSuccess(plain, "success"), true);
  assert.equal(passesSuccess(plain, "criticalSuccess"), true);
  assert.equal(passesSuccess(plain, "failure"), false);
  assert.equal(passesSuccess(crit, "success"), false);
  assert.equal(passesSuccess(crit, "criticalSuccess"), true);
  assert.equal(passesSuccess(plain, undefined), true);
});

test("a use finisher rides the roll when there is one, else the use", () => {
  assert.equal(finisherMoment({ type: "attack" }), "roll");
  assert.equal(finisherMoment({ type: "check" }), "roll");
  assert.equal(finisherMoment({ type: "damage" }), null);
  assert.equal(finisherMoment({ type: "use", item: { type: "spell", system: { traits: { value: [] } } } }), "use");
  assert.equal(finisherMoment({ type: "use", item: { type: "weapon" } }), null, "a Strike's roll carries it");
  assert.equal(finisherMoment({ type: "use", item: { type: "action", system: { traits: { value: ["attack"] } } } }), null, "Shove's check carries it");
  assert.equal(finisherMoment({ type: "use", item: { type: "spell" }, activity: { type: "attack" } }), null);
});

test("a PF2e Shove check becomes a finisher event with its outcome and target", () => {
  const message = (author, options) => ({ id: "m1", author: { id: author }, speaker: { token: "t", scene: "s" }, flags: { pf2e: { context: { type: "skill-check", outcome: "criticalSuccess", options, target: { token: "Scene.s.Token.x" } } } } });
  const e = checkFinisherEvent(message("u", ["action:shove", "self:x"]), "pf2e", "u");
  assert.deepEqual(e, { type: "check", systemId: "pf2e", id: "finisher-check:m1", messageId: "m1", itemName: "shove", tokenId: "t", sceneId: "s", targetUuid: "Scene.s.Token.x", outcome: "criticalSuccess" });
  assert.equal(checkFinisherEvent(message("other", ["action:shove"]), "pf2e", "u"), null, "only the roller's client");
  assert.equal(checkFinisherEvent(message("u", ["self:x"]), "pf2e", "u"), null, "a check that names no action");
  assert.equal(checkFinisherEvent({ ...message("u", ["action:shove"]), blind: true }, "pf2e", "u"), null, "blind");
  assert.equal(checkFinisherEvent({ ...message("u", ["action:shove"]), whisper: ["gm"] }, "pf2e", "u"), null, "whispered");
  assert.notEqual(checkFinisherEvent({ ...message("u", ["action:shove"]), whisper: [] }, "pf2e", "u"), null, "an empty whisper list is public");
  const reroll = message("u", ["action:shove"]); reroll.flags.pf2e.context.isReroll = true;
  assert.equal(checkFinisherEvent(reroll, "pf2e", "u"), null, "reroll");
});

// PF2e/SF2e saving-throw messages (checked against the PF2e system's Check.roll): flags.pf2e.context
// has type "saving-throw", the saver's own outcome, origin { actor, token } (the caster's uuids) and
// target { actor, token } (the saver); flags.pf2e.origin is the spell's getOriginData() ({ actor, uuid, type }).
const saveMessage = (outcome, extra = {}) => ({ id: "sv1", author: { id: "u" }, speaker: { scene: "s", token: "orc" },
  flags: { pf2e: { context: { type: "saving-throw", outcome, origin: { actor: "Actor.wiz", token: "Scene.s.Token.wizard" }, target: { actor: "Actor.orc", token: "Scene.s.Token.orc" }, ...extra }, origin: { actor: "Actor.wiz", uuid: "Actor.wiz.Item.fireball", type: "spell" } } } });

test("a saving throw against a spell is a finisher event: the saver is the target, the caster the source", () => {
  assert.deepEqual(saveFinisherEvent(saveMessage("criticalFailure"), "pf2e", "u"), { type: "save", systemId: "pf2e", id: "finisher-save:sv1", messageId: "sv1", itemUuid: "Actor.wiz.Item.fireball", tokenId: "wizard", sceneId: "s", targetUuid: "Scene.s.Token.orc", outcome: "criticalFailure" });
  assert.equal(saveFinisherEvent(saveMessage("criticalFailure"), "pf2e", "other"), null, "only the roller's client");
  assert.equal(saveFinisherEvent({ ...saveMessage("criticalFailure"), whisper: ["gm"] }, "pf2e", "u"), null, "a hidden save stays quiet");
  assert.equal(saveFinisherEvent(saveMessage("criticalFailure", { isReroll: true }), "pf2e", "u"), null, "reroll");
  assert.equal(saveFinisherEvent(saveMessage("criticalFailure", { type: "skill-check" }), "pf2e", "u"), null, "not a save");
  const plain = saveMessage("criticalFailure"); delete plain.flags.pf2e.origin;
  assert.equal(saveFinisherEvent(plain, "pf2e", "u"), null, "a save against no item has nothing to play");
  const lost = saveFinisherEvent(saveMessage("criticalFailure", { origin: { actor: "Actor.wiz" } }), "pf2e", "u");
  assert.equal(lost.tokenId, undefined, "a caster without a token: no attacker token (the item's actor may stand in)");
  const self = saveFinisherEvent(saveMessage("criticalFailure", { origin: { actor: "Actor.orc", token: "Scene.s.Token.orc" } }), "pf2e", "u");
  assert.equal(self.tokenId, undefined, "the saver is never its own attacker");
  assert.equal(self.noSource, true, "a save against itself has no attacker at all (not the item actor's token)");
  assert.equal(lost.noSource, undefined, "a caster without a token may still be stood in for");
  const speakerOnly = saveMessage("criticalFailure"); delete speakerOnly.flags.pf2e.context.target;
  assert.equal(saveFinisherEvent(speakerOnly, "pf2e", "u").targetUuid, "Scene.s.Token.orc", "the speaker's token is the saver");
  assert.equal(saveFinisherEvent({ ...saveMessage("criticalFailure"), flags: { sf2e: saveMessage("criticalFailure").flags.pf2e } }, "sf2e", "u").systemId, "sf2e");
  for (const outcome of ["criticalSuccess", "success", "failure", undefined]) assert.equal(saveFinisherEvent(saveMessage(outcome), "pf2e", "u"), null, `a ${outcome} save can start no finisher`);
});

test("critTargets: a critical attack or check strikes all its targets; a save, only a critically failed saver", () => {
  const orc = { id: "orc" }, gob = { id: "gob" };
  assert.deepEqual(critTargets({ type: "attack", outcome: "criticalSuccess", targets: [orc] }), [orc], "an attack crit on one target");
  assert.deepEqual(critTargets({ type: "attack", outcome: "criticalSuccess", targets: [orc, gob] }), [orc, gob], "a critical roll against several targets strikes them all");
  assert.deepEqual(critTargets({ type: "check", outcome: "criticalSuccess", targets: [orc, null] }), [orc]);
  assert.deepEqual(critTargets({ type: "attack", outcome: "success", targets: [orc] }), []);
  assert.deepEqual(critTargets({ type: "save", outcome: "criticalFailure", targets: [orc] }), [orc], "the saver crit-failed: the caster critically struck it");
  for (const outcome of ["criticalSuccess", "success", "failure", undefined]) assert.deepEqual(critTargets({ type: "save", outcome, targets: [orc] }), [], `a ${outcome} save`);
  assert.deepEqual(critTargets({ type: "use", outcome: "criticalSuccess", targets: [orc] }), [], "a use has no degree of its own");
  assert.deepEqual(critTargets({ type: "damage", outcome: "criticalSuccess", targets: [orc] }), []);
  assert.deepEqual(critTargets(null), []);
});

test("the catalog dropdown moves an entry to exactly one finisher, case-insensitively", () => {
  const list = [fin("a", "Shove, greataxe"), fin("b", "Fireball"), { id: "plain", name: "P", match: "Greataxe", stages: [] }];
  const moved = linkFinisher(list, "Greataxe", "b");
  assert.equal(moved[0].match, "Shove");
  assert.equal(moved[1].match, "Fireball, Greataxe");
  assert.equal(moved[2].match, "Greataxe", "normal recipes are untouched");
  assert.equal(linkedFinisher(moved, "greataxe").id, "b");
  const none = linkFinisher(moved, "GREATAXE", "");
  assert.equal(linkedFinisher(none, "Greataxe"), null);
  assert.equal(none[0], moved[0], "unchanged recipes keep their identity");
});

test("a player may move a token they own, or one their own token struck", () => {
  assert.equal(mayDisplace({ ownsToken: true, ownsAttacker: false }), true);
  assert.equal(mayDisplace({ ownsToken: false, ownsAttacker: true }), true);
  assert.equal(mayDisplace({ ownsToken: false, ownsAttacker: false }), false);
});

test("a finisher's travel path is the mover's held keyframed path", () => {
  const path = { kind: "motion", motion: "path", subject: "targets", motionEnd: "hold", keyframes: [] };
  assert.equal(finisherTravelPath({ finisher: normalizeFinisher({}), stages: [{ kind: "impact" }, path] }), path);
  assert.equal(finisherTravelPath({ finisher: normalizeFinisher({}), stages: [{ ...path, subject: "source" }] }), null, "the user's own path is not the travel");
  assert.equal(finisherTravelPath({ finisher: normalizeFinisher({ mover: "source" }), stages: [path] }), path, "an old source mover moves the target");
  assert.equal(finisherTravelPath({ finisher: normalizeFinisher({}), stages: [{ ...path, motionEnd: undefined }] }), null, "a returning path does not travel");
});

test("the studio chip says how a finisher plays, where it lands, and how it ends", () => {
  const path = { kind: "motion", motion: "path", subject: "targets", motionEnd: "hold", keyframes: [{ at: 0, x: 0, y: 0 }, { at: 1, x: 2.6, y: 0 }] };
  assert.equal(finisherChipText({ finisher: normalizeFinisher({ ending: "body" }), stages: [path] }), "Killing blow · lands 3 sq · Body");
  assert.equal(finisherChipText({ finisher: normalizeFinisher({ on: "use", ending: "vanish" }), stages: [{ ...path, keyframes: [{ at: 0, x: 0, y: 0 }, { at: 1, x: 0, y: 0 }] }] }), "Every successful use · in place · Vanish");
  assert.equal(finisherChipText({ finisher: normalizeFinisher({ knockback: 2, ending: "stay" }), stages: [] }), "Killing blow · lands 2 sq · Stay", "legacy travel uses knockback");
});

test("the chip warns when a travelling path lands tilted, shrunk or faded (the landing snaps it upright)", () => {
  const path = { kind: "motion", motion: "path", subject: "targets", motionEnd: "hold", keyframes: [{ at: 0, x: 0, y: 0 }, { at: 1, x: 3, y: 0, rotation: 90 }] };
  assert.equal(finisherChipText({ finisher: normalizeFinisher({ ending: "body" }), stages: [path] }), "Killing blow · lands 3 sq · Body · ⚠ lands tilted");
  const upright = { ...path, keyframes: [path.keyframes[0], { ...path.keyframes[1], rotation: 720 }] };
  assert.doesNotMatch(finisherChipText({ finisher: normalizeFinisher({}), stages: [upright] }), /tilted/);
  const inPlace = { ...path, keyframes: [path.keyframes[0], { at: 1, x: 0.2, y: 0, scale: 0.05, alpha: 0 }] };
  assert.doesNotMatch(finisherChipText({ finisher: normalizeFinisher({}), stages: [inPlace] }), /tilted/, "shrinking in place is fine");
});

test("addFinisherName appends a trimmed name once, ignoring case and blanks", () => {
  assert.equal(addFinisherName("", "Shove"), "Shove");
  assert.equal(addFinisherName(undefined, "  Shove "), "Shove");
  assert.equal(addFinisherName("Shove", "Greataxe"), "Shove, Greataxe");
  assert.equal(addFinisherName("Shove, Greataxe", "greataxe"), "Shove, Greataxe", "no duplicate, whatever the case");
  assert.equal(addFinisherName("Shove,greataxe ,", "Fireball"), "Shove, greataxe, Fireball", "keeps the comma format");
  assert.equal(addFinisherName("Shove", "   "), "Shove");
  assert.equal(addFinisherName("Shove", null), "Shove");
});

test("removeFinisherName drops a name whatever its case and keeps the rest", () => {
  assert.equal(removeFinisherName("Shove, Greataxe, Fireball", "greataxe"), "Shove, Fireball");
  assert.equal(removeFinisherName("Shove", " SHOVE "), "");
  assert.equal(removeFinisherName("Shove,Greataxe", "Missing"), "Shove, Greataxe");
  assert.equal(removeFinisherName("", "Shove"), "");
  assert.equal(removeFinisherName(undefined, ""), "");
});

test("normalizeFinisher keeps valid item links by normalized name and drops junk", () => {
  assert.equal(normalizeFinisher({}).links, undefined, "no links: the defaults are unchanged");
  assert.equal(normalizeFinisher({ links: "Item.a" }).links, undefined);
  assert.equal(normalizeFinisher({ links: [] }).links, undefined, "an array is not a link map");
  assert.deepEqual(normalizeFinisher({ links: { greataxe: "Item.axe", " ": "Item.x", shove: 5, fire: "", ok: null, "Big_Axe": "Item.big" } }).links, { greataxe: "Item.axe", "big axe": "Item.big" });
  assert.equal(normalizeFinisher({ links: { a: "x".repeat(400) } }).links.a.length, 300, "uuids are capped");
  const many = Object.fromEntries(Array.from({ length: 60 }, (_, i) => [`n${i}`, `Item.${i}`]));
  assert.equal(Object.keys(normalizeFinisher({ links: many }).links).length, 50, "at most 50 links");
  const kept = { on: "use", links: { shove: "Item.s" } };
  assert.deepEqual(normalizeFinisher(normalizeFinisher(kept)), normalizeFinisher(kept), "idempotent");
});

test("finisher item links are set, read and removed by name without mutating", () => {
  const f = normalizeFinisher({});
  const linked = linkFinisherItem(f, " Greataxe ", "Item.axe");
  assert.notEqual(linked, f);
  assert.equal(f.links, undefined, "the input is untouched");
  assert.deepEqual(linked.links, { greataxe: "Item.axe" });
  assert.equal(finisherItemLink(linked, "GREATAXE"), "Item.axe");
  assert.equal(finisherItemLink(linked, "Shove"), null);
  assert.equal(finisherItemLink(f, "Greataxe"), null);
  assert.equal(finisherItemLink(undefined, "Greataxe"), null);
  const both = linkFinisherItem(linked, "Shove", "Item.s");
  const unlinked = unlinkFinisherItem(both, "greataxe");
  assert.deepEqual(unlinked.links, { shove: "Item.s" });
  assert.deepEqual(both.links, { greataxe: "Item.axe", shove: "Item.s" }, "unlinking copies");
  assert.equal(unlinkFinisherItem(f, "Greataxe"), f, "nothing to remove: the same object");
});

test("the catalog dropdown stores the entry's uuid on its finisher and moves the link with the name", () => {
  const list = [fin("a", "Shove, greataxe", { links: { greataxe: "Item.old" } }), fin("b", "Fireball")];
  const moved = linkFinisher(list, "Greataxe", "b", "Compendium.pf2e.equipment-srd.Item.axe");
  assert.equal(finisherItemLink(moved[1].finisher, "greataxe"), "Compendium.pf2e.equipment-srd.Item.axe");
  assert.equal(finisherItemLink(moved[0].finisher, "greataxe"), null, "the old finisher forgets the link");
  const plain = linkFinisher(list, "Fireball", "b");
  assert.equal(plain[1], list[1], "no uuid and no change: same recipe");
  const none = linkFinisher(moved, "Greataxe", "");
  assert.equal(finisherItemLink(none[1].finisher, "Greataxe"), null, "unlinking drops the link");
});

test("players and the new Plays-on values are validated", () => {
  const f = normalizeFinisher({ players: ["u1", "u1", 7, "", "*"], on: "criticalOrKill" });
  assert.deepEqual(f.players, ["u1", "*"]);
  assert.equal(f.on, "criticalOrKill");
  assert.equal(normalizeFinisher({ on: "critical" }).on, "critical");
  assert.deepEqual(normalizeFinisher({}).players, []);
});

const owned = (id, match, finisher = {}) => fin(id, match, { players: ["u1"], ...finisher });

test("a player's choices are finishers given to them whose Applies-to matches the item", () => {
  const list = [owned("a", "Longsword"), owned("b", "Fireball"), fin("c", "Longsword", { players: ["*"] }), fin("d", "Longsword", { players: ["u2"] }), owned("e", "Longsword", {}), { ...owned("f", "Longsword"), enabled: false }];
  assert.deepEqual(playerFinisherChoices(list, { userId: "u1", itemName: "Longsword" }).map((r) => r.id), ["a", "c", "e"]);
  assert.deepEqual(playerFinisherChoices(list, { userId: "u3", itemName: "Longsword" }).map((r) => r.id), ["c"]);
  assert.equal(finisherAvailableTo(fin("g", "", { players: [] }), "u1"), false);
});

test("a pick only plays while it is still valid", () => {
  const list = [owned("a", "Longsword"), fin("b", "Longsword", { players: ["u2"] })];
  const item = { itemName: "Longsword" };
  assert.equal(pickedFinisher(list, { choiceId: "a", ownerUserIds: ["u1"], ...item }).id, "a");
  assert.equal(pickedFinisher(list, { choiceId: "b", ownerUserIds: ["u1"], ...item }), null, "not given to this owner");
  assert.equal(pickedFinisher(list, { choiceId: "zz", ownerUserIds: ["u1"], ...item }), null, "deleted");
  assert.equal(pickedFinisher(list, { choiceId: "a", ownerUserIds: ["u1"], itemName: "Dagger" }), null, "item no longer in Applies-to");
  assert.equal(pickedFinisher(list, { choiceId: null, ownerUserIds: ["u1"], ...item }), null);
  assert.equal(pickedFinisher(list, { choiceId: "b", ownerUserIds: [], ...item }).id, "b", "a GM-run creature keeps the GM's pick");
});

test("each Plays-on fires on its own outcomes", () => {
  const f = (on) => normalizeFinisher({ on });
  const cases = [
    ["kill", "success", true, true], ["kill", "criticalSuccess", false, false],
    ["critical", "criticalSuccess", false, true], ["critical", "success", true, false],
    ["criticalOrKill", "criticalSuccess", false, true], ["criticalOrKill", "success", true, true], ["criticalOrKill", "success", false, false],
    ["use", "success", false, true], ["use", "failure", false, false],
  ];
  for (const [on, outcome, killed, expected] of cases) assert.equal(finisherFires(f(on), { outcome, killed }), expected, `${on}/${outcome}/${killed}`);
});

test("a player's pick plays only at the moments its Plays on names", () => {
  const p = (on, extra = {}) => ({ id: on, finisher: { on, ...extra } });
  const use = { type: "attack", outcome: "success" };
  const cases = [
    [p("critical"), "crit", "criticalSuccess", true], [p("critical"), "crit", "success", false], [p("critical"), "kill", "criticalSuccess", false],
    [p("criticalOrKill"), "crit", "criticalSuccess", true], [p("criticalOrKill"), "kill", "success", true],
    [p("kill"), "crit", "criticalSuccess", false], [p("kill"), "kill", "success", true], [p("kill", { success: "critical" }), "kill", "success", false],
    [p("use"), "use", undefined, true], [p("use"), "kill", "success", false], [p("kill"), "use", undefined, false], [null, "kill", "success", false],
  ];
  for (const [pick, moment, outcome, expected] of cases) assert.equal(pickPlays(pick, moment, { outcome, event: use }) === pick && pick !== null, expected, `${pick?.id}/${moment}/${outcome}`);
});

test("a finisher plays once per target per action", () => {
  let now = 0;
  const memory = createFinishedMemory(30000, () => now);
  assert.equal(memory.has("msg1:t1"), false);
  memory.mark("msg1:t1");
  assert.equal(memory.has("msg1:t1"), true);
  now = 30001;
  assert.equal(memory.has("msg1:t1"), false, "forgotten after 30 s");
});

test("a finished mark can be retracted or consumed once", () => {
  const memory = createFinishedMemory(30000, () => 0);
  memory.mark("k");
  memory.forget("k");
  assert.equal(memory.has("k"), false, "a retracted mark is gone");
  memory.mark("k");
  assert.equal(memory.consume("k"), true);
  assert.equal(memory.has("k"), false, "used once, then gone");
  assert.equal(memory.consume("k"), false);
});

test("the finished key names the attacker, the target, the item and the finisher", () => {
  assert.equal(finishedKey({ attackerId: "a", targetId: "t", itemUuid: "Actor.x.Item.i", recipeId: "r" }), "a:t:Actor.x.Item.i:r");
  assert.equal(finishedKey({ attackerId: "a", targetId: "t", recipeId: "r" }), "a:t::r", "no item: an empty uuid");
});

test("a finished broadcast is read only when well formed", () => {
  assert.deepEqual(finishedMessage({ type: "finisher-played", key: "a:t::r" }), { key: "a:t::r", played: true });
  assert.deepEqual(finishedMessage({ type: "finisher-played", key: "a:t::r", played: false }), { key: "a:t::r", played: false });
  assert.equal(finishedMessage({ type: "displace-commit", key: "a" }), null);
  assert.equal(finishedMessage({ type: "finisher-played", key: 5 }), null);
  assert.equal(finishedMessage({ type: "finisher-played", key: "" }), null);
  assert.equal(finishedMessage({ type: "finisher-played", key: "x".repeat(401) }), null);
  assert.equal(finishedMessage({ type: "finisher-played", key: "k", played: "no" }), null);
  assert.equal(finishedMessage(null), null);
});

test("a stored Needs never gates critical modes, where it is hidden", () => {
  const r = fin("cok", "Sword", { on: "criticalOrKill", success: "critical" });
  assert.equal(passesSuccess(r.finisher, "success"), true);
  assert.equal(killFinisher([r], { itemName: "Sword" })?.id, "cok");
  assert.equal(pickPlays(r, "kill", { outcome: "success" })?.id, "cok");
  const k = fin("k", "Sword", { on: "kill", success: "critical" });
  assert.equal(killFinisher([k], { itemName: "Sword" }), null);
});

test("the by-damage-type default plays the damage type's built-in finisher when no finisher of the item's applies", () => {
  const list = [fin("axe", "Greataxe"), fin("def", "")];
  assert.equal(killFinisher(list, { itemName: "Dagger" }, "by-damage-type", { damageType: "piercing" }).id, "builtin-perforated");
  assert.equal(killFinisher(list, { itemName: "Dagger" }, "by-damage-type", { damageType: "fire" }).name, "Cinders");
  assert.equal(killFinisher(list, { itemName: "Greataxe" }, "by-damage-type", { damageType: "fire" }).id, "axe", "a name-matched finisher still wins");
  assert.equal(killFinisher(list, { itemName: "Dagger" }, "by-damage-type", { damageType: "untyped" }), null, "an unknown type: the plain collapse");
  assert.equal(killFinisher(list, { itemName: "Dagger" }, "by-damage-type"), null, "no damage type known: the plain collapse");
  assert.equal(killFinisher(list, { itemName: "Dagger" }, "by-damage-type", { damageType: "fire", crit: true }).id, "builtin-cinders", "any success, crit or not");
  assert.equal(killFinisher(list, { itemName: "Dagger" }, "def", { damageType: "fire" }).id, "def", "another default ignores the damage type");
  assert.equal(killFinisher([fin("by-damage-type", "")], {}, "by-damage-type", { damageType: "fire" }).id, "builtin-cinders", "the built-in, not a finisher that happens to share the id");
});

test("the default finisher's ending can be overridden; the item's own finishers keep theirs", async () => {
  const { planFinisher } = await import("../../../scripts/engines/finishers/finisher-play.mjs");
  const own = fin("axe", "Greataxe", { ending: "vanish" }), def = fin("def", "", { ending: "vanish" });
  const built = killFinisher([], { itemName: "Dagger" }, "by-damage-type", { damageType: "fire", defaultEnding: "body" });
  assert.equal(built.id, "builtin-cinders");
  assert.equal(built.finisher.ending, "body");
  assert.equal(built.finisher.revealsBody, true, "made to vanish: its body shows again");
  assert.equal(killFinisher([own, def], { itemName: "Dagger" }, "def", { defaultEnding: "body" }).finisher.ending, "body");
  assert.equal(killFinisher([own, def], { itemName: "Greataxe" }, "def", { defaultEnding: "body" }).finisher.ending, "vanish", "the item's own finisher");
  assert.equal(killFinisher([own, def], { itemName: "Dagger" }, "def", { defaultEnding: "" }).finisher.ending, "vanish", "as each finisher is made");
  assert.equal(killFinisher([own, def], { itemName: "Dagger" }, "def", { defaultEnding: "nonsense" }).finisher.ending, "vanish");
  // Its pieces no longer hold the real token hidden: the body comes back, then is marked Defeated.
  const host = { gridSize: () => 100, trace: () => {} }, mover = { document: { x: 0, y: 0 }, center: { x: 50, y: 50 }, w: 100, h: 100 };
  const held = (recipe) => planFinisher({ recipe, mover, dead: true }, host).composed.stages.filter((s) => s.motion === "fragments" && s.motionEnd === "hold").length;
  assert.equal(held(killFinisher([], {}, "by-damage-type", { damageType: "fire" })), 1, "vanishing as made: the pieces hold it hidden");
  assert.equal(held(built), 0);
});

test("a built-in preset can be the default finisher without copying it", () => {
  const played = killFinisher([], { itemName: "Dagger" }, "preset:shatter");
  assert.equal(played.id, "builtin-shatter");
  assert.equal(played.name, "Shatter");
  assert.equal(killFinisher([], {}, "preset:no-such-preset"), null);
});
