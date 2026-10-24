import test from "node:test";
import assert from "node:assert/strict";
import {
  createRecap, topMoments, scoreMoment, rollFacts, rollMoment, whenClear, normalizeMoment, RECAP_MODES,
  attackFacts, damageFacts, damageDealt, publicName, nameFor, captionFor, sameStrike, HIDDEN_NAME,
} from "../../../scripts/engines/flash/recap.mjs";

const who = (name, extra = {}) => ({ name, img: `tokens/${name.toLowerCase()}.webp`, tokenId: `tok${name.replace(/\W/g, "")}`, ...extra });
const m = (kind, actor, extra = {}) => ({ kind, actor: who(actor), at: 1, ...extra });

test("moments are cleaned: nothing to show is dropped, names trimmed and braces removed", () => {
  assert.equal(normalizeMoment({ kind: "dance" }), null);
  const n = normalizeMoment({ kind: "kill", actor: { name: "  {manual} Valeros ", img: "https://x.example/a.png" }, target: { name: "Goblin" }, amount: "42.6", item: "Longsword" });
  assert.equal(n.actor.name, "manual Valeros");
  assert.equal(n.target.name, "Goblin");
  assert.equal(n.targets.length, 1);
  assert.equal(n.amount, 43);
  assert.equal(n.item, "Longsword");
  assert.deepEqual(n.badges, ["kill"]);
  assert.equal(typeof n.score, "number");
});

test("old saved moments (one kind each) still read", () => {
  const old = normalizeMoment({ kind: "kill", actor: { name: "Valeros", img: "a.webp" }, target: { name: "Goblin", img: "" }, item: "Sword", amount: 12, crit: true, natural: 20, at: 5, key: "m1" });
  assert.deepEqual(old.badges, ["kill", "crit", "nat20"]);
  assert.equal(old.kind, "kill");
  assert.equal(old.key, "m1");
  assert.equal(old.sceneId, "");
});

test("kills outscore crits, which outscore natural rolls; bigger hits and more badges score higher", () => {
  assert.ok(scoreMoment(m("kill", "A")) > scoreMoment(m("crit", "A")));
  assert.ok(scoreMoment(m("crit", "A")) > scoreMoment(m("nat20", "A")));
  assert.ok(scoreMoment(m("nat20", "A")) > scoreMoment(m("nat1", "A")));
  assert.ok(scoreMoment({ amount: 60 }) > scoreMoment({ amount: 10 }));
  assert.ok(scoreMoment(m("kill", "A", { crit: true })) > scoreMoment(m("kill", "A")));
});

test("one strike is one moment: its crit roll, damage and killing blow merge with badges", () => {
  const r = createRecap();
  const valeros = who("Valeros"), kobold = who("Kobold Dragon Mage", { tokenId: "tokKobold" });
  r.record({ badges: ["crit", "nat20"], natural: 20, actor: valeros, targets: [kobold], item: "+3 Mythic Striking Flaming Astral Frost Longsword", attackMessageId: "atk1", outcome: "criticalSuccess", at: 1000 });
  r.record({ badges: ["kill"], actor: valeros, targets: [kobold], amount: 38, attackMessageId: "atk1", damageMessageId: "dmg1", at: 2500 });
  const all = r.moments();
  assert.equal(all.length, 1);
  assert.deepEqual(all[0].badges, ["kill", "crit", "nat20"]);
  assert.equal(all[0].amount, 38);
  assert.equal(all[0].outcome, "criticalSuccess");
  assert.equal(all[0].damageMessageId, "dmg1");
  assert.equal(all[0].at, 1000);
  // Without the attack's id the HP change still joins the attack: same attacker, same target, moments apart.
  const s = createRecap();
  s.record({ badges: ["crit"], actor: valeros, targets: [kobold], attackMessageId: "atk1", at: 1000 });
  s.record({ badges: ["kill"], actor: valeros, targets: [kobold], amount: 38, damageMessageId: "dmg1", at: 3000 });
  assert.equal(s.moments().length, 1);
  // A second strike (its own messages) stays its own moment.
  s.record({ badges: [], actor: valeros, targets: [kobold], amount: 9, attackMessageId: "atk2", damageMessageId: "dmg2", at: 4000 });
  assert.equal(s.moments().length, 2);
  // An area's one damage roll on two creatures: one moment with both targets.
  const a = createRecap();
  a.record({ actor: who("Ezren"), targets: [who("Goblin A")], amount: 20, damageMessageId: "fb", at: 1 });
  a.record({ badges: ["kill"], actor: who("Ezren"), targets: [who("Goblin B")], amount: 24, damageMessageId: "fb", at: 2 });
  assert.equal(a.moments().length, 1);
  assert.equal(a.moments()[0].targets.length, 2);
  assert.equal(a.moments()[0].amount, 24);
});

