import test from "node:test";
import assert from "node:assert/strict";
import { WALL_BREAK_MESSAGE, cleanWallCause, wallNoteFor, validWallBreakRequest, handEdited, handEditUpdate, slamSenderOk, breaksSure } from "../../../scripts/engines/props/wall-break-requests.mjs";
import { readWallNote, wallRepairUpdates } from "../../../scripts/engines/props/wall-break.mjs";
import { PATH_SQUARES } from "../../../scripts/engines/props/prop-requests.mjs";

const scene = (f = {}) => ({ id: "s", flags: { animater: { breakableProps: true, ...f } } });
const wall = (extra = {}) => ({ id: "d1", c: [300, 200, 400, 200], door: 1, ds: 0, move: 20, sight: 20, light: 20, sound: 20, levels: [], flags: {}, ...extra });
const sender = { id: "p", viewedScene: "s", isGM: false };
// The GM's record of the player's own fresh area, holding every wall middle tested (prop-areas.mjs; I1).
const AREA = "Scene.s.Region.a";
const covering = (x = {}) => ({ uuid: AREA, sceneId: "s", authorId: "p", rememberedAt: 1000, damageTypes: ["acid", "bludgeoning", "cold", "electricity", "fire", "force", "piercing", "slashing", "sonic", "vitality", "void", "mental", "poison", "spirit", "bleed"], testPoint: () => true, levels: [], ...x });
const placed = { area: covering(), now: 5000 };
// The wall as the database holds it after an update (a dotted flag key is expanded, "-=" removes).
function written(w, update) {
  const out = structuredClone(w);
  for (const [k, v] of Object.entries(update)) {
    if (k === "_id") continue;
    if (k === "flags.animater.breakWall.broken") { out.flags.animater ??= {}; out.flags.animater.breakWall = { ...(out.flags.animater.breakWall ?? {}), broken: v }; continue; }
    if (k === "flags.animater.breakWall.-=broken") { delete out.flags?.animater?.breakWall?.broken; continue; }
    out[k] = v;
  }
  return out;
}

test("the message type", () => {
  assert.equal(WALL_BREAK_MESSAGE, "prop-wall-break");
});

test("a good area request breaks the door and the update opens it", () => {
  const note = wallNoteFor({ wall: wall(), cause: { kind: "area", areaUuid: AREA, damageType: "fire", at: { x: 350, y: 100 } }, seed: 7, from: { x: 350, y: 100 } });
  const r = validWallBreakRequest({ cause: { kind: "area", areaUuid: AREA, damageType: "fire", at: { x: 350, y: 100 } }, note }, { wall: wall(), scene: scene(), grid: 100, sender, ...placed });
  assert.equal(r.ok, true); assert.equal(r.update.door, 0); assert.equal(r.note.material, "wood");
  assert.equal(r.note.kind, "door"); assert.equal(r.note.mark, "scorch"); assert.equal(r.note.seed, 7);
  assert.deepEqual(r.update, { _id: "d1", door: 0, ds: 0, move: 0, sight: 0, light: 20, sound: 0,
    "flags.animater.breakWall.broken": { ...r.note, restore: { door: 1, ds: 0, move: 20, sight: 20, light: 20, sound: 20 } } });
});

test("refused, each with its own why", () => {
  const req = (cause) => ({ cause, note: wallNoteFor({ wall: wall(), cause, seed: 7, from: { x: 350, y: 100 } }) });
  const area = req({ kind: "area", areaUuid: AREA, damageType: "fire", at: { x: 350, y: 100 } });
  const ctx = (x = {}) => ({ wall: wall(), scene: scene(), grid: 100, sender, ...placed, ...x });
  assert.equal(validWallBreakRequest(area, ctx({ scene: { id: "s", flags: {} } })).why, "off");
  assert.equal(validWallBreakRequest(area, ctx({ scene: scene({ breakWalls: false }) })).why, "off");
  assert.equal(validWallBreakRequest(area, ctx({ wall: wall({ flags: { animater: { breakWall: { broken: area.note } } } }) })).why, "broken");
  assert.equal(validWallBreakRequest(area, ctx({ wall: wall({ door: 0 }) })).why, "kind");
  assert.equal(validWallBreakRequest(req({ kind: "area", areaUuid: AREA, damageType: "piercing", at: { x: 350, y: 100 } }), ctx()).why, "material");
  assert.equal(validWallBreakRequest(req({ kind: "smash" }), ctx()).why, "sender");
  assert.equal(validWallBreakRequest(req({ kind: "smash" }), ctx({ sender: { ...sender, isGM: true } })).ok, true);
  assert.equal(validWallBreakRequest(area, ctx({ sender: { ...sender, viewedScene: "other" } })).why, "scene");
  assert.equal(validWallBreakRequest(area, ctx({ sender: undefined })).why, "sender");
  assert.equal(validWallBreakRequest(area, ctx({ wall: undefined })).why, "missing");
  assert.equal(validWallBreakRequest(req({ kind: "blast-from-a-player", damageType: "fire", at: { x: 350, y: 100 } }), ctx()).why, "kind");
  assert.equal(validWallBreakRequest(area, ctx({ wall: wall({ flags: { animater: { breakWall: { door: "never" } } } }) })).why, "kind");
  assert.equal(validWallBreakRequest(area, ctx({ wall: wall({ flags: { animater: { breakWall: { material: "metal" } } } }) })).why, "material");
  assert.equal(validWallBreakRequest({ cause: area.cause, note: { ...area.note, seed: "x" } }, ctx()).why, "note");
  assert.equal(validWallBreakRequest({ cause: area.cause, note: { ...area.note, from: { x: 1 } } }, ctx()).why, "note");
  assert.equal(validWallBreakRequest({ cause: area.cause }, ctx()).why, "note");
  assert.equal(validWallBreakRequest(area, ctx({ levels: ["upstairs"], wall: wall({ levels: ["ground"] }) })).why, "far");
});

test("the GM's note uses its own kind, material and mark; only seed, cut and from are the requester's", () => {
  const cause = { kind: "area", areaUuid: AREA, damageType: "bludgeoning", at: { x: 350, y: 100 } };
  const forged = { seed: 9, cutAngle: 0.5, from: { x: 350, y: 120 }, kind: "door", material: "stone", mark: "scorch" };
  const r = validWallBreakRequest({ cause, note: forged }, { wall: wall({ flags: { animater: { breakWall: { material: "wood" } } } }), scene: scene(), grid: 100, sender, ...placed });
  assert.equal(r.ok, true);
  assert.deepEqual(r.note, { seed: 9, cutAngle: 0.5, from: { x: 350, y: 120 }, kind: "door", material: "wood", mark: "dust" });
  assert.deepEqual(readWallNote(r.update["flags.animater.breakWall.broken"]).restore, { door: 1, ds: 0, move: 20, sight: 20, light: 20, sound: 20 });
});

