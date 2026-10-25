import test from "node:test";
import assert from "node:assert/strict";
import { clipLength, completeMediaStage, mediaSpan, wholeBreathClip } from "../../../scripts/engines/media/media-lifetime.mjs";
import { MEDIA_DURATIONS } from "../../../data/media-durations.mjs";
import { AnimaterRuntime } from "../../../scripts/engines/playback/runtime.mjs";
import { starterRecipes } from "../../../scripts/core/presets.mjs";
import { dndEntries, dndRecipe } from "../../../scripts/catalogs/dnd5e/dnd5e-catalog.mjs";
import { featureStages } from "../../../scripts/catalogs/daggerheart/daggerheart-catalog.mjs";
import { validateRecipe } from "../../../scripts/core/model.mjs";

const STRANDS = "jb2a.energy_strands.complete.purple.01", MARKER = "jb2a.energy_strands.02.marker.bluepurple";

test("a partial key measures as the longest of the clips it may play", () => {
  assert.equal(clipLength("jb2a.breath_weapons02.burst.cone.arcana.purple"), Math.max(MEDIA_DURATIONS["jb2a.breath_weapons02.burst.cone.arcana.purple.01"], MEDIA_DURATIONS["jb2a.breath_weapons02.burst.cone.arcana.purple.02"]));
  assert.equal(clipLength(STRANDS), 2033);
  assert.equal(clipLength("jb2a.no_such_clip"), 0);
  assert.equal(clipLength(undefined), 0);
  assert.equal(clipLength("jb2a.impact"), 0, "a whole family is no single clip");
});

test("a one-shot stage never asks Sequencer for more than the clip that plays, so it cannot freeze on its last frame", () => {
  // Chill Touch's bloom is timed for the 5-second Free marker; Patreon plays the 2-second strands.
  const stage = { kind: "impact", asset: STRANDS, oneShot: true, duration: 4180, playbackRate: 1.25, clipStart: 0, clipEnd: 0, fadeOut: 180 };
  // The whole strands clip, then only its fade-out over the last frame (media ms = elapsed x rate).
  assert.equal(mediaSpan(stage), Math.ceil(2033 / 1.25 + 180) * 1.25);
  assert.equal(mediaSpan({ ...stage, fadeOut: 0 }), Math.ceil(2033 / 1.25) * 1.25);
  assert.equal(mediaSpan({ ...stage, asset: MARKER, duration: 3000 }), 3000 * 1.25, "a clip longer than its stage plays the stage");
  // An opening skip with no loop stops at the file's end the same way.
  assert.equal(mediaSpan({ ...stage, oneShot: false, clipStart: 500 }), Math.ceil((2033 - 500) / 1.25 + 180) * 1.25 + 500);
  // Looping footage, explicit clips and unmeasured files keep their stage length.
  assert.equal(mediaSpan({ ...stage, oneShot: false }), 4180 * 1.25);
  assert.equal(mediaSpan({ ...stage, clipEnd: 1500 }), 4180 * 1.25);
  assert.equal(mediaSpan({ ...stage, asset: "modules/x/clip.webm" }), 4180 * 1.25);
});

function fixture() {
  const calls = [];
  const effect = new Proxy({}, { get: (_, key) => (...args) => { calls.push([key, ...args]); return effect; } });
  const host = {
    database: { entryExists: () => true, getPathsUnder: () => [], getAllFileEntries: (k) => [`${k}.webm`] },
    enabled: () => true, recipes: () => [], ready: () => true, canPlay: () => true, userId: () => "u",
    sequence: () => ({
      effect: () => { calls.push(["effect"]); return effect; },
      sound: () => { calls.push(["sound"]); return effect; },
      play: async (options) => calls.push(["play", options]),
    }),
    endEffects: async () => {}, endSounds: async () => {}, motion: async () => {}, stopMotion: async () => {},
  };
  const runtime = new AnimaterRuntime(host);
  runtime.refreshCatalog();
  return { runtime, calls };
}

test("the runtime ends a short one-shot clip with the clip instead of holding it for a longer fallback's length", async () => {
  const { runtime, calls } = fixture();
  runtime.catalog = [{ key: STRANDS }];
  runtime.wait = async () => true;
  const r = starterRecipes()[0];
  r.stages = [{ ...r.stages[0], kind: "impact", assets: [STRANDS, MARKER], oneShot: true, playbackRate: 1.25, duration: 4180, fadeOut: 180 }];
  const target = { center: { x: 200, y: 0 } };
  await runtime.play(validateRecipe(r), { source: { center: { x: 0, y: 0 } }, targets: [target] }, { preview: true });
  assert.ok(calls.some((c) => c[0] === "file" && c[1] === STRANDS));
  assert.equal(calls.find((c) => c[0] === "duration")[1], Math.ceil(2033 / 1.25 + 180) * 1.25, "the strands play once and fade, not 2.5 s more on their last frame");
  assert.ok(calls.some((c) => c[0] === "loopOptions" && c[1].loops === 1));
});

test("catalog breath weapons play their whole clip so the cone or line has time to grow (D&D 5e)", () => {
  const breaths = dndEntries("feat").filter((e) => /breath/i.test(e.name));
  let checked = 0;
  for (const e of breaths) for (const v of e.variants) {
    for (const s of dndRecipe(e, v.id).stages.filter((s) => ["template", "travel"].includes(s.kind) && s.assets.some((k) => /breath_weapons/.test(k)))) {
      if (s.persist || s.clipEnd) continue;
      const full = Math.max(...s.assets.map(clipLength));
      assert.ok(full > 0, `${e.name}: ${s.assets} is measured`);
      assert.equal(s.oneShot, true, `${e.name} ${v.label}`);
      assert.ok(s.duration >= full / s.playbackRate, `${e.name} ${v.label}: ${s.duration}ms of a ${full}ms clip`);
      checked++;
    }
  }
  assert.ok(checked >= 30, `${checked} breath stages`);
  // The 2024 Dragonborn Breath Weapon, both shapes.
  const dragonborn = dndEntries("feat").find((e) => e.id === "dnd5e-origins24-phbsptBreathWeap");
  for (const v of dragonborn.variants) {
    const exhale = dndRecipe(dragonborn, v.id).stages.find((s) => s.kind === "template");
    assert.ok(exhale.duration >= 7292, `${v.label}: ${exhale.duration}`);
  }
});

test("breath clips only: loop footage, lasting areas, explicit clips and other art keep their timing", () => {
  const breath = { kind: "template", assets: ["jb2a.breath_weapons.fire.cone.orange"], duration: 2200, oneShot: false };
  assert.equal(wholeBreathClip(breath).oneShot, true);
  for (const s of [{ ...breath, assets: ["jb2a.breath_weapons02.loop.cone.fire.orange.01"] }, { ...breath, persist: true }, { ...breath, clipEnd: 3000 }, { ...breath, assets: ["jb2a.fireball.explosion.orange"] }, { ...breath, kind: "cast" }])
    assert.equal(wholeBreathClip(s), s);
  assert.equal(completeMediaStage({ ...validateRecipe({ ...starterRecipes()[0], stages: [breath] }).stages[0], oneShot: true }).duration, 8466);
});

test("Daggerheart breath features play their whole breath clip", () => {
  const recipe = validateRecipe({ ...starterRecipes()[0], stages: featureStages("fire", "breath") });
  const breath = recipe.stages.find((s) => s.stageId === "breath");
  assert.equal(breath.oneShot, true);
  assert.ok(breath.duration >= 8466);
});