test("sameStrike: different messages are different strikes, even on the same target", () => {
  const base = { actor: who("A"), targets: [who("B")], at: 0 };
  assert.equal(sameStrike({ ...base, attackMessageId: "x" }, { ...base, attackMessageId: "y" }), false);
  assert.equal(sameStrike({ ...base, damageMessageId: "x" }, { ...base, at: 1000 }), true);
  assert.equal(sameStrike(base, { ...base, at: 60000 }), false, "too far apart");
  assert.equal(sameStrike(base, { ...base, targets: [who("C")] }), false, "another target");
});

test("damage dealt counts the blow, not the HP that was left", () => {
  // The creature had 1 HP left and was struck for 38.
  assert.equal(damageDealt({ rolled: 38, taken: 1, hpLost: 1, dropped: true }), 38);
  // Still standing: exactly what it took (resistance may have cut the roll).
  assert.equal(damageDealt({ rolled: 30, taken: 25, hpLost: 25, dropped: false }), 25);
  assert.equal(damageDealt({ hpLost: 7 }), 7);
  assert.equal(damageDealt({ rolled: 12, dropped: false }), 12);
  assert.equal(damageDealt({}), 0);
});

test("damage and attack roll facts", () => {
  const dmg = { id: "d1", speaker: { token: "tv" }, rolls: [{ total: 30 }, { total: 8 }], flags: { pf2e: { context: { type: "damage-roll", target: { token: "Scene.s.Token.tk", actor: "Actor.ak" } } } } };
  assert.deepEqual(damageFacts(dmg, "pf2e"), { messageId: "d1", tokenId: "tv", tokenIds: ["tk"], actorIds: ["ak"], total: 38 });
  assert.equal(damageFacts({ ...dmg, whisper: ["gm"] }, "pf2e"), null);
  assert.equal(damageFacts({ ...dmg, flags: { pf2e: { context: { type: "attack-roll" } } } }, "pf2e"), null);
  const atk = { id: "a1", speaker: { token: "tv" }, rolls: [], flags: { pf2e: { context: { type: "attack-roll", outcome: "success", target: { token: "Scene.s.Token.tk" } } } } };
  assert.deepEqual(attackFacts(atk, "pf2e"), { messageId: "a1", tokenId: "tv", targetUuid: "Scene.s.Token.tk", outcome: "success" });
});

test("top moments: distinct strikes and, when possible, distinct attackers; the hardest hit wears Biggest hit", () => {
  // The user's game: kill, crit and biggest hit of one strike, saved as three moments by the old recap.
  const valeros = who("Valeros"), unknown = who("Unknown");
  const old = [
    { kind: "kill", actor: valeros, target: unknown, amount: 1, crit: true, key: "m1", at: 10 },
    { kind: "crit", actor: valeros, target: unknown, natural: 20, key: "m1", attackMessageId: "m1", at: 10 },
    { kind: "bigHit", actor: valeros, target: unknown, amount: 1, crit: true, key: "m1", at: 10 },
  ];
  const top = topMoments(old, 3);
  assert.equal(top.length, 1, "one strike shows once");
  // Several attackers: one each before anyone gets a second.
  const list = [
    { badges: ["kill", "crit"], actor: who("A"), targets: [who("X")], amount: 40, attackMessageId: "1", at: 1 },
    { badges: ["kill"], actor: who("A"), targets: [who("Y")], amount: 30, attackMessageId: "2", at: 2 },
    { badges: ["crit"], actor: who("A"), targets: [who("Z")], amount: 20, attackMessageId: "3", at: 3 },
    { badges: ["nat1"], natural: 1, actor: who("B"), attackMessageId: "4", at: 4 },
    { badges: [], actor: who("C"), targets: [who("X")], amount: 12, attackMessageId: "5", at: 5 },
  ];
  const picked = topMoments(list, 3);
  assert.deepEqual(picked.map((p) => p.actor.name).sort(), ["A", "B", "C"]);
  assert.ok(picked.find((p) => p.actor.name === "A").badges.includes("bigHit"));
  // In the order they happened.
  assert.deepEqual(picked.map((p) => p.at), [1, 4, 5]);
  // With nobody else, one actor may fill the reel.
  assert.equal(topMoments(list.slice(0, 3), 3).length, 3);
  assert.equal(createRecap().top(3).length, 0);
});

test("names: players see a generic name where the nameplate hides it; GMs see the real one", () => {
  assert.equal(publicName({ name: "Kobold Dragon Mage", displayName: 0, nameplatesDecide: true }), HIDDEN_NAME);
  assert.equal(publicName({ name: "Kobold Dragon Mage", displayName: 50, nameplatesDecide: true }), "Kobold Dragon Mage");
  assert.equal(publicName({ name: "Kobold Dragon Mage", displayName: 30, nameplatesDecide: true }), "Kobold Dragon Mage");
  assert.equal(publicName({ name: "Kobold Dragon Mage", displayName: 0 }), "Kobold Dragon Mage", "the system shows names regardless");
  assert.equal(publicName({ name: "Valeros", displayName: 0, nameplatesDecide: true, playerOwned: true }), "Valeros");
  assert.equal(publicName({ name: "Orc", anonymous: true }), HIDDEN_NAME);
  const target = normalizeMoment({ kind: "kill", actor: who("Valeros"), target: { name: HIDDEN_NAME, trueName: "Kobold Dragon Mage" } }).target;
  assert.equal(nameFor(target, false), HIDDEN_NAME);
  assert.equal(nameFor(target, true), "Kobold Dragon Mage");
});