test("wallNoteFor cuts from the blow to the wall's middle and reads kind and material from the scene", () => {
  const n = wallNoteFor({ wall: wall({ flags: { animater: { breakWall: { material: "metal" } } } }), scene: scene(), cause: { kind: "area", areaUuid: AREA, damageType: "force" }, seed: 3, from: { x: 350, y: 100 } });
  assert.equal(n.seed, 3); assert.ok(Math.abs(n.cutAngle - Math.PI / 2) < 1e-9);
  assert.deepEqual(n.from, { x: 350, y: 100 }); assert.equal(n.kind, "door"); assert.equal(n.material, "metal"); assert.equal(n.mark, "dust");
  assert.deepEqual(readWallNote(n), n);
  const left = wallNoteFor({ wall: wall(), scene: scene(), cause: {}, seed: 1, from: { x: 250, y: 200 } });
  assert.ok(Math.abs(left.cutAngle) < 1e-9);
  // no from: cut from the cause's centre
  assert.ok(Math.abs(wallNoteFor({ wall: wall(), scene: scene(), cause: { at: { x: 350, y: 300 } }, seed: 1 }).cutAngle + Math.PI / 2) < 1e-9);
});

test("a Large mover crossing the door breaks it; a Medium one does not", () => {
  const cause = (size) => ({ kind: "path", slam: { size }, path: { from: { x: 350, y: 100 }, to: { x: 350, y: 300 } } });
  const mover = (size) => ({ x: 350, y: 100, size, isOwner: true });
  assert.equal(validWallBreakRequest({ cause: cause(2), note: wallNoteFor({ wall: wall(), cause: cause(2), seed: 1, from: { x: 350, y: 100 } }) }, { wall: wall(), scene: scene(), grid: 100, sender, mover: mover(2) }).ok, true);
  assert.equal(validWallBreakRequest({ cause: cause(1), note: wallNoteFor({ wall: wall(), cause: cause(1), seed: 1, from: { x: 350, y: 100 } }) }, { wall: wall(), scene: scene(), grid: 100, sender, mover: mover(1) }).why, "material");
  // the GM's own mover size wins over the size claimed
  assert.equal(validWallBreakRequest({ cause: cause(3), note: wallNoteFor({ wall: wall(), cause: cause(3), seed: 1, from: { x: 350, y: 100 } }) }, { wall: wall(), scene: scene(), grid: 100, sender, mover: mover(1) }).why, "material");
});

test("a slam has to be near, short, through the door and on its level", () => {
  const ok = (cause, mover, w = wall(), who = sender) => validWallBreakRequest({ cause, note: wallNoteFor({ wall: w, cause, seed: 1, from: cause.path?.from ?? { x: 0, y: 0 } }) }, { wall: w, scene: scene(), grid: 100, sender: who, mover: mover && { isOwner: true, ...mover } });
  const path = (from, to) => ({ kind: "path", slam: { size: 2 }, path: { from, to } });
  const through = path({ x: 350, y: 100 }, { x: 350, y: 300 });
  // standing at the landing (the move already written) counts too
  assert.equal(ok(through, { x: 350, y: 300, size: 2 }).ok, true);
  // a door 3 squares from where the mover stands
  assert.equal(ok(through, { x: 350, y: 100 + 500, size: 2 }).why, "far");
  assert.equal(ok(through, undefined).why, "sender");
  assert.equal(ok(through, undefined, wall(), { ...sender, isGM: true }).why, "far");
  assert.equal(ok(path({ x: 450, y: 100 }, { x: 450, y: 300 }), { x: 450, y: 100, size: 2 }).why, "far");
  const long = path({ x: 350, y: 100 }, { x: 350, y: 100 + (PATH_SQUARES + 1) * 100 });
  assert.equal(ok(long, { x: 350, y: 100, size: 2 }).why, "far");
  assert.equal(ok(through, { x: 350, y: 100, size: 2, level: "upstairs" }, wall({ levels: ["ground"] })).why, "far");
  assert.equal(ok(through, { x: 350, y: 100, size: 2, level: "ground" }, wall({ levels: ["ground"] })).ok, true);
});

test("cleanWallCause keeps only the known fields, each well-formed", () => {
  const c = cleanWallCause({ kind: "path", damageType: "fire", slam: { size: 2, evil: 1 }, at: { x: 1, y: 2 }, path: { from: { x: 0, y: 0 }, to: { x: 5, y: 5 } },
    outcome: "success", targetUuid: "Scene.s.Token.t", moverUuid: "Scene.s.Token.m", messageId: "m1", sourceId: "tile1", update: { door: 0 }, note: {} });
  assert.deepEqual(c, { kind: "path", damageType: "fire", slam: { size: 2 }, at: { x: 1, y: 2 }, path: { from: { x: 0, y: 0 }, to: { x: 5, y: 5 } },
    outcome: "success", targetUuid: "Scene.s.Token.t", moverUuid: "Scene.s.Token.m", messageId: "m1", sourceId: "tile1" });
  assert.deepEqual(cleanWallCause({ kind: "area", at: { x: "1", y: 2 }, messageId: 5, sourceId: null }), { kind: "area" });
  assert.deepEqual(cleanWallCause(null), { kind: "" });
  assert.equal(cleanWallCause({ kind: "x".repeat(50), messageId: "m".repeat(500) }).messageId.length, 200);
});

test("a hand edit of door or restrictions counts; our own writes and flag-only edits don't", () => {
  assert.equal(handEdited({ door: 1 }, {}), true);
  assert.equal(handEdited({ sight: 20 }, {}), true);
  for (const k of ["move", "light", "sound"]) assert.equal(handEdited({ [k]: 1 }, undefined), true, k);
  assert.equal(handEdited({ door: 1 }, { animater: { wallRepair: true } }), false);
  assert.equal(handEdited({ door: 0, ds: 0 }, { animater: { wallBreak: true } }), false);
  assert.equal(handEdited({ flags: { animater: { breakWall: { material: "metal" } } } }, {}), false);
  assert.equal(handEdited({ ds: 1 }, {}), false);
  assert.equal(handEdited(undefined, {}), false);
});

