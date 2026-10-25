import test from "node:test";
import assert from "node:assert/strict";
import { AnimaterRuntime } from "../../../scripts/engines/playback/runtime.mjs";
import { starterRecipes } from "../../../scripts/core/presets.mjs";
import { validateRecipe } from "../../../scripts/core/model.mjs";
import { orbRecipe } from "../../../scripts/catalogs/shared/orb-builder.mjs";
import { PF2E_SPELLS, spellRecipe } from "../../../scripts/catalogs/pf2e/spells/spell-catalog.mjs";
import { PF2E_WEAPONS, weaponRecipe } from "../../../scripts/catalogs/pf2e/weapons/weapon-catalog.mjs";
import { MEDIA_LANDINGS } from "../../../data/media-landings.mjs";
import { SURFACE_SOUND_PROFILES } from "../../../scripts/engines/sound/surface-sounds.mjs";
import { dndEntries, dndRecipe } from "../../../scripts/catalogs/dnd5e/dnd5e-catalog.mjs";
import { usedItemDamages, usedItemElement } from "../../../scripts/systems/item-damages.mjs";

test("native line effects use exact area endpoints, stationary cues are sized rather than stretched", async () => {
  const source = { center: { x: 0, y: 0 } },
    area = {
      type: "line",
      center: { x: 300, y: 100 },
      endpoint: { x: 900, y: 100 },
      length: 600,
      width: 100,
    };
  for (const name of ["Lightning Bolt", "Scatter Scree"]) {
    const { runtime, host, calls } = fixture();
    const recipe = spellRecipe(PF2E_SPELLS.find((s) => s.name === name));
    runtime.catalog = [...new Set(recipe.stages.flatMap((s) => s.assets))].map(
      (key) => ({ key }),
    );
    runtime.wait = async () => true;
    await runtime.play(
      recipe,
      { source, targets: [], template: {}, area },
      { preview: true },
    );
    const stretched = calls.filter((c) => c[0] === "stretchTo");
    if (name === "Lightning Bolt") {
      assert.deepEqual(
        stretched.map((c) => c[1]),
        [area.endpoint],
      );
      assert.ok(
        calls.some((c) => c[0] === "atLocation" && c[1] === area.center),
      );
      assert.ok(calls.some((c) => c[0] === "loopOptions" && c[1].loops === 1));
    } else {
      assert.equal(stretched.length, 0);
      const placed = calls.filter(
        (c) => c[0] === "atLocation" && c[1].x >= 300,
      );
      assert.equal(placed.length, 6);
      assert.deepEqual(
        placed.map((c) => c[1].x),
        [350, 450, 550, 650, 750, 850],
      );
    }
    assert.ok(calls.filter((c) => c[0] === "play").every((c) => c[1].local));
  }
});

test("orb runtime compiles moving layers, shared landing, width tracks and actual playback timeline", async () => {
  const { runtime, calls } = fixture();
  runtime.wait = async () => true;
  const source = { center: { x: 0, y: 0 } },
    target = { center: { x: 300, y: 0 } };
  let compiled;
  await runtime.play(
    orbRecipe(),
    { source, targets: [target] },
    {
      preview: true,
      onStart: (recipe) => {
        compiled = recipe;
      },
    },
  );
  const moves = calls.filter((c) => c[0] === "moveTowards");
  assert.equal(moves.length, 2);
  assert.equal(moves[0][1], moves[1][1]);
  assert.deepEqual(moves[0][2], {
    delay: 500,
    ease: "easeInBack",
    rotate: false,
    cacheLocation: true,
  });
  assert.equal(calls.filter((c) => c[0] === "stretchTo").length, 0);
  assert.ok(calls.some((c) => c[0] === "atLocation" && c[1] === moves[0][1]));
  assert.equal(
    compiled.playbackPlan.find((s) => s.stageId === "impact").delay,
    2500,
  );
  assert.ok(calls.filter((c) => c[0] === "play").every((c) => c[1].local));
});

