// Camera shake on this client: a big blast (a shock tag, the same one map distortion plans) jolts the canvas view
// for a moment. The jolt is decaying noise, at most MAX_SHAKE_PX screen pixels at strength 1, scaled by the blast's
// size and faded with its distance from the view's centre. It is an offset on the stage's position (Foundry pans by
// the stage's pivot and only sets the position on a resize): the offset written last frame is taken off before the
// next one goes on, so panning is never fought and nothing drifts; when the last shake ends the position is put
// back exactly. Foundry is reached only through the options (main.mjs); nothing is written anywhere else.
import { qualityRank } from '../../core/quality.mjs';

export const MAX_SHAKE_PX = 10;
const MIN_SHAKE_PX = 0.5;
const MIN_MS = 350, MAX_MS = 600;
// Ring radii (squares) from a small blast to the largest one shakes for.
const SMALL_SQUARES = 3, BIG_SQUARES = 12;
// Several blasts at once add up, to at most this many times the cap.
const STACK = 2;

const finite = (n) => typeof n === 'number' && Number.isFinite(n);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Whether this client shakes: Full or Light quality and its own setting on. */
export const canShake = (quality, localOn) => localOn !== false && qualityRank(quality) === 3;

/** The shock tag on an effect's data: the map distortion's `animaterWarp`, or `animaterShake` when that is off. */
export function shakeTagOf(data) {
  for (const tag of [data?.animaterWarp, data?.animaterShake]) {
    if (tag?.kind === 'shock' && finite(tag.at?.x) && finite(tag.at?.y) && finite(tag.radius) && tag.radius > 0) return tag;
  }
  return null;
}

/**
 * How one blast shakes this view, or null for none. `view` is the screen's world rectangle {x, y, w, h};
 * `gridPx` sizes the blast in squares; `strength` is this client's multiplier. The amplitude grows with the
 * blast's radius and falls off from the view's centre: full while the blast covers it, none once the blast's
 * edge is half a view's diagonal beyond the screen. `seed` picks the noise.
 */
export function shakeProfile(tag, { view, gridPx, strength = 1, seed = 0 } = {}) {
  if (!tag || !view || !(gridPx > 0) || !(strength > 0)) return null;
  const squares = tag.radius / gridPx;
  const size = clamp((squares - SMALL_SQUARES) / (BIG_SQUARES - SMALL_SQUARES), 0, 1);
  const cx = view.x + view.w / 2, cy = view.y + view.h / 2, half = Math.hypot(view.w, view.h) / 2;
  if (!(half > 0)) return null;
  // From the blast's edge to the view's centre: within the half diagonal it is on screen, then it fades out.
  const gap = Math.max(0, Math.hypot(tag.at.x - cx, tag.at.y - cy) - tag.radius);
  const falloff = clamp(1 - gap / (1.5 * half), 0, 1);
  const amplitude = MAX_SHAKE_PX * (0.5 + 0.5 * size) * falloff * strength;
  if (amplitude < MIN_SHAKE_PX) return null;
  return {
    amplitude,
    startMs: finite(tag.startMs) && tag.startMs > 0 ? tag.startMs : 0,
    durationMs: MIN_MS + (MAX_MS - MIN_MS) * size,
    seed,
  };
}

// A giant's footfall: a tiny, short tremor, not a blast's jolt. Every Huge (weight 4) to the heaviest
// Gargantuan (5.75) go from TREMOR_MIN_PX to TREMOR_MAX_PX, fading to nothing TREMOR_SQUARES from the view's centre.
export const TREMOR_FROM = 4;
const TREMOR_MIN_PX = 1, TREMOR_MAX_PX = 3, TREMOR_SQUARES = 8, TREMOR_MS = 180;
// At most this many footfall tremors at once (a herd of giants still only trembles).
const TREMOR_STACK = 2;

/** How one footfall of a creature of `weight` (stepWeight) at `at` trembles this view, or null for none. */
export function tremorProfile({ weight, at, view, gridPx, strength = 1, seed = 0 } = {}) {
  if (!(Number(weight) >= TREMOR_FROM) || !finite(at?.x) || !finite(at?.y) || !view || !(gridPx > 0) || !(strength > 0)) return null;
  // Every Huge footfall (weight 4) up to a heavy Gargantuan one (5.75).
  const heavy = clamp((Number(weight) - TREMOR_FROM) / 1.75, 0, 1);
  const cx = view.x + view.w / 2, cy = view.y + view.h / 2;
  const falloff = clamp(1 - Math.hypot(at.x - cx, at.y - cy) / (TREMOR_SQUARES * gridPx), 0, 1);
  const amplitude = (TREMOR_MIN_PX + (TREMOR_MAX_PX - TREMOR_MIN_PX) * heavy) * falloff * strength;
  if (amplitude < MIN_SHAKE_PX) return null;
  return { amplitude, startMs: 0, durationMs: TREMOR_MS, seed };
}

// Smooth noise: a few sines of unrelated frequencies (Hz), with phases from the seed.
const WAVES = [[23, 1], [31, 0.6], [17, 0.45]];
const phase = (seed, i) => ((Math.sin((seed + 1) * 12.9898 + i * 78.233) * 43758.5453) % 1) * 2 * Math.PI;

