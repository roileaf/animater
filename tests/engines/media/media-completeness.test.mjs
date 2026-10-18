import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { databaseEntries, variantFiles } from "../../../tools/asset-databases.mjs";
import { mediaTiming,designMediaTiming } from "../../../tools/media-timing.mjs";
import {paceDeliveryEffects} from '../../../scripts/catalogs/pf2e/spells/spell-delivery-timing.mjs';
import { PF2E_SPELLS, spellRecipe } from "../../../scripts/catalogs/pf2e/spells/spell-catalog.mjs";
import { validateRecipe } from "../../../scripts/core/model.mjs";
import { timedStages } from "../../../scripts/engines/playback/composition.mjs";
import { recipeDuration } from "../../../scripts/engines/playback/choreography.mjs";
import { previewPose } from "../../../scripts/core/stage-options.mjs";

const nativeDatabase = new URL(
  "../../../../jb2a_patreon/scripts/jb2a_sequencer.js",
  import.meta.url,
);
let hasProbe = false;
try {
  execFileSync("ffprobe", ["-version"], { stdio: "ignore" });
  hasProbe = true;
} catch {}
const rows = existsSync(nativeDatabase)
  ? await databaseEntries(
      await readFile(nativeDatabase, "utf8"),
      "jb2aPatreonDatabase",
      "patreonDatabase",
    )
  : [];
const nativeSkip =
  !rows.length || !hasProbe
    ? "Native JB2A Patreon footage and ffprobe required"
    : false;
const duration = (file) => {
  const path = fileURLToPath(new URL(`../../../../../${file}`, import.meta.url));
  assert.ok(existsSync(path), file);
  return Math.ceil(
    Number(
      execFileSync(
        "ffprobe",
        [
          "-v",
          "error",
          "-show_entries",
          "format=duration",
          "-of",
          "csv=p=0",
          path,
        ],
        { encoding: "utf8" },
      ).trim(),
    ) * 1000,
  );
};

test('media probing covers local cast and aura slots as well as delivery slots',{skip:nativeSkip},async()=>{
 const row=rows.find(r=>r.key==='jb2a.eyes.01.dark_green.many');
 assert(row);
 const keys=Object.fromEntries(['cast','bolt','hit','aura','area'].map(slot=>[slot,[row.key]]));
 const timing=await designMediaTiming(keys,{patreon:[row]});
 for(const slot of Object.keys(keys))assert(timing[slot]?.duration>0,slot);
 assert.equal(timing.cast.duration,timing.hit.duration);
 assert.equal(timing.aura.duration,timing.hit.duration);
});

test('each authored film uses its own slot lifetime, playback rate and final fade',()=>{
 const stages=paceDeliveryEffects([
  {kind:'projectile',mediaSlot:'aura',assets:['jb2a.particles.blue'],duration:1500,playbackRate:.5,fadeOut:500},
  {kind:'cast',mediaSlot:'hit',assets:['jb2a.eyes.green'],duration:1500,fadeOut:250},
 ],{preserveStageTiming:true,mediaTiming:{bolt:{duration:2000,baked:true},aura:{duration:9000,baked:false},hit:{duration:5000,baked:false}}});
 assert.equal(stages[0].kind,'projectile');
 assert.equal(stages[0].duration,18500);
 assert.equal(stages[1].duration,5250);
});

test(
  "Force Barrage keeps every native distance and random media variant through its final frame",
  { skip: nativeSkip },
  () => {
    const recipe = spellRecipe(
      PF2E_SPELLS.find((s) => s.name === "Force Barrage"),
    );
    for (const stage of recipe.stages.filter((s) =>
      ["travel", "impact"].includes(s.kind),
    )) {
      for (const row of rows.filter((r) => stage.assets.includes(r.key))) {
        for (const file of variantFiles(row)) {
          const full = duration(file),
            elapsed = full / stage.playbackRate;
          assert.ok(
            stage.duration >= elapsed,
            `${stage.label}: ${file}: ${stage.duration}ms cuts ${elapsed}ms clip`,
          );
        }
      }
    }
  },
);

