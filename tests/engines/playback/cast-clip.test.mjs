import test from "node:test";
import assert from "node:assert/strict";
import { PF2E_SPELLS, spellRecipe } from "../../../scripts/catalogs/pf2e/spells/spell-catalog.mjs";
import { validateRecipe } from "../../../scripts/core/model.mjs";
import { timedStages } from "../../../scripts/engines/playback/composition.mjs";
import { CAST_CLIP_CAP, castClipWindow, fitCastClips } from "../../../scripts/engines/playback/cast-clip.mjs";
import { MEDIA_VISIBLE } from "../../../data/media-visible.mjs";

const spell = (slug) => PF2E_SPELLS.find((s) => s.slug === slug && s.edition === "remaster") ?? PF2E_SPELLS.find((s) => s.slug === slug);
const opening = (recipe) => recipe.stages.find((s) => s.kind === "cast" && s.delay === 0);

test("measured JB2A cast windows carry their blank lead-in and visible end", () => {
  // Measured with ffmpeg signalstats on the installed jb2a_patreon webm files.
  assert.deepEqual(MEDIA_VISIBLE["jb2a.cast_shape.circle.01"], { start: 290, end: 1459, total: 2333 });
  assert.deepEqual(MEDIA_VISIBLE["jb2a.cast_generic.fire.01"], { start: 100, end: 1733, total: 2067 });
  // Colour variants share the family's window; unknown media have none.
  assert.equal(castClipWindow(["jb2a.cast_shape.circle.01.purple", "jb2a.cast_shape.circle.01.blue"]).start, 290);
  assert.equal(castClipWindow(["jb2a.cast_shape.circle.01.purple", "jb2a.glint.purple.few"]), null);
  assert.equal(castClipWindow(["modules/x/cast.webm"]), null);
});

test("a catalog spell's cast stage lasts its whole visible clip", () => {
  const recipe = spellRecipe(spell("ash-cloud"), undefined, { fx: false });
  const cast = opening(recipe);
  assert.deepEqual(cast.assets, ["jb2a.cast_generic.fire.01.orange"]);
  // The fire cast is visible from 0.1 s to 1.733 s; it used to be cut at 630 ms.
  assert.equal(cast.clipStart, 100);
  assert.ok(cast.duration * cast.playbackRate + cast.clipStart >= 1733, `cast ends at ${cast.duration}`);
  assert.ok(cast.duration <= CAST_CLIP_CAP);
});

test("a catalog cast already longer than its clip only skips the blank lead-in", () => {
  const recipe = spellRecipe(spell("agitate"), undefined, { fx: false });
  const cast = opening(recipe);
  assert.match(cast.assets[0], /^jb2a\.cast_shape\.circle\.01\./);
  assert.equal(cast.clipStart, 290);
  assert.equal(cast.duration, 1400);
});

test("long clips stop at the cast cap and never loop back past their end", () => {
  const [ring] = fitCastClips({ stages: [{ stageId: "c", kind: "cast", assets: ["jb2a.magic_signs.circle.02.evocation.complete.blue"], delay: 0, duration: 500, playbackRate: 1, clipStart: 0, clipEnd: 0 }] }).stages;
  assert.equal(ring.duration, CAST_CLIP_CAP);
  assert.equal(ring.clipStart, MEDIA_VISIBLE["jb2a.magic_signs.circle.02.evocation.complete"].start);
  const [loop] = fitCastClips({ stages: [{ stageId: "c", kind: "cast", assets: ["jb2a.cast_shape.circle.01.blue"], delay: 0, duration: 2300, playbackRate: 1, clipStart: 0, clipEnd: 0 }] }).stages;
  // 2300 ms of a 2333 ms clip: a 290 ms skip would wrap; skip only what still fits.
  assert.equal(loop.clipStart, 33);
  assert.equal(loop.duration, 2300);
});

test("stages linked to the cast's end follow its new length", () => {
  const recipe = validateRecipe({
    id: "linked", name: "Linked", trigger: "attack", match: "x",
    stages: [
      { stageId: "gather", kind: "cast", assets: ["jb2a.cast_generic.fire.01.orange"], delay: 0, duration: 540 },
      { stageId: "land", kind: "impact", assets: ["jb2a.impact.001.orange"], afterStage: "gather", delay: 0, duration: 800 },
      { stageId: "free", kind: "impact", assets: ["jb2a.impact.001.orange"], delay: 540, duration: 800 },
    ],
  });
  const fitted = fitCastClips(recipe);
  const timed = Object.fromEntries(timedStages(fitted).map((s) => [s.stageId, s]));
  assert.equal(timed.gather.duration, 1633);
  assert.equal(timed.land.delay, 1633);
  // Fixed delays are deliberate beats (release while the cast still glows).
  assert.equal(timed.free.delay, 540);
});

test("authored timing is never rewritten", () => {
  const authored = [
    { stageId: "a", kind: "cast", assets: ["jb2a.cast_generic.fire.01.orange"], delay: 0, duration: 540, playbackRate: 1, clipStart: 50, clipEnd: 0 },
    { stageId: "b", kind: "cast", assets: ["jb2a.cast_generic.fire.01.orange"], delay: 0, duration: 540, playbackRate: 1, clipStart: 0, clipEnd: 400 },
    { stageId: "c", kind: "cast", assets: ["jb2a.cast_generic.fire.01.orange"], delay: 0, duration: 2067, playbackRate: 1, clipStart: 0, clipEnd: 0, oneShot: true },
    { stageId: "d", kind: "cast", assets: ["jb2a.cast_generic.fire.01.orange"], delay: 0, duration: 540, playbackRate: 1, clipStart: 0, clipEnd: 0, persist: true },
    { stageId: "e", kind: "impact", assets: ["jb2a.cast_generic.fire.01.orange"], delay: 0, duration: 540, playbackRate: 1, clipStart: 0, clipEnd: 0 },
  ];
  assert.deepEqual(fitCastClips({ stages: authored }).stages, authored);
  // A user recipe keeps exactly what was saved: validation adds no lead-in skip.
  const saved = validateRecipe({ id: "mine", name: "Mine", trigger: "attack", match: "x",
    stages: [{ stageId: "g", kind: "cast", assets: ["jb2a.cast_shape.circle.01.blue"], delay: 0, duration: 540 }] });
  assert.equal(saved.stages[0].clipStart, 0);
  assert.equal(saved.stages[0].duration, 540);
});
