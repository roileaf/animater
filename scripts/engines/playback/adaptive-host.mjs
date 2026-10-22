// Adaptive playback on this client: times its own work per frame, adapts Animater's effects as they
// arrive, and warms the next combatant's files. Foundry is reached only through the options.
import {
  createFrameMonitor, adaptEffect, createSessionDecisions, createAssetMemory, preloadFiles, createPreloadQueue,
} from './adaptive.mjs';
import { OPTIONAL_FX_KINDS } from './optional-fx.mjs';
import { allowsTier, EXPENSIVE_FILTERS } from '../../core/quality.mjs';
import { resolveAsset } from '../../core/model.mjs';
import { safeMediaFile } from '../media/media-library-model.mjs';

const WEAPON_TIER = 0;

// The actor whose turn is next, when its token is on this scene.
export function nextCombatantActor(combat, sceneId) {
  try {
    const next = combat?.nextCombatant;
    if (!next || !next.token || next.token.parent?.id !== sceneId) return null;
    return next.actor ?? null;
  } catch {
    return null;
  }
}

const defaultView = () => ({ zoom: 1, gridSize: 100, targetMs: 1000 / 60, tokenSize: () => null });
const defaultHidden = () => Boolean(globalThis.document?.hidden);
// Off the calling hook: when the browser is idle, else on the next task.
const defaultDefer = (fn) => (typeof globalThis.requestIdleCallback === 'function'
  ? globalThis.requestIdleCallback(fn, { timeout: 1000 }) : setTimeout(fn, 0));

export function createAdaptiveHost({
  state, quality, catalog, weaponRecipes, preload, endLocally, sceneId,
  hidden = defaultHidden, view = defaultView, defer = defaultDefer,
}) {
  const monitor = createFrameMonitor({ windowMs: 3000, warmupMs: 3000 });
  const decisions = createSessionDecisions();
  const memory = createAssetMemory(24);
  // Sequencer's file cache is not exposed, so remember what this client already warmed.
  const warmed = new Set();
  const queue = createPreloadQueue({
    hidden,
    batch: 2,
    load: async (files) => {
      await preload(files);
      state.stats.preloaded += files.length;
    },
  });
  const on = (key) => Boolean(state.enabled && state[key]);
  state.typicalFrame = () => monitor.typicalMs();

  // A catalog key to its file; a plain media path is its own file.
  const fileOf = (entries) => (asset) => {
    const hit = entries.find((e) => e.key === asset);
    if (hit?.file) return hit.file;
    return safeMediaFile(asset) ? asset : null;
  };

  // Every client keeps what each actor played as the effects arrive. Lasting and preview effects are not
  // turn-by-turn files; untagged ones are not Animater's play.
  const remember = (data) => {
    const actor = data.animaterActor, file = data.file;
    if (!actor || typeof file !== 'string' || !file || data.animaterTier === undefined || data.animaterLasting || data.animaterPreview) return;
    memory.remember(actor, [{ asset: file, tier: data.animaterTier }]);
  };

  const prepareTurn = (combat) => {
    try {
      if (!on('preload')) return;
      const actor = nextCombatantActor(combat, sceneId());
      if (!actor) return;
      const level = quality();
      const entries = catalog() ?? [];
      const weaponAssets = [];
      if (allowsTier(level, WEAPON_TIER)) {
        for (const recipe of weaponRecipes(actor) ?? []) {
          for (const stage of recipe?.stages ?? []) {
            if (OPTIONAL_FX_KINDS.has(stage.kind) || !Array.isArray(stage.assets)) continue;
            const key = resolveAsset(stage, entries);
            if (key) weaponAssets.push(key);
          }
        }
      }
      const recentAssets = memory.recall(actor.id).filter((e) => allowsTier(level, e.tier)).map((e) => e.asset);
      const files = preloadFiles({ weaponAssets, recentAssets, toFile: fileOf(entries), has: (f) => warmed.has(f) });
      for (const f of files) warmed.add(f);
      if (files.length) queue.add(files);
    } catch (err) {
      console.warn('Animater | could not preload the next turn', err);
    }
  };

  // Set when a frame's work begins (before everything else on the ticker), read after it is drawn.
  let frameStart = -1;

  return {
    onFrameStart(nowMs) {
      if (state.enabled) frameStart = nowMs;
    },
    onFrameEnd(nowMs) {
      if (!state.enabled || frameStart < 0) return;
      monitor.sample(nowMs - frameStart, nowMs, hidden());
      frameStart = -1;
    },
    onCanvasReady(nowMs) {
      monitor.warmup(nowMs);
    },
    onEffect(effect) {
      try {
        const data = effect?.data;
        if (!data || !state.enabled || data.moduleName !== 'animater') return;
        remember(data);
        const { zoom, gridSize, targetMs, tokenSize } = view();
        const opts = { tight: monitor.isTight(targetMs), zoom, gridSize, tokenSize, decisions, lod: on('lod'), budget: on('budget') };
        const verdict = adaptEffect(data, opts);
        if (verdict === 'lighten') {
          if (Array.isArray(data.filters)) data.filters = data.filters.filter((f) => !EXPENSIVE_FILTERS.has(f?.className));
          state.stats.lightened++;
        } else if (verdict === 'drop') {
          // Same session again without the size rule: still dropped means the budget did it.
          const budget = adaptEffect(data, { ...opts, lod: false }) === 'drop';
          state.stats[budget ? 'droppedBudget' : 'droppedSize']++;
          endLocally(effect);
        }
      } catch (err) {
        console.warn('Animater | adaptive playback skipped an effect', err);
      }
    },
    // Resolving weapon recipes is real work: never inside the combat update itself.
    onTurn(combat) {
      try { defer(() => prepareTurn(combat)); } catch { /* advisory */ }
    },
    adaptive() {
      return { stagger: on('stagger'), staggered: (n) => { state.stats.staggered += n; } };
    },
    stats() {
      return { ...state.stats, typicalMs: monitor.typicalMs(), queued: queue.size() };
    },
  };
}