test("sound, token copies and overlays compile natively and private previews never persist", async () => {
  const { runtime, calls } = fixture();
  const source = { id: "source" };
  const recipe = validateRecipe({
    ...starterRecipes()[0],
    stages: [
      {
        kind: "sound",
        soundFile: "sounds/spell.ogg",
        assets: [],
        delay: 0,
        duration: 500,
        volume: 0.3,
        fadeIn: 100,
        fadeOut: 100,
      },
      {
        kind: "sprite",
        subject: "source",
        assets: [],
        delay: 0,
        duration: 500,
        copies: 2,
        attach: true,
        bindRotation: true,
        shadow: true,
      },
      { kind: "overlay", assets: ["jb2a.impact"], delay: 0, duration: 500 },
    ],
  });
  await runtime.play(recipe, { source, targets: [] }, { preview: true });
  assert.equal(calls.filter((c) => c[0] === "copySprite").length, 2);
  assert.ok(calls.some((c) => c[0] === "sound"));
  assert.ok(calls.some((c) => c[0] === "volume" && c[1] === 0.3));
  assert.ok(calls.some((c) => c[0] === "fadeInAudio" && c[1] === 100));
  assert.ok(calls.some((c) => c[0] === "screenSpace"));
  assert.ok(
    calls.some((c) => c[0] === "attachTo" && c[2].bindRotation === true),
  );
  assert.ok(calls.some((c) => c[0] === "tint" && c[1] === "#000000"));
  assert.ok(
    calls.filter((c) => c[0] === "play").every((c) => c[1].local === true),
  );
  await runtime.stop();
  assert.deepEqual(calls.find((c) => c[0] === "stopSounds")[1], {
    name: "animater-u-*",
  });
});
function fixture() {
  const calls = [];
  const effect = new Proxy(
    {},
    {
      get:
        (_, key) =>
        (...args) => {
          calls.push([key, ...args]);
          return effect;
        },
    },
  );
  const keys = ["jb2a.impact.001.orange", "jb2a.fire_bolt.orange"];
  const host = {
    database: {
      entryExists: () => true,
      getPathsUnder: () => keys,
      getAllFileEntries: (k) => [`${k}.webm`],
    },
    enabled: () => true,
    recipes: () => starterRecipes(),
    ready: () => true,
    canPlay: () => true,
    userId: () => "u",
    sequence: () => ({
      effect: () => {
        calls.push(["effect"]);
        return effect;
      },
      sound: () => {
        calls.push(["sound"]);
        return effect;
      },
      play: async (options) => calls.push(["play", options]),
    }),
    endEffects: async (filters) => calls.push(["stop", filters]),
    endSounds: async (filters) => calls.push(["stopSounds", filters]),
    motion: async (stage, context, options) =>
      calls.push(["motion", stage, context, options]),
    stopMotion: async () => calls.push(["stopMotion"]),
  };
  const runtime = new AnimaterRuntime(host);
  runtime.refreshCatalog();
  return { runtime, host, calls };
}
// Sequencer 4.2.3's effect timer caps a media-time window at .duration(), then
// divides by playbackRate. An opening skip without a range subtracts from it.
// Model that external contract, rather than treating our fluent calls as enough.
function sequencerEffectLifetime(calls) {
  const duration = calls.find((c) => c[0] === "duration")[1];
  const rate = calls.find((c) => c[0] === "playbackRate")?.[1] ?? 1;
  const range = calls.find((c) => c[0] === "timeRange");
  const start = range?.[1] ?? calls.find((c) => c[0] === "startTime")?.[1] ?? 0;
  const end = range?.[2] ?? duration;
  return Math.max(0, Math.min(duration, end - start)) / rate;
}
test("old Force Barrage one-shot clips compile a complete native lifetime and cleanup deadline", async () => {
  for (const playbackRate of [0.5, 1, 2]) {
    const { runtime, calls } = fixture(),
      waits = [];
    runtime.catalog = [{ key: "jb2a.magic_missile.purple" }];
    runtime.wait = async (ms) => {
      waits.push(ms);
      return true;
    };
    let compiled;
    // Playback must repair an existing saved recipe, not rely on a rebuilt catalog.
    const old = {
      ...starterRecipes()[0],
      stages: [
        {
          kind: "travel",
          assets: ["jb2a.magic_missile.purple"],
          duration: 1900,
          oneShot: true,
          fadeOut: 100,
          playbackRate,
        },
      ],
    };
    await runtime.play(
      old,
      { source: {}, targets: [{}] },
      {
        preview: true,
        onStart: (recipe) => {
          compiled = recipe;
        },
      },
    );
    const lifetime = sequencerEffectLifetime(calls);
    assert.ok(lifetime >= 2200 / playbackRate + 100);
    // The whole movie and its fade, never its last frame held for the rest of a longer stage.
    assert.equal(lifetime, Math.min(compiled.playbackPlan[0].duration, Math.ceil(2200 / playbackRate + 100)));
    assert.ok(
      Math.max(...waits) >= lifetime,
      "cleanup must wait through the movie and exit",
    );
    assert.ok(calls.some((c) => c[0] === "loopOptions" && c[1].loops === 1));
  }
});
test("native canvas effects retain stage lifetime with opening skips, speed and explicit clips", async () => {
  for (const options of [
    { duration: 3200, clipStart: 5500 },
    { duration: 2500, playbackRate: 1.25 },
    { duration: 2200, playbackRate: 0.55 },
    { duration: 1000, clipStart: 400, playbackRate: 2 },
    { duration: 1000, clipStart: 400, clipEnd: 3400, playbackRate: 2 },
  ]) {
    const { runtime, calls } = fixture();
    runtime.wait = async () => true;
    const recipe = validateRecipe({
      ...starterRecipes()[0],
      stages: [
        { kind: "cast", assets: ["jb2a.impact.001.orange"], ...options },
      ],
    });
    await runtime.play(recipe, { source: {}, targets: [] }, { preview: true });
    assert.equal(
      sequencerEffectLifetime(calls),
      options.duration,
      JSON.stringify(options),
    );
    assert.equal(recipe.stages[0].duration, options.duration);
  }
  const { runtime, calls } = fixture();
  runtime.wait = async () => true;
  const recipe = validateRecipe({
    ...starterRecipes()[0],
    stages: [
      {
        kind: "cast",
        assets: ["jb2a.impact.001.orange"],
        duration: 1000,
        clipStart: 400,
        clipEnd: 900,
        oneShot: true,
      },
    ],
  });
  await runtime.play(recipe, { source: {}, targets: [] }, { preview: true });
  assert.equal(
    sequencerEffectLifetime(calls),
    500,
    "explicit one-shot clip end remains respected",
  );
});
test("non-area local preview stays active through all repeated and staggered stage endings", async () => {
  const { runtime } = fixture();
  let release,
    completed = false;
  const waits = [];
  runtime.wait = (delay) => {
    waits.push(delay);
    if (delay === 1450)
      return new Promise((resolve) => {
        release = resolve;
      });
    return Promise.resolve(true);
  };
  const recipe = validateRecipe({
    ...starterRecipes()[0],
    stages: [
      {
        kind: "impact",
        assets: ["jb2a.impact.001.orange"],
        duration: 1000,
        repeats: 2,
        repeatInterval: 300,
        targetStagger: 150,
      },
    ],
  });
  const playing = runtime
    .play(recipe, { source: {}, targets: [{}, {}] }, { preview: true })
    .then((result) => {
      completed = true;
      return result;
    });
  await new Promise((resolve) => setImmediate(resolve));
  assert.ok(
    waits.includes(1450),
    "preview waits for last target's last repeated effect",
  );
  assert.equal(completed, false);
  release(true);
  assert.ok(await playing);
  assert.equal(completed, true);
});
test("canvas preview creates temporary area before preflight and removes it after complete or failed playback", async () => {
  for (const failure of ["", "media", "preflight"]) {
    const { runtime, host } = fixture();
    let cleaned = 0,
      started = false;
    host.previewArea = async (recipe, context) => ({
      context: {
        ...context,
        template: {},
        area: { center: { x: 300, y: 200 }, diameter: 600 },
      },
      cleanup: () => cleaned++,
    });
    const recipe = validateRecipe({
      ...starterRecipes()[0],
      stages: [
        {
          kind: "template",
          assets: [
            failure === "preflight" ? "jb2a.missing" : "jb2a.impact.001.orange",
          ],
          duration: 100,
        },
      ],
    });
    // Keep normal compiler fixture; inject failure only at sequence.play.
    if (failure === "media") {
      const { host: nativeHost } = fixture();
      host.sequence = () => ({
        ...nativeHost.sequence(),
        play: async () => {
          throw Error("media failed");
        },
      });
    }
    const playing = runtime.play(
      recipe,
      { source: {}, targets: [] },
      {
        preview: true,
        onStart: () => {
          started = true;
          assert.equal(cleaned, 0);
        },
      },
    );
    if (failure) await assert.rejects(() => playing);
    else await playing;
    assert.equal(started, failure !== "preflight");
    assert.equal(cleaned, 1);
    assert.equal(runtime.previewAreas.size, 0);
  }
});
test("Stop removes preview area immediately; stop during placement cancels playback and cleans late footprint", async () => {
  const { runtime, host, calls } = fixture();
  let release,
    cleaned = 0;
  host.previewArea = () =>
    new Promise((resolve) => {
      release = () =>
        resolve({
          context: { source: {}, targets: [] },
          cleanup: () => cleaned++,
        });
    });
  const recipe = starterRecipes()[0];
  recipe.stages = [recipe.stages[0]];
  const playing = runtime.play(
    recipe,
    { source: {}, targets: [] },
    { preview: true },
  );
  await runtime.stop();
  release();
  await playing;
  assert.equal(cleaned, 1);
  assert.equal(calls.filter((c) => c[0] === "play").length, 0);
  let cleanedActive = false;
  runtime.previewAreas.add({
    cleanup: () => {
      cleanedActive = true;
    },
  });
  await runtime.stop();
  assert.equal(cleanedActive, true);
});
test("table playback never creates temporary preview templates", async () => {
  const { runtime, host } = fixture();
  host.previewArea = () => {
    throw Error("preview-only factory called");
  };
  const recipe = starterRecipes()[0];
  recipe.stages = [recipe.stages[0]];
  await runtime.play(recipe, { source: {}, targets: [] });
});
test("temporary footprint stays through full stage duration when Sequencer resolves early; Stop cleans it exactly once", async () => {
  const { runtime, host } = fixture();
  let cleaned = 0;
  host.previewArea = async () => ({
    context: {
      source: {},
      template: {},
      area: { center: { x: 0, y: 0 }, diameter: 600 },
    },
    cleanup: () => cleaned++,
  });
  const recipe = validateRecipe({
    ...starterRecipes()[0],
    stages: [
      { kind: "template", assets: ["jb2a.impact.001.orange"], duration: 10000 },
    ],
  });
  const playing = runtime.play(
    recipe,
    { source: {}, targets: [] },
    { preview: true },
  );
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(cleaned, 0);
  assert.equal(runtime.previewAreas.size, 1);
  assert.equal(runtime.pending.size, 1);
  await runtime.stop();
  assert.equal(cleaned, 1);
  assert.equal(await playing, null);
  assert.equal(cleaned, 1);
  assert.equal(runtime.pending.size, 0);
});
test("returning projectile starts at target and flies to caster without scattered impact landing", async () => {
  const { runtime, calls } = fixture();
  runtime.wait = async () => true;
  const source = { id: "caster" },
    target = { id: "victim" };
  const r = validateRecipe({
    ...starterRecipes()[0],
    stages: [
      {
        kind: "projectile",
        assets: ["jb2a.impact.001.orange"],
        duration: 400,
        travelOrigin: "target",
        landingGroup: "should-not-scatter",
        scatter: 1,
      },
    ],
  });
  await runtime.play(r, { source, targets: [target] }, { preview: true });
  assert.equal(calls.find((c) => c[0] === "atLocation")[1], target);
  assert.equal(calls.find((c) => c[0] === "moveTowards")[1], source);
});
test("catalogue preview retains canonical beam template and selects 15ft media", () => {
  const { runtime, host } = fixture();
  host.database.getEntry = () => ({
    template: [200, 200, 200],
    getFile: (distance) => `ray_${distance}_1000x400.webm`,
  });
  const [entry] = runtime.refreshCatalog();
  assert.equal(entry.file, "ray_15ft_1000x400.webm");
  assert.deepEqual(entry.template, [200, 200, 200]);
  assert.equal(entry.width, 1000);
  assert.equal(entry.height, 400);
});
test("catalog opens when Sequencer returns a distance map without a 15ft variant", () => {
  const { runtime, host } = fixture();
  const distances = {
    "05ft": ["short_600x400.webm"],
    "30ft": ["long_1600x400.webm"],
  };
  // SequencerFileRangeFind.getFile returns the whole map when requested ft is absent.
  host.database.getEntry = () => ({
    template: [200, 200, 200],
    getFile: () => distances,
  });
  host.database.getAllFileEntries = () => Object.values(distances).flat();
  runtime.catalog = [];
  const refreshed = runtime.getCatalog();
  assert.ok(refreshed.every((e) => e.file === "short_600x400.webm"));
  assert.ok(refreshed.every((e) => e.width === 600 && e.height === 400));
  assert.deepEqual(refreshed[0].template, [200, 200, 200]);
});
test("catalog picks up a library Sequencer registers after the first build", () => {
  const { runtime, host } = fixture();
  const entries = { jb2a: [{ dbPath: "jb2a.fire", getAllFiles: () => ["fire.webm"] }] };
  const paths = { jb2a: ["jb2a.fire"], blfx: ["blfx.torch"] };
  Object.assign(host.database, {
    entries,
    searchFor: () => Object.keys(entries),
    getPathsUnder: (ns) => paths[ns],
    getEntry: () => false,
  });
  assert.deepEqual(runtime.refreshCatalog().map((e) => e.key), ["jb2a.fire"]);
  // BLFX registers late, after sequencer.ready already built the catalog.
  entries.blfx = [{ dbPath: "blfx.torch", getAllFiles: () => ["torch.webm"] }];
  assert.deepEqual(runtime.getCatalog().map((e) => e.key), ["blfx.torch", "jb2a.fire"]);
});
test("catalog skips malformed preview values and uses valid flattened file fallback", () => {
  const { runtime, host } = fixture();
  host.database.getEntry = () => ({ getFile: () => ({ notAMediaFile: true }) });
  host.database.getAllFileEntries = () => [
    null,
    {},
    [["fallback_800x400.webm"]],
  ];
  assert.ok(
    runtime.refreshCatalog().every((e) => e.file === "fallback_800x400.webm"),
  );
  host.database.getAllFileEntries = () => [null, {}];
  assert.ok(runtime.refreshCatalog().every((e) => e.file === ""));
});
test("Sequencer beams use previous creature origins and reverse drain destinations", async () => {
  for (const [route, origins, endpoints] of [
    [
      "previousTarget",
      ["source", "first", "second"],
      ["first", "second", "third"],
    ],
    ["target", ["first", "second", "third"], ["source", "source", "source"]],
    ["source", ["source", "source", "source"], ["first", "second", "third"]],
  ]) {
    const { runtime, calls } = fixture();
    runtime.wait = async () => true;
    const r = validateRecipe({
      ...starterRecipes()[0],
      stages: [
        {
          kind: "travel",
          assets: ["jb2a.impact.001.orange"],
          delay: 0,
          duration: 100,
          travelOrigin: route,
        },
      ],
    });
    await runtime.play(
      r,
      {
        source: { id: "source", center: { x: 0, y: 0 } },
        targets: ["first", "second", "third"].map((id, i) => ({
          id,
          center: { x: (i + 1) * 100, y: 0 },
        })),
      },
      { preview: true },
    );
    assert.deepEqual(
      calls.filter((c) => c[0] === "atLocation").map((c) => c[1].id),
      origins,
    );
    assert.deepEqual(
      calls.filter((c) => c[0] === "stretchTo").map((c) => c[1].id),
      endpoints,
    );
  }
});
test("failed media playback cancels that session's later repetitions and cleans up effects/sounds", async () => {
  const { runtime, host, calls } = fixture();
  let plays = 0;
  const sequence = host.sequence;
  host.sequence = () => ({
    ...sequence(),
    play: async () => {
      plays++;
      throw Error("Audio unavailable");
    },
  });
  const r = validateRecipe({
    ...starterRecipes()[0],
    stages: [
      {
        kind: "sound",
        soundFile: "sounds/missing.wav",
        assets: [],
        delay: 0,
        duration: 1000,
        repeats: 2,
      },
    ],
  });
  await assert.rejects(
    () => runtime.play(r, { source: {}, targets: [] }, { preview: true }),
    /Audio unavailable/,
  );
  assert.equal(plays, 1);
  assert.equal(runtime.pending.size, 0);
  assert.equal(runtime.sessions.size, 0);
  assert.match(
    calls.find((c) => c[0] === "stopSounds")[1].name,
    /^animater-u-/,
  );
  assert.ok(!calls.find((c) => c[0] === "stopSounds")[1].name.endsWith("*"));
});
test("local preview uses local=true and never persists even when recipe requests it", async () => {
  const { runtime, calls } = fixture();
  const r = starterRecipes()[0];
  r.stages = [{ ...r.stages[0], kind: "aura", persist: true }];
  await runtime.play(r, { source: {}, targets: [] }, { preview: true });
  assert.deepEqual(calls.find((c) => c[0] === "play")[1], { local: true });
  assert.ok(!calls.some((c) => c[0] === "persist"));
});
test("authoritative event ID plays once and preserves miss behavior", async () => {
  const { runtime, calls } = fixture();
  const event = {
    id: "same",
    type: "attack",
    item: { name: "Ignition" },
    source: {},
    targets: [{}],
    outcome: "failure",
  };
  await runtime.dispatch(event);
  await runtime.dispatch(event);
  // Played once; a miss bends the flight wide and drops the impact on the target.
  assert.equal(calls.filter((c) => c[0] === "play").length, 2);
  assert.ok(calls.some((c) => c[0] === "missed"));
});
test("preflight prevents partial sequences and enforces ownership", async () => {
  const { runtime, host, calls } = fixture();
  await assert.rejects(
    () => runtime.play(starterRecipes()[0], { source: {}, targets: [] }),
    /Target/,
  );
  assert.equal(calls.length, 0);
  host.canPlay = () => false;
  await assert.rejects(
    () => runtime.play(starterRecipes()[0], { source: {}, targets: [{}] }),
    /ownership/,
  );
});
test("editor playback clock starts only after successful runtime preflight", async () => {
  const { runtime, calls } = fixture();
  let starts = 0;
  const options = {
    preview: true,
    onStart: () => {
      starts++;
      calls.push(["started"]);
    },
  };
  await assert.rejects(
    () =>
      runtime.play(starterRecipes()[0], { source: {}, targets: [] }, options),
    /Target/,
  );
  assert.equal(starts, 0);
  const recipe = starterRecipes()[0];
  recipe.stages = [recipe.stages[0]];
  await runtime.play(recipe, { source: {}, targets: [] }, options);
  assert.equal(starts, 1);
  assert.ok(
    calls.findIndex((c) => c[0] === "started") <
      calls.findIndex((c) => c[0] === "play"),
  );
});
test("disabled automation does no matching or playback", async () => {
  const { runtime, host, calls } = fixture();
  host.enabled = () => false;
  await runtime.dispatch({
    type: "attack",
    item: { name: "Ignition" },
    source: {},
    targets: [{}],
  });
  assert.equal(calls.length, 0);
});
test("catalog recovers when JB2A registers after Foundry ready", () => {
  const { runtime, host } = fixture();
  host.database.entryExists = () => false;
  runtime.refreshCatalog();
  assert.equal(runtime.catalog.length, 0);
  host.database.entryExists = () => true;
  assert.equal(runtime.getCatalog().length, 2);
});
test("stop filter is scoped to this user's module effects", async () => {
  const { runtime, calls } = fixture();
  await runtime.stop();
  assert.deepEqual(
    calls.find((c) => c[0] === "stop"),
    ["stop", { name: "animater-u-*" }],
  );
});
test("mixed recipes schedule token motion beside Sequencer and preserve local-only intent", async () => {
  const { runtime, calls } = fixture();
  const recipe = starterRecipes()[0];
  recipe.stages = [
    {
      kind: "motion",
      motion: "pulse",
      subject: "source",
      assets: [],
      delay: 0,
      duration: 100,
    },
    { ...recipe.stages[0], delay: 0 },
  ];
  const source = { id: "source" };
  await runtime.play(recipe, { source, targets: [] }, { preview: true });
  const motion = calls.find((c) => c[0] === "motion");
  assert.equal(motion[1].destination, source);
  assert.equal(motion[3].preview, true);
  assert.equal(calls.filter((c) => c[0] === "effect").length, 1);
  await runtime.stop();
  assert.ok(calls.some((c) => c[0] === "stopMotion"));
});
test("missing module socket blocks whole table recipe but allows private token preview", async () => {
  const { runtime, host, calls } = fixture();
  host.canSyncMotion = () => false;
  const recipe = starterRecipes()[0];
  recipe.stages = [
    {
      kind: "motion",
      motion: "pulse",
      subject: "source",
      assets: [],
      delay: 0,
      duration: 100,
    },
    { ...recipe.stages[0], delay: 0 },
  ];
  await assert.rejects(
    () => runtime.play(recipe, { source: {}, targets: [] }),
    /Stop and start the Foundry server instance/,
  );
  assert.equal(calls.length, 0);
  await runtime.play(recipe, { source: {}, targets: [] }, { preview: true });
  assert.ok(calls.some((c) => c[0] === "motion"));
});
test("stop cancels delayed stages so no effects appear after stop", async () => {
  const { runtime, calls } = fixture();
  const r = starterRecipes()[0];
  r.stages[1].delay = 10000;
  r.stages[2].delay = 20000;
  const playing = runtime.play(r, { source: {}, targets: [{}] });
  await new Promise((resolve) => setTimeout(resolve, 5));
  await runtime.stop();
  await playing;
  assert.equal(calls.filter((c) => c[0] === "play").length, 1);
  assert.equal(runtime.pending.size, 0);
});

