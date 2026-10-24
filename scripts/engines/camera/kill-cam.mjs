// Slow-motion kill-cam: when a killing blow lands on an NPC, each screen that can see it eases the view towards the
// target with a gentle zoom, slows Animater's effects on or at it, shows a soft desaturated vignette, then restores
// the effects and pans back to where the view was. The finisher and Finish Him! wait for it (killCamLength).
// Pure: every canvas, Sequencer and DOM call is an injected host option.
import { qualityRank } from '../../core/quality.mjs';

export const KILL_CAM = Object.freeze({
  ms: 1200,        // the whole kill-cam, pan back included
  zoom: 1.2,       // the gentle zoom towards the target
  panInMs: 450,
  slowMs: 700,     // effects slowed (and the vignette shown) from the start
  slowRate: 0.3,
  panOutAt: 750,
  panOutMs: 450,
  fadeInMs: 200,
  fadeOutMs: 300,
});

const finite = (n) => Number.isFinite(n);

/** How long the finisher and Finish Him! wait for the kill-cam: its length when the table uses it on this NPC, else 0. */
export function killCamLength({ worldOn, npc } = {}) {
  return worldOn === true && npc === true ? KILL_CAM.ms : 0;
}

/** Whether this screen plays a kill-cam: table and screen on, Full or Light quality, the target on this scene and seen. */
export function canKillCam({ worldOn, localOn, quality, sameScene, visible, hidden } = {}) {
  return worldOn === true && localOn !== false && qualityRank(quality) === 3 && sameScene === true && visible === true && hidden !== true;
}

/**
 * The kill-cam's plan: the pan in (towards the token centre, zoomed ×1.2 and capped by the scene's max zoom), when the
 * effects are slowed and restored, the vignette's fades, and the pan back to the view as it was. A shorter or longer
 * `ms` (from the broadcast) stretches every timing alike. Null without a usable centre or view.
 */
export function killCamPlan({ tokenCenter, view, maxZoom, ms = KILL_CAM.ms } = {}) {
  if (!finite(tokenCenter?.x) || !finite(tokenCenter?.y) || !finite(view?.x) || !finite(view?.y) || !(view?.scale > 0)) return null;
  const total = finite(ms) && ms > 0 ? Math.min(ms, 5000) : KILL_CAM.ms;
  const f = total / KILL_CAM.ms, t = (n) => Math.round(n * f);
  const cap = finite(maxZoom) && maxZoom > 0 ? maxZoom : Infinity;
  const scale = Math.max(view.scale, Math.min(view.scale * KILL_CAM.zoom, cap));
  return {
    ms: total,
    panIn: { x: tokenCenter.x, y: tokenCenter.y, scale, duration: t(KILL_CAM.panInMs) },
    slow: { rate: KILL_CAM.slowRate, at: 0, restoreAt: t(KILL_CAM.slowMs) },
    vignette: { fadeIn: t(KILL_CAM.fadeInMs), hideAt: t(KILL_CAM.slowMs), fadeOut: t(KILL_CAM.fadeOutMs) },
    panOut: { at: t(KILL_CAM.panOutAt), x: view.x, y: view.y, scale: view.scale, duration: t(KILL_CAM.panOutMs) },
  };
}

/**
 * Animater's Sequencer effects on or at a token: tied to it (source, target or attached by its uuid) or playing within
 * `radius` of its centre. Other modules' effects are left alone.
 */
export function killCamEffects(effects, { uuid, center, radius = 0 } = {}) {
  const near = (p) => finite(p?.x) && finite(p?.y) && center && Math.hypot(p.x - center.x, p.y - center.y) <= radius;
  return Array.from(effects ?? []).filter((effect) => {
    const data = effect?.data;
    if (!data || data.moduleName !== 'animater') return false;
    if (uuid && [data.source, data.target, data.attachTo?.uuid].includes(uuid)) return true;
    if (near(data.source) || near(data.target)) return true;
    try { return near(effect.position); } catch { return false; }
  });
}

/** Slows effects' media to `rate`; answers the restore, which puts back each one's own rate (once). */
export function slowEffects(effects, rate = KILL_CAM.slowRate) {
  const saved = [];
  for (const effect of effects ?? []) {
    try {
      const before = Number(effect.mediaPlaybackRate);
      if (!finite(before) || before <= 0) continue;
      effect.mediaPlaybackRate = before * rate;
      saved.push([effect, before]);
    } catch { /* an effect ending under us */ }
  }
  let done = false;
  return () => {
    if (done) return;
    done = true;
    for (const [effect, before] of saved) { try { if (!effect.destroyed) effect.mediaPlaybackRate = before; } catch { /* ended */ } }
  };
}

/**
 * The kill-cam on this client. Host:
 * - target(tokenId, sceneId) → { center, uuid, radius } of a token this screen may play it on, else null;
 * - view() → { x, y, scale }; maxZoom() → number; pan({ x, y, scale, duration });
 * - dragging() → true while the viewer pans the canvas themselves (the camera is then left alone);
 * - effects() → Sequencer's playing effects; vignette.show(fadeMs) / vignette.hide(fadeMs);
 * - schedule(fn, ms) → handle; cancel(handle); trace(status, detail).
 * One kill-cam at a time; a second during one is skipped.
 */
export function createKillCam(host) {
  let running = null;
  const safe = (fn) => { try { return fn(); } catch (error) { host.trace?.('Blocked', `Kill-cam: ${error?.message ?? error}`); return undefined; } };
  function finish() {
    if (!running) return;
    const r = running;
    running = null;
    for (const h of r.timers) safe(() => host.cancel(h));
    safe(() => r.restore?.());
    if (r.vignette) safe(() => host.vignette.hide(0));
  }
  function play({ tokenId, sceneId, ms } = {}) {
    if (running) return false;
    const target = safe(() => host.target(tokenId, sceneId));
    if (!target) return false;
    const view = safe(() => host.view());
    const plan = killCamPlan({ tokenCenter: target.center, view, maxZoom: safe(() => host.maxZoom()), ms });
    if (!plan) return false;
    const r = running = { timers: [], restore: null, vignette: false };
    const at = (ms, fn) => r.timers.push(host.schedule(() => { if (running === r) safe(fn); }, ms));
    const panned = !safe(() => host.dragging());
    if (panned) safe(() => host.pan(plan.panIn));
    r.restore = safe(() => slowEffects(killCamEffects(host.effects(), { uuid: target.uuid, center: target.center, radius: target.radius ?? 0 }), plan.slow.rate));
    safe(() => host.vignette.show(plan.vignette.fadeIn));
    r.vignette = true;
    at(plan.slow.restoreAt, () => { r.restore?.(); host.vignette.hide(plan.vignette.fadeOut); r.vignette = false; });
    // The view goes back to where it was, unless the viewer has taken the camera since.
    if (panned) at(plan.panOut.at, () => { if (!host.dragging()) host.pan({ x: plan.panOut.x, y: plan.panOut.y, scale: plan.panOut.scale, duration: plan.panOut.duration }); });
    at(plan.ms, () => { running = null; });
    return true;
  }
  return { play, clear: finish, get playing() { return running !== null; } };
}