test("Review Focus 1: the GM sets a broken door back by hand; the note goes and Repair leaves the edit alone", () => {
  const r = validWallBreakRequest({ cause: { kind: "smash" }, note: wallNoteFor({ wall: wall(), scene: scene(), cause: { kind: "smash" }, seed: 4, from: { x: 350, y: 100 } }) },
    { wall: wall(), scene: scene(), grid: 100, sender: { ...sender, isGM: true } });
  const broken = written(wall(), r.update);
  // the GM makes it a secret door with a half restriction
  const edited = { ...broken, door: 2, sight: 10 };
  assert.equal(handEdited({ door: 2, sight: 10 }, {}), true);
  const clear = handEditUpdate(edited);
  assert.deepEqual(clear, { _id: "d1", "flags.animater.breakWall.-=broken": null });
  const after = written(edited, clear);
  assert.equal(after.flags.animater.breakWall.broken, undefined);
  assert.deepEqual(wallRepairUpdates([after]), []);
  assert.equal(after.door, 2); assert.equal(after.sight, 10);
  // the clearing write itself is flags only, so it is not a hand edit
  assert.equal(handEdited({ flags: { animater: { breakWall: { "-=broken": null } } } }, {}), false);
  assert.equal(handEditUpdate(wall()), null);
});

test("Review Focus 4: a smashed locked door comes back locked on Repair, beside an untouched door", () => {
  const locked = wall({ ds: 2 }), other = wall({ id: "d2", c: [600, 200, 700, 200], door: 2, ds: 0 });
  const r = validWallBreakRequest({ cause: { kind: "smash" }, note: wallNoteFor({ wall: locked, scene: scene(), cause: { kind: "smash" }, seed: 4, from: { x: 350, y: 100 } }) },
    { wall: locked, scene: scene(), grid: 100, sender: { ...sender, isGM: true } });
  assert.equal(r.ok, true);
  const broken = written(locked, r.update);
  assert.equal(broken.door, 0); assert.equal(broken.ds, 0); assert.equal(broken.move, 0);
  const repair = wallRepairUpdates([broken, other]);
  assert.deepEqual(repair, [{ _id: "d1", door: 1, ds: 2, move: 20, sight: 20, light: 20, sound: 20, "flags.animater.breakWall.-=broken": null }]);
  const back = written(broken, repair[0]);
  assert.equal(back.ds, 2); assert.equal(back.door, 1); assert.equal(back.flags.animater.breakWall.broken, undefined);
  // and once repaired it can break again
  assert.equal(validWallBreakRequest({ cause: { kind: "smash" }, note: r.note }, { wall: back, scene: scene(), grid: 100, sender: { ...sender, isGM: true } }).ok, true);
});

test("Review Focus 5: a slam names a mover the sender neither owns nor stands beside", () => {
  const cause = { kind: "path", slam: { size: 2 }, moverUuid: "Scene.s.Token.ogre", path: { from: { x: 350, y: 100 }, to: { x: 350, y: 300 } } };
  const note = wallNoteFor({ wall: wall(), scene: scene(), cause, seed: 1, from: cause.path.from });
  const ogre = { x: 350, y: 100, size: 2, isOwner: false };
  const ask = (x) => validWallBreakRequest({ cause, note }, { wall: wall(), scene: scene(), grid: 100, sender, mover: ogre, ...x });
  // the player's own fighter stands across the map
  assert.equal(ask({ senderTokens: [{ x: 2000, y: 2000, w: 100, h: 100 }] }).why, "sender");
  assert.equal(ask({}).why, "sender");
  // the fighter stands next to the ogre and shoves it through the door
  assert.equal(ask({ senderTokens: [{ x: 400, y: 0, w: 100, h: 100 }] }).ok, true);
  // the GM may move anything
  assert.equal(ask({ sender: { ...sender, isGM: true } }).ok, true);
  // a player moving their own token
  assert.equal(ask({ mover: { ...ogre, isOwner: true } }).ok, true);
});

test("slamSenderOk: owner, or an owned footprint within 2 squares of the start", () => {
  const from = { x: 500, y: 500 };
  assert.equal(slamSenderOk({ sender: { isGM: true }, from, grid: 100 }), true);
  assert.equal(slamSenderOk({ sender, mover: { isOwner: true }, from, grid: 100 }), true);
  assert.equal(slamSenderOk({ sender, mover: { isOwner: false }, from, grid: 100 }), false);
  // footprint edge exactly 2 squares away counts; just beyond does not
  assert.equal(slamSenderOk({ sender, mover: {}, from, senderTokens: [{ x: 700, y: 450, w: 100, h: 100 }], grid: 100 }), true);
  assert.equal(slamSenderOk({ sender, mover: {}, from, senderTokens: [{ x: 701, y: 450, w: 100, h: 100 }], grid: 100 }), false);
  // a corner: the diagonal distance to the footprint, not per axis
  assert.equal(slamSenderOk({ sender, mover: {}, from, senderTokens: [{ x: 640, y: 640, w: 100, h: 100 }], grid: 100 }), true);
  assert.equal(slamSenderOk({ sender, mover: {}, from, senderTokens: [{ x: 650, y: 650, w: 100, h: 100 }], grid: 100 }), false);
  assert.equal(slamSenderOk({ sender, mover: {}, from: { x: NaN, y: 0 }, senderTokens: [{ x: 500, y: 500, w: 100, h: 100 }], grid: 100 }), false);
  assert.equal(slamSenderOk({ sender, mover: {}, from, senderTokens: [{ x: "a", y: 0, w: 1, h: 1 }], grid: 100 }), false);
});

test("Review fix: moving a broken door is not a hand edit; it keeps its note and Repair still restores it", () => {
  assert.equal(handEdited({ c: [310, 200, 410, 200] }, {}), false);
  const locked = wall({ ds: 2 });
  const r = validWallBreakRequest({ cause: { kind: "smash" }, note: wallNoteFor({ wall: locked, scene: scene(), cause: { kind: "smash" }, seed: 4, from: { x: 350, y: 100 } }) },
    { wall: locked, scene: scene(), grid: 100, sender: { ...sender, isGM: true } });
  const moved = { ...written(locked, r.update), c: [310, 200, 410, 200] };
  assert.ok(moved.flags.animater.breakWall.broken);
  assert.deepEqual(wallRepairUpdates([moved]), [{ _id: "d1", door: 1, ds: 2, move: 20, sight: 20, light: 20, sound: 20, "flags.animater.breakWall.-=broken": null }]);
});

