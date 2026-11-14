import test from "node:test";
import assert from "node:assert/strict";
import { smokeRegionData, concealmentPlan } from "../../../scripts/engines/props/smoke-regions.mjs";

const TRI = [{ type: "polygon", points: [0, 0, 100, 0, 100, 100] }];
const O = { x: 50, y: 40 };
const TYPE = "pf2e-visioner.Pf2eVisionerConcealment";

test("the region carries visioner's concealment behaviour, tagged smoke", () => {
  const d = smokeRegionData(TRI, { levels: ["abcdEFGH12345678"], origin: O, visioner: true });
  const b = d.behaviors.find((x) => x.type === TYPE);
  assert.ok(b, "the behaviour is present");
  assert.equal(b.system.sourceTags, "smoke");
  assert.equal(b.system.enabled, true);
});

test("core's sight clip is off, with or without visioner: the smoke's own fence would clip the halo away", () => {
  for (const visioner of [true, false]) {
    const d = smokeRegionData(TRI, { levels: ["abcdEFGH12345678"], origin: O, visioner });
    assert.equal(d.restriction.enabled, false);
  }
});

test("it is flagged as ours so Repair can find it", () => {
  const d = smokeRegionData([], { levels: ["abcdEFGH12345678"], origin: O, visioner: true });
  assert.ok(d.flags.animater.smokeRegion);
});

test("shapes and levels pass through, as copies", () => {
  const d = smokeRegionData(TRI, { levels: ["abcdEFGH12345678"], origin: O, visioner: true });
  assert.deepEqual(d.shapes, [{ ...TRI[0], origin: O }]);
  assert.notEqual(d.shapes[0], TRI[0]);
  assert.deepEqual(d.levels, ["abcdEFGH12345678"]);
});

test("without visioner it carries no behaviour at all", () => {
  const d = smokeRegionData([], { levels: ["abcdEFGH12345678"], origin: O, visioner: false });
  assert.deepEqual(d.behaviors, []);
  assert.equal(smokeRegionData([], { levels: ["abcdEFGH12345678"], origin: O }).behaviors.length, 0, "missing visioner degrades to none");
});

test("never writes the concealed condition anywhere", () => {
  for (const visioner of [true, false]) {
    const s = JSON.stringify(smokeRegionData(TRI, { levels: ["abcdEFGH12345678"], origin: O, visioner }));
    assert.doesNotMatch(s, /concealed|statusEffects|ActiveEffect|condition/i);
  }
});

test("concealmentPlan prefers the behaviour, then the api, then nothing", () => {
  assert.equal(concealmentPlan({ visionerActive: true }).how, "behaviour");
  assert.equal(concealmentPlan({ visionerActive: true, visionerApi: true }).how, "behaviour");
  assert.equal(concealmentPlan({ visionerActive: false, visionerApi: true }).how, "api");
  assert.equal(concealmentPlan({ visionerActive: false }).how, "none");
  assert.equal(concealmentPlan({}).how, "none");
  assert.equal(concealmentPlan().how, "none");
});

test("visioner disabled mid-session degrades to none without throwing", () => {
  assert.doesNotThrow(() => concealmentPlan({ visionerActive: false, visionerApi: false }));
  assert.equal(concealmentPlan({ visionerActive: false, visionerApi: false }).how, "none");
});

test("the plan and the data agree: behaviour only when the plan says behaviour", () => {
  for (const visionerActive of [true, false]) {
    const d = smokeRegionData(TRI, { levels: ["abcdEFGH12345678"], origin: O, visioner: visionerActive });
    assert.equal(d.behaviors.length > 0, concealmentPlan({ visionerActive }).how === "behaviour");
  }
});

test("every shape carries the fire's origin explicitly, not the centroid", () => {
  const d = smokeRegionData([...TRI, { type: "polygon", points: [200, 0, 300, 0, 300, 100] }], { levels: ["abcdEFGH12345678"], origin: O, visioner: true });
  for (const s of d.shapes) assert.deepEqual(s.origin, O);
  assert.deepEqual(TRI[0].origin, undefined, "input is not mutated");
});

