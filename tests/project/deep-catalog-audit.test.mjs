import test from "node:test";
import assert from "node:assert/strict";
import { meaningfulFingerprint } from "../../tools/audit-catalog-depth.mjs";
import { validateRecipe } from "../../scripts/core/model.mjs";
const db = [{ key: "jb2a.impact.red", file: "Impact_Red_400x400.webm" }, { key: "jb2a.alias.red", file: "Impact_Red_400x400.webm" }, { key: "jb2a.impact.blue", file: "Impact_Blue_400x400.webm" }];
const recipe = (extra = {}) => validateRecipe({ id: "a", name: "A", trigger: "manual", stages: [{ kind: "impact", stageId: "hit", assets: ["jb2a.impact.red"], delay: 500, duration: 1500, scale: 1, ...extra }] });
test("variety ledger ignores labels, alias keys, audio and imperceptible parameter jitter", () => {
  const base = recipe(), other = recipe({ stageId: "renamed", label: "Different spell", assets: ["jb2a.alias.red"], delay: 501, duration: 1501, scale: 1.001 });
  other.stages.push({ kind: "sound", soundFile: "different.ogg" });
  assert.equal(meaningfulFingerprint(base, db), meaningfulFingerprint(other, db));
});
test("variety ledger counts visible media and routing changes independently", () => {
  const base = recipe();
  assert.notEqual(meaningfulFingerprint(base, db), meaningfulFingerprint(recipe({ assets: ["jb2a.impact.blue"] }), db));
  assert.equal(meaningfulFingerprint(base, db, { familyOnly: true }), meaningfulFingerprint(recipe({ assets: ["jb2a.impact.blue"] }), db, { familyOnly: true }));
  assert.notEqual(meaningfulFingerprint(base, db), meaningfulFingerprint(recipe({ targetSelection: "first" }), db));
});
