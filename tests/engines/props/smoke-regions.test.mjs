import test from "node:test";
import assert from "node:assert/strict";
import { smokeRegionData, concealmentPlan } from "../../../scripts/engines/props/smoke-regions.mjs";

const TRI = [{ type: "polygon", points: [0, 0, 100, 0, 100, 100] }];
const TYPE = "pf2e-visioner.Pf2eVisionerConcealment";

test("the region carries visioner's concealment behaviour, tagged smoke", () => {
  const d = smokeRegionData(TRI, { levels: [], visioner: true });
  const b = d.behaviors.find((x) => x.type === TYPE);
  assert.ok(b, "the behaviour is present");
  assert.equal(b.system.sourceTags, "smoke");
  assert.equal(b.system.enabled, true);
});

test("the region is clipped to sight-blocking walls by core", () => {
  const d = smokeRegionData(TRI, { levels: [], visioner: true });
  assert.equal(d.restriction.enabled, true);
  assert.equal(d.restriction.type, "sight");
});

test("the restriction is there even without visioner, so the shape still fences to walls", () => {
  const d = smokeRegionData(TRI, { levels: [], visioner: false });
  assert.equal(d.restriction.enabled, true);
  assert.equal(d.restriction.type, "sight");
});

test("it is flagged as ours so Repair can find it", () => {
  const d = smokeRegionData([], { levels: [], visioner: true });
  assert.ok(d.flags.animater.smokeRegion);
});

test("shapes and levels pass through, as copies", () => {
  const d = smokeRegionData(TRI, { levels: ["L1"], visioner: true });
  assert.deepEqual(d.shapes, TRI);
  assert.notEqual(d.shapes[0], TRI[0]);
  assert.deepEqual(d.levels, ["L1"]);
});

test("without visioner it carries no behaviour at all", () => {
  const d = smokeRegionData([], { levels: [], visioner: false });
  assert.deepEqual(d.behaviors, []);
  assert.equal(smokeRegionData([], {}).behaviors.length, 0, "missing option degrades to none");
  assert.equal(smokeRegionData([]).behaviors.length, 0, "missing options degrade to none");
});

test("never writes the concealed condition anywhere", () => {
  for (const visioner of [true, false]) {
    const s = JSON.stringify(smokeRegionData(TRI, { levels: [], visioner }));
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
    const d = smokeRegionData(TRI, { levels: [], visioner: visionerActive });
    assert.equal(d.behaviors.length > 0, concealmentPlan({ visionerActive }).how === "behaviour");
  }
});
