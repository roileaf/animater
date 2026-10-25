// Map distortion on this client: Animater effects tagged `animaterWarp` bend the scene through one filter on
// canvas.primary, there only while something is distorting. Each distortion runs on its anchor effect's clock
// from the moment the effect arrived: a one-shot (shockwave, teleport warp) always runs its full time, even if
// its effect ends sooner; a lasting haze fades out quickly once its effect ends. Foundry is reached only through
// the options (main.mjs); nothing is written anywhere.
import { slotParams, chooseSlots } from './scene-distortion.mjs';
import { writeSceneWarp, SCENE_WARP_SLOTS } from '../tokenshade/filters/scene-warp.mjs';
import { qualityRank } from '../../core/quality.mjs';

const HAZE_END_MS = 300;
const SIGHT_MS = 250;
const KINDS = new Set(['shock', 'haze', 'warp']);

/** Whether this client draws distortions: Full quality (not Light) and its own setting on. */
export const canDistort = (quality, localOn) => localOn !== false && quality !== 'light' && qualityRank(quality) === 3;

/** Add `filter` last on `group` (Foundry's primary group), leaving the others as they are. */
export function attachFilter(group, filter, screen) {
  group.filters ??= [];
  group.filterArea ??= screen;
  if (!group.filters.includes(filter)) group.filters.push(filter);
}

/** Take only `filter` out of `group`'s filters. */
export function detachFilter(group, filter) {
  const list = group?.filters;
  const i = list?.indexOf(filter) ?? -1;
  if (i >= 0) list.splice(i, 1);
}

const finite = (n) => Number.isFinite(n);
const finitePoint = (p) => (p && finite(p.x) && finite(p.y) ? { x: p.x, y: p.y } : null);
function validTag(tag) {
  if (!tag || typeof tag !== 'object' || !KINDS.has(tag.kind) || !finitePoint(tag.at)) return false;
  if (!(tag.radius > 0) || !finite(tag.radius) || !(tag.startMs >= 0) || !finite(tag.startMs)) return false;
  if (tag.lengthMs != null && !(finite(tag.lengthMs) && tag.lengthMs > 0)) return false;
  return tag.strength == null || finite(tag.strength);
}
// A line or cone's haze: the capsule's ends and its width, else none.
const capsuleOf = (tag) => {
  const area = tag.area;
  if (tag.kind !== 'haze' || area?.type !== 'capsule') return null;
  const a = finitePoint(area.a), b = finitePoint(area.b);
  return a && b && area.width > 0 && finite(area.width) ? { a, b, width: area.width } : null;
};

// The level a distortion happens on: its tag's (the source token's), else its effect's own; none for any level.
const levelOf = (tag, data) => (typeof tag.level === 'string' && tag.level ? tag.level : typeof data.level === 'string' && data.level ? data.level : null);

/**
 * `viewedLevel()`: the level this client views (null: any). `seen(point, radius)`: whether this client can see
 * any of that area; a one-shot is tested as it arrives, a lasting haze every SIGHT_MS (kept, but not drawn,
 * while unseen).
 */
