// Speed-ups for Sequencer itself, applied in memory (Sequencer's files are untouched). They apply to
// every Sequencer effect in the world, not only Animater's. Each patch fails open: when a Sequencer
// internal it expects is missing, Sequencer simply runs unpatched.
import { installEngineCapture } from './engine.mjs';
import { patchEffectPrototype, repointTickHandlers } from './effects.mjs';
import { installSoundPatch, bumpGeometryEpoch } from './sound.mjs';
import { patchEffectRender } from './culling.mjs';
import { runBenchmark } from './benchmark.mjs';

// The last four drive adaptive playback (engines/playback/adaptive-host.mjs) on this client.
export const PATCHES = ['engine', 'effects', 'sound', 'culling', 'preload', 'stagger', 'lod', 'budget'];
const speedupKey = (key) => `speedup${key[0].toUpperCase()}${key.slice(1)}`;

export const turboState = {
  enabled: true,
  engine: true,
  effects: true,
  sound: true,
  culling: true,
  preload: true,
  stagger: true,
  lod: true,
  budget: true,
  refreshFrames: 30,
  frame: 0,
  engineCaptured: false,
  // Set when Sequencer's engine is not the 4.3.0 code the engine patch was written against.
  engineSkipped: null,
  stats: { effectRuns: 0, effectSkips: 0, soundRuns: 0, soundSkips: 0, culled: 0, preloaded: 0, staggered: 0, droppedSize: 0, droppedBudget: 0, lightened: 0 },
};

// Sequencer's animation engine starts lazily on its first animation, so hooking at import time is early
// enough. The engine flag is read through a view so switching it off hands frames back to the original.
// Another Sequencer version keeps its own engine (engine.mjs checks the methods' source first).
installEngineCapture({ get enabled() { return turboState.enabled && turboState.engine; } },
  () => { turboState.engineCaptured = true; }, {
    onSkipped: () => {
      turboState.engineCaptured = false;
      turboState.engineSkipped = 'unknown Sequencer engine';
      console.info('Animater | Sequencer speed-ups: this Sequencer version has an unknown animation engine, left unpatched');
    },
  });

function onEffectCreated(effect) {
  try {
    patchEffectPrototype(effect, turboState);
    patchEffectRender(effect, turboState);
    repointTickHandlers(effect);
  } catch (err) {
    console.error('Animater | Sequencer speed-ups could not patch an effect', err);
  }
}

// Main-thread time per frame in the canvas ticker (Sequencer, Foundry and PIXI rendering together).
// Run once with the speed-ups on and once off to compare.
async function profile(seconds = 10, { quiet = false } = {}) {
  const ticker = canvas.app.ticker, samples = [];
  const hadOwn = Object.prototype.hasOwnProperty.call(ticker, 'update'), nativeUpdate = ticker.update;
  ticker.update = function (...args) {
    const t0 = performance.now();
    const result = nativeUpdate.apply(this, args);
    samples.push(performance.now() - t0);
    return result;
  };
  const before = { ...turboState.stats };
  try { await new Promise((resolve) => setTimeout(resolve, seconds * 1000)); }
  finally { if (hadOwn) ticker.update = nativeUpdate; else delete ticker.update; }

  samples.sort((a, b) => a - b);
  const avg = samples.reduce((a, b) => a + b, 0) / (samples.length || 1);
  const result = {
    speedups: turboState.enabled,
    frames: samples.length,
    fps: +(samples.length / seconds).toFixed(1),
    avgMs: +avg.toFixed(3),
    p95Ms: +(samples[Math.floor(samples.length * 0.95)] ?? 0).toFixed(3),
    maxMs: +(samples.at(-1) ?? 0).toFixed(3),
    effects: globalThis.Sequencer?.EffectManager?.effects?.length ?? 0,
    sounds: globalThis.Sequencer?.SoundManager?.sounds?.length ?? 0,
    ...Object.fromEntries(Object.entries(turboState.stats).map(([k, v]) => [k, v - before[k]])),
  };
  if (!quiet) console.table(result);
  return result;
}

