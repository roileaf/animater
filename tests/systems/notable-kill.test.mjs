import test from "node:test";
import assert from "node:assert/strict";
import { creatureRank, partyLevels, isNotableKill } from "../../scripts/systems/notable-kill.mjs";

const kill = (over) => ({ finalEnemy: false, crit: false, rank: {}, partyLevels: [], systemId: "pf2e", ...over });

test("the last enemy and a critical kill are notable", () => {
  assert.equal(isNotableKill(kill({ finalEnemy: true })), true);
  assert.equal(isNotableKill(kill({ crit: true })), true);
});
test("PF2e: a creature 2 levels above the party's average is a boss", () => {
  assert.equal(isNotableKill(kill({ rank: { level: 7 }, partyLevels: [5, 5] })), true);
  assert.equal(isNotableKill(kill({ rank: { level: 6 }, partyLevels: [5, 5] })), false);
  assert.equal(isNotableKill(kill({ systemId: "sf2e", rank: { level: 7 }, partyLevels: [5, 5] })), true);
});
test("D&D 5e: a CR at or above the party's average level is a boss", () => {
  assert.equal(isNotableKill(kill({ systemId: "dnd5e", rank: { cr: 5 }, partyLevels: [5, 4] })), true);
  assert.equal(isNotableKill(kill({ systemId: "dnd5e", rank: { cr: 4 }, partyLevels: [5, 4] })), false);
});
test("Daggerheart: Solo and Leader adversaries are bosses", () => {
  assert.equal(isNotableKill(kill({ systemId: "daggerheart", rank: { adversaryType: "solo" }, partyLevels: [2] })), true);
  assert.equal(isNotableKill(kill({ systemId: "daggerheart", rank: { adversaryType: "leader" }, partyLevels: [2] })), true);
  assert.equal(isNotableKill(kill({ systemId: "daggerheart", rank: { adversaryType: "standard" }, partyLevels: [2] })), false);
});
test("no party and no crit: never notable", () => {
  assert.equal(isNotableKill(kill({ rank: { level: 20 } })), false);
  assert.equal(isNotableKill(kill({ systemId: "daggerheart", rank: { adversaryType: "solo" } })), false);
});
test("creatureRank reads each system's level, CR or adversary type", () => {
  assert.deepEqual(creatureRank({ level: 7, system: {} }, "pf2e"), { level: 7 });
  assert.deepEqual(creatureRank({ system: { details: { level: { value: 3 } } } }, "sf2e"), { level: 3 });
  assert.deepEqual(creatureRank({ system: { details: { cr: 0.5 } } }, "dnd5e"), { cr: 0.5 });
  assert.deepEqual(creatureRank({ type: "adversary", system: { type: "solo" } }, "daggerheart"), { adversaryType: "solo" });
  assert.deepEqual(creatureRank(null, "pf2e"), {});
});
test("partyLevels counts player-owned characters in the combat", () => {
  const c = (actor) => ({ actor });
  const pf2e = { combatants: [c({ type: "character", hasPlayerOwner: true, level: 5 }), c({ type: "character", hasPlayerOwner: true, level: 4 }), c({ type: "npc", hasPlayerOwner: false, level: 9 }), c({ type: "character", hasPlayerOwner: false, level: 9 }), c(null)] };
  assert.deepEqual(partyLevels(pf2e, "pf2e"), [5, 4]);
  const dnd = { combatants: [c({ type: "character", hasPlayerOwner: true, system: { details: { level: 6 } } })] };
  assert.deepEqual(partyLevels(dnd, "dnd5e"), [6]);
  const dh = { combatants: [c({ type: "character", hasPlayerOwner: true, system: { levelData: { level: { current: 3 } } } }), c({ type: "adversary", hasPlayerOwner: false, system: { type: "solo" } })] };
  assert.deepEqual(partyLevels(dh, "daggerheart"), [3]);
  assert.deepEqual(partyLevels(null, "pf2e"), []);
});
