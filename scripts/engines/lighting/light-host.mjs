// Effect lights on this client: every client builds the same local light from
// an anchor effect's `animaterLight` tag, keeps it on the anchor, drives its
// brightness on the effect's own clock and removes it when it is done. Foundry
// is reached only through the options (main.mjs); nothing is written anywhere.
import { envelope } from './effect-lights.mjs';

const END_FADE_MS = 300;
const MOVE_SQUARES = 0.25;
const MOVE_EVERY_FRAMES = 2;
const LEVEL_STEP = 0.002;
// A light first shown well after its start (slow file load) ramps in instead of popping on.
const LATE_MS = 50;
const RAMP_MS = 100;
// Full brightness is Foundry's default light (alpha 0.5, luminosity 0.5); a
// flash peaks above it. Luminosity 0 adds no illumination, so it fades cleanly.
const ALPHA = 0.5;
const LUMINOSITY = 0.5;
const FLASH_PEAK = 1.3;

const clamp01 = (n) => Math.min(1, Math.max(0, n));
const finitePoint = (p) => (p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: p.x, y: p.y } : null);
const validTag = (tag) => !!tag && typeof tag === 'object'
  && ['startMs', 'lengthMs', 'dim', 'bright'].every((k) => Number.isFinite(tag[k]))
  && (tag.fadeMs == null || Number.isFinite(tag.fadeMs));
// A wall's lights stand at its tagged points; a missing or malformed list means one light.
const pointsOf = (tag) => {
  if (tag.follow || !Array.isArray(tag.points) || !tag.points.length || tag.points.length > 3) return null;
  const points = tag.points.map(finitePoint);
  return points.every(Boolean) ? points : null;
};

/** Light source alpha and luminosity at envelope level 0..1. */
export function lightLevels(level, shape) {
  const peak = shape === 'flash' || shape === 'strobe' ? FLASH_PEAK : 1;
  return { alpha: ALPHA * level, luminosity: clamp01(LUMINOSITY * level * peak) };
}

const animationOf = (shape, steady) => (steady ? {} : {
  type: shape === 'flicker' ? 'torch' : shape === 'pulse' ? 'pulse' : null, speed: 5, intensity: 5,
});