const status = () => ({ ...Object.fromEntries(['enabled', ...PATCHES, 'refreshFrames', 'engineCaptured', 'engineSkipped'].map((k) => [k, turboState[k]])), stats: { ...turboState.stats }, typicalFrameMs: turboState.typicalFrame?.() ?? null });

// Per-patch switches are client settings kept out of the settings window; flip them from the console
// when tracking down a problem: game.modules.get('animater').api.sequencerSpeedups.set('sound', false).
async function set(key, value) {
  if (!PATCHES.includes(key)) throw Error(`Unknown speed-up "${key}". Choose one of: ${PATCHES.join(', ')}`);
  await game.settings.set('animater', speedupKey(key), Boolean(value));
  return status();
}

// A local stress scene measured with each speed-up off and on: api.sequencerSpeedups.benchmark().
const benchmark = (options = {}) => runBenchmark({ ...options, state: turboState, profile });

export const sequencerSpeedupsApi = { status, profile, set, benchmark };

export function registerSequencerSpeedups(ID) {
  game.settings.register(ID, 'sequencerSpeedups', {
    name: 'Faster animations (this device)',
    hint: 'Makes animations cheaper for your computer to draw, with no change in how they look. Covers every module that plays animations through Sequencer, not only Animater. In combat it also loads the next creature’s animations ahead of its turn, and it skips tiny details you could not see at your current zoom. Only your screen is affected. Turn this off if an animation from any module looks wrong.',
    scope: 'client', config: true, type: Boolean, default: true,
    onChange: (value) => { turboState.enabled = value; },
  });
  game.settings.register(ID, 'sequencerSpeedupRefresh', {
    name: 'Faster animations: position recheck (frames)',
    hint: 'How often effects and sounds that follow a token double-check where it is, even when nothing seems to have moved. 30 frames is about half a second. Lower it if an effect trails behind a token that another module moves.',
    scope: 'client', config: true, type: Number, default: 30, range: { min: 1, max: 600, step: 1 },
    onChange: (value) => { turboState.refreshFrames = value; },
  });
  for (const key of PATCHES) {
    game.settings.register(ID, speedupKey(key), {
      scope: 'client', config: false, type: Boolean, default: true,
      onChange: (value) => { turboState[key] = value; },
    });
    turboState[key] = game.settings.get(ID, speedupKey(key));
  }
  turboState.enabled = game.settings.get(ID, 'sequencerSpeedups');
  turboState.refreshFrames = game.settings.get(ID, 'sequencerSpeedupRefresh');

  // Nothing here may stop Animater from starting: without PIXI (or on any error) Sequencer runs unpatched.
  if (!globalThis.PIXI?.Ticker) return;
  try {
    installSoundPatch(turboState);
    Hooks.on('createSequencerEffect', onEffectCreated);
    for (const hook of ['createWall', 'updateWall', 'deleteWall', 'canvasReady', 'canvasInit', 'updateScene', 'createRegion', 'updateRegion', 'deleteRegion'])
      Hooks.on(hook, bumpGeometryEpoch);

    // canvas.app (and its ticker) survives scene changes; count frames once per ticker.
    let counted = null;
    Hooks.on('canvasReady', () => {
      const ticker = canvas?.app?.ticker;
      if (ticker && counted !== ticker) {
        counted = ticker;
        ticker.add(() => turboState.frame++, undefined, PIXI.UPDATE_PRIORITY.HIGH + 1);
      }
      // Effects already playing when the canvas was drawn.
      for (const effect of globalThis.Sequencer?.EffectManager?.effects ?? []) onEffectCreated(effect);
    });
  } catch (err) {
    console.error('Animater | Sequencer speed-ups are off: setup failed', err);
  }
}