test("an origin is optional, but when given it must be finite", () => {
  assert.equal(smokeRegionData(TRI, { levels: ["abcdEFGH12345678"], visioner: true }).shapes[0].origin, undefined);
  assert.throws(() => smokeRegionData(TRI, { levels: ["abcdEFGH12345678"], origin: { x: NaN, y: 1 } }), /origin/);
  assert.throws(() => smokeRegionData(TRI, { levels: ["abcdEFGH12345678"], origin: null }), /origin/);
});

test("any number of levels is fine, since there is no clip to skip", () => {
  assert.deepEqual(smokeRegionData(TRI, { levels: [], origin: O }).levels, []);
  assert.deepEqual(smokeRegionData(TRI, { origin: O }).levels, []);
  assert.equal(smokeRegionData(TRI, { levels: ["abcdEFGH12345678", "bbcdEFGH12345678"], origin: O }).levels.length, 2);
});

test("visioner must be exactly true; strings and objects get no behaviour", () => {
  for (const v of ["false", "x", {}, 1, null, undefined]) {
    assert.deepEqual(smokeRegionData(TRI, { levels: ["abcdEFGH12345678"], origin: O, visioner: v }).behaviors, [], String(v));
  }
  for (const v of ["false", "x", {}, 1]) assert.equal(concealmentPlan({ visionerActive: v }).how, "none");
});

test("null options make a bare region, and the plan never throws", () => {
  assert.deepEqual(smokeRegionData([], null).levels, []);
  assert.equal(concealmentPlan(null).how, "none");
});

test("every level must be a valid 16-character document id", () => {
  for (const bad of [null, undefined, "", 0, "L1", "abcdEFGH1234567", "abcdEFGH123456789", "abcdEFGH1234567-", {}]) {
    assert.throws(() => smokeRegionData(TRI, { levels: [bad], origin: O }), /document id/, String(bad));
  }
  assert.throws(() => smokeRegionData(TRI, { levels: "abcdEFGH12345678" }), /array/);
  assert.doesNotThrow(() => smokeRegionData(TRI, { levels: ["0123456789abcdef"], origin: O }));
});

// ---- Picking regions out of a scene the canvas has not drawn. ----
// viewedRegions filters on a region's `viewed`, which needs the scene's own `_view`: only the CANVAS scene has one, so
// off-canvas every region answers false and that filter returns nothing. The round runs on every scene with a fire on
// it, so these helpers say what they mean instead — the flag, and the level.
import { regionsOnLevel, ownSmokeRegion, skyRegionsOf, smokeRegionPlan, CONCEALMENT_BEHAVIOUR } from "../../../scripts/engines/props/smoke-regions.mjs";
import { viewedRegions } from "../../../scripts/core/viewed-regions.mjs";

const A = "aaaaaaaaaaaaaaaa", B = "bbbbbbbbbbbbbbbb";
const SQUARE = [{ type: "rectangle", x: 0, y: 0, width: 100, height: 100 }];
const OTHER = [{ type: "rectangle", x: 100, y: 0, width: 100, height: 100 }];
// A region as it really is on a scene nobody is standing in: `viewed` is false for every one of them.
const off = (own) => ({ viewed: false, levels: [], shapes: [], behaviors: [], ...own });
const ours = (own) => off({ id: "mine", flags: { animater: { smokeRegion: true } }, ...own });

test("our region is found on a scene the canvas has not drawn, where viewedRegions finds nothing", () => {
  const regions = [ours(), off({ id: "else" })];
  assert.deepEqual(viewedRegions(regions), [], "the drawing helper cannot see any of them");
  assert.equal(ownSmokeRegion(regions)?.id, "mine");
  assert.equal(ownSmokeRegion([off({ id: "else" })]), null);
  assert.equal(ownSmokeRegion(undefined), null);
  // An EmbeddedCollection is iterable, not an array.
  assert.equal(ownSmokeRegion(new Set([ours()]))?.id, "mine");
});