export function createLightHost({
  makeSource, refreshLighting, sceneId, levelOk, steady = () => false,
  gridSize = () => 100, now = () => performance.now(), max = 8,
}) {
  const lights = new Map(); // anchor effect -> light, in arrival order
  let nextId = 0, frame = 0, dirty = false;

  const remove = (light) => {
    lights.delete(light.effect);
    if (!light.sources.length) return;
    for (const source of light.sources) {
      try { source.destroy(); } catch { /* already gone */ }
    }
    dirty = true;
  };

  // Fade from where it is now; a light not yet shown just goes.
  const end = (light, at) => {
    if (light.endedAt !== null) return;
    if (!light.sources.length || light.level <= 0) return remove(light);
    light.endedAt = at;
    light.endLevel = light.level;
  };

  // A flight's glow slides along its path on the effect's clock; a still light sits at its tagged place
  // (a stretched line's own position is its start); a light that follows a token rides on its anchor.
  const positionOf = (light, t) => {
    const { from, to, arriveMs, at, follow } = light.tag;
    if (from && to && arriveMs > 0) {
      const k = clamp01(t / arriveMs);
      return finitePoint({ x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k });
    }
    const fixed = follow ? null : finitePoint(at);
    if (fixed) return fixed;
    try { return finitePoint(light.effect.worldPosition); } catch { return null; }
  };
  // The source token's level and elevation, from the tag; else Foundry's canvas level.
  const levelOf = (tag, data) => (typeof tag.level === 'string' ? tag.level : typeof data.level === 'string' ? data.level : undefined);

  const show = (light, t, level, isSteady) => {
    const at = positionOf(light, t);
    if (!at) return;
    const { tag, data } = light;
    if (t - tag.startMs > LATE_MS) { light.rampAt = t; level = 0; }
    const grid = gridSize();
    try {
      // One source per point of a wall, else one at its place; all share the light's level.
      (light.points ?? [at]).forEach((p, i) => {
        const source = makeSource(i ? `${light.id}.${i}` : light.id);
        light.sources.push(source);
        source.initialize({
          x: p.x, y: p.y, dim: tag.dim * grid, bright: tag.bright * grid, color: tag.color,
          ...lightLevels(level, tag.shape), coloration: 1, attenuation: 0.5, vision: false, walls: true, priority: 0,
          animation: animationOf(tag.shape, isSteady),
          ...(levelOf(tag, data) ? { level: levelOf(tag, data) } : {}),
          ...(Number.isFinite(tag.elevation) ? { elevation: tag.elevation } : {}),
        });
        source.add();
      });
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
    if (light.points || frame - light.movedFrame < MOVE_EVERY_FRAMES) return;
    const at = positionOf(light, t);
    if (!at || Math.hypot(at.x - light.at.x, at.y - light.at.y) < MOVE_SQUARES * gridSize()) return;
    try { light.sources[0].initialize({ x: at.x, y: at.y }); } catch { return; }
    light.at = at;
    light.movedFrame = frame;
    dirty = true;
  };

  // One light's frame: its level on the anchor's clock, its place, and when it is done.
  const step = (light, t0, isSteady) => {
    const { tag } = light;
    let level;
    if (light.endedAt !== null) {
      const k = (t0 - light.endedAt) / END_FADE_MS;
      if (k >= 1) return remove(light);
      level = light.endLevel * (1 - k);
    } else {
      // The anchor's own clock.
      const t = t0 - light.receivedAt;
      if (t >= tag.startMs + tag.lengthMs + (tag.fadeMs ?? 0)) return remove(light);
      if (light.effect.destroyed) return end(light, t0);
      level = envelope(tag, t, { steady: isSteady });
      if (!light.sources.length) {
        if (light.effect.ready && t >= tag.startMs) show(light, t, level, isSteady);
        return;
      }
      if (light.rampAt !== null) level *= clamp01((t - light.rampAt) / RAMP_MS);
      follow(light, t);
    }
    // Skip changes too small to see, but always reach zero.
    if (level === light.level || (level !== 0 && Math.abs(level - light.level) < LEVEL_STEP)) return;
    light.level = level;
    for (const source of light.sources) source.setLevel(lightLevels(level, tag.shape));
  };

  return {
    onEffect(effect) {
      const data = effect?.data, tag = data?.animaterLight;
      if (!validTag(tag) || data.moduleName !== 'animater' || lights.has(effect)) return;
      if (data.sceneId !== sceneId() || !levelOk(levelOf(tag, data))) return;
      // Same rule on every client, in arrival order (a wall counts each of its points): when full the
      // newest one-shot is skipped, and a lasting light makes room by fading out the oldest one-shots.
      const points = pointsOf(tag), weight = points?.length ?? 1;
      const live = [...lights.values()].filter((l) => l.endedAt === null);
      let used = live.reduce((n, l) => n + l.weight, 0);
      if (used + weight > max) {
        if (!tag.lasting) return;
        for (const oldest of live.filter((l) => !l.tag.lasting)) {
          if (used + weight <= max) break;
          end(oldest, now());
          used -= oldest.weight;
        }
      }
      lights.set(effect, {
        id: ++nextId, effect, data, tag, points, weight, receivedAt: now(),
        sources: [], at: null, level: 0, movedFrame: 0, endedAt: null, endLevel: 0, rampAt: null,
      });
    },

    onEnded(effect) {
      const light = lights.get(effect);
      if (light) end(light, now());
    },

    // Runs on the PIXI ticker, where a throw would stop the canvas: it never throws, and a light
    // that fails is dropped.
    tick() {
      if (lights.size === 0) {
        // The last light may have been removed outside a tick (onEnded): still flush its refresh.
        if (dirty) {
          dirty = false;
          try { refreshLighting(); } catch { /* canvas going away */ }
        }
        return;
      }
      frame++;
      let t0, isSteady;
      try { t0 = now(); isSteady = steady(); } catch { return; }
      for (const light of [...lights.values()]) {
        try { step(light, t0, isSteady); } catch (err) {
          console.warn('Animater | dropped an effect light', err);
          remove(light);
        }
      }
      // One perception update per frame at most.
      if (dirty) {
        dirty = false;
        try { refreshLighting(); } catch { /* canvas going away */ }
      }
    },

    clear() {
      for (const light of lights.values()) {
        for (const source of light.sources) {
          try { source.destroy(); } catch { /* already gone */ }
        }
      }
      lights.clear();
      dirty = false;
    },

    count() {
      return lights.size;
    },
  };
}
