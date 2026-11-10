import test from "node:test";
import assert from "node:assert/strict";
import {
  DOOR_ATTACK_SYSTEMS, defaultDoorStats, ownDoorStat, doorStats, doorHp, doorDamage, doorCracked, doorHpLine,
  strikeReaches, strikeIdentifier, doorAttackOf, attackDegree, doorAttackCheck, doorAttackRoller, doorHitUpdate, HITS_KEPT,
} from "../../../scripts/engines/props/door-attack.mjs";

const scene = (f = {}) => ({ id: "s", flags: { animater: { breakableProps: true, ...f } } });
// a horizontal door from (300, 200) to (400, 200); the squares below it start at y 200
const door = (own = {}, extra = {}) => ({ id: "d1", c: [300, 200, 400, 200], door: 1, ds: 0, move: 20, sight: 20, light: 20, sound: 20, levels: [], flags: { animater: { breakWall: own } }, ...extra });
const tok = (x, y, extra = {}) => ({ x, y, w: 100, h: 100, level: undefined, ...extra });
const d20 = (total, natural = 10) => ({ total, dice: [{ faces: 20, total: natural, results: [{ result: natural, active: true }] }] });
const attackMsg = ({ id = "a1", author = "u1", total = 15, natural = 10, wallId = "d1", tokenId = "t1", actor = "act1", identifier = "item1.longsword.melee", type = "attack-roll" } = {}) => ({
  id, author: { id: author }, rolls: [d20(total, natural)], speaker: { actor, token: tokenId, scene: "s" },
  flags: { pf2e: { context: { type, identifier, actor, outcome: "success" } }, animater: { doorAttack: { wallId, tokenId, sceneId: "s" } } },
});
const damageMsg = ({ id = "m1", author = "u1", total = 12, outcome = "success", attackId = "a1", wallId = "d1", tokenId = "t1", actor = "act1", item = "item1", type = "damage-roll", sourceType = "attack" } = {}) => ({
  id, author: { id: author }, rolls: [{ total }], speaker: { actor, token: tokenId, scene: "s" },
  flags: { pf2e: { context: { type, sourceType, actor, outcome }, origin: { uuid: `Actor.act1.Item.${item}` } }, animater: { doorAttack: { wallId, tokenId, sceneId: "s", attackId } } },
});
const sender = { id: "u1", isGM: false, viewedScene: "s" };
const melee = { ranged: false, feet: 5 };
const okArgs = (over = {}) => ({ wall: door(), scene: scene(), grid: 100, gridDistance: 5, sender, attack: attackMsg(), damage: damageMsg(),
  token: { ...tok(300, 200), authorOwns: true, actorId: "act1" }, strike: melee, sight: true, system: "pf2e", ...over });

test("only PF2e attacks doors", () => {
  assert.ok(DOOR_ATTACK_SYSTEMS.has("pf2e"));
  for (const s of ["sf2e", "dnd5e", "daggerheart", "draw-steel", "crucible"]) assert.equal(DOOR_ATTACK_SYSTEMS.has(s), false);
});

test("door stats by material, from Table 11-4", () => {
  assert.deepEqual(defaultDoorStats("wood"), { ac: 10, hardness: 5, maxHp: 20, bt: 10 });
  assert.deepEqual(defaultDoorStats("reinforced"), { ac: 10, hardness: 10, maxHp: 40, bt: 20 });
  assert.deepEqual(defaultDoorStats("metal"), { ac: 10, hardness: 9, maxHp: 36, bt: 18 });
  assert.deepEqual(defaultDoorStats("stone"), { ac: 10, hardness: 14, maxHp: 56, bt: 28 });
  assert.deepEqual(defaultDoorStats("junk"), defaultDoorStats("wood"));
});

test("a door's own stats override the material's; blank or junk is Automatic", () => {
  assert.equal(ownDoorStat({ ac: 18 }, "ac"), 18);
  assert.equal(ownDoorStat({ ac: "16" }, "ac"), 16); // a form saves it as text
  assert.equal(ownDoorStat({ ac: "" }, "ac"), null);
  assert.equal(ownDoorStat({ ac: 0 }, "ac"), null); // AC and HP need at least 1
  assert.equal(ownDoorStat({ hardness: 0 }, "hardness"), 0); // hardness and BT may be 0
  assert.equal(ownDoorStat({ maxHp: 2.5 }, "maxHp"), null);
  assert.equal(ownDoorStat({ bt: -1 }, "bt"), null);
  assert.equal(ownDoorStat({ maxHp: 100000 }, "maxHp"), null);
  assert.deepEqual(doorStats({ hardness: "12", maxHp: 30 }, "wood"), { ac: 10, hardness: 12, maxHp: 30, bt: 10 });
  assert.deepEqual(doorStats({}, "metal"), { ac: 10, hardness: 9, maxHp: 36, bt: 18 });
  assert.deepEqual(doorStats(undefined, undefined), { ac: 10, hardness: 5, maxHp: 20, bt: 10 });
});

