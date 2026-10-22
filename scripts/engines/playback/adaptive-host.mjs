// Adaptive playback on this client: watches its own frame time, adapts Animater's effects as they
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

export function createAdaptiveHost({
  state, quality, catalog, weaponRecipes, preload, endLocally, sceneId,
  hidden = defaultHidden, view = defaultView,
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

  return {
    onTick(deltaMS, nowMs) {
      monitor.sample(deltaMS, nowMs, { hidden: hidden() });
    },
    onCanvasReady(nowMs) {
      monitor.warmup(nowMs);
    },
    onEffect(effect) {
      try {
        const data = effect?.data;
        if (!data || !state.enabled || data.moduleName !== 'animater') return;
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
    onTurn(combat) {
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
    },
    // Advisory: a failure here must never stop a play.
    rememberAssets(actorId, assets) {
      try {
        memory.remember(actorId, Array.isArray(assets) ? assets : []);
      } catch { /* ignore */ }
    },
    adaptive() {
      return { stagger: on('stagger'), staggered: (n) => { state.stats.staggered += n; } };
    },
    stats() {
      return { ...state.stats, typicalMs: monitor.typicalMs(), queued: queue.size() };
    },
  };
}