test("captions: who, headline, the damage dealt and the target, badges", () => {
  const moment = normalizeMoment({ badges: ["crit", "nat20"], natural: 20, actor: who("Valeros"), targets: [{ name: HIDDEN_NAME, trueName: "Kobold Dragon Mage" }], amount: 38, item: "Longsword" });
  const player = captionFor(moment);
  assert.equal(player.line, `Valeros — Critical Hit — 38 damage — vs ${HIDDEN_NAME}`);
  assert.deepEqual(player.badges, ["CRIT", "NAT 20"]);
  assert.equal(player.number, "38");
  assert.equal(player.item, "with Longsword");
  assert.match(captionFor(moment, { gm: true }).detail, /Kobold Dragon Mage/);
  const kill = captionFor(normalizeMoment({ badges: ["kill", "crit"], actor: who("A"), amount: 5 }));
  assert.equal(kill.headline, "Critical Killing Blow");
});

test("roll facts: PF2e critical attack with its natural 20, private rolls ignored", () => {
  const roll = { dice: [{ faces: 20, results: [{ result: 20, active: true }] }] };
  const msg = { id: "m1", rolls: [roll], flags: { pf2e: { context: { type: "attack-roll", outcome: "criticalSuccess", target: { token: "Scene.s.Token.t1" } } } }, whisper: [] };
  assert.deepEqual(rollFacts(msg, "pf2e"), { crit: true, natural: 20, targetUuid: "Scene.s.Token.t1", targetName: null, key: "m1", outcome: "criticalSuccess", check: "attack" });
  assert.equal(rollFacts({ ...msg, whisper: ["gm"] }, "pf2e"), null);
  assert.equal(rollFacts({ ...msg, blind: true }, "pf2e"), null);
  assert.equal(rollFacts({ ...msg, rolls: [{ dice: [{ faces: 20, results: [{ result: 14 }] }] }], flags: { pf2e: { context: { type: "attack-roll", outcome: "success" } } } }, "pf2e"), null);
  const one = { id: "m2", rolls: [{ dice: [{ faces: 20, results: [{ result: 1 }] }] }], flags: { pf2e: { context: { type: "saving-throw" } } } };
  assert.equal(rollFacts(one, "pf2e").natural, 1);
  assert.equal(rollFacts({ ...one, flags: { pf2e: { context: { type: "flat-check" } } } }, "pf2e"), null);
  assert.equal(rollFacts({ ...one, flags: { pf2e: { context: { type: "initiative" } } } }, "pf2e"), null);
});

test("roll facts: D&D advantage reads the kept die; crits from the attack roll", () => {
  const roll = { isCritical: true, dice: [{ faces: 20, results: [{ result: 3, active: false, discarded: true }, { result: 20, active: true }] }] };
  const msg = { id: "d1", rolls: [roll], flags: { dnd5e: { roll: { type: "attack" }, targets: [{ name: "Orc", uuid: "Scene.s.Token.o" }] } } };
  assert.deepEqual(rollFacts(msg, "dnd5e"), { crit: true, natural: 20, targetUuid: "Scene.s.Token.o", targetName: "Orc", key: "d1", outcome: "criticalSuccess", check: "attack" });
  assert.equal(rollFacts({ id: "d2", rolls: [{ dice: [{ faces: 20, results: [{ result: 20 }] }] }], flags: { dnd5e: { roll: { type: "damage" } } } }, "dnd5e"), null);
});

test("rolls make one fact: a crit carries its natural 20 and the attack's message", () => {
  assert.equal(rollMoment(null), null);
  const crit = rollMoment({ crit: true, natural: 20, key: "k", check: "attack", outcome: "criticalSuccess" }, { actor: who("A") });
  assert.deepEqual(crit.badges, ["crit", "nat20"]);
  assert.equal(crit.attackMessageId, "k");
  assert.deepEqual(rollMoment({ crit: false, natural: 20, key: "k" }).badges, ["nat20"]);
  assert.deepEqual(rollMoment({ crit: false, natural: 1, key: "k", check: "saving-throw" }).badges, ["nat1"]);
  assert.equal(rollMoment({ crit: false, natural: 1, key: "k", check: "saving-throw" }).attackMessageId, "");
});

test("recap modes", () => {
  assert.deepEqual(Object.keys(RECAP_MODES), ["off", "gm", "everyone"]);
});

test("the recap waits for the ending screen, then for any screen still showing", async () => {
  const slept = [];
  let showing = 3;
  await whenClear({ endMs: 2500, busy: () => showing-- > 0, sleep: async (ms) => { slept.push(ms); } });
  assert.equal(slept[0], 2800);
  assert.equal(slept.length, 4);
  const many = [];
  await whenClear({ endMs: 0, busy: () => true, sleep: async (ms) => { many.push(ms); }, limit: 1000 });
  assert.ok(many.reduce((a, b) => a + b, 0) <= 1300);
});