test("current HP: the stored value, else full; never above the maximum", () => {
  const s = doorStats({}, "wood");
  assert.equal(doorHp({}, s), 20);
  assert.equal(doorHp({ hp: 7 }, s), 7);
  assert.equal(doorHp({ hp: 0 }, s), 0);
  assert.equal(doorHp({ hp: 50 }, s), 20);
  assert.equal(doorHp({ hp: "x" }, s), 20);
  assert.equal(doorHp({ hp: -3 }, s), 20);
});

test("damage: Hardness comes off first; below Hardness does nothing; HP stops at 0", () => {
  assert.deepEqual(doorDamage({ hp: 20, damage: 12, hardness: 5 }), { dealt: 7, hp: 13 });
  assert.deepEqual(doorDamage({ hp: 20, damage: 5, hardness: 5 }), { dealt: 0, hp: 20 });
  assert.deepEqual(doorDamage({ hp: 20, damage: 3, hardness: 5 }), { dealt: 0, hp: 20 });
  assert.deepEqual(doorDamage({ hp: 4, damage: 30, hardness: 5 }), { dealt: 4, hp: 0 });
  assert.deepEqual(doorDamage({ hp: 36, damage: 18, hardness: 9 }), { dealt: 9, hp: 27 }); // an iron door
  assert.deepEqual(doorDamage({ hp: 20, damage: NaN, hardness: 5 }), { dealt: 0, hp: 20 });
});

test("cracked at or below the Broken Threshold, while it still stands", () => {
  const s = doorStats({}, "wood");
  assert.equal(doorCracked({}, s), false);
  assert.equal(doorCracked({ hp: 11 }, s), false);
  assert.equal(doorCracked({ hp: 10 }, s), true);
  assert.equal(doorCracked({ hp: 1 }, s), true);
  assert.equal(doorCracked({ hp: 0 }, s), false); // broken: the wreck shows instead
});

test("the chat line", () => {
  assert.equal(doorHpLine({ hp: 13, maxHp: 20, dealt: 7 }), "Door: 13 of 20 HP left.");
  assert.equal(doorHpLine({ hp: 20, maxHp: 20, dealt: 0, hardness: 5 }), "Door: the blow does not get past its Hardness 5. 20 of 20 HP left.");
  assert.equal(doorHpLine({ hp: 0, maxHp: 20, dealt: 4 }), "Door: 0 of 20 HP left. It breaks.");
  assert.equal(doorHpLine({ hp: 8, maxHp: 20, dealt: 5, cracked: true }), "Door: 8 of 20 HP left. It is cracked.");
});

test("reach: a melee Strike reaches a door within its reach of the token", () => {
  const w = door();
  assert.equal(strikeReaches({ token: tok(300, 200), wall: w, grid: 100, strike: melee }), null); // touching it
  assert.equal(strikeReaches({ token: tok(300, 300), wall: w, grid: 100, strike: melee }), null); // a square away (as Force Open)
  assert.equal(strikeReaches({ token: tok(300, 400), wall: w, grid: 100, strike: melee }), "far");
  assert.equal(strikeReaches({ token: tok(300, 400), wall: w, grid: 100, strike: { ranged: false, feet: 10 } }), null); // reach weapon
  assert.equal(strikeReaches({ token: tok(300, 400), wall: w, grid: 100, gridDistance: 10, strike: { ranged: false, feet: 10 } }), "far"); // 10 ft squares
  assert.equal(strikeReaches({ token: tok(300, 200, { level: "L2" }), wall: door({}, { levels: ["L1"] }), grid: 100, strike: melee }), "level");
  assert.equal(strikeReaches({ token: { x: 1 }, wall: w, grid: 100, strike: melee }), "far");
  assert.equal(strikeReaches({ token: tok(300, 200), wall: w, grid: 100, strike: { ranged: false, feet: NaN } }), "far");
});

test("reach: a ranged Strike needs range and line of sight", () => {
  const w = door(), bow = { ranged: true, feet: 600 };
  assert.equal(strikeReaches({ token: tok(300, 1200), wall: w, grid: 100, strike: bow, sight: true }), null);
  assert.equal(strikeReaches({ token: tok(300, 1200), wall: w, grid: 100, strike: bow, sight: false }), "sight");
  assert.equal(strikeReaches({ token: tok(300, 1200), wall: w, grid: 100, strike: bow }), "sight");
  assert.equal(strikeReaches({ token: tok(300, 1200), wall: w, grid: 100, strike: { ranged: true, feet: 30 }, sight: true }), "far"); // 9 squares off, 30 ft
  assert.equal(strikeReaches({ token: tok(300, 700), wall: w, grid: 100, strike: { ranged: true, feet: 30 }, sight: true }), null); // 5 squares = 25 ft
});

