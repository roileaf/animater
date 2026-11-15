import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { VOICE_LEVELS, voiceGain } from "../../../scripts/engines/sound/voice-levels.mjs";

// The bundled voice sets were measured 26 dB apart, set to set: a cyclops at -0.8 dBFS and a golem at -26.9, twenty
// times the amplitude (Roi: "some of them are loud as FUCK"). This holds the table that levels them, and the reading
// of a file's set from its path. What the numbers ARE comes from measuring the files, not from here.

test("a cry is levelled by the set it belongs to, read from where the file sits", () => {
  const set = Object.keys(VOICE_LEVELS)[0];
  const gain = VOICE_LEVELS[set];
  assert.equal(voiceGain(`modules/animater/assets/sounds/${set}/attack-1.ogg`), gain);
  assert.equal(voiceGain(`/some/other/install/assets/sounds/${set}/death-3.ogg`), gain, "wherever the module is installed");
});

test("anything not measured is played as it is, rather than guessed at", () => {
  // A GM's own voice folder is never measured, so it must come back untouched instead of taking a neighbour's gain.
  assert.equal(voiceGain("worlds/mine/sounds/my-dragon/roar.ogg"), 1);
  assert.equal(voiceGain("modules/animater/assets/sounds/voices/library/not-a-real-set/cry.ogg"), 1);
  for (const junk of [null, undefined, "", 7, {}, []]) assert.equal(voiceGain(junk), 1, `junk ${String(junk)}`);
});

test("every set in the table is a folder that is really shipped", () => {
  // A path that drifted would silently level nothing, and nothing else would notice.
  for (const set of Object.keys(VOICE_LEVELS)) {
    assert.ok(existsSync(new URL(`../../../assets/sounds/${set}`, import.meta.url)), `${set} is not on disk`);
  }
});

test("no gain is wild: a set is nudged, never remade", () => {
  for (const [set, gain] of Object.entries(VOICE_LEVELS)) {
    assert.ok(Number.isFinite(gain) && gain > 0, `${set}: ${gain}`);
    const db = 20 * Math.log10(gain);
    assert.ok(db >= -18 && db <= 12, `${set} moves ${db.toFixed(1)} dB, which is past what the audit allows`);
    assert.ok(Math.abs(db) >= 0.4, `${set} moves ${db.toFixed(1)} dB, too little to be worth an entry`);
  }
});

test("the levels are the module's own, and main.mjs plays by them", () => {
  const main = readFileSync(new URL("../../../scripts/main.mjs", import.meta.url), "utf8");
  assert.match(main, /voiceGain\(file\)/, "the cry's volume is levelled where it is played");
  assert.match(main, /voice-levels\.mjs/, "and the table is the one here");
});
