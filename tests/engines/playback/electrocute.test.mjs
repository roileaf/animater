import test from "node:test";
import assert from "node:assert/strict";
import { withElectrocution } from "../../../scripts/engines/playback/electrocute.mjs";

const recipe = { id: "r", stages: [
  { stageId: "bolt", kind: "projectile", assets: ["jb2a.chain_lightning.primary.blue"] },
  { stageId: "hit", kind: "motion", motion: "shake", subject: "targets", duration: 700, intensity: 0.5, afterStage: "bolt" },
  { stageId: "cast", kind: "motion", motion: "shake", subject: "source", duration: 700 },
] };

test("lightning's struck targets convulse; the caster and other elements keep their motions", () => {
  for (const element of ["electricity", "lightning"]) {
    const [, hit, cast] = withElectrocution(recipe, element).stages;
    assert.equal(hit.motion, "electrocute", element);
    assert.ok(hit.duration >= 1100 && hit.intensity >= 0.8, "long and strong enough to read");
    assert.equal(hit.afterStage, "bolt", "keeps its timing");
    assert.equal(cast.motion, "shake", "the caster's own gesture stays");
  }
  assert.equal(withElectrocution(recipe, "fire"), recipe);
  assert.equal(withElectrocution(recipe, undefined), recipe);
});

test("lightning written with no reaction on its targets convulses them as it lands", () => {
  const added = (stages) => withElectrocution({ id: "r", stages }, "electricity").stages.find((s) => s.motion === "electrocute");
  // With its first impact, timed as the impact is.
  const hit = added([
    { stageId: "arc", kind: "travel", duration: 1200 },
    { stageId: "hit", kind: "impact", afterStage: "arc", timingAnchor: "start", startOffset: 700, targetStagger: 160 },
  ]);
  assert.equal(hit.subject, "targets");
  assert.deepEqual([hit.afterStage, hit.timingAnchor, hit.startOffset, hit.targetStagger], ["arc", "start", 700, 160]);
  assert.ok(hit.duration >= 1100 && hit.intensity >= 0.8);
  // As an area strikes (a lightning bolt's line).
  assert.equal(added([{ stageId: "cast", kind: "cast", delay: 0 }, { stageId: "line", kind: "template", delay: 540 }]).delay, 540);
  // As a flight arrives: its contact, else 55% of the way.
  const arc = added([{ stageId: "arc", kind: "travel", duration: 1000, contact: 600 }]);
  assert.deepEqual([arc.afterStage, arc.timingAnchor, arc.startOffset], ["arc", "start", 600]);
  assert.equal(added([{ stageId: "arc", kind: "travel", duration: 1000 }]).startOffset, 550);
});

test("a recipe with its own reaction on its targets, or nothing landing on them, keeps what it was written with", () => {
  const stagger = { id: "r", stages: [{ stageId: "hit", kind: "impact" }, { stageId: "s", kind: "motion", motion: "stagger", subject: "targets" }] };
  assert.equal(withElectrocution(stagger, "electricity"), stagger);
  const self = { id: "r", stages: [{ stageId: "c", kind: "cast" }, { stageId: "m", kind: "motion", motion: "pulse", subject: "source" }] };
  assert.equal(withElectrocution(self, "electricity"), self);
  const impactOnly = { id: "r", stages: [{ stageId: "hit", kind: "impact" }] };
  assert.equal(withElectrocution(impactOnly, "fire"), impactOnly);
});