test("strike identifier: item id, slug and melee or ranged use", () => {
  assert.deepEqual(strikeIdentifier("abc.longsword.melee"), { itemId: "abc", slug: "longsword", use: "melee" });
  assert.deepEqual(strikeIdentifier("abc.dagger.ranged"), { itemId: "abc", slug: "dagger", use: "ranged" });
  assert.equal(strikeIdentifier("abc.dagger.thrown"), null);
  assert.equal(strikeIdentifier(""), null);
  assert.equal(strikeIdentifier(7), null);
});

test("door attack flag read from a message", () => {
  assert.deepEqual(doorAttackOf(attackMsg()), { wallId: "d1", tokenId: "t1", sceneId: "s", attackId: null, authorId: "u1" });
  assert.deepEqual(doorAttackOf(damageMsg()), { wallId: "d1", tokenId: "t1", sceneId: "s", attackId: "a1", authorId: "u1" });
  assert.equal(doorAttackOf({ flags: {} }), null);
  assert.equal(doorAttackOf({ flags: { animater: { doorAttack: { wallId: 5, tokenId: "t" } } } }), null);
  assert.equal(doorAttackOf({ flags: { animater: { doorAttack: { wallId: "d", tokenId: "" } } } }), null);
});

test("attack degree: the GM's own reading of the d20 against the door's AC", () => {
  assert.equal(attackDegree(attackMsg({ total: 10 }), 10), 2);
  assert.equal(attackDegree(attackMsg({ total: 9 }), 10), 1);
  assert.equal(attackDegree(attackMsg({ total: 20 }), 10), 3);
  assert.equal(attackDegree(attackMsg({ total: 9, natural: 20 }), 10), 2); // a natural 20 a step up
  assert.equal(attackDegree(attackMsg({ total: 21, natural: 1 }), 10), 2); // a natural 1 a step down
  assert.equal(attackDegree({ rolls: [] }, 10), null);
});

test("GM check: a hit from adjacent lowers the door's HP by damage minus Hardness", () => {
  const r = doorAttackCheck(okArgs());
  assert.equal(r.ok, true);
  assert.equal(r.hp, 13); assert.equal(r.dealt, 7); assert.equal(r.broken, false); assert.equal(r.cracked, false);
  assert.equal(r.maxHp, 20);
  assert.deepEqual(r.hits, ["a1", "m1"]);
});

test("GM check: cracked at the Broken Threshold, broken at 0", () => {
  const c = doorAttackCheck(okArgs({ wall: door({ hp: 15 }) }));
  assert.equal(c.hp, 8); assert.equal(c.cracked, true); assert.equal(c.broken, false);
  const b = doorAttackCheck(okArgs({ wall: door({ hp: 6 }) }));
  assert.equal(b.hp, 0); assert.equal(b.broken, true); assert.equal(b.cracked, false);
});

test("GM check: damage below Hardness is applied (and used up) but does nothing", () => {
  const r = doorAttackCheck(okArgs({ damage: damageMsg({ total: 4 }) }));
  assert.equal(r.ok, true); assert.equal(r.dealt, 0); assert.equal(r.hp, 20);
});

test("GM check: an iron door takes 9 off each hit", () => {
  const r = doorAttackCheck(okArgs({ wall: door({ material: "metal" }), damage: damageMsg({ total: 18 }) }));
  assert.equal(r.dealt, 9); assert.equal(r.hp, 27); assert.equal(r.maxHp, 36);
});

test("GM check: the door's own AC and Hardness are used, never the message's", () => {
  // the roll claims a success, but 15 does not meet the door's own AC 16
  assert.equal(doorAttackCheck(okArgs({ wall: door({ ac: 16 }) })).why, "miss");
  assert.equal(doorAttackCheck(okArgs({ wall: door({ hardness: 0 }) })).dealt, 12);
});