test("a lasting area loops tied to its placed template and plays once without one", async () => {
  const recipe = validateRecipe({ id: "fog", name: "Fog", trigger: "manual", stages: [{ kind: "template", assets: ["jb2a.impact.001.orange"], persist: true, oneShot: false }] });
  const region = { documentName: "Region", id: "r1" };
  const template = { documentName: "MeasuredTemplate", id: "r1", parent: { regions: new Map([["r1", region]]) } };
  const area = { center: { x: 300, y: 300 }, diameter: 400 };
  for (const [placed, tied] of [[template, region], [{}, null]]) {
    const { runtime, calls } = fixture();
    runtime.catalog = [{ key: "jb2a.impact.001.orange" }];
    runtime.wait = async () => true;
    await runtime.play(recipe, { source: { center: { x: 0, y: 0 } }, targets: [], template: placed, area });
    assert.equal(calls.some((c) => c[0] === "persist"), Boolean(tied));
    assert.deepEqual(calls.filter((c) => c[0] === "tieToDocuments").map((c) => c[1]), tied ? [tied] : []);
  }
});

test("an emanation rides on its caster, and concentration ending ends it", async () => {
  const recipe = validateRecipe({ id: "guardians", name: "Guardians", trigger: "manual", stages: [{ kind: "template", assets: ["jb2a.impact.001.orange"], persist: true, oneShot: false, followSource: true }] });
  const region = { documentName: "Region", id: "r1" };
  const source = { id: "tok", center: { x: 0, y: 0 } };
  const { runtime, calls } = fixture();
  runtime.catalog = [{ key: "jb2a.impact.001.orange" }];
  runtime.wait = async () => true;
  const context = { source, targets: [], template: region, area: { center: { x: 0, y: 0 }, diameter: 600 }, actor: { id: "cleric" }, item: { id: "sg", system: { properties: new Set(["concentration"]) } } };
  const session = await runtime.play(recipe, context);
  assert.ok(calls.some((c) => c[0] === "attachTo" && c[1] === source), "attached to the caster");
  assert.ok(!calls.some((c) => c[0] === "atLocation"), "not pinned to the placement point");
  assert.equal(await runtime.endConcentration("someone-else"), 0);
  assert.equal(await runtime.endConcentration("cleric", "sg"), 1);
  assert.ok(calls.some((c) => c[0] === "stop" && c[1]?.name === session));
  assert.equal(await runtime.endConcentration("cleric", "sg"), 0, "ended once");
});

test("players who turned Animater off hear no sounds either", async () => {
  const recipe = validateRecipe({ id: "s", name: "S", trigger: "manual", stages: [{ stageId: "a", kind: "impact", assets: ["jb2a.impact.001.orange"] }, { stageId: "b", kind: "sound", soundFile: "hit.ogg", assets: [] }] });
  const context = { source: { center: { x: 0, y: 0 } }, targets: [{ center: { x: 100, y: 0 } }] };
  for (const [listeners, sounds, filtered] of [[null, 1, false], [["u2"], 1, true], [[], 0, false]]) {
    const { runtime, host, calls } = fixture();
    host.soundUsers = () => listeners;
    runtime.catalog = [{ key: "jb2a.impact.001.orange" }];
    runtime.wait = async () => true;
    await runtime.play(recipe, context);
    assert.equal(calls.filter((c) => c[0] === "sound").length, sounds, JSON.stringify(listeners));
    assert.equal(calls.some((c) => c[0] === "forUsers" && c[1] === listeners), filtered);
  }
});

test("sound data carries scene and level", async () => {
  const recipe = validateRecipe({ id: "s", name: "S", trigger: "manual", stages: [{ stageId: "b", kind: "sound", soundFile: "hit.ogg", subject: "source", assets: [] }] });
  const dataOf = async (source) => {
    const { runtime, host, calls } = fixture();
    host.viewedScene = () => "viewed";
    host.viewedLevel = () => ({ level: "viewedLevel", elevation: 0 });
    runtime.wait = async () => true;
    await runtime.play(recipe, { source, targets: [] });
    const [, fn] = calls.find((c) => c[0] === "addOverride");
    return fn(null, {});
  };
  // The token's own scene and level.
  const token = await dataOf({ id: "s", center: { x: 50, y: 50 }, document: { parent: { id: "S1" }, level: "L2" } });
  assert.deepEqual([token.animaterScene, token.animaterLevel, token.animaterAt], ["S1", "L2", { x: 50, y: 50 }]);
  // Without them, what the caster views.
  const bare = await dataOf({ id: "s", center: { x: 50, y: 50 } });
  assert.deepEqual([bare.animaterScene, bare.animaterLevel], ["viewed", "viewedLevel"]);
});

test("a stay-until-the-effect-ends layer ends with its item's effect", async () => {
  const recipe = validateRecipe({ id: "shield", name: "Shield", trigger: "manual", stages: [{ kind: "aura", assets: ["jb2a.impact.001.orange"], persist: true }] });
  const { runtime, calls } = fixture();
  runtime.catalog = [{ key: "jb2a.impact.001.orange" }];
  runtime.wait = async () => true;
  const source = { id: "tok", center: { x: 0, y: 0 }, actor: { id: "wizard" } };
  const session = await runtime.play(recipe, { source, targets: [], item: { id: "sh", name: "Shield" } });
  assert.equal(await runtime.endConcentration("wizard"), 0, "not a concentration layer");
  assert.equal(await runtime.endWithEffect("someone-else", { itemId: "sh" }), 0);
  assert.equal(await runtime.endWithEffect("wizard", { name: "Spell Effect: Shield" }), 1, "matched by effect name");
  assert.ok(calls.some((c) => c[0] === "stop" && c[1]?.name === session));
  assert.equal(await runtime.endWithEffect("wizard", { itemId: "sh" }), 0, "ended once");
  await runtime.play(recipe, { source, targets: [], item: { id: "sh", name: "Shield" } });
  assert.equal(await runtime.endWithEffect("wizard", { itemId: "sh" }), 1, "matched by item id");
});

test("a stay-until-the-effect-ends layer stops if no effect is ever applied", async () => {
  const recipe = validateRecipe({ id: "shield", name: "Shield", trigger: "manual", stages: [{ kind: "aura", assets: ["jb2a.impact.001.orange"], persist: true }] });
  for (const applied of [false, true]) {
    const { runtime } = fixture();
    runtime.catalog = [{ key: "jb2a.impact.001.orange" }];
    runtime.wait = async () => true;
    runtime.effectGrace = 5;
    runtime.host.hasItemEffect = () => applied;
    await runtime.play(recipe, { source: { id: "tok", center: { x: 0, y: 0 } }, targets: [], actor: { id: "wizard" }, item: { id: "sh", name: "Shield" } });
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(runtime.lasting.length, applied ? 1 : 0);
    for (const l of runtime.lasting) clearTimeout(l.grace);
  }
});


test("a recipe's linked flash screen plays first at the table, never in a preview", async () => {
  const recipe = validateRecipe({ id: "f", name: "Fury", trigger: "manual", flash: "sig-move", stages: [{ kind: "cast", assets: ["jb2a.impact.001.orange"] }] });
  assert.equal(recipe.flash, "sig-move");
  assert.equal(validateRecipe({ ...recipe, flash: "bad id!" }).flash, undefined);
  const { runtime, calls } = fixture();
  runtime.catalog = [{ key: "jb2a.impact.001.orange" }];
  runtime.wait = async () => true;
  const order = [];
  runtime.host.flashBefore = async (r) => { order.push(`flash:${r.flash}`); };
  const realSequence = runtime.host.sequence;
  runtime.host.sequence = () => { order.push("animation"); return realSequence(); };
  await runtime.play(recipe, { source: { center: { x: 0, y: 0 } }, targets: [] });
  assert.deepEqual(order.slice(0, 2), ["flash:sig-move", "animation"]);
  order.length = 0;
  await runtime.play(recipe, { source: { center: { x: 0, y: 0 } }, targets: [] }, { preview: true });
  assert.ok(!order.includes("flash:sig-move"), "previews skip the flash screen");
  assert.ok(calls.length > 0);
});
test("Shield's force dome is centred on the caster, not pushed off to one side", () => {
  const r = spellRecipe(PF2E_SPELLS.find((s) => s.name === "Shield"), undefined, {});
  for (const s of r.stages.filter((s) => s.kind !== "motion")) assert.equal(s.offsetX ?? 0, 0, s.label);
});
test("a one-time animation stuck on a client is ended everywhere shortly after its planned end; lasting ones are left alone", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { runtime, calls } = fixture();
  const r = starterRecipes()[0];
  r.stages = [{ ...r.stages[0], kind: "cast", persist: false, delay: 0, duration: 800 }];
  const session = await runtime.play(r, { source: {}, targets: [] });
  t.mock.timers.tick(800 + 4999);
  assert.ok(!calls.some((c) => c[0] === "stop"), "not before its grace");
  t.mock.timers.tick(1);
  assert.deepEqual(calls.find((c) => c[0] === "stop")?.[1], { name: session });
  calls.length = 0;
  r.stages = [{ ...r.stages[0], kind: "aura", persist: true }];
  await runtime.play(r, { source: {}, targets: [] });
  t.mock.timers.tick(60000);
  assert.ok(!calls.some((c) => c[0] === "stop" && c[1]?.name !== undefined && !String(c[1].name).endsWith("*")), "lasting layers are not cut");
});
test("a lasting layer loops its whole clip: no stage duration cuts its loop short", async () => {
  const { runtime, calls } = fixture();
  const r = starterRecipes()[0];
  r.stages = [{ ...r.stages[0], kind: "aura", persist: true, duration: 2300 }];
  await runtime.play(r, { source: {}, targets: [] });
  assert.ok(calls.some((c) => c[0] === "persist"));
  assert.ok(!calls.some((c) => c[0] === "duration"), "a persisted effect must not get .duration()");
  calls.length = 0;
  await runtime.play(r, { source: {}, targets: [] }, { preview: true });
  assert.ok(calls.some((c) => c[0] === "duration"), "a preview still plays its stage length");
});

test("a weapon's damage roll is not reported as having no animation when its attack animates", async () => {
  const f = fixture(), item = { name: "+1 Dagger", type: "weapon" }, recipe = starterRecipes()[0];
  f.host.recipes = () => [];
  f.host.resolveRecipe = (event) => (event.type === "attack" ? recipe : null);
  await f.runtime.dispatch({ type: "damage", item });
  assert.equal(f.runtime.log.some((e) => e.status === "Skipped"), false);
  // A weapon with no attack animation either is still reported.
  f.host.resolveRecipe = () => null;
  await f.runtime.dispatch({ type: "damage", item });
  assert.match(f.runtime.log.find((e) => e.status === "Skipped").detail, /\+1 Dagger: no enabled damage recipe/);
});