// A Force Open roll message as the GM holds it: a door roll carries the flag; a PF2e sheet roll the action's option.
const d20 = (total, natural = 10) => ({ total, dice: [{ faces: 20, total: natural }] });
const sheetRoll = ({ author = "p", options = ["action:force-open"], outcome = null, dcValue = null, total = 16, rolls } = {}) =>
  ({ id: "m1", author: { id: author }, speaker: { token: "t1", scene: "s" }, rolls: rolls ?? [d20(total)], flags: { pf2e: { context: { options, outcome, dc: dcValue === null ? null : { value: dcValue } } } } });
const doorRoll = ({ author = "p", wallId = "d1", dc = 15, total = 16, rolls, extra = {} } = {}) =>
  ({ id: "m2", author: { id: author }, speaker: { token: "t1", scene: "s" }, rolls: rolls ?? [d20(total)], flags: { animater: { forceOpen: { wallId, dc, tokenId: "t1" }, ...extra } } });
const adjacent = { x: 300, y: 200, w: 100, h: 100, authorOwns: true };

test("Review Focus 5: a forged Force Open is refused", () => {
  const cause = { kind: "force-open", messageId: "m1" };
  const note = wallNoteFor({ wall: wall(), scene: scene(), cause, seed: 5, from: { x: 350, y: 250 } });
  const ask = (x) => validWallBreakRequest({ cause, note }, { wall: wall(), scene: scene(), grid: 100, sender, system: "pf2e", message: sheetRoll(), token: adjacent, walls: [wall()], ...x });
  // the message is not a Force Open, or is missing
  assert.equal(ask({ message: sheetRoll({ options: ["action:grapple"] }) }).why, "roll");
  assert.equal(ask({ message: undefined }).why, "roll");
  // a failed roll against the door's DC (PF2e wood: 15)
  assert.equal(ask({ message: sheetRoll({ outcome: "failure", dcValue: 15, total: 12 }) }).why, "outcome");
  assert.equal(ask({ message: sheetRoll({ total: 14 }) }).why, "outcome");
  // someone else's roll, or a token its author does not own
  assert.equal(ask({ message: sheetRoll({ author: "other" }) }).why, "sender");
  assert.equal(ask({ token: { ...adjacent, authorOwns: false } }).why, "sender");
  // the token stands 3 squares from the door
  assert.equal(ask({ token: { ...adjacent, y: 500 } }).why, "far");
  assert.equal(ask({ token: undefined }).why, "far");
  // another door is closer: this one is not the door that roll opens
  const below = { ...adjacent, y: 250 };
  assert.equal(ask({ token: below, walls: [wall()] }).ok, true);
  assert.equal(ask({ token: below, walls: [wall(), wall({ id: "d2", c: [300, 300, 400, 300] })] }).why, "far");
  // a metal door needs DC 20 now: 16 does not open it, 21 does (the DC carries the material)
  const metal = wall({ flags: { animater: { breakWall: { material: "metal" } } } });
  assert.equal(ask({ wall: metal, walls: [metal] }).why, "outcome");
  assert.equal(ask({ wall: metal, walls: [metal], message: sheetRoll({ total: 21 }) }).ok, true);
  // a door the GM set not to be forced open
  const shut = wall({ flags: { animater: { breakWall: { forceOpen: false } } } });
  assert.equal(ask({ wall: shut, walls: [shut], message: sheetRoll({ total: 30 }) }).why, "far");
  // "Doors and windows break" off
  assert.equal(ask({ scene: scene({ breakWalls: false }) }).why, "off");
  // a good roll and an adjacent token: the note remembers the message
  const r = ask({});
  assert.equal(r.ok, true);
  assert.equal(r.update.door, 0);
  assert.equal(r.note.material, "wood");
  assert.equal(r.note.mark, "dust");
  assert.equal(r.note.messageId, "m1");
  assert.equal(r.update["flags.animater.breakWall.broken"].messageId, "m1");
});

test("a roll from the door: the GM's DC from the wall, never the flag's", () => {
  const cause = { kind: "force-open", messageId: "m2" };
  const note = wallNoteFor({ wall: wall(), scene: scene(), cause, seed: 5, from: { x: 350, y: 250 } });
  const ask = (x) => validWallBreakRequest({ cause, note }, { wall: wall(), scene: scene(), grid: 100, sender, system: "dnd5e", message: doorRoll(), token: adjacent, walls: [wall()], ...x });
  assert.equal(ask({}).ok, true);
  // the flag claims DC 5; the wall's is 15
  assert.equal(ask({ message: doorRoll({ dc: 5, total: 10 }) }).why, "outcome");
  // the GM's own number on the wall wins over the default
  const hard = wall({ flags: { animater: { breakWall: { forceDC: 18 } } } });
  assert.equal(ask({ wall: hard, walls: [hard], message: doorRoll({ total: 17 }) }).why, "outcome");
  assert.equal(ask({ wall: hard, walls: [hard], message: doorRoll({ total: 18 }) }).ok, true);
  // the author does not own the token
  assert.equal(ask({ token: { ...adjacent, authorOwns: false } }).why, "sender");
  assert.equal(ask({ message: doorRoll({ author: "other" }) }).why, "sender");
  // the token stands 2 squares away
  assert.equal(ask({ token: { ...adjacent, y: 400 } }).why, "far");
  // the flag names another door
  assert.equal(ask({ message: doorRoll({ wallId: "d9" }) }).why, "far");
  // a door roll may name a door that is not the closest: it is the one the player clicked
  assert.equal(ask({ walls: [wall(), wall({ id: "d2", c: [300, 250, 400, 250] })] }).ok, true);
  // the message carries no roll
  assert.equal(ask({ message: doorRoll({ rolls: [] }) }).why, "roll");
  // the same message twice: the GM's mark on it, a door already broken by it, or this session's memory
  assert.equal(ask({ message: doorRoll({ extra: { forceOpenUsed: true } }) }).why, "used");
  assert.equal(ask({ walls: [wall(), wall({ id: "d3", flags: { animater: { breakWall: { broken: { messageId: "m2" } } } } })] }).why, "used");
  assert.equal(ask({ used: true }).why, "used");
  // the scene's switches off
  assert.equal(ask({ scene: scene({ breakWalls: false }) }).why, "off");
  assert.equal(ask({ scene: { id: "s", flags: {} } }).why, "off");
  // a system without a Force open roll here never breaks from a roll
  assert.equal(ask({ system: "crucible" }).why, "roll");
  // Draw Steel: the tier from the message
  assert.equal(ask({ system: "draw-steel", message: doorRoll({ rolls: [{ total: 13, product: 2 }] }) }).ok, true);
  const metal = wall({ flags: { animater: { breakWall: { material: "metal" } } } });
  assert.equal(ask({ system: "draw-steel", wall: metal, walls: [metal], message: doorRoll({ rolls: [{ total: 13, product: 2 }] }) }).why, "outcome");
});

