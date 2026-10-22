import test from "node:test";
import assert from "node:assert/strict";
import { AnimaterRuntime } from "../../../scripts/engines/playback/runtime.mjs";
import { starterRecipes } from "../../../scripts/core/presets.mjs";
import { validateRecipe } from "../../../scripts/core/model.mjs";
import { orbRecipe } from "../../../scripts/catalogs/shared/orb-builder.mjs";
import { PF2E_SPELLS, spellRecipe } from "../../../scripts/catalogs/pf2e/spells/spell-catalog.mjs";
import { SURFACE_SOUND_PROFILES } from "../../../scripts/engines/sound/surface-sounds.mjs";

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
    assert.equal(lifetime, compiled.playbackPlan[0].duration);
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

// Hit-stop: a crit freezes at the moment of contact (engines/playback/impact-moments.mjs).
// A flight lands at 600 ms (its own impact); the attacker's wind-up spans contact; one more hit follows.
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
test("crit attack retimes after contact and tags effects playing across it", async () => {
  const { recipe, context } = critAttack();
  const { runtime, calls, waits } = critFixture();
  let plan;
  await runtime.play(recipe, context, { onStart: (r) => { plan = r.playbackPlan; } });
  const tags = Object.fromEntries((await overridesByAsset(calls)).map(([asset, data]) => [asset, data.animaterHitStop]));
  assert.deepEqual(tags["jb2a.fire_bolt.orange"], { afterMs: 600, holdMs: 100 });
  assert.deepEqual(tags["jb2a.impact.001.orange"], { afterMs: 0, holdMs: 100 });
  assert.equal(tags["jb2a.impact.002.blue"], undefined);
  const delay = (id) => plan.find((s) => s.stageId === id).delay;
  assert.equal(delay("after"), 1300);
  assert.equal(delay("hit"), 600);
  assert.ok(waits.includes(1300) && !waits.includes(1200));
  assert.equal(typeof runtime.contacts.get("ev1"), "number");
});
test("no hit-stop when the world setting is off or the outcome is a plain success", async () => {
  for (const [hitStop, outcome] of [[() => false, "criticalSuccess"], [undefined, "success"]]) {
    const { recipe, context } = critAttack();
    const { runtime, host, calls, waits } = critFixture();
    host.hitStop = hitStop;
    await runtime.play(recipe, { ...context, outcome });
    for (const [, data] of await overridesByAsset(calls)) assert.equal("animaterHitStop" in data, false);
    assert.ok(waits.includes(1200) && !waits.includes(1300));
    assert.equal(runtime.contacts.has("ev1"), false);
  }
});
test("motion stage carries hitStop", async () => {
  const { recipe, context } = critAttack();
  const { runtime, calls } = critFixture();
  await runtime.play(recipe, context);
  const windup = calls.find((c) => c[0] === "motion" && c[1].stageId === "windup")[1];
  assert.deepEqual(windup.hitStop, { afterMs: 300, holdMs: 100 });
});
test("staggered copies count their own start: a copy starting after contact is not frozen", async () => {
  const { recipe, context } = manyTargets();
  const { runtime, host, calls } = fixture();
  host.adaptive = () => ({ stagger: true });
  runtime.wait = async () => true;
  await runtime.play(recipe, { ...context, id: "ev2", outcome: "criticalSuccess" });
  const tags = (await overridesByAsset(calls)).map(([, data]) => data.animaterHitStop);
  assert.deepEqual(tags, [{ afterMs: 0, holdMs: 100 }, undefined, undefined, undefined, undefined]);
});
test("finisher shares the attack's contact", async () => {
  const { recipe, context } = critAttack();
  const { runtime, host, calls } = critFixture();
  const sequence = host.sequence;
  host.sequence = () => ({ ...sequence(), play: async (options) => calls.push(["play", options, performance.now()]) });
  const finisher = validateRecipe({
    ...starterRecipes()[0],
    stages: [{ stageId: "fling", kind: "impact", assets: ["jb2a.finisher.test"], delay: 0, duration: 3000 }],
  });
  host.resolveRecipe = () => recipe;
  // The attack is dispatched; the finisher starts later than its planning but before its time zero.
  host.pickTeleport = (_, ctx) => (ctx.hitStopOf ? null : new Promise((resolve) => setTimeout(() => resolve(null), 50)));
  const attacking = runtime.dispatch(context);
  const finishing = runtime.play(finisher, { source: context.source, targets: context.targets, hitStopOf: "ev1" });
  await Promise.all([attacking, finishing]);
  const contact = runtime.contacts.get("ev1");
  const finisherStart = calls.filter((c) => c[0] === "play").at(-1)[2];
  const mark = (await overridesByAsset(calls)).find(([asset]) => asset === "jb2a.finisher.test")[1].animaterHitStop;
  assert.equal(mark.holdMs, 100);
  assert.ok(Math.abs(finisherStart + mark.afterMs - contact) <= 16, `${finisherStart + mark.afterMs} vs ${contact}`);
});
test("a finisher whose event plays nothing does not wait for a contact", async () => {
  const { runtime, calls } = critFixture();
  const finisher = validateRecipe({
    ...starterRecipes()[0],
    stages: [{ stageId: "fling", kind: "impact", assets: ["jb2a.finisher.test"], delay: 0, duration: 3000 }],
  });
  const started = performance.now();
  await runtime.play(finisher, { source: { id: "s", center: { x: 0, y: 0 } }, targets: [{ id: "t1", center: { x: 300, y: 0 } }], hitStopOf: "save-1" });
  assert.ok(performance.now() - started < 100);
  for (const [, data] of await overridesByAsset(calls)) assert.equal("animaterHitStop" in data, false);
});
test("a check finisher that starts before its action's play still freezes with it", async () => {
  const { recipe, context } = critAttack();
  const { runtime, host, calls } = critFixture();
  const sequence = host.sequence;
  host.sequence = () => ({ ...sequence(), play: async (options) => calls.push(["play", options, performance.now()]) });
  const finisher = validateRecipe({
    ...starterRecipes()[0],
    stages: [{ stageId: "fling", kind: "impact", assets: ["jb2a.finisher.test"], delay: 0, duration: 3000 }],
  });
  host.resolveRecipe = () => recipe;
  host.pickTeleport = (_, ctx) => (ctx.hitStopOf ? null : new Promise((resolve) => setTimeout(() => resolve(null), 50)));
  // The check chain reaches the finisher first; the Shove's own dispatch starts a little later.
  const finishing = runtime.play(finisher, { source: context.source, targets: context.targets, hitStopOf: "chat:m1", hitStopLate: true });
  await new Promise((resolve) => setTimeout(resolve, 60));
  const attacking = runtime.dispatch({ ...context, id: "chat:m1" });
  await Promise.all([attacking, finishing]);
  const contact = runtime.contacts.get("chat:m1");
  assert.equal(typeof contact, "number");
  const finisherStart = calls.filter((c) => c[0] === "play").at(-1)[2];
  const mark = (await overridesByAsset(calls)).find(([asset]) => asset === "jb2a.finisher.test")[1].animaterHitStop;
  assert.equal(mark?.holdMs, 100);
  assert.ok(Math.abs(finisherStart + mark.afterMs - contact) <= 16, `${finisherStart + mark.afterMs} vs ${contact}`);
});
test("a late contact wait gives up after its grace when the action never plays", async () => {
  const { runtime } = critFixture();
  const started = performance.now();
  assert.equal(await runtime.contactOf("chat:none", { late: true }), null);
  const waited = performance.now() - started;
  assert.ok(waited >= 250 && waited < 600, `${waited}`);
});
test("a crit damage roll never hit-stops", async () => {
  const { recipe, context } = critAttack();
  const { runtime, calls } = critFixture();
  await runtime.play(recipe, { ...context, type: "damage" });
  for (const [, data] of await overridesByAsset(calls)) assert.equal("animaterHitStop" in data, false);
  assert.equal(runtime.contacts.has("ev1"), false);
});
test("every stage frozen across contact carries its hold in the started plan", async () => {
  const { recipe, context } = critAttack();
  const { runtime } = critFixture();
  let plan;
  await runtime.play(recipe, context, { onStart: (r) => { plan = r.playbackPlan; } });
  const hold = (id) => plan.find((s) => s.stageId === id).hitStop;
  assert.deepEqual(hold("fly"), { afterMs: 600, holdMs: 100 });
  assert.deepEqual(hold("hit"), { afterMs: 0, holdMs: 100 });
  assert.equal(hold("after"), undefined);
});
test("a crit with no moment of contact tells its finisher at once", async () => {
  const { runtime } = critFixture();
  const recipe = validateRecipe({
    ...starterRecipes()[0],
    stages: [{ stageId: "glow", kind: "aura", subject: "source", assets: ["jb2a.impact.001.orange"], delay: 0, duration: 500 }],
  });
  await runtime.play(recipe, { id: "ev3", outcome: "criticalSuccess", source: { id: "s", center: { x: 0, y: 0 } }, targets: [] });
  assert.equal(runtime.contacts.has("ev3"), true);
  assert.equal(runtime.contacts.get("ev3"), null);
  runtime.dispatching.add("ev3");
  const started = performance.now();
  assert.equal(await runtime.contactOf("ev3"), null);
  assert.ok(performance.now() - started < 16);
  // A real contact from another play of the same event still wins.
  runtime.recordContact("ev3", 1234);
  assert.equal(runtime.contacts.get("ev3"), 1234);
});