// One impact per target over five targets: the per-target copies of one stage.
function manyTargets() {
  const recipe = validateRecipe({
    ...starterRecipes()[0],
    stages: [{ kind: "impact", assets: ["jb2a.impact.001.orange"], delay: 0, duration: 100 }],
  });
  const context = {
    source: { id: "tok", actor: { id: "A1" }, center: { x: 0, y: 0 } },
    targets: Array.from({ length: 5 }, (_, i) => ({ id: `t${i}`, center: { x: (i + 1) * 100, y: 0 } })),
  };
  return { recipe, context };
}
test("per-target copies are staggered at the table, never in preview", async () => {
  const { recipe, context } = manyTargets();
  const delaysOf = async (preview) => {
    const { runtime, host, calls } = fixture();
    host.adaptive = () => ({ stagger: true, staggered: (n) => counted.push(n) });
    runtime.wait = async () => true;
    await runtime.play(recipe, context, { preview });
    return calls.filter((c) => c[0] === "delay").map((c) => c[1]);
  };
  const counted = [];
  assert.deepEqual(await delaysOf(false), [16, 32, 48, 50]);
  assert.deepEqual(counted, [4]);
  assert.deepEqual(await delaysOf(true), []);
  assert.deepEqual(counted, [4]);
  const { runtime, calls } = fixture();
  runtime.wait = async () => true;
  await runtime.play(recipe, context);
  assert.deepEqual(calls.filter((c) => c[0] === "delay"), []);
});
test("every effect is tagged with its tier and whether it lasts", async () => {
  const { recipe, context } = manyTargets();
  const { runtime, calls } = fixture();
  runtime.wait = async () => true;
  await runtime.play(recipe, context);
  const overrides = calls.filter((c) => c[0] === "addOverride");
  assert.equal(overrides.length, 5);
  for (const [, fn] of overrides) {
    const data = await fn(null, { keep: 1 });
    assert.ok([0, 1, 2].includes(data.animaterTier));
    assert.equal(data.animaterLasting, false);
    assert.equal(data.animaterPreview, undefined);
    assert.equal(data.keep, 1);
  }
  const preview = fixture();
  preview.runtime.wait = async () => true;
  await preview.runtime.play(recipe, context, { preview: true });
  const tagged = preview.calls.filter((c) => c[0] === "addOverride");
  assert.ok(tagged.length);
  for (const [, fn] of tagged) assert.equal((await fn(null, {})).animaterPreview, true);
});
test("effects carry the source actor so every client can remember what it played", async () => {
  const { recipe, context } = manyTargets();
  const { runtime, host, calls } = fixture();
  const remembered = [];
  host.rememberAssets = (...args) => remembered.push(args);
  runtime.wait = async () => true;
  await runtime.play(recipe, context);
  const overrides = calls.filter((c) => c[0] === "addOverride");
  assert.ok(overrides.length);
  for (const [, fn] of overrides) assert.equal((await fn(null, {})).animaterActor, "A1");
  // Remembering happens on each client as effects arrive (engines/playback/adaptive-host.mjs).
  assert.deepEqual(remembered, []);
  const anonymous = fixture();
  anonymous.runtime.wait = async () => true;
  await anonymous.runtime.play(recipe, { ...context, source: { ...context.source, actor: undefined } });
  for (const [, fn] of anonymous.calls.filter((c) => c[0] === "addOverride")) assert.equal("animaterActor" in (await fn(null, {})), false);
});
test("effects carry the recipe's name, origin and player so every client can explain them on hover", async () => {
  const { recipe, context } = manyTargets();
  const { runtime, host, calls } = fixture();
  host.recipeOrigin = () => ({ type: "catalog", system: "pf2e", kind: "spell", id: "fireball" });
  runtime.wait = async () => true;
  await runtime.play(recipe, { ...context, automatic: true });
  const overrides = calls.filter((c) => c[0] === "addOverride");
  assert.ok(overrides.length);
  for (const [, fn] of overrides) {
    const { animaterRecipe } = await fn(null, {});
    assert.equal(animaterRecipe.name, recipe.name);
    assert.deepEqual(animaterRecipe.origin, { type: "catalog", system: "pf2e", kind: "spell", id: "fireball" });
    assert.equal(animaterRecipe.by, host.userId());
  }
  const preview = fixture();
  preview.runtime.wait = async () => true;
  await preview.runtime.play(recipe, context, { preview: true });
  for (const [, fn] of preview.calls.filter((c) => c[0] === "addOverride")) assert.equal("animaterRecipe" in (await fn(null, {})), false);
});

// A critical attack: a flight lands at 600 ms (its own impact); the attacker's wind-up spans it; one more hit follows.
function critAttack() {
  const recipe = validateRecipe({
    ...starterRecipes()[0],
    stages: [
      { stageId: "fly", kind: "travel", assets: ["jb2a.fire_bolt.orange"], delay: 0, duration: 1000 },
      { stageId: "windup", kind: "motion", motion: "stagger", subject: "source", assets: [], delay: 300, duration: 600 },
      { stageId: "hit", kind: "impact", assets: ["jb2a.impact.001.orange"], delay: 600, duration: 500 },
      { stageId: "after", kind: "impact", assets: ["jb2a.impact.002.blue"], delay: 1200, duration: 300 },
    ],
  });
  const context = { id: "ev1", outcome: "criticalSuccess", source: { id: "s", center: { x: 0, y: 0 } }, targets: [{ id: "t1", center: { x: 300, y: 0 } }] };
  return { recipe, context };
}
function critFixture() {
  const f = fixture();
  f.runtime.catalog = ["jb2a.fire_bolt.orange", "jb2a.impact.001.orange", "jb2a.impact.002.blue", "jb2a.finisher.test"].map((key) => ({ key }));
  f.waits = [];
  f.runtime.wait = async (ms) => { f.waits.push(ms); return true; };
  return f;
}
// Each effect's override data, by the asset it plays.
async function overridesByAsset(calls) {
  const out = [];
  let pending = null;
  for (const c of calls) {
    if (c[0] === "addOverride") pending = c[1];
    else if (c[0] === "file" && pending) { out.push([c[1], await pending(null, {})]); pending = null; }
  }
  return out;
}
test("a crit attack plays on its own timing", async () => {
  const { recipe, context } = critAttack();
  const planOf = async (outcome) => {
    const { runtime } = critFixture();
    let plan;
    await runtime.play(recipe, { ...context, outcome }, { onStart: (r) => { plan = r.playbackPlan; } });
    return { plan };
  };
  const crit = await planOf("criticalSuccess"), plain = await planOf("success");
  // The recipe's own stages keep their times (a crit only adds its own accents). The hit lands with the bolt:
  // 3 squares out, the 15 ft clip's bolt lands at its measured time, not at the recipe's 550 ms.
  const delays = ({ plan }) => Object.fromEntries(plan.filter((s) => recipe.stages.some((r) => r.stageId === s.stageId)).map((s) => [s.stageId, s.delay]));
  const moved = MEDIA_LANDINGS["jb2a.fire_bolt.orange.15ft"] - 550;
  assert.deepEqual(delays(crit), { fly: 0, windup: 300, hit: 600 + moved, after: 1200 + moved });
  assert.deepEqual(delays(crit), delays(plain));
});

// Effect lighting: the starting client tags each light's anchor effect (engines/lighting/effect-lights.mjs).
function fireball() {
  const recipe = validateRecipe({
    ...starterRecipes()[0],
    stages: [
      { stageId: "fly", kind: "travel", assets: ["jb2a.fireball.beam.orange"], delay: 0, duration: 1000 },
      { stageId: "boom", kind: "template", assets: ["jb2a.fireball.explosion.orange"], delay: 900, duration: 1500 },
    ],
  });
  const context = {
    source: { id: "s", center: { x: 0, y: 0 } },
    targets: [{ id: "t1", center: { x: 600, y: 0 } }],
    template: {},
    area: { type: "circle", center: { x: 600, y: 0 }, diameter: 400 },
  };
  return { recipe, context };
}
function lightFixture(on = true) {
  const f = fixture();
  f.runtime.catalog = ["jb2a.fireball.beam.orange", "jb2a.fireball.explosion.orange", "jb2a.arrow.physical.white"].map((key) => ({ key }));
  f.runtime.wait = async () => true;
  f.host.effectLights = () => on;
  return f;
}
test("fireball tags its explosion with a flash light", async () => {
  const { recipe, context } = fireball();
  const { runtime, calls } = lightFixture();
  await runtime.play(recipe, context);
  const lights = Object.fromEntries((await overridesByAsset(calls)).map(([asset, data]) => [asset, data.animaterLight]));
  assert.equal(lights["jb2a.fireball.explosion.orange"]?.shape, "flash");
  assert.equal(lights["jb2a.fireball.explosion.orange"].color, "#ff9a4d");
  assert.equal(lights["jb2a.fireball.beam.orange"]?.shape, "glow");
});
test("physical arrow gets no light", async () => {
  const recipe = validateRecipe({
    ...starterRecipes()[0],
    stages: [{ stageId: "arrow", kind: "projectile", assets: ["jb2a.arrow.physical.white"], delay: 0, duration: 800 }],
  });
  const { runtime, calls } = lightFixture();
  await runtime.play(recipe, fireball().context);
  const data = await overridesByAsset(calls);
  assert.ok(data.length);
  for (const [, d] of data) assert.equal("animaterLight" in d, false);
});
test("setting off: no tags", async () => {
  const { recipe, context } = fireball();
  const { runtime, calls } = lightFixture(false);
  await runtime.play(recipe, context);
  const data = await overridesByAsset(calls);
  assert.ok(data.length);
  for (const [, d] of data) assert.equal("animaterLight" in d, false);
  // A preview always shows its lights.
  const preview = lightFixture(false);
  await preview.runtime.play(recipe, context, { preview: true });
  assert.ok((await overridesByAsset(preview.calls)).some(([, d]) => d.animaterLight));
});
test("a line template lights its middle, as far as half its length", async () => {
  const bolt = { stageId: "bolt", kind: "template", assets: ["jb2a.fireball.explosion.orange"], delay: 100, duration: 1000 };
  const context = {
    source: { id: "s", center: { x: 0, y: 0 } },
    // The target stands at the line's middle, far from its start.
    targets: [{ id: "t1", center: { x: 500, y: 0 } }],
    template: {},
    area: { type: "line", center: { x: 0, y: 0 }, endpoint: { x: 1000, y: 0 }, length: 1000, width: 100 },
  };
  const lightsOf = async (stages) => {
    const { runtime, calls } = lightFixture();
    await runtime.play(validateRecipe({ ...starterRecipes()[0], stages }), context);
    return (await overridesByAsset(calls)).map(([, d]) => d.animaterLight).filter(Boolean);
  };
  // Alone, the line lights half its length.
  const alone = await lightsOf([bolt]);
  assert.equal(alone.length, 1);
  assert.equal(alone[0].dim, 1.5 * 500 / 100);
  // An earlier burst on the target, at the line's middle, shares the line's spot and describes its light.
  // (Listed second, the burst is not tier 0, so only the line can carry a light.)
  const shared = await lightsOf([bolt, { stageId: "burn", kind: "impact", assets: ["jb2a.fireball.explosion.orange"], delay: 0, duration: 500, scale: 4 }]);
  assert.equal(shared.length, 1);
  assert.equal(shared[0].dim, 1.5 * (100 * 4 / 2) / 100);
});
test("a circle template's light follows its diameter and scale", async () => {
  const { context } = fireball();
  const recipe = validateRecipe({
    ...starterRecipes()[0],
    stages: [{ stageId: "boom", kind: "template", assets: ["jb2a.fireball.explosion.orange"], delay: 0, duration: 1500, scale: 1.5 }],
  });
  const { runtime, calls } = lightFixture();
  await runtime.play(recipe, context);
  const light = (await overridesByAsset(calls)).map(([, d]) => d.animaterLight).find(Boolean);
  assert.equal(light.dim, 1.5 * (400 * 1.5 / 2) / 100);
});
const tagsOf = async (stages, context, extra = {}) => {
  const { runtime, calls } = lightFixture();
  await runtime.play(validateRecipe({ ...starterRecipes()[0], stages }), { ...context, ...extra });
  return (await overridesByAsset(calls)).map(([, d]) => d.animaterLight).filter(Boolean);
};
test("a cone's light sits at the cone's middle, not on the caster", async () => {
  const context = {
    source: { id: "s", center: { x: 0, y: 0 } },
    targets: [{ id: "t1", center: { x: 500, y: 0 } }],
    template: {},
    area: { type: "cone", center: { x: 0, y: 0 }, endpoint: { x: 1000, y: 0 }, length: 1000, angle: 90 },
  };
  const [tag] = await tagsOf([{ stageId: "cone", kind: "template", assets: ["jb2a.fireball.explosion.orange"], delay: 0, duration: 1000 }], context);
  assert.deepEqual(tag.at, { x: 500, y: 0 });
  assert.equal(tag.follow, undefined);
});
test("a persisted area's light lasts until its effect ends", async () => {
  const [tag] = await tagsOf([{ stageId: "wall", kind: "template", assets: ["jb2a.fireball.explosion.orange"], delay: 0, duration: 1500, persist: true }], fireball().context);
  assert.equal(tag.lasting, true);
  assert.equal(tag.lengthMs, 86400000);
  assert.deepEqual(tag.at, { x: 600, y: 0 });
});
test("an aura's light follows its token", async () => {
  const [tag] = await tagsOf([{ stageId: "aura", kind: "aura", assets: ["jb2a.fireball.explosion.orange"], delay: 0, duration: 1500, persist: true }], fireball().context);
  assert.equal(tag.follow, true);
  assert.equal(tag.at, undefined);
});
test("lights carry the source token's level and elevation", async () => {
  const { context } = fireball();
  const source = { ...context.source, document: { level: "lvl2", elevation: 15 } };
  const tags = await tagsOf(fireball().recipe.stages, { ...context, source });
  assert.ok(tags.length >= 2);
  for (const tag of tags) {
    assert.equal(tag.level, "lvl2");
    assert.equal(tag.elevation, 15);
  }
  for (const tag of await tagsOf(fireball().recipe.stages, context)) assert.equal("level" in tag, false);
});
test("lights on a crit play keep the plan's own timing", async () => {
  const { recipe, context } = critAttack();
  // A luminous burst after contact, lit through the tier 0 hit at the same spot.
  const stages = [...recipe.stages, { stageId: "boom", kind: "impact", assets: ["jb2a.fireball.explosion.orange"], delay: 1200, duration: 500 }];
  const lightOnHit = async (outcome) => {
    const f = critFixture();
    f.runtime.catalog = [...f.runtime.catalog, { key: "jb2a.fireball.explosion.orange" }];
    f.host.effectLights = () => true;
    let plan;
    await f.runtime.play(validateRecipe({ ...recipe, stages }), { ...context, outcome }, { onStart: (r) => { plan = r.playbackPlan; } });
    const data = (await overridesByAsset(f.calls)).find(([asset]) => asset === "jb2a.impact.001.orange")[1];
    return { light: data.animaterLight, plan };
  };
  const crit = await lightOnHit("criticalSuccess"), plain = await lightOnHit("success");
  assert.equal(plain.light.startMs, 600);
  assert.equal(crit.light.startMs, 600);
  assert.equal(crit.plan.find((s) => s.stageId === "boom").delay - crit.plan.find((s) => s.stageId === "hit").delay, 600);
  assert.equal(crit.light.shape, "flash");
});

