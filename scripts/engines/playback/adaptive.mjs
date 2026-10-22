// Pure decisions for adaptive playback: is this client's frame time tight, how
// big is an effect on screen, and what to do with it. No Foundry globals here.
const SMALL_PX = 48;
const MIN_SAMPLES = 10;
const TIGHT_RATIO = 1.25;

// Typical frame time (75th percentile) over a short recent window.
export function createFrameMonitor({ windowMs = 3000, warmupMs = 3000 } = {}) {
  let samples = [];
  let ignoreUntil = -Infinity;
  return {
    sample(deltaMS, nowMs, { hidden = false } = {}) {
      if (hidden || nowMs < ignoreUntil) return;
      samples.push({ t: nowMs, ms: deltaMS });
      samples = samples.filter((s) => s.t >= nowMs - windowMs);
    },
    warmup(nowMs) {
      samples = [];
      ignoreUntil = nowMs + warmupMs;
    },
    typicalMs() {
      if (samples.length < MIN_SAMPLES) return null;
      const sorted = samples.map((s) => s.ms).sort((a, b) => a - b);
      return sorted[Math.floor(0.75 * sorted.length)];
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

// Keep, drop or lighten one Animater effect. Tier 0 is never dropped.
export function adaptEffect(data, { tight, zoom, gridSize, tokenSize, decisions, lod = true, budget = true }) {
  if (data.moduleName !== 'animater' || data.animaterTier === undefined || data.animaterLasting) return 'keep';
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