test("GM check refusals", () => {
  const why = (over) => doorAttackCheck(okArgs(over)).why;
  assert.equal(why({ scene: scene({ breakableProps: false }) }), "off");
  assert.equal(why({ scene: scene({ breakWalls: false }) }), "off");
  assert.equal(why({ system: "dnd5e" }), "system");
  assert.equal(why({ wall: null }), "missing");
  assert.equal(why({ wall: door({ broken: { seed: 1 } }) }), "broken");
  assert.equal(why({ wall: door({ door: "never" }) }), "kind");
  assert.equal(why({ wall: door({}, { door: 0 }) }), "kind");
  assert.equal(why({ wall: door({}, { ds: 1 }) }), "open"); // an open door is not in the way
  assert.equal(why({ sender: null }), "sender");
  assert.equal(why({ sender: { ...sender, viewedScene: "other" } }), "scene");
  assert.equal(why({ attack: null }), "roll");
  assert.equal(why({ damage: null }), "roll");
  assert.equal(why({ attack: attackMsg({ author: "u2" }) }), "sender");
  assert.equal(why({ damage: damageMsg({ author: "u2" }) }), "sender");
  assert.equal(why({ attack: attackMsg({ type: "skill-check" }) }), "roll");
  assert.equal(why({ damage: damageMsg({ type: "attack-roll" }) }), "roll");
  assert.equal(why({ damage: damageMsg({ sourceType: "save" }) }), "roll");
  assert.equal(why({ attack: attackMsg({ wallId: "d2" }) }), "kind"); // rolled at another door
  assert.equal(why({ damage: damageMsg({ wallId: "d2" }) }), "kind");
  assert.equal(why({ damage: damageMsg({ attackId: "a9" }) }), "roll"); // not this attack's damage
  assert.equal(why({ damage: damageMsg({ tokenId: "t9" }) }), "roll");
  assert.equal(why({ damage: damageMsg({ actor: "act9" }) }), "roll"); // another actor's damage
  assert.equal(why({ damage: damageMsg({ item: "item9" }) }), "roll"); // another weapon's damage
  assert.equal(why({ attack: attackMsg({ identifier: "junk" }) }), "roll");
  assert.equal(why({ token: undefined }), "far");
  assert.equal(why({ token: { ...tok(300, 200), authorOwns: false, actorId: "act1" } }), "sender");
  assert.equal(why({ token: { ...tok(300, 200), authorOwns: true, actorId: "act9" } }), "sender"); // not the striker's token
  assert.equal(why({ token: { ...tok(300, 500), authorOwns: true, actorId: "act1" } }), "far");
  assert.equal(why({ strike: { ranged: true, feet: 600 }, sight: false }), "sight");
  assert.equal(why({ strike: undefined }), "roll"); // the GM could not find that Strike on the actor
  assert.equal(why({ attack: attackMsg({ total: 5 }) }), "miss");
  assert.equal(why({ damage: damageMsg({ outcome: "failure" }) }), "roll");
  assert.equal(why({ damage: damageMsg({ outcome: "criticalSuccess" }) }), "outcome"); // crit damage needs a critical hit
  assert.equal(doorAttackCheck(okArgs({ attack: attackMsg({ total: 20 }), damage: damageMsg({ outcome: "criticalSuccess", total: 24 }) })).dealt, 19);
  assert.equal(why({ damage: damageMsg({ total: NaN }) }), "roll");
  assert.equal(why({ used: true }), "used");
  assert.equal(why({ wall: door({ hits: ["m1"] }) }), "used");
  assert.equal(why({ wall: door({ hits: ["a1"] }) }), "used"); // one damage roll per attack
  // the GM may attack with any token, and its messages are its own
  const gm = { id: "g", isGM: true, viewedScene: "s" };
  assert.equal(doorAttackCheck(okArgs({ sender: gm, attack: attackMsg({ author: "g" }), damage: damageMsg({ author: "g" }), token: { ...tok(300, 200), authorOwns: false, actorId: "act1" } })).ok, true);
});

test("GM check: the hits kept on the wall are the latest few", () => {
  const old = Array.from({ length: HITS_KEPT }, (_, i) => `h${i}`);
  const r = doorAttackCheck(okArgs({ wall: door({ hits: old }) }));
  assert.equal(r.hits.length, HITS_KEPT);
  assert.deepEqual(r.hits.slice(-2), ["a1", "m1"]);
  assert.equal(r.hits[0], "h2");
});

test("the wall write for a hit that does not break the door", () => {
  assert.deepEqual(doorHitUpdate({ id: "d1" }, { hp: 13, hits: ["a1", "m1"] }), { _id: "d1", "flags.animater.breakWall.hp": 13, "flags.animater.breakWall.hits": ["a1", "m1"] });
});

test("who attacks from the door: the one selected token, else the only owned one", () => {
  assert.deepEqual(doorAttackRoller({ controlled: [{ id: "a" }] }), { tokenId: "a" });
  assert.deepEqual(doorAttackRoller({ controlled: [{ id: "a" }, { id: "b" }] }), { why: "many" });
  assert.deepEqual(doorAttackRoller({ controlled: [], owned: [{ id: "c" }] }), { tokenId: "c" });
  assert.deepEqual(doorAttackRoller({ controlled: [], owned: [{ id: "c" }, { id: "d" }] }), { why: "many" });
  assert.deepEqual(doorAttackRoller({}), { why: "none" });
});