// Wall-aware shots (engines/playback/flight-path.mjs): a wall runs north-south at x = 300.
const WALL_X = 300;
const wallAt = ({ door = false } = {}) => (a, b) => {
  if ((a.x - WALL_X) * (b.x - WALL_X) >= 0) return null;
  const t = (WALL_X - a.x) / (b.x - a.x);
  return { x: WALL_X, y: a.y + (b.y - a.y) * t, ...(door ? { door: true } : {}) };
};
const WALL_IMPACT = "jb2a.impact.005.white";
// A bolt, its hit on the target 600 ms in, the target's reaction, and the shooter recoiling after the hit.
function boltAttack(extra = {}) {
  const recipe = validateRecipe({
    ...starterRecipes()[0],
    stages: [
      { stageId: "fly", kind: "travel", assets: ["jb2a.fire_bolt.orange"], delay: 0, duration: 1000 },
      { stageId: "hit", kind: "impact", assets: ["jb2a.impact.001.orange"], delay: 600, duration: 500 },
      { stageId: "react", kind: "motion", motion: "stagger", subject: "targets", assets: [], afterStage: "hit", timingAnchor: "start", startOffset: 0, duration: 400 },
      { stageId: "recoil", kind: "motion", motion: "stagger", subject: "source", assets: [], afterStage: "hit", timingAnchor: "start", startOffset: 0, duration: 300 },
    ],
  });
  const context = {
    id: "shot1",
    type: "attack",
    outcome: "success",
    source: { id: "s", center: { x: 0, y: 0 }, w: 100, h: 100 },
    targets: [{ id: "t1", center: { x: 600, y: 0 }, w: 100, h: 100 }],
    ...extra,
  };
  return { recipe, context };
}
// A missed bolt (nothing hangs off its hit, which a miss drops).
function boltMiss() {
  const { recipe, context } = boltAttack({ outcome: "failure" });
  return { recipe: validateRecipe({ ...recipe, stages: recipe.stages.slice(0, 2) }), context };
}
function wallFixture(collides = wallAt()) {
  const f = fixture();
  f.runtime.catalog = ["jb2a.fire_bolt.orange", "jb2a.impact.001.orange", "jb2a.fireball.beam.orange", WALL_IMPACT].map((key) => ({ key }));
  f.runtime.wait = async () => true;
  f.host.collides = collides;
  return f;
}
const filesOf = (calls) => calls.filter((c) => c[0] === "file").map((c) => c[1]);
async function playWall(recipe, context, { collides, options = {}, setup } = {}) {
  const f = wallFixture(collides);
  setup?.(f);
  let plan;
  await f.runtime.play(recipe, context, { ...options, onStart: (r) => { plan = r.playbackPlan; } });
  return { ...f, plan };
}
test("blocked attack strikes the wall", async () => {
  const { recipe, context } = boltAttack();
  const { calls, plan } = await playWall(recipe, context);
  // The bolt stretches to the wall point, from a fixed start.
  const stretch = calls.find((c) => c[0] === "stretchTo");
  assert.deepEqual(stretch[1], { x: WALL_X, y: 0 });
  assert.deepEqual(stretch[2], { cacheLocation: true });
  assert.ok(calls.some((c) => c[0] === "atLocation" && c[1].x === 0 && c[1].y === 0 && !c[1].id));
  // The target's hit and its reaction are gone; a small impact plays at the wall as the bolt arrives.
  const files = filesOf(calls);
  assert.ok(!files.includes("jb2a.impact.001.orange"));
  assert.ok(files.includes(WALL_IMPACT));
  assert.ok(!calls.some((c) => c[0] === "motion" && c[1].stageId === "react"));
  const wall = plan.find((s) => s.kind === "impact");
  assert.deepEqual(wall.landing, { x: WALL_X, y: 0 });
  // As the bolt reaches the wall: 3 squares out Sequencer plays the 15 ft fire bolt clip, whose bolt lands at
  // its measured time (data/media-landings.mjs), not at 55% of the flight.
  const landing = MEDIA_LANDINGS["jb2a.fire_bolt.orange.15ft"];
  assert.equal(wall.delay, landing);
  assert.equal(plan.find((s) => s.stageId === "fly").flightArrivalShift, landing - 550);
  // What followed the hit moves with the strike (the hit was 50 ms after the recipe's 550 ms arrival).
  assert.equal(plan.find((s) => s.stageId === "recoil").delay, landing + 50);
  // Sized to 0.6 of the bolt's footprint, not the target.
  const at = calls.findIndex((c) => c[0] === "file" && c[1] === WALL_IMPACT);
  assert.equal(calls.slice(at).find((c) => c[0] === "size")[1].width, 60);
  assert.ok(calls.slice(at).some((c) => c[0] === "atLocation" && c[1].x === WALL_X));
});
test("a wall strike knocks on stone, on wood for a door, when the recipe has sounds", async () => {
  const sounded = (r) => validateRecipe({ ...r, stages: [...r.stages, { stageId: "twang", kind: "sound", soundFile: "sounds/bow.ogg", assets: [], delay: 0, duration: 400, volume: 0.5 }] });
  const files = (key) => SURFACE_SOUND_PROFILES[key][0].candidates.filter((c) => c.module === "animater").map((c) => c.file);
  for (const [door, key] of [[false, "surface-blunt-stone"], [true, "surface-blunt-wood"]]) {
    const { recipe, context } = boltAttack();
    const { plan } = await playWall(sounded(recipe), context, { collides: wallAt({ door }) });
    const cue = plan.find((s) => s.kind === "sound" && s.surfaceRole === "cue");
    assert.ok(cue, "a wall cue plays");
    assert.ok(files(key).includes(cue.soundFile), `${cue.soundFile} from ${key}`);
    assert.equal(cue.delay, MEDIA_LANDINGS["jb2a.fire_bolt.orange.15ft"]);
  }
  // Without sounds in the recipe the wall stays silent.
  const { recipe, context } = boltAttack();
  const { plan } = await playWall(recipe, context);
  assert.ok(!plan.some((s) => s.kind === "sound"));
});
test("only the blocked target loses its impact", async () => {
  const clear = { id: "t2", center: { x: 0, y: 600 }, w: 100, h: 100 };
  const { recipe, context } = boltAttack();
  const { calls, plan } = await playWall(recipe, { ...context, targets: [...context.targets, clear] });
  const hits = plan.filter((s) => s.stageId === "hit");
  assert.deepEqual(hits.map((s) => s.destination.id), ["t2"]);
  assert.ok(calls.some((c) => c[0] === "atLocation" && c[1] === clear));
  assert.ok(!calls.some((c) => c[0] === "atLocation" && c[1] === context.targets[0]));
  assert.equal(plan.filter((s) => s.kind === "impact" && s.landing?.x === WALL_X).length, 1);
  // The clear target still reacts; the shooter's recoil keeps the clear hit's time.
  assert.deepEqual(plan.filter((s) => s.stageId === "react").map((s) => s.destination.id), ["t2"]);
  assert.equal(plan.find((s) => s.stageId === "recoil").delay, 600);
});
test("miss uses the planned line, not missed()", async () => {
  const { recipe, context } = boltMiss();
  const { calls } = await playWall(recipe, context, { collides: () => null });
  assert.ok(!calls.some((c) => c[0] === "missed"));
  const stretch = calls.find((c) => c[0] === "stretchTo");
  assert.deepEqual(stretch[2], { cacheLocation: true });
  // On past the target, off to one side, and fading out over its last 150 ms.
  assert.ok(Math.hypot(stretch[1].x, stretch[1].y) > 600);
  assert.ok(stretch[1].y !== 0);
  assert.ok(calls.some((c) => c[0] === "fadeOut" && c[1] === 150));
});
test("a miss into a wall strikes the wall", async () => {
  const { recipe, context } = boltMiss();
  const { calls, plan } = await playWall(recipe, context);
  assert.ok(!calls.some((c) => c[0] === "missed"));
  assert.equal(calls.find((c) => c[0] === "stretchTo")[1].x, WALL_X);
  assert.ok(filesOf(calls).includes(WALL_IMPACT));
  assert.ok(!calls.some((c) => c[0] === "fadeOut" && c[1] === 150));
  assert.equal(plan.filter((s) => s.kind === "impact").length, 1);
  // The shot never reached the target, so it does not dodge.
  assert.ok(!plan.some((s) => s.stageId === "miss-dodge"));
});
test("a miss that passes its target before a wall still dodges", async () => {
  const { recipe, context } = boltMiss();
  const beyond = (a, b) => ((a.x - 700) * (b.x - 700) >= 0 ? null : { x: 700, y: a.y + (b.y - a.y) * (700 - a.x) / (b.x - a.x) });
  const { calls, plan } = await playWall(recipe, context, { collides: beyond });
  assert.equal(calls.find((c) => c[0] === "stretchTo")[1].x, 700);
  assert.ok(plan.some((s) => s.stageId === "miss-dodge"));
});
test("collides failure falls back to today", async (t) => {
  const warn = t.mock.method(console, "warn", () => {});
  const { recipe, context } = boltMiss();
  const { calls, plan } = await playWall(recipe, context, { collides: () => { throw Error("no backend"); } });
  assert.ok(calls.some((c) => c[0] === "missed"));
  assert.equal(calls.find((c) => c[0] === "stretchTo")[1], context.targets[0]);
  assert.ok(!plan.some((s) => s.flightTo));
  // It says so once, not on every play.
  await playWall(recipe, context, { collides: () => { throw Error("no backend"); } });
  assert.equal(warn.mock.callCount(), 1);
});
// Sequencer refuses to stretch over a distance of 0 (a finisher's mover on its target): the flight is left out.
test("a flight from a spot to itself is left out; the rest still plays", async () => {
  const { recipe, context } = boltAttack({ targets: [{ id: "t1", center: { x: 0, y: 0 }, w: 100, h: 100 }] });
  const { calls } = await playWall(recipe, context, { setup: (f) => { f.host.projectileWalls = () => false; } });
  assert.equal(calls.filter((c) => c[0] === "stretchTo").length, 0);
  assert.ok(!filesOf(calls).includes("jb2a.fire_bolt.orange"));
  assert.ok(filesOf(calls).includes("jb2a.impact.001.orange"));
});

