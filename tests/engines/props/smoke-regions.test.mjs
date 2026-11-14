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
  const quiet = smokeRegionPlan(scene, SQUARE, { level: A, visioner: true });
  assert.deepEqual([quiet.steps, quiet.remove, quiet.create, quiet.update], [[], [], [], []]);
});

test("the last of the smoke takes the region with it, on any scene", () => {
  const scene = [off({ id: "else" }), ours()];
  // This is the leftover pass: a switch has gone off, so the plan clears and its shapes are empty.
  for (const shapes of [[], null, undefined]) {
    const gone = smokeRegionPlan(scene, shapes, { level: null });
    assert.deepEqual([gone.remove, gone.create, gone.update], [["mine"], [], []], JSON.stringify(shapes));
    assert.deepEqual(gone.steps, [{ kind: "remove", ids: ["mine"] }]);
  }
  // Nothing of ours to take away: nothing asked for.
  const none = smokeRegionPlan([off({ id: "else" })], []);
  assert.deepEqual([none.steps, none.remove, none.create, none.update], [[], [], [], []]);
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

// ---- The order of the writes, and what a refused one does. ----
// A remake is a removal and a creation. Between the two writes the scene carries both regions, so the removal MUST
// land first: the other way round, a scene momentarily holds two concealment regions, and if the second write fails it
// holds them for good. The order therefore lives in the plan, where it can be read without a Foundry, and the caller
// has one loop with nothing to put in the wrong order.

test("a remake removes before it creates, and says so in its own steps", () => {
  const withIt = ours({ behaviors: [{ type: CONCEALMENT_BEHAVIOUR }], shapes: [...SQUARE] });
  const remade = smokeRegionPlan([withIt], SQUARE, { visioner: false });
  assert.deepEqual(remade.steps.map((st) => st.kind), ["remove", "create"], "the removal first, always");
  assert.deepEqual(remade.steps[0].ids, ["mine"]);
  assert.equal(remade.steps[1].data.length, 1);
  // Every other answer's steps too, so the caller never has to decide anything.
  assert.deepEqual(smokeRegionPlan([ours()], [], {}).steps.map((st) => st.kind), ["remove"]);
  assert.deepEqual(smokeRegionPlan([], SQUARE, {}).steps.map((st) => st.kind), ["create"]);
  assert.deepEqual(smokeRegionPlan([ours({ shapes: [...SQUARE] })], OTHER, {}).steps.map((st) => st.kind), ["update"]);
  assert.deepEqual(smokeRegionPlan([ours({ shapes: [...SQUARE] })], SQUARE, {}).steps, [], "an unchanged round writes nothing");
  // The steps and the three lists are the same answer twice over, never two different ones.
  for (const plan of [remade, smokeRegionPlan([], SQUARE, {}), smokeRegionPlan([ours()], [], {})]) {
    const byKind = { remove: plan.remove, create: plan.create, update: plan.update };
    for (const st of plan.steps) assert.deepEqual(st.ids ?? st.data, byKind[st.kind]);
    assert.equal(plan.steps.length, [plan.remove, plan.create, plan.update].filter((l) => l.length).length);
  }
});

// Apply a plan the way main.mjs does: one loop over the steps, nothing caught, so a refusal stops the rest.
const applyPlan = async (plan, scene, { refuse = null } = {}) => {
  for (const step of plan.steps) {
    if (step.kind === refuse) throw new Error(`the database refused to ${step.kind}`);
    if (step.kind === "remove") for (const id of step.ids) scene.splice(scene.findIndex((r) => r.id === id), 1);
    else if (step.kind === "create") for (const data of step.data) scene.push(ours({ id: "new", shapes: [...data.shapes], behaviors: data.behaviors }));
  }
};

test("a refused removal stops the creation behind it, so the scene never holds two of ours", async () => {
  const start = () => [off({ id: "else" }), ours({ behaviors: [{ type: CONCEALMENT_BEHAVIOUR }], shapes: [...SQUARE] })];
  const plan = (scene) => smokeRegionPlan(scene, SQUARE, { visioner: false });
  // The removal is refused: it throws, nothing else is written, and there is still exactly one region of ours.
  const scene = start();
  await assert.rejects(() => applyPlan(plan(scene), scene, { refuse: "remove" }), /refused to remove/);
  assert.equal(scene.filter((r) => r.flags?.animater?.smokeRegion === true).length, 1, "one stale region, not two");
  // Nothing was lost either: the next round asks for the very same remake, and unrefused it leaves one region.
  const again = plan(scene);
  assert.deepEqual(again.steps.map((st) => st.kind), ["remove", "create"]);
  await applyPlan(again, scene);
  const mine = scene.filter((r) => r.flags?.animater?.smokeRegion === true);
  assert.equal(mine.length, 1, "still one");
  assert.deepEqual(mine[0].behaviors, [], "and it is the remade one");
});

test("a footprint that changed only in its points is still a change", () => {
  const poly = (points) => [{ type: "polygon", points }];
  const held = ours({ shapes: poly([0, 0, 100, 0, 100, 100]) });
  // The same outline: nothing to write.
  assert.deepEqual(smokeRegionPlan([held], poly([0, 0, 100, 0, 100, 100]), {}).steps, []);
  // A moved outline, with every other field identical: an update, which comparing only x/y/width/height missed.
  const moved = smokeRegionPlan([held], poly([0, 0, 100, 0, 100, 200]), {});
  assert.equal(moved.update.length, 1, "the region kept a stale footprint before this");
  assert.deepEqual(moved.update[0].shapes[0].points, [0, 0, 100, 0, 100, 200]);
  // One point more, and one fewer.
  assert.equal(smokeRegionPlan([held], poly([0, 0, 100, 0, 100, 100, 0, 100]), {}).update.length, 1);
  assert.equal(smokeRegionPlan([held], poly([0, 0, 100, 0]), {}).update.length, 1);
  // And the ordinary rectangle comparison still holds, by every field it has.
  const box = ours({ shapes: [{ type: "rectangle", x: 0, y: 0, width: 100, height: 100 }] });
  assert.deepEqual(smokeRegionPlan([box], [{ type: "rectangle", x: 0, y: 0, width: 100, height: 100 }], {}).steps, []);
  for (const change of [{ x: 50 }, { y: 50 }, { width: 50 }, { height: 50 }, { type: "ellipse" }]) {
    const one = smokeRegionPlan([box], [{ type: "rectangle", x: 0, y: 0, width: 100, height: 100, ...change }], {});
    assert.equal(one.update.length, 1, JSON.stringify(change));
  }
  // Key order cannot fool it: the same shape written the other way round is the same shape.
  assert.deepEqual(smokeRegionPlan([box], [{ height: 100, width: 100, y: 0, x: 0, type: "rectangle" }], {}).steps, []);
});