const win = (extra = {}) => wall({ id: "w1", c: [300, 200, 400, 200], door: 0, flags: { animater: { breakWall: { window: true } } }, ...extra });
// The shooter's footprint (centre 350, 100) and the target's (centre 350, 325). The miss line (6a) flies 12 degrees off
// the line to the target's centre, 2 squares past it: it crosses the window at y = 200 near x 371.
const ATT = { x: 300, y: 50, w: 100, h: 100 }, TGT = { x: 325, y: 300, w: 50, h: 50 };
const A12 = 12 * Math.PI / 180, LINE = { from: { x: 350, y: 100 }, to: { x: 350 + Math.sin(A12) * 425, y: 100 + Math.cos(A12) * 425 } };
const miss = (outcome = "criticalFailure", damageType = "slashing", path = LINE) => ({ kind: "miss", damageType, outcome, targetUuid: "t", ...(path ? { path } : {}) });
const missReq = (w, cause) => ({ cause, note: wallNoteFor({ wall: w, scene: scene(), cause, seed: 3, from: LINE.from }) });
const missCtx = (w, x = {}) => ({ wall: w, walls: [w], scene: scene(), grid: 100, sender, attacker: ATT, target: TGT, roll: 1, ...x });

test("a ranged miss through a window: every miss breaks it, no chance roll (it flew through the glass); the line must cross it", () => {
  const w = win();
  const crit = validWallBreakRequest(missReq(w, miss()), missCtx(w));
  assert.equal(crit.ok, true);
  assert.equal(crit.note.kind, "window"); assert.equal(crit.note.material, "glass");
  assert.deepEqual([crit.update.sight, crit.update.light, crit.update.sound, "move" in crit.update, "door" in crit.update], [0, 20, 0, false, false]);
  assert.deepEqual(crit.update["flags.animater.breakWall.broken"].restore, { sight: 20, light: 20, sound: 20, windowKind: null });
  // a plain miss through the glass breaks it whatever the GM's roll or the scene's chance
  assert.equal(validWallBreakRequest(missReq(w, miss("miss")), missCtx(w, { roll: 0.1 })).ok, true);
  assert.equal(validWallBreakRequest(missReq(w, miss("miss")), missCtx(w, { roll: 0.9 })).ok, true);
  const never = scene({ propMissChance: 0 }), always = scene({ propMissChance: 100 });
  assert.equal(validWallBreakRequest(missReq(w, miss("miss")), missCtx(w, { scene: never, roll: 0.99 })).ok, true);
  assert.equal(validWallBreakRequest(missReq(w, miss("miss")), missCtx(w, { scene: always, roll: 0.99 })).ok, true);
  // a crit failure too; a hit or success is no miss (it breaks glass as "through")
  assert.equal(validWallBreakRequest(missReq(w, miss()), missCtx(w, { scene: never, roll: 0.99 })).ok, true);
  assert.equal(validWallBreakRequest(missReq(w, miss("success")), missCtx(w, { roll: 0 })).why, "lucky");
  // the line must start at the attacker and cross this window
  assert.equal(validWallBreakRequest(missReq(w, miss()), missCtx(w, { attacker: { x: 0, y: 50, w: 100, h: 100 } })).why, "far");
  assert.equal(validWallBreakRequest(missReq(w, miss("criticalFailure", "slashing", { from: LINE.from, to: { x: 700, y: 100 } })), missCtx(w)).why, "far");
  assert.equal(validWallBreakRequest(missReq(w, miss()), missCtx(w, { attacker: undefined })).why, "far");
  assert.equal(validWallBreakRequest(missReq(w, miss()), missCtx(w, { target: undefined })).why, "far");
  // only the first window on the line: a nearer one shields it
  const near = win({ id: "n", c: [300, 160, 400, 160] });
  assert.equal(validWallBreakRequest(missReq(w, miss()), missCtx(w, { walls: [w, near] })).why, "far");
  assert.equal(validWallBreakRequest(missReq(near, miss()), missCtx(near, { walls: [w, near] })).ok, true);
  // glass rules and Won't break
  assert.equal(validWallBreakRequest(missReq(w, miss("criticalFailure", "poison")), missCtx(w)).why, "material");
  const none = win({ flags: { animater: { breakWall: { window: true, material: "none" } } } });
  assert.equal(validWallBreakRequest(missReq(none, miss()), missCtx(none)).why, "material");
});
test("a miss only breaks a window, and not twice or off the target's level", () => {
  const door = wall({ c: [300, 200, 400, 200] });
  assert.equal(validWallBreakRequest(missReq(door, miss()), missCtx(door)).why, "kind");
  const w = win();
  assert.equal(validWallBreakRequest(missReq(w, miss()), missCtx(win({ flags: { animater: { breakWall: { window: true, broken: { seed: 1 } } } } }))).why, "broken");
  const up = win({ levels: ["ground"] });
  assert.equal(validWallBreakRequest(missReq(up, miss()), missCtx(up, { target: { ...TGT, level: "upstairs" } })).why, "far");
  assert.equal(validWallBreakRequest(missReq(up, miss()), missCtx(up, { target: { ...TGT, level: "ground" } })).ok, true);
});
// A strike that hit through glass: the attacker (centre 350, 100) and target (centre 350, 325) as above; the window at
// y = 200 lies across their centre line.
const through = (outcome = "success", damageType = "slashing") => ({ kind: "through", damageType, outcome, targetUuid: "t", attackerUuid: "a" });
test("a strike through a window breaks it always, hit or miss, read from the GM's own centre line", () => {
  const w = win();
  for (const outcome of ["success", "criticalSuccess", "miss", "criticalFailure"]) {
    const r = validWallBreakRequest(missReq(w, through(outcome)), missCtx(w, { roll: 0.99, scene: scene({ propMissChance: 0 }) }));
    assert.equal(r.ok, true, outcome);
    assert.equal(r.note.kind, "window"); assert.equal(r.update.sight, 0); assert.equal("door" in r.update, false);
  }
  // no strike outcome, no break
  for (const outcome of [null, "failure", "hit"]) assert.equal(validWallBreakRequest(missReq(w, through(outcome)), missCtx(w, { roll: 0 })).why, "lucky", String(outcome));
  // the GM's own line: an attacker or target elsewhere, or unknown (not the sender's token), is too far
  assert.equal(validWallBreakRequest(missReq(w, through()), missCtx(w, { attacker: { x: 0, y: 300, w: 100, h: 100 } })).why, "far");
  assert.equal(validWallBreakRequest(missReq(w, through()), missCtx(w, { attacker: undefined })).why, "far");
  assert.equal(validWallBreakRequest(missReq(w, through()), missCtx(w, { target: undefined })).why, "far");
  // a claimed line is never read
  assert.equal(validWallBreakRequest(missReq(w, { ...through(), path: { from: { x: 0, y: 0 }, to: { x: 1, y: 1 } } }), missCtx(w)).ok, true);
  // only the first window: a nearer one shields it
  const near = win({ id: "n", c: [300, 160, 400, 160] });
  assert.equal(validWallBreakRequest(missReq(w, through()), missCtx(w, { walls: [w, near] })).why, "far");
  assert.equal(validWallBreakRequest(missReq(near, through()), missCtx(near, { walls: [w, near] })).ok, true);
  // glass rules and Won't break
  assert.equal(validWallBreakRequest(missReq(w, through("success", "poison")), missCtx(w)).why, "material");
  const none = win({ flags: { animater: { breakWall: { window: true, material: "none" } } } });
  assert.equal(validWallBreakRequest(missReq(none, through()), missCtx(none)).why, "material");
  // only windows, on the target's level, once, with the scene's switches on, from a sender viewing the scene
  const door = wall({ c: [300, 200, 400, 200] });
  assert.equal(validWallBreakRequest(missReq(door, through()), missCtx(door)).why, "kind");
  const up = win({ levels: ["ground"] });
  assert.equal(validWallBreakRequest(missReq(up, through()), missCtx(up, { target: { ...TGT, level: "upstairs" } })).why, "far");
  assert.equal(validWallBreakRequest(missReq(up, through()), missCtx(up, { target: { ...TGT, level: "ground" } })).ok, true);
  assert.equal(validWallBreakRequest(missReq(w, through()), missCtx(win({ flags: { animater: { breakWall: { window: true, broken: { seed: 1 } } } } }))).why, "broken");
  assert.equal(validWallBreakRequest(missReq(w, through()), missCtx(w, { scene: scene({ breakWalls: false }) })).why, "off");
  assert.equal(validWallBreakRequest(missReq(w, through()), missCtx(w, { scene: { id: "s", flags: {} } })).why, "off");
  assert.equal(validWallBreakRequest(missReq(w, through()), missCtx(w, { sender: null })).why, "sender");
  assert.equal(validWallBreakRequest(missReq(w, through()), missCtx(w, { sender: { ...sender, viewedScene: "other" } })).why, "scene");
});
test("breaksSure: what the requester may show at once (no GM chance roll to wait for)", () => {
  const w = win(), past = win({ id: "past", c: [300, 380, 400, 380] });
  assert.equal(breaksSure(through("success"), w, ATT, TGT), true);
  assert.equal(breaksSure(through("miss"), w, ATT, TGT), true);
  assert.equal(breaksSure(miss("miss"), w, ATT, TGT), true); // a ranged miss line through the glass
  assert.equal(breaksSure(miss("miss", "bludgeoning", null), w, ATT, TGT), true); // the swing goes through it
  assert.equal(breaksSure(miss("miss", "bludgeoning", null), past, ATT, TGT), false); // beside the target: the GM's roll
  assert.equal(breaksSure(miss("criticalFailure", "bludgeoning", null), past, ATT, TGT), true);
  assert.equal(breaksSure(miss("miss", "bludgeoning", null), past, undefined, TGT), false);
  assert.equal(breaksSure({ kind: "area" }, w), true);
});
test("cleanWallCause keeps the attacker a miss names", () => {
  assert.equal(cleanWallCause({ kind: "miss", attackerUuid: "Scene.s.Token.a", outcome: "miss" }).attackerUuid, "Scene.s.Token.a");
});

