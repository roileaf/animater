import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { propSound, tipSound, wallSound, BREAK_SOUNDS, SPLASH_SOUNDS, BLAST_SOUNDS, DOOR_SOUNDS, TOPPLE_SOUNDS, PAGE_SOUNDS, TIP_SOUNDS } from "../../../scripts/engines/props/prop-sounds.mjs";

const base = (f) => f.split("/").pop();
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
  for (const f of [...Object.values(BREAK_SOUNDS).flat(), ...SPLASH_SOUNDS, ...DOOR_SOUNDS, ...BLAST_SOUNDS, ...TOPPLE_SOUNDS, ...PAGE_SOUNDS, ...TIP_SOUNDS]) assert.ok(existsSync(f.replace("modules/animater/", "")), f);
});
test("a door bursts with its own family, and an unknown wall kind sounds like a door", () => {
  assert.deepEqual(DOOR_SOUNDS.map(base), ["door-forced-160213.ogg", "wood-smash-536777.ogg", "door-kick-452609.ogg"]);
  for (const f of DOOR_SOUNDS) assert.match(f, new RegExp("/props/door-burst/"));
  assert.equal(wallSound("door", () => 0).file, DOOR_SOUNDS[0]);
  assert.equal(wallSound("door", () => 0.999999).file, DOOR_SOUNDS.at(-1));
  assert.deepEqual(wallSound("door", () => 0.6), wallSound("door", () => 0.6));
  assert.equal(new Set(Array.from({ length: 30 }, (_, i) => wallSound("door", () => i / 30).file)).size, 3);
  assert.ok(DOOR_SOUNDS.includes(wallSound("unknown", () => 0.9).file), "an unknown kind falls back to the door's sound");
});
test("a window sounds like glass", () => {
  assert.ok(BREAK_SOUNDS.glass.includes(wallSound("window", () => 0.5).file));
  assert.equal(wallSound("window", () => 0).file, BREAK_SOUNDS.glass[0]);
  assert.equal(wallSound("window", () => 0.999999).file, BREAK_SOUNDS.glass.at(-1));
  assert.ok(!BREAK_SOUNDS.wood.includes(wallSound("door", () => 0.5).file), "a door no longer sounds like plain wood");
});
test("an explosion has its own four recordings, each reachable; spilled powder breaks like its material", () => {
  assert.deepEqual(BLAST_SOUNDS.map(base), ["tannerite-tree-530163.ogg", "tannerite-forest-530162.ogg", "fireball-251759.ogg", "cherry-bomb-870713.ogg"]);
  for (const f of BLAST_SOUNDS) assert.match(f, new RegExp("/props/explosion/"));
  assert.ok(BLAST_SOUNDS.includes(propSound("wood", "powder", () => 0, { powder: "exploded" }).file));
  const seen = new Set(Array.from({ length: 40 }, (_, i) => propSound("metal", "powder", () => i / 40, { powder: "exploded" }).file));
  assert.equal(seen.size, 4);
  assert.equal("splash" in propSound("wood", "powder", () => 0.5, { powder: "exploded" }), false);
  assert.equal("extra" in propSound("wood", "powder", () => 0.5, { powder: "exploded" }), false);
  assert.ok(BREAK_SOUNDS.wood.includes(propSound("wood", "powder", () => 0.5, { powder: "spilled" }).file));
  assert.ok(BREAK_SOUNDS.wood.includes(propSound("wood", "powder", () => 0.5).file));
});
test("a topple has the stone-topple recordings, whatever the prop is made of", () => {
  assert.deepEqual(TOPPLE_SOUNDS.map(base), ["statue-fall-363836.ogg", "cinder-block-452579.ogg"]);
  for (const f of TOPPLE_SOUNDS) assert.match(f, new RegExp("/props/stone-topple/"));
  assert.ok(TOPPLE_SOUNDS.includes(propSound("wood", "none", () => 0.2, { style: "topple" }).file));
});
test("books add a page flutter on top of the wood break; other contents add none", () => {
  assert.deepEqual(PAGE_SOUNDS.map(base), ["heavy-book-648959.ogg", "book-fall-185041.ogg", "books-falling-394912.ogg", "books-falling-509531.ogg"]);
  for (const f of PAGE_SOUNDS) assert.match(f, new RegExp("/props/pages/"));
  const s = propSound("wood", "books", () => 0.1);
  assert.ok(BREAK_SOUNDS.wood.includes(s.file)); assert.ok(PAGE_SOUNDS.includes(s.extra));
  assert.equal(propSound("wood", "books", () => 0).extra, PAGE_SOUNDS[0]);
  assert.equal(propSound("wood", "books", () => 0.999999).extra, PAGE_SOUNDS.at(-1));
  assert.equal(new Set(Array.from({ length: 40 }, (_, i) => propSound("wood", "books", () => i / 40).extra)).size, 4);
  for (const c of ["none", "water", "grain", undefined]) assert.equal("extra" in propSound("wood", c, () => 0.5), false);
  assert.equal("extra" in propSound("wood", "books", () => 0.5, { style: "burn" }), false);
});
test("a tipped brazier clatters with the metal-clatter recordings", () => {
  assert.deepEqual(TIP_SOUNDS.map(base), ["steel-cup-569286.ogg", "metal-bucket-870887.ogg", "pots-pans-209002.ogg"]);
  for (const f of TIP_SOUNDS) assert.match(f, new RegExp("/props/metal-clatter/"));
  assert.equal(tipSound(() => 0).file, TIP_SOUNDS[0]);
  assert.equal(tipSound(() => 0.999999).file, TIP_SOUNDS.at(-1));
  assert.equal(new Set(Array.from({ length: 30 }, (_, i) => tipSound(() => i / 30).file)).size, 3);
});

test("burning away sounds of fire (fire-sear placeholder); a cut web is silent", async () => {
  const { BURN_SOUNDS } = await import("../../../scripts/engines/props/prop-sounds.mjs");
  assert.equal(BURN_SOUNDS.length, 6);
  for (const f of BURN_SOUNDS) { assert.match(f, /surfaces\/freesound\/fire-sear-\d+-\d\.ogg$/); assert.ok(existsSync(f.replace("modules/animater/", "")), f); }
  const seen = new Set(Array.from({ length: 60 }, (_, i) => propSound("plant", "none", () => i / 60, { style: "burn" }).file));
  assert.equal(seen.size, 6);
  assert.equal("splash" in propSound("wood", "water", () => 0.5, { style: "burn" }), false, "burning away spills nothing to hear");
  assert.deepEqual(propSound("plant", "none", () => 0.5, { style: "split" }), { file: null });
  assert.ok(BREAK_SOUNDS.wood.includes(propSound("plant", "none", () => 0.5).file), "a plant with no style breaks like the default");
});