test("setting off keeps today's flights", async () => {
  const { recipe, context } = boltAttack();
  const { calls, plan } = await playWall(recipe, context, { setup: (f) => { f.host.projectileWalls = () => false; } });
  assert.equal(calls.find((c) => c[0] === "stretchTo")[1], context.targets[0]);
  assert.ok(filesOf(calls).includes("jb2a.impact.001.orange"));
  assert.ok(!filesOf(calls).includes(WALL_IMPACT));
  assert.ok(!plan.some((s) => s.flightTo));
});
// Each Sequencer effect's own calls (the fixture shares one effect proxy).
const effectsOf = (calls) => calls.reduce((all, c) => (c[0] === "effect" ? all.push([]) : all.at(-1)?.push(c), all), []);
test("a thrown bomb flies its plain clip: no arc, no shadow", async () => {
  const BOMB = "jb2a.throwable.throw.bomb.01.black";
  const { recipe, context } = boltAttack();
  const lob = validateRecipe({ ...recipe, stages: recipe.stages.map((s) => (s.stageId === "fly" ? { ...s, assets: [BOMB] } : s)) });
  const below = { ...context, targets: [{ id: "t1", center: { x: 0, y: 600 }, w: 100, h: 100 }] };
  const { calls } = await playWall(lob, below, { collides: () => null, setup: (f) => f.runtime.catalog.push({ key: BOMB }) });
  const fly = effectsOf(calls).find((e) => e.some((c) => c[0] === "file" && c[1] === BOMB));
  assert.equal(fly.find((c) => c[0] === "duration")[1], 1000);
  assert.ok(!calls.some((c) => c[0] === "shape" || c[0] === "animateProperty"));
});
test("a thrown projectile keeps its whole clip; at a wall its impact comes as its move ends", async () => {
  const FLASK = "jb2a.throwable.throw.flask.01.orange";
  const { recipe, context } = boltAttack();
  const thrown = validateRecipe({ ...recipe, stages: recipe.stages.map((s) => (s.stageId === "fly" ? { ...s, kind: "projectile", assets: [FLASK], contact: 600 } : s)) });
  const durationOf = (calls) => effectsOf(calls).find((e) => e.some((c) => c[0] === "file" && c[1] === FLASK)).find((c) => c[0] === "duration")[1];
  const add = (f) => f.runtime.catalog.push({ key: FLASK });
  const clear = await playWall(thrown, context, { collides: () => null, setup: add });
  assert.equal(clear.plan.find((s) => s.stageId === "hit").delay, 600);
  assert.equal(durationOf(clear.calls), 1000);
  // A wall halfway: Sequencer still moves the flask over its whole 1000 ms, so it reaches the wall then.
  const walled = await playWall(thrown, context, { setup: add });
  const wall = walled.plan.find((s) => s.kind === "impact");
  assert.equal(wall.delay, 1000);
  // The flask's effect (and so its move) lasts exactly that long.
  assert.equal(durationOf(walled.calls), wall.delay);
  // What followed the hit moves with the strike (400 ms after the recipe's 600 ms arrival).
  assert.equal(walled.plan.find((s) => s.stageId === "recoil").delay, 1000);
});
// PF2e Alchemist's Fire, as the weapon choreography builds it: the bomb's flight, its explosion timed by the
// recipe's one contact (1080 ms) for every range variant, residue and a shooter beat chained to the explosion.
function bombThrow(x) {
  const BOMB = "jb2a.throwable.throw.bomb.01.red";
  const recipe = validateRecipe({
    ...starterRecipes()[0],
    stages: [
      { stageId: "fly", kind: "travel", assets: [BOMB], delay: 342, duration: 3683, contact: 1080 },
      { stageId: "boom", kind: "impact", assets: ["jb2a.impact.001.orange"], afterStage: "fly", timingAnchor: "start", startOffset: 1080, duration: 1000 },
      { stageId: "residue", kind: "aura", subject: "targets", assets: ["jb2a.impact.002.blue"], afterStage: "boom", timingAnchor: "start", startOffset: 300, duration: 2400 },
      { stageId: "beat", kind: "motion", motion: "stagger", subject: "source", assets: [], afterStage: "boom", timingAnchor: "start", startOffset: 0, duration: 300 },
      { stageId: "after-flight", kind: "impact", assets: ["jb2a.impact.002.blue"], afterStage: "fly", timingAnchor: "end", startOffset: 0, duration: 500 },
    ],
  });
  const context = { id: "bomb1", type: "attack", outcome: "success", source: { id: "s", center: { x: 0, y: 0 }, w: 100, h: 100 }, targets: [{ id: "t1", center: { x, y: 0 }, w: 100, h: 100 }] };
  return { recipe, context, setup: (f) => f.runtime.catalog.push({ key: BOMB }, { key: "jb2a.impact.002.blue" }) };
}
test("a thrown bomb explodes as its vial lands, for the distance it is thrown", async () => {
  for (const [x, ft] of [[300, "15ft"], [600, "30ft"], [1600, "90ft"]]) {
    const { recipe, context, setup } = bombThrow(x);
    const { plan } = await playWall(recipe, context, { collides: () => null, setup });
    const at = (id) => plan.find((s) => s.stageId === id).delay;
    const lands = 342 + MEDIA_LANDINGS[`jb2a.throwable.throw.bomb.01.red.${ft}`];
    assert.equal(at("boom"), lands, ft);
    // What the explosion leaves, and what follows it, comes after it.
    assert.equal(at("residue"), lands + 300, ft);
    assert.equal(at("beat"), lands, ft);
    // A stage timed to the flight's end keeps that time.
    assert.equal(at("after-flight"), 342 + 3683, ft);
  }
});
test("PF2e Alchemist's Fire, as the catalog builds it, explodes as its vial lands", async () => {
  // The real recipe (its explosion timed by the clip's one measured contact, the flight carrying no contact of
  // its own until the choreography gives it one), thrown at a goblin about 6 squares off, as placeables.
  const weapon = PF2E_WEAPONS.find((w) => w.name === "Alchemist's Fire (Moderate)");
  const recipe = validateRecipe(weaponRecipe(weapon, "thrown"));
  const token = (id, x, y) => ({ id, document: { id, width: 1, height: 1 }, center: { x, y }, w: 100, h: 100 });
  const context = { id: "bomb2", type: "attack", automatic: true, outcome: "success", source: token("s", 750, 1250), targets: [token("g", 950, 650)] };
  const { plan } = await playWall(recipe, context, { collides: () => null, setup: (f) => { f.runtime.catalog = [...new Set(recipe.stages.flatMap((s) => s.assets))].map((key) => ({ key })); } });
  const at = (slot) => plan.find((s) => s.stageId.endsWith(`-thrown-${slot}`));
  const lands = at("flight").delay + MEDIA_LANDINGS[`${at("flight").asset}.30ft`];
  assert.equal(at("flight").contact, MEDIA_LANDINGS["jb2a.throwable.throw.bomb.01.red.30ft"]);
  assert.equal(at("accent").delay, lands);
  assert.equal(at("residue").delay, lands + 300);
});
test("a thrown bomb stopped by a wall bursts there as the wall's variant lands; its target's effects are gone", async () => {
  const { recipe, context, setup } = bombThrow(1600);
  const { plan } = await playWall(recipe, context, { setup });
  // 3 squares to the wall: the 15 ft clip, not the 90 ft one its target needs.
  const lands = 342 + MEDIA_LANDINGS["jb2a.throwable.throw.bomb.01.red.15ft"];
  assert.ok(!plan.some((s) => ["boom", "residue"].includes(s.stageId)));
  assert.equal(plan.find((s) => s.kind === "impact" && s.landing?.x === WALL_X).delay, lands);
  assert.equal(plan.find((s) => s.stageId === "beat").delay, lands);
});
// A D&D 5e thrown or launched weapon, as the catalog builds it: its contact is timed to the flight's arrival,
// and lands as the range variant played for the distance lands (its stage lasts the 90 ft variant + 150).
async function dndThrow(name, variantId, x, type) {
  const entry = dndEntries().find((e) => e.name === name);
  const recipe = dndRecipe(entry, variantId);
  const flight = recipe.stages.find((s) => s.kind === "travel");
  const contact = recipe.stages.find((s) => s.kind === "impact" && s.afterStage === flight.stageId);
  assert.equal(contact.timingAnchor, "arrival", name);
  const context = { id: "dnd1", type, outcome: "success", source: { id: "s", center: { x: 0, y: 0 }, w: 100, h: 100 }, targets: [{ id: "t1", center: { x, y: 0 }, w: 100, h: 100 }] };
  const setup = (f) => f.runtime.catalog.push(...[...new Set(recipe.stages.flatMap((s) => s.assets ?? []))].map((key) => ({ key })));
  const { plan } = await playWall(recipe, context, { collides: () => null, setup });
  const at = (id) => plan.find((s) => s.stageId === id);
  return { flight: at(flight.stageId), contact: at(contact.stageId) };
}
test("a D&D thrown flask splashes as its vial lands, for the distance it is thrown", async () => {
  for (const [x, ft] of [[100, "05ft"], [600, "30ft"], [1600, "90ft"]]) {
    const { flight, contact } = await dndThrow("Alchemist's Fire", undefined, x, "save");
    assert.equal(flight.asset, "jb2a.throwable.throw.flask.01.orange", ft);
    assert.equal(contact.delay, flight.delay + MEDIA_LANDINGS[`jb2a.throwable.throw.flask.01.orange.${ft}`], ft);
    // Not as the 3.7 s flight stage ends.
    assert.ok(contact.delay < flight.delay + flight.duration - 150, ft);
  }
});
test("a D&D arrow hits as its range variant's arrow lands", async () => {
  const entry = dndEntries("weapon").find((e) => e.name === "Longbow");
  const variant = entry.variants.find((v) => v.weaponMode === "ranged") ?? entry.variants[0];
  const { flight, contact } = await dndThrow("Longbow", variant.id, 600, "attack");
  const base = flight.asset.replace(/\.(\d\dft)(\.\d+)?$/, "");
  const landing = Object.entries(MEDIA_LANDINGS).find(([k]) => k.startsWith(base) && k.endsWith(".30ft"))[1];
  assert.equal(contact.delay, flight.delay + landing);
});
test("preview never drops on-target stages", async () => {
  const { recipe, context } = boltAttack();
  const { calls } = await playWall(recipe, context, { options: { preview: true } });
  assert.ok(filesOf(calls).includes("jb2a.impact.001.orange"));
  assert.ok(!filesOf(calls).includes(WALL_IMPACT));
});
test("a fire bolt into a wall lights its path to the wall point", async () => {
  const { recipe, context } = boltAttack();
  const fiery = validateRecipe({ ...recipe, stages: recipe.stages.map((s) => (s.stageId === "fly" ? { ...s, assets: ["jb2a.fireball.beam.orange"] } : s)) });
  const { calls } = await playWall(fiery, context, { setup: (f) => { f.host.effectLights = () => true; } });
  const glow = (await overridesByAsset(calls)).find(([asset]) => asset === "jb2a.fireball.beam.orange")[1].animaterLight;
  assert.deepEqual(glow.from, { x: 0, y: 0 });
  assert.deepEqual(glow.to, { x: WALL_X, y: 0 });
  // It lands with the wall strike: as the 15 ft beam variant's front reaches the wall (or the 1000 ms stage
  // ends first), not at 55% of the flight.
  assert.equal(glow.arriveMs, Math.min(1000, MEDIA_LANDINGS["jb2a.fireball.beam.orange.15ft"]));
});
test("a target missed in a multi-target roll loses its own effects", async () => {
  const hit = { id: "t2", center: { x: 0, y: 600 }, w: 100, h: 100 };
  const { recipe, context } = boltAttack();
  // D&D 5e (no roll-wide outcome) and Daggerheart (the best outcome roll-wide).
  for (const outcome of [undefined, "success"]) {
    const several = { ...context, outcome, targets: [...context.targets, hit], targetOutcomes: { t1: "failure", t2: "success" } };
    // Flying wide past it, or stopped by a wall before it.
    for (const collides of [() => null, wallAt()]) {
      const { plan } = await playWall(recipe, several, { collides });
      // (A wall strike plays at its wall point, not on the target.)
      const on = (id) => plan.filter((s) => s.destination?.id === id && !s.landing && (s.kind === "impact" || s.subject === "targets")).map((s) => s.stageId);
      assert.deepEqual(on("t1"), [], `${outcome}: the missed target keeps nothing`);
      assert.deepEqual(on("t2"), ["hit", "react"], `${outcome}: the hit target keeps its hit and reaction`);
      // The shooter's recoil keeps the hit's time.
      assert.equal(plan.find((s) => s.stageId === "recoil").delay, 600);
    }
  }
  // The miss into the wall strikes it.
  const { plan } = await playWall(recipe, { ...context, outcome: undefined, targets: [...context.targets, hit], targetOutcomes: { t1: "failure", t2: "success" } });
  assert.equal(plan.find((s) => s.stageId === "fly" && s.endpoint?.id === "t1").flightOutcome, "wall");
  assert.ok(plan.some((s) => s.kind === "impact" && s.landing?.x === WALL_X));
  // Clear of walls it flies on past.
  const past = await playWall(recipe, { ...context, outcome: undefined, targets: [...context.targets, hit], targetOutcomes: { t1: "failure", t2: "success" } }, { collides: () => null });
  assert.equal(past.plan.find((s) => s.stageId === "fly" && s.endpoint?.id === "t1").flightOutcome, "past");
});
test("a missed target keeps its dodge as the shot passes it", async () => {
  const { recipe, context } = boltAttack();
  const dodging = validateRecipe({ ...recipe, stages: [...recipe.stages, { stageId: "duck", kind: "motion", motion: "dodge", subject: "targets", assets: [], delay: 400, duration: 500 }] });
  const { plan } = await playWall(dodging, { ...context, outcome: undefined, targetOutcomes: { t1: "failure" } }, { collides: () => null });
  assert.deepEqual(plan.filter((s) => s.destination?.id === "t1" && s.subject === "targets").map((s) => s.stageId), ["duck"]);
});
test("the wall test is told who shoots (for the shooter's level)", async () => {
  const { recipe, context } = boltAttack();
  const seen = [];
  await playWall(recipe, context, { collides: (a, b, type, source) => { seen.push(source); return null; } });
  assert.ok(seen.length && seen.every((s) => s === context.source));
});