// Slow motion: a notable kill plays at a slower tempo (engines/playback/impact-moments.mjs).
test("tempo doubles timings and halves rates", async () => {
  const { recipe, context } = critAttack();
  const { runtime, waits } = critFixture();
  let plan;
  await runtime.play(recipe, { ...context, outcome: "success", tempo: 0.5 }, { onStart: (r) => { plan = r.playbackPlan; } });
  const stage = (id) => plan.find((s) => s.stageId === id);
  assert.equal(stage("hit").delay, 1200);
  assert.equal(stage("hit").duration, 1000);
  assert.equal(stage("after").delay, 2400);
  assert.equal(stage("windup").delay, 600);
  assert.equal(stage("windup").duration, 1200);
  assert.equal(stage("fly").playbackRate, 0.5);
  assert.equal(stage("hit").playbackRate, 0.5);
  assert.ok(waits.includes(2400));
  // Without a tempo the plan keeps its own timing.
  const plain = critFixture();
  let plainPlan;
  await plain.runtime.play(recipe, { ...context, outcome: "success" }, { onStart: (r) => { plainPlan = r.playbackPlan; } });
  assert.equal(plainPlan.find((s) => s.stageId === "after").delay, 1200);
  assert.equal(plainPlan.find((s) => s.stageId === "fly").playbackRate, 1);
});
test("tempo cap keeps a long play under 6 s", async () => {
  const recipe = validateRecipe({
    ...starterRecipes()[0],
    stages: [
      { stageId: "fly", kind: "travel", assets: ["jb2a.fire_bolt.orange"], delay: 0, duration: 1000 },
      { stageId: "fling", kind: "impact", assets: ["jb2a.finisher.test"], delay: 1000, duration: 4000 },
    ],
  });
  const { runtime } = critFixture();
  let plan;
  await runtime.play(recipe, { source: { id: "s", center: { x: 0, y: 0 } }, targets: [{ id: "t1", center: { x: 300, y: 0 } }], tempo: 0.5 }, { onStart: (r) => { plan = r.playbackPlan; } });
  const end = Math.max(...plan.map((s) => s.delay + s.duration));
  assert.ok(Math.abs(end - 6000) < 1e-6, `slowed end ${end}`);
  assert.ok(Math.abs(plan.find((s) => s.stageId === "fling").playbackRate - 5 / 6) < 1e-9);
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
test("slowed play tags slowed timings", async () => {
  const { recipe, context } = fireball();
  const glow = async (ctx) => {
    const { runtime, calls } = lightFixture();
    await runtime.play(recipe, ctx);
    return (await overridesByAsset(calls)).find(([asset]) => asset === "jb2a.fireball.beam.orange")[1].animaterLight;
  };
  const plain = await glow(context), slowed = await glow({ ...context, tempo: 0.5 });
  assert.ok(plain.lengthMs > 0);
  assert.equal(slowed.lengthMs, 2 * plain.lengthMs);
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
test("slowed play stretches an impact's flash", async () => {
  const { recipe, context } = fireball();
  const flashOf = async (ctx) => {
    const { runtime, calls } = lightFixture();
    await runtime.play(recipe, ctx);
    return (await overridesByAsset(calls)).find(([asset]) => asset === "jb2a.fireball.explosion.orange")[1].animaterLight;
  };
  const plain = await flashOf(context), slowed = await flashOf({ ...context, tempo: 0.5 });
  assert.equal(plain.shape, "flash");
  assert.equal(slowed.lengthMs, 2 * plain.lengthMs);
  assert.equal(slowed.rate, 0.5);
  assert.equal(plain.rate, undefined);
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
test("lights on a crit play follow the hit-stop retiming", async () => {
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
  // The burst starts after contact, so the hold (100 ms) moves its light; the hit started before contact.
  assert.equal(crit.light.startMs, 700);
  assert.equal(crit.plan.find((s) => s.stageId === "boom").delay - crit.plan.find((s) => s.stageId === "hit").delay, 700);
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
  // A travel clip keeps its own arrival (Sequencer picks its range variant by the shorter line): 55% of 1000 ms.
  assert.equal(wall.delay, 550);
  assert.equal(plan.find((s) => s.stageId === "fly").flightArrivalCut, undefined);
  // What followed the hit keeps its time.
  assert.equal(plan.find((s) => s.stageId === "recoil").delay, 600);
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
    assert.equal(cue.delay, 550);
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
test("setting off keeps today's flights", async () => {
  const { recipe, context } = boltAttack();
  const { calls, plan } = await playWall(recipe, context, { setup: (f) => { f.host.projectileWalls = () => false; } });
  assert.equal(calls.find((c) => c[0] === "stretchTo")[1], context.targets[0]);
  assert.ok(filesOf(calls).includes("jb2a.impact.001.orange"));
  assert.ok(!filesOf(calls).includes(WALL_IMPACT));
  assert.ok(!plan.some((s) => s.flightTo));
  // Arcs off: every flight flies straight.
  const flat = await playWall(recipe, context, { setup: (f) => { f.host.arcingThrows = () => false; } });
  assert.equal(flat.plan.find((s) => s.stageId === "fly").flightArc.kind, "none");
});
// Each Sequencer effect's own calls (the fixture shares one effect proxy).
const effectsOf = (calls) => calls.reduce((all, c) => (c[0] === "effect" ? all.push([]) : all.at(-1)?.push(c), all), []);
test("a lobbed throw lifts screen-up in its turned frame and casts a tier 2 shadow", async () => {
  const BOMB = "jb2a.throwable.throw.bomb.01.black";
  const { recipe, context } = boltAttack();
  const lob = validateRecipe({ ...recipe, stages: recipe.stages.map((s) => (s.stageId === "fly" ? { ...s, assets: [BOMB] } : s)) });
  // Thrown straight down the screen, 600 px: a 1.5-square apex, landing at 55% of 1000 ms.
  const below = { ...context, targets: [{ id: "t1", center: { x: 0, y: 600 }, w: 100, h: 100 }] };
  const { calls, plan } = await playWall(lob, below, { collides: () => null, setup: (f) => f.runtime.catalog.push({ key: BOMB }) });
  const effects = effectsOf(calls);
  const fly = effects.find((e) => e.some((c) => c[0] === "file" && c[1] === BOMB));
  // The stretched clip is turned a quarter, so screen-up is its -x; it only thickens.
  assert.deepEqual(fly.filter((c) => c[0] === "animateProperty").map((c) => [c[1], c[2], c[3].from, c[3].to, c[3].delay, c[3].ease, c[3].absolute]), [
    ["spriteContainer", "position.x", 0, -1.5, 0, "easeOutQuad", true],
    ["spriteContainer", "position.x", -1.5, 0, 275, "easeInQuad", true],
    ["spriteContainer", "scale.y", 1, 1.35, 0, "easeOutQuad", true],
    ["spriteContainer", "scale.y", 1.35, 1, 275, "easeInQuad", true],
  ]);
  const shadow = effects.find((e) => e.some((c) => c[0] === "shape"));
  assert.deepEqual(shadow.find((c) => c[0] === "shape").slice(1), ["ellipse", { type: "ellipse", width: 0.25, height: 0.15, gridUnits: true, fillColor: "#000000", fillAlpha: 1, alpha: 0.35 }]);
  // The shape carries the shadow's alpha; the effect's opacity stays 1.
  assert.equal(shadow.find((c) => c[0] === "opacity")[1], 1);
  assert.ok(shadow.some((c) => c[0] === "belowTokens"));
  assert.deepEqual(shadow.find((c) => c[0] === "moveTowards")[1], { x: 0, y: 600 });
  assert.equal(shadow.find((c) => c[0] === "duration")[1], 550);
  assert.ok(!shadow.some((c) => c[0] === "file"));
  const data = await shadow.find((c) => c[0] === "addOverride")[1](null, {});
  assert.deepEqual([data.animaterTier, data.animaterShadow], [2, true]);
  // The shadow is drawn, not planned.
  assert.ok(!plan.some((s) => s.animaterShadow));
  // A straight bolt neither arcs nor casts a shadow.
  const straight = await playWall(recipe, context, { collides: () => null });
  assert.ok(!straight.calls.some((c) => c[0] === "shape" || c[0] === "animateProperty"));
});
test("an arcing projectile touches down as its impact lands, sooner at a wall", async () => {
  const FLASK = "jb2a.throwable.throw.flask.01.orange";
  const { recipe, context } = boltAttack();
  const thrown = (kind, assets) => validateRecipe({ ...recipe, stages: recipe.stages.map((s) => (s.stageId === "fly" ? { ...s, kind, assets, contact: 600 } : s)) });
  const durationOf = (calls, file) => effectsOf(calls).find((e) => e.some((c) => c[0] === "file" && c[1] === file)).find((c) => c[0] === "duration")[1];
  const shadowOf = (calls) => effectsOf(calls).find((e) => e.some((c) => c[0] === "shape"));
  const add = (f) => f.runtime.catalog.push({ key: FLASK });
  // Clear: the flask's move ends at its arrival (contact 600), when the hit plays.
  const clear = await playWall(thrown("projectile", [FLASK]), context, { collides: () => null, setup: add });
  assert.equal(clear.plan.find((s) => s.stageId === "hit").delay, 600);
  assert.equal(durationOf(clear.calls, FLASK), 600);
  assert.equal(shadowOf(clear.calls).find((c) => c[0] === "duration")[1], 600);
  // A wall halfway: the contact shortens to 300 ms, and the flask lands there with the wall strike.
  const walled = await playWall(thrown("projectile", [FLASK]), context, { setup: add });
  assert.equal(walled.plan.find((s) => s.kind === "impact").delay, 300);
  // What followed the hit moves up with it (a projectile's shorter flight; a travel clip keeps its arrival).
  assert.equal(walled.plan.find((s) => s.stageId === "recoil").delay, 300);
  assert.equal(durationOf(walled.calls, FLASK), 300);
  assert.equal(shadowOf(walled.calls).find((c) => c[0] === "duration")[1], 300);
  // A straight projectile keeps its whole duration.
  const bolt = await playWall(thrown("projectile", ["jb2a.fire_bolt.orange"]), context, { collides: () => null });
  assert.equal(durationOf(bolt.calls, "jb2a.fire_bolt.orange"), 1000);
});
test("preview never drops on-target stages", async () => {
  const { recipe, context } = boltAttack();
  const { calls } = await playWall(recipe, context, { options: { preview: true } });
  assert.ok(filesOf(calls).includes("jb2a.impact.001.orange"));
  assert.ok(!filesOf(calls).includes(WALL_IMPACT));
});
test("hit-stop contact lands on the wall impact", async () => {
  const { recipe, context } = boltAttack({ outcome: "criticalSuccess" });
  const { calls } = await playWall(recipe, context);
  const tags = Object.fromEntries((await overridesByAsset(calls)).map(([asset, data]) => [asset, data.animaterHitStop]));
  assert.deepEqual(tags[WALL_IMPACT], { afterMs: 0, holdMs: 100 });
  assert.deepEqual(tags["jb2a.fire_bolt.orange"], { afterMs: 550, holdMs: 100 });
});
test("a fire bolt into a wall lights its path to the wall point", async () => {
  const { recipe, context } = boltAttack();
  const fiery = validateRecipe({ ...recipe, stages: recipe.stages.map((s) => (s.stageId === "fly" ? { ...s, assets: ["jb2a.fireball.beam.orange"] } : s)) });
  const { calls } = await playWall(fiery, context, { setup: (f) => { f.host.effectLights = () => true; } });
  const glow = (await overridesByAsset(calls)).find(([asset]) => asset === "jb2a.fireball.beam.orange")[1].animaterLight;
  assert.deepEqual(glow.from, { x: 0, y: 0 });
  assert.deepEqual(glow.to, { x: WALL_X, y: 0 });
  assert.equal(glow.arriveMs, 550);
  // Slowed, the glow and the wall impact still meet at the wall.
  const slowed = await playWall(fiery, { ...context, tempo: 0.5 }, { setup: (f) => { f.host.effectLights = () => true; } });
  const slowGlow = (await overridesByAsset(slowed.calls)).find(([asset]) => asset === "jb2a.fireball.beam.orange")[1].animaterLight;
  assert.equal(slowGlow.arriveMs, 1100);
  assert.equal(slowed.plan.find((s) => s.kind === "impact").delay, 1100);
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
test("slowed, an arcing projectile lands with its slowed impact", async () => {
  const FLASK = "jb2a.throwable.throw.flask.01.orange";
  const { recipe, context } = boltAttack();
  const thrown = validateRecipe({ ...recipe, stages: recipe.stages.map((s) => (s.stageId === "fly" ? { ...s, kind: "projectile", assets: [FLASK], contact: 600 } : s)) });
  const { calls, plan } = await playWall(thrown, { ...context, tempo: 0.5 }, { collides: () => null, setup: (f) => f.runtime.catalog.push({ key: FLASK }) });
  const effects = effectsOf(calls);
  // The hit lands at 1200 ms; the flask's effect ends then (600 ms of clip at half speed).
  assert.equal(plan.find((s) => s.stageId === "hit").delay, 1200);
  const flask = effects.find((e) => e.some((c) => c[0] === "file" && c[1] === FLASK));
  assert.equal(flask.find((c) => c[0] === "duration")[1], 600);
  // Its arc falls back over the second half of those 1200 ms, and its shadow lands with it.
  assert.ok(flask.some((c) => c[0] === "animateProperty" && c[3].delay === 600 && c[3].duration === 600));
  assert.equal(effects.find((e) => e.some((c) => c[0] === "shape")).find((c) => c[0] === "duration")[1], 1200);
});
test("the wall test is told who shoots (for the shooter's level)", async () => {
  const { recipe, context } = boltAttack();
  const seen = [];
  await playWall(recipe, context, { collides: (a, b, type, source) => { seen.push(source); return null; } });
  assert.ok(seen.length && seen.every((s) => s === context.source));
});
