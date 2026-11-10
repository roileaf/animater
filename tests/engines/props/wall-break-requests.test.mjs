import test from "node:test";
import assert from "node:assert/strict";
import { WALL_BREAK_MESSAGE, cleanWallCause, wallNoteFor, validWallBreakRequest, handEdited, handEditUpdate, slamSenderOk } from "../../../scripts/engines/props/wall-break-requests.mjs";
import { readWallNote, wallRepairUpdates } from "../../../scripts/engines/props/wall-break.mjs";
import { PATH_SQUARES } from "../../../scripts/engines/props/prop-requests.mjs";

const scene = (f = {}) => ({ id: "s", flags: { animater: { breakableProps: true, ...f } } });
const wall = (extra = {}) => ({ id: "d1", c: [300, 200, 400, 200], door: 1, ds: 0, move: 20, sight: 20, light: 20, sound: 20, levels: [], flags: {}, ...extra });
const sender = { id: "p", viewedScene: "s", isGM: false };
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
  const note = wallNoteFor({ wall: wall(), cause: { kind: "area", damageType: "fire", at: { x: 350, y: 100 } }, seed: 7, from: { x: 350, y: 100 } });
  const r = validWallBreakRequest({ cause: { kind: "area", damageType: "fire", at: { x: 350, y: 100 } }, note }, { wall: wall(), scene: scene(), grid: 100, sender });
  assert.equal(r.ok, true); assert.equal(r.update.door, 0); assert.equal(r.note.material, "wood");
  assert.equal(r.note.kind, "door"); assert.equal(r.note.mark, "scorch"); assert.equal(r.note.seed, 7);
  assert.deepEqual(r.update, { _id: "d1", door: 0, ds: 0, move: 0, sight: 0, light: 0, sound: 0,
    "flags.animater.breakWall.broken": { ...r.note, restore: { door: 1, ds: 0, move: 20, sight: 20, light: 20, sound: 20 } } });
});

test("refused, each with its own why", () => {
  const req = (cause) => ({ cause, note: wallNoteFor({ wall: wall(), cause, seed: 7, from: { x: 350, y: 100 } }) });
  const area = req({ kind: "area", damageType: "fire", at: { x: 350, y: 100 } });
  const ctx = (x = {}) => ({ wall: wall(), scene: scene(), grid: 100, sender, ...x });
  assert.equal(validWallBreakRequest(area, ctx({ scene: { id: "s", flags: {} } })).why, "off");
  assert.equal(validWallBreakRequest(area, ctx({ scene: scene({ breakWalls: false }) })).why, "kind");
  assert.equal(validWallBreakRequest(area, ctx({ wall: wall({ flags: { animater: { breakWall: { broken: area.note } } } }) })).why, "broken");
  assert.equal(validWallBreakRequest(area, ctx({ wall: wall({ door: 0 }) })).why, "kind");
  assert.equal(validWallBreakRequest(req({ kind: "area", damageType: "piercing", at: { x: 350, y: 100 } }), ctx()).why, "material");
  assert.equal(validWallBreakRequest(req({ kind: "area", damageType: "fire", at: { x: 350 + 31 * 100, y: 100 } }), ctx()).why, "far");
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
  const cause = { kind: "area", damageType: "bludgeoning", at: { x: 350, y: 100 } };
  const forged = { seed: 9, cutAngle: 0.5, from: { x: 350, y: 120 }, kind: "door", material: "stone", mark: "scorch" };
  const r = validWallBreakRequest({ cause, note: forged }, { wall: wall({ flags: { animater: { breakWall: { material: "wood" } } } }), scene: scene(), grid: 100, sender });
  assert.equal(r.ok, true);
  assert.deepEqual(r.note, { seed: 9, cutAngle: 0.5, from: { x: 350, y: 120 }, kind: "door", material: "wood", mark: "dust" });
  assert.deepEqual(readWallNote(r.update["flags.animater.breakWall.broken"]).restore, { door: 1, ds: 0, move: 20, sight: 20, light: 20, sound: 20 });
});

test("wallNoteFor cuts from the blow to the wall's middle and reads kind and material from the scene", () => {
  const n = wallNoteFor({ wall: wall({ flags: { animater: { breakWall: { material: "metal" } } } }), scene: scene(), cause: { kind: "area", damageType: "force" }, seed: 3, from: { x: 350, y: 100 } });
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