// Ground marks: the starting client describes each mark on its spot's tier 0 effect (engines/marks/ground-marks.mjs).
function markFixture({ on = true, level = null, damages = false } = {}) {
  const f = lightFixture(false);
  f.host.groundMarks = () => on;
  f.host.viewedLevel = () => (level ? { level, elevation: 30 } : null);
  f.host.itemDamages = () => damages;
  return f;
}
const marksOf = async (calls) => (await overridesByAsset(calls)).filter(([, d]) => d.animaterMark).map(([asset, d]) => [asset, d.animaterMark]);
const fireAttack = (extra = {}) => ({ ...fireball().context, automatic: true, type: "attack", element: "fire", sceneId: "scene1", messageId: "m1", ...extra });
test("fire spell impact is tagged with a scorch", async () => {
  const { runtime, calls } = markFixture();
  await runtime.play(fireball().recipe, fireAttack());
  const marks = await marksOf(calls);
  assert.equal(marks.length, 1);
  const [asset, tag] = marks[0];
  // The area's mark rides on its explosion and covers the whole circle.
  assert.equal(asset, "jb2a.fireball.explosion.orange");
  assert.equal(tag.mark, "scorch");
  assert.equal(tag.shape, "circle");
  assert.deepEqual(tag.at, { x: 600, y: 0 });
  assert.equal(tag.radius, 200);
  assert.equal(tag.sceneId, "scene1");
  assert.equal(tag.delayMs, 0);
  assert.ok(Number.isInteger(tag.seed));
  // The same message plays the same blotches on every client: the seed comes from it.
  const again = markFixture();
  await again.runtime.play(fireball().recipe, fireAttack());
  assert.equal((await marksOf(again.calls))[0][1].seed, tag.seed);
});
test("an area mark names its placed Region", async () => {
  const { runtime, calls } = markFixture();
  await runtime.play(fireball().recipe, fireAttack({ template: { documentName: "Region", id: "rg1" } }));
  const [[, tag]] = await marksOf(calls);
  assert.equal(tag.shape, "circle");
  assert.equal(tag.regionId, "rg1");
  const plain = markFixture();
  await plain.runtime.play(fireball().recipe, fireAttack());
  assert.equal((await marksOf(plain.calls))[0][1].regionId, undefined, "no placed Region, no id");
});
test("setting off: no tags", async () => {
  const { runtime, calls } = markFixture({ on: false });
  await runtime.play(fireball().recipe, fireAttack());
  const data = await overridesByAsset(calls);
  assert.ok(data.length);
  for (const [, d] of data) assert.equal("animaterMark" in d, false);
  // A preview never marks the floor.
  const preview = markFixture();
  await preview.runtime.play(fireball().recipe, fireAttack(), { preview: true });
  assert.equal((await marksOf(preview.calls)).length, 0);
});
test("only harmful plays from Animater's own dispatch mark", async () => {
  const marked = async (context, options) => { const f = markFixture(options); await f.runtime.play(fireball().recipe, context); return (await marksOf(f.calls)).length; };
  assert.equal(await marked(fireAttack({ automatic: undefined })), 0);
  // A spell cast marks when its item deals damage (host.itemDamages).
  assert.equal(await marked(fireAttack({ type: "spell" })), 0);
  assert.equal(await marked(fireAttack({ type: "spell" }), { damages: true }), 1);
  // No element with a mark, no mark.
  assert.equal(await marked(fireAttack({ element: "mental" })), 0);
});
test("marks carry the source token's level, else the viewed one", async () => {
  const source = { ...fireball().context.source, document: { level: "lvl2", elevation: 15 } };
  const own = markFixture({ level: "lvl1" });
  await own.runtime.play(fireball().recipe, fireAttack({ source }));
  const [[, tag]] = await marksOf(own.calls);
  assert.equal(tag.level, "lvl2");
  assert.equal(tag.elevation, 15);
  const viewed = markFixture({ level: "lvl1" });
  await viewed.runtime.play(fireball().recipe, fireAttack());
  const [[, fallback]] = await marksOf(viewed.calls);
  assert.equal(fallback.level, "lvl1");
  assert.equal(fallback.elevation, 30);
});
test("a weapon's mark comes only from its recipe, never from rune damage", async () => {
  const strike = validateRecipe({
    ...starterRecipes()[0],
    stages: [{ stageId: "hit", kind: "impact", assets: ["jb2a.fireball.explosion.orange"], delay: 0, duration: 800 }],
  });
  const context = fireAttack({ item: { type: "weapon", name: "Longsword" }, area: undefined, template: undefined });
  const plain = markFixture();
  await plain.runtime.play(strike, context);
  assert.equal((await marksOf(plain.calls)).length, 0);
  const bomb = markFixture();
  await bomb.runtime.play(validateRecipe({ ...strike, markElement: "acid" }), context);
  const marks = await marksOf(bomb.calls);
  assert.equal(marks.length, 1);
  assert.equal(marks[0][1].mark, "residue");
  assert.equal(marks[0][1].shape, "spot");
});
// A placed area spell plays from its template event (main.mjs createRegion): type "template", no damage roll,
// so no element on the event. Its mark comes from the spell's own damage.
async function placedArea(recipe, item, { systemId = "pf2e", activity } = {}) {
  const f = markFixture();
  f.host.itemDamages = (i) => usedItemDamages(i, systemId);
  f.host.itemElement = (i, context) => usedItemElement(i, systemId, context.activity);
  f.host.resolveRecipe = () => recipe;
  f.runtime.catalog = [...new Set(recipe.stages.flatMap((s) => s.assets))].map((key) => ({ key }));
  const { source, targets, area } = fireball().context;
  await f.runtime.dispatch({
    id: "area:Scene.s1.Region.rg1", type: "template", systemId, item, activity, source, targets, area,
    template: { documentName: "Region", id: "rg1" }, sceneId: "s1",
  });
  return marksOf(f.calls);
}
const pf2eSpell = (damage, traits = []) => ({ type: "spell", name: "Spell", system: { damage, traits: { value: traits } } });
test("a placed PF2e Fireball scorches its area", async () => {
  const recipe = spellRecipe(PF2E_SPELLS.find((s) => s.name === "Fireball"));
  const fireballItem = pf2eSpell({ k1: { formula: "6d6", type: "fire", kinds: ["damage"], category: null } }, ["concentrate", "fire", "manipulate"]);
  const marks = await placedArea(recipe, fireballItem);
  assert.equal(marks.length, 1);
  const [asset, tag] = marks[0];
  assert.equal(asset, "jb2a.fireball.explosion.orange");
  assert.equal(tag.mark, "scorch");
  assert.equal(tag.shape, "circle");
  assert.equal(tag.regionId, "rg1");
  // A buff placed the same way leaves the floor clean.
  assert.equal((await placedArea(recipe, pf2eSpell({}, ["fire"]))).length, 0);
});
test("a placed D&D Fireball scorches its area", async () => {
  const entry = dndEntries("spell").find((e) => e.name === "Fireball");
  const activity = { id: "a1", type: "save", damage: { parts: [{ number: 8, denomination: 6, types: new Set(["fire"]) }] } };
  const item = { type: "spell", name: "Fireball", system: { activities: new Map([["a1", activity]]) } };
  const marks = await placedArea(dndRecipe(entry), item, { systemId: "dnd5e", activity });
  assert.equal(marks.length, 1);
  assert.equal(marks[0][1].mark, "scorch");
  assert.equal(marks[0][1].shape, "circle");
});

// Sequencer's moveTowards merges its defaults with our options, so an explicit undefined
// (no moveEase / moveDelay) overrides a default and fails its type checks. Mirror those checks.
test("a projectile's moveTowards gets a string ease and numeric delay", async () => {
  const stages = [
    { stageId: "dart", kind: "projectile", assets: ["jb2a.arrow.physical.white"], delay: 0, duration: 800 },
  ];
  const recipe = validateRecipe({ ...starterRecipes()[0], stages });
  const { runtime, calls } = fixture();
  runtime.catalog = [{ key: "jb2a.arrow.physical.white" }];
  runtime.wait = async () => true;
  await runtime.play(
    recipe,
    { source: { id: "s", center: { x: 0, y: 0 } }, targets: [{ id: "t", center: { x: 400, y: 0 } }] },
    { preview: true },
  );
  const moves = calls.filter((c) => c[0] === "moveTowards");
  assert.equal(moves.length, 1);
  for (const [, , options] of moves) {
    assert.equal(typeof options.ease, "string");
    assert.ok(Number.isFinite(options.delay));
    assert.equal(typeof options.rotate, "boolean");
    assert.equal(typeof options.cacheLocation, "boolean");
  }
});

// Wall of Fire, as cast: the real catalog recipes, a placed template, its lasting light along the wall.
const WALL_LINE = { type: "line", center: { x: 0, y: 0 }, endpoint: { x: 1200, y: 0 }, length: 1200, width: 100 };
const WALL_RING = { center: { x: 500, y: 500 }, diameter: 400 };
async function wallLights(recipe, area, { dispatchItem } = {}) {
  const f = lightFixture();
  f.runtime.catalog = [...new Set(recipe.stages.flatMap((s) => s.assets))].map((key) => ({ key }));
  const context = { source: { id: "s", center: { x: 0, y: 0 } }, targets: [], template: { documentName: "Region", id: "r1" }, area };
  if (dispatchItem) {
    f.host.resolveRecipe = () => recipe;
    await f.runtime.dispatch({ id: `wall-${area.type ?? "ring"}`, type: "template", item: dispatchItem, ...context });
  } else await f.runtime.play(recipe, context);
  return (await overridesByAsset(f.calls)).filter(([, d]) => d.animaterLight).map(([asset, d]) => ({ asset, ...d }));
}
const assertWallLit = (lights, area) => {
  assert.equal(lights.length, 1);
  const [{ animaterLight: tag, animaterLasting }] = lights;
  assert.equal(animaterLasting, true, "the wall stays on its template");
  assert.equal(tag.shape, "flicker");
  assert.equal(tag.lasting, true);
  assert.equal(tag.lengthMs, 86400000, "lit until the template is removed");
  if (area.type === "line") {
    // Three lights along a 12-square wall, one per third, each sized to its third.
    assert.deepEqual(tag.points, [{ x: 200, y: 0 }, { x: 600, y: 0 }, { x: 1000, y: 0 }]);
    assert.equal(tag.dim, 3);
    assert.deepEqual(tag.at, { x: 600, y: 0 });
  } else {
    assert.equal(tag.points, undefined);
    assert.deepEqual(tag.at, area.center);
    assert.equal(tag.dim, 3);
  }
};
test("PF2e Wall of Fire (catalog recipe, placed line or ring) flickers along the wall for as long as it stands", async () => {
  const item = { type: "spell", name: "Wall of Fire", system: { duration: { value: "1 minute", sustained: false }, area: null, traits: { value: ["concentrate", "fire", "manipulate"] }, description: { value: "<p>You raise a blazing wall.</p>" } } };
  const recipe = spellRecipe(PF2E_SPELLS.find((s) => s.slug === "wall-of-fire"), undefined, { sound: false });
  for (const area of [WALL_LINE, WALL_RING]) assertWallLit(await wallLights(recipe, area, { dispatchItem: item }), area);
});
test("D&D 5e Wall of Fire (bespoke line and ring, both editions) flickers along the wall for as long as it stands", async () => {
  for (const edition of ["2014", "2024"]) {
    const entry = dndEntries("spell").find((e) => e.name === "Wall of Fire" && e.edition === edition);
    const walls = entry.variants.filter((v) => v.recipe.trigger === "template");
    assert.equal(walls.length, 2, edition);
    for (const variant of walls) {
      const recipe = dndRecipe(entry, variant.id);
      assert.ok(recipe.bespoke, `${edition} ${variant.label}`);
      const area = variant.recipe.previewArea?.type === "line" ? WALL_LINE : WALL_RING;
      assertWallLit(await wallLights(recipe, area), area);
    }
  }
});

// Afterimage trails: the starting client tints every motion's ghosts and applies the world setting.
const trailRecipe = (stage = {}, extra = {}) => validateRecipe({ id: "dash", name: "Dash", trigger: "manual", ...extra,
  stages: [{ kind: "motion", motion: "rush", subject: "source", motionRange: "distance", distance: 3, assets: [], delay: 0, duration: 800, ...stage }] });
