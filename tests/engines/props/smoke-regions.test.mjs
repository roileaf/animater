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
