import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { iceBreakSound, newKeys, ICE_BREAK_FILES, ICE_SPLASH_FILES, ICE_SPLASH_GAP_MS , iceBreakVoice, ICE_BREAK_GAP } from "../../../scripts/engines/regions/ice-break-sound.mjs";
import { BUNDLED_SOUND_DIRS } from "../../../data/bundled-sounds.mjs";

const LOCAL = (file) => file.replace("modules/animater/", "./");

test("every screen hears the same break at the same square", () => {
  for (const key of ["3,4", "-1,2", "0,0", "17,-33"]) {
    const a = iceBreakSound(key, 7), b = iceBreakSound(key, 7);
    assert.equal(a.ice, b.ice);
    assert.equal(a.splash, b.splash);
  }
});

test("a break is an ice sound and a splash under it, a moment apart", () => {
  const s = iceBreakSound("3,4");
  assert.match(s.ice, /\/ice-break-\d+-\d\.ogg$/);
  assert.match(s.splash, /\/body-splash-\d+-\d\.ogg$/);
  assert.equal(s.gap, ICE_SPLASH_GAP_MS);
  assert.ok(s.gap > 0 && s.gap < 400, "the splash follows the ice, it does not arrive separately");
});

test("two regions broken at the same square of the grid do not sound identical", () => {
  const a = iceBreakSound("3,4", 0), b = iceBreakSound("3,4", 1);
  assert.notDeepEqual([a.ice, a.splash], [b.ice, b.splash]);
});

test("junk gives nothing rather than an error", () => {
  for (const key of ["junk", "", "3,", "3,4,5", null, undefined, 7, {}]) assert.equal(iceBreakSound(key), null);
});

test("every recording is reached over many squares, so a lake does not play one sound", () => {
  const ice = new Set(), splash = new Set();
  for (let c = -20; c < 20; c++) for (let r = -20; r < 20; r++) { const s = iceBreakSound(`${c},${r}`); ice.add(s.ice); splash.add(s.splash); }
  assert.equal(ice.size, ICE_BREAK_FILES.length);
  assert.equal(splash.size, ICE_SPLASH_FILES.length);
});

test("every file named is one Animater actually ships", () => {
  const shipped = new Set(BUNDLED_SOUND_DIRS["surfaces/freesound"] ?? []);
  for (const name of [...ICE_BREAK_FILES, ...ICE_SPLASH_FILES]) {
    assert.ok(shipped.has(name), `${name} is not in the bundled-sound manifest (run tools/build-bundled-sounds.mjs)`);
    assert.ok(existsSync(new URL(`../../../assets/sounds/surfaces/freesound/${name}`, import.meta.url)), `${name} is not on disk`);
  }
});

test("a screen coming to a broken map hears nothing, and only new holes sound after that", () => {
  const first = newKeys(["3,4", "5,6"], undefined);
  assert.deepEqual(first.fresh, [], "arriving at a map whose ice is already broken is silent");
  const next = newKeys(["3,4", "5,6", "7,8"], first.seen);
  assert.deepEqual(next.fresh, ["7,8"]);
  const again = newKeys(["3,4", "5,6", "7,8"], next.seen);
  assert.deepEqual(again.fresh, [], "a hole sounds once, not on every redraw");
});

test("ice frozen over again can break again and be heard", () => {
  const broke = newKeys(["3,4"], new Set());
  assert.deepEqual(broke.fresh, ["3,4"]);
  const refrozen = newKeys([], broke.seen);
  assert.deepEqual(refrozen.fresh, []);
  assert.deepEqual(newKeys(["3,4"], refrozen.seen).fresh, ["3,4"], "Refreeze forgets it, so the next creature through is heard");
});

test("junk in the stored holes is ignored rather than played", () => {
  const { fresh } = newKeys(["3,4", null, 7, undefined], new Set());
  assert.deepEqual(fresh, ["3,4"]);
  assert.deepEqual(newKeys(null, new Set()).fresh, []);
});

test("one break is one sound, however many squares went down together", () => {
  // A move may take several squares at once and a drag delivers them one after another. A pair of recordings per square
  // meant five squares playing ten on top of each other: one break at ten times the volume, not five creatures.
  let t = 0;
  const voice = iceBreakVoice({ now: () => t });
  assert.equal(voice.wanted(), true, "the first one is heard");
  assert.equal(voice.wanted(), false, "and the rest of that crossing is not");
  t += ICE_BREAK_GAP / 2;
  assert.equal(voice.wanted(), false, "still inside the wait");
  t += ICE_BREAK_GAP;
  assert.equal(voice.wanted(), true, "a later break is its own break and is heard");
});

test("the gate holds nothing against junk, and a gap of none lets every break through", () => {
  let t = 0;
  const broken = iceBreakVoice({ now: () => NaN });
  assert.equal(broken.wanted(), false, "no clock is no sound, rather than a throw");
  const open = iceBreakVoice({ gap: 0, now: () => t });
  assert.equal(open.wanted(), true);
  assert.equal(open.wanted(), true, "no wait asked for, none kept");
  const odd = iceBreakVoice({ gap: "soon", now: () => t });
  assert.equal(odd.wanted(), true);
  assert.equal(odd.wanted(), true, "junk for the gap is no gap");
});
