// Interprets preset `animated` blocks (Token Magic's data format) with animater's own
// timing model. Every value is a pure function of time, so a preset looks the same on
// every client for sync* animations and never drifts or accumulates error.
//
// A spec: {animType, active, loopDuration (ms), loops, pauseBetweenDuration (ms),
//          val1, val2, speed (per ms, for move), chaosFactor, clockWise, syncShift, wantInteger}

export const ANIM_TYPES = [
  'move', 'rotation', 'syncRotation',
  'cosOscillation', 'syncCosOscillation', 'halfCosOscillation',
  'sinOscillation', 'syncSinOscillation', 'halfSinOscillation',
  'chaoticOscillation', 'syncChaoticOscillation',
  'colorOscillation', 'syncColorOscillation', 'halfColorOscillation',
  'randomNumber', 'randomNumberPerLoop', 'randomColor', 'randomColorPerLoop',
];
const KNOWN = new Set(ANIM_TYPES);
const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

export function normalizeAnim(spec = {}) {
  const type = KNOWN.has(spec.animType) ? spec.animType : null;
  return {
    animType: type,
    active: spec.active !== false,
    loopDuration: Math.max(16, num(spec.loopDuration, 3000)),
    loops: num(spec.loops, 0) > 0 ? spec.loops : Infinity,
    pause: Math.max(0, num(spec.pauseBetweenDuration, 0)),
    val1: num(spec.val1, 0),
    val2: num(spec.val2, 0),
    speed: num(spec.speed, 0),
    chaos: Math.min(1, Math.max(0, num(spec.chaosFactor, 0.25))),
    clockWise: spec.clockWise !== false,
    shift: Math.max(0, num(spec.syncShift, 0)),
    integer: spec.wantInteger === true,
  };
}

// Deterministic 0..1 random from a string key and an integer (same on every client).
export function seeded(key, n) {
  let h = 2166136261 ^ n;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  h = Math.imul(h ^ (h >>> 15), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const mixColor = (a, b, f) => {
  const ch = (c, s) => (c >> s) & 255;
  const m = s => Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * f);
  return (m(16) << 16) | (m(8) << 8) | m(0);
};

// Where in its loop an animation is. `t` in ms. Returns {loop, p, done}.
export function loopPhase(a, t) {
  const cycle = a.loopDuration + a.pause;
  const shifted = Math.max(0, t + a.shift);
  let loop = Math.floor(shifted / cycle);
  let within = shifted - loop * cycle;
  if (loop >= a.loops) return { loop: a.loops - 1, p: 1, done: true };
  return { loop, p: Math.min(1, within / a.loopDuration), done: false };
}

// The value of one animated parameter at local time `local` (ms since the effect started)
// and world time `world` (ms, shared by every client). `base` is the parameter's static value.
export function animValue(a, base, { local, world, key = '' }) {
  if (!a.active || !a.animType) return base;
  const sync = a.animType.startsWith('sync');
  const t = sync ? world : local;
  const type = sync ? a.animType[4].toLowerCase() + a.animType.slice(5) : a.animType;
  const lerp = f => a.val1 + (a.val2 - a.val1) * f;
  let v;
  if (type === 'move') v = num(base, 0) + a.speed * t;
  else {
    const { loop, p } = loopPhase(a, t);
    switch (type) {
      case 'rotation': v = (a.clockWise ? 1 : -1) * 360 * p; break;
      case 'cosOscillation': v = lerp(0.5 - 0.5 * Math.cos(2 * Math.PI * p)); break;
      case 'sinOscillation': v = lerp(0.5 + 0.5 * Math.sin(2 * Math.PI * p)); break;
      case 'halfCosOscillation': v = lerp(0.5 - 0.5 * Math.cos(Math.PI * p)); break;
      case 'halfSinOscillation': v = lerp(Math.sin(Math.PI * p)); break;
      case 'chaoticOscillation': {
        // Each loop reaches a slightly different peak at a slightly different moment.
        const peak = 1 - a.chaos * seeded(key, loop);
        const skew = 0.5 + (seeded(key, loop + 7919) - 0.5) * a.chaos;
        const q = p < skew ? p / skew * 0.5 : 0.5 + (p - skew) / (1 - skew) * 0.5;
        v = lerp(peak * (0.5 - 0.5 * Math.cos(2 * Math.PI * q)));
        break;
      }
      case 'colorOscillation': v = mixColor(a.val1, a.val2, 0.5 - 0.5 * Math.cos(2 * Math.PI * p)); break;
      case 'halfColorOscillation': v = mixColor(a.val1, a.val2, 0.5 - 0.5 * Math.cos(Math.PI * p)); break;
      case 'randomNumber': v = lerp(seeded(key, Math.floor(t / 16))); break;
      case 'randomNumberPerLoop': v = lerp(seeded(key, loop)); break;
      case 'randomColor': v = Math.floor(seeded(key, Math.floor(t / 16)) * 0xffffff); break;
      case 'randomColorPerLoop': v = Math.floor(seeded(key, loop) * 0xffffff); break;
      default: v = base;
    }
  }
  return a.integer ? Math.round(v) : v;
}

// Compile a filter's `animated` block once; sample it every frame without allocation.
export function compileAnimations(animated, base) {
  const entries = Object.entries(animated ?? {}).map(([param, spec]) => [param, normalizeAnim(spec)])
    .filter(([, a]) => a.active && a.animType);
  return {
    keys: entries.map(([k]) => k),
    sample(out, { local, world, key = '' }) {
      for (const [param, a] of entries) out[param] = animValue(a, base[param], { local, world, key: key + param });
      return out;
    },
  };
}