// Powder kegs (Task 12): a blast breaks doors and windows in its burst, the GM's only.
import { canBreakWall, wallTraits } from "../../../scripts/engines/props/wall-break.mjs";
const kegAt = (cx, cy, powder = "exploded", burst = 2, extra = {}) => ({ id: "keg", x: cx - 50, y: cy - 50, width: 100, height: 100, hidden: true, levels: [], texture: { src: "Keg_Powder.webp" },
  flags: { animater: { prop: { broken: { seed: 1, powder, burst } } } }, ...extra });
const gmSender = { id: "gm", viewedScene: "s", isGM: true };
const blastWallReq = (w = wall()) => ({ cause: { kind: "blast", sourceId: "keg" }, note: wallNoteFor({ wall: w, scene: scene(), cause: { damageType: "fire" }, seed: 9, from: { x: 350, y: 300 } }) });

test("canBreakWall: a blast breaks any door or window but Won't break", () => {
  for (const material of ["wood", "metal", "stone"]) assert.equal(canBreakWall({ kind: "door", material }, { blast: true }), true, material);
  assert.equal(canBreakWall({ kind: "window", material: "glass" }, { blast: true }), true);
  assert.equal(canBreakWall({ kind: "window", material: "none" }, { blast: true }), false);
  assert.equal(canBreakWall({ kind: null, material: "wood" }, { blast: true }), false);
  assert.equal(canBreakWall({ kind: "door", material: "metal" }, { damageType: "fire" }), false, "no blast, the old rule");
});