/** The offset (screen px) `t` ms after the effect arrived: zero before the blast and exactly zero after it. */
export function shakeOffset(profile, t) {
  const local = t - profile.startMs;
  if (!(local >= 0) || local >= profile.durationMs) return { x: 0, y: 0 };
  const k = 1 - local / profile.durationMs, envelope = k * k, s = local / 1000;
  let x = 0, y = 0, sum = 0;
  WAVES.forEach(([hz, w], i) => {
    x += w * Math.sin(2 * Math.PI * hz * s + phase(profile.seed, 2 * i));
    y += w * Math.sin(2 * Math.PI * hz * 1.13 * s + phase(profile.seed, 2 * i + 1));
    sum += w;
  });
  return { x: (profile.amplitude * envelope * x) / sum, y: (profile.amplitude * envelope * y) / sum };
}

const hash = (text) => { let h = 0; for (const c of String(text ?? '')) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); };

/**
 * The host: `onEffect(effect)` from createSequencerEffect, `tick()` on the PIXI ticker before the render,
 * `clear()` on canvasTearDown. Options: `getPosition()`/`setPosition(x, y)` (the stage's position), `view()` (the
 * screen's world rectangle), `gridPx()`, `now()`, `enabled()` (world and client settings and quality),
 * `strength()`, `sceneId()`, `viewedLevel()` (null: any), `seen(point, radius)` (optional: false skips a blast
 * this client cannot see).
 */
export function createCameraShake({ getPosition, setPosition, view, gridPx, now, enabled, strength = () => 1, sceneId, viewedLevel = () => null, seen = () => true }) {
  const shakes = new Map();
  // The position without the shake, and the one written with it (another writer changing it is a new base).
  let base = null, written = null;

  const restore = () => {
    try {
      if (written) {
        const pos = getPosition();
        if (pos.x === written.x && pos.y === written.y) setPosition(base.x, base.y);
      }
    } catch { /* canvas gone */ }
    base = written = null;
  };

  const host = {
    get size() { return shakes.size; },

    onEffect(effect) {
      try {
        const data = effect?.data, tag = shakeTagOf(data);
        if (!tag || data.moduleName !== 'animater' || shakes.has(effect)) return;
        if (data.sceneId !== sceneId() || !enabled()) return;
        const level = typeof tag.level === 'string' && tag.level ? tag.level : null, viewed = viewedLevel();
        if (level && viewed && level !== viewed) return;
        if (seen(tag.at, tag.radius) === false) return;
        const profile = shakeProfile(tag, { view: view(), gridPx: gridPx(), strength: Number(strength()), seed: hash(effect.id ?? data.id) });
        if (profile) shakes.set(effect, { profile, at: now() });
      } catch (err) {
        console.warn('Animater | camera shake skipped an effect', err);
      }
    },

    // A giant's footfall on this screen ({ at, weight, sceneId, level, seed }): a tiny tremor (tremorProfile), at
    // most TREMOR_STACK at once, inside the same cap as every other shake. Never throws.
    tremor({ at, weight, sceneId: scene, level, seed = 0 } = {}) {
      try {
        if (scene !== undefined && scene !== sceneId()) return false;
        if (!enabled()) return false;
        const viewed = viewedLevel();
        if (typeof level === 'string' && level && viewed && level !== viewed) return false;
        let tremors = 0;
        for (const key of shakes.keys()) if (key?.animaterTremor) tremors++;
        if (tremors >= TREMOR_STACK) return false;
        const profile = tremorProfile({ weight, at, view: view(), gridPx: gridPx(), strength: Number(strength()), seed: hash(seed) });
        if (!profile) return false;
        shakes.set({ animaterTremor: true }, { profile, at: now() });
        return true;
      } catch (err) {
        console.warn('Animater | footfall tremor skipped', err);
        return false;
      }
    },

    // Runs on the PIXI ticker, where a throw would stop the canvas: it never throws.
    tick() {
      try {
        if (!shakes.size) { if (written) restore(); return; }
        if (!enabled()) return host.clear();
        const t = now();
        let x = 0, y = 0;
        for (const [effect, { profile, at }] of [...shakes]) {
          if (t - at >= profile.startMs + profile.durationMs) { shakes.delete(effect); continue; }
          const o = shakeOffset(profile, t - at);
          x += o.x; y += o.y;
        }
        if (!shakes.size) return restore();
        const cap = STACK * MAX_SHAKE_PX;
        x = clamp(x, -cap, cap); y = clamp(y, -cap, cap);
        const pos = getPosition();
        // The offset written last frame comes off first, unless something else has set the position since.
        if (!written || pos.x !== written.x || pos.y !== written.y) base = { x: pos.x, y: pos.y };
        written = { x: base.x + x, y: base.y + y };
        setPosition(written.x, written.y);
      } catch (err) {
        console.warn('Animater | camera shake stopped', err);
        shakes.clear();
        base = written = null;
      }
    },

    clear() {
      shakes.clear();
      restore();
    },
  };
  return host;
}
