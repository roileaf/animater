// A local stress scene for the Sequencer speed-ups: attached, stretched and off-screen filtered effects
// plus wall-aware positional sounds, measured with every speed-up off, all on, and each one alone.
// Everything plays locally and unsaved (no flags, nothing sent to other players) and is ended afterwards.
export const BENCH_PATCHES = ['engine', 'effects', 'sound', 'culling'];

const WARMUP_MS = 5000; // textures load and effects settle before anything is measured
const SETTLE_MS = 1000; // between switching the speed-ups and measuring
const SOUND_VOLUME = 0.02; // quiet but audible: Foundry never starts a positional sound at volume 0
const SOUND_RADIUS = 30; // distance units, large enough to reach from each sound to the view

// The measured phases in order. 'all off' and 'all on' run at the start and again at the end,
// so drift over the run (caching, GC, other load) shows up next to the per-patch rows.
export function benchPhases(patches = BENCH_PATCHES) {
  const allOn = Object.fromEntries(patches.map((p) => [p, true]));
  return [
    ['all off', {}],
    ['all on', allOn],
    ...patches.map((p) => [`${p} only`, { [p]: true }]),
    ['all off (end)', {}],
    ['all on (end)', allOn],
  ];
}

const percent = (value) => `${(value * 100).toFixed(1)}%`;
const change = (from, to) => (from ? (to - from) / from : NaN);

// Drift of a phase repeated at the end, as a signed change in average frame time from its first run.
export function benchDrift(rows) {
  const drift = {};
  for (const label of ['all off', 'all on']) {
    const start = rows[label], end = rows[`${label} (end)`];
    const d = change(start?.avgMs, end?.avgMs);
    if (Number.isFinite(d)) drift[label] = d;
  }
  return drift;
}