test("a region on another level does not reach this level's smoke", () => {
  const mine = ours({ id: "upstairs", levels: [B] });
  assert.equal(ownSmokeRegion([mine], { level: A }), null, "ours, but on another floor");
  assert.equal(ownSmokeRegion([mine], { level: B })?.id, "upstairs");
  // A region naming no level at all is on every floor, as Foundry reads an empty SetField.
  assert.equal(ownSmokeRegion([ours({ levels: [] })], { level: A })?.id, "mine");
  // With no level to compare against, nothing can be told apart, so all of them count.
  assert.equal(ownSmokeRegion([mine], { level: null })?.id, "upstairs");
  // The same rule for the holes in the roof, and for the plain filter the indoor rooms use.
  const shaft = off({ id: "shaft", levels: [B], flags: { animater: { openSky: true } } });
  assert.deepEqual(skyRegionsOf([shaft], { level: A }), []);
  assert.deepEqual(skyRegionsOf([shaft], { level: B }).map((r) => r.id), ["shaft"]);
  assert.deepEqual(skyRegionsOf([off({ id: "plain" })], { level: B }), [], "not marked open to the sky");
  assert.deepEqual(regionsOnLevel([shaft, off({ id: "any" })], A).map((r) => r.id), ["any"]);
  assert.deepEqual(regionsOnLevel([shaft], null).map((r) => r.id), ["shaft"], "no level: no say");
  assert.deepEqual(regionsOnLevel(new Set([shaft]), B).map((r) => r.id), ["shaft"]);
});

test("two rounds on a scene nobody is looking at make ONE region, not two", () => {
  // Round one: nothing of ours there, so it is created.
  const first = smokeRegionPlan([off({ id: "else" })], SQUARE, { level: A, visioner: true });
  assert.deepEqual(first.remove, []);
  assert.deepEqual(first.update, []);
  assert.equal(first.create.length, 1);
  assert.equal(first.create[0].flags.animater.smokeRegion, true);
  // The scene as it stands after that write: our region, as it really reads off-canvas.
  const made = ours({ levels: [...first.create[0].levels], shapes: [...first.create[0].shapes], behaviors: first.create[0].behaviors });
  const scene = [off({ id: "else" }), made];
  // Round two, with the smoke grown: found and UPDATED. Nothing created, so there is still one region.
  const second = smokeRegionPlan(scene, [...SQUARE, ...OTHER], { level: A, visioner: true });
  assert.deepEqual(second.create, [], "a second region would be the spam this fixes");
  assert.deepEqual(second.remove, []);
  assert.equal(second.update.length, 1);
  assert.equal(second.update[0]._id, "mine");
  assert.equal(second.update[0].shapes.length, 2);
  // Round three, unchanged: nothing at all is written.
  assert.deepEqual(smokeRegionPlan(scene, SQUARE, { level: A, visioner: true }), { remove: [], create: [], update: [] });
});

test("the last of the smoke takes the region with it, on any scene", () => {
  const scene = [off({ id: "else" }), ours()];
  // This is the leftover pass: a switch has gone off, so the plan clears and its shapes are empty.
  for (const shapes of [[], null, undefined]) {
    assert.deepEqual(smokeRegionPlan(scene, shapes, { level: null }), { remove: ["mine"], create: [], update: [] });
  }
  // Nothing of ours to take away: nothing asked for.
  assert.deepEqual(smokeRegionPlan([off({ id: "else" })], []), { remove: [], create: [], update: [] });
});

test("the concealment coming or going remakes the region; removals go before creations", () => {
  const withIt = ours({ behaviors: [{ type: CONCEALMENT_BEHAVIOUR }], shapes: [...SQUARE] });
  const without = ours({ behaviors: [], shapes: [...SQUARE] });
  // visioner gone: the region it carried must be remade without it.
  const lost = smokeRegionPlan([withIt], SQUARE, { visioner: false });
  assert.deepEqual(lost.remove, ["mine"]);
  assert.equal(lost.create.length, 1);
  assert.deepEqual(lost.create[0].behaviors, []);
  // visioner arrived: likewise.
  const found = smokeRegionPlan([without], SQUARE, { visioner: true });
  assert.deepEqual(found.remove, ["mine"]);
  assert.equal(found.create[0].behaviors[0].type, CONCEALMENT_BEHAVIOUR);
  assert.deepEqual(found.update, [], "never an update beside a remake");
});

test("a changed level alone is enough to write, and the plan touches nothing it is given", () => {
  const scene = [ours({ levels: [B], shapes: [...SQUARE] })];
  const moved = smokeRegionPlan(scene, SQUARE, { level: null });
  assert.equal(moved.update.length, 1, "the level it names has changed");
  assert.deepEqual(moved.update[0].levels, []);
  const before = JSON.stringify(scene);
  smokeRegionPlan(scene, OTHER, { level: A });
  assert.equal(JSON.stringify(scene), before, "pure: the regions are read, never touched");
});