export function createDistortionHost({
  makeFilter, attach, detach, allowed, tight = () => false, sceneId = () => undefined, view, now = () => performance.now(),
  viewedLevel = () => null, seen = () => true,
}) {
  const entries = new Map(); // anchor effect -> distortion, in arrival order
  let filter = null, attached = false, broken = false;

  const warnOnce = (err) => {
    if (broken) return;
    broken = true;
    console.warn('Animater | map distortion is off on this screen: its filter could not be made', err);
  };

  const unhook = () => {
    if (!attached) return;
    attached = false;
    try { detach(filter); } catch { /* canvas going away */ }
  };

  // The place the distortion is drawn: a following haze rides on its anchor's live position.
  const placeOf = (entry) => {
    const { tag, capsule } = entry;
    let shift = { x: 0, y: 0 };
    if (tag.follow) {
      let live = null;
      try { live = finitePoint(entry.effect.worldPosition); } catch { /* gone: stay put */ }
      if (live) shift = { x: live.x - tag.at.x, y: live.y - tag.at.y };
    }
    const move = (p) => ({ x: p.x + shift.x, y: p.y + shift.y });
    return { centre: move(tag.at), a: capsule ? move(capsule.a) : null, b: capsule ? move(capsule.b) : null };
  };

  // One distortion's slot at `t0`, or null; drops it once it is done.
  const step = (entry, t0, zoom) => {
    const { tag } = entry;
    if (entry.endedAt === null && entry.lasting && entry.effect.destroyed) entry.endedAt = t0;
    let fade = 1;
    if (entry.endedAt !== null) {
      fade = 1 - (t0 - entry.endedAt) / HAZE_END_MS;
      if (fade <= 0) { entries.delete(entry.effect); return null; }
    }
    const params = slotParams(tag, t0 - entry.receivedAt, { zoom });
    if (!params) {
      // Not started yet, or a one-shot that has run its course.
      if (t0 - entry.receivedAt >= tag.startMs) entries.delete(entry.effect);
      return null;
    }
    const { centre, a, b } = placeOf(entry);
    if (entry.lasting) {
      // Out of sight (walls, a moved viewer): kept, not drawn.
      if (entry.sightAt === null || t0 - entry.sightAt >= SIGHT_MS) { entry.sightAt = t0; entry.inSight = seen(centre, tag.radius) !== false; }
      if (!entry.inSight) return null;
    }
    const slot = { ...params, centre, amp: params.amp * fade };
    if (entry.capsule) Object.assign(slot, { a, b, radius: entry.capsule.width / 2 });
    // The off-screen test uses the whole area around its centre.
    return { params: { centre, radius: tag.radius }, slot, lasting: entry.lasting };
  };

  const draw = (t0, v, active) => {
    if (!filter) {
      try { filter = makeFilter(); } catch (err) { warnOnce(err); host.clear(); return; }
    }
    if (!attached) {
      try { attach(filter); attached = true; } catch (err) { warnOnce(err); host.clear(); return; }
    }
    const slots = chooseSlots(active, v, SCENE_WARP_SLOTS).map((s) => s.slot);
    writeSceneWarp(filter.uniforms, slots, v.worldToScreen, t0);
    // Nothing in view: the pass is skipped until something is.
    filter.enabled = slots.length > 0;
  };

  const host = {
    onEffect(effect) {
      try {
        const data = effect?.data, tag = data?.animaterWarp;
        if (broken || !validTag(tag) || data.moduleName !== 'animater' || entries.has(effect)) return;
        if (data.sceneId !== sceneId() || !allowed()) return;
        // Another level than the one this client views (viewing another redraws the canvas, which clears us).
        const level = levelOf(tag, data), viewed = viewedLevel();
        if (level && viewed && level !== viewed) return;
        const lasting = tag.lengthMs == null;
        // A busy frame budget skips a new teleport warp; a blast's shockwave (its fight's busiest frame) and a
        // lasting haze still show. A one-shot this client cannot see does not ripple the part of the map it can.
        if (!lasting && ((tag.kind !== 'shock' && tight()) || seen(tag.at, tag.radius) === false)) return;
        entries.set(effect, { effect, tag, lasting, capsule: capsuleOf(tag), receivedAt: now(), endedAt: null, sightAt: null, inSight: true });
      } catch (err) {
        console.warn('Animater | map distortion skipped an effect', err);
      }
    },

    // Only a lasting haze ends with its effect; a one-shot keeps its own time.
    onEnded(effect) {
      const entry = entries.get(effect);
      if (entry?.lasting && entry.endedAt === null) {
        try { entry.endedAt = now(); } catch { entries.delete(effect); }
      }
    },

    // Runs on the PIXI ticker, where a throw would stop the canvas: it never throws, and a distortion that
    // fails is dropped.
    tick() {
      let t0, v;
      try {
        if (!entries.size) return unhook();
        if (!allowed()) return host.clear();
        t0 = now(); v = view();
      } catch { return; /* canvas going away */ }
      try {
        const active = [];
        for (const entry of [...entries.values()]) {
          try {
            const a = step(entry, t0, v.zoom);
            if (a) active.push(a);
          } catch (err) {
            console.warn('Animater | dropped a map distortion', err);
            entries.delete(entry.effect);
          }
        }
        if (!entries.size) return unhook();
        draw(t0, v, active);
      } catch (err) {
        console.warn('Animater | dropped the map distortions', err);
        host.clear();
      }
    },

    clear() {
      entries.clear();
      unhook();
      if (filter) {
        try { filter.destroy(); } catch { /* already gone */ }
        filter = null;
      }
    },
  };
  return host;
}
