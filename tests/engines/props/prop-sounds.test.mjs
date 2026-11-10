import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { propSound, wallSound, BREAK_SOUNDS, SPLASH_SOUNDS } from "../../../scripts/engines/props/prop-sounds.mjs";

test("a material's break sound is one of its own family, chosen by rand", () => {
  for (const m of Object.keys(BREAK_SOUNDS)) {
    const seen = new Set();
    for (let i = 0; i < 40; i++) {
      const { file } = propSound(m, "none", () => i / 40);
      assert.ok(BREAK_SOUNDS[m].includes(file), `${m}: ${file}`);
      assert.ok(file.includes(`/props/${m}/`));
      seen.add(file);
    }
    assert.equal(seen.size, BREAK_SOUNDS[m].length, `${m} reaches every recording`);
  }
});
test("the same rand picks the same file; rand 0 and just under 1 are in range", () => {
  assert.deepEqual(propSound("stone", "none", () => 0.37), propSound("stone", "none", () => 0.37));
  assert.equal(propSound("wood", "none", () => 0).file, BREAK_SOUNDS.wood[0]);
  assert.equal(propSound("wood", "none", () => 0.999999).file, BREAK_SOUNDS.wood.at(-1));
});
test("water, wine and oil add the splash; other contents add none", () => {
  for (const c of ["water", "wine", "oil"]) assert.ok(SPLASH_SOUNDS.includes(propSound("clay", c, () => 0.5).splash));
  for (const c of ["none", "grain", "goods", undefined]) assert.equal("splash" in propSound("clay", c, () => 0.5), false);
});
test("an unknown material breaks like wood", () => {
  for (const m of ["none", "plastic", undefined, "toString"]) assert.ok(BREAK_SOUNDS.wood.includes(propSound(m, "none", () => 0.2).file));
});
test("every named recording is bundled", () => {
  for (const f of [...Object.values(BREAK_SOUNDS).flat(), ...SPLASH_SOUNDS]) assert.ok(existsSync(f.replace("modules/animater/", "")), f);
});
test("a door sounds like wood until its own family ships", () => {
  assert.ok(BREAK_SOUNDS.wood.includes(wallSound("door", () => 0.3).file));
  assert.equal(wallSound("door", () => 0).file, BREAK_SOUNDS.wood[0]);
  assert.deepEqual(wallSound("door", () => 0.6), wallSound("door", () => 0.6));
  assert.ok(BREAK_SOUNDS.wood.includes(wallSound("unknown", () => 0.9).file), "an unknown kind falls back to the door's sound");
});
test("a window sounds like glass", () => {
  assert.ok(BREAK_SOUNDS.glass.includes(wallSound("window", () => 0.5).file));
  assert.equal(wallSound("window", () => 0).file, BREAK_SOUNDS.glass[0]);
  assert.equal(wallSound("window", () => 0.999999).file, BREAK_SOUNDS.glass.at(-1));
  assert.ok(BREAK_SOUNDS.wood.includes(wallSound("door", () => 0.5).file), "a door still sounds like wood");
});
