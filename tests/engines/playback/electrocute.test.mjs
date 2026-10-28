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