// One row per phase. 'vs off' compares against the mean of both 'all off' runs, so slow drift in
// either direction doesn't favour the patches measured early or late.
export function summarizeBenchmark(rows) {
  const offs = ['all off', 'all off (end)'].map((label) => rows[label]?.avgMs).filter(Number.isFinite);
  const baseline = offs.length ? offs.reduce((a, b) => a + b, 0) / offs.length : NaN;
  const drift = benchDrift(rows);
  return Object.fromEntries(Object.entries(rows).map(([label, r]) => {
    const isOff = label.startsWith('all off');
    const start = label.endsWith(' (end)') ? label.slice(0, -' (end)'.length) : null;
    const saved = -change(baseline, r.avgMs);
    return [label, {
      'avg ms/frame': r.avgMs, 'p95 ms': r.p95Ms, fps: r.fps,
      'vs off': isOff ? '—' : Number.isFinite(saved) ? `${percent(Math.abs(saved))} ${saved >= 0 ? 'less' : 'more'}` : '—',
      drift: start && start in drift ? `${drift[start] >= 0 ? '+' : ''}${percent(drift[start])}` : '—',
      'effect skips': r.effectSkips, 'sound skips': r.soundSkips, culled: r.culled,
    }];
  }));
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function viewRect() {
  const { x, y, width, height } = canvas.app.renderer.screen;
  const t = canvas.stage.worldTransform, scale = t.a;
  return { x: (x - t.tx) / scale, y: (y - t.ty) / scale, width: width / scale, height: height / scale };
}

function buildScene(name, { effects, sounds, durationMs }) {
  const tokens = canvas.tokens.placeables.filter((token) => token.visible);
  if (tokens.length < 2) throw Error('Animater benchmark: place at least two visible tokens on the scene first.');
  const view = viewRect(), grid = canvas.grid.size;
  const sequence = new Sequence({ moduleName: 'animater' });
  for (let i = 0; i < effects; i++) {
    const token = tokens[i % tokens.length], other = tokens[(i + 1) % tokens.length];
    const effect = sequence.effect().file('icons/svg/aura.svg').name(name).duration(durationMs).locally();
    switch (i % 3) {
      case 0: // attached, spinning and pulsing
        effect.attachTo(token).scaleToObject(1.6)
          .loopProperty('sprite', 'rotation', { from: 0, to: 360, duration: 4000 })
          .loopProperty('alphaFilter', 'alpha', { values: [0.5, 1], duration: 1000, pingPong: true });
        break;
      case 1: // stretched between two tokens, following both
        effect.attachTo(token).stretchTo(other, { attachTo: true })
          .loopProperty('alphaFilter', 'alpha', { values: [0.6, 1], duration: 1500, pingPong: true });
        break;
      default: // filtered, parked off-screen to the right of the view
        effect.atLocation({ x: view.x + view.width + grid * (4 + (i % 10)), y: view.y + view.height / 2 + grid * (i % 7) })
          .size(grid * 2).filter('Glow', { distance: 10, outerStrength: 4, color: 0xff8800 })
          .loopProperty('sprite', 'rotation', { from: 0, to: 360, duration: 3000 });
    }
  }
  // Sounds sit at points near the tokens rather than on them: Sequencer mutes sounds attached to
  // hidden tokens, and alwaysForGMs lets them play without a token listener in range.
  for (let i = 0; i < sounds; i++) {
    const { x, y } = tokens[i % tokens.length].center, offset = grid * (Math.floor(i / tokens.length) % 3);
    sequence.sound().file('sounds/drums.wav').name(name).atLocation({ x: x + offset, y: y + offset })
      .radius(SOUND_RADIUS).constrainedByWalls(true).alwaysForGMs(true).volume(SOUND_VOLUME)
      .duration(durationMs).loopOptions({ loops: 0 }).locally();
  }
  return sequence;
}

// Sequencer's endSounds filters by the viewed scene and misses sounds that never got a gain node
// (they keep retrying in STARTING), so end by name, then stop whatever is left directly.
async function endBenchmarkSounds(name) {
  const manager = globalThis.Sequencer?.SoundManager;
  if (!manager) return 0;
  const left = () => (manager.sounds ?? []).filter((sound) => sound?.data?.name === name);
  await wait(500); // sounds still loading join RunningSounds only once loaded
  try { await manager.endSounds?.({ name }, false); } catch (error) { console.warn('Animater benchmark | endSounds failed', error); }
  for (let attempt = 0; attempt < 3 && left().length; attempt++) {
    for (const sound of left()) {
      try { await (manager._removeSound ? manager._removeSound(sound) : sound.stop()); } catch {}
    }
    await wait(250);
  }
  const remaining = left().length;
  if (remaining) console.warn(`Animater benchmark | ${remaining} benchmark sound(s) could not be ended`);
  return remaining;
}

export async function runBenchmark({ state, profile, effects = 60, sounds = 6, seconds = 6 } = {}) {
  if (!canvas?.ready || typeof globalThis.Sequence !== 'function') throw Error('Animater benchmark: needs an active scene and Sequencer.');
  const phases = benchPhases();
  const saved = Object.fromEntries(['enabled', ...BENCH_PATCHES].map((k) => [k, state[k]]));
  const name = `animater-benchmark-${foundry.utils.randomID()}`;
  const durationMs = WARMUP_MS + phases.length * (seconds * 1000 + SETTLE_MS) + 6000;
  const rows = {};
  try {
    // Effects register their per-frame handlers when they start, so play them with the speed-ups on.
    Object.assign(state, { enabled: true }, Object.fromEntries(BENCH_PATCHES.map((p) => [p, true])));
    await buildScene(name, { effects, sounds, durationMs }).play();
    await wait(WARMUP_MS);
    for (const [label, on] of phases) {
      for (const p of BENCH_PATCHES) state[p] = Boolean(on[p]);
      await wait(SETTLE_MS);
      rows[label] = await profile(seconds, { quiet: true });
    }
  } finally {
    Object.assign(state, saved);
    await globalThis.Sequencer?.EffectManager?.endEffects?.({ name }, false);
    await endBenchmarkSounds(name);
  }
  const table = summarizeBenchmark(rows);
  const drift = benchDrift(rows);
  console.log(`Animater | Sequencer speed-ups benchmark: ${effects} effects, ${sounds} sounds, ${seconds}s per phase`);
  console.log(`Animater | run-to-run drift: ${Object.entries(drift).map(([label, d]) => `${label} ${d >= 0 ? '+' : ''}${percent(d)}`).join(', ') || 'n/a'}`
    + ' (large drift means the per-patch rows are noisy; rerun with more seconds)');
  console.table(table);
  return table;
}
