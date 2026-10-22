// Pure decisions for adaptive playback: is this client's frame time tight, how
// big is an effect on screen, and what to do with it. No Foundry globals here.
import { OPTIONAL_FX_KINDS } from './optional-fx.mjs';

const SMALL_PX = 48;
const MIN_SAMPLES = 10;
const TIGHT_RATIO = 0.85;

// Typical main-thread work per frame (75th percentile) over a short recent window. Work, not the
// frame interval: a 60 fps cap on a 75 Hz screen gives uneven intervals on an idle machine.
// A fixed ring of samples, so sampling every frame allocates nothing.
export function createFrameMonitor({ windowMs = 3000, warmupMs = 3000, capacity = 1024 } = {}) {
  const times = new Float64Array(capacity), works = new Float64Array(capacity), scratch = new Float64Array(capacity);
  let head = 0, count = 0, last = 0;
  let ignoreUntil = -Infinity;
  return {
    sample(workMs, nowMs, hidden = false) {
      if (hidden || nowMs < ignoreUntil) return;
      times[head] = nowMs;
      works[head] = workMs;
      head = (head + 1) % capacity;
      if (count < capacity) count++;
      last = nowMs;
    },
    warmup(nowMs) {
      count = 0;
      ignoreUntil = nowMs + warmupMs;
    },
    typicalMs() {
      let n = 0;
      // Newest first, back to the start of the window.
      for (let i = 1; i <= count; i++) {
        const at = (head - i + capacity) % capacity;
        if (times[at] < last - windowMs) break;
        scratch[n++] = works[at];
      }
      if (n < MIN_SAMPLES) return null;
      return scratch.subarray(0, n).sort()[Math.floor(0.75 * n)];
    },
    isTight(targetMs) {
      const typical = this.typicalMs();
      return typical !== null && typical > TIGHT_RATIO * targetMs;
    },
  };
}

// Largest on-screen dimension in px, or null when it cannot be told.
export function effectScreenSize(data, { gridSize, zoom, tokenSize } = {}) {
  if (data.stretchTo || data.copySprite || data.screenSpace || data.moves) return null;
  const scale = data.scale || {};
  if (data.scaleToObject) {
    const token = data.source && tokenSize ? tokenSize(data.source) : null;
    if (!token) return null;
    const factor = Number(data.scaleToObject.scale) || 1;
    return Math.max(token.width, token.height) * factor * zoom;
  }
  if (data.size) {
    const unit = data.size.gridUnits ? gridSize : 1;
    const rawWidth = Number(data.size.width);
    const rawHeight = Number(data.size.height);
    if (!Number.isFinite(rawWidth) && !Number.isFinite(rawHeight)) return null;
    const width = (Number.isFinite(rawWidth) ? rawWidth : 0) * unit * (scale.x ?? 1);
    const height = (Number.isFinite(rawHeight) ? rawHeight : 0) * unit * (scale.y ?? 1);
    return Math.max(width, height) * zoom;
  }
  return null;
}

// Keep, drop or lighten one Animater effect. Tier 0 is never dropped; the preview is never touched.
export function adaptEffect(data, { tight, zoom, gridSize, tokenSize, decisions, lod = true, budget = true }) {
  if (data.moduleName !== 'animater' || data.animaterTier === undefined || data.animaterLasting || data.animaterPreview) return 'keep';
  const tier = data.animaterTier;
  // Unnamed effects get a throwaway session so they never share one verdict.
  const fresh = () => ({ tight, small: {} });
  const session = data.name ? decisions.decide(data.name, fresh) : fresh();
  if (session.small[tier] === undefined) {
    const px = effectScreenSize(data, { gridSize, zoom, tokenSize });
    session.small[tier] = px !== null && px < SMALL_PX;
  }
  const small = session.small[tier];
  if (tier === 2) return (budget && session.tight) || (lod && small) ? 'drop' : 'keep';
  return lod && small ? 'lighten' : 'keep';
}

// One decision per animation, oldest forgotten past the limit.
export function createSessionDecisions(limit = 200) {
  const map = new Map();
  return {
    decide(session, compute) {
      if (map.has(session)) return map.get(session);
      const value = compute();
      map.set(session, value);
      if (map.size > limit) map.delete(map.keys().next().value);
      return value;
    },
  };
}

// Copies of one stage (a hit per target) start a few ms apart so one frame never builds them all.
export function staggerDelays(stages, { step = 16, cap = 50, min = 4 } = {}) {
  const groups = new Map();
  for (const s of stages) {
    if (s.kind === 'sound' || s.kind === 'motion' || OPTIONAL_FX_KINDS.has(s.kind)) continue;
    if (!groups.has(s.stageId)) groups.set(s.stageId, []);
    groups.get(s.stageId).push(s);
  }
  const delays = new Map();
  for (const copies of groups.values()) {
    if (copies.length < min) continue;
    copies.forEach((s, k) => delays.set(s, Math.min(k * step, cap)));
  }
  return delays;
}

// What each actor played lately, newest last, so a client can warm those files.
export function createAssetMemory(perActor = 24) {
  const byActor = new Map();
  return {
    remember(actorId, assets) {
      if (!actorId) return;
      const list = (byActor.get(actorId) || []).slice();
      for (const entry of assets) {
        const at = list.findIndex((e) => e.asset === entry.asset);
        if (at >= 0) list.splice(at, 1);
        list.push({ asset: entry.asset, tier: entry.tier });
      }
      byActor.set(actorId, list.slice(-perActor));
    },
    recall(actorId) {
      return (byActor.get(actorId) || []).map((e) => ({ ...e }));
    },
  };
}

// Files worth warming: weapon assets first, then recent ones, no repeats or cached.
export function preloadFiles({ weaponAssets = [], recentAssets = [], toFile, has }) {
  const out = new Set();
  for (const asset of [...weaponAssets, ...recentAssets]) {
    const file = toFile(asset);
    if (file && !has(file)) out.add(file);
  }
  return [...out];
}

// Loads a couple of files at a time, resting between batches and while hidden.
export function createPreloadQueue({
  load,
  hidden,
  batch = 2,
  pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}) {
  const queue = [];
  let running = false;
  async function run() {
    running = true;
    try {
      while (queue.length) {
        if (hidden()) {
          await pause(250);
          continue;
        }
        const files = queue.splice(0, batch);
        // A failed batch is dropped, never retried.
        try { await load(files); } catch { /* ignore */ }
        await pause(0);
      }
    } catch { /* never throw */ }
    running = false;
  }
  return {
    add(files) {
      for (const f of files) if (!queue.includes(f)) queue.push(f);
      if (!running && queue.length) run();
    },
    size: () => queue.length,
  };
}