test(
  "long impact spells retain native footage beyond the old three-second cap",
  { skip: nativeSkip },
  () => {
    for (const name of ["Acid Arrow", "Moonbeam", "Celestial Brand"]) {
      const recipe = spellRecipe(
        PF2E_SPELLS.find((spell) => spell.name === name),
      );
      let longClips = 0;
      for (const stage of recipe.stages.filter(
        (stage) => stage.kind === "impact",
      )) {
        for (const row of rows.filter((row) =>
          stage.assets.includes(row.key),
        )) {
          for (const file of variantFiles(row)) {
            const full = duration(file);
            if (full > 3000) longClips++;
            assert.ok(
              stage.duration >= full / stage.playbackRate + stage.fadeOut,
              `${name}/${stage.label}: ${stage.duration}ms cuts ${full}ms clip`,
            );
          }
        }
      }
      assert.ok(
        longClips > 0,
        `${name} must exercise a real clip over three seconds`,
      );
    }
  },
);

const wholeClip = (options = {}) =>
  validateRecipe({
    id: "complete-clip",
    name: "Complete clip",
    trigger: "manual",
    stages: [
      {
        kind: "travel",
        assets: ["jb2a.magic_missile.purple"],
        duration: 1900,
        oneShot: true,
        ...options,
      },
    ],
  });

test("old one-shot recipes preserve the full longest clip and exit fade at every supported speed", () => {
  for (const playbackRate of [0.25, 0.5, 1, 2, 3]) {
    const recipe = wholeClip({ playbackRate, fadeOut: 100 });
    const stage = recipe.stages[0],
      nativeEnd = 2200 / playbackRate;
    assert.ok(stage.duration >= nativeEnd + 100);
    assert.equal(
      previewPose(stage, nativeEnd).alpha,
      1,
      "exit starts after the film",
    );
    assert.equal(previewPose(stage, stage.duration).alpha, 0);
    assert.deepEqual(
      validateRecipe(recipe),
      recipe,
      "validation cannot keep extending the clip",
    );
  }
});

test("exit scaling and rotation also begin after the full film", () => {
  const stage = wholeClip({
    scaleOut: 0,
    scaleOutDuration: 400,
    rotateOut: 90,
    rotateOutDuration: 250,
  }).stages[0];
  assert.equal(stage.duration, 2600);
  assert.equal(previewPose(stage, 2200).scaleX, 1);
  assert.equal(previewPose(stage, 2200).scaleY, 1);
  assert.equal(previewPose(stage, 2200).rotation, 0);
});

test("explicit clips, looping windows and unknown assets preserve the authored duration", () => {
  for (const options of [
    { clipStart: 100 },
    { clipEnd: 1700 },
    { oneShot: false },
    { assets: ["jb2a.custom.unmeasured"] },
  ]) {
    assert.equal(wholeClip(options).stages[0].duration, 1900);
  }
});

test("repeats, end-linked stages and the recipe clock include the full clip tail", () => {
  const recipe = wholeClip({
    stageId: "flight",
    delay: 100,
    repeats: 2,
    repeatGap: 200,
    fadeOut: 100,
  });
  recipe.stages.push({
    kind: "cast",
    assets: ["jb2a.custom.unmeasured"],
    afterStage: "flight",
    timingAnchor: "end",
    duration: 500,
  });
  const complete = validateRecipe(recipe),
    stages = timedStages(complete);
  assert.equal(stages[0].duration, 2300);
  assert.equal(stages[1].delay, 100 + 2300 * 2 + 200);
  assert.equal(recipeDuration(complete), 5400);
});

test(
  "catalog media probing uses every distance and random variant while retaining contact analysis",
  { skip: nativeSkip },
  async () => {
    const row = rows.find((row) => row.key === "jb2a.magic_missile.purple");
    assert.ok(row);
    const measured = await mediaTiming(row, { patreon: rows, free: [] });
    assert.equal(
      measured.duration,
      Math.max(...variantFiles(row).map(duration)),
    );
    assert.equal(measured.duration, 2200);
    assert.equal(measured.contact, 1000);
  },
);