const sentMotion = async (recipe, context = {}, setup = () => {}) => {
  const { runtime, host, calls } = fixture();
  setup(host);
  runtime.wait = async () => true;
  await runtime.play(recipe, { source: { id: "source" }, targets: [], ...context }, { preview: true });
  return calls.find((c) => c[0] === "motion")[1];
};
test("motion stages carry the play's tint", async () => {
  assert.equal((await sentMotion(trailRecipe({ tintEnabled: true, tint: "#ff8800" }), { element: "cold" })).trailTint, "#ff8800", "the stage's own tint first");
  assert.equal((await sentMotion(trailRecipe(), { element: "fire" })).trailTint, "#ff9a4d", "then the play's element");
  assert.equal((await sentMotion(trailRecipe({}, { color: "#33aa55" }))).trailTint, "#33aa55", "then the recipe colour");
  assert.equal((await sentMotion(trailRecipe())).trailTint, "", "none (the recipe's unpicked default colour): each client's soft white");
  const sent = await sentMotion(trailRecipe({ afterimages: "always" }));
  assert.equal(sent.afterimages, "always", "the stage's own choice rides along");
  assert.equal(sent.destination.id, "source", "still the placeable the host resolves");
});
test("the tint survives the socket: receivers re-validate the stage", async () => {
  // receiveMotion (and the starting client) re-run validateRecipe on the stage host.motion sends.
  const received = async (recipe, context) => {
    const { destination, ...sent } = await sentMotion(recipe, context);
    return validateRecipe({ id: "socket-motion", name: "Motion", trigger: "manual", stages: [{ ...sent, kind: "motion" }] }).stages[0];
  };
  assert.equal((await received(trailRecipe(), { element: "fire" })).trailTint, "#ff9a4d");
  assert.equal((await received(trailRecipe({ afterimages: "always" }), { element: "fire" })).afterimages, "always");
  assert.equal((await received(trailRecipe())).trailTint, undefined, "no tint: soft white");
  const bad = validateRecipe({ id: "s", name: "S", trigger: "manual", stages: [{ kind: "motion", motion: "rush", trailTint: "red;x" }] }).stages[0];
  assert.equal(bad.trailTint, undefined, "only a hex colour");
});
test("world setting off sends never", async () => {
  assert.equal((await sentMotion(trailRecipe({ afterimages: "always" }), {}, (host) => { host.afterimages = () => false; })).afterimages, "never");
  assert.equal((await sentMotion(trailRecipe(), {}, (host) => { host.afterimages = () => true; })).afterimages, undefined, "on: Auto stays the default");
  assert.equal((await sentMotion(trailRecipe({ afterimages: "always" }))).afterimages, "always", "a host without the setting lets motions trail");
});

// Map distortion: the starting client tags each distortion's anchor effect (engines/distortion/scene-distortion.mjs).
function warpFixture(on = true) {
  const f = lightFixture(false);
  f.host.mapDistortion = () => on;
  return f;
}
const warpsOf = async (calls) => (await overridesByAsset(calls)).filter(([, d]) => d.animaterWarp).map(([asset, d]) => [asset, d.animaterWarp]);
test("fireball explosion is tagged with a shock at its contact", async () => {
  const { recipe, context } = fireball();
  const { runtime, calls } = warpFixture();
  let plan;
  await runtime.play(recipe, context, { onStart: (r) => { plan = r.playbackPlan; } });
  const warps = await warpsOf(calls);
  assert.equal(warps.length, 1);
  const [asset, tag] = warps[0];
  assert.equal(asset, "jb2a.fireball.explosion.orange");
  assert.equal(tag.kind, "shock");
  assert.deepEqual(tag.at, { x: 600, y: 0 });
  const boom = plan.find((s) => s.stageId === "boom");
  assert.equal(tag.startMs, boom.contact > 0 ? boom.contact : 0, "the ring starts at the blast's contact");
  assert.equal(tag.radius, 1.5 * 200, "about 1.5 times the blast radius");
  assert.equal("level" in tag, false, "a source token without a level: every level");
});
test("shockwave reach setting scales the ring; the source token's level rides along", async () => {
  const { recipe, context } = fireball();
  const f = warpFixture();
  f.host.shockwaveReach = () => 3;
  await f.runtime.play(recipe, { ...context, source: { ...context.source, document: { level: "L2" } } });
  const [[, tag]] = await warpsOf(f.calls);
  assert.equal(tag.radius, 3 * 200, "three times the blast radius");
  assert.equal(tag.level, "L2");
});
test("wall of fire is tagged with a haze along the wall for as long as it stands", async () => {
  const item = { type: "spell", name: "Wall of Fire", system: { duration: { value: "1 minute", sustained: false }, area: null, traits: { value: ["concentrate", "fire", "manipulate"] }, description: { value: "<p>You raise a blazing wall.</p>" } } };
  const recipe = spellRecipe(PF2E_SPELLS.find((s) => s.slug === "wall-of-fire"), undefined, { sound: false });
  const f = warpFixture();
  f.runtime.catalog = [...new Set(recipe.stages.flatMap((s) => s.assets))].map((key) => ({ key }));
  f.host.resolveRecipe = () => recipe;
  await f.runtime.dispatch({ id: "wall-haze", type: "template", item, source: { id: "s", center: { x: 0, y: 0 } }, targets: [], template: { documentName: "Region", id: "r1" }, area: WALL_LINE });
  const tagged = (await overridesByAsset(f.calls)).filter(([, d]) => d.animaterWarp);
  assert.equal(tagged.length, 1);
  const [[, { animaterWarp: tag, animaterLasting }]] = tagged;
  assert.equal(animaterLasting, true, "rides on the lasting wall");
  assert.equal(tag.kind, "haze");
  assert.equal(tag.lengthMs, null, "until its anchor ends");
  assert.equal(tag.follow, false);
  assert.deepEqual(tag.area, { type: "capsule", a: { x: 0, y: 0 }, b: { x: 1200, y: 0 }, width: 100 });
});
test("a burning aura on a token is tagged with a following haze", async () => {
  const recipe = validateRecipe({
    ...starterRecipes()[0],
    stages: [{ stageId: "burn", kind: "aura", assets: ["jb2a.fireball.explosion.orange"], delay: 0, duration: 1000, persist: true }],
  });
  const { runtime, calls } = warpFixture();
  await runtime.play(recipe, { ...fireball().context, element: "fire" });
  const warps = await warpsOf(calls);
  assert.equal(warps.length, 1);
  assert.equal(warps[0][1].kind, "haze");
  assert.equal(warps[0][1].follow, true, "rides the token it is attached to");
});
test("a critical hit with a heavy weapon is tagged with a shock", async () => {
  const recipe = validateRecipe({
    ...starterRecipes()[0],
    stages: [{ stageId: "hit", kind: "impact", assets: ["jb2a.impact.001.orange"], delay: 0, duration: 500 }],
  });
  const context = { type: "attack", outcome: "criticalSuccess", item: { id: "axe" }, source: { id: "s", center: { x: 0, y: 0 } }, targets: [{ id: "t1", center: { x: 300, y: 0 } }] };
  const kindsOf = async (heavy, outcome = "criticalSuccess") => {
    const { runtime, calls } = warpFixture();
    runtime.catalog = [{ key: "jb2a.impact.001.orange" }];
    const seen = [];
    runtime.host.heavyItem = (item) => { seen.push(item); return heavy; };
    await runtime.play(recipe, { ...context, outcome });
    assert.deepEqual(seen, outcome === "criticalSuccess" ? [context.item] : [], "only a critical play asks");
    return (await warpsOf(calls)).map(([, t]) => t.kind);
  };
  assert.deepEqual(await kindsOf(true), ["shock"]);
  assert.deepEqual(await kindsOf(false), [], "a light weapon's crit does not ripple");
  assert.deepEqual(await kindsOf(true, "success"), [], "nor does an ordinary hit");
});
test("map distortion setting off: no tags", async () => {
  const { recipe, context } = fireball();
  for (const setup of [(f) => { f.host.mapDistortion = () => false; }, (f) => { delete f.host.mapDistortion; }]) {
    const f = warpFixture();
    setup(f);
    await f.runtime.play(recipe, context);
    const data = await overridesByAsset(f.calls);
    assert.ok(data.length);
    for (const [, d] of data) assert.equal("animaterWarp" in d, false);
  }
});
// Camera shake reads the same shock tags; with map distortion off they ride as `animaterShake` (no warp drawn).
test("camera shake with map distortion off: shocks ride as animaterShake, no warp", async () => {
  const { recipe, context } = fireball();
  const f = warpFixture(false);
  f.host.cameraShake = () => true;
  await f.runtime.play(recipe, context);
  const data = await overridesByAsset(f.calls);
  for (const [, d] of data) assert.equal("animaterWarp" in d, false);
  const shakes = data.filter(([, d]) => d.animaterShake);
  assert.equal(shakes.length, 1);
  assert.equal(shakes[0][0], "jb2a.fireball.explosion.orange");
  assert.equal(shakes[0][1].animaterShake.kind, "shock");
  assert.equal(shakes[0][1].animaterShake.radius, 1.5 * 200);
});
test("camera shake: with map distortion on the warp tag serves it; off plans nothing", async () => {
  const { recipe, context } = fireball();
  const both = warpFixture(true);
  both.host.cameraShake = () => true;
  await both.runtime.play(recipe, context);
  const data = await overridesByAsset(both.calls);
  assert.equal(data.filter(([, d]) => d.animaterWarp).length, 1);
  for (const [, d] of data) assert.equal("animaterShake" in d, false);
  const none = warpFixture(false);
  none.host.cameraShake = () => false;
  await none.runtime.play(recipe, context);
  for (const [, d] of await overridesByAsset(none.calls)) assert.equal("animaterShake" in d, false);
});

// Reported on D&D 5e (2.1.5): map distortion and camera shake never showed. A D&D Fireball's explosion plays its
// whole 4.2 s clip, which read as a lasting area (a haze, no shock), and a placed circle carries no area type.
async function dndPlacedTags(name, item, { warp = false } = {}) {
  const entry = dndEntries("spell").find((e) => e.name === name && e.edition === "2024");
  const recipe = dndRecipe(entry);
  const f = warpFixture(warp);
  f.host.cameraShake = () => true;
  f.host.itemDamages = (i) => usedItemDamages(i, "dnd5e");
  f.host.itemElement = (i, context) => usedItemElement(i, "dnd5e", context.activity);
  f.host.resolveRecipe = () => recipe;
  f.runtime.catalog = [...new Set(recipe.stages.flatMap((s) => s.assets ?? []))].map((key) => ({ key }));
  await f.runtime.dispatch({
    id: "area:Scene.s1.Region.rg1", type: "template", systemId: "dnd5e", item, activity: [...item.system.activities.values()][0],
    source: { id: "s", center: { x: 0, y: 0 } }, targets: [], sceneId: "s1",
    template: { documentName: "Region", id: "rg1" }, area: { center: { x: 1200, y: 0 }, diameter: 800 },
  });
  return (await overridesByAsset(f.calls)).filter(([, d]) => d.animaterShake || d.animaterWarp);
}
const dndSpellItem = (name, parts) => ({ type: "spell", name, system: { activities: new Map([["a1", { id: "a1", type: parts ? "save" : "heal", damage: { parts: parts ?? [] } }]]) } });
test("a placed D&D Fireball shakes the view and ripples a shockwave", async () => {
  const item = dndSpellItem("Fireball", [{ number: 8, denomination: 6, types: new Set(["fire"]) }]);
  const shakes = await dndPlacedTags("Fireball", item);
  assert.equal(shakes.length, 1);
  assert.equal(shakes[0][0], "jb2a.fireball.explosion.orange");
  assert.equal(shakes[0][1].animaterShake.kind, "shock");
  assert.deepEqual(shakes[0][1].animaterShake.at, { x: 1200, y: 0 });
  const warps = await dndPlacedTags("Fireball", item, { warp: true });
  assert.equal(warps.length, 1);
  assert.equal(warps[0][1].animaterWarp.kind, "shock", "a ring, not a haze");
});
test("a placed D&D round area ripples only when its item deals damage", async () => {
  const storm = await dndPlacedTags("Ice Storm", dndSpellItem("Ice Storm", [{ number: 2, denomination: 10, types: new Set(["bludgeoning"]) }]));
  assert.equal(storm.length, 1);
  assert.equal(storm[0][1].animaterShake.kind, "shock");
  assert.equal((await dndPlacedTags("Ice Storm", dndSpellItem("Ice Storm"))).length, 0, "the same area without damage");
});
