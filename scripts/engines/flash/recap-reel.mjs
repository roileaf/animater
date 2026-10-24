// The combat recap's replay reel: letterbox bars and a soft vignette come in, then for each of the top moments the
// camera eases to frame the attacker and its target, the original animation replays on the real tokens (a local
// preview: nothing is written, no marks, no damage), slowing to a crawl at the impact, under a lower-third caption.
// A token gone since is stood in for by a local ghost sprite of its recorded art at its recorded place. A summary
// card closes it, the bars leave and the view goes back to where it was. Skippable at any time; a skip or a canvas
// tear-down puts everything back. Pure: the planner reads plain data, the player calls an injected host.
import { qualityRank } from "../../core/quality.mjs";
import { captionFor, normalizeMoment, momentForViewer } from "./recap.mjs";

export const REEL = Object.freeze({
  introMs: 500,       // bars and vignette in
  momentMs: 4600,     // one replayed moment
  cardMs: 3200,       // one moment shown as a caption and art card
  cameraMs: 900,      // the ease to frame a moment
  replayAt: 600,      // the animation starts, into the moment
  impactMs: 700,      // from the animation's start to its impact
  slowMs: 800,        // slow motion at the impact
  slowRate: 0.35,
  captionAt: 450,
  captionOutMs: 300,
  gapMs: 250,         // a short pause between moments
  summaryMs: 3400,
  outroMs: 800,       // bars out, camera back
  maxMs: 20000,
  zoomCap: 1.8,       // never closer than this, whatever the scene allows
});

const finite = (n) => Number.isFinite(n);

/**
 * The camera that frames some tokens ({ x, y } centres, w and h px): their bounding box with room around it, fitted
 * between the letterbox bars and above the lower-third caption, zoom capped (REEL.zoomCap and the scene's max) and
 * never under minZoom. The centre sits a little below the tokens so they show above the caption. Null without a
 * usable point or screen.
 */
export function frameTokens({ points, screen, maxZoom, minZoom = 0.3, cap = REEL.zoomCap, bars = 0.1, lowerThird = 0.2 } = {}) {
  const ps = (points ?? []).filter((p) => finite(p?.x) && finite(p?.y));
  if (!ps.length || !(screen?.w > 0) || !(screen?.h > 0)) return null;
  const size = Math.max(50, ...ps.map((p) => Math.max(Number(p.w) || 0, Number(p.h) || 0)));
  const pad = size * 0.9;
  const xs = ps.flatMap((p) => [p.x - (Number(p.w) || size) / 2, p.x + (Number(p.w) || size) / 2]);
  const ys = ps.flatMap((p) => [p.y - (Number(p.h) || size) / 2, p.y + (Number(p.h) || size) / 2]);
  const box = { x0: Math.min(...xs) - pad, x1: Math.max(...xs) + pad, y0: Math.min(...ys) - pad, y1: Math.max(...ys) + pad };
  const usableW = screen.w * 0.86, usableH = screen.h * Math.max(0.3, 1 - 2 * bars - lowerThird);
  const top = Math.min(cap, finite(maxZoom) && maxZoom > 0 ? maxZoom : Infinity);
  const fit = Math.min(usableW / (box.x1 - box.x0), usableH / (box.y1 - box.y0));
  const scale = Math.max(Math.min(minZoom, top), Math.min(fit, top));
  const cx = (box.x0 + box.x1) / 2, cy = (box.y0 + box.y1) / 2;
  // The free band's middle is lowerThird/2 of the screen above the screen's middle.
  return { x: cx, y: cy + (screen.h * lowerThird / 2) / scale, scale };
}

/** Whether this screen plays the reel at all: its own switch on and quality above Off. */
export const canReel = ({ quality, local } = {}) => local !== false && qualityRank(quality) > 0;
/** Full and Light replay the animations with camera and slow motion; Balanced and Low show caption and art cards. */
export const cinematic = (quality) => qualityRank(quality) === 3;