test("a blast breaks a door in its burst: the GM's only, from a keg that exploded", () => {
  // Review Focus 5: a player's blast
  const ctx = (extra = {}) => ({ wall: wall(), scene: scene(), grid: 100, sender: gmSender, source: kegAt(350, 300), ...extra });
  assert.deepEqual(validWallBreakRequest(blastWallReq(), ctx({ sender })), { ok: false, why: "sender" });
  // the source only spilled, never broke, or is missing
  assert.deepEqual(validWallBreakRequest(blastWallReq(), ctx({ source: kegAt(350, 300, "spilled") })), { ok: false, why: "far" });
  assert.deepEqual(validWallBreakRequest(blastWallReq(), ctx({ source: { ...kegAt(350, 300), flags: {} } })), { ok: false, why: "far" });
  assert.deepEqual(validWallBreakRequest(blastWallReq(), ctx({ source: undefined })), { ok: false, why: "far" });
  // midpoint 2.5 squares from a 2-square burst; a 3-square burst reaches it
  assert.deepEqual(validWallBreakRequest(blastWallReq(), ctx({ source: kegAt(350, 450) })), { ok: false, why: "far" });
  assert.equal(validWallBreakRequest(blastWallReq(), ctx({ source: kegAt(350, 450, "exploded", 3) })).ok, true);
  // on another level than the blast
  assert.deepEqual(validWallBreakRequest(blastWallReq(wall({ levels: ["up"] })), ctx({ wall: wall({ levels: ["up"] }), levels: ["ground"] })), { ok: false, why: "far" });
  // good: a metal door too, while the GM views another scene; the note is scorched
  const iron = wall({ flags: { animater: { breakWall: { material: "metal" } } } });
  const r = validWallBreakRequest(blastWallReq(iron), ctx({ wall: iron, sender: { ...gmSender, viewedScene: "other" } }));
  assert.equal(r.ok, true);
  assert.equal(r.update.door, 0);
  assert.equal(r.note.material, "metal");
  assert.equal(r.note.mark, "scorch");
  // a door set Never, a window set Won't break
  assert.deepEqual(validWallBreakRequest(blastWallReq(), ctx({ wall: wall({ flags: { animater: { breakWall: { door: "never" } } } }) })), { ok: false, why: "kind" });
  const pane = wall({ door: 0, flags: { animater: { breakWall: { window: true, material: "none" } } } });
  assert.deepEqual(validWallBreakRequest(blastWallReq(pane), ctx({ wall: pane })), { ok: false, why: "material" });
  const glass = wall({ door: 0, flags: { animater: { breakWall: { window: true } } } });
  assert.equal(wallTraits(glass, scene()).kind, "window");
  const g = validWallBreakRequest(blastWallReq(glass), ctx({ wall: glass }));
  assert.equal(g.ok, true);
  assert.equal(g.update.sight, 0);
  assert.equal(g.update.move, undefined, "a broken window still blocks movement");
});

test("two blasts reach one door: the second is refused as broken", () => {
  const ctx = (w) => ({ wall: w, scene: scene(), grid: 100, sender: gmSender, source: kegAt(350, 300) });
  const first = validWallBreakRequest(blastWallReq(), ctx(wall()));
  assert.equal(first.ok, true);
  const broken = written(wall(), first.update);
  assert.deepEqual(validWallBreakRequest(blastWallReq(broken), ctx(broken)), { ok: false, why: "broken" });
});

test("a blast cause from the socket keeps its source tile", () => {
  assert.deepEqual(cleanWallCause({ kind: "blast", sourceId: "keg", junk: true }), { kind: "blast", sourceId: "keg" });
});

test("I1: a forged area door break is refused: no area, another scene's, one not covering the door, another player's, an old one, another level", () => {
  const cause = { kind: "area", areaUuid: AREA, damageType: "force", at: { x: 350, y: 200 } };
  const req = { cause, note: wallNoteFor({ wall: wall(), cause, seed: 7, from: { x: 350, y: 100 } }) };
  const ctx = (x = {}) => ({ wall: wall({ ds: 2, flags: { animater: { breakWall: { material: "metal" } } } }), scene: scene(), grid: 100, sender, ...placed, ...x });
  assert.equal(validWallBreakRequest(req, ctx()).ok, true); // force breaks a locked metal door, from a real area over it
  // the console forgery: kind "area", force, at the door's middle, but no real area
  assert.equal(validWallBreakRequest({ ...req, cause: { kind: "area", damageType: "force", at: { x: 350, y: 200 } } }, ctx()).why, "area");
  assert.equal(validWallBreakRequest(req, ctx({ area: undefined })).why, "area");
  assert.equal(validWallBreakRequest(req, ctx({ area: covering({ sceneId: "other" }) })).why, "area");
  assert.equal(validWallBreakRequest(req, ctx({ area: covering({ testPoint: (p) => p.x > 1000 }) })).why, "area");
  assert.equal(validWallBreakRequest(req, ctx({ area: covering({ authorId: "q" }) })).why, "area");
  assert.equal(validWallBreakRequest(req, ctx({ now: 1000 + 600001 })).why, "area");
  // M2: the area is on another level than the door
  assert.equal(validWallBreakRequest(req, ctx({ wall: wall({ levels: ["ground"] }), area: covering({ levels: ["upstairs"] }) })).why, "area");
  // the door's own middle (350, 200) is what the GM tests
  const seen = [];
  validWallBreakRequest(req, ctx({ area: covering({ testPoint: (p) => { seen.push(p); return true; } }) }));
  assert.deepEqual(seen, [{ x: 350, y: 200 }]);
  // the GM's own call naming no area (debug.breakWall) keeps its reach from at
  const gm = { id: "g", viewedScene: "s", isGM: true }, own = { cause: { kind: "area", damageType: "force", at: { x: 350, y: 100 } }, note: req.note };
  assert.equal(validWallBreakRequest(own, ctx({ sender: gm, area: undefined })).ok, true);
  assert.equal(validWallBreakRequest({ ...own, cause: { ...own.cause, at: { x: 350 + 3200, y: 100 } } }, ctx({ sender: gm, area: undefined })).why, "far");
});

test("cleanWallCause keeps the area a cause names", () => {
  assert.equal(cleanWallCause({ kind: "area", areaUuid: "Scene.s.Region.r" }).areaUuid, "Scene.s.Region.r");
  assert.equal(cleanWallCause({ kind: "area", areaUuid: 5 }).areaUuid, undefined);
});

test("6a: a ranged miss line must fit the shot: from the attacker, near the target, at most the distance plus 3 squares", () => {
  const w = win();
  // a forged line from elsewhere, one far from the target, one too long
  assert.equal(validWallBreakRequest(missReq(w, miss("criticalFailure", "slashing", { from: { x: 350, y: 180 }, to: LINE.to })), missCtx(w)).why, "far");
  assert.equal(validWallBreakRequest(missReq(w, miss("criticalFailure", "slashing", { from: LINE.from, to: { x: 1000, y: 300 } })), missCtx(w)).why, "far");
  const long = { from: LINE.from, to: { x: 350 + Math.sin(A12) * 600, y: 100 + Math.cos(A12) * 600 } }; // 225 + 300 = 525 at most
  assert.equal(validWallBreakRequest(missReq(w, miss("criticalFailure", "slashing", long)), missCtx(w)).why, "far");
  // the attacker must be known (a token the sender owns)
  assert.equal(validWallBreakRequest(missReq(w, miss()), missCtx(w, { attacker: { x: 350, y: 100 } })).why, "far");
});

