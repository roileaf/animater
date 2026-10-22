// Effect lights on this client: every client builds the same local light from
// an anchor effect's `animaterLight` tag, keeps it on the anchor, drives its
// brightness on the effect's own clock and removes it when it is done. Foundry
// is reached only through the options (main.mjs); nothing is written anywhere.
import { envelope } from './effect-lights.mjs';

const END_FADE_MS = 300;
const MOVE_SQUARES = 0.25;
const MOVE_EVERY_FRAMES = 2;
const LEVEL_STEP = 0.002;
// Full brightness is Foundry's default light (alpha 0.5, luminosity 0.5); a
// flash peaks above it. Luminosity 0 adds no illumination, so it fades cleanly.
const ALPHA = 0.5;
const LUMINOSITY = 0.5;
const FLASH_PEAK = 1.3;

const clamp01 = (n) => Math.min(1, Math.max(0, n));
const finitePoint = (p) => (p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: p.x, y: p.y } : null);

/** Light source alpha and luminosity at envelope level 0..1. */
export function lightLevels(level, shape) {
  const peak = shape === 'flash' || shape === 'strobe' ? FLASH_PEAK : 1;
  return { alpha: ALPHA * level, luminosity: clamp01(LUMINOSITY * level * peak) };
}

const animationOf = (shape, steady) => (steady ? {} : {
  type: shape === 'flicker' ? 'torch' : shape === 'pulse' ? 'pulse' : null, speed: 5, intensity: 5,
});

export function createLightHost({
  makeSource, refreshLighting, sceneId, levelOk, heldMs = () => 0, steady = () => false,
  gridSize = () => 100, now = () => performance.now(), max = 8,
}) {
  const lights = new Map(); // anchor effect -> light, in arrival order
  let nextId = 0, frame = 0, dirty = false;

  const remove = (light) => {
    lights.delete(light.effect);
    if (!light.source) return;
    try { light.source.destroy(); } catch { /* already gone */ }
    dirty = true;
  };

  // Fade from where it is now; a light not yet shown just goes.
  const end = (light, at) => {
    if (light.endedAt !== null) return;
    if (!light.source || light.level <= 0) return remove(light);
    light.endedAt = at;
    light.endLevel = light.level;
  };

  // A flight's glow slides along its path on the effect's clock; anything else sits on its anchor.
  const positionOf = (light, t) => {
    const { from, to, arriveMs } = light.tag;
    if (from && to && arriveMs > 0) {
      const k = clamp01(t / arriveMs);
      return finitePoint({ x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k });
    }
    try { return finitePoint(light.effect.worldPosition); } catch { return null; }
  };

  const show = (light, t, level, isSteady) => {
    const at = positionOf(light, t);
    if (!at) return;
    const { tag, data } = light;
    const grid = gridSize();
    light.source = makeSource(light.id);
    try {
      light.source.initialize({
        x: at.x, y: at.y, dim: tag.dim * grid, bright: tag.bright * grid, color: tag.color,
        ...lightLevels(level, tag.shape), coloration: 1, attenuation: 0.5, vision: false, walls: true, priority: 0,
        animation: animationOf(tag.shape, isSteady),
        ...(typeof data.level === 'string' ? { level: data.level } : {}),
      });
      light.source.add();
    } catch (err) {
      console.warn('Animater | could not place an effect light', err);
      remove(light);
      return;
    }
    light.at = at;
    light.level = level;
    light.movedFrame = frame;
    dirty = true;
  };

  const follow = (light, t) => {
    if (frame - light.movedFrame < MOVE_EVERY_FRAMES) return;
    const at = positionOf(light, t);
    if (!at || Math.hypot(at.x - light.at.x, at.y - light.at.y) < MOVE_SQUARES * gridSize()) return;
    try { light.source.initialize({ x: at.x, y: at.y }); } catch { return; }
    light.at = at;
    light.movedFrame = frame;
    dirty = true;
  };

  return {
    onEffect(effect) {
      const data = effect?.data, tag = data?.animaterLight;
      if (!tag || typeof tag !== 'object' || data.moduleName !== 'animater' || lights.has(effect)) return;
      if (data.sceneId !== sceneId() || !levelOk(data.level)) return;
      // Same rule on every client, in arrival order: when full the newest one-shot is skipped, and a
      // lasting light makes room by fading out the oldest one-shot.
      const live = [...lights.values()].filter((l) => l.endedAt === null);
      if (live.length >= max) {
        if (!tag.lasting) return;
        const oldest = live.find((l) => !l.tag.lasting);
        if (oldest) end(oldest, now());
      }
      lights.set(effect, {
        id: ++nextId, effect, data, tag, session: data.name, receivedAt: now(),
        source: null, at: null, level: 0, movedFrame: 0, endedAt: null, endLevel: 0,
      });
    },

    onEnded(effect) {
      const light = lights.get(effect);
      if (light) end(light, now());
    },

    tick() {
      frame++;
      const t0 = now(), isSteady = steady();
      for (const light of [...lights.values()]) {
        const { tag } = light;
        let level;
        if (light.endedAt !== null) {
          const k = (t0 - light.endedAt) / END_FADE_MS;
          if (k >= 1) { remove(light); continue; }
          level = light.endLevel * (1 - k);
        } else {
          // The anchor's own clock: hit-stop time does not count.
          const t = t0 - light.receivedAt - (heldMs(light.session, light.receivedAt) || 0);
          if (t >= tag.startMs + tag.lengthMs + (tag.fadeMs ?? 0)) { remove(light); continue; }
          if (light.effect.destroyed) { end(light, t0); continue; }
          level = envelope(tag, t, { steady: isSteady });
          if (!light.source) {
            if (light.effect.ready && t >= tag.startMs) show(light, t, level, isSteady);
            continue;
          }
          follow(light, t);
        }
        // Skip changes too small to see, but always reach zero.
        if (level === light.level || (level !== 0 && Math.abs(level - light.level) < LEVEL_STEP)) continue;
        light.level = level;
        try { light.source.setLevel(lightLevels(level, tag.shape)); } catch { /* source gone */ }
      }
      // One perception update per frame at most.
      if (dirty) {
        dirty = false;
        try { refreshLighting(); } catch { /* canvas going away */ }
      }
    },

    clear() {
      for (const light of lights.values()) {
        try { light.source?.destroy(); } catch { /* already gone */ }
      }
      lights.clear();
      dirty = false;
    },

    count() {
      return lights.size;
    },
  };
}