/**
 * The reel for one viewer, or null when there is nothing to show. viewer: { sceneId, gm, quality, local, userId,
 * stealth }. tokens(tokenId) → { center, w, h, hidden } of a token on the viewed scene, else null. view: { x, y, scale };
 * screen: { w, h }; maxZoom. Players never see a moment with a hidden token in it, nor (stealth on) one with a
 * creature they had not detected; one they only heard is a card naming it UNSEEN_NAME (momentForViewer). Each moment:
 * { moment, caption, mode: "replay" | "card", start, end, camera, captionAt, replayAt, slow, ghosts, live }.
 */
export function planReel({ moments, viewer = {}, tokens = () => null, view, screen, maxZoom } = {}) {
  if (!canReel(viewer)) return null;
  const gm = viewer.gm === true, full = cinematic(viewer.quality);
  const look = (tokenId) => { try { return tokenId ? tokens(tokenId) ?? null : null; } catch { return null; } };
  const list = (moments ?? []).map((m) => normalizeMoment(m)).filter(Boolean).slice(0, 3).filter((m) => {
    if (gm) return true;
    const people = [m.actor, ...m.targets].filter(Boolean);
    return !people.some((p) => p.hidden === true || look(p.tokenId)?.hidden === true);
  }).map((m) => momentForViewer(m, { userId: viewer.userId, gm, stealth: viewer.stealth !== false })).filter(Boolean);
  if (!list.length) return null;
  const canFrame = full && finite(view?.x) && finite(view?.y) && view?.scale > 0 && screen?.w > 0;
  let at = REEL.introMs;
  const steps = list.map((moment) => {
    const caption = { ...captionFor(moment, { gm }), kind: moment.kind, img: moment.actor?.img || moment.actor?.src || "",
      targetImg: moment.target?.img || moment.target?.src || "" };
    const sameScene = !!moment.sceneId && moment.sceneId === viewer.sceneId;
    // Each creature: its live token here, else a ghost of its recorded art at its recorded place.
    const ghosts = [], live = [], points = [];
    // A creature only heard by this player: a card, never its token or ghost.
    if (canFrame && sameScene && !moment.masked) {
      for (const [role, p] of [["source", moment.actor], ...moment.targets.map((t) => ["target", t])]) {
        if (!p) continue;
        const t = look(p.tokenId);
        if (t && finite(t.center?.x) && finite(t.center?.y)) {
          live.push({ role, tokenId: p.tokenId });
          points.push({ x: t.center.x, y: t.center.y, w: t.w, h: t.h, role });
        } else if (p.src && finite(p.x) && finite(p.y) && p.w > 0 && p.h > 0) {
          ghosts.push({ role, tokenId: p.tokenId ?? "", actorId: p.actorId ?? "", name: p.name, src: p.src, x: p.x, y: p.y, w: p.w, h: p.h, elevation: p.elevation ?? 0 });
          points.push({ x: p.x + p.w / 2, y: p.y + p.h / 2, w: p.w, h: p.h, role });
        }
      }
    }
    const hasSource = points.some((p) => p.role === "source");
    const mode = hasSource ? "replay" : "card";
    // The attacker and its first target frame the shot.
    const framed = [points.find((p) => p.role === "source"), points.find((p) => p.role === "target")].filter(Boolean);
    const camera = mode === "replay" ? frameTokens({ points: framed, screen, maxZoom }) : null;
    const length = mode === "replay" ? REEL.momentMs : REEL.cardMs;
    const step = {
      moment, caption, mode, start: at, end: at + length,
      camera: camera ? { ...camera, duration: REEL.cameraMs } : null,
      captionAt: at + REEL.captionAt,
      replayAt: mode === "replay" ? at + REEL.replayAt : null,
      slow: mode === "replay" ? { at: at + REEL.replayAt + REEL.impactMs, ms: REEL.slowMs, rate: REEL.slowRate, points: framed } : null,
      ghosts: mode === "replay" ? ghosts : [], live,
    };
    at = step.end + REEL.gapMs;
    return step;
  });
  const summary = { start: at, end: at + REEL.summaryMs, cards: steps.map((s) => ({ caption: s.caption, img: s.moment.actor?.img || s.moment.actor?.src || "", badges: s.caption.badges })) };
  const end = summary.end + REEL.outroMs;
  const restore = finite(view?.x) && finite(view?.y) && view?.scale > 0 ? { x: view.x, y: view.y, scale: view.scale } : null;
  return { steps, summary, end, restore, cinematic: full, moved: steps.some((s) => s.camera) };
}