test("6b: a melee miss breaks a window beside its target, never on the attacker's side, by the same miss rules", () => {
  // the attacker at (350, 100) swings south at the target (325..375, 300..350); a window just past it at y = 380
  const past = win({ id: "past", c: [300, 380, 400, 380] }), mine = win({ id: "mine", c: [420, 230, 470, 230] }); // within a square of the target, but on the attacker's side and off the line
  const through = win({ id: "through", c: [300, 250, 400, 250] });
  const swing = (outcome = "criticalFailure") => miss(outcome, "bludgeoning", null);
  assert.equal(validWallBreakRequest(missReq(past, swing()), missCtx(past)).ok, true);
  assert.equal(validWallBreakRequest(missReq(through, swing()), missCtx(through)).ok, true); // the swing goes through it
  // a plain miss through the glass breaks it always; the chance is only for a window beside the target
  assert.equal(validWallBreakRequest(missReq(through, swing("miss")), missCtx(through, { roll: 0.99, scene: scene({ propMissChance: 0 }) })).ok, true);
  assert.equal(validWallBreakRequest(missReq(mine, swing()), missCtx(mine)).why, "far"); // the attacker's side, off the swing's line
  const away = win({ id: "away", c: [700, 380, 800, 380] });
  assert.equal(validWallBreakRequest(missReq(away, swing()), missCtx(away)).why, "far"); // more than a square from it
  // a plain miss by the scene's chance, rolled by the GM; glass rules
  assert.equal(validWallBreakRequest(missReq(past, swing("miss")), missCtx(past, { roll: 0.1 })).ok, true);
  assert.equal(validWallBreakRequest(missReq(past, swing("miss")), missCtx(past, { roll: 0.9 })).why, "lucky");
  assert.equal(validWallBreakRequest(missReq(past, miss("criticalFailure", "poison", null)), missCtx(past)).why, "material");
  // the target's level
  const up = win({ id: "up", c: [300, 380, 400, 380], levels: ["ground"] });
  assert.equal(validWallBreakRequest(missReq(up, swing()), missCtx(up, { target: { ...TGT, level: "upstairs" } })).why, "far");
});

// Attacking a door (door-attack.mjs): the hit that takes its last HP breaks it through this relay, cause "attack".
const d20a = (total, natural = 10) => ({ total, dice: [{ faces: 20, total: natural, results: [{ result: natural, active: true }] }] });
const strikeMsgs = ({ total = 20 } = {}) => ({
  attack: { id: "a1", author: { id: "p" }, rolls: [d20a(15)], flags: { pf2e: { context: { type: "attack-roll", identifier: "it.longsword.melee", actor: "act" } }, animater: { doorAttack: { wallId: "d1", tokenId: "t1" } } } },
  damage: { id: "m1", author: { id: "p" }, rolls: [{ total }], flags: { pf2e: { context: { type: "damage-roll", sourceType: "attack", actor: "act", outcome: "success" }, origin: { uuid: "Actor.act.Item.it" } }, animater: { doorAttack: { wallId: "d1", tokenId: "t1", attackId: "a1" } } } },
});
const attackPlace = (over = {}) => ({ ...strikeMsgs(over), token: { x: 300, y: 200, w: 100, h: 100, authorOwns: true, actorId: "act" }, strike: { ranged: false, feet: 5 }, sight: true, system: "pf2e" });
const attackNote = (w) => wallNoteFor({ wall: w, scene: scene(), cause: { kind: "attack" }, seed: 9, from: { x: 350, y: 250 } });

test("attack: the hit that takes a door's last HP breaks it, its HP and the rolls kept on the wall", () => {
  const w = wall({ flags: { animater: { breakWall: { hp: 6 } } } });
  const r = validWallBreakRequest({ cause: { kind: "attack", messageId: "m1" }, note: attackNote(w) }, { wall: w, scene: scene(), grid: 100, sender, ...attackPlace() });
  assert.equal(r.ok, true);
  assert.equal(r.note.kind, "door");
  assert.equal(r.note.messageId, "m1");
  assert.equal(r.update.door, 0);
  assert.equal(r.update["flags.animater.breakWall.hp"], 0);
  assert.deepEqual(r.update["flags.animater.breakWall.hits"], ["a1", "m1"]);
});

test("attack: a hit that leaves HP, a refused hit, a window or another system does not break it", () => {
  const ask = (w, over = {}, place = {}) => validWallBreakRequest({ cause: { kind: "attack", messageId: "m1" }, note: attackNote(w) }, { wall: w, scene: scene(), grid: 100, sender, ...attackPlace(), ...place, ...over });
  assert.equal(ask(wall()).why, "hp"); // 20 - (20 - 5) = 5 left
  assert.equal(ask(wall({ flags: { animater: { breakWall: { hp: 6 } } } }), {}, { token: { x: 300, y: 600, w: 100, h: 100, authorOwns: true, actorId: "act" } }).why, "far");
  assert.equal(ask(wall({ flags: { animater: { breakWall: { hp: 6, hits: ["m1"] } } } })).why, "used");
  // a roll already applied to another door of the scene
  assert.equal(ask(wall({ flags: { animater: { breakWall: { hp: 6 } } } }), { walls: [wall({ id: "d2", flags: { animater: { breakWall: { hits: ["a1"] } } } })] }).why, "used");
  assert.equal(ask(wall({ flags: { animater: { breakWall: { hp: 6 } } } }), { system: "dnd5e" }).why, "system");
  assert.equal(ask(wall({ door: 0, flags: { animater: { breakWall: { window: true, hp: 6 } } } })).why, "kind");
  // a whole door breaks from one huge hit
  assert.equal(ask(wall(), {}, strikeMsgs({ total: 40 })).ok, true);
});

test("a hand-edited broken door forgets its HP too", () => {
  const w = wall({ door: 2, flags: { animater: { breakWall: { hp: 0, broken: { seed: 1 } } } } });
  assert.deepEqual(handEditUpdate(w), { _id: "d1", "flags.animater.breakWall.-=broken": null, "flags.animater.breakWall.-=hp": null });
});
