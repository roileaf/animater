import test from "node:test";
import assert from "node:assert/strict";
import { AnimaterRuntime } from "../../../scripts/engines/playback/runtime.mjs";
import { starterRecipes } from "../../../scripts/core/presets.mjs";
import { validateRecipe } from "../../../scripts/core/model.mjs";
import { orbRecipe } from "../../../scripts/catalogs/shared/orb-builder.mjs";
import { PF2E_SPELLS, spellRecipe } from "../../../scripts/catalogs/pf2e/spells/spell-catalog.mjs";

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