/**
 * Plays a reel on this client. Host:
 * - overlay: open({ onSkip }), caption(caption | null), card(step | null), summary(cards | null), close(ms);
 * - pan({ x, y, scale, duration }); ghosts.add(ghost) → handle, ghosts.remove(handle);
 * - replay(step, ghostHandles) → Promise (a local preview of the moment's animation; may reject);
 * - slow(step.slow) → restore fn; schedule(fn, ms) → handle; cancel(handle); trace(status, detail).
 * One reel at a time. skip() (Esc, the Skip button) and clear() (canvas tear-down) end it at once and put the view,
 * the effects' speed and the ghosts back. play resolves when the reel ends either way.
 */
export function createReelPlayer(host) {
  let running = null;
  const safe = (fn) => { try { return fn(); } catch (error) { host.trace?.("Blocked", `Combat recap: ${error?.message ?? error}`); return undefined; } };
  function finish({ instant = true } = {}) {
    if (!running) return;
    const r = running;
    running = null;
    for (const h of r.timers) safe(() => host.cancel(h));
    for (const restore of r.slows.splice(0)) safe(restore);
    for (const g of r.ghosts.splice(0)) safe(() => host.ghosts.remove(g));
    if (r.panned && r.plan.restore) safe(() => host.pan({ ...r.plan.restore, duration: instant ? 0 : REEL.outroMs }));
    if (instant || !r.closed) safe(() => host.overlay.close(instant ? 0 : REEL.outroMs));
    r.resolve(r.skipped ? "skipped" : "done");
  }
  function play(plan) {
    if (running || !plan?.steps?.length) return Promise.resolve(false);
    return new Promise((resolve) => {
      const r = running = { plan, timers: [], slows: [], ghosts: [], panned: false, skipped: false, resolve };
      const at = (ms, fn) => r.timers.push(host.schedule(() => { if (running === r) safe(fn); }, ms));
      safe(() => host.overlay.open({ onSkip: skip }));
      for (const step of plan.steps) {
        at(step.start, () => {
          host.overlay.caption(null);
          host.overlay.card(step.mode === "card" ? step : null);
          for (const g of r.ghosts.splice(0)) host.ghosts.remove(g);
          if (step.camera) { host.pan(step.camera); r.panned = true; }
          step.handles = step.ghosts.map((g) => host.ghosts.add(g)).filter(Boolean);
          r.ghosts.push(...step.handles);
        });
        at(step.captionAt, () => host.overlay.caption(step.caption));
        if (step.replayAt !== null) at(step.replayAt, () => {
          void Promise.resolve(host.replay(step, step.handles ?? [])).catch((error) => {
            host.trace?.("Blocked", `Combat recap replay: ${error?.message ?? error}`);
            if (running === r) host.overlay.card(step);
          });
        });
        if (step.slow) {
          at(step.slow.at, () => { const restore = host.slow(step.slow); if (typeof restore === "function") r.slows.push(restore); });
          at(step.slow.at + step.slow.ms, () => { for (const restore of r.slows.splice(0)) restore(); });
        }
        at(step.end - REEL.captionOutMs, () => host.overlay.caption(null));
      }
      at(plan.summary.start, () => {
        host.overlay.caption(null);
        host.overlay.card(null);
        for (const g of r.ghosts.splice(0)) host.ghosts.remove(g);
        host.overlay.summary(plan.summary.cards);
      });
      at(plan.summary.end, () => {
        host.overlay.summary(null);
        if (r.panned && plan.restore) { host.pan({ ...plan.restore, duration: REEL.outroMs }); r.panned = false; }
        host.overlay.close(REEL.outroMs);
        r.closed = true;
      });
      at(plan.end, () => finish({ instant: false }));
    });
  }
  function skip() { if (running) { running.skipped = true; finish({ instant: true }); } }
  return { play, skip, clear: skip, get playing() { return running !== null; } };
}
